// --- Configuración / Settings Logic ---
    const defaultSettings = {
      layoutMode: 'default', // default | glass
      width: 400, // Ajustado para 1080p
      minHeight: 100,
      borderRadius: 8,
      animType: 'anim-flip',
      textAnim: 'text-anim-fade',
      font: "'Montserrat', sans-serif",
      // Default font sizes optimized for 1080p vertical
      fontSizeSong: 42,
      fontSizeArtist: 28,
      fontSizeUser: 21,
      fontSizeHeader: 24,
      accent: "#ff0055",
      icon: "🎵",
      iconCircleSize: 50,
      iconFontSize: 25,
      iconBg: "#ffffff",
      iconOpacity: 20,
      bg: "#000000",
      opacity: 85,
      text: "#ffffff",
      duration: 10,
      autocorrect: true,
      sepColor: "#ffffff",
      sepUseAccent: true,
      sepOpacity: 10,
      sepWidth: 1,
      sepStyle: "solid"
    };

    const presetConfigs = {
      default: {
        layoutMode: 'default',
        width: 400,
        minHeight: 100,
        borderRadius: 8,
        opacity: 85,
        iconCircleSize: 50,
        iconFontSize: 25
      },
      glass: {
        layoutMode: 'glass',
        width: 550,
        minHeight: 150,
        borderRadius: 25,
        opacity: 40,
        iconCircleSize: 0, // Icon hidden in glass mode via CSS, but good to reset
        iconFontSize: 0
      },
      vision: {
        layoutMode: 'vision',
        width: 500,
        minHeight: 130,
        borderRadius: 30,
        opacity: 45,
        iconCircleSize: 0,
        iconFontSize: 0
      }
    };

    let displayDuration = 10000;

    function loadSettings() {
      const saved = localStorage.getItem('overlay_settings');
      // Merge saved with default to ensure new keys exist
      let settings = saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
      
      // Migration check: 
      // 1. Old fontSize -> specific sizes
      if(saved) {
         const parsed = JSON.parse(saved);
         if(!parsed.fontSizeSong && parsed.fontSize) {
            settings.fontSizeSong = Math.round(parsed.fontSize * 1.5);
            settings.fontSizeArtist = parsed.fontSize;
            settings.fontSizeUser = Math.round(parsed.fontSize * 0.75);
            settings.fontSizeHeader = Math.round(parsed.fontSize * 0.875);
         }
         // 2. Old iconSize -> iconCircleSize + iconFontSize
         if (parsed.iconSize && !parsed.iconCircleSize) {
            settings.iconCircleSize = parsed.iconSize;
            settings.iconFontSize = Math.round(parsed.iconSize * 0.5);
         }
      }

      applySettings(settings);
      
      // Update Inputs
      document.getElementById('inp-preset').value = settings.layoutMode || 'default';
      document.getElementById('inp-width').value = settings.width;
      document.getElementById('inp-minHeight').value = settings.minHeight;
      document.getElementById('inp-borderRadius').value = settings.borderRadius;
      document.getElementById('inp-animType').value = settings.animType;
      document.getElementById('inp-textAnim').value = settings.textAnim || 'text-anim-fade';
      
      document.getElementById('inp-font').value = settings.font;
      
      document.getElementById('inp-fontSizeSong').value = settings.fontSizeSong;
      document.getElementById('inp-fontSizeArtist').value = settings.fontSizeArtist;
      document.getElementById('inp-fontSizeUser').value = settings.fontSizeUser;
      document.getElementById('inp-fontSizeHeader').value = settings.fontSizeHeader;

      document.getElementById('inp-accent').value = settings.accent;
      document.getElementById('inp-icon').value = settings.icon || '🎵';
      document.getElementById('inp-iconCircleSize').value = settings.iconCircleSize || 50;
      document.getElementById('inp-iconFontSize').value = settings.iconFontSize || 25;
      document.getElementById('inp-iconBg').value = settings.iconBg || '#ffffff';
      
      const iconOpVal = settings.iconOpacity !== undefined ? settings.iconOpacity : 20;
      document.getElementById('inp-iconOpacity').value = iconOpVal;
      document.getElementById('icon-opacity-val').innerText = iconOpVal + '%';

      document.getElementById('inp-bg').value = settings.bg;
      
      const opVal = settings.opacity !== undefined ? settings.opacity : 85;
      document.getElementById('inp-opacity').value = opVal;
      document.getElementById('bg-opacity-val').innerText = opVal + '%';

      document.getElementById('inp-text').value = settings.text;
      document.getElementById('inp-duration').value = settings.duration !== undefined ? settings.duration : 10;
      
      document.getElementById('inp-sepColor').value = settings.sepColor || '#ffffff';
      document.getElementById('inp-sepUseAccent').checked = settings.sepUseAccent !== undefined ? settings.sepUseAccent : true;
      toggleSepColorInput(); 

      const sepOpVal = settings.sepOpacity !== undefined ? settings.sepOpacity : 10;
      document.getElementById('inp-sepOpacity').value = sepOpVal;
      document.getElementById('sep-opacity-val').innerText = sepOpVal + '%';

      document.getElementById('inp-sepWidth').value = settings.sepWidth !== undefined ? settings.sepWidth : 1;
      document.getElementById('inp-sepStyle').value = settings.sepStyle || 'solid';
    }

    function applySettings(s) {
      window.appliedOverlaySettings = s;
      // Apply Layout Mode
      const card = document.getElementById('card');
      const art = document.getElementById('album-art');
      card.classList.remove('layout-glass', 'layout-vision');
      if (s.layoutMode === 'glass') {
          card.classList.add('layout-glass');
          if (!art.src || art.src === window.location.href || art.src === '') {
              art.src = 'https://via.placeholder.com/150/000000/FFFFFF/?text=🎵'; 
          }
      } else if (s.layoutMode === 'vision') {
          card.classList.add('layout-vision');
          if (!art.src || art.src === window.location.href || art.src === '') {
              art.src = 'https://via.placeholder.com/150/000000/FFFFFF/?text=🎵'; 
          }
      }

      const root = document.documentElement;
      root.style.setProperty('--card-width', s.width + 'px');
      root.style.setProperty('--card-min-height', s.minHeight + 'px');
      root.style.setProperty('--card-border-radius', s.borderRadius + 'px');
      
      // Apply Animation Class to Container or Card Wrapper
      const container = document.getElementById('notification-container');
      // Reset animation classes
      container.className = '';
      container.classList.add(s.animType);
      if (s.textAnim) container.classList.add(s.textAnim);

      root.style.setProperty('--font-family', s.font);
      
      // Apply specific font sizes
      root.style.setProperty('--font-size-song', s.fontSizeSong + 'px');
      root.style.setProperty('--font-size-artist', s.fontSizeArtist + 'px');
      root.style.setProperty('--font-size-user', s.fontSizeUser + 'px');
      root.style.setProperty('--font-size-header', s.fontSizeHeader + 'px');

      root.style.setProperty('--accent-color', s.accent);
      root.style.setProperty('--text-color', s.text);
      
      // Icon Content & Size
          let iconChar = s.icon || '🎵';
          // Fix: Si viene sin comillas, agregarlas para CSS content property
          if (!iconChar.startsWith('"') && !iconChar.startsWith("'")) {
             iconChar = `"${iconChar}"`;
          }
          root.style.setProperty('--icon-content', iconChar);
          root.style.setProperty('--icon-circle-size', (s.iconCircleSize || 50) + 'px');
          root.style.setProperty('--icon-font-size', (s.iconFontSize || 25) + 'px');

      // Icon Background Color
      const ir = parseInt((s.iconBg || '#ffffff').substr(1,2), 16);
      const ig = parseInt((s.iconBg || '#ffffff').substr(3,2), 16);
      const ib = parseInt((s.iconBg || '#ffffff').substr(5,2), 16);
      let iOp = s.iconOpacity;
      if (iOp === undefined || iOp === null || iOp === "") iOp = 20;
      root.style.setProperty('--icon-bg-color', `rgba(${ir},${ig},${ib},${parseFloat(iOp)/100})`);
      
      const r = parseInt(s.bg.substr(1,2), 16);
      const g = parseInt(s.bg.substr(3,2), 16);
      const b = parseInt(s.bg.substr(5,2), 16);
      
      // Asegurarse que opacity sea un número entre 0 y 1
      let rawOpacity = s.opacity;
      if (rawOpacity === undefined || rawOpacity === null || rawOpacity === "") {
        rawOpacity = 85;
      }
      const opacity = parseFloat(rawOpacity) / 100;
      
      root.style.setProperty('--card-bg-color', `rgba(${r},${g},${b},${opacity})`);

      // Calculate accent color rgba variants
      const ar = parseInt(s.accent.substr(1,2), 16);
      const ag = parseInt(s.accent.substr(3,2), 16);
      const ab = parseInt(s.accent.substr(5,2), 16);
      root.style.setProperty('--accent-color-bg', `rgba(${ar},${ag},${ab},0.2)`);
      root.style.setProperty('--accent-color-glow', `rgba(${ar},${ag},${ab},0.4)`);
      
      // Separator
      let finalSepColor = s.sepColor || '#ffffff';
      if (s.sepUseAccent) {
         finalSepColor = s.accent;
      }

      const sr = parseInt(finalSepColor.substr(1,2), 16);
      const sg = parseInt(finalSepColor.substr(3,2), 16);
      const sb = parseInt(finalSepColor.substr(5,2), 16);
      const sepOp = (s.sepOpacity !== undefined ? s.sepOpacity : 10) / 100;
      
      root.style.setProperty('--sep-color', `rgba(${sr},${sg},${sb},${sepOp})`);
      root.style.setProperty('--sep-width', (s.sepWidth || 1) + 'px');
      root.style.setProperty('--sep-style', s.sepStyle || 'solid');
      
      // UI Update for disabled state
      toggleSepColorInput();

      displayDuration = (s.duration !== undefined ? s.duration : 10) * 1000;
    }

    function toggleSepColorInput() {
       const cb = document.getElementById('inp-sepUseAccent');
       const inp = document.getElementById('inp-sepColor');
       if(cb && inp) {
          inp.disabled = cb.checked;
          inp.style.opacity = cb.checked ? '0.5' : '1';
       }
    }

    function getSettingsFromInputs() {
      const getNum = (id, fallback) => {
        const el = document.getElementById(id);
        if (!el) return fallback;
        const val = el.value;
        const num = parseInt(val, 10);
        return isNaN(num) || val === '' ? fallback : num;
      };
      return {
        layoutMode: document.getElementById('inp-preset').value,
        width: getNum('inp-width', 400),
        minHeight: getNum('inp-minHeight', 100),
        borderRadius: getNum('inp-borderRadius', 8),
        animType: document.getElementById('inp-animType').value,
        textAnim: document.getElementById('inp-textAnim').value,
        font: document.getElementById('inp-font').value,
        
        fontSizeSong: getNum('inp-fontSizeSong', 42),
        fontSizeArtist: getNum('inp-fontSizeArtist', 28),
        fontSizeUser: getNum('inp-fontSizeUser', 21),
        fontSizeHeader: getNum('inp-fontSizeHeader', 24),

        accent: document.getElementById('inp-accent').value,
        icon: document.getElementById('inp-icon').value,
        iconCircleSize: getNum('inp-iconCircleSize', 50),
        iconFontSize: getNum('inp-iconFontSize', 25),
        iconBg: document.getElementById('inp-iconBg').value,
        iconOpacity: getNum('inp-iconOpacity', 20),
        bg: document.getElementById('inp-bg').value,
        opacity: getNum('inp-opacity', 85),
        text: document.getElementById('inp-text').value,
        duration: getNum('inp-duration', 10),
        autocorrect: defaultSettings.autocorrect === true,
        sepColor: document.getElementById('inp-sepColor').value,
        sepUseAccent: document.getElementById('inp-sepUseAccent').checked,
        sepOpacity: getNum('inp-sepOpacity', 10),
        sepWidth: getNum('inp-sepWidth', 1),
        sepStyle: document.getElementById('inp-sepStyle').value
      };
    }

    function previewSettings() {
      const settings = getSettingsFromInputs();
      console.log('Previewing settings:', settings);
      console.log(`Applying sizes - Circle: ${settings.iconCircleSize}, Icon: ${settings.iconFontSize}`);
      applySettings(settings);
    }

    function saveSettings() {
      const settings = getSettingsFromInputs();
      console.log('Saving settings:', settings);
      localStorage.setItem('overlay_settings', JSON.stringify(settings));
      applySettings(settings);
      
      // Sync to Firestore
      if (db) {
        db.collection('userSettings').doc('global_overlay_config').set(settings)
          .then(() => console.log("Configuración guardada en la nube"))
          .catch(err => console.error("Error guardando configuración:", err));
      }

      toggleSettings(); // close panel
    }
    
    // Listeners para vista previa en tiempo real
    document.addEventListener('DOMContentLoaded', () => {
        ['inp-width', 'inp-minHeight', 'inp-borderRadius', 'inp-animType', 'inp-textAnim',
         'inp-font', 'inp-fontSizeSong', 'inp-fontSizeArtist', 'inp-fontSizeUser', 'inp-fontSizeHeader', 
         'inp-accent', 'inp-icon', 'inp-iconCircleSize', 'inp-iconFontSize', 'inp-iconBg', 'inp-iconOpacity',
         'inp-bg', 'inp-opacity', 'inp-text', 'inp-duration',
         'inp-sepColor', 'inp-sepUseAccent', 'inp-sepOpacity', 'inp-sepWidth', 'inp-sepStyle'].forEach(id => {
           const el = document.getElementById(id);
           if(el) {
             el.addEventListener('input', previewSettings);
             el.addEventListener('change', previewSettings);
           }
        });
    });

    function resetSettings() {
      if(confirm('¿Restablecer valores por defecto?')) {
        applySettings(defaultSettings);
        localStorage.removeItem('overlay_settings');
        loadSettings(); // reload inputs
        toggleSettings();
      }
    }

    function toggleSettings() {
      const panel = document.getElementById('settings-panel');
      panel.classList.toggle('open');
    }

    // Inicializar settings
    loadSettings();

    // Configuración de Firebase (Tomada de index.html)
    const firebaseConfig = {
      apiKey: "AIzaSyA6c3EaIvuPEfM6sTV0YHqCBHuz35ZmNIU",
      authDomain: "zero-strom-web.firebaseapp.com",
      projectId: "zero-strom-web",
      storageBucket: "zero-strom-web.firebasestorage.app",
      messagingSenderId: "758369466349",
      appId: "1:758369466349:web:f2ced362a5a049c70b59e4"
    };

    let db = null;
    try {
      if (typeof firebase !== 'undefined' && firebase.apps) {
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
      } else {
        console.warn('Firebase SDK not loaded');
      }
    } catch (e) {
      console.error('Error initializing Firebase:', e);
      try {
        db = firebase.firestore();
      } catch (_) {}
    }

    const card = document.getElementById('card');
    const songEl = document.getElementById('song');
    const artistEl = document.getElementById('artist');
    const userEl = document.getElementById('user');
    const userInsigniaEl = document.getElementById('user-insignia');

    let hideTimeout;
    
    // --- Queue Logic ---
    let notificationQueue = [];
    let isShowing = false;
    let isProcessing = false;

    function cleanTextForSearch(text) {
      if (!text) return '';
      return String(text)
        .replace(/\([\s\S]*?\)/g, ' ')
        .replace(/\[[\s\S]*?\]/g, ' ')
        .replace(/(official\s+video|official\s+audio|video\s+oficial|letra|lyrics|video\s+letra|audio\s+oficial|HD|HQ|1080p|4k)/gi, ' ')
        .replace(/\s+(feat|ft)\.?\s+[\s\S]+/gi, ' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function cleanArtistForSearch(artist) {
      if (!artist) return '';
      let clean = String(artist);
      const parts = clean.split(/,|\s+y\s+|\s+&\s+|\s+x\s+|\s+feat\.?\s+|\s+ft\.?\s+/i);
      if (parts.length > 0) {
        clean = parts[0];
      }
      return cleanTextForSearch(clean);
    }

    const songDataCache = {};
    async function fetchSongData(artist, song) {
      const cleanArtist = cleanArtistForSearch(artist);
      const cleanSong = cleanTextForSearch(song);
      const query = `${cleanArtist} ${cleanSong}`.trim();
      
      const rawQuery = `${artist || ''} ${song || ''}`.trim();
      const cacheKey = rawQuery.toLowerCase();
      
      if (!rawQuery) return null;
      if (songDataCache[cacheKey] !== undefined) return songDataCache[cacheKey];

      try {
        if (!query) {
          songDataCache[cacheKey] = null;
          return null;
        }

        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`);
        const data = await res.json();
        
        if (data && data.resultCount > 0 && Array.isArray(data.results)) {
          let track = data.results[0];
          const avoidKeywords = ['karaoke', 'tribute', 'cover', 'instrumental', 'remix', 'lullaby', 'rendition', 'slowed', 'reverb'];
          const cleanTrack = data.results.find(t => {
            const lowerName = (t.trackName || '').toLowerCase();
            const lowerArtist = (t.artistName || '').toLowerCase();
            const lowerCollection = (t.collectionName || '').toLowerCase();
            const hasBadWord = avoidKeywords.some(kw =>
              lowerName.includes(kw) ||
              lowerArtist.includes(kw) ||
              lowerCollection.includes(kw)
            );
            return !hasBadWord;
          });
          if (cleanTrack) track = cleanTrack;
          
          const result = {
            correctTitle: track.trackName,
            correctArtist: track.artistName,
            artworkUrl: track.artworkUrl100 ? track.artworkUrl100.replace('100x100', '600x600') : ''
          };
          songDataCache[cacheKey] = result;
          return result;
        } else {
          songDataCache[cacheKey] = null;
        }
      } catch (_) {
        songDataCache[cacheKey] = null;
      }
      return null;
    }

    async function normalizeRequestForDisplay(data) {
      const settings = window.appliedOverlaySettings || defaultSettings;
      if (data && !data.artworkUrl && data.cover) {
        data.artworkUrl = data.cover;
      }
      if (!settings || settings.autocorrect !== true) return data;
      if (!data || !data.cancion || !data.artista) return data;
      const info = await fetchSongData(data.artista, data.cancion);
      if (!info) return data;
      return {
        ...data,
        cancion: info.correctTitle || data.cancion,
        artista: info.correctArtist || data.artista,
        artworkUrl: info.artworkUrl || data.artworkUrl || ''
      };
    }

    function addToQueue(data) {
      console.log("Añadido a la cola:", data.cancion);
      notificationQueue.push(data);
      processQueue();
    }

    async function processQueue() {
      if (isShowing || isProcessing || notificationQueue.length === 0) return;
      isProcessing = true;
      
      const data = notificationQueue.shift();
      const normalized = await normalizeRequestForDisplay(data);
      // isProcessing = false; // ELIMINADO: showNotification ahora maneja isProcessing
      showNotification(normalized);
    }

    async function showNotification(data) {
      isProcessing = true; // Bloquear cola mientras se prepara
      isShowing = true;
      currentCardData = data;
      const artEl = document.getElementById('album-art');

      // Rellenar datos básicos
      songEl.textContent = data.cancion || 'Desconocida';
      artistEl.textContent = data.artista || 'Desconocido';
      const uname = data.displayName || data.usuario || 'Anónimo';
      userEl.textContent = uname;
      if (artEl) {
        const artUrl = String(data.artworkUrl || data.cover || '').trim();
        const settings = window.appliedOverlaySettings || defaultSettings;
        if (artUrl) {
          artEl.src = artUrl;
          artEl.style.display = 'block';
        } else if (settings.layoutMode === 'glass' || settings.layoutMode === 'vision') {
          artEl.src = 'https://via.placeholder.com/150/000000/FFFFFF/?text=🎵';
          artEl.style.display = 'block';
        } else {
          artEl.removeAttribute('src');
          artEl.style.display = 'none';
        }
      }
      
      // Intentar obtener foto de perfil de Firestore
      const headerEl = card.querySelector('.header');
      // Limpiar estado previo
      headerEl.classList.remove('has-profile-pic');
      const oldImg = headerEl.querySelector('.header-profile-pic');
      if (oldImg) oldImg.remove();
      
      let profilePicUrl = null;
      if (db && data.usuario) {
          try {
             // Buscar documento de usuario (intentar normalizar clave)
             const rawUser = String(data.usuario).trim().replace(/^@/, '').toLowerCase();
             // Normalización robusta (la misma que usa el bot para guardar)
             const normUser = rawUser.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
             
             // Intentamos obtener el doc directamente usando la clave normalizada
             let userDoc = await db.collection('userStats').doc(normUser).get();
             
             // Fallback: Si no existe con la clave normalizada, intentar con la simple (por compatibilidad)
             if (!userDoc.exists && rawUser !== normUser) {
                 userDoc = await db.collection('userStats').doc(rawUser).get();
             }

             if (userDoc.exists) {
                 const uData = userDoc.data();
                 if (uData && uData.profilePic) {
                     profilePicUrl = uData.profilePic;
                 } else if (uData && uData.gamification && uData.gamification.profilePic) {
                     profilePicUrl = uData.gamification.profilePic;
                 }
             }
          } catch (e) {
             console.warn('Error fetching profile pic for overlay:', e);
          }
      }
      
      if (profilePicUrl) {
          headerEl.classList.add('has-profile-pic');
          const img = document.createElement('img');
          img.src = profilePicUrl;
          img.className = 'header-profile-pic';
          img.alt = uname;
          // Insertar al principio
          headerEl.insertBefore(img, headerEl.firstChild);
      }

      applyBadgeToCard(data);

      // Mostrar tarjeta
      card.classList.remove('show');
      void card.offsetWidth; // Trigger reflow
      card.classList.add('show');
      
      isProcessing = false; // Liberar bloqueo

      // Limpiar timeout anterior si existe (seguridad)
      if (hideTimeout) clearTimeout(hideTimeout);

      // Ocultar después de X segundos
      hideTimeout = setTimeout(() => {
        card.classList.remove('show');
        
        // Esperar a que termine la animación de salida antes de procesar el siguiente
        // Asumimos unos 600ms de transición CSS + un pequeño buffer
        setTimeout(() => {
          isShowing = false;
          processQueue();
        }, 1000); 

      }, displayDuration);
    }

    // Variable para controlar la carga inicial
    let isInitialLoad = true;
    const overlayStartedAt = Date.now();
    const processedIds = new Set(); // Evitar duplicados

    function getLocalDateKey(ts) {
      const dt = ts ? new Date(ts) : new Date();
      try {
        const formatter = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Mexico_City',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        return formatter.format(dt);
      } catch (e) {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }

    const currentDay = getLocalDateKey();

    const vipSet = new Set();
    const z0VipSet = new Set();
    const donadorSet = new Set();
    const z0FanSet = new Set();
    const z0PlatinumSet = new Set();
    const superfanSet = new Set();
    let selectedBadgeMap = {};
    let currentCardData = null;

    window.userAliasesMap = {};
    function hasMembership(set, username) {
      if (!set || !(set instanceof Set) || set.size === 0) return false;
      if (!username) return false;
      const unameLc = normalizeUserKey(username);
      
      // 1. Verificar nombre de usuario directo
      if (set.has(unameLc)) return true;
      
      const map = window.userAliasesMap || {};
      
      // 2. Si el usuario es un handle de TikTok, verificar su usuario Web/YouTube vinculado
      const linkedWebUser = map[unameLc];
      if (linkedWebUser && set.has(linkedWebUser)) return true;
      
      // 3. Si el usuario es un usuario Web, verificar si algún handle de TikTok vinculado a él tiene membresía
      for (const [tiktokHandle, webUser] of Object.entries(map)) {
        if (webUser === unameLc) {
          if (set.has(tiktokHandle)) return true;
        }
      }
      return false;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const forcedBadgeParam = String(urlParams.get('badge') || '').trim();
    const forcedUserParam = String(urlParams.get('user') || '').trim();
    function normalizeUserForOverride(v) {
      try { return String(v || '').trim().replace(/^@/, '').toLowerCase(); } catch (_) { return ''; }
    }
    const forcedUserKey = normalizeUserForOverride(forcedUserParam);
    function getForcedBadgeForUser(username) {
      if (!forcedBadgeParam) return '';
      if (!forcedUserKey) return forcedBadgeParam;
      const u = normalizeUserForOverride(username);
      return (u && u === forcedUserKey) ? forcedBadgeParam : '';
    }

    function normalizeUserKey(v) {
      try {
        return String(v || '').trim().replace(/^@/, '').toLowerCase();
      } catch (_) {
        return '';
      }
    }

    function getBadgeForUser(data) {
      const u = normalizeUserKey((data && data.usuario) || '');
      const uid = normalizeUserKey((data && data.userId) || '');
      const d = normalizeUserKey((data && data.displayName) || '');
      const candidates = [];
      if (u) candidates.push(u);
      if (uid && uid !== u) candidates.push(uid);
      if (d && d !== u && d !== uid) candidates.push(d);
      if (!candidates.length) return '';
      
      const aliases = window.userAliasesMap || {};
      
      // 1. Primero comprobar insignias seleccionadas manualmente (incluyendo alias)
      for (let i = 0; i < candidates.length; i++) {
        const key = candidates[i];
        if (selectedBadgeMap && selectedBadgeMap[key]) return selectedBadgeMap[key];
        
        // TikTok handle -> Web/YouTube
        const linkedWebUser = aliases[key];
        if (linkedWebUser && selectedBadgeMap && selectedBadgeMap[linkedWebUser]) return selectedBadgeMap[linkedWebUser];
        
        // Web/YouTube -> TikTok handle
        for (const [tiktokHandle, webUser] of Object.entries(aliases)) {
          if (webUser === key && selectedBadgeMap && selectedBadgeMap[tiktokHandle]) {
            return selectedBadgeMap[tiktokHandle];
          }
        }
      }
      
      // 2. Comprobar membresías activas (incluyendo alias)
      for (let i = 0; i < candidates.length; i++) {
        const key = candidates[i];
        if (hasMembership(superfanSet, key)) return 'superfan';
        if (hasMembership(z0PlatinumSet, key)) return 'z0-platino';
        if (hasMembership(z0VipSet, key)) return 'z0-vip';
        if (hasMembership(vipSet, key)) return 'vip';
        if (hasMembership(donadorSet, key)) return 'donador';
        if (hasMembership(z0FanSet, key)) return 'z0-fan';
      }
      return '';
    }

    function applyBadgeToCard(data) {
      if (!userInsigniaEl) return;
      const direct = data && data.badge ? String(data.badge).trim() : '';
      const userNameForOverride = (data && (data.displayName || data.usuario)) ? String(data.displayName || data.usuario) : '';
      const forced = getForcedBadgeForUser(userNameForOverride);
      const badge = direct || forced || getBadgeForUser(data);
      userInsigniaEl.hidden = !badge;
      userInsigniaEl.className = 'user-insignia' + (badge ? ` ${badge}` : '');
      if (!badge) { userInsigniaEl.textContent = ''; return; }
      if (badge === 'superfan') userInsigniaEl.textContent = 'SF';
      else if (badge === 'vip') userInsigniaEl.textContent = 'VIP';
      else if (badge === 'z0-vip') userInsigniaEl.textContent = 'z0Vip';
      else if (badge === 'donador') userInsigniaEl.textContent = '🪙';
      else if (badge === 'z0-fan') userInsigniaEl.textContent = 'z0';
      else if (badge === 'z0-platino') userInsigniaEl.textContent = 'PLAT';
      else userInsigniaEl.textContent = badge;
    }

    let globalTopLikerOverlay = { name: 'N/D', count: 0 };
    
    let overlayRealtimeStarted = false;
    function startOverlayRealtime() {
      if (!db || overlayRealtimeStarted) return;
      overlayRealtimeStarted = true;

      // Escuchar el Top Liker global
      db.collection('globalStats').doc('general').onSnapshot(doc => {
          if(doc.exists) {
              const data = doc.data();
              if(data.topLiker && data.topLikerCount) {
                  // FIX: Mostrar solo los PUNTOS ganados por likes, no los likes totales.
                  // Asumimos 300 likes = 1 punto.
                  const likesPerPoint = 300; // Valor fijo visual o leer de configuración
                  const points = Math.floor(Number(data.topLikerCount) / likesPerPoint);
                  
                  // Si tiene menos de 300 likes, mostrar 0 puntos (o mostrar likes si prefieres)
                  // El usuario pidió "Top Puntos", así que mostramos puntos.
                  globalTopLikerOverlay = { name: data.topLiker, count: points };
                  console.log(`[Overlay] Top Liker actualizado: ${data.topLiker} (${points} pts)`);
              }
          }
      }, err => console.warn('Overlay: error leyendo globalStats:', err));

      db.collection('userSettings').doc('global_overlay_config')
        .onSnapshot((doc) => {
          if (doc.exists) {
            console.log("Configuración remota recibida");
            const remoteSettings = doc.data();
            const settings = { ...defaultSettings, ...remoteSettings };
            
            localStorage.setItem('overlay_settings', JSON.stringify(settings));
            applySettings(settings);
            
            if (document.getElementById('inp-width')) {
                document.getElementById('inp-width').value = settings.width;
                document.getElementById('inp-minHeight').value = settings.minHeight;
                document.getElementById('inp-borderRadius').value = settings.borderRadius;
                document.getElementById('inp-animType').value = settings.animType;
                document.getElementById('inp-textAnim').value = settings.textAnim || 'text-anim-fade';
                
                document.getElementById('inp-font').value = settings.font;
                
                document.getElementById('inp-fontSizeSong').value = settings.fontSizeSong;
                document.getElementById('inp-fontSizeArtist').value = settings.fontSizeArtist;
                document.getElementById('inp-fontSizeUser').value = settings.fontSizeUser;
                document.getElementById('inp-fontSizeHeader').value = settings.fontSizeHeader;
          
                document.getElementById('inp-accent').value = settings.accent;
                document.getElementById('inp-bg').value = settings.bg;
                
                const opVal = settings.opacity !== undefined ? settings.opacity : 85;
                document.getElementById('inp-opacity').value = opVal;
                document.getElementById('bg-opacity-val').innerText = opVal + '%';
          
                document.getElementById('inp-text').value = settings.text;
                document.getElementById('inp-duration').value = settings.duration !== undefined ? settings.duration : 10;
                
                if(document.getElementById('inp-sepColor')) {
                     document.getElementById('inp-sepColor').value = settings.sepColor || '#ffffff';
                     document.getElementById('inp-sepUseAccent').checked = settings.sepUseAccent !== undefined ? settings.sepUseAccent : true;
                     toggleSepColorInput();

                     document.getElementById('inp-sepOpacity').value = settings.sepOpacity !== undefined ? settings.sepOpacity : 10;
                     document.getElementById('sep-opacity-val').innerText = (settings.sepOpacity !== undefined ? settings.sepOpacity : 10) + '%';
                     document.getElementById('inp-sepWidth').value = settings.sepWidth !== undefined ? settings.sepWidth : 1;
                     document.getElementById('inp-sepStyle').value = settings.sepStyle || 'solid';
                 }
            }
          }
        }, (error) => {
           console.warn("No se pudo sincronizar configuración remota (posiblemente offline o sin permisos):", error);
        });

      db.collection('vipUsers').onSnapshot((snap) => {
        vipSet.clear();
        snap.forEach((doc) => {
          const d = doc.data() || {};
          const name = normalizeUserKey(d.name || doc.id || '');
          if (name) vipSet.add(name);
        });
        if (currentCardData) applyBadgeToCard(currentCardData);
      }, (err) => console.warn('Overlay: error leyendo vipUsers:', err));

      db.collection('superfanUsers').onSnapshot((snap) => {
        superfanSet.clear();
        snap.forEach((doc) => {
          const d = doc.data() || {};
          const name = normalizeUserKey(d.name || doc.id || '');
          if (name) superfanSet.add(name);
        });
        if (currentCardData) applyBadgeToCard(currentCardData);
      }, (err) => console.warn('Overlay: error leyendo superfanUsers:', err));

      db.collection('z0VipUsers').onSnapshot((snap) => {
        z0VipSet.clear();
        snap.forEach((doc) => {
          const d = doc.data() || {};
          const name = normalizeUserKey(d.name || doc.id || '');
          if (name) z0VipSet.add(name);
        });
        if (currentCardData) applyBadgeToCard(currentCardData);
      }, (err) => console.warn('Overlay: error leyendo z0VipUsers:', err));

      db.collection('donadorUsers').onSnapshot((snap) => {
        donadorSet.clear();
        snap.forEach((doc) => {
          const d = doc.data() || {};
          const name = normalizeUserKey(d.name || doc.id || '');
          if (name) donadorSet.add(name);
        });
        if (currentCardData) applyBadgeToCard(currentCardData);
      }, (err) => console.warn('Overlay: error leyendo donadorUsers:', err));

      db.collection('z0FanUsers').onSnapshot((snap) => {
        z0FanSet.clear();
        snap.forEach((doc) => {
          const d = doc.data() || {};
          const name = normalizeUserKey(d.name || doc.id || '');
          if (name) z0FanSet.add(name);
        });
        if (currentCardData) applyBadgeToCard(currentCardData);
      }, (err) => console.warn('Overlay: error leyendo z0FanUsers:', err));

      db.collection('z0PlatinumUsers').onSnapshot((snap) => {
        z0PlatinumSet.clear();
        snap.forEach((doc) => {
          const d = doc.data() || {};
          const name = normalizeUserKey(d.name || doc.id || '');
          if (name) z0PlatinumSet.add(name);
        });
        if (currentCardData) applyBadgeToCard(currentCardData);
      }, (err) => console.warn('Overlay: error leyendo z0PlatinumUsers:', err));

      db.collection('selectedBadges').onSnapshot((snap) => {
        const m = {};
        snap.forEach((doc) => {
          const d = doc.data() || {};
          const name = normalizeUserKey(d.name || doc.id || '');
          const badge = String(d.badge || '').trim();
          if (name) m[name] = badge;
        });
        selectedBadgeMap = m;
        if (currentCardData) applyBadgeToCard(currentCardData);
      }, (err) => console.warn('Overlay: error leyendo selectedBadges:', err));

      db.collection('userAliases').onSnapshot((snap) => {
        const map = {};
        snap.forEach((doc) => {
          const data = doc.data();
          if (data && data.aliasedTo) {
            map[normalizeUserKey(doc.id)] = normalizeUserKey(data.aliasedTo);
          }
        });
        window.userAliasesMap = map;
        console.log('[Overlay] User aliases updated:', Object.keys(map).length);
        if (currentCardData) applyBadgeToCard(currentCardData);
      }, (err) => console.warn('Overlay: error leyendo userAliases:', err));

      db.collection('solicitudes')
        .where('day', '==', currentDay)
        .orderBy('ts', 'desc')
        .limit(10)
        .onSnapshot((snapshot) => {
        if (snapshot.empty) {
          isInitialLoad = false;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const docId = change.doc.id;
            // Evitar duplicados (especialmente por escrituras locales vs servidor)
            if (processedIds.has(docId)) return;
            processedIds.add(docId);

            const data = change.doc.data();
            
            // Lógica de timestamp
            let docTime = Date.now();
            if (data.ts && typeof data.ts.toDate === 'function') {
              docTime = data.ts.toDate().getTime();
            } else if (data.ts && data.ts instanceof Date) {
               docTime = data.ts.getTime(); // Para simulaciones locales que usan Date
            } else if (data.ts) {
               // Fallback si es string o número
               docTime = new Date(data.ts).getTime();
            }
            
            if (!Number.isFinite(docTime) || docTime <= 0) docTime = Date.now();
            const now = Date.now();
            const diff = now - docTime;
            
            // Umbral para carga inicial (evitar mostrar pedidos viejos al abrir OBS)
            // 20 minutos de tolerancia
            const initialLoadThreshold = 20 * 60 * 1000; 

            console.log(`Pedido recibido: ${data.cancion}, TS: ${docTime}, Ahora: ${now}, Diff: ${diff}ms, Initial: ${isInitialLoad}`);

            if (isInitialLoad) {
              const isFreshSinceOpen = docTime >= (overlayStartedAt - 1500);
              if (isFreshSinceOpen && diff <= initialLoadThreshold) {
                addToQueue(data);
              } else {
                console.log('Solicitud existente ignorada en carga inicial:', data);
              }
            } else {
              // Evitar "shift-in" de solicitudes viejas por el límite 10 cuando se borran/reordenan docs,
              // pero NO bloquear solicitudes nuevas que lleguen con delay.
              const isFreshSinceOpen = docTime >= (overlayStartedAt - 1500);
              if (isFreshSinceOpen) addToQueue(data);
              else console.log('Solicitud anterior al inicio ignorada:', data);
            }
          }
        });
        
        // Marcar carga inicial como completada después de procesar el primer snapshot
        isInitialLoad = false;

        }, (error) => {
          console.error("Error escuchando solicitudes:", error);
        });
    }

    if (!db) {
      console.warn("Firestore no disponible. Overlay no podrá escuchar solicitudes.");
      isInitialLoad = false;
    } else if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
          firebase.auth().signInAnonymously().catch((err) => {
            console.warn('Overlay: error al iniciar sesión anónima:', err);
            startOverlayRealtime();
          });
          return;
        }
        startOverlayRealtime();
      });
    } else {
      startOverlayRealtime();
    }

    // Función de simulación para pruebas manuales
    function simulateRequest() {
      const qs = new URLSearchParams(window.location.search);
      const artists = ["Bad Bunny", "Karol G", "Feid", "Rauw Alejandro", "Shakira", "Daddy Yankee", "Rosalía"];
      const songs = ["Tití Me Preguntó", "Provenza", "Classy 101", "Todo de Ti", "Bzrp Music Sessions, Vol. 53", "Gasolina", "Despechá"];
      
      const randomIndex = Math.floor(Math.random() * artists.length);
      const randomArtist = artists[randomIndex];
      const randomSong = songs[randomIndex];
      const randomUser = String(qs.get('user') || "Prueba").trim() || "Prueba";
      const forcedBadge = String(qs.get('badge') || '').trim();

      const now = new Date();
      const dayKey = getLocalDateKey(now);
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const hora = `${hh}:${mm}`;
      const songId = `${randomUser}-${randomSong}-${randomArtist}-${hora}`.replace(/[^a-zA-Z0-9-]/g, '');
      const tsValue = (typeof firebase !== 'undefined' && firebase?.firestore?.Timestamp?.fromDate)
        ? firebase.firestore.Timestamp.fromDate(now)
        : now;

      const req = {
        id: songId,
        cancion: randomSong,
        artista: randomArtist,
        usuario: randomUser,
        displayName: randomUser,
        ts: tsValue,
        day: dayKey,
        hora,
        status: 'pending',
        isSimulation: true,
        badge: forcedBadge
      };

      console.log("Enviando simulación a Firebase:", req);
      if (!db) {
        addToQueue(req);
        return;
      }
      db.collection('solicitudes').add(req)
        .then(() => console.log("Simulación enviada con éxito"))
        .catch(err => {
          console.error("Error enviando simulación:", err);
          showToast("Error: No se pudo conectar a Firebase. La solicitud solo se verá aquí.", "error");
          try { addToQueue(req); } catch (_) {}
        });
    }
    
    function showToast(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = '5px';
        toast.style.color = '#fff';
        toast.style.fontWeight = 'bold';
        toast.style.zIndex = '9999';
        toast.style.backgroundColor = type === 'error' ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.8)';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    // Modo de prueba automático: ?test=true
    /*
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('test') === 'true') {
      setTimeout(() => {
        console.log("Iniciando prueba de cola (3 solicitudes)...");
        simulateRequest();
        setTimeout(simulateRequest, 2000); 
        setTimeout(simulateRequest, 4000);
      }, 1000);
    }
    */
    // --- Preset Logic ---
    function applyPresetFromInput() {
        const mode = document.getElementById('inp-preset').value;
        const config = presetConfigs[mode];
        if(!config) return;

        // Apply config values to inputs (only if they differ significantly or we want to force them)
        // For a true "Preset" feel, we should set them.
        if(config.width) document.getElementById('inp-width').value = config.width;
        if(config.minHeight) document.getElementById('inp-minHeight').value = config.minHeight;
        if(config.borderRadius) document.getElementById('inp-borderRadius').value = config.borderRadius;
        
        if(config.opacity !== undefined) {
            document.getElementById('inp-opacity').value = config.opacity;
            document.getElementById('bg-opacity-val').innerText = config.opacity + '%';
        }
        
        if(config.iconCircleSize !== undefined) document.getElementById('inp-iconCircleSize').value = config.iconCircleSize;
        if(config.iconFontSize !== undefined) document.getElementById('inp-iconFontSize').value = config.iconFontSize;

        previewSettings(); // triggers applySettings
    }

    // --- Helper: Setup Draggable Button ---
    function setupDraggable(elementId, onClick) {
      const el = document.getElementById(elementId);
      if(!el) return;

      const storageKey = `widget_btn_pos:${location.pathname}:${elementId}`;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const pos = JSON.parse(saved);
          if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
            el.style.left = `${pos.left}px`;
            el.style.top = `${pos.top}px`;
          }
        }
      } catch (_) {}

      let isDragging = false;
      let hasMoved = false;
      let startX, startY;
      let initialLeft, initialTop;

      el.addEventListener('mousedown', (e) => {
        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = el.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        el.style.cursor = 'grabbing';
        el.style.transition = 'none'; // Disable transition during drag
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // If moved more than a few pixels, consider it a drag
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          hasMoved = true;
        }

        el.style.left = `${initialLeft + dx}px`;
        el.style.top = `${initialTop + dy}px`;
      });

      window.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        el.style.cursor = 'grab';
        el.style.transition = 'background 0.3s ease, transform 0.3s ease'; // Restore transition

        if (hasMoved) {
          const rect = el.getBoundingClientRect();
          const left = Math.max(0, Math.min(rect.left, window.innerWidth - rect.width));
          const top = Math.max(0, Math.min(rect.top, window.innerHeight - rect.height));
          el.style.left = `${left}px`;
          el.style.top = `${top}px`;
          try {
            localStorage.setItem(storageKey, JSON.stringify({ left, top }));
          } catch (_) {}
        }
      });

      // Handle Click vs Drag
      el.addEventListener('click', (e) => {
        if (!hasMoved && typeof onClick === 'function') {
           onClick(e);
        }
        e.stopPropagation();
      });
    }

    // --- Setup Buttons ---
    
    // 1. Preset Button
    setupDraggable('preset-btn', () => {
        const current = document.getElementById('inp-preset').value;
        const next = current === 'default' ? 'glass' : (current === 'glass' ? 'vision' : 'default');
        document.getElementById('inp-preset').value = next;
        applyPresetFromInput();
    });

    // 2. Settings Button
    setupDraggable('settings-btn', () => {
        toggleSettings();
    });
