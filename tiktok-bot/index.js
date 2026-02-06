
const { WebcastPushConnection } = require('tiktok-live-connector');
const axios = require('axios');
const { io } = require('socket.io-client');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Dynamic import for Firebase (ESM only)
let initializeApp, getFirestore, collection, addDoc, doc, setDoc, arrayUnion, serverTimestamp;

(async () => {
    try {
        const firebaseAppLib = await import('firebase/app');
        initializeApp = firebaseAppLib.initializeApp;
        
        const firebaseFirestoreLib = await import('firebase/firestore');
        getFirestore = firebaseFirestoreLib.getFirestore;
        collection = firebaseFirestoreLib.collection;
        addDoc = firebaseFirestoreLib.addDoc;
        doc = firebaseFirestoreLib.doc;
        setDoc = firebaseFirestoreLib.setDoc;
        arrayUnion = firebaseFirestoreLib.arrayUnion;
        serverTimestamp = firebaseFirestoreLib.serverTimestamp;
        
        startBot();
    } catch (e) {
        console.error("Critical Error loading Firebase libraries:", e);
    }
})();

// --- CONFIGURACIÓN ESTATICA ---
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Cargar Configuración Inicial
let config = {
    allowSubscribers: true,
    allowModerators: true,
    allowSuperFans: true,
    minCoinsForVip: 30,
    vipDurationSession: true,
    tiktokUsername: "zeroferreira", // Default
    sessionId: "", // TikTok Session ID (obligatorio si hay error 521)
    dashboardPort: 3000
};

try {
    if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE);
        config = { ...config, ...JSON.parse(raw) };
        console.log("📂 Configuración cargada:", config);
    }
} catch (e) {
    console.error("Error cargando config:", e);
}

// Variables Globales
let TIKTOK_USERNAME = config.tiktokUsername;
let tiktokLiveConnection;
let isConnecting = false;
let ciderSocket;
let db; // Firebase DB reference

