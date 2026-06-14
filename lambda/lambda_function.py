import base64
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

AWS_REGION = os.environ.get("AWS_REGION", "us-west-2")
TABLE_NAME = os.environ.get("TABLE_NAME", "LuxuryDesignProjectNotes")
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "").strip()
COVER_PHOTO_BUCKET = os.environ.get("COVER_PHOTO_BUCKET", "").strip()
COVER_PHOTO_URL_BASE = os.environ.get("COVER_PHOTO_URL_BASE", "").strip()


def env_flag(name: str, default: bool = False) -> bool:
    """Read a boolean feature flag from Lambda environment variables."""
    value = os.environ.get(name)

    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "on"}


def request_flag(
    body: dict[str, Any],
    names: list[str],
    default: bool = False,
) -> bool:
    """Read a boolean request flag from a JSON body."""
    for name in names:
        if name not in body:
            continue

        value = body.get(name)

        if isinstance(value, bool):
            return value

        if isinstance(value, (int, float)):
            return bool(value)

        return str(value).strip().lower() in {"1", "true", "yes", "on"}

    return default


AI_ENABLED = env_flag("AI_ENABLED", True)
PRIVATE_AI_ENABLED = env_flag("PRIVATE_AI_ENABLED", False)
REQUIRE_AUTH = env_flag("REQUIRE_AUTH", False)
PRIVATE_COVER_PHOTOS = env_flag("PRIVATE_COVER_PHOTOS", REQUIRE_AUTH)
ALLOW_EXTERNAL_COVER_URLS = env_flag("ALLOW_EXTERNAL_COVER_URLS", True)
PRIVATE_PATH_PREFIX = os.environ.get("PRIVATE_PATH_PREFIX", "/private").rstrip("/")

ALLOWED_COVER_TYPES = {"image/jpeg", "image/png"}


dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
table = dynamodb.Table(TABLE_NAME)
comprehend = boto3.client("comprehend", region_name=AWS_REGION)
bedrock_runtime = boto3.client("bedrock-runtime", region_name=AWS_REGION)
s3 = boto3.client("s3", region_name=AWS_REGION)


RESPONSE_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Allow-Methods": "DELETE,GET,POST,OPTIONS",
}


class AuthError(Exception):
    """Raised when a request is missing valid authenticated-user context."""


def json_default(value: Any) -> Any:
    """Convert DynamoDB Decimal values into JSON-compatible numbers."""
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return float(value)

    raise TypeError(
        f"Object of type {type(value).__name__} is not JSON serializable"
    )


def convert_floats_to_decimal(value: Any) -> Any:
    """Recursively convert floats to Decimal for DynamoDB storage."""
    if isinstance(value, float):
        return Decimal(str(value))

    if isinstance(value, dict):
        return {
            key: convert_floats_to_decimal(item)
            for key, item in value.items()
        }

    if isinstance(value, list):
        return [convert_floats_to_decimal(item) for item in value]

    return value


def create_response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    """Create a consistent API Gateway response."""
    return {
        "statusCode": status_code,
        "headers": RESPONSE_HEADERS,
        "body": json.dumps(body, default=json_default),
    }


def parse_request_body(event: dict[str, Any]) -> dict[str, Any]:
    """Read and decode the JSON request body from API Gateway."""
    body = event.get("body")

    if body is None:
        return {}

    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")

    if isinstance(body, dict):
        return body

    if not isinstance(body, str):
        raise ValueError("Request body must be a JSON object or JSON string")

    if not body.strip():
        return {}

    parsed_body = json.loads(body)

    if not isinstance(parsed_body, dict):
        raise ValueError("Request body must contain a JSON object")

    return parsed_body



def safe_slug(value: str) -> str:
    """Create a safe S3 path segment from a project name."""
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug[:80] or "project"


def get_auth_claims(event: dict[str, Any]) -> dict[str, Any]:
    """Read JWT claims supplied by an API Gateway JWT authorizer."""
    authorizer = event.get("requestContext", {}).get("authorizer", {})
    jwt = authorizer.get("jwt", {})
    claims = jwt.get("claims", {})

    return claims if isinstance(claims, dict) else {}


def get_owner_user_id(event: dict[str, Any]) -> str:
    """Return the authenticated user's stable owner id when auth is required."""
    claims = get_auth_claims(event)
    owner_id = str(
        claims.get("sub")
        or claims.get("username")
        or claims.get("cognito:username")
        or ""
    ).strip()

    if request_requires_auth(event) and not owner_id:
        raise AuthError("Sign in is required before using private project data")

    return owner_id


