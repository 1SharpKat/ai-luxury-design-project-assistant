
/* =========================================================
   LuxNote AI
   Projects Library
   ========================================================= */

const API_BASE_URL =
window.LUXNOTE_CONFIG?.apiBaseUrl ||
  "https://mqg99s0svc.execute-api.us-west-2.amazonaws.com";
const API_PATH_PREFIX =
window.LUXNOTE_CONFIG?.apiPathPrefix || "";
const APP_ROUTES = window.LUXNOTE_CONFIG?.routes || {};
const NEW_NOTE_PAGE = APP_ROUTES.newNote || "index.html#new-note";
const PROJECTS_PAGE = APP_ROUTES.projects || "projects.html";
const REPORT_PAGE = APP_ROUTES.report || "report.html";

const elements = {
  folders: document.getElementById("project-folders"),
  status: document.getElementById("projects-status"),
  refreshButton: document.getElementById("refresh-projects")
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium"
});

/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function formatDate(value) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : dateFormatter.format(date);
}

function formatNoteType(value) {
  if (!value) {
    return "Project note";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function clearElement(element) {
  element.replaceChildren();
}

function setRefreshState(isLoading) {
  elements.refreshButton.disabled = isLoading;
  elements.refreshButton.textContent = isLoading
    ? "Refreshing..."
    : "Refresh";
}

function showStatus(message, type = "") {
  clearElement(elements.status);

  elements.status.className = type
    ? `records-message ${type}`
    : "records-message";

  elements.status.textContent = message;
  elements.status.hidden = false;
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
      throw new Error("The server returned malformed project data.");
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
  const authHeaders =
    window.luxnoteAuth
      ? await window.luxnoteAuth.getAuthHeaders()
      : {};
  const headers = {
    ...authHeaders,
    ...(options.headers || {})
  };

  try {
    response = await fetch(
      `${API_BASE_URL}${API_PATH_PREFIX}${path}`,
      {
        ...options,
        headers
      }
    );
  } catch {
    throw new Error(
      "LuxNote AI could not connect to the project service. Check your connection and try again."
    );
  }

  return readApiResponse(response);
}

function getJson(path) {
  return apiFetch(path, {
    headers: {
      Accept: "application/json"
    }
  });
}

/* =========================================================
   PROJECT DATA
   ========================================================= */

function groupByProject(records) {
  return records.reduce((groups, record) => {
    const projectName =
      typeof record.projectName === "string" &&
      record.projectName.trim()
        ? record.projectName.trim()
        : "Unnamed Project";

    if (!groups.has(projectName)) {
      groups.set(projectName, []);
    }

    groups.get(projectName).push(record);

    return groups;
  }, new Map());
}

function getProjectCoverUrl(notes) {
  const noteWithCover = notes.find((note) => {
    return (
      typeof note.coverPhotoUrl === "string" &&
      note.coverPhotoUrl.trim()
    );
  });

  return noteWithCover?.coverPhotoUrl.trim() || "";
}

function sortNotesByNewest(notes) {
  return [...notes].sort((first, second) => {
    return (
      getTimestamp(second.createdAt) -
      getTimestamp(first.createdAt)
    );
  });
}

/* =========================================================
   PROJECT NOTE ROW
   ========================================================= */

async function deleteProjectNote(record) {
  if (!record.recordId) {
    return;
  }

  const noteName = formatNoteType(record.noteType);
  const confirmed = window.confirm(
    `Delete this ${noteName} note? This cannot be undone.`
  );

  if (!confirmed) {
    return;
  }

  try {
    await apiFetch(
      `/project-notes/${encodeURIComponent(record.recordId)}`,
      {
        method: "DELETE",
        headers: {
          Accept: "application/json"
        }
      }
    );

    showStatus("Project note deleted.", "success-state");
    loadProjects();
  } catch (error) {
    console.error("Project note could not be deleted:", error);
    showStatus(
      error.message || "Project note could not be deleted.",
      "error-state"
    );
  }
}

function createTrashIcon() {
  const icon = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg"
  );
  icon.setAttribute("class", "trash-icon");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");

  const path = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path"
  );
  path.setAttribute(
    "d",
    "M3 6h18M9 6V4h6v2m-8 0 1 14h8l1-14"
  );
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-width", "1.8");
  icon.appendChild(path);

  return icon;
}

function createNoteRow(record) {
  const row = document.createElement("div");
  row.className = "project-note-row";

  const reportLink = document.createElement("a");
  reportLink.className = "project-note-link";

  if (record.recordId) {
    reportLink.href =
      `${REPORT_PAGE}?id=${encodeURIComponent(record.recordId)}`;
  } else {
    reportLink.href = PROJECTS_PAGE;
    reportLink.setAttribute("aria-disabled", "true");
  }

  const noteDetails = document.createElement("span");

  const noteTitle = document.createElement("strong");
  noteTitle.textContent = formatNoteType(record.noteType);

  const noteMeta = document.createElement("small");
  noteMeta.textContent =
    `${record.category || "General"} | ${formatDate(record.createdAt)}`;

  noteDetails.append(noteTitle, noteMeta);

  const priority = document.createElement("span");
  priority.className = "note-priority";
  priority.textContent = record.priority || "Not assigned";

  if (record.priority) {
    priority.dataset.priority =
      String(record.priority).toLowerCase();
  }

  reportLink.append(noteDetails, priority);

  const deleteButton = document.createElement("button");
  deleteButton.className = "project-note-delete";
  deleteButton.type = "button";
  deleteButton.title = "Delete project note";
  deleteButton.setAttribute(
    "aria-label",
    `Delete ${formatNoteType(record.noteType)} note`
  );
  deleteButton.appendChild(createTrashIcon());
  deleteButton.addEventListener("click", () => {
    deleteProjectNote(record);
  });

  row.append(reportLink, deleteButton);

  return row;
}

