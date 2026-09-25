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
  autoPresentCountdown: 60,
  autoPresentIntervalId: null,
  timerTargetDate: null
};

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.substring(0, 7);

  const dateInput = document.getElementById('selectedDateInput');
  if (dateInput) dateInput.value = today;

  const monthInput = document.getElementById('exportMonthInput');
  if (monthInput) monthInput.value = currentMonth;

  // Clear session so page refresh ALWAYS forces login page
  state.currentUser = null;
  state.token = null;
  localStorage.removeItem('arcallers_user');
  localStorage.removeItem('arcallers_token');

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

  const savedActiveDate = sessionStorage.getItem('arcallers_active_date');
  if (savedActiveDate) {
    state.selectedDate = savedActiveDate;
    const dateInput = document.getElementById('selectedDateInput');
    if (dateInput) dateInput.value = savedActiveDate;
  }

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

  const dateObj = new Date(y, m, d + offsetDays);

  const resY = dateObj.getFullYear();
  const resM = String(dateObj.getMonth() + 1).padStart(2, '0');
  const resD = String(dateObj.getDate()).padStart(2, '0');
  const newDateStr = `${resY}-${resM}-${resD}`;

  state.selectedDate = newDateStr;
  sessionStorage.setItem('arcallers_active_date', newDateStr);

  if (dateInput) dateInput.value = newDateStr;

  fetchAttendanceForDate();
}

function jumpToDate(target) {
  const dateObj = new Date();
  if (target === 'yesterday') {
    dateObj.setDate(dateObj.getDate() - 1);
  }
  const resY = dateObj.getFullYear();
  const resM = String(dateObj.getMonth() + 1).padStart(2, '0');
  const resD = String(dateObj.getDate()).padStart(2, '0');
  const dateStr = `${resY}-${resM}-${resD}`;

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

  const dateObj = new Date(y, m, d);
  const usDateNum = `${parts[1]}/${parts[2]}/${parts[0]}`;
  const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const dayOfWeek = dateObj.getDay();
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
  state.isWeekend = isWeekend;

  const dateBadge = document.getElementById('currentDateBadge');
  if (dateBadge) {
    dateBadge.textContent = isWeekend ? `Date: ${usDateNum} (${formattedDate} - Weekend Off)` : `Date: ${usDateNum} (${formattedDate})`;
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
        <td>
          <span class="dept-badge"><i class="fa-solid fa-headset text-yellow"></i> AR Callers</span>
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

  state.records.forEach(r => {
    if (r.status === 'Present') present++;
    else if (r.status === 'Absent') absent++;
    else if (r.status === 'Half Day') halfDay++;
    else if (r.status === 'Holiday / Off' || r.status === 'On Leave') holidayOff++;
  });

  const markedWork = present + absent + halfDay;
  const rate = markedWork > 0 ? Math.round(((present + (halfDay * 0.5)) / markedWork) * 100) : 0;

  document.getElementById('statTotalEmp').textContent = total;
  document.getElementById('statPresent').textContent = present;
  document.getElementById('statAbsent').textContent = absent;
  document.getElementById('statHalfDay').textContent = halfDay;
  document.getElementById('statHolidayOff').textContent = holidayOff;
  const rateEl = document.getElementById('statRate');
  if (rateEl) rateEl.textContent = `${rate}%`;
}

async function handleMarkAttendance(employeeId, status) {
  const date = state.selectedDate;

  // Optimistic UI update
  const rec = state.records.find(r => r.employeeId === employeeId);
  if (rec) {
    rec.status = status;
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
  window.location.href = `${API_BASE}/admin/backup-download`;
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

    tbody.innerHTML = data.summary.map(item => `
      <tr>
        <td><strong>${escapeHTML(item.id)}</strong></td>
        <td>${escapeHTML(item.name)}</td>
        <td class="text-center text-green"><strong>${item.present}</strong></td>
        <td class="text-center text-red"><strong>${item.absent}</strong></td>
        <td class="text-center text-purple"><strong>${item.halfDay}</strong></td>
        <td class="text-center text-blue"><strong>${item.holidayOff}</strong></td>
        <td class="text-center text-yellow"><strong>${item.rate}</strong></td>
      </tr>
    `).join('');
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
   7. VOICE COMMAND RECOGNITION (WEB SPEECH API)
   --------------------------------------------------------- */
let speechRecognitionObj = null;
let isVoiceListening = false;

function toggleVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast('Voice recognition not supported in this browser. Please use Google Chrome or Microsoft Edge.', 'error');
    return;
  }

  const micBtn = document.getElementById('voiceMicBtn');

  if (isVoiceListening && speechRecognitionObj) {
    speechRecognitionObj.stop();
    return;
  }

  try {
    speechRecognitionObj = new SpeechRecognition();
    speechRecognitionObj.continuous = false;
    speechRecognitionObj.interimResults = false;
    speechRecognitionObj.lang = 'en-US';

    speechRecognitionObj.onstart = () => {
      isVoiceListening = true;
      if (micBtn) micBtn.classList.add('listening');
      showToast('🎤 Voice Active! Speak e.g., "Mark absent for Rajesh, Durga, and Siva"', 'success');
    };

    speechRecognitionObj.onend = () => {
      isVoiceListening = false;
      if (micBtn) micBtn.classList.remove('listening');
    };

    speechRecognitionObj.onerror = (event) => {
      isVoiceListening = false;
      if (micBtn) micBtn.classList.remove('listening');
      if (event.error !== 'no-speech') {
        showToast(`Voice microphone error: ${event.error}`, 'error');
      }
    };

    speechRecognitionObj.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      if (!transcript) return;

      const searchInput = document.getElementById('searchEmployeeInput');
      if (searchInput) searchInput.value = transcript;

      handleVoiceCommandProcess(transcript);
    };

    speechRecognitionObj.start();
  } catch (err) {
    showToast('Could not access microphone. Please grant permission.', 'error');
  }
}

