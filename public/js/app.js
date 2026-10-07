/* ---------------------------------------------------------
   AR Callers Attendance Portal JS
   --------------------------------------------------------- */

const API_BASE = '/api';

const state = {
  currentUser: null,
  token: null,
  selectedDate: new Date().toISOString().split('T')[0],
  isWeekend: false,
  records: [],
  searchQuery: '',
  activeTab: 'All',
  enableVoiceAudio: true
};

document.addEventListener('DOMContentLoaded', () => {
  initApp();

  // Close active modals on Escape key press
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    }
  });

  // Close active modal when clicking outside on the dark backdrop overlay
  document.addEventListener('click', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('active');
    }
  });
});

function getTodayIsoString() {
  try {
    const options = { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(new Date());
    let month = '01', day = '01', year = '2026';
    for (const part of parts) {
      if (part.type === 'month') month = part.value;
      if (part.type === 'day') day = part.value;
      if (part.type === 'year') year = part.value;
    }
    return `${year}-${month}-${day}`;
  } catch (e) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

function getUSIsoDateStringForOffset(offsetDays = 0) {
  try {
    const now = new Date();
    now.setDate(now.getDate() + offsetDays);
    const options = { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);
    let month = '01', day = '01', year = '2026';
    for (const part of parts) {
      if (part.type === 'month') month = part.value;
      if (part.type === 'day') day = part.value;
      if (part.type === 'year') year = part.value;
    }
    return `${year}-${month}-${day}`;
  } catch (e) {
    const now = new Date();
    now.setDate(now.getDate() + offsetDays);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}


function initApp() {
  const today = getTodayIsoString();
  const currentMonth = today.substring(0, 7);

  state.selectedDate = today;

  const dateInput = document.getElementById('selectedDateInput');
  if (dateInput) dateInput.value = today;

  const monthInput = document.getElementById('exportMonthInput');
  if (monthInput) monthInput.value = currentMonth;

  // Clear session so page refresh ALWAYS forces login page
  state.currentUser = null;
  state.token = null;
  localStorage.removeItem('arcallers_user');
  localStorage.removeItem('arcallers_token');
  sessionStorage.removeItem('arcallers_active_date');

  showWelcomeScreen();
}

function showWelcomeScreen() {
  document.getElementById('welcomeScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display = 'none';

  // Reset login form inputs on welcome screen display
  const loginForm = document.getElementById('welcomeLoginForm');
  if (loginForm) loginForm.reset();
}

function showAppScreen() {
  document.getElementById('welcomeScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'block';

  const user = state.currentUser;
  if (user) {
    document.getElementById('headerUserName').textContent = user.name || 'Admin User';
    const avatar = document.getElementById('headerUserAvatar');
    if (avatar) avatar.textContent = getInitials(user.name);
  }

  // ALWAYS display TODAY / PRESENT DATE on login
  const todayStr = getTodayIsoString();
  state.selectedDate = todayStr;
  sessionStorage.removeItem('arcallers_active_date');

  const dateInput = document.getElementById('selectedDateInput');
  if (dateInput) dateInput.value = todayStr;

  fetchAttendanceForDate();
}

/* ---------------------------------------------------------
   1. AUTHENTICATION & PASSWORD MANAGEMENT
   --------------------------------------------------------- */
async function handleAdminLogin(e) {
  e.preventDefault();

  const usernameOrId = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  if (!usernameOrId || !password) {
    showToast('Please enter username/phone and password', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrId, password })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Login failed', 'error');
      return;
    }

    state.currentUser = data.user;
    state.token = data.token;
    // Do not save to localStorage so refresh ALWAYS requires login again!
    localStorage.removeItem('arcallers_user');
    localStorage.removeItem('arcallers_token');

    showToast(`Welcome ${data.user.name}! Logged in as Admin.`, 'success');
    showAppScreen();
    playSweetAdminGreeting(data.user.name, state.selectedDate);
  } catch (err) {
    showToast('Network error during login', 'error');
  }
}

function handleLogout() {
  state.currentUser = null;
  state.token = null;
  localStorage.removeItem('arcallers_user');
  localStorage.removeItem('arcallers_token');
  showWelcomeScreen();
  showToast('Logged out successfully', 'success');
}

async function handleChangePassword(e) {
  e.preventDefault();

  const currentPassword = document.getElementById('currentPasswordInput').value;
  const newPassword = document.getElementById('newPasswordInput').value;
  const confirmPassword = document.getElementById('confirmPasswordInput').value;

  if (!state.currentUser) {
    showToast('You must be logged in to change password', 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('New password and confirm password do not match', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.currentUser.id,
        currentPassword,
        newPassword
      })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to update password', 'error');
      return;
    }

    showToast('Password updated successfully!', 'success');
    closeModal('change-password-modal');
    document.getElementById('changePasswordForm').reset();
  } catch (err) {
    showToast('Error updating password', 'error');
  }
}

/* ---------------------------------------------------------
   2. ATTENDANCE & ROSTER MANAGEMENT
   --------------------------------------------------------- */
function handleDateChange() {
  const dateInput = document.getElementById('selectedDateInput');
  if (dateInput && dateInput.value) {
    state.selectedDate = dateInput.value;
    sessionStorage.setItem('arcallers_active_date', dateInput.value);
    fetchAttendanceForDate();
  }
}

function changeDateByOffset(offsetDays) {
  const dateInput = document.getElementById('selectedDateInput');
  const currentStr = (dateInput && dateInput.value) ? dateInput.value : state.selectedDate;

  if (!currentStr) return;

  const parts = currentStr.split('-');
  if (parts.length !== 3) return;

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);

  const dateObj = new Date(Date.UTC(y, m, d + offsetDays));

  const resY = dateObj.getUTCFullYear();
  const resM = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const resD = String(dateObj.getUTCDate()).padStart(2, '0');
  const newDateStr = `${resY}-${resM}-${resD}`;

  state.selectedDate = newDateStr;
  sessionStorage.setItem('arcallers_active_date', newDateStr);

  if (dateInput) dateInput.value = newDateStr;

  fetchAttendanceForDate();
}

function jumpToDate(target) {
  let dateStr = getTodayIsoString();
  if (target === 'yesterday') {
    dateStr = getUSIsoDateStringForOffset(-1);
  }

  state.selectedDate = dateStr;
  sessionStorage.setItem('arcallers_active_date', dateStr);

  const dateInput = document.getElementById('selectedDateInput');
  if (dateInput) dateInput.value = dateStr;

  fetchAttendanceForDate();
}

function handleSearchInput() {
  const searchInput = document.getElementById('searchEmployeeInput');
  if (searchInput) {
    state.searchQuery = searchInput.value.toLowerCase().trim();
    renderAttendanceTable();
  }
}

function setFilterTab(filterName) {
  state.activeTab = filterName;
  const tabs = document.querySelectorAll('.filter-tab');
  tabs.forEach(tab => {
    if (tab.dataset.filter === filterName) tab.classList.add('active');
    else tab.classList.remove('active');
  });
  renderAttendanceTable();
}

function formatUSDate(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('/')) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[1]}/${parts[2]}/${parts[0]}`; // MM/DD/YYYY format
}

async function fetchAttendanceForDate() {
  const date = state.selectedDate;
  const parts = date.split('-');
  if (parts.length !== 3) return;

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);

  const dateObj = new Date(Date.UTC(y, m, d));
  const usDateNum = `${parts[1]}/${parts[2]}/${parts[0]}`; // MM/DD/YYYY
  const formattedDate = dateObj.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const dayOfWeek = dateObj.getUTCDay();
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
  state.isWeekend = isWeekend;

  const dateBadge = document.getElementById('currentDateBadge');
  if (dateBadge) {
    dateBadge.textContent = isWeekend ? `US Date (MM/DD/YYYY): ${usDateNum} (${formattedDate} - Weekend Off)` : `US Date (MM/DD/YYYY): ${usDateNum} (${formattedDate})`;
    dateBadge.className = isWeekend ? 'date-badge date-badge-weekend' : 'date-badge';
  }

  try {
    const res = await fetch(`${API_BASE}/attendance?date=${date}`);
    if (!res.ok) {
      showToast('Failed to load attendance records', 'error');
      return;
    }

    const data = await res.json();
    state.records = data.records || [];
    renderAttendanceTable();
    updateStatsSummary();
  } catch (err) {
    showToast('Error loading attendance', 'error');
  }
}

function renderAttendanceTable() {
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody) return;

  const search = state.searchQuery;
  const activeTab = state.activeTab;

  const filtered = state.records.filter(r => {
    const matchSearch = !search || 
      r.name.toLowerCase().includes(search) || 
      r.employeeId.toLowerCase().includes(search);
    
    let matchTab = true;
    if (activeTab === 'Present') matchTab = (r.status === 'Present');
    else if (activeTab === 'Absent') matchTab = (r.status === 'Absent');
    else if (activeTab === 'Half Day') matchTab = (r.status === 'Half Day');
    else if (activeTab === 'Holiday / Off') matchTab = (r.status === 'Holiday / Off' || r.status === 'On Leave');

    return matchSearch && matchTab;
  });

  // Sort employees numerically by DBS ID integer value
  filtered.sort((a, b) => extractDBSNum(a.employeeId) - extractDBSNum(b.employeeId));

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center empty-state">
          <i class="fa-solid fa-folder-open text-muted"></i>
          <p>No employees found for filter "${escapeHTML(activeTab)}"${search ? ` matching "${escapeHTML(search)}"` : ''}</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(emp => {
    const initials = getInitials(emp.name);
    const isPresent = emp.status === 'Present';
    const isAbsent = emp.status === 'Absent';
    const isHalfDay = emp.status === 'Half Day';
    const isOff = (emp.status === 'Holiday / Off' || emp.status === 'On Leave');

    const pCount = emp.monthlyPresent || 0;
    const aCount = emp.monthlyAbsent || 0;

    return `
      <tr>
        <td>
          <div class="emp-profile">
            <div class="emp-avatar" style="background-color: ${emp.avatarColor || '#F59E0B'}">${initials}</div>
            <div class="emp-details">
              <span class="emp-name">${escapeHTML(emp.name)}</span>
              <span class="emp-id">${escapeHTML(emp.employeeId)}</span>
            </div>
          </div>
        </td>
        <td class="text-center">
          ${emp.employeeId === 'DBS-540' || emp.employeeId === 'DBS-327' ? `
            <span class="streak-badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4); padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
              <i class="fa-solid fa-star text-yellow"></i> 100% Perfect
            </span>
          ` : `
            <div style="display: flex; gap: 6px; justify-content: center; align-items: center; flex-wrap: wrap;">
              <span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 700;" title="Total Present days this month">
                <i class="fa-solid fa-circle-check"></i> ${pCount} Present
              </span>
              <span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 700;" title="Total Absent days this month">
                <i class="fa-solid fa-circle-xmark"></i> ${aCount} Absent
              </span>
            </div>
          `}
        </td>
        <td>
          <div class="status-btn-group">
            <button class="status-pill status-present ${isPresent ? 'active' : ''}" onclick="handleMarkAttendance('${emp.employeeId}', 'Present')">
              <i class="fa-solid fa-circle-check"></i> Present
            </button>
            <button class="status-pill status-absent ${isAbsent ? 'active' : ''}" onclick="handleMarkAttendance('${emp.employeeId}', 'Absent')">
              <i class="fa-solid fa-circle-xmark"></i> Absent
            </button>
            <button class="status-pill status-halfday ${isHalfDay ? 'active' : ''}" onclick="handleMarkAttendance('${emp.employeeId}', 'Half Day')">
              <i class="fa-solid fa-adjust"></i> Half Day
            </button>
            <button class="status-pill status-off ${isOff ? 'active' : ''}" onclick="handleMarkAttendance('${emp.employeeId}', 'Holiday / Off')">
              <i class="fa-solid fa-umbrella-beach"></i> Off / Holiday
            </button>
          </div>
        </td>
        <td class="text-right">
          ${emp.employeeId !== 'DBS-540' && emp.employeeId !== 'DBS-327' && emp.employeeId !== 'DBS-7569' ? `
            <button class="btn-delete" onclick="handleDeleteEmployee('${emp.employeeId}', '${escapeHTML(emp.name)}')" title="Delete Employee">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : '<span class="admin-badge-sm">Admin</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

function updateStatsSummary() {
  const total = state.records.length;
  let present = 0;
  let absent = 0;
  let halfDay = 0;
  let holidayOff = 0;
  let unmarked = 0;

  state.records.forEach(r => {
    if (r.status === 'Present') present++;
    else if (r.status === 'Absent') absent++;
    else if (r.status === 'Half Day') halfDay++;
    else if (r.status === 'Holiday / Off' || r.status === 'On Leave') holidayOff++;
    else unmarked++;
  });

  const markedWork = present + absent + halfDay;
  const rate = markedWork > 0 ? Math.round(((present + (halfDay * 0.5)) / markedWork) * 100) : 0;

  if (document.getElementById('statTotalEmp')) document.getElementById('statTotalEmp').textContent = total;
  if (document.getElementById('statPresent')) document.getElementById('statPresent').textContent = present;
  if (document.getElementById('statAbsent')) document.getElementById('statAbsent').textContent = absent;
  if (document.getElementById('statHalfDay')) document.getElementById('statHalfDay').textContent = halfDay;
  if (document.getElementById('statHolidayOff')) document.getElementById('statHolidayOff').textContent = holidayOff;
  if (document.getElementById('statUnmarked')) document.getElementById('statUnmarked').textContent = unmarked;
  
  const rateEl = document.getElementById('statRate');
  if (rateEl) rateEl.textContent = `${rate}%`;

  const btnRemaining = document.getElementById('btnMarkRemainingPresent');
  if (btnRemaining) {
    if (unmarked > 0) {
      btnRemaining.style.display = 'inline-flex';
      btnRemaining.innerHTML = `<i class="fa-solid fa-check-double text-yellow"></i> Mark Remaining (${unmarked}) as Present`;
    } else {
      btnRemaining.style.display = 'none';
    }
  }
}

async function handleMarkRemainingPresent() {
  const unmarkedRecs = state.records.filter(r => r.status === 'Unmarked' || !r.status);
  if (unmarkedRecs.length === 0) {
    showToast('All AR Callers are already marked!', 'info');
    return;
  }

  const count = unmarkedRecs.length;
  unmarkedRecs.forEach(r => {
    handleMarkAttendance(r.employeeId, 'Present');
  });

  showToast(`Successfully marked all ${count} remaining callers as Present!`, 'success');
}

async function handleMarkAttendance(employeeId, status) {
  const date = state.selectedDate;

  // Optimistic UI update
  const rec = state.records.find(r => r.employeeId === employeeId);
  if (rec) {
    const oldStatus = rec.status;
    rec.status = status;

    if (oldStatus === 'Present' && status !== 'Present') rec.monthlyPresent = Math.max(0, (rec.monthlyPresent || 0) - 1);
    if (oldStatus === 'Absent' && status !== 'Absent') rec.monthlyAbsent = Math.max(0, (rec.monthlyAbsent || 0) - 1);

    if (status === 'Present' && oldStatus !== 'Present') rec.monthlyPresent = (rec.monthlyPresent || 0) + 1;
    if (status === 'Absent' && oldStatus !== 'Absent') rec.monthlyAbsent = (rec.monthlyAbsent || 0) + 1;

    renderAttendanceTable();
    updateStatsSummary();
  }

  try {
    const res = await fetch(`${API_BASE}/attendance/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, date, status })
    });

    if (!res.ok) {
      showToast('Failed to update attendance', 'error');
      fetchAttendanceForDate(); // revert
      return;
    }

    showToast(`Marked ${status} for ${rec ? rec.name : employeeId}`, 'success');
  } catch (err) {
    showToast('Network error marking attendance', 'error');
    fetchAttendanceForDate();
  }
}

