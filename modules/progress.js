import { collections, dateLabel, emptyState, escapeHtml, findName, formData, nameCell, optionList, pageHeader, today, trendChart, withButtonLoading } from "./utils.js";

const METRICS = [
  { key: "weight", label: "Weight (kg)", color: "var(--teal)" },
  { key: "bmi", label: "BMI", color: "var(--primary-strong)" },
  { key: "bodyFat", label: "Body Fat %", color: "#c36f2d" },
  { key: "waist", label: "Waist (cm)", color: "var(--ink-soft)" }
];

export const progressModule = {
  render(context) {
    if (context.profile?.role === "member") {
      return renderMemberProgress(context);
    }
    const { data } = context;
    const records = data.progress_records || [];
    const members = data.members || [];
    const firstMember = members[0]?.id || "";

    return `
      ${pageHeader("Progress")}
      <div class="work-grid">
        <form class="panel stack" id="progress-form">
          <div class="panel-heading"><h2>Add Progress Record</h2></div>
          <div class="form-grid">
            <label>Member<select name="memberId" required><option value="">Select member</option>${optionList(members, "fullName")}</select></label>
            <label>Date<input name="date" type="date" value="${today()}" required /></label>
            <label>Weight kg<input name="weight" type="number" min="0" step="0.1" /></label>
            <label>BMI<input name="bmi" type="number" min="0" step="0.1" /></label>
            <label>Body fat %<input name="bodyFat" type="number" min="0" step="0.1" /></label>
            <label>Chest cm<input name="chest" type="number" min="0" step="0.1" /></label>
            <label>Waist cm<input name="waist" type="number" min="0" step="0.1" /></label>
            <label class="wide">Notes<textarea name="notes" rows="2"></textarea></label>
          </div>
          <button class="primary-button" type="submit"><span class="material-symbols-outlined">add</span>Save progress</button>
        </form>

        <section class="panel">
          <div class="panel-heading">
            <h2>Progress Chart</h2>
            <div class="button-row">
              <select data-chart-member>
                <option value="">Select member</option>
                ${optionList(members, "fullName", firstMember)}
              </select>
              <select data-chart-metric>
                ${METRICS.map((m) => `<option value="${m.key}">${m.label}</option>`).join("")}
              </select>
            </div>
          </div>
          <div data-chart>${chartFor(records, firstMember, "weight")}</div>
        </section>
      </div>

      <section class="panel" style="margin-top:18px">
        <div class="panel-heading"><h2>Progress History</h2><span>${records.length} records</span></div>
        ${
          records.length
            ? `<div class="data-table">
                <div class="table-head"><span>Member</span><span>Date</span><span>Weight</span><span>BMI</span><span>Notes</span></div>
                ${records.map((record) => row(record, members)).join("")}
              </div>`
            : emptyState("No progress records", "Track body measurements and notes over time.")
        }
      </section>
    `;
  },
  bind(root, context) {
    if (context.profile?.role === "member") {
      bindMemberProgress(root, context);
      return;
    }
    const form = root.querySelector("#progress-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await withButtonLoading(form.querySelector("[type='submit']"), async () => {
        const saved = await context.services.data.save(collections.progress, formData(form));
        context.toast("Progress saved.");
        form.reset();
        form.date.value = today();
        context.applyChange(collections.progress, saved);
      });
    });

    const memberSel = root.querySelector("[data-chart-member]");
    const metricSel = root.querySelector("[data-chart-metric]");
    const chartBox = root.querySelector("[data-chart]");
    function redraw() {
      chartBox.innerHTML = chartFor(context.data.progress_records || [], memberSel.value, metricSel.value);
    }
    memberSel?.addEventListener("change", redraw);
    metricSel?.addEventListener("change", redraw);
  }
};

// ===== Member read-only progress view =====
function renderMemberProgress(context) {
  const me = context.myMember;
  if (!me) {
    return `
      ${pageHeader("Progress")}
      ${emptyState("Membership being set up", "Your progress records will appear here once your gym adds them.")}
    `;
  }
  const records = (context.data.progress_records || [])
    .filter((r) => r.memberId === me.id)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return `
    ${pageHeader("Progress")}
    <section class="panel">
      <div class="panel-heading">
        <h2>My Trend</h2>
        <select data-chart-metric>
          ${METRICS.map((m) => `<option value="${m.key}">${m.label}</option>`).join("")}
        </select>
      </div>
      <div data-chart>${chartFor(records, me.id, "weight")}</div>
    </section>
    <section class="panel" style="margin-top:18px">
      <div class="panel-heading"><h2>History</h2><span>${records.length} records</span></div>
      ${
        records.length
          ? `<div class="data-table">
              <div class="table-head"><span>Date</span><span>Weight</span><span>BMI</span><span>Notes</span></div>
              ${records
                .map(
                  (record) => `
                    <div class="table-row" style="grid-template-columns:1fr 0.7fr 0.7fr 1.4fr">
                      <span>${dateLabel(record.date)}</span>
                      <span>${escapeHtml(record.weight || "-")}</span>
                      <span>${escapeHtml(record.bmi || "-")}</span>
                      <span><small>${escapeHtml(record.notes || "")}</small></span>
                    </div>
                  `
                )
                .join("")}
            </div>`
          : emptyState("No progress records", "Your gym hasn't recorded any measurements yet.")
      }
    </section>
  `;
}

function bindMemberProgress(root, context) {
  const me = context.myMember;
  const metricSel = root.querySelector("[data-chart-metric]");
  const chartBox = root.querySelector("[data-chart]");
  if (!me || !metricSel || !chartBox) return;
  metricSel.addEventListener("change", () => {
    const records = (context.data.progress_records || []).filter((r) => r.memberId === me.id);
    chartBox.innerHTML = chartFor(records, me.id, metricSel.value);
  });
}

function chartFor(records, memberId, metricKey) {
  if (!memberId) return `<div class="table-empty">Select a member to see their trend.</div>`;
  const metric = METRICS.find((m) => m.key === metricKey) || METRICS[0];
  const series = records
    .filter((r) => r.memberId === memberId && r[metric.key] !== "" && r[metric.key] != null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((r) => ({ label: dateLabel(r.date), value: Number(r[metric.key]) }));
  return trendChart(series, { color: metric.color });
}

function row(record, members) {
  return `
    <div class="table-row">
      <span>${nameCell(findName(members, record.memberId))}</span>
      <span>${dateLabel(record.date)}</span>
      <span>${escapeHtml(record.weight || "-")}</span>
      <span>${escapeHtml(record.bmi || "-")}</span>
      <span><small>${escapeHtml(record.notes || "")}</small></span>
    </div>
  `;
}
