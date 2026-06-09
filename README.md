# LuxNote AI

LuxNote AI is a cloud-based project intelligence assistant designed for luxury design, architectural lighting, AV integration, builder coordination, and client communication.

The application transforms raw meeting notes, site walkthrough transcripts, client preferences, deadlines, and coordination details into organized project records with summaries, priorities, next steps, and professional follow-up communication.

## Product Overview

Complex design projects generate information across client meetings, construction walkthroughs, builder requests, vendor updates, emails, and internal notes. Important details can become difficult to track when they are spread across multiple tools and long transcripts.

LuxNote AI provides a single workflow for capturing that information and turning it into structured project intelligence.

The application helps project teams:

* Capture project notes and transcripts
* Organize records by client and project
* Identify priorities and coordination requirements
* Generate concise project summaries
* Produce actionable next steps
* Draft professional follow-up communication
* Maintain a project history
* Create printable project reports
* Associate cover photography with project records

## Current Product Experience

LuxNote AI includes three connected frontend experiences:

| Page      | File                     | Purpose                                                |
| --------- | ------------------------ | ------------------------------------------------------ |
| Dashboard | `frontend/index.html`    | Captures new project notes and displays a quick result |
| Projects  | `frontend/projects.html` | Groups saved records into project folders              |
| Report    | `frontend/report.html`   | Displays a complete report for a selected record       |

### Dashboard

The dashboard provides:

* Client and project identification
* Note type and source selection
* Project note and transcript entry
* Optional project cover-photo upload
* File type and size validation
* Submission, loading, success, and error states
* AI-assisted project summary
* Priority identification
* Actionable next steps
* Copy controls
* Direct access to the full report

### Projects Library

The Projects page provides:

* Records grouped by project
* Project cover thumbnails
* Client and note counts
* Most recently updated project ordering
* Individual note types and categories
* Priority indicators
* Links to full project reports
* Loading, empty, success, retry, and image-fallback states

### Project Reports

The Report page provides:

* Project and client details
* Project category
* Priority
* Sentiment status
* Record creation date
* Project summary
* Next steps
* Key phrases
* Draft follow-up communication
* Original project notes
* Project cover photography
* Printable report formatting
* Missing-report and service-error states

## Design Direction

The interface uses a restrained light-luxury visual system designed to feel appropriate for high-end design and construction work.

The current design includes:

* Warm handmade-paper-inspired page backgrounds
* Raspberry, chocolate, sienna, and muted rose accents
* Editorial typography
* Soft neutral surfaces
* Responsive two-column dashboard layout
* Accessible focus states
* Reduced-motion support
* Mobile-responsive project and report pages

The active brand asset is:

```text
frontend/assets/luxnote-logo-transparent.png
```

## User Flow

1. Open the LuxNote AI dashboard.
2. Enter the client and project information.
3. Select the note type and source.
4. Paste project notes or a walkthrough transcript.
5. Optionally attach a project cover photo.
6. Submit the record for processing.
7. Review the generated Quick Result.
8. Open the complete project report.
9. Browse saved records from the Projects library.
10. Print or copy project information for further review.

## AWS Architecture

LuxNote AI uses a serverless AWS architecture.

| AWS Service        | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| Amazon API Gateway | Exposes the application API                      |
| AWS Lambda         | Processes API requests and project-note logic    |
| Amazon DynamoDB    | Stores project-note records and generated fields |
| Amazon S3          | Stores uploaded project cover images             |
| AWS IAM            | Controls access between AWS services             |
| AWS Amplify        | Hosts and deploys the frontend application       |

### Request Flow

```text
User
  ↓
LuxNote AI Frontend
  ↓
Amazon API Gateway
  ↓
AWS Lambda
  ↓
Amazon DynamoDB
```

### Cover-Photo Upload Flow

```text
User selects image
  ↓
Frontend requests upload information
  ↓
Amazon API Gateway
  ↓
AWS Lambda creates upload details
  ↓
Frontend uploads image to Amazon S3
  ↓
Image metadata is saved with the project record
```

## Application Architecture

```text
┌─────────────────────────────┐
│          User               │
│ Designer, PM, Coordinator   │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│     LuxNote AI Frontend     │
│ Dashboard, Projects, Report │
└──────────────┬──────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────┐
│     Amazon API Gateway      │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│         AWS Lambda          │
│ Processing and API logic    │
└──────────┬───────────┬──────┘
           │           │
           ▼           ▼
┌─────────────────┐  ┌─────────────────┐
│ Amazon DynamoDB │  │    Amazon S3    │
│ Project records │  │ Project images  │
└─────────────────┘  └─────────────────┘
```

## API

The frontend currently connects to:

```javascript
const API_BASE_URL =
  "https://mqg99s0svc.execute-api.us-west-2.amazonaws.com";
```

### Current Routes

```text
POST /project-notes
GET  /project-notes
GET  /project-notes/{recordId}
POST /project-cover-upload-url
```

### Route Responsibilities

| Route                            | Responsibility                                              |
| -------------------------------- | ----------------------------------------------------------- |
| `POST /project-notes`            | Creates and stores a project-note record                    |
| `GET /project-notes`             | Retrieves saved project-note records                        |
| `GET /project-notes/{recordId}`  | Retrieves one complete project record                       |
| `POST /project-cover-upload-url` | Provides the information required to upload a project image |

## Data Model