async function handleMarkAll(status) {
  const date = state.selectedDate;
  if (!confirm(`Mark ALL ${state.records.length} employees as ${status} for ${date}?`)) return;

  try {
    const res = await fetch(`${API_BASE}/attendance/mark-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, status })
    });

    if (!res.ok) {
      showToast('Bulk update failed', 'error');
      return;
    }

    showToast(`Marked all employees as ${status}`, 'success');
    fetchAttendanceForDate();
  } catch (err) {
    showToast('Error in bulk status update', 'error');
  }
}

/* ---------------------------------------------------------
   3. EMPLOYEE ADD / DELETE
   --------------------------------------------------------- */
async function handleAddEmployee(e) {
  e.preventDefault();

  const name = document.getElementById('newEmpName').value;
  const id = document.getElementById('newEmpId').value;

  try {
    const res = await fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, id, department: 'AR Callers' })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to add employee', 'error');
      return;
    }

    showToast(`Added ${data.name} (${data.id}) as AR Caller!`, 'success');
    closeModal('add-employee-modal');
    document.getElementById('addEmployeeForm').reset();
    fetchAttendanceForDate();
  } catch (err) {
    showToast('Error adding employee', 'error');
  }
}

async function handleDeleteEmployee(empId, empName) {
  if (!confirm(`Delete employee ${empName} (${empId})? This action cannot be undone.`)) return;

  try {
    const res = await fetch(`${API_BASE}/employees/${empId}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const data = await res.json();
      showToast(data.error || 'Delete failed', 'error');
      return;
    }

    showToast(`Employee ${empName} deleted`, 'success');
    fetchAttendanceForDate();
  } catch (err) {
    showToast('Error deleting employee', 'error');
  }
}

