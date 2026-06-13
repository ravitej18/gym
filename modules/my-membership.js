import { dateLabel, daysUntil, emptyState, escapeHtml, findName, memberStatus, pageHeader, statusClass } from "./utils.js";

export const myMembershipModule = {
  render(context) {
    const me = context.myMember;
    if (!me) {
      return `
        ${pageHeader("My Membership")}
        ${emptyState("Membership being set up", "Your gym is finalising your membership. Check back soon.")}
      `;
    }

    const plans = context.data.membership_plans || [];
    const trainers = context.data.trainers || [];
    const status = me.status === "Pending" ? "Pending" : memberStatus(me);
    const remaining = daysUntil(me.endDate);

    return `
      ${pageHeader("My Membership")}
      ${
        me.status === "Pending"
          ? `<div class="panel-hint" style="margin-bottom:18px">Your membership is pending approval from the gym. Some details may be incomplete until then.</div>`
          : ""
      }
      <div class="metric-grid">
        <article class="metric"><span>Status</span><strong><mark class="status ${statusClass(status)}">${escapeHtml(status)}</mark></strong></article>
        <article class="metric"><span>Plan</span><strong>${escapeHtml(findName(plans, me.planId, "Not set"))}</strong></article>
        <article class="metric"><span>Expires</span><strong>${me.endDate ? dateLabel(me.endDate) : "-"}</strong></article>
        <article class="metric"><span>Days Left</span><strong>${me.endDate ? (remaining < 0 ? `${Math.abs(remaining)} overdue` : remaining) : "-"}</strong></article>
      </div>
      <section class="panel stack">
        <div class="panel-heading"><h2>Details</h2></div>
        <div class="detail-grid">
          <div><span>Name</span><strong>${escapeHtml(me.fullName || "-")}</strong></div>
          <div><span>Mobile</span><strong>${escapeHtml(me.mobile || "-")}</strong></div>
          <div><span>Email</span><strong>${escapeHtml(me.email || "-")}</strong></div>
          <div><span>Join date</span><strong>${me.joinDate ? dateLabel(me.joinDate) : "-"}</strong></div>
          <div><span>Start date</span><strong>${me.startDate ? dateLabel(me.startDate) : "-"}</strong></div>
          <div><span>Assigned trainer</span><strong>${escapeHtml(findName(trainers, me.assignedTrainer, "Unassigned"))}</strong></div>
        </div>
      </section>
    `;
  }
};
