window.LUXNOTE_CONFIG = {
  apiBaseUrl: "https://mqg99s0svc.execute-api.us-west-2.amazonaws.com",
  apiPathPrefix: "/private",
  mode: "private",
  authEnabled: true,
  authRequired: true,
  cognitoDomain: "",
  cognitoClientId: "",
  cognitoRedirectUri: "https://luxnote.ai/workspace.html",
  cognitoLogoutUri: "https://luxnote.ai/workspace.html",
  cognitoScopes: "openid email profile",
  allowExternalCoverUrls: false,
  demoNotice: false,
  routes: {
    newNote: "workspace.html#new-note",
    projects: "workspace-projects.html",
    report: "workspace-report.html"
  }
};