/* ---------------------------------------------------------
   4. EXPORT MONTHLY EXCEL REPORT
   --------------------------------------------------------- */
function handleExportMonthly(e) {
  e.preventDefault();
  const monthVal = document.getElementById('exportMonthInput').value;

  if (!monthVal) {
    showToast('Select a month to export', 'error');
    return;
  }

  showToast(`Downloading Monthly Excel Report for ${monthVal}...`, 'success');
  closeModal('export-monthly-modal');

  window.location.href = `${API_BASE}/export/monthly-excel?month=${monthVal}`;
}

function handleDownloadBackup() {
  showToast('Downloading full database backup JSON...', 'success');
  window.location.href = `${API_BASE}/backup/download`;
}

async function handleSendEmailBackup() {
  const recipientInput = document.getElementById('settingRecipientEmail');
  const webAppUrlInput = document.getElementById('settingWebAppUrl');

  const recipientEmail = recipientInput ? recipientInput.value.trim() : 'sagaralapati3695@gmail.com';
  const webAppUrl = webAppUrlInput ? webAppUrlInput.value.trim() : '';

  showToast(`Connecting to email backup service for ${recipientEmail}...`, 'info');
  try {
    const res = await fetch(`${API_BASE}/backup/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: recipientEmail, webAppUrl: webAppUrl })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message, 'success');
    } else if (data.requiresConfig) {
      showToast(data.error || 'Email backup dispatch notice', 'warning');
    } else {
      showToast(data.error || data.message || 'Failed to send email backup', 'error');
    }
  } catch (err) {
    showToast('Error connecting to server for email backup', 'error');
  }
}

async function triggerSendTestEmail() {
  const btn = document.getElementById('btnTestSendEmail');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending Test Email...`;
  }
  try {
    const recipientInput = document.getElementById('settingRecipientEmail');
    const webAppUrlInput = document.getElementById('settingWebAppUrl');

    const recipientEmail = recipientInput ? recipientInput.value.trim() : 'sagaralapati3695@gmail.com';
    const webAppUrl = webAppUrlInput ? webAppUrlInput.value.trim() : '';

    // Auto-save settings to server first so Web App URL is active immediately
    await fetch(`${API_BASE}/admin/email-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientEmail,
        webAppUrl,
        autoBackupEnabled: true
      })
    });

    await handleSendEmailBackup();
    await loadEmailSettingsIntoModal();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-paper-plane text-yellow"></i> Send Test Email Now`;
    }
  }
}

async function openEmailSettingsModal() {
  openModal('email-settings-modal');
  await loadEmailSettingsIntoModal();
}

async function loadEmailSettingsIntoModal() {
  try {
    const res = await fetch(`${API_BASE}/admin/email-settings`);
    if (!res.ok) return;
    const data = await res.json();

    const recipientInput = document.getElementById('settingRecipientEmail');
    const webAppUrlInput = document.getElementById('settingWebAppUrl');
    const webAppBadge = document.getElementById('webAppUrlConfiguredBadge');
    const hostInput = document.getElementById('settingSmtpHost');
    const portInput = document.getElementById('settingSmtpPort');
    const passInput = document.getElementById('settingSmtpPass');
    const badge = document.getElementById('smtpPassConfiguredBadge');
    const statusBox = document.getElementById('emailStatusBox');
    const statusText = document.getElementById('emailStatusText');

    if (recipientInput) recipientInput.value = data.recipientEmail || 'sagaralapati3695@gmail.com';
    if (webAppUrlInput) webAppUrlInput.value = data.webAppUrl || '';
    if (webAppBadge) webAppBadge.style.display = data.webAppUrl ? 'block' : 'none';
    if (hostInput) hostInput.value = data.smtpHost || 'smtp.gmail.com';
    if (portInput) portInput.value = data.smtpPort || 587;
    if (passInput) {
      if (data.hasPassword) {
        passInput.placeholder = "App Password saved (leave blank to keep current)";
      } else {
        passInput.placeholder = "Enter Gmail App Password (e.g. abcd efgh ijkl mnop)";
      }
    }

    if (badge) {
      badge.style.display = data.hasPassword ? 'block' : 'none';
    }

    if (statusBox && statusText) {
      statusBox.style.display = 'block';
      if (data.lastSentAt && data.lastStatus) {
        const isSuccess = data.lastStatus.startsWith('Success');
        const colorClass = isSuccess ? 'text-green' : 'text-red';
        const icon = isSuccess ? 'fa-circle-check' : 'fa-triangle-exclamation';
        statusText.innerHTML = `<span class="${colorClass}"><i class="fa-solid ${icon}"></i> ${escapeHTML(data.lastStatus)}</span> <small class="text-muted">(${new Date(data.lastSentAt).toLocaleString()})</small>`;
      } else {
        statusText.textContent = (data.webAppUrl || data.hasPassword) ? 'Ready to send email backups automatically' : 'Enter Google Web App URL or App Password to enable email backups';
      }
    }
  } catch (err) {}
}

async function handleSaveEmailSettings(event) {
  event.preventDefault();
  const recipientEmail = document.getElementById('settingRecipientEmail').value.trim();
  const webAppUrl = document.getElementById('settingWebAppUrl') ? document.getElementById('settingWebAppUrl').value.trim() : '';
  const smtpHost = document.getElementById('settingSmtpHost').value.trim();
  const smtpPort = document.getElementById('settingSmtpPort').value.trim();
  const smtpPass = document.getElementById('settingSmtpPass').value.trim();

  try {
    const res = await fetch(`${API_BASE}/admin/email-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientEmail,
        webAppUrl,
        smtpHost,
        smtpPort,
        smtpUser: recipientEmail,
        smtpPass,
        autoBackupEnabled: true
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Email backup settings saved successfully!', 'success');
      if (webAppUrl || smtpPass) {
        if (smtpPass) document.getElementById('settingSmtpPass').value = '';
        showToast('Testing email dispatch with saved settings...', 'info');
        await triggerSendTestEmail();
      }
    } else {
      showToast(data.error || 'Failed to save email settings', 'error');
    }
  } catch (err) {
    showToast('Error saving email settings', 'error');
  }
}

async function handleImportBackupSubmit(event) {
  event.preventDefault();
  const fileInput = document.getElementById('backupFileInput');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast('Please select a .json backup file first', 'error');
    return;
  }

  const file = fileInput.files[0];
  const submitBtn = document.getElementById('btnSubmitImport');
  const statusBox = document.getElementById('importStatusBox');
  const statusText = document.getElementById('importStatusText');

  if (submitBtn) submitBtn.disabled = true;
  if (statusBox) statusBox.style.display = 'block';
  if (statusText) statusText.textContent = 'Reading backup file...';

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const jsonContent = JSON.parse(e.target.result);

      if (statusText) statusText.textContent = 'Importing & merging data with database...';

      const res = await fetch(`${API_BASE}/backup/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonContent)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message, 'success');
        closeModal('import-backup-modal');
        fileInput.value = '';
        await fetchAttendanceForDate(state.selectedDate);
      } else {
        showToast(data.error || 'Failed to import backup file', 'error');
      }
    } catch (err) {
      showToast('Invalid JSON file format. Please check the file content.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (statusBox) statusBox.style.display = 'none';
    }
  };

  reader.onerror = function() {
    showToast('Failed to read the backup file', 'error');
    if (submitBtn) submitBtn.disabled = false;
    if (statusBox) statusBox.style.display = 'none';
  };

  reader.readAsText(file);
}

