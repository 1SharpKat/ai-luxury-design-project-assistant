/* =========================================================
   LuxNote
   Apply labor correction and project-note revision rules
   inside the Project Detail workspace.
   ========================================================= */

(function initializeProjectDetailCorrections() {
  const NOTE_REVISION_TYPE = "project_note_revision";
  const inactiveLaborStatuses = new Set(["voided", "superseded"]);

  const baseGetContentNotes = getContentNotes;
  const baseRenderLabor = renderLabor;

  function timestamp(value) {
    const time = new Date(value || 0).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  getContentNotes = function getContentNotesWithoutRevisions() {
    return baseGetContentNotes().filter(
      (record) => record.noteType !== NOTE_REVISION_TYPE
    );
  };

  getLatestOperationalActivity = function getLatestOperationalActivityWithoutCorrections() {
    return projectRecords.find((record) => {
      return ![
        LABOR_ENTRY_NOTE_TYPE,
        LABOR_STATUS_NOTE_TYPE,
        LABOR_MAPPING_NOTE_TYPE,
        NOTE_REVISION_TYPE
      ].includes(record.noteType);
    }) || null;
  };

  buildLaborStatusMap = function buildLatestLaborStatusMap() {
    const map = new Map();

    projectRecords
      .filter((record) => record.noteType === LABOR_STATUS_NOTE_TYPE)
      .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt))
      .forEach((record) => {
        const data = parseJson(record);
        const laborRecordId = String(data.laborRecordId || "").trim();
        if (laborRecordId && !map.has(laborRecordId)) {
          map.set(laborRecordId, data);
        }
      });

    return map;
  };

  getLaborEntries = function getActiveLaborEntries() {
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
      .filter((entry) => !inactiveLaborStatuses.has(entry.billingStatus))
      .sort((a, b) =>
        String(b.workDate || "").localeCompare(String(a.workDate || ""))
      );
  };

  renderLabor = function renderLaborWithCorrectionLinks() {
    baseRenderLabor();

    const entries = getLaborEntries();
    const rows = [...elements.laborBody.querySelectorAll("tr")];

    rows.forEach((row, index) => {
      const entry = entries[index];
      if (!entry || entry.billingStatus !== "unbilled") {
        return;
      }

      const lastCell = row.lastElementChild;
      if (!lastCell) {
        return;
      }

      const separator = document.createElement("span");
      separator.textContent = lastCell.textContent ? " · " : "";

      const link = document.createElement("a");
      link.className = "detail-text-link";
      link.href =
        `labor.html?project=${encodeURIComponent(projectName)}&edit=${encodeURIComponent(entry.recordId)}`;
      link.textContent = "Edit / back out";

      lastCell.append(separator, link);
    });
  };

  function refreshWhenLoaded(attempt = 0) {
    if (projectRecords.length) {
      renderOverview();
      renderLabor();
      return;
    }

    if (attempt < 40) {
      window.setTimeout(() => refreshWhenLoaded(attempt + 1), 100);
    }
  }

  refreshWhenLoaded();
})();
