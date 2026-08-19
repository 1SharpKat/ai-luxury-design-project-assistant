/* =========================================================
   LuxNote
   Project-level cover photo editor.
   Uses the existing private S3 upload flow and stores the cover
   on an administrative project record so it does not become a
   visible project note or reset operational activity.
   ========================================================= */

(function initializeProjectCoverEditor() {
  const projectKey = String(
    new URLSearchParams(window.location.search).get("project") || ""
  ).trim();
  const hero = document.querySelector(".detail-hero");

  if (!projectKey || !hero) {
    return;
  }

  const API_BASE_URL =
    window.LUXNOTE_CONFIG?.apiBaseUrl ||
    "https://mqg99s0svc.execute-api.us-west-2.amazonaws.com";
  const API_PATH_PREFIX = window.LUXNOTE_CONFIG?.apiPathPrefix || "";
  const REQUEST_TIMEOUT_MS =
    Number(window.LUXNOTE_CONFIG?.requestTimeoutMs) || 30000;
  const UPLOAD_TIMEOUT_MS =
    Number(window.LUXNOTE_CONFIG?.uploadTimeoutMs) || 60000;
  const MAX_COVER_PHOTO_BYTES = 5 * 1024 * 1024;
  const ALLOWED_COVER_TYPES = new Set(["image/jpeg", "image/png"]);
  const ADMIN_METADATA_NOTE_TYPE = "project_labor_mapping";

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "project-cover-detail.css?v=20260819-project-cover";
  document.head.appendChild(stylesheet);

  const section = document.createElement("section");
  section.className = "detail-cover-photo";
  section.setAttribute("aria-labelledby", "detail-cover-heading");
  section.innerHTML = `
    <div id="detail-cover-preview" class="detail-cover-preview is-empty">
      <span>Loading cover photo...</span>
    </div>
    <div class="detail-cover-copy">
      <p class="eyebrow">Project Image</p>
      <h2 id="detail-cover-heading">Cover photo</h2>
      <p>Add or change the image used on this project's card. This does not create a project note or change the project's activity date.</p>
      <div class="detail-cover-actions">
        <label class="detail-cover-picker">
          <span id="detail-cover-picker-label">Choose Photo</span>
          <input id="detail-cover-input" type="file" accept="image/jpeg,image/png">
        </label>
        <button id="detail-cover-save" class="primary-button" type="button" disabled>Save Cover Photo</button>
      </div>
      <p id="detail-cover-status" class="detail-cover-status" aria-live="polite"></p>
    </div>
  `;

  const pageStatus = document.getElementById("detail-status");
  if (pageStatus) {
    pageStatus.insertAdjacentElement("afterend", section);
  } else {
    hero.prepend(section);
  }

  const preview = document.getElementById("detail-cover-preview");
  const fileInput = document.getElementById("detail-cover-input");
  const pickerLabel = document.getElementById("detail-cover-picker-label");
  const saveButton = document.getElementById("detail-cover-save");
  const localStatus = document.getElementById("detail-cover-status");

  let localPreviewUrl = "";
  let currentCoverUrl = "";

  function setLocalStatus(message = "", type = "") {
    localStatus.textContent = message;
    localStatus.className = type
      ? `detail-cover-status ${type}`
      : "detail-cover-status";
  }

  function clearLocalPreviewUrl() {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      localPreviewUrl = "";
    }
  }

  function renderEmpty(message = "No cover photo yet") {
    preview.className = "detail-cover-preview is-empty";
    preview.replaceChildren();
    const copy = document.createElement("span");
    copy.textContent = message;
    preview.appendChild(copy);
  }

  function renderImage(url, alt) {
    preview.className = "detail-cover-preview";
    const image = document.createElement("img");
    image.src = url;
    image.alt = alt;
    image.addEventListener("error", () => {
      if (url === currentCoverUrl) {
        renderEmpty("Cover photo could not be displayed");
      }
    });
    preview.replaceChildren(image);
  }

  function validateFile(file) {
    if (!file) {
      throw new Error("Choose a cover photo first.");
    }
    if (!ALLOWED_COVER_TYPES.has(file.type)) {
      throw new Error("Cover photo must be a JPG, JPEG, or PNG file.");
    }
    if (file.size > MAX_COVER_PHOTO_BYTES) {
      throw new Error("Cover photo must be 5 MB or smaller.");
    }
  }

  async function getAuthHeaders() {
    await window.luxnoteAuth?.initialize();
    if (
      window.luxnoteAuth?.getAccessState &&
      !window.luxnoteAuth.getAccessState().canAccess
    ) {
      throw new Error("Sign in is required to change a project cover photo.");
    }
    return window.luxnoteAuth
      ? await window.luxnoteAuth.getAuthHeaders()
      : {};
  }

  async function readApiResponse(response) {
    const text = await response.text();
    let data = {};

    if (text) {
      try {
        data = JSON.parse(text);
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
        throw new Error("The server returned malformed project data.");
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
    const authHeaders = await getAuthHeaders();
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

  function timestamp(value) {
    const time = new Date(value || 0).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function parseRecordJson(record) {
    try {
      const parsed = JSON.parse(record?.projectNotes || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function projectRecordsFrom(items) {
    return items
      .filter((record) => String(record.projectName || "").trim() === projectKey)
      .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
  }

  function currentClientName(records) {
    const trackingRecords = records.filter(
      (record) => record.noteType === "project_tracking"
    );

    for (const record of trackingRecords) {
      const data = parseRecordJson(record);
      const value = String(data.clientName || "").trim();
      if (value) {
        return value;
      }
    }

    return String(
      records.find((record) => {
        const value = String(record.clientName || "").trim();
        return value && value !== "Private Client";
      })?.clientName ||
      records[0]?.clientName ||
      "Private Client"
    ).trim() || "Private Client";
  }

  function findCurrentCover(records) {
    return records.find((record) => {
      return (
        (typeof record.coverPhotoUrl === "string" && record.coverPhotoUrl.trim()) ||
        (typeof record.coverPhotoKey === "string" && record.coverPhotoKey.trim())
      );
    }) || null;
  }

  async function getAllRecords() {
    const data = await apiFetch("/project-notes", {
      headers: { Accept: "application/json" }
    });
    return Array.isArray(data.items) ? data.items : [];
  }

  async function loadCurrentCover() {
    const records = projectRecordsFrom(await getAllRecords());
    const coverRecord = findCurrentCover(records);
    currentCoverUrl = String(coverRecord?.coverPhotoUrl || "").trim();

    clearLocalPreviewUrl();
    fileInput.value = "";
    saveButton.disabled = true;

    if (currentCoverUrl) {
      renderImage(currentCoverUrl, "Project cover photo");
      pickerLabel.textContent = "Change Photo";
    } else if (coverRecord?.coverPhotoKey) {
      renderEmpty("Cover photo saved");
      pickerLabel.textContent = "Change Photo";
    } else {
      renderEmpty();
      pickerLabel.textContent = "Choose Photo";
    }
  }

  async function uploadFile(file) {
    const uploadDetails = await apiFetch("/project-cover-upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectName: projectKey,
        fileName: file.name,
        contentType: file.type
      })
    });

    if (!uploadDetails.uploadUrl || !uploadDetails.s3Key) {
      throw new Error("The cover photo service returned incomplete upload information.");
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      UPLOAD_TIMEOUT_MS
    );

    try {
      const response = await fetch(uploadDetails.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(
          `The cover photo upload failed with status ${response.status}.`
        );
      }
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("The cover photo upload took too long.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }

    return uploadDetails;
  }

  async function saveCoverRecord(file, uploadDetails) {
    const allRecords = await getAllRecords();
    const records = projectRecordsFrom(allRecords);
    const clientName = currentClientName(records);

    const body = {
      clientName,
      projectName: projectKey,
      noteType: ADMIN_METADATA_NOTE_TYPE,
      source: "project cover",
      projectNotes: JSON.stringify({
        metadataType: "project_cover",
        updatedAt: new Date().toISOString()
      }),
      aiProcessingEnabled: false,
      coverPhotoKey: uploadDetails.s3Key,
      coverPhotoUrl: uploadDetails.fileUrl || "",
      coverPhotoName: file.name,
      coverPhotoType: file.type
    };

    await apiFetch("/project-notes", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  }

  fileInput.addEventListener("change", () => {
    setLocalStatus();
    clearLocalPreviewUrl();

    const file = fileInput.files?.[0];
    if (!file) {
      saveButton.disabled = true;
      if (currentCoverUrl) {
        renderImage(currentCoverUrl, "Project cover photo");
      } else {
        renderEmpty();
      }
      return;
    }

    try {
      validateFile(file);
    } catch (error) {
      fileInput.value = "";
      saveButton.disabled = true;
      setLocalStatus(error.message, "is-error");
      return;
    }

    localPreviewUrl = URL.createObjectURL(file);
    renderImage(localPreviewUrl, `Preview of ${file.name}`);
    saveButton.disabled = false;
    setLocalStatus("Ready to save this as the project cover photo.");
  });

  saveButton.addEventListener("click", async () => {
    const file = fileInput.files?.[0];

    try {
      validateFile(file);
    } catch (error) {
      setLocalStatus(error.message, "is-error");
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
    fileInput.disabled = true;
    setLocalStatus("Uploading cover photo...");

    try {
      const uploadDetails = await uploadFile(file);
      setLocalStatus("Saving cover photo to the project...");
      await saveCoverRecord(file, uploadDetails);
      await loadCurrentCover();
      setLocalStatus("Cover photo updated.", "is-success");
    } catch (error) {
      console.error("Project cover photo could not be saved:", error);
      setLocalStatus(
        error.message || "The cover photo could not be saved.",
        "is-error"
      );
      saveButton.disabled = false;
    } finally {
      saveButton.textContent = "Save Cover Photo";
      fileInput.disabled = false;
    }
  });

  window.addEventListener("beforeunload", clearLocalPreviewUrl, { once: true });

  window.setTimeout(() => {
    loadCurrentCover().catch((error) => {
      console.error("Project cover photo could not be loaded:", error);
      renderEmpty("Cover photo unavailable");
      setLocalStatus(
        error.message || "The cover photo could not be loaded.",
        "is-error"
      );
    });
  }, 0);
})();
