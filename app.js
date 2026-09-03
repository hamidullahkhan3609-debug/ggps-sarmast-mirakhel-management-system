import {auth,db} from "./firebase.js";
import {onAuthStateChanged,signInWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {collection,getDocs,addDoc,updateDoc,deleteDoc,doc,getDoc,serverTimestamp,query,orderBy} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const $=id=>document.getElementById(id); let role="",me=null;
const cols=["students","teachers","subjects","exams","marks","attendance","timetable","notices","users"];
const adminRoles=["admin","superadmin"];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast=m=>{const t=$("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500)};
const authError=e=>({ "auth/invalid-credential":"Incorrect email or password.","auth/invalid-email":"Invalid email.","auth/user-not-found":"No account exists.","auth/wrong-password":"Incorrect password.","auth/too-many-requests":"Too many attempts. Try later."}[e.code]||e.message);

$("authStatus").textContent="Firebase connected. Ready.";
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();$("loginBtn").disabled=true;$("loginBtn").textContent="Signing in...";try{await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value)}catch(x){$("loginMessage").textContent=authError(x)}finally{$("loginBtn").disabled=false;$("loginBtn").textContent="Sign In"}});
$("logoutBtn").onclick=()=>signOut(auth);

onAuthStateChanged(auth,async u=>{if(!u){$("loginView").classList.remove("hidden");$("appView").classList.add("hidden");return}try{
 const s=await getDoc(doc(db,"users",u.uid));if(!s.exists())throw Error("No role profile found. Create users/"+u.uid+" in Firestore.");
 me={uid:u.uid,...s.data()};role=me.role;$("userBadge").textContent=`${me.name||u.email} • ${role}`;
 $("loginView").classList.add("hidden");$("appView").classList.remove("hidden");applyRole();await refreshAll();
}catch(x){$("loginMessage").textContent=x.message;await signOut(auth)}});

function applyRole(){
 document.querySelectorAll("[data-super]").forEach(x=>x.classList.toggle("hidden",role!=="superadmin"));
 const canAdmin=adminRoles.includes(role);
 ["addStudentBtn","addTeacherBtn","addSubjectBtn","addExamBtn","addMarkBtn","addAttendanceBtn","addTimetableBtn","addNoticeBtn"].forEach(id=>$(id)?.classList.toggle("hidden",!canAdmin));
 if(role==="teacher"){["addMarkBtn","addAttendanceBtn"].forEach(id=>$(id)?.classList.remove("hidden"))}
 if(role==="student"){document.querySelectorAll(".nav-btn").forEach(b=>{if(!["dashboard","marks","attendance","timetable","notices"].includes(b.dataset.page))b.classList.add("hidden")})}
}
document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));b.classList.add("active");$(b.dataset.page).classList.add("active");});

async function getAll(c){try{return (await getDocs(collection(db,c))).docs.map(d=>({id:d.id,...d.data()}))}catch(e){console.error(c,e);return []}}
async function refreshAll(){const [st,te,su,ex]=await Promise.all([getAll("students"),getAll("teachers"),getAll("subjects"),getAll("exams")]);$("studentCount").textContent=st.length;$("teacherCount").textContent=te.length;$("subjectCount").textContent=su.length;$("examCount").textContent=ex.length;await Promise.all([loadStudents(),loadTeachers(),loadSubjects(),loadExams(),loadMarks(),loadAttendance(),loadTimetable(),loadNotices(),loadUsers()])}
function setupCrud(formId,wrapId,cancelId,addId,fields,col,render){
 $(addId).onclick=()=>{ $(formId).reset();$(fields[0]).value="";$(wrapId).classList.remove("hidden") };
 $(cancelId).onclick=()=>$(wrapId).classList.add("hidden");
 $(formId).onsubmit=async e=>{e.preventDefault();if(!adminRoles.includes(role)&&!["markForm","attendanceForm"].includes(formId))return;
  const id=$(fields[0]).value,d={};fields.slice(1).forEach(x=>d[x.replace(/^[^a-z]+/,"")]= $(x).value);d.updatedAt=serverTimestamp();
  try{if(id)await updateDoc(doc(db,col,id),d);else await addDoc(collection(db,col),{...d,createdAt:serverTimestamp()});$(wrapId).classList.add("hidden");toast("Saved successfully");await render()}catch(x){alert("Save failed: "+x.message)}
 }
}
setupCrud("studentForm","studentFormWrap","cancelStudent","addStudentBtn",["studentId","studentName","fatherName","admissionNumber","studentClass","classId","dob","phone","admissionDate"],"students",loadStudents);
setupCrud("teacherForm","teacherFormWrap","cancelTeacher","addTeacherBtn",["teacherId","teacherName","teacherFather","teacherPhone","teacherEmail","teacherClass","teacherSubjects"],"teachers",loadTeachers);
setupCrud("subjectForm","subjectFormWrap","cancelSubject","addSubjectBtn",["subjectId","subjectName","subjectClass"],"subjects",loadSubjects);
setupCrud("examForm","examFormWrap","cancelExam","addExamBtn",["examId","examName","examClass","examMax","examPass","examDate"],"exams",loadExams);
setupCrud("timetableForm","timetableFormWrap","cancelTimetable","addTimetableBtn",["timetableId","ttClass","ttDay","ttPeriod","ttSubject","ttTeacher"],"timetable",loadTimetable);
setupCrud("noticeForm","noticeFormWrap","cancelNotice","addNoticeBtn",["noticeId","noticeTitle","noticeDate","noticeText"],"notices",loadNotices);

