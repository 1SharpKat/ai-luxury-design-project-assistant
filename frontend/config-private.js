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
