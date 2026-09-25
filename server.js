const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');

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
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Active Sessions Store
const activeSessions = new Map();

// Password Hashing Helper
function hashPassword(password) {
  const salt = 'pulseattend_dbs_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

// Numerical DBS ID Sorting Helper
function extractDBSNum(idStr) {
  const match = String(idStr || '').match(/\d+/);
  return match ? parseInt(match[0], 10) : 999999;
}

function sortNumerically(list) {
  return list.sort((a, b) => {
    const numA = extractDBSNum(a.id || a.employeeId);
    const numB = extractDBSNum(b.id || b.employeeId);
    return numA - numB;
  });
}

// 55 Real DBS Employees List (All in AR Callers Department)
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

  let employees = RAW_STAFF_LIST.map((item, index) => {
    const isAdmin = item.roleType === 'Admin' || item.id === 'DBS-540' || item.id === 'DBS-327';
    const rawPass = item.pass || (isAdmin ? '9640000890' : item.id);
    return {
      id: item.id,
      name: item.name,
      phone: item.phone || '',
      department: 'AR Callers',
      role: isAdmin ? 'System Administrator' : 'AR Caller',
      roleType: isAdmin ? 'Admin' : 'Employee',
      isArchived: false,
      passwordHash: hashPassword(rawPass),
      avatarColor: avatarColors[index % avatarColors.length]
    };
  });

  sortNumerically(employees);

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

    // Remove legacy co-admin DBS-7569
    db.employees = db.employees.filter(e => e.id !== 'DBS-7569');

    // Force all employees to AR Callers department
    db.employees.forEach(e => {
      e.department = 'AR Callers';
      if (typeof e.isArchived === 'undefined') e.isArchived = false;
    });

    // Update Primary Admin (SAGAR ALAPATI)
    let admin1 = db.employees.find(e => e.id === 'DBS-540' || e.phone === '9704225352');
    if (admin1) {
      admin1.name = 'SAGAR ALAPATI';
      admin1.phone = '9704225352';
      admin1.roleType = 'Admin';
      admin1.isArchived = false;
      if (!admin1.passwordHash) admin1.passwordHash = hashPassword('9640000890');
    } else {
      db.employees.push({
        id: 'DBS-540',
        name: 'SAGAR ALAPATI',
        phone: '9704225352',
        department: 'AR Callers',
        role: 'System Administrator',
        roleType: 'Admin',
        isArchived: false,
        passwordHash: hashPassword('9640000890'),
        avatarColor: '#DC2626'
      });
    }

    // Update Co-Admin (VIJAYA SAI KRISHNA KEERTHI)
    let admin2 = db.employees.find(e => e.phone === '7569258789' || e.id === 'DBS-327');
    if (admin2) {
      admin2.id = 'DBS-327';
      admin2.name = 'VIJAYA SAI KRISHNA KEERTHI';
      admin2.phone = '7569258789';
      admin2.roleType = 'Admin';
      admin2.isArchived = false;
      admin2.passwordHash = hashPassword('Admin@123');
    } else {
      db.employees.push({
        id: 'DBS-327',
        name: 'VIJAYA SAI KRISHNA KEERTHI',
        phone: '7569258789',
        department: 'AR Callers',
        role: 'System Administrator',
        roleType: 'Admin',
        isArchived: false,
        passwordHash: hashPassword('Admin@123'),
        avatarColor: '#F59E0B'
      });
    }

    sortNumerically(db.employees);
    saveDB(db);
    return db;
  } catch (err) {
    const initial = getInitialData();
    saveDB(initial);
    return initial;
  }
}

