import { getShortage } from "./api.js";
import { escapeHtml } from "./common.js";

document.addEventListener("DOMContentLoaded", async () => {
  await loadShortageData();
  setInterval(loadShortageData, 30000);
});

async function loadShortageData() {
  const alertContainer = document.getElementById("alert-banner-container");
  const gridContainer = document.getElementById("heatmap-container");
  const lastUpdatedEl = document.getElementById("last-updated-text");

  try {
    const data = await getShortage();
    lastUpdatedEl.textContent = `Updated ${new Date(data.generatedAt).toLocaleTimeString()}`;

    // Render Alerts
    if (data.alerts && data.alerts.length > 0) {
      alertContainer.style.display = "block";
      let alertItems = data.alerts.map(a => `<li><strong>⚠️ ${escapeHtml(a.message)}</strong></li>`).join("");
      alertContainer.innerHTML = `
        <div class="alert-banner">
          <strong style="font-size: 1rem;">Critical Blood Shortage Alerts:</strong>
          <ul style="margin-top: 6px;">${alertItems}</ul>
        </div>
      `;
    } else {
      alertContainer.style.display = "none";
    }

    // Render Grid
    if (!data.cities || data.cities.length === 0) {
      gridContainer.innerHTML = `
        <div class="empty-state" style="padding: 24px;">
          <h3>No shortage data yet</h3>
          <p>No active blood requests or registered donors found across cities.</p>
        </div>
      `;
      return;
    }

    // Build Table
    const groups = data.groups || ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    const cellsMap = new Map();
    (data.cells || []).forEach(c => {
      cellsMap.set(`${c.city}|${c.bloodGroup}`, c);
    });

    let headerColsHtml = groups.map(g => `<th>${escapeHtml(g)}</th>`).join("");
    let rowsHtml = "";

    for (const city of data.cities) {
      let cellsHtml = "";
      for (const bg of groups) {
        const cellData = cellsMap.get(`${city}|${bg}`) || { demand: 0, supply: 0, level: "none" };
        const cellClass = `cell-${cellData.level}`;

        let cellContent = "";
        if (cellData.level === "none") {
          cellContent = `<span style="color: var(--text-muted);">-</span>`;
        } else {
          cellContent = `
            <a href="index.html?bloodGroup=${encodeURIComponent(bg)}&city=${encodeURIComponent(city)}" style="color: inherit; text-decoration: none; display: block;">
              <strong>${cellData.demand} req</strong> / ${cellData.supply} donor${cellData.supply !== 1 ? 's' : ''}
            </a>
          `;
        }

        cellsHtml += `<td class="${cellClass}">${cellContent}</td>`;
      }

      rowsHtml += `
        <tr>
          <td style="font-weight: 700; background-color: var(--grey-bg); text-align: left;">${escapeHtml(city)}</td>
          ${cellsHtml}
        </tr>
      `;
    }

    gridContainer.innerHTML = `
      <table class="heatmap-table">
        <thead>
          <tr>
            <th style="text-align: left;">City</th>
            ${headerColsHtml}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

  } catch (err) {
    gridContainer.innerHTML = `<p style="color: var(--red-text);">Error loading shortage data: ${escapeHtml(err.message)}</p>`;
  }
}
