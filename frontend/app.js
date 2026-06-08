const API_BASE_URL = "https://mqg99s0svc.execute-api.us-west-2.amazonaws.com";
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

function setMessage(message = "", type = "") {
  formMessage.textContent = message;
  formMessage.className = type ? `form-message ${type}` : "form-message";
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  clearButton.disabled = isLoading;
  submitButton.classList.toggle("is-loading", isLoading);
  submitLabel.textContent = isLoading ? "Analyzing Notes" : "Analyze Project Notes";
}

function updateCharacterCount() {
  characterCount.textContent = `${projectNotes.value.length.toLocaleString()} characters`;
}

async function readApiResponse(response) {
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`The API returned an unreadable response (${response.status}).`);
  }
  if (data && typeof data.body === "string") {
    try { data = JSON.parse(data.body); } catch {}
  }
  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed (${response.status}).`);
  }
  return data;
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  return readApiResponse(response);
}

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function renderNextSteps(items) {
  const list = $("result-next-steps");
  clearNode(list);
  const steps = Array.isArray(items) && items.length ? items : ["No next steps were returned."];
  steps.forEach((step) => {
    const item = document.createElement("li");
    item.textContent = step;
    list.appendChild(item);
  });
}

function showQuickResult(record) {
  $("result-project-name").textContent = record.projectName || "Unnamed Project";
  $("result-priority").textContent = record.priority || "Not assigned";
  $("result-summary").textContent = record.summary || "No summary was generated.";
  $("generation-status").textContent = record.generationStatus
    ? record.generationStatus.replaceAll("_", " ")
    : "Completed";
  renderNextSteps(record.nextSteps);

  const reportLink = $("open-report-link");
  reportLink.href = record.recordId
    ? `report.html?id=${encodeURIComponent(record.recordId)}`
    : "projects.html";

  resultsSection.classList.remove("is-hidden");
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function submitProjectNote(event) {
  event.preventDefault();
  setMessage();

  const payload = {
    clientName: clientName.value.trim() || "Private Client",
    projectName: projectName.value.trim(),
    noteType: noteType.value,
    source: source.value,
    projectNotes: projectNotes.value.trim()
  };

  if (!payload.projectName) return setMessage("Project name is required.", "error");
  if (!payload.projectNotes) return setMessage("Project notes are required.", "error");

  setLoading(true);
  setMessage("Analyzing and saving project notes.", "info");

  try {
    const record = await apiFetch("/project-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    showQuickResult(record);
    setMessage("Project note analyzed and saved successfully.", "success");
  } catch (error) {
    setMessage(error.message, "error");
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
  const target = $(button.dataset.copyTarget);
  if (!target) return;
  const text = button.dataset.copyTarget === "result-next-steps"
    ? [...target.querySelectorAll("li")].map((item, i) => `${i + 1}. ${item.textContent}`).join("\n")
    : target.textContent.trim();

  navigator.clipboard.writeText(text).then(() => {
    const oldText = button.textContent;
    button.textContent = "Copied";
    window.setTimeout(() => { button.textContent = oldText; }, 1200);
  }).catch(() => setMessage("Copy was blocked by the browser.", "error"));
}

form.addEventListener("submit", submitProjectNote);
clearButton.addEventListener("click", clearForm);
projectNotes.addEventListener("input", updateCharacterCount);
document.querySelectorAll(".copy-button").forEach((button) => {
  button.addEventListener("click", () => copyTarget(button));
});
updateCharacterCount();
