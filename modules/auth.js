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

        <form id="register-form" class="stack auth-form hidden">
          <label>Gym name<input name="gymName" required maxlength="80" /></label>
          <label>Your name<input name="name" autocomplete="name" required maxlength="80" /></label>
          <label>Email<input name="email" type="email" autocomplete="email" required /></label>
          <label>Password<input name="password" type="password" minlength="6" autocomplete="new-password" required /></label>
          <button class="primary-button" type="submit">Create owner account</button>
        </form>

        <p class="auth-note">${escapeHtml(context.mode === "firebase" ? "Your gym data is saved and synced automatically." : "Running in demo mode on this device.")}</p>
      </section>
    </main>
  `;

  bindAuth(root, context);
}

function bindAuth(root, context) {
  const loginForm = root.querySelector("#login-form");
  const registerForm = root.querySelector("#register-form");

  root.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      root.querySelectorAll("[data-auth-tab]").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      const isLogin = button.dataset.authTab === "login";
      loginForm.classList.toggle("hidden", !isLogin);
      registerForm.classList.toggle("hidden", isLogin);
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
