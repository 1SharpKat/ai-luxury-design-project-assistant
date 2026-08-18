/* =========================================================
   LuxNote
   Editable client and project display identity
   Keeps the internal project key stable so history stays intact.
   ========================================================= */

(function initializeProjectIdentityEditor() {
  const projectKey = String(
    new URLSearchParams(window.location.search).get("project") || ""
  ).trim();

  if (!projectKey) {
    return;
  }

  const hero = document.querySelector(".detail-hero");
  const title = document.getElementById("project-detail-title");
  const client = document.getElementById("project-detail-client");
  const status = document.getElementById("detail-status");
  const addNote = document.getElementById("detail-add-note");
  const laborLink = document.getElementById("detail-labor-link");

  if (!hero || !title || !client) {
    return;
  }

  let allRecords = [];
  let displayProjectName = projectKey;
  let displayClientName = "Private Client";
  let loadingIdentity = false;

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

  function recordsForKey(key, records = allRecords) {
    return records
      .filter((record) => String(record.projectName || "").trim() === key)
      .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
  }

  function identityForKey(key, records = allRecords) {
    const projectRecords = recordsForKey(key, records);
    const trackingRecords = projectRecords.filter(
      (record) => record.noteType === "project_tracking"
    );

    let name = "";
    let clientName = "";

    trackingRecords.forEach((record) => {
      const data = parseJson(record);
      if (!name) {
        name = String(data.displayProjectName || "").trim();
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
      projectKey: key,
      displayProjectName: name || key,
      clientName: clientName || "Private Client"
    };
  }

  function latestTrackingData() {
    const latest = recordsForKey(projectKey).find(
      (record) => record.noteType === "project_tracking"
    );
    const data = parseJson(latest);
    return {
      nextAction: String(data.nextAction || "").trim(),
      dueDate: String(data.dueDate || "").trim(),
      waitingOn: String(data.waitingOn || "").trim()
    };
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function hasProjectNameCollision(nextName) {
    const keys = new Set(
      allRecords
        .map((record) => String(record.projectName || "").trim())
        .filter(Boolean)
    );
    const target = normalize(nextName);

    for (const key of keys) {
      if (key === projectKey) {
        continue;
      }
      const identity = identityForKey(key);
      if (normalize(identity.displayProjectName) === target) {
        return identity.displayProjectName;
      }
    }

    return "";
  }

  function ensureEditor() {
    let form = document.getElementById("project-identity-form");
    if (form) {
      return form;
    }

    form = document.createElement("form");
    form.id = "project-identity-form";
    form.className = "detail-tracking-form project-identity-form";
    form.innerHTML = `
      <label>
        <span>Project name</span>
        <input id="project-identity-name" type="text" maxlength="160" required>
      </label>
      <label>
        <span>Client name</span>
        <input id="project-identity-client" type="text" maxlength="120" placeholder="Private Client">
      </label>
      <div class="project-identity-help">
        <span>Names can change without moving the project's notes, labor, or billing history.</span>
      </div>
      <button id="project-identity-save" class="secondary-button" type="submit">Save Names</button>
    `;

    const progress = document.getElementById("detail-stage-progress");
    if (progress) {
      progress.insertAdjacentElement("beforebegin", form);
    } else {
      hero.appendChild(form);
    }

    form.addEventListener("submit", saveIdentity);
    return form;
  }

  function applyIdentity() {
    const form = ensureEditor();
    const nameInput = form.querySelector("#project-identity-name");
    const clientInput = form.querySelector("#project-identity-client");

    title.textContent = displayProjectName;
    client.textContent =
      displayClientName === "Private Client"
        ? "Project workspace"
        : displayClientName;

    nameInput.value = displayProjectName;
    clientInput.value =
      displayClientName === "Private Client" ? "" : displayClientName;

    const encodedKey = encodeURIComponent(projectKey);
    const encodedDisplay = encodeURIComponent(displayProjectName);
    const encodedClient = encodeURIComponent(displayClientName);

    if (addNote) {
      addNote.href =
        `new-note.html?projectKey=${encodedKey}&project=${encodedDisplay}&client=${encodedClient}`;
    }
    if (laborLink) {
      laborLink.href = `labor.html?project=${encodedKey}&action=paste`;
    }
  }

  const basePostJson = typeof postJson === "function" ? postJson : null;

  if (basePostJson) {
    postJson = function postJsonWithIdentity(path, body) {
      if (
        body?.noteType !== "project_tracking" ||
        String(body.projectName || "").trim() !== projectKey
      ) {
        return basePostJson(path, body);
      }

      let tracking = {};
      try {
        tracking = JSON.parse(body.projectNotes || "{}");
      } catch {
        tracking = {};
      }

      return basePostJson(path, {
        ...body,
        clientName: displayClientName || body.clientName || "Private Client",
        projectNotes: JSON.stringify({
          ...tracking,
          displayProjectName,
          clientName: displayClientName || body.clientName || "Private Client"
        })
      });
    };
  }

  async function getAllRecords() {
    if (typeof getJson === "function") {
      const data = await getJson("/project-notes");
      return Array.isArray(data.items) ? data.items : [];
    }
    return [];
  }

  async function loadIdentity() {
    if (loadingIdentity) {
      return;
    }
    loadingIdentity = true;

    try {
      allRecords = await getAllRecords();
      const identity = identityForKey(projectKey);
      displayProjectName = identity.displayProjectName;
      displayClientName = identity.clientName;
      applyIdentity();
    } catch (error) {
      console.error("Project identity could not be loaded:", error);
    } finally {
      loadingIdentity = false;
    }
  }

  async function saveIdentity(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const nameInput = form.querySelector("#project-identity-name");
    const clientInput = form.querySelector("#project-identity-client");
    const saveButton = form.querySelector("#project-identity-save");

    const nextName = nameInput.value.trim();
    const nextClient = clientInput.value.trim() || "Private Client";

    if (!nextName) {
      nameInput.focus();
      return;
    }

    const collision = hasProjectNameCollision(nextName);
    if (collision) {
      if (status) {
        status.textContent = `Another project is already named “${collision}”. Choose a different project name.`;
        status.className = "records-message error-state";
        status.hidden = false;
      }
      nameInput.focus();
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    const previousName = displayProjectName;
    const previousClient = displayClientName;
    displayProjectName = nextName;
    displayClientName = nextClient;

    try {
      const tracking = latestTrackingData();
      const saved = await postJson("/project-notes", {
        clientName: nextClient,
        projectName: projectKey,
        noteType: "project_tracking",
        source: "project identity",
        projectNotes: JSON.stringify({
          ...tracking,
          displayProjectName: nextName,
          clientName: nextClient
        }),
        aiProcessingEnabled: false
      });

      allRecords.unshift(saved);
      applyIdentity();

      if (status) {
        status.textContent = "Client and project names updated.";
        status.className = "records-message success-state";
        status.hidden = false;
      }
    } catch (error) {
      displayProjectName = previousName;
      displayClientName = previousClient;
      applyIdentity();
      if (status) {
        status.textContent = error.message || "Project names could not be updated.";
        status.className = "records-message error-state";
        status.hidden = false;
      }
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save Names";
    }
  }

  const observer = status
    ? new MutationObserver(() => {
        if (/project loaded/i.test(status.textContent || "")) {
          loadIdentity();
        }
      })
    : null;

  observer?.observe(status, {
    childList: true,
    characterData: true,
    subtree: true
  });

  ensureEditor();
  window.setTimeout(loadIdentity, 0);
})();
