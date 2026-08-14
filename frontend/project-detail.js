/* =========================================================
   LuxNote
   Project detail workspace
   ========================================================= */

const API_BASE_URL =
  window.LUXNOTE_CONFIG?.apiBaseUrl ||
  "https://mqg99s0svc.execute-api.us-west-2.amazonaws.com";
const API_PATH_PREFIX = window.LUXNOTE_CONFIG?.apiPathPrefix || "";
const REQUEST_TIMEOUT_MS =
  Number(window.LUXNOTE_CONFIG?.requestTimeoutMs) || 30000;

const STAGE_NOTE_PREFIX = "project_stage_";
const TRACKING_NOTE_TYPE = "project_tracking";
const LABOR_ENTRY_NOTE_TYPE = "project_labor_entry";
const LABOR_STATUS_NOTE_TYPE = "project_labor_status";
const LABOR_MAPPING_NOTE_TYPE = "project_labor_mapping";
const STEP_NOTE_TYPE = "project_step";
const STEP_STATUS_NOTE_TYPE = "project_step_status";

const PROJECT_STAGES = [
  { id: "design", label: "Design" },
  { id: "proposed", label: "Proposed" },
  { id: "approved", label: "Approved" },
  { id: "purchasing", label: "Purchasing" },
  { id: "prewire_rough_in", label: "Prewire / Rough-In" },
  { id: "install", label: "Install" },
  { id: "trim_finish", label: "Trim / Finish" },
  { id: "complete", label: "Complete" }
];

const LEGACY_STAGE_MAP = {
  planning: "design",
  design: "design",
  proposal: "proposed",
  proposed: "proposed",
  approved: "approved",
  ordered: "purchasing",
  purchasing: "purchasing",
  prewire: "prewire_rough_in",
  prewire_rough_in: "prewire_rough_in",
  final_install: "install",
  install: "install",
  trim: "trim_finish",
  trim_finish: "trim_finish",
  programming: "trim_finish",
  punch_list: "trim_finish",
  complete: "complete"
};

const WAITING_ON_OPTIONS = [
  "",
  "Client",
  "Builder",
  "Designer",
  "Electrician",
  "Vendor",
  "Internal",
  "Other"
];

const INTERNAL_NOTE_TYPES = new Set([
  TRACKING_NOTE_TYPE,
  LABOR_ENTRY_NOTE_TYPE,
  LABOR_STATUS_NOTE_TYPE,
  LABOR_MAPPING_NOTE_TYPE,
  STEP_NOTE_TYPE,
  STEP_STATUS_NOTE_TYPE
]);

const elements = {
  status: document.getElementById("detail-status"),
  title: document.getElementById("project-detail-title"),
  client: document.getElementById("project-detail-client"),
  priority: document.getElementById("detail-priority"),
  lastActivity: document.getElementById("detail-last-activity"),
  stageSelect: document.getElementById("detail-stage-select"),
  stageProgress: document.getElementById("detail-stage-progress"),
  nextAction: document.getElementById("detail-next-action"),
  dueDate: document.getElementById("detail-due-date"),
  waitingOn: document.getElementById("detail-waiting-on"),
  trackingForm: document.getElementById("detail-tracking-form"),
  trackingSave: document.getElementById("detail-tracking-save"),
  stepsList: document.getElementById("project-steps-list"),
  stepForm: document.getElementById("project-step-form"),
  stepInput: document.getElementById("project-step-input"),
  laborTotal: document.getElementById("detail-labor-total"),
  laborUnbilled: document.getElementById("detail-labor-unbilled"),
  laborInvoiced: document.getElementById("detail-labor-invoiced"),
  laborNonbillable: document.getElementById("detail-labor-nonbillable"),
  laborBody: document.getElementById("detail-labor-body"),
  laborLink: document.getElementById("detail-labor-link"),
  notesList: document.getElementById("project-notes-list"),
  addNoteLink: document.getElementById("detail-add-note")
};

