import { byName, collections, emptyState, escapeHtml, formData, pageHeader, withButtonLoading } from "./utils.js";

export const trainersModule = {
  render({ data }) {
    const trainers = [...(data.trainers || [])].sort(byName);
    return `
      ${pageHeader("Trainers")}
      <div class="work-grid">
        <form class="panel stack" id="trainer-form">
          <input type="hidden" name="id" />
          <div class="panel-heading"><h2>Add Trainer</h2></div>
          <div class="form-grid">
            <label>Name<input name="name" required maxlength="100" /></label>
            <label>Mobile<input name="mobile" required maxlength="20" /></label>
            <label>Email<input name="email" type="email" maxlength="100" /></label>
            <label>Specialization<input name="specialization" maxlength="80" /></label>
            <label>Experience<input name="experience" maxlength="80" /></label>
            <label class="wide">Certifications<textarea name="certifications" rows="2"></textarea></label>
          </div>
          <button class="primary-button" type="submit">Save trainer</button>
        </form>
        <section class="panel">
          <div class="panel-heading"><h2>Trainer Team</h2><span>${trainers.length} trainers</span></div>
          ${
            trainers.length
              ? `<div class="card-grid">${trainers.map(card).join("")}</div>`
              : emptyState("No trainers yet", "Add trainers and assign them to members.")
          }
        </section>
      </div>
    `;
  },
  bind(root, context) {
    const form = root.querySelector("#trainer-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await withButtonLoading(form.querySelector("[type='submit']"), async () => {
        await context.services.data.save(collections.trainers, formData(form));
        context.toast("Trainer saved.");
        form.reset();
        await context.refresh();
      });
    });
    root.querySelectorAll("[data-edit-trainer]").forEach((button) => {
      button.addEventListener("click", () => {
        const trainer = context.data.trainers.find((item) => item.id === button.dataset.editTrainer);
        Object.entries(trainer || {}).forEach(([key, value]) => {
          if (form.elements[key]) form.elements[key].value = value || "";
        });
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }
};

function card(trainer) {
  return `
    <article class="item-card">
      <div><strong>${escapeHtml(trainer.name)}</strong><span>${escapeHtml(trainer.specialization || "General")}</span></div>
      <p>${escapeHtml(trainer.mobile || "")}</p>
      <small>${escapeHtml(trainer.experience || "")}</small>
      <div class="card-footer"><span>${escapeHtml(trainer.email || "")}</span><button class="icon-button" data-edit-trainer="${escapeHtml(trainer.id)}" title="Edit"><span class="material-symbols-outlined">edit</span></button></div>
    </article>
  `;
}
