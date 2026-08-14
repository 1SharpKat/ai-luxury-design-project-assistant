/* =========================================================
   LuxNote
   Labor and billing dashboard summary
   ========================================================= */

(function initializeLaborDashboardExtension() {
  const statTracked = document.getElementById("labor-stat-tracked");
  const statUnbilled = document.getElementById("labor-stat-unbilled");
  const statInvoiced = document.getElementById("labor-stat-invoiced");
  const statProjects = document.getElementById("labor-stat-projects");
  const billedBody = document.getElementById("billed-labor-body");
  const billedHours = document.getElementById("billed-hours");
  const billedCount = document.getElementById("billed-count");
  const statusElement = document.getElementById("labor-status");

  if (
    !statTracked ||
    !statUnbilled ||
    !statInvoiced ||
    !statProjects ||
    !billedBody
  ) {
    return;
  }

  let refreshInFlight = false;
  let refreshQueued = false;

  function parseJson(record) {
    try {
      const parsed = JSON.parse(record?.projectNotes || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  async function readResponse(response) {
    const text = await response.text();
    let data = text ? JSON.parse(text) : {};
    if (data && typeof data.body === "string") {
      data = JSON.parse(data.body);
    }
    if (!response.ok) {
      throw new Error(
        data.error || data.message || "Labor summary could not be loaded."
      );
    }
    return data;
  }

  async function getRecords() {
    const authHeaders = window.luxnoteAuth
      ? await window.luxnoteAuth.getAuthHeaders()
      : {};
    const response = await fetch(
      `${window.LUXNOTE_CONFIG?.apiBaseUrl || ""}${window.LUXNOTE_CONFIG?.apiPathPrefix || ""}/project-notes`,
      {
        headers: {
          Accept: "application/json",
          ...authHeaders
        }
      }
    );
    const data = await readResponse(response);
    return Array.isArray(data.items) ? data.items : [];
  }

  function buildLabor(records) {
    const statuses = new Map();

    records
      .filter((record) => record.noteType === "project_labor_status")
      .forEach((record) => {
        const data = parseJson(record);
        const id = String(data.laborRecordId || "").trim();
        if (id && !statuses.has(id)) {
          statuses.set(id, data);
        }
      });

    return records
      .filter((record) => record.noteType === "project_labor_entry")
      .map((record) => {
        const data = parseJson(record);
        const status = statuses.get(record.recordId);
        return {
          ...data,
          recordId: record.recordId,
          projectName: record.projectName,
          billingStatus:
            status?.billingStatus || data.billingStatus || "unbilled",
          invoiceReference:
            status?.invoiceReference || data.invoiceReference || "",
          invoicedAt: status?.invoicedAt || ""
        };
      });
  }

  function hours(entries) {
    return entries.reduce(
      (sum, entry) => sum + (Number(entry.hours) || 0),
      0
    );
  }

  function formatDate(value) {
    if (!value) {
      return "";
    }
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium"
    }).format(date);
  }

  function renderHistory(entries) {
    const invoiced = entries
      .filter((entry) =>
        entry.laborType !== "Nonbillable" &&
        entry.billingStatus === "invoiced"
      )
      .sort((a, b) =>
        String(b.workDate || "").localeCompare(String(a.workDate || ""))
      );

    billedBody.replaceChildren();
    billedHours.textContent = `${hours(invoiced).toFixed(2)} hrs`;
    billedCount.textContent =
      `${invoiced.length} ${invoiced.length === 1 ? "entry" : "entries"}`;

    if (!invoiced.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 7;
      cell.className = "labor-empty";
      cell.textContent = "No labor has been marked invoiced yet.";
      row.appendChild(cell);
      billedBody.appendChild(row);
      return;
    }

    invoiced.forEach((entry) => {
      const row = document.createElement("tr");
      [
        entry.projectName || "",
        entry.technician || "",
        formatDate(entry.workDate),
        Number(entry.hours || 0).toFixed(2),
        entry.laborType || "Project",
        entry.invoiceReference || "",
        entry.description || ""
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      billedBody.appendChild(row);
    });
  }

  async function refreshDashboard() {
    if (refreshInFlight) {
      refreshQueued = true;
      return;
    }

    refreshInFlight = true;

    try {
      await window.luxnoteAuth?.initialize();

      if (
        window.luxnoteAuth?.getAccessState &&
        !window.luxnoteAuth.getAccessState().canAccess
      ) {
        return;
      }

      const records = await getRecords();
      const entries = buildLabor(records);
      const billable = entries.filter(
        (entry) => entry.laborType !== "Nonbillable"
      );
      const unbilled = billable.filter(
        (entry) => entry.billingStatus !== "invoiced"
      );
      const invoiced = billable.filter(
        (entry) => entry.billingStatus === "invoiced"
      );
      const projectsWithUnbilled = new Set(
        unbilled.map((entry) => entry.projectName).filter(Boolean)
      );

      statTracked.textContent = `${hours(entries).toFixed(2)} hrs`;
      statUnbilled.textContent = `${hours(unbilled).toFixed(2)} hrs`;
      statInvoiced.textContent = `${hours(invoiced).toFixed(2)} hrs`;
      statProjects.textContent = String(projectsWithUnbilled.size);

      renderHistory(entries);
    } catch (error) {
      console.error("Labor dashboard summary could not be loaded:", error);
    } finally {
      refreshInFlight = false;
      if (refreshQueued) {
        refreshQueued = false;
        refreshDashboard();
      }
    }
  }

  if (statusElement) {
    const observer = new MutationObserver(() => {
      const text = statusElement.textContent || "";
      if (
        /saved as unbilled|marked invoiced|labor entries saved|project.*available/i.test(text)
      ) {
        refreshDashboard();
      }
    });

    observer.observe(statusElement, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  window.luxnoteLaborDashboard = {
    refresh: refreshDashboard
  };

  window.setTimeout(refreshDashboard, 0);
})();
