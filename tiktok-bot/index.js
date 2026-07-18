
const { WebcastPushConnection } = require('tiktok-live-connector');
const axios = require('axios');
const { io } = require('socket.io-client');
const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

let SocketIOServer = null;
try {
    ({ Server: SocketIOServer } = require('socket.io'));
} catch (_) {
    SocketIOServer = null;
}

let initializeApp, getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, getDocs, updateDoc, query, where, limit;
try {
    ({ initializeApp } = require('firebase/app'));
} catch (e) {
    console.error('Critical Error loading Firebase libraries:', e);
    console.error('Solución: ejecuta "npm install" dentro de la carpeta tiktok-bot y usa Node 18+.');
    process.exit(1);
}

// --- ACTUALIZADOR DE ESTADO LIVE ---
let dbStatus = null;
let liveHeartbeatInterval = null;
function stopLiveHeartbeat() {
    try {
        if (liveHeartbeatInterval) {
            clearInterval(liveHeartbeatInterval);
            liveHeartbeatInterval = null;
        }
    } catch (_) {}
}
function startLiveHeartbeat() {
    stopLiveHeartbeat();
    liveHeartbeatInterval = setInterval(async () => {
        try { updateLiveStatus(true); } catch (_) {}
        try { await syncRoomLikesFromApi(); } catch (_) {}
    }, 60 * 1000);
}
function initStatusUpdater(firebaseConfig) {
    if (!firebaseConfig) {
        console.error("❌ initStatusUpdater: No se recibió configuración de Firebase.");
        return;
    }
    try {
        const { initializeApp: initApp } = require('firebase/app');
        // Usar nombre único para no chocar con la app principal
        const app = initApp(firebaseConfig, 'statusUpdater');
        const { getFirestore: getFS } = require('firebase/firestore');
        dbStatus = getFS(app);
        console.log("✅ Sistema de actualización de estado LIVE inicializado correctamente.");
    } catch (e) { 
        console.error("❌ Error CRÍTICO inicializando actualizador de estado:", e); 
    }
}

function updateLiveStatus(isLive, roomId = null) {
    if (!dbStatus) {
        console.error("⚠️ updateLiveStatus invocado pero dbStatus es NULL. ¿Falló la inicialización?");
        return;
    }
    try {
        const { doc, setDoc, serverTimestamp } = require('firebase/firestore'); 
        const docRef = doc(dbStatus, 'system', 'status');
        const updateData = {
            isLive: isLive,
            lastUpdate: serverTimestamp()
        };
        if (isLive && roomId) {
            updateData.roomId = roomId;
        }
        setDoc(docRef, updateData, { merge: true })
        .then(() => console.log(`✅ Estado LIVE actualizado: ${isLive ? 'ONLINE' : 'OFFLINE'}${roomId ? ' (Room ID: ' + roomId + ')' : ''}`))
        .catch(err => console.error("Error updating live status:", err));
    } catch(e) { console.error("Update live status failed:", e); }
}

const { 
    getFirestore: getFirestoreFn, 
    doc: docFn, 
    getDoc: getDocFn, 
    setDoc: setDocFn, 
    updateDoc: updateDocFn, 
    arrayUnion, 
    collection: collectionFn, 
    addDoc: addDocFn, 
    onSnapshot, 
    serverTimestamp: serverTimestampFn,
    query: queryFn,
    where: whereFn,
    getDocs: getDocsFn,
    deleteDoc,
    increment 
} = require('firebase/firestore');

const { getDatabase, ref, set: rtdbSet } = require('firebase/database');

let rtdb; // Instancia global de Realtime Database

async function syncUserStatsToRtdb(userKey) {
    if (!db || !rtdb) return;
    try {
        const normFirestoreUser = userKey.trim();
        const normRtdbUser = normFirestoreUser.toLowerCase().replace(/[.#$\[\]]/g, '_');
        
        const snap = await getDocFn(docFn(db, 'userStats', normFirestoreUser));
        if (!snap || !snap.exists()) return;
        const data = snap.data() || {};
        
        const rtdbUserData = {
            points: Number(data.totalPoints || 0) || 0,
            level: Number((data.gamification && data.gamification.level) || data.level || 1) || 1,
            xp: Number(data.xp || 0) || 0,
            achievements: Array.isArray(data.gamification && data.gamification.achievements) ? data.gamification.achievements : [],
            streaks: data.gamification && data.gamification.streaks ? data.gamification.streaks : { current: 0, best: 0, lastActivity: null, calendar: {} },
            stats: data.gamification && data.gamification.stats ? data.gamification.stats : { totalSongs: 0, uniqueArtists: 0, activeDays: 0, isVip: !!data.isVip },
            displayName: String(data.displayName || userKey).trim(),
            tiktokId: String(data.tiktokId || '').trim(),
            profilePic: String(data.profilePic || data.profilePhoto || '').trim(),
            lastUpdated: new Date().toISOString()
        };
        
        await rtdbSet(ref(rtdb, `liveUsers/${normRtdbUser}`), rtdbUserData);
    } catch (e) {
        console.warn(`[RTDB Sync Error] No se pudo sincronizar ${userKey} a RTDB:`, e.message);
    }
}

async function setDocInterceptor(documentReference, data, options) {
    const result = await setDocFn(documentReference, data, options);
    try {
        if (documentReference && documentReference.path && documentReference.path.startsWith('userStats/')) {
            const userKey = documentReference.id;
            syncUserStatsToRtdb(userKey).catch(() => {});
        }
    } catch (_) {}
    return result;
}

async function updateDocInterceptor(documentReference, ...args) {
    const result = await updateDocFn(documentReference, ...args);
    try {
        if (documentReference && documentReference.path && documentReference.path.startsWith('userStats/')) {
            const userKey = documentReference.id;
            syncUserStatsToRtdb(userKey).catch(() => {});
        }
    } catch (_) {}
    return result;
}

// Para usar el setDoc local interceptado en todo el script
const setDoc = setDocInterceptor;

let db; // RESTORED
let firebaseAuthPromise = Promise.resolve();

let _liveCodeCache = '';
let _liveCodeCacheAt = 0;
async function getLiveCodeCached(opts = {}) {
    const force = !!(opts && opts.force === true);
    const now = Date.now();
    if (!force && _liveCodeCacheAt && (now - _liveCodeCacheAt) < 15000) return _liveCodeCache;
    _liveCodeCacheAt = now;
    try {
        if (!db) return _liveCodeCache;
        const snap = await getDocFn(docFn(db, 'system', 'status'));
        const data = snap && typeof snap.exists === 'function' && snap.exists() ? (snap.data() || {}) : {};
        const code = String(data.liveCode || '').trim();
        _liveCodeCache = code;
    } catch (_) {}
    return _liveCodeCache;
}

function maskLiveCode(code) {
    const s = String(code || '');
    if (!s) return '';
    if (s.length <= 2) return '*'.repeat(s.length);
    const first = s.slice(0, 1);
    const last = s.slice(-1);
    return `${first}${'*'.repeat(Math.max(0, s.length - 2))}${last}`;
}

// Asignar a variables globales
getFirestore = getFirestoreFn; // RESTORED
doc = docFn;
getDoc = getDocFn;
updateDoc = updateDocInterceptor;
collection = collectionFn;
addDoc = addDocFn;
serverTimestamp = serverTimestampFn;
query = queryFn;
where = whereFn;
getDocs = getDocsFn;
limit = require('firebase/firestore').limit;

// Inicializar Firebase DB Principal
try {
    // Verificar si ya existe la app por defecto para evitar "app/duplicate-app"
    let app;
    const { getApps, getApp } = require('firebase/app');
    
    if (getApps().length === 0) {
        app = initializeApp({
          apiKey: "AIzaSyA6c3EaIvuPEfM6sTV0YHqCBHuz35ZmNIU",
          authDomain: "zero-strom-web.firebaseapp.com",
          projectId: "zero-strom-web",
          storageBucket: "zero-strom-web.appspot.com",
          messagingSenderId: "758369466349",
          appId: "1:758369466349:web:f2ced362a5a049c70b59e4"
        });
        console.log("🔥 Firebase inicializado correctamente.");
    } else {
        app = getApp(); // Usar la existente
        console.log("🔥 Reutilizando instancia de Firebase existente.");
    }
    
    db = getFirestoreFn(app);
    rtdb = getDatabase(app);
    try {
        const { getAuth, signInAnonymously } = require('firebase/auth');
        const auth = getAuth(app);
        firebaseAuthPromise = signInAnonymously(auth).catch((e) => {
            console.warn('⚠️ No se pudo autenticar Firebase (anon):', e && e.message ? e.message : String(e));
        });
    } catch (_) {
        firebaseAuthPromise = Promise.resolve();
    }
} catch (e) {
    console.error("Error inicializando Firebase:", e);
}
// -----------------------------------

// --- CONFIGURACIÓN ESTATICA Y MULTIUSUARIO ---
const PROFILES_DIR = path.join(__dirname, 'profiles');
const ACTIVE_PROFILE_FILE = path.join(PROFILES_DIR, 'active_profile.json');

// Asegurar que exista la carpeta de perfiles
if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR);
}

// Cargar perfil activo
let activeProfile = 'zeroferreira';
if (fs.existsSync(ACTIVE_PROFILE_FILE)) {
    try {
        const raw = fs.readFileSync(ACTIVE_PROFILE_FILE, 'utf8');
        activeProfile = JSON.parse(raw).activeProfile || 'zeroferreira';
    } catch (_) {}
}

const activeProfileDir = path.join(PROFILES_DIR, activeProfile);
if (!fs.existsSync(activeProfileDir)) {
    fs.mkdirSync(activeProfileDir);
}

const PROFILE_CONFIG_FILE = path.join(activeProfileDir, 'config.json');
const PROFILE_FB_CONFIG_FILE = path.join(activeProfileDir, 'firebase-config.js');

let config = {
    allowSubscribers: true,
    allowModerators: true,
    allowSuperFans: true,
    minCoinsForVip: 30,
    vipDurationSession: true,
    tiktokUsername: activeProfile === 'zeroferreira' ? 'zeroferreira' : activeProfile,
    sessionId: "",
    ttTargetIdc: "",
    dashboardPort: 3000,
    ciderUrl: "http://localhost:10767",
    mockCider: false,
    requireVipForSr: false,
    allowPointsCommand: true,
    likesPerPoint: 300,
    commandAliases: ["!zr", "!sr", "!pedir", "!cancion"],
    ignoreExampleQuery: "artista cancion"
};

// Si el perfil no tiene sus archivos, copiarlos de la raíz o crearlos
if (!fs.existsSync(PROFILE_CONFIG_FILE)) {
    const rootConfig = path.join(__dirname, 'config.json');
    if (fs.existsSync(rootConfig)) {
        fs.copyFileSync(rootConfig, PROFILE_CONFIG_FILE);
    } else {
        fs.writeFileSync(PROFILE_CONFIG_FILE, JSON.stringify(config, null, 2));
    }
}
if (!fs.existsSync(PROFILE_FB_CONFIG_FILE)) {
    const rootFbConfig = path.join(__dirname, 'firebase-config.js');
    if (fs.existsSync(rootFbConfig)) {
        fs.copyFileSync(rootFbConfig, PROFILE_FB_CONFIG_FILE);
    }
}

const CONFIG_FILE = PROFILE_CONFIG_FILE;

let overlayAlertsConfig = {
    controlShowGoals: false,
    controlShowLikesLock: false,
    controlShowTimer: false,
    controlShowAlerts: false,
    minLikesAlert: 100,
    likesAlertMsg: "¡Envió {likes} likes! ❤️",
    minCoinsAlert: 1,
    giftsAlertMsg: "¡Gracias por {repeatCount}x {giftName}! 🎁",
    enableFollowAlert: true,
    followsAlertMsg: "¡gracias por seguir el canal! 👤",
    enableSubscribeAlert: true,
    subsAlertMsg: "¡gracias por suscribirte al canal! ⭐",
    welcomeOverlayEnabled: true,
    welcomeOverlayGreetingTemplate: "¡Acaba de entrar al Live! 👋",
    welcomeOverlayAllowAll: true,
    welcomeOverlayAllowFollowers: false,
    welcomeOverlayAllowSubscribers: false,
    welcomeOverlayAllowModerators: false
};

try {
    if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE);
        config = { ...config, ...JSON.parse(raw) };
    }
    
    // Auto-corregir nombres de usuario por defecto
    if (activeProfile === 'zeroferreira' && (config.tiktokUsername === 'testuser2' || !config.tiktokUsername)) {
        config.tiktokUsername = 'zeroferreira';
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    } else if (activeProfile === 'videojuegos' && (config.tiktokUsername === 'videojuegos' || config.tiktokUsername === 'testuser2' || !config.tiktokUsername)) {
        config.tiktokUsername = 'game.zer0';
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    }
    
    console.log(`📂 Configuración cargada del perfil [${activeProfile}]:`, config);
    
    // Cargar credenciales Firebase Web para actualizar estado LIVE
    const fbConfigFile = PROFILE_FB_CONFIG_FILE;
    if (fs.existsSync(fbConfigFile)) {
        const fbConfig = require(fbConfigFile);
        initStatusUpdater(fbConfig);
    } else {
        // Fallback config si no existe el archivo
        initStatusUpdater({
          apiKey: "AIzaSyA6c3EaIvuPEfM6sTV0YHqCBHuz35ZmNIU",
          authDomain: "zero-strom-web.firebaseapp.com",
          projectId: "zero-strom-web",
          appId: "1:758369466349:web:f2ced362a5a049c70b59e4"
        });
    }
} catch (e) {
    console.error("Error cargando config:", e);
}

// Variables Globales
let TIKTOK_USERNAME = config.tiktokUsername;
let tiktokLiveConnection;
let isConnecting = false;
let isRetrying = false;       // true durante el timeout de 10s antes del reintento
let retryTimeoutEnd = 0;      // timestamp cuando terminará el reintento
let lastConnectionError = ''; // último mensaje de error de conexión TikTok
let manualDisconnect = false;
let retryTimeoutId = null;
let ciderSocket;
let tiktokWebsocketUpgradeEnabled = true;
let tiktokConnectionOptions = null;

// --- DEDUPLICACIÓN DE EVENTOS ---
// Previene que el mismo mensaje/regalo se procese múltiples veces
// cuando hay múltiples conexiones activas o reconexiones
const processedMsgIds = new Set();
const MAX_PROCESSED_IDS = 2000; // Límite para no crecer infinito en memoria
function isDuplicate(msgId) {
    if (!msgId) return false;
    const id = String(msgId);
    if (processedMsgIds.has(id)) return true;
    processedMsgIds.add(id);
    // Limpiar si crece demasiado (FIFO aproximado)
    if (processedMsgIds.size > MAX_PROCESSED_IDS) {
        const first = processedMsgIds.values().next().value;
        processedMsgIds.delete(first);
    }
    return false;
}

function buildTikTokConnectionOptions() {
    console.log("🔍 DEBUG CONFIG:", { eulerApiKey: config.eulerApiKey, keys: Object.keys(config), __dirname });
    const sessionId = String(config.sessionId || '').trim();
    const ttTargetIdc = String(config.ttTargetIdc || '').trim();

    try {
        const { SignConfig } = require('tiktok-live-connector');
        if (SignConfig) {
            const key = String(config.eulerApiKey || '').trim();
            if (key) {
                SignConfig.apiKey = key;
                console.log(`🔑 Configurada API Key de Euler Stream para firma de conexión.`);
            } else {
                SignConfig.apiKey = undefined;
            }
        }
    } catch (e) {
        console.warn('⚠️ No se pudo configurar SignConfig:', e.message);
    }

    const opts = {
        processInitialData: false,
        enableExtendedGiftInfo: true,
        enableWebsocketUpgrade: true,
        requestPollingIntervalMs: 5000,
        clientParams: {
            app_language: 'es-ES',
            device_platform: 'web',
            aid: 1988,
            version_code: '180800',
            browser_language: 'es-ES',
            browser_platform: 'Win32',
            browser_name: 'Mozilla',
            browser_version: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
    };

    // IMPORTANTE: la nueva versión de tiktok-live-connector requiere AMBOS
    // sessionId Y ttTargetIdc juntos. Si falta alguno, no se usa ninguno.
    if (sessionId && ttTargetIdc) {
        opts.sessionId = sessionId;
        opts.ttTargetIdc = ttTargetIdc;
        console.log(`🔑 Usando sesión autenticada (sessionId + tt-target-idc configurados).`);
    } else if (sessionId && !ttTargetIdc) {
        console.warn(`⚠️ sessionId configurado pero falta tt-target-idc. Conectando en modo anónimo.`);
        console.warn(`💡 Para usar sesión autenticada, ve a Configuración y agrega el valor de la cookie "tt-target-idc" de TikTok.`);
    } else {
        console.log(`🔓 Conectando en modo anónimo (sin sesión).`);
    }

    return opts;
}

function getSrAliases() {
    const base = Array.isArray(config.commandAliases) && config.commandAliases.length > 0
        ? config.commandAliases
        : ["!sr", "!pedir", "!cancion"];
    const set = new Set();
    ["!zr", ...base].forEach(a => {
        const v = String(a || '').trim();
        if (v) set.add(v);
    });
    return Array.from(set);
}

function parseSrCommand(message, aliases) {
    const msg = String(message || '');
    const lower = msg.toLowerCase();
    for (const alias of (aliases || [])) {
        const a = String(alias || '').trim();
        if (!a) continue;
        const aLower = a.toLowerCase();
        if (!lower.startsWith(aLower)) continue;
        const nextChar = msg.charAt(a.length);
        if (nextChar && !/\s/.test(nextChar)) continue;
        return { alias: a, query: msg.substring(a.length).trim() };
    }
    return null;
}

function detectYoutubeUrl(text) {
    const match = String(text || '').match(/(https?:\/\/)?([a-z0-9-]+\.)?(youtube\.com|youtu\.be)\/[^\s]+/i);
    if (!match) return null;
    let url = match[0];
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    return url;
}

async function extractYoutubeMetadata(url) {
    try {
        console.log(`🔍 Intentando extraer metadatos de YouTube para bot: ${url}`);
        const resp = await axios.get(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, { timeout: 4000 });
        const data = resp.data;
        if (data && data.title) {
            let title = data.title;
            let artist = data.author_name || '';
            let artworkUrl = data.thumbnail_url || '';
            
            // Replicar fielmente la lógica que tiene la web (index.js)
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
            return { title, artist, artworkUrl };
        }
    } catch (e) {
        console.warn('⚠️ No se pudieron obtener metadatos del link de YouTube:', e.message || String(e));
    }
    return null;
}
// let db; // REDUNDANT
const recentSrEvents = [];
const pendingCiderQueue = [];
let ciderFlushInProgress = false;

let mockCiderHttpServer = null;
let mockCiderIo = null;
let mockCiderPort = 0;
let mockCiderQueue = [];
let mockCiderNowPlaying = null;

function normalizeComparableText(v) {
    return String(v || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '')
        .trim();
}

const badgeSets = {
    vip: new Set(),
    z0Vip: new Set(),
    donador: new Set(),
    z0Fan: new Set(),
    z0Platinum: new Set(),
    superfan: new Set(),
    selected: new Map()
};
let USER_ALIASES_MAP = {}; // Mapa de vinculación (TikTok Handle -> Web User)
const runtimeSuperfanUsers = new Set();
const tempDonadorUsers = new Set();
let badgeSetsUpdatedAt = 0;
let badgeSetsRefreshing = false;

function normalizeUserKeyForBadges(v) {
    try {
        return String(v || '').trim().replace(/^@/, '').toLowerCase();
    } catch (_) {
        return '';
    }
}

function getBadgeForUser(userKey, userId, displayName) {
    const candidates = [];
    const u = normalizeUserKeyForBadges(userKey);
    const uid = normalizeUserKeyForBadges(userId);
    const dn = normalizeUserKeyForBadges(displayName);
    if (u) candidates.push(u);
    if (uid && uid !== u) candidates.push(uid);
    if (dn && dn !== u && dn !== uid) candidates.push(dn);
    if (!candidates.length) return '';

    for (let i = 0; i < candidates.length; i++) {
        const k = candidates[i];
        const selected = badgeSets.selected.get(k);
        if (selected) return selected;
    }
    for (let i = 0; i < candidates.length; i++) {
        const k = candidates[i];
        if (runtimeSuperfanUsers.has(k)) return 'superfan';
    }
    for (let i = 0; i < candidates.length; i++) {
        const k = candidates[i];
        if (badgeSets.superfan.has(k)) return 'superfan';
        if (badgeSets.z0Platinum.has(k)) return 'z0-platino';
        if (badgeSets.z0Vip.has(k)) return 'z0-vip';
        if (badgeSets.vip.has(k)) return 'vip';
        if (badgeSets.donador.has(k)) return 'donador';
        if (badgeSets.z0Fan.has(k)) return 'z0-fan';
    }

    // Check Top Donors (Gold, Silver, Bronze)
    if (donorRanks.gold && donorRanks.gold.user === u) return 'donador-oro'; 
    if (donorRanks.silver && donorRanks.silver.user === u) return 'donador-plata';
    if (donorRanks.bronze && donorRanks.bronze.user === u) return 'donador-bronce';

    // Check tempVipUsers (Session VIPs/Donors)
    for (let i = 0; i < candidates.length; i++) {
        const k = candidates[i];
        if (tempVipUsers.has(k)) return 'donador'; // Default donador (after Top 3)
    }
    for (let i = 0; i < candidates.length; i++) {
        const k = candidates[i];
        if (tempDonadorUsers.has(k)) return 'donador';
    }

    return '';
}

async function grantZ0FanFromTikTok(userId, displayName) {
    if (!db) return false;
    const resolved = await getCanonicalUserKey(userId, displayName);
    const userKey = String(resolved.userKey || userId || '').trim();
    if (!userKey) return false;
    await setDoc(docFn(db, 'z0FanUsers', userKey), { name: userKey }, { merge: true });
    const norm = normalizeUserKeyForBadges(userKey);
    if (norm) badgeSets.z0Fan.add(norm);
    console.log(`⚡ z0-Fan otorgado: ${userKey}`);
    return true;
}

async function refreshBadgeSets() {
    try {
        if (!db || typeof getDocs !== 'function' || typeof collection !== 'function') return;
        if (badgeSetsRefreshing) return;
        badgeSetsRefreshing = true;
        const targets = [
            { col: 'vipUsers', set: badgeSets.vip, field: 'name' },
            { col: 'z0VipUsers', set: badgeSets.z0Vip, field: 'name' },
            { col: 'donadorUsers', set: badgeSets.donador, field: 'name' },
            { col: 'z0FanUsers', set: badgeSets.z0Fan, field: 'name' },
            { col: 'z0PlatinumUsers', set: badgeSets.z0Platinum, field: 'name' },
            { col: 'superfanUsers', set: badgeSets.superfan, field: 'name' }
        ];
        for (let i = 0; i < targets.length; i++) {
            const t = targets[i];
            const snap = await getDocs(collection(db, t.col));
            const next = new Set();
            snap.forEach((docSnap) => {
                const d = docSnap.data ? (docSnap.data() || {}) : {};
                const raw = d[t.field] || docSnap.id || '';
                const name = normalizeUserKeyForBadges(raw);
                if (name) next.add(name);
            });
            t.set.clear();
            next.forEach((v) => t.set.add(v));
        }

        const selSnap = await getDocs(collection(db, 'selectedBadges'));
        const nextMap = new Map();
        selSnap.forEach((docSnap) => {
            const d = docSnap.data ? (docSnap.data() || {}) : {};
            const rawName = d.name || docSnap.id || '';
            const key = normalizeUserKeyForBadges(rawName);
            const badge = String(d.badge || '').trim();
            if (key && badge) nextMap.set(key, badge);
        });
        badgeSets.selected = nextMap;
        badgeSetsUpdatedAt = Date.now();
        console.log(`🏷️ Insignias sincronizadas: superfan=${badgeSets.superfan.size} vip=${badgeSets.vip.size} z0Vip=${badgeSets.z0Vip.size} donador=${badgeSets.donador.size} z0Fan=${badgeSets.z0Fan.size} z0Platino=${badgeSets.z0Platinum.size} selected=${badgeSets.selected.size}`);
        
        // Sincronizar también los alias de vinculación
        await refreshUserAliases();
    } catch (e) {
        console.warn('⚠️ No se pudieron actualizar insignias (vip/z0/donador):', e && e.message ? e.message : String(e));
    } finally {
        badgeSetsRefreshing = false;
    }
}

async function refreshUserAliases() {
    if (!db) return;
    try {
        const docSnap = await getDoc(doc(db, 'systemConfig', 'userAliases'));
        if (docSnap.exists()) {
            USER_ALIASES_MAP = docSnap.data() || {};
            console.log(`🔗 Alias de vinculación cargados: ${Object.keys(USER_ALIASES_MAP).length}`);
        }
    } catch (e) {
        console.warn('⚠️ Error cargando userAliases:', e.message);
    }
}

async function ensureBadgeSetsFresh() {
    try {
        if (!db) return;
        const now = Date.now();
        const age = badgeSetsUpdatedAt ? (now - badgeSetsUpdatedAt) : Infinity;
        if (age > 15 * 60 * 1000) {
            await refreshBadgeSets();
        } else if (!badgeSetsUpdatedAt) {
            await refreshBadgeSets();
        }
    } catch (_) {}
}

function normalizeUserKeyText(v) {
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

const userKeyCache = new Map();
async function getCanonicalUserKey(userId, displayName) {
    const uid = normalizeUserKeyText(userId);
    const name = normalizeUserKeyText(displayName);
    const now = Date.now();
    const cached = uid ? userKeyCache.get(uid) : null;
    if (cached && (now - cached.ts) < (6 * 60 * 60 * 1000)) return cached;

    let userKey = uid || name || 'anon';
    let bestDisplay = String(displayName || '').trim() || String(userId || '').trim() || userKey;

    // 0. Resolver Alias (Vinculación) - Recursivo hasta 5 niveles
    const resolveAlias = (key, depth = 0) => {
        if (!key || depth > 5) return key;
        const normKey = key.replace(/^@/, '').toLowerCase();
        if (USER_ALIASES_MAP && USER_ALIASES_MAP[normKey]) {
            const target = USER_ALIASES_MAP[normKey];
            // Si el alias apunta a sí mismo (ignorando @ y case), romper ciclo
            if (target.replace(/^@/, '').toLowerCase() === normKey) return normKey;
            return resolveAlias(target, depth + 1);
        }
        return normKey;
    };

    const aliasedKey = resolveAlias(uid || name);
    if (aliasedKey && aliasedKey !== (uid || name)) {
        userKey = aliasedKey;
        // console.log(`🔗 Usando alias para ${uid || name} -> ${userKey}`);
    }

    // FUSIÓN AUTOMÁTICA AL VUELO: Si no está aliased en memoria, pero el nickname ('name') tiene un
    // documento en Firestore, creamos automáticamente la vinculación y fusionamos para evitar duplicados.
    if (uid && name && uid !== name && aliasedKey === uid && db) {
        try {
            const nameDocRef = doc(db, 'userStats', name);
            const nameSnap = await getDoc(nameDocRef);
            if (nameSnap && typeof nameSnap.exists === 'function' && nameSnap.exists()) {
                console.log(`[AUTO-LINK] Vinculando automáticamente TikTok ID @${uid} con nickname @${name}`);
                
                // 1. Crear el vínculo en systemConfig/userAliases
                await setDoc(doc(db, 'systemConfig', 'userAliases'), {
                    [uid]: name
                }, { merge: true });

                // 2. Crear el vínculo en la colección userAliases
                await setDoc(doc(db, 'userAliases', uid), {
                    aliasedTo: name,
                    updatedAt: serverTimestamp()
                });

                // Actualizar mapa en memoria
                if (USER_ALIASES_MAP) USER_ALIASES_MAP[uid] = name;
                
                // 3. Fusionar datos
                await mergeTwoUsers(uid, name);
                
                userKey = name;
            }
        } catch (e) {
            console.error(`[AUTO-LINK] Error en vinculación automática:`, e);
        }
    }

    try {
        if (db && typeof getDoc === 'function' && typeof doc === 'function') {
            let found = false;

            // 1. Intentar buscar por ID directo (aliasedKey o uid o name)
            const candidates = [];
            if (userKey) candidates.push(userKey);
            if (uid && uid !== userKey) candidates.push(uid);
            if (name && name !== uid && name !== userKey) candidates.push(name);
            
            // FALLBACK: Probar versión limpia de emojis si no se encuentra
            // Esto ayuda si la BD tiene "Juan" pero TikTok manda "Juan ⚡️"
            const cleanName = name.replace(/[^a-z0-9áéíóúñü ]/g, '').trim().replace(/\s+/g, ' ');
            if (cleanName && cleanName !== name && cleanName !== uid) {
                candidates.push(cleanName);
            }

            for (let i = 0; i < candidates.length; i++) {
                const id = candidates[i];
                try {
                    const snap = await getDoc(doc(db, 'userStats', id));
                    if (snap && typeof snap.exists === 'function' && snap.exists()) {
                        userKey = id;
                        const data = snap.data ? (snap.data() || {}) : {};
                        const dn = String(data.displayName || '').trim();
                        if (dn) bestDisplay = dn;
                        
                        // AUTO-LINK: Si encontramos por nombre pero no tiene tiktokId, lo guardamos
                        if (uid && id !== uid && !data.tiktokId) {
                            try {
                                await updateDoc(doc(db, 'userStats', id), { tiktokId: uid });
                                console.log(`🔗 Usuario vinculado: ${id} <-> TikTok: ${uid}`);
                            } catch (_) {}
                        }
                        found = true;
                        break;
                    }
                } catch (_) {}
            }

            // 2. Si no encontramos por ID, buscar por campo 'tiktokId' (fusión previa)
            if (!found && uid && typeof query === 'function' && typeof where === 'function' && typeof limit === 'function') {
                try {
                    const q = query(collection(db, 'userStats'), where('tiktokId', '==', uid), limit(1));
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        const snap = querySnapshot.docs[0];
                        userKey = snap.id;
                        const data = snap.data();
                        const dn = String(data.displayName || '').trim();
                        if (dn) bestDisplay = dn;
                        found = true;
                    }
                } catch (_) {}
            }
            
            // 3. Si sigue sin encontrar, buscar por 'aliases' (array) si existiera
             if (!found && uid && typeof query === 'function' && typeof where === 'function' && typeof limit === 'function') {
                try {
                    const q = query(collection(db, 'userStats'), where('aliases', 'array-contains', uid), limit(1));
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        const snap = querySnapshot.docs[0];
                        userKey = snap.id;
                        const data = snap.data();
                        const dn = String(data.displayName || '').trim();
                        if (dn) bestDisplay = dn;
                        found = true;
                    }
                } catch (_) {}
            }
        }
    } catch (_) {}

    const out = { userKey, displayName: bestDisplay, ts: now };
    if (uid) userKeyCache.set(uid, out);
    return out;
}