async function openMonthlySummaryModal() {
  const monthInput = document.getElementById('summaryMonthInput');
  const currentMonth = new Date().toISOString().substring(0, 7);
  if (monthInput) monthInput.value = currentMonth;
  openModal('monthly-summary-modal');
  await fetchMonthlySummaryData();
}

async function fetchMonthlySummaryData() {
  const monthInput = document.getElementById('summaryMonthInput');
  const monthVal = monthInput ? monthInput.value : new Date().toISOString().substring(0, 7);
  const tbody = document.getElementById('monthlySummaryTableBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="text-center">Loading monthly summary...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/admin/monthly-summary?month=${monthVal}`);
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-red">Failed to load summary</td></tr>`;
      return;
    }

    const data = await res.json();
    if (!data.summary || data.summary.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No attendance data for month ${monthVal}</td></tr>`;
      return;
    }

    // Compute Monthly Attendance Distribution Metrics for Visual Bar
    let totalP = 0, totalA = 0, totalH = 0, totalO = 0;
    data.summary.forEach(s => {
      totalP += (s.present || 0);
      totalA += (s.absent || 0);
      totalH += (s.halfDay || 0);
      totalO += (s.holidayOff || 0);
    });

    const sumAll = totalP + totalA + totalH + totalO;
    const pPct = sumAll > 0 ? Math.round((totalP / sumAll) * 100) : 0;
    const aPct = sumAll > 0 ? Math.round((totalA / sumAll) * 100) : 0;
    const hPct = sumAll > 0 ? Math.round((totalH / sumAll) * 100) : 0;
    const oPct = sumAll > 0 ? Math.round((totalO / sumAll) * 100) : 0;

    const barWrap = document.getElementById('analyticsBarWrap');
    if (barWrap) {
      barWrap.innerHTML = `
        <div class="analytics-progress-bar">
          <div class="analytics-segment segment-present" style="width: ${pPct}%" title="Present: ${pPct}%"></div>
          <div class="analytics-segment segment-absent" style="width: ${aPct}%" title="Absent: ${aPct}%"></div>
          <div class="analytics-segment segment-halfday" style="width: ${hPct}%" title="Half Day: ${hPct}%"></div>
          <div class="analytics-segment segment-off" style="width: ${oPct}%" title="Holiday/Off: ${oPct}%"></div>
        </div>
        <div class="analytics-legend">
          <div class="legend-item"><span class="legend-dot segment-present"></span> Present: <strong>${totalP} (${pPct}%)</strong></div>
          <div class="legend-item"><span class="legend-dot segment-absent"></span> Absent: <strong>${totalA} (${aPct}%)</strong></div>
          <div class="legend-item"><span class="legend-dot segment-halfday"></span> Half Day: <strong>${totalH} (${hPct}%)</strong></div>
          <div class="legend-item"><span class="legend-dot segment-off"></span> Holiday/Off: <strong>${totalO} (${oPct}%)</strong></div>
        </div>
      `;
    }

    tbody.innerHTML = data.summary.map(item => {
      const isPerfect = (item.absent === 0 && item.present > 0);
      return `
        <tr>
          <td><strong>${escapeHTML(item.id)}</strong></td>
          <td>
            ${escapeHTML(item.name)}
            ${isPerfect ? '<span class="streak-badge"><i class="fa-solid fa-star text-yellow"></i> 100% Perfect</span>' : ''}
          </td>
          <td class="text-center text-green"><strong>${item.present}</strong></td>
          <td class="text-center text-red"><strong>${item.absent}</strong></td>
          <td class="text-center text-purple"><strong>${item.halfDay}</strong></td>
          <td class="text-center text-blue"><strong>${item.holidayOff}</strong></td>
          <td class="text-center text-yellow"><strong>${item.rate}</strong></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-red">Error loading monthly summary</td></tr>`;
  }
}

