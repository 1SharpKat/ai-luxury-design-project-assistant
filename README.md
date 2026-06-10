# LuxNote AI

LuxNote AI is a cloud-based project intelligence assistant for luxury design, architectural lighting, A/V integration, builder coordination, and client communication.

The application turns raw meeting notes, site-walkthrough transcripts, client preferences, deadlines, and coordination details into organized project records with summaries, priorities, next steps, key phrases, sentiment, and draft follow-up communication.

## Live Application

- Production site: `https://luxnote.ai`
- Final working branch: `light-luxury-redesign`
- Production hosting: AWS Amplify

## Core User Flow

1. Enter a fictional client name, project name, note type, source, and project notes.
2. Optionally select one JPG or PNG project cover photo.
3. Submit the record through Amazon API Gateway.
4. AWS Lambda validates and processes the request.
5. Amazon Comprehend extracts key phrases and sentiment.
6. Amazon Bedrock generates a summary, next steps, and draft communication.
7. Amazon DynamoDB stores the completed project record.
8. The frontend displays a quick result, project library, and printable report.

## Application Pages

| Page | File | Purpose |
| --- | --- | --- |
| Dashboard | `frontend/index.html` | Creates project records and displays a quick result |
| Projects | `frontend/projects.html` | Groups saved records into project folders |
| Report | `frontend/report.html` | Displays a complete project report |

## AWS Architecture

| AWS service | Purpose |
| --- | --- |
| AWS Amplify | Hosts and deploys the frontend |
| Amazon API Gateway | Exposes the serverless HTTP API |
| AWS Lambda | Handles routing, validation, AI calls, and persistence |
| Amazon DynamoDB | Stores project records and generated fields |
| Amazon Comprehend | Extracts key phrases and sentiment |
| Amazon Bedrock | Generates summaries, next steps, and draft messages |
| Amazon CloudWatch | Stores Lambda logs and processing status |
| AWS IAM | Controls service-to-service permissions |
| Amazon S3 | Optionally stores project cover photos |

The final architecture diagram is available at:

```text
final-submission/architecture/luxnote-ai-architecture.png
```

## API Routes

```text
POST /project-notes
GET  /project-notes
GET  /project-notes/{recordId}
POST /project-cover-upload-url
```

The S3 cover-photo route is optional and is not required for the core demonstration.

## AI Processing

### Amazon Comprehend

The Lambda function calls Amazon Comprehend to return:

- Key phrases
- Sentiment
- Sentiment confidence scores
- Analysis status

### Amazon Bedrock

The Lambda function calls Amazon Bedrock to generate:

- A concise professional summary
- Specific next steps
- A draft follow-up message
- Generation status

If either AI service is unavailable, the Lambda uses safe fallback behavior so the core project record can still be saved.

## Repository Structure

```text
ai-luxury-design-project-assistant/
├── frontend/
│   ├── assets/
│   │   ├── luxnote-logo-transparent.png
│   │   └── luxnote-logo-vector.svg
│   ├── index.html
│   ├── projects.html
│   ├── report.html
│   ├── app.js
│   ├── projects.js
│   ├── report.js
│   ├── styles.css
│   ├── pages.css
│   ├── cover-photo.css
│   └── light-luxury-theme.css
├── lambda/
│   └── lambda_function.py
├── docs/
│   ├── project-cover-photo-setup.md
│   └── week-4-build-notes.md
├── sample-data/
│   ├── README.md
│   ├── demo-records.json
│   └── lambda-test-event.json
├── final-submission/
│   ├── architecture/
│   ├── aws-evidence/
│   ├── demo-video/
│   ├── documentation/
│   └── presentation/
├── .gitignore
└── README.md
```

## Data Model

A stored project record can include:

```json
{
  "recordId": "generated UUID",
  "clientName": "Fictional Client A",
  "projectName": "Alder Ridge Residence",
  "noteType": "site_walkthrough_transcript",
  "source": "fictional demo transcript",
  "projectNotes": "Fictional project notes",
  "category": "Lighting Design / A/V Integration / Builder / Vendor Coordination",
  "priority": "High",
  "keyPhrases": ["architectural lighting", "hidden speakers"],
  "sentiment": "NEUTRAL",
  "sentimentScores": {},
  "analysisStatus": "COMPLETED",
  "summary": "Generated project summary",
  "nextSteps": ["Generated action item"],
  "draftMessage": "Generated follow-up message",
  "generationStatus": "COMPLETED",
  "createdAt": "UTC timestamp"
}
```

Optional cover-photo metadata may also be stored when S3 support is configured.

## Local Frontend Testing

From the repository root:

```bash
cd frontend
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Validation Checks

Run JavaScript syntax checks:

```bash
cd frontend
node --check app.js
node --check projects.js
node --check report.js
```

Run Python syntax validation:

```bash
python3 -m py_compile lambda/lambda_function.py
```

Review repository changes:

```bash
git status --short
git diff --check
git diff --stat
```

## Current Limitations

- Authentication and user-specific access are not yet implemented.
- The frontend uses a public API endpoint for the course demonstration.
- Raw audio ingestion is not implemented.
- Floor-plan and design-image analysis are not implemented.
- Generated messages are not sent automatically.
- Reports are printable but do not generate a downloadable PDF directly.
- Optional S3 cover-photo support requires separate AWS configuration.

## Final Submission Materials

The `final-submission` folder contains:

- AWS architecture source files and rendered PNG
- AWS implementation evidence screenshots
- Presentation folder
- Demo-video notes and final link placeholder
- Supporting documentation folder

All included demonstration data is fictional. Submission materials must not expose AWS account numbers, credentials, secrets, environment-variable values, presigned URLs, or real client information.

## Human Review Notice

AI-generated summaries, priorities, next steps, and draft messages must be reviewed by a qualified person before they are used for client, builder, vendor, electrical, construction, or design decisions.
