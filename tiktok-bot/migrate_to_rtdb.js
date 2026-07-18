const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const { getDatabase, ref, set } = require('firebase/database');

const firebaseConfig = {
  apiKey: "AIzaSyA6c3EaIvuPEfM6sTV0YHqCBHuz35ZmNIU",
  authDomain: "zero-strom-web.firebaseapp.com",
  projectId: "zero-strom-web",
  storageBucket: "zero-strom-web.appspot.com",
  messagingSenderId: "758369466349",
  appId: "1:758369466349:web:f2ced362a5a049c70b59e4"
};

async function migrate() {
    console.log("🚀 Iniciando migración de Firestore userStats a Realtime Database...");
    
    // Inicializar Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const rtdb = getDatabase(app);
    
    try {
        // 1. Obtener todos los usuarios de Firestore
        console.log("📥 Descargando usuarios desde Firestore...");
        const usersSnap = await getDocs(collection(db, 'userStats'));
        console.log(`📊 Encontrados ${usersSnap.size} usuarios registrados.`);
        
        let successCount = 0;
        
        // 2. Escribir cada uno en Realtime Database
        for (const doc of usersSnap.docs) {
            const data = doc.data() || {};
            const rawUsername = doc.id;
            const normUser = String(rawUsername).toLowerCase().trim().replace(/[.#$\[\]]/g, '_'); // Caracteres inválidos en llaves de RTDB
            
            // Estructura limpia para RTDB
            const rtdbUserData = {
                points: Number(data.totalPoints || 0) || 0,
                level: Number((data.gamification && data.gamification.level) || data.level || 1) || 1,
                xp: Number(data.xp || 0) || 0,
                achievements: Array.isArray(data.gamification && data.gamification.achievements) ? data.gamification.achievements : [],
                streaks: data.gamification && data.gamification.streaks ? data.gamification.streaks : { current: 0, best: 0, lastActivity: null, calendar: {} },
                stats: data.gamification && data.gamification.stats ? data.gamification.stats : { totalSongs: 0, uniqueArtists: 0, activeDays: 0, isVip: !!data.isVip },
                displayName: String(data.displayName || rawUsername).trim(),
                tiktokId: String(data.tiktokId || '').trim(),
                profilePic: String(data.profilePic || data.profilePhoto || '').trim(),
                lastUpdated: new Date().toISOString()
            };
            
            // Escribir en la ruta liveUsers/username
            const userRef = ref(rtdb, `liveUsers/${normUser}`);
            await set(userRef, rtdbUserData);
            successCount++;
            
            if (successCount % 100 === 0) {
                console.log(`💾 Migrados ${successCount}/${usersSnap.size} usuarios...`);
            }
        }
        
        console.log(`\n✅ MIGRACIÓN COMPLETADA CON ÉXITO!`);
        console.log(`🎉 Se migraron ${successCount} perfiles a Realtime Database.`);
        process.exit(0);
        
    } catch (error) {
        console.error("❌ Error durante la migración:", error);
        process.exit(1);
    }
}

migrate();
