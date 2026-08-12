/* =========================================================
   LuxNote
   Labor intake, assignment, and billing-status tracker
   ========================================================= */

const API_BASE_URL =
  window.LUXNOTE_CONFIG?.apiBaseUrl ||
  "https://mqg99s0svc.execute-api.us-west-2.amazonaws.com";
const API_PATH_PREFIX = window.LUXNOTE_CONFIG?.apiPathPrefix || "";
const REQUEST_TIMEOUT_MS =
  Number(window.LUXNOTE_CONFIG?.requestTimeoutMs) || 30000;

const LABOR_ENTRY_NOTE_TYPE = "project_labor_entry";
const LABOR_STATUS_NOTE_TYPE = "project_labor_status";
const LABOR_MAPPING_NOTE_TYPE = "project_labor_mapping";
const LABOR_NOTE_TYPES = new Set([
  LABOR_ENTRY_NOTE_TYPE,
  LABOR_STATUS_NOTE_TYPE,
  LABOR_MAPPING_NOTE_TYPE
]);

const elements = {
  status: document.getElementById("labor-status"),
  tabs: [...document.querySelectorAll(".labor-tab")],
  panels: [...document.querySelectorAll(".labor-panel")],
  importText: document.getElementById("labor-import-text"),
  parseImport: document.getElementById("parse-import"),
  clearImport: document.getElementById("clear-import"),
  messageTechnician: document.getElementById("message-technician"),
  messageProject: document.getElementById("message-project"),
  messageText: document.getElementById("labor-message-text"),
  extractMessage: document.getElementById("extract-message"),
  manualForm: document.getElementById("manual-labor-form"),
  manualProject: document.getElementById("manual-project"),
  manualTechnician: document.getElementById("manual-technician"),
  manualDate: document.getElementById("manual-date"),
  manualHours: document.getElementById("manual-hours"),
  manualType: document.getElementById("manual-type"),
  manualLocation: document.getElementById("manual-location"),
  manualDescription: document.getElementById("manual-description"),
  reviewSection: document.getElementById("review-section"),
  reviewBody: document.getElementById("labor-review-body"),
  reviewHours: document.getElementById("review-hours"),
  reviewCount: document.getElementById("review-count"),
  saveReviewedLabor: document.getElementById("save-reviewed-labor"),
  discardReview: document.getElementById("discard-review"),
  unbilledBody: document.getElementById("unbilled-body"),
  unbilledHours: document.getElementById("unbilled-hours"),
  unbilledCount: document.getElementById("unbilled-count"),
  selectAllUnbilled: document.getElementById("select-all-unbilled"),
  invoiceReference: document.getElementById("invoice-reference"),
  markInvoiced: document.getElementById("mark-invoiced"),
  exportLabor: document.getElementById("export-labor")
};

let records = [];
let projects = [];
let projectByName = new Map();
let locationMappings = new Map();
let existingFingerprints = new Set();
let laborEntries = [];
let reviewRows = [];

function setStatus(message, type = "") {
  elements.status.textContent = message;
  elements.status.className = type
    ? `records-message ${type}`
    : "records-message";
  elements.status.hidden = false;
}

async function readApiResponse(response) {
  const responseText = await response.text();
  let data = {};

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(
        `The server returned an unreadable response (${response.status}).`
      );
    }
  }

  if (data && typeof data.body === "string") {
    try {
      data = JSON.parse(data.body);
    } catch {
      throw new Error("The server returned malformed labor data.");
    }
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      `The request failed with status ${response.status}.`
    );
  }

  return data;
}

async function apiFetch(path, options = {}) {
  const authHeaders = window.luxnoteAuth
    ? await window.luxnoteAuth.getAuthHeaders()
    : {};
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      `${API_BASE_URL}${API_PATH_PREFIX}${path}`,
      {
        ...options,
        headers: {
          ...authHeaders,
          ...(options.headers || {})
        },
        signal: controller.signal
      }
    );

    return await readApiResponse(response);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The project service took too long to respond.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getJson(path) {
  return apiFetch(path, {
    headers: { Accept: "application/json" }
  });
}

