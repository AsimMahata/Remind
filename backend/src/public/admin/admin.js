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

// Tables
const eventsTbody = document.getElementById('events-tbody');
const usersTbody = document.getElementById('users-tbody');
const remindersTbody = document.getElementById('reminders-tbody');

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
    const res = await authFetch('/admin/stats');
    if (!res) return;
    const data = await res.json();
    statUsers.textContent = data.totalUsers ?? 0;
    statActive.textContent = data.activeReminders ?? 0;
    statCompleted.textContent = data.completedReminders ?? 0;
    statDeleted.textContent = data.deletedReminders ?? 0;
    statEvents.textContent = data.totalEvents ?? 0;
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
      eventsTbody.innerHTML = '<tr><td colspan="5" class="text-center">No events found matching criteria.</td></tr>';
      return;
    }

    eventsTbody.innerHTML = events
      .map((e) => {
        const dateStr = new Date(e.timestamp).toLocaleString();
        const payloadStr = e.decryptedMetadata
          ? JSON.stringify(e.decryptedMetadata)
          : (e.encryptedPayload ? '(Encrypted) ' + e.encryptedPayload.substring(0, 32) + '...' : '-');

        return `
          <tr>
            <td style="white-space:nowrap;">${dateStr}</td>
            <td><span class="badge badge-event">${e.type}</span></td>
            <td><code>${e.userId || 'Guest/System'}</code></td>
            <td><code>${e.reminderId || '-'}</code></td>
            <td><div class="code-snippet" title="${escapeHtml(payloadStr)}">${escapeHtml(payloadStr)}</div></td>
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
      usersTbody.innerHTML = '<tr><td colspan="5" class="text-center">No registered users yet.</td></tr>';
      return;
    }

    usersTbody.innerHTML = users
      .map((u) => {
        const dateStr = new Date(u.createdAt).toLocaleDateString();
        return `
          <tr>
            <td><code>${u.id}</code></td>
            <td><strong>${escapeHtml(u.email)}</strong></td>
            <td><span class="badge ${u.role === 'admin' ? 'badge-event' : 'badge-active'}">${u.role}</span></td>
            <td>${u.reminderCount ?? 0}</td>
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

// Helper: Authenticated fetch wrapper
async function authFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    // Session expired
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

// Filter button handlers
refreshEventsBtn.addEventListener('click', loadEvents);
filterEventType.addEventListener('change', loadEvents);
refreshRemindersBtn.addEventListener('click', loadReminders);
filterReminderStatus.addEventListener('change', loadReminders);