/* =========================================================
   PROJECT FOLDER
   ========================================================= */

function createProjectCover(projectName, notes) {
  const cover = document.createElement("span");
  const coverUrl = getProjectCoverUrl(notes);

  cover.className = coverUrl
    ? "project-cover-thumb"
    : "project-cover-thumb no-cover";

  if (!coverUrl) {
    cover.textContent = "Photo";
    cover.setAttribute("aria-hidden", "true");
    return cover;
  }

  const image = document.createElement("img");
  image.src = coverUrl;
  image.alt = `${projectName} cover photo`;
  image.loading = "lazy";

  image.addEventListener("error", () => {
    cover.classList.add("no-cover");
    cover.replaceChildren();
    cover.textContent = "Photo";
    cover.setAttribute("aria-hidden", "true");
  });

  cover.appendChild(image);

  return cover;
}

function createProjectFolder(projectName, projectNotes) {
  const notes = sortNotesByNewest(projectNotes);
  const latestNote = notes[0];

  const folder = document.createElement("details");
  folder.className = "project-folder-card";

  const summary = document.createElement("summary");

  const cover = createProjectCover(projectName, notes);

  const folderCopy = document.createElement("span");
  folderCopy.className = "folder-copy";

  const projectTitle = document.createElement("strong");
  projectTitle.textContent = projectName;

  const projectMeta = document.createElement("small");
  const noteLabel = notes.length === 1 ? "note" : "notes";

  projectMeta.textContent =
    `${latestNote.clientName || "Private Client"} - ` +
    `${notes.length} saved ${noteLabel} - ` +
    `Updated ${formatDate(latestNote.createdAt)}`;

  folderCopy.append(projectTitle, projectMeta);

  const arrow = document.createElement("span");
  arrow.className = "folder-arrow";
  arrow.textContent = ">";
  arrow.setAttribute("aria-hidden", "true");

  summary.append(cover, folderCopy, arrow);

  const noteList = document.createElement("div");
  noteList.className = "project-note-list";

  notes.forEach((note) => {
    noteList.appendChild(createNoteRow(note));
  });

  folder.append(summary, noteList);

  return folder;
}

/* =========================================================
   PAGE STATES
   ========================================================= */

function renderEmptyState() {
  clearElement(elements.folders);
  clearElement(elements.status);

  elements.status.className = "records-message empty-state";
  elements.status.hidden = false;

  const heading = document.createElement("strong");
  heading.textContent = "No saved projects yet.";

  const description = document.createElement("p");
  description.textContent =
    "Create your first project note to begin building the project library.";

  const link = document.createElement("a");
  link.className = "primary-link";
  link.href = NEW_NOTE_PAGE;
  link.textContent = "Create Project Note";

  elements.status.append(heading, description, link);
}

function renderErrorState(error) {
  clearElement(elements.folders);
  clearElement(elements.status);

  elements.status.className = "records-message error-state";
  elements.status.hidden = false;

  const heading = document.createElement("strong");
  heading.textContent = "Projects could not be loaded.";

  const description = document.createElement("p");
  description.textContent =
    error.message ||
    "The project service is temporarily unavailable.";

  const retryButton = document.createElement("button");
  retryButton.className = "secondary-button";
  retryButton.type = "button";
  retryButton.textContent = "Try Again";
  retryButton.addEventListener("click", loadProjects);

  elements.status.append(
    heading,
    description,
    retryButton
  );
}

/* =========================================================
   RENDERING
   ========================================================= */

function renderProjects(records) {
  clearElement(elements.folders);

  if (!records.length) {
    renderEmptyState();
    return;
  }

  const groupedProjects = groupByProject(records);

  const sortedProjects = [...groupedProjects.entries()]
    .map(([projectName, notes]) => {
      const sortedNotes = sortNotesByNewest(notes);

      return {
        projectName,
        notes: sortedNotes,
        latestTimestamp: getTimestamp(
          sortedNotes[0]?.createdAt
        )
      };
    })
    .sort((first, second) => {
      return second.latestTimestamp - first.latestTimestamp;
    });

  const projectCount = sortedProjects.length;
  const projectLabel =
    projectCount === 1 ? "project" : "projects";

  showStatus(
    `${projectCount} saved ${projectLabel}`,
    "success-state"
  );

  sortedProjects.forEach(({ projectName, notes }) => {
    elements.folders.appendChild(
      createProjectFolder(projectName, notes)
    );
  });
}

/* =========================================================
   LOADING
   ========================================================= */

async function loadProjects() {
  setRefreshState(true);
  clearElement(elements.folders);
  showStatus("Loading saved projects...", "loading-state");

  try {
    const data = await getJson("/project-notes");
    const records = Array.isArray(data.items)
      ? data.items
      : [];

    renderProjects(records);
  } catch (error) {
    console.error("Projects could not be loaded:", error);
    renderErrorState(error);
  } finally {
    setRefreshState(false);
  }
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeProjectsPage() {
  await window.luxnoteAuth?.initialize();

  elements.refreshButton.addEventListener(
    "click",
    loadProjects
  );

  if (
    window.luxnoteAuth?.getAccessState &&
    !window.luxnoteAuth.getAccessState().canAccess
  ) {
    return;
  }

  loadProjects();
}

initializeProjectsPage();
