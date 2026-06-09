# Week 4 Build Notes

## Project

**AI Luxury Design Project Assistant**

## Week 4 Objective

The Week 4 objective was to build the serverless backend for the AI Luxury Design Project Assistant using AWS Lambda, Amazon API Gateway, and Amazon DynamoDB.

The backend was also expanded to include Amazon Comprehend and Amazon Bedrock so submitted project notes can be analyzed and converted into structured project information.

## Current Build Status

The AI-enhanced full-stack MVP is working.

The application can now:

* Accept project notes through a browser-based frontend
* Validate required project-name and project-note fields
* Process manually entered notes and walkthrough transcript text
* Upload and preview an optional JPEG or PNG project cover photo
* Assign project categories
* Assign priority levels
* Extract key phrases
* Analyze sentiment
* Generate professional summaries
* Generate specific next steps
* Generate draft client, builder, or vendor messages
* Save completed project records in DynamoDB
* Retrieve all saved project records
* Retrieve one project record by `recordId`
* Display a quick result after submission
* Display saved projects in a Projects page
* Display a complete project report in a Report page
* Copy generated summaries, next steps, and messages from the interface

## AWS Services Used

* Amazon API Gateway
* AWS Lambda
* Amazon DynamoDB
* Amazon Comprehend
* Amazon Bedrock
* Amazon S3
* AWS Amplify Hosting
* AWS Identity and Access Management
* Amazon CloudWatch

## Current Architecture

```text
User or Project Coordinator
            ↓
LuxNote AI Frontend
Dashboard / Projects / Report
            ↓
Amazon API Gateway
            ↓
AWS Lambda
        ↙       ↘
Amazon         Amazon
Comprehend     Bedrock
        ↘       ↙
     Structured Project Record
        ↙               ↘
Amazon DynamoDB       Amazon S3
        ↘               ↙
      JSON API Response
            ↓
LuxNote AI Frontend
```

## AWS Resources Created

* API Gateway API: `LuxuryDesignProjectNotesAPI`
* Lambda function: `luxury-design-project-notes-api`
* DynamoDB table: `LuxuryDesignProjectNotes`
* DynamoDB partition key: `recordId`
* AWS region: `us-west-2`

## Working API Routes

* `POST /project-notes`
* `GET /project-notes`
* `GET /project-notes/{recordId}`

## POST Project Notes Flow

The `POST /project-notes` route accepts project note information in JSON format.

API Gateway sends the request to AWS Lambda. Lambda validates the request and performs the following actions:

1. Creates a unique `recordId`
2. Assigns a project category
3. Assigns a priority level
4. Sends the note text to Amazon Comprehend
5. Extracts key phrases
6. Detects sentiment
7. Sends the project information to Amazon Bedrock
8. Generates a professional project summary
9. Generates specific next steps
10. Generates a draft follow-up message
11. Saves the completed record in DynamoDB
12. Returns the structured project record as JSON

## GET All Project Notes Flow

The `GET /project-notes` route retrieves all saved project note records from DynamoDB.

Lambda scans the table, sorts the records by creation timestamp, and returns a JSON response containing:

* Record count
* Saved project records
* Project names
* Categories
* Priorities
* AI-generated content
* Creation timestamps

## GET Project Note by ID Flow

The `GET /project-notes/{recordId}` route retrieves one specific record from DynamoDB.

Lambda uses the supplied `recordId` as the DynamoDB partition key and returns the matching project note record.

If no matching record exists, the API returns a `404` response.

## Amazon Comprehend Integration

Amazon Comprehend analyzes submitted project notes and returns:

* Key phrases
* Sentiment
* Sentiment confidence scores
* Analysis status

A successful Comprehend response includes:

```json
{
  "sentiment": "NEUTRAL",
  "analysisStatus": "COMPLETED"
}
```

The Deer Valley test successfully returned key phrases such as:

* Warm architectural lighting
* Hidden speakers
* Simple controls
* Keypad locations
* Equipment locations

## Amazon Bedrock Integration

Amazon Bedrock uses an Anthropic Claude model to generate:

* A concise professional summary
* A list of actionable next steps
* A polished draft follow-up message

The Bedrock model identifier is stored in the Lambda environment variable:

```text
BEDROCK_MODEL_ID
```

The model identifier is not hard-coded into the GitHub repository.

A successful Bedrock response includes:

```json
{
  "generationStatus": "COMPLETED"
}
```

## Successful AI-Enhanced Test

A Deer Valley Residence walkthrough transcript was submitted through the Lambda test event.

The successful response returned:

* `statusCode: 201`
* `analysisStatus: COMPLETED`
* `generationStatus: COMPLETED`
* Extracted key phrases
* Sentiment analysis
* Sentiment confidence scores
* AI-generated summary
* AI-generated next steps
* AI-generated draft builder message
* A unique `recordId`
* A UTC creation timestamp

The generated record was successfully stored in DynamoDB.

## Example AI-Generated Summary

The application generated a summary explaining that the Deer Valley Residence required builder coordination before an upcoming electrical walkthrough. It identified the client’s lighting, speaker, and control preferences and highlighted the keypad and equipment-location deadlines.

## Example AI-Generated Next Steps

