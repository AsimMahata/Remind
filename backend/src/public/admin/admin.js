// Admin Dashboard Controller
let token = localStorage.getItem('remind_admin_token');

// DOM Elements
const loginContainer = document.getElementById('login-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const navEmail = document.getElementById('nav-email');
const logoutBtn = document.getElementById('logout-btn');

// Stats Elements
const statUsers = document.getElementById('stat-users');
const statActive = document.getElementById('stat-active');
const statCompleted = document.getElementById('stat-completed');
const statDeleted = document.getElementById('stat-deleted');
const statEvents = document.getElementById('stat-events');
const statCrashes = document.getElementById('stat-crashes');

// Tables
const eventsTbody = document.getElementById('events-tbody');
const usersTbody = document.getElementById('users-tbody');
const remindersTbody = document.getElementById('reminders-tbody');
const errorsTbody = document.getElementById('errors-tbody');
const errorBadge = document.getElementById('error-badge');

// Tabs
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Filters
const filterEventType = document.getElementById('filter-event-type');
const filterEventUser = document.getElementById('filter-event-user');
const refreshEventsBtn = document.getElementById('refresh-events-btn');
const filterReminderTask = document.getElementById('filter-reminder-task');
const filterReminderStatus = document.getElementById('filter-reminder-status');
const refreshRemindersBtn = document.getElementById('refresh-reminders-btn');
const filterErrorStatus = document.getElementById('filter-error-status');
const filterErrorSearch = document.getElementById('filter-error-search');
const refreshErrorsBtn = document.getElementById('refresh-errors-btn');

// Diagnostic Modal Elements
const diagModal = document.getElementById('diag-modal');
const diagModalTitle = document.getElementById('diag-modal-title');
const diagModalSub = document.getElementById('diag-modal-sub');
const diagMetaGrid = document.getElementById('diag-meta-grid');
const diagModalCode = document.getElementById('diag-modal-code');
const diagModalClose = document.getElementById('diag-modal-close');
const diagCloseBtn = document.getElementById('diag-close-btn');
const diagCopyBtn = document.getElementById('diag-copy-btn');
const toastContainer = document.getElementById('toast-container');

let currentErrorsMap = {};
let activeViewingErrorId = null;

// Toast helper
function showToast(message) {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>✨</span> <span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

// Initialize
if (token) {
  showDashboard();
} else {
  showLogin();
}

// Handle Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');

  const email = document.getElementById('admin-email').value;
  const password = document.getElementById('admin-password').value;

  try {
    const res = await fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    token = data.token;
    localStorage.setItem('remind_admin_token', token);
    localStorage.setItem('remind_admin_email', data.user.email);
    showDashboard();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove('hidden');
  }
});

// Handle Logout
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('remind_admin_token');
  localStorage.removeItem('remind_admin_email');
  token = null;
  showLogin();
});

function showLogin() {
  loginContainer.classList.remove('hidden');
  dashboardContainer.classList.add('hidden');
}

function showDashboard() {
  loginContainer.classList.add('hidden');
  dashboardContainer.classList.remove('hidden');
  navEmail.textContent = localStorage.getItem('remind_admin_email') || 'admin';
  loadStats();
  loadEvents();
  loadUsers();
  loadReminders();
  loadErrors();
}

// Tab Switching
tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    tabContents.forEach((c) => c.classList.remove('active'));

    btn.classList.add('active');
    const tabId = `tab-${btn.dataset.tab}`;
    document.getElementById(tabId).classList.add('active');
  });
});