function triggerDownloadFromSummary() {
  const monthInput = document.getElementById('summaryMonthInput');
  const monthVal = monthInput ? monthInput.value : new Date().toISOString().substring(0, 7);
  window.location.href = `${API_BASE}/export/monthly-excel?month=${monthVal}`;
}

async function openAdminToolsModal() {
  openModal('admin-tools-modal');
  try {
    const res = await fetch(`${API_BASE}/admin/system-status`);
    if (res.ok) {
      const data = await res.json();
      document.getElementById('sysStatusText').textContent = `${data.status} (Storage: Soft Delete & Backup Active)`;
      document.getElementById('sysActiveEmp').textContent = `${data.activeEmployees} active (${data.archivedEmployees} archived)`;
      document.getElementById('sysTotalRecords').textContent = data.totalAttendanceRecords;
    }
  } catch (err) {
    document.getElementById('sysStatusText').textContent = 'Healthy';
  }
}

/* ---------------------------------------------------------
   5. HELPERS & UTILITIES
   --------------------------------------------------------- */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function getInitials(name) {
  if (!name) return 'AR';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHTML(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function extractDBSNum(idStr) {
  const match = String(idStr || '').match(/\d+/);
  return match ? parseInt(match[0], 10) : 999999;
}

/* ---------------------------------------------------------
   6. INTERACTIVE MONTH & DAY CALENDAR NAVIGATOR
   --------------------------------------------------------- */
const calendarState = {
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth()
};

function openCalendarModal() {
  if (state.selectedDate) {
    const parts = state.selectedDate.split('-');
    if (parts.length === 3) {
      calendarState.viewYear = parseInt(parts[0], 10);
      calendarState.viewMonth = parseInt(parts[1], 10) - 1;
    }
  }
  openModal('calendar-picker-modal');
  renderCalendarWidget();
}

function renderCalendarWidget() {
  const year = calendarState.viewYear;
  const month = calendarState.viewMonth;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const titleEl = document.getElementById('calendarMonthTitle');
  if (titleEl) titleEl.textContent = `${monthNames[month]} ${year}`;

  const monthSelect = document.getElementById('calendarMonthSelect');
  if (monthSelect) monthSelect.value = month;
  const yearSelect = document.getElementById('calendarYearSelect');
  if (yearSelect) yearSelect.value = year;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const gridEl = document.getElementById('calendarDaysGrid');
  if (!gridEl) return;

  let html = '';
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="calendar-day empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayOfWeek = (firstDay + day - 1) % 7;
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateIso = `${year}-${mStr}-${dStr}`;

    const isSelected = (state.selectedDate === dateIso);
    const isToday = (new Date().toISOString().split('T')[0] === dateIso);

    let classes = 'calendar-day';
    if (isWeekend) classes += ' weekend';
    if (isToday) classes += ' today';
    if (isSelected) classes += ' selected';

    html += `
      <div class="${classes}" onclick="selectDateFromCalendar('${dateIso}')" title="${mStr}/${dStr}/${year} ${isWeekend ? '(Weekend Off)' : ''}">
        <span class="day-num">${day}</span>
        ${isWeekend ? '<span class="day-tag">Off</span>' : ''}
      </div>
    `;
  }

  gridEl.innerHTML = html;
}

function selectDateFromCalendar(isoDate) {
  state.selectedDate = isoDate;
  const dateInput = document.getElementById('selectedDateInput');
  if (dateInput) dateInput.value = isoDate;
  closeModal('calendar-picker-modal');
  fetchAttendanceForDate();
  showToast(`Loaded attendance for US Date: ${formatUSDate(isoDate)}`, 'success');
}

function navCalendarMonth(offset) {
  calendarState.viewMonth += offset;
  if (calendarState.viewMonth < 0) {
    calendarState.viewMonth = 11;
    calendarState.viewYear -= 1;
  } else if (calendarState.viewMonth > 11) {
    calendarState.viewMonth = 0;
    calendarState.viewYear += 1;
  }
  renderCalendarWidget();
}

function onCalendarMonthYearChange() {
  const monthSelect = document.getElementById('calendarMonthSelect');
  const yearSelect = document.getElementById('calendarYearSelect');
  if (monthSelect) calendarState.viewMonth = parseInt(monthSelect.value, 10);
  if (yearSelect) calendarState.viewYear = parseInt(yearSelect.value, 10);
  renderCalendarWidget();
}

/* ---------------------------------------------------------
   7. VOICE COMMAND RECOGNITION (INDIAN ENGLISH & FUZZY MATCH)
   --------------------------------------------------------- */
let speechRecognitionObj = null;
let isVoiceListening = false;

function toggleVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast('Voice recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.', 'error');
    return;
  }

  if (isVoiceListening && speechRecognitionObj) {
    speechRecognitionObj.stop();
    return;
  }

  try {
    speechRecognitionObj = new SpeechRecognition();
    speechRecognitionObj.continuous = false;
    speechRecognitionObj.interimResults = true; // Live real-time speech feedback

    try {
      speechRecognitionObj.lang = 'en-IN';
    } catch (e) {
      speechRecognitionObj.lang = 'en-US';
    }

    speechRecognitionObj.onstart = () => {
      isVoiceListening = true;
      updateVoiceUI(true, 'Listening... Speak e.g., "Mark Rajesh Absent" or "Mark remaining present"');
      showToast('🎤 Voice Active! Speak e.g. "Mark Rajesh Absent"', 'success');
    };

    speechRecognitionObj.onend = () => {
      isVoiceListening = false;
      updateVoiceUI(false);
    };

    speechRecognitionObj.onerror = (event) => {
      isVoiceListening = false;
      updateVoiceUI(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        showToast('Microphone access denied. Please allow microphone permissions in your browser address bar.', 'error');
      } else if (event.error !== 'no-speech') {
        showToast(`Voice error: ${event.error}`, 'error');
      }
    };

    speechRecognitionObj.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const liveText = (finalTranscript || interimTranscript).trim();
      const searchInput = document.getElementById('searchEmployeeInput');
      if (searchInput && liveText) {
        searchInput.value = liveText;
      }

      if (liveText) {
        updateVoiceUI(true, `Hearing: "${liveText}"`);
      }

      if (finalTranscript) {
        handleVoiceCommandProcess(finalTranscript.trim());
      }
    };

    speechRecognitionObj.start();
  } catch (err) {
    updateVoiceUI(false);
    showToast('Could not start microphone. Please check browser permissions.', 'error');
  }
}

