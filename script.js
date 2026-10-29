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
function isValidIssue(issue) {
  return issue && typeof issue === "object" && typeof issue.title === "string" && typeof issue.category === "string" && typeof issue.location === "string" && typeof issue.description === "string";
}
// One-time cleanup of data saved by earlier versions of this demo. The first version kept the
// signup password as typed under "civicAccount"; remove it and any other account list, and keep
// only the display name from an old signed-in user (drop the saved email).
function cleanLegacyData() {
  try {
    localStorage.removeItem("civicAccount");
    localStorage.removeItem("civicAccounts");
    const user = readStorage("civicUser", null);
    if (user && typeof user === "object" && "email" in user) {
      writeStorage("civicUser", { name: typeof user.name === "string" ? user.name.slice(0, 40) : "" });
    }
  } catch (error) { /* storage unavailable: nothing to clean */ }
}

cleanLegacyData();
const storedIssues = readStorage("civicIssues", null);
const validStored = Array.isArray(storedIssues) ? storedIssues.filter(isValidIssue) : [];
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
  const meta = makeEl("div", "issue-meta");
  meta.append(makeEl("span", "tag", issue.category), makeEl("span", "", formatDate(issue)));
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
    note.textContent = "Please fill in every field. Spaces alone do not count.";
    return;
  }
  issues.unshift({ title: title.slice(0, 70), category, location: location.slice(0, 70), description: description.slice(0, 280), createdAt: new Date().toISOString() });
  if (!saveIssues()) { note.textContent = "Your report is shown, but this browser could not save it."; }
  renderIssues(); event.target.reset();
  if (!note.textContent.startsWith("Your report is shown")) note.textContent = "Your report is now visible on the community board.";
  document.getElementById("issues").scrollIntoView({ behavior: "smooth" });
});

renderIssues();
