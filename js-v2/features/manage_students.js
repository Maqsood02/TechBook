import { auth, db } from '../core/firebase.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, setDoc, getDoc, getDocs, collection, query, where, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { $, val } from '../core/helpers.js';

// Global variables to keep track of loaded students
let loadedStudents = [];
let loadedUserAccounts = [];

// Initialize Student Management & User Details Logic
function initStudentManagement() {
  console.log("Initializing Student Management features...");

  // 1. Bind Registration Button for Admin
  const regBtn = document.getElementById("btn-admin-register");
  if (regBtn) {
    regBtn.addEventListener("click", async () => {
      const name = val("areg-name");
      const usn = val("areg-usn").toUpperCase().trim();
      const course = val("areg-course");
      const dept = val("areg-dept");
      const year = val("areg-year");
      const sem = val("areg-sem");
      const pass = val("areg-pass");
      const msgEl = document.getElementById("admin-register-msg");

      if (!name || !usn || !course || !dept || !year || !sem || !pass) {
        if (msgEl) msgEl.innerHTML = '<span style="color:#f87171;">⚠️ Please fill in all fields.</span>';
        return;
      }

      if (pass.length < 6) {
        if (msgEl) msgEl.innerHTML = '<span style="color:#f87171;">⚠️ Password must be at least 6 characters.</span>';
        return;
      }

      if (msgEl) msgEl.innerHTML = '<span style="color:#3d5af1;">⏳ Registering student account...</span>';
      regBtn.disabled = true;

      try {
        const studentEmail = `${usn.toLowerCase()}@techbook.ac.in`;
        // Create auth user
        const cred = await createUserWithEmailAndPassword(auth, studentEmail, pass);
        
        // Save user record in firestore
        await setDoc(doc(db, "students", usn), {
          uid: cred.user.uid,
          name,
          usn,
          course,
          dept,
          year,
          sem,
          email_verified: false,
          createdAt: new Date().toISOString()
        });

        if (msgEl) msgEl.innerHTML = `<span style="color:#10b981;">✅ Student ${usn} registered successfully!</span>`;
        
        // Reset form
        ["areg-name", "areg-usn", "areg-pass"].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = "";
        });
        ["areg-course", "areg-dept", "areg-year", "areg-sem"].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.selectedIndex = 0;
        });

        // Trigger stats reload if available
        if (typeof window.loadAdminDashboard === 'function') window.loadAdminDashboard();

      } catch (err) {
        console.error("Admin student registration error:", err);
        if (msgEl) {
          if (err.code === 'auth/email-already-in-use') {
            msgEl.innerHTML = `<span style="color:#f87171;">❌ USN ${usn} is already registered!</span>`;
          } else {
            msgEl.innerHTML = `<span style="color:#f87171;">❌ Registration failed: ${err.message}</span>`;
          }
        }
      } finally {
        regBtn.disabled = false;
      }
    });
  }

  // 2. Bind Filter / Load Students Button (Bulk section)
  const loadBtn = document.getElementById("btn-preview-bulk");
  if (loadBtn) {
    loadBtn.addEventListener("click", async () => {
      const dept = val("bulk-filter-dept");
      const sem = val("bulk-filter-sem");
      const year = val("bulk-filter-year");
      const previewList = document.getElementById("bulk-preview-list");

      if (previewList) {
        previewList.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:20px;">⏳ Querying students...</p>';
      }

      loadBtn.disabled = true;
      loadBtn.textContent = '⏳ Loading...';

      try {
        let q = collection(db, "students");
        const conditions = [];

        if (dept) conditions.push(where("dept", "==", dept));
        if (sem) conditions.push(where("sem", "==", sem));
        if (year) conditions.push(where("year", "==", year));

        if (conditions.length > 0) {
          q = query(q, ...conditions);
        }

        const snapshot = await getDocs(q);
        loadedStudents = [];
        snapshot.forEach(d => {
          loadedStudents.push({ id: d.id, ...d.data() });
        });

        // Update bulk match counts
        const matchCountEl = document.getElementById("bulk-match-count");
        if (matchCountEl) matchCountEl.textContent = loadedStudents.length;
        const updateCountEl = document.getElementById("bulk-update-count");
        if (updateCountEl) updateCountEl.textContent = loadedStudents.length;

        renderStudentList();

      } catch (err) {
        console.error("Error loading students:", err);
        if (previewList) {
          previewList.innerHTML = `<p style="color:#f87171;font-size:13px;text-align:center;padding:20px;">❌ Query failed: ${err.message}</p>`;
        }
      } finally {
        loadBtn.disabled = false;
        loadBtn.textContent = '🔍 Load Students';
      }
    });
  }

  // 3. Bind Load User Accounts Button (New "User Details" section)
  const loadUsersBtn = document.getElementById("btn-load-users");
  if (loadUsersBtn) {
    loadUsersBtn.addEventListener("click", async () => {
      const searchVal = val("user-search-input").toLowerCase().trim();
      const deptVal = val("user-filter-dept");
      const usersListEl = document.getElementById("users-accounts-list");

      if (usersListEl) {
        usersListEl.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:20px;">⏳ Fetching user accounts...</p>';
      }

      loadUsersBtn.disabled = true;
      loadUsersBtn.textContent = '⏳ Loading...';

      try {
        let q = collection(db, "students");
        if (deptVal) {
          q = query(q, where("dept", "==", deptVal));
        }

        const snapshot = await getDocs(q);
        loadedUserAccounts = [];

        snapshot.forEach(d => {
          const studentData = d.data();
          const studentUsn = d.id;
          const studentName = studentData.name || '';

          // Client-side search match by name or USN
          if (!searchVal || studentUsn.toLowerCase().includes(searchVal) || studentName.toLowerCase().includes(searchVal)) {
            loadedUserAccounts.push({ id: studentUsn, ...studentData });
          }
        });

        renderUserAccountsList();

      } catch (err) {
        console.error("Error loading user accounts:", err);
        if (usersListEl) {
          usersListEl.innerHTML = `<p style="color:#f87171;font-size:13px;text-align:center;padding:20px;">❌ Query failed: ${err.message}</p>`;
        }
      } finally {
        loadUsersBtn.disabled = false;
        loadUsersBtn.textContent = '🔍 Load Accounts';
      }
    });
  }

  // 4. Bind Save Edits Button in Modal
  const saveStudentBtn = document.getElementById("btn-save-student");
  if (saveStudentBtn) {
    saveStudentBtn.addEventListener("click", async () => {
      const usn = document.getElementById("edit-student-usn").value;
      const name = document.getElementById("edit-student-name").value.trim();
      const course = document.getElementById("edit-student-course").value;
      const dept = document.getElementById("edit-student-dept").value;
      const year = document.getElementById("edit-student-year").value;
      const sem = document.getElementById("edit-student-sem").value;
      const email = document.getElementById("edit-student-email").value.trim().toLowerCase();
      const verified = document.getElementById("edit-student-verified").value === "true";
      const msgEl = document.getElementById("edit-student-msg");

      if (!name || !course || !dept || !year || !sem) {
        if (msgEl) msgEl.innerHTML = '<div style="background:#fee2e2;border:1px solid #ef4444;color:#b91c1c;padding:8px 12px;border-radius:6px;font-size:13px;">⚠️ Fill in all required fields.</div>';
        return;
      }

      saveStudentBtn.disabled = true;
      saveStudentBtn.textContent = '⏳ Saving...';

      try {
        await updateDoc(doc(db, "students", usn), {
          name,
          course,
          dept,
          year,
          sem,
          email,
          email_verified: verified
        });

        if (msgEl) msgEl.innerHTML = '<div style="background:#d1fae5;border:1px solid #10b981;color:#065f46;padding:8px 12px;border-radius:6px;font-size:13px;">✅ Details updated successfully!</div>';

        // Refresh lists in memory
        [loadedStudents, loadedUserAccounts].forEach(list => {
          const idx = list.findIndex(s => s.id === usn);
          if (idx !== -1) {
            list[idx].name = name;
            list[idx].course = course;
            list[idx].dept = dept;
            list[idx].year = year;
            list[idx].sem = sem;
            list[idx].email = email;
            list[idx].email_verified = verified;
          }
        });

        renderStudentList();
        renderUserAccountsList();

        setTimeout(() => {
          document.getElementById('edit-student-modal').style.display = 'none';
        }, 1000);

      } catch (err) {
        console.error("Update student document error:", err);
        if (msgEl) msgEl.innerHTML = `<div style="background:#fee2e2;border:1px solid #ef4444;color:#b91c1c;padding:8px 12px;border-radius:6px;font-size:13px;">❌ Update failed: ${err.message}</div>`;
      } finally {
        saveStudentBtn.disabled = false;
        saveStudentBtn.textContent = 'Save Changes';
      }
    });
  }

  // 5. Bind Bulk Update Actions
  const bulkBtn = document.getElementById("btn-bulk-update");
  if (bulkBtn) {
    bulkBtn.addEventListener("click", async () => {
      if (loadedStudents.length === 0) {
        alert("Please load students first before bulk updating.");
        return;
      }

      const newSem = val("bulk-new-sem");
      const newYear = val("bulk-new-year");
      const newDept = val("bulk-new-dept");
      const newCourse = val("bulk-new-course");
      const bulkMsg = document.getElementById("bulk-update-msg");

      if (!newSem && !newYear && !newDept && !newCourse) {
        if (bulkMsg) bulkMsg.innerHTML = '<span style="color:#f87171;">⚠️ Select at least one field to change.</span>';
        return;
      }

      if (!confirm(`Are you sure you want to update all ${loadedStudents.length} loaded students?`)) return;

      bulkBtn.disabled = true;
      bulkBtn.textContent = '⏳ Updating...';
      if (bulkMsg) bulkMsg.innerHTML = '<span style="color:#3d5af1;">⏳ Applying updates to database...</span>';

      let success = 0;
      let fails = 0;

      for (const student of loadedStudents) {
        try {
          const updates = {};
          if (newSem) updates.sem = newSem;
          if (newYear) updates.year = newYear;
          if (newDept) updates.dept = newDept;
          if (newCourse) updates.course = newCourse;

          await updateDoc(doc(db, "students", student.id), updates);
          success++;

          // update memory list
          Object.assign(student, updates);
        } catch (err) {
          console.warn("Failed updating student", student.id, err.message);
          fails++;
        }
      }

      if (bulkMsg) {
        bulkMsg.innerHTML = `<span style="color:#10b981;">✅ Finished bulk update: ${success} successful, ${fails} failed.</span>`;
      }
      renderStudentList();
      bulkBtn.disabled = false;
      bulkBtn.textContent = `⚡ Update ${loadedStudents.length} Students`;
    });
  }

  // 6. Automatically trigger loading when clicking the "User Details" sidebar / navbar menu
  const navBtn = document.querySelector('.admin-nav-btn[data-section="sec-users-list"]');
  if (navBtn) {
    navBtn.addEventListener("click", () => {
      setTimeout(() => {
        const loadUsersBtn = document.getElementById("btn-load-users");
        if (loadUsersBtn) loadUsersBtn.click();
      }, 50);
    });
  }
}

