// --- Apple Music / Cider Variables (Global) ---
    // Safe safeLocalStorage fallback wrapper for sandboxed iframes or file:// protocol restrictions
    const safeLocalStorage = (function() {
      try {
        const testKey = '__storage_test__';
        window.localStorage.setItem(testKey, testKey);
        window.localStorage.removeItem(testKey);
        return window.localStorage;
      } catch (e) {
        console.warn("safeLocalStorage is not accessible, using in-memory fallback:", e);
        const mockStorage = {};
        return {
          getItem: function(key) { return key in mockStorage ? mockStorage[key] : null; },
          setItem: function(key, value) { mockStorage[key] = String(value); },
          removeItem: function(key) { delete mockStorage[key]; },
          clear: function() { for (let k in mockStorage) delete mockStorage[k]; },
          key: function(i) { return Object.keys(mockStorage)[i] || null; },
          get length() { return Object.keys(mockStorage).length; }
        };
      }
    })();

    let ciderSocket = null;
    let lastAutoMarkedSong = ""; 

    function escapeHTML(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function toggleDebugBorders() {
      const container = document.getElementById('queue-container');
      if (container.style.border) {
        container.style.border = '';
        container.style.background = '';
      } else {
        container.style.border = '5px solid red';
        container.style.background = 'rgba(255, 0, 0, 0.2)';
      }
    }

    function toggleWidgetMover() {
      const panel = document.getElementById('widget-mover');
      if (!panel) return;
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        try { renderWidgetMoverList(); } catch (_) {}
      }
    }

    function toggleMarkPanel() {
      const panel = document.getElementById('mark-panel');
      if (!panel) return;
      panel.hidden = !panel.hidden;
    }

    let markPanelHideTimer = null;
    function showMarkPanel() {
      const panel = document.getElementById('mark-panel');
      if (!panel) return;
      if (markPanelHideTimer) {
        clearTimeout(markPanelHideTimer);
        markPanelHideTimer = null;
      }
      panel.hidden = false;
    }
    function cancelHideMarkPanel() {
      if (markPanelHideTimer) {
        clearTimeout(markPanelHideTimer);
        markPanelHideTimer = null;
      }
    }
    function scheduleHideMarkPanel() {
      const panel = document.getElementById('mark-panel');
      if (!panel) return;
      if (markPanelHideTimer) clearTimeout(markPanelHideTimer);
      markPanelHideTimer = setTimeout(() => {
        try { panel.hidden = true; } catch (_) {}
      }, 220);
    }

    function getPendingRequestsForMover() {
      let pending = allRequests.filter(req => {
        const sid = generateSongId(req);
        const did = String(req?.docId || '').trim();
        const rid = String(req?.id || '').trim();
        const nsid = normalizeId(sid);
        const ndid = normalizeId(did);
        const nrid = normalizeId(rid);
        
        const isPlayed = 
          playedSongIds.has(sid) || 
          (did && playedSongIds.has(did)) || 
          (rid && playedSongIds.has(rid)) ||
          normalizedPlayedSongIds.has(nsid) ||
          (ndid && normalizedPlayedSongIds.has(ndid)) ||
          (nrid && normalizedPlayedSongIds.has(nrid));

        return !isPlayed;
      });
      const qm = getQueueMode();
      // Aplicar base de ordenamiento
      if (qm === 'recent' || qm === 'manual_recent') {
        pending.sort((a, b) => getReqTimeMs(b) - getReqTimeMs(a));
      } else if (qm === 'smart') {
        pending = applySmartOrder(pending);
      } else if (qm === 'tandas15') {
        pending = applyTandas15Order(pending);
      } else {
        pending.sort((a, b) => getReqTimeMs(a) - getReqTimeMs(b));
      }

      // Aplicar orden manual encima de cualquier modo
      if (currentManualOrder && currentManualOrder.length > 0) {
        pending = applyOrder(pending, currentManualOrder);
      }
      return pending;
    }

    function getEquivalentManualQueueMode() {
      const qm = getQueueMode();
      return (qm === 'recent' || qm === 'manual_recent') ? 'manual_recent' : 'manual_fifo';
    }

    async function activateManualQueueModeForWidget() {
      const mode = getEquivalentManualQueueMode();
      try {
        window.__QUEUE_MODE__ = mode;
        safeLocalStorage.setItem('queueMode', mode);
      } catch (_) {}
      if (!db || !firebase?.firestore?.FieldValue) return;
      try {
        await db.collection('system').doc('status').set({
          queueMode: mode,
          lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
          forcedBy: 'widget-mover'
        }, { merge: true });
      } catch (_) {}
    }

    async function persistManualOrder(orderArr) {
      currentManualOrder = Array.isArray(orderArr) ? orderArr : [];
      try { safeLocalStorage.setItem(`manualOrder:${currentDay}`, JSON.stringify(currentManualOrder)); } catch (_) {}
      if (!db || !firebase?.firestore?.FieldValue) return;
      try {
        await db.collection('manualOrders').doc(currentDay).set({
          order: currentManualOrder,
          day: currentDay,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (_) {}
    }

    async function resetManualOrder() {
      await persistManualOrder([]);
      try { renderQueue(); } catch (_) {}
      try { renderWidgetMoverList(); } catch (_) {}
    }

    function flashReorderElement(el, options = {}) {
      if (!el) return;
      const duration = Number(options.duration) || 900;
      const useInner = options.useInner !== false;
      const target = useInner ? (el.querySelector('.queue-item-inner') || el) : el;
      const prevTransition = target.style.transition || '';
      const prevBoxShadow = target.style.boxShadow || '';
      const prevOutline = target.style.outline || '';
      const prevBackground = target.style.background || '';
      const prevTransform = target.style.transform || '';

      target.style.transition = 'box-shadow 0.18s ease, outline 0.18s ease, background 0.18s ease, transform 0.18s ease';
      target.style.boxShadow = '0 0 0 2px rgba(0,229,255,0.75), 0 0 28px rgba(0,229,255,0.32)';
      target.style.outline = '1px solid rgba(0,229,255,0.95)';
      target.style.background = options.background || 'rgba(0,229,255,0.12)';
      target.style.transform = 'scale(1.01)';

      clearTimeout(target.__reorderFlashTimer);
      target.__reorderFlashTimer = setTimeout(() => {
        target.style.boxShadow = prevBoxShadow;
        target.style.outline = prevOutline;
        target.style.background = prevBackground;
        target.style.transform = prevTransform;
        target.style.transition = prevTransition;
      }, duration);
    }

    function highlightReorderedKey(key) {
      if (!key) return;
      try {
        const widgetRows = Array.from(document.querySelectorAll('#widget-mover-list [data-key]'));
        const widgetRow = widgetRows.find(el => String(el.dataset.key || '') === String(key));
        if (widgetRow) flashReorderElement(widgetRow, { useInner: false, background: 'rgba(0,229,255,0.10)' });
      } catch (_) {}

      try {
        const queueCards = Array.from(document.querySelectorAll('#queue-container .queue-item'));
        const queueCard = queueCards.find(el => {
          const elKey = String(el.dataset.docId || el.dataset.songId || '');
          return elKey === String(key);
        });
        if (queueCard) flashReorderElement(queueCard, { useInner: true, background: 'rgba(0,229,255,0.10)' });
      } catch (_) {}
    }

    function renderWidgetMoverList() {
      const list = document.getElementById('widget-mover-list');
      if (!list) return;
      list.innerHTML = '';

      const pending = getPendingRequestsForMover();
      if (!pending.length) {
        const empty = document.createElement('div');
        empty.textContent = 'No hay canciones pendientes.';
        empty.style.opacity = '0.85';
        list.appendChild(empty);
        return;
      }

      const orderKeys = pending.map(req => String(req?.docId || req?.id || generateSongId(req) || '')).filter(Boolean);

      let draggingKey = null;

      const render = () => {
        list.innerHTML = '';
        orderKeys.forEach((key, idx) => {
          const req = pending.find(r => String(r?.docId || r?.id || generateSongId(r) || '') === key);
          const cancion = (req?.cancion || req?.songName || req?.song || req?.name || '').trim();
          const artista = (req?.artista || req?.artistName || req?.artist || '').trim();
          const usuario = (req?.displayName || req?.usuario || req?.user || req?.username || '').trim();

          const row = document.createElement('div');
          row.draggable = true;
          row.dataset.key = key;
          row.style.display = 'grid';
          row.style.gridTemplateColumns = '40px minmax(0, 1fr) auto';
          row.style.gap = '12px';
          row.style.alignItems = 'center';
          row.style.padding = '12px';
          row.style.borderRadius = '14px';
          row.style.border = '1px solid rgba(255,255,255,0.16)';
          row.style.background = 'rgba(255,255,255,0.07)';
          row.style.cursor = 'grab';
          row.style.userSelect = 'none';
          row.style.boxShadow = '0 6px 18px rgba(0,0,0,0.16)';

          const left = document.createElement('div');
          left.textContent = String(idx + 1);
          left.style.width = '40px';
          left.style.height = '40px';
          left.style.borderRadius = '12px';
          left.style.display = 'flex';
          left.style.alignItems = 'center';
          left.style.justifyContent = 'center';
          left.style.fontWeight = '900';
          left.style.fontSize = '18px';
          left.style.background = 'rgba(0,229,255,0.16)';
          left.style.border = '1px solid rgba(0,229,255,0.55)';
          left.style.color = '#fff';

          const mid = document.createElement('div');
          mid.style.display = 'flex';
          mid.style.flexDirection = 'column';
          mid.style.gap = '4px';
          mid.style.minWidth = '0';
          mid.style.flex = '1';

          const header = document.createElement('div');
          header.textContent = 'En cola';
          header.style.fontSize = '11px';
          header.style.textTransform = 'uppercase';
          header.style.letterSpacing = '1px';
          header.style.fontWeight = '800';
          header.style.color = 'rgba(0,229,255,0.95)';

          const title = document.createElement('div');
          title.textContent = cancion || 'Desconocida';
          title.style.fontWeight = '900';
          title.style.fontSize = '16px';
          title.style.lineHeight = '1.15';
          title.style.whiteSpace = 'nowrap';
          title.style.overflow = 'hidden';
          title.style.textOverflow = 'ellipsis';

          const artistLine = document.createElement('div');
          artistLine.textContent = artista || 'Artista desconocido';
          artistLine.style.fontSize = '13px';
          artistLine.style.opacity = '0.9';
          artistLine.style.whiteSpace = 'nowrap';
          artistLine.style.overflow = 'hidden';
          artistLine.style.textOverflow = 'ellipsis';

          const sub = document.createElement('div');
          sub.textContent = `Pedido por ${usuario || 'Anónimo'}`;
          sub.style.fontSize = '12px';
          sub.style.opacity = '0.82';
          sub.style.whiteSpace = 'nowrap';
          sub.style.overflow = 'hidden';
          sub.style.textOverflow = 'ellipsis';

          mid.appendChild(header);
          mid.appendChild(title);
          mid.appendChild(artistLine);
          mid.appendChild(sub);

          const actions = document.createElement('div');
          actions.style.display = 'flex';
          actions.style.flexDirection = 'column';
          actions.style.alignItems = 'center';
          actions.style.gap = '8px';

          const grip = document.createElement('div');
          grip.textContent = '⋮⋮';
          grip.style.opacity = '0.7';
          grip.style.fontWeight = '900';
          grip.style.padding = '0 2px';
          grip.style.cursor = 'grab';
          grip.style.lineHeight = '1';
          grip.style.fontSize = '18px';

          // Botón Top para mover al inicio
          const topBtn = document.createElement('button');
          topBtn.innerHTML = '⬆️';
          topBtn.title = 'Mover al inicio';
          topBtn.style.width = '40px';
          topBtn.style.height = '36px';
          topBtn.style.background = 'rgba(255,255,255,0.10)';
          topBtn.style.border = '1px solid rgba(255,255,255,0.18)';
          topBtn.style.color = '#fff';
          topBtn.style.borderRadius = '10px';
          topBtn.style.cursor = 'pointer';
          topBtn.style.padding = '0';
          topBtn.style.fontSize = '14px';
          topBtn.onclick = async (e) => {
             e.stopPropagation();
             const currentIdx = orderKeys.indexOf(key);
             if (currentIdx > 0) {
                 // Mover al principio del array
                 const item = orderKeys.splice(currentIdx, 1)[0];
                 orderKeys.unshift(item);
                 
                 // Guardar y renderizar
                 await persistManualOrder([...orderKeys]); // Clonar por seguridad
                 await activateManualQueueModeForWidget();
                 try { renderQueue(); } catch (_) {}
                 render();
                 highlightReorderedKey(item);
             }
          };

          row.appendChild(left);
          row.appendChild(mid);
          actions.appendChild(topBtn);
          actions.appendChild(grip);
          row.appendChild(actions);

          row.addEventListener('dragstart', (e) => {
            draggingKey = key;
            try {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.dropEffect = 'move';
              e.dataTransfer.setData('text/plain', key);
            } catch (_) {}
          });
          row.addEventListener('dragover', (e) => {
            e.preventDefault();
            try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
          });
          row.addEventListener('drop', async (e) => {
            e.preventDefault();
            const targetKey = row.dataset.key;
            if (!draggingKey || !targetKey || draggingKey === targetKey) return;
            const from = orderKeys.indexOf(draggingKey);
            const to = orderKeys.indexOf(targetKey);
            if (from < 0 || to < 0) return;
            orderKeys.splice(from, 1);
            orderKeys.splice(to, 0, draggingKey);
            await persistManualOrder(orderKeys.slice());
            await activateManualQueueModeForWidget();
            try { renderQueue(); } catch (_) {}
            render();
            highlightReorderedKey(draggingKey);
          });

          list.appendChild(row);
        });
      };

      render();
    }
    
    // --- Configuración / Settings Logic ---
    function switchTab(tabName) {
      // Buttons
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.toLowerCase().includes(tabName) || 
            (tabName === 'data' && btn.innerText.includes('Datos'))) {
           // Simple check based on text or click handler
        }
      });
      // But simpler: just use event.target or match logic
      const tabs = ['general', 'appearance', 'animations', 'data'];
      tabs.forEach(t => {
        const content = document.getElementById('tab-' + t);
        if (content) {
            content.classList.toggle('active', t === tabName);
        }
      });
      
      // Update buttons visual state
      const btns = document.querySelectorAll('.tab-btn');
      btns.forEach(btn => {
         // Check if this button corresponds to tabName
         const onclick = btn.getAttribute('onclick');
         if (onclick && onclick.includes(`'${tabName}'`)) {
             btn.classList.add('active');
         } else {
             btn.classList.remove('active');
         }
      });
    }

    const defaultSettings = {
      theme: 'classic',
      width: 350,
      minHeight: 80,
      spacing: 15,
      padding: 15,
      textGap: 4,
      borderRadius: 6,
      showHeader: true,
      showArtist: true,
      showUser: true,
      showEmpty: true,
      animEntry: 'anim-entry-slide-left',
      animExit: 'anim-exit-slide-right',
      font: "'Montserrat', sans-serif",
      fontSize: 16,
      accent: "#00e5ff",
      bg: "#000000",
      primaryOpacity: 100,
      secondaryOpacity: 60,
      text: "#ffffff",
      // New Data/API Settings
      autocorrect: false,
      showAlbumArt: true,
      showWaitTime: true,
      showTotalDuration: true,
      syncAppleMusic: true,
      // Visual Scaling
       maxCards: 3,
       widthScale: 1.0,
       heightScale: 1.0,
       
      // Visual Customizations (Borders & Shadows)
      showCardBg: true,
      borderWidth: 0,
      borderColor: "#ffffff",
      borderOpacity: 15,
      borderStyle: "solid",
      showAccentBorder: true,
      accentBorderWidth: 5,
      showShadow: true,
      shadowColor: "#000000",
      shadowBlur: 15,
      shadowOpacity: 40,
      showSweepBorder: true
     };
 
     window.appliedSettings = { ...defaultSettings };

    function loadSettings() {
      const saved = safeLocalStorage.getItem('queue_overlay_settings');
      // Merge saved with default to ensure new keys exist
      const settings = saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
      
      // Ensure animEntry is valid
      if (!settings.animEntry) settings.animEntry = defaultSettings.animEntry;
      if (!settings.animExit) settings.animExit = defaultSettings.animExit;
      
      applySettings(settings);
      
      // Update Inputs
      if (document.getElementById('inp-width')) {
        document.getElementById('inp-width').value = settings.width;
        document.getElementById('inp-minHeight').value = settings.minHeight;
        document.getElementById('inp-spacing').value = settings.spacing !== undefined ? settings.spacing : 15;
        document.getElementById('inp-padding').value = settings.padding !== undefined ? settings.padding : 15;
        document.getElementById('inp-textGap').value = settings.textGap !== undefined ? settings.textGap : 4;
        document.getElementById('inp-borderRadius').value = settings.borderRadius;
        
        document.getElementById('inp-showHeader').checked = settings.showHeader !== undefined ? settings.showHeader : true;
        document.getElementById('inp-showArtist').checked = settings.showArtist !== undefined ? settings.showArtist : true;
        document.getElementById('inp-showUser').checked = settings.showUser !== undefined ? settings.showUser : true;
        document.getElementById('inp-showEmpty').checked = settings.showEmpty !== undefined ? settings.showEmpty : true;

        document.getElementById('inp-animEntry').value = settings.animEntry;
        document.getElementById('inp-animExit').value = settings.animExit;
        
        document.getElementById('inp-font').value = settings.font;
        document.getElementById('inp-fontSize').value = settings.fontSize;
        document.getElementById('inp-accent').value = settings.accent;
        document.getElementById('inp-bg').value = settings.bg;
        
        const primaryOpacityVal = settings.primaryOpacity !== undefined ? settings.primaryOpacity : 100;
        document.getElementById('inp-primaryOpacity').value = primaryOpacityVal;
        document.getElementById('primary-opacity-val').innerText = primaryOpacityVal + '%';

        const opacityVal = settings.secondaryOpacity !== undefined ? settings.secondaryOpacity : 60;
        document.getElementById('inp-secondaryOpacity').value = opacityVal;
        document.getElementById('opacity-val').innerText = opacityVal + '%';

        const maxCardsVal = settings.maxCards !== undefined ? settings.maxCards : 3;
        document.getElementById('inp-maxCards').value = maxCardsVal;
        document.getElementById('max-cards-val').innerText = maxCardsVal;

        const widthScaleVal = settings.widthScale !== undefined ? settings.widthScale : 1.0;
         document.getElementById('inp-widthScale').value = widthScaleVal;
         document.getElementById('width-scale-val').innerText = widthScaleVal + 'x';

         const heightScaleVal = settings.heightScale !== undefined ? settings.heightScale : 1.0;
         document.getElementById('inp-heightScale').value = heightScaleVal;
         document.getElementById('height-scale-val').innerText = heightScaleVal + 'x';
    
         document.getElementById('inp-text').value = settings.text;
        
        // New Inputs
        document.getElementById('inp-autocorrect').checked = settings.autocorrect !== undefined ? settings.autocorrect : false;
        document.getElementById('inp-showAlbumArt').checked = settings.showAlbumArt !== undefined ? settings.showAlbumArt : false;
        document.getElementById('inp-showWaitTime').checked = settings.showWaitTime !== undefined ? settings.showWaitTime : false;
        document.getElementById('inp-showTotalDuration').checked = settings.showTotalDuration !== undefined ? settings.showTotalDuration : false;
        document.getElementById('inp-syncAppleMusic').checked = settings.syncAppleMusic !== undefined ? settings.syncAppleMusic : false;
        if (document.getElementById('inp-theme')) {
          document.getElementById('inp-theme').value = settings.theme || 'classic';
        }
      }

      // Visual Customizations (Borders & Shadows)
      if (document.getElementById('inp-showCardBg')) {
        document.getElementById('inp-showCardBg').checked = settings.showCardBg !== undefined ? settings.showCardBg : true;
        document.getElementById('inp-borderWidth').value = settings.borderWidth !== undefined ? settings.borderWidth : 0;
        document.getElementById('inp-borderColor').value = settings.borderColor || '#ffffff';
        
        const bOpVal = settings.borderOpacity !== undefined ? settings.borderOpacity : 15;
        document.getElementById('inp-borderOpacity').value = bOpVal;
        document.getElementById('border-opacity-val').innerText = bOpVal + '%';
        
        document.getElementById('inp-borderStyle').value = settings.borderStyle || 'solid';
        document.getElementById('inp-showAccentBorder').checked = settings.showAccentBorder !== undefined ? settings.showAccentBorder : true;
        document.getElementById('inp-accentBorderWidth').value = settings.accentBorderWidth !== undefined ? settings.accentBorderWidth : 5;
        document.getElementById('inp-showShadow').checked = settings.showShadow !== undefined ? settings.showShadow : true;
        document.getElementById('inp-shadowColor').value = settings.shadowColor || '#000000';
        document.getElementById('inp-shadowBlur').value = settings.shadowBlur !== undefined ? settings.shadowBlur : 15;
        
        const sOpVal = settings.shadowOpacity !== undefined ? settings.shadowOpacity : 40;
        document.getElementById('inp-shadowOpacity').value = sOpVal;
        document.getElementById('shadow-opacity-val').innerText = sOpVal + '%';
        
        document.getElementById('inp-showSweepBorder').checked = settings.showSweepBorder !== undefined ? settings.showSweepBorder : true;
      }
    }

    function applySettings(s) {
      // Si el panel de configuración local está abierto, estamos editando/previsualizando localmente.
      // En ese caso, omitimos los overrides del dashboard remoto para que se pueda ver el cambio en tiempo real.
      const isConfiguringLocally = document.getElementById('settings-panel')?.classList.contains('open');
      
      if (!isConfiguringLocally) {
        // Apply specific overrides if window variables exist (from Firestore overlayAlertsConfig snapshot)
        if (window.queueOpacityOverride !== undefined) s.primaryOpacity = window.queueOpacityOverride * 100;
        if (window.queueRadiusOverride !== undefined) s.borderRadius = window.queueRadiusOverride;
        if (window.queueFontSizeOverride !== undefined) s.fontSize = window.queueFontSizeOverride;
        
        if (window.queueShowCardBgOverride !== undefined) s.showCardBg = window.queueShowCardBgOverride;
        if (window.queueBorderWidthOverride !== undefined) s.borderWidth = window.queueBorderWidthOverride;
        if (window.queueBorderColorOverride !== undefined) s.borderColor = window.queueBorderColorOverride;
        if (window.queueBorderOpacityOverride !== undefined) s.borderOpacity = window.queueBorderOpacityOverride;
        if (window.queueBorderStyleOverride !== undefined) s.borderStyle = window.queueBorderStyleOverride;
        if (window.queueShowAccentBorderOverride !== undefined) s.showAccentBorder = window.queueShowAccentBorderOverride;
        if (window.queueAccentBorderWidthOverride !== undefined) s.accentBorderWidth = window.queueAccentBorderWidthOverride;
        if (window.queueShowShadowOverride !== undefined) s.showShadow = window.queueShowShadowOverride;
        if (window.queueShadowColorOverride !== undefined) s.shadowColor = window.queueShadowColorOverride;
        if (window.queueShadowBlurOverride !== undefined) s.shadowBlur = window.queueShadowBlurOverride;
        if (window.queueShadowOpacityOverride !== undefined) s.shadowOpacity = window.queueShadowOpacityOverride;
        if (window.queueShowSweepBorderOverride !== undefined) s.showSweepBorder = window.queueShowSweepBorderOverride;

        // Nuevos overrides específicos agregados del dashboard
        if (window.queueThemeOverride !== undefined) s.theme = window.queueThemeOverride;
        if (window.queueWidthOverride !== undefined) s.width = window.queueWidthOverride;
        if (window.queueMinHeightOverride !== undefined) s.minHeight = window.queueMinHeightOverride;
        if (window.queueSpacingOverride !== undefined) s.spacing = window.queueSpacingOverride;
        if (window.queuePaddingOverride !== undefined) s.padding = window.queuePaddingOverride;
        if (window.queueTextGapOverride !== undefined) s.textGap = window.queueTextGapOverride;
        if (window.queueShowHeaderOverride !== undefined) s.showHeader = window.queueShowHeaderOverride;
        if (window.queueShowArtistOverride !== undefined) s.showArtist = window.queueShowArtistOverride;
        if (window.queueShowUserOverride !== undefined) s.showUser = window.queueShowUserOverride;
        if (window.queueShowEmptyOverride !== undefined) s.showEmpty = window.queueShowEmptyOverride;
        if (window.queueFontOverride !== undefined) s.font = window.queueFontOverride;
        if (window.queueAccentColorOverride !== undefined) s.accent = window.queueAccentColorOverride;
        if (window.queueBgColorOverride !== undefined) s.bg = window.queueBgColorOverride;
        if (window.queueTextColorOverride !== undefined) s.text = window.queueTextColorOverride;
        if (window.queuePrimaryOpacityOverride !== undefined) s.primaryOpacity = window.queuePrimaryOpacityOverride;
        if (window.queueSecondaryOpacityOverride !== undefined) s.secondaryOpacity = window.queueSecondaryOpacityOverride;
        if (window.queueMaxCardsOverride !== undefined) s.maxCards = window.queueMaxCardsOverride;
        if (window.queueWidthScaleOverride !== undefined) s.widthScale = window.queueWidthScaleOverride;
        if (window.queueHeightScaleOverride !== undefined) s.heightScale = window.queueHeightScaleOverride;
        if (window.queueAnimEntryOverride !== undefined) s.animEntry = window.queueAnimEntryOverride;
        if (window.queueAnimExitOverride !== undefined) s.animExit = window.queueAnimExitOverride;
        if (window.queueAutocorrectOverride !== undefined) s.autocorrect = window.queueAutocorrectOverride;
        if (window.queueShowAlbumArtOverride !== undefined) s.showAlbumArt = window.queueShowAlbumArtOverride;
        if (window.queueShowWaitTimeOverride !== undefined) s.showWaitTime = window.queueShowWaitTimeOverride;
        if (window.queueShowTotalDurationOverride !== undefined) s.showTotalDuration = window.queueShowTotalDurationOverride;
        if (window.queueSyncAppleMusicOverride !== undefined) s.syncAppleMusic = window.queueSyncAppleMusicOverride;
      }

      window.appliedSettings = s;
      const root = document.documentElement;
      // Aplicar escala de anchura
      const baseWidth = s.width || 350;
      const scale = s.widthScale || 1.0;
      root.style.setProperty('--queue-width', (baseWidth * scale) + 'px');
      
      // Ajustar altura mínima dinámicamente según cantidad de tarjetas y escala
       // Si hay más de 3 tarjetas, reducimos la altura proporcionalmente para que quepan mejor
       let baseMinHeight = s.minHeight || 80;
       let adjustedMinHeight = baseMinHeight;
       if (s.maxCards > 3) {
           // Factor de reducción: 0.9x para 4, 0.8x para 5, 0.7x para 6
           const reductionFactor = 1 - ((s.maxCards - 3) * 0.1);
           adjustedMinHeight = Math.floor(adjustedMinHeight * reductionFactor);
       }
       // Aplicar escala de altura final
       const heightScale = s.heightScale || 1.0;
       // Aplicar min-height ajustado
       root.style.setProperty('--queue-item-min-height', Math.floor(adjustedMinHeight * heightScale) + 'px');
       
       // FIX: Escalar también los paddings y espacios verticales para permitir tarjetas más delgadas
       const padding = (s.padding !== undefined ? s.padding : 15);
       const textGap = (s.textGap !== undefined ? s.textGap : 4);
       
       // Escalar espaciados si reducimos la altura base (< 80) o la escala (< 1.0)
       const minHeightScaleFactor = baseMinHeight < 80 ? (baseMinHeight / 80) : 1.0;
       const verticalScale = (heightScale < 1.0 ? heightScale : 1.0) * minHeightScaleFactor;
       
       root.style.setProperty('--queue-item-spacing', (s.spacing !== undefined ? s.spacing : 15) + 'px');
       root.style.setProperty('--queue-padding', Math.floor(padding * verticalScale) + 'px');
       root.style.setProperty('--queue-text-gap', Math.floor(textGap * verticalScale) + 'px');
       root.style.setProperty('--queue-border-radius', s.borderRadius + 'px');
      
      // Set Global Animation Classes on Container
      const container = document.getElementById('queue-container');
      if (container) {
        container.classList.remove('theme-classic', 'theme-neon-glass', 'theme-vision');
        container.classList.add(`theme-${s.theme || 'classic'}`);
      }
      
      // Lista segura de clases de animación para limpiar
      const animationClasses = [
          'anim-entry-slide-left', 'anim-entry-slide-up', 'anim-entry-fade', 'anim-entry-zoom',
          'anim-exit-slide-right', 'anim-exit-slide-down', 'anim-exit-fade', 'anim-exit-zoom'
      ];
      
      // Remover solo las clases de animación, conservando otras (ej: layout, estado)
      container.classList.remove(...animationClasses);
      
      // Añadir las seleccionadas
      if (s.animEntry) container.classList.add(s.animEntry);
      if (s.animExit) container.classList.add(s.animExit);
      
      // Toggle visibility classes
      container.classList.toggle('hide-header', s.showHeader === false);
      container.classList.toggle('hide-artist', s.showArtist === false);
      container.classList.toggle('hide-user', s.showUser === false);

      // Empty State visibility logic moved to renderQueue or handled here via CSS class if needed
      // But renderQueue controls the DOM, so we store the setting in a global var or dataset
      container.dataset.showEmpty = s.showEmpty;
      const emptyState = document.getElementById('empty-state');
      if (emptyState) {
         // Si se debe mostrar el mensaje de vacío y no hay elementos visibles en la cola
         // Verificamos si hay elementos .queue-item en el contenedor
         const hasItems = container.querySelectorAll('.queue-item:not(.removing)').length > 0;
         
         if (s.showEmpty && !hasItems) { 
             emptyState.classList.add('visible');
         } else {
             emptyState.classList.remove('visible');
         }
      }

      root.style.setProperty('--queue-font-family', s.font);
      
      // FIX: Escalar fuente si reducimos mucho la altura para que no se corte
       const baseFontSize = s.fontSize || 16;
       let fontScale = 1.0;
       const combinedHeightScale = heightScale * (baseMinHeight < 80 ? (baseMinHeight / 80) : 1.0);
       if (combinedHeightScale < 0.8) fontScale = combinedHeightScale * 1.2; // Reducción suave
       if (fontScale > 1.0) fontScale = 1.0;
       
       const calculatedSize = Math.max(10, Math.floor(baseFontSize * fontScale));
       root.style.setProperty('--queue-font-size', calculatedSize + 'px');
       root.style.setProperty('--queue-font-scale', (calculatedSize / 20).toFixed(4));
       root.style.setProperty('--queue-accent-color', s.accent);
      if (s.accent && s.accent.startsWith('#')) {
        const ar = parseInt(s.accent.substr(1,2), 16);
        const ag = parseInt(s.accent.substr(3,2), 16);
        const ab = parseInt(s.accent.substr(5,2), 16);
        if (!isNaN(ar) && !isNaN(ag) && !isNaN(ab)) {
          root.style.setProperty('--queue-accent-rgb', `${ar}, ${ag}, ${ab}`);
        }
      }

      root.style.setProperty('--queue-text-color', s.text);
      if (s.text && s.text.startsWith('#')) {
        const tr = parseInt(s.text.substr(1,2), 16);
        const tg = parseInt(s.text.substr(3,2), 16);
        const tb = parseInt(s.text.substr(5,2), 16);
        if (!isNaN(tr) && !isNaN(tg) && !isNaN(tb)) {
          root.style.setProperty('--queue-text-rgb', `${tr}, ${tg}, ${tb}`);
        }
      }
      
      const r = parseInt(s.bg.substr(1,2), 16);
      const g = parseInt(s.bg.substr(3,2), 16);
      const b = parseInt(s.bg.substr(5,2), 16);
      root.style.setProperty('--queue-bg-rgb', `${r}, ${g}, ${b}`);
      
      const primaryOpacity = (s.primaryOpacity !== undefined ? s.primaryOpacity : 100) / 100;
      const opacity = (s.secondaryOpacity !== undefined ? s.secondaryOpacity : 60) / 100;
      const tertiaryOpacity = Math.max(0, opacity * 0.5); // 50% de la opacidad secundaria
      
      // Visual Customizations (Borders & Shadows)
      const bColor = s.borderColor || '#ffffff';
      const br = parseInt(bColor.substr(1,2), 16);
      const bg_val = parseInt(bColor.substr(3,2), 16);
      const bb = parseInt(bColor.substr(5,2), 16);
      const bOp = (s.borderOpacity !== undefined ? s.borderOpacity : 15) / 100;
      
      root.style.setProperty('--queue-border-width', (s.borderWidth !== undefined ? s.borderWidth : 0) + 'px');
      root.style.setProperty('--queue-border-color', `rgba(${br},${bg_val},${bb},${bOp})`);
      root.style.setProperty('--queue-border-style', s.borderStyle || 'solid');
      
      const showAccent = s.showAccentBorder !== undefined ? s.showAccentBorder : true;
      const accWidth = showAccent ? (s.accentBorderWidth !== undefined ? s.accentBorderWidth : 5) : 0;
      root.style.setProperty('--queue-accent-border-width', accWidth + 'px');
      
      root.style.setProperty('--queue-sweep-display', (s.showSweepBorder !== undefined ? s.showSweepBorder : true) ? 'block' : 'none');

      const showBg = s.showCardBg !== undefined ? s.showCardBg : true;
      if (!showBg) {
        root.style.setProperty('--queue-bg-color', 'transparent');
        root.style.setProperty('--queue-bg-color-transparent', 'transparent');
        root.style.setProperty('--queue-bg-color-tertiary', 'transparent');
        root.style.setProperty('--queue-box-shadow', 'none');
        document.querySelectorAll('.queue-item-inner').forEach(el => el.classList.add('no-card-bg'));
      } else {
        document.querySelectorAll('.queue-item-inner').forEach(el => el.classList.remove('no-card-bg'));
        root.style.setProperty('--queue-bg-color', `rgba(${r},${g},${b},${primaryOpacity})`);
        root.style.setProperty('--queue-bg-color-transparent', `rgba(${r},${g},${b},${opacity})`);
        root.style.setProperty('--queue-bg-color-tertiary', `rgba(${r},${g},${b},${tertiaryOpacity})`);
        
        let shadowStr = '0 5px 15px rgba(0,0,0,0.4)';
        if (s.theme === 'neon-glass') {
          shadowStr = '0 0 20px rgba(var(--queue-accent-rgb, 0, 229, 255), 0.25), inset 0 0 12px rgba(var(--queue-accent-rgb, 0, 229, 255), 0.1)';
        } else if (s.theme === 'vision') {
          shadowStr = 'inset 0 1px 1px rgba(255, 255, 255, 0.2), 0 8px 30px rgba(0, 0, 0, 0.35)';
        }

        const showShadow = s.showShadow !== undefined ? s.showShadow : true;
        if (!showShadow) {
          root.style.setProperty('--queue-box-shadow', 'none');
        } else if (s.shadowBlur !== undefined && s.shadowOpacity !== undefined) {
          const shColor = s.shadowColor || '#000000';
          const shr = parseInt(shColor.substr(1,2), 16);
          const shg = parseInt(shColor.substr(3,2), 16);
          const shb = parseInt(shColor.substr(5,2), 16);
          const shop = s.shadowOpacity / 100;
          
          root.style.setProperty('--queue-box-shadow', `0 ${Math.round(s.shadowBlur/3)}px ${s.shadowBlur}px rgba(${shr},${shg},${shb},${shop})`);
        } else {
          root.style.setProperty('--queue-box-shadow', shadowStr);
        }
      }
      root.style.setProperty('--queue-primary-opacity', primaryOpacity);
      root.style.setProperty('--queue-secondary-opacity', opacity);
      
      // Force render queue to update empty state based on new settings if needed
      if (typeof renderQueue === 'function' && window.allRequests) {
        renderQueue(); 
      }

      // Cider Connection
      if (s.syncAppleMusic) {
        connectCider();
      }
    }

    function getSettingsFromInputs() {
      const getNum = (id, fallback) => {
        const el = document.getElementById(id);
        if (!el) return fallback;
        const val = el.value;
        const num = Number(val);
        return isNaN(num) || val === '' ? fallback : num;
      };
      return {
        theme: document.getElementById('inp-theme') ? document.getElementById('inp-theme').value : 'classic',
        width: getNum('inp-width', 350),
        minHeight: getNum('inp-minHeight', 80),
        spacing: getNum('inp-spacing', 15),
        padding: getNum('inp-padding', 15),
        textGap: getNum('inp-textGap', 4),
        borderRadius: getNum('inp-borderRadius', 6),
        showHeader: document.getElementById('inp-showHeader').checked,
        showArtist: document.getElementById('inp-showArtist').checked,
        showUser: document.getElementById('inp-showUser').checked,
        showEmpty: document.getElementById('inp-showEmpty').checked,
        animEntry: document.getElementById('inp-animEntry').value,
        animExit: document.getElementById('inp-animExit').value,
        font: document.getElementById('inp-font').value,
        fontSize: getNum('inp-fontSize', 16),
        accent: document.getElementById('inp-accent').value,
        bg: document.getElementById('inp-bg').value,
        primaryOpacity: getNum('inp-primaryOpacity', 100),
        secondaryOpacity: getNum('inp-secondaryOpacity', 60),
        maxCards: getNum('inp-maxCards', 3),
        widthScale: getNum('inp-widthScale', 1.0),
        heightScale: getNum('inp-heightScale', 1.0),
        text: document.getElementById('inp-text').value,
        // New inputs
        autocorrect: document.getElementById('inp-autocorrect').checked,
        showAlbumArt: document.getElementById('inp-showAlbumArt').checked,
        showWaitTime: document.getElementById('inp-showWaitTime').checked,
        showTotalDuration: document.getElementById('inp-showTotalDuration').checked,
        syncAppleMusic: document.getElementById('inp-syncAppleMusic').checked,
        
        // Visual Customizations (Borders & Shadows)
        showCardBg: document.getElementById('inp-showCardBg') ? document.getElementById('inp-showCardBg').checked : true,
        borderWidth: getNum('inp-borderWidth', 0),
        borderColor: document.getElementById('inp-borderColor') ? document.getElementById('inp-borderColor').value : '#ffffff',
        borderOpacity: getNum('inp-borderOpacity', 15),
        borderStyle: document.getElementById('inp-borderStyle') ? document.getElementById('inp-borderStyle').value : 'solid',
        showAccentBorder: document.getElementById('inp-showAccentBorder') ? document.getElementById('inp-showAccentBorder').checked : true,
        accentBorderWidth: getNum('inp-accentBorderWidth', 5),
        showShadow: document.getElementById('inp-showShadow') ? document.getElementById('inp-showShadow').checked : true,
        shadowColor: document.getElementById('inp-shadowColor') ? document.getElementById('inp-shadowColor').value : '#000000',
        shadowBlur: getNum('inp-shadowBlur', 15),
        shadowOpacity: getNum('inp-shadowOpacity', 40),
        showSweepBorder: document.getElementById('inp-showSweepBorder') ? document.getElementById('inp-showSweepBorder').checked : true
      };
    }

    function initSettingsListeners() {
        // Text/Number inputs
        ['inp-theme', 'inp-width', 'inp-minHeight', 'inp-spacing', 'inp-padding', 'inp-textGap', 'inp-borderRadius', 'inp-animEntry', 'inp-animExit', 
         'inp-font', 'inp-fontSize', 'inp-accent', 'inp-bg', 'inp-primaryOpacity', 'inp-secondaryOpacity', 'inp-text', 'inp-maxCards', 'inp-widthScale', 'inp-heightScale',
         'inp-showCardBg', 'inp-borderWidth', 'inp-borderColor', 'inp-borderOpacity', 'inp-borderStyle', 'inp-showAccentBorder', 'inp-accentBorderWidth',
         'inp-showShadow', 'inp-shadowColor', 'inp-shadowBlur', 'inp-shadowOpacity', 'inp-showSweepBorder'].forEach(id => {
           const el = document.getElementById(id);
           if(el) {
             el.addEventListener('input', previewSettings);
             el.addEventListener('change', previewSettings);
           }
         });
         
        // Preset de valores predefinidos según el tema seleccionado
        const themeDefaults = {
          classic: {
            spacing: 15,
            padding: 15,
            borderRadius: 6
          },
          'neon-glass': {
            spacing: 20,
            padding: 16,
            borderRadius: 24
          },
          vision: {
            spacing: 18,
            padding: 16,
            borderRadius: 30
          }
        };

        const themeSelect = document.getElementById('inp-theme');
        if (themeSelect) {
          let lastTheme = themeSelect.value;
          themeSelect.addEventListener('focus', (e) => {
            lastTheme = e.target.value;
          });
          themeSelect.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            const prevTheme = lastTheme || 'classic';
            lastTheme = newTheme;
            
            const spacingEl = document.getElementById('inp-spacing');
            const paddingEl = document.getElementById('inp-padding');
            const radiusEl = document.getElementById('inp-borderRadius');
            
            if (themeDefaults[prevTheme] && themeDefaults[newTheme]) {
                if (spacingEl && Number(spacingEl.value) === themeDefaults[prevTheme].spacing) {
                  spacingEl.value = themeDefaults[newTheme].spacing;
                }
                if (paddingEl && Number(paddingEl.value) === themeDefaults[prevTheme].padding) {
                  paddingEl.value = themeDefaults[newTheme].padding;
                }
                if (radiusEl && Number(radiusEl.value) === themeDefaults[prevTheme].borderRadius) {
                  radiusEl.value = themeDefaults[newTheme].borderRadius;
                }
            }
            
            previewSettings();
          });
        }
         
        // Checkboxes - Visual Only
        ['inp-showHeader', 'inp-showArtist', 'inp-showUser', 'inp-showEmpty'].forEach(id => {
           const el = document.getElementById(id);
           if(el) {
             el.addEventListener('change', previewSettings);
           }
         });

        // Checkboxes - Data/Structure (Requires Re-render)
        ['inp-autocorrect', 'inp-showAlbumArt', 'inp-showWaitTime', 'inp-showTotalDuration', 'inp-syncAppleMusic'].forEach(id => {
           const el = document.getElementById(id);
           if(el) {
             el.addEventListener('change', () => {
                 previewSettings();
                 renderQueue(); // Force re-render to apply data changes
              });
           }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSettingsListeners);
    } else {
        initSettingsListeners();
    }

    function previewSettings() {
      const settings = getSettingsFromInputs();
      applySettings(settings);
      // Forzar re-render de la cola si cambia el límite de tarjetas para verlo en vivo
      renderQueue();
    }

    function saveSettings() {
      const settings = getSettingsFromInputs();
      safeLocalStorage.setItem('queue_overlay_settings', JSON.stringify(settings));
      applySettings(settings);

      // Sync to Firestore
      if (db) {
        db.collection('userSettings').doc('global_queue_config').set(settings)
          .then(() => console.log("Configuración guardada en la nube"))
          .catch(err => console.error("Error guardando configuración:", err));

        // Sincronizar también con la configuración centralizada del dashboard (overlayAlertsConfig)
        db.collection('systemConfig').doc('overlayAlertsConfig').set({
          queueOpacity: settings.primaryOpacity / 100,
          queueRadius: settings.borderRadius,
          queueFontSize: settings.fontSize,
          queueShowCardBg: settings.showCardBg,
          queueBorderWidth: settings.borderWidth,
          queueBorderColor: settings.borderColor,
          queueBorderOpacity: settings.borderOpacity,
          queueBorderStyle: settings.borderStyle,
          queueShowAccentBorder: settings.showAccentBorder,
          queueAccentBorderWidth: settings.accentBorderWidth,
          queueShowShadow: settings.showShadow,
          queueShadowColor: settings.shadowColor,
          queueShadowBlur: settings.shadowBlur,
          queueShadowOpacity: settings.shadowOpacity,
          queueShowSweepBorder: settings.showSweepBorder
        }, { merge: true })
          .then(() => console.log("Sync con overlayAlertsConfig completado"))
          .catch(err => console.warn("Error al sincronizar con overlayAlertsConfig:", err));
      }

      toggleSettings(); // close panel
    }

    function resetSettings() {
      if(confirm('¿Restablecer valores por defecto?')) {
        applySettings(defaultSettings);
        safeLocalStorage.removeItem('queue_overlay_settings');
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

    // Configuración de Firebase (centralizada en firebase-config.js)
    const queueFirebaseConfig = window.ZERO_FM_FIREBASE;

    let db = null;
    try {
      if (typeof firebase !== 'undefined' && firebase.apps) {
        if (!firebase.apps.length) {
          firebase.initializeApp(queueFirebaseConfig);
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

    if (db) {
      db.collection('userSettings').doc('global_queue_config')
        .onSnapshot((doc) => {
          if (doc.exists) {
            console.log("Configuración remota recibida");
            const remoteSettings = doc.data();
            const settings = { ...defaultSettings, ...remoteSettings };
            
            // Guardar localmente y aplicar
            safeLocalStorage.setItem('queue_overlay_settings', JSON.stringify(settings));
            applySettings(settings);
            
            // Actualizar inputs si existen
            if (document.getElementById('inp-width')) {
              document.getElementById('inp-width').value = settings.width;
              document.getElementById('inp-minHeight').value = settings.minHeight;
              document.getElementById('inp-spacing').value = settings.spacing !== undefined ? settings.spacing : 15;
              document.getElementById('inp-padding').value = settings.padding !== undefined ? settings.padding : 15;
              document.getElementById('inp-textGap').value = settings.textGap !== undefined ? settings.textGap : 4;
              document.getElementById('inp-borderRadius').value = settings.borderRadius;
              
              document.getElementById('inp-showHeader').checked = settings.showHeader !== undefined ? settings.showHeader : true;
              document.getElementById('inp-showArtist').checked = settings.showArtist !== undefined ? settings.showArtist : true;
              document.getElementById('inp-showUser').checked = settings.showUser !== undefined ? settings.showUser : true;
              document.getElementById('inp-showEmpty').checked = settings.showEmpty !== undefined ? settings.showEmpty : true;

              document.getElementById('inp-animEntry').value = settings.animEntry;
              document.getElementById('inp-animExit').value = settings.animExit;
              
              document.getElementById('inp-font').value = settings.font;
              document.getElementById('inp-fontSize').value = settings.fontSize;
              document.getElementById('inp-accent').value = settings.accent;
              document.getElementById('inp-bg').value = settings.bg;
              
              const primaryOpacityVal = settings.primaryOpacity !== undefined ? settings.primaryOpacity : 100;
              document.getElementById('inp-primaryOpacity').value = primaryOpacityVal;
              document.getElementById('primary-opacity-val').innerText = primaryOpacityVal + '%';

              const opacityVal = settings.secondaryOpacity !== undefined ? settings.secondaryOpacity : 60;
              document.getElementById('inp-secondaryOpacity').value = opacityVal;
              document.getElementById('opacity-val').innerText = opacityVal + '%';

              document.getElementById('inp-text').value = settings.text;
            }
          }
        }, (error) => {
           console.warn("No se pudo sincronizar configuración remota:", error);
        });

      // Escuchar personalización visual de la cola desde el panel de control
      db.collection('systemConfig').doc('overlayAlertsConfig')
        .onSnapshot((doc) => {
          if (doc.exists) {
            const data = doc.data();
            if (data.queueOpacity !== undefined) window.queueOpacityOverride = data.queueOpacity;
            if (data.queueRadius !== undefined) window.queueRadiusOverride = data.queueRadius;
            if (data.queueFontSize !== undefined) window.queueFontSizeOverride = data.queueFontSize;
            
            if (data.queueShowCardBg !== undefined) window.queueShowCardBgOverride = data.queueShowCardBg;
            if (data.queueBorderWidth !== undefined) window.queueBorderWidthOverride = data.queueBorderWidth;
            if (data.queueBorderColor !== undefined) window.queueBorderColorOverride = data.queueBorderColor;
            if (data.queueBorderOpacity !== undefined) window.queueBorderOpacityOverride = data.queueBorderOpacity;
            if (data.queueBorderStyle !== undefined) window.queueBorderStyleOverride = data.queueBorderStyle;
            if (data.queueShowAccentBorder !== undefined) window.queueShowAccentBorderOverride = data.queueShowAccentBorder;
            if (data.queueAccentBorderWidth !== undefined) window.queueAccentBorderWidthOverride = data.queueAccentBorderWidth;
            if (data.queueShowShadow !== undefined) window.queueShowShadowOverride = data.queueShowShadow;
            if (data.queueShadowColor !== undefined) window.queueShadowColorOverride = data.queueShadowColor;
            if (data.queueShadowBlur !== undefined) window.queueShadowBlurOverride = data.queueShadowBlur;
            if (data.queueShadowOpacity !== undefined) window.queueShadowOpacityOverride = data.queueShadowOpacity;
            if (data.queueShowSweepBorder !== undefined) window.queueShowSweepBorderOverride = data.queueShowSweepBorder;
            
            // Nuevos mapeos específicos
            if (data.queueTheme !== undefined) window.queueThemeOverride = data.queueTheme;
            if (data.queueWidth !== undefined) window.queueWidthOverride = Number(data.queueWidth);
            if (data.queueMinHeight !== undefined) window.queueMinHeightOverride = Number(data.queueMinHeight);
            if (data.queueSpacing !== undefined) window.queueSpacingOverride = Number(data.queueSpacing);
            if (data.queuePadding !== undefined) window.queuePaddingOverride = Number(data.queuePadding);
            if (data.queueTextGap !== undefined) window.queueTextGapOverride = Number(data.queueTextGap);
            if (data.queueShowHeader !== undefined) window.queueShowHeaderOverride = data.queueShowHeader;
            if (data.queueShowArtist !== undefined) window.queueShowArtistOverride = data.queueShowArtist;
            if (data.queueShowUser !== undefined) window.queueShowUserOverride = data.queueShowUser;
            if (data.queueShowEmpty !== undefined) window.queueShowEmptyOverride = data.queueShowEmpty;
            if (data.queueFont !== undefined) window.queueFontOverride = data.queueFont;
            if (data.queueAccentColor !== undefined) window.queueAccentColorOverride = data.queueAccentColor;
            if (data.queueBgColor !== undefined) window.queueBgColorOverride = data.queueBgColor;
            if (data.queueTextColor !== undefined) window.queueTextColorOverride = data.queueTextColor;
            if (data.queuePrimaryOpacity !== undefined) window.queuePrimaryOpacityOverride = Number(data.queuePrimaryOpacity);
            if (data.queueSecondaryOpacity !== undefined) window.queueSecondaryOpacityOverride = Number(data.queueSecondaryOpacity);
            if (data.queueMaxCards !== undefined) window.queueMaxCardsOverride = Number(data.queueMaxCards);
            if (data.queueWidthScale !== undefined) window.queueWidthScaleOverride = Number(data.queueWidthScale);
            if (data.queueHeightScale !== undefined) window.queueHeightScaleOverride = Number(data.queueHeightScale);
            if (data.queueAnimEntry !== undefined) window.queueAnimEntryOverride = data.queueAnimEntry;
            if (data.queueAnimExit !== undefined) window.queueAnimExitOverride = data.queueAnimExit;
            if (data.queueAutocorrect !== undefined) window.queueAutocorrectOverride = data.queueAutocorrect;
            if (data.queueShowAlbumArt !== undefined) window.queueShowAlbumArtOverride = data.queueShowAlbumArt;
            if (data.queueShowWaitTime !== undefined) window.queueShowWaitTimeOverride = data.queueShowWaitTime;
            if (data.queueShowTotalDuration !== undefined) window.queueShowTotalDurationOverride = data.queueShowTotalDuration;
            if (data.queueSyncAppleMusic !== undefined) window.queueSyncAppleMusicOverride = data.queueSyncAppleMusic;
            
            // Re-aplicar configuración
            if (window.appliedSettings) {
              applySettings({ ...window.appliedSettings });
            } else {
              applySettings({ ...defaultSettings });
            }
          }
        }, (error) => {
           console.warn("No se pudo sincronizar overlayAlertsConfig para queue:", error);
        });
    } else {
      console.warn("Firestore no inicializado. No se cargará configuración remota.");
    }

    const container = document.getElementById('queue-container');
    
    // Estado local
    let allRequests = []; // Todas las solicitudes del día
    let playedSongIds = new Set(); // IDs de canciones ya reproducidas
    let skippedSongIds = new Set(); // IDs de canciones saltadas (SKIP)
    let normalizedPlayedSongIds = new Set(); // IDs normalizados para matching robusto
    let playedSongsLoaded = false; // Evitar "ghost cards" antes de cargar lista negra
    let visibleQueue = []; // Las 3 canciones actualmente mostradas
    let currentManualOrder = []; // Orden manual compartido
    const firstSeenOrder = new Map(); // docId -> incremental order (para estabilizar renders)
    let firstSeenCounter = 0;

    // Utilidad: Obtener clave de fecha local (YYYY-MM-DD)
    function getLocalDateKey(ts) {
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
    }

    function sanitizeSongId(v) {
      try { 
        return String(v || '').replace(/[^a-zA-Z0-9-]/g, ''); 
      } catch (_) { return ''; }
    }

    function normalizeId(v) {
      return sanitizeSongId(v).toLowerCase();
    }

    // Utilidad: Generar ID de canción (debe coincidir con lista.html)
    function generateSongId(req) {
      if (!req) return "";
      
      // PRIORIDAD 1: Usar el ID real de Firestore si existe
      const realId = String(req.docId || req.id || req.songId || req.requestId || '').trim();
      if (realId) return sanitizeSongId(realId);

      // FALLBACK: Recrear el formato HH:mm:ss desde el timestamp
      let d;
      if (req.ts && typeof req.ts.toDate === 'function') {
        d = req.ts.toDate();
      } else if (req.ts) {
        d = new Date(req.ts);
      } else {
        d = new Date();
      }
      
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      
      // Usar hora del objeto si ya viene pre-formateada completa, o construirla
      const finalHora = req.hora && req.hora.split(':').length === 3 ? req.hora : `${hh}:${mm}:${ss}`;
      
      const usuario = req.usuario || req.user || req.username || 'anon';
      const cancion = req.cancion || req.songName || req.song || req.name || '';
      const artista = req.artista || req.artistName || req.artist || '';
      
      return sanitizeSongId(`${usuario}-${cancion}-${artista}-${finalHora}`);
    }

    function getLocalSkippedMap() {
      try { return JSON.parse(safeLocalStorage.getItem('skippedSongs') || '{}'); } catch (_) { return {}; }
    }

    function setLocalSkippedMap(map) {
      try { safeLocalStorage.setItem('skippedSongs', JSON.stringify(map || {})); } catch (_) {}
    }

    // Orden manual: aplicar
    console.log("Queue Overlay v2.5-firebase-reload-fix loaded");

    function applyOrder(items, order) {
      try {
        if (!Array.isArray(order) || !order.length) return items;

        const inOrderSet = new Set(order);
        const byDocId = new Map();
        const bySongId = new Map();

        items.forEach((it) => {
          if (it && it.docId) byDocId.set(String(it.docId), it);
          const sid = generateSongId(it);
          if (sid) bySongId.set(String(sid), it);
          if (it && it.id) bySongId.set(String(it.id), it);
        });

        // Elementos presentes en 'order' respetando ese orden
        const ordered = [];
        const seen = new Set();
        order.forEach((sid) => {
          const key = String(sid || '');
          if (!key) return;
          const found = byDocId.get(key) || bySongId.get(key);
          if (!found) return;
          if (seen.has(found)) return;
          seen.add(found);
          ordered.push(found);
        });

        // Nuevos (no presentes en 'order') abajo (para mantener FIFO)
        const notInOrder = items.filter((it) => {
          const docId = it && it.docId ? String(it.docId) : '';
          const sid = String(generateSongId(it) || '');
          const rawId = it && it.id ? String(it.id) : '';
          return !(inOrderSet.has(docId) || inOrderSet.has(sid) || inOrderSet.has(rawId));
        });

        return [...ordered, ...notInOrder];
      } catch {
        return items;
      }
    }

    // --- Data & API Logic ---
    function generateDynamicFallback(title, artist) {
      const cleanTitle = String(title || 'Song').trim();
      const cleanArtist = String(artist || 'Artist').trim();
      
      let initials = '';
      const cleanTitleOnly = cleanTitle.replace(/[^\w\s]/g, '').trim();
      const titleWords = cleanTitleOnly.split(/\s+/).filter(w => w.length > 0);
      if (titleWords.length > 0) {
          initials += titleWords[0].charAt(0).toUpperCase();
          if (titleWords.length > 1) {
              initials += titleWords[1].charAt(0).toUpperCase();
          }
      }
      if (!initials) initials = '🎵';

      const str = `${cleanTitle} ${cleanArtist}`;
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      
      const gradients = [
          { from: '#4f46e5', to: '#7c3aed' }, // Indigo to Violet
          { from: '#ec4899', to: '#f43f5e' }, // Pink to Rose
          { from: '#06b6d4', to: '#3b82f6' }, // Cyan to Blue
          { from: '#10b981', to: '#059669' }, // Emerald to Green
          { from: '#f59e0b', to: '#d97706' }, // Amber to Orange
          { from: '#8b5cf6', to: '#ec4899' }, // Purple to Pink
          { from: '#6366f1', to: '#a855f7' }  // Indigo to Purple
      ];
      
      const index = Math.abs(hash) % gradients.length;
      const grad = gradients[index];
      
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g_${index}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${grad.from}" /><stop offset="100%" stop-color="${grad.to}" /></linearGradient></defs><rect width="100" height="100" fill="url(#g_${index})" /><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="'Outfit', 'Inter', 'Segoe UI', sans-serif" font-weight="bold" font-size="36" opacity="0.9">${initials}</text></svg>`;
      
      return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg.trim())));
    }

    function normalizeText(input) {
      return String(input || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function tokenizeText(input) {
      const t = normalizeText(input);
      if (!t) return [];
      return t.split(' ').filter(Boolean);
    }

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

    async function fetchSongData(artist, song) {
      const cleanArtist = cleanArtistForSearch(artist);
      const cleanSong = cleanTextForSearch(song);
      const query = `${cleanArtist} ${cleanSong}`.trim();
      
      const rawQuery = `${artist} ${song}`.trim();
      const cacheKey = rawQuery.toLowerCase();
      
      if (songDataCache[cacheKey] !== undefined) return songDataCache[cacheKey];

      try {
        if (!query) {
          songDataCache[cacheKey] = null;
          return null;
        }

        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`);
        const data = await res.json();
        
        if (data && data.resultCount > 0) {
          const reqArtist = normalizeText(cleanArtist);
          const reqSong = normalizeText(cleanSong);
          if (!reqArtist || !reqSong) {
            songDataCache[cacheKey] = null;
            return null;
          }
          const reqArtistTokens = tokenizeText(reqArtist);
          const reqSongTokens = tokenizeText(reqSong);
          const avoidKeywords = ['karaoke', 'tribute', 'cover', 'instrumental', 'remix', 'lullaby', 'rendition', 'slowed', 'reverb'];

          const candidates = (data.results || []).filter(t => {
            const lowerName = normalizeText(t.trackName || '');
            const lowerArtist = normalizeText(t.artistName || '');
            const lowerCollection = normalizeText(t.collectionName || '');
            const hasBadWord = avoidKeywords.some(kw =>
              lowerName.includes(kw) ||
              lowerArtist.includes(kw) ||
              lowerCollection.includes(kw)
            );
            return !hasBadWord;
          });

          let best = null;
          let bestScore = -1;
          const scoreTrack = (t) => {
            const trackName = normalizeText(t.trackName || '');
            const artistName = normalizeText(t.artistName || '');
            if (!trackName || !artistName) return -1;

            let score = 0;
            let songHits = 0;
            let artistHits = 0;

            if (trackName.includes(reqSong)) score += 3;
            if (artistName.includes(reqArtist)) score += 3;

            reqSongTokens.forEach(tok => {
              if (tok.length < 2) return;
              if (trackName.includes(tok)) { score += 1; songHits += 1; }
            });
            reqArtistTokens.forEach(tok => {
              if (tok.length < 2) return;
              if (artistName.includes(tok)) { score += 1; artistHits += 1; }
            });

            if (songHits === 0 || artistHits === 0) return -1;
            return score;
          };

          candidates.forEach((t) => {
            const s = scoreTrack(t);
            if (s > bestScore) { bestScore = s; best = t; }
          });

          const threshold = Math.max(3, Math.ceil((reqSongTokens.length + reqArtistTokens.length) * 0.6));
          const track = bestScore >= threshold ? best : null;
          if (!track) {
            songDataCache[cacheKey] = null;
            return null;
          }

          const result = {
            artworkUrl: track.artworkUrl100.replace('100x100', '600x600'),
            durationMs: track.trackTimeMillis,
            correctTitle: track.trackName,
            correctArtist: track.artistName
          };
          songDataCache[cacheKey] = result;
          return result;
        } else {
          songDataCache[cacheKey] = null;
        }
      } catch (e) {
        console.warn("iTunes API Error:", e);
        songDataCache[cacheKey] = null;
      }
      return null;
    }

    function formatDuration(ms) {
      if (!ms) return "";
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(0);
      return `${minutes}:${seconds.padStart(2, '0')}`;
    }

    function formatWaitCountdownMs(ms) {
      const v = Math.max(0, Number(ms) || 0);
      if (v <= 3000) return "Siguiente";
      const totalSeconds = Math.ceil(v / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      return `${m}:${String(s).padStart(2, '0')}`;
    }

    function formatWaitTime(mins) {
      if (mins <= 0.4) return "Siguiente";
      if (mins < 60) return `en ${Math.round(mins)} min`;
      const h = Math.floor(mins / 60);
      const m = Math.round(mins % 60);
      return `en ${h}h ${m}m`;
    }

    let waitCountdownTimerId = 0;
    function tickWaitCountdown() {
      try {
        const container = document.getElementById('queue-container');
        if (!container) return;
        
        // 1. Actualizar tiempos de espera
        const waitEls = Array.from(container.querySelectorAll('.item-wait'));
        const now = Date.now();
        for (const el of waitEls) {
          if (!el) continue;
          const base = Number(el.dataset.waitMsBase || 0);
          const at = Number(el.dataset.waitMsUpdatedAt || 0);
          if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(at) || at <= 0) continue;
          const remaining = Math.max(0, base - (now - at));
          el.innerText = formatWaitCountdownMs(remaining);
        }

        // 2. Ejecutar simulación si Cider está inactivo
        const isCiderActive = currentCiderTrack && currentCiderTrack.song;
        if (!isCiderActive) {
          if (window.simulatedPlaybackProgress === undefined) {
            window.simulatedPlaybackProgress = 0;
          }
          window.simulatedPlaybackProgress += 0.5; // Avanzar 0.5% por segundo (aprox 3.3 min total)
          if (window.simulatedPlaybackProgress > 100) {
            window.simulatedPlaybackProgress = 0;
          }
          
          window.currentCiderDuration = 210000; // 3:30 min
          window.currentCiderPosition = Math.round(210000 * (window.simulatedPlaybackProgress / 100));
          window.currentCiderPositionUpdatedAt = Date.now();
        }

        // 3. Actualizar la barra de progreso física
        updatePlaybackProgressBar();
      } catch (_) {}
    }

    function updatePlaybackProgressBar() {
      try {
        const container = document.getElementById('queue-container');
        if (!container) return;
        const progressRow = container.querySelector('.playback-progress-row');
        if (!progressRow) return;

        const fill = progressRow.querySelector('.progress-bar-fill');
        const timeText = progressRow.querySelector('.progress-time');
        
        let duration = window.currentCiderDuration || 0;
        let position = window.currentCiderPosition || 0;
        const updatedAt = window.currentCiderPositionUpdatedAt || 0;
        
        if (duration > 0 && updatedAt > 0) {
          const age = Date.now() - updatedAt;
          let currentPos = position + age;
          if (currentPos > duration) currentPos = duration;
          
          const pct = (currentPos / duration) * 100;
          if (fill) fill.style.width = pct + '%';
          
          const formatTime = (ms) => {
            const sec = Math.floor(ms / 1000);
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            return `${m}:${String(s).padStart(2, '0')}`;
          };
          
          if (timeText) {
            timeText.innerText = `${formatTime(currentPos)} / ${formatTime(duration)}`;
          }
        } else {
          if (fill) fill.style.width = '0%';
          if (timeText) timeText.innerText = '0:00 / 0:00';
        }
      } catch (_) {}
    }

    function stopWaitCountdownTimer() {
      try {
        if (waitCountdownTimerId) clearInterval(waitCountdownTimerId);
      } catch (_) {}
      waitCountdownTimerId = 0;
    }

    function ensureWaitCountdownTimerRunning() {
      try {
        if (waitCountdownTimerId) return;
        waitCountdownTimerId = setInterval(tickWaitCountdown, 1000);
      } catch (_) {}
    }

    function getCurrentPlaybackRemainingMsSafe() {
      try {
        const settings = window.appliedSettings || getSettingsFromInputs();
        if (!settings || settings.syncAppleMusic !== true) return 0;
        const ms = Number(currentCiderPlayback?.remainingMs || 0);
        const updatedAt = Number(currentCiderPlayback?.updatedAt || 0);
        if (!Number.isFinite(ms) || ms <= 0) return 0;
        const age = Date.now() - updatedAt;
        if (!Number.isFinite(age) || age > 120000) return 0;
        if (ms < 5000) return 0;
        return ms;
      } catch (_) {
        return 0;
      }
    }

    function recomputeWaitCountdownFromDom() {
      try {
        const settings = window.appliedSettings || getSettingsFromInputs();
        const container = document.getElementById('queue-container');
        if (!container || !settings || settings.showWaitTime !== true) return;
        const startMs = getCurrentPlaybackRemainingMsSafe();
        if (!startMs) return;
        const now = Date.now();
        let accumulatedMs = startMs;
        const items = Array.from(container.querySelectorAll('.queue-item:not(.removing)'));
        for (const item of items) {
          const waitEl = item ? item.querySelector('.item-wait') : null;
          if (!waitEl) continue;
          waitEl.dataset.waitMsBase = String(Math.max(0, accumulatedMs));
          waitEl.dataset.waitMsUpdatedAt = String(now);
          waitEl.innerText = formatWaitCountdownMs(accumulatedMs);
          const dur = Number(waitEl.dataset.durationMs || 0);
          accumulatedMs += (Number.isFinite(dur) && dur > 0 ? dur : 210000);
        }
        ensureWaitCountdownTimerRunning();
        tickWaitCountdown();
      } catch (_) {}
    }

    // --- Core Render Logic ---

    const queueUrlParams = new URLSearchParams(window.location.search);
    const forcedBadgeParam = String(queueUrlParams.get('badge') || '').trim();
    const forcedUserParam = String(queueUrlParams.get('user') || '').trim();
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
    function normalizeQueueUserKey(v) {
      try {
        const s = String(v || '').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim().replace(/^@/, '');
        if (!s) return '';
        return s.replace(/\s+/g, ' ').toLowerCase();
      } catch (_) { return ''; }
    }
    let superfanUsersSet = new Set();
    let userAliasesMap = {};

    async function pollUserAliasesOnce() {
      try {
        const snap = await db.collection('userAliases').get();
        const map = {};
        snap.forEach((doc) => {
          const data = doc.data();
          if (data && data.aliasedTo) {
            map[normalizeUserForOverride(doc.id)] = normalizeUserForOverride(data.aliasedTo);
          }
        });
        userAliasesMap = map;
        renderQueue();
      } catch (_) {}
    }

    function hasSuperfanMembership(username) {
      if (!superfanUsersSet || superfanUsersSet.size === 0) return false;
      if (!username) return false;
      const uKey = normalizeUserForOverride(username);
      
      // 1. Direct check
      if (superfanUsersSet.has(uKey)) return true;
      
      // 2. TikTok alias -> Web user check
      const linkedWebUser = userAliasesMap[uKey];
      if (linkedWebUser && superfanUsersSet.has(linkedWebUser)) return true;
      
      // 3. Web user -> TikTok alias check
      for (const [tiktokHandle, webUser] of Object.entries(userAliasesMap)) {
        if (webUser === uKey) {
          if (superfanUsersSet.has(tiktokHandle)) return true;
        }
      }
      return false;
    }

    async function pollSuperfanUsersOnce() {
      try {
        const snap = await db.collection('superfanUsers').get();
        const next = new Set();
        snap.forEach((doc) => {
          const d = doc.data() || {};
          const name = String(d.name || doc.id || '').trim();
          const k = normalizeUserForOverride(name);
          if (k) next.add(k);
        });
        superfanUsersSet = next;
        renderQueue();
      } catch (_) {}
    }
    async function pollQueueModeOnce() {
      try {
        const doc = await db.collection('system').doc('status').get();
        const data = doc && doc.exists ? (doc.data() || {}) : {};
        const mode = String(data.queueMode || '').trim();
        if (mode) {
          window.__QUEUE_MODE__ = mode;
          try { safeLocalStorage.setItem('queueMode', mode); } catch (_) {}
          renderQueue();
        }
      } catch (_) {}
    }
    function badgeLabel(badge) {
      const b = String(badge || '').trim();
      if (!b) return '';
      if (b === 'superfan') return 'SF';
      if (b === 'vip') return 'VIP';
      if (b === 'z0-vip') return 'z0Vip';
      if (b === 'donador') return '🪙';
      if (b === 'donador-oro') return '🥇';
      if (b === 'donador-plata') return '🥈';
      if (b === 'donador-bronce') return '🥉';
      if (b === 'z0-fan') return 'z0';
      if (b === 'z0-platino') return 'PLAT';
      return b;
    }

    function createQueueItem(req, index) {
      const cancion = req.cancion || req.songName || req.song || req.name || '';
      const artista = req.artista || req.artistName || req.artist || '';
      const usuario = req.displayName || req.usuario || req.user || req.username || '';
      const rawBadge = String((req && req.badge) || '').trim();
      const uKey = normalizeUserForOverride(usuario);
      const badgeCandidate = (rawBadge === 'superfan' && uKey && !hasSuperfanMembership(usuario)) ? '' : rawBadge;
      const badge = badgeCandidate || getForcedBadgeForUser(usuario);
      const badgeHtml = badge ? `<span class="user-insignia ${badge}">${badgeLabel(badge)}</span>` : '';
      const div = document.createElement('div');
      // Wrapper con clases de posición
      div.className = `queue-item queue-pos-${index + 1}`; 
      div.dataset.songId = generateSongId(req);
      if (req.docId) div.dataset.docId = req.docId;
      
      const cleanCancion = escapeHTML(cancion);
      const cleanArtista = escapeHTML(artista);
      const cleanUsuario = escapeHTML(usuario);

      // Structure for optional Album Art, Wait Time, Progress Bar and Header
      const showBg = (window.appliedSettings && window.appliedSettings.showCardBg !== undefined) ? window.appliedSettings.showCardBg : true;
      const innerClass = showBg ? 'queue-item-inner' : 'queue-item-inner no-card-bg';
      div.innerHTML = `
        <div class="${innerClass}">
           <!-- Header superior especial (solo para neon-glass pos 1) -->
           <div class="now-playing-header">
              <div class="now-playing-badge">
                 <span class="eq-bars">
                    <span class="eq-bar"></span>
                    <span class="eq-bar"></span>
                    <span class="eq-bar"></span>
                 </span>
                 <span>AHORA SONANDO</span>
              </div>
              <span class="en-cola-text">EN COLA</span>
           </div>

           <!-- Contenido principal -->
           <div class="queue-content-body">
              <img class="item-art" src="" style="display:none; width: 60px; height: 60px; object-fit: cover; border-radius: 4px; flex-shrink: 0;">
              
              <div class="item-details-col">
                  <div class="item-header">
                     <span class="pos-badge">#${index + 1}</span>
                     <span class="header-status">En cola</span>
                  </div>
                  <div class="item-song">
                     <span>${cleanCancion}</span>
                     ${req.link ? `
                        <span class="song-link-icon" title="Ver enlace">🔗</span>
                        <button class="play-yt-btn" title="Reproducir en Overlay" style="background: rgba(236, 72, 153, 0.15); border: 1px solid rgba(236, 72, 153, 0.3); cursor: pointer; font-size: 0.85rem; padding: 2px 6px; border-radius: 4px; color: #ec4899; font-weight: bold; margin-left: 8px; vertical-align: middle; display: inline-flex; align-items: center; gap: 4px;">▶️ Play</button>
                      ` : ''}
                  </div>
                  <div class="item-artist">${cleanArtista}</div>
                  
                  <div class="item-user">
                     Pedido por <span class="user-badge"><span class="user-name">${cleanUsuario}</span>${badgeHtml}</span>
                  </div>
                  
                  <!-- Contenedor del wait-time (incluye reloj para neon-glass) -->
                  <div class="wait-container">
                     <span class="clock-icon">🕒</span>
                     <span class="item-wait" style="display:none; font-size: 11px; color: var(--queue-accent-color); font-weight: bold;"></span>
                  </div>

                  <!-- Timeline de puntitos para neon-glass en tarjetas 2 y 3 -->
                  <div class="dots-timeline">
                     <span class="dot"></span>
                     <span class="dot"></span>
                     <span class="dot"></span>
                     <span class="dot"></span>
                     <span class="dot"></span>
                     <span class="dot"></span>
                     <span class="dot"></span>
                     <span class="dot"></span>
                     <span class="dot"></span>
                     <span class="dot"></span>
                  </div>
              </div>
           </div>

           <!-- Barra de progreso de música (solo para neon-glass pos 1) -->
           <div class="playback-progress-row">
              <span class="progress-eq-icon">📊</span>
              <div class="progress-bar-container">
                 <div class="progress-bar-fill" style="width: 0%;"></div>
              </div>
              <span class="progress-time">0:00 / 0:00</span>
           </div>
        </div>
      `;

      // Agregar listener programático para el botón de reproducción de YouTube
      const playBtn = div.querySelector('.play-yt-btn');
      if (playBtn) {
        playBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (typeof window.playYoutubeLinkFromQueue === 'function') {
            window.playYoutubeLinkFromQueue(req.link, cancion, artista, usuario, req.id || req.docId || '');
          }
        });
      }

      return div;
    }

    function getQueueMode() {
      try { return String(window.__QUEUE_MODE__ || safeLocalStorage.getItem('queueMode') || 'default').trim() || 'default'; } catch (_) { return String(window.__QUEUE_MODE__ || 'default').trim() || 'default'; }
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

    function getReqTimeMs(req) {
      try {
        if (!req) return 0;
        if (req.ts && typeof req.ts.toMillis === 'function') return req.ts.toMillis();
        const t = new Date(req.ts || req.time || req.createdAt || req.created_at || 0).getTime();
        return Number.isFinite(t) ? t : 0;
      } catch (_) { return 0; }
    }

    function applyTandas15Order(items) {
      const base = Array.isArray(items) ? items.slice() : [];
      base.sort((a, b) => getReqTimeMs(a) - getReqTimeMs(b));
      const slotMs = 15 * 60 * 1000;
      
      // --- NUEVA LÓGICA: Bloques dinámicos de mínimo 3 canciones ---
      const blocks = [];
      let currentBlock = [];
      let blockStartTime = null;
      let blockExpiryTime = null;

      base.forEach((it) => {
        const t = getReqTimeMs(it);
        if (currentBlock.length === 0) {
          currentBlock.push(it);
          blockStartTime = t;
          blockExpiryTime = null;
        } else {
          // Regla: Mínimo 3 canciones por tanda.
          if (currentBlock.length < 3) {
            currentBlock.push(it);
            if (currentBlock.length === 3) {
              blockExpiryTime = t + slotMs;
            }
          } else {
            if (!blockExpiryTime || t < blockExpiryTime) {
              currentBlock.push(it);
            } else {
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
          const raw = String(it?.usuario || it?.displayName || it?.user || it?.username || '').trim();
          const key = normalizeQueueUserKey(raw) || raw;
          if (!key) return;
          if (!perUser.has(key)) perUser.set(key, []);
          perUser.get(key).push(it);
        });

        const users = Array.from(perUser.keys());
        const expanded = [];
        users.forEach((u) => {
          const arr = perUser.get(u) || [];
          arr.sort((a, b) => getReqTimeMs(a) - getReqTimeMs(b));
          const badge = String(arr?.[0]?.badge || '').trim();
          const rank = badgeRankForOrdering(badge);
          const tier = (badge === 'superfan' || badge === 'z0-platino') ? 0 : ((badge === 'z0-vip' || badge === 'vip') ? 1 : 2);
          
          for (let idx = 0; idx < arr.length; idx++) {
            const it = arr[idx];
            const t = getReqTimeMs(it);
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
      const base = Array.isArray(items) ? items.slice() : [];
      base.sort((a, b) => getReqTimeMs(a) - getReqTimeMs(b));
      const gapMs = 18 * 60 * 1000;
      const blocks = [];
      let cur = [];
      let prevT = null;
      for (let i = 0; i < base.length; i++) {
        const it = base[i];
        const t = getReqTimeMs(it);
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
          const raw = String(it?.usuario || it?.displayName || it?.user || it?.username || '').trim();
          const key = normalizeQueueUserKey(raw) || raw;
          if (!key) return;
          if (!perUser.has(key)) perUser.set(key, []);
          perUser.get(key).push(it);
        });
        const users = Array.from(perUser.keys());
        const expanded = [];
        users.forEach((u) => {
          const arr = perUser.get(u) || [];
          arr.sort((a, b) => getReqTimeMs(a) - getReqTimeMs(b));
          const badge = String(arr?.[0]?.badge || '').trim();
          const rank = badgeRankForOrdering(badge);
          const tier = (badge === 'superfan' || badge === 'z0-platino') ? 0 : ((badge === 'z0-vip' || badge === 'vip') ? 1 : 2);
          for (let idx = 0; idx < arr.length; idx++) {
            const it = arr[idx];
            const t = getReqTimeMs(it);
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

    function renderQueue() {
      // Evitar renderizado si no hemos cargado la lista de reproducidas (evita flash de ghost cards)
      if (!playedSongsLoaded && db) {
        console.log("Esperando lista de reproducidas...");
        return;
      }

      console.log("renderQueue called. Pending requests:", allRequests.length);
      const now = Date.now();
      
      // 1. Filtrar solicitudes que NO están en los sets de reproducidas
      let pendingRequests = allRequests.filter(req => {
        const sid = generateSongId(req);
        const did = String(req?.docId || '').trim();
        const rid = String(req?.id || '').trim();
        
        // Normalización para matching robusto
        const nsid = normalizeId(sid);
        const ndid = normalizeId(did);
        const nrid = normalizeId(rid);

        const isPlayed = 
          playedSongIds.has(sid) || 
          (did && playedSongIds.has(did)) || 
          (rid && playedSongIds.has(rid)) ||
          normalizedPlayedSongIds.has(nsid) ||
          (ndid && normalizedPlayedSongIds.has(ndid)) ||
          (nrid && normalizedPlayedSongIds.has(nrid));

        if (isPlayed) {
            return false;
        }
        return true;
      });

      const qm = getQueueMode();
      
      // Aplicar base de ordenamiento según el modo
      if (qm === 'recent' || qm === 'manual_recent') {
        pendingRequests.sort((a, b) => getReqTimeMs(b) - getReqTimeMs(a));
      } else if (qm === 'oldest' || qm === 'default' || qm === 'manual_fifo') {
        pendingRequests.sort((a, b) => getReqTimeMs(a) - getReqTimeMs(b));
      } else if (qm === 'smart') {
        pendingRequests = applySmartOrder(pendingRequests);
      } else if (qm === 'tandas15') {
        pendingRequests = applyTandas15Order(pendingRequests);
      } else {
        // Fallback por si acaso
        pendingRequests.sort((a, b) => getReqTimeMs(a) - getReqTimeMs(b));
      }

      // Aplicar orden manual encima de cualquier modo, igual que en lista.html
      if (currentManualOrder && currentManualOrder.length > 0) {
        pendingRequests = applyOrder(pendingRequests, currentManualOrder);
      }

      // 2. Tomar las primeras X (config limit)
      // Dynamic limit based on settings
      const maxCards = (window.appliedSettings && window.appliedSettings.maxCards) ? window.appliedSettings.maxCards : 3;
      const itemsToShow = pendingRequests.slice(0, maxCards);
      window.__lastRenderedQueueItems = itemsToShow;
      
      // 3. Diffing Inteligente: Solo animar elementos NUEVOS
      const container = document.getElementById('queue-container');
      
      // Mapa de elementos actuales (Array para manejar duplicados de ID)
      const existingMap = new Map();
      container.querySelectorAll('.queue-item:not(.removing)').forEach(el => {
          const id = el.dataset.docId || el.dataset.songId;
          if (id) {
             if (!existingMap.has(id)) existingMap.set(id, []);
             existingMap.get(id).push(el);
          }
      });
      
      // Procesar items a mostrar
      const desiredEls = [];
      itemsToShow.forEach((req, index) => {
        const reqId = req.docId || req.id || generateSongId(req);
        let itemEl = null;

        // Intentar recuperar un elemento existente
        if (existingMap.has(reqId)) {
            const list = existingMap.get(reqId);
            if (list.length > 0) {
                itemEl = list.shift(); // Tomar el primero disponible
            }
        }

        if (itemEl) {
            // CASO 1: El elemento YA EXISTE
            // Ya lo sacamos de la lista, si la lista queda vacía, el map se limpia solo al final
            
            // Actualizar clase de posición si cambió
            const newPosClass = `queue-pos-${index + 1}`;
            // Limpiar clases de posición antiguas
            itemEl.className = itemEl.className.replace(/queue-pos-\d+/g, '').trim();
            itemEl.classList.add(newPosClass);

            try {
              const numEl = itemEl.querySelector('.item-header span');
              if (numEl) numEl.textContent = `#${index + 1}`;
            } catch (_) {}
            
            // Asegurar que sea visible (sin animación de entrada)
            if (!itemEl.classList.contains('show')) itemEl.classList.add('show');
            desiredEls.push(itemEl);
        } else {
            // CASO 2: El elemento es NUEVO
            itemEl = createQueueItem(req, index);
            desiredEls.push(itemEl);
        }
      });

      // Reordenar/insertar elementos para que el DOM refleje el nuevo orden
      const emptyEl = document.getElementById('empty-state');
      desiredEls.forEach((el) => {
        if (!el) return;
        const isNew = !el.parentNode;
        if (emptyEl && emptyEl.parentNode === container) container.insertBefore(el, emptyEl);
        else container.appendChild(el);

        if (isNew) {
            void el.offsetWidth; // Trigger layout reflow
            requestAnimationFrame(() => {
                if (el && el.isConnected) {
                    el.classList.add('show');
                }
            });
        }
      });

      // 4. Eliminar elementos que ya no están (los que quedaron en existingMap)
      existingMap.forEach((list) => {
          list.forEach(el => {
            // el.classList.remove('show'); // Mantener .show para evitar parpadeo o desaparición inmediata
            el.classList.add('removing');
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (el && el.isConnected) el.classList.add('removing-active');
              });
            });
            
            // Eliminar del DOM después de la animación y el colapso
            // Animación: 0.8s | Delay colapso: 0.6s | Colapso: 0.8s 
            // Total visual: ~1.4s. Damos 1.5s de margen.
            setTimeout(() => {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 1500);
          });
      });

      // 5. Empty State Logic
      let empty = document.getElementById('empty-state');
      if (itemsToShow.length === 0) {
         if (!empty) {
             empty = document.createElement('div');
             empty.id = 'empty-state';
             empty.innerHTML = `<div style="font-size: 40px; margin-bottom: 10px;">🎵</div><div>Esperando solicitudes...</div>`;
             container.appendChild(empty);
         }
         const s = window.appliedSettings || getSettingsFromInputs(); // Get current settings for visibility
         if (s.showEmpty) empty.classList.add('visible');
         else empty.classList.remove('visible');
      } else {
         if (empty) empty.classList.remove('visible');
      }

      // 6. Hydrate Data (Autocorrect, Art, Times)
      hydrateQueueItems(itemsToShow);
      
      // 7. Update Total Duration
      updateTotalDuration(pendingRequests);
    }

    async function hydrateQueueItems(items) {
      const settings = window.appliedSettings || getSettingsFromInputs();
      if (!settings.autocorrect && !settings.showAlbumArt && !settings.showWaitTime) return;

      const getCurrentPlaybackRemainingMinutes = () => {
        try {
          const ms = getCurrentPlaybackRemainingMsSafe();
          if (!ms) return 0;
          return ms / 60000;
        } catch (_) { return 0; }
      };

      const shouldAutocorrectText = (reqArtist, reqSong, correctedArtist, correctedSong) => {
        try {
          const ra = normalizeText(reqArtist);
          const rs = normalizeText(reqSong);
          const ca = normalizeText(correctedArtist);
          const cs = normalizeText(correctedSong);

          if (!ra || !rs || !ca || !cs) return false;
          if (ra.length < 2 || rs.length < 2 || ca.length < 2 || cs.length < 2) return false;

          const artistOk = ca.includes(ra) || ra.includes(ca);
          const songOk = cs.includes(rs) || rs.includes(cs);
          return artistOk && songOk;
        } catch (_) {
          return false;
        }
      };

      const container = document.getElementById('queue-container');
      const itemEls = Array.from(container.querySelectorAll('.queue-item:not(.removing)'));
      const elBySongId = new Map();
      itemEls.forEach((el) => {
        const sid = el.dataset.songId;
        if (sid && !elBySongId.has(sid)) elBySongId.set(sid, el);
      });
      
      const liveCountdown = settings.showWaitTime === true && settings.syncAppleMusic === true && getCurrentPlaybackRemainingMsSafe() > 0;
      let accumulatedTime = getCurrentPlaybackRemainingMinutes(); // minutes (incluye canción actual si hay Cider)
      let accumulatedMs = getCurrentPlaybackRemainingMsSafe();
      const now = Date.now();

      // 1. Pre-pass sincrónico: aplicar textos básicos, portadas de Firestore o fallbacks de gradiente inmediatamente
      for (const req of items) {
          if (!req) continue;
          const songId = generateSongId(req);
          const el = elBySongId.get(songId);
          if (!el) continue;

          const songEl = el.querySelector('.item-song');
          const artistEl = el.querySelector('.item-artist');
          const artEl = el.querySelector('.item-art');

          if (settings.autocorrect || settings.showAlbumArt || settings.showWaitTime) {
              const artist = String(req.artista || req.artistName || req.artist || '').trim();
              const song = String(req.cancion || req.songName || req.song || req.name || '').trim();

              if (songEl) songEl.innerText = song;
              if (artistEl) artistEl.innerText = artist;

              if (settings.showAlbumArt) {
                  const dbCover = String(req.cover || req.coverUrl || '').trim();
                  const hasDbCover = dbCover && (dbCover.startsWith('http://') || dbCover.startsWith('https://'));
                  const fallbackArtwork = generateDynamicFallback(song, artist);

                  if (artEl) {
                      artEl.src = hasDbCover ? dbCover : fallbackArtwork;
                      artEl.style.display = 'block';
                  }
              }
          }
      }

      // 2. Bucle asíncrono secuencial: obtener datos de iTunes (tiempos, autocorrección y carátulas actualizadas)
      for (const req of items) {
          if (!req) continue;
          const songId = generateSongId(req);
          const el = elBySongId.get(songId);
          if (!el) continue;

          const songEl = el.querySelector('.item-song');
          const artistEl = el.querySelector('.item-artist');
          const artEl = el.querySelector('.item-art');
          const waitEl = el.querySelector('.item-wait');

          if (settings.autocorrect || settings.showAlbumArt || settings.showWaitTime) {
              const artist = String(req.artista || req.artistName || req.artist || '').trim();
              const song = String(req.cancion || req.songName || req.song || req.name || '').trim();

              const dbCover = String(req.cover || req.coverUrl || '').trim();
              const hasDbCover = dbCover && (dbCover.startsWith('http://') || dbCover.startsWith('https://'));
              const fallbackArtwork = generateDynamicFallback(song, artist);

              // Solo consultamos iTunes si necesitamos autocorrect, waitTime o si no tenemos portada en Firestore
              const data = (settings.autocorrect || settings.showWaitTime || (settings.showAlbumArt && !hasDbCover))
                  ? await fetchSongData(artist, song)
                  : null;
              
              // Si el elemento ya no está en el DOM tras la espera, continuar
              if (el && !el.parentNode) continue;

              if (data) {
                  if (settings.autocorrect) {
                      if (shouldAutocorrectText(artist, song, data.correctArtist, data.correctTitle)) {
                        if (songEl) songEl.innerText = data.correctTitle;
                        if (artistEl) artistEl.innerText = data.correctArtist;
                      }
                  }
                  
                  if (settings.showAlbumArt && !hasDbCover) {
                      if (artEl) {
                          artEl.src = data.artworkUrl || fallbackArtwork;
                          artEl.style.display = 'block';
                      }
                  } else if (!settings.showAlbumArt && artEl) {
                      artEl.style.display = 'none';
                  }

                  if (settings.showWaitTime && data.durationMs) {
                      waitEl.style.display = 'block';
                      waitEl.dataset.durationMs = String(data.durationMs);
                      if (liveCountdown) {
                        waitEl.dataset.waitMsBase = String(Math.max(0, accumulatedMs));
                        waitEl.dataset.waitMsUpdatedAt = String(now);
                        waitEl.innerText = formatWaitCountdownMs(accumulatedMs);
                        accumulatedMs += data.durationMs;
                      } else {
                        waitEl.innerText = formatWaitTime(accumulatedTime);
                        accumulatedTime += (data.durationMs / 60000);
                      }
                  }
              } else {
                  if (settings.showAlbumArt && !hasDbCover) {
                      if (artEl) {
                          artEl.src = fallbackArtwork;
                          artEl.style.display = 'block';
                      }
                  }

                  // Fallback for wait time if no data found (assume 3:30 min)
                  if (settings.showWaitTime) {
                      waitEl.style.display = 'block';
                      waitEl.dataset.durationMs = String(210000);
                      if (liveCountdown) {
                        waitEl.dataset.waitMsBase = String(Math.max(0, accumulatedMs));
                        waitEl.dataset.waitMsUpdatedAt = String(now);
                        waitEl.innerText = formatWaitCountdownMs(accumulatedMs);
                        accumulatedMs += 210000;
                      } else {
                        waitEl.innerText = formatWaitTime(accumulatedTime);
                        accumulatedTime += 3.5; 
                      }
                  }
              }
          }
      }
      if (liveCountdown) {
        ensureWaitCountdownTimerRunning();
        tickWaitCountdown();
      } else {
        stopWaitCountdownTimer();
      }
    }

    async function updateTotalDuration(allPending) {
      const settings = window.appliedSettings || getSettingsFromInputs();
      const indicator = document.getElementById('total-duration-indicator');
      const valEl = document.getElementById('total-time-val');

      if (!settings.showTotalDuration || allPending.length === 0) {
        indicator.style.display = 'none';
        return;
      }

      indicator.style.display = 'block';
      
      let totalMs = 0;
      let unknownCount = 0;

      // Batch fetch or use cache
      // Note: fetching all might be heavy. We'll rely on cache + defaults.
      for (const req of allPending) {
         const artist = String(req.artista || req.artistName || req.artist || '').trim();
         const song = String(req.cancion || req.songName || req.song || req.name || '').trim();
         const cacheKey = `${artist} ${song}`.trim().toLowerCase();
         if (songDataCache[cacheKey]) {
             totalMs += songDataCache[cacheKey].durationMs;
         } else {
             unknownCount++;
         }
      }

      // Estimate unknowns as 3.5 mins
      totalMs += (unknownCount * 3.5 * 60000);

      const h = Math.floor(totalMs / 3600000);
      const m = Math.round((totalMs % 3600000) / 60000);
      
      valEl.innerText = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

    // --- Apple Music / Cider Integration ---
    // Variables moved to top of script to avoid ReferenceError

    // Global variable to store current playback state
    let currentCiderTrack = null;
    let currentCiderPlayback = { remainingMs: 0, updatedAt: 0 };

    function normalizeMaybeSecondsToMs(v) {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return 0;
      if (n < 1000) return Math.round(n * 1000);
      if (n < 1000 * 60 * 20) return Math.round(n * 1000);
      return Math.round(n);
    }

    function updateCiderPlaybackTiming(data) {
      try {
        if (!data) return;
        const prevMs = Number(currentCiderPlayback?.remainingMs || 0);

        const remainingCandidates = [
          data.timeRemaining,
          data.remainingTime,
          data.remainingTimeMs,
          data.remainingMs,
          data.timeRemainingMs
        ];

        let remainingMs = 0;
        for (let i = 0; i < remainingCandidates.length; i++) {
          const ms = normalizeMaybeSecondsToMs(remainingCandidates[i]);
          if (ms > 0) { remainingMs = ms; break; }
        }

        if (!remainingMs) {
          const durationMs = normalizeMaybeSecondsToMs(
            data.durationInMillis || data.durationMs || data.trackTimeMillis || data.duration || data.playbackDuration
          );
          const positionMs = normalizeMaybeSecondsToMs(
            data.playbackTime || data.currentPlaybackTime || data.position || data.elapsedTime || data.elapsedTimeMs
          );
          if (durationMs > 0 && positionMs >= 0 && positionMs <= durationMs + 15000) {
            remainingMs = Math.max(0, durationMs - positionMs);
          }
        }

        if (remainingMs > 0) {
          currentCiderPlayback = { remainingMs, updatedAt: Date.now() };
          const isJump = (Number.isFinite(prevMs) && prevMs > 0 && remainingMs > prevMs + 45000) || (prevMs < 8000 && remainingMs > 45000);
          if (isJump) recomputeWaitCountdownFromDom();
        }

        // Guardar datos detallados para la barra de progreso
        const durationMs = normalizeMaybeSecondsToMs(
          data.durationInMillis || data.durationMs || data.trackTimeMillis || data.duration || data.playbackDuration
        );
        const positionMs = normalizeMaybeSecondsToMs(
          data.playbackTime || data.currentPlaybackTime || data.position || data.elapsedTime || data.elapsedTimeMs
        );
        if (durationMs > 0) {
          window.currentCiderDuration = durationMs;
          if (positionMs >= 0) {
            window.currentCiderPosition = positionMs;
            window.currentCiderPositionUpdatedAt = Date.now();
          } else {
            window.currentCiderPosition = Math.max(0, durationMs - remainingMs);
            window.currentCiderPositionUpdatedAt = Date.now();
          }
        }
      } catch (_) {}
    }

    // Function to check current playing track against the queue
    function checkCurrentTrackAgainstQueue() {
      if (!currentCiderTrack || !currentCiderTrack.artist || !currentCiderTrack.song) return;

      const artist = currentCiderTrack.artist;
      const song = currentCiderTrack.song;
      const requesterId = currentCiderTrack.requesterId ? String(currentCiderTrack.requesterId).trim() : '';
      const playingAppleMusicId = currentCiderTrack.appleMusicId ? String(currentCiderTrack.appleMusicId).trim() : '';
      
      // Clave única para evitar procesar la misma canción múltiples veces
      const key = `${playingAppleMusicId}|${artist}|${song}|${requesterId}`;
      if (lastAutoMarkedSong === key) return; 

      // Normalización segura para comparación
      const normalize = (str) => {
          if (!str) return "";
          return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      };
      
      const targetArtist = normalize(artist);
      const targetSong = normalize(song);

      if (targetArtist.length < 2 || targetSong.length < 2) return;

      // Filtrar canciones NO reproducidas
      const candidates = allRequests.filter(req => {
          const id = generateSongId(req);
          return !playedSongIds.has(id) && !normalizedPlayedSongIds.has(normalizeId(id));
      });

      // Lógica de Matching (Prioridad: ID > Match Exacto > Match Parcial)
      const findMatch = () => {
          // 1. Coincidencia por Apple Music ID (si existe)
          if (playingAppleMusicId) {
             const idMatch = candidates.find(req => String(req.appleMusicId || '').trim() === playingAppleMusicId);
             if (idMatch) {
               console.log(`✅ MATCH POR ID: ${playingAppleMusicId} -> ${idMatch.artista} - ${idMatch.cancion}`);
               return idMatch;
             }
          }

          // 2. Coincidencia por Texto (Artista y Canción)
          for (const req of candidates) {
              const reqArtist = normalize(req.artista);
              const reqSong = normalize(req.cancion);

              // Match Exacto (o contenido completo)
              const artistMatch = reqArtist.includes(targetArtist) || targetArtist.includes(reqArtist);
              const songMatch = reqSong.includes(targetSong) || targetSong.includes(reqSong);

              const swappedMatch = (reqArtist.includes(targetSong) || targetSong.includes(reqArtist)) &&
                                   (reqSong.includes(targetArtist) || targetArtist.includes(reqSong));

              if ((artistMatch && songMatch) || swappedMatch) {
                  console.log(`✅ MATCH POR TEXTO: "${targetArtist} - ${targetSong}" vs "${reqArtist} - ${reqSong}"`);
                  return req;
              }
          }
          return null;
      };

      const match = findMatch();

      if (match) {
        console.log(`✨ Auto-marking song as played: ${match.artista} - ${match.cancion}`);
        const generatedId = generateSongId(match);
        markSongAsPlayed(generatedId);
        lastAutoMarkedSong = key;
      } else {
        console.log(`🔍 No match found for Cider track: ${artist} - ${song} (AM ID: ${playingAppleMusicId})`);
      }
    }

    function getCiderSocketUrl() {
      try {
        const params = new URLSearchParams(window.location.search || '');
        const fromQuery = String(params.get('ciderUrl') || '').trim();
        if (fromQuery) return fromQuery;
      } catch (_) {}
      try {
        const fromLocal = String(safeLocalStorage.getItem('ciderUrl') || '').trim();
        if (fromLocal) return fromLocal;
      } catch (_) {}
      return "http://localhost:10767/";
    }

    function connectCider() {
      if (ciderSocket) return; // Already connected
      if (!window.io) {
        console.warn("Socket.io not loaded");
        return;
      }

      const url = getCiderSocketUrl();
      console.log("Intentando conectar a Cider:", url);
      ciderSocket = io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        timeout: 8000
      });

      ciderSocket.on("connect", () => {
        console.log("✅ Conectado a Cider/Apple Music Widget!");
        // Request current playback status immediately
        ciderSocket.emit("get-playback");
      });

      ciderSocket.on("connect_error", (err) => {
        console.warn("❌ Error conectando a Cider:", err && err.message ? err.message : err);
      });

      ciderSocket.on("disconnect", (reason) => {
        console.log("❌ Desconectado de Cider. Razón:", reason);
        // NO anular ciderSocket aquí para permitir reconexión automática de socket.io
        if (reason === "io server disconnect") {
          // Si el servidor nos desconecta explícitamente, intentar reconectar manual
          ciderSocket.connect();
        }
      });

      ciderSocket.on("API:Playback", (event) => {
        // data structure: { data: { name, artistName, ... }, type: "..." }
        const { data, type } = event;
        
        // Log para depuración
        console.log("🎵 Cider Event:", type, data?.name);
        try { updateCiderPlaybackTiming(data); } catch (_) {}

        const artist = data && (data.artistName || data.artist);
        const name = data && (data.name || data.songName || data.title);
        const requester = data && (data.requester || data.requestedBy || data.user || data.username || '');
        const requesterId = data && (data.requesterId || data.requesterUserId || data.userId || '');
        const appleMusicId = data
          ? ((data.playParams && data.playParams.id) ? data.playParams.id : (data.appleMusicId || data.id || ''))
          : '';

        if (artist && name) {
          // Actualizar estado de reproducción actual
          currentCiderTrack = { 
              artist: String(artist), 
              song: String(name), 
              requesterId: String(requesterId || ''), 
              appleMusicId: String(appleMusicId || '') 
          };

          // Lista de eventos que indican cambio de canción
          const changeEvents = [
              "playbackStatus.nowPlayingItemDidChange", 
              "playbackStatus.nowPlayingItemDidChangeV2", 
              "playbackStatus.playbackStateDidChange", // A veces llega primero
              "get-playback" // Respuesta a nuestra petición inicial
          ];

          if (changeEvents.includes(type)) {
            console.log("🎵 Cider Now Playing:", artist, "-", name, `[${type}]`);
            // Intentar marcar inmediatamente
            checkCurrentTrackAgainstQueue();
            
            // Reintentar en 2s por si la cola no estaba cargada
            setTimeout(checkCurrentTrackAgainstQueue, 2000);
          }
        }
      });
    }

    // Wrapper for compatibility (redirects to new logic)
    function autoMarkPlayed(artist, song) {
        currentCiderTrack = { artist, song, user: '', appleMusicId: '' };
        checkCurrentTrackAgainstQueue();
    }

    function markSongAsPlayed(id, options) {
      if (!id) return;
      const doSkip = !!(options && options.skip === true);
      try {
        playedSongIds.add(id);
        normalizedPlayedSongIds.add(normalizeId(id));
        if (doSkip) {
            skippedSongIds.add(id);
        } else {
            skippedSongIds.delete(id);
        }
        playedSongsLoaded = true;
        renderQueue();
      } catch (_) {}
      try {
        const localSkipped = getLocalSkippedMap();
        const arr = Array.isArray(localSkipped[currentDay]) ? localSkipped[currentDay] : [];
        if (doSkip) {
          if (!arr.includes(id)) arr.push(id);
        } else {
          localSkipped[currentDay] = arr.filter(x => x !== id);
        }
        localSkipped[currentDay] = Array.isArray(localSkipped[currentDay]) ? localSkipped[currentDay] : arr;
        setLocalSkippedMap(localSkipped);
      } catch (_) {}
      if (!db) return;
      const payload = {
        songs: firebase.firestore.FieldValue.arrayUnion(id),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (doSkip) payload.skipped = firebase.firestore.FieldValue.arrayUnion(id);
      else payload.skipped = firebase.firestore.FieldValue.arrayRemove(id);
      db.collection('playedSongs').doc(currentDay).set(payload, { merge: true })
      .then(() => console.log("Song marked as played:", id))
      .catch(err => console.error("Error marking song as played:", err));
    }

    const currentDay = getLocalDateKey();
    try { window.__QUEUE_MODE__ = window.__QUEUE_MODE__ || safeLocalStorage.getItem('queueMode') || 'default'; } catch (_) { window.__QUEUE_MODE__ = window.__QUEUE_MODE__ || 'default'; }
    console.log("Queue Overlay v2.2 - Fix Empty Match. Listening for day:", currentDay);

    if (db) {
      let unsubscribeRequests = null;
      function applyRequestsSnapshot(snapshot) {
        const temp = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          if (!firstSeenOrder.has(doc.id)) firstSeenOrder.set(doc.id, ++firstSeenCounter);
          const item = { ...data, docId: doc.id, _seen: firstSeenOrder.get(doc.id) };
          if (!item.id) item.id = doc.id;
          temp.push(item);
        });
        temp.sort((a, b) => {
           const tA = a.ts && a.ts.toMillis ? a.ts.toMillis() : (new Date(a.ts).getTime() || 0);
           const tB = b.ts && b.ts.toMillis ? b.ts.toMillis() : (new Date(b.ts).getTime() || 0);

           const aHasTime = Number.isFinite(tA) && tA > 0;
           const bHasTime = Number.isFinite(tB) && tB > 0;
           if (aHasTime && bHasTime && tA !== tB) return tA - tB;
           if (aHasTime && !bHasTime) return -1;
           if (!aHasTime && bHasTime) return 1;

           const sA = Number(a?._seen || 0);
           const sB = Number(b?._seen || 0);
           if (sA !== sB) return sA - sB;

           const idA = String(a?.docId || a?.id || generateSongId(a) || '');
           const idB = String(b?.docId || b?.id || generateSongId(b) || '');
           if (idA && idB && idA !== idB) return idA.localeCompare(idB);
           return 0;
        });
        console.log(`Loaded ${temp.length} requests for day ${currentDay}`);
        allRequests = temp;
        renderQueue();
        checkCurrentTrackAgainstQueue();
      }

      function subscribeRequestsForDay(dayValue) {
        try { if (unsubscribeRequests) unsubscribeRequests(); } catch (_) {}
        unsubscribeRequests = null;

        const start = new Date(`${dayValue}T00:00:00`);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);

        const dayDocs = new Map();
        const tsDocs = new Map();
        let unsubDay = null;
        let unsubTs = null;

        function mergeAndApply() {
          try {
            const byId = new Map();
            dayDocs.forEach((v, k) => { if (!byId.has(k)) byId.set(k, v); });
            tsDocs.forEach((v, k) => { if (!byId.has(k)) byId.set(k, v); });

            const temp = [];
            byId.forEach((data, docId) => {
              if (!firstSeenOrder.has(docId)) firstSeenOrder.set(docId, ++firstSeenCounter);
              const item = { ...(data || {}), docId, _seen: firstSeenOrder.get(docId) };
              if (!item.id) item.id = docId;
              temp.push(item);
            });

            temp.sort((a, b) => {
              const tA = a.ts && a.ts.toMillis ? a.ts.toMillis() : (new Date(a.ts).getTime() || 0);
              const tB = b.ts && b.ts.toMillis ? b.ts.toMillis() : (new Date(b.ts).getTime() || 0);

              const aHasTime = Number.isFinite(tA) && tA > 0;
              const bHasTime = Number.isFinite(tB) && tB > 0;
              if (aHasTime && bHasTime && tA !== tB) return tA - tB;
              if (aHasTime && !bHasTime) return -1;
              if (!aHasTime && bHasTime) return 1;

              const sA = Number(a?._seen || 0);
              const sB = Number(b?._seen || 0);
              if (sA !== sB) return sA - sB;

              const idA = String(a?.docId || a?.id || generateSongId(a) || '');
              const idB = String(b?.docId || b?.id || generateSongId(b) || '');
              if (idA && idB && idA !== idB) return idA.localeCompare(idB);
              return 0;
            });

            console.log(`Loaded ${temp.length} requests for day ${currentDay}`);
            allRequests = temp;
            renderQueue();
            checkCurrentTrackAgainstQueue();
          } catch (_) {}
        }

        function stopAll() {
          try { if (unsubDay) unsubDay(); } catch (_) {}
          try { if (unsubTs) unsubTs(); } catch (_) {}
          unsubDay = null;
          unsubTs = null;
        }

        const qDay = db.collection('solicitudes').where('day', '==', dayValue);
        unsubDay = qDay.onSnapshot((snap) => {
          dayDocs.clear();
          snap.forEach((doc) => dayDocs.set(doc.id, doc.data() || {}));
          mergeAndApply();
        }, (error) => {
          console.error("Error en solicitudes (day):", error);
          try {
            const empty = document.getElementById('empty-state');
            if (empty) empty.innerHTML = '<div style="font-size: 40px; margin-bottom: 10px;">⚠️</div><div>Error leyendo solicitudes</div><div style="opacity:0.8; font-size:12px; margin-top:6px;">Revisa Firebase/Internet</div>';
          } catch (_) {}
        });

        const qTs = db.collection('solicitudes')
          .where('ts', '>=', start)
          .where('ts', '<', end)
          .orderBy('ts', 'asc');
        try {
          unsubTs = qTs.onSnapshot((snap) => {
            tsDocs.clear();
            snap.forEach((doc) => tsDocs.set(doc.id, doc.data() || {}));
            mergeAndApply();
          }, (err) => {
            console.warn("Error en solicitudes (ts):", err);
          });
        } catch (_) {}

        unsubscribeRequests = stopAll;
      }

      subscribeRequestsForDay(currentDay);

      try {
        pollSuperfanUsersOnce();
        setInterval(pollSuperfanUsersOnce, 60000);
      } catch (_) {}

      try {
        pollUserAliasesOnce();
        setInterval(pollUserAliasesOnce, 60000);
      } catch (_) {}

      try {
        // Sincronización en tiempo real del modo de cola
        db.collection('system').doc('status').onSnapshot((doc) => {
          if (doc.exists) {
            const data = doc.data();
            const mode = String(data.queueMode || '').trim();
            if (mode && mode !== window.__QUEUE_MODE__) {
              console.log("🔄 Cambio de modo detectado:", mode);
              window.__QUEUE_MODE__ = mode;
              try { safeLocalStorage.setItem('queueMode', mode); } catch (_) {}
              renderQueue();
            }
          }
        });
      } catch (_) {}

      function getYesterdayKey() {
        return getLocalDateKey(Date.now() - 24 * 60 * 60 * 1000);
      }
      const yesterday = getYesterdayKey();

      const playedByDay = {};
      const skippedByDay = {};
      const manualOrdersByDay = {};

      const syncPlayedAndManual = () => {
        playedSongIds.clear();
        normalizedPlayedSongIds.clear();
        skippedSongIds.clear();

        [yesterday, currentDay].forEach(day => {
          (playedByDay[day] || []).forEach(id => {
            playedSongIds.add(id);
            normalizedPlayedSongIds.add(normalizeId(id));
          });
          (skippedByDay[day] || []).forEach(id => {
            playedSongIds.add(id);
            normalizedPlayedSongIds.add(normalizeId(id));
            skippedSongIds.add(id);
          });
        });

        currentManualOrder = manualOrdersByDay[currentDay] || manualOrdersByDay[yesterday] || [];
        playedSongsLoaded = true;
        renderQueue();
      };

      const setupSyncListeners = (day) => {
        db.collection('playedSongs').doc(day).onSnapshot((doc) => {
          if (doc.exists) {
            const data = doc.data();
            playedByDay[day] = Array.isArray(data.songs) ? data.songs : (Array.isArray(data.list) ? data.list : []);
            skippedByDay[day] = Array.isArray(data.skipped) ? data.skipped : [];
          } else {
            playedByDay[day] = [];
            skippedByDay[day] = [];
          }
          syncPlayedAndManual();
        }, (err) => console.warn(`Error playedSongs ${day}:`, err));

        db.collection('manualOrders').doc(day).onSnapshot((doc) => {
          if (doc.exists) {
            manualOrdersByDay[day] = Array.isArray(doc.data().order) ? doc.data().order : [];
          } else {
            manualOrdersByDay[day] = [];
          }
          syncPlayedAndManual();
        }, (err) => console.warn(`Error manualOrders ${day}:`, err));
      };

      setupSyncListeners(yesterday);
      setupSyncListeners(currentDay);

      // Timeout de seguridad para carga inicial
      setTimeout(() => {
        if (!playedSongsLoaded) {
          playedSongsLoaded = true;
          renderQueue();
        }
      }, 3000);

      // El usuario solicitó desactivar las alertas flotantes en este overlay
      /*
      db.collection('notifications')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .onSnapshot((snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              const now = Date.now();
              const ts = data.timestamp ? (data.timestamp.toMillis ? data.timestamp.toMillis() : new Date(data.timestamp).getTime()) : now;
              
              if (now - ts < 10000) {
                 showNotification(data);
              }
            }
          });
        });
      */

    } else {
      console.warn("Firestore no disponible. Cola no podrá sincronizarse.");
      renderQueue();
    }

    function showNotification(data) {
        // Desactivado a petición del usuario
    }

    // --- Lógica de Simulación ---
    const debugControls = document.getElementById('debug-controls');
    debugControls.addEventListener('mouseenter', () => debugControls.style.opacity = '1');
    debugControls.addEventListener('mouseleave', () => debugControls.style.opacity = '0.2');
    function simulateQueueRequest() {
      const qs = new URLSearchParams(window.location.search);
      const artists = ["Bad Bunny", "Karol G", "Feid", "Rauw Alejandro", "Shakira", "Daddy Yankee", "Rosalía"];
      const songs = ["Tití Me Preguntó", "Provenza", "Classy 101", "Todo de Ti", "Bzrp Music Sessions, Vol. 53", "Gasolina", "Despechá"];
      
      const randomIndex = Math.floor(Math.random() * artists.length);
      const randomArtist = artists[randomIndex];
      const randomSong = songs[randomIndex];
      const randomUser = String(qs.get('user') || "Prueba").trim() || "Prueba";
      const forcedBadge = String(qs.get('badge') || '').trim();
      
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const hora = `${hh}:${mm}`;
      const uniqueId = Date.now().toString(36); // Timestamp base36 para unicidad
      const tsValue = (typeof firebase !== 'undefined' && firebase?.firestore?.FieldValue?.serverTimestamp)
        ? firebase.firestore.FieldValue.serverTimestamp()
        : now;
      const req = {
        id: `${randomUser}-${randomSong}-${randomArtist}-${hora}-${uniqueId}`.replace(/[^a-zA-Z0-9-]/g, ''),
        usuario: randomUser,
        displayName: randomUser,
        cancion: randomSong,
        artista: randomArtist,
        ts: tsValue,
        day: getLocalDateKey(now),
        hora,
        status: 'pending',
        isSimulation: true,
        badge: forcedBadge
      };

      // Enviar a Firebase para que se refleje en OBS
      console.log("Enviando simulación a Firebase:", req);
      if (!db) {
        allRequests.push(req);
        renderQueue();
        return;
      }
      db.collection('solicitudes').add(req)
        .then(() => console.log("Simulación enviada con éxito"))
        .catch(err => {
          console.error("Error enviando simulación:", err);
          try { allRequests.push(req); renderQueue(); } catch (_) {}
        });
    }

    function markFirstPending(skip) {
      const pendingRequests = allRequests.filter(req => {
        const sid = generateSongId(req);
        const did = String(req?.docId || '').trim();
        const rid = String(req?.id || '').trim();
        return !playedSongIds.has(sid) && !normalizedPlayedSongIds.has(normalizeId(sid)) &&
               !(did && (playedSongIds.has(did) || normalizedPlayedSongIds.has(normalizeId(did)))) &&
               !(rid && (playedSongIds.has(rid) || normalizedPlayedSongIds.has(normalizeId(rid))));
      });

      if (pendingRequests.length > 0) {
        const toToggle = pendingRequests[0];
        const id = generateSongId(toToggle);

        console.log("Marcando primera pendiente:", id, { skip: !!skip });
        markSongAsPlayed(id, { skip: !!skip });
      } else {
        alert("No hay canciones pendientes para marcar.");
      }
    }

    function markFirstPendingFromPanel(skip) {
      markFirstPending(!!skip);
      try { toggleMarkPanel(); } catch (_) {}
    }

    function simulateToggleFirst(e) {
      markFirstPending(!!(e && e.shiftKey === true));
    }

    // Modo de prueba automático: ?test=true
    /* 
    // DESACTIVADO para evitar spam al recargar si la URL se queda guardada
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('test') === 'true') {
      setTimeout(() => {
        console.log("Iniciando modo de prueba automático...");
        // Simular 3 pedidos para llenar la cola
        simulateQueueRequest();
        setTimeout(simulateQueueRequest, 500);
        setTimeout(simulateQueueRequest, 1000);
      }, 1000);
    } 
    */
    // Start Cider connection immediately
    setTimeout(connectCider, 2000);
    
    // --- Drag & Drop Logic for Settings Button ---
    const settingsBtn = document.getElementById('settings-btn');
    
    let isIframe = false;
    try {
        isIframe = window.self !== window.top;
    } catch (e) {
        isIframe = true;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const isPreview = urlParams.get('preview') === 'true' || urlParams.get('dashboard') === 'true';
    const isObs = typeof window.obsstudio !== 'undefined' || urlParams.get('obs') === 'true' || urlParams.get('hide_controls') === 'true';

    if (isIframe || isPreview) {
        if (settingsBtn) {
            settingsBtn.style.display = 'none';
        }
    }

    if (isObs) {
        const debugControls = document.getElementById('debug-controls');
        if (debugControls) {
            debugControls.style.display = 'none';
        }
        const markPanel = document.getElementById('mark-panel');
        if (markPanel) {
            markPanel.style.display = 'none';
            markPanel.hidden = true;
        }
        const widgetMover = document.getElementById('widget-mover');
        if (widgetMover) {
            widgetMover.style.display = 'none';
            widgetMover.hidden = true;
        }
    }

    const settingsBtnPosKey = `widget_btn_pos:${location.pathname}:settings-btn`;
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let hasMoved = false;

    // --- Drag & Drop Logic for Queue Cards ---
    let dragSrcEl = null;

    function handleDragStart(e) {
      this.style.opacity = '0.4';
      dragSrcEl = this;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', this.innerHTML);
    }

    function handleDragOver(e) {
      if (e.preventDefault) {
        e.preventDefault();
      }
      e.dataTransfer.dropEffect = 'move';
      return false;
    }

    function handleDragEnter(e) {
      this.classList.add('over');
    }

    function handleDragLeave(e) {
      this.classList.remove('over');
    }

    async function handleDrop(e) {
      if (e.stopPropagation) {
        e.stopPropagation();
      }
      const movedKey = String(dragSrcEl?.dataset?.docId || dragSrcEl?.dataset?.songId || '').trim();
      if (dragSrcEl !== this) {
        // Swap elements
        const container = document.getElementById('queue-container');
        const allCards = Array.from(container.querySelectorAll('.queue-item'));
        const srcIndex = allCards.indexOf(dragSrcEl);
        const destIndex = allCards.indexOf(this);

        if (srcIndex < destIndex) {
            container.insertBefore(dragSrcEl, this.nextSibling);
        } else {
            container.insertBefore(dragSrcEl, this);
        }
        
        await saveOrder(); // Save new order to Firebase
        highlightReorderedKey(movedKey);
      }
      return false;
    }

    function handleDragEnd(e) {
      this.style.opacity = '1';
      let items = document.querySelectorAll('.queue-item');
      items.forEach(function (item) {
        item.classList.remove('over');
      });
    }

    async function moveToTop(e) {
      e.stopPropagation();
      e.preventDefault();
      // Encontrar la tarjeta padre
      const card = e.target.closest('.queue-item');
      if (!card) return;
      const movedKey = String(card.dataset.docId || card.dataset.songId || '').trim();
      
      const container = document.getElementById('queue-container');
      // Mover al principio del contenedor (antes del primer hijo)
      container.insertBefore(card, container.firstChild);
      
      // Guardar el nuevo orden
      await saveOrder();
      highlightReorderedKey(movedKey);
    }

    function addDragEvents(card) {
      card.setAttribute('draggable', true);
      card.addEventListener('dragstart', handleDragStart, false);
      card.addEventListener('dragenter', handleDragEnter, false);
      card.addEventListener('dragover', handleDragOver, false);
      card.addEventListener('dragleave', handleDragLeave, false);
      card.addEventListener('drop', handleDrop, false);
      card.addEventListener('dragend', handleDragEnd, false);
      
      // Botón "Mover al inicio" (solo visible en modo edición)
      let topBtn = card.querySelector('.move-top-btn');
      if (!topBtn) {
        topBtn = document.createElement('button');
        topBtn.className = 'move-top-btn';
        topBtn.innerHTML = '⬆️';
        topBtn.title = 'Mover al principio de la cola';
        // Usar addEventListener para evitar conflictos
        topBtn.addEventListener('click', moveToTop);
        // Insertar en la tarjeta (asegurarse de que el CSS lo posicione bien)
        card.appendChild(topBtn);
      }
    }

    // Guardar orden manual en Firebase
    async function saveOrder() {
        const container = document.getElementById('queue-container');
        const items = Array.from(container.querySelectorAll('.queue-item'));
        const newOrder = items.map(el => el.dataset.docId || el.dataset.songId).filter(id => id);
        
        if (newOrder.length > 0) {
            console.log("Saving manual order:", newOrder);
            await persistManualOrder(newOrder);
            await activateManualQueueModeForWidget();
            try { renderQueue(); } catch (_) {}
            try { renderWidgetMoverList(); } catch (_) {}
        }
    }

    if (settingsBtn) {
      try {
        const saved = safeLocalStorage.getItem(settingsBtnPosKey);
        if (saved) {
          const pos = JSON.parse(saved);
          if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
            settingsBtn.style.left = `${pos.left}px`;
            settingsBtn.style.top = `${pos.top}px`;
          }
        }
      } catch (_) {}

      settingsBtn.addEventListener('mousedown', (e) => {
          isDragging = true;
          hasMoved = false;
          const rect = settingsBtn.getBoundingClientRect();
          dragOffsetX = e.clientX - rect.left;
          dragOffsetY = e.clientY - rect.top;
          settingsBtn.style.cursor = 'grabbing';
          
          // Disable transitions during drag for responsiveness
          settingsBtn.style.transition = 'none';
      });
    }

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        hasMoved = true;
        e.preventDefault();
        
        const x = e.clientX - dragOffsetX;
        const y = e.clientY - dragOffsetY;
        
        if (settingsBtn) {
          settingsBtn.style.left = `${x}px`;
          settingsBtn.style.top = `${y}px`;
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        
        isDragging = false;
        if (settingsBtn) {
          settingsBtn.style.cursor = 'grab';
          
          // Restore transitions
          settingsBtn.style.transition = 'background 0.3s ease, transform 0.3s ease, opacity 0.3s ease';

          if (hasMoved) {
            const rect = settingsBtn.getBoundingClientRect();
            const left = Math.max(0, Math.min(rect.left, window.innerWidth - rect.width));
            const top = Math.max(0, Math.min(rect.top, window.innerHeight - rect.height));
            settingsBtn.style.left = `${left}px`;
            settingsBtn.style.top = `${top}px`;
            try {
              safeLocalStorage.setItem(settingsBtnPosKey, JSON.stringify({ left, top }));
            } catch (_) {}
          }
        }
    });
    
    // Handle click manually to avoid triggering when dragging
    if (settingsBtn) {
      settingsBtn.addEventListener('click', (e) => {
          if (!hasMoved) {
              toggleSettings();
          }
      });
    }

    // Receptor de eventos de mensajería (postMessage) para actualización en tiempo real desde el Dashboard
    window.addEventListener('message', function(event) {
        if (!event.data) return;
        if (event.data.action === 'updateConfig') {
            const data = event.data.payload || {};
            
            // Mapear overrides locales en tiempo real
            if (data.queueOpacity !== undefined) window.queueOpacityOverride = data.queueOpacity;
            if (data.queueRadius !== undefined) window.queueRadiusOverride = data.queueRadius;
            if (data.queueFontSize !== undefined) window.queueFontSizeOverride = data.queueFontSize;
            
            if (data.queueShowCardBg !== undefined) window.queueShowCardBgOverride = data.queueShowCardBg;
            if (data.queueBorderWidth !== undefined) window.queueBorderWidthOverride = data.queueBorderWidth;
            if (data.queueBorderColor !== undefined) window.queueBorderColorOverride = data.queueBorderColor;
            if (data.queueBorderOpacity !== undefined) window.queueBorderOpacityOverride = data.queueBorderOpacity;
            if (data.queueBorderStyle !== undefined) window.queueBorderStyleOverride = data.queueBorderStyle;
            if (data.queueShowAccentBorder !== undefined) window.queueShowAccentBorderOverride = data.queueShowAccentBorder;
            if (data.queueAccentBorderWidth !== undefined) window.queueAccentBorderWidthOverride = data.queueAccentBorderWidth;
            if (data.queueShowShadow !== undefined) window.queueShowShadowOverride = data.queueShowShadow;
            if (data.queueShadowColor !== undefined) window.queueShadowColorOverride = data.queueShadowColor;
            if (data.queueShadowBlur !== undefined) window.queueShadowBlurOverride = data.queueShadowBlur;
            if (data.queueShadowOpacity !== undefined) window.queueShadowOpacityOverride = data.queueShadowOpacity;
            if (data.queueShowSweepBorder !== undefined) window.queueShowSweepBorderOverride = data.queueShowSweepBorder;

            if (data.queueTheme !== undefined) window.queueThemeOverride = data.queueTheme;
            if (data.queueWidth !== undefined) window.queueWidthOverride = Number(data.queueWidth);
            if (data.queueMinHeight !== undefined) window.queueMinHeightOverride = Number(data.queueMinHeight);
            if (data.queueSpacing !== undefined) window.queueSpacingOverride = Number(data.queueSpacing);
            if (data.queuePadding !== undefined) window.queuePaddingOverride = Number(data.queuePadding);
            if (data.queueTextGap !== undefined) window.queueTextGapOverride = Number(data.queueTextGap);
            if (data.queueShowHeader !== undefined) window.queueShowHeaderOverride = data.queueShowHeader;
            if (data.queueShowArtist !== undefined) window.queueShowArtistOverride = data.queueShowArtist;
            if (data.queueShowUser !== undefined) window.queueShowUserOverride = data.queueShowUser;
            if (data.queueShowEmpty !== undefined) window.queueShowEmptyOverride = data.queueShowEmpty;
            if (data.queueFont !== undefined) window.queueFontOverride = data.queueFont;
            if (data.queueAccentColor !== undefined) window.queueAccentColorOverride = data.queueAccentColor;
            if (data.queueBgColor !== undefined) window.queueBgColorOverride = data.queueBgColor;
            if (data.queueTextColor !== undefined) window.queueTextColorOverride = data.queueTextColor;
            if (data.queuePrimaryOpacity !== undefined) window.queuePrimaryOpacityOverride = Number(data.queuePrimaryOpacity);
            if (data.queueSecondaryOpacity !== undefined) window.queueSecondaryOpacityOverride = Number(data.queueSecondaryOpacity);
            if (data.queueMaxCards !== undefined) window.queueMaxCardsOverride = Number(data.queueMaxCards);
            if (data.queueWidthScale !== undefined) window.queueWidthScaleOverride = Number(data.queueWidthScale);
            if (data.queueHeightScale !== undefined) window.queueHeightScaleOverride = Number(data.queueHeightScale);
            if (data.queueAnimEntry !== undefined) window.queueAnimEntryOverride = data.queueAnimEntry;
            if (data.queueAnimExit !== undefined) window.queueAnimExitOverride = data.queueAnimExit;
            if (data.queueAutocorrect !== undefined) window.queueAutocorrectOverride = data.queueAutocorrect;
            if (data.queueShowAlbumArt !== undefined) window.queueShowAlbumArtOverride = data.queueShowAlbumArt;
            if (data.queueShowWaitTime !== undefined) window.queueShowWaitTimeOverride = data.queueShowWaitTime;
            if (data.queueShowTotalDuration !== undefined) window.queueShowTotalDurationOverride = data.queueShowTotalDuration;
            if (data.queueSyncAppleMusic !== undefined) window.queueSyncAppleMusicOverride = data.queueSyncAppleMusic;

            // Forzar actualización inmediata
            if (window.appliedSettings) {
                applySettings({ ...window.appliedSettings });
            } else {
                applySettings({ ...defaultSettings });
            }
        } else if (event.data.action === 'simulateRequest') {
            simulateQueueRequest();
        } else if (event.data.action === 'triggerSkip') {
            markFirstPending(true);
        } else if (event.data.action === 'triggerPlayed') {
            markFirstPending(false);
        } else if (event.data.action === 'toggleBorders') {
            toggleDebugBorders();
        } else if (event.data.action === 'toggleMover') {
            toggleWidgetMover();
        }
    });

    window.playYoutubeLinkFromQueue = function(link, title, artist, requester, id) {
        if (typeof db === 'undefined' || !db) {
            alert("Base de datos de Firebase no conectada.");
            return;
        }
        if (confirm(`¿Quieres reproducir "${title}" en el overlay de YouTube?`)) {
            db.collection('systemConfig').doc('activeYoutubeVideo').set({
                videoId: link,
                title: title,
                artist: artist,
                requester: requester,
                state: 'playing',
                timestamp: Date.now()
            }).then(() => {
                console.log("✅ Video enviado a activeYoutubeVideo:", title);
                // Marcar canción como reproducida en la cola
                if (id) {
                    markSongAsPlayed(id);
                }
            }).catch(err => {
                console.error("Error al reproducir:", err);
                alert("Error al reproducir: " + err.message);
            });
        }
    };

