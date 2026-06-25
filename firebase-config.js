/**
 * firebase-config.js — Zero FM
 * ─────────────────────────────────────────────────────────────────────────
 * Configuración compartida de Firebase para todos los overlays.
 * Carga este archivo ANTES de cualquier script que use Firebase.
 *
 * Uso en cada overlay:
 *   <script src="firebase-config.js"></script>
 *   ...y luego en el JS del overlay:
 *   firebase.initializeApp(window.ZERO_FM_FIREBASE);
 * ─────────────────────────────────────────────────────────────────────────
 */
const firebaseConfig = {
    apiKey:            "AIzaSyA6c3EaIvuPEfM6sTV0YHqCBHuz35ZmNIU",
    authDomain:        "zero-strom-web.firebaseapp.com",
    projectId:         "zero-strom-web",
    storageBucket:     "zero-strom-web.firebasestorage.app",
    messagingSenderId: "758369466349",
    appId:             "1:758369466349:web:f2ced362a5a049c70b59e4"
};

if (typeof window !== 'undefined') {
    window.ZERO_FM_FIREBASE = firebaseConfig;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = firebaseConfig;
}
