import { auth, db } from '../core/firebase.js';
import { doc, setDoc, getDoc, addDoc, collection, query, where, getDocs, orderBy, deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { $, val, esc, PdfDbCache, jsEsc, readFileBase64, getStudentProfile, API_BASE_URL } from '../core/helpers.js';

const CHUNK_SIZE = 700 * 1024;
let lastPyqFetchTime = 0;

    // ─── ADMIN: Load All PYQs ───
    window._pyqAdmAllPapers = [];
    window._pyqActiveFilterSem = 'all';

    window.pyqAdmLoadAll = async function () {
      const listEl = document.getElementById('pyq-adm-list');
      if (!listEl) return;
      listEl.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:16px;">\u23f3 Loading\u2026</p>';
      try {
        const snap = await getDocs(query(collection(db, 'pyq_papers'), orderBy('uploadedAt', 'desc')));
        const papers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        window._pyqAdmAllPapers = papers;
        pyqAdmApplyFilter();
      } catch (e) {
        listEl.innerHTML = '<p style="color:#f87171;font-size:13px;text-align:center;padding:16px;">\u274c ' + e.message + '</p>';
      }
    };

    window.filterPyqBySemester = (sem) => {
      window._pyqActiveFilterSem = sem;
      document.querySelectorAll('.pyq-filter-btn').forEach(btn => {
        if (btn.getAttribute('data-sem') === sem) {
          btn.style.background = 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)';
          btn.style.color = 'white';
          btn.style.border = 'none';
          btn.style.boxShadow = '0 2px 8px rgba(217,119,6,0.2)';
          btn.classList.add('pyq-active-filter');
        } else {
          btn.style.background = '#ffffff';
          btn.style.color = '#d97706';
          btn.style.border = '1.5px solid #fde68a';
          btn.style.boxShadow = 'none';
          btn.classList.remove('pyq-active-filter');
        }
      });
      pyqAdmApplyFilter();
    };

    function pyqAdmApplyFilter() {
      const sem = window._pyqActiveFilterSem;
      const papers = window._pyqAdmAllPapers || [];
      const filtered = sem === 'all' ? papers : papers.filter(p => String(p.sem) === String(sem));
      pyqAdmRenderSubjectGrid(filtered);
    }

    const pyqColors = [
      { bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '#fde68a', text: '#d97706', glow: 'rgba(217,119,6,0.15)', icon: '📜' },
      { bg: 'linear-gradient(135deg,#fff1f2,#ffe4e6)', border: '#fca5a5', text: '#dc2626', glow: 'rgba(220,38,38,0.15)', icon: '📋' },
      { bg: 'linear-gradient(135deg,#f0fdfa,#ccfbf1)', border: '#6ee7b7', text: '#059669', glow: 'rgba(5,150,105,0.15)', icon: '📝' },
      { bg: 'linear-gradient(135deg,#fdf4ff,#f3e8ff)', border: '#d8b4fe', text: '#9333ea', glow: 'rgba(147,51,234,0.15)', icon: '🗒️' },
      { bg: 'linear-gradient(135deg,#fff7ed,#ffedd5)', border: '#fdba74', text: '#ea580c', glow: 'rgba(234,88,12,0.15)', icon: '📃' },
      { bg: 'linear-gradient(135deg,#eff2fe,#e8ebfd)', border: '#c7d0fb', text: '#3d5af1', glow: 'rgba(61,90,241,0.15)', icon: '📄' },
      { bg: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', border: '#7dd3fc', text: '#0284c7', glow: 'rgba(2,132,199,0.15)', icon: '🗃️' },
      { bg: 'linear-gradient(135deg,#fdf2f8,#fce7f3)', border: '#f9a8d4', text: '#db2777', glow: 'rgba(219,39,119,0.15)', icon: '📑' },
    ];

    function pyqAdmRenderSubjectGrid(papers) {
      const list = document.getElementById('pyq-adm-list');
      if (!list) return;
      if (!papers.length) {
        list.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">No PYQ papers uploaded yet.</p>';
        return;
      }
      const grouped = {};
      papers.forEach(n => { const s = n.subject || 'General'; if (!grouped[s]) grouped[s] = []; grouped[s].push(n); });
      const subjects = Object.keys(grouped).sort();
      let html = '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:12px;">\ud83d\udcc2 ' + subjects.length + ' subject' + (subjects.length > 1 ? 's' : '') + ' \u00b7 \ud83d\udcdc ' + papers.length + ' paper' + (papers.length > 1 ? 's' : '') + '</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
      subjects.forEach((subj, si) => {
        const col = pyqColors[si % pyqColors.length];
        const cnt = grouped[subj].length;
        html += '<button onclick="pyqAdmOpenSubject(\'' + subj.replace(/'/g, "\\'") + '\',' + si + ')" style="text-align:left;background:' + col.bg + ';border:1.5px solid ' + col.border + ';border-radius:12px;padding:12px;cursor:pointer;position:relative;overflow:hidden;transition:box-shadow 0.2s;display:flex;align-items:center;gap:10px;" onmouseover="this.style.boxShadow=\'0 0 12px ' + col.glow + '\'" onmouseout="this.style.boxShadow=\'\'">' +
          '<div style="font-size:22px;flex-shrink:0;">' + col.icon + '</div>' +
          '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:800;color:' + col.text + ';line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(subj) + '</div>' +
          '<div style="font-size:10px;color:var(--text-secondary);margin-top:2px;">' + cnt + ' paper' + (cnt > 1 ? 's' : '') + '</div></div>' +
          '<div style="font-size:12px;opacity:0.4;color:' + col.text + ';flex-shrink:0;">\u2192</div></button>';
      });
      html += '</div>';
      list.innerHTML = html;
    }

    window.pyqAdmOpenSubject = (subj, colorIdx) => {
      const papers = (window._pyqAdmAllPapers || []).filter(n => (n.subject || 'General') === subj);
      const col = pyqColors[colorIdx % pyqColors.length];
      document.getElementById('pyq-adm-screen-subjects').style.display = 'none';
      document.getElementById('pyq-adm-screen-detail').style.display = '';
      const titleEl = document.getElementById('pyq-adm-detail-title');
      titleEl.innerHTML = '<span style="color:' + col.text + ';">' + col.icon + ' ' + esc(subj) + '</span> <span style="font-size:12px;color:var(--text-secondary);font-weight:400;">(' + papers.length + ' paper' + (papers.length > 1 ? 's' : '') + ')</span>';
      const detailList = document.getElementById('pyq-adm-detail-list');

      const nowMs = Date.now();
      const thresholdMs = 3 * 24 * 60 * 60 * 1000;
      const latest = [], earlier = [];
      papers.forEach(n => {
        if (n.uploadedAt && (nowMs - n.uploadedAt.seconds * 1000) < thresholdMs) latest.push(n);
        else earlier.push(n);
      });

      const renderPyqCard = (n) =>
        '<div style="display:flex;align-items:center;gap:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px 14px;margin-bottom:8px;flex-wrap:wrap;border-left:3px solid ' + col.text + ';">' +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:5px;">' + esc(n.title) + '</div>' +
        '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;">Year ' + esc(n.year) + ' \u00b7 Sem ' + esc(n.sem) + (n.examYear ? ' \u00b7 Exam Year: ' + esc(n.examYear) : '') + (n.fileSize ? ' \u00b7 ' + (n.fileSize / 1024).toFixed(0) + ' KB' : '') + '</div>' +
        '<span style="padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;background:' + col.bg + ';border:1px solid ' + col.border + ';color:' + col.text + ';">' + ((n.section || 'all') === 'all' ? 'All Sections' : 'Section ' + n.section) + '</span></div>' +
        '<div style="display:flex;gap:6px;flex-shrink:0;">' +
        '<button onclick="pyqAdmView(\'' + n.id + '\')" id="pyq-view-adm-' + n.id + '" style="padding:7px 12px;background:' + col.bg + ';border:1.5px solid ' + col.border + ';border-radius:9px;color:' + col.text + ';font-weight:700;font-size:12px;cursor:pointer;">\ud83d\udc41\ufe0f View</button>' +
        '<button onclick="pyqAdmEditTitle(\'' + n.id + '\',\'' + n.title.replace(/'/g, "\\'") + '\',' + colorIdx + ')" style="padding:7px 12px;background:' + col.bg + ';border:1.5px solid ' + col.border + ';border-radius:9px;color:' + col.text + ';font-weight:700;font-size:12px;cursor:pointer;">✏️ Edit</button>' +
        '<button onclick="pyqAdmDelete(\'' + n.id + '\')" style="padding:7px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:9px;color:#f87171;font-weight:700;font-size:12px;cursor:pointer;">\ud83d\uddd1\ufe0f Delete</button>' +
        '</div></div>';

      let html = '';
      if (latest.length > 0) {
        html += '<div style="font-size:12px;font-weight:800;color:' + col.text + ';margin:5px 0 12px;display:flex;align-items:center;gap:6px;text-transform:uppercase;letter-spacing:0.5px;">✨ Latest Uploads <span style="background:' + col.bg + ';padding:1px 8px;border-radius:10px;font-size:10px;border:1px solid ' + col.border + ';color:' + col.text + ';">' + latest.length + '</span></div>';
        html += latest.map(renderPyqCard).join('');
        if (earlier.length > 0) {
          html += '<div style="font-size:12px;font-weight:800;color:var(--text-secondary);margin:24px 0 12px;text-transform:uppercase;letter-spacing:0.5px;opacity:0.6;">Recent Uploads</div>';
        }
      }
      html += earlier.map(renderPyqCard).join('');
      detailList.innerHTML = html || '<p style="text-align:center;padding:20px;color:var(--text-secondary);">No PYQ papers available for this selection.</p>';
    };

    window.pyqAdmEditTitle = async (id, currentTitle, colorIdx) => {
      const newTitle = prompt("Edit PYQ Title:", currentTitle);
      if (newTitle === null) return;
      const trimmed = newTitle.trim();
      if (!trimmed) return alert("Title cannot be empty!");
      try {
        const docRef = doc(db, 'pyq_papers', id);
        await setDoc(docRef, { title: trimmed }, { merge: true });
        if (window._pyqAdmAllPapers) {
          const idx = window._pyqAdmAllPapers.findIndex(n => n.id === id);
          if (idx !== -1) window._pyqAdmAllPapers[idx].title = trimmed;
        }
        alert("✓ Title updated successfully!");
        const paper = window._pyqAdmAllPapers ? window._pyqAdmAllPapers.find(n => n.id === id) : null;
        if (paper) {
          window.pyqAdmOpenSubject(paper.subject || 'General', colorIdx);
        }
      } catch (err) {
        alert("Error updating title: " + err.message);
      }
    };

    window.pyqAdmBackToSubjects = () => {
      document.getElementById('pyq-adm-screen-detail').style.display = 'none';
      document.getElementById('pyq-adm-screen-subjects').style.display = '';
    };

    window.pyqAdmView = async function (id) {
      const btn = document.getElementById('pyq-view-adm-' + id);
      const orig = btn ? btn.innerHTML : '';
      if (btn) { btn.innerHTML = '\u23f3\u2026'; btn.disabled = true; }
      try {
        const blob = await fetchPyqBlob(id);
        const url = URL.createObjectURL(blob);
        window._openPdfViewer(url, 'PYQ – ' + id);
      } catch (e) { alert('Error: ' + e.message); }
      finally { if (btn) { btn.innerHTML = orig; btn.disabled = false; } }
    };

    window.pyqAdmDelete = async function (id) {
      if (!confirm('Delete this PYQ paper? This cannot be undone.')) return;
      try {
        const chunksSnap = await getDocs(collection(db, 'pyq_papers', id, 'chunks'));
        if (!chunksSnap.empty) {
          const b = writeBatch(db);
          chunksSnap.forEach(d => b.delete(d.ref));
          await b.commit();
        }
        await deleteDoc(doc(db, 'pyq_papers', id));
        document.getElementById('pyq-adm-screen-detail').style.display = 'none';
        document.getElementById('pyq-adm-screen-subjects').style.display = '';
        pyqAdmLoadAll();
      } catch (e) { alert('Error deleting: ' + e.message); }
    };

    // ─── STUDENT: Load PYQs ───
    let allStudentPYQ = [];


    // ── IA Timetable: Student load (section-wise) ──
    window.loadIATimetable = async function () {
      const display = document.getElementById('ia-timetable-display');
      if (!display) return;
      display.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:28px;margin-bottom:8px;">⏳</div><div style="color:#9ca3af;font-size:13px;">Loading timetable…</div></div>';
      try {
        // Try to load student's own section timetable first
        const studentYear = window._currentStudentYear || '';
        const studentSem = window._currentStudentSem || '';
        const studentSec = window._currentStudentSection || '';
        const key = studentYear && studentSem && studentSec
          ? `ia_timetable_Y${studentYear}_S${studentSem}_${studentSec}`
          : 'ia_timetable';
        const sharedKey = studentYear && studentSem
          ? `ia_timetable_Y${studentYear}_S${studentSem}_AB`
          : null;

        let snap = await getDoc(doc(db, 'settings', key));
        // Fallback to A&B shared doc
        if ((!snap.exists() || !snap.data().imageBase64) && sharedKey) {
          snap = await getDoc(doc(db, 'settings', sharedKey));
        }
        // Fallback to generic key
        if ((!snap.exists() || !snap.data().imageBase64) && key !== 'ia_timetable') {
          snap = await getDoc(doc(db, 'settings', 'ia_timetable'));
        }

        if (snap.exists() && snap.data().imageBase64) {
          const d = snap.data();
          const label = d.section ? `Year ${d.year} · Sem ${d.sem} · Section ${d.section}` : 'General';
          display.innerHTML = `
            <div style="border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 2px 12px rgba(0,0,0,0.07);">
              <div style="background:#f7f8fc;padding:10px 14px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:12px;font-weight:700;color:#6b7280;">📌 ${label} · Uploaded: ${d.uploadedAt ? new Date(d.uploadedAt.seconds * 1000).toLocaleDateString('en-IN') : 'Recently'}</span>
                <a href="${d.imageBase64}" download="IA_Timetable.png" style="font-size:11px;font-weight:700;color:#3d5af1;text-decoration:none;background:#eff2fe;padding:4px 10px;border-radius:20px;border:1px solid #c7d2fe;">⬇️ Download</a>
              </div>
              <img src="${d.imageBase64}" style="width:100%;display:block;" alt="IA Timetable"/>
            </div>`;
        } else {
          display.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af;"><div style="font-size:48px;margin-bottom:12px;">🗓️</div><div style="font-weight:700;font-size:15px;color:#6b7280;">No timetable uploaded yet</div><div style="font-size:12px;margin-top:6px;">Your admin will upload the IA timetable here</div></div>';
        }
      } catch (e) {
        display.innerHTML = '<div style="text-align:center;padding:30px;color:#f87171;">Error loading timetable. Check connection.</div>';
      }
    };

    // ── IA Timetable: Admin upload (section-wise) ──

    window.adminLoadIATimetablePreview = async function () {
      const display = document.getElementById('ia-tt-current-display');
      if (!display) return;
      display.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;font-size:13px;">⏳ Loading all uploaded timetables…</div>';
      try {
        // List all ia_timetable documents from settings
        const { getDocs, collection: col, query: q2, where } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
        const settingsSnap = await getDocs(col(db, 'settings'));
        const timetables = [];
        settingsSnap.forEach(docSnap => {
          if (docSnap.id.startsWith('ia_timetable') && docSnap.data().imageBase64) {
            timetables.push({ id: docSnap.id, ...docSnap.data() });
          }
        });

        if (timetables.length === 0) {
          display.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;font-size:13px;">No timetables uploaded yet</div>';
          return;
        }

        let html = `<div style="display:grid;gap:12px;">`;
        timetables.forEach(d => {
          const label = d.section ? `Year ${d.year} · Sem ${d.sem} · Section ${d.section}` : 'General Timetable';
          const dateStr = d.uploadedAt ? new Date(d.uploadedAt.seconds * 1000).toLocaleDateString('en-IN') : 'Recently';
          html += `
            <div style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
              <div style="background:#f7f8fc;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
                <span style="font-size:12px;font-weight:700;color:#7c3aed;">📌 ${label}</span>
                <span style="font-size:11px;color:#6b7280;">Uploaded: ${dateStr}</span>
              </div>
              <img src="${d.imageBase64}" style="width:100%;display:block;" alt="Timetable"/>
            </div>`;
        });
        html += `</div>`;
        display.innerHTML = html;
      } catch (e) {
        display.innerHTML = '<div style="color:#f87171;font-size:13px;">Error loading. Try again.</div>';
      }
    };

    window.adminDeleteIATimetable = async function () {
      const year = document.getElementById('ia-tt-year')?.value;
      const sem = document.getElementById('ia-tt-sem')?.value;
      const secs = getIASelectedSections();
      const msgEl = document.getElementById('ia-tt-msg');

      if (!year || !sem || !secs.length) {
        if (msgEl) msgEl.innerHTML = '<span style="color:#f87171;">⚠️ Please select Year, Semester and at least one Section to remove.</span>';
        return;
      }
      if (!confirm(`Remove timetable for Year ${year}, Sem ${sem}, Section(s) ${secs.join(', ')}?`)) return;
      try {
        for (const sec of secs) {
          const key = `ia_timetable_Y${year}_S${sem}_${sec}`;
          await setDoc(doc(db, 'settings', key), { imageBase64: null, deletedAt: serverTimestamp() });
        }
        if (msgEl) msgEl.innerHTML = `<span style="color:#10b981;">✅ Removed Sec ${secs.join(', ')}.</span>`;
        adminLoadIATimetablePreview();
      } catch (e) {
        if (msgEl) msgEl.innerHTML = `<span style="color:#f87171;">Error: ${e.message}</span>`;
      }
    };

    window.adminUploadIATimetable = async function () {
      const fileInput = document.getElementById('ia-tt-file');
      const msgEl = document.getElementById('ia-tt-msg');
      const btn = document.getElementById('ia-tt-btn');
      const year = document.getElementById('ia-tt-year')?.value;
      const sem = document.getElementById('ia-tt-sem')?.value;
      const secs = getIASelectedSections();

      if (!year || !sem || !secs.length) {
        if (msgEl) msgEl.innerHTML = '<span style="color:#f87171;">⚠️ Please select Year, Semester and at least one Section first.</span>';
        return;
      }
      if (!fileInput || !fileInput.files[0]) {
        if (msgEl) msgEl.innerHTML = '<span style="color:#f87171;">⚠️ Please select an image first.</span>';
        return;
      }
      const file = fileInput.files[0];
      if (file.size > 20 * 1024 * 1024) {
        if (msgEl) msgEl.innerHTML = '<span style="color:#f87171;">Image too large. Max 20MB.</span>';
        return;
      }
      if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const img = new Image();
          img.onload = async function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDim = 1200;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

            for (const sec of secs) {
              const key = `ia_timetable_Y${year}_S${sem}_${sec}`;
              await setDoc(doc(db, 'settings', key), {
                imageBase64: compressedBase64,
                year, sem, section: sec,
                uploadedAt: serverTimestamp(),
                uploadedBy: window._currentAdminId || 'admin'
              });
            }
            if (msgEl) msgEl.innerHTML = `<span style="color:#10b981;">✅ Uploaded for Year ${year} · Sem ${sem} · Section(s) ${secs.join(', ')}!</span>`;
            if (btn) { btn.disabled = false; btn.textContent = '📤 Upload Timetable'; }
            const preview = document.getElementById('ia-tt-preview');
            if (preview) { preview.src = compressedBase64; preview.style.display = 'block'; }
            adminLoadIATimetablePreview();
          };
          img.onerror = () => { throw new Error("Invalid image file"); };
          img.src = e.target.result;
        } catch (err) {
          if (msgEl) msgEl.innerHTML = `<span style="color:#f87171;">Error: ${err.message}</span>`;
          if (btn) { btn.disabled = false; btn.textContent = '📤 Upload Timetable'; }
        }
      };
      reader.readAsDataURL(file);
    };

    window.studentLoadPYQ = async function () {
      const grid = document.getElementById('pyq-subject-grid');
      if (!grid) return;
      
      const hasCache = allStudentPYQ && allStudentPYQ.length > 0;

      const now = Date.now();
      if (hasCache && (now - lastPyqFetchTime < 60000)) {
        studentFilterPYQ();
        return;
      }

      if (!hasCache) {
        grid.innerHTML = '<div style="text-align:center;padding:40px 20px;"><div style="font-size:42px;margin-bottom:10px;">⏳</div><div style="color:var(--text-secondary);font-size:14px;">Loading…</div></div>';
      } else {
        studentFilterPYQ();
      }
      
      try {
        const snap = await getDocs(query(collection(db, 'pyq_papers'), orderBy('uploadedAt', 'desc')));
        const newPapers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const changed = JSON.stringify(allStudentPYQ) !== JSON.stringify(newPapers);
        if (changed || !hasCache) {
          allStudentPYQ = newPapers;
          studentFilterPYQ();
        }
        lastPyqFetchTime = now;
      } catch (e) {
        if (!hasCache) {
          grid.innerHTML = '<p style="color:#f87171;text-align:center;padding:20px;">❌ ' + e.message + '</p>';
        }
      }
    };

    window.studentFilterPYQ = function () {
      const yearFilter = String(document.getElementById('pyq-year')?.value || '').trim();
      const semFilter = String(document.getElementById('pyq-sem')?.value || '').trim();
      const secFilter = String(document.getElementById('pyq-sec')?.value || '').trim().toLowerCase();
      renderPYQSubjectGrid(allStudentPYQ.filter(n => {
        const paperYear = String(n.year || '').trim();
        const paperSem = String(n.sem || '').trim();
        const paperSec = String(n.section || 'all').toLowerCase().trim();
        if (yearFilter && paperYear !== yearFilter) return false;
        if (semFilter && paperSem !== semFilter) return false;
        if (paperSec === 'all') return true;
        if (!secFilter) return true;
        return paperSec.split(',').map(s => s.trim()).includes(secFilter);
      }));
    };

    window.studentClearPYQFilters = function () {
      ['pyq-year', 'pyq-sem', 'pyq-sec'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      renderPYQSubjectGrid(allStudentPYQ);
    };

    function renderPYQSubjectGrid(papers) {
      const grid = document.getElementById('pyq-subject-grid');
      if (!grid) return;
      if (!papers.length) {
        grid.innerHTML = '<div style="text-align:center;padding:40px 20px;"><div style="font-size:42px;margin-bottom:10px;">📢</div><div style="color:var(--text-secondary);font-size:14px;">No question papers found.</div></div>';
        return;
      }
      const grouped = {};
      papers.forEach(n => { const s = n.subject || 'General'; if (!grouped[s]) grouped[s] = []; grouped[s].push(n); });
      const subjects = Object.keys(grouped).sort();
      window._pyqSubjectList = subjects; // store for index-based onclick
      let html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">';
      subjects.forEach((subj, si) => {
        const col = pyqColors[si % pyqColors.length];
        const cnt = grouped[subj].length;
        html += '<button onclick="pyqOpenSubjectByIdx(' + si + ')" ' +
          'style="text-align:center;background:' + col.bg + ';border:1.5px solid ' + col.border + ';' +
          'border-radius:14px;padding:10px 6px 9px;cursor:pointer;transition:all 0.22s;' +
          'box-shadow:0 1px 4px ' + col.glow + ';" ' +
          'onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 8px 20px ' + col.glow + '\'" ' +
          'onmouseout="this.style.transform=\'\';this.style.boxShadow=\'0 1px 4px ' + col.glow + '\'">' +
          '<div style="font-size:20px;margin-bottom:5px;">' + col.icon + '</div>' +
          '<div style="font-size:9.5px;font-weight:800;color:' + col.text + ';line-height:1.3;margin-bottom:4px;' +
          'overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word;">' + esc(subj) + '</div>' +
          '<div style="display:inline-flex;align-items:center;background:rgba(0,0,0,0.06);border-radius:20px;padding:1px 7px;">' +
          '<span style="font-size:8px;font-weight:700;color:' + col.text + ';">' + cnt + ' paper' + (cnt > 1 ? 's' : '') + '</span></div></button>';
      });
      html += '</div>';
      grid.innerHTML = html;
    }

    window.pyqOpenSubjectByIdx = (idx) => {
      const subj = window._pyqSubjectList[idx];
      if (subj !== undefined) pyqOpenSubject(subj, idx);
    };


    window.pyqOpenSubject = (subj, colorIdx) => {
      const col = pyqColors[colorIdx % pyqColors.length];
      const year = document.getElementById('pyq-year')?.value || '';
      const sem = document.getElementById('pyq-sem')?.value || '';
      const sec = document.getElementById('pyq-sec')?.value || '';
      const papers = allStudentPYQ.filter(n => {
        if ((n.subject || 'General') !== subj) return false;
        const paperYear = String(n.year || '').trim();
        const paperSem = String(n.sem || '').trim();
        const paperSec = String(n.section || 'all').toLowerCase().trim();
        if (year && paperYear !== year) return false;
        if (sem && paperSem !== sem) return false;
        if (paperSec === 'all') return true;
        if (!sec) return true;
        return paperSec.split(',').map(s => s.trim()).includes(sec.toLowerCase().trim());
      });

      document.getElementById('pyq-screen-subjects').style.display = 'none';
      document.getElementById('pyq-screen-detail').style.display = '';
      const titleEl = document.getElementById('pyq-detail-title');
      titleEl.textContent = col.icon + ' ' + subj;
      titleEl.style.color = col.text;
      document.getElementById('pyq-detail-sub').textContent = papers.length + ' paper' + (papers.length > 1 ? 's' : '') + ' available';

      const nowMs = Date.now();
      const thresholdMs = 3 * 24 * 60 * 60 * 1000;
      const latest = [], earlier = [];
      papers.forEach(n => {
        if (n.uploadedAt && (nowMs - n.uploadedAt.seconds * 1000) < thresholdMs) latest.push(n);
        else earlier.push(n);
      });

      const renderPyqCard = (n) =>
        '<div style="background:rgba(255,255,255,0.7);border:1.5px solid ' + col.border + ';border-radius:14px;padding:16px;margin-bottom:12px;position:relative;overflow:hidden;">' +
        '<div style="position:absolute;top:0;left:0;width:4px;height:100%;background:' + col.text + ';border-radius:4px 0 0 4px;opacity:0.8;"></div>' +
        '<div style="padding-left:12px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' +
        '<div style="font-size:15px;font-weight:800;color:var(--text-primary);">' + esc(n.title) + '</div>' +
        (n.uploadedAt ? '<div style="font-size:10px;color:rgba(139,168,204,0.4);white-space:nowrap;">\ud83d\udd50 ' + new Date(n.uploadedAt.seconds * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px;">' +
        '<span style="padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;background:' + col.bg + ';border:1px solid ' + col.border + ';color:' + col.text + ';">Year ' + esc(n.year) + '</span>' +
        '<span style="padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;background:' + col.bg + ';border:1px solid ' + col.border + ';color:' + col.text + ';">Sem ' + esc(n.sem) + '</span>' +
        (n.examYear ? '<span style="padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;background:#fffbeb;border:1px solid #fde68a;color:#92400e;">\ud83d\udcc5 ' + esc(n.examYear) + '</span>' : '') +
        '<span style="padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;background:#f7f8fc;border:1px solid rgba(0,0,0,0.03);color:var(--text-secondary);">' + ((n.section || 'all') === 'all' ? 'All Sections' : n.section.split(',').map(s => 'Sec ' + s.trim()).join(' & ')) + '</span>' +
        (n.fileSize ? '<span style="padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;background:#f7f8fc;border:1px solid rgba(0,0,0,0.03);color:var(--text-secondary);">' + (n.fileSize / 1024).toFixed(1) + ' KB</span>' : '') +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button onclick="pyqStudentView(\'' + n.id + '\',\'' + jsEsc(n.fileName || 'pyq.pdf') + '\')" id="pyq-view-btn-' + n.id + '" style="display:inline-flex;align-items:center;gap:6px;padding:9px 18px;background:' + col.bg + ';border:1.5px solid ' + col.border + ';border-radius:10px;color:' + col.text + ';font-weight:700;font-size:13px;cursor:pointer;">\ud83d\udc41\ufe0f View PDF</button>' +
        '<button onclick="pyqStudentDownload(\'' + n.id + '\',\'' + jsEsc(n.fileName || 'pyq.pdf') + '\')" id="pyq-dl-btn-' + n.id + '" style="display:inline-flex;align-items:center;gap:6px;padding:9px 18px;background:linear-gradient(135deg,#f59e0b,#ef4444);border:none;border-radius:10px;color:#ffffff;font-weight:700;font-size:13px;cursor:pointer;">\u2b07\ufe0f Download</button>' +
        '</div></div></div>';

      let html = '';
      if (latest.length > 0) {
        html += '<div style="font-size:12px;font-weight:800;color:' + col.text + ';margin:5px 0 12px;display:flex;align-items:center;gap:6px;text-transform:uppercase;letter-spacing:0.5px;">✨ Latest Uploads <span style="background:' + col.bg + ';padding:1px 8px;border-radius:10px;font-size:10px;border:1px solid ' + col.border + ';color:' + col.text + ';">' + latest.length + '</span></div>';
        html += latest.map(renderPyqCard).join('');
        if (earlier.length > 0) {
          html += '<div style="font-size:12px;font-weight:800;color:var(--text-secondary);margin:24px 0 12px;text-transform:uppercase;letter-spacing:0.5px;opacity:0.6;">Recent Uploads</div>';
        }
      }
      html += earlier.map(renderPyqCard).join('');
      document.getElementById('pyq-detail-list').innerHTML = html || '<p style="text-align:center;padding:20px;color:var(--text-secondary);">No PYQ papers available for this selection.</p>';
    };

    window.pyqBackToSubjects = () => {
      document.getElementById('pyq-screen-detail').style.display = 'none';
      document.getElementById('pyq-screen-subjects').style.display = '';
    };

    async function getOrOpenPyq(id, fileName, action = 'view') {
      const vBtn = document.getElementById('pyq-view-btn-' + id);
      const dBtn = document.getElementById('pyq-dl-btn-' + id);
      const btn = action === 'view' ? vBtn : dBtn;
      const orig = btn ? btn.innerHTML : '';
      if (btn) { btn.innerHTML = '\u23f3 Loading\u2026'; btn.disabled = true; }
      if (vBtn && action === 'download') vBtn.disabled = true;
      if (dBtn && action === 'view') dBtn.disabled = true;
      try {
        const blob = await fetchPyqBlob(id);
        const url = URL.createObjectURL(blob);
        if (action === 'view') {
          window._openPdfViewer(url, fileName || 'PYQ Paper');
        } else {
          const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        }
      } catch (e) { alert('Error: ' + e.message); }
      finally {
        if (btn) { btn.innerHTML = orig; btn.disabled = false; }
        if (vBtn) { vBtn.disabled = false; }
        if (dBtn) { dBtn.disabled = false; }
      }
    }

    window.pyqStudentView = (id, fn) => getOrOpenPyq(id, fn, 'view');
    window.pyqStudentDownload = (id, fn) => getOrOpenPyq(id, fn, 'download');

    // Register remaining PYQ _impl_ aliases
    window._impl_pyqAdmView = window.pyqAdmView;
    window._impl_pyqAdmBackToSubjects = window.pyqAdmBackToSubjects;
    window._impl_pyqStudentView = window.pyqStudentView;
    window._impl_pyqStudentDownload = window.pyqStudentDownload;

    // ─── SECTION MULTI-CHECKBOX HELPERS ───
    window.admToggleSecDropdown = e => {
      e.stopPropagation();
      const d = document.getElementById('adm-sec-dropdown');
      const box = document.getElementById('adm-sec-box');
      if (!d || !box) return;
      if (d.style.display === 'none') {
        const rect = box.getBoundingClientRect();
        d.style.top = (rect.bottom + 4) + 'px';
        d.style.left = rect.left + 'px';
        d.style.width = rect.width + 'px';
        d.style.display = 'block';
      } else {
        d.style.display = 'none';
      }
    };
    document.addEventListener('click', () => {
      const d = document.getElementById('adm-sec-dropdown');
      if (d) d.style.display = 'none';
    });
    window.admSecAllChanged = () => {
      const allCb = document.getElementById('adm-sec-all');
      if (allCb && allCb.checked)
        document.querySelectorAll('.adm-sec-cb').forEach(cb => cb.checked = false);
      admUpdateSecLabel();
    };
    window.admSecCbChanged = () => {
      const any = [...document.querySelectorAll('.adm-sec-cb')].some(cb => cb.checked);
      const allCb = document.getElementById('adm-sec-all');
      if (allCb) allCb.checked = !any;
      admUpdateSecLabel();
    };
    function admUpdateSecLabel() {
      const label = document.getElementById('adm-sec-label');
      if (!label) return;
      const allCb = document.getElementById('adm-sec-all');
      const checked = [...document.querySelectorAll('.adm-sec-cb')].filter(cb => cb.checked).map(cb => cb.value);
      if (allCb && allCb.checked) { label.textContent = 'All Sections (Common)'; return; }
      label.textContent = checked.length ? 'Section ' + checked.join(', ') : 'All Sections (Common)';
    }
    function admGetSelectedSections() {
      const allCb = document.getElementById('adm-sec-all');
      if (!allCb || allCb.checked) return 'all';
      const checked = [...document.querySelectorAll('.adm-sec-cb')].filter(cb => cb.checked).map(cb => cb.value);
      return checked.length ? checked.join(',') : 'all';
    }

    // Expose admin section utilities globally
    window.admUpdateSecLabel = admUpdateSecLabel;
    window.admGetSelectedSections = admGetSelectedSections;

    // ─── PYQ SECTION MULTI-CHECKBOX HELPERS ───
    window.pyqToggleSecDropdown = e => {
      e.stopPropagation();
      const d = document.getElementById('pyq-sec-dropdown');
      const box = document.getElementById('pyq-sec-box');
      if (!d || !box) return;
      if (d.style.display === 'none') {
        const rect = box.getBoundingClientRect();
        d.style.top = (rect.bottom + 4) + 'px';
        d.style.left = rect.left + 'px';
        d.style.width = rect.width + 'px';
        d.style.display = 'block';
      } else { d.style.display = 'none'; }
    };
    document.addEventListener('click', () => {
      const d = document.getElementById('pyq-sec-dropdown');
      if (d) d.style.display = 'none';
    });
    window.pyqSecAllChanged = () => {
      const allCb = document.getElementById('pyq-sec-all');
      if (allCb && allCb.checked) document.querySelectorAll('.pyq-sec-cb').forEach(cb => cb.checked = false);
      pyqUpdateSecLabel();
    };
    window.pyqSecCbChanged = () => {
      const any = [...document.querySelectorAll('.pyq-sec-cb')].some(cb => cb.checked);
      const allCb = document.getElementById('pyq-sec-all');
      if (allCb) allCb.checked = !any;
      pyqUpdateSecLabel();
    };
    function pyqUpdateSecLabel() {
      const label = document.getElementById('pyq-sec-label');
      if (!label) return;
      const allCb = document.getElementById('pyq-sec-all');
      const checked = [...document.querySelectorAll('.pyq-sec-cb')].filter(cb => cb.checked).map(cb => cb.value);
      if (allCb && allCb.checked) { label.textContent = 'All Sections (Common)'; return; }
      label.textContent = checked.length ? 'Section ' + checked.join(', ') : 'All Sections (Common)';
    }
    function pyqGetSelectedSections() {
      const allCb = document.getElementById('pyq-sec-all');
      if (!allCb || allCb.checked) return 'all';
      const checked = [...document.querySelectorAll('.pyq-sec-cb')].filter(cb => cb.checked).map(cb => cb.value);
      return checked.length ? checked.join(',') : 'all';
    }

    // ─── PYQ FILE SELECTION (Folder scan & Multi-file) ───
    let pyqSelectedFiles = [];

    function pyqShowMsg(txt, color = '#f59e0b') {
      const el = document.getElementById('pyq-upload-msg');
      if (el) { el.textContent = txt; el.style.color = color; }
    }
    function pyqSetProgBar(pct) {
      const pb = document.getElementById('pyq-prog-bar');
      if (pb) pb.style.width = pct + '%';
    }

    window.pyqFileSelected = function(e) {
      pyqHandleFiles(e.target.files);
    };

    window.pyqFolderSelected = function(e) {
      pyqHandleFiles(e.target.files);
    };

    window.pyqDragOver = function(e) {
      e.preventDefault();
      const z = document.getElementById('pyq-upload-zone');
      if (z) { z.style.borderColor = '#d97706'; z.style.background = 'rgba(217,119,6,0.04)'; }
    };
    window.pyqDragLeave = function(e) {
      const z = document.getElementById('pyq-upload-zone');
      if (z) { z.style.borderColor = '#fde68a'; z.style.background = ''; }
    };
    window.pyqDrop = function(e) {
      e.preventDefault();
      window.pyqDragLeave();
      if (e.dataTransfer.items) {
        const files = [];
        const entries = [];
        for (let i=0; i<e.dataTransfer.items.length; i++) {
          const item = e.dataTransfer.items[i];
          if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry();
            if (entry) entries.push(entry);
          }
        }
        if (entries.length > 0) {
          scanEntries(entries, (scanned) => {
            const pdfs = scanned.filter(f => f.name.toLowerCase().endsWith('.pdf'));
            pyqHandleFiles(pdfs);
          });
        }
      } else {
        const pdfs = [...e.dataTransfer.files].filter(f => f.name.toLowerCase().endsWith('.pdf'));
        pyqHandleFiles(pdfs);
      }
    };

    async function scanEntries(entries, cb) {
      const files = [];
      const queue = [...entries];
      while(queue.length > 0) {
        const entry = queue.shift();
        if (entry.isFile) {
          const file = await new Promise(r => entry.file(r));
          files.push(file);
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          const readAll = async () => {
            const results = await new Promise(r => reader.readEntries(r));
            if (results.length > 0) {
              queue.push(...results);
              await readAll();
            }
          };
          await readAll();
        }
      }
      cb(files);
    }

    function pyqHandleFiles(files) {
      const pdfs = [...files].filter(f => f.name.toLowerCase().endsWith('.pdf'));
      if (pdfs.length === 0) { pyqShowMsg('❌ Only PDF files are supported.', '#ef4444'); return; }
      
      pdfs.forEach(f => {
        if (!pyqSelectedFiles.some(existing => existing.name === f.name && existing.size === f.size)) {
          pyqSelectedFiles.push(f);
        }
      });
      
      pyqRenderSelectedList();
      pyqShowMsg(pyqSelectedFiles.length ? `✅ ${pyqSelectedFiles.length} file(s) selected.` : 'Select files or drag folder to upload.', '#34d399');
    }

    function pyqRenderSelectedList() {
      const wrap = document.getElementById('pyq-selected-list');
      const container = document.getElementById('pyq-files-container');
      if (!wrap || !container) return;
      if (pyqSelectedFiles.length === 0) { wrap.style.display = 'none'; return; }
      wrap.style.display = 'block';
      container.innerHTML = pyqSelectedFiles.map((f, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin-bottom:6px;font-size:12px;">
          <span style="font-weight:600;color:#d97706;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%;" title="${esc(f.name)}">📄 ${esc(f.name)}</span>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="color:var(--text-secondary);font-size:10px;">${(f.size/1024).toFixed(0)} KB</span>
            <button onclick="pyqRemoveSelected(${i})" style="background:none;border:none;color:#ef4444;font-weight:900;cursor:pointer;font-size:13px;padding:2px 6px;">✕</button>
          </div>
        </div>
      `).join('');
    }

    window.pyqRemoveSelected = function(idx) {
      pyqSelectedFiles.splice(idx, 1);
      pyqRenderSelectedList();
      pyqShowMsg(pyqSelectedFiles.length ? `Selected ${pyqSelectedFiles.length} file(s).` : 'Select files or drag folder to upload.', pyqSelectedFiles.length ? '#34d399' : '#f59e0b');
    };

    window.pyqUpload = async function() {
      const btn = document.getElementById('pyq-upload-btn');
      if (!btn) return;
      
      const subject = val('pyq-subject');
      const examYear = val('pyq-exam-year');
      const year = val('pyq-adm-year');
      const sem = val('pyq-adm-sem');
      const sec = pyqGetSelectedSections();

      if (!subject || !examYear || !year || !sem) {
        pyqShowMsg('⚠️ Please fill in Subject, Exam Year, Year, and Semester.', '#ef4444');
        return;
      }

      if (pyqSelectedFiles.length === 0) {
        pyqShowMsg('⚠️ Please select at least one PDF file or folder.', '#ef4444');
        return;
      }

      btn.disabled = true;
      pyqShowMsg('⏳ Preparing upload...', '#3d5af1');
      const pw = document.getElementById('pyq-progress-wrap');
      if (pw) pw.style.display = 'block';
      pyqSetProgBar(2);

      let successCount = 0;
      let failCount = 0;
      const totalFiles = pyqSelectedFiles.length;
      const fileWeight = 100 / totalFiles;

      for (let i = 0; i < totalFiles; i++) {
        const currentFile = pyqSelectedFiles[i];
        const fileProgressBase = i * fileWeight;
        const fileTitle = currentFile.name.replace(/\.[^/.]+$/, ""); // remove extension

        pyqShowMsg(`⏳ Uploading file ${i+1}/${totalFiles}: ${currentFile.name}...`, '#3d5af1');

        try {
          const base64Full = await readFileBase64(currentFile);
          const totalBytes = currentFile.size;

          const docRef = await addDoc(collection(db, 'pyq_papers'), {
            subject,
            title: fileTitle,
            fileName: currentFile.name,
            examYear,
            year,
            sem,
            section: sec,
            fileSize: totalBytes,
            totalChunks: Math.ceil(base64Full.length / Math.ceil(CHUNK_SIZE / 3 * 4)),
            uploadedAt: serverTimestamp(),
            uploadedBy: window._currentAdminId || 'admin'
          });

          // Upload chunks
          const base64Len = base64Full.length;
          const chunkLen = Math.ceil(CHUNK_SIZE / 3) * 4;
          let idx = 0;
          let offset = 0;

          while (offset < base64Len) {
            const chunkData = base64Full.slice(offset, offset + chunkLen);
            const chunkId = String(idx).padStart(5, '0');
            
            await setDoc(doc(db, 'pyq_papers', docRef.id, 'chunks', chunkId), {
              idx,
              data: chunkData
            });

            idx++;
            offset += chunkLen;

            const fileInternalProgress = Math.min(100, Math.round((offset / base64Len) * 100));
            pyqSetProgBar(Math.round(fileProgressBase + (fileInternalProgress * fileWeight / 100)));
          }

          successCount++;
        } catch (err) {
          console.error(err);
          failCount++;
        }
      }

      pyqSetProgBar(100);
      setTimeout(() => { if (pw) pw.style.display = 'none'; pyqSetProgBar(0); }, 800);

      if (failCount === 0) {
        pyqShowMsg(`✅ ${successCount} PYQ Paper${successCount > 1 ? 's' : ''} uploaded successfully!`, '#34d399');

        // ── Send email notifications to eligible students ──
        try {
          const dept = document.getElementById('pyq-dept')?.value || '';
          fetch(`${API_BASE_URL}/api/notify-upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contentType: 'PYQ',
              subject,
              title: subject + ' PYQ ' + examYear,
              dept: dept || 'All',
              year,
              sem,
              section: sec
            })
          }).then(r => r.json()).then(d => {
            if (d.success && d.sentCount > 0) {
              pyqShowMsg(`✅ ${successCount} PYQ Paper${successCount > 1 ? 's' : ''} uploaded. 📧 ${d.sentCount} students notified!`, '#34d399');
            }
          }).catch(() => {});
        } catch (e) { /* silent fail */ }

      } else {
        pyqShowMsg(`⚠️ Uploaded ${successCount}, failed ${failCount}.`, '#f59e0b');
      }

      pyqResetForm();
      btn.disabled = false; btn.textContent = '🚀 Upload PYQ Paper';
      pyqAdmLoadAll();
    };


    function pyqResetForm() {
      pyqSelectedFiles = [];
      const wrap = document.getElementById('pyq-selected-list');
      if (wrap) wrap.style.display = 'none';
      const container = document.getElementById('pyq-files-container');
      if (container) container.innerHTML = '';
      ['pyq-subject', 'pyq-title', 'pyq-exam-year'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      ['pyq-adm-year', 'pyq-adm-sem'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      const allCb = document.getElementById('pyq-sec-all');
      if (allCb) allCb.checked = true;
      document.querySelectorAll('.pyq-sec-cb').forEach(cb => cb.checked = false);
      pyqUpdateSecLabel();
      const fi = document.getElementById('pyq-file-input'); if (fi) fi.value = '';
      const fld = document.getElementById('pyq-folder-input'); if (fld) fld.value = '';
      document.getElementById('pyq-uz-icon').textContent = '📜';
      document.getElementById('pyq-uz-text').textContent = 'Click to select Files or Drag & Drop Folder';
      document.getElementById('pyq-uz-sub').textContent = 'PDF files only · Multiple files & Folders supported ✓';
      if (typeof filterPyqBySemester === 'function') filterPyqBySemester('all');
    }

    // ─── RECONSTRUCT PYQ PDF FROM CHUNKS ───
    async function fetchChunksRest(collectionName, docId) {
      const projectId = "attendance-system-54b30";
      const apiKey = "AIzaSyC-aoJvlXHec3XQojpD1eKPvOQtYwCL0gI";
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${docId}/chunks?key=${apiKey}&pageSize=300`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`REST fetch failed with status ${res.status}`);
      const data = await res.json();
      const docs = data.documents || [];
      if (docs.length === 0) throw new Error("No chunks found");
      docs.sort((a, b) => {
        const idxA = parseInt(a.fields?.idx?.integerValue || a.fields?.idx?.stringValue || "0", 10);
        const idxB = parseInt(b.fields?.idx?.integerValue || b.fields?.idx?.stringValue || "0", 10);
        return idxA - idxB;
      });
      return docs.map(d => d.fields?.data?.stringValue || "");
    }

    async function fetchPyqBlob(id) {
      try {
        const cached = await PdfDbCache.get('pyq', id);
        if (cached) {
          console.log('⚡ Loaded PYQ ' + id + ' instantly from cache!');
          return cached;
        }
      } catch (ce) { console.warn('Cache read error:', ce); }

      let parts = [];
      let pyqMeta = (window.allStudentPYQ || []).find(n => n.id === id);
      if (!pyqMeta && window._pyqAdmAllPapers) {
        pyqMeta = window._pyqAdmAllPapers.find(n => n.id === id);
      }
      if (!pyqMeta) {
        try {
          const metaSnap = await getDoc(doc(db, 'pyq_papers', id));
          if (metaSnap.exists()) pyqMeta = metaSnap.data();
        } catch (_) {}
      }

      try {
        console.log(`🚀 Attempting fast REST fetch for PYQ chunks: ${id}`);
        parts = await fetchChunksRest('pyq_papers', id);
      } catch (restErr) {
        console.warn(`REST chunk fetch failed, falling back to Firestore SDK:`, restErr);
        const chunksSnap = await getDocs(
          query(collection(db, 'pyq_papers', id, 'chunks'), orderBy('idx', 'asc'))
        );
        if (chunksSnap.empty) throw new Error('No file data found for this paper');
        chunksSnap.forEach(d => parts.push(d.data().data));
      }

      const blob = base64ToBlob(parts.join(''), 'application/pdf');

      try {
        await PdfDbCache.set('pyq', id, blob);
      } catch (ce) { console.warn('Cache write error:', ce); }

      return blob;
    }
    window.fetchPyqBlob = fetchPyqBlob;

