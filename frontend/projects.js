const API_BASE_URL = "https://mqg99s0svc.execute-api.us-west-2.amazonaws.com";
const folders = document.getElementById("project-folders");
const status = document.getElementById("projects-status");
const refresh = document.getElementById("refresh-projects");

function formatDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

async function getJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: "application/json" } });
  const text = await response.text();
  let data = text ? JSON.parse(text) : {};
  if (data && typeof data.body === "string") data = JSON.parse(data.body);
  if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status}).`);
  return data;
}

function groupByProject(records) {
  return records.reduce((groups, record) => {
    const key = record.projectName || "Unnamed Project";
    (groups[key] ||= []).push(record);
    return groups;
  }, {});
}

function getProjectCoverUrl(notes) {
  return notes.find((note) => note.coverPhotoUrl)?.coverPhotoUrl || "";
}

function createNoteRow(record) {
  const row = document.createElement("a");
  row.className = "project-note-row";
  row.href = record.recordId ? `report.html?id=${encodeURIComponent(record.recordId)}` : "#";
  row.innerHTML = `
    <span>
      <strong>${record.noteType ? record.noteType.replaceAll("_", " ") : "Project note"}</strong>
      <small>${record.category || "General"} · ${formatDate(record.createdAt)}</small>
    </span>
    <span class="note-priority">${record.priority || "No priority"}</span>
  `;
  return row;
}

function renderProjects(records) {
  folders.replaceChildren();
  if (!records.length) {
    status.textContent = "No saved project notes yet.";
    status.style.display = "block";
    return;
  }

  status.style.display = "none";
  const groups = groupByProject(records);

  Object.entries(groups).forEach(([projectName, notes]) => {
    notes.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const folder = document.createElement("details");
    folder.className = "project-folder-card";

    const coverUrl = getProjectCoverUrl(notes);
    const coverMarkup = coverUrl
      ? `<img src="${coverUrl}" alt="${projectName} cover photo">`
      : "▰";

    const summary = document.createElement("summary");
    summary.innerHTML = `
      <span class="project-cover-thumb ${coverUrl ? "" : "no-cover"}">${coverMarkup}</span>
      <span class="folder-copy">
        <strong>${projectName}</strong>
        <small>${notes[0].clientName || "Private Client"} · ${notes.length} saved ${notes.length === 1 ? "note" : "notes"} · Updated ${formatDate(notes[0].createdAt)}</small>
      </span>
      <span class="folder-arrow">›</span>
    `;

    const list = document.createElement("div");
    list.className = "project-note-list";
    notes.forEach((note) => list.appendChild(createNoteRow(note)));

    folder.append(summary, list);
    folders.appendChild(folder);
  });
}

async function loadProjects() {
  refresh.disabled = true;
  status.style.display = "block";
  status.textContent = "Loading projects.";
  try {
    const data = await getJson("/project-notes");
    renderProjects(Array.isArray(data.items) ? data.items : []);
  } catch (error) {
    status.textContent = error.message;
  } finally {
    refresh.disabled = false;
  }
}

refresh.addEventListener("click", loadProjects);
loadProjects();