function getCiderUrl() {
    try {
        const u = String(config.ciderUrl || '').trim();
        return u || 'http://localhost:10767';
    } catch (_) {
        return 'http://localhost:10767';
    }
}

function getPortFromUrl(urlStr, fallback) {
    try {
        const u = new URL(String(urlStr || ''));
        const p = Number(u.port || '') || fallback;
        return Number.isFinite(p) ? p : fallback;
    } catch (_) {
        return fallback;
    }
}

function startMockCiderServer(port) {
    const p = Number(port) || 10767;
    if (mockCiderHttpServer || mockCiderIo) return { ok: true, port: mockCiderPort || p };
    if (!SocketIOServer) return { ok: false, error: 'Falta dependencia socket.io (ejecuta npm install).' };

    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Zero FM Mock Cider');
    });

    const ioSrv = new SocketIOServer(server, { cors: { origin: '*' } });
    ioSrv.on('connection', (socket) => {
        try {
            socket.emit('mock:status', {
                ok: true,
                queueLength: mockCiderQueue.length,
                nowPlaying: mockCiderNowPlaying
            });
        } catch (_) {}

        socket.on('safe_pre_add_queue', (payload) => {
            try {
                const name = String(payload?.name || '').trim();
                const artistName = String(payload?.artistName || '').trim();
                const appleMusicId = payload?.playParams?.id ? String(payload.playParams.id).trim() : '';
                const artworkUrl = payload?.artwork?.url ? String(payload.artwork.url).trim() : '';
                const requester = String(payload?.requester || '').trim();
                if (!name && !artistName && !appleMusicId) return;
                mockCiderQueue.push({ name, artistName, appleMusicId, artworkUrl, requester, enqueuedAt: Date.now() });
                while (mockCiderQueue.length > 100) mockCiderQueue.shift();
                ioSrv.emit('mock:queue', { queue: mockCiderQueue.slice(-50) });
            } catch (_) {}
        });

        socket.on('playback:queue:add-next', (payload) => {
            try {
                ioSrv.emit('mock:queue:add-next', payload || {});
            } catch (_) {}
        });
    });

    server.on('error', (err) => {
        console.error(`❌ Mock Cider no pudo iniciar en puerto ${p}:`, err && err.message ? err.message : String(err));
    });

    server.listen(p, () => {
        mockCiderHttpServer = server;
        mockCiderIo = ioSrv;
        mockCiderPort = p;
        console.log(`🧪 Mock Cider activo: http://localhost:${p}`);
    });

    return { ok: true, port: p };
}

function stopMockCiderServer() {
    try { if (mockCiderIo) { mockCiderIo.removeAllListeners(); mockCiderIo.close(); } } catch (_) {}
    try { if (mockCiderHttpServer) mockCiderHttpServer.close(); } catch (_) {}
    mockCiderIo = null;
    mockCiderHttpServer = null;
    mockCiderPort = 0;
    mockCiderQueue = [];
    mockCiderNowPlaying = null;
    return { ok: true };
}

function emitMockPlayback(evt = {}) {
    if (!mockCiderIo) return { ok: false, error: 'Mock Cider no está activo.' };
    const songName = String(evt.songName || evt.name || '').trim();
    const artistName = String(evt.artistName || evt.artist || '').trim();
    const requester = String(evt.requester || evt.user || '').trim();
    const appleMusicId = evt.appleMusicId ? String(evt.appleMusicId).trim() : '';
    const remainingMs = Number(evt.remainingMs || 0) || 0;
    const data = {
        name: songName,
        artistName,
        requester,
        timeRemaining: remainingMs > 0 ? Math.round(remainingMs / 1000) : undefined,
        remainingMs: remainingMs > 0 ? remainingMs : undefined
    };
    if (appleMusicId) data.playParams = { id: appleMusicId };
    mockCiderNowPlaying = { ...data, updatedAt: Date.now() };
    mockCiderIo.emit('API:Playback', { type: 'playbackStatus.nowPlayingItemDidChange', data });
    return { ok: true };
}

function pushSrEvent(evt) {
    try {
        recentSrEvents.push({ ...(evt || {}), ts: Date.now() });
        while (recentSrEvents.length > 100) recentSrEvents.shift();
    } catch (_) {}
}

function enqueueCider(item) {
    try {
        if (item && item.docId) {
            const exists = pendingCiderQueue.some(x => x.docId === item.docId);
            if (exists) return;
        }
        if (item && item.id) {
            const exists = pendingCiderQueue.some(x => x.id === item.id);
            if (exists) return;
        }
        pendingCiderQueue.push({ ...(item || {}), enqueuedAt: Date.now(), tries: (item && item.tries) ? item.tries : 0 });
        while (pendingCiderQueue.length > 50) pendingCiderQueue.shift();
    } catch (_) {}
}

async function flushCiderQueue() {
    if (ciderFlushInProgress) return;
    if (!ciderSocket || !ciderSocket.connected) return;
    ciderFlushInProgress = true;
    try {
        for (let i = 0; i < pendingCiderQueue.length; ) {
            const it = pendingCiderQueue[i];
            const tries = Number(it.tries || 0);
            if (tries >= 3) { pendingCiderQueue.splice(i, 1); continue; }

            let appleMusicId = it.appleMusicId ? String(it.appleMusicId).trim() : '';
            let songName = it.songName ? String(it.songName).trim() : '';
            let artistName = it.artistName ? String(it.artistName).trim() : '';
            let artworkUrl = it.artworkUrl ? String(it.artworkUrl).trim() : '';
            let trackViewUrl = it.trackViewUrl ? String(it.trackViewUrl).trim() : '';

            if (!appleMusicId && (songName || artistName)) {
                try {
                    const idLookup = await resolveTrackFromQuery(`${songName} ${artistName}`.trim());
                    if (idLookup && idLookup.appleMusicId) {
                        appleMusicId = idLookup.appleMusicId;
                        trackViewUrl = idLookup.trackViewUrl || '';
                        if (!artworkUrl) artworkUrl = idLookup.artworkUrl || '';
                        if (!songName) songName = idLookup.songName || songName;
                        if (!artistName) artistName = idLookup.artistName || artistName;
                    }
                } catch (_) {}
            }

            if (!appleMusicId) {
                it.tries = tries + 1;
                i += 1;
                continue;
            }

            try {
                ciderSocket.emit('safe_pre_add_queue', {
                    artwork: { url: artworkUrl },
                    name: songName,
                    artistName: artistName,
                    requester: it.user ? String(it.user) : '',
                    requesterId: it.userId ? String(it.userId) : '',
                    playParams: { id: String(appleMusicId) },
                    url: trackViewUrl,
                    next: true
                });
                ciderSocket.emit('playback:queue:add-next', { id: String(appleMusicId) });
                pushSrEvent({ source: it.source || 'ciderFlush', user: it.user, userId: it.userId, query: it.query, accepted: true, queueSaved: !!it.queueSaved, ciderSent: true, ciderQueued: false });
                
                // Actualizar Firestore con ciderSent = true si tenemos docId
                if (it.docId) {
                    updateDocFn(docFn(db, 'solicitudes', it.docId), { ciderSent: true }).catch(() => {});
                }
                
                pendingCiderQueue.splice(i, 1);
            } catch (e) {
                it.tries = tries + 1;
                pushSrEvent({ source: it.source || 'ciderFlush', user: it.user, userId: it.userId, query: it.query, accepted: true, queueSaved: !!it.queueSaved, ciderSent: false, ciderQueued: true, error: e && e.message ? e.message : String(e) });
                i += 1;
            }
        }
    } finally {
        ciderFlushInProgress = false;
    }
}