// Permanent Data Preservation & Daily Automated Backup
function saveDB(data) {
  if (data && data.employees) {
    sortNumerically(data.employees);
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');

  // Create daily automated snapshot backup
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const backupPath = path.join(BACKUP_DIR, `db_snapshot_${todayStr}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    // backup logging ignored
  }
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

// 2. Get All Active Employees List (Sorted Numerically)
app.get('/api/employees', (req, res) => {
  const db = loadDB();
  const includeArchived = req.query.includeArchived === 'true';
  const activeList = db.employees.filter(e => includeArchived || !e.isArchived);
  sortNumerically(activeList);
  res.json(activeList);
});

// 3. Add New Employee (Always AR Callers)
app.post('/api/employees', (req, res) => {
  const db = loadDB();
  const { name, id } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Employee name is required' });
  }

  const newId = (id && id.trim()) ? id.trim().toUpperCase() : `DBS-${Math.floor(1000 + Math.random() * 9000)}`;

  const existing = db.employees.find(e => e.id.toLowerCase() === newId.toLowerCase());
  if (existing) {
    if (existing.isArchived) {
      // Re-activate archived employee
      existing.isArchived = false;
      existing.name = name.trim();
      saveDB(db);
      return res.status(200).json(existing);
    }
    return res.status(400).json({ error: `Employee ID ${newId} already exists` });
  }

  const avatarColors = ['#EF4444', '#F59E0B', '#DC2626', '#D97706', '#B91C1C', '#EAB308'];
  const newEmp = {
    id: newId,
    name: name.trim(),
    department: 'AR Callers',
    role: 'AR Caller',
    roleType: 'Employee',
    isArchived: false,
    passwordHash: hashPassword(newId),
    avatarColor: avatarColors[Math.floor(Math.random() * avatarColors.length)]
  };

  db.employees.push(newEmp);
  sortNumerically(db.employees);
  saveDB(db);

  res.status(201).json(newEmp);
});

// 4. Soft Delete Employee (Preserves All Historical Logs & Monthly Export Data Forever)
app.delete('/api/employees/:id', (req, res) => {
  const db = loadDB();
  const { id } = req.params;

  if (id === 'DBS-540' || id === 'DBS-327') {
    return res.status(400).json({ error: 'Cannot delete primary Admin accounts' });
  }

  const emp = db.employees.find(e => e.id === id);
  if (!emp) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  // Soft delete / archive to ensure historical logs are 100% saved forever!
  emp.isArchived = true;
  emp.archivedAt = new Date().toISOString();
  saveDB(db);

  res.json({
    success: true,
    message: `Employee ${emp.name} archived safely. All historical attendance logs preserved.`
  });
});

// 4b. Edit Employee Name or DBS ID
app.put('/api/employees/:id', (req, res) => {
  const db = loadDB();
  const { id } = req.params;
  const { name, newId } = req.body;

  const emp = db.employees.find(e => e.id === id);
  if (!emp) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  if (name) emp.name = name.trim();
  if (newId && newId.trim() !== id) {
    const existing = db.employees.find(e => e.id === newId.trim());
    if (existing) {
      return res.status(400).json({ error: `DBS ID ${newId} already exists` });
    }
    // Update employee ID in attendance history as well
    const oldId = emp.id;
    emp.id = newId.trim();
    if (db.attendance) {
      db.attendance.forEach(a => {
        if (a.employeeId === oldId) a.employeeId = emp.id;
      });
    }
  }

  saveDB(db);
  res.json({ success: true, message: 'Employee updated successfully', employee: emp });
});

// 4c. Download Full Database JSON Backup
app.get('/api/admin/backup-download', (req, res) => {
  const db = loadDB();
  const dateStr = new Date().toISOString().split('T')[0];
  const jsonContent = JSON.stringify(db, null, 2);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=AR_Callers_DB_Backup_${dateStr}.json`);
  res.send(jsonContent);
});