function updateVoiceUI(active, message = '') {
  const micBtn = document.getElementById('voiceMicBtn');
  const banner = document.getElementById('voiceBanner');
  const bannerText = document.getElementById('voiceBannerText');

  if (micBtn) {
    if (active) micBtn.classList.add('listening');
    else micBtn.classList.remove('listening');
  }

  if (banner) {
    if (active) {
      banner.style.display = 'flex';
      if (bannerText && message) bannerText.textContent = message;
    } else {
      banner.style.display = 'none';
    }
  }
}

// Phonetic normalization for Indian speech & name variations
function normalizePhonetic(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/sh/g, 's')
    .replace(/ch/g, 'c')
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/aa/g, 'a')
    .replace(/y/g, 'i')
    .replace(/ck/g, 'k')
    .replace(/([a-z])\1+/g, '$1') // remove double letters (e.g. kk -> k, ss -> s)
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

// Levenshtein distance similarity (0.0 to 1.0)
function getLevenshteinSimilarity(s1, s2) {
  const a = normalizePhonetic(s1);
  const b = normalizePhonetic(s2);
  if (a === b) return 1.0;
  if (!a.length || !b.length) return 0.0;

  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[a.length][b.length];
  const maxLen = Math.max(a.length, b.length);
  return 1 - (distance / maxLen);
}

