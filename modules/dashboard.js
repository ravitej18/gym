import { dateLabel, daysUntil, escapeHtml, memberStatus, money, pageHeader, statusClass } from "./utils.js";

export const dashboardModule = {
  render(context) {
    if (context.profile?.role === "member") {
      return renderMemberDashboard(context);
    }
    if (context.profile?.role === "trainer") {
      return renderTrainerDashboard(context);
    }
    const { data, settings } = context;
    const members = data.members || [];
    const payments = data.payments || [];
    const attendance = data.attendance || [];
    const currency = settings?.currency || "INR";
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);

    const active = members.filter((member) => memberStatus(member) === "Active").length;
    const expiring = members.filter((member) => daysUntil(member.endDate) >= 0 && daysUntil(member.endDate) <= 15).length;
    const expired = members.filter((member) => memberStatus(member) === "Expired").length;
    const revenueToday = payments.filter((payment) => payment.date === today).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const revenueMonth = payments.filter((payment) => String(payment.date || "").startsWith(month)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const attendanceToday = attendance.filter((record) => record.date === today).length;
    const upcoming = members
      .map((member) => ({ ...member, computedStatus: memberStatus(member), remaining: daysUntil(member.endDate) }))
      .filter((member) => member.remaining <= 30)
      .sort((a, b) => a.remaining - b.remaining)
      .slice(0, 6);

    return `
      ${pageHeader("Dashboard")}
      <div class="metric-grid">
        ${metric("Total Members", members.length)}
        ${metric("Active Members", active)}
        ${metric("Expiring Soon", expiring)}
        ${metric("Expired", expired)}
        ${metric("Revenue Today", money(revenueToday, currency))}
        ${metric("Revenue Month", money(revenueMonth, currency))}
        ${metric("Attendance Today", attendanceToday)}
        ${metric("Pending Payments", payments.filter((payment) => payment.status === "Pending" || payment.status === "Partial").length)}
      </div>

      <div class="split-grid">
        <section class="panel">
          <div class="panel-heading">
            <h2>Renewal Watch</h2>
            <a href="#/renewals">View all</a>
          </div>
          <div class="list-table compact">
            ${upcoming.length ? upcoming.map(renewalRow).join("") : `<div class="table-empty">No upcoming renewals.</div>`}
          </div>
        </section>
        <section class="panel">
          <div class="panel-heading">
            <h2>Revenue Trend</h2>
            <a href="#/reports">Reports</a>
          </div>
          ${renderBars(payments, currency)}
        </section>
      </div>
    `;
  }
};

function metric(label, value) {
  return `
    <article class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderMemberDashboard(context) {
  const me = context.myMember;
  const name = context.profile?.name || "there";
  if (!me) {
    return `
      ${pageHeader(`Welcome, ${name}`)}
      <section class="panel stack">
        <div class="panel-heading"><h2>Membership being set up</h2></div>
        <p class="panel-hint">Your gym is finalising your membership. You'll see your status, attendance, and payments here shortly.</p>
      </section>
    `;
  }

  const today = new Date().toISOString().slice(0, 10);
  const attendance = context.data.attendance || [];
  const myAttendance = attendance.filter((record) => record.memberId === me.id);
  const checkedInToday = myAttendance.some((record) => record.date === today);
  const status = me.status === "Pending" ? "Pending" : memberStatus(me);
  const remaining = daysUntil(me.endDate);

  return `
    ${pageHeader(`Welcome, ${name}`)}
    ${
      me.status === "Pending"
        ? `<div class="panel-hint" style="margin-bottom:18px">Your membership is pending approval from the gym.</div>`
        : ""
    }
    <div class="metric-grid">
      <article class="metric"><span>Membership</span><strong><mark class="status ${statusClass(status)}">${escapeHtml(status)}</mark></strong></article>
      <article class="metric"><span>Expires</span><strong>${me.endDate ? dateLabel(me.endDate) : "-"}</strong></article>
      <article class="metric"><span>Days Left</span><strong>${me.endDate ? (remaining < 0 ? `${Math.abs(remaining)} overdue` : remaining) : "-"}</strong></article>
      <article class="metric"><span>My Check-ins</span><strong>${myAttendance.length}</strong></article>
    </div>
    <section class="panel stack">
      <div class="panel-heading"><h2>Today</h2></div>
      ${
        checkedInToday
          ? `<p class="panel-hint">✅ You're checked in today. See you at the gym!</p>`
          : `<p class="panel-hint">You haven't checked in yet today.</p>
             <a class="primary-button" href="#/attendance"><span class="material-symbols-outlined">how_to_reg</span>Check in now</a>`
      }
    </section>
  `;
}

function renderTrainerDashboard(context) {
  const me = context.myTrainer;
  const name = context.profile?.name || "there";
  if (!me) {
    return `
      ${pageHeader(`Welcome, ${name}`)}
      <section class="panel stack">
        <div class="panel-heading"><h2>Profile being set up</h2></div>
        <p class="panel-hint">Your gym is finalising your trainer profile. You'll be able to check in here shortly.</p>
      </section>
    `;
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const all = context.data.trainer_attendance || [];
  const mine = all.filter((record) => record.trainerId === me.id);
  const trainersInToday = all.filter((record) => record.date === todayKey).length;
  const checkedInToday = mine.some((record) => record.date === todayKey);

  return `
    ${pageHeader(`Welcome, ${name}`)}
    ${
      me.status === "Pending"
        ? `<div class="panel-hint" style="margin-bottom:18px">Your trainer profile is pending approval from the gym.</div>`
        : ""
    }
    <div class="metric-grid">
      <article class="metric"><span>Trainers in today</span><strong>${trainersInToday}</strong></article>
      <article class="metric"><span>My Check-ins</span><strong>${mine.length}</strong></article>
    </div>
    <section class="panel stack">
      <div class="panel-heading"><h2>Today</h2></div>
      ${
        checkedInToday
          ? `<p class="panel-hint">✅ You're checked in today. Have a great session!</p>`
          : `<p class="panel-hint">You haven't checked in yet today.</p>
             <a class="primary-button" href="#/trainer-checkin"><span class="material-symbols-outlined">how_to_reg</span>Check in now</a>`
      }
    </section>
  `;
}

function renewalRow(member) {
  return `
    <div class="table-row">
      <span>
        <strong>${escapeHtml(member.fullName)}</strong>
        <small>${dateLabel(member.endDate)}</small>
      </span>
      <span class="status ${statusClass(member.computedStatus)}">${escapeHtml(member.computedStatus)}</span>
    </div>
  `;
}

function renderBars(payments, currency) {
  const lastSix = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    return date.toISOString().slice(0, 7);
  });
  const values = lastSix.map((month) => payments.filter((payment) => String(payment.date || "").startsWith(month)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  const max = Math.max(...values, 1);

  return `
    <div class="bar-chart">
      ${lastSix
        .map(
          (month, index) => `
            <div class="bar-item">
              <div class="bar-track"><span style="height:${Math.max(8, (values[index] / max) * 100)}%"></span></div>
              <small>${month.slice(5)}</small>
              <strong>${money(values[index], currency)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}
