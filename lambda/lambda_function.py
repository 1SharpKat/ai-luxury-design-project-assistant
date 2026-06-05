import json
import boto3
import uuid
from datetime import datetime, timezone
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("LuxuryDesignProjectNotes")


def json_default(value):
    if isinstance(value, Decimal):
        return float(value)
    raise TypeError


def classify_category(notes):
    text = notes.lower()
    categories = []

    if any(word in text for word in ["lighting", "keypad", "dimmer", "fixture", "architectural lighting"]):
        categories.append("Lighting Design")

    if any(word in text for word in ["speaker", "audio", "video", "tv", "theater", "rack"]):
        categories.append("A/V Integration")

    if any(word in text for word in ["shade", "shades", "window treatment"]):
        categories.append("Shades")

    if any(word in text for word in ["network", "wifi", "router", "access point"]):
        categories.append("Networking")

    if any(word in text for word in ["camera", "surveillance", "security", "alarm"]):
        categories.append("Security")

    if any(word in text for word in ["builder", "electrician", "vendor", "deadline", "walkthrough"]):
        categories.append("Builder / Vendor Coordination")

    return " / ".join(categories) if categories else "General Project Notes"


def assign_priority(notes):
    text = notes.lower()

    high_words = [
        "urgent",
        "today",
        "tomorrow",
        "before friday",
        "deadline",
        "walkthrough",
        "builder needs",
        "electrician needs"
    ]

    medium_words = [
        "follow up",
        "confirm",
        "review",
        "needs",
        "requested"
    ]

    if any(word in text for word in high_words):
        return "High"

    if any(word in text for word in medium_words):
        return "Medium"

    return "Low"


def create_next_steps(notes):
    text = notes.lower()
    steps = []

    if "keypad" in text:
        steps.append("Confirm keypad locations")

    if "equipment" in text:
        steps.append("Confirm equipment locations")

    if "builder" in text:
        steps.append("Coordinate details with builder")

    if "electric" in text:
        steps.append("Prepare information for electrical walkthrough")

    if "client" in text:
        steps.append("Update client preference notes")

    if not steps:
        steps.append("Review notes and assign follow-up tasks")

    return steps


def create_project_note(event):
    body = json.loads(event.get("body", "{}"))

    client_name = body.get("clientName", "Private Client")
    project_name = body.get("projectName", "Unnamed Project")
    note_type = body.get("noteType", "manual_project_notes")
    source = body.get("source", "manual entry")
    project_notes = body.get("projectNotes", "")

    if not project_notes:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "projectNotes is required"})
        }

    record_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    category = classify_category(project_notes)
    priority = assign_priority(project_notes)
    next_steps = create_next_steps(project_notes)

    summary = (
        f"The notes for {project_name} include project details related to "
        f"{category.lower()}. The priority level is {priority.lower()}."
    )

    draft_message = (
        f"Hi, I wanted to share a quick summary from the {project_name} notes. "
        f"The main items captured include: {project_notes[:250]} "
        "I will confirm the next steps and follow up with any needed details."
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
        "keyPhrases": [],
        "sentiment": "Not analyzed yet",
        "summary": summary,
        "nextSteps": next_steps,
        "draftMessage": draft_message,
        "createdAt": created_at
    }

    table.put_item(Item=item)

    return {
        "statusCode": 201,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(item)
    }


def get_project_notes():
    response = table.scan()
    items = response.get("Items", [])

    items.sort(key=lambda item: item.get("createdAt", ""), reverse=True)

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "count": len(items),
            "items": items
        }, default=json_default)
    }


def lambda_handler(event, context):
    try:
        method = event.get("requestContext", {}).get("http", {}).get("method")

        if method == "POST":
            return create_project_note(event)

        if method == "GET":
            return get_project_notes()

        return {
            "statusCode": 405,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Method not allowed"})
        }

    except Exception as error:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": str(error)})
        }