function handleVoiceCommandProcess(transcript) {
  const rawText = transcript.toLowerCase();

  // Check if this is a bulk "mark all / remaining" voice command
  // e.g. "mark present for all", "mark all present", "mark present all", "mark remaining callers present", "mark rest present", "mark everyone present"
  const isRemainingCommand = /\b(all|everyone|remaining|rest|others|other)\b/.test(rawText);

  // 1. Detect target attendance status intent with Indian English variations
  let targetStatus = null;
  if (/\b(absent|absnt|abscent|absense|not present|not come)\b/.test(rawText)) {
    targetStatus = 'Absent';
  } else if (/\b(present|prsnt|prezent|prizent|came|available|attended)\b/.test(rawText)) {
    targetStatus = 'Present';
  } else if (/\b(half day|halfday|haf day|half|1\/2 day)\b/.test(rawText)) {
    targetStatus = 'Half Day';
  } else if (/\b(off|holiday|leave|week off|day off)\b/.test(rawText)) {
    targetStatus = 'Holiday / Off';
  }

  // Handle bulk command for unmarked callers (preserving all existing Absent callers untouched)
  if (isRemainingCommand) {
    const statusToApply = targetStatus || 'Present';
    let count = 0;

    state.records.forEach(emp => {
      if (emp.status === 'Unmarked') {
        handleMarkAttendance(emp.employeeId, statusToApply);
        count++;
      }
    });

    if (count > 0) {
      const msg = `Marked remaining ${count} callers as ${statusToApply}`;
      showToast(`🎤 Voice Success: ${msg}!`, 'success');
      speakVoiceConfirmation(msg);
    } else {
      showToast(`🎤 Voice Notice: All callers are already marked for ${formatUSDate(state.selectedDate)}`, 'info');
    }
    return;
  }

  // Fallback to pure search if no status intent was spoken
  if (!targetStatus) {
    handleSearchInput();
    showToast(`🎤 Voice Search: "${transcript}"`, 'success');
    return;
  }

  // 2. Strip status & command keywords to isolate target employee names
  let namesSection = rawText
    .replace(/\b(mark|make|set|put|as|for|please|the|caller|callers|employee|employees|list|member|members)\b/g, '')
    .replace(/\b(absent|absnt|abscent|absense|not present|not come)\b/g, '')
    .replace(/\b(present|prsnt|prezent|prizent|came|available|attended)\b/g, '')
    .replace(/\b(half day|halfday|haf day|half|1\/2 day)\b/g, '')
    .replace(/\b(off|holiday|leave|week off|day off)\b/g, '')
    .trim();

  if (!namesSection) {
    showToast(`🎤 Detected "${targetStatus}", please say name (e.g. "Mark absent for Rajesh")`, 'error');
    return;
  }

  // 3. Split spoken names by delimiters like commas, "and", "&", "also", "then"
  const rawNamesList = namesSection.split(/,| and | & |\+| also | then /).map(s => s.trim()).filter(Boolean);

  const markedNames = [];
  const unmatchedQueries = [];

  rawNamesList.forEach(query => {
    let bestMatch = null;
    let highestScore = 0;

    const normQuery = normalizePhonetic(query);

    state.records.forEach(emp => {
      const empName = emp.name.toLowerCase();
      const empId = emp.employeeId.toLowerCase();
      const normEmpName = normalizePhonetic(emp.name);
      const normEmpId = normalizePhonetic(emp.employeeId);

      // A. Direct substring match (highest priority)
      if (empName.includes(query) || empId.includes(query) || normEmpName.includes(normQuery) || normEmpId.includes(normQuery)) {
        if (1.0 > highestScore) {
          highestScore = 1.0;
          bestMatch = emp;
        }
        return;
      }

      // B. Token word match (e.g. spoken "Rajesh" matching "Rajesh Dhabbakuti")
      const queryTokens = query.split(' ');
      const empNameTokens = empName.split(' ');

      for (const qToken of queryTokens) {
        if (qToken.length < 3) continue;
        const normQToken = normalizePhonetic(qToken);

        for (const eToken of empNameTokens) {
          const normEToken = normalizePhonetic(eToken);

          if (normEToken.includes(normQToken) || normQToken.includes(normEToken)) {
            const score = 0.9;
            if (score > highestScore) {
              highestScore = score;
              bestMatch = emp;
            }
          } else {
            const sim = getLevenshteinSimilarity(normQToken, normEToken);
            if (sim >= 0.65 && sim > highestScore) {
              highestScore = sim;
              bestMatch = emp;
            }
          }
        }
      }

      // C. Whole name fuzzy Levenshtein match
      const wholeSim = getLevenshteinSimilarity(query, emp.name);
      if (wholeSim >= 0.6 && wholeSim > highestScore) {
        highestScore = wholeSim;
        bestMatch = emp;
      }
    });

    if (bestMatch && highestScore >= 0.6) {
      handleMarkAttendance(bestMatch.employeeId, targetStatus);
      markedNames.push(bestMatch.name);
    } else {
      unmatchedQueries.push(query);
    }
  });

  if (markedNames.length > 0) {
    const msg = `Marked ${targetStatus} for ${markedNames.join(', ')}`;
    showToast(`🎤 Voice Success: ${msg}`, 'success');
    speakVoiceConfirmation(msg);
  }

  if (unmatchedQueries.length > 0) {
    showToast(`🎤 Could not match caller: "${unmatchedQueries.join(', ')}"`, 'error');
  }

  // Clear search input and searchQuery so roster table displays all callers with updated status
  const searchInput = document.getElementById('searchEmployeeInput');
  if (searchInput) searchInput.value = '';
  state.searchQuery = '';
  renderAttendanceTable();
}

/* ---------------------------------------------------------
   8. WHATSAPP SUMMARY & VOICE SPEECH SYNTHESIS
   --------------------------------------------------------- */
function handleShareDailySummary() {
  const dateStr = formatUSDate(state.selectedDate);
  const absentList = [];

  state.records.forEach(r => {
    if (r.status === 'Absent') {
      absentList.push(r.name);
    }
  });

  let msg = `*AR CALLERS ABSENTEE LIST (${dateStr})*\n\n`;

  if (absentList.length > 0) {
    msg += `❌ *ABSENT CALLERS (${absentList.length})*:\n` + absentList.map(n => `  - ${n}`).join('\n') + `\n`;
  } else {
    msg += `✅ *ABSENT CALLERS*: None (100% Attendance)\n`;
  }

  msg += `\n_Generated via AR Callers Portal_`;

  const encodedMsg = encodeURIComponent(msg);
  const waUrl = `https://wa.me/?text=${encodedMsg}`;

  window.open(waUrl, '_blank');
  showToast('Opening WhatsApp Share link for Absent Callers list...', 'success');
}

function toggleVoiceAudioFeedback() {
  state.enableVoiceAudio = !state.enableVoiceAudio;
  const btn = document.getElementById('voiceAudioToggleBtn');
  if (btn) {
    btn.innerHTML = state.enableVoiceAudio
      ? `<i class="fa-solid fa-volume-high text-yellow"></i> Voice Audio: ON`
      : `<i class="fa-solid fa-volume-xmark text-muted"></i> Voice Audio: OFF`;
  }
  showToast(`Voice Audio Feedback: ${state.enableVoiceAudio ? 'ENABLED' : 'DISABLED'}`, 'info');
}

function formatUSSpokenDate(dateIsoStr) {
  if (!dateIsoStr) return '';
  const parts = dateIsoStr.split('-');
  if (parts.length !== 3) return dateIsoStr;

  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[monthIdx] || '';

  let suffix = 'th';
  if (day % 10 === 1 && day !== 11) suffix = 'st';
  else if (day % 10 === 2 && day !== 12) suffix = 'nd';
  else if (day % 10 === 3 && day !== 13) suffix = 'rd';

  return `${monthName} ${day}${suffix}, ${year}`;
}

function speakVoiceConfirmation(text) {
  if (!state.enableVoiceAudio || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1.0;
    utter.lang = 'en-US';

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => 
      v.lang.replace('_', '-').startsWith('en-US') && 
      (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Zira'))
    );
    if (naturalVoice) utter.voice = naturalVoice;

    window.speechSynthesis.speak(utter);
  } catch (e) {}
}

