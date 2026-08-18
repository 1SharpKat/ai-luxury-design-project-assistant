/* =========================================================
   LuxNote
   Project-card labor and billing summary
   ========================================================= */

const LABOR_ENTRY_NOTE_TYPE = "project_labor_entry";
const LABOR_STATUS_NOTE_TYPE = "project_labor_status";
const LABOR_MAPPING_NOTE_TYPE = "project_labor_mapping";
const PROJECT_STEP_NOTE_TYPE = "project_step";
const PROJECT_STEP_STATUS_NOTE_TYPE = "project_step_status";
const PROJECT_NOTE_REVISION_TYPE = "project_note_revision";
const INACTIVE_LABOR_STATUSES = new Set(["voided", "superseded"]);

function isLaborAdministrativeNote(record) {
  return [
    LABOR_ENTRY_NOTE_TYPE,
    LABOR_STATUS_NOTE_TYPE,
    LABOR_MAPPING_NOTE_TYPE,
    PROJECT_NOTE_REVISION_TYPE
  ].includes(record?.noteType);
}

function isBoardHiddenNote(record) {
  return (
    isLaborAdministrativeNote(record) ||
    [
      PROJECT_STEP_NOTE_TYPE,
      PROJECT_STEP_STATUS_NOTE_TYPE
    ].includes(record?.noteType)
  );
}

