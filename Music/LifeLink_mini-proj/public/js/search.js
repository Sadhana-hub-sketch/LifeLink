import { searchDonors } from "./api.js";
import { populateCitySelect, showToast, escapeHtml } from "./common.js";

let map = null;
let markersGroup = null;

document.addEventListener("DOMContentLoaded", async () => {
  await populateCitySelect("city-select");

  // Read URL query params
  const urlParams = new URLSearchParams(window.location.search);
  const bgParam = urlParams.get("bloodGroup");
  const cityParam = urlParams.get("city");

  if (bgParam) {
    document.getElementById("blood-group").value = bgParam;
  }
  if (cityParam) {
    document.getElementById("city-select").value = cityParam;
  }

  // Auto-search if bloodGroup & city/location provided
  if (bgParam && (cityParam || (urlParams.get("lat") && urlParams.get("lng")))) {
    performSearch();
  }

  document.getElementById("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    performSearch();
  });

  document.getElementById("geo-btn").addEventListener("click", () => {
    if (!navigator.geolocation) {
      showToast("Geolocation is not supported by your browser", "error");
      return;
    }

    showToast("Getting current location...", "info");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        document.getElementById("geo-lat").value = pos.coords.latitude;
        document.getElementById("geo-lng").value = pos.coords.longitude;
        document.getElementById("city-select").value = "";
        showToast("Location captured via GPS", "success");
        performSearch();
      },
      (err) => {
        showToast(`GPS Error: ${err.message}`, "error");
      }
    );
  });
});

async function performSearch() {
  const bloodGroup = document.getElementById("blood-group").value;
  const city = document.getElementById("city-select").value;
  const lat = document.getElementById("geo-lat").value;
  const lng = document.getElementById("geo-lng").value;

  if (!bloodGroup) {
    showToast("Please select a recipient blood group", "error");
    return;
  }

  if (!city && (!lat || !lng)) {
    showToast("Please select a city or use GPS location", "error");
    return;
  }

  const params = { bloodGroup };
  if (lat && lng) {
    params.lat = lat;
    params.lng = lng;
  } else if (city) {
    params.city = city;
  }

  const resultsWrapper = document.getElementById("results-wrapper");
  const donorsList = document.getElementById("donors-list");
  const emptyState = document.getElementById("empty-state");
  const expansionNotice = document.getElementById("expansion-notice");

  resultsWrapper.style.display = "none";
  emptyState.style.display = "none";
  expansionNotice.style.display = "none";

  try {
    const data = await searchDonors(params);

    if (data.expanded) {
      expansionNotice.style.display = "block";
      document.getElementById("expansion-text").textContent =
        `No eligible donors within 5 km. Automatically expanded radius to ${data.radiusUsedKm} km.`;
    }

    if (!data.donors || data.donors.length === 0) {
      emptyState.style.display = "block";
      return;
    }

    resultsWrapper.style.display = "block";
    renderDonorsList(data.donors, donorsList);
    initOrUpdateMap(data.donors);

  } catch (err) {
    showToast(err.message, "error");
  }
}

function renderDonorsList(donors, container) {
  let html = "";
  for (const donor of donors) {
    const phoneDigits = donor.phone ? donor.phone.replace(/\D/g, "") : "";

    let eligibilityBadge = "";
    if (donor.eligible) {
      eligibilityBadge = `<span class="badge badge-eligible">Available now</span>`;
    } else {
      eligibilityBadge = `<span class="badge badge-ineligible">Eligible in ${donor.daysLeft} days</span>`;
    }

    const cardOpacity = donor.eligible ? "1.0" : "0.75";

    html += `
      <div class="card" style="opacity: ${cardOpacity}; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <h3 style="font-size: 1.05rem; font-weight: 700;">${escapeHtml(donor.name)}</h3>
              <span class="badge badge-blood">${escapeHtml(donor.bloodGroup)}</span>
              ${eligibilityBadge}
            </div>
            <p style="font-size: 0.9rem; color: var(--text-muted);">
              📍 ${escapeHtml(donor.city)} &bull; ${donor.distanceKm} km away
            </p>
          </div>

          <div style="display: flex; gap: 8px;">
            <a href="tel:${phoneDigits}" class="btn btn-sm btn-secondary">📞 Call</a>
            <a href="https://wa.me/${phoneDigits}" target="_blank" rel="noopener" class="btn btn-sm btn-whatsapp">💬 WhatsApp</a>
          </div>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
}

function initOrUpdateMap(donors) {
  if (!map) {
    map = L.map("search-map").setView([13.0827, 80.2707], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
    markersGroup = L.layerGroup().addTo(map);
  } else {
    markersGroup.clearLayers();
  }

  const bounds = [];
  donors.forEach(donor => {
    if (donor.lat && donor.lng) {
      // Leaflet requires [latitude, longitude]
      const marker = L.marker([donor.lat, donor.lng]).addTo(markersGroup);
      marker.bindPopup(`
        <strong>${escapeHtml(donor.name)}</strong> (${escapeHtml(donor.bloodGroup)})<br>
        City: ${escapeHtml(donor.city)}<br>
        Status: ${donor.eligible ? 'Available' : 'Eligible in ' + donor.daysLeft + ' days'}
      `);
      bounds.push([donor.lat, donor.lng]);
    }
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [30, 30] });
  }
}