function postJson(path, body) {
  return apiFetch(path, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function parseJsonRecord(record) {
  try {
    const parsed = JSON.parse(record?.projectNotes || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCompact(value) {
  return normalize(value).replace(/\s+/g, "");
}

function parseDateValue(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }

  match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/);
  if (match) {
    let year = match[3] || String(new Date().getFullYear());
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseHoursValue(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return 0;
  }

  const decimal = Number(raw.replace(/[^0-9.]/g, ""));
  if (
    Number.isFinite(decimal) &&
    /^\s*\d+(?:\.\d+)?\s*(?:h|hr|hrs|hour|hours)?\s*$/.test(raw)
  ) {
    return decimal;
  }

  const hoursMinutes = raw.match(
    /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b(?:\s*(\d+)\s*(?:m|min|mins|minute|minutes)\b)?/
  );
  if (hoursMinutes) {
    return Number(hoursMinutes[1]) + (Number(hoursMinutes[2] || 0) / 60);
  }

  const minutes = raw.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/);
  if (minutes) {
    return Number(minutes[1]) / 60;
  }

  const clockDuration = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (clockDuration) {
    return Number(clockDuration[1]) + (Number(clockDuration[2]) / 60);
  }

  return Number.isFinite(decimal) ? decimal : 0;
}

function parseClock(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/\./g, "");
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3] || "";

  if (hour > 24 || minute > 59) {
    return null;
  }

  if (meridiem) {
    hour %= 12;
    if (meridiem === "pm") {
      hour += 12;
    }
  }

  return {
    hours: hour + (minute / 60),
    hasMeridiem: Boolean(meridiem)
  };
}

function calculateClockHours(startValue, endValue) {
  const start = parseClock(startValue);
  const end = parseClock(endValue);

  if (!start || !end) {
    return 0;
  }

  let startHours = start.hours;
  let endHours = end.hours;

  if (!start.hasMeridiem && end.hasMeridiem) {
    if (endHours >= 12 && startHours < 7) {
      startHours += 12;
    }
  }

  if (endHours <= startHours) {
    if (!end.hasMeridiem) {
      endHours += 12;
    } else {
      endHours += 24;
    }
  }

  const difference = endHours - startHours;
  return difference > 0 && difference <= 24 ? difference : 0;
}

function extractHoursFromMessage(text) {
  const normalizedText = String(text || "");

  const explicitHours = normalizedText.match(
    /\b(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i
  );
  if (explicitHours) {
    return Number(explicitHours[1]);
  }

  const ranges = [
    ...normalizedText.matchAll(
      /\b(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)\s*(?:-|–|—|to)\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)/gi
    )
  ];

  let total = 0;
  ranges.forEach((match) => {
    total += calculateClockHours(match[1], match[2]);
  });

  const breakMatch = normalizedText.match(
    /\b(\d+(?:\.\d+)?)\s*(?:min|mins|minute|minutes)\s+(?:lunch|break)\b/i
  );
  if (breakMatch && total > 0) {
    total -= Number(breakMatch[1]) / 60;
  }

  return Math.max(0, total);
}

function makeFingerprint(entry) {
  return [
    normalizeCompact(entry.projectName),
    normalizeCompact(entry.technician),
    entry.workDate || "",
    Number(entry.hours || 0).toFixed(2),
    normalizeCompact(entry.locationLabel),
    normalizeCompact(entry.description).slice(0, 80)
  ].join("|");
}

function isLaborNote(record) {
  return LABOR_NOTE_TYPES.has(record?.noteType);
}

function rebuildCatalog() {
  const groups = new Map();

  records.forEach((record) => {
    if (isLaborNote(record)) {
      return;
    }

    const projectName = String(record.projectName || "").trim();
    if (!projectName) {
      return;
    }

    if (!groups.has(projectName)) {
      groups.set(projectName, {
        projectName,
        clientNames: new Set()
      });
    }

    const clientName = String(record.clientName || "").trim();
    if (clientName && clientName !== "Private Client") {
      groups.get(projectName).clientNames.add(clientName);
    }
  });

  projects = [...groups.values()]
    .map((project) => ({
      projectName: project.projectName,
      clientNames: [...project.clientNames]
    }))
    .sort((a, b) => a.projectName.localeCompare(b.projectName));

  projectByName = new Map(
    projects.map((project) => [project.projectName, project])
  );

  locationMappings = new Map();
  records
    .filter((record) => record.noteType === LABOR_MAPPING_NOTE_TYPE)
    .forEach((record) => {
      const data = parseJsonRecord(record);
      const locationLabel = String(data.locationLabel || "").trim();
      const projectName = String(data.projectName || record.projectName || "").trim();

      if (!locationLabel || !projectByName.has(projectName)) {
        return;
      }

      const key = normalizeCompact(locationLabel);
      if (key && !locationMappings.has(key)) {
        locationMappings.set(key, projectName);
      }
    });

  const statuses = new Map();
  records
    .filter((record) => record.noteType === LABOR_STATUS_NOTE_TYPE)
    .forEach((record) => {
      const data = parseJsonRecord(record);
      const laborRecordId = String(data.laborRecordId || "").trim();
      if (laborRecordId && !statuses.has(laborRecordId)) {
        statuses.set(laborRecordId, data);
      }
    });

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
        billingStatus: status?.billingStatus || data.billingStatus || "unbilled",
        invoiceReference: status?.invoiceReference || data.invoiceReference || ""
      };
    });

  existingFingerprints = new Set(
    laborEntries
      .map((entry) => entry.fingerprint || makeFingerprint(entry))
      .filter(Boolean)
  );
}

