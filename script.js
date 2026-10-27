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

function saveIssues() { localStorage.setItem("civicIssues", JSON.stringify(issues)); }
function renderIssues() {
  const category = document.getElementById("categoryFilter").value;
  const visible = category === "All" ? issues : issues.filter(issue => issue.category === category);
  issueList.innerHTML = visible.map(issue => `<article class="issue-card"><div class="issue-meta"><span class="tag">${issue.category}</span><span>${issue.date}</span></div><h3>${issue.title}</h3><p>${issue.description}</p><small>📍 ${issue.location}</small></article>`).join("") || "<p>No reports match this category yet.</p>";
  count.textContent = issues.length;
}

document.getElementById("categoryFilter").addEventListener("change", renderIssues);
document.getElementById("reportForm").addEventListener("submit", event => {
  event.preventDefault();
  const form = new FormData(event.target);
  issues.unshift({ title: form.get("title"), category: form.get("category"), location: form.get("location"), description: form.get("description"), date: "Just now" });
  saveIssues(); renderIssues(); event.target.reset();
  document.getElementById("formMessage").textContent = "Your report is now visible on the community board.";
  document.getElementById("issues").scrollIntoView({ behavior: "smooth" });
});

renderIssues();
