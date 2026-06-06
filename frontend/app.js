const API_BASE_URL =
"https://mqg99s0svc.execute-api.us-west-2.amazonaws.com";

const projectNoteForm = document.getElementById("project-note-form");
const clientNameInput = document.getElementById("client-name");
const projectNameInput = document.getElementById("project-name");
const noteTypeInput = document.getElementById("note-type");
const sourceInput = document.getElementById("source");
const projectNotesInput = document.getElementById("project-notes");

const submitButton = document.getElementById("submit-button");
const submitButtonLabel = submitButton.querySelector(".button-label");
const clearButton = document.getElementById("clear-button");
const formMessage = document.getElementById("form-message");
const characterCount = document.getElementById("character-count");

const resultsSection = document.getElementById("results-section");
const generationStatusBadge = document.getElementById(
"generation-status"
);

const resultProjectName = document.getElementById(
"result-project-name"
);
const resultCategory = document.getElementById("result-category");
const resultPriority = document.getElementById("result-priority");
const resultSentiment = document.getElementById("result-sentiment");
const resultSummary = document.getElementById("result-summary");
const resultKeyPhrases = document.getElementById(
"result-key-phrases"
);
const resultNextSteps = document.getElementById(
"result-next-steps"
);
const resultDraftMessage = document.getElementById(
"result-draft-message"
);
const resultRecordId = document.getElementById("result-record-id");
const resultCreatedAt = document.getElementById(
"result-created-at"
);
const resultAnalysisStatus = document.getElementById(
"result-analysis-status"
);
const resultGenerationStatus = document.getElementById(
"result-generation-status"
);

const refreshRecordsButton = document.getElementById(
"refresh-records-button"
);
const recordsLoading = document.getElementById("records-loading");
const recordsList = document.getElementById("records-list");

function setFormMessage(message, type = "info") {
formMessage.textContent = message;
formMessage.className = `form-message ${type}`;
}

function clearFormMessage() {
formMessage.textContent = "";
formMessage.className = "form-message";
}

function setSubmitLoading(isLoading) {
submitButton.disabled = isLoading;
clearButton.disabled = isLoading;

if (isLoading) {
submitButton.classList.add("is-loading");
submitButtonLabel.textContent = "Analyzing Notes";
} else {
submitButton.classList.remove("is-loading");
submitButtonLabel.textContent = "Analyze Project Notes";
}
}

function updateCharacterCount() {
const count = projectNotesInput.value.length;
characterCount.textContent = `${count.toLocaleString()} characters`;
}

function normalizeApiResponse(data) {
if (
data &&
typeof data === "object" &&
typeof data.body === "string"
) {
try {
return JSON.parse(data.body);
} catch {
return data;
}
}

return data;
}

async function parseFetchResponse(response) {
const responseText = await response.text();

let data;

try {
data = responseText ? JSON.parse(responseText) : {};
} catch {
throw new Error(
`The API returned an unreadable response. Status ${response.status}.`
);
}

const normalizedData = normalizeApiResponse(data);

if (!response.ok) {
const errorMessage =
normalizedData.error ||
normalizedData.message ||
`Request failed with status ${response.status}.`;

```
throw new Error(errorMessage);
```

}

return normalizedData;
}

function formatDate(dateValue) {
if (!dateValue) {
return "Not available";
}

const date = new Date(dateValue);

if (Number.isNaN(date.getTime())) {
return dateValue;
}

return new Intl.DateTimeFormat("en-US", {
dateStyle: "medium",
timeStyle: "short"
}).format(date);
}

function getStatusLabel(status) {
if (!status) {
return "Unknown";
}

return status
.toLowerCase()
.split("_")
.map((word) => {
return word.charAt(0).toUpperCase() + word.slice(1);
})
.join(" ");
}

function clearElement(element) {
while (element.firstChild) {
element.removeChild(element.firstChild);
}
}

function displayKeyPhrases(keyPhrases) {
clearElement(resultKeyPhrases);

if (!Array.isArray(keyPhrases) || keyPhrases.length === 0) {
const emptyMessage = document.createElement("span");
emptyMessage.className = "tag";
emptyMessage.textContent = "No key phrases returned";
resultKeyPhrases.appendChild(emptyMessage);
return;
}

keyPhrases.forEach((phrase) => {
const tag = document.createElement("span");
tag.className = "tag";
tag.textContent = phrase;
resultKeyPhrases.appendChild(tag);
});
}

