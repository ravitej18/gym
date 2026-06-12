import { downloadJson, escapeHtml, formData, pageHeader } from "./utils.js";

export const settingsModule = {
  render({ settings, services }) {
    return `
      ${pageHeader("Settings")}
      <div class="work-grid">
        <form class="panel stack" id="settings-form">
          <div class="panel-heading"><h2>Gym Profile</h2><span>${services.mode === "firebase" ? "Live" : "Demo"}</span></div>
          <div class="form-grid">
            <label>Gym name<input name="gymName" value="${escapeHtml(settings?.gymName || "")}" required /></label>
            <label>Owner name<input name="ownerName" value="${escapeHtml(settings?.ownerName || "")}" /></label>
            <label>Contact email<input name="contactEmail" type="email" value="${escapeHtml(settings?.contactEmail || "")}" /></label>
            <label>Phone<input name="phone" value="${escapeHtml(settings?.phone || "")}" /></label>
            <label>Currency
              <select name="currency">
                ${["INR", "USD", "EUR", "GBP"].map((currency) => `<option ${settings?.currency === currency ? "selected" : ""}>${currency}</option>`).join("")}
              </select>
            </label>
            <label class="wide">Address<textarea name="address" rows="3">${escapeHtml(settings?.address || "")}</textarea></label>
          </div>
          <button class="primary-button" type="submit">Save settings</button>
        </form>
        <section class="panel stack">
          <div class="panel-heading"><h2>Backup &amp; Restore</h2></div>
          <p class="panel-hint">Download a full copy of your gym data, or restore from a previous export.</p>
          <div class="button-row">
            <button class="ghost-button" data-action="export" type="button">Export data</button>
            <label class="file-button">Import JSON<input type="file" accept="application/json" data-action="import" /></label>
          </div>
        </section>
      </div>
    `;
  },
  bind(root, context) {
    const form = root.querySelector("#settings-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await context.services.data.saveSettings(formData(form));
      context.toast("Settings saved.");
      await context.refresh();
    });

    root.querySelector("[data-action='export']")?.addEventListener("click", async () => {
      const payload = await context.services.data.exportData();
      downloadJson("gymflow-export.json", payload);
      context.toast("Export ready.");
    });

    root.querySelector("[data-action='import']")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const payload = JSON.parse(await file.text());
      await context.services.data.importData(payload);
      context.toast("Import complete.");
      await context.refresh();
    });
  }
};
