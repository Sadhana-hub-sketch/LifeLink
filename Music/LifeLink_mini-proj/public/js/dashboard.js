import { getDonorMe, updateDonorMe, getRequestsForMe, acceptRequest, logDonation, getDonationsMe } from "./api.js";
import { showToast, escapeHtml } from "./common.js";

document.addEventListener("DOMContentLoaded", async () => {
  const donorId = localStorage.getItem("donor_id");
  if (!donorId) {
    window.location.href = "login.html";
    return;
  }

  // Set max date for donation date input
  const today = new Date().toISOString().split("T")[0];
  const donationDateInput = document.getElementById("donation-date");
  if (donationDateInput) {
    donationDateInput.value = today;
    donationDateInput.setAttribute("max", today);
  }

  await loadProfile();
  await loadNearbyRequests();
  await loadDonationHistory();

  document.getElementById("available-toggle").addEventListener("change", async (e) => {
    try {
      const isAvailable = e.target.checked;
      await updateDonorMe({ available: isAvailable });
      showToast(`Availability updated to ${isAvailable ? 'Available' : 'Unavailable'}`, "success");
      await loadNearbyRequests();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.getElementById("log-donation-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const dateVal = document.getElementById("donation-date").value;
    const unitsVal = document.getElementById("donation-units").value;

    try {
      const res = await logDonation({
        donatedAt: dateVal,
        units: Number(unitsVal)
      });
      showToast("Walk-in donation recorded successfully!", "success");
      await loadProfile();
      await loadDonationHistory();
      await loadNearbyRequests();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
});

async function loadProfile() {
  try {
    const donor = await getDonorMe();
    document.getElementById("donor-blood-badge").textContent = donor.bloodGroup;

    const profileHtml = `
      <p style="margin-bottom: 4px;"><strong>Name:</strong> ${escapeHtml(donor.name)}</p>
      <p style="margin-bottom: 4px;"><strong>Phone:</strong> ${escapeHtml(donor.phone)}</p>
      <p style="margin-bottom: 4px;"><strong>City:</strong> ${escapeHtml(donor.city)}</p>
      <p style="margin-bottom: 4px;"><strong>Total Donations:</strong> ${donor.donationCount || 0}</p>
    `;
    document.getElementById("profile-info").innerHTML = profileHtml;
    document.getElementById("available-toggle").checked = Boolean(donor.available);

    // Update Countdown box
    const countdownCard = document.getElementById("countdown-card");
    const numEl = document.getElementById("countdown-days");
    const subtextEl = document.getElementById("countdown-subtext");

    if (donor.eligible) {
      countdownCard.className = "card countdown-box ready";
      numEl.textContent = "Available";
      subtextEl.textContent = "You can donate blood now!";
    } else {
      countdownCard.className = "card countdown-box";
      numEl.textContent = `${donor.daysLeft} Days`;
      const dateStr = donor.eligibleOn ? new Date(donor.eligibleOn).toLocaleDateString() : "";
      subtextEl.textContent = `Eligible on ${dateStr}`;
    }
  } catch (err) {
    showToast(`Failed to load profile: ${err.message}`, "error");
    if (err.message.includes("Unauthorized") || err.message.includes("not found")) {
      localStorage.removeItem("donor_id");
      window.location.href = "login.html";
    }
  }
}

async function loadNearbyRequests() {
  const container = document.getElementById("nearby-requests-container");
  try {
    const res = await getRequestsForMe();

    if (res.reason) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 20px;">
          <p><strong>Note:</strong> ${escapeHtml(res.reason)}</p>
        </div>
      `;
      return;
    }

    const requests = res.requests || [];
    if (requests.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 20px;">
          <h3>No nearby requests right now</h3>
          <p>You'll see urgent matching requests here when patients in your area need blood.</p>
        </div>
      `;
      return;
    }

    let html = "";
    for (const r of requests) {
      const unitsLeft = r.units - (r.unitsFulfilled || 0);
      const urgencyClass = `badge-urgency-${r.urgency}`;

      let actionBlock = "";
      if (r.hasAccepted) {
        actionBlock = `<span class="badge badge-eligible">Accepted by you</span>`;
      } else {
        actionBlock = `<button class="btn btn-sm btn-primary accept-req-btn" data-id="${r._id}">Accept Request</button>`;
      }

      html += `
        <div class="card" style="margin-bottom: 12px; border-left: 4px solid var(--primary-red);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <h4 style="font-size: 1rem; font-weight: 700;">${escapeHtml(r.patientName)} (${escapeHtml(r.bloodGroup)})</h4>
                <span class="badge ${urgencyClass}">${escapeHtml(r.urgency.toUpperCase())}</span>
              </div>
              <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 2px;">
                🏥 ${escapeHtml(r.hospital)}, ${escapeHtml(r.city)} &bull; <strong>${r.distanceKm} km away</strong>
              </p>
              <p style="font-size: 0.85rem; color: var(--text-main);">
                Units Needed: <strong>${unitsLeft}</strong> of ${r.units} (${r.acceptedCount || 0} accepted)
              </p>
            </div>
            <div id="action-slot-${r._id}">
              ${actionBlock}
            </div>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;

    // Attach click listeners to Accept buttons
    container.querySelectorAll(".accept-req-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const reqId = e.target.getAttribute("data-id");
        try {
          const acceptRes = await acceptRequest(reqId);
          showToast("Request accepted!", "success");
          const slot = document.getElementById(`action-slot-${reqId}`);
          if (slot) {
            slot.innerHTML = `
              <div style="background-color: var(--green-bg); padding: 8px 12px; border-radius: 6px; font-size: 0.85rem; color: var(--green-text);">
                <strong>Contact:</strong> ${escapeHtml(acceptRes.contactName)} (${escapeHtml(acceptRes.contactPhone)})
              </div>
            `;
          }
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    });

  } catch (err) {
    container.innerHTML = `<p style="color: var(--red-text);">Error loading requests: ${escapeHtml(err.message)}</p>`;
  }
}

async function loadDonationHistory() {
  const container = document.getElementById("donation-history-container");
  try {
    const donations = await getDonationsMe();

    if (!donations || donations.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 20px;">
          <p>No donation records found yet.</p>
        </div>
      `;
      return;
    }

    let rowsHtml = "";
    for (const d of donations) {
      const dateStr = new Date(d.donatedAt).toLocaleDateString();
      const typeStr = d.requestId ? `Request (${escapeHtml(d.requestId.hospital || 'Hospital')})` : "Walk-in";
      rowsHtml += `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${dateStr}</td>
          <td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${escapeHtml(d.bloodGroup)}</td>
          <td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${d.units}</td>
          <td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${typeStr}</td>
        </tr>
      `;
    }

    container.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
        <thead>
          <tr style="text-align: left; background-color: var(--grey-bg);">
            <th style="padding: 8px;">Date</th>
            <th style="padding: 8px;">Group</th>
            <th style="padding: 8px;">Units</th>
            <th style="padding: 8px;">Type</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color: var(--red-text);">Error loading history: ${escapeHtml(err.message)}</p>`;
  }
}
