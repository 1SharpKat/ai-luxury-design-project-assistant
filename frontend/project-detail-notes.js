/* Keep full project note history inside the Project Detail workspace. */

(function renderFullProjectNotesInPlace() {
  const list = document.getElementById("project-notes-list");
  if (!list) {
    return;
  }

  const projectName = String(
    new URLSearchParams(window.location.search).get("project") || ""
  ).trim();

  const internalTypes = new Set([
    "project_tracking",
    "project_labor_entry",
    "project_labor_status",
    "project_labor_mapping",
    "project_step",
    "project_step_status"
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

  async function load() {
    if (!projectName) {
      return;
    }

    await window.luxnoteAuth?.initialize();
    if (
      window.luxnoteAuth?.getAccessState &&
      !window.luxnoteAuth.getAccessState().canAccess
    ) {
      return;
    }

    const headers = window.luxnoteAuth
      ? await window.luxnoteAuth.getAuthHeaders()
      : {};
    const response = await fetch(
      `${window.LUXNOTE_CONFIG?.apiBaseUrl || ""}${window.LUXNOTE_CONFIG?.apiPathPrefix || ""}/project-notes`,
      { headers: { Accept: "application/json", ...headers } }
    );

    if (!response.ok) {
      return;
    }

    let data = await response.json();
    if (data && typeof data.body === "string") {
      data = JSON.parse(data.body);
    }

    const notes = (Array.isArray(data.items) ? data.items : [])
      .filter((record) => {
        const noteType = String(record.noteType || "");
        return (
          String(record.projectName || "").trim() === projectName &&
          !noteType.startsWith("project_stage_") &&
          !internalTypes.has(noteType)
        );
      })
      .sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

    list.replaceChildren();

    if (!notes.length) {
      const empty = document.createElement("p");
      empty.className = "detail-empty";
      empty.textContent = "No project notes yet.";
      list.appendChild(empty);
      return;
    }

    notes.forEach((record) => {
      const item = document.createElement("article");
      item.className = "detail-note";

      const header = document.createElement("div");
      header.className = "detail-note-header";

      const title = document.createElement("strong");
      title.textContent = formatType(record.noteType);

      const date = document.createElement("span");
      date.textContent = formatDate(record.createdAt);

      const copy = document.createElement("p");
      copy.textContent = String(record.projectNotes || "");

      header.append(title, date);
      item.append(header, copy);
      list.appendChild(item);
    });
  }

  window.setTimeout(load, 0);
})();
