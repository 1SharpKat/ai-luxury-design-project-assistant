# LuxNote Private Workspace Live Setup

This setup keeps the public LinkedIn demo available while adding a signed-in
private workspace for job use.

## Public And Private URLs

Public portfolio demo:

```text
https://luxnote.ai/index.html
https://luxnote.ai/projects.html
https://luxnote.ai/report.html
```

Private job workspace:

```text
https://luxnote.ai/workspace.html
https://luxnote.ai/workspace-projects.html
https://luxnote.ai/workspace-report.html
```

Do not enter real client or job data until the private workspace is verified.

## What The Scripts Do

`tools/setup-private-cognito.ps1`

- Creates a Cognito User Pool for email sign-in.
- Creates a browser app client with no client secret.
- Creates a Cognito hosted UI domain.
- Optionally writes the public Cognito values into
  `frontend/config-private.js`.

`tools/deploy-private-lambda-code.ps1`

- Deploys `ai-luxury-design-project-assistant/lambda/lambda_function.py`.
- This Lambda already supports owner-scoped records, private cover-photo keys,
  private presigned view URLs, and AI-off private mode.

`tools/configure-private-api.ps1`

- Creates or reuses an API Gateway HTTP API JWT authorizer.
- Creates `/private/...` API routes that reuse the existing Lambda integration.
- Protects only the `/private/...` API routes with Cognito.
- Leaves the public demo routes unauthenticated.
- Leaves `OPTIONS` unauthenticated for CORS preflight.
- Updates Lambda environment variables for private mode.

## Prerequisites

Install AWS CLI v2, then authenticate:

```powershell
aws configure
```

or, if using AWS IAM Identity Center:

```powershell
aws sso login
```

Confirm access:

```powershell
aws sts get-caller-identity
```

## 1. Create Cognito

Choose a globally unique hosted UI domain prefix. Example:

```powershell
.\tools\setup-private-cognito.ps1 `
  -DomainPrefix "luxnote-private-yourname" `
  -UpdateConfig
```

The script prints:

```text
UserPoolId
ClientId
Domain
```

Keep those values for the API step.

## Console-First Path

Use this path if you are working in the AWS Console instead of AWS CLI.

### A. Deploy The Public Frontend

Deploy this zip to the existing Amplify-hosted site:

```text
deploy-artifacts/20260613-094843/luxnote-frontend-public-and-private.zip
```

If your Amplify app is connected to GitHub, push the updated `frontend` folder
through that repo instead of using manual upload. If it is a manual Amplify
deployment, upload the zip above.

After deployment, verify:

```text
https://luxnote.ai/index.html
https://luxnote.ai/projects.html
https://luxnote.ai/workspace.html
```

The private workspace should show a sign-in setup gate until Cognito is added.

### B. Deploy The Lambda Code

In AWS Lambda, upload:

```text
deploy-artifacts/20260613-094843/luxnote-private-aware-lambda.zip
```

Then set these environment variables:

```text
REQUIRE_AUTH=false
PRIVATE_PATH_PREFIX=/private
PRIVATE_COVER_PHOTOS=true
ALLOW_EXTERNAL_COVER_URLS=false
PRIVATE_AI_ENABLED=false
```

Leave existing public demo variables such as `AI_ENABLED`, `TABLE_NAME`,
`BEDROCK_MODEL_ID`, and `COVER_PHOTO_BUCKET` as they are.

### C. Create Cognito

In Amazon Cognito:

1. Create a user pool.
2. Use email sign-in.
3. Create a public browser app client with no client secret.
4. Enable Hosted UI.
5. Callback URL:

```text
https://luxnote.ai/workspace.html
```

6. Sign-out URL:

```text
https://luxnote.ai/workspace.html
```

7. Copy the hosted UI domain and app client ID into:

```text
frontend/config-private.js
```

Then redeploy the frontend zip or push the frontend update again.

### D. Add Private API Routes

In API Gateway, open the HTTP API with ID:

```text
mqg99s0svc
```

Create these routes and point them to the same Lambda integration as the
existing public routes:

```text
GET    /private/project-notes
POST   /private/project-notes
GET    /private/project-notes/{recordId}
DELETE /private/project-notes/{recordId}
POST   /private/project-cover-upload-url
```

Create a JWT authorizer:

```text
Issuer:   https://cognito-idp.us-west-2.amazonaws.com/YOUR_USER_POOL_ID
Audience: YOUR_COGNITO_APP_CLIENT_ID
```

Attach that authorizer only to the `/private/...` routes. Do not attach it to
the public `/project-notes` routes.

Confirm CORS allows:

```text
Origins: https://luxnote.ai
Methods: GET, POST, DELETE, OPTIONS
Headers: Authorization, Content-Type
```

### E. First Functional Test

For the first private test, do not upload a cover photo. That lets you verify
sign-in and owner-scoped records before configuring private S3.

1. Open `https://luxnote.ai/workspace.html`.
2. Sign in.
3. Save a fictional test note with no cover photo.
4. Open `https://luxnote.ai/workspace-projects.html`.
5. Confirm the note appears.
6. Sign out and confirm private records are unavailable.

## 2. Find The Lambda Function Name

If you do not remember the function name:

```powershell
aws lambda list-functions `
  --region us-west-2 `
  --query "Functions[?contains(FunctionName, 'Lux') || contains(FunctionName, 'lux')].[FunctionName]" `
  --output table
```

## 3. Deploy The Private-Aware Lambda Code

```powershell
.\tools\deploy-private-lambda-code.ps1 `
  -LambdaFunctionName "YOUR_LAMBDA_FUNCTION_NAME"
```

## 4. Configure API Gateway And Lambda Private Mode

The current API ID is inferred from the existing endpoint:

```text
mqg99s0svc
```

Run:

```powershell
.\tools\configure-private-api.ps1 `
  -UserPoolId "YOUR_USER_POOL_ID" `
  -AppClientId "YOUR_COGNITO_APP_CLIENT_ID" `
  -LambdaFunctionName "YOUR_LAMBDA_FUNCTION_NAME" `
  -CoverPhotoBucket "YOUR_PRIVATE_COVER_BUCKET_NAME" `
  -PrivateAiEnabled false
```

Use `-PrivateAiEnabled true` only when you intentionally want real job notes
sent to Amazon Comprehend and Amazon Bedrock. The public demo still uses the
existing public `/project-notes` routes.

## 5. Verify

1. Open `https://luxnote.ai/workspace.html`.
2. Confirm it asks you to sign in.
3. Sign in with a test user.
4. Create a fictional private test note.
5. Open `workspace-projects.html` and confirm the test note appears.
6. Open the private report.
7. Sign out.
8. Confirm private data is no longer accessible.
9. Sign in as a second test user and confirm the first test user's note does
   not appear.
10. Open `https://luxnote.ai/index.html` and confirm the public demo still
    loads.

## Notes

- `frontend/config-private.js` contains public Cognito app identifiers only.
- Do not commit AWS access keys, passwords, presigned URLs, or real client data.
- Public demo records do not have `ownerUserId`.
- Private records have `ownerUserId` and are hidden from public demo routes.
