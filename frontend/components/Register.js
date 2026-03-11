(function () {
  window.Register = {
    template: `
      <div class="row justify-content-center">
        <div class="col-12 col-lg-9">
          <div class="card app-card shadow-sm border-0">
            <div class="card-body p-4 p-lg-5">
              <div class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
                <div>
                  <span class="eyebrow">Patient Onboarding</span>
                  <h2 class="h3 mt-2 mb-2">Create a patient account</h2>
                  <p class="text-muted mb-0">Registration submits to <code>/api/register</code> and creates a patient profile.</p>
                </div>
                <router-link to="/" class="btn btn-outline-secondary">Back to login</router-link>
              </div>

              <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
              <div v-if="success" class="alert alert-success" role="alert">{{ success }}</div>

              <form @submit.prevent="submitRegister" novalidate>
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Full name</label>
                    <input v-model.trim="form.name" type="text" class="form-control" required>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Email</label>
                    <input v-model.trim="form.email" type="email" class="form-control" required>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Password</label>
                    <input v-model="form.password" type="password" class="form-control" minlength="4" required>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Contact</label>
                    <input v-model.trim="form.contact" type="text" class="form-control" required>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Age</label>
                    <input v-model.number="form.age" type="number" min="0" class="form-control" required>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Date of birth</label>
                    <input v-model="form.dob" type="date" class="form-control" required>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Gender</label>
                    <select v-model="form.gender" class="form-select" required>
                      <option value="">Select gender</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div class="col-12">
                    <label class="form-label">Address</label>
                    <textarea v-model.trim="form.address" class="form-control" rows="2" required></textarea>
                  </div>
                  <div class="col-12">
                    <label class="form-label">Medical history</label>
                    <textarea v-model.trim="form.medical_history" class="form-control" rows="3" placeholder="Optional notes"></textarea>
                  </div>
                </div>

                <button class="btn btn-primary mt-4" type="submit" :disabled="loading">
                  <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                  {{ loading ? 'Creating account...' : 'Register' }}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    `,
    data() {
      return {
        loading: false,
        error: "",
        success: "",
        form: {
          name: "",
          email: "",
          password: "",
          usertype: "patient",
          contact: "",
          age: "",
          dob: "",
          gender: "",
          address: "",
          medical_history: ""
        }
      };
    },
    methods: {
      async submitRegister() {
        this.error = "";
        this.success = "";

        if (!this.form.name || !this.form.email || !this.form.password || !this.form.contact || !this.form.dob || !this.form.gender || !this.form.address) {
          this.error = "Please complete all required fields.";
          return;
        }

        this.loading = true;
        try {
          const payload = { ...this.form, age: Number(this.form.age || 0) };
          const data = await window.Api.register(payload);
          this.success = data.message || "Registration successful.";
          this.form = {
            name: "",
            email: "",
            password: "",
            usertype: "patient",
            contact: "",
            age: "",
            dob: "",
            gender: "",
            address: "",
            medical_history: ""
          };
          setTimeout(() => this.$router.push("/"), 1200);
        } catch (error) {
          this.error = error.message;
        } finally {
          this.loading = false;
        }
      }
    }
  };
})();
