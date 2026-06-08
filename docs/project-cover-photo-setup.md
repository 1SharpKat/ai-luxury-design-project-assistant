# Project Cover Photo Setup

This branch adds one optional project cover photo per project note.

## What the feature does

- Adds a cover photo input to the main dashboard form.
- Validates JPG/JPEG and PNG files only.
- Limits the selected file to 5 MB.
- Shows a local preview before saving.
- Uploads the cover image to Amazon S3 using a pre-signed URL.
- Saves the S3 image reference with the project note record in DynamoDB.
- Displays cover photos on the Projects page.
- Displays the cover photo on the Report page when available.

## New frontend files changed

- `frontend/index.html`
- `frontend/app.js`
- `frontend/projects.js`
- `frontend/report.html`
- `frontend/report.js`
- `frontend/pages.css`

## New backend reference file

- `backend/lambda_function_with_cover_photo.py`

This backend file includes the current project-note Lambda logic plus a new route:

```text
POST /project-cover-upload-url
```

The frontend calls that route before submitting the project note. The route returns:

```json
{
  "uploadUrl": "pre-signed S3 PUT URL",
  "fileUrl": "public or readable S3 image URL",
  "s3Key": "project-covers/project-name/file-id.jpg"
}
```

## Required AWS setup

### 1. Create or choose an S3 bucket

Use a bucket for project media, for example:

```text
luxnote-project-media
```

### 2. Set Lambda environment variables

Add these environment variables to the Lambda function:

```text
TABLE_NAME=LuxuryDesignProjectNotes
COVER_PHOTO_BUCKET=your-s3-bucket-name
COVER_PHOTO_URL_BASE=https://your-s3-bucket-name.s3.us-west-2.amazonaws.com
```

`COVER_PHOTO_URL_BASE` is optional. If it is not set, the Lambda builds a standard S3 URL.

### 3. Add Lambda IAM permissions

The Lambda role needs S3 permission for the cover photo bucket:

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:PutObject"
  ],
  "Resource": "arn:aws:s3:::your-s3-bucket-name/project-covers/*"
}
```

It also still needs the existing DynamoDB and Comprehend permissions.

### 4. Add API Gateway route

Add this route to API Gateway and connect it to the same Lambda integration:

```text
POST /project-cover-upload-url
```

Keep the existing routes:

```text
POST /project-notes
GET /project-notes
GET /project-notes/{recordId}
```

### 5. Configure CORS

The API already allows `GET`, `POST`, and `OPTIONS` in the Lambda response headers. If API Gateway has separate CORS configuration, make sure it also allows:

```text
GET, POST, OPTIONS
Content-Type
```

For S3 direct browser uploads, the S3 bucket also needs CORS that allows PUT requests from the frontend origin.

Example S3 CORS configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

For production, replace `*` with the deployed frontend domain.

## Data fields added to DynamoDB records

When a cover photo is included, the project note record may include:

```json
{
  "coverPhotoUrl": "https://bucket.s3.us-west-2.amazonaws.com/project-covers/example/file.jpg",
  "coverPhotoKey": "project-covers/example/file.jpg",
  "coverPhotoName": "cover.jpg",
  "coverPhotoType": "image/jpeg"
}
```

## Testing checklist

1. Open the dashboard.
2. Choose a JPG or PNG under Project cover photo.
3. Confirm the preview displays.
4. Submit the project note.
5. Confirm the note saves successfully.
6. Open `projects.html`.
7. Confirm the project folder shows the cover thumbnail.
8. Open the report.
9. Confirm the cover image displays at the top of the report.

## Notes

This branch intentionally supports only one cover photo per project note. Walkthrough photo galleries can be added later after the S3 upload flow is confirmed.