def get_owner_label(event: dict[str, Any]) -> str:
    """Return a human-readable user label for stored metadata."""
    claims = get_auth_claims(event)

    return str(
        claims.get("email")
        or claims.get("name")
        or claims.get("cognito:username")
        or ""
    ).strip()


def user_prefix(owner_user_id: str) -> str:
    """Create a safe private S3 prefix for an authenticated user."""
    return safe_slug(owner_user_id or "public")


def verify_owner(
    item: dict[str, Any],
    owner_user_id: str,
    require_owner: bool,
) -> bool:
    """Confirm a record belongs to the authenticated user in private mode."""
    if not require_owner:
        return "ownerUserId" not in item

    return item.get("ownerUserId") == owner_user_id


def generate_cover_view_url(key: str) -> str:
    """Create a short-lived private S3 view URL."""
    return s3.generate_presigned_url(
        ClientMethod="get_object",
        Params={
            "Bucket": COVER_PHOTO_BUCKET,
            "Key": key,
        },
        ExpiresIn=900,
    )


def attach_cover_view_url(
    item: dict[str, Any],
    owner_user_id: str = "",
    require_owner: bool = False,
) -> dict[str, Any]:
    """Return a copy of an item with a secure cover-photo view URL when needed."""
    if not PRIVATE_COVER_PHOTOS:
        return item

    key = str(item.get("coverPhotoKey", "")).strip()
    if not key or not COVER_PHOTO_BUCKET:
        return item

    if require_owner:
        expected_prefix = f"private/{user_prefix(owner_user_id)}/"
        if not key.startswith(expected_prefix):
            sanitized = dict(item)
            sanitized.pop("coverPhotoUrl", None)
            return sanitized

    item_with_url = dict(item)
    item_with_url["coverPhotoUrl"] = generate_cover_view_url(key)
    return item_with_url


def prepare_item_for_response(
    item: dict[str, Any],
    owner_user_id: str = "",
    require_owner: bool = False,
) -> dict[str, Any]:
    """Remove internal ownership metadata before returning a project record."""
    prepared = attach_cover_view_url(item, owner_user_id, require_owner)
    prepared.pop("ownerUserId", None)
    prepared.pop("ownerLabel", None)
    return prepared


def file_extension(content_type: str, file_name: str) -> str:
    """Choose a safe extension for an allowed image type."""
    if content_type == "image/png":
        return "png"

    if content_type == "image/jpeg":
        return "jpg"

    original = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else "jpg"
    return "png" if original == "png" else "jpg"


def create_project_cover_upload_url(event: dict[str, Any]) -> dict[str, Any]:
    """Handle POST /project-cover-upload-url."""
    if not COVER_PHOTO_BUCKET:
        return create_response(
            503,
            {"error": "Project cover-photo storage is not configured"},
        )

    private_request = request_requires_auth(event)
    owner_user_id = get_owner_user_id(event)

    try:
        body = parse_request_body(event)
    except json.JSONDecodeError:
        return create_response(400, {"error": "Request body must contain valid JSON"})
    except ValueError as error:
        return create_response(400, {"error": str(error)})

    project_name = str(body.get("projectName", "project")).strip()
    file_name = str(body.get("fileName", "cover-photo.jpg")).strip()
    content_type = str(body.get("contentType", "")).strip().lower()

    if content_type not in ALLOWED_COVER_TYPES:
        return create_response(
            400,
            {"error": "Cover photo must be a JPG, JPEG, or PNG file"},
        )

    extension = file_extension(content_type, file_name)

    if private_request and PRIVATE_COVER_PHOTOS:
        key = (
            f"private/{user_prefix(owner_user_id)}/project-covers/"
            f"{safe_slug(project_name)}/{uuid.uuid4()}.{extension}"
        )
    else:
        key = (
            f"project-covers/{safe_slug(project_name)}/"
            f"{uuid.uuid4()}.{extension}"
        )

    upload_url = s3.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": COVER_PHOTO_BUCKET,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=900,
    )

    if private_request and PRIVATE_COVER_PHOTOS:
        file_url = ""
    elif COVER_PHOTO_URL_BASE:
        file_url = f"{COVER_PHOTO_URL_BASE.rstrip('/')}/{key}"
    else:
        file_url = (
            f"https://{COVER_PHOTO_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"
        )

    return create_response(
        200,
        {
            "uploadUrl": upload_url,
            "fileUrl": file_url,
            "s3Key": key,
        },
    )

