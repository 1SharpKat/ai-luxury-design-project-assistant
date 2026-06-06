# AI Luxury Design Project Assistant

A serverless AWS application for organizing luxury design project notes, walkthrough transcripts, action items, and professional follow-up communication.

## Overview

The AI Luxury Design Project Assistant is designed for luxury design, lighting, automation, and A/V integration teams that need a more reliable way to organize project information.

Important project details may come from client meetings, site walkthroughs, builder conversations, lighting reviews, vendor updates, email notes, or exported transcripts from tools such as Plaud. This application accepts raw project notes, analyzes the content, generates structured project information, saves the completed record, and makes saved records available through API endpoints.

The current version is a working AI-enhanced backend built with AWS serverless services.

## Project Goals

The application is intended to help project teams:

* Reduce missed details from walkthroughs and client meetings
* Organize client preferences and technical requirements
* Identify important project topics and priorities
* Generate clear action items
* Improve builder, vendor, and client communication
* Maintain structured project records
* Create a more consistent project coordination workflow

## Current Build Status

The backend MVP is working.

The application can:

* Create project note records
* Analyze notes with Amazon Comprehend
* Generate project content with Anthropic Claude through Amazon Bedrock
* Save completed records in Amazon DynamoDB
* Retrieve all saved project notes
* Retrieve one project note by `recordId`
* Return structured JSON responses through Amazon API Gateway

## Current Architecture

```text
User or Project Coordinator
            ↓
Amazon API Gateway
            ↓
AWS Lambda
        ↙       ↘
Amazon         Amazon
Comprehend     Bedrock
        ↘       ↙
     Structured Project Record
            ↓
     Amazon DynamoDB
            ↓
     JSON API Response
```

## AWS Services Used

| AWS Service        | Purpose                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| Amazon API Gateway | Provides HTTP endpoints for creating and retrieving project notes      |
| AWS Lambda         | Runs backend logic and coordinates AWS service calls                   |
| Amazon DynamoDB    | Stores structured project note records                                 |
| Amazon Comprehend  | Extracts key phrases and analyzes sentiment                            |
| Amazon Bedrock     | Generates summaries, action items, and professional follow-up messages |
| AWS IAM            | Controls permissions between Lambda and AWS services                   |
| Amazon CloudWatch  | Stores Lambda execution logs for monitoring and troubleshooting        |

## AI Services

### Amazon Comprehend

Amazon Comprehend analyzes the submitted project notes and returns:

* Key phrases
* Overall sentiment
* Sentiment confidence scores
* Analysis status

Example fields:

```json
{
  "keyPhrases": [
    "warm architectural lighting",
    "hidden speakers",
    "keypad locations",
    "equipment locations"
  ],
  "sentiment": "NEUTRAL",
  "analysisStatus": "COMPLETED"
}
```

### Amazon Bedrock

Amazon Bedrock uses an Anthropic Claude model to generate:

* A concise professional summary
* Specific next steps
* A polished draft message for the most relevant recipient

The model ID is stored in the Lambda environment variable:

```text
BEDROCK_MODEL_ID
```

The actual model identifier is not hard-coded into the repository.

## Current API Routes

```text
POST /project-notes
GET /project-notes
GET /project-notes/{recordId}
```

## Route Details

### Create a Project Note

```text
POST /project-notes
```

This route:

1. Accepts project note data
2. Assigns a project category
3. Assigns a priority level
4. Calls Amazon Comprehend
5. Calls Amazon Bedrock
6. Creates a structured project record
7. Saves the record in DynamoDB
8. Returns the completed record

### Retrieve All Project Notes

```text
GET /project-notes
```

This route returns all saved project note records from DynamoDB.

### Retrieve One Project Note

```text
GET /project-notes/{recordId}
```

This route returns one saved project note using its unique `recordId`.

## Current AWS Resources

