import { loginDonor } from "./api.js";
import { showToast } from "./common.js";

document.addEventListener("DOMContentLoaded", () => {
  const donorId = localStorage.getItem("donor_id");
  if (donorId) {
    window.location.href = "dashboard.html";
    return;
  }

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const phone = document.getElementById("phone").value.trim();

    try {
      const donor = await loginDonor(phone);
      localStorage.setItem("donor_id", donor._id);
      showToast("Login successful!", "success");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 500);
    } catch (err) {
      showToast(err.message, "error");
    }
  });
});
