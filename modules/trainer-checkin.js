import { collections, dateLabel, emptyState, escapeHtml, pageHeader, today, withButtonLoading } from "./utils.js";

export const trainerCheckinModule = {
  render(context) {
    const me = context.myTrainer;
    if (!me) {
      return `
        ${pageHeader("Check In")}
        ${emptyState("Profile being set up", "Once your gym finalises your trainer profile you can check in here.")}
      `;
    }
    const todayStr = today();
    const all = context.data.trainer_attendance || [];
    const trainersInToday = all.filter((record) => record.date === todayStr).length;
    const mine = all
      .filter((record) => record.trainerId === me.id)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const checkedInToday = mine.some((record) => record.date === todayStr);

    return `
      ${pageHeader("Check In")}
      ${
        me.status === "Pending"
          ? `<div class="panel-hint" style="margin-bottom:18px">Your trainer profile is pending approval from the gym.</div>`
          : ""
      }
      <div class="metric-grid">
        <article class="metric"><span>Trainers in today</span><strong>${trainersInToday}</strong></article>
        <article class="metric"><span>My Check-ins</span><strong>${mine.length}</strong></article>
      </div>
      <div class="work-grid">
        <section class="panel stack">
          <div class="panel-heading"><h2>Check In</h2></div>
          <p class="panel-hint">${checkedInToday ? "You've already checked in today — check in again for another session." : "Tap below to record your visit."}</p>
          <button class="primary-button" data-self-checkin type="button"><span class="material-symbols-outlined">how_to_reg</span>Check in now</button>
        </section>
        <section class="panel">
          <div class="panel-heading"><h2>My Recent Check-ins</h2><span>${mine.length} total</span></div>
          ${
            mine.length
              ? `<div class="data-table">
                  <div class="table-head"><span>Date</span><span>Time</span></div>
                  ${mine
                    .slice(0, 15)
                    .map(
                      (record) => `
                        <div class="table-row" style="grid-template-columns:1fr 1fr">
                          <span>${dateLabel(record.date)}</span>
                          <span>${escapeHtml(record.time || "-")}</span>
                        </div>
                      `
                    )
                    .join("")}
                </div>`
              : emptyState("No check-ins yet", "Your visits will appear here once you check in.")
          }
        </section>
      </div>
    `;
  },
  bind(root, context) {
    const button = root.querySelector("[data-self-checkin]");
    const me = context.myTrainer;
    if (!button || !me) return;
    button.addEventListener("click", async () => {
      await withButtonLoading(
        button,
        async () => {
          const saved = await context.services.data.save(collections.trainerAttendance, {
            trainerId: me.id,
            date: today(),
            time: new Date().toTimeString().slice(0, 5)
          });
          context.toast("Checked in. Have a great session!");
          context.applyChange(collections.trainerAttendance, saved);
        },
        "Checking in..."
      );
    });
  }
};