| Resource Type          | Resource Name                     |
| ---------------------- | --------------------------------- |
| API Gateway API        | `LuxuryDesignProjectNotesAPI`     |
| Lambda Function        | `luxury-design-project-notes-api` |
| DynamoDB Table         | `LuxuryDesignProjectNotes`        |
| DynamoDB Partition Key | `recordId`                        |
| AWS Region             | `us-west-2`                       |

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
  "recordId": "d4bf2b2d-f469-4210-ba47-449456609203",
  "clientName": "Private Client",
  "projectName": "Deer Valley Residence",
  "noteType": "site_walkthrough_transcript",
  "source": "Plaud transcript",
  "projectNotes": "Client wants warm architectural lighting, hidden speakers, simple controls, and keypad locations sent to the builder before Friday. Builder also needs confirmation on equipment locations before the electrical walkthrough.",
  "category": "Lighting Design / A/V Integration / Builder / Vendor Coordination",
  "priority": "High",
  "keyPhrases": [
    "Client",
    "warm architectural lighting",
    "hidden speakers",
    "simple controls",
    "keypad locations",
    "the builder",
    "Friday",
    "Builder",
    "confirmation",
    "equipment locations"
  ],
  "sentiment": "NEUTRAL",
  "sentimentScores": {
    "Positive": 0.04282212629914284,
    "Negative": 0.008758566342294216,
    "Neutral": 0.9442222118377686,
    "Mixed": 0.00419708713889122
  },
  "analysisStatus": "COMPLETED",
  "summary": "The Deer Valley Residence project requires prompt coordination with the builder ahead of an upcoming electrical walkthrough. The client has requested warm architectural lighting, hidden speakers, and simple control interfaces. Critical deliverables include keypad location drawings and equipment location confirmation, both needed by the builder before Friday.",
  "nextSteps": [
    "Finalize keypad locations and prepare documentation to send to the builder before Friday",
    "Confirm all equipment locations and compile them into a builder-ready format",
    "Review the client's control simplicity requirements",
    "Coordinate lighting selections with the control system and dimming requirements",
    "Confirm the electrical walkthrough schedule",
    "Identify hidden speaker rough-in requirements"
  ],
  "draftMessage": "Hi [Builder Name],\n\nI wanted to reach out regarding the Deer Valley Residence ahead of the upcoming electrical walkthrough. We are finalizing our lighting control and A/V integration drawings and want to ensure you have everything you need before Friday.\n\nWe will be sending over keypad location drawings as well as equipment location information for your team's reference.\n\nBest regards,\n[Your Name]",
  "generationStatus": "COMPLETED",
  "createdAt": "2026-06-06T17:07:30.101529+00:00"
}
```

## Example API Test Commands

Replace the example API URL with the active API Gateway invoke URL.

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

### Retrieve One Project Note

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
    ├── get-project-note-by-id-api-test.png
    ├── comprehend-analysis-success.png
    ├── bedrock-direct-test-success.png
    ├── bedrock-lambda-test-success.png
    └── bedrock-api-test-success.png
```

## DynamoDB Data Model

Each DynamoDB item represents one submitted project note.

| Field              | Description                               |
| ------------------ | ----------------------------------------- |
| `recordId`         | Unique ID for the project note            |
| `clientName`       | Client name or privacy-safe client label  |
| `projectName`      | Project or residence name                 |
| `noteType`         | Type of note or transcript                |
| `source`           | Origin of the submitted notes             |
| `projectNotes`     | Original project note text                |
| `category`         | Rule-based project category               |
| `priority`         | Rule-based priority level                 |
| `keyPhrases`       | Key phrases returned by Amazon Comprehend |
| `sentiment`        | Sentiment returned by Amazon Comprehend   |
| `sentimentScores`  | Sentiment confidence scores               |
| `analysisStatus`   | Comprehend processing status              |
| `summary`          | Bedrock-generated project summary         |
| `nextSteps`        | Bedrock-generated action items            |
| `draftMessage`     | Bedrock-generated follow-up message       |
| `generationStatus` | Bedrock processing status                 |
| `createdAt`        | UTC creation timestamp                    |

## Category Logic

The Lambda function assigns one or more categories before the AI generation step.

| Keywords                                            | Category                      |
| --------------------------------------------------- | ----------------------------- |
| lighting, keypad, dimmer, fixture                   | Lighting Design               |
| speaker, audio, video, TV, theater, rack            | A/V Integration               |
| shade, shades, window treatment                     | Shades                        |
| network, Wi-Fi, router, access point                | Networking                    |
| camera, surveillance, security, alarm               | Security                      |
| builder, electrician, vendor, deadline, walkthrough | Builder / Vendor Coordination |