// Render student list for bulk management
function renderStudentList() {
  const container = document.getElementById("bulk-preview-list");
  if (!container) return;

  if (loadedStudents.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:20px;">No students match the criteria.</p>';
    return;
  }

  container.innerHTML = "";
  loadedStudents.forEach(s => {
    container.appendChild(createStudentCardElement(s, true));
  });
}

// Render user list for User Details management (sec-users-list)
function renderUserAccountsList() {
  const container = document.getElementById("users-accounts-list");
  if (!container) return;

  if (loadedUserAccounts.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:20px;">No user accounts found matching the criteria.</p>';
    return;
  }

  container.innerHTML = "";
  loadedUserAccounts.forEach(s => {
    container.appendChild(createStudentCardElement(s, false));
  });
}

// Helper to construct a single student info card with separate action buttons
function createStudentCardElement(s, isBulkPreview = false) {
  const emailStatus = s.email_verified 
    ? '<span style="color:#10b981;font-weight:700;font-size:11px;">Verified ✓</span>'
    : '<span style="color:#f59e0b;font-weight:700;font-size:11px;">Unverified ❌</span>';

  const card = document.createElement("div");
  card.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;gap:12px;flex-wrap:wrap;transition:all 0.15s;margin-bottom:8px;box-shadow:0 2px 4px rgba(0,0,0,0.02);";
  
  // Left Info
  const infoDiv = document.createElement("div");
  infoDiv.style.cssText = "display:flex;flex-direction:column;gap:3px;flex:1;min-width:200px;";
  infoDiv.innerHTML = `
    <div style="font-weight:700;font-size:14px;color:#111827;display:flex;align-items:center;gap:6px;">
      <span style="font-size:15px;">👤</span> ${s.name} 
      <span style="font-size:11px;color:#6b7280;font-weight:400;background:#f3f4f6;padding:2px 6px;border-radius:4px;">${s.id}</span>
    </div>
    <div style="font-size:12px;color:#4b5563;font-weight:500;">
      ${s.course || 'B.Tech'} · <span style="color:#3d5af1;font-weight:600;">${s.dept || 'N/A'}</span> · Yr ${s.year || '?'} · Sem ${s.sem || '?'}
    </div>
    <div style="font-size:11px;color:#6b7280;display:flex;align-items:center;gap:6px;margin-top:2px;">
      ✉️ ${s.email || 'No email bound'} · ${emailStatus}
    </div>
  `;
  card.appendChild(infoDiv);

  // Right Action Buttons (Two separate buttons)
  const actionDiv = document.createElement("div");
  actionDiv.style.cssText = "display:flex;gap:8px;align-items:center;flex-shrink:0;";

  // Edit Button (Blue styling)
  const editBtn = document.createElement("button");
  editBtn.innerHTML = "✏️ Edit";
  editBtn.style.cssText = "padding:8px 16px;background:#eff6ff;border:1.5px solid #bfdbfe;color:#2563eb;font-weight:700;border-radius:8px;font-size:12px;cursor:pointer;transition:all 0.15s;display:inline-flex;align-items:center;gap:4px;";
  editBtn.onmouseover = () => { editBtn.style.background = "#dbeafe"; editBtn.style.borderColor = "#93c5fd"; };
  editBtn.onmouseout = () => { editBtn.style.background = "#eff6ff"; editBtn.style.borderColor = "#bfdbfe"; };
  editBtn.onclick = () => openEditStudentModal(s);
  actionDiv.appendChild(editBtn);

  // Delete Button (Red styling)
  const delBtn = document.createElement("button");
  delBtn.innerHTML = "🗑️ Delete";
  delBtn.style.cssText = "padding:8px 16px;background:#fef2f2;border:1.5px solid #fecaca;color:#dc2626;font-weight:700;border-radius:8px;font-size:12px;cursor:pointer;transition:all 0.15s;display:inline-flex;align-items:center;gap:4px;";
  delBtn.onmouseover = () => { delBtn.style.background = "#fee2e2"; delBtn.style.borderColor = "#fca5a5"; };
  delBtn.onmouseout = () => { delBtn.style.background = "#fef2f2"; delBtn.style.borderColor = "#fecaca"; };
  delBtn.onclick = () => deleteStudentAccount(s.id, s.name);
  actionDiv.appendChild(delBtn);

  card.appendChild(actionDiv);
  return card;
}

