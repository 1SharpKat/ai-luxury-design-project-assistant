# Week 4 Build Notes

## Completed Backend MVP

The first working backend version of the AI Luxury Design Project Assistant has been built.

## AWS Services Used

* Amazon API Gateway
* AWS Lambda
* Amazon DynamoDB
* AWS IAM
* Amazon CloudWatch

## Completed Flow

Project notes can now be submitted and retrieved through API Gateway routes.

A project note is submitted through the API Gateway route `POST /project-notes`. API Gateway sends the request to AWS Lambda. Lambda processes the note, assigns a category, assigns a priority level, generates basic next steps, creates a basic summary, creates a draft follow-up message, saves the record in DynamoDB, and returns a structured JSON response.

Saved project notes can also be retrieved through the API Gateway route `GET /project-notes`. API Gateway sends the request to the same Lambda function. Lambda scans the DynamoDB table and returns a JSON response containing the saved project note records.

## Working AWS Resources

* API Gateway API: `LuxuryDesignProjectNotesAPI`
* Lambda function: `luxury-design-project-notes-api`
* DynamoDB table: `LuxuryDesignProjectNotes`
* Route: `POST /project-notes`
* Route: `GET /project-notes`

## Successful POST Test

A sample Deer Valley Residence project note was submitted using a CloudShell `curl` POST request.

The API returned a structured response with a `recordId`, category, priority, summary, next steps, draft message, and timestamp. The project note was successfully saved in DynamoDB.

## Successful GET Test

The saved project note records were retrieved using a CloudShell `curl` GET request to `GET /project-notes`.

The API returned a JSON response with a record count and a list of saved project note records from DynamoDB.

## Current Status

The backend MVP is working. The project can now create and retrieve project note records.

The application can accept notes through an API, process the request with Lambda, save the structured record in DynamoDB, retrieve saved records from DynamoDB, and return structured JSON responses to the user.

## Screenshots Captured

The following screenshots were captured as proof of the working backend build:

* API Gateway route
* API Gateway Lambda integration
* Lambda function
* DynamoDB table
* DynamoDB saved item
* CloudShell successful POST API test
* CloudShell successful GET API test

## Next Steps

* Add `GET /project-notes/{recordId}` to retrieve one specific project record.
* Add Amazon Comprehend for key phrase and sentiment analysis.
* Add Amazon Bedrock for AI-generated summaries, action items, and follow-up messages.
* Add a simple frontend form for submitting project notes.
* Add CORS configuration when the frontend is connected to the API.
* Continue updating GitHub with source code, screenshots, and build notes.
