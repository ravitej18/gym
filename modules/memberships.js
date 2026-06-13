import { byName, collections, confirmDialog, emptyState, escapeHtml, formData, money, pageHeader, withButtonLoading } from "./utils.js";

export const membershipsModule = {
  render({ data, settings }) {
    const plans = [...(data.membership_plans || [])].sort(byName);
    const currency = settings?.currency || "INR";

    return `
      ${pageHeader("Membership Plans")}
      <div class="work-grid">
        <form class="panel stack" id="plan-form">
          <input type="hidden" name="id" />
          <div class="panel-heading"><h2>Add Plan</h2></div>
          <div class="form-grid">
            <label>Plan name<input name="planName" required maxlength="80" /></label>
            <label>Duration days<input name="durationDays" type="number" min="1" required /></label>
            <label>Price<input name="price" type="number" min="0" step="1" required /></label>
            <label class="wide">Description<textarea name="description" rows="2"></textarea></label>
            <label class="wide">Benefits<textarea name="benefits" rows="2"></textarea></label>
          </div>
          <div class="button-row">
            <button class="primary-button" type="submit">Save plan</button>
            <button class="ghost-button" type="reset" data-action="clear">Clear</button>
          </div>
        </form>
        <section class="panel">
          <div class="panel-heading"><h2>Plan Catalog</h2><span>${plans.length} plans</span></div>
          ${
            plans.length
              ? `<div class="card-grid">${plans.map((plan) => planCard(plan, currency)).join("")}</div>`
              : emptyState("No plans yet", "Create monthly, quarterly, yearly, or personal training plans.")
          }
        </section>
      </div>
    `;
  },
  bind(root, context) {
    const form = root.querySelector("#plan-form");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = formData(form);
      payload.durationDays = Number(payload.durationDays);
      payload.price = Number(payload.price);
      await withButtonLoading(form.querySelector("[type='submit']"), async () => {
        const saved = await context.services.data.save(collections.plans, payload);
        context.toast(payload.id ? "Plan updated." : "Plan added.");
        form.reset();
        root.querySelector(".panel-heading h2").textContent = "Add Plan";
        context.applyChange(collections.plans, saved);
      });
    });

    root.querySelectorAll("[data-edit-plan]").forEach((button) => {
      button.addEventListener("click", () => {
        const plan = context.data.membership_plans.find((item) => item.id === button.dataset.editPlan);
        if (!plan) return;
        Object.entries(plan).forEach(([key, value]) => {
          if (form.elements[key]) form.elements[key].value = value || "";
        });
        root.querySelector(".panel-heading h2").textContent = "Edit Plan";
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    root.querySelectorAll("[data-delete-plan]").forEach((button) => {
      button.addEventListener("click", async () => {
        const ok = await confirmDialog({
          title: "Delete this plan?",
          body: "Existing members keep their stored dates and history.",
          confirmText: "Delete plan"
        });
        if (!ok) return;
        await context.services.data.remove(collections.plans, button.dataset.deletePlan);
        context.toast("Plan deleted.");
        context.applyRemoval(collections.plans, button.dataset.deletePlan);
      });
    });

    root.querySelector("[data-action='clear']")?.addEventListener("click", () => {
      root.querySelector(".panel-heading h2").textContent = "Add Plan";
    });
  }
};

function planCard(plan, currency) {
  return `
    <article class="item-card">
      <div>
        <strong>${escapeHtml(plan.planName)}</strong>
        <span>${escapeHtml(plan.durationDays)} days</span>
      </div>
      <p>${escapeHtml(plan.description || "No description")}</p>
      <small>${escapeHtml(plan.benefits || "No benefits listed")}</small>
      <div class="card-footer">
        <b>${money(plan.price, currency)}</b>
        <span class="row-actions">
          <button class="icon-button" data-edit-plan="${escapeHtml(plan.id)}" title="Edit"><span class="material-symbols-outlined">edit</span></button>
          <button class="icon-button danger" data-delete-plan="${escapeHtml(plan.id)}" title="Delete"><span class="material-symbols-outlined">delete</span></button>
        </span>
      </div>
    </article>
  `;
}
