
const { WebcastPushConnection } = require('tiktok-live-connector');
const axios = require('axios');
const { io } = require('socket.io-client');
const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');

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

function updateLiveStatus(isLive) {
    if (!dbStatus) {
        console.error("⚠️ updateLiveStatus invocado pero dbStatus es NULL. ¿Falló la inicialización?");
        return;
    }
    try {
        const { doc, setDoc, serverTimestamp } = require('firebase/firestore'); 
        const docRef = doc(dbStatus, 'system', 'status');
        setDoc(docRef, {
            isLive: isLive,
            lastUpdate: serverTimestamp()
        }, { merge: true })
        .then(() => console.log(`✅ Estado LIVE actualizado: ${isLive ? 'ONLINE' : 'OFFLINE'}`))
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
    likesPerPoint: 120, // Nuevo: Configuración de likes por punto (Default 120)
    commandAliases: ["!zr", "!sr", "!pedir", "!cancion"],
    ignoreExampleQuery: "artista cancion"
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
        enableWebsocketUpgrade: tiktokWebsocketUpgradeEnabled,
        requestPollingIntervalMs: 2000,
        clientParams: {
            app_language: 'es-ES',
            device_platform: 'web_cast'
        }
    };
    if (config.sessionId) opts.sessionId = config.sessionId;
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
// let db; // REDUNDANT
const recentSrEvents = [];
const pendingCiderQueue = [];
let ciderFlushInProgress = false;

let mockCiderHttpServer = null;
let mockCiderIo = null;
let mockCiderPort = 0;
let mockCiderQueue = [];
let mockCiderNowPlaying = null;

const badgeSets = {
    vip: new Set(),
    z0Vip: new Set(),
    donador: new Set(),
    z0Fan: new Set(),
    z0Platinum: new Set(),
    superfan: new Set(),
    selected: new Map()
};
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
    } catch (e) {
        console.warn('⚠️ No se pudieron actualizar insignias (vip/z0/donador):', e && e.message ? e.message : String(e));
    } finally {
        badgeSetsRefreshing = false;
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

    try {
        if (db && typeof getDoc === 'function' && typeof doc === 'function') {
            let found = false;

            // 1. Intentar buscar por ID directo (uid o name)
            const candidates = [];
            if (uid) candidates.push(uid);
            if (name && name !== uid) candidates.push(name);
            
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

    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));

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
    tiktokLiveConnection.on('connected', state => {
        console.log(`🟢 Conectado exitosamente (Room ID: ${state.roomId})`);
        updateLiveStatus(true); // Actualizar estado a ONLINE
    });
    
    // Solo un listener de 'disconnected' principal que maneja ambas cosas
    tiktokLiveConnection.on('disconnected', () => {
        console.log('🔴 Desconectado del live.');
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
        const isSuperFanRaw = (data.followRole >= 1) || (data.memberLevel > 0);
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
        const isLinkCmd = lowerMsg.startsWith('!link ') || lowerMsg.startsWith('!vincular ');
        if (isLinkCmd) {
            const code = msg.split(' ')[1]; // Obtener código (ej: ZR-1234)
            if (!code || !code.startsWith('ZR-')) {
                console.log(`❌ Código de vinculación inválido recibido de ${displayName}: ${code}`);
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

                    const webUser = linkData.webUser;
                    // El usuario de TikTok es el userId (o displayName, pero userId es más seguro)
                    const tiktokAlias = displayName.replace(/^@/, '').toLowerCase(); 

                    // 1. Crear el vínculo en systemConfig/userAliases
                    await setDoc(doc(db, 'systemConfig', 'userAliases'), {
                        [tiktokAlias]: webUser
                    }, { merge: true });

                    // 2. Eliminar el código usado para que no se pueda reutilizar (seguridad)
                    if (typeof deleteDoc === 'function') {
                        await deleteDoc(linkDocRef);
                    }

                    // 3. Notificar éxito
                    console.log(`✅ ¡VINCULACIÓN EXITOSA! @${tiktokAlias} -> ${webUser}`);
                    
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

        const isZ0FanCmd = String(lowerMsg || '').trim() === 'quiereme';
        if (isZ0FanCmd) {
            try {
                if (db) {
                    const resolved = await getCanonicalUserKey(userId, displayName);
                    const userKey = String(resolved.userKey || userId || '').trim();
                    if (userKey) {
                        await setDoc(docFn(db, 'z0FanUsers', userKey), { name: userKey }, { merge: true });
                        const norm = normalizeUserKeyForBadges(userKey);
                        if (norm) badgeSets.z0Fan.add(norm);
                        console.log(`⚡ z0-Fan otorgado: ${userKey}`);
                    }
                }
            } catch (e) {
                console.error('Error otorgando z0-Fan:', e);
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
                const result = await handleSongRequest(userKey, cleanQuery, { userId, displayName: displayNameBest, rawQuery, source: 'tiktokChat' });
                pushSrEvent({ source: 'chat', user: userKey, displayName: displayNameBest, userId, query: rawQuery, isVip, accepted: !!result?.ok, queueSaved: !!result?.queueSaved, ciderSent: !!result?.ciderSent, ciderQueued: !!result?.ciderQueued, error: result?.ok ? '' : (result?.error || '') });
            }
        }
    });

    // REGALOS
    tiktokLiveConnection.on('gift', async (data) => {
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
    });

    // --- MANEJO DE LIKES (NUEVO) ---
    tiktokLiveConnection.on('like', (data) => {
        const { uniqueId, nickname, likeCount } = data;
        // Acumular likes en buffer para no saturar Firestore
        // El 'likeCount' que llega de TikTok suele ser el acumulado de esa ráfaga, o incremental.
        // La librería suele emitir el total de la ráfaga. 
        // Vamos a asumir que es incremental para el buffer.
        // OJO: data.likeCount es el número de likes enviados en este evento (ej: 15 likes)
        // No es el total de la sesión.
        
        // Vamos a sumar al buffer.
        const current = likeBuffer.get(uniqueId) || { 
            userId: uniqueId, 
            displayName: nickname, 
            likes: 0 
        };
        current.likes += likeCount; // Sumar likes
        likeBuffer.set(uniqueId, current);
        
        // Actualizar Top Liker de sesión (memoria)
        // FIX: La librería tiktok-live-connector a veces envía `likeCount` como el total de la ráfaga
        // pero también emite `totalLikeCount` que es el total de la sesión.
        // Para evitar números inflados, usaremos `totalLikeCount` si está disponible, 
        // o acumularemos con cuidado.
        // En la versión actual, `likeCount` es incremental por evento.
        
        let sessionTotal = 0;
        
        // Si la librería nos da el total acumulado de la sesión, lo usamos directamente
        if (data.totalLikeCount && typeof data.totalLikeCount === 'number') {
             sessionTotal = data.totalLikeCount;
             // Actualizar nuestro mapa local para sincronizar
             sessionLikes.set(uniqueId, sessionTotal);
        } else {
             // Si no, sumamos manualmente (fallback)
             sessionTotal = (sessionLikes.get(uniqueId) || 0) + likeCount;
             sessionLikes.set(uniqueId, sessionTotal);
        }
        
        // Solo actualizar si supera al actual líder
        if (sessionTotal > currentTopLiker.count) {
            currentTopLiker = { name: nickname, count: sessionTotal };
            updateGlobalTopLiker(nickname, sessionTotal);
        }
    });
}

// --- BUFFER DE LIKES ---
const likeBuffer = new Map();
// Tracking de sesión para Top Liker
const sessionLikes = new Map();
let currentTopLiker = { name: 'N/D', count: 0 };

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

            // Calcular puntos: 1 punto cada 300 likes (configurado aquí)
            const LIKES_PER_POINT = 300; 
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
                totalLikes: newTotalLikes, 
                lastLikeActivity: serverTimestamp(),
                displayName: finalName,
                likesPerPoint: LIKES_PER_POINT 
            };

            // Solo sumar puntos y registrar puntos de likes si ganó nuevos puntos
            if (pointsToAdd > 0) {
                // FIX: Usamos increment para totalPoints, pero para totalLikesPoints 
                // debemos usar el valor absoluto calculado (expectedTotalPoints) 
                // o incrementar solo la diferencia. 
                // El problema es que si el usuario ya tenía puntos erróneos inflados,
                // esto podría no corregirlos hacia abajo.
                // Mejor: Recalcular totalLikesPoints basado estrictamente en totalLikes / 300
                
                updateData.totalPoints = increment(pointsToAdd);
                updateData.totalLikesPoints = expectedTotalPoints; 
                
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
                // Asegurar consistencia incluso si no ganó puntos nuevos
                updateData.totalLikesPoints = expectedTotalPoints;
                
                // Solo log si hubo muchos likes pero no alcanzaron para punto
                if (totalLikesInBatch > 50) {
                   console.log(`❤️ @${finalName} envió ${totalLikesInBatch} likes (Acumulados: ${newTotalLikes}, Faltan ${LIKES_PER_POINT - (newTotalLikes % LIKES_PER_POINT)} para el siguiente punto)`);
                }
            }

            await setDoc(userRef, updateData, { merge: true });

        } catch (e) {
            console.error(`Error procesando likes para ${data.displayName}:`, e);
        }
    }
}, 30000); // 30 segundos

