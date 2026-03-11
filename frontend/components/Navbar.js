(function () {
  window.Navbar = {
    template: `
      <nav class="navbar navbar-expand-lg navbar-dark app-navbar sticky-top">
        <div class="container">
          <router-link class="navbar-brand fw-semibold" :to="homeRoute">MedAxis HMS</router-link>

          <button
            class="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#mainNavbar"
            aria-controls="mainNavbar"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span class="navbar-toggler-icon"></span>
          </button>

          <div id="mainNavbar" class="collapse navbar-collapse">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0" v-if="isAuthenticated">
              <li class="nav-item" v-if="userRole === 'admin'">
                <router-link class="nav-link" to="/admin">Admin Dashboard</router-link>
              </li>
              <li class="nav-item" v-if="userRole === 'doctor'">
                <router-link class="nav-link" to="/doctor">Doctor Dashboard</router-link>
              </li>
              <li class="nav-item" v-if="userRole === 'patient'">
                <router-link class="nav-link" to="/patient">Patient Dashboard</router-link>
              </li>
              <li class="nav-item" v-if="userRole === 'patient'">
                <router-link class="nav-link" to="/search-doctors">Search Doctors</router-link>
              </li>
              <li class="nav-item" v-if="userRole === 'patient'">
                <router-link class="nav-link" to="/book-appointment">Book Appointment</router-link>
              </li>
              <li class="nav-item" v-if="userRole === 'patient'">
                <router-link class="nav-link" to="/history">Appointment History</router-link>
              </li>
            </ul>

            <div class="d-flex align-items-center gap-3 ms-auto">
              <span v-if="isAuthenticated" class="navbar-text small text-white-50">
                {{ userEmail }}<span class="text-uppercase ms-2 badge text-bg-light">{{ userRole }}</span>
              </span>
              <router-link v-if="!isAuthenticated" to="/" class="btn btn-outline-light btn-sm">Login</router-link>
              <router-link v-if="!isAuthenticated" to="/register" class="btn btn-light btn-sm">Register</router-link>
              <button v-if="isAuthenticated" class="btn btn-outline-light btn-sm" @click="handleLogout">Logout</button>
            </div>
          </div>
        </div>
      </nav>
    `,
    data() {
      return {
        session: window.Api.getStoredUser(),
        hasToken: Boolean(localStorage.getItem("token"))
      };
    },
    computed: {
      isAuthenticated() {
        return Boolean(this.hasToken && this.session);
      },
      userRole() {
        return this.session ? this.session.role : "";
      },
      userEmail() {
        return this.session ? this.session.email : "";
      },
      homeRoute() {
        if (this.userRole === "admin") return "/admin";
        if (this.userRole === "doctor") return "/doctor";
        if (this.userRole === "patient") return "/patient";
        return "/";
      }
    },
    created() {
      this.syncSession();
      window.addEventListener("auth-changed", this.syncSession);
      window.addEventListener("storage", this.syncSession);
    },
    beforeUnmount() {
      window.removeEventListener("auth-changed", this.syncSession);
      window.removeEventListener("storage", this.syncSession);
    },
    watch: {
      $route() {
        this.syncSession();
      }
    },
    methods: {
      syncSession() {
        this.session = window.Api.getStoredUser();
        this.hasToken = Boolean(localStorage.getItem("token"));
      },
      async handleLogout() {
        try {
          if (this.hasToken) {
            await window.Api.logout();
          }
        } catch (error) {
        } finally {
          window.Api.clearSession();
          this.syncSession();
          this.$router.push("/");
        }
      }
    }
  };
})();