// --- FUNCION PRINCIPAL ---
function startBot() {
    // Configuración de Firebase
    const firebaseConfig = {
      apiKey: "AIzaSyA6c3EaIvuPEfM6sTV0YHqCBHuz35ZmNIU",
      authDomain: "zero-strom-web.firebaseapp.com",
      projectId: "zero-strom-web",
      storageBucket: "zero-strom-web.firebasestorage.app",
      messagingSenderId: "758369466349",
      appId: "1:758369466349:web:f2ced362a5a049c70b59e4"
    };

    // Inicializar Firebase
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);

    // --- SERVIDOR WEB (DASHBOARD) ---
    const app = express();
    const PORT = Number(process.env.PORT || config.dashboardPort || 3000) || 3000;

    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));

    app.get('/api/status', (req, res) => {
        res.json({
            tiktokUsername: TIKTOK_USERNAME,
            tiktokState: tiktokLiveConnection?.state || 'unknown',
            isConnecting: !!isConnecting,
            ciderConnected: !!(ciderSocket && ciderSocket.connected)
        });
    });

    // API para obtener configuración
    app.get('/api/config', (req, res) => {
        res.json(config);
    });

    // API para guardar configuración
    app.post('/api/config', (req, res) => {
        try {
            const newConfig = req.body;
            // Validar datos básicos
            if (newConfig.tiktokUsername) {
                const oldUser = config.tiktokUsername;
                config = { ...config, ...newConfig };
                
                // Guardar en disco
                fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
                console.log("💾 Configuración actualizada desde el Dashboard.");

                // Si cambió el usuario, reiniciar conexión
                if (oldUser !== config.tiktokUsername) {
                    console.log("🔄 Cambio de usuario detectado. Reiniciando conexión...");
                    TIKTOK_USERNAME = config.tiktokUsername;
                    isConnecting = false;
                    if (tiktokLiveConnection) {
                        tiktokLiveConnection.disconnect();
                    }
                    setTimeout(connectToLive, 1000);
                }
            }
            res.json({ success: true, config });
        } catch (e) {
            console.error("Error guardando config:", e);
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/test/sr', async (req, res) => {
        try {
            const body = req.body || {};
            const user = String(body.user || '').trim() || 'Prueba';
            const sendToCider = body.sendToCider !== false;
            const sendToQueue = body.sendToQueue === true;
            const appleMusicId = body.appleMusicId ? String(body.appleMusicId).trim() : '';
            const songName = body.songName ? String(body.songName).trim() : '';
            const artistName = body.artistName ? String(body.artistName).trim() : '';
            const artworkUrl = body.artworkUrl ? String(body.artworkUrl).trim() : '';

            const rawMessage = body.message ? String(body.message).trim() : '';
            let query = body.query ? String(body.query).trim() : '';
            if (rawMessage) {
                const lower = rawMessage.toLowerCase();
                if (lower.startsWith('!sr ') || lower.startsWith('!pedir ') || lower.startsWith('!cancion ')) {
                    query = rawMessage.replace(/^!(sr|pedir|cancion)\s+/i, '').trim();
                } else {
                    query = rawMessage;
                }
            }
            query = query.replace(/\s+-\s+/g, ' ').trim();
            if (!query && !appleMusicId) {
                res.status(400).json({ ok: false, error: 'Falta query o appleMusicId' });
                return;
            }

            const result = await handleSongRequest(user, query, {
                sendToCider,
                sendToQueue,
                isTest: true,
                source: 'offlineTest',
                appleMusicId,
                songName,
                artistName,
                artworkUrl
            });

            res.json({ ok: true, result });
        } catch (e) {
            console.error('Error en /api/test/sr:', e);
            res.status(500).json({ ok: false, error: e.message || String(e) });
        }
    });

    function persistConfigSafe(next = {}) {
        try {
            config = { ...config, ...(next || {}) };
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        } catch (_) {}
    }

    function startDashboard(preferredPort) {
        const port = Number(preferredPort || 3000) || 3000;
        const server = app.listen(port, () => {
            if (config.dashboardPort !== port) persistConfigSafe({ dashboardPort: port });
            console.log(`🎛️  Dashboard de Configuración: http://localhost:${port}`);
            console.log(`🧪 Prueba offline: POST http://localhost:${port}/api/test/sr`);
        });
        server.on('error', (err) => {
            if (err && err.code === 'EADDRINUSE') {
                console.error(`❌ No se pudo iniciar el dashboard: el puerto ${port} ya está en uso.`);
                console.error(`   Cierra el proceso que usa el puerto ${port} o cambia dashboardPort en config.json (ej: 3001).`);
                process.exit(1);
                return;
            }
            console.error('❌ Error iniciando dashboard:', err && err.message ? err.message : String(err));
            process.exit(1);
        });
    }

    startDashboard(PORT);

    // Conexión a Cider (Reproductor)
    ciderSocket = io("http://localhost:10767/", {
      transports: ['websocket'],
      reconnectionAttempts: 5
    });

    ciderSocket.on("connect", () => {
      console.log("✅ Conectado a Cider (Reproductor)");
    });

    ciderSocket.on("disconnect", () => {
      console.log("❌ Desconectado de Cider");
    });

    // Inicializar conexión TikTok
    console.log(`🔌 Configurando conexión para @${TIKTOK_USERNAME}...`);
    
    const connectionOptions = {
        processInitialData: false,
        enableExtendedGiftInfo: true,
        enableWebsocketUpgrade: true,
        requestPollingIntervalMs: 2000,
        clientParams: {
            app_language: 'es-ES',
            device_platform: 'web_cast'
        }
    };

    if (config.sessionId) {
        console.log("🔑 Usando Session ID configurado.");
        connectionOptions.sessionId = config.sessionId;
    } else {
        console.log("⚠️ No se ha configurado Session ID. Si falla la conexión (error 521), agrégalo en config.json");
    }

    tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USERNAME, connectionOptions);

    setupListeners();
    
    // Iniciar búsqueda
    connectToLive();
}

