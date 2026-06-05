# Week 4 Build Notes

## Completed Backend MVP

The first working backend version of the AI Luxury Design Project Assistant has been built.

The backend can now create project note records, retrieve all saved project note records, and retrieve one specific project note by `recordId`.

## AWS Services Used

* Amazon API Gateway
* AWS Lambda
* Amazon DynamoDB
* AWS IAM
* Amazon CloudWatch

## Completed Backend Flow

Project notes can now be submitted and retrieved through API Gateway routes.

A project note is submitted through the API Gateway route `POST /project-notes`. API Gateway sends the request to AWS Lambda. Lambda processes the note, assigns a category, assigns a priority level, generates basic next steps, creates a basic summary, creates a draft follow-up message, saves the record in DynamoDB, and returns a structured JSON response.

Saved project notes can be retrieved through the API Gateway route `GET /project-notes`. API Gateway sends the request to the same Lambda function. Lambda scans the DynamoDB table and returns a JSON response containing the saved project note records.

One specific saved project note can be retrieved through the API Gateway route `GET /project-notes/{recordId}`. API Gateway sends the request to Lambda, Lambda uses the provided `recordId` to retrieve the matching item from DynamoDB, and the API returns one saved project note record.

## Working AWS Resources

* API Gateway API: `LuxuryDesignProjectNotesAPI`
* Lambda function: `luxury-design-project-notes-api`
* DynamoDB table: `LuxuryDesignProjectNotes`
* DynamoDB partition key: `recordId`

## Working API Routes

* `POST /project-notes`
* `GET /project-notes`
* `GET /project-notes/{recordId}`

## Successful POST Test

A sample Deer Valley Residence project note was submitted using a CloudShell `curl` POST request.

The API returned a structured response with a `recordId`, category, priority, summary, next steps, draft message, and timestamp. The project note was successfully saved in DynamoDB.

## Successful GET All Test

Saved project note records were retrieved using a CloudShell `curl` GET request to `GET /project-notes`.

The API returned a JSON response with a record count and a list of saved project note records from DynamoDB.

## Successful GET by ID Test

One saved project note record was retrieved using a CloudShell `curl` GET request to `GET /project-notes/{recordId}`.

The API returned one structured project note record from DynamoDB, including the client name, project name, category, priority, summary, next steps, draft message, and timestamp.

## Current Status

The backend MVP is working.

The application can now accept notes through an API, process the request with Lambda, save the structured record in DynamoDB, retrieve all saved records from DynamoDB, retrieve one saved record by `recordId`, and return structured JSON responses to the user.

## Screenshots Captured

The following screenshots were captured as proof of the working backend build:

* API Gateway route
* API Gateway Lambda integration
* Lambda function
* DynamoDB table
* DynamoDB saved item
* CloudShell successful POST API test
* CloudShell successful GET all API test
* CloudShell successful GET by ID API test

## GitHub Updates

The GitHub repository includes the working Lambda code, sample request JSON, build notes, README documentation, `.gitignore`, and screenshots showing the AWS backend build progress.

## Next Steps

* Add Amazon Comprehend for key phrase and sentiment analysis.
* Add Amazon Bedrock for AI-generated summaries, action items, and follow-up messages.
* Add a simple frontend form for submitting project notes.
* Add CORS configuration when the frontend is connected to the API.
* Add basic API protection before sharing the endpoint publicly.
* Continue updating GitHub with source code, screenshots, and build notes.