function fillProjectSelect(select, selectedProject = "", allowBlank = true) {
  select.replaceChildren();

  if (allowBlank) {
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Needs assignment";
    select.appendChild(blank);
  }

  projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.projectName;
    option.textContent = project.projectName;
    option.selected = project.projectName === selectedProject;
    select.appendChild(option);
  });
}

function matchProject(locationLabel, rawText = "") {
  const locationKey = normalizeCompact(locationLabel);
  const combined = normalizeCompact(`${locationLabel} ${rawText}`);

  if (locationKey && locationMappings.has(locationKey)) {
    return {
      projectName: locationMappings.get(locationKey),
      reason: "remembered location"
    };
  }

  const candidates = [];

  projects.forEach((project) => {
    const names = [project.projectName, ...project.clientNames]
      .map((name) => normalizeCompact(name))
      .filter((name) => name.length >= 4);

    names.forEach((name) => {
      if (combined.includes(name)) {
        candidates.push({
          projectName: project.projectName,
          score: name.length
        });
      }
    });
  });

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length) {
    return {
      projectName: candidates[0].projectName,
      reason: "name match"
    };
  }

  return {
    projectName: "",
    reason: ""
  };
}

function detectDelimiter(line) {
  const candidates = ["\t", ",", "|"];
  const counts = candidates.map((delimiter) => ({
    delimiter,
    count: line.split(delimiter).length - 1
  }));
  counts.sort((a, b) => b.count - a.count);
  return counts[0].count > 0 ? counts[0].delimiter : null;
}

function parseDelimitedLine(line, delimiter) {
  if (delimiter !== ",") {
    return line.split(delimiter).map((value) => value.trim());
  }

  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === delimiter && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

const HEADER_ALIASES = {
  technician: [
    "employee", "employee name", "technician", "tech", "worker", "name", "staff"
  ],
  date: [
    "date", "work date", "day", "shift date"
  ],
  start: [
    "clock in", "clock-in", "in", "start", "start time", "time in"
  ],
  end: [
    "clock out", "clock-out", "out", "end", "end time", "time out"
  ],
  hours: [
    "hours", "total hours", "total", "duration", "worked hours"
  ],
  location: [
    "location", "geofence", "geofence name", "site", "jobsite", "job site",
    "job", "address", "location name"
  ],
  description: [
    "notes", "description", "activity", "detail", "details", "comment", "comments"
  ]
};

function mapHeaders(headers) {
  const normalizedHeaders = headers.map(normalize);
  const mapping = {};

  Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
    const index = normalizedHeaders.findIndex((header) =>
      aliases.some((alias) => header === normalize(alias))
    );

    if (index >= 0) {
      mapping[field] = index;
    }
  });

  return mapping;
}

