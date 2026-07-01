import { auth, db } from '../core/firebase.js';
import { doc, setDoc, getDoc, addDoc, collection, query, where, getDocs, orderBy, deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { $, val, base64ToBlob, esc, PdfDbCache, jsEsc, readFileBase64, getStudentProfile, API_BASE_URL } from '../core/helpers.js';

const CHUNK_SIZE = 700 * 1024;
let admSelectedFiles = [];
let allStudentNotes = [];
window.allStudentNotes = allStudentNotes;
let lastNotesFetchTime = 0;

    // ─── ADMIN DRAG & DROP ───
    window.admDragOver = e => {
      e.preventDefault();
      const z = document.getElementById('adm-upload-zone');
      if (z) { z.style.borderColor = '#4f46e5'; z.style.background = 'rgba(79,70,229,0.04)'; }
    };
    window.admDragLeave = () => {
      const z = document.getElementById('adm-upload-zone');
      if (z) { z.style.borderColor = '#c7d2fe'; z.style.background = '#ffffff'; }
    };
    window.admDropFile = async e => {
      e.preventDefault(); admDragLeave();
      if (!e.dataTransfer.items) return;
      const entries = Array.from(e.dataTransfer.items);
      const files = await getAllFilesFromEntries(entries);
      if (files.length > 0) admHandleFiles(files);
    };

    async function getAllFilesFromEntries(items) {
      const files = [];
      async function recurse(entry) {
        if (entry.isFile) {
          const file = await new Promise((res) => entry.file(res));
          if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) files.push(file);
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          const readEntries = () => new Promise((res) => reader.readEntries(res));
          let results = await readEntries();
          while (results.length > 0) {
            for (const res of results) await recurse(res);
            results = await readEntries();
          }
        }
      }
      for (const item of items) {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : item;
        if (entry) await recurse(entry);
      }
      return files;
    }

    window.admFileSelected = e => {
      const files = Array.from(e.target.files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      if (files.length === 0 && e.target.files.length > 0) {
        alert('Please select PDF files.');
        return;
      }
      admHandleFiles(files);
    };

    function admHandleFiles(files) {
      admSelectedFiles = files;
      const count = files.length;
      const listEl = document.getElementById('adm-selected-list');
      const container = document.getElementById('adm-files-container');
      const countEl = document.getElementById('adm-selected-count');
      const uzIcon = document.getElementById('adm-uz-icon');
      const uzText = document.getElementById('adm-uz-text');
      const uzSub = document.getElementById('adm-uz-sub');

      if (count === 0) {
        listEl.style.display = 'none';
        uzIcon.textContent = '📄';
        uzText.textContent = 'Click to select Files or Drag & Drop Folder';
        return;
      }

      listEl.style.display = 'block';
      countEl.textContent = `${count} file${count > 1 ? 's' : ''}`;
      container.innerHTML = '';

      files.forEach((f, i) => {
        if (i < 10) { // Limit display to first 10
          const div = document.createElement('div');
          div.style = 'display:flex;justify-content:space-between;background:#f7f8fc;padding:6px 10px;border-radius:8px;border:1px solid #e5e7eb;';
          div.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80%;">${f.name}</span>
                         <span style="color:var(--text-secondary);font-size:10px;">${(f.size / 1024).toFixed(1)} KB</span>`;
          container.appendChild(div);
        }
      });
      if (count > 10) {
        const more = document.createElement('div');
        more.style = 'text-align:center;color:var(--text-secondary);font-style:italic;padding-top:4px;';
        more.textContent = `... and ${count - 10} more`;
        container.appendChild(more);
      }

      uzIcon.textContent = '✅';
      uzText.textContent = count === 1 ? files[0].name : `${count} files selected`;
      uzSub.textContent = `Ready to upload ✓`;

      // Auto-fill Title if single file
      if (count === 1) {
        document.getElementById('adm-title').value = files[0].name.replace(/\.[^/.]+$/, "");
      } else {
        document.getElementById('adm-title').placeholder = 'Multiple files: Filenames will be used';
      }
    }

    // ─── ADMIN UPLOAD → Firestore Chunks ───
    window.admUploadNote = async () => {
      const subject = document.getElementById('adm-subject').value.trim();
      const titleInput = document.getElementById('adm-title').value.trim();
      const desc = document.getElementById('adm-desc').value.trim();
      const year = document.getElementById('adm-year').value;
      const sem = document.getElementById('adm-sem').value;
      const dept = document.getElementById('adm-dept').value;
      const sec = admGetSelectedSections();

      if (admSelectedFiles.length === 0) { admShowMsg('⚠️ Please select at least one PDF file.', '#f87171'); return; }
      if (!subject || !year || !sem || !dept) { admShowMsg('⚠️ Fill in Subject, Year, Semester and Department.', '#f87171'); return; }
      if (admSelectedFiles.length === 1 && !titleInput) { admShowMsg('⚠️ Please provide a Note Title.', '#f87171'); return; }

      const btn = document.getElementById('adm-btn-upload');
      btn.disabled = true; btn.textContent = '⏳ Uploading…';
      const pw = document.getElementById('adm-prog-wrap');
      pw.style.display = 'block';
      setProgBar(0);

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < admSelectedFiles.length; i++) {
        const currentFile = admSelectedFiles[i];
        const currentTitle = admSelectedFiles.length === 1 ? titleInput : (currentFile.name.replace(/\.[^/.]+$/, ""));

        const fileProgressBase = (i / admSelectedFiles.length) * 100;
        const fileWeight = 100 / admSelectedFiles.length;

        admShowMsg(`📖 Reading [${i + 1}/${admSelectedFiles.length}] ${currentFile.name}…`, '#6366f1');

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
                const cr = doc(collection(db, 'techbook_notes', metaRefId, 'chunks'), String(j).padStart(5, '0'));
                bN.set(cr, { idx: j, data: chunks[j] });
                batchBytes += chunkBytes;
                added++;
                j++;
              }
              await bN.commit();
              batchStart = j;

              const chunkProgress = batchStart / chunks.length;
              const fileInternalProgress = (10 + (90 * (sectionIdx + chunkProgress) / totalSections));
              setProgBar(Math.round(fileProgressBase + (fileInternalProgress * fileWeight / 100)));
              admShowMsg(`📤 Uploading [${i + 1}/${admSelectedFiles.length}] ${currentFile.name}…`, '#6366f1');
            }
          }

          for (let si = 0; si < sections.length; si++) {
            const metaRef = await addDoc(collection(db, 'techbook_notes'), {
              subject, title: currentTitle, desc, year, sem, dept, section: sections[si],
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

      setProgBar(100);
      setTimeout(() => { pw.style.display = 'none'; setProgBar(0); }, 800);

      if (failCount === 0) {
        admShowMsg(`✅ ${successCount} note${successCount > 1 ? 's' : ''} uploaded successfully!`, '#3d5af1');

        // ── Send email notifications to eligible students ──
        try {
          const dept = document.getElementById('adm-dept')?.value || '';
          fetch(`${API_BASE_URL}/api/notify-upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contentType: 'Notes',
              subject,
              title: titleInput || subject,
              dept: dept || 'All',
              year,
              sem,
              section: sec
            })
          }).then(r => r.json()).then(d => {
            if (d.success && d.sentCount > 0) {
              admShowMsg(`✅ ${successCount} note${successCount > 1 ? 's' : ''} uploaded. 📧 ${d.sentCount} students notified!`, '#3d5af1');
            }
          }).catch(() => {});
        } catch (e) { /* silent fail */ }

      } else {
        admShowMsg(`⚠️ Uploaded ${successCount}, failed ${failCount}.`, '#f59e0b');
      }

      admResetForm();
      btn.disabled = false; btn.textContent = '🚀 Upload Note';
      if (typeof admLoadAllNotes === 'function') admLoadAllNotes();
    };

    function setProgBar(val) {
      const pb = document.getElementById('adm-prog-bar');
      if (pb) pb.style.width = val + '%';
    }

    function admShowMsg(txt, col) {
      const m = document.getElementById('adm-upload-msg');
      if (m) { m.textContent = txt; m.style.color = col; }
    }


    window.admResetForm = () => {
      ['adm-subject', 'adm-title', 'adm-desc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      ['adm-year', 'adm-sem'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      // Reset section checkboxes
      const allCb = document.getElementById('adm-sec-all');
      if (allCb) { allCb.checked = true; }
      document.querySelectorAll('.adm-sec-cb').forEach(cb => cb.checked = false);
      if (typeof admUpdateSecLabel === 'function') admUpdateSecLabel();

      const fi = document.getElementById('adm-file-input'); if (fi) fi.value = '';
      const fo = document.getElementById('adm-folder-input'); if (fo) fo.value = '';
      admSelectedFiles = [];

      const listEl = document.getElementById('adm-selected-list'); if (listEl) listEl.style.display = 'none';
      const uzIcon = document.getElementById('adm-uz-icon'); if (uzIcon) uzIcon.textContent = '📄';
      const uzText = document.getElementById('adm-uz-text'); if (uzText) uzText.textContent = 'Click to select Files or Drag & Drop Folder';
      const uzSub = document.getElementById('adm-uz-sub'); if (uzSub) uzSub.textContent = 'PDF files only · Multiple files & Folders supported ✓';
    };

    // ─── RECONSTRUCT PDF FROM CHUNKS ───

    async function fetchChunksRest(collectionName, docId) {
      const projectId = "attendance-system-54b30";
      const apiKey = "AIzaSyC-aoJvlXHec3XQojpD1eKPvOQtYwCL0gI";
      let docs = [];
      let pageToken = '';
      
      do {
        let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${docId}/chunks?key=${apiKey}&pageSize=300`;
        if (pageToken) {
          url += `&pageToken=${pageToken}`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error(`REST fetch failed with status ${res.status}`);
        const data = await res.json();
        if (data.documents) {
          docs = docs.concat(data.documents);
        }
        pageToken = data.nextPageToken || '';
      } while (pageToken);

      if (docs.length === 0) throw new Error("No chunks found");
      docs.sort((a, b) => {
        const idxA = parseInt(a.fields?.idx?.integerValue || a.fields?.idx?.stringValue || "0", 10);
        const idxB = parseInt(b.fields?.idx?.integerValue || b.fields?.idx?.stringValue || "0", 10);
        return idxA - idxB;
      });
      return docs.map(d => d.fields?.data?.stringValue || "");
    }

    async function validatePdfBlob(blob, type, id) {
      if (!blob || !(blob instanceof Blob)) return null;
      try {
        const header = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const arr = new Uint8Array(reader.result);
            let str = '';
            for (let i = 0; i < Math.min(arr.length, 5); i++) {
              str += String.fromCharCode(arr[i]);
            }
            resolve(str);
          };
          reader.onerror = () => resolve('');
          reader.readAsArrayBuffer(blob.slice(0, 5));
        });
        if (header === '%PDF-') return blob;
        console.warn(`🗑️ Corrupt PDF cache header ("${header}") for ${type}_${id}, deleting cache entry.`);
        try {
          await PdfDbCache.init();
          if (PdfDbCache.db) {
            const tx = PdfDbCache.db.transaction('pdfs', 'readwrite');
            tx.objectStore('pdfs').delete(`${type}_${id}`);
          }
        } catch (_) {}
      } catch (e) {
        console.error("Cache validation error:", e);
      }
      return null;
    }

    async function fetchPdfBlob(noteId) {
      // Bypass cache to prevent loading corrupted local entries

      let parts = [];
      let noteMeta = allStudentNotes.find(n => n.id === noteId);
      if (!noteMeta && window._admAllNotes) {
        noteMeta = window._admAllNotes.find(n => n.id === noteId);
      }
      if (!noteMeta) {
        try {
          const metaSnap = await getDoc(doc(db, 'techbook_notes', noteId));
          if (metaSnap.exists()) noteMeta = metaSnap.data();
        } catch (_) {}
      }

      try {
        console.log(`🚀 Attempting fast REST fetch for note chunks: ${noteId}`);
        parts = await fetchChunksRest('techbook_notes', noteId);
      } catch (restErr) {
        console.warn(`REST chunk fetch failed, falling back to Firestore SDK:`, restErr);
        const chunksSnap = await getDocs(
          query(collection(db, 'techbook_notes', noteId, 'chunks'), orderBy('idx', 'asc'))
        );
        if (chunksSnap.empty) throw new Error('No chunks found for this note');
        chunksSnap.forEach(d => parts.push(d.data().data));
      }

      const blob = base64ToBlob(parts.join(''), 'application/pdf');

      try {
        await PdfDbCache.set('note', noteId, blob);
      } catch (ce) { console.warn('Cache write error:', ce); }

      return blob;
    }

    // ─── ADMIN: LOAD ALL NOTES ───
    window.admLoadAllNotes = async () => {
      const list = document.getElementById('adm-notes-list');
      if (!list) return;
      list.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:16px;">⏳ Loading…</p>';
      try {
        const snap = await getDocs(query(collection(db, 'techbook_notes'), orderBy('uploadedAt', 'desc')));
        const notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!notes.length) {
          list.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:16px;">No notes uploaded yet.</p>';
          return;
        }
        // Store all notes globally for admin subject nav
        window._admAllNotes = notes;
        admRenderSubjectGrid(notes);
      } catch (e) {
        list.innerHTML = `<p style="color:#f87171;text-align:center;padding:16px;">Error: ${esc(e.message)}</p>`;
      }
    };

    function admRenderSubjectGrid(notes) {
      const list = document.getElementById('adm-notes-list');
      if (!list) return;
      if (!notes.length) {
        list.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">No notes uploaded yet.</p>';
        return;
      }
      const grouped = {};
      notes.forEach(n => { const s = n.subject || 'General'; if (!grouped[s]) grouped[s] = []; grouped[s].push(n); });
      const subjects = Object.keys(grouped).sort();
      let html = '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:12px;">📂 ' + subjects.length + ' subject' + (subjects.length > 1 ? 's' : '') + ' · 📜 ' + notes.length + ' note' + (notes.length > 1 ? 's' : '') + '</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
      subjects.forEach((subj, si) => {
        const col = subjectColors[si % subjectColors.length];
        const cnt = grouped[subj].length;
        html += '<button onclick="admOpenSubject(\'' + subj.replace(/'/g, "\\'") + '\',' + si + ')" style="text-align:left;background:' + col.bg + ';border:1.5px solid ' + col.border + ';border-radius:12px;padding:12px;cursor:pointer;position:relative;overflow:hidden;transition:box-shadow 0.2s;display:flex;align-items:center;gap:10px;" onmouseover="this.style.boxShadow=\'0 0 12px ' + col.glow + '\'" onmouseout="this.style.boxShadow=\'\'">' +
          '<div style="font-size:22px;flex-shrink:0;">' + col.icon + '</div>' +
          '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:800;color:' + col.text + ';line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(subj) + '</div>' +
          '<div style="font-size:10px;color:var(--text-secondary);margin-top:2px;">' + cnt + ' note' + (cnt > 1 ? 's' : '') + '</div></div>' +
          '<div style="font-size:12px;opacity:0.4;color:' + col.text + ';flex-shrink:0;">→</div></button>';
      });
      html += '</div>';
      list.innerHTML = html;
    }

    window.admOpenSubject = (subj, colorIdx) => {
      const papers = (window._admAllNotes || []).filter(n => (n.subject || 'General') === subj);
      const col = subjectColors[colorIdx % subjectColors.length];
      document.getElementById('adm-screen-subjects').style.display = 'none';
      document.getElementById('adm-screen-detail').style.display = '';
      const titleEl = document.getElementById('adm-detail-title');
      titleEl.innerHTML = '<span style="color:' + col.text + ';">' + col.icon + ' ' + esc(subj) + '</span> <span style="font-size:12px;color:var(--text-secondary);font-weight:400;">(' + papers.length + ' note' + (papers.length > 1 ? 's' : '') + ')</span>';
      const detailList = document.getElementById('adm-detail-list');

      const nowMs = Date.now();
      const thresholdMs = 3 * 24 * 60 * 60 * 1000;
      const latest = [], earlier = [];
      papers.forEach(n => {
        if (n.uploadedAt && (nowMs - n.uploadedAt.seconds * 1000) < thresholdMs) latest.push(n);
        else earlier.push(n);
      });

      const renderNoteCard = (n) =>
        '<div style="display:flex;align-items:center;gap:10px;background:#f7f8fc;border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;margin-bottom:8px;flex-wrap:wrap;border-left:3px solid ' + col.text + ';">' +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:5px;">' + esc(n.title) + '</div>' +
        '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;">Year ' + esc(n.year) + ' \u00b7 Sem ' + esc(n.sem) + (n.fileSize ? ' \u00b7 ' + (n.fileSize / 1024).toFixed(0) + ' KB' : '') + '</div>' +
        '<span style="padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;background:' + col.bg + ';border:1px solid ' + col.border + ';color:' + col.text + ';">' + ((n.section || 'all') === 'all' ? 'All Sections' : 'Section ' + n.section) + '</span></div>' +
        '<div style="display:flex;gap:6px;flex-shrink:0;">' +
        '<button onclick="admViewNote(\'' + n.id + '\')" id="view-adm-' + n.id + '" style="padding:7px 12px;background:' + col.bg + ';border:1.5px solid ' + col.border + ';border-radius:9px;color:' + col.text + ';font-weight:700;font-size:12px;cursor:pointer;">👁️ View</button>' +
        '<button onclick="admEditNoteTitle(\'' + n.id + '\',\'' + n.title.replace(/'/g, "\\'") + '\',' + colorIdx + ')" style="padding:7px 12px;background:' + col.bg + ';border:1.5px solid ' + col.border + ';border-radius:9px;color:' + col.text + ';font-weight:700;font-size:12px;cursor:pointer;">✏️ Edit</button>' +
        '<button onclick="admDeleteNote(\'' + n.id + '\',\'' + n.title.replace(/'/g, "\\'") + '\')" style="padding:7px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:9px;color:#f87171;font-weight:700;font-size:12px;cursor:pointer;">🗑️ Delete</button>' +
        '</div></div>';

      let html = '';
      if (latest.length > 0) {
        html += '<div style="font-size:12px;font-weight:800;color:' + col.text + ';margin:5px 0 12px;display:flex;align-items:center;gap:6px;text-transform:uppercase;letter-spacing:0.5px;">✨ Latest Uploads <span style="background:' + col.bg + ';padding:1px 8px;border-radius:10px;font-size:10px;border:1px solid ' + col.border + ';color:' + col.text + ';">' + latest.length + '</span></div>';
        html += latest.map(renderNoteCard).join('');
        if (earlier.length > 0) {
          html += '<div style="font-size:12px;font-weight:800;color:var(--text-secondary);margin:24px 0 12px;text-transform:uppercase;letter-spacing:0.5px;opacity:0.6;">Recent Uploads</div>';
        }
      }
      html += earlier.map(renderNoteCard).join('');
      detailList.innerHTML = html || '<p style="text-align:center;padding:20px;color:var(--text-secondary);">No notes available for this selection.</p>';
    };

    window.admEditNoteTitle = async (id, currentTitle, colorIdx) => {
      const newTitle = prompt("Edit Note Title:", currentTitle);
      if (newTitle === null) return;
      const trimmed = newTitle.trim();
      if (!trimmed) return alert("Title cannot be empty!");
      try {
        const noteRef = doc(db, 'techbook_notes', id);
        await setDoc(noteRef, { title: trimmed }, { merge: true });
        if (window._admAllNotes) {
          const idx = window._admAllNotes.findIndex(n => n.id === id);
          if (idx !== -1) window._admAllNotes[idx].title = trimmed;
        }
        alert("✓ Title updated successfully!");
        const note = window._admAllNotes ? window._admAllNotes.find(n => n.id === id) : null;
        if (note) {
          window.admOpenSubject(note.subject || 'General', colorIdx);
        }
      } catch (err) {
        alert("Error updating title: " + err.message);
      }
    };

    function admBackToSubjects() {
      document.getElementById('adm-screen-detail').style.display = 'none';
      document.getElementById('adm-screen-subjects').style.display = '';
    }
    window.admBackToSubjects = admBackToSubjects;
    window._impl_admBackToSubjects = admBackToSubjects;
    window.admRenderSubjectGrid = admRenderSubjectGrid;

    // Filter notes by semester
    window.filterNotesBySemester = (semester) => {
      // Update button styles
      const buttons = document.querySelectorAll('.sem-filter-btn');
      buttons.forEach(btn => {
        if (btn.getAttribute('data-sem') === semester) {
          btn.style.background = 'linear-gradient(135deg,#3d5af1 0%,#6366f1 100%)';
          btn.style.color = 'white';
          btn.style.border = 'none';
          btn.style.boxShadow = '0 2px 8px rgba(61,90,241,0.2)';
          btn.classList.add('active-filter');
        } else {
          btn.style.background = '#ffffff';
          btn.style.color = '#3d5af1';
          btn.style.border = '1.5px solid #c7d2fe';
          btn.style.boxShadow = '';
          btn.classList.remove('active-filter');
        }
      });

      // Filter and render notes
      const allNotes = window._admAllNotes || [];
      let filteredNotes;

      if (semester === 'all') {
        filteredNotes = allNotes;
      } else {
        filteredNotes = allNotes.filter(note => String(note.sem) === semester);
      }

      // Render the filtered notes
      admRenderSubjectGrid(filteredNotes);
    };

    window.admViewNote = async (id) => {
      const btn = document.getElementById('view-adm-' + id);
      if (btn) { btn.textContent = '⏳…'; btn.disabled = true; }
      try {
        let title = 'Note';
        if (window._admAllNotes) {
          const p = window._admAllNotes.find(n => n.id === id);
          if (p && p.title) title = p.title;
        }
        const blob = await fetchPdfBlob(id);
        const url = URL.createObjectURL(blob);
        window._openPdfViewer(url, title);
      } catch (e) { alert('Error loading PDF: ' + e.message); }
      finally { if (btn) { btn.textContent = '👁️ View'; btn.disabled = false; } }
    };

    // Delete a group of notes (same title, multiple sections)
    window.admDeleteGroupNote = async (ids, title) => {
      const idArr = Array.isArray(ids) ? ids : [ids];
      if (!confirm(`Delete "${title}" for ${idArr.length} section${idArr.length > 1 ? 's' : ''}?`)) return;
      try {
        for (const id of idArr) {
          const chunksSnap = await getDocs(collection(db, 'techbook_notes', id, 'chunks'));
          const refs = [];
          chunksSnap.forEach(d => refs.push(d.ref));
          for (let i = 0; i < refs.length; i += 490) {
            const b = writeBatch(db);
            refs.slice(i, i + 490).forEach(r => b.delete(r));
            await b.commit();
          }
          await deleteDoc(doc(db, 'techbook_notes', id));
        }
        window._admAllNotes = (window._admAllNotes || []).filter(n => !idArr.includes(n.id));
        admRenderSubjectGrid(window._admAllNotes);
        admBackToSubjects();
      } catch (e) { alert('Delete failed: ' + e.message); }
    };

    window.admDeleteNote = async (id, title) => {
      if (!confirm(`Delete "${title}"? This will also delete all chunks.`)) return;
      try {
        // Delete chunks subcollection in batches of 490
        const chunksSnap = await getDocs(collection(db, 'techbook_notes', id, 'chunks'));
        const chunkDocs = [];
        chunksSnap.forEach(d => chunkDocs.push(d.ref));
        // Delete in batches of 490 (Firestore limit)
        for (let i = 0; i < chunkDocs.length; i += 490) {
          const b = writeBatch(db);
          chunkDocs.slice(i, i + 490).forEach(ref => b.delete(ref));
          await b.commit();
        }
        // Delete metadata doc
        await deleteDoc(doc(db, 'techbook_notes', id));
        // Refresh admin view
        window._admAllNotes = (window._admAllNotes || []).filter(n => n.id !== id);
        admRenderSubjectGrid(window._admAllNotes);
        // Go back to subject grid
        admBackToSubjects();
      } catch (e) { alert('Delete failed: ' + e.message); }
    };

    // ─── STUDENT: LOAD NOTES ───
    window.studentLoadNotes = async () => {
      const grid = document.getElementById('sn-subject-grid');
      const hasCache = allStudentNotes && allStudentNotes.length > 0;

      const now = Date.now();
      if (hasCache && (now - lastNotesFetchTime < 60000)) {
        studentFilterNotes();
        return;
      }

      if (!hasCache && grid) {
        grid.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:32px;margin-bottom:8px;">⏳</div><div style="color:var(--text-secondary);font-size:13px;">Loading notes…</div></div>';
      }
      
      if (!hasCache) {
        const det = document.getElementById('sn-screen-detail');
        const subj = document.getElementById('sn-screen-subjects');
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
              const yEl = document.getElementById('sn-year');
              const sEl = document.getElementById('sn-sem');
              const cEl = document.getElementById('sn-sec');
              if (yEl && year) yEl.value = year;
              if (sEl && sem) sEl.value = sem;
              if (cEl && sec && sec.length === 1) cEl.value = sec.toUpperCase();
              const banner = document.getElementById('sn-autofill-banner');
              const label = document.getElementById('sn-autofill-label');
              if (banner && label && (year || sem || sec)) {
                label.textContent = [year ? 'Year ' + year : '', sem ? 'Sem ' + sem : '', sec ? 'Section ' + sec : ''].filter(Boolean).join(' · ');
                banner.style.display = '';
              }
            }
          } catch (_) { }
        }

        if (hasCache) {
          studentFilterNotes();
        }

        const snap = await getDocs(query(collection(db, 'techbook_notes'), orderBy('uploadedAt', 'desc')));
        const newNotes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const changed = JSON.stringify(allStudentNotes) !== JSON.stringify(newNotes);
        if (changed || !hasCache) {
          allStudentNotes = newNotes;
          window.allStudentNotes = allStudentNotes;
          studentFilterNotes();
        }
        lastNotesFetchTime = now;
      } catch (e) {
        if (!hasCache && grid) {
          grid.innerHTML = `<p style="color:#f87171;text-align:center;padding:20px;">Error: ${esc(e.message)}</p>`;
        }
      }
    };

    window.studentFilterNotes = () => {
      const year = document.getElementById('sn-year')?.value || '';
      const sem = document.getElementById('sn-sem')?.value || '';
      const sec = document.getElementById('sn-sec')?.value || '';
      const filtered = allStudentNotes.filter(n => {
        if (year && n.year !== year) return false;
        if (sem && n.sem !== sem) return false;
        if (sec) {
          // n.section can be 'all', 'A', 'B', or 'A,B,C' (comma-separated)
          const noteSecs = (n.section || 'all').split(',').map(s => s.trim());
          if (!noteSecs.includes('all') && !noteSecs.includes(sec)) return false;
        }
        return true;
      });
      renderStudentNotes(filtered);
    };

    window.studentClearNoteFilters = () => {
      ['sn-year', 'sn-sem', 'sn-sec'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      const banner = document.getElementById('sn-autofill-banner');
      if (banner) banner.style.display = 'none';
      // Go back to subject screen if on detail screen
      const detail = document.getElementById('sn-screen-detail');
      const subjs = document.getElementById('sn-screen-subjects');
      if (detail) detail.style.display = 'none';
      if (subjs) subjs.style.display = '';
      studentFilterNotes();
    };

    // ─── SUBJECT BUTTON GRID ───
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

    // Global lookup so onclick only needs the index — no string-escaping issues
    window._snSubjectList = [];

    function renderSubjectGrid(notes) {
      const grid = document.getElementById('sn-subject-grid');
      if (!grid) return;

      if (!notes.length) {
        grid.innerHTML = '<div style="text-align:center;padding:50px 20px;"><div style="font-size:56px;margin-bottom:14px;opacity:0.4;">📭</div><div style="font-size:15px;font-weight:700;color:var(--text-secondary);">No Notes Found</div><div style="font-size:13px;color:rgba(139,168,204,0.4);margin-top:6px;">Try different filters or check back later.</div></div>';
        return;
      }

      // Group by subject
      const grouped = {};
      notes.forEach(n => { const s = n.subject || 'General'; if (!grouped[s]) grouped[s] = []; grouped[s].push(n); });
      const subjects = Object.keys(grouped).sort();
      window._snSubjectList = subjects; // store for index-based onclick

      const totalNotes = notes.length;
      let html = '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:14px;">📂 ' +
        subjects.length + ' subject' + (subjects.length > 1 ? 's' : '') + ' · 📄 ' + totalNotes + ' note' + (totalNotes > 1 ? 's' : '') +
        '</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">';

      subjects.forEach((subj, si) => {
        const col = subjectColors[si % subjectColors.length];
        const sNotes = grouped[subj];
        const count = sNotes.length;
        const dates = sNotes.filter(n => n.uploadedAt).map(n => n.uploadedAt.seconds);
        const latest = dates.length ? new Date(Math.max(...dates) * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '';

        html += '<button onclick="snOpenSubjectByIdx(' + si + ')" ' +
          'style="text-align:center;background:' + col.bg + ';border:1.5px solid ' + col.border + ';' +
          'border-radius:14px;padding:10px 6px 9px;cursor:pointer;transition:all 0.22s;' +
          'box-shadow:0 1px 4px ' + col.glow + ';" ' +
          'onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 8px 20px ' + col.glow + '\'" ' +
          'onmouseout="this.style.transform=\'\';this.style.boxShadow=\'0 1px 4px ' + col.glow + '\'">' +
          '<div style="font-size:20px;margin-bottom:5px;">' + col.icon + '</div>' +
          '<div style="font-size:9.5px;font-weight:800;color:' + col.text + ';line-height:1.3;margin-bottom:4px;' +
          'overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word;">' + esc(subj) + '</div>' +
          '<div style="display:inline-flex;align-items:center;background:rgba(0,0,0,0.06);border-radius:20px;padding:1px 7px;">' +
          '<span style="font-size:8px;font-weight:700;color:' + col.text + ';">' + count + ' note' + (count > 1 ? 's' : '') + '</span></div>' +
          (latest ? '<div style="font-size:7.5px;color:' + col.text + ';opacity:0.5;margin-top:3px;">' + latest + '</div>' : '') +
          '</button>';
      });

      html += '</div>';
      grid.innerHTML = html;
    }

    // Index-based opener — avoids all string-escaping issues
    window.snOpenSubjectByIdx = (idx) => {
      const subj = window._snSubjectList[idx];
      if (subj !== undefined) snOpenSubject(subj, idx);
    };


    window.snOpenSubject = (subj, colorIdx) => {
      const col = subjectColors[colorIdx % subjectColors.length];
      const year = document.getElementById('sn-year')?.value || '';
      const sem = document.getElementById('sn-sem')?.value || '';
      const sec = document.getElementById('sn-sec')?.value || '';
      const notes = allStudentNotes.filter(n => {
        if ((n.subject || 'General') !== subj) return false;
        if (year && n.year !== year) return false;
        if (sem && n.sem !== sem) return false;
        const nSec = (n.section || 'all').toLowerCase().trim();
        if (nSec === 'all') return true;
        if (!sec) return true;
        return nSec.split(',').map(s => s.trim()).includes(sec.toLowerCase().trim());
      });

      // Show detail screen
      document.getElementById('sn-screen-subjects').style.display = 'none';
      document.getElementById('sn-screen-detail').style.display = '';
      document.getElementById('sn-detail-title').textContent = col.icon + ' ' + subj;
      document.getElementById('sn-detail-title').style.color = col.text;
      document.getElementById('sn-detail-sub').textContent = notes.length + ' note' + (notes.length > 1 ? 's' : '') + ' available';

      const detailList = document.getElementById('sn-detail-list');
      const nowMs = Date.now();
      const thresholdMs = 3 * 24 * 60 * 60 * 1000; // 3 days

      const latest = [], earlier = [];
      notes.forEach(n => {
        if (n.uploadedAt && (nowMs - n.uploadedAt.seconds * 1000) < thresholdMs) latest.push(n);
        else earlier.push(n);
      });

      const renderNoteCard = (n) => `
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
            <button onclick="studentViewNote('${n.id}','${jsEsc(n.fileName || 'note.pdf')}')" data-note-id="${n.id}"
              id="view-btn-${n.id}"
              style="display:inline-flex;align-items:center;gap:6px;padding:9px 18px;
                background:${col.bg};border:1.5px solid ${col.border};
                border-radius:10px;color:${col.text};font-weight:700;font-size:13px;cursor:pointer;">
              👁️ View PDF
            </button>
            <button onclick="studentDownloadNote('${n.id}','${jsEsc(n.fileName || 'note.pdf')}')" data-note-id="${n.id}"
              id="dl-btn-${n.id}"
              style="display:inline-flex;align-items:center;gap:6px;padding:9px 18px;
                background:linear-gradient(135deg,#3d5af1,#6366f1);border:none;
                border-radius:10px;color:#f5f6fa;font-weight:700;font-size:13px;cursor:pointer;">
              ⬇️ Download
            </button>
          </div>
        </div>
      </div>`;

      let html = '';
      if (latest.length > 0) {
        html += `<div style="font-size:12px;font-weight:800;color:${col.text};margin:5px 0 12px;display:flex;align-items:center;gap:6px;text-transform:uppercase;letter-spacing:0.5px;">✨ Latest Uploads <span style="background:${col.bg};padding:1px 8px;border-radius:10px;font-size:10px;border:1px solid ${col.border};">${latest.length}</span></div>`;
        html += latest.map(renderNoteCard).join('');
        if (earlier.length > 0) {
          html += `<div style="font-size:12px;font-weight:800;color:var(--text-secondary);margin:24px 0 12px;text-transform:uppercase;letter-spacing:0.5px;opacity:0.6;">Recent Uploads</div>`;
        }
      }
      html += earlier.map(renderNoteCard).join('');
      detailList.innerHTML = html || '<p style="text-align:center;padding:20px;color:var(--text-secondary);">No notes available for this selection.</p>';
    };

    window.snBackToSubjects = () => {
      document.getElementById('sn-screen-detail').style.display = 'none';
      document.getElementById('sn-screen-subjects').style.display = '';
    };

    // legacy - still needed by filter
    function renderStudentNotes(notes) {
      renderSubjectGrid(notes);
    }

    async function getOrOpenPdf(id, fileName, action = 'view') {
      const vBtn = document.getElementById('view-btn-' + id);
      const dBtn = document.getElementById('dl-btn-' + id);
      const btn = action === 'view' ? vBtn : dBtn;
      const orig = btn ? btn.innerHTML : '';
      if (btn) { btn.innerHTML = '⏳ Loading…'; btn.disabled = true; }
      if (vBtn && action === 'download') vBtn.disabled = true;
      if (dBtn && action === 'view') dBtn.disabled = true;
      try {
        const blob = await fetchPdfBlob(id);
        const url = URL.createObjectURL(blob);
        if (action === 'view') {
          window._openPdfViewer(url, fileName || 'Note');
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

    window.studentViewNote = (id, fn) => getOrOpenPdf(id, fn, 'view');
    window.studentDownloadNote = (id, fn) => getOrOpenPdf(id, fn, 'download');

