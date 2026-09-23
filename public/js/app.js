/* =========================================================
   PULSEATTEND - ONLINE EMPLOYEE ATTENDANCE SYSTEM
   FRONTEND CLIENT LOGIC & REST API CONTROLLER
   ========================================================= */

const API_BASE = '/api';

// Global Application State
let state = {
  employees: [],
  attendanceLogs: [],
  filteredLogs: [],
  leaves: [],
  stats: {},
  currentRole: 'admin', // 'employee' or 'admin'
  selectedTerminalEmployeeId: null,
  selectedKioskEmployeeId: null
};

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initLiveClock();
  initNavigationTabs();
  fetchAllData();
  
  // Set default dates in leave form
  const todayStr = new Date().toISOString().split('T')[0];
  const startDateInput = document.getElementById('leaveStartDate');
  const endDateInput = document.getElementById('leaveEndDate');
  if (startDateInput) startDateInput.value = todayStr;
  if (endDateInput) endDateInput.value = todayStr;
});

/* ---------------------------------------------------------
   1. Live Clock & Date
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
   2. Navigation & Tabs
   --------------------------------------------------------- */
function initNavigationTabs() {
  const desktopTabs = document.querySelectorAll('.nav-tab');
  const mobileTabs = document.querySelectorAll('.mobile-nav-btn');

  const switchTab = (tabId) => {
    // Hide all panes
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    // Deactivate all buttons
    desktopTabs.forEach(b => b.classList.remove('active'));
    mobileTabs.forEach(b => b.classList.remove('active'));

    // Activate target pane
    const targetPane = document.getElementById(tabId);
    if (targetPane) targetPane.classList.add('active');

    // Activate corresponding buttons
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
   3. REST API Fetchers
   --------------------------------------------------------- */
async function fetchAllData() {
  await Promise.all([
    fetchEmployees(),
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
    populateEmployeeDropdowns();
    renderStaffGrid();
  } catch (err) {
    showToast('Failed to load employees', 'error');
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
    activityContainer.innerHTML = `<div class="feed-empty" style="text-align:center; padding:20px; color:var(--text-muted);">No clock-in activity recorded today yet.</div>`;
    return;
  }

  let html = '';
  todayLogs.forEach(log => {
    const timeIn = new Date(log.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isLate = log.status === 'Late';
    const isOut = log.status === 'Clocked Out';

    let itemClass = 'feed-item';
    if (isLate) itemClass += ' feed-late';
    if (isOut) itemClass += ' feed-out';

    let badgeHtml = isLate 
      ? '<span class="badge badge-red">Late</span>' 
      : (isOut ? '<span class="badge badge-gray">Clocked Out</span>' : '<span class="badge badge-green">Present</span>');

    html += `
      <div class="${itemClass}">
        <div class="feed-user">
          <h5>${escapeHTML(log.employeeName)} ${badgeHtml}</h5>
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
   4. Render UI Components
   --------------------------------------------------------- */
function renderStats() {
  const { totalEmployees, present, late, onLeave, attendanceRate } = state.stats;

  document.getElementById('statTotalEmployees').textContent = totalEmployees || 0;
  document.getElementById('statPresentToday').textContent = present || 0;
  document.getElementById('statLateToday').textContent = late || 0;
  document.getElementById('statOnLeave').textContent = onLeave || 0;

  const rateStr = (attendanceRate || 0) + '%';
  document.getElementById('statAttendanceRate').textContent = rateStr;
  document.getElementById('statProgressBar').style.width = rateStr;
}

function populateEmployeeDropdowns() {
  const termSelect = document.getElementById('terminalEmployeeSelect');
  const kioskSelect = document.getElementById('kioskEmployeeSelect');
  const leaveSelect = document.getElementById('leaveEmployeeSelect');

  let options = '<option value="">-- Choose Employee Name --</option>';
  state.employees.forEach(emp => {
    options += `<option value="${emp.id}">${escapeHTML(emp.name)} (${emp.id} - ${emp.department})</option>`;
  });

  if (termSelect) {
    termSelect.innerHTML = options;
    if (state.employees.length > 0 && !state.selectedTerminalEmployeeId) {
      termSelect.value = state.employees[0].id;
      updateTerminalEmployeeDetails();
    }
  }

  if (kioskSelect) {
    kioskSelect.innerHTML = options;
    if (state.employees.length > 0 && !state.selectedKioskEmployeeId) {
      kioskSelect.value = state.employees[0].id;
      syncKioskEmployee();
    }
  }

  if (leaveSelect) {
    leaveSelect.innerHTML = options;
  }
}

function updateTerminalEmployeeDetails() {
  const select = document.getElementById('terminalEmployeeSelect');
  const empId = select.value;
  state.selectedTerminalEmployeeId = empId;

  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;

  const initials = getInitials(emp.name);
  const avatarEl = document.getElementById('terminalEmpAvatar');
  avatarEl.textContent = initials;
  avatarEl.style.backgroundColor = emp.avatarColor || '#F59E0B';

  document.getElementById('terminalEmpName').textContent = emp.name;
  document.getElementById('terminalEmpDeptRole').textContent = `${emp.department} • ${emp.role}`;

  // Check clock status for today
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLog = state.attendanceLogs.find(a => a.employeeId === empId && a.date === todayStr);

  const statusBadge = document.getElementById('terminalEmpStatusBadge');
  if (!todayLog) {
    statusBadge.innerHTML = `<span class="badge badge-gray">Not Clocked In</span>`;
  } else if (!todayLog.clockOut) {
    const isLate = todayLog.status === 'Late';
    statusBadge.innerHTML = isLate 
      ? `<span class="badge badge-red"><i class="fa-solid fa-triangle-exclamation"></i> Clocked In (Late: ${new Date(todayLog.clockIn).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})})</span>`
      : `<span class="badge badge-green"><i class="fa-solid fa-check"></i> Clocked In (${new Date(todayLog.clockIn).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})})</span>`;
  } else {
    statusBadge.innerHTML = `<span class="badge badge-yellow"><i class="fa-solid fa-circle-check"></i> Clocked Out (${new Date(todayLog.clockOut).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})})</span>`;
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
  avatarEl.textContent = initials;
  avatarEl.style.backgroundColor = emp.avatarColor || '#F59E0B';

  document.getElementById('kioskEmpName').textContent = emp.name;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayLog = state.attendanceLogs.find(a => a.employeeId === empId && a.date === todayStr);

  const statusPill = document.getElementById('kioskStatusPill');
  if (!todayLog) {
    statusPill.className = 'badge badge-gray';
    statusPill.textContent = 'Not Clocked In Today';
  } else if (!todayLog.clockOut) {
    statusPill.className = todayLog.status === 'Late' ? 'badge badge-red' : 'badge badge-green';
    statusPill.textContent = `Active (${todayLog.status})`;
  } else {
    statusPill.className = 'badge badge-yellow';
    statusPill.textContent = 'Clocked Out';
  }
}

function renderAttendanceTable() {
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody) return;

  if (state.filteredLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px; color:var(--text-muted);">No attendance entries match the current filter.</td></tr>`;
    return;
  }

  let html = '';
  state.filteredLogs.forEach(log => {
    const clockInFormatted = log.clockIn ? new Date(log.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
    const clockOutFormatted = log.clockOut ? new Date(log.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (log.status === 'Clocked Out' ? 'Done' : '<span style="color:var(--yellow-primary); font-weight:600;">Active</span>');

    let badgeClass = 'badge-green';
    if (log.status === 'Late') badgeClass = 'badge-red';
    if (log.status === 'Clocked Out') badgeClass = 'badge-yellow';

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

  if (state.employees.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">No staff registered yet. Click "Register Employee" to add your first member.</div>`;
    return;
  }

  let html = '';
  state.employees.forEach(emp => {
    const initials = getInitials(emp.name);
    const bg = emp.avatarColor || '#F59E0B';

    html += `
      <div class="staff-card">
        <div class="staff-avatar" style="background-color: ${bg};">${initials}</div>
        <div class="staff-info">
          <h4>${escapeHTML(emp.name)}</h4>
          <div class="staff-role">${escapeHTML(emp.role)}</div>
          <div class="staff-meta"><i class="fa-solid fa-building"></i> ${escapeHTML(emp.department)}</div>
          <div class="staff-meta"><i class="fa-solid fa-envelope"></i> ${escapeHTML(emp.email)}</div>
          <div class="staff-meta"><i class="fa-solid fa-clock"></i> ${escapeHTML(emp.shift)}</div>
        </div>
        ${state.currentRole === 'admin' ? `
          <div class="staff-actions">
            <button class="btn-icon-danger" onclick="handleDeleteEmployee('${emp.id}')" title="Delete Employee">
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
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">No leave applications found.</div>`;
    return;
  }

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
        ${(state.currentRole === 'admin' && leave.status === 'Pending') ? `
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
   5. Action Handlers (Clock In / Out, Forms)
   --------------------------------------------------------- */
async function handleClockIn() {
  const empId = document.getElementById('terminalEmployeeSelect').value;
  const location = document.getElementById('clockinLocation').value;
  const notes = document.getElementById('clockinNotes').value;

  if (!empId) {
    showToast('Please select an employee name', 'error');
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

    showToast(`Clocked In successfully! Status: ${data.status}`, 'success');
    document.getElementById('clockinNotes').value = '';
    await fetchAllData();
    updateTerminalEmployeeDetails();
  } catch (err) {
    showToast('Network error during clock-in', 'error');
  }
}

async function handleClockOut() {
  const empId = document.getElementById('terminalEmployeeSelect').value;

  if (!empId) {
    showToast('Please select an employee name', 'error');
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

    showToast(`Clocked Out successfully! Total Hours: ${data.workHours || 0} hrs`, 'success');
    await fetchAllData();
    updateTerminalEmployeeDetails();
  } catch (err) {
    showToast('Network error during clock-out', 'error');
  }
}

// Standalone Kiosk Clock Handlers
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

    showToast(`Welcome! Clocked in as ${data.status}`, 'success');
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

    showToast(`Goodbye! Shift completed (${data.workHours || 0} hrs)`, 'success');
    await fetchAllData();
    syncKioskEmployee();
  } catch (err) {
    showToast('Clock-out error', 'error');
  }
}

// Add New Employee Form
async function handleAddEmployee(e) {
  e.preventDefault();

  const name = document.getElementById('newEmpName').value;
  const department = document.getElementById('newEmpDept').value;
  const role = document.getElementById('newEmpRole').value;
  const email = document.getElementById('newEmpEmail').value;
  const shift = document.getElementById('newEmpShift').value;

  try {
    const res = await fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, department, role, email, shift })
    });

    if (!res.ok) {
      showToast('Failed to add employee', 'error');
      return;
    }

    showToast(`Employee ${name} registered successfully!`, 'success');
    closeModal('add-employee-modal');
    document.getElementById('addEmployeeForm').reset();
    await fetchEmployees();
    await fetchStats();
  } catch (err) {
    showToast('Error registering employee', 'error');
  }
}

async function handleDeleteEmployee(empId) {
  if (!confirm(`Are you sure you want to delete employee ID ${empId}?`)) return;

  try {
    const res = await fetch(`${API_BASE}/employees/${empId}`, { method: 'DELETE' });
    if (!res.ok) {
      showToast('Delete failed', 'error');
      return;
    }
    showToast('Employee removed', 'success');
    await fetchEmployees();
    await fetchStats();
  } catch (err) {
    showToast('Error deleting employee', 'error');
  }
}

// Leave Handlers
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
    await fetchStats();
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
      showToast('Failed to update leave', 'error');
      return;
    }

    showToast(`Leave status updated to ${newStatus}`, 'success');
    await fetchLeaves();
    await fetchStats();
  } catch (err) {
    showToast('Error updating leave', 'error');
  }
}

/* ---------------------------------------------------------
   6. Filtering & Search Logic
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

/* ---------------------------------------------------------
   7. CSV Export
   --------------------------------------------------------- */
function downloadCSVReport() {
  window.location.href = `${API_BASE}/export/csv`;
}

/* ---------------------------------------------------------
   8. Role Switcher & Utilities
   --------------------------------------------------------- */
function toggleUserRole() {
  const role = document.getElementById('roleToggle').value;
  state.currentRole = role;

  renderStaffGrid();
  renderLeavesList();

  showToast(`Switched to ${role === 'admin' ? 'Admin / HR View' : 'Employee View'}`, 'success');
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function getInitials(name) {
  if (!name) return 'EMP';
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
