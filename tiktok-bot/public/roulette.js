const firebaseConfig = {
      apiKey: "AIzaSyA6c3EaIvuPEfM6sTV0YHqCBHuz35ZmNIU",
      authDomain: "zero-strom-web.firebaseapp.com",
      projectId: "zero-strom-web",
      storageBucket: "zero-strom-web.firebasestorage.app",
      messagingSenderId: "758369466349",
      appId: "1:758369466349:web:f2ced362a5a049c70b59e4"
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    const localStorage = {
      getItem: (key) => {
        try { return window.localStorage.getItem(key); } catch(e) { return null; }
      },
      setItem: (key, val) => {
        try { window.localStorage.setItem(key, val); } catch(e) {}
      }
    };

    // Escuchar personalización visual de ruleta
    db.collection('systemConfig').doc('overlayAlertsConfig')
      .onSnapshot((doc) => {
        if (doc.exists) {
          const data = doc.data();
          const root = document.documentElement;
          if (data.rouletteOpacity !== undefined) {
            root.style.setProperty('--roulette-bg-opacity', data.rouletteOpacity);
          }
          if (data.rouletteRadius !== undefined) {
            root.style.setProperty('--roulette-border-radius', data.rouletteRadius + 'px');
          }
        }
      }, (error) => {
         console.warn("No se pudo sincronizar overlayAlertsConfig para roulette:", error);
      });

    if (firebase.auth) {
      firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
          firebase.auth().signInAnonymously().catch((err) => {
            console.error('Error en auth anónima de ruleta:', err);
          });
        }
      });
    }

    const ROULETTE_SPIN_AGAIN_LABEL = '🎡 Vuelve a tirar';
    let allRequests = [];
    let playedSongIds = new Set();
    let manualParticipants = [];
    let firebaseParticipants = [];
    let rouletteRewardRequests = [];
    let rouletteParticipants = [];
    let excludedParticipants = new Set(); // Nombres normalizados para excluir temporalmente
    let extraDuplicateCounts = new Map();
    let currentRotation = 0;
    let isSpinning = false;
    function getLocalDayKey() {
      const d = new Date();
      try {
        const formatter = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Mexico_City',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        return formatter.format(d);
      } catch (e) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    }
    let currentDay = getLocalDayKey();
    let activeSourceTab = 'list';
    const wheelState = { x: 0, y: 0, size: 560 };
    let dragData = null;
    let resizeData = null;
    let liveSpinEntriesOverride = null;
    let lastHandledLiveSpinId = '';
    let lastHandledLiveWinnerToken = '';
    let lastHandledLiveCloseToken = '';
    let lastHandledOverlayToggleToken = '';
    let lastHandledSystemOverlayEnabled = null;
    const rouletteLiveClientId = (() => {
      const key = 'rouletteLiveClientId:v1';
      try {
        const existing = safeStorage.getItem(key);
        if (existing) return existing;
        const created = `roulette_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
        safeStorage.setItem(key, created);
        return created;
      } catch (_) {
        return `roulette_${Math.random().toString(36).slice(2, 10)}`;
      }
    })();

    const canvas = document.getElementById('roulette-canvas');
    const ctx = canvas.getContext('2d');
    const rouletteContainer = document.getElementById('roulette-container');
    const stage = document.getElementById('roulette-stage');
    const wrapper = document.getElementById('roulette-wrapper');
    const arrow = document.getElementById('roulette-arrow');
    const winnerOverlay = document.getElementById('winner-overlay');
    const winnerPhoto = document.getElementById('winner-photo');
    const winnerName = document.getElementById('winner-name');
    const participantsList = document.getElementById('participants-list');
    const participantsCount = document.getElementById('participants-count');
    const settingsPanel = document.getElementById('settings-panel');
    const advancedSettingsAnchor = document.getElementById('advanced-settings-anchor');
    const advancedSettingsTrigger = document.getElementById('advanced-settings-trigger');
    const advancedSettingsPopup = document.getElementById('advanced-settings-popup');
    const inpAddName = document.getElementById('inp-add-name');
    const btnAddName = document.getElementById('btn-add-name');
    const inpDuration = document.getElementById('inp-duration');
    const inpIntensity = document.getElementById('inp-intensity');
    const valDuration = document.getElementById('val-duration');
    const valIntensity = document.getElementById('val-intensity');
    const inpSpinAgain = document.getElementById('inp-spinAgain');
    const inpAllowDuplicates = document.getElementById('inp-allowDuplicates');
    const inpRemoveWinner = document.getElementById('inp-removeWinner');
    const overlayStatus = document.getElementById('overlay-status');
    const obsLinkInput = document.getElementById('obs-link-input');
    let overlayEnabled = true;

    // Sonidos opcionales.
    // Se cargan bajo demanda para no romper ni ensuciar la consola si aún no existen.
    const soundSources = {
      spin: 'assets/sounds/spin.mp3',
      win: 'assets/sounds/win.mp3',
      tick: 'assets/sounds/tick.mp3'
    };
    const soundCache = new Map();

    // Configuration
    const config = {
      colors: ['#00e5ff', '#00b0ff', '#0091ea', '#00b8d4', '#0097a7'],
      textColor: '#ffffff',
      fontSize: 20,
      spinDurationMs: 5000,
      spinIntensity: 6,
      spinAgainEnabled: true,
      allowDuplicates: false,
      removeWinnerEnabled: true
    };

    const THEMES = {
      minimal: {
        accentColor: '#e0e0e0',
        accentRgb: '224, 224, 224',
        arrowColor: '#ffffff',
        rimGradient: 'linear-gradient(145deg, #666, #222, #666)',
        textColor: '#ffffff',
        colors: ['#2c2c2c', '#3a3a3a', '#1a1a1a', '#4a4a4a', '#222', '#5a5a5a', '#303030', '#404040', '#282828', '#3c3c3c']
      },
      dark: {
        accentColor: '#6c63ff',
        accentRgb: '108, 99, 255',
        arrowColor: '#ffffff',
        rimGradient: 'linear-gradient(145deg, #2a2a38, #0d0d11, #2a2a38)',
        textColor: 'rgba(255,255,255,0.9)',
        colors: ['#3b30aa', '#2060c0', '#5020a0', '#007070', '#804000', '#600090', '#005080', '#800060', '#004070', '#4a0080']
      },
      neon: {
        accentColor: '#00ffc8',
        accentRgb: '0, 255, 200',
        arrowColor: '#ffffff',
        rimGradient: 'conic-gradient(from 0deg, #ff00ff, #00ffff, #ff00ff, #00ff88, #ff00ff)',
        textColor: '#ffffff',
        colors: ['#2200ff', '#00ff88', '#ff00ff', '#00ccff', '#ff0055', '#00ffee', '#aa00ff', '#00ff44', '#0066ff', '#ff0088']
      },
      candy: {
        accentColor: '#ff55bb',
        accentRgb: '255, 85, 187',
        arrowColor: '#ffffff',
        rimGradient: 'conic-gradient(from 0deg, #ff88cc, #ffcc44, #ff88cc, #44ccff, #ff88cc, #88ff88, #ff88cc)',
        textColor: '#ffffff',
        colors: ['#ff5599', '#ffaa33', '#44aaff', '#dd55ff', '#44dd88', '#ff7744', '#33aaee', '#ee3388', '#99dd22', '#6644ff']
      },
      retro: {
        accentColor: '#f5d06e',
        accentRgb: '245, 208, 110',
        arrowColor: '#ffffff',
        rimGradient: 'conic-gradient(from 0deg, #c8a84b, #f5d77a, #a87d2e, #f5d77a, #c8a84b, #7a5000, #c8a84b)',
        textColor: '#f5d06e',
        colors: ['#7a5500', '#9a4400', '#4a3a00', '#7a2030', '#005540', '#6a4200', '#004478', '#700060', '#3a4800', '#600050']
      },
      gold: {
        accentColor: '#f0d060',
        accentRgb: '240, 208, 96',
        arrowColor: '#ffffff',
        rimGradient: 'conic-gradient(from 0deg, #d4a820, #f5e070, #a07818, #f0d060, #d4a820, #7a5800, #d4a820, #f5e070, #a07818)',
        textColor: '#f0d060',
        colors: ['#7a5200', '#4a2800', '#9a6400', '#6a3200', '#8a5000', '#402000', '#a07000', '#704000', '#8a6200', '#5a3400']
      }
    };

    function applyTheme(themeKey, options = {}) {
      const t = THEMES[themeKey] ? themeKey : 'minimal';
      const T = THEMES[t];
      document.documentElement.style.setProperty('--roulette-accent-color', T.accentColor);
      document.documentElement.style.setProperty('--roulette-accent-rgb', T.accentRgb);
      document.documentElement.style.setProperty('--roulette-arrow-color', T.arrowColor);
      document.documentElement.style.setProperty('--roulette-rim-gradient', T.rimGradient);
      config.colors = [...T.colors];
      config.textColor = T.textColor;
      safeStorage.setItem('rouletteTheme', t);
      
      // Actualizar select de tema
      const sel = document.getElementById('inp-theme');
      if (sel) sel.value = t;

      if (options.broadcast !== false) {
        publishRouletteLiveState({
          themeKey: t
        });
      }
      
      drawWheel();
    }

    function applyThemeFromUI() {
      const sel = document.getElementById('inp-theme');
      applyTheme(sel ? sel.value : 'neon');
    }

    function normalizeParticipantName(name) {
      return String(name || '').trim().replace(/^@/, '').toLowerCase();
    }

    function toHour(ts) {
      if (!ts) return '';
      if (typeof ts === 'string' && /^\d{2}:\d{2}$/.test(ts)) return ts;
      try {
        const d = (ts && typeof ts.toDate === 'function') ? ts.toDate() : new Date(ts);
        if (isNaN(d.getTime())) return '';
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      } catch (e) {
        return '';
      }
    }

    function buildRouletteSongId(req) {
      const explicit = String(req && (req.songId || req.requestId) || '').trim();
      if (explicit) return explicit.replace(/[^a-zA-Z0-9-]/g, '');

      const usuario = String(req && (req.usuario || req.displayName || req.user) || '').trim();
      const cancion = String(req && req.cancion || '').trim();
      const artista = String(req && req.artista || '').trim();
      
      const ts = req && (req.ts || req.timestamp || req.time || req.createdAt || '');
      const hora = String(req && req.hora || toHour(ts) || '').trim();

      return `${usuario}-${cancion}-${artista}-${hora}`.replace(/[^a-zA-Z0-9-]/g, '');
    }

    function isRouletteSpinReward(request) {
      const rewardId = String(request && request.rewardId || '').trim();
      return rewardId === 'roulette_spin_1' || rewardId === 'roulette_spin_3';
    }

    function getRewardRequestRemainingSpins(request) {
      const rawRemaining = Number(request && request.rouletteSpinsRemaining);
      if (Number.isFinite(rawRemaining) && rawRemaining > 0) return Math.floor(rawRemaining);
      const rawTotal = Number(request && request.rouletteSpinsTotal);
      return Number.isFinite(rawTotal) && rawTotal > 0 ? Math.floor(rawTotal) : 0;
    }

    function getExtraDuplicateCount(name) {
      return Number(extraDuplicateCounts.get(normalizeParticipantName(name)) || 0);
    }

    function setExtraDuplicateCount(name, count) {
      const normalized = normalizeParticipantName(name);
      if (!normalized) return;
      if (count > 0) extraDuplicateCounts.set(normalized, count);
      else extraDuplicateCounts.delete(normalized);
    }

    function addDuplicateForName(name, extra = 1) {
      const normalized = normalizeParticipantName(name);
      if (!normalized) return;
      const current = getExtraDuplicateCount(name);
      setExtraDuplicateCount(name, current + Math.max(1, extra));
      recomputeParticipants();
    }

    function getObsOverlayUrl() {
      return new URL('roulette_overlay.html', window.location.href).toString().split('#')[0];
    }

    function getRouletteLiveRef() {
      return db.collection('sessionData').doc('rouletteLive');
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

    async function commitFirestoreWritesViaRest(writes) {
      const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents:commit`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ writes })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`REST_COMMIT_FAILED:${res.status}:${text}`);
      }
      return res.json().catch(() => ({}));
    }

    async function setDocumentViaRest(collectionName, docId, data, serverTimestampFields = []) {
      const name = `projects/${firebaseConfig.projectId}/databases/(default)/documents/${collectionName}/${docId}`;
      const fields = { ...data };
      serverTimestampFields.forEach((field) => delete fields[field]);
      await commitFirestoreWritesViaRest([
        {
          update: {
            name,
            fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toFirestoreValue(v)]))
          },
          updateTransforms: serverTimestampFields.map((field) => ({
            fieldPath: field,
            setToServerValue: 'REQUEST_TIME'
          }))
        }
      ]);
    }

    // Removido: pollRouletteLiveOnce y pollSystemStatusOnce (ahora usan onSnapshot)

    function getReqTimeMs(it) {
      try {
        if (!it) return 0;
        if (it.ts && typeof it.ts.toMillis === 'function') return it.ts.toMillis();
        if (it.ts && typeof it.ts.toDate === 'function') return it.ts.toDate().getTime();
        if (it.ts instanceof Date) return it.ts.getTime();
        if (it.ts) {
          const t = new Date(it.ts).getTime();
          if (!Number.isNaN(t)) return t;
        }
        if (it.time) {
          if (typeof it.time === 'number') return it.time;
          const t = new Date(it.time).getTime();
          if (!Number.isNaN(t)) return t;
        }
      } catch (_) {}
      return 0;
    }

    function getWinnerPhotoUrl(name) {
      const accentHex = getComputedStyle(document.documentElement).getPropertyValue('--roulette-accent-color').trim().replace('#', '') || '00e5ff';
      const normalize = (s) => String(s || '').toLowerCase().trim();
      const matching = allRequests
        .filter(req => {
          const reqName = normalize(req.displayName || req.usuario || req.user || '');
          return reqName === normalize(name);
        })
        .sort((a, b) => getReqTimeMs(b) - getReqTimeMs(a));

      const winnerReq = matching.find(req => String(req.profilePhoto || req.profilePic || req.photoUrl || req.avatar || req.userPhoto || '').trim());
      const photo = winnerReq ? String(winnerReq.profilePhoto || winnerReq.profilePic || winnerReq.photoUrl || winnerReq.avatar || winnerReq.userPhoto || '').trim() : '';
      if (photo) {
        return photo;
      }
      return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=' + accentHex + '&color=000&size=150&bold=true';
    }

    async function publishRouletteLiveState(payload) {
      if (!db) return;
      try {
        await getRouletteLiveRef().set({
          ...payload,
          overlayEnabled,
          updatedBy: rouletteLiveClientId,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.error('Error publicando estado live de ruleta:', err);
        try {
          await setDocumentViaRest('sessionData', 'rouletteLive', {
            ...payload,
            overlayEnabled,
            updatedBy: rouletteLiveClientId,
            updatedAt: true
          }, ['updatedAt']);
        } catch (restErr) {
          console.error('Error publicando estado live de ruleta por REST:', restErr);
        }
      }
    }

    function buildSpinPayload() {
      const entries = getWheelEntries();
      if (!entries.length) return null;
      const intensity = config.spinIntensity;
      const minSpins = 2 + intensity;
      const maxSpins = minSpins + 5;
      const durationMs = config.spinDurationMs;
      const spinAngle = (minSpins + Math.random() * (maxSpins - minSpins)) * 2 * Math.PI;
      const startRotation = currentRotation;
      const targetRotation = startRotation + spinAngle;
      return {
        spinId: `spin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        entries,
        startRotation,
        targetRotation,
        durationMs
      };
    }

    async function copyObsLink() {
      const value = getObsOverlayUrl();
      try {
        await navigator.clipboard.writeText(value);
      } catch (_) {
        if (obsLinkInput) {
          obsLinkInput.focus();
          obsLinkInput.select();
          document.execCommand('copy');
        }
      }
    }

    function playSound(name) {
      const src = soundSources[name];
      if (!src) return;

      let sound = soundCache.get(name);
      if (!sound) {
        sound = new Audio();
        sound.preload = 'none';
        sound.volume = 0.5;
        sound.src = src;
        sound.addEventListener('error', () => {
          sound.dataset.missing = '1';
        }, { once: true });
        soundCache.set(name, sound);
      }

      if (sound.dataset.missing === '1') return;

      sound.currentTime = 0;
      sound.play().catch(() => {});
    }

    function togglePanel() {
      settingsPanel.classList.toggle('open');
      document.body.classList.toggle('panel-open');
      if (!settingsPanel.classList.contains('open')) {
        closeAdvancedSettings();
      }
      setTimeout(() => {
        applyWheelState();
        saveWheelState();
      }, 20);
    }

    function isAdvancedSettingsOpen() {
      return !!advancedSettingsAnchor?.classList.contains('open');
    }

    function openAdvancedSettings() {
      if (!advancedSettingsAnchor || !advancedSettingsTrigger) return;
      advancedSettingsAnchor.classList.add('open');
      advancedSettingsTrigger.setAttribute('aria-expanded', 'true');
    }

    function closeAdvancedSettings() {
      if (!advancedSettingsAnchor || !advancedSettingsTrigger) return;
      advancedSettingsAnchor.classList.remove('open');
      advancedSettingsTrigger.setAttribute('aria-expanded', 'false');
    }

    function toggleAdvancedSettings(event) {
      if (event) event.stopPropagation();
      if (isAdvancedSettingsOpen()) {
        closeAdvancedSettings();
      } else {
        openAdvancedSettings();
      }
    }
    window.toggleAdvancedSettings = toggleAdvancedSettings;

    function openConfigModal() {
      document.getElementById('config-modal').classList.add('open');
    }

    function closeConfigModal() {
      document.getElementById('config-modal').classList.remove('open');
    }

    function applyThemeFromUI() {
      const sel = document.getElementById('inp-theme');
      applyTheme(sel ? sel.value : 'minimal');
    }

    function getWheelStateStorageKey() {
      return 'rouletteWheelState:v2';
    }

    function getMaxWheelSize() {
      const panelSpace = (document.body.classList.contains('panel-open') && window.innerWidth > 980) ? 360 : 0;
      const maxByWidth = Math.max(260, Math.min(760, window.innerWidth - panelSpace - 60));
      const maxByHeight = Math.max(260, Math.min(760, window.innerHeight - 120));
      return Math.max(260, Math.min(maxByWidth, maxByHeight));
    }

    function getMinWheelSize() {
      return 240;
    }

    function saveWheelState() {
      try {
        safeStorage.setItem(getWheelStateStorageKey(), JSON.stringify(wheelState));
        publishRouletteLiveState({
          type: 'layout',
          wheelState,
          manualParticipants,
          excludedParticipants: Array.from(excludedParticipants),
          activeSourceTab
        });
      } catch (_) {}
    }

    function clampWheelState() {
      const rect = rouletteContainer.getBoundingClientRect();
      const gap = 18;
      const spinHeight = 58;
      wheelState.size = Math.max(getMinWheelSize(), Math.min(getMaxWheelSize(), wheelState.size || getMaxWheelSize()));
      const stageHeight = wheelState.size + gap + spinHeight;
      const maxX = Math.max(0, rect.width / 2 - wheelState.size / 2 - 14);
      const maxY = Math.max(0, rect.height / 2 - stageHeight / 2 - 14);
      wheelState.x = Math.max(-maxX, Math.min(maxX, wheelState.x || 0));
      wheelState.y = Math.max(-maxY, Math.min(maxY, wheelState.y || 0));
    }

    function applyWheelState() {
      clampWheelState();
      wrapper.style.width = `${wheelState.size}px`;
      wrapper.style.height = `${wheelState.size}px`;
      stage.style.transform = `translate(${wheelState.x}px, ${wheelState.y}px)`;
    }

    function loadWheelState() {
      wheelState.size = Math.min(560, getMaxWheelSize());
      try {
        const raw = safeStorage.getItem(getWheelStateStorageKey());
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            if (Number.isFinite(parsed.x)) wheelState.x = parsed.x;
            if (Number.isFinite(parsed.y)) wheelState.y = parsed.y;
            if (Number.isFinite(parsed.size)) wheelState.size = parsed.size;
          }
        }
      } catch (_) {}
      applyWheelState();
    }

    function startDrag(evt) {
      if (evt.target.closest('.resize-handle') || isSpinning) return;
      dragData = {
        startX: evt.clientX,
        startY: evt.clientY,
        baseX: wheelState.x,
        baseY: wheelState.y
      };
      wrapper.classList.add('dragging');
    }

    function startResize(evt, corner) {
      evt.stopPropagation();
      resizeData = {
        corner,
        startX: evt.clientX,
        startY: evt.clientY,
        startSize: wheelState.size
      };
    }

    function onPointerMove(evt) {
      if (dragData) {
        wheelState.x = dragData.baseX + (evt.clientX - dragData.startX);
        wheelState.y = dragData.baseY + (evt.clientY - dragData.startY);
        applyWheelState();
        return;
      }
      if (resizeData) {
        const dx = evt.clientX - resizeData.startX;
        const dy = evt.clientY - resizeData.startY;
        const sx = resizeData.corner.includes('e') ? 1 : -1;
        const sy = resizeData.corner.includes('s') ? 1 : -1;
        const delta = Math.max(dx * sx, dy * sy);
        wheelState.size = resizeData.startSize + delta;
        applyWheelState();
      }
    }

    function stopPointerInteraction() {
      if (dragData || resizeData) {
        dragData = null;
        resizeData = null;
        wrapper.classList.remove('dragging');
        applyWheelState();
        saveWheelState();
      }
    }

    function updateConfig() {
      config.spinDurationMs = parseInt(inpDuration.value, 10) || 5000;
      config.spinIntensity = parseInt(inpIntensity.value, 10) || 6;
      config.spinAgainEnabled = inpSpinAgain.checked;
      config.allowDuplicates = inpAllowDuplicates.checked;
      config.removeWinnerEnabled = inpRemoveWinner.checked;
      valDuration.textContent = String(config.spinDurationMs);
      valIntensity.textContent = String(config.spinIntensity);
      recomputeParticipants();
      drawWheel();
    }

    function setSourceTab(tab, options = {}) {
      activeSourceTab = ['list', 'rewards', 'manual'].includes(tab) ? tab : 'list';
      ['list', 'rewards', 'manual'].forEach(key => {
        const btn = document.getElementById(`source-tab-${key}`);
        if (!btn) return;
        const active = key === activeSourceTab;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      renderParticipantsList();
      if (options.broadcast !== false) saveWheelState();
    }

    function loadNewRoulette() {
      // Al presionar "Ruleta nueva", cargamos los que tienen canciones pendientes actualmente.
      // Hallazgo 4: También limpiamos duplicados extra y excluidos para arrancar limpio.
      manualParticipants = [...firebaseParticipants];
      excludedParticipants.clear();
      extraDuplicateCounts.clear();
      setSourceTab('manual');
      recomputeParticipants();
      saveWheelState(); // Sincronizar estado al reiniciar
      console.log('🎰 Ruleta nueva cargada con participantes pendientes:', manualParticipants);
    }


    function applyOverlayEnabled(enabled, options = {}) {
      overlayEnabled = enabled;
      document.body.classList.toggle('overlay-disabled', !enabled);
      if (rouletteContainer) {
        rouletteContainer.style.display = enabled ? 'flex' : 'none';
      }
      if (overlayStatus) {
        overlayStatus.textContent = enabled ? 'Estado: ACTIVO' : 'Estado: DESACTIVADO';
      }
      safeStorage.setItem('rouletteOverlayEnabled', enabled ? '1' : '0');
      if (!enabled) resetWinner({ broadcast: false });
    }

    function setOverlayEnabledRemote(enabled) {
      applyOverlayEnabled(enabled, { broadcast: false });
      const overlayToggleToken = `overlay_${enabled ? 'on' : 'off'}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      lastHandledOverlayToggleToken = overlayToggleToken;
      lastHandledSystemOverlayEnabled = enabled;
      publishRouletteLiveState({
        type: 'overlay_toggle',
        overlayEnabled: enabled,
        overlayToggleToken
      });
      db.collection('system').doc('status').set({
        rouletteOverlayEnabled: enabled,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'roulette-overlay'
      }, { merge: true }).catch(async err => {
        console.warn('No se pudo sincronizar rouletteOverlayEnabled en system/status:', err);
        try {
          await setDocumentViaRest('system', 'status', {
            rouletteOverlayEnabled: enabled,
            updatedBy: 'roulette-overlay',
            lastUpdate: true
          }, ['lastUpdate']);
        } catch (restErr) {
          console.warn('Tampoco se pudo sincronizar rouletteOverlayEnabled por REST:', restErr);
        }
      });
      db.collection('notifications').add({
        type: 'roulette_overlay_toggle',
        enabled,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(err => {
        console.error('No se pudo enviar comando remoto de overlay:', err);
        overlayStatus.textContent = 'Estado: ERROR REMOTO';
      });
    }

    // Load participants from Firebase
    function subscribeToRequests() {
      db.collection('solicitudes').where('day', '==', currentDay)
        .onSnapshot(snap => {
          allRequests = [];
          snap.forEach(doc => allRequests.push({ ...doc.data(), id: doc.id, __rouletteSongId: buildRouletteSongId({ ...doc.data(), id: doc.id }) }));
          updateParticipants();
        });

      db.collection('playedSongs').doc(currentDay)
        .onSnapshot(doc => {
          if (doc.exists) {
            const d = doc.data() || {};
            // Hallazgo 2: También excluir canciones skipped de la ruleta
            const allDone = new Set([
              ...(d.songs || []),
              ...(d.skipped || [])
            ]);
            playedSongIds = allDone;
            updateParticipants();
          }
        });


      db.collection('rewardRequests')
        .where('status', '==', 'approved')
        .onSnapshot(snap => {
          rouletteRewardRequests = [];
          snap.forEach(doc => {
            const data = { ...doc.data(), id: doc.id };
            if (!isRouletteSpinReward(data)) return;
            const day = String(data.day || '').trim();
            if (day && day !== currentDay) return;
            if (getRewardRequestRemainingSpins(data) <= 0) return;
            rouletteRewardRequests.push(data);
          });
          recomputeParticipants();
        });

      // Listener para comandos remotos (bot)
      db.collection('notifications')
        .where('timestamp', '>', firebase.firestore.Timestamp.now())
        .onSnapshot(snap => {
          snap.docChanges().forEach(change => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data.type === 'roulette_spin') {
                console.log('🎲 Comando de giro recibido del bot');
                spinWheel();
              } else if (data.type === 'roulette_reset') {
                console.log('🔄 Comando de reset recibido del bot');
                excludedParticipants.clear();
                extraDuplicateCounts.clear();
                updateParticipants();
                resetWinner();
              } else if (data.type === 'roulette_overlay_toggle') {
                applyOverlayEnabled(data.enabled !== false, { broadcast: false });
              }
            }
          });
        });

      // Escuchar personalización visual de la ruleta desde el panel de control
      db.collection('systemConfig').doc('overlayAlertsConfig')
        .onSnapshot((doc) => {
          if (doc.exists) {
            const data = doc.data();
            const root = document.documentElement;
            
            const showBg = data.rouletteShowCardBg !== undefined ? data.rouletteShowCardBg : true;
            const op = data.rouletteOpacity !== undefined ? data.rouletteOpacity : 0.2;
            const rad = data.rouletteRadius !== undefined ? data.rouletteRadius : 40;
            const bWidth = data.rouletteBorderWidth !== undefined ? data.rouletteBorderWidth : 1;
            const bColor = data.rouletteBorderColor || '#ffffff';
            const bOpacity = data.rouletteBorderOpacity !== undefined ? data.rouletteBorderOpacity : 20;
            const bStyle = data.rouletteBorderStyle || 'solid';
            const showShadow = data.rouletteShowShadow !== undefined ? data.rouletteShowShadow : true;
            
            // Convert border color hex to rgb
            const br = parseInt(bColor.substr(1,2), 16) || 255;
            const bgVal = parseInt(bColor.substr(3,2), 16) || 255;
            const bb = parseInt(bColor.substr(5,2), 16) || 255;
            const bOp = bOpacity / 100;
            
            root.style.setProperty('--roulette-bg-opacity', op);
            root.style.setProperty('--roulette-border-radius', rad + 'px');
            root.style.setProperty('--roulette-border-width', bWidth + 'px');
            root.style.setProperty('--roulette-border-style', bStyle);
            root.style.setProperty('--roulette-border-color', `rgba(${br},${bgVal},${bb},${bOp})`);
            
            if (!showShadow) {
              root.style.setProperty('--roulette-box-shadow', 'none');
            } else {
              root.style.setProperty('--roulette-box-shadow', '0 0 100px rgba(var(--roulette-accent-rgb, 0, 229, 255), 0.4), inset 0 0 40px rgba(255,255,255,0.05)');
            }
            
            const winnerOverlay = document.getElementById('winner-overlay');
            if (winnerOverlay) {
              if (!showBg) {
                winnerOverlay.classList.add('no-card-bg');
              } else {
                winnerOverlay.classList.remove('no-card-bg');
              }
            }

            if (data.rouletteOverlayEnabled !== undefined) {
              applyOverlayEnabled(data.rouletteOverlayEnabled !== false, { broadcast: false });
            }
          }
        }, (error) => {
           console.warn("No se pudo sincronizar overlayAlertsConfig para roulette:", error);
        });

      // Conexión Remota Realtime: Reemplazo de polling por onSnapshot (Hallazgo 1)
      db.collection('system').doc('status').onSnapshot(doc => {
        const data = doc && doc.exists ? (doc.data() || {}) : {};
        if (typeof data.rouletteOverlayEnabled === 'boolean') {
          if (lastHandledSystemOverlayEnabled !== data.rouletteOverlayEnabled) {
            lastHandledSystemOverlayEnabled = data.rouletteOverlayEnabled;
            applyOverlayEnabled(data.rouletteOverlayEnabled, { broadcast: false });
          }
        }
      });

      getRouletteLiveRef().onSnapshot(doc => {
        if (!doc.exists) return;
        const data = doc.data() || {};
        if (data.themeKey && THEMES[data.themeKey] && data.updatedBy !== rouletteLiveClientId) {
          applyTheme(data.themeKey, { broadcast: false });
        }
        if (data.type === 'overlay_toggle' && data.overlayToggleToken && data.overlayToggleToken !== lastHandledOverlayToggleToken) {
          lastHandledOverlayToggleToken = data.overlayToggleToken;
          applyOverlayEnabled(data.overlayEnabled !== false, { broadcast: false });
          return;
        }
        if (typeof data.overlayEnabled === 'boolean' && data.updatedBy !== rouletteLiveClientId) {
          applyOverlayEnabled(data.overlayEnabled, { broadcast: false });
        }
        if (data.updatedBy === rouletteLiveClientId) return;
        if (data.type === 'spin' && data.spin && data.spin.spinId && data.spin.spinId !== lastHandledLiveSpinId) {
          lastHandledLiveSpinId = data.spin.spinId;
          spinWheel({
            payload: data.spin,
            broadcast: false,
            sideEffects: false,
            autoFollowSpinAgain: false,
            applyWinnerRemoval: false
          });
          return;
        }
        if (data.type === 'winner' && data.winner && data.winner.token && data.winner.token !== lastHandledLiveWinnerToken) {
          if (isSpinning && lastHandledLiveSpinId && data.winner.token === `winner_${lastHandledLiveSpinId}`) return;
          lastHandledLiveWinnerToken = data.winner.token;
          if (Array.isArray(data.winner.entries) && data.winner.entries.length) {
            liveSpinEntriesOverride = data.winner.entries.slice();
          }
          if (Number.isFinite(data.winner.finalRotation)) {
            currentRotation = data.winner.finalRotation;
            drawWheel(data.winner.entries || undefined);
          }
          showWinner(data.winner.name, {
            sideEffects: false,
            broadcast: false,
            photoUrl: data.winner.photoUrl || '',
            quietIfSame: true
          });
          return;
        }
        if (data.type === 'layout' && data.updatedBy !== rouletteLiveClientId) {
          if (data.wheelState) {
            if (Number.isFinite(data.wheelState.x)) wheelState.x = data.wheelState.x;
            if (Number.isFinite(data.wheelState.y)) wheelState.y = data.wheelState.y;
            if (Number.isFinite(data.wheelState.size)) wheelState.size = data.wheelState.size;
            applyWheelState();
          }
          if (Array.isArray(data.manualParticipants)) {
            manualParticipants = [...data.manualParticipants];
          }
          if (Array.isArray(data.excludedParticipants)) {
            excludedParticipants = new Set(data.excludedParticipants);
          }
          if (data.activeSourceTab && data.activeSourceTab !== activeSourceTab) {
            setSourceTab(data.activeSourceTab, { broadcast: false });
          }
          recomputeParticipants();
        }
        if (data.type === 'idle' && data.closeToken && data.closeToken !== lastHandledLiveCloseToken) {
          lastHandledLiveCloseToken = data.closeToken;
          resetWinner({ broadcast: false });
        }
      });
    }

    function updateParticipants() {
      const pending = allRequests.filter(req => {
        const sid = req.__rouletteSongId || buildRouletteSongId(req);
        return sid && !playedSongIds.has(sid);
      });
      
      const names = new Set();
      pending.forEach(req => {
        const u = (req.displayName || req.usuario || req.user || 'Anónimo').trim();
        if (!excludedParticipants.has(normalizeParticipantName(u))) {
           names.add(u);
        }
      });

      firebaseParticipants = Array.from(names);
      
      // Sincronizar participantes de canjes
      const activeRewards = rouletteRewardRequests.filter(req => {
         if (req.rouletteSongId && playedSongIds.has(req.rouletteSongId)) return false;
         return true;
      });
      
      recomputeParticipants();
    }

    function expandNameCopies(name, baseCopies) {
      const normalized = normalizeParticipantName(name);
      if (!normalized || excludedParticipants.has(normalized)) return [];
      const multiplier = config.allowDuplicates ? 2 : 1;
      const extras = getExtraDuplicateCount(name);
      const total = Math.max(0, (baseCopies * multiplier) + extras);
      return Array.from({ length: total }, () => name);
    }

    function recomputeParticipants() {
      // Hallazgo 3: La ruleta solo gira con los participantes de la pestaña activa.
      // Si estás en "Canjes" → solo canjes. En "Lista" → solo lista de espera.
      // En "Ruleta nueva" (manual) → solo los que copiaste manualmente.
      // Esto evita que usuarios borrados de una pestaña "reaparezcan" desde otra.
      const merged = [];
      const seen = new Set();

      function addName(name, baseCopies) {
        const normalized = normalizeParticipantName(name);
        if (!normalized || excludedParticipants.has(normalized)) return;
        if (!config.allowDuplicates && seen.has(normalized)) return;
        seen.add(normalized);
        merged.push(...expandNameCopies(name, baseCopies));
      }

      if (activeSourceTab === 'manual') {
        manualParticipants.forEach(name => addName(name, 1));
      } else if (activeSourceTab === 'rewards') {
        rouletteRewardRequests.forEach(request => {
          const name = String(request.userId || request.displayName || '').trim();
          const baseTickets = config.allowDuplicates
            ? getRewardRequestRemainingSpins(request)
            : (getRewardRequestRemainingSpins(request) > 0 ? 1 : 0);
          if (!name || baseTickets <= 0) return;
          addName(name, baseTickets);
        });
      } else {
        // 'list' tab: solo participantes de Firebase (canciones en espera)
        firebaseParticipants.forEach(name => addName(name, 1));
      }

      rouletteParticipants = merged;
      liveSpinEntriesOverride = null; // Important: Clear override when participants change
      renderParticipantsList();
      drawWheel();
    }


    function getRewardParticipantNames() {
      const rewardEntries = [];
      rouletteRewardRequests.forEach(request => {
        const name = String(request.userId || request.displayName || '').trim();
        const normalized = normalizeParticipantName(name);
        const baseTickets = config.allowDuplicates ? getRewardRequestRemainingSpins(request) : (getRewardRequestRemainingSpins(request) > 0 ? 1 : 0);
        if (!normalized || excludedParticipants.has(normalized) || baseTickets <= 0) return;
        rewardEntries.push(...expandNameCopies(name, baseTickets));
      });
      return rewardEntries;
    }

    function getParticipantsForActiveTab() {
      if (activeSourceTab === 'manual') {
        const seen = new Set();
        return manualParticipants.flatMap(name => {
          const normalized = normalizeParticipantName(name);
          if (!normalized || excludedParticipants.has(normalized)) return [];
          if (!config.allowDuplicates && seen.has(normalized)) return [];
          seen.add(normalized);
          return expandNameCopies(name, 1);
        });
      }
      if (activeSourceTab === 'rewards') {
        return getRewardParticipantNames();
      }
      const seen = new Set();
      return firebaseParticipants.flatMap(name => {
        const normalized = normalizeParticipantName(name);
        if (!normalized || excludedParticipants.has(normalized)) return [];
        if (!config.allowDuplicates && seen.has(normalized)) return [];
        seen.add(normalized);
        return expandNameCopies(name, 1);
      });
    }

    function renderParticipantsList() {
      participantsList.innerHTML = '';
      const visibleParticipants = getParticipantsForActiveTab();
      if (participantsCount) participantsCount.textContent = String(visibleParticipants.length);
      const manualSet = new Set(manualParticipants.map(n => normalizeParticipantName(n)));
      visibleParticipants.forEach(name => {
        const source = manualSet.has(name.toLowerCase().trim()) ? 'manual' : 'firebase';
        const row = document.createElement('div');
        row.className = 'participant-row';
        const label = document.createElement('span');
        label.className = 'participant-name';
        label.textContent = name;
        const actions = document.createElement('div');
        actions.className = 'participant-actions';
        const select = document.createElement('select');
        select.className = 'participant-action-select';
        select.innerHTML = `
          <option value="">Acción</option>
          <option value="duplicate">Duplicado</option>
          <option value="remove">Quitar</option>
        `;
        select.addEventListener('change', () => {
          if (select.value === 'duplicate') addDuplicateForName(name, 1);
          if (select.value === 'remove') excludeParticipant(name, source);
          select.value = '';
        });
        const remove = document.createElement('button');
        remove.className = 'participant-remove';
        remove.type = 'button';
        remove.textContent = '✕';
        remove.dataset.name = name;
        remove.dataset.source = source;
        remove.addEventListener('click', () => excludeParticipant(name, source));
        row.appendChild(label);
        actions.appendChild(select);
        actions.appendChild(remove);
        row.appendChild(actions);
        participantsList.appendChild(row);
      });

      if (visibleParticipants.length === 0) {
        const emptyByTab = {
          list: 'Sin participantes de la lista',
          rewards: 'Sin canjes aprobados pendientes',
          manual: 'Sin participantes manuales'
        };
        participantsList.innerHTML = `<div style="text-align:center; opacity:0.5; padding:20px; font-size:12px;">${emptyByTab[activeSourceTab] || 'Sin participantes pendientes'}</div>`;
      }
    }

    function excludeParticipant(name, source = 'firebase') {
      setExtraDuplicateCount(name, 0);
      if (source === 'manual') {
        manualParticipants = manualParticipants.filter(n => normalizeParticipantName(n) !== normalizeParticipantName(name));
      } else {
        excludedParticipants.add(normalizeParticipantName(name));
      }
      recomputeParticipants();
      saveWheelState();
    }

    function addManualParticipant() {
      const name = (inpAddName.value || '').trim();
      if (!name) return;
      const exists = rouletteParticipants.some(p => normalizeParticipantName(p) === normalizeParticipantName(name));
      if (exists && !config.allowDuplicates) {
        inpAddName.value = '';
        return;
      }
      manualParticipants.push(name);
      inpAddName.value = '';
      excludedParticipants.delete(normalizeParticipantName(name));
      setExtraDuplicateCount(name, 0);
      recomputeParticipants();
      setSourceTab('manual');
    }

    function resetRoulette() {
      if (confirm('¿Estás seguro de que quieres iniciar una nueva ruleta? Se restaurarán todos los participantes.')) {
        manualParticipants = [];
        excludedParticipants.clear();
        extraDuplicateCounts.clear();
        updateParticipants();
        liveSpinEntriesOverride = null;
        resetWinner();
      }
    }

    function getWheelEntries(sourceEntries = null) {
      if (Array.isArray(sourceEntries)) return sourceEntries.slice();
      if (Array.isArray(liveSpinEntriesOverride) && liveSpinEntriesOverride.length) return liveSpinEntriesOverride.slice();
      let entries = [...rouletteParticipants];
      if (config.spinAgainEnabled && entries.length > 0) {
        entries.push(ROULETTE_SPIN_AGAIN_LABEL);
      }
      return entries;
    }

    function drawWheel(sourceEntries = null) {
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) / 2 - 40;
      
      ctx.clearRect(0, 0, width, height);
      
      const entries = getWheelEntries(sourceEntries);
      if (entries.length === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = `900 26px Montserrat`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SIN PARTICIPANTES', cx, cy);
        return;
      }

      const arc = (2 * Math.PI) / entries.length;

      // Draw shadow for the whole wheel
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(currentRotation);

      entries.forEach((p, i) => {
        const angle = i * arc;
        
        // Slice background
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, angle, angle + arc);
        
        const color = config.colors[i % config.colors.length];
        const gradient = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
        gradient.addColorStop(0, adjustColor(color, 30));
        gradient.addColorStop(0.5, color);
        gradient.addColorStop(1, adjustColor(color, -60));
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Metallic edge highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Slice Glossy Overlay
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, angle, angle + arc / 2);
        const gloss = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        gloss.addColorStop(0, 'rgba(255,255,255,0.15)');
        gloss.addColorStop(1, 'transparent');
        ctx.fillStyle = gloss;
        ctx.fill();

        // Text
        ctx.save();
        ctx.rotate(angle + arc / 2);
        ctx.fillStyle = config.textColor;
        const count = entries.length;
        const dynamicFontSize =
          count <= 10 ? config.fontSize :
          count <= 16 ? Math.max(14, config.fontSize - 3) :
          Math.max(12, config.fontSize - 6);
        ctx.font = `900 ${dynamicFontSize}px Montserrat`;
        ctx.textAlign = 'right';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        
        // Truncate text if too long
        let displayText = p;
        if (displayText.length > 15) displayText = displayText.substring(0, 12) + '...';
        
        ctx.fillText(displayText.toUpperCase(), radius - 50, 8);
        ctx.restore();
      });

      ctx.restore();

      // Outer Metallic Ring
      const outerRingGradient = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
      outerRingGradient.addColorStop(0, '#666');
      outerRingGradient.addColorStop(0.2, '#eee');
      outerRingGradient.addColorStop(0.4, '#333');
      outerRingGradient.addColorStop(0.6, '#fff');
      outerRingGradient.addColorStop(0.8, '#333');
      outerRingGradient.addColorStop(1, '#666');

      ctx.beginPath();
      ctx.arc(cx, cy, radius + 10, 0, 2 * Math.PI);
      ctx.strokeStyle = outerRingGradient;
      ctx.lineWidth = 20;
      ctx.stroke();

      // Inner shadow for the ring
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Dots on the ring
      const dotCount = 24;
      for (let i = 0; i < dotCount; i++) {
        const angle = (i / dotCount) * 2 * Math.PI;
        const dx = cx + (radius + 10) * Math.cos(angle);
        const dy = cy + (radius + 10) * Math.sin(angle);
        
        ctx.beginPath();
        ctx.arc(dx, dy, 4, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'white';
        ctx.fill();
      }

      // 3D Center Pin
      // Shadow
      ctx.beginPath();
      ctx.arc(cx, cy, 55, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();

      // Main pin body
      const pinGradient = ctx.createLinearGradient(cx - 50, cy - 50, cx + 50, cy + 50);
      pinGradient.addColorStop(0, '#555');
      pinGradient.addColorStop(0.5, '#222');
      pinGradient.addColorStop(1, '#000');
      
      ctx.beginPath();
      ctx.arc(cx, cy, 50, 0, 2 * Math.PI);
      ctx.fillStyle = pinGradient;
      ctx.fill();
      
      const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--roulette-accent-color').trim();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Inner accent glow
      ctx.beginPath();
      ctx.arc(cx, cy, 40, 0, 2 * Math.PI);
      const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
      innerGlow.addColorStop(0, accentColor);
      innerGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = innerGlow;
      ctx.globalAlpha = 0.4;
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Top shine
      ctx.beginPath();
      ctx.arc(cx - 15, cy - 15, 10, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fill();
    }

    function adjustColor(hex, amt) {
      let usePound = false;
      if (hex[0] == "#") {
        hex = hex.slice(1);
        usePound = true;
      }
      let num = parseInt(hex, 16);
      let r = (num >> 16) + amt;
      if (r > 255) r = 255; else if (r < 0) r = 0;
      let b = ((num >> 8) & 0x00FF) + amt;
      if (b > 255) b = 255; else if (b < 0) b = 0;
      let g = (num & 0x0000FF) + amt;
      if (g > 255) g = 255; else if (g < 0) g = 0;
      const s = (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
      return (usePound ? "#" : "") + s;
    }

    // Hallazgo 5: Token para cancelar el restore de showSpinAgainFeedback si llega un ganador
    let spinAgainRestoreTimer = null;

    function spinWheel(options = {}) {
      const remotePayload = options.payload || null;
      if (!overlayEnabled) return;

      // Hallazgo 5: Si viene un payload remoto y estamos girando, cancelamos forzosamente la
      // animación anterior para que el overlay de OBS se sincronice inmediatamente.
      if (isSpinning) {
        if (remotePayload) {
          isSpinning = false;
          wrapper.classList.remove('spinning');
          wrapper.style.transform = '';
          if (spinAgainRestoreTimer) { clearTimeout(spinAgainRestoreTimer); spinAgainRestoreTimer = null; }
        } else {
          return; // giro local: respetar el bloqueo
        }
      }

      const spinPayload = remotePayload || buildSpinPayload();
      if (!spinPayload || !Array.isArray(spinPayload.entries) || spinPayload.entries.length === 0) return;

      resetWinner({ broadcast: false });
      isSpinning = true;
      wrapper.classList.add('spinning');
      playSound('spin');

      const entries = getWheelEntries(spinPayload.entries);
      liveSpinEntriesOverride = entries.slice();
      const duration = Number(spinPayload.durationMs) || config.spinDurationMs;
      const startRotation = Number.isFinite(spinPayload.startRotation) ? spinPayload.startRotation : currentRotation;
      const targetRotation = Number.isFinite(spinPayload.targetRotation) ? spinPayload.targetRotation : startRotation;
      const startTime = performance.now();
      currentRotation = startRotation;
      drawWheel(entries);

      if (!remotePayload && options.broadcast !== false) {
        lastHandledLiveSpinId = spinPayload.spinId;
        publishRouletteLiveState({
          type: 'spin',
          spin: spinPayload,
          winner: null
        });
      }

      let lastArrowAngle = 0;
      let lastTickSoundAt = 0;

      function animate(time) {
        if (!isSpinning) return; // Hallazgo 5: Si se canceló, detener la animación
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 4); // easeOutQuart for smoother stop
        
        currentRotation = startRotation + (targetRotation - startRotation) * ease;
        drawWheel(entries);

        // Arrow vibration based on slices
        const arc = (2 * Math.PI) / entries.length;
        const currentSliceAngle = (currentRotation % arc);
        if (currentSliceAngle < lastArrowAngle) {
          arrow.classList.remove('tick');
          void arrow.offsetWidth;
          arrow.classList.add('tick');
          if ((time - lastTickSoundAt) > 45) {
            playSound('tick');
            lastTickSoundAt = time;
          }
        }
        lastArrowAngle = currentSliceAngle;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Final bounce animation for the wheel
          wrapper.style.transform = 'scale(1) rotateX(0deg) rotate(5deg)';
          setTimeout(() => {
            wrapper.style.transform = 'scale(1) rotateX(0deg) rotate(-3deg)';
            setTimeout(() => {
              wrapper.style.transform = 'scale(1) rotateX(0deg) rotate(0deg)';
              wrapper.classList.remove('spinning');
              isSpinning = false;
              determineWinner({
                entries,
                spinId: spinPayload.spinId,
                sideEffects: options.sideEffects !== false,
                broadcastWinner: !remotePayload && options.broadcast !== false,
                autoFollowSpinAgain: remotePayload ? false : options.autoFollowSpinAgain !== false,
                applyWinnerRemoval: remotePayload ? false : options.applyWinnerRemoval !== false
              });
            }, 150);
          }, 150);
        }
      }
      
      requestAnimationFrame(animate);
    }

    function determineWinner(options = {}) {
      const entries = getWheelEntries(options.entries);
      const count = entries.length;
      if (count === 0) return;
      
      const normalized = currentRotation % (2 * Math.PI);
      let angleOnWheel = (0 - normalized) % (2 * Math.PI);
      if (angleOnWheel < 0) angleOnWheel += 2 * Math.PI;
      
      const arc = (2 * Math.PI) / count;
      const index = Math.floor(angleOnWheel / arc) % count;
      const winner = entries[index];

      if (winner === ROULETTE_SPIN_AGAIN_LABEL) {
        showSpinAgainFeedback();
        if (options.autoFollowSpinAgain !== false) {
          setTimeout(() => spinWheel(), 1200);
        }
        return;
      }

      if (config.removeWinnerEnabled && options.applyWinnerRemoval !== false) {
        removeWinnerFromFutureSpins(winner);
      }
      showWinner(winner, {
        sideEffects: options.sideEffects !== false,
        broadcast: options.broadcastWinner !== false,
        winnerToken: options.spinId ? `winner_${options.spinId}` : '',
        sourceEntries: entries,
        finalRotation: currentRotation
      });
    }

    function removeWinnerFromFutureSpins(name) {
      const normalized = normalizeParticipantName(name);
      if (!normalized) return;
      manualParticipants = manualParticipants.filter(n => normalizeParticipantName(n) !== normalized);
      excludedParticipants.add(normalized);
      recomputeParticipants();
    }

    function findApprovedRouletteRequestForWinner(name) {
      const normalized = normalizeParticipantName(name);
      return rouletteRewardRequests
        .filter(req => normalizeParticipantName(req.userId || req.displayName || '') === normalized)
        .sort((a, b) => {
          const ta = new Date(a.timestamp || 0).getTime();
          const tb = new Date(b.timestamp || 0).getTime();
          return ta - tb;
        })[0] || null;
    }

    async function consumeApprovedRouletteSpin(name) {
      if (!db) return null;
      const rewardRequest = findApprovedRouletteRequestForWinner(name);
      if (!rewardRequest || !rewardRequest.id) return null;

      const remainingBefore = getRewardRequestRemainingSpins(rewardRequest);
      if (remainingBefore <= 0) return null;

      const requestRef = db.collection('rewardRequests').doc(rewardRequest.id);
      const nextRemaining = Math.max(0, remainingBefore - 1);
      const batch = db.batch();

      batch.set(requestRef, {
        rouletteSpinsRemaining: nextRemaining,
        lastSpinUsedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const song = String(rewardRequest.rouletteSong || '').trim();
      const artist = String(rewardRequest.rouletteArtist || '').trim();
      let queuedSong = false;

      if (song) {
        const requestDoc = db.collection('solicitudes').doc();
        batch.set(requestDoc, {
          usuario: name,
          displayName: name,
          user: name,
          cancion: song,
          artista: artist,
          day: String(rewardRequest.day || currentDay || '').trim() || currentDay,
          ts: firebase.firestore.FieldValue.serverTimestamp(),
          rewardRequestId: rewardRequest.id,
          source: 'web',
          subsource: 'roulette_reward',
          approvedByRoulette: true
        }, { merge: true });
        queuedSong = true;
      }

      await batch.commit();

      if (queuedSong) {
        await db.collection('notifications').add({
          type: 'roulette_song_queued',
          user: name,
          song,
          artist,
          message: artist ? `🎶 ${name} ganó con ${song} - ${artist}` : `🎶 ${name} ganó con ${song}`,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      return {
        requestId: rewardRequest.id,
        queuedSong,
        song,
        artist,
        remainingSpins: nextRemaining
      };
    }

    function showWinner(name, options = {}) {
      // Hallazgo 5: Cancelar timers pendientes de "Vuelve a tirar" para no corromper el DOM
      if (spinAgainRestoreTimer) { clearTimeout(spinAgainRestoreTimer); spinAgainRestoreTimer = null; }
      const title = document.getElementById('winner-title');
      const photo = document.getElementById('winner-photo');
      if (title) { title.innerText = title.dataset.defaultTitle || '\uD83C\uDFC6 \u00A1GANADOR!'; title.style.color = ''; }
      if (photo) photo.style.display = '';

      const alreadySameWinner = winnerOverlay.classList.contains('show') && winnerName.innerText === name;
      if (options.winnerToken) {
        lastHandledLiveWinnerToken = options.winnerToken;
      }
      winnerName.innerText = name;
      const fallbackPhoto = getWinnerPhotoUrl(name);
      winnerPhoto.src = String(options.photoUrl || fallbackPhoto || '').trim() || fallbackPhoto;
      winnerPhoto.onerror = () => {
        winnerPhoto.src = fallbackPhoto;
      };
      
      winnerOverlay.classList.add('show');
      if (!(alreadySameWinner && options.quietIfSame)) {
        playSound('win');
        createConfetti();
      }

      if (options.broadcast !== false && options.winnerToken) {
        lastHandledLiveWinnerToken = options.winnerToken;
        publishRouletteLiveState({
          type: 'winner',
          winner: {
            token: options.winnerToken,
            name,
            photoUrl: winnerPhoto.src,
            entries: Array.isArray(options.sourceEntries) ? options.sourceEntries.slice() : getWheelEntries(),
            finalRotation: Number.isFinite(options.finalRotation) ? options.finalRotation : currentRotation
          }
        });
      }

      // Notify bot via Firebase
      if (db && options.sideEffects !== false) {
        db.collection('notifications').add({
          type: 'roulette_winner',
          user: name,
          message: `¡${name} ha ganado la ruleta!`,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(err => {
          console.error('Error notifying bot of winner:', err);
        });

        consumeApprovedRouletteSpin(name).catch(err => {
          console.error('Error procesando canje aprobado de ruleta:', err);
        });
      }
    }

    function createConfetti() {
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--roulette-accent-color').trim() || '#00e5ff';
      const colors = [accent, '#ffffff', '#00b0ff', '#ffeb3b', '#e91e63', '#76ff03', '#d500f9'];
      const shapes = ['circle', 'square', 'triangle'];
      
      for (let i = 0; i < 150; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const size = Math.random() * 12 + 6;
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        p.style.left = '50%';
        p.style.top = '50%';
        
        if (shape === 'circle') p.style.borderRadius = '50%';
        else if (shape === 'triangle') {
          p.style.backgroundColor = 'transparent';
          p.style.width = '0';
          p.style.height = '0';
          p.style.borderLeft = (size/2) + 'px solid transparent';
          p.style.borderRight = (size/2) + 'px solid transparent';
          p.style.borderBottom = size + 'px solid ' + colors[Math.floor(Math.random() * colors.length)];
        }
        
        document.body.appendChild(p);
        
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 25 + 15;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;
        const gravity = 0.5;
        let x = 0;
        let y = 0;
        let curVy = vy;
        let opacity = 1;
        let rotation = Math.random() * 360;
        let rotationSpeed = (Math.random() - 0.5) * 20;
        
        function move() {
          x += vx;
          y += curVy;
          curVy += gravity;
          opacity -= 0.005;
          rotation += rotationSpeed;
          
          p.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${rotation}deg)`;
          p.style.opacity = opacity;
          
          if (opacity > 0 && y < window.innerHeight) {
            requestAnimationFrame(move);
          } else {
            p.remove();
          }
        }
        requestAnimationFrame(move);
      }
      
      // Screen shake
      document.body.style.animation = 'none';
      setTimeout(() => {
        document.body.style.animation = 'screen-shake 0.5s ease-out';
      }, 10);
    }

    // Add screen-shake keyframes to style
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes screen-shake {
        0% { transform: translate(0, 0); }
        10% { transform: translate(-10px, -10px); }
        20% { transform: translate(10px, 10px); }
        30% { transform: translate(-10px, 10px); }
        40% { transform: translate(10px, -10px); }
        50% { transform: translate(-10px, -10px); }
        60% { transform: translate(10px, 10px); }
        70% { transform: translate(-10px, 10px); }
        80% { transform: translate(10px, -10px); }
        90% { transform: translate(-5px, -5px); }
        100% { transform: translate(0, 0); }
      }
    `;
    document.head.appendChild(style);
    function showSpinAgainFeedback() {
      // Hallazgo 5: Cancelar cualquier restore pendiente del intento anterior
      if (spinAgainRestoreTimer) { clearTimeout(spinAgainRestoreTimer); spinAgainRestoreTimer = null; }

      playSound('tick');
      const title = document.getElementById('winner-title');
      const photo = document.getElementById('winner-photo');
      const nameEl = document.getElementById('winner-name');
      
      const oldTitle = title.dataset.defaultTitle || title.innerText;
      title.dataset.defaultTitle = oldTitle; // guardar el valor original una sola vez
      title.innerText = '\uD83C\uDFA1 \u00A1GIRA DE NUEVO!';
      title.style.color = 'var(--roulette-accent-color)';
      nameEl.innerText = 'Vuelve a tirar...';
      photo.style.display = 'none';
      
      winnerOverlay.classList.add('show');
      
      spinAgainRestoreTimer = setTimeout(() => {
        spinAgainRestoreTimer = null;
        winnerOverlay.classList.remove('show');
        setTimeout(() => {
          // Solo restaurar si el ganador no sobrescribió el overlay
          if (!winnerOverlay.classList.contains('show')) {
            title.innerText = title.dataset.defaultTitle || oldTitle;
            title.style.color = '';
            photo.style.display = '';
          }
        }, 600);
      }, 1000);
    }

    function resetWinner(options = {}) {
      winnerOverlay.classList.remove('show');
      if (options.broadcast !== false) {
        const closeToken = `close_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        lastHandledLiveCloseToken = closeToken;
        publishRouletteLiveState({
          type: 'idle',
          closeToken,
          winner: null
        });
      }
    }

    (function initTheme() {
      const saved = safeStorage.getItem('rouletteTheme') || 'minimal';
      applyTheme(saved, { broadcast: false });
    })();
    if (obsLinkInput) obsLinkInput.value = getObsOverlayUrl();
    applyOverlayEnabled(safeStorage.getItem('rouletteOverlayEnabled') !== '0');
    updateConfig();

    btnAddName.addEventListener('click', addManualParticipant);
    inpAddName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addManualParticipant();
    });
    winnerOverlay.addEventListener('click', (e) => {
      if (e.target === winnerOverlay) resetWinner();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (winnerOverlay.classList.contains('show')) resetWinner();
        if (document.getElementById('config-modal').classList.contains('open')) closeConfigModal();
      }
    });
    wrapper.addEventListener('pointerdown', startDrag);
    wrapper.querySelectorAll('.resize-handle').forEach(handle => {
      handle.addEventListener('pointerdown', (evt) => startResize(evt, handle.dataset.resize));
    });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopPointerInteraction);
    window.addEventListener('pointercancel', stopPointerInteraction);
    document.addEventListener('click', (event) => {
      if (!advancedSettingsAnchor) return;
      if (!advancedSettingsAnchor.contains(event.target)) {
        closeAdvancedSettings();
      }
    });

    window.addEventListener('resize', () => {
      applyWheelState();
      saveWheelState();
    });

    subscribeToRequests();
    loadWheelState();
    setSourceTab('list');