def classify_category(notes: str) -> str:
    """Assign project categories using keyword matching."""
    text = notes.lower()
    categories: list[str] = []

    category_keywords = {
        "Lighting Design": [
            "lighting",
            "keypad",
            "dimmer",
            "fixture",
            "architectural lighting",
        ],
        "A/V Integration": [
            "speaker",
            "audio",
            "video",
            "tv",
            "television",
            "theater",
            "rack",
        ],
        "Shades": ["shade", "shades", "window treatment"],
        "Networking": ["network", "wifi", "wi-fi", "router", "access point"],
        "Security": ["camera", "surveillance", "security", "alarm"],
        "Builder / Vendor Coordination": [
            "builder",
            "electrician",
            "vendor",
            "deadline",
            "walkthrough",
        ],
    }

    for category, keywords in category_keywords.items():
        if any(keyword in text for keyword in keywords):
            categories.append(category)

    return " / ".join(categories) if categories else "General Project Notes"


def assign_priority(notes: str) -> str:
    """Assign Low, Medium, or High priority."""
    text = notes.lower()

    high_priority_words = [
        "urgent",
        "asap",
        "today",
        "tomorrow",
        "before friday",
        "deadline",
        "walkthrough",
        "builder needs",
        "electrician needs",
    ]

    medium_priority_words = [
        "follow up",
        "follow-up",
        "confirm",
        "review",
        "needs",
        "requested",
    ]

    if any(word in text for word in high_priority_words):
        return "High"

    if any(word in text for word in medium_priority_words):
        return "Medium"

    return "Low"


def create_next_steps(notes: str) -> list[str]:
    """Create fallback action items from project-note keywords."""
    text = notes.lower()
    steps: list[str] = []

    if "keypad" in text:
        steps.append("Confirm keypad locations")

    if "equipment" in text:
        steps.append("Confirm equipment locations")

    if "builder" in text:
        steps.append("Coordinate details with builder")

    if "electric" in text:
        steps.append("Prepare information for the electrical walkthrough")

    if "client" in text:
        steps.append("Update client preference notes")

    if "speaker" in text or "audio" in text:
        steps.append("Confirm audio and speaker requirements")

    if "lighting" in text:
        steps.append("Update lighting design requirements")

    if not steps:
        steps.append("Review notes and assign follow-up tasks")

    return steps


def analyze_notes_with_comprehend(project_notes: str) -> dict[str, Any]:
    """Use Amazon Comprehend for key phrases and sentiment."""
    try:
        key_phrase_response = comprehend.detect_key_phrases(
            Text=project_notes,
            LanguageCode="en",
        )

        sentiment_response = comprehend.detect_sentiment(
            Text=project_notes,
            LanguageCode="en",
        )

        key_phrases = [
            phrase["Text"]
            for phrase in key_phrase_response.get("KeyPhrases", [])
            if phrase.get("Text")
        ][:10]

        sentiment_scores = convert_floats_to_decimal(
            sentiment_response.get("SentimentScore", {})
        )

        return {
            "keyPhrases": key_phrases,
            "sentiment": sentiment_response.get("Sentiment", "UNKNOWN"),
            "sentimentScores": sentiment_scores,
            "analysisStatus": "COMPLETED",
        }

    except ClientError as error:
        error_details = error.response.get("Error", {})
        LOGGER.warning(
            "Amazon Comprehend unavailable. Code: %s. Message: %s",
            error_details.get("Code", "UNKNOWN"),
            error_details.get("Message", str(error)),
        )
        return {
            "keyPhrases": [],
            "sentiment": "UNKNOWN",
            "sentimentScores": {},
            "analysisStatus": "COMPREHEND_UNAVAILABLE",
        }

    except Exception:
        LOGGER.exception("Unexpected Amazon Comprehend error")
        return {
            "keyPhrases": [],
            "sentiment": "UNKNOWN",
            "sentimentScores": {},
            "analysisStatus": "COMPREHEND_ERROR",
        }


def create_fallback_summary(project_name: str, category: str, priority: str) -> str:
    """Create a rule-based summary when Bedrock is unavailable."""
    return (
        f"The notes for {project_name} include project details related to "
        f"{category.lower()}. The priority level is {priority.lower()}."
    )


def create_fallback_draft_message(project_name: str, project_notes: str) -> str:
    """Create a rule-based follow-up message when Bedrock is unavailable."""
    return (
        f"Hi, I wanted to share a quick summary from the {project_name} notes. "
        f"The main items captured include: {project_notes[:250]} "
        "I will confirm the next steps and follow up with any needed details."
    )


