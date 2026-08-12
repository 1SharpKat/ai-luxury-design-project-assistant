/* =========================================================
   LuxNote AI
   Lightweight project tracking fields
   ========================================================= */

const TRACKING_NOTE_TYPE = "project_tracking";
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

function isTrackingNote(record) {
  return record?.noteType === TRACKING_NOTE_TYPE;
}

function parseTrackingRecord(record) {
  if (!record || !isTrackingNote(record)) {
    return {
      nextAction: "",
      dueDate: "",
      waitingOn: ""
    };
  }

  try {
    const parsed = JSON.parse(record.projectNotes || "{}");

    return {
      nextAction: String(parsed.nextAction || "").trim(),
      dueDate: String(parsed.dueDate || "").trim(),
      waitingOn: String(parsed.waitingOn || "").trim()
    };
  } catch {
    return {
      nextAction: "",
      dueDate: "",
      waitingOn: ""
    };
  }
}

function formatTrackingDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : formatDate(date);
}

const buildProjectWithoutTracking = buildProject;

buildProject = function buildProjectWithTracking(projectName, records) {
  const project = buildProjectWithoutTracking(projectName, records);
  const trackingRecord = project.notes.find(isTrackingNote) || null;
  const contentNotes = project.notes.filter((note) => {
    return !isStageNote(note) && !isTrackingNote(note);
  });
  const latestContentNote = contentNotes[0] || null;

  project.contentNotes = contentNotes;
  project.latestContentNote = latestContentNote;
  project.priority = latestContentNote?.priority || "";
  project.trackingRecord = trackingRecord;
  project.tracking = parseTrackingRecord(trackingRecord);
  project.clientName =
    latestContentNote?.clientName ||
    trackingRecord?.clientName ||
    project.latestActivity?.clientName ||
    project.clientName;

  return project;
};

function createTrackingLine(label, value) {
  const line = document.createElement("div");
  line.className = "project-tracking-line";

  const heading = document.createElement("strong");
  heading.textContent = label;

  const copy = document.createElement("span");
  copy.textContent = value || "Not set";

  if (!value) {
    copy.classList.add("project-tracking-empty");
  }

  line.append(heading, copy);
  return line;
}

function createTrackingSummary(project) {
  const tracking = project.tracking || {};
  const summary = document.createElement("div");
  summary.className = "project-tracking-summary";

  summary.append(
    createTrackingLine("Next", tracking.nextAction),
    createTrackingLine("Due", formatTrackingDate(tracking.dueDate)),
    createTrackingLine("Waiting", tracking.waitingOn)
  );

  return summary;
}

function createTrackingEditor(project) {
  const tracking = project.tracking || {};
  const details = document.createElement("details");
  details.className = "project-tracking-editor";

  const summary = document.createElement("summary");
  summary.textContent = "Update tracking";

  const form = document.createElement("form");
  form.className = "project-tracking-form";

  const nextActionLabel = document.createElement("label");
  nextActionLabel.textContent = "Next action";

  const nextActionInput = document.createElement("input");
  nextActionInput.type = "text";
  nextActionInput.maxLength = 240;
  nextActionInput.placeholder = "What needs to happen next?";
  nextActionInput.value = tracking.nextAction || "";
  nextActionLabel.appendChild(nextActionInput);

  const dueDateLabel = document.createElement("label");
  dueDateLabel.textContent = "Due date";

  const dueDateInput = document.createElement("input");
  dueDateInput.type = "date";
  dueDateInput.value = tracking.dueDate || "";
  dueDateLabel.appendChild(dueDateInput);

  const waitingOnLabel = document.createElement("label");
  waitingOnLabel.textContent = "Waiting on";

  const waitingOnSelect = document.createElement("select");

  WAITING_ON_OPTIONS.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value || "Nobody / nothing";
    option.selected = value === (tracking.waitingOn || "");
    waitingOnSelect.appendChild(option);
  });

  waitingOnLabel.appendChild(waitingOnSelect);

  const saveButton = document.createElement("button");
  saveButton.className = "secondary-button";
  saveButton.type = "submit";
  saveButton.textContent = "Save Tracking";

  const status = document.createElement("p");
  status.className = "project-tracking-form-status";
  status.setAttribute("aria-live", "polite");

  form.append(
    nextActionLabel,
    dueDateLabel,
    waitingOnLabel,
    saveButton,
    status
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nextTracking = {
      nextAction: nextActionInput.value.trim(),
      dueDate: dueDateInput.value,
      waitingOn: waitingOnSelect.value
    };

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
    status.className = "project-tracking-form-status";
    status.textContent = "Saving project tracking...";

    try {
      const savedRecord = await postJson("/project-notes", {
        clientName: project.clientName,
        projectName: project.projectName,
        noteType: TRACKING_NOTE_TYPE,
        source: "project board",
        projectNotes: JSON.stringify(nextTracking),
        aiProcessingEnabled: false
      });

      project.notes.unshift(savedRecord);
      project.trackingRecord = savedRecord;
      project.tracking = nextTracking;
      project.latestActivity = savedRecord;

      renderBoard();
      showStatus(
        `${project.projectName} tracking updated.`,
        "success-state"
      );
    } catch (error) {
      console.error("Project tracking could not be updated:", error);
      status.className = "project-tracking-form-status error-state";
      status.textContent =
        error.message || "Project tracking could not be saved.";
      saveButton.disabled = false;
      saveButton.textContent = "Save Tracking";
    }
  });

  details.append(summary, form);
  return details;
}

const createProjectCardWithoutTracking = createProjectCard;

createProjectCard = function createProjectCardWithTracking(project) {
  const card = createProjectCardWithoutTracking(project);
  const stageSelect = card.querySelector(".project-stage-select");
  const notes = card.querySelector(".board-card-notes");
  const trackingSummary = createTrackingSummary(project);
  const trackingEditor = createTrackingEditor(project);

  if (stageSelect) {
    stageSelect.insertAdjacentElement("afterend", trackingSummary);
    trackingSummary.insertAdjacentElement("afterend", trackingEditor);
  } else if (notes) {
    notes.insertAdjacentElement("beforebegin", trackingSummary);
    trackingSummary.insertAdjacentElement("afterend", trackingEditor);
  } else {
    card.append(trackingSummary, trackingEditor);
  }

  return card;
};

window.setTimeout(() => {
  if (
    !window.luxnoteAuth?.getAccessState ||
    window.luxnoteAuth.getAccessState().canAccess
  ) {
    loadProjects();
  }
}, 0);
