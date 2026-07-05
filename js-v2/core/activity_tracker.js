import { db } from './firebase.js';
import { doc, setDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// Ensure anonymous UID is saved
if (!localStorage.getItem('techbook_anon_uid')) {
  localStorage.setItem('techbook_anon_uid', 'anon_' + Math.random().toString(36).substring(2, 11));
}

let lastActivityTime = 0;
let lastLoggedActivity = '';

window.trackUserActivity = async function (description, logToHistory = false) {
  // Do not track guest/anonymous users
  if (!window._currentStudentUSN && !window._currentAdminUser) {
    return;
  }
  let userId = '';
  let name = '';
  let role = '';

  if (window._currentStudentUSN) {
    userId = window._currentStudentUSN;
    role = 'student';
    name = window._currentStudentData?.name || userId;
  } else if (window._currentAdminUser) {
    userId = window._currentAdminUser;
    role = window._currentAdminRole || 'admin';
    // Use window._currentAdminName if available, otherwise capitalize username prefix
    name = window._currentAdminName || window._currentAdminUser;
  } else {
    userId = localStorage.getItem('techbook_anon_uid');
    role = 'guest';
    name = 'Guest User';
  }

  const now = Date.now();
  // Throttle updates for identical heartbeats to reduce Firestore write costs
  if (description === lastLoggedActivity && now - lastActivityTime < 15000 && !logToHistory) {
    return;
  }
  
  lastActivityTime = now;
  lastLoggedActivity = description;
  window._currentActivityDesc = description;

  try {
    // 1. Update session state
    await setDoc(doc(db, "user_sessions", userId), {
      userId,
      name,
      role,
      currentView: description,
      lastActive: serverTimestamp()
    }, { merge: true });

    // 2. Log to activities collection
    if (logToHistory) {
      await addDoc(collection(db, "user_activities"), {
        userId,
        name,
        role,
        activity: description,
        timestamp: serverTimestamp()
      });
    }
  } catch (err) {
    console.warn("Activity tracking failed:", err.message);
  }
};

// Set up heartbeat every 30 seconds
setInterval(() => {
  if (window.adminLoggedIn || window._currentStudentUSN) {
    window.trackUserActivity(window._currentActivityDesc || "Active on website", false);
  }
}, 30000);
