const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Active Sessions Store
const activeSessions = new Map();

// Password Hashing Helper
function hashPassword(password) {
  const salt = 'pulseattend_dbs_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

// 55 Real DBS Employees List
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
  { id: 'DBS-540', name: 'Sagar Alapati', department: 'Executive Management', roleType: 'Admin', phone: '9704225352' },
  { id: 'DBS-25158', name: 'Atla Naga Venu', department: 'Operations' },
  { id: 'DBS-550', name: 'Prathyush Raj Bontha', department: 'Engineering' },
  { id: 'DBS-25138', name: 'Surendra Gudvalli', department: 'Engineering' },
  { id: 'DBS-566', name: 'Vijay Kumar Naligila', department: 'Operations' }
];

function getInitialData() {
  const avatarColors = ['#EF4444', '#F59E0B', '#DC2626', '#D97706', '#B91C1C', '#EAB308'];

  const employees = RAW_STAFF_LIST.map((item, index) => {
    const isAdmin = item.id === 'DBS-540' || item.name.toLowerCase().includes('sagar alapati');
    const rawPass = isAdmin ? '9640000890' : item.id;
    return {
      id: item.id,
      name: item.name,
      phone: item.phone || (isAdmin ? '9704225352' : ''),
      department: item.department || 'Operations',
      role: isAdmin ? 'System Administrator' : 'Team Member',
      roleType: isAdmin ? 'Admin' : 'Employee',
      passwordHash: hashPassword(rawPass),
      avatarColor: avatarColors[index % avatarColors.length]
    };
  });

  return {
    employees,
    attendance: []
  };
}

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = getInitialData();
    saveDB(initial);
    return initial;
  }
  try {
    const content = fs.readFileSync(DB_FILE, 'utf8');
    const db = JSON.parse(content);
    if (!db.employees || !Array.isArray(db.employees)) {
      const initial = getInitialData();
      saveDB(initial);
      return initial;
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

// ---------------------------------------------------------
// REST API ENDPOINTS
// ---------------------------------------------------------

// 1. Direct Admin Login (NO 2FA)
app.post('/api/auth/login', (req, res) => {
  const db = loadDB();
  const { usernameOrId, password } = req.body;

  if (!usernameOrId || !password) {
    return res.status(400).json({ error: 'Username/Phone and Password are required' });
  }

  const query = usernameOrId.trim().toLowerCase();
  const user = db.employees.find(e => 
    e.id.toLowerCase() === query || 
    e.name.toLowerCase() === query ||
    (e.phone && e.phone === query) ||
    e.name.toLowerCase().includes(query)
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid Credentials. Please check your username/phone.' });
  }

  const inputHash = hashPassword(password.trim());
  if (user.passwordHash !== inputHash) {
    return res.status(401).json({ error: 'Incorrect Password. Please check your password.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, {
    userId: user.id,
    roleType: user.roleType || 'Admin',
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone || '',
      department: user.department,
      roleType: user.roleType || 'Admin',
      avatarColor: user.avatarColor
    }
  });
});

// 2. Get All Employees List
app.get('/api/employees', (req, res) => {
  const db = loadDB();
  res.json(db.employees);
});

// 3. Add New Employee
app.post('/api/employees', (req, res) => {
  const db = loadDB();
  const { name, department, id } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Employee name is required' });
  }

  const newId = (id && id.trim()) ? id.trim().toUpperCase() : `DBS-${Math.floor(1000 + Math.random() * 9000)}`;

  if (db.employees.some(e => e.id.toLowerCase() === newId.toLowerCase())) {
    return res.status(400).json({ error: `Employee ID ${newId} already exists` });
  }

  const avatarColors = ['#EF4444', '#F59E0B', '#DC2626', '#D97706', '#B91C1C', '#EAB308'];
  const newEmp = {
    id: newId,
    name: name.trim(),
    department: (department && department.trim()) ? department.trim() : 'Operations',
    role: 'Team Member',
    roleType: 'Employee',
    passwordHash: hashPassword(newId),
    avatarColor: avatarColors[Math.floor(Math.random() * avatarColors.length)]
  };

  db.employees.push(newEmp);
  saveDB(db);

  res.status(201).json(newEmp);
});

// 4. Delete Employee
app.delete('/api/employees/:id', (req, res) => {
  const db = loadDB();
  const { id } = req.params;

  if (id === 'DBS-540') {
    return res.status(400).json({ error: 'Cannot delete primary Admin Sagar Alapati' });
  }

  const index = db.employees.findIndex(e => e.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  const deleted = db.employees.splice(index, 1)[0];
  saveDB(db);

  res.json({ success: true, deleted });
});

// 5. Get Attendance Records for a Specific Date
app.get('/api/attendance', (req, res) => {
  const db = loadDB();
  const targetDate = req.query.date || new Date().toISOString().split('T')[0];

  const records = db.employees.map(emp => {
    const att = (db.attendance || []).find(a => a.employeeId === emp.id && a.date === targetDate);
    return {
      employeeId: emp.id,
      name: emp.name,
      department: emp.department,
      avatarColor: emp.avatarColor,
      date: targetDate,
      status: att ? att.status : 'Unmarked',
      notes: att ? (att.notes || '') : ''
    };
  });

  res.json({
    date: targetDate,
    records
  });
});

// 6. Mark Single Employee Attendance
app.post('/api/attendance/mark', (req, res) => {
  const db = loadDB();
  const { employeeId, date, status, notes } = req.body;

  if (!employeeId || !date || !status) {
    return res.status(400).json({ error: 'Employee ID, Date, and Status are required' });
  }

  const validStatuses = ['Present', 'Absent', 'Half Day', 'On Leave', 'Unmarked'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  if (!db.attendance) db.attendance = [];

  const index = db.attendance.findIndex(a => a.employeeId === employeeId && a.date === date);
  const emp = db.employees.find(e => e.id === employeeId);

  if (index >= 0) {
    db.attendance[index].status = status;
    db.attendance[index].notes = notes || db.attendance[index].notes || '';
    db.attendance[index].updatedAt = new Date().toISOString();
  } else {
    db.attendance.push({
      id: `ATT-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      employeeId,
      employeeName: emp ? emp.name : '',
      department: emp ? emp.department : '',
      date,
      status,
      notes: notes || '',
      updatedAt: new Date().toISOString()
    });
  }

  saveDB(db);

  res.json({
    success: true,
    message: `Attendance marked as ${status} for ${emp ? emp.name : employeeId}`,
    employeeId,
    date,
    status
  });
});

// 7. Bulk Mark All Employees for a Date
app.post('/api/attendance/mark-all', (req, res) => {
  const db = loadDB();
  const { date, status } = req.body;

  if (!date || !status) {
    return res.status(400).json({ error: 'Date and Status are required' });
  }

  if (!db.attendance) db.attendance = [];

  db.employees.forEach(emp => {
    const index = db.attendance.findIndex(a => a.employeeId === emp.id && a.date === date);
    if (index >= 0) {
      db.attendance[index].status = status;
      db.attendance[index].updatedAt = new Date().toISOString();
    } else {
      db.attendance.push({
        id: `ATT-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        date,
        status,
        updatedAt: new Date().toISOString()
      });
    }
  });

  saveDB(db);

  res.json({
    success: true,
    message: `All employees marked as ${status} for date ${date}`
  });
});

// 7b. Auto-Mark Remaining Unmarked Employees as Present for a Date
app.post('/api/attendance/auto-present-remaining', (req, res) => {
  const db = loadDB();
  const { date } = req.body;

  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  if (!db.attendance) db.attendance = [];

  let count = 0;
  db.employees.forEach(emp => {
    const existing = db.attendance.find(a => a.employeeId === emp.id && a.date === date);
    if (!existing || existing.status === 'Unmarked') {
      if (existing) {
        existing.status = 'Present';
        existing.updatedAt = new Date().toISOString();
      } else {
        db.attendance.push({
          id: `ATT-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          employeeId: emp.id,
          employeeName: emp.name,
          department: emp.department,
          date,
          status: 'Present',
          updatedAt: new Date().toISOString()
        });
      }
      count++;
    }
  });

  saveDB(db);

  res.json({
    success: true,
    message: `Auto-marked ${count} remaining employees as Present for ${date}`,
    count
  });
});

// 8. Export Monthly Attendance Excel / CSV Report
app.get('/api/export/monthly-excel', (req, res) => {
  const db = loadDB();
  const monthQuery = req.query.month || new Date().toISOString().substring(0, 7);

  const attendanceList = db.attendance || [];
  const monthRecords = attendanceList.filter(a => a.date && a.date.startsWith(monthQuery));

  const summary = db.employees.map(emp => {
    const empRecords = monthRecords.filter(a => a.employeeId === emp.id);

    let presentCount = 0;
    let absentCount = 0;
    let halfDayCount = 0;
    let leaveCount = 0;

    empRecords.forEach(r => {
      if (r.status === 'Present') presentCount++;
      else if (r.status === 'Absent') absentCount++;
      else if (r.status === 'Half Day') halfDayCount++;
      else if (r.status === 'On Leave') leaveCount++;
    });

    const totalDaysRecorded = empRecords.length;

    return {
      id: emp.id,
      name: emp.name,
      department: emp.department,
      present: presentCount,
      absent: absentCount,
      halfDay: halfDayCount,
      leave: leaveCount,
      totalRecorded: totalDaysRecorded
    };
  });

  let csv = '\uFEFF';
  csv += `PulseAttend Monthly Attendance Summary - Month: ${monthQuery}\n`;
  csv += `Generated On: ${new Date().toLocaleString('en-US')}\n\n`;
  csv += `DBS ID,Employee Name,Department,Days Present,Days Absent,Half Days,Days On Leave,Total Days Recorded\n`;

  summary.forEach(row => {
    const cleanName = `"${row.name.replace(/"/g, '""')}"`;
    const cleanDept = `"${row.department.replace(/"/g, '""')}"`;
    csv += `${row.id},${cleanName},${cleanDept},${row.present},${row.absent},${row.halfDay},${row.leave},${row.totalRecorded}\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=PulseAttend_Monthly_Attendance_${monthQuery}.csv`);
  res.send(csv);
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 PulseAttend Clean Attendance Portal running on port ${PORT}`);
  console.log(`👤 Admin: Sagar Alapati (9704225352 / 9640000890)`);
  console.log(`====================================================`);
});
