const DAY = 86400000;
const starterIssues = [
  { title: "Pothole near community market", category: "Roads", location: "Lake View Market", description: "A deep pothole is making it difficult for two-wheelers to pass safely.", ageDays: 0 },
  { title: "Overflowing waste bin", category: "Waste", location: "Green Park", description: "The public bin has not been cleared and waste is spreading onto the footpath.", ageDays: 0 },
  { title: "Streetlight not working", category: "Streetlights", location: "Station Road", description: "The road near the bus stop remains dark after sunset.", ageDays: 1 },
  { title: "Water leakage beside footpath", category: "Water", location: "North Ward", description: "Continuous leakage is creating a slippery surface near the crossing.", ageDays: 1 },
  { title: "Broken drain cover", category: "Safety", location: "East Colony", description: "A missing cover near the school entrance creates a safety risk.", ageDays: 2 },
  { title: "Garbage collection missed", category: "Waste", location: "Old Town", description: "Residents report that collection has not happened for two days.", ageDays: 2 }
].map(item => ({ title: item.title, category: item.category, location: item.location, description: item.description, createdAt: new Date(Date.now() - item.ageDays * DAY).toISOString() }));

const CATEGORIES = ["Roads", "Waste", "Water", "Streetlights", "Safety"];

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}
function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (error) { return false; }
}
const DEPARTMENTS = { Roads: "Roads & Transport", Waste: "Waste & Sanitation", Water: "Water Supply", Streetlights: "Streetlights & Power", Safety: "Public Safety" };
const MAX_PHOTOS = 3;
const PHOTO_PATTERN = /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/;
function cleanPhotos(list) {
  return Array.isArray(list) ? list.filter(p => typeof p === "string" && p.length < 400000 && PHOTO_PATTERN.test(p)).slice(0, MAX_PHOTOS) : [];
}
function isValidIssue(issue) {
  return issue && typeof issue === "object" && typeof issue.title === "string" && typeof issue.category === "string" && typeof issue.location === "string" && typeof issue.description === "string";
}
const storedIssues = readStorage("civicIssues", null);
const validStored = Array.isArray(storedIssues) ? storedIssues.filter(isValidIssue).map(issue => Object.assign({}, issue, { photos: cleanPhotos(issue.photos) })) : [];
let issues = validStored.length || (Array.isArray(storedIssues) && storedIssues.length === 0) ? validStored : starterIssues;
const issueList = document.getElementById("issueList");
const count = document.getElementById("heroIssueCount");
const authModal = document.getElementById("authModal");

