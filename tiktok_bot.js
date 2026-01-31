const { WebcastPushConnection } = require('tiktok-live-connector');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

// --- CONFIGURACIÓN ---
// Pon aquí tu nombre de usuario de TikTok (sin @)
const TIKTOK_USERNAME = "TU_USUARIO_AQUI"; 

// Configuración de Firebase (Copiada de tu proyecto)
const firebaseConfig = {
  apiKey: "AIzaSyA6c3EaIvuPEfM6sTV0YHqCBHuz35ZmNIU",
  authDomain: "zero-strom-web.firebaseapp.com",
  projectId: "zero-strom-web",
  storageBucket: "zero-strom-web.firebasestorage.app",
  messagingSenderId: "758369466349",
  appId: "1:758369466349:web:f2ced362a5a049c70b59e4"
};

// --- INICIALIZACIÓN ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Crear conexión a TikTok
const tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USERNAME);

// --- LÓGICA ---

// Conectar al live
console.log(`Conectando al live de TikTok de: ${TIKTOK_USERNAME}...`);
tiktokLiveConnection.connect()
    .then(state => {
        console.info(`✅ Conectado exitosamente a la sala (Room ID: ${state.roomId})`);
        console.log('Esperando comandos !pedido ...');
    })
    .catch(err => {
        console.error('❌ Error al conectar con TikTok:', err);
        console.log('Asegúrate de que el usuario está EN VIVO actualmente.');
    });

// Escuchar mensajes del chat
tiktokLiveConnection.on('chat', (data) => {
    const msg = data.comment;
    const user = data.nickname;
    
    // Detectar comando !pedido
    if (msg.toLowerCase().startsWith('!pedido')) {
        console.log(`Mensaje recibido de ${user}: ${msg}`);
        
        // Extraer el contenido después de !pedido
        const content = msg.substring(7).trim();
        
        if (content.length > 0) {
            let song, artist;
            
            // Intentar separar por guión si existe (ej: !pedido Cancion - Artista)
            if (content.includes('-')) {
                const parts = content.split('-');
                song = parts[0].trim();
                artist = parts.slice(1).join('-').trim();
            } else {
                // Si no hay guión, asumimos que todo es el nombre de la canción
                // O intentamos lógica simple de espacio si se prefiere, pero es arriesgado.
                song = content;
                artist = "Desconocido"; 
            }
            
            console.log(`📝 Procesando pedido -> Canción: "${song}", Artista: "${artist}"`);
            
            // Generar key del día para compatibilidad (YYYY-MM-DD)
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const dayKey = `${y}-${m}-${dd}`;

            // Guardar en Firestore (Colección 'pedidos')
            addDoc(collection(db, "pedidos"), {
                cancion: song,
                artista: artist,
                usuario: user,
                platform: 'tiktok',
                ts: serverTimestamp(), // Timestamp del servidor
                day: dayKey, // Para compatibilidad con filtros de día
                leido: false
            }).then((docRef) => {
                console.log(`✅ Pedido guardado en Firestore con ID: ${docRef.id}`);
            }).catch((error) => {
                console.error("❌ Error guardando en Firestore:", error);
            });
            
        } else {
            console.log(`⚠️ Comando vacío recibido de ${user}`);
        }
    }
});

// Manejo de desconexión
tiktokLiveConnection.on('disconnected', () => {
    console.log('⚠️ Desconectado del live');
});

tiktokLiveConnection.on('error', (err) => {
    console.error('❌ Error de conexión:', err);
});
