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
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "").strip()


dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
table = dynamodb.Table(TABLE_NAME)
comprehend = boto3.client("comprehend", region_name=AWS_REGION)
bedrock_runtime = boto3.client("bedrock-runtime", region_name=AWS_REGION)


RESPONSE_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
}


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
    fallback_next_steps = create_next_steps(project_notes)
    comprehend_analysis = analyze_notes_with_comprehend(project_notes)
    bedrock_generation = generate_project_content_with_bedrock(
        project_name=project_name,
        project_notes=project_notes,
        category=category,
        priority=priority,
        fallback_next_steps=fallback_next_steps,
    )

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
        "summary": bedrock_generation["summary"],
        "nextSteps": bedrock_generation["nextSteps"],
        "draftMessage": bedrock_generation["draftMessage"],
        "generationStatus": bedrock_generation["generationStatus"],
        "createdAt": created_at,
    }

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
    return create_response(201, item)


def get_project_notes() -> dict[str, Any]:
    """Handle GET /project-notes."""
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
    """Handle GET /project-notes/{recordId}."""
    path_parameters = event.get("pathParameters") or {}
    record_id = path_parameters.get("recordId")

    if not record_id:
        return create_response(400, {"error": "recordId is required"})

    response = table.get_item(Key={"recordId": record_id})
    item = response.get("Item")

    if not item:
        return create_response(404, {"error": "Project note not found"})

    return create_response(200, item)


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


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Main Lambda entry point."""
    request_id = getattr(context, "aws_request_id", "unknown")

    try:
        method = get_http_method(event)
        path = get_request_path(event)

        LOGGER.info(
            "Request %s. Method: %s. Path: %s",
            request_id,
            method,
            path,
        )

        if method == "OPTIONS":
            return create_response(200, {"message": "CORS preflight successful"})

        if method == "POST" and path == "/project-notes":
            return create_project_note(event)

        if method == "GET" and path == "/project-notes":
            return get_project_notes()

        if method == "GET" and path.startswith("/project-notes/"):
            return get_project_note_by_id(event)

        return create_response(404, {"error": "Route not found"})

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
