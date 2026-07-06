// TechBook App — Core Entry Point & Module Coordinator

// Config & Utilities
import './core/firebase.js';
import './core/helpers.js';
import './core/activity_tracker.js?v=20260706a';

// Features & Components
import './features/auth.js';
import './features/promos.js?v=20260706a';
import './features/attendance.js?v=20260706a';
import './features/notes.js';
import './features/qbank.js';
import './features/pyq.js';
import './features/quiz.js';
import './features/chatbot.js';
import './features/manage_students.js';


console.log('🚀 TechBook App fully initialized');

// ─── LANDING PAGE ROLE ROUTING & NAVIGATION ───

function initNavigation() {
  // Bind role buttons on the landing page
  const roleButtons = document.querySelectorAll('.role-button');
  roleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const role = btn.getAttribute('data-role');
      if (role) {
        selectRole(role);
      }
    });
  });

  // Bind Home button in navbar
  const homeBtn = document.getElementById('btn-home');
  if (homeBtn) {
    homeBtn.addEventListener('click', showLandingPage);
  }

  // Mobile Menu Toggling
  const mobileToggle = document.getElementById('mobile-toggle');
  const navbarMenu = document.getElementById('navbar-menu');
  if (mobileToggle && navbarMenu) {
    mobileToggle.addEventListener('click', () => {
      mobileToggle.classList.toggle('active');
      navbarMenu.classList.toggle('open');
    });
  }

  // Close mobile menu when links or buttons are clicked
  const navItems = document.querySelectorAll('.navbar-link, .navbar-btn');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (mobileToggle) mobileToggle.classList.remove('active');
      if (navbarMenu) navbarMenu.classList.remove('open');
    });
  });
}

// Select Role function
function selectRole(role) {
  // Hide landing page
  const landing = document.getElementById('landing-page');
  if (landing) landing.classList.add('hidden');

  // Show main panel
  const mainPanel = document.getElementById('main-panel');
  if (mainPanel) mainPanel.classList.remove('hidden');

  // Hide all views first
  const views = ['student-view', 'admin-view', 'about-view'];
  views.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.add('hidden');
  });

  // Show selected view
  const activeView = document.getElementById(`${role}-view`);
  if (activeView) activeView.classList.remove('hidden');

  // Update navbar role label
  const label = document.getElementById('navbar-role-label');
  if (label) {
    if (role === 'student') label.textContent = 'Student Portal';
    else if (role === 'admin') label.textContent = 'Admin Portal';
    else if (role === 'about') label.textContent = 'About TechBook';
  }

  if (typeof window.trackUserActivity === 'function') {
    let actDesc = 'Viewing Landing Page';
    if (role === 'student') {
      actDesc = window._currentStudentUSN ? 'Viewing Student Portal' : 'Viewing Student Login';
    } else if (role === 'admin') {
      actDesc = window.adminLoggedIn ? 'Viewing Admin Dashboard' : 'Viewing Admin Login';
    } else if (role === 'about') {
      actDesc = 'Viewing About Page';
    }
    window.trackUserActivity(actDesc, false);
  }

  // Handle specific transitions
  if (role === 'student') {
    const isStudLoggedIn = localStorage.getItem('techbook_student_logged_in') === 'true';
    if (isStudLoggedIn) {
      document.getElementById('student-auth')?.classList.add('hidden');
      document.getElementById('student-area')?.classList.remove('hidden');
    } else {
      document.getElementById('student-auth')?.classList.remove('hidden');
      document.getElementById('student-area')?.classList.add('hidden');
      
      if (window.location.hash.startsWith('#student')) {
        showLandingPage();
        setTimeout(() => {
          document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' });
          if (typeof window.selectLoginRole === 'function') {
            window.selectLoginRole('student');
          }
        }, 100);
      }
    }
  } else if (role === 'admin') {
    const isAdmLoggedIn = localStorage.getItem('techbook_admin_logged_in') === 'true';
    if (isAdmLoggedIn) {
      document.getElementById('admin-login-block')?.classList.add('hidden');
      document.getElementById('admin-area')?.classList.remove('hidden');
    } else {
      document.getElementById('admin-login-block')?.classList.remove('hidden');
      document.getElementById('admin-area')?.classList.add('hidden');

      if (window.location.hash.startsWith('#admin')) {
        showLandingPage();
        setTimeout(() => {
          document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' });
          if (typeof window.selectLoginRole === 'function') {
            window.selectLoginRole('admin');
          }
        }, 100);
      }
    }
  }

  // Update navbar actions (Logout button) dynamically based on role and login state
  const navbarActions = document.getElementById('navbar-actions');
  if (navbarActions) {
    if (role === 'student' && window._currentStudentUSN) {
      navbarActions.innerHTML = `
        <button id="btn-logout" onclick="window.studentLogout && window.studentLogout()"
          style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:#f9fafb;border:1px solid rgba(57,255,180,0.25);border-radius:10px;color:#3d5af1;font-weight:700;font-size:13px;cursor:pointer;transition:all 0.2s;"
          onmouseover="this.style.background='#eef0ff';this.style.transform='translateY(-1px)'"
          onmouseout="this.style.background='#f9fafb';this.style.transform=''">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3d5af1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout
        </button>
      `;
    } else if (role === 'admin' && window.adminLoggedIn) {
      navbarActions.innerHTML = `
        <button onclick="window.adminLogout && window.adminLogout()" 
          style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:#f9fafb;border:1px solid rgba(57,255,180,0.25);border-radius:10px;color:#3d5af1;font-weight:700;font-size:13px;cursor:pointer;transition:all 0.2s;"
          onmouseover="this.style.background='#eef0ff';this.style.transform='translateY(-1px)'"
          onmouseout="this.style.background='#f9fafb';this.style.transform=''">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3d5af1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout
        </button>
      `;
    } else {
      navbarActions.innerHTML = '';
    }
  }

  if (!window._historyNavLock) {
    window.history.pushState({ role: role, tab: null, section: null }, '', '#' + role);
  }
}

