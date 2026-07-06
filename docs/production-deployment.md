# LuxNote AI Production Deployment

Use this checklist when moving LuxNote AI from demo/beta mode into production.

## Frontend

1. Confirm `frontend/config.js` is in production mode:

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

2. Commit and push to `main`.
3. Wait for the AWS Amplify deployment to finish.
4. Verify the deployed config:

   ```text
   https://www.luxnote.ai/config.js
   ```

The current Cognito callback remains `https://www.luxnote.ai/workspace.html`
for compatibility with the existing app client. If you want sign-in from
`index.html` to return directly to the root dashboard, add
`https://www.luxnote.ai/index.html` to the Cognito app client's callback and
logout URLs, then update `frontend/config.js`.

## Lambda code

Deploy the current Lambda source:

```powershell
.\tools\deploy-private-lambda-code.ps1 `
  -LambdaFunctionName "YOUR_LAMBDA_FUNCTION_NAME"
```

If AWS CLI is not available, zip and upload `lambda/lambda_function.py` in the
AWS Lambda console.

## API Gateway and Lambda environment

Run:

```powershell
.\tools\configure-private-api.ps1 `
  -UserPoolId "YOUR_USER_POOL_ID" `
  -AppClientId "YOUR_COGNITO_APP_CLIENT_ID" `
  -LambdaFunctionName "YOUR_LAMBDA_FUNCTION_NAME" `
  -CoverPhotoBucket "YOUR_PRIVATE_COVER_BUCKET_NAME" `
  -PrivateAiEnabled false
```

Production environment variables should include:

```text
REQUIRE_AUTH=true
PRIVATE_PATH_PREFIX=/private
PRIVATE_COVER_PHOTOS=true
ALLOW_EXTERNAL_COVER_URLS=false
ALLOW_PUBLIC_DELETE=false
PRIVATE_AI_ENABLED=false
```

Use `PRIVATE_AI_ENABLED=true` only when production users are intentionally
allowed to send selected notes to Amazon Comprehend and Amazon Bedrock.

## Verification

Before entering real project data:

1. Open `https://www.luxnote.ai/`.
2. Confirm the page requires sign-in before forms or project records are usable.
3. Sign in with a test user.
4. Create a low-sensitivity test project note with AI off.
5. Open the project library and report.
6. Sign out and confirm the same records are inaccessible.
7. Sign in as a second test user and confirm the first user's records do not
   appear.
8. Confirm unauthenticated public API calls are rejected with `401` or `403`,
   not allowed to create, list, or delete records.

## Stop-ship checks

Do not use production for real client data if any of these are true:

- The frontend config still says `mode: "demo"` or `authRequired: false`.
- The frontend calls routes without `/private`.
- Public API calls can create, list, or delete records without sign-in.
- Cognito sign-in or sign-out fails.
- Private records are visible to a different signed-in user.
- External cover-photo URLs are accepted for production records.