def extract_json_object(text: str) -> dict[str, Any]:
    """Extract a JSON object from plain text or a fenced JSON response."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("Bedrock response did not contain a JSON object")
        parsed = json.loads(cleaned[start : end + 1])

    if not isinstance(parsed, dict):
        raise ValueError("Bedrock response JSON must be an object")

    return parsed


def generate_project_content_with_bedrock(
    project_name: str,
    project_notes: str,
    category: str,
    priority: str,
    fallback_next_steps: list[str],
) -> dict[str, Any]:
    """Generate a summary, next steps, and draft message with Amazon Bedrock."""
    fallback = {
        "summary": create_fallback_summary(project_name, category, priority),
        "nextSteps": fallback_next_steps,
        "draftMessage": create_fallback_draft_message(project_name, project_notes),
        "generationStatus": "BEDROCK_UNAVAILABLE",
    }

    if not BEDROCK_MODEL_ID:
        LOGGER.warning("BEDROCK_MODEL_ID environment variable is not configured")
        fallback["generationStatus"] = "BEDROCK_NOT_CONFIGURED"
        return fallback

    prompt = f"""
You are a project coordination assistant for a luxury design, lighting,
automation, and A/V integration company.

Analyze the project notes below. Return only one valid JSON object with exactly
these fields:
- summary: a concise professional summary string
- nextSteps: an array of specific, actionable strings
- draftMessage: a polished follow-up message string for the most relevant
  recipient, such as the client, builder, electrician, or vendor

Do not use markdown code fences. Do not add commentary outside the JSON.
Do not invent dates, approvals, specifications, or commitments that are not in
the notes. Human review is required before the message is sent.

