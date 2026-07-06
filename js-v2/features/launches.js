import { db } from '../core/firebase.js';
import { doc, setDoc, getDoc, addDoc, collection, query, where, getDocs, orderBy, deleteDoc, writeBatch, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { $, API_BASE_URL } from '../core/helpers.js';

/* =========================================================
   🚀 LAUNCH CONTROL SYSTEM (CO-FOUNDER & SUPER ADMIN)
   ========================================================= */

let activeLaunchUnsub = null;
let currentEditId = null;

// Initialize Launch Subsystem
export function initLaunches() {
  console.log("Initializing Launches subsystem...");
  
  // Start real-time observer for active launch (visible to all students on homepage)
  observeActiveLaunch();

  // If we are already on an admin panel or co-founder panel, load launch lists
  const launchesTbody = $('launches-list-tbody');
  if (launchesTbody) {
    loadLaunches();
  }
}

// Observe active launch in Firestore to toggle the homepage floating banner
function observeActiveLaunch() {
  if (activeLaunchUnsub) activeLaunchUnsub();

  const q = query(collection(db, 'launches'), where('active', '==', true));
  activeLaunchUnsub = onSnapshot(q, (snapshot) => {
    const banner = $('floating-launch-banner');
    const titleEl = $('floating-launch-title');
    const linkEl = $('floating-launch-link');

    if (!banner) return;

    if (snapshot.empty) {
      banner.style.display = 'none';
    } else {
      // Get the latest active launch
      let latestLaunch = null;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        data.id = docSnap.id;
        if (!latestLaunch || data.createdAt > latestLaunch.createdAt) {
          latestLaunch = data;
        }
      });

      if (latestLaunch && latestLaunch.name && latestLaunch.url) {
        titleEl.textContent = latestLaunch.name;
        linkEl.href = latestLaunch.url;
        
        // Don't show if user dismissed it in this session
        if (sessionStorage.getItem('dismissed_launch_' + latestLaunch.id) !== 'true') {
          banner.style.display = 'block';
          // Bind the close/dismiss click specifically to store dismissal
          const closeBtn = banner.querySelector('button');
          if (closeBtn) {
            closeBtn.onclick = (e) => {
              e.preventDefault();
              sessionStorage.setItem('dismissed_launch_' + latestLaunch.id, 'true');
              banner.style.display = 'none';
            };
          }
        } else {
          banner.style.display = 'none';
        }
      } else {
        banner.style.display = 'none';
      }
    }
  }, (error) => {
    console.error("Error observing active launch:", error);
  });
}

