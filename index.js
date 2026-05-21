
// Sincronización global de temas entre pestañas/ventanas
    window.addEventListener('focus', function() {
      // Cuando la ventana recibe foco, verificar si hay cambios de tema
      if (typeof window.applyTheme === 'function') {
        window.applyTheme();
      }
      if (typeof window.updateActiveStates === 'function') {
        window.updateActiveStates();
      }
    });

// Sistema de temas sincronizado
    (function() {
      // Función para aplicar tema
      function applyTheme() {
        const savedTheme = localStorage.getItem('selectedTheme') || 'light';
        const savedColor = localStorage.getItem('selectedColor') || 'default';
        const savedTransparency = parseInt(localStorage.getItem('themeTransparency') || '0');
        
        // Limpiar clases anteriores
        document.body.classList.remove('dark-theme');
        document.body.classList.remove('theme-blue', 'theme-green', 'theme-purple', 'theme-red', 'theme-pink', 'theme-magenta', 'theme-cyan', 'theme-orange');
        document.documentElement.removeAttribute('data-theme');
        
        // Aplicar tema
        if (savedTheme === 'dark') {
          document.body.classList.add('dark-theme');
          document.documentElement.setAttribute('data-theme', 'dark');
        }
        
        // Aplicar color de acento
        if (savedColor !== 'default') {
          document.body.classList.add(`theme-${savedColor}`);
        }

        // Aplicar transparencia
        const isDark = savedTheme === 'dark';
        const baseAlpha = isDark ? 0.88 : 0.96;
        const minAlpha = 0.2;
        const currentAlpha = baseAlpha - (savedTransparency / 100) * (baseAlpha - minAlpha);
        document.documentElement.style.setProperty('--card-bg-alpha', currentAlpha);
      }
      
      // Aplicar tema al cargar
      applyTheme();
      
      // Escuchar cambios en localStorage desde otras páginas
      window.addEventListener('storage', function(e) {
        if (e.key === 'selectedTheme' || e.key === 'selectedColor') {
          applyTheme();
          // Actualizar estados del modal si está abierto
          if (typeof updateActiveStates === 'function') {
            updateActiveStates();
          }
        }
      });
      
      // Hacer la función global para uso en el modal
      window.applyTheme = applyTheme;
    })();

    // Manejo del modal de tema
    document.addEventListener('DOMContentLoaded', function() {
      const themeBtn = document.getElementById('theme-btn');
      const themeModal = document.getElementById('theme-modal');
      const modalCloseBtn = themeModal.querySelector('.modal-close-btn');
      const themeCloseBtn = document.getElementById('theme-close');
      const themeResetBtn = document.getElementById('theme-reset');
      const themeOptions = document.querySelectorAll('.theme-option');
      const themeColors = document.querySelectorAll('.theme-color');
      const themeShapes = document.querySelectorAll('.theme-shape');
      const themeParticles = document.getElementById('theme-particles');
      const themeTransparency = document.getElementById('theme-transparency');

      // Abrir modal
      (function setupThemeBtnDraggable() {
        if (!themeBtn) return;
        const storageKey = `widget_btn_pos:${location.pathname}:theme-btn`;
        let isDragging = false;
        let hasMoved = false;
        let startX = 0;
        let startY = 0;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        try {
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            const pos = JSON.parse(saved);
            if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
              themeBtn.style.position = 'fixed';
              themeBtn.style.left = `${pos.left}px`;
              themeBtn.style.top = `${pos.top}px`;
              themeBtn.style.marginLeft = '0';
              themeBtn.style.zIndex = '10000';
              themeBtn.style.cursor = 'grab';
            }
          }
        } catch (_) {}

        themeBtn.addEventListener('mousedown', (e) => {
          isDragging = true;
          hasMoved = false;
          startX = e.clientX;
          startY = e.clientY;
          const rect = themeBtn.getBoundingClientRect();
          dragOffsetX = e.clientX - rect.left;
          dragOffsetY = e.clientY - rect.top;
          themeBtn.style.cursor = 'grabbing';
          themeBtn.style.transition = 'none';
        });

        window.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
          const left = e.clientX - dragOffsetX;
          const top = e.clientY - dragOffsetY;

          themeBtn.style.position = 'fixed';
          themeBtn.style.left = `${left}px`;
          themeBtn.style.top = `${top}px`;
          themeBtn.style.marginLeft = '0';
          themeBtn.style.zIndex = '10000';
        });

        window.addEventListener('mouseup', () => {
          if (!isDragging) return;
          isDragging = false;
          themeBtn.style.cursor = 'grab';
          themeBtn.style.transition = '';

          if (hasMoved) {
            const rect = themeBtn.getBoundingClientRect();
            const left = Math.max(0, Math.min(rect.left, window.innerWidth - rect.width));
            const top = Math.max(0, Math.min(rect.top, window.innerHeight - rect.height));
            themeBtn.style.left = `${left}px`;
            themeBtn.style.top = `${top}px`;
            try {
              localStorage.setItem(storageKey, JSON.stringify({ left, top }));
            } catch (_) {}
          }
        });

        themeBtn.addEventListener('click', function(e) {
          if (hasMoved) return;
          themeModal.hidden = false;
          updateActiveStates();
          e.stopPropagation();
        });
      })();

      // Lógica de Acordeón
      const accordionHeaders = themeModal.querySelectorAll('.accordion-header');
      accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
          const item = header.parentElement;
          const isActive = item.classList.contains('active');

          // Cerrar otros items
          themeModal.querySelectorAll('.accordion-item').forEach(otherItem => {
            if (otherItem !== item) {
              otherItem.classList.remove('active');
            }
          });

          // Alternar item actual
          if (!isActive) {
            item.classList.add('active');
          } else {
             item.classList.remove('active');
          }
        });
      });

      // Cerrar modal
      function closeModal() {
        themeModal.hidden = true;
      }

      modalCloseBtn.addEventListener('click', closeModal);
      themeCloseBtn?.addEventListener('click', closeModal);
      themeModal.addEventListener('click', function(e) {
        if (e.target === themeModal) closeModal();
      });

      // Actualizar estados activos
      function updateActiveStates() {
        const currentTheme = localStorage.getItem('selectedTheme') || 'light';
        const currentColor = localStorage.getItem('selectedColor') || 'default';
        const currentShape = localStorage.getItem('selectedShape') || 'orb';
        const currentParticles = localStorage.getItem('particleCount') || '800';
        const currentTransparency = localStorage.getItem('themeTransparency') || '0';

        themeOptions.forEach(option => {
          option.classList.toggle('active', option.dataset.theme === currentTheme);
        });

        themeColors.forEach(color => {
          color.classList.toggle('active', color.dataset.color === currentColor);
        });

        themeShapes.forEach(shape => {
          shape.classList.toggle('active', shape.dataset.shape === currentShape);
        });
        
        if (themeParticles) {
          themeParticles.value = currentParticles;
        }

        if (themeTransparency) {
          themeTransparency.value = currentTransparency;
        }
      }
      
      // Hacer la función global
      window.updateActiveStates = updateActiveStates;

      // Cambiar tema
      themeOptions.forEach(option => {
        option.addEventListener('click', function() {
          const theme = this.dataset.theme;
          
          // Guardar en localStorage
          localStorage.setItem('selectedTheme', theme);
          
          // Aplicar tema usando la función global
          window.applyTheme();
          
          // Actualizar estados
          updateActiveStates();
          
          // Disparar evento personalizado para sincronización
          window.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { theme, color: localStorage.getItem('selectedColor') || 'default' }
          }));
        });
      });

      // Cambiar color
      themeColors.forEach(color => {
        color.addEventListener('click', function() {
          const colorName = this.dataset.color;
          
          // Guardar en localStorage
          localStorage.setItem('selectedColor', colorName);
          
          // Aplicar tema usando la función global
          window.applyTheme();
          
          // Actualizar estados
          updateActiveStates();
          
          // Disparar evento personalizado para sincronización
          window.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { theme: localStorage.getItem('selectedTheme') || 'light', color: colorName }
          }));
        });
      });

      // Cambiar forma del fondo
      themeShapes.forEach(shape => {
        shape.addEventListener('click', () => {
          const shapeName = shape.dataset.shape;
          localStorage.setItem('selectedShape', shapeName);
          updateActiveStates();
          window.dispatchEvent(new CustomEvent('shapeChanged', { detail: { shape: shapeName } }));
        });
      });

      // Cambiar cantidad de partículas
      themeParticles?.addEventListener('input', function() {
        localStorage.setItem('particleCount', this.value);
        if (typeof window.updateParticleSystem === 'function') {
           window.updateParticleSystem();
        }
      });

      // Control de transparencia
      themeTransparency?.addEventListener('input', (e) => {
        const val = e.target.value;
        localStorage.setItem('themeTransparency', val);
        window.applyTheme();
        
        window.dispatchEvent(new CustomEvent('themeChanged', { 
          detail: { 
            theme: localStorage.getItem('selectedTheme') || 'light', 
            color: localStorage.getItem('selectedColor') || 'default',
            transparency: val
          }
        }));
      });

      // Interacción visual durante ajuste de transparencia
      const startTransparencyInteraction = () => {
        themeModal.classList.add('interacting-transparency');
      };
      
      const endTransparencyInteraction = () => {
        themeModal.classList.remove('interacting-transparency');
      };

      themeTransparency?.addEventListener('mousedown', startTransparencyInteraction);
      themeTransparency?.addEventListener('touchstart', startTransparencyInteraction);
      
      themeTransparency?.addEventListener('mouseup', endTransparencyInteraction);
      themeTransparency?.addEventListener('touchend', endTransparencyInteraction);
      themeTransparency?.addEventListener('mouseleave', endTransparencyInteraction);

      themeParticles?.addEventListener('mousedown', startTransparencyInteraction);
      themeParticles?.addEventListener('touchstart', startTransparencyInteraction);
      
      themeParticles?.addEventListener('mouseup', endTransparencyInteraction);
      themeParticles?.addEventListener('touchend', endTransparencyInteraction);
      themeParticles?.addEventListener('mouseleave', endTransparencyInteraction);

      // Restablecer tema
      themeResetBtn?.addEventListener('click', function() {
        localStorage.removeItem('selectedTheme');
        localStorage.removeItem('selectedColor');
        localStorage.removeItem('selectedShape');
        localStorage.removeItem('themeTransparency');
        
        // Aplicar tema usando la función global
        window.applyTheme();
        
        // Actualizar estados
        updateActiveStates();
        
        // Resetear forma
        window.dispatchEvent(new CustomEvent('shapeChanged', { 
          detail: { shape: 'orb' } 
        }));

        // Disparar evento personalizado para sincronización
        window.dispatchEvent(new CustomEvent('themeChanged', { 
          detail: { theme: 'light', color: 'default', transparency: '0' }
        }));
      });

      // Cerrar con Escape
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !themeModal.hidden) {
          closeModal();
        }
      });
    });

    (function () {
      function getLocalDateKey(ts) {
        const d = ts ? new Date(ts) : new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      }

      // Inicializa Firebase si aún no está
      const firebaseConfig = {
        apiKey: "AIzaSyA6c3EaIvuPEfM6sTV0YHqCBHuz35ZmNIU",
        authDomain: "zero-strom-web.firebaseapp.com",
        projectId: "zero-strom-web",
        storageBucket: "zero-strom-web.firebasestorage.app",
        messagingSenderId: "758369466349",
        appId: "1:758369466349:web:f2ced362a5a049c70b59e4"
      };

      let db = null;
      let liveCodeRequired = false;
      let authReadyPromise = Promise.resolve(true);
      try {
        if (typeof firebase !== 'undefined' && firebase.apps) {
          if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
          }
          db = firebase.firestore();
          
          // Autenticación anónima para permitir reglas basadas en usuarios no registrados
          if (firebase.auth) {
            authReadyPromise = new Promise((resolve) => {
              firebase.auth().onAuthStateChanged((user) => {
                if (user) return resolve(true);
                firebase.auth().signInAnonymously().catch((err) => {
                  console.error('Error al autenticar anónimamente:', err);
                });
              });
            });
          }
        } else {
           console.warn('Firebase SDK not loaded - Offline mode');
        }
      } catch (e) {
        console.error('Error initializing Firebase:', e);
      }

      // Listener para el banner de mantenimiento (maintenanceMessage en system/status)
      if (db) {
        db.collection('system').doc('status').onSnapshot((doc) => {
          const data = doc.exists ? (doc.data() || {}) : {};
          const maintenanceMsg = String(data.maintenanceMessage || '').trim();
          const banner = document.getElementById('maintenance-banner');
          const bannerText = document.getElementById('maintenance-banner-text');
          if (banner) {
            if (maintenanceMsg) {
              if (bannerText) bannerText.textContent = maintenanceMsg;
              banner.hidden = false;
            } else {
              banner.hidden = true;
            }
          }
        }, (err) => {
          console.warn('Error en listener de mantenimiento:', err);
        });
      }

      const form = document.getElementById('formulario');
      const usuarioInput = document.getElementById('usuario');
      const usuarioSelect = document.getElementById('usuario-registrado');

      // Cargar lista de usuarios registrados
      async function loadUserList() {
        if (!db || !usuarioSelect) return;
        try {
          const userMap = new Set();
          
          // 1. Obtener de userStats
          const statsSnap = await db.collection('userStats').get();
          statsSnap.forEach(doc => { if (doc.id) userMap.add(doc.id); });
          
          // 2. Obtener de la colección users
          const usersSnap = await db.collection('users').get();
          usersSnap.forEach(doc => {
            const d = doc.data() || {};
            if (d.name) userMap.add(d.name);
          });

          // Limpiar y poblar dropdown
          usuarioSelect.innerHTML = '<option value="">Selecciona un usuario</option>';
          const sortedUsers = Array.from(userMap).sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'}));
          
          sortedUsers.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u;
            opt.textContent = u;
            usuarioSelect.appendChild(opt);
          });
        } catch (e) {
          console.error("Error al cargar lista de usuarios:", e);
        }
      }

      // Sincronizar dropdown con input
      if (usuarioSelect && usuarioInput) {
        usuarioSelect.addEventListener('change', () => {
          if (usuarioSelect.value) {
            usuarioInput.value = usuarioSelect.value;
          }
        });
      }

      loadUserList();

      async function fetchLiveCodeStatus() {
        try {
          if (!db) return { required: false, code: '' };
          const st = await db.collection('system').doc('status').get();
          const d = st && st.exists ? (st.data() || {}) : {};
          const code = String(d.liveCode || '').trim();
          liveCodeRequired = code.length >= 4;
          return { required: liveCodeRequired, code };
        } catch (_) {
          return { required: false, code: '' };
        }
      }

      function toFirestoreValue(value) {
        if (value === null || typeof value === 'undefined') return { nullValue: null };
        if (typeof value === 'string') return { stringValue: value };
        if (typeof value === 'boolean') return { booleanValue: value };
        if (typeof value === 'number') {
          return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
        }
        if (Array.isArray(value)) {
          return { arrayValue: { values: value.map(toFirestoreValue) } };
        }
        if (typeof value === 'object') {
          const fields = {};
          Object.entries(value).forEach(([k, v]) => {
            fields[k] = toFirestoreValue(v);
          });
          return { mapValue: { fields } };
        }
        return { stringValue: String(value) };
      }

      async function getAuthTokenForRest() {
        if (firebase?.auth) {
          if (!firebase.auth().currentUser) {
            const ok = await Promise.race([
              authReadyPromise,
              new Promise((resolve) => setTimeout(() => resolve(false), 6000))
            ]);
            if (!ok || !firebase.auth().currentUser) {
              throw new Error('AUTH_TOKEN_UNAVAILABLE');
            }
          }
          return firebase.auth().currentUser.getIdToken();
        }
        throw new Error('AUTH_NOT_AVAILABLE');
      }

      async function commitFirestoreWritesViaRest(writes) {
        const token = await getAuthTokenForRest();
        const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents:commit`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ writes })
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`REST_COMMIT_FAILED:${res.status}:${text}`);
        }
        return res.json().catch(() => ({}));
      }

      async function addSolicitudViaRest(payload) {
        const docId = `web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const name = `projects/${firebaseConfig.projectId}/databases/(default)/documents/solicitudes/${docId}`;
        const fields = { ...payload };
        delete fields.ts;
        await commitFirestoreWritesViaRest([
          {
            update: {
              name,
              fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toFirestoreValue(v)]))
            },
            updateTransforms: [
              { fieldPath: 'ts', setToServerValue: 'REQUEST_TIME' }
            ]
          }
        ]);
        return docId;
      }

      async function upsertUserViaRest(usuario) {
        const name = `projects/${firebaseConfig.projectId}/databases/(default)/documents/users/${String(usuario || '').trim().toLowerCase()}`;
        await commitFirestoreWritesViaRest([
          {
            update: {
              name,
              fields: {
                name: { stringValue: usuario }
              }
            }
          }
        ]);
      }

      // Poblar lista de usuarios registrados desde localStorage y Firestore
      async function collectRegisteredUsers() {
        const set = new Set();
        
        // 1. Obtener desde localStorage (sincrono)
        try {
          const byDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');
          Object.values(byDay).forEach(arr => (arr || []).forEach(it => {
            const original = String(it.usuario || '').trim().replace(/^@/, '');
            if (original) set.add(original);
          }));
          const legacy = JSON.parse(localStorage.getItem('solicitudes') || '[]');
          (legacy || []).forEach(it => {
            const original = String(it.usuario || '').trim().replace(/^@/, '');
            if (original) set.add(original);
          });
        } catch (e) {}
        
        const arr = Array.from(set);
        arr.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        return arr;
      }

      async function populateRegisteredUsers() {
        if (!usuarioSelect) return;
        const users = await collectRegisteredUsers();
        usuarioSelect.innerHTML = '<option value="">Selecciona un usuario</option>' +
          users.map(u => `<option value="${u}">@${u}</option>`).join('');
      }

      populateRegisteredUsers();

      // Utility: Fetch with Timeout
      async function fetchWithTimeout(resource, options = {}) {
        const { timeout = 5000 } = options;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(resource, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(id);
        return response;
      }

      // Cargar el último usuario utilizado
      const lastUser = localStorage.getItem('currentUser');
      if (lastUser) {
        const usuarioEl = document.getElementById('usuario');
        if (usuarioEl) {
          usuarioEl.value = lastUser;
          // Actualizar indicador de puntos para el usuario cargado
          // Se difiere la actualización para asegurar que las funciones de gamificación estén disponibles
          setTimeout(function() {
            if (typeof updatePointsIndicator === 'function') {
              try { updatePointsIndicator(); } catch (e) {}
            }
          }, 0);
        }
      }

      // Actualizar indicador de puntos cuando se selecciona usuario
      function updatePointsIndicator() {
        const usuarioEl = document.getElementById('usuario');
        const usuarioText = (usuarioEl.value || '').trim().replace(/^@/, '');
        const usuarioSel = (usuarioSelect?.value || '').trim().replace(/^@/, '');
        const usuario = usuarioText || usuarioSel;
        
        const pointsIndicator = document.getElementById('user-points-indicator');
        const pointsValue = document.getElementById('header-points');
        
        if (usuario) {
          const data = getGamificationData(usuario);
          pointsValue.textContent = data.points;
          pointsIndicator.style.display = 'flex';
        } else {
          pointsIndicator.style.display = 'none';
        }
      }

      // Función para limpiar el formulario y los metadatos de forma segura
      function resetFormAndMetadata() {
        if (form) form.reset();
        // Limpiar campos manualmente por si el reset no basta
        if (cancionEl) cancionEl.value = '';
        if (artistaEl) artistaEl.value = '';
        if (linkEl) linkEl.value = '';
        
        lastExtractedUrl = '';
        autoFilledData = { title: '', artist: '' };
        console.log('🧹 Formulario y metadatos reseteados por completo');
      }

      // Asegurar que el formulario esté limpio al cargar (especialmente al volver con el botón atrás)
      window.addEventListener('pageshow', (event) => {
        // event.persisted es true si viene del BFCache
        resetFormAndMetadata();
      });

      // INTELIGENCIA: Autocompletar desde Link
      async function extractMetadata(url) {
        if (!url) return null;
        try {
          console.log('🔍 Intentando extraer metadatos del link:', url);
          const resp = await fetchWithTimeout(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, { timeout: 4000 });
          const data = await resp.json();
          if (data.title) {
            let title = data.title;
            let artist = data.author_name || '';
            if (title.includes(' - ')) {
              const parts = title.split(' - ');
              if (artist && parts[0].toLowerCase().includes(artist.toLowerCase().split(' ')[0])) {
                artist = parts[0].trim();
                title = parts[1].trim();
              } else {
                artist = parts[0].trim();
                title = parts[1].trim();
              }
            }
            title = title.replace(/\(Official Video\)/gi, '')
                         .replace(/\[Official Video\]/gi, '')
                         .replace(/\(Official Music Video\)/gi, '')
                         .replace(/\[Official Music Video\]/gi, '')
                         .replace(/\(Official Audio\)/gi, '')
                         .replace(/\[Official Audio\]/gi, '')
                         .replace(/\(Video Oficial\)/gi, '')
                         .replace(/\[Video Oficial\]/gi, '')
                         .replace(/\(Lyric Video\)/gi, '')
                         .replace(/\[Lyric Video\]/gi, '')
                         .replace(/\(Lyrics\)/gi, '')
                         .replace(/\[Lyrics\]/gi, '')
                         .replace(/\(Audio\)/gi, '')
                         .replace(/\[Audio\]/gi, '')
                         .replace(/\[HQ\]/gi, '')
                         .replace(/\(HQ\)/gi, '')
                         .replace(/\[4K\]/gi, '')
                         .replace(/\(4K\)/gi, '')
                         .replace(/\[HD\]/gi, '')
                         .replace(/\(HD\)/gi, '')
                         .replace(/\(Live\)/gi, '')
                         .replace(/\[Live\]/gi, '')
                         .trim();
            return { title, artist };
          }
        } catch (e) {
          console.warn('No se pudieron obtener metadatos del link:', e);
        }
        return null;
      }

      const linkInput = document.getElementById('link');
      let lastExtractedUrl = '';
      let autoFilledData = { title: '', artist: '' };

      if (linkInput) {
        linkInput.addEventListener('blur', async () => {
          const url = linkInput.value.trim();
          const cancionEl = document.getElementById('cancion');
          const artistaEl = document.getElementById('artista');
          if (!url) {
            lastExtractedUrl = '';
            autoFilledData = { title: '', artist: '' };
            return;
          }
          if (url && url !== lastExtractedUrl) {
            // Limpiar campos mientras se extrae para evitar confusión con datos anteriores
            if (cancionEl && (!cancionEl.value || cancionEl.value === autoFilledData.title)) cancionEl.value = 'Cargando...';
            if (artistaEl && (!artistaEl.value || artistaEl.value === autoFilledData.artist)) artistaEl.value = 'Cargando...';
            
            const meta = await extractMetadata(url);
            if (meta) {
              lastExtractedUrl = url;
              autoFilledData = { title: meta.title, artist: meta.artist };
              
              // Si los campos están vacíos o tienen lo que autocompletamos antes (o el "Cargando..."), los actualizamos
              if (cancionEl && (cancionEl.value === 'Cargando...' || !cancionEl.value || cancionEl.value === autoFilledData.title)) {
                cancionEl.value = meta.title;
              }
              if (artistaEl && (artistaEl.value === 'Cargando...' || !artistaEl.value || artistaEl.value === autoFilledData.artist)) {
                artistaEl.value = meta.artist;
              }
            } else {
              // Si falla la extracción, limpiar el "Cargando..."
              if (cancionEl && cancionEl.value === 'Cargando...') cancionEl.value = '';
              if (artistaEl && artistaEl.value === 'Cargando...') artistaEl.value = '';
            }
          }
        });
      }

      // Event listeners para actualizar puntos
      document.getElementById('usuario')?.addEventListener('input', updatePointsIndicator);
      usuarioSelect?.addEventListener('change', updatePointsIndicator);

      // Flags globales para evitar doble registro y doble ejecución
      window.__FORM_SUBMIT_HANDLER_ADDED__ = window.__FORM_SUBMIT_HANDLER_ADDED__ || false;
      window.__FORM_SUBMITTED__ = window.__FORM_SUBMITTED__ || false;

      // Handler de envío (localStorage + Firestore)
      if (form && !window.__FORM_SUBMIT_HANDLER_ADDED__) {
        window.__FORM_SUBMIT_HANDLER_ADDED__ = true;

        form.addEventListener('submit', async function (e) {
          e.preventDefault();

          // Si ya se procesó una vez (por duplicidad), no volver a validar ni alertar
          if (window.__FORM_SUBMITTED__) return;
          window.__FORM_SUBMITTED__ = true;

          const btn = form.querySelector('button[type="submit"]');
          const originalBtnText = btn ? btn.textContent : 'Enviar solicitud';
          if (btn) {
            btn.disabled = true;
            btn.textContent = 'Enviando...';
          }

          const usuarioEl = document.getElementById('usuario');
          const cancionEl = document.getElementById('cancion');
          const artistaEl = document.getElementById('artista');
          const linkEl = document.getElementById('link');

          const usuarioText = (usuarioEl.value || '').trim().replace(/^@/, '');
          const usuarioSel = (usuarioSelect?.value || '').trim().replace(/^@/, '');
          const usuario = usuarioText || usuarioSel;

          const cancion = (cancionEl.value || '').trim();
          const artista = (artistaEl.value || '').trim();
          const link = (linkEl.value || '').trim();

          // Si no hay cancion/artista pero hay link, intentar extraer antes de validar
          // Si hay link, intentar extraer metadatos para asegurar que finalCancion/finalArtista son correctos
          let finalCancion = cancion;
          let finalArtista = artista; 

          if (link) {
             // Si el link cambió respecto al último blur o si no tenemos datos, extraemos
             if (link !== lastExtractedUrl || !finalCancion || !finalArtista) {
               const meta = await extractMetadata(link);
               if (meta) {
                 // Si el título actual coincide con el "Cargando..." o el autoFilledData viejo, actualizar
                 if (!finalCancion || finalCancion === autoFilledData.title || finalCancion === 'Cargando...') finalCancion = meta.title;
                 if (!finalArtista || finalArtista === autoFilledData.artist || finalArtista === 'Cargando...') finalArtista = meta.artist;
                 
                 lastExtractedUrl = link;
                 autoFilledData = { title: meta.title, artist: meta.artist };
               }
             }
          }

          // Nueva validación: Link puede sustituir cancion/artista si se provee
          if (!usuario || (!link && (!finalCancion || !finalArtista))) {
            alert('Por favor completa tu Usuario y al menos la Canción/Artista o un Link de referencia.');
            window.__FORM_SUBMITTED__ = false;
            if (btn) {
              btn.disabled = false;
              btn.textContent = originalBtnText;
            }
            return;
          }

          // Si aún no hay datos, poner valores temporales
          if (!finalCancion) finalCancion = (link ? "Enlace Externo" : "");
          if (!finalArtista) finalArtista = (link ? "Ver Link" : "");

          const ts = Date.now();
          const dayKey = getLocalDateKey(ts);

          let liveCode = '';
          const liveStatus = await fetchLiveCodeStatus();
          if (liveStatus.required) {
            liveCode = String(window.prompt('Ingresa el Código del Live para enviar tu solicitud:') || '').trim();
            if (!liveCode) {
              alert('Se requiere Código del Live para enviar la solicitud.');
              window.__FORM_SUBMITTED__ = false;
              if (btn) {
                btn.disabled = false;
                btn.textContent = originalBtnText;
              }
              return;
            }
          }

          const now = new Date(ts);
          const hh = String(now.getHours()).padStart(2, '0');
          const mm = String(now.getMinutes()).padStart(2, '0');
          const ss = String(now.getSeconds()).padStart(2, '0');
          const hora = `${hh}:${mm}:${ss}`;
          const songId = `${usuario}-${finalCancion}-${finalArtista}-${hora}`.replace(/[^a-zA-Z0-9-]/g, '');

          // --- DETECCIÓN DE GÉNERO (NUEVO) ---
          let genre = '';
          try {
            const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(finalCancion + ' ' + finalArtista)}&media=music&limit=1`;
            const resp = await fetchWithTimeout(searchUrl, { timeout: 2500 });
            const data = await resp.json();
            if (data.results && data.results.length > 0) {
              genre = data.results[0].primaryGenreName || '';
            }
          } catch (e) {
            console.warn('No se pudo autodetectar el género:', e);
          }

          // Guardar en Firestore (sincronización multi-dispositivo)
          const solicitudPayload = {
            id: songId,
            usuario,
            displayName: usuario,
            cancion: finalCancion,
            artista: finalArtista,
            link: link || '', // NUEVO: Guardar el enlace
            genre: genre, // Guardar el género detectado
            ts: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending',
            day: dayKey,
            source: 'web',
            ...(liveCode ? { liveCode } : {})
          };
          let remotePersisted = false;

          try {
            if (db) {
              if (firebase?.auth) {
                const hasUser = !!firebase.auth().currentUser;
                if (!hasUser) {
                  const ok = await Promise.race([
                    authReadyPromise,
                    new Promise((resolve) => setTimeout(() => resolve(false), 6000))
                  ]);
                  if (!ok || !firebase.auth().currentUser) {
                    console.warn('No se pudo autenticar completamente, pero seguimos con localStorage');
                  }
                }
              }

            await Promise.race([
                db.collection('solicitudes').add(solicitudPayload),
                new Promise((_, reject) => setTimeout(() => reject(new Error('WRITE_TIMEOUT')), 8000))
              ]);
              remotePersisted = true;
            } else {
               throw new Error('DATABASE_NOT_AVAILABLE');
            }
          } catch (err) {
            console.error('Error procesando solicitud:', err);
            
            // GUARDAR LOCALMENTE SIEMPRE QUE FALLE FIRESTORE O NO ESTÉ DISPONIBLE
            try {
              const byDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');
              (byDay[dayKey] ??= []).push({ usuario, cancion: finalCancion, artista: finalArtista, link: link || '', time: ts });
              localStorage.setItem('solicitudes_by_day', JSON.stringify(byDay));
              
              const arr = JSON.parse(localStorage.getItem('solicitudes') || '[]');
              arr.push({ usuario, cancion: finalCancion, artista: finalArtista, link: link || '', time: ts });
              localStorage.setItem('solicitudes', JSON.stringify(arr));
            } catch (e) {
              console.error('Error guardando en localStorage:', e);
            }
            
            localStorage.setItem('currentUser', usuario);
            window.__FORM_SUBMITTED__ = false;
            resetFormAndMetadata();
            window.location.href = 'lista.html';
            return;
          }
          // Guardar el último usuario utilizado para facilitar próximas solicitudes
          localStorage.setItem('currentUser', usuario);

          // Gamificación: puntos se otorgan solo al marcar reproducción

          // Limpiar flags y formulario tras éxito (ANTES de redirigir)
          window.__FORM_SUBMITTED__ = false;
          resetFormAndMetadata();

          // Mostrar Modal Glassmorphism de "Canción en cola"
          const glassOverlay = document.createElement('div');
          glassOverlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            z-index: 999999;
            display: flex;
            justify-content: center;
            align-items: center;
            opacity: 0;
            transition: opacity 0.4s ease;
          `;
          const glassCard = document.createElement('div');
          glassCard.style.cssText = `
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            border-left: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 24px;
            padding: 40px 30px;
            width: 90%;
            max-width: 380px;
            text-align: center;
            box-shadow: 0 30px 60px rgba(0,0,0,0.6);
            transform: translateY(40px) scale(0.9);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            color: #fff;
            font-family: 'Avenir', 'Inter', system-ui, sans-serif;
          `;
          glassCard.innerHTML = `
            <div style="font-size: 4rem; margin-bottom: 20px;">🎵</div>
            <h2 style="margin: 0 0 15px 0; font-weight: 800; font-size: 1.5rem; letter-spacing: 0.5px; background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">¡CANCIÓN EN LA COLA!</h2>
            <p style="color: rgba(255,255,255,0.85); line-height: 1.6; margin-bottom: 30px; font-size: 1.05rem;">
              Tu solicitud ha sido enviada con éxito. Ganarás <strong style="color: #00f2fe;">25 puntos</strong> en cuanto el DJ la reproduzca al aire. ¡Quédate escuchando!
            </p>
            <button id="glass-redirect-btn" style="
              background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
              border: none;
              padding: 14px 35px;
              border-radius: 30px;
              color: #000;
              font-weight: 800;
              font-size: 1.0rem;
              cursor: pointer;
              letter-spacing: 0.5px;
              box-shadow: 0 4px 15px rgba(0, 242, 254, 0.4);
              transition: all 0.2s ease;
              width: 100%;
              max-width: 280px;
            ">VER MI CANCIÓN EN COLA 📋</button>
          `;
          glassOverlay.appendChild(glassCard);
          document.body.appendChild(glassOverlay);

          requestAnimationFrame(() => {
            glassOverlay.style.opacity = '1';
            glassCard.style.transform = 'translateY(0) scale(1)';
          });

          document.getElementById('glass-redirect-btn').addEventListener('click', () => {
            window.location.href = 'lista.html';
          });
        });
      }

      // Modo Admin: gestión de VIP y visualización de usuarios registrados
      const ADMIN_PASS = '1415130*';
      const adminBtn = document.getElementById('admin-btn');
      const adminPanel = document.getElementById('admin-panel');

      // Referencias del modal
      const adminModal = document.getElementById('admin-modal');
      const adminPassInput = document.getElementById('admin-pass-input');
      const adminPassError = document.getElementById('admin-pass-error');
      const adminPassCancelBtn = document.getElementById('admin-pass-cancel');
      const adminPassConfirmBtn = document.getElementById('admin-pass-confirm');

      const vipAddBtn = document.getElementById('vip-add');
      const vipListEl = document.getElementById('vip-list');
      const usersSelectEl = document.getElementById('all-users-select');
      const wipeAllBtn = document.getElementById('wipe-all');

      function normUser(u) {
        return String(u || '').trim().toLowerCase().replace(/^@/, '');
      }
      function escapeHTML(str) {
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function getVipUsers() {
        const arr = JSON.parse(localStorage.getItem('vipUsers') || '[]');
        return Array.isArray(arr) ? arr : [];
      }
      function setVipUsers(arr) {
        localStorage.setItem('vipUsers', JSON.stringify(arr));
      }
      function renderVipList() {
        const vipUsers = getVipUsers();
        vipListEl.innerHTML = vipUsers.map(u => `
          <li>
            <span>@${escapeHTML(u)}</span>
            <button type="button" class="remove-btn" data-user="${escapeHTML(u)}">Eliminar</button>
          </li>
        `).join('');
      }
      async function renderAllUsersSelect() {
        if (!usersSelectEl) return;
        const users = await collectRegisteredUsers();
        usersSelectEl.innerHTML = '<option value="">Selecciona un usuario</option>' +
          users.map(u => `<option value="${escapeHTML(u)}">@${escapeHTML(u)}</option>`).join('');
      }

      // Asegurar oculto al cargar
      adminModal && (adminModal.hidden = true);
      adminPanel && (adminPanel.hidden = true);

      // Abrir modal solo al hacer click en "Modo Admin"
      adminBtn?.addEventListener('click', () => {
        if (!adminModal || !adminPassInput || !adminPassError) return;
        adminModal.hidden = false;
        adminPassInput.value = '';
        adminPassError.hidden = true;
        adminPassInput.focus();
      });

      function tryOpenAdmin() {
        const pass = adminPassInput?.value;
        if (pass === ADMIN_PASS) {
          if (!adminModal || !adminPanel) return;
          adminModal.hidden = true;
          adminPanel.hidden = false;
          // Inicializar contenido del panel
          renderVipList?.();
          renderAllUsersSelect?.();
        } else {
          if (!adminPassError || !adminPassInput) return;
          adminPassError.hidden = false;
          adminPassInput.focus();
        }
      }

      adminPassConfirmBtn?.addEventListener('click', tryOpenAdmin);
      adminPassCancelBtn?.addEventListener('click', () => {
        if (adminModal) adminModal.hidden = true; // cerrar modal sin abrir panel
      });
      adminPassInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          tryOpenAdmin();
        }
      });

      vipAddBtn?.addEventListener('click', async () => {
          const raw = usersSelectEl?.value || '';
          const user = normUser(raw);
          if (!user) {
            alert('Selecciona un usuario registrado.');
            return;
          }
          const vipUsers = getVipUsers();
          if (vipUsers.includes(user)) {
            alert('Ese usuario ya es VIP.');
            return;
          }
          
          try {
            await db.collection('vipUsers').doc(user).set({ 
              name: user,
              activatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            vipUsers.push(user);
            setVipUsers(vipUsers);
            renderVipList();
            alert('Usuario VIP agregado correctamente.');
          } catch (err) {
            console.error('Error guardando VIP:', err);
            alert('Error al guardar VIP en la nube.');
          }
        });

      vipListEl?.addEventListener('click', (e) => {
        const btn = e.target.closest('.remove-btn');
        if (!btn) return;
        const user = btn.getAttribute('data-user');
        if (!user) return;
        const vipUsers = getVipUsers().filter(u => u !== user);
        setVipUsers(vipUsers);
        renderVipList();
      });

      wipeAllBtn?.addEventListener('click', () => {
        const ok = confirm('Esto borrará todas las solicitudes guardadas (todos los días). ¿Quieres continuar?');
        if (!ok) return;
        localStorage.removeItem('solicitudes_by_day');
        localStorage.removeItem('solicitudes');
        renderAllUsersSelect();
        alert('Solicitudes borradas. La lista está limpia.');
      });
    })();

