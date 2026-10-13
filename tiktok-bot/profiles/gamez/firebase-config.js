const firebaseConfig = {
  apiKey: "AIzaSyC9zlwtUUq7eNUoZ1QVcEOY4-NI_4fKU5Y",
  authDomain: "zer0-gaming.firebaseapp.com",
  projectId: "zer0-gaming",
  storageBucket: "zer0-gaming.firebasestorage.app",
  messagingSenderId: "512862504825",
  appId: "1:512862504825:web:a0cea40d1435e74d6851a8",
  measurementId: "G-LTZW7V5X7P"
};

if (typeof window !== 'undefined') {
    window.ZERO_FM_FIREBASE = firebaseConfig;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = firebaseConfig;
}
