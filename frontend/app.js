/* =========================================================
LuxNote AI
Dashboard Form and Quick Result Logic
========================================================= */

const API_BASE_URL =
"https://mqg99s0svc.execute-api.us-west-2.amazonaws.com";

const MAX_COVER_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_COVER_TYPES = new Set([
"image/jpeg",
"image/png"
]);

const getElement = (id) => document.getElementById(id);

const elements = {
form: getElement("project-note-form"),
clientName: getElement("client-name"),
projectName: getElement("project-name"),
noteType: getElement("note-type"),
source: getElement("source"),
projectNotes: getElement("project-notes"),
coverPhoto: getElement("cover-photo"),
coverPhotoPreview: getElement("cover-photo-preview"),
submitButton: getElement("submit-button"),
clearButton: getElement("clear-button"),
formMessage: getElement("form-message"),
characterCount: getElement("character-count"),
resultsSection: getElement("results-section"),
resultProjectName: getElement("result-project-name"),
resultPriority: getElement("result-priority"),
resultSummary: getElement("result-summary"),
resultNextSteps: getElement("result-next-steps"),
generationStatus: getElement("generation-status"),
openReportLink: getElement("open-report-link")
};

const submitLabel =
elements.submitButton?.querySelector(".button-label") || null;

let coverPreviewUrl = "";

/* =========================================================
GENERAL HELPERS
========================================================= */

function setMessage(message = "", type = "") {
elements.formMessage.textContent = message;
elements.formMessage.className = type
? `form-message ${type}`
: "form-message";
}

function setLoading(isLoading) {
elements.submitButton.disabled = isLoading;
elements.clearButton.disabled = isLoading;
elements.coverPhoto.disabled = isLoading;

elements.form.setAttribute(
"aria-busy",
String(isLoading)
);

elements.submitButton.classList.toggle(
"is-loading",
isLoading
);

if (submitLabel) {
submitLabel.textContent = isLoading
? "Analyzing Project Notes..."
: "Analyze Project Notes";
}
}

function updateCharacterCount() {
const count = elements.projectNotes.value.length;
const label = count === 1 ? "character" : "characters";

elements.characterCount.textContent =
`${count.toLocaleString()} ${label}`;
}

function clearElement(element) {
element.replaceChildren();
}

function normalizeStatus(value) {
if (!value) {
return "Completed";
}

return String(value)
.replaceAll("_", " ")
.replace(/\b\w/g, (character) => {
return character.toUpperCase();
});
}

/* =========================================================
API
========================================================= */

async function readApiResponse(response) {
const responseText = await response.text();
let data = {};

if (responseText) {
try {
data = JSON.parse(responseText);
} catch {
throw new Error(
`The server returned an unreadable response (${response.status}).`
);
}
}

if (data && typeof data.body === "string") {
try {
data = JSON.parse(data.body);
} catch {
throw new Error(
"The server returned malformed project data."
);
}
}

if (!response.ok) {
throw new Error(
data.error ||
data.message ||
`The request failed with status ${response.status}.`
);
}

return data;
}

async function apiFetch(path, options = {}) {
let response;

try {
response = await fetch(
`${API_BASE_URL}${path}`,
options
);
} catch {
throw new Error(
"LuxNote AI could not connect to the project service. Check your connection and try again."
);
}

return readApiResponse(response);
}

/* =========================================================
COVER PHOTO
========================================================= */

function validateCoverPhoto(file) {
if (!file) {
return;
}

if (!ALLOWED_COVER_TYPES.has(file.type)) {
throw new Error(
"Cover photo must be a JPG, JPEG, or PNG file."
);
}

if (file.size > MAX_COVER_PHOTO_BYTES) {
throw new Error(
"Cover photo must be 5 MB or smaller."
);
}
}