// --- FUNCION PRINCIPAL ---
function startBot() {
    // Cargar configuración de Firebase
    let firebaseConfig;
    try {
        if (fs.existsSync(PROFILE_FB_CONFIG_FILE)) {
            delete require.cache[require.resolve(PROFILE_FB_CONFIG_FILE)];
            firebaseConfig = require(PROFILE_FB_CONFIG_FILE);
        } else {
            // Fallback si no existe el archivo (usar credenciales por defecto)
            firebaseConfig = {
              apiKey: "AIzaSyA6c3EaIvuPEfM6sTV0YHqCBHuz35ZmNIU",
              authDomain: "zero-strom-web.firebaseapp.com",
              projectId: "zero-strom-web",
              storageBucket: "zero-strom-web.firebasestorage.app",
              messagingSenderId: "758369466349",
              appId: "1:758369466349:web:f2ced362a5a049c70b59e4"
            };
        }
    } catch (e) {
        console.error("Error cargando configuración de Firebase:", e);
    }

    // Inicializar Firebase
    let firebaseApp;
    try {
        const { getApps, getApp } = require('firebase/app');
        if (getApps().length === 0) {
            // Si no hay ninguna app, inicializarla
            firebaseApp = initializeApp(firebaseConfig);
        } else {
            // Si hay alguna, buscar si existe la default '[DEFAULT]'
            const existingDefault = getApps().find(app => app.name === '[DEFAULT]');
            if (existingDefault) {
                firebaseApp = existingDefault;
            } else {
                // Si hay apps pero no la default, inicializarla
                firebaseApp = initializeApp(firebaseConfig);
            }
        }
        // Usar la función importada al principio, no la global
        db = getFirestore(firebaseApp);
        rtdb = getDatabase(firebaseApp);
        try {
            const { getAuth, signInAnonymously } = require('firebase/auth');
            const auth = getAuth(firebaseApp);
            firebaseAuthPromise = signInAnonymously(auth).catch((e) => {
                console.warn('⚠️ No se pudo autenticar Firebase (anon):', e && e.message ? e.message : String(e));
            });
        } catch (_) {
            firebaseAuthPromise = Promise.resolve();
        }
    } catch (e) {
        // Fallback final: si todo falla, intentar recuperar la app existente por nombre
        if (e.code === 'app/duplicate-app') {
             console.log("⚠️ Detectada app duplicada en startBot, recuperando instancia existente...");
             try {
                 const { getApp } = require('firebase/app');
                 firebaseApp = getApp();
                 db = getFirestore(firebaseApp);
                 rtdb = getDatabase(firebaseApp);
                 try {
                     const { getAuth, signInAnonymously } = require('firebase/auth');
                     const auth = getAuth(firebaseApp);
                     firebaseAuthPromise = signInAnonymously(auth).catch(() => {});
                 } catch (_) { firebaseAuthPromise = Promise.resolve(); }
             } catch (err2) {
                 console.error("Error FATAL recuperando Firebase:", err2);
             }
        } else {
             console.error("Error inicializando Firebase en startBot:", e);
        }
    }
    
    // Cargar estado inicial del temporizador desde Firestore después de autenticarse
    if (firebaseAuthPromise) {
        firebaseAuthPromise.then(async () => {
            console.log("⏰ Firebase autenticado. Cargando temporizador de Firestore...");
            await loadTimerFromFirestore();
        }).catch((err) => {
            console.warn("⚠️ Error en auth al cargar temporizador:", err);
        });
    } else {
        setTimeout(loadTimerFromFirestore, 1500);
    }
    
    // --- SANEAMIENTO AUTOMÁTICO DE PUNTOS INFLADOS ---
    // Ejecutar una vez al inicio para corregir usuarios con puntos de likes astronómicos
    setTimeout(async () => {
        try {
            console.log("🧹 Ejecutando verificación de puntos inflados...");
            // Buscar usuarios con más de 5000 puntos de likes (1.5M likes), lo cual es sospechoso
            const snapshot = await getDocs(query(collection(db, 'userStats'), where('totalLikesPoints', '>', 5000)));
            
            if (!snapshot.empty) {
                console.log(`⚠️ Encontrados ${snapshot.size} usuarios con posibles puntos inflados. Corrigiendo...`);
                const batch = require('firebase/firestore').writeBatch(db);
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const inflatedLikesPoints = data.totalLikesPoints || 0;
                    const totalPoints = data.totalPoints || 0;
                    
                    // Asumimos que los puntos de likes están mal y los reseteamos
                    // Recalculamos el total restando la parte inflada
                    // Dejamos totalLikes en 0 para evitar que vuelva a calcular mal si el origen estaba corrupto
                    const newTotalPoints = Math.max(0, totalPoints - inflatedLikesPoints);
                    
                    console.log(`🔧 Corrigiendo @${doc.id}: LikesPoints ${inflatedLikesPoints} -> 0 | Total ${totalPoints} -> ${newTotalPoints}`);
                    
                    batch.update(doc.ref, {
                        totalLikesPoints: 0,
                        totalLikes: 0, // Resetear contador de likes para empezar limpio
                        totalPoints: newTotalPoints
                    });
                });
                
                await batch.commit();
                console.log("✅ Corrección masiva completada.");
            } else {
                console.log("✅ No se encontraron usuarios con puntos inflados.");
            }
            
            // --- FUSIÓN AUTOMÁTICA DE ALIASES EN EL INICIO ---
            try {
                console.log("🧹 Iniciando fusión automática de usuarios vinculados (aliases)...");
                const docSnap = await getDoc(doc(db, 'systemConfig', 'userAliases'));
                if (docSnap.exists()) {
                    const aliases = docSnap.data() || {};
                    const aliasPairs = Object.entries(aliases);
                    console.log(`🔍 Procesando ${aliasPairs.length} vinculaciones para buscar duplicados...`);
                    for (const [sourceKeyRaw, targetKeyRaw] of aliasPairs) {
                        const sourceKey = String(sourceKeyRaw).trim().toLowerCase();
                        const targetKey = String(targetKeyRaw).trim().toLowerCase();
                        if (sourceKey && targetKey && sourceKey !== targetKey) {
                            await mergeTwoUsers(sourceKey, targetKey);
                        }
                    }
                    console.log("✅ Fusión automática de vinculaciones completada.");
                }
            } catch (err) {
                console.error("❌ Error en autofusión de vinculaciones:", err);
            }
        } catch (e) {
            console.error("Error en saneamiento automático:", e);
        }
    }, 5000); // Esperar 5s a que la conexión se estabilice

    try { refreshBadgeSets(); } catch (_) {}
    try { setInterval(() => { refreshBadgeSets().catch(() => {}); }, 5 * 60 * 1000); } catch (_) {}

    // --- SERVIDOR WEB (DASHBOARD) ---
    const app = express();
    const PORT = Number(process.env.PORT || config.dashboardPort || 3000) || 3000;

    // CORS & No-Cache Middleware - Permite solicitudes locales y evita caché en desarrollo
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
        
        // Evitar caché de archivos estáticos y APIs en el panel
        res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.header('Pragma', 'no-cache');
        res.header('Expires', '0');

        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        next();
    });

    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));
    app.use('/gifts', express.static(path.join(__dirname, '..', 'REGALOS DE TIK TOK PNG By Adbra')));

    // Subida de video Quiéreme sin dependencias externas (solo módulos nativos de Node.js)
    app.post('/api/upload/quiereme', (req, res) => {
        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('multipart/form-data')) {
            return res.status(400).json({ error: 'Se requiere multipart/form-data' });
        }

        // Extraer el boundary del header
        const boundaryMatch = contentType.match(/boundary=(.+)$/);
        if (!boundaryMatch) {
            return res.status(400).json({ error: 'No se encontró el boundary del formulario.' });
        }
        const boundary = '--' + boundaryMatch[1];

        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            try {
                const body = Buffer.concat(chunks);
                const boundaryBuf = Buffer.from(boundary);

                // Encontrar el bloque del archivo en los datos multipart
                const headerEnd = Buffer.from('\r\n\r\n');
                let start = body.indexOf(boundaryBuf);
                let savedFile = null;
                let savedExt = '.mp4';

                while (start !== -1) {
                    const headerStart = start + boundaryBuf.length + 2; // skip \r\n
                    const headerFinish = body.indexOf(headerEnd, headerStart);
                    if (headerFinish === -1) break;

                    const headerStr = body.slice(headerStart, headerFinish).toString();
                    const dataStart = headerFinish + headerEnd.length;

                    const nextBoundary = body.indexOf(boundaryBuf, dataStart);
                    const dataEnd = nextBoundary === -1 ? body.length : nextBoundary - 2; // -2 para \r\n

                    // Solo procesar partes que sean archivos de video
                    if (headerStr.includes('filename=') && (headerStr.includes('video') || headerStr.includes('.mp4') || headerStr.includes('.mov'))) {
                        const filenameMatch = headerStr.match(/filename="([^"]+)"/);
                        if (filenameMatch) {
                            const originalName = filenameMatch[1];
                            savedExt = path.extname(originalName).toLowerCase() || '.mp4';
                            const destPath = path.join(__dirname, '..', 'QUIEREME' + savedExt);
                            const fileData = body.slice(dataStart, dataEnd);
                            fs.writeFileSync(destPath, fileData);
                            savedFile = 'QUIEREME' + savedExt;
                            console.log(`📤 Video Quiéreme subido con éxito: ${savedFile} (${fileData.length} bytes)`);
                        }
                    }

                    start = nextBoundary;
                }

                if (savedFile) {
                    res.json({ success: true, url: `/QUIEREME${savedExt}` });
                } else {
                    res.status(400).json({ error: 'No se encontró el archivo de video en la solicitud.' });
                }
            } catch (e) {
                console.error('Error procesando subida de video:', e);
                res.status(500).json({ error: 'Error interno al guardar el video.' });
            }
        });
        req.on('error', err => {
            console.error('Error en stream de subida:', err);
            res.status(500).json({ error: 'Error en la transferencia del archivo.' });
        });
    });


    const findQuieremeFile = () => {
        const parentDir = path.join(__dirname, '..');
        if (!fs.existsSync(parentDir)) return null;
        try {
            const files = fs.readdirSync(parentDir);
            const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
            
            // 1. Buscar coincidencia en archivos .mp4 (máxima compatibilidad universal)
            const mp4Match = files.find(f => normalize(f).includes("quiereme") && f.endsWith(".mp4"));
            if (mp4Match) return path.join(parentDir, mp4Match);
            
            // 2. Buscar coincidencia en archivos .mov (segunda opción)
            const movMatch = files.find(f => normalize(f).includes("quiereme") && f.endsWith(".mov"));
            if (movMatch) return path.join(parentDir, movMatch);
        } catch (e) {
            console.error("Error buscando archivo de Quiéreme:", e);
        }
        return null;
    };

    // Ruta universal para video Quiéreme (sin importar extensión)
    app.get('/quiereme-video', (req, res) => {
        const filePath = findQuieremeFile();
        console.log('[Quiéreme] Solicitud /quiereme-video, archivo encontrado:', filePath);
        if (filePath && fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = ext === '.mov' ? 'video/quicktime' : 'video/mp4';
            res.setHeader('Content-Type', mimeType);
            res.sendFile(filePath);
        } else {
            console.warn('[Quiéreme] Archivo no encontrado para /quiereme-video');
            res.sendStatus(404);
        }
    });

    app.get('/:filename', (req, res, next) => {
        const filename = req.params.filename;
        const ext = path.extname(filename).toLowerCase();
        if (ext === '.mov' || ext === '.mp4') {
            const parentDir = path.resolve(path.join(__dirname, '..'));
            const filePath = path.resolve(path.join(__dirname, '..', filename));
            // Seguridad: solo servir archivos que estén dentro del directorio padre
            if (!filePath.startsWith(parentDir + path.sep) && filePath !== parentDir) {
                return next();
            }
            if (fs.existsSync(filePath)) {
                const mimeType = ext === '.mov' ? 'video/quicktime' : 'video/mp4';
                res.setHeader('Content-Type', mimeType);
                return res.sendFile(filePath);
            }
            
            // Fallback: si el archivo exacto no existe, buscar el archivo quiereme por defecto
            const normalizedName = filename.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9.]+/g, '');
            if (normalizedName.replace(/\..+$/, '') === 'quiereme') {
                const fallbackPath = findQuieremeFile();
                if (fallbackPath && fs.existsSync(fallbackPath)) {
                    const fallbackExt = path.extname(fallbackPath).toLowerCase();
                    const mimeType = fallbackExt === '.mov' ? 'video/quicktime' : 'video/mp4';
                    res.setHeader('Content-Type', mimeType);
                    return res.sendFile(fallbackPath);
                }
            }
        }
        next();
    });

    // Endpoint dinámico para servir configuración de Firebase a los overlays
    app.get('/firebase-config.js', (req, res) => {
        const fbConfigFile = PROFILE_FB_CONFIG_FILE;
        res.setHeader('Content-Type', 'application/javascript');
        if (fs.existsSync(fbConfigFile)) {
            try {
                delete require.cache[require.resolve(fbConfigFile)];
                const fbConfig = require(fbConfigFile);
                res.send(`window.ZERO_FM_FIREBASE = ${JSON.stringify(fbConfig)};`);
            } catch (e) {
                res.status(500).send(`console.error("Error reading firebase-config.js:", ${JSON.stringify(e.message)});`);
            }
        } else {
            res.send(`window.ZERO_FM_FIREBASE = {
                apiKey: "AIzaSyA6c3EaIvuPEfM6sTV0YHqCBHuz35ZmNIU",
                authDomain: "zero-strom-web.firebaseapp.com",
                projectId: "zero-strom-web",
                storageBucket: "zero-strom-web.firebasestorage.app",
                messagingSenderId: "758369466349",
                appId: "1:758369466349:web:f2ced362a5a049c70b59e4"
            };`);
        }
    });

    app.get('/api/status', (req, res) => {
        const nets = os.networkInterfaces();
        const localIps = [];
        for (const iface of Object.values(nets)) {
            for (const net of iface) {
                if (net.family === 'IPv4' && !net.internal) {
                    localIps.push(net.address);
                }
            }
        }
        res.json({
            tiktokUsername: TIKTOK_USERNAME,
            tiktokState: (tiktokLiveConnection && tiktokLiveConnection.isConnected) ? 'connected' : 'disconnected',
            isConnecting: !!isConnecting,
            isRetrying: !!isRetrying,
            retrySecondsRemaining: isRetrying ? Math.max(0, Math.ceil((retryTimeoutEnd - Date.now()) / 1000)) : 0,
            lastConnectionError: lastConnectionError || '',
            ciderConnected: !!(ciderSocket && ciderSocket.connected),
            pendingCider: pendingCiderQueue.length,
            mockCiderActive: !!mockCiderIo,
            mockCiderPort: mockCiderPort || null,
            localIps: localIps,
            dashboardPort: PORT
        });
    });

    app.get('/api/debug-status', (req, res) => {
        res.json({
            dbStatusInitialized: !!dbStatus,
            activeProfile: activeProfile,
            configTiktokUsername: config.tiktokUsername,
            TIKTOK_USERNAME: TIKTOK_USERNAME,
            tiktokIsConnected: !!(tiktokLiveConnection && tiktokLiveConnection.isConnected),
            fbConfigLoaded: !!PROFILE_FB_CONFIG_FILE,
            fbConfigFileExists: require('fs').existsSync(PROFILE_FB_CONFIG_FILE)
        });
    });

    app.get('/api/myinstants/search', (req, res) => {
        const query = req.query.q || '';
        if (!query.trim()) {
            return res.json({ success: true, results: [] });
        }
        
        const https = require('https');
        const searchUrl = `https://www.myinstants.com/en/search/?name=${encodeURIComponent(query)}`;
        
        https.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }, (clientRes) => {
            let body = '';
            clientRes.on('data', (chunk) => { body += chunk; });
            clientRes.on('end', () => {
                const regex = /class="instant">[\s\S]*?onclick="play\('([^']*)'[\s\S]*?class="instant-link[^"]*">([^<]*)/g;
                let match;
                const results = [];
                while ((match = regex.exec(body)) !== null) {
                    results.push({
                        name: match[2].trim(),
                        audio: 'https://www.myinstants.com' + match[1]
                    });
                }
                res.json({ success: true, results });
            });
        }).on('error', (e) => {
            res.status(500).json({ success: false, error: e.message });
        });
    });

    app.get('/api/tts/logs', (req, res) => {
        res.json({ logs: ttsLogs });
    });

    app.post('/api/tiktok/session', async (req, res) => {
        try {
            const body = req.body || {};
            if (!body.sessionId) {
                return res.status(400).json({ ok: false, error: 'Falta sessionId' });
            }
            
            config.sessionId = body.sessionId;
            if (body.ttTargetIdc !== undefined) {
                config.ttTargetIdc = String(body.ttTargetIdc || '').trim();
            }
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
            console.log(`🔑 Session ID sincronizado automáticamente desde la extensión.`);
            
            // Si estaba conectado, reconectar para aplicar la nueva sesión
            if (retryTimeoutId) {
                clearTimeout(retryTimeoutId);
                retryTimeoutId = null;
            }
            isRetrying = false;

            if (tiktokLiveConnection && tiktokLiveConnection.isConnected) {
                console.log("🔄 Reiniciando conexión para usar la nueva sesión...");
                try { tiktokLiveConnection.disconnect(); } catch (_) {}
                isConnecting = false;
                tiktokConnectionOptions = buildTikTokConnectionOptions();
                tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USERNAME, tiktokConnectionOptions);
                setupListeners();
                connectToLive();
            }
            
            res.json({ ok: true, message: 'Session ID guardado con éxito' });
        } catch (err) {
            console.error('Error al sincronizar session ID:', err);
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    app.post('/api/tiktok/connect', async (req, res) => {
        try {
            manualDisconnect = false;
            
            const body = req.body || {};
            let configChanged = false;
            if (body.tiktokUsername && body.tiktokUsername !== config.tiktokUsername) {
                config.tiktokUsername = body.tiktokUsername;
                TIKTOK_USERNAME = body.tiktokUsername;
                configChanged = true;
            }
            if (body.sessionId !== undefined && body.sessionId !== config.sessionId) {
                config.sessionId = body.sessionId;
                configChanged = true;
            }
            if (configChanged) {
                fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
                console.log(`💾 Configuración de TikTok actualizada manualmente: Username = ${config.tiktokUsername}`);
            }
            
            if (retryTimeoutId) {
                clearTimeout(retryTimeoutId);
                retryTimeoutId = null;
            }
            isRetrying = false;

            if (tiktokLiveConnection) {
                try { tiktokLiveConnection.disconnect(); } catch (_) {}
            }
            
            isConnecting = false;
            tiktokConnectionOptions = buildTikTokConnectionOptions();
            tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USERNAME, tiktokConnectionOptions);
            setupListeners();
            
            connectToLive();
            
            res.json({ ok: true, message: 'Conectando...' });
        } catch (err) {
            console.error('Error al conectar manualmente:', err);
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    app.post('/api/tiktok/disconnect', (req, res) => {
        try {
            manualDisconnect = true;
            isConnecting = false;
            if (retryTimeoutId) {
                clearTimeout(retryTimeoutId);
                retryTimeoutId = null;
            }
            isRetrying = false;
            if (tiktokLiveConnection) {
                try { tiktokLiveConnection.disconnect(); } catch (_) {}
            }
            updateLiveStatus(false);
            res.json({ ok: true, message: 'Desconectado manualmente.' });
        } catch (err) {
            console.error('Error al desconectar manualmente:', err);
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    app.post('/api/server/shutdown', (req, res) => {
        try {
            res.json({ ok: true, message: 'Servidor apagándose...' });
            console.log('🔌 Apagando el servidor por solicitud del usuario...');
            setTimeout(() => {
                process.exit(0);
            }, 1000);
        } catch (err) {
            console.error('Error al apagar el servidor:', err);
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    app.post('/api/server/restart', (req, res) => {
        try {
            res.json({ ok: true, message: 'Servidor reiniciándose...' });
            console.log('🔄 Reiniciando el bot por solicitud del usuario...');
            setTimeout(() => {
                process.exit(0);
            }, 1000);
        } catch (err) {
            console.error('Error al reiniciar el servidor:', err);
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // Endpoint para ejecutar ACTUALIZAR.bat (actualización desde GitHub)
    app.post('/api/server/update', (req, res) => {
        try {
            const { spawn } = require('child_process');
            const batPath = path.join(__dirname, 'ACTUALIZAR.bat');
            const fs = require('fs');

            if (!fs.existsSync(batPath)) {
                return res.status(404).json({ ok: false, error: 'ACTUALIZAR.bat no encontrado en la carpeta del bot.' });
            }

            // Lanzar ACTUALIZAR.bat en modo silencioso para que no abra ventana
            const child = spawn('cmd.exe', ['/c', `"${batPath}" /silent`], {
                detached: true,
                stdio: 'ignore',
                windowsHide: true,
                shell: false
            });
            child.unref();

            console.log('📦 Ejecutando ACTUALIZAR.bat /silent — el bot se reiniciará cuando termine...');
            res.json({ ok: true, message: 'Actualización iniciada. El bot descargará la última versión y se reiniciará automáticamente.' });
        } catch (err) {
            console.error('Error al ejecutar ACTUALIZAR.bat:', err);
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    app.get('/api/events', (req, res) => {
        const limit = Math.max(1, Math.min(100, Number(req.query.limit || 30) || 30));
        const out = recentSrEvents.slice(-limit).reverse();
        res.json({ ok: true, events: out });
    });

    app.get('/api/mockcider/status', (req, res) => {
        res.json({
            ok: true,
            active: !!mockCiderIo,
            port: mockCiderPort || null,
            queueLength: mockCiderQueue.length,
            nowPlaying: mockCiderNowPlaying
        });
    });

    app.post('/api/mockcider/start', (req, res) => {
        const body = req.body || {};
        const port = Number(body.port || 0) || getPortFromUrl(getCiderUrl(), 10767);
        const r = startMockCiderServer(port);
        if (!r.ok) { res.status(400).json(r); return; }
        res.json(r);
    });

    app.post('/api/mockcider/stop', (req, res) => {
        res.json(stopMockCiderServer());
    });

    app.post('/api/mockcider/emit', (req, res) => {
        const body = req.body || {};
        const r = emitMockPlayback(body);
        if (!r.ok) { res.status(400).json(r); return; }
        res.json(r);
    });

    app.post('/api/mockcider/play-next', (req, res) => {
        if (!mockCiderIo) { res.status(400).json({ ok: false, error: 'Mock Cider no está activo.' }); return; }
        const next = mockCiderQueue.shift();
        if (!next) { res.json({ ok: false, error: 'Cola vacía.' }); return; }
        const r = emitMockPlayback({
            songName: next.name,
            artistName: next.artistName,
            requester: next.requester,
            appleMusicId: next.appleMusicId
        });
        res.json({ ok: true, played: next, emit: r });
    });

    app.post('/api/mockcider/clear', (req, res) => {
        mockCiderQueue = [];
        mockCiderNowPlaying = null;
        try { if (mockCiderIo) mockCiderIo.emit('mock:queue', { queue: [] }); } catch (_) {}
        res.json({ ok: true });
    });

    // API para obtener configuración
    app.get('/api/config', (req, res) => {
        res.json(config);
    });

    // API para guardar configuración
    app.post('/api/config', (req, res) => {
        try {
            const newConfig = req.body || {};
            const oldUser = config.tiktokUsername;
            const oldSession = config.sessionId;
            const next = { ...config, ...newConfig };
            if (!next.tiktokUsername) next.tiktokUsername = oldUser;
            config = next;

            fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
            console.log(`💾 Configuración actualizada: Modo Estricto (VIP) = ${config.requireVipForSr ? 'ACTIVADO 🔒' : 'DESACTIVADO 🔓'}`);

            if (oldUser !== config.tiktokUsername || oldSession !== config.sessionId) {
                console.log("🔄 Cambio de credenciales detectado. Reiniciando conexión...");
                TIKTOK_USERNAME = config.tiktokUsername;
                isConnecting = false;
                if (tiktokLiveConnection) {
                    tiktokLiveConnection.disconnect();
                }
                setTimeout(connectToLive, 1000);
            }
            res.json({ success: true, config });
        } catch (e) {
            console.error("Error guardando config:", e);
            res.status(500).json({ error: e.message });
        }
    });

    // API para obtener lista de perfiles y perfil activo
    app.get('/api/profiles', (req, res) => {
        try {
            const files = fs.readdirSync(PROFILES_DIR, { withFileTypes: true });
            const profileNames = files
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
            res.json({
                profiles: profileNames.length > 0 ? profileNames : ['zeroferreira'],
                activeProfile: activeProfile
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // API para cambiar de perfil
    app.post('/api/switch-profile', (req, res) => {
        try {
            const { profile } = req.body;
            if (!profile) return res.status(400).json({ error: "Debe especificar un perfil." });
            const cleanProfileName = profile.toLowerCase().replace(/[^a-z0-9_-]/g, '').trim();
            const targetDir = path.join(PROFILES_DIR, cleanProfileName);
            if (!fs.existsSync(targetDir)) {
                return res.status(404).json({ error: `El perfil ${cleanProfileName} no existe.` });
            }

            // Guardar perfil activo
            fs.writeFileSync(ACTIVE_PROFILE_FILE, JSON.stringify({ activeProfile: cleanProfileName }, null, 2));
            console.log(`🔄 Cambiando perfil activo a: ${cleanProfileName}...`);

            // Responder éxito y reiniciar bot en 1 segundo para aplicar cambios limpios
            res.json({ success: true, activeProfile: cleanProfileName });
            setTimeout(() => {
                console.log("👋 Apagando proceso para reinicio limpio con el nuevo perfil...");
                process.exit(0);
            }, 1000);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // API para crear un perfil nuevo
    app.post('/api/create-profile', (req, res) => {
        try {
            const { profile } = req.body;
            if (!profile) return res.status(400).json({ error: "Debe especificar un perfil nuevo." });
            const cleanProfileName = profile.toLowerCase().replace(/[^a-z0-9_-]/g, '').trim();
            if (!cleanProfileName) return res.status(400).json({ error: "Nombre de perfil inválido." });

            const targetDir = path.join(PROFILES_DIR, cleanProfileName);
            if (fs.existsSync(targetDir)) {
                return res.status(400).json({ error: "El perfil ya existe." });
            }

            // Crear directorio del perfil
            fs.mkdirSync(targetDir);

            // Copiar configuración por defecto
            const default_config = {
                allowSubscribers: true,
                allowModerators: true,
                allowSuperFans: true,
                minCoinsForVip: 30,
                vipDurationSession: true,
                tiktokUsername: cleanProfileName,
                sessionId: "",
                ttTargetIdc: "",
                dashboardPort: 3000,
                ciderUrl: "http://localhost:10767",
                mockCider: false,
                requireVipForSr: false,
                allowPointsCommand: true,
                likesPerPoint: 300,
                commandAliases: ["!zr", "!sr", "!pedir", "!cancion"],
                ignoreExampleQuery: "artista cancion"
            };

            const default_fb = {
                apiKey: "AIzaSyA6c3EaIvuPEfM6sTV0YHqCBHuz35ZmNIU",
                authDomain: "zero-strom-web.firebaseapp.com",
                projectId: "zero-strom-web",
                storageBucket: "zero-strom-web.firebasestorage.app",
                messagingSenderId: "758369466349",
                appId: "1:758369466349:web:f2ced362a5a049c70b59e4"
            };

            fs.writeFileSync(path.join(targetDir, 'config.json'), JSON.stringify(default_config, null, 2));
            fs.writeFileSync(path.join(targetDir, 'firebase-config.js'), `module.exports = ${JSON.stringify(default_fb, null, 2)};`);

            res.json({ success: true, profile: cleanProfileName });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // API para renombrar un perfil
    app.post('/api/rename-profile', (req, res) => {
        try {
            const { oldName, newName } = req.body;
            if (!oldName || !newName) {
                return res.status(400).json({ error: "Faltan parámetros oldName o newName." });
            }
            const cleanOld = oldName.toLowerCase().replace(/[^a-z0-9_-]/g, '').trim();
            const cleanNew = newName.toLowerCase().replace(/[^a-z0-9_-]/g, '').trim();
            if (!cleanOld || !cleanNew) {
                return res.status(400).json({ error: "Nombres de perfil inválidos." });
            }

            const oldDir = path.join(PROFILES_DIR, cleanOld);
            const newDir = path.join(PROFILES_DIR, cleanNew);

            if (!fs.existsSync(oldDir)) {
                return res.status(404).json({ error: `El perfil ${cleanOld} no existe.` });
            }
            if (fs.existsSync(newDir)) {
                return res.status(400).json({ error: `El perfil destino ${cleanNew} ya existe.` });
            }

            // Renombrar carpeta
            fs.renameSync(oldDir, newDir);

            // Si el perfil renombrado era el activo, actualizar active_profile.json
            if (activeProfile === cleanOld) {
                fs.writeFileSync(ACTIVE_PROFILE_FILE, JSON.stringify({ activeProfile: cleanNew }, null, 2));
            }

            res.json({ success: true, activeProfile: cleanNew });
            // Reiniciar bot en 1 segundo
            setTimeout(() => {
                console.log("👋 Reiniciando tras renombrar perfil...");
                process.exit(0);
            }, 1000);
        } catch (e) {
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
            const link = body.link ? String(body.link).trim() : '';

            const rawMessage = body.message ? String(body.message).trim() : '';
            let query = body.query ? String(body.query).trim() : '';
            if (rawMessage) {
                const aliases = getSrAliases();
                
                const parsed = parseSrCommand(rawMessage, aliases);
                query = parsed ? parsed.query : rawMessage;
            }
            // Si no hay query de texto pero hay un link, usar el link como query
            if (!query && link) {
                query = link;
            }
            query = query.replace(/\s+-\s+/g, ' ').trim();
            if (!query && !appleMusicId && !(songName && artistName)) {
                res.status(400).json({ ok: false, error: 'Falta query (búsqueda), link o artista+canción' });
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
                artworkUrl,
                link
            });

            res.json({ ok: true, result });
        } catch (e) {
            console.error('Error en /api/test/sr:', e);
            res.status(500).json({ ok: false, error: e.message || String(e) });
        }
    });

    app.post('/api/test/clear', async (req, res) => {
        try {
            const today = getLocalDateKey();
            const snap = await getDocsFn(query(
                collection(db, 'solicitudes'),
                where('day', '==', today)
            ));
            
            let deletedCount = 0;
            for (const doc of snap.docs) {
                const data = doc.data();
                const user = String(data.usuario || '').toLowerCase();
                if (data.isSimulation || data.isTest || data.isSimulation === true || user.includes('prueba')) {
                    await deleteDoc(docFn(db, 'solicitudes', doc.id));
                    deletedCount++;
                }
            }
            console.log(`🧹 Eliminadas ${deletedCount} solicitudes de prueba de la base de datos.`);
            res.json({ ok: true, deletedCount });
        } catch (e) {
            console.error('Error en /api/test/clear:', e);
            res.status(500).json({ ok: false, error: e.message || String(e) });
        }
    });

    // Endpoint para obtener configuración de overlays desde Firestore
    app.get('/api/overlays/config', async (req, res) => {
        try {
            const docSnap = await getDocFn(docFn(db, 'systemConfig', 'overlayAlertsConfig'));
            if (docSnap.exists()) {
                res.json(docSnap.data());
            } else {
                res.json({});
            }
        } catch (e) {
            console.error("Error obteniendo overlay config:", e);
            res.status(500).json({ error: e.message });
        }
    });

    // Endpoint para guardar configuración de overlays en Firestore
    app.post('/api/overlays/config', async (req, res) => {
        try {
            const newConfig = req.body || {};
            await setDoc(docFn(db, 'systemConfig', 'overlayAlertsConfig'), newConfig, { merge: true });

            // Si el toggle de la ruleta cambió, sincronizar también en system/status
            // para que el overlay de la ruleta lo detecte en tiempo real.
            if (typeof newConfig.rouletteOverlayEnabled === 'boolean') {
                await setDoc(docFn(db, 'system', 'status'), {
                    rouletteOverlayEnabled: newConfig.rouletteOverlayEnabled,
                    lastUpdate: serverTimestamp()
                }, { merge: true });

                const overlayToggleToken = `overlay_${newConfig.rouletteOverlayEnabled ? 'on' : 'off'}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                await setDoc(docFn(db, 'sessionData', 'rouletteLive'), {
                    type: 'overlay_toggle',
                    overlayEnabled: newConfig.rouletteOverlayEnabled,
                    overlayToggleToken,
                    updatedBy: 'dashboard-server',
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }

            res.json({ success: true });
        } catch (e) {
            console.error("Error guardando overlay config:", e);
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/client-log', (req, res) => {
        const { level, message, source } = req.body;
        console.log(`\x1b[33m[CLIENT-LOG][${source || 'unknown'}][${level || 'log'}]\x1b[0m`, message);
        try {
            const fs = require('fs');
            const path = require('path');
            const logLine = `[${new Date().toISOString()}][${source || 'unknown'}][${level || 'log'}] ${message}\n`;
            fs.appendFileSync(path.join(__dirname, 'client_logs.txt'), logLine, 'utf8');
        } catch (e) {
            console.error("Error writing client log to file:", e);
        }
        res.json({ success: true });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    //  GOAL OVERLAYS API
    // ═══════════════════════════════════════════════════════════════════════════

    // Obtener configuración de metas
    app.get('/api/goals/config', async (req, res) => {
        try {
            const snap = await getDocFn(docFn(db, 'systemConfig', 'goalOverlayConfig'));
            res.json(snap.exists() ? snap.data() : {});
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Guardar configuración de metas
    app.post('/api/goals/config', async (req, res) => {
        try {
            const cfg = req.body || {};
            await setDoc(docFn(db, 'systemConfig', 'goalOverlayConfig'), cfg, { merge: true });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Estado actual de metas (contadores de sesión)
    app.get('/api/goals/state', (req, res) => {
        const totalFollows = Array.from(sessionFollows.values()).reduce((a, b) => a + b, 0);
        const totalShares  = Array.from(sessionShares.values()).reduce((a, b) => a + b, 0);
        const totalLikes   = Array.from(sessionLikes.values()).reduce((a, b) => a + b, 0);
        res.json({
            sessionFollows: totalFollows,
            sessionShares:  totalShares,
            sessionLikes:   totalLikes,
            sessionCoins:   sessionTotalCoins
        });
    });

    // Simular meta para test
    app.post('/api/goals/test', async (req, res) => {
        const { type } = req.body || {};
        const validTypes = ['follow', 'share', 'like', 'coin'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: 'Tipo inválido. Usa: follow, share, like, coin' });
        }
        if (type === 'follow') sessionFollows.set('test_follow_' + Date.now(), 1);
        if (type === 'share')  sessionShares.set('test_share_' + Date.now(), 1);
        if (type === 'like') {
            sessionLikes.set('test_like_' + Date.now(), 100);
        }
        if (type === 'coin') sessionTotalCoins += 100;
        syncSessionCountersToFirestore();
        res.json({ success: true, type });
    });

    // Resetear contadores de metas
    app.post('/api/goals/reset', async (req, res) => {
        const type = (req.body && req.body.type) || (req.query && req.query.type) || 'all';

        if (type === 'likes' || type === 'all') {
            sessionLikes.clear();
            likesGoalStartOffset = streamTotalLikesCounter;
        }
        if (type === 'follows' || type === 'all') {
            sessionFollows.clear();
        }
        if (type === 'shares' || type === 'all') {
            sessionShares.clear();
        }
        if (type === 'coins' || type === 'all') {
            sessionTotalCoins = 0;
        }

        syncSessionCountersToFirestore();
        res.json({ success: true, type });
    });

    // Resetear ranking de likes
    app.post('/api/likes/reset', async (req, res) => {
        resetLikeTracking({ resetSession: true, resetTopLiker: true });
        likesGoalStartOffset = streamTotalLikesCounter;
        await recalculateLikerRanks();
        syncSessionCountersToFirestore(true);
        res.json({ success: true });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    //  TIMER API
    // ═══════════════════════════════════════════════════════════════════════════

    // Obtener estado del timer
    app.get('/api/timer/state', (req, res) => {
        const remainingMs = timerState.state === 'running' && timerState.endsAt
            ? Math.max(0, timerState.endsAt - Date.now())
            : timerState.state === 'paused'
                ? timerState.remainingOnPause
                : 0;
        res.json({ ...timerState, remainingMs });
    });

    // Configurar timer (label, color, secondsPerGift, opacity, radius, fontSize, etc.)
    app.post('/api/timer/config', async (req, res) => {
        try {
            const { label, primaryColor, secondsPerGift, timerOpacity, timerRadius, timerFontSize, secondsPerCoin, secondsPerFollow, secondsPerLike, secondsPerSubscribe, secondsPerShare, secondsPerChatMessage, multiplierEnabled, multiplierValue, actionOnExpiry, timerTheme, timerWidth, timerHeight, progressHeight, showProgressBar, showMeta, showLabel } = req.body || {};
            if (label)          timerState.label          = String(label).trim();
            if (primaryColor)   timerState.primaryColor   = String(primaryColor).trim();
            if (secondsPerGift !== undefined) timerState.secondsPerGift = Number(secondsPerGift) || 0;
            if (secondsPerCoin !== undefined) timerState.secondsPerCoin = Number(secondsPerCoin) || 0;
            if (secondsPerFollow !== undefined) timerState.secondsPerFollow = Number(secondsPerFollow) || 0;
            if (secondsPerLike !== undefined) timerState.secondsPerLike = Number(secondsPerLike) || 0;
            if (secondsPerSubscribe !== undefined) timerState.secondsPerSubscribe = Number(secondsPerSubscribe) || 0;
            if (secondsPerShare !== undefined) timerState.secondsPerShare = Number(secondsPerShare) || 0;
            if (secondsPerChatMessage !== undefined) timerState.secondsPerChatMessage = Number(secondsPerChatMessage) || 0;
            if (multiplierEnabled !== undefined) timerState.multiplierEnabled = Boolean(multiplierEnabled);
            if (multiplierValue !== undefined) timerState.multiplierValue = Number(multiplierValue) || 1.0;
            if (actionOnExpiry !== undefined) timerState.actionOnExpiry = String(actionOnExpiry).trim();
            if (timerOpacity !== undefined)  timerState.timerOpacity  = parseFloat(timerOpacity);
            if (timerRadius !== undefined)   timerState.timerRadius   = parseInt(timerRadius);
            if (timerFontSize !== undefined) timerState.timerFontSize = parseInt(timerFontSize);
            if (timerTheme !== undefined)    timerState.timerTheme    = String(timerTheme).trim();
            if (timerWidth !== undefined)    timerState.timerWidth    = parseInt(timerWidth) || 300;
            if (timerHeight !== undefined)   timerState.timerHeight   = parseInt(timerHeight) || 135;
            if (progressHeight !== undefined) timerState.progressHeight = parseInt(progressHeight) || 3;
            if (showProgressBar !== undefined) timerState.showProgressBar = Boolean(showProgressBar);
            if (showMeta !== undefined)      timerState.showMeta       = Boolean(showMeta);
            if (showLabel !== undefined)     timerState.showLabel      = Boolean(showLabel);
            await saveTimerToFirestore();
            res.json({ success: true, timerState });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Iniciar / reiniciar timer con duración en segundos
    app.post('/api/timer/start', async (req, res) => {
        try {
            const { durationSeconds } = req.body || {};
            const dur = Number(durationSeconds) || 1800; // Default: 30 minutos
            timerState.state   = 'running';
            timerState.endsAt  = Date.now() + dur * 1000;
            timerState.pausedAt         = null;
            timerState.remainingOnPause = 0;
            await saveTimerToFirestore();
            res.json({ success: true, timerState, endsAt: timerState.endsAt });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Pausar timer
    app.post('/api/timer/pause', async (req, res) => {
        try {
            if (timerState.state !== 'running') {
                return res.status(400).json({ error: 'El timer no está corriendo' });
            }
            timerState.remainingOnPause = Math.max(0, timerState.endsAt - Date.now());
            timerState.state   = 'paused';
            timerState.pausedAt = Date.now();
            timerState.endsAt  = null;
            await saveTimerToFirestore();
            res.json({ success: true, timerState });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Reanudar timer pausado
    app.post('/api/timer/resume', async (req, res) => {
        try {
            if (timerState.state !== 'paused') {
                return res.status(400).json({ error: 'El timer no está pausado' });
            }
            timerState.state  = 'running';
            timerState.endsAt = Date.now() + (timerState.remainingOnPause || 0);
            timerState.pausedAt         = null;
            timerState.remainingOnPause = 0;
            await saveTimerToFirestore();
            res.json({ success: true, timerState });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Detener timer
    app.post('/api/timer/stop', async (req, res) => {
        try {
            timerState.state            = 'stopped';
            timerState.endsAt           = null;
            timerState.pausedAt         = null;
            timerState.remainingOnPause = 0;
            await saveTimerToFirestore();
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Extender timer manualmente (segundos adicionales)
    app.post('/api/timer/extend', async (req, res) => {
        try {
            const { seconds } = req.body || {};
            const secs = Number(seconds) || 60;
            if (timerState.state === 'running' && timerState.endsAt) {
                timerState.endsAt += secs * 1000;
            } else if (timerState.state === 'paused') {
                timerState.remainingOnPause += secs * 1000;
            } else {
                return res.status(400).json({ error: 'El timer no está activo' });
            }
            await saveTimerToFirestore();
            res.json({ success: true, timerState });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Endpoint para simular regalos de prueba que SÍ extienden el timer
    app.post('/api/timer/test/gift', async (req, res) => {
        try {
            const { user = 'SimuladorGifter', giftName = 'TikTok Rose', coins = 1, seconds } = req.body || {};
            const randomId = Math.floor(Math.random() * 70) + 1;
            const avatarUrl = `https://i.pravatar.cc/100?img=${randomId}`;
            const finalCoins = Number(coins) || 1;

            // 1. Alert message template replacement
            const docSnap = await getDocFn(docFn(db, 'systemConfig', 'overlayAlertsConfig'));
            const overlayConfig = docSnap.exists() ? docSnap.data() : {};
            const giftsMsg = overlayConfig.giftsAlertMsg || "¡Gracias por {repeatCount}x {giftName}! 🎁";
            const customMsg = giftsMsg
                .replace(/{user}/g, user)
                .replace(/{giftname}/g, giftName)
                .replace(/{giftName}/g, giftName)
                .replace(/{repeatCount}/g, '1')
                .replace(/{repeatcount}/g, '1')
                .replace(/{coins}/g, finalCoins);

            // 2. Add gift notification to firestore (Alert overlay triggers)
            if (db) {
                await addDoc(collectionFn(db, 'notifications'), {
                    type: 'gift',
                    user: user,
                    uniqueId: user.toLowerCase(),
                    profilePic: avatarUrl,
                    giftName: giftName,
                    coins: finalCoins,
                    repeatCount: 1,
                    message: customMsg,
                    isTest: true,
                    timestamp: serverTimestampFn()
                });

                // Simular puntos por donación (1 punto por cada 10 monedas)
                const pointsFromGift = Math.floor(finalCoins / 10);
                if (pointsFromGift > 0) {
                    await addDoc(collectionFn(db, 'notifications'), {
                        type: 'points_gift',
                        user: user,
                        points: pointsFromGift,
                        message: `+${pointsFromGift} puntos por regalo`,
                        timestamp: serverTimestampFn()
                    });
                }
            }

            // 3. Extend countdown timer
            let extendedSec = 0;
            if (timerState.state === 'running' && timerState.endsAt) {
                extendedSec = Number(seconds) || Number(timerState.secondsPerGift) || 30;
                timerState.endsAt += extendedSec * 1000;
                await saveTimerToFirestore();
                console.log(`⏱️ [SIMULACIÓN] Timer extendido +${extendedSec}s por regalo de ${user}`);
            }

            res.json({ 
                success: true, 
                extended: extendedSec > 0, 
                extendedSeconds: extendedSec, 
                endsAt: timerState.endsAt 
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Endpoint para simular likes de prueba que SÍ extienden el timer
    app.post('/api/timer/test/like', async (req, res) => {
        try {
            const { user = 'SimuladorLiker', likes = 100, seconds } = req.body || {};
            const randomId = Math.floor(Math.random() * 70) + 1;
            const avatarUrl = `https://i.pravatar.cc/100?img=${randomId}`;
            const finalLikes = Number(likes) || 100;

            // 1. Alert message template replacement
            const docSnap = await getDocFn(docFn(db, 'systemConfig', 'overlayAlertsConfig'));
            const overlayConfig = docSnap.exists() ? docSnap.data() : {};
            const likesMsg = overlayConfig.likesAlertMsg || "¡Envió {likes} likes! ❤️";
            const customMsg = likesMsg
                .replace(/{user}/g, user)
                .replace(/{likes}/g, finalLikes.toLocaleString());

            // 2. Add like notification to firestore (Alert overlay triggers)
            if (db) {
                await addDoc(collectionFn(db, 'notifications'), {
                    type: 'like',
                    user: user,
                    uniqueId: user.toLowerCase(),
                    profilePic: avatarUrl,
                    likes: finalLikes,
                    message: customMsg,
                    isTest: true,
                    timestamp: serverTimestampFn()
                });
            }

            // 3. Extend countdown timer
            let extendedSec = 0;
            if (timerState.state === 'running' && timerState.endsAt) {
                // Si seconds se provee explícito, usarlo. Si no, usar la fórmula (likes * secondsPerLike)
                const secPerLike = Number(timerState.secondsPerLike) > 0 ? Number(timerState.secondsPerLike) : 0.05; // default fallback para prueba
                extendedSec = Number(seconds) || (finalLikes * secPerLike);

                if (extendedSec > 0) {
                    if (timerState.multiplierEnabled && Number(timerState.multiplierValue) > 0) {
                        extendedSec *= Number(timerState.multiplierValue);
                    }
                    timerState.endsAt += Math.round(extendedSec * 1000);
                    await saveTimerToFirestore();
                    console.log(`⏱️ [SIMULACIÓN] Timer extendido +${extendedSec.toFixed(2)}s por ${finalLikes} likes de ${user}`);
                }
            }

            res.json({ 
                success: true, 
                extended: extendedSec > 0, 
                extendedSeconds: extendedSec, 
                endsAt: timerState.endsAt 
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Obtener configuración de estilos del feed de últimos eventos
    app.get('/api/lastevents/config', async (req, res) => {
        try {
            const snap = await getDocFn(docFn(db, 'systemConfig', 'lastEventsConfig'));
            res.json(snap.exists() ? snap.data() : {
                cardOpacity: 0.55,
                borderRadius: 14,
                fontSize: 13,
                showFollows: true,
                showLikes: true,
                showGifts: true,
                showShares: true,
                showSubscribes: true
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Guardar configuración de estilos del feed de últimos eventos
    app.post('/api/lastevents/config', async (req, res) => {
        try {
            const cfg = req.body || {};
            await setDoc(docFn(db, 'systemConfig', 'lastEventsConfig'), cfg, { merge: true });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    //  LAST EVENTS API (feed de últimos N eventos del stream)
    // ═══════════════════════════════════════════════════════════════════════════
    // Los últimos eventos se almacenan como Firestore notifications, así que el
    // widget los lee directo desde ahí. Esta API devuelve el estado en memoria
    // del bot para el panel.
    app.get('/api/lastevents', (req, res) => {
        const n = Math.max(1, Math.min(50, Number(req.query.limit || 20) || 20));
        // Combinar eventos SR + cualquier evento reciente del buffer
        const out = recentSrEvents.slice(-n).reverse();
        res.json({ ok: true, events: out, count: out.length });
    });

    // Simular evento de share/follow/gift para tests
    app.post('/api/overlays/test/share', async (req, res) => {
        try {
            const randomId = Math.floor(Math.random() * 70) + 1;
            await addDoc(collectionFn(db, 'notifications'), {
                type: 'share',
                user: 'TestUser_Share',
                uniqueId: 'testuser_share',
                profilePic: `https://i.pravatar.cc/100?img=${randomId}`,
                message: '¡TestUser_Share compartió el live! 📤',
                timestamp: serverTimestampFn()
            });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Endpoint para simular alertas de prueba
    app.post('/api/overlays/test', async (req, res) => {
        try {
            const { type } = req.body || {};
            const randomId = Math.floor(Math.random() * 70) + 1;
            const avatarUrl = `https://i.pravatar.cc/100?img=${randomId}`;

            // Obtener configuración actual de overlays
            const docSnap = await getDocFn(docFn(db, 'systemConfig', 'overlayAlertsConfig'));
            const overlayConfig = docSnap.exists() ? docSnap.data() : {};

            const likesMsg = overlayConfig.likesAlertMsg || "¡Envió {likes} likes! ❤️";
            const giftsMsg = overlayConfig.giftsAlertMsg || "¡Gracias por {repeatCount}x {giftName}! 🎁";
            const followsMsg = overlayConfig.followsAlertMsg || "¡gracias por seguir el canal! 👤";
            const subsMsg = overlayConfig.subsAlertMsg || "¡gracias por suscribirte al canal! ⭐";

            if (type === 'topgifters') {
                const firstNames = ["Zero", "Donador", "Música", "TikTok", "Gifter", "Super", "Night", "Fan", "Sponsor", "VIP"];
                const lastNames = ["FM", "Lover", "Pro", "Star", "King", "Owl", "Vida", "Activo", "Zero", "Collector"];
                
                const count = Math.floor(Math.random() * 4) + 5; // 5 a 8 usuarios aleatorios
                const mockList = [];
                for (let i = 0; i < count; i++) {
                    const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
                    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
                    const username = (fn + "_" + ln + Math.floor(Math.random() * 90 + 10)).toLowerCase();
                    const nickname = fn + " " + ln + (Math.random() > 0.7 ? " 👑" : "");
                    const randomPicId = Math.floor(Math.random() * 70) + 1;
                    
                    mockList.push({
                        username: username,
                        nickname: nickname,
                        profilePictureUrl: `https://i.pravatar.cc/100?img=${randomPicId}`,
                        totalAmount: Math.floor(Math.random() * 18000) + 100
                    });
                }
                // Ordenar por monto descendente
                mockList.sort((a, b) => b.totalAmount - a.totalAmount);

                await setDoc(docFn(db, 'globalStats', 'topGifters'), {
                    list: mockList,
                    lastUpdate: serverTimestampFn()
                }, { merge: true });
                res.json({ success: true, message: 'Top Gifters simulated with random data!' });
                return;
            }

            if (type === 'toplikers') {
                const firstNames = ["Zero", "Lover", "Música", "TikTok", "Heart", "Super", "Pink", "Fan", "Lovely", "VIP"];
                const lastNames = ["FM", "Liker", "Pro", "Star", "Heart", "Cupid", "Vida", "Activo", "Zero", "Supporter"];
                
                const count = Math.floor(Math.random() * 4) + 6; // 6 a 9 usuarios aleatorios
                const mockList = [];
                for (let i = 0; i < count; i++) {
                    const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
                    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
                    const username = (fn + "_" + ln + Math.floor(Math.random() * 90 + 10)).toLowerCase();
                    const nickname = fn + " " + ln + (Math.random() > 0.7 ? " ❤️" : "");
                    const randomPicId = Math.floor(Math.random() * 70) + 1;
                    
                    mockList.push({
                        username: username,
                        nickname: nickname,
                        profilePictureUrl: `https://i.pravatar.cc/100?img=${randomPicId}`,
                        totalAmount: Math.floor(Math.random() * 8500) + 150
                    });
                }
                // Ordenar por monto descendente
                mockList.sort((a, b) => b.totalAmount - a.totalAmount);

                await setDoc(docFn(db, 'globalStats', 'topLikers'), {
                    list: mockList,
                    lastUpdate: serverTimestampFn()
                }, { merge: true });
                res.json({ success: true, message: 'Top Likers simulated with random data!' });
                return;
            }

            let mockData = {};
            if (type === 'follow') {
                mockData = {
                    type: 'follow',
                    user: 'ZeroFM_Lover',
                    uniqueId: 'zerofm_lover',
                    profilePic: avatarUrl,
                    message: followsMsg.replace(/{user}/g, 'ZeroFM_Lover'),
                    timestamp: serverTimestampFn()
                };
            } else if (type === 'like') {
                const likesCount = Math.floor(Math.random() * 1200) + 150;
                mockData = {
                    type: 'like',
                    user: 'SuperLiker',
                    uniqueId: 'superliker',
                    profilePic: avatarUrl,
                    likes: likesCount,
                    message: likesMsg.replace(/{user}/g, 'SuperLiker').replace(/{likes}/g, likesCount.toLocaleString()).replace(/{total}/g, (likesCount + 1250).toLocaleString()),
                    timestamp: serverTimestampFn()
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
                    message: giftsMsg.replace(/{user}/g, 'GifterRookie').replace(/{giftName}/g, 'TikTok Rose').replace(/{repeatCount}/g, '1').replace(/{coins}/g, '1').replace(/{total}/g, '10').replace(/{totalCoins}/g, '10'),
                    isTest: true,
                    timestamp: serverTimestampFn()
                };
            } else if (type === 'gift_quiereme') {
                mockData = {
                    type: 'gift',
                    user: 'GifterQuiere',
                    uniqueId: 'gifterquiere',
                    profilePic: avatarUrl,
                    giftName: 'Quiéreme',
                    coins: 1,
                    repeatCount: 1,
                    message: giftsMsg.replace(/{user}/g, 'GifterQuiere').replace(/{giftName}/g, 'Quiéreme').replace(/{repeatCount}/g, '1').replace(/{coins}/g, '1').replace(/{total}/g, '10').replace(/{totalCoins}/g, '10'),
                    isTest: true,
                    timestamp: serverTimestampFn()
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
                    message: giftsMsg.replace(/{user}/g, 'VIP_Sponsor').replace(/{giftName}/g, 'TikTok León').replace(/{repeatCount}/g, '1').replace(/{coins}/g, '2999').replace(/{total}/g, '5000').replace(/{totalCoins}/g, '5000'),
                    isTest: true,
                    timestamp: serverTimestampFn()
                };
            } else if (type === 'subscribe') {
                mockData = {
                    type: 'subscribe',
                    user: 'MusicCollector',
                    uniqueId: 'musiccollector',
                    profilePic: avatarUrl,
                    message: subsMsg.replace(/{user}/g, 'MusicCollector'),
                    timestamp: serverTimestampFn()
                };
            } else if (type === 'like_lock_blocked') {
                const targetLikes = Number(overlayConfig.likesTargetForYoutubeLink) || 999;
                const totalSessionLikes = Math.floor(Math.random() * (targetLikes - 50)) + 10;
                const missingLikes = targetLikes - totalSessionLikes;
                const rawMsg = overlayConfig.likesLockAlertMsg || "🔒 Enlaces bloqueados: Faltan {faltan} likes en el Live (llevamos {llevamos}/{meta}) ❤️";
                const formattedMsg = rawMsg
                    .replace(/{faltan}/g, missingLikes)
                    .replace(/{llevamos}/g, totalSessionLikes)
                    .replace(/{meta}/g, targetLikes);

                mockData = {
                    type: 'like',
                    user: 'Zero FM Bot',
                    uniqueId: 'zerofm_bot',
                    profilePic: '',
                    message: formattedMsg,
                    timestamp: serverTimestampFn()
                };
            } else if (type === 'chat') {
                const customMsg = req.body.customText || "¡Hola! Este es un mensaje de prueba leído por el lector de chat.";
                
                let audioData = null;
                const activeVoice = overlayConfig.chatTtsVoice;
                if (activeVoice && activeVoice.startsWith('tiktok:')) {
                    const voiceCode = activeVoice.replace('tiktok:', '');
                    try {
                        console.log(`🗣️ [TTS Test] Solicitando voz de TikTok (${voiceCode}) para prueba: "${customMsg}"`);
                        const ttsRes = await axios.post('https://tiktok-tts.weilnet.workers.dev/api/generation', {
                            text: customMsg.substring(0, 290),
                            voice: voiceCode
                        }, {
                            headers: { 'Content-Type': 'application/json' },
                            timeout: 7000
                        });

                        if (ttsRes.data && ttsRes.data.success && ttsRes.data.data) {
                            audioData = `data:audio/mp3;base64,${ttsRes.data.data}`;
                            console.log(`🗣️ [TTS Test] Voz de TikTok de prueba generada exitosamente`);
                        }
                    } catch (ttsErr) {
                        console.error(`🗣️ [TTS Test] Error generando voz de TikTok para prueba:`, ttsErr.message);
                    }
                }

                mockData = {
                    type: 'chat',
                    user: 'TesterChat',
                    uniqueId: 'testerchat',
                    message: customMsg,
                    voiceOverride: null,
                    audioData: audioData,
                    speedOverride: null,
                    pitchOverride: null,
                    timestamp: serverTimestampFn()
                };
            } else if (type === 'join' || type.startsWith('join_')) {
                const role = type.startsWith('join_') ? type.split('_')[1] : 'default';
                const roles = role !== 'default' ? [role] : [];
                
                const roleNames = {
                    streamer: 'Creador (Tú)',
                    moderator: 'Moderador Pro 🛡️',
                    subscriber: 'Suscriptor VIP ⚡',
                    vip: 'Usuario Estrella ⭐',
                    donador: 'Súper Donador 💎',
                    follower: 'Seguidor Leal ✨',
                    default: 'Seguidor Pro 🔥'
                };
                
                mockData = {
                    type: 'join',
                    user: roleNames[role] || 'Seguidor Pro 🔥',
                    uniqueId: role === 'default' ? 'seguidorpro' : `test_${role}`,
                    profilePic: `https://i.pravatar.cc/100?img=${Math.floor(Math.random() * 70) + 1}`,
                    message: '¡Acaba de entrar al Live! 👋',
                    roles: roles,
                    timestamp: serverTimestampFn()
                };
            } else {
                res.status(400).json({ error: 'Tipo de alerta desconocido' });
                return;
            }

            await addDocFn(collectionFn(db, 'notifications'), mockData);
            res.json({ success: true, message: `Alerta ${type} enviada!` });
        } catch (e) {
            console.error("Error enviando alerta de prueba:", e);
            res.status(500).json({ error: e.message });
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

            // Obtener IPs locales de red (para acceder desde la Mac u otros dispositivos)
            const nets = os.networkInterfaces();
            const localIPs = [];
            for (const iface of Object.values(nets)) {
                for (const net of iface) {
                    // Solo IPv4, no loopback
                    if (net.family === 'IPv4' && !net.internal) {
                        localIPs.push(net.address);
                    }
                }
            }

            console.log(`\n${'═'.repeat(54)}`);
            console.log(`🎛️  DASHBOARD LISTO`);
            console.log(`${'─'.repeat(54)}`);
            console.log(`📍 En esta PC:     http://localhost:${port}`);
            if (localIPs.length > 0) {
                localIPs.forEach(ip => {
                    console.log(`🌐 Desde tu Mac:   http://${ip}:${port}`);
                });
            }
            console.log(`${'═'.repeat(54)}\n`);
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

    if (config.mockCider === true) {
        const mockPort = getPortFromUrl(getCiderUrl(), 10767);
        const r = startMockCiderServer(mockPort);
        if (!r.ok) {
            console.warn('⚠️ No se pudo iniciar Mock Cider:', r.error || 'desconocido');
        }
    }

    // Conexión a Cider (Reproductor)
    ciderSocket = io(getCiderUrl(), {
      transports: ['websocket'],
      reconnectionDelay: 2000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0
    });

    ciderSocket.on("connect", () => {
      console.log("✅ Conectado a Cider (Reproductor)");
      try { flushCiderQueue(); } catch (_) {}
    });

    ciderSocket.on("disconnect", () => {
      console.log("❌ Desconectado de Cider");
    });

    ciderSocket.on("API:Playback", (event) => {
      try {
        const { data, type } = event || {};
        if (type === "playbackStatus.nowPlayingItemDidChange" || type === "playbackStatus.nowPlayingItemDidChangeV2") {
            const name = data?.name || data?.title || 'Sin título';
            const artist = data?.artistName || data?.artist || 'Desconocido';
            console.log(`🎵 [Cider Link] Cambió la canción actual a: "${name}" - "${artist}"`);
        }
      } catch (_) {}
    });

    // Inicializar conexión TikTok
    console.log(`🔌 Configurando conexión para @${TIKTOK_USERNAME}...`);
    
    if (config.sessionId) {
        console.log("🔑 Usando Session ID configurado.");
    } else {
        console.log("⚠️ No se ha configurado Session ID. Si falla la conexión (error 521), agrégalo en config.json");
    }

    tiktokConnectionOptions = buildTikTokConnectionOptions();
    tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USERNAME, tiktokConnectionOptions);

    setupListeners();
    
    // Iniciar búsqueda
    connectToLive();
    
    // --- LISTENER DE NOTIFICACIONES PARA LA RULETA Y OTROS ---
    setupNotificationListener();

    // Sincronizar datos iniciales (Insignias y Alias)
    try {
        refreshBadgeSets().catch(e => console.warn('⚠️ Error en sincronización inicial:', e.message));
    } catch (_) {}
}

function setupNotificationListener() {
    if (!db) return;
    
    console.log("👂 Iniciando listener de notificaciones de Firebase...");

    // Escuchar la configuración dinámica de los overlays
    try {
        const { doc } = require('firebase/firestore');
        onSnapshot(doc(db, 'systemConfig', 'overlayAlertsConfig'), (docSnap) => {
            if (docSnap.exists()) {
                console.log("📺 Configuración dinámica de overlays actualizada desde Firebase.");
                overlayAlertsConfig = { ...overlayAlertsConfig, ...docSnap.data() };
            }
        }, (err) => {
            console.warn("⚠️ No se pudo cargar la configuración de overlays desde Firebase:", err.message);
        });
    } catch(e) {
        console.warn("⚠️ Error configurando listener de overlays:", e.message);
    }

    const recentThreshold = new Date(Date.now() - 5 * 60 * 1000);
    const recentNotificationsQuery = query(
        collection(db, 'notifications'),
        where('timestamp', '>', recentThreshold),
        limit(100)
    );

    onSnapshot(recentNotificationsQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                
                // Ignorar si es muy antigua (más de 30 segundos)
                const ts = data.timestamp ? data.timestamp.toDate() : new Date();
                const ageMs = Date.now() - ts.getTime();
                if (ageMs > 30000) return;

                console.log(`🔔 Notificación recibida: [${data.type}] ${data.message || ''}`);
                
                if (data.type === 'roulette_winner') {
                    console.log(`🏆 ¡Ganador de la ruleta detectado!: ${data.user}`);
                    // Aquí el bot podría enviar un mensaje al chat si tuviera esa capacidad.
                    // Por ahora, lo registramos y podríamos emitirlo por socket.io si hay un dashboard.
                    if (mockCiderIo) {
                        mockCiderIo.emit('roulette_winner', data);
                    }
                }
            }
        });
    }, (error) => {
        console.error("❌ Error en listener de notificaciones:", error);
    });

    // --- LISTENER DE SOLICITUDES EN FIRESTORE ---
    // Escucha nuevas peticiones para resolver metadatos y enviarlas a la cola de Cider
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        // Set para evitar procesar el mismo pedido dos veces en la misma sesión
        // (protección contra duplicados en Firestore por múltiples instancias del bot)
        const processedSolicitudIds = new Set();

        const solicitudesQuery = query(
            collection(db, 'solicitudes'),
            where('ts', '>=', startOfToday)
        );

        onSnapshot(solicitudesQuery, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === "added") {
                    const docId = change.doc.id;
                    const data = change.doc.data();
                    
                    const isPending = data.status === 'pending';
                    const alreadySent = data.ciderSent === true;

                    // Si ya procesamos un pedido con este mismo id en esta sesión, ignorar
                    const solicitudId = data.id || docId;
                    if (processedSolicitudIds.has(solicitudId)) {
                        console.log(`🔁 [Firestore Listener] Pedido duplicado ignorado (id="${solicitudId}", docId="${docId}")`);
                        return;
                    }

                    if (isPending && !alreadySent) {
                        processedSolicitudIds.add(solicitudId);
                        let appleMusicId = data.appleMusicId ? String(data.appleMusicId).trim() : '';
                        let songName = data.cancion ? String(data.cancion).trim() : '';
                        let artistName = data.artista ? String(data.artista).trim() : '';
                        let artworkUrl = data.cover ? String(data.cover).trim() : '';
                        let trackViewUrl = data.link ? String(data.link).trim() : '';

                        console.log(`📥 [Firestore Link] Nueva solicitud detectada: "${songName}" - "${artistName}" (ID Doc: ${docId})`);

                        // 1. Si no tiene ID de Apple Music, lo buscamos en iTunes
                        if (!appleMusicId) {
                            try {
                                const resolved = await resolveTrackFromQuery(`${songName} ${artistName}`.trim());
                                if (resolved && resolved.appleMusicId) {
                                    appleMusicId = resolved.appleMusicId;
                                    songName = resolved.songName || songName;
                                    artistName = resolved.artistName || artistName;
                                    artworkUrl = resolved.artworkUrl || artworkUrl;
                                    trackViewUrl = resolved.trackViewUrl || trackViewUrl;

                                    // Actualizar el documento en Firestore
                                    await updateDocFn(docFn(db, 'solicitudes', docId), {
                                        appleMusicId: appleMusicId,
                                        cover: artworkUrl,
                                        cancion: songName,
                                        artista: artistName
                                    });
                                    console.log(`✅ Metadatos e ID de Apple Music resueltos para "${songName}"`);
                                }
                            } catch (err) {
                                console.error(`❌ Error buscando en iTunes para "${songName}":`, err.message);
                            }
                        }

                        // 2. Si tenemos ID y Cider está conectado, enviar a la cola
                        if (appleMusicId) {
                            if (ciderSocket && ciderSocket.connected) {
                                try {
                                    ciderSocket.emit('safe_pre_add_queue', {
                                        artwork: { url: artworkUrl },
                                        name: songName,
                                        artistName: artistName,
                                        requester: data.displayName || data.usuario || 'Web Request',
                                        requesterId: data.userId || '',
                                        playParams: { id: String(appleMusicId) },
                                        url: trackViewUrl,
                                        next: true
                                    });
                                    ciderSocket.emit('playback:queue:add-next', { id: String(appleMusicId) });
                                    
                                    // Marcar como enviado en Firestore
                                    await updateDocFn(docFn(db, 'solicitudes', docId), {
                                        ciderSent: true
                                    });
                                    console.log(`🎧 Canción "${songName}" agregada exitosamente a la cola de Cider.`);
                                } catch (err) {
                                    console.error("❌ Error enviando canción a Cider:", err.message);
                                }
                            } else {
                                // Si Cider no está conectado, encolar localmente para reintento
                                enqueueCider({
                                    source: data.source || 'firestoreListener',
                                    user: data.usuario,
                                    userId: data.userId,
                                    query: `${songName} ${artistName}`,
                                    songName,
                                    artistName,
                                    artworkUrl,
                                    appleMusicId,
                                    trackViewUrl,
                                    queueSaved: true,
                                    docId: docId
                                });
                                console.warn(`⚠️ Cider desconectado. Encolando "${songName}" localmente.`);
                            }
                        }
                    }
                }
            });
        }, (err) => {
            console.warn("⚠️ Error en listener de solicitudes en tiempo real:", err.message);
        });
    } catch(e) {
        console.warn("⚠️ Error configurando listener de solicitudes:", e.message);
    }
}

startBot();

// Cache para evitar escrituras redundantes de foto de perfil en la misma sesión
const profilePicCache = new Set();
const userMetadataCache = new Map(); // userId -> { memberLevel, gifterLevel, isSubscriber, displayName, profilePic }

function extractUserLevels(data) {
    let memberLevel = Number(data.teamMemberLevel || data.memberLevel || (data.user && (data.user.teamMemberLevel || data.user.memberLevel)) || 0);
    let gifterLevel = Number(data.gifterLevel || (data.user && data.user.payGrade) || 0);
    
    const badgeSources = [];
    if (Array.isArray(data.badges)) badgeSources.push(...data.badges);
    if (data.user && Array.isArray(data.user.badges)) badgeSources.push(...data.user.badges);
    
    for (const badge of badgeSources) {
        if (!badge) continue;
        
        const badgeNameStr = (badge.name || badge.label || badge.title || badge.badgeName || '').toLowerCase();
        
        // 1. Club de Fans o Suscriptor (badgeSceneType 10, type 'member'/'subscriber', o nombre con 'fans'/'team'/'member'/'subscriber'/'suscriptor')
        if (badge.badgeSceneType === 10 || 
            badge.type === 'member' || 
            badge.type === 'subscriber' ||
            badgeNameStr.includes('team') || 
            badgeNameStr.includes('fan') || 
            badgeNameStr.includes('member') ||
            badgeNameStr.includes('subscriber') ||
            badgeNameStr.includes('suscriptor') ||
            (badge.displayType && badge.displayType === 10)
        ) {
            if (badge.level > 0 && badge.level > memberLevel) {
                memberLevel = Number(badge.level);
            }
        }
        
        // 2. Gifter Level (badgeSceneType 8 o nombre con 'gifter')
        if (badge.badgeSceneType === 8 || 
            badge.type === 'gifter' || 
            badgeNameStr.includes('gift') ||
            badgeNameStr.includes('gifter')
        ) {
            if (badge.level > 0 && badge.level > gifterLevel) {
                gifterLevel = Number(badge.level);
            }
        }
    }
    
    return { memberLevel, gifterLevel };
}

async function updateUserProfilePic(userId, displayName, url, extraFields = {}) {
    if (!db) return;
    
    const fields = { ...extraFields };
    // Si es suscriptor, asegurar que su memberLevel sea al menos 1, pero sin sobreescribir con 1 si no viene en extraFields
    if (fields.isSubscriber === true) {
        if (fields.memberLevel !== undefined) {
            fields.memberLevel = Math.max(fields.memberLevel, 1);
        }
    }
    
    const cached = userMetadataCache.get(userId);
    const hasMlChanged = fields.memberLevel !== undefined && (!cached || cached.memberLevel !== fields.memberLevel);
    const hasGlChanged = fields.gifterLevel !== undefined && (!cached || cached.gifterLevel !== fields.gifterLevel);
    const hasSubChanged = fields.isSubscriber !== undefined && (!cached || cached.isSubscriber !== fields.isSubscriber);
    const hasNameChanged = !cached || cached.displayName !== displayName;
    const hasPicChanged = url && (!cached || cached.profilePic !== url);
    
    // Si nada relevante ha cambiado y el usuario ya está cacheado, evitar escritura
    if (cached && !hasMlChanged && !hasGlChanged && !hasSubChanged && !hasNameChanged && !hasPicChanged) {
        return;
    }
    
    try {
        const { doc, setDoc, serverTimestamp } = require('firebase/firestore');
        const resolved = await getCanonicalUserKey(userId, displayName);
        const key = resolved.userKey || userId;
        
        const userRef = doc(db, 'userStats', key);
        const updateData = {
            lastSeen: serverTimestamp(),
            displayName: displayName,
            ...fields
        };
        
        if (url) {
            updateData.profilePic = url;
            profilePicCache.add(userId);
        }
        
        await setDoc(userRef, updateData, { merge: true });
        
        // Actualizar cache local
        userMetadataCache.set(userId, {
            memberLevel: fields.memberLevel ?? cached?.memberLevel ?? 0,
            gifterLevel: fields.gifterLevel ?? cached?.gifterLevel ?? 0,
            isSubscriber: fields.isSubscriber ?? cached?.isSubscriber ?? false,
            displayName: displayName,
            profilePic: url || cached?.profilePic || ''
        });
        
        console.log(`👤 Metadatos y nivel de miembro actualizados en DB para @${userId} (memberLevel: ${fields.memberLevel || 0})`);
    } catch (e) {
        console.error(`Error actualizando metadatos de ${displayName}:`, e);
    }
}

async function mergeTwoUsers(sourceKey, targetKey) {
    if (!db) return;
    try {
        const srcRef = doc(db, 'userStats', sourceKey);
        const tgtRef = doc(db, 'userStats', targetKey);
        
        const srcSnap = await getDoc(srcRef);
        if (!srcSnap.exists()) return;
        
        const srcData = srcSnap.data() || {};
        const tgtSnap = await getDoc(tgtRef);
        
        const srcLikes = Number(srcData.totalLikes || 0);
        const srcLikesPts = Number(srcData.totalLikesPoints || 0);
        const srcCoins = Number(srcData.totalCoinsDonated || 0);
        const srcGiftPts = Number(srcData.totalGiftPoints || 0);
        const srcPoints = Number(srcData.totalPoints || 0);
        const srcQuiereCount = Number(srcData.quiereCount || 0);
        const srcQuiereCoins = Number(srcData.totalQuiereCoins || 0);
        const srcSessionLikes = Number(srcData.sessionLikes || 0);
        
        if (tgtSnap.exists()) {
            const tgtData = tgtSnap.data() || {};
            
            // Combinar todos los campos del destino con el origen
            const updateData = {
                ...tgtData,
                tiktokId: srcData.tiktokId || tgtData.tiktokId || sourceKey,
                displayName: tgtData.displayName || srcData.displayName || targetKey,
                lastSeen: serverTimestamp()
            };
            
            if (srcData.profilePic && (!tgtData.profilePic || tgtData.profilePic.includes('broken') || tgtData.profilePic.includes('avatar'))) {
                updateData.profilePic = srcData.profilePic;
            }
            
            if (srcData.isSubscriber === true || tgtData.isSubscriber === true) {
                updateData.isSubscriber = true;
            }
            
            updateData.memberLevel = Math.max(Number(srcData.memberLevel || 0), Number(tgtData.memberLevel || 0));
            updateData.gifterLevel = Math.max(Number(srcData.gifterLevel || 0), Number(tgtData.gifterLevel || 0));
            
            // Fusión aditiva: Sumar los valores acumulados en lugar de tomar el máximo,
            // respetando los valores manuales en la cuenta destino y agregando los nuevos automáticos.
            updateData.quiereCount = Number(tgtData.quiereCount || 0) + srcQuiereCount;
            updateData.totalQuiereCoins = Number(tgtData.totalQuiereCoins || 0) + srcQuiereCoins;
            updateData.totalCoinsDonated = Number(tgtData.totalCoinsDonated || 0) + srcCoins;
            updateData.totalGiftPoints = Number(tgtData.totalGiftPoints || 0) + srcGiftPts;
            updateData.totalLikes = Number(tgtData.totalLikes || 0) + srcLikes;
            updateData.totalLikesPoints = Number(tgtData.totalLikesPoints || 0) + srcLikesPts;
            updateData.totalPoints = Number(tgtData.totalPoints || 0) + srcPoints;
            updateData.sessionLikes = Number(tgtData.sessionLikes || 0) + srcSessionLikes;
            
            // Fusionar objeto gamification
            if (srcData.gamification || tgtData.gamification) {
                const srcG = srcData.gamification || {};
                const tgtG = tgtData.gamification || {};
                const srcGStats = srcG.stats || {};
                const tgtGStats = tgtG.stats || {};
                
                updateData.gamification = {
                    ...tgtG,
                    points: Number(tgtG.points || 0) + Number(srcG.points || 0),
                    xp: Number(tgtG.xp || 0) + Number(srcG.xp || 0),
                    level: Math.max(Number(tgtG.level || 1), Number(srcG.level || 1)),
                    stats: {
                        ...tgtGStats,
                        totalSongs: Number(tgtGStats.totalSongs || 0) + Number(srcGStats.totalSongs || 0),
                        totalPlayedSongs: Number(tgtGStats.totalPlayedSongs || 0) + Number(srcGStats.totalPlayedSongs || 0),
                        uniqueArtists: Math.max(Number(tgtGStats.uniqueArtists || 0), Number(srcGStats.uniqueArtists || 0)),
                        activeDays: Math.max(Number(tgtGStats.activeDays || 0), Number(srcGStats.activeDays || 0))
                    }
                };
            }
            
            console.log(`[AUTO-MERGE] Fusionando estadísticas: @${sourceKey} -> @${targetKey} (Puntos: +${srcPoints}, Quiéreme: +${srcQuiereCount})`);
            await setDoc(tgtRef, updateData, { merge: true });
        } else {
            // Si el destino no existe, renombramos/movemos
            const updateData = {
                ...srcData,
                tiktokId: srcData.tiktokId || sourceKey,
                displayName: srcData.displayName || targetKey,
                lastSeen: serverTimestamp()
            };
            console.log(`[AUTO-MERGE] Creando y migrando a destino: @${sourceKey} -> @${targetKey}`);
            await setDoc(tgtRef, updateData);
        }
        
        await deleteDoc(srcRef);
        console.log(`[AUTO-MERGE] Documento temporal @${sourceKey} eliminado.`);
    } catch (e) {
        console.error(`[AUTO-MERGE] Error fusionando @${sourceKey} -> @${targetKey}:`, e);
    }
}

// Configurar Listeners
function setupListeners() {
    tiktokLiveConnection.removeAllListeners();

    async function handleSubscription(data) {
        if (overlayAlertsConfig.enableSubscribeAlert === false) return;

        const displayName = data.nickname;
        const uid = data.uniqueId;
        const profilePic = data.profilePictureUrl;
        
        // Marcar presencia activa en el live
        markUserPresent(uid);
        
        const { memberLevel: parsedMemberLevel, gifterLevel: parsedGifterLevel } = extractUserLevels(data);
        const subLevel = parsedMemberLevel || Number(data.subMonth || 0);
        console.log(`⭐ @${uid} se suscribió! (nivel: ${subLevel || '—'})`);

        // ── Guardar membresía en userStats ──────────────────────────────────────
        if (db) {
            try {
                const { doc, setDoc, serverTimestamp: sts } = require('firebase/firestore');
                const resolved = await getCanonicalUserKey(uid, displayName);
                const userRef = doc(db, 'userStats', resolved.userKey || uid);
                const cached = userMetadataCache.get(resolved.userKey || uid);
                const currentMemberLvl = cached?.memberLevel || 0;
                const memberData = {
                    isSubscriber: true,
                    lastSeen: sts(),
                    displayName,
                    memberLevel: Math.max(subLevel || 0, currentMemberLvl, 1)
                };
                if (parsedGifterLevel > 0) memberData.gifterLevel = parsedGifterLevel;
                if (profilePic) memberData.profilePic = profilePic;
                await setDoc(userRef, memberData, { merge: true });

                console.log(`💾 Membresía guardada para @${uid} (memberLevel: ${memberData.memberLevel})`);
            } catch (e) {
                console.error('Error guardando membresía en userStats:', e);
            }
        }

        // ─── TIMER EXTENSION: suscripción ───
        if (timerState.state === 'running' && timerState.endsAt && Number(timerState.secondsPerSubscribe) > 0) {
            let secondsToAdd = Number(timerState.secondsPerSubscribe);
            if (timerState.multiplierEnabled && Number(timerState.multiplierValue) > 0) {
                secondsToAdd *= Number(timerState.multiplierValue);
            }
            const msToAdd = Math.round(secondsToAdd * 1000);
            timerState.endsAt += msToAdd;
            console.log(`⏱️ Timer extendido +${secondsToAdd.toFixed(2)}s por suscripción de @${uid}`);
            saveTimerToFirestore().catch(() => {});
        }

        if (db) {
            try {
                let msgTemplate = String(overlayAlertsConfig.subsAlertMsg || "¡gracias por suscribirte al canal! ⭐");
                let customMsg = msgTemplate.replace(/{user}/g, displayName);

                await addDoc(collection(db, 'notifications'), {
                    type: 'subscribe',
                    user: displayName,
                    uniqueId: uid,
                    profilePic: profilePic || '',
                    message: customMsg,
                    memberLevel: subLevel || null,
                    timestamp: serverTimestamp()
                });
            } catch (e) {
                console.error('Error guardando notificación de sub en Firestore:', e);
            }
        }
    }
    
    // Debug: Log de conexión exitosa
    tiktokLiveConnection.on('connected', async (state) => {
        console.log(`🟢 Conectado exitosamente (Room ID: ${state.roomId})`);
        
        let previousRoomId = null;
        try {
            // Cargar el roomId anterior de Firestore para ver si es el mismo Live
            const statusRef = docFn(db, 'system', 'status');
            const statusSnap = await getDocFn(statusRef);
            if (statusSnap.exists()) {
                previousRoomId = statusSnap.data().roomId || null;
            }
        } catch (e) {
            console.error('⚠️ Error al obtener status de Firestore para comprobar roomId anterior:', e);
        }

        if (previousRoomId && previousRoomId === state.roomId) {
            console.log(`🟢 Reconexión en el mismo live (${state.roomId}). Recuperando rankings de sesión...`);
            
            // Recuperar el offset de likes de la sesión
            try {
                const generalRef = docFn(db, 'globalStats', 'general');
                const generalSnap = await getDocFn(generalRef);
                if (generalSnap.exists()) {
                    const genData = generalSnap.data() || {};
                    if (genData.likesGoalStartOffset !== undefined && genData.likesGoalStartOffset !== null) {
                        const val = Number(genData.likesGoalStartOffset);
                        likesGoalStartOffset = Number.isFinite(val) ? val : null;
                        console.log(`🟢 Recuperado likesGoalStartOffset de Firestore: ${likesGoalStartOffset}`);
                    } else {
                        likesGoalStartOffset = null;
                    }
                }
            } catch (e) {
                console.error('⚠️ Error recuperando likesGoalStartOffset de general:', e);
            }

            // 1. Recuperar Top Likers de sesión
            try {
                const likersRef = docFn(db, 'globalStats', 'topLikers');
                const likersSnap = await getDocFn(likersRef);
                if (likersSnap.exists()) {
                    const snapData = likersSnap.data() || {};
                    const list = snapData.list || [];
                    streamTotalLikesCounter = Number(snapData.streamTotalLikes) || 0;
                    lastKnownTotalLikeCount = streamTotalLikesCounter;
                    console.log(`🟢 Recuperado streamTotalLikes del live: ${streamTotalLikesCounter}`);
                    for (const user of list) {
                        sessionLikes.set(user.username, user.totalAmount);
                        lastLikeCountMap.set(user.username, user.totalAmount);
                        sessionLikerDetails.set(user.username, {
                            username: user.username,
                            nickname: user.nickname,
                            profilePictureUrl: user.profilePictureUrl
                        });
                        // Marcar como presentes al reconectar (se invalidarán en 5 min si no interactúan)
                        markUserPresent(user.username);
                    }
                    console.log(`🟢 Recuperados ${list.length} Top Likers de sesión y mapeo de likes inicializado.`);
                }
            } catch (e) {
                console.error('⚠️ Error recuperando topLikers de sesión:', e);
            }

            // 2. Recuperar Top Gifters de sesión
            try {
                const giftersRef = docFn(db, 'globalStats', 'topGifters');
                const giftersSnap = await getDocFn(giftersRef);
                if (giftersSnap.exists()) {
                    const list = giftersSnap.data().list || [];
                    for (const user of list) {
                        sessionDonations.set(user.username, user.totalAmount);
                        sessionGifterDetails.set(user.username, {
                            username: user.username,
                            nickname: user.nickname,
                            profilePictureUrl: user.profilePictureUrl
                        });
                        // Marcar como presentes al reconectar
                        markUserPresent(user.username);
                    }
                    console.log(`🟢 Recuperados ${list.length} Top Gifters de sesión.`);
                }
            } catch (e) {
                console.error('⚠️ Error recuperando topGifters de sesión:', e);
            }

            resetLikeTracking({ resetSession: false, resetTopLiker: false });
        } else {
            console.log(`🟢 Conexión inicial o nuevo room detectado (${previousRoomId || 'ninguno'} -> ${state.roomId}). Reiniciando tracking.`);
            resetLikeTracking({ resetSession: true, resetTopLiker: true, isNewRoom: true });
            resetDonationTracking();
            await recalculateLikerRanks();
            syncSessionCountersToFirestore(true);
        }

        activeLiveRoomId = state.roomId || null;
        updateLiveStatus(true, state.roomId); // Actualizar estado a ONLINE con roomId
        startLiveHeartbeat();
    });
    
    // Solo un listener de 'disconnected' principal que maneja ambas cosas
    tiktokLiveConnection.on('disconnected', () => {
        console.log('🔴 Desconectado del live.');
        resetLikeTracking({ resetSession: false, resetTopLiker: false });
        stopLiveHeartbeat();
        updateLiveStatus(false); // Actualizar estado a OFFLINE
        if (!manualDisconnect) {
            console.log('🔄 Volviendo a buscar Live...');
            setTimeout(connectToLive, 10000); 
        } else {
            console.log('⏹️ Desconexión manual activa. No se reintentará conexión.');
        }
    });
    
    // Ocultado intencionalmente para no ensuciar la consola
    // tiktokLiveConnection.on('error', (err) => {
    //     console.error('⚠️ Error de conexión TikTok:', err);
    // });
 
    tiktokLiveConnection.on('streamEnd', async () => {
        console.log('🏁 El stream ha terminado.');
        activeLiveRoomId = null;
        
        // Limpiar en memoria pero NO vaciar la base de datos, para que la web siga mostrando los tops del último stream.
        try {
            sessionDonations.clear();
            sessionGifterDetails.clear();
            sessionLikes.clear();
            sessionLikerDetails.clear();
            livePresenceMap.clear();
            likeBuffer.clear();
            lastLikeAlertMilestone.clear();
            lastLikeCountMap.clear();
            lastLikeTimeMap.clear();
            lastKnownTotalLikeCount = 0;
            streamTotalLikesCounter = 0;
            likesGoalStartOffset = null;
            currentTopLiker = { name: 'N/D', count: 0 };
        } catch (e) {
            console.error('Error limpiando variables en memoria al terminar stream:', e);
        }
        
        stopLiveHeartbeat();
        updateLiveStatus(false); // Asegurar OFFLINE al terminar stream
    });

    // CHAT
    // ─── PRESENCIA: registrar entrada de usuarios al live (evento 'member') ────
    tiktokLiveConnection.on('member', async (data) => {
        if (data && data.action === 3) {
            // Es una suscripción. Redirigir al manejador de suscripciones.
            handleSubscription(data);
            return;
        }
        const uid = data && data.uniqueId ? String(data.uniqueId).trim() : '';
        if (uid) {
            markUserPresent(uid);
            // console.log(`👤 @${uid} entró al live.`);

            if (db && typeof addDoc === 'function' && typeof collection === 'function' && overlayAlertsConfig && overlayAlertsConfig.welcomeOverlayEnabled !== false) {
                const isSubscriber = data.isSubscriber;
                const isModerator = data.isModerator;
                const isFollower = data.isFollower || (data.followInfo && (data.followInfo.followStatus === 1 || data.followInfo.followStatus === 2));
                const isStreamer = uid.toLowerCase() === TIKTOK_USERNAME.toLowerCase();

                let allowed = false;
                if (overlayAlertsConfig.welcomeOverlayAllowAll === true) {
                    allowed = true;
                } else {
                    if (overlayAlertsConfig.welcomeOverlayAllowFollowers === true && isFollower) {
                        allowed = true;
                    }
                    if (overlayAlertsConfig.welcomeOverlayAllowSubscribers === true && isSubscriber) {
                        allowed = true;
                    }
                    if (overlayAlertsConfig.welcomeOverlayAllowModerators === true && isModerator) {
                        allowed = true;
                    }
                    if (isStreamer) {
                        allowed = true;
                    }
                }

                if (allowed) {
                    try {
                        const avatarUrl = data.profilePictureUrl || `https://i.pravatar.cc/100?img=${Math.floor(Math.random() * 70) + 1}`;
                        const nickname = data.nickname || uid;
                        
                        // Determinar los roles del usuario para bienvenidas personalizadas
                        const roles = [];
                        if (isStreamer) roles.push('streamer');
                        if (isModerator) roles.push('moderator');
                        if (isSubscriber) roles.push('subscriber');
                        
                        const hasVipBadge = badgeSets && badgeSets.vip && (badgeSets.vip.has(uid) || badgeSets.z0Vip.has(uid));
                        const hasTempVip = typeof tempVipUsers !== 'undefined' && tempVipUsers.has(uid);
                        if (hasVipBadge || hasTempVip) {
                            roles.push('vip');
                        }
                        
                        if (badgeSets && badgeSets.donador && badgeSets.donador.has(uid)) {
                            roles.push('donador');
                        }
                        if (isFollower) roles.push('follower');
                        
                        // Filtrado inteligente: solo escribir en Firestore para destacados, o para un usuario común de vez en cuando (5% de probabilidad)
                        // Esto reduce más de un 95% el consumo de cuota de Firestore (evita RESOURCE_EXHAUSTED)
                        const isFeaturedUser = roles.includes('streamer') || roles.includes('moderator') || roles.includes('subscriber') || roles.includes('vip') || roles.includes('donador');
                        const isLuckyRegularUser = !isFeaturedUser && Math.random() < 0.05; // 5% de probabilidad para usuarios comunes
                        
                        if (isFeaturedUser || isLuckyRegularUser) {
                            // Guardar/Actualizar el registro en liveUsers para el registro histórico del mes
                            const { doc, setDoc, serverTimestamp, increment } = require('firebase/firestore');
                            const now = new Date();
                            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                            
                            await setDoc(doc(db, 'liveUsers', uid), {
                                uniqueId: uid,
                                nickname: nickname,
                                profilePic: avatarUrl,
                                roles: roles,
                                joinCount: increment(1),
                                lastJoined: serverTimestamp(),
                                monthJoined: currentMonth
                            }, { merge: true });

                            // Enviar notificación en tiempo real para el overlay
                            await addDoc(collection(db, 'notifications'), {
                                type: 'join',
                                user: nickname,
                                uniqueId: uid,
                                profilePic: avatarUrl,
                                message: '¡Entró al Live!',
                                roles: roles,
                                timestamp: serverTimestamp()
                            });
                        }
                    } catch (e) {
                        console.error('⚠️ Error enviando notificación de bienvenida a Firestore:', e);
                    }
                }
            }
        }
    });

    // --- Rate limit cache para SR: usuario -> timestamp del último pedido ---
    const srRateLimit = new Map(); // userId -> lastRequestTimestamp
    const SR_COOLDOWN_MS = 15000; // 15 segundos entre pedidos del mismo usuario

    tiktokLiveConnection.on('chat', async (data) => {
        // ── DEDUPLICACIÓN: descartar si este msgId ya fue procesado ──
        if (isDuplicate(data.msgId)) {
            // console.log(`[DEDUP] Mensaje duplicado ignorado: ${data.msgId}`);
            return;
        }

        const msg = data.comment;
        const lowerMsg = msg.toLowerCase();
        const displayName = data.nickname;
        const userId = data.uniqueId;
        const profilePic = data.profilePictureUrl;

        // Marcar presencia activa en el live
        markUserPresent(userId);

        // ─── TIMER EXTENSION: mensaje de chat ───
        if (timerState.state === 'running' && timerState.endsAt && Number(timerState.secondsPerChatMessage) > 0) {
            let secondsToAdd = Number(timerState.secondsPerChatMessage);
            if (timerState.multiplierEnabled && Number(timerState.multiplierValue) > 0) {
                secondsToAdd *= Number(timerState.multiplierValue);
            }
            const msToAdd = Math.round(secondsToAdd * 1000);
            timerState.endsAt += msToAdd;
            console.log(`⏱️ Timer extendido +${secondsToAdd.toFixed(2)}s por mensaje de chat de @${userId}`);
            saveTimerToFirestore().catch(() => {});
        }
        // Actualizar foto de perfil y metadatos de membresía en segundo plano
        const memberFields = {};
        if (data.isSubscriber === true) memberFields.isSubscriber = true;
        const { memberLevel: parsedMemberLevel, gifterLevel: parsedGifterLevel } = extractUserLevels(data);
        if (parsedMemberLevel > 0) memberFields.memberLevel = parsedMemberLevel;
        if (parsedGifterLevel > 0) memberFields.gifterLevel = parsedGifterLevel;
        updateUserProfilePic(userId, displayName, profilePic || null, memberFields);

        
        // DEBUG: Ver todos los mensajes para confirmar que llegan
        // console.log(`[CHAT] ${user}: ${msg}`); 

        // --- USAR CONFIGURACIÓN DINÁMICA ---
        const isSubscriber = data.isSubscriber && config.allowSubscribers;
        const isModerator = data.isModerator && config.allowModerators;
        const isSuperFanRaw = (data.isSubscriber === true) || (Number(data.memberLevel || 0) > 0);
        const isSuperFan = isSuperFanRaw && config.allowSuperFans;
        const isFollower = data.isFollower || (data.followInfo && (data.followInfo.followStatus === 1 || data.followInfo.followStatus === 2));
        
        // FIX: Comparación de usuario insensible a mayúsculas para el streamer
        const isStreamer = userId.toLowerCase() === TIKTOK_USERNAME.toLowerCase();
        
        const isVip = isSubscriber || isModerator || isSuperFan || isStreamer || tempVipUsers.has(userId);
        const requireVip = config.requireVipForSr === true; // Strict check

        // ── TEXT TO SPEECH (TTS) PARA COMENTARIOS DE CHAT ──
        if (overlayAlertsConfig.chatTtsEnabled === true) {
            // 1. Verificar Special Users
            const specialUsers = overlayAlertsConfig.chatTtsSpecialUsers || [];
            const specialUser = specialUsers.find(u => {
                const cleanUser = String(u.username || '').toLowerCase().replace(/^@/, '');
                return cleanUser === userId.toLowerCase();
            });

            let userAllowed = false;
            let voiceOverride = null;
            let speedOverride = null;
            let pitchOverride = null;

            if (specialUser) {
                if (specialUser.allowed === false) {
                    console.log(`🗣️ [TTS] @${displayName} está bloqueado en la lista de Special Users`);
                    userAllowed = false; // Blocked entirely!
                } else {
                    userAllowed = true; // Bypassed range checks!
                    voiceOverride = specialUser.voice;
                    speedOverride = specialUser.speed;
                    pitchOverride = specialUser.pitch;
                }
            } else {
                // General allowed checks
                if (overlayAlertsConfig.chatTtsAllowAll === true) {
                    userAllowed = true;
                } else {
                    if (overlayAlertsConfig.chatTtsAllowFollowers === true && isFollower) {
                        userAllowed = true;
                    }
                    if (overlayAlertsConfig.chatTtsAllowSubscribers === true && data.isSubscriber === true) {
                        userAllowed = true;
                    }
                    if (overlayAlertsConfig.chatTtsAllowModerators === true && data.isModerator === true) {
                        userAllowed = true;
                    }
                    if (overlayAlertsConfig.chatTtsAllowTeam === true && isSuperFanRaw) {
                        userAllowed = true;
                    }
                    if (overlayAlertsConfig.chatTtsAllowTopGifters === true && tempVipUsers.has(userId)) {
                        userAllowed = true;
                    }
                    if (isStreamer) {
                        userAllowed = true;
                    }
                }
            }

            // Si es un special user bloqueado, salimos. Si no está permitido, salimos.
            if (specialUser && specialUser.allowed === false) {
                // Ya logueado y controlado
            } else if (userAllowed) {
                let commentQualifies = false;
                const filterType = overlayAlertsConfig.chatTtsType || 'any'; // 'any', 'dot', 'slash', 'command'
                const ttsCommand = String(overlayAlertsConfig.chatTtsCommand || '!tts').toLowerCase();

                if (filterType === 'any') {
                    if (!msg.startsWith('!')) {
                        commentQualifies = true;
                    }
                } else if (filterType === 'dot' && msg.startsWith('.')) {
                    commentQualifies = true;
                } else if (filterType === 'slash' && msg.startsWith('/')) {
                    commentQualifies = true;
                } else if (filterType === 'command' && lowerMsg.startsWith(ttsCommand)) {
                    commentQualifies = true;
                }

                if (commentQualifies && db) {
                    let cleanedMsg = msg;
                    if (filterType === 'command') {
                        cleanedMsg = msg.substring(ttsCommand.length).trim();
                    } else if (filterType === 'dot' || filterType === 'slash') {
                        cleanedMsg = msg.substring(1).trim();
                    }

                    // SPAM PROTECTION: Filter letter spam (exclude digits and whitespace)
                    if (overlayAlertsConfig.chatTtsFilterLetterSpam !== false) {
                        cleanedMsg = cleanedMsg.replace(/([^\d\s])\1{2,}/gi, '$1$1');
                    }

                    // SPAM PROTECTION: Filter @mentions
                    if (overlayAlertsConfig.chatTtsFilterMentions === true) {
                        cleanedMsg = cleanedMsg.replace(/@\w+/g, '').trim();
                    }

                    // SPAM PROTECTION: Filter !commands
                    if (overlayAlertsConfig.chatTtsFilterCommands === true) {
                        cleanedMsg = cleanedMsg.replace(/!\w+/g, '').trim();
                    }

                    // SPAM PROTECTION: Max comment length
                    const maxCommentLength = Number(overlayAlertsConfig.chatTtsMaxCommentLength) || 300;
                    if (cleanedMsg.length > maxCommentLength) {
                        cleanedMsg = cleanedMsg.substring(0, maxCommentLength).trim();
                    }

                    if (cleanedMsg.length > 0) {
                        let canRead = true;

                        // SPAM PROTECTION: User cooldown
                        const now = Date.now();
                        const lastTime = ttsCooldowns.get(userId) || 0;
                        const cooldownSec = Number(overlayAlertsConfig.chatTtsUserCooldown) || 0;
                        if (cooldownSec > 0 && (now - lastTime < cooldownSec * 1000) && !isStreamer) {
                            console.log(`🗣️ [TTS] @${displayName} en cooldown (${Math.ceil((cooldownSec * 1000 - (now - lastTime)) / 1000)}s restantes)`);
                            canRead = false;
                        }

                        // SPAM PROTECTION: Max queue length (using in-memory sliding queue check)
                        if (canRead && !isStreamer) {
                            activeTtsQueue = activeTtsQueue.filter(item => now - item.timestamp < 15000);
                            const maxQueueLength = Number(overlayAlertsConfig.chatTtsMaxQueueLength) || 5;
                            if (activeTtsQueue.length >= maxQueueLength) {
                                console.log(`🗣️ [TTS] Cola llena (${activeTtsQueue.length} >= ${maxQueueLength})`);
                                canRead = false;
                            }
                        }

                        // Validar cobro de puntos (los special users y el streamer no pagan!)
                        if (canRead && overlayAlertsConfig.chatTtsChargePoints === true && !specialUser && !isStreamer) {
                            const cost = Number(overlayAlertsConfig.chatTtsCost) || 5;
                            try {
                                const resolved = await getCanonicalUserKey(userId, displayName);
                                const userKey = resolved.userKey || userId;
                                const userRef = doc(db, 'userStats', userKey);
                                const userSnap = await getDoc(userRef);
                                let points = 0;
                                if (userSnap.exists()) {
                                    points = Number(userSnap.data().totalPoints) || 0;
                                }
                                if (points < cost) {
                                    console.log(`🗣️ [TTS] @${displayName} no tiene suficientes puntos (${points} < ${cost})`);
                                    canRead = false;
                                } else {
                                    // Descontar puntos
                                    await setDoc(userRef, {
                                        totalPoints: increment(-cost),
                                        lastActiveAt: serverTimestamp()
                                    }, { merge: true });
                                    console.log(`🗣️ [TTS] Descontados ${cost} puntos a @${displayName}`);
                                    
                                    await addDoc(collection(db, 'notifications'), {
                                        type: 'points_tts',
                                        user: displayName,
                                        points: -cost,
                                        message: `-${cost} puntos por usar TTS 🗣️`,
                                        timestamp: serverTimestamp()
                                    });
                                }
                            } catch (e) {
                                console.error('Error descontando puntos para TTS:', e);
                                canRead = false;
                            }
                        }

                        if (canRead) {
                            // Resolve message template
                            let speechText = String(overlayAlertsConfig.chatTtsMessageTemplate || "{comment}");
                            speechText = speechText
                                .replace(/{nickname}/g, displayName)
                                .replace(/{username}/g, userId)
                                .replace(/{comment}/g, cleanedMsg);

                            let audioData = null;
                            const activeVoice = voiceOverride || overlayAlertsConfig.chatTtsVoice;
                            if (activeVoice && activeVoice.startsWith('tiktok:')) {
                                const voiceCode = activeVoice.replace('tiktok:', '');
                                try {
                                    const textToSpeak = speechText.substring(0, 290);
                                    console.log(`🗣️ [TTS] Solicitando voz de TikTok (${voiceCode}) para: "${textToSpeak}"`);
                                    const ttsRes = await axios.post('https://tiktok-tts.weilnet.workers.dev/api/generation', {
                                        text: textToSpeak,
                                        voice: voiceCode
                                    }, {
                                        headers: { 'Content-Type': 'application/json' },
                                        timeout: 7000
                                    });

                                    if (ttsRes.data && ttsRes.data.success && ttsRes.data.data) {
                                        audioData = `data:audio/mp3;base64,${ttsRes.data.data}`;
                                        console.log(`🗣️ [TTS] Voz de TikTok generada exitosamente (${ttsRes.data.data.length} bytes)`);
                                    } else {
                                        console.warn(`🗣️ [TTS] Error de la API de TikTok:`, ttsRes.data);
                                    }
                                } catch (ttsErr) {
                                    console.error(`🗣️ [TTS] Error solicitando voz de TikTok:`, ttsErr.message);
                                }
                            }

                            try {
                                await addDoc(collection(db, 'notifications'), {
                                    type: 'chat',
                                    user: displayName,
                                    uniqueId: userId,
                                    message: speechText,
                                    voiceOverride: voiceOverride,
                                    audioData: audioData,
                                    speedOverride: speedOverride !== null && speedOverride !== undefined ? Number(speedOverride) : null,
                                    pitchOverride: pitchOverride !== null && pitchOverride !== undefined ? Number(pitchOverride) : null,
                                    timestamp: serverTimestamp()
                                });

                                // Registrar en la cola en memoria
                                if (!isStreamer) {
                                    activeTtsQueue.push({ userId, timestamp: now });
                                }
                                ttsCooldowns.set(userId, now);

                                // Guardar en el log global para el dashboard
                                const logTime = new Date().toLocaleTimeString('en-US', { hour12: true });
                                ttsLogs.push({
                                    timestamp: logTime,
                                    user: displayName,
                                    message: speechText
                                });
                                if (ttsLogs.length > 50) ttsLogs.shift();

                                console.log(`🗣️ TTS Chat agregado para @${displayName}: "${speechText}"`);
                            } catch (err) {
                                console.error('Error guardando TTS de chat en Firestore:', err);
                            }
                        }
                    }
                }
            }
        }

        if (isSuperFanRaw) {
            try {
                const k = normalizeUserKeyForBadges(userId) || normalizeUserKeyForBadges(displayName);
                if (k) runtimeSuperfanUsers.add(k);
            } catch (_) {}
        }

        // Debug Permissions (Solo si falla)
        // console.log(`[AUTH] User: ${displayName} | VIP: ${isVip} | ConfigReq: ${requireVip} | AllowSubs: ${config.allowSubscribers}`);

        // --- COMANDO DE PUNTOS ---
        const isPointsCmd = lowerMsg === '!puntos' || lowerMsg === '!points' || lowerMsg.startsWith('!puntos ') || lowerMsg.startsWith('!points ');
        
        if (isPointsCmd && config.allowPointsCommand !== false) {
            const resolved = await getCanonicalUserKey(userId, displayName);
            const key = resolved.userKey || userId;
            const dn = resolved.displayName || displayName;
            
            try {
                if (db && typeof getDoc === 'function' && typeof doc === 'function') {
                    const snap = await getDoc(doc(db, 'userStats', key));
                    let pts = 0;
                    if (snap.exists()) {
                        const d = snap.data();
                        pts = Number(d.totalPoints) || 0;
                    }
                    console.log(`💰 @${dn} tiene ${pts} puntos.`);

                    // Enviar notificación visual al Overlay
                    if (db && typeof addDoc === 'function' && typeof collection === 'function') {
                        await addDoc(collection(db, 'notifications'), {
                            type: 'points',
                            user: dn,
                            points: pts,
                            message: `@${dn} tiene ${pts} puntos`,
                            timestamp: serverTimestamp()
                        });
                    }
                }
            } catch (e) {
                console.error(`Error consultando puntos de ${dn}:`, e);
            }
            return; 
        }

        // --- COMANDO DE VINCULACIÓN (!link o !vincular) ---
        const isLinkCmd = lowerMsg.startsWith('!link') || lowerMsg.startsWith('!vincular');
        if (isLinkCmd) {
            const codeMatch = msg.toUpperCase().match(/ZR-\d{4}/);
            const code = codeMatch ? codeMatch[0] : null;
            if (!code) {
                console.log(`❌ Código de vinculación inválido o ausente recibido de ${displayName}: ${msg}`);
                return;
            }

            const cleanCode = code.trim().toUpperCase();
            console.log(`🔗 Intento de vinculación de @${displayName} con código: ${cleanCode}`);

            try {
                if (db && typeof getDoc === 'function' && typeof doc === 'function' && typeof setDoc === 'function') {
                    const linkDocRef = doc(db, 'pendingLinks', cleanCode);
                    const linkSnap = await getDoc(linkDocRef);

                    if (!linkSnap.exists()) {
                        console.log(`⚠️ Código ${cleanCode} no existe o ya fue usado.`);
                        // Opcional: Feedback visual al overlay
                        return;
                    }

                    const linkData = linkSnap.data();
                    const now = new Date();
                    const expiresAt = linkData.expiresAt ? linkData.expiresAt.toDate() : null;

                    if (expiresAt && now > expiresAt) {
                        console.log(`⏳ Código ${cleanCode} expirado.`);
                        return;
                    }

                    const rawWebUser = linkData.webUser;
                    // FIX: Normalizar webUser a minúsculas y sin arroba para evitar Ghost Documents
                    const webUser = String(rawWebUser || '').trim().replace(/^@/, '').toLowerCase();

                    if (!webUser || webUser === 'usuario') {
                        console.log(`❌ Intento de vincular con cuenta inválida ("${webUser}"). Abortando.`);
                        return;
                    }
                    
                    // FIX: Usar userId (uniqueId/handle) en lugar de nickname
                    const tiktokHandle = userId.replace(/^@/, '').toLowerCase(); 

                    // 1. Crear el vínculo en systemConfig/userAliases (Compatibilidad Legacy)
                    await setDoc(doc(db, 'systemConfig', 'userAliases'), {
                        [tiktokHandle]: webUser
                    }, { merge: true });

                    // 1.1 Crear el vínculo en la colección userAliases (Real-time para la Web)
                    await setDoc(doc(db, 'userAliases', tiktokHandle), {
                        aliasedTo: webUser,
                        updatedAt: serverTimestamp()
                    });
                    
                    // Actualizar mapa en memoria inmediatamente
                    USER_ALIASES_MAP[tiktokHandle] = webUser;

                    // 1.2 MIGRACIÓN AUTOMÁTICA DE DATOS
                    // Al vincular exitosamente, fusionamos el documento temporal del TikTok handle
                    // con el documento principal del usuario web.
                    await mergeTwoUsers(tiktokHandle, webUser);

                    // 2. Marcar en userStats del usuario web para búsqueda reversa rápida
                    try {
                        await setDoc(doc(db, 'userStats', webUser), {
                            tiktokId: tiktokHandle,
                            tiktokDisplayName: displayName,
                            lastLinkedAt: serverTimestamp()
                        }, { merge: true });
                    } catch (e) {
                        console.warn(`Error actualizando tiktokId en userStats/${webUser}:`, e.message);
                    }

                    // 3. Eliminar el código usado para que no se pueda reutilizar (seguridad)
                    if (typeof deleteDoc === 'function') {
                        await deleteDoc(linkDocRef);
                    }

                    // 4. Notificar éxito
                    console.log(`✅ ¡VINCULACIÓN EXITOSA! @${tiktokHandle} -> ${webUser}`);
                    
                    if (db && typeof addDoc === 'function' && typeof collection === 'function') {
                        await addDoc(collection(db, 'notifications'), {
                            type: 'success',
                            user: displayName,
                            message: `✅ Cuenta vinculada con ${webUser}`,
                            timestamp: serverTimestamp()
                        });
                    }
                }
            } catch (e) {
                console.error(`Error procesando vinculación de ${displayName}:`, e);
            }
            return;
        }

        // --- COMANDOS DE RULETA (NUEVO) ---
        const isRouletteSpinCmd = lowerMsg === '!girar' || lowerMsg === '!spin';
        const isRouletteResetCmd = lowerMsg === '!ruleta_reset' || lowerMsg === '!reset_ruleta';

        if ((isRouletteSpinCmd || isRouletteResetCmd) && (isModerator || isStreamer)) {
            try {
                if (db && typeof addDoc === 'function' && typeof collection === 'function') {
                    await addDoc(collection(db, 'notifications'), {
                        type: isRouletteSpinCmd ? 'roulette_spin' : 'roulette_reset',
                        user: displayName,
                        message: isRouletteSpinCmd ? `🎲 @${displayName} inició el giro` : `🔄 @${displayName} reinició la ruleta`,
                        timestamp: serverTimestamp()
                    });
                    console.log(`🎰 Comando de ruleta procesado: ${lowerMsg} por ${displayName}`);
                }
            } catch (e) {
                console.error(`Error enviando comando de ruleta:`, e);
            }
            return;
        }

        // --- COMANDO DE RESETEAR LIKES (!reset_likes o !reiniciar_likes) ---
        const isResetLikesCmd = lowerMsg === '!reset_likes' || lowerMsg === '!reiniciar_likes';
        if (isResetLikesCmd && (isModerator || isStreamer)) {
            try {
                console.log(`🔄 Comando de reinicio de likes recibido de @${displayName}`);
                resetLikeTracking({ resetSession: true, resetTopLiker: true });
                await recalculateLikerRanks();
                syncSessionCountersToFirestore(true);
                await updateGlobalTopLiker('N/D', 0);

                if (db && typeof addDoc === 'function' && typeof collection === 'function') {
                    await addDoc(collection(db, 'notifications'), {
                        type: 'success',
                        user: displayName,
                        message: `🔄 @${displayName} reinició la sesión de likes`,
                        timestamp: serverTimestamp()
                    });
                }
            } catch (e) {
                console.error('Error al procesar comando de reset_likes:', e);
            }
            return;
        }

        const aliases = getSrAliases();
        const parsed = parseSrCommand(msg, aliases);
        if (parsed) {
            
            console.log(`📝 Comando detectado de ${displayName} (${userId}): ${msg}`);
            
            // --- Rate-limit de SR por usuario (máximo 1 pedido cada 15 segundos) ---
            if (!isStreamer && !isModerator) {
                const now = Date.now();
                const lastRequest = srRateLimit.get(userId) || 0;
                if (now - lastRequest < SR_COOLDOWN_MS) {
                    const remaining = Math.ceil((SR_COOLDOWN_MS - (now - lastRequest)) / 1000);
                    console.log(`⏳ @${displayName} está en cooldown para pedir canciones. Espera ${remaining}s.`);
                    return;
                }
                srRateLimit.set(userId, now);
            }
            
            // Log de depuración para permisos
            if (requireVip && !isVip) {
                console.log(`🔍 DEBUG PERMISOS: ReqVIP=${requireVip}, UserVIP=${isVip} (Sub=${isSubscriber}, Mod=${isModerator}, Fan=${isSuperFan})`);
                console.log(`🚫 ${displayName} intentó pedir, pero no tiene permiso.`);
                pushSrEvent({ source: 'chat', user: userId, displayName, userId, query: msg, isVip, accepted: false, denied: 'notVip' });
                return;
            }

            const rawQuery = parsed.query;
            if (rawQuery.length > 0) {
                const cleanQuery = rawQuery.trim();
                
                // --- IGNORAR EJEMPLOS ---
                const exampleToIgnore = String(config.ignoreExampleQuery || "artista cancion").trim().toLowerCase();
                if (cleanQuery.toLowerCase() === exampleToIgnore) {
                    console.log(`💡 Ejemplo detectado ("${cleanQuery}"), ignorando pedido.`);
                    return;
                }

                console.log(`📩 Pedido de ${displayName}: ${rawQuery}`);
                const resolvedUser = await getCanonicalUserKey(userId, displayName);
                const userKey = String(resolvedUser.userKey || userId || '').trim();
                const displayNameBest = String(resolvedUser.displayName || displayName || '').trim();
                const result = await handleSongRequest(userKey, cleanQuery, { 
                    userId, 
                    displayName: displayNameBest, 
                    rawQuery, 
                    source: 'tiktokChat',
                    profilePhoto: profilePic // Pasar la foto de perfil al procesador
                });
                pushSrEvent({ source: 'chat', user: userKey, displayName: displayNameBest, userId, query: rawQuery, isVip, accepted: !!result?.ok, queueSaved: !!result?.queueSaved, ciderSent: !!result?.ciderSent, ciderQueued: !!result?.ciderQueued, error: result?.ok ? '' : (result?.error || '') });
            }
        }
    });

    // REGALOS
    tiktokLiveConnection.on('gift', async (data) => {
        // DIAGNOSTIC LOG FOR GIFTS
        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                giftName: data.giftName || '',
                giftId: data.giftId || data.gift?.id || '',
                diamondCount: data.diamondCount || '',
                giftDetails: data.gift || null,
                nickname: data.nickname || '',
                uniqueId: data.uniqueId || ''
            };
            const logPath = path.join(__dirname, 'gift_logs.json');
            fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
        } catch (e) {
            console.error('Error writing diagnostic gift log:', e);
        }
        // ── DEDUPLICACIÓN INTELIGENTE PARA RACHAS (STREAKS) ──
        let lastCount = 0;
        const newCount = Number(data.repeatCount || data.repeatcount || 1) || 1;
        const msgId = data.msgId ? String(data.msgId) : '';
        if (msgId) {
            if (!global.processedGiftsMap) {
                global.processedGiftsMap = new Map();
            }
            lastCount = global.processedGiftsMap.get(msgId) || 0;
            if (newCount <= lastCount) {
                // Ya procesamos este conteo o uno mayor para este regalo
                return;
            }
            global.processedGiftsMap.set(msgId, newCount);
            
            // Limpieza periódica para evitar fugas de memoria
            if (global.processedGiftsMap.size > 2000) {
                const firstKey = global.processedGiftsMap.keys().next().value;
                global.processedGiftsMap.delete(firstKey);
            }
        }
        const delta = newCount - lastCount;

        const giftName = data.giftName || data.gift?.name || data.gift?.giftName || '';
        const giftKey = normalizeComparableText(giftName);
        const coins = Number(data.diamondCount || data.gift?.diamondCount || data.giftDetails?.diamondCount || 0) || 0;
        const uid = data.uniqueId;
        const displayName = data.nickname;
        const profilePic = data.profilePictureUrl;
        
        // Actualizar foto de perfil
        if (profilePic) {
            const extra = {};
            if (data.isSubscriber === true) extra.isSubscriber = true;
            const { memberLevel: parsedMemberLevel, gifterLevel: parsedGifterLevel } = extractUserLevels(data);
            if (parsedMemberLevel > 0) extra.memberLevel = parsedMemberLevel;
            if (parsedGifterLevel > 0) extra.gifterLevel = parsedGifterLevel;
            updateUserProfilePic(uid, displayName, profilePic, extra);
        }

        // Marcar presencia activa en el live
        markUserPresent(uid);

        const currentAmount = sessionDonations.get(uid) || 0;
        sessionDonations.set(uid, currentAmount + coins);
        sessionGifterDetails.set(uid, {
            username: uid,
            nickname: displayName,
            profilePictureUrl: profilePic || ''
        });
        
        const giftId = data.giftId || data.gift?.id || data.gift?.giftId || '';
        console.log(`🎁 REGALO: "${giftName}" (ID: ${giftId}, key: "${giftKey}") de ${displayName} — ${coins} diamantes`);

        try {
            const totalCoins = Number(sessionDonations.get(uid) || 0);
            const minVip = Number(config.minCoinsForVip) || 0;
            if (minVip > 0 && totalCoins >= minVip) tempVipUsers.add(uid);
            if (totalCoins >= 10) {
                const k = normalizeUserKeyForBadges(uid) || normalizeUserKeyForBadges(displayName);
                if (k) tempDonadorUsers.add(k);
            }
        } catch (_) {}

        const isGiftFinal = (data.repeatEnd === undefined) ? true : (data.repeatEnd === true);
        const isQuiereme = (giftKey === 'heartme');
        
        // ── Otorgar insignia z0-Fan (se hace en el primer envío o en el evento final) ──
        if (isQuiereme && (isGiftFinal || lastCount === 0)) {
            try {
                await grantZ0FanFromTikTok(uid, displayName);
            } catch (e) {
                console.error('Error otorgando z0-Fan por regalo:', e);
            }
        }

        // ── Acumular en Top Quiéreme (usando delta en tiempo real para no perder nada) ──
        if (isQuiereme && db) {
            try {
                const resolved = await getCanonicalUserKey(uid, displayName);
                const userKey = resolved.userKey || uid;
                const quiereCoins = coins * delta;
                const quiereRef = doc(db, 'userStats', userKey);
                const quiereData = {
                    quiereCount: increment(delta),
                    totalQuiereCoins: increment(quiereCoins),
                    displayName: displayName,
                    lastActiveAt: serverTimestamp()
                };
                if (profilePic) quiereData.profilePic = profilePic;
                
                // Forzar suscripción activa a nivel 1 al mandar Quiéreme (Heart Me)
                quiereData.isSubscriber = true;
                
                // Mapear nivel de miembro de TikTok usando la función robusta extractUserLevels
                const { memberLevel: parsedMemberLevel, gifterLevel: parsedGifterLevel } = extractUserLevels(data);
                const cached = userMetadataCache.get(userKey);
                const currentMemberLvl = cached?.memberLevel || 0;
                
                if (parsedMemberLevel > 0) {
                    quiereData.memberLevel = Math.max(parsedMemberLevel, currentMemberLvl, 1);
                } else if (currentMemberLvl > 0) {
                    quiereData.memberLevel = currentMemberLvl;
                } else {
                    quiereData.memberLevel = 1;
                }
                if (parsedGifterLevel > 0) quiereData.gifterLevel = parsedGifterLevel;
                
                await setDoc(quiereRef, quiereData, { merge: true });
                console.log(`💜 Top Quiéreme: @${displayName} +${delta} (${quiereCoins} coins)`);
            } catch (e) {
                console.error('Error acumulando Top Quiéreme:', e);
            }
        }


        // Escribimos la notificación de regalo si es el evento final de la racha,
        // o si es un Quiéreme en su primer envío de la racha (para asegurar la alerta instantánea en OBS).
        if ((isGiftFinal || (isQuiereme && lastCount === 0)) && db) {
            const actualCount = Number(data.repeatCount || data.repeatcount || 1) || 1;
            const totalCoins = coins * actualCount;
            const minCoins = Number(overlayAlertsConfig.minCoinsAlert) || 1;
            
            if (totalCoins >= minCoins || isQuiereme) {
                try {
                    let msgTemplate = String(overlayAlertsConfig.giftsAlertMsg || "¡Gracias por {repeatCount}x {giftName}! 🎁");
                    let customMsg = msgTemplate
                        .replace(/{user}/g, displayName)
                        .replace(/{giftname}/g, giftName)
                        .replace(/{giftName}/g, giftName)
                        .replace(/{repeatCount}/g, actualCount)
                        .replace(/{repeatcount}/g, actualCount)
                        .replace(/{coins}/g, totalCoins)
                        .replace(/{total}/g, (sessionDonations.get(uid) || totalCoins).toLocaleString())
                        .replace(/{totalCoins}/g, (sessionDonations.get(uid) || totalCoins).toLocaleString());

                    let giftLocalIcon = '';
                    if (data.giftPictureUrl) {
                        try {
                            const urlParts = data.giftPictureUrl.split('/');
                            let lastPart = urlParts[urlParts.length - 1];
                            lastPart = lastPart.split('?')[0];
                            if (lastPart.endsWith('.image')) {
                                lastPart = lastPart.replace(/\.image$/, '.png');
                            } else if (!lastPart.endsWith('.png')) {
                                lastPart = lastPart + '.png';
                            }
                            giftLocalIcon = lastPart;
                        } catch (e) {
                            console.error('Error parsing giftPictureUrl:', e);
                        }
                    }

                    await addDoc(collection(db, 'notifications'), {
                        type: 'gift',
                        user: displayName,
                        uniqueId: uid,
                        profilePic: profilePic || '',
                        giftName: giftName,
                        giftIcon: data.giftPictureUrl || '',
                        giftLocalIcon: giftLocalIcon || '',
                        coins: totalCoins,
                        repeatCount: actualCount,
                        message: customMsg,
                        timestamp: serverTimestamp()
                    });
                } catch (e) {
                    console.error('Error guardando notificación de regalo en Firestore:', e);
                }
            }
        }

        // --- SISTEMA DE PUNTOS POR DONACIÓN ---
        // 1 punto por cada 10 monedas (acumulado usando delta en tiempo real para no duplicar ni perder nada)
        const totalCoinsFromDelta = coins * delta;
        const pointsFromGift = Math.floor(totalCoinsFromDelta / 10);
        
        if (pointsFromGift > 0 && db) {
            try {
                const resolved = await getCanonicalUserKey(uid, displayName);
                const userKey = resolved.userKey || uid;
                const userRef = doc(db, 'userStats', userKey);
                
                // Usamos increment para sumar de forma atómica
                const giftUpdateData = {
                    totalPoints: increment(pointsFromGift),
                    totalGiftPoints: increment(pointsFromGift),
                    totalCoinsDonated: increment(totalCoinsFromDelta),
                    lastActiveAt: serverTimestamp(),
                    displayName: displayName
                };
                // Persistir membresía si viene en el evento de regalo
                if (data.isSubscriber === true) giftUpdateData.isSubscriber = true;
                
                // Usar extractUserLevels para leer de forma robusta la insignia del club de fans / nivel de miembro
                const { memberLevel: parsedMemberLevel, gifterLevel: parsedGifterLevel } = extractUserLevels(data);
                if (parsedMemberLevel > 0) giftUpdateData.memberLevel = parsedMemberLevel;
                if (parsedGifterLevel > 0) giftUpdateData.gifterLevel = parsedGifterLevel;
                
                await setDoc(userRef, giftUpdateData, { merge: true });

                
                console.log(`💎 Puntos otorgados a ${displayName}: +${pointsFromGift} (por ${coins} monedas)`);
                
                // Notificar visualmente
                await addDoc(collection(db, 'notifications'), {
                    type: 'points_gift',
                    user: displayName,
                    points: pointsFromGift,
                    message: `+${pointsFromGift} puntos por regalo`,
                    timestamp: serverTimestamp()
                });

            } catch (e) {
                console.error(`Error otorgando puntos por regalo a ${displayName}:`, e);
            }
        }

        // Recalcular rangos (VIP, etc.)
        recalculateDonorRanks();

        // ─── GOAL OVERLAYS: acumular coins de sesión ────────────────────────────
        if (isGiftFinal) {
            const actualCount = Number(data.repeatCount || data.repeatcount || 1) || 1;
            const totalCoinsThisGift = coins * actualCount;
            sessionTotalCoins += totalCoinsThisGift;
            syncSessionCountersToFirestore();

            // ─── TIMER EXTENSION: extender el countdown por regalos ──────────────
            if (timerState.state === 'running' && timerState.endsAt) {
                let secondsToAdd = 0;
                const coinsPerGift = Number(coins) || 0;
                const repeatCount = Number(data.repeatCount || data.repeatcount || 1) || 1;
                const totalCoins = coinsPerGift * repeatCount;
                
                if (Number(timerState.secondsPerCoin) > 0) {
                    // Modo Tikfinity: sumar proporcional a las monedas (monedas * segundos_por_moneda)
                    secondsToAdd = totalCoins * Number(timerState.secondsPerCoin);
                    console.log(`⏱️ [Tikfinity Mode] Regalo de ${displayName} (${totalCoins} monedas) → +${secondsToAdd}s al timer.`);
                } else {
                    // Modo Clásico: sumar un tiempo fijo por regalo recibido (si es > 0)
                    secondsToAdd = Number(timerState.secondsPerGift || 0);
                    if (secondsToAdd > 0) {
                        console.log(`⏱️ [Classic Mode] Regalo de ${displayName} → +${secondsToAdd}s al timer.`);
                    }
                }
                
                if (secondsToAdd > 0) {
                    if (timerState.multiplierEnabled && Number(timerState.multiplierValue) > 0) {
                        secondsToAdd *= Number(timerState.multiplierValue);
                        console.log(`⏱️ Multiplicador de timer activo (x${timerState.multiplierValue}) → Sumando +${secondsToAdd.toFixed(2)}s.`);
                    }
                    const msToAdd = Math.round(secondsToAdd * 1000);
                    timerState.endsAt += msToAdd;
                    console.log(`⏱️ Timer extendido +${secondsToAdd.toFixed(2)}s (termina en: ${Math.round((timerState.endsAt - Date.now()) / 1000)}s)`);
                    saveTimerToFirestore().catch(() => {});
                }
            }
        }
    });


    // ─── MANEJO DE LIKES ───────────────────────────────────────────────────────
    // PROTO CONFIRMADO: likeCount = tamaño del batch (delta ya listo para sumar)
    //                   totalLikeCount = acumulativo global del stream
    // TikFinity suma likeCount directamente por usuario, igual que hacemos aquí.
    tiktokLiveConnection.on('like', (data) => {
        const uniqueId = String(data && data.uniqueId || '').trim();
        const nickname = String(data && data.nickname || uniqueId || 'Usuario').trim();
        const rawLikeCount = Number(data && data.likeCount);
        const safeLikeCount = Number.isFinite(rawLikeCount) ? Math.floor(rawLikeCount) : 0;

        // ⚡ TOTAL LIKE COUNT GLOBAL: contador más confiable del stream
        const rawTotal = Number(data && data.totalLikeCount);
        if (Number.isFinite(rawTotal) && rawTotal > lastKnownTotalLikeCount) {
            if (likesGoalStartOffset === null) {
                // Inicializar offset restando la suma actual de likes de sesión para preservar el progreso acumulado
                const currentSessionLikes = Array.from(sessionLikes.values()).reduce((a, b) => a + b, 0);
                likesGoalStartOffset = Math.max(0, rawTotal - currentSessionLikes);
                console.log(`[Likes Goal] Offset inicializado: rawTotal=${rawTotal}, currentSessionLikes=${currentSessionLikes} → likesGoalStartOffset=${likesGoalStartOffset}`);
            }
            lastKnownTotalLikeCount = rawTotal;
            streamTotalLikesCounter = rawTotal; // totalLikeCount ya ES el acumulado real
        }

        // Si TikTok no manda usuario o el batch es 0, ignorar
        if (!uniqueId || safeLikeCount <= 0) return;

        // likeCount = likes en este batch específico → sumar directo
        const delta = safeLikeCount;

        // Marcar presencia activa en el live
        markUserPresent(uniqueId);

        // Acumular likes en buffer para Firestore (se guarda cada 5 segundos)
        const current = likeBuffer.get(uniqueId) || {
            userId: uniqueId,
            displayName: nickname,
            profilePic: data.profilePictureUrl || '',
            likes: 0
        };
        current.displayName = nickname || current.displayName || uniqueId;
        if (data.profilePictureUrl) {
            current.profilePic = data.profilePictureUrl;
        }
        current.likes += delta;
        likeBuffer.set(uniqueId, current);

        // Actualizar total de sesión en memoria
        const sessionTotal = (sessionLikes.get(uniqueId) || 0) + delta;
        sessionLikes.set(uniqueId, sessionTotal);

        sessionLikerDetails.set(uniqueId, {
            username: uniqueId,
            nickname: nickname || uniqueId,
            profilePictureUrl: data.profilePictureUrl || '',
            lastActive: Date.now()
        });

        console.log(`❤️ @${nickname} +${delta} likes → sesión: ${sessionTotal} | stream total: ${streamTotalLikesCounter}`);

        // Actualizar top liker si corresponde
        if (sessionTotal > currentTopLiker.count) {
            currentTopLiker = { name: nickname, count: sessionTotal };
            updateGlobalTopLiker(nickname, sessionTotal);
        }

        // ─── TIMER EXTENSION: extender el countdown por likes (Tikfinity Mode) ───
        if (timerState.state === 'running' && timerState.endsAt && Number(timerState.secondsPerLike) > 0) {
            let secondsToAdd = delta * Number(timerState.secondsPerLike);
            if (timerState.multiplierEnabled && Number(timerState.multiplierValue) > 0) {
                secondsToAdd *= Number(timerState.multiplierValue);
            }
            const msToAdd = Math.round(secondsToAdd * 1000);
            if (msToAdd > 0) {
                timerState.endsAt += msToAdd;
                console.log(`⏱️ Timer extendido +${secondsToAdd.toFixed(2)}s por ${delta} likes de @${nickname}`);
                saveTimerToFirestore().catch(() => {});
            }
        }
    });

    // SEGUIDORES (FOLLOW)
    tiktokLiveConnection.on('follow', async (data) => {
        const displayName = data.nickname;
        const uid = data.uniqueId;
        const profilePic = data.profilePictureUrl;

        // Actualizar foto de perfil y niveles
        if (profilePic) {
            const extra = {};
            const { memberLevel: parsedMemberLevel, gifterLevel: parsedGifterLevel } = extractUserLevels(data);
            if (parsedMemberLevel > 0) extra.memberLevel = parsedMemberLevel;
            if (parsedGifterLevel > 0) extra.gifterLevel = parsedGifterLevel;
            updateUserProfilePic(uid, displayName, profilePic, extra);
        }

        // Marcar presencia activa en el live
        markUserPresent(uid);

        // Acumular en contador de sesión para metas
        sessionFollows.set(uid, (sessionFollows.get(uid) || 0) + 1);
        syncSessionCountersToFirestore();

        // ─── TIMER EXTENSION: extender el countdown por seguir (Tikfinity Mode) ───
        if (timerState.state === 'running' && timerState.endsAt && Number(timerState.secondsPerFollow) > 0) {
            let secondsToAdd = Number(timerState.secondsPerFollow);
            if (timerState.multiplierEnabled && Number(timerState.multiplierValue) > 0) {
                secondsToAdd *= Number(timerState.multiplierValue);
            }
            const msToAdd = Math.round(secondsToAdd * 1000);
            timerState.endsAt += msToAdd;
            console.log(`⏱️ Timer extendido +${secondsToAdd.toFixed(2)}s por nuevo seguidor @${uid}`);
            saveTimerToFirestore().catch(() => {});
        }
        
        console.log(`👤 @${uid} (${displayName}) comenzó a seguirte! — enableFollowAlert: ${overlayAlertsConfig.enableFollowAlert}`);

        // Siempre escribir en Firestore — el overlay decide si mostrar según su propia config
        if (db) {
            try {
                let msgTemplate = String(overlayAlertsConfig.followsAlertMsg || "¡gracias por seguir el canal! 👤");
                let customMsg = msgTemplate.replace(/{user}/g, displayName);

                await addDoc(collection(db, 'notifications'), {
                    type: 'follow',
                    user: displayName,
                    uniqueId: uid,
                    profilePic: profilePic || '',
                    message: customMsg,
                    timestamp: serverTimestamp()
                });
                console.log(`✅ Notificación de follow guardada para @${uid}`);
            } catch (e) {
                console.error('Error guardando notificación de follow en Firestore:', e);
            }
        }
    });


    // SUSCRIPTORES (SUBSCRIBE)
    tiktokLiveConnection.on('subscribe', async (data) => {
        handleSubscription(data);
    });

    // ─── COMPARTIDOS (SHARE) ───────────────────────────────────────────────────
    tiktokLiveConnection.on('share', async (data) => {
        const displayName = data.nickname || data.uniqueId || 'Usuario';
        const uid = data.uniqueId || '';
        const profilePic = data.profilePictureUrl || '';

        // Marcar presencia activa en el live
        markUserPresent(uid);

        // ─── TIMER EXTENSION: compartir live ───
        if (timerState.state === 'running' && timerState.endsAt && Number(timerState.secondsPerShare) > 0) {
            let secondsToAdd = Number(timerState.secondsPerShare);
            if (timerState.multiplierEnabled && Number(timerState.multiplierValue) > 0) {
                secondsToAdd *= Number(timerState.multiplierValue);
            }
            const msToAdd = Math.round(secondsToAdd * 1000);
            timerState.endsAt += msToAdd;
            console.log(`⏱️ Timer extendido +${secondsToAdd.toFixed(2)}s por compartir live @${uid}`);
            saveTimerToFirestore().catch(() => {});
        }

        // Acumular en contador de sesión para metas
        sessionShares.set(uid, (sessionShares.get(uid) || 0) + 1);
        const totalShares = Array.from(sessionShares.values()).reduce((a, b) => a + b, 0);

        console.log(`📤 @${uid} compartió el live! (Total sesión: ${totalShares})`);

        // Guardar notificación
        if (db) {
            try {
                await addDoc(collection(db, 'notifications'), {
                    type: 'share',
                    user: displayName,
                    uniqueId: uid,
                    profilePic,
                    message: `¡${displayName} compartió el live! 📤`,
                    timestamp: serverTimestamp()
                });
            } catch (e) {
                console.error('Error guardando notificación de share:', e);
            }
        }

        // Actualizar contadores en Firestore para goals
        syncSessionCountersToFirestore();
    });
}

// --- BUFFER DE LIKES ---
const likeBuffer = new Map();
// Tracking de sesión para Top Liker
const sessionLikes = new Map();
const sessionLikerDetails = new Map();
// ⚡ CLAVE: likeCount en WebcastLikeMessage es ACUMULATIVO por usuario en la sesión.
// Hay que guardar el último valor visto por usuario para calcular el delta real.
// Así es exactamente como lo hace TikFinity.
const lastLikeCountMap = new Map(); // uid -> último likeCount acumulado reportado por TikTok
const lastLikeTimeMap = new Map();
// Tracking de hitos de alerta ya disparados (uid -> último hito alertado)
const lastLikeAlertMilestone = new Map();
let currentTopLiker = { name: 'N/D', count: 0 };
let activeLiveRoomId = null;
// ⚡ TOTAL LIKE COUNT GLOBAL: contador real del stream (vía totalLikeCount)
let lastKnownTotalLikeCount = 0;
let streamTotalLikesCounter = 0;
let likesGoalStartOffset = null; // offset para contar likes acumulados en la meta sin pérdidas por throttling

// ─── PRESENCIA EN EL LIVE ─────────────────────────────────────────────────────
// Mapa de uid -> timestamp de la última vez que TikTok envió actividad del usuario
// (join, like, gift, chat, follow, share). Si supera LIVE_PRESENCE_TTL_MS
// el usuario se considera fuera del live y se excluye del ranking.
const livePresenceMap = new Map(); // uid -> lastSeenTimestamp (ms)
const LIVE_PRESENCE_TTL_MS = 5 * 60 * 1000; // 5 minutos por defecto

function markUserPresent(uid) {
    if (uid) livePresenceMap.set(uid, Date.now());
}

function isUserInLive(uid) {
    if (!uid) return false;
    const last = livePresenceMap.get(uid);
    if (!last) return false; // Nunca visto -> no está (o entró antes del bot)
    const thresholdSec = Number(overlayAlertsConfig && overlayAlertsConfig.topliker_inactivity_threshold) || 90;
    const ttlMs = thresholdSec * 1000;
    return (Date.now() - last) < ttlMs;
}

// ─── CONTADORES DE SESIÓN (para Goal Overlays) ────────────────────────────────
const sessionFollows = new Map(); // uid -> count
const sessionShares  = new Map(); // uid -> count
let sessionTotalCoins = 0;       // coins acumuladas

// Sincronizar contadores de sesión a Firestore (globalStats/general) para que los overlays los lean
let _syncCountersTimeout = null;
function syncSessionCountersToFirestore(immediate = false) {
    if (_syncCountersTimeout) clearTimeout(_syncCountersTimeout);
    
    const runSync = async () => {
        if (!db) return;
        try {
            const totalFollows = Array.from(sessionFollows.values()).reduce((a, b) => a + b, 0);
            const totalShares  = Array.from(sessionShares.values()).reduce((a, b) => a + b, 0);
            // Usar total likes del stream con offset para evitar pérdida de conteos por throttling de TikTok
            const totalLikes = likesGoalStartOffset !== null 
                ? Math.max(0, streamTotalLikesCounter - likesGoalStartOffset) 
                : Array.from(sessionLikes.values()).reduce((a, b) => a + b, 0);
            await setDoc(doc(db, 'globalStats', 'general'), {
                sessionFollows: totalFollows,
                sessionShares:  totalShares,
                sessionLikes:   totalLikes,
                streamTotalLikes: streamTotalLikesCounter,
                likesGoalStartOffset: likesGoalStartOffset, // Guardar offset para persistencia tras reinicios
                sessionCoins:   sessionTotalCoins,
                lastUpdate:     serverTimestamp()
            }, { merge: true });
        } catch (e) {
            console.error('Error sincronizando contadores de sesión:', e);
        }
    };

    if (immediate) {
        runSync();
    } else {
        _syncCountersTimeout = setTimeout(runSync, 2000);
    }
}

// Sincronizar total de likes desde la API de TikTok para corregir lags del websocket
async function syncRoomLikesFromApi() {
    try {
        if (!tiktokLiveConnection || !tiktokLiveConnection.isConnected) return;
        const roomInfo = await tiktokLiveConnection.fetchRoomInfo();
        if (roomInfo && roomInfo.stats) {
            const realTotalLikes = Number(roomInfo.stats.likeCount || roomInfo.stats.like_count || 0);
            if (realTotalLikes > streamTotalLikesCounter) {
                console.log(`📊 [Room Stats Sync] Sincronizando likes de sala desde API: ${streamTotalLikesCounter} → ${realTotalLikes}`);
                
                // Si el offset no ha sido inicializado, este es el momento
                if (likesGoalStartOffset === null) {
                    const currentSessionLikes = Array.from(sessionLikes.values()).reduce((a, b) => a + b, 0);
                    likesGoalStartOffset = Math.max(0, realTotalLikes - currentSessionLikes);
                    console.log(`📊 [Room Stats Sync] Offset inicializado desde API: ${likesGoalStartOffset}`);
                }
                
                streamTotalLikesCounter = realTotalLikes;
                lastKnownTotalLikeCount = realTotalLikes;
                syncSessionCountersToFirestore(true);
            }
        }
    } catch (e) {
        console.warn('⚠️ Error sincronizando estadísticas de sala desde API:', e.message || e);
    }
}

// ─── TIMER EN MEMORIA ─────────────────────────────────────────────────────────
let timerState = {
    state: 'stopped', // 'running' | 'paused' | 'stopped'
    endsAt: null,     // timestamp (ms) cuando termina el timer
    pausedAt: null,   // timestamp (ms) de cuándo se pausó
    remainingOnPause: 0, // ms restantes al momento de pausar
    label: '⏳ Tiempo de stream',
    primaryColor: '#7c3aed',
    secondsPerGift: 30,
    secondsPerCoin: 0,
    secondsPerFollow: 0,
    secondsPerLike: 0,
    secondsPerSubscribe: 300,
    secondsPerShare: 0,
    secondsPerChatMessage: 0,
    multiplierEnabled: false,
    multiplierValue: 1.5,
    actionOnExpiry: '-',
    timerOpacity: 0.85,
    timerRadius: 22,
    timerFontSize: 14,
    timerTheme: 'neon',
    timerWidth: 300,
    timerHeight: 135,
    progressHeight: 3,
    showProgressBar: true,
    showMeta: true,
    showLabel: true
};

async function loadTimerFromFirestore() {
    if (!db) return;
    try {
        const docRef = doc(db, 'systemConfig', 'timerConfig');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Re-mapear campos a timerState
            if (data.state !== undefined) {
                if (data.state === 'running' && data.endsAt) {
                    const ms = data.endsAt.toMillis ? data.endsAt.toMillis()
                             : data.endsAt.seconds  ? data.endsAt.seconds * 1000
                             : Number(data.endsAt);
                    const remaining = ms - Date.now();
                    if (remaining > 0) {
                        timerState.state = 'running';
                        timerState.endsAt = Date.now() + remaining;
                        timerState.remainingOnPause = 0;
                    } else {
                        timerState.state = 'stopped';
                        timerState.endsAt = null;
                        timerState.remainingOnPause = 0;
                    }
                } else if (data.state === 'paused') {
                    timerState.state = 'paused';
                    timerState.remainingOnPause = Number(data.remainingOnPause) || 0;
                    timerState.pausedAt = data.pausedAt ? (data.pausedAt.seconds ? data.pausedAt.seconds * 1000 : Number(data.pausedAt)) : Date.now();
                    timerState.endsAt = null;
                } else {
                    timerState.state = 'stopped';
                    timerState.endsAt = null;
                    timerState.remainingOnPause = 0;
                }
            }
            
            if (data.label !== undefined) timerState.label = data.label;
            if (data.primaryColor !== undefined) timerState.primaryColor = data.primaryColor;
            if (data.secondsPerGift !== undefined) timerState.secondsPerGift = data.secondsPerGift;
            if (data.secondsPerCoin !== undefined) timerState.secondsPerCoin = data.secondsPerCoin;
            if (data.secondsPerFollow !== undefined) timerState.secondsPerFollow = data.secondsPerFollow;
            if (data.secondsPerLike !== undefined) timerState.secondsPerLike = data.secondsPerLike;
            if (data.secondsPerSubscribe !== undefined) timerState.secondsPerSubscribe = data.secondsPerSubscribe;
            if (data.secondsPerShare !== undefined) timerState.secondsPerShare = data.secondsPerShare;
            if (data.secondsPerChatMessage !== undefined) timerState.secondsPerChatMessage = data.secondsPerChatMessage;
            if (data.multiplierEnabled !== undefined) timerState.multiplierEnabled = data.multiplierEnabled;
            if (data.multiplierValue !== undefined) timerState.multiplierValue = data.multiplierValue;
            if (data.actionOnExpiry !== undefined) timerState.actionOnExpiry = data.actionOnExpiry;
            if (data.timerOpacity !== undefined) timerState.timerOpacity = data.timerOpacity;
            if (data.timerRadius !== undefined) timerState.timerRadius = data.timerRadius;
            if (data.timerFontSize !== undefined) timerState.timerFontSize = data.timerFontSize;
            if (data.timerTheme !== undefined) timerState.timerTheme = data.timerTheme;
            if (data.timerWidth !== undefined) timerState.timerWidth = data.timerWidth;
            if (data.timerHeight !== undefined) timerState.timerHeight = data.timerHeight;
            if (data.progressHeight !== undefined) timerState.progressHeight = data.progressHeight;
            if (data.showProgressBar !== undefined) timerState.showProgressBar = data.showProgressBar;
            if (data.showMeta !== undefined) timerState.showMeta = data.showMeta;
            if (data.showLabel !== undefined) timerState.showLabel = data.showLabel;
            
            console.log(`⏰ Timer cargado de Firestore con éxito. Estado: ${timerState.state}, Restante en pausa: ${Math.round(timerState.remainingOnPause / 1000)}s`);
        }
    } catch (e) {
        console.error('Error cargando timer de Firestore en el bot:', e);
    }
}

async function saveTimerToFirestore() {
    if (!db) return;
    try {
        await setDoc(doc(db, 'systemConfig', 'timerConfig'), {
            state:            timerState.state,
            endsAt:           timerState.endsAt,
            label:            timerState.label,
            primaryColor:     timerState.primaryColor,
            secondsPerGift:   timerState.secondsPerGift,
            secondsPerCoin:   timerState.secondsPerCoin !== undefined ? timerState.secondsPerCoin : 0,
            secondsPerFollow: timerState.secondsPerFollow !== undefined ? timerState.secondsPerFollow : 0,
            secondsPerLike:   timerState.secondsPerLike !== undefined ? timerState.secondsPerLike : 0,
            secondsPerSubscribe: timerState.secondsPerSubscribe !== undefined ? timerState.secondsPerSubscribe : 300,
            secondsPerShare:  timerState.secondsPerShare !== undefined ? timerState.secondsPerShare : 0,
            secondsPerChatMessage: timerState.secondsPerChatMessage !== undefined ? timerState.secondsPerChatMessage : 0,
            multiplierEnabled: timerState.multiplierEnabled !== undefined ? timerState.multiplierEnabled : false,
            multiplierValue:  timerState.multiplierValue !== undefined ? timerState.multiplierValue : 1.5,
            actionOnExpiry:   timerState.actionOnExpiry || '-',
            timerOpacity:     timerState.timerOpacity !== undefined ? timerState.timerOpacity : 0.85,
            timerRadius:      timerState.timerRadius !== undefined ? timerState.timerRadius : 22,
            timerFontSize:    timerState.timerFontSize !== undefined ? timerState.timerFontSize : 14,
            timerTheme:       timerState.theme || timerState.timerTheme || 'neon',
            timerWidth:       timerState.timerWidth !== undefined ? timerState.timerWidth : 300,
            timerHeight:      timerState.timerHeight !== undefined ? timerState.timerHeight : 135,
            progressHeight:   timerState.progressHeight !== undefined ? timerState.progressHeight : 3,
            showProgressBar:  timerState.showProgressBar !== undefined ? timerState.showProgressBar : true,
            showMeta:         timerState.showMeta !== undefined ? timerState.showMeta : true,
            showLabel:        timerState.showLabel !== undefined ? timerState.showLabel : true,
            updatedAt:        serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error('Error guardando timer en Firestore:', e);
    }
}

function resetLikeTracking(options = {}) {
    const resetSession = options.resetSession === true;
    const resetTopLiker = options.resetTopLiker === true;
    const isNewRoom = options.isNewRoom === true;
    try { likeBuffer.clear(); } catch (_) {}
    if (resetSession) {
        try { sessionLikes.clear(); } catch (_) {}
        try { lastLikeAlertMilestone.clear(); } catch (_) {}
        if (isNewRoom) {
            try { lastLikeCountMap.clear(); } catch (_) {}
            try { lastLikeTimeMap.clear(); } catch (_) {}
            // ⚡ Resetear contadores de totalLikeCount al iniciar nuevo live
            lastKnownTotalLikeCount = 0;
            streamTotalLikesCounter = 0;
            likesGoalStartOffset = null;
            console.log('🔄 Contadores de likes globales reseteados para nuevo live.');
        }
    }
    if (resetTopLiker) {
        currentTopLiker = { name: 'N/D', count: 0 };
    }
}

async function updateGlobalTopLiker(name, count) {
    try {
        if (!db) return;
        // FIX: Asegurar que count sea número
        const safeCount = Number(count) || 0;
        await setDoc(doc(db, 'globalStats', 'general'), {
            sessionTopLiker: name,
            sessionTopLikerCount: safeCount,
            lastUpdate: serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error('Error actualizando Top Liker:', e);
    }
}

// Flush periódico de likes (cada 30 segundos para dar tiempo a acumular)
setInterval(async () => {
    // Asegurar que insignias y alias estén frescos
    try { await ensureBadgeSetsFresh(); } catch (_) {}
    
    if (likeBuffer.size === 0) return;

    console.log(`❤️ Procesando buffer de likes (${likeBuffer.size} usuarios)...`);
    
    // Copiar y limpiar buffer
    const entries = Array.from(likeBuffer.entries());
    likeBuffer.clear(); 

    for (const [uid, data] of entries) {
        try {
            // Resolver usuario canónico
            const resolved = await getCanonicalUserKey(data.userId, data.displayName);
            const userKey = resolved.userKey || uid; 
            const finalName = resolved.displayName || data.displayName;

            // Calcular puntos usando la configuración real del bot.
            // Esto evita inconsistencias entre la UI, el bot y los documentos en Firestore.
            const configuredLikesPerPoint = Number(config && config.likesPerPoint);
            const LIKES_PER_POINT = Number.isFinite(configuredLikesPerPoint) && configuredLikesPerPoint > 0
                ? configuredLikesPerPoint
                : 300;
            const totalLikesInBatch = data.likes;
            
            // --- RESTAURADO: Cálculo de puntos ACUMULATIVO ---
            // Se calcula sobre el TOTAL histórico de likes del usuario.
            // Si envía 150 likes ahora y 150 después, suman 300 y gana 1 punto.
            const userRef = doc(db, 'userStats', userKey);
            const userSnap = await getDoc(userRef);
            let currentTotalLikes = 0;
            let currentTotalLikesPoints = 0;
            let userData = {};
            
            if (userSnap.exists()) {
                userData = userSnap.data() || {};
                currentTotalLikes = userData.totalLikes || 0;
                currentTotalLikesPoints = userData.totalLikesPoints || 0;
            }

            const newTotalLikes = currentTotalLikes + totalLikesInBatch;
            
            // Calcular cuántos puntos *debería* tener en total basándose en los likes históricos
            const expectedTotalPoints = Math.floor(newTotalLikes / LIKES_PER_POINT);
            
            // Los puntos a añadir son la diferencia entre lo que debería tener y lo que ya se le dio
            const pointsToAdd = expectedTotalPoints - currentTotalLikesPoints;
            
            // Datos a actualizar
            const updateData = {
                totalLikes: increment(totalLikesInBatch), 
                lastLikeActivity: serverTimestamp(),
                displayName: finalName,
                likesPerPoint: LIKES_PER_POINT 
            };

            // Guardar likes específicos de la sesión actual
            const currentRoomId = activeLiveRoomId || 'no_active_room';
            const userSessionId = userData.sessionId || '';
            if (userSessionId !== currentRoomId) {
                updateData.sessionLikes = totalLikesInBatch;
                updateData.sessionId = currentRoomId;
            } else {
                updateData.sessionLikes = increment(totalLikesInBatch);
            }

            // Solo sumar puntos y registrar puntos de likes si ganó nuevos puntos
            if (pointsToAdd > 0) {
                updateData.totalPoints = increment(pointsToAdd);
                updateData.totalLikesPoints = increment(pointsToAdd); 
                
                console.log(`✨ @${finalName} ganó ${pointsToAdd} puntos! (Total Likes: ${newTotalLikes})`);
                
                // Notificar visualmente
                await addDoc(collection(db, 'notifications'), {
                    type: 'points_like',
                    user: finalName,
                    points: pointsToAdd,
                    message: `+${pointsToAdd} pts por likes ❤️`,
                    timestamp: serverTimestamp()
                });
            } else {
                // Solo log si hubo muchos likes pero no alcanzaron para punto
                if (totalLikesInBatch > 50) {
                   console.log(`❤️ @${finalName} envió ${totalLikesInBatch} likes (Acumulados: ${newTotalLikes}, Faltan ${LIKES_PER_POINT - (newTotalLikes % LIKES_PER_POINT)} para el siguiente punto)`);
                }
            }

            await setDoc(userRef, updateData, { merge: true });

            // ─── ALERTA DE HITOS ACUMULADOS ───────────────────────────────────────
            // Dispara cuando el TOTAL ACUMULADO de sesión cruza un múltiplo del umbral
            // Ejemplo con umbral=100: dispara en 100, 200, 300, 400...
            const milestoneStep = Number(overlayAlertsConfig.minLikesAlert) || 100;
            const sessionTotal = sessionLikes.get(uid) || totalLikesInBatch;
            const currentMilestone = Math.floor(sessionTotal / milestoneStep) * milestoneStep;
            const lastMilestone = lastLikeAlertMilestone.get(uid) || 0;

            if (currentMilestone > lastMilestone && currentMilestone > 0 && db) {
                lastLikeAlertMilestone.set(uid, currentMilestone);
                try {
                    let msgTemplate = String(overlayAlertsConfig.likesAlertMsg || "¡{user} ya lleva {total} likes esta noche! ❤️");
                    let customMsg = msgTemplate
                        .replace(/{user}/g, finalName)
                        .replace(/{likes}/g, totalLikesInBatch.toLocaleString())
                        .replace(/{total}/g, sessionTotal.toLocaleString())
                        .replace(/{milestone}/g, currentMilestone.toLocaleString());

                    await addDoc(collection(db, 'notifications'), {
                        type: 'like',
                        user: finalName,
                        uniqueId: uid,
                        likes: totalLikesInBatch,
                        sessionTotal: sessionTotal,
                        milestone: currentMilestone,
                        message: customMsg,
                        profilePic: data.profilePic || '',
                        timestamp: serverTimestamp()
                    });
                    console.log(`📣 Alerta de hito: @${finalName} alcanzó ${currentMilestone} likes (total sesión: ${sessionTotal})`);
                } catch (e) {
                    console.error('Error guardando notificación de likes en Firestore:', e);
                }
            }

        } catch (e) {
            console.error(`Error procesando likes para ${data.displayName}:`, e);
        }
    }
    
    try {
        await recalculateLikerRanks();
    } catch (err) {
        console.error('Error recalculando ranking de likes en buffer:', err);
    }

    // Sincronizar contadores de sesión a Firestore (actualiza sessionLikes en globalStats/general)
    try {
        syncSessionCountersToFirestore(true);
    } catch (err) {
        console.error('Error sincronizando contadores de likes al final del buffer:', err);
    }
}, 5000); // 5 segundos (más interactivo/en tiempo real)

async function recalculateLikerRanks() {
    if (!db) return;
    try {
        const { doc, setDoc, serverTimestamp } = require('firebase/firestore');

        // Mantener el ranking completo de la sesión sin excluir por inactividad
        const sorted = Array.from(sessionLikes.entries())
            .sort((a, b) => b[1] - a[1]);

        const list = sorted.slice(0, 20).map(([uid, amount]) => {
            const details = sessionLikerDetails.get(uid) || { username: uid, nickname: uid, profilePictureUrl: '', lastActive: Date.now() };
            return {
                username: uid,
                nickname: details.nickname || uid,
                profilePictureUrl: details.profilePictureUrl || '',
                totalAmount: amount,
                lastActive: details.lastActive || Date.now()
            };
        });

        await setDoc(doc(db, 'globalStats', 'topLikers'), {
            list: list,
            streamTotalLikes: streamTotalLikesCounter, // ⚡ total real del stream (incluyendo likes sin uniqueId)
            lastUpdate: serverTimestamp()
        }, { merge: true });
        console.log(`💾 Top Likers actualizados en Firestore (${list.length} en live). Total stream: ${streamTotalLikesCounter} likes.`);
    } catch (e) {
        console.error('❌ Error al guardar Top Likers en Firestore:', e);
    }
}

// Mapa de donaciones de la sesión
const sessionDonations = new Map();
const sessionGifterDetails = new Map();

// Rangos de donadores (Top 3)
let donorRanks = {
    gold: null,   // { user, amount }
    silver: null,
    bronze: null
};

function resetDonationTracking() {
    try {
        sessionDonations.clear();
        sessionGifterDetails.clear();
        sessionLikes.clear();
        sessionLikerDetails.clear();
        livePresenceMap.clear();
        if (db) {
            const { doc, setDoc } = require('firebase/firestore');
            setDoc(doc(db, 'globalStats', 'topGifters'), {
                list: [],
                lastUpdate: new Date()
            }, { merge: true }).catch(() => {});

            setDoc(doc(db, 'globalStats', 'topLikers'), {
                list: [],
                lastUpdate: new Date()
            }, { merge: true }).catch(() => {});
        }
        console.log('🔄 Tracking de donadores, likes y presencia reiniciado.');
    } catch (_) {}
}

async function recalculateDonorRanks() {
    // Mantener el ranking completo de la sesión sin excluir por inactividad
    const sorted = Array.from(sessionDonations.entries())
        .sort((a, b) => b[1] - a[1]);

    donorRanks = {
        gold: sorted[0] ? { user: sorted[0][0], amount: sorted[0][1] } : null,
        silver: sorted[1] ? { user: sorted[1][0], amount: sorted[1][1] } : null,
        bronze: sorted[2] ? { user: sorted[2][0], amount: sorted[2][1] } : null
    };

    console.log(`🏆 Ranking Donadores (${sorted.length} en live):`, donorRanks);

    // Guardar ranking completo de la sesión en Firestore
    if (db) {
        try {
            const { doc, setDoc, serverTimestamp } = require('firebase/firestore');
            const list = sorted.slice(0, 20).map(([uid, amount]) => {
                const details = sessionGifterDetails.get(uid) || { username: uid, nickname: uid, profilePictureUrl: '' };
                return {
                    username: uid,
                    nickname: details.nickname || uid,
                    profilePictureUrl: details.profilePictureUrl || '',
                    totalAmount: amount
                };
            });

            await setDoc(doc(db, 'globalStats', 'topGifters'), {
                list: list,
                lastUpdate: serverTimestamp()
            }, { merge: true });
            console.log(`💾 Top Gifters actualizados en Firestore (${list.length} en live).`);
        } catch (e) {
            console.error('❌ Error al guardar Top Gifters en Firestore:', e);
        }
    }
}

// Conectar al Live
async function connectToLive() {
    if (manualDisconnect) {
        console.log('⏹️ Conexión abortada: Desconexión manual activa.');
        isRetrying = false;
        return;
    }
    if (isConnecting) return;
    isConnecting = true;
    isRetrying = false;

    if (tiktokLiveConnection && tiktokLiveConnection.isConnected) {
         isConnecting = false;
         lastConnectionError = '';
         return;
    }

    console.log(`🔎 Buscando Live de @${TIKTOK_USERNAME}...`);

    tiktokLiveConnection.connect()
        .then(state => {
            console.log(`✅ Conectado al Live de ${state.roomId}!`);
            isConnecting = false;
            isRetrying = false;
            lastConnectionError = '';
        })
        .catch(err => {
            const msg = String(err && err.message ? err.message : err);
            isConnecting = false;

            if (msg.includes('Unexpected server response: 200') || msg.includes('400')) {
                const errMsg = '❌ Error 400/200: TikTok rechazó la conexión. Puede que no estés en LIVE o que TikTok detecte actividad inusual. Verifica que tu sesión esté activa.';
                lastConnectionError = errMsg;
                console.error(errMsg);
            } else if (msg.toLowerCase().includes('live') || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('no live')) {
                const errMsg = `❌ No se encontró live activo para @${TIKTOK_USERNAME}. Asegúrate de estar en live antes de conectar.`;
                lastConnectionError = errMsg;
                console.warn(errMsg);
            } else {
                lastConnectionError = `❌ Error al conectar: ${msg}`;
                console.error('❌ Error al conectar:', msg);
            }

            if (!manualDisconnect) {
                console.log('🔄 Reintentando en 10 segundos...');
                isRetrying = true;
                retryTimeoutEnd = Date.now() + 10000;
                if (retryTimeoutId) clearTimeout(retryTimeoutId);
                retryTimeoutId = setTimeout(() => {
                    if (manualDisconnect) {
                        isRetrying = false;
                        return;
                    }
                    isRetrying = false;
                    tiktokConnectionOptions = buildTikTokConnectionOptions();
                    try { if (tiktokLiveConnection) tiktokLiveConnection.disconnect(); } catch (_) {}
                    tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USERNAME, tiktokConnectionOptions);
                    setupListeners();
                    connectToLive();
                }, 10000);
            } else {
                isRetrying = false;
                console.log('⏹️ Desconexión manual activa. No se reintentará conexión.');
            }
        });
}

// Lista de usuarios temporales
const tempVipUsers = new Set();

// Variables globales para Lector Chat (TTS)
const ttsLogs = [];
const ttsCooldowns = new Map();
let activeTtsQueue = [];

// Manejar pedido de canción
async function resolveTrackFromQuery(query) {
    // 1. Buscar en iTunes
    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=15`;
    const response = await axios.get(searchUrl);
    if (!response.data || response.data.resultCount === 0) {
        return null;
    }

    const results = response.data.results;
    const avoidKeywords = ['karaoke', 'tribute', 'cover', 'instrumental', 'remix', 'lullaby', 'rendition', 'slowed', 'reverb'];
    
    // 2. Filtrar resultados "malos" (covers, karaoke, etc.)
    const validResults = results.filter(t => {
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

    // Si no hay resultados válidos, usamos los originales (mejor algo que nada)
    const candidates = validResults.length > 0 ? validResults : results;

    // 3. Sistema de Puntuación (Scoring) para encontrar el mejor match
    // Dividimos el query en palabras clave
    const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9áéíóúñü ]/g, '');
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 1);
    
    let bestTrack = null;
    let maxScore = -1;

    for (const t of candidates) {
        const tName = (t.trackName || '').toLowerCase();
        const tArtist = (t.artistName || '').toLowerCase();
        // Normalizamos el texto del track para buscar coincidencias
        const fullText = `${tName} ${tArtist}`.replace(/[^a-z0-9áéíóúñü ]/g, '');
        
        let score = 0;
        
        // Puntos por cada palabra del query encontrada en el resultado
        for (const w of queryWords) {
            if (fullText.includes(w)) score += 1;
        }

        // Puntos extra si el Artista coincide exactamente con una parte del query
        if (normalizedQuery.includes(tArtist)) score += 3;
        
        // Puntos extra si el Track coincide exactamente
        if (normalizedQuery.includes(tName)) score += 3;

        // Puntos extra por coincidencia EXACTA de Artista - Cancion (o viceversa)
        const combinedA = `${tArtist} ${tName}`.replace(/[^a-z0-9áéíóúñü ]/g, '');
        const combinedB = `${tName} ${tArtist}`.replace(/[^a-z0-9áéíóúñü ]/g, '');
        if (normalizedQuery.includes(combinedA) || normalizedQuery.includes(combinedB)) score += 5;

        if (score > maxScore) {
            maxScore = score;
            bestTrack = t;
        }
    }

    // UMBRAL DE CALIDAD: Si el score es muy bajo, asumimos que no es lo que el usuario pidió
    // (Ej: Usuario pide "Bad Bunny Monaco" y iTunes devuelve "Monaco" de otro artista random con score 1)
    if (maxScore < 2 && queryWords.length > 1) {
        console.log(`⚠️ Low match score (${maxScore}) for "${query}". Falling back to raw input.`);
        return null; // Esto activará el fallback a parseRawQueryToTrack
    }

    const track = bestTrack || candidates[0];

    const songName = track.trackName;
    const artistName = track.artistName;
    const artworkUrl = String(track.artworkUrl100 || '').replace('100x100', '600x600');
    const appleMusicId = track.trackId;
    const trackViewUrl = track.trackViewUrl || '';
    const genre = track.primaryGenreName || ''; // Extract Genre

    if (!songName || !artistName || !appleMusicId) {
        return null;
    }
    return { songName, artistName, artworkUrl, appleMusicId: String(appleMusicId), trackViewUrl, genre };
}

function parseRawQueryToTrack(rawQuery) {
    const raw = String(rawQuery || '').trim();
    if (!raw) return null;
    const candidates = [
        ' - ',
        ' — ',
        ' – ',
        ' —',
        '–',
        '—'
    ];
    let parts = null;
    for (let i = 0; i < candidates.length; i++) {
        const sep = candidates[i];
        if (raw.includes(sep)) {
            const p = raw.split(sep).map(s => String(s || '').trim()).filter(Boolean);
            if (p.length >= 2) { parts = p; break; }
        }
    }
    if (!parts) return { songName: raw, artistName: '', artworkUrl: '', appleMusicId: '', trackViewUrl: '', genre: '' };
    const artistName = parts[0] || '';
    const songName = parts.slice(1).join(' - ').trim();
    return { songName: songName || raw, artistName, artworkUrl: '', appleMusicId: '', trackViewUrl: '', genre: '' };
}

async function resolveTrackFromSeparatedRaw(rawQuery) {
    const raw = String(rawQuery || '').trim();
    if (!raw) return null;
    const seps = [' - ', ' — ', ' – ', '—', '–', '-'];
    let parts = null;
    for (let i = 0; i < seps.length; i++) {
        const sep = seps[i];
        if (raw.includes(sep)) {
            const p = raw.split(sep).map(s => String(s || '').trim()).filter(Boolean);
            if (p.length >= 2) { parts = p; break; }
        }
    }
    if (!parts) return null;
    const a = parts[0];
    const b = parts.slice(1).join(' ').trim();
    if (!a || !b) return null;
    try {
        const r1 = await resolveTrackFromQuery(`${a} ${b}`);
        if (r1) return r1;
    } catch (_) {}
    try {
        const r2 = await resolveTrackFromQuery(`${b} ${a}`);
        if (r2) return r2;
    } catch (_) {}
    return null;
}

async function handleSongRequest(user, query, options = {}) {
    try {
        const sendToQueue = options.sendToQueue !== false;
        const sendToCider = options.sendToCider !== false;
        const isTest = !!options.isTest;
        const source = options.source ? String(options.source) : '';
        const userId = options.userId ? String(options.userId).trim() : '';
        const displayName = options.displayName ? String(options.displayName).trim() : '';
        const rawQuery = options.rawQuery ? String(options.rawQuery).trim() : '';
        try { await ensureBadgeSetsFresh(); } catch (_) {}
        try { await firebaseAuthPromise; } catch (_) {}

        // --- DETECTAR Y PROCESAR ENLACE DE YOUTUBE ---
        const ytUrl = detectYoutubeUrl(query || rawQuery);
        if (ytUrl) {
            // Verificar si el candado de YouTube por likes está habilitado (desactivado por defecto)
            const isLockEnabled = overlayAlertsConfig.enableLikesYoutubeLock === true;
            if (isLockEnabled) {
                const targetLikes = Number(overlayAlertsConfig.likesTargetForYoutubeLink) || 999;
                
                // Calcular total likes de sesión de forma unificada y precisa (evita el desfase por throttling de usuarios)
                const totalSessionLikes = likesGoalStartOffset !== null 
                    ? Math.max(0, streamTotalLikesCounter - likesGoalStartOffset) 
                    : Array.from(sessionLikes.values()).reduce((a, b) => a + b, 0);

                if (totalSessionLikes < targetLikes) {
                    const missingLikes = targetLikes - totalSessionLikes;
                    console.log(`🔒 Petición con enlace de YouTube bloqueada: Faltan ${missingLikes} likes (llevamos ${totalSessionLikes}/${targetLikes})`);
                    
                    if (db && typeof addDoc === 'function' && typeof collection === 'function') {
                        try {
                            const rawMsg = overlayAlertsConfig.likesLockAlertMsg || "🔒 Enlaces bloqueados: Faltan {faltan} likes en el Live (llevamos {llevamos}/{meta}) ❤️";
                            const formattedMsg = rawMsg
                                .replace(/{faltan}/g, missingLikes)
                                .replace(/{llevamos}/g, totalSessionLikes)
                                .replace(/{meta}/g, targetLikes);

                            await addDoc(collection(db, 'notifications'), {
                                type: 'like',
                                user: displayName || user || 'Zero FM',
                                message: formattedMsg,
                                timestamp: serverTimestamp()
                            });
                        } catch (e) {
                            console.error('Error guardando notificación de likes bloqueados:', e);
                        }
                    }
                    
                    return { ok: false, error: `Meta de enlaces bloqueada: faltan ${missingLikes} likes` };
                }
            }

            options.link = ytUrl;
            const ytMetadata = await extractYoutubeMetadata(ytUrl);
            if (ytMetadata) {
                options.songName = ytMetadata.title;
                options.artistName = ytMetadata.artist;
                options.artworkUrl = ytMetadata.artworkUrl;
                console.log(`✅ Metadatos extraídos de YouTube para bot: "${ytMetadata.title}" por "${ytMetadata.artist}", portada: "${ytMetadata.artworkUrl}"`);
            } else {
                const cleanTextQuery = String(query || '').replace(ytUrl, '').trim().replace(/\s+-\s+/g, ' ').trim();
                if (cleanTextQuery.length > 0) {
                    const parsedFallback = parseRawQueryToTrack(cleanTextQuery);
                    if (parsedFallback && parsedFallback.songName) {
                        options.songName = parsedFallback.songName;
                        options.artistName = parsedFallback.artistName || "Desconocido";
                    } else {
                        options.songName = cleanTextQuery;
                        options.artistName = "Desconocido";
                    }
                } else {
                    options.songName = "Video de YouTube";
                    options.artistName = "Ver Enlace";
                }
                console.warn(`⚠️ No se pudieron extraer metadatos de YouTube. Usando fallback: "${options.songName}" - "${options.artistName}"`);
            }
        }

        let resolved = null;
        const overrideSong = String(options.songName || '').trim();
        const overrideArtist = String(options.artistName || '').trim();
        const overrideArtwork = String(options.artworkUrl || '').trim();
        const overrideId = options.appleMusicId ? String(options.appleMusicId).trim() : '';
        const hasManualTrack = !!(overrideSong && overrideArtist);
        if (hasManualTrack) {
            resolved = {
                songName: overrideSong,
                artistName: overrideArtist,
                artworkUrl: overrideArtwork,
                appleMusicId: overrideId,
                trackViewUrl: ''
            };
            if (sendToCider && !resolved.appleMusicId) {
                try {
                    const idLookup = await resolveTrackFromQuery(`${overrideSong} ${overrideArtist}`);
                    if (idLookup && idLookup.appleMusicId) {
                        resolved.appleMusicId = idLookup.appleMusicId;
                        resolved.trackViewUrl = idLookup.trackViewUrl || '';
                        if (!resolved.artworkUrl) resolved.artworkUrl = idLookup.artworkUrl || '';
                    }
                } catch (_) {}
            }
        } else if (overrideId) {
            resolved = {
                songName: String(query || '').trim() || 'Sin título',
                artistName: overrideArtist,
                artworkUrl: overrideArtwork,
                appleMusicId: overrideId,
                trackViewUrl: ''
            };
        } else {
            try {
                resolved = await resolveTrackFromQuery(query);
            } catch (_) {
                resolved = null;
            }
        }

        let usedFallback = false;
        if (!resolved) {
            if (rawQuery && rawQuery !== query) {
                try {
                    const sepResolved = await resolveTrackFromSeparatedRaw(rawQuery);
                    if (sepResolved) resolved = sepResolved;
                } catch (_) {}
            }
        }
        if (!resolved) {
            const fallback = parseRawQueryToTrack(rawQuery || query);
            if (fallback) {
                resolved = fallback;
                usedFallback = true;
                console.log(`⚠️ Track no encontrado por búsqueda. Guardando pedido raw: ${rawQuery || query}`);
            } else {
                console.log(`⚠️ No se encontró la canción: ${query}`);
                return { ok: false, error: 'No se encontró track' };
            }
        }

        let songName = String(resolved.songName || '').trim();
        let artistName = String(resolved.artistName || '').trim();

        if (!songName) songName = 'Sin título';
        if (!artistName) artistName = 'Desconocido';

        if (songName.length > 140) {
            songName = songName.substring(0, 137) + '...';
        }
        if (artistName.length > 140) {
            artistName = artistName.substring(0, 137) + '...';
        }

        const artworkUrl = resolved.artworkUrl;
        const appleMusicId = resolved.appleMusicId;
        const trackViewUrl = resolved.trackViewUrl;
        const genre = resolved.genre || '';

        console.log(`🎵 Canción encontrada: ${songName} - ${artistName} (${genre || 'Sin género'})`);

        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const hora = `${hh}:${mm}`;
        const songId = `${user}-${songName}-${artistName}-${hora}`.replace(/[^\p{L}\p{N}-]/gu, '');
        const currentDay = getLocalDateKey();
        const liveCodeEnv = String(process.env.ZEROFM_LIVE_CODE || '').trim();
        const liveCodeStatus = String(await getLiveCodeCached() || '').trim();
        const liveCode = (liveCodeStatus || liveCodeEnv || '').trim();

        const requestData = {
            id: songId,
            usuario: user,
            displayName: displayName || '',
            cancion: songName,
            artista: artistName,
            cover: artworkUrl,
            appleMusicId: appleMusicId || '',
            ts: serverTimestamp(),
            status: 'pending',
            day: currentDay,
            genre: genre,
            liveCode: liveCode || '',
            profilePhoto: options.profilePhoto || '', // NUEVO: Guardar foto de perfil
            link: options.link || ''
        };
        requestData.source = 'tiktok';
        if (source && String(source).trim() && String(source).trim().toLowerCase() !== 'tiktok') {
            requestData.subsource = String(source).trim();
        }
        if (userId) requestData.userId = userId;
        const badge = getBadgeForUser(user, userId, displayName);
        if (badge) requestData.badge = badge;
        console.log(`🏷️ Badge para ${displayName || user} -> ${badge || 'ninguna'}`);
        if (isTest) {
            requestData.isSimulation = true;
            requestData.isTest = true;
            requestData.source = 'test';
        }
        if (usedFallback) requestData.unresolved = true;

        let queueSaved = false;
        let queueDocId = '';
        if (sendToQueue) {
            try {
                // Verificar si ya existe un documento con el mismo id (evita duplicados entre instancias)
                let alreadyExists = false;
                try {
                    const existingQ = queryFn(
                        collectionFn(db, 'solicitudes'),
                        whereFn('id', '==', songId)
                    );
                    const existingSnap = await getDocsFn(existingQ);
                    if (!existingSnap.empty) {
                        alreadyExists = true;
                        queueDocId = existingSnap.docs[0].id;
                        queueSaved = true;
                        console.log(`⚠️ Solicitud duplicada detectada (ya existe id="${songId}"). Ignorando escritura.`);
                    }
                } catch (_) {}

                if (!alreadyExists) {
                    await setDoc(docFn(db, 'solicitudes', songId), requestData);
                    queueSaved = true;
                    queueDocId = songId;
                    console.log(`✅ Agregada a la lista visual`);
                }
            } catch (e) {
                const code = String(e && (e.code || e.status) ? (e.code || e.status) : '').toLowerCase();
                const msg = String(e && e.message ? e.message : e);
                const isPerm = code.includes('permission') || msg.includes('PERMISSION_DENIED');
                if (isPerm) {
                    try {
                        const freshStatus = String(await getLiveCodeCached({ force: true }) || '').trim();
                        const fresh = (freshStatus || liveCodeEnv || '').trim();
                        if (fresh && fresh !== String(requestData.liveCode || '')) {
                            requestData.liveCode = fresh;
                            await setDoc(docFn(db, 'solicitudes', songId), requestData);
                            queueSaved = true;
                            queueDocId = songId;
                            console.log(`✅ Agregada a la lista visual`);
                        } else {
                            console.warn(`🚫 Firestore rechazó escritura (permiso). liveCode usado=${maskLiveCode(requestData.liveCode)} liveCode status=${maskLiveCode(freshStatus)}`);
                        }
                    } catch (_) {}
                }
                throw e;
            }
        }

        let ciderSent = false;
        let ciderQueued = false;
        if (sendToCider) {
            if (ciderSocket && ciderSocket.connected) {
                if (!appleMusicId) {
                    console.warn('⚠️ No se pudo enviar a Cider: falta AppleMusicId (activa búsqueda o provee el ID).');
                } else {
                    try {
                        ciderSocket.emit('safe_pre_add_queue', {
                            artwork: { url: artworkUrl },
                            name: songName,
                            artistName: artistName,
                            requester: displayName || user,
                            requesterId: userId || '',
                            playParams: { id: String(appleMusicId) },
                            url: trackViewUrl,
                            next: true
                        });
                        ciderSocket.emit('playback:queue:add-next', { id: String(appleMusicId) });
                        ciderSent = true;
                        console.log(`🎧 Enviada orden a Cider (ID: ${appleMusicId})`);
                        
                        // Actualizar Firestore con ciderSent = true
                        if (queueDocId) {
                            updateDocFn(docFn(db, 'solicitudes', queueDocId), { ciderSent: true }).catch(() => {});
                        }
                    } catch (e) {
                        console.warn(`⚠️ Error enviando a Cider. Pedido se mantiene en lista.`, e && e.message ? e.message : String(e));
                    }
                }
            } else {
                ciderQueued = true;
                if (!queueSaved) {
                    enqueueCider({ source: source || 'request', user, userId, query, songName, artistName, artworkUrl, appleMusicId, trackViewUrl, queueSaved, docId: queueDocId });
                }
                console.warn(`⚠️ Cider no conectado. Pedido en cola para reintento.`);
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
            ciderSent,
            ciderQueued
        };
    } catch (error) {
        console.error("❌ Error procesando pedido:", error.message);
        return { ok: false, error: error.message || String(error) };
    }
}

function getLocalDateKey() {
    const d = new Date();
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

// Mantener el proceso vivo
process.on('uncaughtException', (err) => {
    console.error('Error no capturado:', err);
});
