const API_BASE_URL =
"https://mqg99s0svc.execute-api.us-west-2.amazonaws.com";

const $ = (id) => document.getElementById(id);

const form = $("project-note-form");
const clientName = $("client-name");
const projectName = $("project-name");
const noteType = $("note-type");
const source = $("source");
const projectNotes = $("project-notes");
const submitButton = $("submit-button");
const submitLabel = submitButton.querySelector(".button-label");
const clearButton = $("clear-button");
const formMessage = $("form-message");
const characterCount = $("character-count");
const resultsSection = $("results-section");
const recordsLoading = $("records-loading");
const recordsList = $("records-list");
const refreshButton = $("refresh-records-button");

function setMessage(message = "", type = "") {
formMessage.textContent = message;
formMessage.className = type
? `form-message ${type}`
: "form-message";
}

function setLoading(isLoading) {
submitButton.disabled = isLoading;
clearButton.disabled = isLoading;
submitButton.classList.toggle("is-loading", isLoading);
submitLabel.textContent = isLoading
? "Analyzing Notes"
: "Analyze Project Notes";
}

function updateCharacterCount() {
characterCount.textContent =
`${projectNotes.value.length.toLocaleString()} characters`;
}

function formatDate(value) {
if (!value) {
return "Not available";
}

const date = new Date(value);

if (Number.isNaN(date.getTime())) {
return value;
}

return new Intl.DateTimeFormat("en-US", {
dateStyle: "medium",
timeStyle: "short"
}).format(date);
}

function statusLabel(value) {
if (!value) {
return "Unknown";
}

return value
.toLowerCase()
.split("_")
.map((word) => {
return word.charAt(0).toUpperCase() + word.slice(1);
})
.join(" ");
}

function clearNode(node) {
while (node.firstChild) {
node.removeChild(node.firstChild);
}
}

async function readApiResponse(response) {
const text = await response.text();
let data = {};

try {
data = text ? JSON.parse(text) : {};
} catch {
throw new Error(
`The API returned an unreadable response (${response.status}).`
);
}

if (
data &&
typeof data.body === "string"
) {
try {
data = JSON.parse(data.body);
} catch {
// Keep the original response object.
}
}

if (!response.ok) {
throw new Error(
data.error ||
data.message ||
`Request failed (${response.status}).`
);
}

return data;
}

async function apiFetch(path, options = {}) {
const response = await fetch(
`${API_BASE_URL}${path}`,
options
);

return readApiResponse(response);
}

function renderKeyPhrases(items) {
const container = $("result-key-phrases");
clearNode(container);

const phrases =
Array.isArray(items) && items.length
? items
: ["No key phrases returned"];

phrases.forEach((phrase) => {
const tag = document.createElement("span");


tag.className = "tag";
tag.textContent = phrase;

container.appendChild(tag);


});
}

function renderNextSteps(items) {
const list = $("result-next-steps");
clearNode(list);

const steps =
Array.isArray(items) && items.length
? items
: ["No next steps were returned."];

steps.forEach((step) => {
const item = document.createElement("li");


item.textContent = step;

list.appendChild(item);


});
}

function showRecord(record) {
$("result-project-name").textContent =
record.projectName || "Unnamed Project";

$("result-category").textContent =
record.category || "General Project Notes";

$("result-priority").textContent =
record.priority || "Not assigned";

$("result-sentiment").textContent =
record.sentiment || "Not analyzed";

$("result-summary").textContent =
record.summary || "No summary was generated.";

$("result-draft-message").textContent =
record.draftMessage || "No draft message was generated.";

$("result-record-id").textContent =
record.recordId || "Not available";

$("result-created-at").textContent =
formatDate(record.createdAt);

$("result-analysis-status").textContent =
statusLabel(record.analysisStatus);

$("result-generation-status").textContent =
statusLabel(record.generationStatus);

$("generation-status").textContent =
statusLabel(record.generationStatus);

renderKeyPhrases(record.keyPhrases);
renderNextSteps(record.nextSteps);

resultsSection.classList.remove("is-hidden");

resultsSection.scrollIntoView({
behavior: "smooth",
block: "start"
});
}

function createMeta(text) {
const span = document.createElement("span");

span.textContent = text;

return span;
}

