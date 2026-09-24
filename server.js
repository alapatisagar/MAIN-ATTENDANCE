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

// 55 Real DBS Employees List + Admin Accounts
const RAW_STAFF_LIST = [
  { id: 'DBS-25132', name: 'Siva Naga Nikhil Krishna Kurra' },
  { id: 'DBS-2519', name: 'Shiloni Sastry Dunna' },
  { id: 'DBS-2649', name: 'Durga Sri Venkateswarlu Vemula' },
  { id: 'DBS-327', name: 'VIJAYA SAI KRISHNA KEERTHI', roleType: 'Admin', phone: '7569258789', pass: 'Admin@123' },
  { id: 'DBS-230', name: 'Dharma Teja Nama' },
  { id: 'DBS-2511', name: 'Leela Krishna Dasari' },
  { id: 'DBS-424', name: 'Rakesh Naragarla' },
  { id: 'DBS-352', name: 'Vijaya Bhaskar Devarapalli' },
  { id: 'DBS-2668', name: 'Emani Rakesh' },
  { id: 'DBS-25159', name: 'Annavarapu Abhishek' },
  { id: 'DBS-548', name: 'Praneeth Raj Bontha' },
  { id: 'DBS-568', name: 'Venkata Ramesh Polisetty' },
  { id: 'DBS-549', name: 'Srinivas Mannem' },
  { id: 'DBS-433', name: 'Satyanarayana Reddy Akkala' },
  { id: 'DBS-2690', name: 'Nuthalapati Karthik Teja' },
  { id: 'DBS-560', name: 'Anilkumar Ullamgunta' },
  { id: 'DBS-2613', name: 'Naga Sasidhar Reddy Akkala' },
  { id: 'DBS-554', name: 'Purna Venkata Krishna Sai Pattem' },
  { id: 'DBS-2639', name: 'Shaik Kutubuddin' },
  { id: 'DBS-2514', name: 'Surendra Kolatam' },
  { id: 'DBS-2640', name: 'Lukka Devendra' },
  { id: 'DBS-2685', name: 'Aradhyula Sai Avinash Babu' },
  { id: 'DBS-2674', name: 'Mogalipuvvu Ankamma Rao' },
  { id: 'DBS-2555', name: 'Liveeju Borugadda' },
  { id: 'DBS-2648', name: 'Aadi Reddy Cheerala' },
  { id: 'DBS-2669', name: 'Pamu Nagendra Reddy' },
  { id: 'DBS-2604', name: 'Gattu Navakanth' },
  { id: 'DBS-2605', name: 'Dividevara Naga Babu' },
  { id: 'DBS-512', name: 'Rafi Mahammad' },
  { id: 'DBS-2616', name: 'Jaffer Shaik' },
  { id: 'DBS-2684', name: 'Shaik Rehman Beig' },
  { id: 'DBS-449', name: 'Jyothi Swaroop Cheemakurti' },
  { id: 'DBS-466', name: 'Suresh Dabbakuti' },
  { id: 'DBS-2606', name: 'Shaik Jubear Ahammed' },
  { id: 'DBS-2615', name: 'Mamilla Sanjay' },
  { id: 'DBS-515', name: 'Mahaboob Subhani Shaik' },
  { id: 'DBS-25133', name: 'Mani Varma Pusapati' },
  { id: 'DBS-2686', name: 'Thatapudi Anvesh Babu' },
  { id: 'DBS-2512', name: 'Bhavani Shankar Kommuri' },
  { id: 'DBS-2554', name: 'Mohiddin Mohammad' },
  { id: 'DBS-513', name: 'Shahid Shaik' },
  { id: 'DBS-514', name: 'Zakeer Hussain Mohammed' },
  { id: 'DBS-25114', name: 'Syam Venkata Sai Naralasetty' },
  { id: 'DBS-2607', name: 'Gollamudi Yehoshuva' },
  { id: 'DBS-429', name: 'Durgaprasad Mandava' },
  { id: 'DBS-2530', name: 'Lalith Venkata Sai Kota' },
  { id: 'DBS-511', name: 'Fhayaz Ahammad Shaik' },
  { id: 'DBS-306', name: 'Rajesh Dhabbakuti' },
  { id: 'DBS-2661', name: 'Pendyala Venkata Ramesh' },
  { id: 'DBS-2617', name: 'Karthik Dividevara' },
  { id: 'DBS-540', name: 'SAGAR ALAPATI', roleType: 'Admin', phone: '9704225352', pass: '9640000890' },
  { id: 'DBS-25158', name: 'Atla Naga Venu' },
  { id: 'DBS-550', name: 'Prathyush Raj Bontha' },
  { id: 'DBS-25138', name: 'Surendra Gudvalli' },
  { id: 'DBS-566', name: 'Vijay Kumar Naligila' }
];

