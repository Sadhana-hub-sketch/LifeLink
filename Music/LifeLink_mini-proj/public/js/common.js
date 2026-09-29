export function renderNav() {
  const navElement = document.getElementById("main-nav");
  if (!navElement) return;

  const donorId = localStorage.getItem("donor_id");
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  const links = [
    { text: "Search", href: "index.html" },
    { text: "Requests", href: "requests.html" },
    { text: "Shortage", href: "shortage.html" },
    { text: "Reports", href: "reports.html" }
  ];

  let authLinksHtml = "";
  if (donorId) {
    const isDashboard = currentPage === "dashboard.html";
    authLinksHtml = `
      <li><a href="dashboard.html" class="${isDashboard ? 'active' : ''}">Dashboard</a></li>
      <li><a href="#" id="logout-btn" class="btn btn-sm btn-secondary">Logout</a></li>
    `;
  } else {
    const isLogin = currentPage === "login.html";
    const isRegister = currentPage === "register.html";
    authLinksHtml = `
      <li><a href="login.html" class="${isLogin ? 'active' : ''}">Login</a></li>
      <li><a href="register.html" class="btn btn-sm nav-btn ${isRegister ? 'active' : ''}">Register</a></li>
    `;
  }

  const linksHtml = links.map(l => {
    const isActive = currentPage === l.href;
    return `<li><a href="${l.href}" class="${isActive ? 'active' : ''}">${l.text}</a></li>`;
  }).join("");

  navElement.innerHTML = `
    <div class="nav-container">
      <a href="index.html" class="brand">
        🩸 LifeLink
      </a>
      <ul class="nav-links">
        ${linksHtml}
        ${authLinksHtml}
      </ul>
    </div>
  `;

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem("donor_id");
      showToast("Logged out successfully", "success");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 500);
    });
  }
}

export function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function populateCitySelect(selectElementId, defaultCity = "") {
  const select = document.getElementById(selectElementId);
  if (!select) return;

  try {
    const res = await fetch("/data/cities.json");
    const cities = await res.json();

    let html = `<option value="">Select City...</option>`;
    for (const city of cities) {
      const selected = city.name.toLowerCase() === defaultCity.toLowerCase() ? "selected" : "";
      html += `<option value="${escapeHtml(city.name)}" ${selected}>${escapeHtml(city.name)}</option>`;
    }
    select.innerHTML = html;
  } catch (err) {
    console.error("Failed to load cities for select:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderNav();
});
