const API_BASE_URL = "https://mqg99s0svc.execute-api.us-west-2.amazonaws.com";
const status = document.getElementById("report-status");
const content = document.getElementById("report-content");

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

async function getJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: "application/json" } });
  const text = await response.text();
  let data = text ? JSON.parse(text) : {};
  if (data && typeof data.body === "string") data = JSON.parse(data.body);
  if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status}).`);
  return data;
}

function renderList(id, items, fallback) {
  const list = document.getElementById(id);
  list.replaceChildren();
  (Array.isArray(items) && items.length ? items : [fallback]).forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    list.appendChild(li);
  });
}

function renderTags(items) {
  const box = document.getElementById("report-key-phrases");
  box.replaceChildren();
  (Array.isArray(items) && items.length ? items : ["No key phrases returned"]).forEach((text) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = text;
    box.appendChild(tag);
  });
}

function renderCoverPhoto(record) {
  const coverCard = document.getElementById("report-cover-card");
  const coverImage = document.getElementById("report-cover-image");

  if (!record.coverPhotoUrl) {
    coverCard.classList.add("is-hidden");
    return;
  }

  coverImage.src = record.coverPhotoUrl;
  coverImage.alt = `${record.projectName || "Project"} cover photo`;
  coverCard.classList.remove("is-hidden");
}

function render(record) {
  document.getElementById("report-project-name").textContent = record.projectName || "Unnamed Project";
  document.getElementById("report-client").textContent = record.clientName || "Private Client";
  document.getElementById("report-category").textContent = record.category || "General";
  document.getElementById("report-priority").textContent = record.priority || "Not assigned";
  document.getElementById("report-sentiment").textContent = record.sentiment || "Not analyzed";
  document.getElementById("report-created").textContent = formatDate(record.createdAt);
  document.getElementById("report-summary").textContent = record.summary || "No summary generated.";
  document.getElementById("report-draft").textContent = record.draftMessage || "No draft generated.";
  document.getElementById("report-notes").textContent = record.projectNotes || "Original notes unavailable.";
  renderList("report-next-steps", record.nextSteps, "No next steps returned.");
  renderTags(record.keyPhrases);
  renderCoverPhoto(record);

  status.style.display = "none";
  content.classList.remove("is-hidden");
}

async function loadReport() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    status.textContent = "No report was selected. Return to Projects and choose a note.";
    return;
  }
  try {
    const record = await getJson(`/project-notes/${encodeURIComponent(id)}`);
    render(record);
  } catch (error) {
    status.textContent = error.message;
  }
}

loadReport();