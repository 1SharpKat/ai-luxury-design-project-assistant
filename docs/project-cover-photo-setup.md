# Optional Project Cover Photo Setup

LuxNote AI supports one optional JPG or PNG cover photo per project note. This feature is supplemental and is not required for the core course demonstration.

## Feature Behavior

The frontend:

- Accepts JPG, JPEG, and PNG files
- Limits files to 5 MB
- Shows a local preview before submission
- Requests a pre-signed upload URL from the API
- Uploads the image directly to Amazon S3
- Saves the image URL and metadata with the DynamoDB project record
- Displays available cover photos on the Projects and Report pages

The active backend implementation is:

```text
lambda/lambda_function.py
```

## API Route

```text
POST /project-cover-upload-url
```

The route returns:

```json
{
  "uploadUrl": "temporary pre-signed S3 PUT URL",
  "fileUrl": "stored project image URL",
  "s3Key": "project-covers/project-name/generated-file-id.jpg"
}
```

Pre-signed URLs are temporary and must never be committed to the repository or included in final submission materials.

## Lambda Configuration

The optional feature uses these Lambda environment-variable names:

```text
COVER_PHOTO_BUCKET
COVER_PHOTO_URL_BASE
```

`COVER_PHOTO_URL_BASE` is optional. Environment-variable values must not be committed or shown in submission screenshots.

The existing `TABLE_NAME` and `BEDROCK_MODEL_ID` configuration remains separate from the cover-photo feature.

## IAM Permission

The Lambda execution role needs permission to upload objects to the selected S3 path. Scope the permission to the intended bucket and prefix rather than granting broad S3 access.

Example action:

```text
s3:PutObject
```

## API Gateway

Connect this route to the existing Lambda integration:

```text
POST /project-cover-upload-url
```

The core API routes remain:

```text
POST /project-notes
GET  /project-notes
GET  /project-notes/{recordId}
DELETE /project-notes/{recordId}
```

## CORS

API Gateway must allow the frontend origin to use `GET`, `POST`, `DELETE`, `OPTIONS`, and the `Content-Type` header. Private workspace mode also needs the `Authorization` header.

The S3 bucket must allow browser `PUT` requests from the deployed frontend origin. Use the specific production and development origins rather than `*` for a production deployment.

## Optional DynamoDB Fields

When a cover photo is included, a project record may contain:

```json
{
  "coverPhotoUrl": "stored image URL",
  "coverPhotoKey": "project-covers/example/generated-file.jpg",
  "coverPhotoName": "cover.jpg",
  "coverPhotoType": "image/jpeg"
}
```

## Test Checklist

1. Select a JPG or PNG under 5 MB.
2. Confirm the local preview appears.
3. Submit the fictional project record.
4. Confirm the project record saves successfully.
5. Open the Projects page and verify the thumbnail.
6. Open the full report and verify the cover image.
7. Test an unsupported file type and a file larger than 5 MB.
8. Confirm no pre-signed URL or private configuration value appears in committed files.

## Current Scope

The application supports one optional cover photo per project note. Multiple attachments, walkthrough galleries, document uploads, and private authenticated media access are future enhancements.

## Private Workspace Mode

For real client work, keep S3 Block Public Access enabled and use private authenticated media access. In private mode, uploaded cover photos are stored under a per-user S3 prefix and the API returns short-lived view URLs only after the signed-in user is authorized to see the project record.

See:

```text
docs/private-workspace-setup.md
```
