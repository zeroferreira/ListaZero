
const { WebcastPushConnection } = require('tiktok-live-connector');
const axios = require('axios');
const { io } = require('socket.io-client');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Dynamic import for Firebase (ESM only)
let initializeApp, getFirestore, doc, setDoc, arrayUnion, serverTimestamp;

(async () => {
    try {
        const firebaseAppLib = await import('firebase/app');
        initializeApp = firebaseAppLib.initializeApp;
        
        const firebaseFirestoreLib = await import('firebase/firestore');
        getFirestore = firebaseFirestoreLib.getFirestore;
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
    sessionId: "" // TikTok Session ID (obligatorio si hay error 521)
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
    const PORT = 3000;

    app.use(express.json());
    app.use(express.static('public'));

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

    app.listen(PORT, () => {
        console.log(`🎛️  Dashboard de Configuración: http://localhost:${PORT}`);
    });

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
async function handleSongRequest(user, query) {
    try {
        // 1. Buscar en Apple Music
        // Aumentamos el límite para poder filtrar resultados malos (karaoke, covers, etc.)
        const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=10`;
        const response = await axios.get(searchUrl);
        
        if (response.data.resultCount === 0) {
            console.log(`⚠️ No se encontró la canción: ${query}`);
            return;
        }

        // Selección inteligente de canción
        let track = response.data.results[0]; // Por defecto el primero
        
        // Palabras clave a evitar
        const avoidKeywords = ['karaoke', 'tribute', 'cover', 'instrumental', 'remix', 'lullaby', 'rendition', 'slowed', 'reverb'];
        
        // Buscar el mejor resultado que NO tenga palabras prohibidas
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
        } else {
             console.log(`⚠️ Todos los resultados parecen ser covers/karaoke, usando el primero disponible.`);
        }

        const songName = track.trackName;
        const artistName = track.artistName;
        const artworkUrl = track.artworkUrl100.replace('100x100', '600x600'); 
        const appleMusicId = track.trackId;

        console.log(`🎵 Canción encontrada: ${songName} - ${artistName}`);

        // 2. Agregar a Firebase
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
            day: currentDay // Critical for queue_overlay query
        };

        // Cambiar a colección 'solicitudes' para compatibilidad con overlay
        // Usamos add() para crear un documento nuevo por solicitud
        await db.collection('solicitudes').add(requestData);

        /*
        // OLD METHOD (Incompatible with current overlay)
        await setDoc(doc(db, 'requests', currentDay), {
            items: arrayUnion(requestData),
            lastUpdated: serverTimestamp()
        }, { merge: true });
        */

        console.log(`✅ Agregada a la lista visual`);

        // 3. Agregar a Cider
        if (ciderSocket && ciderSocket.connected) {
            console.log(`🎧 Enviando a Cider (Play Next si es posible)...`);
            
            ciderSocket.emit('safe_pre_add_queue', {
                artwork: { url: artworkUrl },
                name: songName,
                artistName: artistName,
                playParams: { id: String(appleMusicId) },
                url: track.trackViewUrl,
                next: true
            });
            
            ciderSocket.emit('playback:queue:add-next', {
                 id: String(appleMusicId)
            });

            console.log(`🎧 Enviada orden a Cider (ID: ${appleMusicId})`);
        } else {
            console.warn(`⚠️ No se pudo enviar a Cider (No conectado)`);
        }

    } catch (error) {
        console.error("❌ Error procesando pedido:", error.message);
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