function resetCoverPreview() {
if (coverPreviewUrl) {
URL.revokeObjectURL(coverPreviewUrl);
coverPreviewUrl = "";
}

elements.coverPhotoPreview.classList.add(
"is-empty"
);

clearElement(elements.coverPhotoPreview);

const placeholder = document.createElement("span");
placeholder.textContent =
"No cover photo selected";

elements.coverPhotoPreview.appendChild(
placeholder
);
}

function previewSelectedCover() {
resetCoverPreview();
setMessage();

const file = elements.coverPhoto.files?.[0];

if (!file) {
return;
}

try {
validateCoverPhoto(file);
} catch (error) {
elements.coverPhoto.value = "";
setMessage(error.message, "error");
return;
}

coverPreviewUrl = URL.createObjectURL(file);

const image = document.createElement("img");
image.src = coverPreviewUrl;
image.alt = `Preview of ${file.name}`;

elements.coverPhotoPreview.classList.remove(
"is-empty"
);

elements.coverPhotoPreview.replaceChildren(
image
);
}

async function uploadCoverPhoto(
file,
projectName
) {
validateCoverPhoto(file);

const uploadDetails = await apiFetch(
"/project-cover-upload-url",
{
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify({
projectName,
fileName: file.name,
contentType: file.type
})
}
);

const {
uploadUrl,
fileUrl,
s3Key
} = uploadDetails;

if (!uploadUrl || !fileUrl || !s3Key) {
throw new Error(
"The cover photo service returned incomplete upload information."
);
}

let uploadResponse;

try {
uploadResponse = await fetch(uploadUrl, {
method: "PUT",
headers: {
"Content-Type": file.type
},
body: file
});
} catch {
throw new Error(
"The cover photo could not be uploaded. Check your connection and try again."
);
}

if (!uploadResponse.ok) {
throw new Error(
`The cover photo upload failed with status ${uploadResponse.status}.`
);
}

return {
coverPhotoUrl: fileUrl,
coverPhotoKey: s3Key,
coverPhotoName: file.name,
coverPhotoType: file.type
};
}

/* =========================================================
QUICK RESULT
========================================================= */

function renderNextSteps(items) {
clearElement(elements.resultNextSteps);

const steps =
Array.isArray(items) && items.length > 0
? items
: [
"No immediate action items were identified."
];

steps.forEach((step) => {
const item = document.createElement("li");


item.textContent =
  typeof step === "string" && step.trim()
    ? step.trim()
    : "No immediate action items were identified.";

elements.resultNextSteps.appendChild(item);


});
}

function showQuickResult(record) {
elements.resultProjectName.textContent =
record.projectName || "Unnamed Project";

elements.resultPriority.textContent =
record.priority || "Not assigned";

elements.resultSummary.textContent =
record.summary ||
"No summary was generated.";

elements.generationStatus.textContent =
normalizeStatus(record.generationStatus);

renderNextSteps(record.nextSteps);

elements.openReportLink.href = record.recordId
? `report.html?id=${encodeURIComponent(record.recordId)}`
: "projects.html";

elements.resultsSection.classList.remove(
"is-hidden"
);

elements.resultsSection.scrollIntoView({
behavior: "smooth",
block: "start"
});
}

/* =========================================================
FORM VALIDATION
========================================================= */

function getFormValues() {
return {
clientName:
elements.clientName.value.trim() ||
"Private Client",


projectName:
  elements.projectName.value.trim(),

noteType:
  elements.noteType.value,

source:
  elements.source.value,

projectNotes:
  elements.projectNotes.value.trim(),

coverPhoto:
  elements.coverPhoto.files?.[0] || null


};
}

function validateForm(values) {
if (!values.projectName) {
elements.projectName.focus();


throw new Error(
  "Add a project name before analyzing these notes."
);


}

if (!values.projectNotes) {
elements.projectNotes.focus();


throw new Error(
  "Add project notes, a transcript, or walkthrough details first."
);


}

validateCoverPhoto(values.coverPhoto);
}

/* =========================================================
FORM SUBMISSION
========================================================= */