// Configurar Listeners
function setupListeners() {
    tiktokLiveConnection.removeAllListeners();
    
    // Debug: Log de conexión exitosa
    tiktokLiveConnection.on('connected', state => {
        console.log(`🟢 Conectado exitosamente (Room ID: ${state.roomId})`);
    });

    // Manejo de desconexiones
    tiktokLiveConnection.on('disconnected', () => {
        console.log('❌ Live finalizado o desconectado.');
        console.log('🔄 Volviendo a buscar Live...');
        setTimeout(connectToLive, 10000); 
    });
    
    tiktokLiveConnection.on('error', (err) => {
        console.error('⚠️ Error de conexión TikTok:', err);
    });

    tiktokLiveConnection.on('streamEnd', () => {
        console.log('🏁 El stream ha terminado.');
    });

    // CHAT
    tiktokLiveConnection.on('chat', async (data) => {
        const msg = data.comment;
        const user = data.nickname;
        const userId = data.uniqueId;
        
        // DEBUG: Ver todos los mensajes para confirmar que llegan
        // console.log(`[CHAT] ${user}: ${msg}`); 

        // --- USAR CONFIGURACIÓN DINÁMICA ---
        const isSubscriber = data.isSubscriber && config.allowSubscribers;
        const isModerator = data.isModerator && config.allowModerators;
        const isSuperFanRaw = (data.followRole >= 1) || (data.memberLevel > 0);
        const isSuperFan = isSuperFanRaw && config.allowSuperFans;
        
        // FIX: Comparación de usuario insensible a mayúsculas para el streamer
        const isStreamer = userId.toLowerCase() === TIKTOK_USERNAME.toLowerCase();
        
        const isVip = isSubscriber || isModerator || isSuperFan || isStreamer || tempVipUsers.has(userId);

        if (msg.toLowerCase().startsWith('!sr ') || 
            msg.toLowerCase().startsWith('!pedir ') || 
            msg.toLowerCase().startsWith('!cancion ')) {
            
            console.log(`📝 Comando detectado de ${user} (${userId}): ${msg}`);
            
            if (!isVip) {
                console.log(`🚫 ${user} intentó pedir, pero no tiene permiso.`);
                return;
            }

            const query = msg.replace(/^!(sr|pedir|cancion)\s+/i, '').trim();
            if (query.length > 0) {
                // Optimización: Reemplazar guiones con espacios para mejorar la búsqueda
                // Esto permite "Artista - Cancion" o "Cancion - Artista" sin problemas
                const cleanQuery = query.replace(/\s+-\s+/g, ' ').trim();
                
                console.log(`📩 Pedido de ${user}: ${query} (Buscando: ${cleanQuery})`);
                await handleSongRequest(user, cleanQuery);
            }
        }
    });

    // REGALOS
    tiktokLiveConnection.on('gift', async (data) => {
        const coins = data.diamondCount;
        const minCoins = config.minCoinsForVip; // USAR CONFIG
        
        if (coins >= minCoins) {
            console.log(`🎁 ${data.nickname} donó ${coins} monedas. ¡VIP por esta sesión!`);
            tempVipUsers.add(data.uniqueId);
        }
    });
}

// Conectar al Live
async function connectToLive() {
    if (isConnecting) return;
    isConnecting = true;

    if (tiktokLiveConnection.state === 'connected') {
         isConnecting = false;
         return;
    }

    console.log(`🔎 Buscando Live de @${TIKTOK_USERNAME}...`);

    tiktokLiveConnection.connect()
        .then(state => {
            console.log(`✅ Conectado al Live de ${state.roomId}!`);
            isConnecting = false;
        })
        .catch(err => {
            console.error('❌ Error al conectar:', err.message || err);
            isConnecting = false;
            setTimeout(connectToLive, 10000);
        });
}

// Lista de usuarios temporales
const tempVipUsers = new Set();