function displayNextSteps(nextSteps) {
clearElement(resultNextSteps);

if (!Array.isArray(nextSteps) || nextSteps.length === 0) {
const emptyStep = document.createElement("li");
emptyStep.textContent = "No next steps were returned.";
resultNextSteps.appendChild(emptyStep);
return;
}

nextSteps.forEach((step) => {
const listItem = document.createElement("li");
listItem.textContent = step;
resultNextSteps.appendChild(listItem);
});
}

function displayProjectResult(record) {
resultProjectName.textContent =
record.projectName || "Unnamed Project";

resultCategory.textContent =
record.category || "General Project Notes";

resultPriority.textContent =
record.priority || "Not assigned";

resultSentiment.textContent =
record.sentiment || "Not analyzed";

resultSummary.textContent =
record.summary || "No summary was generated.";

resultDraftMessage.textContent =
record.draftMessage || "No draft message was generated.";

resultRecordId.textContent =
record.recordId || "Not available";

resultCreatedAt.textContent = formatDate(record.createdAt);

resultAnalysisStatus.textContent = getStatusLabel(
record.analysisStatus
);

resultGenerationStatus.textContent = getStatusLabel(
record.generationStatus
);

const generationStatus =
record.generationStatus || "UNKNOWN";

generationStatusBadge.textContent = getStatusLabel(
generationStatus
);

displayKeyPhrases(record.keyPhrases);
displayNextSteps(record.nextSteps);

resultsSection.classList.remove("is-hidden");

resultsSection.scrollIntoView({
behavior: "smooth",
block: "start"
});
}

function buildProjectNotePayload() {
return {
clientName:
clientNameInput.value.trim() || "Private Client",
projectName: projectNameInput.value.trim(),
noteType: noteTypeInput.value,
source: sourceInput.value,
projectNotes: projectNotesInput.value.trim()
};
}

function validatePayload(payload) {
if (!payload.projectName) {
throw new Error("Project name is required.");
}

if (!payload.projectNotes) {
throw new Error("Project notes are required.");
}

if (payload.projectNotes.length > 10000) {
throw new Error(
"Project notes must be 10,000 characters or fewer."
);
}
}

async function createProjectNote(payload) {
const response = await fetch(
`${API_BASE_URL}/project-notes`,
{
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify(payload)
}
);

return parseFetchResponse(response);
}

async function handleFormSubmit(event) {
event.preventDefault();
clearFormMessage();

let payload;

try {
payload = buildProjectNotePayload();
validatePayload(payload);
} catch (error) {
setFormMessage(error.message, "error");
return;
}

setSubmitLoading(true);
setFormMessage(
"Analyzing project notes with Amazon Comprehend and Amazon Bedrock.",
"info"
);

try {
const projectRecord = await createProjectNote(payload);

```
displayProjectResult(projectRecord);

setFormMessage(
  "Project note analyzed and saved successfully.",
  "success"
);

await loadSavedRecords();
```

} catch (error) {
console.error("Project note submission failed:", error);

```
setFormMessage(
  error.message ||
    "The project note could not be processed.",
  "error"
);
```

} finally {
setSubmitLoading(false);
}
}

function clearForm() {
projectNoteForm.reset();
clientNameInput.value = "";
projectNameInput.value = "";
projectNotesInput.value = "";

updateCharacterCount();
clearFormMessage();

resultsSection.classList.add("is-hidden");

projectNameInput.focus();
}

function createRecordMetaItem(text) {
const span = document.createElement("span");
span.textContent = text;
return span;
}

