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
  aiDefaultEnabled: false,
  aiToggleEnabled: false,
  coreProjectMode: true,
  requestTimeoutMs: 30000,
  uploadTimeoutMs: 60000,
  demoNotice: false,
  routes: {
    newNote: "new-note.html",
    projects: "workspace-projects.html",
    report: "workspace-report.html"
  }
};

(function lockPrivateWorkspaceUntilAuthenticated() {
  if (!window.LUXNOTE_CONFIG?.authRequired) {
    return;
  }

  const root = document.documentElement;
  root.classList.add("luxnote-private-locked");

  if (!document.getElementById("luxnote-private-lock-style")) {
    const style = document.createElement("style");
    style.id = "luxnote-private-lock-style";
    style.textContent = `
      html.luxnote-private-locked main,
      html.luxnote-private-locked footer {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  const noIndex = document.querySelector('meta[name="robots"]') || document.createElement("meta");
  noIndex.name = "robots";
  noIndex.content = "noindex,nofollow,noarchive";
  if (!noIndex.parentNode) {
    document.head.appendChild(noIndex);
  }

  const watchAuthState = () => {
    if (!window.luxnoteAuth?.getAccessState) {
      window.setTimeout(watchAuthState, 50);
      return;
    }

    const state = window.luxnoteAuth.getAccessState();
    if (state?.canAccess) {
      root.classList.remove("luxnote-private-locked");
      return;
    }

    if (state?.reason !== "not_configured") {
      window.setTimeout(watchAuthState, 100);
    }
  };

  watchAuthState();
})();