// Manejar pedido de canción
async function resolveTrackFromQuery(query) {
    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=10`;
    const response = await axios.get(searchUrl);
    if (!response.data || response.data.resultCount === 0) {
        return null;
    }

    let track = response.data.results[0];
    const avoidKeywords = ['karaoke', 'tribute', 'cover', 'instrumental', 'remix', 'lullaby', 'rendition', 'slowed', 'reverb'];
    const cleanTrack = response.data.results.find(t => {
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

    if (cleanTrack) {
        track = cleanTrack;
    }

    const songName = track.trackName;
    const artistName = track.artistName;
    const artworkUrl = String(track.artworkUrl100 || '').replace('100x100', '600x600');
    const appleMusicId = track.trackId;
    const trackViewUrl = track.trackViewUrl || '';
    if (!songName || !artistName || !appleMusicId) {
        return null;
    }
    return { songName, artistName, artworkUrl, appleMusicId: String(appleMusicId), trackViewUrl };
}

async function handleSongRequest(user, query, options = {}) {
    try {
        const sendToQueue = options.sendToQueue !== false;
        const sendToCider = options.sendToCider !== false;
        const isTest = !!options.isTest;
        const source = options.source ? String(options.source) : '';

        let resolved = null;
        const overrideId = options.appleMusicId ? String(options.appleMusicId).trim() : '';
        if (overrideId) {
            resolved = {
                songName: String(options.songName || query || '').trim() || 'Sin título',
                artistName: String(options.artistName || '').trim(),
                artworkUrl: String(options.artworkUrl || '').trim(),
                appleMusicId: overrideId,
                trackViewUrl: ''
            };
        } else {
            resolved = await resolveTrackFromQuery(query);
        }

        if (!resolved) {
            console.log(`⚠️ No se encontró la canción: ${query}`);
            return { ok: false, error: 'No se encontró track' };
        }

        const songName = resolved.songName;
        const artistName = resolved.artistName;
        const artworkUrl = resolved.artworkUrl;
        const appleMusicId = resolved.appleMusicId;
        const trackViewUrl = resolved.trackViewUrl;

        console.log(`🎵 Canción encontrada: ${songName} - ${artistName}`);

        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const hora = `${hh}:${mm}`;
        const songId = `${user}-${songName}-${artistName}-${hora}`.replace(/[^a-zA-Z0-9-]/g, '');
        const currentDay = getLocalDateKey();

        const requestData = {
            id: songId,
            usuario: user,
            cancion: songName,
            artista: artistName,
            cover: artworkUrl,
            ts: serverTimestamp(),
            status: 'pending',
            day: currentDay
        };
        if (isTest) {
            requestData.isSimulation = true;
            requestData.isTest = true;
            if (source) requestData.source = source;
        }

        let queueSaved = false;
        let queueDocId = '';
        if (sendToQueue) {
            const docRef = await addDoc(collection(db, 'solicitudes'), requestData);
            queueSaved = true;
            queueDocId = docRef && docRef.id ? docRef.id : '';
            console.log(`✅ Agregada a la lista visual`);
        }

        let ciderSent = false;
        if (sendToCider) {
            if (ciderSocket && ciderSocket.connected) {
                ciderSocket.emit('safe_pre_add_queue', {
                    artwork: { url: artworkUrl },
                    name: songName,
                    artistName: artistName,
                    playParams: { id: String(appleMusicId) },
                    url: trackViewUrl,
                    next: true
                });
                ciderSocket.emit('playback:queue:add-next', { id: String(appleMusicId) });
                ciderSent = true;
                console.log(`🎧 Enviada orden a Cider (ID: ${appleMusicId})`);
            } else {
                console.warn(`⚠️ No se pudo enviar a Cider (No conectado)`);
            }
        }

        return {
            ok: true,
            user,
            query,
            track: { songName, artistName, artworkUrl, appleMusicId, trackViewUrl },
            sendToQueue,
            queueSaved,
            queueDocId,
            sendToCider,
            ciderConnected: !!(ciderSocket && ciderSocket.connected),
            ciderSent
        };
    } catch (error) {
        console.error("❌ Error procesando pedido:", error.message);
        return { ok: false, error: error.message || String(error) };
    }
}

function getLocalDateKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

// Mantener el proceso vivo
process.on('uncaughtException', (err) => {
    console.error('Error no capturado:', err);
});
