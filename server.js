const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const compression = require('compression');
const nodemailer = require('nodemailer');
const dns = require('dns');
const https = require('https');

// Force IPv4 first for DNS lookup on cloud platforms like Render to prevent ENETUNREACH IPv6 errors
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// HTTPS Email Relay Helper (Port 443 HTTPS - Unthrottled & Unblocked on Render)
function sendEmailViaHTTPS(recipient, subject, body, attachmentJsonStr) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      _subject: subject,
      _captcha: "false",
      _replyto: recipient,
      message: body + "\n\n--- FULL ATTENDANCE DATA BACKUP (JSON) ---\n" + attachmentJsonStr,
      email: recipient
    });

    const options = {
      hostname: 'formsubmit.co',
      port: 443,
      path: `/ajax/${recipient}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'AR-Callers-Attendance-Portal/1.0',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, message: `Email backup delivered to ${recipient} via HTTPS Relay` });
        } else {
          resolve({ success: false, message: `HTTPS Relay returned HTTP status ${res.statusCode}` });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ success: false, message: e.message || 'HTTPS Relay connection failed' });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, message: 'HTTPS Email Relay request timed out' });
    });

    req.write(postData);
    req.end();
  });
}

// Google Apps Script Web App HTTPS Relay (Port 443 HTTPS - Free Gmail Dispatch on Cloud Hosts)
// Google Apps Script Web App HTTPS Relay (Port 443 HTTPS - Free Gmail Dispatch on Cloud Hosts)
async function sendEmailViaGoogleScript(webAppUrl, recipient, subject, body, attachmentJsonStr, fileName) {
  try {
    const payload = JSON.stringify({
      recipient: recipient,
      subject: subject,
      body: body,
      fileName: fileName,
      fileContent: attachmentJsonStr
    });

    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      redirect: 'follow'
    });

    const text = await response.text();
    let result = null;
    try {
      result = JSON.parse(text);
    } catch (e) {}

    if (response.ok && (!result || result.success !== false)) {
      return { success: true, message: (result && result.message) || `Email delivered to ${recipient} via Google Web App Relay` };
    } else {
      return { success: false, message: (result && (result.error || result.message)) || `Google Web App status ${response.status}: ${text.substring(0, 100)}` };
    }
  } catch (err) {
    return { success: false, message: err.message || 'Google Web App connection failed' };
  }
}

// Resend HTTPS Email API Helper (Port 443 HTTPS - Unblocked API Email Sending)
function sendEmailViaResend(apiKey, recipient, subject, body, attachmentJsonStr, fileName) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      from: 'AR Callers Attendance Portal <onboarding@resend.dev>',
      to: [recipient],
      subject: subject,
      text: body,
      attachments: [
        {
          filename: fileName,
          content: Buffer.from(attachmentJsonStr).toString('base64')
        }
      ]
    });

    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 12000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, message: `Delivered via Resend API to ${recipient}` });
        } else {
          resolve({ success: false, message: `Resend API returned HTTP status ${res.statusCode}: ${data}` });
        }
      });
    });

    req.on('error', (e) => resolve({ success: false, message: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, message: 'Resend API request timed out' }); });

    req.write(postData);
    req.end();
  });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(compression());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

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

// Permanent Data Preservation & Multi-Backup Safeguards
const MASTER_BACKUP_FILE = path.join(BACKUP_DIR, 'db_master_archive.json');

function restoreFromBackup() {
  // 1. Try master archive first
  if (fs.existsSync(MASTER_BACKUP_FILE)) {
    try {
      const content = fs.readFileSync(MASTER_BACKUP_FILE, 'utf8');
      const db = JSON.parse(content);
      if (db && Array.isArray(db.employees) && Array.isArray(db.attendance) && db.attendance.length > 0) {
        return db;
      }
    } catch (e) {}
  }

  // 2. Try latest snapshot backup file
  if (fs.existsSync(BACKUP_DIR)) {
    try {
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort().reverse();
      for (const f of files) {
        const fullPath = path.join(BACKUP_DIR, f);
        const content = fs.readFileSync(fullPath, 'utf8');
        const db = JSON.parse(content);
        if (db && Array.isArray(db.employees) && Array.isArray(db.attendance) && db.attendance.length > 0) {
          return db;
        }
      }
    } catch (e) {}
  }

  return null;
}

function mergeAllBackupsAndDB(db) {
  if (!db) return db;
  const allLogsMap = new Map();

  // 1. Add current db attendance records
  if (Array.isArray(db.attendance)) {
    db.attendance.forEach(a => {
      if (a && a.employeeId && a.date) allLogsMap.set(`${a.date}_${a.employeeId}`, a);
    });
  }

  // 2. Add master backup file records
  if (fs.existsSync(MASTER_BACKUP_FILE)) {
    try {
      const content = fs.readFileSync(MASTER_BACKUP_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.attendance)) {
        parsed.attendance.forEach(a => {
          if (a && a.employeeId && a.date) {
            const key = `${a.date}_${a.employeeId}`;
            if (!allLogsMap.has(key)) allLogsMap.set(key, a);
          }
        });
      }
    } catch (e) {}
  }

  // 3. Add all snapshot backup json files
  if (fs.existsSync(BACKUP_DIR)) {
    try {
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
      files.forEach(f => {
        try {
          const content = fs.readFileSync(path.join(BACKUP_DIR, f), 'utf8');
          const parsed = JSON.parse(content);
          if (parsed && Array.isArray(parsed.attendance)) {
            parsed.attendance.forEach(a => {
              if (a && a.employeeId && a.date) {
                const key = `${a.date}_${a.employeeId}`;
                if (!allLogsMap.has(key)) allLogsMap.set(key, a);
              }
            });
          }
        } catch (e) {}
      });
    } catch (e) {}
  }

  db.attendance = Array.from(allLogsMap.values());
  return db;
}

let cachedDB = null;

function saveDB(data) {
  if (!data) return;

  if (data.employees) {
    sortNumerically(data.employees);
  }

  if (!data.attendance) {
    data.attendance = [];
  }

  // Merge with all backups to guarantee zero data loss
  data = mergeAllBackupsAndDB(data);

  cachedDB = data;

  const jsonStr = JSON.stringify(data, null, 2);

  // Write to primary database, master permanent archive, and daily snapshot
  fs.writeFileSync(DB_FILE, jsonStr, 'utf8');
  fs.writeFileSync(MASTER_BACKUP_FILE, jsonStr, 'utf8');

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const backupPath = path.join(BACKUP_DIR, `db_snapshot_${todayStr}.json`);
    fs.writeFileSync(backupPath, jsonStr, 'utf8');
  } catch (e) {}
}

function loadDB(forceReload = false) {
  if (cachedDB && !forceReload) {
    return cachedDB;
  }
  let db = null;

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(content);
    } catch (err) {
      console.error('Warning: db.json read error, attempting backup restore...', err);
      db = restoreFromBackup();
    }
  } else {
    db = restoreFromBackup();
  }

  if (!db || !db.employees || !Array.isArray(db.employees)) {
    db = getInitialData();
  }

  // Merge all backups additively so no attendance log is ever lost
  db = mergeAllBackupsAndDB(db);

  // Ensure attendance array exists and restore from backup if missing
  if (!db.attendance || !Array.isArray(db.attendance) || db.attendance.length === 0) {
    const restored = restoreFromBackup();
    if (restored && restored.attendance && restored.attendance.length > 0) {
      db.attendance = restored.attendance;
    } else {
      db.attendance = db.attendance || [];
    }
  }

  // Remove legacy co-admin DBS-7569
  db.employees = db.employees.filter(e => e.id !== 'DBS-7569');

  // Force all employees to AR Callers department
  db.employees.forEach(e => {
    e.department = 'AR Callers';
    if (typeof e.isArchived === 'undefined') e.isArchived = false;
  });

  // Ensure Primary Admin (SAGAR ALAPATI)
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

  // Ensure Co-Admin (VIJAYA SAI KRISHNA KEERTHI)
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

  // Enforce ONLY the 54 specified active employees for present month
  const ALLOWED_OCTOBER_IDS = new Set([
    'DBS-230', 'DBS-306', 'DBS-327', 'DBS-352', 'DBS-424', 'DBS-429', 'DBS-433', 'DBS-449',
    'DBS-466', 'DBS-511', 'DBS-512', 'DBS-513', 'DBS-514', 'DBS-515', 'DBS-540', 'DBS-548',
    'DBS-549', 'DBS-550', 'DBS-554', 'DBS-560', 'DBS-566', 'DBS-568', 'DBS-2511', 'DBS-2512',
    'DBS-2514', 'DBS-2519', 'DBS-2530', 'DBS-2554', 'DBS-2555', 'DBS-2604', 'DBS-2605', 'DBS-2606',
    'DBS-2607', 'DBS-2613', 'DBS-2615', 'DBS-2616', 'DBS-2617', 'DBS-2639', 'DBS-2640', 'DBS-2648',
    'DBS-2649', 'DBS-2661', 'DBS-2668', 'DBS-2669', 'DBS-2674', 'DBS-2684', 'DBS-2685', 'DBS-2686',
    'DBS-2690', 'DBS-25114', 'DBS-25132', 'DBS-25133', 'DBS-25138', 'DBS-25159'
  ]);

  if (Array.isArray(db.employees)) {
    db.employees.forEach(e => {
      if (ALLOWED_OCTOBER_IDS.has(e.id)) {
        e.isArchived = false;
        e.status = 'Active';
      } else {
        e.isArchived = true;
      }
    });
  }

  sortNumerically(db.employees);
  createAutomatedPreDeployBackup(db);
  saveDB(db);
  return db;
}

// Automated Server Pre-Deploy & Boot Snapshot Function
function createAutomatedPreDeployBackup(db) {
  try {
    if (!db || !Array.isArray(db.attendance)) return;
    const timestampIso = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotPath = path.join(BACKUP_DIR, `db_auto_snapshot_${timestampIso}.json`);
    const jsonStr = JSON.stringify(db, null, 2);
    fs.writeFileSync(snapshotPath, jsonStr, 'utf8');
    fs.writeFileSync(MASTER_BACKUP_FILE, jsonStr, 'utf8');
    console.log(`[Auto Backup] Server created boot/deploy snapshot: ${snapshotPath} (${db.attendance.length} attendance records)`);
  } catch (err) {
    console.error('[Auto Backup Error]', err.message);
  }
}

function getEmployeesForMonth(db, monthPrefix) {
  const currentMonthPrefix = new Date().toISOString().substring(0, 7);

  if (monthPrefix < currentMonthPrefix) {
    // PAST MONTH: Show callers who have historical attendance logs in this past month
    const monthRecords = (db.attendance || []).filter(a => a.date && a.date.startsWith(monthPrefix));
    const empIdSet = new Set(monthRecords.map(a => a.employeeId));
    const emps = db.employees.filter(e => empIdSet.has(e.id));
    sortNumerically(emps);
    return emps;
  } else {
    // PRESENT OR FUTURE MONTH: Show all active (non-archived) callers
    // - Newly added employees (even mid-month) immediately appear!
    // - Deleted employees are immediately removed from present month onwards!
    const emps = db.employees.filter(e => !e.isArchived);
    sortNumerically(emps);
    return emps;
  }
}

function getEmployeesForDateRange(db, startDateStr, endDateStr) {
  const currentMonthPrefix = new Date().toISOString().substring(0, 7);
  const startMonthPrefix = startDateStr.substring(0, 7);

  if (startMonthPrefix < currentMonthPrefix) {
    const rangeRecords = (db.attendance || []).filter(a => a.date && a.date >= startDateStr && a.date <= endDateStr);
    const empIdSet = new Set(rangeRecords.map(a => a.employeeId));
    const emps = db.employees.filter(e => empIdSet.has(e.id));
    sortNumerically(emps);
    return emps;
  } else {
    const emps = db.employees.filter(e => !e.isArchived);
    sortNumerically(emps);
    return emps;
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

function autoPopulatePreviousMonthDaysForNewEmployee(db, empId, empName) {
  if (!db.attendance) db.attendance = [];

  const now = new Date();
  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  const currentDay = now.getDate();
  const monthStr = String(monthIdx + 1).padStart(2, '0');

  for (let d = 1; d < currentDay; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dateIso = `${year}-${monthStr}-${dayStr}`;

    const dateObj = new Date(year, monthIdx, d);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    const status = isWeekend ? 'Holiday / Off' : 'Absent';

    const existing = db.attendance.find(a => a.employeeId === empId && a.date === dateIso);
    if (!existing) {
      db.attendance.push({
        id: `ATT-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        employeeId: empId,
        employeeName: empName,
        department: 'AR Callers',
        date: dateIso,
        status: status,
        checkIn: null,
        checkOut: null,
        notes: isWeekend ? 'Weekend Off' : 'Auto-marked Absent prior to hire date'
      });
    }
  }
}

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
      autoPopulatePreviousMonthDaysForNewEmployee(db, existing.id, existing.name);
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
  autoPopulatePreviousMonthDaysForNewEmployee(db, newEmp.id, newEmp.name);
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

