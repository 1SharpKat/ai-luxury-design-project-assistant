# LuxNote AI Beta Testing Guide

## Beta Scope

The beta should use the private workspace at:

```text
https://www.luxnote.ai/workspace.html
```

The public demo remains available for fictional walkthroughs. Do not use the
public demo for client, project, address, vendor, or job-site information.

## Before Inviting Testers

1. Deploy the current `frontend` and `lambda/lambda_function.py`.
2. Confirm the Cognito app client callback and sign-out URLs include:
   `https://www.luxnote.ai/workspace.html`.
3. Confirm the private API routes require the Cognito JWT authorizer.
4. Confirm private records receive an `ownerUserId` and are not returned by
   public routes.
5. Keep `ALLOW_PUBLIC_DELETE` unset or set it to `false`.
6. Add each beta tester as a Cognito user.
7. Use fictional or low-sensitivity data for the first test round.

## Tester Smoke Test

Ask each tester to complete these steps in a private or incognito window:

1. Open the private workspace and sign in.
2. Create a note with AI processing turned off.
3. Confirm the note appears in the private project library.
4. Open the full report and print or save it as PDF.
5. Create a second note with AI processing turned on, if private AI is enabled.
6. Delete one private note and confirm it disappears.
7. Sign out and confirm private records are no longer visible.
8. Sign in as a different tester and confirm the first tester's records do not
   appear.

## Feedback Prompts

Collect the browser and device used, the page, what the tester expected, what
happened, and whether they could continue. Ask testers to rate:

- Sign-in clarity
- Note-entry speed
- Summary usefulness
- Next-step usefulness
- Project-library organization
- Report usefulness
- Overall trust and confidence

## Known Beta Limits

- AI output requires human review.
- Sessions expire and require a new sign-in; refresh tokens are not used.
- Cover-photo storage requires the optional S3 configuration.
- Reports use the browser print dialog rather than a dedicated PDF generator.
- Project lists currently use DynamoDB scans and should be revisited before a
  larger rollout.

## Stop-Ship Checks

Pause the beta if any tester can see another tester's private records, access a
private page after signing out, delete a public demo record, or submit a record
without a project name. Treat client data exposure as a security incident and
remove beta access until ownership filtering is verified.
