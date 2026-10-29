// Real email + password accounts through Supabase Auth (https://supabase.com/docs/guides/auth/passwords).
// Only the PUBLISHABLE key is used here. It is safe to be public. Never put a secret or service_role key in this file.
// Passwords go straight to Supabase over HTTPS. This website never stores them.
(function () {
  const SUPABASE_URL = "https://omuednmzkvaalrwdxbsq.supabase.co";
  const PUBLISHABLE_KEY = "sb_publishable_xWZz3eQGlEdptnwp1hBK1g_LU7Vtkgu";
  const SESSION_KEY = "civicSession";
  const $ = id => document.getElementById(id);
  const card = $("accountCard"), welcomeCard = document.querySelector(".welcome-card");
  const form = $("accountForm"), msg = $("accMessage");
  let mode = "signin";

  function say(text, isError) { msg.textContent = text; msg.classList.toggle("error", !!isError); }
  function saveSession(s) { try { localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token, email: s.user && s.user.email })); } catch (e) { /* ignore */ } }
  function loadSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; } }
  function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } }

  async function api(path, body, token, method) {
    const headers = { "apikey": PUBLISHABLE_KEY, "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    const res = await fetch(SUPABASE_URL + path, { method: method || "POST", headers: headers, body: body ? JSON.stringify(body) : undefined });
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    return { ok: res.ok, status: res.status, data: data || {} };
  }
  function friendly(r) {
    const code = r.data.error_code || r.data.code || "";
    if (code === "invalid_credentials") return "That email or password is not right.";
    if (code === "email_not_confirmed") return "Please confirm your email first. Check your inbox for the link.";
    if (code === "weak_password") return "Choose a stronger password (at least 8 characters).";
    if (code === "over_email_send_rate_limit" || r.status === 429) return "Too many attempts. Please wait a few minutes and try again.";
    if (code === "signup_disabled") return "Sign-ups are turned off right now.";
    return "Something went wrong. Please try again.";
  }
  function nameFrom(email) { return String(email || "").split("@")[0].slice(0, 40) || "Resident"; }
  function open() { welcomeCard.classList.add("hidden"); card.classList.remove("hidden"); setMode("signin"); $("accEmail").focus(); }
  function close() { card.classList.add("hidden"); welcomeCard.classList.remove("hidden"); }
  function setMode(m) {
    mode = m; say("");
    const up = m === "signup";
    $("tabSignin").classList.toggle("active", !up); $("tabSignup").classList.toggle("active", up);
    $("tabSignin").setAttribute("aria-selected", String(!up)); $("tabSignup").setAttribute("aria-selected", String(up));
    $("accConfirmWrap").classList.toggle("hidden", !up);
    $("accountTitle").textContent = up ? "Create account" : "Sign in";
    $("accSubmit").textContent = up ? "Create account" : "Sign in";
    $("accPassword").autocomplete = up ? "new-password" : "current-password";
    $("accForgot").classList.toggle("hidden", up);
  }
  function enterAs(email) {
    close(); form.reset();
    if (window.civicEnter) window.civicEnter(nameFrom(email), true);
  }

  $("accountBtn").addEventListener("click", open);
  $("accBack").addEventListener("click", close);
  $("tabSignin").addEventListener("click", () => setMode("signin"));
  $("tabSignup").addEventListener("click", () => setMode("signup"));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const email = $("accEmail").value.trim(), password = $("accPassword").value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say("Enter a valid email address.", true); return; }
    if (password.length < 8) { say("Password must be at least 8 characters.", true); return; }
    if (mode === "signup" && password !== $("accConfirm").value) { say("The two passwords do not match.", true); return; }
    const btn = $("accSubmit"); btn.disabled = true;
    try {
      if (mode === "signup") {
        const r = await api("/auth/v1/signup", { email: email, password: password });
        if (!r.ok) { say(friendly(r), true); return; }
        if (r.data.access_token) { saveSession(r.data); enterAs(email); return; }
        say("Almost done. If this email can be used, we sent a confirmation link. Open it, then sign in here.");
      } else {
        const r = await api("/auth/v1/token?grant_type=password", { email: email, password: password });
        if (!r.ok) { say(friendly(r), true); return; }
        saveSession(r.data); enterAs(r.data.user && r.data.user.email || email);
      }
    } catch (e) { say("Could not reach the sign-in service. Check your connection.", true); }
    finally { btn.disabled = false; }
  });

  $("accForgot").addEventListener("click", async () => {
    const email = $("accEmail").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say("Type your email above first.", true); return; }
    try {
      const r = await api("/auth/v1/recover", { email: email });
      say(r.ok ? "If that email has an account, a reset link is on its way." : friendly(r), !r.ok);
    } catch (e) { say("Could not reach the sign-in service.", true); }
  });

  window.civicSignOut = function () {
    const s = loadSession(); clearSession();
    if (s && s.access_token) api("/auth/v1/logout", null, s.access_token).catch(() => {});
  };

  // Restore a real session on load. Verified with Supabase, not trusted from storage.
  (async function restore() {
    const s = loadSession(); if (!s || !s.access_token) return;
    try {
      let r = await api("/auth/v1/user", null, s.access_token, "GET");
      if (!r.ok && s.refresh_token) {
        const t = await api("/auth/v1/token?grant_type=refresh_token", { refresh_token: s.refresh_token });
        if (t.ok) { saveSession(t.data); r = { ok: true, data: t.data.user || {} }; }
      }
      if (r.ok && r.data.email) { if (window.civicEnter) window.civicEnter(nameFrom(r.data.email), true); }
      else if (!r.ok && (r.status === 401 || r.status === 403 || r.status === 400)) clearSession();
    } catch (e) { /* offline: stay on the welcome page, keep the session */ }
  })();
})();