Project name: {project_name}
Current category: {category}
Current priority: {priority}
Project notes:
{project_notes}
""".strip()

    try:
        response = bedrock_runtime.converse(
            modelId=BEDROCK_MODEL_ID,
            system=[
                {
                    "text": (
                        "Produce accurate, professional project-coordination "
                        "content. Return valid JSON only."
                    )
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": [{"text": prompt}],
                }
            ],
            inferenceConfig={
                "maxTokens": 1200,
                "temperature": 0.2,
            },
        )

        content_blocks = (
            response.get("output", {})
            .get("message", {})
            .get("content", [])
        )
        response_text = "".join(
            block.get("text", "")
            for block in content_blocks
            if isinstance(block, dict)
        ).strip()

        parsed = extract_json_object(response_text)
        summary = str(parsed.get("summary", "")).strip()
        draft_message = str(parsed.get("draftMessage", "")).strip()
        next_steps_raw = parsed.get("nextSteps", [])
        next_steps = [
            str(step).strip()
            for step in next_steps_raw
            if str(step).strip()
        ] if isinstance(next_steps_raw, list) else []

        if not summary or not draft_message or not next_steps:
            raise ValueError("Bedrock response was missing required content")

        return {
            "summary": summary,
            "nextSteps": next_steps,
            "draftMessage": draft_message,
            "generationStatus": "COMPLETED",
        }

    except ClientError as error:
        error_details = error.response.get("Error", {})
        LOGGER.warning(
            "Amazon Bedrock unavailable. Code: %s. Message: %s",
            error_details.get("Code", "UNKNOWN"),
            error_details.get("Message", str(error)),
        )
        return fallback

    except Exception:
        LOGGER.exception("Unexpected Amazon Bedrock generation error")
        fallback["generationStatus"] = "BEDROCK_ERROR"
        return fallback


def create_project_note(event: dict[str, Any]) -> dict[str, Any]:
    """Handle POST /project-notes."""
    private_request = request_requires_auth(event)
    owner_user_id = get_owner_user_id(event)
    owner_label = get_owner_label(event)

    try:
        body = parse_request_body(event)
    except json.JSONDecodeError:
        return create_response(400, {"error": "Request body must contain valid JSON"})
    except ValueError as error:
        return create_response(400, {"error": str(error)})

    client_name = str(body.get("clientName", "Private Client")).strip()
    project_name = str(body.get("projectName", "Unnamed Project")).strip()
    note_type = str(body.get("noteType", "manual_project_notes")).strip()
    source = str(body.get("source", "manual entry")).strip()
    project_notes = str(body.get("projectNotes", "")).strip()

    if not project_notes:
        return create_response(400, {"error": "projectNotes is required"})

    if (
        private_request
        and not ALLOW_EXTERNAL_COVER_URLS
        and str(body.get("coverPhotoType", "")).strip() == "image/url"
    ):
        return create_response(
            400,
            {"error": "External cover-photo URLs are disabled for this workspace"},
        )

    record_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    category = classify_category(project_notes)
    priority = assign_priority(project_notes)
    fallback_next_steps = create_next_steps(project_notes)

    ai_allowed_for_route = PRIVATE_AI_ENABLED if private_request else AI_ENABLED
    ai_requested = request_flag(
        body,
        ["aiProcessingEnabled", "aiEnabled"],
        ai_allowed_for_route,
    )
    ai_enabled_for_request = ai_allowed_for_route and ai_requested

    if ai_enabled_for_request:
        comprehend_analysis = analyze_notes_with_comprehend(project_notes)
        bedrock_generation = generate_project_content_with_bedrock(
            project_name=project_name,
            project_notes=project_notes,
            category=category,
            priority=priority,
            fallback_next_steps=fallback_next_steps,
        )
    else:
        comprehend_analysis = {
            "keyPhrases": [],
            "sentiment": "NOT_ANALYZED",
            "sentimentScores": {},
            "analysisStatus": "AI_DISABLED",
        }
        bedrock_generation = {
            "summary": create_fallback_summary(project_name, category, priority),
            "nextSteps": fallback_next_steps,
            "draftMessage": (
                "AI draft generation is turned off for this project note. "
                "Use the saved notes and next steps for manual follow-up."
            ),
            "generationStatus": "AI_DISABLED",
        }

    item = {
        "recordId": record_id,
        "clientName": client_name,
        "projectName": project_name,
        "noteType": note_type,
        "source": source,
        "projectNotes": project_notes,
        "aiProcessingRequested": ai_requested,
        "aiProcessingEnabled": ai_enabled_for_request,
        "category": category,
        "priority": priority,
        "keyPhrases": comprehend_analysis["keyPhrases"],
        "sentiment": comprehend_analysis["sentiment"],
        "sentimentScores": comprehend_analysis["sentimentScores"],
        "analysisStatus": comprehend_analysis["analysisStatus"],
        "summary": bedrock_generation["summary"],
        "nextSteps": bedrock_generation["nextSteps"],
        "draftMessage": bedrock_generation["draftMessage"],
        "generationStatus": bedrock_generation["generationStatus"],
        "createdAt": created_at,
    }

    if owner_user_id:
        item["ownerUserId"] = owner_user_id

    if owner_label:
        item["ownerLabel"] = owner_label

    for key in [
        "coverPhotoUrl",
        "coverPhotoKey",
        "coverPhotoName",
        "coverPhotoType",
    ]:
        value = body.get(key)
        if value:
            item[key] = str(value)

    table.put_item(
        Item=item,
        ConditionExpression="attribute_not_exists(recordId)",
    )

    LOGGER.info(
        "Created project note record %s. Comprehend: %s. Bedrock: %s",
        record_id,
        item["analysisStatus"],
        item["generationStatus"],
    )
    return create_response(
        201,
        prepare_item_for_response(item, owner_user_id, private_request),
    )


def get_project_notes(event: dict[str, Any]) -> dict[str, Any]:
    """Handle GET /project-notes."""
    private_request = request_requires_auth(event)
    owner_user_id = get_owner_user_id(event)
    items: list[dict[str, Any]] = []
    scan_arguments: dict[str, Any] = {}

    if private_request:
        scan_arguments["FilterExpression"] = Attr("ownerUserId").eq(owner_user_id)
    else:
        scan_arguments["FilterExpression"] = Attr("ownerUserId").not_exists()

    while True:
        response = table.scan(**scan_arguments)
        items.extend(
            prepare_item_for_response(item, owner_user_id, private_request)
            for item in response.get("Items", [])
        )

        last_evaluated_key = response.get("LastEvaluatedKey")
        if not last_evaluated_key:
            break

        scan_arguments["ExclusiveStartKey"] = last_evaluated_key

    items.sort(key=lambda item: item.get("createdAt", ""), reverse=True)
    return create_response(200, {"count": len(items), "items": items})


def get_project_note_by_id(event: dict[str, Any]) -> dict[str, Any]:
    """Handle GET /project-notes/{recordId}."""
    private_request = request_requires_auth(event)
    owner_user_id = get_owner_user_id(event)
    path_parameters = event.get("pathParameters") or {}
    record_id = path_parameters.get("recordId")

    if not record_id:
        path = get_request_path(event)
        record_id = path.rsplit("/", 1)[-1]

    if not record_id:
        return create_response(400, {"error": "recordId is required"})

    response = table.get_item(Key={"recordId": record_id})
    item = response.get("Item")

    if not item:
        return create_response(404, {"error": "Project note not found"})

    if not verify_owner(item, owner_user_id, private_request):
        return create_response(404, {"error": "Project note not found"})

    return create_response(
        200,
        prepare_item_for_response(item, owner_user_id, private_request),
    )


def delete_project_note_by_id(event: dict[str, Any]) -> dict[str, Any]:
    """Handle DELETE /project-notes/{recordId}."""
    private_request = request_requires_auth(event)
    owner_user_id = get_owner_user_id(event)
    path_parameters = event.get("pathParameters") or {}
    record_id = path_parameters.get("recordId")

    if not record_id:
        path = get_request_path(event)
        record_id = path.rsplit("/", 1)[-1]

    if not record_id:
        return create_response(400, {"error": "recordId is required"})

    response = table.get_item(Key={"recordId": record_id})
    item = response.get("Item")

    if not item or not verify_owner(item, owner_user_id, private_request):
        return create_response(404, {"error": "Project note not found"})

    table.delete_item(
        Key={"recordId": record_id},
        ConditionExpression="attribute_exists(recordId)",
    )

    LOGGER.info("Deleted project note record %s", record_id)
    return create_response(
        200,
        {
            "deleted": True,
            "recordId": record_id,
        },
    )


def get_http_method(event: dict[str, Any]) -> str:
    """Read the HTTP method from API Gateway."""
    method = event.get("requestContext", {}).get("http", {}).get("method")

    if method:
        return method.upper()

    return str(event.get("httpMethod", "")).upper()


def get_request_path(event: dict[str, Any]) -> str:
    """Read the request path from API Gateway."""
    path = event.get("requestContext", {}).get("http", {}).get("path")

    if path:
        return path

    return str(event.get("path", ""))


def is_private_request(event: dict[str, Any]) -> bool:
    """Return True when the request is for the signed-in private workspace."""
    path = get_request_path(event)
    return bool(PRIVATE_PATH_PREFIX and path.startswith(f"{PRIVATE_PATH_PREFIX}/"))


def request_requires_auth(event: dict[str, Any]) -> bool:
    """Private routes always require auth; REQUIRE_AUTH can lock all routes."""
    return REQUIRE_AUTH or is_private_request(event)


def normalize_request_path(path: str) -> str:
    """Strip the private route prefix before route matching."""
    if PRIVATE_PATH_PREFIX and path.startswith(f"{PRIVATE_PATH_PREFIX}/"):
        return path[len(PRIVATE_PATH_PREFIX) :]

    return path


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Main Lambda entry point."""
    request_id = getattr(context, "aws_request_id", "unknown")

    try:
        method = get_http_method(event)
        raw_path = get_request_path(event)
        path = normalize_request_path(raw_path)

        LOGGER.info(
            "Request %s. Method: %s. Path: %s",
            request_id,
            method,
            raw_path,
        )

        if method == "OPTIONS":
            return create_response(200, {"message": "CORS preflight successful"})

        if method == "POST" and path == "/project-cover-upload-url":
            return create_project_cover_upload_url(event)

        if method == "POST" and path == "/project-notes":
            return create_project_note(event)

        if method == "GET" and path == "/project-notes":
            return get_project_notes(event)

        if method == "GET" and path.startswith("/project-notes/"):
            return get_project_note_by_id(event)

        if method == "DELETE" and path.startswith("/project-notes/"):
            return delete_project_note_by_id(event)

        return create_response(404, {"error": "Route not found"})

    except AuthError as error:
        return create_response(401, {"error": str(error)})

    except ClientError as error:
        LOGGER.exception("AWS service error for request %s", request_id)
        error_code = error.response.get("Error", {}).get(
            "Code",
            "AWS_SERVICE_ERROR",
        )

        if error_code == "ConditionalCheckFailedException":
            return create_response(409, {"error": "A record with this ID already exists"})

        return create_response(
            500,
            {
                "error": "AWS service request failed",
                "requestId": request_id,
            },
        )

    except Exception:
        LOGGER.exception("Unexpected error for request %s", request_id)
        return create_response(
            500,
            {
                "error": "Internal server error",
                "requestId": request_id,
            },
        )