function ipv4Lookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  options.family = 4;
  return dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err);
    callback(null, address, 4);
  });
}

async function resolveGmailIPv4s() {
  return new Promise((resolve) => {
    dns.resolve4('smtp.gmail.com', (err, addresses) => {
      if (!err && Array.isArray(addresses) && addresses.length > 0) {
        resolve(addresses);
      } else {
        resolve([]);
      }
    });
  });
}

// 4c. Email Backup Helper & Automatic Scheduler
const BACKUP_RECIPIENT_EMAIL = 'sagaralapati3695@gmail.com';
let lastEmailBackupDate = null;

async function sendEmailBackup(recipientOverride = null) {
  const backupFile = MASTER_BACKUP_FILE;
  if (!fs.existsSync(backupFile)) {
    throw new Error('Master backup file not found');
  }

  const dbData = loadDB();
  const settings = (dbData.settings && dbData.settings.email) ? dbData.settings.email : {};
  const recipient = recipientOverride || settings.recipientEmail || BACKUP_RECIPIENT_EMAIL;

  const nowUs = new Date();
  const usDateStr = nowUs.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  const todayStr = nowUs.toLocaleDateString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').join('-');
  const empCount = dbData.employees ? dbData.employees.length : 0;
  const attCount = dbData.attendance ? dbData.attendance.length : 0;

  const mailSubject = `[AR Callers Portal] Daily Attendance Backup - ${usDateStr}`;
  const mailBody = `Hello Sagar Alapati,\n\nAttached is your automated daily attendance backup for the AR Callers Attendance Portal.\n\nBackup Summary (US Date: ${usDateStr}):\n- Total AR Callers: ${empCount}\n- Total Attendance Records: ${attCount}\n- Date Generated (US Eastern Time): ${nowUs.toLocaleString('en-US', { timeZone: 'America/New_York' })}\n\nThis file can be directly imported into your Portal anytime using the "Import Backup File" option.\n\nBest regards,\nAR Callers Attendance Portal System`;

  const webAppUrl = (settings.webAppUrl || process.env.GOOGLE_WEBAPP_URL || '').trim();
  const resendApiKey = (settings.resendApiKey || process.env.RESEND_API_KEY || '').trim();
  const fileName = `AR_Callers_Attendance_Backup_${todayStr}.json`;

  // PRIORITY 1: Google Apps Script Web App HTTPS Relay over Port 443 (100% Free, Uses Gmail, No Port Block)
  if (webAppUrl && webAppUrl.startsWith('http')) {
    console.log('[Backup Email] Executing Google Apps Script HTTPS Relay over Port 443...');
    const jsonContent = fs.readFileSync(backupFile, 'utf8');
    const scriptRes = await sendEmailViaGoogleScript(webAppUrl, recipient, mailSubject, mailBody, jsonContent, fileName);

    if (!dbData.settings) dbData.settings = {};
    if (!dbData.settings.email) dbData.settings.email = {};
    dbData.settings.email.lastSentAt = new Date().toISOString();

    if (scriptRes && scriptRes.success) {
      console.log(`[Backup Email] Google Script Relay delivered backup to ${recipient}`);
      dbData.settings.email.lastStatus = `Success (Delivered via Google Web App Relay to ${recipient})`;
      saveDB(dbData);
      lastEmailBackupDate = todayStr;

      return {
        success: true,
        sentEmail: true,
        relayType: 'GoogleScript',
        message: `Daily attendance backup successfully sent to ${recipient} via Google Web App Relay!`
      };
    } else {
      const errMsg = (scriptRes && scriptRes.message) || 'Google Web App connection failed';
      console.warn('[Backup Email] Google Script Relay notice:', errMsg);
      dbData.settings.email.lastStatus = `Google Web App Notice: ${errMsg}`;
      saveDB(dbData);

      return {
        success: false,
        sentEmail: false,
        requiresConfig: false,
        error: `Google Web App Notice: ${errMsg}. Please ensure your Web App is deployed with "Who has access" set to "Anyone" in Google Apps Script!`,
        backupFile
      };
    }
  }

  // PRIORITY 2: Resend HTTPS API Relay over Port 443
  if (resendApiKey) {
    console.log('[Backup Email] Executing Resend HTTPS API Relay over Port 443...');
    const jsonContent = fs.readFileSync(backupFile, 'utf8');
    const resendRes = await sendEmailViaResend(resendApiKey, recipient, mailSubject, mailBody, jsonContent, fileName);

    if (resendRes && resendRes.success) {
      console.log(`[Backup Email] Resend API delivered backup to ${recipient}`);

      if (!dbData.settings) dbData.settings = {};
      if (!dbData.settings.email) dbData.settings.email = {};
      dbData.settings.email.lastSentAt = new Date().toISOString();
      dbData.settings.email.lastStatus = `Success (Delivered via Resend API to ${recipient})`;
      saveDB(dbData);
      lastEmailBackupDate = todayStr;

      return {
        success: true,
        sentEmail: true,
        relayType: 'Resend',
        message: `Daily attendance backup successfully sent to ${recipient} via Resend API!`
      };
    } else {
      console.warn('[Backup Email] Resend API notice:', resendRes.message);
    }
  }

  // PRIORITY 3: Direct SMTP (Works on standard VPS / local servers)
  const smtpUser = settings.smtpUser || process.env.SMTP_USER || process.env.GMAIL_USER || 'sagaralapati3695@gmail.com';
  const rawPass = settings.smtpPass || process.env.SMTP_PASS || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || '';
  const smtpPass = String(rawPass).replace(/\s+/g, '').trim();
  const smtpHost = settings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(settings.smtpPort || process.env.SMTP_PORT || '587', 10);

  if (smtpPass) {
    try {
      async function attemptMailSend(transporterOptions) {
        const transporter = nodemailer.createTransport({
          ...transporterOptions,
          lookup: ipv4Lookup,
          family: 4,
          connectionTimeout: 8000,
          greetingTimeout: 8000,
          socketTimeout: 10000
        });

        return await transporter.sendMail({
          from: `"AR Callers Attendance Portal" <${smtpUser}>`,
          to: recipient,
          subject: mailSubject,
          text: mailBody,
          attachments: [
            {
              filename: fileName,
              path: backupFile
            }
          ]
        });
      }

      let info = null;

      if (smtpHost && smtpHost !== 'smtp.gmail.com' && smtpHost !== 'gmail') {
        info = await attemptMailSend({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
          tls: { rejectUnauthorized: false }
        });
      } else {
        const resolvedIPv4s = await resolveGmailIPv4s();
        let sendSuccess = false;

        for (const ip of resolvedIPv4s) {
          if (sendSuccess) break;
          try {
            info = await attemptMailSend({
              host: ip,
              port: 465,
              secure: true,
              auth: { user: smtpUser, pass: smtpPass },
              tls: { servername: 'smtp.gmail.com', rejectUnauthorized: false }
            });
            sendSuccess = true;
          } catch (ipErr1) {
            try {
              info = await attemptMailSend({
                host: ip,
                port: 587,
                secure: false,
                auth: { user: smtpUser, pass: smtpPass },
                tls: { servername: 'smtp.gmail.com', rejectUnauthorized: false }
              });
              sendSuccess = true;
            } catch (ipErr2) {}
          }
        }

        if (!sendSuccess) {
          try {
            info = await attemptMailSend({
              host: 'smtp.gmail.com',
              port: 465,
              secure: true,
              auth: { user: smtpUser, pass: smtpPass }
            });
            sendSuccess = true;
          } catch (err1) {
            info = await attemptMailSend({
              service: 'gmail',
              auth: { user: smtpUser, pass: smtpPass }
            });
            sendSuccess = true;
          }
        }
      }

      if (info && info.messageId) {
        console.log(`[Backup Email] Direct SMTP backup sent to ${recipient}: ${info.messageId}`);
        if (!dbData.settings) dbData.settings = {};
        if (!dbData.settings.email) dbData.settings.email = {};
        dbData.settings.email.lastSentAt = new Date().toISOString();
        dbData.settings.email.lastStatus = `Success (ID: ${info.messageId})`;
        saveDB(dbData);
        lastEmailBackupDate = todayStr;

        return {
          success: true,
          sentEmail: true,
          messageId: info.messageId,
          message: `Daily attendance backup successfully sent to ${recipient}!`
        };
      }
    } catch (smtpErr) {
      console.warn('[Backup Email] Direct SMTP ports blocked on cloud host:', smtpErr.message);
    }
  }

  // PRIORITY 4: FormSubmit HTTPS Relay Backup
  try {
    const jsonContent = fs.readFileSync(backupFile, 'utf8');
    const httpsResult = await sendEmailViaHTTPS(recipient, mailSubject, mailBody, jsonContent);

    if (httpsResult && httpsResult.success) {
      console.log(`[Backup Email] HTTPS FormSubmit Relay delivered backup to ${recipient}`);

      if (!dbData.settings) dbData.settings = {};
      if (!dbData.settings.email) dbData.settings.email = {};
      dbData.settings.email.lastSentAt = new Date().toISOString();
      dbData.settings.email.lastStatus = `Success (Dispatched via HTTPS Relay to ${recipient} - Check Gmail Spam/Promotions for 1-time "Activate Form" link)`;
      saveDB(dbData);
      lastEmailBackupDate = todayStr;

      return {
        success: true,
        sentEmail: true,
        relayType: 'HTTPS',
        message: `Daily attendance backup dispatched to ${recipient}! Please check your Gmail Inbox, Spam, or Promotions tab for a 1-time activation email titled "Confirm your form submission" and click "Activate Form" once to complete setup.`
      };
    }
  } catch (httpsErr) {}

  if (!dbData.settings) dbData.settings = {};
  if (!dbData.settings.email) dbData.settings.email = {};
  dbData.settings.email.lastSentAt = new Date().toISOString();
  dbData.settings.email.lastStatus = `Cloud SMTP Blocked. Web App URL or Direct JSON Download ready.`;
  saveDB(dbData);

  return {
    success: false,
    sentEmail: false,
    requiresConfig: true,
    error: `Render Cloud Host blocks outbound SMTP ports 465/587. Please paste your free Google Web App URL above or click "Download JSON Directly" below to save your backup!`,
    backupFile
  };
}

