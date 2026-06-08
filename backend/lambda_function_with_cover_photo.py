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
from botocore.exceptions import ClientError


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

AWS_REGION = os.environ.get("AWS_REGION", "us-west-2")
TABLE_NAME = os.environ.get("TABLE_NAME", "LuxuryDesignProjectNotes")
COVER_PHOTO_BUCKET = os.environ.get("COVER_PHOTO_BUCKET", "")
COVER_PHOTO_URL_BASE = os.environ.get("COVER_PHOTO_URL_BASE", "")

MAX_COVER_PHOTO_BYTES = 5 * 1024 * 1024
ALLOWED_COVER_TYPES = {"image/jpeg", "image/png"}


dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
table = dynamodb.Table(TABLE_NAME)
comprehend = boto3.client("comprehend", region_name=AWS_REGION)
s3 = boto3.client("s3", region_name=AWS_REGION)


RESPONSE_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
}


def json_default(value: Any) -> Any:
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return float(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def convert_floats_to_decimal(value: Any) -> Any:
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {key: convert_floats_to_decimal(item) for key, item in value.items()}
    if isinstance(value, list):
        return [convert_floats_to_decimal(item) for item in value]
    return value


def create_response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": RESPONSE_HEADERS,
        "body": json.dumps(body, default=json_default),
    }


def parse_request_body(event: dict[str, Any]) -> dict[str, Any]:
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
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug[:80] or "project"


def file_extension(content_type: str, file_name: str) -> str:
    if content_type == "image/png":
        return "png"
    if content_type == "image/jpeg":
        return "jpg"
    original = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else "jpg"
    return "png" if original == "png" else "jpg"


def create_project_cover_upload_url(event: dict[str, Any]) -> dict[str, Any]:
    if not COVER_PHOTO_BUCKET:
        return create_response(500, {"error": "COVER_PHOTO_BUCKET is not configured"})

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
        return create_response(400, {"error": "Cover photo must be JPG, JPEG, or PNG"})

    extension = file_extension(content_type, file_name)
    key = f"project-covers/{safe_slug(project_name)}/{uuid.uuid4()}.{extension}"

    upload_url = s3.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": COVER_PHOTO_BUCKET,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=900,
    )

    if COVER_PHOTO_URL_BASE:
        file_url = f"{COVER_PHOTO_URL_BASE.rstrip('/')}/{key}"
    else:
        file_url = f"https://{COVER_PHOTO_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"

    return create_response(200, {"uploadUrl": upload_url, "fileUrl": file_url, "s3Key": key})


def classify_category(notes: str) -> str:
    text = notes.lower()
    categories: list[str] = []
    category_keywords = {
        "Lighting Design": ["lighting", "keypad", "dimmer", "fixture", "architectural lighting"],
        "A/V Integration": ["speaker", "audio", "video", "tv", "television", "theater", "rack"],
        "Shades": ["shade", "shades", "window treatment"],
        "Networking": ["network", "wifi", "wi-fi", "router", "access point"],
        "Security": ["camera", "surveillance", "security", "alarm"],
        "Builder / Vendor Coordination": ["builder", "electrician", "vendor", "deadline", "walkthrough"],
    }
    for category, keywords in category_keywords.items():
        if any(keyword in text for keyword in keywords):
            categories.append(category)
    return " / ".join(categories) if categories else "General Project Notes"


def assign_priority(notes: str) -> str:
    text = notes.lower()
    high_priority_words = ["urgent", "asap", "today", "tomorrow", "before friday", "deadline", "walkthrough", "builder needs", "electrician needs"]
    medium_priority_words = ["follow up", "follow-up", "confirm", "review", "needs", "requested"]
    if any(word in text for word in high_priority_words):
        return "High"
    if any(word in text for word in medium_priority_words):
        return "Medium"
    return "Low"


