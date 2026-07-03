import { auth, db } from '../core/firebase.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, setDoc, getDoc, addDoc, collection, query, where, getDocs, orderBy, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { $, val, API_BASE_URL } from '../core/helpers.js';

    /* === STUDENT TABS === */

    window.showComingSoon = function (title, desc) {
      const modal = document.getElementById('coming-soon-modal');
      document.getElementById('cs-title').textContent = title;
      document.getElementById('cs-desc').textContent = desc;
      modal.style.display = 'flex';
    };

    window._switchTab = window.switchStudentTab = function (tab) {
      const navGrid = document.getElementById('student-nav-grid');
      const logoutBtn = document.getElementById('btn-logout');
      const tabContent = document.getElementById('student-tab-content');

      if (typeof window.trackUserActivity === 'function') {
        const tabNameMap = {
          'attendance': 'Viewing Attendance Page',
          'quiz': 'Browsing Quizzes List',
          'quiz-history': 'Viewing Quiz Attempts History',
          'history': 'Viewing Attendance History',
          'notes': 'Browsing Study Notes',
          'qbank': 'Browsing Question Banks',
          'pyq': 'Browsing Previous Year Question Papers',
          'ia-timetable': 'Viewing IA Timetable'
        };
        const desc = tab ? (tabNameMap[tab] || `Viewing ${tab}`) : 'Viewing Student Dashboard Grid';
        window.trackUserActivity(desc, false);
      }

      if (!tab) {
        if (!window._studentHistoryNavLock) {
          window.location.hash = '#student';
          return;
        }
        // Back to nav grid
        if (navGrid) navGrid.style.display = 'grid';
        if (logoutBtn) logoutBtn.style.display = '';
        if (tabContent) tabContent.style.display = 'none';
        ['attendance', 'quiz', 'quiz-history', 'history', 'notes', 'qbank', 'pyq', 'ia-timetable'].forEach(t => {
          const c = document.getElementById('stab-content-' + t);
          if (c) c.style.display = 'none';
        });
        return;
      }

      // Hide nav, show content
      if (navGrid) navGrid.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'none';
      if (tabContent) tabContent.style.display = '';
      ['attendance', 'quiz', 'quiz-history', 'history', 'notes', 'qbank', 'pyq', 'ia-timetable'].forEach(t => {
        const c = document.getElementById('stab-content-' + t);
        if (c) c.style.display = t === tab ? '' : 'none';
      });

      if (tab === 'quiz') loadStudentQuizzes();
      if (tab === 'quiz-history') loadStudentQuizHistory();
      if (tab === 'notes') studentLoadNotes();
      if (tab === 'qbank') studentLoadQBank();
      if (tab === 'pyq') studentLoadPYQ();
      if (tab === 'ia-timetable') window.loadIATimetable && window.loadIATimetable();
      if (tab === 'ia-timetable') loadIATimetable();
      if (typeof updateAppHistory === 'function' && !window._studentHistoryNavLock) updateAppHistory(tab, false);
    };

    function updateAppHistory(tab, replace = false) {
      if (!window.history?.pushState) return;
      const state = { role: 'student', tab: tab || null };
      const url = '#student' + (tab ? '-' + tab : '');
      if (replace) {
        window.history.replaceState(state, '', url);
      } else {
        window.history.pushState(state, '', url);
      }
    }

    window._studentLogout = window.studentLogout = async function () {
      try {
        if (typeof window.trackUserActivity === 'function') {
          window.trackUserActivity('Logged out from Student Portal', true);
        }
        await signOut(auth);
        window._currentStudentUSN = null;
        window._currentStudentEmail = null;
        try {
          localStorage.removeItem('techbook_student_logged_in');
          localStorage.removeItem('techbook_student_usn');
          localStorage.removeItem('techbook_student_data');
        } catch (storageErr) {
          console.warn('Could not clear local student session:', storageErr);
        }
        if (typeof window.updateNavbarLoginBtn === 'function') {
          window.updateNavbarLoginBtn();
        }
        if (window._featureUnsubscribe) {
          window._featureUnsubscribe();
          window._featureUnsubscribe = null;
        }
        switchStudentTab(null);
        msg('login-msg', 'Logged out successfully', 'info');
        if (typeof showLandingPage === 'function') showLandingPage();
      } catch (e) { console.error('Logout error:', e); }
    };

    async function loadStudentQuizHistory() {
      const c = document.getElementById('quiz-history-container');
      c.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">⏳ Loading…</p>';
      try {
        const usn = window._currentStudentUSN || 'UNKNOWN';
        const snap = await getDocs(query(collection(db, 'quiz_results'), where('usn', '==', usn)));
        const results = [];
        snap.forEach(d => results.push({ id: d.id, ...d.data() }));
        if (!results.length) { c.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">No quiz attempts yet.</p>'; return; }
        results.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
        c.innerHTML = '<p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">Tap any quiz to see detailed answers</p>';
        results.forEach(r => {
          const pct = r.percent || Math.round((r.score / r.total) * 100);
          const color = pct >= 80 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171';
          const emoji = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📚';
          const date = r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—';
          const card = document.createElement('div');
          card.style.cssText = 'background:#f7f8fc;border:1px solid rgba(0,0,0,0.03);border-radius:12px;padding:14px 16px;margin-bottom:10px;cursor:pointer;transition:all 0.2s;';
          card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
              <div>
                <div style="font-weight:700;font-size:14px;">📚 ${r.subject || ''} — ${r.topic || ''}</div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">${date}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:22px;font-weight:900;color:${color};">${emoji} ${r.score}/${r.total}</div>
                <div style="font-size:12px;color:${color};font-weight:700;">${pct}%</div>
              </div>
            </div>
            <div class="qh-detail" style="display:none;margin-top:14px;border-top:1px solid #ffffff;padding-top:12px;"></div>`;

          // Click to expand/collapse answer review
          card.addEventListener('click', async () => {
            const detail = card.querySelector('.qh-detail');
            if (detail.style.display !== 'none') { detail.style.display = 'none'; return; }
            detail.style.display = '';
            if (detail.innerHTML) { return; } // already loaded

            detail.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;">Loading answers…</p>';
            try {
              // Load the quiz questions from Firestore
              const qSnap = await getDoc(doc(db, 'quizzes', r.quizId));
              if (!qSnap.exists()) { detail.innerHTML = '<p style="color:#f87171;font-size:12px;">Quiz data no longer available.</p>'; return; }
              const questions = qSnap.data().questions || [];
              const studentAnswers = r.answers || {}; // may not be stored
              detail.innerHTML = '<div style="font-weight:700;font-size:13px;margin-bottom:10px;">📋 Answer Review:</div>' +
                questions.map((q, i) => {
                  const correctIdx = q.correctIndex;
                  const studentIdx = studentAnswers[i];
                  const ok = studentIdx === correctIdx;
                  return `<div style="padding:10px;border-radius:8px;margin-bottom:8px;background:${ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'};border:1px solid ${ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}">
                    <div style="font-size:13px;font-weight:600;margin-bottom:6px;">${ok ? '✅' : '❌'} Q${i + 1}. ${q.question}</div>
                    <div style="font-size:12px;color:#34d399;">✓ Correct: <strong>${q.options[correctIdx]}</strong></div>
                    ${studentIdx !== undefined && !ok ? `<div style="font-size:12px;color:#f87171;margin-top:2px;">✗ Your answer: <strong>${q.options[studentIdx]}</strong></div>` : ''}
                    ${studentIdx === undefined ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">— Not answered (time ran out)</div>` : ''}
                    ${q.explanation ? `<div style="font-size:11px;color:#60a5fa;margin-top:4px;padding:4px 8px;background:rgba(96,165,250,0.08);border-radius:6px;">💡 ${q.explanation}</div>` : ''}
                  </div>`;
                }).join('');
            } catch (e) { detail.innerHTML = `<p style="color:#f87171;font-size:12px;">❌ ${e.message}</p>`; }
          });

          c.appendChild(card);
        });
      } catch (e) {
        c.innerHTML = `<p style="color:#f87171;text-align:center;padding:20px;">❌ ${e.message}</p>`;
      }
    }

    /* === STUDENT QUIZ === */
    let _cq = null, _qi = 0, _ans = {}, _timerInt = null, _qTimerSecs = 0;

    async function loadStudentQuizzes() {
      const c = document.getElementById('quiz-list-container');
      c.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">⏳ Loading…</p>';
      try {
        const usn = window._currentStudentUSN || 'UNKNOWN';
        // Load quizzes + student's completed results in parallel
        const [quizSnap, resultSnap] = await Promise.all([
          getDocs(collection(db, 'quizzes')),
          getDocs(query(collection(db, 'quiz_results'), where('usn', '==', usn)))
        ]);
        const completedIds = new Set();
        resultSnap.forEach(d => completedIds.add(d.data().quizId));

        const list = [];
        quizSnap.forEach(d => { if (d.data().published) list.push({ id: d.id, ...d.data() }); });
        if (!list.length) { c.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:40px;">No quizzes available yet. Check back soon!</p>'; return; }
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        c.innerHTML = '';

        list.forEach((q, idx) => {
          const done = completedIds.has(q.id);
          const qCount = q.questions?.length || 0;
          const diff = (q.difficulty || 'medium').toLowerCase();
          const diffColor = diff === 'easy' ? '#34d399' : diff === 'hard' ? '#f87171' : '#fbbf24';
          const diffBg = diff === 'easy' ? 'rgba(16,185,129,0.12)' : diff === 'hard' ? 'rgba(239,68,68,0.12)' : 'rgba(251,191,36,0.12)';
          const timeLbl = q.timeLimit > 0 ? (q.timeLimit === 0.75 ? '45s/Q' : q.timeLimit + 'min/Q') : 'No limit';
          const gradients = [
            'linear-gradient(135deg,#eff0fe,rgba(139,92,246,0.08))',
            'linear-gradient(135deg,rgba(236,72,153,0.15),rgba(168,85,247,0.08))',
            'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(6,182,212,0.08))',
            'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(239,68,68,0.08))',
          ];
          const borderColors = ['rgba(99,102,241,0.35)', 'rgba(236,72,153,0.35)', 'rgba(16,185,129,0.35)', 'rgba(245,158,11,0.35)'];
          const grad = done ? 'linear-gradient(135deg,rgba(16,185,129,0.1),rgba(5,150,105,0.05))' : gradients[idx % gradients.length];
          const border = done ? 'rgba(16,185,129,0.4)' : borderColors[idx % borderColors.length];

          const card = document.createElement('div');
          card.style.cssText = `background:${grad};border:1px solid ${border};border-radius:20px;padding:0;margin-bottom:14px;position:relative;overflow:hidden;transition:transform 0.2s ease,box-shadow 0.2s ease;cursor:${done ? 'default' : 'pointer'};box-shadow:0 4px 20px rgba(0,0,0,0.03);`;

          // Decorative circle
          const deco = `<div style="position:absolute;top:-24px;right:-24px;width:100px;height:100px;border-radius:50%;background:${done ? 'rgba(16,185,129,0.07)' : borderColors[idx % 4].replace('0.35', '0.07')};pointer-events:none;"></div>
          <div style="position:absolute;bottom:-20px;left:-20px;width:70px;height:70px;border-radius:50%;background:${borderColors[idx % 4].replace('0.35', '0.04')};pointer-events:none;"></div>`;

          // Coloured left accent bar
          const accentColor = done ? '#10b981' : borderColors[idx % 4].replace('0.35', '0.9');

          card.innerHTML = deco + `
            <div style="display:flex;gap:0;">
              <!-- Left accent bar -->
              <div style="width:4px;background:${done ? 'linear-gradient(180deg,#34d399,#059669)' : ('linear-gradient(180deg,' + borderColors[idx % 4].replace('0.35', '0.9') + ',' + borderColors[(idx + 1) % 4].replace('0.35', '0.7') + ')')};border-radius:20px 0 0 20px;flex-shrink:0;"></div>
              <!-- Content -->
              <div style="flex:1;padding:16px 16px 14px;">
                <!-- Top row: title + badge -->
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px;">
                  <div style="font-weight:800;font-size:15px;color:#1a1a2e;line-height:1.35;flex:1;">
                    ${done ? '✅' : '📚'} <span style="color:#1a1a2e;">${q.subject}</span>
                    <span style="color:#6b7280;font-weight:500;font-size:13px;"> — ${q.topic}</span>
                  </div>
                  ${done
              ? `<div style="flex-shrink:0;padding:5px 12px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.35);border-radius:20px;color:#34d399;font-weight:700;font-size:11px;white-space:nowrap;">✔ Done</div>`
              : `<button onclick="startQuiz('${q.id}')" style="flex-shrink:0;padding:10px 18px;background:linear-gradient(135deg,#3d5af1,#6366f1);border:none;border-radius:14px;color:#ffffff;font-weight:900;font-size:13px;cursor:pointer;box-shadow:0 4px 14px #d1d5db;transition:transform 0.15s,box-shadow 0.15s;white-space:nowrap;" onmouseover="this.style.transform='scale(1.05)';this.style.boxShadow='0 6px 20px #c7d0fb';" onmouseout="this.style.transform='';this.style.boxShadow='0 4px 14px #d1d5db';">Start →</button>`
            }
                </div>
                <!-- Pills row -->
                <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
                  <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${diffBg};color:${diffColor};border:1px solid ${diffColor}44;">${diff.charAt(0).toUpperCase() + diff.slice(1)}</span>
                  <span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:#f7f8fc;color:#6b7280;border:1px solid #e5e7eb;">📝 ${qCount} Qs</span>
                  <span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:#f7f8fc;color:#6b7280;border:1px solid #e5e7eb;">⏱ ${timeLbl}</span>
                  ${done ? '<span style="font-size:11px;font-weight:700;color:#34d399;margin-left:2px;">✔ Completed</span>' : '<span style="font-size:11px;color:#9ca3af;">Tap Start to begin</span>'}
                </div>
              </div>
            </div>`;

          if (!done) {
            card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-3px) scale(1.01)'; card.style.boxShadow = '0 12px 36px rgba(0,0,0,0.03)'; });
            card.addEventListener('mouseleave', () => { card.style.transform = ''; card.style.boxShadow = '0 4px 20px rgba(0,0,0,0.03)'; });
          }
          c.appendChild(card);
        });
      } catch (e) {
        c.innerHTML = `<p style="color:#f87171;text-align:center;padding:20px;">❌ ${e.message}</p>`;
      }
    }

    // Tab switch & screenshot detection
    let _tabWarnings = 0;
    let _quizActive = false;

    // Screenshot shield functions
    function showScreenshotShield(duration = 2000) {
      if (!_quizActive) return;
      const shield = document.getElementById('quiz-screenshot-shield');
      const quizArea = document.getElementById('quiz-take-view');
      if (shield) shield.style.display = 'flex';
      if (quizArea) quizArea.classList.add('quiz-blur-active');
      showQuizWarning('📵 Screenshot attempt detected! Your attempt is flagged.', false);
      _tabWarnings++;
      if (_tabWarnings >= 3) {
        showQuizWarning('🚫 Quiz auto-submitted due to repeated violations!', true);
        window.submitQuiz();
      }
      setTimeout(() => {
        if (shield) shield.style.display = 'none';
        if (quizArea) quizArea.classList.remove('quiz-blur-active');
      }, duration);
    }

    function setupQuizSecurityListeners() {
      // Tab switch / window blur
      const onBlur = () => {
        if (!_quizActive) return;
        _tabWarnings++;
        const remaining = 3 - _tabWarnings;
        if (_tabWarnings >= 3) {
          showQuizWarning('🚫 Quiz auto-submitted: You switched tabs 3 times!', true);
          window.submitQuiz();
        } else {
          showQuizWarning(`⚠️ Warning ${_tabWarnings}/3: Do not switch tabs! ${remaining} warning(s) left.`, false);
        }
      };
      window.addEventListener('blur', onBlur);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && _quizActive) onBlur();
      });

      // Keyboard screenshot detection (desktop)
      document.addEventListener('keydown', (e) => {
        if (!_quizActive) return;
        const isScreenshot = e.key === 'PrintScreen' ||
          (e.ctrlKey && e.shiftKey && (e.key === 's' || e.key === 'S' || e.key === '3' || e.key === '4' || e.key === '5')) ||
          (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5' || e.key === 's' || e.key === 'S'));
        if (isScreenshot) {
          e.preventDefault();
          showScreenshotShield(1500);
        }
      });

      // Right-click disabled during quiz
      document.addEventListener('contextmenu', (e) => {
        if (_quizActive) { e.preventDefault(); showQuizWarning('📵 Right-click is disabled during the quiz.', false); }
      });

      // Mobile: block long-press copy / share on quiz area
      document.addEventListener('touchstart', (e) => {
        if (!_quizActive) return;
        const inQuiz = e.target.closest('#quiz-take-view');
        if (inQuiz) { e.target.style.webkitUserSelect = 'none'; e.target.style.userSelect = 'none'; }
      }, { passive: true });

      // Detect Android power+vol screenshot (visibility change approach)
      // When screen goes dark briefly (Android screenshot), visibilitychange fires
      // Already handled by tab switch detection above

      // Block Media Capture API if available
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        const origGetDisplay = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getDisplayMedia = async (...args) => {
          if (_quizActive) { showScreenshotShield(2000); throw new Error('Screen capture blocked during quiz'); }
          return origGetDisplay(...args);
        };
      }
    }
    setupQuizSecurityListeners();

    function showQuizWarning(msg, fatal) {
      let warn = document.getElementById('quiz-security-warning');
      if (!warn) {
        warn = document.createElement('div');
        warn.id = 'quiz-security-warning';
        warn.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;padding:14px 20px;text-align:center;font-weight:700;font-size:14px;animation:slideDown 0.3s ease;';
        document.body.appendChild(warn);
      }
      warn.style.background = fatal ? '#7f1d1d' : '#78350f';
      warn.style.color = fatal ? '#fca5a5' : '#fde68a';
      warn.style.border = `2px solid ${fatal ? '#ef4444' : '#f59e0b'}`;
      warn.textContent = msg;
      warn.style.display = 'block';
      if (!fatal) setTimeout(() => { if (warn) warn.style.display = 'none'; }, 3000);
    }

    window.startQuiz = async function (qid) {
      const snap = await getDoc(doc(db, 'quizzes', qid));
      if (!snap.exists()) return;
      _cq = { id: qid, ...snap.data() }; _qi = 0; _ans = {};
      _tabWarnings = 0;
      _quizActive = true;
      _expiredQs = new Set(); // reset expired questions tracker
      _qTimerSecs = _cq.timeLimit > 0 ? Math.round(_cq.timeLimit * 60) : 0;
      document.getElementById('quiz-list-view').style.display = 'none';
      document.getElementById('quiz-take-view').style.display = '';
      document.getElementById('quiz-result-view').style.display = 'none';
      document.getElementById('quiz-take-title').textContent = `${_cq.subject} — ${_cq.topic}`;
      document.getElementById('quiz-q-total').textContent = _cq.questions.length;
      if (_timerInt) clearInterval(_timerInt);
      renderQ();
    };

    function fmtTime(s) {
      if (s <= 0) return '⏱ 0:00';
      return `⏱ ${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
    }

    function startQTimer() {
      if (_timerInt) clearInterval(_timerInt);
      const te = document.getElementById('quiz-timer');
      if (!_qTimerSecs) { if (te) te.textContent = ''; return; }

      // If this question's timer already expired, show "⏱ Time's up" but don't restart
      if (_expiredQs.has(_qi)) {
        if (te) { te.textContent = '⏱ Time\'s up'; te.style.color = '#ef4444'; te.style.background = 'rgba(239,68,68,0.1)'; }
        return;
      }

      let s = _qTimerSecs;
      if (te) { te.textContent = fmtTime(s); te.style.color = '#f59e0b'; te.style.background = 'rgba(245,158,11,0.1)'; }
      _timerInt = setInterval(() => {
        s--;
        if (te) { te.textContent = fmtTime(s); }
        if (s <= 10 && te) te.style.color = '#ef4444';
        if (s <= 0) {
          clearInterval(_timerInt);
          _expiredQs.add(_qi); // mark this question as expired
          if (te) { te.textContent = '⏱ Time\'s up'; te.style.color = '#ef4444'; }
          // Auto-advance after 1 second pause
          setTimeout(() => {
            if (_qi < _cq.questions.length - 1) { _qi++; renderQ(); }
            else { window.submitQuiz(); }
          }, 1000);
        }
      }, 1000);
    }

    function renderQ() {
      const q = _cq.questions[_qi];
      const total = _cq.questions.length;
      document.getElementById('quiz-q-current').textContent = _qi + 1;
      document.getElementById('quiz-question-text').textContent = sanitizeText(q.question);

      // Update progress bar
      const pb = document.getElementById('quiz-progress-bar');
      if (pb) pb.style.width = Math.round((_qi + 1) / total * 100) + '%';

      const optBox = document.getElementById('quiz-options');
      optBox.innerHTML = '';

      // Locked if answered OR if timer expired for this question
      const timeExpired = _expiredQs.has(_qi);
      const answered = _ans[_qi] !== undefined;
      const locked = answered || timeExpired;

      const colors = ['rgba(99,102,241,', 'rgba(236,72,153,', 'rgba(16,185,129,', 'rgba(245,158,11,'];
      const letters = ['A', 'B', 'C', 'D'];

      q.options.forEach((optText, i) => {
        const btn = document.createElement('button');
        const selected = _ans[_qi] === i;
        const col = colors[i] || 'rgba(255,255,255,';

        // If time expired and no answer selected — show all options greyed out
        const dimmed = locked && !selected;
        btn.style.cssText = [
          'width:100%', 'text-align:left', 'padding:14px 16px', 'border-radius:14px',
          'font-size:14px', 'font-family:inherit', 'display:flex', 'align-items:center', 'gap:12px',
          'border:2px solid ' + (selected ? col + '0.8)' : col + '0.15)'),
          'background:' + (selected ? col + '0.18)' : (timeExpired && !answered ? 'rgba(255,255,255,0.02)' : col + '0.04)')),
          'color:' + (dimmed ? '#9ca3af' : (selected ? '#111827' : '#374151')),
          'cursor:not-allowed',
          'transition:all 0.15s', 'outline:none',
          'opacity:' + (dimmed ? '0.45' : '1')
        ].join(';');

        const badge = document.createElement('span');
        badge.style.cssText = 'min-width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:8px;font-weight:800;font-size:13px;flex-shrink:0;background:' +
          (selected ? col + '0.35)' : col + '0.08)') + ';color:' +
          (selected ? '#fff' : (dimmed ? '#9ca3af' : col + '0.9)')) + ';border:1px solid ' +
          col + (selected ? '0.6)' : '0.15)') + ';';
        badge.textContent = letters[i];

        const text = document.createElement('span');
        text.style.cssText = 'line-height:1.4;';
        text.textContent = stripOptionPrefix(sanitizeText(optText));
        btn.appendChild(badge);
        btn.appendChild(text);

        if (selected) {
          const tick = document.createElement('span');
          tick.textContent = '✓';
          tick.style.cssText = 'margin-left:auto;font-size:16px;font-weight:900;color:#34d399;flex-shrink:0;';
          btn.appendChild(tick);
        }
        // Only allow clicking if not locked at all
        if (!locked) {
          btn.style.cursor = 'pointer';
          btn.addEventListener('click', () => { _ans[_qi] = i; renderQ(); });
        }
        optBox.appendChild(btn);
      });

      // Lock/expired note
      let lockNote = document.getElementById('quiz-lock-note');
      if (!lockNote) {
        lockNote = document.createElement('div');
        lockNote.id = 'quiz-lock-note';
        lockNote.style.cssText = 'font-size:12px;text-align:center;margin-top:10px;height:18px;';
        optBox.parentNode.insertBefore(lockNote, optBox.nextSibling);
      }
      if (timeExpired && !answered) {
        lockNote.innerHTML = '<span style="color:#ef4444;">⏱ Time expired — no answer recorded</span>';
      } else if (answered) {
        lockNote.innerHTML = '<span style="color:#f59e0b;">🔒 Answer locked</span>';
      } else {
        lockNote.innerHTML = '';
      }

      document.getElementById('quiz-prev-btn').style.display = _qi === 0 ? 'none' : '';
      document.getElementById('quiz-next-btn').style.display = _qi === total - 1 ? 'none' : '';
      document.getElementById('quiz-submit-btn').style.display = _qi === total - 1 ? '' : 'none';

      startQTimer();
    }
    window.renderQ = renderQ;

    // Track which questions had their timer expire (so Prev doesn't restart timer)
    let _expiredQs = new Set();

    window.quizNav = function (d) {
      if (_timerInt) clearInterval(_timerInt);
      _qi = Math.max(0, Math.min(_cq.questions.length - 1, _qi + d));
      renderQ();
    };

    window.submitQuiz = async function () {
      if (_timerInt) clearInterval(_timerInt);
      _quizActive = false;
      // Hide any warning banner
      const warn = document.getElementById('quiz-security-warning');
      if (warn) warn.style.display = 'none';

      let score = 0;
      _cq.questions.forEach((q, i) => { if (_ans[i] === q.correctIndex) score++; });
      const pct = Math.round(score / _cq.questions.length * 100);
      try {
        const usn = window._currentStudentUSN || 'UNKNOWN';
        await setDoc(doc(db, 'quiz_results', `${usn}_${_cq.id}`), {
          usn, quizId: _cq.id, subject: _cq.subject, topic: _cq.topic,
          score, total: _cq.questions.length, percent: pct,
          answers: { ..._ans }, // save student answers for review
          submittedAt: new Date().toISOString(),
          tabWarnings: _tabWarnings
        });

        // ── Send quiz result email notification ──
        try {
          const studentData = window._currentStudentData || {};
          if (studentData.email && studentData.email_verified) {
            fetch(`${API_BASE_URL}/api/notify-quiz-result`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                usn,
                studentEmail: studentData.email,
                studentName: studentData.name || usn,
                quizName: `${_cq.subject} — ${_cq.topic}`,
                subject: _cq.subject,
                marksObtained: score,
                totalMarks: _cq.questions.length,
                percentage: pct,
                completionTime: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
              })
            }).catch(() => {}); // silent fail — don't block UI
          }
        } catch (e) { /* silent fail */ }


      } catch (e) { console.warn('Save result:', e.message); }
      document.getElementById('quiz-take-view').style.display = 'none';
      document.getElementById('quiz-result-view').style.display = '';
      document.getElementById('quiz-result-emoji').textContent = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📚';
      document.getElementById('quiz-result-title').textContent = `${_cq.subject} — ${_cq.topic}`;
      document.getElementById('quiz-score-display').textContent = `${score} / ${_cq.questions.length}`;
      document.getElementById('quiz-result-msg').textContent = pct >= 80 ? `Excellent! ${pct}%` : pct >= 50 ? `Good job! ${pct}%` : `Keep practicing! ${pct}%`;
      document.getElementById('quiz-answer-review').innerHTML = '<div style="font-weight:700;margin-bottom:12px;font-size:14px;">📋 Answer Review</div>' +
        _cq.questions.map((q, i) => {
          const ok = _ans[i] === q.correctIndex;
          const qText = sanitizeText(q.question);
          const yourAns = _ans[i] !== undefined ? stripOptionPrefix(sanitizeText(q.options[_ans[i]])) : 'Not answered';
          const correctAns = stripOptionPrefix(sanitizeText(q.options[q.correctIndex]));
          const expl = sanitizeText(q.explanation);
          return '<div style="padding:12px;border-radius:10px;margin-bottom:8px;text-align:left;' +
            'background:' + (ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)') + ';' +
            'border:1px solid ' + (ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)') + ';">' +
            '<div style="font-size:13px;font-weight:600;margin-bottom:6px;line-height:1.4;">' + (ok ? '✅' : '❌') + ' Q' + (i + 1) + '. ' + qText + '</div>' +
            (!ok ? '<div style="font-size:12px;color:#f87171;margin-bottom:3px;">Your: ' + yourAns + '</div>' : '') +
            '<div style="font-size:12px;color:#34d399;margin-bottom:2px;">✓ ' + correctAns + '</div>' +
            (expl ? '<div style="font-size:12px;color:#93c5fd;padding:5px 8px;background:rgba(96,165,250,0.08);border-radius:6px;line-height:1.4;margin-top:4px;">💡 ' + expl + '</div>' : '') +
            '</div>';
        }).join('');
    };

    window.backToQuizList = function () {
      if (_timerInt) clearInterval(_timerInt);
      _quizActive = false;
      const warn = document.getElementById('quiz-security-warning');
      if (warn) warn.style.display = 'none';
      document.getElementById('quiz-take-view').style.display = 'none';
      document.getElementById('quiz-result-view').style.display = 'none';
      document.getElementById('quiz-list-view').style.display = '';
      loadStudentQuizzes(); // refresh list to show completed status
    };

    /* === ADMIN QUIZ GENERATION (Groq / OpenRouter — CORS-safe) === */
    let _generatedQuiz = null;
    let _allUsedQuestions = [];
    let _aiApiKey = '';

    function getAiKey() {
      return _aiApiKey || '';
    }
    window.getAiKey = getAiKey;

    function updateAiKeyStatus(type, message) {
      const statusEl = document.getElementById('ai-key-status');
      if (statusEl) statusEl.innerHTML = `<span style="color:#34d399;">✅ ${type} key loaded</span>${message ? ' <span style="color:#d1d5db;">' + message + '</span>' : ''}`;
    }

    async function saveAIKey() {
      const inputEl = document.getElementById('ai-api-key');
      const statusEl = document.getElementById('ai-key-status');
      const key = inputEl?.value.trim() || '';
      if (!key) {
        if (statusEl) statusEl.innerHTML = '<span style="color:#f87171;">⚠️ Paste your API key first.</span>';
        return;
      }
      try {
        await setDoc(doc(db, 'settings', 'ai_api_key'), {
          key,
          updatedAt: serverTimestamp(),
          updatedBy: window._currentAdminId || 'admin'
        });
        _aiApiKey = key;
        if (inputEl) inputEl.value = key;
        const type = key.startsWith('gsk_') ? 'Groq' : key.startsWith('sk-or-') ? 'OpenRouter' : 'API';
        if (statusEl) statusEl.innerHTML = `<span style="color:#34d399;">✅ ${type} key saved</span> <span style="color:#d1d5db;">Saved in admin settings.</span>`;
      } catch (err) {
        if (statusEl) statusEl.innerHTML = `<span style="color:#f87171;">Error saving key: ${err.message}</span>`;
      }
    }
    window.saveAIKey = saveAIKey;

    async function loadAIKey() {
      const el = document.getElementById('ai-api-key');
      const statusEl = document.getElementById('ai-key-status');
      try {
        const snap = await getDoc(doc(db, 'settings', 'ai_api_key'));
        if (snap.exists() && snap.data().key) {
          _aiApiKey = snap.data().key;
          if (el) el.value = _aiApiKey;
          const type = _aiApiKey.startsWith('gsk_') ? 'Groq' : _aiApiKey.startsWith('sk-or-') ? 'OpenRouter' : 'API';
          if (statusEl) statusEl.innerHTML = `<span style="color:#34d399;">✅ ${type} key loaded</span> <span style="color:#d1d5db;">Loaded from admin settings.</span>`;
          return;
        }
      } catch (err) {
        if (statusEl) statusEl.innerHTML = `<span style="color:#f87171;">Error loading AI key: ${err.message}</span>`;
        return;
      }
      _aiApiKey = '';
      if (el) el.value = '';
      if (statusEl) statusEl.innerHTML = '<span style="color:#fbbf24;">⚠️ No AI key saved yet. Admin can add one above.</span>';
    }
    window.loadAIKey = loadAIKey;

    async function callAnthropicAI(prompt, maxTok) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: maxTok || 4000,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Anthropic API error ' + res.status);
      return data.content?.[0]?.text || '';
    }

    async function callAI(apiKey, prompt) {
      // If no external key, use Anthropic API directly
      if (!apiKey) {
        return callAnthropicAI(prompt);
      }
      // Groq — extremely fast, free, full CORS support
      if (apiKey.startsWith('gsk_')) {
        // Try Groq models from largest to smallest; if one isn't available, continue to the next
        const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-8b-8192', 'mixtral-8x7b-32768', 'gemma2-9b-it'];
        let lastErr = '';
        for (const gModel of groqModels) {
          try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
              body: JSON.stringify({
                model: gModel,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 3200,
                temperature: 0.7
              })
            });
            const data = await res.json();
            if (res.status === 429) {
              // Extract wait time from error message and wait before trying next model
              const msg = data.error?.message || '';
              const waitMatch = msg.match(/try again in ([\d.]+)s/);
              const waitMs = waitMatch ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 500 : 3000;
              console.warn(`Groq 429 on ${gModel}, waiting ${waitMs}ms before next model…`);
              await new Promise(r => setTimeout(r, waitMs));
              lastErr = msg;
              continue; // try next model
            }
            if (!res.ok) { lastErr = data.error?.message || 'Groq error ' + res.status; continue; }
            const gText = data.choices?.[0]?.message?.content || '';
            if (gText) return gText;
            lastErr = 'Empty response from ' + gModel;
          } catch (e) { lastErr = e.message; continue; }
        }
        console.warn('All Groq models failed, falling back to Anthropic:', lastErr); return callAnthropicAI(prompt);
      }

      // OpenRouter — support the fastest free models first
      const models = [
        'mistralai/mistral-7b-instruct:free',
        'microsoft/phi-3-mini-128k-instruct:free',
        'qwen/qwen-2-7b-instruct:free',
        'meta-llama/llama-3.1-8b-instruct:free',
      ];
      let lastErr = '';
      for (const model of models) {
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 18000);
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + apiKey,
              'HTTP-Referer': location.href,
              'X-Title': 'Quiz Generator'
            },
            body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 3200, temperature: 0.7 })
          });
          clearTimeout(tid);
          const data = await res.json();
          if (!res.ok) { lastErr = data.error?.message || 'HTTP ' + res.status; continue; }
          const text = data.choices?.[0]?.message?.content || '';
          if (text) return text;
          lastErr = 'Empty response from ' + model;
        } catch (e) {
          lastErr = e.name === 'AbortError' ? 'Timeout on ' + model : e.message;
        }
      }
      // All OpenRouter models failed — fall back to Anthropic
      console.warn('OpenRouter failed, falling back to Anthropic:', lastErr);
      return callAnthropicAI(prompt);
    }

    document.getElementById('btn-generate-quiz')?.addEventListener('click', async () => {
      const subject = document.getElementById('qz-subject')?.value.trim();
      const topic = document.getElementById('qz-topic')?.value.trim();
      const count = parseInt(document.getElementById('qz-count')?.value || '10');
      const difficulty = document.getElementById('qz-difficulty')?.value || 'medium';
      const timeLimit = parseFloat(document.getElementById('qz-time')?.value || '0');
      const target = document.getElementById('qz-target')?.value.trim();
      const instructions = document.getElementById('qz-instructions')?.value.trim();
      const msgEl = document.getElementById('qz-create-msg');

      if (!subject || !topic) { msgEl.innerHTML = '<span style="color:#f87171;">⚠️ Enter Subject and Topic.</span>'; return; }

      const apiKey = document.getElementById('ai-api-key')?.value.trim() || _aiApiKey || '';

      const btn = document.getElementById('btn-generate-quiz');
      btn.disabled = true;
      document.getElementById('qz-preview-box').style.display = 'none';

      const apiType = !apiKey ? 'TechBook AI' : apiKey.startsWith('gsk_') ? 'Groq' : 'OpenRouter';

      const setProgress = (msg, pct) => {
        msgEl.innerHTML = `<div style="background:#f7f8fc;border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;">
          <span style="font-size:12px;color:#3d5af1;font-weight:700;">${msg}</span>
          <div style="background:#ffffff;border-radius:999px;height:5px;overflow:hidden;margin-top:8px;">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#3d5af1,#00d9f5,#a855f7);border-radius:999px;transition:width 0.4s ease;"></div>
          </div>
        </div>`;
        btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px;"><span style="width:14px;height:14px;border:2px solid rgba(5,13,26,0.3);border-top-color:#050d1a;border-radius:50%;display:inline-block;animation:spin 0.7s linear infinite;"></span> Generating…</span>`;
      };

      // Build a set of already-used question keys for O(1) lookup
      const usedKeys = new Set(_allUsedQuestions.map(q => q.slice(0, 50).toLowerCase().replace(/\s+/g, ' ').trim()));

      const buildPrompt = (needed, attempt) => {
        // Send recently used to AI so it avoids them in its generation
        const recentUsed = _allUsedQuestions.slice(-80).map(q => q.slice(0, 60)).join(' | ');
        return `You are an expert teacher. Create a ${difficulty} difficulty multiple choice quiz.
Subject: ${subject}
Topic: ${topic}
${instructions ? 'Special focus: ' + instructions : ''}
${recentUsed ? 'NEVER use any variation of these questions (already used): ' + recentUsed : ''}

YOU MUST GENERATE EXACTLY ${needed} UNIQUE QUESTIONS. Count them before responding.
Return ONLY a raw JSON array. Zero extra text. Zero markdown. Zero backticks.

[{"question":"...","options":["option text 1","option text 2","option text 3","option text 4"],"correctIndex":0,"explanation":"..."}]

Strict rules:
1. Generate EXACTLY ${needed} question objects — not ${needed - 1}, not ${needed + 1}, exactly ${needed}
2. Every question must be completely different from each other and from previous batches
3. Plain text only — no HTML, no angle brackets, no special chars
4. correctIndex is 0, 1, 2, or 3 (spread variety across positions)
5. Each option must be a complete meaningful phrase
6. Seed for variety: ${Math.floor(Math.random() * 999999)} attempt:${attempt}`;
      };

      let allQuestions = [];
      let attempt = 0;
      const maxAttempts = 3;

      try {
        while (allQuestions.length < count && attempt < maxAttempts) {
          attempt++;
          const needed = count - allQuestions.length;
          const pct = Math.round((allQuestions.length / count) * 80) + 10;
          setProgress(`🤖 ${apiType} — generating ${needed} question${needed > 1 ? 's' : ''} (${allQuestions.length}/${count} done, attempt ${attempt})…`, pct);

          const raw = await callAI(apiKey, buildPrompt(needed, attempt));
          // Small pause between attempts to stay within rate limits
          if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1200));
          const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').replace(/^[^\[]*/, '').replace(/[^\]]*$/, '').trim();
          const arrMatch = cleaned.match(/\[([\s\S]*)\]/);
          if (!arrMatch) { console.warn('No JSON array in attempt', attempt, 'Raw:', raw.slice(0, 200)); continue; }

          let parsed;
          try { parsed = JSON.parse(arrMatch[0]); }
          catch (pe) { console.warn('JSON parse failed attempt', attempt, pe.message); continue; }

          if (!Array.isArray(parsed)) continue;

          // Sanitize, validate, deduplicate
          const newOnes = parsed
            .map(q => ({
              ...q,
              question: sanitizeText(q.question) || String(q.question || '').replace(/[<>`]/g, '').trim(),
              options: (q.options || []).map(o => sanitizeText(o) || String(o || '').replace(/[<>]/g, '').trim() || 'Option'),
              explanation: sanitizeText(q.explanation)
            }))
            .filter(q => q.question && Array.isArray(q.options) && q.options.length === 4 && q.options.filter(o => (o || '').trim().length > 0).length === 4)
            .filter(q => {
              // Check against global used AND already collected this session
              const key = q.question.slice(0, 50).toLowerCase().replace(/\s+/g, ' ').trim();
              const alreadyInSession = allQuestions.some(a =>
                a.question.slice(0, 50).toLowerCase().replace(/\s+/g, ' ').trim() === key
              );
              return !usedKeys.has(key) && !alreadyInSession;
            });

          allQuestions.push(...newOnes);
          console.log(`Attempt ${attempt}: got ${newOnes.length} new questions, total ${allQuestions.length}/${count}`);
        }

        const finalQuestions = allQuestions.slice(0, count);

        if (finalQuestions.length > 0) {
          // Mark all as used
          finalQuestions.forEach(q => _allUsedQuestions.push(q.question));
          // Keep _allUsedQuestions from growing too large
          if (_allUsedQuestions.length > 300) _allUsedQuestions = _allUsedQuestions.slice(-200);

          _generatedQuiz = { subject, topic, difficulty, timeLimit, target, questions: finalQuestions, count: finalQuestions.length };
          renderQuizPreview(_generatedQuiz);
          const shortfall = count - finalQuestions.length;
          if (shortfall > 0) {
            msgEl.innerHTML = `<span style="color:#fbbf24;">⚠️ Generated ${finalQuestions.length}/${count} questions (topic may be too narrow for more unique ones).</span>`;
          } else {
            msgEl.innerHTML = `<span style="color:#34d399;">✅ ${finalQuestions.length} unique questions generated!</span>`;
          }
        } else {
          msgEl.innerHTML = '<span style="color:#f87171;">❌ Could not generate questions. Check your API key or try a broader topic.</span>';
        }
      } catch (e) {
        console.error('Quiz generation error:', e);
        msgEl.innerHTML = `<span style="color:#f87171;">❌ ${e.message || 'Generation failed. Check your API key and try again.'}</span>`;
      }

      btn.disabled = false; btn.innerHTML = '✨ Generate Quiz with AI';
    });

    function sanitizeText(t) {
      return String(t || '')
        .replace(/`([^`]*)`/g, '$1')   // `code` → code
        .replace(/`/g, "'")             // stray backticks
        .replace(/<[^>]+>/g, ' ')       // <any tag> → space
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ').trim();
    }

    // Strip AI-generated letter prefix like "A: ", "A. ", "A) " from option text
    function stripOptionPrefix(t) {
      return t.replace(/^[A-Da-d][.:\)]\s*/, '');
    }

    function renderQuizPreview(quiz) {
      document.getElementById('qz-preview-title').textContent = '📚 ' + quiz.subject + ' — ' + quiz.topic + ' (' + quiz.questions.length + ' Qs)';
      document.getElementById('qz-preview-list').innerHTML = quiz.questions.map((q, i) => {
        const qText = sanitizeText(q.question);
        const opts = q.options.map(o => stripOptionPrefix(sanitizeText(o)));
        const expl = sanitizeText(q.explanation);
        const letters = ['A', 'B', 'C', 'D'];
        return '<div style="padding:12px 14px;background:#f7f8fc;border-radius:12px;border:1px solid #ffffff;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:13px;margin-bottom:10px;line-height:1.5;color:#1a1a2e;">Q' + (i + 1) + '. ' + qText + '</div>' +
          '<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:8px;">' +
          opts.map((o, oi) =>
            '<div style="font-size:12px;padding:6px 10px;border-radius:8px;line-height:1.4;word-break:break-word;' +
            'background:' + (oi === q.correctIndex ? 'rgba(16,185,129,0.15)' : '#f7f8fc') + ';' +
            'border:1px solid ' + (oi === q.correctIndex ? 'rgba(16,185,129,0.4)' : '#ffffff') + ';' +
            'color:' + (oi === q.correctIndex ? '#34d399' : 'var(--text-secondary)') + ';">' +
            '<b>' + letters[oi] + '.</b> ' + o + '</div>'
          ).join('') +
          '</div>' +
          (expl ? '<div style="font-size:12px;color:#6b7280;padding:6px 10px;background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.2);border-radius:8px;line-height:1.4;word-break:break-word;">💡 ' + expl + '</div>' : '') +
          '</div>';
      }).join('');
      document.getElementById('qz-preview-box').style.display = '';
    }

    document.getElementById('btn-regenerate-quiz')?.addEventListener('click', () => {
      // Save current questions to used list BEFORE clearing, so new generation skips them
      if (_generatedQuiz?.questions) {
        _allUsedQuestions.push(..._generatedQuiz.questions.map(q => q.question));
      }
      _generatedQuiz = null;
      document.getElementById('qz-preview-box').style.display = 'none';
      document.getElementById('qz-preview-list').innerHTML = '';
      document.getElementById('qz-create-msg').innerHTML = '';
      document.getElementById('btn-generate-quiz')?.click();
    });

    document.getElementById('btn-publish-quiz')?.addEventListener('click', async () => {
      if (!_generatedQuiz) return;
      const btn = document.getElementById('btn-publish-quiz');
      btn.disabled = true; btn.textContent = '⏳ Publishing…';
      try {
        await setDoc(doc(collection(db, 'quizzes')), { ..._generatedQuiz, published: true, createdAt: new Date().toISOString() });
        btn.textContent = '✅ Published!';
        document.getElementById('qz-create-msg').innerHTML = '<span style="color:#34d399;">✅ Quiz published! Students can take it now.</span>';
        loadPublishedQuizzes();
        setTimeout(() => { btn.disabled = false; btn.textContent = '📤 Publish'; }, 2000);

        // ── Send email notifications to eligible students ──
        try {
          const dept = document.getElementById('qz-dept')?.value || '';
          const year = document.getElementById('qz-year')?.value || '';
          const sem = document.getElementById('qz-sem')?.value || '';
          if (dept || year || sem) {
            fetch(`${API_BASE_URL}/api/notify-quiz`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                quizName: `${_generatedQuiz.subject} - ${_generatedQuiz.topic}`,
                subject: _generatedQuiz.subject,
                questionCount: _generatedQuiz.count,
                duration: _generatedQuiz.timeLimit,
                difficulty: _generatedQuiz.difficulty,
                dept: dept || 'All',
                year: year || '1',
                sem: sem || '1'
              })
            }).then(r => r.json()).then(d => {
              if (d.success && d.sentCount > 0) {
                const msgEl = document.getElementById('qz-create-msg');
                if (msgEl) msgEl.innerHTML += `<br><span style="color:#00f3ff;font-size:12px;">📧 ${d.sentCount} students notified by email!</span>`;
              }
            }).catch(() => {});
          }
        } catch (e) { /* silent fail */ }

      } catch (e) {
        document.getElementById('qz-create-msg').innerHTML = `<span style="color:#f87171;">❌ ${e.message}</span>`;
        btn.disabled = false; btn.textContent = '📤 Publish';
      }
    });


    async function loadPublishedQuizzes() {
      const c = document.getElementById('qz-published-list');
      c.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:12px;">⏳ Loading…</p>';
      try {
        const snap = await getDocs(collection(db, 'quizzes'));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        if (!list.length) { c.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:12px;">No quizzes yet.</p>'; return; }
        c.innerHTML = '';
        list.forEach(q => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#f7f8fc;border-radius:10px;border:1px solid #ffffff;flex-wrap:wrap;gap:8px;margin-bottom:6px;';
          row.innerHTML = `<div>
            <span style="font-weight:700;font-size:13px;">📚 ${q.subject} — ${q.topic}</span>
            <span style="margin-left:8px;font-size:11px;color:var(--text-secondary);">${q.questions?.length || 0} Qs · ${q.difficulty || 'medium'}</span>
          </div>
          <div style="display:flex;gap:6px;">
            <span style="font-size:11px;padding:3px 8px;border-radius:6px;background:${q.published ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};color:${q.published ? '#34d399' : '#f87171'};">${q.published ? '✅ Live' : '⛔ Hidden'}</span>
          </div>`;
          const btnRow = document.createElement('div');
          btnRow.style.cssText = 'display:flex;gap:6px;';
          const toggleBtn = document.createElement('button');
          toggleBtn.textContent = q.published ? 'Hide' : 'Show';
          toggleBtn.style.cssText = 'padding:4px 10px;font-size:11px;border-radius:6px;cursor:pointer;background:#f7f8fc;border:1px solid rgba(0,0,0,0.03);color:var(--text-secondary);';
          toggleBtn.addEventListener('click', () => toggleQuizPublish(q.id, !q.published));
          const delBtn = document.createElement('button');
          delBtn.textContent = 'Delete';
          delBtn.style.cssText = 'padding:4px 10px;font-size:11px;border-radius:6px;cursor:pointer;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#f87171;';
          delBtn.addEventListener('click', () => deleteQuiz(q.id));
          btnRow.appendChild(toggleBtn); btnRow.appendChild(delBtn);
          row.appendChild(btnRow);
          c.appendChild(row);
        });
      } catch (e) { c.innerHTML = `<p style="color:#f87171;font-size:13px;text-align:center;padding:12px;">❌ ${e.message}</p>`; }
    }

    window.toggleQuizPublish = async function (id, pub) {
      await setDoc(doc(db, 'quizzes', id), { published: pub }, { merge: true });
      loadPublishedQuizzes();
    };
    window.deleteQuiz = async function (id) {
      if (!confirm('Delete this quiz?')) return;
      await deleteDoc(doc(db, 'quizzes', id));
      loadPublishedQuizzes();
    };

    document.getElementById('btn-load-quizzes')?.addEventListener('click', loadPublishedQuizzes);

    // Admin: search student quiz results and reset
    window.searchStudentQuizResults = async function () {
      const usn = document.getElementById('reset-usn')?.value.trim().toUpperCase();
      const c = document.getElementById('reset-quiz-results');
      if (!usn) { c.innerHTML = '<p style="color:#f87171;font-size:13px;">Enter a USN first.</p>'; return; }
      c.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;">⏳ Searching…</p>';
      try {
        const snap = await getDocs(query(collection(db, 'quiz_results'), where('usn', '==', usn)));
        if (snap.empty) { c.innerHTML = `<p style="color:#fbbf24;font-size:13px;">No quiz attempts found for ${usn}.</p>`; return; }
        const results = [];
        snap.forEach(d => results.push({ docId: d.id, ...d.data() }));
        results.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
        c.innerHTML = `<p style="font-size:13px;color:#34d399;margin-bottom:10px;">Found ${results.length} attempt(s) for <strong>${usn}</strong>:</p>`;
        results.forEach(r => {
          const pct = r.percent || 0;
          const date = r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—';
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#f7f8fc;border-radius:10px;margin-bottom:8px;gap:8px;flex-wrap:wrap;';
          row.innerHTML = `<div>
            <div style="font-weight:700;font-size:13px;">📚 ${r.subject || ''} — ${r.topic || ''}</div>
            <div style="font-size:11px;color:var(--text-secondary);">${date} · Score: ${r.score}/${r.total} (${pct}%)</div>
          </div>`;
          const resetBtn = document.createElement('button');
          resetBtn.textContent = '🔓 Give Chance';
          resetBtn.style.cssText = 'padding:6px 14px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:8px;color:#f87171;font-weight:700;font-size:12px;cursor:pointer;';
          resetBtn.addEventListener('click', async () => {
            if (!confirm(`Reset quiz attempt for ${usn} on "${r.subject} — ${r.topic}"? They will be able to retake it.`)) return;
            try {
              await deleteDoc(doc(db, 'quiz_results', r.docId));
              resetBtn.textContent = '✅ Reset!';
              resetBtn.style.color = '#34d399';
              resetBtn.disabled = true;
              row.style.opacity = '0.5';
            } catch (e) { alert('Error: ' + e.message); }
          });
          row.appendChild(resetBtn);
          c.appendChild(row);
        });
      } catch (e) { c.innerHTML = `<p style="color:#f87171;font-size:13px;">❌ ${e.message}</p>`; }
    };
    window._currentStudentUSN = null;

    /* === LEADERBOARD === */
    let _lbResults = []; // store for PDF export

    window.loadLeaderboard = async function () {
      const c = document.getElementById('leaderboard-container');
      if (!c) return;
      c.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">⏳ Loading…</p>';
      try {
        const [resultsSnap, quizzesSnap] = await Promise.all([
          getDocs(collection(db, 'quiz_results')),
          getDocs(collection(db, 'quizzes'))
        ]);
        const quizMap = {};
        quizzesSnap.forEach(d => quizMap[d.id] = d.data());

        // Always rebuild quiz filter dropdown fresh
        const filterEl = document.getElementById('lb-quiz-filter');
        const currentVal = filterEl ? filterEl.value : '';
        if (filterEl) {
          filterEl.innerHTML = '<option value="">All Quizzes</option>';
          Object.entries(quizMap).forEach(([id, q]) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = (q.subject || '') + ' — ' + (q.topic || '');
            if (id === currentVal) opt.selected = true;
            filterEl.appendChild(opt);
          });
        }

        const filterQuiz = filterEl ? filterEl.value : '';
        const results = [];
        resultsSnap.forEach(d => {
          const r = { docId: d.id, ...d.data() };
          if (!filterQuiz || r.quizId === filterQuiz) results.push(r);
        });

        if (!results.length) {
          c.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:30px;">No results yet for this selection.</p>';
          return;
        }

        // Sort: higher % first, ties by earliest submission time
        results.sort((a, b) => {
          if (b.percent !== a.percent) return b.percent - a.percent;
          return (a.submittedAt || '').localeCompare(b.submittedAt || '');
        });
        _lbResults = results;

        const medals = ['🥇', '🥈', '🥉'];
        c.innerHTML = '';

        // MOBILE-FIRST: card layout, no grid table
        results.forEach((r, idx) => {
          const rank = idx + 1;
          const pct = r.percent || 0;
          const color = pct >= 80 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171';
          const date = r.submittedAt ? new Date(r.submittedAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

          const card = document.createElement('div');
          card.style.cssText = [
            'display:flex', 'align-items:center', 'gap:12px',
            'padding:14px 12px', 'border-radius:14px', 'margin-bottom:8px',
            'background:' + (rank === 1 ? 'rgba(0,0,0,0.03)' : rank <= 3 ? '#f7f8fc' : '#f7f8fc'),
            'border:1px solid ' + (rank === 1 ? 'rgba(57,255,180,0.5)' : rank <= 3 ? '#e5e7eb' : '#ffffff'),
            'overflow:hidden'
          ].join(';');

          card.innerHTML =
            // Rank medal
            '<div style="font-size:' + (rank <= 3 ? '24' : '16') + 'px;font-weight:900;min-width:32px;text-align:center;flex-shrink:0;">' + (medals[rank - 1] || rank) + '</div>' +
            // Main info
            '<div style="flex:1;min-width:0;">' +
            '<div style="font-weight:700;font-size:14px;color:#1a1a2e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (r.usn || '—') + '</div>' +
            '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📚 ' + (r.subject || '') + ' — ' + (r.topic || '') + '</div>' +
            '<div style="font-size:11px;color:var(--text-secondary);margin-top:1px;">🕐 ' + date + '</div>' +
            '</div>' +
            // Score
            '<div style="text-align:right;flex-shrink:0;">' +
            '<div style="font-weight:900;font-size:18px;color:' + color + ';">' + pct + '%</div>' +
            '<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">' + r.score + '/' + r.total + '</div>' +
            '</div>';

          c.appendChild(card);
        });

        const note = document.createElement('p');
        note.style.cssText = 'font-size:12px;color:var(--text-secondary);text-align:center;margin-top:14px;padding-top:10px;border-top:1px solid #ffffff;';
        note.textContent = results.length + ' result(s) · Equal scores ranked by earliest submission time';
        c.appendChild(note);

      } catch (e) { c.innerHTML = '<p style="color:#f87171;text-align:center;padding:20px;">❌ ' + e.message + '</p>'; }
    };


    window.resetLeaderboard = async function () {
      const filterEl = document.getElementById('lb-quiz-filter');
      const quizName = filterEl && filterEl.value ? filterEl.options[filterEl.selectedIndex]?.text : 'ALL quizzes';
      if (!confirm('Delete ALL quiz results for ' + quizName + '? This cannot be undone.')) return;
      const c = document.getElementById('leaderboard-container');
      c.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">⏳ Deleting…</p>';
      try {
        const filterQuiz = filterEl ? filterEl.value : '';
        const snap = await getDocs(collection(db, 'quiz_results'));
        const toDelete = [];
        snap.forEach(d => {
          const r = d.data();
          if (!filterQuiz || r.quizId === filterQuiz) toDelete.push(d.id);
        });
        await Promise.all(toDelete.map(id => deleteDoc(doc(db, 'quiz_results', id))));
        _lbResults = [];
        c.innerHTML = '<p style="color:#34d399;text-align:center;padding:20px;">✅ Deleted ' + toDelete.length + ' result(s).</p>';
      } catch (e) { c.innerHTML = '<p style="color:#f87171;text-align:center;padding:20px;">❌ ' + e.message + '</p>'; }
    };

    window.exportLeaderboardPDF = async function () {
      if (!_lbResults.length) { alert('Load the leaderboard first, then export.'); return; }
      const filterEl = document.getElementById('lb-quiz-filter');
      const quizLabel = filterEl && filterEl.value ? filterEl.options[filterEl.selectedIndex]?.text : 'All Quizzes';

      // Fetch student details for all USNs in results
      const usns = [...new Set(_lbResults.map(r => r.usn).filter(Boolean))];
      const studentMap = {};
      try {
        await Promise.all(usns.map(async usn => {
          try {
            const snap = await getDoc(doc(db, 'students', usn));
            if (snap.exists()) studentMap[usn] = snap.data();
          } catch (e) { }
        }));
      } catch (e) { }

      const medals = ['🥇', '🥈', '🥉'];
      const medalsBg = ['#fffbeb', '#f9fafb', '#fff7ed'];

      const rows = _lbResults.map((r, idx) => {
        const rank = idx + 1;
        const pct = r.percent || 0;
        const pctColor = pct >= 80 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626';
        const date = r.submittedAt ? new Date(r.submittedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        const bg = rank <= 3 ? (medalsBg[rank - 1] || '#fff') : (rank % 2 === 0 ? '#f9fafb' : '#ffffff');
        const s = studentMap[r.usn] || {};
        const name = s.name || s.fullName || s.studentName || '—';
        const sem = s.sem || s.semester || '—';
        const year = s.year || s.academicYear || '—';
        const section = s.section || s.branch || '—';
        const nowrap = 'white-space:nowrap;';
        return `<tr style="background:${bg};">
          <td style="text-align:center;font-size:${rank <= 3 ? '20' : '15'}px;font-weight:900;padding:10px 8px;${nowrap}">${medals[rank - 1] || rank}</td>
          <td style="padding:10px 12px;font-weight:700;font-size:14px;color:#1a1a1a;${nowrap}">${name}</td>
          <td style="padding:10px 8px;font-size:12px;color:#6b7280;font-weight:600;${nowrap}">${r.usn || '—'}</td>
          <td style="padding:10px 8px;font-size:13px;font-weight:600;color:#374151;text-align:center;${nowrap}">${year}</td>
          <td style="padding:10px 8px;font-size:13px;font-weight:600;color:#374151;text-align:center;${nowrap}">${sem}</td>
          <td style="padding:10px 8px;font-size:13px;color:#374151;text-align:center;${nowrap}">${section}</td>
          <td style="padding:10px 8px;font-size:12px;color:#374151;${nowrap}">${r.subject || ''} — ${r.topic || ''}</td>
          <td style="text-align:center;padding:10px 8px;font-weight:800;font-size:15px;${nowrap}">${r.score}/${r.total}</td>
          <td style="text-align:center;padding:10px 8px;font-weight:800;font-size:15px;color:${pctColor};${nowrap}">${pct}%</td>
          <td style="padding:10px 8px;font-size:12px;color:#6b7280;${nowrap}">${date}</td>
        </tr>`;
      }).join('');

      const generatedOn = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Quiz Leaderboard — ${quizLabel}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; padding:36px; color:#1a1a1a; background:#fff; }
  .header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; border-bottom:3px solid #92400e; padding-bottom:18px; }
  .header-left h1 { font-size:26px; color:#92400e; font-weight:900; }
  .header-left p { font-size:13px; color:#6b7280; margin-top:6px; }
  .badge { background:#92400e; color:#1a1a2e; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:700; }
  table { width:100%; border-collapse:collapse; margin-top:4px; font-size:13px; }
  thead tr { background:#92400e; }
  thead th { color:#1a1a2e; padding:11px 12px; text-align:left; font-size:12px; font-weight:700; letter-spacing:0.4px; text-transform:uppercase; white-space:nowrap; }
  thead th.center { text-align:center; }
  tbody tr:hover { filter:brightness(0.97); }
  .footer { margin-top:22px; font-size:11px; color:#9ca3af; text-align:center; border-top:1px solid #e5e7eb; padding-top:14px; }
  .stats-bar { display:flex; gap:20px; margin-bottom:20px; }
  .stat-box { background:#f3f4f6; border-radius:10px; padding:12px 18px; flex:1; text-align:center; }
  .stat-box .val { font-size:22px; font-weight:900; color:#92400e; }
  .stat-box .lbl { font-size:11px; color:#6b7280; margin-top:2px; }
  @media print { 
    body{padding:18px;} 
    .no-print{display:none;} 
    tr { page-break-inside: avoid; }
  }
  @page { size: A4 landscape; margin: 15mm; }
<\/style>
<\/head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>🏆 Quiz Leaderboard</h1>
      <p>Quiz: <strong>${quizLabel}</strong> &nbsp;·&nbsp; Generated: ${generatedOn}</p>
    </div>
    <div class="badge">${_lbResults.length} Student${_lbResults.length !== 1 ? 's' : ''}</div>
  </div>

  <div class="stats-bar">
    <div class="stat-box">
      <div class="val">${_lbResults.length}</div>
      <div class="lbl">Total Attempts</div>
    </div>
    <div class="stat-box">
      <div class="val">${Math.round(_lbResults.reduce((s, r) => s + (r.percent || 0), 0) / (_lbResults.length || 1))}%</div>
      <div class="lbl">Average Score</div>
    </div>
    <div class="stat-box">
      <div class="val">${Math.max(..._lbResults.map(r => r.percent || 0))}%</div>
      <div class="lbl">Top Score</div>
    </div>
    <div class="stat-box">
      <div class="val">${_lbResults.filter(r => (r.percent || 0) >= 50).length}</div>
      <div class="lbl">Passed (≥50%)</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Student Name</th>
        <th>USN</th>
        <th>Year</th>
        <th>Sem</th>
        <th>Section</th>
        <th>Subject — Topic</th>
        <th>Score</th>
        <th>%</th>
        <th>Submitted At</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <p class="footer">
    Ranked by score % · Ties broken by earliest submission time · Exported on ${generatedOn}
  </p>

  <div class="no-print" style="text-align:center;margin-top:24px;">
    <button onclick="window.print()" style="padding:10px 28px;background:#92400e;color:#1a1a2e;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;margin-right:10px;">💾 Save as PDF</button>
    <button onclick="window.close()" style="padding:10px 20px;background:#e5e7eb;color:#374151;border:none;border-radius:8px;font-size:14px;cursor:pointer;">✕ Close</button>
  </div>

  <!-- ══ FOUNDER MODAL ══ -->
  <div id="founder-modal" style="display:none;position:fixed;inset:0;z-index:99998;align-items:center;justify-content:center;padding:20px;background:rgba(30,30,60,0.5);backdrop-filter:blur(10px);" onclick="if(event.target===this)this.style.display='none'">
    <div style="background:linear-gradient(145deg,#ffffff,#f8f9ff);border:1px solid rgba(255,200,80,0.3);border-radius:28px;max-width:380px;width:100%;padding:0 0 32px;overflow:hidden;position:relative;box-shadow:0 0 0 1px rgba(255,200,80,0.1),0 40px 80px rgba(61,90,241,0.16);">
      <!-- Gold top bar -->
      <div style="height:3px;background:linear-gradient(90deg,#ffc850,#ff7832,#818cf8);"></div>
      <!-- Close btn -->
      <button onclick="closeFounderModal()" style="position:absolute;top:14px;right:16px;background:#ffffff;border:1px solid rgba(0,0,0,0.03);border-radius:50%;width:32px;height:32px;color:#1a1a2e;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
      <!-- Header -->
      <div style="padding:28px 24px 0;text-align:center;">
        <div style="font-size:11px;color:rgba(255,200,80,0.8);letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:18px;">🌟 Meet the Website Developer</div>
        <!-- Photo -->
        <div style="position:relative;display:inline-block;margin-bottom:18px;">
          <div style="position:absolute;inset:-4px;border-radius:50%;background:conic-gradient(#ffc850,#ff7832,#818cf8,#a855f7,#3d5af1,#ffc850);animation:spin 4s linear infinite;"></div>
          <div style="position:absolute;inset:-2px;border-radius:50%;background:#ffffff;"></div>
          <img src="data:image/jpeg;base64,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iumJLASWwAO1zembZSN6Od7aOXo13szz9PE8msXzdjeDPbGjfLVSia5+b3c683bniz258/plqay82PV5bfVjPaOfLvxOllM+X1+TU36fP2l3iyJjejPPpzrPbms9M4ejIFms0AWWKZLLgzy78qvTn0N3nlOuLT1dvi69XD6PyMznrcZx07uOhnk68vr8/meyXvy1jnruzvGtZsmktPH5PsY1Oud4xee+nLeenn1qzEXOkUSSW3O7NM2WbyKWXl1Zs6saltYjV49CfJ+v8jpmDpnTNAiLTnz9OU8+rjee/bx9Ma+54PZxxrxk7c7CEFAA9Gu9645a66OW+mq566aTPbPQY7cT5HThOPX178/fnvDWY1lqybllojny63Tya68LPR18neOmNzOvP38+rO/Pol49OPTWZ5PX4q7d/N6opM6WU553im+e063G5bLk3LIErn1zDSU3x1bnOO/FcduHZcb6cY1183c8mo9vn453yy6Ljh168Zjpio3mx1l6d+d8/X2OXXGpLkuN6JNWXMzx1PRLyRmlWDctjC5XVxU1ZDWGlWC3Kyc+tSOeZeu+FO3y/o/N3lTcFhqpalhpVz5/VlPC9fl6Y9H0fidY9EzrUQlUKsqSyPsXte/PlroMa1UzaFg34/X8vOvHLnn01vnT278Xo566Y2zrF1yOmsaipg1w9OLPJr0cN516PF0zrvz6TNtxs8na+fWfR4fd4a69+HeXS3Nzz6wxGLN757XfTnuMaZTdSWRmkaFlNcOxOV6YXnqK7ydI8vbGLLy78fVxxx78bNJOHTDW9XgudY6enjeeut59Ma16vJ2zdKlazC6izWuSX0ePr0OWe2ZcYu7PLv0eet6zqI3lZLizWuebnszc7s57TWRXLpzN2LL8/wBvi3mpdS7xuAltzZdJSsjUU8OPo51jx9OGt49N4dpbZpQrKyP0JO/LSCgAWaM/E+n8rGxMbNI59JD1dvD3xrvNMa5tDN1Cgx5/VlOeOmKvXz1e8shx7c6nj9fi1n0duPaXpneo4dYOWNFupou86jO4s1nWZcyjHSAUVDNaON5rO/Xl1l8y8T0cXTvz48fofPamFuO2evl5dc7323z1y9WOW+LWqbxI9esWMdWUu8ams56JcXPSyCVKHLrmvNz751md+C573jvO+3m76Tya74mpnWbJevOXOcLL05Wx5PT595lWrYjV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lmgw/uXbUPvuOu/l+sfPLvfbfPvqggv/AH328IJG8oILf32IAAB+IC534KoAAIIII5bNo6gAAA04ocgIPet6BT/675z95723/wA80+8s8oCCR/8AfewhQlbxjjl/bzz8oAGtE3qgAAAAAlgniuP6AAEvO89/oA1bfr/F/vvtcQggtvPLrecffqAgglfe8y/wgtfe/ff/AEAAAQ4wM4IAAAAA6rsaiND8AAAAAAQjsIfYNf69/wC+vtIECKe8/fbPCSMcOOCRxcMtCCCC999rGzCAGeh/yAAAAAEKbDAQzCKEMMIcoAA2IVipQs++++38888t5r8X+zPCCC888OsO+pVJCCC/999reDPLVOKENAAAC7rUtNASDk51/wD/AP8AAL4e++pS9+7888/089v7t8se1iCCG188l6Z+r3pCCDF/99dubBtNAAjDDAAZV4ZHwAAyUCX7zwgfiDDDDDDS5j8887183+r88+tuCCC48MV0fp+CCCNNc+pxDtcpJBTIPf8A+BVKL/x6BCAAH7f4AABFRjfaQwwww9HPPMcdbN+/vvuPPAtvd2stvqfiQglJfvKDQwdAYgggmrPWz8QAOdSAAAAP/wCADXhY93++gPMMMMNLDAALXyxm1Xy3j0lV5deWL576gEFX/v4hFz74IIII0lWP1aoAAACAAABT+gBu2pb5/f78MMMM4MMMN33zw+2377wzL7z98bk7/wC+BqCBc8++e+++RCGJXT9F3uuAEeIDAAMf/AbDQgAQ9SVdDDDNvDDoC888n+f63P8A3/lbfshju7vvI0WQfvvvvuPvkTFf0SYVOUF8snooAFP/AOAANVMAABcMMM0Qr7+p347TzjrZl/7vpXH/AO+Kev4wADDCCc++++ls6+97jpEIAAd8p2vgVAAU/gAAAAEEAEgDDdliAWr5f2tjLRR18h0vz12++++7e+++++Ic884+xh+jSLJljHgA488jeKA9AAAAAAAAA/gANDDRZgEI8+6LJkI7e3RZiyIYr7f/APyNPvvvvPPPPPF1AQpaj6YXuIAAA/KXuwAEyAAAAAAigAAAOaQvRP8A/wD0wutUMUeG2eS2umfa2788PE8+8nDZ888n+U4Dc6zAA+qAAELR+vgAAA1IAAAAGDAAAAl595Uof7Whe88oeoa6O+KCeWx3l1//AD38H7jdn/vN/vvtCw3gFI4ABPqwOwAAAAANTAAAAAAAAAAEoAH7/wCSFbYJzi4hQg1IpLKQoNtLYNb7X5IJ97z621/7/wC+qejGAA4GjOAAEMAAAAToAAAAEAAU/IAU/wC6HKo1v87bBAENDmmkrMGb75vPfr/hnvff/PPDHvvvoqQT4AIzHp7XjnwAAAAFQAAAP6AFNdyP/wCD1HaWK8I3vSC37/mPzSrFPuz04oIJb6/75zzzzo80837yoAQYKsI9j7MABLsB1z8gDegBn5WAAQ79u5LB+oG1BioX0cD8Xef6vFD2457777v3n/8Av+++6xCCAA2WCCC856gAAeuI/r3vA/oE9ioGdc4hOtZSBXihUQIWNpVvnop7LFRO++r+++cp+6+73+++pCersEUCCCTUzAA3f7vArAzxxvUtdoyyyAA1m/Z5edeO0bI2BtvTivhRc9++++6C+62b++V83++/EhBEhDCCCCmrKf38v3ALAAAAa/8A/wC8x/P9jS5fzGR6/wBb0oz7hzL4ujD+Ip+++uCeHw+sZnf+/v8AoQQQCggghvGYMNfOS07YwAAC7nf43f8Am7/+REE15i90rrrZxR7ldTclQfbrb4/777/Lb7/rZz774EEEW08sJXz0J3zzOEAAAAAC68KMP/8A08f7oRSveGVISxuZNj40P8JMraJO+++qS2++26yWq9+8+BBBe8888888888nzAAAEAHA+q/Lj/x84f7s1une+56NuU0y77COANZrdBRy++Ce6++KeiGO337uBBD6M04MM0888n8ju+rWuAAHP/8A3f2sv/4Uryw742JG8lv8eg7AxHJibzFVwjinQ667n4vu/rmIwQfHXvKKlkvPff8A752vv66YZb93/wD/AP8A9b9aunSaj0i4I7Nu6F9FgbAOAZ4k4pVpYr7745797CEIIbKaJJTxiAzTzj/vzz27/wA++/n/AP8A/wD5c8VKCDAByNAkhTEnhaamjG3yUrFe++CeOW/7ef8A/LAggghHfX2vPODNvg03LJ9PHqut730oEP7f68vUq3yy6qKwtMkKAhuXsfQG7+vnt9+/7uv42fvvrrLAwuYjuVvODJvtvrvvs/OfPHPPPI6BP/8A+lPwmC2lijC1o1mavB5LeWDQvnv/AOe80+sedBl++8+4WJ4y15ACIWfz++/684187888+PfP/wD/APkc/wA5eIdVeVhHqIdvsvbR3xXAdSSzv++8Xv8APOvjPvPPvAo/fUBP+84QAfhlnLNfOfn8mgB/f/8A9J7zy2bDVrdFW3VTmxZgnjweZoXD7z6UHm5z7xRT/wD842pHB993yBAAABVG8XhRb897eOPA9/8A/wAN0vq9z4/3mTphgjySMjWPXU3rQQzyxwUJZ7/zy63/AH83eJ8+u1448Bf+72gopABj892e2+L9/wD9/wD/AP8Af4EAxuY7JIKcWj6+fZgxkoD5ttfLPXJ+2H/7q3nftAtPo/PPYBcwQANyPwAS/PrffGl+N6AP/wCgDACz49e82RkIi6Elal8ILL/Se/vzV+v79/vf7xTzoILTz1bSoDEFaoBWrEQjVTz/ALnrZAfAAU/oAEc73siy/wCTUcV/e3NCgAlJ/n875/vv3/vr9fedMogmPLdffLjCAFoCWgiVKAQvFuq0wFP7DP8A+ADT76Ol/wCYf1JuKsdWuEqpRW8G+d3P3/f+34qCCWiGx60uUZd9d2AAVEMWpQBzc5ugAHAU/wD/APDAAABDKBODzzvPuvtC+B/uVm5zz7zzz5/v23yyQIJYJY37jCkX31/3UAUKIOEBXbl4MM0fV/8A/wDwABxRT0wg1E2CgisRTHncHKU3PsfPPPPPPA1PONQggggveH+qQffXffelTm3AQY/IiQGjbvo1fzbUCDjrzwS+qtfNB0hPRf0ElEU5LGPf+9FGDnvLoAlz/ebK7vbRfffffflfvqwGUrNfXBk4ZhKfLJZeXTUi6UdcTfoQL5BiWISZuIFOsREvozjk/r/M6n4FF7qupfvfffffYH/vvvriOPO+5gbLxZz07xO1SAcVVifvjsv11lklpSuYG3TSOWm8Ycsfvi9vmr1Pv/8A7K/33nGSADb777qmNSyoXqVX3FXrRtNulEuFar6pyHWPvuFs2mA0/wDwsxBnb+OrTX2oeiASy+++++/q5e8gAAV++4KbY+a1f3C9n9xGU1YC0TwBLPyXpzjQgQxtldq3znNEFjtd/Px+f8ymOGOCe+++3I+8AAMAAA+6TyQHOy8l0m8of/noSkgLLqWJXdyyoAAQwwQp2IO55wPq0V+EMPApErAO7N//AP406bvIABPiAAAH8B6N4L8OWqsW6BLnatYTeDpkaf38yEMoBEOR0RVZhqxHQoif6ccBXiHvs+8sogghnlgDJKLgAALSuQAxKfKN+rkc5MGi7GcSvIF9t7LedrkpPENUiKlTlGNJyvbfZt8FkuzNigfSgg3t3pHfwlAHFAH1eiPqMOahud1Bgm8gtXlDPw1WXTor8ddsu74OBgaPNdEhbkbKLxrDiEH7qv73/wD/AO8V9Kq88NDXndIj0UdPwrxQdJZ674SA0J6iu0XId9zNNr6MwceY0yppDmKKUgWTn8xPX9y8MCOy2+V99MSgwENBBRigAUVfDp0aKb/j6rzmdHvKdpyfhm6kz9BiVnec8J98Ex7i2OQx9z3VzK9zN9Gq+d9999XCC2Jd3j4aTc9wPwboJrLaz/LECtBv4w1G7lqcUkE3ZHf+dkEB6nWteR+UWp3n3Sgfi2lq9yQz3YcoYHDzwPLcghEro8+hSdQuc7YDeee83FXWt0myMZtw0XHH03DKHNbSSNY9Nrhj4I//ACv3egQiBeX/AAIYbZ1X9z2Xg3XLfO7YZYoPSwM0RoI2oGszMMBGEHFP2Md2CxWI32UH8g2muPDDCx7XmEIKngrZu1NGBfQNfzyqyT4uZ4oed6RppRrz+ehe2F5Vp5p9vC4RxS2L1tZHUZ3yjY5yB777752oIEEBZntHxreAS4YgRer7oRfrBz23UcUMiHa9VD9oxuDE/wBuyOTgprw6cTLWv9HWTerONFOy2++9Mxlak75qpCa0LSyeYOAJ2/hOOifkTbv7J05Njkpmz4O1alI4afx43qLOwtLnCxmZrws/x/me+Jv323NXlnX2wTd/caeqgqd7SoL4MguLnGm+78HZKLAlXVSFjYRTDr7xFOLQCXOccOt3OyX1be++3CgDurTymR5Hkm7tFIpcjj9Sv+I3ke4D5IHFoXF6+4DDl60gVN5r+bvGs9TPDvkOSjAHqTVemlWwGryVCOJ1EUgMdktyCi2C+Gnuy/nZzRDmyhtKqbkGJDnztR9SGOdnu2R2Pe6BVIJ+OZNIzLj7Bi3OAAI5sWrDUl10LPes0q/BMKCioMwuKCq3gKxAgzIKiHa/K6E6OUKfMayVuBR181LObptkavFIm2hKfk7DO13sw5Gfb7LAmq8Ff/x/rPy9iCWsuqVy239k/ASdvFCtyrY70ulw0fWOJ2J6hK4GZYAzFBKZicv6V0WIrHq2y65J2zWy7EQ6JiOK/wD3SWsz6QOSOWmbMHKTaGOnBo7bml9ogwbJbpSM8LRKOv8AZ9xzy+s9TE/+gP0V9CD6VF7plb7o3X2Aw7nJ/ft7RmWU7wwN07VBdBooxo/6oNcCUJKNfDk+45QIKUNZIU4rYtl1inqEjOKA15iBcCpKJ46I7F35N5Sq0kOS1lOPGuSikq0Wnxzr+13eC4Lee+wvli8AJehpcICa+twD1+nV5e4nXVsl4L6sTHE5jFBS1MvWOs8/yYs817VnG4n3lT6azw+1gFaOEkG1RuaL0Fth/lknyMDOeeG4Yjz2B0n3X6wYm2oxAFIv+v4QOTHfT0b48ycsPq4jydy2fdkjtxMCYJe9hoakEW1D0LqcPjjrvfOXCBbFTj1gDDa2XrcDn2VFbIYPUNncQ541K2oqhDhw706VbWNmlIHCgIa/SyYgXgPiCKme7Hh3xP5TkZnRGw3fICF5nEd/KWYEUVSoHDugsPz83YnimLPKca1DwxIktnwg6NxOO3UX2ivC5k0VlCvEe9RnxlAeiDk5lbM/+UpfsgSy2fAcFWnUyTP4uIxhN7DApd8CgqyhKgPJl67AhHMELwbW3JpG5mY+mMk5vX/QT8PCnZZZ7TsQiGpxeHA+Za3h7b72yFVN4YwDsogxAuDvYGgUH5tfmqPof5CCgP8AHVTaQP3RHagE4q8djbVoIWaMrax1XtDOGm9OZU19QBp21a1po/trUywToBhSeZMtD4dLBkiOV1/z7KOblcb3AqHCX7bvi5a20egwBVwFzHE/ru6oEU6ixJuqYCP2o7LColwXNlxNIG3KBajm0M7+iill2cro08zGwki1Wp0DDiPHSub6RSGA3DeYhVje3xMsTjZ7j8jggtMKLAP3hAVvR/kxlyzMAqj8hN5FHCgs6Egx6stF+/BfeOuOMoQynnP4eekBTWAYcYTPzHKRbFgYzhFIqwRAARKh+J7RtNtOOv8AUsrr795eCZlHDXdsFMwJvnvjPQjVtboXWvjpQ/wIKuCgffz9LELBamZjTOpQTwdZ+3P991F4kiC/XQksl3VyyYvAUBZG9ez67SDi5rLoRlMjPdUCfzMJViIOsC8LmEAEkn0LcFySzSTYFVdkxlg40AMV9LkWdfFMle9495/rbA9XQTbXX5l6vJP3XJgwpHcGnRIwQkgIGAhoeVyxNq5y5dQ1L8zSj0nsFFoVbDklqtMDu6ix5xEOT9VGDXPywhLekp/dqtXhFaF8zGa+2nBvCHoW4GHVXagCeM73HGLsIzvbMwCT5TSSG1hBz/8ARoRhbMwgNoRP2AADCQS/M2LF4QM/+WaSQLfcp4IKvxVboTIOD7/xOeQ4EGp32yI6CqQtdaWVX9tNN2CiTIoQ12y1io/o02/2i3oM9SvgpB5tMXptKAAcDAPgAAAMyhcz/ka8kTOtLeq/gcG4fQX9DNQ0/dZGftcd2V30FHHUEHkHkHNk3cOf9h6pqZI6kv8ATLkpUIADD8G1IHkub4AEvuGG0yxFjm1DkgS6U2RXUsyWPOOTajS2IQ88OwMM4G6iY2SyCeKWq+wsIQoAAEjLDd5ICvUqXRF5JnIjHU3o3xEfOyRBVJUAPCSi61Cy8i2yeM6CCCuOCAU4gsMEc8u+uqQASC8IRhFARtOpCTlEXJ4VdkgfCfVIx+2TrMxEIYxtAA4gAAAIDG188U6CiCSyyuKIwwwASCCCGwxHO4AO65BAlsbzG7goeh3PdCTXm4ai4ekHgYWxFAA8MMAEK/8AfATXfTEIDywwwww0lKBAgAAAAAAgQCSiii5RMKVXl45Y7KbxZeU8niyhGf8AoEAMYAEUU/LxAMP3yn/z3mgAIBBC88sMMMMMM+pgAAAADdWZ4REcTb8FlhSsvICJsHzoibkMSAF8AChAAXBDTyKDD6nKY0w5LQp8zPf33GQzzihD7+88vGHHAQ9OPQR77/CnNWOmH5TXWwNXkzh8qH+hDE1GAAAIJ5krLKAQQgRQiCsMPwoKAAABDDsQ0AAAAAAQFagMMA35520kjKMr8t0ddPxKx6YXk9lqAAAAAAABwgkHEXX2kaTy5QMNDzoQAAAACEAAAAAAATz6jTBuNHzbUPAxk0svQi1UWutIXTR6wnwsUk0kEHGHWjAp4I01zygpwMMPLwKUwAABAEAAAAABzypLO2023mipDeOxzX3239casSi+xYJfzzzP/v8A35owAAACeLSy1wQHDDTjM1xMBd997gQx1nHf3/hBuayMdhEmk63Wt+yG0I0gCiHNgASmtKyNIDNw8AAAAAG+t7nPOe6iOVl8xHDfLBFc8gAMcuqxtLB+mN+yxZ0ArF6hdplm0AI4xqgACvKAYJFJpNAAAAAAAWs5IAAASW+89x4W+a+ueO++SOudtN5dW++DnCWedYbUOKOttlSy3dqgAELGU+/qJd8xgAAEMBRlWOIoAAAAczzjH1199999w1m/999/CvMno+pKP+1V4HMiojCQtauPhsYZmOOku/6YBRgMJ/D0vJx8/qUIAAAcHKJBY9y48++6FVDyvbqTmMAFgiTByq1/D42xLYN9/wDrK3Es/extJdeLk+1jwQABW4AByM+YAABPgU4hLfUpD0Enrhlc/DXyg2LwMcOUYUhbEMKpIX5jurun37f/AM6rOehPc/8Az6KMEc8AeDx1xAAAUsD4OwyVcOQB6X5RI4f5gzOq/8QAAv/aAAwDAQACAAMAAAAQ99x99iDDDDc86AADDDDDDD0X3REAyYOWsBRE9Cc2w/mf7/8A/wD/AHw+IDHTfrDDDDTYADY95f8A6wzOLXfffLDyw1IQlHAQwwwwwGovKB3Mouiw31UF/ODv7/8AN1//AKOy9BNNL0//ACwxiAzAww/qU1P/AN1/84wz7jLaoemXGiMMMMMJ6YwzUENChALoMPzlbzD/AP5Cy/8A8I//ADz32F//AP7DD8//AO5gw0vQQ02f/wBj332YEPn0ql9AAEMMNBjHCqwMMMaEQFsAPeke8/b+/wDc/wCkaqRvPlPvPHqAw0vf72gxA1uTHKPf/ev4Iw3SOz2gAAAABmBNGnX8Aw07SAlO7Q1e36vNv/8A/GRMPXTz3jYY5n70MMNT/rIj4MHT/r9vH8MMMcwSv7IAAAAAK594CgSMMMMMMNMGoAWgXb977/8A/wC6RDx/vO7lyQ9c7/IS0sLOLgwwwf8A/wDtJyPDFsJTugAAAAAq1jqD/wDAUwKBBDA00clySS7P/wD/ALu888sfd28W7+dDDDW++8U//wBVCgwwff8A/wDv/rX5RyCgBAAEWTzo39DUYz88/wD/APsM7Nj46tDX+rzzzPzzn4o3yxiOEEN3D773v/8AA2oDDIH9/wDyb8jm+UBJignBITfixqAw8TC3P/8AgNDAMMkMMMBSvzzxtXxb+rzz6XgsMdd2ylgyusMMMtNjefICzUzjAIAvzqj/ACWd/EwHLDD3u7DDDFFIWNqDDDDRXc886iXs+q++8c+qD433713/AK//AMMPXf8A0WOEPcwDDDDX51B/wBB40jDDDH//AOAwO17jDiiw4wwwwwM4yi9PPHQlf9esJn/Nklze/wD+wYWtSz8paT/8MMMMSu/ej/4EEEGYMMNT/ANi+lWu/L8cMMMUAMMMMY1zwr2Hz6/7L7zNYH0Wj/8AjqVDM9//AH//AP8AFDDosDRAl46BBupRDDsf7jMDLhDRJg4oDDDsKJBqU888n/34uOOuf9p/91t2s70AC5H/AP8A/wD743/JVikdIgBbKT91bDKDA/8Aww0FkAwxwAw4Vs6f6gIP69PPP92Xv9uYnrn/ANl/e1yogwMfT/8A/wD89O/ynFxFoQTxrT94QUgwwOwwwwwwywxUww57Yw1bjeu77DAjrgHcvrs/f/8A/wD2cvv/AD/7BP8A/wCr7T/VQCcgBFJBbd9JbTBpDDTjDDDDDXYDehDKKhIs9/PppO9AJ8qO552Vmqv/AP6sv/8A/wD9/wDP/fftCw07MioNvEQRUNfn3gQULAwwwwxRA4ww+znLQX/695VxCHGU6w2dJNIHPl//ACmR7/3+XJnz3+//AGUM8sOBBWrBBRj3appBBBmDDDDDUvDDDD21hyUu9vHEkfg87tLKyox4YcWY4VzxOawuN7l3/wD3v/L0B/XQTJ9AQXgxgoQQQQQZrAwwwwwwwww04x9/f7K/CdFnT4XcMQUfKqU1CNsTm/1VxeRnv/PTVv8Ah7/g6OPYVgIM2kE0kEEEFAwMMMMMsMw+wNz+surjtUkkrGOOOw50s5l1+AkP4D858V9Xk7zzxx7/AP8A5KwTSVYxF4kPPLCQQTQRgwww3wA0MtoV+w7D2zWpEeMJUS85lQPNa82pOfkzTHNfzn+3/fffHD3MMvPS0UgiwgUvQgQS+CXJDww/wA80cQwxTftGkPuG1WCbXn24ksi+ro3Jctffff8A+/p333/5/wD/APd9+ffywggkPbKiQUXPae6NOx3wELiIB3nOcoESRhbGsKRkOIINGGZq+iCyPf8A+p//AP8AOf8Av/b7f/8AeVkpb7FCCChwDBBNGbsjgpwwwfYsdAzx/LDiz4xVtwMQjZRXKH1HrUHf6cx//wD+TO/OG9/9fGv/APJ2EGS2MIIILLoOGf2NwOEEEEVX/wD/ALwD+bwPax86M5NQi8WGzYmdebuBF0L/AP8A/twdJT9sZ+68dP8AoQQQCggggLe4ELffBUnYgQQRrVv4HP7Sf/ziCR7Db/eC04Tzb1AZjn/gr19b0v8A/wD6808m518//wDwQQQXgQQjvbBLPfVYAQQQQQfeI4gv/wA2nX1o9syNI2cY8faRS2nBAtL1zjP/AP8A7Wd//wCUnEin/wDw/BBBE9999999d99/OBNBBJGB2D+YC/lf99zUj7L9fY9DkRv63SD4Vz/RYcc5/wD1IWe9/IRXLV56KwQU3QPeQANffff6/LDZl+gQZHP/ANz8yP38OjaDxWpnChfw5Wn9J6tGs+fnyowBTW67+9bj+7z8SAEFdUNXlKL73CzPDLz5n6wN/wA9c/8A/wD/APc/KvW30IT8Daf2PQ4HrhQNxyOKMNZ/v7R//wD3fZvPG4Qwo+pIf/bHMPfeduvffPec8PnHO/8A/wD4H7z7ItTKlvCbCk57/cpZCs4kla03/wD4fXdctnjz/wDgMsMMu339r33nDOHz2VnzX13z02VnkuP+79nzxq4Vjexy9IXlk1c9OQ+IW+D0V07rI+f+FgT/AP8A73vSA/MpOV/fVr/tLE3OHffP7/8A/wDvCMD/AP8A+6VT2kSSnhsQgoDxepoZ8fmrMpZz/wC6y8seDO9z/wD/ALhScwfT2Mdvk/H7osTa5T3/AP8A/wCzKSb9/wD8Qlfsm4M64+CdMyES9yuYVgTT4FH+/wDb3/ivPPP/AD7zz6yHD310Uf3m73jHfOWjz2ySTisEbz//APH8/wD/ALYprrKkML8Wf9aLDNP/ANSQA/z/ACDn5HONX9O2vPPtwD/fe/XPffdN8fWvKU/aCQ1HAfP/AP8ACc849sat2s9qsm5ffVACy+Ra17xo/OQiD80zuesRR58j8rc/3NOEq89+502tI98L9sts4ti8/wC//wD/APx3IEegx5Wg3jODVf0yavKuprb2x8+/O36YWqsAh76sjU/pW6lfvxO99w0/98u9vMM9I2gf4T3/APA2A6/z1o5/A63J8V1HQPrDI2+/vvMXv/3nvt/vF/oQw3PfQmdffzrVfe9+edfHfZ240gw94w/PwAxX+rlU+aP9ZMgkQvy/fNmxHr9po3/6m/8A+c1+/sokXP2n2k5PPX3l/wAn+191o+921iUDE/M8/wDyw9/7026HnaCyqvI58HupIKK7H9DR/wD647++6EMMnlVw5S5YM81uT33p32923j72DTEEUtD/AP8A8IAww0dcGMobSVAtliEC186lDKfPPfPPGvuFfPhwwwaUfF+vCGvabc+9yLvpdPZF/PeRwydb/wD/ALDLCHOA2GktIkmOyRZFL6ACSzDe+0888888DD8+0hDDDR14+5o291fd9Yp3slW4S9zCh6oSFzofqhLF3HlmyInLh7k8fNCMBOIwxbPaiw2iZwWn2883DIt/m7jp84a99999Y3++p9p/wPEl/jio20V/ptwdNEhI15l3lmQEPuFTbzgH/p4XoqbRtoW4e8Kbljz78IpH7P8AfffdXXfvvvAZ/RtQdq4eM0Kdc349rPHsrh73lt/MKz9zFjwROdoz/HYMrg89P+tz6zrfzjvwes/dfcH/AHT77Dj5kwyNM+CUzk5zFmuZpFi0OCLydK4Rix4xaYenbPfdOS7FAQ3DXUH+35n3/wD/AP8A/wCQxSyf99/+8a5Wytt4zJh8WSnGVqqBvwFiofGcGPPcwyxd5+ZQJ4aEjqAMyoUCqW14y09wf/8A+/rfoffc/fbfOGj+NyiAQfc26ql81FoOqUiN3iZdcSAAEMYQX66Mg0LTiCede9YGNUPOrbnTzy3WUr4XfeTN/ffdXs/P8ihWQdGXvOpIuFYmKQU16fcMwAEgBFnwlC+qzL6jGI36J5Pzn63f/rQQUQwye4fczGNvfZS564I80eaXLbqTDpmPcXBXdYLI9yh5IUv9dE+l+C9r/wAHQr/mOfOS1esuCznaEkNzyYML391b3FiokGbcnkAC1Of0LceqsuVTe/8AZOHPMZ3PjKt2i4+VcEQox7LhT8LkRSby6+Pf14E//dW99eL2HQXE0KP3d+TdxlTtWgoXqBTF+sCddbSa9tZiT+3tYJE4ye8XU3X68i0+SCi7Ie1woMC52U999MYwa4uLp1IBCUAbC31D1PsmXLyRgzt4CkevGyrBSNcoJVEKOORt4X+Tp3gzpeK91YTwxDNr+99999Z7PGWwGkjYRMqqo7WHJKy3yamx9/tZMKlxVFxm+v47UxrsBt8HmMjc9mes4rkk8K8MM12s969+6m6aG7fTvd9vucF7PPgoLbejIhWcYR6zfTyI9j/J7psphX3lehiDqTIa5Iaf8DRn+6s/i59u8/u9QqFGXiFHTs+olZKamHXihrDzLhNxo5Fgy7NxpfHPEs0zZ/VfpaCuCIP5fpROWg1MywcfV5c//wD+Tc3GK5KjcIUsVysoM06dh9nd3ZR7EVsGfQ9RgOijbhzfbLRbvOx8GlVDKB/K+yw3f/8A/wDfu/60+Ka3hCqw2Zm9efit2Ve+SIneRXZG+4ptWR8S867s9EheOkZYUT2k5e8JX00NKHNPQ1i99/s18dp5lN7jX16H2jsdz74M0JwIWZCp9R/7mkgp3poItlUBQJuG1boe58YZBHqs73KJ5mJq6Ycf/wCpeimDkW4G7Ns+DtRMb+wDyICanYKl15piJmE68SiwVj1Vpp/yYlK4lz7gLYgqsuc4V+n4hp3/AP8A0fMYLUFAeru7Qz5GHHAPuELJRg6YTkNVFb08YS9UBcB4pdSBqS7/AIs52vzIc56Idxm8xyGofdgHeJHCfoldBypa4kIMjZLYcKUn4CnrrKKh8kOkPJih/n636D4fjo3rd1Ej2j7vveDXoUbjMbwgyqPdl/vs9dc/sqwjCU7SR8Lqos7jPdYW79Ubhl606P46u5otgSYs3WFOlIglmJK7eYS4HiLsHq9ZLfXSPLd/cd/06WFcXfRcYXt8Lx7VWYudrU93Vs1DJ8XkGUvCr7G3Y5tZFWMVd9cA7y6j/GnmmZyug28V/X4jCaWbxcZw6vkAcP0o0MTwEuu7pmCCHo1yilWLLPVfrYkfiOvJq5pMhM6x/f79eVlqqsGxSRh87/NJObZ2g1qe3S8gIrtEGpX6SbkAHYijlZULSu54nETBnyhUOfEx9AoiWcj9BbG25ctVZIO6EGUmoxB9NBKZEqFqk+bw942KefWS+GJIDnVW200N1J3tXQmueYLfoSGn2RlRpE4d23LOH2o9CorTGCLdmbVqGs2CJc2De9IFum6wLkOeB1QwjnbiARKshakxZsHF0CDwYuvhTIDsB6Bqqu2nN4Fwg+TFCZfcRhYnoi/2Cp9qGsJ5fAtclNpa8dz7Vgw8Sqch4qzU5F/ku4xOA22lATpOLr2WVJ5jiPxAHqhNq5zINGjPLXGI/iHlyWmYHrgo2FLjHaDwrnJcyBmvElMGvG3j3okrLyx8f6CVwVgqtyI3sbiTfdwi5M7KVqVPxVVQ0bps/wAWFr1n393Z+QyVCnDCwWLhgr2h1rpku91MHcV8e+wPB3vgvd3JTe+HIerrLIWi3miFrSTNcoCfulRoC76qJEhSdfGSREggCRVim9ZrqyjA2N2pPgDdiIxzfZfDttZ0O+s49RKESNBRGrtbJlAUiLtRVHnt7Vu4Y7IHS+LL9ALf0e2EZlf+UqLRog5wyrPBIN3z+sQ/AZn4EFT0vEvg8MC3uKQvO7JRDdOrGWg0L2rokLD1ezGjnOifAEzCsjYJOH5fgGiChLvA+jSLlPCHcix4MqwPhm3eb9LZxe0qhrxJ6OFunKc9F4rXoEXErc6HPGeUP+krbgfcPcUQy51P5T7FK++Wm9dkFKcRnA1PofKnY50zB/HWq6tBIMM4BIbErjdu1MRR8ahloKdvo0oHHfh27jOjrRKlZM/d7wOfbJ4X3vyINlbvjTvXcGPjFieds9VtRS4ZpOLLD5nEL+S8/OOwSEvvisD8aw8h+UUhj2nRL9tS5NAXplvlZsMNF9w+/iBkLHGt3NZPb9MAzUtYQ4zrANV6SXV/4xXvfMujcUkge/xAIC82Iv7SJWz2zTCopLYjwoAR2id3sflSWt4N1N3LaVxH84ibx39s0sEM7NUukvj1/skwQ/J0CcyFw0cpCjpRQ/mAxahI2uFQ6H1ierMta/RFUrBtmEIkuXh2PIMVNw4tkH17jcqwVceu0Y1TdyWGz8gcZf8A6x/XeExR62wYBe6wApoBenV2kPeV9EB2vk7gt5FBLSIVNjYLS0bOgOppHDuvZbo11+0uGzUrm7w+7M2iA+JIrIO5SI9clDDUxw/ZwJcx6F+F8GNT3LwqkrC98spuvuR7PZ2FPqj9PoZgrbM7vGS9nGPjk86j/GKuI5d1cs6tQ+yQPvi26KnnPKmT6bjxha7U9YxZzH8M1Uc9pIXpwfAP2OtCE1zp5Jua8/QebWYWp0LebGwfMH7DQCA5vRvn0GoOhmZr7ZNBwiWEFE8S5aBrnQaP9CubHjbDhRdNBVpLAUIrDRm++rmLrgKpp2LaSGDBlSGQUSZHU7oQgZgEqMWbee+uWVFQej3aF4z3z2DOBQlN+ivPp/RFXzvpH7CWYM2IgRDyO2aDDHNZ1nt/ge26OYF5o2TrR7ZxRS3S+0xEG3WRkOeKqDIf0uwP6tntBBNpNPT3qu/kctv5lXTHrBarCCGDWV52wiTdqC82lVB2IE6ONvRgegDGFMhJ++WcCCAH+/f++x3P/wDTSAGJDv8A+21/EEEX+7zHSfwLuoNKWrWSlopenx8Q3ISsrz8el+MJ3Oyj74brLxaO/wA9BsX74STw3/8A/wD/APf+oS6www888P8A/DtdgHRh9Os2scT8ib5RI0gu+HxAHIjwwg1vbCBYStNf/tfacPbHaPOgEEPON/8A/wB99LNUM8888rmQV8LCUmbcToLkel10Cn+lCG7gG7oZMCCtU9suuIXMOPPU+7wBTn8c8D5FPPCHPjHZRLAQwk/vtMBAIcIvefweEgqnICfAd1lqc+OrED7ACCo4Pe++scWTk/tdv2w8VJL8/wD6d+3PPPPXb+N/PPPPPJwP+ASLSa/d6Au9jACrUpSc4+F3UXiekBfvvvvvvvqrG81z5XKTx/rR/wD0z1bXzzzzxfzzzzzzyf8AM+00YVQsEJni45AKltfpge/74ErLkdMqUzz/AP8A/wDc8FGuLtKNN9+upf8A/wD/AKL/AGMfPPPd/PPPPMH/AP8A34PueO/ucPdtnKkIYgGOAKRWUoZUXe+uMXGCdzGu+++JP2f+xyQY/wD2cQiTA6nvudfni5zjXffQAbm87m9Cp3sZnmecaWQhQpx96/vuJnekAwgdjgvvvvvvO0CFvJedn81olcL4xbQwwjmNLTWBcrTgfNjHMrwwYMvvmSovtgPqXCDHvqHLCNKBG3W/vvvvvvvNh9vvvrl7T4DK1TSTHHrrjgfXXnjtxFjPkUQlOo3acTK1ulnaLQaDHvt7hLjPiiAFn3vvuts57dy0FvvvvKTDHbF9/wD/AP8A+8M5/f8A/wDsM6AFq8GKp89bip9d915LMmtZOZ+02+SpF/2ioze27FfNc0d4hcu+++8h8Iy/Y/ynP4hBecF3pYaxxoDSiAYWy6yQ1FeKu7ONj9/fVKLJfQdS41sSy7iI99ted9QJcve++sv+G7lY3bdIjO0oMfrggYT09cDX0yCqIT7WfeRHbympCcL9ZASHLyNlmnmNxOz58/p9ts7uD+++4s9eDJsXPzrWN5wHGsLwz3Jm/8QAMBEAAgIBBAEEAgIBBAMBAQEAAAECERADEiExIAQTQVEiMDJhcQUzQlIUI4FAQ6H/2gAIAQIBAT8A/ch/qrDIqyTsrCxaY1hPKeX15psfJWW8Lry25k/j9CXikbUOP0NNYQ2XlvxUWbUV4W30c4UqVCWGhIk/jD8UreG0N+HGHmyxvKw3Raxa8Jd/ppDiKJSxeJYv9CViSRfhz9Ci/nE/gRXi+yKGUxrMez+/Bt2WxL5w0WXhxyu8u/CLy1f7G/Bu/Lb4LjwoTy2kN2Wi8WJ4khdYTG/PrD8HydPN8iVnzmSsarMVhtp4kuP0WWX4N/paTEspHWEsyjY00KJtQ0lhLEhfx/S8tCbxy2bc0UWj58JY2s2sRVvMlhK/09D/AG08P9DPjCGx8nS/QiiiimJeFI6zXjJWKIxF8vwfT8kl8m3Nl/srHwJ3myyxsTzL6EiTxFD/AF35vv8ARbLeIkqtCd5Y78F945eG/wBi8EVQxKxrycjl9j6NrKZHor/8EnRz43l4aWF0NOyOWy0xprPaxZf66OBWxuivB4fCxRRQ3bEv0NftfQvKmUzkpiRLrxbNxyxqhco2o4P+Qzg5L8UisVhp4tULxZuZ28WvstfZLrFl4Xk14Vh+DaRuRIXjVvyl1hZfYliRE3LFoZa8VycLFFeG1jVC80sPtkUTwucrzaKKH5UMsWLLLEsJcnA+HhvCGzcyQusN2JjQ3+isJfo6fg8LL7ZDon4rxvxb8rFEas2sp4rxtHb8F0Pt4fRZu/TRRRRWaa8nm/FuxkesNJnTKGheDy3QmPrzUa/a8VhxEiXXlXhWK8a5sasfHm/Jo2eEu/Cyym8oeL8EvPkXnbY0JpYbrLd+KL8KKw08rseENVl5fm2Xhuhcu/GKrE8XihREs1Q0UUcDO/0SfGLwnQxOhuxRNq+zbikPDxWUhtZXWUSYsPv9dYk+csUWxJIsTGqeUhJDeWvGijobvxv6G340xRw3Q5Mj3h9kesNY2nGbb8F1hDdiy0LzrxfbF5y7EhRHxl4X9rzfJWLeH2Wjs2s2m1iVF5l2RWWhDZeNz/S0Mrxa+fJPykvnMVYxixL6Fh//AIqX6o5fWKZLjxpDVPNPDbF5tUy/1uKEqw8oS8K/XRWPgeKZT8bvO0SrybvwSrDwleWuP0uKF43l4Tw83zwRxRWWXZxisrkS8GIaPnD/AGuvGOHJZXXg+C/0S78lhiSGLw+ReT/yWbjeKVlrKy3ixsrD/TITaLZyxKikbUUjbi2+DZ/Y1TH42ikxqmLyk+TsYsrC5eH2LFpDliPQh9nQ5McmOTHOh6gpnunuoWqhagpimJllFDWX1+ql57iJLsXSxJX5Iff6IkkLKGLrCHJIcm8KLZtZFiLJMbLG6RJ34WWzez3We5Ijq0QmpITLHh//AImiJJEb86H9C8EMuliOHE2s2s6GJ0N2IcTZ/Ztjld4ZJjY5USleePBlYs05tMjK/wBjbE/v9SVL9T7EWWLDH1iPb8Wr8EWXnsXbxJ0TdlkvK0Nll4pkTR6GhUPD83iPjuFyWi1+vs2s2lLwfKORKvB4ksJcD7x8DVZQ2Sk3ja2PTke3IcWNPL8FiJo9HYsWN/opDpIj4SynXjZYnh+b/TWNqH089uxq0IvkRN81hLHBcSSiyUBxKNo4m1ji7yjSeENiGv28DWNvjIp/qbF5Pwtidj6fg3WUSdyYhNm1sek/s2tDtFjKFEUI10PTi10S0l9HtxHFpiIOmQlaw8fHil4pHXhQxZbErH1mmU/F+K8kxqsbuM23mToi/wAWNidkWKRvJW2VxyNE9REZJiIlMt4aVDjWNB8vxfgh9+CfHg3RbOys9vL7wuj48WiisPzQ3b8ucTF/FjRdC1UKafRuZuRvNTUvhYTpog7oQ2JscFQyWND+WGIeUMTr9DaKZtzY06EqGxIeLobsUePC/wBb4XjEpYkanwf8RjGi6Z7rN7LY8XyacqIzNxuNzG0SmizQ/kN0mJp/rtItPEmLv9FD68ErxSLwojj+pqxFY4SwnYiXZP4H0MY0NYiXbocG0NMpkPo3NC1D3UPXHqN4iaPZrvdwaLfy/wBN4fjyxprwbEsSeUvF9i6/WheMcSZLtDGMZJYirI6Q4uhwJabo5THloSQkI0+mM048vPSNxbEvnDOSxvO1m1YfREffi12UxJLF5t4Tsk8vxoo68ErOMy6PlEsMYxminYiyhmokXmhIQkQ/ixkFmTWI+LawrZWWcvxas4Q2WWXl5iSy8VhYckhu8ooeWVyS+MMY0R0kV9FS+xuSR7k/+p7v2jUk5CKykIQmoxshK2J0bnhFHRaw5DbYj58l28Ws2i/JD68VlZWJd+LZ2sdF4eGSEJDaRvRcWVEnpRaFAlChIqyqZQkRVmtJJJGjzIUbRTGLKXziQkNCOS8y6F0PvKVjKj9EusLF4lhfOfl4fWay+/O3hDYx4aKLeHEcZG1kW0cMmrWEqF2UUQRryubPTv8AJoXWdrORJvyaLxdFo5bxLDsXWW7YsXntDVCvPzh+L6Ehi8FisXcj4GsN4oRZQ4kuBSaN14SEkNCXQlRqaDlJtGjoyi7f7E7wvF8s2vHVkX8EniyyKsl3jrC+cvLZY2IfOHl4WG0hysR8H2NYSJDbNJSl30ViejaNrVpiQ1QmsNkEJft7KZz4sireflCXNjixprMWlY3fh8LPxl4olh4svKxJO8I+RjRQkOJGPIkljgaJwTWKKEmKIkViXYnnjybF5XldDEXiztZQ+8/GX5Sw/CivBpYTbbxRQyhLlYeLN8bq0SXOUhIR8Yaspiw1bzRWKoT8WVjaO8fGaxY1R8PyebxuRvj9inFjq/Nzij3YHuI3olPjghlrwvhF3j/U/Xf+PDjt8JHodD1+vP3nq7VZTrkoSEsO0JplfpeG7EvJ/Hj8ZvMj4eYoeO3jU1Ix7ZL1EEifqZM9yb53MepL7I6rXyLXmhepmf8Akz+hepmL1Uh+rY/UyY9Rv5E0mhStGmtxrNKaiRfJYmWMkWyMhco+D/VvTas/U6U9rcFwzS04whFRXFG0pFCWGXtlR7iR7sPs92H2e9D7Peh9nuwPciKcRTE7w0+xYZR+RzhdYpY+PKXwLLw+sa2uoD1d7/InFxY2adEuyy7WNwmWXhVaE0jTZo1ts9TJvWbRpT3RTEx47GVhWi2NJiZZSNuHOK7ZP1UVxFE9ScmXK+WxyLZZZul9m6X2zfNPtmhrb1TfIus1EpiQmPDX0JUsd4fmvBIZq66jwicreIT+GOKsXDGKhMssQ2XhjZpyqSNGS9psm25N/wBmjqbXXwR6Hiy/BiyqxrayiqiPdJi02bEiQ4lHHjCW12aU1Jebfm80cLsbvxsbPUa6SaQ22zoRTTG3Qux9s5xw0iSpiaH2IuhrHyend6EkacYVwkeo0aqcf/pou44eLLwuBsTzupE/UTla6EnIhpktSCdDdsULJwZTKKzyJmhqOMl9Cdir9bPjG5Jm5Dd5Wao19dRVJ8kpOTsXA0WQkpcSNSNC7OpFp/OE6G7PnCrClR2zbFPo9JX5I1YS0pb49fKG1ODVdo0ZvT1HGQmPvyvFYol6eLd2bNppyjVUayj9G0XCGhxoYysPCken1bVPLX6Vy8SeadeWtqKEWSk5O2PFnTH2aU934SJRcZElyJIcc3imWbU0mSVMs9K6TY6nA0lSafwz1GhuW6PaPT625bX2i/0rGprRj8kdTUnJbYuhJodsURookhwNo4C0myWmxrGnNxaIS3RT8bRaLRZZRdG7h5Ssq0NV4TmoxbZq6m9lYZ8C5Q+xOidamlv+V3mxyvFoUkhyVnArQ3ZTNBfiab+CKkpyxq6NvdHhkHqriSsUr8qYlyT1op0lbH7s+3S+kafp0KCQ0qGIeaFp2e3Q1wTJFPHp9SnTy+Dl/o+JYSbEqLJPheGvqb3RLsbw5KuhdpDg0UVRpTUZ1/xZqLa8bGyuaGlx8kkvo+BC5GqwpM09WpJEHzeJido6ZJfKLE/BySXLJSlL+kQgQilhmrrJOomm27bZY3hkUIocSWnZODQ08RdM0dTdEVUUxuiy/Db9jEuGdZQs+o1dipDk8sXBZvXDLjJ8rklFUOJNuUYsrkTfBPl5StjVMTpjmqWElV2Ls05fijTqSaJuuCWptIa0J8XySO+Uy8WiUpf8SMPlu2JIjyJY1Zt2kONCmou2S14RjdmhrtzdvhiYyHZWWSjY4ko40dSmOaSshNSLHTKRS8YqkPDWES7LpNmtNyk3i3j4TRNc9YTppjlZGe5U+zpk2ttUR7GV4U+yKTsaaRFWmONc3iM5I9NL8ov7NeD7RrRUoM6do0NdSVS7JKnaN6N8m+ERQki8RjRtb6NfVWnF7iPqFJv4NXUTl2Taa7FC3RGEYS5IytD1Y7ttkJK0xR3K10NNYYySHElE5Qrlpvk0ddrVaZFprCTGsJOvB+MlbR6ifFEk2PO5kr+SsUdMaUkmT6SI9jItofLuiMbfQ4fRyRe1jaadkXRu46xfB6WfC/pj07T/ALRKL/OL+Bqmbv6IeoceHyhOEnaE11i0b4L/AJHptC475FJuklf0er9RD08KX8n0TubbnNj7ErfLGuexG5m+fxJjbTNHWem/6NDXaqUXaN0dRWiUWihjQyaHwzQalFoca1JNfZ6ae6CwneNrOlz+luka0vybHLg2klRGl2N8ipvkcF8FF/Q3bNKXaJt2kRTTJYXA3RafnHpnp+GKdKJ6mCWpf2a6qQ0q75ErE1GXY9SK+Reoi/hktR203R6H0T1NTfNPaibaSSVo1daHp9Fzkqfwa2tPW1HOT5ZcuiKTdM9t808KKrsuhJSXfJKEljR1pab/AKNLWTSlFkdRTX9k9MaGsSXBNGm5RuiUez0kmpOIhd+KQ8WUxpnJrS2wHyx6XFoakl0SdnLJJ438Dd4SRBcmr/MTdWSYuMSXF4Sf0PG7isfCol90aOptkrINPTgz1cb04yXwz1EeLxF0xtsXD6E6do9JoanqNRL4XbG/bioopRi5y4PW+qfqdSo/xXRHiXI4Jyl/fRe2Q5xlQ+xJvhDTTpiu+CU59MinJihL7IakoPhml6vTbVumQncUSgmiUGbETTs2jQ0RuE00QdrFZfY8MSw3j1ErlRLhnui1ftD0oz/i6HGUWW2QipSGmiCsdxZ2yH8kav8AMTZB9kVGleJt4029tWTUe1imkmdlsbbFKj0ct/pTUSnozVfHBJbotMnBwZCFxV/I4VIaS5IaUtXVUI9s0NCPp9JJRv7Ixg3e5n+p+pcq0YdfJTWFqdWyct0rym0ypSZB7Zcoahz82JvTmPWT52j5Z6XR0tSNuNtMjUVXwiOoUmicWhoaGime3Jvo001FFo3G4t+CXzlk3SbNT7HySiOvgjJpnE+GSg4MhOpDqSasg6kSfDRTNnCfyS/mRiufsXDE19YkoV4bbqmO+mJDwz/SJRlpTgz24xTpE1WpOL+GT0t18kVSS+iaTfRsvg/070y0Y7pL8mP3HO0et9StDT4rexTtcvmye5xfXGG7SVFdEopK0y6Nj457HFx7xykmSbbwk2elns1VfTypOJakjU0/oaFASojKpuIuvJ5b+hP7Ga+pzSZN2sKmS065G+TenXwbl03ZOFcrohqOKokr5RGbWNJvdRP+bFK+8I+Bq2dMaTcf8DjTE1VE/jkWPkltrrk9B6p6EpcWmiP+paUl00eo1Yy9RKS6eHjQSU1JohKE4/jI1tRaMJTk03Rq609WbnJlj6E0u80OvgU4uKRNJx75FFsoRqe3S2oR7bVcmjPdppvHwW7IzTVMnp/I01jWdOLRp/lFG0p+DxbKxqNqDY5ty5ESqi2LV6TQ9GM02iUHF4hJVTJxp2RTJIRpqpk1UrxTI4l3hSbpE3bwxcM3NlErTNNXElLVSls74ZTlsk1Qux3ZFNsl7m9U6SNPVmpcM9Xq62qlbVLC2pUafppakHJOqG11RGO7pDRtg0qselSuyqE1X9j05VZTx/klXwLUg4pNEfUvTVQV2en13qp2qrDZbIa1cMcFJWiUHFmtTiekm6p57eU8UymKBrRvTkv6J2mRnRuscVxZOkzT1GvkaUhwp9WhqnwJ2qZzFUQY0rNLsmucKTXQnieHXFYaazF0xrk1EpK7NF1qRvqxf6foSimrXB6n0b042naIr8qFpbnRpemhGFNGv6Tjgdad2huLffGEn8Gn6p6cNtFM0pQhS+X2zUcNROvjojOlTQ5RqqKFs200cr5G2+8SScFUeRwl9MenNK2jaj0XTw8w1drE46kbRq6L5o0ZbdRIXSG/DabUbSiiVUzW0ozJ6bg+VxjeybbEe4l0QkpmppHKY4twsj2TSNGrNRIeFiRap4TaZJykVTNqdcDSTXI+hyZXR6Z3o6b+4o9SltZ3qM9Popfky0a2qoRJve3ZNU6wpyj0ctml89WOCasj9DXPAnTzTZzG4vEJbWSld0U2uWPTX2elVJ4ZKQxshqOLNPWjPh9mt6aLakuGcqKx3naVlmtJLTZZKKao1dHbyh8C5GIhKpI3RumakUW06xH80aHyahRF8UJWMVXyhxT5SOsK4jFN1RdlfiMcfxuz/T5bvS6b/qj1C/B/4NHT3TNX1ThNQhTrsjq7oKRr6nuS/rGorOKooXMWiL2OzepSbfApNEFNq1Kjc332UyzSnHdVmy3L5ZSuhqnwVh3R6b+GGx4eEzT9WotR1H38jVrgYsPstDWe2eqmrUUWWOma2j8oqjnMZtPk3pklFoi1dMi6ZoL+RqHNH41/YrSGWOdo5bENtlX0NULl8DiyRHlUaGpq6X+n6jg6lE9F67W9Spw1UurtE/8A1Qk4mhpynO2a+sox2xIzd8imiSsguXxZSbquS3Gzls9t9rCbQnyabvhI2Xw0bdsuhTe62PtijJpsvmmbGKL2s0VUENj5GPHGPUVs/wDp6LXbhTZw/FDKJSSTZq6rlOTN8iOo0R1ovjpnZraUUm6LpjihodiX2Ph8OxPkT5PT9s1UmrE6ExEqIx3Di6NP+Q6XwPtibSLEJpKyTtkYvhnompaWrpv/AJI/06MoauomulRJbk0zUa04bY9s1ZtOjcy2KdxJNxYpybsZCTi7R7ib+icVu/F2bafI9tUiEnGXB7rdMckyUHVrCk0SIdHRD+Kw1hjwz1E7aiaGs9ORo6u6KYmmOOV0MZ6ye3Sq+WN4qSQuyGpta54G7Rq6PFog5JNDhauzYz22e3GnZGCsloOrR6dpT2s1OmPsWK4ISplx/JWI3sbvkjV8kq+GLFWyN2elm4ys36cm3GrfZq6sdONsnrScm7ZFKVuTGKTj0QlzQ9NyQ04vKoXY7wmk7o3EZq1Y5J/xJxaZFW6JJN0kL+KG7aI9LLGPE2kmyUtzbx6PWr8RMjK+GOHyhIQxnrtXdqUvjEaT5G0k86es48fAtSMhxizU05VcWbpR7NLWhT3DaaPkg7iiULdrsk24u+ymLspjQ19Ck1ZeKGJNmlW9WbU74IumJ8mlKkxSa1j1Grv4QxEUmNRrlUxkJtpKycbRCH2OER6ZFNMalf5GpFKXA2muhIpCi2VfZVEVbJKommrkhdZoY8epnb2p5hJxdo9NqKcEJEZ130U1j5NWeyDZqtttjOxaUmLQh8ti0IL5JacE+JxNjfVDWqvsb1I/LG1LtEortEE7pE9Nx5PTzv8AFjRqQpNjbRESJRHaGRjuHw6FbHFi4FwxSTTbdD7EaMbNSMo6ltEkNtipG5oWt9ob5Id5SHxmUU0bGTa4orgTaItXyOFq0RgaiqJoxe9eLGak1CLZK3JvFCPS62ySRF2isXYj1s6io/Y1Y9NoSUT3YUPW+kNzmbGQSsU6df8A+MlLTlw1RPRkla5QxXYp2qYm4yTRH8kmayS0yRHOp1hFWKlJWzrmI+xHGEaTpDalCn9Gs/yIwtN2bWiRYk5EYULooStElcU8fGZx+iLa+CTt2Lhlp9EOrJ8ujT8mj1Um5V8IibY3UlT+yUXF4j2el1r4fgj1c71Wvo3KPZLUT6KlJkoUJHC6ZbfyVP4om5/KNzNLXcHz0antz5jwxRFFPrsaPTO4f4Nd/iSk+iBWJRXI0JNuimhlvDVViMknyhtW6NL+JOclEcX2aTinyOraHC+hxadM03yKLoSo+MWyiVUs2KKlFGrDayiKEtsRmn8YfhN1Fsm7Hwe6+pG+LVNjSQpGjq1NEJWhDJSUYNk3uk2yULJQoTwq+SVXwLTkxRnE91r+SEtKfzyT0WhWmKmhQZw7T7PTcbkavRNJ8ohwy8N8DVscWvjEIKXZJJS4YuWMvCqjRacETjcGxdNM2oURJI1NK3aI8SRFqrTG6ZuIsazQrJrm6IS4pmrUkKHPRpxV0anfBJPciPjZ6mVRSGOjdTJO3xGhLUq6dY0/5xNL+Cx2esnWnX2WhypDti4JN4U9vwOeoPUl9l322LsWrL55IuMzZKDIN3RLTs07U/8A4anCL74F2R5WGmkL+Q3tu+Uyf8nxReF2h8X9FEUvkZoSfRuvTkhNJUIRQ7RPsTaY5SFbIN0hvwRdqhR/rMFSJd2xSUnVFpEXa8fVX8Ie9s2yfbFppdkI6ZptdGpoQmrSVi2RmlXNml/Ermiqs9f/AMUJFDRQ0Khbfkk0vmx9nItMT23TsjLnohOyk3aF8MiubNXmLGfImM7RONG5pUSe52UrRqbPjCs047rHpHtN9kYbaaHJJCUZLlGxJlpMTJjgn2S7NN0+hQ3t0tr+iEWuGho2soorERx5wv4oilVjds149NHp5WnmhmpG4se6MuGQ2TpNUyXpnXDJaOtD+JCPq7JT9RFU5Jf4NDQk5qUmQ6NzsfPJ6qNuLJFqhqx34NKux2W0PUk/ksUmumLUaNDVUuLI/RHo1F+LJ9vN2JkneKw1bFxIaTTZp6kVLkcopWS9VooXqdJkdeLHr6S7YvUaD/5o3ab6kRilTJcklwQ0FIno7aaEmyKZWJLnooaxEdUyPMqJfBGNRJwi0T02Q/Cf9MvLPUT2xpdsUPllJENXimPUQ5OXzRUVyel1N+qLpEyJ6hXD/BI7ZL8R94a4seKtksMvCNDXppSYiXRqp7mRLi10WQ6JJoaaLHbGNOzTkNck79uCI+n0tq/BHsaf/RHsw+EP02lLuI/Q+n/6E/T6UISaVEH+ETspfJpuPNFG1Cy1Y4lFCQ4ujT0/ztmo6NFtrkkUjX0Lj+Joybir7WLNSSjFijb3PsnCx6cSOmioIc4JGrrbuEf6bpXcsPE42mjV06kKNGoihjzbjRODlHcs/OUem9RVQk/8M+DWQm4imWRlQnZqRclwNSi6Yk6TRqX9DGKyf8Yf5RF8FnGGa6/9M/8ABGe2EBSvDl7U7IzTXnRRRRp82TjY5Rh8m+cmq6E8Siu8SaQ4SnK30OI4olSRPVgv+SJ6t9WzZqS+D2Uu3b+kehbVosdt9FI+jXhUrJEidXwUamZEJOPHwakaeKFpTfUWexrf9GexqruDKaZoau+NPtGsNCFF0ckZCkOpLklCcXcWSk6opDRBpSVmvVadfZHrNFGqvwl/g1E2kkac2nUuyLs1NJTRDdoSqX8RO8X5s048DHpq7fYhCZaJySYk2M1dWf8AxiOWu/miUJP+Vj/H4QtWXxS/wipSfLZCEY82enkt/jrRtDRqjVYkrZ8iiSQ0bHLgj6brcyMYR6iOTLNz+2S2z4krI6ftyUou0TVola4wqbVsctv4vEXXaFa6YpElGQ9NfDJJp41Hxpf5FdFs5xZqfwkT+Da3K7IatOmxTi0TjGSNP8HV8DdliYvCikfGJuhHByS9xvh0R0adt2xIkjYT3R6iS9yfZONdojtulBDnBOnCjdB9I05bZRI8pZZLkkqslySK5GuCS5KGiOi3y+EVGPSHeGUUULs+CcX9FHwPlkKdlJxtPDdop0QkrqRPpoZP/wDj/lYXhq/wl/gm6SEuCcDdqQ6I+plSsc9ysjK1zhNiwsIeOkJctvKE/GXXRz9GppaknxEfptX4VMl6bVly2haDguWUkaLuCp5YzXTVm1jQouySGjayGmlyxjRtH4tiYpE4pu0KP4slBVaZF0Jxb7wk2NDXBbTPbjNJ2kzX/wDWtK/iQvWaH/cj6nRfU0LUh/2Rvj9o3L7RqNbHyan8UbmjTkmyWnGS4RLRZpwr+RB1Or4KHwRkpCEIWWN/rfQ+hmoSPSTdbSqxJF2jWjcRo2lDRJWaemOJJDGhrFYa8uVfWExMjJpnY1+DNRRpNGm49M9d/tQEaOm1yyi1eGStxokr428idEJ2NJjgODIStDZucJX8EJpq0IQsyGLK87xJUyfJNUen1V3Xh0yatMfY8NChbKoaJRGiiihoY0NFFHGZRxFr5NyE8TT2vngrk9Xb04JHp/S8bpGyjY2e0zayjUtDk7KIT2kJkXdm3cmj+EqEnRKJBOEv6E01fgyQy8JfoaPgkNK2SVijteGsND5JxpjKxGJQyjYhxGhoZJeFDoci8VlMTsmhLkUbSIx4NqNqKRtVkkar4iMim8QmkuiErEzVh8kJXESGuCTnB8Pg0tZ3yxzpWaOt7jeJDF2V4osvDHiYlyjVVMtneEmPs1YWsUJc+LRRKI0NDQ0UdDJPFjZa8LNxFJvkihJrpC3fMTn/AKs3f0Lc+onty+jV0ZuqQ/T6v/UWhq/9T/xdRp8H/j6qf8WQ0tVNfiza0OLfFChKMqp0clMnGxwYukaENmpLD68L8ry8T6G1GrNaVx8WirRPTp3iCH5uKGiSKHIRJcEkMSGPCVs2DE8R1IriTaI6n1JMTbIqdiRQ0mUjjF+Ff0UikbV9FRNsfor+iojSKKRS+hqP0UikUjabEbUbEbEbEe3FntRHoxY/S6cqsl6XTarzcScaZAZWXmiRJEmMiPonj4yzRjZ7XA9N2Sg0RUm+Exel1NSrVGl6GEKbYopHBeKRSzSKRwUcYorDKw140bSn4dF+N/pnC0RjhrPfgzVfNYaEMmVbRJUNFDPSx5KJaNsXpo/ItKEOl41h4vktfZx9lHGasoZzng4KKKOccHHjtNptODhlHH2LyZaKHEY0UVhrEia5HlrgkRjyicBxGhLlWaUUoql42WV4tceFeT8aRSKRRTOSyzj6xX9stlv6Lf0Wy0Wvo4OM1/Y0qH14pWNUOI80NDNSI48YZ3Ea5IqmPokSR8mi7ghLDf6W+BHJS87LZf6ZUR5HS/RtQ1WLwhvwf0fIicbNrGhpjsRKURtMm8Sj9DI9DVCF/EkiUTaen/iL9Em0hTbHJibff63Q2q/UlWGv0SvwvwboWI/GNVyTTixxbVlX8knTHmZfI+RogicREESiSRRodCw/JqxafI1lId3lROcU80UU8WWWWWWMXJQ2bjcbiy2W/K3hD7FiGNX4F0NfkTrc8bWx6ZND4ZHlDQhoUSKpkkNNscWaapC6Of0yEWWNlC4LLWaGLLld+b5FwSlin+m/oi7y3R2iIiGNVnwK3bHESWGSXJKKIoaxwUsvCNPlD/VX65CztZtf6H3+uPQ074EmnhkRoRHsbJKM2nuqiWpXQ5yeLRYySJI6eKw89kk8aapDGq/TRWWvBZZz4tfoa/T8s6w3SE7xWEKSXI5OXb8N3i1Y0/opihJnty/oWkz2j2l9i00iUIyRDRVlVmkXRwcDSFwV5VaGq8X4cnJ/9ODgtYaK/sa/sbLeP/h/8Eh/48rZ2UKSLsXYirjRsZtimk2Ti4lobRuRvRvRvHNHukZ28t0W/BUhvksvK/ShspspDq8Xj3IfZ7sPs92H2e7D7Pdh9nuQPdie7AetA96A9eJ7y+j3ke8j3l9Hur6PcPdPeHrP6Pff0e8/+p7svrwpo/8AhTNrwlwQXIzUV6kP8Gu+aGPl+DPkZpfyWLG78bZf7roci/CkS6YoKTdntRPaQ4JGyIoI2I9uJsh9Htx+j24/RsibI/Rtj9G2P0Uvo4+h19FIpYpDQ8LvwbLbF00QJdk/9yBrP8xjYs9jTQyHZfGbRvN3gs/H6b/RLoT5ZbLeEKvOxDb8VhUWscIV3i3eV0IgS7J/7kf8GsvyJdF+FFslETcWR1YtDmbrzaRaL5/TTKRSGkllI2leL6F282WLEpJG8epSuiGopInNRVkZ2rJTaV0RluVjk7aIattpok3ZvmpUOUk0htpEm1QlJ5XCFnaznorhmmPsl/ux/wAGtyybpCxaLQ+isSimVRtHa+RSl9nuNHuM9yzejfE3x+xTi/k3CSooXjLMTchvxfQv5PEpUXiMixu54dbTT4lRq9Gn/BGp/BkP4nyxqnuRd0P/AHET4Vie6jW6iKTy1ZT+/Cj4Zpkux/7sf8Gt2anyKSN5uTZayxjKJtpkZXlujcLkaEhdi6zfhLrG0ncUO/s07fi+hfzeJdsWF3h8ao+mQ6ZNUotD5hZpK4GoqizTf4o+WKnEScZ0S/3ENWjST30a/wACkqs//8QAMBEAAgIBBAEDBAEEAwADAQAAAAECERADEiExIARBURMiMDJhBVJxgRQzQgZAUyP/2gAIAQMBAT8A8X+F+y/BZzhHLI95tD8O8NNvDHhX8C8kWhsvKWH35bsoryYliy0WjjHOUW89fjrCKV4bwmNqhYjm/BN4Q0UUUPheFCWX+JYrN5svwS8K/FWa8EPs3MQ34xQ3RfgisIbSL8NptRtfg+vN/jpeCV5uii/j8XXhfghplMpiQ14yIryrMRiw3Qnay1h9eb8UWWWPNG0pZs6zf5UvGy8vzfjuz0XfhTRuZbE7w+vBf/T7zwvx08P8DE8N2895vwofWLwstliY87mW/JD/AAob8G89nX5OUxvNlljYn4N5ZHyrx2o4ReHih9fgSRWJfktFt5rN+SxZeH1+Nus3hOsrwvNl4rwcl4pWsxWE3h9+KRT8FjjKzyymLF/Hg3hLweO8UUVhvzTo7F4ULDwvCXilbw0jgtDZHvxo2nCE7GvBHOLz2JVi/jwvK8X5+xTNpSJeSl4bkbhO/OS8Y+434x7w8robxElmmIvxXCG/C/Fea8bLzLF+KdG43CxHPRbI3iTxtKZtwxLk4Hw8JYYkURwsNYS868LGn5LweFnteFFYXglZtfikUs2NWKPhSvwsZdMteL7EMXZSK835tkR9eUc34t2R8EJstMfXh0hDxQu14N4RY2X4IfjQli8WWR78ry/Ni6xtKZTLwsPy48V755ZtKRxmXZVLxf4FEarySwmNN4SvKVeLK8rL8HhYk/bCy/NsvL6ykkX4Ia98uSNyNyNxvFI3I3IUixd/gWKw1YhoSrN4ti7xR7Zb8VleC/HWEPES8WJ+DY5eFl4stlimKQ3Yiiiikjj8bF0SwmPHGH4x98LDd+CfnfiiSF2Mfi2kOY8sXmhOhSFJCazTEq8GyxPwbwhiRtGV+CPQ0Ik/FeTVlc+VljGIeLSJStnsc5oWG/NYTE+CzcWy8X4LDHhYtFvwZyLwj1hu1+C/zPPRKV5vzr8HNkXimU8LN2JeNDylh5ixZQiT/En+B4Tw8LE34UdYea86ENiYnh4vwQ3414sfltYlTJISNqKRJVXkvJYeVlYnlPwUWKLNg4lMSKGuMUJZqhMjfuP8K8Gy2WW/BZj3hXiy8N2/BxrLeFlYYvJE+y8JWRjYoCiLTs+mbD6R9I+mOBsHEcWUxPFiI9j6/AkWWWX4peUe/FDdLwSofisoZ2xiwl4TQxCQkIS5EihrG02o2I+mj6aJaSZODiyrGsIj4LxfjXgnXlHvwo6RLKXuNkcvxseV5T6KWIoSErFGli8V4exwUasE0SVPwj+HhjWV+GjkSrxfQ+8bR4WX434IsvPZqFXRGNkIoSF+BOi8WT6NTsTGLtER+faKY8tl4oS8U6808t5eL8V2NWLxXhMStkVWN9CnEU42KSZZWaZXhM1exYVCdDfmmXlvMfwLgsvD8+lf4E6N3ksPE+zTj7nQ3hpnIm0RnYniy8WsyVo1IvDEhFfl4I43eK/GkSf5l4USX3EP1WHQ2kb4/ApJiSYlQi2OQ5SFqS+RajFNkZJobJK0TjTG+URx7eKXilZ1lDEPxvNl+KWKZtRSGq8UrGq8Uy8wRNfehYY4mwiqxEUWkNOsSaR9rFhSaYneNddFciwh+CH2IeL48aOi8oYuhYXY+/HcbjcNi7JYas6eI9EvOsaZL9lirHA2FCQoGnCuxnsTVNoYouyhMRG7xr/rihHtlDE680ii0bs1hsWFh+VMp+DVm3+cNXjcXf4dND/cQrEho2CjQkhEnzR7GpBM2DX8YoUSMWUa/wCok2ymV4c+NYorD68bLxfklZtNrFHLWUS6ErG/Y2jiIRXhbH1iDF2JiQuhIoZQmUniTKHA2fwLTFGhIaNfpI0IJK2ay54His1m6LZG78aXihi8LFHzlhZSrxXkm66KI9MQvYsRdFjZLUSFNM3immUmvJsb4NTuIujVksrCafhRTIryQxdFPx5FFiSLzaE7y8J+DdFs3M7fjTZtz7MiLCLLJvjCLZZCfBForCZaH2Nk/wBkInyymV4MvxpeL486LLLzJ4XDH4IboUjchu/wR68JP7SIhCLHNi5fLPtEkz6aHBkeC/CxnRTlMl9sfBt2WxMrwl2LofjLFPNC48kPvCVjYmSwiWEuBqvwdG5FljfBHsWWNii2OLRyjexaj9zeRlZZbRuzJ0jRTbbNXrDEPvPsXmkxuizjDEPsXWLF1i/G/BdZee0UkWvxVhD6ERwnilhSQlBjjAcYv2GmiHZY3ZZYybNFVBGsnWLztRSQ8vDSZTxF4tYjiKw8rF5fKwv1y83npYSGLwWKx7M9yL8WM3fyb/5IuxqzbTw8t8DdmnrRUUmaurFxpeFll4vKWX34rzsvwQ+zpZ9spWNCQ3Ylh5eF40ITs5whI1pKKN42Q1muxSTSaLE2PLeaKEN+Dyhyo3G7DarK7w8L8FDeHn2eUNjdiw8WXleLQhPF4lKkx2+34ac3Fl4ssbG+Rd4VrFFFeNHS89rH0JvD/AjvC7Hl/GEiTynh+FFeUsWXiyTdDxRGLbpI+jNK3FkeFlsbLIrnzeOPkSWOzry3MRZYxdefaykPHWUO2zazbL4HFop+dM2y+CnhRdksMTz7DRQlyf0H+kQ9TNzmrhE/q3rf6Z6GP/G1NBSbXMYpfaTlBzk49WWOReIrG5fhjeOhu/KPv4MXXkiJQo4eHiMJPoWjIhoRXZsivYUI/A9ND0Ys+gkfQifQR9BC0ELRSFBJdFMapk3RpRbg2Sw0IWESidEf2P8A436z08PTSg5JTTckn78HrtfU1/U6s9R3Jydm5xFK0cseIiVo2WKE0KMvg2S+DZL4FFjhIoa5Eqy1TwikUhxOUe2KQxdeSFl46QjS0nIUNq4IuxEyPSxVY2lFFUhEkVKyas1rTo0IpaUUakak0ULC4EXhlEdScepDtsaYk0y8KDfSIaD9yMIx9hqPwiiihI2L4NsV7GyPwamnt5Q3m2ISJEXl47Q/wLyhp2QVLDSLOxdZoV5fhJWjVT30QpRRqwvkl2LK8eMMaxo6TbtiSQ2i8cYss3M5xOKaJxcXi83ivJ+Nfg0tO3bKSy2qItN1hMtY5TYuUJO8PG5Yo11WrFk5Ss0dRyuLNWNMWEiivCiiiiGikUoonOhKTKNyQijaUcFodY1oWr/L7r8Cy2aem27Yo0MV3iRCu8MrlZoTWHdiHG2PhM3Sa7Ne6jZpzjqLbLsX2SNWO+CksryrCLI+pcVVC1HM1YyuzQcvcvCZGReK8GjW06d/joXL/Hpw3SIpLrw7ESjXKIuy8J28UhKsPE5tOkRdoo9Qk6FcZGp2maOrXD6NXT2u108r8MdOUmKMdNcstSQkkOQnhOhSRZuRaFnUimqJxp5RRRRRx8losXf4ox3OiMNqE2PLtPhCKsX2yr5wkOHPZFUWckk30KLosaKSLT6ZrcsnH3JtOERI09TjbLlDirHGu15XiOm2KOnHtWyeu10Obly2RbTE3QxFiZY9QU7EyLE862navKL8/fwbF4Lk047URXCspYS5u8KaxZNSlG/dGm9yw5xQnaFKXPFGm37sZaG6E02M2pexOFpkusR5H3iI0UU8qLYopEppE5MYuzS0vdk6GrQusIlKhsTIyIzSItPL+DUhUh94Vspm3K5x7rwSH0POlCxJHC48XGTbRT28MUpJpHaIKpSE7Q48sgqisLslKkRdqySbTQtOVrkdlu0qGTXLNTiiPNMjDciWlOPJF3nnCS9xyXsOTJMbxpwSpsTscbQtKTfRqwSiuOsUT6E1hCE6ExY1YWja2xpp46ZbG8WWLvwTpCvvMVbNNUkIaV3h3uZDrDXYlRs9xCT3ZYh5YpKyU9rQppyqhocEzXX2tGhL2NKTTSGaml7xIu0ODQopdjoZTGSlZuNGDm1R9FpEYNIXBKe1WPUco2kNcn05VdE4tqhva6YmhCERYmIodKZrRUUvnNl4vK8L4rOnGxNC6zSYqzaWLojzyPoRKKkqYltJul3QppUcEo2hRqqKsqmMSp9nqI8sjKpIjJXFou0KPNktNMlcY8inedsn7GvrJPaht/JoaU9R3XCITpJQgJtpWNiw4pqhRXxiempGrpJqmjbKDIyExMQmLGtxJMm1KMUyUazfh7rzSNNUhRFITtDTIp0O0nRGfyWUmJUiSIJJDarsWGUmbcX4XjWfZJU2aEm4og7ihOW7rgbpErnFkNGY9NpNnsnFWz1PqtkNsXyyrbZo6UtaaijT0o6cVFFLtIbaVo+quLLJSknwihtxfXApxfTxPTUkaml7MlBwI6gmJiIsujUlGQmakVtvDEuPBLNFI4OCHMhKkRnboSV2JViLs4Hpc9uhZn0Q/RHbqiK4HhS+6qxuXVixtw+2jTv3Zq6d8pmoq1JJnpX9zXyjSl7HRJbkRikdrspNUeonDR038vodt2xXJ0uz0vp1owt/s+x8xZvfCQ0pRFpbULpDaSsTTVodVyRhD2G6Vj1UOKkuUanp37KyUKfRGTTFNG8Woxyb7YsKpQJdlcjfwV4pZbxox4sStC0zYbmu0JpopIm3GNildEnSsVNCVImrRDiJRq0qt0SnLiufCaSlaiacpN01i7dHWEqKPWR26xoy26sXYnTtEJqTonPYxTuJHf0xzjp6bbfRrastWbk/9FyPRaKX3y7LTEfTjbaIppV4XGKJcxZFyte1DSnGhaNLsXCNfUnCVJj5dslCzmJGVi8Iyok+cUUV5sirICEyKfuVwbqE0ycW4simmmycd0eCCaa5LFO20f8Ak3O1XRKKlVjTXQiO++a8N/LsTT5Q2Ruuc/1CNShIvki90ItfBGW1rgkrlZDguj1ms5vanwi0em0HqSV9IlBp8LgglGWEqbYyLk+0cG9EZKXWOG6FSx0a8N8HmSsaaZGYhLDj9ia/AvBmlDiyKp5UirPptXfKIr4EyUItiHFNrEkqPYUKXGH4OTjuIytJmx7m7NNVfGExkd+7vg9bpb4x/wAk9CcWj0yvQQxY19XikStdo0tOWpNRSNPShCKikMVWNN5Ym/clpy3t3wQtSquBtJY5NNaib3O8fUXJPiTrNEoNdEZ0J2saauLRNU2WX4+5eVTkkbaSGRbvG3+T6jjRGV4didl85k7ixcrDaT5Y8ce2HCNtkE6y+UQgo4i0z1Dp9ihoSjp/U/VWv9s0qj9SKdpS4H0I1JqMbNGOhLSblzNmto6cUv8AB6aOnp+3Lw027snrKEkmhIbiu2XY5U3dEdROTVYp2KcboTyr9x6T3N2PQU3yaukoNUyhRNqJ6N8oUpRZCakafZrxRtdC8Oiy0OY5M05f/wBIkEmOJVCm+aINtckooVouy8VbvCZqdEOsOKYxkEksK8RafTHhq0expra2jVipQkS1tS6bPTan3cjfA9RL3NXWc5GjrOErXYoy1GqIxarg9htLtktGM5KVlmrHU1LdcLpGkp6bTknz2S01KV2KElJPisSU21tZS+CksJtSdy4N8RakW6ss9R7FZpk9FSJRlBmlrdWai3QGuRLw3G50Xhsj+yITcTduXHYk32fTRGNDXAoy9yVohNcY3JSob4ISNV8EJu6yxiRTvDSapkYqPSwp1auzTbknarCirsaNVVqT/wAml+yH/wBaNWfssacHKRBbUqFyj2HCLdvGoumR1Jbkq4HYhoootISi6eNSCkhQpopJ3Rdmr2soRROCkqZqaM4dco09dpOL6O3ntYss3FiNGN6iwnTITsTG8zVxYk2QbpFJjK2vo1vYgliuRuhE064YppLliprHDQj6cbsiqPfG9uVUeqVa8zS/ZGrPbE0PRqenvnavo1NJwm4mjDasRZy2WS7TJR3KiMHBJLE5KNcdiotI7NROhaj4robdcC5XWPYVGt+2EhCy1aNT0racoFuL5E7QhD7w6yj00HTeKEacyy8uCaFChJklxwNGs/1IU6JNKSE57v4HyIYtNJipLCpDaSsTsbpWxTRFpkhaelq+v04zVxlwz+oeh0NBQ1NK0rqmaK+rqwUujX1Y6cOPjg0o/UnukbF7EoCZqOq5o3S4a6KTRaR9SN1jh41UvfolKXDiz9oq/g+ntVIj0Smo1YujcSaJv7ixCrF50u2er0futIpoixNZeYJtpGnBRikUiSNjE6ISdrkadClhUSb9hNtDVrGuujTdSQ0mU7GRJypcCkmTf2sTbXHBHpWOnh9DjKTr2IR2o3Jms9mtpai9pI/qk4y0YU+3aIScJKXwT1Jajt9HpoPmWGxx5Nql2hwQicFJUxaVEJS2/ci3XBHd7koqUaZ9JURTVCmrpiNt94dpk4uS4H3hCYsIRpxpWaumpxNTT2yaY00KQmylR73n0cd2pfwIRujdDTY4y9yKohInsTTFqK6LLNz9iUnRHUNZNxtEF0IrCbs1E9ok+HRR9OIlXBK64RDdXIxezH0ex6lXEubSTbpdGnpubojpxUUqG5RaSWGkxo+pTO8IbY+hNe2HyIkm067Ppyr7vY05prgnJxjZFtpNm37rPYfbFzlCERViVLHqtK/uRROFCbWKGVwek09umv5xK64Ix5WKRKIlWIuKdNHDJQlaoqhjVMUvYghNXQ+ixPDjYsN4s1P0YpyuKT4JrdGhL7aPUL7TTinomjp7MM1JNI3zbVdCZKKuyLGzcxSTHVCkqaijTcnHkWXXuJV0VaLoi7kajaQ+xZWdONJPM1aNbT2SxKFljxpR3TSI0lQljcjeyUp+xHfVNMXCVlxZUZG1rpkZS6Y2qI6ibqjUXuWiEldFKyTLIvg4eJS2+wuUh0lbFJUjsdNDg10iN1zj1D4NBr6dClVYdkoqXZ9JLp4kuMWORF30yykRdFmnu5s9xpNk064FqNNJkpmnK2aklTwvBGnHdLx19NSiSVPCGex6SHLkJ0LULbHGQofJcY0bkTbrgqVEVNK+xai9+MtJDVqiX2tr4NF3PDWY4ZdEr22kVJr7uCKpLCGWaqspxkqIR4HLa0qN6brLaQ5cDLJ9ohw2vGLHTVWJUqGrRGFVZqXbo01UbZJdvC8EaUVGP+cWxPDPUaVO1hDPhHp41pL+Ta30R0/kcoxQp3hq30JHBGKsSJ6akQUo8MbLePUKp/5PTopXZLouxikLotCd4aQiLxOLdUxLhWanYlc0RkmzVjKVUxJ8Dml2Jpo1OrNyLK5EUk8R3X4OTizTluQnyxstOR7E+mMj4QW6SWEzaVTxRqw3RY1TEMit00kRSSSN1EZuWeSN1yWSpvsURuUSM7OKHaZuG2a/KizT4IOXv0S6FwMUeS0lyxNNdiJyaXC5E21yN0hNZdmre5m6tRf4I8NMsskrIzpUS5ixqXuiHRRJoi78Jdmm2Tg3KzStWNr5Jy4NH3YieF4enXLeEKL+TouPzif6sn+zxZ6SNzb+BJm3kSrEUqw4Nu2xON1ZtRTXSQ+UOKJXFWhTUlTGiyS+whyxJ/J2hvnCabJ/qxfcuODTVR5dlYa4Em6w2/bGpFPk21qxZtTd4eFyI2qiKWJQViTTHhDSYlTHJfIsTduiPCpFcFNk47ZPx0KSLibl7I3jbJpkdRp0x24tku3j3PRJKMn/ACWiy7wnQyW72FFv2pi6Loer8KxrckUShR/DGSZp9iLy+yDtGxMitqod067NJTX7MdHBqScao+qr5Ja6S4Jarl7ii3/6HKcX+x9eVdEXau8RJTaqkLpGovt7oWqklbslJPotFoWWSE8dzJSe6iKpdkHxRrrp5sRCVSRwS3R6Fqr3RHUg+yU9KhLTbujW1Eous+56aX2tfyRsp2LgWUW764EbUxQivbFJm1GrptcrDfJDsRWKoaI4sRdDdoUmpUasHJKhxk5VYtDUHozXuSg0LTmz6er/AGkfqR9iOpKVpkSLJ6tCnuVMUYofDLxGTosTLJC7RLiNkPck/uZDVkn2Q1Ytqia3wKKxE0o82XiUPgUGJJFNnqVthlnp395HCVi6whZVUvLV07VofZE0+UTqLXJ91qnxiXYmiMlJuihOPSeZRE+FY/8AskPWnf7M+rP+5j1JP3FrTXTF6rW+SGvOc0mRX3yExuXsSUlVlljymWxN4YpInO4UQ6NSNPFtOzQ9RTSkTST46edNXIbrhCkWbhWKLIxo9ZPpeEJOMkRlaLshhEc0mRlTrz1tK/uQiDaHFS7Nte+GsQqDE01wOS3NUaSpvnCGP9pf4Y/HR/7I/wCSELnMaEUpxocWvJPDkxyEyXFEZUJOQ4RocCqIaj6EJWxSjBUjeJsjFsWmyMYrtm5ew5nqndNZvGhK4JfAhMi2WRzFjVkW8uUfk+rD5PqQ/uLTNXTp2umaZaGbknWGhoVpicZdoUUmOxE03HgV3Iffj6b/AL9P/KE1Gc2/kkrVoapkZ0ySjqK12NFDRWbyibTEKTqh4cbHGmQTY2lwIjGPvIUtOPSFq89ClYxuhycnRqwexleGhKpf5xFiEJ5TEzckPV+EOcn75oVx6Y57lz2RdMUbd4ndcI2ylzdYkucWroVpkdR200KSaLH3Mffj6b/u0/8AJSc5f5LpUSjatDjJEHJM1LlyJVh+NrHviKHlKFcoep8F2J8m+iLUu2RcV0R+bJNJW2xLdymU7JxuLGuXlEHTTERRHCYniyWpXRbk+XlYb8FNITvCNRtVRud4SSd4nF1aIRe7diXep/hnv4+m/wC6H+Uf+5FqxNFRY9JWe7Q6vFIeHh5+BvhJZY/GPeIakUlbPqwZHVgukfUTLNS1JrFCEaMrihMRZETLJTfSEIXlRQ4kZNIk3aITbk00Ti5KinFdCG1F8i6E+cb3Fsjc3Ovg/wCLrf2j9PqruJ/x9X+xn0NX+xn0tT+1nptOf1ofa+yP7yKRNccEXJStsU0zVtr7Ta6OBElQxjLyuxYaPYfX4I8PEERPVQp2MQj3NCVSaEy8WJk5ieFhPwT8WXWGMaT7xL9kaUpNtMnGTpo0P3lhR92N8Gn3hEnWpJv5It93xiSosUhOxx5FwNKSocWuGPDdCxHsXg/wxZB8EeT1EHKKwmPGk6mhCeEOVIu3hMTE83lMst5ojLDTKYxqyPDSxo/vLDs5Qm17C3CKTnK17mxcYnDdXI4USRucWi1JDasTJNSVDTvwREQ8P8F4gITocrvwQuGRluWLETlhPFsTwnhPwvFFFeDxEbpGm4qfI5G+Rvf8CnL+Bajr2ITvukR51J/5EiTUViUW2icRxIMmucwUZJWjU0lVpCjbo1dPYIiJjL8V4e4hECT4NO+y2dizozp0XhvjxTwmIvwQhIQ8VhrNGpurgcmmR1o/+mz6ul/eLU0//wBBT0//ANEPU01/7RP1UFwmafqIJu2L1OjX7EvUaXyf8rS+Reo0v7iWrptfshTi/c3Je45xcey0WiMkmfUQ2rNWe6KwmWXi1+H2xF8nZCPPivgRpz3L+SybwrXgni2JiwihCEPsWENliocRonp3ykS0lXQ4RV2SUPCvw2z/AGWy38nPycnJUvk+75Ll8ly+S5/IpS+TdI3S+TfP5FqT+T6k/kWpM+pM+rM+tqC15oXqtRC9XqoYsIawm0yEt0UyYuy8J5ssTEJCxwRx75RqSpC1VZGSrsTJuK7JephD+SfqpS6Q22UUUkX/AAK/gt/BYuSsVmisJFFeFLFZopFFWUbTaUUUV4IvOnOn/DJMXhfgiC4wmPEcJl59ROkW7sjrtIl6qfsS1Zy7bOcWWbv4NyojQ2zkssbZyJMrF4/2f7P95/0f6P8AR/ovF+N45ZyclMpi8lj6jS56IaifQiyzvKERdIvwQ+CLLzqSubsvFYobLf4aLQ5IWUbUUijaUzk5OS2WWWXjj4OMcHBT+UUxpnJTxbF7iHma4Iy2SshO0mhMWOSxMRFlnYj3Ex9C4YhDXDNZVNl3hIfBbF+FsvFFizZf4KRTKZz+CxO8UUPgSFlIn0T7NGdKmKSExNFjIxkURwhD7wxfsIi8ep/ZizJeHOGvGSrEeyspN/8A0LiPyQmPDysexPol2R6N8k+GaevHhMtfJCLYopCeEVhMYniRFiEz1CtlU8Ib8rvN852iVYpFJF5ooplMplMssvNMpm02m02lFIpFYZQ1lY9ifRLsiS7Iewn0Q4SLHJIWoiLF0PsWEWMQmWanI8W2UV+Kyxss5x/osYvFuvGyxYtfhdYrCzP9WPsiS7IGnTaHqG+TORXZB8ITGxPKb8eyfDf5LLxTOBsRSz7CzeGrNr8l1+ZsQ+xE+mN8kLfQ9GbZDRilzyJJFZog6E83hDwyJJIny3hMsstFlll+SGnfWEx4Yyn4J5aK8ExP8KGhiGson0zT01OTvpCjGNJLKWazF0KSLQ5xXufVgPWXsLWkfW/glqtkdSUeiWvKSO80zaUxI4Rw/b8O1G0qniuSufHn5HaLP9F3jgpFLNH+xuvcv+S/JIrDPg1OItmhNRbTPqR+R6sU+yEoz6FFiibWbGbD6Z9Ni0WTg4q8vxZFZvDZ3+Oyzg4LFCTRsn8GyRskbJmyXwfTfwfTl8H05n0pH0pH0ZfJ9GR9GZ9KR9Nn02fSZ9E+ifQPoo+ivkT8LzXJq/o8R6Jv7mekjw2JC8FhGr+rG68uBLDQ8IbsX4eR+K7Qmy2cljZZuNzLZuZuZbLZuZbP9lFP5K8G+cXhs58NX9D3RHol+zPTJLTR0xCwkvDU/Ua5eaNrNpVZlledlitiSQ5IfPlHwf4KGhJebspl598J4s1v0YiJL9jQ/SP+MJCysJjimiWlJMUGbSiijlCw7KfuPwstlMaaFzhOhnHnHpDdC5eXeErNptHFojFtm2mJWx8YcaxSqylR2RG8LLFnW/R4XRL9jR/SJH2LwuTb4JsuzdXaFT9hwjXRsTZ9IekfSHCRsl8EoP4NrGyy4lxzITeX0Uz28l0sJZaKEqjhfsiXKIcEu2R7JdjFyqKoX6MXdFNWQ9x5WHlGr+jxHof7s0f0REaEsc4bELDIIoqi6E1I2nQpWMY+ykNURXvhuhu8rtEVchV8GpRfjHlLC6y+sf8AgXY+0Ll0L9qJOmRfJLt46HzGxfo8T6NN8sp2f//EAD0QAAICAAUCBQIEBgEDAwQDAAABAhEDEBIhMSBBBBMiMFEyYUBCYHEUIzNQUoGRYnChBUOCgKCwwbHR8f/aAAgBAQABPwL/AOl2v+yVZV/2Sor/APBY1/8AbFXlqRa/7GOSQ8Q8w8w1M1M1mtmpm+SmzzDWazWKS/7COY5vLsadiumskWnyU8rLyTaFNf8AYBslPKisrL6Ubdyj9xGw0V0RlQpfryxzG76X12XnxlqOenchP9dSlQ59CO+TXRub50MQxliJLbK+iMjWazV+tZSobv2H0WXmh10obNvZjIT/AFlJ0Sd9KyvJ9C6bLy4LzqPs2KQnf6wbJu+pPYe/WvYvoaXRfXCX6vlOi7H7yyoro7dCca9hdCIS/Vs5Us3+JpUbe2iHP6tmP8XfuohL9WS/tSdMW/6rxOPfooSFE0jQ/wANhcfqvE9miiiiiiihQFH7EltwNDiaSiiiiivfw5fqvE9ysqNIo9DiaDyjyjyR4TRpZRpNJRRpKK9lOiMv1VIa6l1rLY26VnRoPLNBoZoNJRKI17SYnt+qWS6VkulZ79dlZLKkUVnRKA/ZRHj9VT56Vkl07dFddll9F9M4jWVZLphx+qp/V0oSFlRpEl0UV0UV1WX1SJr2Yrb9VT+rpihfgaKzoorpZIa64K3+q5/VmhL21nWVFFCHltlTK6WTH14S2/VcvqzUehFiftV130PoZLgfXDhfqp8D5yiunVlqNZrFM1F5WWWXlqNRqNRv0voYx9ceP1VLjJEVnZZZqLLNRqNR5hrNRedllll5X7DQx9UeRfqrEe2UF0PoooroQpCZZeWossssssvK+loaH04S3/VeLxlBdFFdVGkorKy87NRqFiHmCmazWajUX0yQ104S2/Vc3lHjpcjUWypC1N1Z6rotil71sUi8k+qSHmiK/VUmS3RHnpeVZN07OTCj3HEnBdhPo0sdrpoo0m5ubmosU+hEkSzwl6v1XI7EOeh5UVlQlQsSXwPFl8DlLJEVZGBCJiQTJR0vNs1M1s1mpdUX0Mnzng/qt8j4MPoor2aFEjGhEbRIxFa6JZd9jykxxkjWX0LoxOc8NVH9Vvkf0kOOhPJ4aZLCksqzooqyMayjlIZiRp5UNFMw4rllxHOPyTpvY3Ey8088XnLuLj9VslwR46UXk4J9jyUPCkaJfBpNOaI5SynGxqis6KKKK6KEs8XKG8hfqvuS60I36GNiEIgSiPJkkiiuvSaDQaejFywYvn9Wdz83VWSZZZZY2RjqKyQpGoeTIjh8GljRRWWkjhiwjRWTKzxORK2QajEu/wBVsXPt2Wci2RZqLNRqFLLST9EiGI28mkOCPKQsCIsOKKWV9U+SHAyD/Vchewi+jg1DZeVmoUiMhGLG4kOqxsvK+mX1HbKP6rlwyPuJGNsNlSfcUZLuasma0QmvkUzUJdCNhseV9Dy/Mdsor9VMkL20ssTdlZasry0xNNcMi2R3Y4+y+pc5Mjx+q5C9hZJZy5zorpTZ4eO9jH7ryid/1ZPJe05mtlNiwzTA0FGk8qXwaHlGJhbZS915R4Irf9WYjyXsWOTNxGpI1FlkZs837HmHpkeXEWlCkWMZZftSMONkuBLb9WYmS9h5ORqLLLLNTNRqNYsQZrFLJ+4zhIjHUyX6snlH2WUxYbIxhEWn4Hg4UuxPwn+LHCa7GjE+GVif4sssUhsjIhIfRfWxK5IeHwKNIf6snxkhdTyURRQ8kxTFiFo1o8xEnF8pE8FcxOCxMh7jMCPqGiQ/1ZLJdd9Dzs1HmGs1GoUicbNOUX7jPDrJk1v+rH7dl+0oiiOA4i9xmDKjWjUTf6tfPv10pCLyl7byXOVsv9XS9yjQeUOOnpTOcrG/dj+sZ8e4hDlSHJyfUnRd5P3Y/rFo49tG5Kbfs8+6hfrKfPt2SlS9pe28ofrJje+S6ryssn7N+9FbfrKZ39yXs/6yT9uK/Wcjv7dj9hKxYCr1Mlgr8p36rzYlYl+mKZX4LSxprK8tSLGyQ+far2sOCirHibklr3ROL9pSpkZJ/pPSzy2aEaEaVk0aEeWaGeXL4HBooUH8HlSNDKzo8tmhfIowFpNSJStcDqzayV0UxeqQzuSF7dDj1Q+pGI6iWRnRSxFtyTg17SdEXf6OSPKNDsUUs3wR9Qs5L4FuUepD1C/Ystmo1JlI0oiNWaUMgqGiiezye49jAg3IxISidyXvVZT6EPEU41w84zcWKcMVfcxMNr2sN0ztlpZoZpZokaJfBol8GiXwaJGllMooplP++pCjQsR2c8HJ2zl6MRMf1dD5IlZ6Sslyb2V8H7iZYhvTuKmSmrpjhqHGURtj3PCrkatUSjpnQ/wFdF9CdEMRT2ZiqN7P2I4c5cIh4Wfc8uNVQoRRtl/rKiiiijSjSvg0x+DSio/BLBgyeG4v+9RjYo1lKFkZUzncqu+eJH6d+41WSjWUkLJxXRaFmhnBEkjbYWq96KJ8ksvDxqGXiI8PJ89V/iFGUuELw2IzD8LFciilndspdVlllll9E0pIlGn/AHiELFSz0ksNdiEmjas8Tt+5IWWpcZuN7lO7TNs5EF0siMTvKjEi6JCIqoooxFcSScXTJdVfg/q/c4zwsFyI4ajxlZqNZOZETLLNRqNRubm5UjS+rFha/u8IHcrfO1lOF7kJdiUVtbEjE4HwRypZoprjOiYs9yJuu4slnJWicdLML61lcX3HweIha1D9q/wH75QwW92RVFmoeIeYy7FHOxJs0oooorKuqssWPf8AusI9d5SjW4qkhcGJ9J2Eqz3WVtSp9FV3JR3+xHqiX0+Ij3MD6zFxpSZbMLxD4Z9URqm17VfgMPw8p/sQ8NCBMscxzNRZCO2VjkQz2LLLLLNRrL6WrRJU/wC5wjfRWepo1xY4/crY4eU/pZHhF71lecknydhTXfOmr32I5Ld5semPc26GkzEXpkYbqZixp5+Gnqw/2PERp2P3KKKKKKKKK6IfWiMlWw5kpEpjYyHh73k9h4OEuM5MshIUizUajWaj1Gh/JoRoiVnWeJH+5RjeV502hcZNInhtcEMX5IptPcq0If0kPpQzT3Qs2dthXW+ciPUkqPQ/9Z7PgjdbmLE7kZQmqZjYGndcZeGnoxF8MxI6lROLT/E4eMSxByNyVoZGT+TDybJMSEsrNQlJiw0be2yca/uEY31LVqoevVt0YsHdpEJtMTXOT7mH9OUEV6uis6JCzat9GlPJKyVQ7EXqRKWrZofJaUTCxLiYqWrbvlgz1wR4nCtWu34rc3IrYkrOBQV7CykzuLJslIwo9Nl+zKNoa/tyQlt7LzxcPujCxKeTMLgeVqxDvplbGthdDQmanGS3EhrPglwNbvKEtEkY6WlSRbMLEcJEZRmjHwtLtcfiKErFEcGlwUNEVWbZHnNsRCVCmmWajUajUajWazUX0UYkf7aiKpZpV7eLCnaMKdjMO/VXyervk9jtsamo79UhCNuilLZlVsxOfxt0Yn0M7j2dki7wmhZYWLpkPTiQGtLr8PCE5vZEfDPu0fysPuYnjFVJEMRPKyxsbIZPJcZJmoss1ms1msiahO+lklX9sjHJ7dCj89DWpG8Vx0NWqFeHiC3RDach5SIlp7MVL9ujV9h8CKn2ZKmt2atPcuxiyi5PnoxvoO5LfKK9KO7zw8RxFHDxVdGJ4at4lV+Dh4bEl9hYOBD6nY8etooljP5HJvOOI+5zmyGTI9FmovO2RiaiMbFFFdMo2h/2qESslVGpJ17ClWzOOjHhaswJ7UfnQxExEo3XUyOTgrs/fNCvPjLH7EsmQnsfmYisoTlHhkfFS7onPCxOVRLCa3W6/ARwO85UQ8rCW25PxEpGoc+qNrNkcmRL6JCmahCNyMBULrxF3/tMVv0KKTfRJ7Ed8rypdG6E1JG+HiCnqaJcESQujzHe8djfV9iu9jFm7Kydizl6kdiUXJmJFx5EPpayRbQpfBWr3YQlN7CWFh/dk5OTybL6aIwtkIaeSXOTI5MXQ2N5qTIzEzUKQpI1F9LJKn/aFshcEb7+zJClYpZbdxrLT6rMeFxsw53QxDIy9TQtPfJE38Cnq4Rr3+kZT7Ccq6MR7XFF8DFmxGJFSiJD56WtrORMQki6ZtNe2sHvIc9qjk2N2VnvkjDwnI2w9kSbTJ5MWTFnqG+pSZrNYpsUhPqmtv7PFZO+lfvm7E7yjqTdk47GpxZHRiLclai0txfSi8ktGNQxEjTPVZL6SLfDWaVcZMXSuDQppPuUmtxdLMX0zHlNcMrJI0EoiZFlHA99/YjhSf2R/Lw+N2Sm5cmocs3lpZuVZh4dyJSUFsQ5ssnkzCwP5W/clFxdPpoaK6UIpZpll5XnJU/7LFexXVtW5O3HYW+0kNSw3Z53fuIkrRGXYxV6os5jZxwNiHKml1MR6aFNPoad7ZokrQo1e4i18niI5NEI64V3F8ZIWFY/Dv5JwcRSoi7JR7ilQ/nt0+W6ti0L7slNss1dSS+TSv8AIoSojaldjbkJZaHIeFP4MPw7u5ZeJjavJizkKXUuiyyxPJZTW2UdJL+xLpUd83rvYlF2n1T1co3oatE4ODMPE1KssRdzXKWxG0qOwxGz6mLLbNVLhiHl+2TycVJD2Hgvtl4d1I8RhaJa4/S//GUOSLWUoKS3MXC0sTojKxwsTp0zjJYUn9j+XD7slNvqotZRS+dyv8o198kVL4yw1vnh8FljY43AYyPOc8lLoXsLpxNmYKjJ7jhh6SSp/wBgiuvfJ3RGcm6rgcop10N0+hq9mSi4SIT1IfBxM5SyZvfUiqvcWTE8t1if/s2WeiMXt3IxcbTJpZyEeJjplfyYT3JYSxIWv9r/APoqtssLOUdRiYLQrRGY8FYi2IRcrg+UeiH3ZKbl010MojFtnlygtLHGnRheH7yNqolhtSdLYw8OXweVI8qQuEaRRj8GqMdmKUTGXreWBhW7J4U12HCS5Q4pmiuSeG4kZUJp5L2ExPox1sQcr2PB4TlP+YzxvhUlqj/YOPaSV2NL2ZxtEW4SOw1/MRLtk+jXUaojJvtkjbuPbP75JLuO9NIisRc8DJK0Q16bsWvvniaaEY6uKI7Mwtbhtv8AMTFjHzeH/slHSzCe4sozfwcmJ4dPgcZR5RhTpk8bfZbjjLrrKjA8NrJYOLh8x2HOEo1LDV/KFb2I4MIq3uaVWxoNCK6LLJrVRLdUaVVUeRh/Atsmk1TMXCcH9st4feJLDXMODgjK8l7CFkjFXpLqZgz4Z51xqjGVTf46KGXRF3nJWLjfp1ZUR5e1dFPPGh3MGVqj/wB3NvcXSxDwlOO7HF6VuJX36cTVp9JHjkeSHniK0RJ/Q8sO9LrsYsvMhfca1QIci6Wkx4ceEjDwPUSg96MRUc5VkoTfYXh8QWCk92Rw18GnAmqvQ/8AwPz8DvcSTuXBhwSX3KinQtK4G7ZeUo6iN1v7C55zpNUzFwvLf2ypx3iOKlvH/jKM8r6rEJiESMWNTPCYTkkxyqSSPFR3Tr8cuMnsi0+rUi1lSuzcvpt9iMpanaylwxXCR/7il8n5smvULp3EX2FOWrSOST56HfQ1kxZSRE02nlhR17fYp/AnLsP0yI5V0LcjKpbkl8GNtmsGbVmHhQqz/RN0hbkcPTC9pI861tBUTl8cGHCt3k9+SKrKn1aWUU7+2elFZtKXKMXBcOOMmu65Np/aQ0Rl85J9ViEIsl4bExZbcGDDyVTnZ+ezG9cfxqWb4FsW+xLU4iz0q7KzV9jRUrISu/Yxo9zCeWpDF1LLvY4qTtnCytPpopjRG6yYuWW4yXq/0Yq/mMweY70dnxL/APkWzJ3raZhvYQpOqIuV5fsYapE42J4/weTe8h4cf8SOGorZC1NVIUVHhjxEW5MipYfHPwQxcO260Pv8GNiy+nYhG983m5SS9JLVOHwyKut85al2Fed7k43uth3afbpuPBi4Fbxyas+0v+RxoTaFv1xEyMJS7CwoR5JT+Muw2S5/GRyvLTlGU70k20+OpoTolIruh126U7yn6oswecpwvcpqf26JRfKYuN8l1b6t49FtWQl9sma6apE4yk0VaPzM0qWzPEQ00YX/AOyTlHZeuNbfJipqTtGL2kYb3I5yY21TGr3I5NvahO7E6Jq+GRqK3O4sOS3cHQvENbTWpE5YfMHz2KcnRxk9X5RSco7orKA56eTVtqewnqV9djbjxwatujSlli+HUt1ySTi6eXH7Fd1wfsXnZYtyHh5vnYhh4cPuPE+C84k9mYi/G2SutjVKhY1ixEJ9FGpcdFGGq6G0sqWUo90YPLyn9JqT64ySHpfGSVZWvksXUzsRxZN1W6Jz0Omd8sVXBmByyMJ4mlw2pHiI43plMauH7ZYbylsXZ2SKypiY85yvYgu74EpV/IxP/iTxZ/TOCKtiVDdCayjqje+xNqO4pRfDyktSo2caFBR4zp1Za+c6Kzc0uxLVaaOc54UZ8k/By/K7GpRdM43RSlxsy+zOMtxYcmYShhr7jxTUIvoxFcbOV+LWSRVmhI8uI4FtEcTo0q86yovOUVIjdCe+WJtTMPl5diqYjXDaLJtKSKfxnCNdCk6o8upWiLe9rq9Q8kldkqfKEjcTvZogtOLRhKvU16eBuTVXsV6mvkexhPOMfUcMuzsRU+7FDS2SS2ynLsRjboUsCt8N2SlgdlKLJ4kp8kI1nWSe1US0bWVHlL2FBJvOd/50QnrS3H8ZKiWJp5Q70/cjq75YuL5aurH499oE5TxHbKYzZ7M3jzkq7CL9iPBp9VElT/FLJc5ONoS2yaHA1NEZ3lSKyb39MjkarJ4ugc1tnIhMxV6TC4EMYh4UeWOCfci9PIxdMXuSlUt+BVdknvnOWnsJ3k873o75MxFWImYOI1cP8jVhRjJShUh8oxo1Iw32MK6psaaJSUWjUahTQ2mtmYWqTeoqWrclKssPyZR0y2fyPBxY8rVH5JN8fBhpydkvSulE4qXU+i5b7C4y0KtidvuJT7vqxYa4NEF6mmUikUh4cWhrTtLgqt1uhP4IyTzSysss1DxlEli6vxS6NWdZyhY00QxDZiTTGicFIw3tTFK3WUtOnglhJxI7lZTWl2atUDC4JfZ7l2lY6EWnGj1atJia06RYhQlVn++hq1RCNLpSpZ0LLcjxwMxl6U/hmFiODtDx8Kf1YRIxlcUyDqSMOepF33GtRuokZtdtsrITJSSVnJheiXrhaJYEJ74Uv/izViR9Ns5dFOqQlapuyq4Hvm7XHW0+z9icdSFx1+Jhoxb6XuinB7FXvH/gTIYnZ5WK2UkPEiieOSnJkYebgfdCv8UulPKSb7lZ61Lahx9bE3EUk8uGSr4FDupCyi53R35EyXyalJUKWltGGSV7EeKHKpbLYWbeSLemrIRa79TPO0tKicnapdDmhXYjsN1Wc1cWR4WfMaKMGWiI3SbRDi7JWokHcc+xObkYKTVydEfEYq+6RiYiaUtNP5ROTe/cw40hE0+YvcgvR9yGpc9W5iuXKFffPXBOmTtSTSKvobrsX1o8TDVhsg7XRZiLuV8H1fZnGzIT0/saojxCWKNtlZeEnVoxo0/xKHksqKFITPVkhuF8DUXwTiJ0RleUlsyEXzYpPLuSh6tSyRpRjLdGHwhEp/Yi9V0sr6ELoWJLVTQlbzdRRrgJ1m0sllsQi1av9hprJKs4k16xEn6WRrSiy88SXbLw0oP+XJ18MjHEwXzFxJtW64IQ7voebtdy/Y0xqzXGjUoqxNPddclp7lp8ZNXlyYkfLxX1uKZ9pG8f2E/gvpw3U0Tjqw7/ABMRm9iKzaLaIzzmtUaFGo/cSmuScDgjK9sqJIhLqxuDD4WTFGjfNliyd9hPJxmpLfY/LaE7jkmRhUmycLdoV5NZpj3ISb2fYYjAfon+444LpOK3H4XB+6MXw/l7pmJk1UXuJJxorOMW2PDi400YvhpR3jusovbkitUl8dMiGUop5LoasrJOicdTi/gdNKyleTs7Z2PeIkks/MV8DvVaPFw1R1LsQla6dSNRdm8f2K7xE0/3L6OGYL1QMSNS/DrJ5WjUs6JKVm6IzLyvPEiJkZXk0NURl043Bh8Dvsb10PJXYulaa3HxsRw5x77ddtGLJy4RwJncpDNSSMBp6q7oxbl5ZLH0zSMapYOxLKX0ii/kaZTKdn9OFsjjtySoljRi67mJhYeJXZnlTT0iVLPWkWnkqF9mhtrlGtfBq+xYmhy4F7EknyJFZosTy2o8ztW5P6d0eRiqW0dhxkuVk3Q22UUVlVbo2l9mX2ZddHh3seIj3/C0aWJV0djQqXTKJwLFoU0xqxPtlJX3JQE2mJ2inRJHDIu1nrevcxiHAn0aa5HlFF/zKKfTiXVojx7DGI/MimsopGDSxdiSflv5iycNUFNL90XpwaJzuQuCfApbGoswodzFg5R2Fh6fU3Qt8TWJ8zZhzbk74NL03eeharKMSWmDIynGQoIkhiT02JloeHGQ4X3NLTJGo1RPSxcFNKxT1WRexZY0JFFLKyldj3ynwxrdmkoorocS+zN0fdC3Ejw/JKNxaHz+CoUSOGKJiqkblseSTvLb5G/XRTylGzRpLI4haY9SLvLEiQlTO2xDV3RJC2FlRjcog1fIuiak2tzhZU3Rp7mrbo1K69l5O7IndE5uNWx5SnokpkfFYO9p7nnYLW0i0/zGIqxJL7iJco2NicjDxp4f7GHjQxODFwnKa+Ck6S4MSVv7EdNJDnGO19PieKMOMtcdu5qGaXJ0h+lxghyWFUScdM2QdMm2laIylOBG0vUbGxKVIw1Nx/YTZt8EVCN0XHOWI4NbEZWjY2Nsm8p8cj5fstG8f2ON0J3wRnfJhOsRHxRjRqfvUUaTSaSMRIox16C+pw3tsaiX2vNolHJTIys0U7spjVko7kHnIjni8oSF0IeVOjCuXLKxNXRSfQs2r7l5sWWJHVVvYUNPcRJWmLoRPkjuh7Z7rgw/FbVP/klJRj6XyRjZhw0scIuTZx0aUxrgkWhYijGktyMtDlfJKWuO/JerDp8xyoVx4HJvKii642NzcopFFMaYttqLQqNMfkaGJkuB8v2KNJpHBx3RSfAnfJGelqzDdxMdWk/b0mk0mk0lFFCQkUYq/lsWzE0zgpNbGl5S3Rhr5NCu86sfwxxKFZDEzkslxkzDxE21lIxHuiL6pLfOOxeW4tXfoTkuBqTlz0eh7XuavXWTEdhxepb7GxeXd5S5LIj+oW37GJK5dMVsQdPqxNcqEqXI+xrsxYprkW+1kk++ViYspK1szfvlfTGOnvluapFppI1+rTpPVrosb+9GtrlEZJmJtFnfqS6EMnh3wc87Mtrkwcd4b+Uao4mG3F+3pNJpNJpKKKEhZeIdYUs44nyKuw3vuVlfS8O3Y4jiN6S73FaORoxFJGHK86jqtERmJ9YlumUqvpedkc1Gu/TZqReTworceHYpbO80R4HlFk9pvKeUCSblsW66Yxzw5bdCy2ILeX7DwzTixa32HCkqHO3WrdGqRr+T0m3Z5OPReT2TIS1xvq72NjNXyRhK7Uh/8P5JP+Xv7uknhqSJJx2lwcfsQm1vFinftaSjSUUUV0WeMl6K6IyaFJSWVFdbRNOuDD32odxfImxOyRpFlJ6ZMgxk/rIyrYWdWKOljyoWWl1YsS+xz1Vveb3Ia3Km+CevVSLyi0R5JLKBjfX/AKyeSHsxlZwVse2SE6eTaXcV986TZB1GYmbPkemicdM70FKhxQvhjwovgqce5GczX8xPQekpfJpZX/8AgoqOyJJrKVV0P9hlWzeJqMT6H77imqZPDlh8bo+8RNP9xT+fZooor2PFyuVdKZGaZVbotM0nPfK8q+MmOD5tE4OQoyjyJsUvklGt0J5OKuy2pkuCX9QrcQh7ZPLVQneabNG7IJq1ZTXObdITT6rHlBv/ABFyS4LjTMKbb4Mb8ubIkmRVjjtsPJbRN8o5Yb2GrQlXQp0q+5vnrvJolZgwrlkoj2YmJDUB4SNDXcxMJtNrkWrRwPGjtFo9D4ZTYrTdiaySokcCmu4uTGfp/A4nhbWrD/4K3rhil2kW4/sJ3+BeyMSWqbefBRe5ZHEKiUV9h11NEnLVR2yTIyJR7oUlxlIf0DfrEIutxYjkqowraZJNcjKV30J0yb0vUKUZDzqxQSfVdsYxZdiRBpGLxE02UyRdI5I7K6JtdhkYOR5cqK3ylzsdiDp5XC67knU0aeco6dCseW110NZyiNCniKaJtydGG29miVkSomNh7JqIobfSaX2ZUvkf3jZ6f2LZsyRexg4kXseJ7e5XTgbxPFYMZrV3HttIUnH9j7w/4Iyv8B4qemHsJkJ5truhUbFZUUONmljiUzciTh3WUyO6H9ZERGrHWqio9ibvKsl0QVLKupNdzbLYUbJTlrow5XYspo4JTuKFyYkIqJIkyBqjWxJkMCUlZh7Hccd2aWVWa3PLit2S0UrHNQRaatG2mJRVjwparv8AYim+euSNLauzVSHixj/sjiOW7LExTrlDay3MLU7PSyWF/iycpw5QpxOeDCf8xprcx+fYp+wzw/BNWmShezJRcf2E2t0JqfG0iMuz9/Heqf7GlHlo0o0pksN9je6Y1kmYc/k9PZjVlimWmSdF2VRqLyo0o0km1kzfsS/qC4I8CMXeP3RCPoe+4ta5yW5qV1mk+ic2uCU3OH3IcU+RqnlyRhVi6HH5FBq2Wtsp5Yn0EeExqWi72J85IbMHD1z3MKCiuTFj63QolFDjaJISMPgdMUWp/YklJo23OyLITS1WYk9KTjujzOPub9EtTqsnEdxsxPUaYSVMdLgsTzs1GoTylWLhy+UR1KVND9LEtrMf6vYv2cNVDLGh3Ksnh1uj9uSOIpbSN488F+5iS0xb6UiTqhqMyWHJFZ4bT5ONxwUtyjdCkazUbFG4tffpkjuYn9QRCMl326JO81HuLLzZxklRzIarJcWKcdzWuRSUt17E7a2ISkxZTnJPdZT+lmG9qFKFbk3befLMCGHROUI8Zb5UWjEW+WH8ZsfA72N83FOhy9NJliknwXRqsvKRJU8qKJrijDlq+zHnWSFS/wBniNkXZht0YjuT/AYUbkPjJq0TjTGTwvgfw+SGI1tLgS7rj3PEy4Wd58iVFMeFd+ocWnkmQxL2ZwbfBNPV9iLV10WWWjUsrdcGvbcvYnHujE+pZQ+noefYWU1LatyO6Iy9TXfKzEjqpj0uNGlRedMrpSQhEkM7Mg6kSn0YeFGtzyGvpZCKX7i0st0xMseHvaNNoqnlCd85SjuPgvcvNb50VmiTqh1JFZJXI/dCS1XlRRuKaunlKexivVIUUJEvqfvWWYMaQxZYsbWcoKQ047PgjJw/YWImX7L4JvVJsoUdysqRcS8nH1bGJh2tuTfvlZDE+Rf+B6CWHFO6Gkl3NRqNTNZdlCZqpDxSOIJniIU7ER6Hm1cRKhG17lRvZnlJv6ituvVKJ69b6GLJ6/yjykJXLYxMHEik3ng4V7s0RO2TT12XsLoxI3uWkaiE72yZ36FlXTWVFFG64ZNOUabLksNfNkKcbyZpvg0JS4HY+TllM7D59+EbZwunGjWbVjWh3Ww4KtUP+BTXs489MM7ykm/zCfp3NTT4tdM4av3OMkLEaNal3pibezHE0mkaE7F0T5yUmhNYkdLKcXRAWbFYxZLJqzDT3sftylOPbYfqqyllF+lj4GNbHh0/N2PFStQ2oxY90UQg0KzsKijbgjpsxHpmjfPEwu+VkZWhkpbmoUhPNqyGqKp7kVLVqGu+W+5F7ZXlsbG2V/BdrJj4J/SRIjY+ffw40N9M1qRJU86JQlB6olRxfp2l8ez4iVzrNSeUduxKX2I9NDinyPB+Gcc58PZmHjriQmmOKNBLC3saaExPLFWadE/XHV8ECKvv0UJ23mi69jfnoTvKcG+GYb7SHJRl9hCPkfI+DwkFPG0sxuKfKMUjhrSJ7ZtCvcfY8tfUxxTXIrj0ShWUHTJy36ItixDUixr4FOLtHmJ7dDHyJ5WKbd2qLLLyY90diAjE2j7+FERsV048O/TiYXePsSdRbLt3lRWfOWqPya4muBqw/kjpfcqnyaY/I8OLPIieTE8mA4QF6Z0iUqVila5LHpZKNCyxFcejDezIFChuMsWtyNNOxvfJDVkduuMUur7sensKEGxR07ZcjGeGk448X9zxEa3+WYm9CVpI0yoqQii+SXJ2Klr03sYsW6pkb75tXEvfJ8rJkXa6LFNoT9VilE1IsZGLcSSLLsZT+ctvkeys7E5iEQyx/j3oq2QW2ayrOSsxFpZqLNRq9jxMqjWS6LSJYg8RseVm4o4nazTj/BqxVzFnnixkKcWOe5RpZfyLb9smhyrk8xp7EXqK5JrTLO6RhCykMb2ItsTfcT6LynKOnjcjPV2zVLklSVpkXqjfS0Ycae5+wsmNkZqElKjF8Xhz0qmjE4VC1aVRp9N3lZY4LbY5fsTjTvLvk1aIxrgafWnfBbFMjMkUIorKWHqJpukRvS18E0W1Ei/SQ4FyYr391swoi2Nn3zsUjnPxOHcbyssv2MeVzK2I2UcDmORZeShKRHAXc0xXbKy2Nqt1Y8PBl9jyZ/ldmtp7ojjIUr6ZRs0qiL0sb4Zjx1RvNswuBZNc7jyjtnce/S+jy9YsKk1dkVp/YnznY+hD5J8GD5fmLWvSS0XKPZPYVx/YwnURDGivgdkV0cZSZqJb52NPszDXpsc6STz3tdFZxlRyNEkyN1vmhyrkUvVVE9mMqzhEYySMTn3YR1Mihyoe/BrxIcq0KcJcMosUxPPxOHpl7U3UXki9iM/keWk8o8iIsOJxlJ6eRYiYpI2JKX2EoS7mhrdMbUtpon4fvBibRDG+S7y5NVDV7o/ci+2WJHTNrPCNspEupdLE38ZQlRiSlH1cojq03yRnq7dCVdCJcmJ9JCtSsmvUyL3RF/T9hyIyFiwltQtSk/gdUJ9DRqovOmIccq+5P6eCLi/aUyTSQxdGJG0jYxewt7IWN8DxNjE93CVCKJQcd0KaZLDUt1syE5w2lwVGRLBl2ISa2ZZKRiR8yBJU/Z8Q/Rki+xSKNIoZWsroslGUuTy3RoZpmaH8Cw6Zp2EvsOPdEoxn9Sp/JiQlAw8VojJSHsXZF0x7lC3R4mPDyRhlJkY0MeaRv8GoXsIoT2ocVlazTylojFNEJ6ia7mJ9OXkzxN0jCwo+XiavqT2FNUWVZ6Y0alqpGu21QumVp89Kkkak8rE9qNs9frSo365psi6VMVdDE9zG+gjwRIbuzEaMTj3FuyIs54XdCkPcUvLf2E73RafKNCJRZB0eKw/zL2fEv1JFi5NKktyOGaVlLErsRdoSzgqJRuRUqHHFNWLEWPI8yMuRSXznVldnwSwPginEU7KolHUvuWJiZjfQ8kQFkxnpzs08mHWyZ3znJrsRlea6GSfHpyayQ4qqIqh8GN2ywpPePCZX82Pc2Lya1djDjKF2Ph5N0rIzUs58kltaIP05uNpG3XtyXfSsp61+bYuSrcUnq5Fuh3dl7b5atxy1NIqmS4IqoknuT4F7eEtxZ+oWIu5PDjLg0tDXyLVB7CamizkpGLD+Wx8+xiSubeS6KZQlWV5ay+h4UH2olgTXG5bRHGZHFTOcqGhoU/k/YklL9y6IvYnvE75J+kwncTdDJWRW2+Syk6pkZX0pIayjFlNZJUPorLk4L2PEX6SjBwvNlo+THw3hYuldkcxI4nbuajWa2SkqHIcm1RhukJ5ThqQoVsaa4JDK2KylKmhexODfDJ6tNGHf0yykrQ7S3NtfJCVZMkxsjviWcsW8x8DHwyPt4S6LLs0PszzJL6oilBmhDw2naE75Kyn9LJ8vr8RPTDJFimmhz2LtdNDiKCOCWKeazzWef9hYsD+XIl4f/EalHlEMRojjGzJbEle6JdkamhSHFYi+5GMoi3iNet5QisuRjyYsuxFUIimynHJiY3RGbfAneeLvH7ilSjb6GNF3sxKjH4TODwkq8Th/ueMVeL/0PS1RohQyzUTfGaZDEsTEzFi16kK9LYnOx5UaLPLizDVWh52PPkuuRyinbNV75NEoJs7CfpNfqoZPYUKWojwYb5G9h5d/aX1EenSaGaSkSxFHsQx4SHTL7ZPgxPqfX4l3OjbONp7LJJFk9XYhFo2z3ZLXdHlHknkI8mJ5UDRh/IoUfuTwYveI4Tj2IyIzKJInDa8oyF6kRvVRi/1GI3StEU9L3IOa5H0VmhEnS2FKUoUzD2VMnFKqz0roY4qS4IuL2a6HJXRRF2Yy9P8AsxIql8mFtiQ/c8ev58X8xJRVcmG9POdIdDzhkjk0ocDTuKu4miWxiOXKHOpUSTXQ02iKrOauNCjGUKONsrLGQ4NNSskyW7LuNE3pgLgTzaqXtYa3I2aZfJol8mhlLJzofiIo/iET185RxpIWJaNex5txZLnrk7nJlblFCVZclGyFubIv7F5Ou4hqizUa0NQZUfk9X7mz+xqlH6hww58bHrw3TR51dhYqeWLGnlCdGq3Zj/XlAsu6Hkq7jdyyZsxCI0a0pbimmKUXteaZebJSlB/Yu+S8rGkytiiXBP6iO7HKckrlwab7mgpZMfbNUREITL2E7R+ZjSeUpbFmmLdjJUjYot53nqNRrt5wGSI/VlGEJ7tnlwMSGkW5LDlDkxVsn7WHsRn9hTNf3NUs/UTj/wBI4EbRJDIYjiYclJE4NQZLnqltF52b5rKVPuLY1Fl77IbPTPkqMSeutin8lFI0OykV9y2SktOyPLb3jsX+WaJRXD47MlBw/b5ITon6oZxJO3lDnPsPoZspClSyRiLUjCSS3NCW95xVsktHInnKN5vVRqFIvJx2JYUG7YoYa4i7FGPmS9Do04fw0OC7TJQmuxb+DXY3mlWSkK/jJXliYWqOqL3I4ye2Iql8k7/dfI3ZqoUix3nebbQna6HHjOIyexDkZZDWxuXcg9z640NPQ0L2sOSKJYXwapwFjpnPAtS7ipksBPhn8PP/ACQ/D4n2P4fE+BeFj+dkY4eH9KMafoY+rF/pyEN5LYcuBNZVZsb5LKhpNDw/h5OVF5abPLTFsOSNSybjPZjTjs90fT94slHSyEyap5ds45IolnqGNWN+ki5exJaqEskkyS3yZ5z1bE29QlIhh/J6Uen9yTr6H/yS/iZd0Yb8VFti8R4lcxv9yWJq+rAivujy1W0zy9S9SH4dwtrdD7FdGpIhKVZ3lKEZWmjRiYeyexs38MdrsWai9iy+tjdrgU9t8+2WI9xEuCImMjsyMmSj3O79lmGrZGVFonGyeG0JtCxGLHoXiYn8TEfi32iefiyEqVyZPG+Cc3XXj/05GpnYjwPci0lTNVuumuqmUWWKQ0maF8lFIpDgmOMv3NJKO1fGUt4iJcZoQi03V0PJlC4OGSkRlfb25cH1JDVDHCPYWHF70eXXY01G0/8ARKdpfy1+5f2HL5ien4Eofcen5Z6Tb5Eo/wCTyxMJSfwzy6iYjqjfLYi0WiUl8imRkTk4SvseZqRPctn7ZLVZNtshlZe/U42XsJi4JbD3YjEIlillqIuzFVT9hDMGPcpI1imOieHZTRZRRGEaHNR4RKUpGHh2eJVPrxVcGso1mqKLbYlnq3yWeqj1ZydIhxfsuCZiYcovjYhlLNEcnTH0bD5NmJULJDyuJsbDt1QuXklW3/AnvVlDW1GFsv8AYrHPskVP/IS+WaIHlw+55a+WPC/6jyl8mg/+BBxf2Y18kkr2NH/g4zRIYpNEcQlK0WM0s4LyTQpxRfW80Q4MXixZPeWaNVCdkGzGjqjfsIq2JaUSdij8lrKiWGeSxYdclRG8oxI/ZHifr9jEjWJJZLJDl8DXwR4yvpboXyPNrU/cng94j56Y8ZLk14cti/5jRpdZyI7lCKzd9mW63RsUVIWXYeHJvaRC+4yHD/c52FhwiuDRD4NETRE0Io0nlfc8r7nlP5H4e+56oupf8mJ9SMS1N/uSXGViTq+w5p50XlZ6rGmKiyKRSyssTvollWUODHa0IiPgWHpVsvJFJmmhNkZE46Z9aMOOlWyU2yInE1RNX3NSHKCJYvwOZeSVkMI2SPES1Yj9jxSqafQyAumVkVWV7ieeJPSQpx293Gw9S256YZcnlRjuShuanVZvJSFTNNfUUVksOTH6Wll/sX3K+Mt1ifYtfIyPD/cj2JeZexF4urfjoc67Hm/YeItjzo/Bd5YyuA3dGJ9cv36LbVWLC9OTFwVnJm7L61ss7LLNTs1FmKyJBLlmJO1lGXQhSMSOuP368KHdknbGWW2JM27jn8FvJRNAoWQw4rLFkoxZJ2/Y8RDVAWbZAex+/TZJ1Egs2x6JbMw24un72NhXuuhPci00USt8MWqb3fBKE9XJRpGs0yWJKVEUqGspTntpJrVRCS2O4hGquRmxSFxIi/TElHE1eln877H801Yq/KJtx4HJ2vSPEr8jNmuCl8Zz+k7mKvU30Iw3sYsKdlWLYun7FF9NifRsWPkXJY8tNvY8mcY2y8llF0P6n04eHe7JOi8rieYuxrllpPLFBIuIiMcp40YmItUGP2Huia0zayvJF7ZpZWpISJ7usqHIX1FIxtmmYcrXvY+F+ZZoRwXlbzuN/SOKHHOMmiOImUbUPEVckp0rItNCy2GWWhcSI8QJxk3tKjTi/wCRWLT3I6/zZSlPaka8RdjzJf4HmS/wIS1dsp/SOrJQu+nBl2HCMok4uEiTYvwaPy5IvKGFfOwnhw4MTEcsroTyRP56Iw+Rz+DUWX0bkYYj/KLBxT+HfeR5OGhzwo/A/FJcHmY+LwqIYcIL7n5eCa9Tyrr8XDdPps1WKJJlkThEULLsR5ynHURuDoi791oxYaJZRyWa34KKGhrLSVkiOI4kMVMxMO5JjSaoSSeTddi89O12XsyH5B+bvR/O+wnid17PiP6QuFliwp3k1lZhYxiQWKvuTi4un0Vl/oorpjyzbuUduhEvpz5YvLj92ObfRWVlmzOMltuOZeajN8RI+GxWLw0V9UxYeCuzYr/Lhn8//pG8b5iVjP8A9w8i+ZyYsDD/AMSox/IjWnxQ9AqWHyYsfUyiuvxEdUH1JadzVkkRRNER/VkyPObSkRuL6tUV3HjYa7n8TA/iYC8RhixsN9y1liQ1RKEISZT+MtrsirZOdSUTV6qyeWw4fHRDF+SlLdFVl6q2Yr75sX0v9yP5TVif4nmTr6TzJ/4ixHf0nmfYeLTrSebE82B5kDXE1xPEf0hcREnVj0S2Jw0vJl/AmYeNXJJRxo/clFxdPqfVVEn1ze2Ve1YpIasjh1uyTNvk0mhEYwXdCnH5eS0fY82u48b7ixkxtMo3y55RGESa3IppcmKvUUV1sxI6ZtdEFRis/LkiJJiJc5MjleTVi+Hk5JDx/hF4ku5oXdmmPwUUUvg8uJpkvpZDxDW0hSTMeH5hEWKW+3IpN7WU8u5S7ksNN2haHeWwxNp7npY8P4OMtUkQxIyRo+OrsyP5Rwn/AJGnE/yP5v2P5p6i5/Bc/wDA1S/wNX/QNrb0EUnexj/0hcLJJWxpPZk4OH7HI4qJtZZDEcSdYi+4l8m7kUUVR6+CK6EORz1vN85JD6lFydEfCJfVI1QgqQ52WVvlFpdhyFXccy5Ch8yI4UP3NMYnmJdh+J+x/Ey+Dz38Hms8wttnYxV6b9rxcfUnnBZNDzi1QyJPnJizWUsRIeLJ8Gm+TZey0eqG8TX5kaKoiQpPOxs+qJHE7VuMroRZ6Z8ksKuHmp7EU3qsw5Jx6OzI8x9zH/pC4R2Ey3sV8k8Gt4kqfIotM75QlTMSH5umew5fgUcLoWaY8SRedlliVjiuzMOf2FP9jXE1QFXcVFIUIPlksCB/Dr5PJSOGPgf9Mfs+JjcM+EKWS3fQhGJws1m5USxW+BRvn3aHGnaJb7iKYpZMeVepMeWj7n5q6FdibGrNBR9LET7Cy7MjzH3Mf+kLhZNFieTgpdh4Hwx4UkOD+CjD3VMnHTJo3sWT3NP4DuYcV3Jy36EP2m6IsewtRuN0QbZHUWO3wyDlw8m0XbGxv0j59mauLRVCz7EcmIR3JfT0yxDeQkl79DWUZFIQxi6F5mr7EoeqxU0+pSLTJwtbEZTsU/nOuSPMfcx/6YuMpzSlRexqoUhSLNKZpHg0mzDhJRkmYicsNSrddLH1P2YfUSxE1klnWT9nY9IskNL5QpxX5jz4n8Sv8T+Il2R/Fz+EefiP8x50yN54ip+1jx0zI5y4FwIkIWX5RZXRPEFG+fwf+jT8EmyHGTITi0yKyZJ7DxdlRKUV1LJMqI4EWy0fJH6o+54j+mLtlKKfYqhpl0RxY0ajUKRyN0UmSWltdDX4CPI0KJXQh9d5UUV0qx2RY0LK2dyJiwuGr2vFQuN5WWPgidyXR2ysnIUfn8NpNNCyjWt7UbpbGq1no9VkoqTKrN+jno45zxPpJPE02QdwLqjzvsed9jzfseYjz4HnQPOwzzsP5PNw/wDI8zD/AMjXD/JGPiRa0oXCzoaMSLIilQsQUzUarW5G4y5MdXUs6+4iUPg7+8hFV7T9xPNDI5XuR4MOVtxMSOmT9mSuLQ1TrPsL2JSEvxOk4EtRvQo4kf29iScs9TW5CeqO4o7G6yW9nYfRKV5UaSulcIWIpXGtyFpUxooaJQzsUhFnKoap0OyhEWYsK9S6n03mkK8q6VyNe/EeSGRe+SOxvGaZ4lXGM/a8UqxP3z7exJnP4t5a2iEr6X1bmG+dh7K1/tCdpZTW1rkivSPOU7zUPuVLglGunsh7JGqLr7jmoyrNko2NZxsciMjFje/REXFMxMNx/bpfsJmpj1fPW/wOoW4+CKyifBjR/lfsL1YVe14tfS8+3W2MX4q86FsKV9DLzfbJEFaHq23FhuO6e3Q8pTsSFE2NJX3NO/JpNPA8uyL2FGptodWn0Y+/CNFDWUMWWqqHWrkWmxbkuehMTtGNh1uvcX0jO3Wn111WuiryiRGKiy9UTB2bXteJX8v2pC/sFEXI3NzSaTQNMeSym2o7EG66GTneSZqNW5/s/wBl/c10a3/5G98vyr2JDRRLXsL7o1aZGHKzFW1lbWKe+SZGSK1JonFxdPptdS4GLj8HZSvooSyX05Ro+TDuhSud1XtYquD9l/jL6KK9lxRKHxmhZoxcV8EY2aON+Ty5ChI0z+CpfBUvgp/GVP4zj9KLzvonsi+ENHdbjVO7PTqOBbqiSp0LN6SMttjbEW55UTyYMlFxdPKhQk11r2Whezp60LLsX6WeHxDESUlXt4+Hpl7EvxtCRXuM5GmiLFkspLcqHyVH/I4f1FL/ADOPzFf9Y7SVM/mfKH5j+D+YNzopi4XQkf7zYxjy0+o7EJGNHv0bEVX7EYu7suzSYuFqWWDBSY0kiXOaz7Hb2HYvwCELkZN/y2YDmmP1R9ucFNUSi4yrqf4yhIUfelwRRRKNCy3SsQ0SS+B6D+UVhFQ+T+X8mmH+Rp/6jT/1mmX+Rpl8lM+Olpak8ryeUuhMi7VEo0+jVJ9yMnfIpCeWNH1CVboU9UTE+t9XYvb2n0P21lh85Yr9Am0YMm4L3PE4drV1S/FVmvbfRIVGxVnl5btUR+lH+xzTP5Zow33P4dfJ/DM/hZ/B/CYv+JLwmMvynljcF3Fir4PMf+J5z+Dzfseavg81fB5v2PMXwebEWJuebE8yA5xHJHfohJIm4y79SZYpGJXOWDKpUYv1vovLsJD6WX+CXOS4ynD0CRg/T7nJjYeiX26WL8RWVi6WxeyyTySNihie45Sw5fY86PwOXweZL/E877H8RI/ipfcXi8T5F47FX5iX/qmLRPGlJiZhzijzojxkPGPMPMPMPMNZ5hrNaPMR5iPMj8HmL4PMj8HmR+DzI/Brh8GvD+DVh/Bqw/g1YfwasP4NWGeg9B6BOJcD0FQKgxQgaIGiA8NGiBoieXE8rDPKiLCgeRA8iB5EDyEeRE/h0eQeQeQeQeQeSeWeWzy2eWzy2aGaGKPRa0mlEJRS93EgpxolBxdPoYvwyWbGRfTMXsNjZfqFlpGpI1WM2fI8BfI8KUTVIdi4LHIvoTNRZZZZfsX06i+iyzVmlleVikORqHI1FjmajWxTZrZqNTLZZqNTNZ5h5jPMNZqLNZ5h5pqFM1mzLVGo1ms597Fw1NElpdPoX4WuhjELofPsMb3NRF+oTLEyxJEoIknBljnFcsxMaHZDnZf4m/Zss1l5XlZZqNRZeVliZsWXuWWWWWakWjUjUWWXklleTL6NXv8AiYbaumL/AAaXsIWf5up5Pgk9xy2IsUjUKRZGR5sVyzF8RAljyHJv+12WWXnZZZZZZZZqNRqNRqNRZZZqLLLNRqLNRqLLNRZq9+rRjQ0S6Yy/ApZMXWsmR79C6HwN7jYmKRZqPNoePIc2/wCz2WWX+Ovossssssv8Bj4euI010xl78Vm/alwyIupmJL0jzSLL/U0sKLZjeH7xRXQnQpX7i39xZT4I5WWXnicE5tmkpZX+qUeI8PfqiPpUsq9lF9ckdxdGIIsvJMWWJ9LHyWX+q1l4nB/Ms1nuKXzlXsJ+xJVIj0TO4s45JkuGS5/ti/QKyluY+Hol9s7ysvLUzUihorpXXickeiXI+RCK6cdVN/q1ZMxoa4kk4un13n5jXJ5kWbdSfQjEI9EuSQhdNniPwlFFGkcf0qsmMnhxmieFKDKz1Fo2+crKbFhfJoorNUOI9iPRMQuifBEXVjcfgthDLEJDJc/pRZMZZBJ8mJ4TDkttjFwnB75aTSaX8HlfIlFF9DyWUkR6JHcQs3wR68Xj8HApUToiXlP9KLJjygdjHMPAhN/A/BT7M/hcTuTuHpL6nmiSO/RLkfIul7PrxOB/gk6NbyjnL8JZf9/jkyWWGdjHMDkRLgxnc3ms7Hmh8EhZskIRe2VkyL6pcEvwqLyf6UQiRLLDOxjmDyIxnUGSe+aG0OZqExZLKQs2PgRZZZY+myyRL8KihD/SkcpEssM7GOYHIjxuJSobytI1svNPNMTH7F+2x/hFlQ/0pHKRLLDOx4g8LyPZHipp4jNRfWs0yyQuh+9Nb/hVI1Dl+lFlIllgj4PFYsU+SPipQ4J+LxZ/mL9lPpYnnftxKHHLE/VaykSJ+Iw49z+OafpJ+Nxprkbv3YvJfgOCLTzkTe/6rjl4rxUMLbuYnicSffrr207yv2bNZqXQ2KVEZ2Wib2/VkSb0wk/hE5OUm30UV799No1Gs1s1F52WXmixcD/VeHyYyvCmvsSVZKDFAr+xRNJFbEuf1XhZY3gN24n8JJHkTMPwk5yH/wCnf9RPw8oyolFxdFFFGk0mk0mk0Gg0mk0o0I0RNCNCJKvehzk3RJ7/ANspmlmlmlmlmlmlmlmlmlmhmhmhmhmhmhmhmhmhmhmhnls8tmhmg8s8s8s8s8s8s8s0Gg0Hlnlmg0GhGhGhGiJpiaYmmP4LCylwSy8P9RIxvrJu5P2KEPrZie/rZf8AbImxqRqRqRqRqRqRqNZqNZrNZrNZrNZrNZrNZrNRqNRqNTNTNTNTLLLLLLLLL67/AAWFlPgll4fklweKdX+ATzxf75Elx/f8LKfBLLw3LJHi36+he4srJ3/fES4/v+FlPgll4bklweK/qfgNOeJ7FFFf3JEuP7/hZYnBLLw3LJ8HiP6jzibDyXspmw0T46KK/u6Hx/ZNzcplPKmaWaGaGaX+BZhZYhLLwvcnweI/qPNdFF0Xm10pidjhY8Nmkr+8of09dFdagVE0DVCimSjWcYkqzjTJZKqFLccdsosmyDJvcg9zFygzU7JcFsUtvwLMLLEJZeG7k+DxH9R5xy2F7likWbfBoieXE8pDwjyzQzSyn/ckP6elLorpgicsouifJDke6yXIiXOeGT+rKHDyTMSPfKZh8mJyLklvHJfSdyX05Vt+CwssQll4buT4PEf1HkhLKi/eTymJs3zedFIpGlGg0Gg0s0s0s0vKiv7Ij8vtV0Q4Jc9EOSLJqmQIPcnznhE/qyhw8p9iL1IkqZPsQ+oxOcoO0SVMlwll+U9BKtP4LCyxCWXhjE4Mf+o8sNF5P2rF1KSPS87GLKiuq89hpZP8NRRSK9tH5ehdbzh9JLnKBPYhyXUiatC+kwyfOeEYnOUO+U+ERdMkrVk+xD6jE5yg6ZOO6J85fkyv8FhZYhLLw3cnweJ/qPKEqIuyhoo0s0kiuq+u6ITKTHArKyxND05UJE0VQllfQ/wq95H5ehdbzwya3yjyYhDklyR3RPYw+TE5zw/qMVb5Q75S+lZYb7GKQ+oxM0/SPnJfQMirP//EACoQAAMAAgICAgIDAQADAQEBAAABERAhMUEgUTBhQHFQgZGhYLHB0fDh/9oACAEBAAE/IfyGNjY8P8GYSEhIS+Z/iv8ADvwv5n/GtlGx4f4UIQmJ8z/hKX4J+BS/xSxSlGxsbw/wIQhBLBIhPJ/l35n/ADk+K5o2NjZS/PCEEIIQhMv4r+S80vywnwP+Fnxb+GlKNlL88IQQQhCE8X+JPnfyz5H/AByRPho2UbKX5oQSEhISIQn5dwvlf5L/AI2fC2Uo2UvzwhBISEhL8teK+V4f47/lKNlGxsvzwgkQgkQS/CmOv5N/xMJ5t4pSlKX5oQgkQhBL54QhPF/k38l/w0IT4KUpRsuL8yRBISITCX5y/jH/ABzZSjY2XF+ZIhCEEvy+vgXjPyZ4PypS/wAdcUbG835YJEEiCRMQn5D+FfgTynxzD/DWX+NPNspRso2NlL8sIJCQkQhCf+CsfzwhPF/irzpSjY2XD+WEEhISEiE8H4L+epcP+KS8rijZSlxflhCCQkJCXm/5afBfx54P8ilxRsbKN4pfCfBBIgkJCRCfA8Lxn57/AAn+SvgfxwhPgXhSjZSlxfkhCCRCEEvjnk/z3+E/4tLwa+BYpSjZcUvxwhCCQkJEJ/H0v4b/AAl+KvwFilL88IQSEiEJ+c//AAieS/AWKUpflhBLCCRP4B/m0v8AFvxXywhCYpflhBISEiCX8HCfnLxv5U+J/K/x4QSEhIS/8EX4sJ8T+F/M/wANYhBISEifwC/8CWX8D818M/BgkQSIQS/8lpfhfmvyEiCRBLCQl/HX415z5n8zyvwX5r8aEIJEEsJeC/nVh/gz8e+LL8C+Nv4oQSEhIhCfwc/Hnxz+UXyJE84QSEhISIT55/4i/mfhCYRPnYvOEIJCRBIn4T/mKXyVYLd+V8Vl/gTxgsT5KX4YJEEiCRPhX84s0uUbFYyXsG/WFu7P2KxLs+5IkIGiiyvzJ8Ey83zhCCQl8a/nWxsUhkbY1UO7Dfvw2NrTHOBo+mPMWwxp9YiaYsv+BXg/C+UxP/CWJSGvgtYgkXJ6HWFXrGyYeqDh6ZUvYrlCbfs26KTxSjYENcl+Sl/GXg/FeMJ/4S4FoewxLC5wQxGjk4FBz4P0KPRvXouxeyHEGyk1rCacDbGJ35V8MJ8rz1/KXC/LYkOZbhiUam2NSyiCJ0bwmES7G2coabOhwOVcKBusTGPmxKQyC+UIT82fir89fiQa8phrZpKLRbysO4N4XImG2X2WGqOsg0Vg4Ys6E0y4XIyv2PKfBCfyC8n+RBc/ivxSmHPE20xIyG40oPLeKcFnMiY0wwnoTH7cT7JOx6KJj5GaPFJ86/iV4v8Ajr4rRV4s7CJ2WExYYucLoeZiTZuNYSZ0MoXVmhPDGJzEv5dfy6A3bxPgvgkcPDO8oYoHoo0N+BiexvE8jGQaFswhB/yK/lwdwiHl+KfhBaGzZR7WKXKlOgNUNL4GXBooheD8J+Jf/DmLWsL5QhPkflSQ2XyWHlti3r+bhDZCE/i2cRv8FIg0PwnxTNyhimPCeX+bPCfzU+ZR38cIVkIZqxQhCEJ4P4J4I1Dh/wDHVh/Jww/KCC8nkfoIhgN9eWzFFEITyvlPQnl/kT8Zfxr+Thh+EEhIgkTBIQWFILgdw7EMf1PqdQPFoYf1xoeBryRCwSxPD+a/wC/ilh/KlR3jWVhBIgkQhBBQSwRLFwyFocNux0MtsVj+p+uGAxrxQjRAsn8gvx3+Gh/Mmi1hkJglgl4JhLeF8EJirlDYjK7NesETBomxoWEnisXDHF+VfivyL8d/wbRi+CCWJrKS9i0NeCI3iCQmUVlS4NoaxqG0lhUsJp+CZw/kv+CfkvJ/wfOPK8EawRQ6NeiLxITCMbNjviQWjTIIaBnGK0UpRbZJCfzT+R/wTG28ENESQkQSEhLKEsPEFjQsL+RU8XKHilrD+Z/xbzP4WE8WMqymNIQhCzrERoyDWEFvtl+/AKeieg0ukMKQx4bwob4q/leZ5z+DnxP5l8y83wc2IahIgsI8BZTEyCWENGvCCobLgyjGnlHnXM/K/iv+XX41s3lpjFYmRWNBYaILO/vBIQMVir0aHhhs5HrHic/B4XJwl/jV+Q/nXyrwfg8fCU0ZcDx1i3GKE6F74rQRTLikzIJ7ILiDQ0O5FFH4rVOH5k/BX5D/AIF4QyWFGLLYho2GW5MIod4E2LClEnvFBYayh4YymJMPNmYll/k3+Jf5i8X5GrLNsriGhoRmXOSlGGGYMSifeCCwUJjzRDkPwj4H/BPzX87R71BciRMPFg0bjc+SjirICQ2Jqzcon1gWVlsbGPCOO8yhajrZSjeGsXLCErSIJfO/if8AHQn5K8G/GByRaosNZNYSNMYhHs7UfW3Yksodwy4jE/oTkKPEQ1Gvs/YgQTC6tY9RcMbRqOWEUC+VYeX4r5r5pfkwn5l+DZnfGhIgjHkgyzghENFrobfoYYwpCJxjHQzAasKf0JxrHJDZRFxBKJMl5f4D/MX57+NfiPByibYhYZf1GvJohdGM1hT+kOWMNxG2xI1+j+v6NcEXoe4tHtxe4lYsJtZ3C7ZmeL8V5P8ADvyz+GXzpYmXktAiieBRn0xwCuUJjAnYSEhNi0jkKcQNNlFMV1EJXeKYxQNQkZBVDMpghxeD8lh/iUvwzxmOx/ySXg8M5mk+ImMILZz6D6mxLjZIWusFEJ3BCaIIISDWmEJkk/XCCELAXgSBw8H538R/DPJeD/AhCfw7M1IWFiCG2cRCDpRsdN5lTeyS0TR884tIYZaLiLKoQR1wx5NP8bfifzov5ry/xaXDy8efAsINEhKxMMPDc16IS0IZEi32NWO4Q20PD9HgUFQ14EggmDQxxMIYhKil/NaITE/jH+OvBnI5BMWEXYsLnFGGOYqBh7EijGgoyBHZcM2BCaG+kNluz3DoiHA2kMMbKMY+5pUGcGD878d8F+Ilh/xb+ZYawzTZzFhCwsa40ZyPZM4n34Vl5Nhqil9YopRCbw0jsbKGyjxsJEHwcvnpcz8F4Xk3/GP55iDzCwsoomzZXiRCL9mvTG4WiYSMoyIPnIeyIFLii+wlqTCweFypyJg634r8UJ+Ci/z08WODxTFmCEUTYq8NHsNjaKE8G7yU5NwdsdoRruZjRE+x3yUfGBbRy/iq/FPjv8WxnF4JEzRM78A2NmrDGsjGUdYocgIoxN40UpSjY2XFxwPeL5CURSl+FfDfmfyr8FfwK82QXQufBTnKEUUuBtFyRHY5MvobrlDd8FFzGjokZRiQMVFQxvLKUfg+hCSijP4KUvhS/AvyZ+O/zF8QufEvBwMDYT2NSId9iK+4lzGhIuFLLycjQxQ3TBEKkaZUuXlj6IqaQT/hkIT8V/xdLlfKvBriHjn7kS8UFtRnshSxLhbi2URS5bG8Nj1iZnUfBq58q+GYvxvC+CE/l6Xy45LwQhjY7Gwce2cAqO3U6ghEv9DNNRAmoKXKaLNODWUHHijFLcOZckMgnr/LvwPC8Z/Cz+EJCGGVE1jSOUsIvoFewf8AyJWFiNobvg/FnA5ZWxME1/DF+YvxH+PwZ3gn43BIXGEGXCisWa94E7opCUNAmXyuGN5Fxn+VnwX89fLPN/j8GNbEITL4rM2MeKUpTnEmYoFJiy/JjOQlZgZo8T4p+SvC/kL8N/kMXCieF8DWxryPEgi2Ih8ieH5sMShaF7Cxvwf47+JeSf4y/jFyheFykbIhl+xWjY2vRUaNehaE0hR4DxfgeE/iJ5r81/xAheEwhDDCnulg8rLAojeV87hvCa8r+NfkX8I/if5dkPaCaZRCxcoWD0cZobouaUuK1wKLRr4GNjY2bMSL46X/AMAf8NBXOExPNxSix2l8Li4aMfwUbGwm/mX5E+JfgP8AEv5zxYDG1lMpcbkbSL8KievOjY2N4l/IF8E/mmGFhMpSjxdCZRr40pRGw6sFLmlGy4ZdiX4d/NQvmf8AJPSH2PLvKwxl+IfCSGqh+hRVm16HrFF8DeGRRCa/i1+BPyYQhMVE/AjE/o5BFRB1ccmrg5CBYZ0LLeGFh+SLBzBc9oVsMWhSlKXLGzcCX/xKCf0LuEnRt2hL6J6K8ofQV7PoxOWRY2PpH6BuRkYnfQu0XaEhPqQ4VEwbkGezYakFKtcDNKH3IMJvCVeCE8LEFrgk8ELVv2f4Aw9xCl/RS+LeXMT/AJ8xCE8lmEyhfgz4H4MZUPUOcRvC0NtXsvay/kMk+xqz0MduH/Q3tCRq7G3IlZFh9AinGD9RPQr9izqcZTTvJbUJL1geIWZsHxj3EIaJ8CYxoGrw6NcocW//AFHrnF0mSD0Gra+PXHSx9Z9J9YmdPG+9jfQNPR9BRWB+oj/IXmhfmNb0PWiEMq2GwlfthIjpmcDXeNHKFHAYpKTg0Qqhoz5TF20E2k4/wkpyNmKWvoV1FRU+xf7jjcZ2B6Nbi2sOcwnJ2LDRwxYXhS5aMaxSvBjJoUVjE9Z+54Pw5FK02SwRrwaIX6wSeMYSSfQj6x9A+lFugh1pm5fizC/gHljaFLwK9i9uB8zSQLmXLG2onBVRswmYKNHYdEkhTxoy72LTEQcHThUTHA4CUDVi2hKIRtRA0TcFHFiVZ/cjKIXyLPA1ki+FxSlxouKXG+i9M7yx5MEbvZizSIOI/pikaEkKFRSCSSc1EykQx0n5wnk8LyWV+ex/oXQsunaOVpsaxkYJqzHAOGasGhciOQcn9QjEN4wRB8i4FsWITZwNz6wxtDizkib+hz2NYsJFyssbWL8V8d8jnLXsRtHhjWvSFcQRIy57KqJjtGjD9z9sP0L6YzEQpNeFNkuUSfK/nXx356bYtQit6UonOXHEcneOgPslwz/3rFD4xso0NYWVtevFpTWjo1/Y5+xdOoa9xejmPg4ZtosISoNJbHxFoomp1ycMLxhDYhfgnmvQjX2SkCEgyzEbBO3I4ShYM8oJQk9CyIQRY0Qg8IuPFi/GX5NdvyUulhpl40LOoXY5QRlH81DVF7i4fg7WxiZ8scFhpTjE0bXOD2glmpciuBxv0h5V0Rdou1vRFH2i5HD+CDMZYVFXvMIaKUuIQ6uBRZWMuEOMThhXpEU9i0iDaIucRFEeLuD9hMVlNjLCGw8L+ZSl/BoEph8CgY6NusX7JWNCGtPXwfeM1/UJPsFHTljs/TuBVNXx2cbR4fGxd09CWsO2qREIRSFdGWlxWd5WxjZP+iR/hGa7Gj7R3W+RNXhiRsRfhmEY37P3P28BMslVapCeEhGzCxqoCU+YhsiXTSV8Yt8ISYTB7mJHRCITBoZRXwn5Cy/w+c+BJIhvDvXJpW9iNQ8NdGwLFoQzXorZyipDd/0bl1Zo/cR/edCOq2W0LKGqEMbS5GPkYdNUWm6Y/uiS7NTul4WMclv0f/Qscfsb2cG7HQxLWHNMhPxuBUSb2Na0MfZtwN1FPkTcWhURcFc6qhzj9OKcijoTWNEIQmGMSlH8hYJJcELNQWN5no7jXhI/awpxRjoxNDVU3+hSz+xMbSNP9CVeBcULRKb6GtHZ/Q203yMU0YzdPO4NY0tdDUbC9HN+xKpyzl9wWdroKp1dCXLubPZXIXgi/gwmHK5EzJMB3RqoettCxFw8hclOBXLOPBYr5QaFBB/x1mQj4WitE9e8WNkWJqHc3b9lCGrgboRlzCOb8ElGO5O4rLH2exDiNG9plGxyxzRenBylAUk7wJ5KWFBlAj3c8l8mzZCDwkWxgX0heb0Hg7x0N4twhuYVruAghp4ilIQkeS5Y7f41KJwNU97FSORqqCU1aa70NZ5x1JKboZYC6PBK5Pu2bT3NS+LTkTnQjS9jaciWGozVhCl5ENNru58GjhchYjfaLeehaSEJ9CtQe1uvxG8IigTkxr4Uda8075HDRnDJPsox2JMGCaFDnwLd6QzmDeAmLK6LvN/DSl/JSNVEjRWLaUw0Q9vB0Bzcl9HrEFOY0DHVBIsUcxVGKrkKo9iLrLliXh1VKEWfA+iNmEmyw4G5rnoUOY/BoXpB4iQvR3AtINjH+mJT7Dd2r0NtGsTxXw0bFXpI3rUfZsaRKRpDnc7wSJsW0tRVssPw2OQ3i4M28NlNIlzg/diS0i0cFKNYhJ8N/gexkWkqKw3RRPmuGhLmmka5Qiw5RrPKL0HpnteEcR9y7Eprx44dDAVNJJYRdKD2N12dby/YTT4ZwQ5Y5iqTHgMcDykg9LOWG9iipT5biy0Poa17vJxGkPCbollIQkPHiUYbBspRj6DYSiJG3Aq1kBhjRCYbOl4UuL8s/ESKhKLCHIuyL1lC1Wxmm1CNH3KN3OeRtNhpw19NnApMUNHPFPFhwBNpxKWMOOKWPQqf2No2dDZTU2JJIh/g+0w5j5EhckwKpjMor4J8hrstM40yE+KI/s8b3TwlDZ5UKuhB0EiOrRY+XF5cfCBbGxMU+RAvhGETTuQfwT4J4LynxpbEKrtpBbedxoqRO5VD2nPAt9oRZRKomucoVKbWCxY2gIchzUGSaG8pwfXGUpqd46aOSwijP9BCVtH2hIxqh4SpmqQxJjK16wTZw4IQknoT0yHzivYRyJsa8ITxkk+L0cGiNiUPwPCXoNiUiXSFq2NiJ3Rctcn0UoxURCEEhQQjEZ7wURR4tWYTMIT8GeCH5o01iN69eD0NdrTPoJBq9wXRWn2dRKC45jwBHhp0bMjX7FL2aZ9IfBwN0chK3aIhd9Mfem8TBJ+C8Mht7H1AG44M10QawjgJd9M5VDF/twRQeuBqEPBO6hUkkQyYhMb1/wBguovcMKGiGvC0MzbwROWJmFIREBm2YVC1jQoikm0GMmLTy8hCEwgiwaEIhQjaPCazkGswnjCE+ZYfkijIipRYSNZQbVmUphOyQSL/AKEa679+yRcCpL+z7HXfYkN9H6mxNQEb3gfWO/8AR0zk25fBPJ7eRrJho4E7Zx8jUGNR8LBz1WD9I4WtoSR6Bb1/Q7NyhCjObJXKH20MYWg+wW//AATpyIQmF05DrTSDn3r0MtjnLeGeYPSWFBn0DAmiCpgq5ZI/zFELhXGTYaNBDxBDEMUuSyFyrwEN2Yi68Z868FhvzQsQiY30SZt3KScQ2Tx0aaqfjCf2I4BEmXi4FqblFh1iizZXSDmMSFFliG/zLS4ZFdy5WTRFyyaOVVgjdELwObuh65OmopD9m122HS2GuHiGQb9QwLUVwLXGNNpjeNpPs9P7MbWPfYxIh9z6B7HFw+jI/wDScD3/AEIKFqC2WMIhUmY0xYlR7vtCRtCilqD4Gx1PLEELwQhvCCWwj2U/EBeN+CjExPc8GJ4WlcncDkXZR+DU1aeODTEJAtlx0K+82ZGz5HYuDniWEf0M5CdmWj6yZpcUU/2MUdXK4f8A00Kr+xk3GODqFmwnwylTHQuMbomFGLTa29/Ypm/KYhVbRYWjTWizOCzk4KMLfZKTRXpFhWPwQiEaOR+jEtcfsbjYn6HzbKT/AAEl0aO+9oVoXsGlCpYDa2N7+hEFWkQ+zYxt3CHHYVptSEI7Rv7IV4fDGfqcANDQQilxRvxRcHJNG4jPT6EvgGo/wl8iEoSEib86IewadaEphR+KaemU08TbTVplgo9D7E8yI+3CHgtdoe3HZFfbDKaY6gzi1/7Qp+76NltvQ98ILHtx40PpiCy6dKnt059FCoT65H6zAbQ25pDLfGDnNFN6sbwnyfBur9wZrhvDxMLCWhDVtL1exn/+obVnUE0ORgZXbExHsiOxAkRqylKll7nhizCXSkbKEWiw3IqP+DMaTUYnRNfUSc3r2hNtoSv3hhPwo2JjMZipwLMJ/wC7HJK0euyTk3+EvkoyKNk4GM09Z6ThfiLlN+0JpnAjk+BOTnWEzVJdc6IfSOhms8WhsbBiH4Nol1wF4JzOOiuYSouDYRpDgLT7To6MZXZexqHahm4XI5fExqCeNJiN5Aiq9IvjUiKtCb6EwaZxjjHMRysHXpDQH+wNCq77qLU2bI6bcsTbhS13+0bzCiOzpKGxS4myMQy43lukVDvY3GKP9kX9T7EaZTTIIJ5Y2INgYYSprA0Jo5AMhor+Evk0EGVmLZQkPXhB+y3GHxGyIrNCR8PxcdiQ/swlUx9EiaXCEa+h0P28CY+ORabxWrCLRSOcN9EHh0jSouMM3Cwd3gWJytboaabXobrceyGhNPhyI64nIeiGkJUTejUwyVqNB2GctDqZ0Rt6RcFEKrFJHAn7BGwx09ucojh7lM2RntpGxzMVEhpKbeKcIbnOYRkOhB8jf/SEiId7NlLsSeF0oPLg21gad/8A0xycemPTg09rAnhjwg+ZhSaT2eFKJRJb9Hf5lmdiEsM0k1qKtqM475ylFFOCkKHxrhQvaF4cZWtUPbSI24NGnpkV4QYhseaS4t48JQVuFwOsLDNsWjkVIbpUuRajVX2N3Wje2P7nY70N9hKL6JOF/wD0b/WFegNZYoshQq1htvQaxfZ//Lo48fs28rI+B2KYrEv6NRoJW6m0P9yOE/7S5HUGf+w5ht9osrCRoXEImzlELEV7dk5WGlEgi5SrgN3BFBWNl1wUuG7Y93XrChpr/AP5cdM/QjILQmXKwQcfp7Nw9Z16IexbHQLH8F+DCEIQmEiomxbC2NGJNKHAP7EJG6pfEYxFpvgaX/UTTwUThCRzi5NbuOp3FLrLrX9Ad/Z479CxVaE9rwkga204LjSFBqJtQVzXSwJhITRWyeuB/wDEHyQoHXBCTg+UJfuRANhvAhWu9momiilsCPTs9YYlYmIz/scp+yW4btE9PofYum57sJB/piUJIQybRM42M4KPEb9l0V74IlAXA7ieKZJro2W3oJNZKUv0RvGUOjQ2IjNcFdrn0OPL6ehKhe3OLk2RKs9eCevYuG7w2PuYvE0LK+efAkcISMSzC2UK7DBTgbeVRB7IuJR9HwMrZCYaJNjK77GtiU23lcZF8BK6EilN4Q+4THRUgkIpJuEfpwq4g8DyiYpJarZB45CD2djXIR+mHDGjKb2dmsfoo/YTjKJMYz2So04mmwchLR9Qp7R+uNF8cC7Cpyh2qL35QwnU/UZoJC0giF2MDV7gr3dM9Ejr2hDUMnoTQPYjDJMYfUyqGyGicDKUPC1FrkWF+gp/yMgFp/ZtuN+h7H6Iv2SvltextFbhDjejRV+w1jdjYIfOJCdDjUdi/AXlMrse8DVIyFpPQo1cjeis9oo+Hho54mhQVnDjH6CcSq4ILN/0KmxEcoZN0C8fvDYasa7wn7CFpdM9LHRE9MXZFlfQKju6GZfpiZq5d6EtG8U9CGrYiw6BJOhlQFAQNytmumVJ3Qv0QRs0azTVTOBTn2JN13CRWmgr2XoboOPog2IQ0OiCqJI9fPDQ6TekW+cdiRN4UrUN9noS1oUXl9DK7bysufoFNQcqUeNT1s4LN8M5SSCKkN49Qf8A1GkF7BD9r0zo4Cid5Q7rgNimIQsTYzaGVfT2Xd3HBfx0ixVYVIgIJY/op24J0eGwZsNFwd2mb56Ghqj3Shx3Y1hWtoU9F3QsK0WKDbOBJ2EzoTcmNgvCAhvRhERH+yjwQhrLoIRNeBH6j9MTjHIh93kr4/4YqHC64vs0cbj3gInPdMctMrJ2bYkqeFxYfQ1pxoatmhS/Zs3g+syFY4USTffsegFwNuZU0mt3go+ckqvK4YtJoWFhpuMqfAiG7oRDo96EmoXYqVJOgMg1VtCGbP0kfTA1dH0C7iGkHPClstPtO0fsBZEQi2zQYbqj+Cg/C/IvJYQh3jjZXoTIV3ohBPTCx0zWQC4wKpZOz2iDm2MTY0ZqC44HjdUH2wyYdLx3zMNuEPvND7oht9vHZAgKltR4OcEHOsHimytw7c5J2sONQVDDTK5GH9j20O+UZQI+T+mPn3dpk9cJ6wMhhiGa0iVbVQvmtCbV3BlG9PX0XCK2X1jb3fZVmtXZV2u+Y2Yvodm75HK+fYzZiFovVHq4SHlFFtYSO5nVcS/QszGjhHGhIgzYvCEvDHtFOxMVPTG06dolP9Rt9PAKCSCdxzm8V6DviZCVNP8AHWEabOmzohxjTvY3TKjFgnm40EG2z9yfsrpKW2pGWuoqKj2p0VVekVWlsQ0zRQh6tpls4ImhC/Ydqu4X1QbohI7NjXyXLG6bZj9FEzcSbR7LDQNP1oWLIuRKNvI9tBOqjP6lndCguTTNMOc/2hr2B7Fv6NtCbIKUNJdIU2ET5QjavtSomr1940bbY2z5Y0IXoDebcYS1VPjCGUYmg3EKjwu2GNYrkaikJm0+hZf7hUuB54Gxt9cldnHNo1L6EPCFdB9+Q5o/2+ytojGV2FOpUTOIM6P02DRb7RFZz+AvhSmmjmodcFgw2W8VjkJiJvYkqafsfvsVXGxjiV2fs1yF12CzjE7waVLkrZs7G6ZBaJuxnaaaLbarXIlmQKp8FDGTxH2I8cUJwJDEYn+ielw/0KVrpi1imzfsY4uBrZMVs7bDmOEqGVpyijKTv9k2x0H0LcxxNCTouHpejEI+VYu0dc/ZqSVwfuPByiHdwSOAni4bE09YVMJ0m2trofSExKmZZToVNVtGhbjXCWV6EOI0RHTGu/Doh+5HrXV0/Q0j23Y7sU+/GwFe4h/h0vgk2PsS/SQbCGh/QnMHJtYYr9IebVHaKuLWhJrTY8LZHl5bT94COJwV7E+2Hh+uCOM2qa2hrUGIma80d2ZByHb9jgyQX0rH3IalTTHIgtPAmyL6/wBhm+RiUUnKGdsmuhrj/Qn3V9icMQ6Bo+hB+goU5Il0Vi6oQ0aP8ROxOMZG0H6GmWUpJuDXuoRFo0lksISMSqb4HwMRo9oiW6HJWE+v9nOFORtJvoUEkI1SU7IRVhD38IeHhuDL6jfkJ01W5R7+vXo+lHoyEIcBrH6GOWZ8izc3C1j/AEJosFyMWjLHW6KzCqGjXTNDGraVGp+hSQ+jQXHWyHGGnsbT9jxB3S7Fbbk7zwGIrb1gsTCqyoTi5slu6wvFNeyZoEmi3TQLYXJME3bHd9Cqp6HcwpsVp8ITMOFIOmz7SqJM12Bw0s5rFo1XsS5uPZCSwmNncY/qMTEStDtrYF7h9FA0CU9gQn2rGqKXHY2VemsJQpKLgYaeGGiRTGmiNH/2nMudCet7Y5VRpo9geCKwQbNXZtq//UU6RN9kJ0ZKzWNK/D3CZi9Q/lhoguShSBt84Q0JaGmw3QWCUIbEGrqGPm8SWs2XCqHcwOmgk65Oq+zgHDbGxbaQ7x8WKfLJFQs14MWdeT7+fKYg2x2iaiYxlxo1Kaei5Q+WeBVK6NEhA2q+xQSXBXMkeSGymyJf0hBf0CZdnp4ExromgivHuec8kq10LNEOxWi6sYjdJ8DYV6F2EY0I9CBxjEai0fakUSuEVRjwIon2MQOhMNydkcFODb9Qz+wjBZINCHxybf8AtK3fAvb/AEN/YgPufqgSMvjpcXME+NQnAcxM5gkEITdCEuL2NIQVmsISDZhTgQ+ntCTJaFbdsPsguh7hTuH2g4IT/gZDYzfRswNQQy1rITeFQuGCy0o3fnua2L9YMXiZcV5HEz7GvBb0xqJtMYqXD2h2kOyFFStfo39H/Z9IYIR1S+hNRDzW/QUbb7Qx/wCw2OANcuA6sbo1XcPwVtQghtBH/MZyj/tJovnljkJp7X6OZejlO/RQqpiWcmUfscLunoTCa5LTfZHImz0aP0W8ig2+yIysJ+xfY0JQjk4H/dhCa8YLaOhqie4jkNsRpoxQH2/sWvnIooLIUOV6EjE4NVXCYmIh4492L7+Gi6InBKC02JItGNPKJCFE4sP0JsdyNDQ+Gf8AaL08GNPFdj4fB5Fe9BsNcLr2KOM1hyU4wk3wqQ+4/WVRGTXY2fL3jkQcfAj/ACBbEzQ2ySGPZWnyc7wd/wCDRaKSsbrwmytGUHXFX2EPwXrtXQ5AkkSXWNkmmoxobQirOxFRoe3yPMr8sXArcMVBdXyR+kvtGhUmSJNwc0bNz9RMJR2XsR2JvAvuIOwkxwe5Mrw8F67Ec2LhDc/7vOMvG+1o9WnI1foRpyP/AHId8f5K/jQRQQQRRWcIf5I2zAp/1N8w0dCcG1VkrzZ3GU7uEp8DxOOh04OhlvD1hbFpjtjnnlDzfR0oKmaOo/2jpF1hsuOUnii9CpMRlpjcJw8NaK96FKxcm56A0W8d3pm5yORcJqRol77FscoekfYmaBQKcaLL9N4rSHPHWGMVE5GyWtim45Nm5yMXDtNHClOCMgdTNWvZUfRBvEsSVLTCTGsRTg2JoJP2X2PsLY93Yre2uxOzPSE37P2nQvWva2MtMZsD5eKWHSxt4IcjVjjT9k4Cn/LI6wLkfPivFFBBBBFFYiCQr9AonGOWg/IfQDxSCaKio/TNiYiaNQ8rWgwVceShuETbH0xpbpsJj7ESuzgzZCG7EJKpznQmnxgxEJDVWpiJov5eOmBIyIfqnfYrbVXDIKTb7Gjseo5V6xpZCxiOaZ3h7gOA3ilKaaxRI6Lwyjw2HErEU9BL2m1RqDt3z6GstGI/3QaOSG9J6NF9vsnPl6FRGjUR3ydi2GO3voWhM3FJ3dFF0XKmJm4gg+mQ3tfU4Nleh34JUSmUJPDWEd37NP3oxXdbDPS9oXz0/N+KgiisUwnh/bPNHJvAkuBryhwLK8O9ozRwDpLgLMWE9ohPWTEOUWxQ1YN4cIP0vRyJRMIJQRanaCceFGTISS4xrj/06rcGKtBst6Yx56Y+32ahjCcvY4N0PkvcZW59GzY/QTxP9EMXByGWqizcfYk7J+mjgo1DY9CPZXkikuhJEnTtVNbE5NDCaJ4Ddlva1OE8RN1R07Rseg2TZ6X9hXFrZyMnsqIVSTCHdUpdiiYL0m8IXhIS8Frw3iSNDBssXN/R9KHLX+/N5rOnisRfUZBYehZGRsCM+yFG0yfo47ELotbYuOkod0h3NkIMW9IM7C8ODo7h3C6CRqx9lNiPkhC9jo/YNCYji3RFFzNlZ/UbMDGIozj2QRc0r9iD11Sp6I4BKGiy2epBNt9DGc8NxQc57OUKucI1+xPtkykiINaIJ0MjEmV0W3oP3KJwhNoTKCQ44zcWK9AUKvHJ2BjaYuxGxfQ6yr39Cb/smLoBqJOFdU6PbP0yq3+h6JvYZgS30SnwXgvGlKdo95B0zacAvu+whKheD+NIejP2Fi3RFofUTIIaoxMWkUuGO+dhPYmEzQ0hIovR8DsVmrggJDmNPHMb/BZfCzQwTSxpijA3IKIRIY2Pa7hs5tDNvZcNNGi2XgmUVqXK6eC4ro5GtNQh/wDQ0PY/qzHITulSqpGNWPIiyL0Nr0JLsdsEplPKvgR24W3PRuDJFukNjTReTuUmKUKximf0CjaqQpLpcpkyJkGx3wxorH75GL2pfRJps/R6f9DNcP6CT7WxPuoXsFH+w4DsbhleMEvBBLDWhtJrKL2U8v0xrvYS1b9hf7+DxS/DVnL1luPRFhqm1g4UW7NnCLhj0NUQTDbgTyGDMagdlPYPhCVDVRod8OKxtxIdqNJzomEGE8okPZbHq0+/CmB+iaxOUIXGtCF+BU/Q9EbjZ4V2MgmNJps5M4EMiT+62i7JV/h70fuWYbCwxOM1IfvAyM7HIhWioWlSBr7DcNgg9iNYTHhogUkTXQk3aafZvWmEgIqEaUXQ9xol7HKc2O9HCaGhHMGMUrfeE70FIGOS5/WV4bwSFxfDgK7IUVSB/wCxFabhgbYxlG/FeSQ9I13QTsKWLoiLiCScTHtYE8C3SUlhSbgwRmqpWJkFWw/QginBODQgcz2NOCuGjo5h+hsrOAmz9A3QH63CNj9yLD3GEdCWI2zg0G6v0ZrsNRKWVb7Enef0Kqrb7HaJ9lEkEIRUTaD0TLbI4NGw+yArciIJVsRdBtTQtyRIt4Grs2UeFGn+6N0ihacj/wCIhBduBiA+xeiVbUgaRVrLvWAKtb5FMl0tOF9od137LUmqEl5w9DHGCh1I2nsVAvoIXeHYv6L7GeuF43BsWIQSw69EYXJHQaJsf/6pvnX0F/G/Zfa9sL4LCysKE5bfsSIQgytjqP7OC2ht6LGX7FiQaerg1VRj2GgYhMJHhBZiYtutZ2xqdDIywdhxeNlxitDOWKITwIruj79k4sJ8CLi2jStq9Dak6F1PNnMIxy6/3iuBnWg1ybE+vQ2lL7R/asWC0Xghxo1Lqnr2S+CCC4LsjQh0IyM0Ym4vB6PsbHtQ3LoYkoUHCvoU1hNsQkiWFEuMW0R6J9DnK9k21DlCD4NEQswVz1y2cHtsbzeTX3Il5QWEbNiWGHpAuRUMElKb0Zu+H2OxgxbaKi5XisbhRrsSPjCGojJIjRplcbDgmcEGLQGm9XAnG6QlqwxuIiYWD7D7SjRpQnbxGhUFyGAuB7uxcYufY9YVwJ07S8Ec0/8Agyt//rCZFXoEDSSYh9BwpcMbLnO8OBYUbiMAxJpdjy9tHyETVoUaex/2Zo2Ic4dHpMdCExOgaLI7nNsdMcpQ44eSbOhhr6VHCCYSHws0aWv7BKL16HHwMNiI4uRx2K9CcYtJ20Qv1jKSzFnXkni4NjbMen2xtOx6wo4O8PY3ydHB6Pv5rGjH7uEGcj9DXYkqti2x4XkZDdpdkUoukNrDrEJ0WcmByo1yGyLJMTmiCRd4aYy1qESYWrXhnXFDyTo0maAc/OjqL259EGLslXAoijpcdiwlIuxXs0MRG+BGnHgh4Ufs3VGhdUdLkQaafo0M1eIXQSFOPaIqcD3/ALNmcFEyCDuEuRHMcjQuhsJ49+At9CabaXK8EqOGhCzdYMo5r0WtcDlW+0QRF/cuxunFHQZJKWzEyDbHN5Uosrx/SF4MruKIHdHZDFNXfZD6jWZ4IRY9sWhIWE6DaCYSjsS0iENi0qDTaNENXi9cHGH9H2jDXokuBLRlLsSbFouhIxThGN4O26GwaHg8bWD6w+EI0Vo/DOQ/BYZcQd6oMrJPY4aavoX6NBNmysfcLONp2EcumxXoFUEaV1CPOCDXselCJDexui2uyM9ITx1BcIUOm6NUQCantEPgmIluNFNmwj9mmjSENx7dDWlW8qXsiFwVag3nBv0KRyfRR0OtmMtxkxDUbNheVE8LKTbhPTZjYnhbUNll2UT/AEcj/wBM/JCETvQRYUbG6fTZDkM5tLwmCvQSLTeBzG0OTQx7PZwbGhyI0LAMKcomiLuXtUaKc8jiKRrQb67Qxi15JDkVT2LBrsxOrDWecTijWGNxUXgidqMkNpbI3+jGuxmcQ1i5BZY1p7XQrSurJfZokhOvY5Kvop0O3C6R+hYUza6ID4MvfrCZE1GW/WWZoN3D4EkewTBKJiDAJ5RB3nJ5gUpYMtCG9rCjex7G2ie0TuKC6LpefC434LCmW8kzDfggkiENcoWddn7/AMlj9UGw3YnRMIpIo1g0CvZ9g41uRPc6Fo0VDkVl9o30i2BxqC0vIOQuBWxcF95QiDJ4FoRZtsSIcFh9C0hXgUYQgi1WGQmasb31h4arT9DIk1wD3u7BkT7IQnoahHM4CHcjUoP+wnBPkhdgjOBLU+4imi+iJpR8jfMjHGmc1msdDw1BiOUQprwTHZC08dFFwbHDQ6fWCjUM1oSHuiDSJt8B9zgb5DIO4cGxT0jp8hY0YhCM2MkVM+pemQiaZfXxIsfvQuhNCEQYErg7AaulGK3s64JY/wDjAp5GzshSRdEvsfMJ+E0KmHD00esn00Kk7hMbQPYmXI4Dax2ORzUV2MvAU0XKiumgcmw9kIm+B9aCQj8UOpjXej/0cr6YLg5simbgIxW7/wBUZcRr2LQo1aeshozZCCgNUYkTsb4fo52TCZ+3FOn6wvkFqJrldZolKxI3bNEQoxNNuSyGo04+xRfXYth3ozdcA3n2xNGObfHWRSVEjdLxbD+0M0EmhGjZpnKHU/hCxo/Q0Y0bNkVLjeMQ8cYhbZSesKGof0wjqrjXx/8Aua5yf2Q7F9hxka/QuCzQhGPUHSZD0GkcrPULoaCIwNS6Njg3oo1NQ6KEyieoLShRM1cxdjNSLo6a26GTpeswlshxrg2IS4x1YWBWRZuR4Lbct8wfV2Os3OBknRbtFGJnyP8A0jZyJNCxyNCENhsO/wChh+v+gdwPgVYbZV7Hsa5GkLeNkepiFkY9MDa04x4dsTYibmz030bnahFBibEkCgvDfY+3xofBJFKDOgi3aYle9PQ2QzJiHhx6Nslr4EIW4x11+zgN6gxqch9jTYrIfQkO4CS4G2IJENYvLTKjS0b8Zy7+zRsL12N+0cSCRNEhEgnePgWlR74EK/DEusAXQuTgKORRrQmHQmJvtY/Y9z0bKmhkV0d+rNKfsEuS6Thjw1ULSIm8LbG2RaYol1CAMl9iZSgq3CHehy+RFu3sx6tesSOsUQ350dYY0G7wJKihX0O/YWaULhMRCZhLTKhvXsTVRsTEpsqrT5FumhVWJqdDJQIevPyntknA3tEtHdiznI15/Ya9RzGpoloRQhX2DXLzWJuvYhox7B/3Fid9ClyVLgv3h9g3qn9HUhIRaP04m3lhTJVRNq3Ri1A28JpwXLcezTvgSaOwfGNgRt2fQfk5wLeHQakY5+dZ5iF2ab2QkabnB0ZRCHCTEwdKdYh1KLjG2XDcKDHYW+xOyEaH/uILkZLkTY8Wg4hC24H/ALD6C+x9o7H1D7OgmJ5VhClxSi2cwZwFt3IriFhtsTR7RfGC6DUdRTh5eijieyP3IRSIVMc/uYFx8agsSIEvRtraP3o7h8mmNDPaFLU4wN/BJDgM6TzQiwNDYOSg9N1/oSDXrCpe/YlL7ENpqNDXdX6G8Thxk2dCj5lFj6gbWGxpyQ9IUd3EbVCkjPUbJaQTrT00VxLS7OWbrFBNFxs1TUKWjins1e0caCEcSVWPDlNCeD1G/wB+BvyOMFokjc6QK0Td1yWxtyKO0apkuaGxSO9D/mA01bbNqDDvnBYVJxewU5WDpRZGkcWL0LCEyfsG8CxqPa0PSrGWhw5PIxo9hto0tpEUFVl3FwJuLY/2KWN2jWA0/ckFsXh8LHwXoR4X7E04dwGxZU4TKqDZM4UCexRpoqDcy36BY3khuK4+5NWJmx0+wfsdbjDCb9iR8CYrP7LVHBk02b2dST6K+0Icn0Qp2IOOCm0iW0yWhXyEtQphDpMWn6JuIvqtlH6PYTRYcZ+wyfKLugSEIRdCN+z0CGB8g0+UTyuHLFJrB6YmuxewkcC7IKtpiV1GvIop3sLu49Hf0jKRR7SJjqQpKxJovQ27oukbQ4GyFp4V/wBYlVHwJi8ENLP2OyJ+mR0ccMm4NghANHjpsY6r0NjM0YXcD4E3sNL0iLOZsTa+Fj9DUhcDZd4zyRDcjgUR9GNiw54aRidETKavoSfu86/t5abPuaGrhBSZpabnQkLbHOTRDgYJQm7DfUH70O5Y5tGXJTkvAytoP/6Rb7Dg4WnYdxm4iSBckmnGxKNNMbmtbF3kmD5H0zDn9DQdQnUnkKQaPdIem7noqIM7IaE7hEyG0JFD/kFTNyOQchTW+1KHQTNJU8IQ1fLEwMo9DEwyaLbOBbPapuHw2f8A2UTPoqtcGg3+jaOEJL+zhlwabE9FEk/LQ314dMXOxE6ili+aGkkS6LoNGyC4lIDchFb7Et4zkLtC06+JahqkL9DRCEPoXtE3bJ9LEG0seGp2KjnP+jxWJnRZPg1uhisSYgPbQjJDlhJDkbnRz7E7wm7ZHsXsFgdkHQbG+kq+xM9L9Citp7J9jWtqjTo3JwW4FaY1MkoONB4FSYX3I+ovFnY1rK4uNYqrG9rTRyu+j1KzsTgtkEoJiYlO+tihRNIRVjkw9iaDXi437fCi/WFp0YOw36GmxKFhcYNCYwhiJIxwkNRxpiLgaXS5KEhTsUlu0JK0PH0St/sjlKJ+jZK4IDdEUoJjwNobbALQ8xomNmo7Y4kh8HY/4nmCeyL4ZEkclgjknim4so4G9jPl46lbHxHQ9fxQ+GfuQbusFehQqKwj7mMqROQvrBsZeRDSaaGlz0T6PoHlF0HRcBrgbcb+lXsS3cN8AexvK/6ObE1NcGxXDKMdbNFWr2b0hdEuoUaOx0cRnOGtS4yUouRHLBtln99F1Np9Chr0MGmwyjEQxCOA0zbcGpNCINiHX7FoNHUbKPWE0lTHxV6RXIakCa0VwK4W8M3BQzKZ1DmhFuSaNVLSOD59CUYhHfkaNqeqbhyGnBJ+GUhwmKIVHHAwk9mykUb0dhxjYVJ8kiudF3oVItQdJpo1MXjMsjYV6iJ0ht6DYNvsr6P2Ezf+T0DpnQu0Ucx8ErSHSQ5PFD1fQuWxDgTbgWlsrfAkKktsVyYddB/QZtc1EFWodAcShpFKSbEFuhopcY9OA+xVDs/0i0S/RvxhNLb/AJDcW9A1uTYaw9mu6WWIeDQuDTyRXCbFJvnobxGrRpGU9IgUXGyaa2NpmiOkxHs+y6wxHL2MdQmyMXXAkaEmNfKFoO/RG5DRzGjanDxxtf8AuNvt+jsoaNo1LD4KtCZ9QrJMPnBpdDkQrwMtSE1f6BDo2CGJGuSS1wanBckPNLRshsbIuyVLmjz5GwrYeJieHITZ3FGGVYq/KOHin4WJDjSpDW9inui/dNWz7MBDs2UB9AfdDpwF/wD0iTQX3HPxR/yHAgcjpCFPhnIRR9g0gxsSnBtyLGzYm39Cb9iBt0KldmPhvY3Yo4NBrop8x2ojrx//ABDJ9dENMqiLGx2c0LFZeKJDjRPTaODGaKaE8I1lNp1D9z4ZBJLgTwEWQ0abGtehFaQ09NMc9jRLBBtTT9IUcn6NhE3z9jqI/QN1+wIJzP8AqHYkP9cn/wC4ZC9hB6ELFi6fJzGWdiCVfJzoCZdXox8D9DGZsIIK6o2XIsGUp0XBH0Eaj9h+xbQtBKbZYrEPBu0IWhE1iKPYp6doelfAucWJIoWPQwnbsT7H8ibbGnELoohnJzoHNMfih5+o6B2hYjGaxIRf9TiOBFEiYPFKbPrEi5ysXBteH9C9gnJbbv2IL09DVpqf0ObvzwExlbtYdAsczgcCI7N0L7dg0JrRxaOg3RDErCEJiYhrFEyiYtiLtH0zscjeQqFlovZN/wABLwVGgi/bEQ6INOZEPgYk/ZCiCc/+p/cV9zloL6e/0WSX/qHtN6+hTRvYlyEbciQsWK9knyJE3sxvsRAaNPaPsNjIv0QyN1Ox4aw0VD4w8QQTKHgUcQ204Dbgkwuti9iSISkK335s5Dl0JNsSLhiWh3XA7ZIbJD5WCKO2G+UZXWIWl5I/Xxxpmx7FvgTiGZohbSNDwsH6EoNtC6E94Q+GVifZ6KQWSPYIa2IYuS41wz6hjiw5T2cMbeFhwEJ0bwuHUUaKaIzoiPDr2QNpLgTSYkZ0DNo9CSm1oXbvQoz8DcQ6HB9D2MXdpi7IE+wp0L3BFI7Y+2QlqMsW7/s439bLvsK/9EPkrpoJ7feEIocBneRxye0XGiVKDU9EY63pmxGja9CDT2QyYYn4GMTDoW7OsB61hNi7sZJ7NT5Qn5M5idSFJRXEQC4EhJ+h2WZViFEhSI2VYrSlC7vm9o/ZAp6EwojgMlQbTUxWEdYiFqpbG2bpdDPqQlNeDeblzvaJv/mLGHlYke42I2hXCcrWGsXSYIP7CR0LPcJyTo03UL9iQadCZF02ixan0aUuQnGAdRL2LC2xPrP34YGj7GmOvXObF9lU/rCf4DIemGPRi0sJ7scWPnDgouHcMOspyJlRFkqxOYuDYEJ4j0yUQSEMwsNQzt8kmzsnoYoKeumWF14t45lLmGPIjfYjzsnwSE0QCOhQsRQLlZtaLj4PtFC5wh4iV0IcDeEcEHptlHZadj0hCIZBhoV8p4MbRdB608IQ5RXRdliZuiE2/tMWy2ND0LyccY9AnuQkTwghtQ7adsaSfIlOGG/YnlhfY06r7IVzwW8N2/aP05BnCl+hzxVoaKb8CaZp7E/sJeBRf3DN/MFBSiYj7p8k2L9jVUcOcLkauC2ZV4KUuEKdj04ENCwPBPZCdKI0JYM/QKgNunSxCaKN6JPgR9Avg8cxO+oZCdHSw4vIjpBlR7LOMIeBG8iw/gszrYwmUoxhWmhNtBvP7HHBSO14hIVPB4Snii8F4LXvwhDkNuJ5TJOFljm0FNRtCjVyNTDV2JEbJEZAZTs1yWtXRx0uFNj5ZH1P7FTdWyVWh6T/ALsTutPrFUmlwNTiLDcP0JK2R2ATQY+gax/7ybn96GiYZinuOk4ZGkNnB6LhU94ZX4LS0SZpSi5cWHIfqNcJQhhw1lyFTEvrwNDOA+R4t6BOiGUkxI5Q0cCnYq+RUbnJECWJSpDR2sY97Qsfg8oSiP2sJ6HeauDjHsG0lo7GMcxxL0IeoRvYpyka4JVhk+GDRGr/AGhMWdUQyJbRK/ZRDS6r9jPZLLHTF8fI7Ek3/suaNr/RNHZdLLZRoRKQ+yG3rIi09QfWopDX6ZPoMRfAGxsbeR9w2bEzO1olLQxiE2yb+iOENnHfwTNKUqxdFxyGkmeOQ3E2N31H/wBCaN8DwUENBegnhneEJQOx5phehwDDvLSEat9u4F74WRyeyie+zY9v9CQTwUosQlwkTCkVIew6kLQV0u42VkUYxvipIbF/RGTw0Q6JnRCi+j9K+MMtCHqhCH0Hk14H9jR8D2xodlUcmQf+xUZdjXMM7RIx7WEjfRBX+w2/wLWiC56Fyn4XNENt+x/8xcjplpjWJChlueTTQ3JzCCC535Btm+0SLRljCzzHmNgtG4KmrJjOSBKCKOiG2gmKkot2M0pzozokv2cI/wBYiovCv2P9GHvkR+kMKV9/2ySxEnt+hbTezWKvgJQmaVzlYVfCEpRsqc3OXSQpo2OA4buKiYyaZS40a7HyENIYez9h7DOAKctNYU5dmjafJqbIoiRHlik42zRIZA2PsdFXsVCcHXKGchprlYThPQawNwmPZqZoXbKUWAv/AATGlX+x10WJbbRRW6g1dM4OT9wn2Mm5Rr/Y/wCYa4YMh2O+rpjQkrY0ex2FIhn+jGFW1iEGIRrrDynsVHFyRa9lG80T2aKxsd4XJwvB4pDnDH8Vsav/ABKEBfcVDbsqYg/aX+kAk6CHGGdxCl7KnsbvRYgKOxF5SSR2ovDD8EISprw6WyLZVRFgQhyNZrMvGnLJMQmx3/6sJts6rHbhHuGJQg/oN4Yd5GUf7ENTJOP7wlyaVhI22GG1yLSmpNe+Rc5kIhmlSIguOCMhp2kLe/8AI09GsLjmzKMbhCwsL/sdB0YH0ie4UvqDW8WqcP1Peh7C2KLjkUwST9n/ABieuRNi7EL4B579hqYNUPiSFvGMNC2oI2LAuMGewrVuDkuGsNHRvLFKfhcIe4VpogvGIfJCIG0/xH/0kfyY0YubCDgxj40ewM6E/sq60k7HOSw7Om/wZLdR+gT5pVYH5piI+zjo7hPk3HVCWFA1oyiF1ZdDeFNnAg2aRDscS4EXLEn7JiCXyJMpr0JGdvQ2aYf2RUVDG1DejQz0p0L2MRjTGsKQkraC0tyNci0xet2ewofYlyJp5X/TFfPhcUuUc37P+IeC6xx2bKbIb6PoTQjp9dGl0IPUMkb9i+i5dLoRahjy1UJJIfgsPCHticEys5DG4ya0xjsspciHuaJKFtJf2O9H3JH1f4Kzrf0a+S3ZpkHQQydVk5cC08vNCNz6wuRMH3gezk4Ym8H2cgXBPAhdmgLdnEkuvgqGTDD+zGSqN946tCpH4K9m3oYdlPhCuvQ6x/RdtEh2B+ot4xPX0yOUl9iJ6Dez2Jr+zFfx837P+YmjYVjTRzWApuKR8ihxGgQGKaODhMNj8Hh4WGsISoWrFHnBa8MbYg0LgeJ4KEQp97GbawJexyNnSMb0E/0KnQhTT/Y2IIaMIaNVC+ZCPv5Do16E2TDcYXRcdlgxuouMJFSFJaN++Pgy4b8mNA008Tdt6OPImjgPoWODkzYYjbir4IbY5C5AyzbKF65L6wRw/bDfx8/7OIuhog2pCZhbwSP21+i2paMQJCBN9DYRpZcKZIRjwvA8LxaIz7Ccog88isT4V7iaPSI9oX9CfrClvAX3s9A7kjiFQ9rGZUbvPJy0iz5rN37ENEUHHENvx3coQw6BzXK/DPKDjDdbYbUY6UFNVWKT/B72bsaE7JfUU9Jsax8n3lDORYxhbrbHp6E3BMOv2xHyQhCE8YjT+5w/TCfYcosC3E+GxK+BIIG0kpaqmQNXlFU6yjQdMo/B5Ys1Qvhg4GssLh+GvEMJM2Qj6FEN9H06OxDQUbRSIdHIhJ1z4rx/QRODzXAsDCKJ7E9ljQ+07vIvK+E8YOituh0dcUeROFscO0KF2/YnUVlp+osM0RcYXKQ66DrWY4SCwvRbFFRDbPk2usrB9qZ+w/efdlpegJoWJT/hOiVDwekJLRngG0lRqXammaz/AGQmxqg6NNEmDzB+CGRIY0ZuNg3fDsbTHlhbxV8HBv4P2NpcG4kZDgm5oTBgpl2MSH5IWOHPbrLPDFxRCLjs6/muFmPxlGNhbWKjmUk2OOFT4EM2NDRBpkiiiSWHokJ1tourvJGRiQygxJLTinBfrMhwlwJCpjRjhkRCY0/QLmBQavojxwMXO9DUKLEsekEk9u0Nc3WJNigu6GPD8T8Fw9s3cD+zTxRwMXJ2PwiNF8oQhRcDTBSkbmOkd8WmJQdrfkso2wWHzFwi4eaRQtvw1C+cE9EPA7//AGcPL8MwzhqD3L4MfaaCytU5EOYElOmFDgLgRBTWw3c+Ozru5Yz/ANJPCHISoRGpp9jQgjsNT5wm6O6seP7hMKNYQzHrcDG95+AXi5LQq84G54MXKGvnL2RLxWKUhcjJBdGXbaLqPBuwLaewrxGPwQhGr7MthceWgev8dcUrP0OSDoZlPJkIbOJDcy70XbLvC8qLKJddkr9EJ6OTp/s6focSpfFwKjYhnb9kuNMrXXg3Ydd8lzbng1cx/wCkhqmiSNNCN9QSw+UNH3ChsmzQmgVpwPwMhILGWVziVBn07vwfOJ5KhyEOvJA8XeY/YsGsaxuFMcEOaWkj7CwdVbODZyRHg1ZPFFG+svC8GxhPmvwPwhrDbNj2P0OyXA6FPY3umJ9HLJOPTK0OLuaEImv7Fir9F8XBcKb2JP17KroNmOjbaNC+qKMyn/pEPRRNlw0IaxsuxErkdNNfsOptEaZwpDei0Qq9415Whq0G9HhUUHMdeEmB8eSeG4c/CkTKcCeuDSxx5ELs4GTCQkcGoGXXZqH6MvyRG/RxfgeI5f4K+BFwTKKiYRk+BjoahwI9GSlEIQmhhTwMrcixkfQwqpiTGqj7I6uj7RGumLkjApcFlqOF7F1g/UQqAruKoj0Q9hjBCwmNydLbie6Q18pnsMcQ0MNDnglsXBTiMeKUuEWEaW8XymGxNlFBDyJrQnA4Gq1v2NTt53COUMc+n4LwcX4K+KC8KuITEITKEVC0pzgsFwJh/wCjI1R7oah1JLQ2nMrFRQISfUZhpEsaD0SkDbcSrwJu9iCkRW3RdMVUl/s6KsbaaOLGEbf4EqbIfAz7UPmGxvga0l0JHWeQuDs3wweLjsu8J1Y7do34UvlfIl4lIatcU1IXL8UJjiyHp/FDHIl5r4E/gpRLwJB414peFH2NQ0aG7IfEQ6HFGwS50OGLsb+x9gzpJOg2LRaLhBN1/wBCN7R7hLQU2PLPYRcKQMQu8yYj7g5yIscDMcf1Zs5wpiNxj02bvvsTIuS43YtPkxC5JuoQWaFwLwuF4XpCPZjfJ0RToaD85hYRry2iZWG0IX4i8EdISoghseKLyXDOhoG+mDlpkaHbXQ+6jij2EW2bD1BTg/fjbNMJW28KXLWN9RsaGL9w+4RhtPDEptMQ/uPtj67PcqKirCLryHL4KEBfcn2WaQpQbhi5kJqbI2FSCQpS+BcNjS6wh5uZhZcc5LHoOH40NJIM+5lY3f4hYbKJNsUjY9xtCfhBHG+MY3hMY4ELAg0EGKGNGqxbmTTVTH2C+gvsEnse1O1jM1Ds2zdvKHrHpWP64MfqfqT6PqPoPpEL62EvWPpH0B+gP0D6GQPoL6jvD1RC07F9A/SEuj6B+hCfYvcI3XhFBrGuVh2n3YV7D7CT9j9j92fszTH7j7h+8Q/cQGo4LwJdjfBsJJv5ENDDuDEPg5fjvaJJZcjWJ+HRC6J4QeNiwOguK9m5WxBsKMQYbg4p0SNMm20N2ea2Lh4G3iK1G9iaKVDayxSlOMNilLkWhybJDaIpZ2cuRk5GljSxOnaOfYm9+AKz7i4npXsSsW2Khshsy8dDZn7jBDswuA5OHAnS+RCPto1nIMfAxo8T8CiJWKPEg8HEIhxi8Eh6GamuPQqNWakfOM0tr+0KPoWhwJjDxRfClxS+dKUpfC4VFKUublTIdlKKKRmis98FTZc5EQSjQsnNMIxX3HsWiKNehdBDNFidGIpfImJ4rBbQ8PnFNDWJ8jytkBsTyxiRpghnIRcJi4KxzZw2Y5wLFi0D6aWxnhnYF/JnnfKlKXxCl8wbxooosrxesUFgvFOvD1jXm8zKYhoxMqrrofgh6Y0Qhv4nhbJoY42XhCwQ+jkLhN5UZqxueIFQNA72ck8P8OrxpSl8aUpS+IUpfGlKUpSlKUpSlKUpSrFLhSl/EDoQhH2DxpkJiHSzkaGvjZ35Qgnh4SEIXGA3JwNCnoX6y6QhMNvEZA1G7Hm/Nc3yvywhCEIQhCEIQhCEIT82fIhYpmiX+xIceDQgNEIP4EpCyxoRBsT2LwauOJ6IEaEQ5WajCBRilL5Uv5y8oQhCfgwhCEIQmIQhPCEJiZfxrFKfcSjRv0JNNHHh7SJrQw1ieDxqLwNYRpE8yw2oNHmTY4ZCxW2wYb/iV+BCEIT8OEJ4QhPgfnfCuCba/wBjOCGQgo7PSNPgohPHrAvBoRysBwyhx6xQSwWBL+oWOPF/hJ+UhCEIT8uYeV4vNCJGmcTyHhe5+ma8iUt+hI+yvJvwyPWDWUNopRYQhA2sofCQTgg7EUTvhh/gQn4C+BfmwhCfhwg3h/HWCWIeEZ4LSPCFK1wz7QXQhutMmaNmwQhYJgvA1ayN4TLiqcfzzwjKLLKGL8RD/j7hC+Ri5xWDE80b4qveLWExUgcdjUT57xHbBiECxGw2sIRzGg2sdD2zYNoYuilKX8EokmQuqKoOBqIgqEn4ZD/gX86EL5HmuMHwcRKUC0QqELLPWE3aHT0+hTvHPHIW1j9cJiOYw/g3YYQmUomUQP8AC2wlTgcobE3+Ghk/B3jZs2bNlKX5KUvmsUuJ8LFiuM9H2JiW9o7d+gpwtEuiXsZ79Bu+fLqIWdwExMTGuE4mPg7zU9IQxYTE2E3+EzgfeNt40v48rKyvO/grKysrKyvFLi/jr51gvCbYh2xNoeOf3kpcKVIhjIQnlJGNoomNvBhhgnvJogh+Mo838FxhHH8KlL/JX8KGchDsOOKwizMuSXLFPgbm4YTGLULaNoomcsDQQ4ZNqLTEylJxbQo8v8HkNhBdfPf4WfnPJcZGcxHm8SaNBfJsFWP7w8ClNgmJ5zY4cF4PkTwpcNYpc2i1HL8TkJUQXQ/KZpfK+C/mmPDFguMjQuyFtiUMh2tpD9Buy+T6KJjcOVGosr8exM0S/EIRMafDfO+K/m341xgmE2SsaHh17hekN2XFzDWIYomU44Ey4N0YsTLGcn2IwLRz/DnlS/8Ahj8O8Vg6XJQD1gmnK+hrbeKXMEvKmjh4Jj4GtiZSlGxCfhRloYayi5KfEhCfHfnfHiv5NYnlfIuBJ29S/YXotxczCEXwpgohS4vi47JvAm5qLjGFps+4q8Hz+FSl/IXlSlKUpSlLm+NKXFL4VlZspWU2bNmzZs2b/BZzPv0Y/Ll+CYRi+Ze5SlL94maxNxs8pyysMbRXs3c5eU8IQmb+XPw5+FfKlKUvzwYzYfdTlDRGM9CezUaJm/LSlfi83yS1FXBXb5H/AAM8oTEzPHRo180IQhCEIQhCfOhjwexTdc9HprFMVIclobgHhvgCtUrRFoSSIkKxbFTeL+FjoShTzQn8GkfVg+g+vx7/AKj6j6T6cP0n14fp+BvCsoorCivJ0eyfZPs+z8YSpjweJtFY2w2h9mVngvBHRTCPKFhNnL5k5gbP43/A8iol4IfUfUfUT6I9E+iPhAKKKLLKK8QCyivZXsr2V7K9lFFZSlKVlfgMZ2yNopz4Ksl5N7G2vGwoJi2KvmhCfLr8KfLy+Uv8A/inwM7jwcS4XA43wplvw0Eyj2fJCfI/wp+Dz+Mv5t/HZ2Hi445TmHr5Q9Yonl+OmNjYjZfGJ8z+WEJ+JzOH4Z/FrF+B4PxM5fDpWjZQcexCYYkVeKkywr5CE+V+T+Gfk8zj/Pj8I/RPQnoL0DR1hP4Xhq1dfI8rLiM4HHJz+P7oxLCBtnYLN2TECQXfBXr8cx+EJ83RSl8F8HP4CyvOnI/cJXwyieNVM2ImEIrgmyCHa4egKeg+YQZHguQg4zKRWMjKF3ufed7zvi/C4dxnHw3P4JSLBE6Nwe2LLfhMJlgbmwqsDP7BuPAfUR+jfyUZCEJ+C+cr4+fkUIlloxqEzUhpYuyCrGlQ9fD4vIxJ7X7ItIjoJ7RzQ2O0QXFoVk0q+R+DGcWM4+C58/Y1Y5GmhvxYvK4E0VFDQELhFiEH0H1jJphWL6T6RhGVjPxEPK+PkPwJUWkbzB0NEWEh5s7eDc1ieVKN4Pbxq8pC4sZH7O7wjUlBGhu0Vcy+ozaG/wABnBj8LucuKxjZEGNwN7+LthrKZ3icI00sQbIRp52NMaYm8OISFQoNYSITQ/xEITij4+WDzwwnhiwvgcmGTcaI4oYoO4NWZ38Pk/NzyycPFQWYMXlwnwz4GcB+McwkCEYrkNTYchMLOiQmGsXGiEUvjXA9uet1hBGzZo0RDQQV4Gwa0PQw8co5fi8BiG/kIvLa8G88ctqEMOM4rDynHNExLm8El8NcXaE2jgOeUOh6G8EDH0f/xAApEAEBAQACAgIDAAMBAQEAAwEBABEhMRBBIFEwYXFAgZGhscFQ0eHw/9oACAEBAAE/EP8AEOjw+FYeJcS/4B7g8AfinB5LPLLD+AOMPhfD4PB4PJ343wfyPfwWHCdHyDYMPHr+M7PK3/DPyn4jqJTPA/a5pyyJfz5zBEDEMwRiLHwR4WW22O/wNh+GeQ8D8Drwz40/C+NJ8j8Q21BnlB/IItfF8a22/N8ngtPGWfLi4j8I48lfc4tfAn3LL8+RCkPFIEeJMkiPCl8jEs/jyz4HkbEsy54H4K7D5WWfhDYM+L0/4T4fhvzz45bd2WWWWWfAEny/iWWT8AGP5xCngHiEIY+BfBMvjfg3y+D5B+FZfwBfI2+H4ZZH7392H+TfD8R/Jiz8Jj14T47bMa+CxFv5cYpTzAORCAg+J8bL4fB+MsWn4X8TT5ZZ4Y2PgX8Cz/GT5b89t/GY8Px2WfAfAY/lBsfaPiFSDgFnycn4+7PxZ5VvHhL8jPDNr8Ta2sH48LD8HX/Hz5D8k/EfA+d8q58BjF/IEEQh+vxUQz8Ky/PPwiwkz8h/CBnjLCQz4783Y89fyn434Z5Pjn4Az4rLbILSfJGLv5QiEWDHgjbDy/NfGWWWeMiZMx+Z0eE2TGPB1+B7+e/A6tl34Mfj6/4z4bPin4xWYA+KySzWP7TGMX8veIeCQpNYMI8v4EsPiGfDr8g1+D5PwPfnSYvkY/AngbS0tLS0+IU/z8+QLH2sfVj5rkqcSmfBYs/lB4TyUcAg8ABB5X/BbeNl35dvmd/ge/Gy/IYXfwYSZbbb5OvgkP8A+B238nomIPIsWYv5dYMUpPtg8B/h58HqfwF8E8A+a+GX8AfMEngfDYfgHmyyz8AbYSCSYz/gvg/EuSsllng0lln8o8E8E8EgRAHwG3854fC+Gz5D8pd8vhlkklj4B8T4Jvl2+G2/PJ+QfK9T/gp5Cz8/omPgP7eQZr8mMQ+AUhD7wCdIXxqJ8N858ST5L4WfieTxr/h5ZZ4xsPJ38w+Y/JsbVixAHw7P+IEM+bFT5AxZS/kFHwK4wmD8B41tbp5z5ZZ5fksvwfB4Oyfxr+UPD5O/zAPwHXyXCXX/AAyw+Onis+CxrqWYv4w2KQ+NRCz49vBBkf4Ky/FPju/Jcl/NngGeV8j4L8F+YeM+R18Cee3h/wAI874MWfJW6yzFeQsWWfENjxDwdYCFGYPg+R78DfB4xlfhfOyy+GP8UHhPhjB+Vv4A8En4AeHrz2/Ed2bM/gL18GPgsYxZmvkPmCx94p4JAx4IWfBfjiAPJEjPwb5WW382x+IPyOvyl8P40sbLDzjB4fD0/iBfxgxdPN8gqWYr4B4yzzkfpEIfCoOBZ8d/AeC2fLbbb8Gfnn4h8i7J8xl+A/kPXwz4582WWfF78PT+Dh9WH15CTwmkmPz7+GMYtpLvjPiHwCIQ8xIOIHyfwnyX8J+GWeX8W2+F/KPwevwPwfwY2fhe/LqTH4rfOfFnv59/DGOJ+JDwEHwyIeCQ8UMFnyfK4R1+N/A+WWfJ/IJ7uPXy3ybHwPK/gT4PkZ8nnLPD8Xv4dn4+/g+C+Xv4asWIB4xYl38eRDyHGN+HPwv53yvPyTbVqwsLCwn48/4L8xYl8LLa/FfjnkNg8D4ILCYmSeV+JM+I5DsdfBfGvgGx1+cggiHxCIfjfwh8V+D3H5U/xUk8DyHwfIfB8hvlPA+A78EGWeBP4Oz4fBHZ4OvK/Dp4yDP8AZAxDwcfCAg8v4U/KvwWfmYfk9Sf4hZZ8Bsk8PgPmkfPHweCVvhT8+j4fJ46w2ku/LH4N/AHMeAeKU8EILDy/ifzrKFuv4G21h+D+ALCz8J+TD8QWPyzyeCYl8r8UZnxPHX/AAh+Ib4DwTxQ8AQQeU8PxDw+X458nyy5+JPGw+Sz8zwwk/BPwB+AEkG2FhZYfJ2+J534L8e3wyDx1/wjv4Goh4J9LCDwB4Lt5evD8M/w34BB+QfD8wfL1Pke/A3wfMPg+Q/GfJ15PD8N+LSW/h9PxaXo+YeMiHg8vhIUzB5IPhj8t48Ph+J8d+D4xIQfm3zjY2NjHwM+COvKGQPkfF8B+ALGxk8YWHwPD5XyI+FyXfwh38arAlj4h4IfEqlDZ8SOvGecLGy1J8X/AAcPwL+PLLPiz4I6+L8TwE+GD4seAg/G3y+ejDkOwfciUeO1j6+AbAH4kmQ3yG2WeBRTyU8QoWSfEIPhn4T/AJaz8c8h+B7mI6+L+snxttsC/dZ+46gtPguXLyHjt57T+N78ppf38XEPfh15Oj8P838y7BngN8sR4J4p4BA+Z4HxfK5+Xfy54fLL+DPwp8WPucnN3jEHFy2TPc3phZvG91GkNkQu0HnW4Pl/Y48IY08LkeZTNgPkF08LP4tJfzIYM+QWPIx8mvO+EiKQ8xCD8B4H4Fn8W2/kDyvwWfkFnxz5hYXDy2vda4SlWdASzRLrtvVgPtujie7i4bHhOo4FQDM5Lo58doARG2G7Fdt1jD4Hxtp8Vtf8k+AZvwFvMI+D4AhMHzfgR8Xyz/lL8GfiQQfDPKfJZbJbsUrkYHjW2gbJwDibhvRceGwDYhnEB4Y33ZH7Lk9D0+yZOY9MEQYff1fswu24+jdgceE6v6kJoy/LSLOI17tZfD351tbXyzMO/wCOXx0fisfj/cCDwfDbfiR8HysvzT82nw35PxPAec+L8Fh7Xs7XLx9T68A8l2Xq3BX7u8tQZz1KqF0b3ZsCw8og88LDruF4eLg2xADI7CwgnZJ5R0y51MoWHk/Jl189PwB5E/CHxLhLvlj9QPxz4Hl+RHg8vlxZ/A/kfpLsnr8T34yyPxvhZDd3sp7Hx2JUG5NlAO4BLNuNxkWj1e5N1As73GcGDgmfTNyiT0QJjpYgznbb1LoXODBE9RmPrwT2oX3G4d+D02o+1j8AQWWSSfMPgvhNkxgWx8tPifhIeDwvlfxP5u/4n4h8Dux9WHl8KEX7pA/uxkC1EdElkHHD/qyS4eCVui7ASbEhbAqy9EI4sRvZawhzjuRyRwzi5BJDdyDwYU/dyzSEyYiQaDIe0jiHp3Dp8sbVr4BYeCAyQyfCfI6+D35wgDxjZZ4fkflbMMrfxp+PCdMMX40j4ng7PHXy+NUsi2393TPNjpDLLJAYkDBHqARLIsx3dJNdX+51oT0xgui56yOeS2cpbHBjFi5v1APtd8FgERZw9G0OeoxdDe7wEWWKMQpBv4UyO/h28PTPhfkPwe/hn4z4P5Ha38uWf5h53Lr8OxZf0+PWsmwdWoDGllODCMQfcs10gzRjrBIu41Xja2L6hfVwPM5guDGTmN2S4uH3DDes7f7khmxZ6bGcNhIJHPDdc2bPfOWWSeXwdeCHLTwvhfkOQ2ksHyX8AecZn4HyLK//AMWHzUIxO2eaw5sYzILJwmCwx2siWoMoq+G5yjsnEwFctlQdtG3IRplzc7aQOCLonnLVngUtZOeA5tZs+UjOLEG2LFiHl3wdeDys9W/jH4r8jxnkTw9z5D5mf/4ZPxbbf0nqSVe2XmF79SAtVhJT4250lJdvfhPclSpD4MeAurYTL2TiOUonaJ1a5vwO4cy2V9JYy0ehdPhrynwFtvh6+AWEmfIc8FtbX5h8hwnyfDePL1M/APKfkT8b8D455PivhcTwITPVvgfgMO/JaS2+DfB1Y3yR40AkXmJvwGXgeCxCMLt5js8rLs/Iny9eQ/wz8D5I+J1PhG19WvqyYsWPyv438T4Pg/Ae9qymz1PXgyG22bLnZWHmXu5yJLkeDp8Do22z1PfyNQEs68nmIMYkfAwWWWeX4ZB8H8QWJLGCx+F8nkLCSPCWP4H5ZZ8X8T8gtz4fwssnCSOy+RtMjxnhX0w30x9EP6bp0grvPV6MX14b8Tz5u3nJjIy0lpxYjGNkeSxIk5fXlNkyflv4V/Fn5l+B4Dyuv4lz5h5fg2eM+b8DwPfjs+H8LPgSeKz5OYbL4Shstw9R+tr6tI57MjguJD3k+mc2o/SK9+jwKHrwKGT423iOEth3tvUNtk3aee0/Hfwv4A3/AAC/E+LPhllnwX5EHh7n4Z+A8PwI89n578GLl82bPDdsy5tjkfpChhfXgDeYzMIr2IrvIHkv4SD1CczCmp92G5S17jCT2X0zJ2Qy5KX8eDI6+Gty7WTEBvg0u0+d/Kyz8518N/OPky/IPKT+F8nh8ngeEZny2X4to2Dj34nwuYNbG4I34SkJgEXkazFg42QOmf1tmYMDsmW71n8levP3Hw4yI2J0Wj1B+rMOMA/a9gSthfRJnku0HdWeWzYRtJ4flrG/JfOH+CP+OfDuz8Q/A35PgPL5PHvLJZ+OvgN+ITQhO3aIQXAQWwgjfHLZzlxsbIIebdzGTDcZxhnd0JbIFzOFi6LU8xT1NmOyczLLoWtJMksJ4Yxk8M8FmXEv1+APxD8OPK5YttfyA/OHwvhcJd+JBkfI+Dxn4c+b8ss+LCJkWc+DzW8JkFxIYR2ghg3D7gKa7OX7lPHqRj94D3PnBIddeH+Ld3mMSUZ+x4QvJH7uWUu9kqniDQbLeExyW1sklv8AD8eWfMfxD8WfDPifiWXr5g+D38R4Gfw5HxflllnnPHILHUPjvd7ZIBaRSU0gOsj9bL1AbBYmT4iIc2ccRgyCDHVrIJXq3Z4Won9Ig4Rq4hykL0t3xGIICwwLJv1a8PzPLJ4WG3wNvwX4DafHS08nwzxh4D8TPq7T5yDwfB7u3wP8fPlt0fHv3HcEZXKQA8Rvx4+RGxvJBnDBDPGs0m5yWF+krKgmhI7iZIZupEs8fx8DAOw8MWy7Rh9FmPAn5nl8JdvB8NbW18YSGfLZfgHySYN/Il38Z4B4D4rLr8D8IWWfhyzyaJx5zx1kOfflFucUiPHsRjHEZIi6A7jG1gHEUWB7higycAN6kPtZO4BJOjZ+mFllWY/ZcrcyXTzsvTC9dFlmSWYNJnfCSWYeC4793XjpP4Nt+BLOfmPgw+Gvxz/HdPwD4rsvLZ+IeEk/GPCb8TBn9Y2EoWIWzIF2h1JMTHUsiU+5k622Mt5o7CkH7uZ1uWrO/DPQ2Nx29T60ltiwCUwGOTwuVozwPmX4M7g5ifxee0/Dp/wR1/itPwn4c+Ky5Lv5S6eX8YZ83ibSP340dYII3wCaDHZtxkbdwzuH2tPexA/chKZzH7RvtuR0UEkGyXskzjuOQpn1AnTZfrZnGXOtl50sm1zYWcEd8q2egjg/q1Lvh+OH4MsJLHxj8cs/whZ+RPIfgX5+njZ/EB+ADPAb40P6l3W0WR0jwUT7b9DwqgSQFnIz4HT7gIY24bbwnHVmo5uJkbWFbX9J24I19kD6Z1zDngyzLX2W/JMfENjZaGAgM/Dlln48PIeFT/gDfhnxD5h83v8Awy/jPh6+MZLZlL1YGwALJeJlgYF/EiJ6Yku5OIMgdweGTiMQY8eYgk7y33fHILVnPcfxOek+A54Lh5uRGeHPDIuFLosshnzPOWfLPOWXvy6J+Ab+QM/PnzX/AAz8S34h+L6+V2YeJZL1G3MsbMfDD7vTm6Mn1KQTMnBkYYC1DfcvJj3IEnqUhbd3NTIdcZH2T9bfTe5w4kSRJMPBamlwWeI7u7PfbB4bt8zznh/Ex5XyeXrwPmB/xl8LPnLPinyPD+IIOPgufBwWz0XIQi95ZDixI7m0cRLsU/lk72bhbEow1zmQd3xL2nc/MhNJB8L7i2wn2a2/qRXqDsLhIAjEpC9uN1F59N09kj7uXk3FmyGKfdiUY7bPeWTZJPieA2DLtPjfO+A2DLHnW3wvg78r4UPkGsGeM8Z8Msss/EvlsjwZYSfFPiQbJP4ex8PRa+WxQMVgs9wguObe54kbzZA9WN70SOS5K7s494cRM0LgDGE+6OUQmZdO53Ak6u0EtfZle0P1Us4Id8L7UnS/tl3nqHRMblk+rRa3Nhjm7XP/AEQA+DJvjLLLLPCPHSfgHweS78X4bLLhM1+Xs8B4z4HjLPD+B6/EPUnnGfiHl7/EYLSXfi3Vkwf1DtHbCdbEW03KX9RdJARjwRxA5iZ3M9FwkqCliCzllxx2EoXXrxuQnuScC/eXu0H6Y1YkmvDA/Ze95LmaR9JGDiyW54+244LPKy/HHyOeOnlPB5GXfD8H4rLvzDvgPB3M/EJ68vyfmHxPg8I78D4Hv8uJ8Pa7IH+qXf6I3aNtPTEMxsZ/kZBYskzTpN4EXgcn3E7SIns5LWJWzU3EOmA4IH7jtqsmb3IQ5GS7gg+ptzwjlZzM8T0nLT6nlbCHdtYvJZlbbb4HhSfKn5j5fGy/HEu/gDPB4Fe58j4GX58/DCwsLCz4J4e/B5fGfEp+Uyfr56PgXKOr7WXUc/EBe+DbWGrRcH6kenw2QiE8wGORACD/AH4Xx4PLkwq8XJDhhCdtGUguZYMEtZ0XbmO6Roh37yfCkkbz4lrXhlQLytxYLwdH9I4f6tt8l+BLx286+H8a/DFr7tfwFw8B4MePb4h+T/gp4PgmfFcl/OLfC4YXIwICLJ2b3cpzPMFvaP3b+FdMIM5cdqfsR6STEXLRLitY/Sd8EqRzKUSw8jETXDoWn1CGKNzCR5khhNnubM/uGD4PqfgeS+D8C+N8r8On4cwZ5DwN8LlvO/4DIFmzY2fi0tPD18X8h0fBmemKggtlwAhhBswycIbwbizbZHAk8PUR2Gxnjk8W1hJAJRKOGiItkQZiRvqxerhCIbNckbJ6W06EccALGTkuA/Utw1wWpbbLLvyGX4HnS0tPxuz5x+vwZZ5QWLdeZ+R8MbPOeA+KeH8QdS+MbHw+Hxv4BWPCJ8t/8SiqxET1s2/dxYZkojjR2+1L9z+riZWulxwyILCkw7PtJIyi5NTK5UA5UD2ZMUMaZkGWNxKdw3Uk9eBVk83S0RZPeN5uiMyZpm7Vnzvx23wS/DSW1j8Glqx4x8cs/AvyPIecLCwsPmk/hBPxZ8P5Ok9s+OkkcOb3tgTh8fRPic41m8SxIQdy2UnD6iAdRgrAQoxZOfA25KkdIYzwhnqX2ForXrs/l2tFoF14zg4ZC/u252Z6sCQzeZTNGB454icbxLmOofL15EuS+R8svhvgun5Uz56eO34Q8h+Zfwh+I/k6XFh46Wl/V3wgA8FkOs5Fkh02A8ZYnOr7ulSPaF2cnuCuCVIJzcCCCGd8ieSjHi9t5k8ebRc2LBlDu5PDrZybsP8ArIEQu8/3wdeE8P5B5+I/Gngb47eAnqM92h+ELPIeSfxr8F/KPKeD8BBY8ZjgyIfwjITw1IMLQWAXL1HhSbfuOy5g4mvB6mc6fEUjbi4mBgzuTlsrWFLtdubviNzVt0QfuRPJNbx4bdLhtnJ+54p6k/QMHxe/LajfGNnwDxixZyedPwDL4XJdl6seGSVfK/DLCyCxsPyHlefyraWlp4evhnyyyyPi9RO+ORShPHKCMghbxCuFxZcs46lAvBFXGIMMtG0Hd7ixzsMQDlHVkCDqTjIH7td8W+o5Gz1OtzGPFw+siYSYeNcng6wBXY3Qtikg+K/HDweEsfwowfiXJV8CE9w+C7534BB4B8Ms+Tfky6/FPw7bb4X8IQWWHyDIx2urIUROPBjy8A8QHhSj9y2WFGDgtXBtlwrgk2VyerEZZxJPtzAHLUjNj1bR8am2ceFijv8AqXBv1PS/dkHwG/jP+IXr8ogz5B8Hwv4D0/Jc8LD8Fn/HGAeEj4DYGeDHmyFsHJnE2Am7XhYzVZbk7P4oXRFkR/8AGb5UPkshyFZbANLmzLtxYTzO8cznBPg3xtm0uZ/uB1f2j5vwA/iF+LGDPD383t/DjZ8GWMeM+TMy+CO/iHd+KeFtIYZf8DfgMn4bm22F0T07jrz0IiHEsU7hsh6n40RjDfudcw/uQ6iuD2hkMHb/AFJ0wfS3CcShkQBhA057upsgpIWsp9W8WsmffPgbIlsodFzE9x3HbIa9vljy9eFthh+e+E8G+R8PwAk8vfgVix+HPxvxEEfBNPivh8EEkmT5fyDD8EEB89SEdzgc8qGHgtwtl1DwJX3Ovd/tZE5hmT1cjeHCQdJhiSC/Uatsjdnethjgy/dg9ztlRh2wZsh4iNbhbKHeXqyiYPXluS18PXwPHTwGyZ5D4sQ+NbXyd+Hx0fA354xq/uD8W+F8LPwPgnh7fgm+HuyCDPKeX8ux4Fl8ba/dzozung8cvHq2UpugIdwFgYr7bLGQdWP1w2gvSFF7F/8A4q7T/kynHP2QHIzvNgTixwxjFuS7WBKGUImRyWZac7Oc29wzEc8z8Mg451X5pJ5zwGeDwmfJ68bb4D5GXyvXj3+AWLNg/wAF78ngPk9vzxBnxe/D/i814fMrePLlNkVi7+BADiHtw0bLObZNZ5GQAEjnMWO1OOrmth7o5Hbhy5clDYPGkzh22HhLje/FcMjthSQeJBw5fwYWNjBBngPL4Dym+Ek8bDD8XqXfCz4B4DyFhYfB+OWWeE8ngfFnv4p5yCwk8dvwb+HfL5O09p3NDp5HIwM6Il5iA8cW27cZ6YOOEZiPvJ05h5itx3zNWVljwIllCXYmPBeLvdykDMbDA2HDI+AsPwh5XwFnywmYWc+B86T9PJ38c8nfl+D5yz5JZ5HwZn5s+C+O3lYfL4H5L5PidCwVxcn4DwJfHeMWLW7pPjxohtuFAriZi5SLnC2RB5MOfiM8JWoJVwdxMZZ+FnyLng7+L8X4ay/Eb8Q75LS0l+O2/Nk+A+LP5y+D5HxfO/Jk72R4Wyt8ncJdTp2TRepUj4/1DbtmUBhxD9T8SGC5LZZ+AUgRwQva/ZafMEGfDfwLkv4j8hnxHLT8D4yzznyfI+LOT8dLTyvhd8b5PC/A+D+Fs0bY9TukZbttjIxgmgQClXgzyLbW5P1F/BbXp7indweSa9U+RhtW78lnzLbO542G0+C+A+SQ/N8aWnnTweEn4BA+AeVj+DPxPhfBHxfJ8vkZZZfC/A+R8H8KQ3Ua3XE5+CziIEGyZtwdWuSr6Elbtl+rWT5W0Y1fZ4l4MQmQ2+VmLjc0tkfiNjw9wfNfB18V8L8Gsvghlnznjt5Ifgf4K/A8k+H5F+K8PwPKec+L+FNtUiqvXhDHqUomDDIkcQEbNMMuTrDathtRDwGioYXd2yMLD5G2VgS54jiWR8B8j+ESCPgvlfnnjfGeQniHyOR5Pz7L8TryT4fJ+Sy+X87+NvJLMWWXEG2ksQYxFyGRce/A8tibdPDAjfaU8FsWysi5/JruOvKWPx1/IXys/IbZfB5Z4bH5AXwFhYWFj+JeNt8Eed8rL8lmL/hP49dlStrdLXt41LXJ8Bi5kQnGRwti1tLiEhDrbLhGZ+05Zx8GRly3OeDu/tMflH56fBPwZPkbS0tPwHmD8plyfidx8VmX4b4fnn+PlmptuPQJ08DwjKWmHWSI3Gazhlh4F+7bPkb2WoxEOZvTBjXHhbMvJJWyy57lNerg/OeNlTw3fkn4HyeQ8htlng7+Zv4HyzwHgI+Kyz5Xws/hz/EJclso5BzEl0tSPUSlvW63GNXIL7tttfu1hdgXq2QVeAtgM+lNzLtWDMyZGXtOrbIhjlsGEwiwiDP8U+TP4R/EO4yPg+B848J5T4h4PgssvnrynhmUQmG6GS7LUj+F84+DWH6LqHdoEN7k/dufRc2bId3HBZDbxI6ZZkoYuYWG2C7vqtHqxSGL52FIdI6kTLn2+iaS8nUEawdbJpOS/uPGxq+EB4cIF3rGTxtsfjx/Etr8s/CecufBkZGfFIPknh+AeT4M/BshN1ruE8Z7RjIZnKCcDAQ7QZvbH6lNwW7l4pyS2j03TqcGB3XA9N+q/VdcrBowhZnIDqyeiL8f9CeY2eyGY7dS69T9WoZzLRIHaBi5t+kZF4fuc1cLEdcNr4TcELB29XeCbEpInk8BwmM33PpYa/d+i25wD1Pr17IeZEXx7lzwPUwRHIB+8kxssht+e+DwnhPAfFPD8DUE+WnkfHbwQrXgLt8D+F8PgPiPL4PlUAjK+5DBB92Yc/RZs652clsCh9XaPIwRhsHO47I5oHsMxw5Kmqw45o8qYDmX7g/3IOGygzZImT1DvoZToQOIMsGbxtn6cR6BV+opXnc18xS3F/WLLrqAkNCVNPNmHQW4e/YscIQXwowuKURzmwXTHgY48eEjHjmZ6ss8NFwIJJB9Q9Y+m0sEPMf/ANa9QCHjSGXw+Fl2PC/qbOaBeCE6Vr05D3ugr9jwH7l+/dg/EPpj6b9TYIh2THzSfJHyySI6u3g7+AXb8p/AfBfJYYbNV3nXhaB90Gw5pGjvBxIOLh3L1F3yBASHM45UnGzkgQOyeC7aFjk97C4ti7tmIGACNJFwK4PqzRFfT1DHA+4mQ/Rnos/cCmaebIy3NNsGUHHpEcJ9Wz6S7Ay52IL/ACDnRL1QPFszMR4cWxI/ou03TwbbyRm/q1tTvm67hlPAjq/ZKrq+UxxHiHiD2wcY9uk92S5KYtNmMZZrf1ZjDg7hDi3IZMnL1PSAh8bFZmFPRPv8Un/+RA//ANUExw/k6x/CSA49PkIk+DjZZB8DxhJ5F28Hfg8EH5F8PzPL5BDgWfAvttOSFsh0S5PA8lgvaW1YnbfuAyT/AHKiSkcjkM4pxanT+oDAwuUzm28HdjU00uBMgcDklp1P6RQXVyELtyRPUcXIvPhMEmi8kTCMML7nvruTBg+pjb4TifbLu8atBCScjjAryeC0kR0j0ZZAttdhLhbdvF1cZ1bGbOCFbAnO9v6EhGPh8sYQssaAWMN4IwgxJXqdQOCJwg9bDIR6izYMwww01HgEdFMw6+KRYn6eDIDweoGb4EbNnnt4JeDvwdfkfD+AZfCbZfSBABZl92XYv8icWm+rem0UZi3yQMOb6ENN1n9t+xF3fUg31nuz29+5nrfP2tCoj4oD1AdE77hE3Z4dQZwwyOrtwX6lG7a9I0AyPMz1G+u6ENLN1jH0wXc3n1ff1nIYl0PnWHjDYXwDHwMtv6ni1+A6jwgQOJMDgPH7f20PD1g+8lQn7iGWMXpg9E9b3/crysfdnJmZ+4T0rYufSc+iWtGremjfrxuXL3A3MU6O/BNg84fVh9WWFhfSyD4YWHx18H46z5P4w21nTMwsAnwBn3YQV/U/qcdZ/wDbUxnKT6CA8iQJICvolyxCNOOXu7r35AzJ1Hp5Xr+SDlnPcrIOiJ+57TSLe2TvMQmV0P4j6TZ1zY9uy2Q7uwcO/BGuuRDqmXBXbGLQYXDL+myrk7ccgV7HJDn4ZISWdSCwgPuEll8Mlnhj9WWeNPC000en6tGE4ZT9xP6RhZG3MyY7scTgRgj1Mi4dy28C7J2AYA8Q9tebzSH6sUjIOcwTxwx5HD8RL18c8nb+LbfB1+IsvwfxBH9YkDMsy4XCw9yDIdB/kAeZDASQQ8M1nuRzD11Ir9IyH7RM8W70Xa8yYmp53wDfXIG7s3jYv93Hkml9FGOF+rT3PGQP1PJKzqGotifvANn1ZkqBRQH+3FvsYqZHAFxBlyZvAyijjKU10pGsethHLDMjzlnghySXqPcQ53frW/uzxB9z+1iTvVzblhQ9nh/qYYv2GxZGXvsAZcnm/dKj2XNexMhIg4jlxPtcLA42EDl/d/U1veWdOR2MUNtnOJGZLyoTy4g9+Q8p+cjr4NixYtfk/hC7E4hIHU50Qdh3cRYvqx6bAglxzhM3Kjs9lkZy+UcKLn/G1X6SGj9JYDseYGzL1HbmVD2aj0yJ5ug52aaOvSWc6XLGESVB9BeiWkkM5J5MLErLQ7NthqQ4NJEhlkJGMkocpuWdOqPpfgIiJiXCOmwTjPSyitHgPxyHJCYj6tvU/Rv2LX3lntHiwRicmddsdhOGZ1On6taR4Nu26GlxDL0Mvrz+9JgB9WVibRzgIgFv35UHccOvb5dlNnkbp6dI8AEKWO7cWOSTHwgxjznxywsJ/GHxL/BCC3ehCgAEZBZySO5iOE+xHOZPcZ7gcYQ8wdl9DdZJDGtH1HVOrSGq4S/76b/BZOA4Z2J05LRevtC5Ad2OXqB4j0gZ1eyDPDdb3dX9+GoPkF0MeEhtIDwU2H+s24knPYXM1mWtO8eLaw/W9JOhGN6b9Qp9GH6NpbU9Rs8nwvA9clzuDDkMPj/Xxyy9+MssLCS58qoTubkBZiJczOnspjVzahTP0202YBZi2jIkWw6b7cgNbXqbMMfcbr1hwkbsJ9wRifvxxeuJPuGMQn1Dh+GfifxEeBy0l/wif6j3AZ6WGBsRKDmeBwxvRn0CSFQ+43Zzq3Vz6Wa3j2QL2nMYukHKZkftIsT1b9Jv/Ej7jNBheRkJ3lFmguXI3Mak1PHp1LW5Hx76QAMg+sCHaMDh7PAI2bbzM9UQB7TCa7p6hn6VPj3ui43DyWRjmCBtNW3RRwL/AEPPsknZ4wsyUQYcu/w4WEypMxWWO8PMwK/+yXtlQrsPbuHAlhWz/wCIg/RcbghyIAOPUMIOtoycTlWzH6hl5Yc8A4592rFzkuHhHhyEzkHy3zttv4d8Ed/4D8SUoiBf6gX3BHjDuTbqZeHP1Oh0nZPwuTsIgzjOCWxXvJI/pw4TOZ4L2XolYPFgdDBpYcWYwHDYnYHuRys/XjuxEZlshyXOLmH9/TbQcLl3E+yIXk9xDnGPv6y/2VlszthceXns/dkcF1/TZ+WCi57JQo8ckwByc/r8bfhttzP0sqoz3ICVWJ13Im9SkI5tn3Em2xk6WQ3EuKHLe1icvulKCjmMJkvNkWN7jh3GCA83vN1jG/ciC2zjE+5OpJnxfG2sNpaWlpaWlpLa+V8H+DnklUA45h4kCPBBvk7E9hhBC602fmX0WUuOBjjpAHGeEAzmWC2WuRf7OSWHTowLg/kGmSu7Rem453Gxx4sqIeGLnwRiApdD6hZyDplDWa3JmTzBoHOwLknPPptcPqTvJab6P1/Z4GW/hU6bL40k4TrmXAPBLkTqJ1bU6uEhVCJGPyos48718c/C+J7ljsAWn36uFD9E81QRNBmawPTvq4IWXqR1bCW0UcfGigsW1FyHKAs/ZcqfSJrJvSOFWyHLKRsk+QUJOvHHlfyFyxYsSy+R/wATRsdHn1Z8bszcJKMI+/DogpsQRMDDDqJlC6zh+p8/J5Vrkpi+yHw5SRJc4zYUJPWvJcku5fqvojnE8Ewcj7LMAw4nV9N4snC0xWHuWr0w3q6Rv2Q2vZqwmwzhT1H7iMOdlo4k22cOTyWNWmIWRdNuH22lZPxwgmuNH20b/brEQyGihCq4445EKPudk0qGz5nX1cPyXzdOhX6v9wuDn6DNftO2tdmeYy9zjQ4lg/sE8p0uc8dkM23rwYSwYE4XAuNj7nosrKPc8UbiscOE2a5YiF3dj7Qi5QJFh7DiRO2/NZm222y/gP8ADxheLgnCPrqUvOT/ALf9wTY8ceGP7M/6JtqL0+kmgadQ0tKw0k9CzEnI5E9pCvaGJkukasxuB3n1AAGBPDeyxuPqPKAQIgXIYdHpz3Jej9LnUIeUCOsjGmOdJ7mfVoCcHpbbdCejggi47DmC1iOkjX0s+Yks94cgj2BBas9SwD+07P6Sn1Y/iWW1cqAawcgOsaw0HtA2bTefRG8rJ0S3kjSxk6uc3hkvkN1lwSAMpzxrn2sRkDGHoZeS3LEiRxSYYZD14NH3gBaEKdQ9HffwaptJm/jDwG3PwBZJ+BNsLiMCw+5YJAXnuWiuPKNVNv1noMYcEb0gxAp03XhCMDoPUjccmJca7tC5el9r3zC2mb7yDLbHJNyFPMdOXbX7fUggceomcfBAOJOVgD/eNxg4J2OmRIIoY/8Ably5nu3ut1AszIOBh1DDGZjAgxXujwjhE7IQ9RNn2piXVse5j2SKRxJvSyDw+Xw2OcDs6Jwcy9vQy7HPROBHZ2z30SRkx93SRGDKWRwp9fVvDp5gEjwzjdmz4wyzAJFa+rvpDZs7naxEnpsM1jH7nRZ2EhGS6xgIdyoPhZ5bLLLPDPkQPB3PV0PiEeRJPxC0BGuHOTebkcYZwWHiyPC+OmeA21T0e7RhPVvXBDq2YwMTTePTHoy7h05Lg33x7Y90hMt4LvM7nCXCg/TcumkpJpD4CDcO4vq2O+kt54OEWU4eE4gdhv0zAoE9Fr22snEU6Eg5Adg2/VsAQ/ccWeFGOH2GRja5w/UHBysbky6P3cp7lrSekQ65sdEjhMA0gjpmMvY5K0AMh3Y2eMeCeU9BzNqX17MQMf3knZYfl1lMIZzMLnYREOMCZXMH2vjtLOBf/Ln1LMU9RnyfTaJdLmEZO/EwtkObFjwQdJAujRj6G2GGFwNirG+2frZ4c+D1cY9TwzyluUfMJ8cgzydz1HR5D4hl3vU9/AhGCk9weT+8H68tC5uXvj2MzJyWe9Znu3X6kAaXpLGnRXPSlItIZ0XOS0j0Xdt9mcnaHDRYCdiSP7+wL39S5RlqzuCHgk1b9A6YJgjs6ZBDmy9xb6a7K8Ob93E8DgsbHEjO45cCRnKP0zXwT7mJR4cMz5ITIjIOgrWj9No9RObGbsW6EGgsPVxbCcykZfbnCWBeHv8AU/RCxAWNsEgZAjn2TJv2F0W1P4eKd4W5v1TnNgTAtOjmcwx4250w5bgB1K1GjiwLNk2wE5n8hE5GM9/psPUn6ieUiHiI8YBEzGDSzdRl1AJ492UR2WUbRb1DpIVtskEOw8Pi08Y2MwpixsbGxgjyHxGeOXV6nvyQuCjA/Vs9jGyPV2zb14+gIHJz9eMg1njfQzkT3aSH98GXZU47kMK8uyYL2wehG52A0Hm1IGlyeNLHL9kI9hZiOnkhMzvD07Jy7nvHMWvUW5yNsFzIcy7IfrcyxPaQatoWqMUjJnTHpmHKseRIhlhn+qLE11YEuAJbO8IOXIXXV3qnaDG76U9RT2BEuEi8EduO3CH9GU6jcy6uBNr/AOwk92e1Fpzf+DJZZaD3xa+pIj/ZjGR6B0IzqZO8nzkXLzbYy+iefhfpuQN2HJWVyXVWyyMEbpiTUJ+yyRmdVmacXDu9pNtk6fsu7i6u6494ZHIV7eAm4IiIeshHjPBSyLhG2mcF2VwJCXWk/DEGeUGDPmeenw7HkJfgEOb+++GHN9e4HLRkVsSwXqLhj2L3KEhWsBfMPUdRZILLWObkC1cQ6fZPMHbIG7/5IyBRpjYvWkAp74Yv+2I0DY5A2dgajp4EusOb1sAcfTfHc3SBcGbEsHj1aOj+gWsI6WJNePcCJQ449WmpxA4u1/zkkOAaZkdT15z2QUgxOyATI3kbfRibsem96RV6SOaudWcTS77nfRmdLALE7wZuxX/jbN16fudYXUPtKOE9yvY4fXi2nZjcN8JTGvQuNIFbPuAvHQzyCL1zwnBzfYjG/wCrmQ4QavRJ5Yw8ZBEhewjXJPsuJlOCVDsfAriVOnUwmjcjseCwaackDDC2NhdCA+oLL0kd7BsIwHESElQdNsk4W8cmcFuGfLLLLLLLPieOnwHGdeXrzkS6ei07sT5ZzbxzuaimE3JJw9yZ4TPe0DT36u/cbbDn7Y9WGQA4g6O5/oGN68tUK+ncBi+l0y6xng73cQmJLiHh8ETuJyXKZh73yb9kMMGx924Gvohc6+j3dPq131XBv6gJPj0LD08SM4Y92kFDk9MgSjfqfqIv1xz7iOBMY/uRpzmxjIwcKE7yf6K+yNYmLm4sDNLdO4te8fQX0bn6xy6bGFM6Q3RKsHQQcK+m1r/oubMsmw2EAJ1u9EuWdQs5/RxcC9ObwyZoL2tCcM6vUx6nBLjmRUjDnmN+5fYLRLpHRuMH2zh0S4ED2h3YLKemBp0sZ+7OW3sCcPBvZOGHSljUxuhIvHpexC4eRkjXYHqtRuYMtLoWIFvMCx6svdvDDHYqh6LliLZmPSCDvtIg+Mss/A2eTrx0+RM9+TuGuX3ozawcNgeMfOsRKeF3Iir9wADq0OWRaO3r7JM8ZyJaMCA36lo9bzcQRIT/AMYch0R72TtI6I6YR5WRCa53PJKx/wCah9CLw+DeWcxtxyLbL6vS9XZePkemBAG612MskQFDyzsSK2AO3ttBOj17LtaOFiHX0zch/Uj/ALgDPu5XGlp9nbv0UYJkD+LHLGiL3H6hUXQ7Z0EiRYlrAfuPpzcWHCOMzN63XWUcJa71YbLEEBy7Dtu6OwUk9XgrtsOnAR+Qes7+7fN3x/CxAP8Aot0ejiNECJfYbry0aAb9MsWATNHI4wnXLaPIw3m6uDDeUjh2/peIYHAPUc9xgE9S7jW7GMdGMHd5fZ+yamW5/wDhYsuyiZERvWwRmQ824zx6kkM8ZIT1cIuWLP1GXaaD3CQBMtYeN/E22vg68dPwI7Y2ME+3okgRDNwi6OTwZKRVERha+eJ05neQB/Q8AhXGzAf9mjeoZ2bBvtZ03LicWbH+wepnEmE9E9UnTFuL/aStuBEQAzLTw4IHpIYcruV3JHIkFZnqzW51hRsbOu5tsXBlhMhz1BrBzqD7g6SY2A1DYHqubgiItzHvJpbH+8ZDDQf/ACEz9MiEMaVDuBPUAmMR+7Cw+1s0whUJzLrbW5J5+HQJPnE/sTSWfRD1XO8uSGC+uSYT11HWXFc6Rd5oFJgfO9bAHFEfTsLs9BPKD9zwgDp2G3KPcrPCXArOAPE1rctID9LLI+SemSg6uUcdSC2f8WJDj/8A9lyBwkGbUc5Z25DzLzLjwtxdd0cwwJB+umb6WeABJ9As2ZDTtD43yEnxfB3Hfnp+LIIhh22LsuRR9Er0T07xGJ4IOOF9WPQFxdMftLJ0O57/AMbR5Z46u3wHGDJHpvW4WwholqVwM/cGfpsxXfSTk5aG+MhFuZfZa0HLJ8zNnJsOGJ2o6P2MJ9nQwd2v1b+4/Leye6LBt5xIb9NjL6ZIws/d1vdBj/bEHBRMs5WWRif7c7JlPp+tsgOuSyoKUcZpHss3cvUWHbPZb+rHL9EF9woMh5GJ2rT3bBzK7AHWOaGcYoXmOZbnLzzZMYlf26IQHazx3RD5YYAFxeUtVkdb6FwB/wDlAIjAQB+ycbdd4f1KxzEYSozLd6LJxbOBPc8LpA3+kunhZJcS4SBWxyBzWTCSmCZcz1/+Q3bhdJKtAP8ARMNoWqXGcIzheodul0jhsi1yPHcsCMHWzIVOX8ALK6XmRG89LMR5Ig8Pfl+B3+ZjCXoHRDm0Q0bAGWLzNphGe54j1DEtB3dgC5UHpuUXZyTjynZ9MLIi9MuNOrZzwAl++7Cw92b7HMifUBi2kjQDsiXQ8Hn1cM2cOHUGR+GoZkYKB1tn36t4XMcJuZ4T/onPh9cQR+rk9GWIww8OCwIR+ijpjL0P6Qa5ka9jekTW69DI/p6WAZ2uUgHE5E/SIDYK8nM8T5pvTLnba4DxCpx5sxTHexO1EBrnGo45v/y1DLia4+tecbOg5AkRo0+ktUIZGFdVgQdLjXWC48pYNV+yVoL0eWz1jxep3qDxY1Jtzq+m9Q6SBukUU64PcsUeRsuXJOLvViPKJ/yDIzeYlmj6ttiHqfWKAemN6OB78Xe8EL9xaojPsvt8ATTE9yhPfRdk37vp6vRLQ9JL8PKTi5hduYwWVsfZClrXgwm6WaePJZjrwQd8HwJJ5fIeA+Its2bNmzB41yL3PGR9M8DnHdoYYPHokEEvakFAOGxLHcm4twcR1m4c+31DAHP/AFBeDrmxPGyfqxEE5y3dy6N0IcH02zQxoni/9n7XDH9XsuGNydXbHhncbnouV8f5LGPp+5L3DyesYyT9O67eoM8JIDvpkyYuR4Cwb7tIwHCBkjyDe49zRj9/dyOMnDiaDf5cMjE1X0nOEvpnL9MLLvNmI2ND7nTw5ANwMDH7DJ2LOS7tvYsJqe7nLE4QrnQki9MtmUdNUF95xEAVwXX7sLH38E/syYjO6Rw4N36CPoEc7h9AHTHFxWcIDvhYGHtsWcD5+h+psrCIMHMf+ozOL3LBj1NDlEmiMcv7mLTDksF+sxunCRkw2GM7LW/nemVmD7kws4bEht2pO9fZ7QuSx+o1ApDjGBPCRJBSeg1s9/2u7XOPtl0DD9XNLPMGWenuP8GXheAWQ8aTcPlsg8h51YfILRIMoLj7iMgnPM49x3DB2OxsDYeSL2DbNOJDcyJvqXUiObscPGbkIa/Vl1cPH8svJaLLCgssRGGnQNmLDipv3j3GcsLs0EOHLeyR7gHiMSthHu4CxvYWZQ5z9kL2P1B7LkYHcXQ/kcL/AGXCJgx1hrvhye7OYB1OMnnVuNV/q3ERmowiP+qXY9w4ID+xpdjzppZV7OYSf0A0LFne5/GcH68HLQhdP6Evr/pYVibYdFzDObgVpJyZEHQGtjsIOZ9Tj/6zzt5i8pM2l2uUTd9uAwv+j+oOZJN1AOPUAxX7DKz/ANbf3K5pofcb7kX8Reior6XY+nqcyXWCYnps+p4O44BhC8Gn1tlu8E3tN4wL1ADhC3zdobl+8NNyQQA4IZs7mjATJ+yGUwH1M1C+wWaD7PRlXL2erO8GD303U5nUGcNtx2JbBbI1dru9n4zX3K3JbzcocI/UXcBaZ9WYjwOefC2tr8d8Fnke/wALfVwJGHV6KMlBqVg7dwu0TE8d54IS+knN1SQ3JUlOcEnWvj1xeExkNEzEoeQ5fTYfuWkJYAkqN9GxRadGCx8VwB7ZWAzuj+9OOJbdQe52G8HG4Ny+mAOvK4hGL1Q79GMAOA+kjQLVA0ObDQ2LEeOcXNH9LCvNkCcDC93Apch1/wCbV7QrPY30yftkmSGnaeps3VwHkgcCHRObsbMi9Ql0CS4/1Pzwvu04CDuOHbYHX1KmJ6qdD2etxgZudXO/3NjB1mm+89RRgYm4so3upW6mGD7bmxz7sgwOHBYL7dZ+ro8dNsGPqZliTpfdlj4fuFzlxDvnRFrP5eG6OHLQg9TAxOdy4PGff3BvnnVptry5HDHjvwblRv3bAA/bHqRY4a2Xt7Om1ejPDavMrp9XHD9FvDE3bThbydnxc8j6I3wnIXmLI7i511EQHLsgh+atvg+B3Bh8Q8g6SLEzs8XDMEo+ozN6MZgvRsN2g430YoxWNPYkNu2QpfZshjTkuGzFwsJ/mDH3b7PPdtaDXTxAW8IlgBsStdkodtPdr4cLQRZcuthvAhl1xpjG7Ljhe7Q0mYXbzPnJwYQ2NhaCMTjo76to49IEDhu0MJf2vtLqbZ4NtO4x2fe3rzG3hDn7D7GB7AAeP7ZO2RdVQo5gsrOynWsdD6YT4h653MntOLtBc5XrDO/uRGmvCem2LTr3OLyQUczLVOfP9S5gjp0/uQcg6jIcqxOvP3A+7cfW/uZE7A3D7GccCw9rdz1D9z8PolzfHYQ7ossDdGE2Duv7iT14EZ5H7CCaoetv4kFOPIR9knbC5H2xxBZ7Z5H6Y3V+kMkD1b2ST/XEtx26W2d6yzD59JYpnuZi4LuA9Jcsl7+ot9QHr+2DtjEg4U88w+Ickn75g5DCyIx5TIADz0+oMMEtfO+G22/hB+ANbRCXMT1GqYJk2Ofq5YZJIf6G4NyXYl0M5pubdr2Hg+7mC45GDrMu0nkYlHxhmjKJudD9fZcMbM1pyMaeLkN5ITygxi6SDwwYOITHotH+zAZgPT02BNZy2uBqSODiwkp0NrhdaD6ZbUDOZT/YHiMyPvsHgDBz4ObxFjAdMQhw+4RlAwKcNoI0TMsAONnkmPEAcibebCCOumGuwU9l0ct6IKZdY5CIk0NDRuEb35wy27XmHvJo+jI7uXT7ZzwcP5K2UcuXmy6pcn2TZrY3vXplRmVydROcE9tr0CxsonEOMjngD+XPSne+CzeR5O7bsTC7DltYo1h6tXPfjYiEXLknyJj9Wu5Jd4dkaZs7MFmPJ2MrdQtjr34HhHpsAGYRZr/8hPn2jIJ79yzJcWOTPGxvXqYdi8yxSNXXgCQJFb19vSQk2J29n8tMCjHwvP3NQHiTPQIOaWMcg1Kn3C5A2y3tPBP4jfIb+F2gBUuJjktyGTWw2JzEzFwZZc2yxz3IpSkqFEZBkAH/AFKvHb0wMR6I+yDrT7xk8uOB9H1abOc5jqzZzOJxveQ+D9yT6E+8B2EsRfZ7Ju7G4vora330Q6u4o5z7Jjnbn9XAQzjq16J48ftauDUu2bfzCIoMll79X1YnbLn0jHL48TgqdLJAv3SC7tx3DA+py7vX/wCQ9DsuYOXExmjeYsXS3QjOEWpAyC7Xf7yx/amDg3e5hjTHNs2GqmJHk2cOZho5YEtuCw4gA12J59xxP3Ekt53H6JNzD+5TGnTi4UeY9j+pdWRWw+2VeyHfd0uBHKypkqJ6jy2ggkxx3HPu6Fqwx2XFgeYLljqW7pcZxdzGn7LKeGzyF4sEYZh1cEzr02+IxjcDHSVOzhIFsQ2TZCF3kPTI9aZx6TIxP3ahYeRiFwEcYlk+XI+CKb6YWJ4Odk/jHyM/CyC4iey8ZOO2k8YHdsMsiQcYQc26cCFoFhhpc725wxG2BpZ8U46YPvCRQVh109No06nGQFYmAYhtDBAvcvBS6n3KgEy/iNoH22ynp7sH8LJvS5uE6Jice94mzpcpMe8nvE4evAcGeDfotIBBziK48dns+yd702CiZzcw3Cziammd/wBMj5sYwp49IsDhbO0Ecfdo3PEBB25BXTkh6bca43SNB9ljXIwcmGbYzMuT7E/pXZ49zaiC4XjnmHJWZww/QnlOMWInsyAl7Qx6BfufugG6Gcu003wNlpauv0WH8Y6tLWC4HOeOhdCNabR6tibgQCLgTgJILGDvvG5RjvpDmDQi4v3Oows87OG5ZLszeElL4ItwBu+uJITvTJIaWw511N0raF1CUTwSixuLE4mejcP/AKFgB30hABfPZOnYcJ4eTJLjz2RAHBHHPjnzO/J8MWPvyWGJtuZfSAXJJxUzq6A3qgKzsFsZGDS6MgRBvpbM9ewbQq717JngT79pW7EHpsPUhyWOi4Tjq1gJz4Fy2b6nrHq0epI9LBq5pP1YMnoiZzPNSVxqsNmDDjnvZ+IQSl0l0Vucsl6Ocn2SLC+k0YkXk4OhkMGm5C34NOfctA592R3pxctNm8sQSrTN6bsMWRjUqTXL04yb3Hy7+HJt3H8JpPd5Jtoc7EM3ptnBHLnJhJ0j56P3YNJzZIbjccYtXX3ei7ARHkZW3A+5A3Txx9TLnOpxMM37DuQexyPv/cOuILlheJc2EPVj+pf0MJlcO7TAg8LtimCcn2WfuFzn1OoM0D625yAaZD3Ht0bct5GlAbncFiYwB8NAVnkJOkI6+Dm9ByGjs4Y7h7iL2gr7n6PFF8DvPUY5SOX3mO8ez9wBwx9MeBoqibqCZq9+MbVn4TwvC5P086ix4Y4dJn9riNYw8R9zO3fUGOZHcD6gtIxpwNiOynJBWE8BIa56s7Gga7DSbPaFQjOCRUiWdpjCC+Cf6XITnWQ9rY4z6yzDuxYhfXhnCPXORlUOWD7sh67zsmc+dabcDtNfT/V9eHsZXC2SMPQemKzbeUIcdj2xo4kFiaHUTRze0urInF3bj+kJrFcv1lmAzVhtWiKytoHEWf2hcB4ZbeGz4ac+jCbkj/GuSNa10XCB+D3/ALsmX1PWRAuiXuRGKGh9e7VwxZk7hnGe0kz9wLmXL800O2E1Q/awDyTOfSwjhhpLr1zmNwsZxPCWmH9XBxi/Vp7H03GWMDdEPpJoQVwld8XKo0BP3J7vnr7tmF9D2mL57M5lUU43NffaR7BsHc3YuLLy3jiQ5hE4B/4RkqG9rrYNLkQg/TLh9cWpD9NnnD4L8R86/drb4DdBPCaKIUmTcu2Jb4LIfI05IcsdfUFoy07Jk9Pq55NQs7dmmi+0N3Ca9Cnu5VfcgQvJZ3YaZHlx82W+o9xyAwm4B0zx+6NKZls6k2KBwrls5OOzqADztxJLp+tg+d2Gm+Xdtz1vUXJ/UN3RyD6gm3ny46bgI3vIxss42YzByDIj7hQztzZqDkh2dasN5mvBsi2DjU/jLn6x+77LSeu3JspAbo3QuYobw5KxrsjucDDvVxJ03LZmNBt3dPbPcwXMi6xiXotHyY9Q61gdUmpp7H1bcJqdyfYeIljB4N0SQ3BTsMx3iZwyzSd374iYMHvJmYkfV5Cg4MSQD2PorBfqPCHPSWXalYixQgkCXB07sgIYde7McHdNWryJA0OIruEkREQxghnos+3JYA9E5zQ4ZhB6bjGGEsXezJcnKIDxxfSRiyby290EggonBcYWvp+y0BwJ6vH0s7pzLlfuzRMx2NknwfiQ8i7ZDZUqhkTNIHqAEPdvKIQ6GJOqM3TexFzibmKDjX++rloYgjPUf7kPsnf1kQgmwJzjaNB7y6gxk05sNQiA+pwBUgGEHTA7k/K4bvP9NruMGuHHu0/rFk1TmA6sfU+ZeGuRlp5++Z9Lcu88Qa4nIkZYlg3rekZudQlu/wCrVwen1a/6tOAAuMgUg478PJjX1LTlCdiZPjD7i6mwtcIT4SJMaY2DOmMffphWkZR6tqiOXstEAmxpZp5gGYsG/UxjpEvQsE9RyAGdifvsuYtu3aMz3e5CLxmJZ3pZH7ksYseJL5FATdHfDkRCOFkl8Oy5QDExjcjJ0LV7+i0P1OM/bIqMS/2m7hNTpX1D0yPc/XndH1dMD6irK3NqPOXF4vRdcJGpg5N3btLPqQbywf2QwwPTdy2ASMne0XBmBiix7gG+7F3ljyceToO2EKa3IIurll9j2gungOY5La/czMOhJ3JlDfV/2XAyXA//ADWYF4XIqI4OljTp5PK+F+Z3Awmd8X679cenFlnHhfRhGbzbgWMxIy3CZc5DfUhQf29xdOA6YMYEhpN5LqfBYcIkSTsOywcsekjX78EzI3vBvslOJ7haFkkcDZ7T66hfWC7ANZG4IjvqdZL0RQTDkDmacLoSLB65jpncm24HJcYDeLvmSRfaT44PaALTudTtoI3ux3Lkhr+WWs8+LnJkLwVm+m/dvIH27kDnYV/ri4jbRB6yXARzC6Sr9zFPsmD9Rmrfv+y6bxOytkbaHSS6aCYD/wDYqz9EG3qYxN/+AggOuB6tbs6XJYkAhr/eo4iweHMwVuEQA3gb7bdnsWa0ENavGkPsZ2z379/qNAwZH0kMkQQCcMiOZC5YxhhPcT2GZKmnGI7VxAauLToXb0sCCfyxY0bI8EuGxoDk31PccbgORMI8uR38yJ/uWZMectswhu54akKJpGOz2Lk/u6Hlh6ZhdBMgLmxNMs+OTYVt+ONj5X68H679MXh/T483yRDv3tEckNk2N1i/uT1HaxZqIHPU66xwX6s8HtvUO7DGd+oJxjjcCTviwOcvEDByfS0Yhc9QT4jA9tqEEZ1H7WtdxxvqeadEk04S4r6m6R88oXwHT6uEmw0+y6jXbaF920Kjr3aOA+tiaGt4Tp8Jnj1KgOTEY5jXKHpgAG+pjq1wh4pPWxlnk4iX0O7U0duLdZ5xjc5NJcPQGD0/uyNx0X8YrkubZHDnLPV7bn+tETEOyWljwvVvheTxmIY4YxDGT644u17DhHiLWjWKfVoKwdtjwYdIfQR87M9AkVE9J+0lDgpxHovMoXIutICmDCrH3ejshM3kgpb95a474mEmPCmHQ9w4Np3H14HI4cYXQ4+h1blwePuWzZzD7yVxp/fcCZr7HJbYT/AbeESOTMuT/vxlllpaGsAcZbzxLGM5IAXDGDh4c3AP0ej/AG2f90OeV79iOQh/Q/THEeV8DbCSfJ+m/Vfo8X6fLY+EyZNiWTQUnO0kPHs72+g+rJ0eLU7fEd7gYkHdQYz0HuCT0tF9yZwkebi8NnJyECFBFDzjJmqbzKfRO7sHvudoaWqAnB9jZoaL1HZQFYhVdhdsD9xxdtxNYZcNz8OLc86T5ifZa3JLlFGBkUXcWGdhNS5ziVrCNM3mJtOF7ZDhvo2M3Fs7bY5iI2zJwEFedoI29LuJP2w/9nByEqVDv2XMGY2xf9Jb8ISD/kAW6pG7jqIped8G5uvEgQgspvJTSg1yS487HepOovOe50G9hMkA46JY3M9rnK4m8PdzoztNwNOpxsxThPuxc362M2UIhhuB3MRDNGwnZvCfT4NnEJOGBo8nF3hr7yB4JIYLPuPI/XNIK/W97+lviavn1Zy8D41ZDFYG10Eb6idP1J7tIM9ZyQgWabTjkj9Lb+PtPC+Agsuk+CH6+RDwFCRh4BWHNzDbF1I8e7Lf8QTSZnuVwCSJhBxGkstuHjYH1zcCD9SHSQzw5nhjDsJntkzCSNbBt0jEdOIenJoy5uOxJP1GSP7FNz70jgbYlsvkYLux8rgwIGaWj+ouhmxGXo3LcgzuxEEjdNZdEmc7zctl8RoZKs+uZB6CGGrRZpgHZBz4fZGHHoSwCr1dmssC3pZpmDxMZ9Nn+ouYddumLBkvTIro+8lX3OG8oGWVacGzA+pLhvM+zxkAIuo14Ppaf/sAhcNhJwHD1MFlcIWDBDgTWkeRx6+m5hwrHf8AZ8GH09ygP5bgdPuGW5PZZtGAxBjAnF7yRctef4yfwORxwbigZDy5dI8JIRCOewlxaThDg5MnrY9BJzu7mwuaWIOppiPViM2Dn7uJyJ0Cbs8f64ht5iGpEF22Ft7LV3mDLWEWM2Eq/iQfVt0vummmXueP9XpCPUHg68N2+EICBZ45i7eMmeBrYtGtzNhxnRGJ9khcH3vUXmgyBouerVzDzNVzpg4Fka17lg01lIb3cTQi7D9nf8bizBt4PouMMBzCE1gtxlE2AuepkXONGnrJCR7Iv9ZfSq9iOQNb0RLekvQcZ6Z8Zy+rG1bZ4ZuFkwtdl68WB/8As4C88mOAb4MmSdWOckslmwIbj0c/doTjOyynR+jJJF9ksU6uQIKPujLAyXNZ9ntFgI6McLJGFix1Iv7rgdG9WG9rEbV9xC9stpvJMNy7LJPQ4g51AP6kS9MWIO9mGkvJgEdQzbk2RblivrIA07yDDrmcR53Q2jjqGWlcgLnkSXFICTyt7z1EpQzgPKl5c90sXocYxKIOdIJ6XA3QJPBj+yruDdzm9+kYf1F4kQfXdqhEPGR4vbBZFiF8Jh5A2P3akOKPYQRBPZH065Ywl4yPHN3F/uzt1+h6jCaN2jw3T4b8i90anovo94WH0WEs4tBjSYwCTCI2+MSN4lu/+sS3b7ETnBeqO2ZCQvNe5B3pcpN/pZv4Nj7E2jrc172I9yjHnvCS7vok3RIbl6tu/SC6xJ9QQjsLnHGotpIgFGNzTGWEwO9gPUFzxLBg4P8AtAjcczR60jyjrC2ykFgSU7l2GWFyNwRDS52Fj/ST/uThSWS3R9yPR6s4JxYUaP8AUGjjE4NXo/TY0Y4ozWDGTBxaSgHbGJH2gC9HGInpFDYabIBvNkc8Mm5DvENFwgiG/XMcM5MH1lrcNPuSk63iQIbbHEPshEZkDe4V1HAPNiBu0FX2X2Qz6Y2ds/cLHLPsdGJVqetkh7zM+5IA65nYzmOT2MySjfer6B/UHwz7gTqXpnHobpOclubPvbqDM9MgjQBwe40GB3IYvHntAQnMJZ9QpW4LDh2/qMXZAXe2dJjA4+fcODknK8r/AIl9Qe2GzodkO+G7eZtth+IbBhIZelGB+4SyAa+7BI/tm/ZbwMo7ZKNkAlzp39TtBHA0HR4g9EfrciQNW5ZOOurne7g4ZMFu7CcwMDhJUuVJ1zcI5XTHO7bC43FE5ELvHZIeAmOJ09wWyGBL0k3SQ2CI+y5W3GBNHBZY2J93oEb45Nj/AK3DDOoPptOpTMNPc7BPp9xfiD/2IVdbHxJOdyKGFlOcne4ykZnCDkWShHHLrettEOi5GnTDVJwJyMmU3PnNPtPfQrkOhHc4c7CHiyGkgdXNh03pm4nsjQHLunZIBucMiiPNCa6QnwT2t2I3AelxCYxzgxk5z7nYJZzffI+oef740TKIfbeMYz2RG8Ps5yb9kE2F636t05uiwBk3Yoow+pL43bYiDgZbRzv/AH1CHn6k8EURQPQkBuiycXo62xbHWPc8T14ZcLY2GFHENYnLIzIhtr9eo1y2O0Vxhwly/Z0zodWZ1Cw8x39MPiv/AIwU8D43wnrwO+Q8CNIXbsfpL9l/pJ7j9ImpkQKk9Nq4yCMLEcCW0HDcYgZkuWPJ7I3DyWZ6ZgJfZaXF2LEje7PFH7JUOsfecWvOX6CB0MnAgXR9P7kbkXiIH2RzX7nGrq59ypdTJl0bUd2mXZsWzkl09lrthTCIrYIfhIil05LWL1l0wtKHDNy10QHOIse5nvuf1cwR+xy37Xp9iE4LPpmFnVwOtjQ9H0fpiby8HYOuQc+Gg+Bn6AjGd9Y2Si4H9zyturYTEm2GxCImIsZfsG4fcl5MOSbexqTgOEmrpMhHtYVCAvHUgqvUXpkpxxz/AEtIYfpBQPUTgXqPCoOl34R7HLwPabSEHnZxLWecRv7lsOI83Gk4c+AAARDp9MgyA5MmelliIGkcMDhUJ50E+Mzmdjl1026tb2lwIc0O2GYhpkyDMaks1OWWABZglfqDwLODwQhDI+zCnDJ8v1ZPuC2B9t9aUt6+rRlOASz0+5iTiO4ED6aOBadUCaNjxnjt46eAhz4dHotUe0srCgZzBwQKPHvbbzCdAkdH8pQ70hYQ04w3bwe5ftfZNGB9kvDkfuxndP1BZjfULurl9b4QePM6yMwoeC3bXJ6zGVYzYFiOn7QcN7s/dLkuMQX1AOJwVycXu4JjkuwKvdxIvPMiUJweQXaYaajOl3SBCoabk+yENhzoxgpH7iSX072eM8J42XTsNGae+ma8s4H7vvLRakH1cgFwX6naOVpcW+70f7InDxrPBpZ3c1zEXLncNsM6IeMmqRS4M7lpt1Wpwx3IwOGz1CVe5J6n3WORItCx+0Owdwx9i0i6TGKG863A9AjbeFBzhcgJKYkrUOkv2sORh4g2DiXCmx0T/Rt7B5b6/jJi/AW77OhLm5HAGEsmOc4xiAhjKvIH6yJ7cdxPUPUqvHAsks5sgWFIIRLl0TiDhL93IQB9EQAyzEoZI5nEAi52MMAy6+1x7t7hOT+vZDFxgswu0R4CEk6V/bdi0cq6pHVqJQ0SH0xYJEPazqw+ucXayNypyyApAORx2i0aWG/7JZyode760bjnFySNlOW97i16FnMJpzfotn3dPdkP3OGzOyQqDJJnCaPV1E8RsyJtkvEkLuQE7hsfBHYbk9yl1p2rpTHT0PslQuls+AVz+4Mvv66J+75yns8hDRISh6Jwxsv1Z5sBTmtbjb5xF3H6g/ROj7v56ZPdwIbtyMCoHuxvM/Xq5DF9TpSO9dgR4j03LK6NG5FnEzy486wjzYd20GIyCIwA+MMpWMerY/6WT/QmEM2cF9EBUE/TGDY3TgtjHA1tWiKz03LRe4udZ6cjTPMWPY9bAC/9HpgeD2XYz3RbjhP0AjtIGsdBqF2y4IjqD9SbDSZcZxc/6eekZZjYy43qE8CniXwMvUrgJh7k1m1jFXfA3HSCkZbOs4t+j6SQJuzZLhv9yBzhDPUOeCIdRMR9E2ppwLDg2SlaRnrFg+g3AaWLEpZ9EMwmjc1G4bw3LnDn+wxzNiRnkmMLSORyuw9TG+3TaO1eFLKY/brxC/3DnLOuwOzu43VwkhUGpKmRcTCJ+kbudrDOIZach1xH3J5j4Ftb3dphuJxLcbYrKZ36WpXmWOctW82Ekp2th7mZ9lhi+nhgIn2tFjL9ZpDfdrdheCdjjZGfLzJxEG6zf7k7WNYOiKBsGTp/Yk1aGNcCCBHNn9BHvpaVzOpLsGbC8qwCyMZZdXGXJ3HJRLXlcVf0Z9bo77LkNpbxuwufsQQ6P9QLzKUIoU6ObIV9hYyCdRh4sKJ1JEAzZeZCTUPusSStHhzO3ACQuJnKyO8mELEA3tlvqTq7psoBMG+9uLmLcCcRiP7yfJnvwKdTbalr7hWvR5JPGcRDZK9Eowl56YOC5jp1MpOGYR3GImx4A/bb+XoN1hZsfeSI83B3gw/3HFpsQ5i3B7xlUQHpjNW4cmRM6uMYn6lfRpHHJuDptsAJY4ZxuNrsZrh0kiyUkp00Vwy52T6i3ktrNVNoWYEYJjwsjHbbNJG/5Yv1sI9zppcMKnF0XV39lx2E6gySEl0O/UjBifUXeJOCxYBsWpM07O46F4zfqCY1bWW6d3qM2UWtujxzczrLcEr2dn6bUlnCl9ZOftLICXp0sGcJwzmFzP6uPqXQbhOfHdEF7tifuIg1oYoY7k3GyBFxnZThloeJXRkpxdWJkCYt/mAFv1W6P7uRbT6shfRKQeSI/b3MBfst3Ooe9umAeDveZ83YCRJemy3PDUfXpnyONeSGMvMAmzja95Q21uRxhIdOI67mfU8oB95b7k+7m/yERN7XZC+8hQ/2LMxjvDdF6L3bGMzqT/ZGeQnhbY454NJBDGZEh3CaOZHp40Ezml6lyczJ/cc2RFEEYu4zsWpw7Xp/HwQ74LtCQWbuh1jOXBrboMLkMnXBfuXD29cTc5zri40yEjnuS9ko9Wa/2k0dt+pCGIzxxYM7tRZoZj+LX5r+vF0syTWYpAOrrw9Y8TH9pchhfcR4UNEoblwBAu80iZLviZXHrchPzEBgy3t0sNMLIREfcZjxz4nYUzS0w3GvMKPI+ceSC13aONyE54VwGRIoN9N4YAQ4DGerHn1P02DCJ6SCiW/cOSE2j+oMK5diPcr9r6QTx/cFxzGICEOA2iJylllCZivUHxZ0x5CT3A7ZaKOM5g5bB5lLoZPvXVkoZ0vMAF4nWrey5TuUbhPYWonMt98w5xyNAb7mjCCNDct4PqSCb95Gob+rBNjqGjmwv9T4veAFiB/culEdX0B9WPCCnrWEPgcuXVz9+Dvgz78NLRbP22ysZIYnTyWO2EKMhnGcSZUf0eG2linssLuFng8Effg0PSZSflrIsJ7DHODIHpOLNziXAeidxGxK5XB5A63JZBv0sPTQ7FtArbLyZ9Oz7mCDxxdoH8l1rmkZppP6WczpOjbqoDadtUZoMsWmOSgdnMscShdEkhvpLyF5kDC3vdmVzA6OrVxNeSA16EYSwCx6d3LmCdRjtjPBY9SZ6k2deTuniA+4cTH7JWlcLNq9EPViOpjWXcf2eNgwdFxeI1O6Qxce4sYdBFI8EcnhHOToY4ZOY6R2682wKXa6KRaeoFEmEov7T6/UmI4GyeT7D2Wc92uwkX+QBdxcZIf6LVtDsNlB09/2zMiFHthe5Th5B4ggcgLjyZ1CPdnWMnZ2nTPbubNknhdtC7yWEnNOGauLxLmf/r6kd9Ab/uDJezSJnebUz3b3MysDo9toSeCPB43mF+rmSPrwN3tyYPSEhYO5xLp8IMxyfuJwwBxG9CkkckfcX+rf34zyXU8MQeXkjwCw6ud6lpdWprLooipdtHTN9yfAUt4VkOn/AHfT/wBjbVmz+mXeJCeu3uYnCnrGcPJF76jmIL9bkmooek6mcQRqP+xLdL6hNU6ikas508Bs6TVtwC7LiC0bmMvR0RQPAdM1RC4fUuxggc247C3GxmLB9sOUuaAeliC1aL4Rbx+UWqHuQGw26d23TGI4m+5D28pvQhu0epd8hrznCW/1h0Sk01y9vH15Ut9nkErmhjc+DhQ9MrIGCwUOGbMtefpgQz9SO9WR4GzbhPo8E7kBhU+2p47yfU3WT/8AQSIe66wh6QEuCtyH9llkgNeibaeY5usfCZPEHu32I3SQ/qeAU7OZC5L3xj9ElrpmKwqHD9BMqKidxCp2gAEan6LZjww25b8M8N4g3NjPs+7ZR/pZkD9FtCH8mxl0OsycP3HX3JUc22OwlD5VeN8Ec+GgKzvrjjCojA4lg7PAs3pZL3ZcsMcZ1y47EsxdfqEBFmdRwRWltxPpJCP69rI56HIDHXYZgOEAYUgEejswzOF1al0zH+kV0zYsvfhgUfefshUju2wSNPWMjc5kCJF4jrPqNHmwzo+p3pkYbvwuMts5hZYn1JmcWh7bhmHayXFdOInewXeSsyOVgbHMR4VnodxBeo7gRAbBgjhkRPuVsRAOMkUl9g4leStmfUJmuDl7P1dB4nMYlPomnkx5jnEzFFyrtuC22nJOFsmuduEHws3MdluP6npG2RHM/aCls8j6ZKNcF9IbGhkMYDqRMnA5kCqBL6uyRvVmdF6k5ZkvQxg6vdoz3SZHTjJhi5/yx48OynTYS76jMZP6OC2MhyE5H2Qv9oh8Fptw/Dm1s8im9e7NBwTv0j+Supi+zsi+M9nwlzMRcYsYTh1ct+7V5D4vg8nS0ElV5S2zCc3FPJB+IPq2yL17lJMcQU3wUO8BFYL1l1121AJInBKjouMsHeXI5wHYemOOJCocehySD/8AN1h9Q7Hi5f8Artot2ewuQ9l2JfjKxowT3cy71TprrpJiOt0uFKwYMZBvCOhiZJuWDe4Qg7K0TPTCaWjmDhuPF/yRYhYPQ1DqJ3RymMYuP7OI70NgC0zhjjaM9ND9Wyxrh6ZHotiwk6d+oRj1GHbPhGfAW5mNls9s0vRkeF42KD6TRdLZoB7cHewnw3Ddye4LR/SEZsBnbA06gW4IY+8t+mzuQUTqzl+46/yDXY3L6ic9OZ9yEPs0twyw0Y0X9INsb2SE4nNk2d2YnRHHacxzmz4QYazYx14wHVH1kWQ4Cc88gDEV93Lnk6mhw4e5kHekAEGMRMn7jo8kfIZYDMKHWJOr93Ddk1g+wuAz+jKafsLMvNg4bwadkXZndx+7pdnxBJYZoOGcpiPwfARiNd5WR3Ng4GYa6ZDwGPcI+2yNnIK5B6W0O/g09CMA5e0zj/TWzpxs+j/q4vEVK0dI/LLV0Ge4iHedFzE9Efw76mdOSA1m2twNLp6ke8/VqR/RI3dCQr6LLL+Nx54nDhYM4Z2CakWY8ZPFzqw4Gw5SPqMYBUMjzN4SCyONl+pri7ksdbWx0OYFRv0YDIwzLIUYidk4Gdei5ngaFxji6y2z3dlooSuDmYY9x9ju4r4hKGNpB2ns2IEdzGFXWPgZk3g4kC8J+xhZsJymPWTmIMfRGZAxuWQA2b1bG6kuXInu7YcTFlABcm/wXRuBeMywNtm2I42dI3q6WhvkL+peHF9jx/stpV9ghyRgyHS8ydZLPHXcQX3CtdCeAO4G2zIw4CBn0vd+56PGaWBZZY2XATnhRLPWQaWDryHBpsyvH9InYfRsLqITurCRP6tHa/dzDyG0bIqLjiPfwSz4XK/Rs4YSQsINTu0QTeTEc2jkjF5J7YTddG6/+zdiXhdPdvcg8Jkv1P1JaL6grjF0UljCaXBeSJAG4fcA9sQgJbPRSAsP0toJF+3MYW1aLE2PSfuWwfSuz7tVhL7Oblx9MIsDW5kGq3fqsC/QjZqZhGocB7kvQKQUqdn6kEOk+bowwsj7hE8J6sD1L9WCRo5tBrhanSMHch0PPpAuOdzppZMWcr7TQYHBA/2TF974Cp45q4YgIhymjnu1QwVsyB+m1D1HhO9opdB5d8RJH7MuhfUESZm3V7Lpe5RejnYPLmQtiS5hx0y4bIS5IgnY1muYH1HEuLkGNvT7WQQ49yM8C0y/ZsbIGbskQ8JLTsHB0G51txsV25MC1wgyasyBiR4cfYkaPSTcHHTekK2RrxLl7md3nNbQd9xVfq6f5GQlxHwM8NEXQRst4y09T1oujwbgIgjRGFw25tvcYUQ9yfmr9CzGY7EB66WAPvw+Q8NtfV7GNwhYQYsJ7dyRmz3FXMwjDrH8XUQdyteAQub2WdNpkL+jAyEM1Z9Dq1F/aXMZiIem4saXZOpEJqe/HEmn/cgD/cRI5U+OBknYB7Lqaev3GY8J2WCGl/dQwf7Y4kL84kdmLzGTEGW3ZnhzZackQ2HDLE+mIU3POS+BwTNJkpKCTyRjtdjY/ToZbBOSGjxkKhOwPOT1Gc3f8vQLnHT1Bo70YbqMPO9REui7A1PVikQcdxJ/SfJ7A7nG+3aDheAyUdwTxrabyBhkHu5+G2VwWzzbULgfcHtM5gO0fTa+geyRkHRHFOZ9FqSJ3Iw8RhGJkPp4lz41GO7h1EtVTDyNg6qCZMfdYfTLGvTOst3YIEQ6WTI0/wBME7LuLNtT9SHFkNPdwAzjTn3ZKloOHRJmxWiPrwJ9Qw2xlxHhzz7MKcinOQerhoIZ0JI8Nuwv0njv7i481fSW2ASErj9WDiNh7PMTmC3rWSi+l4zwRBNgfQRzrt+0hwUZyd3FkPtNG3CmpCskbNElKHC7LvsbNBjI4HxJPb1EIMEuQ0veWXFF+7n6/wBQGEuFrI8lC6EF5ue/qzPs4SLbOw2hR1a8nDDXA9MsP3BZ9HE/7xuq7YBuxsG9M4hBxp4HJkNXM2Q6JAN/C0pdJGc3jZOdyIMyNWYc7EJ7hnqUUbWO5+iwwTvXBhh0fbsZxvdmEP4SfssSDaO3DOe4wh92EZpP/RM+B9M615yb94nDzifDgMZl+2QTqaiiB73dhZINoQnD7n4dTF8MxyNOcI/oPDZXap7POCyl3oWUwixwLJiBf0lGN7ZcNYnFuO8RHSDYsYttQjp451Zno2RUDfLxtqkGGnTAFo/7sg7DfUt0Mm8W9GRzaGbNHfdoLF9QfQZbS8QY0nsY83ZHxjaWO3FxpMM2UniySnKv0MQ16gHBH7gX0pPBg1NH6v8AREYAIm/cnN/jPJPH/U9/s8L4zx6Jd3h1jDzLwZZVppJcpLqOkgEzDJXGLVGb3KKu+4EyB6mQFzlIJGJJg8MYVPCOJq2fKsOBy+tyFa7/AHGCN+HG33gn1hX6atXGYkCLunH6lFG9jQmInzb2953bS8BF/ssIZd/vEnBHsbYgdbj7I5zFTuXMbIbbYrvCbLjPGVgwcenkGAsxuSvXLgkMDk3eZ47Q9uoYurzkj68HQNmf1evB0+mCHhA8WRfRFCKEhsDN+j2NgrsheHQciY9zGTkmv+czmvoP8YsYc4h4WnhGdnaXKPM9wGMDLCYRvpO2bcZrOCiNwvgGRYA6naGSa9raHc0AJT9HwPd6VzGHaR9kzcyLF9thTZzxjIjCY1MapHO7bVORONiDhgnQAsYsntzEx8r1vdkBZuEJxk48CMAWkWVMOXaJwkWN7XPDo9TznjmevBcDAgGhh+zAzXbF4RzARS+JnGuc222/rMcVGBCxs5uu2GWwaUArc/t+Xi1+wH/5CvWd5hK5ifdgTsCQObg3KaDf0wT2Z96H3ZXFuGY5xB7/AN4OIL3YHTpBCc1OaLyllxj+zqEl9ltf2PVmv0o0ZTmv1FFOuBMMuTYaBzfuZyCpUKDDKHGwjuggIHYbLIzU0yc54MhAdva7PFlwHjiOtAxuo3FeJJThcf4xs4V4zqerAcHv6f0xDQG4sfLPq4McMWT4f9QDHuBC9iWWDsvY/TD5k+oxcQBp4TVR+9ma8hHYCyzbXPCcZCa92NnrVsYN1ngXW4khwjbHX9Q2V7i5LDFsXUg8cY+MBlOTzc93A9R4IP8AiWXAtHtbmjg79puvMmKouQeJ42P4J9TeGjLvp7yFEEjoNzzq1yOPXjY0ezTLBzAtOupdypYR0Lnx+oO1yETM9G5fMj+orKOs+V5bmCXskeYMJ8Fqwwtxf1dWklseu4uOzKKaW3igO9P0yHg7G2JI0YaPp5m8rfuAu9JJvWdTGONt8L7bJ9k7YOG3d/6PgG+P6zVz9hVgcW7JQoRe8pyELccjYeJz1HGDiPThabrxIiumLdLEAch9bc/Dek6uY553FaRI9LcQYCU32T7UGNtzsPFXaido7thX2umOZ/0W1z9D3Vjk+iwzoYHci3YuAiuEYgbIDHtkiKo21nM5tykMYxbnOTyMvZeoKY74X3OweNNmQvJLqROoMEuNSWL0pwj9MB+4U2GovtgEyvQYjc7u2ymXFemi7MgMducMZ6iMTzCPNhhnIZtl0QSp0SLEXY520h7kH/h1JnH+6n/26Mfq7Kx+1smKwO5J7ZJ/VtuWNyPVTnUmbN4gTRuHLhsHdtDoLd5Vs+/ptS2ZjpYZuemE5EktFjDOJgMORaowMBKlS8ZcIg6Y5hAjMQweHR6YmvBOGTLi5M+p/wBUud6TojpF264SAHx9wAhzs4B6kAcrLhx18BfApPl8oBjiGP1bClnN2BgtUYeKH92acjP1AOp9W4K6C9R/2SgIf7sRE16R4/qebkPpgXJvwPFJz+8eDOM2NXdr2Vh3qS4paJ7n6sAAmSnBJ+reH3KuVy4HEb90PUCGCY4OezHxf6so2FyGjauJlsXmLltR3zYzj1mlqHL9lr0zG5ar/lnDh0vDBpf+sjz/AIf3PeC5X2W31PGQZjh5LLOsto6wRAzcyDnLEdPqOLILyyIjlIqDZPJDTLbkkhPH5wzZaZCTpYB34PJiT7TeSPIEyYTJmD3KW4Jf08zS4MyACGDQ+rSYTjUQp17JBo0CA4HWwhwcWhMgzJ+hitS9aBEI3NHHhp7eQp30Of8AQub90ivHFzYwjI9eX6l7MdDeQgP/ANl7MWvsuu4eyDOR3nZMAY060mz++sYb/S0xDJyTgEtk4XBw24y47iIt6ZAzklomEUNbwQ5GZjmSsQk9072ZfZGOerJtzYyGAnF2KDh3Aehc6Y8kFj0vwIfDcxLgLApjeZBfesxTMkoObapldE0kAeSTjb2Yy9CsUdPohW9HVxtpy3MtfgeCSehmTba2uDtlTn3CXwfTcgdgenPDc73AXD1BOyIOl77jHUqFOHds84LnwLIIXHElyuaantZARX/rBjZethH2SohPokwZ9iKCN7cDXHr+z6gHYWPCWKLLC6o7cRzSPL7hwNHtCtysSOAd9lg13xxIpxrrPcWMTkdOIi65nhDoMdJtt8mR3/ccDOrQYxfTkwejYDjT3bt6mN9/qAYY8Ux6Xid924DkvvxYOyQgBh8gSd/ksYv/AGkYR+jlajl3DLRP0QHGZ6LP36NgFpqZylDce30/sdL9hKEs0NWzIw2LozzlwgdRmE/oy55kQOzYoJg8WrU5Pd//ALry5nIfXstM5Tbkjj2+5YDJ3CCbvN6WdZj0xpI6WsLk3GcdZzsQbcMi5y0/2lrH1On7QwWoFjG0OjkWHa0IPuMGeoipw5xyPm8JmIJFXGzoStgIfdyTmd73tGnXeoz8DZ21cyPL26/09stv8iUuq+nL4jKc7tVukHRxmuRkh5rLi8JCQz3KsEp7w7YMEdkWYNkYmfucL7tOV7jC08RHBT37lv8AzXL36jhK322d7LrzdDwXEn9LEpKzCzUcOmd+k9lwfoLFT6bShYzxXHmXJY68HV7c+p3bwEUfdzY9s/1EkcHDYgXEiDNbquGB50tcpgeHP0yGbzsAD2W9TTztmOIxsjkjdRq49bMkKThJEyjx6YbFUQN+o41euN9Rlru30TFQT6ie/J+V/wBhdB/uQcUwz+PCTh1ElzAV9k4RoPdDsNbqHE55AiLYOTTMA3hQ7HqyBJ8gu4UIyFhrJLyCQPW33SUBWHqfBEGV2wfuTummdyFGYM/cyO1xf7tu9jkndtDwsg7c2SSd4iVYcX92OJ648Lq9El0WSIzZ1kE8NipkDs6lttseHDmxl51mp6JvW3c1aRE/leRD6ibHmOECKDIRw7bgWjWAttQFk8gzD5DDUjyPuRPJBMySDeY4Br7irRvcyDpdXNbFV2MF7vXUX7vq3OUvU+o4cJMFtIBOB1GY8wdlrvFpkW9cZOupYtBBp2MStx7qoTGWsN3zNEhouDPA4wno765gO3UBu4JTY+5NiFxLT7yw42TBhL+4B/a0lc+npgVIObEYODDD8clpc4Xuace4bh+yV/qlBM7nFi7fcA/tmv4oFueh7ZR6F9LurD/qwDFtjC1cch7SvVB1XcF6i/0TL3/bJfuGd5uyFGhvcJOI4TQzCepKAM2V6YLjb1lerEBvFzC33HZ9CxCuZySR1NtXA71DDfEPJmpueHd9WyalobNzEWiG/c67snh7eieli6JKvEa+ogRN6sJa9mKrcx5DmMkxcnwLCXXZqz7h4SupJiyyFxAYFRyBjOfMdw1tInJLcwJ3cWZNXWQwihNhWAYX9iz5DDYgcYM9h33CHEgGi1e7kSw4ya2y1yGxx3tkSi2bbV4Opx1xZ3sAmWre2wixJIjRsuttd+7Wzi1h9WcwZuTxl/6sVAOvuCkUT1b4k4l1LimkF6oCDfaW9DcmBGa6fdyJZxtsTl6ri5YcBxZca06lOOm9yTq19xEfoLghcLANXElTP9kN/wBYwept6rk+rFzTMcBNIAETl0Z7rNnuwh7O7XweG8r7xCZO27lEsbkQ5BSqL9RDwwqPDDbbHtCMmZuzHgLLPpVnGHuPFMpL3bm7B5B2zHmZj+yop4YN6cgtNXrdOYE2tmuIRQWxkPfgZz3OM426MjnsJFbqOs8QbijfQmA6C6iASUZ9ngJyEBUZzRmEi6ey2W5l4zwdPFhFwQHCN8QrFv8A8vGcYSt1uTjernh4nRCGHfttBmGW5ejfsR84SGeCO7Y9oAinJ4ARDotGdWK45uQtIXdLXjpBwjfabUIPQQgNjAW3VZxtxKQeH7Ld6s4ulppMUe5252Xr3IFnHV076svYe/3Z99nioAm7Gw8wac4Z+qnOlnsE1kYGQhDRj7lMg0AZ9bdNmZjGzx57iBuTK2HuFgX1Stj3z3sGGKLHbPejBuO836LEDq6RDMh2SzhzAswgj9jkzMMnKXCO+J7E4b/Zwqfy2rk5FA7j5ox7zbDTM0E+70xg6wjviK4X0ycB+5QDxcGYaRHi0P05kfZXcJip6ZhOROTIf2nCwyZg4eMsYFomTiIbcKcLCiclrJHe52C1jbE0+p2VuiFcZVgnkIQBU9Eg+mKNe7WTHDmW17vZEsGC2+vCQt3uQA4x2Rltxnih+yATGesiCatgybkfZKezOU3LSYw6ID6JjP6JIX7LVPOy9fAKnsl9WcI/bq6x4ed3NI3tO63DqkkR8wTv8nAdEXDpEFy4WHMz/wDxQQeHuOJO4/TPJgPGcgtg+/cRcW9zMLTwVaSuxEPc+lcvrc2pxHZ5TGKZae09kFTyK6IvSZEh/dpOD6h2BAHDs7Q/Q+v2QQU3GkEA7zzy5iBxarYQmGEZOFLC0jY/Vt/8k81DEzhtg9Dni5tacB03ON/2WvX1xB5KOVOmwBp9l1oO/wBEuqUYQOT6diC8JNweVUnIJJnjIXCNnPuJXp9MNEPFZmltsqW+cZGELxCtWR5mNTUjI54lyrHQ36gW82TTbE20e2EH9vNwpFP9pjTR1dLaEhwkjOG1G2DhaYxuReIEOM+o0hhM9Y4b7jn3AjPuSwC3/pxIUYXf/jMakfcZxj/ZbgSIHvPNxPc9pjv4CpwfTDbXlh4CA/g8NvEYxDiQwkO2x5TO8nBO1XKAs0fcstt79SXjZHqdR7br3KcWbuHtFrhpOvUhyyAWda3DDbt3Gwn1YuIyR7WoJqlQDm2DkgRYz3B/VYzOJOcvMlpweweSObpZ4JTUmbmQF4QixCIvuL2Z7j9Bj04LGVMHoWX4O0Csz7IcSwtQ+yAE2eNybKoL0jUB6WgP1OVd0z9SDpfqw2Dc0lx5bbfdylzm1/8AI6bLNz7ssHFEXL2qPKyE3/42nq4eslmCzGjyQZGAuWgPVgVSwsk+DPURxoSN4MtfciXMLZjCTg0DINHP1OwOrQc5tBnlZ08QOMALAFgPbB3PsuJW5TXwQHModSPhnLY5tT9pErw+8/qZTSOFy65Zj/hFgKX7UBuj6nCDvvLMwfsX0P8AW6OX8Gb4R9Xn39R0Xuefe0Z4ZLgAdia5CJbNFm37+Evnt4GxtBp4NlfUCyMi8wl9Ml1E25Qh0sC5T6PFHIb7klybsc055nO16benNyXw+m9+LRdbEcQcJ1QukZ+0/wBWvef9Suw/1YGFtHSaaM4OnIyjWDieuIunbknYX6JCIP3lvORusZ7pxNo85uLLQiQFlFn7S2jy9ngAuIyfYCVxC9zrSXJ6R1Tfqb5MgQJ4A/ZeuvukPDPMvsxg/aGMnOMs6OsfX1AIB3oXYSZrCijQYz1eff2SUXPcEPoGQf2B1YOaLnQ53JKQkWm6Iy5N9Kejs55lR27LkxrYJIcgws4+fZOgOGcBP9tZAS8/CQYzx1PARVwLS12mQOyWMtAdw6ge0GDp2SUHfgmPU2IszGQAwYSFtsX4Ha6nm2LwNkaP6W4c+puTcIZwGwLzHg4/25ZoqfRrYiX/AIQGbhftsg4OP0TecEOUUguck9GpNwriGukPaIY7EP2yvgfUyIHsshFxP3PiXwTLqFz2SYPG6eBtLA1b/TtbEhzkdCyLbvOm0zcCDssb2Nwk61beLandrG5OWxQN+448KdvuzCbJS8uV/wCSie6PDwRpwEnNxXaiduGXZFnqJI4Zh8kBjw8RGdWblxAJxuma0fvF9jYzjbqFGW6b2dkFSuPHuDiz08M7pkB6tCAOcXWhAQZHKckU1jZvVnvM+oCegRta5T+2/Zlpg6g+5COB73FXbsC6vWu3jxySWcnHPMD7v6T0YejJ9Wna0P8AgyOQ4vSEHl3x9TgCgW2LLFg6BPP6LLGw+r2N9SNjVfbx4gv7sydnv9SxVybsO+BjuoH1TSKg82zqGP3J3Mbe9WHsOmHAnRkPKgjOJJif6loBs+HwGOZcaWRONtEuLfmR1GT3s9YR6cxw+WxCh9RwOudrYZ2OJMdCXE7YMqP3KcTUjyq/RKc63FCCzhLAV/3WrRn0s5kT/qK4cnQf+iJmreMrsg0dAhSj2ze7s/IfAuLCvTGeCTYhilcPcWTZC3kdXOSnXm0TOPZEC6SPTagXFlEOZL2Izlc2EyuP3DWlfqIzxBt2H14YZI53EP4CWmL7Xq5mIUYjkgMW2EePSQdn7o96i1zMbj3I9MIGk4r6+yNYiaM7ZuWCZMS11lw0WyJosRj9WvDkHhZuzCW41jRloOekeA5yx54v/Yv/AI7sI92+523bKzu0cW7uWiGlj9G3/lSZaEkIzmZynOAX0zSi9mCIGMdlTyjqel7HDEY/XUJojZghlIdjFBeIR9M1+yQB4W5XW4yHG4PbAF287cm0DxYcjLCVRlhvSk8sHEeMu7xULCcG7hy3bPfmKCO0CQrUE1eqSDlztSjmEg02Rpy+uFsifWrXEDHGY5TfZaUB+kJ/SvaduqrjOKT1cFL+B0z3znkg8ISPdobFrba/RgQOJgXYG5G7AE+4EHwlbYGJMmipyuQi/V0gs85ZcHUOdymWPVrYOLkMiyZrouDqOzGJGkkcKWHDsLGH9gYB5kbGIyPCkvQJBug7JJb02XUvqMHZePazTgGGhgJwlzeVsARjJKgY/U8Ij6/ckvpzhIaCE/4kc3vB/wCUtXxsWtvFtvNt7ix0+nihMwuAQvuUdxzzP3McofpmHE/qFpLP1cuY2+P2O/Ujf6fxkB9Se7GTMn0uD9B4jgy0QyOcZcaQmcfK7FlwWJcJAD3Bdk6GIw4QOy2RhBGRSNY5jZbZYssYOt8HSTnOvpIc8tsDueAQi1Zv/aJ3osGZAm8fZbWvIJMHTwMw3afcJhf2z5dPEFPYTI9pLYzyFjvbcWG7SGTwYsb3m3lFMuUuuBG5J5q2SVp1pBQAu834aW+GmXBC/BONJuy04Fx7ZuC6piD2H3C7HxDnYvZOJZpZptQUK6O5DQhcgy5E5m5jNvtSXe3UDbdsJxY7h0NiKz2ck+yAZ+7/APNHNssfv4YvwO7/AMW/8rCui3XcH7i5D1Y3MX3HsBgzVDpWT/103LYCWWF7GC8Z+z7kL1O6TXccWHdteRufdtEyfiM+fKSWndDIcAEOjLrI+7JQHb/aWCRJq2TFw9eHB4YYNFuA37lvTT9y3tuvvP3tn1D/AHY9TPo2FWJyf7fEKcBP3c5w/QSpg/8AIPz2DAMh+oD8G+kdT1Bw+OcerOs1kdDJecaIW4EsGSWi28OuyBBe44nItNYQBgdFx4bbA54Li5bJgZI+TE6gmoWZGc+CDRub1YTuQ3UWqwzmB/VUP7aOAhJwLp2E7G0yriCj/wD0l0A6Jwx3aZ52TQoQgtK5Oxto1nb9emM3cSRPFANHk4e7W7nwZ78ELUPpDimIF2CX3YgcTl44IhEnv+7PQXuMD3KAv5t1wPc6czJH6ZxXac2A3ZcEvPNMuYAjGTBhxt48263aLjHW10M/tIwMO4MWeYAyMW3OWYb4bMWjqf0Jx9SteYieoPtkR3HHtkk1dhv2Ucz2Mf8ASPsRW1zYcPIe8sjE5Z6h7jojwyZ4XwIMhiEQc0wTcZc+7LVxIwNpmTyMEiIChhk5SvByk45l9R1b7t8ev34evAlvkb155MH3Z4yUnVp5lfKLE21Eg4dR3g+n1Z68/d9e5HeR6Q4NlwdfUMea6J6oYYkBtuXF+yS7M1zbhtv3OOuj1HcC4BsKROLJmQqdXJdfXCRW/f3DixPNrsQEphI+GowUQSDmQ5Olwcs/1EBvTwf6C/saHy1SGx0HvqMCPFxzQuU2Md9kDJsNurkuRCW0PCWI4Wt/8YwH9eA1OwNxh5LZH65JSYTv1Hixg2YcbuS6ZDciDcaQsFhx/c/zHjG22chwMBkHok1IAeY/Rbg4ckk2+N88xyzg5t8RR4HEEA4sdurC+rqI/JITBpun7c6TpgeHvwd/A0j2XeIki6u24hnN2UhLAzwUgsuBkiO/JsbHjXebjYC4tLblaWMOLYZjE8FhskYx7wxv3t+mJvsjjh9/ckQNn6Q6SKluM27Bi5LW8eAwNcMfoFvMfycsXgmjFlfq/T9Ns1p/YQpxPzuv/lWEH6sDVn7hQiA2AzGBCYR9SAnuXJuLIiddwADH/eDLyRcDYkyUUJFyQRsrQ75lvjmbKuovBuAxUzgcXDdlmRAlwN7v02p22MPg5GeCQ4+DX1cTNurxIromBebe+ZFk4n8nuTjntIkGwPCnZKTgjfrxtx5aGOLk0icLaWUCda2YGXPOY18wuI5B+708kSZ8DKHI78MQHAt3dwp0K3IcjERwjY2Lu9QZxbHgT6t3qGHnwbk27yXHu48AllsBLzPI+BmDvukvsVxgiJyRNR62fBEjjPUZja9pPEkyX3z+57GODPUyNc6HZnsv0/k9GOGh9ns+mwjujHj+STmwFfVp2yDmVanmessVZP8AoWjcXud8cDwHIrOB716Zb9yEcWH2G2hpobC37nkwMiMSMYcykIFpxzt1RHt5jc/UmMkkJzEi0pSNTpt0n4ckgM+RtFAzoCUcF5Z/cdxkrghKHWZds6jGyc+5C9LLwj8cRnucJlzI3k3gwe3Fa6W5JBhcX9sAnoSehXNQmHkd+Snb4ekQJ145hJwQxzb69Q3Vj4MMITxzc3u3PUwl6hyVYcOS2IA48bsdRHgnV09eBRFZveFGYc2eHrqGwNs25MQBaQoR2T1JjNezHaS4seI+z3OLX0c6W4Su/SSCwqONfS0EgfciJhme6OTBj08j9Qf68xpHvE9k74SnT9JHBvg5tPDWstsDu/8AYg/qd+Ny6BDljIE4PuUAQAwk3jYnd0zmkZlws3evuDc6j2N4JLIOs621sj6trgc6m28ddMmwZnFwiTgdGMne4E+dsSV4MZPB4QZuWx2bGSk8tqSCIMtp53B1OvuWib4Bd1IzLPs2WWVkwbj6lgAuShL6Jtb9bA4NxrtJH+raM9ZbS+88IXZ8M8nh1f0YZXbVxl08ll1cYD5S18b8Dst5CFZS02FbDbe4Y7tzw0yzb3EH6ykvq2D2JTo7ZwHFs9RozCQcsPWajPcbgIUTI7lmzq4P2WEjTu2ZB0c6bbu0Lj93B4DGsvRmMHEg9wkdXJvaYhU2E1P2bn0DTmcRHfcoL9S/f8auXhhwkR/eB7l53cbsadXKwPSccxJC7HoJTD9PZPN6OZ7IRBLcdnTPChPUnqztnsjEHia5ZBIlmwDpgHwmMB3bOI60tuPAuHgPRDwLiZ7sG70gTtxyuM8HHNnhyPHJGOW2fdyQOYsDlu7OUyzOMB0jzdf5uXXmwdgJLg84bko6Hv8AYtfA+IyvsVU6w9jls54NfBnuLQbnRg8HTZx443xsJ4IlbiJfDclMiO4zOZkw4JWSeHcv3agnMkeAH0hiDDxvjLvxa7yhVicyNkI8g93p8OpQtB/ZIfIxsW9wSjrTg/qWOLy0sv1JdXvanMtDbwE5Z/qcucLFyUdFtt623KebJkTp45lIS9Fypa7bl7uANfZckO9tlpHPcMHMmodkwlMYap3LthHxNCTabCGWKYdh+5DBxoA70PdP2RPeQ3eBe8yxkbQWAyUuE62oWI6LlbI3dkTk4JqRBY3Pgp92tHbTxHeblDGWo7I5BknExgNa79TkA5YII+278Hw+AzkMI+nPBhHjtEHU8Fq5GC6tuXjfG2n1afUMdfAjqV3q6bd9eOobbZSUn4IAWYWvq5h8XEgjTZnEHHgjWevNJw4s4Pae3Js5HcRcohwLfyjb3sOvZBie/Yy4uSaA/wD2cdC76Zubi5+rMEewNmXOjJVnvu7yQShK+B1gFw230wIYptkNG/b4tdsx4nSw4tvIM6sEH0wE/UTFfuhIx2OzJx49+m3EUdzwiVcsbaHPW/cMSMSDGfsQjMcX6uWWW5kkRnFK6scP6l68BHHwiaIz4fQo4dzwbDHRIPfjtpbDe2MRCRD6PcTeY/wTOAmQ+rNIrTLWOQ3w34HvwS8W9rS9avX7L6gt5h27dWZOpbCzx02+QeRLfJ14BdtvdrlsXE/SUtudRnsujJLZkLrS3FxEWeBSXYAsWcObfc4Hmcw4uci2A5SNCZbmi8lkO/qyzp05WEMEfa/7cjHktyq7PqBGX6WVDFYeDfqY9x/2EzB/jYOKE/lH/pE2znqXLrX7j3G2P21nUIz6gR4nlCLWx1lyeBk7zSwerCNQjidNiDH/AEcGH1Ydz4QeSasGveRXEIvrjBZD+5GerrnpPe2xdhdfCHnNrJJ2uFETmcQYR1Lhv18GxBwukRvhvQtD6L2G6CjqfcGIXHgbD4DwGVgfaf2XIucvc7cLrRtWXU5Z53i2c/AdSo5s7kOTbLYbflY+q7EASO98CnXWNODLIdhtjQlGW0UdkllP6sARuBzPJpPZhCAbmIGsiVL6f6WXAPSdw0jk5yUw/wDUUh+tWvSYcCX+WXYNWMiQngE/q1A6MI8Zd2Xceyn00/aknlWnDaSHJbFiMp6n0pjBmAgz9lyPLbfdhasDODwn3crmQ9TuW/ZEOhizdm2Ob+1n2Q9kcup9YHcqdSP0zuYjFJGMlg8LxcwY0wPufFrdIUBhD3cpwZKd8FwWtiHOWx4DbFnFnINtclUS4LQrN4uVL7FjAevI2nwxhhlOUcJKcOXhk4klzOEtCEWb0XFhIHwPHq22G3zsjS3iDEkdD40RlDw3xx4h4lkmvnwdwbAeA2A9SSkolwDc1JwutYzJxzCnjUdmnoPUP7lso4BcYB1RLXwE/TdEcNMsTfFqPn5hdqfNCcuibuCHoLn6unSH9SL0Rn0sZ1lWhHW+4xj1sHIn0we4QOoH4o2rVzePxA5dILoW3rKm1Nw5dDjS14C5uhbcI/IRzO0ByLN0E7qOUCQjcbJ+m73KEetszPHC51CI6u7Jydy+O05U37ZJ0rn7SI68Q92tntUuLQeMLO97zc5EnexC5YoG4fpDvK5aWeQDbJHjLPiwwwyig/jEFydP2R5uDOLnGDmwzmw1kntJCxs52zVJHwvwITwEtys7zOgnm3zJJvl8BayTjAkQIOYCeFuXLEbpsc225uwhLpaw+wjI9ubiYyoxHag/VyKp+y4lo9lg3Fskkp7txyXCU932Zf34hmBAZ9qB4PsSxBBsQIeyyjqYOd/c1UReE8tGFgbZeXYS+I5cR/sszZqMbb3J9sK82YQibtjl3b79trzIMPcyL2nPw5eeAw5zxG4wM54ywNZQk8dIrttRIeY9TuCyUiASkJNA+fXyO/AyJWKTB0x3YIZKd7M2C4er1s97vjPA/UnF6S3wMdQ+Nu0rXBET7g8MtfDky1yw5Dmf0iNE85rcUZ2tCKOQy6bwsAOYz7hjPpLNHu44woPLeGZDGKKToC/fglO3wW0t8HVvk3zv7tttWvJrxtvhjO4+6x6sfd/Xhtv7ghB+7fiBU8oL3OnZB3N9wHu0hTqfuxiONm/qFTAYJAeUdSz892J5sXua9E7SshZCQG7C5jYdyzPyqyNQXq6GAs1tzLPS2wPXjS2flrD5AbP1dv8APB6b7LIAN5LGSZnbtwHh4yO5zfB9XFp6tkwsN1ZY9Yh8TLxZib4TG2biXK/qeb4bZT2BBJyw8CbRtkX937ISD7j+4DNuTMQB3gMSe1bOrbS0l+C+csss+SWWNkyrHzra2tq1tbW1tbVv7t/dv7v68dR5Z4MX9Rj3b+4++1sfbft8b4bVu1f34lsmylr7sN5l7u3QMp7bL7hnURvd38Y1JkPgcQGiS9E+ZvJOXwacjzZvYS5L+p7WTDfD4O98c+fa3YsI/u6c+BvWXMzm79WWHTZA2wTMWiCwDolrCE8XZzP4Wb/dJkpPhDZ1zftW40xd0w73HwtzY2fF+G2tvhTwaWltvg1qm3xvjFj4fXkY+P8Au220t+YGPAv92/iiLMDwb4YL+vHNnyYjxKhfJZd8B5TwUpRhx6jDRHx/iyVpncxy3A0b0yerHe5PDvn149d+SYIieeJUhDxcZbz4GdOeA27o2eJ+mzgERjNkjivN0Si7YaSl+9y3dsJ0SDlkDi91J+5bSZr4TzststttsMi2Xw2XjxtvhtstvjbZfKWfID+AA14b+7dq1Y3Nzc3Nj+Fh862tza222222eD5R2D5qVumMKDYsQZB0iYyZ4wZf7LonGYZ1KEy+lk9eO+jw28OSiYAAPnHg0zMrdEd/5GS5J6AJcK5HfuLEi93CcwnuzGeogPhC7XCe4qk6Mm+/Fcr5IJm2y/HG1l38yy/EDYWWWFkj4duNjY2NjZ4yyyyyyyyyZjxzZ8NWrG1atSrLLJ8GLLHkc/PT4LIUteLFwbZYu6JU4E7l14TGDOmbQpvKS5epHJ4PyM5W0L9w9yDLhbjcgkEll2npY63HNh3xWtDzBl33oTOmZBf4WH9rfkVt+GktrL40tJflr+LfG22+NJz4mT8WFlllnhmzM1+LPGWWWWWWSPJgeMJ+B2XxlkEMnrwPwIu28zuWG/0Qo2qfAc3TS46ItsP9hBrokian6k5Zm92oJtlpra8Q/duli7bsF+8uZ/ctn+7Z22Fzbk+PJ1A12YbYd2M+1Yd+7pLMXyuS22+V/wADbZbfgCyJJ4J82Wf4CWJ/xAZZ8W3xkERA9+D18yt5n1dYCNEtxHtPDcbjyZzoQuqTAXDq7PBHSZe8kZVzF32Qc28XBuRcI1ksg+/DnlhrLjW6aQytsRMy7HwZLEjgYSjhZMW4t0sr8Wy74fLLvxPJjY2Pw2bbfl0nynku89/42WWWfMNZNnr85ExYeEeEg+Cyw85ek+JcSN79MvYRkkIXpDj9EqO8y8G3O36xIuUYxUeV5IYxm+ls8MuCe8L4Y4uVlmXSP/kM9VyPqfWE1S4O768GYB7mfLv4sLCxYWEEN0X679MfXD+oLcn4ZZ8SJ6+GEHg8kPwZ4yT/AAM85Nktv4mzxqF27eDLrL4erfG+FyWWeD0uvgGzDlen2Tg+hFr68PJyQezYPzxfVNPTC65tdlwbAzjxjGBkhNsAkT3q0PN78XmWXFsT92sHdYeTPWPKere45ZmI58sFnhk9E/gflvh3zBe7GMuRIFFifvS5han4j55BHkj+Pbi4/Otts/nPl38Hp+OeEhl8dI7PgnJOGwwD6ZiL9PUiyfSdM7heZsdxm27ZTjT7b9F0t4W85LD/AGC4Q8LFySQFCWeTMif8XBXIQlwf5Ly/2HTsNJ4HgcNrLC0zPyE8vwbdZ8a2uwGS2GQdSsFK3Y/LllnkniQ0l2NjY+cbGyyyyyyyzx/Fz9X8X9ebR4Kt2tr+F+AG35D4jPg+W6N2u5DwOTtxHw9QBJMcn2r/AKvjG2GvY7W7hVmyWqGHcnrbWJbqWkepwLuWToEw+JguO5NLpPV2fy3laJB/VbQ5LLjwi2lZKfhpOWGb8NLfktqlTNTnM+WcQWOkkb8c/CEHnUq/Zfsv2WtrbNbW221tbX5VV+y1+7X3a+5fDbbbbW1tbW21t/wA5DOeMmZfDJxdrsedy82gne0WFkRDp+rRT92NSngSDWRGcSMNnxYZMyGzAYGBvpkxzDnfGOQag1pYBANhvJFpS6uGQ8Sx6lzsPgcS+Vttfwc3PjBkm7Haln4MsLCwsPOngmB54+L8+X55ZZZZ/iY+C3w1i1tbbZnr4PUdl3Lp4Pmbs3N/8ZYziZLaBy+r9/LCh4tbCcFxE6IzvNl68eeeJmnCYD4Vs5KGc5k8gs44L+54grjINkmQJK3Qhj8S5L+Y7DM3gvb8ssLLLMLT6lLZm2M6Hgch3w/jfyvwzn8zfhsPgfljJJ46Md3Yv/l49m7Q4R/8S2DpsTKHIVyuNYhqYXvNSjDgnfbPjwLaIyj3DpsGdwNEc0XXhZOGOKTZedydnbd2kEY9yt8bOVoRyLL43/AeGAQkV7/ALD78AC0Jj5dWbZa+pdflT5hPhPyvf+C/HLPO54HweB5Di7Q6+NGxnH+lirDlyvRK3PoyMY4utuW222BtxG7ON7mjIAS8Z4zRtmSzWyTLRm2H6XPjY9IuKf8ADWMYSZxIrYWFkvjZZVvw78MFJd89Y8P4ksJPxp/gc/APOPyIPD1DwkHJDnxDiCTmBMnanVkQL9FrTHav4FsKzF58CCB7YPDRD7I8MX3F3pNueHFw8TJzPcsuGSZOWGSc3A/cVXHTCBxChhzciMxj5T8wbag8c2ThY8Ftt8M3FxJcRLk9/AIM8v5Ufxp+dfkQ+M8BB4HfHTwkxO5dSHEGqAubFfot9n/b+YlNoi22rUbZ4BtgTB5wbcucGWJ4ns75PbzPKDYIPqXJRbZ4QG2DskVzCkWdhtk/HLILOPyjbXyfKWfjB4238yQT+FPybb8mHx0s8h8jk68M3uTpdUoP8nqaDq9JetdiPAhMKD8A+IpAB4SMPLJf3IVtd2FatjA/VyR9o9zV73Jd9lv7JL3GsLbjGurIGpj2bu38B8csgsuJj+EYn4Z8XvyeSHw0sWbM/ONttq221tfJr6tfgayv1fov0W/S19eBVv0t+ks275e+D4GHwvgYbbS0tsku1zEbp/8AiE7hWebY2Jkr3BSR15c/AKMLhA/fiD7skSg9WNwdSZjvx10w/ct7lPfknWPvWtX1cX8iZBZ8A5KTNlt/Hlj+BIDXbGxhRaj4yz4cWEhZYSHnLG14fy6WlpIt8aWtrKtWvPvx2XyMu+SBDwMKJ2P/AKSKdjkN0X69B97HQkmYsdWJ+Ltrlr4G22392/ua18Y+F5Vb8uI9JhCerErMssssPmpbXxs9/wCRngLPDP34z92fuz9z+1/Vk/s2H3cffhhAeHJJkyYWFhZZZZZ5yyy/ix9WZdvz6v4tf4GPg+54y5YgR6SGni3UwjPoLYSe22wNxikIIX3f1cvcbO7+o/eD7bOLobsI7v2R9sqR4H67fxcY8PfgfDLq35YCTjPOYti39Xr4Z8Rd8L/gL5yyyyyyyyyyyR6v3L9LfvX7F+i/Sz9TfqY+1437Hifo8wH1eB+q/T5o+s+H55U1937L9l/Vn7gfcF92Pv4DL9K/bH3X7b99+8v3lnzT5j5T34PFZiaacn/LBHrb+y+O4MtZ5zeIMRuYuvIBIZ8zNLhsdSZvEvnS0n4vUMq2XM27Z842WHxe/JTP8HLILGx/F1zpAn6i/Xfr8B+MmE/RZ+r+JJ2X8+DNWvE+IfMT9/i/dfsv2T9s/f8ABJfveJ+y/b4tfdr7tfba+2fujwJ88s+J4Ga9pl2so6ns90X2WfINjg8LCygnCeZ8FkLPy3x4gkSfO2/HZjksteIJCCerW08nbPhXZf8ACB4ZP49Zk4/CztralXyGyZ+VnfG/ibp8Ms+Ab4J8CXw/B7zr8W675nGWOohPhidTbJseE0yHjvojmMvzYMs2Jjy/DPgdvg9TLsmflDfALIPi9/h648fwrk/pE/4O/idJ5XJfKr+Btfk3djmvFxmJ2N/+K/iLTxzSCBng2cg2keFh4SIDYOKIadRiaJOX5ZsKICxIZYWPyYzwux4PUv4sfgAzznjbfGyz+Hr8B8HyZj9eD8fM7c3b4T8mWST3JZJ+AqG5fikclw5Pu6JaEw5JB/G5/wBLOvMkRA0LIyxhMmRVkyScjwOMfT45n0SR7fGMJhx+sA9eNLS2dbq18bz8NNjbxHfhnPyxsfDPnxaT1a2ttv4+j45j4qZ8kT8Kw2yvjH6v0Tp4xei/av3b9iX1OwhtyscvV+u/RBa+GEnwCXwGwfEwut3f2zbzLhxLkOZ/4b/0R44t35BR229eDBHiScrp5OqRQUThOkSSPajHcFnhufjnl8pZY+DvwiXw1aggssss+D8Pa7eQfPafn0XVPjfBArH0SXrxk55DWYbwI3F5PSPUTGbzbtHjy/caQJdljuW/iKEQc5IMdLXCc234tCjkYOs6AFpxCfBay08dR9kRl6LB59wCGS5jKH8E8HkR8QzEWc8KwyMJ58X/AIb/ANvgtWytIiRCPUED2wzzlkI+U7sF1DLnd9bbe8ToIFq8N6DCdQvuFZ+pCJxPo+M+aT4xJbUefllnybbfiHDdnntBMfg6LkJ85IoN1GvqfEbEnHkmLZSlX3KMxCSxzl9zw5ZA+5Yv6XFeXxXFFtqdhAFfZaM+Pd/27/z3AIR2fTFr9Gxdv7uIYaX9SaR8JPxO/gyzxrfHe1t26r1td68H/l8BhwlI7s60sgot4XT4cyKPjPhm+2Ul7zCQwxq3O3bFBzfsT9HiLdxPq9KX6mX6p8QZep36YSXm+CRbb51j4vz1jd43x2gye/wvhcjJz5dQo+0Lmk8nMAOGzXYNhPiHviFJW8YL4U+mGP6Wljj8vkw5eOYfq6P92DvZA/YRv6Rj/K6vPsO/qEv5l0lxEaZHFjjmfAfKHwGPCR5SMY97qTZ7hf8Azy3+3jqrlGdSuoTXCwss+G5OhLimRgy4yUe7CBu4gbG92o8k5SUILzZvgh5wC4l3IOfBI+0JZ0WtwuLqHV2fGEn4X5ngb4f0SZ1Nzv4ei3j8Bzw5cjIqYXEu7LmV8c15WMFiMOfD1H9xCYfvpcw4/PTjnh3/AIs5T93NP1ILvEbHZHj9kWjPDFPTYeWwPQXrd/62sOh2w+D34DfA8hvh8GRqzlvCw54PEJ/qgxTsYGMlHHcmz4S3wBI2GEMEp4zaNhjoXOT8dwq1wuDQiOvGbjBJs6Stzm6vrxHkjdwuIO2nkh7lrLkol2x8Txn4zydroeBs5n8C5LlO3ku/gw9XvSQQg8z340cZvMPJdFxpBqIB8GAs8Fh92s9WcQ7fqed/tzMAl7fh6s540cF7hxH6Yn9C1XwHf9JByxgv/9k=" alt="Maqsood M D"
            style="width:110px;height:110px;border-radius:50%;object-fit:cover;object-position:top center;position:relative;z-index:1;display:block;" />
        </div>
        <!-- Name -->
        <div style="font-size:24px;font-weight:900;background:linear-gradient(135deg,#ffc850,#ff7832);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:4px;font-family:'Orbitron',sans-serif;">Maqsood M D</div>
        <div style="font-size:13px;color:rgba(139,168,204,0.8);margin-bottom:20px;font-weight:500;">Founder & Developer</div>
        <!-- Divider -->
        <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,200,80,0.3),transparent);margin:0 0 20px;"></div>
        <!-- Bio -->
        <div style="font-size:13px;color:rgba(200,220,240,0.85);line-height:1.7;text-align:center;padding:0 8px;">
          Passionate technologist & educator who built <strong style="color:#ffc850;">Tech Book</strong> to make learning accessible, interactive, and fun for every student. 🚀
        </div>
        <!-- Tags -->
        <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:18px;">
          <span style="padding:6px 14px;border-radius:20px;background:#eff2fe;border:1.5px solid #c7d2fe;color:#3d5af1;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:5px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/></svg> Developer</span>
          <span style="padding:6px 14px;border-radius:20px;background:rgba(168,85,247,0.1);border:1.5px solid rgba(168,85,247,0.3);color:#a855f7;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:5px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> Educator</span>
          <span style="padding:6px 14px;border-radius:20px;background:rgba(255,200,80,0.1);border:1.5px solid rgba(255,200,80,0.4);color:#d97706;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:5px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Innovator</span>
        </div>
        <!-- Social Links -->
        <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-top:18px;">
          <a href="https://github.com/Maqsood02" target="_blank" rel="noopener noreferrer" title="GitHub" style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#111827;border:1.5px solid #374151;transition:all 0.2s;text-decoration:none;" onmouseover="this.style.background='#3d5af1';this.style.borderColor='#3d5af1';this.style.transform='translateY(-2px)'" onmouseout="this.style.background='#111827';this.style.borderColor='#374151';this.style.transform=''">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
          </a>
          <a href="https://www.linkedin.com/in/maqsood-md-24b05b296?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app" target="_blank" rel="noopener noreferrer" title="LinkedIn" style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#0077b5;border:1.5px solid #0069a0;transition:all 0.2s;text-decoration:none;" onmouseover="this.style.background='#3d5af1';this.style.borderColor='#3d5af1';this.style.transform='translateY(-2px)'" onmouseout="this.style.background='#0077b5';this.style.borderColor='#0069a0';this.style.transform=''">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a>
        </div>
      </div>
    </div>
  </div>
  <style>@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }<\/style>


  <!-- ══ COMING SOON MODAL ══ -->
  <div id="coming-soon-modal" style="display:none;position:fixed;inset:0;z-index:99999;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);" onclick="if(event.target===this)this.style.display='none'">
    <div style="background:linear-gradient(145deg,#ffffff,#f8f9ff);border:1px solid rgba(168,85,247,0.35);border-radius:26px;max-width:340px;width:100%;overflow:hidden;box-shadow:0 0 60px rgba(168,85,247,0.2),0 40px 80px #e5e7eb;position:relative;text-align:center;">
      <div style="height:3px;background:linear-gradient(90deg,#a855f7,#818cf8,#3d5af1);"></div>
      <button onclick="document.getElementById('coming-soon-modal').style.display='none'" style="position:absolute;top:12px;right:14px;background:#ffffff;border:1px solid rgba(0,0,0,0.03);border-radius:50%;width:30px;height:30px;color:#1a1a2e;font-size:15px;cursor:pointer;">✕</button>
      <div style="padding:32px 28px 30px;">
        <!-- Animated rocket -->
        <div style="font-size:56px;margin-bottom:16px;animation:rocketBounce 1.5s ease-in-out infinite;">🚀</div>
        <div id="cs-title" style="font-size:20px;font-weight:900;background:linear-gradient(135deg,#a855f7,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:10px;font-family:'Orbitron',sans-serif;"></div>
        <div style="font-size:13px;font-weight:800;color:#c084fc;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;">Coming Soon</div>
        <div id="cs-desc" style="font-size:13px;color:rgba(180,200,230,0.8);line-height:1.7;margin-bottom:22px;"></div>
        <!-- Progress bar -->
        <div style="background:#f7f8fc;border-radius:20px;height:6px;overflow:hidden;margin-bottom:8px;">
          <div style="height:100%;width:35%;background:linear-gradient(90deg,#a855f7,#818cf8);border-radius:20px;animation:progressPulse 2s ease-in-out infinite;"></div>
        </div>
        <div style="font-size:11px;color:rgba(139,168,204,0.5);margin-bottom:22px;">In Development — 35%</div>
        <button onclick="document.getElementById('coming-soon-modal').style.display='none'" style="padding:12px 32px;background:linear-gradient(135deg,#a855f7,#818cf8);border:none;border-radius:14px;color:#1a1a2e;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 4px 20px rgba(168,85,247,0.4);">Got it! 👍</button>
      </div>
    </div>
  </div>
  <style>
    @keyframes rocketBounce { 0%,100%{transform:translateY(0) rotate(-5deg)} 50%{transform:translateY(-10px) rotate(5deg)} }
    @keyframes progressPulse { 0%,100%{width:30%;opacity:0.8} 50%{width:45%;opacity:1} }
  <\/style>


  <!-- Global function bridge – exposes module-scoped fns to onclick="" -->
  <script>
    // These are set by the ES-module below; we expose them globally here
    // so that onclick="" attributes (which run in global scope) can call them.
    function openHelpCenter(){ window.openHelpCenter && window.openHelpCenter(); }
    function closeHelpCenter(){ window.closeHelpCenter && window.closeHelpCenter(); }
    function sendHelpMessage(){ window.sendHelpMessage && window.sendHelpMessage(); }
    function toggleVoiceMode(){ var btn=document.getElementById('hc-mic-btn'); if(btn && btn.classList.contains('mic-on')){ window._hcVoiceStop&&window._hcVoiceStop(); }else{ window._hcVoiceStart&&window._hcVoiceStart(); } }
    function stopVoiceMode(){ window._hcVoiceStop && window._hcVoiceStop(); }
    function showLandingPage(){ window.showLandingPage && window.showLandingPage(); }
    function studentLogout(){ window.studentLogout && window.studentLogout(); }
    function switchStudentTab(t){ window.switchStudentTab && window.switchStudentTab(t); }
    // PDF note/pyq view bridge — uses _impl_ aliases to avoid recursion
    function admViewNote(id,title){ var f=window._impl_admViewNote; f&&f(id,title); }
    function admDeleteNote(id,title){ var f=window._impl_admDeleteNote; f&&f(id,title); }
    function admDeleteGroupNote(ids,title){ var f=window._impl_admDeleteGroupNote; f&&f(ids,title); }
    function admBackToSubjects(){ var f=window._impl_admBackToSubjects; f&&f(); }
    function pyqAdmView(id){ var f=window._impl_pyqAdmView; f&&f(id); }
    function pyqAdmBackToSubjects(){ var f=window._impl_pyqAdmBackToSubjects; f&&f(); }
    function studentViewNote(id,fn){ var f=window._impl_studentViewNote; f&&f(id,fn); }
    function studentDownloadNote(id,fn){ var f=window._impl_studentDownloadNote; f&&f(id,fn); }
    function pyqStudentView(id,fn){ var f=window._impl_pyqStudentView; f&&f(id,fn); }
    function pyqStudentDownload(id,fn){ var f=window._impl_pyqStudentDownload; f&&f(id,fn); }
    // PDF Viewer Modal controller
    window._currentPdfBlobUrl = null;
    var _isMobile2 = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    window._openPdfViewer = function(url, fileName) {
      window._currentPdfBlobUrl = url;
      if(_isMobile2) {
        var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function(){ URL.revokeObjectURL(url); window._currentPdfBlobUrl=null; }, 10000);
        return;
      }
      var t=document.getElementById('pdf-viewer-title'); if(t) t.textContent = fileName || 'PDF Viewer';
      var f=document.getElementById('pdf-viewer-frame'); if(f) f.src = url;
      var m = document.getElementById('pdf-viewer-modal');
      if(m) m.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    };
    window._closePdfViewer = function() {
      var m = document.getElementById('pdf-viewer-modal');
      if(m) m.style.display = 'none';
      var f=document.getElementById('pdf-viewer-frame'); if(f) f.src = '';
      document.body.style.overflow = '';
      if(window._currentPdfBlobUrl){ URL.revokeObjectURL(window._currentPdfBlobUrl); window._currentPdfBlobUrl=null; }
    };
    window._pdfViewerDownload = function() {
      if(!window._currentPdfBlobUrl) return;
      var a = document.createElement('a');
      a.href = window._currentPdfBlobUrl;
      var t=document.getElementById('pdf-viewer-title');
      a.download = t ? t.textContent : 'download.pdf';
      a.click();
    };
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') window._closePdfViewer(); });
  <\/script>

  <!-- ══ PDF Viewer Modal ══ -->
  <div id="pdf-viewer-modal" style="display:none;position:fixed;inset:0;z-index:100000;background:#000;flex-direction:column;">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#1a1a2e;color:#fff;flex-shrink:0;">
      <span id="pdf-viewer-title" style="font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60vw;"></span>
      <div style="display:flex;gap:10px;">
        <button onclick="window._pdfViewerDownload()" style="padding:6px 14px;background:#4f8ef7;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">&#11015; Download<\/button>
        <button onclick="window._closePdfViewer()" style="padding:6px 14px;background:#e74c3c;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">&#10005; Close<\/button>
      <\/div>
    <\/div>
    <iframe id="pdf-viewer-frame" src="" style="flex:1;width:100%;border:none;background:#525659;"><\/iframe>
  <\/div>

<\/body>
<\/html>`;

      // Open in hidden iframe and trigger print (browser saves as PDF with Ctrl+P / print dialog)
      // Most modern browsers will show "Save as PDF" option in the print dialog
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      // Open popup sized to A4 with auto-print triggered
      const pdfWin = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
      if (pdfWin) {
        pdfWin.document.open();
        pdfWin.document.write(html);
        pdfWin.document.close();
        // Inject auto-print script after load
        pdfWin.document.title = 'leaderboard_' + quizLabel.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_' + new Date().toISOString().slice(0, 10);
        setTimeout(() => {
          try {
            pdfWin.focus();
            pdfWin.print();
          } catch (e) { }
        }, 600);
      }
      setTimeout(() => URL.revokeObjectURL(url), 8000);
    };

