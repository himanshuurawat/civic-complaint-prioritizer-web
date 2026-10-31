// Shared reports, discussions and photos through Supabase (PostgREST + Storage over HTTPS).
// Only the PUBLISHABLE key is used here. It is safe to be public. Never put a secret or service_role key in this file.
// Row Level Security on the server decides who may write; this file only asks.
(function () {
  const SUPABASE_URL = "https://omuednmzkvaalrwdxbsq.supabase.co";
  const PUBLISHABLE_KEY = "sb_publishable_xWZz3eQGlEdptnwp1hBK1g_LU7Vtkgu";
  const SESSION_KEY = "civicSession"; // same key account.js uses
  const BUCKET = "report-photos";

  function loadSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; } }
  function saveSession(s) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }
  function userIdFrom(token) {
    try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub || null; } catch (e) { return null; }
  }

  async function refreshIfNeeded(s) {
    if (!s || !s.access_token) return null;
    try {
      const payload = JSON.parse(atob(s.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload.exp && payload.exp * 1000 > Date.now() + 30000) return s;
    } catch (e) { return s; }
    if (!s.refresh_token) return s;
    try {
      const res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: { "apikey": PUBLISHABLE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      if (!res.ok) return s;
      const data = await res.json();
      const next = { access_token: data.access_token, refresh_token: data.refresh_token || s.refresh_token, email: (data.user && data.user.email) || s.email };
      saveSession(next);
      return next;
    } catch (e) { return s; }
  }

  async function rest(path, options) {
    const opts = options || {};
    const headers = { "apikey": PUBLISHABLE_KEY };
    if (opts.token) headers.Authorization = "Bearer " + opts.token;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.prefer) headers.Prefer = opts.prefer;
    let res;
    try {
      res = await fetch(SUPABASE_URL + path, { method: opts.method || "GET", headers: headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
    } catch (e) {
      return { ok: false, status: 0, data: null, error: "network" };
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    return { ok: res.ok, status: res.status, data: data, error: res.ok ? null : "request" };
  }

  function normArea(area) { return String(area || "").trim().replace(/\s+/g, " ").toLowerCase(); }

  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl).split(",");
    if (parts.length !== 2) return null;
    const mime = (parts[0].match(/^data:(image\/jpeg);base64$/) || [])[1];
    if (!mime) return null;
    let bin;
    try { bin = atob(parts[1]); } catch (e) { return null; }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  async function uploadPhotos(userId, reportId, photos, token) {
    const paths = [];
    for (let i = 0; i < photos.length; i++) {
      const blob = dataUrlToBlob(photos[i]);
      if (!blob) continue;
      const path = userId + "/" + reportId + "/" + i + ".jpg"; // first folder = uploader identity; the storage insert policy enforces it
      let res;
      try {
        res = await fetch(SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + path, {
          method: "POST",
          headers: { "apikey": PUBLISHABLE_KEY, "Authorization": "Bearer " + token, "Content-Type": "image/jpeg", "x-upsert": "false" },
          body: blob
        });
      } catch (e) { return { ok: false, error: "network", paths: paths }; }
      if (!res.ok) return { ok: false, status: res.status, error: "upload", paths: paths };
      paths.push(path);
    }
    return { ok: true, paths: paths };
  }

  function photoUrl(path) { return SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/" + path; }

  async function signedInSession() {
    const s = await refreshIfNeeded(loadSession());
    if (!s || !s.access_token) return null;
    return { token: s.access_token, userId: userIdFrom(s.access_token), email: s.email || "" };
  }

  window.civicBackend = {
    photoUrl: photoUrl,
    normArea: normArea,
    signedInSession: signedInSession,


    async getPublicName() {
      const s = await signedInSession();
      if (!s) return null;
      const r = await rest("/auth/v1/user", { token: s.token });
      if (!r.ok) return null;
      const name = r.data && r.data.user_metadata && r.data.user_metadata.display_name;
      return (typeof name === "string" && name.trim().length >= 2) ? name.trim().slice(0, 40) : null;
    },

    async setPublicName(name) {
      const s = await signedInSession();
      if (!s) return { ok: false, error: "signin" };
      const r = await rest("/auth/v1/user", { method: "PUT", token: s.token, body: { data: { display_name: name } } });
      return r.ok ? { ok: true } : { ok: false, status: r.status, error: "save" };
    },

    async listReports(area, category) {
      let q = "/rest/v1/reports_public?select=id,category,title,description,area,author_label,photos,created_at,mine&order=created_at.desc&limit=60";
      const n = normArea(area);
      if (n) q += "&area_norm=eq." + encodeURIComponent(n);
      if (category && category !== "All") q += "&category=eq." + encodeURIComponent(category);
      const r = await rest(q);
      return r.ok ? { ok: true, reports: Array.isArray(r.data) ? r.data : [] } : { ok: false, status: r.status, error: r.error };
    },

    async createReport(input) {
      const s = await signedInSession();
      if (!s) return { ok: false, error: "signin" };
      const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2));
      let photoPaths = [];
      if (input.photos && input.photos.length) {
        const up = await uploadPhotos(s.userId, id, input.photos, s.token);
        if (!up.ok) return { ok: false, error: "photos", status: up.status };
        photoPaths = up.paths;
      }
      const r = await rest("/rest/v1/reports", {
        method: "POST",
        token: s.token,
        prefer: "return=representation",
        body: {
          id: id,
          user_id: s.userId,
          category: input.category,
          title: input.title,
          description: input.description,
          area: input.area,
          author_label: input.authorLabel,
          photos: photoPaths
        }
      });
      if (!r.ok) {
        if (photoPaths.length) await this.deletePhotos(photoPaths, s.token);
        return { ok: false, status: r.status, error: "insert" };
      }
      const row = Array.isArray(r.data) ? r.data[0] : r.data;
      return { ok: true, report: row };
    },

    async deleteReport(id) {
      const s = await signedInSession();
      if (!s) return { ok: false, error: "signin" };
      const r = await rest("/rest/v1/reports?id=eq." + encodeURIComponent(id), { method: "DELETE", token: s.token });
      if (!r.ok) return { ok: false, status: r.status, error: "delete" };
      return { ok: true };
    },

    async deletePhotos(paths, token) {
      for (const p of paths || []) {
        try {
          await fetch(SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + p, {
            method: "DELETE",
            headers: { "apikey": PUBLISHABLE_KEY, "Authorization": "Bearer " + token }
          });
        } catch (e) { /* best effort cleanup */ }
      }
    },

    async listComments(reportId) {
      const r = await rest("/rest/v1/comments_public?select=id,body,author_label,created_at,mine&report_id=eq." + encodeURIComponent(reportId) + "&order=created_at.asc&limit=100");
      return r.ok ? { ok: true, comments: Array.isArray(r.data) ? r.data : [] } : { ok: false, status: r.status, error: r.error };
    },

    async addComment(reportId, body, authorLabel) {
      const s = await signedInSession();
      if (!s) return { ok: false, error: "signin" };
      const r = await rest("/rest/v1/comments", {
        method: "POST",
        token: s.token,
        prefer: "return=representation",
        body: { report_id: reportId, user_id: s.userId, body: body, author_label: authorLabel }
      });
      if (!r.ok) return { ok: false, status: r.status, error: "insert" };
      const row = Array.isArray(r.data) ? r.data[0] : r.data;
      return { ok: true, comment: row };
    },

    async deleteComment(id) {
      const s = await signedInSession();
      if (!s) return { ok: false, error: "signin" };
      const r = await rest("/rest/v1/comments?id=eq." + encodeURIComponent(id), { method: "DELETE", token: s.token });
      return r.ok ? { ok: true } : { ok: false, status: r.status, error: "delete" };
    }
  };
})();
