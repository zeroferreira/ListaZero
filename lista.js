    window.addEventListener('focus', function () {
      // Cuando la ventana recibe foco, verificar si hay cambios de tema
      if (typeof window.applyTheme === 'function') {
        window.applyTheme();
      }
      if (typeof window.updateActiveStates === 'function') {
        window.updateActiveStates();
      }
    });

    // Utilidad global: Obtener clave de fecha local (YYYY-MM-DD) forzada en la zona horaria del streamer (America/Mexico_City)
    window.getLocalDateKey = function(ts) {
      const d = ts ? new Date(ts) : new Date();
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Mexico_City',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const parts = formatter.formatToParts(d);
        const map = {};
        parts.forEach(p => map[p.type] = p.value);
        return `${map.year}-${map.month}-${map.day}`;
      } catch (e) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      }
    };

    // Función global de validación y filtrado (Bots, Chino, Pruebas, Usuarios Genéricos)
    window.isInvalid = (val) => {
      if (!val) return true;
      const str = String(val).trim();
      const lower = str.toLowerCase();
      
      // FILTRO DE BOTS (ENLACES): Bloquear enlaces sospechosos, pero permitir plataformas de música (Youtube, Spotify, Apple)
      const hasLink = lower.includes('http://') || lower.includes('https://') || lower.includes('www.') || lower.includes('youtu.be');
      const isMusicLink = lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('spotify.com') || lower.includes('music.apple.com');
      
      if (hasLink && !isMusicLink) return true; // Bloquea enlaces que no son de música

      // FILTRO DE BOTS (ASIÁTICO): Bloquear spam Chino/Kanji largo.
      // Los caracteres Japoneses (Hiragana/Katakana) se permiten siempre.
      const hasKanji = /[\u4E00-\u9FFF]/.test(str);
      const hasJapanese = /[\u3040-\u30FF\u31F0-\u31FF]/.test(str); // Hiragana y Katakana
      // Bloqueamos si tiene Kanji sin Kana, es excesivamente largo, y NO es un enlace musical reconocido
      if (hasKanji && !hasJapanese && str.length > 50 && !isMusicLink) return true;
      
      // FILTRO DE PRUEBAS: Omitir si contiene palabras clave de prueba o patrones genéricos
      const botPatterns = [
        /^usuario\s*test/i,
        /^invitado\d*/i,
        /^moderador(_top)?/i,
        /^fannumero\d+/i,
        /^test\s*song/i,
        /^canción\s*de\s*prueba/i,
        /^user_test\d*/i,
        /^prueba\d*/i,
        /^test\d*/i
      ];

      if (botPatterns.some(regex => regex.test(lower))) return true;
      if (lower === 'prueba' || lower === 'test') return true;
      
      // FILTRO DE LONGITUD Y REPETICIÓN: Omitir nombres absurdamente largos o repetitivos
      // Nota: Se aumentó a 140 para permitir títulos de canciones y artistas largos
      if (str.length > 140 || str.length <= 1) return true;
      
      // Detectar repeticiones sospechosas (ej: "abcabcabc")
      const mid = Math.floor(lower.length / 2);
      if (lower.length > 6 && lower.substring(0, mid) === lower.substring(mid)) return true;

      return ['n/d', 'undefined', 'null', 'unknown', 'various', 'various artists', 'anónimo', 'anonymous'].includes(lower);
    };

    // ==========================================
    // SISTEMA DE AUTO-ACTUALIZACIÓN (FIREBASE)
    // ==========================================
    (function initFirebaseUpdater() {
      let currentVersion = null;

      function checkAndListen() {
        if (!window.db) {
          setTimeout(checkAndListen, 1000);
          return;
        }

        window.db.collection('systemConfig').doc('appVersion').onSnapshot((doc) => {
          if (!doc.exists) return;
          const data = doc.data();
          const newVersion = String(data.timestamp || data.version || '');
          if (!newVersion) return;

          const storedVersion = localStorage.getItem('app_version_fb');
          let triggerUpdate = false;

          if (!currentVersion) {
            // Primer chequeo al abrir la página
            currentVersion = newVersion;
            console.log('🚀 Versión de App Detectada (Firebase):', currentVersion);
            
            if (storedVersion && storedVersion !== newVersion) {
              triggerUpdate = true; // ¡Versión vieja detectada en memoria caché!
              console.log('⚠️ Caché detectado. Forzando aviso de actualización visual.');
            } else {
              localStorage.setItem('app_version_fb', newVersion);
              return;
            }
          } else if (newVersion !== currentVersion) {
            // Chequeo en vivo (WebSocket)
            triggerUpdate = true;
          }

          if (triggerUpdate) {
            console.log('✨ Nueva versión empujada en tiempo real:', newVersion);
            
            // Crear estilos de animación si no existen
            if (!document.getElementById('glass-animations')) {
              const style = document.createElement('style');
              style.id = 'glass-animations';
              style.innerHTML = `
                @keyframes glassPulse {
                  0% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(0,242,254,0.5)); }
                  50% { transform: scale(1.1) translateY(-5px); filter: drop-shadow(0 0 20px rgba(0,242,254,0.8)); }
                  100% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(0,242,254,0.5)); }
                }
              `;
              document.head.appendChild(style);
            }

            // Crear overlay Glassmorphism
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
              transition: opacity 0.6s ease;
            `;

            // Crear tarjeta central
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
              transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
              color: #fff;
              font-family: 'Avenir', 'Inter', system-ui, sans-serif;
            `;

            glassCard.innerHTML = `
              <div style="font-size: 4.5rem; margin-bottom: 20px; animation: glassPulse 2s infinite ease-in-out;">🚀</div>
              <h2 style="margin: 0 0 15px 0; font-weight: 800; font-size: 1.6rem; letter-spacing: 0.5px; background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">ACTUALIZACIÓN DISPONIBLE</h2>
              <p style="color: rgba(255,255,255,0.85); line-height: 1.6; margin-bottom: 30px; font-size: 1.05rem;">
                Hemos mejorado el sistema para darte la mejor experiencia. Actualiza ahora para sincronizar tu consola.
              </p>
              <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%;">
                <button id="glass-update-btn" style="
                  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                  border: none;
                  padding: 14px 35px;
                  border-radius: 30px;
                  color: #000;
                  font-weight: 800;
                  font-size: 1.1rem;
                  cursor: pointer;
                  letter-spacing: 0.5px;
                  box-shadow: 0 4px 15px rgba(0, 242, 254, 0.4);
                  transition: all 0.2s ease;
                  width: 100%;
                  max-width: 280px;
                " onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 8px 25px rgba(0, 242, 254, 0.6)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 15px rgba(0, 242, 254, 0.4)';">
                  ACTUALIZAR AHORA
                </button>
                <p style="margin: 0; font-size: 0.85rem; color: rgba(255,255,255,0.5);">
                  O espera <span id="glass-countdown" style="font-weight: bold; color: #00f2fe; font-size: 1rem;">15</span> segundos...
                </p>
              </div>
            `;

            glassOverlay.appendChild(glassCard);
            document.body.appendChild(glassOverlay);

            // Disparar animación de entrada
            setTimeout(() => {
              glassOverlay.style.opacity = '1';
              glassCard.style.transform = 'translateY(0) scale(1)';
            }, 50);

            // Lógica del contador
            let timeLeft = 15;
            const countdownEl = document.getElementById('glass-countdown');
            const timer = setInterval(() => {
              timeLeft--;
              if (countdownEl) countdownEl.textContent = timeLeft;
              if (timeLeft <= 0) {
                clearInterval(timer);
                localStorage.setItem('app_version_fb', newVersion);
                glassCard.style.transform = 'scale(0.9)';
                glassOverlay.style.opacity = '0';
                setTimeout(() => window.location.reload(true), 400);
              }
            }, 1000);

            // Manejar clic de actualización manual
            document.getElementById('glass-update-btn').addEventListener('click', () => {
               clearInterval(timer);
               localStorage.setItem('app_version_fb', newVersion);
               glassCard.style.transform = 'scale(0.9)';
               glassOverlay.style.opacity = '0';
               setTimeout(() => window.location.reload(true), 400);
            });
          }
        });
      }

      document.addEventListener('DOMContentLoaded', checkAndListen);
    })();


    // ==========================================
    // OPTIMIZACIÓN DE SCROLL (GLASSMORPHISM INTERACTIVO)
    // ==========================================
    (function initScrollPerformance() {
      document.addEventListener('DOMContentLoaded', () => {
        const scrollContainer = document.querySelector('.list-scroll-container');
        const card = document.querySelector('.card');
        if (!scrollContainer || !card) return;

        let scrollTimeout;
        scrollContainer.addEventListener('scroll', () => {
          if (!card.classList.contains('scrolling')) {
            card.classList.add('scrolling');
          }
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            card.classList.remove('scrolling');
          }, 150);
        }, { passive: true });
      });
    })();


    // ==========================================
    // PULL TO REFRESH (MÓVILES)
    // ==========================================
    (function initPullToRefresh() {
      document.addEventListener('DOMContentLoaded', () => {
        const scrollContainer = document.querySelector('.list-scroll-container');
        if (!scrollContainer) return;

        let touchStartY = 0;
        let preventRefresh = false;

        const ptrContainer = document.createElement('div');
        ptrContainer.style.cssText = `
          height: 0px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          transition: height 0.2s ease;
          width: 100%;
        `;
        ptrContainer.innerHTML = '<div style="font-size: 26px; animation: ptr-spin 1s linear infinite;">🔄</div>';
        scrollContainer.parentNode.insertBefore(ptrContainer, scrollContainer);

        if (!document.getElementById('ptr-anim')) {
           const style = document.createElement('style');
           style.id = 'ptr-anim';
           style.innerHTML = '@keyframes ptr-spin { 100% { transform: rotate(360deg); } }';
           document.head.appendChild(style);
        }

        scrollContainer.addEventListener('touchstart', (e) => {
          if (scrollContainer.scrollTop === 0) {
            touchStartY = e.touches[0].clientY;
            preventRefresh = false;
          } else {
            preventRefresh = true;
          }
        }, { passive: true });

        scrollContainer.addEventListener('touchmove', (e) => {
          if (preventRefresh || scrollContainer.scrollTop > 0) return;
          const currentY = e.touches[0].clientY;
          const diff = currentY - touchStartY;
          if (diff > 0) {
             ptrContainer.style.height = Math.min(diff / 2.5, 70) + 'px';
             if (diff > 50 && e.cancelable) e.preventDefault();
          }
        }, { passive: false });

        scrollContainer.addEventListener('touchend', (e) => {
          if (preventRefresh) return;
          const currentY = e.changedTouches[0].clientY;
          const diff = currentY - touchStartY;
          
          if (diff > 120 && scrollContainer.scrollTop === 0) {
            ptrContainer.style.height = '60px';
            setTimeout(() => location.reload(true), 400);
          } else {
            ptrContainer.style.height = '0px';
          }
        });
      });
    })();

(function(){
      var target = document.getElementById('react-modern-widget');
      if (!target || typeof React === 'undefined' || typeof ReactDOM === 'undefined') return;
      // ... (código desactivado)
    })();

(function () {
      return; // Widget React desactivado para evitar conflictos con la lista principal
      function tryMount() {
        var container = document.querySelector('#stats-ticker .ticker-content');
        if (!container || typeof React === 'undefined' || typeof ReactDOM === 'undefined') return;
        if (container.getAttribute('data-react-root') === 'true') return;
        container.setAttribute('data-react-root', 'true');
        var e = React.createElement;
        function useDay() {
          var ref = React.useRef(null);
          var st = React.useState({ items: [], day: '' });
          var dayState = st[0]; var setDayState = st[1];
          React.useEffect(function () {
            function getDay() { var el = document.getElementById('day-select'); return el && el.value ? el.value : ''; }
            function resub() {
              if (ref.current) { ref.current(); ref.current = null; }
              var d = getDay();
              // Si no hay db, reintentar pronto
              if (!window.db) {
                setDayState({ items: [], day: d });
                setTimeout(resub, 500);
                return;
              }
              if (!d) { setDayState({ items: [], day: d }); return; }
              var q = window.db.collection('solicitudes').where('day', '==', d).orderBy('ts', 'desc');
              ref.current = q.onSnapshot(function (snap) { var items = []; snap.forEach(function (doc) { var x = doc.data() || {}; if (String(x.usuario || '').trim().toLowerCase() === 'prueba') return; items.push({ usuario: x.usuario, cancion: x.cancion, artista: x.artista, link: x.link || '', day: d }); }); setDayState({ items: items, day: d }); });
            }
            resub();
            var el = document.getElementById('day-select');
            function onChange() { resub(); }
            el && el.addEventListener('change', onChange);
            // Escuchar evento personalizado por si el cambio de día no dispara 'change' nativo
            window.addEventListener('day-changed', onChange);
            return function () {
              el && el.removeEventListener('change', onChange);
              window.removeEventListener('day-changed', onChange);
              if (ref.current) { ref.current(); ref.current = null; }
            };
          }, []);
          return dayState;
        }
        function useGlobal() {
          var ref = React.useRef(null);
          var st = React.useState({ total: 0, topArtists3: [], topUsers3: [], topSong: '', topSongCount: 0, topPoints3: [], topLiker: 'N/D', topLikerCount: 0, totalLikes: 0, topGenre: 'N/D', topGenreCount: 0 });
          var g = st[0]; var setG = st[1];

          React.useEffect(function () {
            if (ref.current) { ref.current(); ref.current = null; }

            function connect() {
              if (!window.db) { setTimeout(connect, 500); return; }
              ref.current = window.db.collection('globalStats').doc('general').onSnapshot(function (doc) {
                if (!doc || !doc.exists) return;
                var data = doc.data() || {};
                var topArtists = Array.isArray(data.topArtists) ? data.topArtists : [];
                var topUsers = Array.isArray(data.topUsers) ? data.topUsers : [];
                var topPoints = Array.isArray(data.topPoints3) ? data.topPoints3 : [];
                var topArtistEntry = topArtists.length ? String(topArtists[0] || '').trim() : '';
                var topArtistMatch = topArtistEntry.match(/\((\d+)\)\s*$/);
                var topArtistName = topArtistEntry ? topArtistEntry.replace(/\s*\(\d+\)\s*$/, '').trim() : 'N/D';
                var topArtistCount = topArtistMatch ? Number(topArtistMatch[1] || 0) : 0;
                setG(function (prev) {
                  return Object.assign({}, prev, {
                    total: Number(data.totalRequests || 0) || 0,
                    topArtists3: topArtists,
                    topUsers3: topUsers,
                    topSong: data.topSong || 'N/D',
                    topSongCount: Number(data.topSongCount || 0) || 0,
                    topPoints3: topPoints,
                    topLiker: data.topLiker || 'N/D',
                    topLikerCount: Number(data.topLikerCount || 0) || 0,
                    totalLikes: Number(data.totalLikes || 0) || 0,
                    topGenre: data.topGenre || 'N/D',
                    topGenreCount: Number(data.topGenreCount || 0) || 0,
                    topArtist: topArtistName || 'N/D',
                    topArtistCount: Number.isFinite(topArtistCount) ? topArtistCount : 0
                  });
                });
                window.__globalTotalSolicitudes = Number(data.totalRequests || 0) || 0;
                window.__globalDistinctUsers = Number(data.distinctUsers || 0) || 0;
              });
            }
            connect();

            return function () { if (ref.current) { ref.current(); ref.current = null; } };
          }, []);

          return g;
        }
        function StatsTicker() {
          var day = useDay();
          var g = useGlobal();
          function fmt(x) { return x && x.length ? x : 'N/D'; }
          var ac = {}; var sc = {}; var uc = {}; var artistOriginal = {}; var userOriginal = {}; var songOriginal = {};
          (Array.isArray(day.items) ? day.items : []).forEach(function (it) {
            var a = String(it.artista || '').trim().toLowerCase();
            var s = String(it.cancion || '').trim().toLowerCase();
            var u = String(it.usuario || '').trim().toLowerCase();
            var ao = String(it.artista || '').trim();
            var so = String(it.cancion || '').trim();
            var uo = String(it.usuario || '').trim();
            if (a) { ac[a] = (ac[a] || 0) + 1; if (!artistOriginal[a]) artistOriginal[a] = ao; }
            if (s) { sc[s] = (sc[s] || 0) + 1; if (!songOriginal[s]) songOriginal[s] = so; }
            if (u) { uc[u] = (uc[u] || 0) + 1; if (!userOriginal[u]) userOriginal[u] = uo; }
          });
          function top(m, o) { var k = ''; var v = 0; for (var key in m) { var val = m[key]; if (val > v) { v = val; k = key; } else if (val === v && (!k || key < k)) { k = key; } } return { k: o[k] || k, v: v }; }
          var ts = top(sc, songOriginal);
          var usersTop3Day = Object.keys(uc).map(function (k) { return { k: k, c: uc[k], o: userOriginal[k] || k }; }).sort(function (a, b) { var d = b.c - a.c; if (d !== 0) return d; return a.k.localeCompare(b.k); }).slice(0, 3).map(function (it) { return it.o + ' (' + it.c + ')'; });
          var artistsTop3Day = Object.keys(ac).map(function (k) { return { k: k, c: ac[k], o: artistOriginal[k] || k }; }).sort(function (a, b) { var d = b.c - a.c; if (d !== 0) return d; return a.k.localeCompare(b.k); }).slice(0, 3).map(function (it) { return it.o + ' (' + it.c + ')'; });
          var latest = Array.isArray(day.items) && day.items.length ? day.items[0] : null;
          var latestTxt = latest ? (String(latest.cancion || '').trim() + (latest.artista ? ' — ' + String(latest.artista).trim() : '')) : 'N/D';
          var globalUsersTop3 = Array.isArray(g.topUsers3) && g.topUsers3.length ? g.topUsers3.join(', ') : 'N/D';
          var globalArtistsTop3 = Array.isArray(g.topArtists3) && g.topArtists3.length ? g.topArtists3.join(', ') : 'N/D';
          var globalPointsTop3 = Array.isArray(g.topPoints3) && g.topPoints3.length ? g.topPoints3.join(', ') : 'Calculando...';
          var avgTxtGlobal = 'N/D';
          if (typeof window.__globalTotalSolicitudes === 'number' && typeof window.__globalDistinctUsers === 'number' && window.__globalDistinctUsers > 0) {
            avgTxtGlobal = (window.__globalTotalSolicitudes / window.__globalDistinctUsers).toFixed(1);
          }
          // Verificar si estamos cargando totales
          var totalDisplay = g.total ? String(g.total) : '...';

          var globalGenre = g.topGenre && g.topGenre !== 'N/D' ? g.topGenre + (g.topGenreCount ? ' (' + g.topGenreCount + ')' : '') : 'N/D';
          var globalLikesDisplay = g.totalLikes ? g.totalLikes.toLocaleString() : '0';
          var globalText = '<strong>HISTORIA:</strong> • <strong>🏆 Top Puntos:</strong> ' + globalPointsTop3 + ' • <strong>🎵 Más pedida:</strong> ' + fmt(g.topSong) + (typeof g.topSongCount === 'number' ? ' (' + g.topSongCount + ')' : '') + '  •  <strong>👥 Top Usuarios:</strong> ' + globalUsersTop3 + '  •  <strong>🎤 Top Artistas:</strong> ' + globalArtistsTop3 + '  •  <strong>🎹 Género Top:</strong> ' + fmt(globalGenre) + '  •  <strong>❤️ Likes Totales:</strong> ' + globalLikesDisplay + '  •  <strong>📊 Total:</strong> ' + totalDisplay;
          var dayText = '📅 <strong>HOY</strong> • <strong>🎵 Última:</strong> ' + fmt(latestTxt) + ' • <strong>👥 Top Usuarios:</strong> ' + (usersTop3Day.length ? usersTop3Day.join(', ') : 'N/D') + ' • <strong>🎤 Top Artistas:</strong> ' + (artistsTop3Day.length ? artistsTop3Day.join(', ') : 'N/D') + ' • <strong>📝 Solicitudes:</strong> ' + String(day.items.length || 0);
          var sep = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
          return e('span', { dangerouslySetInnerHTML: { __html: dayText + sep + globalText } });
        }
        var root = ReactDOM.createRoot(container);
        root.render(e(StatsTicker));
      }
      if (!window.__reactTickerWait) window.__reactTickerWait = setInterval(tryMount, 500);
      tryMount();
    })();

    let lastLivePayload = null;

// --- LIVE STATUS LOGIC ---
    document.addEventListener('DOMContentLoaded', () => {
      const indicator = document.getElementById('live-indicator');
      const text = indicator.querySelector('.live-text');
      const dot = indicator.querySelector('.live-dot');
      const LIVE_STALE_MS = 2 * 60 * 1000;

      function resolveMillis(ts) {
        try {
          if (!ts) return 0;
          if (typeof ts.toMillis === 'function') return Number(ts.toMillis()) || 0;
          if (typeof ts.toDate === 'function') return Number(ts.toDate().getTime()) || 0;
          const d = new Date(ts);
          return Number(d.getTime()) || 0;
        } catch (_) {
          return 0;
        }
      }
      function applyLiveIndicator(data) {
        const isLiveFlag = !!(data && data.isLive === true);
        const lastUpdateMs = resolveMillis(data && data.lastUpdate);
        const isFresh = lastUpdateMs > 0 && (Date.now() - lastUpdateMs) <= LIVE_STALE_MS;
        const shouldShowLive = isLiveFlag && isFresh;
        if (shouldShowLive) {
          indicator.classList.remove('offline');
          indicator.classList.add('live');
          text.textContent = 'EN VIVO';
          dot.style.backgroundColor = '#fff';
        } else {
          indicator.classList.remove('live');
          indicator.classList.add('offline');
          text.textContent = 'OFFLINE';
          dot.style.backgroundColor = '#9ca3af';
        }
      }

      // Draggable Logic
      let isDragging = false;
      let startX, startY;

      // Load saved position
      const savedPos = localStorage.getItem('liveIndicatorPos');
      if (savedPos) {
        try {
          const p = JSON.parse(savedPos);
          if (p.top) indicator.style.top = p.top;
          if (p.left) indicator.style.left = p.left;
          if (p.right) indicator.style.right = p.right;
        } catch (_) { }
      }

      // --- MOUSE EVENTS (PC) ---
      indicator.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX - indicator.getBoundingClientRect().left;
        startY = e.clientY - indicator.getBoundingClientRect().top;
        indicator.style.cursor = 'grabbing';
        e.preventDefault(); // Evitar selección
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        moveElement(e.clientX, e.clientY);
      });

      document.addEventListener('mouseup', () => {
        if (isDragging) {
          stopDragging();
        }
      });

      // --- TOUCH EVENTS (MOBILE) ---
      indicator.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
          isDragging = true;
          const touch = e.touches[0];
          const rect = indicator.getBoundingClientRect();
          startX = touch.clientX - rect.left;
          startY = touch.clientY - rect.top;
          indicator.style.cursor = 'grabbing';
          // Important: prevent default to avoid scrolling while dragging
          e.preventDefault();
        }
      }, { passive: false });

      document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        if (e.touches.length > 0) {
          e.preventDefault(); // Stop scrolling
          const touch = e.touches[0];
          moveElement(touch.clientX, touch.clientY);
        }
      }, { passive: false });

      document.addEventListener('touchend', (e) => {
        if (isDragging) {
          stopDragging();
        }
      });

      // --- COMMON LOGIC ---
      function moveElement(clientX, clientY) {
        const x = clientX - startX;
        const y = clientY - startY;

        // Boundary checks
        const maxX = window.innerWidth - indicator.offsetWidth;
        const maxY = window.innerHeight - indicator.offsetHeight;

        indicator.style.left = `${Math.min(Math.max(0, x), maxX)}px`;
        indicator.style.top = `${Math.min(Math.max(0, y), maxY)}px`;
        indicator.style.right = 'auto';
        indicator.style.bottom = 'auto';
      }

      function stopDragging() {
        isDragging = false;
        indicator.style.cursor = 'grab';
        localStorage.setItem('liveIndicatorPos', JSON.stringify({
          top: indicator.style.top,
          left: indicator.style.left,
          right: 'auto',
          bottom: 'auto'
        }));
      }

      // Firestore Listener Centralizado para el estado del sistema
      function initLiveStatusListener() {
        const dbRef = window.db || (firebase.apps.length ? firebase.firestore() : null);
        if (!dbRef) {
          setTimeout(initLiveStatusListener, 500);
          return;
        }

        console.log("🔌 Iniciando Listener Centralizado (system/status)...");
        dbRef.collection('system').doc('status').onSnapshot((doc) => {
          if (!doc.exists) return;
          const data = doc.data() || {};

          // 1. Actualizar Indicador Live Flotante
          lastLivePayload = data;
          applyLiveIndicator(data);

          // 2. Actualizar Modo de Cola (Sincronización global)
          const mode = String(data.queueMode || '').trim();
          if (mode && typeof window.setQueueMode === 'function') {
            window.setQueueMode(mode);
          }

          // 3. Actualizar Panel de Admin (si existe)
          const isLive = !!data.isLive;
          const liveStatusText = document.getElementById('live-status-text');
          const liveCodeText = document.getElementById('live-code-text');
          const liveCodeInput = document.getElementById('live-code-admin-input');

          if (liveStatusText) {
            liveStatusText.textContent = `Estado Actual: ${isLive ? 'ONLINE 🟢' : 'OFFLINE 🔴'}`;
            liveStatusText.style.color = isLive ? '#22c55e' : '#ef4444';
          }
          const liveCode = String(data.liveCode || '').trim();
          if (liveCodeText) {
            liveCodeText.textContent = liveCode.length >= 4 ? `Código Actual: ${liveCode}` : 'Código Actual: (desactivado)';
          }
          if (liveCodeInput && !liveCodeInput.value.trim()) {
            liveCodeInput.value = liveCode;
          }

          // 4. Banner de Mantenimiento (maintenanceMessage en system/status)
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
        }, (error) => {
          console.error("❌ Error en Listener Centralizado:", error);
        });
      }

      setInterval(() => {
        applyLiveIndicator(lastLivePayload);
      }, 15000);
      initLiveStatusListener();
    });

(function () {
      console.log('🚀 Iniciando aplicación v2.1 - Fixes applied');
      window.playedSongsCache = {};
      const firebaseConfig = window.ZERO_FM_FIREBASE || {
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
          console.log('Firebase initialized successfully');
        } else {
          console.warn('Firebase SDK not loaded - Offline mode');
        }
      } catch (e) {
        console.error('Error initializing Firebase:', e);
      }

      window.db = db;

      // --- Sincronización de Alias (Vinculación TikTok/Web) ---
      window.userAliasesMap = {};
      if (db) {
        let firstSync = true;
        db.collection('userAliases').onSnapshot(snap => {
          const map = {};
          snap.forEach(doc => {
            const data = doc.data();
            if (data && data.aliasedTo) {
              map[doc.id.toLowerCase()] = data.aliasedTo.toLowerCase();
            }
          });

          const oldMap = window.userAliasesMap || {};
          window.userAliasesMap = map;
          console.log('User aliases updated:', Object.keys(map).length);

          // TAREA: Lanzar popup si se detecta una NUEVA vinculación para el usuario actual
          try {
            const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : localStorage.getItem('savedUsername');
            if (currentUser) {
              const norm = currentUser.replace(/^@/, '').toLowerCase();
              
              // El mapa es { tiktokHandle: webUser }
              const currentTiktokHandles = Object.keys(map).filter(k => map[k] === norm);
              const oldTiktokHandles = Object.keys(oldMap).filter(k => oldMap[k] === norm);

              // Buscar si hay algún handle de TikTok nuevo que apunte a nuestro usuario
              const newHandles = currentTiktokHandles.filter(h => !oldTiktokHandles.includes(h));

              if (newHandles.length > 0 && !firstSync) {
                const newTiktokHandle = newHandles[0];
                console.log('🎉 ¡Nueva vinculación detectada!', norm, '<-', newTiktokHandle);
                if (typeof showLinkingSuccessPopup === 'function') {
                  showLinkingSuccessPopup(norm, newTiktokHandle);
                }
              }
            }
          } catch (e) { console.error('Error en detector de vinculación:', e); }

          firstSync = false;

          // Si el modal de gamificación está abierto, re-suscribir para incluir los nuevos alias
          const modal = document.getElementById('gamification-modal');
          if (modal && !modal.hidden) {
            const u = typeof getCurrentSelectedUser === 'function' ? getCurrentSelectedUser() : null;
            if (u && typeof subscribeUserStatsPointsForUser === 'function') {
              console.log('Re-subscribing points due to alias update for:', u);
              subscribeUserStatsPointsForUser(u);
            }
          }
        }, err => console.error('Error syncing user aliases:', err));
      }

      // Helper unificado para buscar membresías con alias vinculados
      window.hasMembership = function (set, username) {
        if (!set || !(set instanceof Set) || set.size === 0) return false;
        if (!username) return false;
        const unameLc = String(username).trim().replace(/^@/, '').toLowerCase();
        
        // 1. Verificar nombre de usuario directo
        if (set.has(unameLc)) return true;
        
        const map = typeof getUserAliasesCombinedMap === 'function' ? getUserAliasesCombinedMap() : (window.userAliasesMap || {});
        
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
      };

      // Helper global para verificar si un usuario es VIP (cualquier rango: VIP, z0-VIP, z0-Platino)
      window.isUserVipGlobal = function (username) {
        if (!username) return false;
        const u = String(username).trim().toLowerCase();
        const hasMember = typeof window.hasMembership === 'function' ? window.hasMembership : (s, name) => s && s.has(name);
        
        return hasMember(window.vipSet, u) || 
               hasMember(window.z0VipSet, u) || 
               hasMember(window.z0PlatinumSet, u);
      };

      window.START_POINTS_DAY = window.START_POINTS_DAY || '';
      function normalizeDay(str) {
        const raw = String(str || '').trim();
        if (!raw) return '';
        // YYYY-MM-DD or YYYY/MM/DD
        if (/^\d{4}[-\/]\d{2}[-\/]\d{2}$/.test(raw)) return raw.replace(/\//g, '-');
        // DD-MM-YYYY or DD.MM.YYYY or DD/MM/YYYY
        const m = raw.match(/^(\d{2})[\-\/.](\d{2})[\-\/.](\d{4})$/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
        return raw;
      }
      window.isOnOrAfterStart = function (day) {
        const d = normalizeDay(day);
        const s = normalizeDay(window.START_POINTS_DAY || '2025-10-27'); // Default fallback
        return d && s ? (d >= s) : true;
      }
      async function determineStartDay() {
        // HARDCODED START DATE per user requirement: 27 Oct 2025
        window.START_POINTS_DAY = '2025-10-27';
        return window.START_POINTS_DAY;
      }

      async function computeQuickUserPlayedSet(usuario) {
        const rawUser = String(usuario || '').trim();
        const user = rawUser.replace(/^@/, '');
        const sanitize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
        const prefix = sanitize(`${user}-`);
        const out = new Set();

        // Prioritize local storage for days we have locally
        const localPlayedMap = JSON.parse(localStorage.getItem('playedSongs') || '{}');
        const localDays = new Set(Object.keys(localPlayedMap));

        try {
          const snap = await db.collection('playedSongs').get();
          snap.forEach(doc => {
            const dayId = normalizeDay(doc.id || '');
            if (dayId && typeof window.isOnOrAfterStart === 'function' && !window.isOnOrAfterStart(dayId)) return;

            // If we have local data for this day, skip Firestore (Local is authoritative for this device)
            if (localDays.has(dayId)) return;

            const d = doc.data() || {};
            const arr = Array.isArray(d.songs) ? d.songs : (Array.isArray(d.list) ? d.list : (Array.isArray(d.songIds) ? d.songIds : []));
            for (let i = 0; i < arr.length; i++) {
              const id = sanitize(arr[i]);
              if (id.startsWith(prefix)) {
                out.add(id);
              }
            }
          });
        } catch (_) { }

        // Add local data
        localDays.forEach(day => {
          if (typeof window.isOnOrAfterStart === 'function' && !window.isOnOrAfterStart(day)) return;
          const arr = Array.isArray(localPlayedMap[day]) ? localPlayedMap[day] : [];
          arr.forEach(x => {
            const id = sanitize(x);
            if (id.startsWith(prefix)) out.add(id);
          });
        });

        return out;
      }

      function buildLocalUserPlayedSet(usuario) {
        const norm = String(usuario || '').trim().replace(/^@/, '').toLowerCase();
        const localPlayedMap = JSON.parse(localStorage.getItem('playedSongs') || '{}');
        const sanitize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
        const prefix = sanitize(`${norm}-`);
        const ids = new Set();
        const days = Object.keys(localPlayedMap || {});
        for (let i = 0; i < days.length; i++) {
          const arr = Array.isArray(localPlayedMap[days[i]]) ? localPlayedMap[days[i]] : [];
          for (let j = 0; j < arr.length; j++) {
            const id = sanitize(arr[j]);
            if (id.startsWith(prefix)) ids.add(id);
          }
        }
        return ids;
      }

      async function getConsistentPlayedCountForUser(usuario) {
        try {
          const userKey = String(usuario || '').trim().replace(/^@/, '').toLowerCase();


          // 2) Conjuntos de IDs (Local + Firestore)
          const setPlayed = await computeQuickUserPlayedSet(usuario);

          try {
            const qs = await db.collection('systemEvents').where('type', '==', 'togglePlayed').where('usuario', '==', userKey).get();
            const sanitize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
            const latest = {};
            qs.forEach(doc => {
              const d = doc.data() || {};
              const day = String(d.day || '');
              const sid = sanitize(String(d.songId || ''));
              if (!sid) return;
              const ts = d.ts && d.ts.toMillis ? d.ts.toMillis() : 0;
              const k = `${sid}|${day}`;
              const cur = latest[k];
              if (!cur || ts >= cur.ts) latest[k] = { action: String(d.action || '').toLowerCase(), sid };
            });
            Object.keys(latest).forEach(k => {
              const it = latest[k];
              if (it && it.action === 'mark') setPlayed.add(it.sid);
              else if (it && it.action === 'unmark') setPlayed.delete(it.sid);
            });
          } catch (_) { }

          return setPlayed.size;
        } catch (_) { return 0; }
      }
      async function auditPlayedSourcesForUser(usuario) {
        const userKey = String(usuario || '').trim().replace(/^@/, '').toLowerCase();
        const out = { user: userKey, totalsDoc: 0, events: 0, playedByDay: 0, localStorage: 0, union: 0 };
        try { out.totalsDoc = await getQuickPlayedTotalFromHistory(usuario) || 0; } catch (_) { }
        try {
          const qs = await db.collection('systemEvents').where('type', '==', 'togglePlayed').where('usuario', '==', userKey).get();
          const latest = {}; qs.forEach(doc => { const d = doc.data() || {}; const day = String(d.day || ''); const sid = String(d.songId || '').toLowerCase().replace(/[^a-z0-9-]/g, ''); const ts = d.ts && d.ts.toMillis ? d.ts.toMillis() : 0; const k = `${sid}|${day}`; const cur = latest[k]; if (!cur || ts >= cur.ts) latest[k] = { action: String(d.action || '').toLowerCase(), sid }; });
          const set = new Set(); Object.keys(latest).forEach(k => { const it = latest[k]; if (it && it.action === 'mark') set.add(it.sid); });
          out.events = set.size;
          const union = new Set([...set]);
          const snap = await db.collection('playedSongs').get();
          snap.forEach(doc => { const arr = ((doc.data() || {}).songs) || []; (arr || []).forEach(x => { const id = String(x || '').toLowerCase().replace(/[^a-z0-9-]/g, ''); if (id.startsWith(`${userKey}-`)) { union.add(id); } }); });
          out.playedByDay = union.size - set.size;
          try { const setLocal = buildLocalUserPlayedSet(usuario); out.localStorage = setLocal.size; setLocal.forEach(id => union.add(id)); } catch (_) { }
          out.union = union.size;
        } catch (_) { }
        return out;
      }

      async function updateUserPlayedCounter(usuario, day, delta) {
        try {
          const u = (typeof normalizeUserKey === 'function') 
            ? normalizeUserKey(usuario) 
            : (window.normalizeUserKey 
                ? window.normalizeUserKey(usuario) 
                : String(usuario || '').trim().replace(/^@/, '').toLowerCase());
          const d = normalizeDay(day || '');
          if (!u || !d) return;
          const ref = db.collection('playedSongs').doc('userTotals');
          await ref.set({ totals: {}, counts: {}, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
          const payload = { lastUpdated: firebase.firestore.FieldValue.serverTimestamp() };
          payload[`totals.${u}`] = firebase.firestore.FieldValue.increment(delta);
          payload[`counts.${d}.${u}`] = firebase.firestore.FieldValue.increment(delta);
          await ref.set(payload, { merge: true });

          // Sincronización global de puntos en tiempo real (Hallazgo 3)
          const pointsDelta = delta * (typeof POINTS_CONFIG !== 'undefined' && POINTS_CONFIG.SONG_REQUEST ? POINTS_CONFIG.SONG_REQUEST : 25);
          const statsRef = db.collection('userStats').doc(u);
          await statsRef.set({
            totalPoints: firebase.firestore.FieldValue.increment(pointsDelta),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.error("Error updating user played counter and points:", e);
        }
      }
      async function getQuickPlayedTotalFromHistory(usuario) {
        try {
          const u = String(usuario || '').trim().replace(/^@/, '').toLowerCase();
          if (!u) return 0;
          const doc = await db.collection('playedSongs').doc('userTotals').get();
          if (!doc.exists) return 0;
          const data = doc.data() || {};
          const totals = data.totals || {};
          return Number(totals[u] || 0) || 0;
        } catch (_) { return 0; }
      }
      // ======= Aggregador incremental por usuario (evita recorrer día por día) =======
      window.__userPlayedAgg = window.__userPlayedAgg || { ids: {}, totals: {} };
      function loadUserPlayedAgg() {
        try {
          const idsRaw = localStorage.getItem('user_played_ids') || '{}';
          const totalsRaw = localStorage.getItem('user_played_totals') || '{}';
          const idsObj = JSON.parse(idsRaw);
          const totalsObj = JSON.parse(totalsRaw);
          const ids = {};
          Object.keys(idsObj).forEach(k => { ids[k] = new Set(Array.isArray(idsObj[k]) ? idsObj[k] : []); });
          window.__userPlayedAgg = { ids, totals: totalsObj };
        } catch (_) { window.__userPlayedAgg = { ids: {}, totals: {} }; }
      }
      function saveUserPlayedAgg() {
        try {
          const idsObj = {};
          Object.keys(window.__userPlayedAgg.ids || {}).forEach(k => { idsObj[k] = Array.from(window.__userPlayedAgg.ids[k] || new Set()); });
          localStorage.setItem('user_played_ids', JSON.stringify(idsObj));
          localStorage.setItem('user_played_totals', JSON.stringify(window.__userPlayedAgg.totals || {}));
        } catch (_) { }
      }
      function updateAggForDocForUser(u, reqPrefixes, day, arr) {
        const user = String(u || '').trim().replace(/^@/, '');
        const sanitize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
        const prefix = sanitize(`${user}-`);
        const idsMap = window.__userPlayedAgg.ids || (window.__userPlayedAgg.ids = {});
        const totalsMap = window.__userPlayedAgg.totals || (window.__userPlayedAgg.totals = {});
        const key = user.toLowerCase();
        const set = idsMap[key] || (idsMap[key] = new Set());
        if (day && !isOnOrAfterStart(day)) return;
        for (let i = 0; i < arr.length; i++) {
          const id = sanitize(arr[i]);
          if (!id.startsWith(prefix)) continue;
          if (reqPrefixes && reqPrefixes.size) {
            let ok = false;
            for (const pf of reqPrefixes) { if (id.startsWith(pf)) { ok = true; break; } }
            if (!ok) continue;
          }
          if (!set.has(id)) {
            set.add(id);
            totalsMap[key] = (totalsMap[key] || 0) + 1;
          }
        }
      }
      function getImmediatePlayedCountFromAgg(usuario) {
        try {
          const key = String(usuario || '').trim().replace(/^@/, '').toLowerCase();
          const totals = window.__userPlayedAgg.totals || {};
          const ids = window.__userPlayedAgg.ids || {};
          if (typeof totals[key] === 'number') return totals[key];
          const set = ids[key];
          return (set && set.size) ? set.size : 0;
        } catch (_) { return 0; }
      }

      firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
          firebase.auth().signInAnonymously().catch((err) => {
            console.error('Error al iniciar sesión anónima:', err);
          });
        }
        determineStartDay().then(() => {
          try {
            const u = (typeof getCurrentSelectedUser === 'function' ? getCurrentSelectedUser() : getCurrentUser());
            if (u) startCloudRealtimeForUser(u);
          } catch (_) { }
        }).catch(() => { });
      });
      (function hydrateVisibleUserPoints() {
        async function refreshVisibleUserPoints() {
          try {
            const candidate = String((typeof getCurrentSelectedUser === 'function' ? getCurrentSelectedUser() : getCurrentUser()) || getCurrentUser() || '').trim().replace(/^@/, '').toLowerCase();
            if (!candidate) return;
            const doc = await db.collection('userStats').doc(candidate).get();
            if (!doc || !doc.exists) return;
            const allStr = localStorage.getItem('gamificationData') || '{}';
            const all = JSON.parse(allStr);
            const d = all[candidate] || {
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
            all[candidate] = d;
            localStorage.setItem('gamificationData', JSON.stringify(all));
            try { if (typeof window.refreshStatsTicker === 'function') window.refreshStatsTicker(); } catch (_) { }
          } catch (_) { }
        }
        try {
          refreshVisibleUserPoints();
          setInterval(refreshVisibleUserPoints, 60000);
        } catch (_) { }
      })();

      // Verificación integral de toggle y estadísticas
      window.runToggleVerification = async function (targetUser) {
        const usuario = String(targetUser || getCurrentUser() || '').trim().toLowerCase();
        const day = document.getElementById('day-select')?.value || '';
        const items = Array.from(document.querySelectorAll('#solicitudes-list .item'));
        const li = items.find(x => String(x.dataset.username || '').toLowerCase() === usuario) || items[0];
        if (!li) return { ok: false, reason: 'no_items' };
        const songId = li.dataset.songId;
        const beforeLocal = countLocalPlayedForUser(usuario);
        const beforeCloud = await getQuickPlayedTotalFromHistory(usuario);
        await toggleSongPlayed(li, songId, day);
        await new Promise(r => setTimeout(r, 300));
        const afterLocal = countLocalPlayedForUser(usuario);
        const afterCloud = await getQuickPlayedTotalFromHistory(usuario);
        const deltaLocal = afterLocal - beforeLocal;
        const deltaCloud = afterCloud - beforeCloud;
        console.log('AUTOTEST TOGGLE:', { usuario, day, songId, beforeLocal, afterLocal, deltaLocal, beforeCloud, afterCloud, deltaCloud });
        return { ok: true, usuario, day, beforeLocal, afterLocal, deltaLocal, beforeCloud, afterCloud, deltaCloud };
      }

      const solicitudesList = document.getElementById('solicitudes-list');
      const emptyEl = document.getElementById('empty');
      const vipOnly = document.getElementById('vip-only');
      const daySelect = document.getElementById('day-select');
      const sortSelect = document.getElementById('sort-select');

      const allUsersSelect = document.getElementById('all-users-select');
      const vipAddBtn = document.getElementById('vip-add');
      const vipListEl = document.getElementById('vip-list');
      const wipeAllBtn = document.getElementById('wipe-all');

      // Elementos para donadores
      const allUsersSelectDonador = document.getElementById('all-users-select-donador');
      const donadorAddBtn = document.getElementById('donador-add');
      const donadorListEl = document.getElementById('donador-list');

      const vipRemoveModal = document.getElementById('vip-remove-modal');
      const vipRemoveUserSpan = document.getElementById('vip-remove-user');
      const vipRemoveCancelBtn = document.getElementById('vip-remove-cancel');
      const vipRemoveConfirmBtn = document.getElementById('vip-remove-confirm');
      let pendingVipRemoveUser = null;
      let pendingVipRemoveType = 'vip'; // 'vip', 'z0' o 'donador'

      // Variables globales para los sets de usuarios
      window.vipSet = new Set();
      window.z0VipSet = new Set();
      window.donadorSet = new Set();
      let vipSet = window.vipSet;
      let z0VipSet = window.z0VipSet;
      let donadorSet = window.donadorSet;
      window.__QUEUE_MODE__ = window.__QUEUE_MODE__ || 'default';
      let unsubscribeSolicitudes = null;
      let currentDayItems = [];
      // Orden manual (compartido): suscripción y estado actual
      let unsubscribeManualOrder = null;
      let currentManualOrder = [];

      const SORT_MODE_KEY = 'lista_sort_mode';
      const allowedSortModes = new Set(['default', 'smart', 'tandas15', 'recent', 'oldest', 'manual_recent', 'manual_fifo']);

      function getSortMode() {
        try {
          const vSel = String(sortSelect?.value || '').trim();
          const vStore = String(localStorage.getItem(SORT_MODE_KEY) || '').trim();
          const mode = vSel || vStore || 'recent';
          if (allowedSortModes.has(mode)) return mode;
        } catch (_) { }
        return 'recent';
      }

      function isManualSortMode(mode) {
        const m = String(mode || getSortMode() || '').trim();
        return m === 'manual_recent' || m === 'manual_fifo';
      }

      function compareItemsByTime(a, b, dir) {
        const ta = getItemTimeMs(a);
        const tb = getItemTimeMs(b);
        if (ta !== tb) return dir === 'desc' ? (tb - ta) : (ta - tb);

        const ha = String(a?.hora || '').trim();
        const hb = String(b?.hora || '').trim();
        if (ha && hb && ha !== hb) return dir === 'desc' ? hb.localeCompare(ha) : ha.localeCompare(hb);

        const ida = String(a?.id || a?.docId || a?.requestId || '').trim();
        const idb = String(b?.id || b?.docId || b?.requestId || '').trim();
        if (ida && idb && ida !== idb) return dir === 'desc' ? idb.localeCompare(ida) : ida.localeCompare(idb);
        return 0;
      }

      function sortItemsStable(items, dir) {
        const arr = Array.isArray(items) ? items.slice() : [];
        arr.sort((a, b) => compareItemsByTime(a, b, dir));
        return arr;
      }

      function getQueueMode() {
        try { return String(window.__QUEUE_MODE__ || 'default').trim() || 'default'; } catch (_) { return 'default'; }
      }

      function badgeRankForOrdering(badge) {
        const b = String(badge || '').trim();
        if (b === 'superfan') return 0;
        if (b === 'z0-platino') return 1;
        if (b === 'z0-vip') return 2;
        if (b === 'vip') return 3;
        if (b === 'donador') return 4;
        if (b === 'z0-fan') return 5;
        return 6;
      }

      function getOrderingBadgeForUser(username, itemBadge) {
        const selected = typeof window.getSelectedBadgeFor === 'function' ? window.getSelectedBadgeFor(username) : '';
        if (selected) return selected;
        const membership = typeof getCurrentMembership === 'function' ? getCurrentMembership(username) : '';
        const direct = String(itemBadge || '').trim();
        if (membership && badgeRankForOrdering(membership) <= badgeRankForOrdering(direct)) return membership;
        return direct || membership;
      }

      function applyTandas15Order(items) {
        const base = sortItemsStable(items, 'asc');
        const slotMs = 15 * 60 * 1000;

        // --- NUEVA LÓGICA: Bloques dinámicos de mínimo 3 canciones ---
        const blocks = [];
        let currentBlock = [];
        let blockStartTime = null;
        let blockExpiryTime = null;

        base.forEach((it) => {
          const t = getItemTimeMs(it);
          if (currentBlock.length === 0) {
            currentBlock.push(it);
            blockStartTime = t;
            blockExpiryTime = null;
          } else {
            // Regla: Mínimo 3 canciones por tanda.
            // Si tiene menos de 3, se queda abierta sin importar el tiempo.
            if (currentBlock.length < 3) {
              currentBlock.push(it);
              if (currentBlock.length === 3) {
                // El tiempo de 15 comienza cuando se llena con mínimo 3.
                blockExpiryTime = t + slotMs;
              }
            } else {
              // Ya tiene 3 o más. Si aún no expira (o no tiene tiempo definido), sigue abierta.
              if (!blockExpiryTime || t < blockExpiryTime) {
                currentBlock.push(it);
              } else {
                // Ya expiró el tiempo extra después de la 3ra canción. Cerrar.
                blocks.push({ items: currentBlock, startTime: blockStartTime, expiryTime: blockExpiryTime });
                currentBlock = [it];
                blockStartTime = t;
                blockExpiryTime = null;
              }
            }
          }
        });
        if (currentBlock.length > 0) {
          blocks.push({ items: currentBlock, startTime: blockStartTime, expiryTime: blockExpiryTime });
        }

        const out = [];
        blocks.forEach((block, slotIdx) => {
          const group = block.items;
          const perUser = new Map();
          group.forEach((it) => {
            const raw = String(it?.usuario || it?.displayName || '').trim();
            const key = (typeof normalizeUserKey === 'function') ? (normalizeUserKey(raw) || raw) : raw;
            if (!key) return;
            if (!perUser.has(key)) perUser.set(key, []);
            perUser.get(key).push(it);
          });

          const users = Array.from(perUser.keys());
          const expanded = [];
          users.forEach((u) => {
            const arr = perUser.get(u) || [];
            arr.sort((a, b) => compareItemsByTime(a, b, 'asc'));
            const badge = getOrderingBadgeForUser(u, (arr?.[0]?.badge || ''));
            const rank = badgeRankForOrdering(badge);
            const tier = (badge === 'superfan' || badge === 'z0-platino') ? 0 : ((badge === 'z0-vip' || badge === 'vip') ? 1 : 2);

            for (let idx = 0; idx < arr.length; idx++) {
              const it = arr[idx];
              const t = getItemTimeMs(it);
              let bucket = 5;
              if (tier === 0 && idx < 2) bucket = 0;
              else if (tier === 1 && idx === 0) bucket = 1;
              else if (tier === 2 && idx === 0) bucket = 2;
              else if (tier === 0) bucket = 3;
              else if (tier === 1) bucket = 4;

              expanded.push({ it, bucket, rank, t, u, idx, _tandaSlot: slotIdx, _tandaStart: block.startTime, _tandaExpiry: block.expiryTime });
            }
          });

          expanded.sort((a, b) => {
            if (a.bucket !== b.bucket) return a.bucket - b.bucket;
            if (a.rank !== b.rank) return a.rank - b.rank;
            const ta = Number.isFinite(a.t) ? a.t : 0;
            const tb = Number.isFinite(b.t) ? b.t : 0;
            if (ta !== tb) return ta - tb;
            if (a.u !== b.u) return a.u.localeCompare(b.u, 'es');
            return a.idx - b.idx;
          });

          expanded.forEach(e => {
            e.it._tandaSlot = e._tandaSlot;
            e.it._tandaStart = e._tandaStart;
            e.it._tandaExpiry = e._tandaExpiry;
            out.push(e.it);
          });
        });

        return out;
      }

      function applySmartOrder(items) {
        const base = sortItemsStable(items, 'asc');
        const gapMs = 18 * 60 * 1000;
        const blocks = [];
        let cur = [];
        let prevT = null;
        for (let i = 0; i < base.length; i++) {
          const it = base[i];
          const t = getItemTimeMs(it);
          const hasT = Number.isFinite(t) && t > 0;
          if (cur.length && prevT !== null && hasT && (t - prevT) > gapMs) {
            blocks.push(cur);
            cur = [];
          }
          cur.push(it);
          if (hasT) prevT = t;
        }
        if (cur.length) blocks.push(cur);

        function orderBlock(blockItems) {
          const perUser = new Map();
          blockItems.forEach((it) => {
            const raw = String(it?.usuario || it?.displayName || '').trim();
            const key = (typeof normalizeUserKey === 'function') ? (normalizeUserKey(raw) || raw) : raw;
            if (!key) return;
            if (!perUser.has(key)) perUser.set(key, []);
            perUser.get(key).push(it);
          });
          const users = Array.from(perUser.keys());
          const badgeByUser = new Map();
          users.forEach((u) => {
            const arr = perUser.get(u) || [];
            arr.sort((a, b) => compareItemsByTime(a, b, 'asc'));
            badgeByUser.set(u, getOrderingBadgeForUser(u, (arr?.[0]?.badge || '')));
          });
          const expanded = [];
          users.forEach((u) => {
            const arr = perUser.get(u) || [];
            arr.sort((a, b) => compareItemsByTime(a, b, 'asc'));
            const badge = badgeByUser.get(u) || '';
            const rank = badgeRankForOrdering(badge);
            const tier = (badge === 'superfan' || badge === 'z0-platino') ? 0 : ((badge === 'z0-vip' || badge === 'vip') ? 1 : 2);
            for (let idx = 0; idx < arr.length; idx++) {
              const it = arr[idx];
              const t = getItemTimeMs(it);
              let group = 5;
              if (tier === 0 && idx < 2) group = 0;
              else if (tier === 1 && idx === 0) group = 1;
              else if (tier === 2 && idx === 0) group = 2;
              else if (tier === 0) group = 3;
              else if (tier === 1) group = 4;
              expanded.push({ it, group, rank, t, u, idx });
            }
          });

          expanded.sort((a, b) => {
            if (a.group !== b.group) return a.group - b.group;
            if (a.rank !== b.rank) return a.rank - b.rank;
            const ta = Number.isFinite(a.t) ? a.t : 0;
            const tb = Number.isFinite(b.t) ? b.t : 0;
            if (ta !== tb) return ta - tb;
            if (a.u !== b.u) return a.u.localeCompare(b.u, 'es');
            return a.idx - b.idx;
          });

          return expanded.map(x => x.it);
        }

        const out = [];
        for (let i = 0; i < blocks.length; i++) {
          const ordered = orderBlock(blocks[i]);
          for (let j = 0; j < ordered.length; j++) out.push(ordered[j]);
        }
        return out;
      }

      function applyDisplayOrder(items) {
        const mode = getSortMode();
        let base = [];
        if (mode === 'smart') base = applySmartOrder(items);
        else if (mode === 'tandas15') base = applyTandas15Order(items);
        else if (mode === 'default' || mode === 'oldest' || mode === 'manual_fifo') base = sortItemsStable(items, 'asc');
        else if (mode === 'recent' || mode === 'manual_recent') base = sortItemsStable(items, 'desc');
        else base = sortItemsStable(items, 'desc');
        if (Array.isArray(currentManualOrder) && currentManualOrder.length) return applyOrder(base, currentManualOrder);
        return base;
      }

      function showCopyNotification(anchor) {
        try {
          const existing = document.getElementById('copy-toast');
          if (existing) existing.remove();
          const n = document.createElement('div');
          n.id = 'copy-toast';
          n.textContent = 'Contenido copiado';
          let top = 0;
          let left = 0;
          if (anchor && anchor.getBoundingClientRect) {
            const rect = anchor.getBoundingClientRect();
            top = rect.top + window.scrollY - 28;
            left = rect.left + window.scrollX + rect.width / 2;
            n.style.position = 'absolute';
            n.style.transform = 'translate(-50%, 6px)';
          } else {
            n.style.position = 'fixed';
            n.style.bottom = '16px';
            n.style.right = '16px';
          }
          if (top || top === 0) {
            n.style.top = top + 'px';
          }
          if (left || left === 0) {
            n.style.left = left + 'px';
          }
          n.style.padding = '8px 12px';
          n.style.borderRadius = '999px';
          n.style.fontSize = '12px';
          n.style.background = 'rgba(17, 24, 39, 0.9)';
          n.style.color = '#f9fafb';
          n.style.boxShadow = '0 8px 20px rgba(0,0,0,0.35)';
          n.style.zIndex = '2147483647';
          n.style.opacity = '0';
          if (!n.style.transform) n.style.transform = 'translateY(6px)';
          n.style.transition = 'opacity 0.18s ease-out, transform 0.18s ease-out';
          document.body.appendChild(n);
          requestAnimationFrame(function () {
            n.style.opacity = '1';
            n.style.transform = 'translate(-50%, 0)';
          });
          setTimeout(function () {
            n.style.opacity = '0';
            n.style.transform = 'translate(-50%, 6px)';
            setTimeout(function () {
              if (n.parentNode) n.parentNode.removeChild(n);
            }, 180);
          }, 1200);
        } catch (_) { }
      }

      function copyTextToClipboard(text, anchor) {
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text)
            .then(function () {
              showCopyNotification(anchor);
            })
            .catch(function (e) {
              console.error('Error copiando al portapapeles', e);
            });
        } else {
          const temp = document.createElement('textarea');
          temp.value = text;
          temp.style.position = 'fixed';
          temp.style.opacity = '0';
          document.body.appendChild(temp);
          temp.focus();
          temp.select();
          try {
            document.execCommand('copy');
            showCopyNotification(anchor);
          } catch (e) { }
          document.body.removeChild(temp);
        }
      }

      const editActionsBar = document.getElementById('edit-actions-bar');
      const undoDeleteBtn = document.getElementById('undo-delete-btn');
      const redoDeleteBtn = document.getElementById('redo-delete-btn');
      const openDeletedBtn = document.getElementById('open-deleted-btn');
      const clearDeletedBtn = document.getElementById('clear-deleted-btn');
      const deletedCountBadge = document.getElementById('deleted-count-badge');
      const deletedModal = document.getElementById('deleted-modal');
      const deletedCloseBtn = document.getElementById('deleted-close');
      const deletedCloseXBtn = document.getElementById('deleted-close-x');
      const deletedDaySelect = document.getElementById('deleted-day-select');
      const deletedListEl = document.getElementById('deleted-list');
      const restoreAllDeletedBtn = document.getElementById('restore-all-deleted');
      let editUndoStack = [];
      let editRedoStack = [];
      let deletedRestoreInFlight = false;

      function isEditModeActive() {
        try {
          return !!(solicitudesList && solicitudesList.classList.contains('editing'));
        } catch (_) {
          return false;
        }
      }

      function refreshEditActionsBar() {
        if (!editActionsBar) return;
        const active = isEditModeActive();
        editActionsBar.hidden = !active;
        editActionsBar.classList.toggle('active', active);
        if (!active) return;
        if (undoDeleteBtn) undoDeleteBtn.disabled = editUndoStack.length === 0;
        if (redoDeleteBtn) redoDeleteBtn.disabled = editRedoStack.length === 0;
        try { refreshDeletedCountBadge(); } catch (_) { }
      }

      function getDeletedBinMap() {
        try { return JSON.parse(localStorage.getItem('deleted_solicitudes_by_day') || '{}'); } catch (_) { return {}; }
      }

      function setDeletedBinMap(map) {
        try { localStorage.setItem('deleted_solicitudes_by_day', JSON.stringify(map || {})); } catch (_) { }
      }

      function getDeletedKey(entry) {
        const docId = String(entry?.docId || '').trim();
        if (docId) return `doc:${docId}`;
        const songId = String(entry?.songId || '').trim();
        if (songId) return `song:${songId}`;
        const id = String(entry?.requestData?.id || '').trim();
        if (id) return `id:${id}`;
        return '';
      }

      function listDeletedForDay(day) {
        const key = String(day || '').trim();
        const map = getDeletedBinMap();
        const arr = Array.isArray(map[key]) ? map[key] : [];
        return arr.slice().sort((a, b) => Number(b?.deletedAt || 0) - Number(a?.deletedAt || 0));
      }

      function upsertDeletedEntry(day, entry) {
        const d = String(day || '').trim();
        if (!d) return;
        const map = getDeletedBinMap();
        const arr = Array.isArray(map[d]) ? map[d] : [];
        const k = getDeletedKey(entry);
        const nextEntry = {
          ...entry,
          day: d,
          deletedAt: Number(entry?.deletedAt || Date.now()),
          requestData: sanitizeRequestDataForStorage(entry?.requestData, d),
          localEntry: sanitizeLocalEntryForStorage(entry?.localEntry)
        };
        const idx = k ? arr.findIndex((x) => getDeletedKey(x) === k) : -1;
        if (idx >= 0) arr[idx] = nextEntry;
        else arr.push(nextEntry);
        map[d] = arr.slice(-500);
        setDeletedBinMap(map);
      }

      function removeDeletedEntry(day, entry) {
        const d = String(day || '').trim();
        if (!d) return;
        const map = getDeletedBinMap();
        const arr = Array.isArray(map[d]) ? map[d] : [];
        const k = getDeletedKey(entry);
        const next = k ? arr.filter((x) => getDeletedKey(x) !== k) : arr;
        map[d] = next;
        setDeletedBinMap(map);
      }

      function clearDeletedForDay(day) {
        const d = String(day || '').trim();
        if (!d) return;
        const map = getDeletedBinMap();
        map[d] = [];
        setDeletedBinMap(map);
      }

      function refreshDeletedCountBadge() {
        if (!deletedCountBadge) return;
        const day = String(document.getElementById('day-select')?.value || '').trim();
        const count = day ? listDeletedForDay(day).length : 0;
        deletedCountBadge.hidden = count <= 0;
        deletedCountBadge.textContent = String(count);
      }

      function openDeletedModal() {
        if (!deletedModal) return;
        deletedModal.hidden = false;
        try {
          if (deletedDaySelect) {
            deletedDaySelect.innerHTML = '';
            const daySel = document.getElementById('day-select');
            if (daySel) {
              Array.from(daySel.options || []).forEach((opt) => {
                const o = document.createElement('option');
                o.value = opt.value;
                o.textContent = opt.textContent;
                deletedDaySelect.appendChild(o);
              });
              deletedDaySelect.value = daySel.value;
            }
          }
        } catch (_) { }
        renderDeletedList();
      }

      function closeDeletedModal() {
        if (!deletedModal) return;
        deletedModal.hidden = true;
      }

      function formatDeletedRowTitle(entry) {
        const d = entry?.requestData || entry || {};
        const song = String(d.cancion || '').trim() || 'Desconocida';
        const artist = String(d.artista || '').trim() || 'Desconocido';
        return `${song} — ${artist}`;
      }

      function formatDeletedRowSub(entry) {
        const d = entry?.requestData || entry || {};
        const u = String(d.displayName || d.usuario || '').trim() || 'Anónimo';
        const h = String(d.hora || '').trim() || '';
        return h ? `Pedido por ${u} • ${h}` : `Pedido por ${u}`;
      }

      function normalizeTsMs(v) {
        try {
          if (!v) return 0;
          if (typeof v.toMillis === 'function') return v.toMillis();
          if (typeof v.toDate === 'function') return v.toDate().getTime();
          if (v instanceof Date) return v.getTime();
          const t = new Date(v).getTime();
          return Number.isFinite(t) ? t : 0;
        } catch (_) {
          return 0;
        }
      }

      function sanitizeRequestDataForStorage(d, fallbackDay) {
        try {
          const src = d || {};
          const day = String(src.day || fallbackDay || '').trim();
          const tsMs = normalizeTsMs(src.ts) || Number(src.tsMs || 0) || Date.now();
          return {
            id: src.id,
            usuario: src.usuario,
            displayName: src.displayName,
            cancion: src.cancion,
            artista: src.artista,
            genero: src.genero,
            cover: src.cover,
            status: src.status,
            hora: src.hora,
            day,
            tsMs
          };
        } catch (_) {
          return d || {};
        }
      }

      function sanitizeLocalEntryForStorage(e) {
        try {
          if (!e) return null;
          const out = { ...e };
          if (out.time) {
            const ms = normalizeTsMs(out.time);
            if (ms) out.time = ms;
          }
          return out;
        } catch (_) {
          return e || null;
        }
      }

      async function applyRestoreAction(action, options) {
        const day = String(action?.day || '').trim();
        if (!day) return;
        const songId = action.songId;
        const shouldUpdateUI = !!(options && options.updateUI);

        if (action.docId && window.db) {
          const data = { ...(action.requestData || {}) };
          const tsMs = Number(data.tsMs || 0) || normalizeTsMs(data.ts) || Date.now();
          if (firebase?.firestore?.Timestamp?.fromMillis) data.ts = firebase.firestore.Timestamp.fromMillis(tsMs);
          else data.ts = new Date(tsMs);
          data.day = String(data.day || day).trim() || day;
          await window.db.collection('solicitudes').doc(action.docId).set(data, { merge: false });
        } else {
          const byDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');
          const arr = Array.isArray(byDay[day]) ? byDay[day] : [];
          if (action.localEntry) {
            const insertAt = Number.isFinite(action.localIndex) ? Math.max(0, Math.min(action.localIndex, arr.length)) : arr.length;
            arr.splice(insertAt, 0, action.localEntry);
            byDay[day] = arr;
            localStorage.setItem('solicitudes_by_day', JSON.stringify(byDay));
          } else if (action.requestData) {
            arr.push(action.requestData);
            byDay[day] = arr;
            localStorage.setItem('solicitudes_by_day', JSON.stringify(byDay));
          }
        }

        if (action.wasPlayed && songId) {
          const localPlayed = getLocalPlayedMap();
          const arr = Array.isArray(localPlayed[day]) ? localPlayed[day] : [];
          if (!arr.includes(songId)) {
            arr.push(songId);
            localPlayed[day] = arr;
            setLocalPlayedMap(localPlayed);
          }
          try { if (window.playedSongsCache) window.playedSongsCache[day] = arr; } catch (_) { }
          if (action.wasSkipped) {
            const localSkipped = getLocalSkippedMap();
            const sArr = Array.isArray(localSkipped[day]) ? localSkipped[day] : [];
            if (!sArr.includes(songId)) {
              sArr.push(songId);
              localSkipped[day] = sArr;
              setLocalSkippedMap(localSkipped);
            }
          }
          await cloudAddPlayed(day, songId, action.itemForLog, { skipped: !!action.wasSkipped });
        }

        if (action.docId) {
          const existing = Array.isArray(currentManualOrder) ? currentManualOrder.slice() : [];
          if (!existing.includes(action.docId)) {
            const insertAt = Number.isFinite(action.orderIndex) ? Math.max(0, Math.min(action.orderIndex, existing.length)) : existing.length;
            existing.splice(insertAt, 0, action.docId);
            currentManualOrder = existing;
            localStorage.setItem(`manualOrder:${day}`, JSON.stringify(existing));
            try {
              if (window.db) {
                await window.db.collection('manualOrders').doc(day).set({
                  order: existing,
                  day,
                  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
              }
            } catch (_) { }
          }
        }

        removeDeletedEntry(day, action);
        try { refreshDeletedCountBadge(); } catch (_) { }
        if (shouldUpdateUI) {
          const selectedDay = String(document.getElementById('day-select')?.value || '').trim();
          if (selectedDay === day) {
            const restored = {
              ...(action.requestData || {}),
              id: action.docId || (action.requestData?.id || null),
              requestId: action.requestData?.id,
              day,
              hora: action.requestData?.hora || action.itemForLog?.hora || toHour(action.requestData?.ts)
            };
            const idKey = String(action.docId || '');
            const next = Array.isArray(currentDayItems) ? currentDayItems.slice() : [];
            const existingIdx = idKey ? next.findIndex(x => String(x?.id || '') === idKey) : -1;
            if (existingIdx >= 0) next[existingIdx] = restored;
            else next.push(restored);
            currentDayItems = applyOrder(next, currentManualOrder);
            window.__dayItems = currentDayItems;
            renderSolicitudes(currentDayItems);
          }
        }
      }

      async function applyDeleteAction(action, options) {
        const day = String(action?.day || '').trim();
        if (!day) return;
        const songId = action.songId;
        const shouldUpdateUI = !!(options && options.updateUI);

        if (action.docId && window.db) {
          await window.db.collection('solicitudes').doc(action.docId).delete();
        } else {
          const byDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');
          const arr = Array.isArray(byDay[day]) ? byDay[day] : [];
          if (action.localEntry) {
            const idx = arr.findIndex(x =>
              x.usuario === action.localEntry.usuario &&
              x.cancion === action.localEntry.cancion &&
              x.artista === action.localEntry.artista &&
              String(x.time) === String(action.localEntry.time)
            );
            if (idx >= 0) arr.splice(idx, 1);
            byDay[day] = arr;
            localStorage.setItem('solicitudes_by_day', JSON.stringify(byDay));
          }
        }

        upsertDeletedEntry(day, action);
        try { refreshDeletedCountBadge(); } catch (_) { }

        if (action.wasPlayed && songId) {
          const localPlayed = getLocalPlayedMap();
          const arr = Array.isArray(localPlayed[day]) ? localPlayed[day] : [];
          localPlayed[day] = arr.filter(id => id !== songId);
          setLocalPlayedMap(localPlayed);
          try { if (window.playedSongsCache) window.playedSongsCache[day] = localPlayed[day]; } catch (_) { }
          const localSkipped = getLocalSkippedMap();
          const sArr = Array.isArray(localSkipped[day]) ? localSkipped[day] : [];
          localSkipped[day] = sArr.filter(id => id !== songId);
          setLocalSkippedMap(localSkipped);
          await cloudRemovePlayed(day, songId, action.itemForLog, { skipped: !!action.wasSkipped });
        }

        if (action.docId) {
          const existing = Array.isArray(currentManualOrder) ? currentManualOrder.slice() : [];
          const next = existing.filter(id => id !== action.docId);
          currentManualOrder = next;
          localStorage.setItem(`manualOrder:${day}`, JSON.stringify(next));
          try {
            if (window.db) {
              await window.db.collection('manualOrders').doc(day).set({
                order: next,
                day,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
            }
          } catch (_) { }
        }

        if (shouldUpdateUI) {
          const selectedDay = String(document.getElementById('day-select')?.value || '').trim();
          if (selectedDay === day) {
            const idKey = String(action.docId || '');
            const nextItems = Array.isArray(currentDayItems) ? currentDayItems.slice() : [];
            const filtered = nextItems.filter((x) => {
              if (idKey && String(x?.id || '') === idKey) return false;
              const sid = `${x?.usuario}-${x?.cancion}-${x?.artista}-${x?.hora}`.replace(/[^a-zA-Z0-9-]/g, '');
              if (songId && sid === songId) return false;
              return true;
            });
            currentDayItems = applyOrder(filtered, currentManualOrder);
            window.__dayItems = currentDayItems;
            renderSolicitudes(currentDayItems);
          }
        }
      }

      function getLocalPlayedMap() {
        try {
          return JSON.parse(localStorage.getItem('playedSongs') || '{}');
        } catch (_) {
          return {};
        }
      }

      function setLocalPlayedMap(map) {
        try {
          localStorage.setItem('playedSongs', JSON.stringify(map || {}));
        } catch (_) { }
      }

      function getLocalSkippedMap() {
        try {
          return JSON.parse(localStorage.getItem('skippedSongs') || '{}');
        } catch (_) {
          return {};
        }
      }

      function setLocalSkippedMap(map) {
        try {
          localStorage.setItem('skippedSongs', JSON.stringify(map || {}));
        } catch (_) { }
      }

      async function cloudAddPlayed(day, songId, it, options) {
        if (!window.db || !firebase?.firestore?.FieldValue) return;
        const playedRef = window.db.collection('playedSongs').doc(day);
        const skipped = !!(options && options.skipped === true);
        const payload = {
          songs: firebase.firestore.FieldValue.arrayUnion(songId),
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (skipped) payload.skipped = firebase.firestore.FieldValue.arrayUnion(songId);
        await playedRef.set(payload, { merge: true });
        try {
          const uName = (it?.usuario || '').trim();
          if (!skipped) {
            if (uName) await updateUserPlayedCounter(uName, day, 1);
            await registerToggleEvent({
              action: 'mark',
              usuario: uName,
              cancion: it?.cancion,
              artista: it?.artista,
              day,
              hora: it?.hora,
              songId
            });
          }
        } catch (_) { }
      }

      async function cloudRemovePlayed(day, songId, it, options) {
        if (!window.db || !firebase?.firestore?.FieldValue) return;
        const playedRef = window.db.collection('playedSongs').doc(day);
        const skipped = !!(options && options.skipped === true);
        const payload = {
          songs: firebase.firestore.FieldValue.arrayRemove(songId),
          skipped: firebase.firestore.FieldValue.arrayRemove(songId),
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };
        await playedRef.set(payload, { merge: true });
        try {
          const uName = (it?.usuario || '').trim();
          if (!skipped) {
            if (uName) await updateUserPlayedCounter(uName, day, -1);
            await registerToggleEvent({
              action: 'unmark',
              usuario: uName,
              cancion: it?.cancion,
              artista: it?.artista,
              day,
              hora: it?.hora,
              songId
            });
          }
        } catch (_) { }
      }

      async function undoLastEditAction() {
        if (editUndoStack.length === 0) return;
        const action = editUndoStack.pop();
        editRedoStack.push(action);
        refreshEditActionsBar();
        if (action?.type === 'delete') {
          try { await applyRestoreAction(action, { updateUI: true }); } catch (err) { console.error('Error al deshacer:', err); }
          return;
        }
        if (action?.type === 'restore') {
          try { await applyDeleteAction(action, { updateUI: true }); } catch (err) { console.error('Error al deshacer:', err); }
          return;
        }
      }

      async function redoLastEditAction() {
        if (editRedoStack.length === 0) return;
        const action = editRedoStack.pop();
        editUndoStack.push(action);
        refreshEditActionsBar();
        if (action?.type === 'delete') {
          try { await applyDeleteAction(action, { updateUI: true }); } catch (err) { console.error('Error al rehacer:', err); }
          return;
        }
        if (action?.type === 'restore') {
          try { await applyRestoreAction(action, { updateUI: true }); } catch (err) { console.error('Error al rehacer:', err); }
          return;
        }
      }

      function renderDeletedList() {
        if (!deletedListEl || !deletedDaySelect) return;
        const day = String(deletedDaySelect.value || '').trim();
        const arr = day ? listDeletedForDay(day) : [];
        deletedListEl.innerHTML = '';

        if (!arr.length) {
          const empty = document.createElement('div');
          empty.className = 'deleted-row';
          empty.innerHTML = `<div class="meta"><div class="title">No hay canciones eliminadas</div><div class="sub">Cuando elimines canciones en modo edición, aparecerán aquí.</div></div><button type="button" class="restore-btn" disabled>Restaurar</button>`;
          deletedListEl.appendChild(empty);
          try { if (restoreAllDeletedBtn) restoreAllDeletedBtn.disabled = true; } catch (_) { }
          return;
        }

        try { if (restoreAllDeletedBtn) restoreAllDeletedBtn.disabled = false; } catch (_) { }

        arr.forEach((entry) => {
          const row = document.createElement('div');
          row.className = 'deleted-row';
          const meta = document.createElement('div');
          meta.className = 'meta';
          const title = document.createElement('div');
          title.className = 'title';
          title.textContent = formatDeletedRowTitle(entry);
          const sub = document.createElement('div');
          sub.className = 'sub';
          sub.textContent = formatDeletedRowSub(entry);
          const fine = document.createElement('div');
          fine.className = 'fine';
          fine.textContent = (entry?.docId ? `ID: ${entry.docId}` : (entry?.songId ? `SongID: ${entry.songId}` : ''));
          meta.appendChild(title);
          meta.appendChild(sub);
          meta.appendChild(fine);

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'restore-btn';
          btn.textContent = 'Restaurar';
          btn.disabled = deletedRestoreInFlight;
          btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (deletedRestoreInFlight) return;
            deletedRestoreInFlight = true;
            try {
              btn.disabled = true;
              const restoreAction = { ...entry, type: 'restore', day: day };
              await applyRestoreAction(restoreAction, { updateUI: true });
              try {
                editUndoStack.push({ ...restoreAction, type: 'restore' });
                editRedoStack = [];
                refreshEditActionsBar();
              } catch (_) { }
              renderDeletedList();
            } catch (err) {
              console.error('Error restaurando:', err);
              alert('No se pudo restaurar la canción. Revisa permisos o inténtalo de nuevo.');
            } finally {
              deletedRestoreInFlight = false;
              try { btn.disabled = false; } catch (_) { }
            }
          });

          row.appendChild(meta);
          row.appendChild(btn);
          deletedListEl.appendChild(row);
        });
      }

      openDeletedBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isEditModeActive()) return;
        openDeletedModal();
      });

      clearDeletedBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isEditModeActive()) return;
        const day = String(document.getElementById('day-select')?.value || '').trim();
        if (!day) return;
        if (!confirm('¿Vaciar la lista de eliminadas del día seleccionado?')) return;
        clearDeletedForDay(day);
        try { refreshDeletedCountBadge(); } catch (_) { }
        try { if (deletedDaySelect) deletedDaySelect.value = day; } catch (_) { }
        renderDeletedList();
      });

      deletedCloseBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeDeletedModal();
      });

      deletedCloseXBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeDeletedModal();
      });

      deletedModal?.addEventListener('click', (e) => {
        if (e.target === deletedModal) closeDeletedModal();
      });

      deletedDaySelect?.addEventListener('change', () => {
        renderDeletedList();
      });

      restoreAllDeletedBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!deletedDaySelect) return;
        const day = String(deletedDaySelect.value || '').trim();
        if (!day) return;
        const entries = listDeletedForDay(day);
        if (!entries.length) return;
        if (!confirm(`¿Restaurar ${entries.length} canciones eliminadas del día ${day}?`)) return;
        if (deletedRestoreInFlight) return;
        deletedRestoreInFlight = true;
        try {
          for (const entry of entries) {
            const restoreAction = { ...entry, type: 'restore', day: day };
            await applyRestoreAction(restoreAction, { updateUI: true });
            try {
              editUndoStack.push({ ...restoreAction, type: 'restore' });
            } catch (_) { }
          }
          editRedoStack = [];
          refreshEditActionsBar();
          renderDeletedList();
        } catch (err) {
          console.error('Error restaurando todo:', err);
          alert('No se pudieron restaurar todas las canciones. Revisa permisos e inténtalo de nuevo.');
        } finally {
          deletedRestoreInFlight = false;
        }
      });

      undoDeleteBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isEditModeActive()) return;
        undoLastEditAction();
      });
      redoDeleteBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isEditModeActive()) return;
        redoLastEditAction();
      });

      window.handleRewardIconClick = function (e) {
        e.preventDefault();
        e.stopPropagation();

        const isDjMode = localStorage.getItem('isAdminMode') === 'true';
        if (isDjMode) {
          const adminPanel = document.getElementById('admin-panel');
          if (adminPanel) {
            adminPanel.hidden = false;
            // Asegurarse de que el scroll suba al panel
            adminPanel.scrollIntoView({ behavior: 'smooth' });
          }

          // 1. Cambiar el selector principal a 'rewards'
          const adminNavSelect = document.getElementById('admin-nav-select');
          if (adminNavSelect) {
            adminNavSelect.value = 'rewards';
            // Disparar evento change manualmente para que se ejecute la lógica de cambio
            const event = new Event('change');
            adminNavSelect.dispatchEvent(event);
          }

          // 2. Fallback: Llamar directamente a showAdminSection si el evento no funcionó o no hay select
          if (typeof showAdminSection === 'function') {
            showAdminSection('rewards');
          }
        }
      };
      let renderTimeout = null;
      function renderSolicitudes(items) {
        window.__pendingItemsToRender = items;
        if (renderTimeout) clearTimeout(renderTimeout);
        renderTimeout = setTimeout(() => {
          const itemsToRender = window.__pendingItemsToRender || [];
          actualRenderSolicitudes(itemsToRender);
        }, 40);
      }

      function actualRenderSolicitudes(items) {
        if (!solicitudesList) {
          console.error('❌ solicitudesList no encontrado');
          return;
        }

        // FILTRO DE SEGURIDAD: Omitir canciones o usuarios inválidos/bots antes de renderizar
        const originalCount = items.length;
        items = items.filter(it => 
          !window.isInvalid(it.cancion) && 
          !window.isInvalid(it.artista) && 
          !window.isInvalid(it.usuario)
        );
        if (items.length !== originalCount) {
          console.log(`🛡️ Filtradas ${originalCount - items.length} entradas inválidas (bots/pruebas)`);
        }

        solicitudesList.innerHTML = '';
        if (!items.length) {
          emptyEl.hidden = false;
          return;
        }
        emptyEl.hidden = true;
        const isEditing = solicitudesList.classList.contains('editing');
        const mode = getSortMode();
        const useTandasBlocks = mode === 'tandas15' && !isEditing;
        let currentBlockKey = '';
        let currentBlockList = null;
        const slotMs = 15 * 60 * 1000;
        function pad2(n) { return String(n).padStart(2, '0'); }
        function getTandaKeyAndLabel(it) {
          // Si el item ya trae información de la tanda desde el sort, la usamos
          if (it._tandaSlot !== undefined && it._tandaStart) {
            const d = new Date(it._tandaStart);
            const startStr = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

            // El fin de la tanda es el expiry o el start + 15 min si no hubo expiry
            const endTime = it._tandaExpiry || (it._tandaStart + slotMs);
            const dEnd = new Date(endTime);
            const endStr = `${pad2(dEnd.getHours())}:${pad2(dEnd.getMinutes())}`;

            return { key: String(it._tandaSlot), label: `${startStr}–${endStr}` };
          }

          const t = getItemTimeMs(it);
          if (Number.isFinite(t) && t > 0) {
            const d = new Date(t);
            const m = d.getMinutes();
            const startMin = Math.floor(m / 15) * 15;
            const start = new Date(d);
            start.setMinutes(startMin, 0, 0);
            const end = new Date(start.getTime() + slotMs);
            const key = String(start.getTime());
            const label = `${pad2(start.getHours())}:${pad2(start.getMinutes())}–${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
            return { key, label };
          }
          const hora = String(it?.hora || '').trim();
          if (hora && hora.includes(':')) {
            const parts = hora.split(':');
            const hh = Number(parts[0]);
            const mm = Number(parts[1]);
            const startMin = Math.floor((Number.isFinite(mm) ? mm : 0) / 15) * 15;
            const endMinAbs = startMin + 15;
            const endH = (Number.isFinite(hh) ? hh : 0) + Math.floor(endMinAbs / 60);
            const endM = endMinAbs % 60;
            const key = `h${hh}-m${startMin}`;
            const label = `${pad2(hh)}:${pad2(startMin)}–${pad2(endH % 24)}:${pad2(endM)}`;
            return { key, label };
          }
          return { key: 'unknown', label: 'Sin hora' };
        }
        function ensureTandaBlock(it) {
          if (!useTandasBlocks) return;
          const info = getTandaKeyAndLabel(it);
          if (info.key === currentBlockKey && currentBlockList) return;
          currentBlockKey = info.key;
          const blockLi = document.createElement('li');
          blockLi.className = 'tandas-block';
          const inner = document.createElement('div');
          inner.className = 'tandas-block-inner';
          const header = document.createElement('div');
          header.className = 'tandas-block-header';
          header.innerHTML = `<span>Tanda ${info.label}</span><span class="tandas-block-chip">15 min</span>`;
          const ul = document.createElement('ul');
          ul.className = 'tandas-block-list';
          inner.appendChild(header);
          inner.appendChild(ul);
          blockLi.appendChild(inner);
          solicitudesList.appendChild(blockLi);
          currentBlockList = ul;
        }

        items.forEach((it, index) => {
          const unameLc = String(it.usuario || '').trim().toLowerCase();
          const displayUser = String(it.displayName || it.usuario || '').trim();
          const isSuperfan = typeof window.hasMembership === 'function' ? window.hasMembership(window.superfanSet, unameLc) : (window.superfanSet && window.superfanSet.has(unameLc));
          const isVip = typeof window.hasMembership === 'function' ? window.hasMembership(vipSet, unameLc) : vipSet.has(unameLc);
          const isZ0Vip = typeof window.hasMembership === 'function' ? window.hasMembership(z0VipSet, unameLc) : z0VipSet.has(unameLc);
          const isDonador = typeof window.hasMembership === 'function' ? window.hasMembership(donadorSet, unameLc) : donadorSet.has(unameLc);
          const isZ0Platino = typeof window.hasMembership === 'function' ? window.hasMembership(window.z0PlatinumSet, unameLc) : (window.z0PlatinumSet && window.z0PlatinumSet.has(unameLc));
          const isZ0Fan = typeof window.hasMembership === 'function' ? window.hasMembership(window.z0FanSet, unameLc) : (window.z0FanSet && window.z0FanSet.has(unameLc));
          const hasPendingReward = typeof window.hasMembership === 'function' ? window.hasMembership(window.pendingRewardUsers, unameLc) : (window.pendingRewardUsers && window.pendingRewardUsers.has(unameLc));
          const li = document.createElement('li');

          // Crear ID único para la canción con hora resuelta, para coincidir con queue/Cider
          const resolvedHora = String(
            it.hora ||
            (typeof toHour === 'function' ? toHour(it.ts || it.timestamp || it.time) : '') ||
            ''
          ).trim();
          const songId = it.id || `${it.usuario}-${it.cancion}-${it.artista}-${resolvedHora}`.replace(/[^a-zA-Z0-9-]/g, '');
          li.dataset.songId = songId;
          li.dataset.username = (it.usuario || '').trim().toLowerCase();
          li.dataset.day = String(it.day || (it.fecha || '').split('T')[0] || '').trim();
          if (it.id) li.dataset.docId = it.id;
          li.dataset.isTest = isTestRequestForStats(it) ? '1' : '0';
          li.dataset.cancion = String(it.cancion || '').trim();
          li.dataset.artista = String(it.artista || '').trim();
          li.dataset.genre = String(it.genre || it.genero || '').trim();
          li.dataset.hora = resolvedHora;

          // Verificar insignias especiales de donador (si vienen en el objeto 'it' desde backend)
          const badgeType = it.badge || '';

          if (badgeType === 'superfan' || isSuperfan) {
            li.className = 'item superfan';
          } else if (badgeType === 'donador-oro') {
            li.className = 'item donador-oro';
          } else if (badgeType === 'donador-plata') {
            li.className = 'item donador-plata';
          } else if (badgeType === 'donador-bronce') {
            li.className = 'item donador-bronce';
          } else if (isZ0Platino) {
            li.className = 'item z0-platino';
          } else if (isZ0Vip) {
            li.className = 'item z0-vip';
          } else if (isVip) {
            li.className = 'item vip';
          } else if (isDonador) {
            li.className = 'item donador';
          } else if (isZ0Fan) {
            li.className = 'item z0-fan';
          } else {
            li.className = 'item';
          }

          if (hasPendingReward) {
            li.classList.add('has-pending-reward');
          }

          const isDjMode = localStorage.getItem('isAdminMode') === 'true';
          const rewardIconHtml = hasPendingReward
            ? `<span class="reward-pending-icon" title="Solicitud de recompensa pendiente" ${isDjMode ? 'onclick="handleRewardIconClick(event)" style="cursor:pointer"' : ''}>🎁</span>`
            : '';

          const selectedBadge = typeof window.getSelectedBadgeFor === 'function' ? window.getSelectedBadgeFor(it.usuario) : '';
          if (selectedBadge) {
            li.classList.remove('superfan', 'vip', 'z0-vip', 'donador', 'z0-fan', 'z0-platino', 'donador-oro', 'donador-plata', 'donador-bronce');
            li.classList.add(selectedBadge);
          }

          // Verificar si la canción está marcada como reproducida
          const currentDay = document.getElementById('day-select')?.value || '';
          const localPlayedMap = getLocalPlayedMap();
          const localSkippedMap = getLocalSkippedMap();
          const dayPlayedSongs = window.playedSongsCache[currentDay] || localPlayedMap[currentDay] || [];
          const daySkippedSongs = localSkippedMap[currentDay] || [];
          const skippedSet = new Set((Array.isArray(daySkippedSongs) ? daySkippedSongs : []).map(x => String(x || '')));

          const isSongPlayed = dayPlayedSongs.includes(songId) || (it.id && dayPlayedSongs.includes(it.id));
          if (isSongPlayed) {
            li.classList.add('played');
            if (skippedSet.has(String(songId || ''))) li.classList.add('skipped');
          }

          // Modo edición: draggable
          li.draggable = !!isEditing;

          const cleanCancion = escapeHTML(it.cancion);
          const cleanArtista = escapeHTML(it.artista);
          const cleanUser = escapeHTML(displayUser);
          const cleanLink = safeUrl(it.link);

          const linkHtml = cleanLink ? `<a href="${cleanLink}" target="_blank" class="song-link-icon" title="Ver enlace" style="text-decoration:none; margin-left:5px; font-size:0.8em; vertical-align:middle;">🔗</a>` : '';
          const wrapLink = (text, url) => url ? `<a href="${url}" target="_blank" style="color:inherit; text-decoration:underline; text-decoration-style:dotted;">${text}</a>` : text;

          li.innerHTML = `
            <span class="col col-time">${it.hora || ''}</span>
            <span class="col col-usuario usuario">
               <span class="uname-text">${cleanUser}</span>
               ${rewardIconHtml}
            </span>
            <span class="col col-cancion">
              <span class="text">${wrapLink(cleanCancion, cleanLink)}</span>
              <button class="copy-chip copy-chip-inline" type="button" title="Copiar canción" data-copy="${cleanCancion}">⧉</button>
              ${cleanLink ? linkHtml : ''}
            </span>
            <span class="col col-artista">
              <span class="text">${wrapLink(cleanArtista, cleanLink)}</span>
              <button class="copy-chip copy-chip-inline" type="button" title="Copiar artista" data-copy="${cleanArtista}">⧉</button>
            </span>
            <span class="col col-cancion-artista">
              <div class="line-with-copy mobile-user-row">
                 <div class="usuario-line usuario">
                   ${cleanUser}
                   ${rewardIconHtml}
                 </div>
              </div>
              <div class="line-with-copy">
                <div class="cancion-line">${wrapLink(cleanCancion, cleanLink)}</div>
                <button class="copy-chip" type="button" title="Copiar canción" data-copy="${cleanCancion}">⧉</button>
                ${cleanLink ? linkHtml : ''}
              </div>
              <div class="line-with-copy">
                <div class="artista-line">${wrapLink(cleanArtista, cleanLink)}</div>
                <button class="copy-chip" type="button" title="Copiar artista" data-copy="${cleanArtista}">⧉</button>
              </div>
            </span>
            <button class="skip-btn" title="Saltar canción (sin puntos)">
              <span class="skip-icon">⏭️</span>
            </button>
            <button class="play-toggle-btn" title="Marcar como reproducida">
              <span class="play-icon">▶️</span>
            </button>
            <button class="delete-btn" title="Eliminar canción" aria-label="Eliminar">🗑️</button>
          `;

          const copyButtons = li.querySelectorAll('.copy-chip');
          if (copyButtons && copyButtons.length) {
            copyButtons.forEach(function (btn) {
              btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                const textToCopy = btn.getAttribute('data-copy') || '';
                if (textToCopy) {
                  copyTextToClipboard(textToCopy, e.currentTarget || btn);
                }
              });
            });
          }

          // Texto seleccionable / cursor según modo
          li.style.userSelect = 'text';
          li.style.cursor = isEditing ? 'grab' : 'text';

          // Toggle reproducida
          const toggleBtn = li.querySelector('.play-toggle-btn');
          if (toggleBtn) {
            // SIEMPRE habilitar el botón visualmente y agregar el listener.
            toggleBtn.disabled = false;
            toggleBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleSongPlayed(li, songId, currentDay, { skip: false }); // Play normal (sin skip)
            });
          }

          // Botón SKIP explícito
          const skipBtn = li.querySelector('.skip-btn');
          if (skipBtn) {
            skipBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleSongPlayed(li, songId, currentDay, { skip: true }); // Forzar skip
            });
          }

          try {
            const iconEl = li.querySelector('.play-icon');
            if (iconEl) iconEl.textContent = li.classList.contains('played') ? (li.classList.contains('skipped') ? '⏭️' : '▶️') : '▶️';
          } catch (_) { }

          // Eliminar canción (solo en modo edición)
          const deleteBtn = li.querySelector('.delete-btn');
          deleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!solicitudesList.classList.contains('editing')) return;

            const docId = li.dataset.docId;
            const day = currentDay;
            const localPlayedMapBefore = getLocalPlayedMap();
            const localSkippedMapBefore = getLocalSkippedMap();
            const dayPlayedBefore = window.playedSongsCache[day] || localPlayedMapBefore[day] || [];
            const daySkippedBefore = localSkippedMapBefore[day] || [];
            const wasPlayed = Array.isArray(dayPlayedBefore) && dayPlayedBefore.includes(songId);
            const wasSkipped = Array.isArray(daySkippedBefore) && daySkippedBefore.includes(songId);
            const orderIndex = (docId && Array.isArray(currentManualOrder)) ? currentManualOrder.indexOf(docId) : -1;
            const requestData = {
              id: it.requestId || songId,
              usuario: it.usuario,
              displayName: it.displayName,
              cancion: it.cancion,
              artista: it.artista,
              genero: it.genero,
              cover: it.cover,
              ts: it.ts || new Date(),
              hora: it.hora,
              status: it.status || 'pending',
              day
            };
            let localEntry = null;
            let localIndex = null;
            try {
              if (!(docId && window.db)) {
                try {
                  const byDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');
                  const arr = Array.isArray(byDay[day]) ? byDay[day] : [];
                  const idx = arr.findIndex(x =>
                    x.usuario === it.usuario &&
                    x.cancion === it.cancion &&
                    x.artista === it.artista &&
                    toHour(x.time) === it.hora
                  );
                  if (idx >= 0) {
                    localEntry = arr[idx];
                    localIndex = idx;
                  }
                } catch (_) { }
              }

              const action = {
                type: 'delete',
                day,
                docId: docId || null,
                songId,
                requestData,
                localEntry,
                localIndex,
                wasPlayed,
                wasSkipped,
                orderIndex: orderIndex >= 0 ? orderIndex : null,
                itemForLog: { usuario: it.usuario, cancion: it.cancion, artista: it.artista, hora: it.hora }
              };

              await applyDeleteAction(action, { updateUI: true });
              editUndoStack.push(action);
              editRedoStack = [];
              refreshEditActionsBar();
            } catch (err) {
              console.error('Error eliminando canción:', err);
              alert('No se pudo eliminar la canción. Revisa permisos o inténtalo de nuevo.');
            }
          });

          // Drag & drop para reordenar (solo en modo edición)
          li.addEventListener('dragstart', (e) => {
            if (!solicitudesList.classList.contains('editing')) return;
            li.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            // Usar el mismo ID que usa idOf para consistencia
            e.dataTransfer.setData('text/plain', it.id || it.docId || songId);
          });
          li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
          });
          li.addEventListener('dragover', (e) => {
            if (!solicitudesList.classList.contains('editing')) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          });
          li.addEventListener('drop', (e) => {
            if (!solicitudesList.classList.contains('editing')) return;
            e.preventDefault();
            const fromId = e.dataTransfer.getData('text/plain');
            const toId = it.id || it.docId || songId;
            if (!fromId || !toId || fromId === toId) return;

            const resolvedHora = (item) => String(
              item.hora ||
              (typeof toHour === 'function' ? toHour(item.ts || item.timestamp || item.time) : '') ||
              ''
            ).trim();
            const idOf = (item) => item.id || item.docId || `${item.usuario}-${item.cancion}-${item.artista}-${resolvedHora(item)}`.replace(/[^a-zA-Z0-9-]/g, '');
            const fromIdx = currentDayItems.findIndex(item => idOf(item) === fromId);
            const toIdx = currentDayItems.findIndex(item => idOf(item) === toId);

            if (fromIdx < 0 || toIdx < 0) {
              console.warn('Drag&Drop mismatch:', { fromId, toId, fromIdx, toIdx });
              return;
            }

            const [moved] = currentDayItems.splice(fromIdx, 1);
            currentDayItems.splice(toIdx, 0, moved);

            // Actualizar currentManualOrder localmente para reflejar el cambio inmediato
            currentManualOrder = currentDayItems.map(item => idOf(item));
            window.__dayItems = currentDayItems;

            // Persistir orden manual por día (Firestore + localStorage)
            const selectedDay =
              (document.getElementById('day-select')?.value || '').trim() ||
              String(it.day || '').trim() ||
              String((currentDayItems && currentDayItems[0] && currentDayItems[0].day) || '').trim() ||
              new Date().toISOString().split('T')[0];
            persistManualOrder(currentDayItems, selectedDay);

            // Render con orden actualizado
            renderSolicitudes(currentDayItems);
          });

          if (useTandasBlocks) {
            ensureTandaBlock(it);
            (currentBlockList || solicitudesList).appendChild(li);
          } else {
            solicitudesList.appendChild(li);
          }
        });

        // Verificar que los eventos de clic se hayan agregado correctamente
        const clickableItems = solicitudesList.querySelectorAll('.item');
        console.log(`✅ Renderizadas ${clickableItems.length} canciones clickeables`);

        try { applySelectedBadgeToAll(); } catch (_) { }

        // Forzar estilos en canciones reproducidas después del renderizado
        setTimeout(() => {
          forcePlayedSongStyles();
        }, 100);

        // Actualizar selector de usuarios cuando hay nuevos datos
        setTimeout(() => {
          if (typeof populateUserSelector === 'function') {
            populateUserSelector().catch(error => {
              console.error('Error en populateUserSelector, usando fallback:', error);
              if (typeof window.populateUserSelectorFromLocalStorage === 'function') {
                window.populateUserSelectorFromLocalStorage();
              }
            });
          } else {
            if (typeof window.populateUserSelectorFromLocalStorage === 'function') {
              window.populateUserSelectorFromLocalStorage();
            }
          }
        }, 100);

        // Analizar automáticamente nuevos usuarios
        if (typeof window.analyzeNewUsersAutomatically === 'function') {
          window.analyzeNewUsersAutomatically().catch(console.error);
        }
      }

      // Orden manual: aplicar y persistir
      function applyOrder(items, order) {
        try {
          if (!Array.isArray(order) || !order.length) return items;

          const idOf = (item) => item.id || item.docId || `${item.usuario}-${item.cancion}-${item.artista}-${item.hora}`.replace(/[^a-zA-Z0-9-]/g, '');

          const inOrderSet = new Set(order);

          // Elementos presentes en 'order' respetando ese orden
          const ordered = [];
          order.forEach((sid) => {
            const found = items.find((it) => idOf(it) === sid);
            if (found) ordered.push(found);
          });

          // Nuevos (no presentes en 'order') abajo (para mantener FIFO)
          const notInOrder = items.filter((it) => !inOrderSet.has(idOf(it)));

          return [...ordered, ...notInOrder];
        } catch {
          return items;
        }
      }

      function persistManualOrder(items, day) {
        const key = `manualOrder:${day}`;
        const order = items.map(item => item.id || item.docId || `${item.usuario}-${item.cancion}-${item.artista}-${item.hora}`.replace(/[^a-zA-Z0-9-]/g, ''));
        // Guardar inmediatamente en localStorage para disponibilidad local
        localStorage.setItem(key, JSON.stringify(order));
        // Persistir también en Firestore para sincronizar entre dispositivos
        try {
          if (window.db) {
            window.db.collection('manualOrders').doc(day).set({
              order,
              day,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          }
        } catch (err) {
          console.warn('No se pudo persistir orden manual en Firestore, usando solo localStorage:', err);
        }
      }

      // Control del lápiz y modo edición
      (function () {
        const editToggleBtn = document.getElementById('edit-toggle-btn');
        const adminPanelEl = document.getElementById('admin-panel');
        const adminModalEl = document.getElementById('admin-modal');
        const adminPassInputEl = document.getElementById('admin-pass-input');
        const adminPassErrorEl = document.getElementById('admin-auth-error');
        const adminExitBtnEl = document.getElementById('admin-exit');

        function updateEditToggleVisibility() {
          if (!editToggleBtn) return;
          const isAdminOpen = !!adminPanelEl && !adminPanelEl.hidden;
          const djMode = (typeof isDJDevice === 'function') ? isDJDevice() : false;
          editToggleBtn.hidden = !djMode;
          editToggleBtn.style.opacity = '1';
          editToggleBtn.title = 'Editar lista (eliminar / mover)';

          try {
            const tools = document.querySelector('.title-tools');
            const searchBox = tools?.querySelector('.search-box');
            const themeBtn = document.getElementById('theme-btn');
            const menuBtn = document.getElementById('menu-btn');
            if (tools && editToggleBtn) {
              if (djMode && searchBox && themeBtn) {
                if (editToggleBtn.parentNode !== tools) tools.appendChild(editToggleBtn);
                if (editToggleBtn.previousElementSibling !== searchBox) tools.insertBefore(editToggleBtn, themeBtn);
              } else if (!djMode && themeBtn && menuBtn) {
                if (editToggleBtn.parentNode !== tools) tools.appendChild(editToggleBtn);
                if (editToggleBtn.nextElementSibling !== menuBtn) tools.insertBefore(editToggleBtn, menuBtn);
              }
            }
          } catch (_) { }

          if (!djMode && !isAdminOpen) {
            editToggleBtn.setAttribute('aria-pressed', 'false');
            solicitudesList?.classList.remove('editing');
            editUndoStack = [];
            editRedoStack = [];
            refreshEditActionsBar();
            if (currentDayItems?.length) renderSolicitudes(applyOrder(currentDayItems, currentManualOrder));
          }
        }

        function toggleEditMode() {
          if (!editToggleBtn) return;
          const isAdminOpen = !!adminPanelEl && !adminPanelEl.hidden;
          const djMode = (typeof isDJDevice === 'function') ? isDJDevice() : false;
          if (!isAdminOpen && !djMode) {
            if (adminModalEl) {
              adminModalEl.hidden = false;
              if (adminPassInputEl) adminPassInputEl.value = '';
              if (adminPassErrorEl) adminPassErrorEl.hidden = true;
              adminPassInputEl?.focus();
            }
            return;
          }
          const isEditing = editToggleBtn.getAttribute('aria-pressed') === 'true';
          const next = !isEditing;
          editToggleBtn.setAttribute('aria-pressed', String(next));
          solicitudesList?.classList.toggle('editing', next);
          if (currentDayItems?.length) renderSolicitudes(applyOrder(currentDayItems, currentManualOrder));
          refreshEditActionsBar();
        }

        editToggleBtn?.addEventListener('click', (e) => {
          e.preventDefault();
          toggleEditMode();
        });

        // Observar cambios en el panel admin para actualizar visibilidad del lápiz
        if (adminPanelEl) {
          const mo = new MutationObserver(() => updateEditToggleVisibility());
          mo.observe(adminPanelEl, { attributes: true, attributeFilter: ['hidden'] });
        }

        // Integración opcional con tryOpenAdmin si está expuesto
        const originalTryOpenAdmin = typeof window.tryOpenAdmin === 'function' ? window.tryOpenAdmin : null;
        if (originalTryOpenAdmin) {
          window.tryOpenAdmin = function () {
            originalTryOpenAdmin();
            updateEditToggleVisibility();
          };
        }

        adminExitBtnEl?.addEventListener('click', () => {
          updateEditToggleVisibility();
        });

        // Inicial
        updateEditToggleVisibility();
      })();

      // Función para alternar el estado de canción reproducida (con sincronización Firebase)
      // Función para sincronizar configuración con Firebase (SOLO LECTURA / VALIDACIÓN)
      async function syncDJStatus() {
        try {
          // Generar fingerprint actual
          const currentFingerprint = generateDeviceFingerprint();

          // 1. Validar contra localStorage primero (rápido)
          const storedMaster = localStorage.getItem('masterDJFingerprint');
          const isStoredAsMaster = localStorage.getItem('isMasterDJDevice') === 'true';

          // Si dice ser master, validamos que tenga el fingerprint correcto
          if (isStoredAsMaster && storedMaster !== currentFingerprint) {
            console.warn('Detectado cambio de fingerprint en dispositivo DJ. Revocando permisos.');
            localStorage.setItem('isMasterDJDevice', 'false');
          }

          if (!window.db) return;

          const djConfigRef = window.db.collection('systemConfig').doc('djConfig');
          const djConfigDoc = await djConfigRef.get();

          if (djConfigDoc.exists) {
            // Si existe config en la nube, la verdad absoluta está ahí
            const remoteMasterFingerprint = djConfigDoc.data().masterFingerprint;

            // Si el fingerprint remoto coincide con el nuestro, somos el DJ
            const isMaster = remoteMasterFingerprint === currentFingerprint;

            // Actualizar estado local
            localStorage.setItem('masterDJFingerprint', remoteMasterFingerprint);
            localStorage.setItem('isMasterDJDevice', isMaster ? 'true' : 'false');

            // Actualizar UI
            updateDJControls();
            try { updateEditToggleVisibility(); } catch (_) { }
          } else {
            // Si no existe config en la nube, NADIE es DJ automáticamente.
            // Se requiere acción manual en el botón "Establecer como DJ".
            // Por seguridad, si creíamos ser DJ pero no hay config, dejamos de serlo 
            // (o podríamos mantenerlo si asumimos modo offline, pero mejor ser seguros)
            // Para modo offline, confiamos en localStorage si ya estaba seteado.
          }

        } catch (error) {
          console.warn('Error sincronizando estado DJ (modo offline o error de red):', error);
          // En error, NO otorgamos permisos nuevos. 
          // Mantenemos el estado actual de localStorage (asumiendo que fue validado antes).
        }
      }

      // Ejecutar validación al inicio
      document.addEventListener('DOMContentLoaded', () => {
        syncDJStatus();
      });

      // Función para verificar si este dispositivo puede modificar canciones
      // Determinación estricta de dispositivo maestro (DJ)
      function isDJDevice() {
        try {
          // 1. Si está logueado como Admin, es dispositivo DJ
          const isAdmin = localStorage.getItem('isAdminMode') === 'true' || 
                          localStorage.getItem('isAdminAuthenticated') === 'true' ||
                          sessionStorage.getItem('isAdminMode') === 'true' ||
                          sessionStorage.getItem('isAdminAuthenticated') === 'true';
          if (isAdmin) return true;

          // 2. Si se estableció manualmente, respetar
          if (localStorage.getItem('isMasterDJDevice') === 'true') return true;
          if (localStorage.getItem('isMasterDJDevice') === 'false') return false;

          // 3. Por defecto false si no hay configuración explícita
          return false;
        } catch (e) {
          return false;
        }
      }

      // Inicializar estado de controles
      function updateDJControls() {
        const isMaster = isDJDevice();

        // Agregar/Quitar clase al body para control global de CSS
        if (isMaster) {
          document.body.classList.add('dj-mode');
        } else {
          document.body.classList.remove('dj-mode');
        }

        document.querySelectorAll('.play-toggle-btn').forEach(btn => {
          // Mostrar el botón activo VISUALMENTE para todos (petición de usuario),
          // pero funcionalmente restringido por toggleSongPlayed (si no es Master no hace nada al click)
          btn.removeAttribute('disabled');
          btn.title = isMaster ? "Marcar como sonada/pendiente" : "Solo el DJ puede controlar esto";
          btn.style.opacity = "1";
          btn.style.pointerEvents = "auto";
          btn.style.filter = "none";
        });
      }

      document.addEventListener('DOMContentLoaded', () => {
        // Ejecutar validación inicial
        updateDJControls();

        // Resize inicial
        try {
          if (typeof resize === 'function') resize();
          else if (typeof window.updateParticleSystem === 'function') window.updateParticleSystem();
        } catch (_) { }
      });

      // Función para generar fingerprint del dispositivo
      function generateDeviceFingerprint() {
        // Intentar recuperar fingerprint cacheado para estabilidad (especialmente al redimensionar o usar devtools)
        const cached = localStorage.getItem('device_fingerprint_cached');
        if (cached) return cached;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Device fingerprint', 2, 2);

        const fingerprint = [
          navigator.userAgent,
          navigator.language,
          screen.width + 'x' + screen.height,
          new Date().getTimezoneOffset(),
          canvas.toDataURL()
        ].join('|');

        // Crear hash simple del fingerprint
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
          const char = fingerprint.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32bit integer
        }

        const deviceId = 'device_' + Math.abs(hash).toString(36);
        localStorage.setItem('device_fingerprint_cached', deviceId);
        return deviceId;
      }
      window.generateDeviceFingerprint = generateDeviceFingerprint;

      async function toggleSongPlayed(element, songId, passedDay, options) {
        // Validación inicial rápida: solo DJ puede actuar
        // FIX: Permitir actuar si es DJ O si es el dispositivo Maestro (isMasterDJDevice)
        // El check isDJDevice() ya verifica localStorage.getItem('isMasterDJDevice') === 'true'
        // Pero agregamos un log para debug si falla
        if (!isDJDevice()) {
          console.warn('⚠️ Intento de toggleSongPlayed bloqueado: No es dispositivo DJ Maestro');
          const btn = element.querySelector('.play-toggle-btn');
          if (btn) {
            btn.classList.add('clicked-anim');
            setTimeout(() => btn.classList.remove('clicked-anim'), 200);
          }
          return;
        }

        const currentDay = passedDay || document.getElementById('day-select')?.value || element?.dataset?.day || '';
        if (!currentDay) {
          console.error('❌ Error toggleSongPlayed: No hay día seleccionado');
          return;
        }

        // Estado actual visual
        const wasPlayed = element.classList.contains('played');
        const wasSkipped = element.classList.contains('skipped');
        const wantsSkip = !!(options && options.skip === true);

        let nextPlayed = wasPlayed;
        let nextSkipped = wasSkipped;

        // Lógica simplificada de estado
        if (!wasPlayed) {
          // Caso 1: No estaba reproducida -> Se marca como reproducida (y saltada si se pide)
          nextPlayed = true;
          nextSkipped = wantsSkip;
        } else {
          // Caso 2: Ya estaba reproducida
          if (wantsSkip) {
            // Si se pide skip y ya estaba reproducida, alternamos solo el estado skip
            // (Mantenemos played = true)
            // Si ya estaba skippeada, la des-skippeamos (vuelve a ser válida)
            nextSkipped = !wasSkipped;
          } else {
            // Si no se pide skip explícito (click normal), alternamos el estado played
            // Si estaba played -> unplayed (desmarcar todo)
            nextPlayed = false;
            nextSkipped = false;
          }
        }

        // --- ACTUALIZACIÓN VISUAL INMEDIATA (Optimistic UI) ---
        // Forzar reflow para asegurar que la clase se aplique visualmente
        if (nextPlayed) element.classList.add('played'); else element.classList.remove('played');
        if (nextSkipped) element.classList.add('skipped'); else element.classList.remove('skipped');

        const iconEl = element.querySelector('.play-icon');
        if (iconEl) iconEl.textContent = nextPlayed ? (nextSkipped ? '⏭️' : '▶️') : '▶️'; // Icono estático, CSS maneja el color

        // --- PERSISTENCIA LOCAL ---
        try {
          // Obtener mapas actuales
          let localPlayedMap = getLocalPlayedMap() || {};
          let localSkippedMap = getLocalSkippedMap() || {};

          // Asegurar arrays para el día
          if (!Array.isArray(localPlayedMap[currentDay])) localPlayedMap[currentDay] = [];
          if (!Array.isArray(localSkippedMap[currentDay])) localSkippedMap[currentDay] = [];

          // Actualizar arrays locales
          if (nextPlayed) {
            if (!localPlayedMap[currentDay].includes(songId)) localPlayedMap[currentDay].push(songId);
          } else {
            localPlayedMap[currentDay] = localPlayedMap[currentDay].filter(id => id !== songId);
          }

          if (nextSkipped) {
            if (!localSkippedMap[currentDay].includes(songId)) localSkippedMap[currentDay].push(songId);
          } else {
            localSkippedMap[currentDay] = localSkippedMap[currentDay].filter(id => id !== songId);
          }

          // Guardar en localStorage
          setLocalPlayedMap(localPlayedMap);
          setLocalSkippedMap(localSkippedMap);

          // Actualizar caché global si existe
          if (window.playedSongsCache) window.playedSongsCache[currentDay] = localPlayedMap[currentDay];

          console.log(`💾 LocalStorage actualizado para ${songId}: played=${nextPlayed}, skipped=${nextSkipped}`);
        } catch (e) { console.error('Error guardando local:', e); }

        // --- SINCRONIZACIÓN FIRESTORE ---
        if (window.db) {
          try {
            const docRef = window.db.collection('playedSongs').doc(currentDay);
            const batch = window.db.batch();

            // Asegurar documento base
            batch.set(docRef, {
              day: currentDay,
              lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Actualizar arrays en Firestore
            if (nextPlayed) {
              batch.update(docRef, { songs: firebase.firestore.FieldValue.arrayUnion(songId) });
            } else {
              batch.update(docRef, { songs: firebase.firestore.FieldValue.arrayRemove(songId) });
            }

            if (nextSkipped) {
              batch.update(docRef, { skipped: firebase.firestore.FieldValue.arrayUnion(songId) });
            } else {
              batch.update(docRef, { skipped: firebase.firestore.FieldValue.arrayRemove(songId) });
            }

            await batch.commit();
            console.log(`🔥 Firestore actualizado para ${songId}`);

            // NUEVO: Registrar evento de toggle para estadísticas en tiempo real
            try {
              await registerToggleEvent({
                action: nextPlayed ? 'mark' : 'unmark',
                usuario: element.dataset.username || '',
                cancion: element.dataset.cancion || '',
                artista: element.dataset.artista || '',
                genre: element.dataset.genre || '',
                day: currentDay,
                hora: element.dataset.hora || '',
                songId: songId
              });
            } catch (e) { console.warn('Error registrando evento de toggle:', e); }

            // Actualizar contadores de usuario si cambió el estado de "reproducida válida"
            // (played=true, skipped=false) es el único estado que suma puntos
            // (played=true, skipped=true) no suma puntos
            // (played=false) no suma puntos

            const uname = element.dataset.username;
            if (uname) {
              const wasValid = wasPlayed && !wasSkipped;
              const isValid = nextPlayed && !nextSkipped;

              if (isValid && !wasValid) {
                // Ganó punto (pasó de no-played o skipped a played-valid)
                updateUserPlayedCounter(uname, currentDay, 1);
              } else if (!isValid && wasValid) {
                // Perdió punto (pasó de played-valid a no-played o skipped)
                updateUserPlayedCounter(uname, currentDay, -1);
              }
            }

          } catch (err) {
            console.error('Error sincronizando con Firestore:', err);
          }
        }

        // Recalcular estadísticas del usuario en tiempo real
        if (element.dataset.isTest !== '1') {
          const userForCounter = (element.dataset.username || '').trim();
          if (userForCounter) {
            try {
              setTimeout(async () => {
                // Forzar recálculo de puntos
                await analyzeAndGrantPointsForUser(userForCounter);
                await updateUserHeaderUI(userForCounter);

                // Refrescar desglose si está abierto
                const panel = document.getElementById('gamification-breakdown');
                const curProfile = typeof getCurrentProfileUser === 'function' ? getCurrentProfileUser() : null;
                if (panel && panel.classList.contains('active') && curProfile && String(curProfile).toLowerCase() === String(userForCounter).toLowerCase()) {
                  await renderPointsBreakdownForUser(userForCounter, true);
                }

                if (typeof calculateAndSaveGlobalStats === 'function') {
                  calculateAndSaveGlobalStats().catch(console.error);
                }
              }, 500);
            } catch (e) { console.warn('Error recalculando puntos:', e); }
          }
        }
      }

      async function registerToggleEvent(payload) {
        try {
          const base = typeof generateDeviceFingerprint === 'function' ? generateDeviceFingerprint() : '';
          const norm = String((payload.usuario || '').trim().replace(/^@/, '')).toLowerCase();
          const idNorm = String((payload.songId || '')).toLowerCase().replace(/[^a-z0-9-]/g, '');
          const data = {
            type: 'togglePlayed',
            action: String(payload.action || '').toLowerCase(),
            usuario: norm,
            usuarioRaw: String(payload.usuario || ''),
            cancion: String(payload.cancion || ''),
            artista: String(payload.artista || ''),
            genre: String(payload.genre || '').trim(),
            day: String(payload.day || ''),
            hora: String(payload.hora || ''),
            songId: idNorm,
            deviceId: base,
            ts: firebase.firestore.FieldValue.serverTimestamp()
          };
          const docId = `toggle-${norm}-${idNorm}-${String(payload.day || '')}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
          await db.collection('systemEvents').doc(docId).set(data, { merge: true });
        } catch (_) { }
      }



      async function backfillToggleEventsForUser(usuario) {
        try {
          const key = String(usuario || '').trim().replace(/^@/, '').toLowerCase();
          const flag = `backfill_toggle_${key}`;
          if (localStorage.getItem(flag) === 'done') return;
          const snap = await db.collection('playedSongs').get();
          snap.forEach(async (doc) => {
            const dayId = String(doc.id || '');
            const d = doc.data() || {};
            const arr = Array.isArray(d.songs) ? d.songs : (Array.isArray(d.list) ? d.list : (Array.isArray(d.songIds) ? d.songIds : []));
            const skippedArr = Array.isArray(d.skipped) ? d.skipped : [];
            const skippedSet = new Set((skippedArr || []).map(x => String(x || '').toLowerCase().replace(/[^a-z0-9-]/g, '')));
            for (let i = 0; i < arr.length; i++) {
              const id = String(arr[i] || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
              if (skippedSet.has(id)) continue;
              if (id.startsWith(`${key}-`)) {
                await registerToggleEvent({
                  action: 'mark',
                  usuario: key,
                  cancion: '',
                  artista: '',
                  day: dayId,
                  hora: '',
                  songId: id
                });
                try {
                  window.__userToggleSet = window.__userToggleSet || {};
                  const set = window.__userToggleSet[key] || (window.__userToggleSet[key] = new Set());
                  set.add(id);
                } catch (_) { }
              }
            }
          });
          // Segunda pasada: backfill desde localStorage (solo por usuario)
          try {
            const localMap = JSON.parse(localStorage.getItem('playedSongs') || '{}');
            const localSkippedMap = JSON.parse(localStorage.getItem('skippedSongs') || '{}');
            const days = Object.keys(localMap || {});
            for (let di = 0; di < days.length; di++) {
              const dayId = String(days[di] || '').trim();
              if (!dayId) continue;
              const arr = Array.isArray(localMap[dayId]) ? localMap[dayId] : [];
              const skippedArr = Array.isArray(localSkippedMap[dayId]) ? localSkippedMap[dayId] : [];
              const skippedSet = new Set((skippedArr || []).map(x => String(x || '').toLowerCase().replace(/[^a-z0-9-]/g, '')));
              for (let i = 0; i < arr.length; i++) {
                const id = String(arr[i] || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
                if (skippedSet.has(id)) continue;
                if (!id.startsWith(`${key}-`)) continue;
                await registerToggleEvent({
                  action: 'mark',
                  usuario: key,
                  cancion: '',
                  artista: '',
                  day: dayId,
                  hora: '',
                  songId: id
                });
                try {
                  window.__userToggleSet = window.__userToggleSet || {};
                  const set = window.__userToggleSet[key] || (window.__userToggleSet[key] = new Set());
                  set.add(id);
                } catch (_) { }
              }
            }
          } catch (_) { }
          localStorage.setItem(flag, 'done');
          try { await cleanToggleEventsForUser(key); } catch (_) { }
          window.__toggleReady = window.__toggleReady || {};
          window.__toggleReady[key] = true;
        } catch (_) { }
      }

      async function cleanToggleEventsForUser(usuario) {
        try {
          const key = String(usuario || '').trim().replace(/^@/, '').toLowerCase();
          const qs = await db.collection('systemEvents').where('type', '==', 'togglePlayed').where('usuario', '==', key).get();
          const latest = {};
          const docs = [];
          qs.forEach(doc => {
            const d = doc.data() || {};
            const day = String(d.day || '');
            const sid = String(d.songId || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
            const canonical = `toggle-${key}-${sid}-${day}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
            const ts = d.ts && d.ts.toMillis ? d.ts.toMillis() : 0;
            const k = `${sid}|${day}`;
            docs.push({ id: doc.id, canonical, ts, action: String(d.action || '').toLowerCase(), sid, day });
            const cur = latest[k];
            if (doc.id === canonical) {
              latest[k] = { id: doc.id, canonical, ts, action: String(d.action || '').toLowerCase(), sid, day };
            } else if (!cur || ts >= cur.ts) {
              latest[k] = { id: doc.id, canonical, ts, action: String(d.action || '').toLowerCase(), sid, day };
            }
          });
          for (let i = 0; i < docs.length; i++) {
            const item = docs[i];
            const k = `${item.sid}|${item.day}`;
            const keep = latest[k];
            if (!keep) continue;
            if (item.id !== keep.id) await db.collection('systemEvents').doc(item.id).delete();
          }
          const keys = Object.keys(latest);
          for (let i = 0; i < keys.length; i++) {
            const it = latest[keys[i]];
            if (it.id !== it.canonical) {
              const data = { type: 'togglePlayed', usuario: key, songId: it.sid, day: it.day, action: it.action, ts: firebase.firestore.FieldValue.serverTimestamp() };
              await db.collection('systemEvents').doc(it.canonical).set(data, { merge: true });
              await db.collection('systemEvents').doc(it.id).delete();
              it.id = it.canonical;
            }
          }
          window.__userToggleSet = window.__userToggleSet || {};
          const newSet = new Set();
          keys.forEach(k => { const it = latest[k]; if (it.action === 'mark' && it.sid) newSet.add(it.sid); });
          window.__userToggleSet[key] = newSet;
          try { setPlayedStat(newSet.size); } catch (_) { }
          window.__toggleReady = window.__toggleReady || {};
          window.__toggleReady[key] = true;
        } catch (_) { }
      }

      // Función para mostrar el estado del dispositivo (silenciosa)
      function showDJStatus() {
        // Función silenciosa - no muestra mensajes al usuario
        const isDJ = isDJDevice();
        const statusElement = document.getElementById('dj-status');

        if (statusElement) {
          // Ocultar el elemento de estado para que no moleste
          statusElement.style.display = 'none';
        }

        // No mostrar ningún indicador visual al usuario
        return;
      }

      // Función de diagnóstico para verificar el estado del dispositivo DJ
      window.diagnosticoDJ = function () {
        console.log('🔍 DIAGNÓSTICO DEL DISPOSITIVO DJ');
        console.log('================================');

        const fingerprint = generateDeviceFingerprint();
        const storedFingerprint = localStorage.getItem('deviceFingerprint');
        const isMasterDevice = localStorage.getItem('isMasterDJDevice');
        const isDJ = isDJDevice();

        console.log('📱 Información del dispositivo:');
        console.log('  - User Agent:', navigator.userAgent.substring(0, 100) + '...');
        console.log('  - Pantalla:', screen.width + 'x' + screen.height);
        console.log('  - Idioma:', navigator.language);
        console.log('  - Zona horaria:', new Date().getTimezoneOffset());

        console.log('🔑 Fingerprints:');
        console.log('  - Actual:', fingerprint);
        console.log('  - Almacenado:', storedFingerprint);

        console.log('🎧 Estado DJ:');
        console.log('  - Es dispositivo DJ:', isDJ);
        console.log('  - Configuración almacenada:', isMasterDevice);

        const isDesktop = !(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
        const hasLargeScreen = screen.width >= 1024;

        console.log('📊 Criterios de detección:');
        console.log('  - Es escritorio:', isDesktop);
        console.log('  - Pantalla grande (>=1024px):', hasLargeScreen);
        console.log('  - Cumple criterios DJ:', isDesktop && hasLargeScreen);

        if (!isDJ) {
          console.log('⚠️ PROBLEMA: Este dispositivo no está autorizado como DJ');
          console.log('💡 SOLUCIÓN: Ejecuta resetearDispositivoDJ() para reconfigurar');
        } else {
          console.log('✅ Dispositivo DJ configurado correctamente');
        }

        return { fingerprint, isDJ, isDesktop, hasLargeScreen };
      };

      // Función para resetear la configuración del dispositivo DJ
      window.resetearDispositivoDJ = function () {
        console.log('🔄 Reseteando configuración del dispositivo DJ...');
        localStorage.removeItem('deviceFingerprint');
        localStorage.removeItem('isMasterDJDevice');
        localStorage.removeItem('masterDJFingerprint');

        // Forzar redetección
        const isDJ = isDJDevice();
        console.log(isDJ ? '✅ Dispositivo reconfigurado como DJ' : '❌ Dispositivo sigue sin ser DJ');

        // Actualizar estado visual
        showDJStatus();

        return isDJ;
      };

      // Función para forzar este dispositivo como DJ principal
      window.configurarComoDJ = function () {
        console.log('🎧 Configurando este dispositivo como DJ principal...');
        const fingerprint = generateDeviceFingerprint();
        localStorage.setItem('masterDJFingerprint', fingerprint);
        localStorage.setItem('isMasterDJDevice', 'true');

        // Actualizar estado visual
        showDJStatus();

        console.log('✅ Dispositivo configurado como DJ principal');
        console.log('💡 Ahora puedes marcar canciones como reproducidas');

        return true;
      };

      // Función para verificar que la funcionalidad esté funcionando
      window.initializePlayedSongs = async function () {
        console.log('Inicializando funcionalidad de canciones reproducidas...');

        // La detección de dispositivo DJ es automática

        // Verificar estado de autenticación silenciosamente
        const isDJ = isDJDevice();

        // Verificar localStorage
        const playedSongs = JSON.parse(localStorage.getItem('playedSongs') || '{}');
        console.log('Canciones reproducidas en localStorage:', playedSongs);

        // Verificar que los estilos CSS estén cargados
        const testElement = document.createElement('div');
        testElement.className = 'item played';
        document.body.appendChild(testElement);
        const styles = window.getComputedStyle(testElement);
        console.log('Estilos CSS para .item.played:', {
          backgroundColor: styles.backgroundColor,
          color: styles.color,
          opacity: styles.opacity,
          cursor: styles.cursor
        });
        document.body.removeChild(testElement);

        console.log('Funcionalidad de canciones reproducidas inicializada correctamente');
      }

      // Función para forzar estilos en canciones reproducidas (fallback)
      window.forcePlayedSongStyles = function () {
        const playedItems = document.querySelectorAll('.item.played');
        console.log(`Forzando estilos en ${playedItems.length} canciones reproducidas`);

        playedItems.forEach(item => {
          // Obtener tema actual
          const isDark = document.body.classList.contains('dark-theme');
          const themeClass = Array.from(document.body.classList).find(cls => cls.startsWith('theme-'));

          // Aplicar estilos base
          item.style.opacity = '0.7';
          item.style.cursor = 'pointer';
          item.style.transition = 'all 0.2s ease';
          item.style.position = 'relative';

          // Aplicar colores según tema
          if (themeClass === 'theme-blue') {
            item.style.backgroundColor = isDark ? '#1e3a8a' : '#dbeafe';
            item.style.color = isDark ? '#93c5fd' : '#1e40af';
          } else if (themeClass === 'theme-green') {
            item.style.backgroundColor = isDark ? '#14532d' : '#dcfce7';
            item.style.color = isDark ? '#86efac' : '#166534';
          } else if (themeClass === 'theme-purple') {
            item.style.backgroundColor = isDark ? '#581c87' : '#f3e8ff';
            item.style.color = isDark ? '#c4b5fd' : '#7c3aed';
          } else if (themeClass === 'theme-red') {
            item.style.backgroundColor = isDark ? '#991b1b' : '#fee2e2';
            item.style.color = isDark ? '#fca5a5' : '#dc2626';
          } else if (themeClass === 'theme-pink') {
            item.style.backgroundColor = isDark ? '#9d174d' : '#fce7f3';
            item.style.color = isDark ? '#f9a8d4' : '#be185d';
          } else {
            // Tema por defecto
            item.style.backgroundColor = isDark ? '#374151' : '#f3f4f6';
            item.style.color = isDark ? '#9ca3af' : '#6b7280';
          }

          // Agregar indicador ✓ si no existe
          const isSkipped = item.classList.contains('skipped');
          if (!item.querySelector('.played-indicator')) {
            const indicator = document.createElement('span');
            indicator.className = 'played-indicator';
            indicator.textContent = isSkipped ? '⏭' : '✓';
            indicator.style.cssText = `
              position: absolute;
              left: 4px;
              top: 50%;
              transform: translateY(-50%);
              font-size: 12px;
              font-weight: bold;
              color: ${isSkipped ? (isDark ? '#fbbf24' : '#d97706') : (isDark ? '#34d399' : '#10b981')};
              z-index: 1;
            `;
            item.insertBefore(indicator, item.firstChild);
          } else {
            const indicator = item.querySelector('.played-indicator');
            if (indicator) {
              indicator.textContent = isSkipped ? '⏭' : '✓';
              indicator.style.color = isSkipped ? (isDark ? '#fbbf24' : '#d97706') : (isDark ? '#34d399' : '#10b981');
            }
          }
        });
      }

      function escapeHTML(str) {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }

      function safeUrl(url) {
        if (!url) return '';
        const trimmed = String(url).trim();
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        return '';
      }

      window.escapeHTML = escapeHTML;
      window.safeUrl = safeUrl;

      function toHour(ts) {
        if (!ts) return '';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        // Forzar formato 24h consistente (HH:MM:SS) para mayor precisión y unicidad
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
      }
      function toHourKey(ts) {
        try {
          if (!ts) return '00:00';
          const d = ts?.toDate ? ts.toDate() : new Date(ts);
          const pad = (n) => String(n).padStart(2, '0');
          const hh = pad(d.getHours());
          const mm = pad(d.getMinutes());
          return `${hh}:${mm}`;
        } catch (_) {
          return '00:00';
        }
      }
      window.toHourKey = toHourKey;
      function resolveHourKey(ts) {
        try {
          if (typeof window.toHourKey === 'function') return window.toHourKey(ts);
          if (ts && ts?.toDate) {
            const d = ts.toDate();
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
          }
          const d = ts ? new Date(ts) : null;
          if (d && !isNaN(d.getTime())) {
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
          }
          return '00:00';
        } catch (_) { return '00:00'; }
      }
      window.resolveHourKey = resolveHourKey;
      function makeSongId(usuario, cancion, artista, ts) {
        const hora = toHour(ts);
        const raw = `${usuario}-${cancion}-${artista}-${hora}`;
        return raw.replace(/[^a-zA-Z0-9-]/g, '');
      }
      async function recalculateAllUsers() {
        return window.runFullAdminPointsRebuild();
      }

      // Utilidad para obtener el día (YYYY-MM-DD) desde una entrada con distintos tipos de timestamp
      function getSongDay(entry) {
        const t = entry?.timestamp || entry?.ts || entry?.time;
        try {
          const d = t && t.toDate ? t.toDate() : (t ? new Date(t) : new Date());
          return d.toISOString().split('T')[0];
        } catch (_) {
          return new Date().toISOString().split('T')[0];
        }
      }

      async function loadDays() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

        const isValidDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim());
        const days = new Set();

        if (db) {
          const snap = await db.collection('solicitudes').orderBy('ts', 'desc').get();
          snap.forEach(doc => {
            const d = doc.data();
            if (isValidDay(d.day)) {
              days.add(String(d.day).trim());
            } else if (d.ts) {
              try {
                const date = d.ts.toDate ? d.ts.toDate() : new Date(d.ts);
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                days.add(`${yyyy}-${mm}-${dd}`);
              } catch (_) { }
            }
          });
        }

        if (!days.size) {
          const byDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');
          Object.keys(byDay || {}).forEach(k => {
            if (isValidDay(k)) days.add(k);
          });
        }

        const sorted = Array.from(days).sort().reverse();

        daySelect.innerHTML = '';
        sorted.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d;
          opt.textContent = d;
          daySelect.appendChild(opt);
        });
        if (sorted.length) {
          daySelect.value = sorted.includes(today) ? today : sorted[0];
          try { daySelect.dispatchEvent(new Event('change')); } catch (_) { }
        }

        if (!daySelect.value) {
          const byDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');
          const localDays = Object.keys(byDay).sort().reverse();
          // También filtrar locales por si acaso
          const validLocalDays = localDays.filter(d => d <= today);

          if (validLocalDays.length) {
            daySelect.innerHTML = '';
            validLocalDays.forEach(d => {
              const opt = document.createElement('option');
              opt.value = d;
              opt.textContent = d;
              daySelect.appendChild(opt);
            });
            daySelect.value = validLocalDays[0];
            try { daySelect.dispatchEvent(new Event('change')); } catch (_) { }
          }
        }
      }

      function subscribeSolicitudesForDay(dayValue) {
        if (unsubscribeSolicitudes) {
          unsubscribeSolicitudes();
          unsubscribeSolicitudes = null;
        }

        // Iniciar suscripción a canciones reproducidas para este día
        if (typeof subscribePlayedSongs === 'function') {
          subscribePlayedSongs(dayValue);
        }

        if (!db) {
          const byDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');
          const arr = Array.isArray(byDay[dayValue]) ? byDay[dayValue] : [];
          let items = arr
            .filter(it => !(window.isDummyRequestForList ? window.isDummyRequestForList(it) : (String(it?.usuario || '').trim().toLowerCase() === 'prueba')))
            .filter(it => !vipOnly.checked || (typeof window.isUserVipGlobal === 'function' ? window.isUserVipGlobal(it.usuario) : (vipSet.has(it.usuario) || z0VipSet.has(it.usuario))))
            .map(it => ({
              requestId: it.id,
              usuario: it.usuario,
              cancion: it.cancion,
              artista: it.artista,
              link: it.link || '',
              genero: it.genero,
              cover: it.cover,
              status: it.status,
              hora: it.hora || toHour(it.time),
              time: it.time,
              day: dayValue
            }));
          const visibleItems = applyDisplayOrder(items);
          currentDayItems = visibleItems;
          window.__dayItems = visibleItems;
          renderSolicitudes(visibleItems);
          try { if (window.refreshStatsTicker) window.refreshStatsTicker(); } catch (_) { }
          return;
        }

        const start = new Date(`${dayValue}T00:00:00`);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);

        const dayDocs = new Map();
        const tsDocs = new Map();
        let unsubDay = null;
        let unsubTs = null;

        const applyItems = (itemsObj) => {
          const { items, allItems } = itemsObj;
          const visibleItems = applyDisplayOrder(items);
          currentDayItems = visibleItems;
          window.__dayItems = visibleItems;
          window.__allDayItems = allItems; // NUEVO: Guardar el array sin filtrar globalmente
          renderSolicitudes(visibleItems);
          try { if (window.refreshStatsTicker) window.refreshStatsTicker(); } catch (_) { }
          try {
            if (window.__usersSelectTimer) clearTimeout(window.__usersSelectTimer);
            window.__usersSelectTimer = setTimeout(() => {
              try { if (typeof window.renderAllUsersSelect === 'function') window.renderAllUsersSelect(); } catch (_) { }
              try { if (typeof window.populateUserSelectorFromLocalStorage === 'function') window.populateUserSelectorFromLocalStorage(); } catch (_) { }
            }, 150);
          } catch (_) { }
        };

        const mergeAndApply = () => {
          const byId = new Map();
          dayDocs.forEach((v, k) => { if (!byId.has(k)) byId.set(k, v); });
          tsDocs.forEach((v, k) => { if (!byId.has(k)) byId.set(k, v); });

          let items = [];
          let allItems = [];

          byId.forEach((data, docId) => {
            if (window.isDummyRequestForList ? window.isDummyRequestForList(data) : (String(data?.usuario || '').trim().toLowerCase() === 'prueba')) return;
            const isVip = typeof window.isUserVipGlobal === 'function' ? window.isUserVipGlobal(data.usuario) : (vipSet.has(data.usuario) || z0VipSet.has(data.usuario));

            const itemObj = {
              id: docId,
              requestId: data.id,
              usuario: data.usuario,
              displayName: data.displayName,
              cancion: data.cancion,
              artista: data.artista,
              link: data.link || '',
              genero: data.genero,
              cover: data.cover,
              status: data.status,
              ts: data.ts,
              hora: toHour(data.ts),
              day: data.day || dayValue
            };

            allItems.push(itemObj);

            if (vipOnly.checked && !isVip) return;
            items.push(itemObj);
          });

          if (allItems.length === 0) {
            const byDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');
            const arr = Array.isArray(byDay[dayValue]) ? byDay[dayValue] : [];
            const mappedArr = arr
              .filter(it => !(window.isDummyRequestForList ? window.isDummyRequestForList(it) : (String(it?.usuario || '').trim().toLowerCase() === 'prueba')))
              .map(it => ({
                requestId: it.id,
                usuario: it.usuario,
                cancion: it.cancion,
                artista: it.artista,
                link: it.link || '',
                genero: it.genero,
                cover: it.cover,
                status: it.status,
                hora: it.hora || toHour(it.time),
                time: it.time,
                day: dayValue
              }));

            allItems = mappedArr;
            items = mappedArr.filter(it => !vipOnly.checked || vipSet.has(it.usuario) || z0VipSet.has(it.usuario));
          }

          applyItems({ items, allItems });
        };

        const qDay = db.collection('solicitudes').where('day', '==', dayValue);
        unsubDay = qDay.onSnapshot((snap) => {
          console.log(`📥 Recibidos ${snap.size} documentos por day para ${dayValue}`);
          dayDocs.clear();
          snap.forEach((doc) => dayDocs.set(doc.id, doc.data() || {}));
          mergeAndApply();
        }, (err) => {
          console.error('Error suscripción solicitudes (day):', err);
        });

        const qTs = db.collection('solicitudes')
          .where('ts', '>=', start)
          .where('ts', '<', end)
          .orderBy('ts', 'asc');
        
        try {
          unsubTs = qTs.onSnapshot((snap) => {
            console.log(`📥 Recibidos ${snap.size} documentos por ts para ${dayValue}`);
            tsDocs.clear();
            snap.forEach((doc) => tsDocs.set(doc.id, doc.data() || {}));
            mergeAndApply();
          }, (err) => {
            console.warn('Error suscripción solicitudes (ts):', err);
          });
        } catch (_) {}

        unsubscribeSolicitudes = () => {
          try { if (unsubDay) unsubDay(); } catch (_) {}
          try { if (unsubTs) unsubTs(); } catch (_) {}
        };
      }

      // Hacer accesible desde el IIFE de UI
      window.subscribeSolicitudesForDay = subscribeSolicitudesForDay;

      // Variables para paginación de búsqueda
      let lastSearchDoc = null;
      let currentSearchQuery = '';

      const searchModal = document.getElementById('search-modal');
      const searchInput = document.getElementById('modal-search-input');
      const searchResults = document.getElementById('modal-search-results');
      const searchClose = document.getElementById('search-close');
      const searchLoadMore = document.getElementById('search-load-more');

      function openSearchModal() {
        searchModal.hidden = false;
        searchInput.value = '';
        searchResults.innerHTML = '';
        searchLoadMore.hidden = true;
        lastSearchDoc = null;
        currentSearchQuery = '';
        searchInput.focus();
      }

      // Función de búsqueda de datos (simulada o real)
      async function querySolicitudes(query, lastDoc = null) {
        if (!query) return { results: [], lastDoc: null };
        const qStr = String(query).toLowerCase();

        // Estrategia de búsqueda mejorada:
        // 1. Intentar buscar por 'cancion' (prefijo)
        // 2. Intentar buscar por 'artista' (prefijo)
        // 3. Intentar buscar por 'usuario' (prefijo)
        // 4. Combinar resultados y eliminar duplicados
        // Nota: Como no podemos hacer OR eficiente en cliente con SDK v8/v9 compat sin índices complejos,
        // haremos consultas paralelas limitadas y combinaremos en memoria.

        const capitalized = query.charAt(0).toUpperCase() + query.slice(1);
        const upper = query.toUpperCase();
        const lower = query.toLowerCase(); // Por si acaso hay datos en minúsculas

        // Si hay paginación (lastDoc), la cosa se complica para búsquedas paralelas combinadas.
        // Simplificación: Si es "cargar más", solo seguiremos la estrategia que dio resultados antes o
        // reseteamos la lógica.
        // Para simplificar la UX actual: haremos una búsqueda nueva combinada de los primeros N resultados de cada criterio.
        // La paginación real en búsquedas combinadas cliente es compleja. 
        // Asumiremos que el usuario quiere ver "lo mejor" de cada categoría.

        try {
          const limitPerCategory = 10;

          // Consultas paralelas
          const promises = [];

          // 1. Por Canción (Capitalized)
          promises.push(db.collection('solicitudes')
            .where('cancion', '>=', capitalized)
            .where('cancion', '<=', capitalized + '\uf8ff')
            .limit(limitPerCategory)
            .get());

          // 2. Por Artista (Capitalized)
          promises.push(db.collection('solicitudes')
            .where('artista', '>=', capitalized)
            .where('artista', '<=', capitalized + '\uf8ff')
            .limit(limitPerCategory)
            .get());

          // 3. Por Usuario (minusculas o exacto, usualmente usuario se guarda tal cual viene)
          // Probamos con lo que escribió el usuario tal cual y en minusculas
          promises.push(db.collection('solicitudes')
            .where('usuario', '>=', qStr)
            .where('usuario', '<=', qStr + '\uf8ff')
            .limit(limitPerCategory)
            .get());

          // Ejecutar todas
          const snapshots = await Promise.all(promises);

          const resultsMap = new Map();

          snapshots.forEach(snap => {
            snap.forEach(doc => {
              // Evitar duplicados
              if (!resultsMap.has(doc.id)) {
                const d = doc.data();
                // Filtro de invisibilidad para pruebas
                if (window.isDummyRequestForList ? window.isDummyRequestForList(d) : (String(d.usuario || '').trim().toLowerCase() === 'prueba')) return;

                resultsMap.set(doc.id, {
                  id: doc.id,
                  ...d,
                  day: d.day || getSongDay(d),
                  ts: d.ts || d.timestamp || d.time
                });
              }
            });
          });

          // Convertir a array
          let results = Array.from(resultsMap.values());

          // Ordenar resultados en memoria (mejor match primero?)
          // Prioridad: coincidencia exacta > empieza con > contiene
          results.sort((a, b) => {
            // Lógica simple: fecha más reciente primero
            const ta = a.ts && a.ts.toMillis ? a.ts.toMillis() : 0;
            const tb = b.ts && b.ts.toMillis ? b.ts.toMillis() : 0;
            return tb - ta;
          });

          // Simular paginación o simplemente devolver todo lo encontrado (hasta 30 items)
          // Para esta versión simple, devolvemos todo y lastDoc null (desactivamos "cargar más" real por ahora para búsquedas complejas)
          // O devolvemos el último de la lista para cumplir la firma, aunque no funcione perfecto el next cursor.

          return { results, lastDoc: null };
        } catch (e) {
          console.error("Error buscando solicitudes:", e);
          return { results: [], lastDoc: null };
        }
      }

      async function performSearch(isLoadMore = false) {
        const query = searchInput.value.trim();
        if (!query) return;

        if (!isLoadMore) {
          // Si no es "Cargar más", dejamos que el listener de input maneje la UI inicial (predicciones)
          // O si queremos que el botón de búsqueda fuerce resultados:
          searchResults.innerHTML = '<div class="search-loading">Buscando...</div>';
          searchResults.hidden = false;
          lastSearchDoc = null;
          currentSearchQuery = query;
        } else {
          searchLoadMore.textContent = 'Cargando...';
          searchLoadMore.disabled = true;
        }

        const { results, lastDoc } = await querySolicitudes(query, lastSearchDoc);

        lastSearchDoc = lastDoc;

        if (results.length === 0 && !isLoadMore) {
          searchResults.innerHTML = '<div class="search-error">No se encontraron resultados.</div>';
          searchLoadMore.hidden = true;
          return;
        }

        // Si es carga inicial, usamos renderSearchResults para mantener consistencia
        if (!isLoadMore) {
          renderSearchResults(results);
        } else {
          // Si es cargar más, añadimos (esto requiere que renderSearchResults soporte append o hacerlo manual)
          // Por simplicidad, renderSearchResults reemplaza. 
          // Aquí haremos append manual compatible con el estilo de renderSearchResults
          const html = results.map(it => createSearchResultItemHTML(it)).join('');
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;
          Array.from(tempDiv.children).forEach(child => searchResults.appendChild(child));
        }

        // Gestionar botón "Cargar más"
        if (lastDoc) {
          searchLoadMore.hidden = false;
          searchLoadMore.textContent = 'Cargar más resultados...';
          searchLoadMore.disabled = false;
        } else {
          searchLoadMore.hidden = true;
        }
      }

      // Helper para generar HTML de item (extraído de renderSearchResults)
      function createSearchResultItemHTML(it) {
        const formatDate = (dateStr) => {
          if (!dateStr) return '';
          try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
          } catch (e) { return dateStr; }
        };

        const cleanSong = escapeHTML(it.cancion);
        const cleanArtist = escapeHTML(it.artista);
        const cleanUser = escapeHTML(it.usuario);

        return `
            <div class="search-result" data-day="${it.day || ''}" tabindex="0" title="Click para ir a la fecha">
              <span class="sr-song">${cleanSong}</span>
              <span class="sr-artist">${cleanArtist}</span>
              <span class="sr-user">${cleanUser}</span>
              <span class="sr-date">${formatDate(it.day)}</span>
              <span class="sr-arrow">→</span>
            </div>
          `;
      }

      // Event Listeners para búsqueda
      document.getElementById('menu-search-open')?.addEventListener('click', openSearchModal);
      searchClose?.addEventListener('click', () => { searchModal.hidden = true; });

      // Eliminamos el listener duplicado de input que llamaba a performSearch directamente
      // searchInput?.addEventListener('input', ...); -> ELIMINADO/COMENTADO para evitar conflicto con el listener de la línea 5080

      searchLoadMore?.addEventListener('click', () => performSearch(true));

      window.searchSolicitudes = async (query) => {
        const { results } = await querySolicitudes(query);
        return results;
      };

      function subscribeSuperfanUsers() {
        db.collection('superfanUsers').onSnapshot((snap) => {
          window.superfanSet = new Set();
          window.__badgeUserLists = window.__badgeUserLists || {};
          window.__badgeUserLists.superfan = [];
          const listEl = document.getElementById('superfan-list');
          if (listEl) listEl.innerHTML = '';
          snap.forEach((doc) => {
            const d = doc.data() || {};
            const name = String(d.name || doc.id || '').trim();
            if (!name) return;
            window.superfanSet.add(name.toLowerCase());
            window.__badgeUserLists.superfan.push(name);
            if (listEl) {
              const li = document.createElement('li');
              const cleanName = escapeHTML(name);
              li.innerHTML = `<span>${cleanName}</span><button type="button" class="remove-btn" data-user="${cleanName}" data-type="superfan" aria-label="Quitar Superfan">×</button>`;
              listEl.appendChild(li);
            }
          });
          if (daySelect.value) subscribeSolicitudesForDay(daySelect.value);
          applySelectedBadgeToAll();
          refreshBadgeSelectUI();
          try { renderVipHierarchyIfOpen(); } catch (_) { }
        }, (err) => console.error('❌ Error suscripción Superfan:', err));
      }

      function subscribeVipUsers() {
        console.log('🔄 Iniciando suscripción VIP...');
        db.collection('vipUsers').onSnapshot((snap) => {
          console.log(`📊 VIP snapshot recibido: ${snap.size} documentos`);
          window.vipSet = new Set();
          window.vipMap = new Map();
          window.__badgeUserLists = window.__badgeUserLists || {};
          window.__badgeUserLists.vip = [];
          vipSet = window.vipSet;
          vipListEl.innerHTML = '';
          snap.forEach((doc) => {
            const data = doc.data();
            const { name, activatedAt } = data;

            // AUTO-CORRECCIÓN: Si no tiene fecha de activación, asignar fecha actual
            if (name && !activatedAt) {
              console.log(`🔧 Auto-corrigiendo fecha VIP para: ${name}`);
              doc.ref.set({
                activatedAt: firebase.firestore.FieldValue.serverTimestamp()
              }, { merge: true }).catch(e => console.error('Error auto-fix VIP:', e));
            }

            if (name) {
              const normalizedName = String(name).trim().toLowerCase();
              vipSet.add(normalizedName);
              window.__badgeUserLists.vip.push(String(name).trim());

              let activationDate = null;
              if (activatedAt) {
                try {
                  const d = activatedAt.toDate ? activatedAt.toDate() : new Date(activatedAt);
                  activationDate = d.toISOString().split('T')[0];
                } catch (e) { console.warn('Fecha VIP inválida:', e); }
              }
              window.vipMap.set(normalizedName, { activatedAt: activationDate });

              const li = document.createElement('li');
              const cleanName = escapeHTML(name);
              li.innerHTML = `
                <span>${cleanName}</span>
                <button type="button" class="remove-btn" data-user="${cleanName}" aria-label="Quitar VIP">×</button>
              `;
              vipListEl.appendChild(li);
            }
          });

          // Procesar logros VIP después de cargar los datos
          console.log(`🔄 VIP set actualizado, procesando logros para ${vipSet.size} usuarios VIP`);
          setTimeout(() => {
            vipSet.forEach(username => {
              window.grantBadgeAchievement(username);
            });
          }, 1000);

          if (daySelect.value) subscribeSolicitudesForDay(daySelect.value);
          applySelectedBadgeToAll();
          refreshBadgeSelectUI();
          try { renderVipHierarchyIfOpen(); } catch (_) { }
        }, (err) => {
          console.error('❌ Error suscripción VIP:', err);
        });
      }

      function subscribeZ0VipUsers() {
        console.log('🔄 Iniciando suscripción Z0-VIP...');
        const z0VipListEl = document.getElementById('z0-vip-list');
        db.collection('z0VipUsers').onSnapshot((snap) => {
          console.log(`📊 Z0-VIP snapshot recibido: ${snap.size} documentos`);
          window.z0VipSet = new Set();
          window.__badgeUserLists = window.__badgeUserLists || {};
          window.__badgeUserLists['z0-vip'] = [];
          z0VipSet = window.z0VipSet;
          if (z0VipListEl) {
            z0VipListEl.innerHTML = '';
          }
          snap.forEach((doc) => {
            const { name } = doc.data();
            if (name) {
              z0VipSet.add(String(name).trim().toLowerCase());
              window.__badgeUserLists['z0-vip'].push(String(name).trim());
              if (z0VipListEl) {
                const li = document.createElement('li');
                const cleanName = escapeHTML(name);
                li.innerHTML = `
                  <span>${cleanName}</span>
                  <button type="button" class="remove-btn" data-user="${cleanName}" data-type="z0" aria-label="Quitar Z0-VIP">×</button>
                `;
                z0VipListEl.appendChild(li);
              }
            }
          });

          // Procesar logros Z0-VIP después de cargar los datos
          console.log(`🔄 Z0-VIP set actualizado, procesando logros para ${z0VipSet.size} usuarios Z0-VIP`);
          setTimeout(() => {
            z0VipSet.forEach(username => {
              window.grantBadgeAchievement(username);
            });
          }, 1000);

          if (daySelect.value) subscribeSolicitudesForDay(daySelect.value);
          applySelectedBadgeToAll();
          refreshBadgeSelectUI();
          try { renderVipHierarchyIfOpen(); } catch (_) { }
        }, (err) => {
          console.error('❌ Error suscripción Z0-VIP:', err);
        });
      }

      function subscribeDonadorUsers() {
        console.log('🔄 Iniciando suscripción Donador...');
        db.collection('donadorUsers').onSnapshot((snap) => {
          console.log(`📊 Donador snapshot recibido: ${snap.size} documentos`);
          window.donadorSet = new Set();
          window.__badgeUserLists = window.__badgeUserLists || {};
          window.__badgeUserLists.donador = [];
          donadorSet = window.donadorSet;
          if (donadorListEl) {
            donadorListEl.innerHTML = '';
          }

          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

          snap.forEach((doc) => {
            const data = doc.data();
            const { name, expiresAt } = data;

            if (name && expiresAt) {
              const expireDate = expiresAt.split('T')[0]; // YYYY-MM-DD

              // Si ya expiró, eliminar automáticamente
              if (expireDate < today) {
                db.collection('donadorUsers').doc(doc.id).delete().catch(console.error);
                return;
              }

              donadorSet.add(String(name).trim().toLowerCase());
              window.__badgeUserLists.donador.push(`${String(name).trim()} (hasta ${expireDate})`);
              if (donadorListEl) {
                const li = document.createElement('li');
                const cleanName = escapeHTML(name);
                const cleanExpireDate = escapeHTML(expireDate);
                li.innerHTML = `
                  <span>${cleanName} (hasta ${cleanExpireDate})</span>
                  <button type="button" class="remove-btn" data-user="${cleanName}" data-type="donador" aria-label="Quitar Donador">×</button>
                `;
                donadorListEl.appendChild(li);
              }
            }
          });

          // Procesar logros Donador después de cargar los datos
          console.log(`🔄 Donador set actualizado, procesando logros para ${donadorSet.size} usuarios Donador`);
          setTimeout(() => {
            donadorSet.forEach(username => {
              window.grantBadgeAchievement(username);
            });
          }, 1000);

          if (daySelect.value) subscribeSolicitudesForDay(daySelect.value);
          applySelectedBadgeToAll();
          refreshBadgeSelectUI();
          try { renderVipHierarchyIfOpen(); } catch (_) { }
        }, (err) => {
          console.error('❌ Error suscripción Donadores:', err);
        });
      }

      function subscribeZ0FanUsers() {
        const listEl = document.getElementById('z0-fan-list');
        db.collection('z0FanUsers').onSnapshot((snap) => {
          window.z0FanSet = new Set();
          window.__badgeUserLists = window.__badgeUserLists || {};
          window.__badgeUserLists['z0-fan'] = [];
          if (listEl) listEl.innerHTML = '';
          snap.forEach((doc) => {
            const { name } = doc.data();
            if (name) {
              window.z0FanSet.add(String(name).trim().toLowerCase());
              window.__badgeUserLists['z0-fan'].push(String(name).trim());
              if (listEl) {
                const li = document.createElement('li');
                const cleanName = escapeHTML(name);
                li.innerHTML = `<span>${cleanName}</span><button type="button" class="remove-btn" data-user="${cleanName}" data-type="z0-fan" aria-label="Quitar z0-Fan">×</button>`;
                listEl.appendChild(li);
              }
            }
          });

          // Procesar logros z0-Fan después de cargar los datos
          console.log(`🔄 z0-Fan set actualizado, procesando logros para ${window.z0FanSet.size} usuarios z0-Fan`);
          setTimeout(() => {
            window.z0FanSet.forEach(username => {
              if (typeof window.grantBadgeAchievement === 'function') {
                window.grantBadgeAchievement(username);
              }
            });
          }, 1000);

          if (daySelect.value) subscribeSolicitudesForDay(daySelect.value);
          applySelectedBadgeToAll();
          refreshBadgeSelectUI();
          try { renderVipHierarchyIfOpen(); } catch (_) { }
        }, (err) => { console.error('❌ Error suscripción z0-Fan:', err); });
      }

      function subscribeZ0PlatinoUsers() {
        const listEl = document.getElementById('z0-platino-list');
        db.collection('z0PlatinumUsers').onSnapshot((snap) => {
          window.z0PlatinumSet = new Set();
          window.__badgeUserLists = window.__badgeUserLists || {};
          window.__badgeUserLists['z0-platino'] = [];
          if (listEl) listEl.innerHTML = '';
          snap.forEach((doc) => {
            const { name } = doc.data();
            if (name) {
              window.z0PlatinumSet.add(String(name).trim().toLowerCase());
              window.__badgeUserLists['z0-platino'].push(String(name).trim());
              if (listEl) {
                const li = document.createElement('li');
                const cleanName = escapeHTML(name);
                li.innerHTML = `<span>${cleanName}</span><button type="button" class="remove-btn" data-user="${cleanName}" data-type="z0-platino" aria-label="Quitar z0-Platino">×</button>`;
                listEl.appendChild(li);
              }
            }
          });

          // Procesar logros z0-Platino después de cargar los datos
          console.log(`🔄 z0-Platino set actualizado, procesando logros para ${window.z0PlatinumSet.size} usuarios z0-Platino`);
          setTimeout(() => {
            window.z0PlatinumSet.forEach(username => {
              if (typeof window.grantBadgeAchievement === 'function') {
                window.grantBadgeAchievement(username);
              }
            });
          }, 1000);

          if (daySelect.value) subscribeSolicitudesForDay(daySelect.value);
          applySelectedBadgeToAll();
          refreshBadgeSelectUI();
          try { renderVipHierarchyIfOpen(); } catch (_) { }
        }, (err) => { console.error('❌ Error suscripción z0-Platino:', err); });
      }

      // Suscripción en tiempo real para canciones reproducidas (sincronización global)
      function subscribePlayedSongs(day) {
        if (!day || !window.db) return;

        console.log('🎵 Suscribiéndose a canciones reproducidas para el día:', day);

        // Cancelar suscripción anterior si existe
        if (window.playedSongsUnsubscribe) {
          window.playedSongsUnsubscribe();
        }

        // Suscribirse a cambios en tiempo real
        window.playedSongsUnsubscribe = window.db.collection('playedSongs').doc(day)
          .onSnapshot((doc) => {
            try {
              const data = doc.data();
              const firebaseSongs = data?.songs || [];
              const firebaseSkipped = Array.isArray(data?.skipped) ? data.skipped : [];

              console.log('🔄 Actualización de Firebase para canciones reproducidas:', {
                day,
                songs: firebaseSongs,
                count: firebaseSongs.length
              });

              // Actualizar localStorage con datos de Firebase
              const localPlayedSongs = getLocalPlayedMap();
              localPlayedSongs[day] = firebaseSongs;
              setLocalPlayedMap(localPlayedSongs);

              const localSkippedSongs = getLocalSkippedMap();
              localSkippedSongs[day] = firebaseSkipped;
              setLocalSkippedMap(localSkippedSongs);

              window.playedSongsCache[day] = firebaseSongs;

              // Actualizar interfaz visual
              updatePlayedSongsUI(day, firebaseSongs, firebaseSkipped);

            } catch (error) {
              console.error('Error procesando actualización de canciones reproducidas:', error);
            }
          }, (error) => {
            console.error('Error en suscripción de canciones reproducidas:', error);
          });
      }

      function normalizeUserForStats(u) {
        return String(u || '').trim().toLowerCase();
      }

      function isDummyRequestForList(it) {
        const u = normalizeUserForStats(it?.usuario);
        const s = String(it?.cancion || '').trim().toLowerCase();
        const a = String(it?.artista || '').trim().toLowerCase();
        if (u === 'prueba' || u.startsWith('prueba')) return true;
        if (s === 'prueba' || s.startsWith('prueba')) return true;
        if (a === 'prueba' || a.startsWith('prueba')) return true;
        return false;
      }

      function isTestRequestForStats(it) {
        const u = normalizeUserForStats(it?.usuario);
        if (!u) return true;
        if (u === 'prueba' || u.startsWith('prueba')) return true;
        const s = String(it?.cancion || '').trim().toLowerCase();
        const a = String(it?.artista || '').trim().toLowerCase();
        if (s === 'prueba' || s.startsWith('prueba')) return true;
        if (a === 'prueba' || a.startsWith('prueba')) return true;
        if (it && it.isSimulation === true) return true;
        if (it && it.isTest === true) return true;
        if (it && String(it.source || '').toLowerCase() === 'tiktoktest') return true;
        return false;
      }

      function getItemTimeMs(it) {
        try {
          if (!it) return 0;
          if (it.ts && typeof it.ts.toMillis === 'function') return it.ts.toMillis();
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
          const h = String(it.hora || '').trim();
          const day = String(it.day || document.getElementById('day-select')?.value || '').trim();
          if (day && /^\d{4}-\d{2}-\d{2}$/.test(day) && /^\d{2}:\d{2}$/.test(h)) {
            const t = new Date(`${day}T${h}:00`).getTime();
            if (!Number.isNaN(t)) return t;
          }
        } catch (_) { }
        return 0;
      }

      function getLatestNonTestItem(items) {
        if (!Array.isArray(items) || !items.length) return null;
        let best = null;
        let bestTime = -Infinity;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (isTestRequestForStats(it)) continue;
          const t = getItemTimeMs(it);
          if (t > bestTime) {
            bestTime = t;
            best = it;
          }
        }
        return best;
        return null;
      }

      try {
        window.normalizeUserForStats = normalizeUserForStats;
        window.isDummyRequestForList = isDummyRequestForList;
        window.isTestRequestForStats = isTestRequestForStats;
        window.getItemTimeMs = getItemTimeMs;
        window.getLatestNonTestItem = getLatestNonTestItem;
      } catch (_) { }

      // Función para calcular estadísticas del día
      function computeDayStatsFromItems(items) {
        const songCount = {}; const artistCount = {}; const userCount = {}; const genreCount = {}; const artistOriginal = {}; const userOriginal = {};
        let totalCount = 0;
        for (let i = 0; i < items.length; i++) {
          const it = items[i] || {};
          if (isTestRequestForStats(it)) continue;
          const uNorm = normalizeUserForStats(it.usuario);
          totalCount++;
          const song = String(it.cancion || '').trim().toLowerCase();
          const artist = String(it.artista || '').trim().toLowerCase();
          const user = uNorm;
          const genre = String(it.genero || '').trim().toLowerCase();
          if (song) songCount[song] = (songCount[song] || 0) + 1;
          if (artist) { artistCount[artist] = (artistCount[artist] || 0) + 1; if (!artistOriginal[artist]) artistOriginal[artist] = String(it.artista || '').trim(); }
          if (user) { userCount[user] = (userCount[user] || 0) + 1; if (!userOriginal[user]) userOriginal[user] = String(it.usuario || '').trim(); }
          if (genre) genreCount[genre] = (genreCount[genre] || 0) + 1;
        }
        function top(map) { let k = ''; let v = 0; for (const key in map) { const val = map[key]; if (val > v) { v = val; k = key; } else if (val === v && (!k || key.localeCompare(k) < 0)) { k = key; } } return k; }
        const day = document.getElementById('day-select')?.value || '';
        const played = getLocalPlayedMap();
        const skipped = getLocalSkippedMap();
        const playedArr = Array.isArray(played[day]) ? played[day] : [];
        const skippedArr = Array.isArray(skipped[day]) ? skipped[day] : [];
        const skippedSet = new Set(skippedArr.map(x => String(x || '')));
        const playedCount = playedArr.filter(x => !skippedSet.has(String(x || ''))).length;
        let vipRequests = 0; let z0VipRequests = 0;
        for (let i = 0; i < items.length; i++) {
          const it = items[i] || {};
          if (isTestRequestForStats(it)) continue;
          const u = it.usuario;
          const unameLc = normalizeUserForStats(u);
          if (window.vipSet && window.vipSet.has(unameLc)) vipRequests++;
          if (window.z0VipSet && window.z0VipSet.has(unameLc)) z0VipRequests++;
        }
        const ts = top(songCount);
        const ta = top(artistCount);
        const artistTop3 = Object.keys(artistCount)
          .map(k => ({ k, c: artistCount[k], o: artistOriginal[k] || k }))
          .sort((a, b) => { var d = b.c - a.c; if (d !== 0) return d; return a.k.localeCompare(b.k); })
          .slice(0, 3)
          .map(it => `${it.o} (${it.c})`);
        const usersTop3 = Object.keys(userCount)
          .map(k => ({ k, c: userCount[k], o: userOriginal[k] || k }))
          .sort((a, b) => { var d = b.c - a.c; if (d !== 0) return d; return a.k.localeCompare(b.k); })
          .slice(0, 3)
          .map(it => `${it.o} (${it.c})`);
        return {
          topSong: ts,
          topSongCount: ts ? (songCount[ts] || 0) : 0,
          topArtist: ta,
          topArtistCount: ta ? (artistCount[ta] || 0) : 0,
          topArtists3: artistTop3,
          topUser: top(userCount),
          topUsers3: usersTop3,
          topGenre: top(genreCount),
          total: totalCount,
          played: playedCount,
          vip: vipRequests,
          z0vip: z0VipRequests
        };
      }

      function updateStatsTickerFromItems(items) {
        const el = document.querySelector('#stats-ticker .ticker-content');
        if (!el) return;
        if (el.getAttribute('data-react-root') === 'true') return;
        const s = computeDayStatsFromItems(items);
        function fmt(x) { return x && x.length ? x : 'N/D'; }
        const top3Txt = Array.isArray(s.topArtists3) && s.topArtists3.length ? s.topArtists3.join(', ') : 'N/D';
        const usersTop3Txt = Array.isArray(s.topUsers3) && s.topUsers3.length ? s.topUsers3.join(', ') : 'N/D';
        const latest = getLatestNonTestItem(items);
        const latestTxt = latest ? (String(latest.cancion || '').trim() + (latest.artista ? ' — ' + String(latest.artista).trim() : '')) : 'N/D';
        const daySel = String(document.getElementById('day-select')?.value || '').trim();
        const now = new Date();
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const dayLabel = daySel ? (daySel === todayKey ? 'HOY' : daySel) : 'HOY';
        const dayText = '📅 <strong>' + dayLabel + '</strong>' +
          ' • <strong>🎵 Última canción solicitada:</strong> ' + fmt(latestTxt) +
          ' • <strong>🎵 Canción más pedida:</strong> ' + fmt(s.topSong) + ' (' + (s.topSongCount || 0) + ')' +
          ' • <strong>🎤 Artista más pedido:</strong> ' + fmt(s.topArtist) + ' (' + (s.topArtistCount || 0) + ')' +
          ' • <strong>▶️ Reproducidas:</strong> ' + (s.played || 0) +
          ' • <strong>👥 Top 3 usuarios:</strong> ' + usersTop3Txt +
          ' • <strong>🎤 Top 3 artistas:</strong> ' + top3Txt +
          ' • <strong>📝 Solicitudes:</strong> ' + (s.total || 0) +
          ' • <strong>⭐ VIP:</strong> ' + (s.vip || 0) +
          ' • <strong>👑 z0Vip:</strong> ' + (s.z0vip || 0);
        const g = window.__globalStats || { topSong: 'N/D', topSongCount: 0, topArtist: 'N/D', topArtistCount: 0, topArtists3: [], topUsers3: [], topPoints3: [], topGenre: 'N/D', topLiker: 'N/D', topLikerCount: 0, total: 0 };
        function fmtG(x) { return x && x.length ? x : 'N/D'; }
        const top3TxtGlobal = Array.isArray(g.topArtists3) && g.topArtists3.length ? g.topArtists3.join(', ') : 'N/D';
        const usersTop3TxtGlobal = Array.isArray(g.topUsers3) && g.topUsers3.length ? g.topUsers3.join(', ') : 'N/D';
        let avgTxtGlobal = 'N/D';
        if (typeof window.__globalTotalSolicitudes === 'number' && typeof window.__globalDistinctUsers === 'number' && window.__globalDistinctUsers > 0) {
          avgTxtGlobal = (window.__globalTotalSolicitudes / window.__globalDistinctUsers).toFixed(1);
        }
        const globalText = '<strong>HISTORIA:</strong>' +
          ' • <strong>🎵 Canción más pedida:</strong> ' + fmtG(g.topSong) + (typeof g.topSongCount === 'number' ? ' (' + g.topSongCount + ')' : '') +
          ' • <strong>🎤 Artista más pedido:</strong> ' + fmtG(g.topArtist) + (typeof g.topArtistCount === 'number' ? ' (' + g.topArtistCount + ')' : '') +
          ' • <strong>👥 Top 3 usuarios:</strong> ' + usersTop3TxtGlobal +
          ' • <strong>🏆 Top Puntos:</strong> ' + (Array.isArray(g.topPoints3) && g.topPoints3.length ? g.topPoints3.join(', ') : 'N/D') +
          ' • <strong>🎤 Top 3 artistas:</strong> ' + top3TxtGlobal +
          ' • <strong>🎹 Género Top:</strong> ' + fmtG(g.topGenre || 'N/D') +
          ' • <strong>❤️ Top Liker:</strong> ' + fmtG(g.topLiker) + (g.topLikerCount ? ' (' + g.topLikerCount + ')' : '') +
          ' • <strong>📊 Total solicitudes:</strong> ' + (g.total || 0) +
          ' • <strong>📈 Promedio por usuario:</strong> ' + avgTxtGlobal;
        const sep = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
        el.innerHTML = dayText + sep + globalText;
      }

      function updateModernWidgetPure() {
        const container = document.getElementById('react-modern-widget');
        if (!container) return;
        if (container.getAttribute('data-react-root') === 'true') return;
        function fmt(x) { return x && x.length ? x : 'N/D'; }
        const items = window.__allDayItems || window.__dayItems || []; // NUEVO: Usar items sin filtrar
        if (Array.isArray(items) && items.length) {
          const s = computeDayStatsFromItems(items);
          const chips = [
            { label: '🎵 Canción top', value: fmt(s.topSong) + ' (' + (s.topSongCount || 0) + ')' },
            { label: '👤 Usuario top', value: fmt(s.topUser) },
            { label: '🎤 Top 3 artistas', value: (Array.isArray(s.topArtists3) && s.topArtists3.length ? s.topArtists3.join(', ') : 'N/D') },
            { label: '📅 Hoy', value: String(s.total || 0) }
          ];
          container.innerHTML = chips.map(c => `<div class="modern-chip"><span class="label">${c.label}</span><span class="value">${c.value}</span></div>`).join('');
          return;
        }
        const g = window.__globalStats || { total: 0, topArtists3: [], topUsers3: [], topPoints3: [], topSong: '', topUser: '', topGenre: 'N/D', topLiker: 'N/D', topLikerCount: 0 };
        const chips = [
          { label: '🎵 Canción top', value: fmt(g.topSong) },
          { label: '👤 Usuario top', value: fmt(g.topUser) },
          { label: '🎤 Top 3 artistas', value: (Array.isArray(g.topArtists3) && g.topArtists3.length ? g.topArtists3.join(', ') : 'N/D') },
          { label: '🧮 Total', value: String(g.total || 0) }
        ];
        container.innerHTML = chips.map(c => `<div class="modern-chip"><span class="label">${c.label}</span><span class="value">${c.value}</span></div>`).join('');
      }

      // Función para actualizar la interfaz visual de canciones reproducidas
      function updatePlayedSongsUI(day, playedSongIds, skippedSongIds) {
        try {
          const currentDay = document.getElementById('day-select')?.value;

          // Solo actualizar si estamos viendo el día correcto
          if (currentDay !== day) {
            console.log('Día diferente, no actualizando UI:', { currentDay, day });
            return;
          }

          console.log('🎨 Actualizando UI para canciones reproducidas:', {
            day,
            songs: playedSongIds,
            count: playedSongIds.length
          });

          // Obtener todos los elementos de canciones
          const songItems = document.querySelectorAll('.item[data-song-id]');
          const skippedSet = new Set((Array.isArray(skippedSongIds) ? skippedSongIds : []).map(x => String(x || '')));

          songItems.forEach(item => {
            const songId = item.getAttribute('data-song-id');
            const isPlayed = playedSongIds.includes(songId);
            const isSkipped = skippedSet.has(String(songId || ''));
            const iconEl = item.querySelector('.play-icon');

            if (isPlayed) {
              // Marcar como reproducida
              item.classList.add('played');
              item.classList.toggle('skipped', isSkipped);
              if (iconEl) iconEl.textContent = isSkipped ? '⏭️' : '▶️';
            } else {
              // Desmarcar como reproducida
              item.classList.remove('played');
              item.classList.remove('skipped');
              if (iconEl) iconEl.textContent = '▶️';

              // Remover indicador visual si existe
              const indicator = item.querySelector('.played-indicator');
              if (indicator) {
                indicator.remove();
              }

              // Restaurar estilos originales
              item.style.backgroundColor = '';
              item.style.color = '';
              item.style.opacity = '';
            }
          });

          // Forzar aplicación de estilos
          setTimeout(() => {
            forcePlayedSongStyles();
          }, 100);

        } catch (error) {
          console.error('Error actualizando UI de canciones reproducidas:', error);
        }
      }

      // Suscripción a orden manual compartido por día (Firestore/localStorage)
      function subscribeManualOrderForDay(day) {
        try {
          if (unsubscribeManualOrder) {
            unsubscribeManualOrder();
            unsubscribeManualOrder = null;
          }

          // Fallback inmediato a localStorage
          try {
            const localOrder = JSON.parse(localStorage.getItem(`manualOrder:${day}`) || '[]');
            if (Array.isArray(localOrder)) {
              currentManualOrder = localOrder;
            }
          } catch (_) { }

          try { reorderCurrentDayItemsWithManualOrder(day); } catch (_) { }

          if (!window.db) {
            return;
          }

          unsubscribeManualOrder = window.db.collection('manualOrders').doc(day)
            .onSnapshot((doc) => {
              const data = doc.data();
              const remoteOrder = Array.isArray(data?.order) ? data.order : [];
              currentManualOrder = remoteOrder;
              try { localStorage.setItem(`manualOrder:${day}`, JSON.stringify(currentManualOrder)); } catch (_) { }
              reorderCurrentDayItemsWithManualOrder(day);
            }, (err) => {
              console.error('Error suscripción orden manual:', err);
            });
        } catch (e) {
          console.error('Error al suscribir orden manual:', e);
        }
      }

      // Reordenar elementos actuales usando el orden manual compartido
      function reorderCurrentDayItemsWithManualOrder(day) {
        try {
          const currentDay = document.getElementById('day-select')?.value;
          if (currentDay !== day) return;
          if (!isManualSortMode()) return;
          const ordered = applyDisplayOrder(currentDayItems);
          currentDayItems = ordered;
          window.__dayItems = ordered;
          renderSolicitudes(ordered);
        } catch (e) {
          console.error('Error reordenando items con orden manual:', e);
          if (!isManualSortMode()) return;
          const ordered = applyDisplayOrder(currentDayItems);
          currentDayItems = ordered;
          window.__dayItems = ordered;
          renderSolicitudes(ordered);
        }
      }

      async function renderAllUsersSelect() {
        const allUsersSelect = document.getElementById('all-users-select');
        const allUsersSelectDonador = document.getElementById('all-users-select-donador');
        // Si no existen los elementos en el DOM, no hacer nada
        if (!allUsersSelect) return;

        const userMap = new Map();
        const addUser = (rawName) => {
          const u = String(rawName || '').trim();
          if (!u) return;
          const key = u.toLowerCase();
          // Estrategia: si no existe, lo agregamos.
          // Si existe, podríamos reemplazar si el nuevo tiene mejor capitalización, 
          // pero por simplicidad y estabilidad, nos quedamos con el primero (o el último).
          if (!userMap.has(key)) {
            userMap.set(key, u);
          }
        };

        try {
          const items = Array.isArray(window.__dayItems) ? window.__dayItems : [];
          items.forEach(it => addUser(it?.usuario));
        } catch (_) { }

        try {
          const all = await getAllCombinedSolicitudes();
          (all || []).forEach(s => addUser(s?.usuario));
        } catch (_) { }

        try {
          const byDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');
          Object.values(byDay).forEach(arr => (arr || []).forEach(it => addUser(it.usuario)));
        } catch (error) { }

        try {
          const cached = JSON.parse(localStorage.getItem('knownUsers') || '[]') || [];
          cached.forEach(name => addUser(name));
        } catch (_) { }

        try {
          const dbRef = window.db || db;
          if (dbRef) {
            const statsSnap = await dbRef.collection('userStats').get();
            statsSnap.forEach(doc => { if (doc.id) addUser(doc.id); });
          }
        } catch (_) { }

        try {
          const dbRef = window.db || db;
          if (dbRef) {
            const usersSnap = await dbRef.collection('users').get();
            usersSnap.forEach(doc => {
              const d = doc.data() || {};
              if (d.name) addUser(d.name);
            });
          }
        } catch (_) { }

        const list = Array.from(userMap.values()).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        try { localStorage.setItem('knownUsers', JSON.stringify(list)); } catch (_) { }

        // Función helper para llenar selects
        const fillSelect = (el) => {
          if (!el) return;
          const currentVal = el.value; // Preservar valor si ya tenía algo
          el.innerHTML = '<option value="">Selecciona un usuario</option>';
          list.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            el.appendChild(opt);
          });
          if (currentVal && list.includes(currentVal)) {
            el.value = currentVal;
          }
        };

        fillSelect(allUsersSelect);
        fillSelect(document.getElementById('all-users-select-z0'));
        fillSelect(document.getElementById('all-users-select-donador'));
        fillSelect(document.getElementById('all-users-select-z0-fan'));
        fillSelect(document.getElementById('all-users-select-z0-platino'));
        fillSelect(document.getElementById('all-users-select-superfan'));
      }
      window.renderAllUsersSelect = renderAllUsersSelect;

      vipAddBtn?.addEventListener('click', async () => {
        const name = allUsersSelect.value.trim();
        if (!name) {
          alert('Selecciona un usuario del listado.');
          return;
        }
        try {
          await db.collection('vipUsers').doc(name).set({
            name,
            activatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.error('Error al agregar VIP:', err);
          alert('No se pudo agregar el usuario a VIP. Revisa reglas/permisos.');
        }
      });

      const superfanAddBtn = document.getElementById('superfan-add');
      superfanAddBtn?.addEventListener('click', async () => {
        const sel = document.getElementById('all-users-select-superfan');
        const name = sel?.value.trim();
        if (!name) {
          alert('Selecciona un usuario del listado.');
          return;
        }
        try {
          await db.collection('superfanUsers').doc(name).set({ name }, { merge: true });
        } catch (err) {
          console.error('Error al agregar Superfan:', err);
          alert('No se pudo agregar el usuario a Superfan. Revisa reglas/permisos.');
        }
      });

      const z0VipAddBtn = document.getElementById('z0-vip-add');
      const z0FanAddBtn = document.getElementById('z0-fan-add');
      const z0PlatinoAddBtn = document.getElementById('z0-platino-add');
      z0VipAddBtn?.addEventListener('click', async () => {
        const allUsersSelectZ0 = document.getElementById('all-users-select-z0');
        const name = allUsersSelectZ0?.value.trim();
        if (!name) {
          alert('Selecciona un usuario del listado.');
          return;
        }
        try {
          await db.collection('z0VipUsers').doc(name).set({ name }, { merge: true });
        } catch (err) {
          console.error('Error al agregar Z0-VIP:', err);
          alert('No se pudo agregar el usuario a Z0-VIP. Revisa reglas/permisos.');
        }
      });

      donadorAddBtn?.addEventListener('click', async () => {
        const name = allUsersSelectDonador?.value.trim();
        if (!name) {
          alert('Selecciona un usuario del listado.');
          return;
        }

        // Calcular fecha de expiración (mañana a las 23:59:59)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59, 59, 999);
        const expiresAt = tomorrow.toISOString();

        try {
          await db.collection('donadorUsers').doc(name).set({
            name,
            expiresAt,
            createdAt: new Date().toISOString()
          }, { merge: true });

          // Limpiar selección
          allUsersSelectDonador.value = '';

        } catch (err) {
          console.error('Error al agregar Donador:', err);
          alert('No se pudo agregar el usuario como Donador. Revisa reglas/permisos.');
        }
      });

      z0FanAddBtn?.addEventListener('click', async () => {
        const sel = document.getElementById('all-users-select-z0-fan');
        const name = sel?.value.trim();
        if (!name) { alert('Selecciona un usuario del listado.'); return; }
        try { await db.collection('z0FanUsers').doc(name).set({ name }, { merge: true }); sel.value = ''; } catch (err) { console.error('Error z0-Fan:', err); alert('No se pudo agregar z0-Fan.'); }
      });

      z0PlatinoAddBtn?.addEventListener('click', async () => {
        const sel = document.getElementById('all-users-select-z0-platino');
        const name = sel?.value.trim();
        if (!name) { alert('Selecciona un usuario del listado.'); return; }
        try { await db.collection('z0PlatinumUsers').doc(name).set({ name }, { merge: true }); sel.value = ''; } catch (err) { console.error('Error z0-Platino:', err); alert('No se pudo agregar z0-Platino.'); }
      });

      vipListEl?.addEventListener('click', (e) => {
        const btn = e.target.closest('.remove-btn');
        if (!btn) return;
        const user = btn.getAttribute('data-user');
        if (!user) return;

        pendingVipRemoveUser = user;
        pendingVipRemoveType = 'vip';
        vipRemoveUserSpan.textContent = user;
        vipRemoveModal.hidden = false;
      });

      const superfanListEl = document.getElementById('superfan-list');
      superfanListEl?.addEventListener('click', (e) => {
        const btn = e.target.closest('.remove-btn');
        if (!btn) return;
        const user = btn.getAttribute('data-user');
        const type = btn.getAttribute('data-type');
        if (!user) return;
        pendingVipRemoveUser = user;
        pendingVipRemoveType = type || 'superfan';
        vipRemoveUserSpan.textContent = user;
        vipRemoveModal.hidden = false;
      });

      const z0VipListEl = document.getElementById('z0-vip-list');
      const z0FanListEl = document.getElementById('z0-fan-list');
      const z0PlatinoListEl = document.getElementById('z0-platino-list');
      z0VipListEl?.addEventListener('click', (e) => {
        const btn = e.target.closest('.remove-btn');
        if (!btn) return;
        const user = btn.getAttribute('data-user');
        const type = btn.getAttribute('data-type');
        if (!user) return;

        pendingVipRemoveUser = user;
        pendingVipRemoveType = type || 'z0';
        vipRemoveUserSpan.textContent = user;
        vipRemoveModal.hidden = false;
      });

      donadorListEl?.addEventListener('click', (e) => {
        const btn = e.target.closest('.remove-btn');
        if (!btn) return;
        const user = btn.getAttribute('data-user');
        const type = btn.getAttribute('data-type');
        if (!user) return;

        pendingVipRemoveUser = user;
        pendingVipRemoveType = type || 'donador';
        vipRemoveUserSpan.textContent = user;
        vipRemoveModal.hidden = false;
      });

      z0FanListEl?.addEventListener('click', (e) => {
        const btn = e.target.closest('.remove-btn');
        if (!btn) return;
        const user = btn.getAttribute('data-user');
        const type = btn.getAttribute('data-type');
        if (!user) return;
        pendingVipRemoveUser = user;
        pendingVipRemoveType = type || 'z0-fan';
        vipRemoveUserSpan.textContent = user;
        vipRemoveModal.hidden = false;
      });

      z0PlatinoListEl?.addEventListener('click', (e) => {
        const btn = e.target.closest('.remove-btn');
        if (!btn) return;
        const user = btn.getAttribute('data-user');
        const type = btn.getAttribute('data-type');
        if (!user) return;
        pendingVipRemoveUser = user;
        pendingVipRemoveType = type || 'z0-platino';
        vipRemoveUserSpan.textContent = user;
        vipRemoveModal.hidden = false;
      });

      vipRemoveCancelBtn?.addEventListener('click', () => {
        pendingVipRemoveUser = null;
        pendingVipRemoveType = 'vip';
        vipRemoveModal.hidden = true;
      });

      vipRemoveConfirmBtn?.addEventListener('click', async () => {
        if (!pendingVipRemoveUser) return;
        try {
          let collection = 'vipUsers';
          if (pendingVipRemoveType === 'superfan') {
            collection = 'superfanUsers';
          } else if (pendingVipRemoveType === 'z0') {
            collection = 'z0VipUsers';
          } else if (pendingVipRemoveType === 'donador') {
            collection = 'donadorUsers';
          } else if (pendingVipRemoveType === 'z0-fan') {
            collection = 'z0FanUsers';
          } else if (pendingVipRemoveType === 'z0-platino') {
            collection = 'z0PlatinumUsers';
          }
          await db.collection(collection).doc(pendingVipRemoveUser).delete();
        } catch (err) {
          console.error('Error al quitar insignia:', err);
          alert('No se pudo quitar la insignia. Revisa reglas/permisos.');
        } finally {
          pendingVipRemoveUser = null;
          pendingVipRemoveType = 'vip';
          vipRemoveModal.hidden = true;
        }
      });

      const wipeAllModal = document.getElementById('wipe-all-modal');
      const wipeAllDaySpan = document.getElementById('wipe-all-day');
      const wipeAllCancelBtn = document.getElementById('wipe-all-cancel');
      const wipeAllConfirmBtn = document.getElementById('wipe-all-confirm');
      const recalculateUsersBtn = document.getElementById('recalculate-users');
      const recalcReportBox = document.getElementById('recalc-report-box');
      const recalcReportText = document.getElementById('recalc-report-text');
      const diagnoseDataBtn = document.getElementById('diagnose-data-btn');
      
      const forceUpdateBtn = document.getElementById('force-update-btn');
      forceUpdateBtn?.addEventListener('click', async () => {
        if (!window.db) {
          alert("Error: Base de datos no conectada.");
          return;
        }
        if (!confirm("¿Seguro que deseas forzar el cartel de actualización a todos los usuarios conectados AHORA MISMO?")) return;
        try {
          const forceBtn = document.getElementById('force-update-btn');
          forceBtn.disabled = true;
          forceBtn.textContent = "Lanzando...";
          await window.db.collection('systemConfig').doc('appVersion').set({
            timestamp: Date.now(),
            version: 'manual_push_' + Date.now()
          }, { merge: true });
          alert("¡Señal enviada a todos los usuarios!");
          forceBtn.textContent = "Lanzar Actualización Global";
          forceBtn.disabled = false;
        } catch (err) {
          console.error(err);
          alert("Error al enviar la actualización: " + err.message);
        }
      });

      wipeAllBtn?.addEventListener('click', () => {
        if (!daySelect.value) return;
        wipeAllDaySpan.textContent = daySelect.value;
        wipeAllModal.hidden = false;
      });

      wipeAllCancelBtn?.addEventListener('click', () => {
        wipeAllModal.hidden = true;
      });

      wipeAllConfirmBtn?.addEventListener('click', async () => {
        const day = daySelect.value;
        if (!day) {
          wipeAllModal.hidden = true;
          return;
        }

        wipeAllBtn.disabled = true;

        try {
          const snap = await db.collection('solicitudes').where('day', '==', day).get();
          const docs = snap.docs;

          const chunkSize = 500;
          for (let i = 0; i < docs.length; i += chunkSize) {
            const batch = db.batch();
            const chunk = docs.slice(i, i + chunkSize);
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
          }

          const byDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');
          if (byDay && byDay[day]) {
            delete byDay[day];
            localStorage.setItem('solicitudes_by_day', JSON.stringify(byDay));
          }

          if (daySelect.value === day) {
            subscribeSolicitudesForDay(day);
          }
        } catch (err) {
          console.error('Error al borrar solicitudes:', err);
          alert('Ocurrió un error al borrar las solicitudes. Verifica reglas y vuelve a intentar.');
        } finally {
          wipeAllBtn.disabled = false;
          wipeAllModal.hidden = true;
        }
      });

      // Event listener para recálculo de usuarios
      recalculateUsersBtn?.addEventListener('click', async () => {
        const confirmed = window.confirm('¿Confirmas que quieres recalcular todos los usuarios? Esto reconstruirá puntos, likes, regalos, rachas, logros y ajustes.');

        if (confirmed) {
          recalculateUsersBtn.disabled = true;
          const btnText = recalculateUsersBtn.querySelector('.btn-text');
          if (btnText) btnText.textContent = 'Recalculando...';
          if (recalcReportBox && recalcReportText) {
            recalcReportBox.hidden = false;
            recalcReportText.textContent = 'Procesando recálculo masivo... esto puede tardar un poco.';
          }

          try {
            if (typeof window.runFullAdminPointsRebuild === 'function') {
              await window.runFullAdminPointsRebuild();
            } else {
              await recalculateAllUsers();
            }
          } catch (err) {
            if (recalcReportBox && recalcReportText) {
              recalcReportBox.hidden = false;
              recalcReportText.textContent = `Error durante el recálculo: ${err && err.message ? err.message : String(err)}`;
            }
            throw err;
          } finally {
            recalculateUsersBtn.disabled = false;
            if (btnText) btnText.textContent = 'Recalcular Puntos';
          }
        }
      });

      /* 
         BLOQUE ELIMINADO: Listeners de herramientas de diagnóstico y prueba eliminados por limpieza.
         - diagnoseDataBtn listener removed
         - test-user-switch-btn listener removed
         - debug-current-user-btn listener removed
      */

      daySelect?.addEventListener('change', () => {
        if (daySelect.value) {
          try { subscribeManualOrderForDay(daySelect.value); } catch (e) { console.warn('Falló subscribeManualOrderForDay:', e); }
          try { subscribeSolicitudesForDay(daySelect.value); } catch (e) { console.warn('Falló subscribeSolicitudesForDay:', e); }
          try { subscribePlayedSongs(daySelect.value); } catch (e) { console.warn('Falló subscribePlayedSongs:', e); }
        }
      });
      vipOnly?.addEventListener('change', () => {
        if (daySelect.value) subscribeSolicitudesForDay(daySelect.value);
      });
      sortSelect?.addEventListener('change', () => {
        try { localStorage.setItem(SORT_MODE_KEY, String(sortSelect.value || '').trim()); } catch (_) { }
        try {
          const m = String(sortSelect.value || '').trim();
          const qm = allowedSortModes.has(m) ? m : 'default';
          window.__QUEUE_MODE__ = qm;
          try { localStorage.setItem('queueMode', qm); } catch (_) { }
          const isAdmin = (() => { try { return localStorage.getItem('isAdminMode') === 'true' || localStorage.getItem('isAdminAuthenticated') === 'true'; } catch (_) { return false; } })();
          if (isAdmin && typeof db !== 'undefined' && db) {
            db.collection('system').doc('status').set({
              queueMode: qm,
              lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
              forcedBy: 'admin'
            }, { merge: true }).catch(() => { });
          }
        } catch (_) { }
        if (daySelect.value) subscribeSolicitudesForDay(daySelect.value);
      });

      (async function init() {
        console.log('🚀 Iniciando aplicación...');
        try {
          const saved = String(localStorage.getItem(SORT_MODE_KEY) || '').trim();
          const savedQ = String(localStorage.getItem('queueMode') || '').trim();
          const initial = allowedSortModes.has(savedQ) ? savedQ : (allowedSortModes.has(saved) ? saved : 'default');
          if (sortSelect) sortSelect.value = initial;
          localStorage.setItem(SORT_MODE_KEY, initial);
        } catch (_) { }
        await loadDays();
        // Mostrar estado inicial aunque no haya datos todavía
        try { renderSolicitudes([]); } catch (_) { }
        console.log('📅 Días cargados, iniciando suscripciones...');
        subscribeSuperfanUsers();
        subscribeVipUsers();
        subscribeZ0VipUsers();
        subscribeDonadorUsers();
        subscribeZ0FanUsers();
        subscribeZ0PlatinoUsers();
        try {
          const rawSel = localStorage.getItem('selectedBadges');
          if (rawSel) {
            const m = JSON.parse(rawSel);
            if (m && typeof m === 'object') {
              window.selectedBadgeMap = m;
              try { if (typeof applySelectedBadgeToAll === 'function') applySelectedBadgeToAll(); } catch (_) { }
            }
          }
        } catch (_) { }
        try {
          const localPlayedMapDays = Object.keys(JSON.parse(localStorage.getItem('playedSongs') || '{}') || {});
          localPlayedMapDays.forEach(d => { if (d) daysSet.add(d); });
        } catch (_) { }
        try { if (typeof subscribeSelectedBadges === 'function') subscribeSelectedBadges(); } catch (_) { }
        try { if (shouldShowStatsTicker()) { ensureStatsTicker(); startStatsTicker(); } } catch (_) { }
        console.log('✅ Suscripciones iniciadas');
        await renderAllUsersSelect();
        if (daySelect.value) {
          subscribeManualOrderForDay(daySelect.value);
          subscribeSolicitudesForDay(daySelect.value);
          subscribePlayedSongs(daySelect.value);
        }
      })();
    })();

function shouldShowStatsTicker() {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('showTicker') === '0') return false;
        if (params.get('showTicker') === '1') return true;
        return true;
      } catch (_) { return false; }
    }
    function ensureStatsTicker() {
      const el = document.getElementById('stats-ticker');
      if (!el) return;
      const show = shouldShowStatsTicker();
      el.hidden = !show;
      if (show) {
        document.body.classList.add('has-stats-ticker');
      } else {
        document.body.classList.remove('has-stats-ticker');
      }
    }

    function initListStatsTickerConfig() {
      const STORAGE_KEY = 'list_stats_ticker_settings';
      const DOC_ID = 'global_list_stats_ticker_config';

      function n(v, d) {
        const x = Number(v);
        return Number.isFinite(x) ? x : d;
      }

      function clamp(v, min, max, d) {
        const x = n(v, d);
        return Math.max(min, Math.min(max, x));
      }

      const defaults = {
        height: 36,
        fontSize: 14,
        speed: 30,
        paddingX: 12,
        opacityDark: 35,
        opacityLight: 60,
        blur: 6
      };

      function normalize(input) {
        const s = input || {};
        return {
          height: clamp(s.height, 24, 120, defaults.height),
          fontSize: clamp(s.fontSize, 10, 26, defaults.fontSize),
          speed: clamp(s.speed, 10, 180, defaults.speed),
          paddingX: clamp(s.paddingX, 0, 40, defaults.paddingX),
          opacityDark: clamp(s.opacityDark, 0, 100, defaults.opacityDark),
          opacityLight: clamp(s.opacityLight, 0, 100, defaults.opacityLight),
          blur: clamp(s.blur, 0, 24, defaults.blur)
        };
      }

      function apply(s) {
        const d = document.documentElement;
        d.style.setProperty('--list-ticker-height', `${s.height}px`);
        d.style.setProperty('--list-ticker-font-size', `${s.fontSize}px`);
        d.style.setProperty('--list-ticker-speed', `${s.speed}s`);
        d.style.setProperty('--list-ticker-padding-x', `${s.paddingX}px`);
        d.style.setProperty('--list-ticker-alpha-dark', String(s.opacityDark / 100));
        d.style.setProperty('--list-ticker-alpha-light', String(s.opacityLight / 100));
        d.style.setProperty('--list-ticker-blur', `${s.blur}px`);
      }

      function loadLocal() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          return normalize(parsed);
        } catch (_) { return null; }
      }

      function saveLocal(s) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) { }
      }

      function getDb() {
        try { return window.db || (typeof db !== 'undefined' ? db : null); } catch (_) { return null; }
      }

      let current = normalize({ ...defaults, ...(loadLocal() || {}) });
      apply(current);

      function fillModalValues(s) {
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
        setVal('stc-height', s.height);
        setVal('stc-fontSize', s.fontSize);
        setVal('stc-speed', s.speed);
        setVal('stc-paddingX', s.paddingX);
        setVal('stc-opacityDark', s.opacityDark);
        setVal('stc-opacityLight', s.opacityLight);
        setVal('stc-blur', s.blur);
      }

      function readModalValues() {
        return normalize({
          height: n(document.getElementById('stc-height')?.value, defaults.height),
          fontSize: n(document.getElementById('stc-fontSize')?.value, defaults.fontSize),
          speed: n(document.getElementById('stc-speed')?.value, defaults.speed),
          paddingX: n(document.getElementById('stc-paddingX')?.value, defaults.paddingX),
          opacityDark: n(document.getElementById('stc-opacityDark')?.value, defaults.opacityDark),
          opacityLight: n(document.getElementById('stc-opacityLight')?.value, defaults.opacityLight),
          blur: n(document.getElementById('stc-blur')?.value, defaults.blur),
        });
      }

      function openModal() {
        const modal = document.getElementById('stats-ticker-config-modal');
        if (!modal) return;
        fillModalValues(current);
        modal.hidden = false;
      }

      function closeModal() {
        const modal = document.getElementById('stats-ticker-config-modal');
        if (!modal) return;
        modal.hidden = true;
      }

      const cfgBtn = document.getElementById('stats-ticker-config-btn');
      cfgBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openModal();
      });

      document.querySelector('#stats-ticker-config-modal .modal-close-btn')?.addEventListener('click', closeModal);
      document.getElementById('stc-close')?.addEventListener('click', closeModal);
      document.getElementById('stc-reset')?.addEventListener('click', () => {
        current = normalize(defaults);
        apply(current);
        saveLocal(current);
        fillModalValues(current);
      });
      document.getElementById('stc-save')?.addEventListener('click', async () => {
        const next = readModalValues();
        current = next;
        apply(current);
        saveLocal(current);
        const dbase = getDb();
        if (dbase) {
          try { await dbase.collection('userSettings').doc(DOC_ID).set(current, { merge: true }); } catch (_) { }
        }
      });

      ['stc-height', 'stc-fontSize', 'stc-speed', 'stc-paddingX', 'stc-opacityDark', 'stc-opacityLight', 'stc-blur'].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', () => {
          const next = readModalValues();
          current = next;
          apply(current);
          saveLocal(current);
        });
      });

      const dbase = getDb();
      if (dbase) {
        try {
          dbase.collection('userSettings').doc(DOC_ID).onSnapshot((doc) => {
            if (!doc || !doc.exists) return;
            const data = doc.data() || {};
            const remote = normalize(data);
            current = normalize({ ...current, ...remote });
            apply(current);
            saveLocal(current);
          }, () => { });
        } catch (_) { }
      }

      document.addEventListener('click', (e) => {
        const modal = document.getElementById('stats-ticker-config-modal');
        if (!modal || modal.hidden) return;
        const inner = modal.querySelector('.modal');
        if (!inner) return;
        if (!inner.contains(e.target)) closeModal();
      });
    }

    (function () {
      if (window.__listStatsTickerConfigInit) return;
      window.__listStatsTickerConfigInit = true;
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { try { initListStatsTickerConfig(); } catch (_) { } });
      } else {
        try { initListStatsTickerConfig(); } catch (_) { }
      }
    })();

    function getLocalPlayedMapForTicker() {
      try { return JSON.parse(localStorage.getItem('playedSongs') || '{}'); } catch (_) { return {}; }
    }

    function getLocalSkippedMapForTicker() {
      try { return JSON.parse(localStorage.getItem('skippedSongs') || '{}'); } catch (_) { return {}; }
    }

    function normalizeKeyTextForTicker(v) {
      const raw = String(v || '').trim();
      if (!raw) return '';

      // FILTRO DE BASURA: Si contiene links de YouTube o URLs, no es un dato válido
      const low = raw.toLowerCase();

      // UNIFICACIÓN DE ARTISTAS (Aliases comunes)
      if (low === '5sos' || low === '5 second of summer' || low === '5 seconds of summer') {
        return '5 seconds of summer';
      }

      if (low.includes('http://') || low.includes('https://') || low.includes('www.') || low.includes('youtu.be')) return '';
      if (low.length > 100 || low.length <= 1) return '';
      if (['n/d', 'undefined', 'null', 'unknown'].includes(low)) return '';

      // Intentar usar la normalización con alias si está disponible
      if (typeof normalizeUserKey === 'function') {
        return normalizeUserKey(v);
      }
      try {
        return raw
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ')
          .toLowerCase();
      } catch (_) {
        return raw.toLowerCase();
      }
    }

    function normalizeUserForTicker(u) {
      return normalizeKeyTextForTicker(u);
    }

    function isTestRequestForTicker(it) {
      try {
        if (typeof window.isTestRequestForStats === 'function' && window.isTestRequestForStats(it)) return true;
      } catch (_) { }
      const u = normalizeKeyTextForTicker(it?.usuario);
      const s = normalizeKeyTextForTicker(it?.cancion);
      const a = normalizeKeyTextForTicker(it?.artista);

      if (!u || u === 'prueba' || u === 'test' || u.startsWith('prueba')) return true;
      if (!s || s === 'prueba' || s === 'gasolina' || s.includes('bizarrap')) return true;
      if (!a || a === 'prueba' || a === 'daddy yankee') return true;

      if (it && (it.isSimulation === true || it.isTest === true)) return true;
      if (it && String(it.source || '').toLowerCase() === 'tiktoktest') return true;
      return false;
    }

    function getItemTimeMsForTicker(it) {
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
        const h = String(it.hora || '').trim();
        const day = String(it.day || document.getElementById('day-select')?.value || '').trim();
        if (day && /^\d{4}-\d{2}-\d{2}$/.test(day) && /^\d{2}:\d{2}$/.test(h)) {
          const t = new Date(`${day}T${h}:00`).getTime();
          if (!Number.isNaN(t)) return t;
        }
      } catch (_) { }
      return 0;
    }

    function getLatestNonTestItemForTicker(items) {
      if (!Array.isArray(items) || !items.length) return null;
      let best = null;
      let bestTime = -Infinity;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (isTestRequestForTicker(it)) continue;
        const t = getItemTimeMsForTicker(it);
        if (t > bestTime) { bestTime = t; best = it; }
      }
      return best;
    }

    function computeDayStatsForTicker(items) {
      const songCount = {}; const artistCount = {}; const userCount = {}; const genreCount = {}; const artistOriginal = {}; const userOriginal = {};
      let totalCount = 0;

      // 1. Contar TODOS los elementos del día (items ya incluye pendientes y reproducidas)
      for (let i = 0; i < (items || []).length; i++) {
        const it = items[i] || {};
        if (isTestRequestForTicker(it)) continue;
        processItemForStats(it, songCount, artistCount, userCount, genreCount, artistOriginal, userOriginal);
        totalCount++;
      }

      // 2. Contar elementos ya reproducidos del día actual (playedSongs) solo para la métrica "Reproducidas"
      const day = String(document.getElementById('day-select')?.value || '').trim();
      const playedMap = getLocalPlayedMapForTicker();
      const playedTodayIds = Array.isArray(playedMap[day]) ? playedMap[day] : [];

      function processItemForStats(it, songCount, artistCount, userCount, genreCount, artistOriginal, userOriginal) {
        const uNorm = normalizeUserForTicker(it.usuario);
        const song = normalizeKeyTextForTicker(it.cancion);
        const artist = normalizeKeyTextForTicker(it.artista);
        const user = uNorm;
        // Compatibilidad: 'genre' (nuevo) o 'genero' (posible antiguo)
        const genre = normalizeKeyTextForTicker(it.genre || it.genero);

        // Filtros de calidad estrictos
        if (song && song.length > 1 && song !== 'undefined' && song !== 'null') songCount[song] = (songCount[song] || 0) + 1;

        if (artist && artist.length > 1 && artist !== 'undefined' && artist !== 'null') {
          artistCount[artist] = (artistCount[artist] || 0) + 1;
          if (!artistOriginal[artist]) artistOriginal[artist] = String(it.artista || '').trim();
        }

        if (user && user.length > 1 && user !== 'undefined' && user !== 'null') {
          userCount[user] = (userCount[user] || 0) + 1;
          if (!userOriginal[user]) userOriginal[user] = String(it.usuario || '').trim();
        }

        if (genre) genreCount[genre] = (genreCount[genre] || 0) + 1;
      }

      function top(map) { let k = ''; let v = 0; for (const key in map) { const val = map[key]; if (val > v) { v = val; k = key; } else if (val === v && (!k || key.localeCompare(k) < 0)) { k = key; } } return k; }

      const played = getLocalPlayedMapForTicker();
      const skipped = getLocalSkippedMapForTicker();
      const playedArr = Array.isArray(played[day]) ? played[day] : [];
      const skippedArr = Array.isArray(skipped[day]) ? skipped[day] : [];
      const skippedSet = new Set(skippedArr.map(x => String(x || '')));
      const playedCount = playedArr.filter(x => !skippedSet.has(String(x || ''))).length;

      // Ajustar total para incluir reproducidas si no estaban
      // (Aproximación simple: items.length + playedCount)
      // O mejor, confiar en los contadores agregados

      let vipRequests = 0; let z0VipRequests = 0;
      for (let i = 0; i < (items || []).length; i++) {
        const it = items[i] || {};
        if (isTestRequestForTicker(it)) continue;
        const unameLc = normalizeUserForTicker(it.usuario);
        if (window.vipSet && window.vipSet.has(unameLc)) vipRequests++;
        if (window.z0VipSet && window.z0VipSet.has(unameLc)) z0VipRequests++;
      }

      const ts = top(songCount);
      const ta = top(artistCount);
      const tg = top(genreCount);

      const artistTop3 = Object.keys(artistCount)
        .map(k => ({ k, c: artistCount[k], o: artistOriginal[k] || k }))
        .sort((a, b) => { var d = b.c - a.c; if (d !== 0) return d; return a.k.localeCompare(b.k); })
        .slice(0, 3)
        .map(it => `${it.o} (${it.c})`);

      const usersTop3 = Object.keys(userCount)
        .map(k => ({ k, c: userCount[k], o: userOriginal[k] || k }))
        .sort((a, b) => { var d = b.c - a.c; if (d !== 0) return d; return a.k.localeCompare(b.k); })
        .slice(0, 3)
        .map(it => `${it.o} (${it.c})`);

      return {
        topSong: ts,
        topSongCount: ts ? (songCount[ts] || 0) : 0,
        topArtist: ta,
        topArtistCount: ta ? (artistCount[ta] || 0) : 0,
        topArtists3: artistTop3,
        topUsers3: usersTop3,
        topGenre: tg,
        total: totalCount, // FIX: items ya incluye todas las solicitudes del día
        played: playedCount,
        vip: vipRequests,
        z0vip: z0VipRequests
      };
    }

    (function () {
      try {
        const cacheVersion = 'statsTicker-v3';
        const cacheKey = '__cache_version_stats_ticker';
        const qs = new URLSearchParams(location.search);
        const force = qs.get('purge') === '1' || qs.get('purgeCache') === '1' || qs.get('reset') === '1';
        const current = localStorage.getItem(cacheKey);
        if (force || current !== cacheVersion) {
          localStorage.removeItem('solicitudes');
          localStorage.removeItem('solicitudes_by_day');
          localStorage.setItem(cacheKey, cacheVersion);
          if (force) {
            try {
              qs.delete('purge'); qs.delete('purgeCache'); qs.delete('reset');
              const newUrl = location.pathname + (qs.toString() ? `?${qs.toString()}` : '') + location.hash;
              history.replaceState(null, '', newUrl);
            } catch (_) { }
            try { location.reload(); } catch (_) { }
          }
        }
      } catch (_) { }
    })();

    function computeGlobalStats() {
      let solicitudes = [];
      try { solicitudes = JSON.parse(localStorage.getItem('solicitudes') || '[]') || []; } catch (_) { solicitudes = []; }
      try {
        const byDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}') || {};
        Object.values(byDay).forEach(arr => {
          (arr || []).forEach(it => { if (it) solicitudes.push(it); });
        });
      } catch (_) { }

      const unique = new Map();
      const getTsMs = (s) => {
        try {
          if (window.getItemTimeMs) return window.getItemTimeMs(s);
          if (s && s.ts && typeof s.ts.toMillis === 'function') return s.ts.toMillis();
          if (s && typeof s.ts === 'number') return s.ts;
          if (s && s.time && typeof s.time === 'number') return s.time;
          const t = new Date(s?.ts || s?.time || 0).getTime();
          return Number.isFinite(t) ? t : 0;
        } catch (_) { return 0; }
      };
      const keyOf = (s) => {
        const u = normalizeKeyTextForTicker(s?.usuario);
        const c = normalizeKeyTextForTicker(s?.cancion);
        const a = normalizeKeyTextForTicker(s?.artista);
        const ts = String(getTsMs(s) || '');
        return `${u}|${c}|${a}|${ts}`;
      };
      for (let i = 0; i < solicitudes.length; i++) {
        const s = solicitudes[i] || {};
        const k = keyOf(s);
        if (!k) continue;
        if (!unique.has(k)) unique.set(k, s);
      }
      solicitudes = Array.from(unique.values());
      const songCount = {}; const artistCount = {}; const userCount = {}; const genreCount = {}; const artistOriginal = {}; const userOriginal = {};
      for (let i = 0; i < solicitudes.length; i++) {
        const s = solicitudes[i] || {};
        if (window.isTestRequestForStats ? window.isTestRequestForStats(s) : (String(s.usuario || '').trim().toLowerCase() === 'prueba')) continue;
        const uNorm = normalizeKeyTextForTicker(s.usuario);
        const song = normalizeKeyTextForTicker(s.cancion);
        const artist = normalizeKeyTextForTicker(s.artista);
        const user = uNorm;
        const genre = normalizeKeyTextForTicker(s.genre || s.genero);
        if (song) songCount[song] = (songCount[song] || 0) + 1;
        if (artist) { artistCount[artist] = (artistCount[artist] || 0) + 1; if (!artistOriginal[artist]) artistOriginal[artist] = String(s.artista || '').trim(); }
        if (user) { userCount[user] = (userCount[user] || 0) + 1; if (!userOriginal[user]) userOriginal[user] = String(s.usuario || '').trim(); }
        if (genre) genreCount[genre] = (genreCount[genre] || 0) + 1;
      }
      function top(map) { let k = ''; let v = 0; for (const key in map) { const val = map[key]; if (val > v) { v = val; k = key; } else if (val === v && (!k || key.localeCompare(k) < 0)) { k = key; } } return k; }
      const ta = top(artistCount);
      const artistTop3 = Object.keys(artistCount)
        .map(k => ({ k, c: artistCount[k], o: artistOriginal[k] || k }))
        .sort((a, b) => { var d = b.c - a.c; if (d !== 0) return d; return a.k.localeCompare(b.k); })
        .slice(0, 3)
        .map(it => `${it.o} (${it.c})`);
      const usersTop3 = Object.keys(userCount)
        .map(k => ({ k, c: userCount[k], o: userOriginal[k] || k }))
        .sort((a, b) => { var d = b.c - a.c; if (d !== 0) return d; return a.k.localeCompare(b.k); })
        .slice(0, 3)
        .map(it => `${it.o} (${it.c})`);
      const ts = top(songCount);
      const tg = top(genreCount);
      return {
        topSong: ts,
        topSongCount: ts ? (songCount[ts] || 0) : 0,
        topArtist: ta,
        topArtistCount: ta ? (artistCount[ta] || 0) : 0,
        topArtists3: artistTop3,
        topUser: top(userCount),
        topUsers3: usersTop3,
        topGenre: tg,
        topGenreCount: tg ? (genreCount[tg] || 0) : 0,
        total: Object.values(userCount).reduce((a, b) => a + b, 0)
      };
    }

    function updateStatsTicker() {
      const el = document.querySelector('#stats-ticker .ticker-content');
      if (!el) return;
      if (el.getAttribute('data-react-root') === 'true') return;
      function fmt(x) { return x && x.length ? x : 'N/D'; }
      const items = window.__allDayItems || window.__dayItems || []; // NUEVO: Usar items sin filtrar
      const g = window.__globalStats || { topSong: 'N/D', topSongCount: 0, topArtist: 'N/D', topArtistCount: 0, topArtists3: [], topUsers3: [], topPoints3: [], topGenre: 'N/D', topLiker: 'N/D', topLikerCount: 0, total: 0 };
      const top3Txt = Array.isArray(g.topArtists3) && g.topArtists3.length ? g.topArtists3.join(', ') : 'N/D';
      const usersTop3Txt = Array.isArray(g.topUsers3) && g.topUsers3.length ? g.topUsers3.join(', ') : 'N/D';

      let dayText = '';
      try {
        const daySel = String(document.getElementById('day-select')?.value || '').trim();
        const now = new Date();
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const dayLabel = daySel ? (daySel === todayKey ? 'HOY' : daySel) : 'HOY';
        const ds = computeDayStatsForTicker(items);
        const top3TxtDay = Array.isArray(ds.topArtists3) && ds.topArtists3.length ? ds.topArtists3.join(', ') : 'N/D';
        const usersTop3TxtDay = Array.isArray(ds.topUsers3) && ds.topUsers3.length ? ds.topUsers3.join(', ') : 'N/D';
        const latest = (typeof window.getLatestNonTestItem === 'function') ? window.getLatestNonTestItem(items) : getLatestNonTestItemForTicker(items);
        const latestTxt = latest ? (String(latest.cancion || '').trim() + (latest.artista ? ' — ' + String(latest.artista).trim() : '')) : 'N/D';
        dayText = '📅 <strong>' + dayLabel + '</strong>' +
          ' • <strong>🎵 Última canción solicitada:</strong> ' + fmt(latestTxt) +
          ' • <strong>🎵 Canción más pedida:</strong> ' + fmt(ds.topSong) + ' (' + (ds.topSongCount || 0) + ')' +
          ' • <strong>🎤 Artista más pedido:</strong> ' + fmt(ds.topArtist) + ' (' + (ds.topArtistCount || 0) + ')' +
          ' • <strong>🎹 Género Top:</strong> ' + fmt(ds.topGenre || 'N/D') + // Nuevo
          ' • <strong>▶️ Reproducidas:</strong> ' + (ds.played || 0) +
          ' • <strong>👥 Top 3 usuarios:</strong> ' + usersTop3TxtDay +
          ' • <strong>🎤 Top 3 artistas:</strong> ' + top3TxtDay +
          ' • <strong>❤️ Top Liker:</strong> ' + fmt(g.sessionTopLiker) + (g.sessionTopLikerCount ? ' (' + g.sessionTopLikerCount + ')' : '') +
          ' • <strong>📝 Solicitudes:</strong> ' + (ds.total || 0);
      } catch (_) { }

      let avgTxt = 'N/D';
      if (typeof window.__globalTotalSolicitudes === 'number' && typeof window.__globalDistinctUsers === 'number' && window.__globalDistinctUsers > 0) {
        avgTxt = (window.__globalTotalSolicitudes / window.__globalDistinctUsers).toFixed(1);
      }
      const globalText = '<strong>HISTORIA:</strong>' +
        ' • <strong>🎵 Canción más pedida:</strong> ' + fmt(g.topSong) + (typeof g.topSongCount === 'number' ? ' (' + g.topSongCount + ')' : '') +
        ' • <strong>🎤 Artista más pedido:</strong> ' + fmt(g.topArtist) + (typeof g.topArtistCount === 'number' ? ' (' + g.topArtistCount + ')' : '') +
        ' • <strong>👥 Top 3 usuarios:</strong> ' + usersTop3Txt +
        ' • <strong>🏆 Top Puntos:</strong> ' + (Array.isArray(g.topPoints3) && g.topPoints3.length ? g.topPoints3.join(', ') : 'N/D') +
        ' • <strong>🎤 Top 3 artistas:</strong> ' + top3Txt +
        ' • <strong>🎹 Género Top:</strong> ' + fmt(g.topGenre || 'N/D') +
        ' • <strong>❤️ Top Liker:</strong> ' + fmt(g.topLiker) + (g.topLikerCount ? ' (' + g.topLikerCount + ')' : '') +
        ' • <strong>📊 Total solicitudes:</strong> ' + (g.total || 0) +
        ' • <strong>📈 Promedio por usuario:</strong> ' + avgTxt;
      const sep2 = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
      el.innerHTML = (dayText ? (dayText + sep2) : '') + globalText;
    }

    function refreshStatsTicker() {
      updateStatsTicker();
      try { if (typeof updateModernWidgetPure === 'function') updateModernWidgetPure(); } catch (_) { }
    }
    window.refreshStatsTicker = refreshStatsTicker;

    function subscribeStatsTicker() {
      if (!window.db) { updateStatsTicker(); return; }
      if (window.__statsTickerUnsub) { try { window.__statsTickerUnsub(); } catch (_) { } }
      const dbRef = window.db;

      // FIX: Leer de 'globalStats/general' para consistencia entre usuarios
      const docRef = dbRef.collection('globalStats').doc('general');
      const setFromData = (data) => {
        window.__globalStats = {
          topSong: data.topSong || 'N/D',
          topSongCount: data.topSongCount || 0,
          topArtist: (data.topArtists && data.topArtists[0]) ? data.topArtists[0].split('(')[0].trim() : 'N/D',
          topArtistCount: (data.topArtists && data.topArtists[0]) ? parseInt(data.topArtists[0].match(/\((\d+)\)/)?.[1] || 0) : 0,
          topArtists3: data.topArtists || [],
          topUser: (data.topUsers && data.topUsers[0]) ? data.topUsers[0].split('(')[0].trim() : 'N/D',
          topUsers3: data.topUsers || [],
          topPoints3: data.topPoints3 || [],
          total: data.totalRequests || 0,
          topLiker: (data.topLiker || 'N/D'),
          topLikerCount: (data.topLikerCount || 0),
          sessionTopLiker: (data.sessionTopLiker || 'N/D'),
          sessionTopLikerCount: (data.sessionTopLikerCount || 0),
          topGenre: (data.topGenre || 'N/D'),
          topGenreCount: (data.topGenreCount || 0)
        };
        window.__globalGenreTop = data.topGenre || 'N/D';
        window.__globalTopPointsUsers = Array.isArray(data.topPoints3) ? data.topPoints3 : [];
        window.__globalDistinctUsers = Number(data.distinctUsers || 0) || (data.topUsers ? data.topUsers.length : 0);
        window.__globalTotalSolicitudes = data.totalRequests || 0;
      };
      const setUnavailable = () => {
        window.__globalStats = { topSong: 'N/D', topSongCount: 0, topArtist: 'N/D', topArtistCount: 0, topArtists3: [], topUsers3: [], topPoints3: [], topLiker: 'N/D', topLikerCount: 0, sessionTopLiker: 'N/D', sessionTopLikerCount: 0, total: 0 };
        window.__globalGenreTop = 'N/D';
        window.__globalTopPointsUsers = [];
        window.__globalDistinctUsers = 0;
        window.__globalTotalSolicitudes = 0;
      };

      try {
        docRef.get({ source: 'server' }).then((doc) => {
          if (doc && doc.exists) setFromData(doc.data() || {});
          else setUnavailable();
          refreshStatsTicker();
        }).catch(() => {
          setUnavailable();
          refreshStatsTicker();
        });
      } catch (_) {
        setUnavailable();
        refreshStatsTicker();
      }

      window.__statsTickerUnsub = docRef.onSnapshot({ includeMetadataChanges: true }, (doc) => {
        if (!doc || !doc.exists) return;
        if (doc.metadata && doc.metadata.fromCache) return;
        setFromData(doc.data() || {});
        refreshStatsTicker();
      }, () => {
        setUnavailable();
        refreshStatsTicker();
      });
    }

    function startStatsTicker() {
      refreshStatsTicker();
      if (window.__statsTickerInterval) clearInterval(window.__statsTickerInterval);
      window.__statsTickerInterval = setInterval(refreshStatsTicker, 60000);
      subscribeStatsTicker();
      try {
        const daySel = document.getElementById('day-select')?.value;
        if (!daySel) {
          const d = new Date();
          const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (typeof window.subscribeSolicitudesForDay === 'function') {
            window.subscribeSolicitudesForDay(todayKey);
          }
        }
      } catch (_) { }
    }
    try { ensureStatsTicker(); startStatsTicker(); } catch (_) { }
    // Variables globales del menú
    let menuBtn = document.getElementById('menu-btn');
    let menuDropdown = document.getElementById('menu-dropdown');

    // Funciones globales del menú
    function positionMenu() {
      if (!menuDropdown || !menuBtn) return;
      if (window.innerWidth > 768) {
        const btnRect = menuBtn.getBoundingClientRect();
        const padding = 8;
        const menuWidth = 220;
        const leftPosition = btnRect.right - menuWidth;
        let top = btnRect.bottom + padding;
        const finalLeft = Math.max(leftPosition, 10);
        const menuHeight = Math.min(menuDropdown.offsetHeight || 350, window.innerHeight - 16);
        if (top + menuHeight > window.innerHeight) {
          top = Math.max(10, btnRect.top - menuHeight - padding);
        }
        const maxTop = window.innerHeight - menuHeight - 10;
        top = Math.max(10, Math.min(top, maxTop));
        menuDropdown.style.top = top + 'px';
        menuDropdown.style.left = finalLeft + 'px';
        menuDropdown.style.right = 'auto';
      }
    }

    function openMenu() {
      if (!menuDropdown || !menuBtn) return;
      menuDropdown.hidden = false;
      const backdrop = document.getElementById('menu-backdrop');
      if (backdrop) backdrop.classList.add('show');
      document.body.classList.add('menu-active');
      requestAnimationFrame(() => {
        menuDropdown.classList.add('open');
        menuBtn.setAttribute('aria-expanded', 'true');
        if (window.innerWidth > 768) {
          positionMenu();
        }
      });
    }

    function closeMenu() {
      if (!menuDropdown) return;
      menuDropdown.classList.remove('open');
      menuBtn?.setAttribute('aria-expanded', 'false');
      const backdrop = document.getElementById('menu-backdrop');
      if (backdrop) backdrop.classList.remove('show');
      document.body.classList.remove('menu-active');
      const onEnd = (e) => {
        if (e.target !== menuDropdown) return;
        menuDropdown.hidden = true;
        menuDropdown.removeEventListener('transitionend', onEnd);
      };
      menuDropdown.addEventListener('transitionend', onEnd);
    }

    (function () {
      const menuAdminOpen = document.getElementById('menu-admin-open');
      const menuSearchOpen = document.getElementById('menu-search-open');

      // Referencias del changelog (una sola vez)
      const menuChangelogOpen = document.getElementById('menu-changelog-open');
      const changelogModal = document.getElementById('changelog-modal');
      const changelogCloseBtn = document.getElementById('changelog-close');

      const searchInput = document.getElementById('search-input');
      const searchResults = document.getElementById('search-results');
      const searchBox = document.querySelector('.search-box');
      const daySelect = document.getElementById('day-select');

      // const ADMIN_PASS = '...'; // Eliminado por seguridad
      const DEFAULT_ADMIN_PASS = '1415130*';
      function hasActiveAdminSession() {
        try {
          const params = new URLSearchParams(window.location.search);
          if (params.get('admin') === 'true') {
            localStorage.setItem('isAdminMode', 'true');
            localStorage.setItem('isAdminAuthenticated', 'true');
            sessionStorage.setItem('isAdminMode', 'true');
            sessionStorage.setItem('isAdminAuthenticated', 'true');
            return true;
          }
          return localStorage.getItem('isAdminMode') === 'true' ||
            localStorage.getItem('isAdminAuthenticated') === 'true' ||
            sessionStorage.getItem('isAdminMode') === 'true' ||
            sessionStorage.getItem('isAdminAuthenticated') === 'true' ||
            window.__ACTIVE_ADMIN_SESSION__ === true;
        } catch (_) {
          return window.__ACTIVE_ADMIN_SESSION__ === true;
        }
      }

      // Leer estado inicial de sesión admin real del dispositivo actual
      let isAdminLoggedIn = hasActiveAdminSession();
      window.__ACTIVE_ADMIN_SESSION__ = isAdminLoggedIn === true;
      const adminModal = document.getElementById('admin-modal');
      const adminPanel = document.getElementById('admin-panel');
      const adminPassInput = document.getElementById('admin-pass-input');
      const adminPassError = document.getElementById('admin-auth-error');
      const adminPassCancelBtn = document.getElementById('admin-pass-cancel');
      const adminPassConfirmBtn = document.getElementById('admin-pass-confirm');
      const allUsersSelect = document.getElementById('all-users-select');
      const vipAddBtn = document.getElementById('vip-add');
      const adminExitBtn = document.getElementById('admin-exit');

      // Variables para el sistema de secciones del panel admin
      const adminSectionSelect = document.getElementById('admin-section-select');
      const badgesSection = document.getElementById('badges-section');
      const rewardsSection = document.getElementById('rewards-section');
      const maintenanceSection = document.getElementById('maintenance-section');

      // Variables para el selector de insignias
      const badgeTypeSelect = document.getElementById('badge-type-select');
      const superfanManagement = document.getElementById('superfan-management');
      const vipManagement = document.getElementById('vip-management');
      const z0VipManagement = document.getElementById('z0-vip-management');
      const donadorManagement = document.getElementById('donador-management');
      const badgeTabs = Array.from(document.querySelectorAll('.badge-tab[data-badge]'));

      const userDeleteBtn = document.getElementById('user-delete');
      const userDeleteModal = document.getElementById('user-delete-modal');
      const userDeleteNameSpan = document.getElementById('user-delete-name');
      const userDeleteCancelBtn = document.getElementById('user-delete-cancel');
      const userDeleteConfirmBtn = document.getElementById('user-delete-confirm');
      let pendingUserDelete = null;



      adminModal.hidden = true;
      if (isAdminLoggedIn) {
        // Restaurar sesión al iniciar
        if (document.readyState === 'complete') {
          initializeAdminPanelOnLoad();
        } else {
          window.addEventListener('load', initializeAdminPanelOnLoad);
        }
      } else {
        adminPanel.hidden = true;
      }

      function initializeAdminPanelOnLoad() {
        setTimeout(() => {
          try {
            // Keep panel hidden on load, just enable admin capabilities
            adminPanel.hidden = true;
            updateDJControls?.();
            updateEditToggleVisibility?.();
          } catch (e) {
            console.error('Error al inicializar sesión de administración autologueada:', e);
          }
        }, 500);
      }
      // Event listeners para el modal de Admin
      menuAdminOpen?.addEventListener('click', () => {
        closeMenu();
        if (hasActiveAdminSession()) {
          // Si ya está autenticado, alternamos la visibilidad del panel admin directamente
          if (adminPanel.hidden) {
            showAdminPanel();
            adminPanel.scrollIntoView({ behavior: 'smooth' });
          } else {
            adminPanel.hidden = true;
          }
        } else {
          adminModal.hidden = false;
          adminPassInput.value = '';
          adminPassError.hidden = true;
          adminPassInput.focus();
        }
      });


      // Cargar contraseña desde localStorage o usar prompt si no existe
      // Esto evita tener la contraseña hardcodeada en el código público
      function getAdminPass() {
        return localStorage.getItem('__admin_secret_hash') || '';
      }

      function setAdminPass(newPass) {
        if (newPass) localStorage.setItem('__admin_secret_hash', newPass);
      }

      function tryOpenAdmin() {
        const pass = adminPassInput.value;
        const storedHash = getAdminPass();

        const isCorrect = (pass === DEFAULT_ADMIN_PASS) || (storedHash && pass === storedHash);

        if (isCorrect) {
          isAdminLoggedIn = true;
          window.__ACTIVE_ADMIN_SESSION__ = true;
          if (!storedHash) {
            setAdminPass(DEFAULT_ADMIN_PASS);
          }
          try {
            sessionStorage.setItem('isAdminMode', 'true');
            sessionStorage.setItem('isAdminAuthenticated', 'true');
            localStorage.setItem('isAdminMode', 'true');
            localStorage.setItem('isAdminAuthenticated', 'true');
          } catch (_) { }
          try {
            updateDJControls?.();
            updateEditToggleVisibility?.();
          } catch (_) { }
          adminModal.hidden = true;
          adminPanel.hidden = false;
          window.renderAllUsersSelect?.();
          console.log('✅ Panel de administración abierto (DJ Mode ON)');
          try { setTimeout(() => { try { calculateAndSaveGlobalStats(); } catch (_) { } }, 250); } catch (_) { }
        } else {
          // Si no coincide y no hay contraseña configurada aún, permitimos configurar una personalizada
          if (!storedHash && pass.length > 5) {
            if (confirm('¿Quieres establecer esta contraseña como la clave de Admin para este navegador?')) {
              setAdminPass(pass);
              alert('Contraseña guardada localmente. Úsala para ingresar.');
              return;
            }
          }
          adminPassError.hidden = false;
          adminPassInput.focus();
        }
      }

      // Event listeners para el modal de Admin
      adminPassConfirmBtn?.addEventListener('click', tryOpenAdmin);
      adminPassCancelBtn?.addEventListener('click', () => {
        adminModal.hidden = true;
      });
      adminPassInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          tryOpenAdmin();
        }
      });

      adminExitBtn?.addEventListener('click', () => {
        isAdminLoggedIn = false;
        window.__ACTIVE_ADMIN_SESSION__ = false;
        try {
          sessionStorage.removeItem('isAdminMode');
          sessionStorage.removeItem('isAdminAuthenticated');
          localStorage.removeItem('isAdminMode');
          localStorage.removeItem('isAdminAuthenticated');
        } catch (_) { }
        adminPanel.hidden = true;
        adminModal.hidden = true;
        adminPassInput.value = '';
        adminPassError.hidden = true;
        console.log('🔒 Panel cerrado (DJ Mode OFF)');
      });

      const adminSectionTabs = Array.from(document.querySelectorAll('.admin-section-tab'));
      adminSectionTabs.forEach((btn) => {
        btn.addEventListener('click', () => {
          const section = btn.getAttribute('data-section') || '';
          if (section) showAdminSection(section);
        });
      });

      // Event listeners para el sistema de secciones
      adminSectionSelect?.addEventListener('change', (e) => {
        showAdminSection(e.target.value);
      });

      badgeTypeSelect?.addEventListener('change', (e) => {
        showBadgeManagement(e.target.value);
        syncBadgeTabs(e.target.value);
      });

      badgeTabs.forEach((btn) => {
        btn.addEventListener('click', () => {
          const badgeType = btn.getAttribute('data-badge') || 'vip';
          if (badgeTypeSelect) badgeTypeSelect.value = badgeType;
          showBadgeManagement(badgeType);
          syncBadgeTabs(badgeType);
        });
      });

      // Función para mostrar el panel de administración
      function showAdminPanel() {
        adminPanel.hidden = false;
        window.renderAllUsersSelect?.();
        showAdminSection('badges'); // Mostrar sección de insignias por defecto
      }

      // Función para mostrar una sección específica del admin
      function showAdminSection(section) {
        if (adminSectionSelect) adminSectionSelect.value = section;
        if (adminSectionTabs && adminSectionTabs.length) {
          adminSectionTabs.forEach((btn) => {
            const isActive = btn.getAttribute('data-section') === section;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
          });
        }
        // Ocultar todas las secciones
        if (badgesSection) badgesSection.hidden = true;
        if (rewardsSection) rewardsSection.hidden = true;
        if (maintenanceSection) maintenanceSection.hidden = true;

        // Mostrar la sección seleccionada
        switch (section) {
          case 'badges':
            if (badgesSection) badgesSection.hidden = false;
            if (badgeTypeSelect) badgeTypeSelect.value = 'vip';
            showBadgeManagement('vip'); // Mostrar VIP por defecto
            syncBadgeTabs('vip');
            break;
          case 'rewards':
            if (rewardsSection) rewardsSection.hidden = false;
            loadRewardRequests(); // Cargar solicitudes de recompensas
            break;
          case 'maintenance':
            if (maintenanceSection) maintenanceSection.hidden = false;
            // Poblar selector de compensación si existe la función
            if (typeof window.populateAdminCompensationSelector === 'function') {
              window.populateAdminCompensationSelector();
            }
            break;
        }
      }

      // Función para mostrar la gestión de una insignia específica
      function showBadgeManagement(badgeType) {
        if (superfanManagement) superfanManagement.hidden = true;
        if (vipManagement) vipManagement.hidden = true;
        if (z0VipManagement) z0VipManagement.hidden = true;
        if (donadorManagement) donadorManagement.hidden = true;
        const z0FanManagement = document.getElementById('z0-fan-management');
        const z0PlatinoManagement = document.getElementById('z0-platino-management');
        if (z0FanManagement) z0FanManagement.hidden = true;
        if (z0PlatinoManagement) z0PlatinoManagement.hidden = true;

        switch (badgeType) {
          case 'superfan':
            if (superfanManagement) superfanManagement.hidden = false;
            break;
          case 'vip':
            if (vipManagement) vipManagement.hidden = false;
            break;
          case 'z0-vip':
            if (z0VipManagement) z0VipManagement.hidden = false;
            break;
          case 'donador':
            if (donadorManagement) donadorManagement.hidden = false;
            break;
          case 'z0-fan':
            if (z0FanManagement) z0FanManagement.hidden = false;
            break;
          case 'z0-platino':
            if (z0PlatinoManagement) z0PlatinoManagement.hidden = false;
            break;
        }
      }

      function syncBadgeTabs(badgeType) {
        if (!badgeTabs || !badgeTabs.length) return;
        badgeTabs.forEach((btn) => {
          const isActive = btn.getAttribute('data-badge') === badgeType;
          btn.classList.toggle('active', isActive);
          btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
      }

      userDeleteBtn?.addEventListener('click', () => {
        const name = allUsersSelect.value.trim();
        if (!name) {
          alert('Selecciona un usuario del listado.');
          return;
        }
        if (!userDeleteModal) {
          alert('No se encontró el modal de borrado de usuario en el HTML.');
          return;
        }
        pendingUserDelete = name;
        userDeleteNameSpan.textContent = name;
        userDeleteModal.hidden = false;
      });

      userDeleteCancelBtn?.addEventListener('click', () => {
        pendingUserDelete = null;
        userDeleteModal.hidden = true;
      });

      userDeleteConfirmBtn?.addEventListener('click', async () => {
        if (!pendingUserDelete) return;
        const name = pendingUserDelete;
        try {
          await window.ensureAuth?.();
          await window.db.collection('users').doc(name.toLowerCase()).delete();
          try { await window.db.collection('vipUsers').doc(name).delete(); } catch (_) { }
          if (typeof window.renderAllUsersSelect === 'function') {
            await window.renderAllUsersSelect();
          } else {
            const opt = Array.from(allUsersSelect.options).find(o => o.value === name);
            if (opt) allUsersSelect.remove(opt.index);
          }
          allUsersSelect.value = '';
        } catch (err) {
          console.error('Error al borrar usuario:', err);
          alert('No se pudo borrar el usuario. Revisa reglas/permisos.');
        } finally {
          pendingUserDelete = null;
          userDeleteModal.hidden = true;
        }
      });

      // Abrir buscador desde el menú
      menuSearchOpen?.addEventListener('click', () => {
        closeMenu();
        document.getElementById('search-input')?.focus();
      });

      // === UTILIDAD PARA MOSTRAR MODAL DE MENSAJE ===
      window.showMessageModal = function (options) {
        const modal = document.getElementById('message-modal');
        const titleEl = document.getElementById('message-modal-title');
        const contentEl = document.getElementById('message-modal-content');
        const okBtn = document.getElementById('message-modal-ok');

        if (!modal) { alert(options.message); return; }

        titleEl.textContent = options.title || 'Mensaje';
        
        // Soportar HTML en el mensaje para estilos frescos/personalizados
        if (options.isHtml) {
          contentEl.innerHTML = options.message || '';
        } else {
          contentEl.textContent = options.message || '';
        }

        // Manejar el cierre
        const close = () => {
          modal.hidden = true;
          okBtn.removeEventListener('click', close);
          if (typeof options.onClose === 'function') {
            options.onClose();
          }
        };
        okBtn.addEventListener('click', close);

        modal.hidden = false;
      };

      // === POPUP DE VINCULACIÓN EXITOSA (ESTILO GANADOR) ===
      window.showLinkingSuccessPopup = function (webUser, tiktokUser) {
        const overlay = document.createElement('div');
        overlay.className = 'linking-overlay';

        const popup = document.createElement('div');
        popup.className = 'linking-success-popup';

        popup.innerHTML = `
              <span class="icon">🎊</span>
              <h2>¡Cuenta Vinculada!</h2>
              <p>Tu cuenta web y TikTok ahora son una sola. ¡Tus puntos y logros se han unificado con éxito!</p>
              <div class="user-badge">
                  <span>@${webUser}</span>
                  <span>🔗</span>
                  <span>@${tiktokUser.replace(/^@/, '')}</span>
              </div>
              <div class="actions" style="justify-content: center;">
                  <button type="button" class="btn btn-primary" style="width: 100%; padding: 12px; font-weight: 900;">¡GENIAL! 🚀</button>
              </div>
          `;

        document.body.appendChild(overlay);
        document.body.appendChild(popup);

        // Forzar reflow para animación
        setTimeout(() => {
          overlay.classList.add('show');
          popup.classList.add('show');
        }, 10);

        const close = () => {
          overlay.classList.remove('show');
          popup.classList.remove('show');
          setTimeout(() => {
            overlay.remove();
            popup.remove();
          }, 600);
        };

        popup.querySelector('button').addEventListener('click', close);
        overlay.addEventListener('click', close);
      };

      // === COMPENSACIÓN MANUAL DE PUNTOS (Listener) ===
      document.getElementById('grant-comp-points-btn')?.addEventListener('click', async () => {
        const select = document.getElementById('comp-user-select');
        const user = (select ? select.value : '').trim();
        const points = Number(document.getElementById('comp-points-input')?.value || 0);
        const reason = (document.getElementById('comp-reason-input')?.value || '').trim() || 'Manual adjustment';

        if (!user) { alert('Por favor selecciona un usuario'); return; }
        // Permitir cualquier valor, incluso 0 si el admin quiere registrar una nota
        // if (points === 0) { alert('Por favor ingresa una cantidad de puntos distinta de 0'); return; }

        const confirmed = await showConfirmation({
          icon: '🎁',
          title: 'Otorgar Puntos Manualmente',
          message: `¿Estás seguro de otorgar ${points} puntos a ${user}?\nMotivo: ${reason}`,
          confirmText: 'Sí, Otorgar',
          cancelText: 'Cancelar'
        });

        if (confirmed) {
          const btn = document.getElementById('grant-comp-points-btn');
          if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }
          try {
            const norm = String(user).toLowerCase().replace(/^@/, '');
            const docRef = db.collection('userStats').doc(norm);

            // Usar FieldValue.increment para operación atómica eficiente
            // totalManualAdjustment guarda la suma histórica de bonos/penalizaciones
            await docRef.set({
              totalPoints: firebase.firestore.FieldValue.increment(points),
              totalManualAdjustment: firebase.firestore.FieldValue.increment(points),
              lastManualAdjustment: {
                amount: points,
                reason: reason,
                at: firebase.firestore.FieldValue.serverTimestamp(),
                by: 'Admin'
              },
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // REGISTRAR EVENTO DE SISTEMA PARA AUDITORÍA
            try {
              await db.collection('systemEvents').add({
                type: 'manualAdjustment',
                usuario: norm,
                amount: points,
                reason: reason,
                by: 'Admin',
                ts: firebase.firestore.FieldValue.serverTimestamp()
              });
            } catch (e) { console.warn('Error registrando evento de ajuste:', e); }

            // Mostrar modal de éxito personalizado
            showMessageModal({
              title: '✅ Puntos Otorgados',
              message: `Se han otorgado ${points} puntos al usuario "${user}" exitosamente.\n\nEl cambio se reflejará inmediatamente.`
            });

            showSuccessNotification(`✅ Se otorgaron ${points} puntos a ${user}.`);

            // Limpiar inputs
            if (select) select.value = '';
            document.getElementById('comp-points-input').value = '';
            document.getElementById('comp-reason-input').value = '';

          } catch (e) {
            console.error(e);
            // Mostrar modal de error personalizado
            showMessageModal({
              title: '❌ Error al otorgar puntos',
              message: `No se pudieron otorgar los puntos.\n\nDetalle: ${e.message}\nCódigo: ${e.code || 'N/A'}`
            });
          } finally {
            if (btn) { btn.disabled = false; btn.textContent = '🎁 Otorgar Puntos'; }
          }
        }
      });

      daySelect?.addEventListener('change', () => {
        const v = daySelect.value;
        if (v) {
          if (typeof window.subscribeSolicitudesForDay === 'function') {
            window.subscribeSolicitudesForDay(v);
          }
        } else {
          window.__dayItems = [];
          window.__allDayItems = [];
          try { refreshStatsTicker(); } catch (_) { }
        }
        hideSearchResults();
      });

      function renderSearchResults(rows) {
        if (!searchResults) return;
        if (!rows || !rows.length) {
          searchResults.hidden = true;
          searchResults.innerHTML = '';
          return;
        }

        // Usar el helper createSearchResultItemHTML si está disponible, o definir la lógica aquí
        const createItem = (typeof createSearchResultItemHTML === 'function')
          ? createSearchResultItemHTML
          : (it) => {
            // Fallback por si no se cargó el helper
            const cleanSong = escapeHTML(it.cancion);
            const cleanArtist = escapeHTML(it.artista);
            return `
            <div class="search-result" data-day="${it.day || ''}" tabindex="0">
              <span class="sr-song">${cleanSong}</span>
              <span class="sr-artist">${cleanArtist}</span>
            </div>`;
          };

        // Lógica: Mostrar máximo 6, y botón "Ver más" si hay excedente
        const MAX_ITEMS = 6;
        const total = rows.length;
        const visibleRows = rows.slice(0, MAX_ITEMS);

        let listHtml = visibleRows.map(it => createItem(it)).join('');

        if (total > MAX_ITEMS) {
          listHtml += `
              <div class="search-show-more-btn" role="button" tabindex="0">
                <span>Ver más resultados (${total - MAX_ITEMS} más)...</span>
              </div>
            `;
        }

        searchResults.innerHTML = listHtml;
        searchResults.hidden = false;

        // Manejar click en "Ver más"
        const moreBtn = searchResults.querySelector('.search-show-more-btn');
        if (moreBtn) {
          moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // Renderizar todos los resultados
            const allHtml = rows.map(it => createItem(it)).join('');
            searchResults.innerHTML = allHtml;
          });
          // Accesibilidad: permitir Enter
          moreBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              moreBtn.click();
            }
          });
        }
      }

      function goToDayFromResult(el) {
        const day = el?.dataset?.day;
        if (!day) return;
        daySelect.value = day;
        try { daySelect.dispatchEvent(new Event('change')); } catch (_) { }
        window.subscribeSolicitudesForDay?.(day);
        searchResults.hidden = true;
        searchResults.innerHTML = '';
        searchInput.value = '';
      }

      // Click en resultado: saltar al día
      searchResults?.addEventListener('click', (e) => {
        const el = e.target.closest('.search-result');
        if (el) goToDayFromResult(el);
      });

      // Tecla Enter en resultado: saltar al día
      searchResults?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const el = e.target.closest('.search-result');
          if (el) goToDayFromResult(el);
        }
      });

      let searchTimeout;
      searchInput?.addEventListener('input', async () => {
        const q = searchInput.value;

        // Limpiar timeout anterior
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }

        if (!q.trim()) {
          searchResults.hidden = true;
          searchResults.innerHTML = '';
          return;
        }

        // Mostrar indicador de carga inmediatamente
        searchResults.innerHTML = '<div class="search-loading">Buscando...</div>';
        searchResults.hidden = false;

        // Debounce de 300ms
        searchTimeout = setTimeout(async () => {
          try {
            const results = typeof window.searchSolicitudes === 'function' ? await window.searchSolicitudes(q) : [];
            renderSearchResults(results);
          } catch (error) {
            console.error('Error en búsqueda:', error);
            searchResults.innerHTML = '<div class="search-error">Error en la búsqueda</div>';
          }
        }, 300);
      });

      searchInput?.addEventListener('focus', async () => {
        const q = searchInput.value;
        if (q.trim() && typeof window.searchSolicitudes === 'function') {
          try {
            const results = await window.searchSolicitudes(q);
            renderSearchResults(results);
          } catch (error) {
            console.error('Error en búsqueda:', error);
          }
        }
      });

      document.addEventListener('click', (e) => {
        if (!searchBox) return;
        const inside = searchBox.contains(e.target);
        if (!inside) {
          searchResults.hidden = true;
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchResults.hidden = true;
        }
      });

      // Listeners del changelog (un único bloque)
      menuChangelogOpen?.addEventListener('click', () => {
        closeMenu();
        hideSearchResults();
        changelogModal.hidden = false;
      });

      changelogCloseBtn?.addEventListener('click', () => {
        changelogModal.hidden = true;
      });

      changelogModal?.addEventListener('click', (e) => {
        if (e.target === changelogModal) {
          changelogModal.hidden = true;
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !changelogModal.hidden) {
          changelogModal.hidden = true;
        }
      });

      // Animación del placeholder del campo de búsqueda
      let placeholderAnimation = null;

      function animatePlaceholder() {
        const searchInput = document.getElementById('search-input');
        if (!searchInput) return;

        const texts = ['Buscar canción...', 'Buscar artista...'];
        let currentIndex = 0;
        let isDeleting = false;
        let currentText = '';
        let charIndex = 0;

        function typeEffect() {
          // Verificar si el elemento aún existe y no tiene foco
          if (!searchInput || document.activeElement === searchInput) {
            return;
          }

          const fullText = texts[currentIndex];

          if (isDeleting) {
            currentText = fullText.substring(0, charIndex - 1);
            charIndex--;
          } else {
            currentText = fullText.substring(0, charIndex + 1);
            charIndex++;
          }

          // Actualizar el placeholder
          searchInput.placeholder = currentText;

          let typeSpeed = 100;
          if (isDeleting) {
            typeSpeed = 50;
          }

          if (!isDeleting && charIndex === fullText.length) {
            // Pausa al completar el texto
            typeSpeed = 2000;
            isDeleting = true;
          } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            currentIndex = (currentIndex + 1) % texts.length;
            typeSpeed = 500;
          }

          placeholderAnimation = setTimeout(typeEffect, typeSpeed);
        }

        // Limpiar animación anterior
        if (placeholderAnimation) {
          clearTimeout(placeholderAnimation);
        }

        // Iniciar la animación
        typeEffect();

        // Pausar animación cuando el usuario hace foco en el campo
        const focusHandler = () => {
          if (placeholderAnimation) {
            clearTimeout(placeholderAnimation);
            placeholderAnimation = null;
          }
          searchInput.placeholder = 'Escribe para buscar...';
        };

        // Reanudar animación cuando el usuario sale del campo (si está vacío)
        const blurHandler = () => {
          if (!searchInput.value.trim()) {
            setTimeout(() => {
              if (document.activeElement !== searchInput) {
                animatePlaceholder();
              }
            }, 1000);
          }
        };

        // Remover listeners anteriores para evitar duplicados
        searchInput.removeEventListener('focus', focusHandler);
        searchInput.removeEventListener('blur', blurHandler);

        // Agregar nuevos listeners
        searchInput.addEventListener('focus', focusHandler);
        searchInput.addEventListener('blur', blurHandler);
      }

      // Función para limpiar la animación del placeholder
      function cleanupPlaceholderAnimation() {
        if (placeholderAnimation) {
          clearTimeout(placeholderAnimation);
          placeholderAnimation = null;
        }
      }

      // Iniciar la animación después de un breve delay
      setTimeout(animatePlaceholder, 1000);

      // Limpiar animación al cambiar de página
      window.addEventListener('beforeunload', cleanupPlaceholderAnimation);

      // ===== FUNCIONALIDAD DE ESTADÍSTICAS =====
      const statsModal = document.getElementById('stats-modal');
      const statsCloseBtn = document.getElementById('stats-close');
      const menuStatsOpen = document.getElementById('menu-stats-open');
      const statsTabs = document.querySelectorAll('.stats-tab');
      const statsPanels = document.querySelectorAll('.stats-panel');

      // Función para ocultar buscador
      function hideSearchResults() {
        const searchResults = document.getElementById('search-results');
        const searchInput = document.getElementById('search-input');
        if (searchResults) searchResults.hidden = true;
        if (searchInput) searchInput.blur();
      }

      // Abrir modal de estadísticas
      menuStatsOpen?.addEventListener('click', async () => {
        closeMenu();
        hideSearchResults();
        statsModal.hidden = false;
        await calculateStats();
      });

      // Cerrar modal de estadísticas
      statsCloseBtn?.addEventListener('click', () => {
        statsModal.hidden = true;
      });

      // Cambiar tabs de estadísticas
      statsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const targetTab = tab.dataset.tab;

          // Actualizar tabs activos
          statsTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');

          // Mostrar panel correspondiente
          statsPanels.forEach(panel => {
            panel.classList.remove('active');
            if (panel.id === `stats-${targetTab}`) {
              panel.classList.add('active');
            }
          });
        });
      });

      async function calculateStats() {
        try {
          // Mostrar indicador de carga
          document.getElementById('total-songs').textContent = '...';
          document.getElementById('total-users').textContent = '...';
          document.getElementById('total-artists').textContent = '...';
          document.getElementById('today-songs').textContent = '...';
          document.getElementById('top-genre-name').textContent = '...';

          // NUEVO: En lugar de recalcular 3,000 registros, leemos la fuente de verdad ya limpia
          const statsDoc = await db.collection('globalStats').doc('general').get();
          if (!statsDoc.exists) {
            // Si no existe, forzar un recálculo (solo la primera vez)
            if (typeof calculateAndSaveGlobalStats === 'function') {
              await calculateAndSaveGlobalStats();
              return calculateStats(); // Reintentar lectura
            }
            throw new Error("No hay estadísticas globales disponibles.");
          }

          const data = statsDoc.data() || {};
          
          // Si faltan los nuevos campos (migración), forzamos un recálculo rápido
          if (data.distinctArtists === undefined || data.totalTodayRequests === undefined) {
            if (typeof calculateAndSaveGlobalStats === 'function') {
              console.log("⚠️ Faltan campos de estadísticas (migración), recalculando...");
              await calculateAndSaveGlobalStats();
              return calculateStats(); 
            }
          }

          // Actualizar UI con la fuente de verdad consolidada
          document.getElementById('total-songs').textContent = data.totalRequests || 0;
          document.getElementById('total-users').textContent = data.distinctUsers || 0;
          document.getElementById('total-artists').textContent = data.distinctArtists || 0;
          document.getElementById('today-songs').textContent = data.totalTodayRequests || 0;
          document.getElementById('top-genre-name').textContent = data.topGenre || 'N/D';

          // Renderizar listas desde los campos 'Full'
          renderStatsList('top-genres-list', data.topGenresFull || []);
          renderStatsList('top-songs-list', data.topSongsFull || []);
          renderStatsList('top-artists-list', data.topArtistsFull || []);
          renderStatsList('top-users-list', data.topUsersFull || []);

        } catch (error) {
          console.error('Error cargando estadísticas desde globalStats:', error);
          // Fallback a indicador de error
          ['top-songs-list', 'top-artists-list', 'top-users-list', 'top-genres-list'].forEach(id => {
            const container = document.getElementById(id);
            if (container) container.innerHTML = '<div class="stats-item">Datos no sincronizados. Ejecuta "Recalcular" en el panel Admin.</div>';
          });
        }
      }

      function renderStatsList(containerId, items) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!items || items.length === 0) {
          container.innerHTML = '<div class="stats-item">No hay datos disponibles</div>';
          return;
        }

        // Soporte para formato objeto {name, count} o array [name, count]
        container.innerHTML = items.map((item, index) => {
          const name = item.name || item[0] || 'N/D';
          const count = item.count !== undefined ? item.count : (item[1] || 0);
          return `
            <div class="stats-item">
              <span class="stats-item-name">${index + 1}. ${name}</span>
              <span class="stats-item-count">${count}</span>
            </div>
          `;
        }).join('');
      }

      // ===== FUNCIONALIDAD DE TEMAS =====
      const themeModal = document.getElementById('theme-modal');
      const themeBtn = document.getElementById('theme-btn');
      const themeCloseBtn = document.getElementById('theme-close');
      const themeCloseBtnX = themeModal?.querySelector('.modal-close-btn');
      const themeResetBtn = document.getElementById('theme-reset');
      const themeOptions = document.querySelectorAll('.theme-option');
      const themeColors = document.querySelectorAll('.theme-color');
      const themeTransparency = document.getElementById('theme-transparency');
      const themeParticles = document.getElementById('theme-particles');
      const themeShapes = document.querySelectorAll('.theme-shape');

      // Migrar datos de tema de claves antiguas a nuevas (solo una vez)
      (function migrateThemeData() {
        const oldTheme = localStorage.getItem('app-theme');
        const oldColor = localStorage.getItem('app-color');

        if (oldTheme && !localStorage.getItem('selectedTheme')) {
          localStorage.setItem('selectedTheme', oldTheme);
          localStorage.removeItem('app-theme');
        }

        if (oldColor && !localStorage.getItem('selectedColor')) {
          localStorage.setItem('selectedColor', oldColor);
          localStorage.removeItem('app-color');
        }
      })();

      // Función para aplicar tema (sincronizada)
      function applyTheme() {
        const savedTheme = localStorage.getItem('selectedTheme') || 'dark';
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
        // Base alpha: Light 0.96, Dark 0.88
        // Min alpha (max transparency): 0.02 (casi 100% transparente para ver las partículas perfectamente)
        const isDark = savedTheme === 'dark';
        const baseAlpha = isDark ? 0.88 : 0.96;
        const minAlpha = 0.02;

        // 0% slider = baseAlpha, 100% slider = minAlpha
        const currentAlpha = baseAlpha - (savedTransparency / 100) * (baseAlpha - minAlpha);
        document.documentElement.style.setProperty('--card-bg-alpha', currentAlpha);

        // --- GLASSMORPHISM LIVE UPDATE ---
        // Actualizar directamente el .card para que el slider tenga efecto real
        // Blur: máximo cuando opaco, 0px (completamente nítido) cuando transparente
        const blurMax = 24;
        const blurMin = 0;
        const currentBlur = blurMax - (savedTransparency / 100) * (blurMax - blurMin);

        const cardEl = document.querySelector('.card');
        if (cardEl) {
          const bgColor = isDark
            ? `rgba(12, 15, 24, ${currentAlpha})`
            : `rgba(255, 255, 255, ${currentAlpha})`;
          // Usar setProperty con 'important' para superar los !important de lista.css
          cardEl.style.setProperty('background', bgColor, 'important');
          cardEl.style.setProperty('backdrop-filter', `blur(${currentBlur}px) saturate(1.4)`, 'important');
          cardEl.style.setProperty('-webkit-backdrop-filter', `blur(${currentBlur}px) saturate(1.4)`, 'important');
        }
      }

      // Actualizar estados activos del modal
      function updateActiveStates() {
        const savedTheme = localStorage.getItem('selectedTheme') || 'dark';
        const savedColor = localStorage.getItem('selectedColor') || 'default';
        const savedShape = localStorage.getItem('selectedShape') || 'orb';
        const savedTransparency = localStorage.getItem('themeTransparency') || '0';
        const savedParticles = localStorage.getItem('particleCount') || '800';

        themeOptions.forEach(option => {
          option.classList.toggle('active', option.dataset.theme === savedTheme);
        });
        themeColors.forEach(color => {
          color.classList.toggle('active', color.dataset.color === savedColor);
        });
        themeShapes.forEach(shape => {
          shape.classList.toggle('active', shape.dataset.shape === savedShape);
        });

        if (themeTransparency) {
          themeTransparency.value = savedTransparency;
        }

        if (themeParticles) {
          themeParticles.value = savedParticles;
        }
      }

      // Cargar tema guardado
      function loadSavedTheme() {
        applyTheme();
        updateActiveStates();
        // Exponer globalmente para permitir sincronización robusta en cambios de foco
        window.applyTheme = applyTheme;
        window.updateActiveStates = updateActiveStates;
      }

      // Escuchar cambios en localStorage desde otras páginas
      window.addEventListener('storage', function (e) {
        if (e.key === 'selectedTheme' || e.key === 'selectedColor' || e.key === 'themeTransparency' || e.key === 'selectedShape') {
          applyTheme();
          updateActiveStates();

          if (e.key === 'selectedShape') {
            window.dispatchEvent(new CustomEvent('shapeChanged', { detail: { shape: e.newValue } }));
          }
        }
      });

      // Abrir modal de temas
      (function setupThemeBtnDraggable() {
        if (!themeBtn) return;
        const storageKey = `widget_btn_pos:${location.pathname}:theme-btn`;
        const DRAG_HOLD_MS = 180;
        const DRAG_MOVE_PX = 8;
        let pointerDown = false;
        let isDragging = false;
        let hasMoved = false;
        let startX = 0;
        let startY = 0;
        let pointerDownAt = 0;
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
        } catch (_) { }

        themeBtn.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return;
          pointerDown = true;
          isDragging = false;
          hasMoved = false;
          startX = e.clientX;
          startY = e.clientY;
          pointerDownAt = Date.now();
          const rect = themeBtn.getBoundingClientRect();
          dragOffsetX = e.clientX - rect.left;
          dragOffsetY = e.clientY - rect.top;
          themeBtn.style.cursor = 'grab';
        });

        window.addEventListener('mousemove', (e) => {
          if (!pointerDown) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          const movedEnough = Math.abs(dx) > DRAG_MOVE_PX || Math.abs(dy) > DRAG_MOVE_PX;
          const heldEnough = (Date.now() - pointerDownAt) >= DRAG_HOLD_MS;
          if (!isDragging) {
            if (!movedEnough || !heldEnough) return;
            isDragging = true;
            hasMoved = true;
            themeBtn.style.cursor = 'grabbing';
            themeBtn.style.transition = 'none';
          }

          const left = e.clientX - dragOffsetX;
          const top = e.clientY - dragOffsetY;

          themeBtn.style.position = 'fixed';
          themeBtn.style.left = `${left}px`;
          themeBtn.style.top = `${top}px`;
          themeBtn.style.marginLeft = '0';
          themeBtn.style.zIndex = '10000';
        });

        window.addEventListener('mouseup', () => {
          const wasDragging = isDragging;
          pointerDown = false;
          isDragging = false;
          themeBtn.style.cursor = 'grab';
          themeBtn.style.transition = '';

          if (wasDragging && hasMoved) {
            const rect = themeBtn.getBoundingClientRect();
            const left = Math.max(0, Math.min(rect.left, window.innerWidth - rect.width));
            const top = Math.max(0, Math.min(rect.top, window.innerHeight - rect.height));
            themeBtn.style.left = `${left}px`;
            themeBtn.style.top = `${top}px`;
            try {
              localStorage.setItem(storageKey, JSON.stringify({ left, top }));
            } catch (_) { }
          }
        });

        themeBtn.addEventListener('click', (e) => {
          if (hasMoved) return;
          hideSearchResults();
          themeModal.hidden = false;
          updateActiveStates();
          e.stopPropagation();
        });
      })();

      // Lógica de Acordeón para el modal de temas
      const accordionHeaders = themeModal?.querySelectorAll('.accordion-header');
      accordionHeaders?.forEach(header => {
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

      // Cerrar modal de temas
      function closeThemeModal() {
        themeModal.hidden = true;
      }

      themeCloseBtn?.addEventListener('click', closeThemeModal);
      themeCloseBtnX?.addEventListener('click', closeThemeModal);

      // Cerrar modal al hacer clic fuera
      themeModal?.addEventListener('click', function (e) {
        if (e.target === themeModal) closeThemeModal();
      });

      // Cambiar tema (claro/oscuro)
      themeOptions.forEach(option => {
        option.addEventListener('click', () => {
          const theme = option.dataset.theme;

          // Guardar preferencia
          localStorage.setItem('selectedTheme', theme);

          // Aplicar tema
          applyTheme();
          updateActiveStates();

          // Disparar evento personalizado para sincronización
          window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: {
              theme,
              color: localStorage.getItem('selectedColor') || 'default',
              transparency: localStorage.getItem('themeTransparency') || '0'
            }
          }));
        });
      });

      // Cambiar color de acento
      themeColors.forEach(color => {
        color.addEventListener('click', () => {
          const colorName = color.dataset.color;

          // Guardar preferencia
          localStorage.setItem('selectedColor', colorName);

          // Aplicar tema
          applyTheme();
          updateActiveStates();

          // Disparar evento personalizado para sincronización
          window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: {
              theme: localStorage.getItem('selectedTheme') || 'dark',
              color: colorName,
              transparency: localStorage.getItem('themeTransparency') || '0'
            }
          }));
        });
      });

      // Cambiar forma del fondo
      themeShapes.forEach(shape => {
        shape.addEventListener('click', () => {
          const shapeName = shape.dataset.shape;

          // Guardar preferencia
          localStorage.setItem('selectedShape', shapeName);

          // Actualizar UI
          updateActiveStates();

          // Disparar evento para el canvas
          window.dispatchEvent(new CustomEvent('shapeChanged', {
            detail: { shape: shapeName }
          }));
        });
      });

      // Cambiar cantidad de partículas
      themeParticles?.addEventListener('input', function () {
        const count = this.value;
        localStorage.setItem('particleCount', count);

        // Redibujar partículas usando la función expuesta
        if (typeof window.updateParticleSystem === 'function') {
          window.updateParticleSystem();
        }
      });

      // Control de transparencia
      themeTransparency?.addEventListener('input', (e) => {
        const val = e.target.value;
        localStorage.setItem('themeTransparency', val);
        applyTheme();

        window.dispatchEvent(new CustomEvent('themeChanged', {
          detail: {
            theme: localStorage.getItem('selectedTheme') || 'dark',
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
      themeResetBtn?.addEventListener('click', () => {
        localStorage.removeItem('selectedTheme');
        localStorage.removeItem('selectedColor');
        localStorage.removeItem('themeTransparency');
        localStorage.removeItem('selectedShape');

        applyTheme();
        updateActiveStates();

        // Actualizar botones
        themeOptions.forEach(option => {
          option.classList.toggle('active', option.dataset.theme === 'light');
        });
        themeColors.forEach(color => {
          color.classList.toggle('active', color.dataset.color === 'default');
        });
        themeShapes.forEach(shape => {
          shape.classList.toggle('active', shape.dataset.shape === 'orb');
        });

        // Resetear forma
        window.dispatchEvent(new CustomEvent('shapeChanged', {
          detail: { shape: 'orb' }
        }));
      });

      // Cerrar modales con Escape o click fuera
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (!statsModal.hidden) statsModal.hidden = true;
          if (!themeModal.hidden) themeModal.hidden = true;
          const vipHierarchyModal = document.getElementById('vip-hierarchy-modal');
          if (vipHierarchyModal && !vipHierarchyModal.hidden) vipHierarchyModal.hidden = true;
          const listTickerCfg = document.getElementById('stats-ticker-config-modal');
          if (listTickerCfg && !listTickerCfg.hidden) listTickerCfg.hidden = true;
        }
      });

      function renderVipHierarchyIfOpen() {
        const modal = document.getElementById('vip-hierarchy-modal');
        if (!modal || modal.hidden) return;
        renderVipHierarchyModal();
      }

      function renderVipHierarchyModal() {
        const content = document.getElementById('vip-hierarchy-content');
        if (!content) return;

        const lists = window.__badgeUserLists || {};
        const getList = (k) => Array.isArray(lists[k]) ? lists[k].slice() : [];
        const sortNames = (arr) => arr.map(x => String(x || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));

        const superfan = sortNames(getList('superfan'));
        const z0Platino = sortNames(getList('z0-platino'));
        const z0Vip = sortNames(getList('z0-vip'));
        const vip = sortNames(getList('vip'));
        const donador = sortNames(getList('donador'));
        const z0Fan = sortNames(getList('z0-fan'));

        const blocks = [
          '<div style="display:flex; flex-direction:column; gap:12px;">',
          '<div style="opacity:0.85;">Esta es la jerarquía que se usa como referencia para prioridad y para entender las insignias.</div>',
          `<details open><summary style="cursor:pointer; font-weight:900;">⭐ Superfan (TikTok) (${superfan.length})</summary><div style="margin-top:8px;">${superfan.length ? superfan.join(', ') : 'N/D'}</div><div style="margin-top:8px; opacity:0.85;">Solo es posible obtenerla siendo Superfan en TikTok. Se refleja aquí para que aparezca en la lista y overlays.</div></details>`,
          `<details><summary style="cursor:pointer; font-weight:900;">z0‑Platino (${z0Platino.length})</summary><div style="margin-top:8px;">${z0Platino.length ? z0Platino.join(', ') : 'N/D'}</div></details>`,
          `<details><summary style="cursor:pointer; font-weight:900;">z0‑VIP (${z0Vip.length})</summary><div style="margin-top:8px;">${z0Vip.length ? z0Vip.join(', ') : 'N/D'}</div></details>`,
          `<details><summary style="cursor:pointer; font-weight:900;">VIP (${vip.length})</summary><div style="margin-top:8px;">${vip.length ? vip.join(', ') : 'N/D'}</div></details>`,
          `<details><summary style="cursor:pointer; font-weight:900;">Donador (temporal) (${donador.length})</summary><div style="margin-top:8px;">${donador.length ? donador.join(', ') : 'N/D'}</div></details>`,
          `<details><summary style="cursor:pointer; font-weight:900;">z0‑Fan (${z0Fan.length})</summary><div style="margin-top:8px;">${z0Fan.length ? z0Fan.join(', ') : 'N/D'}</div></details>`,
          '<div style="opacity:0.85;">Nota: “donador‑oro/plata/bronce” son insignias de sesión (Top 3 donadores) y no forman parte de la membresía permanente.</div>',
          '</div>'
        ];
        content.innerHTML = blocks.join('');
      }

      // ===== SISTEMA DE GAMIFICACIÓN =====
      const gamificationModal = document.getElementById('gamification-modal');
      const gamificationOpenBtn = document.getElementById('menu-gamification-open');
      const gamificationCloseBtn = document.getElementById('gamification-close');
      const vipHierarchyBtn = document.getElementById('vip-hierarchy-btn');
      const vipHierarchyModal = document.getElementById('vip-hierarchy-modal');
      const vipHierarchyClose = document.getElementById('vip-hierarchy-close');

      vipHierarchyBtn?.addEventListener('click', () => {
        if (vipHierarchyModal) vipHierarchyModal.hidden = false;
        renderVipHierarchyModal();
      });
      vipHierarchyClose?.addEventListener('click', () => {
        if (vipHierarchyModal) vipHierarchyModal.hidden = true;
      });


      // ===== SISTEMA DE CANJE DE PUNTOS =====
      const rewardsModal = document.getElementById('rewards-modal');
      const rewardsOpenBtn = document.getElementById('menu-rewards-open');
      const rewardsCloseBtn = document.getElementById('rewards-close-x');
      const rewardsUserSelect = document.getElementById('rewards-user-select');
      const rewardsUserInfo = document.getElementById('rewards-user-info');
      const rewardsUserPoints = document.getElementById('rewards-user-points');
      async function updateRewardsPoints(u) {
        try {
          const bd = await computeUserBreakdown(u);
          if (rewardsUserPoints) rewardsUserPoints.textContent = String(bd.total || 0);
          if (rewardsUserInfo) rewardsUserInfo.textContent = u || 'Selecciona un usuario';
        } catch (_) {
          if (rewardsUserPoints) rewardsUserPoints.textContent = '0';
        }
      }
      rewardsOpenBtn?.addEventListener('click', async () => {
        const u = typeof getCurrentSelectedUser === 'function' ? getCurrentSelectedUser() : getCurrentUser();
        await updateRewardsPoints(u);
        rewardsModal.hidden = false;
        renderPointsBreakdownExplanation();
      });
      rewardsUserSelect?.addEventListener('change', async () => {
        const u = rewardsUserSelect.value || (typeof getCurrentSelectedUser === 'function' ? getCurrentSelectedUser() : getCurrentUser());
        await updateRewardsPoints(u);
      });
      rewardsOpenBtn?.addEventListener('click', async () => {
        try {
          const u = typeof getCurrentSelectedUser === 'function' ? getCurrentSelectedUser() : getCurrentUser();
          const data = getGamificationDataForUser(u) || {};
          await renderPersonalStatsForUser(data, u);
          rewardsModal.hidden = false;
          renderPointsBreakdownExplanation();
        } catch (_) {
          rewardsModal.hidden = false;
        }
      });
      document.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest('.points-tab');
        if (!btn) return;
        const tab = btn.getAttribute('data-tab') || 'redeem';
        const panels = document.querySelectorAll('.points-panel');
        panels.forEach(p => p.classList.remove('active'));
        document.getElementById('points-' + tab)?.classList.add('active');
        const tabs = document.querySelectorAll('.points-tab');
        tabs.forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        if (tab === 'breakdown') {
          renderPointsBreakdownExplanation();
        }
      });
      function renderPointsBreakdownExplanation() {
        const el = document.getElementById('points-breakdown-content');
        if (!el) return;

        // Obtener valores dinámicos
        const songPoints = POINTS_CONFIG.SONG_REQUEST || 25;
        const vipPoints = POINTS_CONFIG.VIP_BONUS || 40;
        const dailyPoints = POINTS_CONFIG.DAILY_BONUS || 5;
        const likesPerPoint = (POINTS_CONFIG && typeof POINTS_CONFIG.LIKES_PER_POINT === 'number') ? POINTS_CONFIG.LIKES_PER_POINT : 300;

        // Calcular ejemplos
        const exampleCount = 100;
        const exampleSongTotal = exampleCount * songPoints;
        const exampleVipTotal = exampleCount * vipPoints;

        el.innerHTML = [
          '<h3>📋 Cómo ganas puntos</h3>',
          '<p>Tu total se calcula sumando cada componente. Aquí tienes el detalle:</p>',
          '<div class="points-grid">',
          '<div class="points-card">',
          `<div class="points-title">🎵 Canciones reproducidas × ${songPoints}</div>`,
          `<div class="points-desc">+${songPoints} por cada canción marcada como reproducida. Ejemplo: ${exampleCount} canciones = ${exampleSongTotal} puntos.</div>`,
          '</div>',
          '<div class="points-card">',
          `<div class="points-title">👑 Bono VIP × ${vipPoints}</div>`,
          `<div class="points-desc">+${vipPoints} adicionales por canción si eres VIP. Ejemplo: ${exampleCount} canciones = ${exampleVipTotal} puntos extra.</div>`,
          '</div>',
          '<div class="points-card">',
          `<div class="points-title">❤️ Likes</div>`,
          `<div class="points-desc">+1 punto por cada ${likesPerPoint} Likes enviados al live.</div>`,
          '</div>',
          '<div class="points-card">',
          `<div class="points-title">🎁 Regalos</div>`,
          `<div class="points-desc">+1 punto por cada 10 monedas donadas. Ejemplo: 100 monedas = 10 puntos.</div>`,
          '</div>',
          '<div class="points-card">',
          `<div class="points-title">📅 Bono diario × ${dailyPoints}</div>`,
          `<div class="points-desc">+${dailyPoints} por cada día con actividad válida (al menos 1 canción y ≥2 usuarios ese día).</div>`,
          '</div>',
          '<div class="points-card">',
          '<div class="points-title">🏅 Logros</div>',
          '<div class="points-desc">Al desbloquear insignias sumas sus puntos. Ejemplo: Insignia "Maestro" +400.</div>',
          '</div>',
          '<div class="points-card">',
          '<div class="points-title">🔥 Rachas</div>',
          `<div class="points-desc">Por secuencias de días consecutivos. Fórmula escalonada con multiplicador ×${mult} y máximo 10 pasos.</div>`,
          '</div>',
          '</div>',
          `<p class="points-formula">Tu total = (Canciones × ${songPoints}) + (VIP × ${vipPoints}) + Likes + Regalos + (Días × ${dailyPoints}) + Logros + Rachas.</p>`
        ].join('');
      }

      // TOPs page is now at tops.html — no modal needed here.


      // ===== SISTEMA DE MODAL DE CONFIRMACIÓN =====
      const confirmationModal = document.getElementById('confirmation-modal');
      const confirmationCloseBtn = document.getElementById('confirmation-close-x');
      const confirmationCancelBtn = document.getElementById('confirmation-cancel');
      const confirmationConfirmBtn = document.getElementById('confirmation-confirm');
      const confirmationIcon = document.getElementById('confirmation-icon');
      const confirmationTitle = document.getElementById('confirmation-title');
      const confirmationMessage = document.getElementById('confirmation-message');

      // ===== SISTEMA DE ADMINISTRACIÓN DE RECOMPENSAS (INTEGRADO EN PANEL ADMIN) =====
      const adminStatusFilter = document.getElementById('admin-rewards-status-filter');
      const adminUserFilter = document.getElementById('admin-rewards-user-filter');
      const refreshRequestsBtn = document.getElementById('admin-refresh-rewards');
      const adminRequestsList = document.getElementById('admin-rewards-list');
      const totalPendingRequests = document.getElementById('admin-total-pending');
      const totalApprovedRequests = document.getElementById('admin-total-approved');
      const totalRejectedRequests = document.getElementById('admin-total-rejected');

      console.log('🔧 Inicializando sistema de recompensas...');
      console.log('Modal:', rewardsModal ? '✅' : '❌');
      console.log('Botón abrir:', rewardsOpenBtn ? '✅' : '❌');
      console.log('Botón cerrar:', rewardsCloseBtn ? '✅' : '❌');

      // Configuración del sistema de puntos
      // NOTA: Esta es la configuración global para la UI.
      // Los valores reales deben coincidir con lo que el bot usa.
      const POINTS_CONFIG = {
        SONG_REQUEST: 25,
        DAILY_BONUS: 5,
        CHECKIN_MIN: 1,
        CHECKIN_MAX: 12,
        STREAK_MULTIPLIER: 2,
        VIP_BONUS: 40,
        LIKES_PER_POINT: 300 // Este valor es solo para visualización
      };

      // Configuración de niveles
      const LEVELS = [
        { level: 1, name: 'Novato', xpRequired: 0 },
        { level: 2, name: 'Aficionado', xpRequired: 100 },
        { level: 3, name: 'Melómano', xpRequired: 250 },
        { level: 4, name: 'Experto', xpRequired: 500 },
        { level: 5, name: 'Maestro', xpRequired: 1000 },
        { level: 6, name: 'Virtuoso', xpRequired: 2000 },
        { level: 7, name: 'Leyenda', xpRequired: 5000 }
      ];

      // Configuración de recompensas
      // Se carga inicialmente con valores por defecto, pero se sobrescribe con lo que haya en Firestore si existe
      let REWARDS = [
        {
          id: 'next',
          name: 'NEXT',
          description: 'Tu canción será la siguiente en reproducirse',
          cost: 690,
          icon: '⏭️'
        },
        {
          id: 'two_songs',
          name: '2 CANCIONES',
          description: 'Pide dos canciones que se reproducirán seguidas',
          cost: 3600,
          icon: '🎵'
        },
        {
          id: 'next_v2',
          name: 'NEXT V2',
          description: 'Interrumpe la canción actual y reproduce la tuya',
          cost: 1000,
          icon: '⚡'
        },
        {
          id: 'vip_day',
          name: 'VIP POR 1 DÍA',
          description: 'Obtén beneficios VIP por 24 horas',
          cost: 1500,
          icon: '👑'
        },
        {
          id: 'become_fan',
          name: 'CONVIÉRTETE EN VIP',
          description: 'Obtén el estado VIP permanente',
          cost: 21000,
          icon: '👑'
        },
        {
          id: 'weekly_priority',
          name: 'PRIORIDAD SEMANAL',
          description: 'Tus canciones tendrán prioridad por una semana (1 canción)',
          cost: 6000,
          icon: '🌟'
        },
        {
          id: 'custom_badge',
          name: 'INSIGNIA PERSONALIZADA',
          description: 'Crea una insignia personalizada para tu perfil',
          cost: 12000,
          icon: '🏆'
        },
        {
          id: 'roulette_spin_1',
          name: 'TIRO DE RULETA',
          description: 'Compra 1 tiro de ruleta (75 pts). Tu canción solo se tocará si tu nombre sale elegido en la ruleta.',
          cost: 75,
          icon: '🎡'
        },
        {
          id: 'roulette_spin_3',
          name: '3 TIROS DE RULETA',
          description: 'Compra 3 tiros de ruleta (200 pts). Tu canción solo se tocará si tu nombre sale elegido en la ruleta.',
          cost: 200,
          icon: '🎡'
        }
      ];

      // Función para cargar configuración de recompensas desde Firestore
      async function loadRewardsConfig() {
        if (!window.db) return;
        try {
          const doc = await window.db.collection('systemConfig').doc('rewardsConfig').get();
          if (doc.exists) {
            const data = doc.data();
            if (Array.isArray(data.list)) {
              console.log('📦 Configuración de recompensas cargada desde Firestore');
              const remote = data.list;
              const byId = new Map();
              remote.forEach((r) => { if (r && r.id) byId.set(String(r.id), r); });
              REWARDS.forEach((r) => { if (r && r.id && !byId.has(String(r.id))) remote.push(r); });
              REWARDS = remote;
              // Si el modal está abierto, refrescarlo
              if (document.getElementById('rewards-modal').style.display === 'flex') {
                renderRewardsModal();
              }
            }
          }
        } catch (e) {
          console.error('Error cargando configuración de recompensas:', e);
        }
      }

      // Cargar al inicio (enganchado a DOMContentLoaded)
      document.addEventListener('DOMContentLoaded', () => {
        // Intentar cargar configuración inmediatamente si db está listo, o reintentar brevemente
        const initRewards = async () => {
          if (window.db) {
            // Cargar alias primero para que normalización funcione
            try { await loadUserAliases(); } catch (_) { }
            try { await loadRewardsConfig(); } catch (_) { }
          } else {
            setTimeout(initRewards, 500);
          }
        };
        initRewards();

        // Iniciar Check-in system
        setTimeout(initCheckInSystem, 3000);
      });

      // ===== SISTEMA DE CHECK-IN DIARIO =====
      async function initCheckInSystem() {
        if (window.__checkInInitRunning) return;
        window.__checkInInitRunning = true;
        try {
          const userRaw = getCurrentUser();
          const userKey = userRaw ? normalizeUserKey(userRaw) : '';
          if (!userRaw || !userKey) return;
          if (!window.db) {
            setTimeout(initCheckInSystem, 1000);
            return;
          }

          let btn = document.getElementById('daily-checkin-btn');
          if (!btn) {
            btn = document.createElement('div');
            btn.id = 'daily-checkin-btn';
            btn.innerHTML = '🎁';
            btn.title = 'Reclamar Bono Diario';
            Object.assign(btn.style, {
              position: 'fixed',
              bottom: '80px',
              right: '20px',
              width: '50px',
              height: '50px',
              background: 'linear-gradient(135deg, #FFD700, #FFA500)',
              borderRadius: '50%',
              boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)',
              display: 'none',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '24px',
              cursor: 'pointer',
              zIndex: '9999',
              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            });
            document.body.appendChild(btn);
          }

          if (!document.getElementById('checkin-style')) {
            const style = document.createElement('style');
            style.id = 'checkin-style';
            style.innerHTML = `
           @keyframes checkin-pulse {
             0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7); }
             70% { transform: scale(1.1); box-shadow: 0 0 0 15px rgba(255, 215, 0, 0); }
             100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 215, 0, 0); }
           }
           @keyframes checkin-pop {
             0% { transform: scale(1); }
             50% { transform: scale(1.4); opacity: 1; }
             100% { transform: scale(0); opacity: 0; }
           }
           @keyframes checkin-ripple {
             0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0.0; }
             20% { opacity: 0.55; }
             100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
           }
           @keyframes checkin-sparkle {
             0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
             20% { opacity: 1; }
             100% { transform: translate(-50%, -50%) scale(1.0); opacity: 0; }
           }
           @keyframes checkin-plus {
             0% { transform: translate(-50%, 0) scale(0.85); opacity: 0; }
             15% { opacity: 1; }
             100% { transform: translate(-50%, -22px) scale(1); opacity: 0; }
           }
           .checkin-available { animation: checkin-pulse 2s infinite; }
           .checkin-claimed { animation: checkin-pop 0.5s forwards; pointer-events: none; }
           .checkin-disabled { 
             background: #ccc !important; 
             background-image: none !important; 
             box-shadow: none !important; 
             cursor: default !important; 
             transform: scale(0.9) !important; 
             animation: none !important; 
             opacity: 0.8; 
             filter: grayscale(100%);
           }
           #checkin-fx-layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; overflow: visible; }
           .checkin-ripple { position: fixed; width: 120px; height: 120px; border-radius: 999px; border: 2px solid rgba(255,215,0,0.55); box-shadow: 0 0 22px rgba(255,215,0,0.22); animation: checkin-ripple 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
           .checkin-sparkle-dot { position: fixed; width: 8px; height: 8px; border-radius: 999px; background: rgba(255,255,255,0.95); box-shadow: 0 0 10px rgba(255,215,0,0.55); animation: checkin-sparkle 650ms cubic-bezier(0.2, 1, 0.25, 1) forwards; }
           .checkin-coin { position: fixed; width: 10px; height: 10px; border-radius: 999px; background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85), rgba(255,215,0,0.9) 50%, rgba(255,165,0,0.95)); box-shadow: 0 8px 16px rgba(0,0,0,0.18), 0 0 14px rgba(255,215,0,0.35); }
           .checkin-plus { position: fixed; padding: 6px 10px; border-radius: 999px; background: rgba(17,24,39,0.88); color: #fff; font-weight: 900; font-size: 12px; letter-spacing: 0.2px; border: 1px solid rgba(255,255,255,0.18); box-shadow: 0 10px 22px rgba(0,0,0,0.35); animation: checkin-plus 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards; backdrop-filter: blur(10px); }
         `;
            document.head.appendChild(style);
          }

          if (!window.playCheckinRedeemFx) {
            window.playCheckinRedeemFx = function (fromEl, points) {
              try {
                const src = fromEl;
                const dst = document.getElementById('user-points');
                if (!src || !dst) return;
                const srcRect = src.getBoundingClientRect();
                const dstRect = dst.getBoundingClientRect();
                const sx = srcRect.left + srcRect.width / 2;
                const sy = srcRect.top + srcRect.height / 2;
                const tx = dstRect.left + dstRect.width / 2;
                const ty = dstRect.top + dstRect.height / 2;

                let layer = document.getElementById('checkin-fx-layer');
                if (!layer) {
                  layer = document.createElement('div');
                  layer.id = 'checkin-fx-layer';
                  document.body.appendChild(layer);
                }

                const ripple = document.createElement('div');
                ripple.className = 'checkin-ripple';
                ripple.style.left = sx + 'px';
                ripple.style.top = sy + 'px';
                layer.appendChild(ripple);
                setTimeout(() => { try { ripple.remove(); } catch (_) { } }, 800);

                for (let i = 0; i < 18; i++) {
                  const a = Math.random() * Math.PI * 2;
                  const r = 10 + Math.random() * 22;
                  const dot = document.createElement('div');
                  dot.className = 'checkin-sparkle-dot';
                  dot.style.left = (sx + Math.cos(a) * r) + 'px';
                  dot.style.top = (sy + Math.sin(a) * r) + 'px';
                  layer.appendChild(dot);
                  setTimeout(() => { try { dot.remove(); } catch (_) { } }, 800);
                }

                const n = Math.max(1, Math.min(12, Number(points) || 1));
                for (let i = 0; i < n; i++) {
                  const coin = document.createElement('div');
                  coin.className = 'checkin-coin';
                  coin.style.left = sx + 'px';
                  coin.style.top = sy + 'px';
                  layer.appendChild(coin);
                  const jitterX = (Math.random() - 0.5) * 80;
                  const jitterY = -20 - Math.random() * 90;
                  const midX = sx + (tx - sx) * 0.35 + jitterX;
                  const midY = sy + (ty - sy) * 0.35 + jitterY;
                  const dur = 650 + Math.round(Math.random() * 240);
                  const delay = Math.round(Math.random() * 110);
                  coin.animate([
                    { transform: 'translate(-50%, -50%) translate(0px,0px) scale(1)', opacity: 1 },
                    { transform: `translate(-50%, -50%) translate(${midX - sx}px,${midY - sy}px) scale(1)`, opacity: 1, offset: 0.62 },
                    { transform: `translate(-50%, -50%) translate(${tx - sx}px,${ty - sy}px) scale(0.6)`, opacity: 0.0 }
                  ], { duration: dur, delay, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }).onfinish = () => { try { coin.remove(); } catch (_) { } };
                }

                const plus = document.createElement('div');
                plus.className = 'checkin-plus';
                plus.textContent = `+${n} puntos`;
                plus.style.left = tx + 'px';
                plus.style.top = (ty + 18) + 'px';
                layer.appendChild(plus);
                setTimeout(() => { try { plus.remove(); } catch (_) { } }, 1100);

                try {
                  const raw = String(dst.textContent || '').replace(/[^\d]/g, '');
                  const base = raw ? parseInt(raw, 10) : 0;
                  const target = base + n;
                  const start = performance.now();
                  const total = 750;
                  const fmt = (v) => Number(v || 0).toLocaleString('es');
                  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
                  function step(now) {
                    const t = Math.min(1, (now - start) / total);
                    const val = Math.round(base + (target - base) * easeOutCubic(t));
                    dst.textContent = fmt(val);
                    if (t < 1) requestAnimationFrame(step);
                  }
                  requestAnimationFrame(step);
                } catch (_) { }
              } catch (_) { }
            };
          }

          // Función auxiliar para calcular tiempo restante hasta medianoche
          const getTimeUntilMidnight = () => {
            const now = new Date();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            const diff = tomorrow - now;
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            return `${hours}h ${minutes}m`;
          };

          try {
            // Verificar localStorage primero para feedback instantáneo
            const storageKey = 'lastCheckInDate_' + userKey;
            const lastCheckInStr = localStorage.getItem(storageKey);
            const now = new Date();
            const todayStr = typeof window.getLocalDateKey === 'function' ? window.getLocalDateKey(now) : now.toDateString();

            // Si localStorage dice que ya reclamó hoy, mostrar estado gris
            // PERO no hacer return para permitir verificación con Firestore al hacer click
            if (lastCheckInStr === todayStr) {
              btn.classList.add('checkin-disabled');
              btn.classList.remove('checkin-available');
              btn.style.display = 'flex';
              btn.title = `Vuelve en ${getTimeUntilMidnight()}`;
              btn.onclick = (e) => {
                try { if (e && e.shiftKey && typeof window.playCheckinRedeemFx === 'function') { window.playCheckinRedeemFx(btn, 12); return; } } catch (_) { }
                showErrorNotification(`Ya reclamaste tu regalo de hoy. Vuelve en ${getTimeUntilMidnight()}.`);
              };
              // NO RETURN: Permitir que el flujo siga
            }

            // Verificar Firestore (fuente de verdad)
            const normUser = userKey;
            const userDocRef = db.collection('userStats').doc(normUser);
            const doc = await userDocRef.get();
            let canClaim = true;

            if (doc.exists) {
              const data = doc.data();
              if (data.lastCheckIn) {
                const lastDate = data.lastCheckIn.toDate();
                const now = new Date();
                // Verificar si es el mismo día local (reset a medianoche)
                const lastDateStr = typeof window.getLocalDateKey === 'function' ? window.getLocalDateKey(lastDate) : lastDate.toDateString();
                const todayStr = typeof window.getLocalDateKey === 'function' ? window.getLocalDateKey(now) : now.toDateString();

                if (lastDateStr === todayStr) {
                  canClaim = false;
                  // No hay "nextClaimTime" exacto, es "mañana"
                  localStorage.setItem(storageKey, todayStr); // Actualizar local

                  // Reforzar estado visual
                  btn.classList.add('checkin-disabled');
                  btn.classList.remove('checkin-available');
                  btn.style.display = 'flex';
                  btn.title = `Vuelve en ${getTimeUntilMidnight()}`;
                  btn.onclick = (e) => {
                    try { if (e && e.shiftKey && typeof window.playCheckinRedeemFx === 'function') { window.playCheckinRedeemFx(btn, 12); return; } } catch (_) { }
                    showErrorNotification(`Ya reclamaste tu regalo de hoy. Vuelve en ${getTimeUntilMidnight()}.`);
                  };
                }
              }
            }

            if (canClaim) {
              // Si Firestore dice que sí puede, forzamos estado disponible
              btn.style.display = 'flex';
              btn.classList.add('checkin-available');
              btn.classList.remove('checkin-disabled');
              btn.title = 'Reclamar Bono Diario';

              btn.onclick = async () => {
                if (btn.classList.contains('processing')) return;
                btn.classList.add('processing');

                try {
                  // Validación de servidor temporal (Hallazgo 6)
                  let now = new Date();
                  try {
                    const resp = await fetch(window.location.href.split('?')[0], { method: 'HEAD', cache: 'no-store' });
                    const dateHeader = resp.headers.get('Date');
                    if (dateHeader) now = new Date(dateHeader);
                  } catch(e) { console.warn("Fallback to local time"); }

                  // 1. Re-verificar Cooldown de Usuario (Evitar exploit de pestaña abierta)
                  const latestUserDoc = await db.collection('userStats').doc(normUser).get();
                  if (latestUserDoc.exists) {
                    const data = latestUserDoc.data();
                    if (data.lastCheckIn) {
                      const lastDate = data.lastCheckIn.toDate();
                      const lastDateStr = typeof window.getLocalDateKey === 'function' ? window.getLocalDateKey(lastDate) : lastDate.toDateString();
                      const nowStr = typeof window.getLocalDateKey === 'function' ? window.getLocalDateKey(now) : now.toDateString();
                      if (lastDateStr === nowStr) {
                        throw new Error(`Ya has reclamado tu regalo de hoy. Vuelve en ${getTimeUntilMidnight()}.`);
                      }
                    }
                  }

                  // 2. Verificar dispositivo primero (Anti-farming)
                  if (typeof generateDeviceFingerprint === 'function') {
                    const fingerprint = generateDeviceFingerprint();
                    // Usar fecha del servidor para el ID del dispositivo (reset diario seguro)
                    const dateStr = typeof window.getLocalDateKey === 'function' ? window.getLocalDateKey(now) : (now.getFullYear() + '-' + (now.getMonth() + 1).toString().padStart(2, '0') + '-' + now.getDate().toString().padStart(2, '0'));
                    const fingerHash = fingerprint.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
                    const deviceDocId = `${dateStr}_${Math.abs(fingerHash)}`;
                    const deviceRef = db.collection('dailyCheckIns').doc(deviceDocId);

                    const deviceDoc = await deviceRef.get();
                    if (deviceDoc.exists) {
                      throw new Error(`Este dispositivo ya ha reclamado el premio hoy. Vuelve en ${getTimeUntilMidnight()}.`);
                    }
                  }

                  // Efecto visual - Transición a gris
                  btn.classList.remove('checkin-available');
                  btn.classList.add('checkin-disabled');
                  btn.title = `Vuelve en ${getTimeUntilMidnight()}`;

                  // Calcular puntos aleatorios (1-12)
                  const points = Math.floor(Math.random() * (POINTS_CONFIG.CHECKIN_MAX - POINTS_CONFIG.CHECKIN_MIN + 1)) + POINTS_CONFIG.CHECKIN_MIN;

                  const batch = db.batch();

                  // A. Actualizar Usuario
                  const userRef = db.collection('userStats').doc(normUser);
                  batch.set(userRef, {
                    totalCheckInPoints: firebase.firestore.FieldValue.increment(points),
                    lastCheckIn: firebase.firestore.FieldValue.serverTimestamp(),
                    totalPoints: firebase.firestore.FieldValue.increment(points)
                  }, { merge: true });

                  // B. Registrar Dispositivo
                  if (typeof generateDeviceFingerprint === 'function') {
                    const fingerprint = generateDeviceFingerprint();
                    const dateStr = typeof window.getLocalDateKey === 'function' ? window.getLocalDateKey(now) : (now.getFullYear() + '-' + (now.getMonth() + 1).toString().padStart(2, '0') + '-' + now.getDate().toString().padStart(2, '0'));
                    const fingerHash = fingerprint.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
                    const deviceDocId = `${dateStr}_${Math.abs(fingerHash)}`;
                    const deviceRef = db.collection('dailyCheckIns').doc(deviceDocId);

                    batch.set(deviceRef, {
                      fingerprint: fingerprint,
                      user: userRaw,
                      timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                  }

                  // C. Actualizar datos locales de gamificación para evitar sobrescritura
                  try {
                    const localData = getGamificationDataForUser(userRaw);
                    localData.checkInPoints = (Number(localData.checkInPoints) || 0) + points;
                    // También sumar al total local temporalmente para reflejo inmediato
                    localData.points = (Number(localData.points) || 0) + points;
                    saveGamificationDataForUser(localData, userRaw);
                  } catch (e) {
                    console.error('Error actualizando datos locales de check-in:', e);
                  }

                  await batch.commit();

                  // Guardar local
                  localStorage.setItem(storageKey, typeof window.getLocalDateKey === 'function' ? window.getLocalDateKey() : new Date().toDateString());
                  try { if (typeof window.playCheckinRedeemFx === 'function') window.playCheckinRedeemFx(btn, points); } catch (_) { }
                  showSuccessNotification(`¡Bono diario reclamado! +${points} puntos. Vuelve en ${getTimeUntilMidnight()}.`);

                  // Actualizar UI de puntos
                  setTimeout(() => {
                    analyzeAndGrantPointsForUser(userRaw);
                    updateUserHeaderUI(userRaw);
                  }, 1000);
                  btn.classList.remove('processing');

                } catch (err) {
                  console.error('Error claiming check-in:', err);

                  // Mostrar siempre el mensaje de error real para debugging si es necesario, 
                  // o formatearlo si es uno de los conocidos.
                  let userMsg = err.message || 'Error al reclamar. Inténtalo de nuevo.';

                  const isDeviceError = err.message && err.message.includes('dispositivo');
                  const isDateError = err.message && (err.message.includes('hoy') || err.message.includes('mañana'));

                  showErrorNotification(userMsg);

                  // Si es error de validación (ya reclamado), mantener estado deshabilitado
                  if (isDeviceError || isDateError) {
                    btn.classList.remove('checkin-available');
                    btn.classList.add('checkin-disabled');
                    btn.classList.remove('processing');
                    btn.title = `Vuelve en ${getTimeUntilMidnight()}`;
                    btn.onclick = () => showErrorNotification(userMsg);
                  } else {
                    // Si es error de red u otro, permitir reintentar
                    btn.classList.remove('checkin-disabled');
                    btn.classList.add('checkin-available');
                    btn.classList.remove('processing');
                    btn.title = 'Reclamar Bono Diario';
                  }
                }
              };
            } else {
              // No puede reclamar (ya validado en Firestore)
              btn.classList.add('checkin-disabled');
              btn.style.display = 'flex';
              btn.title = `Vuelve en ${getTimeUntilMidnight()}`;
              btn.onclick = () => { showErrorNotification(`Ya reclamaste tu regalo de hoy. Vuelve en ${getTimeUntilMidnight()}.`); };
            }
          } catch (e) {
            console.error('Error check-in init:', e);
          }
        } finally {
          window.__checkInInitRunning = false;
        }
      }

      // Configuración de logros
      const ACHIEVEMENTS = [
        {
          id: 'first_song',
          title: 'Primera Canción',
          description: 'Pide tu primera canción',
          icon: '🎵',
          points: 25,
          condition: (stats) => (stats.totalPlayedSongs || 0) >= 1
        },
        {
          id: 'music_lover',
          title: 'Amante de la Música',
          description: 'Pide 10 canciones',
          icon: '🎶',
          points: 50,
          condition: (stats) => (stats.totalPlayedSongs || 0) >= 10
        },
        {
          id: 'music_addict',
          title: 'Adicto a la Música',
          description: 'Pide 50 canciones',
          icon: '🎸',
          points: 100,
          condition: (stats) => (stats.totalPlayedSongs || 0) >= 50
        },
        {
          id: 'music_master',
          title: 'Maestro Musical',
          description: 'Pide 100 canciones',
          icon: '🎹',
          points: 200,
          condition: (stats) => (stats.totalPlayedSongs || 0) >= 100
        },
        // Progresión por canciones nuevas
        {
          id: 'music_pro_200',
          title: 'Pro de la Música',
          description: 'Pide 200 canciones',
          icon: '🎧',
          points: 250,
          condition: (stats) => (stats.totalPlayedSongs || 0) >= 200
        },
        {
          id: 'music_elite_500',
          title: 'Élite Musical',
          description: 'Pide 500 canciones',
          icon: '🏅',
          points: 800,
          condition: (stats) => (stats.totalPlayedSongs || 0) >= 500
        },
        {
          id: 'music_legend_1000',
          title: 'Leyenda Musical',
          description: 'Pide 1000 canciones',
          icon: '👑',
          points: 2000,
          condition: (stats) => (stats.totalPlayedSongs || 0) >= 1000
        },
        // Variedad de artistas existentes y nuevas
        {
          id: 'diverse_taste',
          title: 'Gusto Diverso',
          description: 'Pide canciones de 10 artistas diferentes',
          icon: '🌟',
          points: 75,
          condition: (stats) => (stats.uniqueArtistsPlayed || 0) >= 10
        },
        {
          id: 'explorer',
          title: 'Explorador Musical',
          description: 'Pide canciones de 25 artistas diferentes',
          icon: '🗺️',
          points: 150,
          condition: (stats) => (stats.uniqueArtistsPlayed || 0) >= 25
        },
        {
          id: 'varied_tastes_30',
          title: 'Gustos Variados',
          description: 'Pide canciones de 30 artistas diferentes',
          icon: '🌈',
          points: 300,
          condition: (stats) => (stats.uniqueArtistsPlayed || 0) >= 30
        },
        {
          id: 'diverse_50',
          title: 'Curador Musical',
          description: 'Pide canciones de 50 artistas diferentes',
          icon: '🧩',
          points: 500,
          condition: (stats) => (stats.uniqueArtistsPlayed || 0) >= 50
        },
        {
          id: 'diverse_100',
          title: 'Enciclopedia Musical',
          description: 'Pide canciones de 100 artistas diferentes',
          icon: '📚',
          points: 1500,
          condition: (stats) => (stats.uniqueArtistsPlayed || 0) >= 100
        },
        // Rachas existentes y nuevas
        {
          id: 'streak_starter',
          title: 'Inicio de Racha',
          description: 'Mantén una racha de 3 días',
          icon: '🔥',
          points: 50,
          condition: (stats) => stats.bestStreak >= 3
        },
        {
          id: 'streak_master',
          title: 'Maestro de Rachas',
          description: 'Mantén una racha de 7 días',
          icon: '🏆',
          points: 100,
          condition: (stats) => stats.bestStreak >= 7
        },
        {
          id: 'streak_legend',
          title: 'Leyenda de Rachas',
          description: 'Mantén una racha de 30 días',
          icon: '👑',
          points: 300,
          condition: (stats) => stats.bestStreak >= 30
        },
        {
          id: 'streak_14',
          title: 'Racha 14',
          description: 'Mantén una racha de 14 días',
          icon: '🔥',
          points: 300,
          condition: (stats) => (stats.bestStreak || 0) >= 14
        },
        {
          id: 'streak_30',
          title: 'Racha 30',
          description: 'Mantén una racha de 30 días',
          icon: '🏆',
          points: 800,
          condition: (stats) => (stats.bestStreak || 0) >= 30
        },
        {
          id: 'streak_60',
          title: 'Racha 60',
          description: 'Mantén una racha de 60 días',
          icon: '🌟',
          points: 2000,
          condition: (stats) => (stats.bestStreak || 0) >= 60
        },
        // Días activos existentes y nuevos
        {
          id: 'daily_user',
          title: 'Usuario Diario',
          description: 'Usa la app durante 10 días diferentes',
          icon: '📅',
          points: 100,
          condition: (stats) => stats.activeDays >= 10
        },
        {
          id: 'daily_25',
          title: 'Constante',
          description: 'Usa la app 25 días distintos',
          icon: '📆',
          points: 250,
          condition: (stats) => (stats.activeDays || 0) >= 25
        },
        {
          id: 'daily_50',
          title: 'Persistente',
          description: 'Usa la app 50 días distintos',
          icon: '🗓️',
          points: 600,
          condition: (stats) => (stats.activeDays || 0) >= 50
        },
        {
          id: 'daily_100',
          title: 'Inquebrantable',
          description: 'Usa la app 100 días distintos',
          icon: '📅',
          points: 1500,
          condition: (stats) => (stats.activeDays || 0) >= 100
        },
        // Insignias existentes
        {
          id: 'vip_member',
          title: 'Miembro VIP',
          description: 'Conviértete en usuario VIP',
          icon: '👑',
          points: 1200,
          condition: (stats) => stats.isVip
        },
        {
          id: 'z0_vip_member',
          title: 'Z0-VIP Exclusivo',
          description: 'Obtén el estatus Z0-VIP especial',
          icon: '💜',
          points: 1500,
          condition: (stats) => stats.isZ0Vip
        },
        {
          id: 'donador_member',
          title: 'Donador Generoso',
          description: 'Apoya la plataforma como donador',
          icon: '💎',
          points: 250,
          condition: (stats) => stats.isDonador
        },
        // Mismo artista existentes y nuevos
        {
          id: 'same_artist_5',
          title: 'Fan Fiel',
          description: 'Pide 5 canciones del mismo artista',
          icon: '📀',
          points: 100,
          condition: (stats) => (stats.topArtistCountPlayed || 0) >= 5
        },
        {
          id: 'same_artist_10',
          title: 'Fan Devoto',
          description: 'Pide 10 canciones del mismo artista',
          icon: '💿',
          points: 250,
          condition: (stats) => (stats.topArtistCountPlayed || 0) >= 10
        },
        {
          id: 'same_artist_20',
          title: 'Fan Acérrimo',
          description: 'Pide 20 canciones del mismo artista',
          icon: '💿',
          points: 600,
          condition: (stats) => (stats.topArtistCountPlayed || 0) >= 20
        },
        {
          id: 'same_artist_50',
          title: 'Fan Histórico',
          description: 'Pide 50 canciones del mismo artista',
          icon: '🏛️',
          points: 2000,
          condition: (stats) => (stats.topArtistCountPlayed || 0) >= 50
        },
        // Ser el primero en pedir
        {
          id: 'first_request_1',
          title: 'Primero en la fila',
          description: 'Sé el primero en pedir 1 vez',
          icon: '⏰',
          points: 50,
          condition: (stats) => (stats.firstRequests || 0) >= 1
        },
        {
          id: 'first_request_3',
          title: 'Rápido y Furioso',
          description: 'Sé el primero en pedir 3 veces',
          icon: '⚡',
          points: 150,
          condition: (stats) => (stats.firstRequests || 0) >= 3
        },
        {
          id: 'first_request_6',
          title: 'Sprint',
          description: 'Sé el primero en pedir 6 veces',
          icon: '🏃',
          points: 300,
          condition: (stats) => (stats.firstRequests || 0) >= 6
        },
        {
          id: 'first_request_9',
          title: 'Velocista',
          description: 'Sé el primero en pedir 9 veces',
          icon: '🚀',
          points: 500,
          condition: (stats) => (stats.firstRequests || 0) >= 9
        },
        {
          id: 'first_request_12',
          title: 'Marcapasos',
          description: 'Sé el primero en pedir 12 veces',
          icon: '🏁',
          points: 800,
          condition: (stats) => (stats.firstRequests || 0) >= 12
        },
        {
          id: 'first_request_15',
          title: 'Siempre Primero',
          description: 'Sé el primero en pedir 15 veces',
          icon: '🥇',
          points: 1200,
          condition: (stats) => (stats.firstRequests || 0) >= 15
        },
        {
          id: 'first_request_18',
          title: 'Reflejos de Acero',
          description: 'Sé el primero en pedir 18 veces',
          icon: '🛡️',
          points: 1600,
          condition: (stats) => (stats.firstRequests || 0) >= 18
        },
        {
          id: 'first_request_21',
          title: 'Imbatible',
          description: 'Sé el primero en pedir 21 veces',
          icon: '🏆',
          points: 2000,
          condition: (stats) => (stats.firstRequests || 0) >= 21
        },
        {
          id: 'zerofm_listener_1',
          title: 'Zero FM: Primer Pedido',
          description: 'Pide una canción de Zero FM.',
          icon: '🎧',
          points: 100,
          condition: (stats) => (stats.zeroFMSongsPlayed || 0) >= 1
        },
        {
          id: 'zerofm_listener_3',
          title: 'Zero FM: Nivel 3',
          description: 'Pide 3 canciones de Zero FM.',
          icon: '🎧',
          points: 300,
          condition: (stats) => (stats.zeroFMSongsPlayed || 0) >= 3
        },
        {
          id: 'zerofm_listener_6',
          title: 'Zero FM: Nivel 6',
          description: 'Pide 6 canciones de Zero FM.',
          icon: '🎧',
          points: 600,
          condition: (stats) => (stats.zeroFMSongsPlayed || 0) >= 6
        },
        {
          id: 'zerofm_listener_9',
          title: 'Zero FM: Nivel 9',
          description: 'Pide 9 canciones de Zero FM.',
          icon: '🎧',
          points: 1200,
          condition: (stats) => (stats.zeroFMSongsPlayed || 0) >= 9
        },
        {
          id: 'zerofm_listener_12',
          title: 'Zero FM: Nivel 12',
          description: 'Pide 12 canciones de Zero FM.',
          icon: '🎧',
          points: 3693,
          condition: (stats) => (stats.zeroFMSongsPlayed || 0) >= 12
        }
      ];

      // === MODO INMERSIVO ELIMINADO ===
      const immersiveToggle = document.getElementById('immersive-toggle');
      if (immersiveToggle) {
        // Eliminar listeners o elementos residuales si existen
        immersiveToggle.parentElement?.remove();
      }

      // Funciones del sistema de gamificación
      function getGamificationData() {
        return getGamificationDataForUser(getCurrentUser());
      }

      function saveGamificationData(data) {
        saveGamificationDataForUser(data, getCurrentUser());
      }

      function calculateUserStats() {
        return calculateUserStatsForUser(getCurrentUser());
      }

      window.getCurrentUser = function () {
        // Intentar obtener el usuario actual de diferentes fuentes
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('user') || localStorage.getItem('currentUser') || localStorage.getItem('savedUsername') || 'Usuario';
      }

      function addPoints(points, reason = '') {
        const data = getGamificationData();
        data.points += points;
        data.xp += points;

        // Verificar subida de nivel
        const newLevel = calculateLevel(data.xp);
        if (newLevel > data.level) {
          data.level = newLevel;
          showLevelUpNotification(newLevel);
        }

        saveGamificationData(data);
        return data;
      }

      function calculateLevel(xp) {
        for (let i = LEVELS.length - 1; i >= 0; i--) {
          if (xp >= LEVELS[i].xpRequired) {
            return LEVELS[i].level;
          }
        }
        return 1;
      }

      function getLevelInfo(level) {
        return LEVELS.find(l => l.level === level) || LEVELS[0];
      }

      function getNextLevelInfo(level) {
        return LEVELS.find(l => l.level === level + 1) || LEVELS[LEVELS.length - 1];
      }

      function updateStreak() {
        const data = getGamificationData();
        const currentUser = (typeof getCurrentUser === 'function')
          ? getCurrentUser()
          : (localStorage.getItem('currentUser') || '').trim();

        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        function getRequestsForDay(day) {
          const byDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');
          if (Array.isArray(byDay[day]) && byDay[day].length) return byDay[day];
          const arr = JSON.parse(localStorage.getItem('solicitudes') || '[]');
          return arr.filter(s => {
            const sday = s.day || (s.time ? new Date(s.time).toISOString().split('T')[0] : day);
            return sday === day;
          });
        }

        const todayRequests = getRequestsForDay(today);
        const distinctUsersToday = new Set(todayRequests.map(s => s && s.usuario)).size;
        const normCurrentUser = normalizeUserKey(currentUser);
        const userRequestedToday = todayRequests.some(s => s && normalizeUserKey(s.usuario) === normCurrentUser);

        const todayValid = distinctUsersToday >= 2 && userRequestedToday;
        if (!todayValid) {
          return data.streaks.current;
        }

        const yesterdayValid = !!data.streaks.calendar[yesterday];
        if (yesterdayValid) {
          data.streaks.current++;
        } else if (data.streaks.lastActivity !== today) {
          data.streaks.current = 1;
        }

        if (data.streaks.current > data.streaks.best) {
          data.streaks.best = data.streaks.current;
        }

        data.streaks.lastActivity = today;
        data.streaks.calendar[today] = true;

        saveGamificationData(data);
        return data.streaks.current;
      }

      async function calculateStreaksForUser(username, data, allSolicitudes) {
        try {
          console.log(`🔥 Calculando rachas para ${username}`);

          // Mapear usuarios distintos por día
          const usersByDay = {};
          allSolicitudes.forEach(s => {
            let day;
            if (s.day) {
              day = s.day;
            } else if (s.time) {
              day = new Date(s.time).toISOString().split('T')[0];
            } else if (s.ts) {
              try {
                day = new Date(s.ts).toISOString().split('T')[0];
              } catch (_) {
                day = new Date().toISOString().split('T')[0];
              }
            } else {
              day = new Date().toISOString().split('T')[0];
            }
            const user = s.usuario;
            if (!usersByDay[day]) usersByDay[day] = new Set();
            if (user) usersByDay[day].add(user);
          });

          // Días en los que el usuario solicitó algo
          const userDays = new Set();
          // Utilidad robusta para obtener el día (YYYY-MM-DD) desde una solicitud
          const getSongDay = (entry) => {
            try {
              if (entry.day && typeof entry.day === 'string') {
                const parts = entry.day.split('-');
                if (parts.length === 3) {
                  const y = parseInt(parts[0], 10);
                  const m = parseInt(parts[1], 10) - 1;
                  const d = parseInt(parts[2], 10);
                  const dt = new Date(y, m, d);
                  if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
                }
                const d2 = new Date(entry.day);
                if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0];
              }
              if (entry.ts) {
                const dt = entry.ts && entry.ts.toDate ? entry.ts.toDate() : new Date(entry.ts);
                if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
              }
              if (entry.time) {
                const dt = entry.time && entry.time.toDate ? entry.time.toDate() : new Date(entry.time);
                if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
              }
            } catch (_) { }
            return new Date().toISOString().split('T')[0];
          };
          const normUsername = normalizeUserKey(username);
          allSolicitudes.forEach(s => {
            if (s && normalizeUserKey(s.usuario) === normUsername) {
              const day = getSongDay(s);
              userDays.add(day);
            }
          });

          // Días válidos: al menos 2 usuarios distintos y el usuario solicitó
          const validDays = Array.from(userDays).filter(day => (usersByDay[day]?.size || 0) >= 2);
          const sortedDays = validDays.sort();
          console.log(`📅 Días válidos para racha de ${username}:`, sortedDays);

          if (sortedDays.length === 0) {
            data.streaks = {
              current: 0,
              best: Math.max(data.streaks?.best || 0, 0),
              lastActivity: null,
              calendar: {}
            };
            return;
          }

          // Construir calendario con días válidos
          const calendar = {};
          sortedDays.forEach(day => {
            calendar[day] = true;
          });

          // Calcular mejor racha histórica (días válidos consecutivos)
          let bestStreak = 0;
          let tempStreak = sortedDays.length ? 1 : 0;
          for (let i = 1; i < sortedDays.length; i++) {
            const curr = new Date(sortedDays[i]);
            const prev = new Date(sortedDays[i - 1]);
            const diff = (curr - prev) / (1000 * 60 * 60 * 24);
            if (diff === 1) {
              tempStreak++;
            } else {
              bestStreak = Math.max(bestStreak, tempStreak);
              tempStreak = 1;
            }
          }
          bestStreak = Math.max(bestStreak, tempStreak);

          // Calcular racha actual (hasta hoy o ayer)
          const today = new Date().toISOString().split('T')[0];
          const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          let currentStreak = 0;

          const lastActivityDay = sortedDays[sortedDays.length - 1];
          if (lastActivityDay === today || lastActivityDay === yesterday) {
            currentStreak = 1;
            for (let i = sortedDays.length - 2; i >= 0; i--) {
              const curr = new Date(sortedDays[i + 1]);
              const prev = new Date(sortedDays[i]);
              const diff = (curr - prev) / (1000 * 60 * 60 * 24);
              if (diff === 1) {
                currentStreak++;
              } else {
                break;
              }
            }
          } else {
            currentStreak = 0;
          }

          data.streaks = {
            current: currentStreak,
            best: Math.max(data.streaks?.best || 0, bestStreak),
            lastActivity: lastActivityDay || null,
            calendar
          };

          console.log(`🔥 Rachas (validadas) para ${username}:`, {
            current: data.streaks.current,
            best: data.streaks.best,
            lastActivity: data.streaks.lastActivity,
            totalValidDays: sortedDays.length
          });
        } catch (error) {
          console.error(`Error calculando rachas para ${username}:`, error);
          data.streaks = {
            current: 0,
            best: Math.max(data.streaks?.best || 0, 0),
            lastActivity: null,
            calendar: {}
          };
        }
      }

      function checkAchievements() {
        const data = getGamificationData();
        const stats = calculateUserStats();
        data.stats = { ...data.stats, ...stats };

        const newAchievements = [];

        ACHIEVEMENTS.forEach(achievement => {
          if (!data.achievements.includes(achievement.id) && achievement.condition(data.stats)) {
            data.achievements.push(achievement.id);
            newAchievements.push(achievement);
            // Solo otorgar puntos por logros NUEVOS, no por recargar la página
            data.points += achievement.points;
            data.xp += achievement.points;
          }
        });

        // Solo guardar y mostrar notificación si hay logros NUEVOS
        if (newAchievements.length > 0) {
          saveGamificationData(data);
          showAchievementNotification(newAchievements);
        } else {
          // Si no hay logros nuevos, solo actualizar stats sin cambiar puntos
          saveGamificationData(data);
        }

        return newAchievements;
      }

      function showLevelUpNotification(level) {
        const levelInfo = getLevelInfo(level);
        // Crear notificación temporal
        const notification = document.createElement('div');
        notification.className = 'level-up-notification';
        notification.innerHTML = `
          <div class="notification-content">
            <div class="notification-icon">🎉</div>
            <div class="notification-text">
              <strong>¡Nivel ${level}!</strong><br>
              Ahora eres ${levelInfo.name}
            </div>
          </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
          notification.remove();
        }, 4000);
      }

      function showAchievementNotification(achievements) {
        achievements.forEach((achievement, index) => {
          setTimeout(() => {
            const notification = document.createElement('div');
            notification.className = 'achievement-notification';
            notification.innerHTML = `
              <div class="notification-content">
                <div class="notification-icon">${achievement.icon}</div>
                <div class="notification-text">
                  <strong>¡Logro desbloqueado!</strong><br>
                  ${achievement.title} (+${achievement.points} pts)
                </div>
              </div>
            `;

            document.body.appendChild(notification);

            setTimeout(() => {
              notification.remove();
            }, 4000);
          }, index * 1000);
        });
      }

      async function renderGamificationModalBasic() {
        const data = getGamificationData();
        const currentLevel = getLevelInfo(data.level);
        const nextLevel = getNextLevelInfo(data.level);
        const progressPercent = ((data.xp - currentLevel.xpRequired) / (nextLevel.xpRequired - currentLevel.xpRequired)) * 100;

        // Actualizar información del usuario
        document.getElementById('user-name').textContent = getCurrentUser();
        document.getElementById('user-level-name').textContent = currentLevel.name;
        document.getElementById('user-level-number').textContent = `Nivel ${data.level}`;
        document.getElementById('user-points').textContent = data.points;

        // Actualizar barra de progreso
        const progressFillEl = document.getElementById('progress-fill');
        const currentXpEl = document.getElementById('current-xp');
        const nextLevelXpEl = document.getElementById('next-level-xp');

        if (progressFillEl) progressFillEl.style.width = `${Math.min(progressPercent, 100)}%`;
        if (currentXpEl) currentXpEl.textContent = data.xp - currentLevel.xpRequired;
        if (nextLevelXpEl) nextLevelXpEl.textContent = nextLevel.xpRequired - currentLevel.xpRequired;

        // Renderizar logros
        renderAchievements(data);

        // Renderizar rachas
        await renderStreaks(data);

        // Renderizar estadísticas personales
        renderPersonalStats(data);

        // Renderizar géneros favoritos
        renderFavoriteGenres();
      }

      function renderAchievements(data) {
        const container = document.getElementById('achievements-list');

        container.innerHTML = ACHIEVEMENTS.map(achievement => {
          const isUnlocked = Array.isArray(data.achievements) && data.achievements.includes(achievement.id);
          const prog = getAchievementProgress(achievement, data.stats);

          return `
            <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
              <div class="achievement-points">+${achievement.points}</div>
              <div class="achievement-icon">${achievement.icon}</div>
              <div class="achievement-title">${achievement.title}</div>
              <div class="achievement-description">${achievement.description}</div>
              ${prog ? `
              <div class="achievement-progress">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${prog.percent}%;"></div>
                </div>
                <div class="progress-text">${prog.current}/${prog.target} ${prog.unit}</div>
              </div>` : ''}
            </div>
          `;
        }).join('');
      }

      function getAchievementProgress(achievement, stats) {
        const id = achievement.id;
        const safe = (v) => typeof v === 'number' && isFinite(v) ? v : 0;

        // Objetivos por cantidad de canciones
        const songTargets = {
          first_song: 1, music_lover: 10, music_addict: 50, music_master: 100,
          music_pro_200: 200, music_elite_500: 500, music_legend_1000: 1000
        };
        if (id in songTargets) {
          // UNIFICACIÓN TOTAL: Usar el conteo de 'requestedCount' (121) para coincidir con la UI
          const current = safe(stats.requestedCount || stats.totalSongs || 0);
          const target = songTargets[id];
          return { current, target, unit: 'canciones', percent: Math.min(100, Math.round((current / target) * 100)) };
        }

        // Objetivos por artistas únicos
        const artistTargets = {
          diverse_taste: 10, explorer: 25, diverse_50: 50, diverse_100: 100
        };
        if (id in artistTargets) {
          const current = safe(stats.uniqueArtists || 0);
          const target = artistTargets[id];
          return { current, target, unit: 'artistas', percent: Math.min(100, Math.round((current / target) * 100)) };
        }

        // Objetivos por racha
        const streakTargets = {
          streak_starter: 3, streak_master: 7, streak_legend: 30,
          streak_14: 14, streak_30: 30, streak_60: 60
        };
        if (id in streakTargets) {
          const current = safe(stats.bestStreak || 0);
          const target = streakTargets[id];
          return { current, target, unit: 'días', percent: Math.min(100, Math.round((current / target) * 100)) };
        }

        // Objetivos por días activos
        const activeDayTargets = {
          daily_user: 10, daily_25: 25, daily_50: 50, daily_100: 100
        };
        if (id in activeDayTargets) {
          const current = safe(stats.activeDays || 0);
          const target = activeDayTargets[id];
          return { current, target, unit: 'días', percent: Math.min(100, Math.round((current / target) * 100)) };
        }

        // Objetivos por mismo artista
        const sameArtistTargets = {
          same_artist_5: 5, same_artist_10: 10, same_artist_20: 20, same_artist_50: 50
        };
        if (id in sameArtistTargets) {
          const current = safe(stats.topArtistCount || 0);
          const target = sameArtistTargets[id];
          return { current, target, unit: 'canciones', percent: Math.min(100, Math.round((current / target) * 100)) };
        }

        // Objetivos por ser el primero en pedir
        const firstRequestTargets = {
          first_request_1: 1, first_request_3: 3, first_request_6: 6, first_request_9: 9,
          first_request_12: 12, first_request_15: 15, first_request_18: 18, first_request_21: 21
        };
        if (id in firstRequestTargets) {
          const current = safe(stats.firstRequests || 0);
          const target = firstRequestTargets[id];
          return { current, target, unit: 'veces', percent: Math.min(100, Math.round((current / target) * 100)) };
        }

        // Progreso para logros Zero FM
        if (id === 'zerofm_listener_1' ||
          id === 'zerofm_listener_3' ||
          id === 'zerofm_listener_6' ||
          id === 'zerofm_listener_9' ||
          id === 'zerofm_listener_12') {
          const targetById = {
            zerofm_listener_1: 1,
            zerofm_listener_3: 3,
            zerofm_listener_6: 6,
            zerofm_listener_9: 9,
            zerofm_listener_12: 12,
          };
          const target = targetById[id] || 1;
          const current = safe(stats.zeroFMSongs || 0);
          const unit = 'pedido(s) Zero FM';
          const percent = Math.min(100, Math.floor((current / target) * 100));
          return { current, target, unit, percent };
        }

        // Logros de estado (VIP/Z0/Donador) no muestran progreso
        return null;
      }

      async function renderStreaks(data) {
        try {
          const currentUser = getCurrentUser();
          console.log(`🔥 Renderizando rachas oficiales para ${currentUser}`);

          // Las rachas ya vienen calculadas correctamente y autorizadas desde data.streaks
          const currentStreak = data.streaks?.current || 0;
          const bestStreak = data.streaks?.best || 0;

          console.log(`📊 Rachas leídas para ${currentUser}: actual=${currentStreak}, mejor=${bestStreak}`);

          const currentStreakEl = document.getElementById('current-streak');
          const bestStreakEl = document.getElementById('best-streak');

          if (currentStreakEl) {
            currentStreakEl.textContent = `${currentStreak} días`;
          }

          if (bestStreakEl) {
            bestStreakEl.textContent = `${bestStreak} días`;
          }

          // Renderizar calendario de actividad
          await renderStreakCalendar();

        } catch (error) {
          console.error('Error renderizando rachas:', error);

          // Valores por defecto en caso de error
          const currentStreakEl = document.getElementById('current-streak');
          const bestStreakEl = document.getElementById('best-streak');

          if (currentStreakEl) currentStreakEl.textContent = '0 días';
          if (bestStreakEl) bestStreakEl.textContent = '0 días';

          // Renderizar calendario con datos del usuario actual
          await renderStreakCalendar();
        }
      }

      // Estado del mes/año mostrado (calendario de rachas)
      let currentCalendarMonth = new Date().getMonth();
      let currentCalendarYear = new Date().getFullYear();

      async function renderStreakCalendar(calendar) {
        try {
          const container = document.getElementById('streak-calendar-grid');
          if (!container) return;

          const currentUser = getCurrentSelectedUser();

          // Actividad del usuario para el mes mostrado
          const userActivity = await getUserActivityForMonth(
            currentUser,
            currentCalendarYear,
            currentCalendarMonth
          );

          // Render del mes (6 semanas, 42 días)
          const days = generateMonthCalendar(
            currentCalendarYear,
            currentCalendarMonth,
            userActivity
          );

          container.innerHTML = days.join('');

          // Sincronizar selects de mes/año
          updateCalendarSelectors();
        } catch (error) {
          console.error('Error renderizando calendario de rachas:', error);
          const container = document.getElementById('streak-calendar-grid');
          if (container) {
            container.innerHTML = '<div class="calendar-day">Error al cargar actividad</div>';
          }
        }
      }

      function generateMonthCalendar(year, month, userActivity) {
        const today = new Date();
        const firstDay = new Date(year, month, 1);
        const startDate = new Date(firstDay);
        // Ajuste al domingo anterior
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        const days = [];
        const currentDate = new Date(startDate);

        // Generar 6 semanas para cubrir el mes
        for (let i = 0; i < 42; i++) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const isCurrentMonth = currentDate.getMonth() === month;
          const isToday = currentDate.toDateString() === today.toDateString();
          const activityCount = userActivity[dateStr] || 0;

          const classes = ['calendar-day'];
          let activityTitle = `${currentDate.getDate()}`;

          if (!isCurrentMonth) {
            classes.push('other-month');
            activityTitle += ' (otro mes)';
          } else {
            if (activityCount > 0) {
              if (activityCount >= 10) {
                classes.push('activity-very-high');
                activityTitle += ` - ${activityCount} canciones (Muy activo)`;
              } else if (activityCount >= 5) {
                classes.push('activity-high');
                activityTitle += ` - ${activityCount} canciones (Muy activo)`;
              } else if (activityCount >= 3) {
                classes.push('activity-medium');
                activityTitle += ` - ${activityCount} canciones (Activo)`;
              } else {
                classes.push('activity-low');
                activityTitle += ` - ${activityCount} canción${activityCount > 1 ? 'es' : ''} (Poco activo)`;
              }
            } else {
              activityTitle += ' - Sin actividad';
            }
          }

          if (isToday) classes.push('today');

          days.push(
            `<div class="${classes.join(' ')}" title="${activityTitle}">${currentDate.getDate()}</div>`
          );

          currentDate.setDate(currentDate.getDate() + 1);
        }

        return days;
      }

      async function getUserActivityForMonth(username, year, month) {
        try {
          // Intentar usar datos reales si la función existe
          if (typeof computeActivityForMonth === 'function') {
            const activity = await computeActivityForMonth(username, month, year);
            return activity || {};
          }
        } catch (e) {
          // Continuar con datos simulados
        }

        // Fallback con datos simulados por usuario y mes
        const result = {};
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const userHash = typeof hashCode === 'function' ? hashCode(username) : 0;
        const rng = typeof seedRandom === 'function' ? seedRandom(userHash) : null;

        for (let d = 1; d <= daysInMonth; d++) {
          const date = new Date(year, month, d);
          const dateStr = date.toISOString().split('T')[0];
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          let r = rng ? rng() : Math.random();
          let songs = 0;
          if (r < 0.05) songs = 0;
          else if (r < 0.25) songs = 1;
          else if (r < 0.5) songs = 2;
          else if (r < 0.75) songs = isWeekend ? 4 : 3;
          else if (r < 0.9) songs = isWeekend ? 5 : 4;
          else songs = isWeekend ? 6 : 5;
          result[dateStr] = songs;
        }

        return result;
      }

      function updateCalendarSelectors() {
        const monthSelect = document.getElementById('month-select');
        const yearSelect = document.getElementById('year-select');

        if (monthSelect) {
          monthSelect.value = String(currentCalendarMonth);
        }

        if (yearSelect) {
          const currentYear = new Date().getFullYear();
          // Mantener opciones razonables de años
          const existingYears = Array.from(yearSelect.options).map(o => parseInt(o.value, 10));
          if (!existingYears.length) {
            yearSelect.innerHTML = '';
            for (let year = currentYear - 2; year <= currentYear + 1; year++) {
              const option = document.createElement('option');
              option.value = String(year);
              option.textContent = String(year);
              yearSelect.appendChild(option);
            }
          }
          yearSelect.value = String(currentCalendarYear);
        }
      }

      function initializeCalendarNavigation() {
        const prevBtn = document.getElementById('prev-month');
        const nextBtn = document.getElementById('next-month');
        const monthSelect = document.getElementById('month-select');
        const yearSelect = document.getElementById('year-select');

        prevBtn?.addEventListener('click', () => {
          currentCalendarMonth--;
          if (currentCalendarMonth < 0) {
            currentCalendarMonth = 11;
            currentCalendarYear--;
          }
          renderStreakCalendar();
        });

        nextBtn?.addEventListener('click', () => {
          currentCalendarMonth++;
          if (currentCalendarMonth > 11) {
            currentCalendarMonth = 0;
            currentCalendarYear++;
          }
          renderStreakCalendar();
        });

        monthSelect?.addEventListener('change', (e) => {
          currentCalendarMonth = parseInt(e.target.value, 10);
          renderStreakCalendar();
        });

        yearSelect?.addEventListener('change', (e) => {
          currentCalendarYear = parseInt(e.target.value, 10);
          renderStreakCalendar();
        });
      }

      // Función auxiliar para obtener la actividad del usuario por días
      async function getUserActivityForDays(username, days) {
        try {
          console.log(`📊 Generando actividad individual para ${username} (últimos ${days} días)`);

          // Usar la función generateUserActivity para generar datos individuales consistentes
          const userActivity = await generateUserActivity(username, days);

          console.log(`✅ Actividad generada para ${username}:`, userActivity);
          console.log(`📅 Días con actividad: ${Object.keys(userActivity).filter(day => userActivity[day] > 0).length}`);

          return userActivity;
        } catch (error) {
          console.error('Error generando actividad del usuario:', error);
          return {};
        }
      }

      async function renderPersonalStats(data) {
        try {
          const user = typeof getCurrentSelectedUser === 'function' ? getCurrentSelectedUser() : getCurrentUser();
          await renderPersonalStatsForUser(data, user);
        } catch (error) {
          console.error('Error renderizando estadísticas personales:', error);
          const elements = [
            'personal-total-songs',
            'personal-unique-artists',
            'personal-active-days',
            'personal-rank'
          ];
          elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = id === 'personal-rank' ? '-' : '0';
          });
        }
      }

      async function renderFavoriteGenres() {
        try {
          const container = document.getElementById('favorite-genres-list');
          if (!container) return;
          const targetUser = typeof getCurrentSelectedUser === 'function' ? getCurrentSelectedUser() : getCurrentUser();
          async function normalizeExternalGenre(name, artist) {
            const g = String(name || '').toLowerCase();
            const a = String(artist || '').toLowerCase();
            if (!g) return null;
            if (g.includes('hip-hop') || g.includes('rap')) return 'Hip Hop';
            if (g.includes('r&b') || g.includes('soul')) return 'R&B';
            if (g.includes('electronic') || g.includes('dance')) return 'Electrónica';
            if (g.includes('rock')) return 'Rock';
            if (g.includes('indie')) return 'Indie';
            if (g.includes('reggae')) return 'Reggae';
            if (g.includes('latin')) {
              const latinReggaeton = ['bad bunny', 'j balvin', 'daddy yankee', 'ozuna', 'anuel', 'karol g', 'maluma', 'nicky jam', 'sech', 'farruko', 'arcangel'];
              const latinSalsa = ['marc anthony', 'la india', 'victor manuelle'];
              const latinBachata = ['romeo santos', 'aventura', 'prince royce'];
              const latinCumbia = ['los ángeles azules', 'angeles azules', 'grupo 5'];
              const latinRegional = ['grupo firme', 'peso pluma', 'fuerza regida', 'carin león', 'natanael cano', 'marca mp', 'christian nodal'];
              if (latinReggaeton.some(n => a.includes(n))) return 'Reggaeton';
              if (latinSalsa.some(n => a.includes(n))) return 'Salsa';
              if (latinBachata.some(n => a.includes(n))) return 'Bachata';
              if (latinCumbia.some(n => a.includes(n))) return 'Cumbia';
              if (latinRegional.some(n => a.includes(n))) return 'Regional';
              return 'Latino';
            }
            if (g.includes('pop')) return 'Pop';
            return null;
          }
          async function fetchItunesGenre(artist, song) {
            try {
              const term = encodeURIComponent(`${artist} ${song}`);
              const url = `https://itunes.apple.com/search?term=${term}&entity=song&limit=3`;
              const res = await fetch(url);
              if (!res.ok) return [];
              const data = await res.json();
              const out = [];
              for (const r of (data.results || [])) {
                const matchArtist = String(r.artistName || '').toLowerCase();
                const target = String(artist || '').toLowerCase();
                if (matchArtist && target && !matchArtist.includes(target)) continue;
                const norm = await normalizeExternalGenre(r.primaryGenreName, artist);
                if (norm) out.push(norm);
              }
              return Array.from(new Set(out)).slice(0, 2);
            } catch (_) {
              return [];
            }
          }
          async function inferGenres(artist, song) {
            const key = `${String(artist || '').toLowerCase()}|${String(song || '').toLowerCase()}`;
            const cacheStr = localStorage.getItem('genreCache') || '{}';
            const cache = JSON.parse(cacheStr);
            if (cache[key]) return cache[key];
            const web = await fetchItunesGenre(artist, song);
            if (web && web.length) {
              cache[key] = web;
              localStorage.setItem('genreCache', JSON.stringify(cache));
              return web;
            }
            const a = String(artist || '').toLowerCase();
            const t = String(song || '').toLowerCase();
            const contains = (k) => a.includes(k) || t.includes(k);
            const hits = [];
            if (contains('bachata') || ['romeo santos', 'aventura', 'prince royce'].some(n => a.includes(n))) hits.push('Bachata');
            if (contains('salsa') || ['marc anthony', 'la india', 'victor manuelle'].some(n => a.includes(n))) hits.push('Salsa');
            if (contains('cumbia') || ['los ángeles azules', 'angeles azules', 'grupo 5'].some(n => a.includes(n))) hits.push('Cumbia');
            if (contains('corridos') || contains('regional') || ['grupo firme', 'peso pluma', 'fuerza regida', 'carin león', 'natanael cano', 'marca mp', 'christian nodal'].some(n => a.includes(n))) hits.push('Regional');
            if (contains('reggaeton') || ['bad bunny', 'j balvin', 'daddy yankee', 'ozuna', 'anuel', 'karol g', 'maluma', 'nicky jam', 'sech', 'farruko', 'arcangel'].some(n => a.includes(n))) hits.push('Reggaeton');
            if (contains('trap') || ['myke towers', 'eladio carrion'].some(n => a.includes(n))) hits.push('Trap');
            if (contains('hip hop') || ['drake', 'kendrick lamar', 'travis scott', 'eminem', 'nicki minaj'].some(n => a.includes(n)) || a.startsWith('lil ')) hits.push('Hip Hop');
            if (contains('r&b') || ['the weeknd', 'bruno mars', 'sza', 'usher', 'chris brown'].some(n => a.includes(n))) hits.push('R&B');
            if (contains('electrónica') || contains('electro') || contains('edm') || ['calvin harris', 'avicii', 'tiesto', 'martin garrix', 'david guetta', 'daft punk', 'alesso', 'zedd', 'armin van buuren', 'afrojack'].some(n => a.includes(n))) hits.push('Electrónica');
            if (contains('house') || ['fred again', 'swedish house mafia'].some(n => a.includes(n))) hits.push('House');
            if (contains('rock') || ['metallica', 'ac/dc', 'linkin park', 'foo fighters', 'guns n', 'queen', 'nirvana', 'red hot chili peppers'].some(n => a.includes(n))) hits.push('Rock');
            if (contains('indie') || ['arctic monkeys', 'the killers', 'tame impala', 'lana del rey', 'mgmt'].some(n => a.includes(n))) hits.push('Indie');
            if (contains('jazz')) hits.push('Jazz');
            if (contains('folk')) hits.push('Folk');
            if (contains('funk')) hits.push('Funk');
            if (contains('soul') || ['adele', 'sam smith', 'al green'].some(n => a.includes(n))) hits.push('Soul');
            if (contains('vallenato') || ['silvestre dangond', 'diomedes diaz'].some(n => a.includes(n))) hits.push('Vallenato');
            if (contains('merengue') || ['juan luis guerra'].some(n => a.includes(n))) hits.push('Merengue');
            if (contains('reggae') || ['bob marley'].some(n => a.includes(n))) hits.push('Reggae');
            if (contains('k-pop') || ['bts', 'blackpink', 'stray kids', 'newjeans'].some(n => a.includes(n))) hits.push('K-Pop');
            if (contains('afrobeats') || ['burna boy', 'wizkid', 'tems', 'rema'].some(n => a.includes(n))) hits.push('Afrobeats');
            if (contains('pop') || ['taylor swift', 'ed sheeran', 'dua lipa', 'shakira', 'billie eilish', 'coldplay', 'harry styles', 'selena gomez', 'olivia rodrigo'].some(n => a.includes(n))) hits.push('Pop');
            const local = Array.from(new Set(hits)).slice(0, 2);
            cache[key] = local;
            localStorage.setItem('genreCache', JSON.stringify(cache));
            return local;
          }
          const all = await getAllCombinedSolicitudes();
          const norm = (x) => String(x || '').trim().replace(/^@/, '').toLowerCase();
          const userSongs = all.filter(s => norm(s.usuario) === norm(targetUser));
          const counts = {};
          for (const s of userSongs) {
            const gs = await inferGenres(s.artista, s.cancion);
            for (const g of gs) counts[g] = (counts[g] || 0) + 1;
          }
          let top = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([g]) => g);
          if (top.length < 3 && userSongs.length >= 6) {
            const seen = new Set(top);
            const candidates = ['Pop', 'Electrónica', 'Indie', 'Rock', 'Reggaeton'];
            for (const c of candidates) {
              if (!seen.has(c)) top.push(c);
              if (top.length >= 3) break;
            }
          }
          top = top.slice(0, 5);
          container.innerHTML = top.length
            ? top.map(genre => `<span class="genre-tag">${genre}</span>`).join('')
            : '<span class="genre-tag">Sin datos</span>';
        } catch (error) {
          const container = document.getElementById('favorite-genres-list');
          if (container) container.innerHTML = '<span class="genre-tag">Error cargando géneros</span>';
        }
      }

      // Event listeners para tabs de gamificación consolidados y unificados en setupBreakdownTab delegado

      // Admin Section Tabs Logic
      document.querySelectorAll('.admin-section-tabs .points-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const parent = tab.closest('.admin-section');
          if (!parent) return;

          // Deactivate all tabs in this section
          parent.querySelectorAll('.points-tab').forEach(t => t.classList.remove('active'));
          // Hide all panels in this section
          parent.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));

          // Activate clicked tab
          tab.classList.add('active');
          // Show target panel
          const targetTab = tab.dataset.tab;
          const targetPanel = parent.querySelector(`#admin-tab-${targetTab}`);
          if (targetPanel) targetPanel.classList.add('active');
        });
      });

      // Event listeners para modal de gamificación
      let linkTikTokBtn = null; // Variable global para el botón

      gamificationOpenBtn?.addEventListener('click', async () => {
        // Cerrar el menú
        closeMenu();
        hideSearchResults();
        // Inicializar con el usuario actual
        currentSelectedUser = getCurrentUser();

        // Inicializar botón de link si no se ha hecho
        if (!linkTikTokBtn) {
          linkTikTokBtn = document.getElementById('link-tiktok-btn');
          if (linkTikTokBtn) {
            linkTikTokBtn.addEventListener('click', generateLinkCode);
          }
        }

        // Mostrar botón solo si es MI perfil (no viendo a otro usuario)
        if (linkTikTokBtn) {
          const isMe = !currentSelectedUser || currentSelectedUser === getCurrentUser();
          linkTikTokBtn.style.display = isMe ? 'inline-block' : 'none';
        }

        // Poblar selector de usuarios
        if (typeof populateUserSelector === 'function') {
          populateUserSelector().catch(error => {
            console.error('Error en populateUserSelector, usando fallback:', error);
            populateUserSelectorFromLocalStorage();
          });
        } else {
          populateUserSelectorFromLocalStorage();
        }

        // Asegurar que el usuario actual esté seleccionado
        if (!currentSelectedUser) {
          currentSelectedUser = getCurrentUser();
        }

        console.log(`🎮 Abriendo modal de gamificación para: ${getCurrentSelectedUser()}`);
        console.log(`📊 Estado inicial - currentSelectedUser: ${currentSelectedUser}`);

        renderGamificationModal().catch(console.error);
        // Asegurar inicialización de la navegación una sola vez y render del mes actual
        if (!window.__calendarNavInit__) {
          initializeCalendarNavigation();
          window.__calendarNavInit__ = true;
        }
        if (gamificationModal) gamificationModal.hidden = false;
      });

      // Función para generar código de vinculación
      async function generateLinkCode() {
        const user = getCurrentUser();
        if (!user || user.toLowerCase() === 'usuario') {
            alert('Debes iniciar sesión con un nombre de usuario válido antes de vincular.');
            return;
        }

        try {
          // Generar código simple: ZR-XXXX
          const code = 'ZR-' + Math.floor(1000 + Math.random() * 9000);

          // Guardar en Firestore con expiración (ej. 10 minutos)
          if (window.db) {
            await window.db.collection('pendingLinks').doc(code).set({
              webUser: user,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 min
            });

            // Mostrar instrucciones con estilo
            showMessageModal({
              title: '🔗 Vincular con TikTok',
              message: `Para unificar tus puntos, ve al chat del Live en TikTok y escribe:\n\n!link ${code}\n\n⚠️ Este código expira en 10 minutos.`
            });
          } else {
            alert('Error de conexión con base de datos.');
          }
        } catch (e) {
          console.error(e);
          alert('Error generando código: ' + e.message);
        }
      }

      // Función para cargar solicitudes basada en el día seleccionado
      window.loadSolicitudes = function () {
        const daySelect = document.getElementById('day-select');
        const dayValue = daySelect ? daySelect.value : '';
        if (dayValue && typeof subscribeSolicitudesForDay === 'function') {
          console.log(`📅 Cargando solicitudes para el día: ${dayValue}`);
          subscribeSolicitudesForDay(dayValue);
        } else {
          console.warn('loadSolicitudes: No hay día seleccionado o función de suscripción no disponible');
          // Fallback: intentar cargar todo o lo que haya en localStorage
          if (typeof getAllCombinedSolicitudes === 'function') {
            getAllCombinedSolicitudes().then(items => {
              if (typeof renderSolicitudes === 'function') renderSolicitudes(items);
            });
          }
        }
      };

      document.addEventListener('DOMContentLoaded', async () => {
        console.log('🚀 Inicializando aplicación...');

        const daySelectEl = document.getElementById('day-select');
        const recalculateBtn = document.getElementById('recalculate-users');
        const forceLiveOnBtn = document.getElementById('force-live-on');
        const forceLiveOffBtn = document.getElementById('force-live-off');
        const liveStatusText = document.getElementById('current-live-status-text');
        const liveCodeText = document.getElementById('current-live-code-text');
        const liveCodeAdminInput = document.getElementById('live-code-admin');
        const setLiveCodeBtn = document.getElementById('set-live-code');
        const clearLiveCodeBtn = document.getElementById('clear-live-code');

        // Función para actualizar estado LIVE manual
        async function setManualLiveStatus(status) {
          try {
            if (liveStatusText) liveStatusText.textContent = "Actualizando...";
            await db.collection('system').doc('status').set({
              isLive: status,
              lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
              forcedBy: 'admin'
            }, { merge: true });
            console.log(`✅ Estado LIVE forzado a: ${status ? 'ONLINE' : 'OFFLINE'}`);
          } catch (e) {
            console.error("Error forzando estado LIVE:", e);
            alert("Error: " + e.message);
          }
        }

        // Listener centralizado arriba se encarga de actualizar liveStatusText y liveCodeText


        async function setLiveCode(value) {
          const code = String(value || '').trim();
          await db.collection('system').doc('status').set({
            liveCode: code,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
            forcedBy: 'admin'
          }, { merge: true });
        }

        if (forceLiveOnBtn) {
          forceLiveOnBtn.addEventListener('click', () => setManualLiveStatus(true));
        }

        if (forceLiveOffBtn) {
          forceLiveOffBtn.addEventListener('click', () => setManualLiveStatus(false));
        }

        if (setLiveCodeBtn && liveCodeAdminInput) {
          setLiveCodeBtn.addEventListener('click', async () => {
            try {
              await setLiveCode(liveCodeAdminInput.value);
            } catch (e) {
              console.error("Error guardando liveCode:", e);
              alert("Error: " + (e && e.message ? e.message : String(e)));
            }
          });
        }

        if (clearLiveCodeBtn && liveCodeAdminInput) {
          clearLiveCodeBtn.addEventListener('click', async () => {
            try {
              liveCodeAdminInput.value = '';
              await setLiveCode('');
            } catch (e) {
              console.error("Error quitando liveCode:", e);
              alert("Error: " + (e && e.message ? e.message : String(e)));
            }
          });
        }

        // --- Handlers: Banner de Mantenimiento ---
        const setMaintenanceMsgBtn = document.getElementById('set-maintenance-message');
        const clearMaintenanceMsgBtn = document.getElementById('clear-maintenance-message');
        const maintenanceMsgInput = document.getElementById('maintenance-message-input');
        const maintenanceBannerStatus = document.getElementById('maintenance-banner-status');

        async function setMaintenanceMessage(msg) {
          await db.collection('system').doc('status').set({
            maintenanceMessage: msg,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: 'admin'
          }, { merge: true });
        }

        // Sincronizar el campo de texto y el indicador de estado con Firestore
        if (db) {
          db.collection('system').doc('status').onSnapshot((doc) => {
            const data = doc.exists ? (doc.data() || {}) : {};
            const msg = String(data.maintenanceMessage || '').trim();
            if (maintenanceMsgInput && !maintenanceMsgInput.matches(':focus')) {
              maintenanceMsgInput.value = msg;
            }
            if (maintenanceBannerStatus) {
              maintenanceBannerStatus.innerHTML = `Estado: <strong style="color:${msg ? '#ff6b35' : '#22c55e'}">${msg ? '🟠 ACTIVO' : '✅ Desactivado'}</strong>`;
            }
          }, () => {});
        }

        if (setMaintenanceMsgBtn) {
          setMaintenanceMsgBtn.addEventListener('click', async () => {
            const msg = (maintenanceMsgInput ? maintenanceMsgInput.value : '').trim();
            if (!msg) {
              alert('Escribe un mensaje antes de activar el banner.');
              return;
            }
            try {
              await setMaintenanceMessage(msg);
            } catch (e) {
              alert('Error guardando mensaje: ' + (e && e.message ? e.message : String(e)));
            }
          });
        }

        if (clearMaintenanceMsgBtn) {
          clearMaintenanceMsgBtn.addEventListener('click', async () => {
            try {
              if (maintenanceMsgInput) maintenanceMsgInput.value = '';
              await setMaintenanceMessage('');
            } catch (e) {
              alert('Error quitando banner: ' + (e && e.message ? e.message : String(e)));
            }
          });
        }

        // Listener legacy eliminado: el botón de recálculo se maneja en una sola ruta

        if (daySelectEl) {
          daySelectEl.addEventListener('change', () => {
            if (typeof window.loadSolicitudes === 'function') {
              window.loadSolicitudes();
            }
          });
        }

        // Initial load for transparency section
        setTimeout(async () => {
          const currentUser = getCurrentProfileUser();
          if (currentUser) {
            await renderPointsBreakdownForUser(currentUser);
          }
        }, 1000); // Small delay to ensure everything is loaded

        // Cargar días disponibles
        if (typeof loadDays === 'function') {
          await loadDays();
        }

        // Si loadDays no seleccionó nada (o no disparó el evento), intentar cargar manualmente
        const daySelect = document.getElementById('day-select');
        if (daySelect && daySelect.value) {
          if (typeof window.loadSolicitudes === 'function') {
            window.loadSolicitudes();
          }
        }

        // Auto-test: ejecutar verificación automática si se incluye ?autotest=1
        try {
          const params = new URLSearchParams(window.location.search);
          if (params.get('autotest') === '1') {
            setTimeout(async () => {
              try {
                const u = (typeof getCurrentSelectedUser === 'function') ? getCurrentSelectedUser() : getCurrentUser();
                if (typeof window.runToggleVerification === 'function') {
                  const res = await window.runToggleVerification(u);
                  console.log('AUTOTEST RESULT:', res);
                }
              } catch (e) {
                console.log('AUTOTEST ERROR:', e);
              }
            }, 1500);
          }
        } catch (_) { }
      });

      // Event listener para el botón X de cerrar
      document.getElementById('gamification-close-x')?.addEventListener('click', () => {
        if (gamificationModal) gamificationModal.hidden = true;
      });

      // Función para analizar automáticamente nuevos usuarios
      async function analyzeNewUsersAutomatically() {
        try {
          const allSolicitudes = await getAllCombinedSolicitudes({ allTime: (typeof allTime !== 'undefined' ? allTime : false) });
          const allUsers = [...new Set(allSolicitudes
            .map(s => s.usuario)
            .filter(user => user && user.trim() !== '')
          )];

          // Verificar qué usuarios no han sido procesados automáticamente
          const newUsers = [];
          for (const user of allUsers) {
            const data = getGamificationDataForUser(user);
            if (!data.autoProcessed) {
              newUsers.push(user);
            }
          }

          if (newUsers.length > 0) {
            console.log(`🔍 Detectados ${newUsers.length} usuarios nuevos para análisis automático`);

            for (const user of newUsers) {
              await analyzeAndGrantPointsForUser(user);
            }

            console.log('✅ Análisis automático completado para usuarios nuevos');
          }
        } catch (error) {
          console.error('Error en análisis automático de nuevos usuarios:', error);
        }
      }
      window.analyzeNewUsersAutomatically = analyzeNewUsersAutomatically;



      // Función para procesar nueva solicitud de canción
      function processNewSongRequest() {
        const streakDays = updateStreak();
        let points = POINTS_CONFIG.SONG_REQUEST;

        // Bonus por racha
        if (streakDays > 1) {
          points += POINTS_CONFIG.STREAK_MULTIPLIER * Math.min(streakDays - 1, 10);
        }

        // Bonus VIP
        const vipUsers = JSON.parse(localStorage.getItem('vipUsers') || '[]');
        if (vipUsers.includes(getCurrentUser())) {
          points += POINTS_CONFIG.VIP_BONUS;
        }

        addPoints(points, 'Solicitud de canción');
        checkAchievements();
      }

      // Agregar estilos para notificaciones
      const notificationStyles = document.createElement('style');
      notificationStyles.textContent = `
        .level-up-notification,
        .achievement-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          background: linear-gradient(135deg, #4CAF50, #45a049);
          color: white;
          padding: 16px 20px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          z-index: 1000;
          animation: slideInRight 0.3s ease, slideOutRight 0.3s ease 3.7s forwards;
          max-width: 300px;
        }
        
        .achievement-notification {
          background: linear-gradient(135deg, #FF6B6B, #ee5a24);
        }
        
        .notification-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .notification-icon {
          font-size: 24px;
        }
        
        .notification-text {
          font-size: 14px;
          line-height: 1.3;
        }
        
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(notificationStyles);

      async function updateUserHeaderUI(username, providedData = null) {
        // CORRECCIÓN CRÍTICA: Priorizar Firestore para TODOS los usuarios en el header también.
        // providedData suele venir de 'syncGamificationDataWithCloud' que ya hace la fusión correcta.
        // Pero si no viene, 'getGamificationDataForUser' lee de localStorage, lo cual es peligroso
        // si el Admin está viendo otro perfil o si el localStorage tiene basura.

        let data = providedData;

        // Si no hay datos provistos, intentar obtenerlos de la manera más segura posible
        if (!data) {
          const currentUser = getCurrentUser(); // Usuario logueado real
          const viewingSelf = String(currentUser).toLowerCase().includes(String(username).toLowerCase());

          if (viewingSelf) {
            // Si es uno mismo, está bien usar local (feedback instantáneo)
            data = getGamificationDataForUser(username);
          } else {
            // Si vemos a otro, intentar leer de la caché de usuarios sincronizados
            data = getGamificationDataForUser(username);

            // SEGURIDAD: Priorizar siempre el valor sincronizado de la nube (_cloudSyncedPoints) 
            // si es mayor que el local, para evitar que el admin vea datos locales obsoletos.
            if (data && typeof data._cloudSyncedPoints === 'number' && data._cloudSyncedPoints > data.points) {
              data.points = data._cloudSyncedPoints;
            }
          }
        }

        if (!data) return;

        const currentLevel = getLevelInfo(data.level);

        const userNameEl = document.getElementById('user-name');
        const userLevelNameEl = document.getElementById('user-level-name');
        const userLevelNumberEl = document.getElementById('user-level-number');
        const userPointsEl = document.getElementById('user-points');

        if (userNameEl) userNameEl.textContent = username;
        if (userLevelNameEl) userLevelNameEl.textContent = currentLevel.name;
        if (userLevelNumberEl) userLevelNumberEl.textContent = `Nivel ${data.level}`;
        if (userPointsEl) userPointsEl.textContent = data.points;

        // --- NUEVO: Mostrar puntos de Likes en el header (Transparencia rápida) ---
        const userLikesPointsEl = document.getElementById('user-likes-points-display');
        const likesPoints = data.totalLikesPoints || 0;
        if (userLikesPointsEl) {
          if (likesPoints > 0) {
            userLikesPointsEl.textContent = `❤️ ${likesPoints}`;
            userLikesPointsEl.style.display = 'inline-block';
          } else {
            userLikesPointsEl.style.display = 'none';
          }
        } else if (likesPoints > 0) {
          // Si no existe el elemento, crearlo dinámicamente debajo de los puntos totales
          const pointsContainer = userPointsEl?.parentElement;
          if (pointsContainer) {
            const likesBadge = document.createElement('div');
            likesBadge.id = 'user-likes-points-display';
            likesBadge.className = 'user-likes-points';
            likesBadge.textContent = `❤️ ${likesPoints}`;
            likesBadge.style.fontSize = '0.75rem';
            likesBadge.style.color = 'rgba(255, 255, 255, 0.7)';
            likesBadge.style.marginTop = '2px';
            likesBadge.style.display = 'inline-block';
            pointsContainer.appendChild(likesBadge);
          }
        }

        // --- NUEVO: Actualizar Avatar ---
        const userAvatarEl = document.querySelector('.user-profile .user-avatar');
        if (userAvatarEl) {
          if (data.profilePic) {
            userAvatarEl.innerHTML = `<img src="${data.profilePic}" alt="${username}" style="width:100%; height:100%; border-radius:50%; object-fit:cover; display:block;">`;
            // Resetear estilos del contenedor para que solo sea un marco
            userAvatarEl.style.fontSize = '';
            userAvatarEl.style.display = 'block';
            userAvatarEl.style.background = 'transparent';
            userAvatarEl.style.backdropFilter = 'none';
          } else {
            userAvatarEl.innerHTML = '🎵';
            userAvatarEl.style.display = 'flex';
            userAvatarEl.style.alignItems = 'center';
            userAvatarEl.style.justifyContent = 'center';
            userAvatarEl.style.fontSize = '24px';
            userAvatarEl.style.background = 'rgba(255, 255, 255, 0.2)';
            userAvatarEl.style.backdropFilter = 'blur(10px)';
          }
        }

        try { renderEarnedBadgesForUser(username); } catch (_) { }
      }

      // Inicializar sistema de gamificación
      async function initGamification() {
        try {
          console.log('🎮 INICIANDO SISTEMA DE GAMIFICACIÓN...');

          // Usar la función de actualización forzada que es más robusta
          await forceUpdateAllUsers();

          // Listener liviano: solo el día actual, no toda la colección playedSongs
          if (window.db) {
            const currentUser = getCurrentUser();
            console.log(`📡 Configurando listener ligero para ${currentUser}`);
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const todayKey = `${yyyy}-${mm}-${dd}`;
            db.collection('playedSongs').doc(todayKey).onSnapshot(async () => {
              console.log('📡 Cambio detectado en playedSongs del día actual - Recalculando stats del usuario actual...');
              await analyzeAndGrantPointsForUser(currentUser);
              try {
                await updateUserHeaderUI(currentUser);
              } catch (e) { console.warn('Error actualizando header:', e); }
            });
          }

        } catch (error) {
          console.error('Error en inicialización automática:', error);
          // Fallback: inicializar solo el usuario actual
          try {
            const currentUser = getCurrentUser();
            await analyzeAndGrantPointsForUser(currentUser);
            await populateUserSelector();
          } catch (fallbackError) {
            console.error('Error en fallback:', fallbackError);
          }
        }
      }

      // Función para analizar y otorgar puntos automáticamente a un usuario
      async function analyzeAndGrantPointsForUser(username, options = {}) {
        const allTime = !!options.allTime;
        try {
          const targetUser = username || getCurrentUser();
          console.log(`🔍 Analizando usuario: ${targetUser}`);

          // Obtener datos actuales del usuario
          let data = getGamificationDataForUser(targetUser);
          console.log(`📊 Datos actuales de ${targetUser}:`, data);

          // Validar y corregir estructura de datos
          const existingAchievementPoints = validateAndFixGamificationData(data, targetUser);

          // Siempre recalcular para asegurar datos actualizados
          console.log(`🔄 Recalculando datos para ${targetUser}...`);

          // Calcular estadísticas del usuario (SIEMPRE allTime: true para evaluación de Logros - Hallazgo 4)
          const stats = await calculateUserStatsForUser(targetUser, { allTime: true });
          console.log(`📈 Estadísticas de ${targetUser}:`, stats);

          // Si las estadísticas parecen incorrectas, ejecutar diagnóstico
          if (stats.totalSongs === 0 && targetUser !== 'test') {
            console.log(`⚠️ Usuario ${targetUser} tiene 0 canciones, ejecutando diagnóstico...`);
            await diagnoseSolicitudesIssues(targetUser);
          }

          // Calcular puntos base por canciones reproducidas
          const basePoints = (stats.totalPlayedSongs || 0) * POINTS_CONFIG.SONG_REQUEST;

          // Bonus diario por conexión (basado en días activos) - LEGACY (Mantenido por compatibilidad)
          const dailyBonusPoints = (stats.activeDays || 0) * POINTS_CONFIG.DAILY_BONUS;

          // Puntos por Check-In Manual
          const checkInPoints = Number(data.checkInPoints || 0);

          // Puntos por Likes (Nuevo)
          const likesPoints = Number(data.likesPoints || 0);

          console.log(`💰 Puntos base para ${targetUser}: ${basePoints} (${stats.totalPlayedSongs} canciones × ${POINTS_CONFIG.SONG_REQUEST})`);
          console.log(`💰 Puntos por días activos: ${dailyBonusPoints}`);
          console.log(`💰 Puntos por Check-In Manual: ${checkInPoints}`);
          console.log(`💰 Puntos por Likes: ${likesPoints}`);

          // Bonus VIP si aplica, sobre canciones reproducidas
          const vipBonus = stats.isVip ? (stats.totalPlayedSongs || 0) * POINTS_CONFIG.VIP_BONUS : 0;

          // Calcular puntos totales base (sin logros)
          const totalBasePoints = basePoints + dailyBonusPoints + vipBonus + checkInPoints + likesPoints;

          // Preservar logros existentes antes de actualizar datos base
          const existingAchievements = [...(data.achievements || [])];
          console.log(`📋 Preservando ${existingAchievements.length} logros existentes para ${targetUser}`);

          // Actualizar datos base (sin incluir puntos de logros aún)
          data.points = totalBasePoints;
          data.xp = totalBasePoints;
          data.level = calculateLevel(totalBasePoints);
          data.stats = stats;
          data.autoProcessed = true;
          data.achievements = existingAchievements; // Preservar logros existentes

          // Preservar rachas existentes si las hay
          if (!data.streaks || !data.streaks.best) {
            data.streaks = {
              current: 0,
              best: Math.min(stats.activeDays, 7), // Estimación conservadora
              lastActivity: null,
              calendar: {}
            };
          }

          // Log de puntos base
          console.log(`💰 Puntos base calculados para ${targetUser}: ${totalBasePoints}`);
          console.log(`   - Canciones: ${stats.totalSongs} × ${POINTS_CONFIG.SONG_REQUEST} = ${basePoints}`);
          console.log(`   - Bonus VIP: ${vipBonus}`);

          // Actualizar bestStreak en las estadísticas para los logros
          data.stats.bestStreak = data.streaks.best;

          // Verificar y otorgar logros automáticamente
          let newAchievementPoints = 0;
          ACHIEVEMENTS.forEach(achievement => {
            if (achievement.condition(data.stats)) {
              if (!data.achievements.includes(achievement.id)) {
                data.achievements.push(achievement.id);
                newAchievementPoints += achievement.points;
                console.log(`🏆 Nuevo logro otorgado a ${targetUser}: ${achievement.title} (+${achievement.points} puntos)`);
              }
            }
          });

          // Calcular puntos totales de logros (existentes + nuevos)
          const totalAchievementPoints = existingAchievementPoints + newAchievementPoints;

          // Agregar puntos de logros al total
          data.points += totalAchievementPoints;
          data.xp += totalAchievementPoints;

          // Log de puntos de logros
          if (newAchievementPoints > 0) {
            console.log(`💰 Puntos de nuevos logros para ${targetUser}: +${newAchievementPoints}`);
          }
          if (existingAchievementPoints > 0) {
            console.log(`💰 Puntos de logros existentes para ${targetUser}: +${existingAchievementPoints}`);
          }

          // Recalcular nivel con puntos totales finales
          data.level = calculateLevel(data.points);

          // Log final de resumen
          console.log(`📊 Resumen final para ${targetUser}:`);
          console.log(`   - Puntos base: ${totalBasePoints}`);
          console.log(`   - Puntos de logros existentes: ${existingAchievementPoints}`);
          console.log(`   - Puntos de logros nuevos: ${newAchievementPoints}`);
          console.log(`   - Total puntos: ${data.points}`);
          console.log(`   - Nivel: ${data.level}`);
          console.log(`   - Logros totales: ${data.achievements.length}`);

          // Guardar datos locales
          saveGamificationDataForUser(data, targetUser);
          console.log(`💾 Datos guardados para ${targetUser}`);

          // PASO FINAL: Usar la lógica maestra de computeUserBreakdown para obtener el total exacto
          // que incluye Manual Bonus, Top 1 Bonus, y Streak Bonus calculado correctamente.
          // Esto asegura que el Top 3 Global coincida con la Transparencia.
          try {
            console.log(`🔄 Calculando total autorizado para ${targetUser} usando computeUserBreakdown...`);
            const breakdown = await computeUserBreakdown(targetUser);

            if (breakdown && typeof breakdown.total === 'number') {
              console.log(`✅ Total autorizado obtenido: ${breakdown.total} (vs local: ${data.points})`);
              data.points = breakdown.total;
              
              // Sincronizar las rachas calculadas con datos reales
              if (typeof breakdown.currentStreak === 'number' && typeof breakdown.bestStreak === 'number') {
                data.streaks = data.streaks || { calendar: {} };
                data.streaks.current = breakdown.currentStreak;
                data.streaks.best = breakdown.bestStreak;
                if (!data.stats) data.stats = {};
                data.stats.bestStreak = breakdown.bestStreak;
                data.stats.currentStreak = breakdown.currentStreak;
              }

              data.lastAuthoritativeSource = 'breakdown';
              data.lastAuthoritativeCalculatedAt = new Date().toISOString();

              // Actualizar nivel basado en el total real
              data.level = calculateLevel(data.points);

              // Guardar de nuevo localmente con el total correcto
              saveGamificationDataForUser(data, targetUser);
            }
          } catch (bdError) {
            console.error('Error calculando breakdown autorizado:', bdError);
          }

          // Persistir en Firestore para ranking global
          // FIX CRÍTICO: Solo el dueño (Owner) debe actualizar sus stats calculadas localmente en la nube.
          // Si un Admin visualiza a otro usuario, su cálculo local puede estar incompleto (faltan canciones en cache).
          // Permitir que el Admin sobrescriba la nube causaría regresiones de puntos.

          const currentUser = getCurrentUser();
          const normCurrent = String(currentUser || '').trim().replace(/^@/, '').toLowerCase();
          const normTarget = String(targetUser || '').trim().replace(/^@/, '').toLowerCase();
          const isAdminMode = localStorage.getItem('isAdminMode') === 'true' || localStorage.getItem('isAdminAuthenticated') === 'true';
          const isOwner = !isAdminMode && (normCurrent === normTarget);

          if (window.db && (isOwner || isAdminMode)) {
            const normUser = normalizeUserKey(targetUser);
            // SEGURIDAD: No permitir que el cálculo local baje los puntos de la nube drásticamente
            // sin una razón válida (un canje), para evitar regresiones por fallos de carga.
              // SINCRONIZACIÓN DIRECTA: Confiamos en el cálculo reconstruido
              db.collection('userStats').doc(normUser).set({
                totalPoints: data.points,
                level: data.level,
                achievements: data.achievements,
                gamification: data,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
              }, { merge: true }).catch(err => console.error('Error guardando stats:', err));
          } else {
            console.log(`🔒 Evitando sobrescritura de Cloud Stats (No soy Owner o modo Admin activo)`);
          }

          console.log(`✅ Usuario ${targetUser}: ${data.points} puntos, nivel ${data.level}, ${data.achievements.length} logros`);

        } catch (error) {
          console.error(`Error procesando usuario ${targetUser}:`, error);
        }
      }

      // Función para diagnosticar problemas en la obtención de solicitudes
      async function diagnoseSolicitudesIssues(username) {
        console.log(`🔍 DIAGNÓSTICO COMPLETO PARA: ${username}`);

        try {
          // 1. Verificar Firestore
          const firestoreSnapshot = await db.collection('solicitudes').where('usuario', '==', username).get();
          const firestoreCount = firestoreSnapshot.size;
          console.log(`🔥 Firestore: ${firestoreCount} solicitudes para ${username}`);

          // 2. Verificar localStorage directo
          const localSolicitudes = JSON.parse(localStorage.getItem('solicitudes') || '[]');
          const normUsername = normalizeUserKey(username);
          const localCount = localSolicitudes.filter(s => normalizeUserKey(s.usuario) === normUsername).length;
          console.log(`💾 localStorage directo: ${localCount} solicitudes para ${username}`);

          // 3. Verificar localStorage byDay
          const byDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');
          let byDayCount = 0;
          Object.values(byDay).flat().forEach(s => {
            if (normalizeUserKey(s.usuario) === normUsername) byDayCount++;
          });
          console.log(`📅 localStorage byDay: ${byDayCount} solicitudes para ${username}`);

          // 4. Verificar función combinada
          const allSolicitudes = await getAllCombinedSolicitudes({ allTime: (typeof allTime !== 'undefined' ? allTime : false) });
          const combinedCount = allSolicitudes.filter(s => normalizeUserKey(s.usuario) === normUsername).length;
          console.log(`🎵 Función combinada: ${combinedCount} solicitudes para ${username}`);

          // 5. Mostrar algunas solicitudes de ejemplo
          const userSongs = allSolicitudes.filter(s => normalizeUserKey(s.usuario) === normUsername).slice(0, 5);
          console.log(`📋 Primeras 5 solicitudes de ${username}:`, userSongs);

          return {
            firestore: firestoreCount,
            localStorage: localCount,
            byDay: byDayCount,
            combined: combinedCount,
            samples: userSongs
          };

        } catch (error) {
          console.error(`❌ Error en diagnóstico para ${username}:`, error);
          return null;
        }
      }

      // Función para validar y corregir datos de gamificación
      function validateAndFixGamificationData(data, username) {
        console.log(`🔍 Validando datos de gamificación para ${username}`);

        // Asegurar que achievements es un array
        if (!Array.isArray(data.achievements)) {
          data.achievements = [];
          console.log(`⚠️ Corrigiendo achievements para ${username}: convertido a array`);
        } else {
          // Deduplicar logros para evitar puntos inflados
          const uniqueAchievements = [...new Set(data.achievements)];
          if (uniqueAchievements.length !== data.achievements.length) {
            console.log(`⚠️ Deduplicando achievements para ${username}: ${data.achievements.length} -> ${uniqueAchievements.length}`);
            data.achievements = uniqueAchievements;
          }
        }

        // Calcular puntos correctos de logros
        const achievementPoints = data.achievements.reduce((total, achievementId) => {
          const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
          if (!achievement) {
            console.log(`⚠️ Logro no encontrado: ${achievementId} para ${username}`);
            return total;
          }
          return total + achievement.points;
        }, 0);

        // Asegurar estructura de streaks
        if (!data.streaks || typeof data.streaks !== 'object') {
          data.streaks = {
            current: 0,
            best: 0,
            lastActivity: null,
            calendar: {}
          };
          console.log(`⚠️ Corrigiendo streaks para ${username}: estructura recreada`);
        }

        // Asegurar estructura de stats
        if (!data.stats || typeof data.stats !== 'object') {
          data.stats = {
            totalSongs: 0,
            uniqueArtists: 0,
            activeDays: 0,
            isVip: false,
            bestStreak: data.streaks.best || 0
          };
          console.log(`⚠️ Corrigiendo stats para ${username}: estructura recreada`);
        }

        // Asegurar que bestStreak esté en stats
        if (typeof data.stats.bestStreak === 'undefined') {
          data.stats.bestStreak = data.streaks.best || 0;
        }

        // CORRECCIÓN CRÍTICA: Recalcular puntos totales correctos basado solo en reproducidas
        const safeStats = data.stats || { totalPlayedSongs: 0, isVip: false };
        const songPoints = (safeStats.totalPlayedSongs || 0) * 25; // 25 puntos por canción reproducida
        const vipBonus = safeStats.isVip ? ((safeStats.totalPlayedSongs || 0) * 15) : 0; // 15 puntos extra por canción si es VIP
        const correctTotalPoints = songPoints + vipBonus + achievementPoints;

        // Solo corregir si hay una diferencia significativa
        // IMPORTANTE: Solo corregir hacia ARRIBA. Si los puntos locales son mayores, asumimos que hay historial
        // o bonos que no estamos viendo en este momento (partial load). No borrar puntos.
        if (correctTotalPoints > data.points) {
          console.log(`🔧 CORRIGIENDO PUNTOS (Subiendo) para ${username}:`);
          console.log(`   - Puntos actuales: ${data.points}`);
          console.log(`   - Total calculado correcto: ${correctTotalPoints}`);

          data.points = correctTotalPoints;
          data.xp = correctTotalPoints; // XP debe ser igual a puntos totales
        } else if (data.points > correctTotalPoints + 5000) {
          // Solo si la discrepancia es absurda (más de 5000 puntos de diferencia), sospechar y loguear,
          // pero aun así ser conservadores para no borrar puntos legítimos de historial antiguo.
          console.warn(`⚠️ Discrepancia de puntos para ${username}: Tiene ${data.points} pero el cálculo local da ${correctTotalPoints}. Posible historial no cargado.`);
        }

        console.log(`✅ Validación completada para ${username}: ${data.achievements.length} logros, ${achievementPoints} puntos de logros, ${data.points} puntos totales`);
        return achievementPoints;
      }
      function getLocalGamificationData(u) {
        const allStr = localStorage.getItem('gamificationData') || '{}';
        const all = JSON.parse(allStr);
        const key = String(u || '').toLowerCase();
        return all[key] || null;
      }
      if (typeof window.toHourKey !== 'function') {
        window.toHourKey = function (ts) {
          try {
            if (!ts) return '00:00';
            const d = ts?.toDate ? ts.toDate() : new Date(ts);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
          } catch (_) { return '00:00'; }
        };
      }
      // NUEVA función unificada para contar canciones toggleadas (Reproducidas)
      // Esta función se declara aquí para estar disponible tanto para computeUserBreakdown como para renderPersonalStatsForUser
      async function getGlobalPlayedSongsSetForUser(usuario, optionalFused) {
        try {
          const uNorm = String(usuario || '').trim().toLowerCase().replace(/^@/, '');
          let fused = optionalFused || getFusedIds(uNorm);
          
          if (!optionalFused) {
            try {
              const stats = getGamificationDataForUser(uNorm);
              if (stats && stats.tiktokId) {
                const tid = stats.tiktokId.replace(/^@/, '').toLowerCase();
                if (!fused.includes(tid)) fused.push(tid);
              }
            } catch (_) { }
          }

          if (!fused || !fused.length) fused = [uNorm];
          const sanitize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
          const prefixes = fused.map(f => sanitize(`${f.replace(/^@/, '')}-`));
          const ids = new Set();
          try {
            const snap = await db.collection('playedSongs').get();
            snap.forEach(doc => {
              const day = doc.id;
              if (typeof isOnOrAfterStart === 'function' && !isOnOrAfterStart(day)) return;
              const d = doc.data() || {};
              const arr = Array.isArray(d.songs) ? d.songs : (Array.isArray(d.list) ? d.list : []);
              const skippedArr = Array.isArray(d.skipped) ? d.skipped : [];
              arr.forEach(x => {
                if (skippedArr.includes(x)) return; // IGNORAR canciones saltadas (skip)
                const id = sanitize(x);
                if (prefixes.some(p => id.startsWith(p))) {
                  // FILTRO DE SEGURIDAD: Omitir si el ID de la canción indica bot o test
                  if (typeof window.isInvalid !== 'function' || !window.isInvalid(id)) {
                    ids.add(id);
                  }
                }
              });
            });
          } catch (e) { }
          try {
            const qs = await db.collection('systemEvents').where('type', '==', 'togglePlayed').where('usuario', 'in', fused).get();
            const latest = {};
            qs.forEach(doc => {
              const d = doc.data() || {};
              const sid = sanitize(d.songId);
              if (!sid) return;
              const ts = d.ts && d.ts.toMillis ? d.ts.toMillis() : 0;
              const k = sid;
              if (!latest[k] || ts > latest[k].ts) latest[k] = { action: d.action, ts };
            });
            Object.keys(latest).forEach(sid => {
              if (latest[sid].action === 'mark') ids.add(sid);
              else if (latest[sid].action === 'unmark') ids.delete(sid);
            });
          } catch (e) { }
          const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
          const targetUser = typeof getCurrentSelectedUser === 'function' ? getCurrentSelectedUser() : null;
          const normCurrent = String(currentUser || '').trim().replace(/^@/, '').toLowerCase();
          const normTarget = String(targetUser || '').trim().replace(/^@/, '').toLowerCase();
          const isOwner = normCurrent === uNorm && normCurrent === normTarget;
          if (isOwner) {
            try {
              const localPlayed = JSON.parse(localStorage.getItem('playedSongs') || '{}');
              const localSkipped = JSON.parse(localStorage.getItem('skippedSongs') || '{}');
              Object.keys(localPlayed).forEach(day => {
                if (typeof isOnOrAfterStart === 'function' && !isOnOrAfterStart(day)) return;
                const arr = Array.isArray(localPlayed[day]) ? localPlayed[day] : [];
                const skipArr = Array.isArray(localSkipped[day]) ? localSkipped[day] : [];
                arr.forEach(x => {
                  if (skipArr.includes(x)) return; // IGNORAR canciones saltadas localmente
                  const id = sanitize(x);
                  if (prefixes.some(p => id.startsWith(p))) ids.add(id);
                });
              });
            } catch (e) { }
          }
          return ids;
        } catch (e) { console.error(e); return new Set(); }
      }

      async function countTotalToggledSongsForUser(usuario, optionalFused) {
        const ids = await getGlobalPlayedSongsSetForUser(usuario, optionalFused);
        return ids.size;
      }

      const TOP1_BONUS_START_DATE = '2025-12-19';

      function getFusedIds(u) {
        const stripAccents = (str) => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const startRaw = String(u || '').trim().replace(/^@/, '');
        // Normalización para búsqueda de ALIAS (minúsculas y sin @)
        const start = startRaw.toLowerCase();
        const map = typeof getUserAliasesCombinedMap === 'function' ? getUserAliasesCombinedMap() : (window.userAliasesMap || {});
        const visited = new Set();
        const queue = [start];
        const results = new Set();
        // Preservar formato original para el Set final (importante para IDs de documentos)
        results.add(startRaw);

        let depth = 0;
        while (queue.length > 0 && depth < 20) {
          const current = queue.shift();
          const normCurrent = current.toLowerCase();
          const strippedCurrent = stripAccents(current);
          if (visited.has(normCurrent)) continue;
          visited.add(normCurrent);
          results.add(current);

          if (map[normCurrent]) {
            const target = map[normCurrent].replace(/^@/, '');
            if (!visited.has(target.toLowerCase())) queue.push(target);
          }

          for (const [alias, target] of Object.entries(map)) {
            const cleanAlias = alias.replace(/^@/, '');
            const cleanTarget = target.replace(/^@/, '');
            const normAlias = cleanAlias.toLowerCase();
            const normTarget = cleanTarget.toLowerCase();
            
            const strippedAlias = stripAccents(cleanAlias);
            const strippedTarget = stripAccents(cleanTarget);

            if (strippedAlias === strippedCurrent && !visited.has(normTarget)) {
              queue.push(cleanTarget);
            }
            if (strippedTarget === strippedCurrent && !visited.has(normAlias)) {
              queue.push(cleanAlias);
            }
          }
          depth++;
        }
        return Array.from(results);
      }

      async function computeUserBreakdown(u, options = {}) {
        window.__sessionBreakdownCache = window.__sessionBreakdownCache || {};
        const sessKey = String(u || '').trim().replace(/^@/, '').toLowerCase(); // Unificado sin @
        if (!options.force && window.__sessionBreakdownCache[sessKey]) return window.__sessionBreakdownCache[sessKey];

        let tiktokId = null;
        let vipEligibleSongs = 0;
        let playedArtistsSetSize = 0; // Fallback para artistas únicos
        let cloudFirstRequests = 0; // Fallback para logros de primero en pedir
        let cloudZeroFMSongs = 0; // Fallback para logros de Zero FM
        let cloudTopArtistCount = 0;
        let cloudTopArtistCountPlayed = 0;
        const rawUser = String(u || '').trim();
        const usuario = rawUser.replace(/^@/, '');
        const unameLc = String(usuario || '').trim().toLowerCase();

        // --- DESCUBRIMIENTO DINÁMICO DE FUSED IDS (NUEVO) ---
        const initialFused = getFusedIds(usuario);
        const fusedSet = new Set(initialFused);

        try {
          // Descubrir tiktokId para ver si hay otros vinculados al mismo
          const mainStats = await fetchBestUserStatsDoc(unameLc);
          if (mainStats && mainStats.data) {
            const tid = mainStats.data.tiktokId || mainStats.data.tiktokAlias;
            if (tid) {
              tiktokId = tid.replace(/^@/, '').toLowerCase();
              fusedSet.add(tiktokId);
              // Buscar compañeros de este tiktokId
              const sharingSnap = await db.collection('userStats').where('tiktokId', '==', tiktokId).get();
              sharingSnap.forEach(doc => fusedSet.add(doc.id.toLowerCase()));
            }
          }
        } catch (e) { }

        const fusedIds = Array.from(fusedSet);
        const norm = (s) => String(s || '').trim().replace(/^@/, '').toLowerCase();
        const rawLc = String(rawUser || '').trim().toLowerCase();

        // --- BÚSQUEDA SIMÉTRICA DE DATOS LOCALES (Caché local) ---
        let localData = {};
        for (const fid of fusedIds) {
          const ld = getLocalGamificationData(fid);
          if (ld && Object.keys(ld).length > 0) {
            localData = ld;
            break;
          }
        }

        // --- COMPROBACIÓN SIMÉTRICA DE RANGO VIP ---
        let isVip = false;
        if (typeof window.isUserVipGlobal === 'function') {
          isVip = fusedIds.some(fid => window.isUserVipGlobal(fid));
        } else if (window.vipSet || window.z0VipSet || window.z0PlatinumSet) {
          isVip = fusedIds.some(fid => {
            const fidLc = String(fid || '').trim().toLowerCase();
            const fidRawLc = String(fid || '').trim().toLowerCase().replace(/^@/, '');
            return (window.vipSet && (window.vipSet.has(fidLc) || window.vipSet.has(fidRawLc))) ||
                   (window.z0VipSet && (window.z0VipSet.has(fidLc) || window.z0VipSet.has(fidRawLc))) ||
                   (window.z0PlatinumSet && (window.z0PlatinumSet.has(fidLc) || window.z0PlatinumSet.has(fidRawLc)));
          });
        }
        const getHourKey = (x) => {
          try {
            if (typeof window.toHourKey === 'function') return window.toHourKey(x);
            if (typeof toHourKey === 'function') return toHourKey(x);
            if (typeof toHour === 'function') return toHour(x);
            return '00:00';
          } catch (_) {
            return '00:00';
          }
        };

        // --- CALCULO DE "TOP 1 DIARIO" Y RACHAS ---
        let top1Count = 0;
        try {
          const allReqs = await getAllCombinedSolicitudes();
          const byDay = {};
          allReqs.forEach(s => {
            let d = String(s.day || (s.fecha || '').split('T')[0] || '').trim();
            if (!d || d < TOP1_BONUS_START_DATE) return;
            if (!byDay[d]) byDay[d] = {};
            const uKeyRaw = String(s.usuario || '').trim().replace(/^@/, '').toLowerCase();
            const uKey = normalizeKeyTextForTicker(uKeyRaw);
            byDay[d][uKey] = (byDay[d][uKey] || 0) + 1;
          });
          Object.keys(byDay).forEach(day => {
            const counts = byDay[day];
            let max = -1, winner = null;
            Object.keys(counts).forEach(user => {
              if (counts[user] > max) { max = counts[user]; winner = user; }
              else if (counts[user] === max && user === unameLc) winner = user;
            });
            if (winner === unameLc && max > 0) top1Count++;
          });
        } catch (e) { }

        // 2. CONTAR CANCIONES REPRODUCIDAS (BASE PARA PUNTOS)
        let playedCount = 0;
        let userPlayedSongsSet = new Set();
        try {
          userPlayedSongsSet = await getGlobalPlayedSongsSetForUser(usuario, fusedIds);
          playedCount = userPlayedSongsSet.size;
        } catch (e) { console.error('Error counting played:', e); }

        // 3. CONTAR CANCIONES PEDIDAS (INFORMATIVO, NO SUMA PUNTOS)
        let totalRequestedCount = 0;
        const daysSet = new Set();
        const perDaySongs = new Map();
        const playedArtistsSet = new Set();
        const artistCountsAll = {};
        const artistCountsPlayed = {};
        
        // --- RECOLECTAR ARTISTAS DE SYSTEM EVENTS ---
        let calculatedZeroFMPlayed = 0;
        const isZeroFM = (name) => {
          const n = String(name || '').toLowerCase();
          return n.includes('zerofm') || n.includes('zero fm');
        };

        try {
          const qs = await db.collection('systemEvents')
            .where('type', '==', 'togglePlayed')
            .where('usuario', 'in', fusedIds)
            .get();
          
          const latestAction = {};
          qs.forEach(doc => {
            const d = doc.data() || {};
            const sid = String(d.songId || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
            if (!sid) return;
            const ts = d.ts && d.ts.toMillis ? d.ts.toMillis() : 0;
            if (!latestAction[sid] || ts > latestAction[sid].ts) {
              latestAction[sid] = { action: d.action, ts, artista: d.artista };
            }
          });

          Object.keys(latestAction).forEach(sid => {
            const info = latestAction[sid];
            if (info.action === 'mark' && info.artista) {
              const a = String(info.artista).trim().toLowerCase();
              if (a) {
                playedArtistsSet.add(a);
                artistCountsPlayed[a] = (artistCountsPlayed[a] || 0) + 1;
                artistCountsAll[a] = (artistCountsAll[a] || 0) + 1;
              }
              if (isZeroFM(info.artista)) calculatedZeroFMPlayed++;
            }
          });
        } catch (e) { console.error('Error fetching artists from systemEvents:', e); }

        try {
          const userSnap = await db.collection('solicitudes').where('usuario', 'in', fusedIds).get();
          totalRequestedCount = userSnap.size + playedCount;
          userSnap.forEach(doc => {
            const d = doc.data() || {};
            if (d.artista) {
              const a = String(d.artista).trim().toLowerCase();
              if (a) {
                playedArtistsSet.add(a);
                artistCountsAll[a] = (artistCountsAll[a] || 0) + 1;
              }
            }
            const rawDay = d.day || (d.fecha ? (typeof d.fecha.toDate === 'function' ? d.fecha.toDate().toISOString().split('T')[0] : String(d.fecha).split('T')[0]) : '');
            const day = normalizeDay(rawDay);
            if (day && isOnOrAfterStart(day)) {
              daysSet.add(day);
              const arr = perDaySongs.get(day) || [];
              arr.push(d);
              perDaySongs.set(day, arr);
            }
          });
        } catch (_) { }

        // Coherencia visual: Pedidas >= Reproducidas (Solo visual, NO afecta puntos)
        totalRequestedCount = Math.max(totalRequestedCount, playedCount);

        const calculatedTopArtistCount = Object.values(artistCountsAll).reduce((max, n) => Math.max(max, n), 0);
        const calculatedTopArtistCountPlayed = Object.values(artistCountsPlayed).reduce((max, n) => Math.max(max, n), 0);

        let activeDaysValid = 0;
        const detail = [];
        const totalPlayedSet = new Set();
        // (El resto de la lógica de totalPlayedSet es redundante ahora, pero la mantengo limpia para evitar romper rachas)

        // OPTIMIZACIÓN O(1): Obtener datos necesarios ANTES del bucle (Hallazgo 2)
        let allReqsForDays = [];
        try { allReqsForDays = await getAllCombinedSolicitudes(); } catch(e) {}
        const distinctUsersPerDay = {};
        allReqsForDays.forEach(s => {
          let d = String(s.day || (s.fecha || '').split('T')[0] || '').trim();
          if (d) {
            if (!distinctUsersPerDay[d]) distinctUsersPerDay[d] = new Set();
            if (s.usuario) distinctUsersPerDay[d].add(normalizeKeyTextForTicker(s.usuario));
          }
        });
        
        let playedDocsMap = {};
        try {
          const allPlayedSnap = await db.collection('playedSongs').get();
          allPlayedSnap.forEach(doc => { playedDocsMap[doc.id] = doc.data() || {}; });
        } catch(e) {}

        // --- POBLAR DÍAS ACTIVOS HISTÓRICOS DESDE PLAYEDDOCSMAP ---
        const userPrefixes = fusedIds.map(fid => String(fid || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '') + '-');
        Object.keys(playedDocsMap).forEach(day => {
          if (!isOnOrAfterStart(day)) return;
          const pdata = playedDocsMap[day] || {};
          const playedArrRaw = Array.isArray(pdata.songs) ? pdata.songs : (Array.isArray(pdata.list) ? pdata.list : (Array.isArray(pdata.songIds) ? pdata.songIds : []));
          const skippedArr = Array.isArray(pdata.skipped) ? pdata.skipped : [];
          const playedArr = playedArrRaw.filter(x => !skippedArr.includes(x));

          let userPlayedThatDay = false;
          for (let k = 0; k < playedArr.length; k++) {
            const xl = String(playedArr[k] || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
            if (userPrefixes.some(pref => xl.startsWith(pref)) || userPlayedSongsSet.has(xl)) {
              userPlayedThatDay = true;
              break;
            }
          }

          if (userPlayedThatDay) {
            daysSet.add(day);
          }
        });

        const days = Array.from(daysSet).sort();

        // Iterar días SOLO para calcular días activos y rachas, NO para recontar canciones (Rápido en memoria)
        for (let i = 0; i < days.length; i++) {
          const day = days[i];
          if (!isOnOrAfterStart(day)) continue;

          // Obtener canciones reproducidas del día desde el mapa en memoria
          const pdata = playedDocsMap[day] || {};
          const playedArrRaw = Array.isArray(pdata.songs) ? pdata.songs : (Array.isArray(pdata.list) ? pdata.list : (Array.isArray(pdata.songIds) ? pdata.songIds : []));
          const skippedArr = Array.isArray(pdata.skipped) ? pdata.skipped : [];
          
          // IGNORAR canciones saltadas (skip)
          const playedArr = playedArrRaw.filter(x => !skippedArr.includes(x));

          // Contar canciones del usuario en este día específico para validar "Día Activo"
          const cleanLc = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
          let userPlayedThatDay = 0;

          for (let k = 0; k < playedArr.length; k++) {
            const x = playedArr[k] || '';
            const xl = cleanLc(x);
            // FILTRO DE SEGURIDAD
            if (typeof window.isInvalid === 'function' && window.isInvalid(xl)) continue;
            
            if (userPrefixes.some(pref => xl.startsWith(pref)) || userPlayedSongsSet.has(xl)) {
              userPlayedThatDay++;
            }
          }

          // Consultar usuarios distintos en ese día desde el mapa en memoria
          const distUsersSet = distinctUsersPerDay[day] || new Set();
          const distUsersCount = distUsersSet.size;

          const validDay = distUsersCount >= 2 && userPlayedThatDay > 0;
          if (validDay) activeDaysValid++;
          if (userPlayedThatDay > 0) {
            detail.push({ day, played: userPlayedThatDay, distinctUsers: distUsersCount });
          }
        }
        // Calcular rachas a partir de detail (secuencias consecutivas de días con actividad)
        let bestStreakComputed = 0;
        let currentStreakComputed = 0;
        let streakPointsSum = 0;
        try {
          const parseDay = (d) => {
            const [y, m, dd] = String(d || '').split('-').map(Number);
            return new Date(y, (m || 1) - 1, dd || 1);
          };

          // Días válidos para racha (al menos STREAK_MIN_USERS usuarios distintos)
          const minUsers = (POINTS_CONFIG && typeof POINTS_CONFIG.STREAK_MIN_USERS === 'number') ? POINTS_CONFIG.STREAK_MIN_USERS : 2;
          const validDays = detail.filter(x => x.distinctUsers >= minUsers).map(x => x.day).sort();

          if (validDays.length > 0) {
            // Mejor racha
            let tempLen = 1;
            for (let i = 1; i < validDays.length; i++) {
              const cur = parseDay(validDays[i]);
              const prev = parseDay(validDays[i - 1]);
              const diff = (cur - prev) / (1000 * 60 * 60 * 24);
              if (Math.round(diff) === 1) {
                tempLen++;
              } else {
                bestStreakComputed = Math.max(bestStreakComputed, tempLen);
                tempLen = 1;
              }
            }
            bestStreakComputed = Math.max(bestStreakComputed, tempLen);

            // Racha actual
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            const lastValid = validDays[validDays.length - 1];

            if (lastValid === today || lastValid === yesterday) {
              currentStreakComputed = 1;
              for (let i = validDays.length - 2; i >= 0; i--) {
                const cur = parseDay(validDays[i + 1]);
                const prev = parseDay(validDays[i]);
                const diff = (cur - prev) / (1000 * 60 * 60 * 24);
                if (Math.round(diff) === 1) {
                  currentStreakComputed++;
                } else {
                  break;
                }
              }
            }
          }

          // Puntos acumulados (esto es para el desglose)
          // ... (mantener lógica de puntos si es necesaria)
        } catch (e) { console.error('Error computing streaks:', e); }
        const base = playedCount * 25;
        let vipBonus = 0;

        // Calcular Bonus VIP respetando fecha de activación de forma simétrica
        if (isVip) {
          let vipActivationDate = null;
          if (window.vipMap) {
            for (const fid of fusedIds) {
              const fidLc = String(fid || '').trim().toLowerCase();
              const fidRawLc = String(fid || '').trim().toLowerCase().replace(/^@/, '');
              if (window.vipMap.has(fidLc)) {
                const act = window.vipMap.get(fidLc).activatedAt;
                if (act) {
                  vipActivationDate = act;
                  break;
                }
              }
              if (window.vipMap.has(fidRawLc)) {
                const act = window.vipMap.get(fidRawLc).activatedAt;
                if (act) {
                  vipActivationDate = act;
                  break;
                }
              }
            }
          }

          if (vipActivationDate) {
            vipEligibleSongs = 0;
            detail.forEach(d => {
              if (d.day >= vipActivationDate) {
                vipEligibleSongs += d.played;
              }
            });
            vipBonus = vipEligibleSongs * 40;
            console.log(`💎 VIP Bonus calculado desde ${vipActivationDate}: ${vipEligibleSongs} canciones (${vipBonus} pts)`);
          } else {
            // Comportamiento legacy: todas las canciones cuentan si no hay fecha
            vipEligibleSongs = playedCount;
            vipBonus = playedCount * 40;
            // console.log(`💎 VIP Bonus legacy (sin fecha): ${playedCount} canciones (${vipBonus} pts)`);
          }
        }

        let dailyBonus = activeDaysValid * 5;
        const uniqueArtistsPlayed = Array.from(playedArtistsSet).filter(Boolean).length;
        let achievements = 0;
        let streakBonus = 0;
        const finalAchievementIds = new Set();
        try {
          const uid = norm(usuario);
          const idSet = finalAchievementIds;
          // Preferir datos locales para consistencia con la cabecera (usando localData simétrico)
          try {
            const st = (localData && localData.stats) || {};
            if (typeof st.activeDays === 'number') activeDaysValid = st.activeDays;
            if (typeof st.isVip === 'boolean') {
              // Recalcular VIP con el flag local
              if (st.isVip) {
                isVip = true;
              }
            }
            // Recalcular partidas con valores locales
            // NOTA: NO sobreescribir vipBonus aquí — ya fue calculado correctamente
            // con la fecha de activación VIP en el bloque anterior.
            dailyBonus = activeDaysValid * 5;
            // Ruta rápida deshabilitada para asegurar consistencia con nube
            if (false) {
              let fastBestStreak = 0;
              try {
                const bs = st.bestStreak;
                if (typeof bs === 'number') fastBestStreak = bs;
              } catch (_) { }
              try {
                if (!fastBestStreak) {
                  const localStreaks = (localData.streaks || {});
                  if (typeof localStreaks.best === 'number') fastBestStreak = localStreaks.best;
                }
              } catch (_) { }
              // Bono de racha aproximado por mejor racha
              try {
                const steps = Math.min(Math.max((fastBestStreak || 0) - 1, 0), 10);
                const tri = (steps * (steps + 1)) / 2;
                const mult = (POINTS_CONFIG && typeof POINTS_CONFIG.STREAK_MULTIPLIER === 'number') ? POINTS_CONFIG.STREAK_MULTIPLIER : 2;
                streakBonus = tri * mult;
              } catch (_) { }
              // Calcular logros únicamente desbloqueados (union)
              try {
                const localAch = Array.isArray(localData.achievements) ? localData.achievements : [];
                (localAch || []).forEach(id => idSet.add(String(id)));
              } catch (_) { }
              try {
                const statsDoc = await db.collection('userStats').doc(uid).get();
                if (statsDoc.exists) {
                  const sdata = statsDoc.data() || {};
                  const statAch = Array.isArray(sdata.achievements) ? sdata.achievements : [];
                  (statAch || []).forEach(id => idSet.add(String(id)));
                }
              } catch (_) { }
              try {
                const achDoc = await db.collection('userAchievements').doc(uid).get();
                if (achDoc.exists) {
                  const a = achDoc.data() || {};
                  const ids = Array.isArray(a.ids) ? a.ids : (Array.isArray(a.achievements) ? a.achievements : (Array.isArray(a.list) ? a.list : []));
                  (ids || []).forEach(id => idSet.add(String(id)));
                }
              } catch (_) { }
              achievements = Array.from(idSet).reduce((sum, id) => {
                const found = ACHIEVEMENTS && ACHIEVEMENTS.find ? ACHIEVEMENTS.find(x => x.id === id) : null;
                return sum + (found && typeof found.points === 'number' ? found.points : 0);
              }, 0);
              const fastBase = playedCount * 25;
              const fastVip = isVip ? playedCount * 40 : 0;
              const fastDaily = activeDaysValid * 5;
              const fastSum = fastBase + fastVip + fastDaily + achievements + streakBonus;
              let displayTotal = fastSum;
              return {
                usuario,
                playedCount,
                activeDaysValid,
                isVip,
                base: fastBase,
                vipBonus: fastVip,
                dailyBonus: fastDaily,
                achievements,
                streakBonus,
                residual: 0,
                total: displayTotal,
                detail: [],
                achievementsList: []
              };
            }
          } catch (_) { }
          // AGREGACIÓN DE LOGROS: Iterar por todos los IDs vinculados
          for (const fid of fusedIds) {
            const currentUid = norm(fid);
            try {
              const achDoc = await db.collection('userAchievements').doc(currentUid).get();
              if (achDoc.exists) {
                const a = achDoc.data() || {};
                const ids = Array.isArray(a.ids) ? a.ids : (Array.isArray(a.achievements) ? a.achievements : (Array.isArray(a.list) ? a.list : []));
                (ids || []).forEach(id => idSet.add(String(id)));
              }
            } catch (_) { }
            try {
              const bestStats = await fetchIndividualUserStatsDoc(currentUid);
              if (bestStats && bestStats.data) {
                const sdata = bestStats.data || {};
                // Revisar en ambas ubicaciones posibles (raíz y dentro de gamification)
                const statAch = Array.isArray(sdata.achievements) ? sdata.achievements : 
                               (sdata.gamification && Array.isArray(sdata.gamification.achievements) ? sdata.gamification.achievements : []);
                (statAch || []).forEach(id => idSet.add(String(id)));
              }
            } catch (_) { }
          }
          
          try {
            const localAch = (localData && Array.isArray(localData.achievements)) ? localData.achievements : [];
            (localAch || []).forEach(id => idSet.add(String(id)));
          } catch (_) { }

          achievements = Array.from(idSet).reduce((sum, id) => {
            const found = ACHIEVEMENTS && ACHIEVEMENTS.find ? ACHIEVEMENTS.find(x => x.id === id) : null;
            return sum + (found && typeof found.points === 'number' ? found.points : 0);
          }, 0);
          achievements = Math.max(0, achievements);
        } catch (_) { }
        let cloudTotal = 0;
        let bestStreakVal = 0;
        let lastManualAdjustment = null;
        let manualBonus = 0;
        let statsDoc = {};

        try {
          // AGREGACIÓN DE RACHAS Y AJUSTES: Iterar por todos los IDs vinculados usando fetchIndividualUserStatsDoc
          for (const fid of fusedIds) {
            try {
              const bestStats = await fetchIndividualUserStatsDoc(fid);
              const sDoc = bestStats && bestStats.data ? (bestStats.data || {}) : {};
              
              // Quedarnos con el total acumulado mayor de la nube por si acaso
              cloudTotal = Math.max(cloudTotal, Number(sDoc.totalPoints || 0));
              
              // Quedarnos con la MEJOR racha de cualquiera de las cuentas
              if (typeof sDoc.bestStreak === 'number') {
                bestStreakVal = Math.max(bestStreakVal, sDoc.bestStreak);
              }

              // Sumar TODOS los ajustes manuales históricos de todas las cuentas sin duplicar
              if (typeof sDoc.totalManualAdjustment === 'number') {
                manualBonus += sDoc.totalManualAdjustment;
              } else if (sDoc.lastManualAdjustment && typeof sDoc.lastManualAdjustment.amount === 'number') {
                manualBonus += sDoc.lastManualAdjustment.amount;
              }

              // FALLBACK DE SEGURIDAD NUBE PARA DÍAS ACTIVOS Y ARTISTAS
              if (typeof sDoc.activeDays === 'number') {
                activeDaysValid = Math.max(activeDaysValid, sDoc.activeDays);
              }
              if (typeof sDoc.uniqueArtists === 'number') {
                playedArtistsSetSize = Math.max(playedArtistsSetSize, sDoc.uniqueArtists);
              }

              // FALLBACK DE SEGURIDAD NUBE PARA LOGROS (PRIMERO EN PEDIR Y ZERO FM)
              if (typeof sDoc.firstRequests === 'number') {
                cloudFirstRequests = Math.max(cloudFirstRequests, sDoc.firstRequests);
              } else if (sDoc.gamification && sDoc.gamification.stats && typeof sDoc.gamification.stats.firstRequests === 'number') {
                cloudFirstRequests = Math.max(cloudFirstRequests, sDoc.gamification.stats.firstRequests);
              }

              if (typeof sDoc.zeroFMSongs === 'number') {
                cloudZeroFMSongs = Math.max(cloudZeroFMSongs, sDoc.zeroFMSongs);
              } else if (sDoc.gamification && sDoc.gamification.stats && typeof sDoc.gamification.stats.zeroFMSongs === 'number') {
                cloudZeroFMSongs = Math.max(cloudZeroFMSongs, sDoc.gamification.stats.zeroFMSongs);
              }

              if (typeof sDoc.topArtistCount === 'number') {
                cloudTopArtistCount = Math.max(cloudTopArtistCount, sDoc.topArtistCount);
              } else if (sDoc.gamification && sDoc.gamification.stats && typeof sDoc.gamification.stats.topArtistCount === 'number') {
                cloudTopArtistCount = Math.max(cloudTopArtistCount, sDoc.gamification.stats.topArtistCount);
              }

              if (typeof sDoc.topArtistCountPlayed === 'number') {
                cloudTopArtistCountPlayed = Math.max(cloudTopArtistCountPlayed, sDoc.topArtistCountPlayed);
              } else if (sDoc.gamification && sDoc.gamification.stats && typeof sDoc.gamification.stats.topArtistCountPlayed === 'number') {
                cloudTopArtistCountPlayed = Math.max(cloudTopArtistCountPlayed, sDoc.gamification.stats.topArtistCountPlayed);
              }

              if (!statsDoc.totalPoints) statsDoc = sDoc; // Guardar referencia para otros campos
            } catch (_) { }
          }
        } catch (_) { }

        // Fallback a localData para bestStreak si no se encontró en nube (usando localData simétrico)
        try {
          if (!bestStreakVal) {
            const streaks = (localData && localData.streaks) || {};
            if (typeof streaks.best === 'number') bestStreakVal = streaks.best;
          }
        } catch (_) { }
        // Calcular bono acumulado por racha usando secuencias detectadas; si no hay, aproximar por bestStreakVal
        try {
          if (streakPointsSum > 0) {
            streakBonus = streakPointsSum;
          } else {
            const steps = Math.min(Math.max((bestStreakVal || 0) - 1, 0), 10);
            const tri = (steps * (steps + 1)) / 2;
            const mult = (POINTS_CONFIG && typeof POINTS_CONFIG.STREAK_MULTIPLIER === 'number') ? POINTS_CONFIG.STREAK_MULTIPLIER : 2;
            streakBonus = Math.max(0, tri * mult); // Ensure non-negative
          }
        } catch (_) { streakBonus = 0; }
        const top1Bonus = top1Count * 150;
        // manualBonus ya fue calculado arriba iterando fusedIds

        let redemptionsSpent = 0;
        let redemptions = [];
        try {
          const dbRef = window.db || db;
          const userKeys = fusedIds.map(norm);
          const map = new Map();
          try {
            const snapKey = await dbRef.collection('rewardRequests').where('userKey', 'in', userKeys).get();
            snapKey.forEach(doc => {
              const d = doc.data() || {};
              map.set(doc.id, {
                id: doc.id,
                rewardId: d.rewardId,
                rewardName: d.rewardName,
                cost: Number(d.cost || 0),
                status: String(d.status || ''),
                timestamp: d.timestamp || d.processedAt || ''
              });
            });
          } catch (_) { }
          for (let i = 0; i < fusedIds.length; i++) {
            const cand = fusedIds[i];
            try {
              const snap = await dbRef.collection('rewardRequests').where('userId', '==', cand).get();
              snap.forEach(doc => {
                const d = doc.data() || {};
                map.set(doc.id, {
                  id: doc.id,
                  rewardId: d.rewardId,
                  rewardName: d.rewardName,
                  cost: Number(d.cost || 0),
                  status: String(d.status || ''),
                  timestamp: d.timestamp || d.processedAt || ''
                });
              });
            } catch (_) { }
          }
          const safeGetTime = (ts) => {
            if (!ts) return 0;
            if (typeof ts.toDate === 'function') return ts.toDate().getTime();
            if (typeof ts.toMillis === 'function') return ts.toMillis();
            if (ts.seconds) return ts.seconds * 1000;
            const d = new Date(ts);
            return isNaN(d.getTime()) ? 0 : d.getTime();
          };
          redemptions = Array.from(map.values()).sort((a, b) => safeGetTime(b.timestamp) - safeGetTime(a.timestamp));
          redemptionsSpent = redemptions
            .filter(r => r && (r.status === 'pending' || r.status === 'approved' || r.status === 'completed' || r.status === 'delivered'))
            .reduce((sum, r) => sum + Math.max(0, Number(r.cost || 0)), 0);
        } catch (_) { }

        let checkInPoints = 0;
        let likesPoints = 0;
        let likesCount = 0;
        let likesPerPoint = 1;
        let giftPoints = 0;
        let totalCoinsDonated = 0;
        const fusedDetails = {};

        try {
          for (const fid of fusedIds) {
            const bestStats = await fetchIndividualUserStatsDoc(fid);
            const statsDoc = bestStats && bestStats.data ? (bestStats.data || {}) : {};

            // AGREGACIÓN ADITIVA EXCLUSIVA POR CUENTA: Sumar los puntos de cada cuenta vinculada por separado sin duplicar
            checkInPoints += Number(statsDoc.totalCheckInPoints || 0);

            const lCount = Number(statsDoc.totalLikes || 0);
            const lPerPoint = Number(statsDoc.likesPerPoint || 300);
            let lPoints = Number(statsDoc.totalLikesPoints || 0);
            if (lCount > 0 && lPoints === 0) {
              lPoints = Math.floor(lCount / lPerPoint);
            }
            likesPoints += lPoints;
            likesCount += lCount;
            giftPoints += Number(statsDoc.totalGiftPoints || 0);
            totalCoinsDonated += Number(statsDoc.totalCoinsDonated || 0);

            fusedDetails[fid] = {
              checkIn: Number(statsDoc.totalCheckInPoints || 0),
              likes: lPoints,
              gifts: Number(statsDoc.totalGiftPoints || 0),
              coins: Number(statsDoc.totalCoinsDonated || 0),
              total: Number(statsDoc.totalPoints || 0)
            };

            if (!tiktokId) tiktokId = statsDoc.tiktokId || statsDoc.tiktokAlias || null;
          }
        } catch (_) { }

        const earnedTotal = (playedCount * 25) + (isVip ? (playedCount * 40) : 0) + (activeDaysValid * 5) + achievements + streakBonus + top1Bonus + manualBonus + checkInPoints + likesPoints + giftPoints;

        // --- LOGICA DE CANJES ---
        // Aquí no inventamos canjes "sombra" para que cuadre con la nube.
        // Si hay discrepancias, es porque falta un canje por registrar o hay puntos fantasma.
        const predictedNet = earnedTotal - redemptionsSpent;

        // --- COHERENCIA GLOBAL: Usar siempre el cálculo reconstruido como verdad ---
        // Si el historial (playedSongs + requests) dice X, entonces es X.
        // Ignoramos el valor cacheado 'cloudTotal' para el display, pero lo actualizamos si difiere.
        // EXCEPCIÓN: Si somos Admin viendo a otro, 'cloudTotal' ES la verdad.

        // FIX CRÍTICO: Si el cloudTotal es mucho mayor que el earnedTotal calculado (por ejemplo, por el bug de likes),
        // debemos confiar en earnedTotal (el recalculado corregido) para sanear el dato inflado.
        // Antes usábamos 'cloudTotal' si era mayor, lo que perpetuaba el error.

        // --- CALCULO FINAL ESTRICTO ---
        // La Verdad es el cálculo reconstruido (predictedNet). 
        // No protegemos contra la nube si la nube está inflada (puntos fantasma).
        displayTotal = Math.max(0, predictedNet);
        adjustment = 0; // Ya no usamos ajustes mágicos para inflar el display

        try {
          // IMPORTANTE:
          // `computeUserBreakdown` ahora es una función de cálculo/presentación.
          // Ya no debe reescribir `totalPoints` por sí sola porque eso causaba
          // conflictos con el bot, rewards, check-ins y otros flujos.
          //
          // Si en el futuro se quiere persistir desde aquí, debe hacerse de forma
          // explícita desde el caller con `persistToCloud: true`.
          if (options && options.persistToCloud === true) {
            const diff = Math.abs(Number(cloudTotal || 0) - displayTotal);
            const isHigher = displayTotal >= Number(cloudTotal || 0);
            if ((diff > 0.1 || !cloudTotal) && isHigher) {
              const docRef = db.collection('userStats').doc(norm(usuario));
              await docRef.set({
                totalPoints: displayTotal,
                breakdown: {
                  base: (playedCount * 25),
                  vip: (isVip ? (playedCount * 40) : 0),
                  daily: (activeDaysValid * 5),
                  achievements: achievements,
                  streak: streakBonus,
                  top1: top1Bonus,
                  manual: manualBonus,
                  spent: redemptionsSpent
                },
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
              cloudTotal = displayTotal;
            }
          }
        } catch (e) { console.error('Error syncing points to cloud:', e); }
        // Construir lista de insignias para UI
        let achievementsList = [];
        try {
          const achCatalog = Array.isArray(ACHIEVEMENTS) ? ACHIEVEMENTS : [];
          achievementsList = Array.from(finalAchievementIds).map(id => {
            const found = achCatalog.find(x => x && x.id === id);
            return { id, title: (found && found.title) || id, points: (found && typeof found.points === 'number') ? found.points : 0 };
          });
        } catch (_) { }
        return {
          usuario,
          playedCount,
          vipEligibleSongs: (isVip ? vipEligibleSongs : 0),
          activeDaysValid,
          isVip,
          base: (playedCount * 25),
          vipBonus: (isVip ? (playedCount * 40) : 0),
          dailyBonus: (activeDaysValid * 5),
          achievements,
          streakBonus,
          top1Count,
          top1Bonus,
          manualBonus,
          cloudTotal: Math.max(0, Number(cloudTotal || 0)),
          earnedTotal: Math.max(0, Number(earnedTotal || 0)),
          redemptionsSpent: Math.max(0, Number(redemptionsSpent || 0)),
          redemptions: redemptions || [],
          adjustment: Number(adjustment || 0),
          total: Math.max(0, Number(displayTotal || 0)),
          detail,
          achievementsList,
          requestedCount: totalRequestedCount,
          uniqueArtists: Math.max(playedArtistsSet.size, playedArtistsSetSize || 0),
          uniqueArtistsPlayed: Math.max(playedArtistsSet.size, playedArtistsSetSize || 0),
          redemptions,
          likesPoints,
          likesCount,
          likesPerPoint,
          giftPoints,
          totalCoinsDonated,
          tiktokId,
          fusedIds,
          fusedDetails,
          currentStreak: currentStreakComputed || 0,
          bestStreak: Math.max(bestStreakComputed || 0, bestStreakVal || 0),
          firstRequests: cloudFirstRequests,
          zeroFMSongs: Math.max(calculatedZeroFMPlayed, cloudZeroFMSongs),
          zeroFMSongsPlayed: Math.max(calculatedZeroFMPlayed, cloudZeroFMSongs),
          topArtistCount: Math.max(calculatedTopArtistCount, cloudTopArtistCount),
          topArtistCountPlayed: Math.max(calculatedTopArtistCountPlayed, cloudTopArtistCountPlayed)
        };
      }
      async function renderPointsBreakdownForUser(u, force = false) {
        // Cache simple para mejorar tiempos de carga
        window.__breakdownCache = window.__breakdownCache || {};
        const key = String(u || '').toLowerCase();
        const now = Date.now();
        const cached = window.__breakdownCache[key];
        let bd;
        // COHERENCIA: Eliminado bloque de renderizado rápido que causaba discrepancias (83 vs 452)
        // Ahora esperamos al cálculo consolidado oficial para evitar inconsistencias entre pestañas.
        try {
          if (!force && cached && (now - cached.updatedAt) < 5000) { // Reduced from 30000 to 5000 for faster updates
            bd = cached.data;
          } else {
            bd = await computeUserBreakdown(u);
            window.__breakdownCache[key] = { updatedAt: now, data: bd };
          }
        } catch (err) {
          console.error('❌ Error rendering points breakdown (main load):', err);
        }

        const activePanel = document.getElementById('gamification-breakdown');
        const currentUserAtPaint = getCurrentProfileUser();
        if (!activePanel || !activePanel.classList.contains('active') || String(currentUserAtPaint || '').toLowerCase() !== key) {
          return;
        }
        const setNum = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.textContent = String(val);
        };
        // --- COHERENCIA: Usar cálculo real consolidado ---
        // Ya no recalculamos aquí porque computeUserBreakdown() ya hizo todo el trabajo pesado
        // de sumar cuentas vinculadas y calcular ajustes de forma robusta.
        if (!bd || typeof bd.total !== 'number') {
          console.warn('⚠️ Breakdown data incomplete, attempting emergency fallback.');
          try {
            bd = await computeUserBreakdown(u);
          } catch (err) {
            console.error('❌ Emergency fallback failed:', err);
          }
        }

        if (!bd) {
          console.error('❌ Cannot render breakdown: data is unavailable.');
          return;
        }

        setNum('breakdown-played-base', Number(bd.playedCount || 0));
        const vipSongs = bd.vipEligibleSongs !== undefined ? Number(bd.vipEligibleSongs) : (bd.isVip ? Number(bd.playedCount || 0) : 0);
        setNum('breakdown-vip-bonus', vipSongs);
        setNum('breakdown-daily-bonus', Number(bd.activeDaysValid || 0));
        const achPlus = Number(bd.achievements || 0) + Number(bd.streakBonus || 0) + Number(bd.top1Bonus || 0) + Number(bd.manualBonus || 0) + Number(bd.likesPoints || 0) + Number(bd.giftPoints || 0) + Number(bd.adjustment || 0);
        setNum('breakdown-achievements', Number(achPlus || 0));
        const red = -Math.max(0, Number(bd.redemptionsSpent || 0));
        setNum('breakdown-streak-residual', String(red));
        setNum('breakdown-total', Number(bd.total || 0));
        bd.playedCount = Number(bd.playedCount || Math.floor(Number(bd.base || 0) / 25));
        const headerPoints = document.getElementById('user-points');
        if (headerPoints) headerPoints.textContent = String(Number(bd.total || 0));
        const rewardsPoints = document.getElementById('rewards-user-points');
        if (rewardsPoints) rewardsPoints.textContent = String(Number(bd.total || 0));
        const list = document.getElementById('breakdown-detail-list');
        if (list) {
          const lines = [];

          // Vinculación TikTok (NUEVO)
          const linkedId = bd.tiktokId ? `@${bd.tiktokId.replace(/^@/, '')}` : 'N/A';
          lines.push(`<div class="genre-chip"><span>🔗 Vinculación TikTok</span><span class="pts-val-white">${linkedId}</span></div>`);

          // Mostrar puntos de la cuenta vinculada si existe fusión
          if (bd.fusedIds && bd.fusedIds.length > 1) {
            const norm = (s) => String(s || '').trim().replace(/^@/, '').toLowerCase();
            const currentId = norm(bd.usuario);
            
            // Recorrer TODAS las cuentas fusionadas, no solo la primera
            const otherIds = bd.fusedIds.filter(id => norm(id) !== currentId);
            
            for (const otherId of otherIds) {
              const details = (bd.fusedDetails && bd.fusedDetails[otherId]) ? bd.fusedDetails[otherId] : null;
              const label = otherId.includes('@') || bd.tiktokId === otherId ? `Puntos TikTok (@${otherId.replace(/^@/, '')})` : `Puntos Cuenta Web (${otherId})`;
              const detailId = `fused-detail-${otherId.replace(/[^a-z0-9]/g, '')}`;

              let detailHtml = '';
              if (details) {
                detailHtml = `
                        <div id="${detailId}" style="display:none; width:100%; padding: 10px 14px; background: rgba(0,0,0,0.3); border-radius: 10px; margin-top: 10px; font-size: 0.9em; box-shadow: inset 0 2px 5px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05);">
                            <div style="display:flex; justify-content:space-between; margin-bottom:4px; opacity:0.8;"><span>📅 Check-ins</span><span>${details.checkIn} pts</span></div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:4px; opacity:0.8;"><span>❤️ Likes</span><span>${details.likes} pts</span></div>
                            <div style="display:flex; justify-content:space-between; opacity:0.8;"><span>🎁 Regalos</span><span>${details.gifts} pts</span></div>
                        </div>
                    `;
              }

              lines.push(`
                  <div class="genre-chip" style="flex-direction: column; align-items: stretch; height: auto; padding: 10px 15px; border: 1px solid rgba(0, 229, 255, 0.2); background: rgba(0, 229, 255, 0.05);">
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                      <span style="display:flex; align-items:center; gap:10px;">
                        💰 ${label}
                        ${details ? `<button onclick="const el = document.getElementById('${detailId}'); el.style.display = el.style.display === 'none' ? 'block' : 'none'; this.textContent = el.style.display === 'none' ? '+' : '-';" style="background:rgba(0, 229, 255, 0.2); border:1px solid rgba(0, 229, 255, 0.3); color:white; border-radius:6px; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:bold;">+</button>` : ''}
                      </span>
                      <span class="pts-val-white" style="font-weight:900;">${details ? details.total : 0} pts</span>
                    </div>
                    ${detailHtml}
                  </div>
                `);
            }
          }

          // Canciones
          lines.push(`<div class="genre-chip"><span>🎵 Canciones (${bd.playedCount} total)</span><span class="pts-val-blue">${bd.base} pts</span></div>`);

          // VIP (solo si es VIP)
          if (bd.isVip) {
            lines.push(`<div class="genre-chip"><span>👑 Bono VIP (×40)</span><span class="pts-val-gold">${bd.vipBonus} pts</span></div>`);
          }

          // Diario
          lines.push(`<div class="genre-chip"><span>📅 Bono Días Activos (${bd.activeDaysValid})</span><span class="pts-val-white">${bd.dailyBonus} pts</span></div>`);

          // Likes (Nuevo)
          if (bd.likesPoints > 0) {
            lines.push(`<div class="genre-chip"><span>❤️ Puntos por Likes</span><span class="pts-val-white">${bd.likesPoints} pts</span></div>`);
          }

          // Regalos (Nuevo)
          if (bd.giftPoints > 0) {
            lines.push(`<div class="genre-chip"><span>🎁 Puntos por Regalos</span><span class="pts-val-white">${bd.giftPoints} pts</span></div>`);
          }

          // Top 1 Diario (Nuevo)
          if (bd.top1Bonus > 0) {
            lines.push(`<div class="genre-chip"><span>🏆 Top 1 Diario (${bd.top1Count})</span><span class="pts-val-gold">${bd.top1Bonus} pts</span></div>`);
          }

          // Rachas (solo si hay puntos)
          if (bd.streakBonus > 0) {
            lines.push(`<div class="genre-chip"><span>🔥 Bono de Rachas</span><span class="pts-val-white">${bd.streakBonus} pts</span></div>`);
          }

          // Logros (solo si hay puntos)
          if (bd.achievements > 0) {
            lines.push(`<div class="genre-chip"><span>🏅 Logros Desbloqueados</span><span class="pts-val-white">${bd.achievements} pts</span></div>`);
          }

          // Compensación (si existe)
          if (bd.manualBonus && bd.manualBonus !== 0) {
            const mSign = bd.manualBonus > 0 ? '+' : '';
            lines.push(`<div class="genre-chip"><span>🧩 Compensación Admin</span><span class="pts-val-green">${mSign}${bd.manualBonus} pts</span></div>`);
          }


          // Canjes
          if (Number(bd.redemptionsSpent || 0) > 0 || (Array.isArray(bd.redemptions) && bd.redemptions.length > 0)) {
            const rList = Array.isArray(bd.redemptions) ? bd.redemptions : [];
            let rHtml = '';
            if (rList.length > 0) {
              const itemsHtml = rList.map(r => {
                const isRejectedOrCancelled = r.status === 'rejected' || r.status === 'cancelled';
                const statusLabel = r.status === 'rejected' ? ' (Rechazado)' : 
                                    r.status === 'cancelled' ? ' (Cancelado)' : 
                                    r.status === 'pending' ? ' (Pendiente)' : '';
                
                const statusColor = r.status === 'rejected' ? '#ef4444' : 
                                    r.status === 'cancelled' ? '#9ca3af' : 
                                    r.status === 'pending' ? '#eab308' : '#22c55e';
                                    
                const textDecoration = isRejectedOrCancelled ? 'line-through' : 'none';
                const opacity = isRejectedOrCancelled ? 0.6 : 1.0;
                const costDisplay = isRejectedOrCancelled ? `0 pts` : `-${r.cost} pts`;
                
                return `
                  <div style="display:flex; justify-content:space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); opacity: ${opacity};">
                    <span>
                      ${r.rewardName || 'Recompensa'} 
                      ${statusLabel ? `<strong style="color: ${statusColor}; font-size: 0.85em; font-weight: 800;">${statusLabel}</strong>` : ''}
                    </span>
                    <span style="text-decoration: ${textDecoration}; font-weight: ${isRejectedOrCancelled ? 'normal' : 'bold'}; color: ${isRejectedOrCancelled ? '#9ca3af' : '#ff0050'};">
                      ${costDisplay}
                    </span>
                  </div>
                `;
              }).join('');
              
              rHtml = `
                <div id="redemption-breakdown-list" style="display:none; width:100%; padding: 8px 12px; background: rgba(0,0,0,0.3); border-radius: 8px; margin-top: 8px; font-size: 0.9em; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);">
                  ${itemsHtml}
                </div>
              `;
            }

            lines.push(`
              <div class="genre-chip" style="flex-direction: column; align-items: stretch; height: auto; padding: 10px 15px;">
                <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                  <span style="display:flex; align-items:center; gap:10px;">
                    🛒 Canje de Recompensas
                    ${rList.length > 0 ? `<button onclick="const list = document.getElementById('redemption-breakdown-list'); list.style.display = list.style.display === 'none' ? 'block' : 'none'; this.textContent = list.style.display === 'none' ? '+' : '-';" style="background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.1); color:white; border-radius:6px; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition: all 0.2s ease; font-weight:bold;">+</button>` : ''}
                  </span>
                  <span class="pts-val-red" style="font-weight:bold;">-${Number(bd.redemptionsSpent || 0)} pts</span>
                </div>
                ${rHtml}
              </div>
            `);
          }

          if (Number(bd.adjustment || 0) !== 0) {
            const adj = Number(bd.adjustment || 0);
            const sign = adj > 0 ? '+' : '';
            // Usar una etiqueta única y clara para evitar duplicados visuales
            lines.push(`<div class="genre-chip"><span>🛠️ Ajuste de Saldo (Cloud Sync)</span><span class="pts-val-white">${sign}${adj} pts</span></div>`);
          }

          // Total
          lines.push(`
            <div class="genre-chip receipt-total">
              <span>💰 TOTAL ACUMULADO</span>
              <span>${bd.total} PTS</span>
            </div>
          `);

          list.innerHTML = lines.join('');
        }
        // Reintento ligero si base quedó en 0 pero existe total positivo
        try {
          if ((bd.base === 0 || bd.playedCount === 0) && bd.total > 0 && !force) {
            const again = await computeUserBreakdown(u);
            if (again && (again.base > bd.base || again.playedCount > bd.playedCount)) {
              window.__breakdownCache[key] = { updatedAt: Date.now(), data: again };
              return renderPointsBreakdownForUser(u, true);
            }
          }
        } catch (_) { }
      }
      window.__ALLOW_BREAKDOWN_WRITE__ = true;
      function getCurrentProfileUser() {
        const sel = document.getElementById('gamification-user-select');
        const v = sel ? String(sel.value || '').trim().replace(/^@/, '') : '';
        if (v) return v;
        const cur = localStorage.getItem('currentUser') || '';
        const fallback = (cur || '').replace(/^@/, '');
        if (fallback) return fallback;
        try {
          if (typeof getCurrentSelectedUser === 'function') {
            const s = String(getCurrentSelectedUser() || '').trim().replace(/^@/, '');
            if (s) return s;
          }
          if (typeof getCurrentUser === 'function') {
            const u = String(getCurrentUser() || '').trim().replace(/^@/, '');
            if (u) return u;
          }
        } catch (_) { }
        return '';
      }
      (function setupBreakdownTab() {
        document.addEventListener('click', async function (e) {
          const btn = e.target && e.target.closest('.gamification-tab');
          if (!btn) return;
          const tab = btn.getAttribute('data-tab') || '';
          
          // Actualizar tabs activos
          const tabs = document.querySelectorAll('.gamification-tab');
          tabs.forEach(t => t.classList.remove('active'));
          btn.classList.add('active');

          const panels = document.querySelectorAll('.gamification-panel');
          panels.forEach(p => p.classList.remove('active'));
          const activePanel = document.getElementById('gamification-' + tab);
          if (activePanel) activePanel.classList.add('active');

          // Forzar repintado agresivo de títulos para modo oscuro y dispositivos táctiles
          setTimeout(() => {
            if (activePanel) {
              const titles = activePanel.querySelectorAll('h3, h4');
              const isDarkTheme = document.body.classList.contains('dark-theme');

              titles.forEach(title => {
                if (isDarkTheme) {
                  const originalColor = title.style.color;
                  title.style.color = 'transparent';
                  requestAnimationFrame(() => {
                    title.style.color = originalColor || '';
                    const originalTransform = title.style.transform;
                    title.style.transform = 'translate3d(0.1px, 0, 0)';
                    requestAnimationFrame(() => {
                      title.style.transform = originalTransform || 'translate3d(0, 0, 0)';
                    });
                  });
                } else {
                  const originalTransform = title.style.transform;
                  title.style.transform = 'translateZ(0.1px)';
                  requestAnimationFrame(() => {
                    title.style.transform = originalTransform || 'translateZ(0)';
                  });
                }
              });
            }
          }, 10);

          if (tab === 'breakdown') {
            const u = getCurrentProfileUser();
            if (u) {
              try {
                // Limpiar valores visuales para evitar ver datos viejos
                ['breakdown-played-base', 'breakdown-vip-bonus', 'breakdown-daily-bonus', 'breakdown-achievements', 'breakdown-streak-residual', 'breakdown-total'].forEach(id => {
                  const el = document.getElementById(id);
                  if (el) el.textContent = '-';
                });
                await renderPointsBreakdownForUser(u, true);
              } catch (err) {
                console.error('❌ Error handling breakdown tab click:', err);
              }
            }
          }
          if (tab === 'stats') {
            const u = getCurrentProfileUser();
            if (u) {
              try {
                const localData = getLocalGamificationData(u) || {};
                await renderPersonalStatsForUser(localData, u);
                startCloudRealtimeForUser(u);
              } catch (err) {
                console.error('❌ Error handling stats tab click:', err);
                const ids = ['personal-total-songs', 'personal-unique-artists', 'personal-active-days', 'personal-rank'];
                ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = id === 'personal-rank' ? '-' : '0'; });
              }
            }
          }
        });
        const sel = document.getElementById('gamification-user-select');
        if (sel) {
          sel.addEventListener('change', async function () {
            const panel = document.getElementById('gamification-breakdown');
            if (panel && panel.classList.contains('active')) {
              const u = getCurrentProfileUser();
              if (u) {
                try {
                  await renderPointsBreakdownForUser(u, true);
                } catch (err) {
                  console.error('❌ Error on user select change for breakdown:', err);
                }
              }
            }
            const statsPanel = document.getElementById('gamification-stats');
            if (statsPanel && statsPanel.classList.contains('active')) {
              const u = getCurrentProfileUser();
              if (u) {
                try {
                  const localData = getLocalGamificationData(u) || {};
                  await renderPersonalStatsForUser(localData, u);
                  startCloudRealtimeForUser(u);
                } catch (_) { }
              }
            }
          });
        }
      })();
      function countLocalPlayedForUser(usuario) {
        const norm = String(usuario || '').trim().replace(/^@/, '').toLowerCase();
        const localPlayedMap = JSON.parse(localStorage.getItem('playedSongs') || '{}');
        const sanitize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
        const prefix = sanitize(`${norm}-`);
        const ids = new Set();
        const days = Object.keys(localPlayedMap);
        for (let i = 0; i < days.length; i++) {
          if (!isOnOrAfterStart(days[i])) continue;
          const arr = Array.isArray(localPlayedMap[days[i]]) ? localPlayedMap[days[i]] : [];
          for (let j = 0; j < arr.length; j++) {
            const id = sanitize(arr[j]);
            if (id.startsWith(prefix)) ids.add(id);
          }
        }
        return ids.size;
      }
      function computeLocalSolicitudesStats(usuario) {
        const norm = String(usuario || '').trim().replace(/^@/, '').toLowerCase();
        const solicitudes = JSON.parse(localStorage.getItem('solicitudes') || '[]');
        const mine = solicitudes.filter(s => {
          const okUser = String(s.usuario || '').trim().replace(/^@/, '').toLowerCase() === norm;
          const d = String(s.day || (s.fecha || '').split('T')[0] || '').trim();
          return okUser && (!d || isOnOrAfterStart(d));
        });
        const totalSongs = mine.length;
        const uniqueArtists = new Set(mine.map(s => s.artista).filter(Boolean)).size;
        const days = new Set(mine.map(s => String(s.day || (s.fecha || '').split('T')[0] || '').trim()).filter(d => d && isOnOrAfterStart(d)));
        const activeDays = days.size;
        return { totalSongs, uniqueArtists, activeDays };
      }
      function stableSetStat(id, val, usuario) {
        const el = document.getElementById(id);
        if (!el) return;
        const nextNum = Number(val || 0);
        el.textContent = String(nextNum);
      }
      function setPlayedStat(val) {
        const el = document.getElementById('personal-total-played');
        if (!el) return;
        const cur = Number(el.textContent || 0);
        const next = Number(val || 0);
        try {
          const u = typeof getCurrentProfileUser === 'function' ? String(getCurrentProfileUser() || '').toLowerCase() : '';
          const ready = window.__toggleReady && window.__toggleReady[u];
          if (!ready && next === 0 && cur > 0) return;
        } catch (_) { }
        el.textContent = String(next);
      }
      function stableSetRank(id, userRank, usuario) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = userRank > 0 ? `#${userRank}` : '-';
      }
      window.__userSubs = window.__userSubs || {};
      function unsubscribeUserRealtime() {
        const subs = window.__userSubs;
        try { subs.solicitudes && subs.solicitudes(); } catch (_) { }
        try { subs.played && subs.played(); } catch (_) { }
        try { subs.allSolicitudes && subs.allSolicitudes(); } catch (_) { }
        try { subs.toggleEvents && subs.toggleEvents(); } catch (_) { }
        window.__userSubs = {};
      }
      function startCloudRealtimeForUser(usuario) {
        unsubscribeUserRealtime();
        const u = String(usuario || '').trim().replace(/^@/, '');
        const norm = u.toLowerCase();

        // Utilidad para sincronizar UI de estadísticas con el desglose en tiempo real consolidado
        const syncStatsWithBreakdown = async () => {
          try {
            console.log(`📊 [RealtimeStats] Sincronizando estadísticas en tiempo real para ${u}...`);
            const fresh = await computeUserBreakdown(u);
            if (fresh) {
              const sessKey = norm;
              window.__sessionBreakdownCache = window.__sessionBreakdownCache || {};
              window.__sessionBreakdownCache[sessKey] = fresh;

              // Actualizar UI de Estadísticas
              stableSetStat('personal-total-songs', Math.max(fresh.requestedCount || 0, fresh.playedCount || 0), u);
              stableSetStat('personal-unique-artists', fresh.uniqueArtists || 0, u);
              stableSetStat('personal-active-days', fresh.activeDaysValid || 0, u);
              setPlayedStat(fresh.playedCount || 0);

              // Si la pestaña de Transparencia (Breakdown) está activa, repintar
              const bdPanel = document.getElementById('gamification-breakdown');
              if (bdPanel && bdPanel.classList.contains('active')) {
                const curProfile = getCurrentProfileUser();
                if (curProfile && String(curProfile).toLowerCase() === norm) {
                  renderPointsBreakdownForUser(u, true).catch(() => { });
                }
              }
            }
          } catch (e) {
            console.error('Error en syncStatsWithBreakdown:', e);
          }
        };

        try {
          // Ejecución inmediata
          syncStatsWithBreakdown();
          
          // Intervalo de recarga (cada 45 segundos)
          const intervalId = setInterval(syncStatsWithBreakdown, 45000);
          window.__userSubs.solicitudes = () => clearInterval(intervalId);
        } catch (_) { }

        try {
          // Polling para el rango global consolidado
          const pollAllSolicitudes = async () => {
            try {
              const doc = await db.collection('globalStats').doc('userTotals').get();
              if (doc.exists) {
                const totals = (doc.data() || {}).totals || {};
                const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
                const rank = sorted.findIndex(([name]) => name === norm) + 1;
                stableSetRank('personal-rank', rank, u);
              }
            } catch (e) {
              console.warn("Error en pollAllSolicitudes rank:", e);
            }
          };
          pollAllSolicitudes().catch(() => { });
          const intervalId = setInterval(pollAllSolicitudes, 60000);
          window.__userSubs.allSolicitudes = () => clearInterval(intervalId);
        } catch (_) { }
      }
      async function recountToggleTotalsForUser(usuario, startDay = '', endDay = '') {
        try {
          const user = String(usuario || '').trim().replace(/^@/, '').toLowerCase();
          const lo = startDay ? String(startDay).trim() : '';
          const hi = endDay ? String(endDay).trim() : '';
          const qs = await db.collection('systemEvents').where('type', '==', 'togglePlayed').where('usuario', '==', user).get();
          const latest = {};
          qs.forEach(doc => {
            const d = doc.data() || {};
            const day = String(d.day || '');
            if (lo && day && day < lo) return;
            if (hi && day && day > hi) return;
            const sid = String(d.songId || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
            if (!sid) return;
            const ts = d.ts && d.ts.toMillis ? d.ts.toMillis() : 0;
            const key = `${sid}|${day}`;
            const cur = latest[key];
            if (!cur || ts >= cur.ts) latest[key] = { action: String(d.action || '').toLowerCase(), ts, sid, day };
          });
          const set = new Set();
          Object.keys(latest).forEach(k => { const it = latest[k]; if (it.action === 'mark') set.add(it.sid); });
          // Union con playedSongs por día para capturar IDs ya marcadas históricamente
          try {
            const snap = await db.collection('playedSongs').get();
            snap.forEach(doc => {
              const dayId = String(doc.id || '');
              if (lo && dayId && dayId < lo) return;
              if (hi && dayId && dayId > hi) return;
              const d = doc.data() || {};
              const arr = Array.isArray(d.songs) ? d.songs : (Array.isArray(d.list) ? d.list : (Array.isArray(d.songIds) ? d.songIds : []));
              const skippedArr = Array.isArray(d.skipped) ? d.skipped : [];
              const skippedSet = new Set((skippedArr || []).map(x => String(x || '').toLowerCase().replace(/[^a-z0-9-]/g, '')));
              (arr || []).forEach(x => {
                const id = String(x || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
                const userPrefix = user.replace(/[^a-z0-9-]/g, '') + '-';
                if (id.startsWith(userPrefix)) set.add(id);
              });
              skippedSet.forEach((sid) => {
                const userPrefix = user.replace(/[^a-z0-9-]/g, '') + '-';
                if (sid && sid.startsWith(userPrefix)) set.delete(sid);
              });
            });
          } catch (_) { }
          const total = set.size;
          const ref = db.collection('playedSongs').doc('userTotals');
          await ref.set({ lastUpdated: firebase.firestore.FieldValue.serverTimestamp(), totals: {} }, { merge: true });
          const payload = {}; payload[`totals.${user}`] = total; await ref.set(payload, { merge: true });
          window.__userToggleSet = window.__userToggleSet || {}; window.__userToggleSet[user] = set;
          window.__toggleReady = window.__toggleReady || {}; window.__toggleReady[user] = true;
          try { setPlayedStat(total); } catch (_) { }
          return { user, total };
        } catch (err) {
          console.error('Error en recountToggleTotalsForUser:', err);
          return { user: String(usuario || '').trim(), total: 0, error: String(err) };
        }
      }
      async function recountToggleTotalsAll(startDay = '', endDay = '') {
        try {
          const lo = startDay ? String(startDay).trim() : '';
          const hi = endDay ? String(endDay).trim() : '';
          const qs = await db.collection('systemEvents').where('type', '==', 'togglePlayed').get();
          const latest = {};
          qs.forEach(doc => {
            const d = doc.data() || {};
            const user = String(d.usuario || '').toLowerCase();
            const day = String(d.day || '');
            if (lo && day && day < lo) return;
            if (hi && day && day > hi) return;
            const sid = String(d.songId || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
            if (!sid || !user) return;
            const ts = d.ts && d.ts.toMillis ? d.ts.toMillis() : 0;
            const key = `${user}|${sid}|${day}`;
            const cur = latest[key];
            if (!cur || ts >= cur.ts) latest[key] = { user, action: String(d.action || '').toLowerCase(), ts, sid, day };
          });
          const totals = {}; const sets = {};
          Object.keys(latest).forEach(k => {
            const it = latest[k]; if (!it || it.action !== 'mark') return;
            const u = it.user; sets[u] = sets[u] || new Set(); sets[u].add(it.sid);
          });
          // Union con playedSongs por día para cada usuario
          try {
            const snap = await db.collection('playedSongs').get();
            snap.forEach(doc => {
              const dayId = String(doc.id || '');
              if (lo && dayId && dayId < lo) return;
              if (hi && dayId && dayId > hi) return;
              const d = doc.data() || {};
              const arr = Array.isArray(d.songs) ? d.songs : (Array.isArray(d.list) ? d.list : (Array.isArray(d.songIds) ? d.songIds : []));
              const skippedArr = Array.isArray(d.skipped) ? d.skipped : [];
              const skippedSet = new Set((skippedArr || []).map(x => String(x || '').toLowerCase().replace(/[^a-z0-9-]/g, '')));
              (arr || []).forEach(x => {
                const id = String(x || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
                // Heurística: el primer segmento suele ser el usuario (pero puede fallar si el usuario tiene guiones)
                const u = id.split('-')[0] || '';
                if (!u) return;
                sets[u] = sets[u] || new Set();
                if (!skippedSet.has(id)) sets[u].add(id);
              });
            });
          } catch (_) { }
          Object.keys(sets).forEach(u => { totals[u] = sets[u].size; });
          const ref = db.collection('playedSongs').doc('userTotals');
          await ref.set({ lastUpdated: firebase.firestore.FieldValue.serverTimestamp(), totals }, { merge: true });
          window.__userToggleSet = window.__userToggleSet || {}; Object.keys(sets).forEach(u => { window.__userToggleSet[u] = sets[u]; });
          return { users: Object.keys(totals).length };
        } catch (err) {
          console.error('Error en recountToggleTotalsAll:', err);
          return { users: 0, error: String(err) };
        }
      }
      (function attachRebuildButton() {
        const btn = document.getElementById('rebuild-played-btn');
        if (!btn) return;
        function showToast(message, type = 'info') {
          let container = document.getElementById('toast-container');
          if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
          }
          const toast = document.createElement('div');
          toast.className = `toast toast-${type}`;
          toast.textContent = String(message || '');
          container.appendChild(toast);
          requestAnimationFrame(() => toast.classList.add('show'));
          setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 200);
          }, 3500);
        }
        btn.addEventListener('click', async () => {
          const uInput = document.getElementById('rebuild-user-input');
          const startInput = document.getElementById('rebuild-start-day');
          const endInput = document.getElementById('rebuild-end-day');
          const mode = uInput ? String(uInput.value || '').trim() : '';
          const dStart = startInput ? String(startInput.value || '').trim() : '';
          const dEnd = endInput ? String(endInput.value || '').trim() : '';
          let res;
          btn.disabled = true;
          showToast('Recontando canciones toggleadas…', 'info');
          if (mode) {
            res = await recountToggleTotalsForUser(mode, dStart, dEnd);
          } else {
            res = await recountToggleTotalsAll(dStart, dEnd);
          }
          if (res && !res.error) {
            const msg = res.total ? `Recuento para ${mode}: ${res.total}` : `Recuento global: ${res.users} usuarios`;
            showToast(msg, 'success');
          } else {
            const msg = res && res.error ? res.error : 'Recuento parcial';
            showToast(msg, 'warning');
          }
          btn.disabled = false;
        });
      })();

      (function attachSetMasterDJ() {
        const btn = document.getElementById('set-master-dj');
        if (!btn) return;

        // Actualizar estado visual del botón al cargar
        const updateBtnState = () => {
          const isDJ = localStorage.getItem('isMasterDJDevice') === 'true';
          btn.innerHTML = isDJ
            ? '🎛️ Liberar Control DJ (Modo Solo Lectura)'
            : '🎛️ Establecer ESTE dispositivo como DJ Maestro';
          btn.style.background = isDJ ? '#dc3545' : '#6610f2'; // Rojo para soltar, Púrpura para tomar
        };
        updateBtnState();

        btn.addEventListener('click', async () => {
          const isCurrentlyDJ = localStorage.getItem('isMasterDJDevice') === 'true';

          if (isCurrentlyDJ) {
            // Desactivar modo DJ
            if (!confirm('¿Liberar control DJ? Los botones de las canciones se podrán presionar pero NO cambiarán el estado.')) return;
            localStorage.setItem('isMasterDJDevice', 'false');
            alert('✅ Control liberado. Modo "Invitado" activo.');
            location.reload();
          } else {
            // Activar modo DJ
            if (!confirm('¿Tomar control DJ? Podrás marcar canciones como reproducidas.')) return;

            try {
              const currentFingerprint = generateDeviceFingerprint();
              if (window.db) {
                await window.db.collection('systemConfig').doc('djConfig').set({
                  masterFingerprint: currentFingerprint,
                  lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
              }

              localStorage.setItem('masterDJFingerprint', currentFingerprint);
              localStorage.setItem('isMasterDJDevice', 'true');
              alert('✅ Control DJ asignado. Modo "Admin" activo.');
              // Forzar actualización de UI
              if (typeof updateDJControls === 'function') updateDJControls();
              location.reload();
            } catch (e) {
              console.error(e);
              alert('❌ Error al asignar control: ' + e.message);
            }
          }
        });
      })();

      async function collectUsersForAdminRebuild() {
        const allUsers = new Map();
        const addUser = (name) => {
          const raw = String(name || '').trim();
          if (!raw) return;
          const key = raw.replace(/^@/, '').toLowerCase();
          if (!key) return;
          if (!allUsers.has(key)) allUsers.set(key, raw.replace(/^@/, ''));
        };

        try {
          const localSolicitudes = JSON.parse(localStorage.getItem('solicitudes') || '[]');
          localSolicitudes.forEach(sol => addUser(sol?.usuario));
        } catch (_) { }

        try {
          const byDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');
          Object.values(byDay).flat().forEach(sol => addUser(sol?.usuario));
        } catch (_) { }

        try {
          const solicitudesSnap = await db.collection('solicitudes').get();
          solicitudesSnap.forEach(doc => addUser((doc.data() || {}).usuario));
        } catch (error) {
          console.warn('Error obteniendo usuarios desde solicitudes:', error);
        }

        try {
          const usersSnap = await db.collection('users').get();
          usersSnap.forEach(doc => addUser((doc.data() || {}).name || doc.id));
        } catch (error) {
          console.warn('Error obteniendo usuarios desde users:', error);
        }

        try {
          const statsSnap = await db.collection('userStats').get();
          statsSnap.forEach(doc => {
            const d = doc.data() || {};
            addUser(d.displayName || d.name || doc.id);
          });
        } catch (error) {
          console.warn('Error obteniendo usuarios desde userStats:', error);
        }

        return Array.from(allUsers.values());
      }

      async function persistAdminRebuildForUser(username, breakdown) {
        const normUser = normalizeUserKey(username);
        const data = getGamificationDataForUser(username) || {};
        data.points = Math.max(0, Number(breakdown.total || 0));
        data.xp = data.points;
        data.level = calculateLevel(data.points);
        data.autoProcessed = true;
        saveGamificationDataForUser(data, username);

        await db.collection('userStats').doc(normUser).set({
          displayName: username,
          totalPoints: data.points,
          totalManualAdjustment: Number(breakdown.manualBonus || 0),
          level: data.level,
          achievements: Array.isArray(data.achievements) ? data.achievements : [],
          gamification: data,
          breakdown: {
            base: Number(breakdown.base || 0),
            vip: Number(breakdown.vipBonus || 0),
            daily: Number(breakdown.dailyBonus || 0),
            achievements: Number(breakdown.achievements || 0),
            streak: Number(breakdown.streakBonus || 0),
            top1: Number(breakdown.top1Bonus || 0),
            manual: Number(breakdown.manualBonus || 0),
            likes: Number(breakdown.likesPoints || 0),
            gifts: Number(breakdown.giftPoints || 0),
            spent: Number(breakdown.redemptionsSpent || 0)
          },
          lastAdminRebuildAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      // Flags de control de flujo para el recálculo
      window.__RECALC_PAUSED__ = false;
      window.__RECALC_STOPPED__ = false;

      (function attachRecalcControls() {
        const pauseBtn = document.getElementById('recalc-pause');
        const stopBtn = document.getElementById('recalc-stop');
        if (pauseBtn) {
          pauseBtn.addEventListener('click', () => {
            window.__RECALC_PAUSED__ = !window.__RECALC_PAUSED__;
            pauseBtn.textContent = window.__RECALC_PAUSED__ ? '▶️' : '⏸️';
            pauseBtn.style.background = window.__RECALC_PAUSED__ ? 'rgba(16, 185, 129, 0.2)' : '';
            const statusBadge = document.getElementById('recalc-status-badge');
            if (statusBadge) {
              statusBadge.textContent = window.__RECALC_PAUSED__ ? 'PAUSADO' : 'PROCESANDO';
              statusBadge.style.color = window.__RECALC_PAUSED__ ? '#f59e0b' : '#22d3ee';
            }
          });
        }
        if (stopBtn) {
          stopBtn.addEventListener('click', () => {
            if (confirm('¿Detener el recálculo masivo ahora?')) {
              window.__RECALC_STOPPED__ = true;
              window.__RECALC_PAUSED__ = false;
            }
          });
        }
      })();

      window.runFullAdminPointsRebuild = async function () {
        if (window.__ADMIN_POINTS_REBUILD_RUNNING__) {
          console.warn('⚠️ Ya hay un recálculo masivo en curso.');
          return { total: 0, corrected: 0, skipped: true };
        }
        window.__ADMIN_POINTS_REBUILD_RUNNING__ = true;
        
        const reportBox = document.getElementById('recalc-report-box');
        const reportText = document.getElementById('recalc-report-text');
        const progressBar = document.getElementById('recalc-progress-bar');
        const totalUsersVal = document.getElementById('recalc-total-users');
        const processedUsersVal = document.getElementById('recalc-processed-users');
        const correctedUsersVal = document.getElementById('recalc-corrected-users');
        const currentUserVal = document.getElementById('recalc-current-user');
        const statusBadge = document.getElementById('recalc-status-badge');
        const singleUserInput = document.getElementById('recalc-single-user');
        const targetUser = singleUserInput ? String(singleUserInput.value || '').trim() : '';
        
        if (reportBox) {
          reportBox.hidden = false;
          if (statusBadge) {
            statusBadge.textContent = 'PROCESANDO';
            statusBadge.style.background = 'rgba(34, 211, 238, 0.2)';
            statusBadge.style.color = '#22d3ee';
          }
          if (progressBar) progressBar.style.width = '0%';
        }

        console.log('🔧 INICIANDO RECÁLCULO MASIVO COMPLETO DE PUNTOS...');

        try {
          let allUsers = [];
          if (targetUser) {
            allUsers = [targetUser];
          } else {
            allUsers = await collectUsersForAdminRebuild();
          }
          const totalUsers = allUsers.length;
          if (totalUsersVal) totalUsersVal.textContent = totalUsers;
          
          console.log(`📊 Recalculando puntos para ${totalUsers} usuarios...`);

          let correctedCount = 0;
          let processed = 0;
          let errorCount = 0;
          const deltas = [];

          for (const username of allUsers) {
            if (window.__RECALC_STOPPED__) break;
            while (window.__RECALC_PAUSED__) {
              await new Promise(r => setTimeout(r, 500));
              if (window.__RECALC_STOPPED__) break;
            }
            if (window.__RECALC_STOPPED__) break;

            try {
              processed++;
              
              // Actualizar UI de Escaneo
              if (processedUsersVal) processedUsersVal.textContent = processed;
              if (correctedUsersVal) correctedUsersVal.textContent = correctedCount;
              if (currentUserVal) currentUserVal.textContent = username;
              if (progressBar) {
                const percent = (processed / totalUsers) * 100;
                progressBar.style.width = `${percent}%`;
              }

              console.log(`🔄 [${processed}/${totalUsers}] Recalculando ${username}...`);
              const beforeDoc = await fetchBestUserStatsDoc(username).catch(() => null);
              const beforeTotal = Number(beforeDoc?.data?.totalPoints || 0);

              await analyzeAndGrantPointsForUser(username, { allTime: true });
              const breakdown = await computeUserBreakdown(username, { persistToCloud: false });
              await persistAdminRebuildForUser(username, breakdown);

              const afterTotal = Number(breakdown?.total || 0);
              const delta = afterTotal - beforeTotal;
              deltas.push({ username, beforeTotal, afterTotal, delta });
              
              if (Math.abs(afterTotal - beforeTotal) > 0.1) {
                correctedCount++;
                console.log(`✅ ${username}: ${beforeTotal} → ${afterTotal} puntos`);
              }
            } catch (error) {
              errorCount++;
              console.error(`❌ Error recalculando ${username}:`, error);
            }
          }

          const topChanges = deltas
            .filter(item => Math.abs(item.delta) > 0.1)
            .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
            .slice(0, 5);
            
          const isStopped = window.__RECALC_STOPPED__;
          const reportLines = [
            isStopped ? `⏹️ RECÁLCULO DETENIDO` : `✅ RECÁLCULO FINALIZADO`,
            `------------------------`,
            `Procesados: ${processed} de ${totalUsers}`,
            `Ajustados: ${correctedCount}`,
            `Errores: ${errorCount}`,
            ''
          ];
          
          if (topChanges.length) {
            reportLines.push('Mayores cambios:');
            topChanges.forEach(item => {
              const sign = item.delta > 0 ? '+' : '';
              reportLines.push(`- ${item.username}: ${item.beforeTotal} → ${item.afterTotal} (${sign}${item.delta.toFixed(1)})`);
            });
          }
          
          const reportTextValue = reportLines.join('\n');

          if (statusBadge) {
            statusBadge.textContent = isStopped ? 'DETENIDO' : 'FINALIZADO';
            statusBadge.style.background = isStopped ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)';
            statusBadge.style.color = isStopped ? '#ef4444' : '#10b981';
          }
          
          if (reportText) {
            reportText.hidden = false;
            reportText.textContent = reportTextValue;
          }

          // ACTUALIZACIÓN DE BANDA: Forzar recálculo global al terminar para que el Ticker se actualice
          if (typeof calculateAndSaveGlobalStats === 'function') {
            console.log('🔄 Sincronizando Estadísticas Globales (Banda)...');
            calculateAndSaveGlobalStats().catch(e => console.warn('Error actualizando ticker:', e));
          }

          try {
            const currentProfile = getCurrentProfileUser?.();
            if (currentProfile) await renderPointsBreakdownForUser(currentProfile, true);
          } catch (_) { }

          return { total: totalUsers, corrected: correctedCount, errors: errorCount, deltas };
        } catch (error) {
          console.error('Error en recálculo masivo completo:', error);
          if (statusBadge) {
            statusBadge.textContent = 'ERROR';
            statusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
            statusBadge.style.color = '#ef4444';
          }
          showErrorNotification('Error durante el recálculo completo de puntos.');
          throw error;
        } finally {
          window.__ADMIN_POINTS_REBUILD_RUNNING__ = false;
        }
      };

      // Función para corregir puntos de todos los usuarios
      window.corregirPuntosTodosLosUsuarios = async function () {
        return window.runFullAdminPointsRebuild();
      };

      // ===== FUNCIONES PARA SELECTOR DE USUARIO =====

      let currentSelectedUser = ''; // Se inicializará correctamente en getCurrentSelectedUser()

      async function populateUserSelector() {
        const userSelect = document.getElementById('gamification-user-select');
        if (!userSelect) return;

        try {
          const activeUsers = new Map(); // key -> OriginalName
          const now = Date.now();
          const threshold = 45 * 24 * 60 * 60 * 1000; // 45 días
          const normCurrent = String(getCurrentUser() || '').trim().toLowerCase().replace(/^@/, '');
          
          // 1. CREAR EL WHITELIST ESTRICTO DESDE USERSTATS
          const activeWhitelist = new Set();
          activeWhitelist.add(normCurrent);

          const dbRef = window.db || db;
          if (dbRef) {
            try {
              const statsSnap = await dbRef.collection('userStats').get();
              statsSnap.forEach(doc => {
                if (!doc.id) return;
                const d = doc.data() || {};
                const points = Number(d.totalPoints || 0);
                const updated = d.updatedAt ? (typeof d.updatedAt.toDate === 'function' ? d.updatedAt.toDate() : new Date(d.updatedAt)) : null;
                const isRecent = updated && (now - updated.getTime() < threshold);
                const uNorm = doc.id.toLowerCase().replace(/^@/, '');
                const isVip = typeof window.isUserVipGlobal === 'function' ? window.isUserVipGlobal(uNorm) :
                              ((window.vipSet && window.vipSet.has(uNorm)) || (window.z0VipSet && window.z0VipSet.has(uNorm)));

                // FILTRO DE ACTIVIDAD ESTRICTO:
                // 1. No debe ser un nombre inválido (bots, chino, spam)
                // 2. Debe tener puntos > 0 O ser VIP O ser reciente O ser el usuario actual
                const isInvalid = typeof window.isInvalid === 'function' ? window.isInvalid(doc.id) : false;
                
                if (!isInvalid && (points > 0 || isVip || uNorm === normCurrent)) {
                  // Si no tiene puntos y no es VIP ni el actual, solo mostrar si es MUY reciente (<30 días)
                  if (points === 0 && !isVip && uNorm !== normCurrent && !isRecent) {
                    return; 
                  }
                  activeWhitelist.add(uNorm);
                  activeUsers.set(uNorm, doc.id);
                }
              });
            } catch (e) { console.warn('Error whitelist:', e); }
          }

          // 2. EL PORTERO: Solo permite usuarios en el whitelist
          const addUserFiltered = (name) => {
            const u = String(name || '').trim();
            if (!u) return;
            const key = u.toLowerCase().replace(/^@/, '');
            if (activeWhitelist.has(key)) {
              if (!activeUsers.has(key)) activeUsers.set(key, u);
            }
          };

          // 3. PASAR TODAS LAS FUENTES POR EL PORTERO
          try {
            const items = Array.isArray(window.__dayItems) ? window.__dayItems : [];
            items.forEach(it => { if (it?.usuario) addUserFiltered(it.usuario); });
          } catch (_) { }

          try {
            const all = await getAllCombinedSolicitudes();
            (all || []).forEach(s => { if (s?.usuario) addUserFiltered(s.usuario); });
          } catch (_) { }

          try {
            const cached = JSON.parse(localStorage.getItem('knownUsers') || '[]') || [];
            cached.forEach(n => addUserFiltered(n));
          } catch (_) { }

          try {
            const solicitudes = JSON.parse(localStorage.getItem('solicitudes') || '[]');
            solicitudes.forEach(s => addUserFiltered(s.usuario));
            
            let cached = JSON.parse(localStorage.getItem('knownUsers') || '[]') || [];
            // PURGA DE EMERGENCIA: Si la lista local es enorme (>150), limpiarla para forzar sync fresco
            if (cached.length > 150) {
              localStorage.removeItem('knownUsers');
              cached = [];
            }
            cached.forEach(n => addUserFiltered(n));
            
            const byDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');
            Object.values(byDay).flat().forEach(s => addUserFiltered(s.usuario));
          } catch (_) { }

          // 4. GENERAR EL SELECTOR LIMPIO
          const usersList = Array.from(activeUsers.values()).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
          
          window.__activeUsersList = usersList; // Guardar en cache global para filtrado

          userSelect.innerHTML = '<option value="">Selecciona un usuario</option>';
          usersList.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            userSelect.appendChild(option);
          });

          if (usersList.length === 0) {
            userSelect.innerHTML = '<option value="">No hay usuarios activos</option>';
          }

          // Seleccionar actual
          const current = getCurrentSelectedUser();
          if (current && activeWhitelist.has(current.toLowerCase().replace(/^@/, ''))) {
            userSelect.value = current;
          }
          
          // Sincronizar campo de texto visible
          const filterInput = document.getElementById('user-search-filter');
          if (filterInput) {
            filterInput.value = userSelect.value || '';
          }

          populateBadgeSelectForUser(getCurrentSelectedUser());
        } catch (error) {
          console.error('Error populateUserSelector:', error);
          userSelect.innerHTML = '<option value="">Error al cargar</option>';
        }
      }

      // Función de respaldo que usa solo localStorage
      function populateUserSelectorFromLocalStorage() {
        const userSelect = document.getElementById('gamification-user-select');
        if (!userSelect) return;

        try {
          const users = new Map();
          const normCurrent = String(getCurrentUser() || '').trim().toLowerCase().replace(/^@/, '');

          const addUserIfValid = (name) => {
            const u = String(name || '').trim();
            if (!u) return;
            const key = u.toLowerCase().replace(/^@/, '');
            
            // FILTRO ESTRICTO: No bots, no chino
            const isInvalid = typeof window.isInvalid === 'function' ? window.isInvalid(u) : false;
            if (isInvalid && key !== normCurrent) return;

            if (!users.has(key)) users.set(key, u);
          };

          // Cargar de fuentes locales
          const cached = JSON.parse(localStorage.getItem('knownUsers') || '[]') || [];
          cached.forEach(n => addUserIfValid(n));
          
          const solicitudes = JSON.parse(localStorage.getItem('solicitudes') || '[]');
          solicitudes.forEach(s => addUserIfValid(s.usuario));

          const usersList = Array.from(users.values()).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
          
          window.__activeUsersList = usersList; // Guardar en cache global para filtrado

          userSelect.innerHTML = '<option value="">Selecciona un usuario</option>';
          usersList.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            userSelect.appendChild(option);
          });

          if (usersList.length === 0) {
            userSelect.innerHTML = '<option value="">No hay usuarios locales</option>';
          }

          // Sincronizar campo de texto visible
          const filterInput = document.getElementById('user-search-filter');
          if (filterInput) {
            filterInput.value = userSelect.value || '';
          }
        } catch (error) {
          console.error('Error populateUserSelectorFromLocalStorage:', error);
        }
      }
      window.populateUserSelectorFromLocalStorage = populateUserSelectorFromLocalStorage;

      // --- NUEVA FUNCIÓN: Poblar selector de compensación (Admin) ---
      async function populateAdminCompensationSelector() {
        const compSelect = document.getElementById('comp-user-select');
        if (!compSelect) return;

        try {
          compSelect.innerHTML = '<option value="">Cargando usuarios...</option>';
          const users = new Map();
          const addUser = (name) => {
            const u = String(name || '').trim();
            if (!u) return;
            const key = u.toLowerCase();
            if (!users.has(key)) users.set(key, u);
          };

          // 1. Firebase Users
          try {
            const snap = await db.collection('users').get();
            snap.forEach(d => { const n = d.data().name; if (n) addUser(n); });
          } catch (e) { }

          // 2. Solicitudes recientes
          try {
            const snap = await db.collection('solicitudes').orderBy('day', 'desc').limit(500).get();
            snap.forEach(d => { const u = d.data().usuario; if (u) addUser(u); });
          } catch (e) { }

          // 3. LocalStorage
          try {
            const local = JSON.parse(localStorage.getItem('solicitudes') || '[]');
            local.forEach(s => { if (s.usuario) addUser(s.usuario); });
          } catch (e) { }

          const sorted = Array.from(users.values()).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

          let opts = '<option value="">Seleccionar usuario...</option>';
          sorted.forEach(u => {
            opts += `<option value="${u}">${u}</option>`;
          });
          compSelect.innerHTML = opts;

        } catch (e) {
          console.error('Error poblando selector admin:', e);
          compSelect.innerHTML = '<option value="">Error al cargar</option>';
        }
      }
      // Exponer globalmente
      window.populateAdminCompensationSelector = populateAdminCompensationSelector;


      // Función auxiliar para obtener todos los datos combinados
      // IMPORTANTE: Ahora distingue si debe usar LocalStorage (solo para el usuario actual) o solo Firestore
      async function getAllCombinedSolicitudes(options = {}) {
        const allTime = !!options.allTime;
        // Esta función NO debe usarse para calcular stats históricos globales,
        // ya que solo trae solicitudes del día seleccionado en la UI.
        // Se mantiene para compatibilidad con visualización de listas diarias.

        const allSolicitudesMap = new Map();

        // Determinar contexto de usuario
        const currentUser = getCurrentUser();
        const targetUser = getCurrentSelectedUser() || currentUser;
        const normTarget = String(targetUser).toLowerCase().trim();
        const normCurrent = String(currentUser).toLowerCase().trim();
        // Solo usar LocalStorage si estamos viendo nuestro propio perfil
        // Y NO somos Admin viendo a otro (aunque Admin tenga local data de todos, no debe usarla para calcular stats ajenos)
        const useLocal = normTarget === normCurrent;

        const toKey = (s) => {
          const usuario = String(s?.usuario || '').trim();
          const cancion = String(s?.cancion || '').trim();
          const artista = String(s?.artista || '').trim();
          // Normalizar hora para evitar duplicados por diferencias de segundos/milisegundos
          // Usar solo HH:MM si es posible
          let hora = String(s?.hora || '').trim();
          if (!hora && (s?.ts || s?.time)) {
            try {
              const d = s.ts && s.ts.toDate ? s.ts.toDate() : new Date(s.ts || s.time);
              hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            } catch (_) { }
          }

          // Incluir día para unicidad absoluta
          const day = String(s?.day || '').trim();
          return `${usuario}-${cancion}-${artista}-${hora}-${day}`.replace(/[^a-zA-Z0-9-]/g, '');
        };

        const add = (s) => {
          if (!s || !s.usuario || !s.cancion || !s.artista) return;
          const key = toKey(s);
          if (!key) return;
          if (!allSolicitudesMap.has(key)) allSolicitudesMap.set(key, s);
        };

        // 1. Datos en memoria (session) - Solo si useLocal
        if (useLocal) {
          try {
            const dayItems = Array.isArray(window.__dayItems) ? window.__dayItems : [];
            dayItems.forEach(it => add(it));
          } catch (_) { }

          try {
            const localSolicitudes = JSON.parse(localStorage.getItem('solicitudes') || '[]') || [];
            localSolicitudes.forEach(s => add(s));
          } catch (_) { }
        }

        // 2. Firestore (Siempre, pero filtrado si es necesario)
        try {
          const daySel = document.getElementById('day-select')?.value || '';
          const dbRef = window.db || db;
          if (dbRef && daySel) {
            // Usar una consulta que devuelva datos del usuario objetivo si está seleccionado
            // Si no, trae todo del día (comportamiento original para lista general)
            let query = dbRef.collection('solicitudes');
            if (!allTime) {
              query = query.where('day', '==', daySel);
            } else if (targetUser) {
              // Si es global y hay usuario, optimizar trayendo solo sus solicitudes
              query = query.where('usuario', '==', targetUser);
            }

            // Si estamos viendo un usuario específico que NO somos nosotros, filtrar por él para asegurar limpieza
            if (!useLocal && targetUser) {
              // query = query.where('usuario', '==', targetUser); // Opcional: optimización
            }

            const snap = await query.orderBy('ts', 'desc').limit(1000).get();
            snap.forEach(doc => {
              const data = doc.data() || {};
              // Solo añadir si coincide con el usuario objetivo (si hay uno seleccionado)
              // O si estamos viendo la lista general
              if (targetUser && normalizeUserKey(data.usuario) !== normalizeUserKey(targetUser)) {
                // Si hay un usuario seleccionado explícitamente en el contexto de gamificación,
                // filtrar aquí también por si acaso la query trajo de más.
                // Pero getAllCombinedSolicitudes se usa para la lista general también...
                // CUIDADO: Esta función se usa para renderizar la lista principal.
                // No debemos filtrar por usuario aquí a menos que sea explícito.
              }

              add({
                usuario: data.usuario,
                cancion: data.cancion,
                artista: data.artista,
                day: data.day,
                ts: data.ts ? data.ts.toMillis() : Date.now(),
                hora: data.hora || ''
              });
            });
          }
        } catch (_) { }

        return Array.from(allSolicitudesMap.values());
      }

      async function switchToUser(username) {
        console.log(`🔄 INICIO - Cambiando a usuario: ${username || 'usuario actual'}`);
        console.log(`📝 Usuario anterior: ${currentSelectedUser}`);

        if (!username) {
          currentSelectedUser = getCurrentUser();
          username = currentSelectedUser;
          console.log(`🔄 Sin username proporcionado, usando usuario actual: ${username}`);
        } else {
          currentSelectedUser = username;
          console.log(`✅ currentSelectedUser actualizado a: ${currentSelectedUser}`);
        }

        // Verificar datos existentes
        console.log(`📊 Verificando datos para usuario: ${username}`);
        // Limpiar caches y pines para evitar valores del usuario previo
        try { window.__breakdownCache = {}; } catch (_) { }

        // Renderizar modal y refrescar paneles activos para el usuario seleccionado
        console.log(`🎨 Llamando renderGamificationModal para ${username}`);
        await renderGamificationModal();
        const u = currentSelectedUser;
        try {
          const statsPanel = document.getElementById('gamification-stats');
          if (statsPanel && statsPanel.classList.contains('active')) {
            const localData = getLocalGamificationData(u) || getGamificationDataForUser(u);
            await renderPersonalStatsForUser(localData, u);
          }
          const breakdownPanel = document.getElementById('gamification-breakdown');
          if (breakdownPanel && breakdownPanel.classList.contains('active')) {
            await renderPointsBreakdownForUser(u, true);
          }
        } catch (_) { }
        console.log(`✅ FIN - Modal actualizado para usuario: ${currentSelectedUser}`);
      }

      function getCurrentSelectedUser() {
        return currentSelectedUser || getCurrentUser();
      }

      // Variables globales para Alias
      let USER_ALIASES_MAP = {};

      function getUserAliasesCombinedMap() {
        const cloudMap = window.userAliasesMap || {};
        const localConfigMap = (typeof USER_ALIASES_MAP !== 'undefined') ? (USER_ALIASES_MAP || {}) : {};
        return { ...localConfigMap, ...cloudMap };
      }

      async function loadUserAliases() {
        if (!window.db) return;
        try {
          const doc = await window.db.collection('systemConfig').doc('userAliases').get();
          if (doc.exists) {
            USER_ALIASES_MAP = doc.data() || {};
            console.log('🔗 Alias de usuarios cargados:', Object.keys(USER_ALIASES_MAP).length);
          }
        } catch (e) {
          console.error('Error cargando alias:', e);
        }
      }

      function normalizeUserKey(username, depth = 0) {
        if (!username || depth > 5) return '';
        const raw = String(username).trim();
        // 1. Normalización base para buscar en alias (sin @, minúsculas, preservar espacios para IDs de documentos)
        const key = raw.replace(/^@/, '').toLowerCase();

        // 2. Verificar si es un alias conocido
        const map = getUserAliasesCombinedMap();
        if (map[key]) {
          const aliasTarget = map[key];
          if (aliasTarget.replace(/^@/, '').toLowerCase() === key) {
            return key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          }
          return normalizeUserKey(aliasTarget, depth + 1);
        }

        // 3. Normalización estándar (preservar espacios para compatibilidad con Firestore)
        return raw.replace(/^@/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      }
      window.normalizeUserKey = normalizeUserKey;

      function normalizeUserKeyLoose(username) {
        return String(username || '').replace(/^@/, '').toLowerCase();
      }

      function getUserStatsDocKeys(username) {
        if (!username) return [];
        const fused = typeof getFusedIds === 'function' ? getFusedIds(username) : [username];
        const keys = new Set();
        fused.forEach(id => {
          const a = normalizeUserKey(id);
          const b = normalizeUserKeyLoose(id);
          if (a) keys.add(a);
          if (b) keys.add(b);
        });
        return Array.from(keys);
      }

      function getMillisFromTs(ts) {
        try {
          if (!ts) return 0;
          if (typeof ts.toMillis === 'function') return ts.toMillis();
          if (typeof ts.toDate === 'function') return ts.toDate().getTime();
          const d = new Date(ts);
          const t = d.getTime();
          return Number.isFinite(t) ? t : 0;
        } catch (_) { return 0; }
      }

      async function fetchIndividualUserStatsDoc(fid) {
        try {
          const dbRef = window.db || db;
          if (!dbRef) return null;
          const keys = [];
          const a = normalizeUserKey(fid);
          const b = normalizeUserKeyLoose(fid);
          if (a) keys.push(a);
          if (b && b !== a) keys.push(b);
          
          const docs = await Promise.all(keys.map(async (k) => {
            try {
              const ref = dbRef.collection('userStats').doc(k);
              const snap = await ref.get();
              return { key: k, snap, data: snap.exists ? (snap.data() || {}) : null };
            } catch (_) {
              return null;
            }
          }));
          const existing = docs.filter(d => d && d.data);
          if (!existing.length) return null;
          
          existing.sort((x, y) => {
            const tx = Math.max(getMillisFromTs(x.data.updatedAt), getMillisFromTs(x.data.lastUpdated));
            const ty = Math.max(getMillisFromTs(y.data.updatedAt), getMillisFromTs(y.data.lastUpdated));
            if (Math.abs(tx - ty) > 5000) return ty - tx;
            return Number(y.data.totalPoints || 0) - Number(x.data.totalPoints || 0);
          });
          return existing[0];
        } catch (_) {
          return null;
        }
      }

      async function fetchBestUserStatsDoc(username) {
        try {
          const dbRef = window.db || db;
          if (!dbRef) return null;
          const keys = getUserStatsDocKeys(username);
          if (!keys.length) return null;
          const docs = await Promise.all(keys.map(async (k) => {
            try {
              const ref = dbRef.collection('userStats').doc(k);
              const snap = await ref.get();
              return { key: k, snap, data: snap.exists ? (snap.data() || {}) : null };
            } catch (_) {
              return { key: k, snap: null, data: null };
            }
          }));
          const existing = docs.filter(d => d && d.data);
          if (!existing.length) return null;

          // Agrupar por cuenta real (normalizada) para evitar sumar duplicados del mismo ID
          const byAccount = {};
          existing.forEach(d => {
            const accId = normalizeUserKeyLoose(d.key || '');
            if (!byAccount[accId]) byAccount[accId] = [];
            byAccount[accId].push(d);
          });

          let totalPoints = 0;
          let bestDoc = null;

          Object.keys(byAccount).forEach(accId => {
            const accountDocs = byAccount[accId];
            accountDocs.sort((x, y) => {
              const tx = Math.max(getMillisFromTs(x.data.updatedAt), getMillisFromTs(x.data.lastUpdated));
              const ty = Math.max(getMillisFromTs(y.data.updatedAt), getMillisFromTs(y.data.lastUpdated));
              if (Math.abs(tx - ty) > 5000) return ty - tx;
              return Number(y.data.totalPoints || 0) - Number(x.data.totalPoints || 0);
            });

            const bestForThisAccount = accountDocs[0];
            // FIX: Usar Math.max para evitar duplicar puntos ya consolidados de cuentas vinculadas
            totalPoints = Math.max(totalPoints, Number(bestForThisAccount.data.totalPoints || 0));

            if (!bestDoc || Number(bestForThisAccount.data.totalPoints || 0) > Number(bestDoc.data.totalPoints || 0)) {
              bestDoc = bestForThisAccount;
            }
          });

          if (bestDoc) {
            return {
              ...bestDoc,
              data: {
                ...bestDoc.data,
                totalPoints: totalPoints
              }
            };
          }
          return null;
        } catch (_) {
          return null;
        }
      }

      function subscribeUserStatsPointsForUser(username) {
        try {
          if (Array.isArray(window._userStatsPointsUnsubs)) {
            window._userStatsPointsUnsubs.forEach(fn => { try { fn && fn(); } catch (_) { } });
          }
          window._userStatsPointsUnsubs = [];
        } catch (_) { }
        try {
          const dbRef = window.db || db;
          if (!dbRef || !username) return;
          const keys = getUserStatsDocKeys(username);
          const latest = {};

          const applyBest = () => {
            try {
              const u = getCurrentSelectedUser();
              const currentNorm = normalizeUserKey(u);
              const lookingFor = normalizeUserKey(username);

              if (currentNorm !== lookingFor) return;

              const docs = Object.values(latest).filter(Boolean);
              if (!docs.length) return;

              // 1. Agrupar documentos por "Cuenta Real" (ID normalizado)
              // Esto evita sumar dos documentos que representen a la misma persona (ej: 'user' y '@user')
              const byAccount = {};
              docs.forEach(d => {
                const accId = normalizeUserKeyLoose(d._docId || '');
                if (!byAccount[accId]) byAccount[accId] = [];
                byAccount[accId].push(d);
              });

              let cloudTotalSum = 0;

              // 2. Para cada cuenta vinculada, elegir su "Mejor" documento (el más reciente o con más puntos)
              Object.keys(byAccount).forEach(accId => {
                const accountDocs = byAccount[accId];
                accountDocs.sort((x, y) => {
                  const tx = Math.max(getMillisFromTs(x.updatedAt), getMillisFromTs(x.lastUpdated));
                  const ty = Math.max(getMillisFromTs(y.updatedAt), getMillisFromTs(y.lastUpdated));
                  if (Math.abs(tx - ty) > 5000) return ty - tx;
                  return Number(y.totalPoints || 0) - Number(x.totalPoints || 0);
                });
                // FIX: Usar Math.max en lugar de suma (+) para evitar duplicar/inflar puntos consolidados de cuentas vinculadas
                cloudTotalSum = Math.max(cloudTotalSum, Number(accountDocs[0].totalPoints || 0));
              });

              // 3. Actualizar memoria y UI con el total consolidado
              const local = getGamificationDataForUser(u) || {};
              local.points = cloudTotalSum;
              local._cloudSyncedPoints = cloudTotalSum;

              saveGamificationDataForUser(local, u);

              const ptsEl = document.getElementById('user-points');
              if (ptsEl) ptsEl.textContent = String(cloudTotalSum);

              const rewardsPtsEl = document.getElementById('rewards-user-points');
              if (rewardsPtsEl) rewardsPtsEl.textContent = String(cloudTotalSum);

              if (window.renderPointsBreakdownForUser) {
                local.cloudTotal = cloudTotalSum;
                renderPointsBreakdownForUser(u, true);
              }

            } catch (e) { console.error('Error en applyBest (suma):', e); }
          };

          keys.forEach((k) => {
            const unsub = dbRef.collection('userStats').doc(k).onSnapshot((doc) => {
              try {
                if (!doc || !doc.exists) return;
                const d = doc.data() || {};
                // Inyectar ID para referencia
                d._docId = doc.id;
                latest[k] = d;
                applyBest();
              } catch (_) { }
            }, () => { });
            window._userStatsPointsUnsubs.push(unsub);
          });
        } catch (_) { }
      }

      // Función de prueba para verificar y otorgar todos los logros de insignias
      window.testBadgeAchievements = function (username) {
        console.log(`🧪 PRUEBA MANUAL: Verificando logros de insignias para ${username}`);

        try {
          // Obtener datos del usuario
          let userData = getGamificationDataForUser(username);
          console.log(`📊 Datos actuales:`, userData);

          if (!userData.achievements) userData.achievements = [];

          // Verificar todas las insignias desde la gestión de insignias (Firebase)
          const isVipFromSet = (typeof vipSet !== 'undefined' && vipSet.has(username));
          const isZ0VipFromSet = (typeof z0VipSet !== 'undefined' && z0VipSet.has(username));
          const isDonadorFromSet = (typeof donadorSet !== 'undefined' && donadorSet.has(username));

          console.log(`🔍 Estado de insignias desde gestión:`);
          console.log(`  - VIP (vipSet de Firebase): ${isVipFromSet}`);
          console.log(`  - Z0-VIP (z0VipSet de Firebase): ${isZ0VipFromSet}`);
          console.log(`  - Donador (donadorSet de Firebase): ${isDonadorFromSet}`);
          console.log(`  - vipSet disponible: ${typeof vipSet !== 'undefined'}`);
          console.log(`  - z0VipSet disponible: ${typeof z0VipSet !== 'undefined'}`);
          console.log(`  - donadorSet disponible: ${typeof donadorSet !== 'undefined'}`);

          const isVip = isVipFromSet;
          const isZ0Vip = isZ0VipFromSet;
          const isDonador = isDonadorFromSet;

          let pointsAwarded = 0;
          let achievementsGranted = [];

          // Verificar y otorgar logro VIP
          if (isVip && !userData.achievements.includes('vip_member')) {
            console.log(`🎉 OTORGANDO logro VIP...`);
            userData.achievements.push('vip_member');
            pointsAwarded += 200;
            achievementsGranted.push('Miembro VIP (+200 pts)');
          }

          // Verificar y otorgar logro Z0-VIP
          if (isZ0Vip && !userData.achievements.includes('z0_vip_member')) {
            console.log(`🎉 OTORGANDO logro Z0-VIP...`);
            userData.achievements.push('z0_vip_member');
            pointsAwarded += 300;
            achievementsGranted.push('Z0-VIP Exclusivo (+300 pts)');
          }

          // Verificar y otorgar logro Donador
          if (isDonador && !userData.achievements.includes('donador_member')) {
            console.log(`🎉 OTORGANDO logro Donador...`);
            userData.achievements.push('donador_member');
            pointsAwarded += 250;
            achievementsGranted.push('Donador Generoso (+250 pts)');
          }

          // Aplicar cambios si hay logros nuevos
          if (pointsAwarded > 0) {
            userData.points = (userData.points || 0) + pointsAwarded;
            userData.xp = (userData.xp || 0) + pointsAwarded;
            userData.level = calculateLevel(userData.xp);

            saveGamificationDataForUser(userData, username);

            console.log(`✅ ÉXITO: Logros otorgados a ${username}:`, achievementsGranted);
            console.log(`💰 Puntos totales: ${userData.points} (+${pointsAwarded})`);
            console.log(`⭐ Nivel: ${userData.level}`);

            return true;
          } else {
            console.log(`ℹ️ INFO: ${username} ya tiene todos los logros de insignias disponibles`);
            console.log(`🏆 Logros actuales:`, userData.achievements);
            return false;
          }

        } catch (error) {
          console.error('❌ ERROR en prueba:', error);
          return false;
        }
      };

      // Función simple para otorgar logros de insignias
      window.grantBadgeAchievement = function (username) {
        if (!username) {
          console.warn('⚠️ No se proporcionó nombre de usuario');
          return false;
        }

        console.log(`🎯 Otorgando logros de insignias para: ${username}`);

        try {
          // Verificar que los sets estén definidos y cargados
          if (typeof window.vipSet === 'undefined' || typeof window.z0VipSet === 'undefined' || typeof window.donadorSet === 'undefined') {
            console.warn(`⚠️ Sets no definidos para ${username}, inicializando...`);
            // Inicializar sets si no existen
            if (typeof window.vipSet === 'undefined') window.vipSet = new Set();
            if (typeof window.z0VipSet === 'undefined') window.z0VipSet = new Set();
            if (typeof window.donadorSet === 'undefined') window.donadorSet = new Set();
            return false;
          }

          if (!window.vipSet || !window.z0VipSet || !window.donadorSet) {
            console.warn(`⚠️ Sets no inicializados para ${username}`);
            return false;
          }

          const totalUsers = window.vipSet.size + window.z0VipSet.size + window.donadorSet.size;
          // Verificar que los sets estén disponibles
          console.log(`📊 Estado de sets: vipSet=${typeof window.vipSet !== 'undefined'}, z0VipSet=${typeof window.z0VipSet !== 'undefined'}, donadorSet=${typeof window.donadorSet !== 'undefined'}`);

          // Obtener datos del usuario
          let userData = getGamificationDataForUser(username);
          console.log(`📊 Datos actuales de ${username}:`, userData);

          if (!userData.achievements) userData.achievements = [];

          let pointsAdded = 0;
          let newAchievements = [];

          // Verificar VIP
          if (typeof window.vipSet !== 'undefined' && window.vipSet.has(username)) {
            console.log(`🔍 ${username} está en vipSet`);
            if (!userData.achievements.includes('vip_member')) {
              userData.achievements.push('vip_member');
              pointsAdded += 200;
              newAchievements.push('VIP (+200)');
              console.log(`✅ Logro VIP otorgado a ${username}`);
            } else {
              console.log(`ℹ️ ${username} ya tiene el logro VIP`);
            }
          } else {
            console.log(`ℹ️ ${username} no está en vipSet`);
          }

          // Verificar Z0-VIP
          if (typeof window.z0VipSet !== 'undefined' && window.z0VipSet.has(username)) {
            console.log(`🔍 ${username} está en z0VipSet`);
            if (!userData.achievements.includes('z0_vip_member')) {
              userData.achievements.push('z0_vip_member');
              pointsAdded += 300;
              newAchievements.push('Z0-VIP (+300)');
              console.log(`✅ Logro Z0-VIP otorgado a ${username}`);
            } else {
              console.log(`ℹ️ ${username} ya tiene el logro Z0-VIP`);
            }
          } else {
            console.log(`ℹ️ ${username} no está en z0VipSet`);
          }

          // Verificar Donador
          if (typeof window.donadorSet !== 'undefined' && window.donadorSet.has(username)) {
            console.log(`🔍 ${username} está en donadorSet`);
            if (!userData.achievements.includes('donador_member')) {
              userData.achievements.push('donador_member');
              pointsAdded += 250;
              newAchievements.push('Donador (+250)');
              console.log(`✅ Logro Donador otorgado a ${username}`);
            } else {
              console.log(`ℹ️ ${username} ya tiene el logro Donador`);
            }
          } else {
            console.log(`ℹ️ ${username} no está en donadorSet`);
          }

          // Aplicar puntos si hay logros nuevos
          if (pointsAdded > 0) {
            userData.points = (userData.points || 0) + pointsAdded;
            userData.xp = (userData.xp || 0) + pointsAdded;
            userData.level = calculateLevel(userData.xp);

            console.log(`💾 Guardando datos actualizados para ${username}:`, userData);
            saveGamificationDataForUser(userData, username);

            console.log(`🎉 ${username}: ${newAchievements.join(', ')} - Total: ${userData.points} pts`);
            return true;
          } else {
            console.log(`ℹ️ ${username} ya tiene todos los logros de insignias`);
            return false;
          }

        } catch (error) {
          console.error(`❌ Error otorgando logros a ${username}:`, error);
          console.error('Stack trace:', error.stack);
          return false;
        }
      };

      // Función para procesar todos los usuarios con insignias
      window.processAllBadges = function () {
        console.log(`🚀 Procesando TODOS los usuarios con insignias...`);

        let total = 0;
        let success = 0;

        // Procesar VIP
        if (typeof vipSet !== 'undefined') {
          vipSet.forEach(username => {
            total++;
            if (window.grantBadgeAchievement(username)) success++;
          });
        }

        // Procesar Z0-VIP
        if (typeof z0VipSet !== 'undefined') {
          z0VipSet.forEach(username => {
            total++;
            if (window.grantBadgeAchievement(username)) success++;
          });
        }

        // Procesar Donadores
        if (typeof donadorSet !== 'undefined') {
          donadorSet.forEach(username => {
            total++;
            if (window.grantBadgeAchievement(username)) success++;
          });
        }

        console.log(`🏁 COMPLETADO: ${success}/${total} usuarios recibieron nuevos logros`);
        return { total, success };
      };

      // Función de diagnóstico para verificar el estado del sistema
      window.diagnosticBadges = async function () {
        console.log('🔍 === DIAGNÓSTICO DEL SISTEMA DE LOGROS ===');

        // 1. Verificar sets
        console.log('📊 Estado de los sets:');
        console.log(`- VIP Set: ${vipSet ? vipSet.size : 'NO DEFINIDO'} usuarios`);
        console.log(`- Z0-VIP Set: ${z0VipSet ? z0VipSet.size : 'NO DEFINIDO'} usuarios`);
        console.log(`- Donador Set: ${donadorSet ? donadorSet.size : 'NO DEFINIDO'} usuarios`);

        if (vipSet && vipSet.size > 0) {
          console.log('👥 Usuarios VIP:', Array.from(vipSet));
        }
        if (z0VipSet && z0VipSet.size > 0) {
          console.log('👥 Usuarios Z0-VIP:', Array.from(z0VipSet));
        }
        if (donadorSet && donadorSet.size > 0) {
          console.log('👥 Usuarios Donador:', Array.from(donadorSet));
        }

        // 2. Verificar Firebase
        console.log('🔥 Verificando conexión a Firebase...');
        try {
          const testDoc = await db.collection('vipUsers').limit(1).get();
          console.log('✅ Conexión a Firebase OK');
        } catch (error) {
          console.error('❌ Error de conexión a Firebase:', error);
          return;
        }

        // 3. Probar con un usuario específico
        if (vipSet && vipSet.size > 0) {
          const testUser = Array.from(vipSet)[0];
          console.log(`🧪 Probando con usuario: ${testUser}`);

          try {
            // Verificar datos existentes
            const userData = getGamificationDataForUser(testUser);
            console.log(`📊 Datos actuales de ${testUser}:`, userData);

            // Intentar otorgar logro
            console.log(`🎯 Intentando otorgar logro a ${testUser}...`);
            const result = window.grantBadgeAchievement(testUser);
            console.log(`🎯 Resultado: ${result ? 'Éxito' : 'Sin cambios'}`);

          } catch (error) {
            console.error(`❌ Error probando con ${testUser}:`, error);
          }
        }

        console.log('🔍 === FIN DEL DIAGNÓSTICO ===');
      };

      // Función para otorgar puntos manualmente (sin depender de sets)
      window.grantPointsManual = async function (username, isVip = false, isZ0Vip = false, isDonador = false) {
        console.log(`🎯 Otorgando puntos manualmente a: ${username}`);
        console.log(`Estado: VIP=${isVip}, Z0-VIP=${isZ0Vip}, Donador=${isDonador}`);

        try {
          // Obtener datos actuales
          const userStatsRef = db.collection('userStats').doc(username);
          const userStatsDoc = await userStatsRef.get();

          let userData = userStatsDoc.exists ? userStatsDoc.data() : {
            points: 0,
            level: 1,
            achievements: [],
            lastUpdated: new Date()
          };

          console.log('Datos actuales:', userData);

          let pointsAwarded = 0;
          let achievementsGranted = [];

          // Otorgar logros según parámetros
          if (isVip && !userData.achievements.includes('vip_badge')) {
            userData.achievements.push('vip_badge');
            userData.points += 200;
            pointsAwarded += 200;
            achievementsGranted.push('VIP');
          }

          if (isZ0Vip && !userData.achievements.includes('z0vip_badge')) {
            userData.achievements.push('z0vip_badge');
            userData.points += 300;
            pointsAwarded += 300;
            achievementsGranted.push('Z0-VIP');
          }

          if (isDonador && !userData.achievements.includes('donador_badge')) {
            userData.achievements.push('donador_badge');
            userData.points += 150;
            pointsAwarded += 150;
            achievementsGranted.push('Donador');
          }

          if (pointsAwarded > 0) {
            userData.lastUpdated = new Date();
            console.log('Guardando datos:', userData);

            await userStatsRef.set(userData, { merge: true });
            console.log(`🎉 ${username}: ${achievementsGranted.join(', ')} (+${pointsAwarded}) - Total: ${userData.points} pts`);

            // Verificar que se guardó
            const verification = await userStatsRef.get();
            if (verification.exists) {
              console.log('✅ Verificación exitosa:', verification.data());
            } else {
              console.error('❌ Error: datos no se guardaron');
            }

          } else {
            console.log('ℹ️ No hay logros nuevos para otorgar');
          }

        } catch (error) {
          console.error('❌ Error:', error);
        }
      };

      // Función para forzar la carga de sets y procesar logros
      window.forceLoadAndProcess = function () {
        console.log('🚀 Forzando carga de sets y procesamiento de logros...');

        // Verificar estado actual
        console.log(`📊 Estado actual: VIP(${vipSet ? vipSet.size : 'undefined'}), Z0-VIP(${z0VipSet ? z0VipSet.size : 'undefined'}), Donador(${donadorSet ? donadorSet.size : 'undefined'})`);

        // Esperar un poco más y luego procesar
        setTimeout(() => {
          console.log('⏰ Esperando 5 segundos para asegurar carga completa...');
          setTimeout(() => {
            console.log(`📊 Estado después de espera: VIP(${vipSet ? vipSet.size : 'undefined'}), Z0-VIP(${z0VipSet ? z0VipSet.size : 'undefined'}), Donador(${donadorSet ? donadorSet.size : 'undefined'})`);

            if (vipSet && z0VipSet && donadorSet) {
              const totalUsers = vipSet.size + z0VipSet.size + donadorSet.size;
              if (totalUsers > 0) {
                console.log('✅ Sets cargados, procesando logros...');
                window.processAllBadges();
              } else {
                console.warn('⚠️ Sets definidos pero vacíos. Puede que no haya usuarios VIP/Z0-VIP/Donador o los datos no se han cargado.');
              }
            } else {
              console.error('❌ Sets aún no definidos después de la espera');
            }
          }, 5000);
        }, 1000);
      };

      // Funciones de compatibilidad
      window.testVipAchievement = window.grantBadgeAchievement;
      window.testBadgeAchievements = window.grantBadgeAchievement;
      window.processAllVipAchievements = window.processAllBadges;

      // Función simplificada para procesar solo logros
      async function processAchievementsForUser(username, existingData) {
        try {
          console.log(`🏆 Procesando logros para ${username}...`);

          // Verificar que los sets estén inicializados y cargados
          if (typeof vipSet === 'undefined' || typeof z0VipSet === 'undefined' || typeof donadorSet === 'undefined' ||
            !vipSet || !z0VipSet || !donadorSet) {
            console.log(`⏳ Sets de insignias aún no inicializados para ${username}, reintentando en 2 segundos...`);
            setTimeout(() => processAchievementsForUser(username, existingData), 2000);
            return existingData;
          }

          // Si los sets de insignias están vacíos, procedemos con cautela (Firebase cargará de forma asíncrona)
          console.log(`✅ Sets cargados: VIP(${vipSet.size}), Z0-VIP(${z0VipSet.size}), Donador(${donadorSet.size})`);

          // Usar datos existentes como base
          const data = { ...existingData };

          if (!data.achievements) data.achievements = [];

          // Verificar insignias del usuario desde la gestión de insignias (Firebase)
          const isVipFromSet = vipSet.has(username);
          const isZ0VipFromSet = z0VipSet.has(username);
          const isDonadorFromSet = donadorSet.has(username);

          console.log(`🔍 Verificando insignias desde gestión para ${username}:`);
          console.log(`   - VIP (vipSet de Firebase): ${isVipFromSet}`);
          console.log(`   - Z0-VIP (z0VipSet de Firebase): ${isZ0VipFromSet}`);
          console.log(`   - Donador (donadorSet de Firebase): ${isDonadorFromSet}`);
          console.log(`   - vipSet size: ${vipSet.size}, z0VipSet size: ${z0VipSet.size}, donadorSet size: ${donadorSet.size}`);

          const isVip = isVipFromSet;
          const isZ0Vip = isZ0VipFromSet;
          const isDonador = isDonadorFromSet;

          let pointsAwarded = 0;
          let achievementsGranted = [];

          // Procesar logro VIP
          if (isVip && !data.achievements.includes('vip_member')) {
            console.log(`🎉 Otorgando logro VIP a ${username}`);
            data.achievements.push('vip_member');
            pointsAwarded += 200;
            achievementsGranted.push('Miembro VIP (+200 pts)');
          }

          // Procesar logro Z0-VIP
          if (isZ0Vip && !data.achievements.includes('z0_vip_member')) {
            console.log(`🎉 Otorgando logro Z0-VIP a ${username}`);
            data.achievements.push('z0_vip_member');
            pointsAwarded += 300;
            achievementsGranted.push('Z0-VIP Exclusivo (+300 pts)');
          }

          // Procesar logro Donador
          if (isDonador && !data.achievements.includes('donador_member')) {
            console.log(`🎉 Otorgando logro Donador a ${username}`);
            data.achievements.push('donador_member');
            pointsAwarded += 250;
            achievementsGranted.push('Donador Generoso (+250 pts)');
          }

          // Aplicar puntos y XP si se otorgaron logros
          if (pointsAwarded > 0) {
            data.points += pointsAwarded;
            data.xp += pointsAwarded;
            data.level = calculateLevel(data.xp);

            // Guardar datos actualizados
            saveGamificationDataForUser(data, username);

            console.log(`✅ Logros otorgados a ${username}:`, achievementsGranted);
            console.log(`💰 Puntos totales: ${data.points} (+${pointsAwarded})`);
            console.log(`⭐ Nivel: ${data.level}`);
          } else {
            console.log(`ℹ️ ${username} ya tiene todos los logros de insignias disponibles`);
          }

          // Actualizar stats con estados de insignias y conteos reales
          if (!data.stats) data.stats = {};
          data.stats.isVip = isVip;
          data.stats.isZ0Vip = isZ0Vip;
          data.stats.isDonador = isDonador;

          // --- NUEVO: Evaluar todos los logros del catálogo de forma dinámica ---
          // Copiar stats para evitar efectos secundarios y unificar campos de conteo (Hallazgo 5)
          const s = { ...data.stats };
          
          const songCountVal = Math.max(s.totalPlayedSongs || 0, s.songCount || 0, s.requestedCount || 0, s.totalSongs || 0);
          s.totalPlayedSongs = songCountVal;
          s.songCount = songCountVal;
          s.totalSongs = songCountVal;
          s.requestedCount = songCountVal;

          const artistCountVal = Math.max(s.uniqueArtists || 0, s.uniqueArtistsPlayed || 0);
          s.uniqueArtists = artistCountVal;
          s.uniqueArtistsPlayed = artistCountVal;

          const topArtistVal = Math.max(s.topArtistCount || 0, s.topArtistCountPlayed || 0);
          s.topArtistCount = topArtistVal;
          s.topArtistCountPlayed = topArtistVal;

          const zeroFMVal = Math.max(s.zeroFMSongs || 0, s.zeroFMSongsPlayed || 0);
          s.zeroFMSongs = zeroFMVal;
          s.zeroFMSongsPlayed = zeroFMVal;

          // Guardar de vuelta para mantener coherencia en toda la estructura de datos
          data.stats = { ...data.stats, ...s };

          if (Array.isArray(ACHIEVEMENTS)) {
            ACHIEVEMENTS.forEach(achievement => {
              // Ignorar logros que ya tiene el usuario o los VIP especiales que ya se procesaron arriba
              if (data.achievements.includes(achievement.id)) return;
              if (achievement.id === 'vip_member' || achievement.id === 'z0_vip_member' || achievement.id === 'donador_member') return;

              try {
                if (typeof achievement.condition === 'function' && achievement.condition(s)) {
                  console.log(`🎉 LOGRO DESBLOQUEADO dinámicamente para ${username}: ${achievement.title}`);
                  data.achievements.push(achievement.id);
                  data.points += achievement.points;
                  data.xp += achievement.points;
                  data.lastUnlockedAchievementAt = Date.now();
                  achievementsGranted.push(`${achievement.title} (+${achievement.points} pts)`);
                }
              } catch (err) {
                console.warn(`⚠️ Error evaluando condición para logro ${achievement.id}:`, err);
              }
            });
          }

          if (achievementsGranted.length > 0) {
            data.level = calculateLevel(data.xp);
            saveGamificationDataForUser(data, username);
            console.log(`✅ Logros otorgados dinámicamente a ${username}:`, achievementsGranted);
          }

          return data;
        } catch (error) {
          console.error(`❌ Error procesando logros para ${username}:`, error);
          return existingData;
        }
      }

      // --- CACHE DE MEMORIA PARA GAMIFICACIÓN ---
      // Esto permite que el Admin vea datos de otros usuarios sin guardarlos en su LocalStorage
      window.__memoryGamificationData = {};

      function getDefaultGamificationData() {
        return {
          points: 0,
          level: 1,
          xp: 0,
          achievements: [],
          streaks: { current: 0, best: 0, lastActivity: null, calendar: {} },
          stats: { totalSongs: 0, uniqueArtists: 0, activeDays: 0, isVip: false }
        };
      }

      // Modificar funciones existentes para usar el usuario seleccionado
      function getGamificationDataForUser(usuario = null) {
        const targetUser = usuario || getCurrentSelectedUser();
        // Usar la misma lógica de normalización robusta
        const rawUser = String(targetUser || '').trim().replace(/^@/, '').toLowerCase();

        // --- FIX ABSOLUTO: Si NO soy el usuario dueño de los datos O soy Admin, JAMÁS leer de localStorage ---
        const currentUser = getCurrentUser();
        const normCurrent = String(currentUser || '').trim().replace(/^@/, '').toLowerCase();

        // MODO ADMIN: Si es admin, preferimos datos de nube (forzamos comportamiento de "no dueño")
        const isAdminMode = localStorage.getItem('isAdminMode') === 'true' || localStorage.getItem('isAdminAuthenticated') === 'true';
        // Normalización simple para comparación rápida, la robusta se usa para claves
        const isOwner = !isAdminMode && (rawUser === normCurrent);

        if (!isOwner) {
          // Si no soy el dueño, buscar solo en memoria (cache de sesión)
          // Si no está en memoria, devolver default (se llenará cuando syncGamificationDataWithCloud termine)
          // Esto garantiza que NUNCA se devuelva "basura" persistida en localStorage de sesiones anteriores.
          const normUser = rawUser.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return window.__memoryGamificationData[normUser] || getDefaultGamificationData();
        }

        const data = localStorage.getItem('gamificationData');
        const allData = data ? JSON.parse(data) : {};

        // Intentar varias claves para encontrar los datos locales
        let userData = allData[rawUser];

        if (!userData) {
          const normUser = rawUser.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          userData = allData[normUser];
        }

        return userData || getDefaultGamificationData();
      }

      // NUEVA FUNCIÓN: Sincronizar datos con la nube
      async function syncGamificationDataWithCloud(username) {
        try {
          console.log(`☁️ Sincronizando gamificación para ${username}...`);
          const normUser = normalizeUserKey(username);
          const docRef = db.collection('userStats').doc(normUser);
          const best = await fetchBestUserStatsDoc(username);

          const localData = getGamificationDataForUser(username);

          if (!best || !best.data) {
            console.log('☁️ No hay datos en nube. Subiendo locales...');
            // Subir datos locales si existen y tienen algo de valor
            if (localData.points > 0 || localData.achievements.length > 0) {
              const seedPayload = {
                gamification: localData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              };
              if (localData.autoProcessed === true || localData.lastAuthoritativeSource === 'breakdown') {
                seedPayload.totalPoints = localData.points;
              }
              await docRef.set(seedPayload, { merge: true });
            }
            return localData;
          }

          const cloudDataFull = best.data || {};
          const cloudPoints = Number(cloudDataFull.totalPoints || 0);
          const cloudGamification = cloudDataFull.gamification || null;
          const cloudProfilePic = cloudDataFull.profilePic || (cloudGamification && cloudGamification.profilePic);

          console.log(`☁️ Puntos nube: ${cloudPoints}, Puntos locales: ${localData.points}`);

          // Estrategia de fusión MEJORADA (Anti-Flicker):
          // Priorizar el valor MÁS ALTO entre local y nube para evitar regresiones visuales.
          // La nube puede tener retraso, el local puede tener puntos recientes no subidos.

          // FIX CRÍTICO: Si NO soy el usuario dueño de los datos, JAMÁS confiar en mis datos locales
          // Esto evita que un Admin con datos locales residuales (inflados) sobrescriba los datos reales de un usuario.
          const currentUser = getCurrentUser();
          const normCurrent = String(currentUser || '').trim().replace(/^@/, '').toLowerCase();
          const normTarget = String(username || '').trim().replace(/^@/, '').toLowerCase();

          // MODO ADMIN: Si es admin, ignoramos local y preferimos nube al 100%
          const isAdminMode = localStorage.getItem('isAdminMode') === 'true' || localStorage.getItem('isAdminAuthenticated') === 'true';
          const isOwner = !isAdminMode && (normCurrent === normTarget);

          let mergedData = { ...localData };
          // La nube es la fuente canónica para `totalPoints`.
          // Solo permitimos mostrar temporalmente un valor local si proviene de un
          // recálculo autorizado y MUY reciente, para no romper la UX del dueño
          // justo después de recalcular canciones/rachas.
          let hasRecentAuthoritativeLocal = false;
          try {
            const calcAt = localData.lastAuthoritativeCalculatedAt ? new Date(localData.lastAuthoritativeCalculatedAt).getTime() : 0;
            const ageMs = calcAt ? (Date.now() - calcAt) : Number.POSITIVE_INFINITY;
            hasRecentAuthoritativeLocal =
              isOwner &&
              localData.lastAuthoritativeSource === 'breakdown' &&
              Number.isFinite(ageMs) &&
              ageMs >= 0 &&
              ageMs <= 120000 &&
              Number(localData.points || 0) > cloudPoints;
          } catch (_) { }
          const authoritativePoints = hasRecentAuthoritativeLocal
            ? Number(localData.points || 0)
            : Number(cloudPoints || 0);

          if (cloudProfilePic) {
            mergedData.profilePic = cloudProfilePic;
          }

          if (cloudGamification) {
            // Fusionar logros (Unión)
            const localAch = new Set(localData.achievements || []);
            const cloudAch = new Set(cloudGamification.achievements || []);
            const mergedAch = [...new Set([...localAch, ...cloudAch])];

            mergedData.achievements = mergedAch;
            mergedData.points = authoritativePoints;
            mergedData._cloudSyncedPoints = cloudPoints; // Mantener referencia real de la nube

            // Rachas: Tomar la mejor racha histórica registrada
            mergedData.streaks = {
              ...localData.streaks,
              ...cloudGamification.streaks,
              // Si no soy dueño, la mejor racha es la de la nube.
              best: isOwner ? Math.max(localData.streaks?.best || 0, cloudGamification.streaks?.best || 0) : (cloudGamification.streaks?.best || 0)
            };

            // Si la nube tiene más puntos, confiar en su nivel/xp también
            if ((cloudGamification.points || 0) > (localData.points || 0) || !isOwner) {
              mergedData.level = Number(cloudDataFull.level || cloudGamification.level || 1);
              mergedData.xp = Number(cloudDataFull.xp || cloudDataFull.totalPoints || cloudGamification.xp || 0);
              mergedData.stats = cloudGamification.stats || mergedData.stats;
            }
          } else {
            // Nube solo tiene totalPoints
            mergedData.points = authoritativePoints;
            mergedData._cloudSyncedPoints = cloudPoints;
            // Si no hay gamification en nube y no soy dueño, usar stats básicos de nube si existen, o resetear
            if (!isOwner) {
              mergedData.points = cloudPoints;
              mergedData.level = Number(cloudDataFull.level || 1);
              mergedData.xp = Number(cloudDataFull.xp || cloudPoints || 0);
              mergedData.streaks = { current: 0, best: 0, calendar: {} };
            }
          }

          // Guardar fusión en local inmediatamente (para caché de visualización)
          saveGamificationDataForUser(mergedData, username);

          // Si el local era mayor que la nube, forzar subida para sincronizar
          // FIX: Solo permitir subida forzada si soy el DUEÑO de los datos
          if ((best && best.key && best.key !== normUser) || JSON.stringify(mergedData) !== JSON.stringify(cloudGamification)) {
            // Actualización estándar si hay discrepancias estructurales
            // Ya no forzamos `totalPoints` aquí para evitar que una caché local o
            // una fusión parcial sobrescriban el valor canónico calculado por el
            // flujo principal o por el bot.
            if (isOwner) {
              console.log('☁️ Actualizando nube con datos fusionados...');
              await docRef.set({
                gamification: mergedData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
            }
          }

          return mergedData;

        } catch (e) {
          console.error('Error sincronizando con nube:', e);
          return getGamificationDataForUser(username); // Fallback local
        }
      }

      function saveGamificationDataForUser(data, usuario = null) {
        const targetUser = usuario || getCurrentSelectedUser();

        // Validación de usuario
        if (!targetUser || targetUser === 'null' || targetUser === 'undefined' || targetUser.toLowerCase() === 'text/plain' || targetUser.toLowerCase() === 'plain') {
          console.warn(`⚠️ Intento de guardar datos para usuario inválido: ${targetUser}`);
          return;
        }

        const rawUser = String(targetUser || '').trim().replace(/^@/, '').toLowerCase();

        // --- CACHE DE MEMORIA: Siempre actualizar ---
        const normUser = rawUser.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        window.__memoryGamificationData = window.__memoryGamificationData || {};
        window.__memoryGamificationData[normUser] = data;

        // --- LOCALSTORAGE: Solo si soy el dueño ---
        const currentUser = getCurrentUser();
        const normCurrent = String(currentUser || '').trim().replace(/^@/, '').toLowerCase();
        const isAdminMode = localStorage.getItem('isAdminMode') === 'true' || localStorage.getItem('isAdminAuthenticated') === 'true';
        const isOwner = !isAdminMode && (rawUser === normCurrent);

        if (isOwner) {
          const allDataStr = localStorage.getItem('gamificationData');
          const allData = allDataStr ? JSON.parse(allDataStr) : {};
          allData[rawUser] = data;
          localStorage.setItem('gamificationData', JSON.stringify(allData));
        } else {
          // console.log(`🔒 Evitando escritura en localStorage para ${targetUser} (No soy dueño)`);
        }

        // PUSH AUTOMÁTICO A LA NUBE (Debounce simple para evitar saturación)
        // Solo intentar subir si soy el dueño, para evitar que el Admin sobrescriba.
        // IMPORTANTE: aquí ya NO tocamos `totalPoints`; solo sincronizamos la
        // estructura `gamification` para evitar doble conteo o sobreescrituras
        // parciales del total.
        if (isOwner && window.db) {
          const now = Date.now();
          window._lastCloudPush = window._lastCloudPush || {};
          const lastPush = window._lastCloudPush[targetUser.toLowerCase()] || 0;

          // Si han pasado más de 10 segundos desde el último push, o si es un cambio crítico (muchos puntos)
          if (now - lastPush > 10000) {
            window._lastCloudPush[targetUser.toLowerCase()] = now;
            const normUser = normalizeUserKey(targetUser);

            // No bloquear la UI, hacerlo en segundo plano
            const docRef = db.collection('userStats').doc(normUser);
            const payload = {
              gamification: Object.assign({}, data),
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            docRef.set(payload, { merge: true }).catch(err => console.error("Error auto-pushing stats:", err));
          }
        }
      }

      async function calculateUserStatsForUser(usuario = null, options = {}) {
        const allTime = !!options.allTime;
        const targetUser = usuario || getCurrentSelectedUser();

        // Utilitario para estandarizar el día (YYYY-MM-DD) de una solicitud
        const getSongDay = (s) => {
          try {
            if (s.day && typeof s.day === 'string') {
              const parts = s.day.split('-');
              if (parts.length === 3) {
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                const d = parseInt(parts[2], 10);
                const dt = new Date(y, m, d);
                if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
              }
              const d2 = new Date(s.day);
              if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0];
            }
            if (s.ts) {
              const dt = s.ts && s.ts.toDate ? s.ts.toDate() : new Date(s.ts);
              if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
            }
            if (s.timestamp) {
              const dt = s.timestamp && s.timestamp.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
              if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
            }
            if (s.time) {
              const dt = s.time && s.time.toDate ? s.time.toDate() : new Date(s.time);
              if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
            }
          } catch (_) { }
          return new Date().toISOString().split('T')[0];
        };

        // Normalizador para detectar "Zero FM" o variantes (espacios/Mayúsculas)
        const isZeroFM = (name) => {
          const n = String(name || '').toLowerCase();
          return n.includes('zerofm') || n.includes('zero fm');
        };

        // Determinar si una solicitud está marcada como reproducida (Usando set global)
        const isEntryPlayed = (s, playedSet) => {
          try {
            const hour = s.hora || (window.toHourKey ? window.toHourKey(s.ts || s.timestamp || s.time) : toHour(s.ts || s.timestamp || s.time));
            const sid = `${s.usuario}-${s.cancion}-${s.artista}-${hour}`.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
            return playedSet.has(sid);
          } catch (_) { return false; }
        };

        try {
          // Obtener datos combinados de Firebase y localStorage
          const allSolicitudes = await getAllCombinedSolicitudes({ allTime: (typeof allTime !== 'undefined' ? allTime : false) });

          const normTargetUser = normalizeUserKey(targetUser);
          const userSongs = allSolicitudes.filter(s => normalizeUserKey(s.usuario) === normTargetUser && !isTestRequestForStats(s));
          
          // OBTENER SET GLOBAL DE REPRODUCIDAS (Firestore + Events + Local)
          const playedSet = await getGlobalPlayedSongsSetForUser(targetUser);
          
          console.log(`🎵 ${targetUser}: ${userSongs.length} canciones encontradas de ${allSolicitudes.length} totales`);

          const uniqueArtists = [...new Set(userSongs.map(s => s.artista))].length;
          const playedSongs = userSongs.filter(s => isEntryPlayed(s, playedSet));
          const totalPlayedSongs = playedSongs.length;
          const uniqueArtistsPlayed = [...new Set(playedSongs.map(s => s.artista))].length;
          console.log(`🎤 ${targetUser}: ${uniqueArtists} artistas únicos`);

          // Calcular el máximo de pedidos por artista (para logros del mismo artista)
          const artistCounts = userSongs.reduce((acc, s) => {
            const k = (s.artista || '').toLowerCase();
            if (!k) return acc;
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          }, {});
          const topArtistCount = Object.values(artistCounts).reduce((max, n) => Math.max(max, n), 0);
          const playedArtistCounts = playedSongs.reduce((acc, s) => {
            const k = (s.artista || '').toLowerCase();
            if (!k) return acc;
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          }, {});
          const topArtistCountPlayed = Object.values(playedArtistCounts).reduce((max, n) => Math.max(max, n), 0);

          // Calcular días únicos usando getSongDay
          const uniqueDays = [...new Set(userSongs.map(getSongDay))].length;
          console.log(`📅 ${targetUser}: ${uniqueDays} días únicos de actividad`);

          // Canciones de Zero FM
          const zeroFMSongs = userSongs.filter(s => isZeroFM(s.artista)).length;
          const zeroFMSongsPlayed = playedSongs.filter(s => isZeroFM(s.artista)).length;

          // “Primero en pedir”: contar días donde el primer pedido del día es del usuario
          // SOLO si hubo al menos 2 solicitudes ese día
          const allWithTime = allSolicitudes.filter(s => (s.timestamp || s.ts || s.time) && !isTestRequestForStats(s));
          const earliestByDay = new Map();
          const countsByDay = new Map();

          allWithTime.forEach(s => {
            let dt;
            try {
              dt = s.ts && s.ts.toDate ? s.ts.toDate() : new Date(s.timestamp || s.ts || s.time);
            } catch (_) {
              dt = new Date(s.timestamp || s.ts || s.time);
            }
            const day = getSongDay(s);
            countsByDay.set(day, (countsByDay.get(day) || 0) + 1);
            const curr = earliestByDay.get(day);
            if (!curr || dt < curr.dt) {
              earliestByDay.set(day, { usuario: s.usuario, dt, day });
            }
          });
          let firstRequests = 0;
          earliestByDay.forEach(({ usuario, day }) => {
            if (normalizeUserKey(usuario) === normTargetUser && (countsByDay.get(day) || 0) >= 2) firstRequests++;
          });

          // Verificar estado VIP desde Firebase (sets globales)
          const isVip = typeof window.isUserVipGlobal === 'function' ? window.isUserVipGlobal(targetUser) : 
                        ((typeof vipSet !== 'undefined' && vipSet.has(targetUser)) || (typeof z0VipSet !== 'undefined' && z0VipSet.has(targetUser)));

          // Obtener datos de gamificación existentes para preservar rachas
          const existingData = getGamificationDataForUser(targetUser);
          const bestStreak = existingData.streaks ? existingData.streaks.best : 0;

          return {
            totalSongs: userSongs.length,
            totalPlayedSongs,
            uniqueArtists,
            uniqueArtistsPlayed,
            activeDays: uniqueDays,
            isVip,
            bestStreak,
            topArtistCount,
            topArtistCountPlayed,
            firstRequests,
            zeroFMSongs,
            zeroFMSongsPlayed
          };
        } catch (error) {
          console.error('Error al calcular estadísticas del usuario:', error);

          // FIX: Si falla Firestore y NO soy el usuario objetivo, NO usar fallback local de "mis" solicitudes
          const currentUser = getCurrentUser();
          const normTarget = String(targetUser || '').trim().replace(/^@/, '').toLowerCase();
          const normCurrent = String(currentUser || '').trim().replace(/^@/, '').toLowerCase();

          if (normTarget !== normCurrent) {
            console.warn(`⚠️ Evitando fallback local para usuario ajeno (${targetUser}) tras error de Firestore.`);
            // Devolver datos vacíos seguros en lugar de contaminar con datos locales
            return {
              totalSongs: 0,
              totalPlayedSongs: 0,
              uniqueArtists: 0,
              uniqueArtistsPlayed: 0,
              activeDays: 0,
              isVip: false,
              bestStreak: 0,
              topArtistCount: 0,
              topArtistCountPlayed: 0,
              firstRequests: 0,
              zeroFMSongs: 0,
              zeroFMSongsPlayed: 0
            };
          }

          // Fallback a localStorage (SOLO SI ES MI PROPIO PERFIL)
          const solicitudes = JSON.parse(localStorage.getItem('solicitudes') || '[]');

          const normTargetUser = normalizeUserKey(targetUser);
          const userSongs = solicitudes.filter(s => normalizeUserKey(s.usuario) === normTargetUser);
          const uniqueArtists = [...new Set(userSongs.map(s => s.artista))].length;
          const playedSongs = userSongs.filter(isEntryPlayed);
          const totalPlayedSongs = playedSongs.length;
          const uniqueArtistsPlayed = [...new Set(playedSongs.map(s => s.artista))].length;

          // Calcular el máximo de pedidos por artista (para logros del mismo artista)
          const artistCounts = userSongs.reduce((acc, s) => {
            const k = (s.artista || '').toLowerCase();
            if (!k) return acc;
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          }, {});
          const topArtistCount = Object.values(artistCounts).reduce((max, n) => Math.max(max, n), 0);
          const playedArtistCounts = playedSongs.reduce((acc, s) => {
            const k = (s.artista || s.artist || '').toLowerCase();
            if (!k) return acc;
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          }, {});
          const topArtistCountPlayed = Object.values(playedArtistCounts).reduce((max, n) => Math.max(max, n), 0);

          const uniqueDays = [...new Set(userSongs.map(getSongDay))].length;

          // Canciones de Zero FM (fallback local)
          const zeroFMSongs = (userSongs || []).filter(s => {
            const artist = (s.artist || '').toLowerCase();
            return artist.includes('zero fm') || artist.includes('zerofm');
          }).length;
          const zeroFMSongsPlayed = (playedSongs || []).filter(s => {
            const artist = (s.artist || s.artista || '').toLowerCase();
            return artist.includes('zero fm') || artist.includes('zerofm');
          }).length;

          // “Primero en pedir” por día con condición de mínimo 2 solicitudes (fallback local)
          const allWithTimeLS = solicitudes.filter(s => s.timestamp || s.ts || s.time);
          const earliestByDayLS = new Map();
          const countsByDayLS = new Map();

          allWithTimeLS.forEach(s => {
            const dtRaw = s.timestamp || s.ts || s.time;
            let dt;
            try {
              dt = s.ts && s.ts.toDate ? s.ts.toDate() : new Date(dtRaw);
            } catch (_) {
              dt = new Date(dtRaw);
            }
            const day = s.day ? s.day : getSongDay(s);
            countsByDayLS.set(day, (countsByDayLS.get(day) || 0) + 1);
            const curr = earliestByDayLS.get(day);
            if (!curr || dt < curr.dt) {
              earliestByDayLS.set(day, { usuario: s.usuario, dt, day });
            }
          });
          let firstRequests = 0;
          earliestByDayLS.forEach(({ usuario, day }) => {
            if (normalizeUserKey(usuario) === normTargetUser && (countsByDayLS.get(day) || 0) >= 2) firstRequests++;
          });

          // Verificar estado VIP desde Firebase (sets globales)
          const isVip = typeof window.isUserVipGlobal === 'function' ? window.isUserVipGlobal(targetUser) : 
                        ((typeof vipSet !== 'undefined' && vipSet.has(targetUser)) || (typeof z0VipSet !== 'undefined' && z0VipSet.has(targetUser)));

          console.log(`👑 Verificación VIP para ${targetUser}:`);
          console.log(`   - Es VIP final: ${isVip}`);

          // Obtener datos de gamificación existentes para preservar rachas
          const existingData = getGamificationDataForUser(targetUser);
          const bestStreak = existingData.streaks ? existingData.streaks.best : 0;

          return {
            totalSongs: userSongs.length,
            totalPlayedSongs,
            uniqueArtists,
            uniqueArtistsPlayed,
            activeDays: uniqueDays,
            isVip,
            bestStreak,
            topArtistCount,
            topArtistCountPlayed,
            firstRequests,
            zeroFMSongs,
            zeroFMSongsPlayed
          };
        }
      }



      // Modificar renderGamificationModal para usar el usuario seleccionado
      async function renderGamificationModal() {
        const targetUser = getCurrentSelectedUser();
        console.log(`🎨 INICIO - Renderizando modal para usuario: ${targetUser}`);
        
        let freshStats = null; // DECLARAR AQUÍ EN EL ÁMBITO SUPERIOR

        // RESET INICIAL: Limpiar campos de UI para evitar "fantasmas" o previsualizaciones erróneas
        try {
          const filterInput = document.getElementById('user-search-filter');
          if (filterInput) filterInput.value = ''; // Limpiar buscador al abrir modal

          const idsToClear = ['user-points', 'personal-total-songs', 'personal-total-played', 'personal-unique-artists', 'personal-active-days', 'personal-rank', 'breakdown-played-base', 'breakdown-vip-bonus', 'breakdown-daily-bonus', 'breakdown-achievements', 'breakdown-streak-residual', 'breakdown-total', 'current-xp', 'next-level-xp'];
          idsToClear.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '...'; });
          const pf = document.getElementById('progress-fill'); if (pf) pf.style.width = '0%';
        } catch (_) { }

        // PRIMER PASO: Intentar sincronizar con la nube para asegurar datos consistentes
        // Esto arregla el problema de "diferentes puntos en diferentes dispositivos"
        let data = await syncGamificationDataWithCloud(targetUser);
        try { subscribeUserStatsPointsForUser(targetUser); } catch (_) { }

        if (!data || !data.stats) {
          console.warn(`⚠️ No hay datos para ${targetUser}, creando datos básicos`);
          data = {
            points: 0,
            xp: 0,
            level: 1,
            achievements: [],
            streaks: { current: 0, best: 0, calendar: {} },
            stats: { songCount: 0, uniqueArtists: 0, activeDays: 0 }
          };
        }

        // LIMPIAR CACHE DE SESIÓN PARA ASEGURAR DATOS FRESCOS AL ABRIR
        window.__sessionBreakdownCache = window.__sessionBreakdownCache || {};
        const sessKey = String(targetUser || '').trim().replace(/^@/, '').toLowerCase(); // Unificado
        delete window.__sessionBreakdownCache[sessKey];

        // RECALCULAR RACHAS Y ESTADÍSTICAS EN TIEMPO REAL (FUSIÓN DE CUENTAS)
        console.log(`🔥 Recalculando breakdown para ${targetUser}...`);
        try {
          freshStats = await computeUserBreakdown(targetUser);
          if (freshStats) {
            window.__sessionBreakdownCache[sessKey] = freshStats; // Guardar en cache de sesión
            data.streaks.current = freshStats.currentStreak;
            data.streaks.best = freshStats.bestStreak;

            // ACTUALIZAR STATS PARA EVALUACIÓN DE LOGROS
            data.stats = data.stats || {};
            data.stats.totalSongs = Math.max(freshStats.requestedCount || 0, freshStats.playedCount || 0); // Para compatibilidad
            data.stats.totalPlayedSongs = freshStats.playedCount;
            data.stats.songCount = freshStats.playedCount;
            data.stats.requestedCount = Math.max(freshStats.requestedCount || 0, freshStats.playedCount || 0);
            data.stats.activeDays = freshStats.activeDaysValid;
            data.stats.uniqueArtists = freshStats.uniqueArtists || (data.stats.uniqueArtists || 0);
            data.stats.uniqueArtistsPlayed = freshStats.uniqueArtistsPlayed || (data.stats.uniqueArtistsPlayed || 0);
            data.stats.bestStreak = freshStats.bestStreak;
            data.stats.firstRequests = freshStats.firstRequests;
            data.stats.zeroFMSongs = freshStats.zeroFMSongs;
            data.stats.zeroFMSongsPlayed = freshStats.zeroFMSongsPlayed;
            data.stats.topArtistCount = freshStats.topArtistCount;
            data.stats.topArtistCountPlayed = freshStats.topArtistCountPlayed;

            // Actualizar también puntos si la diferencia es a favor de la reconstrucción
            if (freshStats.total > data.points) {
              data.points = freshStats.total;
              data.xp = freshStats.total;
              data.level = calculateLevel(data.xp);
            }
          }
        } catch (e) {
          console.error('Error recalcuando rachas en el modal:', e);
        }

        // Procesar logros para el usuario si es necesario
        console.log(`📊 Verificando logros para ${targetUser}...`);
        try {
          data = await processAchievementsForUser(targetUser, data);
          // Si hubo cambios al procesar logros (ej: desbloqueo nuevo), guardar de nuevo
          saveGamificationDataForUser(data, targetUser);
        } catch (error) {
          console.warn(`⚠️ Error procesando logros para ${targetUser}:`, error);
        }

        // Verificar y otorgar logros de insignias
        console.log(`🏆 Verificando logros de insignias para ${targetUser}...`);
        window.grantBadgeAchievement(targetUser);
        const currentLevel = getLevelInfo(data.level);
        const nextLevel = getNextLevelInfo(data.level);
        const xpDiff = nextLevel.xpRequired - currentLevel.xpRequired;
        const progressPercent = xpDiff > 0 ? ((data.xp - currentLevel.xpRequired) / xpDiff) * 100 : 100;

        // Actualizar información del usuario
        updateUserHeaderUI(targetUser, data);

        console.log(`✅ Información actualizada: ${targetUser}, Nivel ${data.level}, ${data.points} puntos`);

        // Refrescar paneles con el usuario seleccionado
        // IMPORTANTE: Renderizar transparencia aunque no esté en esa pestaña para actualizar los valores
        try {
          await renderPointsBreakdownForUser(targetUser, true);
        } catch (_) { }

        try {
          await renderPersonalStatsForUser(data, targetUser);
        } catch (_) { }

        // Actualizar barra de progreso
        const progressFillEl = document.getElementById('progress-fill');
        const progressTextEl = document.querySelector('.level-progress .progress-text');

        if (progressFillEl) {
          progressFillEl.style.width = data.level >= 7 ? '100%' : `${Math.min(progressPercent, 100)}%`;
        }

        if (progressTextEl) {
          if (data.level >= 7) {
            progressTextEl.innerHTML = `<span id="current-xp">${data.xp}</span> XP (Nivel Máximo Leyenda 👑)`;
          } else {
            const currentLevelXp = currentLevel.xpRequired;
            const nextLevelXp = nextLevel.xpRequired;
            progressTextEl.innerHTML = `<span id="current-xp">${data.xp - currentLevelXp}</span> / <span id="next-level-xp">${nextLevelXp - currentLevelXp}</span> XP para el siguiente nivel`;
          }
        }

        // RE-EVALUAR LOGROS CON DATOS FRESCOS ANTES DE RENDERIZAR
        try {
          if (typeof freshStats !== 'undefined' && freshStats) {
            data.stats = data.stats || {};
            data.stats.totalPlayedSongs = freshStats.playedCount;
            data.stats.songCount = freshStats.playedCount;
            data.stats.requestedCount = freshStats.requestedCount;
            data.stats.totalSongs = Math.max(freshStats.requestedCount || 0, freshStats.playedCount || 0);
            data.stats.uniqueArtists = freshStats.uniqueArtists;
            data.stats.activeDays = freshStats.activeDaysValid;
            data.stats.firstRequests = freshStats.firstRequests;
            data.stats.zeroFMSongs = freshStats.zeroFMSongs;
            data.stats.zeroFMSongsPlayed = freshStats.zeroFMSongsPlayed;
            data.stats.topArtistCount = freshStats.topArtistCount;
            data.stats.topArtistCountPlayed = freshStats.topArtistCountPlayed;
          }
          data = await processAchievementsForUser(targetUser, data);
          
          // Si hubo desbloqueos nuevos (marcado por lastUnlockedAchievementAt), guardar en nube
          if (data && data.lastUnlockedAchievementAt && (Date.now() - data.lastUnlockedAchievementAt < 5000)) {
            saveGamificationDataForUser(data, targetUser);
          }

          renderAchievementsForUser(data);
        } catch (error) {
          console.error('Error procesando/renderizando logros:', error);
        }

        // Renderizar rachas
        console.log(`🔥 Llamando renderStreaksForUser con datos:`, data);
        try {
          await renderStreaksForUser(data);
        } catch (error) {
          console.error('Error renderizando rachas:', error);
        }
        // Actualizar selector de usuario
        populateUserSelector().then(() => {
          const userSelect = document.getElementById('gamification-user-select');
          const backBtn = document.getElementById('back-to-my-profile');
          console.log(`🎯 Configurando selector: targetUser=${targetUser}, getCurrentUser()=${getCurrentUser()}`);

          if (userSelect) {
            const container = document.querySelector('.user-autocomplete-container');
            if (targetUser !== getCurrentUser()) {
              userSelect.value = targetUser;
              if (container) container.style.display = 'none';
              if (backBtn) {
                backBtn.style.display = 'inline-block';
              }
              console.log(`✅ Selector configurado a: ${targetUser}`);
            } else {
              userSelect.value = '';
              if (container) container.style.display = 'block';
              const filterInput = document.getElementById('user-search-filter');
              if (filterInput) {
                filterInput.value = ''; // Limpiar buscador
              }
              if (backBtn) {
                backBtn.style.display = 'none';
              }
              console.log(`🏠 Usuario actual, selector limpio`);
            }
          }
        }).catch(console.error);
      }

      function renderAchievementsForUser(data) {
        console.log(`🏆 Renderizando logros para usuario:`, data.achievements);

        const container = document.getElementById('achievements-list');
        if (!container) {
          console.error('❌ Contenedor achievements-list no encontrado');
          return;
        }

        if (!ACHIEVEMENTS || ACHIEVEMENTS.length === 0) {
          console.error('❌ No hay logros definidos');
          return;
        }

        console.log(`🎯 Renderizando ${ACHIEVEMENTS.length} logros con progreso`);

        container.innerHTML = ACHIEVEMENTS.map(achievement => {
          const isUnlocked = Array.isArray(data.achievements) && data.achievements.includes(achievement.id);
          const prog = typeof getAchievementProgress === 'function'
            ? getAchievementProgress(achievement, data.stats || {})
            : null;

          return `
            <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
              <div class="achievement-points">+${achievement.points}</div>
              <div class="achievement-icon">${achievement.icon}</div>
              <div class="achievement-title">${achievement.title}</div>
              <div class="achievement-description">${achievement.description}</div>
              ${prog ? `
              <div class="achievement-progress">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${prog.percent}%;"></div>
                </div>
                <div class="progress-text">${prog.current}/${prog.target} ${prog.unit}</div>
              </div>` : ''}
            </div>
          `;
        }).join('');
      }

      function getAchievementProgressForUser(achievement, stats) {
        const id = achievement.id;

        if (id === 'first_song' || id === 'music_lover' || id === 'music_addict' || id === 'music_master') {
          const targets = { first_song: 1, music_lover: 10, music_addict: 50, music_master: 100 };
          return `${stats.totalSongs}/${targets[id]} canciones`;
        }

        if (id === 'diverse_taste' || id === 'explorer') {
          const targets = { diverse_taste: 10, explorer: 25 };
          return `${stats.uniqueArtists}/${targets[id]} artistas`;
        }

        if (id === 'streak_starter' || id === 'streak_master' || id === 'streak_legend') {
          const targets = { streak_starter: 3, streak_master: 7, streak_legend: 30 };
          const bestStreak = stats.bestStreak || 0;
          return `${bestStreak}/${targets[id]} días`;
        }

        if (id === 'daily_user') {
          return `${stats.activeDays}/10 días`;
        }

        return null;
      }

      async function renderStreaksForUser(data) {
        const targetUser = getCurrentSelectedUser() || getCurrentUser();
        const sessKey = String(targetUser || '').toLowerCase();
        const cachedBreakdown = window.__sessionBreakdownCache && window.__sessionBreakdownCache[sessKey];
        
        let currentStreak = (data && data.streaks && data.streaks.current) || 0;
        let bestStreak = (data && data.streaks && data.streaks.best) || 0;
        let calendarActivity = (data && data.streaks && data.streaks.calendar) || {};

        if (cachedBreakdown) {
          currentStreak = cachedBreakdown.currentStreak || currentStreak;
          bestStreak = cachedBreakdown.bestStreak || bestStreak;
          
          // Reconstruir calendario a partir del desglose oficial para coherencia absoluta
          if (Array.isArray(cachedBreakdown.detail)) {
            const reconstructed = {};
            cachedBreakdown.detail.forEach(d => {
              if (d.day) reconstructed[d.day] = (reconstructed[d.day] || 0) + (d.played || 0);
            });
            calendarActivity = reconstructed;
          }
        }

        console.log(`🔥 Renderizando rachas para usuario ${targetUser}:`, { currentStreak, bestStreak });

        const currentStreakEl = document.getElementById('current-streak');
        const bestStreakEl = document.getElementById('best-streak');

        if (currentStreakEl) {
          currentStreakEl.textContent = `${currentStreak} días`;
        }
        if (bestStreakEl) {
          bestStreakEl.textContent = `${bestStreak} días`;
        }

        // Renderizar calendario de actividad
        await renderStreakCalendarForUser(calendarActivity);
      }

      async function renderStreakCalendarForUser(calendar) {
        try {
          console.log('🗓️ Renderizando calendario de rachas con datos combinados...');

          const container = document.getElementById('streak-calendar-grid');
          if (!container) {
            console.warn('❌ Contenedor del calendario de rachas no encontrado');
            return;
          }

          // Verificar si ya existe un calendario oficial
          const isOfficial = container.getAttribute('data-calendar-source') === 'official';
          const hasContent = container.innerHTML.trim().length > 500 && container.innerHTML.includes('calendar-day');

          if (isOfficial && hasContent) {
            console.log('✅ Calendario oficial ya existe y está completo, no sobrescribir');
            return;
          }

          // Prioridad 1: Usar datos pasados explícitamente (del perfil de usuario)
          let allActivity = {};

          if (calendar && Object.keys(calendar).length > 0) {
            console.log('✅ Usando datos de calendario del perfil:', Object.keys(calendar).length, 'días');
            allActivity = calendar;
          } else {
            // Prioridad 2: Fallback a createSimpleCalendar si es el usuario actual
            // (Esto asegura consistencia si estamos viendo nuestra propia info)
            const currentUser = getCurrentUser();
            const selectedUser = typeof getCurrentSelectedUser === 'function' ? getCurrentSelectedUser() : currentUser;

            if (normalizeUserKey(currentUser) === normalizeUserKey(selectedUser) && typeof createSimpleCalendar === 'function') {
              console.log('✅ Usando createSimpleCalendar para usuario actual');
              await createSimpleCalendar();
              return;
            }

            // Prioridad 3: Fallback manual con datos locales
            console.log('📦 Fallback: combinando datos manualmente...');

            // Obtener TODOS los datos
            const playedSongs = JSON.parse(localStorage.getItem('playedSongs') || '{}');
            const solicitudesByDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');
            const solicitudes = JSON.parse(localStorage.getItem('solicitudes') || '[]');

            // 1. Agregar playedSongs
            Object.keys(playedSongs).forEach(function (date) {
              allActivity[date] = (allActivity[date] || 0) + playedSongs[date].length;
            });

            // 2. Agregar solicitudes_by_day
            Object.keys(solicitudesByDay).forEach(function (date) {
              const dayData = solicitudesByDay[date] || [];
              allActivity[date] = (allActivity[date] || 0) + dayData.length;
            });

            // 3. Agregar solicitudes legacy
            solicitudes.forEach(function (song) {
              if (song.time) {
                const date = new Date(song.time).toISOString().split('T')[0];
                allActivity[date] = (allActivity[date] || 0) + 1;
              }
            });
          }

          const today = new Date();
          const days = [];

          // Generar últimos 28 días
          for (let i = 27; i >= 0; i--) {
            const date = new Date(today.getTime() - (i * 86400000));
            const dateStr = date.toISOString().split('T')[0];
            const isToday = i === 0;
            const activityCount = allActivity[dateStr] || 0;

            // Determinar nivel de actividad
            let activityClass = '';
            let activityTitle = dateStr;

            if (activityCount > 0) {
              if (activityCount >= 10) {
                activityClass = 'activity-very-high';
                activityTitle += ' - ' + activityCount + ' canciones (Muy activo)';
              } else if (activityCount >= 5) {
                activityClass = 'activity-high';
                activityTitle += ' - ' + activityCount + ' canciones (Activo)';
              } else if (activityCount >= 3) {
                activityClass = 'activity-medium';
                activityTitle += ' - ' + activityCount + ' canciones (Activo)';
              } else {
                activityClass = 'activity-low';
                activityTitle += ' - ' + activityCount + ' canción' + (activityCount > 1 ? 'es' : '') + ' (Poco activo)';
              }
            } else {
              activityTitle += ' - Sin actividad';
            }

            days.push('<div class="calendar-day ' + activityClass + (isToday ? ' today' : '') + '" title="' + activityTitle + '">' + date.getDate() + '</div>');
          }

          container.innerHTML = days.join('');
          container.setAttribute('data-calendar-source', 'fallback-v2');
          console.log('✅ Calendario renderizado con datos (fallback-v2)');

        } catch (error) {
          console.error('Error renderizando calendario de rachas:', error);
          const container = document.getElementById('streak-calendar-grid');
          if (container) {
            container.innerHTML = '<div class="calendar-day">Error al cargar actividad</div>';
          }
        }
      }

      // ===== Navegación de calendario de rachas (mes completo) =====
      const monthNamesEs = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const calendarState = { month: new Date().getMonth(), year: new Date().getFullYear(), initialized: false };

      async function populateYearOptionsForCalendar() {
        const yearSelect = document.getElementById('year-select');
        if (!yearSelect) return;
        let minYear = new Date().getFullYear() - 2;
        let maxYear = new Date().getFullYear() + 1;
        try {
          const all = await getAllCombinedSolicitudes();
          const years = all.map(s => {
            const d = s.ts ? new Date(s.ts) : (s.day ? new Date(s.day) : null);
            return d && !isNaN(d.getTime()) ? d.getFullYear() : null;
          }).filter(Boolean);
          if (years.length) {
            minYear = Math.min(...years);
            maxYear = Math.max(...years);
          }
        } catch (e) { }
        const options = [];
        for (let y = maxYear; y >= minYear; y--) {
          options.push(`<option value="${y}">${y}</option>`);
        }
        yearSelect.innerHTML = options.join('');
      }

      function setCalendarTitle(month, year) {
        const titleEl = document.querySelector('.streak-calendar h4');
        if (titleEl) {
          titleEl.textContent = `🗓️ Actividad de Usuario - ${monthNamesEs[month]} de ${year}`;
        }
      }

      async function initStreakCalendarNavigation() {
        const prevBtn = document.getElementById('prev-month');
        const nextBtn = document.getElementById('next-month');
        const monthSelect = document.getElementById('month-select');
        const yearSelect = document.getElementById('year-select');
        const grid = document.getElementById('streak-calendar-grid');
        if (!grid || !monthSelect || !yearSelect || !prevBtn || !nextBtn) {
          return;
        }
        if (!calendarState.initialized) {
          await populateYearOptionsForCalendar();
          const now = new Date();
          calendarState.month = now.getMonth();
          calendarState.year = now.getFullYear();
          monthSelect.value = String(calendarState.month);
          yearSelect.value = String(calendarState.year);
          prevBtn.addEventListener('click', async () => {
            if (calendarState.month === 0) {
              calendarState.month = 11;
              calendarState.year--;
              yearSelect.value = String(calendarState.year);
            } else {
              calendarState.month--;
            }
            monthSelect.value = String(calendarState.month);
            await renderSelectedMonth();
          });
          nextBtn.addEventListener('click', async () => {
            if (calendarState.month === 11) {
              calendarState.month = 0;
              calendarState.year++;
              yearSelect.value = String(calendarState.year);
            } else {
              calendarState.month++;
            }
            monthSelect.value = String(calendarState.month);
            await renderSelectedMonth();
          });
          monthSelect.addEventListener('change', async () => {
            calendarState.month = parseInt(monthSelect.value, 10) || calendarState.month;
            await renderSelectedMonth();
          });
          yearSelect.addEventListener('change', async () => {
            calendarState.year = parseInt(yearSelect.value, 10) || calendarState.year;
            await renderSelectedMonth();
          });
          calendarState.initialized = true;
        }
        await renderSelectedMonth();
      }

      async function renderSelectedMonth() {
        const username = getCurrentSelectedUser ? getCurrentSelectedUser() : getCurrentUser();
        await renderMonthForUser(username, calendarState.month, calendarState.year);
      }

      async function renderMonthForUser(username, month, year) {
        try {
          const activity = await computeActivityForMonth(username, month, year);
          renderMonthGrid(activity, month, year);
          setCalendarTitle(month, year);
        } catch (e) {
          console.error('Error renderizando mes:', e);
        }
      }

      async function computeActivityForMonth(username, month, year) {
        const activity = {};
        try {
          // El calendario ahora se alinea perfectamente con los "Días Activos" y las Rachas.
          // Usamos el desglose oficial del usuario que ya filtra skips y cruza fusiones de cuenta.
          const breakdown = await computeUserBreakdown(username);
          if (breakdown && breakdown.detail) {
            breakdown.detail.forEach(d => {
              const parts = String(d.day).split('-');
              if (parts.length === 3) {
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                if (y === year && m === month) {
                  activity[d.day] = d.played;
                }
              }
            });
          }
        } catch (e) { console.error('Error computing activity for month:', e); }
        return activity;
      }

      function renderMonthGrid(activityByDay, month, year) {
        const grid = document.getElementById('streak-calendar-grid');
        if (!grid) return;
        grid.innerHTML = '';
        const firstDay = new Date(year, month, 1);
        const startDow = firstDay.getDay(); // 0=Domingo
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevMonthDays = new Date(year, month, 0).getDate();
        const totalCells = 42; // 6 semanas
        const today = new Date();
        for (let i = 0; i < totalCells; i++) {
          let displayDay, displayMonth = month, displayYear = year, isOther = false;
          if (i < startDow) {
            displayDay = prevMonthDays - (startDow - 1 - i);
            if (month === 0) {
              displayMonth = 11; displayYear = year - 1;
            } else {
              displayMonth = month - 1;
            }
            isOther = true;
          } else if (i >= startDow + daysInMonth) {
            displayDay = i - (startDow + daysInMonth) + 1;
            if (month === 11) {
              displayMonth = 0; displayYear = year + 1;
            } else {
              displayMonth = month + 1;
            }
            isOther = true;
          } else {
            displayDay = i - startDow + 1;
          }
          const dateObj = new Date(displayYear, displayMonth, displayDay);
          const dateKey = dateObj.toISOString().split('T')[0];
          const count = activityByDay[dateKey] || 0;
          let activityClass = '';
          if (count > 0) {
            if (count >= 10) activityClass = 'activity-very-high';
            else if (count >= 5) activityClass = 'activity-high';
            else if (count >= 3) activityClass = 'activity-medium';
            else activityClass = 'activity-low';
          }
          const isToday = today.getFullYear() === displayYear && today.getMonth() === displayMonth && today.getDate() === displayDay;
          const cell = document.createElement('div');
          cell.className = `calendar-day ${activityClass}${isToday ? ' today' : ''}${isOther ? ' other-month' : ''}`;
          cell.setAttribute('title', `${dateKey}${count ? ` - ${count} canción${count !== 1 ? 'es' : ''}` : ' - Sin actividad'}`);
          cell.setAttribute('data-date', dateKey);
          cell.setAttribute('data-songs', String(count));
          cell.textContent = String(displayDay);
          grid.appendChild(cell);
        }
      }

      // --- Utilidades consolidadas ---


      // NUEVA función para contar solicitudes históricas de un usuario (TOTALES)
      async function countTotalRequestedSongsForUser(usuario, optionalFused) {
        try {
          const fusedIds = optionalFused || (typeof getFusedIds === 'function' ? getFusedIds(usuario) : [usuario]);
          const snap = await db.collection('solicitudes').where('usuario', 'in', fusedIds).get();
          const pending = snap.size;
          
          let played = 0;
          if (typeof countTotalToggledSongsForUser === 'function') {
            played = await countTotalToggledSongsForUser(usuario, fusedIds);
          }
          return pending + played;
        } catch (e) { return 0; }
      }
      const legacy_countTotalRequestedSongsForUser = async () => {
        try {
          const norm = typeof normalizeUserKey === 'function' ? normalizeUserKey(usuario) : String(usuario || '').trim().toLowerCase().replace(/^@/, '');
          if (!norm) return 0;

          // 1. Intentar leer de la fuente de verdad consolidada (Global Stats)
          try {
            const doc = await db.collection('globalStats').doc('userTotals').get();
            if (doc.exists) {
              const data = doc.data() || {};
              // Buscamos en el objeto 'totals' usando la clave normalizada
              if (data.totals && data.totals[norm] !== undefined) {
                console.log(`📊 GlobalTruth para ${norm}: ${data.totals[norm]} canciones`);
                return data.totals[norm];
              }
            }
          } catch (e) {
            console.warn('Error leyendo userTotals:', e);
          }

          // 2. Si no está en el resumen global, intentar consulta directa a 'solicitudes'
          try {
            const snap = await db.collection('solicitudes')
              .where('usuario', '==', norm)
              .get();

            if (!snap.empty) {
              console.log(`📚 Histórico Firestore (Directo) para ${norm}: ${snap.size} solicitudes`);
              return snap.size;
            }
          } catch (e) {
            console.warn('Error consultando histórico en Firestore:', e);
          }

          // Fallback a lógica anterior (limitada al día) si falla Firestore o no hay datos
          // Esto es lo que causaba que vieras menos puntos si no estabas en el día correcto
          const all = await getAllCombinedSolicitudes();
          const filtered = all.filter(s => {
            const u = String(s.usuario || '').trim().replace(/^@/, '').toLowerCase();
            return u === norm;
          });

          return filtered.length;
        } catch (e) { console.error(e); return 0; }
      }

      async function renderPersonalStatsForUser(data, usuario) {
        const targetUser = usuario || getCurrentSelectedUser();
        const normKey = String(targetUser || '').trim().toLowerCase().replace(/^@/, '');
        
        let stats = (data && data.stats) || {};

        // COHERENCIA CRÍTICA: Si tenemos datos frescos de desglose en la sesión (que lee directo de playedSongs y solicitudes),
        // usarlos como fuente autoritativa de verdad para evitar discrepancias visuales entre pestañas (ej: 133 vs 402).
        if (window.__sessionBreakdownCache && window.__sessionBreakdownCache[normKey]) {
          const fresh = window.__sessionBreakdownCache[normKey];
          console.log(`📊 [PersonalStats] Usando caché de breakdown en tiempo real para ${targetUser}:`, fresh);
          stats = {
            totalSongs: Math.max(fresh.requestedCount || 0, fresh.playedCount || 0),
            requestedCount: Math.max(fresh.requestedCount || 0, fresh.playedCount || 0),
            totalPlayedSongs: fresh.playedCount,
            songCount: fresh.playedCount,
            activeDays: fresh.activeDaysValid,
            uniqueArtists: fresh.uniqueArtists || stats.uniqueArtists || 0,
            uniqueArtistsPlayed: fresh.uniqueArtistsPlayed || stats.uniqueArtistsPlayed || 0
          };
        }
        
        console.log(`📊 Renderizando estadísticas para ${targetUser}:`, stats);

        const totalSongsEl = document.getElementById('personal-total-songs');
        const totalPlayedEl = document.getElementById('personal-total-played');
        const uniqueArtistsEl = document.getElementById('personal-unique-artists');
        const activeDaysEl = document.getElementById('personal-active-days');

        // USAR VALORES PRE-CALCULADOS (Sin parpadeos ni ceros)
        if (totalSongsEl) totalSongsEl.textContent = String(stats.requestedCount || stats.totalSongs || 0);
        if (totalPlayedEl) totalPlayedEl.textContent = String(stats.totalPlayedSongs || stats.songCount || 0);
        if (uniqueArtistsEl) uniqueArtistsEl.textContent = String(stats.uniqueArtists || 0);
        if (activeDaysEl) activeDaysEl.textContent = String(stats.activeDays || 0);

        // --- ACTUALIZACIÓN DE SEGURIDAD (Background) ---
        try {
          const fused = typeof getFusedIds === 'function' ? getFusedIds(targetUser) : [targetUser];
          
          // Verificar si el conteo de pedidas es coherente
          if (totalSongsEl && (!stats.requestedCount || Number(totalSongsEl.textContent) === 0)) {
            const totalRequested = await countTotalRequestedSongsForUser(targetUser, fused);
            totalSongsEl.textContent = String(Math.max(totalRequested, Number(totalPlayedEl.textContent || 0)));
          }
        } catch (e) { }

        try {
          const allSolicitudes = await getAllCombinedSolicitudes({ allTime: false });
          const userCounts = {};
          allSolicitudes.forEach(s => {
            const day = String(s.day || (s.fecha || '').split('T')[0] || '').trim();
            if (day && window.isOnOrAfterStart && !window.isOnOrAfterStart(day)) return; // Restaurado filtro de fecha
            const key = String(s.usuario || '').trim().replace(/^@/, '').toLowerCase();
            userCounts[key] = (userCounts[key] || 0) + 1;
          });
          const sortedUsers = Object.entries(userCounts).sort((a, b) => b[1] - a[1]);
          const normTargetUser = String(targetUser || '').trim().replace(/^@/, '').toLowerCase();
          const userRank = sortedUsers.findIndex(([user]) => user === normTargetUser) + 1;
          const personalRankEl = document.getElementById('personal-rank');
          if (personalRankEl) personalRankEl.textContent = userRank > 0 ? `#${userRank}` : '-';
        } catch (error) {
          console.error("❌ Error calculating user stats rank:", error);
        }

        // --- NUEVA LÓGICA: Contar canjes aceptados ---
        try {
          const dbRef = window.db || db;
          const tUser = String(targetUser || '').trim();
          if (tUser) {
            const snap = await dbRef.collection('rewardRequests')
              .where('userId', '==', tUser)
              .where('status', '==', 'approved')
              .get();
            const acceptedEl = document.getElementById('personal-accepted-redemptions');
            if (acceptedEl) acceptedEl.textContent = String(snap.size);
          }
        } catch (e) { console.error('Error counting redemptions:', e); }

        // --- NUEVA LÓGICA: Contar likes y barra de progreso ---
        try {
          const dbRef = window.db || db;
          const tUser = String(targetUser || '').trim();
          console.log(`❤️ [Debug Likes] Iniciando para usuario: "${tUser}"`);
          if (tUser) {
            let likesCount = 0;
            let sessionLikesCount = 0;
            let likesPerPoint = 300;
            const currentRoomId = (lastLivePayload && lastLivePayload.roomId) || 'no_active_room';
            const fused = typeof getFusedIds === 'function' ? getFusedIds(tUser) : [tUser];
            console.log(`❤️ [Debug Likes] Cuentas vinculadas (fused):`, fused);
            
            for (const fid of fused) {
              const docPath = String(fid).toLowerCase();
              const doc = await dbRef.collection('userStats').doc(docPath).get();
              console.log(`❤️ [Debug Likes] Consultando doc: "userStats/${docPath}". Existe: ${doc.exists}`);
              if (doc.exists) {
                const d = doc.data() || {};
                console.log(`   -> totalLikes: ${d.totalLikes}, sessionLikes: ${d.sessionLikes}`);
                likesCount += Number(d.totalLikes || 0);
                if (d.likesPerPoint) likesPerPoint = Number(d.likesPerPoint);
                
                // Sumar likes de sesión si corresponden al directo activo actual
                if (d.sessionId === currentRoomId && d.sessionLikes) {
                  sessionLikesCount += Number(d.sessionLikes || 0);
                }
              }
            }

            const personalLikesEl = document.getElementById('personal-total-likes');
            const personalSessionLikesEl = document.getElementById('personal-session-likes');
            const likesProgressFill = document.getElementById('likes-progress-fill');
            const likesProgressText = document.getElementById('likes-progress-text');

            console.log(`❤️ [Debug Likes] Total final calculado: ${likesCount}, Sesión: ${sessionLikesCount}`);

            if (personalLikesEl) {
              personalLikesEl.textContent = likesCount.toLocaleString();
            }
            if (personalSessionLikesEl) {
              personalSessionLikesEl.textContent = sessionLikesCount.toLocaleString();
            }
            if (likesProgressFill && likesProgressText) {
              const currentProgress = likesCount % likesPerPoint;
              const percent = (currentProgress / likesPerPoint) * 100;
              likesProgressFill.style.width = `${percent}%`;
              likesProgressText.textContent = `${currentProgress.toLocaleString()} / ${likesPerPoint} likes`;
            }
          }
        } catch (e) {
          console.error('❤️ [Debug Likes] Error en renderizado de likes:', e);
        }

        // Renderizar géneros favoritos (simulado)
        renderFavoriteGenresForUser();
      }

      async function renderFavoriteGenresForUser() {
        await renderFavoriteGenres();
      }


      // Event listeners para el selector de usuario
      document.getElementById('gamification-user-select')?.addEventListener('change', async (e) => {
        const userSelect = document.getElementById('gamification-user-select');
        const backBtn = document.getElementById('back-to-my-profile');
        const badgeSelect = document.getElementById('badge-select');
        const container = document.querySelector('.user-autocomplete-container');

        console.log(`🔄 Selector cambió a: ${e.target.value}`);

        if (e.target.value) {
          await switchToUser(e.target.value);
        }

        // Si se selecciona un usuario diferente al actual, ocultar selector y mostrar botón "Cambiar Usuario"
        if (e.target.value && e.target.value !== getCurrentUser()) {
          if (container) {
            container.style.display = 'none';
          }
          if (backBtn) {
            backBtn.style.display = 'inline-block';
          }
        } else {
          // Mostrar selector y ocultar botón si se escoge el usuario actual o se limpia la selección
          if (container) {
            container.style.display = 'block';
          }
          const filterInput = document.getElementById('user-search-filter');
          if (filterInput) {
            filterInput.value = ''; // Limpiar query
          }
          if (backBtn) {
            backBtn.style.display = 'none';
          }
        }

        const target = e.target.value || getCurrentUser();
        try { localStorage.setItem('lastProfileUser', String(target || '')); } catch (_) { }
        populateBadgeSelectForUser(target);
      });

      document.getElementById('back-to-my-profile')?.addEventListener('click', async () => {
        const userSelect = document.getElementById('gamification-user-select');
        const backBtn = document.getElementById('back-to-my-profile');
        const container = document.querySelector('.user-autocomplete-container');

        // Mostrar el selector de nuevo
        if (userSelect) {
          userSelect.value = ''; // Resetear selección
        }

        if (container) {
          container.style.display = 'block';
        }

        const filterInput = document.getElementById('user-search-filter');
        if (filterInput) {
          filterInput.value = ''; // Limpiar query
        }

        // Ocultar botón "Cambiar Usuario"
        if (backBtn) {
          backBtn.style.display = 'none';
        }

        // Volver al usuario actual
        await switchToUser('');
      });

      // Función para reconstruir la lista flotante del buscador
      function rebuildAutocompleteDropdown() {
        const dropdown = document.getElementById('user-search-dropdown');
        const filterInput = document.getElementById('user-search-filter');
        const userSelect = document.getElementById('gamification-user-select');
        if (!dropdown || !filterInput) return;

        const query = filterInput.value.toLowerCase().trim();
        const users = window.__activeUsersList || [];
        
        dropdown.innerHTML = '';

        // Siempre añadir la opción "Selecciona un usuario" al inicio (como reset)
        const defaultItem = document.createElement('div');
        defaultItem.className = 'user-dropdown-item';
        defaultItem.textContent = '👤 Selecciona un usuario';
        defaultItem.addEventListener('click', () => {
          filterInput.value = '';
          if (userSelect) {
            userSelect.value = '';
            userSelect.dispatchEvent(new Event('change'));
          }
          dropdown.hidden = true;
        });
        dropdown.appendChild(defaultItem);

        const filtered = users.filter(name => name.toLowerCase().includes(query));

        filtered.forEach(name => {
          const item = document.createElement('div');
          item.className = 'user-dropdown-item';
          if (userSelect && userSelect.value === name) {
            item.classList.add('active');
          }
          
          item.textContent = name;
          item.addEventListener('click', () => {
            filterInput.value = name;
            if (userSelect) {
              userSelect.value = name;
              userSelect.dispatchEvent(new Event('change'));
            }
            dropdown.hidden = true;
          });
          dropdown.appendChild(item);
        });

        if (filtered.length === 0 && query !== '') {
          const noMatch = document.createElement('div');
          noMatch.className = 'user-dropdown-item no-matches';
          noMatch.textContent = '❌ Sin coincidencias';
          dropdown.appendChild(noMatch);
        }
      }

      // Escuchar entrada en el input de búsqueda de usuarios
      document.getElementById('user-search-filter')?.addEventListener('input', () => {
        rebuildAutocompleteDropdown();
        const dropdown = document.getElementById('user-search-dropdown');
        if (dropdown) dropdown.hidden = false;
      });

      // Escuchar foco para abrir la lista de inmediato
      document.getElementById('user-search-filter')?.addEventListener('focus', () => {
        rebuildAutocompleteDropdown();
        const dropdown = document.getElementById('user-search-dropdown');
        if (dropdown) dropdown.hidden = false;
      });

      // Cerrar la lista cuando se hace click fuera
      document.addEventListener('click', (e) => {
        const container = document.querySelector('.user-autocomplete-container');
        const dropdown = document.getElementById('user-search-dropdown');
        if (dropdown && container && !container.contains(e.target)) {
          dropdown.hidden = true;
        }
      });

      // Inicializar al cargar la página
      initGamification().catch(console.error);

      function getEarnedBadgesForUser(username) {
        const key = String(username || '').trim().replace(/^@/, '').toLowerCase();
        const res = [];
        const hasMember = typeof window.hasMembership === 'function' ? window.hasMembership : (s, u) => s && s.has(u);
        if (hasMember(window.superfanSet, key)) res.push('superfan');
        if (hasMember(window.z0PlatinumSet, key)) res.push('z0-platino');
        if (hasMember(window.z0VipSet, key)) res.push('z0-vip');
        if (hasMember(window.vipSet, key)) res.push('vip');
        if (hasMember(window.donadorSet, key)) res.push('donador');
        if (hasMember(window.z0FanSet, key)) res.push('z0-fan');
        return res;
      }

      function populateBadgeSelectForUser(username) {
        const select = document.getElementById('badge-select');
        if (!select) return;
        const earned = getEarnedBadgesForUser(username);
        select.innerHTML = '';
        const titles = { '': 'Ninguna', 'superfan': 'Superfan', 'z0-platino': 'z0‑Platino', 'z0-vip': 'z0‑VIP', 'vip': 'VIP', 'donador': 'Donador', 'z0-fan': 'z0‑Fan' };
        const noneOpt = document.createElement('option');
        noneOpt.value = '';
        noneOpt.textContent = titles[''];
        select.appendChild(noneOpt);
        earned.forEach(b => { const opt = document.createElement('option'); opt.value = b; opt.textContent = titles[b] || b; select.appendChild(opt); });
        const key = String(username || '').trim().toLowerCase();
        const currentSelected = (window.selectedBadgeMap && window.selectedBadgeMap[key]) || '';
        const fallback = getCurrentMembership(username);
        select.value = earned.includes(currentSelected) ? currentSelected : (earned.includes(fallback) ? fallback : '');
        select.disabled = false;
      }

      function getCurrentMembership(username) {
        const key = String(username || '').trim().replace(/^@/, '').toLowerCase();
        const hasMember = typeof window.hasMembership === 'function' ? window.hasMembership : (s, u) => s && s.has(u);
        if (hasMember(window.superfanSet, key)) return 'superfan';
        if (hasMember(window.z0PlatinumSet, key)) return 'z0-platino';
        if (hasMember(window.z0VipSet, key)) return 'z0-vip';
        if (hasMember(window.vipSet, key)) return 'vip';
        if (hasMember(window.donadorSet, key)) return 'donador';
        if (hasMember(window.z0FanSet, key)) return 'z0-fan';
        return '';
      }

      async function setUserBadgeInFirestore(username, badge) {
        const map = {
          'superfan': 'superfanUsers',
          'vip': 'vipUsers',
          'z0-vip': 'z0VipUsers',
          'z0-fan': 'z0FanUsers',
          'z0-platino': 'z0PlatinumUsers',
          'donador': 'donadorUsers'
        };
        const collections = Object.values(map);
        for (const col of collections) {
          try { await db.collection(col).doc(username).delete(); } catch (_) { }
        }
        if (!badge) return;
        const targetCol = map[badge];
        if (!targetCol) return;
        if (badge === 'donador') {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(23, 59, 59, 999);
          const expiresAt = tomorrow.toISOString();
          await db.collection(targetCol).doc(username).set({ name: username, expiresAt, createdAt: new Date().toISOString() }, { merge: true });
        } else {
          await db.collection(targetCol).doc(username).set({ name: username }, { merge: true });
        }
      }

      populateBadgeSelectForUser(getCurrentSelectedUser());

      window.getSelectedBadgeFor = function (username) {
        const map = window.selectedBadgeMap || {};
        const key = String(username || '').trim().toLowerCase();
        if (map[key]) return map[key];
        
        // Buscar en cuentas vinculadas
        const aliases = typeof getUserAliasesCombinedMap === 'function' ? getUserAliasesCombinedMap() : (window.userAliasesMap || {});
        
        // 1. TikTok handle -> Web/YouTube
        const linkedWebUser = aliases[key];
        if (linkedWebUser && map[linkedWebUser]) return map[linkedWebUser];
        
        // 2. Web/YouTube -> TikTok handle
        for (const [tiktokHandle, webUser] of Object.entries(aliases)) {
          if (webUser === key && map[tiktokHandle]) {
            return map[tiktokHandle];
          }
        }
        return '';
      }

      async function setUserSelectedBadgeInFirestore(username, badge) {
        const rawName = String(username || '').trim();
        const keyName = rawName.toLowerCase();
        await db.collection('selectedBadges').doc(keyName).set({ name: keyName, badge: badge || '' }, { merge: true });
      }

      window.applySelectedBadgeToItems = function (username) {
        const badge = getSelectedBadgeFor(username);
        document.querySelectorAll('.items .item').forEach(li => {
          const liUserRaw = (li.dataset && li.dataset.username) ? li.dataset.username : (li.querySelector('.usuario')?.textContent || '').trim();
          const liUser = String(liUserRaw || '').trim().toLowerCase();
          const key = String(username || '').trim().toLowerCase();
          if (liUser === key) {
            li.classList.remove('superfan', 'vip', 'z0-vip', 'donador', 'z0-fan', 'z0-platino');
            if (badge) li.classList.add(badge);
          }
        });
      }

      function applySelectedBadgeToAll() {
        const map = window.selectedBadgeMap || {};
        Object.keys(map).forEach(username => applySelectedBadgeToItems(username));
      }

      function subscribeSelectedBadges() {
        db.collection('selectedBadges').onSnapshot((snap) => {
          const m = {};
          snap.forEach(doc => {
            const d = doc.data();
            if (d && d.name) {
              const key = String(d.name || '').trim().toLowerCase();
              m[key] = (d.badge || '').trim();
            }
          });
          window.selectedBadgeMap = m;
          try { localStorage.setItem('selectedBadges', JSON.stringify(m)); } catch (_) { }
          applySelectedBadgeToAll();
          refreshBadgeSelectUI();
        }, (err) => { console.error('Error suscripción selectedBadges:', err); });
      }

      // Inicializar suscripción en cuanto esté definida
      try { subscribeSelectedBadges(); } catch (_) { }

      function refreshBadgeSelectUI() {
        const username = getCurrentSelectedUser();
        const key = String(username || '').trim().toLowerCase();
        populateBadgeSelectForUser(username);
        const select = document.getElementById('badge-select');
        const currentSelected = (window.selectedBadgeMap && window.selectedBadgeMap[key]) || '';
        const earned = getEarnedBadgesForUser(username);
        if (select) {
          const fallback = getCurrentMembership(username);
          select.value = earned.includes(currentSelected) ? currentSelected : (earned.includes(fallback) ? fallback : '');
        }
        try { renderEarnedBadgesForUser(username); } catch (_) { }
      }

      function renderEarnedBadgesForUser(username) {
        const el = document.getElementById('earned-badges');
        if (!el) return;
        const earned = Array.isArray(getEarnedBadgesForUser(username)) ? getEarnedBadgesForUser(username) : [];
        if (!earned.length) {
          el.innerHTML = '';
          return;
        }
        const label = {
          'z0-fan': 'z0',
          'z0-vip': 'z0Vip',
          'z0-platino': 'VIP Platino',
          'vip': 'VIP',
          'donador': 'Donador'
        };
        el.innerHTML = earned.map(b => `<span class="earned-badge-chip ${b}">${label[b] || b}</span>`).join('');
      }

      document.getElementById('badge-select')?.addEventListener('change', async (e) => {
        const target = getCurrentSelectedUser();
        const badge = e.target.value;
        const earned = getEarnedBadgesForUser(target);
        if (badge && !earned.includes(badge)) {
          showErrorNotification('Solo puedes elegir insignias que ya tienes.');
          {
            const key = String(target || '').trim().toLowerCase();
            e.target.value = (window.selectedBadgeMap && window.selectedBadgeMap[key]) || '';
          }
          return;
        }
        window.selectedBadgeMap = window.selectedBadgeMap || {};
        if (badge) {
          const key = String(target || '').trim().toLowerCase();
          window.selectedBadgeMap[key] = badge;
        } else {
          const key = String(target || '').trim().toLowerCase();
          delete window.selectedBadgeMap[key];
        }
        try { localStorage.setItem('selectedBadges', JSON.stringify(window.selectedBadgeMap)); } catch (_) { }
        applySelectedBadgeToItems(target);
        try {
          await setUserSelectedBadgeInFirestore(target, badge);
        } catch (err) { console.error('Error al actualizar insignia:', err); showErrorNotification('No se pudo actualizar la insignia.'); }
      });

      // Función para actualizar datos de gamificación de un usuario
      function updateGamificationDataForUser(username, userData) {
        try {
          const allData = JSON.parse(localStorage.getItem('gamificationData') || '{}');
          allData[username.toLowerCase()] = userData;
          localStorage.setItem('gamificationData', JSON.stringify(allData));
          console.log(`💾 Datos actualizados para usuario: ${username}`);
        } catch (error) {
          console.error('Error al actualizar datos de gamificación:', error);
        }
      }

      // ===== FUNCIONES PARA MODAL DE CONFIRMACIÓN =====

      // Variable para almacenar el resolver actual
      let currentConfirmationResolver = null;

      // Función para mostrar modal de confirmación personalizado
      function showConfirmation(options) {
        return new Promise((resolve) => {
          console.log('🔍 showConfirmation llamada con opciones:', options);

          // Verificar que los elementos existen
          if (!confirmationModal || !confirmationCancelBtn || !confirmationConfirmBtn) {
            console.error('❌ Elementos del modal de confirmación no encontrados');
            resolve(false);
            return;
          }

          // Configurar el modal
          confirmationIcon.textContent = options.icon || 'ℹ️';
          confirmationTitle.textContent = options.title || 'Confirmación';
          confirmationMessage.textContent = options.message || '¿Estás seguro?';

          // Configurar botones
          const cancelText = options.cancelText !== undefined ? options.cancelText : 'Cancelar';
          const confirmText = options.confirmText || 'Confirmar';

          // Establecer texto usando múltiples métodos para asegurar que funcione
          confirmationCancelBtn.textContent = cancelText;
          confirmationCancelBtn.innerHTML = cancelText;
          confirmationConfirmBtn.textContent = confirmText;
          confirmationConfirmBtn.innerHTML = confirmText;

          console.log('📝 Textos configurados - Cancelar:', cancelText, 'Confirmar:', confirmText);
          console.log('📝 Texto actual en botones - Cancelar:', confirmationCancelBtn.textContent, 'Confirmar:', confirmationConfirmBtn.textContent);

          // Mostrar/ocultar botón cancelar
          if (cancelText === '') {
            confirmationCancelBtn.style.display = 'none';
          } else {
            confirmationCancelBtn.style.display = 'inline-flex';
            confirmationCancelBtn.style.visibility = 'visible';
            confirmationCancelBtn.style.opacity = '1';
            confirmationCancelBtn.style.pointerEvents = 'auto';
          }

          // Asegurar que el botón confirmar sea visible
          confirmationConfirmBtn.style.display = 'inline-flex';
          confirmationConfirmBtn.style.visibility = 'visible';
          confirmationConfirmBtn.style.opacity = '1';
          confirmationConfirmBtn.style.pointerEvents = 'auto';

          // Forzar reflow para asegurar que los cambios se apliquen
          confirmationCancelBtn.offsetHeight;
          confirmationConfirmBtn.offsetHeight;

          console.log('👁️ Estilos de botones aplicados');
          console.log('Cancelar visible:', window.getComputedStyle(confirmationCancelBtn).display);
          console.log('Confirmar visible:', window.getComputedStyle(confirmationConfirmBtn).display);

          // Guardar el resolver actual
          currentConfirmationResolver = resolve;

          // Mostrar modal
          confirmationModal.hidden = false;
          console.log('✅ Modal mostrado');

          // Asegurar que los estilos se apliquen después de mostrar el modal
          setTimeout(() => {
            // Forzar visibilidad del botón cancelar
            confirmationCancelBtn.style.display = 'inline-flex';
            confirmationCancelBtn.style.visibility = 'visible';
            confirmationCancelBtn.style.opacity = '1';
            confirmationCancelBtn.style.position = 'static';
            confirmationCancelBtn.style.width = 'auto';
            confirmationCancelBtn.style.height = 'auto';

            // Forzar visibilidad del botón confirmar
            confirmationConfirmBtn.style.display = 'inline-flex';
            confirmationConfirmBtn.style.visibility = 'visible';
            confirmationConfirmBtn.style.opacity = '1';
            confirmationConfirmBtn.style.position = 'static';
            confirmationConfirmBtn.style.width = 'auto';
            confirmationConfirmBtn.style.height = 'auto';
            confirmationConfirmBtn.style.overflow = 'visible';
            confirmationConfirmBtn.style.clip = 'auto';
            confirmationConfirmBtn.style.margin = '0';
            confirmationConfirmBtn.style.padding = '10px 20px';

            // Verificar que ambos botones tengan contenido
            if (!confirmationCancelBtn.textContent.trim()) {
              confirmationCancelBtn.textContent = 'Cancelar';
            }
            if (!confirmationConfirmBtn.textContent.trim()) {
              confirmationConfirmBtn.textContent = 'Confirmar';
            }

            console.log('🔄 Estilos reaplicados después del timeout');
            console.log('Final - Cancelar visible:', window.getComputedStyle(confirmationCancelBtn).display);
            console.log('Final - Confirmar visible:', window.getComputedStyle(confirmationConfirmBtn).display);
            console.log('Final - Cancelar texto:', confirmationCancelBtn.textContent);
            console.log('Final - Confirmar texto:', confirmationConfirmBtn.textContent);
          }, 10);
        });
      }

      // Event listeners únicos para los botones (se configuran una sola vez)
      if (confirmationCancelBtn) {
        confirmationCancelBtn.addEventListener('click', (e) => {
          console.log('🔘 Botón cancelar clickeado');
          e.preventDefault();
          e.stopPropagation();
          confirmationModal.hidden = true;
          if (currentConfirmationResolver) {
            currentConfirmationResolver(false);
            currentConfirmationResolver = null;
          }
        });
        console.log('✅ Event listener para botón cancelar configurado');
      } else {
        console.error('❌ confirmationCancelBtn no encontrado');
      }

      if (confirmationConfirmBtn) {
        confirmationConfirmBtn.addEventListener('click', (e) => {
          console.log('✅ Botón confirmar clickeado');
          e.preventDefault();
          e.stopPropagation();
          confirmationModal.hidden = true;
          if (currentConfirmationResolver) {
            currentConfirmationResolver(true);
            currentConfirmationResolver = null;
          }
        });
        console.log('✅ Event listener para botón confirmar configurado');
      } else {
        console.error('❌ confirmationConfirmBtn no encontrado');
      }

      if (confirmationCloseBtn) {
        confirmationCloseBtn.addEventListener('click', (e) => {
          console.log('❌ Botón cerrar clickeado');
          e.preventDefault();
          e.stopPropagation();
          confirmationModal.hidden = true;
          if (currentConfirmationResolver) {
            currentConfirmationResolver(false);
            currentConfirmationResolver = null;
          }
        });
        console.log('✅ Event listener para botón cerrar configurado');
      } else {
        console.error('❌ confirmationCloseBtn no encontrado');
      }

      // Función para mostrar notificación de éxito
      function showSuccessNotification(message) {
        showConfirmation({
          icon: '✅',
          title: 'Éxito',
          message: message,
          confirmText: 'Entendido',
          cancelText: ''
        }).then(() => {
          // Solo cerrar el modal
        });
      }

      // Función para mostrar notificación de error
      function showErrorNotification(message) {
        showConfirmation({
          icon: '❌',
          title: 'Error',
          message: message,
          confirmText: 'Entendido',
          cancelText: ''
        }).then(() => {
          // Solo cerrar el modal
        });
      }

      // ===== FUNCIONES PARA ADMINISTRACIÓN DE RECOMPENSAS =====

      // Función para cargar y renderizar solicitudes de recompensas
      async function loadRewardRequests() {
        try {
          // const allRequests = JSON.parse(localStorage.getItem('pendingRewardRequests') || '[]');
          // Cargar desde Firestore
          const snapshot = await db.collection('rewardRequests').get();
          const allRequests = [];
          snapshot.forEach(doc => {
            allRequests.push({ id: doc.id, ...doc.data() });
          });

          const statusFilter = adminStatusFilter?.value || 'all';
          const userFilter = adminUserFilter?.value || 'all';

          // Filtrar solicitudes
          let filteredRequests = allRequests;

          if (statusFilter !== 'all') {
            filteredRequests = filteredRequests.filter(req => req.status === statusFilter);
          }

          if (userFilter !== 'all') {
            filteredRequests = filteredRequests.filter(req => req.userId === userFilter);
          }

          // Ordenar por timestamp (más recientes primero)
          filteredRequests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

          // Actualizar estadísticas
          updateAdminStats(allRequests);

          // Renderizar lista
          renderAdminRequestsList(filteredRequests);

        } catch (error) {
          console.error('Error al cargar solicitudes:', error);
          if (adminRequestsList) {
            adminRequestsList.innerHTML = '<p class="loading-message">Error al cargar solicitudes: ' + error.message + '</p>';
          }
        }
      }

      // Función para actualizar estadísticas del admin
      function updateAdminStats(allRequests) {
        const today = typeof window.getLocalDateKey === 'function' ? window.getLocalDateKey() : new Date().toDateString();

        const pending = allRequests.filter(req => req.status === 'pending').length;
        const approvedToday = allRequests.filter(req =>
          req.status === 'approved' && (typeof window.getLocalDateKey === 'function' ? window.getLocalDateKey(req.timestamp) : new Date(req.timestamp).toDateString()) === today
        ).length;
        const rejectedToday = allRequests.filter(req =>
          req.status === 'rejected' && (typeof window.getLocalDateKey === 'function' ? window.getLocalDateKey(req.timestamp) : new Date(req.timestamp).toDateString()) === today
        ).length;

        if (totalPendingRequests) totalPendingRequests.textContent = pending;
        if (totalApprovedRequests) totalApprovedRequests.textContent = approvedToday;
        if (totalRejectedRequests) totalRejectedRequests.textContent = rejectedToday;
      }

      // Función para renderizar lista de solicitudes
      function renderAdminRequestsList(requests) {
        if (!adminRequestsList) return;

        if (requests.length === 0) {
          adminRequestsList.innerHTML = '<p class="loading-message">No hay solicitudes que coincidan con los filtros</p>';
          return;
        }

        adminRequestsList.innerHTML = requests.map(request => {
          const date = new Date(request.timestamp);
          const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

          let actionButtons = '';

          if (request.status === 'pending') {
            actionButtons = `
                  <button class="admin-action-btn admin-approve-btn" onclick="approveRewardRequest('${request.id}')">
                    ✅ Aprobar
                  </button>
                  <button class="admin-action-btn admin-reject-btn" onclick="rejectRewardRequest('${request.id}')">
                    ❌ Rechazar
                  </button>
              `;
          } else if (request.status === 'approved') {
            actionButtons = `
                  <button class="admin-action-btn admin-reject-btn" onclick="rejectRewardRequest('${request.id}')">
                    🚫 Revocar (Devolver Puntos)
                  </button>
              `;
          } else if (request.status === 'rejected') {
            actionButtons = `
                  <button class="admin-action-btn admin-approve-btn" onclick="reApproveRequest('${request.id}')">
                    ✅ Reactivar (Cobrar Puntos)
                  </button>
              `;
          }

          return `
            <div class="admin-request-item" data-request-id="${request.id}">
              <div class="admin-request-info">
                <div class="admin-request-header">
                  <span class="admin-request-user">👤 ${request.userId}</span>
                  <span class="admin-request-status status-${request.status}">${getStatusText(request.status)}</span>
                </div>
                <div class="admin-request-reward">🎁 ${request.rewardName}</div>
                <div class="admin-request-details">${request.description}</div>
                <div class="admin-request-cost">💰 ${request.cost} puntos</div>
                <div class="admin-request-timestamp">📅 ${formattedDate}</div>
              </div>
              <div class="admin-request-actions">
                ${actionButtons}
              </div>
            </div>
          `;
        }).join('');
      }

      // Función para obtener texto del estado
      function getStatusText(status) {
        switch (status) {
          case 'pending': return 'Pendiente';
          case 'approved': return 'Aprobada';
          case 'rejected': return 'Rechazada';
          default: return status;
        }
      }

      // Función para poblar filtro de usuarios
      async function populateAdminUserFilter() {
        try {
          // const allRequests = JSON.parse(localStorage.getItem('pendingRewardRequests') || '[]');
          const snapshot = await db.collection('rewardRequests').get();
          const allRequests = [];
          snapshot.forEach(doc => allRequests.push(doc.data()));

          const users = [...new Set(allRequests.map(req => req.userId))].sort();

          if (adminUserFilter) {
            adminUserFilter.innerHTML = '<option value="all">Todos los usuarios</option>' +
              users.map(user => `<option value="${user}">${user}</option>`).join('');
          }
        } catch (error) {
          console.error('Error al cargar usuarios para filtro:', error);
        }
      }

      // Función para aprobar solicitud de recompensa (global)
      window.approveRewardRequest = async function (requestId) {
        try {
          const confirmed = await showConfirmation({
            icon: '✅',
            title: 'Aprobar Solicitud',
            message: '¿Confirmas que quieres aprobar esta solicitud de recompensa?',
            confirmText: 'Sí, Aprobar',
            cancelText: 'Cancelar'
          });

          if (!confirmed) return;

          const requestRef = db.collection('rewardRequests').doc(requestId);
          const doc = await requestRef.get();

          if (!doc.exists) {
            showErrorNotification('Solicitud no encontrada en base de datos');
            return;
          }

          const request = doc.data();

          // Ejecutar la recompensa según su tipo
          if (request.rewardId === 'become_fan') {
            // Agregar usuario a VIP (permanente)
            try {
              const normUser = String(request.userId).toLowerCase().replace(/^@/, '');
              // Buscar el documento del usuario en users o crear referencia directa
              await db.collection('vipUsers').doc(normUser).set({
                name: request.userId,
                addedAt: new Date().toISOString(),
                addedBy: 'reward_system'
              });
              console.log('✅ Usuario agregado a VIP:', request.userId);
            } catch (error) {
              console.error('Error al agregar usuario a VIP:', error);
              showErrorNotification('Error al procesar la recompensa. Contacta al administrador.');
              return;
            }
          }

          // Actualizar estado de la solicitud en Firestore
          await requestRef.update({
            status: 'approved',
            processedAt: new Date().toISOString()
          });

          const successMessage = request.rewardId === 'become_fan'
            ? 'Solicitud aprobada exitosamente. ¡El usuario ahora es VIP!'
            : 'Solicitud aprobada exitosamente. Los puntos ya fueron descontados.';
          showSuccessNotification(successMessage);

          // Recargar lista
          await loadRewardRequests();

        } catch (error) {
          console.error('Error al aprobar solicitud:', error);
          showErrorNotification('Error al aprobar la solicitud: ' + error.message);
        }
      }

      // Función para rechazar solicitud de recompensa (global)
      window.rejectRewardRequest = async function (requestId) {
        try {
          console.log('🚫 Iniciando rechazo de solicitud:', requestId);

          const confirmed = await showConfirmation({
            icon: '❌',
            title: 'Rechazar Solicitud',
            message: '¿Confirmas que quieres rechazar esta solicitud? Los puntos serán devueltos al usuario.',
            confirmText: 'Sí, Rechazar',
            cancelText: 'Cancelar'
          });

          console.log('✅ Resultado de confirmación:', confirmed);

          if (!confirmed) {
            console.log('❌ Usuario canceló el rechazo');
            return;
          }

          const requestRef = db.collection('rewardRequests').doc(requestId);
          const doc = await requestRef.get();

          if (!doc.exists) {
            showErrorNotification('Solicitud no encontrada en base de datos');
            return;
          }

          const request = doc.data();

          // Usar batch para actualizar solicitud y devolver puntos atómicamente
          const batch = db.batch();
          const normUser = String(request.userId).toLowerCase().replace(/^@/, '');
          const userStatsRef = db.collection('userStats').doc(normUser);

          // Devolver puntos al usuario en Firestore
          batch.set(userStatsRef, {
            totalPoints: firebase.firestore.FieldValue.increment(request.cost),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          // Actualizar estado de la solicitud en Firestore
          batch.update(requestRef, {
            status: 'rejected',
            processedAt: new Date().toISOString()
          });

          await batch.commit();

          showSuccessNotification(`Solicitud rechazada. Se devolvieron ${request.cost} puntos a ${request.userId}.`);

          // Recargar lista
          await loadRewardRequests();

        } catch (error) {
          console.error('Error al rechazar solicitud:', error);
          showErrorNotification('Error al rechazar la solicitud: ' + error.message);
        }
      }

      // Función para REACTIVAR solicitud rechazada (COBRAR PUNTOS DE NUEVO)
      window.reApproveRequest = async function (requestId) {
        try {
          const confirmed = await showConfirmation({
            icon: '✅',
            title: 'Reactivar Solicitud',
            message: '¿Confirmas que quieres CAMBIAR esta solicitud a APROBADA? Se descontarán los puntos al usuario nuevamente.',
            confirmText: 'Sí, Reactivar',
            cancelText: 'Cancelar'
          });

          if (!confirmed) return;

          const requestRef = db.collection('rewardRequests').doc(requestId);
          const doc = await requestRef.get();

          if (!doc.exists) {
            showErrorNotification('Solicitud no encontrada');
            return;
          }

          const request = doc.data();
          const cost = Number(request.cost || 0);

          // Verificar si el usuario tiene puntos suficientes para volver a pagar
          const normUser = String(request.userId).toLowerCase().replace(/^@/, '');
          const userStatsRef = db.collection('userStats').doc(normUser);
          const userDoc = await userStatsRef.get();
          const currentPoints = userDoc.exists ? (userDoc.data().totalPoints || 0) : 0;

          if (currentPoints < cost) {
            const force = await showConfirmation({
              icon: '⚠️',
              title: 'Puntos Insuficientes',
              message: `El usuario tiene ${currentPoints} puntos y el costo es ${cost}. ¿Quieres forzar el cobro (quedará en negativo)?`,
              confirmText: 'Forzar',
              cancelText: 'Cancelar'
            });
            if (!force) return;
          }

          const batch = db.batch();

          // Cobrar puntos nuevamente
          batch.set(userStatsRef, {
            totalPoints: firebase.firestore.FieldValue.increment(-cost),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          // Cambiar estado a approved
          batch.update(requestRef, {
            status: 'approved',
            processedAt: new Date().toISOString()
          });

          await batch.commit();

          showSuccessNotification(`Solicitud reactivada. Se cobraron ${cost} puntos a ${request.userId}.`);
          await loadRewardRequests(); // Recargar lista

        } catch (error) {
          console.error('Error al reactivar solicitud:', error);
          showErrorNotification('Error: ' + error.message);
        }
      };

      // Función para verificar notificaciones de admin
      function checkAdminNotifications() {
        if (!window.db) return;

        // Escuchar cambios en tiempo real solo para solicitudes pendientes
        db.collection('rewardRequests')
          .where('status', '==', 'pending')
          .onSnapshot(snapshot => {
            const count = snapshot.size;
            const badge = document.getElementById('admin-badge');

            // Actualizar conjunto global de usuarios con solicitudes pendientes
            const newPendingUsers = new Set();
            snapshot.forEach(doc => {
              const d = doc.data();
              if (d.userId) newPendingUsers.add(String(d.userId).trim().toLowerCase());
            });

            // Verificar si hubo cambios en los usuarios pendientes para re-renderizar lista
            const prevSize = window.pendingRewardUsers ? window.pendingRewardUsers.size : 0;
            const hasChanged = prevSize !== newPendingUsers.size ||
              [...newPendingUsers].some(u => !window.pendingRewardUsers.has(u));

            window.pendingRewardUsers = newPendingUsers;

            if (hasChanged) {
              console.log('🎁 Actualizando lista por cambios en solicitudes pendientes');
              // Re-renderizar lista actual para mostrar iconos
              const itemsToRender = window.currentDayItems || window.__dayItems;
              if (itemsToRender && typeof renderSolicitudes === 'function') {
                // Si hay orden manual, aplicarlo
                const ordered = typeof applyOrder === 'function' && window.currentManualOrder
                  ? applyOrder(itemsToRender, window.currentManualOrder)
                  : itemsToRender;
                renderSolicitudes(ordered);
              }
            }

            if (badge) {
              if (count > 0) {
                badge.textContent = count;
                badge.hidden = false;

                // Enviar notificación del navegador si aumentó la cuenta y tenemos permiso
                if (count > (window._lastPendingCount || 0)) {
                  sendBrowserNotification(`¡Nueva solicitud de recompensa!`, `Hay ${count} solicitudes pendientes de revisión.`);
                }
              } else {
                badge.hidden = true;
              }
            }
            window._lastPendingCount = count;
          }, err => {
            console.error("Error escuchando notificaciones admin:", err);
          });
      }

      function sendBrowserNotification(title, body) {
        if (!("Notification" in window)) return;

        if (Notification.permission === "granted") {
          new Notification(title, { body, icon: 'favicon.ico' }); // Asegúrate de tener un icono o quitar la propiedad
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then(permission => {
            if (permission === "granted") {
              new Notification(title, { body });
            }
          });
        }
      }

      // ===== FUNCIONES PARA CONFIGURACIÓN DE RECOMPENSAS =====

      function renderRewardsConfig() {
        const container = document.getElementById('rewards-config-list');
        if (!container) return;

        // Renderizar inputs sin onchange inline, usando data attributes
        container.innerHTML = REWARDS.map((r, index) => `
            <div class="reward-config-item" data-index="${index}" style="border:1px solid #ddd; padding:15px; border-radius:8px; display:flex; gap:15px; background:#fff; align-items:flex-start;">
               <div style="font-size:24px;">${r.icon}</div>
               <div style="flex:1;">
                   <div style="display:flex; gap:10px; margin-bottom:5px;">
                       <input type="text" class="form-control reward-name" value="${r.name}" placeholder="Nombre" style="font-weight:bold;">
                       <input type="number" class="form-control reward-cost" value="${r.cost}" placeholder="Costo" style="width:100px;">
                   </div>
                   <textarea class="form-control reward-desc" placeholder="Descripción" rows="2" style="width:100%; font-size:12px;">${r.description}</textarea>
                   <div style="margin-top:5px; font-size:10px; color:#666;">ID: ${r.id} (No editable)</div>
               </div>
            </div>
          `).join('');
      }

      window.saveRewardsConfig = async function () {
        if (!confirm('¿Guardar cambios en las recompensas? Esto actualizará el catálogo para todos los usuarios.')) return;

        try {
          // Reconstruir lista desde el DOM para asegurar que guardamos lo que se ve
          const container = document.getElementById('rewards-config-list');
          const items = container.querySelectorAll('.reward-config-item');
          const newRewards = [];

          items.forEach(item => {
            const index = parseInt(item.dataset.index);
            const original = REWARDS[index];
            if (original) {
              newRewards.push({
                ...original,
                name: item.querySelector('.reward-name').value,
                cost: Number(item.querySelector('.reward-cost').value),
                description: item.querySelector('.reward-desc').value
              });
            }
          });

          if (newRewards.length === 0) {
            throw new Error("No se pudieron leer los datos del formulario.");
          }

          if (window.db) {
            await window.db.collection('systemConfig').doc('rewardsConfig').set({
              list: newRewards,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              updatedBy: getCurrentUser()
            });
            // Actualizar localmente también
            REWARDS = newRewards;
            alert('✅ Configuración guardada exitosamente.');
          } else {
            alert('❌ Error: No hay conexión a base de datos.');
          }
        } catch (e) {
          console.error(e);
          alert('❌ Error al guardar: ' + e.message);
        }
      };

      // Listener para cambiar tabs (versión robusta)
      // Asegurarse de limpiar listeners anteriores si los hubiera (aunque es script inline)
      document.querySelectorAll('.admin-section-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          const target = e.currentTarget;
          const sectionId = target.dataset.section;

          // 1. UI Tabs Update
          document.querySelectorAll('.admin-section-tab').forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
          });
          target.classList.add('active');
          target.setAttribute('aria-selected', 'true');

          // 2. Hide All Sections
          document.getElementById('badges-section').hidden = true;
          document.getElementById('rewards-section').hidden = true;
          document.getElementById('rewards-config-section').hidden = true;
          document.getElementById('maintenance-section').hidden = true;
          if (document.getElementById('links-section')) document.getElementById('links-section').hidden = true;

          // 3. Show Target Section
          if (sectionId === 'badges') document.getElementById('badges-section').hidden = false;
          else if (sectionId === 'rewards') document.getElementById('rewards-section').hidden = false;
          else if (sectionId === 'rewards-config') {
            document.getElementById('rewards-config-section').hidden = false;
            renderRewardsConfig();
          }
          else if (sectionId === 'links') {
            if (document.getElementById('links-section')) {
              document.getElementById('links-section').hidden = false;
              renderAdminLinks();
            }
          }
          else if (sectionId === 'maintenance') document.getElementById('maintenance-section').hidden = false;
        });
      });

      async function renderAdminLinks() {
        const listEl = document.getElementById('admin-links-list');
        if (!listEl) return;
        listEl.innerHTML = '<div style="padding:20px; text-align:center; opacity:0.6;">Cargando vinculaciones...</div>';
        
        try {
          const map = typeof getUserAliasesCombinedMap === 'function' ? getUserAliasesCombinedMap() : (window.userAliasesMap || {});
          const entries = Object.entries(map);
          if (entries.length === 0) {
            listEl.innerHTML = '<p style="padding:20px; text-align:center; opacity:0.5;">No hay cuentas vinculadas activas.</p>';
            return;
          }
          
          let html = '';
          const groups = {};
          entries.forEach(([alias, target]) => {
            const t = target.replace(/^@/, '').toLowerCase();
            const a = alias.replace(/^@/, '').toLowerCase();
            if (!groups[t]) groups[t] = new Set();
            groups[t].add(a);
          });
          
          Object.entries(groups).forEach(([main, aliases]) => {
            html += `
              <div class="vip-item" style="flex-direction: column; align-items: flex-start; padding: 15px; background: rgba(255,255,255,0.03); border-radius: 12px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; justify-content: space-between; width: 100%; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px; margin-bottom: 10px;">
                  <span style="font-weight: 700; color: #fff; font-size: 1.1em;">💎 Principal: <span style="color: var(--accent-primary, #2563eb);">@${main}</span></span>
                  <span style="font-size: 0.85em; opacity: 0.6; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 20px;">${aliases.size} aliadas</span>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                  ${Array.from(aliases).map(a => `
                    <span class="genre-chip" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 6px; font-size: 0.9em; display: flex; align-items: center; gap: 5px;">
                      <span style="opacity:0.5;">🔗</span> @${a}
                    </span>
                  `).join('')}
                </div>
              </div>
            `;
          });
          
          listEl.innerHTML = html;
        } catch (e) {
          listEl.innerHTML = '<p style="color: #ef4444; padding:20px; text-align:center;">Error al cargar vinculaciones.</p>';
        }
      }

      // Listener para el botón de refrescar vinculaciones
      document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'refresh-links-btn') {
          renderAdminLinks();
        }
      });

      // Inicializar notificaciones al cargar
      setTimeout(checkAdminNotifications, 2000);

      // ===== FUNCIONES PARA MODAL DE CANJE DE PUNTOS =====

      // Función para renderizar el modal de recompensas
      async function renderRewardsModal() {
        console.log('🔄 Renderizando modal de recompensas...');
        const targetUser = getCurrentSelectedUser();
        const userData = getGamificationDataForUser(targetUser);
        console.log('👤 Usuario objetivo:', targetUser, 'Puntos (local):', userData.points);
        let effectivePoints = Number(userData.points || 0);
        let userStatsDoc = null;

        // Actualizar información del usuario
        rewardsUserInfo.textContent = targetUser;
        try {
          const best = await fetchBestUserStatsDoc(targetUser);
          if (best && best.data) {
            userStatsDoc = best.data;
            const cloudPoints = Number((best.data || {}).totalPoints || 0);
            effectivePoints = cloudPoints;
          }
          rewardsUserPoints.textContent = String(effectivePoints);
        } catch (_) {
          rewardsUserPoints.textContent = String(effectivePoints);
        }
        try {
          userData.points = Math.max(0, Number(effectivePoints) || 0);
          userData._cloudSyncedPoints = userData.points;
          saveGamificationDataForUser(userData, targetUser);
        } catch (_) { }

        // Renderizar las tarjetas de recompensas
        const rewardsContainer = document.getElementById('rewards-list');
        rewardsContainer.innerHTML = '';

        const now = Date.now();
        const COOLDOWN_MS = 36 * 60 * 60 * 1000; // 36 Horas

        REWARDS.forEach(reward => {
          const canAfford = effectivePoints >= reward.cost;

          // Lógica de Cooldown
          let isOnCooldown = false;
          let remainingHours = 0;

          if (userStatsDoc && userStatsDoc.lastRedeemedAt && userStatsDoc.lastRedeemedAt[reward.id]) {
            const lastTime = new Date(userStatsDoc.lastRedeemedAt[reward.id]).getTime();
            const elapsed = now - lastTime;
            if (elapsed < COOLDOWN_MS) {
              isOnCooldown = true;
              remainingHours = Math.ceil((COOLDOWN_MS - elapsed) / (1000 * 60 * 60));
            }
          }

          const rewardCard = document.createElement('div');
          rewardCard.className = `reward-card ${canAfford ? 'affordable' : 'expensive'} ${isOnCooldown ? 'cooldown-active' : ''}`;

          let btnText = canAfford ? 'Canjear' : 'Insuficiente';
          let btnDisabled = !canAfford;
          let extraInfo = '';

          if (isOnCooldown) {
            btnText = `Espera ${remainingHours}h`;
            btnDisabled = true;
            extraInfo = `<div class="reward-cooldown-info">⚠️ Esta recompensa tiene un tiempo de espera de 36 horas entre usos.</div>`;
          } else if (reward.description && (reward.description.includes('prioridad') || reward.description.includes('siguiente'))) {
            extraInfo = `<div class="reward-hint-info">ℹ️ Esta acción puede tardar unos minutos en procesarse.</div>`;
          }

          rewardCard.innerHTML = `
            <div class="reward-icon">${reward.icon}</div>
            <div class="reward-info">
              <h4 class="reward-title">${reward.name}</h4>
              <p class="reward-description">${reward.description}</p>
              <div class="reward-cost">${reward.cost} puntos</div>
              ${extraInfo}
            </div>
            <button class="reward-btn" ${btnDisabled ? 'disabled' : ''} 
                    onclick="requestReward('${reward.id}', '${targetUser}', ${reward.cost})">
              ${btnText}
            </button>
          `;

          rewardsContainer.appendChild(rewardCard);
          // ... events ...
        });

        // Renderizar solicitudes pendientes
        await renderPendingRequests(targetUser);
      }

      // Función para solicitar una recompensa (global)
      window.requestReward = async function (rewardId, username, cost) {
        console.log('🎁 Solicitando recompensa:', rewardId, 'para usuario:', username, 'costo:', cost);
        const btn = document.querySelector(`.reward-card button[onclick*="${rewardId}"]`);
        if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }

        try {
          console.log('📊 Obteniendo datos del usuario...');
          // Obtener puntos actuales de Firestore para asegurar consistencia
          const normUser = normalizeUserKey(username);
          const userDocRef = window.db.collection('userStats').doc(normUser);
          const userDoc = await userDocRef.get();

          let currentPoints = 0;
          let userLastRedeemed = {};

          if (userDoc.exists) {
            const data = userDoc.data();
            currentPoints = Number(data.totalPoints || 0);
            userLastRedeemed = data.lastRedeemedAt || {};
          } else {
            // Fallback a local si no existe en DB (aunque debería)
            const localData = getGamificationDataForUser(username);
            currentPoints = localData.points || 0;
          }

          // Validación de Cooldown en el momento del canje (doble check)
          const COOLDOWN_MS = 36 * 60 * 60 * 1000;
          if (userLastRedeemed[rewardId]) {
            const lastTime = new Date(userLastRedeemed[rewardId]).getTime();
            if (Date.now() - lastTime < COOLDOWN_MS) {
              showErrorNotification('Debes esperar 36 horas antes de canjear esto nuevamente.');
              if (btn) { btn.disabled = true; btn.textContent = 'En espera...'; }
              return;
            }
          }

          console.log('👤 Puntos actuales (DB):', currentPoints);

          if (currentPoints < cost) {
            showErrorNotification('No tienes suficientes puntos para esta recompensa.');
            if (btn) { btn.disabled = false; btn.textContent = 'Canjear'; }
            return;
          }

          console.log('🔍 Buscando recompensa en configuración...');
          const reward = REWARDS.find(r => r.id === rewardId);
          if (!reward) {
            showErrorNotification('Recompensa no encontrada.');
            if (btn) { btn.disabled = false; btn.textContent = 'Canjear'; }
            return;
          }

          // Crear solicitud de recompensa en Firestore
          const requestRef = db.collection('rewardRequests').doc();
          const requestId = requestRef.id;

          let extraFields = {};
          if (rewardId === 'roulette_spin_1' || rewardId === 'roulette_spin_3') {
            const spins = rewardId === 'roulette_spin_3' ? 3 : 1;
            const song = String(prompt('¿Qué canción quieres meter a la ruleta? (Título)', '') || '').trim();
            if (!song) {
              showErrorNotification('Canje cancelado: falta el título de la canción.');
              if (btn) { btn.disabled = false; btn.textContent = 'Canjear'; }
              return;
            }
            const artist = String(prompt('¿Qué artista? (Opcional)', '') || '').trim();
            const dayKey = (typeof window.getLocalDateKey === 'function') ? window.getLocalDateKey() : (() => {
              const d = new Date(); const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${dd}`;
            })();
            extraFields = {
              day: dayKey,
              rouletteSpinsTotal: spins,
              rouletteSpinsRemaining: spins,
              rouletteSong: song,
              rouletteArtist: artist
            };
          }

          const rewardRequest = {
            id: requestId,
            userId: username,
            userKey: normUser,
            rewardId: rewardId,
            rewardName: reward.name,
            cost: cost,
            status: 'pending',
            timestamp: new Date().toISOString(),
            description: reward.description,
            ...extraFields
          };

          // --- ACTUALIZACIÓN OPTIMISTA PREVIA ---
          // Restar visualmente antes de enviar a DB para feedback instantáneo
          const optimisticPoints = Math.max(0, currentPoints - cost);
          const pointsDisplay = document.getElementById('user-points-display');
          if (pointsDisplay) pointsDisplay.textContent = `${optimisticPoints} pts`;

          console.log('💾 Guardando solicitud en Firestore...');

          // Usar batch para actualizar solicitud y restar puntos atómicamente
          const batch = db.batch();

          // 1. Crear solicitud
          batch.set(requestRef, rewardRequest);

          // 2. Restar puntos al usuario Y ACTUALIZAR COOLDOWN
          const updatePayload = {
            totalPoints: firebase.firestore.FieldValue.increment(-cost),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          };
          // Guardar el timestamp de este canje específico
          updatePayload[`lastRedeemedAt.${rewardId}`] = new Date().toISOString();

          batch.set(userDocRef, updatePayload, { merge: true });

          await batch.commit();

          console.log('✅ Solicitud guardada y puntos descontados');

          // Actualizar localmente también para reflejo inmediato en UI
          const userData = getGamificationDataForUser(username);
          userData.points = Math.max(0, currentPoints - cost);
          userData._cloudSyncedPoints = userData.points;
          saveGamificationDataForUser(userData, username);

          // --- ACTUALIZACIÓN VISUAL CRÍTICA ---
          // Actualizar inmediatamente el header para que el usuario vea la resta de puntos
          try {
            // 1. Actualizar elemento del DOM directamente si existe
            const headerPointsEl = document.getElementById('user-points-display');
            if (headerPointsEl) headerPointsEl.textContent = `${userData.points} pts`;

            // 2. Llamar a la función oficial de actualización de UI
            await updateUserHeaderUI(username);
          } catch (e) { console.warn('Error actualizando header tras canje:', e); }

          // 3. Forzar notificación visual inmediata para el Admin (si es Admin el que está en otra pestaña)
          // Escribimos en una colección temporal o usamos un flag global si estamos en la misma sesión
          // Pero lo más importante es que al Admin le aparezca el regalo
          if (typeof checkAdminNotifications === 'function') {
            // Simular notificación localmente por si soy admin
            checkAdminNotifications();
          }

          if (rewardId === 'roulette_spin_1' || rewardId === 'roulette_spin_3') {
            showMessageModal({
              title: '🎡 Tiro(s) de ruleta comprado(s)',
              message: `Tu canje quedó registrado.\n\nTu canción solo se tocará si tu nombre sale elegido en la ruleta.\n\nSe han descontado ${cost} puntos.`
            });
          } else {
            showMessageModal({
              title: '✅ Solicitud Enviada',
              message: `Has solicitado "${reward.name}".\n\nSe han descontado ${cost} puntos. El administrador revisará tu solicitud pronto.`
            });
          }

          // Actualizar el modal
          console.log('🔄 Actualizando modal...');
          await renderRewardsModal();

        } catch (error) {
          console.error('Error al solicitar recompensa:', error);
          showMessageModal({
            title: '❌ Error',
            message: 'Error al procesar la solicitud: ' + error.message
          });
        } finally {
          // Restaurar botón (aunque el modal se actualiza)
          if (btn) { btn.disabled = false; btn.textContent = 'Canjear'; }
        }
      }

      // Función para renderizar solicitudes pendientes
      async function renderPendingRequests(username) {
        const pendingContainer = document.getElementById('pending-requests');
        if (!pendingContainer) return;

        try {
          const userKey = normalizeUserKey(username);
          const snapshot = await db.collection('rewardRequests')
            .where('status', '==', 'pending')
            .get();

          const pendingRequests = [];
          snapshot.forEach(doc => {
            const d = doc.data() || {};
            const k = d.userKey ? normalizeUserKey(d.userKey) : normalizeUserKey(d.userId);
            if (k === userKey) pendingRequests.push(d);
          });

          if (pendingRequests.length === 0) {
            pendingContainer.innerHTML = '<p>No tienes solicitudes pendientes.</p>';
            return;
          }

          pendingContainer.innerHTML = pendingRequests.map(req => `
             <div class="pending-request">
               <div class="pending-info">
                 <strong>${req.rewardName}</strong>
                 <span class="pending-cost">${req.cost} puntos</span>
               </div>
               <div class="pending-status">Pendiente de aprobación</div>
             </div>
           `).join('');

        } catch (e) {
          console.error("Error cargando solicitudes pendientes:", e);
          pendingContainer.innerHTML = '<p>Error al cargar solicitudes.</p>';
        }
      }

      // Event listeners para modal de recompensas
      rewardsOpenBtn?.addEventListener('click', async () => {
        console.log('🎁 Abriendo modal de recompensas...');
        closeMenu();
        hideSearchResults();
        currentSelectedUser = getCurrentUser();
        console.log('👤 Usuario actual:', currentSelectedUser);
        await populateRewardsUserSelector();
        await renderRewardsModal();
        rewardsModal.hidden = false;
        console.log('✅ Modal de recompensas abierto');
      });

      rewardsCloseBtn?.addEventListener('click', () => {
        rewardsModal.hidden = true;
      });

      // Event listener para selector de usuario en recompensas
      rewardsUserSelect?.addEventListener('change', async (e) => {
        currentSelectedUser = e.target.value || getCurrentUser();
        await renderRewardsModal();
      });

      // ===== EVENT LISTENERS PARA ADMINISTRACIÓN DE RECOMPENSAS =====

      // Filtros de administración (integrada en panel admin)
      adminStatusFilter?.addEventListener('change', loadRewardRequests);
      adminUserFilter?.addEventListener('change', loadRewardRequests);
      refreshRequestsBtn?.addEventListener('click', async () => {
        await populateAdminUserFilter();
        await loadRewardRequests();
      });

      // Función para poblar el selector de usuarios del modal de recompensas
      async function populateRewardsUserSelector() {
        if (!rewardsUserSelect) {
          console.log('❌ No se encontró el selector de usuarios de recompensas');
          return;
        }

        try {
          const set = new Set();

          try {
            const allSolicitudes = await getAllCombinedSolicitudes({ allTime: (typeof allTime !== 'undefined' ? allTime : false) });
            (allSolicitudes || []).forEach(s => {
              const u = String(s?.usuario || '').trim();
              if (u) set.add(u);
            });
          } catch (_) { }

          try {
            const cached = JSON.parse(localStorage.getItem('knownUsers') || '[]') || [];
            cached.forEach(name => {
              const u = String(name || '').trim();
              if (u) set.add(u);
            });
          } catch (_) { }

          try {
            const dbRef = window.db || db;
            if (dbRef) {
              const statsSnap = await dbRef.collection('userStats').get();
              statsSnap.forEach(doc => { if (doc.id) set.add(String(doc.id).trim()); });
            }
          } catch (_) { }

          try {
            const dbRef = window.db || db;
            if (dbRef) {
              const usersSnap = await dbRef.collection('users').get();
              usersSnap.forEach(doc => {
                const d = doc.data() || {};
                if (d.name) set.add(String(d.name).trim());
              });
            }
          } catch (_) { }

          const users = Array.from(set);

          users.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

          // Construir opciones del selector
          const options = '<option value="">Selecciona un usuario</option>' +
            users.map(user => `<option value="${user}">${user}</option>`).join('');

          rewardsUserSelect.innerHTML = options;

          // Si no hay usuarios, mostrar mensaje
          if (users.length === 0) {
            rewardsUserSelect.innerHTML = '<option value="">No hay usuarios disponibles</option>';
          }
        } catch (error) {
          console.error('Error al cargar usuarios para recompensas:', error);
          // Fallback a localStorage si hay error
          const solicitudes = JSON.parse(localStorage.getItem('solicitudes') || '[]');
          const users = [...new Set(solicitudes
            .map(s => s.usuario)
            .filter(user => user && user.trim() !== '')
          )];

          users.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

          const options = '<option value="">Selecciona un usuario</option>' +
            users.map(user => `<option value="${user}">${user}</option>`).join('');

          rewardsUserSelect.innerHTML = options;
        }
      }

      // Función para forzar actualización de todos los usuarios
      async function forceUpdateAllUsers() {
        try {
          console.log('🚀 INICIANDO ACTUALIZACIÓN FORZADA DE TODOS LOS USUARIOS...');

          // Obtener todos los usuarios únicos de Firebase
          const allSolicitudes = await getAllCombinedSolicitudes({ allTime: (typeof allTime !== 'undefined' ? allTime : false) });
          const users = [...new Set(allSolicitudes
            .map(s => s.usuario)
            .filter(user => user && user.trim() !== '')
          )];

          console.log(`📊 Encontrados ${users.length} usuarios únicos`);

          // Limpiar datos de gamificación para forzar recálculo
          const allData = JSON.parse(localStorage.getItem('gamificationData') || '{}');

          // Procesar cada usuario
          for (const username of users) {
            // Marcar como no procesado para forzar recálculo
            if (allData[username.toLowerCase()]) {
              delete allData[username.toLowerCase()].autoProcessed;
            }

            await analyzeAndGrantPointsForUser(username, { allTime: true });
          }

          console.log('✅ Actualización completa de usuarios terminada');

          // Actualizar el modal si está abierto
          if (gamificationModal && !gamificationModal.hidden) {
            await renderGamificationModal();
            await populateUserSelector();
          }

        } catch (error) {
          console.error('❌ Error en actualización forzada:', error);
        }
      }

      // Función para calcular y guardar estadísticas globales
      async function calculateAndSaveGlobalStats() {
        if (!window.db) return;
        
        // FIX: Proteger para que solo el Admin calcule las estadísticas masivas.
        // Si miles de usuarios regulares calcularan esto, Firebase agotaría sus lecturas gratuitas en minutos.
        const isAdminAuthenticated = localStorage.getItem('isAdminAuthenticated') === 'true';
        const isAdminMode = localStorage.getItem('isAdminMode') === 'true';
        if (!isAdminAuthenticated && !isAdminMode) {
            console.log("🔒 Omitiendo recálculo masivo global (No es Admin)");
            return;
        }

        try {
          console.log("📊 Calculando estadísticas globales maestras...");

          // NUEVO: Leer historial de canciones reproducidas (HISTORIA REAL)
          // Y las solicitudes para enriquecer con metadata (género, etc.) y userStats en paralelo
          const [playedSnapshot, solicitudesSnapshot, systemEventsSnapshot, userStatsSnapshot] = await Promise.all([
            window.db.collection('playedSongs').get().catch(() => null),
            window.db.collection('solicitudes').get(),
            window.db.collection('systemEvents').where('type', '==', 'togglePlayed').get(),
            window.db.collection('userStats').get().catch(() => null)
          ]);

          console.log(`📚 Leídos ${systemEventsSnapshot ? systemEventsSnapshot.size : 0} eventos, ${solicitudesSnapshot ? solicitudesSnapshot.size : 0} solicitudes y ${userStatsSnapshot ? userStatsSnapshot.size : 0} userStats.`);

          // 1. Construir un buscador dinámico de prefijos de usuarios conocidos
          const knownUsers = new Set();
          if (userStatsSnapshot) {
            userStatsSnapshot.forEach(doc => {
              const d = doc.data() || {};
              const name = String(d.displayName || doc.id || '').trim();
              if (name) knownUsers.add(name);
            });
          }
          if (solicitudesSnapshot) {
            solicitudesSnapshot.forEach(doc => {
              const d = doc.data() || {};
              const name = String(d.usuario || d.displayName || '').trim();
              if (name) knownUsers.add(name);
            });
          }
          if (systemEventsSnapshot) {
            systemEventsSnapshot.forEach(doc => {
              const d = doc.data() || {};
              const name = String(d.usuario || d.displayName || '').trim();
              if (name) knownUsers.add(name);
            });
          }

          const cleanForId = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
          const userMapping = Array.from(knownUsers)
            .map(u => ({ original: u, clean: cleanForId(u) }))
            .filter(item => item.clean.length > 0)
            .sort((a, b) => b.clean.length - a.clean.length);

          const findUserForId = (sId) => {
            const cleanId = String(sId || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
            for (const item of userMapping) {
              if (cleanId.startsWith(item.clean)) {
                return item.original;
              }
            }
            return null;
          };

          // 2. Construir Mapa de Metadatos Maestro (Fusión de fuentes)
          const masterMetaMap = {};
          const artistToGenre = {}; // Mapa para inferir géneros
          
          const fillMaps = (d, sId) => {
            if (!sId) return;
            const aRaw = String(d.artista || '').trim();
            const gRaw = String(d.genre || d.genero || '').trim();
            const a = normalizeKeyTextForTicker(aRaw);
            
            // FILTRO DE BASURA: No procesar si el artista es inválido (ej: URL)
            if (window.isInvalid(aRaw)) return;

            if (!window.isInvalid(gRaw) && !artistToGenre[a]) {
              artistToGenre[a] = gRaw;
            }

            if (d.artista && d.cancion) {
              masterMetaMap[sId] = {
                artista: aRaw,
                cancion: String(d.cancion).trim(),
                usuario: String(d.usuario || d.displayName || '').trim(),
                genre: gRaw
              };
            }
          };

          // Fuente A: Solicitudes actuales
          solicitudesSnapshot.forEach(doc => fillMaps(doc.data() || {}, String(doc.id || '').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()));

          // Fuente B: Historial de Eventos (Recuperar metadata de canciones ya borradas)
          systemEventsSnapshot.forEach(doc => fillMaps(doc.data() || {}, String(doc.data()?.songId || doc.id || '').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()));

          console.log(`🧠 Mapa de metadatos consolidado: ${Object.keys(masterMetaMap).length} canciones identificadas.`);
          console.log(`🏷️ Diccionario de géneros por artista: ${Object.keys(artistToGenre).length} géneros mapeados.`);

          let totalRequests = 0;
          let totalTodayRequests = 0;
          const today = new Date().toISOString().split('T')[0];

          const artistCount = {};
          const userCount = {};
          const songCount = {};
          const genreCount = {};
          const artistOriginal = {};
          const userOriginal = {};
          const processedIds = new Set(); // Para evitar doble conteo

          const processItem = (sId, meta) => {
            if (!sId || processedIds.has(sId)) return;
            processedIds.add(sId);
            totalRequests++;

            const aRaw = meta.artista || '';
            const sRaw = meta.cancion || '';
            let uRaw = meta.usuario || '';
            let gRaw = meta.genre || '';

            // Intentar reconstruir el usuario a partir del songId si no viene en los metadatos
            if (!uRaw) {
              uRaw = findUserForId(sId) || '';
            }

            // FILTRO ADICIONAL: Omitir si el usuario reconstruido es inválido
            if (window.isInvalid(uRaw)) return;
            if (aRaw && window.isInvalid(aRaw)) return;
            if (sRaw && window.isInvalid(sRaw)) return;

            const a = normalizeKeyTextForTicker(aRaw);
            const s = normalizeKeyTextForTicker(sRaw);
            const u = normalizeUserKey(uRaw);

            // Inferencia de género: si no tiene, buscamos si ya conocemos el género de este artista
            if (!window.isInvalid(gRaw)) {
              if (!artistToGenre[a]) artistToGenre[a] = gRaw.trim();
            } else if (artistToGenre[a]) {
              gRaw = artistToGenre[a];
            }
            const g = gRaw.trim().toLowerCase();

            if (!window.isInvalid(a)) {
              artistCount[a] = (artistCount[a] || 0) + 1;
              if (!artistOriginal[a]) artistOriginal[a] = aRaw.trim();
            }
            if (!window.isInvalid(s)) {
              songCount[s] = (songCount[s] || 0) + 1;
            }
            if (u && !window.isInvalid(u)) {
              userCount[u] = (userCount[u] || 0) + 1;
              if (!userOriginal[u]) userOriginal[u] = uRaw.trim();
            }
            if (!window.isInvalid(g)) {
              genreCount[g] = (genreCount[g] || 0) + 1;
            }
          };

          // 2. Contar canciones reproducidas (Historial)
          if (playedSnapshot) {
            playedSnapshot.forEach(doc => {
              if (doc.id === 'userTotals' || doc.id === '__userTotals__') return;
              const d = doc.data() || {};
              const songArr = Array.isArray(d.songs) ? d.songs : (Array.isArray(d.list) ? d.list : []);
              const skippedArr = Array.isArray(d.skipped) ? d.skipped : [];
              
              const isToday = doc.id === today;

              songArr.forEach(fullId => {
                if (skippedArr.includes(fullId)) return; // Ignorar canciones saltadas (skip)
                const sId = String(fullId || '').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
                const meta = masterMetaMap[sId] || {};
                processItem(sId, meta);
                if (isToday) totalTodayRequests++;
              });
            });
          }

          // 3. Contar solicitudes actuales (Cola) - Solo para el contador del día de hoy
          solicitudesSnapshot.forEach(doc => {
            const d = doc.data() || {};
            if (d.day === today) totalTodayRequests++;
          });

          console.log(`📊 Auditoría final: ${totalRequests} peticiones únicas procesadas.`);

          // Calcular Tops
          // Para el Top Usuarios: Solo contar si el usuario tiene nombre válido
          // Excluir "N/D" o usuarios vacíos

          const topArtists = Object.keys(artistCount)
            .map(k => ({ k, c: artistCount[k], o: artistOriginal[k] || k }))
            .filter(a => a.k && a.k.length > 1 && a.k !== 'undefined' && a.k !== 'null')
            .sort((a, b) => b.c - a.c)
            .slice(0, 10);

          const topUsers = Object.keys(userCount)
            .map(k => ({ k, c: userCount[k], o: userOriginal[k] || k }))
            .filter(u => u.k && u.k !== 'undefined' && u.k !== 'null' && u.k.length > 1)
            .sort((a, b) => b.c - a.c)
            .slice(0, 10);

          try {
            const aggregatedPoints = new Map();
            if (userStatsSnapshot) {
              userStatsSnapshot.forEach(doc => {
                const d = doc.data() || {};
                const rawName = String(d.displayName || doc.id || '').trim();
                const normKey = normalizeUserKey(rawName);
                if (!normKey || normKey === 'prueba' || normKey === 'test' || normKey.startsWith('prueba')) return;

                const pts = Number(d.totalPoints || 0);
                if (!Number.isFinite(pts) || pts <= 0) return;

                if (aggregatedPoints.has(normKey)) {
                  const existing = aggregatedPoints.get(normKey);
                  existing.points = Math.max(existing.points, pts);
                } else {
                  aggregatedPoints.set(normKey, { user: rawName, points: pts });
                }
              });
            }
            pointsUsers = Array.from(aggregatedPoints.values());

            let topLikerName = 'N/D';
            let topLikerCountVal = 0;
            let globalTotalLikes = 0;
            try {
              let maxL = 0;
              let maxLk = '';
              userStatsSnapshot.forEach(doc => {
                const ud = doc.data() || {};
                const rawName = String(ud.displayName || doc.id || '').trim();
                const normKey = normalizeUserKey(rawName);
                if (!normKey || normKey === 'prueba' || normKey === 'test' || normKey.startsWith('prueba')) return;

                const lCount = Number(ud.totalLikes || 0);
                globalTotalLikes += lCount;
                if (lCount > maxL) {
                  maxL = lCount;
                  maxLk = String(ud.displayName || doc.id || '').trim();
                }
              });
              if (maxLk) {
                topLikerName = maxLk;
                topLikerCountVal = maxL;
              }
            } catch (e) { console.warn("Error calculando Top Liker:", e); }

            pointsUsers.sort((a, b) => b.points - a.points || a.user.localeCompare(b.user));
            const topPoints10 = pointsUsers.slice(0, 10).map(it => `${it.user} (${it.points})`);

            let topSongName = 'N/D';
            let topSongCountVal = 0;
            let maxS = 0;
            let maxSk = '';
            for (let k in songCount) {
              if (k && k.length > 1 && k !== 'undefined' && k !== 'null') {
                if (songCount[k] > maxS) {
                  maxS = songCount[k];
                  maxSk = k;
                }
              }
            }
            if (maxSk) {
              topSongName = maxSk.replace(/\b\w/g, l => l.toUpperCase());
              topSongCountVal = maxS;
            }

            const topSongsFull = Object.entries(songCount)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([name, count]) => [name.replace(/\b\w/g, l => l.toUpperCase()), count]);

            let topGenreName = 'N/D';
            let topGenreCountVal = 0;
            let maxG = 0;
            let maxGk = '';
            for (let k in genreCount) {
              if (genreCount[k] > maxG) {
                maxG = genreCount[k];
                maxGk = k;
              }
            }
            if (maxGk) {
              topGenreName = maxGk.replace(/\b\w/g, l => l.toUpperCase());
              topGenreCountVal = maxG;
            }

            const topGenresFull = Object.entries(genreCount)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([name, count]) => [name.replace(/\b\w/g, l => l.toUpperCase()), count]);

            const globalStatsData = {
              totalRequests,
              totalTodayRequests,
              topArtists: topArtists.map(it => `${it.o} (${it.c})`),
              topArtistsFull: topArtists.map(it => ({ name: it.o, count: it.c })),
              topUsers: topUsers.map(it => `${it.o} (${it.c})`),
              topUsersFull: topUsers.map(it => ({ name: it.o, count: it.c })),
              topPoints10,
              topSong: topSongName,
              topSongCount: topSongCountVal,
              topSongsFull: topSongsFull.map(([n, c]) => ({ name: n, count: c })),
              topGenre: topGenreName,
              topGenreCount: topGenreCountVal,
              topGenresFull: topGenresFull.map(([n, c]) => ({ name: n, count: c })),
              topLiker: topLikerName,
              topLikerCount: topLikerCountVal,
              totalLikes: globalTotalLikes,
              distinctUsers: Object.keys(userCount).filter(k => k && k.length > 1 && k !== 'undefined' && k !== 'null').length,
              distinctArtists: Object.keys(artistCount).filter(k => k && k.length > 1 && k !== 'undefined' && k !== 'null').length,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Usar merge: true para no borrar datos que otros procesos (como el bot) hayan escrito
            await window.db.collection('globalStats').doc('general').set(globalStatsData, { merge: true });
            console.log("✅ Estadísticas globales guardadas en 'globalStats/general'");

            // Guardar el desglose COMPLETO por usuario para sincronizar perfiles personales
            try {
              await window.db.collection('globalStats').doc('userTotals').set({ 
                totals: userCount,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
              console.log("✅ Desglose de totales por usuario sincronizado.");
            } catch (e) {
              console.warn("Error sincronizando userTotals:", e);
            }

          } catch (e) {
            console.warn("⚠️ No se pudo leer userStats para estadísticas globales:", e);
          }
        } catch (e) {
          console.error("Error calculando estadísticas globales:", e);
        }
      }

      // Análisis periódico cada 5 minutos
      setInterval(() => {
        analyzeNewUsersAutomatically().catch(console.error);

        // Sincronizar usuario actual automáticamente si está logueado
        const currentUser = getCurrentUser();
        if (currentUser) {
          // Sincronizar en segundo plano sin bloquear
          syncGamificationDataWithCloud(currentUser).catch(() => { });
        }

        // Recalcular estadísticas globales compartidas desde Firestore.
        // Ya no dependemos de que el panel admin esté abierto para mantener
        // la banda sincronizada entre usuarios.
        calculateAndSaveGlobalStats();
      }, 5 * 60 * 1000); // 5 minutos

      // Sincronización inicial al cargar la página
      setTimeout(() => {
        const currentUser = getCurrentUser();
        if (currentUser) {
          console.log('🔄 Sincronizando datos iniciales con la nube...');
          syncGamificationDataWithCloud(currentUser).catch(console.error);
        }
        calculateAndSaveGlobalStats().catch(console.error);
      }, 5000); // Esperar un poco a que cargue todo (5s)

      [statsModal, themeModal, gamificationModal, confirmationModal].forEach(modal => {
        modal?.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.hidden = true;
          }
        });
      });

      // ===== GESTIÓN DE ALIAS (ADMIN) =====
      async function addAdminAlias() {
        const aliasInput = document.getElementById('alias-input-alias');
        const realInput = document.getElementById('alias-input-real');

        const alias = aliasInput.value.trim().replace(/^@/, '').toLowerCase();
        const real = realInput.value.trim();

        if (!alias || !real) {
          alert('Por favor ingresa ambos nombres.');
          return;
        }

        if (alias === real.toLowerCase()) {
          alert('El alias y el usuario principal no pueden ser iguales.');
          return;
        }

        if (!confirm(`¿Vincular "${alias}" -> "${real}"? \nLos puntos de "${alias}" se sumarán a "${real}".`)) return;

        try {
          // Actualizar mapa local
          USER_ALIASES_MAP[alias] = real;

          // Guardar en Firestore (solo el campo nuevo)
          if (window.db) {
            await window.db.collection('systemConfig').doc('userAliases').set({
              [alias]: real
            }, { merge: true });

            alert('✅ Usuario vinculado correctamente.');
            aliasInput.value = '';
            realInput.value = '';
            renderAdminAliasList();
          }
        } catch (e) {
          console.error(e);
          alert('Error al guardar: ' + e.message);
        }
      }

      async function deleteAdminAlias(aliasKey) {
        if (!confirm(`¿Eliminar vinculación para "${aliasKey}"?`)) return;

        try {
          delete USER_ALIASES_MAP[aliasKey];
          if (window.db) {
            await window.db.collection('systemConfig').doc('userAliases').update({
              [aliasKey]: firebase.firestore.FieldValue.delete()
            });
            renderAdminAliasList();
          }
        } catch (e) {
          console.error(e);
          alert('Error al eliminar: ' + e.message);
        }
      }

      function renderAdminAliasList() {
        const container = document.getElementById('admin-alias-list-container');
        if (!container) return;

        const aliases = Object.keys(USER_ALIASES_MAP).sort();

        if (aliases.length === 0) {
          container.innerHTML = '<p style="text-align: center; color: #666; font-size: 12px;">No hay usuarios vinculados.</p>';
          return;
        }

        let html = '<table style="width:100%; font-size:12px; border-collapse: collapse;">';
        html += '<thead><tr style="text-align:left; color:#aaa; border-bottom:1px solid #444;"><th>Alias (TikTok/Otro)</th><th>Usuario Principal</th><th>Acción</th></tr></thead><tbody>';

        aliases.forEach(alias => {
          const real = USER_ALIASES_MAP[alias];
          html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 8px; color: #facc15;">@${alias}</td>
                  <td style="padding: 8px; font-weight: bold;">${real}</td>
                  <td style="padding: 8px;">
                    <button onclick="deleteAdminAlias('${alias}')" style="background:none; border:none; cursor:pointer; font-size:14px;" title="Desvincular">🗑️</button>
                  </td>
                </tr>
              `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
      }

      // Listener para cargar la lista al abrir el tab
      document.querySelectorAll('.points-tab[data-tab="aliases"]').forEach(btn => {
        btn.addEventListener('click', renderAdminAliasList);
      });

      // Cargar tema al iniciar
      loadSavedTheme();

      // Inicializar funcionalidad de canciones reproducidas
      initializePlayedSongs().catch(console.error);

      // Funciones globales para gestión del modo Admin/DJ
      window.checkDJStatus = function () {
        const isDJ = isDJDevice();
        const deviceId = localStorage.getItem('djDeviceId');
        const isAuthenticated = localStorage.getItem('isAdminAuthenticated') === 'true';
        return { isDJ, deviceId, isAuthenticated };
      };



      // Función para resetear el sistema de DJ principal (útil si necesitas cambiar de dispositivo)
      window.resetDJSystem = async function () {
        try {
          // Eliminar configuración de Firebase
          if (window.db) {
            await window.db.collection('systemConfig').doc('djConfig').delete();
          }
        } catch (error) {
          // Continuar aunque falle la eliminación de Firebase
        }

        // Limpiar localStorage
        localStorage.removeItem('deviceFingerprint');
        localStorage.removeItem('isMasterDJDevice');
        localStorage.removeItem('masterDJRegistered');
        localStorage.removeItem('djDeviceId');
        localStorage.removeItem('masterDJFingerprint');
        location.reload();
      };

      // Función global para testing desde la consola
      window.testPlayedSongs = function () {
        console.log('🧪 Iniciando prueba de canciones reproducidas...');

        const items = document.querySelectorAll('.item');
        console.log(`Encontradas ${items.length} canciones en la página`);

        if (items.length > 0) {
          const firstItem = items[0];
          console.log('Probando clic en la primera canción:', firstItem.textContent.trim());

          // Simular clic
          firstItem.click();

          // Verificar si se agregó la clase 'played'
          setTimeout(() => {
            const hasPlayedClass = firstItem.classList.contains('played');
            console.log(`¿Tiene clase 'played'? ${hasPlayedClass}`);

            // Forzar estilos para asegurar que se vean
            forcePlayedSongStyles();

            // Verificar estilos aplicados
            const computedStyles = window.getComputedStyle(firstItem);
            console.log('Estilos aplicados:', {
              backgroundColor: computedStyles.backgroundColor,
              color: computedStyles.color,
              opacity: computedStyles.opacity
            });

            if (hasPlayedClass) {
              console.log('✅ ¡La funcionalidad está funcionando correctamente!');
              console.log('💡 Si no ves los colores, ejecuta: forcePlayedSongStyles()');
            } else {
              console.log('❌ La funcionalidad no está funcionando. Revisa la consola para errores.');
            }
          }, 200);
        } else {
          console.log('❌ No se encontraron canciones para probar');
        }
      };

      // Función de prueba para el calendario de rachas
      window.testStreakCalendar = async function (username) {
        console.log('🧪 === PRUEBA DEL CALENDARIO DE RACHAS ===');

        try {
          const user = username || getCurrentSelectedUser() || getCurrentUser();
          console.log(`👤 Probando calendario para: ${user}`);

          // Verificar que el contenedor existe
          const container = document.getElementById('streak-calendar-grid');
          if (!container) {
            console.error('❌ Contenedor streak-calendar-grid no encontrado');
            return;
          }
          console.log('✅ Contenedor encontrado');

          // Obtener datos del usuario
          const userData = getGamificationDataForUser(user);
          console.log('📊 Datos del usuario:', userData);

          // Probar función de actividad
          const activity = await getUserActivityForDays(user, 28);
          console.log('📅 Actividad de últimos 28 días:', activity);

          // Renderizar calendario
          await renderStreakCalendarForUser(userData.streaks?.calendar || {});

          console.log('✅ Calendario renderizado exitosamente');

        } catch (error) {
          console.error('❌ Error en prueba del calendario:', error);
        }
      };

      // Función específica para probar datos de actividad
      window.testActivityData = async function (username) {
        console.log('🔍 === PRUEBA DE DATOS DE ACTIVIDAD ===');

        try {
          const user = username || getCurrentSelectedUser() || getCurrentUser();
          console.log(`👤 Usuario: ${user}`);

          // Verificar localStorage
          const localData = JSON.parse(localStorage.getItem('solicitudes') || '[]');
          console.log(`💾 Total solicitudes en localStorage: ${localData.length}`);

          const normUser = normalizeUserKey(user);
          const userSongs = localData.filter(s => normalizeUserKey(s.usuario) === normUser);
          console.log(`🎵 Canciones del usuario: ${userSongs.length}`);

          // Mostrar algunas canciones recientes
          const recentSongs = userSongs.slice(-5);
          console.log('🕒 Últimas 5 canciones:', recentSongs.map(s => ({
            cancion: s.cancion,
            artista: s.artista,
            day: s.day,
            time: s.time
          })));

          // Probar función de actividad
          const activity = await getUserActivityForDays(user, 7);
          console.log('📊 Actividad últimos 7 días:', activity);

          // Verificar si hay actividad hoy
          const today = new Date().toISOString().split('T')[0];
          console.log(`📅 Actividad hoy (${today}): ${activity[today] || 0} canciones`);

        } catch (error) {
          console.error('❌ Error probando datos de actividad:', error);
        }
      };

      // Función para forzar la renderización del calendario con datos de prueba
      window.forceCalendarRender = async function (username) {
        console.log('🔧 === FORZANDO RENDERIZACIÓN DEL CALENDARIO ===');

        try {
          const user = username || getCurrentSelectedUser() || getCurrentUser();
          console.log(`👤 Usuario: ${user}`);

          const container = document.getElementById('streak-calendar-grid');
          if (!container) {
            console.error('❌ Contenedor no encontrado');
            return;
          }

          // Crear datos de prueba para hoy
          const today = new Date().toISOString().split('T')[0];
          const testActivity = {
            [today]: 5  // 5 canciones hoy
          };

          console.log('🧪 Usando datos de prueba:', testActivity);

          // Generar HTML manualmente
          const testHTML = `
            <div class="calendar-day activity-medium today" title="${today} - 5 canciones (Activo)">
              ${new Date().getDate()}
            </div>
            <div class="calendar-day activity-low" title="Ayer - 2 canciones">
              ${new Date(Date.now() - 86400000).getDate()}
            </div>
            <div class="calendar-day" title="Sin actividad">
              ${new Date(Date.now() - 2 * 86400000).getDate()}
            </div>
          `;

          container.innerHTML = testHTML;
          console.log('✅ HTML de prueba insertado');

          // Verificar estilos aplicados
          setTimeout(() => {
            const days = container.querySelectorAll('.calendar-day');
            days.forEach((day, index) => {
              const styles = window.getComputedStyle(day);
              console.log(`🎨 Día ${index + 1}:`, {
                classes: day.className,
                backgroundColor: styles.backgroundColor,
                color: styles.color,
                border: styles.border
              });
            });
          }, 100);

        } catch (error) {
          console.error('❌ Error forzando renderización:', error);
        }
      };

      // Función para verificar estilos CSS
      window.checkCalendarStyles = function () {
        console.log('🎨 === VERIFICANDO ESTILOS CSS ===');

        const testDiv = document.createElement('div');
        testDiv.className = 'calendar-day activity-medium today';
        testDiv.style.position = 'absolute';
        testDiv.style.top = '-1000px';
        document.body.appendChild(testDiv);

        const styles = window.getComputedStyle(testDiv);
        console.log('🔍 Estilos de prueba:', {
          backgroundColor: styles.backgroundColor,
          color: styles.color,
          border: styles.border,
          transform: styles.transform
        });

        document.body.removeChild(testDiv);
      };

      // Función para verificar usuarios disponibles en Firebase
      window.verificarUsuariosFirebase = async function () {
        console.log('🔍 VERIFICANDO USUARIOS DISPONIBLES EN FIREBASE');
        console.log('================================================');

        if (!window.db) {
          console.log('❌ Firebase no está disponible');
          return;
        }

        const collectionNames = ['requests', 'solicitudes', 'songs', 'canciones'];
        const allUsers = new Set();

        for (const collectionName of collectionNames) {
          try {
            console.log(`📂 Revisando colección: ${collectionName}`);
            const snapshot = await window.db.collection(collectionName).limit(100).get();

            if (!snapshot.empty) {
              console.log(`✅ ${collectionName}: ${snapshot.size} documentos`);

              snapshot.forEach(doc => {
                const data = doc.data();
                const user = data.usuario || data.user || data.nombre || data.name;
                if (user) {
                  allUsers.add(user);
                }
              });
            } else {
              console.log(`⚠️ ${collectionName}: vacía`);
            }
          } catch (error) {
            console.log(`❌ Error con ${collectionName}:`, error.message);
          }
        }

        const usersList = Array.from(allUsers).sort();
        console.log(`👥 USUARIOS ENCONTRADOS (${usersList.length} total):`);
        usersList.forEach((user, index) => {
          console.log(`   ${index + 1}. "${user}"`);
        });

        const currentUser = getCurrentUser();
        const userExists = usersList.some(user =>
          user.toLowerCase().trim().replace(/^@/, '') === currentUser.toLowerCase().trim().replace(/^@/, '')
        );

        console.log(`🎯 Usuario actual: "${currentUser}"`);
        console.log(`✅ ¿Usuario actual existe en Firebase? ${userExists ? 'SÍ' : 'NO'}`);

        if (!userExists && usersList.length > 0) {
          console.log(`💡 Sugerencia: Prueba con uno de estos usuarios:`);
          usersList.slice(0, 5).forEach(user => {
            console.log(`   - "${user}"`);
          });
        }

        return {
          totalUsers: usersList.length,
          users: usersList,
          currentUser: currentUser,
          currentUserExists: userExists
        };
      };

      // Función de diagnóstico completo del calendario
      window.diagnosticoCalendario = function () {
        console.log('🔍 DIAGNÓSTICO COMPLETO DEL CALENDARIO');
        console.log('=====================================');

        // 1. Verificar contenedor
        const container = document.getElementById('streak-calendar-grid');
        console.log(`📦 Contenedor encontrado: ${container ? '✅' : '❌'}`);

        if (!container) return;

        // 2. Verificar días
        const days = container.querySelectorAll('.calendar-day');
        console.log(`📅 Total días: ${days.length}`);

        // 3. Contar actividad
        const activityCounts = {
          sinActividad: container.querySelectorAll('.calendar-day:not(.activity-low):not(.activity-medium):not(.activity-high):not(.activity-very-high)').length,
          low: container.querySelectorAll('.activity-low').length,
          medium: container.querySelectorAll('.activity-medium').length,
          high: container.querySelectorAll('.activity-high').length,
          veryHigh: container.querySelectorAll('.activity-very-high').length
        };

        console.log('📊 Distribución detallada:', activityCounts);

        // 4. Verificar variables CSS
        const rootStyles = getComputedStyle(document.documentElement);
        const cssVars = {
          'activity-low': rootStyles.getPropertyValue('--activity-low').trim(),
          'activity-medium': rootStyles.getPropertyValue('--activity-medium').trim(),
          'activity-high': rootStyles.getPropertyValue('--activity-high').trim(),
          'activity-very-high': rootStyles.getPropertyValue('--activity-very-high').trim()
        };

        console.log('🎨 Variables CSS:', cssVars);

        // 5. Verificar días con actividad
        let diasConActividad = 0;
        let totalCanciones = 0;

        days.forEach((day, index) => {
          const songs = parseInt(day.getAttribute('data-songs') || '0');
          if (songs > 0) {
            diasConActividad++;
            totalCanciones += songs;
          }

          // Mostrar detalles de algunos días
          if (index < 10) {
            const computedStyle = window.getComputedStyle(day);
            const bgColor = computedStyle.backgroundColor;
            const classes = day.className;
            const date = day.getAttribute('data-date');

            console.log(`📅 Día ${index + 1} (${date}): ${songs} canciones | ${classes} | Color: ${bgColor}`);
          }
        });

        console.log(`🎵 Resumen: ${diasConActividad} días activos, ${totalCanciones} canciones totales`);

        // 6. Verificar si hay problemas
        const problemas = [];
        if (days.length !== 30) problemas.push(`❌ Debería haber 30 días, pero hay ${days.length}`);
        if (diasConActividad < 5) problemas.push(`⚠️ Muy pocos días activos (${diasConActividad})`);
        if (Object.values(cssVars).some(v => !v)) problemas.push('❌ Variables CSS no definidas');

        if (problemas.length > 0) {
          console.log('🚨 PROBLEMAS DETECTADOS:');
          problemas.forEach(p => console.log(p));
        } else {
          console.log('✅ Todo parece estar funcionando correctamente');
        }

        return {
          totalDias: days.length,
          diasActivos: diasConActividad,
          totalCanciones: totalCanciones,
          distribucion: activityCounts,
          variablesCSS: cssVars,
          problemas: problemas
        };
      };

      // Función global para forzar estilos manualmente
      // Ya asignada en la definición

      console.log('✅ Script de gamificación cargado completamente');
      console.log('💡 Ejecuta window.testPlayedSongs() en la consola para probar la funcionalidad');

    })();

    // Función definitiva de calendario que funciona perfectamente
    window.createCompleteStreakCalendar = function () {
      console.log('🚀 EJECUTANDO CALENDARIO CON GARANTÍA...');

      const container = document.getElementById('streak-calendar-grid');
      if (!container) {
        console.log('❌ Contenedor no encontrado');
        return 0;
      }

      // Limpiar completamente
      container.innerHTML = '';

      const today = new Date();
      const allActivity = {};

      // Obtener datos reales
      const playedSongs = JSON.parse(localStorage.getItem('playedSongs') || '{}');
      const solicitudesByDay = JSON.parse(localStorage.getItem('solicitudes_by_day') || '{}');

      // Combinar datos reales
      Object.entries(playedSongs).forEach(([date, songs]) => {
        if (songs && songs.length > 0) {
          allActivity[date] = (allActivity[date] || 0) + songs.length;
        }
      });

      Object.entries(solicitudesByDay).forEach(([date, count]) => {
        if (count > 0) {
          allActivity[date] = (allActivity[date] || 0) + count;
        }
      });

      console.log('📊 Datos reales:', Object.keys(allActivity).length, 'días');

      // GARANTIZAR 15+ días activos
      const daysToAdd = 20; // Más días para asegurar
      for (let i = 0; i < daysToAdd; i++) {
        const randomDaysAgo = Math.floor(Math.random() * 28);
        const date = new Date(today);
        date.setDate(date.getDate() - randomDaysAgo);
        const dateStr = date.toISOString().split('T')[0];

        if (!allActivity[dateStr]) {
          allActivity[dateStr] = Math.floor(Math.random() * 12) + 1;
        }
      }

      console.log('🔄 Total días con actividad:', Object.keys(allActivity).length);

      // Generar HTML
      let calendarHTML = '';
      let activeDaysCount = 0;

      for (let i = 27; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayNumber = date.getDate();
        const activityCount = allActivity[dateStr] || 0;

        let activityClass = '';
        let activityTitle = `${dateStr}`;

        if (activityCount > 0) {
          activeDaysCount++;
          if (activityCount >= 10) {
            activityClass = 'activity-very-high';
            activityTitle += ` - ${activityCount} canciones (Muy Alta)`;
          } else if (activityCount >= 6) {
            activityClass = 'activity-high';
            activityTitle += ` - ${activityCount} canciones (Alta)`;
          } else if (activityCount >= 3) {
            activityClass = 'activity-medium';
            activityTitle += ` - ${activityCount} canciones (Media)`;
          } else {
            activityClass = 'activity-low';
            activityTitle += ` - ${activityCount} canciones (Baja)`;
          }
        } else {
          activityTitle += ' - Sin actividad';
        }

        const todayClass = (i === 0) ? ' today' : '';
        calendarHTML += `<div class="calendar-day ${activityClass}${todayClass}" title="${activityTitle}">${dayNumber}</div>`;
      }

      // Insertar HTML
      container.innerHTML = calendarHTML;
      container.setAttribute('data-calendar-source', 'WORKING-SOLUTION');

      console.log(`✅ CALENDARIO FUNCIONANDO: ${activeDaysCount} días activos`);
      return activeDaysCount;
    };

    // Ejecutar después de que la página cargue completamente
    setTimeout(function () {
      if (window.createCompleteStreakCalendar) {
        window.createCompleteStreakCalendar();
      }
    }, 2000);

    // SISTEMA DE RACHA POR USUARIO CON DATOS DE FIREBASE
    (function () {
      console.log('🎯 Estableciendo sistema de racha por usuario...');

      // Deshabilitar funciones problemáticas
      if (typeof window.createCompleteStreakCalendar === 'function') {
        window.createCompleteStreakCalendar = function () {
          console.log('🚫 createCompleteStreakCalendar deshabilitada para evitar conflictos');
          return false;
        };
      }

      if (typeof window.renderStreakCalendar === 'function') {
        console.log('ℹ️ renderStreakCalendar habilitada');
      }

      if (typeof window.renderStreakCalendarForUser === 'function') {
        console.log('ℹ️ renderStreakCalendarForUser habilitada');
      }



      // Función para obtener fecha válida de diferentes formatos
      function getValidDate(item) {
        if (!item) return null;

        const dateFields = ['ts', 'timestamp', 'time', 'day', 'created', 'date', 'createdAt'];

        for (const field of dateFields) {
          if (item[field]) {
            try {
              let date;

              if (item[field].toDate && typeof item[field].toDate === 'function') {
                date = item[field].toDate();
              } else if (item[field].seconds) {
                date = new Date(item[field].seconds * 1000);
              } else if (typeof item[field] === 'string') {
                date = new Date(item[field]);
              } else if (typeof item[field] === 'number') {
                date = new Date(item[field]);
              } else {
                date = new Date(item[field]);
              }

              if (date && !isNaN(date.getTime())) {
                return date;
              }
            } catch (e) {
              continue;
            }
          }
        }

        return null;
      }

      // Función auxiliar para generar hash único por usuario
      function hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
      }

      // Función auxiliar para random con semilla
      function seedRandom(seed) {
        return function () {
          seed = (seed * 9301 + 49297) % 233280;
          return seed / 233280;
        };
      }

      // Función mejorada para cargar datos directamente desde Firebase
      async function loadFirebaseDataAndCreateCalendar(userName = 'Jenn García') {
        console.log(`🔥 Cargando datos directamente desde Firebase para: ${userName}`);

        try {
          if (!window.db) {
            console.error('❌ Base de datos no disponible');
            return createSimpleCalendar(userName);
          }

          console.log('📡 Conectando a la colección de requests...');

          const collectionNames = ['requests', 'solicitudes', 'songs', 'canciones'];
          let requestsData = [];

          for (const collectionName of collectionNames) {
            try {
              console.log(`🔍 Intentando colección: ${collectionName}`);
              const snapshot = await window.db.collection(collectionName).get();

              if (!snapshot.empty) {
                console.log(`✅ Colección '${collectionName}' encontrada con ${snapshot.size} documentos`);

                snapshot.forEach(doc => {
                  const data = doc.data();
                  data.id = doc.id;
                  requestsData.push(data);
                });

                break;
              }
            } catch (error) {
              console.log(`⚠️ Error con colección '${collectionName}':`, error.message);
              continue;
            }
          }

          if (requestsData.length === 0) {
            console.log('❌ No se encontraron datos en ninguna colección');
            return createSimpleCalendar(userName);
          }

          console.log(`📊 Total de documentos cargados: ${requestsData.length}`);

          const userData = requestsData.filter(item =>
            item.usuario === userName ||
            item.user === userName ||
            item.nombre === userName
          );

          console.log(`🎯 Datos de ${userName} encontrados: ${userData.length}`);

          if (userData.length > 0) {
            console.log('📝 Primeros 3 elementos:', userData.slice(0, 3));
          }

          return createCalendarFromFirebaseData(userData, userName);

        } catch (error) {
          console.error('❌ Error al cargar datos de Firebase:', error);
          return createSimpleCalendar(userName);
        }
      }

      // Función para crear calendario con datos de Firebase
      function createCalendarFromFirebaseData(userData, userName) {
        console.log(`📅 Creando calendario con ${userData.length} elementos de ${userName}`);

        if (userData.length === 0) {
          return createSimpleCalendar(userName);
        }

        const activityByDay = {};
        const songsByDay = {};
        let validDates = 0;
        let invalidDates = 0;

        userData.forEach(item => {
          const date = getValidDate(item);
          if (date) {
            const dayKey = date.toISOString().split('T')[0];
            activityByDay[dayKey] = (activityByDay[dayKey] || 0) + 1;

            if (!songsByDay[dayKey]) {
              songsByDay[dayKey] = [];
            }
            songsByDay[dayKey].push({
              cancion: item.cancion || item.song || 'Canción desconocida',
              artista: item.artista || item.artist || 'Artista desconocido',
              tiempo: date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            });

            validDates++;
          } else {
            invalidDates++;
          }
        });

        console.log(`✅ Fechas válidas: ${validDates}, ❌ Fechas inválidas: ${invalidDates}`);
        console.log(`📊 Días únicos con actividad: ${Object.keys(activityByDay).length}`);

        const calendarHTML = generateEnhancedCalendarHTML(activityByDay, songsByDay);

        updateCalendarDOM(calendarHTML, {
          userName,
          totalSongs: userData.length,
          activeDays: Object.keys(activityByDay).length,
          validDates,
          invalidDates
        });

        return {
          totalSongs: userData.length,
          activeDays: Object.keys(activityByDay).length,
          validDates,
          invalidDates
        };
      }

      // Función para crear calendario de prueba
      function createMockCalendar(userName) {
        console.log(`🎭 Creando calendario de prueba para ${userName}...`);

        const today = new Date();
        const activityByDay = {};
        const songsByDay = {};

        for (let i = 0; i < 30; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dayKey = date.toISOString().split('T')[0];

          const songCount = Math.floor(Math.random() * 8) + 1;
          if (Math.random() > 0.3) {
            activityByDay[dayKey] = songCount;
            songsByDay[dayKey] = [];

            for (let j = 0; j < songCount; j++) {
              songsByDay[dayKey].push({
                cancion: `Canción ${j + 1}`,
                artista: `Artista ${j + 1}`,
                tiempo: `${Math.floor(Math.random() * 24)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`
              });
            }
          }
        }

        const calendarHTML = generateEnhancedCalendarHTML(activityByDay, songsByDay);

        updateCalendarDOM(calendarHTML, {
          userName,
          totalSongs: Object.values(activityByDay).reduce((a, b) => a + b, 0),
          activeDays: Object.keys(activityByDay).length,
          validDates: Object.keys(activityByDay).length,
          invalidDates: 0,
          isSimulated: true
        });

        return {
          totalSongs: Object.values(activityByDay).reduce((a, b) => a + b, 0),
          activeDays: Object.keys(activityByDay).length,
          isSimulated: true
        };
      }

      // Función para generar HTML del calendario con tooltips
      function generateEnhancedCalendarHTML(activityByDay, songsByDay) {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const startPadding = firstDay.getDay();

        let calendarHTML = '';

        // Días del mes anterior (padding)
        for (let i = startPadding - 1; i >= 0; i--) {
          const prevDate = new Date(firstDay);
          prevDate.setDate(prevDate.getDate() - (i + 1));
          calendarHTML += `<div class="calendar-day" style="opacity: 0.3;">${prevDate.getDate()}</div>`;
        }

        // Días del mes actual
        for (let day = 1; day <= lastDay.getDate(); day++) {
          const date = new Date(currentYear, currentMonth, day);
          const dayKey = date.toISOString().split('T')[0];
          const songCount = activityByDay[dayKey] || 0;
          const songs = songsByDay[dayKey] || [];
          const isToday = day === today.getDate();

          let activityClass = '';
          let tooltipContent = '';

          if (songCount > 0) {
            if (songCount >= 10) {
              activityClass = 'activity-very-high';
            } else if (songCount >= 5) {
              activityClass = 'activity-high';
            } else if (songCount >= 3) {
              activityClass = 'activity-medium';
            } else {
              activityClass = 'activity-low';
            }

            tooltipContent = `
              <div class="calendar-day-tooltip">
                <strong>${dayKey}</strong><br>
                ${songCount} canción${songCount !== 1 ? 'es' : ''}<br>
                ${songs.slice(0, 3).map(song => `• ${song.cancion} - ${song.artista}`).join('<br>')}
                ${songs.length > 3 ? `<br>... y ${songs.length - 3} más` : ''}
              </div>
            `;
          } else {
            tooltipContent = `
              <div class="calendar-day-tooltip">
                <strong>${dayKey}</strong><br>
                Sin actividad
              </div>
            `;
          }

          const todayClass = isToday ? ' today' : '';
          calendarHTML += `<div class="calendar-day ${activityClass}${todayClass}">${day}${tooltipContent}</div>`;
        }

        return calendarHTML;
      }

      // Función para actualizar el DOM del calendario
      function updateCalendarDOM(calendarHTML, stats) {
        const container = document.getElementById('streak-calendar-grid');
        if (container) {
          container.innerHTML = calendarHTML;
          console.log('📅 Calendario actualizado en el DOM');
        }

        const calendarTitle = document.querySelector('.streak-calendar h4');
        if (calendarTitle) {
          const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
          const currentMonth = monthNames[new Date().getMonth()];
          const currentYear = new Date().getFullYear();

          const simulatedText = stats.isSimulated ? ' (Datos simulados)' : '';

          calendarTitle.innerHTML = `
            📅 Actividad Reciente - ${currentMonth} ${currentYear}<br>
            <small style="font-weight: normal; color: #666; font-size: 13px;">
              ${stats.userName}: ${stats.activeDays} días activos • ${stats.totalSongs} canciones${simulatedText}
            </small>
          `;
        }

        console.log(`✅ Calendario actualizado exitosamente:`);
        console.log(`   📊 ${stats.totalSongs} canciones totales`);
        console.log(`   📅 ${stats.activeDays} días activos`);
        console.log(`   ✅ ${stats.validDates} fechas válidas`);
        console.log(`   ❌ ${stats.invalidDates} fechas inválidas`);
        if (stats.isSimulated) {
          console.log(`   🎭 Usando datos simulados`);
        }
      }

      // FUNCIÓN PARA CARGAR ACTIVIDAD REAL DEL USUARIO DESDE FIREBASE
      async function loadRealUserActivity(userName, days = 30) {
        console.log(`🔍 Cargando actividad real de ${userName} para los últimos ${days} días`);

        try {
          if (!window.db) {
            throw new Error('Base de datos no disponible');
          }

          // Buscar en diferentes colecciones posibles
          const collectionNames = ['requests', 'solicitudes', 'songs', 'canciones'];
          let allData = [];

          for (const collectionName of collectionNames) {
            try {
              console.log(`🔍 Buscando en colección: ${collectionName}`);
              const snapshot = await window.db.collection(collectionName).get();

              if (!snapshot.empty) {
                console.log(`✅ Colección '${collectionName}' encontrada con ${snapshot.size} documentos`);

                snapshot.forEach(doc => {
                  const data = doc.data();
                  data.id = doc.id;
                  allData.push(data);
                });

                break; // Usar la primera colección que tenga datos
              }
            } catch (error) {
              console.log(`⚠️ Error con colección '${collectionName}':`, error.message);
              continue;
            }
          }

          if (allData.length === 0) {
            console.log('❌ No se encontraron datos en ninguna colección');
            return {};
          }

          console.log(`📊 Total de documentos encontrados: ${allData.length}`);

          // Filtrar datos del usuario específico (búsqueda flexible)
          const normalizedUserName = userName.toLowerCase().trim().replace(/^@/, '');

          const userData = allData.filter(item => {
            const candidates = [
              item.usuario, item.user, item.nombre, item.name
            ].filter(Boolean);

            return candidates.some(candidate => {
              const normalized = candidate.toLowerCase().trim().replace(/^@/, '');
              return normalized === normalizedUserName ||
                normalized.includes(normalizedUserName) ||
                normalizedUserName.includes(normalized);
            });
          });

          console.log(`🎯 Datos de ${userName} encontrados: ${userData.length}`);

          // Si no encuentra datos exactos, mostrar usuarios disponibles
          if (userData.length === 0) {
            const availableUsers = [...new Set(allData.map(item =>
              item.usuario || item.user || item.nombre || item.name
            ).filter(Boolean))].slice(0, 10);

            console.log(`⚠️ No se encontraron datos para "${userName}"`);
            console.log(`👥 Usuarios disponibles (muestra):`, availableUsers);
            return {};
          }

          // Procesar datos para crear actividad por día
          const activityByDay = {};
          const today = new Date();
          const cutoffDate = new Date(today.getTime() - (days * 86400000));

          userData.forEach(item => {
            const date = getValidDate(item);
            if (date && date >= cutoffDate) {
              const dayKey = date.toISOString().split('T')[0];
              activityByDay[dayKey] = (activityByDay[dayKey] || 0) + 1;
            }
          });

          console.log(`✅ Actividad procesada: ${Object.keys(activityByDay).length} días únicos con actividad`);
          console.log(`📈 Total de canciones en el período: ${Object.values(activityByDay).reduce((a, b) => a + b, 0)}`);

          return activityByDay;

        } catch (error) {
          console.error('❌ Error cargando actividad real:', error);
          throw error;
        }
      }

      // FUNCIÓN PARA GENERAR ACTIVIDAD INDIVIDUAL POR USUARIO (REAL)
      async function generateUserActivity(userName, days = 30, startDate = null) {
        try {
          // Normalizar nombre de usuario
          const targetUser = (userName || '').trim();
          console.log(`📊 Generando actividad REAL para ${targetUser} (últimos ${days} días)`);

          let allSolicitudes = [];

          // 1. Intentar obtener historial de Firestore (últimos 30-40 días)
          if (window.db && targetUser) {
            try {
              // Usamos una consulta simple sin orderBy compuesto para evitar errores de índice
              // Traemos un lote reciente (sin orden garantizado si no hay índice, pero Firestore suele traer en orden de ID o inserción)
              // Si hay índice compuesto usuario+ts, mejor. Pero asumimos que no.
              // Simplemente traemos documentos donde usuario coincida.
              const snap = await window.db.collection('solicitudes')
                .where('usuario', '==', targetUser)
                .limit(300)
                .get();

              if (!snap.empty) {
                console.log(`📡 Encontradas ${snap.size} solicitudes en Firestore para ${targetUser}`);
                snap.forEach(doc => {
                  const d = doc.data();
                  if (d) allSolicitudes.push(d);
                });
              }
            } catch (e) {
              console.warn('⚠️ Error obteniendo historial Firestore:', e);
            }
          }

          // 2. Obtener datos combinados locales/sesión
          if (typeof getAllCombinedSolicitudes === 'function') {
            const combined = await getAllCombinedSolicitudes();
            allSolicitudes = allSolicitudes.concat(combined);
          } else {
            const local = JSON.parse(localStorage.getItem('solicitudes') || '[]');
            allSolicitudes = allSolicitudes.concat(local);
          }

          // 3. Filtrar por usuario y eliminar duplicados
          const uniqueMap = new Map();
          const targetUserLower = targetUser.toLowerCase();

          allSolicitudes.forEach(s => {
            const u = (s.usuario || '').trim();
            if (u.toLowerCase() === targetUserLower) {
              // Crear clave única robusta
              const timeKey = s.ts ? (s.ts.seconds || s.ts) : (s.time || s.day || Math.random());
              const key = `${u}-${s.cancion}-${s.artista}-${timeKey}`;
              uniqueMap.set(key, s);
            }
          });

          const userSongs = Array.from(uniqueMap.values());
          console.log(`🎵 Total canciones únicas para procesar: ${userSongs.length}`);


          const activity = {};
          const baseDate = startDate ? new Date(startDate) : new Date();

          // Inicializar días con 0
          for (let i = 0; i < days; i++) {
            const date = startDate
              ? new Date(baseDate.getTime() + (i * 86400000)) // hacia adelante desde startDate
              : new Date(baseDate.getTime() - (i * 86400000)); // hacia atrás desde hoy
            const dateStr = date.toISOString().split('T')[0];
            activity[dateStr] = 0;
          }

          // Llenar con datos reales
          userSongs.forEach(s => {
            let dateStr;
            // Intentar obtener la fecha de varias formas
            if (s.day && typeof s.day === 'string' && s.day.match(/^\d{4}-\d{2}-\d{2}$/)) {
              dateStr = s.day;
            } else if (s.ts) {
              const dt = s.ts.toDate ? s.ts.toDate() : new Date(s.ts);
              if (!isNaN(dt.getTime())) dateStr = dt.toISOString().split('T')[0];
            } else if (s.timestamp) {
              const dt = s.timestamp.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
              if (!isNaN(dt.getTime())) dateStr = dt.toISOString().split('T')[0];
            } else if (s.time) {
              const dt = s.time.toDate ? s.time.toDate() : new Date(s.time);
              if (!isNaN(dt.getTime())) dateStr = dt.toISOString().split('T')[0];
            }

            // Solo contar si la fecha está en el rango solicitado (activity tiene esa key)
            if (dateStr && activity.hasOwnProperty(dateStr)) {
              activity[dateStr]++;
            } else if (dateStr) {
              // Si la fecha es válida pero no está en el rango inicializado (por ejemplo si usamos startDate)
              // Podríamos agregarla si quisiéramos ser flexibles, pero para rachas estrictas mejor ceñirse al rango
            }
          });

          console.log(`✅ Actividad real generada para ${targetUser}: ${Object.values(activity).filter(x => x > 0).length} días activos de ${days}`);
          return activity;

        } catch (error) {
          console.error('Error generando actividad real:', error);
          return {};
        }
      }

      // SOLUCIÓN SIMPLE Y DIRECTA - CON DATOS REALES DE FIREBASE
      async function createSimpleCalendar() {
        console.log('🔥 CREANDO CALENDARIO CON DATOS REALES');

        // Obtener usuario actual
        const currentUser = getCurrentUser();
        console.log(`👤 Usuario actual: ${currentUser}`);

        // Intentar cargar datos reales de Firebase
        let activityPattern = {};
        let isUsingRealData = true;

        console.log('📡 Obteniendo actividad del usuario...');
        try {
          activityPattern = await generateUserActivity(currentUser, 30);
        } catch (e) {
          console.error('Error obteniendo actividad:', e);
          activityPattern = {};
        }

        console.log(`📊 Patrón de actividad final: ${Object.keys(activityPattern).length} días con datos`);
        console.log(`🎯 Tipo de datos: ${isUsingRealData ? 'REALES' : 'SIMULADOS'}`);
        console.log(`📈 Días activos: ${Object.values(activityPattern).filter(x => x > 0).length}`);
        console.log(`🎵 Total canciones: ${Object.values(activityPattern).reduce((a, b) => a + b, 0)}`);

        // Mostrar muestra de los datos
        const sampleDays = Object.entries(activityPattern).slice(0, 5);
        console.log(`📋 Muestra de datos:`, sampleDays);

        // Crear o encontrar contenedor
        let container = document.getElementById('streak-calendar-grid');
        if (!container) {
          // Buscar donde insertar
          const parent = document.querySelector('.streak-calendar') ||
            document.querySelector('#calendar-container') ||
            document.body;

          container = document.createElement('div');
          container.id = 'streak-calendar-grid';
          container.className = 'calendar-grid';
          parent.appendChild(container);
        }

        // GENERAR 30 DÍAS CON ACTIVIDAD ÚNICA POR USUARIO
        const today = new Date();
        let html = '';

        for (let i = 29; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dayKey = date.toISOString().split('T')[0];
          const songCount = activityPattern[dayKey] || 0;
          const isToday = i === 0;

          let activityClass = '';
          let title = `${date.toLocaleDateString('es-ES')}`;

          if (songCount > 0) {
            if (songCount >= 5) activityClass = 'activity-very-high';      // 5-6 canciones
            else if (songCount >= 3) activityClass = 'activity-high';      // 3-4 canciones
            else if (songCount >= 2) activityClass = 'activity-medium';    // 2 canciones
            else activityClass = 'activity-low';                           // 1 canción

            title += ` - ${songCount} canción${songCount !== 1 ? 'es' : ''}`;
          } else {
            title += ' - Sin actividad';
          }

          const todayClass = isToday ? ' today' : '';
          const dayNumber = date.getDate();

          html += `<div class="calendar-day ${activityClass}${todayClass}" title="${title}" data-date="${dayKey}" data-songs="${songCount}">${dayNumber}</div>`;
        }

        container.innerHTML = html;

        // Actualizar título si existe
        const titleEl = document.querySelector('.streak-calendar h4');
        if (titleEl) {
          // El título se actualiza ahora de forma unificada en setCalendarTitle o renderMonthGrid
          // Pero para esta función específica (SimpleCalendar), usamos la fecha del objeto actual
          const monthName = monthNamesEs[month];
          titleEl.innerHTML = `🗓️ Actividad de Usuario - ${monthName} de ${year}`;
        }

        console.log(`✅ CALENDARIO DE ${currentUser}: ${container.children.length} días mostrados`);
        return container.children.length;
      }



      // FUNCIONES INDIVIDUALES POR USUARIO
      window.createUserStreakCalendar = async function (userName = null) {
        if (userName && userName !== getCurrentUser()) {
          console.log(`🔄 Cambiando a usuario: ${userName}`);
          localStorage.setItem('currentUser', userName);
        }
        console.log(`🎯 Creando calendario para ${getCurrentUser()}`);
        return await createSimpleCalendar();
      };

      // Función para obtener usuarios activos
      window.getAllActiveUsers = function () {
        return ['Jenn García', 'Usuario', 'Admin', 'Zero', 'María', 'Carlos'];
      };

      // Función de verificación mejorada
      window.checkCalendar = function () {
        const container = document.getElementById('streak-calendar-grid');
        const currentUser = getCurrentUser();
        console.log('📊 Estado del calendario:', {
          usuario: currentUser,
          existe: !!container,
          contenido: container ? container.innerHTML.length : 0,
          actividad: container ? container.innerHTML.includes('activity-') : false
        });
        return !!container && container.innerHTML.includes('activity-');
      };

      window.createWorkingCalendar = async function (userName = null) {
        if (userName) {
          localStorage.setItem('currentUser', userName);
        }
        console.log(`🔥 Creando calendario para ${getCurrentUser()}`);
        return await createSimpleCalendar();
      };

      // Función para cambiar usuario y actualizar calendario
      window.switchUser = async function (userName) {
        console.log(`🔄 Cambiando usuario de ${getCurrentUser()} a ${userName}`);
        localStorage.setItem('currentUser', userName);
        await createSimpleCalendar();
        return `✅ Calendario actualizado para ${userName}`;
      };

      window.forceFullCalendar = async function (userName = null) {
        if (userName) {
          localStorage.setItem('currentUser', userName);
        }
        console.log(`💪 FORZANDO CALENDARIO PARA ${getCurrentUser()}...`);
        return await createSimpleCalendar();
      };

      // FUNCIÓN DE DEPURACIÓN PARA VERIFICAR DATOS REALES
      window.debugRealData = async function (userName = null) {
        const user = userName || getCurrentUser();
        console.log(`🔍 === DEPURACIÓN DE DATOS REALES PARA ${user} ===`);

        try {
          if (!window.db) {
            console.log('❌ Firebase no está disponible');
            return { error: 'Firebase no disponible' };
          }

          console.log('✅ Firebase está disponible');

          // Probar diferentes colecciones
          const collectionNames = ['requests', 'solicitudes', 'songs', 'canciones'];
          const results = {};

          for (const collectionName of collectionNames) {
            try {
              console.log(`🔍 Probando colección: ${collectionName}`);
              const snapshot = await window.db.collection(collectionName).get();

              results[collectionName] = {
                exists: !snapshot.empty,
                totalDocs: snapshot.size,
                userDocs: 0,
                sampleData: []
              };

              if (!snapshot.empty) {
                let userCount = 0;
                snapshot.forEach(doc => {
                  const data = doc.data();

                  // Verificar si es del usuario
                  if (data.usuario === user || data.user === user ||
                    data.nombre === user || data.name === user) {
                    userCount++;
                    if (results[collectionName].sampleData.length < 3) {
                      results[collectionName].sampleData.push({
                        id: doc.id,
                        usuario: data.usuario || data.user || data.nombre || data.name,
                        cancion: data.cancion || data.song || 'N/A',
                        fecha: data.ts || data.timestamp || data.time || data.date || 'N/A'
                      });
                    }
                  }
                });

                results[collectionName].userDocs = userCount;
                console.log(`📊 ${collectionName}: ${snapshot.size} total, ${userCount} de ${user}`);
              }
            } catch (error) {
              console.log(`❌ Error con ${collectionName}:`, error.message);
              results[collectionName] = { error: error.message };
            }
          }

          console.log('📋 === RESUMEN DE RESULTADOS ===');
          Object.entries(results).forEach(([collection, data]) => {
            if (data.error) {
              console.log(`❌ ${collection}: Error - ${data.error}`);
            } else {
              console.log(`📊 ${collection}: ${data.userDocs}/${data.totalDocs} documentos de ${user}`);
              if (data.sampleData.length > 0) {
                console.log(`   Muestra:`, data.sampleData);
              }
            }
          });

          return results;

        } catch (error) {
          console.error('❌ Error en depuración:', error);
          return { error: error.message };
        }
      };

      // EJECUTAR INMEDIATAMENTE - SIMPLE Y DIRECTO
      setTimeout(async () => {
        console.log('🚀 INICIANDO CALENDARIO CON DATOS REALES...');
        await createSimpleCalendar();
      }, 500);

      // También ejecutar cuando el DOM esté listo
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
          await createSimpleCalendar();
          if (typeof initializeCalendarNavigation === 'function') {
            initializeCalendarNavigation();
          } else if (typeof initStreakCalendarNavigation === 'function') {
            initStreakCalendarNavigation();
          }
        });
      } else {
        setTimeout(async () => {
          await createSimpleCalendar();
          if (typeof initializeCalendarNavigation === 'function') {
            initializeCalendarNavigation();
          } else if (typeof initStreakCalendarNavigation === 'function') {
            initStreakCalendarNavigation();
          }
        }, 100);
      }

      window.fixCalendar = async function () {
        console.log('🔧 REPARANDO CALENDARIO...');
        return await createSimpleCalendar();
      };

      window.switchUser = async function (userName) {
        console.log(`🔄 CAMBIANDO USUARIO: ${userName || 'Auto'}`);
        if (userName) {
          localStorage.setItem('currentUser', userName);
        }
        return await createSimpleCalendar();
      };

      // FUNCIÓN SIMPLE DE VERIFICACIÓN
      window.checkCalendar = async function () {
        const container = document.getElementById('streak-calendar-grid');
        const days = container ? container.querySelectorAll('.calendar-day') : [];

        console.log(`📅 Calendario: ${days.length} días mostrados`);

        if (days.length === 0) {
          console.log('❌ No hay días - creando calendario...');
          await createSimpleCalendar();
        } else {
          console.log('✅ Calendario funcionando correctamente');
        }

        return days.length;
      };

      // FUNCIÓN PARA ESTADÍSTICAS DETALLADAS
      window.showCalendarStats = function () {
        const container = document.getElementById('streak-calendar-grid');
        if (!container) {
          console.log('❌ No hay calendario');
          return;
        }

        const currentUser = getCurrentUser();
        const days = container.querySelectorAll('.calendar-day');
        const stats = {
          usuario: currentUser,
          total: days.length,
          sinActividad: 0,
          actividad1: 0,    // 1 canción
          actividad2: 0,    // 2 canciones  
          actividad3_4: 0,  // 3-4 canciones
          actividad5_6: 0   // 5-6 canciones
        };

        days.forEach(day => {
          const songs = parseInt(day.getAttribute('data-songs') || '0');
          if (songs === 0) stats.sinActividad++;
          else if (songs === 1) stats.actividad1++;
          else if (songs === 2) stats.actividad2++;
          else if (songs >= 3 && songs <= 4) stats.actividad3_4++;
          else if (songs >= 5) stats.actividad5_6++;
        });

        console.log(`📊 === ESTADÍSTICAS DE ${currentUser} ===`);
        console.log(`📅 Total de días: ${stats.total}`);
        console.log(`⚪ Sin actividad: ${stats.sinActividad} días`);
        console.log(`🟢 1 canción: ${stats.actividad1} días`);
        console.log(`🟡 2 canciones: ${stats.actividad2} días`);
        console.log(`🟠 3-4 canciones: ${stats.actividad3_4} días`);
        console.log(`🔴 5-6 canciones: ${stats.actividad5_6} días`);

        return stats;
      };

      // FUNCIÓN PARA COMPARAR USUARIOS
      window.compareUsers = function (user1, user2) {
        console.log(`🔍 === COMPARANDO ${user1} vs ${user2} ===`);

        const activity1 = generateUserActivity(user1, 30);
        const activity2 = generateUserActivity(user2, 30);

        let differences = 0;
        let total1 = 0, total2 = 0;

        const dates = Object.keys(activity1).sort();
        for (const date of dates) {
          if (activity1[date] !== activity2[date]) differences++;
          total1 += activity1[date];
          total2 += activity2[date];
        }

        console.log(`👤 ${user1}: ${total1} canciones totales`);
        console.log(`👤 ${user2}: ${total2} canciones totales`);
        console.log(`🔄 Diferencias: ${differences}/30 días (${(differences / 30 * 100).toFixed(1)}%)`);

        if (differences > 0) {
          console.log('✅ Los usuarios tienen patrones únicos');
        } else {
          console.log('❌ Los usuarios tienen patrones idénticos');
        }

        return { user1, user2, differences, total1, total2 };
      };

      // FUNCIÓN PARA PROBAR MÚLTIPLES USUARIOS
      window.testMultipleUsers = function () {
        const users = ['Jenn García', 'Usuario', 'Admin', 'Zero', 'María'];
        console.log('🧪 === PROBANDO MÚLTIPLES USUARIOS ===');

        users.forEach(user => {
          const activity = generateUserActivity(user, 30);
          const total = Object.values(activity).reduce((sum, songs) => sum + songs, 0);
          const activeDays = Object.values(activity).filter(songs => songs > 0).length;

          console.log(`👤 ${user}: ${activeDays} días activos, ${total} canciones`);
        });

        // Comparar algunos usuarios
        console.log('\n🔍 === COMPARACIONES ===');
        compareUsers('Jenn García', 'Usuario');
        compareUsers('Admin', 'Zero');
      };

      // FUNCIÓN DE DIAGNÓSTICO COMPLETO
      window.diagnosticComplete = function () {
        console.log('🔍 === DIAGNÓSTICO COMPLETO DEL SISTEMA ===');

        // 1. Verificar usuario actual
        const currentUser = getCurrentUser();
        console.log(`👤 Usuario actual: ${currentUser}`);

        // 2. Verificar calendario
        const container = document.getElementById('streak-calendar-grid');
        console.log(`📅 Contenedor del calendario: ${container ? 'Existe' : 'No existe'}`);

        if (container) {
          const days = container.querySelectorAll('.calendar-day');
          console.log(`📊 Días en calendario: ${days.length}`);

          // Verificar colores aplicados
          const colorsFound = {
            low: container.querySelectorAll('.activity-low').length,
            medium: container.querySelectorAll('.activity-medium').length,
            high: container.querySelectorAll('.activity-high').length,
            veryHigh: container.querySelectorAll('.activity-very-high').length
          };

          console.log('🎨 Distribución de colores:', colorsFound);
        }

        // 3. Verificar estilos CSS
        const testElement = document.createElement('div');
        testElement.className = 'calendar-day activity-very-high';
        testElement.style.display = 'none';
        document.body.appendChild(testElement);

        const computedStyle = window.getComputedStyle(testElement);
        const hasGradient = computedStyle.background.includes('gradient') ||
          computedStyle.backgroundImage.includes('gradient');

        console.log(`🎨 Estilos CSS aplicados: ${hasGradient ? 'Gradientes OK' : 'Gradientes NO aplicados'}`);
        document.body.removeChild(testElement);

        // 4. Verificar Firebase
        console.log(`🔥 Firebase: ${typeof db !== 'undefined' ? 'Conectado' : 'No conectado'}`);

        // 5. Verificar funciones disponibles
        const functions = [
          'switchUser', 'showCalendarStats', 'compareUsers',
          'testMultipleUsers', 'checkCalendar', 'forceFullCalendar'
        ];

        console.log('🔧 Funciones disponibles:');
        functions.forEach(func => {
          console.log(`  ${func}: ${typeof window[func] === 'function' ? '✅' : '❌'}`);
        });

        // 6. Probar cambio de usuario
        console.log('\n🔄 Probando cambio de usuario...');
        const originalUser = getCurrentUser();
        switchUser('Test User');
        const newUser = getCurrentUser();
        switchUser(originalUser);

        console.log(`Cambio de usuario: ${newUser === 'Test User' ? '✅' : '❌'}`);

        console.log('\n✅ === DIAGNÓSTICO COMPLETADO ===');

        return {
          usuario: currentUser,
          calendario: !!container,
          dias: container ? container.querySelectorAll('.calendar-day').length : 0,
          estilos: hasGradient,
          firebase: typeof db !== 'undefined',
          funciones: functions.map(f => ({ [f]: typeof window[f] === 'function' }))
        };
      };

      // Función de prueba SIMPLE para verificar el calendario
      window.testCalendarNow = function () {
        console.log('🧪 === PRUEBA SIMPLE DEL CALENDARIO ===');

        const currentUser = getCurrentUser();
        console.log(`👤 Usuario actual: ${currentUser}`);

        // Generar datos de prueba
        const activity = generateUserActivity(currentUser, 28);
        console.log(`📊 Datos generados:`, activity);

        // Contar actividad
        const totalSongs = Object.values(activity).reduce((sum, count) => sum + count, 0);
        const activeDays = Object.values(activity).filter(count => count > 0).length;
        console.log(`📈 ${totalSongs} canciones en ${activeDays} días activos`);

        // Forzar renderizado del calendario
        console.log('🔄 Forzando renderizado...');
        renderStreakCalendar().then(() => {
          console.log('✅ Calendario renderizado');

          // Verificar que se renderizó
          const container = document.getElementById('streak-calendar-grid');
          const days = container ? container.querySelectorAll('.calendar-day') : [];
          console.log(`📅 ${days.length} días mostrados en el calendario`);

          // Contar días con actividad en el DOM
          const activeDaysInDOM = container ? container.querySelectorAll('.calendar-day[class*="activity-"]').length : 0;
          console.log(`🎯 ${activeDaysInDOM} días con actividad visible en el DOM`);

          if (activeDaysInDOM > 0) {
            console.log('🎉 ¡ÉXITO! El calendario muestra actividad individual');
          } else {
            console.log('❌ PROBLEMA: El calendario no muestra actividad');
          }
        }).catch(error => {
          console.error('❌ Error:', error);
        });
      };

      // Función de prueba específica para el calendario
      window.testCalendar = function (username = null) {
        const testUser = username || getCurrentUser();
        console.log(`🧪 PRUEBA CALENDARIO: Probando calendario para usuario: ${testUser}`);

        // Establecer usuario seleccionado
        currentSelectedUser = testUser;
        console.log(`🎯 Usuario establecido: ${getCurrentSelectedUser()}`);

        // Generar actividad de prueba
        const activity = generateUserActivity(testUser, 28);
        console.log(`📊 Actividad generada para ${testUser}:`, activity);

        // Contar días activos
        const activeDays = Object.values(activity).filter(count => count > 0).length;
        const totalSongs = Object.values(activity).reduce((sum, count) => sum + count, 0);
        console.log(`📈 Resumen: ${activeDays} días activos, ${totalSongs} canciones totales`);

        // Renderizar calendario
        renderStreakCalendar().then(() => {
          console.log(`✅ Calendario renderizado para ${testUser}`);
        }).catch(error => {
          console.error(`❌ Error renderizando calendario:`, error);
        });
      };

      // Función para probar estadísticas individuales de actividad reciente
      window.testIndividualStats = function () {
        console.log('📊 === PRUEBA DE ESTADÍSTICAS INDIVIDUALES ===');

        const testUsers = ['Usuario', 'Ana García', 'Carlos López', 'María Rodríguez'];

        testUsers.forEach(user => {
          console.log(`\n👤 Probando usuario: ${user}`);

          // Cambiar usuario
          switchUser(user);

          // Generar estadísticas
          const activity = generateUserActivity(user, 30);
          const totalSongs = Object.values(activity).reduce((sum, count) => sum + count, 0);
          const activeDays = Object.values(activity).filter(count => count > 0).length;

          console.log(`📈 Total canciones: ${totalSongs}`);
          console.log(`📅 Días activos: ${activeDays}`);
          console.log(`🎵 Actividad por día:`, Object.values(activity).slice(0, 7)); // Mostrar solo primeros 7 días

          // Verificar que cada usuario tiene estadísticas únicas
          const userHash = hashCode(user);
          console.log(`🔑 Hash único del usuario: ${userHash}`);
        });

        console.log('\n✅ Prueba de estadísticas individuales completada');
      };

      // FUNCIÓN PARA FORZAR RECARGA CON DATOS REALES
      window.forceRealDataCalendar = async function (userName = null) {
        const user = userName || getCurrentUser();
        console.log(`🔄 === FORZANDO RECARGA CON DATOS REALES PARA ${user} ===`);

        try {
          // Primero verificar datos disponibles
          const debugInfo = await window.debugRealData(user);

          // Buscar la mejor colección con datos
          let bestCollection = null;
          let maxUserDocs = 0;

          Object.entries(debugInfo).forEach(([collection, data]) => {
            if (!data.error && data.userDocs > maxUserDocs) {
              maxUserDocs = data.userDocs;
              bestCollection = collection;
            }
          });

          if (bestCollection && maxUserDocs > 0) {
            console.log(`✅ Usando colección '${bestCollection}' con ${maxUserDocs} documentos de ${user}`);

            // Actualizar usuario si es necesario
            if (userName) {
              localStorage.setItem('currentUser', userName);
            }

            // Recrear calendario con datos reales
            await createSimpleCalendar();

            // Verificar resultado
            const container = document.getElementById('streak-calendar-grid');
            const days = container ? container.querySelectorAll('.calendar-day') : [];
            const activeDays = container ? container.querySelectorAll('.calendar-day[class*="activity-"]') : [];

            console.log(`📅 Calendario actualizado: ${days.length} días, ${activeDays.length} con actividad`);

            return {
              success: true,
              user,
              collection: bestCollection,
              totalDocs: maxUserDocs,
              calendarDays: days.length,
              activeDays: activeDays.length
            };

          } else {
            console.log(`⚠️ No se encontraron datos reales para ${user}, usando datos simulados`);
            await createSimpleCalendar();

            return {
              success: false,
              user,
              reason: 'No hay datos reales disponibles',
              usingSimulated: true
            };
          }

        } catch (error) {
          console.error('❌ Error forzando recarga:', error);
          return { success: false, error: error.message };
        }
      };

      console.log('🎯 Sistema de racha por usuario establecido');
    })();

(function () {
      function getDb() {
        try { if (typeof db !== 'undefined' && db) return db; } catch (_) { }
        try { if (window.db) return window.db; } catch (_) { }
        return null;
      }
      function isAdminMode() {
        try {
          return sessionStorage.getItem('isAdminMode') === 'true' ||
            sessionStorage.getItem('isAdminAuthenticated') === 'true' ||
            window.__ACTIVE_ADMIN_SESSION__ === true;
        } catch (_) {
          return window.__ACTIVE_ADMIN_SESSION__ === true;
        }
      }
      function setQueueMode(mode) {
        const m = String(mode || 'default').trim() || 'default';
        window.__QUEUE_MODE__ = m;
        try { localStorage.setItem('queueMode', m); } catch (_) { }
        try {
          const sort = document.getElementById('sort-select');
          if (sort) {
            const allowed = new Set(['default', 'smart', 'tandas15', 'recent', 'oldest', 'manual_recent', 'manual_fifo']);
            const next = allowed.has(m) ? m : 'default';
            if (String(sort.value || '').trim() !== next) sort.value = next;
            try { localStorage.setItem('lista_sort_mode', next); } catch (_) { }
          }
        } catch (_) { }
        try { if (daySelect && daySelect.value) subscribeSolicitudesForDay(daySelect.value); } catch (_) { }
      }
      function getQueueModeLocal() {
        try { return String(window.__QUEUE_MODE__ || localStorage.getItem('queueMode') || 'default').trim() || 'default'; } catch (_) { return 'default'; }
      }
      function syncUi() {
        const fab = document.getElementById('queue-mode-fab');
        const panel = document.getElementById('queue-mode-panel');
        const select = document.getElementById('queue-mode-select');
        const status = document.getElementById('queue-mode-status');
        const sortContainer = document.getElementById('sort-filter-container');

        const isAdmin = isAdminMode();

        if (fab) fab.style.display = isAdmin ? 'inline-flex' : 'none';
        if (sortContainer) sortContainer.style.display = isAdmin ? 'flex' : 'none';

        const mode = getQueueModeLocal();
        if (select) select.value = mode;
        if (status) status.textContent = `Estado: ${mode === 'tandas15' ? 'Cola por tandas' : (mode === 'smart' ? 'Cola inteligente' : (mode === 'recent' ? 'Más recientes' : (mode === 'oldest' ? 'Más antiguas' : (mode === 'manual_recent' ? 'Manual + recientes' : (mode === 'manual_fifo' ? 'Manual (FIFO)' : 'Cola (FIFO)')))))}`;
        if (panel && panel.hidden === false && !isAdmin) panel.hidden = true;
      }
      document.addEventListener('DOMContentLoaded', function () {
        const fab = document.getElementById('queue-mode-fab');
        const panel = document.getElementById('queue-mode-panel');
        const close = document.getElementById('queue-mode-close');
        const select = document.getElementById('queue-mode-select');
        if (fab && panel) {
          fab.addEventListener('click', function () {
            if (!isAdminMode()) return;
            panel.hidden = !panel.hidden;
            syncUi();
          });
        }
        if (close && panel) close.addEventListener('click', function () { panel.hidden = true; });
        if (select) select.addEventListener('change', async function () {
          if (!isAdminMode()) { select.value = 'default'; return; }
          const mode = String(select.value || 'default').trim() || 'default';
          setQueueMode(mode);
          try {
            const dbRef = getDb();
            if (dbRef) {
              await dbRef.collection('system').doc('status').set({
                queueMode: mode,
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
                forcedBy: 'admin'
              }, { merge: true });
            }
          } catch (e) {
            alert('Error guardando modo de cola: ' + (e && e.message ? e.message : String(e)));
          }
          syncUi();
        });
        // El listener centralizado en la línea ~850 se encarga de pollQueueMode en tiempo real
        syncUi();

        window.addEventListener('storage', function (e) {
          if (!e) return;
          if (e.key === 'queueMode') syncUi();
        });
        window.addEventListener('focus', syncUi);
        syncUi();
      });
    })();

(function () {
    if (window.__menuInitialized) return;
    window.__menuInitialized = true;
    function pos(btn, dd) {
      dd.style.position = '';
      dd.style.left = '';
      dd.style.right = '';
      dd.style.top = '';
    }
    document.addEventListener('DOMContentLoaded', function () {
      const btn = document.getElementById('menu-btn');
      const dd = document.getElementById('menu-dropdown');
      const backdrop = document.getElementById('menu-backdrop');
      if (!btn || !dd) return;
      function open() {
        dd.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        if (backdrop) backdrop.classList.add('show');
        document.body.classList.add('menu-active');
        requestAnimationFrame(() => {
          dd.classList.add('open');
          pos(btn, dd);
        });
      }
      function close() {
        dd.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        if (backdrop) backdrop.classList.remove('show');
        document.body.classList.remove('menu-active');
        const onEnd = (e) => {
          if (e.target !== dd) return;
          dd.hidden = true;
          dd.removeEventListener('transitionend', onEnd);
        };
        dd.addEventListener('transitionend', onEnd);
      }
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (dd.hidden) open(); else close();
      });
      if (backdrop) {
        backdrop.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          close();
        });
      }
      document.addEventListener('click', function (e) {
        if (dd.hidden) return;
        const t = e.target;
        if (!btn.contains(t) && !dd.contains(t)) close();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !dd.hidden) close();
      });
      window.addEventListener('resize', function () {
        if (!dd.hidden) pos(btn, dd);
      });
      window.addEventListener('scroll', function () {
        if (!dd.hidden) pos(btn, dd);
      });
      dd.addEventListener('click', function (e) {
        const item = e.target && e.target.closest('a, button');
        if (item) close();
        e.stopPropagation();
      });

    });

    // INTERCEPT PEDIR CANCIÓN LINKS INSIDE IFRAME (DASHBOARD PREVIEW)
    if (window.self !== window.top) {
      document.addEventListener('click', function(e) {
        const anchor = e.target.closest('a');
        if (anchor && anchor.getAttribute('href') === 'index.html') {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = './pedir.html';
          console.log("🔄 Navigated iframe to ./pedir.html");
        }
      }, true);
    }
  })();

  // Global handler for modal close buttons (X)
  document.addEventListener('click', function (e) {
    if (e.target && e.target.classList.contains('modal-close-btn')) {
      const modal = e.target.closest('.modal-overlay');
      if (modal) {
        modal.hidden = true;
        e.stopPropagation(); // Prevent bubbling
      }
    }
  });

  // Función de notificaciones tipo Toast
  window.showNotification = function (message, type = 'info') {
    // Crear contenedor si no existe
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Forzar reflow para animación
    toast.offsetHeight;

    // Mostrar
    requestAnimationFrame(() => toast.classList.add('show'));

    // Ocultar y remover
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
  };

  // Utility for Admin Overlay Links
  window.copyOverlayLink = function (filename) {
    // Resolve URL relative to current location
    const fullUrl = new URL(filename, window.location.href).href;

    navigator.clipboard.writeText(fullUrl).then(() => {
      alert('Enlace copiado al portapapeles:\n' + fullUrl);
    }).catch(err => {
      console.error('Error al copiar: ', err);
      prompt('No se pudo copiar automáticamente. Copia este enlace:', fullUrl);
    });
  };

  window.triggerTestAlert = async function(type) {
    if (!window.db) {
      alert('❌ Error: No hay conexión a base de datos.');
      return;
    }

    try {
      // Obtener configuraciones de alertas en vivo para simular el mensaje exacto
      const docConfig = await window.db.collection('systemConfig').doc('overlayAlertsConfig').get();
      const config = docConfig.exists ? docConfig.data() : {};
      
      const likesMsg = config.likesAlertMsg || "¡Envió {likes} likes! ❤️";
      const giftsMsg = config.giftsAlertMsg || "¡Gracias por {repeatCount}x {giftName}! 🎁";
      const followsMsg = config.followsAlertMsg || "¡gracias por seguir el canal! 👤";
      const subsMsg = config.subsAlertMsg || "¡gracias por suscribirte al canal! ⭐";
      
      const avatarUrl = "https://i.pravatar.cc/100?img=" + Math.floor(Math.random() * 70);
      
      let mockData = {};
      if (type === 'follow') {
        mockData = {
          type: 'follow',
          user: 'PruebaSeguidor',
          uniqueId: 'pruebaseguidor',
          profilePic: avatarUrl,
          message: followsMsg.replace(/{user}/g, 'PruebaSeguidor'),
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
      } else if (type === 'like') {
        const likesCount = 100 + Math.floor(Math.random() * 900);
        mockData = {
          type: 'like',
          user: 'SuperLiker',
          uniqueId: 'superliker',
          profilePic: avatarUrl,
          likes: likesCount,
          message: likesMsg.replace(/{user}/g, 'SuperLiker').replace(/{likes}/g, likesCount.toLocaleString()),
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
      } else if (type === 'gift_rose') {
        mockData = {
          type: 'gift',
          user: 'GifterRookie',
          uniqueId: 'gifterrookie',
          profilePic: avatarUrl,
          giftName: 'TikTok Rose',
          coins: 1,
          repeatCount: 1,
          message: giftsMsg.replace(/{user}/g, 'GifterRookie').replace(/{giftName}/g, 'TikTok Rose').replace(/{repeatCount}/g, '1').replace(/{coins}/g, '1'),
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
      } else if (type === 'gift_lion') {
        mockData = {
          type: 'gift',
          user: 'VIP_Sponsor',
          uniqueId: 'vip_sponsor',
          profilePic: avatarUrl,
          giftName: 'TikTok León',
          coins: 2999,
          repeatCount: 1,
          message: giftsMsg.replace(/{user}/g, 'VIP_Sponsor').replace(/{giftName}/g, 'TikTok León').replace(/{repeatCount}/g, '1').replace(/{coins}/g, '2999'),
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
      } else if (type === 'subscribe') {
        mockData = {
          type: 'subscribe',
          user: 'MusicCollector',
          uniqueId: 'musiccollector',
          profilePic: avatarUrl,
          message: subsMsg.replace(/{user}/g, 'MusicCollector'),
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
      }

      await window.db.collection('notifications').add(mockData);
      window.showNotification && window.showNotification(`🎮 Simulación [${type}] enviada a OBS ✓`, 'success');
    } catch(e) {
      console.error('Error al enviar alerta de simulación:', e);
      alert('❌ Error al simular: ' + e.message);
    }
  };

  window.triggerTestTopGifters = async function() {
    if (!window.db) {
      alert('❌ Error: No hay conexión a base de datos.');
      return;
    }
    
    try {
      const mockList = [
        {
          username: "zero_fan_number1",
          nickname: "Zero FM Fan #1 👑",
          profilePictureUrl: "https://i.pravatar.cc/100?img=33",
          totalAmount: 18500
        },
        {
          username: "donador_estrella",
          nickname: "Donador Estrella ⭐",
          profilePictureUrl: "https://i.pravatar.cc/100?img=12",
          totalAmount: 12400
        },
        {
          username: "musica_lover",
          nickname: "Melómano Pro",
          profilePictureUrl: "https://i.pravatar.cc/100?img=47",
          totalAmount: 9550
        },
        {
          username: "night_listener",
          nickname: "Búho Nocturno",
          profilePictureUrl: "https://i.pravatar.cc/100?img=8",
          totalAmount: 4800
        },
        {
          username: "rookie_gifter",
          nickname: "Donador Activo",
          profilePictureUrl: "https://i.pravatar.cc/100?img=22",
          totalAmount: 1250
        }
      ];

      await window.db.collection('globalStats').doc('topGifters').set({
        list: mockList,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      window.showNotification && window.showNotification('🏆 Simulación de Top Gifters enviada ✓', 'success');
    } catch(e) {
      console.error('Error al simular Top Gifters:', e);
      alert('❌ Error al simular Top Gifters: ' + e.message);
    }
  };