// Autenticación: ya se gestiona arriba durante la inicialización principal.

  // ===== FUNCIONES DE GAMIFICACIÓN =====
  
  function getSongDay(s) {
    const t = s?.timestamp || s?.ts || s?.time;
    try {
      const d = t ? new Date(t) : new Date();
      return d.toISOString().split('T')[0];
    } catch (_) {
      return '';
    }
  }

  // Configuración del sistema de puntos
  const POINTS_CONFIG = {
    SONG_REQUEST: 25,
    DAILY_BONUS: 5,
    STREAK_MULTIPLIER: 2,
    VIP_BONUS: 40
  };

  function getGamificationData(usuario) {
    const allStr = localStorage.getItem('gamificationData') || '{}';
    const all = JSON.parse(allStr);
    const u = (usuario || '').toLowerCase();
    const d = all[u];
    return d || {
      points: 0,
      level: 1,
      xp: 0,
      achievements: [],
      streaks: { current: 0, best: 0, lastActivity: null, calendar: {} },
      stats: { totalSongs: 0, uniqueArtists: 0, activeDays: 0, isVip: false }
    };
  }

  function saveGamificationData(usuario, data) {
    if (!usuario || usuario === 'null' || usuario === 'undefined' || usuario.toLowerCase() === 'text/plain') {
      console.warn(`⚠️ Intento de guardar datos para usuario inválido: ${usuario}`);
      return;
    }
    const u = (usuario || '').toLowerCase();
    const allStr = localStorage.getItem('gamificationData') || '{}';
    const all = JSON.parse(allStr);
    all[u] = data;
    localStorage.setItem('gamificationData', JSON.stringify(all));
    try {
      const db = firebase.firestore();
      db.collection('userStats').doc(u).set({
        gamification: data,
        currentStreak: Number((data.streaks && data.streaks.current) || 0),
        bestStreak: Number((data.streaks && data.streaks.best) || 0),
        lastActivity: (data.streaks && data.streaks.lastActivity) || null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (_) {}
  }

  function addPoints(usuario, points) {
    const data = getGamificationData(usuario);
    data.points += points;
    data.xp += points;
    const newLevel = calculateLevel(data.xp);
    if (newLevel > data.level) data.level = newLevel;
    saveGamificationData(usuario, data);
    return data;
  }

  function calculateLevel(xp) {
    const levels = [
      { level: 1, xpRequired: 0 },
      { level: 2, xpRequired: 100 },
      { level: 3, xpRequired: 250 },
      { level: 4, xpRequired: 500 },
      { level: 5, xpRequired: 1000 },
      { level: 6, xpRequired: 2000 },
      { level: 7, xpRequired: 5000 }
    ];
    
    for (let i = levels.length - 1; i >= 0; i--) {
      if (xp >= levels[i].xpRequired) {
        return levels[i].level;
      }
    }
    return 1;
  }

  function updateStreak(usuario) {
    const data = getGamificationData(usuario);
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    function getRequestsForDay(day) {
      const byDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');
      if (Array.isArray(byDay[day]) && byDay[day].length) return byDay[day];
      const arr = JSON.parse(localStorage.getItem('solicitudes') || '[]');
      return arr.filter(s => {
        const sday = s.day || getSongDay(s);
        return sday === day;
      });
    }

    const norm = v => String(v || '').trim().replace(/^@/, '').toLowerCase();
    const todayRequests = getRequestsForDay(today);
    const distinctUsersToday = new Set(todayRequests.map(s => s && norm(s.usuario))).size;
    const userRequestedToday = todayRequests.some(s => s && norm(s.usuario) === norm(usuario));

    // Día válido: 2+ usuarios distintos y el usuario actual solicitó
    const todayValid = distinctUsersToday >= 2 && userRequestedToday;

    if (!todayValid) {
      // Día inválido: no modificar la racha ni el calendario
      saveGamificationData(usuario, data);
      return data.streaks.current;
    }

    // Consecutividad: incrementa solo si ayer también fue válido
    const yesterdayValid = !!data.streaks.calendar[yesterday];
    if (yesterdayValid) {
      data.streaks.current++;
    } else if (data.streaks.lastActivity !== today) {
      data.streaks.current = 1;
    }

    // Record: conservar y actualizar si se supera
    if (data.streaks.current > data.streaks.best) {
      data.streaks.best = data.streaks.current;
    }

    data.streaks.lastActivity = today;
    data.streaks.calendar[today] = true; // solo marcamos días válidos

    saveGamificationData(usuario, data);
    return data.streaks.current;
  }

  (function migrateLegacyGamification(){
    try {
      const keys = Object.keys(localStorage);
      const allStr = localStorage.getItem('gamificationData') || '{}';
      const all = JSON.parse(allStr);
      keys.forEach(k => {
        if (k.startsWith('gamificationData_')) {
          const user = k.replace('gamificationData_','').toLowerCase();
          const d = JSON.parse(localStorage.getItem(k) || '{}');
          if (d && Object.keys(d).length) {
            all[user] = d;
            localStorage.removeItem(k);
          }
        }
      });
      localStorage.setItem('gamificationData', JSON.stringify(all));
    } catch (_){}
  })();
  function calculateUserStats(usuario) {
    const solicitudes = JSON.parse(localStorage.getItem('solicitudes') || '[]');
    const vipUsers = JSON.parse(localStorage.getItem('vipUsers') || '[]');
    
    const userSongs = solicitudes.filter(s => s.usuario === usuario);
    const uniqueArtists = [...new Set(userSongs.map(s => s.artista))].length;
    const uniqueDays = [...new Set(userSongs.map(s => s.fecha?.split('T')[0]))].length;
    const isVip = vipUsers.includes(usuario);

    return {
      totalSongs: userSongs.length,
      uniqueArtists,
      activeDays: uniqueDays,
      isVip
    };
  }

  function processNewSongRequest(usuario) {
    const streakDays = updateStreak(usuario);
    let points = POINTS_CONFIG.SONG_REQUEST;
    
    // Bonus por racha
    if (streakDays > 1) {
      points += POINTS_CONFIG.STREAK_MULTIPLIER * Math.min(streakDays - 1, 10);
    }
    
    // Bonus VIP
    const vipUsers = JSON.parse(localStorage.getItem('vipUsers') || '[]');
    if (vipUsers.includes(usuario)) {
      points += POINTS_CONFIG.VIP_BONUS;
    }
    
    const data = addPoints(usuario, points);
    
    // Actualizar estadísticas
    const stats = calculateUserStats(usuario);
    data.stats = { ...data.stats, ...stats };
    saveGamificationData(usuario, data);
    
    // Mostrar notificación de puntos ganados
    showPointsNotification(points, streakDays);
  }

  function showPointsNotification(points, streak) {
    // Crear notificación temporal
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #4CAF50, #45a049);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      z-index: 1000;
      animation: slideInRight 0.3s ease;
      max-width: 300px;
      font-family: 'Avenir', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    let message = `+${points} puntos ganados! 🎵`;
    if (streak > 1) {
      message += `<br><small>Racha de ${streak} días! 🔥</small>`;
    }
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 24px;">🏆</div>
        <div style="font-size: 14px; line-height: 1.3;">${message}</div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Agregar estilos para la animación
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  // Ejemplo: cuando envías la solicitud, asegúrate de usar serverTimestamp() del SDK compat
  // await db.collection('solicitudes').add({
  //   usuario, cancion, artista, day,
  //   ts: firebase.firestore.FieldValue.serverTimestamp(),
  // });
  (function hydrateCurrentUserPoints(){
    try {
      const current = String(localStorage.getItem('currentUser') || '').trim().replace(/^@/, '').toLowerCase();
      if (!current) return;
      const db = firebase.firestore();
      db.collection('userStats').doc(current).onSnapshot((doc) => {
        if (!doc || !doc.exists) return;
        const allStr = localStorage.getItem('gamificationData') || '{}';
        const all = JSON.parse(allStr);
        const d = all[current] || {
          points: 0,
          level: 1,
          xp: 0,
          achievements: [],
          streaks: { current: 0, best: 0, lastActivity: null, calendar: {} },
          stats: { totalSongs: 0, uniqueArtists: 0, activeDays: 0, isVip: false }
        };
        const data = doc.data() || {};
        if (typeof data.totalPoints === 'number') d.points = data.totalPoints;
        if (typeof data.currentStreak === 'number') d.streaks.current = data.currentStreak;
        if (typeof data.bestStreak === 'number') d.streaks.best = data.bestStreak;
        if (typeof data.lastActivity === 'string') d.streaks.lastActivity = data.lastActivity;
        
        // Cargar payload guardado desde lista.js si existe
        if (data.gamification) {
          if (data.gamification.achievements) d.achievements = data.gamification.achievements;
          if (data.gamification.stats) d.stats = data.gamification.stats;
          if (data.gamification.level) d.level = data.gamification.level;
          if (data.gamification.streaks && data.gamification.streaks.calendar) d.streaks.calendar = data.gamification.streaks.calendar;
        }

        all[current] = d;
        localStorage.setItem('gamificationData', JSON.stringify(all));
        try { if (typeof updatePointsIndicator === 'function') updatePointsIndicator(); } catch (_){}
      }, (err) => {
        console.error("Error sincronizando gamificationData en tiempo real:", err);
      });
    } catch (_){}
  })();
  window.debugUserPoints = async function(usuario){
    try {
      const u = String(usuario||'').toLowerCase();
      const db = firebase.firestore();
      const doc = await db.collection('userStats').doc(u).get();
      const cloud = doc.exists ? doc.data() : null;
      const local = (JSON.parse(localStorage.getItem('gamificationData')||'{}')[u])||null;
      return { usuario: u, cloud, local };
    } catch (e) {
      return { error: String(e&&e.message||e) };
    }
  };

