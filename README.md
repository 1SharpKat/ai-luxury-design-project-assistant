# AI Luxury Design Project Assistant

A serverless AWS application for organizing luxury design project notes, walkthrough transcripts, action items, and client follow-up communication.

## Overview

The AI Luxury Design Project Assistant is designed for high-end residential design and A/V project teams that need a better way to organize project notes, walkthrough details, client preferences, builder coordination items, vendor communication, and follow-up tasks.

Luxury design projects often involve many moving parts. Details may come from client meetings, site walkthroughs, lighting reviews, builder conversations, vendor updates, email notes, or exported transcripts from tools such as Plaud. This application provides a backend workflow for submitting raw project notes, processing the content, saving a structured project record, and returning organized project information.

The current version is a working backend MVP built with AWS serverless services.

## Current Build Status

The backend MVP is working.

A sample project note was successfully submitted through an API Gateway `POST /project-notes` route using a CloudShell `curl` request. The request triggered AWS Lambda, the Lambda function processed the submitted note, saved the full record to DynamoDB, and returned a structured JSON response.

## Current Backend Flow

```text
User / Project Coordinator
        ↓
POST /project-notes
        ↓
Amazon API Gateway
        ↓
AWS Lambda
        ↓
Amazon DynamoDB
        ↓
Structured JSON Response
