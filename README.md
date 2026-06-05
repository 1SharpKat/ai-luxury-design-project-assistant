# AI Luxury Design Project Assistant

A serverless AWS application for organizing luxury design project notes, walkthrough transcripts, action items, and client follow-up communication.

## Overview

The AI Luxury Design Project Assistant is designed for high-end residential design and A/V project teams that need a better way to organize project notes, walkthrough details, client preferences, technical requirements, builder coordination items, vendor communication, and follow-up tasks.

Luxury design projects often involve many moving parts. Details may come from client meetings, site walkthroughs, lighting reviews, builder conversations, vendor updates, email notes, or exported transcripts from tools such as Plaud. This application provides a backend workflow for submitting raw project notes, processing the content, saving a structured project record, and returning organized project information.

The current version is a working backend MVP built with AWS serverless services.

## Current Build Status

The backend MVP is working.

The application can now create project note records, retrieve all saved project note records, and retrieve one specific project note by `recordId`.

## Current Backend Flow

```text
User / Project Coordinator
        ↓
Amazon API Gateway
        ↓
AWS Lambda
        ↓
Amazon DynamoDB
        ↓
Structured JSON Response
```

## AWS Services Used

| AWS Service        | Purpose                                                            |
| ------------------ | ------------------------------------------------------------------ |
| Amazon API Gateway | Provides API endpoints for submitting and retrieving project notes |
| AWS Lambda         | Processes submitted notes and handles API requests                 |
| Amazon DynamoDB    | Stores project note records                                        |
| AWS IAM            | Manages permissions between Lambda and DynamoDB                    |
| Amazon CloudWatch  | Captures Lambda execution logs for testing and troubleshooting     |

## Current Features

* Submit raw project notes through an API
* Support manually entered notes and walkthrough transcript text
* Accept notes from sources such as Plaud transcript exports
* Assign a project category using keyword logic
* Assign a priority level based on urgency and deadline language
* Generate basic next steps
* Generate a basic project summary
* Generate a draft follow-up message
* Store the full project record in DynamoDB
* Retrieve all saved project note records
* Retrieve one saved project note by `recordId`
* Return structured JSON responses

## Current API Routes

```text
POST /project-notes
GET /project-notes
GET /project-notes/{recordId}
```

## Current AWS Resources

| Resource Type          | Resource Name                   |
| ---------------------- | ------------------------------- |
| API Gateway API        | LuxuryDesignProjectNotesAPI     |
| Lambda Function        | luxury-design-project-notes-api |
| DynamoDB Table         | LuxuryDesignProjectNotes        |
| DynamoDB Partition Key | recordId                        |

## Example POST Request

```json
{
  "clientName": "Private Client",
  "projectName": "Deer Valley Residence",
  "noteType": "site_walkthrough_transcript",
  "source": "Plaud transcript",
  "projectNotes": "Client wants warm architectural lighting, hidden speakers, simple controls, and keypad locations sent to the builder before Friday. Builder also needs confirmation on equipment locations before the electrical walkthrough."
}
```

## Example POST Response

```json
{
  "recordId": "2b372209-00cf-43f1-8e73-26632a34c051",
  "clientName": "Private Client",
  "projectName": "Deer Valley Residence",
  "noteType": "site_walkthrough_transcript",
  "source": "Plaud transcript",
  "projectNotes": "Client wants warm architectural lighting, hidden speakers, simple controls, and keypad locations sent to the builder before Friday. Builder also needs confirmation on equipment locations before the electrical walkthrough.",
  "category": "Lighting Design / A/V Integration / Builder / Vendor Coordination",
  "priority": "High",
  "keyPhrases": [],
  "sentiment": "Not analyzed yet",
  "summary": "The notes for Deer Valley Residence include project details related to lighting design / a/v integration / builder / vendor coordination. The priority level is high.",
  "nextSteps": [
    "Confirm keypad locations",
    "Confirm equipment locations",
    "Coordinate details with builder",
    "Prepare information for electrical walkthrough",
    "Update client preference notes"
  ],
  "draftMessage": "Hi, I wanted to share a quick summary from the Deer Valley Residence notes. The main items captured include: Client wants warm architectural lighting, hidden speakers, simple controls, and keypad locations sent to the builder before Friday. Builder also needs confirmation on equipment locations before the electrical walkthrough. I will confirm the next steps and follow up with any needed details.",
  "createdAt": "2026-06-04T22:15:56.612411+00:00"
}
```

## Example Test Commands

Replace the API URL with the current API Gateway invoke URL before running.

### Submit a Project Note

