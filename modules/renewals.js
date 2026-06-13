import { addDays, collections, dateLabel, daysUntil, emptyState, escapeHtml, findName, formData, memberStatus, money, optionList, pageHeader, statusClass, today, withButtonLoading } from "./utils.js";

export const renewalsModule = {
  render({ data, settings }) {
    const members = data.members || [];
    const plans = data.membership_plans || [];
    const currency = settings?.currency || "INR";
    const watched = members
      .map((member) => ({ ...member, remaining: daysUntil(member.endDate), computedStatus: memberStatus(member) }))
      .filter((member) => member.remaining <= 30 || member.computedStatus === "Expired")
      .sort((a, b) => a.remaining - b.remaining);

    return `
      ${pageHeader("Renewals")}
      <div class="work-grid">
        <form class="panel stack" id="renewal-form">
          <div class="panel-heading"><h2>Renew Membership</h2></div>
          <div class="form-grid">
            <label>Member
              <select name="memberId" required>
                <option value="">Select member</option>
                ${optionList(members, "fullName")}
              </select>
            </label>
            <label>Plan
              <select name="planId" required>
                <option value="">Select plan</option>
                ${optionList(plans, "planName")}
              </select>
            </label>
            <label>Renewal date<input name="renewalDate" type="date" value="${today()}" required /></label>
            <label>Amount<input name="amount" type="number" min="0" step="1" required /></label>
            <label>Payment method
              <select name="method">
                <option>Cash</option>
                <option>UPI</option>
                <option>Card</option>
                <option>Bank Transfer</option>
              </select>
            </label>
          </div>
          <button class="primary-button" type="submit">Renew and record payment</button>
        </form>

        <section class="panel">
          <div class="panel-heading"><h2>Renewal Queue</h2><span>${watched.length} members</span></div>
          ${
            watched.length
              ? `<div class="data-table">
                  <div class="table-head"><span>Member</span><span>Plan</span><span>Expiry</span><span>Status</span><span></span></div>
                  ${watched.map((member) => renewalRow(member, plans, currency)).join("")}
                </div>`
              : emptyState("No renewals due", "Members expiring within 30 days will appear here.")
          }
        </section>
      </div>
    `;
  },
  bind(root, context) {
    const form = root.querySelector("#renewal-form");

    form.memberId.addEventListener("change", () => {
      const member = context.data.members.find((item) => item.id === form.memberId.value);
      if (member?.planId) form.planId.value = member.planId;
      setPlanAmount(form, context);
    });

    form.planId.addEventListener("change", () => setPlanAmount(form, context));

    root.querySelectorAll("[data-renew-member]").forEach((button) => {
      button.addEventListener("click", () => {
        const member = context.data.members.find((item) => item.id === button.dataset.renewMember);
        if (!member) return;
        form.memberId.value = member.id;
        form.planId.value = member.planId || "";
        setPlanAmount(form, context);
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = formData(form);
      const member = context.data.members.find((item) => item.id === payload.memberId);
      const plan = context.data.membership_plans.find((item) => item.id === payload.planId);
      if (!member || !plan) {
        context.toast("Select a member and plan.");
        return;
      }

      const baseDate = daysUntil(member.endDate) > 0 ? member.endDate : payload.renewalDate;
      const nextEndDate = addDays(baseDate, plan.durationDays);
      await withButtonLoading(form.querySelector("[type='submit']"), async () => {
        const savedMember = await context.services.data.save(collections.members, {
          ...member,
          planId: plan.id,
          startDate: payload.renewalDate,
          endDate: nextEndDate,
          status: "Active"
        });

        const savedPayment = await context.services.data.save(collections.payments, {
          memberId: member.id,
          planId: plan.id,
          amount: Number(payload.amount),
          date: payload.renewalDate,
          method: payload.method,
          collectedBy: context.profile.name,
          status: "Paid",
          receiptNumber: `RCPT-${Date.now().toString().slice(-8)}`
        });

        context.toast("Membership renewed.");
        form.reset();
        form.renewalDate.value = today();
        // Update both collections in place; applyChange re-renders the view (calling
        // it twice just re-renders twice — harmless and keeps both lists current).
        context.applyChange(collections.members, savedMember);
        context.applyChange(collections.payments, savedPayment);
      }, "Renewing...");
    });
  }
};

function setPlanAmount(form, context) {
  const plan = context.data.membership_plans.find((item) => item.id === form.planId.value);
  if (plan) form.amount.value = plan.price || 0;
}

function renewalRow(member, plans, currency) {
  return `
    <div class="table-row">
      <span>
        <strong>${escapeHtml(member.fullName)}</strong>
        <small>${escapeHtml(member.mobile || "")}</small>
      </span>
      <span>${escapeHtml(findName(plans, member.planId))}</span>
      <span>${dateLabel(member.endDate)} <small>${member.remaining < 0 ? `${Math.abs(member.remaining)} days overdue` : `${member.remaining} days left`}</small></span>
      <span><mark class="status ${statusClass(member.computedStatus)}">${escapeHtml(member.computedStatus)}</mark></span>
      <span class="row-actions"><button class="icon-button" data-renew-member="${escapeHtml(member.id)}">${money(plans.find((plan) => plan.id === member.planId)?.price || 0, currency)}</button></span>
    </div>
  `;
}
