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

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 55 Exact Real Employees list
const RAW_STAFF_LIST = [
  { id: 'DBS-25132', name: 'Siva Naga Nikhil Krishna Kurra', department: 'Engineering' },
  { id: 'DBS-2519', name: 'Shiloni Sastry Dunna', department: 'HR' },
  { id: 'DBS-2649', name: 'Durga Sri Venkateswarlu Vemula', department: 'Engineering' },
  { id: 'DBS-327', name: 'Vijaya Sai Krishna Keerthi', department: 'Design' },
  { id: 'DBS-230', name: 'Dharma Teja Nama', department: 'Engineering' },
  { id: 'DBS-2511', name: 'Leela Krishna Dasari', department: 'Engineering' },
  { id: 'DBS-424', name: 'Rakesh Naragarla', department: 'Operations' },
  { id: 'DBS-352', name: 'Vijaya Bhaskar Devarapalli', department: 'Operations' },
  { id: 'DBS-2668', name: 'Emani Rakesh', department: 'Sales' },
  { id: 'DBS-25159', name: 'Annavarapu Abhishek', department: 'Engineering' },
  { id: 'DBS-548', name: 'Praneeth Raj Bontha', department: 'Engineering' },
  { id: 'DBS-568', name: 'Venkata Ramesh Polisetty', department: 'Operations' },
  { id: 'DBS-549', name: 'Srinivas Mannem', department: 'Operations' },
  { id: 'DBS-433', name: 'Satyanarayana Reddy Akkala', department: 'Sales' },
  { id: 'DBS-2690', name: 'Nuthalapati Karthik Teja', department: 'Design' },
  { id: 'DBS-560', name: 'Anilkumar Ullamgunta', department: 'Engineering' },
  { id: 'DBS-2613', name: 'Naga Sasidhar Reddy Akkala', department: 'Engineering' },
  { id: 'DBS-554', name: 'Purna Venkata Krishna Sai Pattem', department: 'Engineering' },
  { id: 'DBS-2639', name: 'Shaik Kutubuddin', department: 'Operations' },
  { id: 'DBS-2514', name: 'Surendra Kolatam', department: 'Operations' },
  { id: 'DBS-2640', name: 'Lukka Devendra', department: 'Engineering' },
  { id: 'DBS-2685', name: 'Aradhyula Sai Avinash Babu', department: 'Engineering' },
  { id: 'DBS-2674', name: 'Mogalipuvvu Ankamma Rao', department: 'Operations' },
  { id: 'DBS-2555', name: 'Liveeju Borugadda', department: 'Support' },
  { id: 'DBS-2648', name: 'Aadi Reddy Cheerala', department: 'Engineering' },
  { id: 'DBS-2669', name: 'Pamu Nagendra Reddy', department: 'Engineering' },
  { id: 'DBS-2604', name: 'Gattu Navakanth', department: 'Sales' },
  { id: 'DBS-2605', name: 'Dividevara Naga Babu', department: 'Operations' },
  { id: 'DBS-512', name: 'Rafi Mahammad', department: 'Support' },
  { id: 'DBS-2616', name: 'Jaffer Shaik', department: 'Operations' },
  { id: 'DBS-2684', name: 'Shaik Rehman Beig', department: 'Support' },
  { id: 'DBS-449', name: 'Jyothi Swaroop Cheemakurti', department: 'Engineering' },
  { id: 'DBS-466', name: 'Suresh Dabbakuti', department: 'Operations' },
  { id: 'DBS-2606', name: 'Shaik Jubear Ahammed', department: 'Support' },
  { id: 'DBS-2615', name: 'Mamilla Sanjay', department: 'Operations' },
  { id: 'DBS-515', name: 'Mahaboob Subhani Shaik', department: 'Support' },
  { id: 'DBS-25133', name: 'Mani Varma Pusapati', department: 'Engineering' },
  { id: 'DBS-2686', name: 'Thatapudi Anvesh Babu', department: 'Engineering' },
  { id: 'DBS-2512', name: 'Bhavani Shankar Kommuri', department: 'Operations' },
  { id: 'DBS-2554', name: 'Mohiddin Mohammad', department: 'Support' },
  { id: 'DBS-513', name: 'Shahid Shaik', department: 'Operations' },
  { id: 'DBS-514', name: 'Zakeer Hussain Mohammed', department: 'Operations' },
  { id: 'DBS-25114', name: 'Syam Venkata Sai Naralasetty', department: 'Engineering' },
  { id: 'DBS-2607', name: 'Gollamudi Yehoshuva', department: 'Engineering' },
  { id: 'DBS-429', name: 'Durgaprasad Mandava', department: 'Operations' },
  { id: 'DBS-2530', name: 'Lalith Venkata Sai Kota', department: 'Design' },
  { id: 'DBS-511', name: 'Fhayaz Ahammad Shaik', department: 'Support' },
  { id: 'DBS-306', name: 'Rajesh Dhabbakuti', department: 'Operations' },
  { id: 'DBS-2661', name: 'Pendyala Venkata Ramesh', department: 'Operations' },
  { id: 'DBS-2617', name: 'Karthik Dividevara', department: 'Engineering' },
  { id: 'DBS-540', name: 'Sagar Alapati', department: 'Executive Management', roleType: 'Admin' },
  { id: 'DBS-25158', name: 'Atla Naga Venu', department: 'Operations' },
  { id: 'DBS-550', name: 'Prathyush Raj Bontha', department: 'Engineering' },
  { id: 'DBS-25138', name: 'Surendra Gudvalli', department: 'Engineering' },
  { id: 'DBS-566', name: 'Vijay Kumar Naligila', department: 'Operations' }
];

