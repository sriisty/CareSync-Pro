(function () {
  window.DoctorSearch = {
    template: `
      <section>
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
          <div>
            <span class="eyebrow">Find Specialists</span>
            <h1 class="h3 mb-2">Doctor search</h1>
            <p class="text-muted mb-0">Search by doctor name or specialization.</p>
          </div>
        </div>

        <div class="card app-card shadow-sm border-0 mb-4">
          <div class="card-body">
            <form class="row g-3" @submit.prevent="searchDoctors">
              <div class="col-md-5">
                <label class="form-label">Doctor name</label>
                <input v-model.trim="filters.name" class="form-control" placeholder="Search by doctor name">
              </div>
              <div class="col-md-5">
                <label class="form-label">Specialization</label>
                <input v-model.trim="filters.specialization" class="form-control" placeholder="Cardiology, Neurology...">
              </div>
              <div class="col-md-2 d-flex align-items-end">
                <button class="btn btn-primary w-100" type="submit">Search</button>
              </div>
            </form>
          </div>
        </div>

        <div v-if="error" class="alert alert-danger">{{ error }}</div>

        <div class="row g-4">
          <div class="col-md-6 col-xl-4" v-for="doctor in doctors" :key="doctor.id">
            <div class="card h-100 border-0 shadow-sm doctor-card">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                  <div>
                    <h2 class="h5 mb-1">Dr. {{ doctor.name }}</h2>
                    <p class="text-muted small mb-0">{{ doctor.department_name || 'General Medicine' }}</p>
                  </div>
                  <span class="badge text-bg-light">{{ doctor.experience || 0 }} yrs</span>
                </div>
                <p class="small mb-2"><strong>Qualification:</strong> {{ doctor.qualification || 'Not listed' }}</p>
                <p class="small mb-4"><strong>Contact:</strong> {{ doctor.contact || 'Not listed' }}</p>
                <router-link :to="'/book-appointment?doctorId=' + doctor.id" class="btn btn-outline-primary w-100">Book appointment</router-link>
              </div>
            </div>
          </div>
          <div v-if="!doctors.length" class="col-12">
            <div class="card border-0 shadow-sm">
              <div class="card-body text-center text-muted py-5">No doctors match the current search.</div>
            </div>
          </div>
        </div>
      </section>
    `,
    data() {
      return {
        error: "",
        filters: {
          name: "",
          specialization: ""
        },
        doctors: []
      };
    },
    mounted() {
      this.searchDoctors();
    },
    methods: {
      async searchDoctors() {
        this.error = "";
        try {
          this.doctors = await window.Api.getDoctors({
            patientSearch: true,
            name: this.filters.name,
            specialization: this.filters.specialization
          });
        } catch (error) {
          this.error = error.message;
        }
      }
    }
  };
})();
