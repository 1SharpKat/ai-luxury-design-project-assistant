
/* =========================================================
   LuxNote AI
   Project Report
   ========================================================= */

const API_BASE_URL =
  "https://mqg99s0svc.execute-api.us-west-2.amazonaws.com";

const elements = {
  status: document.getElementById("report-status"),
  content: document.getElementById("report-content"),
  projectName: document.getElementById("report-project-name"),
  client: document.getElementById("report-client"),
  category: document.getElementById("report-category"),
  priority: document.getElementById("report-priority"),
  sentiment: document.getElementById("report-sentiment"),
  created: document.getElementById("report-created"),
  summary: document.getElementById("report-summary"),
  nextSteps: document.getElementById("report-next-steps"),
  keyPhrases: document.getElementById("report-key-phrases"),
  draft: document.getElementById("report-draft"),
  notes: document.getElementById("report-notes"),
  coverCard: document.getElementById("report-cover-card"),
  coverImage: document.getElementById("report-cover-image")
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short"
});

/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function clearElement(element) {
  element.replaceChildren();
}

function formatDate(value) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : dateFormatter.format(date);
}

function normalizeText(value, fallback) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function setLoadingState() {
  clearElement(elements.status);

  elements.status.className =
    "records-message loading-state";

  elements.status.textContent =
    "Loading project report...";

  elements.status.hidden = false;
  elements.content.classList.add("is-hidden");
}

function hideStatus() {
  elements.status.hidden = true;
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
        "The server returned malformed report data."
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

async function getJson(path) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        Accept: "application/json"
      }
    });
  } catch {
    throw new Error(
      "LuxNote AI could not connect to the project service. Check your connection and try again."
    );
  }

  return readApiResponse(response);
}

/* =========================================================
   REPORT CONTENT
   ========================================================= */

function renderList(element, items, fallback) {
  clearElement(element);

  const values =
    Array.isArray(items) && items.length > 0
      ? items
      : [fallback];

  values.forEach((value) => {
    const item = document.createElement("li");
    item.textContent = normalizeText(value, fallback);
    element.appendChild(item);
  });
}

function renderTags(items) {
  clearElement(elements.keyPhrases);

  const values =
    Array.isArray(items) && items.length > 0
      ? items
      : ["No key phrases identified"];

  values.forEach((value) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = normalizeText(
      value,
      "No key phrases identified"
    );

    elements.keyPhrases.appendChild(tag);
  });
}

function hideCoverPhoto() {
  elements.coverCard.classList.add("is-hidden");
  elements.coverImage.removeAttribute("src");
  elements.coverImage.alt = "";
}

function renderCoverPhoto(record) {
  const coverUrl = normalizeText(
    record.coverPhotoUrl,
    ""
  );

  if (!coverUrl) {
    hideCoverPhoto();
    return;
  }

  elements.coverImage.src = coverUrl;
  elements.coverImage.alt =
    `${normalizeText(record.projectName, "Project")} cover photo`;

  elements.coverImage.onload = () => {
    elements.coverCard.classList.remove("is-hidden");
  };

  elements.coverImage.onerror = () => {
    hideCoverPhoto();
  };
}

function renderReport(record) {
  const projectName = normalizeText(
    record.projectName,
    "Unnamed Project"
  );

  elements.projectName.textContent = projectName;

  elements.client.textContent = normalizeText(
    record.clientName,
    "Private Client"
  );

  elements.category.textContent = normalizeText(
    record.category,
    "General"
  );

  elements.priority.textContent = normalizeText(
    record.priority,
    "Not assigned"
  );

  elements.priority.dataset.priority =
    normalizeText(record.priority, "not assigned")
      .toLowerCase();

  elements.sentiment.textContent = normalizeText(
    record.sentiment,
    "Not analyzed"
  );

  elements.created.textContent =
    formatDate(record.createdAt);

  elements.summary.textContent = normalizeText(
    record.summary,
    "A project summary has not been generated yet."
  );

  elements.draft.textContent = normalizeText(
    record.draftMessage,
    "A follow-up message has not been generated yet."
  );

  elements.notes.textContent = normalizeText(
    record.projectNotes,
    "Original project notes are unavailable."
  );

  renderList(
    elements.nextSteps,
    record.nextSteps,
    "No immediate next steps were identified."
  );

  renderTags(record.keyPhrases);
  renderCoverPhoto(record);

  document.title = `${projectName} | LuxNote AI`;

  hideStatus();
  elements.content.classList.remove("is-hidden");
}

/* =========================================================
   PAGE STATES
   ========================================================= */

function renderMissingReportState() {
  clearElement(elements.status);

  elements.status.className =
    "records-message empty-state";

  elements.status.hidden = false;
  elements.content.classList.add("is-hidden");

  const heading = document.createElement("strong");
  heading.textContent = "No report selected.";

  const description = document.createElement("p");
  description.textContent =
    "Open a saved project note from the Projects page to view its full report.";

  const link = document.createElement("a");
  link.className = "primary-link";
  link.href = "projects.html";
  link.textContent = "View Projects";

  elements.status.append(
    heading,
    description,
    link
  );
}

function renderErrorState(error, recordId) {
  clearElement(elements.status);

  elements.status.className =
    "records-message error-state";

  elements.status.hidden = false;
  elements.content.classList.add("is-hidden");

  const heading = document.createElement("strong");
  heading.textContent = "Report unavailable.";

  const description = document.createElement("p");
  description.textContent =
    error.message ||
    "The selected project report could not be loaded.";

  const actions = document.createElement("div");
  actions.className = "report-actions";

  const retryButton = document.createElement("button");
  retryButton.className = "secondary-button";
  retryButton.type = "button";
  retryButton.textContent = "Try Again";

  retryButton.addEventListener("click", () => {
    loadReport(recordId);
  });

  const projectsLink = document.createElement("a");
  projectsLink.className = "secondary-link";
  projectsLink.href = "projects.html";
  projectsLink.textContent = "Back to Projects";

  actions.append(retryButton, projectsLink);

  elements.status.append(
    heading,
    description,
    actions
  );
}

/* =========================================================
   LOADING
   ========================================================= */

async function loadReport(recordId = null) {
  const id =
    recordId ||
    new URLSearchParams(window.location.search)
      .get("id");

  if (!id) {
    renderMissingReportState();
    return;
  }

  setLoadingState();

  try {
    const record = await getJson(
      `/project-notes/${encodeURIComponent(id)}`
    );

    renderReport(record);
  } catch (error) {
    console.error("Report could not be loaded:", error);
    renderErrorState(error, id);
  }
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

loadReport();
