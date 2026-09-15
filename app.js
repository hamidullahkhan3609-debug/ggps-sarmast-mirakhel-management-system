import { 
  auth, db, secondaryAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword,
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, query, where, getDocs, onSnapshot, orderBy, serverTimestamp 
} from "./firebase.js";


// STATE MANAGEMENT
let currentUser = null;
let userRole = null;
let currentView = 'dashboard';
let unsubscribers = [];

// DOM ELEMENTS
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const authStatus = document.getElementById('auth-status');
const authError = document.getElementById('auth-error');

// INITIALIZATION
function startApp() {
  if (authStatus) {
    authStatus.innerText = "Firebase connected. Ready.";
  }

  setupEventListeners();

  onAuthStateChanged(auth, async (user) => {

    console.log("AUTH STATE:", user ? user.uid : "No user");

    if (!user) {
      currentUser = null;
      userRole = null;
      showLoginView();

      if (authStatus) {
        authStatus.innerText = "Firebase connected. Ready.";
      }

      return;
    }

    // User is authenticated
    if (authStatus) {
      authStatus.innerText = "Loading your school account...";
    }

    try {
      console.log("Reading user profile:", user.uid);

      const userDoc = await getDoc(
        doc(db, "users", user.uid)
      );

      console.log("User profile exists:", userDoc.exists());

      if (!userDoc.exists()) {
        showAuthError(
          "Login successful, but no user profile was found. " +
          "Please contact the Super Admin."
        );

        await signOut(auth);
        return;
      }

      currentUser = {
        uid: user.uid,
        ...userDoc.data()
      };

      userRole = currentUser.role
        ? currentUser.role.toLowerCase().replace(/\s+/g, '')
        : 'student';

      console.log("LOGIN SUCCESS:", currentUser);

      // IMPORTANT: Enter the actual web app
      if (loginContainer) {
        loginContainer.style.display = 'none';
      }

      if (appContainer) {
        appContainer.style.display = 'flex';
      }

      initializeUI();

    } catch (err) {

      console.error("LOGIN PROFILE ERROR:", err);

      showAuthError(
        "Login succeeded, but the school profile could not be loaded.\n\n" +
        (err.code || "Unknown error") +
        "\n\n" +
        (err.message || "Unknown Firebase error")
      );

      if (authStatus) {
        authStatus.innerText = "Unable to load school account.";
      }
    }
  });
}

// Start immediately because app.js is loaded at the bottom of index.html
startApp();

function showAuthError(msg) {
  if (authError) {
    authError.innerText = msg;
    authError.style.display = 'block';
  }
}

function showLoginView() {
  if (loginContainer) loginContainer.style.display = 'flex';
  if (appContainer) appContainer.style.display = 'none';
  cleanupListeners();
}

function initializeUI() {
  if (loginContainer) loginContainer.style.display = 'none';
  if (appContainer) appContainer.style.display = 'flex';
  if (authError) authError.style.display = 'none';

  const nameEl = document.getElementById('current-user-name');
  const roleEl = document.getElementById('current-user-role');
  const badgeEl = document.getElementById('role-badge');

  if (nameEl) nameEl.innerText = currentUser.name || currentUser.email;
  if (roleEl) roleEl.innerText = userRole;
  if (badgeEl) badgeEl.innerText = userRole;

  // Hide Super Admin sections
  const superAdminNav = document.querySelectorAll('.superadmin-only');
  superAdminNav.forEach(el => el.style.display = (userRole === 'superadmin') ? 'flex' : 'none');

  // Hide Admin-Only confidential modules from Students
  const adminNav = document.querySelectorAll('.admin-only');
  adminNav.forEach(el => {
    el.style.display = (userRole === 'student') ? 'none' : 'flex';
  });

  // Default view for students: Notices instead of Dashboard/Records
  if (userRole === 'student') {
    switchView('notices');
  } else {
    switchView('dashboard');
  }
}


function setupEventListeners() {
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (authError) authError.style.display = 'none';
      
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const btn = document.getElementById('login-btn');

      try {
        if (btn) {
          btn.disabled = true;
          btn.innerText = "Signing in...";
        }

        if (authStatus) {
          authStatus.innerText = "Signing in to school system...";
        }

        const result = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        console.log("AUTHENTICATION SUCCESS:", result.user.uid);

      } catch (err) {
        console.error("SIGN IN ERROR:", err);

        showAuthError(
          "Authentication failed.\n\n" +
          (err.code || "Unknown error") +
          "\n\n" +
          (err.message || err)
        );
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerText = "Sign In";
        }
      }
    });
  }


  document.getElementById('logout-btn')?.addEventListener('click', () => signOut(auth));

  // Navigation Click Handlers
  document.querySelectorAll('.sidebar-nav li').forEach(item => {
    item.addEventListener('click', (e) => {
      const targetView = e.currentTarget.getAttribute('data-view');
      switchView(targetView);
      document.getElementById('sidebar')?.classList.remove('open');
    });
  });

  document.getElementById('mobile-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('marksheet-close')?.addEventListener('click', () => {
    const mm = document.getElementById('marksheet-modal');
    if (mm) mm.style.display = 'none';
  });

  // Action Buttons
  document.getElementById('add-student-btn')?.addEventListener('click', () => openStudentModal());
  document.getElementById('add-teacher-btn')?.addEventListener('click', () => openTeacherModal());
  document.getElementById('add-subject-btn')?.addEventListener('click', () => openSubjectModal());
  document.getElementById('add-exam-btn')?.addEventListener('click', () => openExamModal());
  document.getElementById('enter-marks-btn')?.addEventListener('click', () => openMarksModal());
  document.getElementById('mark-attendance-btn')?.addEventListener('click', () => openAttendanceModal());
  document.getElementById('add-timetable-btn')?.addEventListener('click', () => openTimetableModal());
  document.getElementById('add-notice-btn')?.addEventListener('click', () => openNoticeModal());
  document.getElementById('add-user-btn')?.addEventListener('click', () => openUserModal());
  // Dashboard Quick Actions
document.getElementById('dashboard-add-student')
  ?.addEventListener('click', () => openStudentModal());

document.getElementById('dashboard-attendance')
  ?.addEventListener('click', () => openAttendanceModal());

document.getElementById('dashboard-marks')
  ?.addEventListener('click', () => openMarksModal());

document.getElementById('dashboard-notice')
  ?.addEventListener('click', () => openNoticeModal());

  // Search and Filters
  document.getElementById('student-search')?.addEventListener('input', loadStudents);
  document.getElementById('student-filter-class')?.addEventListener('change', loadStudents);
  document.getElementById('teacher-search')?.addEventListener('input', loadTeachers);
  document.getElementById('subject-filter-class')?.addEventListener('change', loadSubjects);
  document.getElementById('exam-filter-class')?.addEventListener('change', loadExams);
  document.getElementById('exam-filter-type')?.addEventListener('change', loadExams);
  document.getElementById('marks-filter-class')?.addEventListener('change', loadMarksExamsDropdown);
  document.getElementById('marks-filter-exam')?.addEventListener('change', loadMarks);
  document.getElementById('attendance-date-filter')?.addEventListener('change', loadAttendance);
  document.getElementById('attendance-class-filter')?.addEventListener('change', loadAttendance);
  document.getElementById('timetable-filter-class')?.addEventListener('change', loadTimetable);
  document.getElementById('timetable-filter-day')?.addEventListener('change', loadTimetable);
  document.getElementById('generate-report-btn')?.addEventListener('click', loadMonthlyReport);
}

function cleanupListeners() {
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];
}

function switchView(viewName) {
  currentView = viewName;
  document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');
  document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));

  const selectedNav = document.querySelector(`.sidebar-nav li[data-view="${viewName}"]`);
  if (selectedNav) selectedNav.classList.add('active');

  const viewSec = document.getElementById(`view-${viewName}`);
  if (viewSec) viewSec.style.display = 'flex';

  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.innerText = selectedNav ? selectedNav.innerText.trim() : 'Dashboard';

  // Load section-specific data
  switch(viewName) {
    case 'dashboard': loadDashboardData(); break;
    case 'students': loadStudents(); break;
    case 'teachers': loadTeachers(); break;
    case 'subjects': loadSubjects(); break;
    case 'exams': loadExams(); break;
    case 'marks': loadMarksExamsDropdown(); loadMarks(); break;
    case 'attendance': 
      const adf = document.getElementById('attendance-date-filter');
      if (adf) adf.valueAsDate = new Date();
      loadAttendance(); 
      break;
    case 'monthly-attendance': loadMonthlyReport(); break;
    case 'timetable': loadTimetable(); break;
    case 'notices': loadNotices(); break;
    case 'users': if (userRole === 'superadmin') loadUsers(); break;
  }
}

/* ===================================================
   MODAL ENGINE
   =================================================== */
function openModal(title, htmlContent) {
  const mt = document.getElementById('modal-title');
  const mbc = document.getElementById('modal-body-content');
  const mo = document.getElementById('modal-overlay');
  
  if (mt) mt.innerText = title;
  if (mbc) mbc.innerHTML = htmlContent;
  if (mo) mo.style.display = 'flex';
}
window.openModal = openModal; // <-- ADD THIS LINE

function closeModal() {
  const mo = document.getElementById('modal-overlay');
  if (mo) mo.style.display = 'none';
}
window.closeModal = closeModal;

/* ===================================================
   MODULE 1: DASHBOARD
   =================================================== */
async function loadDashboardData() {
  try {
    // -----------------------------------------
    // BASIC DASHBOARD COUNTS
    // -----------------------------------------
    const studentsSnap = await getDocs(collection(db, "students"));
    const teachersSnap = await getDocs(collection(db, "teachers"));
    const subjectsSnap = await getDocs(collection(db, "subjects"));
    const examsSnap = await getDocs(collection(db, "exams"));

    document.getElementById('dash-total-students').innerText = studentsSnap.size;
    document.getElementById('dash-total-teachers').innerText = teachersSnap.size;
    document.getElementById('dash-total-subjects').innerText = subjectsSnap.size;
    document.getElementById('dash-total-exams').innerText = examsSnap.size;

    // -----------------------------------------
    // CLASS BREAKDOWN
    // -----------------------------------------
    const counts = {
      "Class 1": 0,
      "Class 2": 0,
      "Class 3": 0,
      "Class 4": 0,
      "Class 5": 0
    };

    studentsSnap.forEach(docSnap => {
      const data = docSnap.data();
      const cls = data.class;

      if (counts[cls] !== undefined) {
        counts[cls]++;
      }
    });

    document.getElementById('dash-c1').innerText =
      `${counts["Class 1"]} Students`;

    document.getElementById('dash-c2').innerText =
      `${counts["Class 2"]} Students`;

    document.getElementById('dash-c3').innerText =
      `${counts["Class 3"]} Students`;

    document.getElementById('dash-c4').innerText =
      `${counts["Class 4"]} Students`;

    document.getElementById('dash-c5').innerText =
      `${counts["Class 5"]} Students`;

    // -----------------------------------------
    // TODAY'S DATE
    // -----------------------------------------
    const today = new Date();

    const formattedDate = today.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const dateElement = document.getElementById('dashboard-today');

    if (dateElement) {
      dateElement.innerText = formattedDate;
    }

    // -----------------------------------------
    // TODAY'S ATTENDANCE
    // -----------------------------------------
    await loadDashboardAttendance();

    // -----------------------------------------
    // UPCOMING EXAMS
    // -----------------------------------------
    loadDashboardExams(examsSnap);

    // ----------------------------------------
    // RECENT NOTICES
    // -----------------------------------------
    await loadDashboardNotices();

  } catch (error) {
    console.error("Dashboard loading error:", error);
  }
}
async function loadDashboardAttendance() {
  try {
    const today = new Date().toISOString().split('T')[0];

    const attendanceSnap = await getDocs(
      collection(db, "attendance")
    );

    let present = 0;
    let absent = 0;
    let leave = 0;

    attendanceSnap.forEach(docSnap => {
      const data = docSnap.data();

      if (data.date === today) {
        const status = String(data.status || '').toLowerCase();

        if (status === 'present') {
          present++;
        } else if (status === 'absent') {
          absent++;
        } else if (status === 'leave') {
          leave++;
        }
      }
    });

    const total = present + absent + leave;

    let rate = 0;

    if (total > 0) {
      rate = Math.round((present / total) * 100);
    }

    const presentElement = document.getElementById(
      'dash-present-today'
    );

    const absentElement = document.getElementById(
      'dash-absent-today'
    );

    const leaveElement = document.getElementById(
      'dash-leave-today'
    );

    const rateElement = document.getElementById(
      'dash-attendance-rate'
    );

    const progressElement = document.getElementById(
      'dash-attendance-progress'
    );

    if (presentElement) presentElement.innerText = present;
    if (absentElement) absentElement.innerText = absent;
    if (leaveElement) leaveElement.innerText = leave;
    if (rateElement) rateElement.innerText = `${rate}%`;

    if (progressElement) {
      progressElement.style.width = `${rate}%`;
    }

  } catch (error) {
    console.error("Dashboard attendance error:", error);
  }
}

