window.LUXNOTE_CONFIG = {
  apiBaseUrl: "https://mqg99s0svc.execute-api.us-west-2.amazonaws.com",
  apiPathPrefix: "/private",
  mode: "production",
  authEnabled: true,
  authRequired: true,
  cognitoDomain: "https://us-west-2roh0twsiv.auth.us-west-2.amazoncognito.com",
  cognitoClientId: "73c1ikm2ihli328mv7sdmj3vuu",
  cognitoRedirectUri: "https://www.luxnote.ai/workspace.html",
  cognitoLogoutUri: "https://www.luxnote.ai/workspace.html",
  cognitoScopes: "openid email",
  allowExternalCoverUrls: false,
  allowDelete: true,

  // Core project tracking does not use AI. Keep both values false so ordinary
  // notes, board moves, dates, and project tracking never trigger model calls.
  aiDefaultEnabled: false,
  aiToggleEnabled: false,
  coreProjectMode: true,

  requestTimeoutMs: 30000,
  uploadTimeoutMs: 60000,
  demoNotice: false,
  routes: {
    newNote: "index.html#new-note",
    projects: "projects.html",
    report: "report.html"
  }
};

function applyCoreProjectMode() {
  const aiToggle = document.querySelector(".ai-toggle-field");
  if (aiToggle) {
    aiToggle.hidden = true;
  }

  // The old generated-review panel remains in the codebase for a possible
  // future opt-in tool, but it is not part of the core project workflow.
  const resultsSection = document.getElementById("results-section");
  if (resultsSection) {
    resultsSection.hidden = true;
  }

  const headline = document.querySelector(".advisor-statement-panel h1");
  if (headline) {
    headline.textContent = "Project tracking for luxury design teams.";
  }

  const heroCopy = document.querySelector(".advisor-hero-copy");
  if (heroCopy) {
    heroCopy.textContent =
      "Keep project notes, construction stages, next actions, due dates, and waiting items organized in one private workspace.";
  }

  const workflowSteps = document.querySelectorAll(".hero-system-row span");
  const coreSteps = ["Capture", "Track", "Complete"];
  workflowSteps.forEach((step, index) => {
    if (coreSteps[index]) {
      step.textContent = coreSteps[index];
    }
  });

  const formMessage = document.getElementById("form-message");
  if (formMessage) {
    const normalizeMessage = () => {
      const replacements = new Map([
        [
          "Saving the project details without AI analysis...",
          "Saving the project note..."
        ],
        [
          "Project intelligence and cover photo saved successfully.",
          "Project note and cover photo saved successfully."
        ],
        [
          "Project intelligence saved successfully.",
          "Project note saved successfully."
        ]
      ]);

      const replacement = replacements.get(formMessage.textContent.trim());
      if (replacement) {
        formMessage.textContent = replacement;
      }
    };

    const observer = new MutationObserver(normalizeMessage);
    observer.observe(formMessage, {
      childList: true,
      characterData: true,
      subtree: true
    });
    normalizeMessage();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyCoreProjectMode);
} else {
  applyCoreProjectMode();
}