// Open Edit Modal with selected student details
function openEditStudentModal(student) {
  document.getElementById("edit-student-usn").value = student.id;
  document.getElementById("edit-student-name").value = student.name || "";
  document.getElementById("edit-student-course").value = student.course || "B.Tech";
  document.getElementById("edit-student-dept").value = student.dept || "CSE";
  document.getElementById("edit-student-year").value = student.year || "1";
  document.getElementById("edit-student-sem").value = student.sem || "1";
  document.getElementById("edit-student-email").value = student.email || "";
  document.getElementById("edit-student-verified").value = String(student.email_verified === true);
  
  const msgEl = document.getElementById("edit-student-msg");
  if (msgEl) msgEl.innerHTML = "";

  document.getElementById("edit-student-modal").style.display = "flex";
}

// Delete student account from Firestore
async function deleteStudentAccount(usn, name) {
  if (!confirm(`⚠️ WARNING: Are you sure you want to delete student account for ${name} (${usn})?\nThis action cannot be undone.`)) return;

  try {
    await deleteDoc(doc(db, "students", usn));
    alert(`✅ Student account for ${usn} deleted successfully.`);

    // Remove from in-memory arrays
    loadedStudents = loadedStudents.filter(s => s.id !== usn);
    loadedUserAccounts = loadedUserAccounts.filter(s => s.id !== usn);
    
    // Refresh lists
    renderStudentList();
    renderUserAccountsList();

    // Trigger dashboard stats reload
    if (typeof window.loadAdminDashboard === 'function') window.loadAdminDashboard();

  } catch (err) {
    console.error("Delete student account error:", err);
    alert(`❌ Failed to delete student account: ${err.message}`);
  }
}

// Expose initialized hook
window._initStudentManagement = initStudentManagement;
