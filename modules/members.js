import { addDays, byName, collections, dateLabel, emptyState, escapeHtml, findName, formData, memberStatus, nameCell, optionList, pageHeader, statusClass, today } from "./utils.js";

export const membersModule = {
  render({ data }) {
    const members = [...(data.members || [])].sort(byName);
    const plans = data.membership_plans || [];
    const trainers = data.trainers || [];

    return `
      ${pageHeader("Members")}
      <div class="work-grid">
        <form class="panel stack" id="member-form">
          <input type="hidden" name="id" />
          <div class="panel-heading"><h2>Add Member</h2></div>
          <div class="form-grid">
            <label>Full name<input name="fullName" required maxlength="100" /></label>
            <label>Mobile<input name="mobile" required maxlength="20" /></label>
            <label>Email<input name="email" type="email" maxlength="100" /></label>
            <label>Gender
              <select name="gender">
                <option>Not specified</option>
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
              </select>
            </label>
            <label>Date of birth<input name="dateOfBirth" type="date" /></label>
            <label>Join date<input name="joinDate" type="date" value="${today()}" /></label>
            <label>Membership plan
              <select name="planId" required>
                <option value="">Select plan</option>
                ${optionList(plans, "planName")}
              </select>
            </label>
            <label>Assigned trainer
              <select name="assignedTrainer">
                <option value="">Unassigned</option>
                ${optionList(trainers, "name")}
              </select>
            </label>
            <label>Start date<input name="startDate" type="date" value="${today()}" required /></label>
            <label>End date<input name="endDate" type="date" required /></label>
            <label>Status
              <select name="status">
                <option>Active</option>
                <option>Suspended</option>
              </select>
            </label>
            <label class="wide">Address<textarea name="address" rows="2"></textarea></label>
            <label class="wide">Emergency contact<input name="emergencyContact" maxlength="120" /></label>
          </div>
          <div class="button-row">
            <button class="primary-button" type="submit">Save member</button>
            <button class="ghost-button" type="reset" data-action="clear">Clear</button>
          </div>
        </form>

        <section class="panel">
          <div class="panel-heading"><h2>Member Directory</h2><span>${members.length} total</span></div>
          ${
            members.length
              ? `<div class="data-table members-table">
                  <div class="table-head"><span>Name</span><span>Plan</span><span>Expiry</span><span>Status</span><span></span></div>
                  ${members.map((member) => row(member, plans, trainers)).join("")}
                </div>`
              : emptyState("No members yet", "Add your first member to start tracking plans, payments, and renewals.")
          }
        </section>
      </div>
    `;
  },
  bind(root, context) {
    const form = root.querySelector("#member-form");

    form.planId.addEventListener("change", () => {
      const plan = context.data.membership_plans.find((item) => item.id === form.planId.value);
      if (plan && form.startDate.value) {
        form.endDate.value = addDays(form.startDate.value, plan.durationDays);
      }
    });

    form.startDate.addEventListener("change", () => {
      const plan = context.data.membership_plans.find((item) => item.id === form.planId.value);
      if (plan) form.endDate.value = addDays(form.startDate.value, plan.durationDays);
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = formData(form);
      payload.status = payload.status === "Suspended" ? "Suspended" : memberStatus(payload);
      await context.services.data.save(collections.members, payload);
      context.toast(payload.id ? "Member updated." : "Member added.");
      form.reset();
      form.joinDate.value = today();
      form.startDate.value = today();
      await context.refresh();
    });

    root.querySelectorAll("[data-edit-member]").forEach((button) => {
      button.addEventListener("click", () => {
        const member = context.data.members.find((item) => item.id === button.dataset.editMember);
        if (!member) return;
        Object.entries(member).forEach(([key, value]) => {
          if (form.elements[key]) form.elements[key].value = value || "";
        });
        root.querySelector(".panel-heading h2").textContent = "Edit Member";
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    root.querySelectorAll("[data-delete-member]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this member? Related payments and attendance will remain for audit history.")) return;
        await context.services.data.remove(collections.members, button.dataset.deleteMember);
        context.toast("Member deleted.");
        await context.refresh();
      });
    });

    root.querySelector("[data-action='clear']")?.addEventListener("click", () => {
      root.querySelector(".panel-heading h2").textContent = "Add Member";
    });
  }
};

function row(member, plans, trainers) {
  const status = memberStatus(member);
  return `
    <div class="table-row">
      ${nameCell(member.fullName, member.mobile || member.email || "")}
      <span>${escapeHtml(findName(plans, member.planId))}</span>
      <span>${dateLabel(member.endDate)}</span>
      <span><mark class="status ${statusClass(status)}">${escapeHtml(status)}</mark></span>
      <span class="row-actions">
        <button class="icon-button" data-edit-member="${escapeHtml(member.id)}" title="Edit"><span class="material-symbols-outlined">edit</span></button>
        <button class="icon-button danger" data-delete-member="${escapeHtml(member.id)}" title="Delete"><span class="material-symbols-outlined">delete</span></button>
      </span>
      <small class="table-note">Trainer: ${escapeHtml(findName(trainers, member.assignedTrainer, "Unassigned"))}</small>
    </div>
  `;
}
