
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
    liveHeartbeatInterval = setInterval(() => {
        try { updateLiveStatus(true); } catch (_) {}
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
    setDoc, 
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
updateDoc = updateDocFn;
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
    dashboardPort: 3000,
    ciderUrl: "http://localhost:10767",
    mockCider: false,
    requireVipForSr: false,
    allowPointsCommand: true, // Nuevo: Permitir !puntos
    likesPerPoint: 300, // Configuración por defecto: 300 likes = 1 punto
    commandAliases: ["!zr", "!sr", "!pedir", "!cancion"],
    ignoreExampleQuery: "artista cancion"
};

let overlayAlertsConfig = {
    minLikesAlert: 100,
    likesAlertMsg: "¡Envió {likes} likes! ❤️",
    minCoinsAlert: 1,
    giftsAlertMsg: "¡Gracias por {repeatCount}x {giftName}! 🎁",
    enableFollowAlert: true,
    followsAlertMsg: "¡gracias por seguir el canal! 👤",
    enableSubscribeAlert: true,
    subsAlertMsg: "¡gracias por suscribirte al canal! ⭐"
};

try {
    if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE);
        config = { ...config, ...JSON.parse(raw) };
        console.log("📂 Configuración cargada:", config);
    }
    
    // Cargar credenciales Firebase Web para actualizar estado LIVE
    const fbConfigFile = path.join(__dirname, 'firebase-config.js');
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
let ciderSocket;
let tiktokWebsocketUpgradeEnabled = true;
let tiktokConnectionOptions = null;

