import { escapeHtml } from "./utils.js";

export function renderAuth(root, context) {
  root.innerHTML = `
    <main class="auth-layout">
      <section class="auth-visual">
        <div class="auth-brand">
          <div class="brand-mark large">GF</div>
          <h1>GymFlow</h1>
          <p>Manage members, payments, renewals, trainers, and daily operations from a static web app.</p>
        </div>
      </section>
      <section class="auth-panel">
        <div class="auth-tabs">
          <button class="active" data-auth-tab="login">Login</button>
          <button data-auth-tab="register">Register</button>
        </div>

        <form id="login-form" class="stack auth-form">
          <label>Email<input name="email" type="email" autocomplete="email" required /></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" required /></label>
          <button class="primary-button" type="submit">Login</button>
          <button class="link-button" type="button" data-action="reset-password">Forgot password</button>
          ${context.mode === "local" ? `<button class="ghost-button" type="button" data-action="demo">Open demo workspace</button>` : ""}
        </form>

        <div id="register-panel" class="stack hidden">
          <div class="auth-tabs sub">
            <button class="active" data-register-mode="owner" type="button">Register a gym</button>
            <button data-register-mode="member" type="button">Join as member</button>
            <button data-register-mode="trainer" type="button">Join as trainer</button>
          </div>

          <form id="register-form" class="stack auth-form">
            <label>Gym name<input name="gymName" required maxlength="80" /></label>
            <label>Your name<input name="name" autocomplete="name" required maxlength="80" /></label>
            <label>Email<input name="email" type="email" autocomplete="email" required /></label>
            <label>Password<input name="password" type="password" minlength="6" autocomplete="new-password" required /></label>
            <button class="primary-button" type="submit">Create owner account</button>
          </form>

          <form id="member-register-form" class="stack auth-form hidden">
            <label>Gym code<input name="gymCode" required maxlength="20" placeholder="e.g. GRIP-4821" autocomplete="off" /></label>
            <label>Your name<input name="name" autocomplete="name" required maxlength="80" /></label>
            <label>Email<input name="email" type="email" autocomplete="email" required /></label>
            <label>Password<input name="password" type="password" minlength="6" autocomplete="new-password" required /></label>
            <button class="primary-button" type="submit">Join gym</button>
            <p class="auth-note">Ask your gym for its join code.</p>
          </form>

          <form id="trainer-register-form" class="stack auth-form hidden">
            <label>Gym code<input name="gymCode" required maxlength="20" placeholder="e.g. GRIP-4821" autocomplete="off" /></label>
            <label>Your name<input name="name" autocomplete="name" required maxlength="80" /></label>
            <label>Email<input name="email" type="email" autocomplete="email" required /></label>
            <label>Password<input name="password" type="password" minlength="6" autocomplete="new-password" required /></label>
            <button class="primary-button" type="submit">Join as trainer</button>
            <p class="auth-note">Ask your gym for its join code.</p>
          </form>
        </div>

        <p class="auth-note">${escapeHtml(context.mode === "firebase" ? "Your gym data is saved and synced automatically." : "Running in demo mode on this device.")}</p>
      </section>
    </main>
  `;

  bindAuth(root, context);
}

function bindAuth(root, context) {
  const loginForm = root.querySelector("#login-form");
  const registerPanel = root.querySelector("#register-panel");
  const registerForm = root.querySelector("#register-form");
  const memberForm = root.querySelector("#member-register-form");
  const trainerForm = root.querySelector("#trainer-register-form");
  const registerForms = { owner: registerForm, member: memberForm, trainer: trainerForm };

  root.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      root.querySelectorAll("[data-auth-tab]").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      const isLogin = button.dataset.authTab === "login";
      loginForm.classList.toggle("hidden", !isLogin);
      registerPanel.classList.toggle("hidden", isLogin);
    });
  });

  // Owner / member / trainer registration sub-toggle.
  root.querySelectorAll("[data-register-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      root.querySelectorAll("[data-register-mode]").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      const mode = button.dataset.registerMode;
      Object.entries(registerForms).forEach(([key, form]) => form.classList.toggle("hidden", key !== mode));
    });
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await run(context, async () => {
      const data = Object.fromEntries(new FormData(loginForm).entries());
      await context.services.auth.login(data.email, data.password);
      context.onToast("Welcome back.");
    });
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await run(context, async () => {
      const data = Object.fromEntries(new FormData(registerForm).entries());
      await context.services.auth.registerOwner(data);
      context.onToast("Owner account created.");
    });
  });

  memberForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await run(context, async () => {
      const data = Object.fromEntries(new FormData(memberForm).entries());
      await context.services.auth.registerMember(data);
      context.onToast("Welcome! Your gym membership is set up.");
    });
  });

  trainerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await run(context, async () => {
      const data = Object.fromEntries(new FormData(trainerForm).entries());
      await context.services.auth.registerTrainer(data);
      context.onToast("Welcome! Your trainer profile is set up.");
    });
  });

  root.querySelector("[data-action='demo']")?.addEventListener("click", async () => {
    await run(context, async () => {
      await context.services.auth.useDemo();
      context.onToast("Demo workspace loaded.");
    });
  });

  root.querySelector("[data-action='reset-password']")?.addEventListener("click", async () => {
    const email = loginForm.email.value;
    if (!email) {
      context.onToast("Enter your email first.");
      return;
    }
    await run(context, async () => {
      await context.services.auth.resetPassword(email);
      context.onToast(context.mode === "firebase" ? "Password reset email sent." : "Local account found. Use its saved password.");
    });
  });
}

async function run(context, action) {
  try {
    await action();
  } catch (error) {
    context.onToast(error.message || "Something went wrong.");
  }
}