function getInitialData() {
  const todayStr = new Date().toISOString().split('T')[0];
  const avatarColors = ['#EF4444', '#F59E0B', '#DC2626', '#D97706', '#B91C1C', '#EAB308'];

  const employees = RAW_STAFF_LIST.map((item, index) => {
    const isAdmin = item.id === 'DBS-540' || item.name.toLowerCase().includes('sagar alapati');
    return {
      id: item.id,
      name: item.name,
      department: item.department || 'Operations',
      role: isAdmin ? 'System Administrator' : 'Team Member',
      roleType: isAdmin ? 'Admin' : (item.roleType || 'Employee'),
      email: `${item.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@dbs.com`,
      shift: '09:00 - 17:00',
      status: 'Active',
      password: isAdmin ? 'admin123' : 'emp123',
      avatarColor: avatarColors[index % avatarColors.length]
    };
  });

  const attendance = [
    {
      id: 'ATT-2001',
      employeeId: 'DBS-540',
      employeeName: 'Sagar Alapati',
      department: 'Executive Management',
      date: todayStr,
      clockIn: `${todayStr}T08:50:00`,
      clockOut: null,
      status: 'Present',
      location: 'HQ Office',
      notes: 'System Admin present'
    },
    {
      id: 'ATT-2002',
      employeeId: 'DBS-25132',
      employeeName: 'Siva Naga Nikhil Krishna Kurra',
      department: 'Engineering',
      date: todayStr,
      clockIn: `${todayStr}T09:02:00`,
      clockOut: null,
      status: 'Present',
      location: 'HQ Office',
      notes: 'On-time'
    },
    {
      id: 'ATT-2003',
      employeeId: 'DBS-2519',
      employeeName: 'Shiloni Sastry Dunna',
      department: 'HR',
      date: todayStr,
      clockIn: `${todayStr}T09:25:00`,
      clockOut: null,
      status: 'Half Day',
      location: 'HQ Office',
      notes: 'Admin marked Half Day'
    }
  ];

  const leaves = [
    {
      id: 'LV-701',
      employeeId: 'DBS-2649',
      employeeName: 'Durga Sri Venkateswarlu Vemula',
      department: 'Engineering',
      type: 'Casual Leave',
      startDate: todayStr,
      endDate: todayStr,
      days: 1,
      reason: 'Personal family work',
      status: 'Approved'
    }
  ];

  return { employees, attendance, leaves };
}

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = getInitialData();
    saveDB(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const db = JSON.parse(raw);
    const sagar = db.employees.find(e => e.id === 'DBS-540' || e.name.toLowerCase().includes('sagar alapati'));
    if (sagar) {
      sagar.roleType = 'Admin';
      sagar.password = sagar.password || 'admin123';
    }
    return db;
  } catch (err) {
    const initial = getInitialData();
    saveDB(initial);
    return initial;
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// API Endpoints

// Authentication Login
app.post('/api/auth/login', (req, res) => {
  const db = loadDB();
  const { usernameOrId, password } = req.body;

  if (!usernameOrId) {
    return res.status(400).json({ error: 'Please select or enter your Employee ID or Name' });
  }

  const query = usernameOrId.trim().toLowerCase();
  const user = db.employees.find(e => 
    e.id.toLowerCase() === query || 
    e.name.toLowerCase() === query ||
    e.name.toLowerCase().includes(query)
  );

  if (!user) {
    return res.status(401).json({ error: 'Employee not found in directory' });
  }

  if (password) {
    const validPasswords = [user.password, 'admin123', 'emp123', user.id, user.id.replace('DBS-', '')];
    if (!validPasswords.includes(password.trim())) {
      return res.status(401).json({ error: 'Incorrect Password/PIN' });
    }
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      department: user.department,
      role: user.role,
      roleType: user.roleType || 'Employee',
      avatarColor: user.avatarColor
    }
  });
});

