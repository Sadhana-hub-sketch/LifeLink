const API_BASE = "/api";

export async function requestApi(endpoint, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const donorId = localStorage.getItem("donor_id");
  if (donorId) {
    headers["x-donor-id"] = donorId;
  }

  const config = {
    ...options,
    headers
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `HTTP error! status: ${res.status}`);
    }
    return data;
  } catch (err) {
    throw err;
  }
}

// Donors
export function registerDonor(payload) {
  return requestApi("/donors", { method: "POST", body: JSON.stringify(payload) });
}

export function loginDonor(phone) {
  return requestApi("/donors/login", { method: "POST", body: JSON.stringify({ phone }) });
}

export function getDonorMe() {
  return requestApi("/donors/me", { method: "GET" });
}

export function updateDonorMe(payload) {
  return requestApi("/donors/me", { method: "PATCH", body: JSON.stringify(payload) });
}

export function searchDonors(params) {
  const query = new URLSearchParams(params).toString();
  return requestApi(`/donors/search?${query}`, { method: "GET" });
}

// Requests
export function postRequest(payload) {
  return requestApi("/requests", { method: "POST", body: JSON.stringify(payload) });
}

export function getRequests(params = {}) {
  const query = new URLSearchParams(params).toString();
  return requestApi(`/requests?${query}`, { method: "GET" });
}

export function getRequestsForMe() {
  return requestApi("/requests/for-me", { method: "GET" });
}

export function getRequestDetail(id, manageKey = null) {
  const headers = {};
  if (manageKey) {
    headers["x-manage-key"] = manageKey;
  }
  return requestApi(`/requests/${id}`, { method: "GET", headers });
}

export function acceptRequest(id) {
  return requestApi(`/requests/${id}/accept`, { method: "POST" });
}

export function cancelRequest(id, manageKey) {
  return requestApi(`/requests/${id}/cancel`, {
    method: "PATCH",
    headers: { "x-manage-key": manageKey }
  });
}

// Donations
export function logDonation(payload, manageKey = null) {
  const headers = {};
  if (manageKey) {
    headers["x-manage-key"] = manageKey;
  }
  return requestApi("/donations", {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
}

export function getDonationsMe() {
  return requestApi("/donations/me", { method: "GET" });
}

// Shortage & Reports
export function getShortage(city = "") {
  const q = city ? `?city=${encodeURIComponent(city)}` : "";
  return requestApi(`/shortage${q}`, { method: "GET" });
}

export function getReportsSummary() {
  return requestApi("/reports/summary", { method: "GET" });
}
