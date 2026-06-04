# Week 4 Build Notes

## Completed Backend MVP

The first working backend version of the AI Luxury Design Project Assistant has been built.

## AWS Services Used

- Amazon API Gateway
- AWS Lambda
- Amazon DynamoDB
- AWS IAM
- Amazon CloudWatch

## Completed Flow

A project note is submitted through the API Gateway route `POST /project-notes`.

API Gateway sends the request to AWS Lambda. Lambda processes the note, assigns a category, assigns a priority level, generates basic next steps, creates a basic summary, creates a draft follow-up message, saves the record in DynamoDB, and returns a structured JSON response.

## Working AWS Resources

- API Gateway API: `LuxuryDesignProjectNotesAPI`
- Lambda function: `luxury-design-project-notes-api`
- DynamoDB table: `LuxuryDesignProjectNotes`
- Route: `POST /project-notes`

## Successful Test

A sample Deer Valley Residence project note was submitted using a CloudShell `curl` POST request. The API returned a structured response with a `recordId`, category, priority, summary, next steps, draft message, and timestamp.

## Current Status

The backend MVP is working. The project can accept notes through an API, process the request with Lambda, save the structured record in DynamoDB, and return the processed record to the user.

## Next Steps

- Add `GET /project-notes`
- Add `GET /project-notes/{recordId}`
- Add Amazon Comprehend for key phrase and sentiment analysis
- Add Amazon Bedrock for AI-generated summaries, action items, and follow-up messages
- Add a simple frontend form