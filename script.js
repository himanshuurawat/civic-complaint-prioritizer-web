// YourLocality main page: intro + problem cards (Page 1 of the sketch), then
// pick a place, describe the problem, and discuss shared reports with neighbours.
// Opening splash: brief logo + tagline moment, once per session. Skippable by tap.
// Skipped entirely under OS reduced-motion. Chime plays when the browser allows
// autoplay; otherwise it fires on the visitor's first tap instead.
(function () {
  var splash = document.getElementById('splash');
  // Shared chime: one Audio for the whole intro. Plays when the browser allows
  // autoplay; otherwise the visitor's deliberate tap during the splash or the
  // intro scene plays it once. Never fires on unrelated later taps.
  window.ylChime = (function () {
    // WebAudio path: a plain fetch (no media-element quirks) + decode once,
    // then a BufferSource on each allowed play. Browsers still require one
    // deliberate tap before sound; decode happens up front so the tap plays
    // instantly.
    var ctx = null, buf = null, ready = null, played = false;
    function prepare() {
      if (!ready) {
        ready = fetch('chime.mp3')
          .then(function (r) { return r.arrayBuffer(); })
          .then(function (ab) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            return ctx.decodeAudioData(ab);
          })
          .then(function (b) { buf = b; return true; }, function () { return false; });
      }
      return ready;
    }
    prepare(); // decode early; this makes no sound on its own
    return {
      play: function () {
        if (played) return Promise.resolve(false);
        return prepare().then(function (ok) {
          if (!ok || played) return false;
          function start() {
            if (played) return true;
            var src = ctx.createBufferSource();
            var gain = ctx.createGain();
            gain.gain.value = 0.7;
            src.buffer = buf;
            src.connect(gain);
            gain.connect(ctx.destination);
            src.start();
            played = true;
            return true;
          }
          if (ctx.state === 'running') return start();
          return ctx.resume().then(start, function () { return false; });
        });
      },
      hasPlayed: function () { return played; }
    };
  })();
  if (!splash) return;
  var reduced = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || document.body.classList.contains('motion-light');
  // Intro plays on every fresh visit (each page load); in-app navigation never
  // re-runs this module, so it cannot nag between views.
  if (reduced) { splash.remove(); document.body.classList.remove('splashing'); return; }
  document.body.classList.add('splashing');
  // Sound by default: try to play the chime as the intro starts. Where the
  // browser blocks automatic sound, any tap WHILE THE INTRO IS ON SCREEN may
  // still sync the chime to the reveal; after the intro there is no sound
  // trigger at all - no button, no unrelated-tap audio, no bypass of browser
  // autoplay policy.
  var armed = true;
  function introVisible() {
    return document.body.classList.contains('splashing') || document.body.classList.contains('scene-playing');
  }
  function onFirstTap() {
    if (!armed || window.ylChime.hasPlayed() || !introVisible()) return;
    window.ylChime.play().then(function (ok) { if (ok) disarm(); });
  }
  function disarm() {
    if (!armed) return;
    armed = false;
    document.removeEventListener('pointerdown', onFirstTap);
  }
  document.addEventListener('pointerdown', onFirstTap);
  window.ylChime.play().catch(function () {});
  // Once the intro is over, the sound offer ends with it.
  var watch = setInterval(function () {
    if (window.ylChime.hasPlayed() || (!introVisible() && (document.body.classList.contains('entering') || document.body.classList.contains('gated') || document.body.classList.contains('home-active')))) {
      disarm(); clearInterval(watch);
    }
  }, 250);
  var done = false;
  function end() {
    if (done) return;
    done = true;
    splash.classList.add('splash-exit');
    splash.addEventListener('animationend', function () { splash.remove(); });
    setTimeout(function () {
      if (splash.parentNode) splash.remove();
      document.body.classList.remove('splashing');
    }, 700);
  }
  setTimeout(end, 2000);
  splash.addEventListener('pointerdown', end);
})();

