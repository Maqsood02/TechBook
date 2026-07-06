/**
 * TechBook Mobile Navigation & PWA Handler
 * ========================================
 * Implements bottom navigation menus, bottom sheets, top subtab toggles,
 * and service worker initialization for native mobile experience.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ─── 1. Register Service Worker for PWA ───
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js?v=20260706')
      .then(reg => console.log('✅ PWA Service Worker Registered', reg.scope))
      .catch(err => console.error('❌ Service Worker Registration Failed', err));
  }

  // ─── 2. Initialize Layout & Observers ───
  initMobileLayout();
});

function initMobileLayout() {
  // Observe student-area and admin-area class lists to detect login/logout state
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        updateMobileNavVisibility();
      }
    });
  });

  const studentArea = document.getElementById('student-area');
  const adminArea = document.getElementById('admin-area');

  if (studentArea) observer.observe(studentArea, { attributes: true });
  if (adminArea) observer.observe(adminArea, { attributes: true });

  // Run initial visibility check
  updateMobileNavVisibility();

  // ─── 3. Intercept Switch Tab Functions for Syncing Bottom Nav ───
  wrapTabSwitchers();
}

function updateMobileNavVisibility() {
  const studentArea = document.getElementById('student-area');
  const adminArea = document.getElementById('admin-area');
  
  const studentNav = document.getElementById('student-mobile-nav');
  const adminNav = document.getElementById('admin-mobile-nav');
  
  const isStudentLoggedIn = studentArea && !studentArea.classList.contains('hidden');
  const isAdminLoggedIn = adminArea && !adminArea.classList.contains('hidden');

  if (isStudentLoggedIn || isAdminLoggedIn) {
    document.body.classList.add('mobile-app-mode');
    if (isStudentLoggedIn) {
      document.body.classList.add('student-mode');
      document.body.classList.remove('admin-mode');
    } else {
      document.body.classList.add('admin-mode');
      document.body.classList.remove('student-mode');
    }
  } else {
    document.body.classList.remove('mobile-app-mode');
    document.body.classList.remove('student-mode');
    document.body.classList.remove('admin-mode');
  }
  
  if (isStudentLoggedIn) {
    if (studentNav) studentNav.classList.remove('hidden');
    if (adminNav) adminNav.classList.add('hidden');
    syncMobileNavActiveState('home');
    
    // Initialize student mobile app header in Home state
    if (typeof window.updateMobileAppHeader === 'function') {
      window.updateMobileAppHeader(null);
    }
  } else if (isAdminLoggedIn) {
    if (adminNav) adminNav.classList.remove('hidden');
    if (studentNav) studentNav.classList.add('hidden');
    syncAdminMobileNavActiveState('stats');
  } else {
    if (studentNav) studentNav.classList.add('hidden');
    if (adminNav) adminNav.classList.add('hidden');
    
    // Hide mobile app header when logged out
    const header = document.getElementById('mobile-app-header');
    if (header) header.classList.add('hidden');
  }
}

// ─── 4. Student Navigation Handler ───
window.handleMobileNavClick = function(tabName, element) {
  if (tabName === 'more') {
    openMobileMoreSheet();
    return;
  }
  
  closeMobileMoreSheet();

  // Map tabs to switchStudentTab args
  if (tabName === 'home') {
    if (typeof window.switchStudentTab === 'function') window.switchStudentTab(null);
  } else if (tabName === 'attendance') {
    if (typeof window.switchStudentTab === 'function') window.switchStudentTab('attendance');
  } else if (tabName === 'quiz') {
    if (typeof window.switchStudentTab === 'function') window.switchStudentTab('quiz');
  } else if (tabName === 'academics') {
    // Open notes by default on Academics tap
    if (typeof window.switchStudentTab === 'function') window.switchStudentTab('notes');
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
  const dashboardMain = document.getElementById('student-dashboard-main');
  const dashboardBanner = document.getElementById('student-dashboard-banner');
  
  // Update mobile app header dynamically
  if (typeof window.updateMobileAppHeader === 'function') {
    window.updateMobileAppHeader(tab);
  }
  
  if (!tab) {
    syncMobileNavActiveState('home');
    if (subtabs) subtabs.classList.add('hidden');
    if (dashboardMain) dashboardMain.style.display = '';
    if (dashboardBanner) dashboardBanner.style.display = '';
  } else {
    if (dashboardMain) dashboardMain.style.display = 'none';
    if (dashboardBanner) dashboardBanner.style.display = 'none';
    
    if (tab === 'attendance') {
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

// ─── 10. Dynamic Mobile App Header Controller ───
window.updateMobileAppHeader = function(tab) {
  const header = document.getElementById('mobile-app-header');
  const welcomeCard = document.getElementById('mobile-welcome-card');
  const menuIcon = document.getElementById('svg-header-menu');
  const backIcon = document.getElementById('svg-header-back');
  const titleMain = document.getElementById('mobile-header-title-main');
  const subtitle = document.getElementById('mobile-header-subtitle');
  
  if (!header) return;
  
  // Only show header on mobile screens
  if (window.innerWidth >= 768) {
    header.classList.add('hidden');
    return;
  }
  
  header.classList.remove('hidden');
  
  if (!tab || tab === 'home') {
    if (welcomeCard) welcomeCard.style.display = 'flex';
    if (menuIcon) menuIcon.classList.remove('hidden');
    if (backIcon) backIcon.classList.add('hidden');
    if (titleMain) titleMain.innerHTML = 'Tech <span style="color: #4f8ef7;">Book</span>';
    if (subtitle) subtitle.style.display = 'block';
  } else {
    if (welcomeCard) welcomeCard.style.display = 'none';
    if (menuIcon) menuIcon.classList.add('hidden');
    if (backIcon) backIcon.classList.remove('hidden');
    if (subtitle) subtitle.style.display = 'none';
    
    const tabNames = {
      'attendance': 'Attendance Tracker',
      'quiz': 'Quizzes',
      'quiz-history': 'Quiz History',
      'history': 'Attendance History',
      'notes': 'Study Notes',
      'qbank': 'Question Bank',
      'pyq': 'Previous Papers',
      'ia-timetable': 'IA Timetable'
    };
    if (titleMain) titleMain.innerHTML = tabNames[tab] || 'Tech Book';
  }
};

window.handleMobileHeaderLeftClick = function() {
  const backIcon = document.getElementById('svg-header-back');
  if (backIcon && !backIcon.classList.contains('hidden')) {
    if (typeof window.switchStudentTab === 'function') {
      window.switchStudentTab(null);
    }
  } else {
    if (typeof window.openMobileMoreSheet === 'function') {
      window.openMobileMoreSheet();
    }
  }
};

window.addEventListener('resize', () => {
  const studentArea = document.getElementById('student-area');
  const isStudentLoggedIn = studentArea && !studentArea.classList.contains('hidden');
  if (isStudentLoggedIn) {
    let activeTab = null;
    const tabContent = document.getElementById('student-tab-content');
    if (tabContent && tabContent.style.display !== 'none') {
      const activeTabSec = ['attendance', 'quiz', 'quiz-history', 'history', 'notes', 'qbank', 'pyq', 'ia-timetable'].find(t => {
        const c = document.getElementById('stab-content-' + t);
        return c && c.style.display !== 'none';
      });
      activeTab = activeTabSec || null;
    }
    window.updateMobileAppHeader(activeTab);
  }
});