def create_next_steps(notes: str) -> list[str]:
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
    try:
        key_phrase_response = comprehend.detect_key_phrases(Text=project_notes, LanguageCode="en")
        sentiment_response = comprehend.detect_sentiment(Text=project_notes, LanguageCode="en")
        key_phrases = [phrase["Text"] for phrase in key_phrase_response.get("KeyPhrases", []) if phrase.get("Text")][:10]
        sentiment_scores = convert_floats_to_decimal(sentiment_response.get("SentimentScore", {}))
        return {
            "keyPhrases": key_phrases,
            "sentiment": sentiment_response.get("Sentiment", "UNKNOWN"),
            "sentimentScores": sentiment_scores,
            "analysisStatus": "COMPLETED",
        }
    except ClientError as error:
        LOGGER.warning("Amazon Comprehend unavailable: %s", error)
        return {"keyPhrases": [], "sentiment": "UNKNOWN", "sentimentScores": {}, "analysisStatus": "COMPREHEND_UNAVAILABLE"}
    except Exception:
        LOGGER.exception("Unexpected Amazon Comprehend error")
        return {"keyPhrases": [], "sentiment": "UNKNOWN", "sentimentScores": {}, "analysisStatus": "COMPREHEND_ERROR"}


def create_summary(project_name: str, category: str, priority: str) -> str:
    return f"{project_name} has been categorized as {category} with {priority.lower()} priority. Review the action items and follow-up message before sharing with the project team."


def create_draft_message(project_name: str, project_notes: str) -> str:
    return f"Hi, I wanted to share a quick summary from the {project_name} notes. The main items captured include: {project_notes[:250]} I will confirm the next steps and follow up with any needed details."


def create_project_note(event: dict[str, Any]) -> dict[str, Any]:
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

    record_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    category = classify_category(project_notes)
    priority = assign_priority(project_notes)
    next_steps = create_next_steps(project_notes)
    comprehend_analysis = analyze_notes_with_comprehend(project_notes)

    item = {
        "recordId": record_id,
        "clientName": client_name,
        "projectName": project_name,
        "noteType": note_type,
        "source": source,
        "projectNotes": project_notes,
        "category": category,
        "priority": priority,
        "keyPhrases": comprehend_analysis["keyPhrases"],
        "sentiment": comprehend_analysis["sentiment"],
        "sentimentScores": comprehend_analysis["sentimentScores"],
        "analysisStatus": comprehend_analysis["analysisStatus"],
        "summary": create_summary(project_name, category, priority),
        "nextSteps": next_steps,
        "draftMessage": create_draft_message(project_name, project_notes),
        "createdAt": created_at,
    }

    for key in ["coverPhotoUrl", "coverPhotoKey", "coverPhotoName", "coverPhotoType"]:
        value = body.get(key)
        if value:
            item[key] = str(value)

    table.put_item(Item=item, ConditionExpression="attribute_not_exists(recordId)")
    return create_response(201, item)


def get_project_notes() -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    scan_arguments: dict[str, Any] = {}
    while True:
        response = table.scan(**scan_arguments)
        items.extend(response.get("Items", []))
        last_evaluated_key = response.get("LastEvaluatedKey")
        if not last_evaluated_key:
            break
        scan_arguments["ExclusiveStartKey"] = last_evaluated_key
    items.sort(key=lambda item: item.get("createdAt", ""), reverse=True)
    return create_response(200, {"count": len(items), "items": items})


def get_project_note_by_id(event: dict[str, Any]) -> dict[str, Any]:
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
    return create_response(200, item)


def get_http_method(event: dict[str, Any]) -> str:
    method = event.get("requestContext", {}).get("http", {}).get("method")
    if method:
        return method.upper()
    return str(event.get("httpMethod", "")).upper()


def get_request_path(event: dict[str, Any]) -> str:
    path = event.get("requestContext", {}).get("http", {}).get("path")
    if path:
        return path
    return str(event.get("path", ""))


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    request_id = getattr(context, "aws_request_id", "unknown")
    try:
        method = get_http_method(event)
        path = get_request_path(event)
        LOGGER.info("Request %s. Method: %s. Path: %s", request_id, method, path)

        if method == "OPTIONS":
            return create_response(200, {"message": "CORS preflight successful"})
        if method == "POST" and path == "/project-cover-upload-url":
            return create_project_cover_upload_url(event)
        if method == "POST" and path == "/project-notes":
            return create_project_note(event)
        if method == "GET" and path == "/project-notes":
            return get_project_notes()
        if method == "GET" and path.startswith("/project-notes/"):
            return get_project_note_by_id(event)
        return create_response(404, {"error": "Route not found"})
    except ClientError as error:
        LOGGER.exception("AWS service error for request %s", request_id)
        return create_response(500, {"error": "AWS service request failed", "requestId": request_id})
    except Exception:
        LOGGER.exception("Unexpected error for request %s", request_id)
        return create_response(500, {"error": "Internal server error", "requestId": request_id})