## Priority Logic

| Language Type                                                       | Priority |
| ------------------------------------------------------------------- | -------- |
| urgent, ASAP, today, tomorrow, before Friday, deadline, walkthrough | High     |
| follow up, confirm, review, needs, requested                        | Medium   |
| General notes without urgency language                              | Low      |

## Error Handling

The Lambda function includes fallbacks so optional AI services do not prevent the project note from being saved.

### Comprehend Fallback

If Amazon Comprehend is unavailable, the record can still be created with:

```json
{
  "keyPhrases": [],
  "sentiment": "UNKNOWN",
  "analysisStatus": "COMPREHEND_UNAVAILABLE"
}
```

### Bedrock Fallback

If Amazon Bedrock is unavailable, the application uses rule-based summary, action-item, and draft-message logic.

Possible generation statuses include:

```text
COMPLETED
BEDROCK_NOT_CONFIGURED
BEDROCK_UNAVAILABLE
BEDROCK_ERROR
```

## Environment Variables

The Lambda function uses these environment variables:

| Variable           | Purpose                                |
| ------------------ | -------------------------------------- |
| `TABLE_NAME`       | DynamoDB table name                    |
| `BEDROCK_MODEL_ID` | Bedrock model or inference-profile ID  |
| `AWS_REGION`       | AWS region used by the Lambda function |

Do not commit AWS credentials, access keys, secret keys, or private account configuration to GitHub.

## IAM Permissions

The Lambda execution role requires permission to:

* Write items to DynamoDB
* Read items from DynamoDB
* Scan the DynamoDB table
* Call Amazon Comprehend sentiment detection
* Call Amazon Comprehend key phrase detection
* Invoke the configured Amazon Bedrock model
* Write logs to CloudWatch

## Screenshots Included

The `screenshots/` folder contains evidence of the working build.

### Backend Infrastructure

* API Gateway route
* API Gateway Lambda integration
* Lambda function
* DynamoDB table
* DynamoDB saved record

### API Testing

* Successful POST request
* Successful GET all request
* Successful GET by ID request

### AI Integration

* Successful Amazon Comprehend analysis
* Successful direct Bedrock model test
* Successful Bedrock Lambda test
* Successful full Bedrock API test

## Security and Privacy

The project currently uses anonymized sample information.

Recommended production improvements include:

* Add authentication and authorization
* Protect the public API endpoint
* Restrict CORS to approved frontend domains
* Use least-privilege IAM resource policies
* Avoid storing unnecessary client-sensitive information
* Encrypt sensitive data
* Add input validation and request-size limits
* Add structured audit logging
* Add data retention policies

Generated content should be reviewed by a human before it is sent to a client, builder, vendor, or project partner.

## Planned Next Steps

* Build a frontend form for submitting project notes
* Display saved projects and AI-generated results
* Add CORS configuration for the frontend domain
* Add API authentication
* Add client and project search
* Add filtering by category and priority
* Add project note editing
* Add delete or archive functionality
* Support image uploads such as plans, site photos, and markups
* Add S3 storage for uploaded files
* Add multimodal analysis for plans and project images
* Add optional design-image generation or markup workflows
* Add exportable project summaries
* Add user review and approval before messages are sent
* Add automated tests and deployment infrastructure

## Current Limitations

The current version:

* Uses a public HTTP API during development
* Does not yet include a frontend
* Does not yet include authentication
* Accepts text project notes only
* Does not yet process raw audio directly
* Does not yet process floor plans or site images through the API
* Does not automatically send generated messages
* Requires human review of all generated content

## Long-Term Vision

The long-term goal is to create a professional AI-assisted project coordination platform for luxury design, lighting, automation, and A/V integration teams.

The completed platform may support:

* Project note and transcript analysis
* Floor plan and image review
* Client preference tracking
* Technical coordination
* Builder and vendor communication
* Action-item management
* AI-generated summaries and follow-up drafts
* Project history and searchable records
* Human-reviewed design recommendations
* More consistent project delivery and client communication

## Responsible Use

This application is intended to support project professionals, not replace them.

AI-generated summaries, action items, recommendations, and messages should be reviewed for accuracy before being used. Technical, electrical, construction, and design decisions should remain under the supervision of qualified professionals.