function parseLaborJson(record) {
  try {
    const parsed = JSON.parse(record?.projectNotes || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function buildLaborStatusMap(notes) {
  const statusByLaborId = new Map();

  notes
    .filter((note) => note.noteType === LABOR_STATUS_NOTE_TYPE)
    .forEach((note) => {
      const data = parseLaborJson(note);
      const laborRecordId = String(data.laborRecordId || "").trim();
      if (laborRecordId && !statusByLaborId.has(laborRecordId)) {
        statusByLaborId.set(laborRecordId, data);
      }
    });

  return statusByLaborId;
}

function daysSinceWorkDate(value) {
  if (!value) {
    return 0;
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(
    0,
    Math.floor((today.getTime() - date.getTime()) / (24 * 60 * 60 * 1000))
  );
}

const buildProjectWithoutLabor = buildProject;

buildProject = function buildProjectWithLabor(projectName, records) {
  const project = buildProjectWithoutLabor(projectName, records);

  const operationalNotes = project.notes.filter(
    (note) => !isLaborAdministrativeNote(note)
  );

  project.latestActivity = operationalNotes[0] || null;
  project.contentNotes = project.contentNotes.filter(
    (note) => !isBoardHiddenNote(note)
  );
  project.latestContentNote = project.contentNotes[0] || null;
  project.priority = project.latestContentNote?.priority || "";

  const statusByLaborId = buildLaborStatusMap(project.notes);
  const laborEntries = project.notes
    .filter((note) => note.noteType === LABOR_ENTRY_NOTE_TYPE)
    .map((note) => {
      const data = parseLaborJson(note);
      const status = statusByLaborId.get(note.recordId);
      return {
        ...data,
        recordId: note.recordId,
        billingStatus:
          status?.billingStatus || data.billingStatus || "unbilled",
        invoiceReference:
          status?.invoiceReference || data.invoiceReference || ""
      };
    })
    .filter((entry) => !INACTIVE_LABOR_STATUSES.has(entry.billingStatus));

  const billableEntries = laborEntries.filter(
    (entry) => entry.laborType !== "Nonbillable"
  );
  const unbilledEntries = billableEntries.filter(
    (entry) => entry.billingStatus === "unbilled"
  );
  const invoicedEntries = billableEntries.filter(
    (entry) => entry.billingStatus === "invoiced"
  );

  project.totalLaborHours = laborEntries.reduce(
    (total, entry) => total + (Number(entry.hours) || 0),
    0
  );
  project.billableLaborHours = billableEntries.reduce(
    (total, entry) => total + (Number(entry.hours) || 0),
    0
  );
  project.unbilledLaborHours = unbilledEntries.reduce(
    (total, entry) => total + (Number(entry.hours) || 0),
    0
  );
  project.invoicedLaborHours = invoicedEntries.reduce(
    (total, entry) => total + (Number(entry.hours) || 0),
    0
  );

  const unbilledDates = unbilledEntries
    .map((entry) => String(entry.workDate || "").trim())
    .filter(Boolean)
    .sort();

  project.oldestUnbilledWorkDate = unbilledDates[0] || "";
  project.oldestUnbilledDays = daysSinceWorkDate(project.oldestUnbilledWorkDate);

  return project;
};

function replaceProjectTitleWithLink(card, project) {
  const existingTitle = card.querySelector(".project-card-title");
  if (!existingTitle) {
    return;
  }

  const link = document.createElement("a");
  link.className = `${existingTitle.className} project-card-title-link`;
  link.href = `project-detail.html?project=${encodeURIComponent(project.projectName)}`;
  link.textContent = project.projectName;
  link.addEventListener("pointerdown", (event) => event.stopPropagation());
  link.addEventListener("click", (event) => event.stopPropagation());
  existingTitle.replaceWith(link);
}

function createLaborSummary(project) {
  const summary = document.createElement("div");
  summary.className = "project-card-labor-summary";

  const heading = document.createElement("div");
  heading.className = "project-card-labor-heading";

  const label = document.createElement("strong");
  label.textContent = "Labor & Billing";

  const total = document.createElement("span");
  total.textContent = `${project.totalLaborHours.toFixed(2)} hrs tracked`;

  heading.append(label, total);

  const values = document.createElement("div");
  values.className = "project-card-labor-values";

  const unbilled = document.createElement("span");
  unbilled.className = project.unbilledLaborHours > 0
    ? "labor-card-value is-unbilled"
    : "labor-card-value";
  unbilled.textContent = `${project.unbilledLaborHours.toFixed(2)} hrs unbilled`;

  const invoiced = document.createElement("span");
  invoiced.className = "labor-card-value";
  invoiced.textContent = `${project.invoicedLaborHours.toFixed(2)} hrs invoiced`;

  values.append(unbilled, invoiced);

  if (project.unbilledLaborHours > 0 && project.oldestUnbilledDays > 0) {
    const age = document.createElement("div");
    age.className = project.oldestUnbilledDays >= 14
      ? "labor-card-age is-aged"
      : "labor-card-age";
    age.textContent =
      `Oldest unbilled labor: ${project.oldestUnbilledDays} days`;
    summary.append(heading, values, age);
  } else {
    summary.append(heading, values);
  }

  return summary;
}

const createProjectCardWithoutLabor = createProjectCard;

createProjectCard = function createProjectCardWithLabor(project) {
  const card = createProjectCardWithoutLabor(project);

  replaceProjectTitleWithLink(card, project);

  const notes = card.querySelector(".board-card-notes");
  if (notes) {
    notes.remove();
  }

  const trackingEditor = card.querySelector(".project-tracking-editor");
  const laborSummary = createLaborSummary(project);

  if (trackingEditor) {
    trackingEditor.insertAdjacentElement("afterend", laborSummary);
  } else {
    card.appendChild(laborSummary);
  }

  const viewRow = document.createElement("div");
  viewRow.className = "project-card-view-row";

  const viewLink = document.createElement("a");
  viewLink.className = "project-card-view-link";
  viewLink.href =
    `project-detail.html?project=${encodeURIComponent(project.projectName)}`;
  viewLink.textContent = "View project details";
  viewLink.addEventListener("pointerdown", (event) => event.stopPropagation());
  viewLink.addEventListener("click", (event) => event.stopPropagation());

  viewRow.appendChild(viewLink);
  card.appendChild(viewRow);

  return card;
};
