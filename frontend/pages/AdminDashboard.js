(function () {
  window.AdminDashboard = {
    template: `
      <section>
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
          <div>
            <span class="eyebrow">Administrator</span>
            <h1 class="h3 mb-2">Admin dashboard</h1>
            <p class="text-muted mb-0">Dashboard, CRUD operations, and search tools from admin APIs.</p>
          </div>
          <button class="btn btn-outline-primary" @click="refreshAll" :disabled="loading">Refresh all</button>
        </div>

        <div v-if="error" class="alert alert-danger">{{ error }}</div>
        <div v-if="success" class="alert alert-success">{{ success }}</div>

        <div class="row g-4 mb-4">
          <div class="col-sm-6 col-xl-3" v-for="card in cards" :key="card.label">
            <div class="card border-0 shadow-sm stat-card h-100">
              <div class="card-body">
                <p class="text-muted small mb-2">{{ card.label }}</p>
                <h2 class="display-6 fw-semibold mb-0">{{ card.value }}</h2>
              </div>
            </div>
          </div>
        </div>

        <div class="card app-card shadow-sm border-0 mb-4">
          <div class="card-body">
            <h2 class="h5 mb-3">Appointment status summary</h2>
            <div class="row g-4">
              <div class="col-md-7">
                <div style="height:260px;">
                  <canvas ref="statusChart"></canvas>
                </div>
              </div>
              <div class="col-md-5">
                <table class="table align-middle mb-0">
                  <tbody>
                    <tr><td>Scheduled</td><td>{{ stats.scheduled_appointments || 0 }}</td></tr>
                    <tr><td>Completed</td><td>{{ stats.completed_appointments || 0 }}</td></tr>
                    <tr><td>Cancelled</td><td>{{ stats.cancelled_appointments || 0 }}</td></tr>
                    <tr><td>Departments</td><td>{{ stats.total_departments || 0 }}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div class="card app-card shadow-sm border-0 mb-4">
          <div class="card-body">
            <h2 class="h5 mb-3">Doctors</h2>
            <form class="row g-3 mb-3" @submit.prevent="searchDoctors">
              <div class="col-md-4">
                <input v-model.trim="doctorSearch.name" class="form-control" placeholder="Doctor name">
              </div>
              <div class="col-md-4">
                <input v-model.trim="doctorSearch.department" class="form-control" placeholder="Department">
              </div>
              <div class="col-md-4 d-flex gap-2">
                <button class="btn btn-outline-primary" type="submit">Search</button>
                <button class="btn btn-outline-secondary" type="button" @click="clearDoctorSearch">Reset</button>
              </div>
            </form>

            <form class="row g-3 mb-3" @submit.prevent="submitDoctor">
              <div class="col-md-3"><input v-model.trim="doctorForm.name" class="form-control" placeholder="Name" required></div>
              <div class="col-md-3"><input v-model.trim="doctorForm.email" type="email" class="form-control" placeholder="Email" required></div>
              <div class="col-md-2"><input v-model="doctorForm.password" class="form-control" placeholder="Password" required></div>
              <div class="col-md-2"><input v-model.trim="doctorForm.contact" class="form-control" placeholder="Contact" required></div>
              <div class="col-md-2"><select v-model="doctorForm.department_id" class="form-select" required><option value="">Department</option><option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option></select></div>
              <div class="col-md-3"><input v-model.number="doctorForm.experience" type="number" class="form-control" placeholder="Experience (years)" required></div>
              <div class="col-md-6"><input v-model.trim="doctorForm.qualification" class="form-control" placeholder="Qualification" required></div>
              <div class="col-md-3"><button class="btn btn-primary w-100" type="submit">Add doctor</button></div>
            </form>

            <div class="table-responsive">
              <table class="table align-middle">
                <thead><tr><th>Name</th><th>Department</th><th>Contact</th><th>Experience</th><th class="text-end">Actions</th></tr></thead>
                <tbody>
                  <tr v-if="!doctors.length"><td colspan="5" class="text-center text-muted py-3">No doctors found.</td></tr>
                  <tr v-for="doctor in doctors" :key="doctor.id">
                    <td>{{ doctor.name }}</td>
                    <td>{{ doctor.department_name || '-' }}</td>
                    <td>{{ doctor.contact || '-' }}</td>
                    <td>{{ doctor.experience || '-' }}</td>
                    <td class="text-end d-flex justify-content-end gap-2">
                      <button class="btn btn-sm btn-outline-primary" @click="editDoctor(doctor)">Edit</button>
                      <button class="btn btn-sm btn-outline-danger" @click="removeDoctor(doctor.id)">Delete</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card app-card shadow-sm border-0 mb-4">
          <div class="card-body">
            <h2 class="h5 mb-3">Departments</h2>
            <form class="row g-3 mb-3" @submit.prevent="submitDepartment">
              <div class="col-md-4"><input v-model.trim="departmentForm.name" class="form-control" placeholder="Department name" required></div>
              <div class="col-md-6"><input v-model.trim="departmentForm.description" class="form-control" placeholder="Description" required></div>
              <div class="col-md-2"><button class="btn btn-primary w-100" type="submit">Add</button></div>
            </form>
            <div class="table-responsive">
              <table class="table align-middle">
                <thead><tr><th>ID</th><th>Name</th><th>Description</th><th class="text-end">Actions</th></tr></thead>
                <tbody>
                  <tr v-if="!departments.length"><td colspan="4" class="text-center text-muted py-3">No departments found.</td></tr>
                  <tr v-for="department in departments" :key="department.id">
                    <td>{{ department.id }}</td>
                    <td>{{ department.name }}</td>
                    <td>{{ department.description }}</td>
                    <td class="text-end d-flex justify-content-end gap-2">
                      <button class="btn btn-sm btn-outline-primary" @click="editDepartment(department)">Edit</button>
                      <button class="btn btn-sm btn-outline-danger" @click="removeDepartment(department.id)">Delete</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card app-card shadow-sm border-0 mb-4">
          <div class="card-body">
            <h2 class="h5 mb-3">Patients</h2>
            <form class="row g-3 mb-3" @submit.prevent="loadPatients">
              <div class="col-md-3"><input v-model.trim="patientSearch.name" class="form-control" placeholder="Name"></div>
              <div class="col-md-3"><input v-model.trim="patientSearch.id" class="form-control" placeholder="Patient ID"></div>
              <div class="col-md-3"><input v-model.trim="patientSearch.contact" class="form-control" placeholder="Contact"></div>
              <div class="col-md-3 d-flex gap-2">
                <button class="btn btn-outline-primary" type="submit">Search</button>
                <button class="btn btn-outline-secondary" type="button" @click="clearPatientSearch">Reset</button>
              </div>
            </form>

            <form class="row g-3 mb-3" @submit.prevent="submitPatient">
              <div class="col-md-2"><input v-model.trim="patientForm.name" class="form-control" placeholder="Name" required></div>
              <div class="col-md-2"><input v-model.trim="patientForm.email" type="email" class="form-control" placeholder="Email" required></div>
              <div class="col-md-2"><input v-model="patientForm.password" class="form-control" placeholder="Password" required></div>
              <div class="col-md-2"><input v-model.trim="patientForm.contact" class="form-control" placeholder="Contact"></div>
              <div class="col-md-2"><input v-model="patientForm.dob" type="date" class="form-control" required></div>
              <div class="col-md-1"><input v-model.number="patientForm.age" type="number" class="form-control" placeholder="Age" required></div>
              <div class="col-md-2"><select v-model="patientForm.gender" class="form-select" required><option value="">Gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
              <div class="col-md-8"><input v-model.trim="patientForm.address" class="form-control" placeholder="Address"></div>
              <div class="col-md-3"><button class="btn btn-primary w-100" type="submit">Add patient</button></div>
            </form>

            <div class="table-responsive">
              <table class="table align-middle">
                <thead><tr><th>ID</th><th>Name</th><th>Contact</th><th>Age</th><th>Gender</th><th class="text-end">Actions</th></tr></thead>
                <tbody>
                  <tr v-if="!patients.length"><td colspan="6" class="text-center text-muted py-3">No patients found.</td></tr>
                  <tr v-for="patient in patients" :key="patient.id">
                    <td>{{ patient.id }}</td>
                    <td>{{ patient.name }}</td>
                    <td>{{ patient.contact || '-' }}</td>
                    <td>{{ patient.age ?? '-' }}</td>
                    <td>{{ patient.gender || '-' }}</td>
                    <td class="text-end d-flex justify-content-end gap-2">
                      <button class="btn btn-sm btn-outline-primary" @click="editPatient(patient)">Edit</button>
                      <button class="btn btn-sm btn-outline-danger" @click="removePatient(patient.id)">Delete</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card app-card shadow-sm border-0">
          <div class="card-body">
            <h2 class="h5 mb-3">Appointments</h2>
            <div class="table-responsive">
              <table class="table align-middle">
                <thead><tr><th>Doctor</th><th>Patient</th><th>Date</th><th>Time</th><th>Status</th><th class="text-end">Action</th></tr></thead>
                <tbody>
                  <tr v-if="!adminAppointments.length"><td colspan="6" class="text-center text-muted py-3">No appointments found.</td></tr>
                  <tr v-for="appointment in adminAppointments" :key="appointment.id">
                    <td>{{ appointment.doctor_name || '-' }}</td>
                    <td>{{ appointment.patient_name || '-' }}</td>
                    <td>{{ appointment.date }}</td>
                    <td>{{ appointment.time ? appointment.time.slice(0, 5) : '-' }}</td>
                    <td>
                      <select class="form-select form-select-sm" v-model="appointment.status">
                        <option value="scheduled">scheduled</option>
                        <option value="completed">completed</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                    </td>
                    <td class="text-end">
                      <button class="btn btn-sm btn-outline-primary" @click="saveAppointmentStatus(appointment)">Update</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    `,
    data() {
      return {
        loading: false,
        error: "",
        success: "",
        stats: {},
        statusChartInstance: null,
        doctors: [],
        departments: [],
        patients: [],
        adminAppointments: [],
        doctorSearch: { name: "", department: "" },
        patientSearch: { name: "", id: "", contact: "" },
        doctorForm: {
          name: "",
          email: "",
          password: "",
          contact: "",
          department_id: "",
          experience: "",
          qualification: ""
        },
        departmentForm: {
          name: "",
          description: ""
        },
        patientForm: {
          name: "",
          email: "",
          password: "",
          contact: "",
          dob: "",
          age: "",
          gender: "",
          address: ""
        }
      };
    },
    computed: {
      cards() {
        return [
          { label: "Total doctors", value: this.stats.total_doctors || 0 },
          { label: "Total patients", value: this.stats.total_patients || 0 },
          { label: "Total appointments", value: this.stats.total_appointments || 0 },
          { label: "Departments", value: this.stats.total_departments || 0 }
        ];
      }
    },
    mounted() {
      this.refreshAll();
    },
    beforeUnmount() {
      this.destroyChart();
    },
    methods: {
      setError(error) {
        this.error = error.message || "Request failed";
      },
      setSuccess(message) {
        this.success = message;
        setTimeout(() => {
          this.success = "";
        }, 2200);
      },
      destroyChart() {
        if (this.statusChartInstance) {
          this.statusChartInstance.destroy();
          this.statusChartInstance = null;
        }
      },
      renderChart() {
        if (!window.Chart || !this.$refs.statusChart) return;
        this.destroyChart();
        const ctx = this.$refs.statusChart.getContext("2d");
        this.statusChartInstance = new window.Chart(ctx, {
          type: "doughnut",
          data: {
            labels: ["Scheduled", "Completed", "Cancelled"],
            datasets: [{
              data: [
                this.stats.scheduled_appointments || 0,
                this.stats.completed_appointments || 0,
                this.stats.cancelled_appointments || 0
              ],
              backgroundColor: ["#f0ad4e", "#198754", "#dc3545"]
            }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
        });
      },
      async refreshAll() {
        this.loading = true;
        this.error = "";
        try {
          await Promise.all([
            this.loadDashboard(),
            this.loadDoctors(),
            this.loadDepartments(),
            this.loadPatients(),
            this.loadAdminAppointments()
          ]);
        } catch (error) {
          this.setError(error);
        } finally {
          this.loading = false;
        }
      },
      async loadDashboard() {
        this.stats = await window.Api.getAdminDashboard();
        this.$nextTick(() => this.renderChart());
      },
      async loadDoctors() {
        this.doctors = await window.Api.searchAdminDoctors(this.doctorSearch);
      },
      async searchDoctors() {
        this.error = "";
        try {
          await this.loadDoctors();
        } catch (error) {
          this.setError(error);
        }
      },
      clearDoctorSearch() {
        this.doctorSearch = { name: "", department: "" };
        this.searchDoctors();
      },
      async submitDoctor() {
        this.error = "";
        try {
          await window.Api.createDoctor({
            name: this.doctorForm.name,
            email: this.doctorForm.email,
            password: this.doctorForm.password,
            contact: this.doctorForm.contact,
            department_id: Number(this.doctorForm.department_id),
            experience: Number(this.doctorForm.experience) || 0,
            qualification: this.doctorForm.qualification
          });
          this.doctorForm = { name: "", email: "", password: "", contact: "", department_id: "", experience: "", qualification: "" };
          this.setSuccess("Doctor created");
          await Promise.all([this.loadDoctors(), this.loadDashboard()]);
        } catch (error) {
          this.setError(error);
        }
      },
      async editDoctor(doctor) {
        const name = window.prompt("Doctor name", doctor.name || "");
        if (name === null) return;
        const contact = window.prompt("Contact", doctor.contact || "");
        if (contact === null) return;
        const experience = window.prompt("Experience", doctor.experience || "");
        if (experience === null) return;
        const qualification = window.prompt("Qualification", doctor.qualification || "");
        if (qualification === null) return;
        const department_id = window.prompt("Department ID", doctor.department_id || "");
        if (department_id === null) return;
        try {
          await window.Api.updateDoctor(doctor.id, { 
            name, 
            contact, 
            experience: Number(experience) || 0, 
            qualification,
            department_id: Number(department_id)
          });
          this.setSuccess("Doctor updated");
          await this.loadDoctors();
        } catch (error) {
          this.setError(error);
        }
      },
      async removeDoctor(id) {
        if (!window.confirm("Delete this doctor?")) return;
        try {
          await window.Api.deleteDoctor(id);
          this.setSuccess("Doctor deleted");
          await Promise.all([this.loadDoctors(), this.loadDashboard()]);
        } catch (error) {
          this.setError(error);
        }
      },
      async loadDepartments() {
        this.departments = await window.Api.getDepartments();
      },
      async submitDepartment() {
        this.error = "";
        try {
          await window.Api.createDepartment(this.departmentForm);
          this.departmentForm = { name: "", description: "" };
          this.setSuccess("Department created");
          await Promise.all([this.loadDepartments(), this.loadDashboard()]);
        } catch (error) {
          this.setError(error);
        }
      },
      async editDepartment(department) {
        const name = window.prompt("Department name", department.name || "");
        if (name === null) return;
        const description = window.prompt("Description", department.description || "");
        if (description === null) return;
        try {
          await window.Api.updateDepartment(department.id, { name, description });
          this.setSuccess("Department updated");
          await this.loadDepartments();
        } catch (error) {
          this.setError(error);
        }
      },
      async removeDepartment(id) {
        if (!window.confirm("Delete this department?")) return;
        try {
          await window.Api.deleteDepartment(id);
          this.setSuccess("Department deleted");
          await Promise.all([this.loadDepartments(), this.loadDoctors(), this.loadDashboard()]);
        } catch (error) {
          this.setError(error);
        }
      },
      async loadPatients() {
        this.patients = await window.Api.getAdminPatients(this.patientSearch);
      },
      clearPatientSearch() {
        this.patientSearch = { name: "", id: "", contact: "" };
        this.loadPatients();
      },
      async submitPatient() {
        this.error = "";
        try {
          await window.Api.createAdminPatient({
            name: this.patientForm.name,
            email: this.patientForm.email,
            password: this.patientForm.password,
            contact: this.patientForm.contact,
            dob: this.patientForm.dob,
            age: Number(this.patientForm.age) || 0,
            gender: this.patientForm.gender,
            address: this.patientForm.address,
            medical_history: ""
          });
          this.patientForm = { name: "", email: "", password: "", contact: "", dob: "", age: "", gender: "", address: "" };
          this.setSuccess("Patient created");
          await Promise.all([this.loadPatients(), this.loadDashboard()]);
        } catch (error) {
          this.setError(error);
        }
      },
      async editPatient(patient) {
        const name = window.prompt("Patient name", patient.name || "");
        if (name === null) return;
        const contact = window.prompt("Contact", patient.contact || "");
        if (contact === null) return;
        const age = window.prompt("Age", patient.age || "");
        if (age === null) return;
        const gender = window.prompt("Gender", patient.gender || "");
        if (gender === null) return;
        try {
          await window.Api.updateAdminPatient(patient.id, { name, contact, age, gender });
          this.setSuccess("Patient updated");
          await this.loadPatients();
        } catch (error) {
          this.setError(error);
        }
      },
      async removePatient(id) {
        if (!window.confirm("Delete this patient?")) return;
        try {
          await window.Api.deleteAdminPatient(id);
          this.setSuccess("Patient deleted");
          await Promise.all([this.loadPatients(), this.loadDashboard()]);
        } catch (error) {
          this.setError(error);
        }
      },
      async loadAdminAppointments() {
        this.adminAppointments = await window.Api.getAdminAppointments();
      },
      async saveAppointmentStatus(appointment) {
        try {
          await window.Api.updateAdminAppointment(appointment.id, { status: appointment.status });
          this.setSuccess("Appointment updated");
          await Promise.all([this.loadAdminAppointments(), this.loadDashboard()]);
        } catch (error) {
          this.setError(error);
        }
      }
    }
  };
})();