function getInitialData() {
  const avatarColors = ['#EF4444', '#F59E0B', '#DC2626', '#D97706', '#B91C1C', '#EAB308'];

  const employees = RAW_STAFF_LIST.map((item, index) => {
    const isAdmin = item.roleType === 'Admin' || item.id === 'DBS-540' || item.id === 'DBS-327' || item.id === 'DBS-7569';
    const rawPass = item.pass || (isAdmin ? '9640000890' : item.id);
    return {
      id: item.id,
      name: item.name,
      phone: item.phone || '',
      department: 'AR Callers',
      role: isAdmin ? 'System Administrator' : 'AR Caller',
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

    // Force all employees to AR Callers department
    db.employees.forEach(e => {
      e.department = 'AR Callers';
    });

    // Update Primary Admin (SAGAR ALAPATI)
    let admin1 = db.employees.find(e => e.id === 'DBS-540' || e.phone === '9704225352');
    if (admin1) {
      admin1.name = 'SAGAR ALAPATI';
      admin1.phone = '9704225352';
      admin1.roleType = 'Admin';
      if (!admin1.passwordHash) admin1.passwordHash = hashPassword('9640000890');
    } else {
      db.employees.push({
        id: 'DBS-540',
        name: 'SAGAR ALAPATI',
        phone: '9704225352',
        department: 'AR Callers',
        role: 'System Administrator',
        roleType: 'Admin',
        passwordHash: hashPassword('9640000890'),
        avatarColor: '#DC2626'
      });
    }

    // Update Co-Admin (VIJAYA SAI KRISHNA KEERTHI)
    let admin2 = db.employees.find(e => e.phone === '7569258789' || e.id === 'DBS-327' || e.id === 'DBS-7569');
    if (admin2) {
      admin2.name = 'VIJAYA SAI KRISHNA KEERTHI';
      admin2.phone = '7569258789';
      admin2.roleType = 'Admin';
      admin2.passwordHash = hashPassword('Admin@123');
    } else {
      db.employees.push({
        id: 'DBS-327',
        name: 'VIJAYA SAI KRISHNA KEERTHI',
        phone: '7569258789',
        department: 'AR Callers',
        role: 'System Administrator',
        roleType: 'Admin',
        passwordHash: hashPassword('Admin@123'),
        avatarColor: '#F59E0B'
      });
    }

    saveDB(db);
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

// 1. Direct Login (Supports 9704225352 & 7569258789)
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
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone || '',
      department: 'AR Callers',
      roleType: user.roleType || 'Admin',
      avatarColor: user.avatarColor
    }
  });
});

// 1b. Change Password Endpoint
app.put('/api/auth/change-password', (req, res) => {
  const db = loadDB();
  const { userId, currentPassword, newPassword } = req.body;

  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'User ID, current password, and new password are required' });
  }

  const user = db.employees.find(e => e.id === userId || (e.phone && e.phone === userId));
  if (!user) {
    return res.status(404).json({ error: 'User account not found' });
  }

  const currentHash = hashPassword(currentPassword.trim());
  if (user.passwordHash !== currentHash) {
    return res.status(401).json({ error: 'Incorrect current password' });
  }

  if (newPassword.trim().length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters long' });
  }

  user.passwordHash = hashPassword(newPassword.trim());
  saveDB(db);

  res.json({
    success: true,
    message: 'Password updated successfully'
  });
});