function hasUsefulHeaders(mapping) {
  return (
    Number.isInteger(mapping.date) &&
    (
      Number.isInteger(mapping.hours) ||
      (Number.isInteger(mapping.start) && Number.isInteger(mapping.end))
    )
  );
}

function rowFromColumns(columns, mapping, rawLine, sourceType) {
  const technician = Number.isInteger(mapping.technician)
    ? columns[mapping.technician] || ""
    : "";
  const workDate = Number.isInteger(mapping.date)
    ? parseDateValue(columns[mapping.date])
    : "";
  const locationLabel = Number.isInteger(mapping.location)
    ? columns[mapping.location] || ""
    : "";
  const description = Number.isInteger(mapping.description)
    ? columns[mapping.description] || ""
    : "";

  let hours = Number.isInteger(mapping.hours)
    ? parseHoursValue(columns[mapping.hours])
    : 0;

  if (!hours && Number.isInteger(mapping.start) && Number.isInteger(mapping.end)) {
    hours = calculateClockHours(
      columns[mapping.start],
      columns[mapping.end]
    );
  }

  const match = matchProject(locationLabel, rawLine);

  return {
    include: true,
    technician: String(technician).trim(),
    workDate,
    hours: Number(hours.toFixed(2)),
    locationLabel: String(locationLabel).trim(),
    projectName: match.projectName,
    laborType: "Project",
    description: String(description).trim(),
    sourceType,
    sourceExcerpt: rawLine.slice(0, 1000),
    rememberMapping: Boolean(locationLabel && match.projectName),
    matchReason: match.reason,
    possibleDuplicate: false
  };
}

function fallbackParseLine(line, sourceType) {
  const dateMatch = line.match(
    /\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?)\b/
  );
  const timeMatches = [
    ...line.matchAll(
      /\b(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)\s*(?:-|–|—|to)\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)/gi
    )
  ];

  let hours = 0;
  timeMatches.forEach((match) => {
    hours += calculateClockHours(match[1], match[2]);
  });

  if (!hours) {
    hours = extractHoursFromMessage(line);
  }

  const chunks = line
    .split(/\t|\||,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)
    .map((value) => value.replace(/^\"|\"$/g, "").trim())
    .filter(Boolean);

  const technician = chunks.find((value) =>
    /[a-z]/i.test(value) &&
    !value.includes("/") &&
    !value.includes(":") &&
    !/\d/.test(value)
  ) || "";

  const match = matchProject("", line);

  return {
    include: true,
    technician,
    workDate: parseDateValue(dateMatch?.[1] || ""),
    hours: Number(hours.toFixed(2)),
    locationLabel: "",
    projectName: match.projectName,
    laborType: "Project",
    description: line.slice(0, 500),
    sourceType,
    sourceExcerpt: line.slice(0, 1000),
    rememberMapping: false,
    matchReason: match.reason,
    possibleDuplicate: false
  };
}

function parseImportedReport(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);

  if (delimiter) {
    const headers = parseDelimitedLine(lines[0], delimiter);
    const mapping = mapHeaders(headers);

    if (hasUsefulHeaders(mapping)) {
      return lines
        .slice(1)
        .map((line) => rowFromColumns(
          parseDelimitedLine(line, delimiter),
          mapping,
          line,
          "geofence report"
        ))
        .filter((row) => row.workDate || row.hours || row.technician);
    }
  }

  return lines
    .map((line) => fallbackParseLine(line, "pasted report"))
    .filter((row) => row.workDate || row.hours || row.technician);
}

function parseTechnicianMessage(text, technician, defaultProject) {
  const raw = String(text || "").trim();
  const dateMatch = raw.match(
    /\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?)\b/
  );
  const matchedProject = matchProject("", raw).projectName;

  return {
    include: true,
    technician: String(technician || "").trim(),
    workDate: parseDateValue(dateMatch?.[1] || ""),
    hours: Number(extractHoursFromMessage(raw).toFixed(2)),
    locationLabel: "",
    projectName: matchedProject || defaultProject || "",
    laborType: "Project",
    description: raw.slice(0, 500),
    sourceType: "technician message",
    sourceExcerpt: raw.slice(0, 1000),
    rememberMapping: false,
    matchReason: matchedProject ? "name match" : "",
    possibleDuplicate: false
  };
}

