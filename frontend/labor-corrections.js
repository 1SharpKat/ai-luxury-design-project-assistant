/* =========================================================
   LuxNote
   Labor corrections: edit unbilled entries and back them out
   without destroying the original record.
   ========================================================= */

(function initializeLaborCorrections() {
  const INACTIVE_STATUSES = new Set(["voided", "superseded"]);
  const requestedEditId = String(
    new URLSearchParams(window.location.search).get("edit") || ""
  ).trim();

  const baseRebuildCatalog = rebuildCatalog;
  const baseLoadLaborData = loadLaborData;

  function timestamp(value) {
    const time = new Date(value || 0).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function buildLatestStatusMap() {
    const map = new Map();

    records
      .filter((record) => record.noteType === LABOR_STATUS_NOTE_TYPE)
      .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt))
      .forEach((record) => {
        const data = parseJsonRecord(record);
        const laborRecordId = String(data.laborRecordId || "").trim();
        if (laborRecordId && !map.has(laborRecordId)) {
          map.set(laborRecordId, data);
        }
      });

    return map;
  }

  rebuildCatalog = function rebuildCatalogWithCorrections() {
    baseRebuildCatalog();

    const statuses = buildLatestStatusMap();

    laborEntries = records
      .filter((record) => record.noteType === LABOR_ENTRY_NOTE_TYPE)
      .map((record) => {
        const data = parseJsonRecord(record);
        const status = statuses.get(record.recordId);
        return {
          ...data,
          recordId: record.recordId,
          projectName: record.projectName,
          clientName: record.clientName,
          createdAt: record.createdAt,
          billingStatus:
            status?.billingStatus || data.billingStatus || "unbilled",
          invoiceReference:
            status?.invoiceReference || data.invoiceReference || "",
          correctionStatus: status || null
        };
      });

    existingFingerprints = new Set(
      laborEntries
        .filter((entry) => !INACTIVE_STATUSES.has(entry.billingStatus))
        .map((entry) => entry.fingerprint || makeFingerprint(entry))
        .filter(Boolean)
    );
  };

  getUnbilledEntries = function getCorrectableUnbilledEntries() {
    return laborEntries
      .filter((entry) =>
        entry.billingStatus === "unbilled" &&
        entry.laborType !== "Nonbillable"
      )
      .sort((a, b) => {
        if (a.workDate !== b.workDate) {
          return String(a.workDate || "").localeCompare(String(b.workDate || ""));
        }
        return String(a.projectName || "").localeCompare(String(b.projectName || ""));
      });
  };

  function buildEditor() {
    if (document.getElementById("labor-correction-editor")) {
      return document.getElementById("labor-correction-editor");
    }

    const panel = document.getElementById("unbilled-panel");
    const controls = panel?.querySelector(".labor-invoice-controls");
    if (!panel || !controls) {
      return null;
    }

    const editor = document.createElement("section");
    editor.id = "labor-correction-editor";
    editor.className = "labor-correction-editor";
    editor.hidden = true;
    editor.innerHTML = `
      <div class="labor-correction-heading">
        <div>
          <h3>Edit labor entry</h3>
          <p>Saving creates a corrected replacement and retires the original entry.</p>
        </div>
      </div>
      <div class="labor-correction-grid">
        <label><span>Project</span><select id="correction-project"></select></label>
        <label><span>Technician</span><input id="correction-technician" type="text" maxlength="120"></label>
        <label><span>Work date</span><input id="correction-date" type="date"></label>
        <label><span>Hours</span><input id="correction-hours" type="number" min="0.01" max="24" step="0.01"></label>
        <label><span>Labor type</span>
          <select id="correction-type">
            <option>Project</option>
            <option>Service Call</option>
            <option>Travel</option>
            <option>Nonbillable</option>
          </select>
        </label>
        <label><span>Location</span><input id="correction-location" type="text" maxlength="240"></label>
      </div>
      <label class="labor-correction-description">
        <span>Description / labor note</span>
        <textarea id="correction-description" rows="4" maxlength="1000"></textarea>
      </label>
      <div class="labor-correction-actions">
        <button id="save-labor-correction" class="primary-button" type="button">Save Correction</button>
        <button id="cancel-labor-correction" class="secondary-button" type="button">Cancel</button>
      </div>
    `;

    controls.insertAdjacentElement("afterend", editor);
    return editor;
  }

  const editor = buildEditor();
  let editingRecordId = "";

  function getEditorFields() {
    return {
      project: document.getElementById("correction-project"),
      technician: document.getElementById("correction-technician"),
      workDate: document.getElementById("correction-date"),
      hours: document.getElementById("correction-hours"),
      laborType: document.getElementById("correction-type"),
      location: document.getElementById("correction-location"),
      description: document.getElementById("correction-description"),
      save: document.getElementById("save-labor-correction"),
      cancel: document.getElementById("cancel-labor-correction")
    };
  }

  function closeEditor() {
    editingRecordId = "";
    if (editor) {
      editor.hidden = true;
    }
  }

  function openEditor(entry) {
    if (!editor || !entry) {
      return;
    }

    if (entry.billingStatus !== "unbilled") {
      setStatus(
        "Only unbilled labor can be edited here. Correct the invoice first if the labor has already been invoiced.",
        "error-state"
      );
      return;
    }

    editingRecordId = entry.recordId;
    const fields = getEditorFields();
    fillProjectSelect(fields.project, entry.projectName, false);
    fields.technician.value = entry.technician || "";
    fields.workDate.value = entry.workDate || "";
    fields.hours.value = Number(entry.hours || 0) || "";
    fields.laborType.value = entry.laborType || "Project";
    fields.location.value = entry.locationLabel || "";
    fields.description.value = entry.description || entry.sourceExcerpt || "";
    editor.hidden = false;
    editor.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function saveCorrection() {
    const original = laborEntries.find((entry) => entry.recordId === editingRecordId);
    if (!original) {
      setStatus("That labor entry is no longer available.", "error-state");
      closeEditor();
      return;
    }

    const fields = getEditorFields();
    const corrected = {
      projectName: fields.project.value,
      technician: fields.technician.value.trim(),
      workDate: fields.workDate.value,
      hours: Number(fields.hours.value),
      laborType: fields.laborType.value,
      locationLabel: fields.location.value.trim(),
      description: fields.description.value.trim()
    };

    if (
      !corrected.projectName ||
      !corrected.technician ||
      !corrected.workDate ||
      !(corrected.hours > 0 && corrected.hours <= 24)
    ) {
      setStatus(
        "A correction needs a project, technician, work date, and valid hours.",
        "error-state"
      );
      return;
    }

    fields.save.disabled = true;

    try {
      const replacementPayload = {
        technician: corrected.technician,
        workDate: corrected.workDate,
        hours: Number(corrected.hours.toFixed(2)),
        description: corrected.description,
        laborType: corrected.laborType,
        billingStatus: "unbilled",
        invoiceReference: "",
        locationLabel: corrected.locationLabel,
        sourceType: "labor correction",
        sourceExcerpt: original.sourceExcerpt || original.description || "",
        replacesLaborRecordId: original.recordId
      };
      replacementPayload.fingerprint = makeFingerprint({
        ...replacementPayload,
        projectName: corrected.projectName
      });

      const replacement = await postJson("/project-notes", {
        clientName: original.clientName || "Private Client",
        projectName: corrected.projectName,
        noteType: LABOR_ENTRY_NOTE_TYPE,
        source: "labor correction",
        projectNotes: JSON.stringify(replacementPayload),
        aiProcessingEnabled: false
      });

      const replacementRecordId = String(
        replacement?.recordId || replacement?.item?.recordId || ""
      ).trim();

      await postJson("/project-notes", {
        clientName: original.clientName || "Private Client",
        projectName: original.projectName,
        noteType: LABOR_STATUS_NOTE_TYPE,
        source: "labor correction",
        projectNotes: JSON.stringify({
          laborRecordId: original.recordId,
          billingStatus: "superseded",
          replacementRecordId,
          correctedAt: new Date().toISOString()
        }),
        aiProcessingEnabled: false
      });

      closeEditor();
      setStatus("Labor entry corrected. The original remains in the audit history.", "success-state");
      await loadLaborData();
      window.luxnoteLaborDashboard?.refresh?.();
    } catch (error) {
      console.error("Labor correction failed:", error);
      setStatus(error.message || "Labor correction could not be saved.", "error-state");
    } finally {
      fields.save.disabled = false;
    }
  }

  async function backOutEntry(entry) {
    if (!entry || entry.billingStatus !== "unbilled") {
      return;
    }

    const confirmed = window.confirm(
      `Back out ${Number(entry.hours || 0).toFixed(2)} hours for ${entry.projectName}? The original record will remain in the audit history.`
    );
    if (!confirmed) {
      return;
    }

    try {
      await postJson("/project-notes", {
        clientName: entry.clientName || "Private Client",
        projectName: entry.projectName,
        noteType: LABOR_STATUS_NOTE_TYPE,
        source: "labor correction",
        projectNotes: JSON.stringify({
          laborRecordId: entry.recordId,
          billingStatus: "voided",
          voidedAt: new Date().toISOString()
        }),
        aiProcessingEnabled: false
      });

      setStatus("Labor backed out. The original record remains in the audit history.", "success-state");
      await loadLaborData();
      window.luxnoteLaborDashboard?.refresh?.();
    } catch (error) {
      console.error("Labor could not be backed out:", error);
      setStatus(error.message || "Labor could not be backed out.", "error-state");
    }
  }

  renderUnbilledLabor = function renderCorrectableUnbilledLabor() {
    const unbilled = getUnbilledEntries();
    elements.unbilledBody.replaceChildren();

    const totalHours = unbilled.reduce(
      (sum, entry) => sum + (Number(entry.hours) || 0),
      0
    );

    elements.unbilledHours.textContent = `${totalHours.toFixed(2)} hrs`;
    elements.unbilledCount.textContent =
      `${unbilled.length} ${unbilled.length === 1 ? "entry" : "entries"}`;
    elements.selectAllUnbilled.checked = false;

    const headerRow = elements.unbilledBody
      .closest("table")
      ?.querySelector("thead tr");
    if (headerRow && !headerRow.querySelector(".labor-actions-heading")) {
      const heading = document.createElement("th");
      heading.className = "labor-actions-heading";
      heading.textContent = "Actions";
      headerRow.appendChild(heading);
    }

    if (!unbilled.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 8;
      cell.className = "labor-empty";
      cell.textContent = "No unbilled labor.";
      row.appendChild(cell);
      elements.unbilledBody.appendChild(row);
      return;
    }

    unbilled.forEach((entry) => {
      const row = document.createElement("tr");
      row.dataset.recordId = entry.recordId;

      const selectCell = makeCell();
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "unbilled-select";
      checkbox.value = entry.recordId;
      checkbox.setAttribute(
        "aria-label",
        `Select ${entry.projectName} labor from ${entry.workDate}`
      );
      selectCell.appendChild(checkbox);
      row.appendChild(selectCell);

      [
        entry.projectName,
        entry.technician,
        entry.workDate,
        Number(entry.hours || 0).toFixed(2),
        entry.laborType || "Project",
        entry.description || ""
      ].forEach((value) => {
        const cell = makeCell();
        cell.textContent = value;
        row.appendChild(cell);
      });

      const actionsCell = makeCell();
      const actions = document.createElement("div");
      actions.className = "labor-row-actions";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "secondary-button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => openEditor(entry));

      const backOut = document.createElement("button");
      backOut.type = "button";
      backOut.className = "secondary-button";
      backOut.textContent = "Back Out";
      backOut.addEventListener("click", () => backOutEntry(entry));

      actions.append(edit, backOut);
      actionsCell.appendChild(actions);
      row.appendChild(actionsCell);
      elements.unbilledBody.appendChild(row);
    });
  };

  loadLaborData = async function loadLaborDataWithCorrections() {
    await baseLoadLaborData();

    if (requestedEditId) {
      const entry = laborEntries.find((candidate) => candidate.recordId === requestedEditId);
      if (entry) {
        openEditor(entry);
      }
    }
  };

  const fields = getEditorFields();
  fields?.save?.addEventListener("click", saveCorrection);
  fields?.cancel?.addEventListener("click", closeEditor);

  window.setTimeout(() => {
    rebuildCatalog();
    renderUnbilledLabor();
    if (requestedEditId) {
      const entry = laborEntries.find((candidate) => candidate.recordId === requestedEditId);
      if (entry) {
        openEditor(entry);
      }
    }
  }, 0);
})();
