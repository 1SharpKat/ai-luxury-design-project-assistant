/* =========================================================
   LuxNote AI
   Optional Cognito Hosted UI Auth
   ========================================================= */

(function initializeLuxNoteAuth() {
  const config = window.LUXNOTE_CONFIG || {};
  const tokenKey = "luxnote.auth.tokens";
  const verifierKey = "luxnote.auth.pkceVerifier";
  const stateKey = "luxnote.auth.state";
  const returnToKey = "luxnote.auth.returnTo";

  function storageCandidates() {
    return [
      window.localStorage,
      window.sessionStorage
    ].filter(Boolean);
  }

  function getStoredItem(key) {
    for (const storage of storageCandidates()) {
      try {
        const value = storage.getItem(key);

        if (value) {
          return value;
        }
      } catch {
        // Ignore storage access errors and try the next available store.
      }
    }

    return null;
  }

  function setStoredItem(key, value) {
    storageCandidates().forEach((storage) => {
      try {
        storage.setItem(key, value);
      } catch {
        // Some browser privacy modes can block one storage type.
      }
    });
  }

  function removeStoredItem(key) {
    storageCandidates().forEach((storage) => {
      try {
        storage.removeItem(key);
      } catch {
        // Ignore storage cleanup errors.
      }
    });
  }

  function isAuthRequired() {
    return Boolean(config.authRequired);
  }

  function isConfigured() {
    return Boolean(
      config.authEnabled &&
      config.cognitoDomain &&
      config.cognitoClientId
    );
  }

  function isEnabled() {
    return isConfigured();
  }

  function getDomain() {
    const domain = String(config.cognitoDomain || "").trim();

    if (!domain) {
      return "";
    }

    return domain.startsWith("https://")
      ? domain.replace(/\/$/, "")
      : `https://${domain.replace(/\/$/, "")}`;
  }

  function getRedirectUri() {
    return (
      config.cognitoRedirectUri ||
      `${window.location.origin}/index.html`
    );
  }

  function getLogoutUri() {
    return (
      config.cognitoLogoutUri ||
      `${window.location.origin}/index.html`
    );
  }

  function randomString(length = 64) {
    const values = new Uint8Array(length);
    window.crypto.getRandomValues(values);

    return Array.from(values)
      .map((value) => {
        return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"[
          value % 66
        ];
      })
      .join("");
  }

  function base64UrlEncode(buffer) {
    const bytes = new Uint8Array(buffer);
    const binary = Array.from(bytes)
      .map((byte) => String.fromCharCode(byte))
      .join("");

    return window.btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  async function createCodeChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const digest = await window.crypto.subtle.digest("SHA-256", data);

    return base64UrlEncode(digest);
  }

  function readTokens() {
    const raw = getStoredItem(tokenKey);

    if (!raw) {
      return null;
    }

    try {
      const tokens = JSON.parse(raw);
      const expiresAt = Number(tokens.expiresAt || 0);

      if (!expiresAt || Date.now() > expiresAt - 60000) {
        clearTokens();
        return null;
      }

      return tokens;
    } catch {
      clearTokens();
      return null;
    }
  }

  function saveTokens(tokens) {
    const expiresIn = Number(tokens.expires_in || 3600);

    setStoredItem(
      tokenKey,
      JSON.stringify({
        access_token: tokens.access_token || "",
        id_token: tokens.id_token || "",
        token_type: tokens.token_type || "Bearer",
        expiresAt: Date.now() + expiresIn * 1000
      })
    );
  }

  function clearTokens() {
    removeStoredItem(tokenKey);
  }

  function decodeTokenPayload(token) {
    if (!token || !token.includes(".")) {
      return {};
    }

    try {
      const payload = token.split(".")[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const padded = payload.padEnd(
        payload.length + ((4 - payload.length % 4) % 4),
        "="
      );

      return JSON.parse(window.atob(padded));
    } catch {
      return {};
    }
  }

  function getUserLabel() {
    const tokens = readTokens();
    const claims = decodeTokenPayload(tokens?.id_token);

    return (
      claims.email ||
      claims.name ||
      claims["cognito:username"] ||
      "Signed in"
    );
  }

  async function exchangeCodeForTokens(code) {
    const verifier = getStoredItem(verifierKey);

    if (!verifier) {
      throw new Error("Missing sign-in verifier. Please start sign-in again.");
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.cognitoClientId,
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: verifier
    });

    const response = await fetch(`${getDomain()}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!response.ok) {
      throw new Error("Sign-in could not be completed. Please try again.");
    }

    const tokens = await response.json();
    saveTokens(tokens);
  }

  async function handleRedirect() {
    if (!isEnabled()) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code) {
      return;
    }

    const storedState = getStoredItem(stateKey);

    if (!storedState || storedState !== state) {
      throw new Error("Sign-in state did not match. Please try again.");
    }

    await exchangeCodeForTokens(code);

    removeStoredItem(verifierKey);
    removeStoredItem(stateKey);

    const returnTo =
      getStoredItem(returnToKey) ||
      `${window.location.pathname}${window.location.hash || ""}`;

    removeStoredItem(returnToKey);
    window.history.replaceState({}, document.title, window.location.pathname);

    if (returnTo && returnTo !== window.location.pathname) {
      window.location.assign(returnTo);
    }
  }

  async function signIn() {
    if (!isEnabled()) {
      return;
    }

    const verifier = randomString();
    const state = randomString(32);
    const challenge = await createCodeChallenge(verifier);
    const returnTo =
      `${window.location.pathname}${window.location.search}${window.location.hash}`;

    setStoredItem(verifierKey, verifier);
    setStoredItem(stateKey, state);
    setStoredItem(returnToKey, returnTo);

    const params = new URLSearchParams({
      client_id: config.cognitoClientId,
      response_type: "code",
      scope: config.cognitoScopes || "openid email profile",
      redirect_uri: getRedirectUri(),
      state,
      code_challenge: challenge,
      code_challenge_method: "S256"
    });

    window.location.assign(`${getDomain()}/oauth2/authorize?${params}`);
  }

  function signOut() {
    clearTokens();

    if (!isEnabled()) {
      return;
    }

    const params = new URLSearchParams({
      client_id: config.cognitoClientId,
      logout_uri: getLogoutUri()
    });

    window.location.assign(`${getDomain()}/logout?${params}`);
  }

  async function getAuthHeaders() {
    if (isAuthRequired() && !isConfigured()) {
      throw new Error(
        "Private workspace sign-in is not configured yet. Add the Cognito domain and app client ID before using job data."
      );
    }

    if (!isEnabled()) {
      return {};
    }

    const tokens = readTokens();

    if (!tokens) {
      throw new Error("Sign in to LuxNote AI before using private project data.");
    }

    return {
      Authorization: `Bearer ${tokens.id_token || tokens.access_token}`
    };
  }

  function getAccessState() {
    if (!isAuthRequired()) {
      return {
        canAccess: true,
        reason: "public"
      };
    }

    if (!isConfigured()) {
      return {
        canAccess: false,
        reason: "not_configured"
      };
    }

    if (!readTokens()) {
      return {
        canAccess: false,
        reason: "signed_out"
      };
    }

    return {
      canAccess: true,
      reason: "signed_in"
    };
  }

  function createGateAction(reason) {
    if (reason !== "signed_out") {
      return null;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary-button";
    button.textContent = "Sign In";
    button.addEventListener("click", signIn);

    return button;
  }

  function createAccessGate() {
    if (document.querySelector(".private-access-gate")) {
      return;
    }

    const state = getAccessState();

    if (state.canAccess) {
      return;
    }

    const main = document.querySelector("main");

    if (!main) {
      return;
    }

    const gate = document.createElement("section");
    gate.className = "private-access-gate glass-panel";
    gate.setAttribute("role", "status");

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "Private Workspace";

    const heading = document.createElement("h1");
    const description = document.createElement("p");
    description.className = "section-description";

    if (state.reason === "not_configured") {
      heading.textContent = "Sign-in setup required";
      description.textContent =
        "This workspace is reserved for private job use. Add your Cognito hosted UI domain and app client ID in config-private.js before storing real project information.";
    } else {
      heading.textContent = "Sign in to continue";
      description.textContent =
        "Use the private workspace for real project records after signing in. The public demo remains available for fictional LinkedIn walkthroughs.";
    }

    gate.append(eyebrow, heading, description);

    const action = createGateAction(state.reason);

    if (action) {
      const actions = document.createElement("div");
      actions.className = "auth-gate-actions";
      actions.appendChild(action);
      gate.appendChild(actions);
    }

    main.parentNode.insertBefore(gate, main);
  }

  function disablePrivateControls() {
    const state = getAccessState();

    if (state.canAccess) {
      return;
    }

    document
      .querySelectorAll(
        "form input, form select, form textarea, form button, #refresh-projects"
      )
      .forEach((control) => {
        control.disabled = true;
      });
  }

  function createWorkspaceBar() {
    if (document.querySelector(".workspace-status-bar")) {
      return;
    }

    const header = document.querySelector(".site-header") || document.body;
    const bar = document.createElement("div");
    bar.className = "workspace-status-bar";

    const status = document.createElement("span");

    if (!isConfigured()) {
      if (!isAuthRequired() && config.demoNotice === false) {
        return;
      }

      status.textContent =
        isAuthRequired()
          ? "Private workspace: sign-in setup required."
          : "Portfolio demo: use fictional data only.";
      bar.appendChild(status);
      header.appendChild(bar);
      return;
    }

    status.textContent = readTokens()
      ? `Private workspace: ${getUserLabel()}`
      : "Private workspace: sign in required";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "workspace-action";
    button.textContent = readTokens() ? "Sign out" : "Sign in";
    button.addEventListener("click", () => {
      if (readTokens()) {
        signOut();
      } else {
        signIn();
      }
    });

    bar.append(status, button);
    header.appendChild(bar);
  }

  async function initialize() {
    try {
      await handleRedirect();
    } catch (error) {
      clearTokens();
      console.error("LuxNote sign-in failed:", error);
    }

    createWorkspaceBar();
    createAccessGate();
    disablePrivateControls();
  }

  window.luxnoteAuth = {
    config,
    initialize,
    isEnabled,
    isConfigured,
    isAuthRequired,
    isSignedIn: () => Boolean(readTokens()),
    getAccessState,
    getAuthHeaders,
    signIn,
    signOut
  };
}());
