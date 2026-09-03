import { 
  auth, db, secondaryAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
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
window.addEventListener('DOMContentLoaded', () => {
  if (authStatus) authStatus.innerText = "Firebase connected. Ready.";
  setupEventListeners();
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          currentUser = { uid: user.uid, ...userDoc.data() };
          userRole = currentUser.role ? currentUser.role.toLowerCase().replace(/\s+/g, '') : 'student';
          initializeUI();
        } else {
          showAuthError("No role profile found for this account. Please contact the Super Admin.");
          await signOut(auth);
        }
      } catch (err) {
        showAuthError("Error reading profile: " + err.message);
      }
    } else {
      currentUser = null;
      userRole = null;
      showLoginView();
    }
  });
});

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

  // Role Permissions Display
  const superAdminNav = document.querySelectorAll('.superadmin-only');
  superAdminNav.forEach(el => el.style.display = (userRole === 'superadmin') ? 'flex' : 'none');

  const editBtns = document.querySelectorAll('.edit-permission-only');
  editBtns.forEach(el => {
    el.style.display = (userRole === 'student') ? 'none' : 'inline-flex';
  });

  switchView('dashboard');
}

function setupEventListeners() {
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (authError) authError.style.display = 'none';
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const btn = document.getElementById('login-btn');
      if (btn) {
        btn.disabled = true;
        btn.innerText = "Signing in...";
      }

      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        showAuthError("Authentication failed: " + err.message);
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

function closeModal() {
  const mo = document.getElementById('modal-overlay');
  if (mo) mo.style.display = 'none';
}

/* ===================================================
   MODULE 1: DASHBOARD
   =================================================== */
async function loadDashboardData() {
  const studentsSnap = await getDocs(collection(db, "students"));
  const teachersSnap = await getDocs(collection(db, "teachers"));
  const subjectsSnap = await getDocs(collection(db, "subjects"));
  const examsSnap = await getDocs(collection(db, "exams"));

  document.getElementById('dash-total-students').innerText = studentsSnap.size;
  document.getElementById('dash-total-teachers').innerText = teachersSnap.size;
  document.getElementById('dash-total-subjects').innerText = subjectsSnap.size;
  document.getElementById('dash-total-exams').innerText = examsSnap.size;

  const counts = { "Class 1": 0, "Class 2": 0, "Class 3": 0, "Class 4": 0, "Class 5": 0 };
  studentsSnap.forEach(doc => {
    const cls = doc.data().class;
    if (counts[cls] !== undefined) counts[cls]++;
  });

  document.getElementById('dash-c1').innerText = `${counts["Class 1"]} Students`;
  document.getElementById('dash-c2').innerText = `${counts["Class 2"]} Students`;
  document.getElementById('dash-c3').innerText = `${counts["Class 3"]} Students`;
  document.getElementById('dash-c4').innerText = `${counts["Class 4"]} Students`;
  document.getElementById('dash-c5').innerText = `${counts["Class 5"]} Students`;
}

/* ===================================================
   MODULE 2: STUDENT MANAGEMENT
   =================================================== */
async function loadStudents() {
  const tbody = document.getElementById('students-table-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7">Loading students...</td></tr>`;

  let q = collection(db, "students");
  if (userRole === 'student') {
    q = query(q, where("userId", "==", currentUser.uid));
  }

  const snap = await getDocs(q);
  const filterClass = document.getElementById('student-filter-class')?.value;
  const search = document.getElementById('student-search')?.value.toLowerCase();

  tbody.innerHTML = '';
  snap.forEach(docSnap => {
    const data = docSnap.data();
    data.id = docSnap.id;

    if (filterClass && data.class !== filterClass) return;
    if (search && !data.name.toLowerCase().includes(search) && 
        !data.fatherName.toLowerCase().includes(search) && 
        !data.admissionNumber.toLowerCase().includes(search)) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.admissionNumber}</td>
      <td>${data.name}</td>
      <td>${data.fatherName}</td>
      <td>${data.class}</td>
      <td>${data.dateOfBirth || ''}</td>
      <td>${data.phone || ''}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewStudentMarksheet('${data.id}')"><i class="fa fa-file-invoice"></i> Result</button>
        ${(userRole === 'superadmin' || userRole === 'admin') ? `<button class="btn btn-primary btn-sm" onclick="openStudentModal('${data.id}')"><i class="fa fa-edit"></i></button>` : ''}
        ${(userRole === 'superadmin') ? `<button class="btn btn-danger btn-sm" onclick="deleteRecord('students', '${data.id}', loadStudents)"><i class="fa fa-trash"></i></button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (!tbody.hasChildNodes()) {
    tbody.innerHTML = `<tr><td colspan="7">No student records found.</td></tr>`;
  }
}

window.openStudentModal = async function(id = null) {
  let student = { name: '', fatherName: '', admissionNumber: '', class: 'Class 1', classId: '', dateOfBirth: '', phone: '', admissionDate: '' };
  if (id) {
    const sDoc = await getDoc(doc(db, "students", id));
    if (sDoc.exists()) student = sDoc.data();
  }

  const html = `
    <form id="student-form">
      <div class="form-group">
        <label for="s-name">Student Name *</label>
        <input type="text" id="s-name" value="${student.name}" required placeholder="Enter student name">
      </div>
      <div class="form-group">
        <label for="s-father">Father Name *</label>
        <input type="text" id="s-father" value="${student.fatherName}" required placeholder="Enter father name">
      </div>
      <div class="form-group">
        <label for="s-adm">Admission Number *</label>
        <input type="text" id="s-adm" value="${student.admissionNumber}" required placeholder="e.g. 1024">
      </div>
      <div class="form-group">
        <label for="s-class">Class *</label>
        <select id="s-class">
          ${['Class 1','Class 2','Class 3','Class 4','Class 5'].map(c => `<option value="${c}" ${student.class === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="s-dob">Date of Birth</label>
        <input type="date" id="s-dob" value="${student.dateOfBirth}">
      </div>
      <div class="form-group">
        <label for="s-phone">Phone Number</label>
        <input type="text" id="s-phone" value="${student.phone}" placeholder="03XXXXXXXXX">
      </div>
      <button type="submit" class="btn btn-primary">${id ? 'Update' : 'Save'} Student</button>
    </form>
  `;
  openModal(id ? "Edit Student" : "Add Student", html);

  document.getElementById('student-form').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('s-name').value,
      fatherName: document.getElementById('s-father').value,
      admissionNumber: document.getElementById('s-adm').value,
      class: document.getElementById('s-class').value,
      dateOfBirth: document.getElementById('s-dob').value,
      phone: document.getElementById('s-phone').value,
      updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(db, "students", id), payload);
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "students"), payload);
    }
    closeModal();
    loadStudents();
  };
};

/* ===================================================
   MODULE 3: TEACHER MANAGEMENT
   =================================================== */
async function loadTeachers() {
  const tbody = document.getElementById('teachers-table-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7">Loading teachers...</td></tr>`;

  const snap = await getDocs(collection(db, "teachers"));
  const search = document.getElementById('teacher-search')?.value.toLowerCase();

  tbody.innerHTML = '';
  snap.forEach(docSnap => {
    const data = docSnap.data();
    data.id = docSnap.id;

    if (search && !data.name.toLowerCase().includes(search) && !data.email.toLowerCase().includes(search)) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.name}</td>
      <td>${data.fatherName || ''}</td>
      <td>${data.email}</td>
      <td>${data.phone || ''}</td>
      <td>${data.assignedClass || 'None'}</td>
      <td>${data.subjects ? data.subjects.join(', ') : 'None'}</td>
      <td>
        ${(userRole === 'superadmin' || userRole === 'admin') ? `<button class="btn btn-primary btn-sm" onclick="openTeacherModal('${data.id}')"><i class="fa fa-edit"></i></button>` : ''}
        ${(userRole === 'superadmin') ? `<button class="btn btn-danger btn-sm" onclick="deleteRecord('teachers', '${data.id}', loadTeachers)"><i class="fa fa-trash"></i></button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (!tbody.hasChildNodes()) {
    tbody.innerHTML = `<tr><td colspan="7">No teacher records found.</td></tr>`;
  }
}

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
      <div class="form-group"><label for="t-phone">Phone</label><input type="text" id="t-phone" value="${teacher.phone}"></div>
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

/* ===================================================
   MODULE 4: SUBJECT MANAGEMENT
   =================================================== */
async function loadSubjects() {
  const tbody = document.getElementById('subjects-table-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="3">Loading subjects...</td></tr>`;

  const snap = await getDocs(collection(db, "subjects"));
  const filterClass = document.getElementById('subject-filter-class')?.value;

  tbody.innerHTML = '';
  snap.forEach(docSnap => {
    const data = docSnap.data();
    data.id = docSnap.id;

    if (filterClass && data.class !== filterClass) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.name}</td>
      <td>${data.class}</td>
      <td>
        ${(userRole === 'superadmin' || userRole === 'admin') ? `<button class="btn btn-primary btn-sm" onclick="openSubjectModal('${data.id}')"><i class="fa fa-edit"></i></button>` : ''}
        ${(userRole === 'superadmin') ? `<button class="btn btn-danger btn-sm" onclick="deleteRecord('subjects', '${data.id}', loadSubjects)"><i class="fa fa-trash"></i></button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (!tbody.hasChildNodes()) {
    tbody.innerHTML = `<tr><td colspan="3">No subjects found.</td></tr>`;
  }
}

window.openSubjectModal = async function(id = null) {
  let sub = { name: '', class: 'Class 1' };
  if (id) {
    const sDoc = await getDoc(doc(db, "subjects", id));
    if (sDoc.exists()) sub = sDoc.data();
  }

  const html = `
    <form id="subject-form">
      <div class="form-group"><label for="sub-name">Subject Name *</label><input type="text" id="sub-name" value="${sub.name}" required></div>
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
   =================================================== */
async function loadExams() {
  const tbody = document.getElementById('exams-table-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8">Loading exams...</td></tr>`;

  const snap = await getDocs(collection(db, "exams"));
  const subjectsSnap = await getDocs(collection(db, "subjects"));
  const subjectMap = {};
  subjectsSnap.forEach(s => subjectMap[s.id] = s.data().name);

  const filterClass = document.getElementById('exam-filter-class')?.value;
  const filterType = document.getElementById('exam-filter-type')?.value;

  tbody.innerHTML = '';
  snap.forEach(docSnap => {
    const data = docSnap.data();
    data.id = docSnap.id;

    if (filterClass && data.class !== filterClass) return;
    if (filterType && data.type !== filterType) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.name}</td>
      <td>${data.type || 'N/A'}</td>
      <td>${data.class}</td>
      <td>${subjectMap[data.subjectId] || 'N/A'}</td>
      <td>${data.maxMarks}</td>
      <td>${data.passingMarks}</td>
      <td>${data.date || ''}</td>
      <td>
        ${(userRole === 'superadmin' || userRole === 'admin') ? `<button class="btn btn-primary btn-sm" onclick="openExamModal('${data.id}')"><i class="fa fa-edit"></i></button>` : ''}
        ${(userRole === 'superadmin') ? `<button class="btn btn-danger btn-sm" onclick="deleteRecord('exams', '${data.id}', loadExams)"><i class="fa fa-trash"></i></button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (!tbody.hasChildNodes()) {
    tbody.innerHTML = `<tr><td colspan="8">No exams found.</td></tr>`;
  }
}

window.openExamModal = async function(id = null) {
  let exam = { name: 'Mid-Term Exam', type: 'Mid-Term', class: 'Class 1', subjectId: '', maxMarks: 100, passingMarks: 40, date: '' };
  if (id) {
    const eDoc = await getDoc(doc(db, "exams", id));
    if (eDoc.exists()) exam = eDoc.data();
  }

  const subjectsSnap = await getDocs(collection(db, "subjects"));
  let subjectOptions = '';
  subjectsSnap.forEach(s => {
    const sData = s.data();
    subjectOptions += `<option value="${s.id}" ${exam.subjectId === s.id ? 'selected' : ''}>${sData.name} (${sData.class})</option>`;
  });

  const html = `
    <form id="exam-form">
      <div class="form-group"><label for="ex-name">Exam Name *</label><input type="text" id="ex-name" value="${exam.name}" required></div>
      <div class="form-group"><label for="ex-type">Exam Type *</label>
        <select id="ex-type">
          <option value="Mid-Term" ${exam.type === 'Mid-Term' ? 'selected' : ''}>Mid-Term</option>
          <option value="Annual" ${exam.type === 'Annual' ? 'selected' : ''}>Annual</option>
        </select>
      </div>
      <div class="form-group"><label for="ex-class">Class *</label>
        <select id="ex-class">
          ${['Class 1','Class 2','Class 3','Class 4','Class 5'].map(c => `<option value="${c}" ${exam.class === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label for="ex-subject">Subject *</label>
        <select id="ex-subject" required>${subjectOptions}</select>
      </div>
      <div class="form-group"><label for="ex-max">Maximum Marks *</label><input type="number" id="ex-max" value="${exam.maxMarks}" min="1" required></div>
      <div class="form-group"><label for="ex-pass">Passing Marks *</label><input type="number" id="ex-pass" value="${exam.passingMarks}" min="0" required></div>
      <div class="form-group"><label for="ex-date">Exam Date</label><input type="date" id="ex-date" value="${exam.date}"></div>
      <button type="submit" class="btn btn-primary">${id ? 'Update' : 'Save'} Exam</button>
    </form>
  `;
  openModal(id ? "Edit Exam" : "Add Exam", html);

  document.getElementById('exam-form').onsubmit = async (e) => {
    e.preventDefault();
    const maxMarks = Number(document.getElementById('ex-max').value);
    const passingMarks = Number(document.getElementById('ex-pass').value);

    if (passingMarks > maxMarks) {
      alert("Passing marks cannot exceed maximum marks.");
      return;
    }

    const payload = {
      name: document.getElementById('ex-name').value,
      type: document.getElementById('ex-type').value,
      class: document.getElementById('ex-class').value,
      subjectId: document.getElementById('ex-subject').value,
      maxMarks: maxMarks,
      passingMarks: passingMarks,
      date: document.getElementById('ex-date').value,
      updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(db, "exams", id), payload);
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "exams"), payload);
    }
    closeModal();
    loadExams();
  };
};

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
   
