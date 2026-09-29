import { getRequests, postRequest } from "./api.js";
import { populateCitySelect, showToast, escapeHtml } from "./common.js";

document.addEventListener("DOMContentLoaded", async () => {
  await populateCitySelect("filter-city");
  await populateCitySelect("req-city", "Chennai");

  await loadRequests();

  // Auto-refresh requests every 30 seconds
  setInterval(loadRequests, 30000);

  // Filters change listeners
  document.getElementById("filter-blood-group").addEventListener("change", loadRequests);
  document.getElementById("filter-city").addEventListener("change", loadRequests);
  document.getElementById("filter-urgency").addEventListener("change", loadRequests);

  // Modal toggle buttons
  const postCard = document.getElementById("post-request-card");
  document.getElementById("show-post-modal-btn").addEventListener("click", () => {
    postCard.style.display = "block";
    postCard.scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("close-post-modal-btn").addEventListener("click", () => {
    postCard.style.display = "none";
  });

  // Post Request Form Submit
  document.getElementById("post-request-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const patientName = document.getElementById("patient-name").value.trim();
    const hospital = document.getElementById("hospital").value.trim();
    const contactName = document.getElementById("contact-name").value.trim();
    const contactPhone = document.getElementById("contact-phone").value.trim();
    const bloodGroup = document.getElementById("req-blood-group").value;
    const units = document.getElementById("req-units").value;
    const urgency = document.getElementById("req-urgency").value;
    const city = document.getElementById("req-city").value;

    const payload = {
      patientName,
      hospital,
      contactName,
      contactPhone,
      bloodGroup,
      units: Number(units),
      urgency,
      city
    };

    try {
      const res = await postRequest(payload);
      const reqId = res.request._id;
      const manageKey = res.manageKey;

      // Save manage key in localStorage
      localStorage.setItem(`mk_${reqId}`, manageKey);

      showToast("Blood request posted successfully!", "success");
      postCard.style.display = "none";
      document.getElementById("post-request-form").reset();

      // Show Manage Link Card
      const manageUrl = `${window.location.origin}/request.html?id=${reqId}`;
      const manageCard = document.getElementById("manage-link-card");
      document.getElementById("manage-link-url").value = manageUrl;
      document.getElementById("open-manage-btn").href = `request.html?id=${reqId}`;
      manageCard.style.display = "block";
      manageCard.scrollIntoView({ behavior: "smooth" });

      await loadRequests();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
});

async function loadRequests() {
  const container = document.getElementById("requests-list-container");
  const bg = document.getElementById("filter-blood-group").value;
  const city = document.getElementById("filter-city").value;
  const urgency = document.getElementById("filter-urgency").value;

  const params = {};
  if (bg) params.bloodGroup = bg;
  if (city) params.city = city;
  if (urgency) params.urgency = urgency;

  try {
    const requests = await getRequests(params);

    if (!requests || requests.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No active requests right now</h3>
          <p>There are currently no open blood requests matching your filters.</p>
        </div>
      `;
      return;
    }

    let html = "";
    for (const r of requests) {
      const remainingUnits = r.units - (r.unitsFulfilled || 0);
      const urgencyClass = `badge-urgency-${r.urgency}`;

      // Format time remaining until expiry
      const expDate = new Date(r.expiresAt);
      const diffMs = expDate.getTime() - new Date().getTime();
      const diffHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));

      // Check if user has manage key stored locally
      const storedKey = localStorage.getItem(`mk_${r._id}`);
      const manageBtnHtml = storedKey ? `<a href="request.html?id=${r._id}" class="btn btn-sm btn-secondary">🔑 Manage Request</a>` : "";

      html += `
        <div class="card" style="margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span class="badge badge-blood" style="font-size: 0.9rem;">${escapeHtml(r.bloodGroup)}</span>
                <h3 style="font-size: 1.1rem; font-weight: 700;">${escapeHtml(r.patientName)}</h3>
                <span class="badge ${urgencyClass}">${escapeHtml(r.urgency.toUpperCase())}</span>
              </div>

              <p style="font-size: 0.9rem; color: var(--text-main); margin-bottom: 4px;">
                🏥 <strong>${escapeHtml(r.hospital)}</strong> &bull; 📍 ${escapeHtml(r.city)}
              </p>

              <p style="font-size: 0.85rem; color: var(--text-muted);">
                Units: <strong>${remainingUnits} needed</strong> (${r.unitsFulfilled || 0}/${r.units} fulfilled) &bull;
                ${r.acceptedCount || 0} donors accepted &bull;
                ⏱️ Expires in ${diffHours}h
              </p>
            </div>

            <div style="display: flex; gap: 8px; align-items: center;">
              ${manageBtnHtml}
              <a href="index.html?bloodGroup=${encodeURIComponent(r.bloodGroup)}&city=${encodeURIComponent(r.city)}" class="btn btn-sm btn-primary">
                Find Donors
              </a>
            </div>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p style="color: var(--red-text);">Error loading requests: ${escapeHtml(err.message)}</p>`;
  }
}
