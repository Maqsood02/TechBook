import { db, storage } from '../core/firebase.js';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";
import { doc, setDoc, getDoc, addDoc, collection, query, where, getDocs, orderBy, deleteDoc, writeBatch, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { $, base64ToBlob } from '../core/helpers.js';

    /* =========================================================
       🎬 PROMO MANAGEMENT SYSTEM (ADMIN & LANDING PAGE)
       ========================================================= */

    window.adminUploadPromo = async function() {
      const titleInput = document.getElementById('promo-title');
      const descInput = document.getElementById('promo-desc');
      const fileInput = document.getElementById('promo-file');
      const urlInput = document.getElementById('promo-url');
      const msgEl = document.getElementById('admin-promo-msg');
      const btn = document.getElementById('btn-upload-promo');
      const progressDiv = document.getElementById('promo-upload-progress');
      const progressBar = document.getElementById('promo-upload-bar');
      const progressPct = document.getElementById('promo-upload-pct');
      
      const title = titleInput.value.trim();
      const desc = descInput.value.trim();
      const file = fileInput ? fileInput.files[0] : null;
      const url = urlInput ? urlInput.value.trim() : '';
      
      if (!title || (!file && !url)) {
        if (msgEl) msgEl.innerHTML = '<span style="color:#ef4444;">Please provide a title and either pick a media file or paste a media URL.</span>';
        return;
      }
      
      // File upload flow
      if (file) {
        if (file.size > 50 * 1024 * 1024) {
          if (msgEl) msgEl.innerHTML = '<span style="color:#ef4444;">File size exceeds 50MB limit.</span>';
          return;
        }
        
        try {
          btn.disabled = true;
          btn.textContent = 'Uploading...';
          progressDiv.style.display = 'block';
          if (msgEl) msgEl.innerHTML = '';

          const isVideo = file.type.startsWith('video/');

          const processAndSave = async (mediaDataUrl) => {
            // Check if base64 fits in Firestore's 1MB limit
            if (mediaDataUrl.length <= 1048487) {
              try {
                await addDoc(collection(db, 'promos'), {
                  title: title,
                  description: desc,
                  mediaUrl: mediaDataUrl,
                  mediaType: isVideo ? 'video' : 'image',
                  createdAt: serverTimestamp(),
                  uploadedBy: window._currentAdminUser || 'admin'
                });

                if (msgEl) msgEl.innerHTML = '<span style="color:#10b981;">✅ Promo uploaded successfully!</span>';

                // Reset form
                titleInput.value = '';
                descInput.value = '';
                if (fileInput) fileInput.value = '';
                if (urlInput) urlInput.value = '';
                btn.disabled = false;
                btn.textContent = '📤 Upload Promo';
                progressDiv.style.display = 'none';
                progressBar.style.width = '0%';

                loadAdminPromos();
                loadLandingPromos();
                return true;
              } catch (err) {
                console.error("Promo direct save error:", err);
              }
            } else {
              // Larger file (e.g. video): use Firestore chunking!
              try {
                const chunks = [];
                const chunkSize = 800 * 1024; // 800KB chunks
                for (let i = 0; i < mediaDataUrl.length; i += chunkSize) {
                  chunks.push(mediaDataUrl.slice(i, i + chunkSize));
                }

                if (msgEl) msgEl.innerHTML = `<span style="color:#6366f1;">⏳ Saving to Firestore chunks (0/${chunks.length})...</span>`;
                
                const docRef = await addDoc(collection(db, 'promos'), {
                  title: title,
                  description: desc,
                  mediaUrl: 'chunked_storage',
                  mediaType: isVideo ? 'video' : 'image',
                  totalChunks: chunks.length,
                  createdAt: serverTimestamp(),
                  uploadedBy: window._currentAdminUser || 'admin'
                });

                for (let j = 0; j < chunks.length; j++) {
                  await setDoc(doc(db, 'promos', `${docRef.id}_chunk_${j}`), {
                    promoId: docRef.id,
                    idx: j,
                    data: chunks[j]
                  });
                  if (msgEl) msgEl.innerHTML = `<span style="color:#6366f1;">⏳ Saving to Firestore chunks (${j + 1}/${chunks.length})...</span>`;
                  progressBar.style.width = Math.round(((j + 1) / chunks.length) * 100) + '%';
                  progressPct.textContent = Math.round(((j + 1) / chunks.length) * 100) + '%';
                }

                if (msgEl) msgEl.innerHTML = '<span style="color:#10b981;">✅ Promo uploaded successfully via chunking!</span>';

                // Reset form
                titleInput.value = '';
                descInput.value = '';
                if (fileInput) fileInput.value = '';
                if (urlInput) urlInput.value = '';
                btn.disabled = false;
                btn.textContent = '📤 Upload Promo';
                progressDiv.style.display = 'none';
                progressBar.style.width = '0%';

                loadAdminPromos();
                loadLandingPromos();
                return true;
              } catch (e) {
                console.error("Promo chunking save error:", e);
                if (msgEl) msgEl.innerHTML = `<span style="color:#ef4444;">Error: ${e.message}</span>`;
                btn.disabled = false;
                btn.textContent = '📤 Upload Promo';
                progressDiv.style.display = 'none';
                return false;
              }
            }
            return false;
          };

          if (!isVideo) {
            // Compress Image
            const reader = new FileReader();
            reader.onload = function(e) {
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
                
                await processAndSave(compressedBase64);
              };
              img.onerror = async () => {
                const r2 = new FileReader();
                r2.onload = async (ev) => await processAndSave(ev.target.result);
                r2.readAsDataURL(file);
              };
              img.src = e.target.result;
            };
            reader.readAsDataURL(file);
          } else {
            // Video: Read as data URL directly and use processAndSave (fits directly or chunked)
            const reader = new FileReader();
            reader.onload = async (e) => {
              await processAndSave(e.target.result);
            };
            reader.readAsDataURL(file);
          }
        } catch (error) {
          console.error("Promo setup error:", error);
          if (msgEl) msgEl.innerHTML = '<span style="color:#ef4444;">Error: ' + error.message + '</span>';
          btn.disabled = false;
          btn.textContent = '📤 Upload Promo';
          progressDiv.style.display = 'none';
        }
      } 
      // Direct URL flow (Bypasses Storage & CORS entirely!)
      else if (url) {
        try {
          btn.disabled = true;
          btn.textContent = 'Adding...';
          
          const isVideo = /\.(mp4|webm|mov|ogg)/i.test(url) || url.includes('video');
          
          await addDoc(collection(db, 'promos'), {
            title: title,
            description: desc,
            mediaUrl: url,
            mediaType: isVideo ? 'video' : 'image',
            createdAt: serverTimestamp(),
            uploadedBy: window._currentAdminUser || 'admin'
          });
          
          if (msgEl) msgEl.innerHTML = '<span style="color:#10b981;">✅ Promo added successfully!</span>';
          
          titleInput.value = '';
          descInput.value = '';
          if (fileInput) fileInput.value = '';
          if (urlInput) urlInput.value = '';
          btn.disabled = false;
          btn.textContent = '📤 Upload Promo';
          
          loadAdminPromos();
          loadLandingPromos();
        } catch (error) {
          console.error("Promo setup error:", error);
          if (msgEl) msgEl.innerHTML = '<span style="color:#ef4444;">Error: ' + error.message + '</span>';
          btn.disabled = false;
          btn.textContent = '📤 Upload Promo';
        }
      }
    };
    
    window.loadAdminPromos = async function() {
      const container = document.getElementById('promos-list-container');
      if (!container) return;
      
      try {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#6b7280;">Loading promos...</div>';
        
        const snap = await getDocs(query(collection(db, 'promos'), orderBy('title')));
        
        if (snap.empty) {
          container.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;">No promos uploaded yet.</div>';
          return;
        }
        
        const docs = [];
        snap.forEach(d => {
          const data = d.data();
          if (data.title && !d.id.includes('_chunk_')) {
            docs.push({ id: d.id, ...data });
          }
        });
        
        // Sort in memory by createdAt descending
        docs.sort((a, b) => {
          const tA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : (a.createdAt.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime())) : 0;
          const tB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : (b.createdAt.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime())) : 0;
          return tB - tA;
        });
        
        let html = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">';
        
        docs.forEach(data => {
          const id = data.id;
          const elemId = `promo-admin-media-${id}`;
          
          let mediaHtml = '';
          if (data.mediaType === 'video') {
            mediaHtml = `<video id="${elemId}" src="${data.mediaUrl === 'chunked_storage' ? '' : data.mediaUrl}" style="width:100%; height:150px; object-fit:cover; border-radius:8px; background:#000;" controls></video>`;
          } else {
            mediaHtml = `<img id="${elemId}" src="${data.mediaUrl === 'chunked_storage' ? '' : data.mediaUrl}" style="width:100%; height:150px; object-fit:cover; border-radius:8px; background:#f3f4f6;">`;
          }
          
          html += `
            <div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
              ${mediaHtml}
              <h4 style="margin: 12px 0 6px 0; color:#111827; font-size:16px;">${data.title}</h4>
              <p style="margin: 0 0 12px 0; color:#6b7280; font-size:13px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${data.description || 'No description'}</p>
              <button onclick="window.adminDeletePromo('${id}')" style="width:100%; background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); padding:8px; border-radius:8px; font-weight:600; cursor:pointer; transition:all 0.2s;">
                🗑️ Delete Promo
              </button>
            </div>
          `;
        });
        
        html += '</div>';
        container.innerHTML = html;

        // Asynchronously load any chunked storage promos
        docs.forEach(data => {
          if (data.mediaUrl === 'chunked_storage') {
            const elemId = `promo-admin-media-${data.id}`;
            const promises = [];
            for (let j = 0; j < (data.totalChunks || 0); j++) {
              promises.push(getDoc(doc(db, 'promos', `${data.id}_chunk_${j}`)));
            }
            Promise.all(promises).then(results => {
              const parts = results.map(s => s.exists() ? s.data().data : '');
              const fullBase64 = parts.join('');
              if (fullBase64) {
                const mimeMatch = fullBase64.match(/^data:([^;]+);base64,/);
                const extractedMime = mimeMatch ? mimeMatch[1] : (data.mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
                const blob = base64ToBlob(fullBase64, extractedMime);
                const blobUrl = URL.createObjectURL(blob);
                const el = document.getElementById(elemId);
                if (el) {
                  el.src = blobUrl;
                  if (data.mediaType === 'video') {
                    el.muted = true;
                    el.setAttribute('muted', '');
                    el.setAttribute('playsinline', '');
                    el.setAttribute('webkit-playsinline', '');
                    el.setAttribute('preload', 'auto');
                    el.load();
                    el.play().catch(e => console.log("Admin mobile video autoplay:", e));
                  }
                }
              }
            }).catch(e => console.error("Error fetching admin chunked media:", e));
          }
        });
        
      } catch (error) {
        console.error("Error loading admin promos:", error);
        container.innerHTML = `<div style="text-align:center;padding:20px;color:#ef4444;">Error loading promos: ${error.message}. Please ensure Firestore rules allow access to the "promos" collection.</div>`;
      }
    };
    
    window.adminDeletePromo = async function(id) {
      if (!confirm("Are you sure you want to delete this promo? This cannot be undone.")) return;
      
      try {
        const b = writeBatch(db);
        b.delete(doc(db, 'promos', id));
        for (let j = 0; j < 100; j++) {
          b.delete(doc(db, 'promos', `${id}_chunk_${j}`));
        }
        await b.commit();
        
        const msgEl = document.getElementById('admin-promo-msg');
        if (msgEl) msgEl.innerHTML = '<span style="color:#10b981;">✅ Promo deleted successfully.</span>';
        
        loadAdminPromos();
        loadLandingPromos();
        
      } catch (error) {
        console.error("Error deleting promo:", error);
        alert("Failed to delete promo: " + error.message);
      }
    };
    
    window.loadLandingPromos = async function() {
      const container = document.getElementById('landing-promos-container');
      if (!container) return;
      
      try {
        getDocs(query(collection(db, 'promos'), orderBy('title'))).then(snap => {
          if (snap.empty) {
            container.style.display = 'none';
            return;
          }
          
          const docs = [];
          snap.forEach(d => {
            const data = d.data();
            if (data.title && !d.id.includes('_chunk_')) {
              docs.push({ id: d.id, ...data });
            }
          });
          
          // Sort in memory by createdAt ascending to keep first uploaded first
          docs.sort((a, b) => {
            const tA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : (a.createdAt.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime())) : 0;
            const tB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : (b.createdAt.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime())) : 0;
            return tA - tB;
          });
          
          container.style.display = 'flex';
          
          let html = `
            <style>
              #landing-promos-container .promo-slider-wrapper {
                position: relative;
                width: 100%;
                overflow: hidden;
                border-radius: 20px;
                background: rgba(255, 255, 255, 0.9);
                backdrop-filter: blur(12px);
                border: 1.5px solid rgba(57, 255, 180, 0.35);
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
                margin: 0 auto 24px auto;
              }
              #landing-promos-container .promo-slider-track {
                display: flex;
                transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                width: 100%;
              }
              #landing-promos-container .promo-card {
                min-width: 100%;
                width: 100%;
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
                background: transparent;
                box-shadow: none;
                border: none;
                margin: 0;
                border-radius: 0;
                cursor: pointer;
              }
              #landing-promos-container .promo-media {
                width: 100%;
                max-height: 320px;
                object-fit: cover;
                border-radius: 0;
              }
              #landing-promos-container .promo-content {
                padding: 16px 20px;
                background: rgba(255, 255, 255, 0.5);
                border-top: 1px solid rgba(0,0,0,0.04);
              }
              #landing-promos-container .promo-slider-dots {
                display: flex;
                justify-content: center;
                gap: 8px;
                padding: 10px 0;
                background: rgba(255, 255, 255, 0.5);
                border-top: 1px solid rgba(0,0,0,0.03);
              }
              #landing-promos-container .promo-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: rgba(0, 0, 0, 0.15);
                cursor: pointer;
                transition: all 0.3s ease;
              }
              #landing-promos-container .promo-dot.active {
                background: #3d5af1;
                transform: scale(1.2);
                width: 24px;
                border-radius: 6px;
              }
            </style>
            <div class="promo-slider-wrapper">
              <div class="promo-slider-track">
          `;
          
          docs.forEach(data => {
            const elemId = `promo-landing-media-${data.id}`;
            let mediaHtml = '';
            if (data.mediaType === 'video') {
              mediaHtml = `<video id="${elemId}" src="${data.mediaUrl === 'chunked_storage' ? '' : data.mediaUrl}" class="promo-media" autoplay muted playsinline webkit-playsinline preload="auto"></video>`;
            } else {
              mediaHtml = `<img id="${elemId}" src="${data.mediaUrl === 'chunked_storage' ? '' : data.mediaUrl}" class="promo-media" alt="${data.title}">`;
            }
            
            let descHtml = '';
            if (data.description) {
              descHtml = `<p class="promo-desc">${data.description}</p>`;
            }
            
            html += `
              <div class="promo-card">
                ${mediaHtml}
                <div class="promo-content">
                  <h3 class="promo-title" style="font-size: 18px; font-weight: 800; color: #111827; margin-bottom: 6px;">${data.title}</h3>
                  ${descHtml}
                </div>
              </div>
            `;
          });
          
          html += '</div>'; // close promo-slider-track
          
          // Add dots navigation
          html += '<div class="promo-slider-dots">';
          docs.forEach((_, i) => {
            html += `<div class="promo-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`;
          });
          html += '</div></div>'; // close dots and promo-slider-wrapper
          
          container.innerHTML = html;

          let slideIndex = 0;
          let slideTimer = null;
          
          function showSlide(index) {
            const track = container.querySelector('.promo-slider-track');
            const dots = container.querySelectorAll('.promo-dot');
            const cards = container.querySelectorAll('.promo-slider-track .promo-card');
            if (!track || !cards.length) return;
            
            if (index >= cards.length) slideIndex = 0;
            else if (index < 0) slideIndex = cards.length - 1;
            else slideIndex = index;
            
            track.style.transform = `translateX(-${slideIndex * 100}%)`;
            
            dots.forEach((dot, i) => {
              if (i === slideIndex) dot.classList.add('active');
              else dot.classList.remove('active');
            });
            
            clearTimeout(slideTimer);
            const currentCard = cards[slideIndex];
            const video = currentCard ? currentCard.querySelector('video') : null;

            if (video) {
              try {
                if (video.readyState >= 1) {
                  video.currentTime = 0;
                }
                video.play().catch(e => console.log('Autoplay deferred for landing video:', e));
              } catch (err) {
                console.log("Could not reset or play video yet", err);
              }
              
              video.onended = () => {
                showSlide(slideIndex + 1);
              };

              // Fallback timeout to advance slide if video takes too long to load or play
              slideTimer = setTimeout(() => {
                showSlide(slideIndex + 1);
              }, 12000); // 12 seconds
            } else {
              slideTimer = setTimeout(() => {
                showSlide(slideIndex + 1);
              }, 5000); // Specific timing for images
            }
          }
          
          window.openPromoModal = function(promo, mediaUrl) {
            const existingModal = document.getElementById('promo-popup-modal');
            if (existingModal) existingModal.remove();

            let popupMediaHtml = '';
            if (promo.mediaType === 'video') {
              popupMediaHtml = `<video src="${mediaUrl}" style="width: 100%; max-height: 400px; object-fit: contain; border-radius: 12px; margin-bottom: 16px;" controls autoplay playsinline></video>`;
            } else {
              popupMediaHtml = `<img src="${mediaUrl}" style="width: 100%; max-height: 400px; object-fit: contain; border-radius: 12px; margin-bottom: 16px;" alt="${promo.title}">`;
            }

            const modalHtml = `
              <div id="promo-popup-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; z-index: 10000; opacity: 0; transition: opacity 0.3s ease;">
                <div style="background: white; width: 90%; max-width: 600px; border-radius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; padding: 24px; position: relative; animation: modalPopUp 0.4s ease-out; border: 1px solid rgba(0,0,0,0.05); max-height: 90vh; display: flex; flex-direction: column;">
                  <button id="close-promo-popup" style="position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; background: rgba(0,0,0,0.05); border: none; border-radius: 50%; font-size: 18px; line-height: 36px; text-align: center; cursor: pointer; color: #111827; transition: all 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.1)';" onmouseout="this.style.background='rgba(0,0,0,0.05)';">✕</button>
                  <div style="flex: 1; overflow-y: auto; padding-right: 4px;">
                    ${popupMediaHtml}
                    <h3 style="font-size: 24px; font-weight: 800; color: #111827; margin-bottom: 12px;">${promo.title}</h3>
                    <p style="font-size: 15px; color: #4b5563; line-height: 1.6; white-space: pre-wrap;">${promo.description || ''}</p>
                  </div>
                </div>
              </div>
              <style>
                @keyframes modalPopUp {
                  from { opacity: 0; transform: scale(0.9); }
                  to { opacity: 1; transform: scale(1); }
                }
              </style>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modalEl = document.getElementById('promo-popup-modal');
            setTimeout(() => { modalEl.style.opacity = '1'; }, 10);

            const closeModal = () => {
              modalEl.style.opacity = '0';
              setTimeout(() => { modalEl.remove(); }, 300);
            };

            document.getElementById('close-promo-popup').addEventListener('click', closeModal);
            modalEl.addEventListener('click', (e) => {
              if (e.target === modalEl) closeModal();
            });
          };

          // Attach popup trigger on each card
          const promoBlobUrls = {};
          const cards = container.querySelectorAll('.promo-slider-track .promo-card');
          cards.forEach((card, idx) => {
            card.addEventListener('click', () => {
              const promo = docs[idx];
              const mediaEl = card.querySelector('.promo-media');
              const currentSrc = promoBlobUrls[promo.id] || (mediaEl ? mediaEl.src : promo.mediaUrl);
              window.openPromoModal(promo, currentSrc);
            });
          });
          
          // Clickable dots
          const dots = container.querySelectorAll('.promo-dot');
          dots.forEach(dot => {
            dot.addEventListener('click', (e) => {
              e.stopPropagation(); // Avoid triggering card click
              const idx = parseInt(dot.getAttribute('data-index'));
              showSlide(idx);
            });
          });
          
          // Initialize first slide
          showSlide(0);
          
          // Asynchronously load any chunked storage promos
          docs.forEach(data => {
            if (data.mediaUrl === 'chunked_storage') {
              const elemId = `promo-landing-media-${data.id}`;
              const promises = [];
              for (let j = 0; j < (data.totalChunks || 0); j++) {
                promises.push(getDoc(doc(db, 'promos', `${data.id}_chunk_${j}`)));
              }
              Promise.all(promises).then(results => {
                const parts = results.map(s => s.exists() ? s.data().data : '');
                const fullBase64 = parts.join('');
                if (fullBase64) {
                  const mimeMatch = fullBase64.match(/^data:([^;]+);base64,/);
                  const extractedMime = mimeMatch ? mimeMatch[1] : (data.mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
                  const blob = base64ToBlob(fullBase64, extractedMime);
                  const blobUrl = URL.createObjectURL(blob);
                  promoBlobUrls[data.id] = blobUrl;
                  const el = document.getElementById(elemId);
                  if (el) {
                    el.src = blobUrl;
                    if (data.mediaType === 'video') {
                      el.muted = true;
                      el.setAttribute('muted', '');
                      el.setAttribute('playsinline', '');
                      el.setAttribute('webkit-playsinline', '');
                      el.setAttribute('preload', 'auto');
                      el.load();
                      el.play().catch(e => console.log("Landing mobile video autoplay:", e));
                    }
                  }
                }
              }).catch(e => console.error("Error fetching landing chunked media:", e));
            }
          });
          
        }).catch(err => {
          console.error("Landing promos load failed silently:", err);
        });
        
      } catch (error) {
        console.error("Error initializing landing promos:", error);
      }
    };

    // Initialize Upload Button Listener
    const uploadBtn = document.getElementById('btn-upload-promo');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', window.adminUploadPromo);
    }
    
    // Load promos on landing page automatically
    if (document.getElementById('landing-promos-container')) {
      window.loadLandingPromos();
    }
    window.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('landing-promos-container')) {
        window.loadLandingPromos();
      }
    });
    window.addEventListener('load', () => {
      if (document.getElementById('landing-promos-container')) {
        window.loadLandingPromos();
      }
    });

