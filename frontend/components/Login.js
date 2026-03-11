(function () {
  window.Login = {
    template: `
      <div class="row justify-content-center">
        <div class="col-12 col-md-8 col-lg-5">
          <div class="card app-card shadow-sm border-0">
            <div class="card-body p-4 p-lg-5">
              <div class="text-center mb-4">
                <span class="eyebrow">Secure Access</span>
                <h2 class="h3 mt-2 mb-2">Sign in to your account</h2>
                <p class="text-muted mb-0">Use your registered email and password to continue.</p>
              </div>

              <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>

              <form @submit.prevent="submitLogin" novalidate>
                <div class="mb-3">
                  <label for="loginEmail" class="form-label">Username / Email</label>
                  <input
                    id="loginEmail"
                    v-model.trim="form.email"
                    type="email"
                    class="form-control"
                    placeholder="name@example.com"
                    required
                  >
                </div>

                <div class="mb-3">
                  <label for="loginPassword" class="form-label">Password</label>
                  <input
                    id="loginPassword"
                    v-model="form.password"
                    type="password"
                    class="form-control"
                    placeholder="Enter your password"
                    minlength="4"
                    required
                  >
                </div>

                <button class="btn btn-primary w-100" type="submit" :disabled="loading">
                  <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                  {{ loading ? 'Signing in...' : 'Login' }}
                </button>
              </form>

              <p class="text-center text-muted small mt-4 mb-0">
                New patient?
                <router-link to="/register" class="text-decoration-none fw-semibold">Create an account</router-link>
              </p>
            </div>
          </div>
        </div>
      </div>
    `,
    data() {
      return {
        loading: false,
        error: "",
        form: {
          email: "",
          password: ""
        }
      };
    },
    methods: {
      async submitLogin() {
        this.error = "";

        if (!this.form.email || !this.form.password) {
          this.error = "Email and password are required.";
          return;
        }

        this.loading = true;
        try {
          const data = await window.Api.login(this.form);
          const user = window.Api.setSession(data["login details"]);

          if (user.role === "admin") {
            this.$router.push("/admin");
          } else if (user.role === "doctor") {
            this.$router.push("/doctor");
          } else {
            this.$router.push("/patient");
          }
        } catch (error) {
          this.error = error.message;
        } finally {
          this.loading = false;
        }
      }
    }
  };
})();