function playSweetAdminGreeting(userName, dateIso) {
  if (!('speechSynthesis' in window)) return;

  const dateSpoken = formatUSSpokenDate(dateIso || new Date().toISOString().split('T')[0]);

  let adminDisplayName = userName || 'Admin';
  const norm = adminDisplayName.toUpperCase();
  if (norm.includes('SAGAR')) {
    adminDisplayName = 'Sagar Alapati';
  } else if (norm.includes('VIJAYA') || norm.includes('KEERTHI')) {
    adminDisplayName = 'Vijaya Sai Krishna Keerthi';
  }

  const textToSpeak = `Welcome ${adminDisplayName}! Please mark your attendance for ${dateSpoken}.`;

  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(textToSpeak);
    utter.rate = 0.92;   // Natural, realistic human speaking cadence
    utter.pitch = 1.0;   // Natural human pitch (no artificial AI tone)
    utter.volume = 1.0;
    utter.lang = 'en-US'; // American English accent & date format

    const findRealisticUSFemaleVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return null;

      // 1. Natural / Neural US English Female Voices (Most realistic human voice)
      const naturalUs = voices.find(v => 
        (v.lang.replace('_', '-').startsWith('en-US') || v.lang.startsWith('en')) && 
        (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Jenny') || v.name.includes('Aria') || v.name.includes('Online'))
      );
      if (naturalUs) return naturalUs;

      // 2. Google US English / Apple Samantha / Victoria / Zira Female Voices
      const premiumUs = voices.find(v => 
        (v.lang.replace('_', '-').startsWith('en-US') || v.lang.startsWith('en')) && 
        (v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Ava') || v.name.includes('Victoria') || v.name.includes('Zira') || v.name.includes('Female'))
      );
      if (premiumUs) return premiumUs;

      // 3. Fallback to any US English voice
      return voices.find(v => v.lang.replace('_', '-').startsWith('en-US')) || voices.find(v => v.lang.startsWith('en'));
    };

    const targetVoice = findRealisticUSFemaleVoice();
    if (targetVoice) utter.voice = targetVoice;

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        const v = findRealisticUSFemaleVoice();
        if (v) utter.voice = v;
        window.speechSynthesis.speak(utter);
      };
    } else {
      setTimeout(() => {
        window.speechSynthesis.speak(utter);
      }, 350);
    }
  } catch (e) {
    console.error('Voice Greeting Error:', e);
  }
}

/* ---------------------------------------------------------
   9. CUSTOM RANGE EXPORT & BACKUP HISTORY RESTORE MANAGER
   --------------------------------------------------------- */
function handleCustomRangeExportSubmit(e) {
  e.preventDefault();
  const startDate = document.getElementById('customExportStartDate').value;
  const endDate = document.getElementById('customExportEndDate').value;

  if (!startDate || !endDate) {
    showToast('Please select both Start Date and End Date', 'error');
    return;
  }
  if (startDate > endDate) {
    showToast('Start Date cannot be after End Date', 'error');
    return;
  }

  showToast(`Downloading Custom Range Excel Report (${formatUSDate(startDate)} to ${formatUSDate(endDate)})...`, 'success');
  closeModal('custom-range-export-modal');
  window.location.href = `${API_BASE}/export/custom-excel?startDate=${startDate}&endDate=${endDate}`;
}

function handlePresetExport(preset) {
  const currentYear = new Date().getFullYear();
  let label = preset;
  if (preset === 'YTD') label = `Full Year ${currentYear} (YTD)`;
  else label = `${preset} ${currentYear}`;

  showToast(`Downloading ${label} Attendance Excel Report...`, 'success');
  closeModal('custom-range-export-modal');
  window.location.href = `${API_BASE}/export/custom-excel?rangePreset=${preset}&year=${currentYear}`;
}

async function openBackupManagerModal() {
  openModal('backup-manager-modal');
  await fetchBackupHistory();
}

async function fetchBackupHistory() {
  const tbody = document.getElementById('backupHistoryTableBody');
  const activeBadge = document.getElementById('activeDbStatsBadge');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5" class="text-center"><i class="fa-solid fa-spinner fa-spin text-yellow"></i> Loading stored backups...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/admin/backups/list`);
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red">Failed to load backup list</td></tr>`;
      return;
    }

    const data = await res.json();
    if (activeBadge && data.activeDB) {
      activeBadge.textContent = `${data.activeDB.employees} Callers | ${data.activeDB.attendance} Historical Attendance Logs Protected`;
    }

    if (!data.backups || data.backups.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No backup snapshots found</td></tr>`;
      return;
    }

    tbody.innerHTML = data.backups.map(item => {
      const isMaster = item.isMaster;
      const dateRangeStr = (item.earliestDate && item.latestDate) ? `${item.earliestDate} to ${item.latestDate}` : 'Full System Backup';

      return `
        <tr>
          <td>
            <strong>${escapeHTML(item.filename)}</strong>
            ${isMaster ? '<span class="admin-badge-sm ml-1" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4);">Master Archive</span>' : ''}
            <div class="text-muted" style="font-size: 0.78rem;">Created: ${new Date(item.modifiedAt).toLocaleString()}</div>
          </td>
          <td><span style="font-size: 0.85rem; font-weight: 700; color: #38bdf8;">${dateRangeStr}</span></td>
          <td class="text-center"><strong>${item.attCount}</strong> logs (${item.empCount} callers)</td>
          <td class="text-center text-muted">${item.sizeKb} KB</td>
          <td class="text-right">
            <div style="display: flex; gap: 6px; justify-content: flex-end;">
              <a class="btn-ghost-sm" href="${API_BASE}/backup/download?file=${encodeURIComponent(item.filename)}" title="Download JSON file">
                <i class="fa-solid fa-download text-yellow"></i>
              </a>
              <button class="btn-primary-yellow" style="padding: 6px 12px; font-size: 0.8rem;" onclick="handleRestoreBackup('${escapeHTML(item.filename)}', ${item.attCount})">
                <i class="fa-solid fa-rotate-left"></i> Restore This Point
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red">Error fetching backup history</td></tr>`;
  }
}

async function handleRestoreBackup(filename, logCount) {
  if (!confirm(`⚠️ RESTORE WARNING:\nAre you sure you want to restore database from snapshot "${filename}" (${logCount} attendance logs)?\n\nA safety pre-restore backup will be created automatically before restoring.`)) return;

  showToast(`Restoring database to point ${filename}...`, 'info');

  try {
    const res = await fetch(`${API_BASE}/admin/backups/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message, 'success');
      closeModal('backup-manager-modal');
      await fetchAttendanceForDate();
    } else {
      showToast(data.error || 'Failed to restore backup', 'error');
    }
  } catch (err) {
    showToast('Network error restoring backup', 'error');
  }
}

