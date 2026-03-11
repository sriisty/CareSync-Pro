(function () {
  const app = Vue.createApp({
    data() {
      return {
        appName: "Hospital Management System"
      };
    }
  });

  app.component("navbar", window.Navbar);
  app.component("login", window.Login);
  app.component("register", window.Register);

  app.use(window.appRouter);
  app.mount("#app");
})();
