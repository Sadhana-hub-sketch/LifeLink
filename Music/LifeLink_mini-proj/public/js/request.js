import { getRequestDetail, logDonation, cancelRequest } from "./api.js";
import { showToast, escapeHtml } from "./common.js";

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const reqId = urlParams.get("id");

  if (!reqId) {
    showToast("Invalid request ID", "error");
    window.location.href = "requests.html";
    return;
  }

  const storedKey = localStorage.getItem(`mk_${reqId}`);
  await loadRequestDetail(reqId, storedKey);
});

async function loadRequestDetail(reqId, manageKey) {
  const detailCard = document.getElementById("request-detail-card");
  const managerSection = document.getElementById("manager-section");

  try {
    const data = await getRequestDetail(reqId, manageKey);

    const urgencyClass = `badge-urgency-${data.urgency}`;
    const unitsLeft = Math.max(0, data.units - (data.unitsFulfilled || 0));

    detailCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span class="badge badge-blood" style="font-size: 1rem;">${escapeHtml(data.bloodGroup)}</span>
            <h1 style="font-size: 1.3rem; font-weight: 700;">${escapeHtml(data.patientName)}</h1>
            <span class="badge ${urgencyClass}">${escapeHtml(data.urgency.toUpperCase())}</span>
            <span class="badge ${data.status === 'open' ? 'badge-eligible' : 'badge-ineligible'}">${escapeHtml(data.status.toUpperCase())}</span>
          </div>
          <p style="font-size: 0.95rem; margin-bottom: 4px;"><strong>Hospital:</strong> ${escapeHtml(data.hospital)}</p>
          <p style="font-size: 0.95rem; margin-bottom: 4px;"><strong>City:</strong> ${escapeHtml(data.city)}</p>
          <p style="font-size: 0.95rem; margin-bottom: 4px;"><strong>Contact Person:</strong> ${escapeHtml(data.contactName)}</p>
          <p style="font-size: 0.95rem; margin-bottom: 4px;"><strong>Units Needed:</strong> ${unitsLeft} remaining (Total ${data.units} required)</p>
        </div>
      </div>
    `;

    // If manage key was supplied and acceptedBy array is returned
    if (manageKey && Array.isArray(data.acceptedBy)) {
      managerSection.style.display = "block";

      const pct = Math.min(100, Math.round(((data.unitsFulfilled || 0) / data.units) * 100));
      document.getElementById("progress-text").textContent = `${data.unitsFulfilled || 0} of ${data.units} units fulfilled`;
      document.getElementById("progress-bar-fill").style.width = `${pct}%`;

      renderAcceptedDonors(data.acceptedBy, reqId, manageKey, data.status);

      // Cancel Button Handler
      const cancelBtn = document.getElementById("cancel-request-btn");
      if (data.status !== "open") {
        cancelBtn.style.display = "none";
      } else {
        cancelBtn.style.display = "inline-flex";
        cancelBtn.onclick = async () => {
          if (confirm("Are you sure you want to cancel this blood request?")) {
            try {
              await cancelRequest(reqId, manageKey);
              showToast("Request cancelled", "info");
              await loadRequestDetail(reqId, manageKey);
            } catch (err) {
              showToast(err.message, "error");
            }
          }
        };
      }
    } else {
      managerSection.style.display = "none";
    }

  } catch (err) {
    detailCard.innerHTML = `<p style="color: var(--red-text);">Error loading details: ${escapeHtml(err.message)}</p>`;
  }
}

function renderAcceptedDonors(acceptedList, reqId, manageKey, status) {
  const container = document.getElementById("accepted-donors-container");

  if (!acceptedList || acceptedList.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 16px;">
        <p>No donors have accepted this request yet.</p>
      </div>
    `;
    return;
  }

  let html = "";
  for (const item of acceptedList) {
    const phoneDigits = item.phone ? item.phone.replace(/\D/g, "") : "";
    const acceptedDateStr = new Date(item.acceptedAt).toLocaleString();

    let markBtnHtml = "";
    if (item.donated) {
      markBtnHtml = `<span class="badge badge-eligible">✓ Donation Recorded</span>`;
    } else if (status === "open") {
      markBtnHtml = `<button class="btn btn-sm btn-primary mark-donated-btn" data-donorid="${item.donorId}">Mark Donated (1 Unit)</button>`;
    } else {
      markBtnHtml = `<span class="badge badge-urgency-normal">Closed</span>`;
    }

    html += `
      <div class="card" style="margin-bottom: 10px; background-color: var(--bg-color);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="font-weight: 700; font-size: 0.95rem;">${escapeHtml(item.name)} (${escapeHtml(item.bloodGroup)})</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">
              📞 Phone: <strong>${escapeHtml(item.phone)}</strong> &bull; Accepted at: ${acceptedDateStr}
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <a href="tel:${phoneDigits}" class="btn btn-sm btn-secondary">📞 Call</a>
            ${markBtnHtml}
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  container.querySelectorAll(".mark-donated-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const donorId = e.target.getAttribute("data-donorid");
      try {
        await logDonation({ requestId: reqId, donorId, units: 1 }, manageKey);
        showToast("Donation confirmed and logged!", "success");
        await loadRequestDetail(reqId, manageKey);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });
}