const params = new URLSearchParams(window.location.search);
const projectName = String(params.get("project") || "").trim();

let projectRecords = [];
let clientName = "Private Client";

function setStatus(message, type = "") {
  elements.status.textContent = message;
  elements.status.className = type
    ? `records-message ${type}`
    : "records-message";
  elements.status.hidden = false;
}

function parseJson(record) {
  try {
    const parsed = JSON.parse(record?.projectNotes || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDate(value) {
  if (!value) {
    return "Not set";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function formatWorkDate(value) {
  if (!value) {
    return "";
  }
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : formatDate(date);
}

function formatNoteType(value) {
  return String(value || "Project note")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isStageNote(record) {
  return (
    typeof record?.noteType === "string" &&
    record.noteType.startsWith(STAGE_NOTE_PREFIX)
  );
}

function stageIdFromRecord(record) {
  if (!isStageNote(record)) {
    return "";
  }
  const stored = record.noteType.slice(STAGE_NOTE_PREFIX.length);
  return LEGACY_STAGE_MAP[stored] || "";
}

async function readApiResponse(response) {
  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
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

function getJson(path) {
  return apiFetch(path, {
    headers: { Accept: "application/json" }
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

function getCurrentStage() {
  const stageRecord = projectRecords.find((record) => stageIdFromRecord(record));
  return stageIdFromRecord(stageRecord) || "design";
}

function getTracking() {
  const record = projectRecords.find(
    (item) => item.noteType === TRACKING_NOTE_TYPE
  );
  const data = parseJson(record);
  return {
    nextAction: String(data.nextAction || "").trim(),
    dueDate: String(data.dueDate || "").trim(),
    waitingOn: String(data.waitingOn || "").trim()
  };
}

function getContentNotes() {
  return projectRecords.filter((record) => {
    return !isStageNote(record) && !INTERNAL_NOTE_TYPES.has(record.noteType);
  });
}

function getPriority() {
  return getContentNotes().find((record) => record.priority)?.priority || "";
}

function getLatestOperationalActivity() {
  return projectRecords.find((record) => {
    return ![
      LABOR_ENTRY_NOTE_TYPE,
      LABOR_STATUS_NOTE_TYPE,
      LABOR_MAPPING_NOTE_TYPE
    ].includes(record.noteType);
  }) || null;
}

function renderStageProgress(stageId) {
  elements.stageProgress.replaceChildren();
  const currentIndex = Math.max(
    0,
    PROJECT_STAGES.findIndex((stage) => stage.id === stageId)
  );

  PROJECT_STAGES.forEach((stage, index) => {
    const item = document.createElement("div");
    item.className = "detail-stage-item";
    if (index < currentIndex) {
      item.classList.add("is-complete");
    } else if (index === currentIndex) {
      item.classList.add("is-current");
    }

    const marker = document.createElement("span");
    marker.className = "detail-stage-marker";
    marker.textContent = index < currentIndex ? "✓" : String(index + 1);

    const label = document.createElement("span");
    label.textContent = stage.label;

    item.append(marker, label);
    elements.stageProgress.appendChild(item);
  });
}

function fillStageSelect(stageId) {
  elements.stageSelect.replaceChildren();
  PROJECT_STAGES.forEach((stage) => {
    const option = document.createElement("option");
    option.value = stage.id;
    option.textContent = stage.label;
    option.selected = stage.id === stageId;
    elements.stageSelect.appendChild(option);
  });
}

function fillWaitingOn(value) {
  elements.waitingOn.replaceChildren();
  WAITING_ON_OPTIONS.forEach((optionValue) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue || "Nobody / nothing";
    option.selected = optionValue === value;
    elements.waitingOn.appendChild(option);
  });
}

function renderOverview() {
  const stageId = getCurrentStage();
  const tracking = getTracking();
  const priority = getPriority();
  const latest = getLatestOperationalActivity();

  elements.title.textContent = projectName;
  elements.client.textContent =
    clientName === "Private Client" ? "Project workspace" : clientName;
  elements.priority.textContent = priority || "Not assigned";
  elements.priority.dataset.priority = String(priority || "").toLowerCase();
  elements.lastActivity.textContent = latest
    ? formatDate(latest.createdAt)
    : "No activity yet";

  fillStageSelect(stageId);
  renderStageProgress(stageId);
  elements.nextAction.value = tracking.nextAction;
  elements.dueDate.value = tracking.dueDate;
  fillWaitingOn(tracking.waitingOn);

  const encodedProject = encodeURIComponent(projectName);
  const encodedClient = encodeURIComponent(clientName);
  elements.addNoteLink.href =
    `new-note.html?project=${encodedProject}&client=${encodedClient}`;
  elements.laborLink.href = `labor.html?project=${encodedProject}`;
}

function buildStepStatusMap() {
  const map = new Map();

  projectRecords
    .filter((record) => record.noteType === STEP_STATUS_NOTE_TYPE)
    .forEach((record) => {
      const data = parseJson(record);
      const stepId = String(data.stepId || "").trim();
      if (stepId && !map.has(stepId)) {
        map.set(stepId, data);
      }
    });

  return map;
}

function getSteps() {
  const statuses = buildStepStatusMap();

  return projectRecords
    .filter((record) => record.noteType === STEP_NOTE_TYPE)
    .map((record) => {
      const data = parseJson(record);
      const stepId = String(data.stepId || record.recordId || "").trim();
      return {
        stepId,
        text: String(data.text || "").trim(),
        createdAt: record.createdAt,
        status: statuses.get(stepId)?.status || "open"
      };
    })
    .filter((step) => step.stepId && step.text)
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "open" ? -1 : 1;
      }
      return getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
    });
}

function renderSteps() {
  const steps = getSteps();
  elements.stepsList.replaceChildren();

  if (!steps.length) {
    const empty = document.createElement("p");
    empty.className = "detail-empty";
    empty.textContent = "No detailed project steps yet.";
    elements.stepsList.appendChild(empty);
    return;
  }

  steps.forEach((step) => {
    const row = document.createElement("div");
    row.className = "detail-step";
    if (step.status === "done") {
      row.classList.add("is-done");
    }

    const check = document.createElement("button");
    check.type = "button";
    check.className = "detail-step-toggle";
    check.textContent = step.status === "done" ? "✓" : "";
    check.setAttribute(
      "aria-label",
      step.status === "done" ? "Reopen step" : "Mark step complete"
    );
    check.addEventListener("click", async () => {
      check.disabled = true;
      try {
        await postJson("/project-notes", {
          clientName,
          projectName,
          noteType: STEP_STATUS_NOTE_TYPE,
          source: "project detail",
          projectNotes: JSON.stringify({
            stepId: step.stepId,
            status: step.status === "done" ? "open" : "done",
            changedAt: new Date().toISOString()
          }),
          aiProcessingEnabled: false
        });
        await loadProject();
      } catch (error) {
        setStatus(
          error.message || "Project step could not be updated.",
          "error-state"
        );
      } finally {
        check.disabled = false;
      }
    });

    const copy = document.createElement("div");
    copy.className = "detail-step-copy";

    const text = document.createElement("strong");
    text.textContent = step.text;

    const meta = document.createElement("small");
    meta.textContent =
      step.status === "done"
        ? "Complete"
        : `Added ${formatDate(step.createdAt)}`;

    copy.append(text, meta);
    row.append(check, copy);
    elements.stepsList.appendChild(row);
  });
}

function buildLaborStatusMap() {
  const map = new Map();

  projectRecords
    .filter((record) => record.noteType === LABOR_STATUS_NOTE_TYPE)
    .forEach((record) => {
      const data = parseJson(record);
      const laborRecordId = String(data.laborRecordId || "").trim();
      if (laborRecordId && !map.has(laborRecordId)) {
        map.set(laborRecordId, data);
      }
    });

  return map;
}

function getLaborEntries() {
  const statuses = buildLaborStatusMap();

  return projectRecords
    .filter((record) => record.noteType === LABOR_ENTRY_NOTE_TYPE)
    .map((record) => {
      const data = parseJson(record);
      const status = statuses.get(record.recordId);
      return {
        ...data,
        recordId: record.recordId,
        billingStatus:
          status?.billingStatus || data.billingStatus || "unbilled",
        invoiceReference:
          status?.invoiceReference || data.invoiceReference || ""
      };
    })
    .sort((a, b) =>
      String(b.workDate || "").localeCompare(String(a.workDate || ""))
    );
}

function renderLabor() {
  const entries = getLaborEntries();
  const total = entries.reduce(
    (sum, entry) => sum + (Number(entry.hours) || 0),
    0
  );
  const nonbillable = entries
    .filter((entry) => entry.laborType === "Nonbillable")
    .reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
  const unbilled = entries
    .filter((entry) =>
      entry.laborType !== "Nonbillable" &&
      entry.billingStatus !== "invoiced"
    )
    .reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
  const invoiced = entries
    .filter((entry) =>
      entry.laborType !== "Nonbillable" &&
      entry.billingStatus === "invoiced"
    )
    .reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);

  elements.laborTotal.textContent = `${total.toFixed(2)} hrs`;
  elements.laborUnbilled.textContent = `${unbilled.toFixed(2)} hrs`;
  elements.laborInvoiced.textContent = `${invoiced.toFixed(2)} hrs`;
  elements.laborNonbillable.textContent = `${nonbillable.toFixed(2)} hrs`;

  elements.laborBody.replaceChildren();

  if (!entries.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "detail-empty-cell";
    cell.textContent = "No labor has been assigned to this project yet.";
    row.appendChild(cell);
    elements.laborBody.appendChild(row);
    return;
  }

  entries.forEach((entry) => {
    const row = document.createElement("tr");
    const billingLabel =
      entry.laborType === "Nonbillable"
        ? "Nonbillable"
        : entry.billingStatus === "invoiced"
          ? "Invoiced"
          : "Unbilled";

    [
      formatWorkDate(entry.workDate),
      entry.technician || "",
      Number(entry.hours || 0).toFixed(2),
      entry.laborType || "Project",
      billingLabel,
      entry.invoiceReference || entry.description || ""
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    elements.laborBody.appendChild(row);
  });
}

function renderNotes() {
  const notes = getContentNotes();
  elements.notesList.replaceChildren();

  if (!notes.length) {
    const empty = document.createElement("p");
    empty.className = "detail-empty";
    empty.textContent = "No project notes yet.";
    elements.notesList.appendChild(empty);
    return;
  }

  notes.forEach((record) => {
    const item = document.createElement("article");
    item.className = "detail-note";

    const header = document.createElement("div");
    header.className = "detail-note-header";

    const title = document.createElement("strong");
    title.textContent = formatNoteType(record.noteType);

    const date = document.createElement("span");
    date.textContent = formatDate(record.createdAt);

    header.append(title, date);

    const copy = document.createElement("p");
    copy.textContent = String(record.projectNotes || "").slice(0, 600);

    item.append(header, copy);

    if (record.recordId) {
      const link = document.createElement("a");
      link.className = "detail-text-link";
      link.href = `workspace-report.html?id=${encodeURIComponent(record.recordId)}`;
      link.textContent = "Open full note";
      item.appendChild(link);
    }

    elements.notesList.appendChild(item);
  });
}

async function saveTracking(event) {
  event.preventDefault();
  elements.trackingSave.disabled = true;
  elements.trackingSave.textContent = "Saving...";

  try {
    await postJson("/project-notes", {
      clientName,
      projectName,
      noteType: TRACKING_NOTE_TYPE,
      source: "project detail",
      projectNotes: JSON.stringify({
        nextAction: elements.nextAction.value.trim(),
        dueDate: elements.dueDate.value,
        waitingOn: elements.waitingOn.value
      }),
      aiProcessingEnabled: false
    });

    setStatus("Project tracking updated.", "success-state");
    await loadProject();
  } catch (error) {
    setStatus(
      error.message || "Project tracking could not be updated.",
      "error-state"
    );
  } finally {
    elements.trackingSave.disabled = false;
    elements.trackingSave.textContent = "Save Tracking";
  }
}

async function changeStage() {
  const nextStageId = elements.stageSelect.value;
  const currentStageId = getCurrentStage();

  if (!nextStageId || nextStageId === currentStageId) {
    return;
  }

  elements.stageSelect.disabled = true;
  const nextStage = PROJECT_STAGES.find((stage) => stage.id === nextStageId);

  try {
    await postJson("/project-notes", {
      clientName,
      projectName,
      noteType: `${STAGE_NOTE_PREFIX}${nextStageId}`,
      source: "project detail",
      projectNotes: `Project moved to ${nextStage?.label || nextStageId}.`,
      aiProcessingEnabled: false
    });

    setStatus(
      `${projectName} moved to ${nextStage?.label || nextStageId}.`,
      "success-state"
    );
    await loadProject();
  } catch (error) {
    setStatus(
      error.message || "Project stage could not be updated.",
      "error-state"
    );
  } finally {
    elements.stageSelect.disabled = false;
  }
}

async function addStep(event) {
  event.preventDefault();
  const text = elements.stepInput.value.trim();

  if (!text) {
    elements.stepInput.focus();
    return;
  }

  const stepId =
    window.crypto?.randomUUID?.() ||
    `step-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    await postJson("/project-notes", {
      clientName,
      projectName,
      noteType: STEP_NOTE_TYPE,
      source: "project detail",
      projectNotes: JSON.stringify({
        stepId,
        text
      }),
      aiProcessingEnabled: false
    });

    elements.stepInput.value = "";
    setStatus("Project step added.", "success-state");
    await loadProject();
  } catch (error) {
    setStatus(
      error.message || "Project step could not be added.",
      "error-state"
    );
  }
}

async function loadProject() {
  if (!projectName) {
    setStatus("No project was selected.", "error-state");
    elements.title.textContent = "Project not selected";
    return;
  }

  setStatus("Loading project...", "loading-state");

  try {
    const data = await getJson("/project-notes");
    const allRecords = Array.isArray(data.items) ? data.items : [];

    projectRecords = allRecords
      .filter((record) => String(record.projectName || "").trim() === projectName)
      .sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));

    if (!projectRecords.length) {
      throw new Error("That project could not be found.");
    }

    clientName =
      projectRecords.find((record) => {
        const value = String(record.clientName || "").trim();
        return value && value !== "Private Client";
      })?.clientName ||
      projectRecords[0]?.clientName ||
      "Private Client";

    renderOverview();
    renderSteps();
    renderLabor();
    renderNotes();
    setStatus("Project loaded.", "success-state");
  } catch (error) {
    console.error("Project detail could not be loaded:", error);
    setStatus(
      error.message || "Project detail could not be loaded.",
      "error-state"
    );
  }
}

async function initializeProjectDetail() {
  await window.luxnoteAuth?.initialize();

  if (
    window.luxnoteAuth?.getAccessState &&
    !window.luxnoteAuth.getAccessState().canAccess
  ) {
    return;
  }

  elements.trackingForm.addEventListener("submit", saveTracking);
  elements.stageSelect.addEventListener("change", changeStage);
  elements.stepForm.addEventListener("submit", addStep);

  await loadProject();
}

initializeProjectDetail();
