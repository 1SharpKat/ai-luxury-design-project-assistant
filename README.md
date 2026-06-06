# AI Luxury Design Project Assistant

A serverless AWS application for organizing luxury design project notes, walkthrough transcripts, action items, and professional follow-up communication.

## Overview

The AI Luxury Design Project Assistant is designed for luxury design, lighting, automation, and A/V integration teams that need a more reliable way to organize project information.

Important project details may come from client meetings, site walkthroughs, builder conversations, lighting reviews, vendor updates, email notes, or exported Plaud transcripts. This application accepts raw project notes, analyzes the content, generates structured project information, stores the completed record, and displays saved records through a browser-based frontend.

The current version is a working end-to-end MVP built with AWS serverless services and a responsive HTML, CSS, and JavaScript interface.

## Project Goals

The application is intended to help project teams:

* Reduce missed details from walkthroughs and client meetings
* Organize client preferences and technical requirements
* Identify important project topics and priorities
* Generate clear action items
* Improve builder, vendor, and client communication
* Maintain structured project records
* Create a more consistent project coordination workflow
* Provide a browser interface for project-note submission and review

## Current Build Status

The application now has a working end-to-end MVP.

The current version includes:

* A serverless AWS backend
* Three working API routes
* DynamoDB project-note storage
* Amazon Comprehend sentiment and key-phrase analysis
* Amazon Bedrock summaries, action items, and draft messages
* A responsive browser-based frontend
* A project-note submission form
* AI-generated result displays
* A saved project history section
* Individual record retrieval
* Copy buttons for generated summaries, action items, and messages
* Browser-to-API integration through API Gateway CORS
* CloudWatch logging
* IAM permissions
* Error handling and AI-service fallbacks
* GitHub source control and documentation

The frontend currently runs through a local development server in GitHub Codespaces. AWS Amplify deployment is the next hosting milestone.

## Current Architecture

```text
User
  ↓
HTML / CSS / JavaScript Frontend
  ↓
Amazon API Gateway
  ↓
AWS Lambda
  ├── Amazon Comprehend
  └── Amazon Bedrock
  ↓
Amazon DynamoDB
  ↓
Structured Results Returned to Frontend
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

## Frontend Technologies

The frontend is built with:

* HTML
* CSS
* JavaScript

The interface allows users to:

* Enter a client name
* Enter a project name
* Select a note type
* Select the source of the notes
* Paste project notes or transcript text
* Submit notes for AI analysis
* View the generated summary
* View key phrases and sentiment
* View generated next steps
* View a draft follow-up message
* Copy generated content
* Load previously saved project notes
* Retrieve and display individual project records

The frontend files are stored in:

```text
frontend/
├── index.html
├── styles.css
└── app.js
```

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
2. Validates the request
3. Assigns a project category
4. Assigns a priority level
5. Calls Amazon Comprehend
6. Extracts key phrases
7. Detects sentiment
8. Calls Amazon Bedrock
9. Generates a professional summary
10. Generates specific next steps
11. Generates a polished follow-up message
12. Saves the completed record in DynamoDB
13. Returns the completed record as JSON

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

## Amazon Comprehend Integration

Amazon Comprehend analyzes submitted project notes and returns:

* Key phrases
* Overall sentiment
* Sentiment confidence scores
* Analysis status

Example:

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

## Amazon Bedrock Integration

Amazon Bedrock uses an Anthropic Claude model to generate:

* A concise professional summary
* Specific next steps
* A polished follow-up message for the most relevant recipient

The model identifier is stored in the Lambda environment variable:

```text
BEDROCK_MODEL_ID
```

The actual model identifier is not hard-coded into the repository.

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

## Browser Integration

The frontend connects to API Gateway using JavaScript `fetch()` requests.

Browser access required CORS configuration in Amazon API Gateway.

The current development CORS settings allow:

```text
Origins: *
Methods: GET, POST, OPTIONS
Headers: Content-Type
Credentials: Off
```

The wildcard origin is suitable for development. It should be replaced with the hosted frontend domain before production use.

## Local Frontend Testing

From the repository root:

```bash
cd frontend
python3 -m http.server 8000
```

Then open port `8000` through the GitHub Codespaces Ports tab.

The frontend automatically loads saved project notes through:

```text
GET /project-notes
```

The form submits project notes through:

```text
POST /project-notes
```

Individual records are retrieved through:

```text
GET /project-notes/{recordId}
```

## Project Structure

```text
ai-luxury-design-project-assistant/
├── README.md
├── .gitignore
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
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
    ├── comprehend-analysis-success.png
    ├── bedrock-direct-test-success.png
    ├── bedrock-lambda-test-success.png
    ├── bedrock-api-test-success.png
    ├── frontend-form.png
    ├── frontend-saved-project-notes.png
    └── frontend-ai-results.png
```

## DynamoDB Data Model

## DynamoDB Data Model

Each DynamoDB item represents one submitted project note.

| Field              | Description                                |
| ------------------ | ------------------------------------------ |
| `recordId`         | Unique identifier for the project note     |
| `clientName`       | Client name or privacy-safe client label   |
| `projectName`      | Project or residence name                  |
| `noteType`         | Type of note or transcript                 |
| `source`           | Source of the submitted notes              |
| `projectNotes`     | Original project note text                 |
| `category`         | Rule-based project category                |
| `priority`         | Rule-based priority level                  |
| `keyPhrases`       | Key phrases returned by Amazon Comprehend  |
| `sentiment`        | Sentiment returned by Amazon Comprehend    |
| `sentimentScores`  | Sentiment confidence scores                |
| `analysisStatus`   | Amazon Comprehend processing status        |
| `summary`          | Amazon Bedrock-generated project summary   |
| `nextSteps`        | Amazon Bedrock-generated action items      |
| `draftMessage`     | Amazon Bedrock-generated follow-up message |
| `generationStatus` | Amazon Bedrock processing status           |
| `createdAt`        | UTC creation timestamp                     |


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

### Frontend Integration

* Frontend project-note form
* Saved project-note history
* AI-generated browser results

## Security and Privacy

The project currently uses anonymized sample information.

Recommended production improvements include:

* Add authentication and authorization
* Protect the public API endpoint
* Restrict CORS to the hosted frontend domain
* Use least-privilege IAM resource policies
* Avoid storing unnecessary client-sensitive information
* Encrypt sensitive data
* Add input validation and request-size limits
* Add structured audit logging
* Add data retention policies

Generated content should be reviewed by a human before it is sent to a client, builder, vendor, or project partner.

## Current Limitations

The current version:

* Runs the frontend through a local development server
* Is not yet hosted on a permanent public domain
* Does not include user authentication
* Uses a public API endpoint during development
* Allows all browser origins through development CORS settings
* Accepts text input only
* Does not yet accept raw audio
* Does not yet accept plans, photos, or design-image uploads
* Does not automatically send generated messages
* Requires human review of AI-generated content

## Planned Next Steps

* Deploy the frontend with AWS Amplify Hosting
* Add the live frontend URL to the repository
* Restrict CORS to the hosted Amplify domain
* Add Amazon Cognito authentication
* Add Amazon S3 file storage
* Add floor-plan, design-image, and site-photo uploads
* Add multimodal document and image analysis
* Add project search and filtering
* Add editing and archive functionality
* Improve loading, error, and empty states
* Complete final project testing
* Prepare the final demonstration and submission materials

## Long-Term Vision

The long-term goal is to create a professional AI-assisted project coordination platform for luxury design, lighting, automation, and A/V integration teams.

The completed platform may support:

* Project note and transcript analysis
* Floor-plan and image review
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

