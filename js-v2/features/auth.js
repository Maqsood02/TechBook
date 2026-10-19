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
  confirmPasswordReset,
  updateEmail
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
      const scheme = val("reg-scheme") || (sem === "1" || sem === "2" ? "2026" : "2022");
      const pass = val("reg-pass");
      const pass2 = val("reg-pass2");
      const personalEmail = val("reg-email") ? val("reg-email").trim().toLowerCase() : '';
      console.log("Register values:", { name, usn, course, dept, year, sem, scheme, personalEmail });

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
        console.warn("Client pre-verification skipped (handled by backend):", checkErr);
      }

      // ── Send OTP for email verification ──
      msg("register-msg", "⏳ Sending OTP to your email...", "info");
      try {
        const otpRes = await fetch(`${API_BASE_URL}/api/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usn, email: personalEmail, name, type: 'register' })
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
        <label style="display:block;color:#1f2937;font-size:13.5px;font-weight:600;margin-bottom:12px;font-family:'Poppins',sans-serif;text-align:center;">
          Enter 6-Digit OTP sent to <span style="color:#3d5af1;">${personalEmail}</span>
        </label>
        <div id="reg-otp-boxes" style="display:flex;justify-content:center;gap:8px;margin-bottom:14px;">
          <input class="reg-digit-box" type="text" inputmode="numeric" maxlength="1" style="width:44px;min-width:44px;max-width:44px;height:52px;padding:0 !important;margin:0;border:1.5px solid #c7d2fe;border-radius:12px;font-size:22px;font-weight:700;text-align:center;line-height:52px;color:#0f172a;outline:none;background:#ffffff;box-sizing:border-box;box-shadow:none;transition:all 0.2s;" />
          <input class="reg-digit-box" type="text" inputmode="numeric" maxlength="1" style="width:44px;min-width:44px;max-width:44px;height:52px;padding:0 !important;margin:0;border:1.5px solid #c7d2fe;border-radius:12px;font-size:22px;font-weight:700;text-align:center;line-height:52px;color:#0f172a;outline:none;background:#ffffff;box-sizing:border-box;box-shadow:none;transition:all 0.2s;" />
          <input class="reg-digit-box" type="text" inputmode="numeric" maxlength="1" style="width:44px;min-width:44px;max-width:44px;height:52px;padding:0 !important;margin:0;border:1.5px solid #c7d2fe;border-radius:12px;font-size:22px;font-weight:700;text-align:center;line-height:52px;color:#0f172a;outline:none;background:#ffffff;box-sizing:border-box;box-shadow:none;transition:all 0.2s;" />
          <input class="reg-digit-box" type="text" inputmode="numeric" maxlength="1" style="width:44px;min-width:44px;max-width:44px;height:52px;padding:0 !important;margin:0;border:1.5px solid #c7d2fe;border-radius:12px;font-size:22px;font-weight:700;text-align:center;line-height:52px;color:#0f172a;outline:none;background:#ffffff;box-sizing:border-box;box-shadow:none;transition:all 0.2s;" />
          <input class="reg-digit-box" type="text" inputmode="numeric" maxlength="1" style="width:44px;min-width:44px;max-width:44px;height:52px;padding:0 !important;margin:0;border:1.5px solid #c7d2fe;border-radius:12px;font-size:22px;font-weight:700;text-align:center;line-height:52px;color:#0f172a;outline:none;background:#ffffff;box-sizing:border-box;box-shadow:none;transition:all 0.2s;" />
          <input class="reg-digit-box" type="text" inputmode="numeric" maxlength="1" style="width:44px;min-width:44px;max-width:44px;height:52px;padding:0 !important;margin:0;border:1.5px solid #c7d2fe;border-radius:12px;font-size:22px;font-weight:700;text-align:center;line-height:52px;color:#0f172a;outline:none;background:#ffffff;box-sizing:border-box;box-shadow:none;transition:all 0.2s;" />
        </div>
        <input id="reg-otp-field" type="hidden" />
        
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

      // Setup 6-digit box handlers
      const regBoxes = otpContainer.querySelectorAll('.reg-digit-box');
      function updateRegOtpCombined() {
        let combined = '';
        regBoxes.forEach(b => combined += b.value);
        const hiddenField = document.getElementById('reg-otp-field');
        if (hiddenField) hiddenField.value = combined;
        return combined;
      }

      regBoxes.forEach((box, idx) => {
        box.addEventListener('input', () => {
          const val = box.value.replace(/\D/g, '').slice(-1);
          box.value = val;
          const fullOtp = updateRegOtpCombined();
          if (val && idx < regBoxes.length - 1) {
            regBoxes[idx + 1].focus();
          } else if (fullOtp.length === 6) {
            document.getElementById('reg-otp-verify-btn')?.focus();
          }
        });
        box.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !box.value && idx > 0) {
            regBoxes[idx - 1].focus();
          } else if (e.key === 'Enter') {
            document.getElementById('reg-otp-verify-btn')?.click();
          }
        });
        box.addEventListener('focus', () => {
          box.style.borderColor = '#3d5af1';
          box.style.boxShadow = '0 0 0 3px rgba(61,90,241,0.15)';
        });
        box.addEventListener('blur', () => {
          box.style.borderColor = '#c7d2fe';
          box.style.boxShadow = 'none';
        });
      });

      const regBoxesWrapper = document.getElementById('reg-otp-boxes');
      if (regBoxesWrapper) {
        regBoxesWrapper.addEventListener('paste', (e) => {
          e.preventDefault();
          const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
          if (!text) return;
          regBoxes.forEach((box, i) => {
            box.value = text[i] || '';
          });
          updateRegOtpCombined();
          const targetIdx = Math.min(text.length, regBoxes.length - 1);
          regBoxes[targetIdx]?.focus();
        });
      }

      setTimeout(() => { regBoxes[0]?.focus(); }, 150);

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
            body: JSON.stringify({ usn, email: personalEmail, name, type: 'register' })
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
            scheme,
            email: personalEmail,
            email_verified: true,
            createdAt: new Date().toISOString()
          });

          $("modal-user-details").innerHTML = `
            <div><span>Name:</span> ${name}</div>
            <div><span>USN:</span> ${usn}</div>
            <div><span>Course:</span> ${course}</div>
            <div><span>Department:</span> ${dept}</div>
            <div><span>Scheme:</span> ${scheme} Scheme</div>
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

      if (!usn || !name) {
        return msg("forgot-msg", "Please enter USN and Full Name", "error");
      }
      if (!newPass || !confirmPass) {
        return msg("forgot-msg", "Please enter new password and confirm password", "error");
      }
      if (newPass.length < 6) {
        return msg("forgot-msg", "New password must be at least 6 characters long", "error");
      }
      if (newPass !== confirmPass) {
        return msg("forgot-msg", "Passwords do not match. Please verify", "error");
      }

      // Rate limit reset submissions: max 1 request every 45 seconds per USN
      const lastResetKey = 'tb_reset_ts_' + usn;
      const lastResetTime = localStorage.getItem(lastResetKey);
      if (lastResetTime && Date.now() - parseInt(lastResetTime) < 45000) {
        return msg("forgot-msg", "Please wait a moment before submitting another reset request.", "error");
      }

      const btn = $("btn-reset-pass");
      const origText = btn ? btn.innerText : "🔑 Reset Password";
      if (btn) { btn.disabled = true; btn.innerText = "Submitting..."; }

      try {
        // Hash the new password using SHA-256
        const newPasswordHash = CryptoJS.SHA256(newPass).toString();

        // Create reset request with status pending
        await setDoc(doc(db, "password_reset_requests", usn), {
          usn,
          name,
          newPasswordHash,
          requestedAt: new Date().toISOString(),
          status: 'pending'
        });

        localStorage.setItem(lastResetKey, Date.now().toString());
        console.log("✓ Password reset request submitted for:", usn);

        msg("forgot-msg", "✓ Password reset request submitted! Admin will approve it shortly.", "success");

        setTimeout(() => {
          $("back-to-login")?.click();
          const backLinks = document.querySelectorAll(".unified-back-to-login");
          backLinks.forEach(l => l.click());
          // Clear form
          $("forgot-usn").value = "";
          $("forgot-name").value = "";
          if ($("forgot-new-pass")) $("forgot-new-pass").value = "";
          if ($("forgot-confirm-pass")) $("forgot-confirm-pass").value = "";
          if (btn) { btn.disabled = false; btn.innerText = origText; }
        }, 2200);

      } catch (e) {
        console.error("Password reset request error:", e);
        msg("forgot-msg", "❌ Error: " + (e.message || "Failed to submit request"), "error");
        if (btn) { btn.disabled = false; btn.innerText = origText; }
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
      console.log("Auth state changed:", user ? (user.isAnonymous ? "Anonymous User" : user.email) : "Logged out");

      // Prevent anonymous session elevation
      if (user && user.isAnonymous) {
        console.log("Guest anonymous session active");
        return;
      }

      if (user && user.email) {
        const email = user.email.toLowerCase();
        const username = email.split('@')[0];
        let resolvedUsername = (username === 'cof.techbook') ? 'cof@techbook' : username;
        if (email === 'techbook.ac.in@gmail.com') {
          resolvedUsername = 'techbook.com';
        }

        // Try to fetch admin document to check admin status
        let isAdminUser = false;
        let dbRole = null;
        try {
          const adminSnap = await getDoc(doc(db, "admins", resolvedUsername));
          if (adminSnap.exists()) {
            isAdminUser = true;
            dbRole = adminSnap.data().role || 'admin';
          }
        } catch (e) {
          console.warn("Could not check admin status in database:", e.message);
        }

        if (isAdminUser || resolvedUsername === 'cof@techbook' || resolvedUsername === 'techbook.com' || email === 'techbook.ac.in@gmail.com') {
          if (!dbRole) {
            dbRole = (resolvedUsername === 'cof@techbook') ? 'co_founder' : 'super_admin';
          }
          console.log("Firebase Auth: Admin logged in:", resolvedUsername);
          if (typeof window.loginAdmin === 'function') {
            window.loginAdmin(resolvedUsername, dbRole);
          }
          if (typeof window.selectRole === 'function') {
            window.selectRole(dbRole === 'co_founder' ? 'cof' : 'admin');
          }
          if (typeof window.updateNavbarLoginBtn === 'function') {
            window.updateNavbarLoginBtn();
          }
          return;
        }

        // Student flow:
        const usn = resolvedUsername.toUpperCase();
        console.log("Firebase Auth: Student logged in:", usn);
        await loadStudentDashboard(usn);
        
        // Save student session locally for routing consistency
        localStorage.setItem('techbook_student_logged_in', 'true');
        localStorage.setItem('techbook_student_usn', usn);

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

        // Check if email is verified
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
        // Logged out or no active Firebase user
        // If an admin session is currently active in localStorage, do NOT purge admin session!
        if (localStorage.getItem('techbook_admin_logged_in') === 'true') {
          console.log("Preserving active admin session despite Firebase Auth state transition");
          return;
        }

        try {
          localStorage.removeItem('techbook_student_logged_in');
          localStorage.removeItem('techbook_student_usn');
          localStorage.removeItem('techbook_student_data');
        } catch (e) {
          console.warn("Could not clear session on logout:", e);
        }

        // Hide modal if open
        if (typeof window.hideVerifyModal === 'function') window.hideVerifyModal();

        // Show login forms
        $("student-area")?.classList.add("hidden");
        $("student-auth")?.classList.remove("hidden");
        $("admin-area")?.classList.add("hidden");
        $("admin-login-block")?.classList.remove("hidden");

        // Reset the unified login view to standard login panel
        if (typeof switchUnifiedPanel === 'function') {
          switchUnifiedPanel('login');
        }
      }

      if (typeof window.updateNavbarLoginBtn === 'function') {
        window.updateNavbarLoginBtn();
      }
    });


    /* ===============================
       🚪 LOGOUT
    =============================== */
    document.addEventListener('click', async (e) => {
      const logoutBtn = e.target && e.target.closest ? e.target.closest('#btn-logout') : null;
      if (logoutBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.studentLogout === 'function') {
          await window.studentLogout();
        } else {
          try {
            await signOut(auth);
            window._currentStudentUSN = null;
            localStorage.removeItem('techbook_student_logged_in');
            localStorage.removeItem('techbook_student_usn');
            localStorage.removeItem('techbook_student_data');
            if (typeof window.showLandingPage === 'function') window.showLandingPage();
            msg('login-msg', 'Logged out successfully', 'info');
          } catch (err) { console.error('Logout error:', err); }
        }
      }
    });


    /* ===============================
       🔐 CHANGE PASSWORD
    =============================== */
    $("btn-change-pass")?.addEventListener("click", async () => {
      const current = val("current-pass");
      const newPass = val("new-pass");
      const confirm = val("confirm-pass");

      if (!auth.currentUser) {
        return msg("change-pass-msg", "You must be logged in to change password", "error");
      }

      if (!current || !newPass || !confirm) {
        return msg("change-pass-msg", "Please fill all fields", "error");
      }

      try {
        if (newPass.length < 6) {
          return msg("change-pass-msg", "New password must be at least 6 characters", "error");
        }
        if (newPass !== confirm) {
          return msg("change-pass-msg", "Passwords do not match", "error");
        }

        // Reauthenticate or update password directly
        await updatePassword(auth.currentUser, newPass);

        msg("change-pass-msg", "✓ Password updated successfully!", "success");
        $("current-pass").value = "";
        $("new-pass").value = "";
        $("confirm-pass").value = "";
      } catch (e) {
        console.error("Password change error:", e);
        if (e.code === 'auth/requires-recent-login') {
          msg("change-pass-msg", "Error: Please log out and log back in to perform this sensitive action.", "error");
        } else {
          msg("change-pass-msg", "Error: " + e.message, "error");
        }
      }
    });

    /* ===============================
       👤 CHANGE USERNAME
    =============================== */
    $("btn-change-username")?.addEventListener("click", async () => {
      const newUsername = val("new-username").trim().toLowerCase();
      const password = val("change-username-pass");

      if (!auth.currentUser) {
        return msg("change-username-msg", "You must be logged in to change username", "error");
      }

      if (!newUsername || !password) {
        alert("Error: Please fill all fields (New Username and Current Password).");
        return msg("change-username-msg", "Please fill all fields", "error");
      }

      // Check if username has invalid characters
      if (!/^[a-z0-9_@.-]+$/.test(newUsername)) {
        alert("Error: Username can only contain lowercase letters, numbers, underscores, dots, hyphens, and @");
        return msg("change-username-msg", "Username can only contain lowercase letters, numbers, underscores, dots, hyphens, and @", "error");
      }

      if (newUsername === window._currentAdminUser) {
        alert("Error: New username is the same as the current username.");
        return msg("change-username-msg", "New username must be different from current username", "error");
      }

      try {
        const newEmail = `${newUsername}@techbook.ac.in`;
        
        const newAdminRef = doc(db, "admins", newUsername);
        const newAdminSnap = await getDoc(newAdminRef);

        if (newAdminSnap.exists()) {
          alert("Error: Username '" + newUsername + "' is already taken.");
          return msg("change-username-msg", "Username is already taken", "error");
        }

        const currentAdminRef = doc(db, "admins", window._currentAdminUser);
        const currentAdminSnap = await getDoc(currentAdminRef);

        if (!currentAdminSnap.exists()) {
          alert("Error: Current admin record '" + window._currentAdminUser + "' not found in database.");
          return msg("change-username-msg", "Current admin record not found", "error");
        }

        // Update email in Firebase Auth
        await updateEmail(auth.currentUser, newEmail);
        console.log("✓ Firebase Auth email updated to:", newEmail);

        // Copy old admin data to new doc path
        const oldData = currentAdminSnap.data();
        await setDoc(newAdminRef, {
          name: oldData.name || "Admin",
          role: oldData.role || "admin",
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
        if (e.code === 'auth/requires-recent-login') {
          alert("Error: Please log out and log back in to perform this sensitive action.");
          msg("change-username-msg", "Error: Please log out and log back in first.", "error");
        } else {
          alert("Database error: " + e.message);
          msg("change-username-msg", "Error: " + e.message, "error");
        }
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
        if (typeof window.ensureAdminAuth === 'function') {
          const isAuthed = await window.ensureAdminAuth();
          if (!isAuthed) {
            console.warn("loadPasswordResetRequests skipped: Admin not authenticated.");
            return;
          }
        }
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
      if (!confirm(`Approve password reset for ${usn}?`)) return;

      try {
        // 1. Get the reset request to retrieve newPasswordHash
        const reqDoc = await getDoc(doc(db, "password_reset_requests", usn));
        const reqData = reqDoc.exists() ? reqDoc.data() : {};
        const newPasswordHash = reqData.newPasswordHash;

        // 2. Update student document with approved password hash
        const studentRef = doc(db, "students", usn);
        const updateData = {
          passwordResetAt: new Date().toISOString()
        };
        if (newPasswordHash) {
          updateData.passwordHash = newPasswordHash;
        }
        await setDoc(studentRef, updateData, { merge: true });

        // 3. Mark request as approved
        const now = new Date();
        await setDoc(doc(db, "password_reset_requests", usn), {
          status: 'approved',
          approvedAt: now.toISOString()
        }, { merge: true });

        console.log("✓ Password reset approved and synced for:", usn);
        msg("reset-requests-msg", `✓ Password reset approved for ${usn}! The student can now log in with their new password.`, "success");
        loadPasswordResetRequests();
      } catch (e) {
        console.error("❌ Approve error:", e.message);
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
          let usn = user.trim().toUpperCase();
          if (usn.includes('@')) {
            usn = usn.split('@')[0].toUpperCase();
          }

          // 1. Try Firebase Auth first so the user is authenticated and authorized to query Firestore
          try {
            await signInWithEmailAndPassword(auth, `${usn.toLowerCase()}@techbook.ac.in`, pass);
            console.log('✓ Firebase Auth login successful');
          } catch (authError) {
            console.log('Firebase Auth failed:', authError.code);

            // Check if password matches approved reset password hash in Firestore
            let matchedFallback = false;
            try {
              if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
                const passHash = CryptoJS.SHA256(pass).toString();
                const tempCred = await signInAnonymously(auth);
                const sDoc = await getDoc(doc(db, 'students', usn));
                if (sDoc.exists() && (sDoc.data().passwordHash === passHash || sDoc.data().password === pass)) {
                  matchedFallback = true;
                  console.log('✓ Student verified via approved reset password hash');
                }
              }
            } catch (fallbackCheckErr) {
              console.warn('Fallback verification error:', fallbackCheckErr.message);
            }

            if (!matchedFallback) {
              if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
                throw new Error('Incorrect password');
              } else if (authError.code === 'auth/user-not-found') {
                throw new Error('This USN is not registered.');
              } else {
                throw authError;
              }
            }
          }

          // 2. Verify student record (role authorization check) with 7-second timeout
          let studentDoc = null;
          try {
            studentDoc = await Promise.race([
              getDoc(doc(db, 'students', usn)),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 7000))
            ]);
          } catch (dbErr) {
            console.warn('Firestore student fetch timed out or failed:', dbErr.message);
            await signOut(auth); // Clear auth if doc cannot be fetched
            if (dbErr.message === 'Timeout') {
              throw new Error('Connection timed out. Please check your network/internet connection.');
            } else {
              throw dbErr;
            }
          }

          if (!studentDoc.exists()) {
            await signOut(auth);
            throw new Error('This USN is not registered in the student database. Please contact admin.');
          }

          msg('unified-login-msg', 'Login successful! Redirecting...', 'success');
          window._currentStudentUSN = usn;
          if (window.loadStudentDashboard) {
            await window.loadStudentDashboard(usn);
          }
          window.selectRole('student');
          $('unified-username').value = '';
          $('unified-password').value = '';

        } else {
          // ── ADMIN / CO-FOUNDER LOGIN ──
          let inputUser = user.trim();
          let usernameLower = inputUser.toLowerCase();
          let resolvedUsername = usernameLower;
          let email = '';

          // Normalize Co-Founder username variations
          if (
            usernameLower === 'cof@techbook' ||
            usernameLower === 'cof.techbook' ||
            usernameLower === 'cof' ||
            usernameLower === 'cof.techbook@techbook.ac.in' ||
            usernameLower === 'cof@techbook.ac.in' ||
            usernameLower === 'cof@techbook.com'
          ) {
            resolvedUsername = 'cof@techbook';
            email = 'cof.techbook@techbook.ac.in';
          } else if (
            usernameLower === 'techbook.com' ||
            usernameLower === 'techbook' ||
            usernameLower === 'techbook.com@techbook.ac.in' ||
            usernameLower === 'techbook@techbook.ac.in' ||
            usernameLower === 'techbook.com@techbook.com' ||
            usernameLower === 'techbook.ac.in@gmail.com'
          ) {
            resolvedUsername = 'techbook.com';
            email = 'techbook.ac.in@gmail.com';
          } else if (usernameLower.endsWith('@techbook.ac.in')) {
            resolvedUsername = usernameLower.split('@')[0];
            email = usernameLower;
          } else if (usernameLower.includes('@')) {
            resolvedUsername = usernameLower.split('@')[0];
            email = `${resolvedUsername}@techbook.ac.in`;
          } else {
            resolvedUsername = usernameLower;
            email = `${usernameLower}@techbook.ac.in`;
          }

          const isCof = (resolvedUsername === 'cof@techbook');
          const isSuperAdmin = (resolvedUsername === 'techbook.com');

          // ── Verify admin credentials securely with the backend API ──
          let serverAuth = null;
          try {
            const resp = await fetch(`${API_BASE_URL}/api/admin-login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: usernameLower, password: pass })
            });
            const data = await resp.json();
            if (resp.ok && data.success) {
              serverAuth = data;
            } else if (resp.status === 429) {
              throw new Error(data.error || 'Too many attempts. Access blocked for 15 minutes.');
            } else if (!resp.ok) {
              throw new Error(data.error || 'Invalid admin credentials.');
            }
          } catch (apiErr) {
            throw apiErr;
          }

          let loginSuccess = false;
          const authEmail = serverAuth?.email || email;

          // Authenticate client-side Firebase Auth using the exact password entered
          try {
            const { signOut } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js");
            if (auth.currentUser && auth.currentUser.isAnonymous) {
              try { await signOut(auth); } catch (_) {}
            }
            await signInWithEmailAndPassword(auth, authEmail, pass);
            loginSuccess = true;
            console.log(`✓ Admin Firebase Auth login successful as ${authEmail}`);
          } catch (authErr) {
            console.error("Admin Firebase Auth sign-in failed:", authErr);
            throw new Error('Firebase Auth verification failed: ' + (authErr.message || 'Incorrect password.'));
          }

          if (loginSuccess) {
            const finalRole = serverAuth?.role || (isCof ? 'co_founder' : (isSuperAdmin ? 'super_admin' : 'admin'));
            const finalUser = serverAuth?.username || resolvedUsername;

            // Verify or bootstrap Firestore admin record if needed
            try {
              const adminRef = doc(db, 'admins', finalUser);
              const adminDoc = await getDoc(adminRef);
              if (!adminDoc || !adminDoc.exists()) {
                await setDoc(adminRef, {
                  name: isCof ? "Chinmay K V" : "TechBook Support",
                  role: finalRole,
                  createdAt: new Date().toISOString()
                }, { merge: true });
              }
            } catch (_) {}

            msg('unified-login-msg', 'Login successful! Redirecting...', 'success');
            window.adminLoggedIn = true;
            window._currentAdminRole = finalRole;
            window._currentAdminUser = finalUser;

            localStorage.setItem('techbook_admin_logged_in', 'true');
            localStorage.setItem('techbook_admin_user', finalUser);
            localStorage.setItem('techbook_admin_role', finalRole);

            if (window.loginAdmin) window.loginAdmin(finalUser, finalRole);
            window.selectRole(finalRole === 'co_founder' ? 'cof' : 'admin');
            
            $('unified-username').value = '';
            $('unified-password').value = '';
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

    /* ==========================================
       🔗 PERSISTENT NAV BUTTON SYNC
    ========================================== */
    function updateNavbarLoginBtn() {
      const loginBtn = document.getElementById('navbar-login-btn');
      if (!loginBtn) return;

      const isStudentLoggedIn = localStorage.getItem('techbook_student_logged_in') === 'true';
      const isAdminLoggedIn = localStorage.getItem('techbook_admin_logged_in') === 'true';

      if (isStudentLoggedIn || isAdminLoggedIn) {
        loginBtn.textContent = 'Back to Dashboard';
        loginBtn.onclick = (e) => {
          e.preventDefault();
          if (isStudentLoggedIn) {
            if (typeof window.selectRole === 'function') {
              window.selectRole('student');
            }
          } else if (isAdminLoggedIn) {
            if (typeof window.selectRole === 'function') {
              const role = localStorage.getItem('techbook_admin_role');
              window.selectRole(role === 'co_founder' ? 'cof' : 'admin');
            }
          }
        };
      } else {
        loginBtn.textContent = 'Login';
        loginBtn.onclick = (e) => {
          e.preventDefault();
          if (window.switchLandingTab) window.switchLandingTab('login-section');
        };
      }
    }
    window.updateNavbarLoginBtn = updateNavbarLoginBtn;
    setTimeout(updateNavbarLoginBtn, 100);

    /* ==========================================
       🔑 INSTANT LOCAL SESSION RESTORER
     ========================================== */
    function restoreLocalSession() {
      // 1. Check Admin Session
      const isAdmLoggedIn = localStorage.getItem('techbook_admin_logged_in') === 'true';
      if (isAdmLoggedIn) {
        const username = localStorage.getItem('techbook_admin_user');
        const role = localStorage.getItem('techbook_admin_role');
        if (username && role) {
          console.log("Restoring local Admin session:", username);
          if (typeof window.loginAdmin === 'function') {
            window.loginAdmin(username, role);
          } else {
            setTimeout(() => {
              if (typeof window.loginAdmin === 'function') window.loginAdmin(username, role);
            }, 100);
          }
          const targetRole = role === 'co_founder' ? 'cof' : 'admin';
          if (typeof window.selectRole === 'function') {
            window.selectRole(targetRole);
          } else {
            setTimeout(() => {
              if (typeof window.selectRole === 'function') window.selectRole(targetRole);
            }, 100);
          }
          if (typeof window.updateNavbarLoginBtn === 'function') {
            window.updateNavbarLoginBtn();
          }
          return;
        }
      }

      // 2. Check Student Session
      const isStudLoggedIn = localStorage.getItem('techbook_student_logged_in') === 'true';
      if (isStudLoggedIn) {
        const usn = localStorage.getItem('techbook_student_usn');
        if (usn) {
          console.log("Restoring local Student session:", usn);
          if (typeof window.loadStudentDashboard === 'function') {
            window.loadStudentDashboard(usn);
          } else {
            setTimeout(() => {
              if (typeof window.loadStudentDashboard === 'function') window.loadStudentDashboard(usn);
            }, 100);
          }
          if (typeof window.selectRole === 'function') {
            window.selectRole('student');
          } else {
            setTimeout(() => {
              if (typeof window.selectRole === 'function') window.selectRole('student');
            }, 100);
          }
          if (typeof window.updateNavbarLoginBtn === 'function') {
            window.updateNavbarLoginBtn();
          }
        }
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', restoreLocalSession);
    } else {
      restoreLocalSession();
    }
