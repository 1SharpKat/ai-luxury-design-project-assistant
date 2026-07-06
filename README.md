# LuxNote AI

LuxNote AI is a private project-intelligence workspace for luxury design,
architectural lighting, A/V integration, builder coordination, and client
communication.

It turns raw project notes into structured records with summaries, priorities,
categories, key phrases, sentiment, next steps, draft follow-up communication,
and a saved project report.

## Live Application

[Launch LuxNote AI](https://www.luxnote.ai/)

Production posture:

- Sign-in required for project data.
- Frontend calls the authenticated `/private` API routes.
- Public demo mode is disabled.
- Public delete is disabled at the backend.
- External cover-photo URLs are disabled for production notes.
- AI processing defaults off for real project notes and must be enabled
  intentionally per note.
- AI-generated content requires human review before use in client, builder,
  vendor, electrical, construction, or design decisions.

## Core Workflow

1. Sign in to LuxNote AI.
2. Capture project notes from a walkthrough, meeting, email, vendor update, or
   manual entry.
3. Choose whether AI processing should run for that note.
4. Save the project record.
5. Review the structured summary, next steps, category, priority, key phrases,
   sentiment, draft follow-up message, and original notes.
6. Reopen saved records from the project library.

## Application Pages

| Page | File | Purpose |
| --- | --- | --- |
| Dashboard | `frontend/index.html` | Creates authenticated project records |
| Projects | `frontend/projects.html` | Groups saved records into project folders |
| Report | `frontend/report.html` | Displays a complete project report |
| Workspace alias | `frontend/workspace.html` | Compatibility route for the signed-in workspace |

## Production Configuration

The production frontend configuration lives in:

```text
frontend/config.js
```

Important settings:

```js
apiPathPrefix: "/private",
mode: "production",
authEnabled: true,
authRequired: true,
allowExternalCoverUrls: false,
allowDelete: true,
aiDefaultEnabled: false,
demoNotice: false
```

The legacy workspace aliases use:

```text
frontend/config-private.js
```

Those aliases remain private and production-mode so older links continue to
work.

## Backend API

Production frontend requests use these authenticated routes:

```text
POST   /private/project-notes
GET    /private/project-notes
GET    /private/project-notes/{recordId}
DELETE /private/project-notes/{recordId}
POST   /private/project-cover-upload-url
```

The Lambda defaults are production-safe:

```text
REQUIRE_AUTH=true
PRIVATE_PATH_PREFIX=/private
PRIVATE_COVER_PHOTOS=true
ALLOW_EXTERNAL_COVER_URLS=false
ALLOW_PUBLIC_DELETE=false
PRIVATE_AI_ENABLED=false
```

Set `PRIVATE_AI_ENABLED=true` only when production users are intentionally
allowed to send selected notes to Amazon Comprehend and Amazon Bedrock.

## Deployment

Frontend deployment is handled by AWS Amplify from the `main` branch.

Backend deployment requires updating the Lambda code and production
environment variables. The production checklist is available at:

```text
docs/production-deployment.md
```

## Tech Stack

- HTML, CSS, and JavaScript frontend
- AWS Amplify Hosting
- Amazon Cognito Hosted UI authentication
- Amazon API Gateway HTTP API
- AWS Lambda
- Amazon DynamoDB
- Amazon S3 for optional cover photos
- Amazon Comprehend and Amazon Bedrock for optional AI processing
- Amazon CloudWatch and IAM

## Safety Notes

- Do not commit AWS credentials, access keys, secrets, account numbers,
  pre-signed URLs, or real client data.
- Keep production user records behind Cognito-authenticated API routes.
- Review all AI-generated summaries, next steps, and draft messages before
  relying on them for real project decisions.
