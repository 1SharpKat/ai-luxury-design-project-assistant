/* =========================================================
   LuxNote
   Five-second project status summary
   ========================================================= */

(function initializeProjectGlance() {
  const params = new URLSearchParams(window.location.search);
  const projectName = String(params.get("project") || "").trim();

  const ui = {
    stage: document.getElementById("glance-stage"),
    step: document.getElementById("glance-step"),
    next: document.getElementById("glance-next-action"),
    waiting: document.getElementById("glance-waiting"),
    due: document.getElementById("glance-due"),
    unbilled: document.getElementById("glance-unbilled"),
    latestDate: document.getElementById("glance-latest-date"),
    latestUpdate: document.getElementById("glance-latest-update"),
    dueCard: document.getElementById("glance-due-card"),
    waitingCard: document.getElementById("glance-waiting-card"),
    unbilledCard: document.getElementById("glance-unbilled-card")
  };

  if (!projectName || !ui.stage || !ui.latestUpdate) {
    return;
  }

  const STAGES = new Map([
    ["design", "Design"],
    ["proposed", "Proposed"],
    ["approved", "Approved"],
    ["purchasing", "Purchasing"],
    ["prewire_rough_in", "Prewire / Rough-In"],
    ["install", "Install"],
    ["trim_finish", "Trim / Finish"],
    ["service_call", "Service Call"],
    ["complete", "Complete"]
  ]);

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
    service: "service_call",
    service_call: "service_call",
    complete: "complete"
  };

  const INTERNAL_TYPES = new Set([
    "project_tracking",
    "project_labor_entry",
    "project_labor_status",
    "project_labor_mapping",
    "project_step",
    "project_step_status",
    "project_note_revision"
  ]);

  function timestamp(value) {
    const time = new Date(value || 0).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function parseJson(record) {
    try {
      const data = JSON.parse(record?.projectNotes || "{}");
      return data && typeof data === "object" ? data : {};
    } catch {
      return {};
    }
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
      return "Not set";
    }
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? String(value) : formatDate(date);
  }

  function latestOfType(records, type) {
    return records.find((record) => record.noteType === type) || null;
  }

  function currentStage(records) {
    const record = records.find((item) =>
      String(item.noteType || "").startsWith("project_stage_")
    );
    if (!record) {
      return "design";
    }
    const stored = String(record.noteType).slice("project_stage_".length);
    return LEGACY_STAGE_MAP[stored] || "design";
  }

  function currentTracking(records) {
    const data = parseJson(latestOfType(records, "project_tracking"));
    return {
      nextAction: String(data.nextAction || "").trim(),
      dueDate: String(data.dueDate || "").trim(),
      waitingOn: String(data.waitingOn || "").trim()
    };
  }

  function currentOpenStep(records) {
    const statuses = new Map();
    records
      .filter((record) => record.noteType === "project_step_status")
      .forEach((record) => {
        const data = parseJson(record);
        const stepId = String(data.stepId || "").trim();
        if (stepId && !statuses.has(stepId)) {
          statuses.set(stepId, String(data.status || "open"));
        }
      });

    const openSteps = records
      .filter((record) => record.noteType === "project_step")
      .map((record) => {
        const data = parseJson(record);
        const stepId = String(data.stepId || record.recordId || "").trim();
        return {
          text: String(data.text || "").trim(),
          status: statuses.get(stepId) || "open",
          createdAt: record.createdAt
        };
      })
      .filter((step) => step.text && step.status !== "done")
      .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));

    return openSteps[0]?.text || "No open step set";
  }

  function revisionMap(records) {
    const map = new Map();
    records
      .filter((record) => record.noteType === "project_note_revision")
      .forEach((record) => {
        const data = parseJson(record);
        const id = String(data.targetRecordId || "").trim();
        if (id && !map.has(id)) {
          map.set(id, String(data.revisedText || ""));
        }
      });
    return map;
  }

  function latestMeaningfulUpdate(records) {
    const revisions = revisionMap(records);
    const note = records.find((record) => {
      const type = String(record.noteType || "");
      return !type.startsWith("project_stage_") && !INTERNAL_TYPES.has(type);
    });

    if (!note) {
      return null;
    }

    return {
      text: revisions.get(note.recordId) || String(note.projectNotes || "").trim(),
      createdAt: note.createdAt
    };
  }

  function laborSummary(records) {
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

    const entries = records
      .filter((record) => record.noteType === "project_labor_entry")
      .map((record) => {
        const data = parseJson(record);
        const status = statuses.get(record.recordId);
        return {
          hours: Number(data.hours) || 0,
          laborType: String(data.laborType || "Project"),
          billingStatus: String(status?.billingStatus || data.billingStatus || "unbilled")
        };
      });

    return entries
      .filter((entry) =>
        entry.laborType !== "Nonbillable" &&
        entry.billingStatus !== "invoiced"
      )
      .reduce((sum, entry) => sum + entry.hours, 0);
  }

  function isPastDue(value) {
    if (!value) {
      return false;
    }
    const due = new Date(`${value}T00:00:00`);
    if (Number.isNaN(due.getTime())) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  }

  function setText(element, value, fallback) {
    if (element) {
      element.textContent = value || fallback;
    }
  }

  async function getRecords() {
    await window.luxnoteAuth?.initialize();
    if (
      window.luxnoteAuth?.getAccessState &&
      !window.luxnoteAuth.getAccessState().canAccess
    ) {
      return [];
    }

    const authHeaders = window.luxnoteAuth
      ? await window.luxnoteAuth.getAuthHeaders()
      : {};
    const response = await fetch(
      `${window.LUXNOTE_CONFIG?.apiBaseUrl || ""}${window.LUXNOTE_CONFIG?.apiPathPrefix || ""}/project-notes`,
      { headers: { Accept: "application/json", ...authHeaders } }
    );

    if (!response.ok) {
      throw new Error("Project summary could not be loaded.");
    }

    let data = await response.json();
    if (data && typeof data.body === "string") {
      data = JSON.parse(data.body);
    }
    return Array.isArray(data.items) ? data.items : [];
  }

  async function load() {
    try {
      const allRecords = await getRecords();
      const records = allRecords
        .filter((record) => String(record.projectName || "").trim() === projectName)
        .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));

      if (!records.length) {
        return;
      }

      const tracking = currentTracking(records);
      const stageId = currentStage(records);
      const update = latestMeaningfulUpdate(records);
      const unbilled = laborSummary(records);

      setText(ui.stage, STAGES.get(stageId), "Design");
      setText(ui.step, currentOpenStep(records), "No open step set");
      setText(ui.next, tracking.nextAction, "No next action set");
      setText(ui.waiting, tracking.waitingOn, "Nobody / nothing");
      setText(ui.due, formatWorkDate(tracking.dueDate), "Not set");
      setText(ui.unbilled, `${unbilled.toFixed(2)} hrs`, "0.00 hrs");
      setText(ui.latestDate, update ? formatDate(update.createdAt) : "No update yet", "No update yet");
      setText(ui.latestUpdate, update?.text, "No project update has been added yet.");

      ui.waitingCard?.classList.toggle("is-alert", Boolean(tracking.waitingOn));
      ui.dueCard?.classList.toggle("is-overdue", isPastDue(tracking.dueDate));
      ui.unbilledCard?.classList.toggle("is-alert", unbilled > 0);
    } catch (error) {
      console.error("At-a-glance project summary failed:", error);
    }
  }

  window.setTimeout(load, 0);
})();
