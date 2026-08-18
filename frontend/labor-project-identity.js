/* =========================================================
   LuxNote
   Display edited project/client names in Labor & Billing while
   retaining the stable internal project key for saved records.
   ========================================================= */

(function initializeLaborProjectIdentity() {
  if (
    typeof rebuildCatalog !== "function" ||
    typeof fillProjectSelect !== "function"
  ) {
    return;
  }

  function timestamp(value) {
    const time = new Date(value || 0).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function parseJson(record) {
    try {
      const parsed = JSON.parse(record?.projectNotes || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function identityForProject(projectKey) {
    const projectRecords = records
      .filter((record) => String(record.projectName || "").trim() === projectKey)
      .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));

    const tracking = projectRecords.filter(
      (record) => record.noteType === "project_tracking"
    );

    let displayProjectName = "";
    let clientName = "";

    tracking.forEach((record) => {
      const data = parseJson(record);
      if (!displayProjectName) {
        displayProjectName = String(data.displayProjectName || "").trim();
      }
      if (!clientName) {
        clientName = String(data.clientName || "").trim();
      }
    });

    if (!clientName) {
      clientName = String(
        projectRecords.find((record) => {
          const value = String(record.clientName || "").trim();
          return value && value !== "Private Client";
        })?.clientName || ""
      ).trim();
    }

    return {
      displayProjectName: displayProjectName || projectKey,
      clientName: clientName || "Private Client"
    };
  }

  function applyProjectIdentities() {
    projects.forEach((project) => {
      const identity = identityForProject(project.projectName);
      project.displayProjectName = identity.displayProjectName;
      project.clientName = identity.clientName;

      if (!project.clientNames.includes(identity.displayProjectName)) {
        project.clientNames.push(identity.displayProjectName);
      }
      if (
        identity.clientName !== "Private Client" &&
        !project.clientNames.includes(identity.clientName)
      ) {
        project.clientNames.push(identity.clientName);
      }
    });
  }

  window.luxnoteProjectDisplayName = function getProjectDisplayName(projectKey) {
    return projectByName.get(projectKey)?.displayProjectName || projectKey;
  };

  const baseRebuildCatalog = rebuildCatalog;
  rebuildCatalog = function rebuildCatalogWithProjectIdentity() {
    baseRebuildCatalog();
    applyProjectIdentities();
  };

  const baseFillProjectSelect = fillProjectSelect;
  fillProjectSelect = function fillProjectSelectWithIdentity(
    select,
    selectedProject = "",
    allowBlank = true
  ) {
    baseFillProjectSelect(select, selectedProject, allowBlank);
    [...select.options].forEach((option) => {
      if (!option.value) {
        return;
      }
      option.textContent = window.luxnoteProjectDisplayName(option.value);
    });
  };

  function relabelUnbilledRows() {
    document.querySelectorAll("#unbilled-body tr[data-record-id]").forEach((row) => {
      const entry = laborEntries.find(
        (candidate) => candidate.recordId === row.dataset.recordId
      );
      if (!entry) {
        return;
      }
      const projectCell = row.children[1];
      if (projectCell) {
        projectCell.textContent = window.luxnoteProjectDisplayName(entry.projectName);
      }
    });
  }

  const baseRenderUnbilledLabor = renderUnbilledLabor;
  renderUnbilledLabor = function renderUnbilledLaborWithIdentity() {
    baseRenderUnbilledLabor();
    relabelUnbilledRows();
  };

  const billedBody = document.getElementById("billed-labor-body");
  const relabelBillingHistory = () => {
    billedBody?.querySelectorAll("tr").forEach((row) => {
      const cell = row.children[0];
      if (!cell) {
        return;
      }
      const key = String(cell.textContent || "").trim();
      if (projectByName.has(key)) {
        cell.textContent = window.luxnoteProjectDisplayName(key);
      }
    });
  };

  if (billedBody) {
    new MutationObserver(relabelBillingHistory).observe(billedBody, {
      childList: true,
      subtree: true
    });
  }

  rebuildCatalog();
  fillProjectSelect(elements.messageProject, elements.messageProject.value, true);
  fillProjectSelect(elements.manualProject, elements.manualProject.value, true);
  renderUnbilledLabor();
  relabelBillingHistory();
})();
