/**
 * Zero FM - Firebase Configuration & Core Initialization
 * v2.1 Modular
 */

(function () {
    console.log('🚀 Iniciando configuración de Firebase v2.1');
    
    window.playedSongsCache = {};
    
    const firebaseConfig = {
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
            console.log('✅ Firebase initialized successfully');
        } else {
            console.warn('⚠️ Firebase SDK not loaded - Offline mode');
        }
    } catch (e) {
        console.error('❌ Error initializing Firebase:', e);
    }

    // Exportar a window para compatibilidad con el resto del código
    window.db = db;
    window.firebaseConfig = firebaseConfig;
    
    // Variables globales básicas
    window.START_POINTS_DAY = window.START_POINTS_DAY || '';
    
    /**
     * Normaliza una cadena de fecha a formato YYYY-MM-DD
     */
    /**
     * Normaliza una cadena de fecha a formato YYYY-MM-DD
     * Soporta: YYYY-MM-DD, YYYY/MM/DD, DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
     */
    window.normalizeDay = function(str) {
        if (!str) return '';
        if (str instanceof Date) return str.toISOString().split('T')[0];
        const raw = String(str).trim();
        
        // 1. Caso ya correcto: YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
        
        // 2. Caso YYYY/MM/DD -> YYYY-MM-DD
        if (/^\d{4}\/\d{2}\/\d{2}$/.test(raw)) return raw.replace(/\//g, '-');
        
        // 3. Caso DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY -> YYYY-MM-DD
        const match = raw.match(/^(\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](\d{4})$/);
        if (match) {
            const day = match[1].padStart(2, '0');
            const month = match[2].padStart(2, '0');
            const year = match[3];
            return `${year}-${month}-${day}`;
        }
        
        // 4. Intentar extraer cualquier YYYY-MM-DD que contenga la cadena
        const matchIso = raw.match(/(\d{4}-\d{2}-\d{2})/);
        if (matchIso) return matchIso[1];
        
        return raw;
    };

    console.log('📦 Módulo config.js cargado');
})();
