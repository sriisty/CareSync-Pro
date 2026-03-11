(function () {
  const configuredBaseUrl =
    window.__API_BASE_URL__ ||
    localStorage.getItem("apiBaseUrl") ||
    "http://localhost:5000/api";
  const BASE_URL = configuredBaseUrl.replace(/\/$/, "");
  const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

  function getDevFallbackBaseUrl() {
    const currentHost = window.location.hostname;
    if (!LOCAL_HOSTS.has(currentHost)) {
      return null;
    }

    const fallbackBaseUrl = "http://localhost:5000/api";
    if (BASE_URL === fallbackBaseUrl) {
      return null;
    }

    try {
      const resolvedUrl = new URL(BASE_URL, window.location.origin);
      const isSameOriginApi =
        resolvedUrl.origin === window.location.origin &&
        resolvedUrl.pathname.startsWith("/api");

      return isSameOriginApi ? fallbackBaseUrl : null;
    } catch (error) {
      return null;
    }
  }

  const FALLBACK_BASE_URL = getDevFallbackBaseUrl();

  async function doFetch(baseUrl, path, options, headers) {
    return fetch(`${baseUrl}${path}`, {
      ...options,
      headers
    });
  }

  async function request(path, options = {}) {
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let response;
    try {
      response = await doFetch(BASE_URL, path, options, headers);
    } catch (error) {
      if (FALLBACK_BASE_URL) {
        try {
          response = await doFetch(FALLBACK_BASE_URL, path, options, headers);
          localStorage.setItem("apiBaseUrl", FALLBACK_BASE_URL);
        } catch (fallbackError) {
          throw new Error(
            `Cannot reach backend at ${BASE_URL} or ${FALLBACK_BASE_URL}. Start the Flask backend on port 5000 and try again.`
          );
        }
      } else {
        throw new Error(`Cannot reach backend at ${BASE_URL}. Start backend server and try again.`);
      }
    }

    if ([404, 405, 501].includes(response.status) && FALLBACK_BASE_URL) {
      const fallbackResponse = await doFetch(FALLBACK_BASE_URL, path, options, headers);
      if (fallbackResponse.ok) {
        response = fallbackResponse;
        localStorage.setItem("apiBaseUrl", FALLBACK_BASE_URL);
      }
    }

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        (data && data.message) ||
        (typeof data === "string" ? data : "Request failed");
      throw new Error(message);
    }

    return data;
  }

  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch (error) {
      localStorage.removeItem("user");
      return null;
    }
  }

  function setSession(loginDetails) {
    if (!loginDetails || !loginDetails.auth_token || !loginDetails.usertype) {
      throw new Error("Invalid login response from server.");
    }

    const token = loginDetails.auth_token;
    const user = {
      email: loginDetails.email,
      role: loginDetails.usertype
    };

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    window.dispatchEvent(new Event("auth-changed"));
    return user;
  }

  function clearSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth-changed"));
  }

  async function login(payload) {
    return request("/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function register(payload) {
    return request("/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function logout() {
    return request("/logout", { method: "POST" });
  }

  async function getDoctors(params = {}) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (key === "patientSearch") return;
      if (value !== undefined && value !== null && value !== "") {
        search.append(key, value);
      }
    });

    const query = search.toString();
    const path = params.patientSearch ? "/patient/doctors/search" : "/doctors";
    const data = await request(`${path}${query ? `?${query}` : ""}`);
    return data.doctors || data["doctor details"] || [];
  }

  async function getDepartments() {
    const data = await request("/departments");
    return data["department details"] || [];
  }

  async function getAdminDashboard() {
    const data = await request("/admin/dashboard");
    return data.statistics || {};
  }

  async function searchAdminDoctors(params = {}) {
    const search = new URLSearchParams();
    if (params.name) search.append("name", params.name);
    if (params.department) search.append("department", params.department);
    const query = search.toString();
    const data = await request(`/admin/doctors/search${query ? `?${query}` : ""}`);
    return data["doctor details"] || [];
  }

  async function createDoctor(payload) {
    return request("/doctors", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function updateDoctor(id, payload) {
    return request(`/doctors/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }

  async function deleteDoctor(id) {
    return request(`/doctors/${id}`, { method: "DELETE" });
  }

  async function createDepartment(payload) {
    return request("/departments", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function updateDepartment(id, payload) {
    return request(`/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }

  async function deleteDepartment(id) {
    return request(`/departments/${id}`, { method: "DELETE" });
  }

  async function getAdminPatients(params = {}) {
    const search = new URLSearchParams();
    if (params.name) search.append("name", params.name);
    if (params.id) search.append("id", params.id);
    if (params.contact) search.append("contact", params.contact);
    const query = search.toString();
    const data = await request(`/admin/patients${query ? `?${query}` : ""}`);
    return data["patient details"] || [];
  }

  async function createAdminPatient(payload) {
    return request("/admin/patients", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function updateAdminPatient(id, payload) {
    return request(`/admin/patients/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }

  async function deleteAdminPatient(id) {
    return request(`/admin/patients/${id}`, { method: "DELETE" });
  }

  async function getAdminAppointments() {
    const data = await request("/admin/appointments");
    return data.appointments || [];
  }

  async function updateAdminAppointment(id, payload) {
    return request(`/admin/appointments/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }

  async function getDoctorAppointments(filter = "") {
    const query = filter ? `?filter=${encodeURIComponent(filter)}` : "";
    const data = await request(`/doctor/appointments${query}`);
    return data.appointments || [];
  }

  async function getPatientProfile() {
    const data = await request("/patient/profile");
    return data.profile || {};
  }

  async function getPatientNotifications() {
    const data = await request("/patient/notifications");
    return data.notifications || [];
  }

  async function updatePatientProfile(payload) {
    return request("/patient/profile", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }

  async function getAppointments(filter = "", role) {
    if (role === "doctor") {
      return getDoctorAppointments(filter);
    }

    const query = filter ? `?filter=${encodeURIComponent(filter)}` : "";
    const data = await request(`/patient/appointments${query}`);
    return data.appointments || [];
  }

  async function bookAppointment(payload) {
    return request("/patient/appointments", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function updateAppointment(id, payload, role = "patient") {
    const prefix = role === "doctor" ? "/doctor/appointments" : "/patient/appointments";
    return request(`${prefix}/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }

  async function cancelPatientAppointment(id) {
    return request(`/patient/appointments/${id}`, { method: "DELETE" });
  }

  async function getDoctorSchedule(doctorId) {
    const data = await request(`/patient/doctors/${doctorId}/schedule`);
    return data.schedule || [];
  }

  async function getDoctorPatients() {
    const data = await request("/doctor/patients");
    return data.patients || [];
  }

  async function getDoctorPatientHistory(patientId) {
    const data = await request(`/doctor/patients/${patientId}/history`);
    return data.history || [];
  }

  async function updateDoctorPatientHistory(patientId, medicalHistory) {
    return request(`/doctor/patients/${patientId}/history`, {
      method: "PUT",
      body: JSON.stringify({ medical_history: medicalHistory })
    });
  }

  async function getDoctorOwnSchedule() {
    const data = await request("/doctor/schedule");
    return data.schedule || [];
  }

  async function updateDoctorOwnSchedule(schedule) {
    return request("/doctor/schedule", {
      method: "POST",
      body: JSON.stringify(schedule)
    });
  }

  async function exportPatientCsv() {
    return request("/patient/export/csv", { method: "POST" });
  }

  window.Api = {
    BASE_URL,
    request,
    login,
    register,
    logout,
    getDoctors,
    searchAdminDoctors,
    createDoctor,
    updateDoctor,
    deleteDoctor,
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    getAdminPatients,
    createAdminPatient,
    updateAdminPatient,
    deleteAdminPatient,
    getAdminAppointments,
    updateAdminAppointment,
    getAdminDashboard,
    getAppointments,
    getDoctorAppointments,
    getPatientProfile,
    updatePatientProfile,
    bookAppointment,
    updateAppointment,
    cancelPatientAppointment,
    getDoctorSchedule,
    getDoctorPatients,
    getDoctorPatientHistory,
    updateDoctorPatientHistory,
    getDoctorOwnSchedule,
    updateDoctorOwnSchedule,
    exportPatientCsv,
    getPatientNotifications,
    getStoredUser,
    setSession,
    clearSession
  };
})();
