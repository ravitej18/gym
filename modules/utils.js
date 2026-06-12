export const collections = {
  members: "members",
  trainers: "trainers",
  plans: "membership_plans",
  payments: "payments",
  attendance: "attendance",
  workouts: "workout_templates",
  assignments: "workout_assignments",
  progress: "progress_records",
  reminders: "reminders"
};

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function money(value, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function dateLabel(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(value, days) {
  const date = value ? new Date(value) : new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

export function daysUntil(value) {
  if (!value) return 0;
  const now = new Date();
  const target = new Date(value);
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / 86400000);
}

export function memberStatus(member) {
  const remaining = daysUntil(member.endDate);
  if (member.status === "Suspended") return "Suspended";
  if (remaining < 0) return "Expired";
  if (remaining <= 15) return "Expiring Soon";
  return "Active";
}

export function statusClass(status) {
  return String(status || "").toLowerCase().replace(/\s+/g, "-");
}

export function optionList(items, labelKey, selectedId = "") {
  return items
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item[labelKey] || item.name || item.fullName)}</option>`
    )
    .join("");
}

export function byName(a, b) {
  return String(a.fullName || a.name || a.planName || "").localeCompare(String(b.fullName || b.name || b.planName || ""));
}

export function findName(items, id, fallback = "-") {
  const item = items.find((candidate) => candidate.id === id);
  return item?.fullName || item?.name || item?.planName || fallback;
}

export function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function pageHeader(title, actions = "") {
  return `
    <div class="page-header">
      <div>
        <h1>${escapeHtml(title)}</h1>
      </div>
      <div class="page-actions">${actions}</div>
    </div>
  `;
}

export function emptyState(title, body) {
  return `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(body)}</span>
    </div>
  `;
}

export function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const SHEETJS_URL = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
let sheetJsPromise = null;

export function loadSheetJs() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (sheetJsPromise) return sheetJsPromise;

  sheetJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SHEETJS_URL;
    script.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error("SheetJS failed to initialise.")));
    script.onerror = () => {
      sheetJsPromise = null;
      reject(new Error("Could not load the Excel export library. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return sheetJsPromise;
}

export async function exportToExcel(filename, sheets) {
  const XLSX = await loadSheetJs();
  const workbook = XLSX.utils.book_new();
  sheets
    .filter((sheet) => sheet && sheet.rows)
    .forEach((sheet) => {
      const worksheet = XLSX.utils.json_to_sheet(sheet.rows.length ? sheet.rows : [{}]);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
    });
  XLSX.writeFile(workbook, filename);
}

export function normalizePhone(value = "") {
  return String(value).replace(/[^\d+]/g, "");
}

export function whatsappUrl(member, message) {
  const phone = normalizePhone(member.mobile);
  return `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(message)}`;
}

export function initials(name = "") {
  const parsed = String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
  return parsed || "--";
}

export function nameCell(name, sub = "") {
  return `
    <span class="name-cell">
      <span class="avatar small">${escapeHtml(initials(name))}</span>
      <span class="name-cell-text">
        <strong>${escapeHtml(name || "-")}</strong>
        ${sub ? `<small>${escapeHtml(sub)}</small>` : ""}
      </span>
    </span>
  `;
}

/**
 * Styled confirmation dialog. Replaces window.confirm() with markup that matches
 * the app theme. Resolves true on confirm, false on cancel/backdrop/escape.
 */
export function confirmDialog({ title = "Are you sure?", body = "", confirmText = "Confirm", danger = true } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h2>${escapeHtml(title)}</h2>
        ${body ? `<p>${escapeHtml(body)}</p>` : ""}
        <div class="button-row modal-actions">
          <button class="ghost-button" data-modal="cancel" type="button">Cancel</button>
          <button class="${danger ? "danger-button" : "primary-button"}" data-modal="ok" type="button">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    function close(result) {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(result);
    }
    function onKey(event) {
      if (event.key === "Escape") close(false);
    }

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close(false);
    });
    overlay.querySelector("[data-modal='cancel']").addEventListener("click", () => close(false));
    overlay.querySelector("[data-modal='ok']").addEventListener("click", () => close(true));
    document.addEventListener("keydown", onKey);

    document.body.appendChild(overlay);
    overlay.querySelector("[data-modal='ok']").focus();
  });
}

/**
 * Wrap an async form/button handler so the button shows a busy state and can't
 * be double-submitted. `button` may be the submit button or any clickable.
 */
export async function withButtonLoading(button, action, busyLabel = "Saving...") {
  if (!button) return action();
  const original = button.innerHTML;
  button.disabled = true;
  button.dataset.loading = "true";
  button.innerHTML = `<span class="spinner"></span>${escapeHtml(busyLabel)}`;
  try {
    return await action();
  } finally {
    button.disabled = false;
    delete button.dataset.loading;
    button.innerHTML = original;
  }
}

/**
 * Lightweight sparkline/trend chart (inline SVG) for a numeric series.
 * points: array of { label, value }. Returns an SVG string.
 */
export function trendChart(points, { color = "var(--teal)", height = 160 } = {}) {
  const clean = points.filter((p) => Number.isFinite(Number(p.value)));
  if (clean.length < 2) {
    return `<div class="table-empty">Add at least two records to see a trend.</div>`;
  }
  const width = 320;
  const pad = 8;
  const values = clean.map((p) => Number(p.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / (clean.length - 1);
  const coords = clean.map((p, i) => {
    const x = pad + i * stepX;
    const y = height - pad - ((Number(p.value) - min) / span) * (height - pad * 2);
    return [x, y];
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${height - pad} L${coords[0][0].toFixed(1)},${height - pad} Z`;
  const dots = coords.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}" />`).join("");

  return `
    <div class="trend-chart">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img">
        <path d="${area}" fill="${color}" opacity="0.12" />
        <path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
        ${dots}
      </svg>
      <div class="trend-labels">
        <span>${escapeHtml(clean[0].label)}</span>
        <span>${escapeHtml(clean[clean.length - 1].label)}</span>
      </div>
      <div class="trend-range"><small>Low ${min}</small><small>High ${max}</small></div>
    </div>
  `;
}