```bash
curl -X POST "https://your-api-id.execute-api.us-west-2.amazonaws.com/project-notes" \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "Private Client",
    "projectName": "Deer Valley Residence",
    "noteType": "site_walkthrough_transcript",
    "source": "Plaud transcript",
    "projectNotes": "Client wants warm architectural lighting, hidden speakers, simple controls, and keypad locations sent to the builder before Friday. Builder also needs confirmation on equipment locations before the electrical walkthrough."
  }'
```

### Retrieve All Project Notes

```bash
curl -X GET "https://your-api-id.execute-api.us-west-2.amazonaws.com/project-notes"
```

### Retrieve One Project Note by ID

```bash
curl -X GET "https://your-api-id.execute-api.us-west-2.amazonaws.com/project-notes/{recordId}"
```

## Project Structure

```text
ai-luxury-design-project-assistant/
├── README.md
├── .gitignore
├── lambda/
│   └── lambda_function.py
├── sample-data/
│   └── sample-request.json
├── docs/
│   └── week-4-build-notes.md
└── screenshots/
    ├── api-gateway-route.png
    ├── api-gateway-integration.png
    ├── lambda-function.png
    ├── dynamodb-table-active.png
    ├── dynamodb-saved-item.png
    ├── cloudshell-api-test.png
    ├── get-project-notes-api-test.png
    └── get-project-note-by-id-api-test.png
```

## Data Model

The current DynamoDB table stores one item per submitted project note.

| Field        | Description                                                              |
| ------------ | ------------------------------------------------------------------------ |
| recordId     | Unique ID for each project note record                                   |
| clientName   | Client name or private client label                                      |
| projectName  | Name of the project or residence                                         |
| noteType     | Type of note, such as site walkthrough transcript or manual project note |
| source       | Source of the notes, such as Plaud transcript or manual entry            |
| projectNotes | Original submitted note text                                             |
| category     | Assigned project category                                                |
| priority     | Assigned priority level                                                  |
| keyPhrases   | Placeholder for future Amazon Comprehend key phrases                     |
| sentiment    | Placeholder for future Amazon Comprehend sentiment                       |
| summary      | Generated project summary                                                |
| nextSteps    | Generated next steps                                                     |
| draftMessage | Draft follow-up message                                                  |
| createdAt    | Timestamp for when the record was created                                |

## Category Logic

The current Lambda function uses keyword matching to assign project categories.

| Keywords                                            | Category                      |
| --------------------------------------------------- | ----------------------------- |
| lighting, keypad, dimmer, fixture                   | Lighting Design               |
| speaker, audio, video, TV, theater, rack            | A/V Integration               |
| shade, shades, window treatment                     | Shades                        |
| network, Wi-Fi, router, access point                | Networking                    |
| camera, surveillance, security, alarm               | Security                      |
| builder, electrician, vendor, deadline, walkthrough | Builder / Vendor Coordination |

## Priority Logic

The current Lambda function assigns priority using urgency and deadline language.

| Language Type                                                 | Priority |
| ------------------------------------------------------------- | -------- |
| urgent, today, tomorrow, before Friday, deadline, walkthrough | High     |
| follow up, confirm, review, needs, requested                  | Medium   |
| General notes without urgency language                        | Low      |

## Screenshots Included

The `screenshots/` folder includes evidence of the working backend build:

* API Gateway route showing `POST /project-notes`
* API Gateway Lambda integration
* Lambda function connected to API Gateway
* DynamoDB table showing `LuxuryDesignProjectNotes`
* DynamoDB saved item records
* CloudShell successful POST API test
* CloudShell successful GET all API test
* CloudShell successful GET by ID API test

## Planned Next Steps

* Add Amazon Comprehend for key phrase extraction
* Add Amazon Comprehend for sentiment detection
* Add Amazon Bedrock for AI-generated summaries, action items, and polished follow-up messages
* Add an optional frontend form for submitting project notes
* Add CORS configuration for frontend access
* Add basic API protection before sharing the endpoint publicly
* Expand documentation and demo screenshots for final project submission

## Future AI Integration

The planned AI-enhanced version will use Amazon Comprehend and Amazon Bedrock.

Amazon Comprehend will detect key phrases and sentiment from submitted project notes or walkthrough transcripts.

Amazon Bedrock will generate more polished project summaries, action items, and client, builder, or vendor follow-up messages.

## Long-Term Goal

The long-term goal is to create a professional project coordination assistant for luxury design and A/V teams. The assistant will help reduce missed details, improve communication, organize project information, and create a more consistent luxury client experience.
