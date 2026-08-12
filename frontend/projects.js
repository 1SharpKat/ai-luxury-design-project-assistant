/* =========================================================
   LuxNote AI
   Project Board
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
const ALLOW_DELETE = window.LUXNOTE_CONFIG?.allowDelete === true;
const REQUEST_TIMEOUT_MS =
  Number(window.LUXNOTE_CONFIG?.requestTimeoutMs) || 30000;

const STAGE_NOTE_PREFIX = "project_stage_";
const DEFAULT_STAGE_ID = "planning";

const PROJECT_STAGES = [
  { id: "planning", label: "Planning" },
  { id: "design", label: "Design" },
  { id: "proposal", label: "Proposal" },
  { id: "approved", label: "Approved" },
  { id: "ordered", label: "Ordered" },
  { id: "prewire", label: "Prewire" },
  { id: "trim", label: "Trim" },
  { id: "final_install", label: "Final Install" },
  { id: "programming", label: "Programming" },
  { id: "punch_list", label: "Punch List" },
  { id: "complete", label: "Complete" }
];

const stageById = new Map(
  PROJECT_STAGES.map((stage) => [stage.id, stage])
);

const elements = {
  board: document.getElementById("project-board"),
  status: document.getElementById("projects-status"),
  refreshButton: document.getElementById("refresh-projects")
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium"
});

let projectState = new Map();
let draggedProjectName = "";
const movingProjects = new Set();

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

function isStageNote(record) {
  return (
    typeof record?.noteType === "string" &&
    record.noteType.startsWith(STAGE_NOTE_PREFIX)
  );
}

function getStageIdFromNote(record) {
  if (!isStageNote(record)) {
    return "";
  }

  const stageId = record.noteType.slice(STAGE_NOTE_PREFIX.length);
  return stageById.has(stageId) ? stageId : "";
}

function sortNotesByNewest(notes) {
  return [...notes].sort((first, second) => {
    return (
      getTimestamp(second.createdAt) -
      getTimestamp(first.createdAt)
    );
  });
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
  const authHeaders = window.luxnoteAuth
    ? await window.luxnoteAuth.getAuthHeaders()
    : {};
  const headers = {
    ...authHeaders,
    ...(options.headers || {})
  };
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    response = await fetch(
      `${API_BASE_URL}${API_PATH_PREFIX}${path}`,
      {
        ...options,
        signal: controller.signal,
        headers
      }
    );
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "The project service took too long to respond. Please try again."
      );
    }

    throw new Error(
      "LuxNote AI could not connect to the project service. Check your connection and try again."
    );
  } finally {
    window.clearTimeout(timeoutId);
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

function postJson(path, body) {
  return apiFetch(path, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function groupByProject(records) {
  return records.reduce((groups, record) => {
    const projectName =
      typeof record.projectName === "string" && record.projectName.trim()
        ? record.projectName.trim()
        : "Unnamed Project";

    if (!groups.has(projectName)) {
      groups.set(projectName, []);
    }

    groups.get(projectName).push(record);
    return groups;
  }, new Map());
}

function buildProject(projectName, records) {
  const notes = sortNotesByNewest(records);
  const contentNotes = notes.filter((note) => !isStageNote(note));
  const latestStageNote = notes.find((note) => getStageIdFromNote(note));
  const stageId =
    getStageIdFromNote(latestStageNote) || DEFAULT_STAGE_ID;
  const latestContentNote = contentNotes[0] || null;
  const latestActivity = notes[0] || latestContentNote;
  const clientName =
    latestContentNote?.clientName ||
    latestActivity?.clientName ||
    "Private Client";

  return {
    projectName,
    clientName,
    notes,
    contentNotes,
    stageId,
    latestContentNote,
    latestActivity,
    coverUrl: getProjectCoverUrl(notes),
    priority: latestContentNote?.priority || ""
  };
}

function rebuildProjectState(records) {
  const groupedProjects = groupByProject(records);
  projectState = new Map();

  groupedProjects.forEach((projectNotes, projectName) => {
    projectState.set(
      projectName,
      buildProject(projectName, projectNotes)
    );
  });
}

async function deleteProjectNote(record, button) {
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

  button.disabled = true;
  button.setAttribute("aria-busy", "true");

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
    button.disabled = false;
    button.removeAttribute("aria-busy");
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
    priority.dataset.priority = String(record.priority).toLowerCase();
  }

  reportLink.append(noteDetails, priority);
  row.appendChild(reportLink);

  if (ALLOW_DELETE) {
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
      deleteProjectNote(record, deleteButton);
    });
    row.appendChild(deleteButton);
  } else {
    row.classList.add("is-read-only");
  }

  return row;
}

function createProjectCover(project) {
  const cover = document.createElement("span");
  cover.className = project.coverUrl
    ? "board-project-cover"
    : "board-project-cover no-cover";

  if (!project.coverUrl) {
    cover.textContent = "Photo";
    cover.setAttribute("aria-hidden", "true");
    return cover;
  }

  const image = document.createElement("img");
  image.src = project.coverUrl;
  image.alt = `${project.projectName} cover photo`;
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

function createStageSelect(project) {
  const select = document.createElement("select");
  select.className = "project-stage-select";
  select.setAttribute(
    "aria-label",
    `Stage for ${project.projectName}`
  );

  PROJECT_STAGES.forEach((stage) => {
    const option = document.createElement("option");
    option.value = stage.id;
    option.textContent = stage.label;
    option.selected = stage.id === project.stageId;
    select.appendChild(option);
  });

  select.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });

  select.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  select.addEventListener("change", async () => {
    const previousStageId = project.stageId;
    const nextStageId = select.value;

    if (previousStageId === nextStageId) {
      return;
    }

    select.disabled = true;

    try {
      await moveProjectToStage(project.projectName, nextStageId);
    } catch {
      select.value = previousStageId;
    } finally {
      select.disabled = false;
    }
  });

  return select;
}

function createProjectCard(project) {
  const card = document.createElement("article");
  card.className = "project-board-card";
  card.draggable = true;
  card.dataset.projectName = project.projectName;

  const top = document.createElement("div");
  top.className = "project-card-top";

  const cover = createProjectCover(project);

  const heading = document.createElement("div");
  heading.className = "project-card-heading";

  const title = document.createElement("strong");
  title.className = "project-card-title";
  title.textContent = project.projectName;

  const client = document.createElement("small");
  client.className = "project-card-client";
  client.textContent = project.clientName;

  heading.append(title, client);
  top.append(cover, heading);

  const meta = document.createElement("div");
  meta.className = "project-card-meta";

  const noteCount = document.createElement("span");
  const countLabel = project.contentNotes.length === 1 ? "note" : "notes";
  noteCount.textContent = `${project.contentNotes.length} ${countLabel}`;

  const updated = document.createElement("span");
  updated.textContent = `Updated ${formatDate(project.latestActivity?.createdAt)}`;

  meta.append(noteCount, updated);

  if (project.priority) {
    const priority = document.createElement("span");
    priority.className = "board-priority";
    priority.dataset.priority = String(project.priority).toLowerCase();
    priority.textContent = project.priority;
    meta.appendChild(priority);
  }

  const stageSelect = createStageSelect(project);

  const details = document.createElement("details");
  details.className = "board-card-notes";

  const summary = document.createElement("summary");
  summary.textContent = project.contentNotes.length
    ? `Open project notes (${project.contentNotes.length})`
    : "No project notes yet";

  details.appendChild(summary);

  if (project.contentNotes.length) {
    const noteList = document.createElement("div");
    noteList.className = "project-note-list board-note-list";

    project.contentNotes.forEach((note) => {
      noteList.appendChild(createNoteRow(note));
    });

    details.appendChild(noteList);
  }

  card.append(top, meta, stageSelect, details);

  card.addEventListener("dragstart", (event) => {
    draggedProjectName = project.projectName;
    card.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", project.projectName);
  });

  card.addEventListener("dragend", () => {
    draggedProjectName = "";
    card.classList.remove("is-dragging");
    document
      .querySelectorAll(".board-column.is-drop-target")
      .forEach((column) => column.classList.remove("is-drop-target"));
  });

  return card;
}

function createBoardColumn(stage, projects) {
  const column = document.createElement("section");
  column.className = "board-column";
  column.dataset.stageId = stage.id;
  column.setAttribute("aria-label", `${stage.label} projects`);

  const header = document.createElement("div");
  header.className = "board-column-header";

  const title = document.createElement("h2");
  title.textContent = stage.label;

  const count = document.createElement("span");
  count.className = "board-column-count";
  count.textContent = String(projects.length);
  count.setAttribute(
    "aria-label",
    `${projects.length} projects in ${stage.label}`
  );

  header.append(title, count);

  const cardList = document.createElement("div");
  cardList.className = "board-card-list";

  projects.forEach((project) => {
    cardList.appendChild(createProjectCard(project));
  });

  column.append(header, cardList);

  column.addEventListener("dragover", (event) => {
    if (!draggedProjectName) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    column.classList.add("is-drop-target");
  });

  column.addEventListener("dragleave", (event) => {
    if (!column.contains(event.relatedTarget)) {
      column.classList.remove("is-drop-target");
    }
  });

  column.addEventListener("drop", async (event) => {
    event.preventDefault();
    column.classList.remove("is-drop-target");

    const projectName =
      event.dataTransfer.getData("text/plain") || draggedProjectName;
    const project = projectState.get(projectName);

    if (!project || project.stageId === stage.id) {
      return;
    }

    try {
      await moveProjectToStage(projectName, stage.id);
    } catch {
      // The status message is handled by moveProjectToStage.
    }
  });

  return column;
}

async function moveProjectToStage(projectName, nextStageId) {
  const project = projectState.get(projectName);
  const nextStage = stageById.get(nextStageId);

  if (
    !project ||
    !nextStage ||
    project.stageId === nextStageId ||
    movingProjects.has(projectName)
  ) {
    return;
  }

  movingProjects.add(projectName);
  showStatus(
    `Moving ${projectName} to ${nextStage.label}...`,
    "loading-state"
  );

  try {
    const savedRecord = await postJson("/project-notes", {
      clientName: project.clientName,
      projectName: project.projectName,
      noteType: `${STAGE_NOTE_PREFIX}${nextStageId}`,
      source: "project board",
      projectNotes: `Project moved to ${nextStage.label}.`,
      aiProcessingEnabled: false
    });

    project.notes.unshift(savedRecord);
    project.stageId = nextStageId;
    project.latestActivity = savedRecord;

    renderBoard();
    showStatus(
      `${projectName} moved to ${nextStage.label}.`,
      "success-state"
    );
  } catch (error) {
    console.error("Project stage could not be updated:", error);
    showStatus(
      error.message || "Project stage could not be updated.",
      "error-state"
    );
    throw error;
  } finally {
    movingProjects.delete(projectName);
  }
}

function renderEmptyState() {
  clearElement(elements.board);
  clearElement(elements.status);

  elements.status.className = "records-message empty-state";
  elements.status.hidden = false;

  const heading = document.createElement("strong");
  heading.textContent = "No saved projects yet.";

  const description = document.createElement("p");
  description.textContent =
    "Create a project note and LuxNote will add that project to the board.";

  const link = document.createElement("a");
  link.className = "primary-link";
  link.href = NEW_NOTE_PAGE;
  link.textContent = "Create Project Note";

  elements.status.append(heading, description, link);
}

function renderErrorState(error) {
  clearElement(elements.board);
  clearElement(elements.status);

  elements.status.className = "records-message error-state";
  elements.status.hidden = false;

  const heading = document.createElement("strong");
  heading.textContent = "Project board could not be loaded.";

  const description = document.createElement("p");
  description.textContent =
    error.message || "The project service is temporarily unavailable.";

  const retryButton = document.createElement("button");
  retryButton.className = "secondary-button";
  retryButton.type = "button";
  retryButton.textContent = "Try Again";
  retryButton.addEventListener("click", loadProjects);

  elements.status.append(heading, description, retryButton);
}

function renderBoard() {
  clearElement(elements.board);

  const projects = [...projectState.values()];

  if (!projects.length) {
    renderEmptyState();
    return;
  }

  PROJECT_STAGES.forEach((stage) => {
    const stageProjects = projects
      .filter((project) => project.stageId === stage.id)
      .sort((first, second) => {
        return (
          getTimestamp(second.latestActivity?.createdAt) -
          getTimestamp(first.latestActivity?.createdAt)
        );
      });

    elements.board.appendChild(
      createBoardColumn(stage, stageProjects)
    );
  });

  const completeCount = projects.filter(
    (project) => project.stageId === "complete"
  ).length;
  const activeCount = projects.length - completeCount;

  showStatus(
    `${activeCount} active project${activeCount === 1 ? "" : "s"}` +
      (completeCount ? ` | ${completeCount} complete` : ""),
    "success-state"
  );
}

async function loadProjects() {
  setRefreshState(true);
  clearElement(elements.board);
  showStatus("Loading project board...", "loading-state");

  try {
    const data = await getJson("/project-notes");
    const records = Array.isArray(data.items) ? data.items : [];

    rebuildProjectState(records);
    renderBoard();
  } catch (error) {
    console.error("Projects could not be loaded:", error);
    renderErrorState(error);
  } finally {
    setRefreshState(false);
  }
}

async function initializeProjectsPage() {
  await window.luxnoteAuth?.initialize();

  elements.refreshButton.addEventListener("click", loadProjects);

  if (
    window.luxnoteAuth?.getAccessState &&
    !window.luxnoteAuth.getAccessState().canAccess
  ) {
    return;
  }

  loadProjects();
}

initializeProjectsPage();
