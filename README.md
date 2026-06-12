# LuxNote AI

![AWS](https://img.shields.io/badge/AWS-Cloud-orange)
![Amplify](https://img.shields.io/badge/AWS%20Amplify-Frontend%20Hosting-orange)
![Lambda](https://img.shields.io/badge/AWS%20Lambda-Serverless-yellow)
![API Gateway](https://img.shields.io/badge/API%20Gateway-HTTP%20API-blue)
![DynamoDB](https://img.shields.io/badge/DynamoDB-NoSQL%20Database-blue)
![Comprehend](https://img.shields.io/badge/Amazon%20Comprehend-AI%2FML-purple)
![Bedrock](https://img.shields.io/badge/Amazon%20Bedrock-Generative%20AI-purple)
![Python](https://img.shields.io/badge/Python-Backend-blue)
![JavaScript](https://img.shields.io/badge/JavaScript-Frontend-yellow)

A cloud-based project intelligence assistant for luxury design, architectural lighting, A/V integration, builder coordination, and client communication.

LuxNote AI turns raw project notes into organized project records with summaries, priorities, next steps, key phrases, sentiment, and draft follow-up communication. It was built as a final AWS course project to demonstrate cloud infrastructure, serverless API development, database integration, AI/ML services, and generative AI using Amazon Bedrock.

## Live Application

[Launch LuxNote AI](https://luxnote.ai)

* Final working branch: `light-luxury-redesign`
* Production hosting: AWS Amplify
* Demo data: fictional project records only

---

## Features

* Project note intake form
* Trusted advisor dashboard experience
* Professional light luxury interface with restrained card styling
* AI-generated project summaries
* Priority and category assignment
* Key phrase extraction
* Sentiment analysis
* Draft follow-up message generation
* Saved project records
* Project library view
* Printable project report page
* Optional project cover-photo workflow
* Optional private workspace mode with Cognito-ready authentication hooks
* Optional AI-off note tracking mode for real client workflows
* Serverless backend using AWS Lambda and API Gateway
* DynamoDB storage for processed project records

---

## Frontend Experience

The final frontend was redesigned to feel like a calm, trusted advisor tool for luxury design project work. The dashboard uses an editorial masthead, a soft office-inspired palette, restrained card styling, and a subtle brand decal treatment to avoid a generic SaaS-template feel while keeping the workflow clean and professional.

The visual direction emphasizes matte cedar, linen, olive, and soft mauve tones, with flatter cards, reduced hover effects, tailored controls, and clearer hierarchy for project intake and quick review.

---

## Tech Stack

### Frontend

* HTML
* CSS
* JavaScript
* AWS Amplify Hosting

### Backend

* Python
* AWS Lambda
* Amazon API Gateway

### Database and Storage

* Amazon DynamoDB
* Amazon S3 for optional project cover photos

### AI and Machine Learning

* Amazon Comprehend for key phrase extraction and sentiment analysis
* Amazon Bedrock for summaries, next steps, and draft follow-up messages

### Monitoring and Security

* Amazon CloudWatch
* AWS IAM
* CORS configuration
* Environment variables for service configuration

---

## Project Overview

Luxury design and integration projects create a lot of scattered information. Client preferences, builder updates, site walkthrough notes, lighting details, A/V decisions, vendor coordination, and deadlines can end up spread across conversations and documents.

LuxNote AI was designed to help organize that information.

A user can enter a client name, project name, note type, source, and project notes. The app processes the notes and returns a structured project record with:

* Project category
* Priority level
* Key phrases
* Sentiment
* Professional summary
* Next steps
* Draft follow-up message
* Original notes
* Created timestamp

The goal is not to replace human review. The goal is to give a designer or project manager a cleaner starting point so important details are easier to find and follow up on.

---

## Core User Flow

1. The user opens the LuxNote AI dashboard.
2. The user enters fictional project details and project notes.
3. The frontend sends the request to Amazon API Gateway.
4. API Gateway invokes AWS Lambda.
5. Lambda validates and processes the request.
6. Amazon Comprehend extracts key phrases and sentiment.
7. Amazon Bedrock generates a summary, next steps, and draft communication.
8. Amazon DynamoDB stores the completed project record.
9. The frontend displays a quick result, project library, and printable report.

---

## Application Pages

| Page      | File                     | Purpose                                             |
| --------- | ------------------------ | --------------------------------------------------- |
| Dashboard | `frontend/index.html`    | Creates project records and displays a quick result |
| Projects  | `frontend/projects.html` | Groups saved records into project folders           |
| Report    | `frontend/report.html`   | Displays a complete project report                  |

---

## AWS Architecture

| AWS Service        | Purpose                                                |
| ------------------ | ------------------------------------------------------ |
| AWS Amplify        | Hosts and deploys the frontend                         |
| Amazon API Gateway | Exposes the serverless HTTP API                        |
| AWS Lambda         | Handles routing, validation, AI calls, and persistence |
| Amazon DynamoDB    | Stores project records and generated fields            |
| Amazon Comprehend  | Extracts key phrases and sentiment                     |
| Amazon Bedrock     | Generates summaries, next steps, and draft messages    |
| Amazon CloudWatch  | Stores Lambda logs and processing status               |
| AWS IAM            | Controls service-to-service permissions                |
| Amazon S3          | Optionally stores project cover photos                 |

The final architecture diagram is available at:

```text
final-submission/architecture/luxnote-ai-architecture.png
```

---

## API Routes

```text
POST /project-notes
GET  /project-notes
GET  /project-notes/{recordId}
POST /project-cover-upload-url
```

The S3 cover-photo route is optional and is not required for the core demonstration.

Private workspace setup notes are available at:

```text
docs/private-workspace-setup.md
```

---

## AI Workflow

### Amazon Comprehend

Amazon Comprehend is used for the AI/ML portion of the project. It analyzes project notes and returns:

* Key phrases
* Sentiment
* Sentiment confidence scores
* Analysis status

This helps identify important terms related to lighting, speakers, keypads, equipment locations, deadlines, builder needs, and vendor coordination.

### Amazon Bedrock

Amazon Bedrock is used for the generative AI portion of the project. It generates:

* A concise professional summary
* Specific next steps
* A draft follow-up message

The Bedrock prompt is written to keep the output grounded in the original notes. It instructs the model not to invent dates, approvals, specifications, or commitments that were not included in the project notes.

AI-generated content should always be reviewed by a person before being used for client, builder, vendor, electrical, construction, or design decisions.

---

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

---

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

---

## Project Goals

This project was designed to demonstrate:

* AWS cloud infrastructure setup
* Serverless API development
* Lambda backend processing
* API Gateway integration
* DynamoDB database integration
* AI/ML integration with Amazon Comprehend
* Generative AI integration with Amazon Bedrock
* Practical business workflow design
* Frontend presentation and user experience
* GitHub project organization
* Final documentation and demo preparation

---

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

---

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

---

## Final Submission Materials

The `final-submission` folder contains:

* AWS architecture source files and rendered PNG
* AWS implementation evidence screenshots
* Presentation folder
* Demo-video notes and final link placeholder
* Supporting documentation folder

The final course submission includes:

* Final presentation, 8 to 10 slides
* Architecture diagram
* Source code and GitHub repository
* Demo video, 3 to 5 minutes
* Documentation and README

---

## Current Limitations

* Authentication and user-specific access are not yet implemented.
* The frontend uses a public API endpoint for the course demonstration.
* Raw audio ingestion is not implemented.
* Floor-plan and design-image analysis are not implemented.
* Generated messages are not sent automatically.
* Reports are printable but do not generate a downloadable PDF directly.
* Optional S3 cover-photo support requires separate AWS configuration.

---

## Future Improvements

* Add authentication and user-specific project access
* Add Plaud or meeting-recorder transcript ingestion
* Add project media and cover-photo library
* Add floor-plan or marked-up drawing analysis
* Add downloadable PDF reports
* Add role-based access for designers, project managers, and admins
* Add client-ready communication approval workflow
* Add stronger analytics across projects and categories

---

## Challenges and Learnings

One of the biggest challenges in this project was connecting several AWS services into one working flow. The application needed a frontend, an API layer, backend processing, database storage, AI analysis, generative AI output, and documentation that clearly explained the system.

I also had to balance the project as both a course requirement and a realistic business idea. The final result is an MVP, but it demonstrates how AWS serverless services and AI tools can support a real design-project workflow.

This project helped me better understand API Gateway, Lambda routing, DynamoDB records, IAM permissions, CloudWatch logs, Amazon Comprehend, Amazon Bedrock, and the importance of keeping AI output grounded in the original data.

---

## Privacy Notice

All demonstration records are fictional. Submission materials must not contain AWS account numbers, credentials, secrets, environment-variable values, pre-signed URLs, or real client information.

---

## Author

Kathryn “Kat” Sharp