function handleVoiceCommandProcess(transcript) {
  const rawText = transcript.toLowerCase();

  // 1. Detect target attendance status
  let targetStatus = null;
  if (rawText.includes('absent')) {
    targetStatus = 'Absent';
  } else if (rawText.includes('present')) {
    targetStatus = 'Present';
  } else if (rawText.includes('half day') || rawText.includes('halfday') || rawText.includes('half')) {
    targetStatus = 'Half Day';
  } else if (rawText.includes('off') || rawText.includes('holiday') || rawText.includes('leave')) {
    targetStatus = 'Holiday / Off';
  }

  // If no status command detected, fallback to search mode
  if (!targetStatus) {
    handleSearchInput();
    showToast(`🎤 Voice Search: Filtered for "${transcript}"`, 'success');
    return;
  }

  // 2. Strip status & command keywords to isolate employee names
  let namesSection = rawText
    .replace(/\bmark\b/g, '')
    .replace(/\bas\b/g, '')
    .replace(/\bfor\b/g, '')
    .replace(/\babsent\b/g, '')
    .replace(/\bpresent\b/g, '')
    .replace(/\bhalf day\b/g, '')
    .replace(/\bhalfday\b/g, '')
    .replace(/\bhalf\b/g, '')
    .replace(/\boff\b/g, '')
    .replace(/\bholiday\b/g, '')
    .replace(/\bleave\b/g, '')
    .replace(/\bemployee\b/g, '')
    .replace(/\bemployees\b/g, '')
    .replace(/\bcaller\b/g, '')
    .replace(/\bcallers\b/g, '')
    .trim();

  if (!namesSection) {
    showToast(`🎤 Detected "${targetStatus}", but please specify caller names (e.g. "Mark absent for Rajesh")`, 'error');
    return;
  }

  // 3. Split names by delimiters like commas, "and", "&"
  const rawNamesList = namesSection.split(/,| and | & |\+/).map(s => s.trim()).filter(Boolean);

  const markedNames = [];
  const unmatchedQueries = [];

  rawNamesList.forEach(query => {
    const matchedEmp = state.records.find(emp => {
      const empName = emp.name.toLowerCase();
      const empId = emp.employeeId.toLowerCase();

      if (empName.includes(query) || empId.includes(query)) return true;

      // Word token match (e.g. "Rajesh" matching "Rajesh Dhabbakuti")
      const queryTokens = query.split(' ');
      return queryTokens.some(token => token.length > 2 && (empName.includes(token) || empId.includes(token)));
    });

    if (matchedEmp) {
      handleMarkAttendance(matchedEmp.employeeId, targetStatus);
      markedNames.push(matchedEmp.name);
    } else {
      unmatchedQueries.push(query);
    }
  });

  if (markedNames.length > 0) {
    showToast(`🎤 Voice Success: Marked ${targetStatus} for ${markedNames.join(', ')}`, 'success');
  }

  if (unmatchedQueries.length > 0) {
    showToast(`🎤 Could not find callers for: "${unmatchedQueries.join(', ')}"`, 'error');
  }
}

