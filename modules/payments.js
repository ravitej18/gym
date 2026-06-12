import { collections, dateLabel, emptyState, escapeHtml, findName, formData, money, nameCell, optionList, pageHeader, statusClass, today } from "./utils.js";

export const paymentsModule = {
  render({ data, settings }) {
    const payments = data.payments || [];
    const members = data.members || [];
    const plans = data.membership_plans || [];
    const currency = settings?.currency || "INR";

    return `
      ${pageHeader("Payments")}
      <div class="work-grid">
        <form class="panel stack" id="payment-form">
          <input type="hidden" name="id" />
          <div class="panel-heading"><h2>Record Payment</h2></div>
          <div class="form-grid">
            <label>Member
              <select name="memberId" required>
                <option value="">Select member</option>
                ${optionList(members, "fullName")}
              </select>
            </label>
            <label>Membership plan
              <select name="planId" required>
                <option value="">Select plan</option>
                ${optionList(plans, "planName")}
              </select>
            </label>
            <label>Amount<input name="amount" type="number" min="0" step="1" required /></label>
            <label>Date<input name="date" type="date" value="${today()}" required /></label>
            <label>Method
              <select name="method">
                <option>Cash</option>
                <option>UPI</option>
                <option>Card</option>
                <option>Bank Transfer</option>
              </select>
            </label>
            <label>Status
              <select name="status">
                <option>Paid</option>
                <option>Pending</option>
                <option>Partial</option>
                <option>Refunded</option>
              </select>
            </label>
            <label>Collected by<input name="collectedBy" value="Owner" maxlength="80" /></label>
          </div>
          <button class="primary-button" type="submit">Save payment</button>
        </form>

        <section class="panel">
          <div class="panel-heading"><h2>Payment History</h2><span>${payments.length} records</span></div>
          ${
            payments.length
              ? `<div class="data-table">
                  <div class="table-head"><span>Receipt</span><span>Member</span><span>Amount</span><span>Status</span><span></span></div>
                  ${payments.map((payment) => row(payment, members, plans, currency)).join("")}
                </div>`
              : emptyState("No payments yet", "Record fees, renewals, pending payments, and refunds.")
          }
        </section>
      </div>
    `;
  },
  bind(root, context) {
    const form = root.querySelector("#payment-form");

    form.planId.addEventListener("change", () => {
      const plan = context.data.membership_plans.find((item) => item.id === form.planId.value);
      if (plan) form.amount.value = plan.price || 0;
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = formData(form);
      payload.amount = Number(payload.amount);
      payload.receiptNumber = payload.receiptNumber || `RCPT-${Date.now().toString().slice(-8)}`;
      await context.services.data.save(collections.payments, payload);
      context.toast("Payment saved.");
      form.reset();
      form.date.value = today();
      form.collectedBy.value = "Owner";
      await context.refresh();
    });

    root.querySelectorAll("[data-receipt]").forEach((button) => {
      button.addEventListener("click", () => {
        const payment = context.data.payments.find((item) => item.id === button.dataset.receipt);
        const member = context.data.members.find((item) => item.id === payment?.memberId);
        const plan = context.data.membership_plans.find((item) => item.id === payment?.planId);
        printReceipt(payment, member, plan, context.settings);
      });
    });
  }
};

function row(payment, members, plans, currency) {
  return `
    <div class="table-row">
      <span>
        <strong>${escapeHtml(payment.receiptNumber || payment.id)}</strong>
        <small>${dateLabel(payment.date)} via ${escapeHtml(payment.method)}</small>
      </span>
      <span>${nameCell(findName(members, payment.memberId))}</span>
      <span>${money(payment.amount, currency)}</span>
      <span><mark class="status ${statusClass(payment.status)}">${escapeHtml(payment.status)}</mark></span>
      <span class="row-actions"><button class="icon-button" data-receipt="${escapeHtml(payment.id)}" title="Print receipt"><span class="material-symbols-outlined">receipt_long</span>Receipt</button></span>
      <small class="table-note">Plan: ${escapeHtml(findName(plans, payment.planId))}</small>
    </div>
  `;
}

function printReceipt(payment, member, plan, settings) {
  if (!payment) return;
  const receipt = window.open("", "receipt", "width=420,height=640");
  const currency = settings?.currency || "INR";
  receipt.document.write(`
    <title>${payment.receiptNumber || "Receipt"}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; color: #17211d; }
      h1 { margin-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; }
      td { padding: 10px 0; border-bottom: 1px solid #ddd; }
      td:last-child { text-align: right; font-weight: 700; }
    </style>
    <h1>${escapeHtml(settings?.gymName || "GymFlow")}</h1>
    <p>Receipt ${escapeHtml(payment.receiptNumber || payment.id)}</p>
    <table>
      <tr><td>Member</td><td>${escapeHtml(member?.fullName || "-")}</td></tr>
      <tr><td>Plan</td><td>${escapeHtml(plan?.planName || "-")}</td></tr>
      <tr><td>Date</td><td>${dateLabel(payment.date)}</td></tr>
      <tr><td>Method</td><td>${escapeHtml(payment.method)}</td></tr>
      <tr><td>Status</td><td>${escapeHtml(payment.status)}</td></tr>
      <tr><td>Amount</td><td>${money(payment.amount, currency)}</td></tr>
    </table>
  `);
  receipt.document.close();
  receipt.focus();
  receipt.print();
}
