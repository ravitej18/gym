import { dateLabel, daysUntil, escapeHtml, exportToExcel, findName, memberStatus, money, pageHeader } from "./utils.js";

export const reportsModule = {
  render({ data, settings }) {
    const members = data.members || [];
    const payments = data.payments || [];
    const attendance = data.attendance || [];
    const currency = settings?.currency || "INR";
    const revenue = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const active = members.filter((member) => memberStatus(member) === "Active").length;
    const inactive = members.filter((member) => !attendance.some((record) => record.memberId === member.id && daysUntil(record.date) >= -14));

    return `
      ${pageHeader(
        "Reports",
        `<div class="button-row">
          <button class="ghost-button" data-export="members" type="button">Members .xlsx</button>
          <button class="ghost-button" data-export="payments" type="button">Payments .xlsx</button>
          <button class="ghost-button" data-export="attendance" type="button">Attendance .xlsx</button>
          <button class="ghost-button" data-export="renewals" type="button">Renewals .xlsx</button>
          <button class="primary-button" data-export="all" type="button">Export all</button>
        </div>`
      )}
      <div class="metric-grid">
        <article class="metric"><span>Total revenue</span><strong>${money(revenue, currency)}</strong></article>
        <article class="metric"><span>Active members</span><strong>${active}</strong></article>
        <article class="metric"><span>Attendance records</span><strong>${attendance.length}</strong></article>
        <article class="metric"><span>Inactive 14 days</span><strong>${inactive.length}</strong></article>
      </div>
      <div class="split-grid">
        <section class="panel">
          <div class="panel-heading"><h2>Inactive Members</h2></div>
          <div class="list-table compact">
            ${
              inactive.length
                ? inactive
                    .map(
                      (member) => `
                        <div class="table-row">
                          <span><strong>${escapeHtml(member.fullName)}</strong><small>${escapeHtml(member.mobile || "")}</small></span>
                          <span>${dateLabel(member.endDate)}</span>
                        </div>
                      `
                    )
                    .join("")
                : `<div class="table-empty">No inactive members.</div>`
            }
          </div>
        </section>
        <section class="panel">
          <div class="panel-heading"><h2>Recent Payments</h2></div>
          <div class="list-table compact">
            ${
              payments.length
                ? payments
                    .slice(0, 8)
                    .map(
                      (payment) => `
                        <div class="table-row">
                          <span><strong>${escapeHtml(findName(members, payment.memberId))}</strong><small>${dateLabel(payment.date)}</small></span>
                          <span>${money(payment.amount, currency)}</span>
                        </div>
                      `
                    )
                    .join("")
                : `<div class="table-empty">No payments recorded.</div>`
            }
          </div>
        </section>
      </div>
    `;
  },
  bind(root, context) {
    root.querySelectorAll("[data-export]").forEach((button) => {
      button.addEventListener("click", async () => {
        const kind = button.dataset.export;
        const label = button.textContent;
        button.disabled = true;
        button.textContent = "Preparing...";
        try {
          const sheets = buildSheets(kind, context);
          await exportToExcel(filenameFor(kind, context.settings), sheets);
          context.toast("Excel export downloaded.");
        } catch (error) {
          context.toast(error.message || "Export failed.");
        } finally {
          button.disabled = false;
          button.textContent = label;
        }
      });
    });
  }
};

function buildSheets(kind, context) {
  const builders = {
    members: () => [membersSheet(context)],
    payments: () => [paymentsSheet(context)],
    attendance: () => [attendanceSheet(context)],
    renewals: () => [renewalsSheet(context)],
    all: () => [membersSheet(context), paymentsSheet(context), attendanceSheet(context), renewalsSheet(context)]
  };
  return (builders[kind] || builders.all)();
}

function filenameFor(kind, settings) {
  const slug = String(settings?.gymName || "gymflow").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "gymflow";
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}-${kind}-${date}.xlsx`;
}

function membersSheet({ data }) {
  const plans = data.membership_plans || [];
  const trainers = data.trainers || [];
  const rows = (data.members || []).map((member) => ({
    Name: member.fullName || "",
    Mobile: member.mobile || "",
    Email: member.email || "",
    Gender: member.gender || "",
    Plan: findName(plans, member.planId, ""),
    Trainer: findName(trainers, member.assignedTrainer, ""),
    "Join Date": member.joinDate || "",
    "Start Date": member.startDate || "",
    "End Date": member.endDate || "",
    Status: memberStatus(member)
  }));
  return { name: "Members", rows };
}

function paymentsSheet({ data, settings }) {
  const members = data.members || [];
  const plans = data.membership_plans || [];
  const rows = (data.payments || []).map((payment) => ({
    Receipt: payment.receiptNumber || payment.id || "",
    Member: findName(members, payment.memberId, ""),
    Plan: findName(plans, payment.planId, ""),
    Amount: Number(payment.amount || 0),
    Currency: settings?.currency || "INR",
    Date: payment.date || "",
    Method: payment.method || "",
    Status: payment.status || "",
    "Collected By": payment.collectedBy || ""
  }));
  return { name: "Payments", rows };
}

function attendanceSheet({ data }) {
  const members = data.members || [];
  const trainers = data.trainers || [];
  const rows = (data.attendance || []).map((record) => ({
    Member: findName(members, record.memberId, ""),
    Date: record.date || "",
    Time: record.time || "",
    Trainer: findName(trainers, record.trainerId, "")
  }));
  return { name: "Attendance", rows };
}

function renewalsSheet({ data }) {
  const plans = data.membership_plans || [];
  const rows = (data.members || [])
    .map((member) => ({ ...member, remaining: daysUntil(member.endDate), computedStatus: memberStatus(member) }))
    .filter((member) => member.remaining <= 30 || member.computedStatus === "Expired")
    .sort((a, b) => a.remaining - b.remaining)
    .map((member) => ({
      Member: member.fullName || "",
      Mobile: member.mobile || "",
      Plan: findName(plans, member.planId, ""),
      "End Date": member.endDate || "",
      "Days Left": member.remaining,
      Status: member.computedStatus
    }));
  return { name: "Renewals", rows };
}
