import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDDj3kRJQeUTUaYgrqnJi8XyFLc44acSgA",
  authDomain: "ggps-sarmast-mira-khel-bannu.firebaseapp.com",
  projectId: "ggps-sarmast-mira-khel-bannu",
  storageBucket: "ggps-sarmast-mira-khel-bannu.firebasestorage.app",
  messagingSenderId: "525501747044",
  appId: "1:525501747044:web:37d7be050de763b1adf471",
  measurementId: "G-269YCDJJFH"
};
const app=initializeApp(firebaseConfig);
export const auth=getAuth(app);
export const db=getFirestore(app);
