(function () {
  window.DoctorDashboard = {
    template: `
      <section>
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
          <div>
            <span class="eyebrow">Doctor Workspace</span>
            <h1 class="h3 mb-2">Doctor dashboard</h1>
            <p class="text-muted mb-0">Appointments, patient list/history, and schedule management.</p>
          </div>
          <div class="d-flex gap-2">
            <select v-model="filter" class="form-select" @change="loadAppointments">
              <option value="">All appointments</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
            </select>
          </div>
        </div>

        <div v-if="error" class="alert alert-danger">{{ error }}</div>
        <div v-if="success" class="alert alert-success">{{ success }}</div>

        <div class="row g-4 mb-4">
          <div class="col-lg-8">
            <div class="card app-card shadow-sm border-0">
              <div class="card-body">
                <h2 class="h5 mb-3">Assigned appointments</h2>
                <div class="table-responsive">
                  <table class="table align-middle mb-0">
                    <thead><tr><th>Patient</th><th>Date</th><th>Time</th><th>Status</th><th class="text-end">Action</th></tr></thead>
                    <tbody>
                      <tr v-if="!appointments.length"><td colspan="5" class="text-center text-muted py-4">No appointments found.</td></tr>
                      <tr v-for="appointment in appointments" :key="appointment.id">
                        <td>{{ appointment.patient_name }}</td>
                        <td>{{ appointment.date }}</td>
                        <td>{{ formatTime(appointment.time) }}</td>
                        <td><span class="badge rounded-pill" :class="statusClass(appointment.status)">{{ appointment.status }}</span></td>
                        <td class="text-end">
                          <button class="btn btn-sm btn-primary" @click="selectAppointment(appointment)" :disabled="appointment.status === 'completed'">
                            {{ appointment.status === 'completed' ? 'Completed' : 'Complete visit' }}
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div class="col-lg-4">
            <div class="card app-card shadow-sm border-0 h-100">
              <div class="card-body">
                <h2 class="h5 mb-3">Visit update</h2>
                <p v-if="!selectedAppointment" class="text-muted mb-0">Choose a scheduled appointment to record treatment details.</p>
                <form v-else @submit.prevent="completeAppointment">
                  <div class="mb-3"><label class="form-label">Selected patient</label><input class="form-control" :value="selectedAppointment.patient_name" disabled></div>
                  <div class="mb-3"><label class="form-label">Diagnosis</label><input v-model.trim="form.diagnosis" class="form-control" required></div>
                  <div class="mb-3"><label class="form-label">Prescription</label><textarea v-model.trim="form.prescription" class="form-control" rows="2" required></textarea></div>
                  <div class="mb-3"><label class="form-label">Notes</label><textarea v-model.trim="form.notes" class="form-control" rows="2"></textarea></div>
                  <div class="mb-3"><label class="form-label">Next visit date</label><input v-model="form.next_visit_date" type="date" class="form-control"></div>
                  <button class="btn btn-primary w-100" type="submit" :disabled="saving">
                    <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
                    {{ saving ? 'Saving...' : 'Mark as completed' }}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div class="row g-4">
          <div class="col-lg-6">
            <div class="card app-card shadow-sm border-0 h-100">
              <div class="card-body">
                <h2 class="h5 mb-3">Patients</h2>
                <div class="table-responsive mb-3">
                  <table class="table align-middle mb-0">
                    <thead><tr><th>Name</th><th>Contact</th><th class="text-end">Action</th></tr></thead>
                    <tbody>
                      <tr v-if="!patients.length"><td colspan="3" class="text-center text-muted py-3">No assigned patients.</td></tr>
                      <tr v-for="patient in patients" :key="patient.patient_id">
                        <td>{{ patient.name }}</td>
                        <td>{{ patient.contact || '-' }}</td>
                        <td class="text-end"><button class="btn btn-sm btn-outline-primary" @click="openPatientHistory(patient)">History</button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div v-if="activePatient">
                  <h3 class="h6">History: {{ activePatient.name }}</h3>
                  <div class="mb-3">
                    <label class="form-label">General medical history</label>
                    <div class="form-control bg-light" style="min-height: 72px;">{{ activePatient.medical_history || "No general medical history recorded." }}</div>
                  </div>
                  <ul class="list-group mb-3" v-if="patientHistory.length">
                    <li class="list-group-item" v-for="(item, idx) in patientHistory" :key="idx">
                      <strong>{{ item.date }}</strong> - {{ item.diagnosis }} / {{ item.prescription }}
                    </li>
                  </ul>
                  <p v-else class="text-muted small">No treatment history found.</p>
                  <div class="mb-2">
                    <textarea v-model.trim="patientMedicalHistory" class="form-control" rows="2" placeholder="Update general medical history"></textarea>
                  </div>
                  <button class="btn btn-outline-primary btn-sm" @click="saveMedicalHistory">Save medical history</button>
                </div>
              </div>
            </div>
          </div>

          <div class="col-lg-6">
            <div class="card app-card shadow-sm border-0 h-100">
              <div class="card-body">
                <h2 class="h5 mb-3">Schedule</h2>
                <form class="row g-2 mb-3" @submit.prevent="addScheduleSlot">
                  <div class="col-md-4">
                    <label class="form-label">Date</label>
                    <input v-model="newSlot.available_date" type="date" class="form-control" required>
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Start time</label>
                    <input v-model="newSlot.start_time" type="time" class="form-control" required>
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">End time</label>
                    <input v-model="newSlot.end_time" type="time" class="form-control" required>
                  </div>
                  <div class="col-md-2"><button class="btn btn-outline-primary w-100" type="submit">Add</button></div>
                </form>

                <ul class="list-group mb-3">
                  <li class="list-group-item d-flex justify-content-between align-items-center" v-for="(slot, idx) in doctorSchedule" :key="idx">
                    <span>{{ formatScheduleDate(slot) }}: {{ formatTime(slot.start_time) }} - {{ formatTime(slot.end_time) }}</span>
                    <button class="btn btn-sm btn-outline-danger" @click="removeScheduleSlot(idx)">Remove</button>
                  </li>
                  <li v-if="!doctorSchedule.length" class="list-group-item text-muted">No schedule slots configured.</li>
                </ul>

                <button class="btn btn-primary" @click="saveSchedule">Save schedule</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    `,
    data() {
      return {
        loading: false,
        saving: false,
        error: "",
        success: "",
        filter: "",
        appointments: [],
        selectedAppointment: null,
        form: { diagnosis: "", prescription: "", notes: "", next_visit_date: "" },
        patients: [],
        activePatient: null,
        patientHistory: [],
        patientMedicalHistory: "",
        doctorSchedule: [],
        newSlot: { available_date: "", start_time: "", end_time: "" }
      };
    },
    mounted() {
      this.loadAll();
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
      formatTime(value) {
        return value ? value.slice(0, 5) : "";
      },
      formatScheduleDate(slot) {
        if (!slot.available_date) {
          return slot.day_of_week || "No date";
        }
        const date = new Date(`${slot.available_date}T00:00:00`);
        const weekday = slot.day_of_week || date.toLocaleDateString("en-US", { weekday: "long" });
        const formattedDate = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        });
        return `${formattedDate} (${weekday})`;
      },
      statusClass(status) {
        return {
          "text-bg-success": status === "completed",
          "text-bg-warning": status === "scheduled",
          "text-bg-danger": status === "cancelled"
        };
      },
      async loadAll() {
        this.error = "";
        try {
          await Promise.all([
            this.loadAppointments(),
            this.loadPatients(),
            this.loadSchedule()
          ]);
        } catch (error) {
          this.setError(error);
        }
      },
      selectAppointment(appointment) {
        this.selectedAppointment = appointment;
        this.form = { diagnosis: "", prescription: "", notes: "", next_visit_date: "" };
      },
      async loadAppointments() {
        this.appointments = await window.Api.getDoctorAppointments(this.filter);
      },
      async completeAppointment() {
        if (!this.selectedAppointment) return;
        if (!this.form.diagnosis || !this.form.prescription) {
          this.error = "Diagnosis and prescription are required.";
          return;
        }
        this.saving = true;
        this.error = "";
        try {
          await window.Api.updateAppointment(this.selectedAppointment.id, {
            status: "completed",
            diagnosis: this.form.diagnosis,
            prescription: this.form.prescription,
            notes: this.form.notes,
            next_visit_date: this.form.next_visit_date || null
          }, "doctor");
          this.selectedAppointment = null;
          this.setSuccess("Appointment completed");
          await Promise.all([this.loadAppointments(), this.loadPatients()]);
        } catch (error) {
          this.setError(error);
        } finally {
          this.saving = false;
        }
      },
      async loadPatients() {
        this.patients = await window.Api.getDoctorPatients();
      },
      async openPatientHistory(patient) {
        this.error = "";
        try {
          this.activePatient = patient;
          this.patientHistory = await window.Api.getDoctorPatientHistory(patient.patient_id);
          this.patientMedicalHistory = patient.medical_history || "";
        } catch (error) {
          this.setError(error);
        }
      },
      async saveMedicalHistory() {
        if (!this.activePatient) return;
        try {
          await window.Api.updateDoctorPatientHistory(this.activePatient.patient_id, this.patientMedicalHistory);
          this.activePatient = {
            ...this.activePatient,
            medical_history: this.patientMedicalHistory
          };
          this.setSuccess("Medical history updated");
          await this.loadPatients();
          const refreshedPatient = this.patients.find(
            (patient) => patient.patient_id === this.activePatient.patient_id
          );
          if (refreshedPatient) {
            this.activePatient = refreshedPatient;
            this.patientMedicalHistory = refreshedPatient.medical_history || "";
          }
        } catch (error) {
          this.setError(error);
        }
      },
      async loadSchedule() {
        this.doctorSchedule = await window.Api.getDoctorOwnSchedule();
      },
      addScheduleSlot() {
        if (!this.newSlot.available_date || !this.newSlot.start_time || !this.newSlot.end_time) {
          this.error = "Date, start time, and end time are required.";
          return;
        }
        if (this.newSlot.end_time <= this.newSlot.start_time) {
          this.error = "End time must be after start time.";
          return;
        }
        this.doctorSchedule.push({
          available_date: this.newSlot.available_date,
          day_of_week: new Date(`${this.newSlot.available_date}T00:00:00`).toLocaleDateString("en-US", {
            weekday: "long"
          }),
          start_time: this.newSlot.start_time,
          end_time: this.newSlot.end_time,
          is_available: true
        });
        this.newSlot = { available_date: "", start_time: "", end_time: "" };
      },
      removeScheduleSlot(index) {
        this.doctorSchedule.splice(index, 1);
      },
      async saveSchedule() {
        try {
          const payload = this.doctorSchedule.map((slot) => ({
            available_date: slot.available_date || null,
            day_of_week: slot.day_of_week,
            start_time: this.formatTime(slot.start_time),
            end_time: this.formatTime(slot.end_time),
            is_available: slot.is_available !== false
          }));
          await window.Api.updateDoctorOwnSchedule(payload);
          this.setSuccess("Schedule saved");
          await this.loadSchedule();
        } catch (error) {
          this.setError(error);
        }
      }
    }
  };
})();
