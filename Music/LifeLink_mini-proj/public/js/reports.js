import { getReportsSummary } from "./api.js";
import { escapeHtml } from "./common.js";

document.addEventListener("DOMContentLoaded", async () => {
  await loadReports();
});

async function loadReports() {
  try {
    const data = await getReportsSummary();

    // 1. Stat Tiles
    document.getElementById("stat-total-donors").textContent = data.totals.donors || 0;
    document.getElementById("stat-eligible-now").textContent = data.totals.eligibleNow || 0;
    document.getElementById("stat-active-requests").textContent = data.totals.activeRequests || 0;
    document.getElementById("stat-donations-30days").textContent = data.totals.donationsLast30Days || 0;

    // 2. Donors by Group Bar Chart
    renderBarChart(
      "chart-donors-group",
      data.donorsByGroup.map(d => ({ label: d.bloodGroup, value: d.count })),
      "No donor data registered yet"
    );

    // 3. Donors by City Bar Chart
    renderBarChart(
      "chart-donors-city",
      data.donorsByCity.map(d => ({ label: d.city, value: d.count })),
      "No donor city data available"
    );

    // 4. Most Requested Blood Groups
    renderBarChart(
      "chart-requests-group",
      data.requestsByGroup.map(r => ({ label: r.bloodGroup, value: r.count })),
      "No request data available"
    );

    // 5. Top Donors List
    const topDonorsContainer = document.getElementById("top-donors-container");
    if (!data.topDonors || data.topDonors.length === 0) {
      topDonorsContainer.innerHTML = `
        <div class="empty-state" style="padding: 16px;">
          <p>No donations logged yet.</p>
        </div>
      `;
    } else {
      let rowsHtml = "";
      data.topDonors.forEach((d, idx) => {
        rowsHtml += `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); font-weight: 700;">#${idx + 1}</td>
            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); font-weight: 600;">${escapeHtml(d.name)}</td>
            <td style="padding: 8px; border-bottom: 1px solid var(--border-color);"><span class="badge badge-blood">${escapeHtml(d.bloodGroup)}</span></td>
            <td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${escapeHtml(d.city)}</td>
            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); font-weight: 700; color: var(--green-text);">${d.count} donation${d.count !== 1 ? 's' : ''}</td>
          </tr>
        `;
      });

      topDonorsContainer.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
          <thead>
            <tr style="text-align: left; background-color: var(--grey-bg);">
              <th style="padding: 8px;">Rank</th>
              <th style="padding: 8px;">Name</th>
              <th style="padding: 8px;">Group</th>
              <th style="padding: 8px;">City</th>
              <th style="padding: 8px;">Donations</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    }

  } catch (err) {
    showToast(`Error loading reports: ${err.message}`, "error");
  }
}

function renderBarChart(containerId, items, emptyMessage) {
  const container = document.getElementById(containerId);
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 16px;">
        <p>${emptyMessage}</p>
      </div>
    `;
    return;
  }

  const maxValue = Math.max(...items.map(i => i.value), 1);

  let html = "";
  for (const item of items) {
    const pct = Math.max(8, Math.round((item.value / maxValue) * 100));
    html += `
      <div class="bar-chart-row">
        <div class="bar-label">
          <span><strong>${escapeHtml(item.label)}</strong></span>
          <span>${item.value}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}