async function loadStudents(){const a=await getAll("students");$("studentsTable").innerHTML=a.map(d=>`<tr><td>${esc(d.studentName||d.name)}</td><td>${esc(d.fatherName)}</td><td>${esc(d.admissionNumber)}</td><td>${esc(d.studentClass||d.class)}</td><td>${esc(d.dob||d.dateOfBirth)}</td><td>${esc(d.phone)}</td><td>${actions("students",d.id,d)}</td></tr>`).join("")||empty(7);$("studentCount").textContent=a.length;fillSelect("markStudent",a,d=>d.id,d=>d.studentName||d.name,"Student")}
async function loadTeachers(){const a=await getAll("teachers");$("teachersTable").innerHTML=a.map(d=>`<tr><td>${esc(d.teacherName)}</td><td>${esc(d.teacherPhone)}</td><td>${esc(d.teacherEmail)}</td><td>${esc(d.teacherClass)}</td><td>${esc(d.teacherSubjects)}</td><td>${actions("teachers",d.id,d)}</td></tr>`).join("")||empty(6);$("teacherCount").textContent=a.length}
async function loadSubjects(){const a=await getAll("subjects");$("subjectsTable").innerHTML=a.map(d=>`<tr><td>${esc(d.subjectName)}</td><td>${esc(d.subjectClass)}</td><td>${actions("subjects",d.id,d)}</td></tr>`).join("")||empty(3);$("subjectCount").textContent=a.length}
async function loadExams(){const a=await getAll("exams");$("examsTable").innerHTML=a.map(d=>`<tr><td>${esc(d.examName)}</td><td>${esc(d.examClass)}</td><td>${esc(d.examMax)}</td><td>${esc(d.examPass)}</td><td>${esc(d.examDate)}</td><td>${actions("exams",d.id,d)}</td></tr>`).join("")||empty(6);$("examCount").textContent=a.length;fillSelect("markExam",a,d=>d.id,d=>`${d.examName} — ${d.examClass}`,"Exam")}
function grade(p){return p>=80?"A+":p>=70?"A":p>=60?"B":p>=50?"C":p>=40?"D":"F"}
async function loadMarks(){const a=await getAll("marks"),st=await getAll("students"),ex=await getAll("exams");$("marksTable").innerHTML=a.map(d=>{let s=st.find(x=>x.id===d.markStudent),e=ex.find(x=>x.id===d.markExam),m=Number(d.markObtained)||0,max=Number(e?.examMax)||100,p=m/max*100;return `<tr><td>${esc(s?.studentName||s?.name||d.markStudent)}</td><td>${esc(e?.examName||d.markExam)}</td><td>${m}/${max}</td><td>${p.toFixed(1)}</td><td>${grade(p)}</td><td>${p>=Number(e?.examPass||0)/max*100?"Pass":"Fail"}</td><td>${actions("marks",d.id,d)}</td></tr>`}).join("")||empty(7)}
async function loadAttendance(){const a=await getAll("attendance"),st=await getAll("students");$("attendanceTable").innerHTML=a.map(d=>{let s=st.find(x=>x.id===d.attendanceStudent);return `<tr><td>${esc(s?.studentName||s?.name||d.attendanceStudent)}</td><td>${esc(d.attendanceDate)}</td><td><span class="badge">${esc(d.attendanceStatus)}</span></td><td>${esc(d.markedBy||"")}</td><td>${actions("attendance",d.id,d)}</td></tr>`}).join("")||empty(5);fillSelect("attendanceStudent",st,d=>d.id,d=>d.studentName||d.name,"Student")}
async function loadTimetable(){const a=await getAll("timetable");$("timetableTable").innerHTML=a.map(d=>`<tr><td>${esc(d.ttClass)}</td><td>${esc(d.ttDay)}</td><td>${esc(d.ttPeriod)}</td><td>${esc(d.ttSubject)}</td><td>${esc(d.ttTeacher)}</td><td>${actions("timetable",d.id,d)}</td></tr>`).join("")||empty(6)}
async function loadNotices(){const a=await getAll("notices");$("noticesTable").innerHTML=a.map(d=>`<tr><td>${esc(d.noticeTitle)}</td><td>${esc(d.noticeDate)}</td><td>${esc(d.noticeText)}</td><td>${actions("notices",d.id,d)}</td></tr>`).join("")||empty(4)}
async function loadUsers(){if(role!=="superadmin")return;const a=await getAll("users");$("usersTable").innerHTML=a.map(d=>`<tr><td>${esc(d.id)}</td><td>${esc(d.name)}</td><td>${esc(d.email)}</td><td>${esc(d.role)}</td><td>${actions("users",d.id,d)}</td></tr>`).join("")||empty(5)}
function fillSelect(id,a,val,label,placeholder){const s=$(id),old=s.value;s.innerHTML=`<option value="">${placeholder}</option>`+a.map(x=>`<option value="${esc(val(x))}">${esc(label(x))}</option>`).join("");if(a.some(x=>String(val(x))===old))s.value=old}
function empty(n){return `<tr><td colspan="${n}">No records found.</td></tr>`}
function actions(col,id,d){let h="";if(["admin","superadmin"].includes(role)&&col!=="users"||role==="teacher"&&["marks","attendance"].includes(col)){h+=`<button class="small-btn edit" data-edit="${col}" data-id="${esc(id)}">Edit</button>`}if(role==="superadmin"||(["admin"].includes(role)&&["students","teachers","subjects","exams","timetable","notices"].includes(col))){if(role==="superadmin"||col!=="students")h+=`<button class="small-btn delete" data-delete="${col}" data-id="${esc(id)}">Delete</button>`}return h||"—"}

