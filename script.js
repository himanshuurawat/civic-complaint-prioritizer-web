const starterIssues = [
  { title: "Pothole near community market", category: "Roads", location: "Lake View Market", description: "A deep pothole is making it difficult for two-wheelers to pass safely.", date: "Today" },
  { title: "Overflowing waste bin", category: "Waste", location: "Green Park", description: "The public bin has not been cleared and waste is spreading onto the footpath.", date: "Today" },
  { title: "Streetlight not working", category: "Streetlights", location: "Station Road", description: "The road near the bus stop remains dark after sunset.", date: "Yesterday" },
  { title: "Water leakage beside footpath", category: "Water", location: "North Ward", description: "Continuous leakage is creating a slippery surface near the crossing.", date: "Yesterday" },
  { title: "Broken drain cover", category: "Safety", location: "East Colony", description: "A missing cover near the school entrance creates a safety risk.", date: "2 days ago" },
  { title: "Garbage collection missed", category: "Waste", location: "Old Town", description: "Residents report that collection has not happened for two days.", date: "2 days ago" }
];

const storedIssues = JSON.parse(localStorage.getItem("civicIssues") || "null");
let issues = storedIssues || starterIssues;
const issueList = document.getElementById("issueList");
const count = document.getElementById("heroIssueCount");
const authModal = document.getElementById("authModal");
let authMode = "login";

function saveIssues() { localStorage.setItem("civicIssues", JSON.stringify(issues)); }
function renderIssues() {
  const category = document.getElementById("categoryFilter").value;
  const visible = category === "All" ? issues : issues.filter(issue => issue.category === category);
  issueList.innerHTML = visible.map(issue => `<article class="issue-card"><div class="issue-meta"><span class="tag">${issue.category}</span><span>${issue.date}</span></div><h3>${issue.title}</h3><p>${issue.description}</p><small>📍 ${issue.location}</small></article>`).join("") || "<p>No reports match this category yet.</p>";
  count.textContent = issues.length;
}

document.getElementById("categoryFilter").addEventListener("change", renderIssues);
function currentUser() { return JSON.parse(localStorage.getItem("civicUser") || "null"); }
function closeAuth() { authModal.classList.remove("visible"); authModal.setAttribute("aria-hidden", "true"); }
function updateAuthModal() {
  const signup = authMode === "signup";
  document.getElementById("authTitle").textContent = signup ? "Create your account" : "Welcome back";
  document.getElementById("authSubtitle").textContent = signup ? "Create an account before reporting civic issues." : "Log in before reporting an issue.";
  document.getElementById("nameField").classList.toggle("hidden", !signup);
  document.getElementById("authName").required = signup;
  document.getElementById("authSubmit").textContent = signup ? "Create account" : "Log in";
  document.querySelectorAll(".auth-tabs button").forEach(button => button.classList.toggle("active", button.dataset.mode === authMode));
}
function openAuth(mode = "login") { authMode = mode; updateAuthModal(); authModal.classList.add("visible"); authModal.setAttribute("aria-hidden", "false"); }
function requireLogin() { if (currentUser()) document.getElementById("report").scrollIntoView({ behavior: "smooth" }); else openAuth("signup"); }
document.getElementById("openAuth").addEventListener("click", () => openAuth("login"));
document.getElementById("closeAuth").addEventListener("click", closeAuth);
document.getElementById("navReport").addEventListener("click", requireLogin);
document.getElementById("heroReport").addEventListener("click", requireLogin);
document.querySelectorAll(".auth-tabs button").forEach(button => button.addEventListener("click", () => { authMode = button.dataset.mode; updateAuthModal(); }));
authModal.addEventListener("click", event => { if (event.target === authModal) closeAuth(); });
document.getElementById("authForm").addEventListener("submit", event => {
  event.preventDefault();
  const email = document.getElementById("authEmail").value.trim().toLowerCase();
  const password = document.getElementById("authPassword").value;
  const name = document.getElementById("authName").value.trim();
  const registered = JSON.parse(localStorage.getItem("civicAccount") || "null");
  const message = document.getElementById("authMessage");
  if (authMode === "signup") {
    localStorage.setItem("civicAccount", JSON.stringify({ name, email, password }));
    localStorage.setItem("civicUser", JSON.stringify({ name, email }));
    message.textContent = "Account created. You can now submit a report.";
  } else if (registered && registered.email === email && registered.password === password) {
    localStorage.setItem("civicUser", JSON.stringify({ name: registered.name, email }));
    message.textContent = "Logged in successfully.";
  } else { message.textContent = "No matching demo account found. Please sign up first."; return; }
  setTimeout(() => { closeAuth(); document.getElementById("report").scrollIntoView({ behavior: "smooth" }); }, 500);
});
document.getElementById("reportForm").addEventListener("submit", event => {
  event.preventDefault();
  if (!currentUser()) { openAuth("signup"); return; }
  const form = new FormData(event.target);
  issues.unshift({ title: form.get("title"), category: form.get("category"), location: form.get("location"), description: form.get("description"), date: "Just now" });
  saveIssues(); renderIssues(); event.target.reset();
  document.getElementById("formMessage").textContent = "Your report is now visible on the community board.";
  document.getElementById("issues").scrollIntoView({ behavior: "smooth" });
});

renderIssues();
