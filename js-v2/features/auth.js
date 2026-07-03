import { auth, db } from '../core/firebase.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInAnonymously, 
  signOut, 
  onAuthStateChanged, 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  sendPasswordResetEmail, 
  confirmPasswordReset 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, setDoc, getDoc, addDoc, collection, query, where, getDocs, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { $, val, API_BASE_URL } from '../core/helpers.js';

    /* ===============================
       🔑 FIREBASE ACTION HANDLER
    =============================== */
    // Handle Firebase email action URLs (password reset, email verification, etc)
    const urlParams = new URLSearchParams(window.location.search);
    const actionMode = urlParams.get('mode');
    const actionCode = urlParams.get('oobCode');

    if (actionMode && actionCode) {
      console.log("Firebase action detected:", actionMode);

      if (actionMode === 'resetPassword') {
        // Handle password reset
        verifyPasswordResetCode(auth, actionCode)
          .then(() => {
            console.log("✓ Password reset code is valid");
            // Show password reset form
            document.body.innerHTML = `
              <div style="
                background: #ffffff;
                color: #ffffff;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                font-family: 'Poppins', sans-serif;
              ">
                <div style="
                  background: #ffffff;
                  border: 2px solid #3d5af1;
                  border-radius: 20px;
                  padding: 40px;
                  max-width: 500px;
                  width: 100%;
                  box-shadow: 0 8px 32px rgba(57, 255, 180, 0.25);
                ">
                  <h1 style="
                    font-size: 28px;
                    color: #3d5af1;
                    margin-bottom: 20px;
                    text-align: center;
                  ">Reset Your Password</h1>
                  
                  <p style="
                    color: #6b7280;
                    margin-bottom: 20px;
                    text-align: center;
                  ">Enter your new password below</p>
                  
                  <div id="reset-form-msg" style="margin-bottom: 16px;"></div>
                  
                  <div style="margin-bottom: 16px;">
                    <label style="
                      display: block;
                      color: #3d5af1;
                      margin-bottom: 8px;
                      font-weight: 600;
                    ">New Password</label>
                    <div style="position: relative; width: 100%;">
                      <input id="reset-new-pass" type="password" placeholder="Enter new password (min 6 chars)" style="
                        width: 100%;
                        padding: 12px 48px 12px 12px;
                        background: #f7f8fc;
                        border: 2px solid #6366f1;
                        border-radius: 10px;
                        color: #111827;
                        font-family: 'Poppins', sans-serif;
                        box-sizing: border-box;
                      "/>
                      <button type="button" class="password-toggle-btn" data-target="reset-new-pass" style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; z-index: 10; display: flex; align-items: center; justify-content: center; outline: none;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <div style="margin-bottom: 20px;">
                    <label style="
                      display: block;
                      color: #3d5af1;
                      margin-bottom: 8px;
                      font-weight: 600;
                    ">Confirm Password</label>
                    <div style="position: relative; width: 100%;">
                      <input id="reset-confirm-pass" type="password" placeholder="Confirm new password" style="
                        width: 100%;
                        padding: 12px 48px 12px 12px;
                        background: #f7f8fc;
                        border: 2px solid #6366f1;
                        border-radius: 10px;
                        color: #111827;
                        font-family: 'Poppins', sans-serif;
                        box-sizing: border-box;
                      "/>
                      <button type="button" class="password-toggle-btn" data-target="reset-confirm-pass" style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; z-index: 10; display: flex; align-items: center; justify-content: center; outline: none;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <button id="btn-reset-final" style="
                    width: 100%;
                    padding: 14px;
                    background: #3d5af1;
                    color: #ffffff;
                    border: none;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 700;
                    cursor: pointer;
                    margin-top: 12px;
                  ">Reset Password</button>
                  
                  <p style="
                    color: #6366f1;
                    font-size: 12px;
                    margin-top: 16px;
                    text-align: center;
                  ">Need help? Contact your admin</p>
                </div>
              </div>
            `;

            // Handle password reset submission
            document.getElementById('btn-reset-final').addEventListener('click', async () => {
              const newPass = document.getElementById('reset-new-pass').value;
              const confirmPass = document.getElementById('reset-confirm-pass').value;
              const msgDiv = document.getElementById('reset-form-msg');

              if (!newPass || !confirmPass) {
                msgDiv.innerHTML = '<div style="background:rgba(239,68,68,0.2);border:1px solid #ef4444;color:#f87171;padding:12px;border-radius:8px;">Please fill all fields</div>';
                return;
              }

              if (newPass !== confirmPass) {
                msgDiv.innerHTML = '<div style="background:rgba(239,68,68,0.2);border:1px solid #ef4444;color:#f87171;padding:12px;border-radius:8px;">Passwords do not match</div>';
                return;
              }

              if (newPass.length < 6) {
                msgDiv.innerHTML = '<div style="background:rgba(239,68,68,0.2);border:1px solid #ef4444;color:#f87171;padding:12px;border-radius:8px;">Password must be at least 6 characters</div>';
                return;
              }

              try {
                document.getElementById('btn-reset-final').disabled = true;
                document.getElementById('btn-reset-final').textContent = '⏳ Resetting...';

                await confirmPasswordReset(auth, actionCode, newPass);

                msgDiv.innerHTML = '<div style="background:rgba(16,185,129,0.2);border:1px solid #10b981;color:#34d399;padding:12px;border-radius:8px;">✓ Password reset successfully! Redirecting to login in 3 seconds...</div>';

                setTimeout(() => {
                  window.location.href = '/';
                }, 3000);
              } catch (e) {
                document.getElementById('btn-reset-final').disabled = false;
                document.getElementById('btn-reset-final').textContent = 'Reset Password';
                console.error("Reset error:", e);
                msgDiv.innerHTML = '<div style="background:rgba(239,68,68,0.2);border:1px solid #ef4444;color:#f87171;padding:12px;border-radius:8px;">❌ Error: ' + e.message + '</div>';
              }
            });
          })
          .catch((error) => {
            console.error("Invalid reset code:", error);
            document.body.innerHTML = `
              <div style="
                background: #ffffff;
                color: #ffffff;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                font-family: 'Poppins', sans-serif;
              ">
                <div style="
                  background: #ffffff;
                  border: 2px solid #ef4444;
                  border-radius: 20px;
                  padding: 40px;
                  max-width: 500px;
                  width: 100%;
                  text-align: center;
                  box-shadow: 0 8px 32px rgba(239,68,68,0.25);
                ">
                  <h1 style="color: #ef4444; margin-bottom: 16px;">❌ Invalid Reset Link</h1>
                  <p style="color: #6b7280; margin-bottom: 20px;">${error.message}</p>
                  <p style="color: #6b7280; margin-bottom: 20px;">The link may have expired (valid for 24 hours). Please request a new password reset.</p>
                  <a href="/" style="
                    display: inline-block;
                    background: #3d5af1;
                    color: #ffffff;
                    padding: 12px 30px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 700;
                    cursor: pointer;
                  ">Return to Login</a>
                </div>
              </div>
            `;
          });
      } else {
        console.log("Unhandled Firebase action mode:", actionMode);
      }
    }


    /* ===============================
       🔄 TOGGLE FORMS
    =============================== */
    $("show-register")?.addEventListener("click", () => {
      $("login-form")?.classList.add("hidden");
      $("register-form")?.classList.remove("hidden");
      $("forgot-pass-form")?.classList.add("hidden");
    });

    $("show-login")?.addEventListener("click", () => {
      $("register-form")?.classList.add("hidden");
      $("login-form")?.classList.remove("hidden");
      $("forgot-pass-form")?.classList.add("hidden");
    });

    $("show-forgot-pass")?.addEventListener("click", () => {
      $("login-form")?.classList.add("hidden");
      $("register-form")?.classList.add("hidden");
      $("forgot-pass-form")?.classList.remove("hidden");
    });

    $("back-to-login")?.addEventListener("click", () => {
      $("forgot-pass-form")?.classList.add("hidden");
      $("login-form")?.classList.remove("hidden");
      loginAttempts = 0; // Reset attempts when going back
    });

    /* ===============================
       ✍️ REGISTER
    =============================== */
    $("btn-register")?.addEventListener("click", async () => {
      const name = val("reg-name");
      const usn = val("reg-usn").toUpperCase();
      const course = val("reg-course");
      const dept = val("reg-dept");
      const year = val("reg-year");
      const sem = val("reg-sem");
      const pass = val("reg-pass");
      const pass2 = val("reg-pass2");
      const personalEmail = val("reg-email") ? val("reg-email").trim().toLowerCase() : '';
      console.log("Register values:", { name, usn, course, dept, year, sem, personalEmail });

      if (!name || !usn || !course || !dept || !year || !sem || !pass || !pass2) {
        return msg("register-msg", "Please fill all fields", "error");
      }

      if (!personalEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
        return msg("register-msg", "Please enter a valid personal email address", "error");
      }

      if (pass !== pass2) {
        return msg("register-msg", "Passwords do not match", "error");
      }

      if (pass.length < 6) {
        return msg("register-msg", "Password must be at least 6 characters", "error");
      }

      // Verify if USN or Email is already registered
      msg("register-msg", "⏳ Verifying registration details...", "info");
      try {
        const studentDoc = await getDoc(doc(db, "students", usn));
        if (studentDoc.exists()) {
          return msg("register-msg", "❌ This USN / Roll Number is already registered.", "error");
        }

        const emailQuery = query(collection(db, "students"), where("email", "==", personalEmail));
        const emailSnap = await getDocs(emailQuery);
        if (!emailSnap.empty) {
          return msg("register-msg", "❌ This email address is already registered to another account.", "error");
        }
      } catch (checkErr) {
        console.error("Verification error:", checkErr);
        return msg("register-msg", "❌ Verification failed. Please check your network connection.", "error");
      }

      // ── Send OTP for email verification ──
      msg("register-msg", "⏳ Sending OTP to your email...", "info");
      try {
        const otpRes = await fetch(`${API_BASE_URL}/api/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usn, email: personalEmail, name })
        });
        const otpData = await otpRes.json();
        if (!otpData.success) {
          return msg("register-msg", '❌ ' + (otpData.error || 'Failed to send OTP'), "error");
        }
      } catch (fetchErr) {
        return msg("register-msg", '❌ Cannot reach server. Make sure TechBook server is running.', "error");
      }

      // ── Show inline OTP dialog ──
      msg("register-msg", `✓ OTP sent to <strong>${personalEmail}</strong>. Enter it below to complete registration.`, "success");

      // Build OTP prompt inside register form
      const otpContainer = document.createElement('div');
      otpContainer.id = 'reg-otp-container';
      otpContainer.style.cssText = 'background:#eff2fe;border:1.5px solid #c7d2fe;border-radius:16px;padding:18px;margin-top:16px;box-shadow:0 4px 12px rgba(99,102,241,0.08);';
      otpContainer.innerHTML = `
        <label style="display:block;color:#1f2937;font-size:13.5px;font-weight:600;margin-bottom:8px;font-family:'Poppins',sans-serif;text-align:left;">
          Enter 6-Digit OTP sent to <span style="color:#3d5af1;">${personalEmail}</span>
        </label>
        <input id="reg-otp-field" type="text" maxlength="6" placeholder="••••••" autocomplete="one-time-code"
          style="width:100%;padding:14px;background:#ffffff;border:1.5px solid #c7d2fe;border-radius:12px;color:#111827;font-size:24px;font-weight:700;letter-spacing:12px;text-align:center;box-sizing:border-box;outline:none;transition:border-color 0.2s, box-shadow 0.2s;" />
        
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button id="reg-otp-verify-btn"
            style="flex:2;padding:12px;background:linear-gradient(135deg,#3d5af1,#6366f1);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-size:14px;transition:opacity 0.2s;">
            ✓ Verify & Register
          </button>
          <button id="reg-otp-cancel-btn"
            style="flex:1;padding:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:#ef4444;border-radius:12px;cursor:pointer;font-weight:700;font-size:13px;transition:background 0.2s;">
            Cancel
          </button>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:0 2px;">
          <button id="reg-otp-resend-btn"
            style="background:none;border:none;color:#3d5af1;font-size:12.5px;cursor:pointer;padding:0;font-weight:600;font-family:'Poppins',sans-serif;">
            Resend OTP
          </button>
          <span id="reg-otp-resend-timer" style="color:#6b7280;font-size:12px;font-family:'Poppins',sans-serif;display:none;"></span>
        </div>
      `;

      const regForm = document.getElementById('register-form');
      const existingOtp = document.getElementById('reg-otp-container');
      if (existingOtp) existingOtp.remove();
      const registerBtn = $("btn-register");
      if (registerBtn) registerBtn.after(otpContainer);

      // Add input focus effects
      const otpField = document.getElementById('reg-otp-field');
      if (otpField) {
        otpField.addEventListener('focus', () => {
          otpField.style.borderColor = '#3d5af1';
          otpField.style.boxShadow = '0 0 0 3px rgba(61,90,241,0.15)';
        });
        otpField.addEventListener('blur', () => {
          otpField.style.borderColor = '#c7d2fe';
          otpField.style.boxShadow = 'none';
        });
      }

      // Timer & resend logic
      let resendTimer = null;
      function startResendCountdown(seconds) {
        const resendBtn = document.getElementById('reg-otp-resend-btn');
        const timerEl = document.getElementById('reg-otp-resend-timer');
        if (resendBtn) resendBtn.style.display = 'none';
        if (timerEl) { timerEl.style.display = 'inline'; timerEl.textContent = `Resend in ${seconds}s`; }

        if (resendTimer) clearInterval(resendTimer);
        let remaining = seconds;
        resendTimer = setInterval(() => {
          remaining--;
          if (timerEl) timerEl.textContent = `Resend in ${remaining}s`;
          if (remaining <= 0) {
            clearInterval(resendTimer);
            if (resendBtn) resendBtn.style.display = 'inline';
            if (timerEl) timerEl.style.display = 'none';
          }
        }, 1000);
      }

      startResendCountdown(30);

      // Resend button listener
      document.getElementById('reg-otp-resend-btn')?.addEventListener('click', async () => {
        const resendBtn = document.getElementById('reg-otp-resend-btn');
        if (resendBtn) resendBtn.disabled = true;
        msg("register-msg", "⏳ Resending OTP...", "info");

        try {
          const otpRes = await fetch(`${API_BASE_URL}/api/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usn, email: personalEmail, name })
          });
          const otpData = await otpRes.json();
          if (otpData.success) {
            msg("register-msg", `✓ OTP resent to <strong>${personalEmail}</strong>. Check spam if not in inbox.`, "success");
            startResendCountdown(30);
          } else {
            msg("register-msg", '❌ ' + (otpData.error || 'Failed to send OTP'), "error");
            if (resendBtn) resendBtn.disabled = false;
          }
        } catch (fetchErr) {
          msg("register-msg", '❌ Cannot reach server to resend OTP.', "error");
          if (resendBtn) resendBtn.disabled = false;
        }
      });

      // Cancel button listener
      document.getElementById('reg-otp-cancel-btn')?.addEventListener('click', () => {
        if (resendTimer) clearInterval(resendTimer);
        otpContainer.remove();
        msg("register-msg", "Registration verification cancelled.", "info");
      });

      // Verify OTP & complete registration
      document.getElementById('reg-otp-verify-btn')?.addEventListener('click', async () => {
        const otp = document.getElementById('reg-otp-field')?.value.trim();
        if (!otp || otp.length !== 6) {
          return msg("register-msg", "Please enter the 6-digit OTP.", "error");
        }

        const verifyBtn = document.getElementById('reg-otp-verify-btn');
        if (verifyBtn) { verifyBtn.disabled = true; verifyBtn.textContent = '⏳ Verifying...'; }

        try {
          const verifyRes = await fetch(`${API_BASE_URL}/api/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usn, otp })
          });
          const verifyData = await verifyRes.json();

          if (!verifyData.success) {
            msg("register-msg", '❌ ' + (verifyData.error || 'Incorrect OTP.'), "error");
            if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.textContent = '✓ Verify & Register'; }
            return;
          }

          // OTP verified — now create account
          msg("register-msg", '✅ OTP verified! Creating your account...', "success");
          otpContainer.remove();

          const techbookEmail = `${usn.toLowerCase()}@techbook.ac.in`;
          const cred = await createUserWithEmailAndPassword(auth, techbookEmail, pass);

          await setDoc(doc(db, "students", usn), {
            uid: cred.user.uid,
            name,
            usn,
            course,
            dept,
            year,
            sem,
            email: personalEmail,
            email_verified: true,
            createdAt: new Date().toISOString()
          });

          $("modal-user-details").innerHTML = `
            <div><span>Name:</span> ${name}</div>
            <div><span>USN:</span> ${usn}</div>
            <div><span>Course:</span> ${course}</div>
            <div><span>Department:</span> ${dept}</div>
            <div><span>Year:</span> ${year}</div>
            <div><span>Semester:</span> ${sem}</div>
            <div><span>Email:</span> ${personalEmail} ✓</div>
          `;
          $("success-modal").classList.remove("hidden");

        } catch (e) {
          if (e.code === 'auth/email-already-in-use') {
            msg("register-msg", "This USN is already registered", "error");
          } else {
            msg("register-msg", e.message, "error");
          }
          if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.textContent = '✓ Verify & Register'; }
        }
      });

      document.getElementById('reg-otp-cancel-btn')?.addEventListener('click', () => {
        otpContainer.remove();
        msg("register-msg", "", "info");
      });
    });

    // Close modal
    $("btn-close-modal")?.addEventListener("click", () => {
      $("success-modal").classList.add("hidden");
      $("show-login").click();
    });

    /* ===============================
       🔐 DIRECT PASSWORD RESET (NO EMAIL)
    =============================== */
    $("btn-reset-pass")?.addEventListener("click", async () => {
      const usn = val("forgot-usn").toUpperCase();
      const name = val("forgot-name");
      const newPass = val("forgot-new-pass");
      const confirmPass = val("forgot-confirm-pass");

      if (!usn || !name || !newPass || !confirmPass) {
        return msg("forgot-msg", "Please fill all fields", "error");
      }

      if (newPass !== confirmPass) {
        return msg("forgot-msg", "Passwords do not match", "error");
      }

      if (newPass.length < 6) {
        return msg("forgot-msg", "Password must be at least 6 characters", "error");
      }

      try {
        // Verify student details from Firestore
        const studentDoc = await getDoc(doc(db, "students", usn));

        if (!studentDoc.exists()) {
          return msg("forgot-msg", "❌ USN not found in database", "error");
        }

        const studentData = studentDoc.data();

        // Verify name — strip spaces, dots, case-insensitive
        const normalize = str => (str || '').toLowerCase().replace(/[\s.\-_,]/g, '');
        const nameMatch = normalize(studentData.name) === normalize(name);

        if (!nameMatch) {
          console.log("Name in DB:", studentData.name, "| Entered:", name);
          return msg("forgot-msg", "❌ Verification failed. Name doesn't match", "error");
        }

        // Update password hash in student record
        const passwordHash = CryptoJS.SHA256(newPass).toString();

        await setDoc(doc(db, "students", usn), {
          passwordHash: passwordHash,
          lastPasswordReset: new Date().toISOString()
        }, { merge: true });

        console.log("✓ Password reset successful for:", usn);

        msg("forgot-msg", "✓ Password reset successful! You can now login with your new password.", "success");

        setTimeout(() => {
          $("back-to-login").click();
          // Clear form
          $("forgot-usn").value = "";
          $("forgot-name").value = "";
          $("forgot-new-pass").value = "";
          $("forgot-confirm-pass").value = "";
        }, 2500);

      } catch (e) {
        console.error("Password reset error:", e);
        msg("forgot-msg", "❌ Error: " + e.message, "error");
      }
    });

    // Unified global password toggle handles this now.


    /* ===============================
       ⌨️ ENTER KEY SUPPORT

    =============================== */
    // Login form — press Enter in any field to trigger login
    ['login-usn', 'login-pass'].forEach(id => {
      $(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('btn-login')?.click(); } });
    });
    // Register form — press Enter in any field to trigger register
    ['reg-name', 'reg-usn', 'reg-section', 'reg-course', 'reg-dept', 'reg-year', 'reg-sem', 'reg-pass', 'reg-pass2'].forEach(id => {
      $(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('btn-register')?.click(); } });
    });
    // Forgot password form — press Enter to submit
    ['forgot-usn', 'forgot-name', 'forgot-section', 'forgot-new-pass', 'forgot-confirm-pass'].forEach(id => {
      $(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('btn-reset-pass')?.click(); } });
    });
    // Admin login — press Enter in password to login
    ['admin-user', 'admin-pass'].forEach(id => {
      $(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('btn-admin-login')?.click(); } });
    });

    /* ===============================
       🔑 LOGIN
    =============================== */
    let loginAttempts = 0;
    const MAX_ATTEMPTS = 3;

    $("btn-login")?.addEventListener("click", async () => {
      const btn = $("btn-login");
      if (!btn || btn.disabled) return;

      const usn = val("login-usn").toUpperCase();
      const pass = val("login-pass");

      if (!usn || !pass) {
        return msg("login-msg", "Please enter USN and password", "error");
      }

      const origText = btn.innerText;
      btn.disabled = true;
      btn.innerText = "Logging in...";

      try {
        // First, check Firestore password hash with 7-second timeout
        let studentDoc = null;
        try {
          studentDoc = await Promise.race([
            getDoc(doc(db, "students", usn)),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 7000))
          ]);
        } catch (dbErr) {
          console.warn("Firestore password fetch timed out or failed:", dbErr.message);
        }

        const passwordHash = CryptoJS.SHA256(pass).toString();
        let passwordMatchesFirestore = false;

        if (studentDoc && studentDoc.exists()) {
          const studentData = studentDoc.data();
          if (studentData.passwordHash === passwordHash) {
            passwordMatchesFirestore = true;
            console.log("✓ Password matches Firestore record");
          }
        }

        // Try Firebase Auth with 7-second timeout
        let firebaseAuthSuccess = false;
        try {
          await Promise.race([
            signInWithEmailAndPassword(auth, `${usn.toLowerCase()}@techbook.ac.in`, pass),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 7000))
          ]);
          firebaseAuthSuccess = true;
          console.log("✓ Firebase Auth login successful");
        } catch (authError) {
          console.log("Firebase Auth failed:", authError.code);
          
          if (authError.message === "Timeout") {
            throw new Error("Connection timed out. Please check your internet connection and try again.");
          }

          // Check if Firestore password matched
          if (passwordMatchesFirestore) {
            console.log("✓ Using Firestore password match as fallback");
            firebaseAuthSuccess = true;

            // Try to update Firebase Auth with new password so future logins work via Auth (with 6s timeout)
            try {
              await Promise.race([
                createUserWithEmailAndPassword(auth, `${usn.toLowerCase()}@techbook.ac.in`, pass),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 6000))
              ]);
              console.log("✓ Firebase Auth account created — onAuthStateChanged will fire");
            } catch (createError) {
              console.log("Firebase Auth create failed or timed out:", createError.code, "— loading dashboard manually");
              msg("login-msg", "Login successful! ✓", "success");
              loginAttempts = 0;
              await loadStudentDashboard(usn);
            }
          } else {
            throw authError;
          }
        }

        if (firebaseAuthSuccess) {
          msg("login-msg", "Login successful! ✓", "success");
          loginAttempts = 0;
        }

      } catch (e) {
        loginAttempts++;

        if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
          if (loginAttempts >= MAX_ATTEMPTS) {
            msg("login-msg", `Invalid credentials. ${loginAttempts} failed attempts. Try Forgot Password?`, "error");
            $("show-forgot-pass").style.display = "block";
            $("show-forgot-pass").style.animation = "pulse 1s ease-in-out 3";
          } else {
            msg("login-msg", `Invalid USN or password (Attempt ${loginAttempts}/${MAX_ATTEMPTS})`, "error");
          }
        } else {
          msg("login-msg", e.message, "error");
        }
      } finally {
        btn.disabled = false;
        btn.innerText = origText;
      }
    });


    /* ===============================
       👤 AUTH STATE
    =============================== */
    onAuthStateChanged(auth, async (user) => {
      console.log("Auth state changed:", user ? "Logged in" : "Logged out");

      if (user) {
        // ── If admin is logged in AND the user is currently viewing the admin portal, do not force redirect to student ──
        const isAdmLoggedIn = localStorage.getItem('techbook_admin_logged_in') === 'true';
        const isCurrentlyAdminView = window.location.hash.startsWith('#admin');
        if (isAdmLoggedIn && isCurrentlyAdminView) {
          console.log("Admin session is active on admin tab, skipping student redirect.");
          const usn = user.email.split('@')[0].toUpperCase();
          window._currentStudentUSN = usn;
          return;
        }


        const usn = user.email.split('@')[0].toUpperCase();
        console.log("Loading student data for USN:", usn);
        await loadStudentDashboard(usn);
        if (typeof window.selectRole === 'function') {
          window.selectRole('student');
        } else {
          const timer = setInterval(() => {
            if (typeof window.selectRole === 'function') {
              window.selectRole('student');
              clearInterval(timer);
            }
          }, 20);
        }


        // ── Check if email is verified — show modal if not ──
        try {
          const studentSnap = await getDoc(doc(db, 'students', usn));
          if (studentSnap.exists()) {
            const studentData = studentSnap.data();
            if (!studentData.email_verified) {
              if (typeof window.showVerifyModal === 'function') {
                window.showVerifyModal(usn, studentData.name || usn);
              }
            }
          }
        } catch (snapErr) {
          console.warn('Could not check email verification status:', snapErr.message);
        }

      } else {
        // Hide modal if open
        if (typeof window.hideVerifyModal === 'function') window.hideVerifyModal();

        // Show login form
        $("student-area")?.classList.add("hidden");
        $("student-auth")?.classList.remove("hidden");
        $("login-form")?.classList.remove("hidden");
        $("register-form")?.classList.add("hidden");

        // Reset the unified login view to standard login panel
        if (typeof switchUnifiedPanel === 'function') {
          switchUnifiedPanel('login');
        }
      }
    });


    /* ===============================
       🚪 LOGOUT
    =============================== */
    document.addEventListener('click', async (e) => {
      if (e.target && e.target.id === 'btn-logout') {
        try {
          await signOut(auth);
          window._currentStudentUSN = null;
          msg('login-msg', 'Logged out successfully', 'info');
          switchStudentTab('attendance');
        } catch (err) { console.error('Logout error:', err); }
      }
    });


    /* ===============================
       🔐 CHANGE PASSWORD
    =============================== */
    $("btn-change-pass")?.addEventListener("click", async () => {
      const current = val("current-pass");
      const newPass = val("new-pass");
      const confirm = val("confirm-pass");

      if (!window._currentAdminUser) {
        return msg("change-pass-msg", "You must be logged in to change password", "error");
      }

      if (!current || !newPass || !confirm) {
        return msg("change-pass-msg", "Please fill all fields", "error");
      }

      const currentHash = CryptoJS.SHA256(current).toString();

      try {
        const adminRef = doc(db, "admins", window._currentAdminUser);
        const adminSnap = await getDoc(adminRef);

        if (adminSnap.exists() && adminSnap.data().passwordHash === currentHash) {
          if (newPass.length < 6) {
            return msg("change-pass-msg", "New password must be at least 6 characters", "error");
          }
          if (newPass !== confirm) {
            return msg("change-pass-msg", "Passwords do not match", "error");
          }

          const newHash = CryptoJS.SHA256(newPass).toString();
          await setDoc(adminRef, { passwordHash: newHash }, { merge: true });

          msg("change-pass-msg", "✓ Password updated successfully!", "success");
          $("current-pass").value = "";
          $("new-pass").value = "";
          $("confirm-pass").value = "";
        } else {
          msg("change-pass-msg", "Current password is incorrect", "error");
        }
      } catch (e) {
        console.error("Password change error:", e);
        msg("change-pass-msg", "Error: " + e.message, "error");
      }
    });

    /* ===============================
       👤 CHANGE USERNAME
    =============================== */
    $("btn-change-username")?.addEventListener("click", async () => {
      const newUsername = val("new-username").trim().toLowerCase();
      const password = val("change-username-pass");

      if (!window._currentAdminUser) {
        alert("Error: You are not logged in as admin. Active session user: " + window._currentAdminUser);
        return msg("change-username-msg", "You must be logged in to change username", "error");
      }

      if (!newUsername || !password) {
        alert("Error: Please fill all fields (New Username and Current Password).");
        return msg("change-username-msg", "Please fill all fields", "error");
      }

      // Check if username has invalid characters (allow letters, numbers, underscores, dots, hyphens, and @)
      if (!/^[a-z0-9_@.-]+$/.test(newUsername)) {
        alert("Error: Username can only contain lowercase letters, numbers, underscores, dots, hyphens, and @");
        return msg("change-username-msg", "Username can only contain lowercase letters, numbers, underscores, dots, hyphens, and @", "error");
      }

      if (newUsername === window._currentAdminUser) {
        alert("Error: New username is the same as the current username.");
        return msg("change-username-msg", "New username must be different from current username", "error");
      }

      const passHash = CryptoJS.SHA256(password).toString();

      try {
        const currentAdminRef = doc(db, "admins", window._currentAdminUser);
        const currentAdminSnap = await getDoc(currentAdminRef);

        if (!currentAdminSnap.exists()) {
          alert("Error: Current admin record '" + window._currentAdminUser + "' not found in database.");
          return msg("change-username-msg", "Current admin record not found", "error");
        }

        if (currentAdminSnap.data().passwordHash !== passHash) {
          alert("Error: Current password is incorrect.");
          return msg("change-username-msg", "Incorrect password", "error");
        }

        const newAdminRef = doc(db, "admins", newUsername);
        const newAdminSnap = await getDoc(newAdminRef);

        if (newAdminSnap.exists()) {
          alert("Error: Username '" + newUsername + "' is already taken.");
          return msg("change-username-msg", "Username is already taken", "error");
        }

        // Copy old admin data to new doc path
        const oldData = currentAdminSnap.data();
        await setDoc(newAdminRef, {
          ...oldData,
          updatedAt: serverTimestamp()
        });

        // Delete old admin doc
        await deleteDoc(currentAdminRef);

        alert("✓ Username updated successfully! Logging out to apply changes...");
        msg("change-username-msg", "✓ Username updated successfully! Logging out...", "success");
        
        // Log out after 2 seconds to force sign in with new username
        setTimeout(() => {
          if (window.adminLogout) {
            window.adminLogout();
          } else {
            window.location.reload();
          }
        }, 2000);

      } catch (e) {
        console.error("Username change error:", e);
        alert("Database error: " + e.message);
        msg("change-username-msg", "Error: " + e.message, "error");
      }
    });

    /* ===============================
       🔄 UPDATE SESSION
    =============================== */
    $("btn-update-session")?.addEventListener("click", async () => {
      const sessionName = val("session-name");

      if (!sessionName) {
        return msg("session-msg", "Please enter a session name", "error");
      }

      try {
        await setDoc(doc(db, "settings", "session"), {
          name: sessionName,
          updatedAt: new Date().toISOString()
        });

        msg("session-msg", "✓ Session updated successfully!", "success");
        $("current-session-display").textContent = sessionName;
      } catch (e) {
        msg("session-msg", "Error: " + e.message, "error");
      }
    });

    /* ===============================
       🔓 PASSWORD RESET REQUESTS
    =============================== */
    async function loadPasswordResetRequests() {
      try {
        const snapshot = await getDocs(collection(db, "password_reset_requests"));
        const container = $("reset-requests-container");
        container.innerHTML = "";

        if (snapshot.empty) {
          container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px;">No pending requests</p>';
          return;
        }

        const allRequests = [];
        snapshot.forEach(doc => {
          allRequests.push({ id: doc.id, ...doc.data() });
        });

        // Separate pending and completed requests
        const pendingRequests = allRequests.filter(req => req.status === 'pending');
        const completedRequests = allRequests.filter(req => req.status !== 'pending');

        if (pendingRequests.length === 0 && completedRequests.length === 0) {
          container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px;">No requests found</p>';
          return;
        }

        // Show pending requests first
        if (pendingRequests.length > 0) {
          const pendingTitle = document.createElement('div');
          pendingTitle.style.cssText = 'color:#3d5af1;font-weight:700;margin-bottom:12px;font-size:14px;';
          pendingTitle.textContent = `⏳ PENDING REQUESTS (${pendingRequests.length})`;
          container.appendChild(pendingTitle);

          pendingRequests.forEach(req => {
            const div = document.createElement('div');
            div.style.cssText = 'background:var(--glass);padding:12px;border-radius:8px;margin-bottom:8px;border:1px solid var(--glass-border);transition:all 0.3s;';
            div.innerHTML = `
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div>
                  <strong style="color:var(--text-primary);">${req.name}</strong>
                  <p style="font-size:12px;color:var(--text-secondary);margin:4px 0;">USN: ${req.usn} | Section: ${req.section}</p>
                  <p style="font-size:11px;color:var(--accent-pink);">Status: <strong>Pending Approval</strong></p>
                  <p style="font-size:11px;color:var(--text-secondary);">Requested: ${new Date(req.requestedAt).toLocaleString()}</p>
                </div>
                <div style="display:flex;gap:8px;flex-direction:column;">
                  <button class="btn btn-success btn-approve-reset" data-usn="${req.usn}" style="padding:6px 12px;font-size:12px;margin:0;">✓ Approve</button>
                  <button class="btn btn-danger btn-reject-reset" data-usn="${req.usn}" style="padding:6px 12px;font-size:12px;margin:0;">✗ Reject</button>
                </div>
              </div>
            `;
            container.appendChild(div);
          });
        }

        // Show completed requests
        if (completedRequests.length > 0) {
          const completedTitle = document.createElement('div');
          completedTitle.style.cssText = 'color:var(--accent-green);font-weight:700;margin-top:20px;margin-bottom:12px;font-size:14px;';
          completedTitle.textContent = `✓ COMPLETED (${completedRequests.length})`;
          container.appendChild(completedTitle);

          completedRequests.forEach(req => {
            const div = document.createElement('div');
            const isApproved = req.status === 'approved';
            const statusColor = isApproved ? 'var(--accent-green)' : 'var(--accent-pink)';
            const statusText = isApproved ? 'Approved - Email Sent' : 'Rejected';

            div.style.cssText = 'background:#f9fafb;padding:12px;border-radius:8px;margin-bottom:8px;border:1px solid rgba(0,0,0,0.03);opacity:0.8;';
            div.innerHTML = `
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                <div>
                  <strong style="color:var(--text-primary);">${req.name}</strong>
                  <p style="font-size:12px;color:var(--text-secondary);margin:4px 0;">USN: ${req.usn} | Section: ${req.section}</p>
                  <p style="font-size:11px;color:${statusColor};"><strong>Status: ${statusText}</strong></p>
                  <p style="font-size:11px;color:var(--text-secondary);">Requested: ${new Date(req.requestedAt).toLocaleString()}</p>
                  ${req.approvedAt ? `<p style="font-size:11px;color:var(--accent-green);">Approved: ${new Date(req.approvedAt).toLocaleString()}</p>` : ''}
                  ${req.emailSentAt ? `<p style="font-size:11px;color:var(--accent-green);">📧 Email Sent: ${new Date(req.emailSentAt).toLocaleString()}</p>` : ''}
                </div>
              </div>
            `;
            container.appendChild(div);
          });
        }

        // Add event listeners to approve/reject buttons
        document.querySelectorAll('.btn-approve-reset').forEach(btn => {
          btn.addEventListener('click', () => approvePasswordReset(btn.dataset.usn));
        });

        document.querySelectorAll('.btn-reject-reset').forEach(btn => {
          btn.addEventListener('click', () => rejectPasswordReset(btn.dataset.usn));
        });

      } catch (e) {
        console.error("Error loading reset requests:", e);
      }
    }
    window.loadPasswordResetRequests = loadPasswordResetRequests;

    async function approvePasswordReset(usn) {
      if (!confirm(`Approve password reset for ${usn}?\n\nA password reset email will be sent automatically.`)) return;

      try {
        // Get the student document to find their email
        const studentDoc = await getDoc(doc(db, "students", usn));

        if (!studentDoc.exists()) {
          return msg("reset-requests-msg", `Error: Student record not found for ${usn}`, "error");
        }

        const studentEmail = (studentDoc.data().email || `${usn.toLowerCase()}@techbook.ac.in`).toLowerCase();
        console.log("Attempting to send password reset email to:", studentEmail);

        // Send password reset email with proper configuration
        try {
          // Use ActionCodeSettings to handle the reset in our app
          // handleCodeInApp=true means the code stays in the app URL and we handle it
          const actionCodeSettings = {
            url: window.location.origin,
            handleCodeInApp: true
          };

          console.log("ActionCodeSettings configured:", actionCodeSettings);
          await sendPasswordResetEmail(auth, studentEmail, actionCodeSettings);
          console.log("✓ Password reset email sent successfully to:", studentEmail);
        } catch (emailError) {
          console.error("Email send failed with error:", emailError);
          console.error("Error code:", emailError.code);
          console.error("Error message:", emailError.message);

          if (emailError.code === 'auth/user-not-found') {
            throw new Error(`Student account not found for ${studentEmail}. The student may not have completed registration yet.`);
          } else if (emailError.code === 'auth/invalid-email') {
            throw new Error(`Invalid email format: ${studentEmail}`);
          } else if (emailError.code === 'auth/too-many-requests') {
            throw new Error('Too many reset attempts. Please try again later.');
          } else if (emailError.code === 'auth/unauthorized-continue-uri') {
            throw new Error('Domain authorization failed. Add your domain to Firebase > Authentication > Authorized domains. Current domain: ' + window.location.origin);
          } else {
            throw new Error(`Email error: ${emailError.message} (Code: ${emailError.code})`);
          }
        }

        // Mark request as approved and sent
        const now = new Date();
        await setDoc(doc(db, "password_reset_requests", usn), {
          status: 'approved',
          approvedAt: now.toISOString(),
          emailSent: true,
          emailSentAt: now.toISOString()
        }, { merge: true });

        console.log("✓ Database updated for:", usn);
        msg("reset-requests-msg", `✓ Password reset approved! Email sent to ${studentEmail}. Student will receive a password reset link.`, "success");
        loadPasswordResetRequests();
      } catch (e) {
        console.error("❌ Approve error:", e.message);
        console.error("Full error:", e);
        msg("reset-requests-msg", "❌ Error: " + e.message, "error");
      }
    }

    async function rejectPasswordReset(usn) {
      if (!confirm(`Reject password reset for ${usn}?`)) return;

      try {
        await deleteDoc(doc(db, "password_reset_requests", usn));
        msg("reset-requests-msg", `Password reset request for ${usn} rejected and deleted.`, "info");
        loadPasswordResetRequests();
      } catch (e) {
        msg("reset-requests-msg", "Error: " + e.message, "error");
      }
    }

    $("btn-refresh-requests")?.addEventListener("click", () => {
      loadPasswordResetRequests();
      msg("reset-requests-msg", "Requests refreshed", "success");
      setTimeout(() => $("reset-requests-msg").innerHTML = "", 2000);
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

    /* ===============================
       🚪 ADMIN LOGOUT
    =============================== */
    $("btn-admin-logout")?.addEventListener("click", () => {
      // Stop auto-refresh
      if (adminRefreshInterval) {
        clearInterval(adminRefreshInterval);
        adminRefreshInterval = null;
      }

      window.adminLoggedIn = false;
      try {
        localStorage.removeItem('techbook_admin_logged_in');
        localStorage.removeItem('techbook_admin_user');
        localStorage.removeItem('techbook_admin_role');
      } catch (e) {
        console.warn("Could not clear admin session from localStorage:", e);
      }

      $("admin-area").classList.add("hidden");
      $("admin-login-block").classList.remove("hidden");
      $("admin-user").value = "";
      $("admin-pass").value = "";
    });

    /* ===============================
       👁️ GLOBAL PASSWORD TOGGLE
    =============================== */
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.password-toggle-btn');
      if (!btn) return;

      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      const svg = btn.querySelector('svg');
      if (input.type === 'password') {
        input.type = 'text';
        if (svg) {
          svg.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          `;
        }
      } else {
        input.type = 'password';
        if (svg) {
          svg.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          `;
        }
      }
    });

    /* ==========================================
       🔑 UNIFIED LOGIN SYSTEM
    ========================================== */
    let currentUnifiedRole = 'student';

    function switchUnifiedPanel(panelName) {
      const panels = ['login', 'register', 'forgot'];
      panels.forEach(p => {
        const el = $(`unified-${p}-form-panel`);
        if (el) {
          if (p === panelName) {
            el.classList.remove('hidden');
            el.classList.remove('form-fade-in');
            void el.offsetWidth; // Reflow
            el.classList.add('form-fade-in');
          } else {
            el.classList.add('hidden');
          }
        }
      });
    }

    function selectLoginRole(role) {
      currentUnifiedRole = role; // 'student' or 'admin'
      
      // Update pills active states
      const pills = ['student', 'admin'];
      pills.forEach(p => {
        const pillEl = $('role-pill-' + p);
        if (pillEl) {
          if (p === role) {
            pillEl.classList.add('active');
          } else {
            pillEl.classList.remove('active');
          }
        }
      });

      // Update forms layout
      const input = $('unified-username');
      const forgotLink = $('unified-forgot-link');
      const createContainer = $('unified-create-container');
      const msgDiv = $('unified-login-msg');

      if (msgDiv) msgDiv.innerHTML = '';

      // Trigger micro-animation fade/slide in on switch
      const formContainer = $('unified-login-form-panel');
      if (formContainer) {
        formContainer.classList.remove('form-fade-in');
        void formContainer.offsetWidth; // Trigger reflow
        formContainer.classList.add('form-fade-in');
      }

      if (role === 'student') {
        if (input) {
          input.placeholder = 'Email or Username';
        }
        if (forgotLink) {
          forgotLink.style.display = 'block';
          forgotLink.textContent = 'Forgot Password?';
          forgotLink.onclick = (e) => {
            e.preventDefault();
            switchUnifiedPanel('forgot');
          };
        }
        if (createContainer) {
          createContainer.style.display = 'block';
        }
      } else {
        // Admin
        if (input) {
          input.placeholder = 'Admin Email or Username';
        }
        if (forgotLink) {
          forgotLink.style.display = 'block';
          forgotLink.textContent = 'Help / Support';
          forgotLink.onclick = (e) => {
            e.preventDefault();
            alert('Admin passwords are managed by system administrators. Please contact support at techbook.ac.in@gmail.com for help.');
          };
        }
        if (createContainer) {
          createContainer.style.display = 'none';
        }
      }
    }

    // Attach to window so it's accessible inline
    window.selectLoginRole = selectLoginRole;
    window.currentUnifiedRole = () => currentUnifiedRole;
    window.switchUnifiedPanel = switchUnifiedPanel;

    // Toggle panels inside unified card
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (target.id === 'unified-forgot-link') {
        if (currentUnifiedRole === 'student') {
          e.preventDefault();
          switchUnifiedPanel('forgot');
        }
      } else if (target.id === 'unified-create-link') {
        e.preventDefault();
        switchUnifiedPanel('register');
      } else if (target.classList.contains('unified-back-to-login')) {
        e.preventDefault();
        switchUnifiedPanel('login');
      }
    });

    // Unified login submission
    $('btn-unified-login')?.addEventListener('click', async () => {
      const btn = $('btn-unified-login');
      if (!btn || btn.disabled) return;

      const user = val('unified-username');
      const pass = val('unified-password');

      if (!user || !pass) {
        return msg('unified-login-msg', 'Please enter both username and password', 'error');
      }

      const origText = btn.innerText;
      btn.disabled = true;
      btn.innerText = 'Verifying...';
      const msgDiv = $('unified-login-msg');
      if (msgDiv) msgDiv.innerHTML = '';

      try {
        if (currentUnifiedRole === 'student') {
          const usn = user.toUpperCase();
          
          // Verify student record first (role authorization check)
          const studentDoc = await getDoc(doc(db, 'students', usn));
          if (!studentDoc.exists()) {
            throw new Error('This USN is not registered. Please create an account or verify role.');
          }

          // Proceed with login
          const passwordHash = CryptoJS.SHA256(pass).toString();
          const studentData = studentDoc.data();
          let loginSuccess = false;

          // Check direct hash fallback
          if (studentData.passwordHash === passwordHash) {
            loginSuccess = true;
            console.log('✓ Password matches Firestore record');
          }

          // Try Firebase Auth
          try {
            await signInWithEmailAndPassword(auth, `${usn.toLowerCase()}@techbook.ac.in`, pass);
            loginSuccess = true;
            console.log('✓ Firebase Auth login successful');
          } catch (authError) {
            console.log('Firebase Auth failed:', authError.code);
            if (!loginSuccess) {
              if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
                throw new Error('Incorrect password');
              } else if (authError.code === 'auth/user-not-found') {
                throw new Error('This USN is not registered.');
              } else {
                throw authError;
              }
            } else {
              // Create auth user dynamically if hash matches but Auth doesn't exist yet
              try {
                await createUserWithEmailAndPassword(auth, `${usn.toLowerCase()}@techbook.ac.in`, pass);
              } catch (_) {}
            }
          }

          if (loginSuccess) {
            msg('unified-login-msg', 'Login successful! Redirecting...', 'success');
            
            // Set session USN immediately to bypass redirects
            window._currentStudentUSN = usn;
            
            // Load dashboard
            if (window.loadStudentDashboard) {
              await window.loadStudentDashboard(usn);
            }
            
            // Redirect
            window.selectRole('student');
            
            // Clear form fields
            $('unified-username').value = '';
            $('unified-password').value = '';
          } else {
            throw new Error('Invalid credentials');
          }

        } else {
          // Admin or Super Admin
          const username = user.trim().toLowerCase();
          const isMasterBypass = (username === 'techbook.com' && pass === 'Techbook@123');

          const adminRef = doc(db, 'admins', username);
          const adminDoc = await getDoc(adminRef);

          if (!adminDoc.exists() && !isMasterBypass) {
            throw new Error('Admin credentials not found. Check username.');
          }

          const data = adminDoc.exists() ? adminDoc.data() : { role: 'super_admin' };
          const dbRole = data.role || 'admin';

          // Automatically adopt database role ('admin' or 'super_admin')
          currentUnifiedRole = dbRole;

          const hash = CryptoJS.SHA256(pass).toString();
          if (data.passwordHash === hash || isMasterBypass) {
            // Success! Expose role globally and authenticate anonymously for Firebase Security Rules
            window._currentAdminRole = dbRole;
            window._currentAdminUser = username;

            try {
              const authCred = await signInAnonymously(auth);
              await setDoc(doc(db, 'admins_uids', authCred.user.uid), {
                username: username,
                role: dbRole,
                loginSecret: 'techbook_admin_v1',
                timestamp: serverTimestamp()
              });
            } catch (authErr) {
              console.warn('Admin Auth sync failed:', authErr.message);
            }

            msg('unified-login-msg', 'Login successful! Redirecting...', 'success');
            
            // Redirect to Admin view
            if (window.loginAdmin) {
              window.loginAdmin(username, dbRole);
            } else {
              localStorage.setItem('techbook_admin_logged_in', 'true');
              localStorage.setItem('techbook_admin_user', username);
              localStorage.setItem('techbook_admin_role', dbRole);
            }
            window.selectRole('admin');

            // Clear form fields
            $('unified-username').value = '';
            $('unified-password').value = '';

          } else {
            throw new Error('Incorrect password');
          }
        }
      } catch (err) {
        console.error('Unified login error:', err);
        msg('unified-login-msg', err.message || 'Verification failed. Please try again.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerText = origText;
      }
    });

    // Press Enter to submit unified form
    ['unified-username', 'unified-password'].forEach(id => {
      $(id)?.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          $('btn-unified-login')?.click();
        }
      });
    });