function buildTikTokConnectionOptions() {
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
    if (config.sessionId) {
        opts.sessionId = String(config.sessionId).trim();
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
        if (fs.existsSync(path.join(__dirname, 'firebase-config.js'))) {
            firebaseConfig = require('./firebase-config');
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
        } catch (e) {
            console.error("Error en saneamiento automático:", e);
        }
    }, 5000); // Esperar 5s a que la conexión se estabilice

    try { refreshBadgeSets(); } catch (_) {}
    try { setInterval(() => { refreshBadgeSets().catch(() => {}); }, 5 * 60 * 1000); } catch (_) {}

    // --- SERVIDOR WEB (DASHBOARD) ---
    const app = express();
    const PORT = Number(process.env.PORT || config.dashboardPort || 3000) || 3000;

    // CORS Middleware - Permite solicitudes desde file:// locales
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        next();
    });

    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));

    // Endpoint dinámico para servir configuración de Firebase a los overlays
    app.get('/firebase-config.js', (req, res) => {
        const fbConfigFile = path.join(__dirname, 'firebase-config.js');
        res.setHeader('Content-Type', 'application/javascript');
        if (fs.existsSync(fbConfigFile)) {
            try {
                delete require.cache[require.resolve('./firebase-config')];
                const fbConfig = require('./firebase-config');
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
        res.json({
            tiktokUsername: TIKTOK_USERNAME,
            tiktokState: tiktokLiveConnection?.state || 'unknown',
            isConnecting: !!isConnecting,
            ciderConnected: !!(ciderSocket && ciderSocket.connected),
            pendingCider: pendingCiderQueue.length,
            mockCiderActive: !!mockCiderIo,
            mockCiderPort: mockCiderPort || null
        });
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
                const aliases = getSrAliases();
                
                const parsed = parseSrCommand(rawMessage, aliases);
                query = parsed ? parsed.query : rawMessage;
            }
            query = query.replace(/\s+-\s+/g, ' ').trim();
            if (!query && !appleMusicId && !(songName && artistName)) {
                res.status(400).json({ ok: false, error: 'Falta query (búsqueda) o artista+canción' });
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
            res.json({ success: true });
        } catch (e) {
            console.error("Error guardando overlay config:", e);
            res.status(500).json({ error: e.message });
        }
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
        sessionFollows.clear();
        sessionShares.clear();
        sessionLikes.clear();
        sessionTotalCoins = 0;
        syncSessionCountersToFirestore();
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

    // Configurar timer (label, color, secondsPerGift, opacity, radius, fontSize)
    app.post('/api/timer/config', async (req, res) => {
        try {
            const { label, primaryColor, secondsPerGift, timerOpacity, timerRadius, timerFontSize } = req.body || {};
            if (label)          timerState.label          = String(label).trim();
            if (primaryColor)   timerState.primaryColor   = String(primaryColor).trim();
            if (secondsPerGift) timerState.secondsPerGift = Number(secondsPerGift) || 30;
            if (timerOpacity !== undefined)  timerState.timerOpacity  = parseFloat(timerOpacity);
            if (timerRadius !== undefined)   timerState.timerRadius   = parseInt(timerRadius);
            if (timerFontSize !== undefined) timerState.timerFontSize = parseInt(timerFontSize);
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
                    message: likesMsg.replace(/{user}/g, 'SuperLiker').replace(/{likes}/g, likesCount.toLocaleString()),
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
                    message: giftsMsg.replace(/{user}/g, 'GifterRookie').replace(/{giftName}/g, 'TikTok Rose').replace(/{repeatCount}/g, '1').replace(/{coins}/g, '1'),
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
                    message: giftsMsg.replace(/{user}/g, 'VIP_Sponsor').replace(/{giftName}/g, 'TikTok León').replace(/{repeatCount}/g, '1').replace(/{coins}/g, '2999'),
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
      reconnectionAttempts: 5
    });

    ciderSocket.on("connect", () => {
      console.log("✅ Conectado a Cider (Reproductor)");
      try { flushCiderQueue(); } catch (_) {}
    });

    ciderSocket.on("disconnect", () => {
      console.log("❌ Desconectado de Cider");
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
}

startBot();

// Cache para evitar escrituras redundantes de foto de perfil en la misma sesión
const profilePicCache = new Set();

async function updateUserProfilePic(userId, displayName, url) {
    if (!url || !db) return;
    
    // Si ya actualizamos en esta sesión, saltar (ahorro de escrituras)
    if (profilePicCache.has(userId)) return;

    try {
        const { doc, setDoc, serverTimestamp } = require('firebase/firestore');
        const resolved = await getCanonicalUserKey(userId, displayName);
        const key = resolved.userKey || userId;
        
        const userRef = doc(db, 'userStats', key);
        await setDoc(userRef, {
            profilePic: url,
            lastSeen: serverTimestamp(),
            displayName: displayName // Aprovechar para refrescar nombre
        }, { merge: true });
        
        console.log(`📸 Foto de perfil guardada para ${displayName}`);
        profilePicCache.add(userId);
    } catch (e) {
        console.error(`Error actualizando foto de perfil de ${displayName}:`, e);
    }
}

// Configurar Listeners
function setupListeners() {
    tiktokLiveConnection.removeAllListeners();
    
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
            
            // 1. Recuperar Top Likers de sesión
            try {
                const likersRef = docFn(db, 'globalStats', 'topLikers');
                const likersSnap = await getDocFn(likersRef);
                if (likersSnap.exists()) {
                    const list = likersSnap.data().list || [];
                    for (const user of list) {
                        sessionLikes.set(user.username, user.totalAmount);
                        lastLikeCountMap.set(user.username, user.totalAmount);
                        sessionLikerDetails.set(user.username, {
                            username: user.username,
                            nickname: user.nickname,
                            profilePictureUrl: user.profilePictureUrl
                        });
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
                    }
                    console.log(`🟢 Recuperados ${list.length} Top Gifters de sesión.`);
                }
            } catch (e) {
                console.error('⚠️ Error recuperando topGifters de sesión:', e);
            }

            resetLikeTracking({ resetSession: false, resetTopLiker: false });
        } else {
            console.log(`🟢 Conexión inicial o nuevo room detectado (${previousRoomId || 'ninguno'} -> ${state.roomId}). Reiniciando tracking.`);
            resetLikeTracking({ resetSession: true, resetTopLiker: true });
            resetDonationTracking();
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
        console.log('🔄 Volviendo a buscar Live...');
        setTimeout(connectToLive, 10000); 
    });
    
    // Ocultado intencionalmente para no ensuciar la consola
    // tiktokLiveConnection.on('error', (err) => {
    //     console.error('⚠️ Error de conexión TikTok:', err);
    // });
 
    tiktokLiveConnection.on('streamEnd', () => {
        console.log('🏁 El stream ha terminado.');
        activeLiveRoomId = null;
        resetLikeTracking({ resetSession: true, resetTopLiker: true });
        resetDonationTracking();
        updateGlobalTopLiker('N/D', 0).catch(() => {});
        stopLiveHeartbeat();
        updateLiveStatus(false); // Asegurar OFFLINE al terminar stream
    });

    // CHAT
    tiktokLiveConnection.on('chat', async (data) => {
        const msg = data.comment;
        const lowerMsg = msg.toLowerCase();
        const displayName = data.nickname;
        const userId = data.uniqueId;
        const profilePic = data.profilePictureUrl;
        
        // Actualizar foto de perfil en segundo plano
        if (profilePic) {
            updateUserProfilePic(userId, displayName, profilePic);
        }
        
        // DEBUG: Ver todos los mensajes para confirmar que llegan
        // console.log(`[CHAT] ${user}: ${msg}`); 

        // --- USAR CONFIGURACIÓN DINÁMICA ---
        const isSubscriber = data.isSubscriber && config.allowSubscribers;
        const isModerator = data.isModerator && config.allowModerators;
        const isSuperFanRaw = (data.isSubscriber === true) || (Number(data.memberLevel || 0) > 0);
        const isSuperFan = isSuperFanRaw && config.allowSuperFans;
        
        // FIX: Comparación de usuario insensible a mayúsculas para el streamer
        const isStreamer = userId.toLowerCase() === TIKTOK_USERNAME.toLowerCase();
        
        const isVip = isSubscriber || isModerator || isSuperFan || isStreamer || tempVipUsers.has(userId);
        const requireVip = config.requireVipForSr === true; // Strict check

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

        const aliases = getSrAliases();
        const parsed = parseSrCommand(msg, aliases);
        if (parsed) {
            
            console.log(`📝 Comando detectado de ${displayName} (${userId}): ${msg}`);
            
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
        const giftName = data.giftName || data.gift?.name || data.gift?.giftName || '';
        const giftKey = normalizeComparableText(giftName);
        const coins = data.diamondCount;
        const uid = data.uniqueId;
        const displayName = data.nickname;
        const profilePic = data.profilePictureUrl;
        
        // Actualizar foto de perfil
        if (profilePic) {
            updateUserProfilePic(uid, displayName, profilePic);
        }

        const currentAmount = sessionDonations.get(uid) || 0;
        sessionDonations.set(uid, currentAmount + coins);
        sessionGifterDetails.set(uid, {
            username: uid,
            nickname: displayName,
            profilePictureUrl: profilePic || ''
        });
        
        console.log(`🎁 ${displayName} donó ${coins} (Total: ${sessionDonations.get(uid)})`);
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
        if (isGiftFinal && giftKey === 'quiereme') {
            try {
                await grantZ0FanFromTikTok(uid, displayName);
            } catch (e) {
                console.error('Error otorgando z0-Fan por regalo:', e);
            }
        }

        if (isGiftFinal && db) {
            const actualCount = data.repeatCount || 1;
            const totalCoins = coins * actualCount;
            const minCoins = Number(overlayAlertsConfig.minCoinsAlert) || 1;
            
            if (totalCoins >= minCoins) {
                try {
                    let msgTemplate = String(overlayAlertsConfig.giftsAlertMsg || "¡Gracias por {repeatCount}x {giftName}! 🎁");
                    let customMsg = msgTemplate
                        .replace(/{user}/g, displayName)
                        .replace(/{giftname}/g, giftName)
                        .replace(/{giftName}/g, giftName)
                        .replace(/{repeatCount}/g, actualCount)
                        .replace(/{repeatcount}/g, actualCount)
                        .replace(/{coins}/g, totalCoins);

                    await addDoc(collection(db, 'notifications'), {
                        type: 'gift',
                        user: displayName,
                        uniqueId: uid,
                        profilePic: profilePic || '',
                        giftName: giftName,
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
        // 1 punto por cada 10 monedas
        const pointsFromGift = Math.floor(coins / 10);
        
        if (pointsFromGift > 0 && db) {
            try {
                const resolved = await getCanonicalUserKey(uid, displayName);
                const userKey = resolved.userKey || uid;
                const userRef = doc(db, 'userStats', userKey);
                
                // Usamos increment para sumar de forma atómica
                await setDoc(userRef, {
                    totalPoints: increment(pointsFromGift),
                    totalGiftPoints: increment(pointsFromGift),
                    totalCoinsDonated: increment(coins),
                    lastActiveAt: serverTimestamp(),
                    displayName: displayName // Actualizar nombre por si acaso
                }, { merge: true });
                
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

        // ─── GOAL OVERLAYS: acumular coins de sesi\u00f3n ────────────────────────────
        if (isGiftFinal) {
            const actualCount = data.repeatCount || 1;
            const totalCoinsThisGift = coins * actualCount;
            sessionTotalCoins += totalCoinsThisGift;
            syncSessionCountersToFirestore();

            // ─── TIMER EXTENSION: extender el countdown por regalos ──────────────
            if (timerState.state === 'running' && timerState.endsAt) {
                const secondsToAdd = Number(timerState.secondsPerGift || 30);
                const msToAdd = secondsToAdd * 1000;
                timerState.endsAt += msToAdd;
                console.log(`\u23f1\ufe0f Timer extendido +${secondsToAdd}s por regalo de ${displayName} (termina en: ${Math.round((timerState.endsAt - Date.now()) / 1000)}s)`);
                saveTimerToFirestore().catch(() => {});
            }
        }
    });


    // --- MANEJO DE LIKES (NUEVO) ---
    tiktokLiveConnection.on('like', (data) => {
        const uniqueId = String(data && data.uniqueId || '').trim();
        const nickname = String(data && data.nickname || uniqueId || 'Usuario').trim();
        const rawLikeCount = Number(data && data.likeCount);
        const safeLikeCount = Number.isFinite(rawLikeCount) ? Math.floor(rawLikeCount) : 0;
        
        if (!uniqueId || safeLikeCount <= 0) {
            return;
        }
        
        // En tiktok-live-connector, likeCount es la cantidad de likes en este evento específico (no es acumulativo de la sesión del usuario)
        const delta = safeLikeCount;

        // Acumular likes en buffer para no saturar Firestore
        const current = likeBuffer.get(uniqueId) || { 
            userId: uniqueId, 
            displayName: nickname, 
            likes: 0 
        };
        current.displayName = nickname || current.displayName || uniqueId;
        current.likes += delta; // Sumar SOLO la diferencia real
        likeBuffer.set(uniqueId, current);
        
        // Actualizar Top Liker de sesión (memoria)
        const sessionTotal = (sessionLikes.get(uniqueId) || 0) + delta;
        sessionLikes.set(uniqueId, sessionTotal);
        
        sessionLikerDetails.set(uniqueId, {
            username: uniqueId,
            nickname: nickname || uniqueId,
            profilePictureUrl: data.profilePictureUrl || ''
        });

        if (safeLikeCount >= 200) {
            console.log(`❤️ Evento de likes grande detectado: @${nickname} +${safeLikeCount} likes (sesión usuario: ${sessionTotal})`);
        }
        
        // Solo actualizar si supera al actual líder
        if (sessionTotal > currentTopLiker.count) {
            currentTopLiker = { name: nickname, count: sessionTotal };
            updateGlobalTopLiker(nickname, sessionTotal);
        }
    });

    // SEGUIDORES (FOLLOW)
    tiktokLiveConnection.on('follow', async (data) => {
        if (overlayAlertsConfig.enableFollowAlert === false) return;

        const displayName = data.nickname;
        const uid = data.uniqueId;
        const profilePic = data.profilePictureUrl;

        // Acumular en contador de sesión para metas
        sessionFollows.set(uid, (sessionFollows.get(uid) || 0) + 1);
        syncSessionCountersToFirestore();
        
        console.log(`👤 @${uid} comenzó a seguirte!`);
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
            } catch (e) {
                console.error('Error guardando notificación de follow en Firestore:', e);
            }
        }
    });

    // SUSCRIPTORES (SUBSCRIBE)
    tiktokLiveConnection.on('subscribe', async (data) => {
        if (overlayAlertsConfig.enableSubscribeAlert === false) return;

        const displayName = data.nickname;
        const uid = data.uniqueId;
        const profilePic = data.profilePictureUrl;
        
        console.log(`⭐ @${uid} se suscribió!`);
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
                    timestamp: serverTimestamp()
                });
            } catch (e) {
                console.error('Error guardando notificación de sub en Firestore:', e);
            }
        }
    });

    // ─── COMPARTIDOS (SHARE) ───────────────────────────────────────────────────
    tiktokLiveConnection.on('share', async (data) => {
        const displayName = data.nickname || data.uniqueId || 'Usuario';
        const uid = data.uniqueId || '';
        const profilePic = data.profilePictureUrl || '';

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
// Tracking del último contador enviado por TikTok (para Delta Tracking)
const lastLikeCountMap = new Map();
const lastLikeTimeMap = new Map();
let currentTopLiker = { name: 'N/D', count: 0 };
let activeLiveRoomId = null;

// ─── CONTADORES DE SESIÓN (para Goal Overlays) ────────────────────────────────
const sessionFollows = new Map(); // uid -> count
const sessionShares  = new Map(); // uid -> count
let sessionTotalCoins = 0;       // coins acumuladas

// Sincronizar contadores de sesión a Firestore (globalStats/general) para que los overlays los lean
let _syncCountersTimeout = null;
function syncSessionCountersToFirestore() {
    if (_syncCountersTimeout) clearTimeout(_syncCountersTimeout);
    _syncCountersTimeout = setTimeout(async () => {
        if (!db) return;
        try {
            const totalFollows = Array.from(sessionFollows.values()).reduce((a, b) => a + b, 0);
            const totalShares  = Array.from(sessionShares.values()).reduce((a, b) => a + b, 0);
            const totalLikes   = Array.from(sessionLikes.values()).reduce((a, b) => a + b, 0);
            await setDoc(doc(db, 'globalStats', 'general'), {
                sessionFollows: totalFollows,
                sessionShares:  totalShares,
                sessionLikes:   totalLikes,
                sessionCoins:   sessionTotalCoins,
                lastUpdate:     serverTimestamp()
            }, { merge: true });
        } catch (e) {
            console.error('Error sincronizando contadores de sesión:', e);
        }
    }, 2000); // Debounce 2s
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
    timerOpacity: 0.85,
    timerRadius: 22,
    timerFontSize: 14
};

async function saveTimerToFirestore() {
    if (!db) return;
    try {
        await setDoc(doc(db, 'systemConfig', 'timerConfig'), {
            state:          timerState.state,
            endsAt:         timerState.endsAt,
            label:          timerState.label,
            primaryColor:   timerState.primaryColor,
            secondsPerGift: timerState.secondsPerGift,
            timerOpacity:   timerState.timerOpacity !== undefined ? timerState.timerOpacity : 0.85,
            timerRadius:    timerState.timerRadius !== undefined ? timerState.timerRadius : 22,
            timerFontSize:  timerState.timerFontSize !== undefined ? timerState.timerFontSize : 14,
            updatedAt:      serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error('Error guardando timer en Firestore:', e);
    }
}

function resetLikeTracking(options = {}) {
    const resetSession = options.resetSession === true;
    const resetTopLiker = options.resetTopLiker === true;
    try { likeBuffer.clear(); } catch (_) {}
    if (resetSession) {
        try { sessionLikes.clear(); } catch (_) {}
        try { lastLikeCountMap.clear(); } catch (_) {}
        try { lastLikeTimeMap.clear(); } catch (_) {}
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
            topLiker: name,
            topLikerCount: safeCount,
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
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
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

            const minLikes = Number(overlayAlertsConfig.minLikesAlert) || 100;
            if (totalLikesInBatch >= minLikes && db) {
                try {
                    let msgTemplate = String(overlayAlertsConfig.likesAlertMsg || "¡Envió {likes} likes! ❤️");
                    let customMsg = msgTemplate
                        .replace(/{user}/g, finalName)
                        .replace(/{likes}/g, totalLikesInBatch.toLocaleString());

                    await addDoc(collection(db, 'notifications'), {
                        type: 'like',
                        user: finalName,
                        uniqueId: uid,
                        likes: totalLikesInBatch,
                        message: customMsg,
                        timestamp: serverTimestamp()
                    });
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
}, 5000); // 5 segundos (más interactivo/en tiempo real)

async function recalculateLikerRanks() {
    if (!db) return;
    try {
        const { doc, setDoc, serverTimestamp } = require('firebase/firestore');
        const sorted = Array.from(sessionLikes.entries())
            .sort((a, b) => b[1] - a[1]);

        const list = sorted.map(([uid, amount]) => {
            const details = sessionLikerDetails.get(uid) || { username: uid, nickname: uid, profilePictureUrl: '' };
            return {
                username: uid,
                nickname: details.nickname || uid,
                profilePictureUrl: details.profilePictureUrl || '',
                totalAmount: amount
            };
        });

        await setDoc(doc(db, 'globalStats', 'topLikers'), {
            list: list.slice(0, 20), // Guardar el top 20 de la sesión
            lastUpdate: serverTimestamp()
        }, { merge: true });
        console.log('💾 Top Likers actualizados en Firestore.');
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
        console.log('🔄 Tracking de donadores y likes reiniciado.');
    } catch (_) {}
}

async function recalculateDonorRanks() {
    // Convertir a array y ordenar por monto descendente
    const sorted = Array.from(sessionDonations.entries())
        .sort((a, b) => b[1] - a[1]);

    donorRanks = {
        gold: sorted[0] ? { user: sorted[0][0], amount: sorted[0][1] } : null,
        silver: sorted[1] ? { user: sorted[1][0], amount: sorted[1][1] } : null,
        bronze: sorted[2] ? { user: sorted[2][0], amount: sorted[2][1] } : null
    };

    console.log('🏆 Ranking Donadores:', donorRanks);

    // Guardar ranking completo de la sesión en Firestore
    if (db) {
        try {
            const { doc, setDoc, serverTimestamp } = require('firebase/firestore');
            const list = sorted.map(([uid, amount]) => {
                const details = sessionGifterDetails.get(uid) || { username: uid, nickname: uid, profilePictureUrl: '' };
                return {
                    username: uid,
                    nickname: details.nickname || uid,
                    profilePictureUrl: details.profilePictureUrl || '',
                    totalAmount: amount
                };
            });

            await setDoc(doc(db, 'globalStats', 'topGifters'), {
                list: list.slice(0, 20), // Guardar el top 20 de la sesión
                lastUpdate: serverTimestamp()
            }, { merge: true });
            console.log('💾 Top Gifters actualizados en Firestore.');
        } catch (e) {
            console.error('❌ Error al guardar Top Gifters en Firestore:', e);
        }
    }
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
            const msg = String(err && err.message ? err.message : err);
            isConnecting = false;

            if (msg.includes('Unexpected server response: 200')) {
                console.error('❌ TikTok rechazó la conexión (Error 200).');
                console.warn('⚠️ Esto sucede cuando TikTok detecta actividad inusual.');
                console.warn('💡 RECOMENDACIÓN: Si el error persiste, abre TikTok en tu navegador, copia tu "sessionid" de las cookies y ponlo en el config.json');
            } else {
                console.error('❌ Error al conectar:', msg);
            }

            // Reintentar siempre con parámetros limpios tras 10 segundos
            console.log('🔄 Reintentando en 10 segundos...');
            setTimeout(() => {
                tiktokConnectionOptions = buildTikTokConnectionOptions();
                try { if (tiktokLiveConnection) tiktokLiveConnection.disconnect(); } catch (_) {}
                tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USERNAME, tiktokConnectionOptions);
                setupListeners();
                connectToLive();
            }, 10000);
        });
}

// Lista de usuarios temporales
const tempVipUsers = new Set();

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
            // Verificar si el candado de YouTube por likes está habilitado
            const isLockEnabled = overlayAlertsConfig.enableLikesYoutubeLock !== false;
            if (isLockEnabled) {
                const targetLikes = Number(overlayAlertsConfig.likesTargetForYoutubeLink) || 999;
                let totalSessionLikes = 0;
                try {
                    for (const count of sessionLikes.values()) {
                        totalSessionLikes += count;
                    }
                } catch (_) {}

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
        const songId = `${user}-${songName}-${artistName}-${hora}`.replace(/[^a-zA-Z0-9-]/g, '');
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
                const docRef = await addDoc(collection(db, 'solicitudes'), requestData);
                queueSaved = true;
                queueDocId = docRef && docRef.id ? docRef.id : '';
                console.log(`✅ Agregada a la lista visual`);
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
                            const docRef2 = await addDoc(collection(db, 'solicitudes'), requestData);
                            queueSaved = true;
                            queueDocId = docRef2 && docRef2.id ? docRef2.id : '';
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
                    } catch (e) {
                        console.warn(`⚠️ Error enviando a Cider. Pedido se mantiene en lista.`, e && e.message ? e.message : String(e));
                    }
                }
            } else {
                ciderQueued = true;
                enqueueCider({ source: source || 'request', user, userId, query, songName, artistName, artworkUrl, appleMusicId, trackViewUrl, queueSaved });
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
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    }
}

// Mantener el proceso vivo
process.on('uncaughtException', (err) => {
    console.error('Error no capturado:', err);
});
