import { auth, db } from '../core/firebase.js';
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, setDoc, getDoc, addDoc, collection, query, where, getDocs, orderBy, serverTimestamp, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { $, val } from '../core/helpers.js';

    /* ===============================
       👤 LOAD STUDENT DASHBOARD
    =============================== */
    async function loadStudentDashboard(usn) {
      window._currentStudentUSN = usn;
      try {
        const studentDoc = await getDoc(doc(db, "students", usn));
        if (!studentDoc.exists()) {
          msg("login-msg", "Student record not found. Please contact admin.", "error");
          return;
        }
        const data = studentDoc.data();

        // Hide admin/about tabs



        // Show student area
        $("student-auth").classList.add("hidden");
        $("student-area").classList.remove("hidden");

        // Apply cached features immediately to prevent delay/blank space
        try {
          const cached = localStorage.getItem('techbook_features');
          const cachedFeatures = cached ? JSON.parse(cached) : {};
          const featureMap = {
            attendanceEnabled: "stab-attendance",
            quizEnabled: "stab-quiz",
            quizHistoryEnabled: "stab-quiz-history",
            historyEnabled: "stab-history",
            notesEnabled: "stab-notes",
            pyqEnabled: "stab-pyq",
            qbankEnabled: "stab-qbank",
            iaTimetableEnabled: "stab-ia-timetable"
          };
          for (const [key, btnId] of Object.entries(featureMap)) {
            const btn = document.getElementById(btnId);
            const isEnabled = cachedFeatures[key] !== false; // Default to true if not cached
            if (btn) {
              if (isEnabled) btn.classList.remove("hidden");
              else btn.classList.add("hidden");
            }
          }
        } catch (cacheErr) {
          console.warn("Could not read cached features:", cacheErr);
        }

        if (typeof updateAppHistory === 'function') updateAppHistory(null, true);

        // Store email globally
        const studentEmail = auth.currentUser?.email || data.email || (usn.toLowerCase() + '@techbook.ac.in');
        window._currentStudentEmail = studentEmail;

        // Store full student record for other features (quiz result emails, etc.)
        window._currentStudentData = { ...data, _usn: usn };


        // Display profile
        $("student-info").innerHTML = `
          <div class="user-card-banner"></div>
          <div class="user-card-body">
            <div class="avatar">🎓</div>
            <div class="welcome">Welcome back, ${data.name.split(' ')[0]}! 👋</div>
            <div class="name">${data.name}</div>
            <div class="usn">${data.usn}</div>
            <hr/>
            <div class="profile-details">
              <div class="detail-pill"><div class="label">Course</div><div class="value">${data.course || 'B.Tech'}</div></div>
              <div class="detail-pill"><div class="label">Dept</div><div class="value">${data.dept || 'N/A'}</div></div>
              <div class="detail-pill"><div class="label">Year</div><div class="value">${data.year || 'N/A'}</div></div>
              <div class="detail-pill"><div class="label">Sem</div><div class="value">${data.sem || 'N/A'}</div></div>
            </div>
          </div>
        `;

        // Add Logout button to navbar
        const actions = $("navbar-actions");
        if (actions) {
          actions.innerHTML = `
            <button onclick="window.studentLogout()" 
              style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:#f9fafb;border:1px solid rgba(57,255,180,0.25);border-radius:10px;color:#3d5af1;font-weight:700;font-size:13px;cursor:pointer;transition:all 0.2s;"
              onmouseover="this.style.background='#eef0ff';this.style.transform='translateY(-1px)'"
              onmouseout="this.style.background='#f9fafb';this.style.transform=''">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3d5af1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Logout
            </button>
          `;
        }

        // Set today's date
        $("att-date").value = new Date().toISOString().split('T')[0];

        // Load attendance history
        loadStudentHistory(usn);

        // --- Real-time Feature Blocking Listener ---
        if (window._featureUnsubscribe) window._featureUnsubscribe();

        window._featureUnsubscribe = onSnapshot(doc(db, "settings", "features"), (snapshot) => {
          const features = snapshot.exists() ? snapshot.data() : {};
          try {
            localStorage.setItem('techbook_features', JSON.stringify(features));
          } catch (cacheErr) {
            console.warn("Could not write cached features:", cacheErr);
          }

          // Map features to their button IDs
          const featureMap = {
            attendanceEnabled: "stab-attendance",
            quizEnabled: "stab-quiz",
            quizHistoryEnabled: "stab-quiz-history",
            historyEnabled: "stab-history",
            notesEnabled: "stab-notes",
            pyqEnabled: "stab-pyq",
            qbankEnabled: "stab-qbank",
            iaTimetableEnabled: "stab-ia-timetable"
          };

          for (const [key, btnId] of Object.entries(featureMap)) {
            const btn = document.getElementById(btnId);
            const isEnabled = features[key] !== false; // Active by default if not set
            if (btn) {
              if (isEnabled) {
                btn.classList.remove("hidden");
              } else {
                btn.classList.add("hidden");
                // If student is currently viewing this tab, kick them back to home
                const activeTabId = `stab-content-${btnId.replace('stab-', '')}`;
                const tabContent = document.getElementById(activeTabId);
                if (tabContent && tabContent.style.display !== 'none') {
                  switchStudentTab(null);
                  msg("login-msg", "This feature has been temporarily disabled by Admin.", "info");
                }
              }
            }
          }
        });

      } catch (e) {
        console.error("loadStudentDashboard error:", e);
        msg("login-msg", "Error loading dashboard: " + e.message, "error");
      }
    }


    /* ===============================
       ✍️ MARK ATTENDANCE
    =============================== */
    $("btn-mark")?.addEventListener("click", async () => {
      const user = auth.currentUser;
      if (!user) return;

      const usn = user.email.split('@')[0].toUpperCase();
      const date = val("att-date");
      const remark = val("att-remark");

      try {
        // Check if already marked today
        const attId = `${usn}_${date}`;
        const attDoc = await getDoc(doc(db, "attendance", attId));

        if (attDoc.exists()) {
          return msg("att-msg", "Attendance already marked for today", "error");
        }

        // Get student data
        const studentDoc = await getDoc(doc(db, "students", usn));
        const studentData = studentDoc.data();

        // Get current session name
        let sessionName = "Not Set";
        try {
          const sessionDoc = await getDoc(doc(db, "settings", "session"));
          if (sessionDoc.exists()) {
            sessionName = sessionDoc.data().name || "Not Set";
          }
        } catch (e) {
          console.log("No session set");
        }

        // Mark attendance
        const now = new Date();
        await setDoc(doc(db, "attendance", attId), {
          usn,
          name: studentData.name,
          section: studentData.section,
          sem: studentData.sem || '',
          year: studentData.year,
          date,
          time: now.toLocaleTimeString(),
          timestamp: now.toISOString(),
          remark,
          session: sessionName,
          location: window.verifiedLocation || "Not Set"
        });

        msg("att-msg", "✓ Attendance marked successfully!", "success");
        $("att-remark").value = "";
        loadStudentHistory(usn);

      } catch (e) {
        msg("att-msg", "Error: " + e.message, "error");
      }
    });


    /* ===============================
       📜 LOAD STUDENT HISTORY
    =============================== */
    async function loadStudentHistory(usn) {
      try {
        const q = query(
          collection(db, "attendance"),
          where("usn", "==", usn)
        );

        const snapshot = await getDocs(q);
        const tbody = $("student-history");
        tbody.innerHTML = "";

        if (snapshot.empty) {
          tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No attendance records yet</td></tr>';
          return;
        }

        // Sort manually by timestamp
        const records = [];
        snapshot.forEach(doc => {
          records.push(doc.data());
        });
        records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        records.forEach(data => {
          const row = tbody.insertRow();

          const c1 = row.insertCell();
          c1.textContent = data.date || '';

          const c2 = row.insertCell();
          c2.textContent = data.time || '';

          const c3 = row.insertCell();
          c3.innerHTML = data.session || '<span style="color:#f59e0b;">Not Set</span>';

          const c4 = row.insertCell();
          c4.innerHTML = data.location || '<span style="color:#f59e0b;">Not Set</span>';

          const c5 = row.insertCell();
          c5.textContent = data.remark || '-';
        });
      } catch (e) {
        console.error("Error loading history:", e);
        const tbody = $("student-history");
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#f87171;">Error loading history</td></tr>';
      }
    }


    /* ===============================
       👤 ADMIN ROLE SYSTEM
    =============================== */
    window._currentAdminRole = null;
    window._currentAdminUser = null;
    window.adminLoggedIn = false;

    function loginAdmin(username, role) {
      window.adminLoggedIn = true;
      window._currentAdminUser = username;
      window._currentAdminRole = role;

      try {
        localStorage.setItem('techbook_admin_logged_in', 'true');
        localStorage.setItem('techbook_admin_user', username);
        localStorage.setItem('techbook_admin_role', role);
      } catch (e) {
        console.warn("Could not save admin session to localStorage:", e);
      }

      $("admin-login-block")?.classList.add("hidden");
      $("admin-area")?.classList.remove("hidden");

      applyRoleRestrictions();
      initAdminNav();

      // Add Logout button immediately to avoid waiting for database loads
      const actions = $("navbar-actions");
      if (actions) {
        actions.innerHTML = `
          <button onclick="window.adminLogout && window.adminLogout()" 
            style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:#f9fafb;border:1px solid rgba(57,255,180,0.25);border-radius:10px;color:#3d5af1;font-weight:700;font-size:13px;cursor:pointer;transition:all 0.2s;"
            onmouseover="this.style.background='#eef0ff';this.style.transform='translateY(-1px)'"
            onmouseout="this.style.background='#f9fafb';this.style.transform=''">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3d5af1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Logout
          </button>
        `;
      }

      loadAdminDashboard();
    }

    function restoreAdminSession() {
      try {
        const isAdmLoggedIn = localStorage.getItem('techbook_admin_logged_in') === 'true';
        if (isAdmLoggedIn) {
          const username = localStorage.getItem('techbook_admin_user');
          const role = localStorage.getItem('techbook_admin_role');
          
          const loginBlock = $("admin-login-block");
          const adminArea = $("admin-area");
          if (loginBlock && adminArea) {
            loginAdmin(username, role);
            if (typeof window.selectRole === 'function') {
              window.selectRole('admin');
            } else {
              const timer = setInterval(() => {
                if (typeof window.selectRole === 'function') {
                  window.selectRole('admin');
                  clearInterval(timer);
                }
              }, 20);
            }
          } else {
            setTimeout(restoreAdminSession, 50);
          }
        }
      } catch (e) {
        console.error("Error restoring admin session:", e);
      }
    }
    restoreAdminSession();

    window.adminLogout = function () {
      if (!confirm("Are you sure you want to log out from the Admin Dashboard?")) return;

      window.adminLoggedIn = false;
      window._currentAdminRole = null;
      window._currentAdminUser = null;

      try {
        localStorage.removeItem('techbook_admin_logged_in');
        localStorage.removeItem('techbook_admin_user');
        localStorage.removeItem('techbook_admin_role');
      } catch (e) {
        console.warn("Could not clear admin session from localStorage:", e);
      }

      // Reset UI state
      $("admin-area").classList.add("hidden");
      $("admin-login-block").classList.remove("hidden");

      // Clear navbar actions
      const actions = $("navbar-actions");
      if (actions) actions.innerHTML = "";

      // Clear interval if any
      if (adminRefreshInterval) {
        clearInterval(adminRefreshInterval);
        adminRefreshInterval = null;
      }

      msg("admin-login-msg", "Logged out successfully", "info");

      // Optional: go back to landing page
      showLandingPage();
    };

    async function bootstrapAdmins() {
      try {
        const snap = await getDocs(collection(db, "admins"));
        if (snap.empty) {
          console.log("🛠️ Bootstrapping default super_admin...");
          await setDoc(doc(db, "admins", "admin"), {
            passwordHash: CryptoJS.SHA256("admin123").toString(),
            role: "super_admin",
            createdAt: serverTimestamp()
          });
        }
      } catch (e) {
        if (e.code === 'permission-denied') {
          console.log("ℹ️ Admin collection restricted; skipping bootstrap.");
        } else {
          console.warn("Bootstrap check skipped:", e.message);
        }
      }
    }
    bootstrapAdmins();

    $("btn-admin-login")?.addEventListener("click", async () => {
      const btn = $("btn-admin-login");
      if (!btn || btn.disabled) return;

      const username = document.getElementById("admin-user")?.value.trim().toLowerCase() || "";
      const password = document.getElementById("admin-pass")?.value || "";

      if (!username || !password) {
        return msg("admin-login-msg", "Please fill all fields", "error");
      }

      const origText = btn.innerText;
      btn.disabled = true;
      btn.innerText = "Logging in...";

      console.log("Admin login attempt:", username);

      const isMasterBypass = (username === 'admin' && password === 'admin123');

      try {
        // Run getDoc with an 8-second timeout
        const docRef = doc(db, "admins", username);
        let adminDoc = null;
        try {
          adminDoc = await Promise.race([
            getDoc(docRef),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
          ]);
        } catch (dbErr) {
          console.warn("Database fetch deferred or timed out:", dbErr.message);
          if (isMasterBypass) {
            console.log("🛠️ Firestore offline or slow. Applying local master bypass...");
            loginAdmin('admin', 'super_admin');
            return;
          } else {
            throw new Error("Unable to connect to database. Please check your network connection.");
          }
        }

        if (adminDoc && adminDoc.exists()) {
          const data = adminDoc.data();
          const hash = CryptoJS.SHA256(password).toString();

          if (data.passwordHash === hash || isMasterBypass) {
            if (isMasterBypass && data.passwordHash !== hash) {
              console.log("🛠️ Syncing admin password to Firestore...");
              try {
                await setDoc(doc(db, "admins", "admin"), { passwordHash: hash }, { merge: true });
              } catch (_) {}
            }

            window._currentAdminRole = data.role || 'admin';
            window._currentAdminUser = username;

            // Authenticate with Firebase anonymously to enable Security Rules
            try {
              const authCred = await Promise.race([
                signInAnonymously(auth),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 6000))
              ]);
              await setDoc(doc(db, "admins_uids", authCred.user.uid), {
                username: username,
                role: window._currentAdminRole,
                loginSecret: "techbook_admin_v1",
                timestamp: serverTimestamp()
              });
              console.log("🔐 Admin Auth synced with Firebase");
            } catch (authErr) {
              console.warn("Auth sync failed or timed out:", authErr.message);
            }

            console.log("Admin login successful. Role:", window._currentAdminRole);
            loginAdmin(username, window._currentAdminRole);
          } else {
            msg("admin-login-msg", "Invalid password", "error");
          }
        } else {
          // Document does not exist - check for first-time login
          if (isMasterBypass) {
            const newHash = CryptoJS.SHA256(password).toString();
            try {
              await setDoc(doc(db, "admins", "admin"), {
                passwordHash: newHash,
                role: "super_admin",
                createdAt: serverTimestamp()
              });
            } catch (_) {}
            loginAdmin('admin', 'super_admin');
          } else {
            msg("admin-login-msg", "Admin account not found", "error");
          }
        }
      } catch (e) {
        console.error("Login error:", e);
        msg("admin-login-msg", e.message, "error");
      } finally {
        btn.disabled = false;
        btn.innerText = origText;
      }
    });

    function applyRoleRestrictions() {
      const role = window._currentAdminRole;
      const navButtons = document.querySelectorAll('.admin-nav-btn');

      navButtons.forEach(btn => {
        const sectionId = btn.getAttribute('data-section');

        if (role === 'super_admin') {
          btn.style.display = ''; // Show everything
        } else {
          // Restricted Admin: Only show Notes, Q-Bank and PYQ
          const allowed = ['sec-notes-upload', 'sec-qbank-upload', 'sec-pyq-upload'];
          if (allowed.includes(sectionId)) {
            btn.style.display = '';
          } else {
            btn.style.display = 'none';
          }
        }
      });

      // Special case for restricted section visibility
      if (role !== 'super_admin') {
        document.querySelectorAll('.admin-section').forEach(sec => {
          if (!['sec-notes-upload', 'sec-qbank-upload', 'sec-pyq-upload'].includes(sec.id)) {
            sec.classList.remove('active');
            sec.style.display = 'none';
          }
        });

        // If they were somehow in a restricted section, go back to grid
        const activeSection = document.querySelector('.admin-section.active');
        if (!activeSection || !['sec-notes-upload', 'sec-qbank-upload', 'sec-pyq-upload'].includes(activeSection.id)) {
          if (typeof window.switchAdminSection === 'function') {
            window.switchAdminSection(null);
          }
        }
      }
    }


    /* ===========================================
       👮 ADMIN ACCOUNTS MANAGEMENT
    =========================================== */
    window.loadAdminsList = async function () {
      const container = document.getElementById("admins-list-container");
      if (!container) return;

      container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-secondary);">⏳ Loading admins...</p>';

      try {
        const snap = await getDocs(collection(db, "admins"));
        if (snap.empty) {
          container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-secondary);">No administrator accounts found.</p>';
          return;
        }

        let html = "";
        snap.forEach(docSnap => {
          const u = docSnap.id;
          const data = docSnap.data();
          const r = data.role || "admin";
          const isSuper = (r === "super_admin");

          const initials = u.slice(0, 2).toUpperCase();
          const avatarBg = isSuper ? 'linear-gradient(135deg, #8b5cf6, #d946ef)' : 'linear-gradient(135deg, #3b82f6, #06b6d4)';
          const itemBg = isSuper ? 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(243,232,255,0.15) 100%)' : 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(224,242,254,0.15) 100%)';
          const borderColor = isSuper ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)';
          const leftBarColor = isSuper ? '#8b5cf6' : '#3b82f6';

          html += `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:${itemBg};border:1.5px solid ${borderColor};border-left:4px solid ${leftBarColor};border-radius:14px;margin-bottom:10px;box-shadow: 0 4px 12px rgba(0,0,0,0.015);transition:all 0.25s ease-in-out;"
              onmouseover="this.style.boxShadow='0 6px 16px rgba(0,0,0,0.04)';this.style.transform='translateY(-1.5px)'"
              onmouseout="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.015)';this.style.transform=''">
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:36px;height:36px;border-radius:50%;background:${avatarBg};color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;letter-spacing:0.5px;box-shadow:0 3px 8px rgba(0,0,0,0.08);text-transform:uppercase;">
                  ${initials}
                </div>
                <div style="display:flex;flex-direction:column;gap:3px;">
                  <span style="font-weight:800;color:#1e293b;font-size:14.5px;">${u}</span>
                  <div style="display:flex;align-items:center;">
                    <span style="font-size:9px;padding:2px 8px;background:${isSuper ? 'rgba(139,92,246,0.08)' : 'rgba(59,130,246,0.08)'};color:${isSuper ? '#8b5cf6' : '#2563eb'};border:1px solid ${isSuper ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)'};border-radius:20px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;">
                      ${isSuper ? '✨ Super Admin' : '👤 Restricted Admin'}
                    </span>
                  </div>
                </div>
              </div>
              ${u !== 'admin' && u !== window._currentAdminUser ? `
                <button onclick="window.deleteAdminAccount('${u}')" 
                  style="background:none;border:none;color:#ef4444;cursor:pointer;padding:8px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all 0.2s;background:rgba(239,68,68,0.05);"
                  onmouseover="this.style.background='rgba(239,68,68,0.12)';this.style.transform='scale(1.08)'"
                  onmouseout="this.style.background='rgba(239,68,68,0.05)';this.style.transform='scale(1)'"
                  title="Delete Admin">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              ` : ''}
            </div>
          `;
        });

        container.innerHTML = html;
      } catch (err) {
        console.error("loadAdminsList error:", err);
        container.innerHTML = `<p style="text-align:center;padding:20px;color:#ef4444;">Error loading admins: ${err.message}</p>`;
      }
    };

    window.deleteAdminAccount = async function (username) {
      if (!confirm(`Are you sure you want to delete admin account "${username}"?`)) return;

      try {
        await deleteDoc(doc(db, "admins", username));
        alert(`✓ Admin account "${username}" deleted successfully.`);
        window.loadAdminsList();
      } catch (err) {
        console.error("deleteAdminAccount error:", err);
        alert(`Error deleting admin: ${err.message}`);
      }
    };

    // Bind create admin button
    document.getElementById("btn-create-admin")?.addEventListener("click", async () => {
      const usernameInput = document.getElementById("new-admin-user");
      const passwordInput = document.getElementById("new-admin-pass");
      const roleSelect = document.getElementById("new-admin-role");

      if (!usernameInput || !passwordInput || !roleSelect) return;

      const userVal = usernameInput.value.trim().toLowerCase();
      const passVal = passwordInput.value;
      const roleVal = roleSelect.value;

      if (!userVal || !passVal) {
        return msg("admin-manage-msg", "Please fill all fields", "error");
      }

      if (!/^[a-z0-9_@.-]+$/.test(userVal)) {
        return msg("admin-manage-msg", "Username can only contain letters, numbers, underscores, dots, hyphens, and @", "error");
      }

      if (passVal.length < 6) {
        return msg("admin-manage-msg", "Password must be at least 6 characters", "error");
      }

      try {
        const adminRef = doc(db, "admins", userVal);
        const adminSnap = await getDoc(adminRef);

        if (adminSnap.exists()) {
          return msg("admin-manage-msg", "Username is already taken", "error");
        }

        const passHash = CryptoJS.SHA256(passVal).toString();
        await setDoc(adminRef, {
          passwordHash: passHash,
          role: roleVal,
          createdAt: serverTimestamp()
        });

        msg("admin-manage-msg", "✓ Admin account created successfully!", "success");
        usernameInput.value = "";
        passwordInput.value = "";
        window.loadAdminsList();
      } catch (err) {
        console.error("Create admin error:", err);
        msg("admin-manage-msg", "Error: " + err.message, "error");
      }
    });


    /* ===============================
       🔄 MANUAL REFRESH
    =============================== */
    $("btn-refresh")?.addEventListener("click", async () => {
      const btn = $("btn-refresh");
      btn.disabled = true;
      btn.innerHTML = '⏳ Refreshing...';

      try {
        const attSnapshot = await getDocs(collection(db, "attendance"));
        $("total-att").textContent = attSnapshot.size;

        const today = new Date().toISOString().split('T')[0];
        let todayCount = 0;
        attSnapshot.forEach(doc => {
          if (doc.data().date === today) todayCount++;
        });
        $("today-count").textContent = todayCount;

        loadAttendanceTable(attSnapshot);

        btn.innerHTML = '✓ Refreshed!';
        setTimeout(() => {
          btn.innerHTML = '🔄 Refresh Now';
          btn.disabled = false;
        }, 2000);
      } catch (e) {
        console.error("Refresh error:", e);
        btn.innerHTML = '🔄 Refresh Now';
        btn.disabled = false;
      }
    });


    /* ===============================
       📊 ADMIN DASHBOARD
    =============================== */
    let adminRefreshInterval = null; // Store interval ID

    async function loadAdminDashboard() {
      console.log("Loading admin dashboard...");
      try {
        // Load all students
        console.log("Loading students...");
        const studentsSnapshot = await getDocs(collection(db, "students"));
        console.log("Students loaded:", studentsSnapshot.size);
        $("total-users").textContent = studentsSnapshot.size;

        // Cache student map to avoid a duplicate query in loadAttendanceTable
        _studentMapCache = {};
        studentsSnapshot.forEach(d => { _studentMapCache[d.id] = d.data(); });

        // Load all attendance
        console.log("Loading attendance...");
        const attSnapshot = await getDocs(collection(db, "attendance"));
        console.log("Attendance records loaded:", attSnapshot.size);
        $("total-att").textContent = attSnapshot.size;

        // Count today's attendance
        const today = new Date().toISOString().split('T')[0];
        let todayCount = 0;
        attSnapshot.forEach(doc => {
          if (doc.data().date === today) todayCount++;
        });
        console.log("Today's count:", todayCount);
        $("today-count").textContent = todayCount;

        // Load attendance table
        console.log("Loading attendance table...");
        loadAttendanceTable(attSnapshot);

        // Load current session
        console.log("Loading session info...");
        const sessionDoc = await getDoc(doc(db, "settings", "session"));
        if (sessionDoc.exists()) {
          const sessionName = sessionDoc.data().name || "No session set";
          $("current-session-display").textContent = sessionName;
        } else {
          $("current-session-display").textContent = "No session set";
        }

        console.log("Dashboard loaded successfully!");

        // Load active code
        loadActiveCode();

        // Load password reset requests
        loadPasswordResetRequests();

        // Load feature blocking settings
        loadFeatureSettings();

        // Add Logout button to navbar
        const actions = $("navbar-actions");
        if (actions) {
          actions.innerHTML = `
            <button onclick="window.adminLogout()" 
              style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:#f9fafb;border:1px solid rgba(57,255,180,0.25);border-radius:10px;color:#3d5af1;font-weight:700;font-size:13px;cursor:pointer;transition:all 0.2s;"
              onmouseover="this.style.background='#eef0ff';this.style.transform='translateY(-1px)'"
              onmouseout="this.style.background='#f9fafb';this.style.transform=''">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3d5af1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Logout
            </button>
          `;
        }

        // Initialize button-nav
        initAdminNav();

        // Set up auto-refresh every 30 seconds
        if (adminRefreshInterval) {
          clearInterval(adminRefreshInterval);
        }
        adminRefreshInterval = setInterval(async () => {
          console.log("Auto-refreshing dashboard...");
          const attSnapshot = await getDocs(collection(db, "attendance"));
          $("total-att").textContent = attSnapshot.size;

          // Update today's count
          const today = new Date().toISOString().split('T')[0];
          let todayCount = 0;
          attSnapshot.forEach(doc => {
            if (doc.data().date === today) todayCount++;
          });
          $("today-count").textContent = todayCount;

          // Refresh table
          loadAttendanceTable(attSnapshot);
        }, 30000); // Refresh every 30 seconds

      } catch (e) {
        console.error("Error loading dashboard:", e);

        // Check if it's a permissions error
        if (e.code === 'permission-denied' || e.message.includes('permission') || e.message.includes('insufficient')) {
          // Show detailed Firebase permissions error with instructions
          const errorModal = document.createElement('div');
          errorModal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(30,30,60,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
          errorModal.innerHTML = `
            <div style="background:#ffffff;border:2px solid #ef4444;border-radius:20px;padding:32px;max-width:600px;width:100%;max-height:80vh;overflow-y:auto;">
              <h2 style="color:#ef4444;margin-bottom:20px;font-size:24px;text-align:center;">🔒 Firebase Permissions Error</h2>
              
              <div style="background:rgba(239,68,68,0.1);border:1px solid #ef4444;border-radius:12px;padding:16px;margin-bottom:20px;">
                <p style="color:#ef4444;font-weight:600;margin-bottom:8px;">Error Details:</p>
                <p style="color:#fca5a5;font-size:14px;word-break:break-word;">${e.message}</p>
              </div>
              
              <div style="background:#f9fafb;border:1px solid #6366f1;border-radius:12px;padding:20px;margin-bottom:20px;">
                <h3 style="color:#3d5af1;margin-bottom:12px;font-size:18px;">📋 How to Fix:</h3>
                <ol style="color:#6b7280;font-size:14px;line-height:1.8;padding-left:20px;">
                  <li style="margin-bottom:12px;">Go to <strong>Firebase Console</strong>: <a href="https://console.firebase.google.com/project/attendance-system-54b30/firestore/rules" target="_blank" style="color:#3d5af1;text-decoration:underline;">Click Here</a></li>
                  <li style="margin-bottom:12px;">Select <strong>Firestore Database</strong> → <strong>Rules</strong> tab</li>
                  <li style="margin-bottom:12px;">Replace rules with the code below</li>
                  <li style="margin-bottom:12px;">Click <strong>Publish</strong></li>
                </ol>
              </div>
              
              <div style="background:#1a1f3a;border:1px solid var(--glass-border);border-radius:12px;padding:16px;margin-bottom:20px;position:relative;">
                <button onclick="navigator.clipboard.writeText(this.nextElementSibling.textContent);this.textContent='✓ Copied!';setTimeout(()=>this.textContent='📋 Copy Rules',2000)" style="position:absolute;top:12px;right:12px;background:var(--accent-burgundy);color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;">📋 Copy Rules</button>
                <pre style="color:#a0aec0;font-size:12px;overflow-x:auto;margin-top:30px;"><code>rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}</code></pre>
              </div>
              
              <div style="background:rgba(251,191,36,0.1);border:1px solid #fbbf24;border-radius:12px;padding:16px;margin-bottom:20px;">
                <p style="color:#fbbf24;font-size:13px;line-height:1.6;">
                  ⚠️ <strong>Note:</strong> The above rule allows anyone to access your database. Only use for testing! 
                  For production, implement proper authentication rules.
                </p>
              </div>
              
              <button onclick="this.parentElement.parentElement.remove()" style="width:100%;background:var(--accent-burgundy);color:white;border:none;padding:14px;border-radius:12px;cursor:pointer;font-size:16px;font-weight:600;margin-top:8px;">
                Close
              </button>
            </div>
          `;
          document.body.appendChild(errorModal);
        } else {
          // Other error - show generic message
          alert("Error loading dashboard: " + e.message + "\n\nCheck browser console for details.");
        }
      }
    }


    /* ===============================
       📋 LOAD ATTENDANCE TABLE
    =============================== */
    // Global student map for sem/year lookups in attendance table
    let _studentMapCache = {};
    async function getStudentMap() {
      if (Object.keys(_studentMapCache).length > 0) return _studentMapCache;
      const snap = await getDocs(collection(db, "students"));
      snap.forEach(d => { _studentMapCache[d.id] = d.data(); });
      return _studentMapCache;
    }

    async function loadAttendanceTable(snapshot) {
      const tbody = $("att-table").querySelector("tbody");
      const countEl = document.getElementById("records-count");
      tbody.innerHTML = "";

      if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--text-secondary);">No records found</td></tr>';
        if (countEl) countEl.textContent = '';
        return;
      }

      const studentMap = await getStudentMap();

      // Sort newest first
      const rows = [];
      snapshot.forEach(doc => rows.push(doc.data()));
      rows.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));

      if (countEl) countEl.innerHTML = `<span style="color:var(--accent-green);">✅ ${rows.length} record${rows.length !== 1 ? 's' : ''} found</span>`;

      rows.forEach((data, i) => {
        const sem = data.sem || studentMap[data.usn]?.sem || '—';
        const year = data.year || studentMap[data.usn]?.year || '—';
        const row = tbody.insertRow();
        row.innerHTML = `
          <td style="color:var(--text-secondary);font-size:11px;">${i + 1}</td>
          <td style="font-weight:600;color:var(--text-primary);">${data.name || '—'}</td>
          <td style="color:#3d5af1;font-size:12px;">${data.usn || '—'}</td>
          <td style="text-align:center;">${data.section || '—'}</td>
          <td style="text-align:center;font-weight:700;color:#34d399;">${sem}</td>
          <td style="text-align:center;font-weight:700;color:#60a5fa;">${year}</td>
          <td>${data.date || '—'}</td>
          <td style="font-size:12px;">${data.time || '—'}</td>
          <td style="font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;" title="${data.session || ''}">${data.session || '<span style="color:#f59e0b;">Not Set</span>'}</td>
          <td style="font-size:12px;color:var(--text-secondary);">${data.remark && data.remark !== '-' ? data.remark : '—'}</td>
        `;
      });
    }


    /* ===============================
       🛡️ FEATURE BLOCKING SYSTEM
    =============================== */
    async function loadFeatureSettings() {
      try {
        const featureDoc = await getDoc(doc(db, "settings", "features"));
        if (featureDoc.exists()) {
          const data = featureDoc.data();
          $("feat-attendance").checked = data.attendanceEnabled !== false;
          $("feat-quiz").checked = data.quizEnabled !== false;
          $("feat-quiz-history").checked = data.quizHistoryEnabled !== false;
          $("feat-history").checked = data.historyEnabled !== false;
          $("feat-notes").checked = data.notesEnabled !== false;
          $("feat-pyq").checked = data.pyqEnabled !== false;
          $("feat-qbank").checked = data.qbankEnabled !== false;
          $("feat-ia-timetable").checked = data.iaTimetableEnabled !== false;
        }
      } catch (e) {
        console.error("Error loading features:", e);
      }
    }

    $("btn-save-features")?.addEventListener("click", async () => {
      const btn = $("btn-save-features");
      btn.disabled = true;
      btn.innerHTML = "⏳ Saving...";

      const settings = {
        attendanceEnabled: $("feat-attendance").checked,
        quizEnabled: $("feat-quiz").checked,
        quizHistoryEnabled: $("feat-quiz-history").checked,
        historyEnabled: $("feat-history").checked,
        notesEnabled: $("feat-notes").checked,
        pyqEnabled: $("feat-pyq").checked,
        qbankEnabled: $("feat-qbank").checked,
        iaTimetableEnabled: $("feat-ia-timetable").checked,
        updatedBy: window._currentAdminUser || 'admin',
        updatedAt: serverTimestamp()
      };

      try {
        await setDoc(doc(db, "settings", "features"), settings, { merge: true });
        msg("features-manage-msg", "✓ Feature settings updated successfully!", "success");
      } catch (e) {
        console.error("Save features error:", e);
        msg("features-manage-msg", "Error: " + e.message, "error");
      } finally {
        btn.disabled = false;
        btn.innerHTML = "💾 Save Feature Settings";
      }
    });


    /* ===============================
       🔍 FILTER RECORDS
    =============================== */
    $("btn-filter")?.addEventListener("click", async () => {
      const filterUsn = val("filter-usn").toUpperCase().trim();
      const filterSection = val("filter-section").toUpperCase().trim();
      const filterName = val("filter-name").toLowerCase().trim();
      const filterDate = val("filter-date").trim();

      try {
        const snapshot = await getDocs(collection(db, "attendance"));
        // Filter client-side for flexibility
        const filtered = { empty: true, forEach: (cb) => { } };
        const rows = [];
        snapshot.forEach(doc => {
          const d = doc.data();
          if (filterUsn && !(d.usn || '').toUpperCase().includes(filterUsn)) return;
          if (filterSection && (d.section || '').toUpperCase() !== filterSection) return;
          if (filterName && !(d.name || '').toLowerCase().includes(filterName)) return;
          if (filterDate && d.date !== filterDate) return;
          rows.push(doc);
        });
        // Build a fake snapshot-like object
        const fakeSnap = {
          empty: rows.length === 0,
          forEach: (cb) => rows.forEach(cb)
        };
        loadAttendanceTable(fakeSnap);
      } catch (e) {
        console.error("Filter error:", e);
      }
    });

    $("btn-clear-filter")?.addEventListener("click", async () => {
      $("filter-usn").value = "";
      $("filter-section").value = "";
      $("filter-name").value = "";
      $("filter-date").value = "";
      const snapshot = await getDocs(collection(db, "attendance"));
      loadAttendanceTable(snapshot);
    });


    /* ===============================
       📊 EXPORT EXCEL
    =============================== */
    $("btn-export-xlsx")?.addEventListener("click", async () => {
      try {
        const [snapshot, studSnap] = await Promise.all([
          getDocs(collection(db, "attendance")),
          getDocs(collection(db, "students"))
        ]);

        // Build student lookup for missing sem
        const studentMap = {};
        studSnap.forEach(d => { studentMap[d.id] = d.data(); });

        const data = [];
        snapshot.forEach(doc => {
          const d = doc.data();
          const sem = d.sem || studentMap[d.usn]?.sem || '';
          data.push({
            Name: d.name || '',
            USN: d.usn || '',
            Section: d.section || '',
            Semester: sem,
            Year: d.year || '',
            Date: d.date || '',
            Time: d.time || '',
            Session: d.session || 'Not Set',
            Location: d.location || 'Not Set',
            Remark: d.remark || ''
          });
        });

        // Sort by date descending
        data.sort((a, b) => new Date(b.Date + ' ' + b.Time) - new Date(a.Date + ' ' + a.Time));

        const ws = XLSX.utils.json_to_sheet(data);
        // Set column widths
        ws['!cols'] = [
          { wch: 25 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
          { wch: 14 }, { wch: 12 }, { wch: 35 }, { wch: 20 }, { wch: 20 }
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        XLSX.writeFile(wb, `attendance_${new Date().toISOString().split('T')[0]}.xlsx`);
      } catch (e) {
        console.error("Export error:", e);
        alert("Export failed: " + e.message);
      }
    });


    /* ===============================
       📄 EXPORT PDF
    =============================== */
    $("btn-export-pdf")?.addEventListener("click", async () => {
      try {
        const { jsPDF } = window.jspdf;
        const pdfDoc = new jsPDF('l', 'mm', 'a4');
        const W = pdfDoc.internal.pageSize.width; // 297mm

        const [attSnap, studSnap, sessionDoc] = await Promise.all([
          getDocs(collection(db, "attendance")),
          getDocs(collection(db, "students")),
          getDoc(doc(db, "settings", "session"))
        ]);

        const studentMap = {};
        studSnap.forEach(d => { studentMap[d.id] = d.data(); });

        const sessionName = sessionDoc.exists() ? (sessionDoc.data().name || 'No Session') : 'No Session';
        const today = new Date().toISOString().split('T')[0];
        const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

        const rows = [];
        attSnap.forEach(ds => {
          const d = ds.data();
          rows.push([
            '',  // placeholder for row number — set below
            d.name || '',
            d.usn || '',
            d.section || '-',
            String(d.sem || studentMap[d.usn]?.sem || '-'),
            String(d.year || studentMap[d.usn]?.year || '-'),
            d.date || '',
            d.time || '',
            d.session || 'Not Set',
            (d.remark && d.remark !== '-') ? d.remark : ''
          ]);
        });
        rows.sort((a, b) => (b[6] + b[7]).localeCompare(a[6] + a[7]));
        rows.forEach((r, i) => { r[0] = i + 1; });

        const todayCount = rows.filter(r => r[6] === today).length;

        // ── HEADER ──
        pdfDoc.setFillColor(15, 23, 42);
        pdfDoc.rect(0, 0, W, 26, 'F');
        pdfDoc.setFillColor(99, 102, 241);
        pdfDoc.rect(0, 26, W, 2, 'F');

        pdfDoc.setFont('helvetica', 'bold');
        pdfDoc.setFontSize(16);
        pdfDoc.setTextColor(255, 255, 255);
        pdfDoc.text('ATTENDANCE REPORT', 12, 11);

        pdfDoc.setFont('helvetica', 'normal');
        pdfDoc.setFontSize(8);
        pdfDoc.setTextColor(165, 180, 252);
        pdfDoc.text(sessionName, 12, 20);

        pdfDoc.setTextColor(203, 213, 225);
        pdfDoc.text(`${todayStr}   |   Total Records: ${rows.length}   |   Today: ${todayCount}   |   Students: ${studSnap.size}`, W - 12, 20, { align: 'right' });

        // ── TABLE ──
        // Total usable width = 297 - 10 - 10 = 277mm
        // Col widths: 10 + 44 + 32 + 13 + 11 + 11 + 24 + 24 + 56 + 52 = 277
        pdfDoc.autoTable({
          startY: 32,
          head: [['No.', 'Name', 'USN', 'Section', 'Sem', 'Year', 'Date', 'Time', 'Session', 'Remarks']],
          body: rows,
          theme: 'striped',
          headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8.5,
            halign: 'center',
            cellPadding: 4,
            overflow: 'linebreak',
            minCellHeight: 10
          },
          bodyStyles: {
            fontSize: 8,
            cellPadding: 3.5,
            textColor: [20, 20, 40],
            overflow: 'hidden',
            minCellHeight: 0
          },
          alternateRowStyles: { fillColor: [241, 245, 249] },
          columnStyles: {
            0: { cellWidth: 12, halign: 'center', textColor: [140, 140, 140] },
            1: { cellWidth: 42, fontStyle: 'bold' },
            2: { cellWidth: 30, textColor: [79, 70, 229], fontSize: 7.5 },
            3: { cellWidth: 18, halign: 'center' },
            4: { cellWidth: 14, halign: 'center', fontStyle: 'bold', textColor: [5, 150, 105] },
            5: { cellWidth: 14, halign: 'center', fontStyle: 'bold', textColor: [161, 98, 7] },
            6: { cellWidth: 24, halign: 'center' },
            7: { cellWidth: 24, halign: 'center' },
            8: { cellWidth: 55, fontSize: 7.5 },
            9: { cellWidth: 44, textColor: [100, 100, 100] }
          },
          margin: { left: 10, right: 10 },
          didDrawPage: () => {
            const pg = pdfDoc.internal.getCurrentPageInfo().pageNumber;
            const tot = pdfDoc.internal.getNumberOfPages();
            pdfDoc.setFillColor(15, 23, 42);
            pdfDoc.rect(0, 204, W, 6, 'F');
            pdfDoc.setFontSize(7);
            pdfDoc.setTextColor(203, 213, 225);
            pdfDoc.text(`Attendance System  |  ${sessionName}`, 10, 208);
            pdfDoc.text(`Page ${pg} / ${tot}`, W - 10, 208, { align: 'right' });
          }
        });

        pdfDoc.save(`Attendance_${sessionName.replace(/[^a-zA-Z0-9]/g, '_')}_${today}.pdf`);
      } catch (e) {
        console.error("PDF export error:", e);
        alert("Error exporting PDF: " + e.message);
      }
    });


    /* ===============================
       ⚠️ RESET ATTENDANCE
    =============================== */
    $("btn-reset-att")?.addEventListener("click", async () => {
      if (!confirm("Are you sure you want to delete ALL attendance records? This cannot be undone!")) {
        return;
      }

      try {
        const snapshot = await getDocs(collection(db, "attendance"));
        const deletePromises = [];

        snapshot.forEach(docSnap => {
          deletePromises.push(deleteDoc(doc(db, "attendance", docSnap.id)));
        });

        await Promise.all(deletePromises);
        alert("✓ All attendance records have been deleted");
        loadAdminDashboard();
      } catch (e) {
        alert("Error: " + e.message);
      }
    });


    /* ===========================================
       🔢 6-DIGIT CODE SYSTEM
    =========================================== */

    let codeTimer = null;

    // Generate random 6-digit code
    function genCode() {
      return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // ADMIN: Generate Code
    $("btn-gen-code")?.addEventListener("click", async () => {
      const loc = val("code-loc");
      let dur = val("code-duration");
      let isSeconds = false;

      if (!loc.trim()) {
        return msg("admin-code-msg", "Please enter location", "error");
      }

      // Check if duration is in seconds (ends with 's')
      if (dur.endsWith('s')) {
        isSeconds = true;
        dur = parseInt(dur); // Remove the 's'
      } else {
        dur = parseInt(dur);
      }

      try {
        const code = genCode();
        const now = new Date();
        const exp = new Date(now.getTime() + (isSeconds ? dur * 1000 : dur * 60000));

        await setDoc(doc(db, "attendance_codes", "active"), {
          code: code,
          location: loc,
          createdAt: now.toISOString(),
          expiresAt: exp.toISOString(),
          duration: dur,
          isSeconds: isSeconds,
          active: true
        });

        const durationText = isSeconds ? `${dur}s` : `${dur}m`;
        msg("admin-code-msg", `Code generated (${durationText})!`, "success");
        showActiveCode(code, loc, exp);
      } catch (e) {
        msg("admin-code-msg", "Error: " + e.message, "error");
      }
    });

    // Show active code with countdown
    function showActiveCode(code, loc, exp) {
      $("display-code").textContent = code;
      $("display-loc").textContent = loc;
      $("active-code-box").style.display = "block";

      if (codeTimer) clearInterval(codeTimer);

      codeTimer = setInterval(() => {
        const now = new Date();
        const expDate = new Date(exp);
        const diff = expDate - now;

        if (diff <= 0) {
          clearInterval(codeTimer);
          $("display-timer").textContent = "EXPIRED";
          $("display-timer").style.color = "#ef4444";
          deactivateCodeAuto();
        } else {
          const mins = Math.floor(diff / 60000);
          const secs = Math.floor((diff % 60000) / 1000);
          $("display-timer").textContent = mins + ":" + secs.toString().padStart(2, "0");
        }
      }, 1000);
    }

    // Deactivate code
    async function deactivateCodeAuto() {
      try {
        await setDoc(doc(db, "attendance_codes", "active"), { active: false }, { merge: true });
        $("active-code-box").style.display = "none";
        if (codeTimer) clearInterval(codeTimer);
      } catch (e) {
        console.error(e);
      }
    }

    $("btn-deact-code")?.addEventListener("click", async () => {
      await deactivateCodeAuto();
      msg("admin-code-msg", "Code deactivated", "info");
    });

    // Load active code on admin login
    async function loadActiveCode() {
      try {
        const codeDoc = await getDoc(doc(db, "attendance_codes", "active"));
        if (codeDoc.exists() && codeDoc.data().active) {
          const data = codeDoc.data();
          const exp = new Date(data.expiresAt);
          if (exp > new Date()) {
            showActiveCode(data.code, data.location, exp);
          } else {
            await deactivateCodeAuto();
          }
        }
      } catch (e) {
        console.log("No active code");
      }
    }

    /* ===============================
       📝 MANUAL ATTENDANCE SYSTEM
    =============================== */

    let loadedStudents = []; // Store loaded student data

    // Handle CSV File Upload
    $("btn-upload-students")?.addEventListener("click", () => {
      const fileInput = $("student-csv-file");
      const file = fileInput?.files[0];
      const defaultYear = val("default-year");
      const defaultSection = val("default-section");

      if (!file) {
        return msg("student-upload-msg", "Please select a CSV file", "error");
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const csv = e.target.result;
          const lines = csv.trim().split('\n');

          // Parse CSV - supports Name, USN, Year, Section columns
          loadedStudents = [];
          for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
              const parts = lines[i].split(',').map(x => x.trim());
              const name = parts[0];
              const usn = parts[1];
              let year = parts[2] || defaultYear || '';
              let section = parts[3] || defaultSection || '';

              if (name && usn) {
                loadedStudents.push({ name, usn, year, section });
              }
            }
          }

          if (loadedStudents.length === 0) {
            return msg("student-upload-msg", "No valid students found in CSV", "error");
          }

          msg("student-upload-msg", `✓ Loaded ${loadedStudents.length} students from CSV`, "success");
          displayStudentList();

          // Clear the file input
          fileInput.value = "";
        } catch (err) {
          msg("student-upload-msg", "Error parsing CSV: " + err.message, "error");
        }
      };

      reader.readAsText(file);
    });

    // Display Student List with Checkboxes
    function displayStudentList() {
      const container = $("student-list-container");
      $("student-count").textContent = loadedStudents.length;

      if (loadedStudents.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No students loaded.</p>';
        return;
      }

      container.innerHTML = loadedStudents.map((student, index) => `
        <div style="display: grid; grid-template-columns: 30px 1fr 1fr 80px 80px; gap: 12px; align-items: center; padding: 10px; border-bottom: 1px solid #f7f8fc; transition: background 0.2s;">
          <input type="checkbox" id="student-${index}" class="student-checkbox" style="width: 18px; height: 18px; cursor: pointer;" data-name="${student.name}" data-usn="${student.usn}" data-year="${student.year}" data-section="${student.section}"/>
          <label for="student-${index}" style="cursor: pointer; font-weight: 500; color: var(--text-primary); margin: 0;">${student.name}</label>
          <label for="student-${index}" style="cursor: pointer; color: var(--text-secondary); font-size: 12px; margin: 0;">${student.usn}</label>
          <label for="student-${index}" style="cursor: pointer; color: var(--accent-light-gold); font-size: 12px; font-weight: 500; margin: 0;">${student.year ? 'Year ' + student.year : 'N/A'}</label>
          <label for="student-${index}" style="cursor: pointer; color: #3d5af1; font-size: 12px; font-weight: 500; margin: 0;">${student.section ? student.section : 'N/A'}</label>
        </div>
      `).join('');

      // Add event listeners for checkboxes
      document.querySelectorAll('.student-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function () {
          this.parentElement.parentElement.style.background = this.checked ? 'rgba(59, 130, 246, 0.1)' : '';
        });
      });
    }

    // Select All Students
    $("btn-select-all")?.addEventListener("click", () => {
      document.querySelectorAll('.student-checkbox').forEach(cb => {
        cb.checked = true;
        cb.parentElement.parentElement.style.background = 'rgba(59, 130, 246, 0.1)';
      });
    });

    // Deselect All Students
    $("btn-deselect-all")?.addEventListener("click", () => {
      document.querySelectorAll('.student-checkbox').forEach(cb => {
        cb.checked = false;
        cb.parentElement.parentElement.style.background = '';
      });
    });

    // Submit Manual Attendance
    $("btn-submit-manual-att")?.addEventListener("click", async () => {
      const location = val("manual-att-location");

      if (!location.trim()) {
        return msg("manual-att-msg", "Please enter a location", "error");
      }

      // Get selected students
      const selectedStudents = [];
      document.querySelectorAll('.student-checkbox').forEach(cb => {
        if (cb.checked) {
          selectedStudents.push({
            name: cb.dataset.name,
            usn: cb.dataset.usn,
            year: cb.dataset.year,
            section: cb.dataset.section
          });
        }
      });

      if (selectedStudents.length === 0) {
        return msg("manual-att-msg", "Please select at least one student", "error");
      }

      try {
        msg("manual-att-msg", "Submitting attendance records...", "info");

        const now = new Date();
        const date = now.toLocaleDateString();
        const time = now.toLocaleTimeString();

        // Get current session name
        let sessionName = "Manual Entry";
        try {
          const sessionDoc = await getDoc(doc(db, "settings", "session"));
          if (sessionDoc.exists()) {
            sessionName = sessionDoc.data().name || "Manual Entry";
          }
        } catch (e) {
          console.log("No session set, using default");
        }

        // Submit attendance for each selected student
        const promises = selectedStudents.map(student =>
          setDoc(doc(db, "attendance", `${student.usn}_${Date.now()}`), {
            name: student.name,
            usn: student.usn,
            sem: student.sem || '',
            year: student.year,
            section: student.section,
            date: date,
            time: time,
            session: sessionName,
            location: location,
            timestamp: now.toISOString(),
            method: "manual"
          })
        );

        await Promise.all(promises);

        msg("manual-att-msg", `✓ Attendance submitted for ${selectedStudents.length} students!`, "success");

        // Clear selections
        displayStudentList();
        $("manual-att-location").value = "";

      } catch (e) {
        msg("manual-att-msg", "Error: " + e.message, "error");
      }
    });

    // STUDENT: Verify Code
    $("btn-verify-code")?.addEventListener("click", async () => {
      const enteredCode = val("att-code");

      if (!enteredCode || enteredCode.length !== 6) {
        return msg("code-msg", "Enter 6-digit code", "error");
      }

      try {
        const codeDoc = await getDoc(doc(db, "attendance_codes", "active"));

        if (!codeDoc.exists() || !codeDoc.data().active) {
          return msg("code-msg", "No active code", "error");
        }

        const data = codeDoc.data();
        const exp = new Date(data.expiresAt);

        if (exp <= new Date()) {
          return msg("code-msg", "Code expired", "error");
        }

        if (enteredCode !== data.code) {
          return msg("code-msg", "Invalid code", "error");
        }

        // Get current session name
        let sessionName = "Not Set";
        try {
          const sessionDoc = await getDoc(doc(db, "settings", "session"));
          if (sessionDoc.exists()) {
            sessionName = sessionDoc.data().name || "Not Set";
          }
        } catch (e) {
          console.log("No session set");
        }

        // Code valid!
        msg("code-msg", "Code verified!", "success");
        $("code-verified-info").style.display = "block";
        $("verified-session").textContent = sessionName;
        $("verified-loc").textContent = data.location;
        $("verified-exp").textContent = exp.toLocaleTimeString();
        $("attendance-form-section").style.display = "block";

        window.verifiedLocation = data.location;
      } catch (e) {
        console.error("Code verification error:", e);

        // Check for permissions error
        if (e.code === 'permission-denied' || e.message.includes('permission') || e.message.includes('insufficient')) {
          msg("code-msg", "⚠️ Firebase permissions error. Please contact admin to fix Firestore rules.", "error");
        } else {
          msg("code-msg", "Error: " + e.message, "error");
        }
      }
    });

    // Expose dashboard loading functions globally
    window.loadStudentDashboard = loadStudentDashboard;
    window.loadAdminDashboard = loadAdminDashboard;

    /* ===========================================
       🧭 ADMIN NAVIGATION SYSTEM
    =========================================== */

    function initAdminNav() {
      const navGrid = document.getElementById("admin-nav-grid");
      const backBar = document.getElementById("admin-back-bar");
      const backLabel = document.getElementById("admin-back-label");
      const backBtn = document.getElementById("admin-back-btn");

      if (!navGrid || !backBar || !backLabel || !backBtn) return;

      // Event listener for nav buttons
      const navButtons = document.querySelectorAll(".admin-nav-btn");
      navButtons.forEach(btn => {
        btn.removeEventListener("click", handleNavClick);
        btn.addEventListener("click", handleNavClick);
      });

      // Event listener for back button
      backBtn.removeEventListener("click", handleBackClick);
      backBtn.addEventListener("click", handleBackClick);
    }

    window.switchAdminSection = function (sectionId) {
      const navGrid = document.getElementById("admin-nav-grid");
      const backBar = document.getElementById("admin-back-bar");
      const backLabel = document.getElementById("admin-back-label");

      if (!sectionId) {
        if (!window._adminHistoryNavLock) {
          window.location.hash = '#admin';
          return;
        }
        if (navGrid) {
          navGrid.classList.remove("hidden");
          navGrid.style.display = "";
        }
        if (backBar) {
          backBar.classList.remove("visible");
          backBar.style.display = "none";
        }
        document.querySelectorAll(".admin-section").forEach(sec => {
          sec.classList.remove("active");
          sec.style.display = "none";
        });
        return;
      }

      const targetSection = document.getElementById(sectionId);
      if (!targetSection) return;

      if (navGrid) navGrid.classList.add("hidden");
      if (backBar) {
        backBar.classList.add("visible");
        backBar.style.display = "flex";
      }

      if (backLabel) {
        const btn = document.querySelector(`.admin-nav-btn[data-section="${sectionId}"]`);
        backLabel.textContent = targetSection.getAttribute("data-label") || (btn ? btn.innerText : "Section");
      }

      if (sectionId === 'sec-admins') {
        if (typeof window.loadAdminsList === 'function') {
          window.loadAdminsList();
        }
      } else if (sectionId === 'sec-notes') {
        if (typeof window.admLoadAllNotes === 'function') {
          window.admLoadAllNotes();
        }
      } else if (sectionId === 'sec-qbank') {
        if (typeof window.qbankAdmLoadAll === 'function') {
          window.qbankAdmLoadAll();
        }
      } else if (sectionId === 'sec-pyq') {
        if (typeof window.pyqAdmLoadAll === 'function') {
          window.pyqAdmLoadAll();
        }
      }

      document.querySelectorAll(".admin-section").forEach(sec => {
        sec.classList.remove("active");
        sec.style.display = "none";
      });
      targetSection.classList.add("active");
      targetSection.style.display = "block";

      if (!window._adminHistoryNavLock) {
        const shortName = sectionId.replace('sec-', '');
        window.history.pushState({ role: 'admin', section: sectionId }, '', '#admin-' + shortName);
      }
    };

    function handleNavClick(e) {
      const btn = e.currentTarget;
      const sectionId = btn.getAttribute("data-section");
      if (sectionId) {
        window.switchAdminSection(sectionId);
      }
    }

    function handleBackClick() {
      window.switchAdminSection(null);
    }