A project record can include:

```json
{
  "recordId": "791e1f89-fbc9-4ff8-ab14-9b9efc9a64c3",
  "clientName": "Private Client",
  "projectName": "Deer Valley Residence",
  "noteType": "site_walkthrough_transcript",
  "source": "Plaud transcript",
  "projectNotes": "Client wants warm architectural lighting, hidden speakers, simple controls, and keypad locations sent to the builder before Friday.",
  "category": "Lighting Design / A/V Integration / Builder / Vendor Coordination",
  "priority": "High",
  "keyPhrases": [],
  "sentiment": "Not analyzed yet",
  "summary": "The project notes include lighting, AV, and builder coordination requirements.",
  "nextSteps": [
    "Confirm keypad locations",
    "Confirm equipment locations",
    "Coordinate details with builder",
    "Prepare information for the electrical walkthrough",
    "Update client preference notes"
  ],
  "draftMessage": "A generated project follow-up message.",
  "coverPhotoUrl": "https://example-bucket.s3.amazonaws.com/project-cover.jpg",
  "coverPhotoKey": "projects/deer-valley-residence/project-cover.jpg",
  "coverPhotoName": "project-cover.jpg",
  "coverPhotoType": "image/jpeg",
  "createdAt": "2026-06-04T21:53:17.370633+00:00"
}
```

## Repository Structure

```text
ai-luxury-design-project-assistant/
├── frontend/
│   ├── assets/
│   │   └── luxnote-logo-transparent.png
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
│   └── design-experiments/
└── README.md
```

## Frontend Files

| File                              | Responsibility                                                         |
| --------------------------------- | ---------------------------------------------------------------------- |
| `frontend/index.html`             | Dashboard structure and project-note form                              |
| `frontend/app.js`                 | Validation, submission, image upload, quick results, and copy controls |
| `frontend/projects.html`          | Projects library structure                                             |
| `frontend/projects.js`            | Project retrieval, grouping, sorting, and display states               |
| `frontend/report.html`            | Full project-report structure                                          |
| `frontend/report.js`              | Individual record retrieval and report rendering                       |
| `frontend/styles.css`             | Shared foundation, forms, navigation, controls, and cards              |
| `frontend/pages.css`              | Dashboard, Projects, Report, responsive, and print layouts             |
| `frontend/cover-photo.css`        | Cover-photo picker, preview, and image presentation                    |
| `frontend/light-luxury-theme.css` | Warm luxury color system and visual treatment                          |

## Local Development

From the repository root:

```bash
cd frontend
python3 -m http.server 8000
```

In GitHub Codespaces:

1. Open the **Ports** panel.
2. Find port `8000`.
3. Open the forwarded URL in a browser.

### Local Routes

```text
/
```

```text
/projects.html
```

```text
/report.html?id=YOUR_RECORD_ID
```

Example:

```text
/report.html?id=791e1f89-fbc9-4ff8-ab14-9b9efc9a64c3
```

## Validation and Quality Checks

Check all frontend JavaScript files:

```bash
cd frontend
node --check app.js
node --check projects.js
node --check report.js
```

Check the repository for whitespace errors:

```bash
git diff --check
```

Review the current changes:

```bash
git status --short
git diff --stat
```

## Manual Test Checklist

Before deployment, verify:

* Required-field validation
* Character-count updates
* Valid project-note submission
* Loading and success messaging
* API error handling
* Quick Result rendering
* Summary and next-step copy controls
* Cover-photo type validation
* Cover-photo size validation
* Cover-photo preview
* S3 image upload
* Form clearing and reset behavior
* Projects loading state
* Projects empty state
* Projects retry state
* Project grouping and ordering
* Report loading with a valid record ID
* Missing-report state
* Invalid-record state
* Broken-image fallback
* Print layout
* Mobile responsiveness
* Keyboard focus visibility
* Browser console errors

## Current Limitations

* Authentication and user-specific project access are not yet implemented.
* Project search and filtering are not yet available.
* Sentiment and key-phrase fields may use fallback values when advanced AI analysis is unavailable.
* Reports are printable but do not yet generate a downloadable PDF file directly.
* The frontend currently stores the API endpoint in each page-specific JavaScript file.
* Uploaded media currently focuses on one project cover image rather than a complete attachment gallery.

## Roadmap

Potential future enhancements include:

* Amazon Cognito authentication
* Role-based access controls
* Project search and filtering
* Multiple image and document attachments
* Walkthrough photo galleries
* Amazon Bedrock-generated summaries and communication
* Amazon Comprehend key-phrase and sentiment analysis
* Exportable PDF reports
* Client-facing report templates
* Builder and vendor communication templates
* Task ownership and due dates
* Project status dashboards
* Shared API configuration
* Automated testing
* Additional accessibility testing

## Portfolio Focus

LuxNote AI demonstrates:

* Product-oriented frontend design
* Serverless AWS architecture
* REST API integration
* DynamoDB data persistence
* S3 media uploads
* Form validation
* Asynchronous application states
* Defensive rendering
* Responsive design
* Print styling
* Accessibility-focused interface decisions
* Git-based feature development and deployment workflow

## Disclaimer

AI-generated summaries, priorities, next steps, and draft messages should be reviewed by a qualified person before they are used for client, builder, vendor, electrical, construction, or design decisions.

LuxNote AI supports project coordination. It does not replace professional judgment.
