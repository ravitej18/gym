import { collections, dateLabel, daysUntil, emptyState, escapeHtml, findName, formData, nameCell, optionList, pageHeader, today, withButtonLoading } from "./utils.js";

export const attendanceModule = {
  render({ data }) {
    const records = data.attendance || [];
    const members = data.members || [];
    const trainers = data.trainers || [];
    const now = new Date();
    const todayStr = today();
    const weekStart = isoOffset(-6); // rolling 7-day window
    const monthStr = todayStr.slice(0, 7);

    const todayCount = records.filter((r) => r.date === todayStr).length;
    const weekCount = records.filter((r) => r.date >= weekStart).length;
    const monthCount = records.filter((r) => String(r.date || "").startsWith(monthStr)).length;

    return `
      ${pageHeader("Attendance")}
      <div class="metric-grid">
        <article class="metric"><span>Today</span><strong>${todayCount}</strong></article>
        <article class="metric"><span>Last 7 Days</span><strong>${weekCount}</strong></article>
        <article class="metric"><span>This Month</span><strong>${monthCount}</strong></article>
        <article class="metric"><span>Total Records</span><strong>${records.length}</strong></article>
      </div>
      <div class="work-grid">
        <form class="panel stack" id="attendance-form">
          <div class="panel-heading"><h2>Check In</h2></div>
          <div class="form-grid">
            <label>Member<select name="memberId" required><option value="">Select member</option>${optionList(members, "fullName")}</select></label>
            <label>Date<input name="date" type="date" value="${todayStr}" required /></label>
            <label>Time<input name="time" type="time" value="${now.toTimeString().slice(0, 5)}" required /></label>
            <label>Trainer<select name="trainerId"><option value="">Unassigned</option>${optionList(trainers, "name")}</select></label>
          </div>
          <button class="primary-button" type="submit"><span class="material-symbols-outlined">how_to_reg</span>Record attendance</button>
        </form>
        <section class="panel">
          <div class="panel-heading"><h2>Recent Attendance</h2><span>${records.length} records</span></div>
          ${
            records.length
              ? `<div class="data-table">
                  <div class="table-head"><span>Member</span><span>Date</span><span>Time</span><span>Trainer</span></div>
                  ${records.slice(0, 12).map((record) => row(record, members, trainers)).join("")}
                </div>`
              : emptyState("No attendance yet", "Record check-ins to track daily and weekly activity.")
          }
        </section>
      </div>

      <section class="panel" style="margin-top:18px">
        <div class="panel-heading">
          <h2>Inactive Members</h2>
          <div class="button-row" data-inactive-tabs>
            <button class="icon-button active" data-days="7" type="button">7 days</button>
            <button class="icon-button" data-days="14" type="button">14 days</button>
            <button class="icon-button" data-days="30" type="button">30 days</button>
          </div>
        </div>
        <div data-inactive-list>${inactiveList(members, records, 7)}</div>
      </section>
    `;
  },
  bind(root, context) {
    const form = root.querySelector("#attendance-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await withButtonLoading(form.querySelector("[type='submit']"), async () => {
        await context.services.data.save(collections.attendance, formData(form));
        context.toast("Attendance recorded.");
        form.reset();
        form.date.value = today();
        form.time.value = new Date().toTimeString().slice(0, 5);
        await context.refresh();
      });
    });

    const tabs = root.querySelector("[data-inactive-tabs]");
    const listBox = root.querySelector("[data-inactive-list]");
    tabs?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-days]");
      if (!button) return;
      tabs.querySelectorAll("[data-days]").forEach((b) => b.classList.toggle("active", b === button));
      listBox.innerHTML = inactiveList(context.data.members || [], context.data.attendance || [], Number(button.dataset.days));
    });
  }
};

function row(record, members, trainers) {
  return `
    <div class="table-row">
      <span>${nameCell(findName(members, record.memberId))}</span>
      <span>${dateLabel(record.date)}</span>
      <span>${escapeHtml(record.time || "-")}</span>
      <span>${escapeHtml(findName(trainers, record.trainerId, "Unassigned"))}</span>
    </div>
  `;
}

function inactiveList(members, records, days) {
  const lastSeen = new Map();
  records.forEach((r) => {
    const prev = lastSeen.get(r.memberId);
    if (!prev || String(r.date) > String(prev)) lastSeen.set(r.memberId, r.date);
  });

  const inactive = members
    .map((member) => ({ member, last: lastSeen.get(member.id) || null }))
    .filter(({ last }) => {
      if (!last) return true; // never checked in
      return -daysUntil(last) >= days; // last visit was >= `days` ago
    })
    .sort((a, b) => String(a.last || "").localeCompare(String(b.last || "")));

  if (!inactive.length) {
    return `<div class="table-empty">No members inactive for ${days}+ days. 🎉</div>`;
  }

  return `
    <div class="data-table">
      <div class="table-head"><span>Member</span><span>Last Check-in</span><span>Days Inactive</span></div>
      ${inactive
        .map(({ member, last }) => {
          const gap = last ? -daysUntil(last) : null;
          return `
            <div class="table-row" style="grid-template-columns:1.5fr 1fr 1fr">
              <span>${nameCell(member.fullName, member.mobile || "")}</span>
              <span>${last ? dateLabel(last) : "Never"}</span>
              <span><mark class="status ${gap !== null && gap >= 30 ? "expired" : "expiring-soon"}">${gap !== null ? `${gap} days` : "No visits"}</mark></span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function isoOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