function loadDashboardExams(examsSnap) {
  const container = document.getElementById(
    'dashboard-upcoming-exams'
  );

  if (!container) return;

  const exams = [];

  examsSnap.forEach(docSnap => {
    const data = docSnap.data();

    exams.push({
      id: docSnap.id,
      ...data
    });
  });

  // Try to sort by exam date
  exams.sort((a, b) => {
    const dateA = new Date(a.date || a.examDate || '9999-12-31');
    const dateB = new Date(b.date || b.examDate || '9999-12-31');

    return dateA - dateB;
  });

  const upcoming = exams.slice(0, 5);

  if (upcoming.length === 0) {
    container.innerHTML = `
      <div class="dashboard-empty">
        <i class="fa fa-calendar"></i>
        <span>No upcoming exams</span>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  upcoming.forEach(exam => {
    const examName =
      exam.name ||
      exam.examName ||
      exam.title ||
      'Examination';

    const examDate =
      exam.date ||
      exam.examDate ||
      '';

    const item = document.createElement('div');

    item.className = 'dashboard-list-item';

    item.innerHTML = `
      <div class="list-icon exam-icon">
        <i class="fa fa-file-alt"></i>
      </div>

      <div class="list-content">
        <strong>${examName}</strong>
        <span>${examDate || 'Date not specified'}</span>
      </div>
    `;

    container.appendChild(item);
  });
}

async function loadDashboardNotices() {
  const container = document.getElementById(
    'dashboard-recent-notices'
  );

  if (!container) return;

  try {
    const noticesSnap = await getDocs(
      collection(db, "notices")
    );

    const notices = [];

    noticesSnap.forEach(docSnap => {
      const data = docSnap.data();

      notices.push({
        id: docSnap.id,
        ...data
      });
    });

    notices.sort((a, b) => {
      const dateA = new Date(
        a.date ||
        a.createdAt ||
        '1970-01-01'
      );

      const dateB = new Date(
        b.date ||
        b.createdAt ||
        '1970-01-01'
      );

      return dateB - dateA;
    });

    const recentNotices = notices.slice(0, 5);

    if (recentNotices.length === 0) {
      container.innerHTML = `
        <div class="dashboard-empty">
          <i class="fa fa-bell"></i>
          <span>No notices available</span>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    recentNotices.forEach(notice => {
      const title =
        notice.title ||
        notice.name ||
        'School Notice';

      const description =
        notice.description ||
        notice.message ||
        notice.content ||
        '';

      const date =
        notice.date ||
        '';

      const item = document.createElement('div');

      item.className = 'dashboard-list-item';

      item.innerHTML = `
        <div class="list-icon notice-icon">
          <i class="fa fa-bullhorn"></i>
        </div>

        <div class="list-content">
          <strong>${title}</strong>
          <span>
            ${description || date || 'School announcement'}
          </span>
        </div>
      `;

      container.appendChild(item);
    });

  } catch (error) {
    console.error("Dashboard notices error:", error);

    container.innerHTML = `
      <div class="dashboard-empty">
        <i class="fa fa-exclamation-circle"></i>
        <span>Unable to load notices</span>
      </div>
    `;
  }
}



/* ===================================================
   MODULE 2: STUDENT MANAGEMENT
   =================================================== */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
async function loadStudents() {
  const tbody = document.getElementById('students-table-body');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="loading-row">Loading students...</td>
    </tr>
  `;

  try {
    let q = collection(db, "students");

    if (userRole === 'student') {
      q = query(q, where("userId", "==", currentUser.uid));
    }

    const snap = await getDocs(q);
    const filterClass = document.getElementById('student-filter-class')?.value || '';
    const search = document.getElementById('student-search')?.value.trim().toLowerCase() || '';

    tbody.innerHTML = '';
    let visibleStudents = 0;

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const studentId = docSnap.id;

      const name = String(data.name || '');
      const fatherName = String(data.fatherName || '');
      const admissionNumber = String(data.admissionNumber || '');
      const studentClass = String(data.class || '');

      if (filterClass && studentClass !== filterClass) return;

      const searchableText = `${name} ${fatherName} ${admissionNumber} ${studentClass}`.toLowerCase();
      if (search && !searchableText.includes(search)) return;

      visibleStudents++;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(admissionNumber)}</strong></td>
        <td><strong>${escapeHtml(name)}</strong></td>
        <td>${escapeHtml(fatherName)}</td>
        <td><span class="class-badge">${escapeHtml(studentClass)}</span></td>
        <td>${escapeHtml(data.dateOfBirth || '-')}</td>
        <td>${escapeHtml(data.phone || '-')}</td>
        <td class="student-actions">
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.viewStudentProfile('${studentId}')" title="View Student Profile">
            <i class="fa fa-eye"></i>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="viewStudentMarksheet('${studentId}')" title="View Result">
            <i class="fa fa-file-invoice"></i>
          </button>
          ${
            (userRole === 'superadmin' || userRole === 'admin')
              ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.openStudentModal('${studentId}')"><i class="fa fa-edit"></i> Edit</button>`
              : ''
          }
          ${
            userRole === 'superadmin'
              ? `<button class="btn btn-danger btn-sm" onclick="window.deleteRecord('students', '${studentId}', window.loadStudents)" title="Delete Student"><i class="fa fa-trash"></i></button>`
              : ''
          }
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (visibleStudents === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-row">
            <div class="table-empty-state">
              <i class="fa fa-user-graduate"></i>
              <strong>No students found</strong>
            </div>
          </td>
        </tr>
      `;
    }

  } catch (error) {
    console.error("Error loading students:", error);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="error-row">
          <i class="fa fa-exclamation-triangle"></i> Unable to load student records.
        </td>
      </tr>
    `;
  }
}
window.loadStudents = loadStudents;
// ===================================================
// STUDENT ADD / EDIT MODAL
// ===================================================
window.openStudentModal = async function(id = null) {

  let student = {
    name: '',
    fatherName: '',
    admissionNumber: '',
    class: 'Class 1',
    classId: '',
    dateOfBirth: '',
    phone: '',
    admissionDate: ''
  };

  // -----------------------------------------------
  // LOAD EXISTING STUDENT FOR EDITING
  // -----------------------------------------------
  if (id) {
    try {

      const studentRef = doc(db, "students", id);
      const studentSnap = await getDoc(studentRef);

      if (!studentSnap.exists()) {
        alert("Student record not found.");
        return;
      }

      student = {
        ...student,
        ...studentSnap.data()
      };

    } catch (error) {

      console.error("Error loading student:", error);

      alert(
        "Unable to load student record.\n\n" +
        (error.code || "Unknown error") +
        "\n\n" +
        (error.message || "")
      );

      return;
    }
  }

  // -----------------------------------------------
  // STUDENT FORM
  // -----------------------------------------------
  const html = `
    <form id="student-form">

      <div class="form-group">
        <label for="s-name">Student Name *</label>
        <input
          type="text"
          id="s-name"
          value="${escapeHtml(student.name)}"
          required
          placeholder="Enter student name"
        >
      </div>

      <div class="form-group">
        <label for="s-father">Father Name *</label>
        <input
          type="text"
          id="s-father"
          value="${escapeHtml(student.fatherName)}"
          required
          placeholder="Enter father name"
        >
      </div>

      <div class="form-group">
        <label for="s-adm">Admission Number *</label>
        <input
          type="text"
          id="s-adm"
          value="${escapeHtml(student.admissionNumber)}"
          required
          placeholder="Enter admission number"
        >
      </div>

      <div class="form-group">
        <label for="s-class">Class *</label>
        <select id="s-class" required>

          ${['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5']
            .map(c => `
              <option
                value="${c}"
                ${student.class === c ? 'selected' : ''}
              >
                ${c}
              </option>
            `)
            .join('')}

        </select>
      </div>

      <div class="form-group">
        <label for="s-class-id">Class ID</label>
        <input
          type="text"
          id="s-class-id"
          value="${escapeHtml(student.classId)}"
          placeholder="Enter class ID"
        >
      </div>

      <div class="form-group">
        <label for="s-dob">Date of Birth</label>
        <input
          type="date"
          id="s-dob"
          value="${escapeHtml(student.dateOfBirth)}"
        >
      </div>

      <div class="form-group">
        <label for="s-phone">Phone Number</label>
        <input
          type="tel"
          id="s-phone"
          value="${escapeHtml(student.phone)}"
          placeholder="Enter phone number"
        >
      </div>

      <div class="form-group">
        <label for="s-admission-date">Admission Date</label>
        <input
          type="date"
          id="s-admission-date"
          value="${escapeHtml(student.admissionDate)}"
        >
      </div>

      <div
        style="
          display:flex;
          justify-content:flex-end;
          gap:10px;
          margin-top:20px;
        "
      >

        <button
          type="button"
          class="btn btn-secondary"
          onclick="window.closeModal()"
        >
          Cancel
        </button>

        <button
          type="submit"
          class="btn btn-primary"
          id="save-student-btn"
        >
          <i class="fa fa-save"></i>
          ${id ? 'Update Student' : 'Save Student'}
        </button>

      </div>

    </form>
  `;

  openModal(
    id ? "Edit Student" : "Add Student",
    html
  );

  // -----------------------------------------------
  // FORM SUBMIT
  // -----------------------------------------------
  const form = document.getElementById('student-form');

  if (!form) {
    console.error("Student form was not created.");
    return;
  }

  form.addEventListener('submit', async (e) => {

    e.preventDefault();

    const saveBtn = document.getElementById('save-student-btn');

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML =
        '<i class="fa fa-spinner fa-spin"></i> Saving...';
    }

    try {

      const name =
        document.getElementById('s-name')?.value.trim() || '';

      const fatherName =
        document.getElementById('s-father')?.value.trim() || '';

      const admissionNumber =
        document.getElementById('s-adm')?.value.trim() || '';

      const studentClass =
        document.getElementById('s-class')?.value || 'Class 1';

      const classId =
        document.getElementById('s-class-id')?.value.trim() || '';

      const dateOfBirth =
        document.getElementById('s-dob')?.value || '';

      const phone =
        document.getElementById('s-phone')?.value.trim() || '';

      const admissionDate =
        document.getElementById('s-admission-date')?.value || '';

      // -------------------------------------------
      // VALIDATION
      // -------------------------------------------
      if (!name || !fatherName || !admissionNumber) {

        alert(
          "Please enter Student Name, Father Name, " +
          "and Admission Number."
        );

        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML =
            '<i class="fa fa-save"></i> ' +
            (id ? 'Update Student' : 'Save Student');
        }

        return;
      }

      // -------------------------------------------
      // CHECK DUPLICATE ADMISSION NUMBER
      // -------------------------------------------
      const duplicateQuery = query(
        collection(db, "students"),
        where("admissionNumber", "==", admissionNumber)
      );

      const duplicateSnap =
        await getDocs(duplicateQuery);

      let duplicateFound = false;

      duplicateSnap.forEach(docSnap => {

        // When editing, allow the current student's
        // own admission number.
        if (docSnap.id !== id) {
          duplicateFound = true;
        }

      });

      if (duplicateFound) {

        alert(
          "Another student already has admission number " +
          admissionNumber + ".\n\n" +
          "Please use a different admission number."
        );

        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML =
            '<i class="fa fa-save"></i> ' +
            (id ? 'Update Student' : 'Save Student');
        }

        return;
      }

      // -------------------------------------------
      // DATA TO SAVE
      // -------------------------------------------
      const studentData = {
        name: name,
        fatherName: fatherName,
        admissionNumber: admissionNumber,
        class: studentClass,
        classId: classId,
        dateOfBirth: dateOfBirth,
        phone: phone,
        admissionDate: admissionDate,
        updatedAt: serverTimestamp()
      };

      // -------------------------------------------
      // UPDATE EXISTING STUDENT
      // -------------------------------------------
      if (id) {

        await updateDoc(
          doc(db, "students", id),
          studentData
        );

        alert("Student information updated successfully.");

      }

      // -------------------------------------------
      // ADD NEW STUDENT
      // -------------------------------------------
      else {

        studentData.createdAt =
          serverTimestamp();

        await addDoc(
          collection(db, "students"),
          studentData
        );

        alert("Student registered successfully.");
      }

      // -------------------------------------------
      // CLOSE MODAL + REFRESH TABLE
      // -------------------------------------------
      closeModal();

      await loadStudents();

    } catch (error) {

      console.error(
        "Error saving student:",
        error
      );

      alert(
        "Unable to save student.\n\n" +
        (error.code || "Unknown error") +
        "\n\n" +
        (error.message || "")
      );

    } finally {

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML =
          '<i class="fa fa-save"></i> ' +
          (id ? 'Update Student' : 'Save Student');
      }

    }

  });

};

