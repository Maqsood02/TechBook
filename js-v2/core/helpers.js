import { db } from './firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

export const $ = id => document.getElementById(id);
export const val = id => { const el = $(id); return el ? el.value.trim() : ""; };
export const API_BASE_URL = 'https://tech-book-two.vercel.app';
window.API_BASE_URL = API_BASE_URL;

// PDF Viewer Modal controller
window._currentPdfBlobUrl = null;
var _isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
window._openPdfViewer = function (url, fileName) {
  window._currentPdfBlobUrl = url;
  if (_isMobile) {
    var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); window._currentPdfBlobUrl = null; }, 10000);
    return;
  }
  var tDisp = document.getElementById('pdf-viewer-title'); if (tDisp) tDisp.textContent = fileName || 'PDF Viewer';
  var fFrame = document.getElementById('pdf-viewer-frame'); if (fFrame) fFrame.src = url;
  var mModal = document.getElementById('pdf-viewer-modal'); if (mModal) mModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};
window._closePdfViewer = function () {
  var mModal = document.getElementById('pdf-viewer-modal'); if (mModal) mModal.style.display = 'none';
  var fFrame = document.getElementById('pdf-viewer-frame'); if (fFrame) fFrame.src = '';
  document.body.style.overflow = '';
  if (window._currentPdfBlobUrl) { URL.revokeObjectURL(window._currentPdfBlobUrl); window._currentPdfBlobUrl = null; }
};
window._pdfViewerDownload = function () {
  if (!window._currentPdfBlobUrl) return;
  var a = document.createElement('a'); a.href = window._currentPdfBlobUrl;
  var tDisp = document.getElementById('pdf-viewer-title');
  a.download = (tDisp ? tDisp.textContent : '') || 'download.pdf';
  a.click();
};
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') window._closePdfViewer && window._closePdfViewer(); });

// Global status/alert message display helper
export function msg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;

  let color = '#3d5af1'; // default/info
  let bg = '#eff2fe';
  let border = '#c7d2fe';

  if (type === 'error') {
    color = '#ef4444';
    bg = '#fef2f2';
    border = '#fecaca';
  } else if (type === 'success') {
    color = '#10b981';
    bg = '#ecfdf5';
    border = '#a7f3d0';
  }

  el.innerHTML = `
    <div style="
      padding: 10px 14px;
      background: ${bg};
      border: 1.5px solid ${border};
      border-radius: 12px;
      color: ${color};
      font-size: 13.5px;
      font-weight: 600;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: fadeIn 0.3s ease-out;
    ">
      <span>${text}</span>
    </div>
  `;
}
window.msg = msg;

// Robust base64 → Blob (handles legacy data-URL prefix, whitespace, bad padding)
export function base64ToBlob(raw, mime) {
  let b64 = raw.includes(',') ? raw.split(',').pop() : raw;
  b64 = b64.replace(/[^A-Za-z0-9+/=\-_]/g, '');
  b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
window.base64ToBlob = base64ToBlob;

export function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
window.esc = esc;

// ─── HIGH-SPEED PERSISTENT PDF CACHE (IndexedDB) ───
export const PdfDbCache = {
  db: null,
  async init() {
    if (this.db) return true;
    if (typeof indexedDB === 'undefined') return false;
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('techbook_pdf_cache', 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('pdfs')) {
            db.createObjectStore('pdfs');
          }
        };
        request.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(true);
        };
        request.onerror = () => resolve(false);
      } catch (err) {
        console.error('IndexedDB open error:', err);
        resolve(false);
      }
    });
  },
  async get(type, id) {
    try {
      const key = `${type}_${id}`;
      await this.init();
      if (!this.db) return null;
      return new Promise((resolve) => {
        const tx = this.db.transaction('pdfs', 'readonly');
        const store = tx.objectStore('pdfs');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      console.error('Cache get error:', err);
      return null;
    }
  },
  async set(type, id, blob) {
    try {
      const key = `${type}_${id}`;
      await this.init();
      if (!this.db) return false;
      return new Promise((resolve) => {
        const tx = this.db.transaction('pdfs', 'readwrite');
        const store = tx.objectStore('pdfs');
        const req = store.put(blob, key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch (err) {
      console.error('Cache set error:', err);
      return false;
    }
  }
};
window.PdfDbCache = PdfDbCache;

// Escape string for JS click handlers in HTML templates
export function jsEsc(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
window.jsEsc = jsEsc;

// Read file as Base64 string
export function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result.split(',')[1]); // strip data:...;base64,
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}
window.readFileBase64 = readFileBase64;

// Cache student profile retrieval
window._cachedStudentProfiles = window._cachedStudentProfiles || {};
export async function getStudentProfile(usn) {
  if (window._cachedStudentProfiles[usn]) {
    return window._cachedStudentProfiles[usn];
  }
  if (window._currentStudentData && (window._currentStudentData.usn === usn || String(window._currentStudentData.usn).toUpperCase() === usn.toUpperCase())) {
    window._cachedStudentProfiles[usn] = window._currentStudentData;
    return window._currentStudentData;
  }
  try {
    const localDataStr = localStorage.getItem('techbook_student_data');
    if (localDataStr) {
      const localData = JSON.parse(localDataStr);
      if (localData && (localData.usn === usn || String(localData.usn).toUpperCase() === usn.toUpperCase())) {
        window._cachedStudentProfiles[usn] = localData;
        return localData;
      }
    }
  } catch (err) {
    console.warn("Error reading local student profile cache:", err);
  }

  const snap = await getDoc(doc(db, 'students', usn));
  if (snap.exists()) {
    window._cachedStudentProfiles[usn] = snap.data();
    return window._cachedStudentProfiles[usn];
  }
  return null;
}
window.getStudentProfile = getStudentProfile;



