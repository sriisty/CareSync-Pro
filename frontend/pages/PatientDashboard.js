(function () {
  window.PatientDashboard = {
    template: `
      <section>
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
          <div>
            <span class="eyebrow">Patient Portal</span>
            <h1 class="h3 mb-2">Patient dashboard</h1>
            <p class="text-muted mb-0">Profile, appointments, doctors, and export.</p>
          </div>
          <div class="d-flex gap-2">
            <router-link to="/book-appointment" class="btn btn-primary">New appointment</router-link>
            <button class="btn btn-outline-primary" @click="triggerCsvExport">Export CSV</button>
          </div>
        </div>

        <div v-if="error" class="alert alert-danger">{{ error }}</div>
        <div v-if="success" class="alert alert-success">{{ success }}</div>

        <div class="row g-4 mb-4">
          <div class="col-xl-4">
            <div class="card app-card shadow-sm border-0 h-100">
              <div class="card-body">
                <h2 class="h5 mb-3">Profile</h2>
                <form @submit.prevent="saveProfile" class="row g-2">
                  <div class="col-12"><input v-model.trim="profileForm.name" class="form-control" placeholder="Name"></div>
                  <div class="col-6"><input v-model.trim="profileForm.contact" class="form-control" placeholder="Contact"></div>
                  <div class="col-6"><input v-model.number="profileForm.age" type="number" class="form-control" placeholder="Age"></div>
                  <div class="col-6"><input v-model="profileForm.dob" type="date" class="form-control"></div>
                  <div class="col-6"><input v-model.trim="profileForm.gender" class="form-control" placeholder="Gender"></div>
                  <div class="col-12"><input v-model.trim="profileForm.address" class="form-control" placeholder="Address"></div>
                  <div class="col-12"><textarea v-model.trim="profileForm.medical_history" class="form-control" rows="2" placeholder="Medical history"></textarea></div>
                  <div class="col-12"><button class="btn btn-outline-primary w-100" type="submit">Save profile</button></div>
                </form>
              </div>
            </div>
          </div>

          <div class="col-xl-8">
            <div class="card app-card shadow-sm border-0 h-100">
              <div class="card-body">
                <h2 class="h5 mb-3">Departments</h2>
                <div class="row g-3">
                  <div class="col-md-6" v-for="department in departments" :key="department.id">
                    <div class="department-tile h-100">
                      <h3 class="h6 mb-1">{{ department.name }}</h3>
                      <p class="text-muted small mb-0">{{ department.description }}</p>
                    </div>
                  </div>
                  <div v-if="!departments.length" class="col-12 text-muted">No departments available.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="row g-4 mb-4">
          <div class="col-lg-6">
            <div class="card app-card shadow-sm border-0 h-100">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <h2 class="h5 mb-0">Available doctors</h2>
                  <router-link to="/search-doctors" class="small text-decoration-none">Advanced search</router-link>
                </div>
                <div class="row g-3">
                  <div class="col-12" v-for="doctor in doctors.slice(0, 5)" :key="doctor.id">
                    <div class="doctor-inline-card">
                      <div>
                        <h3 class="h6 mb-1">Dr. {{ doctor.name }}</h3>
                        <p class="small text-muted mb-1">{{ doctor.department_name || 'General' }}</p>
                        <p class="small mb-0">Experience: {{ doctor.experience || 0 }} years</p>
                      </div>
                      <router-link :to="'/book-appointment?doctorId=' + doctor.id" class="btn btn-outline-primary btn-sm">Book</router-link>
                    </div>
                  </div>
                  <div v-if="!doctors.length" class="col-12 text-muted">No doctors available.</div>
                </div>
              </div>
            </div>
          </div>

          <div class="col-lg-6">
            <div class="card app-card shadow-sm border-0 h-100">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <h2 class="h5 mb-0">Upcoming appointments</h2>
                  <router-link to="/history" class="small text-decoration-none">View history</router-link>
                </div>
                <div class="table-responsive">
                  <table class="table align-middle mb-0">
                    <thead><tr><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
                    <tbody>
                      <tr v-if="!appointments.length"><td colspan="5" class="text-center text-muted py-4">No upcoming appointments.</td></tr>
                      <tr v-for="appointment in appointments" :key="appointment.id">
                        <td>{{ appointment.doctor_name }}</td>
                        <td>{{ appointment.date }}</td>
                        <td>{{ appointment.time.slice(0, 5) }}</td>
                        <td><span class="badge text-bg-warning">{{ appointment.status }}</span></td>
                        <td class="text-end d-flex justify-content-end gap-2">
                          <button class="btn btn-sm btn-outline-primary" @click="rescheduleAppointment(appointment)">Reschedule</button>
                          <button class="btn btn-sm btn-outline-danger" @click="cancelAppointment(appointment.id)">Cancel</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

      </section>
    `,
    data() {
      return {
        error: "",
        success: "",
        profileForm: {
          name: "",
          contact: "",
          age: "",
          dob: "",
          gender: "",
          address: "",
          medical_history: ""
        },
        departments: [],
        doctors: [],
        appointments: []
      };
    },
    mounted() {
      this.loadDashboard();
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
      scheduleForDate(schedule, dateValue) {
        if (!dateValue) return [];
        return schedule.filter(
          (slot) => slot.is_available !== false && slot.available_date === dateValue
        );
      },
      isTimeWithinSchedule(schedule, dateValue, timeValue) {
        if (!dateValue || !timeValue) return false;
        return this.scheduleForDate(schedule, dateValue).some(
          (slot) => timeValue >= slot.start_time.slice(0, 5) && timeValue <= slot.end_time.slice(0, 5)
        );
      },
      async loadDashboard() {
        this.error = "";
        try {
          const [profile, departments, doctors, appointments] = await Promise.all([
            window.Api.getPatientProfile(),
            window.Api.getDepartments(),
            window.Api.getDoctors(),
            window.Api.getAppointments("upcoming", "patient")
          ]);
          this.profileForm = {
            name: profile.name || "",
            contact: profile.contact || "",
            age: profile.age || "",
            dob: profile.dob || "",
            gender: profile.gender || "",
            address: profile.address || "",
            medical_history: profile.medical_history || ""
          };
          this.departments = departments;
          this.doctors = doctors;
          this.appointments = appointments;
        } catch (error) {
          this.setError(error);
        }
      },
      async saveProfile() {
        this.error = "";
        try {
          await window.Api.updatePatientProfile(this.profileForm);
          this.setSuccess("Profile updated");
          await this.loadDashboard();
        } catch (error) {
          this.setError(error);
        }
      },
      async rescheduleAppointment(appointment) {
        const date = window.prompt("New date (YYYY-MM-DD)", appointment.date || "");
        if (!date) return;
        const time = window.prompt("New time (HH:MM)", appointment.time ? appointment.time.slice(0, 5) : "");
        if (!time) return;
        try {
          const schedule = await window.Api.getDoctorSchedule(appointment.doctor_id);
          if (!this.scheduleForDate(schedule, date).length) {
            throw new Error("Selected doctor is not available on that date.");
          }
          if (!this.isTimeWithinSchedule(schedule, date, time)) {
            throw new Error("Selected time is outside the doctor's available schedule.");
          }
          await window.Api.updateAppointment(appointment.id, {
            appointment_date: date,
            appointment_time: `${time}:00`
          }, "patient");
          this.setSuccess("Appointment rescheduled");
          await this.loadDashboard();
        } catch (error) {
          this.setError(error);
        }
      },
      async cancelAppointment(id) {
        if (!window.confirm("Cancel this appointment?")) return;
        try {
          await window.Api.cancelPatientAppointment(id);
          this.setSuccess("Appointment cancelled");
          await this.loadDashboard();
        } catch (error) {
          this.setError(error);
        }
      },
      async triggerCsvExport() {
        try {
          const result = await window.Api.exportPatientCsv();
          this.setSuccess(result.message || "Export requested");
        } catch (error) {
          this.setError(error);
        }
      }
    }
  };
})();
