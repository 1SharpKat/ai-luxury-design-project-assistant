/* Keep full project note history inside the Project Detail workspace. */

(function loadProjectCorrectionAssets() {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "project-note-edit.css?v=20260817-note-edit";
  document.head.appendChild(stylesheet);

  const script = document.createElement("script");
  script.src = "project-detail-corrections.js?v=20260817-corrections";
  document.body.appendChild(script);
})();

(function renderFullProjectNotesInPlace() {
  const list = document.getElementById("project-notes-list");
  if (!list) {
    return;
  }

  const projectName = String(
    new URLSearchParams(window.location.search).get("project") || ""
  ).trim();
  const revisionType = "project_note_revision";

  const internalTypes = new Set([
    "project_tracking",
    "project_labor_entry",
    "project_labor_status",
    "project_labor_mapping",
    "project_step",
    "project_step_status",
    revisionType
  ]);

  function formatDate(value) {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime())
      ? "Date unavailable"
      : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
  }

  function formatType(value) {
    return String(value || "Project note")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function timestamp(value) {
    const time = new Date(value || 0).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  async function getAuthHeaders() {
    await window.luxnoteAuth?.initialize();
    if (
      window.luxnoteAuth?.getAccessState &&
      !window.luxnoteAuth.getAccessState().canAccess
    ) {
      return null;
    }

    return window.luxnoteAuth
      ? await window.luxnoteAuth.getAuthHeaders()
      : {};
  }

  async function getRecords() {
    const headers = await getAuthHeaders();
    if (!headers) {
      return [];
    }

    const response = await fetch(
      `${window.LUXNOTE_CONFIG?.apiBaseUrl || ""}${window.LUXNOTE_CONFIG?.apiPathPrefix || ""}/project-notes`,
      { headers: { Accept: "application/json", ...headers } }
    );

    if (!response.ok) {
      return [];
    }

    let data = await response.json();
    if (data && typeof data.body === "string") {
      data = JSON.parse(data.body);
    }
    return Array.isArray(data.items) ? data.items : [];
  }

  async function saveRevision(record, revisedText) {
    const headers = await getAuthHeaders();
    if (!headers) {
      throw new Error("Sign in is required to edit project notes.");
    }

    const response = await fetch(
      `${window.LUXNOTE_CONFIG?.apiBaseUrl || ""}${window.LUXNOTE_CONFIG?.apiPathPrefix || ""}/project-notes`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...headers
        },
        body: JSON.stringify({
          clientName: record.clientName || "Private Client",
          projectName,
          noteType: revisionType,
          source: "project note edit",
          projectNotes: JSON.stringify({
            targetRecordId: record.recordId,
            revisedText,
            originalNoteType: record.noteType || "manual_project_notes",
            revisedAt: new Date().toISOString()
          }),
          aiProcessingEnabled: false
        })
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "The note could not be updated.");
    }
  }

  function buildRevisionMap(records) {
    const map = new Map();

    records
      .filter((record) => record.noteType === revisionType)
      .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt))
      .forEach((record) => {
        try {
          const data = JSON.parse(record.projectNotes || "{}");
          const targetRecordId = String(data.targetRecordId || "").trim();
          if (targetRecordId && !map.has(targetRecordId)) {
            map.set(targetRecordId, {
              revisedText: String(data.revisedText || ""),
              revisedAt: data.revisedAt || record.createdAt
            });
          }
        } catch {
          // Ignore malformed revision records and preserve the original note.
        }
      });

    return map;
  }

  function beginEdit(item, record, currentText) {
    if (item.querySelector(".detail-note-edit-textarea")) {
      return;
    }

    const copy = item.querySelector(".detail-note-copy");
    const editButton = item.querySelector(".detail-note-edit-button");
    if (!copy || !editButton) {
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.className = "detail-note-edit-textarea";
    textarea.value = currentText;
    textarea.maxLength = 10000;

    const actions = document.createElement("div");
    actions.className = "detail-note-edit-actions";

    const save = document.createElement("button");
    save.type = "button";
    save.className = "primary-button";
    save.textContent = "Save Edit";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "secondary-button";
    cancel.textContent = "Cancel";

    save.addEventListener("click", async () => {
      const revisedText = textarea.value.trim();
      if (!revisedText) {
        textarea.focus();
        return;
      }

      save.disabled = true;
      try {
        await saveRevision(record, revisedText);
        await load();
      } catch (error) {
        console.error("Project note edit failed:", error);
        save.disabled = false;
      }
    });

    cancel.addEventListener("click", () => {
      textarea.remove();
      actions.remove();
      copy.hidden = false;
      editButton.hidden = false;
    });

    copy.hidden = true;
    editButton.hidden = true;
    actions.append(save, cancel);
    copy.insertAdjacentElement("afterend", textarea);
    textarea.insertAdjacentElement("afterend", actions);
    textarea.focus();
  }

  async function load() {
    if (!projectName) {
      return;
    }

    const allRecords = await getRecords();
    const revisions = buildRevisionMap(allRecords);

    const notes = allRecords
      .filter((record) => {
        const noteType = String(record.noteType || "");
        return (
          String(record.projectName || "").trim() === projectName &&
          !noteType.startsWith("project_stage_") &&
          !internalTypes.has(noteType)
        );
      })
      .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));

    list.replaceChildren();

    if (!notes.length) {
      const empty = document.createElement("p");
      empty.className = "detail-empty";
      empty.textContent = "No project notes yet.";
      list.appendChild(empty);
      return;
    }

    notes.forEach((record) => {
      const revision = revisions.get(record.recordId);
      const currentText = revision?.revisedText || String(record.projectNotes || "");

      const item = document.createElement("article");
      item.className = "detail-note";

      const header = document.createElement("div");
      header.className = "detail-note-header";

      const title = document.createElement("strong");
      title.textContent = formatType(record.noteType);

      const date = document.createElement("span");
      date.textContent = revision
        ? `${formatDate(record.createdAt)} · edited ${formatDate(revision.revisedAt)}`
        : formatDate(record.createdAt);

      const copy = document.createElement("p");
      copy.className = "detail-note-copy";
      copy.textContent = currentText;

      const actions = document.createElement("div");
      actions.className = "detail-note-edit-actions";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "secondary-button detail-note-edit-button";
      edit.textContent = "Edit Note";
      edit.addEventListener("click", () => beginEdit(item, record, currentText));

      actions.appendChild(edit);
      header.append(title, date);
      item.append(header, copy, actions);
      list.appendChild(item);
    });
  }

  window.setTimeout(load, 0);
})();