function createSavedRecordElement(record) {
const article = document.createElement("article");
article.className = "record-item";

const content = document.createElement("div");

const title = document.createElement("h3");
title.textContent = record.projectName || "Unnamed Project";

const meta = document.createElement("div");
meta.className = "record-meta";

meta.appendChild(
createRecordMetaItem(record.clientName || "Private Client")
);

meta.appendChild(
createRecordMetaItem(record.priority || "No priority")
);

meta.appendChild(
createRecordMetaItem(record.category || "No category")
);

meta.appendChild(
createRecordMetaItem(formatDate(record.createdAt))
);

content.appendChild(title);
content.appendChild(meta);

const viewButton = document.createElement("button");
viewButton.type = "button";
viewButton.className = "record-action";
viewButton.textContent = "View Record";

viewButton.addEventListener("click", async () => {
if (!record.recordId) {
displayProjectResult(record);
return;
}

```
viewButton.disabled = true;
viewButton.textContent = "Loading";

try {
  const fullRecord = await getProjectNoteById(
    record.recordId
  );

  displayProjectResult(fullRecord);
} catch (error) {
  setFormMessage(
    error.message || "The record could not be loaded.",
    "error"
  );
} finally {
  viewButton.disabled = false;
  viewButton.textContent = "View Record";
}
```

});

article.appendChild(content);
article.appendChild(viewButton);

return article;
}

function displaySavedRecords(records) {
clearElement(recordsList);

if (!Array.isArray(records) || records.length === 0) {
recordsLoading.textContent =
"No project notes have been saved yet.";

```
recordsLoading.style.display = "block";
return;
```

}

recordsLoading.style.display = "none";

records.forEach((record) => {
recordsList.appendChild(
createSavedRecordElement(record)
);
});
}

async function getAllProjectNotes() {
const response = await fetch(
`${API_BASE_URL}/project-notes`,
{
method: "GET",
headers: {
"Accept": "application/json"
}
}
);

return parseFetchResponse(response);
}

async function getProjectNoteById(recordId) {
const encodedRecordId = encodeURIComponent(recordId);

const response = await fetch(
`${API_BASE_URL}/project-notes/${encodedRecordId}`,
{
method: "GET",
headers: {
"Accept": "application/json"
}
}
);

return parseFetchResponse(response);
}

async function loadSavedRecords() {
refreshRecordsButton.disabled = true;
refreshRecordsButton.textContent = "Loading";

recordsLoading.style.display = "block";
recordsLoading.textContent = "Loading saved project notes.";

try {
const response = await getAllProjectNotes();

```
const records = Array.isArray(response.items)
  ? response.items
  : [];

displaySavedRecords(records);
```

} catch (error) {
console.error("Saved records could not be loaded:", error);

```
clearElement(recordsList);

recordsLoading.style.display = "block";
recordsLoading.textContent =
  error.message ||
  "Saved project notes could not be loaded.";
```

} finally {
refreshRecordsButton.disabled = false;
refreshRecordsButton.textContent = "Refresh";
}
}

async function copyText(text, button) {
if (!text) {
return;
}

const originalText = button.textContent;

try {
await navigator.clipboard.writeText(text);
button.textContent = "Copied";
} catch {
const temporaryTextArea = document.createElement(
"textarea"
);

```
temporaryTextArea.value = text;
temporaryTextArea.setAttribute("readonly", "");
temporaryTextArea.style.position = "fixed";
temporaryTextArea.style.opacity = "0";

document.body.appendChild(temporaryTextArea);
temporaryTextArea.select();

document.execCommand("copy");
temporaryTextArea.remove();

button.textContent = "Copied";
```

}

window.setTimeout(() => {
button.textContent = originalText;
}, 1400);
}

function getCopyTargetText(targetId) {
const target = document.getElementById(targetId);

if (!target) {
return "";
}

if (targetId === "result-next-steps") {
return Array.from(target.querySelectorAll("li"))
.map((item, index) => {
return `${index + 1}. ${item.textContent}`;
})
.join("\n");
}

return target.textContent.trim();
}

function configureCopyButtons() {
const copyButtons = document.querySelectorAll(
"[data-copy-target]"
);

copyButtons.forEach((button) => {
button.addEventListener("click", () => {
const targetId = button.dataset.copyTarget;
const text = getCopyTargetText(targetId);

```
  copyText(text, button);
});
```

});
}

function initializeApplication() {
projectNoteForm.addEventListener(
"submit",
handleFormSubmit
);

clearButton.addEventListener("click", clearForm);

refreshRecordsButton.addEventListener(
"click",
loadSavedRecords
);

projectNotesInput.addEventListener(
"input",
updateCharacterCount
);

configureCopyButtons();
updateCharacterCount();
loadSavedRecords();
}

document.addEventListener(
"DOMContentLoaded",
initializeApplication
);
