/**
 * TechBook Mobile Navigation & PWA Handler
 * ========================================
 * Implements bottom navigation menus, bottom sheets, top subtab toggles,
 * and service worker initialization for native mobile experience.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ─── 1. Register Service Worker for PWA ───
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('✅ PWA Service Worker Registered', reg.scope))
      .catch(err => console.error('❌ Service Worker Registration Failed', err));
  }

  // ─── 2. Initialize Layout & Observers ───
  initMobileLayout();
});

function initMobileLayout() {
  // Observe student-area, admin-area, and landing-page class lists to detect layout changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        updateMobileNavVisibility();
      }
    });
  });

  const studentArea = document.getElementById('student-area');
  const adminArea = document.getElementById('admin-area');
  const landingPage = document.getElementById('landing-page');

  if (studentArea) observer.observe(studentArea, { attributes: true });
  if (adminArea) observer.observe(adminArea, { attributes: true });
  if (landingPage) observer.observe(landingPage, { attributes: true });

  // Run initial visibility check
  updateMobileNavVisibility();

  // ─── 3. Intercept Switch Tab Functions for Syncing Bottom Nav ───
  wrapTabSwitchers();
}

function updateMobileNavVisibility() {
  const landingPage = document.getElementById('landing-page');
  const studentArea = document.getElementById('student-area');
  const adminArea = document.getElementById('admin-area');
  
  const studentNav = document.getElementById('student-mobile-nav');
  const adminNav = document.getElementById('admin-mobile-nav');
  
  const isLandingPageActive = landingPage && !landingPage.classList.contains('hidden');
  
  // They are only in active dashboard app view if the landing page is hidden AND they are logged in
  const isStudentLoggedIn = !isLandingPageActive && studentArea && !studentArea.classList.contains('hidden');
  const isAdminLoggedIn = !isLandingPageActive && adminArea && !adminArea.classList.contains('hidden');

  if (isStudentLoggedIn || isAdminLoggedIn) {
    document.body.classList.add('mobile-app-mode');
  } else {
    document.body.classList.remove('mobile-app-mode');
  }
  
  if (isStudentLoggedIn) {
    if (studentNav) studentNav.classList.remove('hidden');
    if (adminNav) adminNav.classList.add('hidden');
    syncMobileNavActiveState('home');
  } else if (isAdminLoggedIn) {
    if (adminNav) adminNav.classList.remove('hidden');
    if (studentNav) studentNav.classList.add('hidden');
    syncAdminMobileNavActiveState('stats');
  } else {
    if (studentNav) studentNav.classList.add('hidden');
    if (adminNav) adminNav.classList.add('hidden');
  }
}

// ─── 4. Student Navigation Handler ───
window.handleMobileNavClick = function(tabName, element) {
  if (tabName === 'more') {
    openMobileMoreSheet();
    return;
  }
  
  closeMobileMoreSheet();

  let features = {};
  try {
    const cached = localStorage.getItem('techbook_features');
    if (cached) features = JSON.parse(cached);
  } catch (_) {}

  // Map tabs to switchStudentTab args with feature toggle checking
  if (tabName === 'home') {
    if (typeof window.switchStudentTab === 'function') window.switchStudentTab(null);
  } else if (tabName === 'attendance') {
    if (features.attendanceEnabled === false) {
      alert('🛡️ Access Restricted: Attendance is currently disabled by administrator.');
      return;
    }
    if (typeof window.switchStudentTab === 'function') window.switchStudentTab('attendance');
  } else if (tabName === 'quiz') {
    if (features.quizEnabled === false) {
      alert('🛡️ Access Restricted: Quizzes are currently disabled by administrator.');
      return;
    }
    if (typeof window.switchStudentTab === 'function') window.switchStudentTab('quiz');
  } else if (tabName === 'academics') {
    // Determine the first available enabled academic tab
    let target = null;
    if (features.notesEnabled !== false) target = 'notes';
    else if (features.qbankEnabled !== false) target = 'qbank';
    else if (features.pyqEnabled !== false) target = 'pyq';

    if (!target) {
      alert('🛡️ Access Restricted: Study Library features are currently disabled by administrator.');
      return;
    }
    if (typeof window.switchStudentTab === 'function') window.switchStudentTab(target);
  }
  
  syncMobileNavActiveState(tabName);
};

function syncMobileNavActiveState(tabName) {
  document.querySelectorAll('#student-mobile-nav .mobile-nav-item').forEach(el => {
    el.classList.remove('active');
  });
  
  // Find matching nav button
  let targetSelector = `#student-mobile-nav button[onclick*="'${tabName}'"]`;
  const btn = document.querySelector(targetSelector);
  if (btn) btn.classList.add('active');
}

// ─── 5. Admin Navigation Handler ───
window.handleAdminMobileNavClick = function(tabName, element) {
  if (tabName === 'more') {
    openAdminMoreSheet();
    return;
  }

  closeAdminMoreSheet();

  if (tabName === 'stats') {
    if (typeof window.switchAdminSection === 'function') window.switchAdminSection('sec-stats');
  } else if (tabName === 'code') {
    if (typeof window.switchAdminSection === 'function') window.switchAdminSection('sec-code');
  } else if (tabName === 'manual') {
    if (typeof window.switchAdminSection === 'function') window.switchAdminSection('sec-manual');
  } else if (tabName === 'promos') {
    if (typeof window.switchAdminSection === 'function') window.switchAdminSection('sec-promos');
  }

  syncAdminMobileNavActiveState(tabName);
};

function syncAdminMobileNavActiveState(tabName) {
  document.querySelectorAll('#admin-mobile-nav .mobile-nav-item').forEach(el => {
    el.classList.remove('active');
  });
  
  let targetSelector = `#admin-mobile-nav button[onclick*="'${tabName}'"]`;
  const btn = document.querySelector(targetSelector);
  if (btn) btn.classList.add('active');
}

// ─── 6. Subtab Switcher for Library/Academics (Notes/QBank/PYQ) ───
window.handleMobileSubtabClick = function(subtabName, element) {
  let features = {};
  try {
    const cached = localStorage.getItem('techbook_features');
    if (cached) features = JSON.parse(cached);
  } catch (_) {}

  const tabFeatureKey = {
    'notes': 'notesEnabled',
    'qbank': 'qbankEnabled',
    'pyq': 'pyqEnabled'
  };

  const fKey = tabFeatureKey[subtabName];
  if (fKey && features[fKey] === false) {
    alert('🛡️ Access Restricted: This feature is currently disabled by administrator.');
    return;
  }

  document.querySelectorAll('.mobile-subtab-btn').forEach(btn => btn.classList.remove('active'));
  if (element) element.classList.add('active');
  
  // Simultaneously trigger student subtab changes
  if (typeof window.switchStudentTab === 'function') {
    window.switchStudentTab(subtabName);
  }
};

// ─── 7. Intercept Desktop Actions and Sync State to Mobile ───
function wrapTabSwitchers() {
  // Wrap student switcher
  if (window._switchTab) {
    const originalSwitchTab = window._switchTab;
    window._switchTab = window.switchStudentTab = function(tab) {
      originalSwitchTab(tab);
      handleStudentTabStateChange(tab);
    };
  } else {
    // Intercept when it gets defined
    let originalVal = undefined;
    Object.defineProperty(window, '_switchTab', {
      configurable: true,
      enumerable: true,
      get() {
        return originalVal;
      },
      set(val) {
        originalVal = function(tab) {
          val(tab);
          handleStudentTabStateChange(tab);
        };
        window.switchStudentTab = originalVal;
      }
    });
  }

  // Wrap admin switcher
  if (window.switchAdminSection) {
    const originalSwitchAdmin = window.switchAdminSection;
    window.switchAdminSection = function(sectionId) {
      originalSwitchAdmin(sectionId);
      handleAdminSectionStateChange(sectionId);
    };
  } else {
    let originalVal = undefined;
    Object.defineProperty(window, 'switchAdminSection', {
      configurable: true,
      enumerable: true,
      get() {
        return originalVal;
      },
      set(val) {
        originalVal = function(sectionId) {
          val(sectionId);
          handleAdminSectionStateChange(sectionId);
        };
      }
    });
  }
}

function handleStudentTabStateChange(tab) {
  const subtabs = document.getElementById('mobile-academics-tabs');
  
  if (!tab) {
    syncMobileNavActiveState('home');
    if (subtabs) subtabs.classList.add('hidden');
  } else if (tab === 'attendance') {
    syncMobileNavActiveState('attendance');
    if (subtabs) subtabs.classList.add('hidden');
  } else if (tab === 'quiz') {
    syncMobileNavActiveState('quiz');
    if (subtabs) subtabs.classList.add('hidden');
  } else if (['notes', 'qbank', 'pyq'].includes(tab)) {
    syncMobileNavActiveState('academics');
    if (subtabs) subtabs.classList.remove('hidden');
    
    // Highlight correct subtab pill
    document.querySelectorAll('.mobile-subtab-btn').forEach(btn => {
      const btnTab = btn.getAttribute('data-subtab');
      if (btnTab === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  } else {
    //timetables, history etc
    if (subtabs) subtabs.classList.add('hidden');
  }
}

function handleAdminSectionStateChange(sectionId) {
  if (!sectionId) {
    syncAdminMobileNavActiveState('more'); // Back to main
  } else if (sectionId === 'sec-stats') {
    syncAdminMobileNavActiveState('stats');
  } else if (sectionId === 'sec-code') {
    syncAdminMobileNavActiveState('code');
  } else if (sectionId === 'sec-manual') {
    syncAdminMobileNavActiveState('manual');
  } else if (sectionId === 'sec-promos') {
    syncAdminMobileNavActiveState('promos');
  } else {
    syncAdminMobileNavActiveState('more'); // Everything else falls into 'More' sheet
  }
}

// ─── 8. Bottom Sheet Utilities ───
window.openMobileMoreSheet = function() {
  const sheet = document.getElementById('mobile-more-sheet');
  if (sheet) sheet.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // Stop parent scrolling
};

window.closeMobileMoreSheet = function() {
  const sheet = document.getElementById('mobile-more-sheet');
  if (sheet) sheet.classList.add('hidden');
  document.body.style.overflow = '';
};

window.openAdminMoreSheet = function() {
  const sheet = document.getElementById('admin-more-sheet');
  if (sheet) sheet.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
};

window.closeAdminMoreSheet = function() {
  const sheet = document.getElementById('admin-more-sheet');
  if (sheet) sheet.classList.add('hidden');
  document.body.style.overflow = '';
};

// ─── 9. Logout Triggers ───
window.triggerStudentLogout = function() {
  if (window.studentLogout) {
    window.studentLogout();
  } else {
    const btn = document.getElementById('btn-logout');
    if (btn) btn.click();
  }
};

window.triggerAdminLogout = function() {
  if (window.adminLogout) {
    window.adminLogout();
  }
};
