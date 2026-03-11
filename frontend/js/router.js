(function () {
  const routes = [
    { path: "/", component: window.Login, meta: { guestOnly: true } },
    { path: "/register", component: window.Register, meta: { guestOnly: true } },
    { path: "/admin", component: window.AdminDashboard, meta: { requiresAuth: true, role: "admin" } },
    { path: "/doctor", component: window.DoctorDashboard, meta: { requiresAuth: true, role: "doctor" } },
    { path: "/patient", component: window.PatientDashboard, meta: { requiresAuth: true, role: "patient" } },
    { path: "/search-doctors", component: window.DoctorSearch, meta: { requiresAuth: true, role: "patient" } },
    { path: "/book-appointment", component: window.BookAppointment, meta: { requiresAuth: true, role: "patient" } },
    { path: "/history", component: window.AppointmentHistory, meta: { requiresAuth: true, role: "patient" } }
  ];

  const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes
  });

  function defaultRouteForRole(role) {
    if (role === "admin") return "/admin";
    if (role === "doctor") return "/doctor";
    return "/patient";
  }

  router.beforeEach((to, from, next) => {
    const token = localStorage.getItem("token");
    const user = window.Api.getStoredUser();
    const role = user && user.role;

    if (to.meta.requiresAuth && !token) {
      next("/");
      return;
    }

    if (to.meta.guestOnly && token) {
      next(defaultRouteForRole(role));
      return;
    }

    if (to.meta.role && to.meta.role !== role) {
      next(token ? defaultRouteForRole(role) : "/");
      return;
    }

    next();
  });

  window.appRouter = router;
})();