function flagDuplicates(rows) {
  rows.forEach((row) => {
    const fingerprint = makeFingerprint(row);
    if (existingFingerprints.has(fingerprint)) {
      row.possibleDuplicate = true;
      row.include = false;
    }
  });
  return rows;
}

function addReviewRows(rows) {
  reviewRows = [...reviewRows, ...flagDuplicates(rows)];
  renderReviewRows();
  elements.reviewSection.hidden = !reviewRows.length;

  if (reviewRows.length) {
    elements.reviewSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function updateReviewSummary() {
  const included = reviewRows.filter((row) => row.include);
  const totalHours = included.reduce(
    (sum, row) => sum + (Number(row.hours) || 0),
    0
  );

  elements.reviewHours.textContent = `${totalHours.toFixed(2)} hrs`;
  elements.reviewCount.textContent =
    `${included.length} ${included.length === 1 ? "row" : "rows"}`;
}

function makeCell() {
  return document.createElement("td");
}

function renderReviewRows() {
  elements.reviewBody.replaceChildren();

  reviewRows.forEach((row, index) => {
    const tr = document.createElement("tr");

    const includeCell = makeCell();
    const include = document.createElement("input");
    include.type = "checkbox";
    include.checked = row.include;
    include.setAttribute("aria-label", `Use labor row ${index + 1}`);
    include.addEventListener("change", () => {
      row.include = include.checked;
      updateReviewSummary();
    });
    includeCell.appendChild(include);

    const technicianCell = makeCell();
    const technician = document.createElement("input");
    technician.type = "text";
    technician.value = row.technician;
    technician.maxLength = 120;
    technician.addEventListener("input", () => {
      row.technician = technician.value.trim();
    });
    technicianCell.appendChild(technician);

    const dateCell = makeCell();
    const date = document.createElement("input");
    date.type = "date";
    date.value = row.workDate;
    date.addEventListener("change", () => {
      row.workDate = date.value;
    });
    dateCell.appendChild(date);

    const hoursCell = makeCell();
    const hours = document.createElement("input");
    hours.type = "number";
    hours.min = "0.01";
    hours.max = "24";
    hours.step = "0.01";
    hours.value = row.hours || "";
    hours.addEventListener("input", () => {
      row.hours = Number(hours.value) || 0;
      updateReviewSummary();
    });
    hoursCell.appendChild(hours);

    const locationCell = makeCell();
    const location = document.createElement("input");
    location.type = "text";
    location.value = row.locationLabel;
    location.maxLength = 240;
    location.addEventListener("input", () => {
      row.locationLabel = location.value.trim();
      remember.disabled = !row.locationLabel;
    });
    locationCell.appendChild(location);

    const projectCell = makeCell();
    const project = document.createElement("select");
    project.className = "labor-project-select";
    fillProjectSelect(project, row.projectName, true);
    project.addEventListener("change", () => {
      row.projectName = project.value;
      if (row.locationLabel && project.value) {
        row.rememberMapping = true;
        remember.checked = true;
      }
    });
    projectCell.appendChild(project);

    if (!row.projectName) {
      const warning = document.createElement("span");
      warning.className = "labor-row-warning";
      warning.textContent = "Needs assignment";
      projectCell.appendChild(warning);
    } else if (row.matchReason) {
      const reason = document.createElement("span");
      reason.className = "labor-row-warning";
      reason.textContent = `Matched by ${row.matchReason}`;
      projectCell.appendChild(reason);
    }

    if (row.possibleDuplicate) {
      const duplicate = document.createElement("span");
      duplicate.className = "labor-row-warning labor-row-duplicate";
      duplicate.textContent = "Possible duplicate";
      projectCell.appendChild(duplicate);
    }

    const typeCell = makeCell();
    const type = document.createElement("select");
    ["Project", "Service Call", "Travel", "Nonbillable"].forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = value === row.laborType;
      type.appendChild(option);
    });
    type.addEventListener("change", () => {
      row.laborType = type.value;
    });
    typeCell.appendChild(type);

    const descriptionCell = makeCell();
    const description = document.createElement("input");
    description.type = "text";
    description.value = row.description;
    description.maxLength = 500;
    description.addEventListener("input", () => {
      row.description = description.value.trim();
    });
    descriptionCell.appendChild(description);

    const rememberCell = makeCell();
    const remember = document.createElement("input");
    remember.type = "checkbox";
    remember.checked = row.rememberMapping;
    remember.disabled = !row.locationLabel;
    remember.setAttribute(
      "aria-label",
      `Remember location mapping for row ${index + 1}`
    );
    remember.addEventListener("change", () => {
      row.rememberMapping = remember.checked;
    });
    rememberCell.appendChild(remember);

    tr.append(
      includeCell,
      technicianCell,
      dateCell,
      hoursCell,
      locationCell,
      projectCell,
      typeCell,
      descriptionCell,
      rememberCell
    );
    elements.reviewBody.appendChild(tr);
  });

  updateReviewSummary();
}

