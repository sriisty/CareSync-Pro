(function () {
  window.AppointmentHistory = {
    template: `
      <section>
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
          <div>
            <span class="eyebrow">Records</span>
            <h1 class="h3 mb-2">Appointment history</h1>
            <p class="text-muted mb-0">Past and current appointment activity with treatment details.</p>
          </div>
          <div class="d-flex gap-2" v-if="userRole === 'patient'">
            <select v-model="filter" class="form-select" @change="loadHistory">
              <option value="">All</option>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
            </select>
          </div>
        </div>

        <div v-if="error" class="alert alert-danger">{{ error }}</div>

        <div class="card app-card shadow-sm border-0">
          <div class="card-body">
            <div class="table-responsive">
              <table class="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>{{ userRole === 'doctor' ? 'Patient' : 'Doctor' }}</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Diagnosis</th>
                    <th>Prescription</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!appointments.length">
                    <td colspan="6" class="text-center text-muted py-4">No appointment history available.</td>
                  </tr>
                  <tr v-for="appointment in appointments" :key="appointment.id">
                    <td>{{ userRole === 'doctor' ? appointment.patient_name : appointment.doctor_name }}</td>
                    <td>{{ appointment.date }}</td>
                    <td>{{ appointment.time ? appointment.time.slice(0, 5) : '' }}</td>
                    <td>
                      <span class="badge rounded-pill" :class="statusClass(appointment.status)">{{ appointment.status }}</span>
                    </td>
                    <td>{{ diagnosisText(appointment) }}</td>
                    <td>{{ prescriptionText(appointment) }}</td>
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
        error: "",
        filter: "past",
        appointments: []
      };
    },
    computed: {
      userRole() {
        const user = window.Api.getStoredUser();
        return user ? user.role : "";
      }
    },
    mounted() {
      if (this.userRole === "doctor") {
        this.filter = "";
      }
      this.loadHistory();
    },
    methods: {
      statusClass(status) {
        return {
          "text-bg-success": status === "completed",
          "text-bg-warning": status === "scheduled",
          "text-bg-danger": status === "cancelled"
        };
      },
      diagnosisText(appointment) {
        if (appointment.treatments && appointment.treatments.length) {
          return appointment.treatments.map((item) => item.diagnosis).join(", ");
        }
        return appointment.status === "completed" ? "Recorded" : "Pending";
      },
      prescriptionText(appointment) {
        if (appointment.treatments && appointment.treatments.length) {
          return appointment.treatments.map((item) => item.prescription).join(", ");
        }
        return "Not available";
      },
      async loadHistory() {
        this.error = "";
        try {
          this.appointments = await window.Api.getAppointments(this.filter, this.userRole);
        } catch (error) {
          this.error = error.message;
        }
      }
    }
  };
})();
