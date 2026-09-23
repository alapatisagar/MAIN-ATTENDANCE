/* =========================================================
   PULSEATTEND - DBS EMPLOYEE ATTENDANCE SYSTEM
   FRONTEND CONTROLLER & ROLE-BASED ACCESS (RBAC)
   ========================================================= */

const API_BASE = '/api';

// Global Application State
let state = {
  currentUser: null, // { id, name, department, role, roleType, avatarColor }
  employees: [],
  todayRoster: [],
  filteredRoster: [],
  attendanceLogs: [],
  filteredLogs: [],
  leaves: [],
  stats: {},
  activeStatusFilter: '',
  selectedKioskEmployeeId: null
};

document.addEventListener('DOMContentLoaded', () => {
  initLiveClock();
  initNavigationTabs();

  // Check saved session in localStorage
  const savedUser = localStorage.getItem('pulseattend_user');
  if (savedUser) {
    try {
      state.currentUser = JSON.parse(savedUser);
    } catch (e) {
      state.currentUser = null;
    }
  }

  // Pre-fetch employees to populate login dropdown on Welcome page
  fetchEmployees().then(() => {
    updateScreenView();
  });

  // Default dates for leave form
  const todayStr = new Date().toISOString().split('T')[0];
  const startDateInput = document.getElementById('leaveStartDate');
  const endDateInput = document.getElementById('leaveEndDate');
  if (startDateInput) startDateInput.value = todayStr;
  if (endDateInput) endDateInput.value = todayStr;
});

/* ---------------------------------------------------------
   1. Screen View Controller (Welcome vs App Portal)
   --------------------------------------------------------- */
function updateScreenView() {
  const welcomeScreen = document.getElementById('welcomeLoginScreen');
  const appScreen = document.getElementById('mainAppScreen');

  if (state.currentUser) {
    // User is logged in -> Show App Portal
    if (welcomeScreen) welcomeScreen.style.display = 'none';
    if (appScreen) appScreen.style.display = 'flex';

    updateSessionUI();
    fetchAllData();
  } else {
    // User is NOT logged in -> Show Welcome / Login Screen ONLY
    if (welcomeScreen) welcomeScreen.style.display = 'flex';
    if (appScreen) appScreen.style.display = 'none';
  }
}

function updateSessionUI() {
  const sessionBox = document.getElementById('userSessionBox');
  const btnAddEmpHeader = document.getElementById('btnAddEmpHeader');
  const adminTabs = document.querySelectorAll('.admin-only-tab');
  const adminNotes = document.querySelectorAll('.admin-note');

  const user = state.currentUser;
  if (!user) return;

  if (sessionBox) sessionBox.style.display = 'flex';
  document.getElementById('headerUserName').textContent = user.name;
  
  const initials = getInitials(user.name);
  const avatarEl = document.getElementById('headerUserAvatar');
  if (avatarEl) {
    avatarEl.textContent = initials;
    avatarEl.style.backgroundColor = user.avatarColor || '#F59E0B';
  }

  const badge = document.getElementById('headerUserRoleBadge');
  if (badge) {
    badge.textContent = user.roleType || 'Employee';
    if (user.roleType === 'Admin') badge.className = 'badge badge-yellow';
    else if (user.roleType === 'Manager' || user.roleType === 'Team Lead') badge.className = 'badge badge-green';
    else badge.className = 'badge badge-gray';
  }

  const isElevated = (user.roleType === 'Admin' || user.roleType === 'Manager' || user.roleType === 'Team Lead');

  adminTabs.forEach(tab => {
    tab.style.display = isElevated ? 'inline-flex' : 'none';
  });

  adminNotes.forEach(note => {
    note.style.display = user.roleType === 'Admin' ? 'inline' : 'none';
  });

  if (btnAddEmpHeader) {
    btnAddEmpHeader.style.display = user.roleType === 'Admin' ? 'inline-flex' : 'none';
  }
}

/* ---------------------------------------------------------
   2. Live Clock & Date
   --------------------------------------------------------- */