document.addEventListener("click",async e=>{const b=e.target;if(b.dataset.delete){if(!confirm("Delete this record permanently?"))return;try{await deleteDoc(doc(db,b.dataset.delete,b.dataset.id));toast("Deleted");await refreshAll()}catch(x){alert("Delete failed: "+x.message)}}if(b.dataset.edit){await editRecord(b.dataset.edit,b.dataset.id)}});

async function editRecord(col,id){const d=await getDoc(doc(db,col,id));if(!d.exists())return;const x=d.data();const maps={students:["studentForm","studentFormWrap","studentId","studentName","fatherName","admissionNumber","studentClass","classId","dob","phone","admissionDate"],teachers:["teacherForm","teacherFormWrap","teacherId","teacherName","teacherFather","teacherPhone","teacherEmail","teacherClass","teacherSubjects"],subjects:["subjectForm","subjectFormWrap","subjectId","subjectName","subjectClass"],exams:["examForm","examFormWrap","examId","examName","examClass","examMax","examPass","examDate"],timetable:["timetableForm","timetableFormWrap","timetableId","ttClass","ttDay","ttPeriod","ttSubject","ttTeacher"],notices:["noticeForm","noticeFormWrap","noticeId","noticeTitle","noticeDate","noticeText"],marks:["markForm","markFormWrap","markId","markStudent","markExam","markObtained"],attendance:["attendanceForm","attendanceFormWrap","attendanceId","attendanceStudent","attendanceDate","attendanceStatus"]};const m=maps[col];if(!m)return;$(m[2]).value=id;m.slice(3).forEach(id2=>{const key=Object.keys(x).find(k=>k.toLowerCase()===id2.toLowerCase());if(key&&$(id2))$(id2).value=x[key]??""});$(m[1]).classList.remove("hidden");document.querySelector(`[data-page="${col==="marks"?"marks":col==="attendance"?"attendance":col}"]`)?.click()}
setupCrud("markForm","markFormWrap","cancelMark","addMarkBtn",["markId","markStudent","markExam","markObtained"],"marks",loadMarks);
setupCrud("attendanceForm","attendanceFormWrap","cancelAttendance","addAttendanceBtn",["attendanceId","attendanceStudent","attendanceDate","attendanceStatus"],"attendance",loadAttendance);
$("attendanceForm").addEventListener("submit",async()=>{});
$("userForm").onsubmit=async e=>{e.preventDefault();if(role!=="superadmin")return;const id=$("userUid").value.trim();try{await updateDoc(doc(db,"users",id),{name:$("userName").value.trim(),email:$("userEmail").value.trim(),role:$("userRole").value,updatedAt:serverTimestamp()});$("userFormWrap").classList.add("hidden");toast("User profile updated")}catch(x){try{await (async()=>{await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js").then(()=>{});await addDoc(collection(db,"users"),{name:$("userName").value.trim(),email:$("userEmail").value.trim(),role:$("userRole").value,createdAt:serverTimestamp()})})();$("userFormWrap").classList.add("hidden");toast("Profile created; for UID-specific profile, use document ID in Firestore.")}catch(y){alert(y.message)}}};
$("addUserBtn").onclick=()=>{$("userForm").reset();$("userFormWrap").classList.remove("hidden")};$("cancelUser").onclick=()=>$("userFormWrap").classList.add("hidden");
