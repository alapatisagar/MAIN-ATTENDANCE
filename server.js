const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Seed default data if database doesn't exist
function getInitialData() {
  const todayStr = new Date().toISOString().split('T')[0];
  
  return {
    employees: [
      { id: 'EMP-101', name: 'Alex Morgan', department: 'Engineering', role: 'Senior Frontend Developer', email: 'alex.m@company.com', shift: '09:00 - 17:00', status: 'Active', avatarColor: '#EF4444' },
      { id: 'EMP-102', name: 'Sarah Jenkins', department: 'Design', role: 'UI/UX Designer', email: 'sarah.j@company.com', shift: '09:00 - 17:00', status: 'Active', avatarColor: '#F59E0B' },
      { id: 'EMP-103', name: 'David Chen', department: 'Engineering', role: 'Backend Engineer', email: 'david.c@company.com', shift: '09:00 - 17:00', status: 'Active', avatarColor: '#DC2626' },
      { id: 'EMP-104', name: 'Priya Sharma', department: 'HR', role: 'HR Specialist', email: 'priya.s@company.com', shift: '09:00 - 17:00', status: 'Active', avatarColor: '#D97706' },
      { id: 'EMP-105', name: 'Marcus Vance', department: 'Sales', role: 'Sales Account Executive', email: 'marcus.v@company.com', shift: '09:00 - 17:00', status: 'Active', avatarColor: '#B91C1C' },
      { id: 'EMP-106', name: 'Elena Rostova', department: 'Support', role: 'Customer Success Manager', email: 'elena.r@company.com', shift: '09:00 - 17:00', status: 'Active', avatarColor: '#F59E0B' }
    ],
    attendance: [
      {
        id: 'ATT-1001',
        employeeId: 'EMP-101',
        employeeName: 'Alex Morgan',
        department: 'Engineering',
        date: todayStr,
        clockIn: `${todayStr}T08:52:00`,
        clockOut: null,
        status: 'Present',
        location: 'HQ Office',
        notes: 'Arrived early for sprint planning'
      },
      {
        id: 'ATT-1002',
        employeeId: 'EMP-102',
        employeeName: 'Sarah Jenkins',
        department: 'Design',
        date: todayStr,
        clockIn: `${todayStr}T09:28:00`,
        clockOut: null,
        status: 'Late',
        location: 'HQ Office',
        notes: 'Traffic delay on highway'
      },
      {
        id: 'ATT-1003',
        employeeId: 'EMP-103',
        employeeName: 'David Chen',
        department: 'Engineering',
        date: todayStr,
        clockIn: `${todayStr}T09:02:00`,
        clockOut: null,
        status: 'Present',
        location: 'Remote (Home)',
        notes: 'Working remotely today'
      },
      {
        id: 'ATT-1004',
        employeeId: 'EMP-105',
        employeeName: 'Marcus Vance',
        department: 'Sales',
        date: todayStr,
        clockIn: `${todayStr}T08:58:00`,
        clockOut: `${todayStr}T17:05:00`,
        status: 'Clocked Out',
        location: 'Client Site',
        notes: 'Onsite sales demo'
      }
    ],
    leaves: [
      {
        id: 'LV-501',
        employeeId: 'EMP-104',
        employeeName: 'Priya Sharma',
        department: 'HR',
        type: 'Casual Leave',
        startDate: todayStr,
        endDate: todayStr,
        days: 1,
        reason: 'Personal family event',
        status: 'Approved'
      },
      {
        id: 'LV-502',
        employeeId: 'EMP-106',
        employeeName: 'Elena Rostova',
        department: 'Support',
        type: 'Sick Leave',
        startDate: todayStr,
        endDate: todayStr,
        days: 1,
        reason: 'Severe migraine',
        status: 'Pending'
      }
    ]
  };
}

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = getInitialData();
    saveDB(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading DB, re-initializing:', err);
    const initial = getInitialData();
    saveDB(initial);
    return initial;
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// REST API Endpoints

// Employees
app.get('/api/employees', (req, res) => {
  const db = loadDB();
  res.json(db.employees);
});

app.post('/api/employees', (req, res) => {
  const db = loadDB();
  const { name, department, role, email, shift } = req.body;
  
  if (!name || !department || !role) {
    return res.status(400).json({ error: 'Name, Department, and Role are required' });
  }

  const colors = ['#EF4444', '#F59E0B', '#DC2626', '#D97706', '#B91C1C', '#EAB308'];
  const avatarColor = colors[Math.floor(Math.random() * colors.length)];

  const newEmp = {
    id: `EMP-${Math.floor(100 + Math.random() * 900)}`,
    name,
    department,
    role,
    email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@company.com`,
    shift: shift || '09:00 - 17:00',
    status: 'Active',
    avatarColor
  };

  db.employees.push(newEmp);
  saveDB(db);
  res.status(201).json(newEmp);
});

app.put('/api/employees/:id', (req, res) => {
  const db = loadDB();
  const empIndex = db.employees.findIndex(e => e.id === req.params.id);
  if (empIndex === -1) {
    return res.status(404).json({ error: 'Employee not found' });
  }
  db.employees[empIndex] = { ...db.employees[empIndex], ...req.body };
  saveDB(db);
  res.json(db.employees[empIndex]);
});

app.delete('/api/employees/:id', (req, res) => {
  const db = loadDB();
  db.employees = db.employees.filter(e => e.id !== req.params.id);
  saveDB(db);
  res.json({ success: true, message: 'Employee deleted' });
});

// Attendance Logs
app.get('/api/attendance', (req, res) => {
  const db = loadDB();
  let logs = [...db.attendance];

  const { date, employeeId, department, status, search } = req.query;

  if (date) {
    logs = logs.filter(l => l.date === date);
  }
  if (employeeId) {
    logs = logs.filter(l => l.employeeId === employeeId);
  }
  if (department) {
    logs = logs.filter(l => l.department.toLowerCase() === department.toLowerCase());
  }
  if (status) {
    logs = logs.filter(l => l.status.toLowerCase() === status.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    logs = logs.filter(l => 
      l.employeeName.toLowerCase().includes(q) || 
      l.employeeId.toLowerCase().includes(q) || 
      l.notes.toLowerCase().includes(q)
    );
  }

  // Sort latest first
  logs.sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn));

  res.json(logs);
});

// Clock In Endpoint
app.post('/api/attendance/clock-in', (req, res) => {
  const db = loadDB();
  const { employeeId, location, notes } = req.body;

  if (!employeeId) {
    return res.status(400).json({ error: 'Employee ID is required' });
  }

  const emp = db.employees.find(e => e.id === employeeId);
  if (!emp) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Check if employee already clocked in today
  const existingLog = db.attendance.find(a => a.employeeId === employeeId && a.date === todayStr);
  if (existingLog && !existingLog.clockOut) {
    return res.status(400).json({ error: 'Employee is already clocked in today' });
  }

  // Determine status (Late if clocked in after 09:15 AM)
  const hour = now.getHours();
  const minute = now.getMinutes();
  const isLate = (hour > 9) || (hour === 9 && minute > 15);
  const status = isLate ? 'Late' : 'Present';

  const newLog = {
    id: `ATT-${Math.floor(1000 + Math.random() * 9000)}`,
    employeeId: emp.id,
    employeeName: emp.name,
    department: emp.department,
    date: todayStr,
    clockIn: now.toISOString(),
    clockOut: null,
    status,
    location: location || 'HQ Office',
    notes: notes || (isLate ? 'Late arrival' : 'On-time arrival')
  };

  db.attendance.push(newLog);
  saveDB(db);
  res.status(201).json(newLog);
});

// Clock Out Endpoint
app.post('/api/attendance/clock-out', (req, res) => {
  const db = loadDB();
  const { employeeId } = req.body;

  if (!employeeId) {
    return res.status(400).json({ error: 'Employee ID is required' });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const activeLog = db.attendance.find(a => a.employeeId === employeeId && a.date === todayStr && !a.clockOut);

  if (!activeLog) {
    return res.status(400).json({ error: 'No active clock-in session found for today' });
  }

  const now = new Date();
  activeLog.clockOut = now.toISOString();
  activeLog.status = 'Clocked Out';

  // Compute work hours
  const durationMs = now - new Date(activeLog.clockIn);
  const hours = (durationMs / (1000 * 60 * 60)).toFixed(2);
  activeLog.workHours = parseFloat(hours);

  saveDB(db);
  res.json(activeLog);
});

// Summary Stats Endpoint
app.get('/api/stats/today', (req, res) => {
  const db = loadDB();
  const todayStr = new Date().toISOString().split('T')[0];

  const totalEmployees = db.employees.filter(e => e.status === 'Active').length;
  const todayLogs = db.attendance.filter(a => a.date === todayStr);

  const presentCount = todayLogs.filter(a => a.status === 'Present' || a.status === 'Clocked Out').length;
  const lateCount = todayLogs.filter(a => a.status === 'Late').length;
  const onLeaveCount = db.leaves.filter(l => l.status === 'Approved' && l.startDate <= todayStr && l.endDate >= todayStr).length;

  const totalAttended = presentCount + lateCount;
  const absentCount = Math.max(0, totalEmployees - totalAttended - onLeaveCount);
  const attendanceRate = totalEmployees > 0 ? Math.round((totalAttended / totalEmployees) * 100) : 0;

  res.json({
    date: todayStr,
    totalEmployees,
    present: presentCount,
    late: lateCount,
    onLeave: onLeaveCount,
    absent: absentCount,
    attendanceRate
  });
});

// Leave Management API
app.get('/api/leaves', (req, res) => {
  const db = loadDB();
  res.json(db.leaves);
});

app.post('/api/leaves', (req, res) => {
  const db = loadDB();
  const { employeeId, type, startDate, endDate, reason } = req.body;

  if (!employeeId || !type || !startDate || !endDate) {
    return res.status(400).json({ error: 'Employee ID, Leave Type, Start Date, and End Date are required' });
  }

  const emp = db.employees.find(e => e.id === employeeId);
  if (!emp) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const newLeave = {
    id: `LV-${Math.floor(500 + Math.random() * 500)}`,
    employeeId: emp.id,
    employeeName: emp.name,
    department: emp.department,
    type,
    startDate,
    endDate,
    days: diffDays,
    reason: reason || 'N/A',
    status: 'Pending'
  };

  db.leaves.push(newLeave);
  saveDB(db);
  res.status(201).json(newLeave);
});

app.put('/api/leaves/:id', (req, res) => {
  const db = loadDB();
  const leave = db.leaves.find(l => l.id === req.params.id);
  if (!leave) {
    return res.status(404).json({ error: 'Leave request not found' });
  }

  const { status } = req.body;
  if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  leave.status = status;
  saveDB(db);
  res.json(leave);
});

// CSV Export Endpoint
app.get('/api/export/csv', (req, res) => {
  const db = loadDB();
  const logs = db.attendance;

  let csv = 'ID,Employee ID,Employee Name,Department,Date,Clock In,Clock Out,Status,Location,Notes\n';

  logs.forEach(l => {
    const clockInStr = l.clockIn ? new Date(l.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const clockOutStr = l.clockOut ? new Date(l.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
    
    const escapeCsv = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

    csv += [
      escapeCsv(l.id),
      escapeCsv(l.employeeId),
      escapeCsv(l.employeeName),
      escapeCsv(l.department),
      escapeCsv(l.date),
      escapeCsv(clockInStr),
      escapeCsv(clockOutStr),
      escapeCsv(l.status),
      escapeCsv(l.location),
      escapeCsv(l.notes)
    ].join(',') + '\n';
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
  res.status(200).send(csv);
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Employee Attendance Portal listening on port ${PORT}`);
  console.log(`📍 Web URL: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