// Load Stats
async function loadStats() {
  try {
    const [statsRes, errorsRes] = await Promise.all([
      authFetch('/admin/stats'),
      authFetch('/admin/errors?limit=1'),
    ]);

    if (statsRes) {
      const data = await statsRes.json();
      statUsers.textContent = data.totalUsers ?? 0;
      statActive.textContent = data.activeReminders ?? 0;
      statCompleted.textContent = data.completedReminders ?? 0;
      statDeleted.textContent = data.deletedReminders ?? 0;
      statEvents.textContent = data.totalEvents ?? 0;
    }

    if (errorsRes && statCrashes) {
      const errData = await errorsRes.json();
      statCrashes.textContent = errData.activeCount ?? 0;
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Load Events
async function loadEvents() {
  eventsTbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading audit events...</td></tr>';
  try {
    const type = filterEventType.value;
    const userId = filterEventUser.value.trim();
    let url = '/admin/events?limit=100';
    if (type) url += `&type=${encodeURIComponent(type)}`;
    if (userId) url += `&userId=${encodeURIComponent(userId)}`;

    const res = await authFetch(url);
    if (!res) return;
    const events = await res.json();

    if (!events.length) {
      eventsTbody.innerHTML = '<tr><td colspan="5" class="text-center">No audit events match current criteria.</td></tr>';
      return;
    }

    eventsTbody.innerHTML = events
      .map((e) => {
        const timeStr = new Date(e.timestamp).toLocaleString();
        const payloadStr = e.decryptedMetadata
          ? escapeHtml(JSON.stringify(e.decryptedMetadata))
          : '-';

        return `
          <tr>
            <td style="white-space:nowrap;">${timeStr}</td>
            <td><span class="badge badge-event">${escapeHtml(e.type)}</span></td>
            <td><code>${e.userId ? escapeHtml(e.userId) : 'System'}</code></td>
            <td><code>${e.reminderId ? escapeHtml(e.reminderId) : '-'}</code></td>
            <td><div class="code-snippet" title="${payloadStr}">${payloadStr}</div></td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    eventsTbody.innerHTML = `<tr><td colspan="5" class="text-center" style="color:#f87171;">Failed to load events: ${err.message}</td></tr>`;
  }
}

// Load Users
async function loadUsers() {
  usersTbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading users...</td></tr>';
  try {
    const res = await authFetch('/admin/users');
    if (!res) return;
    const users = await res.json();

    if (!users.length) {
      usersTbody.innerHTML = '<tr><td colspan="5" class="text-center">No registered users found.</td></tr>';
      return;
    }

    usersTbody.innerHTML = users
      .map((u) => {
        const dateStr = new Date(u.createdAt).toLocaleDateString();
        const roleBadge =
          u.role === 'admin'
            ? '<span class="badge badge-event">Admin</span>'
            : '<span class="badge" style="background:rgba(255,255,255,0.06);color:#cbd5e1;">User</span>';

        return `
          <tr>
            <td><code>${escapeHtml(u.id)}</code></td>
            <td><strong>${escapeHtml(u.email)}</strong></td>
            <td>${roleBadge}</td>
            <td>${u.activeRemindersCount ?? 0} active</td>
            <td>${dateStr}</td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    usersTbody.innerHTML = `<tr><td colspan="5" class="text-center" style="color:#f87171;">Failed to load users: ${err.message}</td></tr>`;
  }
}

// Load Reminders
async function loadReminders() {
  remindersTbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading reminders...</td></tr>';
  try {
    const search = filterReminderTask.value.trim();
    const status = filterReminderStatus.value;
    let url = '/admin/reminders?';
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (status === 'active') url += '&completed=false&deleted=false';
    if (status === 'completed') url += '&completed=true&deleted=false';
    if (status === 'deleted') url += '&deleted=true';

    const res = await authFetch(url);
    if (!res) return;
    const reminders = await res.json();

    if (!reminders.length) {
      remindersTbody.innerHTML = '<tr><td colspan="6" class="text-center">No reminders found.</td></tr>';
      return;
    }

    remindersTbody.innerHTML = reminders
      .map((r) => {
        const dueStr = new Date(r.dueAt).toLocaleString();
        const updatedStr = new Date(r.updatedAt).toLocaleString();

        let statusBadge = '<span class="badge badge-active">Active</span>';
        if (r.deleted) {
          statusBadge = '<span class="badge badge-deleted">Deleted</span>';
        } else if (r.completed) {
          statusBadge = '<span class="badge badge-completed">Completed</span>';
        }

        return `
          <tr>
            <td><strong>${escapeHtml(r.task)}</strong></td>
            <td><code>${r.userId}</code></td>
            <td>${dueStr}</td>
            <td>${statusBadge}</td>
            <td>v${r.version || 1}</td>
            <td style="white-space:nowrap;">${updatedStr}</td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    remindersTbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:#f87171;">Failed to load reminders: ${err.message}</td></tr>`;
  }
}

// Load Errors & Crashes
async function loadErrors() {
  if (!errorsTbody) return;
  errorsTbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading crash reports...</td></tr>';
  try {
    const status = filterErrorStatus ? filterErrorStatus.value : '';
    let url = '/admin/errors?limit=50';
    if (status) url += `&status=${status}`;

    const res = await authFetch(url);
    if (!res) return;
    const data = await res.json();

    const searchTerm = (filterErrorSearch?.value || '').toLowerCase().trim();
    let reports = data.reports || [];
    currentErrorsMap = {};
    reports.forEach((r) => {
      currentErrorsMap[r.id] = r;
    });

    if (searchTerm) {
      reports = reports.filter((r) =>
        (r.errorName || '').toLowerCase().includes(searchTerm) ||
        (r.errorMessage || '').toLowerCase().includes(searchTerm)
      );
    }

    if (errorBadge) {
      if (data.activeCount > 0) {
        errorBadge.textContent = data.activeCount;
        errorBadge.style.display = 'inline-block';
      } else {
        errorBadge.style.display = 'none';
      }
    }
    if (statCrashes) {
      statCrashes.textContent = data.activeCount ?? 0;
    }

    if (!reports.length) {
      errorsTbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color:#22c55e;">✅ No crash or error reports found!</td></tr>';
      return;
    }

    errorsTbody.innerHTML = reports
      .map((r) => {
        const lastSeen = new Date(r.lastSeenAt).toLocaleString();
        const expiresAt = new Date(r.expiresAt).toLocaleDateString();

        let statusBadge = r.solved
          ? `<span class="badge" style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.35)">✓ SOLVED (Purges in 24h)</span>`
          : `<span class="badge" style="background:rgba(244,63,94,0.15);color:#f43f5e;border:1px solid rgba(244,63,94,0.35)">⚠️ ACTIVE (Expires ${expiresAt})</span>`;

        return `
          <tr>
            <td style="white-space:nowrap;font-size:12px;color:#94a3b8;">${lastSeen}</td>
            <td>
              <strong style="color:#f43f5e;font-family:monospace;font-size:12px;">${escapeHtml(r.errorName)}</strong>
              <div style="font-size:12.5px;color:#e2e8f0;margin-top:3px;max-width:400px;line-height:1.4;">${escapeHtml(r.errorMessage)}</div>
            </td>
            <td><code style="font-size:11px;">${escapeHtml(r.platform.toUpperCase())}</code></td>
            <td><span class="badge" style="background:#131f33;color:#38bdf8;">${r.count}x</span></td>
            <td>${statusBadge}</td>
            <td style="white-space:nowrap;display:flex;gap:6px;align-items:center;">
              <button class="btn-secondary" style="padding:5px 10px;font-size:11px;" onclick="viewDiagnosticModal('${r.id}')">🔍 Inspect</button>
              <button class="btn-secondary" style="padding:5px 10px;font-size:11px;" onclick="copyErrorDetails('${r.id}')">📋 Copy Log</button>
              <button class="btn-primary" style="padding:5px 10px;font-size:11px;background:${r.solved ? '#475569' : '#10b981'};box-shadow:none;" onclick="toggleResolveError('${r.id}', ${r.solved})">
                ${r.solved ? 'Reopen' : 'Mark Solved'}
              </button>
              <button class="btn-secondary" style="padding:5px 8px;font-size:11px;color:#f43f5e;border-color:rgba(244,63,94,0.3);" onclick="deleteError('${r.id}')">🗑️</button>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    errorsTbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:#f87171;">Failed to load errors: ${err.message}</td></tr>`;
  }
}

// Window actions for error table
window.viewDiagnosticModal = function (id) {
  const r = currentErrorsMap[id];
  if (!r || !diagModal) return;

  activeViewingErrorId = id;
  diagModalTitle.textContent = `${r.errorName}: ${r.errorMessage.slice(0, 80)}`;
  diagModalSub.textContent = `Report ID: ${r.id} • Platform: ${r.platform} • Occurrences: ${r.count}`;

  diagMetaGrid.innerHTML = `
    <div class="diag-meta-card"><label>Status</label><span>${r.solved ? 'SOLVED' : 'ACTIVE'}</span></div>
    <div class="diag-meta-card"><label>Platform / OS</label><span>${r.platform} (${r.osVersion || 'N/A'})</span></div>
    <div class="diag-meta-card"><label>App Version</label><span>v${r.appVersion || '1.0.0'}</span></div>
    <div class="diag-meta-card"><label>Last Occurrence</label><span>${new Date(r.lastSeenAt).toLocaleString()}</span></div>
  `;

  const fullDiagnosticLog = formatFullDiagnosticLog(r);
  diagModalCode.textContent = fullDiagnosticLog;
  diagModal.classList.remove('hidden');
};

function formatFullDiagnosticLog(r) {
  return `=== CRASH / RUNTIME ERROR REPORT ===
ID: ${r.id}
Fingerprint: ${r.errorFingerprint || 'N/A'}
Error Name: ${r.errorName}
Message: ${r.errorMessage}
Platform: ${r.platform} (App v${r.appVersion || '1.0.0'}, OS: ${r.osVersion || 'unknown'})
Occurrences: ${r.count}
Status: ${r.solved ? 'SOLVED (Purges in 24h)' : 'ACTIVE (Default TTL: 7d)'}
First Seen: ${r.firstSeenAt}
Last Seen: ${r.lastSeenAt}
Auto Expires At: ${r.expiresAt}

--- STACK TRACE ---
${r.stackTrace || 'No stack trace available'}

--- COMPONENT STACK ---
${r.componentStack || 'N/A'}

--- DECRYPTED CLIENT CONTEXT & STATE ---
${JSON.stringify(r.diagnostics || r.decryptedContext, null, 2)}
====================================`;
}

window.copyErrorDetails = async function (id) {
  const r = currentErrorsMap[id];
  if (!r) return;

  const formattedLog = formatFullDiagnosticLog(r);

  try {
    await navigator.clipboard.writeText(formattedLog);
    showToast('Crash report copied to clipboard!');
  } catch {
    prompt('Copy crash report below:', formattedLog);
  }
};

window.toggleResolveError = async function (id, currentlySolved) {
  try {
    const res = await authFetch(`/admin/errors/${id}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ solved: !currentlySolved }),
    });
    if (res && res.ok) {
      showToast(!currentlySolved ? 'Bug marked as solved! Will auto-purge in 24h.' : 'Bug reopened with 7-day retention.');
      loadErrors();
      loadStats();
    }
  } catch (err) {
    alert('Failed to update error status');
  }
};

window.deleteError = async function (id) {
  if (!confirm('Permanently delete this error report immediately?')) return;
  try {
    const res = await authFetch(`/admin/errors/${id}`, { method: 'DELETE' });
    if (res && res.ok) {
      showToast('Error report permanently deleted.');
      loadErrors();
      loadStats();
    }
  } catch (err) {
    alert('Failed to delete error report');
  }
};

// Modal close bindings
if (diagModalClose) diagModalClose.addEventListener('click', () => diagModal.classList.add('hidden'));
if (diagCloseBtn) diagCloseBtn.addEventListener('click', () => diagModal.classList.add('hidden'));
if (diagCopyBtn) {
  diagCopyBtn.addEventListener('click', () => {
    if (activeViewingErrorId) {
      window.copyErrorDetails(activeViewingErrorId);
    }
  });
}

// Filter button handlers
refreshEventsBtn.addEventListener('click', loadEvents);
filterEventType.addEventListener('change', loadEvents);
refreshRemindersBtn.addEventListener('click', loadReminders);
filterReminderStatus.addEventListener('change', loadReminders);
if (refreshErrorsBtn) refreshErrorsBtn.addEventListener('click', loadErrors);
if (filterErrorStatus) filterErrorStatus.addEventListener('change', loadErrors);
if (filterErrorSearch) filterErrorSearch.addEventListener('input', loadErrors);

// Helper: Authenticated fetch wrapper
async function authFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    logoutBtn.click();
    return null;
  }
  return res;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