function initLiveClock() {
  const updateClock = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const liveTimeEl = document.getElementById('liveTime');
    const liveDateEl = document.getElementById('liveDate');
    const kioskTimeEl = document.getElementById('kioskTime');
    const kioskDateEl = document.getElementById('kioskDate');

    if (liveTimeEl) liveTimeEl.textContent = timeStr;
    if (liveDateEl) liveDateEl.textContent = dateStr;
    if (kioskTimeEl) kioskTimeEl.textContent = timeStr;
    if (kioskDateEl) kioskDateEl.textContent = dateStr;
  };

  updateClock();
  setInterval(updateClock, 1000);
}

/* ---------------------------------------------------------
   3. Navigation & Tabs
   --------------------------------------------------------- */
function initNavigationTabs() {
  const desktopTabs = document.querySelectorAll('.nav-tab');
  const mobileTabs = document.querySelectorAll('.mobile-nav-btn');

  const switchTab = (tabId) => {
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    desktopTabs.forEach(b => b.classList.remove('active'));
    mobileTabs.forEach(b => b.classList.remove('active'));

    const targetPane = document.getElementById(tabId);
    if (targetPane) targetPane.classList.add('active');

    desktopTabs.forEach(b => {
      if (b.getAttribute('data-tab') === tabId) b.classList.add('active');
    });
    mobileTabs.forEach(b => {
      if (b.getAttribute('data-tab') === tabId) b.classList.add('active');
    });
  };

  desktopTabs.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });

  mobileTabs.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });
}

/* ---------------------------------------------------------
   4. REST API Fetchers
   --------------------------------------------------------- */
async function fetchAllData() {
  await Promise.all([
    fetchEmployees(),
    fetchTodayRosterSummary(),
    fetchStats(),
    fetchAttendanceLogs(),
    fetchLeaves()
  ]);
  fetchTodayActivity();
}

async function fetchEmployees() {
  try {
    const res = await fetch(`${API_BASE}/employees`);
    state.employees = await res.json();
    populateDropdowns();
    renderStaffGrid();
  } catch (err) {
    console.error('Error fetching employees:', err);
  }
}

async function fetchTodayRosterSummary() {
  try {
    const res = await fetch(`${API_BASE}/attendance/today-summary`);
    state.todayRoster = await res.json();
    state.filteredRoster = [...state.todayRoster];
    renderRosterGrid();
    updateRosterCounters();
  } catch (err) {
    console.error('Error fetching roster summary:', err);
  }
}

async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/stats/today`);
    state.stats = await res.json();
    renderStats();
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
}

async function fetchAttendanceLogs() {
  try {
    const res = await fetch(`${API_BASE}/attendance`);
    state.attendanceLogs = await res.json();
    state.filteredLogs = [...state.attendanceLogs];
    renderAttendanceTable();
  } catch (err) {
    console.error('Error fetching logs:', err);
  }
}

async function fetchLeaves() {
  try {
    const res = await fetch(`${API_BASE}/leaves`);
    state.leaves = await res.json();
    renderLeavesList();
  } catch (err) {
    console.error('Error fetching leaves:', err);
  }
}

async function fetchTodayActivity() {
  const activityContainer = document.getElementById('activityFeedList');
  if (!activityContainer) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = state.attendanceLogs.filter(a => a.date === todayStr);

  if (todayLogs.length === 0) {
    activityContainer.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">No clock-in activity recorded today yet.</div>`;
    return;
  }

  let html = '';
  todayLogs.forEach(log => {
    const timeIn = log.clockIn ? new Date(log.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const isLate = log.status === 'Late';
    const isHalfDay = log.status === 'Half Day';
    const isOut = log.status === 'Clocked Out';

    let itemClass = 'feed-item';
    if (isLate) itemClass += ' feed-late';
    if (isOut) itemClass += ' feed-out';

    let badgeHtml = isLate 
      ? '<span class="badge badge-red">Late</span>' 
      : (isHalfDay ? '<span class="badge badge-purple">Half Day</span>' : (isOut ? '<span class="badge badge-gray">Clocked Out</span>' : '<span class="badge badge-green">Present</span>'));

    html += `
      <div class="${itemClass}">
        <div class="feed-user">
          <h5>${escapeHTML(log.employeeName)} (${escapeHTML(log.employeeId)}) ${badgeHtml}</h5>
          <p>${escapeHTML(log.department)} • ${escapeHTML(log.location)}</p>
        </div>
        <div class="feed-time">
          <div class="feed-time-text">${timeIn}</div>
          <span style="font-size:0.75rem; color:var(--text-muted);">${log.notes ? escapeHTML(log.notes) : ''}</span>
        </div>
      </div>
    `;
  });

  activityContainer.innerHTML = html;
}