// =========================================================
// STUDENT PROFILE VIEW
// =========================================================
window.viewStudentProfile = async function(id) {
  try {
    const studentRef = doc(db, "students", id);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      alert("Student record not found.");
      return;
    }

    const student = studentSnap.data();
    const createdDate = student.createdAt?.toDate
      ? student.createdAt.toDate().toLocaleDateString('en-GB')
      : '-';

    const html = `
      <div class="student-profile">
        <div class="student-profile-header">
          <div class="student-profile-avatar"><i class="fa fa-user-graduate"></i></div>
          <div class="student-profile-title">
            <h2>${escapeHtml(student.name || '-')}</h2>
            <p>Admission No: <strong>${escapeHtml(student.admissionNumber || '-')}</strong></p>
          </div>
        </div>

        <div class="student-profile-grid">
          <div class="profile-info-card"><span class="profile-label">Student Name</span><strong>${escapeHtml(student.name || '-')}</strong></div>
          <div class="profile-info-card"><span class="profile-label">Father Name</span><strong>${escapeHtml(student.fatherName || '-')}</strong></div>
          <div class="profile-info-card"><span class="profile-label">Admission Number</span><strong>${escapeHtml(student.admissionNumber || '-')}</strong></div>
          <div class="profile-info-card"><span class="profile-label">Class</span><strong>${escapeHtml(student.class || '-')}</strong></div>
          <div class="profile-info-card"><span class="profile-label">Phone</span><strong>${escapeHtml(student.phone || '-')}</strong></div>
        </div>

        <div class="student-profile-actions">
          ${
            (userRole === 'superadmin' || userRole === 'admin')
              ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.closeModal(); setTimeout(() => window.openStudentModal('${id}'), 100)"><i class="fa fa-edit"></i> Edit Student</button>`
              : ''
          }
          <button class="btn btn-secondary" onclick="window.viewStudentMarksheet('${id}')"><i class="fa fa-file-invoice"></i> View Result</button>
        </div>
      </div>
    `;

    openModal("Student Profile", html);

  } catch (error) {
    console.error("Error loading student profile:", error);
    alert("Unable to load student profile.\n\n" + (error.message || "Unknown error"));
  }
};



/* ===================================================
   MODULE 3: TEACHER MANAGEMENT
   =================================================== */
async function loadTeachers() {
  const tbody = document.getElementById('teachers-table-body');

  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="loading-row">
        Loading teachers...
      </td>
    </tr>
  `;

  try {
    const snap = await getDocs(collection(db, "teachers"));

    const search =
      document.getElementById('teacher-search')?.value
        .trim()
        .toLowerCase() || '';

    tbody.innerHTML = '';

    let visibleTeachers = 0;

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const teacherId = docSnap.id;

      const name = String(data.name || '');
      const fatherName = String(data.fatherName || '');
      const email = String(data.email || '');
      const phone = String(data.phone || '');
      const assignedClass = String(data.assignedClass || 'None');

      const subjects = Array.isArray(data.subjects)
        ? data.subjects.join(', ')
        : String(data.subjects || 'None');

      const searchableText =
        `${name} ${fatherName} ${email} ${phone} ${assignedClass} ${subjects}`
          .toLowerCase();

      if (search && !searchableText.includes(search)) return;

      visibleTeachers++;

      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>
          <strong>${escapeHtml(name || '-')}</strong>
        </td>

        <td>
          ${escapeHtml(fatherName || '-')}
        </td>

        <td>
          ${escapeHtml(email || '-')}
        </td>

        <td>
          ${escapeHtml(phone || '-')}
        </td>

        <td>
          <span class="class-badge">
            ${escapeHtml(assignedClass)}
          </span>
        </td>

        <td>
          ${escapeHtml(subjects)}
        </td>

        <td class="teacher-actions">

          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onclick="window.viewTeacherProfile('${teacherId}')"
            title="View Teacher Profile"
          >
            <i class="fa fa-eye"></i>
          </button>

          ${
            (userRole === 'superadmin' || userRole === 'admin')
              ? `
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  onclick="window.openTeacherModal('${teacherId}')"
                  title="Edit Teacher"
                >
                  <i class="fa fa-edit"></i>
                </button>
              `
              : ''
          }

          ${
            userRole === 'superadmin'
              ? `
                <button
                  type="button"
                  class="btn btn-danger btn-sm"
                  onclick="window.deleteRecord('teachers', '${teacherId}', window.loadTeachers)"
                  title="Delete Teacher"
                >
                  <i class="fa fa-trash"></i>
                </button>
              `
              : ''
          }

        </td>
      `;

      tbody.appendChild(tr);
    });

    if (visibleTeachers === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-row">
            <div class="table-empty-state">
              <i class="fa fa-chalkboard-teacher"></i>
              <strong>No teachers found</strong>
              <span>Try a different search.</span>
            </div>
          </td>
        </tr>
      `;
    }

  } catch (error) {
    console.error("Error loading teachers:", error);

    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="error-row">
          <i class="fa fa-exclamation-triangle"></i>
          Unable to load teacher records.
        </td>
      </tr>
    `;
  }
}

window.loadTeachers = loadTeachers;

window.openTeacherModal = async function(id = null) {
  let teacher = { name: '', fatherName: '', phone: '', email: '', assignedClass: 'Class 1', subjects: '' };
  if (id) {
    const tDoc = await getDoc(doc(db, "teachers", id));
    if (tDoc.exists()) {
      teacher = tDoc.data();
      teacher.subjects = Array.isArray(teacher.subjects) ? teacher.subjects.join(', ') : teacher.subjects;
    }
  }

  const html = `
    <form id="teacher-form">
      <div class="form-group"><label for="t-name">Teacher Name *</label><input type="text" id="t-name" value="${teacher.name}" required></div>
      <div class="form-group"><label for="t-father">Father Name</label><input type="text" id="t-father" value="${teacher.fatherName}"></div>
      <div class="form-group"><label for="t-email">Email *</label><input type="email" id="t-email" value="${teacher.email}" required></div>
      <div class="form-group">
        <label for="t-phone">Phone Number</label>
        <input
          type="tel"
          id="t-phone"
          value="${teacher.phone || ''}"
          placeholder="03XX-XXXXXXX"
          inputmode="tel"
      >
      </div>
      <div class="form-group"><label for="t-class">Assigned Class</label>
        <select id="t-class">
          ${['Class 1','Class 2','Class 3','Class 4','Class 5'].map(c => `<option value="${c}" ${teacher.assignedClass === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label for="t-subjects">Assigned Subjects (comma separated)</label><input type="text" id="t-subjects" value="${teacher.subjects}"></div>
      <button type="submit" class="btn btn-primary">${id ? 'Update' : 'Save'} Teacher</button>
    </form>
  `;
  openModal(id ? "Edit Teacher" : "Add Teacher", html);

  document.getElementById('teacher-form').onsubmit = async (e) => {
    e.preventDefault();
    const subjectsArray = document.getElementById('t-subjects').value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const payload = {
      name: document.getElementById('t-name').value,
      fatherName: document.getElementById('t-father').value,
      email: document.getElementById('t-email').value,
      phone: document.getElementById('t-phone').value,
      assignedClass: document.getElementById('t-class').value,
      subjects: subjectsArray,
      updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(db, "teachers", id), payload);
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "teachers"), payload);
    }
    closeModal();
    loadTeachers();
  };
};
// =========================================================
// TEACHER PROFILE VIEW
// =========================================================
window.viewTeacherProfile = async function(id) {
  try {
    const teacherRef = doc(db, "teachers", id);
    const teacherSnap = await getDoc(teacherRef);

    if (!teacherSnap.exists()) {
      alert("Teacher record not found.");
      return;
    }

    const teacher = teacherSnap.data();

    const name = teacher.name || '-';
    const fatherName = teacher.fatherName || '-';
    const email = teacher.email || '-';
    const phone = teacher.phone || '-';
    const assignedClass = teacher.assignedClass || 'None';

    const subjects = Array.isArray(teacher.subjects)
      ? teacher.subjects.join(', ')
      : (teacher.subjects || 'None');

    const html = `
      <div class="student-profile">

        <div class="student-profile-header">

          <div class="student-profile-avatar">
            <i class="fa fa-chalkboard-teacher"></i>
          </div>

          <div class="student-profile-title">
            <h2>${escapeHtml(name)}</h2>
            <p>
              Teacher Profile
            </p>
          </div>

        </div>

        <div class="student-profile-grid">

          <div class="profile-info-card">
            <span class="profile-label">Teacher Name</span>
            <strong>${escapeHtml(name)}</strong>
          </div>

          <div class="profile-info-card">
            <span class="profile-label">Father Name</span>
            <strong>${escapeHtml(fatherName)}</strong>
          </div>

          <div class="profile-info-card">
            <span class="profile-label">Email</span>
            <strong>${escapeHtml(email)}</strong>
          </div>

          <div class="profile-info-card">
            <span class="profile-label">Phone</span>
            <strong>${escapeHtml(phone)}</strong>
          </div>

          <div class="profile-info-card">
            <span class="profile-label">Assigned Class</span>
            <strong>${escapeHtml(assignedClass)}</strong>
          </div>

          <div class="profile-info-card">
            <span class="profile-label">Assigned Subjects</span>
            <strong>${escapeHtml(subjects)}</strong>
          </div>

        </div>

        <div class="student-profile-actions">

          ${
            (userRole === 'superadmin' || userRole === 'admin')
              ? `
                <button
                  type="button"
                  class="btn btn-primary"
                  onclick="
                    window.closeModal();
                    setTimeout(() => window.openTeacherModal('${id}'), 100);
                  "
                >
                  <i class="fa fa-edit"></i>
                  Edit Teacher
                </button>
              `
              : ''
          }

          <button
            type="button"
            class="btn btn-secondary"
            onclick="window.closeModal()"
          >
            <i class="fa fa-times"></i>
            Close
          </button>

        </div>

      </div>
    `;

    openModal("Teacher Profile", html);

  } catch (error) {
    console.error("Error loading teacher profile:", error);

    alert(
      "Unable to load teacher profile.\\n\\n" +
      (error.message || "Unknown error")
    );
  }
};

