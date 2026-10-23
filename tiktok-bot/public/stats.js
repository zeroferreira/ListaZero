/**
 * Módulo de Estadísticas para el Panel Admin
 * Maneja el ticker superior y el cálculo de métricas en tiempo real.
 */

(function() {
    function escapeHTML(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Utilidades internas para el ticker
    function normalizeKeyTextForTicker(v) {
      try {
        const raw = String(v || '').trim();
        if (!raw) return '';
        return raw
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ')
          .toLowerCase();
      } catch (_) {
        return String(v || '').trim().toLowerCase();
      }
    }

    function normalizeUserForTicker(u) {
      return normalizeKeyTextForTicker(u);
    }

    function isTestRequestForTicker(it) {
      try {
        if (typeof window.isTestRequestForStats === 'function') return window.isTestRequestForStats(it);
      } catch (_) {}
      const u = normalizeKeyTextForTicker(it?.usuario);
      if (!u) return true;
      if (u === 'prueba' || u.startsWith('prueba')) return true;
      const s = normalizeKeyTextForTicker(it?.cancion);
      const a = normalizeKeyTextForTicker(it?.artista);
      if (s === 'prueba' || s.startsWith('prueba')) return true;
      if (a === 'prueba' || a.startsWith('prueba')) return true;
      if (it && it.isSimulation === true) return true;
      if (it && it.isTest === true) return true;
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
      } catch (_) {}
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

    function getLocalPlayedMapForTicker() {
      try { return JSON.parse(localStorage.getItem('playedSongsMap') || localStorage.getItem('playedSongs') || '{}'); } catch (_) { return {}; }
    }

    function getLocalSkippedMapForTicker() {
      try { return JSON.parse(localStorage.getItem('skippedSongsMap') || localStorage.getItem('skippedSongs') || '{}'); } catch (_) { return {}; }
    }

    window.computeDayStatsForTicker = function(items) {
      const songCount = {}; const artistCount = {}; const userCount = {}; const genreCount = {}; 
      const artistOriginal = {}; const userOriginal = {}; const songOriginal = {};
      let totalCount = 0;
      
      for (let i = 0; i < (items || []).length; i++) {
        const it = items[i] || {};
        if (isTestRequestForTicker(it)) continue;
        
        const uNorm = normalizeUserForTicker(it.usuario);
        const song = normalizeKeyTextForTicker(it.cancion);
        const artist = normalizeKeyTextForTicker(it.artista);
        const genre = normalizeKeyTextForTicker(it.genre || it.genero);
        
        if (song && song.length > 1 && song !== 'undefined' && song !== 'null') {
            songCount[song] = (songCount[song] || 0) + 1;
            if (!songOriginal[song]) songOriginal[song] = String(it.cancion || '').trim();
        }
        if (artist && artist.length > 1 && artist !== 'undefined' && artist !== 'null') { 
            artistCount[artist] = (artistCount[artist] || 0) + 1; 
            if (!artistOriginal[artist]) artistOriginal[artist] = String(it.artista || '').trim(); 
        }
        if (uNorm && uNorm.length > 1 && uNorm !== 'undefined' && uNorm !== 'null') { 
            userCount[uNorm] = (userCount[uNorm] || 0) + 1; 
            if (!userOriginal[uNorm]) userOriginal[uNorm] = String(it.usuario || '').trim(); 
        }
        if (genre) genreCount[genre] = (genreCount[genre] || 0) + 1;
        totalCount++;
      }
      
      const day = String(document.getElementById('day-select')?.value || '').trim();
      function top(map) { let k = ''; let v = 0; for (const key in map) { const val = map[key]; if (val > v) { v = val; k = key; } } return k; }
      
      const played = getLocalPlayedMapForTicker();
      const skipped = getLocalSkippedMapForTicker();
      const playedArr = Array.isArray(played[day]) ? played[day] : [];
      const skippedArr = Array.isArray(skipped[day]) ? skipped[day] : [];
      const skippedSet = new Set(skippedArr.map(x => String(x || '')));
      const playedCount = playedArr.filter(x => !skippedSet.has(String(x || ''))).length;
      
      const topArtists3 = Object.keys(artistCount)
        .map(k => ({ k, c: artistCount[k], o: artistOriginal[k] || k }))
        .sort((a, b) => b.c - a.c)
        .slice(0, 3)
        .map(it => `${escapeHTML(it.o)} (${it.c})`);

      const usersTop3 = Object.keys(userCount)
        .map(k => ({ k, c: userCount[k], o: userOriginal[k] || k }))
        .sort((a, b) => b.c - a.c)
        .slice(0, 3)
        .map(it => `${escapeHTML(it.o)} (${it.c})`);

      return {
        topSong: songOriginal[top(songCount)] || top(songCount),
        topSongCount: songCount[top(songCount)] || 0,
        topArtist: artistOriginal[top(artistCount)] || top(artistCount),
        topArtistCount: artistCount[top(artistCount)] || 0,
        topArtists3: topArtists3,
        topUsers3: usersTop3,
        topGenre: top(genreCount) ? top(genreCount).replace(/\b\w/g, l => l.toUpperCase()) : 'N/D',
        played: playedCount,
        total: totalCount
      };
    };

    window.updateStatsTicker = function() {
      const el = document.querySelector('#stats-ticker .ticker-content');
      if (!el) return;
      if (el.getAttribute('data-react-root') === 'true') return;
      
      function fmt(x) { return x && x.length ? x : 'N/D'; }
      const items = window.__allDayItems || window.__dayItems || [];
      const g = window.__globalStats || { topSong: 'N/D', topSongCount: 0, topArtist: 'N/D', topArtistCount: 0, topArtists3: [], topUsers3: [], topPoints3: [], topGenre: 'N/D', topLiker: 'N/D', topLikerCount: 0, total: 0 };
      
      let dayText = '';
      try {
        const daySel = String(document.getElementById('day-select')?.value || '').trim();
        const now = new Date();
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const dayLabel = daySel ? (daySel === todayKey ? 'HOY' : daySel) : 'HOY';
        const ds = window.computeDayStatsForTicker(items);
        
        const latest = (typeof window.getLatestNonTestItem === 'function') ? window.getLatestNonTestItem(items) : getLatestNonTestItemForTicker(items);
        const latestTxt = latest ? (String(latest.cancion || '').trim() + (latest.artista ? ' — ' + String(latest.artista).trim() : '')) : 'N/D';
        
        dayText = '📅 <strong>' + dayLabel + '</strong>' +
          ' • <strong>🎵 Última canción solicitada:</strong> ' + fmt(escapeHTML(latestTxt)) +
          ' • <strong>🎵 Canción más pedida:</strong> ' + fmt(escapeHTML(ds.topSong)) + ' (' + (ds.topSongCount || 0) + ')' +
          ' • <strong>🎤 Artista más pedido:</strong> ' + fmt(escapeHTML(ds.topArtist)) + ' (' + (ds.topArtistCount || 0) + ')' +
          ' • <strong>🎹 Género Top:</strong> ' + fmt(escapeHTML(ds.topGenre || 'N/D')) +
          ' • <strong>▶️ Reproducidas:</strong> ' + (ds.played || 0) +
          ' • <strong>👥 Top 3 usuarios:</strong> ' + (ds.topUsers3.join(', ') || 'N/D') +
          ' • <strong>🎤 Top 3 artistas:</strong> ' + (ds.topArtists3.join(', ') || 'N/D') +
          ' • <strong>❤️ Top Liker:</strong> ' + fmt(escapeHTML(g.sessionTopLiker)) + (g.sessionTopLikerCount ? ' (' + g.sessionTopLikerCount + ')' : '') +
          ' • <strong>📝 Solicitudes:</strong> ' + (ds.total || 0);
      } catch (_) {}
      
      let avgTxt = 'N/D';
      if (typeof window.__globalTotalSolicitudes === 'number' && typeof window.__globalDistinctUsers === 'number' && window.__globalDistinctUsers > 0) {
        avgTxt = (window.__globalTotalSolicitudes / window.__globalDistinctUsers).toFixed(1);
      }
      
      const globalText = '<strong>HISTORIA:</strong>' +
        ' • <strong>🎵 Canción más pedida:</strong> ' + fmt(escapeHTML(g.topSong)) + (typeof g.topSongCount === 'number' ? ' (' + g.topSongCount + ')' : '') +
        ' • <strong>🎤 Artista más pedido:</strong> ' + fmt(escapeHTML(g.topArtist)) + (typeof g.topArtistCount === 'number' ? ' (' + g.topArtistCount + ')' : '') +
        ' • <strong>👥 Top 3 usuarios:</strong> ' + (g.topUsers3.map(escapeHTML).join(', ') || 'N/D') +
        ' • <strong>🏆 Top Puntos:</strong> ' + (Array.isArray(g.topPoints3) && g.topPoints3.length ? g.topPoints3.map(escapeHTML).join(', ') : 'N/D') +
        ' • <strong>🎤 Top 3 artistas:</strong> ' + (g.topArtists3.map(escapeHTML).join(', ') || 'N/D') +
        ' • <strong>🎹 Género Top:</strong> ' + fmt(escapeHTML(g.topGenre || 'N/D')) +
        ' • <strong>❤️ Top Liker:</strong> ' + fmt(escapeHTML(g.topLiker)) + (g.topLikerCount ? ' (' + g.topLikerCount + ')' : '') +
        ' • <strong>📊 Total solicitudes:</strong> ' + (g.total || 0) +
        ' • <strong>📈 Promedio por usuario:</strong> ' + avgTxt;
        
      const sep = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
      el.innerHTML = (dayText ? (dayText + sep) : '') + globalText;
    };

    window.refreshStatsTicker = function() {
      window.updateStatsTicker();
      try { if (typeof updateModernWidgetPure === 'function') updateModernWidgetPure(); } catch (_) {}
    };

    window.subscribeStatsTicker = function() {
      if (!window.db) { window.updateStatsTicker(); return; }
      if (window.__statsTickerUnsub) { try { window.__statsTickerUnsub(); } catch (_) {} }
      
      const docRef = window.db.collection('globalStats').doc('general');
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

      window.__statsTickerUnsub = docRef.onSnapshot({ includeMetadataChanges: true }, (doc) => {
        if (!doc || !doc.exists) return;
        // Permite actualizaciones inmediatas ignorando el flag fromCache para asegurar tiempo real
        setFromData(doc.data() || {});
        window.refreshStatsTicker();
      }, (err) => {
          console.warn("Stats Ticker Subscription Error:", err);
          window.refreshStatsTicker();
      });
      
      // Primera carga
      docRef.get().then((doc) => {
          if (doc && doc.exists) {
              setFromData(doc.data());
              window.refreshStatsTicker();
          }
      }).catch(() => {});
    };

    window.startStatsTicker = function() {
        window.refreshStatsTicker();
        if (window.__statsTickerInterval) clearInterval(window.__statsTickerInterval);
        window.__statsTickerInterval = setInterval(window.refreshStatsTicker, 60000);
        window.subscribeStatsTicker();
    };

    // Inicializar suscripción cuando el sistema esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
         setTimeout(window.startStatsTicker, 2000);
      });
    } else {
       setTimeout(window.startStatsTicker, 2000);
    }
})();