/* ---------------------------------------------------------
   5. Render UI Views & Admin Controls
   --------------------------------------------------------- */
function renderStats() {
  const { totalEmployees, present, late, halfDay, onLeave, attendanceRate } = state.stats;

  if (document.getElementById('statTotalEmployees')) document.getElementById('statTotalEmployees').textContent = totalEmployees || 55;
  if (document.getElementById('statPresentToday')) document.getElementById('statPresentToday').textContent = present || 0;
  if (document.getElementById('statLateToday')) document.getElementById('statLateToday').textContent = late || 0;
  if (document.getElementById('statOnLeave')) document.getElementById('statOnLeave').textContent = onLeave || 0;

  const rateStr = (attendanceRate || 0) + '%';
  if (document.getElementById('statAttendanceRate')) document.getElementById('statAttendanceRate').textContent = rateStr;
  if (document.getElementById('statProgressBar')) document.getElementById('statProgressBar').style.width = rateStr;
}

function renderRosterGrid() {
  const container = document.getElementById('todayRosterGrid');
  if (!container) return;

  if (state.filteredRoster.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">No employees found matching filter.</div>`;
    return;
  }

  const isAdmin = state.currentUser && state.currentUser.roleType === 'Admin';

  let html = '';
  state.filteredRoster.forEach(emp => {
    const initials = getInitials(emp.name);
    let badgeClass = 'badge-gray';
    let icon = 'fa-circle-xmark';

    if (emp.status === 'Present') { badgeClass = 'badge-green'; icon = 'fa-circle-check'; }
    else if (emp.status === 'Late') { badgeClass = 'badge-red'; icon = 'fa-triangle-exclamation'; }
    else if (emp.status === 'Half Day') { badgeClass = 'badge-purple'; icon = 'fa-adjust'; }
    else if (emp.status === 'On Leave') { badgeClass = 'badge-orange'; icon = 'fa-plane-departure'; }
    else if (emp.status === 'Clocked Out') { badgeClass = 'badge-yellow'; icon = 'fa-circle-check'; }

    html += `
      <div class="roster-card">
        <div class="roster-card-top">
          <div class="roster-avatar" style="background-color: ${emp.avatarColor || '#F59E0B'};">${initials}</div>
          <div class="roster-info">
            <h4>${escapeHTML(emp.name)}</h4>
            <div class="roster-id">${escapeHTML(emp.id)} • ${escapeHTML(emp.department)}</div>
          </div>
        </div>

        <div class="roster-card-bottom">
          <div>
            <span class="badge ${badgeClass}"><i class="fa-solid ${icon}"></i> ${emp.status}</span>
            ${emp.timeInfo ? `<span style="font-size:0.75rem; color:var(--text-muted); margin-left:4px;">${emp.timeInfo}</span>` : ''}
          </div>

          <!-- ADMIN ONLY STATUS MARKER -->
          ${isAdmin ? `
            <div>
              <select class="admin-status-picker" onchange="handleAdminMarkStatus('${emp.id}', this.value)">
                <option value="">Mark Status...</option>
                <option value="Present" ${emp.status === 'Present' ? 'selected' : ''}>Present</option>
                <option value="Absent" ${emp.status === 'Absent' ? 'selected' : ''}>Absent</option>
                <option value="Half Day" ${emp.status === 'Half Day' ? 'selected' : ''}>Half Day</option>
                <option value="On Leave" ${emp.status === 'On Leave' ? 'selected' : ''}>On Leave</option>
              </select>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function updateRosterCounters() {
  const present = state.todayRoster.filter(r => r.status === 'Present' || r.status === 'Clocked Out').length;
  const late = state.todayRoster.filter(r => r.status === 'Late').length;
  const halfDay = state.todayRoster.filter(r => r.status === 'Half Day').length;
  const leave = state.todayRoster.filter(r => r.status === 'On Leave').length;
  const absent = state.todayRoster.filter(r => r.status === 'Absent').length;

  if (document.getElementById('countPresent')) document.getElementById('countPresent').textContent = present;
  if (document.getElementById('countLate')) document.getElementById('countLate').textContent = late;
  if (document.getElementById('countHalfDay')) document.getElementById('countHalfDay').textContent = halfDay;
  if (document.getElementById('countLeave')) document.getElementById('countLeave').textContent = leave;
  if (document.getElementById('countAbsent')) document.getElementById('countAbsent').textContent = absent;
}

function filterRosterStatus() {
  const search = document.getElementById('searchRosterInput').value.toLowerCase();

  state.filteredRoster = state.todayRoster.filter(emp => {
    const matchSearch = !search || 
      emp.name.toLowerCase().includes(search) || 
      emp.id.toLowerCase().includes(search) || 
      emp.department.toLowerCase().includes(search);
    
    const matchTag = !state.activeStatusFilter || emp.status.toLowerCase() === state.activeStatusFilter.toLowerCase();

    return matchSearch && matchTag;
  });

  renderRosterGrid();
}

function filterRosterByTag(tag) {
  state.activeStatusFilter = tag;
  filterRosterStatus();
}

function populateDropdowns() {
  const kioskSelect = document.getElementById('kioskEmployeeSelect');
  const leaveSelect = document.getElementById('leaveEmployeeSelect');
  const welcomeSelect = document.getElementById('welcomeUserSelect');

  let options = '<option value="">-- Select Employee Name / DBS ID --</option>';
  state.employees.forEach(emp => {
    options += `<option value="${emp.id}">${escapeHTML(emp.name)} (${emp.id} - ${emp.department})</option>`;
  });

  if (welcomeSelect) welcomeSelect.innerHTML = options;
  if (leaveSelect) leaveSelect.innerHTML = options;

  if (kioskSelect) {
    kioskSelect.innerHTML = options;
    if (state.currentUser) {
      kioskSelect.value = state.currentUser.id;
      syncKioskEmployee();
    }
  }
}

function syncKioskEmployee() {
  const select = document.getElementById('kioskEmployeeSelect');
  const empId = select.value;
  state.selectedKioskEmployeeId = empId;

  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;

  const initials = getInitials(emp.name);
  const avatarEl = document.getElementById('kioskAvatar');
  if (avatarEl) {
    avatarEl.textContent = initials;
    avatarEl.style.backgroundColor = emp.avatarColor || '#F59E0B';
  }

  if (document.getElementById('kioskEmpName')) document.getElementById('kioskEmpName').textContent = emp.name;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayLog = state.attendanceLogs.find(a => a.employeeId === empId && a.date === todayStr);

  const statusPill = document.getElementById('kioskStatusPill');
  if (statusPill) {
    if (!todayLog) {
      statusPill.className = 'badge badge-gray';
      statusPill.textContent = 'Not Clocked In Today';
    } else if (!todayLog.clockOut) {
      statusPill.className = todayLog.status === 'Late' ? 'badge badge-red' : (todayLog.status === 'Half Day' ? 'badge badge-purple' : 'badge badge-green');
      statusPill.textContent = `Active (${todayLog.status})`;
    } else {
      statusPill.className = 'badge badge-yellow';
      statusPill.textContent = 'Clocked Out';
    }
  }
}

function renderAttendanceTable() {
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody) return;

  if (state.filteredLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px; color:var(--text-muted);">No attendance logs found.</td></tr>`;
    return;
  }

  let html = '';
  state.filteredLogs.forEach(log => {
    const clockInFormatted = log.clockIn ? new Date(log.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
    const clockOutFormatted = log.clockOut ? new Date(log.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (log.status === 'Clocked Out' ? 'Done' : '<span style="color:var(--yellow-primary); font-weight:600;">Active</span>');

    let badgeClass = 'badge-green';
    if (log.status === 'Late') badgeClass = 'badge-red';
    if (log.status === 'Half Day') badgeClass = 'badge-purple';
    if (log.status === 'Clocked Out') badgeClass = 'badge-yellow';
    if (log.status === 'Absent') badgeClass = 'badge-gray';

    html += `
      <tr>
        <td>
          <strong style="color:var(--text-main);">${escapeHTML(log.employeeName)}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHTML(log.employeeId)}</div>
        </td>
        <td>${escapeHTML(log.department)}</td>
        <td>${log.date}</td>
        <td><i class="fa-regular fa-clock text-yellow"></i> ${clockInFormatted}</td>
        <td><i class="fa-regular fa-clock text-red"></i> ${clockOutFormatted}</td>
        <td><span class="badge ${badgeClass}">${log.status}</span></td>
        <td><i class="fa-solid fa-location-dot"></i> ${escapeHTML(log.location)}</td>
        <td style="max-width:200px; white-space:normal; font-size:0.8rem; color:var(--text-muted);">${escapeHTML(log.notes || '-')}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function renderStaffGrid() {
  const grid = document.getElementById('staffGrid');
  if (!grid) return;

  const isAdmin = state.currentUser && state.currentUser.roleType === 'Admin';

  let html = '';
  state.employees.forEach(emp => {
    const initials = getInitials(emp.name);
    const bg = emp.avatarColor || '#F59E0B';
    const roleType = emp.roleType || (emp.id === 'DBS-540' ? 'Admin' : 'Employee');

    html += `
      <div class="staff-card">
        <div class="staff-avatar" style="background-color: ${bg};">${initials}</div>
        <div class="staff-info">
          <h4>${escapeHTML(emp.name)} ${roleType === 'Admin' ? '👑' : ''}</h4>
          <div class="staff-role">${escapeHTML(emp.id)} • ${escapeHTML(emp.department)}</div>
          <div class="staff-meta"><i class="fa-solid fa-envelope"></i> ${escapeHTML(emp.email)}</div>
          
          ${isAdmin ? `
            <div class="role-assign-box">
              <label style="font-size:0.75rem; color:var(--text-muted);">Access Role:</label>
              <select class="role-assign-select" onchange="handleGrantRole('${emp.id}', this.value)">
                <option value="Employee" ${roleType === 'Employee' ? 'selected' : ''}>Employee</option>
                <option value="Team Lead" ${roleType === 'Team Lead' ? 'selected' : ''}>Team Lead (TL)</option>
                <option value="Manager" ${roleType === 'Manager' ? 'selected' : ''}>Manager</option>
                <option value="Admin" ${roleType === 'Admin' ? 'selected' : ''}>Admin (Full Control)</option>
              </select>
            </div>
          ` : `
            <div style="margin-top:4px;"><span class="badge ${roleType === 'Admin' ? 'badge-yellow' : 'badge-gray'}">${roleType}</span></div>
          `}
        </div>

        ${isAdmin && emp.id !== 'DBS-540' ? `
          <div class="staff-actions">
            <button class="btn-icon-danger" onclick="handleDeleteEmployee('${emp.id}')" title="Delete Member">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  });

  grid.innerHTML = html;
}

function renderLeavesList() {
  const container = document.getElementById('leaveApplicationsList');
  const countBadge = document.getElementById('pendingLeaveCount');
  if (!container) return;

  const pendingLeaves = state.leaves.filter(l => l.status === 'Pending');
  if (countBadge) countBadge.textContent = `${pendingLeaves.length} Pending`;

  if (state.leaves.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">No leave applications submitted.</div>`;
    return;
  }

  const canApprove = state.currentUser && (state.currentUser.roleType === 'Admin' || state.currentUser.roleType === 'Manager' || state.currentUser.roleType === 'Team Lead');

  let html = '';
  state.leaves.forEach(leave => {
    let borderClass = 'border-left: 4px solid #F97316;';
    let badgeHtml = '<span class="badge badge-orange">Pending</span>';

    if (leave.status === 'Approved') {
      borderClass = 'border-left: 4px solid #10B981;';
      badgeHtml = '<span class="badge badge-green">Approved</span>';
    } else if (leave.status === 'Rejected') {
      borderClass = 'border-left: 4px solid var(--red-primary);';
      badgeHtml = '<span class="badge badge-red">Rejected</span>';
    }

    html += `
      <div class="leave-card" style="${borderClass}">
        <div class="leave-card-header">
          <h5>${escapeHTML(leave.employeeName)} (${escapeHTML(leave.department)})</h5>
          ${badgeHtml}
        </div>
        <div class="leave-card-body">
          <div><strong>Type:</strong> ${escapeHTML(leave.type)} (${leave.days} day${leave.days > 1 ? 's' : ''})</div>
          <div><strong>Dates:</strong> ${leave.startDate} &rarr; ${leave.endDate}</div>
          <div style="margin-top:4px; font-style:italic;">"${escapeHTML(leave.reason)}"</div>
        </div>
        ${(canApprove && leave.status === 'Pending') ? `
          <div class="leave-admin-actions">
            <button class="btn-approve" onclick="handleUpdateLeave('${leave.id}', 'Approved')">
              <i class="fa-solid fa-check"></i> Approve
            </button>
            <button class="btn-reject" onclick="handleUpdateLeave('${leave.id}', 'Rejected')">
              <i class="fa-solid fa-xmark"></i> Reject
            </button>
          </div>
        ` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
}

/* ---------------------------------------------------------
   6. ADMIN MARK ATTENDANCE STATUS HANDLER (Present, Absent, Half Day, On Leave)
   --------------------------------------------------------- */
async function handleAdminMarkStatus(empId, newStatus) {
  if (!newStatus) return;
  if (!state.currentUser || state.currentUser.roleType !== 'Admin') {
    showToast('Admin privilege required to mark employee attendance', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/attendance/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: empId, status: newStatus })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to mark status', 'error');
      return;
    }

    showToast(data.message, 'success');
    await fetchTodayRosterSummary();
    await fetchStats();
  } catch (err) {
    showToast('Error marking attendance status', 'error');
  }
}

/* ---------------------------------------------------------
   7. Login & Authentication Handlers
   --------------------------------------------------------- */
async function handleWelcomeLogin(e) {
  e.preventDefault();

  const usernameOrId = document.getElementById('welcomeUserSelect').value;
  const password = document.getElementById('welcomePassword').value;

  if (!usernameOrId) {
    showToast('Please select an employee name', 'error');
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
      showToast(data.error || 'Authentication failed', 'error');
      return;
    }

    state.currentUser = data.user;
    localStorage.setItem('pulseattend_user', JSON.stringify(data.user));

    showToast(`Welcome ${data.user.name}! Logged in as ${data.user.roleType}`, 'success');
    updateScreenView();
  } catch (err) {
    showToast('Network error during login', 'error');
  }
}

function quickFillWelcome(empId, pass) {
  const select = document.getElementById('welcomeUserSelect');
  const passInput = document.getElementById('welcomePassword');
  if (select) select.value = empId;
  if (passInput) passInput.value = pass;
}

function handleLogout() {
  state.currentUser = null;
  localStorage.removeItem('pulseattend_user');
  updateScreenView();
  showToast('Logged out successfully', 'success');
}

async function handleGrantRole(empId, newRoleType) {
  if (!state.currentUser || state.currentUser.roleType !== 'Admin') {
    showToast('Only Admin (Sagar Alapati) can change access roles', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/employees/${empId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleType: newRoleType })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Role update failed', 'error');
      return;
    }

    showToast(`Granted ${newRoleType} access to ${data.employee.name}`, 'success');
    await fetchEmployees();
  } catch (err) {
    showToast('Error updating role', 'error');
  }
}

/* ---------------------------------------------------------
   8. Clock In / Out & Forms Handlers
   --------------------------------------------------------- */
async function handleKioskClockIn() {
  const empId = document.getElementById('kioskEmployeeSelect').value;
  const location = document.getElementById('kioskLocation').value;
  const notes = document.getElementById('kioskNotes').value;

  if (!empId) {
    showToast('Select an employee name', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/attendance/clock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: empId, location, notes })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Clock-in failed', 'error');
      return;
    }

    showToast(`Clocked in as ${data.status}`, 'success');
    document.getElementById('kioskNotes').value = '';
    await fetchAllData();
    syncKioskEmployee();
  } catch (err) {
    showToast('Clock-in error', 'error');
  }
}

async function handleKioskClockOut() {
  const empId = document.getElementById('kioskEmployeeSelect').value;

  if (!empId) {
    showToast('Select an employee name', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/attendance/clock-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: empId })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Clock-out failed', 'error');
      return;
    }

    showToast(`Clocked out! Shift completed (${data.workHours || 0} hrs)`, 'success');
    await fetchAllData();
    syncKioskEmployee();
  } catch (err) {
    showToast('Clock-out error', 'error');
  }
}

async function handleAddEmployee(e) {
  e.preventDefault();

  const name = document.getElementById('newEmpName').value;
  const department = document.getElementById('newEmpDept').value;
  const roleType = document.getElementById('newEmpRoleType').value;
  const email = document.getElementById('newEmpEmail').value;
  const shift = document.getElementById('newEmpShift').value;

  try {
    const res = await fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, department, roleType, email, shift })
    });

    if (!res.ok) {
      showToast('Failed to add employee', 'error');
      return;
    }

    showToast(`Registered ${name} as ${roleType}!`, 'success');
    closeModal('add-employee-modal');
    document.getElementById('addEmployeeForm').reset();
    await fetchAllData();
  } catch (err) {
    showToast('Error registering employee', 'error');
  }
}

async function handleDeleteEmployee(empId) {
  if (!confirm(`Are you sure you want to delete member ${empId}?`)) return;

  try {
    const res = await fetch(`${API_BASE}/employees/${empId}`, { method: 'DELETE' });
    if (!res.ok) {
      showToast('Delete failed', 'error');
      return;
    }
    showToast('Employee removed', 'success');
    await fetchAllData();
  } catch (err) {
    showToast('Error deleting employee', 'error');
  }
}

async function handleLeaveSubmit(e) {
  e.preventDefault();

  const employeeId = document.getElementById('leaveEmployeeSelect').value;
  const type = document.getElementById('leaveType').value;
  const startDate = document.getElementById('leaveStartDate').value;
  const endDate = document.getElementById('leaveEndDate').value;
  const reason = document.getElementById('leaveReason').value;

  try {
    const res = await fetch(`${API_BASE}/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, type, startDate, endDate, reason })
    });

    if (!res.ok) {
      showToast('Error submitting leave application', 'error');
      return;
    }

    showToast('Leave application submitted for approval', 'success');
    document.getElementById('leaveRequestForm').reset();
    await fetchLeaves();
    await fetchTodayRosterSummary();
  } catch (err) {
    showToast('Network error submitting leave', 'error');
  }
}

async function handleUpdateLeave(leaveId, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/leaves/${leaveId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (!res.ok) {
      showToast('Failed to update leave status', 'error');
      return;
    }

    showToast(`Leave status updated to ${newStatus}`, 'success');
    await fetchLeaves();
    await fetchTodayRosterSummary();
    await fetchStats();
  } catch (err) {
    showToast('Error updating leave', 'error');
  }
}

/* ---------------------------------------------------------
   9. Logs Filtering & CSV Export
   --------------------------------------------------------- */
function applyLogFilters() {
  const search = document.getElementById('searchLogInput').value.toLowerCase();
  const date = document.getElementById('filterDate').value;
  const dept = document.getElementById('filterDepartment').value;
  const status = document.getElementById('filterStatus').value;

  state.filteredLogs = state.attendanceLogs.filter(log => {
    const matchSearch = !search || 
      log.employeeName.toLowerCase().includes(search) || 
      log.employeeId.toLowerCase().includes(search) || 
      (log.notes && log.notes.toLowerCase().includes(search));
    
    const matchDate = !date || log.date === date;
    const matchDept = !dept || log.department.toLowerCase() === dept.toLowerCase();
    const matchStatus = !status || log.status.toLowerCase() === status.toLowerCase();

    return matchSearch && matchDate && matchDept && matchStatus;
  });

  renderAttendanceTable();
}

function resetLogFilters() {
  document.getElementById('searchLogInput').value = '';
  document.getElementById('filterDate').value = '';
  document.getElementById('filterDepartment').value = '';
  document.getElementById('filterStatus').value = '';

  state.filteredLogs = [...state.attendanceLogs];
  renderAttendanceTable();
}

function downloadCSVReport() {
  window.location.href = `${API_BASE}/export/csv`;
}

/* ---------------------------------------------------------
   10. Modal & Utility Helpers
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
  if (!name) return 'DBS';
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
  }, 3500);
}
