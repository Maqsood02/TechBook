import { auth, db } from '../core/firebase.js';
import { doc, setDoc, getDoc, addDoc, collection, query, where, getDocs, orderBy, deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { $, val, base64ToBlob, esc, PdfDbCache, jsEsc, readFileBase64, getStudentProfile, API_BASE_URL } from '../core/helpers.js';

const CHUNK_SIZE = 700 * 1024;
let lastQbankFetchTime = 0;

    // ==========================================
    // 📚 QUESTION BANK (Q-BANK) SYSTEM
    // ==========================================
    window.allStudentQBank = [];
    window._qbankSubjectList = [];

    const subjectColors = [
      { bg: 'linear-gradient(135deg,#eff2fe,#e8ebfd)', border: '#c7d0fb', text: '#3d5af1', glow: 'rgba(61,90,241,0.15)', icon: '📘' },
      { bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '#86efac', text: '#16a34a', glow: 'rgba(22,163,74,0.15)', icon: '📗' },
      { bg: 'linear-gradient(135deg,#fdf4ff,#f3e8ff)', border: '#d8b4fe', text: '#9333ea', glow: 'rgba(147,51,234,0.15)', icon: '📙' },
      { bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '#fde68a', text: '#d97706', glow: 'rgba(217,119,6,0.15)', icon: '📕' },
      { bg: 'linear-gradient(135deg,#fff1f2,#ffe4e6)', border: '#fca5a5', text: '#dc2626', glow: 'rgba(220,38,38,0.15)', icon: '📓' },
      { bg: 'linear-gradient(135deg,#f0fdfa,#ccfbf1)', border: '#6ee7b7', text: '#059669', glow: 'rgba(5,150,105,0.15)', icon: '📔' },
      { bg: 'linear-gradient(135deg,#fff7ed,#ffedd5)', border: '#fdba74', text: '#ea580c', glow: 'rgba(234,88,12,0.15)', icon: '📒' },
      { bg: 'linear-gradient(135deg,#fdf2f8,#fce7f3)', border: '#f9a8d4', text: '#db2777', glow: 'rgba(219,39,119,0.15)', icon: '📑' },
      { bg: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', border: '#7dd3fc', text: '#0284c7', glow: 'rgba(2,132,199,0.15)', icon: '🗒️' },
      { bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '#c4b5fd', text: '#7c3aed', glow: 'rgba(124,58,237,0.15)', icon: '📋' },
    ];

    // --- IndexedDB Caching and Concurrent Fetching ---
    async function fetchQBankBlob(qbankId) {
      try {
        const cached = await PdfDbCache.get('qbank', qbankId);
        if (cached) {
          console.log('⚡ Loaded Q-Bank ' + qbankId + ' instantly from cache!');
          return cached;
        }
      } catch (ce) { console.warn('Cache read error:', ce); }

      let parts = [];
      let qbankMeta = allStudentQBank.find(n => n.id === qbankId);
      if (!qbankMeta && window._qbankAdmAllPapers) {
        qbankMeta = window._qbankAdmAllPapers.find(n => n.id === qbankId);
      }
      if (!qbankMeta) {
        try {
          const metaSnap = await getDoc(doc(db, 'qbank_papers', qbankId));
          if (metaSnap.exists()) qbankMeta = metaSnap.data();
        } catch (_) {}
      }

      if (qbankMeta && typeof qbankMeta.totalChunks === 'number' && qbankMeta.totalChunks > 0) {
        const total = qbankMeta.totalChunks;
        const promises = [];
        for (let j = 0; j < total; j++) {
          const chunkId = String(j).padStart(5, '0');
          promises.push(getDoc(doc(db, 'qbank_papers', qbankId, 'chunks', chunkId)));
        }
        const snaps = await Promise.all(promises);
        snaps.forEach(d => {
          if (d.exists()) parts.push(d.data().data);
        });
      }

      if (parts.length === 0) {
        const chunksSnap = await getDocs(
          query(collection(db, 'qbank_papers', qbankId, 'chunks'), orderBy('idx', 'asc'))
        );
        if (chunksSnap.empty) throw new Error('No chunks found for this Question Bank');
        chunksSnap.forEach(d => parts.push(d.data().data));
      }

      const blob = base64ToBlob(parts.join(''), 'application/pdf');

      try {
        await PdfDbCache.set('qbank', qbankId, blob);
      } catch (ce) { console.warn('Cache write error:', ce); }

      return blob;
    }

    // --- Student-Side Q-Bank Loader ---
    window.studentLoadQBank = async () => {
      const grid = document.getElementById('qbank-subject-grid');
      const hasCache = allStudentQBank && allStudentQBank.length > 0;

      const now = Date.now();
      if (hasCache && (now - lastQbankFetchTime < 60000)) {
        studentFilterQBank();
        return;
      }

      if (!hasCache && grid) {
        grid.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:32px;margin-bottom:8px;">⏳</div><div style="color:var(--text-secondary);font-size:13px;">Loading Question Banks…</div></div>';
      }

      if (!hasCache) {
        const det = document.getElementById('qbank-screen-detail');
        const subj = document.getElementById('qbank-screen-subjects');
        if (det) det.style.display = 'none';
        if (subj) subj.style.display = '';
      }

      try {
        const usn = window._currentStudentUSN;
        if (usn) {
          try {
            const d = await getStudentProfile(usn);
            if (d) {
              const year = String(d.year || d.academicYear || '');
              const sem = String(d.sem || d.semester || '');
              const sec = String(d.section || d.branch || '');
              const yEl = document.getElementById('qbank-filter-year');
              const sEl = document.getElementById('qbank-filter-sem');
              const cEl = document.getElementById('qbank-filter-sec');
              if (yEl && year) yEl.value = year;
              if (sEl && sem) sEl.value = sem;
              if (cEl && sec && sec.length === 1) cEl.value = sec.toUpperCase();
              const banner = document.getElementById('qbank-autofill-banner');
              const label = document.getElementById('qbank-autofill-label');
              if (banner && label && (year || sem || sec)) {
                label.textContent = [year ? 'Year ' + year : '', sem ? 'Sem ' + sem : '', sec ? 'Section ' + sec : ''].filter(Boolean).join(' · ');
                banner.style.display = '';
              }
            }
          } catch (_) {}
        }

        if (hasCache) {
          studentFilterQBank();
        }

        const snap = await getDocs(query(collection(db, 'qbank_papers'), orderBy('uploadedAt', 'desc')));
        const newPapers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const changed = JSON.stringify(allStudentQBank) !== JSON.stringify(newPapers);
        if (changed || !hasCache) {
          allStudentQBank = newPapers;
          studentFilterQBank();
        }
        lastQbankFetchTime = now;
      } catch (e) {
        if (!hasCache && grid) {
          grid.innerHTML = `<p style="color:#f87171;text-align:center;padding:20px;">Error: ${esc(e.message)}</p>`;
        }
      }
    };

    window.studentFilterQBank = () => {
      const year = document.getElementById('qbank-filter-year')?.value || '';
      const sem = document.getElementById('qbank-filter-sem')?.value || '';
      const sec = document.getElementById('qbank-filter-sec')?.value || '';
      const filtered = allStudentQBank.filter(n => {
        if (year && n.year !== year) return false;
        if (sem && n.sem !== sem) return false;
        if (sec) {
          const noteSecs = (n.section || 'all').split(',').map(s => s.trim());
          if (!noteSecs.includes('all') && !noteSecs.includes(sec)) return false;
        }
        return true;
      });
      renderQBankSubjectGrid(filtered);
    };

    window.studentClearQBankFilters = () => {
      ['qbank-filter-year', 'qbank-filter-sem', 'qbank-filter-sec'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      const banner = document.getElementById('qbank-autofill-banner');
      if (banner) banner.style.display = 'none';
      const detail = document.getElementById('qbank-screen-detail');
      const subjs = document.getElementById('qbank-screen-subjects');
      if (detail) detail.style.display = 'none';
      if (subjs) subjs.style.display = '';
      studentFilterQBank();
    };

    function renderQBankSubjectGrid(papers) {
      const grid = document.getElementById('qbank-subject-grid');
      if (!grid) return;

      if (!papers.length) {
        grid.innerHTML = '<div style="text-align:center;padding:50px 20px;"><div style="font-size:56px;margin-bottom:14px;opacity:0.4;">📭</div><div style="font-size:15px;font-weight:700;color:var(--text-secondary);">No Q-Banks Found</div><div style="font-size:13px;color:rgba(139,168,204,0.4);margin-top:6px;">Try different filters or check back later.</div></div>';
        return;
      }

      const grouped = {};
      papers.forEach(n => { const s = n.subject || 'General'; if (!grouped[s]) grouped[s] = []; grouped[s].push(n); });
      const subjects = Object.keys(grouped).sort();
      window._qbankSubjectList = subjects;

      const totalPapers = papers.length;
      let html = '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:14px;">📂 ' +
        subjects.length + ' subject' + (subjects.length > 1 ? 's' : '') + ' · 📄 ' + totalPapers + ' Q-Bank' + (totalPapers > 1 ? 's' : '') +
        '</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">';

      subjects.forEach((subj, si) => {
        const col = subjectColors[si % subjectColors.length];
        const sPapers = grouped[subj];
        const count = sPapers.length;
        const dates = sPapers.filter(n => n.uploadedAt).map(n => n.uploadedAt.seconds);
        const latest = dates.length ? new Date(Math.max(...dates) * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '';

        html += '<button onclick="qbankOpenSubjectByIdx(' + si + ')" ' +
          'style="text-align:center;background:' + col.bg + ';border:1.5px solid ' + col.border + ';' +
          'border-radius:14px;padding:10px 6px 9px;cursor:pointer;transition:all 0.22s;' +
          'box-shadow:0 1px 4px ' + col.glow + ';" ' +
          'onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 8px 20px ' + col.glow + '\'" ' +
          'onmouseout="this.style.transform=\'\';this.style.boxShadow=\'0 1px 4px ' + col.glow + '\'">' +
          '<div style="font-size:20px;margin-bottom:5px;">📚</div>' +
          '<div style="font-size:9.5px;font-weight:800;color:' + col.text + ';line-height:1.3;margin-bottom:4px;' +
          'overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word;">' + esc(subj) + '</div>' +
          '<div style="display:inline-flex;align-items:center;background:rgba(0,0,0,0.06);border-radius:20px;padding:1px 7px;">' +
          '<span style="font-size:8px;font-weight:700;color:' + col.text + ';">' + count + ' Q-Bank' + (count > 1 ? 's' : '') + '</span></div>' +
          (latest ? '<div style="font-size:7.5px;color:' + col.text + ';opacity:0.5;margin-top:3px;">' + latest + '</div>' : '') +
          '</button>';
      });

      html += '</div>';
      grid.innerHTML = html;
    }

    window.qbankOpenSubjectByIdx = (idx) => {
      const subj = window._qbankSubjectList[idx];
      if (subj !== undefined) qbankOpenSubject(subj, idx);
    };

    window.qbankOpenSubject = (subj, colorIdx) => {
      const col = subjectColors[colorIdx % subjectColors.length];
      const year = document.getElementById('qbank-filter-year')?.value || '';
      const sem = document.getElementById('qbank-filter-sem')?.value || '';
      const sec = document.getElementById('qbank-filter-sec')?.value || '';
      const papers = allStudentQBank.filter(n => {
        if ((n.subject || 'General') !== subj) return false;
        if (year && n.year !== year) return false;
        if (sem && n.sem !== sem) return false;
        const nSec = (n.section || 'all').toLowerCase().trim();
        if (nSec === 'all') return true;
        if (!sec) return true;
        return nSec.split(',').map(s => s.trim()).includes(sec.toLowerCase().trim());
      });

      document.getElementById('qbank-screen-subjects').style.display = 'none';
      document.getElementById('qbank-screen-detail').style.display = '';
      document.getElementById('qbank-detail-title').textContent = '📚 ' + subj;
      document.getElementById('qbank-detail-title').style.color = col.text;
      document.getElementById('qbank-detail-sub').textContent = papers.length + ' Q-Bank' + (papers.length > 1 ? 's' : '') + ' available';

      const detailList = document.getElementById('qbank-detail-list');
      const nowMs = Date.now();
      const thresholdMs = 3 * 24 * 60 * 60 * 1000;

      const latest = [], earlier = [];
      papers.forEach(n => {
        if (n.uploadedAt && (nowMs - n.uploadedAt.seconds * 1000) < thresholdMs) latest.push(n);
        else earlier.push(n);
      });

      const renderQBankCard = (n) => `
      <div style="background:rgba(255,255,255,0.7);border:1.5px solid ${col.border};border-radius:14px;
        padding:16px;margin-bottom:12px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:${col.text};border-radius:4px 0 0 4px;opacity:0.8;"></div>
        <div style="padding-left:12px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            <div style="font-size:15px;font-weight:800;color:var(--text-primary);">${esc(n.title)}</div>
            ${n.uploadedAt ? `<div style="font-size:10px;color:rgba(139,168,204,0.4);white-space:nowrap;">
              🕐 ${new Date(n.uploadedAt.seconds * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>`: ''}
          </div>
          ${n.desc ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;line-height:1.5;">${esc(n.desc)}</div>` : ''}
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px;">
            <span style="padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;background:${col.bg};border:1px solid ${col.border};color:${col.text};">Year ${esc(n.year)}</span>
            <span style="padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;background:${col.bg};border:1px solid ${col.border};color:${col.text};">Sem ${esc(n.sem)}</span>
            <span style="padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;background:#f7f8fc;border:1px solid rgba(0,0,0,0.03);color:var(--text-secondary);">${(n.section || 'all') === 'all' ? 'All Sections' : n.section.split(',').map(s => 'Sec ' + s.trim()).join(' & ')}</span>
            ${n.fileSize ? `<span style="padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;background:#f7f8fc;border:1px solid rgba(0,0,0,0.03);color:var(--text-secondary);">${(n.fileSize / 1024).toFixed(1)} KB</span>` : ''}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button onclick="studentViewQBank('${n.id}','${jsEsc(n.fileName || 'qbank.pdf')}')" data-qbank-id="${n.id}"
              id="qbank-view-btn-${n.id}"
              style="display:inline-flex;align-items:center;gap:6px;padding:9px 18px;
                background:${col.bg};border:1.5px solid ${col.border};
                border-radius:10px;color:${col.text};font-weight:700;font-size:13px;cursor:pointer;">
              👁️ View PDF
            </button>
            <button onclick="studentDownloadQBank('${n.id}','${jsEsc(n.fileName || 'qbank.pdf')}')" data-qbank-id="${n.id}"
              id="qbank-dl-btn-${n.id}"
              style="display:inline-flex;align-items:center;gap:6px;padding:9px 18px;
                background:linear-gradient(135deg,#0891b2,#06b6d4);border:none;
                border-radius:10px;color:#f5f6fa;font-weight:700;font-size:13px;cursor:pointer;">
              ⬇️ Download
            </button>
          </div>
        </div>
      </div>`;

      let html = '';
      if (latest.length > 0) {
        html += `<div style="font-size:12px;font-weight:800;color:${col.text};margin:5px 0 12px;display:flex;align-items:center;gap:6px;text-transform:uppercase;letter-spacing:0.5px;">✨ Latest Uploads <span style="background:${col.bg};padding:1px 8px;border-radius:10px;font-size:10px;border:1px solid ${col.border};">${latest.length}</span></div>`;
        html += latest.map(renderQBankCard).join('');
        if (earlier.length > 0) {
          html += `<div style="font-size:12px;font-weight:800;color:var(--text-secondary);margin:24px 0 12px;text-transform:uppercase;letter-spacing:0.5px;opacity:0.6;">Earlier Uploads</div>`;
        }
      }
      html += earlier.map(renderQBankCard).join('');
      detailList.innerHTML = html || '<p style="text-align:center;padding:20px;color:var(--text-secondary);">No Q-Banks available for this selection.</p>';
    };

    window.qbankBackToSubjects = () => {
      document.getElementById('qbank-screen-detail').style.display = 'none';
      document.getElementById('qbank-screen-subjects').style.display = '';
    };

    async function getOrOpenQBankPdf(id, fileName, action = 'view') {
      const vBtn = document.getElementById('qbank-view-btn-' + id);
      const dBtn = document.getElementById('qbank-dl-btn-' + id);
      const btn = action === 'view' ? vBtn : dBtn;
      const orig = btn ? btn.innerHTML : '';
      if (btn) { btn.innerHTML = '⏳ Loading…'; btn.disabled = true; }
      if (vBtn && action === 'download') vBtn.disabled = true;
      if (dBtn && action === 'view') dBtn.disabled = true;
      try {
        const blob = await fetchQBankBlob(id);
        const url = URL.createObjectURL(blob);
        if (action === 'view') {
          window._openPdfViewer(url, fileName || 'Question Bank');
        } else {
          const a = document.createElement('a');
          a.href = url; a.download = fileName; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        }
      } catch (e) { alert('Error: ' + e.message); }
      finally {
        if (btn) { btn.innerHTML = orig; btn.disabled = false; }
        if (vBtn) { vBtn.disabled = false; }
        if (dBtn) { dBtn.disabled = false; }
      }
    }

    window.studentViewQBank = (id, fn) => getOrOpenQBankPdf(id, fn, 'view');
    window.studentDownloadQBank = (id, fn) => getOrOpenQBankPdf(id, fn, 'download');

    // ─── ADMIN: QUESTION BANK SYSTEM ───
    let qbankSelectedFiles = [];

    window.qbankToggleSecDropdown = (e) => {
      e.stopPropagation();
      const dd = document.getElementById('qbank-sec-dropdown');
      if (!dd) return;
      if (dd.style.display === 'none') {
        const box = document.getElementById('qbank-sec-box');
        const rect = box.getBoundingClientRect();
        dd.style.top = (rect.bottom + window.scrollY) + 'px';
        dd.style.left = (rect.left + window.scrollX) + 'px';
        dd.style.width = rect.width + 'px';
        dd.style.display = 'block';
      } else {
        dd.style.display = 'none';
      }
    };

    window.qbankSecAllChanged = () => {
      const allCb = document.getElementById('qbank-sec-all');
      if (allCb && allCb.checked) {
        document.querySelectorAll('.qbank-sec-cb').forEach(cb => cb.checked = false);
      }
      qbankUpdateSecLabel();
    };

    window.qbankSecCbChanged = () => {
      const allCb = document.getElementById('qbank-sec-all');
      const cbs = document.querySelectorAll('.qbank-sec-cb');
      let customChecked = false;
      cbs.forEach(cb => { if (cb.checked) customChecked = true; });
      if (customChecked && allCb) {
        allCb.checked = false;
      } else if (!customChecked && allCb) {
        allCb.checked = true;
      }
      qbankUpdateSecLabel();
    };

    function qbankUpdateSecLabel() {
      const label = document.getElementById('qbank-sec-label');
      const allCb = document.getElementById('qbank-sec-all');
      if (allCb && allCb.checked) {
        label.textContent = "All Sections (Common)";
        return;
      }
      const active = [];
      document.querySelectorAll('.qbank-sec-cb').forEach(cb => { if (cb.checked) active.push(cb.value); });
      label.textContent = active.length > 0 ? "Sections: " + active.join(", ") : "All Sections (Common)";
    }

    function qbankGetSelectedSections() {
      const allCb = document.getElementById('qbank-sec-all');
      if (allCb && allCb.checked) return 'all';
      const active = [];
      document.querySelectorAll('.qbank-sec-cb').forEach(cb => { if (cb.checked) active.push(cb.value); });
      return active.length > 0 ? active.join(',') : 'all';
    }

    window.qbankFileSelected = (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      
      const filtered = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
      if (filtered.length === 0) {
        alert('Please select PDF files only.');
        return;
      }

      qbankSelectedFiles = filtered;
      const wrap = document.getElementById('qbank-selected-list');
      const count = document.getElementById('qbank-selected-count');
      const container = document.getElementById('qbank-files-container');
      const uzText = document.getElementById('qbank-uz-text');
      const uzSub = document.getElementById('qbank-uz-sub');

      wrap.style.display = 'block';
      count.textContent = `${filtered.length} files`;
      container.innerHTML = filtered.map((f, idx) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#f7f8fc;border-radius:8px;">
          <span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80%;">${idx + 1}. ${f.name}</span>
          <span style="color:var(--text-secondary);font-size:11px;">(${(f.size / 1024).toFixed(0)} KB)</span>
        </div>
      `).join('');

      uzText.textContent = filtered.length === 1 ? filtered[0].name : `${filtered.length} files selected`;
      uzSub.textContent = `Ready to upload ✓`;

      if (filtered.length === 1) {
        document.getElementById('qbank-title').value = filtered[0].name.replace(/\.[^/.]+$/, "");
      } else {
        document.getElementById('qbank-title').placeholder = 'Multiple files: Filenames will be used';
      }
    };

    window.qbankDragOver = (e) => { e.preventDefault(); document.getElementById('qbank-upload-zone').style.borderColor = '#0891b2'; };
    window.qbankDragLeave = (e) => { e.preventDefault(); document.getElementById('qbank-upload-zone').style.borderColor = '#a5f3fc'; };
    window.qbankDropFile = (e) => {
      e.preventDefault();
      document.getElementById('qbank-upload-zone').style.borderColor = '#a5f3fc';
      const items = e.dataTransfer.items;
      if (!items) return;
      const pdfFiles = [];
      const readEntries = [];

      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) {
          if (entry.isFile && entry.name.toLowerCase().endsWith('.pdf')) {
            readEntries.push(new Promise(resolve => {
              entry.file(f => { pdfFiles.push(f); resolve(); });
            }));
          } else if (entry.isDirectory) {
            readEntries.push(scanDirForPdfs(entry, pdfFiles));
          }
        }
      }

      Promise.all(readEntries).then(() => {
        if (pdfFiles.length === 0) {
          alert('No PDF files found.');
          return;
        }
        qbankSelectedFiles = pdfFiles;
        const wrap = document.getElementById('qbank-selected-list');
        const count = document.getElementById('qbank-selected-count');
        const container = document.getElementById('qbank-files-container');
        const uzText = document.getElementById('qbank-uz-text');
        const uzSub = document.getElementById('qbank-uz-sub');

        wrap.style.display = 'block';
        count.textContent = `${pdfFiles.length} files`;
        container.innerHTML = pdfFiles.map((f, idx) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#f7f8fc;border-radius:8px;">
            <span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80%;">${idx + 1}. ${f.name}</span>
            <span style="color:var(--text-secondary);font-size:11px;">(${(f.size / 1024).toFixed(0)} KB)</span>
          </div>
        `).join('');

        uzText.textContent = pdfFiles.length === 1 ? pdfFiles[0].name : `${pdfFiles.length} files selected`;
        uzSub.textContent = `Ready to upload ✓`;

        if (pdfFiles.length === 1) {
          document.getElementById('qbank-title').value = pdfFiles[0].name.replace(/\.[^/.]+$/, "");
        } else {
          document.getElementById('qbank-title').placeholder = 'Multiple files: Filenames will be used';
        }
      });
    };

    window.admUploadQBank = async () => {
      const subject = document.getElementById('qbank-subject').value.trim();
      const titleInput = document.getElementById('qbank-title').value.trim();
      const desc = document.getElementById('qbank-desc').value.trim();
      const year = document.getElementById('qbank-year').value;
      const sem = document.getElementById('qbank-sem').value;
      const sec = qbankGetSelectedSections();

      if (qbankSelectedFiles.length === 0) { qbankShowMsg('⚠️ Please select at least one PDF file.', '#f87171'); return; }
      if (!subject || !year || !sem) { qbankShowMsg('⚠️ Fill in Subject, Year and Semester.', '#f87171'); return; }
      if (qbankSelectedFiles.length === 1 && !titleInput) { qbankShowMsg('⚠️ Please provide a Title.', '#f87171'); return; }

      const btn = document.getElementById('qbank-btn-upload');
      btn.disabled = true; btn.textContent = '⏳ Uploading…';
      const pw = document.getElementById('qbank-prog-wrap');
      pw.style.display = 'block';
      setQBankProgBar(0);

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < qbankSelectedFiles.length; i++) {
        const currentFile = qbankSelectedFiles[i];
        const currentTitle = qbankSelectedFiles.length === 1 ? titleInput : (currentFile.name.replace(/\.[^/.]+$/, ""));

        const fileProgressBase = (i / qbankSelectedFiles.length) * 100;
        const fileWeight = 100 / qbankSelectedFiles.length;

        qbankShowMsg(`📖 Reading [${i + 1}/${qbankSelectedFiles.length}] ${currentFile.name}…`, '#0891b2');

        try {
          const base64Full = await readFileBase64(currentFile);
          const chunkSize64 = Math.ceil(CHUNK_SIZE / 3) * 4;
          const chunks = [];
          for (let j = 0; j < base64Full.length; j += chunkSize64) {
            chunks.push(base64Full.slice(j, j + chunkSize64));
          }

          const sections = sec === 'all' ? ['all'] : sec.split(',');

          async function uploadChunksFor(metaRefId, sectionIdx, totalSections) {
            let batchStart = 0;
            while (batchStart < chunks.length) {
              const bN = writeBatch(db);
              let batchBytes = 0;
              let added = 0;
              let j = batchStart;
              while (j < chunks.length) {
                const chunkBytes = chunks[j].length;
                if (added > 0 && batchBytes + chunkBytes > 9 * 1024 * 1024) break;
                const cr = doc(collection(db, 'qbank_papers', metaRefId, 'chunks'), String(j).padStart(5, '0'));
                bN.set(cr, { idx: j, data: chunks[j] });
                batchBytes += chunkBytes;
                added++;
                j++;
              }
              await bN.commit();
              batchStart = j;

              const chunkProgress = batchStart / chunks.length;
              const fileInternalProgress = (10 + (90 * (sectionIdx + chunkProgress) / totalSections));
              setQBankProgBar(Math.round(fileProgressBase + (fileInternalProgress * fileWeight / 100)));
              qbankShowMsg(`📤 Uploading [${i + 1}/${qbankSelectedFiles.length}] ${currentFile.name}…`, '#0891b2');
            }
          }

          for (let si = 0; si < sections.length; si++) {
            const metaRef = await addDoc(collection(db, 'qbank_papers'), {
              subject, title: currentTitle, desc, year, sem, section: sections[si],
              fileName: currentFile.name,
              fileSize: currentFile.size,
              totalChunks: chunks.length,
              mimeType: 'application/pdf',
              uploadedAt: serverTimestamp()
            });
            await uploadChunksFor(metaRef.id, si, sections.length);
          }
          successCount++;
        } catch (err) {
          console.error(err);
          failCount++;
        }
      }

      setQBankProgBar(100);
      setTimeout(() => { pw.style.display = 'none'; setQBankProgBar(0); }, 800);

      if (failCount === 0) {
        qbankShowMsg(`✅ ${successCount} Question Bank${successCount > 1 ? 's' : ''} uploaded successfully!`, '#0891b2');

        // ── Send email notifications to eligible students ──
        try {
          const dept = document.getElementById('qbank-dept')?.value || '';
          fetch(`${API_BASE_URL}/api/notify-upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contentType: 'Question Bank',
              subject,
              title: titleInput || subject,
              dept: dept || 'All',
              year,
              sem,
              section: sec
            })
          }).then(r => r.json()).then(d => {
            if (d.success && d.sentCount > 0) {
              qbankShowMsg(`✅ ${successCount} Q-Bank${successCount > 1 ? 's' : ''} uploaded. 📧 ${d.sentCount} students notified!`, '#0891b2');
            }
          }).catch(() => {});
        } catch (e) { /* silent fail */ }

      } else {
        qbankShowMsg(`⚠️ Uploaded ${successCount}, failed ${failCount}.`, '#f59e0b');
      }

      qbankResetForm();
      btn.disabled = false; btn.textContent = '🚀 Upload Q-Bank';
      qbankAdmLoadAll();
    };


    function setQBankProgBar(val) {
      const pb = document.getElementById('qbank-prog-bar');
      if (pb) pb.style.width = val + '%';
    }

    function qbankShowMsg(txt, col) {
      const m = document.getElementById('qbank-upload-msg');
      if (m) { m.textContent = txt; m.style.color = col; }
    }

    window.qbankResetForm = () => {
      ['qbank-subject', 'qbank-title', 'qbank-desc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      ['qbank-year', 'qbank-sem'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      const allCb = document.getElementById('qbank-sec-all');
      if (allCb) { allCb.checked = true; }
      document.querySelectorAll('.qbank-sec-cb').forEach(cb => cb.checked = false);
      qbankUpdateSecLabel();

      const fi = document.getElementById('qbank-file-input'); if (fi) fi.value = '';
      const fo = document.getElementById('qbank-folder-input'); if (fo) fo.value = '';
      const wrap = document.getElementById('qbank-selected-list'); if (wrap) wrap.style.display = 'none';
      qbankSelectedFiles = [];
      const uzText = document.getElementById('qbank-uz-text');
      const uzSub = document.getElementById('qbank-uz-sub');
      if (uzText) uzText.textContent = "Click to select Files or Drag & Drop Folder";
      if (uzSub) uzSub.textContent = "PDF files only · Multiple files & Folders supported ✓";
    };

    // --- Admin List Handlers ---
    window._qbankAdmAllPapers = [];
    window._qbankActiveFilterSem = 'all';

    window.qbankAdmLoadAll = async function () {
      const listEl = document.getElementById('qbank-adm-list');
      if (!listEl) return;
      listEl.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:16px;">⏳ Loading…</p>';
      try {
        const snap = await getDocs(query(collection(db, 'qbank_papers'), orderBy('uploadedAt', 'desc')));
        const papers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        window._qbankAdmAllPapers = papers;
        qbankAdmApplyFilter();
      } catch (e) {
        listEl.innerHTML = '<p style="color:#f87171;font-size:13px;text-align:center;padding:16px;">❌ ' + e.message + '</p>';
      }
    };

    window.filterQBankBySemester = (sem) => {
      window._qbankActiveFilterSem = sem;
      document.querySelectorAll('.qbank-filter-btn').forEach(btn => {
        if (btn.getAttribute('data-sem') === sem) {
          btn.style.background = 'linear-gradient(135deg,#0891b2 0%,#06b6d4 100%)';
          btn.style.color = 'white';
          btn.style.border = 'none';
          btn.style.boxShadow = '0 2px 8px rgba(8,145,178,0.2)';
          btn.classList.add('qbank-active-filter');
        } else {
          btn.style.background = '#ffffff';
          btn.style.color = '#0891b2';
          btn.style.border = '1.5px solid #a5f3fc';
          btn.style.boxShadow = 'none';
          btn.classList.remove('qbank-active-filter');
        }
      });
      qbankAdmApplyFilter();
    };

    function qbankAdmApplyFilter() {
      const sem = window._qbankActiveFilterSem;
      const papers = window._qbankAdmAllPapers || [];
      const filtered = sem === 'all' ? papers : papers.filter(p => p.sem === sem);
      qbankAdmRenderSubjectGrid(filtered);
    }

    const qbankColors = [
      { bg: 'linear-gradient(135deg,#ecfeff,#cffafe)', border: '#a5f3fc', text: '#0891b2', glow: 'rgba(8,145,178,0.15)', icon: '📖' },
      { bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '#bbf7d0', text: '#16a34a', glow: 'rgba(22,163,74,0.15)', icon: '📚' },
      { bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '#ddd6fe', text: '#7c3aed', glow: 'rgba(124,58,237,0.15)', icon: '📔' },
      { bg: 'linear-gradient(135deg,#fff7ed,#ffedd5)', border: '#fdba74', text: '#ea580c', glow: 'rgba(234,88,12,0.15)', icon: '📃' },
      { bg: 'linear-gradient(135deg,#fff1f2,#ffe4e6)', border: '#fca5a5', text: '#dc2626', glow: 'rgba(220,38,38,0.15)', icon: '📋' },
      { bg: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', border: '#7dd3fc', text: '#0284c7', glow: 'rgba(2,132,199,0.15)', icon: '🗃️' },
      { bg: 'linear-gradient(135deg,#fdf2f8,#fce7f3)', border: '#f9a8d4', text: '#db2777', glow: 'rgba(219,39,119,0.15)', icon: '📑' }
    ];

    function qbankAdmRenderSubjectGrid(papers) {
      const list = document.getElementById('qbank-adm-list');
      if (!list) return;
      if (!papers.length) {
        list.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">No Question Banks uploaded yet.</p>';
        return;
      }
      const grouped = {};
      papers.forEach(n => { const s = n.subject || 'General'; if (!grouped[s]) grouped[s] = []; grouped[s].push(n); });
      const subjects = Object.keys(grouped).sort();
      let html = '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:12px;">📂 ' + subjects.length + ' subject' + (subjects.length > 1 ? 's' : '') + ' · 📜 ' + papers.length + ' Q-Bank' + (papers.length > 1 ? 's' : '') + '</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
      subjects.forEach((subj, si) => {
        const col = qbankColors[si % qbankColors.length];
        const cnt = grouped[subj].length;
        html += '<button onclick="qbankAdmOpenSubject(\'' + subj.replace(/'/g, "\\'") + '\',' + si + ')" style="text-align:left;background:' + col.bg + ';border:1.5px solid ' + col.border + ';border-radius:12px;padding:12px;cursor:pointer;position:relative;overflow:hidden;transition:box-shadow 0.2s;display:flex;align-items:center;gap:10px;" onmouseover="this.style.boxShadow=\'0 0 12px ' + col.glow + '\'" onmouseout="this.style.boxShadow=\'\'">' +
          '<div style="font-size:22px;flex-shrink:0;">📚</div>' +
          '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:800;color:' + col.text + ';line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(subj) + '</div>' +
          '<div style="font-size:10px;color:var(--text-secondary);margin-top:2px;">' + cnt + ' Q-Bank' + (cnt > 1 ? 's' : '') + '</div></div>' +
          '<div style="font-size:12px;opacity:0.4;color:' + col.text + ';flex-shrink:0;">→</div></button>';
      });
      html += '</div>';
      list.innerHTML = html;
    }

    window.qbankAdmOpenSubject = (subj, colorIdx) => {
      const papers = (window._qbankAdmAllPapers || []).filter(n => (n.subject || 'General') === subj);
      const col = qbankColors[colorIdx % qbankColors.length];
      document.getElementById('qbank-adm-screen-subjects').style.display = 'none';
      document.getElementById('qbank-adm-screen-detail').style.display = '';
      const titleEl = document.getElementById('qbank-adm-detail-title');
      titleEl.innerHTML = '<span style="color:' + col.text + ';">📚 ' + esc(subj) + '</span> <span style="font-size:12px;color:var(--text-secondary);font-weight:400;">(' + papers.length + ' Q-Bank' + (papers.length > 1 ? 's' : '') + ')</span>';
      const detailList = document.getElementById('qbank-adm-detail-list');
      detailList.innerHTML = papers.map(n =>
        '<div style="display:flex;align-items:center;gap:10px;background:#ecfeff;border:1px solid #a5f3fc;border-radius:12px;padding:12px 14px;margin-bottom:8px;flex-wrap:wrap;border-left:3px solid ' + col.text + ';">' +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:5px;">' + esc(n.title) + '</div>' +
        '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;">Year ' + esc(n.year) + ' \u00b7 Sem ' + esc(n.sem) + (n.fileSize ? ' \u00b7 ' + (n.fileSize / 1024).toFixed(0) + ' KB' : '') + '</div>' +
        '<span style="padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;background:' + col.bg + ';border:1px solid ' + col.border + ';color:' + col.text + ';">' + ((n.section || 'all') === 'all' ? 'All Sections' : 'Section ' + n.section) + '</span></div>' +
        '<div style="display:flex;gap:6px;flex-shrink:0;">' +
        '<button onclick="qbankAdmView(\'' + n.id + '\')" id="qbank-view-adm-' + n.id + '" style="padding:7px 12px;background:' + col.bg + ';border:1.5px solid ' + col.border + ';border-radius:9px;color:' + col.text + ';font-weight:700;font-size:12px;cursor:pointer;">👁️ View</button>' +
        '<button onclick="qbankAdmDelete(\'' + n.id + '\')" style="padding:7px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:9px;color:#f87171;font-weight:700;font-size:12px;cursor:pointer;">🗑️ Delete</button>' +
        '</div></div>'
      ).join('');
    };

    window.qbankAdmBackToSubjects = () => {
      document.getElementById('qbank-adm-screen-detail').style.display = 'none';
      document.getElementById('qbank-adm-screen-subjects').style.display = '';
    };

    window.qbankAdmView = async function (id) {
      const btn = document.getElementById('qbank-view-adm-' + id);
      const orig = btn ? btn.innerHTML : '';
      if (btn) { btn.innerHTML = '⏳…'; btn.disabled = true; }
      try {
        const blob = await fetchQBankBlob(id);
        const url = URL.createObjectURL(blob);
        window._openPdfViewer(url, 'Question Bank – ' + id);
      } catch (e) { alert('Error: ' + e.message); }
      finally { if (btn) { btn.innerHTML = orig; btn.disabled = false; } }
    };

    window.qbankAdmDelete = async function (id) {
      if (!confirm('Delete this Question Bank? This cannot be undone.')) return;
      try {
        const chunksSnap = await getDocs(collection(db, 'qbank_papers', id, 'chunks'));
        if (!chunksSnap.empty) {
          const b = writeBatch(db);
          chunksSnap.forEach(d => b.delete(d.ref));
          await b.commit();
        }
        await deleteDoc(doc(db, 'qbank_papers', id));
        document.getElementById('qbank-adm-screen-detail').style.display = 'none';
        document.getElementById('qbank-adm-screen-subjects').style.display = '';
        qbankAdmLoadAll();
      } catch (e) { alert('Error deleting: ' + e.message); }
    };
