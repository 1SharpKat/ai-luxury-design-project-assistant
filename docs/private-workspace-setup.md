# Private Workspace Setup

LuxNote AI can run in two modes:

- Public portfolio demo: fictional data only, auth disabled.
- Private work workspace: sign-in required, records scoped to the signed-in user, private S3 cover photos, and optional AI processing.

Do not enter real client data until private mode is enabled and verified.

## Code Switches

The frontend switch lives in:

```text
frontend/config.js
```

For the public demo, keep:

```js
authEnabled: false,
allowExternalCoverUrls: true,
demoNotice: true
```

For private work, change the public Cognito values:

```js
authEnabled: true,
cognitoDomain: "https://your-cognito-domain.auth.us-west-2.amazoncognito.com",
cognitoClientId: "your-public-app-client-id",
cognitoRedirectUri: "https://luxnote.ai/index.html",
cognitoLogoutUri: "https://luxnote.ai/index.html",
allowExternalCoverUrls: false,
demoNotice: false
```

The Cognito domain and app client ID are public application identifiers, not secrets. Do not commit passwords, secret keys, AWS access keys, presigned URLs, or real client information.

The public demo still serves the static website, but the visible banner tells visitors to use fictional data only. The private work version protects the data at the API and S3 layers, which is the important security boundary.

## Lambda Environment Variables

Set these on the Lambda function for private work:

```text
REQUIRE_AUTH=true
PRIVATE_COVER_PHOTOS=true
ALLOW_EXTERNAL_COVER_URLS=false
AI_ENABLED=false
```

Keep the existing storage value:

```text
COVER_PHOTO_BUCKET=your-cover-photo-bucket-name
```

Use `AI_ENABLED=true` only when you intentionally want project notes sent to Amazon Comprehend and Amazon Bedrock. With `AI_ENABLED=false`, LuxNote still stores notes, folders, priority, category, and rule-based next steps.

## Cognito Setup

1. Open Amazon Cognito.
2. Create a User Pool.
3. Choose email sign-in.
4. Create an app client for a browser app.
5. Do not use a client secret for the browser app client.
6. Enable the hosted UI.
7. Add this callback URL:

```text
https://luxnote.ai/index.html
```

8. Add this sign-out URL:

```text
https://luxnote.ai/index.html
```

9. Copy the Cognito hosted UI domain and app client ID into `frontend/config.js`.

## API Gateway Setup

Use an HTTP API JWT authorizer.

1. Open API Gateway.
2. Open the LuxNote HTTP API.
3. Create a JWT authorizer.
4. Issuer URL:

```text
https://cognito-idp.us-west-2.amazonaws.com/YOUR_USER_POOL_ID
```

5. Audience:

```text
YOUR_COGNITO_APP_CLIENT_ID
```

6. Attach the authorizer to:

```text
GET  /project-notes
POST /project-notes
GET  /project-notes/{recordId}
DELETE /project-notes/{recordId}
POST /project-cover-upload-url
```

Leave `OPTIONS` preflight unauthenticated.

Confirm API Gateway CORS allows `GET`, `POST`, `DELETE`, `OPTIONS`, and the `Authorization` and `Content-Type` headers from the deployed frontend origin.

## Lambda IAM For Private Cover Photos

The Lambda execution role needs S3 permissions for the private cover-photo prefix:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPrivateCoverPhotoAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/private/*"
    }
  ]
}
```

Keep S3 Block Public Access on.

## S3 CORS

The bucket still needs browser `PUT` permission for uploads:

```json
[
  {
    "AllowedHeaders": ["Content-Type"],
    "AllowedMethods": ["PUT"],
    "AllowedOrigins": ["https://luxnote.ai"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Add a Codespace or local preview origin only while testing, then remove it.

## Verification Checklist

1. Open `https://luxnote.ai`.
2. Confirm the private workspace sign-in bar appears.
3. Sign in with a test user.
4. Create a fictional project note with a local cover photo.
5. Confirm the note saves.
6. Open Projects and confirm only that test user's folders appear.
7. Open the report and confirm the local cover photo displays.
8. Sign out and confirm project records are no longer accessible.
9. Sign in as a second test user and confirm the first user's records do not appear.

Existing public-demo records do not have an owner id. After `REQUIRE_AUTH=true`, they will stop appearing in the private workspace, but they are not deleted.