(function () {
  "use strict";

  // Product switches (set from the owner's decisions; flip here, no rework).
  const REQUIRE_SIGNIN_TO_POST = true;   // share reports / join discussion needs a real account
  const PUBLIC_BROWSING = true;          // guests may read shared boards and discussions

  const CATEGORIES = [
    { id: "Roads", name: "Roads & Transport", line: "Potholes, broken footpaths, traffic trouble", dot: "d-roads", icon: '<svg viewBox="0 0 48 48"><path d="M11 40 20 8M37 40 28 8"/><path d="M24 13v4M24 22v4M24 31v4"/></svg>' },
    { id: "Waste", name: "Waste & Sanitation", line: "Overflowing bins, missed collection, dumping", dot: "d-waste", icon: '<svg viewBox="0 0 48 48"><path d="M12 14h24M20 14v-3h8v3M15 14l2 24h14l2-24"/><path d="M21 20v11M27 20v11"/></svg>' },
    { id: "Water", name: "Water Supply", line: "Leakage, no supply, dirty water", dot: "d-water", icon: '<svg viewBox="0 0 48 48"><path d="M24 6c6 8 10 13 10 19a10 10 0 1 1-20 0c0-6 4-11 10-19z"/></svg>' },
    { id: "Streetlights", name: "Streetlights & Power", line: "Dark streets, dead lights, loose wires", dot: "d-lights", icon: '<svg viewBox="0 0 48 48"><path d="M24 6a10 10 0 0 1 6 18c-1.5 1.2-2 2.6-2 4h-8c0-1.4-.5-2.8-2-4A10 10 0 0 1 24 6z"/><path d="M20 33h8M21.5 38h5"/></svg>' },
    { id: "Safety", name: "Public Safety", line: "Broken drains, hazards, unsafe spots", dot: "d-safety", icon: '<svg viewBox="0 0 48 48"><path d="M24 8 43 38H5z"/><path d="M24 19v8M24 31.5v.5"/></svg>' },
    { id: "Other", name: "Something else", line: "Any other local problem that needs eyes", dot: "d-other", icon: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="15"/><path d="M24 17v14M17 24h14"/></svg>' }
  ];
  const CARD_PHOTOS = { Roads: "road", Waste: "garbage", Water: "water", Streetlights: "wires", Safety: "streetlight", Other: "potholes" };
  const CATEGORY_NAMES = {};
  CATEGORIES.forEach(c => { CATEGORY_NAMES[c.id] = c.name; });
  const DAY = 86400000;
  const MAX_PHOTOS = 3;
  const PHOTO_PATTERN = /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/;
  const POLL_MS = 15000;

  const $ = id => document.getElementById(id);
  function readStorage(key, fallback) { try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); } catch (e) { return fallback; } }
  function writeStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } }
  function makeEl(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
  function currentUser() { return readStorage("civicUser", null); }
  function isSignedIn() { const u = currentUser(); return !!(u && u.account); }
  function displayName() { const u = currentUser(); return (u && u.name) || "Resident"; }
  function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const days = Math.floor((Date.now() - d.getTime()) / DAY);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return days + " days ago";
    return d.toLocaleDateString();
  }

  // ---- View router ----
  const VIEWS = ["viewHome", "viewLocation", "viewReport", "viewBoard", "viewDetail"];
  let commentTimer = null;
  function showView(name) {
    VIEWS.forEach(v => $(v).classList.toggle("hidden", v !== name));
    document.body.classList.toggle("home-active", name === "viewHome");
    document.documentElement.classList.toggle("snap-y", name === "viewHome");
    if (commentTimer) { clearInterval(commentTimer); commentTimer = null; }
    window.scrollTo(0, 0);
    if (name === "viewDetail" && state.report) {
      loadComments(state.report.id);
      commentTimer = setInterval(() => loadComments(state.report && state.report.id, true), POLL_MS);
    }
  }
  document.querySelectorAll("[data-back]").forEach(btn => {
    btn.addEventListener("click", () => {
      const to = btn.getAttribute("data-back");
      if (to === "home") showView("viewHome");
      else if (to === "location") showView("viewLocation");
      else if (to === "board") showView(state.area ? "viewBoard" : "viewHome");
    });
  });

  const state = { category: null, area: "", report: null, boardReports: [] };

  // ---- Page 1: intro + feature cards ----
  function buildFeatureGrid() {
    const grid = $("featureGrid");
    grid.replaceChildren(...CATEGORIES.map(c => {
      const card = makeEl("button", "feature-card");
      card.type = "button";
      card.dataset.cat = c.id;
      card.setAttribute("role", "listitem");
      const poster = makeEl("i", "poster " + c.dot);
      poster.setAttribute("aria-hidden", "true");
      poster.innerHTML = c.icon;
      const photo = makeEl("span", "card-photo");
      photo.setAttribute("aria-hidden", "true");
      const pimg = document.createElement("img");
      pimg.src = "photos/" + CARD_PHOTOS[c.id] + "-m.jpg";
      pimg.alt = "";
      pimg.loading = "lazy";
      photo.append(pimg);
      const meta = makeEl("span", "meta");
      meta.append(makeEl("strong", "", c.name), makeEl("span", "line", c.line), makeEl("em", "go", "Report this \u2192"));
      const shell = makeEl("span", "card-shell");
      shell.append(photo, poster, meta);
      card.append(shell);
      card.addEventListener("click", (ev) => {
        // On mobile the card is a full-screen panel; only its visible shell selects.
        if (window.matchMedia && window.matchMedia("(max-width:640px)").matches &&
            !(ev.target instanceof Element && ev.target.closest(".card-shell"))) return;
        startFlow(c.id);
      });
      return card;
    }));
    const dots = makeEl("div", "orbit-dots");
    dots.setAttribute("aria-hidden", "true");
    CATEGORIES.forEach((c, i) => {
      const d = makeEl("i");
      d.dataset.cat = c.id;
      if (i === 0) d.className = "on";
      dots.append(d);
    });
    grid.after(dots);
    var _cue = document.getElementById('swipeCue');
    if (_cue) dots.after(_cue);
  }
  function startFlow(categoryId) {
    state.category = categoryId;
    $("locationNote").textContent = "";
    showView("viewLocation");
    $("areaInput").focus();
  }


  // ---- Unique username (the public identity on reports and comments) ----
  const nameModal = $("nameModal");
  let nameResolver = null;
  let namePromise = null;
  function openNameModal() {
    $("nameMessage").textContent = "";
    nameModal.classList.add("visible");
    nameModal.setAttribute("aria-hidden", "false");
    const input = $("usernameInput");
    if (!input.value && window.civicBackend && window.civicBackend.suggestUsername) {
      window.civicBackend.suggestUsername().then(s => { if (s && !input.value) input.value = s; });
    }
    input.focus();
  }
  function closeNameModal() {
    nameModal.classList.remove("visible");
    nameModal.setAttribute("aria-hidden", "true");
  }
  function askUsername() {
    if (namePromise) return namePromise; // already asking; don't stack a second prompt
    namePromise = new Promise(resolve => { nameResolver = resolve; openNameModal(); });
    return namePromise;
  }
  window.civicAskUsername = askUsername;
  $("nameForm").addEventListener("submit", async event => {
    event.preventDefault();
    const name = $("usernameInput").value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(name)) { $("nameMessage").textContent = "Use 3-20 lowercase letters, numbers or _."; return; }
    const btn = event.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const r = await window.civicBackend.claimUsername(name);
      if (!r.ok) { $("nameMessage").textContent = r.error === "taken" ? "That username is taken. Try another." : "That username could not be saved. Check your connection and try again."; return; }
      closeNameModal();
      if (window.civicEnter) window.civicEnter(name, true); // greet with the new username right away
      if (nameResolver) { nameResolver(name); nameResolver = null; }
      namePromise = null;
    } finally { btn.disabled = false; }
  });
  $("nameCancel").addEventListener("click", () => {
    closeNameModal();
    if (nameResolver) { nameResolver(null); nameResolver = null; }
    namePromise = null;
  });
  async function requirePostAccess() {
    const s = await window.civicBackend.signedInSession();
    if (!s) { promptSignIn("Sign in to share a report or join a discussion."); return null; }
    const name = await window.civicBackend.getClaimedUsername();
    if (name) return { session: s, author: name };
    const chosen = await askUsername(); // null when they pick "Not now": don't post
    if (!chosen) return null;
    return { session: s, author: chosen };
  }

  // ---- Step 2: location ----
  $("locationForm").addEventListener("submit", event => {
    event.preventDefault();
    const area = $("areaInput").value.trim().replace(/\s+/g, " ");
    if (area.length < 3) { $("locationNote").textContent = "Name the area with its city, like Green Park, Dehradun."; return; }
    state.area = area;
    openReportForm();
  });
  $("seeAreaBtn").addEventListener("click", () => {
    const area = $("areaInput").value.trim().replace(/\s+/g, " ");
    if (area.length < 3) { $("locationNote").textContent = "Type the area first, then look it up."; return; }
    state.area = area;
    openBoard(area);
  });

  // ---- Step 3: describe + submit ----
  const photos = [];
  async function openReportForm() {
    const access = REQUIRE_SIGNIN_TO_POST ? await requirePostAccess() : null;
    if (REQUIRE_SIGNIN_TO_POST && !access) return;
    state.author = access ? access.author : "Resident";
    $("reportCategoryTag").textContent = CATEGORY_NAMES[state.category];
    $("reportAreaLabel").textContent = "\u{1F4CD} " + state.area;
    $("formMessage").textContent = "";
    showView("viewReport");
    $("title").focus();
  }
  function updateCount() { $("descCount").textContent = $("description").value.length + " / 280"; }
  $("description").addEventListener("input", updateCount);
  function renderPhotos() {
    $("photoPreview").replaceChildren(...photos.map((src, index) => {
      const thumb = makeEl("div", "thumb");
      const img = document.createElement("img");
      img.src = src; img.alt = "Selected photo " + (index + 1);
      const remove = makeEl("button", "", "\u00d7");
      remove.type = "button"; remove.setAttribute("aria-label", "Remove photo " + (index + 1));
      remove.addEventListener("click", () => { photos.splice(index, 1); renderPhotos(); });
      thumb.append(img, remove);
      return thumb;
    }));
  }
  function shrinkPhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("decode"));
        img.onload = () => {
          // Compress for upload: cap the long edge, then step JPEG quality
          // down until the photo is small enough. Turns multi-MB phone
          // shots into roughly 100-250KB uploads while keeping complaint
          // details (cracks, signs, labels) legible. EXIF orientation is
          // honored by the browser's image decode.
          const MAX_EDGE = 1280;
          const TARGET_CHARS = 340000; // ~250KB of JPEG, under the 400k send cap
          const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          const qualities = [0.8, 0.72, 0.64, 0.56, 0.48];
          for (const q of qualities) {
            const out = canvas.toDataURL("image/jpeg", q);
            if (out.length <= TARGET_CHARS) { resolve(out); return; }
          }
          resolve(null); // still too large at the lowest quality - caller tells the user
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  $("photoInput").addEventListener("change", async () => {
    const note = $("formMessage");
    const files = Array.from($("photoInput").files || []);
    $("photoInput").value = "";
    let skipped = 0, tooComplex = 0;
    for (const file of files) {
      if (photos.length >= MAX_PHOTOS) { skipped++; continue; }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 15 * 1024 * 1024) { skipped++; continue; }
      try {
        const data = await shrinkPhoto(file);
        if (data === null) { tooComplex++; continue; }
        if (PHOTO_PATTERN.test(data) && data.length < 400000) photos.push(data); else skipped++;
      } catch (e) { skipped++; }
    }
    renderPhotos();
    const msgs = [];
    if (skipped) msgs.push("Some files were skipped. Use up to " + MAX_PHOTOS + " JPG, PNG or WebP photos under 15 MB.");
    if (tooComplex) msgs.push(tooComplex === 1 ? "That photo stayed too large even after compression - try a closer crop of the problem." : tooComplex + " photos stayed too large even after compression - try a closer crop of the problem.");
    note.textContent = msgs.join(" ");
  });
  $("reportForm").addEventListener("submit", async event => {
    event.preventDefault();
    const note = $("formMessage");
    const title = $("title").value.trim();
    const description = $("description").value.trim();
    if (!title || !description) { note.textContent = "Please fill in the title and description. Spaces alone do not count."; return; }
    const btn = event.target.querySelector("button[type=submit]");
    btn.disabled = true; note.textContent = "Sharing your report\u2026";
    try {
      const r = await window.civicBackend.createReport({
        category: state.category, title: title.slice(0, 70), description: description.slice(0, 280),
        area: state.area, photos: photos.slice(), authorLabel: (state.author || "Resident").slice(0, 40)
      });
      if (!r.ok) {
        note.textContent = r.error === "signin" ? "Your sign-in has expired. Please sign in again."
          : r.error === "photos" ? "The photos could not be uploaded. Try again, or submit without photos."
          : "The report could not be shared right now. Please try again in a moment.";
        return;
      }
      photos.length = 0; renderPhotos(); event.target.reset(); updateCount();
      openDetail(r.report);
    } finally { btn.disabled = false; }
  });

  // ---- Shared board ----
  function openBoard(area) {
    $("boardArea").textContent = area || "your area";
    $("boardAreaInput").value = area || "";
    const filter = $("boardFilter");
    filter.replaceChildren(makeEl("option", "", "All types"), ...CATEGORIES.map(c => {
      const o = makeEl("option", "", c.name); o.value = c.id; return o;
    }));
    filter.firstChild.value = "All";
    showView("viewBoard");
    loadBoard();
  }
  async function loadBoard() {
    const list = $("boardList"), note = $("boardNote");
    note.textContent = "";
    if (!state.area) { list.replaceChildren(makeEl("p", "", "Type an area above to see its shared reports.")); return; }
    list.replaceChildren(makeEl("p", "", "Loading shared reports\u2026"));
    const category = $("boardFilter").value;
    const r = await window.civicBackend.listReports(state.area, category === "All" ? null : category);
    if (!r.ok) {
      list.replaceChildren(makeEl("p", "", "Shared reports could not be loaded right now. Check your connection and try again."));
      return;
    }
    state.boardReports = r.reports;
    if (!r.reports.length) {
      const wrap = makeEl("div", "empty-board");
      wrap.append(makeEl("p", "", "No shared reports in " + state.area + " yet."), makeEl("p", "", "Be the first to speak up for this area."));
      const go = makeEl("button", "button button-small", "Report a problem here");
      go.type = "button";
      go.addEventListener("click", () => showView("viewHome"));
      wrap.append(go);
      list.replaceChildren(wrap);
      return;
    }
    list.replaceChildren(...r.reports.map(buildSharedCard));
  }
  function buildSharedCard(report) {
    const card = makeEl("article", "issue-card clickable");
    if (report.photos && report.photos.length) {
      const cover = makeEl("div", "issue-photos");
      const img = document.createElement("img");
      img.alt = "Photo of the reported problem"; img.loading = "lazy";
      img.addEventListener("error", () => cover.remove());
      img.src = window.civicBackend.photoUrl(report.photos[0]);
      cover.append(img);
      if (report.photos.length > 1) cover.append(makeEl("span", "more", "+" + (report.photos.length - 1) + " more"));
      card.append(cover);
    }
    const meta = makeEl("div", "issue-meta");
    meta.append(makeEl("span", "tag", CATEGORY_NAMES[report.category] || report.category), makeEl("span", "", formatDate(report.created_at)));
    card.append(meta, makeEl("h3", "", report.title), makeEl("p", "", report.description), makeEl("small", "", "\u{1F4CD} " + report.area + " \u00b7 by " + (report.author_label || "Resident")));
    card.addEventListener("click", () => openDetail(report));
    card.tabIndex = 0;
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(report); } });
    return card;
  }
  $("boardFilter").addEventListener("change", loadBoard);
  $("boardAreaForm").addEventListener("submit", event => {
    event.preventDefault();
    const area = $("boardAreaInput").value.trim().replace(/\s+/g, " ");
    if (area.length < 3) return;
    state.area = area;
    $("boardArea").textContent = area;
    loadBoard();
  });
  $("navBoard").addEventListener("click", () => openBoard(state.area));
  $("navHome").addEventListener("click", event => { event.preventDefault(); showView("viewHome"); });

  // ---- One report + discussion ----
  async function openDetail(report) {
    state.report = report;
    $("detailTag").textContent = CATEGORY_NAMES[report.category] || report.category;
    $("detailDate").textContent = formatDate(report.created_at);
    $("detailTitle").textContent = report.title;
    $("detailLoc").textContent = "\u{1F4CD} " + report.area;
    $("detailDesc").textContent = report.description;
    $("detailBy").textContent = "Reported by " + (report.author_label || "Resident");
    $("detailNote").textContent = "";
    const wrap = $("detailPhotos");
    if (report.photos && report.photos.length) {
      wrap.hidden = false;
      wrap.replaceChildren(...report.photos.map(p => {
        const img = document.createElement("img");
        img.alt = "Photo of the reported problem"; img.loading = "lazy";
        img.src = window.civicBackend.photoUrl(p);
        return img;
      }));
    } else { wrap.hidden = true; wrap.replaceChildren(); }
    const del = $("deleteBtn");
    del.hidden = true;
    const s = await window.civicBackend.signedInSession();
    if (s && report.mine === true) del.hidden = false;
    showView("viewDetail");
  }
  $("deleteBtn").addEventListener("click", async () => {
    if (!state.report || !window.confirm("Delete this report and its discussion? This cannot be undone.")) return;
    const note = $("detailNote");
    const photos = state.report.photos || [];
    const r = await window.civicBackend.deleteReport(state.report.id);
    if (!r.ok) { note.textContent = "The report could not be deleted right now. Try again in a moment."; return; }
    const s = await window.civicBackend.signedInSession();
    if (s && photos.length) window.civicBackend.deletePhotos(photos, s.token);
    state.report = null;
    openBoard(state.area);
  });
  async function loadComments(reportId, quiet) {
    if (!reportId) return;
    const list = $("commentList");
    if (!quiet) list.replaceChildren(makeEl("p", "", "Loading discussion\u2026"));
    const r = await window.civicBackend.listComments(reportId);
    if (!r.ok) { if (!quiet) list.replaceChildren(makeEl("p", "", "The discussion could not be loaded right now.")); return; }
    if (!r.comments.length) { list.replaceChildren(makeEl("p", "", "No comments yet. Say something useful for neighbours.")); return; }
    list.replaceChildren(...r.comments.map(c => {
      const row = makeEl("div", "comment");
      row.append(makeEl("strong", "", c.author_label || "Resident"), makeEl("span", "when", formatDate(c.created_at)), makeEl("p", "", c.body));
      return row;
    }));
  }
  $("commentForm").addEventListener("submit", async event => {
    event.preventDefault();
    const note = $("commentNote");
    const body = $("commentInput").value.trim();
    if (!body) return;
    const access = REQUIRE_SIGNIN_TO_POST ? await requirePostAccess() : null;
    if (REQUIRE_SIGNIN_TO_POST && !access) return;
    const btn = event.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const r = await window.civicBackend.addComment(state.report.id, body.slice(0, 280), (access ? access.author : "Resident").slice(0, 40));
      if (!r.ok) { note.textContent = r.error === "signin" ? "Your sign-in has expired. Please sign in again." : "Your comment could not be posted right now. Try again."; return; }
      $("commentInput").value = ""; note.textContent = "";
      loadComments(state.report.id, true);
    } finally { btn.disabled = false; }
  });

  // ---- Sign-in prompt ----
  function promptSignIn(message) {
    if (window.confirm(message + "\n\nGo to the sign-in page now?")) {
      showWelcome();
      if (window.civicOpenAccount) window.civicOpenAccount();
    }
  }

  // ---- Reports saved on this device (kept private, from the old version) ----
  function cleanPhotos(list) { return Array.isArray(list) ? list.filter(p => typeof p === "string" && p.length < 400000 && PHOTO_PATTERN.test(p)).slice(0, MAX_PHOTOS) : []; }
  function isValidIssue(issue) { return issue && typeof issue === "object" && typeof issue.title === "string" && typeof issue.category === "string" && typeof issue.location === "string" && typeof issue.description === "string"; }
  function renderDeviceReports() {
    const stored = readStorage("civicIssues", []);
    const mine = (Array.isArray(stored) ? stored : []).filter(isValidIssue);
    const section = $("deviceSection");
    if (!mine.length) { section.hidden = true; return; }
    section.hidden = false;
    $("deviceList").replaceChildren(...mine.map(issue => {
      const card = makeEl("article", "issue-card");
      const pics = cleanPhotos(issue.photos);
      if (pics.length) {
        const cover = makeEl("div", "issue-photos");
        const img = document.createElement("img");
        img.alt = "Photo of the reported problem"; img.loading = "lazy";
        img.addEventListener("error", () => cover.remove());
        img.src = pics[0];
        cover.append(img);
        if (pics.length > 1) cover.append(makeEl("span", "more", "+" + (pics.length - 1) + " more"));
        card.append(cover);
      }
      const meta = makeEl("div", "issue-meta");
      meta.append(makeEl("span", "tag", CATEGORY_NAMES[issue.category] || issue.category), makeEl("span", "", issue.createdAt ? formatDate(issue.createdAt) : ""));
      card.append(meta, makeEl("h3", "", issue.title), makeEl("p", "", issue.description), makeEl("small", "", "\u{1F4CD} " + issue.location));
      return card;
    }));
  }

  // ---- Theme (unchanged behaviour) ----
  (function () {
    const root = document.documentElement;
    const toggles = Array.from(document.querySelectorAll(".theme-toggle"));
    const saved = readStorage("civicTheme", null);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    function applyTheme(theme) {
      if (theme === "dark") root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
      toggles.forEach(toggle => {
        toggle.textContent = theme === "dark" ? "\u2600" : "\u263e";
        toggle.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
      });
    }
    applyTheme(saved === "dark" || saved === "light" ? saved : prefersDark ? "dark" : "light");
    toggles.forEach(toggle => toggle.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      writeStorage("civicTheme", next);
    }));
  })();


