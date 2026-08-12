/* =========================================================
   LuxNote
   Project-card labor summary
   ========================================================= */

const LABOR_ENTRY_NOTE_TYPE = "project_labor_entry";
const LABOR_STATUS_NOTE_TYPE = "project_labor_status";
const LABOR_MAPPING_NOTE_TYPE = "project_labor_mapping";

function isLaborAdministrativeNote(record) {
  return [
    LABOR_ENTRY_NOTE_TYPE,
    LABOR_STATUS_NOTE_TYPE,
    LABOR_MAPPING_NOTE_TYPE
  ].includes(record?.noteType);
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

const buildProjectWithoutLabor = buildProject;

buildProject = function buildProjectWithLabor(projectName, records) {
  const project = buildProjectWithoutLabor(projectName, records);
  const operationalNotes = project.notes.filter(
    (note) => !isLaborAdministrativeNote(note)
  );

  project.latestActivity = operationalNotes[0] || null;
  project.contentNotes = project.contentNotes.filter(
    (note) => !isLaborAdministrativeNote(note)
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
        billingStatus: status?.billingStatus || data.billingStatus || "unbilled"
      };
    });

  project.unbilledLaborHours = laborEntries
    .filter((entry) => (
      entry.billingStatus !== "invoiced" &&
      entry.laborType !== "Nonbillable"
    ))
    .reduce((total, entry) => total + (Number(entry.hours) || 0), 0);

  return project;
};

const createProjectCardWithoutLabor = createProjectCard;

createProjectCard = function createProjectCardWithLabor(project) {
  const card = createProjectCardWithoutLabor(project);

  if (project.unbilledLaborHours > 0) {
    const meta = card.querySelector(".project-card-meta");
    const badge = document.createElement("span");
    badge.className = "labor-unbilled-badge";
    badge.textContent = `${project.unbilledLaborHours.toFixed(2)} hrs unbilled`;

    if (meta) {
      meta.appendChild(badge);
    }
  }

  return card;
};
