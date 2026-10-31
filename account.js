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
  let resetToken = null; // password-reset access token, kept in memory only

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
  // Send auth emails back to the site the person is on. Only known deployed addresses are used;
  // anything else (previews, local files) falls back to the project's default Site URL.
  const TRUSTED_ORIGINS = ["https://civicpulse-demo.pages.dev", "https://yourlocality.pages.dev"];
  function redirectQuery() {
    return TRUSTED_ORIGINS.indexOf(location.origin) !== -1 ? "?redirect_to=" + encodeURIComponent(location.origin + "/") : "";
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
  window.civicOpenAccount = open;
  function close() { card.classList.add("hidden"); welcomeCard.classList.remove("hidden"); }
  function setMode(m) {
    mode = m; say("");
    const up = m === "signup", rs = m === "reset";
    $("accEmailWrap").classList.toggle("hidden", rs);
    $("accEmail").required = !rs;
    document.querySelector("#accountCard .auth-tabs").classList.toggle("hidden", rs);
    $("accLinks").classList.toggle("hidden", rs);
    $("tabSignin").classList.toggle("active", !up); $("tabSignup").classList.toggle("active", up);
    $("tabSignin").setAttribute("aria-selected", String(!up)); $("tabSignup").setAttribute("aria-selected", String(up));
    $("accUserWrap").classList.toggle("hidden", !up);
    $("accUsername").required = up;
    $("accConfirmWrap").classList.toggle("hidden", !(up || rs));
    $("accountTitle").textContent = rs ? "Set a new password" : up ? "Create account" : "Sign in";
    $("accSubmit").textContent = rs ? "Save new password" : up ? "Create account" : "Sign in";
    $("accPassword").autocomplete = (up || rs) ? "new-password" : "current-password";
    $("accForgot").classList.toggle("hidden", up);
  }
  // Unique usernames: new accounts carry one from signup, older accounts are
  // asked once after sign-in. Never blocks entering; "Not now" just asks again later.
  async function ensureUsername() {
    if (!window.civicBackend || !window.civicBackend.getClaimedUsername) return null;
    let claimed = null;
    try { claimed = await window.civicBackend.getClaimedUsername(); } catch (e) { return null; }
    if (claimed) return claimed;
    try {
      const pending = await window.civicBackend.getPendingUsername();
      if (pending) {
        const c = await window.civicBackend.claimUsername(pending);
        if (c.ok) return c.username;
      }
    } catch (e) { /* fall through to asking */ }
    if (window.civicAskUsername) {
      try { return await window.civicAskUsername(); } catch (e) { return null; }
    }
    return null;
  }
  async function enterAs(email) {
    close(); form.reset();
    if (window.civicEnter) window.civicEnter(nameFrom(email), true);
    const username = await ensureUsername();
    if (username && window.civicEnter) window.civicEnter(username, true);
  }

  $("accountBtn").addEventListener("click", open);
  $("accBack").addEventListener("click", close);
  $("tabSignin").addEventListener("click", () => setMode("signin"));
  $("tabSignup").addEventListener("click", () => setMode("signup"));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const email = $("accEmail").value.trim(), password = $("accPassword").value;
    if (mode === "reset") {
      if (password.length < 8) { say("Password must be at least 8 characters.", true); return; }
      if (password !== $("accConfirm").value) { say("The two passwords do not match.", true); return; }
      const rb = $("accSubmit"); rb.disabled = true;
      try {
        const r = await api("/auth/v1/user", { password: password }, resetToken, "PUT");
        if (!r.ok) { say(r.data.error_code === "same_password" ? "Choose a password you have not used before." : r.data.error_code === "weak_password" ? "Choose a stronger password (at least 8 characters)." : "This reset link has expired. Request a new one.", true); return; }
        resetToken = null; form.reset(); setMode("signin");
        say("Password updated. Sign in with your new password.");
      } catch (e) { say("Could not reach the sign-in service. Check your connection.", true); }
      finally { rb.disabled = false; }
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say("Enter a valid email address.", true); return; }
    if (password.length < 8) { say("Password must be at least 8 characters.", true); return; }
    if (mode === "signup" && password !== $("accConfirm").value) { say("The two passwords do not match.", true); return; }
    const btn = $("accSubmit"); btn.disabled = true;
    try {
      if (mode === "signup") {
        const username = $("accUsername").value.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(username)) { say("Usernames use 3-20 lowercase letters, numbers or _.", true); return; }
        if (window.civicBackend && window.civicBackend.usernameAvailable) {
          const a = await window.civicBackend.usernameAvailable(username);
          if (a.ok && !a.available) { say("That username is taken. Try another.", true); return; }
        }
        const r = await api("/auth/v1/signup" + redirectQuery(), { email: email, password: password, data: { username: username } });
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
      const r = await api("/auth/v1/recover" + redirectQuery(), { email: email });
      say(r.ok ? "If that email has an account, a reset link is on its way." : friendly(r), !r.ok);
    } catch (e) { say("Could not reach the sign-in service.", true); }
  });

  // Links in Supabase emails come back with a result in the address after "#".
  (function handleEmailLink() {
    const h = location.hash.replace(/^#/, ""); if (!h) return;
    const p = new URLSearchParams(h), type = p.get("type");
    if (!p.get("access_token") && !p.get("error_code")) return;
    history.replaceState(null, "", location.pathname + location.search);
    document.body.classList.add("gated");
    if (p.get("error_code")) { open(); say("That email link is invalid or has expired. Request a new one.", true); return; }
    if (type === "recovery") { resetToken = p.get("access_token"); open(); setMode("reset"); $("accPassword").focus(); return; }
    if (type === "signup" || type === "email_change") { open(); say("Email confirmed. Sign in to continue."); }
  })();

  // ---- Account panel: own username, own email, change password. The current
  // password is never shown anywhere; only a new one can be set.
  const acctModal = $("acctModal");
  function openAcct() {
    const s = loadSession();
    if (!s || !s.access_token) return; // chip only shows when signed in anyway
    $("acctMessage").textContent = ""; $("acctPass").value = ""; $("acctPass2").value = "";
    $("acctEmail").textContent = s.email || "";
    $("acctUsername").textContent = "...";
    acctModal.classList.add("visible");
    acctModal.setAttribute("aria-hidden", "false");
    if (window.civicBackend && window.civicBackend.getClaimedUsername) {
      window.civicBackend.getClaimedUsername().then(u => {
        $("acctUsername").textContent = u || "Not chosen yet";
      }).catch(() => { $("acctUsername").textContent = "Not chosen yet"; });
    } else {
      $("acctUsername").textContent = "Not chosen yet";
    }
    if (!s.email) {
      api("/auth/v1/user", null, s.access_token, "GET").then(r => {
        if (r.ok && r.data.email) $("acctEmail").textContent = r.data.email;
      }).catch(() => {});
    }
  }
  function closeAcct() { acctModal.classList.remove("visible"); acctModal.setAttribute("aria-hidden", "true"); }
  $("userChip").addEventListener("click", openAcct);
  $("acctClose").addEventListener("click", closeAcct);
  $("acctPassForm").addEventListener("submit", async event => {
    event.preventDefault();
    const s = loadSession();
    if (!s || !s.access_token) { say2("Please sign in again.", true); return; }
    const p1 = $("acctPass").value, p2 = $("acctPass2").value;
    if (p1.length < 8) { say2("Password must be at least 8 characters.", true); return; }
    if (p1 !== p2) { say2("The two passwords do not match.", true); return; }
    const b = event.target.querySelector("button[type=submit]"); b.disabled = true;
    try {
      const r = await api("/auth/v1/user", { password: p1 }, s.access_token, "PUT");
      if (r.ok) { $("acctPass").value = ""; $("acctPass2").value = ""; say2("Password updated."); }
      else if (r.status === 401 || r.status === 403) say2("Your sign-in has expired. Please sign in again.", true);
      else say2(r.data.error_code === "same_password" ? "Choose a password you have not used before." : r.data.error_code === "weak_password" ? "Choose a stronger password (at least 8 characters)." : "Could not update the password. Try again.", true);
    } catch (e) { say2("Could not reach the sign-in service. Check your connection.", true); }
    finally { b.disabled = false; }
  });
  function say2(text, isError) { const m = $("acctMessage"); m.textContent = text; m.classList.toggle("error", !!isError); }

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
      if (r.ok && r.data.email) {
        if (window.civicEnter) window.civicEnter(nameFrom(r.data.email), true);
        ensureUsername().then(username => { if (username && window.civicEnter) window.civicEnter(username, true); });
      }
      else if (!r.ok && (r.status === 401 || r.status === 403 || r.status === 400)) clearSession();
    } catch (e) { /* offline: stay on the welcome page, keep the session */ }
  })();
})();