function validateReviewRows(rows) {
  for (const row of rows) {
    if (!row.projectName || !projectByName.has(row.projectName)) {
      return "Every selected labor row needs a project.";
    }

    if (!row.technician) {
      return "Every selected labor row needs a technician.";
    }

    if (!row.workDate) {
      return "Every selected labor row needs a work date.";
    }

    if (!(Number(row.hours) > 0 && Number(row.hours) <= 24)) {
      return "Every selected labor row needs a valid hour total between 0 and 24.";
    }
  }

  return "";
}

async function saveLocationMapping(row) {
  if (!row.rememberMapping || !row.locationLabel || !row.projectName) {
    return;
  }

  const key = normalizeCompact(row.locationLabel);
  if (!key || locationMappings.get(key) === row.projectName) {
    return;
  }

  await postJson("/project-notes", {
    clientName: "Private Client",
    projectName: row.projectName,
    noteType: LABOR_MAPPING_NOTE_TYPE,
    source: "labor tracker",
    projectNotes: JSON.stringify({
      locationLabel: row.locationLabel,
      projectName: row.projectName
    }),
    aiProcessingEnabled: false
  });

  locationMappings.set(key, row.projectName);
}

async function saveLaborEntry(row) {
  const fingerprint = makeFingerprint(row);

  const saved = await postJson("/project-notes", {
    clientName: "Private Client",
    projectName: row.projectName,
    noteType: LABOR_ENTRY_NOTE_TYPE,
    source: "labor tracker",
    projectNotes: JSON.stringify({
      technician: row.technician,
      workDate: row.workDate,
      hours: Number(Number(row.hours).toFixed(2)),
      description: row.description || "",
      laborType: row.laborType || "Project",
      billingStatus: "unbilled",
      invoiceReference: "",
      locationLabel: row.locationLabel || "",
      sourceType: row.sourceType || "manual",
      sourceExcerpt: row.sourceExcerpt || "",
      fingerprint
    }),
    aiProcessingEnabled: false
  });

  existingFingerprints.add(fingerprint);
  return saved;
}

async function saveReviewedLabor() {
  const selectedRows = reviewRows.filter((row) => row.include);

  if (!selectedRows.length) {
    setStatus("Select at least one labor row to save.", "error-state");
    return;
  }

  const validationError = validateReviewRows(selectedRows);
  if (validationError) {
    setStatus(validationError, "error-state");
    return;
  }

  elements.saveReviewedLabor.disabled = true;
  const originalLabel = elements.saveReviewedLabor.textContent;

  try {
    for (let index = 0; index < selectedRows.length; index += 1) {
      const row = selectedRows[index];
      elements.saveReviewedLabor.textContent =
        `Saving ${index + 1} of ${selectedRows.length}...`;
      await saveLaborEntry(row);
      await saveLocationMapping(row);
    }

    setStatus(
      `${selectedRows.length} labor ${selectedRows.length === 1 ? "entry" : "entries"} saved as unbilled.`,
      "success-state"
    );
    reviewRows = [];
    renderReviewRows();
    elements.reviewSection.hidden = true;
    await loadLaborData();
  } catch (error) {
    console.error("Labor could not be saved:", error);
    setStatus(
      error.message || "Labor could not be saved.",
      "error-state"
    );
  } finally {
    elements.saveReviewedLabor.disabled = false;
    elements.saveReviewedLabor.textContent = originalLabel;
  }
}

