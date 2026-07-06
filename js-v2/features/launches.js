import { db } from '../core/firebase.js';
import { doc, setDoc, getDoc, addDoc, collection, query, where, getDocs, orderBy, deleteDoc, writeBatch, serverTimestamp, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { $, val, API_BASE_URL } from '../core/helpers.js';

/* =========================================================
   🚀 FEATURE LAUNCHES SYSTEM (ADMIN & LANDING PAGE)
   ========================================================= */

let editLaunchId = null; // Track document ID when in edit mode

// Create or update a feature launch
window.adminSaveLaunch = async function() {
  const nameInput = document.getElementById('launch-name');
  const urlInput = document.getElementById('launch-url');
  const scheduleInput = document.getElementById('launch-schedule');
  const activeInput = document.getElementById('launch-active');
  const msgEl = document.getElementById('admin-launch-msg');
  const btn = document.getElementById('btn-save-launch');

  if (!nameInput || !urlInput) return;

  const name = nameInput.value.trim();
  const url = urlInput.value.trim();
  const scheduleVal = scheduleInput ? scheduleInput.value : '';
  const isActive = activeInput ? activeInput.checked : true;

  if (!name || !url) {
    if (msgEl) msgEl.innerHTML = '<span style="color:#ef4444;">Please provide both a Launch Name and a Launch URL.</span>';
    return;
  }

  btn.disabled = true;
  const originalBtnText = btn.textContent;
  btn.textContent = 'Saving...';

  try {
    const launchData = {
      name: name,
      url: url,
      scheduledAt: scheduleVal ? new Date(scheduleVal).getTime() : null,
      active: isActive,
      updatedAt: serverTimestamp()
    };

    // If active, deactivate other launches to maintain a single active launch
    if (isActive) {
      const q = query(collection(db, 'launches'), where('active', '==', true));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach(docSnap => {
        if (docSnap.id !== editLaunchId) {
          batch.update(docSnap.ref, { active: false });
        }
      });
      await batch.commit();
    }

    if (editLaunchId) {
      // Modify mode
      await updateDoc(doc(db, 'launches', editLaunchId), launchData);
      if (msgEl) msgEl.innerHTML = '<span style="color:#10b981;">✅ Feature launch updated successfully!</span>';
      window.adminCancelEditLaunch();
    } else {
      // Create mode
      launchData.createdAt = serverTimestamp();
      const docRef = await addDoc(collection(db, 'launches'), launchData);
      if (msgEl) msgEl.innerHTML = '<span style="color:#10b981;">✅ Feature launched successfully!</span>';

      // Send email notifications to all verified students if active and scheduled within the next 24 hours
      const shouldNotify = isActive && (!launchData.scheduledAt || (launchData.scheduledAt - Date.now()) < 86400000);
      if (shouldNotify) {
        if (msgEl) msgEl.innerHTML += '<br><span style="color:#6366f1;">📨 Sending notification emails to all verified students...</span>';
        
        fetch(`${API_BASE_URL || 'https://tech-book-two.vercel.app'}/api/notify-launch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            launchName: name,
            launchUrl: url
          })
        }).then(r => r.json()).then(res => {
          console.log('Launch email notifications sent:', res);
          if (msgEl) {
            const statusText = res.success ? `✅ Notifications sent to ${res.sentCount} students.` : `❌ Email failed: ${res.error}`;
            msgEl.innerHTML = `<span style="color:#10b981;">✅ Feature launched successfully!</span><br><span style="color:#0284c7;font-weight:600;">${statusText}</span>`;
          }
        }).catch(err => {
          console.error('Launch email notify error:', err);
          if (msgEl) msgEl.innerHTML += `<br><span style="color:#ef4444;">❌ Notification API error.</span>`;
        });
      } else {
        if (msgEl) msgEl.innerHTML += `<br><span style="color:#f59e0b;">⏰ Scheduled to activate on ${new Date(launchData.scheduledAt).toLocaleString()}. Emails will not be sent immediately.</span>`;
      }

      // Reset form
      nameInput.value = '';
      urlInput.value = '';
      if (scheduleInput) scheduleInput.value = '';
      if (activeInput) activeInput.checked = true;
    }

    loadAdminLaunches();
  } catch (err) {
    console.error("Save launch error:", err);
    if (msgEl) msgEl.innerHTML = `<span style="color:#ef4444;">❌ Failed to save launch: ${err.message}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = originalBtnText;
  }
};

// Populate form to edit launch
window.adminEditLaunch = function(id, name, url, scheduledAt, active) {
  const nameInput = document.getElementById('launch-name');
  const urlInput = document.getElementById('launch-url');
  const scheduleInput = document.getElementById('launch-schedule');
  const activeInput = document.getElementById('launch-active');
  const titleEl = document.getElementById('launch-form-title');
  const btn = document.getElementById('btn-save-launch');
  const cancelBtn = document.getElementById('btn-cancel-launch-edit');

  if (!nameInput || !urlInput) return;

  editLaunchId = id;
  nameInput.value = name;
  urlInput.value = url;
  
  if (scheduleInput && scheduledAt) {
    // Convert timestamp to local datetime-local format YYYY-MM-DDTHH:MM
    const dateObj = new Date(parseInt(scheduledAt));
    const tzOffset = dateObj.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(dateObj - tzOffset)).toISOString().slice(0, 16);
    scheduleInput.value = localISOTime;
  } else if (scheduleInput) {
    scheduleInput.value = '';
  }

  if (activeInput) {
    activeInput.checked = active === 'true' || active === true;
  }

  if (titleEl) titleEl.innerHTML = '✏️ Modify Feature Launch';
  if (btn) btn.textContent = '💾 Update Launch';
  if (cancelBtn) cancelBtn.style.display = 'inline-block';
};

// Revert form back to create mode
window.adminCancelEditLaunch = function() {
  editLaunchId = null;
  const nameInput = document.getElementById('launch-name');
  const urlInput = document.getElementById('launch-url');
  const scheduleInput = document.getElementById('launch-schedule');
  const activeInput = document.getElementById('launch-active');
  const titleEl = document.getElementById('launch-form-title');
  const btn = document.getElementById('btn-save-launch');
  const cancelBtn = document.getElementById('btn-cancel-launch-edit');

  if (nameInput) nameInput.value = '';
  if (urlInput) urlInput.value = '';
  if (scheduleInput) scheduleInput.value = '';
  if (activeInput) activeInput.checked = true;

  if (titleEl) titleEl.innerHTML = '🚀 Launch New Feature';
  if (btn) btn.textContent = '🚀 Launch & Notify';
  if (cancelBtn) cancelBtn.style.display = 'none';
};

// Delete a launch
window.adminDeleteLaunch = async function(id) {
  if (!confirm("Are you sure you want to delete this feature launch?")) return;

  try {
    await deleteDoc(doc(db, 'launches', id));
    loadAdminLaunches();
  } catch (err) {
    console.error("Delete launch error:", err);
    alert("Failed to delete launch: " + err.message);
  }
};

// Load list of launches for admin view
window.loadAdminLaunches = async function() {
  const container = document.getElementById('launches-list-container');
  if (!container) return;

  container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-secondary);">⏳ Loading launches...</p>';

  try {
    const q = query(collection(db, 'launches'), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-secondary);font-size:13px;">No launches registered yet.</p>';
      return;
    }

    let html = '';
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const id = docSnap.id;
      const createdStr = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : 'N/A';
      
      const activeBadge = data.active 
        ? `<span style="background:rgba(16,185,129,0.1);color:#10b981;font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px;">Active</span>`
        : `<span style="background:rgba(107,114,128,0.1);color:#6b7280;font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px;">Inactive</span>`;

      const scheduleText = data.scheduledAt
        ? `<span style="color:#d97706;font-size:11px;font-weight:600;">⏰ Activation: ${new Date(data.scheduledAt).toLocaleString()}</span>`
        : `<span style="color:#10b981;font-size:11px;font-weight:600;">✓ Immediate Activation</span>`;

      // Escaping helper values for safety in onclick arguments
      const escName = (data.name || '').replace(/'/g, "\\'");
      const escUrl = (data.url || '').replace(/'/g, "\\'");
      const schedVal = data.scheduledAt ? String(data.scheduledAt) : '';

      html += `
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:16px;padding:16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;flex-direction:column;gap:4px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <h4 style="margin:0;font-size:15px;font-weight:800;color:#0f172a;">🚀 ${data.name}</h4>
              ${activeBadge}
            </div>
            <a href="${data.url}" target="_blank" style="color:#3d5af1;font-size:12px;font-weight:600;text-decoration:none;word-break:break-all;">🔗 ${data.url}</a>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:2px;">
              <span style="color:#6b7280;font-size:11px;">Created: ${createdStr}</span>
              ${scheduleText}
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button onclick="window.adminEditLaunch('${id}', '${escName}', '${escUrl}', '${schedVal}', ${data.active})" 
              style="padding:6px 12px;background:#ffffff;border:1px solid #d1d5db;border-radius:8px;color:#4b5563;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;">
              ✏️ Edit
            </button>
            <button onclick="window.adminDeleteLaunch('${id}')" 
              style="padding:6px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#ef4444;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;">
              🗑️ Delete
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (err) {
    console.error("Load launches error:", err);
    container.innerHTML = `<p style="text-align:center;padding:20px;color:#ef4444;font-size:13px;">Failed to load launches: ${err.message}</p>`;
  }
};

// Setup landing page real-time listener for the active launch floating banner
window.updateFloatingBannerVisibility = function() {
  const banner = document.getElementById('landing-floating-download');
  if (!banner) return;

  const landingPage = document.getElementById('landing-page');
  const homeSection = document.getElementById('home');
  const hasActiveLaunch = !banner.classList.contains('no-active-launch');

  const isLandingVisible = landingPage && !landingPage.classList.contains('hidden');
  const isHomeTabVisible = homeSection && !homeSection.classList.contains('hidden');

  if (isLandingVisible && isHomeTabVisible && hasActiveLaunch) {
    banner.style.display = 'block';
    banner.classList.remove('hidden');
  } else {
    banner.style.display = 'none';
  }
};

let _launchTimerId = null;

window.initLaunchListener = function() {
  const floatingCard = document.getElementById('landing-floating-download');
  if (!floatingCard) return;

  // Listen to any changes in launches
  const q = query(collection(db, 'launches'), where('active', '==', true));
  onSnapshot(q, (snap) => {
    if (_launchTimerId) {
      clearTimeout(_launchTimerId);
      _launchTimerId = null;
    }

    let activeLaunch = null;
    let nextScheduledLaunch = null;
    const now = Date.now();

    snap.forEach(docSnap => {
      const data = docSnap.data();
      // Verify if scheduled time has passed
      if (!data.scheduledAt || data.scheduledAt <= now) {
        activeLaunch = { id: docSnap.id, ...data };
      } else {
        nextScheduledLaunch = { id: docSnap.id, ...data };
      }
    });

    if (activeLaunch) {
      // Configure and show floating button
      const titleEl = document.getElementById('floating-download-title');
      const linkEl = document.getElementById('floating-download-link');
      
      if (titleEl) titleEl.textContent = activeLaunch.name;
      if (linkEl) {
        linkEl.href = activeLaunch.url;
        linkEl.onclick = () => {
          window.open(activeLaunch.url, '_blank');
          return false;
        };
      }
      
      floatingCard.classList.remove('no-active-launch');
    } else {
      floatingCard.classList.add('no-active-launch');
      
      // If there is a scheduled launch in the future, set a timer to activate it
      if (nextScheduledLaunch) {
        const delay = nextScheduledLaunch.scheduledAt - Date.now();
        if (delay > 0) {
          console.log(`⏱️ Setting client-side activation timer for scheduled launch in ${delay} ms`);
          _launchTimerId = setTimeout(() => {
            console.log("⏰ Scheduled launch activation time reached. Refreshing banner state.");
            window.initLaunchListener();
          }, delay + 1000); // add a tiny buffer
        }
      }
    }
    window.updateFloatingBannerVisibility();
  }, (err) => {
    console.warn("Real-time launch listener disabled or failed:", err);
  });
};

// Automatically boot up listener if we are on the landing page
document.addEventListener('DOMContentLoaded', () => {
  window.initLaunchListener();
});
// Execute it immediately as well since module script might load after DOMContentLoaded
setTimeout(() => {
  window.initLaunchListener();
}, 1000);
