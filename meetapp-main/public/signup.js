const AUTH_KEY = "meetinglyDemoAuth";

document.getElementById("authSignupForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("authSignupError");
  err.textContent = "";
  const name = document.getElementById("authSignupName").value.trim();
  const email = document.getElementById("authSignupEmail").value.trim();
  const password = document.getElementById("authSignupPassword").value;
  try {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Sign up failed.");
    sessionStorage.setItem(AUTH_KEY, JSON.stringify({ token: data.token, user: data.user, at: Date.now() }));
    window.location.href = "/meetings.html";
  } catch (ex) {
    err.textContent = ex.message || "Could not create account.";
  }
});
