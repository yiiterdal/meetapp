const AUTH_KEY = "meetinglyDemoAuth";

function readAuth() {
  try {
    return JSON.parse(sessionStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
}

function writeAuth(payload) {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(payload));
}

function authErrorMount() {
  return document.getElementById("authLoginError");
}

async function handleGoogleCredential(response) {
  const errEl = authErrorMount();
  if (!response?.credential) return;
  if (errEl) {
    errEl.textContent = "";
    errEl.style.color = "";
  }
  try {
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: response.credential }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Google sign-in failed.");
    writeAuth({ token: data.token, user: data.user, at: Date.now() });
    window.location.href = "/meetings.html";
  } catch (ex) {
    if (errEl) errEl.textContent = ex.message || "Could not sign in with Google.";
  }
}

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Could not load Google Sign-In."));
    document.head.appendChild(s);
  });
}

async function initGoogleSignIn() {
  const section = document.getElementById("authGoogleSection");
  const divider = document.getElementById("authOrDivider");
  const mount = document.getElementById("googleSignInMount");
  if (!section || !divider || !mount) return;
  try {
    const cfgRes = await fetch("/api/auth/config");
    const cfg = await cfgRes.json().catch(() => ({}));
    const clientId = String(cfg.googleClientId || "").trim();
    if (!clientId) return;

    await loadGoogleScript();

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredential,
      auto_select: false,
    });

    /* Fixed width: parent is `hidden` until after init, so layout width is unreliable here. */
    const buttonWidth = 340;
    window.google.accounts.id.renderButton(mount, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: buttonWidth,
      locale: (typeof navigator !== "undefined" && navigator.language?.slice(0, 2)) || "en",
    });

    section.hidden = false;
    divider.hidden = false;
  } catch (_) {
    /* Google optional — keep email/password only */
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void initGoogleSignIn();
});

document.getElementById("authLoginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("authLoginError");
  err.textContent = "";
  const email = document.getElementById("authLoginEmail").value.trim();
  const password = document.getElementById("authLoginPassword").value;
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Sign in failed.");
    writeAuth({ token: data.token, user: data.user, at: Date.now() });
    window.location.href = "/meetings.html";
  } catch (ex) {
    err.textContent = ex.message || "Could not sign in.";
  }
});

function getAuthFetchHeaders() {
  try {
    const j = JSON.parse(sessionStorage.getItem(AUTH_KEY) || "null");
    if (j && j.token) return { Authorization: `Bearer ${j.token}` };
  } catch {
    /* ignore */
  }
  return {};
}

window.meetinglyAuthHeaders = getAuthFetchHeaders;

void readAuth;