function saveIssues() { writeStorage("civicIssues", issues); }
function formatDate(issue) {
  if (!issue.createdAt) return issue.date || "";
  const created = new Date(issue.createdAt);
  if (Number.isNaN(created.getTime())) return "";
  const days = Math.floor((Date.now() - created.getTime()) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return days + " days ago";
  return created.toLocaleDateString();
}
function makeEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function buildCard(issue) {
  const card = makeEl("article", "issue-card");
  const photos = cleanPhotos(issue.photos);
  if (photos.length) {
    const cover = makeEl("div", "issue-photos");
    const img = document.createElement("img");
    img.src = photos[0]; img.alt = "Photo of the reported problem"; img.loading = "lazy";
    cover.append(img);
    if (photos.length > 1) cover.append(makeEl("span", "more", "+" + (photos.length - 1) + " more"));
    card.append(cover);
  }
  const meta = makeEl("div", "issue-meta");
  meta.append(makeEl("span", "tag", DEPARTMENTS[issue.category] || issue.category), makeEl("span", "", formatDate(issue)));
  card.append(meta, makeEl("h3", "", issue.title), makeEl("p", "", issue.description), makeEl("small", "", "\u{1F4CD} " + issue.location));
  return card;
}
function renderIssues() {
  const category = document.getElementById("categoryFilter").value;
  const visible = category === "All" ? issues : issues.filter(issue => issue.category === category);
  issueList.replaceChildren(...(visible.length ? visible.map(buildCard) : [makeEl("p", "", "No reports match this category yet.")]));
  count.textContent = issues.length;
}


document.getElementById("categoryFilter").addEventListener("change", renderIssues);
function currentUser() { return readStorage("civicUser", null); }
let lastFocus = null;
function closeAuth() {
  authModal.classList.remove("visible");
  authModal.setAttribute("aria-hidden", "true");
  if (lastFocus) { lastFocus.focus(); lastFocus = null; }
}
function openAuth() {
  lastFocus = document.activeElement;
  authModal.classList.add("visible");
  authModal.setAttribute("aria-hidden", "false");
  document.getElementById("authName").focus();
}
function requireLogin() { if (currentUser()) document.getElementById("report").scrollIntoView({ behavior: "smooth" }); else openAuth(); }
document.getElementById("openAuth").addEventListener("click", () => openAuth());
document.getElementById("closeAuth").addEventListener("click", closeAuth);
document.getElementById("navReport").addEventListener("click", requireLogin);
document.getElementById("heroReport").addEventListener("click", requireLogin);
authModal.addEventListener("click", event => { if (event.target === authModal) closeAuth(); });

// DEMO IDENTITY ONLY. There is no account, email or password. The display name is kept in
// this browser and anyone can edit it, so it protects nothing. Real sign-in and access
// control need a server (see README).
document.getElementById("authForm").addEventListener("submit", event => {
  event.preventDefault();
  const message = document.getElementById("authMessage");
  const name = document.getElementById("authName").value.trim();
  if (!name) { message.textContent = "Please enter a display name."; return; }
  writeStorage("civicUser", { name: name.slice(0, 40) });
  message.textContent = "Done. You can now submit a demo report.";
  setTimeout(() => { closeAuth(); document.getElementById("report").scrollIntoView({ behavior: "smooth" }); }, 500);
});
document.addEventListener("keydown", event => {
  if (!authModal.classList.contains("visible")) return;
  if (event.key === "Escape") { closeAuth(); return; }
  if (event.key === "Tab") {
    const focusable = Array.from(authModal.querySelectorAll("button, input, select, textarea, a[href]")).filter(el => el.offsetParent !== null && !el.disabled);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
document.getElementById("reportForm").addEventListener("submit", event => {
  event.preventDefault();
  const note = document.getElementById("formMessage");
  if (!currentUser()) { openAuth(); return; }
  const form = new FormData(event.target);
  const title = String(form.get("title") || "").trim();
  const location = String(form.get("location") || "").trim();
  const description = String(form.get("description") || "").trim();
  const category = String(form.get("category") || "");
  if (!title || !location || !description || !CATEGORIES.includes(category)) {
    note.textContent = "Please fill in the title, location, department and description. Spaces alone do not count.";
    return;
  }
  issues.unshift({ title: title.slice(0, 70), category, location: location.slice(0, 70), description: description.slice(0, 280), createdAt: new Date().toISOString(), photos: photos.slice() });
  if (!saveIssues()) { note.textContent = "Your report is shown, but this browser could not save it."; }
  renderIssues(); event.target.reset(); photos.length = 0; renderPhotos(); updateCount();
  if (!note.textContent.startsWith("Your report is shown")) note.textContent = "Your report is now visible on the community board.";
  document.getElementById("issues").scrollIntoView({ behavior: "smooth" });
});

renderIssues();

// Light/dark theme. The choice is remembered in this browser; the first visit follows the system setting.
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

// Entry page: sign in with a name (demo) or continue as a guest, then show the main page.
// Nothing here is real authentication. The name is kept in this browser only.
(function () {
  const welcomeForm = document.getElementById("welcomeForm");
  const nameInput = document.getElementById("welcomeName");
  const signOutBtn = document.getElementById("openAuth");
  const greeting = document.getElementById("greeting");
  function hasEntered() {
    try { return sessionStorage.getItem("civicEntered") === "1" && !!currentUser(); } catch (error) { return false; }
  }
  function showApp() {
    document.body.classList.remove("gated");
    const user = currentUser();
    greeting.textContent = user && user.name ? "Hi, " + user.name + "." : "";
    signOutBtn.textContent = "Sign out";
    window.scrollTo(0, 0);
  }
  function showWelcome() {
    document.body.classList.add("gated");
    signOutBtn.textContent = "Sign in";
    nameInput.value = "";
    window.scrollTo(0, 0);
    nameInput.focus();
  }
  function enter(name) {
    writeStorage("civicUser", { name: name });
    try { sessionStorage.setItem("civicEntered", "1"); } catch (error) { /* continue without remembering */ }
    showApp();
  }
  welcomeForm.addEventListener("submit", event => {
    event.preventDefault();
    const name = nameInput.value.trim().slice(0, 40);
    if (!name) { nameInput.focus(); return; }
    enter(name);
  });
  document.getElementById("guestBtn").addEventListener("click", () => enter("Guest"));
  // The header button now signs out and returns to the entry page.
  signOutBtn.addEventListener("click", event => {
    if (document.body.classList.contains("gated")) return;
    event.stopImmediatePropagation();
    try { localStorage.removeItem("civicUser"); sessionStorage.removeItem("civicEntered"); } catch (error) { /* ignore */ }
    showWelcome();
  }, true);
  if (hasEntered()) showApp(); else signOutBtn.textContent = "Sign in";
})();

// Report form: photos (resized in the browser, which also removes location data) and character count.
const photos = [];
const photoInput = document.getElementById("photoInput");
const photoPreview = document.getElementById("photoPreview");
function updateCount() {
  document.getElementById("descCount").textContent = document.getElementById("description").value.length + " / 280";
}
document.getElementById("description").addEventListener("input", updateCount);
function renderPhotos() {
  photoPreview.replaceChildren(...photos.map((src, index) => {
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
        const scale = Math.min(1, 800 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
photoInput.addEventListener("change", async () => {
  const note = document.getElementById("formMessage");
  const files = Array.from(photoInput.files || []);
  photoInput.value = "";
  let skipped = 0;
  for (const file of files) {
    if (photos.length >= MAX_PHOTOS) { skipped++; continue; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 15 * 1024 * 1024) { skipped++; continue; }
    try {
      const data = await shrinkPhoto(file);
      if (PHOTO_PATTERN.test(data) && data.length < 400000) photos.push(data); else skipped++;
    } catch (error) { skipped++; }
  }
  renderPhotos();
  note.textContent = skipped ? "Some files were skipped. Use up to " + MAX_PHOTOS + " JPG, PNG or WebP photos under 15 MB." : "";
});