// Mapa de donaciones de la sesión
const sessionDonations = new Map();

// Rangos de donadores (Top 3)
let donorRanks = {
    gold: null,   // { user, amount }
    silver: null,
    bronze: null
};

function recalculateDonorRanks() {
    // Convertir a array y ordenar por monto descendente
    const sorted = Array.from(sessionDonations.entries())
        .sort((a, b) => b[1] - a[1]);

    donorRanks = {
        gold: sorted[0] ? { user: sorted[0][0], amount: sorted[0][1] } : null,
        silver: sorted[1] ? { user: sorted[1][0], amount: sorted[1][1] } : null,
        bronze: sorted[2] ? { user: sorted[2][0], amount: sorted[2][1] } : null
    };

    console.log('🏆 Ranking Donadores:', donorRanks);
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
            console.error('❌ Error al conectar:', msg);
            isConnecting = false;
            const isWsUrlIssue = msg.includes('Invalid URL') || msg.includes('Unexpected server response: 200');
            if (isWsUrlIssue && tiktokWebsocketUpgradeEnabled) {
                try {
                    console.warn('⚠️ Falló WebSocket. Cambiando a modo polling (sin upgrade) y reintentando...');
                    tiktokWebsocketUpgradeEnabled = false;
                    tiktokConnectionOptions = buildTikTokConnectionOptions();
                    try { if (tiktokLiveConnection) tiktokLiveConnection.disconnect(); } catch (_) {}
                    tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USERNAME, tiktokConnectionOptions);
                    setupListeners();
                    setTimeout(connectToLive, 1500);
                    return;
                } catch (_) {}
            }
            setTimeout(connectToLive, 10000);
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

        const songName = resolved.songName;
        const artistName = resolved.artistName;
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
            liveCode: liveCode || ''
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
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

// Mantener el proceso vivo
process.on('uncaughtException', (err) => {
    console.error('Error no capturado:', err);
});
