const API_BASE_URL = "https://mqg99s0svc.execute-api.us-west-2.amazonaws.com";
const $ = (id) => document.getElementById(id);

const form = $("project-note-form");
const clientName = $("client-name");
const projectName = $("project-name");
const noteType = $("note-type");
const source = $("source");
const projectNotes = $("project-notes");
const coverPhoto = $("cover-photo");
const coverPhotoPreview = $("cover-photo-preview");
const submitButton = $("submit-button");
const submitLabel = submitButton.querySelector(".button-label");
const clearButton = $("clear-button");
const formMessage = $("form-message");
const characterCount = $("character-count");
const resultsSection = $("results-section");

const MAX_COVER_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_COVER_TYPES = new Set(["image/jpeg", "image/png"]);
let coverPreviewUrl = "";

function setMessage(message = "", type = "") {
  formMessage.textContent = message;
  formMessage.className = type ? `form-message ${type}` : "form-message";
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  clearButton.disabled = isLoading;
  coverPhoto.disabled = isLoading;
  submitButton.classList.toggle("is-loading", isLoading);
  submitLabel.textContent = isLoading ? "Saving Project Note" : "Analyze Project Notes";
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

function validateCoverPhoto(file) {
  if (!file) return;

  if (!ALLOWED_COVER_TYPES.has(file.type)) {
    throw new Error("Cover photo must be a JPG, JPEG, or PNG file.");
  }

  if (file.size > MAX_COVER_PHOTO_BYTES) {
    throw new Error("Cover photo must be 5 MB or smaller.");
  }
}

function resetCoverPreview() {
  if (coverPreviewUrl) {
    URL.revokeObjectURL(coverPreviewUrl);
    coverPreviewUrl = "";
  }

  coverPhotoPreview.classList.add("is-empty");
  coverPhotoPreview.replaceChildren();
  const placeholder = document.createElement("span");
  placeholder.textContent = "No cover photo selected";
  coverPhotoPreview.appendChild(placeholder);
}

function previewSelectedCover() {
  resetCoverPreview();
  const file = coverPhoto.files?.[0];
  if (!file) return;

  try {
    validateCoverPhoto(file);
  } catch (error) {
    coverPhoto.value = "";
    setMessage(error.message, "error");
    return;
  }

  coverPreviewUrl = URL.createObjectURL(file);
  const image = document.createElement("img");
  image.src = coverPreviewUrl;
  image.alt = "Selected project cover photo preview";
  coverPhotoPreview.classList.remove("is-empty");
  coverPhotoPreview.replaceChildren(image);
  setMessage();
}

async function uploadCoverPhoto(file, projectNameValue) {
  validateCoverPhoto(file);

  const uploadDetails = await apiFetch("/project-cover-upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectName: projectNameValue,
      fileName: file.name,
      contentType: file.type
    })
  });

  if (!uploadDetails.uploadUrl || !uploadDetails.fileUrl || !uploadDetails.s3Key) {
    throw new Error("The cover photo upload service returned incomplete information.");
  }

  const uploadResponse = await fetch(uploadDetails.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file
  });

  if (!uploadResponse.ok) {
    throw new Error(`Cover photo upload failed (${uploadResponse.status}).`);
  }

  return {
    coverPhotoUrl: uploadDetails.fileUrl,
    coverPhotoKey: uploadDetails.s3Key,
    coverPhotoName: file.name,
    coverPhotoType: file.type
  };
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

  const projectNameValue = projectName.value.trim();
  const projectNotesValue = projectNotes.value.trim();
  const selectedCover = coverPhoto.files?.[0] || null;

  if (!projectNameValue) return setMessage("Project name is required.", "error");
  if (!projectNotesValue) return setMessage("Project notes are required.", "error");

  try {
    validateCoverPhoto(selectedCover);
  } catch (error) {
    return setMessage(error.message, "error");
  }

  setLoading(true);

  try {
    let coverMetadata = {};

    if (selectedCover) {
      setMessage("Uploading the project cover photo.", "info");
      coverMetadata = await uploadCoverPhoto(selectedCover, projectNameValue);
    }

    setMessage("Analyzing and saving project notes.", "info");

    const payload = {
      clientName: clientName.value.trim() || "Private Client",
      projectName: projectNameValue,
      noteType: noteType.value,
      source: source.value,
      projectNotes: projectNotesValue,
      ...coverMetadata
    };

    const record = await apiFetch("/project-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    showQuickResult(record);
    setMessage(
      selectedCover
        ? "Project note and cover photo saved successfully."
        : "Project note saved successfully.",
      "success"
    );
  } catch (error) {
    setMessage(error.message, "error");
    console.error(error);
  } finally {
    setLoading(false);
  }
}

function clearForm() {
  form.reset();
  resetCoverPreview();
  updateCharacterCount();
  setMessage();
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
coverPhoto.addEventListener("change", previewSelectedCover);
document.querySelectorAll(".copy-button").forEach((button) => {
  button.addEventListener("click", () => copyTarget(button));
});

resetCoverPreview();
updateCharacterCount();