// 2. Get All Employees List
app.get('/api/employees', (req, res) => {
  const db = loadDB();
  res.json(db.employees);
});

// 3. Add New Employee (Always AR Callers)
app.post('/api/employees', (req, res) => {
  const db = loadDB();
  const { name, id } = req.body;

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
    department: 'AR Callers',
    role: 'AR Caller',
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

  if (id === 'DBS-540' || id === 'DBS-327' || id === 'DBS-7569') {
    return res.status(400).json({ error: 'Cannot delete primary Admin accounts' });
  }

  const index = db.employees.findIndex(e => e.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  const deleted = db.employees.splice(index, 1)[0];
  saveDB(db);

  res.json({ success: true, deleted });
});

// 5. Get Attendance Records for a Specific Date (Saturday & Sunday Default Off)
app.get('/api/attendance', (req, res) => {
  const db = loadDB();
  const targetDate = req.query.date || new Date().toISOString().split('T')[0];

  const dateObj = new Date(targetDate + 'T00:00:00');
  const dayOfWeek = dateObj.getDay();
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

  const records = db.employees.map(emp => {
    const att = (db.attendance || []).find(a => a.employeeId === emp.id && a.date === targetDate);
    
    let status = att ? att.status : (isWeekend ? 'Holiday / Off' : 'Unmarked');

    return {
      employeeId: emp.id,
      name: emp.name,
      department: 'AR Callers',
      avatarColor: emp.avatarColor,
      date: targetDate,
      status,
      notes: att ? (att.notes || '') : (isWeekend ? 'Weekend Off' : '')
    };
  });

  res.json({
    date: targetDate,
    isWeekend,
    records
  });
});

// 6. Mark Single Employee Attendance (Present, Absent, Half Day, Holiday / Off)
app.post('/api/attendance/mark', (req, res) => {
  const db = loadDB();
  const { employeeId, date, status, notes } = req.body;

  if (!employeeId || !date || !status) {
    return res.status(400).json({ error: 'Employee ID, Date, and Status are required' });
  }

  const validStatuses = ['Present', 'Absent', 'Half Day', 'Holiday / Off', 'Unmarked'];
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
      department: 'AR Callers',
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
        department: 'AR Callers',
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
          department: 'AR Callers',
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
    let holidayOffCount = 0;

    empRecords.forEach(r => {
      if (r.status === 'Present') presentCount++;
      else if (r.status === 'Absent') absentCount++;
      else if (r.status === 'Half Day') halfDayCount++;
      else if (r.status === 'Holiday / Off' || r.status === 'On Leave') holidayOffCount++;
    });

    const totalDaysRecorded = empRecords.length;

    return {
      id: emp.id,
      name: emp.name,
      department: 'AR Callers',
      present: presentCount,
      absent: absentCount,
      halfDay: halfDayCount,
      holidayOff: holidayOffCount,
      totalRecorded: totalDaysRecorded
    };
  });

  let csv = '\uFEFF';
  csv += `AR Callers Monthly Attendance Summary - Month: ${monthQuery}\n`;
  csv += `Generated On: ${new Date().toLocaleString('en-US')}\n\n`;
  csv += `DBS ID,Employee Name,Department,Days Present,Days Absent,Half Days,Holiday / Off Days,Total Days Recorded\n`;

  summary.forEach(row => {
    const cleanName = `"${row.name.replace(/"/g, '""')}"`;
    csv += `${row.id},${cleanName},"AR Callers",${row.present},${row.absent},${row.halfDay},${row.holidayOff},${row.totalRecorded}\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=AR_Callers_Monthly_Attendance_${monthQuery}.csv`);
  res.send(csv);
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 AR Callers Attendance Portal running on port ${PORT}`);
  console.log(`👤 Primary Admin: 9704225352 / 9640000890`);
  console.log(`👤 Co-Admin: 7569258789 / Admin@123`);
  console.log(`====================================================`);
});
