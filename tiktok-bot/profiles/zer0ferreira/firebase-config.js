/**
 * firebase-config.js — Zero FM (Perfil zer0ferreira)
 */
const firebaseConfig = {
    apiKey:            "AIzaSyA6c3EaIvuPEfM6sTV0YHqCBHuz35ZmNIU",
    authDomain:        "zero-strom-web.firebaseapp.com",
    projectId:         "zero-strom-web",
    storageBucket:     "zero-strom-web.firebasestorage.app",
    messagingSenderId: "758369466349",
    appId:             "1:758369466349:web:f2ced362a5a049c70b59e4",
    databaseURL:       "https://zero-strom-web-default-rtdb.firebaseio.com"
};

if (typeof window !== 'undefined') {
    window.ZERO_FM_FIREBASE = firebaseConfig;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = firebaseConfig;
}
