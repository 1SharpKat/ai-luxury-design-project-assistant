# Week 4 Build Notes

## Project

**LuxNote AI. Luxury Design Project Assistant**

## Week 4 Objective

Build a serverless AWS backend using AWS Lambda, Amazon API Gateway, and Amazon DynamoDB, then integrate AI services that convert project notes into structured project intelligence.

## Completed Backend

The completed backend is stored at:

```text
lambda/lambda_function.py
```

It supports:

```text
POST /project-notes
GET  /project-notes
GET  /project-notes/{recordId}
DELETE /project-notes/{recordId}
POST /project-cover-upload-url
```

The cover-photo route is optional and is not required for the core demonstration.

## AWS Services Used

- Amazon API Gateway
- AWS Lambda
- Amazon DynamoDB
- Amazon Comprehend
- Amazon Bedrock
- Amazon CloudWatch
- AWS IAM
- AWS Amplify Hosting
- Amazon S3 for optional cover photos

## Request Processing

For `POST /project-notes`, the Lambda function:

1. Validates the incoming JSON request.
2. Creates a unique `recordId` and UTC timestamp.
3. Assigns a project category using project-note keywords.
4. Assigns a Low, Medium, or High priority.
5. Calls Amazon Comprehend for key phrases and sentiment.
6. Calls Amazon Bedrock for a summary, next steps, and draft communication.
7. Stores the completed project record in Amazon DynamoDB.
8. Returns the structured record through API Gateway.

## Amazon Comprehend Integration

Amazon Comprehend returns:

- Key phrases
- Sentiment
- Sentiment confidence scores
- Analysis status

Successful analysis uses:

```text
analysisStatus: COMPLETED
```

If Comprehend is unavailable, the Lambda preserves the core workflow and returns a safe fallback status.

## Amazon Bedrock Integration

Amazon Bedrock generates:

- A concise professional summary
- Specific next steps
- A draft client, builder, electrician, or vendor message
- Generation status

Successful generation uses:

```text
generationStatus: COMPLETED
```

The model identifier is supplied through the Lambda environment and is not committed to the repository.

The Bedrock prompt instructs the model not to invent dates, approvals, specifications, or commitments. Generated communication requires human review.

## DynamoDB Integration

Amazon DynamoDB stores the source notes and generated fields, including:

- `recordId`
- `clientName`
- `projectName`
- `noteType`
- `source`
- `projectNotes`
- `category`
- `priority`
- `keyPhrases`
- `sentiment`
- `sentimentScores`
- `analysisStatus`
- `summary`
- `nextSteps`
- `draftMessage`
- `generationStatus`
- `createdAt`

Optional S3 cover-photo metadata is stored only when a cover image is included.

## Error Handling and Fallbacks

The Lambda includes:

- Invalid JSON handling
- Required project-note validation
- Route-not-found responses
- Missing-record `404` responses
- Conditional-write conflict handling
- AWS service exception logging
- Amazon Comprehend fallback values
- Amazon Bedrock rule-based fallback content
- Consistent API Gateway response headers

## Issues Resolved During Development

### Lambda Handler

The Lambda entry point was corrected and verified through successful test execution.

### IAM Permissions

The Lambda execution role was updated with the service permissions required for DynamoDB, Amazon Comprehend, Amazon Bedrock, CloudWatch, and optional S3 access.

### API Gateway Routes

The API was expanded from the original POST route to support retrieving all records and retrieving one record by `recordId`.

### DynamoDB Number Types

Amazon Comprehend confidence scores are converted from Python floating-point values to `Decimal` before DynamoDB storage.

### AI Processing Time

Lambda timeout and memory settings were adjusted to support calls to Amazon Comprehend and Amazon Bedrock.

## Frontend Expansion

After the Week 4 backend milestone, the project expanded into a complete browser-based MVP with:

- A project-note dashboard
- Required-field validation
- Loading, success, and error states
- A quick-result panel
- A grouped Projects library
- Detailed printable reports
- Copy controls
- Responsive layouts
- Accessibility-focused focus and reduced-motion states
- Optional project cover-photo support

## Evidence and Submission Materials

The final AWS evidence screenshots are stored in:

```text
final-submission/aws-evidence/
```

The final architecture source files and rendered PNG are stored in:

```text
final-submission/architecture/
```

All demonstration data under `sample-data/` is fictional.

## Current Limitations

- Authentication and user-specific access are not implemented.
- The course demonstration uses a public API endpoint.
- Raw audio ingestion is not implemented.
- Floor-plan and design-image analysis are not implemented.
- Generated messages are not sent automatically.
- Optional S3 cover-photo support requires separate AWS configuration.

## Outcome

The Week 4 serverless milestone was completed successfully. LuxNote AI has a functioning API, Lambda processing layer, DynamoDB persistence, Amazon Comprehend analysis, Amazon Bedrock generation, IAM permissions, CloudWatch logging, fallback handling, and a browser frontend that demonstrates the complete project workflow.
