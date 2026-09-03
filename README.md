# GGPS Sarmast Mira Khel Bannu — Full School Management System

## School
Govt. Girls Primary School Sarmast Mira Khel Bannu
Head Mistress: Miss Sheeba Khan
Classes: Class 1–5, no sections
Exams: Mid-Term and Annual
Motto: Educate Today, Empower Tomorrow.
Fees: None (government school)

## Roles
- Super Admin: full control
- Admin: school management except permanent deletion reserved for Super Admin
- Teacher: assigned-class attendance and marks
- Student: viewer-only

## Included modules
Dashboard, Students, Teachers, Subjects, Exams, Marks & Results, Attendance, Timetable, Notices & Calendar, User Profiles.

## Firebase setup
1. Firebase Console → Authentication → Sign-in method → Email/Password → Enable.
2. Create Firestore Database.
3. Create the first Authentication user.
4. Copy that user's UID.
5. Firestore → users → create document with the document ID exactly equal to that UID.
6. Add:
   name: School Admin
   email: your admin email
   role: superadmin
7. Publish `firestore.rules`.

## Deployment
Upload the entire folder to GitHub and connect the repository to Vercel, or deploy the folder through your hosting provider.

The Firebase web configuration in `firebase.js` is not a service-account private key. Never add a Firebase service-account JSON/private key to this frontend project.