// Load all launches for the Admin list
async function loadLaunches() {
  const tbody = $('launches-list-tbody');
  if (!tbody) return;

  try {
    const q = query(collection(db, 'launches'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 20px; color: #6b7280; font-weight: 500;">
            No features have been launched yet.
          </td>
        </tr>`;
      return;
    }

    let html = '';
    querySnapshot.forEach(docSnap => {
      const launch = docSnap.data();
      const id = docSnap.id;
      const statusBadge = launch.active 
        ? `<span style="background:#d1fae5; color:#065f46; font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px; text-transform:uppercase;">Active</span>`
        : `<span style="background:#f3f4f6; color:#374151; font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px; text-transform:uppercase;">Inactive</span>`;
      
      const toggleAction = launch.active ? 'Deactivate' : 'Activate';
      const toggleColor = launch.active ? '#d97706' : '#059669';

      html += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 10px; font-weight: 700; color: #1f2937;">${launch.name}</td>
          <td style="padding: 12px 10px; color: #4b5563; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <a href="${launch.url}" target="_blank" style="color: #3d5af1; text-decoration: none; font-weight: 600;">${launch.url}</a>
          </td>
          <td style="padding: 12px 10px;">${statusBadge}</td>
          <td style="padding: 12px 10px; text-align: right; white-space: nowrap;">
            <button onclick="window.toggleLaunchActive('${id}', ${!launch.active})" style="background: none; border: none; color: ${toggleColor}; font-weight: 700; cursor: pointer; margin-right: 12px; font-size: 12px;">
              ${toggleAction}
            </button>
            <button onclick="window.openEditLaunch('${id}')" style="background: none; border: none; color: #3d5af1; font-weight: 700; cursor: pointer; margin-right: 12px; font-size: 12px;">
              Edit
            </button>
            <button onclick="window.deleteLaunch('${id}')" style="background: none; border: none; color: #ef4444; font-weight: 700; cursor: pointer; font-size: 12px;">
              Delete
            </button>
          </td>
        </tr>`;
    });

    tbody.innerHTML = html;
  } catch (err) {
    console.error("Error loading launches:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 20px; color: #ef4444; font-weight: bold;">
          ⚠️ Error loading launches: ${err.message}
        </td>
      </tr>`;
  }
}

// Open the deploy/launch wizard modal
window.openLaunchWizard = function() {
  const wizard = $('launch-wizard-modal');
  if (wizard) {
    // Reset form elements
    const nameInput = $('wizard-launch-name');
    const urlInput = $('wizard-launch-url');
    if (nameInput) nameInput.value = '';
    if (urlInput) urlInput.value = '';

    // Reset status elements
    $('wizard-form-container').style.display = 'block';
    $('wizard-progress-container').style.display = 'none';
    
    wizard.style.display = 'flex';
  }
};

window.closeLaunchWizard = function() {
  const wizard = $('launch-wizard-modal');
  if (wizard) {
    wizard.style.display = 'none';
  }
};

// Create a new launch
window.createFeatureLaunch = async function() {
  // Can be called from Co-Founder modal or Admin panel form
  const isFromWizard = $('launch-wizard-modal') && $('launch-wizard-modal').style.display === 'flex';
  
  const nameId = isFromWizard ? 'wizard-launch-name' : 'launch-name';
  const urlId = isFromWizard ? 'wizard-launch-url' : 'launch-url';
  const msgId = isFromWizard ? 'wizard-launch-msg' : 'admin-launch-msg';

  const name = val(nameId);
  const url = val(urlId);

  if (!name || !url) {
    alert("Please enter a Launch Name and URL.");
    return;
  }

  const msgEl = $(msgId);

  if (isFromWizard) {
    // Show visual wizard timeline animation
    $('wizard-form-container').style.display = 'none';
    $('wizard-progress-container').style.display = 'block';
    updateWizardProgress(1, 'Deploying launch metadata to database...');
  } else {
    if (msgEl) msgEl.innerHTML = '<span style="color:#3d5af1; font-weight:bold;">⏳ Deploying new launch...</span>';
  }

  try {
    // 1. Deactivate other launches using a Batch
    const batch = writeBatch(db);
    const activeQuery = query(collection(db, 'launches'), where('active', '==', true));
    const activeSnapshot = await getDocs(activeQuery);
    
    activeSnapshot.forEach(docSnap => {
      batch.update(docSnap.ref, { active: false });
    });
    await batch.commit();

    if (isFromWizard) {
      updateWizardProgress(2, 'Broadcasting announcement notifications to verified students...');
    }

    // 2. Add the new launch doc
    const newLaunchRef = await addDoc(collection(db, 'launches'), {
      name,
      url,
      active: true,
      createdAt: new Date().toISOString()
    });

    // 3. Trigger email notifications via Server endpoint
    const response = await fetch(`${API_BASE_URL}/api/launch-feature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ launchName: name, launchUrl: url })
    });
    const result = await response.json();

    if (isFromWizard) {
      updateWizardProgress(3, `Successfully notified verified students!`);
      setTimeout(() => {
        window.closeLaunchWizard();
        loadLaunches();
      }, 2500);
    } else {
      if (msgEl) {
        msgEl.innerHTML = `<span style="color:#10b981; font-weight:bold;">🚀 Launched successfully! Notified ${result.sentCount || 0} student(s).</span>`;
        // Clear inputs
        $(nameId).value = '';
        $(urlId).value = '';
        setTimeout(() => { msgEl.innerHTML = ''; }, 5000);
      }
      loadLaunches();
    }
  } catch (err) {
    console.error("Feature deployment failed:", err);
    if (isFromWizard) {
      $('wizard-progress-text').innerHTML = `<span style="color:#ef4444; font-weight:bold;">❌ Deployment Failed: ${err.message}</span>`;
      $('wizard-bar-fill').style.background = '#ef4444';
    } else {
      if (msgEl) msgEl.innerHTML = `<span style="color:#ef4444; font-weight:bold;">❌ Failed: ${err.message}</span>`;
    }
  }
};

