import { registerDonor } from "./api.js";
import { populateCitySelect, showToast } from "./common.js";

let map = null;
let marker = null;
let currentLat = 13.0827;
let currentLng = 80.2707;

document.addEventListener("DOMContentLoaded", async () => {
  await populateCitySelect("city-select", "Chennai");
  initMap(currentLat, currentLng);

  // Update max date on last donation date picker (cannot be future)
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("last-donation").setAttribute("max", today);

  document.getElementById("city-select").addEventListener("change", async (e) => {
    const cityName = e.target.value;
    if (!cityName) return;

    try {
      const res = await fetch("/data/cities.json");
      const cities = await res.json();
      const city = cities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
      if (city) {
        updateMapLocation(city.lat, city.lng);
      }
    } catch (err) {
      console.error(err);
    }
  });

  document.getElementById("gps-btn").addEventListener("click", () => {
    if (!navigator.geolocation) {
      showToast("Geolocation is not supported by your browser", "error");
      return;
    }
    showToast("Getting GPS location...", "info");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateMapLocation(pos.coords.latitude, pos.coords.longitude);
        showToast("Location updated via GPS", "success");
      },
      (err) => {
        showToast(`GPS error: ${err.message}`, "error");
      }
    );
  });

  document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const gender = document.getElementById("gender").value;
    const bloodGroup = document.getElementById("blood-group").value;
    const phone = document.getElementById("phone").value.trim();
    const city = document.getElementById("city-select").value;
    const lastDonationDate = document.getElementById("last-donation").value;

    const payload = {
      name,
      gender,
      bloodGroup,
      phone,
      city,
      lat: currentLat,
      lng: currentLng,
      lastDonationDate: lastDonationDate || undefined
    };

    try {
      const donor = await registerDonor(payload);
      localStorage.setItem("donor_id", donor._id);
      showToast("Registration successful!", "success");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 600);
    } catch (err) {
      showToast(err.message, "error");
    }
  });
});

function initMap(lat, lng) {
  map = L.map("register-map").setView([lat, lng], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  marker = L.marker([lat, lng], { draggable: true }).addTo(map);

  marker.on("dragend", (e) => {
    const pos = e.target.getLatLng();
    currentLat = pos.lat;
    currentLng = pos.lng;
    updateCoordsText();
  });

  updateCoordsText();
}

function updateMapLocation(lat, lng) {
  currentLat = lat;
  currentLng = lng;
  const newLatLng = new L.LatLng(lat, lng);
  marker.setLatLng(newLatLng);
  map.setView(newLatLng, 13);
  updateCoordsText();
}

function updateCoordsText() {
  const coordsText = document.getElementById("coords-text");
  if (coordsText) {
    coordsText.textContent = `Lat: ${currentLat.toFixed(4)}, Lng: ${currentLng.toFixed(4)}`;
  }
}
