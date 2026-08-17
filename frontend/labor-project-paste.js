/* =========================================================
   LuxNote
   Project-aware pasted labor note workflow
   ========================================================= */

(function initializeProjectLaborPaste() {
  const params = new URLSearchParams(window.location.search);
  const requestedProject = String(params.get("project") || "").trim();
  const requestedAction = String(params.get("action") || "").trim();

  const projectSelect = document.getElementById("message-project");
  const extractButton = document.getElementById("extract-message");
  const messagePanel = document.getElementById("message-panel");
  const messageTab = document.querySelector('[data-panel="message-panel"]');
  const messageText = document.getElementById("labor-message-text");
  const status = document.getElementById("labor-status");

  if (!projectSelect || !extractButton || !messagePanel || !messageTab) {
    return;
  }

  function setLocalStatus(message, type = "error-state") {
    if (!status) {
      return;
    }
    status.textContent = message;
    status.className = `records-message ${type}`;
    status.hidden = false;
  }

  function openPastePanel() {
    document.querySelectorAll(".labor-tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab === messageTab);
    });

    document.querySelectorAll(".labor-panel").forEach((panel) => {
      const active = panel === messagePanel;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  }

  function selectRequestedProject() {
    if (!requestedProject) {
      return false;
    }

    const option = [...projectSelect.options].find(
      (candidate) => candidate.value === requestedProject
    );

    if (!option) {
      return false;
    }

    projectSelect.value = requestedProject;
    return true;
  }

  function waitForProjects(attempt = 0) {
    if (selectRequestedProject()) {
      if (requestedAction === "paste" || requestedProject) {
        openPastePanel();
        window.setTimeout(() => messageText?.focus(), 0);
      }
      return;
    }

    if (attempt < 40) {
      window.setTimeout(() => waitForProjects(attempt + 1), 100);
      return;
    }

    if (requestedProject) {
      setLocalStatus(
        `The project “${requestedProject}” is not available in this workspace. Select a project before extracting labor.`
      );
    }
  }

  if (requestedAction === "paste" || requestedProject) {
    openPastePanel();
    waitForProjects();
  }

  extractButton.addEventListener(
    "click",
    (event) => {
      if (projectSelect.value) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      setLocalStatus("Select a project before extracting the labor note.");
      projectSelect.focus();
    },
    true
  );
})();
