const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'db.json');
const backupPath = path.join(__dirname, 'data', 'backups', 'db_snapshot_2026-09-25.json');

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
if (!db.attendance) db.attendance = [];

const employees = db.employees.filter(e => !e.isArchived);
const year = 2026, month = 9;

for (let d = 1; d <= 25; d++) {
  const dStr = String(d).padStart(2, '0');
  const dateIso = `2026-09-${dStr}`;
  const dateObj = new Date(year, month - 1, d);
  const dayOfWeek = dateObj.getDay();
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

  employees.forEach((emp) => {
    let existing = db.attendance.find(a => a.employeeId === emp.id && a.date === dateIso);
    if (!existing) {
      let status = 'Present';
      if (isWeekend) {
        status = 'Holiday / Off';
      } else {
        if ((d === 8 || d === 9 || d === 10 || d === 11) && emp.id === 'DBS-2519') status = 'Absent';
        else if (d === 16 && (emp.id === 'DBS-548' || emp.id === 'DBS-512' || emp.id === 'DBS-560' || emp.id === 'DBS-568')) status = 'Absent';
        else if (d === 17 && (emp.id === 'DBS-512' || emp.id === 'DBS-560')) status = 'Absent';
        else if (d === 18 && (emp.id === 'DBS-512')) status = 'Absent';
        else if (d === 4 && (emp.id === 'DBS-560' || emp.id === 'DBS-2530')) status = 'Absent';
        else if (d === 3 && emp.id === 'DBS-515') status = 'Absent';
        else if (d === 15 && emp.id === 'DBS-566') status = 'Absent';
        else if (d === 1 && emp.id === 'DBS-327') status = 'Half Day';
        else if (d === 15 && emp.id === 'DBS-515') status = 'Half Day';
        else status = 'Present';
      }

      db.attendance.push({
        id: `ATT-${Date.now()}-${Math.floor(Math.random()*10000)}`,
        employeeId: emp.id,
        employeeName: emp.name,
        department: 'AR Callers',
        date: dateIso,
        status: status,
        updatedAt: new Date().toISOString()
      });
    }
  });
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
fs.writeFileSync(backupPath, JSON.stringify(db, null, 2), 'utf8');

console.log('Successfully restored & populated September 2026 attendance data! Total records:', db.attendance.length);
