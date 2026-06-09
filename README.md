# LuxNote AI

LuxNote AI is a cloud-based project note assistant for luxury design, AV integration, lighting design, builder coordination, and client communication.

The application helps capture project notes, walkthrough details, meeting notes, client preferences, and coordination items. It then organizes the information into project records, quick summaries, next steps, and full project reports.

## Project Purpose

Luxury design and AV projects create large amounts of scattered information across walkthroughs, client meetings, builder requests, vendor updates, and internal notes. Important details can be missed, delayed, or buried in long transcripts.

LuxNote AI is designed to turn raw project notes into organized project intelligence.

The goal is to help design and project teams:

* Capture project information quickly
* Organize notes by client and project
* Identify priority items and next steps
* Generate clear project summaries
* Create follow-up communication
* Maintain a searchable project history
* Build full project reports from saved records

## Current Build Status

LuxNote AI now includes a working frontend dashboard, a dedicated Projects page, and a full Report page.

### Completed Frontend Features

* Luxury-style dark dashboard interface
* LuxNote AI branded hero section
* Lighting-design blueprint wallpaper
* Project note submission form
* Quick Result panel on the main dashboard
* Dedicated Projects page for saved project records
* Dedicated Report page for full project intelligence
* Navigation between Dashboard, Projects, and Reports
* Saved project notes grouped into project folders
* Full report view for individual saved notes
* Responsive page styling for different screen sizes

### Current Application Pages

| Page      | File                     | Purpose                                              |
| --------- | ------------------------ | ---------------------------------------------------- |
| Dashboard | `frontend/index.html`    | Captures new project notes and shows a quick result  |
| Projects  | `frontend/projects.html` | Displays saved project records grouped by project    |
| Report    | `frontend/report.html`   | Displays the full report for a selected project note |

## Current User Flow

1. User opens the LuxNote AI dashboard.
2. User enters client name, project name, project type, source, and project notes.
3. User submits the note for analysis.
4. The application displays a Quick Result on the main page.
5. The note is saved as a project record.
6. User opens the Projects page.
7. User selects a saved project note.
8. The full project report opens on the Report page.

## AWS Architecture

LuxNote AI is built as a serverless cloud application using AWS services.

### Current AWS Services

| AWS Service        | Purpose                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| Amazon API Gateway | Provides the public API endpoint used by the frontend                    |
| AWS Lambda         | Handles backend logic for creating and retrieving project notes          |
| Amazon DynamoDB    | Stores saved project note records                                        |
| Amazon S3          | Planned storage for project images and media uploads                     |
| Amazon Comprehend  | Planned or partial support for key phrase and text analysis              |
| Amazon Bedrock     | Planned or partial support for summaries, next steps, and draft messages |

## Application Architecture

```text
User
  ↓
Frontend Web App
  ↓
Amazon API Gateway
  ↓
AWS Lambda
  ↓
Amazon DynamoDB
```

Planned media upload architecture:

```text
Frontend Web App
  ↓
Amazon API Gateway
  ↓
AWS Lambda
  ↓
Amazon S3
  ↓
DynamoDB image metadata
```

## Data Model

Project note records may include:

```json
{
  "recordId": "unique-record-id",
  "clientName": "Private Client",
  "projectName": "Deer Valley Residence",
  "noteType": "site_walkthrough_transcript",
  "source": "Plaud transcript",
  "projectNotes": "Raw project notes or transcript text",
  "category": "Lighting Design",
  "priority": "High",
  "keyPhrases": ["lighting scenes", "keypad locations", "builder deadline"],
  "sentiment": "Neutral",
  "summary": "AI-generated project summary",
  "nextSteps": [
    "Confirm keypad locations",
    "Follow up with builder",
    "Review lighting control zones"
  ],
  "draftMessage": "AI-generated follow-up message",
  "createdAt": "2026-06-08T00:00:00Z"
}
```

## Frontend File Structure

