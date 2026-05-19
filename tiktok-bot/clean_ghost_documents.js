const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc, setDoc, deleteDoc, increment } = require('firebase/firestore');

// Usar la misma configuración de Firebase del bot
const firebaseConfig = {
    apiKey: "AIzaSyB-xxxxx", // No necesitamos apiKey para leer datos públicos si no hay reglas, pero la importaremos del bot si podemos.
    authDomain: "zero-strom-web.firebaseapp.com",
    projectId: "zero-strom-web",
    storageBucket: "zero-strom-web.firebasestorage.app",
    messagingSenderId: "367205244199",
    appId: "1:367205244199:web:365778a4fb27fde2c9066f",
    measurementId: "G-FMW23W9XYK"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanGhostDocuments() {
    console.log("🧹 Iniciando limpieza de Documentos Fantasma en Firestore...");

    try {
        const snapshot = await getDocs(collection(db, 'userStats'));
        const users = [];
        snapshot.forEach(doc => {
            users.push({ id: doc.id, data: doc.data() });
        });

        console.log(`📦 Encontrados ${users.length} documentos de usuario.`);

        const toMerge = [];

        for (const user of users) {
            const rawId = user.id;
            const normId = rawId.replace(/^@/, '').toLowerCase();

            // Si el ID tiene mayúsculas o empieza con @
            if (rawId !== normId) {
                console.log(`👻 Documento fantasma detectado: ${rawId} -> debe ser ${normId}`);
                toMerge.push({ source: rawId, target: normId, data: user.data });
            }
        }

        console.log(`🔍 Se encontraron ${toMerge.length} documentos para fusionar.`);

        for (const merge of toMerge) {
            const sourceRef = doc(db, 'userStats', merge.source);
            const targetRef = doc(db, 'userStats', merge.target);

            // Sumar datos numéricos importantes usando incrementos atómicos
            const updateData = {
                migratedAt: new Date(),
                displayName: merge.data.displayName || merge.target
            };

            // Solo sumar si existen en el fantasma
            if (merge.data.totalLikes) updateData.totalLikes = increment(merge.data.totalLikes);
            if (merge.data.totalLikesPoints) updateData.totalLikesPoints = increment(merge.data.totalLikesPoints);
            if (merge.data.totalCoinsDonated) updateData.totalCoinsDonated = increment(merge.data.totalCoinsDonated);
            if (merge.data.totalPoints) updateData.totalPoints = increment(merge.data.totalPoints);
            
            // Conservar alias si existen
            if (merge.data.tiktokId) updateData.tiktokId = merge.data.tiktokId;

            console.log(`🔄 Fusionando ${merge.source} hacia ${merge.target}...`);
            await setDoc(targetRef, updateData, { merge: true });

            console.log(`🗑️ Eliminando documento fantasma: ${merge.source}...`);
            await deleteDoc(sourceRef);
        }

        console.log("✅ Limpieza completada con éxito. La base de datos está impecable.");
        process.exit(0);

    } catch (e) {
        console.error("❌ Error durante la limpieza:", e);
        process.exit(1);
    }
}

cleanGhostDocuments();