/* ===================================================
   MODULE 4: SUBJECT MANAGEMENT
   =================================================== */
async function loadSubjects() {
  const tbody = document.getElementById('subjects-table-body');

  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="3" class="loading-row">
        Loading subjects...
      </td>
    </tr>
  `;

  try {
    const snap = await getDocs(collection(db, "subjects"));

    const filterClass =
      document.getElementById('subject-filter-class')?.value || '';

    tbody.innerHTML = '';

    let visibleSubjects = 0;

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const subjectId = docSnap.id;

      const name = String(data.name || '');
      const subjectClass = String(data.class || '');

      if (filterClass && subjectClass !== filterClass) return;

      visibleSubjects++;

      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>
          <strong>${escapeHtml(name || '-')}</strong>
        </td>

        <td>
          <span class="class-badge">
            ${escapeHtml(subjectClass || '-')}
          </span>
        </td>

        <td class="subject-actions">

          ${
            (userRole === 'superadmin' || userRole === 'admin')
              ? `
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  onclick="window.openSubjectModal('${subjectId}')"
                  title="Edit Subject"
                >
                  <i class="fa fa-edit"></i>
                </button>
              `
              : ''
          }

          ${
            userRole === 'superadmin'
              ? `
                <button
                  type="button"
                  class="btn btn-danger btn-sm"
                  onclick="window.deleteRecord('subjects', '${subjectId}', window.loadSubjects)"
                  title="Delete Subject"
                >
                  <i class="fa fa-trash"></i>
                </button>
              `
              : ''
          }

        </td>
      `;

      tbody.appendChild(tr);
    });

    if (visibleSubjects === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="empty-row">
            <div class="table-empty-state">
              <i class="fa fa-book"></i>
              <strong>No subjects found</strong>
              <span>No subjects match the selected class.</span>
            </div>
          </td>
        </tr>
      `;
    }

  } catch (error) {
    console.error("Error loading subjects:", error);

    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="error-row">
          <i class="fa fa-exclamation-triangle"></i>
          Unable to load subject records.
        </td>
      </tr>
    `;
  }
}

window.loadSubjects = loadSubjects;