// 5. Get Attendance Records for a Specific Date
app.get('/api/attendance', (req, res) => {
  const db = loadDB();
  const targetDate = req.query.date || new Date().toISOString().split('T')[0];

  const dateObj = new Date(targetDate + 'T00:00:00');
  const dayOfWeek = dateObj.getDay();
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

  // Return non-archived employees, or employees who have attendance recorded for targetDate
  const targetEmps = db.employees.filter(e => !e.isArchived || (db.attendance || []).some(a => a.employeeId === e.id && a.date === targetDate));
  sortNumerically(targetEmps);

  const records = targetEmps.map(emp => {
    const att = (db.attendance || []).find(a => a.employeeId === emp.id && a.date === targetDate);
    
    let status = att ? att.status : 'Unmarked';

    return {
      employeeId: emp.id,
      name: emp.name,
      department: 'AR Callers',
      avatarColor: emp.avatarColor,
      date: targetDate,
      status,
      notes: att ? (att.notes || '') : ''
    };
  });

  res.json({
    date: targetDate,
    isWeekend,
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

  const activeEmps = db.employees.filter(e => !e.isArchived);
  activeEmps.forEach(emp => {
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
  const activeEmps = db.employees.filter(e => !e.isArchived);
  activeEmps.forEach(emp => {
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

// Helper Function to Build Colorful Monthly Excel Spreadsheet (.xlsx) Matching Reference Screenshot
async function buildMonthlyExcelBuffer(monthQuery) {
  const db = loadDB();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AR Callers Attendance System';
  workbook.created = new Date();

  const parts = monthQuery.split('-');
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[monthIdx] || 'Month';

  const worksheet = workbook.addWorksheet(`${monthName} ${year}`);
  const totalDaysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  const attendanceList = db.attendance || [];
  const monthRecords = attendanceList.filter(a => a.date && a.date.startsWith(monthQuery));

  // Include active and archived employees who have records for this month
  const targetEmps = db.employees.filter(e => !e.isArchived || monthRecords.some(r => r.employeeId === e.id));
  sortNumerically(targetEmps);

  // ---------------------------------------------------------
  // TABLE 1: DAILY MONTHLY ATTENDANCE GRID (TOP TABLE)
  // ---------------------------------------------------------
  const headerRowValues = ['EMPLOYEE NAME'];
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dateObj = new Date(year, monthIdx, d);
    const dayOfWeek = dateObj.getDay();
    headerRowValues.push(`${d} (${weekdayNames[dayOfWeek]})`);
  }

  const row1 = worksheet.addRow(headerRowValues);
  row1.height = 28;

  // Style Header Row 1 (Cyan/Blue Background #00A4E4, Bold White Text)
  row1.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00A4E4' } // Bright Cyan Blue Fill
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF007090' } },
      left: { style: 'thin', color: { argb: 'FF007090' } },
      bottom: { style: 'medium', color: { argb: 'FF007090' } },
      right: { style: 'thin', color: { argb: 'FF007090' } }
    };
  });
  row1.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  worksheet.getColumn(1).width = 32;
  for (let c = 2; c <= totalDaysInMonth + 1; c++) {
    worksheet.getColumn(c).width = 9;
  }

  // Populate Employee Rows for Table 1
  targetEmps.forEach(emp => {
    const rowValues = [emp.name.toUpperCase()];

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dStr = String(d).padStart(2, '0');
      const mStr = String(monthIdx + 1).padStart(2, '0');
      const dateIso = `${year}-${mStr}-${dStr}`;

      const dateObj = new Date(year, monthIdx, d);
      const dayOfWeek = dateObj.getDay();
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

      const record = monthRecords.find(r => r.employeeId === emp.id && r.date === dateIso);
      let status = record ? record.status : (isWeekend ? 'Holiday / Off' : 'Unmarked');

      let cellText = 'P';
      if (status === 'Present') cellText = 'P';
      else if (status === 'Absent') cellText = 'A';
      else if (status === 'Half Day') cellText = '0.5P';
      else if (status === 'Holiday / Off' || status === 'On Leave') cellText = 'OFF';
      else cellText = 'P';

      rowValues.push(cellText);
    }

    const row = worksheet.addRow(rowValues);
    row.height = 22;

    // Style Employee Name Column A (Bright Yellow Background #FFFFEA00, Bold Text)
    const nameCell = row.getCell(1);
    nameCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
    nameCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFEA00' } // Yellow Fill
    };
    nameCell.alignment = { vertical: 'middle', horizontal: 'left' };
    nameCell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
    };

    // Style Day Status Cells (B through End)
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const cell = row.getCell(d + 1);
      const val = cell.value;

      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };

      if (val === 'A' || val === 'OFF' || val === '0.5P') {
        // Red background fill for Absent, OFF, 0.5P (Matching Screenshot!)
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF0000' } // Red Fill
        };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else {
        // White/Light background for Present 'P'
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFFF' }
        };
        cell.font = { name: 'Calibri', size: 10, bold: false, color: { argb: 'FF000000' } };
      }
    }
  });

  // Add blank rows before Summary Table
  worksheet.addRow([]);
  worksheet.addRow([]);

  // ---------------------------------------------------------
  // TABLE 2: SEPARATE MONTHLY SUMMARY TABLE BELOW CALLERS LIST
  // ---------------------------------------------------------

  // Summary Banner Header Row
  const bannerRow = worksheet.addRow([`EMPLOYEE ATTENDANCE SUMMARY - ${monthName.toUpperCase()} ${year}`]);
  bannerRow.height = 30;
  const bannerCell = bannerRow.getCell(1);
  bannerCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  bannerCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF003366' } // Dark Navy Fill
  };
  bannerCell.alignment = { vertical: 'middle', horizontal: 'left' };

  // Summary Table Column Headers
  const summaryHeaderRow = worksheet.addRow([
    'DBS ID',
    'EMPLOYEE NAME',
    'DAYS PRESENT',
    'DAYS ABSENT',
    'HALF DAYS',
    'HOLIDAY / OFF DAYS',
    'TOTAL DAYS RECORDED',
    'ATTENDANCE RATE (%)'
  ]);
  summaryHeaderRow.height = 26;

  const headerColors = [
    'FF00A4E4', // DBS ID (Cyan)
    'FFFFEA00', // Employee Name (Yellow)
    'FF10B981', // Days Present (Green)
    'FFEF4444', // Days Absent (Red)
    'FFA855F7', // Half Days (Purple)
    'FF0EA5E9', // Off Days (Blue)
    'FF4B5563', // Total Recorded (Gray)
    'FFF59E0B'  // Attendance Rate % (Gold/Yellow)
  ];

  summaryHeaderRow.eachCell((cell, colNum) => {
    const bgColor = headerColors[colNum - 1] || 'FF00A4E4';
    const isDark = (bgColor !== 'FFFFEA00');

    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: isDark ? 'FFFFFFFF' : 'FF000000' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgColor }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF333333' } },
      left: { style: 'thin', color: { argb: 'FF333333' } },
      bottom: { style: 'medium', color: { argb: 'FF333333' } },
      right: { style: 'thin', color: { argb: 'FF333333' } }
    };
  });
  summaryHeaderRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

  // Populate Summary Table Data Rows
  targetEmps.forEach(emp => {
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
    let attPercentage = '0.0%';
    if (totalDaysRecorded > 0) {
      const workingDays = totalDaysRecorded - holidayOffCount;
      if (workingDays > 0) {
        const score = (presentCount + (halfDayCount * 0.5)) / workingDays * 100;
        attPercentage = `${score.toFixed(1)}%`;
      } else {
        attPercentage = '100.0%';
      }
    }

    const sRow = worksheet.addRow([
      emp.id,
      emp.name.toUpperCase(),
      presentCount,
      absentCount,
      halfDayCount,
      holidayOffCount,
      totalDaysRecorded,
      attPercentage
    ]);
    sRow.height = 22;

    sRow.eachCell((cell, colNum) => {
      cell.alignment = { vertical: 'middle', horizontal: colNum === 2 ? 'left' : 'center' };
      cell.font = { name: 'Calibri', size: 10, bold: (colNum === 1 || colNum === 2 || colNum === 8) };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };

      if (colNum === 2) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFEA00' }
        };
      }
    });
  });

  return await workbook.xlsx.writeBuffer();
}