The generated action items included:

* Finalize keypad locations
* Confirm equipment locations
* Prepare builder-ready documentation
* Review control-system simplicity requirements
* Coordinate lighting and dimming requirements
* Confirm electrical walkthrough timing
* Identify hidden-speaker rough-in requirements

## Example AI-Generated Draft Message

Amazon Bedrock generated a professional builder follow-up message that referenced:

* The upcoming electrical walkthrough
* Keypad-location documentation
* Equipment-location information
* Lighting-control and A/V coordination
* The deadline before Friday

## Error Handling

The Lambda function includes fallback behavior so an optional AI service failure does not prevent the core project note from being saved.

### Comprehend Fallback

If Amazon Comprehend is unavailable, the application can return:

```json
{
  "keyPhrases": [],
  "sentiment": "UNKNOWN",
  "analysisStatus": "COMPREHEND_UNAVAILABLE"
}
```

### Bedrock Fallback

If Amazon Bedrock is unavailable, Lambda uses rule-based summary, next-step, and draft-message functions.

Possible Bedrock generation statuses include:

* `COMPLETED`
* `BEDROCK_NOT_CONFIGURED`
* `BEDROCK_UNAVAILABLE`
* `BEDROCK_ERROR`

## Technical Issues Resolved

Several technical issues were identified and corrected during development:

### Lambda Handler Error

The original Lambda test failed because the expected `lambda_handler` function was missing. The handler was corrected and successfully invoked.

### DynamoDB Permission Error

Lambda initially did not have permission to perform `dynamodb:PutItem`. An IAM policy was added to the Lambda execution role.

### API Gateway Route Configuration

The initial API only included the POST route. Additional GET routes were created and attached to the existing Lambda integration.

### Python Syntax and Indentation Errors

Code copied through formatted text introduced backticks and indentation errors. The Lambda code was packaged and uploaded as a ZIP file to preserve valid Python formatting.

### DynamoDB Float Error

Amazon Comprehend returned sentiment confidence scores as Python floating-point values. DynamoDB does not accept Python floats, so the values were converted to `Decimal` before storage.

### Lambda Timeout

The original three-second Lambda timeout was too short for Comprehend and Bedrock processing. The timeout was increased and memory was adjusted to support AI-service requests.

## GitHub Repository

The GitHub repository includes:

* `README.md`
* `.gitignore`
* Working Lambda source code
* Sample request data
* Week 4 build notes
* A complete frontend in `/frontend`
* Dashboard, Projects, and Report pages
* Frontend JavaScript for API interaction and page behavior
* Responsive styling and the light-luxury visual theme
* Project cover-photo upload and preview support
* Archived design experiments in `docs/design-experiments`

AWS infrastructure and API screenshots were captured during development. Their current repository location must be verified before final submission.

## Screenshots Captured

Screenshots were captured during backend development for:

* API Gateway POST route
* API Gateway Lambda integration
* Lambda function
* DynamoDB table
* DynamoDB saved item
* Successful POST API test
* Successful GET all API test
* Successful GET by ID API test
* Successful Amazon Comprehend analysis
* Successful direct Amazon Bedrock model test
* Successful Bedrock Lambda test
* Successful full Bedrock API test

Before final submission, the screenshot files must be located, restored to the repository if necessary, and verified against the current AWS configuration.

## Current Backend Capabilities

The current backend supports:

```text
POST /project-notes
GET /project-notes
GET /project-notes/{recordId}
```

It can process:

* Typed project notes
* Copied meeting notes
* Site walkthrough notes
* Plaud transcript text
* Builder coordination notes
* Client preference notes

## Current Limitations

The current version:

* Does not yet include user authentication
* Uses a public API endpoint during development
* Does not yet accept raw audio
* Does not yet perform floor-plan or design-image analysis
* Does not automatically send generated messages
* Requires human review of AI-generated content
* Requires final verification of Amplify deployment and custom-domain routing
* Requires recovery and verification of the AWS evidence screenshots before submission

## Next Steps

* Complete end-to-end frontend testing
* Verify required-field validation
* Verify note submission and API responses
* Verify loading, success, and error states
* Verify quick-result and copy-button behavior
* Verify Projects and Report pages
* Verify invalid report-ID handling
* Verify cover-photo validation and upload
* Verify mobile layout and browser-console output
* Recover and organize AWS screenshots
* Commit and push final frontend fixes
* Merge the completed branch into `main`
* Verify AWS Amplify deployment
* Verify the LuxNote custom domain and redirects
* Add authentication and API protection in a future release
* Add floor-plan, site-photo, and markup analysis in a future release

## Week 4 Outcome

The Week 4 backend and serverless-development milestone was completed successfully.

The application has a functioning AWS serverless backend with database integration, three working API routes, Amazon Comprehend analysis, Amazon Bedrock content generation, CloudWatch logging, IAM permissions, error handling, and GitHub source control.

Since the Week 4 milestone, the project has expanded into a full-stack MVP with a responsive browser frontend, project submission workflow, quick-result display, saved-project library, detailed report page, copy controls, and project cover-photo support. Final work now focuses on quality assurance, screenshot recovery, deployment verification, and merging the polished branch into `main`.