function getUnbilledEntries() {
  return laborEntries
    .filter((entry) => entry.billingStatus !== "invoiced")
    .sort((a, b) => {
      if (a.workDate !== b.workDate) {
        return String(a.workDate || "").localeCompare(String(b.workDate || ""));
      }
      return String(a.projectName || "").localeCompare(String(b.projectName || ""));
    });
}

function renderUnbilledLabor() {
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

  if (!unbilled.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
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

    row.prepend(selectCell);
    elements.unbilledBody.appendChild(row);
  });
}

function getSelectedUnbilledEntries() {
  const selectedIds = new Set(
    [...document.querySelectorAll(".unbilled-select:checked")]
      .map((checkbox) => checkbox.value)
  );

  return getUnbilledEntries().filter((entry) =>
    selectedIds.has(entry.recordId)
  );
}

async function markSelectedInvoiced() {
  const selected = getSelectedUnbilledEntries();

  if (!selected.length) {
    setStatus("Select at least one labor entry to mark invoiced.", "error-state");
    return;
  }

  const invoiceReference = elements.invoiceReference.value.trim();
  const originalLabel = elements.markInvoiced.textContent;
  elements.markInvoiced.disabled = true;

  try {
    for (let index = 0; index < selected.length; index += 1) {
      const entry = selected[index];
      elements.markInvoiced.textContent =
        `Updating ${index + 1} of ${selected.length}...`;

      await postJson("/project-notes", {
        clientName: entry.clientName || "Private Client",
        projectName: entry.projectName,
        noteType: LABOR_STATUS_NOTE_TYPE,
        source: "labor tracker",
        projectNotes: JSON.stringify({
          laborRecordId: entry.recordId,
          billingStatus: "invoiced",
          invoiceReference,
          invoicedAt: new Date().toISOString()
        }),
        aiProcessingEnabled: false
      });
    }

    setStatus(
      `${selected.length} labor ${selected.length === 1 ? "entry" : "entries"} marked invoiced.`,
      "success-state"
    );
    elements.invoiceReference.value = "";
    await loadLaborData();
  } catch (error) {
    console.error("Labor billing status could not be updated:", error);
    setStatus(
      error.message || "Labor billing status could not be updated.",
      "error-state"
    );
  } finally {
    elements.markInvoiced.disabled = false;
    elements.markInvoiced.textContent = originalLabel;
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[,"\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function exportSelectedLabor() {
  const selected = getSelectedUnbilledEntries();

  if (!selected.length) {
    setStatus("Select at least one labor entry to export.", "error-state");
    return;
  }

  const header = [
    "Project",
    "Technician",
    "Work Date",
    "Hours",
    "Labor Type",
    "Description",
    "Location",
    "Billing Status"
  ];

  const rows = selected.map((entry) => [
    entry.projectName,
    entry.technician,
    entry.workDate,
    Number(entry.hours || 0).toFixed(2),
    entry.laborType || "Project",
    entry.description || "",
    entry.locationLabel || "",
    "Unbilled"
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `luxnote-unbilled-labor-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  setStatus(
    `${selected.length} labor ${selected.length === 1 ? "entry" : "entries"} exported.`,
    "success-state"
  );
}

function showPanel(panelId) {
  elements.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.panel === panelId);
  });

  elements.panels.forEach((panel) => {
    const active = panel.id === panelId;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
}

function bindTabs() {
  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      showPanel(tab.dataset.panel);
    });
  });
}

async function loadLaborData() {
  setStatus("Loading labor...", "loading-state");

  try {
    const data = await getJson("/project-notes");
    records = Array.isArray(data.items) ? data.items : [];
    rebuildCatalog();

    fillProjectSelect(elements.messageProject, "", true);
    fillProjectSelect(elements.manualProject, "", true);
    renderUnbilledLabor();

    setStatus(
      `${projects.length} projects available · ${getUnbilledEntries().length} unbilled labor entries`,
      "success-state"
    );
  } catch (error) {
    console.error("Labor data could not be loaded:", error);
    setStatus(
      error.message || "Labor data could not be loaded.",
      "error-state"
    );
  }
}

function bindImport() {
  elements.parseImport.addEventListener("click", () => {
    const text = elements.importText.value.trim();

    if (!text) {
      setStatus("Paste a report before sorting it.", "error-state");
      return;
    }

    const rows = parseImportedReport(text);

    if (!rows.length) {
      setStatus(
        "LuxNote could not find labor rows in that report. Try pasting the report with its header row.",
        "error-state"
      );
      return;
    }

    addReviewRows(rows);
    const matched = rows.filter((row) => row.projectName).length;
    setStatus(
      `${rows.length} rows found. ${matched} matched to projects automatically.`,
      "success-state"
    );
  });

  elements.clearImport.addEventListener("click", () => {
    elements.importText.value = "";
  });
}

function bindMessageExtraction() {
  elements.extractMessage.addEventListener("click", () => {
    const text = elements.messageText.value.trim();

    if (!text) {
      setStatus("Paste a technician message before extracting time.", "error-state");
      return;
    }

    const row = parseTechnicianMessage(
      text,
      elements.messageTechnician.value,
      elements.messageProject.value
    );

    addReviewRows([row]);

    if (!row.hours || !row.workDate) {
      setStatus(
        "I found the message, but the date or hours still needs review before saving.",
        "loading-state"
      );
    } else {
      setStatus(
        `Extracted ${row.hours.toFixed(2)} hours. Review the labor row before saving.`,
        "success-state"
      );
    }
  });
}

function bindManualEntry() {
  elements.manualForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const projectName = elements.manualProject.value;
    const technician = elements.manualTechnician.value.trim();
    const workDate = elements.manualDate.value;
    const hours = Number(elements.manualHours.value);

    if (!projectName || !technician || !workDate || !(hours > 0)) {
      setStatus(
        "Manual labor needs a project, technician, work date, and hours.",
        "error-state"
      );
      return;
    }

    addReviewRows([{
      include: true,
      technician,
      workDate,
      hours,
      locationLabel: elements.manualLocation.value.trim(),
      projectName,
      laborType: elements.manualType.value,
      description: elements.manualDescription.value.trim(),
      sourceType: "manual labor",
      sourceExcerpt: "",
      rememberMapping: Boolean(elements.manualLocation.value.trim()),
      matchReason: "",
      possibleDuplicate: false
    }]);

    elements.manualForm.reset();
    fillProjectSelect(elements.manualProject, "", true);
    setStatus("Manual labor added to review.", "success-state");
  });
}

function bindReviewActions() {
  elements.saveReviewedLabor.addEventListener("click", saveReviewedLabor);

  elements.discardReview.addEventListener("click", () => {
    reviewRows = [];
    renderReviewRows();
    elements.reviewSection.hidden = true;
    setStatus("Labor review cleared.", "success-state");
  });
}

function bindUnbilledActions() {
  elements.selectAllUnbilled.addEventListener("change", () => {
    document
      .querySelectorAll(".unbilled-select")
      .forEach((checkbox) => {
        checkbox.checked = elements.selectAllUnbilled.checked;
      });
  });

  elements.markInvoiced.addEventListener("click", markSelectedInvoiced);
  elements.exportLabor.addEventListener("click", exportSelectedLabor);
}

async function initializeLabor() {
  await window.luxnoteAuth?.initialize();

  if (
    window.luxnoteAuth?.getAccessState &&
    !window.luxnoteAuth.getAccessState().canAccess
  ) {
    return;
  }

  bindTabs();
  bindImport();
  bindMessageExtraction();
  bindManualEntry();
  bindReviewActions();
  bindUnbilledActions();

  await loadLaborData();
}

initializeLabor();
