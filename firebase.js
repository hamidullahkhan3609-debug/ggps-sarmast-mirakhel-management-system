import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  orderBy, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// YOUR FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyDDj3kRJQeUTUaYgrqnJi8XyFLc44acSgA",
  authDomain: "ggps-sarmast-mira-khel-bannu.firebaseapp.com",
  projectId: "ggps-sarmast-mira-khel-bannu",
  storageBucket: "ggps-sarmast-mira-khel-bannu.firebasestorage.app",
  messagingSenderId: "525501747044",
  appId: "1:525501747044:web:37d7be050de763b1adf471",
  measurementId: "G-269YCDJJFH"
};

// INITIALIZE MAIN APP
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// SECONDARY APP FOR CREATING USERS WITHOUT LOGGING OUT SUPERADMIN
const secondaryApp = getApps().length > 1 ? getApps()[1] : initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

export { 
  auth, 
  db, 
  secondaryAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  orderBy, 
  serverTimestamp 
};