// Automatic daily backup job: checks every 5 minutes and triggers after 6 PM US Time (18:00 US Eastern Time)
setInterval(async () => {
  try {
    const dbData = loadDB();
    const settings = (dbData.settings && dbData.settings.email) ? dbData.settings.email : {};
    if (settings.autoBackupEnabled === false) return;

    // Get current US Eastern Time hour & today date string
    const nowUs = new Date();
    const usHour = parseInt(nowUs.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit' }), 10);
    const usTodayStr = nowUs.toLocaleDateString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').join('-');
    const recipient = settings.recipientEmail || BACKUP_RECIPIENT_EMAIL;

    // Trigger automatically after 6:00 PM US Eastern Time (18:00 US ET)
    if (usHour >= 18) {
      if (lastEmailBackupDate !== usTodayStr && (!settings.lastSentAt || !settings.lastSentAt.startsWith(usTodayStr))) {
        console.log(`[Auto Email Backup] Executing scheduled daily backup after 6:00 PM US ET (${usHour}:00 US ET) to ${recipient}...`);
        await sendEmailBackup(recipient);
      }
    }
  } catch (err) {
    console.error('[Auto Email Backup Error]', err.message);
  }
}, 5 * 60 * 1000);

// API: Get Email Backup Settings
app.get('/api/admin/email-settings', (req, res) => {
  const db = loadDB();
  const settings = (db.settings && db.settings.email) ? db.settings.email : {};
  const currentPass = settings.smtpPass || process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || '';
  res.json({
    recipientEmail: settings.recipientEmail || BACKUP_RECIPIENT_EMAIL,
    smtpHost: settings.smtpHost || 'smtp.gmail.com',
    smtpPort: settings.smtpPort || 587,
    smtpUser: settings.smtpUser || BACKUP_RECIPIENT_EMAIL,
    hasPassword: !!currentPass,
    webAppUrl: settings.webAppUrl || '',
    resendApiKey: settings.resendApiKey || '',
    autoBackupEnabled: settings.autoBackupEnabled !== false,
    lastSentAt: settings.lastSentAt || null,
    lastStatus: settings.lastStatus || null
  });
});

// API: Update Email Backup Settings
app.put('/api/admin/email-settings', (req, res) => {
  const db = loadDB();
  const { recipientEmail, smtpHost, smtpPort, smtpUser, smtpPass, webAppUrl, resendApiKey, autoBackupEnabled } = req.body;

  if (!db.settings) db.settings = {};
  if (!db.settings.email) db.settings.email = {};

  if (recipientEmail) db.settings.email.recipientEmail = recipientEmail.trim();
  if (smtpHost) db.settings.email.smtpHost = smtpHost.trim();
  if (smtpPort) db.settings.email.smtpPort = parseInt(smtpPort, 10);
  if (smtpUser) db.settings.email.smtpUser = smtpUser.trim();
  
  if (typeof webAppUrl === 'string') db.settings.email.webAppUrl = webAppUrl.trim();
  if (typeof resendApiKey === 'string') db.settings.email.resendApiKey = resendApiKey.trim();

  if (typeof smtpPass === 'string' && smtpPass.trim() !== '') {
    const sanitizedPass = smtpPass.trim().replace(/\s+/g, '');
    db.settings.email.smtpPass = sanitizedPass;
  }
  
  if (typeof autoBackupEnabled === 'boolean') {
    db.settings.email.autoBackupEnabled = autoBackupEnabled;
  }

  saveDB(db);
  res.json({
    success: true,
    message: 'Email settings updated and saved successfully!',
    settings: {
      recipientEmail: db.settings.email.recipientEmail,
      smtpHost: db.settings.email.smtpHost,
      smtpPort: db.settings.email.smtpPort,
      smtpUser: db.settings.email.smtpUser,
      hasPassword: !!db.settings.email.smtpPass,
      webAppUrl: db.settings.email.webAppUrl || '',
      resendApiKey: db.settings.email.resendApiKey || '',
      autoBackupEnabled: db.settings.email.autoBackupEnabled
    }
  });
});

// On-demand Email Backup Endpoints
app.post(['/api/backup/send-email', '/api/admin/send-email-backup'], async (req, res) => {
  try {
    const db = loadDB();
    if (!db.settings) db.settings = {};
    if (!db.settings.email) db.settings.email = {};

    const { email, webAppUrl } = req.body;
    if (email && email.trim()) db.settings.email.recipientEmail = email.trim();
    if (typeof webAppUrl === 'string' && webAppUrl.trim()) db.settings.email.webAppUrl = webAppUrl.trim();
    saveDB(db);

    const recipient = (email && email.trim()) || db.settings.email.recipientEmail || BACKUP_RECIPIENT_EMAIL;
    const result = await sendEmailBackup(recipient);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('Error sending email backup:', err);
    res.status(500).json({ error: err.message || 'Failed to send email backup' });
  }
});

// Download Full Database JSON Backup
app.get(['/api/admin/backup-download', '/api/backup/download'], (req, res) => {
  const db = loadDB();
  const dateStr = new Date().toISOString().split('T')[0];
  const jsonContent = JSON.stringify(db, null, 2);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=AR_Callers_DB_Backup_${dateStr}.json`);
  res.send(jsonContent);
});

// Import Backup File (.json) Endpoint
app.post(['/api/backup/import', '/api/admin/import-backup'], (req, res) => {
  try {
    const importedData = req.body;

    if (!importedData || typeof importedData !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON payload. Please select a valid backup JSON file.' });
    }

    if (!Array.isArray(importedData.attendance) && !Array.isArray(importedData.employees)) {
      return res.status(400).json({ error: 'Invalid backup structure. File must contain "attendance" or "employees" array.' });
    }

    const currentDB = loadDB();
    let newAttAdded = 0;
    let attUpdated = 0;
    let newEmpAdded = 0;

    // 1. Merge Attendance Records safely (Never erase existing attendance records)
    if (Array.isArray(importedData.attendance)) {
      const attMap = new Map();
      (currentDB.attendance || []).forEach(a => {
        attMap.set(`${a.date}_${a.employeeId}`, a);
      });

      importedData.attendance.forEach(a => {
        if (!a || !a.date || !a.employeeId) return;
        const key = `${a.date}_${a.employeeId}`;
        if (attMap.has(key)) {
          attUpdated++;
        } else {
          newAttAdded++;
        }
        attMap.set(key, a);
      });

      currentDB.attendance = Array.from(attMap.values());
    }

    // 2. Merge Employees
    if (Array.isArray(importedData.employees)) {
      const empMap = new Map();
      (currentDB.employees || []).forEach(e => empMap.set(e.id, e));

      importedData.employees.forEach(e => {
        if (!e || !e.id) return;
        if (!empMap.has(e.id)) {
          empMap.set(e.id, e);
          newEmpAdded++;
        }
      });

      currentDB.employees = Array.from(empMap.values());
      sortNumerically(currentDB.employees);
    }

    // Save merged database to disk, master backup archive, and update RAM cache
    saveDB(currentDB);

    res.json({
      success: true,
      message: `Backup imported successfully! (${newAttAdded} new attendance records added, ${attUpdated} records updated, ${newEmpAdded} employees added). Total attendance records: ${currentDB.attendance.length}.`,
      totalRecords: currentDB.attendance.length,
      totalEmployees: currentDB.employees.length
    });
  } catch (err) {
    console.error('Error importing backup file:', err);
    res.status(500).json({ error: 'Failed to import backup file: ' + err.message });
  }
});

// 5. Get Attendance Records for a Specific Date
app.get('/api/attendance', (req, res) => {
  const db = loadDB();
  const targetDate = req.query.date || new Date().toISOString().split('T')[0];

  const dateObj = new Date(targetDate + 'T00:00:00');
  const dayOfWeek = dateObj.getDay();
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

  const monthPrefix = targetDate.substring(0, 7);
  const monthRecords = (db.attendance || []).filter(a => a.date && a.date.startsWith(monthPrefix));

  // Return employees for target month/date separately
  const targetEmps = getEmployeesForMonth(db, monthPrefix);

  const records = targetEmps.map(emp => {
    const att = (db.attendance || []).find(a => a.employeeId === emp.id && a.date === targetDate);
    const empMonthLogs = monthRecords.filter(a => a.employeeId === emp.id);

    let monthlyPresent = 0;
    let monthlyAbsent = 0;
    let monthlyHalfDay = 0;
    let monthlyOff = 0;

    empMonthLogs.forEach(a => {
      if (a.status === 'Present') monthlyPresent++;
      else if (a.status === 'Absent') monthlyAbsent++;
      else if (a.status === 'Half Day') monthlyHalfDay++;
      else if (a.status === 'Holiday / Off' || a.status === 'On Leave') monthlyOff++;
    });

    let status = att ? att.status : (isWeekend ? 'Holiday / Off' : 'Unmarked');

    return {
      employeeId: emp.id,
      name: emp.name,
      department: 'AR Callers',
      avatarColor: emp.avatarColor,
      date: targetDate,
      status,
      monthlyPresent,
      monthlyAbsent,
      monthlyHalfDay,
      monthlyOff,
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

  const activeEmps = getEmployeesForMonth(db, date.substring(0, 7));
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
  const activeEmps = getEmployeesForMonth(db, date.substring(0, 7));
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

  // Include only employees active in this specific month
  const targetEmps = getEmployeesForMonth(db, monthQuery);

  // ---------------------------------------------------------
  // TABLE 1: DAILY MONTHLY ATTENDANCE GRID (TOP TABLE)
  // ---------------------------------------------------------
  const headerRowValues = ['EMPLOYEE NAME'];
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dateObj = new Date(year, monthIdx, d);
    const dayOfWeek = dateObj.getDay();
    const mStr = String(monthIdx + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    headerRowValues.push(`${mStr}/${dStr}/${year} (${weekdayNames[dayOfWeek]})`);
  }

  const row1 = worksheet.addRow(headerRowValues);
  row1.height = 28;

  // Style Header Row 1 (Cyan/Blue Background #00A4E4, Bold White Text)
  row1.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
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
    worksheet.getColumn(c).width = 16;
  }

  // Populate Employee Rows for Table 1
  targetEmps.forEach(emp => {
    const rowValues = [emp.name.toUpperCase()];
    const isAdmin = (emp.id === 'DBS-540' || emp.id === 'DBS-327' || emp.roleType === 'Admin' || emp.role === 'System Administrator');

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
    'EMPLOYEE NAME',
    'TOTAL WORKING DAYS',
    'NUMBER OF PRESENTS',
    'NUMBER OF ABSENTS',
    'ATTENDANCE PERCENTAGE (%)'
  ]);
  summaryHeaderRow.height = 26;

  const headerColors = [
    'FFFFEA00', // Employee Name (Yellow)
    'FF00A4E4', // Total Working Days (Cyan)
    'FF10B981', // Number of Presents (Green)
    'FFEF4444', // Number of Absents (Red)
    'FFF59E0B'  // Attendance Rate % (Gold/Yellow)
  ];

  summaryHeaderRow.eachCell((cell, colNum) => {
    const bgColor = headerColors[colNum - 1] || 'FFFFEA00';
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
  summaryHeaderRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  // Populate Summary Table Data Rows
  targetEmps.forEach(emp => {
    const empRecords = monthRecords.filter(a => a.employeeId === emp.id);

    let fullPresent = 0;
    let fullAbsent = 0;
    let halfDays = 0;

    empRecords.forEach(r => {
      if (r.status === 'Present') fullPresent++;
      else if (r.status === 'Absent') fullAbsent++;
      else if (r.status === 'Half Day') halfDays++;
    });

    // Half days are calculated directly as 0.5 Present and 0.5 Absent
    const presentCount = fullPresent + (halfDays * 0.5);
    const absentCount = fullAbsent + (halfDays * 0.5);
    const totalWorkingDays = presentCount + absentCount;

    let attPercentage = '0.0%';
    if (totalWorkingDays > 0) {
      const score = (presentCount / totalWorkingDays) * 100;
      attPercentage = `${score.toFixed(1)}%`;
    }

    const sRow = worksheet.addRow([
      emp.name.toUpperCase(),
      totalWorkingDays,
      presentCount % 1 === 0 ? presentCount : presentCount.toFixed(1),
      absentCount % 1 === 0 ? absentCount : absentCount.toFixed(1),
      attPercentage
    ]);
    sRow.height = 22;

    sRow.eachCell((cell, colNum) => {
      cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : 'center' };
      cell.font = { name: 'Calibri', size: 10, bold: (colNum === 1 || colNum === 5) };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };

      if (colNum === 1) {
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
  const targetEmps = getEmployeesForMonth(db, monthQuery);

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

// 11. Custom Date Range & Quarter Spreadsheet Generator (.xlsx)
async function buildCustomRangeExcelBuffer(startDateStr, endDateStr, titleLabel = 'Custom Date Range') {
  const db = loadDB();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AR Callers Attendance System';
  workbook.created = new Date();

  const startParts = startDateStr.split('-').map(Number);
  const endParts = endDateStr.split('-').map(Number);

  const startDateObj = new Date(Date.UTC(startParts[0], startParts[1] - 1, startParts[2]));
  const endDateObj = new Date(Date.UTC(endParts[0], endParts[1] - 1, endParts[2]));

  const dateList = [];
  let curr = new Date(startDateObj);
  while (curr <= endDateObj) {
    const y = curr.getUTCFullYear();
    const m = String(curr.getUTCMonth() + 1).padStart(2, '0');
    const d = String(curr.getUTCDate()).padStart(2, '0');
    dateList.push(`${y}-${m}-${d}`);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  const usStart = formatUSDate(startDateStr);
  const usEnd = formatUSDate(endDateStr);
  const worksheet = workbook.addWorksheet('Attendance Report');

  const attendanceList = db.attendance || [];
  const rangeRecords = attendanceList.filter(a => a.date && a.date >= startDateStr && a.date <= endDateStr);

  const targetEmps = getEmployeesForDateRange(db, startDateStr, endDateStr);

  // Table 1: Daily Grid
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const headerRowValues = ['EMPLOYEE NAME'];

  dateList.forEach(iso => {
    const p = iso.split('-').map(Number);
    const dObj = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    const dayOfWeek = dObj.getUTCDay();
    const mStr = String(p[1]).padStart(2, '0');
    const dStr = String(p[2]).padStart(2, '0');
    headerRowValues.push(`${mStr}/${dStr}/${p[0]} (${weekdayNames[dayOfWeek]})`);
  });

  const row1 = worksheet.addRow(headerRowValues);
  row1.height = 28;
  row1.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00A4E4' } };
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
  for (let c = 2; c <= dateList.length + 1; c++) {
    worksheet.getColumn(c).width = 16;
  }

  targetEmps.forEach(emp => {
    const rowValues = [emp.name.toUpperCase()];
    const isAdmin = (emp.id === 'DBS-540' || emp.id === 'DBS-327' || emp.roleType === 'Admin' || emp.role === 'System Administrator');

    dateList.forEach(iso => {
      const p = iso.split('-').map(Number);
      const dObj = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
      const dayOfWeek = dObj.getUTCDay();
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

      const record = rangeRecords.find(r => r.employeeId === emp.id && r.date === iso);
      let status = record ? record.status : (isWeekend ? 'Holiday / Off' : 'Unmarked');

      let cellText = 'P';
      if (status === 'Present') cellText = 'P';
      else if (status === 'Absent') cellText = 'A';
      else if (status === 'Half Day') cellText = '0.5P';
      else if (status === 'Holiday / Off' || status === 'On Leave') cellText = 'OFF';
      else cellText = 'P';

      rowValues.push(cellText);
    });

    const row = worksheet.addRow(rowValues);
    row.height = 22;

    const nameCell = row.getCell(1);
    nameCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
    nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEA00' } };
    nameCell.alignment = { vertical: 'middle', horizontal: 'left' };
    nameCell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
    };

    for (let d = 1; d <= dateList.length; d++) {
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
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        cell.font = { name: 'Calibri', size: 10, bold: false, color: { argb: 'FF000000' } };
      }
    }
  });

  worksheet.addRow([]);
  worksheet.addRow([]);

  // Table 2: Summary Table
  const bannerRow = worksheet.addRow([`EMPLOYEE ATTENDANCE SUMMARY - ${titleLabel.toUpperCase()} (${usStart} TO ${usEnd})`]);
  bannerRow.height = 30;
  const bannerCell = bannerRow.getCell(1);
  bannerCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
  bannerCell.alignment = { vertical: 'middle', horizontal: 'left' };

  const summaryHeaderRow = worksheet.addRow([
    'EMPLOYEE NAME',
    'TOTAL WORKING DAYS',
    'NUMBER OF PRESENTS',
    'NUMBER OF ABSENTS',
    'ATTENDANCE PERCENTAGE (%)'
  ]);
  summaryHeaderRow.height = 26;

  const headerColors = ['FFFFEA00', 'FF00A4E4', 'FF10B981', 'FFEF4444', 'FFF59E0B'];
  summaryHeaderRow.eachCell((cell, colNum) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColors[colNum - 1] || 'FFFFEA00' } };
    cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF333333' } },
      left: { style: 'thin', color: { argb: 'FF333333' } },
      bottom: { style: 'medium', color: { argb: 'FF333333' } },
      right: { style: 'thin', color: { argb: 'FF333333' } }
    };
  });
  summaryHeaderRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  targetEmps.forEach(emp => {
    const empRecords = rangeRecords.filter(a => a.employeeId === emp.id);
    let fullPresent = 0, fullAbsent = 0, halfDays = 0;

    empRecords.forEach(r => {
      if (r.status === 'Present') fullPresent++;
      else if (r.status === 'Absent') fullAbsent++;
      else if (r.status === 'Half Day') halfDays++;
    });

    const presentCount = fullPresent + (halfDays * 0.5);
    const absentCount = fullAbsent + (halfDays * 0.5);
    const totalWorkingDays = presentCount + absentCount;

    let attPercentage = '0.0%';
    if (totalWorkingDays > 0) {
      attPercentage = `${((presentCount / totalWorkingDays) * 100).toFixed(1)}%`;
    }

    const sRow = worksheet.addRow([
      emp.name.toUpperCase(),
      totalWorkingDays,
      presentCount % 1 === 0 ? presentCount : presentCount.toFixed(1),
      absentCount % 1 === 0 ? absentCount : absentCount.toFixed(1),
      attPercentage
    ]);
    sRow.height = 22;

    sRow.eachCell((cell, colNum) => {
      cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : 'center' };
      cell.font = { name: 'Calibri', size: 10, bold: (colNum === 1 || colNum === 5) };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };
      if (colNum === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEA00' } };
      }
    });
  });

  return await workbook.xlsx.writeBuffer();
}

// 12. Export Custom Date Range & Quarter Excel Report (.xlsx)
app.get('/api/export/custom-excel', async (req, res) => {
  try {
    let { startDate, endDate, rangePreset, year } = req.query;
    const currentYear = year || new Date().getFullYear();

    if (rangePreset) {
      if (rangePreset === 'Q1') { startDate = `${currentYear}-01-01`; endDate = `${currentYear}-03-31`; }
      else if (rangePreset === 'Q2') { startDate = `${currentYear}-04-01`; endDate = `${currentYear}-06-30`; }
      else if (rangePreset === 'Q3') { startDate = `${currentYear}-07-01`; endDate = `${currentYear}-09-30`; }
      else if (rangePreset === 'Q4') { startDate = `${currentYear}-10-01`; endDate = `${currentYear}-12-31`; }
      else if (rangePreset === 'YTD') { startDate = `${currentYear}-01-01`; endDate = new Date().toISOString().split('T')[0]; }
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start Date and End Date are required' });
    }

    const titleLabel = rangePreset || `${formatUSDate(startDate)} - ${formatUSDate(endDate)}`;
    const buffer = await buildCustomRangeExcelBuffer(startDate, endDate, titleLabel);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=AR_Callers_Attendance_${startDate}_to_${endDate}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('Custom Excel Export Error:', err);
    res.status(500).json({ error: 'Failed to generate custom range Excel report' });
  }
});

// 13. In-App Backup History List API
app.get('/api/admin/backups/list', (req, res) => {
  const currentDB = loadDB();
  const list = [];

  try {
    if (fs.existsSync(BACKUP_DIR)) {
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
      files.forEach(filename => {
        const fullPath = path.join(BACKUP_DIR, filename);
        const stats = fs.statSync(fullPath);
        let empCount = 0, attCount = 0, earliest = '', latest = '';
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const parsed = JSON.parse(content);
          if (parsed && parsed.employees) empCount = parsed.employees.length;
          if (parsed && parsed.attendance && Array.isArray(parsed.attendance)) {
            attCount = parsed.attendance.length;
            const dates = parsed.attendance.map(a => a.date).filter(Boolean).sort();
            if (dates.length > 0) {
              earliest = dates[0];
              latest = dates[dates.length - 1];
            }
          }
        } catch (e) {}

        list.push({
          filename,
          sizeBytes: stats.size,
          sizeKb: Math.round(stats.size / 1024),
          modifiedAt: stats.mtime.toISOString(),
          empCount,
          attCount,
          earliestDate: formatUSDate(earliest),
          latestDate: formatUSDate(latest),
          isMaster: filename === 'db_master_archive.json'
        });
      });
    }
  } catch (err) {}

  list.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

  res.json({
    activeDB: {
      employees: currentDB.employees ? currentDB.employees.length : 0,
      attendance: currentDB.attendance ? currentDB.attendance.length : 0
    },
    backups: list
  });
});

// 14. 1-Click Backup Restore API (with automatic safety pre-restore snapshot)
app.post('/api/admin/backups/restore', (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  const targetPath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: `Backup file ${filename} not found` });
  }

  try {
    const currentDB = loadDB(true);
    const safetyPath = path.join(BACKUP_DIR, `db_snapshot_pre_restore_${Date.now()}.json`);
    fs.writeFileSync(safetyPath, JSON.stringify(currentDB, null, 2), 'utf8');

    const content = fs.readFileSync(targetPath, 'utf8');
    const restoredDB = JSON.parse(content);

    if (!restoredDB || !Array.isArray(restoredDB.employees) || !Array.isArray(restoredDB.attendance)) {
      return res.status(400).json({ error: 'Invalid backup file structure' });
    }

    saveDB(restoredDB);
    cachedDB = restoredDB;

    res.json({
      success: true,
      message: `Database successfully restored to ${filename}! Loaded ${restoredDB.attendance.length} attendance logs and ${restoredDB.employees.length} callers. Mandatory pre-restore snapshot saved.`,
      recordsCount: restoredDB.attendance.length,
      employeeCount: restoredDB.employees.length
    });
  } catch (err) {
    console.error('Error restoring backup:', err);
    res.status(500).json({ error: 'Restore failed: ' + err.message });
  }
});

// Nightly Automatic Backup Scheduler (Runs every 24 hours)
setInterval(() => {
  try {
    const db = loadDB();
    saveDB(db);
    console.log(`[Nightly Scheduler] Automated daily backup snapshot & master archive synced.`);
  } catch (err) {}
}, 24 * 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 AR Callers Attendance Portal running on port ${PORT}`);
  console.log(`🛡️ Data Storage Policy: Permanent Preservation & Daily Snapshot Backups`);
  console.log(`👤 Primary Admin: SAGAR ALAPATI (9704225352 / 9640000890)`);
  console.log(`👤 Co-Admin: VIJAYA SAI KRISHNA KEERTHI (7569258789 / Admin@123)`);
  console.log(`====================================================`);
});