function createRecordCard(record) {
const article = document.createElement("article");
article.className = "record-item";

const content = document.createElement("div");

const title = document.createElement("h3");
title.textContent =
record.projectName || "Unnamed Project";

const meta = document.createElement("div");
meta.className = "record-meta";

meta.appendChild(
createMeta(record.clientName || "Private Client")
);

meta.appendChild(
createMeta(record.priority || "No priority")
);

meta.appendChild(
createMeta(record.category || "No category")
);

meta.appendChild(
createMeta(formatDate(record.createdAt))
);

content.appendChild(title);
content.appendChild(meta);

const button = document.createElement("button");

button.type = "button";
button.className = "record-action";
button.textContent = "View Record";

button.addEventListener("click", async () => {
button.disabled = true;
button.textContent = "Loading";


try {
  const fullRecord = record.recordId
    ? await apiFetch(
        `/project-notes/${encodeURIComponent(record.recordId)}`,
        {
          headers: {
            Accept: "application/json"
          }
        }
      )
    : record;

  showRecord(fullRecord);
} catch (error) {
  setMessage(error.message, "error");
} finally {
  button.disabled = false;
  button.textContent = "View Record";
}


});

article.appendChild(content);
article.appendChild(button);

return article;
}

function renderRecords(records) {
clearNode(recordsList);

if (
!Array.isArray(records) ||
records.length === 0
) {
recordsLoading.style.display = "block";
recordsLoading.textContent =
"No project notes have been saved yet.";


return;


}

recordsLoading.style.display = "none";

records.forEach((record) => {
recordsList.appendChild(
createRecordCard(record)
);
});
}

async function loadSavedRecords() {
refreshButton.disabled = true;
refreshButton.textContent = "Loading";

recordsLoading.style.display = "block";
recordsLoading.textContent =
"Loading saved project notes.";

try {
const data = await apiFetch(
"/project-notes",
{
headers: {
Accept: "application/json"
}
}
);


renderRecords(data.items || []);


} catch (error) {
clearNode(recordsList);


recordsLoading.style.display = "block";
recordsLoading.textContent = error.message;

console.error(error);


} finally {
refreshButton.disabled = false;
refreshButton.textContent = "Refresh";
}
}

async function submitProjectNote(event) {
event.preventDefault();
setMessage();

const payload = {
clientName:
clientName.value.trim() || "Private Client",


projectName:
  projectName.value.trim(),

noteType:
  noteType.value,

source:
  source.value,

projectNotes:
  projectNotes.value.trim()


};

if (!payload.projectName) {
setMessage(
"Project name is required.",
"error"
);

return;


}

if (!payload.projectNotes) {
setMessage(
"Project notes are required.",
"error"
);


return;


}

setLoading(true);

setMessage(
"Analyzing project notes with Amazon Comprehend and Amazon Bedrock.",
"info"
);

try {
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


showRecord(record);

setMessage(
  "Project note analyzed and saved successfully.",
  "success"
);

await loadSavedRecords();


} catch (error) {
setMessage(
error.message,
"error"
);


console.error(error);


} finally {
setLoading(false);
}
}

function clearForm() {
form.reset();

updateCharacterCount();
setMessage();

resultsSection.classList.add("is-hidden");

projectName.focus();
}

function copyTarget(button) {
const targetId =
button.dataset.copyTarget;

const target =
$(targetId);

if (!target) {
return;
}

const text =
targetId === "result-next-steps"
? Array
.from(target.querySelectorAll("li"))
.map((item, index) => {
return `${index + 1}. ${item.textContent}`;
})
.join("\n")
: target.textContent.trim();

navigator.clipboard
.writeText(text)
.then(() => {
const oldText =
button.textContent;


  button.textContent =
    "Copied";

  window.setTimeout(() => {
    button.textContent =
      oldText;
  }, 1200);
})
.catch(() => {
  setMessage(
    "Copy was blocked by the browser.",
    "error"
  );
});


}

function initialize() {
form.addEventListener(
"submit",
submitProjectNote
);

clearButton.addEventListener(
"click",
clearForm
);

refreshButton.addEventListener(
"click",
loadSavedRecords
);

projectNotes.addEventListener(
"input",
updateCharacterCount
);

document
.querySelectorAll("[data-copy-target]")
.forEach((button) => {
button.addEventListener(
"click",
() => copyTarget(button)
);
});

updateCharacterCount();
loadSavedRecords();
}

document.addEventListener(
"DOMContentLoaded",
initialize
);