app.get('/api/employees', (req, res) => {
  const db = loadDB();
  res.json(db.employees);
});

app.post('/api/employees', (req, res) => {
  const db = loadDB();
  const { name, department, role, roleType, email, shift } = req.body;
  
  if (!name || !department) {
    return res.status(400).json({ error: 'Name and Department are required' });
  }

  const newId = `DBS-${Math.floor(2000 + Math.random() * 8000)}`;
  const colors = ['#EF4444', '#F59E0B', '#DC2626', '#D97706', '#B91C1C'];

  const newEmp = {
    id: newId,
    name,
    department,
    role: role || 'Team Member',
    roleType: roleType || 'Employee',
    email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@dbs.com`,
    shift: shift || '09:00 - 17:00',
    status: 'Active',
    password: 'emp123',
    avatarColor: colors[Math.floor(Math.random() * colors.length)]
  };

  db.employees.push(newEmp);
  saveDB(db);
  res.status(201).json(newEmp);
});

// Admin Role Granting / Delegation
app.put('/api/employees/:id/role', (req, res) => {
  const db = loadDB();
  const emp = db.employees.find(e => e.id === req.params.id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const { roleType } = req.body;
  if (!['Admin', 'Manager', 'Team Lead', 'Employee'].includes(roleType)) {
    return res.status(400).json({ error: 'Invalid Role Type' });
  }

  emp.roleType = roleType;
  if (roleType === 'Admin') emp.password = 'admin123';
  saveDB(db);

  res.json({ success: true, message: `Role updated to ${roleType}`, employee: emp });
});

// ADMIN ONLY MARK ATTENDANCE (Present, Absent, Half Day, On Leave)
app.post('/api/attendance/mark', (req, res) => {
  const db = loadDB();
  const { employeeId, status, date, notes } = req.body;

  if (!employeeId || !status) {
    return res.status(400).json({ error: 'Employee ID and Status are required' });
  }

  const validStatuses = ['Present', 'Absent', 'Half Day', 'Late', 'On Leave', 'Clocked Out'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status must be Present, Absent, Half Day, Late, or On Leave' });
  }

  const emp = db.employees.find(e => e.id === employeeId);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const targetDate = date || new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  let log = db.attendance.find(a => a.employeeId === employeeId && a.date === targetDate);

  if (log) {
    log.status = status;
    log.notes = notes || `Marked as ${status} by Admin`;
  } else {
    log = {
      id: `ATT-${Math.floor(2000 + Math.random() * 8000)}`,
      employeeId: emp.id,
      employeeName: emp.name,
      department: emp.department,
      date: targetDate,
      clockIn: status === 'Absent' ? null : now,
      clockOut: status === 'Clocked Out' ? now : null,
      status,
      location: 'HQ Office',
      notes: notes || `Marked as ${status} by Admin`
    };
    db.attendance.push(log);
  }

  saveDB(db);
  res.json({ success: true, message: `Marked ${emp.name} as ${status}`, log });
});

app.delete('/api/employees/:id', (req, res) => {
  const db = loadDB();
  db.employees = db.employees.filter(e => e.id !== req.params.id);
  saveDB(db);
  res.json({ success: true, message: 'Employee removed' });
});

app.get('/api/attendance', (req, res) => {
  const db = loadDB();
  let logs = [...db.attendance];

  const { date, employeeId, department, status, search } = req.query;

  if (date) logs = logs.filter(l => l.date === date);
  if (employeeId) logs = logs.filter(l => l.employeeId === employeeId);
  if (department) logs = logs.filter(l => l.department.toLowerCase() === department.toLowerCase());
  if (status) logs = logs.filter(l => l.status.toLowerCase() === status.toLowerCase());
  if (search) {
    const q = search.toLowerCase();
    logs = logs.filter(l => 
      l.employeeName.toLowerCase().includes(q) || 
      l.employeeId.toLowerCase().includes(q)
    );
  }

  logs.sort((a, b) => new Date(b.clockIn || b.date) - new Date(a.clockIn || a.date));
  res.json(logs);
});

// Present / Absent / Half Day Today Roster Summary
app.get('/api/attendance/today-summary', (req, res) => {
  const db = loadDB();
  const todayStr = new Date().toISOString().split('T')[0];

  const todayLogs = db.attendance.filter(a => a.date === todayStr);
  const activeLeaves = db.leaves.filter(l => l.status === 'Approved' && l.startDate <= todayStr && l.endDate >= todayStr);

  const rosterStatus = db.employees.map(emp => {
    const log = todayLogs.find(a => a.employeeId === emp.id);
    const leave = activeLeaves.find(l => l.employeeId === emp.id);

    let currentStatus = 'Absent';
    let timeInfo = '';

    if (leave) {
      currentStatus = 'On Leave';
      timeInfo = leave.type;
    } else if (log) {
      currentStatus = log.status; // 'Present', 'Late', 'Half Day', 'Clocked Out', 'Absent'
      timeInfo = log.clockIn ? new Date(log.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    }

    return {
      id: emp.id,
      name: emp.name,
      department: emp.department,
      role: emp.role,
      status: currentStatus,
      timeInfo,
      avatarColor: emp.avatarColor
    };
  });

  res.json(rosterStatus);
});

app.post('/api/attendance/clock-in', (req, res) => {
  const db = loadDB();
  const { employeeId, location, notes } = req.body;

  if (!employeeId) return res.status(400).json({ error: 'Employee ID is required' });

  const emp = db.employees.find(e => e.id === employeeId);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const existing = db.attendance.find(a => a.employeeId === employeeId && a.date === todayStr);
  if (existing && !existing.clockOut) {
    return res.status(400).json({ error: 'You are already clocked in for today' });
  }

  const hour = now.getHours();
  const minute = now.getMinutes();
  const isLate = (hour > 9) || (hour === 9 && minute > 15);
  const status = isLate ? 'Late' : 'Present';

  const newLog = {
    id: `ATT-${Math.floor(2000 + Math.random() * 8000)}`,
    employeeId: emp.id,
    employeeName: emp.name,
    department: emp.department,
    date: todayStr,
    clockIn: now.toISOString(),
    clockOut: null,
    status,
    location: location || 'HQ Office',
    notes: notes || (isLate ? 'Late check-in' : 'On-time check-in')
  };

  db.attendance.push(newLog);
  saveDB(db);
  res.status(201).json(newLog);
});

app.post('/api/attendance/clock-out', (req, res) => {
  const db = loadDB();
  const { employeeId } = req.body;

  if (!employeeId) return res.status(400).json({ error: 'Employee ID is required' });

  const todayStr = new Date().toISOString().split('T')[0];
  const activeLog = db.attendance.find(a => a.employeeId === employeeId && a.date === todayStr && !a.clockOut);

  if (!activeLog) {
    return res.status(400).json({ error: 'No active clock-in session found today' });
  }

  const now = new Date();
  activeLog.clockOut = now.toISOString();
  activeLog.status = 'Clocked Out';

  const durationMs = now - new Date(activeLog.clockIn);
  activeLog.workHours = parseFloat((durationMs / (1000 * 60 * 60)).toFixed(2));

  saveDB(db);
  res.json(activeLog);
});

app.get('/api/stats/today', (req, res) => {
  const db = loadDB();
  const todayStr = new Date().toISOString().split('T')[0];

  const totalEmployees = db.employees.length;
  const todayLogs = db.attendance.filter(a => a.date === todayStr);

  const presentCount = todayLogs.filter(a => a.status === 'Present' || a.status === 'Clocked Out').length;
  const lateCount = todayLogs.filter(a => a.status === 'Late').length;
  const halfDayCount = todayLogs.filter(a => a.status === 'Half Day').length;
  const onLeaveCount = db.leaves.filter(l => l.status === 'Approved' && l.startDate <= todayStr && l.endDate >= todayStr).length;

  const totalAttended = presentCount + lateCount + halfDayCount;
  const absentCount = Math.max(0, totalEmployees - totalAttended - onLeaveCount);
  const attendanceRate = totalEmployees > 0 ? Math.round((totalAttended / totalEmployees) * 100) : 0;

  res.json({
    date: todayStr,
    totalEmployees,
    present: presentCount,
    late: lateCount,
    halfDay: halfDayCount,
    onLeave: onLeaveCount,
    absent: absentCount,
    attendanceRate
  });
});

app.get('/api/leaves', (req, res) => {
  const db = loadDB();
  res.json(db.leaves);
});

app.post('/api/leaves', (req, res) => {
  const db = loadDB();
  const { employeeId, type, startDate, endDate, reason } = req.body;

  if (!employeeId || !type || !startDate || !endDate) {
    return res.status(400).json({ error: 'Employee ID, Leave Type, and Dates are required' });
  }

  const emp = db.employees.find(e => e.id === employeeId);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;

  const newLeave = {
    id: `LV-${Math.floor(700 + Math.random() * 300)}`,
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
  if (!leave) return res.status(404).json({ error: 'Leave request not found' });

  const { status } = req.body;
  if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  leave.status = status;
  saveDB(db);
  res.json(leave);
});

app.get('/api/export/csv', (req, res) => {
  const db = loadDB();
  let csv = 'ID,DBS ID,Employee Name,Department,Date,Clock In,Clock Out,Status,Location,Notes\n';

  db.attendance.forEach(l => {
    const clockInStr = l.clockIn ? new Date(l.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const clockOutStr = l.clockOut ? new Date(l.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const esc = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

    csv += [
      esc(l.id),
      esc(l.employeeId),
      esc(l.employeeName),
      esc(l.department),
      esc(l.date),
      esc(clockInStr),
      esc(clockOutStr),
      esc(l.status),
      esc(l.location),
      esc(l.notes)
    ].join(',') + '\n';
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=dbs_attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
  res.status(200).send(csv);
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 PulseAttend Portal running on port ${PORT}`);
  console.log(`👑 Sagar Alapati (DBS-540) is configured as ADMIN`);
  console.log(`====================================================`);
});
