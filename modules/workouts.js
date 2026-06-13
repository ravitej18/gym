import { collections, emptyState, escapeHtml, formData, pageHeader, withButtonLoading } from "./utils.js";

export const workoutsModule = {
  render({ data }) {
    const templates = data.workout_templates || [];
    return `
      ${pageHeader("Workout Plans")}
      <div class="work-grid">
        <form class="panel stack" id="workout-form">
          <div class="panel-heading"><h2>Create Template</h2></div>
          <div class="form-grid">
            <label>Template name<input name="name" required maxlength="100" /></label>
            <label>Goal<input name="goal" maxlength="100" /></label>
            <label class="wide">Exercises<textarea name="exercises" rows="7" placeholder="Bench press - 3 sets x 10 reps"></textarea></label>
            <label class="wide">Notes<textarea name="notes" rows="2"></textarea></label>
          </div>
          <button class="primary-button" type="submit">Save template</button>
        </form>
        <section class="panel">
          <div class="panel-heading"><h2>Templates</h2><span>${templates.length} plans</span></div>
          ${
            templates.length
              ? `<div class="card-grid">${templates.map(card).join("")}</div>`
              : emptyState("No workout templates", "Create reusable plans for weight loss, muscle gain, strength, and beginners.")
          }
        </section>
      </div>
    `;
  },
  bind(root, context) {
    const form = root.querySelector("#workout-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await withButtonLoading(form.querySelector("[type='submit']"), async () => {
        const saved = await context.services.data.save(collections.workouts, formData(form));
        context.toast("Workout template saved.");
        form.reset();
        context.applyChange(collections.workouts, saved);
      });
    });
  }
};

function card(template) {
  return `
    <article class="item-card">
      <div><strong>${escapeHtml(template.name)}</strong><span>${escapeHtml(template.goal || "General")}</span></div>
      <pre>${escapeHtml(template.exercises || "No exercises")}</pre>
      <small>${escapeHtml(template.notes || "")}</small>
    </article>
  `;
}