```text
frontend/
  index.html
  app.js
  projects.html
  projects.js
  report.html
  report.js
  styles.css
  upgrade.css
  pages.css
  assets/
    luxnote-logo.png
    lighting-blueprint-wallpaper.png
```

### Key Frontend Files

| File                                      | Purpose                                                |
| ----------------------------------------- | ------------------------------------------------------ |
| `index.html`                              | Main dashboard and project note capture page           |
| `app.js`                                  | Handles note submission and Quick Result display       |
| `projects.html`                           | Project library page                                   |
| `projects.js`                             | Loads saved project records and groups them by project |
| `report.html`                             | Full report page for individual project notes          |
| `report.js`                               | Loads and displays a selected project record           |
| `styles.css`                              | Base styling                                           |
| `upgrade.css`                             | Dashboard visual upgrade styling                       |
| `pages.css`                               | Additional page-specific styling                       |
| `assets/luxnote-logo.png`                 | LuxNote AI logo                                        |
| `assets/lighting-blueprint-wallpaper.png` | Lighting-design blueprint background                   |

## Backend/API

The frontend connects to an API Gateway endpoint:

```javascript
const API_BASE_URL = "https://mqg99s0svc.execute-api.us-west-2.amazonaws.com";
```

### Current API Behavior

The application uses API routes for:

* Creating project notes
* Retrieving saved project notes
* Opening a selected project note as a report

Expected API routes include:

```text
POST /project-notes
GET /project-notes
GET /project-notes/{recordId}
```

## Local Development

To preview the frontend locally in Codespaces:

```bash
cd frontend
python3 -m http.server 8000
```

Then open the forwarded port URL from the Codespaces **Ports** tab.

### Test URLs

```text
/
```

```text
/projects.html
```

```text
/report.html?id=YOUR_RECORD_ID
```

## Git Branch Workflow

Current UI upgrade work is being developed on:

```text
ui-dashboard-upgrade
```

Recommended workflow:

```bash
git checkout ui-dashboard-upgrade
git status
```

Commit current changes:

```bash
git add .
git commit -m "Finalize dashboard projects and report layout"
git push origin ui-dashboard-upgrade
```

For new feature work, create a separate branch:

```bash
git checkout -b project-media-uploads
git push -u origin project-media-uploads
```

## Completed Week 4 Work

During Week 4, the project moved from architecture planning into working backend and frontend development.

### Week 4 Completed Items

* Built the backend serverless foundation
* Connected frontend requests to API Gateway
* Used Lambda as the backend processing layer
* Used DynamoDB for project note storage
* Tested project note submission
* Tested saved project note retrieval
* Built a working frontend dashboard
* Added a Projects page for saved records
* Added a Report page for full note details
* Improved the interface with branded LuxNote AI styling
* Added lighting-design themed visual direction

## Planned Next Feature: Project Media Uploads

The next planned feature is project media support.

### Planned Media Features

* Add a project cover photo
* Add walkthrough photo uploads
* Preview images before saving
* Store image files in Amazon S3
* Store image metadata in DynamoDB
* Display cover photos on the Projects page
* Display walkthrough photos in the Report page

### Planned Media Data Structure

```json
{
  "coverPhotoUrl": "S3 image URL or signed URL",
  "attachments": [
    {
      "fileName": "walkthrough-photo-1.jpg",
      "fileType": "image/jpeg",
      "s3Key": "projects/project-id/photos/file.jpg",
      "uploadedAt": "2026-06-08T00:00:00Z"
    }
  ]
}
```

## Future Improvements

Planned future enhancements include:

* User authentication with Amazon Cognito
* Permanent image uploads using Amazon S3
* Project cover photos
* Walkthrough photo galleries
* Better project search and filtering
* Exportable reports
* Printable client-facing summaries
* Builder/vendor follow-up templates
* More advanced AI-generated task lists
* Role-based user permissions
* Deployment with a custom domain

## Project Disclaimer

AI-generated summaries, next steps, and draft messages should be reviewed by a human before being used for client, builder, vendor, electrical, construction, or design decisions.

LuxNote AI is intended to assist project coordination, not replace professional judgment.
