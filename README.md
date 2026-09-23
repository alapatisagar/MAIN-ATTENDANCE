# PulseAttend - Online Employee Attendance System 🚀

A modern, full-stack, mobile & laptop responsive **Employee Attendance Management Web Application** featuring a high-impact **Yellow & Red visual theme**, ready for **online deployment anywhere via Render.com**.

![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)

---

## 🌟 Key Features

1. **One-Click Clock In / Clock Out Terminal**:
   - Live digital clock (12h/24h) with real-time date ticker.
   - Automatic **Late Arrival Detection** (marks status as `Late` if clocked in after 09:15 AM grace time).
   - Work Location tags (`HQ Office`, `Remote (Home)`, `Client Site / Field`) & daily notes.
   - Dual interface: Quick Check-in Widget on Dashboard + Standalone Full-Screen Kiosk mode.

2. **Executive Summary Dashboard & KPI Cards**:
   - Total Staff Count, Present Today, Late Arrivals, On Leave, and Attendance Rate progress bar.
   - Real-time live feed of today's check-ins.

3. **Complete Attendance History Logs & CSV Report Export**:
   - Filter logs by Employee Name, Department, Date Range, and Attendance Status (`Present`, `Late`, `Clocked Out`).
   - One-click **Export to CSV** for HR & Payroll processing.

4. **Staff Roster Directory & Profile Management**:
   - Add new employees with Name, Department, Role, Email, and Shift Schedule.
   - Delete/Deactivate staff entries in Admin view.

5. **Leave & Absence Tracker**:
   - Employees can apply for `Casual`, `Sick`, or `Annual` leave with date range & reason.
   - Admin approval panel to **Approve** or **Reject** leave requests with status updates.

6. **Role Switcher (Employee View vs Admin View)**:
   - Easily toggle between employee self-service mode and full HR administration mode.

7. **Mobile & Laptop Responsive UI**:
   - **Yellow & Red Theme**: Modern dark slate executive container with vibrant Amber Gold (`#F59E0B`) and Crimson Red (`#DC2626`) accents.
   - Desktop wide-screen multi-column layout + Fixed bottom thumb navigation bar for mobile smartphones.

8. **Zero External Database Setup**:
   - Self-contained persistent database file (`data/db.json`) pre-populated with initial mock employees and attendance logs.

---

## 🖥️ Local Running Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+) installed.

### Steps
1. Clone or navigate to the project directory:
   ```bash
   cd employee-attendance-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

4. Open your browser and visit:
   ```text
   http://localhost:3000
   ```

---

## ☁️ How to Deploy Online Anywhere on Render.com

This project is pre-configured with `render.yaml` for zero-config 1-click cloud hosting!

### Option A: Standard Render Web Service Setup

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/employee-attendance-app.git
   git push -u origin main
   ```

2. **Log into Render**:
   - Go to [Render.com](https://render.com) and click **New +** &rarr; **Web Service**.

3. **Connect Repository**:
   - Select your `employee-attendance-app` repository.
   - Configure the following settings:
     - **Name**: `pulse-attend` (or your preferred name)
     - **Runtime**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Environment Variable**: `PORT` is automatically assigned by Render (handled in code by `process.env.PORT || 3000`).

4. **Click "Create Web Service"**:
   - Render will build and deploy your app. Within 1-2 minutes, you will receive your live online HTTPS URL (e.g., `https://pulse-attend.onrender.com`) accessible anywhere on mobile devices and laptops!

---

## 📂 Project Structure

```text
employee-attendance-app/
├── data/
│   └── db.json               # Auto-generated persistent JSON database
├── public/
│   ├── css/
│   │   └── style.css         # Yellow & Red responsive design stylesheet
│   ├── js/
│   │   └── app.js            # Client UI, REST API fetchers & live clock
│   └── index.html            # Main single-page HTML application
├── package.json              # Node.js dependencies and start script
├── render.yaml               # Render.com deployment manifest
├── server.js                 # Express server & REST API endpoints
└── README.md                 # Documentation & deployment guide
```

---

## 📄 License
MIT License - Free for commercial and personal use.