async function submitProjectNote(event) {
event.preventDefault();
setMessage();

const values = getFormValues();

try {
validateForm(values);
} catch (error) {
setMessage(error.message, "error");
return;
}

setLoading(true);

try {
let coverMetadata = {};


if (values.coverPhoto) {
  setMessage(
    "Uploading the project cover photo...",
    "info"
  );

  coverMetadata = await uploadCoverPhoto(
    values.coverPhoto,
    values.projectName
  );
}

setMessage(
  "Organizing the project details and generating your summary...",
  "info"
);

const payload = {
  clientName: values.clientName,
  projectName: values.projectName,
  noteType: values.noteType,
  source: values.source,
  projectNotes: values.projectNotes,
  ...coverMetadata
};

const record = await apiFetch(
  "/project-notes",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  }
);

showQuickResult(record);

setMessage(
  values.coverPhoto
    ? "Project intelligence and cover photo saved successfully."
    : "Project intelligence saved successfully.",
  "success"
);


} catch (error) {
console.error(
"Project note submission failed:",
error
);


setMessage(error.message, "error");


} finally {
setLoading(false);
}
}

/* =========================================================
FORM RESET
========================================================= */

function resetQuickResult() {
elements.resultProjectName.textContent =
"Project name";

elements.resultPriority.textContent =
"Not assigned";

elements.resultSummary.textContent =
"The AI-generated summary will appear here.";

elements.generationStatus.textContent =
"Ready";

renderNextSteps([
"Generated next steps will appear here."
]);

elements.openReportLink.href =
"projects.html";

elements.resultsSection.classList.add(
"is-hidden"
);
}

function clearForm() {
elements.form.reset();

resetCoverPreview();
resetQuickResult();
updateCharacterCount();
setMessage();

elements.projectName.focus();
}

/* =========================================================
COPY CONTROLS
========================================================= */

function getCopyText(targetId) {
const target = getElement(targetId);

if (!target) {
return "";
}

if (targetId === "result-next-steps") {
return [
...target.querySelectorAll("li")
]
.map((item, index) => {
return `${index + 1}. ${item.textContent.trim()}`;
})
.join("\n");
}

return target.textContent.trim();
}

async function writeToClipboard(text) {
if (!text) {
throw new Error(
"There is no content available to copy."
);
}

if (
navigator.clipboard &&
window.isSecureContext
) {
await navigator.clipboard.writeText(text);
return;
}

const textArea =
document.createElement("textarea");

textArea.value = text;
textArea.setAttribute("readonly", "");
textArea.style.position = "fixed";
textArea.style.opacity = "0";

document.body.appendChild(textArea);
textArea.select();

const copied =
document.execCommand("copy");

textArea.remove();

if (!copied) {
throw new Error(
"Copying was blocked by the browser."
);
}
}

async function copyTarget(button) {
const targetId =
button.dataset.copyTarget;

const text =
getCopyText(targetId);

try {
await writeToClipboard(text);


const originalText =
  button.dataset.originalText ||
  button.textContent;

button.dataset.originalText =
  originalText;

button.textContent = "Copied";
button.classList.add("is-copied");

window.setTimeout(() => {
  button.textContent = originalText;
  button.classList.remove("is-copied");
}, 1400);


} catch (error) {
setMessage(
`${error.message} Select the text and copy it manually.`,
"error"
);
}
}

/* =========================================================
INITIALIZATION
========================================================= */

function initializeApp() {
elements.form.addEventListener(
"submit",
submitProjectNote
);

elements.clearButton.addEventListener(
"click",
clearForm
);

elements.projectNotes.addEventListener(
"input",
updateCharacterCount
);

elements.coverPhoto.addEventListener(
"change",
previewSelectedCover
);

document
.querySelectorAll(".copy-button")
.forEach((button) => {
button.addEventListener(
"click",
() => {
copyTarget(button);
}
);
});

resetCoverPreview();
updateCharacterCount();
}

initializeApp();
