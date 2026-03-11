(function () {
  window.BookAppointment = {
    template: `
      <section>
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
          <div>
            <span class="eyebrow">Appointment Desk</span>
            <h1 class="h3 mb-2">Book an appointment</h1>
            <p class="text-muted mb-0">Select a doctor and choose from the available schedule to create a new appointment.</p>
          </div>
        </div>

        <div class="row g-4">
          <div class="col-lg-7">
            <div class="card app-card shadow-sm border-0">
              <div class="card-body">
                <div v-if="error" class="alert alert-danger">{{ error }}</div>
                <div v-if="success" class="alert alert-success">{{ success }}</div>

                <form @submit.prevent="submitBooking" novalidate>
                  <div class="mb-3">
                    <label class="form-label">Doctor</label>
                    <select v-model="form.doctor_id" class="form-select" required @change="loadSchedule">
                      <option value="">Select a doctor</option>
                      <option v-for="doctor in doctors" :key="doctor.id" :value="doctor.id">
                        Dr. {{ doctor.name }} - {{ doctor.department_name || 'General' }}
                      </option>
                    </select>
                  </div>
                  <div class="row g-3">
                    <div class="col-md-6">
                      <label class="form-label">Appointment date</label>
                      <select v-model="form.appointment_date" class="form-select" :disabled="!availableDates.length" required @change="syncSelectedTime">
                        <option value="">{{ schedule.length ? "Select an available date" : "Select a doctor first" }}</option>
                        <option v-for="date in availableDates" :key="date.value" :value="date.value">
                          {{ date.label }}
                        </option>
                      </select>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Appointment time</label>
                      <select v-model="form.appointment_time" class="form-select" :disabled="!availableTimes.length" required>
                        <option value="">{{ form.appointment_date ? "Select an available time" : "Select a date first" }}</option>
                        <option v-for="time in availableTimes" :key="time" :value="time">
                          {{ time }}
                        </option>
                      </select>
                    </div>
                  </div>
                  <button class="btn btn-primary mt-4" type="submit" :disabled="loading">
                    <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                    {{ loading ? 'Booking...' : 'Book appointment' }}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div class="col-lg-5">
            <div class="card app-card shadow-sm border-0 h-100">
              <div class="card-body">
                <h2 class="h5 mb-3">Doctor availability</h2>
                <div v-if="selectedDoctor" class="mb-3">
                  <p class="small text-muted mb-0">Schedule for selected doctor</p>
                </div>
                <ul class="list-group list-group-flush" v-if="schedule.length">
                  <li class="list-group-item px-0" v-for="slot in schedule" :key="(slot.available_date || slot.day_of_week) + slot.start_time">
                    <div class="d-flex justify-content-between">
                      <span>{{ slot.available_date || slot.day_of_week }}</span>
                      <span class="text-muted">{{ slot.start_time.slice(0, 5) }} - {{ slot.end_time.slice(0, 5) }}</span>
                    </div>
                  </li>
                </ul>
                <p v-else class="text-muted mb-0">Select a doctor to view available schedule slots.</p>
              </div>
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
        doctors: [],
        schedule: [],
        form: {
          doctor_id: "",
          appointment_date: "",
          appointment_time: ""
        }
      };
    },
    computed: {
      selectedDoctor() {
        return this.doctors.find((doctor) => String(doctor.id) === String(this.form.doctor_id)) || null;
      },
      availableDates() {
        if (!this.schedule.length) return [];

        const results = [];
        const seen = new Set();

        this.schedule
          .filter((slot) => slot.is_available !== false && slot.available_date)
          .sort((a, b) => a.available_date.localeCompare(b.available_date))
          .forEach((slot) => {
            const value = slot.available_date;
            if (seen.has(value)) return;
            seen.add(value);
            const current = new Date(`${value}T00:00:00`);
            results.push({
              value,
              label: current.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric"
              })
            });
          });

        return results;
      },
      availableTimes() {
        if (!this.form.appointment_date) return [];
        const slots = this.scheduleForDate(this.form.appointment_date);
        const times = new Set();

        slots.forEach((slot) => {
          this.generateTimeOptions(slot.start_time.slice(0, 5), slot.end_time.slice(0, 5)).forEach((time) => {
            times.add(time);
          });
        });

        return Array.from(times).sort();
      }
    },
    async mounted() {
      await this.loadDoctors();
      const doctorId = this.$route.query.doctorId;
      if (doctorId) {
        this.form.doctor_id = doctorId;
        this.loadSchedule();
      }
    },
    methods: {
      scheduleForDate(dateValue) {
        if (!dateValue) return [];
        return this.schedule.filter(
          (slot) => slot.is_available !== false && slot.available_date === dateValue
        );
      },
      isTimeWithinSchedule(dateValue, timeValue) {
        if (!dateValue || !timeValue) return false;
        return this.scheduleForDate(dateValue).some(
          (slot) => timeValue >= slot.start_time.slice(0, 5) && timeValue <= slot.end_time.slice(0, 5)
        );
      },
      generateTimeOptions(startTime, endTime) {
        const options = [];
        const [startHour, startMinute] = startTime.split(":").map(Number);
        const [endHour, endMinute] = endTime.split(":").map(Number);
        const startTotalMinutes = startHour * 60 + startMinute;
        const endTotalMinutes = endHour * 60 + endMinute;

        for (let minutes = startTotalMinutes; minutes <= endTotalMinutes; minutes += 30) {
          const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
          const minute = String(minutes % 60).padStart(2, "0");
          options.push(`${hour}:${minute}`);
        }

        return options;
      },
      syncSelectedTime() {
        if (!this.availableTimes.includes(this.form.appointment_time)) {
          this.form.appointment_time = "";
        }
      },
      async loadDoctors() {
        try {
          this.doctors = await window.Api.getDoctors();
        } catch (error) {
          this.error = error.message;
        }
      },
      async loadSchedule() {
        this.schedule = [];
        this.form.appointment_date = "";
        this.form.appointment_time = "";
        if (!this.form.doctor_id) return;
        try {
          this.schedule = await window.Api.getDoctorSchedule(this.form.doctor_id);
          this.schedule = this.schedule.filter((slot) => slot.available_date);
        } catch (error) {
          this.error = error.message;
        }
      },
      async submitBooking() {
        this.error = "";
        this.success = "";

        if (!this.form.doctor_id || !this.form.appointment_date || !this.form.appointment_time) {
          this.error = "Doctor, date, and time are required.";
          return;
        }

        const scheduleForSelectedDate = this.scheduleForDate(this.form.appointment_date);
        if (!scheduleForSelectedDate.length) {
          this.error = "Selected doctor is not available on that date.";
          return;
        }

        if (!this.isTimeWithinSchedule(this.form.appointment_date, this.form.appointment_time)) {
          this.error = "Selected time is outside the doctor's available schedule.";
          return;
        }

        this.loading = true;
        try {
          await window.Api.bookAppointment({
            doctor_id: Number(this.form.doctor_id),
            appointment_date: this.form.appointment_date,
            appointment_time: `${this.form.appointment_time}:00`
          });
          this.success = "Appointment booked successfully.";
          this.form.appointment_date = "";
          this.form.appointment_time = "";
        } catch (error) {
          this.error = error.message;
        } finally {
          this.loading = false;
        }
      }
    }
  };
})();
