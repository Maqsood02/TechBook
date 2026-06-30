import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-aoJvlXHec3XQojpD1eKPvOQtYwCL0gI",
  authDomain: "attendance-system-54b30.firebaseapp.com",
  projectId: "attendance-system-54b30",
  storageBucket: "attendance-system-54b30.firebasestorage.app",
  messagingSenderId: "48653878552",
  appId: "1:48653878552:web:cc7f71cafb5b9aebc24a6d",
  measurementId: "G-QBH17TSDJZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

setPersistence(auth, browserLocalPersistence).catch(e => console.warn("Persistence:", e));

// ── Expose db globally so inline scripts (e.g. email verification modal) can use it ──
window._techbookDb = db;

// ── Helper for email verification modal: update student's email & verified status ──
window._tbUpdateEmailVerified = async function(usn, email) {
  await updateDoc(doc(db, 'students', usn), {
    email: email,
    email_verified: true
  });
  console.log('✅ Email verified in Firestore for', usn);
};

console.log("🔥 Firebase connected");

export { app, auth, db, storage, updateDoc };