// Show Landing Page function
function showLandingPage() {
  // Hide main panel
  const mainPanel = document.getElementById('main-panel');
  if (mainPanel) mainPanel.classList.add('hidden');

  // Show landing page
  const landing = document.getElementById('landing-page');
  if (landing) landing.classList.remove('hidden');

  // Set default tab to 'home'
  if (window.switchLandingTab) {
    window.switchLandingTab('home');
  }

  if (!window._historyNavLock) {
    window.history.pushState({ role: 'landing' }, '', '#');
  }
}

// Global History & Routing System
window._historyNavLock = false;

window.addEventListener('popstate', (event) => {
  // Always close open developer modal on back navigation
  var devModal = document.getElementById('founder-modal');
  if (devModal && devModal.style.display === 'flex') {
    devModal.style.display = 'none';
  }

  const state = event.state;
  if (!state) return;

  window._historyNavLock = true;

  if (state.role === 'landing') {
    showLandingPage();
  } else if (state.role === 'student') {
    selectRole('student');
    if (typeof window.switchStudentTab === 'function') {
      window._studentHistoryNavLock = true;
      window.switchStudentTab(state.tab || null);
      window._studentHistoryNavLock = false;
    }
  } else if (state.role === 'admin') {
    selectRole('admin');
    if (typeof window.switchAdminSection === 'function') {
      window._adminHistoryNavLock = true;
      window.switchAdminSection(state.section || null);
      window._adminHistoryNavLock = false;
    }
  } else if (state.role === 'about') {
    selectRole('about');
  }

  window._historyNavLock = false;
});

function handleInitialRoute() {
  const hash = window.location.hash;
  if (hash.startsWith('#student')) {
    const parts = hash.split('-');
    const tab = parts[1] || null;

    window._historyNavLock = true;
    selectRole('student');
    window._historyNavLock = false;

    window.history.replaceState({ role: 'student', tab: null }, '', '#student');

    if (tab && typeof window.switchStudentTab === 'function') {
      window.history.pushState({ role: 'student', tab: tab }, '', '#student-' + tab);
      window._studentHistoryNavLock = true;
      window.switchStudentTab(tab);
      window._studentHistoryNavLock = false;
    }
  } else if (hash.startsWith('#admin')) {
    const parts = hash.split('-');
    const section = parts[1] || null;

    window._historyNavLock = true;
    selectRole('admin');
    window._historyNavLock = false;

    window.history.replaceState({ role: 'admin', section: null }, '', '#admin');

    if (section && typeof window.switchAdminSection === 'function') {
      const sectionId = 'sec-' + section;
      window.history.pushState({ role: 'admin', section: sectionId }, '', '#admin-' + section);
      window._adminHistoryNavLock = true;
      window.switchAdminSection(sectionId);
      window._adminHistoryNavLock = false;

      // Automatically trigger load on direct refresh/access of user details section
      if (sectionId === 'sec-users-list') {
        setTimeout(() => {
          const btn = document.getElementById("btn-load-users");
          if (btn) btn.click();
        }, 150);
      }
    }

  } else if (hash === '#about') {
    window._historyNavLock = true;
    selectRole('about');
    window._historyNavLock = false;
  } else if (hash === '#developer') {
    window._historyNavLock = true;
    showLandingPage();
    window._historyNavLock = false;

    window.history.replaceState({ role: 'landing' }, '', window.location.pathname);
    window.history.pushState({ role: 'landing', modal: 'founder' }, '', '#developer');

    var modal = document.getElementById('founder-modal');
    if (modal) modal.style.display = 'flex';
  } else {
    window.history.replaceState({ role: 'landing' }, '', window.location.pathname);
  }
}

// Run immediately since DOM is parsed when module script runs
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    handleInitialRoute();
    if (typeof window._initStudentManagement === 'function') window._initStudentManagement();
  });
} else {
  initNavigation();
  handleInitialRoute();
  if (typeof window._initStudentManagement === 'function') window._initStudentManagement();
}

// Bind to window so that inline HTML handlers or other modules can call them
window.selectRole = selectRole;
window.showLandingPage = showLandingPage;
window._showLanding = showLandingPage;

function switchLandingTab(tabId) {
  const sections = ['home', 'features-section', 'login-section', 'about-section'];
  sections.forEach(s => {
    const el = document.getElementById(s);
    if (el) {
      if (s === tabId) {
        el.classList.remove('hidden');
        el.style.display = ''; // fallback
      } else {
        el.classList.add('hidden');
      }
    }
  });

  // Update active state in nav bar links
  const linksMap = {
    'home': 'nav-link-home',
    'features-section': 'nav-link-features',
    'about-section': 'nav-link-about',
    'login-section': 'navbar-login-btn'
  };

  Object.keys(linksMap).forEach(key => {
    const el = document.getElementById(linksMap[key]);
    if (el) {
      if (key === tabId) {
        el.classList.add('active-nav-link');
      } else {
        el.classList.remove('active-nav-link');
      }
    }
  });
}
window.switchLandingTab = switchLandingTab;