// Problem-scene moment: after sign-in/guest, a brief full-screen visual of what
// the site is about, then it lifts away into the main page. Plays on every fresh
// visit (page load), at most once per load, skipped under OS reduced-motion.
(function () {
  var scene = document.getElementById('introScene');
  if (!scene) return;
  var reduced = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || document.body.classList.contains('motion-light');
  var playedThisLoad = false;
  window.civicPlayScene = function (onReveal) {
    if (reduced || playedThisLoad) { if (!playedThisLoad) { playedThisLoad = true; } scene.remove(); onReveal(); return; }
    playedThisLoad = true;
    // The tap that entered (guest / sign-in / returning click) is a live user
    // gesture: this is the reliable moment the chime is allowed to sound.
    if (window.ylChime) window.ylChime.play();
    document.body.classList.add('scene-playing');
    var done = false;
    function end() {
      if (done) return;
      done = true;
      scene.classList.add('scene-exit');
      onReveal(); // main page entrance begins as the scene lifts
      setTimeout(function () {
        if (scene.parentNode) scene.remove();
        document.body.classList.remove('scene-playing');
      }, 850);
    }
    setTimeout(end, 2300);
    scene.addEventListener('pointerdown', end);
  };
})();

// ---- Center-focus carousel: while sliding, the centered card pops forward and
// the others squeeze back. Continuous, scroll-driven. Skipped under OS
// reduced-motion and in device light-motion mode.
(function () {
  var grid = document.getElementById('featureGrid');
  if (!grid) return;
  var reduced = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || document.body.classList.contains('motion-light');
  if (reduced) {
    // No motion: still keep the background on the centered category, switching
    // instantly (crossfade is ~instant under reduced-motion CSS).
    if ('IntersectionObserver' in window) {
      var pics = Array.from(document.querySelectorAll('.hero-photos picture'));
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && en.intersectionRatio >= 0.6 && en.target.dataset.cat) {
            pics.forEach(function (pic) { pic.classList.toggle('active', pic.dataset.cat === en.target.dataset.cat); });
            var dots = document.querySelector('.orbit-dots');
            if (dots) Array.from(dots.children).forEach(function (d) { d.classList.toggle('on', d.dataset.cat === en.target.dataset.cat); });
          }
        });
      }, { threshold: [0.6] });
      Array.from(grid.children).forEach(function (c) { io.observe(c); });
    }
    return;
  }
  var active = false;
  var raf = null;
  var heroCat = 'Roads';
  var heroPending = null;
  var heroImgs = Array.from(document.querySelectorAll('.hero-photos picture'));
  function syncDots(cat) {
    var dots = document.querySelector('.orbit-dots');
    if (!dots) return;
    Array.from(dots.children).forEach(function (d) { d.classList.toggle('on', d.dataset.cat === cat); });
  }
  function setHeroPhoto(cat) {
    heroCat = cat;
    heroPending = null;
    heroImgs.forEach(function (img) { img.classList.toggle('active', img.dataset.cat === cat); });
    syncDots(cat);
  }
  var mqMobile = window.matchMedia ? window.matchMedia('(max-width:640px)') : { matches: false };
  function update() {
    raf = null;
    if (!active) return;
    if (mqMobile.matches) { updateOrbit(); return; }
    var gc = grid.getBoundingClientRect();
    if (!gc.width) return;
    var center = gc.left + gc.width / 2;
    var cards = grid.children;
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      var off = r.left + r.width / 2 - center;
      var d = Math.abs(off) / gc.width;
      var t = Math.min(1, d * 2.2); // 0 at center -> 1 at edge
      cards[i].style.transform = 'translateZ(' + (60 * (1 - t)).toFixed(1) + 'px) scale(' + (1 - 0.12 * t).toFixed(3) + ')';
      cards[i].style.opacity = (1 - 0.15 * t).toFixed(2); // text stays readable
      cards[i].style.filter = 'saturate(' + (1 - 0.4 * t).toFixed(2) + ') brightness(' + (1 - 0.07 * t).toFixed(2) + ')';
      cards[i].classList.toggle('is-focus', t < 0.25);
    }
    var focused = grid.querySelector('.feature-card.is-focus');
    if (focused && focused.dataset.cat !== heroCat && focused.dataset.cat !== heroPending) {
      heroPending = focused.dataset.cat;
      setTimeout(function () {
        var still = grid.querySelector('.feature-card.is-focus');
        if (still && still.dataset.cat === heroPending) setHeroPhoto(heroPending);
      }, 300);
    }
  }
  // Orbit mode (mobile): the grid scrolls horizontally; the card nearest the
  // middle owns the stage (scale/tilt/brighten) while neighbors sink back.
  function updateOrbit() {
    var gr = grid.getBoundingClientRect();
    if (!gr.width) return;
    var center = gr.left + gr.width / 2;
    var cards = grid.children;
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      if (!r.width) continue;
      var off = (r.left + r.width / 2) - center;
      var t = Math.min(1, Math.abs(off) / (gr.width * 0.62));
      var dir = off === 0 ? 0 : (off > 0 ? 1 : -1);
      var shell = cards[i].querySelector('.card-shell') || cards[i];
      shell.style.transform = 'translateY(' + (26 * t).toFixed(1) + 'px) scale(' + (1 - 0.3 * t).toFixed(3) + ') rotateY(' + (dir * -30 * t).toFixed(1) + 'deg)';
      shell.style.opacity = (1 - 0.22 * t).toFixed(2);
      shell.style.setProperty('--dim', (0.35 * t).toFixed(2));
      cards[i].classList.toggle('is-focus', t < 0.3);
    }
    var focused = grid.querySelector('.feature-card.is-focus');
    if (focused && focused.dataset.cat !== heroCat && focused.dataset.cat !== heroPending) {
      heroPending = focused.dataset.cat;
      setTimeout(function () {
        var still = grid.querySelector('.feature-card.is-focus');
        if (still && still.dataset.cat === heroPending) setHeroPhoto(heroPending);
      }, 150);
    }
  }
  function clearModeStyles() {
    var cards = grid.children;
    for (var i = 0; i < cards.length; i++) {
      cards[i].style.transform = ''; cards[i].style.opacity = ''; cards[i].style.filter = '';
      var shell = cards[i].querySelector('.card-shell');
      if (shell) { shell.style.transform = ''; shell.style.opacity = ''; shell.style.removeProperty('--dim'); }
    }
  }
  function onScroll() { if (!raf) raf = requestAnimationFrame(update); }
  // Desktop drives: vertical wheel slides the strip, mouse drag grabs it.
  // Card click is suppressed only after a real drag, so taps still open.
  var suppressClick = false;
  grid.addEventListener('click', function (e) {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  grid.addEventListener('wheel', function (e) {
    if (mqMobile.matches) return;
    var d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (!d) return;
    var max = grid.scrollWidth - grid.clientWidth;
    if ((d < 0 && grid.scrollLeft <= 0) || (d > 0 && grid.scrollLeft >= max)) return; // let the page scroll at the ends
    e.preventDefault();
    grid.scrollLeft += d;
  }, { passive: false });
  var drag = null;
  grid.addEventListener('pointerdown', function (e) {
    if (mqMobile.matches || e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, sl: grid.scrollLeft, moved: false };
  });
  grid.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 7) {
      drag.moved = true;
      grid.style.scrollSnapType = 'none'; // snap must not fight an active drag
      try { grid.setPointerCapture(e.pointerId); } catch (err) {}
    }
    if (drag.moved) grid.scrollLeft = drag.sl - dx;
  });
  function endDrag() {
    if (drag && drag.moved) {
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 50);
      grid.style.scrollSnapType = '';
    }
    drag = null;
  }
  grid.addEventListener('pointerup', endDrag);
  grid.addEventListener('pointercancel', endDrag);
  function enable() {
    if (active) return;
    if (document.body.classList.contains('motion-light')) return;
    active = true;
    document.body.classList.add('orbit-live');
    grid.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // Warm the full-screen photos so the first category switch crossfades
    // instead of fetching + decoding mid-swipe (the visible white flash).
    heroImgs.forEach(function (p) {
      var im = p.querySelector('img');
      if (im && im.decode) im.decode().catch(function () {});
    });
    if (mqMobile.addEventListener) mqMobile.addEventListener('change', function () { clearModeStyles(); onScroll(); });
    update();
    if (mqMobile.matches && !drifted) {
      drifted = true;
      var touched = false, drifting = false, gestured = false;
      grid.addEventListener('pointerdown', function () { gestured = true; }, { passive: true });
      grid.addEventListener('scroll', function () {
        if (drifting) return;
        touched = true;
        var cue = document.getElementById('swipeCue');
        if (cue && gestured && grid.scrollLeft > 30) cue.classList.add('cue-hidden');
      }, { passive: true });
      setTimeout(function () {
        if (touched) return;
        drifting = true;
        grid.scrollBy({ left: 72, behavior: 'smooth' });
        setTimeout(function () {
          grid.scrollBy({ left: -72, behavior: 'smooth' });
          setTimeout(function () { drifting = false; }, 800);
        }, 750);
      }, 2400);
    }
  }
  var drifted = false;
  // Entrance animations use fill-mode, which would override these inline
  // styles forever; hand over once the entrance has played (its final
  // keyframes match the natural state, so removing the class is invisible).
  var handed = false;
  function handover() {
    if (handed) return;
    handed = true;
    document.body.classList.remove('entering');
    enable();
  }
  new MutationObserver(function () {
    if (document.body.classList.contains('entering')) setTimeout(handover, 1900);
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  if (!document.body.classList.contains('gated') && !document.body.classList.contains('entering')) enable();
})();

  // ---- Entry gate (unchanged behaviour): welcome screen, guest, sign out ----
  const signOutBtn = $("openAuth");
  const greeting = $("greeting");
  function hasEntered() { try { return sessionStorage.getItem("civicEntered") === "1" && !!currentUser(); } catch (e) { return false; } }
  function showApp() {
    document.body.classList.remove("gated");
    document.body.classList.add("home-active");
    document.documentElement.classList.add("snap-y");
    const reveal = () => document.body.classList.add("entering");
    if (window.civicPlayScene) window.civicPlayScene(reveal); else reveal();
    const user = currentUser();
    greeting.textContent = user && user.name ? "Hi, " + user.name + "." : "";
    signOutBtn.textContent = user && user.account ? "Sign out" : "Sign in";
    const chip = $("userChip");
    if (user && user.account && user.name) { chip.textContent = user.name; chip.classList.remove("hidden"); }
    else chip.classList.add("hidden");
    window.scrollTo(0, 0);
  }
  function showWelcome() {
    $("userChip").classList.add("hidden");
    document.body.classList.add("gated");
    document.body.classList.remove("home-active");
    document.documentElement.classList.remove("snap-y");
    signOutBtn.textContent = "Sign in";
    window.scrollTo(0, 0);
    $("accountBtn").focus();
  }
  // Hide the mobile scroll cue once the user has scrolled the home panels.
  (function () {
    var cue = $("swipeCue");
    if (!cue) return;
    var hidden = false;
    window.addEventListener("scroll", function () {
      if (hidden || window.scrollY < 400) return;
      hidden = true;
      cue.classList.add("cue-hidden");
    }, { passive: true });
  })();

  document.getElementById("guestBtn").addEventListener("click", () => {
    writeStorage("civicUser", { name: "Guest" });
    try { sessionStorage.setItem("civicEntered", "1"); } catch (e) { /* continue */ }
    showApp();
  });
  window.civicEnter = function (name, account) {
    writeStorage("civicUser", account ? { name: name, account: true } : { name: name });
    try { sessionStorage.setItem("civicEntered", "1"); } catch (e) { /* continue */ }
    showApp();
  };
  signOutBtn.addEventListener("click", () => {
    if (document.body.classList.contains("gated")) return;
    const user = currentUser();
    if (user && user.account) {
      try { localStorage.removeItem("civicUser"); sessionStorage.removeItem("civicEntered"); } catch (e) { /* ignore */ }
      if (window.civicSignOut) window.civicSignOut();
      showWelcome();
    } else {
      showWelcome();
      if (window.civicOpenAccount) window.civicOpenAccount();
    }
  });

  // One-time cleanup of data saved by the earliest demo version (plain-text password / account list).
  (function cleanLegacyData() {
    try {
      localStorage.removeItem("civicAccount");
      localStorage.removeItem("civicAccounts");
      const user = readStorage("civicUser", null);
      if (user && typeof user === "object" && "email" in user) writeStorage("civicUser", { name: typeof user.name === "string" ? user.name.slice(0, 40) : "" });
    } catch (e) { /* storage unavailable */ }
  })();


  // ---- Motion layer: simple adaptation of the kprverse.com feel ----
  // Typed boot line once per entry, masked headline reveal (CSS), staggered cards,
  // feature-card hover, slide between views (CSS). Everything skips under reduced-motion.
  // Best motion per device: full calm motion normally; light mode when the device asks for
  // reduced motion, has few cores, or is saving data. Light mode skips entry animations and
  // continuous loops; short fades between steps stay.
  const REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LOW_POWER = !!(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    !!(navigator.connection && navigator.connection.saveData);
  const LIGHT_MOTION = REDUCED_MOTION || LOW_POWER;
  if (LIGHT_MOTION) document.body.classList.add("motion-light");
  (function maskHeadline() {
    const h1 = document.querySelector(".intro h1");
    if (!h1) return;
    const parts = h1.innerHTML.split("<br>");
    h1.innerHTML = parts.map(p => '<span class="mask"><span>' + p + "</span></span>").join("");
  })();
  buildFeatureGrid();
  renderDeviceReports();
  // Home is the front door: first visit (and any visit without a session)
  // enters as a guest straight after the intro. The sign-in page is still
  // there from the header's Sign in, on sign-out, and when posting or
  // joining a discussion asks for an account.
  if (!hasEntered()) {
    writeStorage("civicUser", { name: "Guest" });
    try { sessionStorage.setItem("civicEntered", "1"); } catch (e) { /* continue */ }
  }
  showApp();
})();
