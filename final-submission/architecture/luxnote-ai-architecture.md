# LuxNote AI AWS Architecture

```mermaid
flowchart TD
    User[Designer or Project Manager]

    Amplify[AWS Amplify<br/>Frontend Hosting]
    Frontend[LuxNote AI Web Application<br/>Dashboard, Projects, Reports]
    APIGW[Amazon API Gateway<br/>Serverless HTTP API]
    Lambda[AWS Lambda<br/>Project Note Processing]

    Comprehend[Amazon Comprehend<br/>Key Phrases and Sentiment]
    Bedrock[Amazon Bedrock<br/>Summary, Next Steps,<br/>Draft Communication]
    DynamoDB[Amazon DynamoDB<br/>Project Records]
    CloudWatch[Amazon CloudWatch<br/>Logs and Monitoring]
    S3[Amazon S3<br/>Optional Cover Photos]
    IAM[AWS IAM<br/>Service Permissions]

    User -->|HTTPS| Amplify
    Amplify --> Frontend
    Frontend -->|API Requests| APIGW
    APIGW --> Lambda

    Lambda -->|Analyze Notes| Comprehend
    Lambda -->|Generate Content| Bedrock
    Lambda -->|Store and Retrieve Records| DynamoDB
    Lambda -->|Execution Logs| CloudWatch
    Lambda -.->|Optional Image Upload| S3

    IAM -.-> Lambda
    IAM -.-> Comprehend
    IAM -.-> Bedrock
    IAM -.-> DynamoDB
    IAM -.-> CloudWatch
    IAM -.-> S3
```

## Processing Flow

1. The user accesses the LuxNote AI frontend hosted by AWS Amplify.
2. The frontend sends HTTPS requests through Amazon API Gateway.
3. API Gateway invokes AWS Lambda.
4. Lambda uses Amazon Comprehend to identify key phrases and sentiment.
5. Lambda uses Amazon Bedrock to generate summaries, next steps, and draft communication.
6. Processed project records are stored in Amazon DynamoDB.
7. Amazon CloudWatch records execution logs and processing status.
8. AWS IAM controls service-to-service permissions.
9. Amazon S3 optionally stores project cover photos.
