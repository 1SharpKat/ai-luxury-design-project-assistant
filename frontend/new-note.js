/* =========================================================
   LuxNote
   Focused project note entry
   ========================================================= */

const API_BASE_URL =
  window.LUXNOTE_CONFIG?.apiBaseUrl ||
  "https://mqg99s0svc.execute-api.us-west-2.amazonaws.com";
const API_PATH_PREFIX = window.LUXNOTE_CONFIG?.apiPathPrefix || "";
const REQUEST_TIMEOUT_MS =
  Number(window.LUXNOTE_CONFIG?.requestTimeoutMs) || 30000;
const PROJECTS_PAGE =
  window.LUXNOTE_CONFIG?.routes?.projects || "projects.html";

const elements = {
  form: document.getElementById("project-note-form"),
  clientName: document.getElementById("client-name"),
  projectName: document.getElementById("project-name"),
  noteType: document.getElementById("note-type"),
  source: document.getElementById("source"),
  projectNotes: document.getElementById("project-notes"),
  characterCount: document.getElementById("character-count"),
  submitButton: document.getElementById("submit-button"),
  formMessage: document.getElementById("form-message")
};

let existingProjectKey = "";

function setMessage(message = "", type = "") {
  elements.formMessage.textContent = message;
  elements.formMessage.className = type
    ? `form-message ${type}`
    : "form-message";
}

function updateCharacterCount() {
  const count = elements.projectNotes.value.length;
  elements.characterCount.textContent =
    `${count.toLocaleString()} ${count === 1 ? "character" : "characters"}`;
}

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
      throw new Error("The server returned malformed project data.");
    }
  }

  if (!response.ok) {
    throw new Error(
      data.error || data.message || `The request failed with status ${response.status}.`
    );
  }

  return data;
}

async function apiFetch(path, options = {}) {
  const authHeaders = window.luxnoteAuth
    ? await window.luxnoteAuth.getAuthHeaders()
    : {};
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      `${API_BASE_URL}${API_PATH_PREFIX}${path}`,
      {
        ...options,
        headers: {
          ...authHeaders,
          ...(options.headers || {})
        },
        signal: controller.signal
      }
    );

    return await readApiResponse(response);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The project service took too long to respond.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function prefillFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const projectName = params.get("project");
  const projectKey = params.get("projectKey");
  const clientName = params.get("client");

  existingProjectKey = String(projectKey || "").trim();

  if (projectName) {
    elements.projectName.value = projectName;
  }
  if (clientName) {
    elements.clientName.value = clientName === "Private Client" ? "" : clientName;
  }

  if (existingProjectKey) {
    elements.projectName.readOnly = true;
    elements.projectName.title =
      "Rename this project from its Project Detail page so existing history stays together.";
  }
}

async function submitProjectNote(event) {
  event.preventDefault();
  setMessage();

  const visibleProjectName = elements.projectName.value.trim();
  const projectName = existingProjectKey || visibleProjectName;
  const projectNotes = elements.projectNotes.value.trim();

  if (!visibleProjectName) {
    elements.projectName.focus();
    setMessage("Add a project name before saving the note.", "error");
    return;
  }

  if (!projectNotes) {
    elements.projectNotes.focus();
    setMessage("Add project notes before saving.", "error");
    return;
  }

  elements.submitButton.disabled = true;
  elements.submitButton.textContent = "Saving...";
  setMessage("Saving project note...", "info");

  try {
    await apiFetch("/project-notes", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        clientName: elements.clientName.value.trim() || "Private Client",
        projectName,
        noteType: elements.noteType.value,
        source: elements.source.value,
        projectNotes,
        aiProcessingEnabled: false
      })
    });

    setMessage("Project note saved. Returning to the board...", "success");
    window.setTimeout(() => {
      window.location.href = PROJECTS_PAGE;
    }, 700);
  } catch (error) {
    console.error("Project note could not be saved:", error);
    setMessage(
      error.message || "Project note could not be saved.",
      "error"
    );
    elements.submitButton.disabled = false;
    elements.submitButton.textContent = "Save Project Note";
  }
}

async function initialize() {
  await window.luxnoteAuth?.initialize();

  if (
    window.luxnoteAuth?.getAccessState &&
    !window.luxnoteAuth.getAccessState().canAccess
  ) {
    return;
  }

  prefillFromQuery();
  updateCharacterCount();
  elements.projectNotes.addEventListener("input", updateCharacterCount);
  elements.form.addEventListener("submit", submitProjectNote);
}

initialize();