function updateWizardProgress(step, text) {
  const bar = $('wizard-bar-fill');
  const txt = $('wizard-progress-text');
  
  if (step === 1) {
    if (bar) bar.style.width = '33%';
    if (txt) txt.textContent = text;
  } else if (step === 2) {
    if (bar) bar.style.width = '66%';
    if (txt) txt.textContent = text;
  } else if (step === 3) {
    if (bar) {
      bar.style.width = '100%';
      bar.style.background = 'linear-gradient(90deg, #10b981, #059669)';
    }
    if (txt) txt.innerHTML = `🌟 <strong>Done!</strong> ${text}`;
  }
}

// Toggle launch status between active/inactive
window.toggleLaunchActive = async function(id, newStatus) {
  try {
    if (newStatus === true) {
      // Deactivate all other launches first
      const batch = writeBatch(db);
      const activeQuery = query(collection(db, 'launches'), where('active', '==', true));
      const activeSnapshot = await getDocs(activeQuery);
      activeSnapshot.forEach(docSnap => {
        batch.update(docSnap.ref, { active: false });
      });
      await batch.commit();
    }

    await updateDoc(doc(db, 'launches', id), { active: newStatus });
    loadLaunches();
  } catch (err) {
    console.error("Error toggling launch status:", err);
    alert("Failed to toggle status: " + err.message);
  }
};

// Open the edit launch modal
window.openEditLaunch = async function(id) {
  const modal = $('edit-launch-modal');
  if (!modal) return;

  try {
    const docSnap = await getDoc(doc(db, 'launches', id));
    if (docSnap.exists()) {
      const data = docSnap.data();
      currentEditId = id;
      $('edit-launch-name').value = data.name || '';
      $('edit-launch-url').value = data.url || '';
      $('edit-launch-active').checked = data.active || false;
      
      modal.style.display = 'flex';
    }
  } catch (err) {
    console.error("Error loading launch details for editing:", err);
    alert("Failed to fetch launch details.");
  }
};

window.closeEditLaunch = function() {
  const modal = $('edit-launch-modal');
  if (modal) {
    modal.style.display = 'none';
  }
};

window.saveLaunchEdit = async function() {
  if (!currentEditId) return;

  const name = val('edit-launch-name');
  const url = val('edit-launch-url');
  const active = $('edit-launch-active').checked;

  if (!name || !url) {
    alert("Please enter Name and URL.");
    return;
  }

  try {
    if (active === true) {
      // Deactivate all other launches first
      const batch = writeBatch(db);
      const activeQuery = query(collection(db, 'launches'), where('active', '==', true));
      const activeSnapshot = await getDocs(activeQuery);
      activeSnapshot.forEach(docSnap => {
        if (docSnap.id !== currentEditId) {
          batch.update(docSnap.ref, { active: false });
        }
      });
      await batch.commit();
    }

    await updateDoc(doc(db, 'launches', currentEditId), {
      name,
      url,
      active
    });

    window.closeEditLaunch();
    loadLaunches();
  } catch (err) {
    console.error("Error updating launch:", err);
    alert("Failed to save changes: " + err.message);
  }
};

// Delete a launch
window.deleteLaunch = async function(id) {
  if (!confirm("Are you sure you want to delete this launch record? This cannot be undone.")) return;

  try {
    await deleteDoc(doc(db, 'launches', id));
    loadLaunches();
  } catch (err) {
    console.error("Error deleting launch record:", err);
    alert("Failed to delete record: " + err.message);
  }
};

// Re-expose loadLaunches globally
window.loadLaunches = loadLaunches;