window.openSubjectModal = async function(id = null) {
  let sub = { name: '', class: 'Class 1' };
  if (id) {
    const sDoc = await getDoc(doc(db, "subjects", id));
    if (sDoc.exists()) sub = sDoc.data();
  }

  const html = `
    <form id="subject-form">
      <div class="form-group">
  <label for="sub-name">Subject Name *</label>
  <input
    type="text"
    id="sub-name"
    value="${sub.name || ''}"
    placeholder="e.g. English"
    required
  >
</div>
      <div class="form-group"><label for="sub-class">Class *</label>
        <select id="sub-class">
          ${['Class 1','Class 2','Class 3','Class 4','Class 5'].map(c => `<option value="${c}" ${sub.class === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">${id ? 'Update' : 'Save'} Subject</button>
    </form>
  `;
  openModal(id ? "Edit Subject" : "Add Subject", html);

  document.getElementById('subject-form').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('sub-name').value,
      class: document.getElementById('sub-class').value,
      updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(db, "subjects", id), payload);
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "subjects"), payload);
    }
    closeModal();
    loadSubjects();
  };
};

/* ===================================================
   MODULE 5: EXAM MANAGEMENT
   WHOLE-CLASS EXAMS + SUBJECT-WISE EXAM TIMETABLE
   =================================================== */

async function loadExams() {
  const tbody = document.getElementById('exams-table-body');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="8">Loading exams...</td>
    </tr>
  `;

  try {
    const snap = await getDocs(collection(db, "exams"));

    /*
     * Each document in "exams" represents one subject
     * inside a complete class exam.
     *
     * Example:
     * Mid-Term Exam | Class 1 | English
     * Mid-Term Exam | Class 1 | Urdu
     * Mid-Term Exam | Class 1 | Mathematics
     *
     * All of them share the same examGroupId.
     */

    const groups = {};

    snap.forEach(docSnap => {
      const data = docSnap.data();

      /*
       * New grouped exams use examGroupId.
       * Old records without examGroupId are kept as
       * individual legacy records so existing data
       * is not lost.
       */
      const groupKey = data.examGroupId || `legacy_${docSnap.id}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: data.examGroupId || docSnap.id,
          isLegacy: !data.examGroupId,
          name: data.name || 'Unnamed Exam',
          type: data.type || 'N/A',
          class: data.class || 'N/A',
          subjects: []
        };
      }

      groups[groupKey].subjects.push({
        id: docSnap.id,
        ...data
      });
    });

    const filterClass =
      document.getElementById('exam-filter-class')?.value || '';

    const filterType =
      document.getElementById('exam-filter-type')?.value || '';

    tbody.innerHTML = '';

    Object.values(groups).forEach(group => {

      if (filterClass && group.class !== filterClass) return;
      if (filterType && group.type !== filterType) return;

      /*
       * Find earliest and latest exam dates.
       */
      const dates = group.subjects
        .map(item => item.date)
        .filter(Boolean)
        .sort();

      const firstDate = dates.length ? dates[0] : '';
      const lastDate = dates.length ? dates[dates.length - 1] : '';

      let dateDisplay = 'Not scheduled';

      if (firstDate && lastDate) {
        if (firstDate === lastDate) {
          dateDisplay = formatExamDate(firstDate);
        } else {
          dateDisplay =
            `${formatExamDate(firstDate)} - ${formatExamDate(lastDate)}`;
        }
      }

      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${escapeHtml(group.name)}</td>

        <td>${escapeHtml(group.type)}</td>

        <td>${escapeHtml(group.class)}</td>

        <td>
          <strong>${group.subjects.length}</strong>
          subject${group.subjects.length === 1 ? '' : 's'}
        </td>

        <td>${dateDisplay}</td>

        <td>
          <span class="badge green">
            ${group.subjects.length} scheduled
          </span>
        </td>

        <td>
          <button
            class="btn btn-info btn-sm"
            onclick="window.viewExamTimetable('${group.id}')"
            title="View Exam Timetable">
            <i class="fa fa-eye"></i>
            View Exam
          </button>
        </td>

        <td>
          ${
            (userRole === 'superadmin' || userRole === 'admin')
              ? `
                <button
                  class="btn btn-primary btn-sm"
                  onclick="window.openExamModal('${group.id}')"
                  title="Edit Exam">
                  <i class="fa fa-edit"></i>
                </button>
              `
              : ''
          }

          ${
            userRole === 'superadmin'
              ? `
                <button
                  class="btn btn-danger btn-sm"
                  onclick="window.deleteExamGroup('${group.id}')"
                  title="Delete Complete Exam">
                  <i class="fa fa-trash"></i>
                </button>
              `
              : ''
          }
        </td>
      `;

      tbody.appendChild(tr);
    });

    if (!tbody.hasChildNodes()) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8">No exams found.</td>
        </tr>
      `;
    }

  } catch (error) {
    console.error("Error loading exams:", error);

    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          Error loading exams: ${escapeHtml(error.message)}
        </td>
      </tr>
    `;
  }
}


/* ---------------------------------------------------
   DATE FORMATTER
   --------------------------------------------------- */

function formatExamDate(dateString) {
  if (!dateString) return '';

  const date = new Date(`${dateString}T00:00:00`);

  if (isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}


/* ---------------------------------------------------
   DAY NAME
   --------------------------------------------------- */

function getExamDay(dateString) {
  if (!dateString) return '';

  const date = new Date(`${dateString}T00:00:00`);

  if (isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'long'
  });
}


/* ---------------------------------------------------
   LOAD SUBJECTS FOR SELECTED CLASS
   --------------------------------------------------- */

async function loadExamSubjectsForClass(className, existingSubjects = []) {

  const container =
    document.getElementById('exam-subject-schedule');

  if (!container) return;

  const subjectsSnap =
    await getDocs(collection(db, "subjects"));

  const subjects = [];

  subjectsSnap.forEach(docSnap => {
    const data = docSnap.data();

    if (data.class === className) {
      subjects.push({
        id: docSnap.id,
        ...data
      });
    }
  });

  if (!subjects.length) {
    container.innerHTML = `
      <div class="alert alert-warning">
        No subjects have been added for ${escapeHtml(className)}.
        Please add the class subjects first.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="table" style="min-width:900px;">
        <thead>
          <tr>
            <th style="width:50px;">Use</th>
            <th>Subject</th>
            <th>Date</th>
            <th>Day</th>
            <th>Start Time</th>
            <th>End Time</th>
            <th>Max Marks</th>
            <th>Passing Marks</th>
          </tr>
        </thead>

        <tbody id="exam-subject-rows"></tbody>
      </table>
    </div>
  `;

  const rowsContainer =
    document.getElementById('exam-subject-rows');

  subjects.forEach(subject => {

    const existing =
      existingSubjects.find(
        item => item.subjectId === subject.id
      );

    /*
     * For a new whole-class exam, all subjects are
     * selected automatically.
     */
    const checked =
      existing ? 'checked' : 'checked';

    const date =
      existing?.date || '';

    const startTime =
      existing?.startTime || '';

    const endTime =
      existing?.endTime || '';

    const maxMarks =
      existing?.maxMarks ?? 100;

    const passingMarks =
      existing?.passingMarks ?? 40;

    const row = document.createElement('tr');

    row.className = 'exam-subject-row';

    row.dataset.subjectId = subject.id;

    row.innerHTML = `
      <td>
        <input
          type="checkbox"
          class="exam-subject-check"
          ${checked}>
      </td>

      <td>
        <strong>${escapeHtml(subject.name || 'Unnamed Subject')}</strong>
      </td>

      <td>
        <input
          type="date"
          class="exam-subject-date"
          value="${date}">
      </td>

      <td>
        <span class="exam-subject-day">
          ${date ? getExamDay(date) : '-'}
        </span>
      </td>

      <td>
        <input
          type="time"
          class="exam-subject-start"
          value="${startTime}">
      </td>

      <td>
        <input
          type="time"
          class="exam-subject-end"
          value="${endTime}">
      </td>

      <td>
        <input
          type="number"
          class="exam-subject-max"
          value="${maxMarks}"
          min="1"
          required>
      </td>

      <td>
        <input
          type="number"
          class="exam-subject-pass"
          value="${passingMarks}"
          min="0"
          required>
      </td>
    `;

    rowsContainer.appendChild(row);

    /*
     * Automatically display the day when date changes.
     */
    const dateInput =
      row.querySelector('.exam-subject-date');

    const dayDisplay =
      row.querySelector('.exam-subject-day');

    dateInput.addEventListener('change', () => {
      dayDisplay.textContent =
        dateInput.value
          ? getExamDay(dateInput.value)
          : '-';
    });
  });
}


/* ---------------------------------------------------
   ADD / EDIT COMPLETE CLASS EXAM
   --------------------------------------------------- */

window.openExamModal = async function(id = null) {

  let existingSubjects = [];
  let exam = {
    name: 'Mid-Term Exam',
    type: 'Mid-Term',
    class: 'Class 1'
  };

  /*
   * Editing an existing grouped exam.
   */
  if (id) {

    const groupedQuery = query(
      collection(db, "exams"),
      where("examGroupId", "==", id)
    );

    const groupedSnap =
      await getDocs(groupedQuery);

    if (!groupedSnap.empty) {

      groupedSnap.forEach(docSnap => {
        const data = docSnap.data();

        existingSubjects.push({
          id: docSnap.id,
          ...data
        });
      });

      const first = existingSubjects[0];

      exam = {
        name: first.name || 'Exam',
        type: first.type || 'Mid-Term',
        class: first.class || 'Class 1'
      };

    } else {

      /*
       * Legacy exam record without examGroupId.
       * It can still be edited and will be converted
       * into the new grouped structure when saved.
       */
      const oldDoc =
        await getDoc(doc(db, "exams", id));

      if (oldDoc.exists()) {

        const data = oldDoc.data();

        existingSubjects = [{
          id: oldDoc.id,
          ...data
        }];

        exam = {
          name: data.name || 'Exam',
          type: data.type || 'Mid-Term',
          class: data.class || 'Class 1'
        };
      }
    }
  }

  const html = `
    <form id="exam-form">

      <div class="form-group">
        <label for="ex-name">
          Exam Name *
        </label>

        <input
          type="text"
          id="ex-name"
          value="${escapeHtml(exam.name)}"
          required>
      </div>


      <div class="form-group">
        <label for="ex-type">
          Exam Type *
        </label>

        <select id="ex-type" required>

          <option
            value="Mid-Term"
            ${exam.type === 'Mid-Term' ? 'selected' : ''}>
            Mid-Term
          </option>

          <option
            value="Annual"
            ${exam.type === 'Annual' ? 'selected' : ''}>
            Annual
          </option>

        </select>
      </div>


      <div class="form-group">
        <label for="ex-class">
          Class *
        </label>

        <select id="ex-class" required>

          ${
            ['Class 1','Class 2','Class 3','Class 4','Class 5']
              .map(c => `
                <option
                  value="${c}"
                  ${exam.class === c ? 'selected' : ''}>
                  ${c}
                </option>
              `)
              .join('')
          }

        </select>
      </div>


      <div class="form-group">

        <label>
          Subjects & Exam Timetable
        </label>

        <p style="margin:6px 0 12px;color:#666;">
          Select the subjects included in this complete
          class exam and set the date, time and marks
          for each subject.
        </p>

        <div id="exam-subject-schedule">
          Loading subjects...
        </div>

      </div>


      <div style="margin-top:20px;">

        <button
          type="submit"
          class="btn btn-primary">

          <i class="fa fa-save"></i>
          ${id ? 'Update Complete Exam' : 'Save Complete Exam'}

        </button>

      </div>

    </form>
  `;

  openModal(
    id ? "Edit Complete Exam" : "Add Complete Exam",
    html
  );


  /*
   * Load subjects immediately for the selected class.
   */
  await loadExamSubjectsForClass(
    exam.class,
    existingSubjects
  );


  /*
   * Changing class reloads its subjects.
   */
  document
    .getElementById('ex-class')
    .addEventListener('change', async function() {

      await loadExamSubjectsForClass(
        this.value,
        []
      );

    });


  /*
   * SAVE / UPDATE
   */
  document
    .getElementById('exam-form')
    .onsubmit = async function(e) {

      e.preventDefault();

      try {

        const name =
          document.getElementById('ex-name').value.trim();

        const type =
          document.getElementById('ex-type').value;

        const className =
          document.getElementById('ex-class').value;

        const rows =
          Array.from(
            document.querySelectorAll('.exam-subject-row')
          );


        const selectedRows =
          rows.filter(row =>
            row.querySelector('.exam-subject-check').checked
          );


        if (!selectedRows.length) {
          alert(
            "Please select at least one subject for this exam."
          );
          return;
        }


        /*
         * Create a group ID for a new exam.
         *
         * All subject records belonging to this exam
         * receive the same ID.
         */
        let examGroupId = null;

        if (id) {

          /*
           * If editing a new grouped exam, keep its
           * existing group ID.
           *
           * If editing a legacy record, create a new
           * group ID and convert it to the new system.
           */
          const groupedExisting =
            existingSubjects.find(item => item.examGroupId);

          examGroupId =
            groupedExisting?.examGroupId ||
            `exam_${Date.now()}_${Math.random()
              .toString(36)
              .substring(2, 8)}`;

        } else {

          examGroupId =
            `exam_${Date.now()}_${Math.random()
              .toString(36)
              .substring(2, 8)}`;

        }


        /*
         * Existing subject records for this group.
         */
        const existingMap = {};

        existingSubjects.forEach(item => {

          if (item.subjectId) {
            existingMap[item.subjectId] = item;
          }

        });


        /*
         * Save every selected subject.
         */
        for (const row of selectedRows) {

          const subjectId =
            row.dataset.subjectId;

          const date =
            row.querySelector('.exam-subject-date').value;

          const startTime =
            row.querySelector('.exam-subject-start').value;

          const endTime =
            row.querySelector('.exam-subject-end').value;

          const maxMarks =
            Number(
              row.querySelector('.exam-subject-max').value
            );

          const passingMarks =
            Number(
              row.querySelector('.exam-subject-pass').value
            );


          if (passingMarks > maxMarks) {

            alert(
              `Passing marks cannot exceed maximum marks.`
            );

            return;
          }


          if (startTime && endTime && endTime <= startTime) {

            alert(
              "End time must be later than start time."
            );

            return;
          }


          const payload = {

            name: name,

            type: type,

            class: className,

            subjectId: subjectId,

            examGroupId: examGroupId,

            maxMarks: maxMarks,

            passingMarks: passingMarks,

            date: date,

            startTime: startTime,

            endTime: endTime,

            updatedAt: serverTimestamp()

          };


          const oldRecord =
            existingMap[subjectId];


          if (oldRecord) {

            await updateDoc(
              doc(db, "exams", oldRecord.id),
              payload
            );

          } else {

            payload.createdAt =
              serverTimestamp();

            await addDoc(
              collection(db, "exams"),
              payload
            );
          }
        }


        /*
         * Delete subject records that were removed
         * from the edited exam.
         */
        if (id) {

          const selectedSubjectIds =
            new Set(
              selectedRows.map(
                row => row.dataset.subjectId
              )
            );

          for (const oldRecord of existingSubjects) {

            if (
              oldRecord.subjectId &&
              !selectedSubjectIds.has(oldRecord.subjectId)
            ) {

              await deleteDoc(
                doc(db, "exams", oldRecord.id)
              );

            }
          }
        }


        closeModal();

        await loadExams();

        alert(
          "Complete class exam saved successfully."
        );

      } catch (error) {

        console.error(
          "Error saving exam:",
          error
        );

        alert(
          "Error saving exam: " +
          error.message
        );
      }
    };
};


/* ---------------------------------------------------
   VIEW COMPLETE EXAM TIMETABLE
   --------------------------------------------------- */
window.viewExamTimetable = async function(groupId) {

  try {

    let examSubjects = [];

    /* =================================================
       LOAD SUBJECT NAMES
       ================================================= */

    const subjectsSnap = await getDocs(
      collection(db, "subjects")
    );

    const subjectMap = {};

    subjectsSnap.forEach(docSnap => {

      const data = docSnap.data();

      subjectMap[docSnap.id] =
        data.name ||
        data.subjectName ||
        'Unknown Subject';

    });


    /* =================================================
       LOAD EXAM SUBJECT SCHEDULES
       ================================================= */

    const groupedQuery = query(
      collection(db, "exams"),
      where("examGroupId", "==", groupId)
    );

    const groupedSnap =
      await getDocs(groupedQuery);


    if (!groupedSnap.empty) {

      groupedSnap.forEach(docSnap => {

        examSubjects.push({
          id: docSnap.id,
          ...docSnap.data()
        });

      });

    } else {

      /* Legacy exam support */

      const oldDoc = await getDoc(
        doc(db, "exams", groupId)
      );

      if (oldDoc.exists()) {

        examSubjects.push({
          id: oldDoc.id,
          ...oldDoc.data()
        });

      }

    }


    if (!examSubjects.length) {

      alert("Exam timetable not found.");

      return;

    }


    /* =================================================
       SORT BY DATE AND TIME
       ================================================= */

    examSubjects.sort((a, b) => {

      const dateA =
        a.date || '9999-12-31';

      const dateB =
        b.date || '9999-12-31';

      if (dateA !== dateB) {

        return dateA.localeCompare(dateB);

      }

      return (a.startTime || '')
        .localeCompare(b.startTime || '');

    });


    /* =================================================
       EXAM INFORMATION
       ================================================= */

    const examName =
      examSubjects[0].name ||
      'Examination';

    const examType =
      examSubjects[0].type ||
      '';

    const className =
      examSubjects[0].class ||
      '';


    /* =================================================
       BUILD TIMETABLE ROWS
       ================================================= */

    let rowsHtml = '';

    examSubjects.forEach((item, index) => {

      const subjectName =
        subjectMap[item.subjectId] ||
        item.subjectName ||
        'Unknown Subject';


      rowsHtml += `

        <tr>

          <td class="serial">
            ${index + 1}
          </td>

          <td class="subject-cell">
            <strong>
              ${escapeHtml(subjectName)}
            </strong>
          </td>

          <td>
            ${
              item.date
                ? formatExamDate(item.date)
                : 'Not Scheduled'
            }
          </td>

          <td>
            ${
              item.date
                ? getExamDay(item.date)
                : '-'
            }
          </td>

          <td>
            ${
              item.startTime
                ? item.startTime
                : '-'
            }
          </td>

          <td>
            ${
              item.endTime
                ? item.endTime
                : '-'
            }
          </td>

          <td>
            ${item.maxMarks ?? '-'}
          </td>

          <td>
            ${item.passingMarks ?? '-'}
          </td>

        </tr>

      `;

    });


    /* =================================================
       VIEW MODAL
       ================================================= */

    const html = `

      <div class="exam-timetable-wrapper">

        <!-- SCHOOL HEADER -->

        <div class="exam-school-header">

          <div class="exam-school-emblem">
            <i class="fa fa-school"></i>
          </div>

          <div>

            <h1>
              Government Girls Primary School
            </h1>

            <h2>
              Sarmast Mira Khel Bannu
            </h2>

            <div class="exam-school-motto">
              Educate Today, Empower Tomorrow.
            </div>

          </div>

        </div>


        <!-- EXAM INFORMATION -->

        <div class="exam-title-box">

          <div class="exam-title">

            <h2>
              ${escapeHtml(examName)}
            </h2>

            <div class="exam-meta">

              <span>
                <strong>Exam Type:</strong>
                ${escapeHtml(examType)}
              </span>

              <span>
                <strong>Class:</strong>
                ${escapeHtml(className)}
              </span>

            </div>

          </div>

        </div>


        <!-- TIMETABLE -->

        <div class="exam-timetable-container">

          <table class="exam-timetable-table">

            <thead>

              <tr>

                <th>#</th>

                <th>Subject</th>

                <th>Date</th>

                <th>Day</th>

                <th>Start Time</th>

                <th>End Time</th>

                <th>Max Marks</th>

                <th>Passing Marks</th>

              </tr>

            </thead>

            <tbody>

              ${rowsHtml}

            </tbody>

          </table>

        </div>


        <!-- NOTE -->

        <div class="exam-timetable-note">

          <strong>Note:</strong>
          Students should reach the examination room
          at least 15 minutes before the scheduled time.

        </div>


        <!-- SIGNATURES -->

        <div class="exam-signatures">

          <div class="exam-signature-box">

            <div class="signature-line"></div>

            <strong>
              Class Teacher
            </strong>

          </div>


          <div class="exam-signature-box">

            <div class="signature-line"></div>

            <strong>
              Head Mistress
            </strong>

          </div>

        </div>


        <!-- PRINT BUTTON -->

        <div class="exam-print-controls">

          <button
            type="button"
            class="btn btn-primary"
            onclick="window.printExamTimetable()">

            <i class="fa fa-print"></i>

            Print Timetable

          </button>

        </div>

      </div>

    `;


    openModal(
      `Exam Timetable - ${className}`,
      html
    );


    /* =================================================
       PRINT FUNCTION FOR THIS TIMETABLE
       ================================================= */
                
window.printExamTimetable = function() {

  const printWindow = window.open(
    '',
    '_blank',
    'width=1000,height=800'
  );

  if (!printWindow) {
    alert(
      "Please allow pop-ups in your browser to print the timetable."
    );
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>

    <html>

    <head>

      <meta charset="UTF-8">

      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
      >

      <title>
        ${escapeHtml(examName)} - ${escapeHtml(className)}
      </title>


      <style>

        /* =========================================
           PAGE
           ========================================= */

        @page {
          size: A4 portrait;
          margin: 10mm;
        }


        * {
          box-sizing: border-box;
        }


        html,
        body {
          margin: 0;
          padding: 0;
        }


        body {

          font-family:
            Arial,
            Helvetica,
            sans-serif;

          color: #25213a;

          background: #ffffff;

          position: relative;

          -webkit-print-color-adjust: exact;

          print-color-adjust: exact;

        }


        /* =========================================
           WATERMARK
           ========================================= */

        body::before {

          content:
            "GOVERNMENT GIRLS PRIMARY SCHOOL\\A"
            "SARMAST MIRA KHEL BANNU";

          white-space: pre;

          position: fixed;

          top: 50%;

          left: 50%;

          transform:
            translate(-50%, -50%)
            rotate(-35deg);

          font-size: 42px;

          font-weight: 800;

          line-height: 1.45;

          text-align: center;

          letter-spacing: 2px;

          color: #6d28d9;

          opacity: 0.045;

          z-index: -1;

          width: 100%;

          pointer-events: none;

        }


        /* =========================================
           SCHOOL HEADER
           ========================================= */

        .school-header {

          position: relative;

          text-align: center;

          padding: 17px 18px 15px;

          border-radius: 12px;

          background:
            linear-gradient(
              135deg,
              #4c1d95 0%,
              #6d28d9 48%,
              #2563eb 100%
            );

          color: #ffffff;

          border-bottom: 6px solid #facc15;

        }


        .school-header::after {

          content: "";

          position: absolute;

          left: 8%;

          right: 8%;

          bottom: -10px;

          height: 3px;

          background: #facc15;

          border-radius: 10px;

        }


        .school-header h1 {

          margin: 0;

          font-size: 24px;

          font-weight: 800;

          letter-spacing: 0.4px;

          text-transform: uppercase;

        }


        .school-header h2 {

          margin: 5px 0 5px;

          font-size: 19px;

          font-weight: 700;

        }


        .school-motto {

          font-size: 11px;

          font-style: italic;

          opacity: 0.95;

          margin-top: 6px;

        }


        /* =========================================
           EXAM TITLE
           ========================================= */

        .document-title {

          text-align: center;

          margin: 20px 0 15px;

          padding: 10px 15px;

          border: 2px solid #ddd6fe;

          border-radius: 10px;

          background: #faf7ff;

        }


        .document-title h2 {

          margin: 0;

          font-size: 20px;

          font-weight: 800;

          color: #4c1d95;

          text-transform: uppercase;

          letter-spacing: 0.7px;

        }


        .exam-info {

          display: flex;

          justify-content: center;

          align-items: center;

          gap: 45px;

          margin-top: 9px;

          font-size: 12px;

          color: #374151;

        }


        .exam-info strong {

          color: #5b21b6;

        }


        /* =========================================
           TABLE
           ========================================= */

        table {

          width: 100%;

          border-collapse: separate;

          border-spacing: 0;

          margin-top: 14px;

          overflow: hidden;

          border: 1px solid #c4b5fd;

          border-radius: 8px;

        }


        thead th {

          padding: 9px 5px;

          border-right: 1px solid #ffffff;

          border-bottom: 2px solid #facc15;

          background:
            linear-gradient(
              135deg,
              #5b21b6,
              #2563eb
            );

          color: #ffffff;

          font-size: 10px;

          font-weight: 800;

          text-align: center;

          vertical-align: middle;

          white-space: nowrap;

        }


        thead th:last-child {

          border-right: none;

        }


        tbody td {

          padding: 9px 5px;

          border-right: 1px solid #ddd6fe;

          border-bottom: 1px solid #ddd6fe;

          font-size: 10.5px;

          text-align: center;

          vertical-align: middle;

          height: 35px;

          background: #ffffff;

        }


        tbody tr:nth-child(even) td {

          background: #f5f3ff;

        }


        tbody tr:nth-child(odd) td {

          background: #fffbeb;

        }


        tbody tr:last-child td {

          border-bottom: none;

        }


        tbody td:last-child {

          border-right: none;

        }


        td.subject {

          text-align: left;

          font-weight: 700;

          color: #4c1d95;

        }


        td:first-child {

          font-weight: 800;

          color: #5b21b6;

          width: 32px;

        }


        /* Date */

        tbody td:nth-child(3) {

          font-weight: 700;

          color: #1d4ed8;

        }


        /* Day */

        tbody td:nth-child(4) {

          font-weight: 700;

          color: #7c3aed;

        }


        /* Start time */

        tbody td:nth-child(5) {

          font-weight: 700;

          color: #047857;

        }


        /* End time */

        tbody td:nth-child(6) {

          font-weight: 700;

          color: #b45309;

        }


        /* Marks */

        tbody td:nth-child(7),

        tbody td:nth-child(8) {

          font-weight: 800;

          color: #be123c;

        }


        /* =========================================
           NOTE
           ========================================= */

        .note {

          margin-top: 15px;

          padding: 10px 12px;

          border-left: 5px solid #facc15;

          border-top: 1px solid #fde68a;

          border-right: 1px solid #fde68a;

          border-bottom: 1px solid #fde68a;

          border-radius: 6px;

          background: #fffbeb;

          color: #713f12;

          font-size: 10.5px;

          line-height: 1.5;

        }


        .note strong {

          color: #92400e;

        }


        /* =========================================
           SIGNATURES
           ========================================= */

        .signatures {

          display: flex;

          justify-content: space-between;

          align-items: flex-end;

          margin-top: 55px;

          padding: 0 35px;

        }


        .signature {

          width: 175px;

          text-align: center;

          font-size: 11px;

          font-weight: 700;

          color: #374151;

        }


        .signature-line {

          border-top: 2px solid #5b21b6;

          margin-bottom: 7px;

        }


        /* =========================================
           FOOTER
           ========================================= */

        .footer {

          text-align: center;

          margin-top: 25px;

          padding-top: 8px;

          border-top: 1px solid #ddd6fe;

          font-size: 8.5px;

          color: #6b7280;

        }


        /* =========================================
           PRINT SETTINGS
           ========================================= */

        @media print {

          html,
          body {

            width: 210mm;

            min-height: 297mm;

          }


          body {

            -webkit-print-color-adjust: exact !important;

            print-color-adjust: exact !important;

          }


          .school-header,
          thead th {

            -webkit-print-color-adjust: exact !important;

            print-color-adjust: exact !important;

          }


          table {

            page-break-inside: avoid;

          }


          tr {

            page-break-inside: avoid;

            page-break-after: auto;

          }


          .note {

            page-break-inside: avoid;

          }


          .signatures {

            page-break-inside: avoid;

          }

        }

      </style>

    </head>


    <body>


      <!-- =========================================
           SCHOOL HEADER
           ========================================= -->

      <div class="school-header">

        <h1>
          Government Girls Primary School
        </h1>

        <h2>
          Sarmast Mira Khel Bannu
        </h2>

        <div class="school-motto">
          Educate Today, Empower Tomorrow.
        </div>

      </div>


      <!-- =========================================
           EXAM INFORMATION
           ========================================= -->

      <div class="document-title">

        <h2>
          ${escapeHtml(examName)}
        </h2>

        <div class="exam-info">

          <div>
            <strong>Exam Type:</strong>
            ${escapeHtml(examType)}
          </div>

          <div>
            <strong>Class:</strong>
            ${escapeHtml(className)}
          </div>

        </div>

      </div>


      <!-- =========================================
           EXAM TIMETABLE
           ========================================= -->

      <table>

        <thead>

          <tr>

            <th>#</th>

            <th>Subject</th>

            <th>Date</th>

            <th>Day</th>

            <th>Start Time</th>

            <th>End Time</th>

            <th>Max Marks</th>

            <th>Passing Marks</th>

          </tr>

        </thead>


        <tbody>

          ${examSubjects.map((item, index) => {

            const subjectName =
              subjectMap[item.subjectId] ||
              item.subjectName ||
              'Unknown Subject';


            return `

              <tr>

                <td>
                  ${index + 1}
                </td>


                <td class="subject">
                  ${escapeHtml(subjectName)}
                </td>


                <td>
                  ${
                    item.date
                      ? formatExamDate(item.date)
                      : 'Not Scheduled'
                  }
                </td>


                <td>
                  ${
                    item.date
                      ? getExamDay(item.date)
                      : '-'
                  }
                </td>


                <td>
                  ${item.startTime || '-'}
                </td>


                <td>
                  ${item.endTime || '-'}
                </td>


                <td>
                  ${item.maxMarks ?? '-'}
                </td>


                <td>
                  ${item.passingMarks ?? '-'}
                </td>

              </tr>

            `;

          }).join('')}

        </tbody>

      </table>


      <!-- =========================================
           NOTE
           ========================================= -->

      <div class="note">

        <strong>Note:</strong>

        Students should reach the examination room
        at least 15 minutes before the scheduled time.

      </div>


      <!-- =========================================
           SIGNATURES
           ========================================= -->

      <div class="signatures">


        <div class="signature">

          <div class="signature-line"></div>

          Class Teacher

        </div>


        <div class="signature">

          <div class="signature-line"></div>

          Head Mistress

        </div>


      </div>


      <!-- =========================================
           FOOTER
           ========================================= -->

      <div class="footer">

        Government Girls Primary School
        &nbsp;•&nbsp;
        Sarmast Mira Khel Bannu
        &nbsp;•&nbsp;
        Educate Today, Empower Tomorrow.

      </div>


      <script>

        window.onload = function() {

          setTimeout(function() {

            window.print();

          }, 500);

        };

      <\/script>


    </body>

    </html>

  `);


  printWindow.document.close();

};          

          
  } catch (error) {

    console.error(
      "Error viewing exam timetable:",
      error
    );

    alert(
      "Error loading exam timetable: " +
      error.message
    );

  }

};



/* ---------------------------------------------------
   DELETE COMPLETE CLASS EXAM
   --------------------------------------------------- */

window.deleteExamGroup = async function(groupId) {

  if (
    !confirm(
      "Are you sure you want to delete this complete exam and all of its subject schedules?"
    )
  ) {
    return;
  }


  try {

    /*
     * Find all subject records belonging to the
     * complete exam.
     */
    const groupedQuery = query(
      collection(db, "exams"),
      where("examGroupId", "==", groupId)
    );

    const groupedSnap =
      await getDocs(groupedQuery);


    if (!groupedSnap.empty) {

      for (const docSnap of groupedSnap.docs) {

        await deleteDoc(
          doc(db, "exams", docSnap.id)
        );

      }

    } else {

      /*
       * Legacy single exam record.
       */
      await deleteDoc(
        doc(db, "exams", groupId)
      );

    }


    await loadExams();

    alert(
      "Complete exam deleted successfully."
    );

  } catch (error) {

    console.error(
      "Error deleting exam:",
      error
    );

    alert(
      "Error deleting exam: " +
      error.message
    );
  }
};


/*
 * Make loadExams available globally because some
 * existing HTML/event code may call it directly.
 */
window.loadExams = loadExams;
     


/* ===================================================
   MODULE 6 & 7: MARKS ENTRY & AUTOMATIC RESULTS
   =================================================== */
async function loadMarksExamsDropdown() {
  const cls = document.getElementById('marks-filter-class')?.value;
  const examSelect = document.getElementById('marks-filter-exam');
  if (!examSelect) return;
  examSelect.innerHTML = '<option value="">Select Exam</option>';

  const snap = await getDocs(collection(db, "exams"));
  snap.forEach(e => {
    const data = e.data();
    if (!cls || data.class === cls) {
      examSelect.innerHTML += `<option value="${e.id}">${data.name} - ${data.class}</option>`;
    }
  });
}

function calculateGradeAndResult(obtained, max, passing) {
  const percentage = (obtained / max) * 100;
  let grade = 'F';
  if (percentage >= 80) grade = 'A+';
  else if (percentage >= 70) grade = 'A';
  else if (percentage >= 60) grade = 'B';
  else if (percentage >= 50) grade = 'C';
  else if (percentage >= 40) grade = 'D';

  const status = (obtained >= passing && percentage >= 40) ? 'Pass' : 'Fail';
  return { percentage: percentage.toFixed(1), grade, status };
}

async function loadMarks() {
  const tbody = document.getElementById('marks-table-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="10">Loading marks...</td></tr>`;

  const selectedExamId = document.getElementById('marks-filter-exam')?.value;
  const selectedClass = document.getElementById('marks-filter-class')?.value;

  let q = collection(db, "marks");
  const marksSnap = await getDocs(q);
  const studentsSnap = await getDocs(collection(db, "students"));
  const examsSnap = await getDocs(collection(db, "exams"));
  const subjectsSnap = await getDocs(collection(db, "subjects"));

  const studentMap = {};
  studentsSnap.forEach(s => studentMap[s.id] = s.data());
  const examMap = {};
  examsSnap.forEach(e => examMap[e.id] = { id: e.id, ...e.data() });
  const subjectMap = {};
  subjectsSnap.forEach(sub => subjectMap[sub.id] = sub.data().name);

  tbody.innerHTML = '';
  marksSnap.forEach(mDoc => {
    const data = mDoc.data();
    data.id = mDoc.id;

    const student = studentMap[data.studentId];
    const exam = examMap[data.examId];

    if (!student || !exam) return;
    if (selectedClass && student.class !== selectedClass) return;
    if (selectedExamId && data.examId !== selectedExamId) return;

    if (userRole === 'student' && student.userId !== currentUser.uid) return;

    const evalResult = calculateGradeAndResult(data.obtainedMarks, exam.maxMarks, exam.passingMarks);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${student.name}</td>
      <td>${student.admissionNumber}</td>
      <td>${student.class}</td>
      <td>${exam.name}</td>
      <td>${subjectMap[exam.subjectId] || 'N/A'}</td>
      <td>${data.obtainedMarks} / ${exam.maxMarks}</td>
      <td>${evalResult.percentage}%</td>
      <td><strong>${evalResult.grade}</strong></td>
      <td><span class="badge ${evalResult.status === 'Pass' ? 'green' : 'red'}">${evalResult.status}</span></td>
      <td>
        ${(userRole === 'superadmin' || userRole === 'admin' || userRole === 'teacher') ? `<button class="btn btn-primary btn-sm" onclick="openMarksModal('${data.id}')"><i class="fa fa-edit"></i></button>` : ''}
        ${(userRole === 'superadmin') ? `<button class="btn btn-danger btn-sm" onclick="deleteRecord('marks', '${data.id}', loadMarks)"><i class="fa fa-trash"></i></button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (!tbody.hasChildNodes()) {
    tbody.innerHTML = `<tr><td colspan="10">No mark records found.</td></tr>`;
  }
}

window.openMarksModal = async function(id = null) {
  let mark = { studentId: '', examId: '', obtainedMarks: '' };
  if (id) {
    const mDoc = await getDoc(doc(db, "marks", id));
    if (mDoc.exists()) mark = mDoc.data();
  }

  const studentsSnap = await getDocs(collection(db, "students"));
  let studentOpts = '';
  studentsSnap.forEach(s => {
    const sData = s.data();
    studentOpts += `<option value="${s.id}" ${mark.studentId === s.id ? 'selected' : ''}>${sData.name} (${sData.class} - Adm: ${sData.admissionNumber})</option>`;
  });

  const examsSnap = await getDocs(collection(db, "exams"));
  let examOpts = '';
  examsSnap.forEach(e => {
    const eData = e.data();
    examOpts += `<option value="${e.id}" ${mark.examId === e.id ? 'selected' : ''}>${eData.name} - ${eData.class} (Max: ${eData.maxMarks})</option>`;
  });

  const html = `
    <form id="marks-form">
      <div class="form-group"><label for="m-student">Select Student *</label><select id="m-student" required>${studentOpts}</select></div>
      <div class="form-group"><label for="m-exam">Select Exam *</label><select id="m-exam" required>${examOpts}</select></div>
      <div class="form-group"><label for="m-obtained">Obtained Marks *</label><input type="number" id="m-obtained" value="${mark.obtainedMarks}" min="0" required></div>
      <button type="submit" class="btn btn-primary">${id ? 'Update' : 'Save'} Marks</button>
    </form>
  `;
  openModal(id ? "Edit Marks" : "Enter Marks", html);

  document.getElementById('marks-form').onsubmit = async (e) => {
    e.preventDefault();
    const examId = document.getElementById('m-exam').value;
    const obtainedMarks = Number(document.getElementById('m-obtained').value);

    const examDoc = await getDoc(doc(db, "exams", examId));
    if (!examDoc.exists()) return;
    const examData = examDoc.data();

    if (obtainedMarks > examData.maxMarks) {
      alert(`Obtained marks (${obtainedMarks}) cannot exceed Maximum Marks (${examData.maxMarks}) for this exam.`);
      return;
    }

    const payload = {
      studentId: document.getElementById('m-student').value,
      examId: examId,
      obtainedMarks: obtainedMarks,
      enteredBy: currentUser.email,
      updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(db, "marks", id), payload);
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "marks"), payload);
    }
    closeModal();
    loadMarks();
  };
};

window.viewStudentMarksheet = async function(studentId) {
  const studentDoc = await getDoc(doc(db, "students", studentId));
  if (!studentDoc.exists()) return;
  const student = studentDoc.data();

  document.getElementById('marksheet-student-details').innerHTML = `
    <div><strong>Student Name:</strong> ${student.name}</div>
    <div><strong>Father Name:</strong> ${student.fatherName}</div>
    <div><strong>Admission No:</strong> ${student.admissionNumber}</div>
    <div><strong>Class:</strong> ${student.class}</div>
  `;

  const marksSnap = await getDocs(query(collection(db, "marks"), where("studentId", "==", studentId)));
  const examsSnap = await getDocs(collection(db, "exams"));
  const subjectsSnap = await getDocs(collection(db, "subjects"));

  const examMap = {};
  examsSnap.forEach(e => examMap[e.id] = e.data());
  const subjectMap = {};
  subjectsSnap.forEach(s => subjectMap[s.id] = s.data().name);

  const tbody = document.getElementById('marksheet-table-body');
  tbody.innerHTML = '';

  let totalMax = 0;
  let totalObtained = 0;

  marksSnap.forEach(mDoc => {
    const data = mDoc.data();
    const exam = examMap[data.examId];
    if (!exam) return;

    totalMax += exam.maxMarks;
    totalObtained += data.obtainedMarks;

    const evalRes = calculateGradeAndResult(data.obtainedMarks, exam.maxMarks, exam.passingMarks);

    tbody.innerHTML += `
      <tr>
        <td>${subjectMap[exam.subjectId] || 'N/A'}</td>
        <td>${exam.name}</td>
        <td>${exam.maxMarks}</td>
        <td>${exam.passingMarks}</td>
        <td>${data.obtainedMarks}</td>
        <td>${evalRes.percentage}%</td>
        <td>${evalRes.grade}</td>
        <td>${evalRes.status}</td>
      </tr>
    `;
  });

  if (totalMax > 0) {
    const overallRes = calculateGradeAndResult(totalObtained, totalMax, Math.round(totalMax * 0.4));
    tbody.innerHTML += `
      <tr style="font-weight: bold; background: #f8fafc;">
        <td colspan="2">TOTAL OVERALL</td>
        <td>${totalMax}</td>
        <td>-</td>
        <td>${totalObtained}</td>
        <td>${overallRes.percentage}%</td>
        <td>${overallRes.grade}</td>
        <td>${overallRes.status}</td>
      </tr>
    `;
  } else {
    tbody.innerHTML = `<tr><td colspan="8">No marks recorded yet for this student.</td></tr>`;
  }

  document.getElementById('marksheet-modal').style.display = 'flex';
};

/* ===================================================
   MODULE 8 & 9: ATTENDANCE & MONTHLY REPORT
   =================================================== */
async function loadAttendance() {
  const tbody = document.getElementById('attendance-table-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6">Loading attendance...</td></tr>`;

  const dateVal = document.getElementById('attendance-date-filter')?.value;
  const classVal = document.getElementById('attendance-class-filter')?.value;

  const snap = await getDocs(query(collection(db, "attendance"), where("date", "==", dateVal), where("class", "==", classVal)));
  const studentsSnap = await getDocs(collection(db, "students"));
  const studentMap = {};
  studentsSnap.forEach(s => studentMap[s.id] = s.data());

  tbody.innerHTML = '';
  snap.forEach(aDoc => {
    const data = aDoc.data();
    data.id = aDoc.id;
    const student = studentMap[data.studentId];
    if (!student) return;

    if (userRole === 'student' && student.userId !== currentUser.uid) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.date}</td>
      <td>${student.name}</td>
      <td>${student.admissionNumber}</td>
      <td>${data.class}</td>
      <td><strong class="status-${data.status.toLowerCase()}">${data.status}</strong></td>
      <td>
        ${(userRole === 'superadmin' || userRole === 'admin' || userRole === 'teacher') ? `<button class="btn btn-primary btn-sm" onclick="editSingleAttendance('${data.id}', '${data.status}')"><i class="fa fa-edit"></i></button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (!tbody.hasChildNodes()) {
    tbody.innerHTML = `<tr><td colspan="6">No attendance recorded for this date and class.</td></tr>`;
  }
}

window.openAttendanceModal = async function() {
  const selectedClass = document.getElementById('attendance-class-filter').value;
  const selectedDate = document.getElementById('attendance-date-filter').value;

  const studentsSnap = await getDocs(query(collection(db, "students"), where("class", "==", selectedClass)));
  if (studentsSnap.empty) {
    alert(`No students found in ${selectedClass}.`);
    return;
  }

  let studentRows = '';
  studentsSnap.forEach(s => {
    const sData = s.data();
    studentRows += `
      <tr data-student-id="${s.id}">
        <td>${sData.name} (${sData.admissionNumber})</td>
        <td>
          <select class="attendance-status-input">
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
            <option value="Leave">Leave</option>
          </select>
        </td>
      </tr>
    `;
  });

  const html = `
    <form id="mark-attendance-form">
      <p><strong>Class:</strong> ${selectedClass} | <strong>Date:</strong> ${selectedDate}</p>
      <table class="data-table" style="margin: 15px 0;">
        <thead><tr><th>Student</th><th>Status</th></tr></thead>
        <tbody>${studentRows}</tbody>
      </table>
      <button type="submit" class="btn btn-primary">Save Attendance</button>
    </form>
  `;
  openModal("Mark Class Attendance", html);

  document.getElementById('mark-attendance-form').onsubmit = async (e) => {
    e.preventDefault();
    const rows = document.querySelectorAll('#mark-attendance-form tbody tr');
    
    for (const row of rows) {
      const studentId = row.getAttribute('data-student-id');
      const status = row.querySelector('.attendance-status-input').value;

      const existing = await getDocs(query(collection(db, "attendance"), where("studentId", "==", studentId), where("date", "==", selectedDate)));
      
      if (!existing.empty) {
        await updateDoc(doc(db, "attendance", existing.docs[0].id), { status, markedBy: currentUser.email, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, "attendance"), {
          studentId,
          class: selectedClass,
          date: selectedDate,
          status,
          markedBy: currentUser.email,
          createdAt: serverTimestamp()
        });
      }
    }
    closeModal();
    loadAttendance();
  };
};

window.editSingleAttendance = async function(id, currentStatus) {
  const newStatus = prompt("Enter status (Present / Absent / Leave):", currentStatus);
  if (['Present', 'Absent', 'Leave'].includes(newStatus)) {
    await updateDoc(doc(db, "attendance", id), { status: newStatus, markedBy: currentUser.email, updatedAt: serverTimestamp() });
    loadAttendance();
  } else if (newStatus !== null) {
    alert("Invalid Status. Must be Present, Absent, or Leave.");
  }
};

async function loadMonthlyReport() {
  const month = parseInt(document.getElementById('report-month').value);
  const year = parseInt(document.getElementById('report-year').value);
  const cls = document.getElementById('report-class').value;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  document.getElementById('report-subtitle').innerText = `Class: ${cls} | Month: ${monthNames[month]} ${year}`;

  const studentsSnap = await getDocs(query(collection(db, "students"), where("class", "==", cls)));
  const attendanceSnap = await getDocs(query(collection(db, "attendance"), where("class", "==", cls)));

  const reportData = {};
  studentsSnap.forEach(s => {
    reportData[s.id] = { name: s.data().name, adm: s.data().admissionNumber, present: 0, absent: 0, leave: 0, total: 0 };
  });

  attendanceSnap.forEach(aDoc => {
    const data = aDoc.data();
    const aDate = new Date(data.date);
    if (aDate.getMonth() === month && aDate.getFullYear() === year) {
      if (reportData[data.studentId]) {
        reportData[data.studentId].total++;
        if (data.status === 'Present') reportData[data.studentId].present++;
        else if (data.status === 'Absent') reportData[data.studentId].absent++;
        else if (data.status === 'Leave') reportData[data.studentId].leave++;
      }
    }
  });

  const tbody = document.getElementById('monthly-report-table-body');
  tbody.innerHTML = '';
  Object.values(reportData).forEach(st => {
    const pct = st.total > 0 ? ((st.present / st.total) * 100).toFixed(1) : '0.0';
    tbody.innerHTML += `
      <tr>
        <td>${st.adm}</td>
        <td>${st.name}</td>
        <td>${st.present}</td>
        <td>${st.absent}</td>
        <td>${st.leave}</td>
        <td>${st.total}</td>
        <td><strong>${pct}%</strong></td>
      </tr>
    `;
  });

  if (!tbody.hasChildNodes()) {
    tbody.innerHTML = `<tr><td colspan="7">No data available for this selection.</td></tr>`;
  }
}

/* ===================================================
   MODULE 10: TIMETABLE MANAGEMENT
   =================================================== */
async function loadTimetable() {
  const tbody = document.getElementById('timetable-table-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7">Loading timetable...</td></tr>`;

  const cls = document.getElementById('timetable-filter-class')?.value;
  const day = document.getElementById('timetable-filter-day')?.value;

  const snap = await getDocs(query(collection(db, "timetable"), where("class", "==", cls), where("day", "==", day)));

  tbody.innerHTML = '';
  snap.forEach(tDoc => {
    const data = tDoc.data();
    data.id = tDoc.id;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.period}</td>
      <td>${data.class}</td>
      <td>${data.day}</td>
      <td>${data.subject}</td>
      <td>${data.teacher}</td>
      <td>${data.startTime} - ${data.endTime}</td>
      <td>
        ${(userRole === 'superadmin' || userRole === 'admin') ? `<button class="btn btn-primary btn-sm" onclick="openTimetableModal('${data.id}')"><i class="fa fa-edit"></i></button>` : ''}
        ${(userRole === 'superadmin') ? `<button class="btn btn-danger btn-sm" onclick="deleteRecord('timetable', '${data.id}', loadTimetable)"><i class="fa fa-trash"></i></button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (!tbody.hasChildNodes()) {
    tbody.innerHTML = `<tr><td colspan="7">No timetable periods assigned for ${cls} on ${day}.</td></tr>`;
  }
}

window.openTimetableModal = async function(id = null) {
  let tt = { period: '1st Period', class: 'Class 1', day: 'Monday', subject: '', teacher: '', startTime: '08:00', endTime: '08:45' };
  if (id) {
    const tDoc = await getDoc(doc(db, "timetable", id));
    if (tDoc.exists()) tt = tDoc.data();
  }

  const html = `
    <form id="timetable-form">
      <div class="form-group"><label for="tt-period">Period Title *</label><input type="text" id="tt-period" value="${tt.period}" required></div>
      <div class="form-group"><label for="tt-class">Class *</label>
        <select id="tt-class">${['Class 1','Class 2','Class 3','Class 4','Class 5'].map(c => `<option value="${c}" ${tt.class === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label for="tt-day">Day *</label>
        <select id="tt-day">${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => `<option value="${d}" ${tt.day === d ? 'selected' : ''}>${d}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label for="tt-subject">Subject *</label><input type="text" id="tt-subject" value="${tt.subject}" required></div>
      <div class="form-group"><label for="tt-teacher">Teacher *</label><input type="text" id="tt-teacher" value="${tt.teacher}" required></div>
      <div class="form-group"><label for="tt-start">Start Time</label><input type="time" id="tt-start" value="${tt.startTime}"></div>
      <div class="form-group"><label for="tt-end">End Time</label><input type="time" id="tt-end" value="${tt.endTime}"></div>
      <button type="submit" class="btn btn-primary">${id ? 'Update' : 'Save'} Period</button>
    </form>
  `;
  openModal(id ? "Edit Timetable Period" : "Add Timetable Period", html);

  document.getElementById('timetable-form').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      period: document.getElementById('tt-period').value,
      class: document.getElementById('tt-class').value,
      day: document.getElementById('tt-day').value,
      subject: document.getElementById('tt-subject').value,
      teacher: document.getElementById('tt-teacher').value,
      startTime: document.getElementById('tt-start').value,
      endTime: document.getElementById('tt-end').value,
      updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(db, "timetable", id), payload);
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "timetable"), payload);
    }
    closeModal();
    loadTimetable();
  };
};

/* ===================================================
   MODULE 11: NOTICES & CALENDAR
   =================================================== */
async function loadNotices() {
  const container = document.getElementById('notices-container');
  if (!container) return;
  container.innerHTML = '<p>Loading notices...</p>';

  const snap = await getDocs(collection(db, "notices"));
  container.innerHTML = '';

  snap.forEach(nDoc => {
    const data = nDoc.data();
    data.id = nDoc.id;

    const card = document.createElement('div');
    card.className = 'notice-card';
    card.innerHTML = `
      <span class="notice-type ${data.type}">${data.type}</span>
      <h4>${data.title}</h4>
      <small><i class="fa fa-calendar"></i> ${data.date}</small>
      <p style="margin-top: 8px; font-size: 0.9rem;">${data.text}</p>
      <div style="margin-top: 10px; display: flex; gap: 5px;">
        ${(userRole === 'superadmin' || userRole === 'admin') ? `<button class="btn btn-primary btn-sm" onclick="openNoticeModal('${data.id}')"><i class="fa fa-edit"></i></button>` : ''}
        ${(userRole === 'superadmin') ? `<button class="btn btn-danger btn-sm" onclick="deleteRecord('notices', '${data.id}', loadNotices)"><i class="fa fa-trash"></i></button>` : ''}
      </div>
    `;
    container.appendChild(card);
  });

  if (!container.hasChildNodes()) {
    container.innerHTML = '<p>No notices or events published.</p>';
  }
}

window.openNoticeModal = async function(id = null) {
  let notice = { title: '', type: 'Notice', date: '', text: '' };
  if (id) {
    const nDoc = await getDoc(doc(db, "notices", id));
    if (nDoc.exists()) notice = nDoc.data();
  }

  const html = `
    <form id="notice-form">
      <div class="form-group"><label for="n-title">Title *</label><input type="text" id="n-title" value="${notice.title}" required></div>
      <div class="form-group"><label for="n-type">Type *</label>
        <select id="n-type">
          ${['Notice','Holiday','Event','Exam'].map(t => `<option value="${t}" ${notice.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label for="n-date">Date *</label><input type="date" id="n-date" value="${notice.date}" required></div>
      <div class="form-group"><label for="n-text">Details</label><textarea id="n-text" rows="3">${notice.text}</textarea></div>
      <button type="submit" class="btn btn-primary">${id ? 'Update' : 'Save'} Notice</button>
    </form>
  `;
  openModal(id ? "Edit Notice/Event" : "Add Notice/Event", html);

  document.getElementById('notice-form').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('n-title').value,
      type: document.getElementById('n-type').value,
      date: document.getElementById('n-date').value,
      text: document.getElementById('n-text').value,
      createdBy: currentUser.email,
      updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(db, "notices", id), payload);
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "notices"), payload);
    }
    closeModal();
    loadNotices();
  };
};

/* ===================================================
   MODULE 12: USER MANAGEMENT (SUPERADMIN ONLY)
   =================================================== */
async function loadUsers() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5">Loading system users...</td></tr>`;

  const snap = await getDocs(collection(db, "users"));
  tbody.innerHTML = '';

  snap.forEach(uDoc => {
    const data = uDoc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${uDoc.id}</code></td>
      <td>${data.name || 'N/A'}</td>
      <td>${data.email}</td>
      <td><span class="badge">${data.role}</span></td>
      <td>${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
    `;
    tbody.appendChild(tr);
  });
}

window.openUserModal = function() {
  const html = `
    <form id="create-user-form">
      <div class="form-group"><label for="u-name">Full Name *</label><input type="text" id="u-name" required></div>
      <div class="form-group"><label for="u-email">Email Address *</label><input type="email" id="u-email" required></div>
      <div class="form-group"><label for="u-pass">Password * (min 6 chars)</label><input type="password" id="u-pass" required minlength="6"></div>
      <div class="form-group"><label for="u-role">System Role *</label>
        <select id="u-role">
          <option value="admin">Admin</option>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
        </select>
      </div>
      <button type="submit" id="u-submit" class="btn btn-primary">Create User Account</button>
    </form>
  `;
  openModal("Create System User Account", html);

  document.getElementById('create-user-form').onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('u-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "Creating account...";
    }

    const name = document.getElementById('u-name').value;
    const email = document.getElementById('u-email').value;
    const password = document.getElementById('u-pass').value;
    const role = document.getElementById('u-role').value;

    try {
      const creds = await createUserWithEmailAndPassword(secondaryAuth, email, password);

      const newUid = creds.user.uid;

      await setDoc(doc(db, "users", newUid), {
        name,
        email,
        role,
        createdAt: serverTimestamp()
      });

      alert("User account successfully created!");
      closeModal();
      loadUsers();
    } catch (err) {
      alert("Failed to create user: " + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = "Create User Account";
      }
    }
  };
};

/* ===================================================
   COMMON UTILS
   =================================================== */
window.deleteRecord = async function(collName, id, refreshCallback) {
  if (userRole !== 'superadmin') {
    alert("Permission Denied: Only Super Admin can permanently delete records.");
    return;
  }

  if (confirm("Are you sure you want to permanently delete this record?")) {
    try {
      await deleteDoc(doc(db, collName, id));
      refreshCallback();
    } catch (err) {
      alert("Failed to delete record: " + err.message);
    }
  }
};
   