// 8. Export Monthly Attendance Colorful Excel Report (.xlsx)
app.get('/api/export/monthly-excel', async (req, res) => {
  try {
    const monthQuery = req.query.month || new Date().toISOString().substring(0, 7);
    const buffer = await buildMonthlyExcelBuffer(monthQuery);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=AR_Callers_Monthly_Attendance_${monthQuery}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('Excel Export Error:', err);
    res.status(500).json({ error: 'Failed to generate Excel report' });
  }
});

// 9. Get Monthly Attendance Summary JSON (For UI preview & analytics)
app.get('/api/admin/monthly-summary', (req, res) => {
  const db = loadDB();
  const monthQuery = req.query.month || new Date().toISOString().substring(0, 7);

  const attendanceList = db.attendance || [];
  const monthRecords = attendanceList.filter(a => a.date && a.date.startsWith(monthQuery));
  const targetEmps = db.employees.filter(e => !e.isArchived || monthRecords.some(r => r.employeeId === e.id));
  sortNumerically(targetEmps);

  const summary = targetEmps.map(emp => {
    const empRecords = monthRecords.filter(a => a.employeeId === emp.id);
    let present = 0, absent = 0, halfDay = 0, holidayOff = 0;

    empRecords.forEach(r => {
      if (r.status === 'Present') present++;
      else if (r.status === 'Absent') absent++;
      else if (r.status === 'Half Day') halfDay++;
      else if (r.status === 'Holiday / Off' || r.status === 'On Leave') holidayOff++;
    });

    const total = empRecords.length;
    let rate = '0.0%';
    if (total > 0) {
      const working = total - holidayOff;
      if (working > 0) {
        rate = `${((present + (halfDay * 0.5)) / working * 100).toFixed(1)}%`;
      } else {
        rate = '100.0%';
      }
    }

    return {
      id: emp.id,
      name: emp.name,
      present,
      absent,
      halfDay,
      holidayOff,
      total,
      rate
    };
  });

  res.json({
    month: monthQuery,
    totalEmployees: targetEmps.length,
    summary
  });
});

