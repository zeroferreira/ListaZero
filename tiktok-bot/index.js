
import { WebcastPushConnection } from 'tiktok-live-connector';
import axios from 'axios';
import { io } from 'socket.io-client';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURACIÓN ESTATICA ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Cargar Configuración Inicial
let config = {
    allowSubscribers: true,
    allowModerators: true,
    allowSuperFans: true,
    minCoinsForVip: 30,
    vipDurationSession: true,
    tiktokUsername: "zeroferreira" // Default
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
                tiktokLiveConnection.disconnect();
                // connectToLive() se llamará por el loop de reintento o manualmente
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

// Configuración de Firebase (Copiada de tu overlay)

// Configuración de Firebase (Copiada de tu overlay)
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
const db = getFirestore(firebaseApp);

// Conexión a Cider (Reproductor)
const ciderSocket = io("http://localhost:10767/", {
  transports: ['websocket'],
  reconnectionAttempts: 5
});

ciderSocket.on("connect", () => {
  console.log("✅ Conectado a Cider (Reproductor)");
});

ciderSocket.on("disconnect", () => {
  console.log("❌ Desconectado de Cider");
});

// Conexión a TikTok (Variable Global)
let tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USERNAME);

// Helper para reiniciar conexión
function resetConnection() {
    if (tiktokLiveConnection) {
        tiktokLiveConnection.removeAllListeners();
        tiktokLiveConnection.disconnect();
    }
    tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USERNAME);
    setupListeners();
}

// Configurar Listeners (se llama al inicio y al cambiar usuario)
function setupListeners() {
    // Manejo de desconexiones
    tiktokLiveConnection.on('disconnected', () => {
        console.log('❌ Live finalizado o desconectado.');
        console.log('🔄 Volviendo a buscar Live...');
        setTimeout(connectToLive, 10000); 
    });

    tiktokLiveConnection.on('streamEnd', () => {
        console.log('🏁 El stream ha terminado.');
    });

    // CHAT
    tiktokLiveConnection.on('chat', async (data) => {
        const msg = data.comment;
        const user = data.nickname;
        const userId = data.uniqueId;
        
        // --- USAR CONFIGURACIÓN DINÁMICA ---
        const isSubscriber = data.isSubscriber && config.allowSubscribers;
        const isModerator = data.isModerator && config.allowModerators;
        const isSuperFanRaw = (data.followRole >= 1) || (data.memberLevel > 0);
        const isSuperFan = isSuperFanRaw && config.allowSuperFans;
        
        const isVip = isSubscriber || isModerator || isSuperFan || userId === TIKTOK_USERNAME || tempVipUsers.has(userId);

        if (msg.toLowerCase().startsWith('!sr ') || 
            msg.toLowerCase().startsWith('!pedir ') || 
            msg.toLowerCase().startsWith('!cancion ')) {
            
            if (!isVip) {
                console.log(`🚫 ${user} intentó pedir, pero no tiene permiso.`);
                return;
            }

            const query = msg.replace(/^!(sr|pedir|cancion)\s+/i, '').trim();
            if (query.length > 0) {
                console.log(`📩 Pedido de ${user}: ${query}`);
                await handleSongRequest(user, query);
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

// Llamada inicial
setupListeners();

// --- LÓGICA DE CONEXIÓN AUTOMÁTICA ---

// --- LÓGICA DE CONEXIÓN AUTOMÁTICA ---
let isConnecting = false;

async function connectToLive() {
    if (isConnecting) return;
    isConnecting = true;

    // Asegurar que la conexión está limpia
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
            // Reintentar en 10s
            setTimeout(connectToLive, 10000);
        });
}

// Iniciar búsqueda (primera vez)
connectToLive();

// Mantenemos el proceso vivo
setInterval(() => {
    // Heartbeat
}, 60000);

// --- FUNCIONES ---

// Lista de usuarios temporales (donadores recientes)
const tempVipUsers = new Set();

// Modificar la lógica del chat para incluir tempVipUsers
/* REEMPLAZANDO EL EVENTO CHAT ANTERIOR CON ESTE NUEVO MÁS COMPLETO */


async function handleSongRequest(user, query) {
    try {
        // 1. Buscar en Apple Music (iTunes API)
        const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`;
        const response = await axios.get(searchUrl);
        
        if (response.data.resultCount === 0) {
            console.log(`⚠️ No se encontró la canción: ${query}`);
            return;
        }

        const track = response.data.results[0];
        const songName = track.trackName;
        const artistName = track.artistName;
        const artworkUrl = track.artworkUrl100.replace('100x100', '600x600'); // Mejor calidad
        const appleMusicId = track.trackId; // ID numérico

        console.log(`🎵 Canción encontrada: ${songName} - ${artistName}`);

        // 2. Agregar a la Lista Visual (Firestore)
        // Usamos el mismo formato de ID que el overlay: usuario-cancion-artista-hora
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
            ts: serverTimestamp(), // Timestamp del servidor
            status: 'pending'
        };

        // Agregar a la lista del día
        await setDoc(doc(db, 'requests', currentDay), {
            items: arrayUnion(requestData),
            lastUpdated: serverTimestamp()
        }, { merge: true });

        console.log(`✅ Agregada a la lista visual`);

        // 3. Agregar a Cider (Reproductor)
        if (ciderSocket.connected) {
            // Cider usa diferentes eventos dependiendo de la versión y plugins.
            // Intentamos el método estándar de la API de Cider.
            // Referencia: Cider API suele aceptar trackId de Apple Music
            
            // Método 1: Evento 'queue-track' (común en algunas versiones)
            ciderSocket.emit('queue-track', appleMusicId);
            
            // Método 2: Payload más complejo para versiones nuevas
            // Intentamos usar 'play-next' para ponerla como siguiente
            
            // Cider API v2 (algunos plugins) usa 'queue-track' con opcion 'next'
            // O podemos usar 'am-api-playback-queue-insert' si está disponible.
            
            // INTENTO 1: Usar 'safe_pre_add_queue' (que suele agregar al final)
            // INTENTO 2: Usar 'play-next' si existe (algunos forks de Cider lo tienen)
            
            // Para asegurar que sea la SIGUIENTE, usamos un truco:
            // Cider suele tener un endpoint /api/v1/playback/queue/next pero via socket es distinto.
            
            // Enviaremos una señal genérica que Cider suele interpretar como "Play Next" si el plugin lo soporta.
            // Si no, usaremos el estándar que agrega al final.
            
            console.log(`🎧 Enviando a Cider (Play Next si es posible)...`);
            
            ciderSocket.emit('safe_pre_add_queue', {
                artwork: { url: artworkUrl },
                name: songName,
                artistName: artistName,
                playParams: { id: String(appleMusicId) },
                url: track.trackViewUrl,
                next: true // Flag experimental para algunos plugins
            });
            
            // También probamos emitir el evento específico de "Play Next" de algunos plugins
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