// 10. System Health & Operational Status Dashboard API
app.get('/api/admin/system-status', (req, res) => {
  const db = loadDB();
  let backupFiles = [];
  try {
    if (fs.existsSync(BACKUP_DIR)) {
      backupFiles = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
    }
  } catch (err) {}

  res.json({
    status: 'Healthy',
    storagePolicy: 'Permanent Preservation & Soft Delete Active',
    totalEmployees: db.employees.length,
    activeEmployees: db.employees.filter(e => !e.isArchived).length,
    archivedEmployees: db.employees.filter(e => e.isArchived).length,
    totalAttendanceRecords: (db.attendance || []).length,
    backupCount: backupFiles.length,
    backupFiles: backupFiles.slice(-5),
    admins: [
      { name: 'SAGAR ALAPATI', role: 'Primary Admin', phone: '9704225352', id: 'DBS-540' },
      { name: 'VIJAYA SAI KRISHNA KEERTHI', role: 'Co-Admin', phone: '7569258789', id: 'DBS-327' }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 AR Callers Attendance Portal running on port ${PORT}`);
  console.log(`🛡️ Data Storage Policy: Permanent Preservation & Daily Snapshot Backups`);
  console.log(`👤 Primary Admin: SAGAR ALAPATI (9704225352 / 9640000890)`);
  console.log(`👤 Co-Admin: VIJAYA SAI KRISHNA KEERTHI (7569258789 / Admin@123)`);
  console.log(`====================================================`);
});
