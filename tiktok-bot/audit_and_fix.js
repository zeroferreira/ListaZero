const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs, updateDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyA6c3EaIvuPEfM6sTV0YHqCBHuz35ZmNIU",
  authDomain: "zero-strom-web.firebaseapp.com",
  projectId: "zero-strom-web",
  storageBucket: "zero-strom-web.appspot.com",
  messagingSenderId: "758369466349",
  appId: "1:758369466349:web:f2ced362a5a049c70b59e4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper to determine if a gift notification is a Quiéreme gift
function checkIsQuiereme(giftName) {
  if (!giftName) return false;
  const name = giftName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return name === 'heart me' || name === 'heartme' || name === 'quiereme' || name === 'quiere me';
}

// Convert Firestore Timestamp to milliseconds
function getMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (ts.seconds) return ts.seconds * 1000;
  return new Date(ts).getTime();
}

async function audit(dryRun = true) {
  console.log(`=== AUDITORÍA DE CONTEO DE QUIÉREMES ===`);
  console.log(`Modo: ${dryRun ? 'SIMULACIÓN (Dry-Run)' : 'REAL (Guardando cambios en Firestore)'}\n`);

  // 1. Obtener alias de systemConfig/userAliases
  console.log('⏳ Leyendo vinculaciones desde systemConfig/userAliases...');
  const aliasesSnap = await getDoc(doc(db, 'systemConfig', 'userAliases'));
  if (!aliasesSnap.exists()) {
    console.error('❌ No se encontró el documento systemConfig/userAliases.');
    return;
  }
  const aliases = aliasesSnap.data();
  console.log(`... Vinculaciones encontradas: ${Object.keys(aliases).length}\n`);

  // 2. Obtener la fecha de vinculación desde la colección userAliases si existe
  console.log('⏳ Leyendo colección userAliases...');
  const userAliasesSnap = await getDocs(collection(db, 'userAliases'));
  const linkTimestamps = {};
  userAliasesSnap.forEach(d => {
    const data = d.data();
    linkTimestamps[d.id.toLowerCase()] = getMillis(data.updatedAt);
  });

  // 3. Obtener todos los regalos de la colección notifications
  console.log('⏳ Cargando historial de regalos desde la colección notifications (esto puede tardar)...');
  const notificationsSnap = await getDocs(collection(db, 'notifications'));
  const giftNotifications = [];
  notificationsSnap.forEach(d => {
    const data = d.data();
    if (data.type === 'gift') {
      giftNotifications.push({
        id: d.id,
        uniqueId: String(data.uniqueId || '').toLowerCase(),
        user: data.user,
        giftName: data.giftName,
        coins: Number(data.coins || 0),
        repeatCount: Number(data.repeatCount || 0),
        timestamp: getMillis(data.timestamp)
      });
    }
  });
  console.log(`... Regalos cargados: ${giftNotifications.length}\n`);

  // 4. Procesar cada vinculación
  for (const [sourceKeyRaw, targetKeyRaw] of Object.entries(aliases)) {
    const sourceKey = String(sourceKeyRaw).trim().toLowerCase();
    const targetKey = String(targetKeyRaw).trim().toLowerCase();

    console.log(`--------------------------------------------------`);
    console.log(`🔗 Analizando vinculación: @${sourceKey} -> @${targetKey}`);

    // Cargar estadísticas actuales del usuario destino
    const targetDocSnap = await getDoc(doc(db, 'userStats', targetKey));
    if (!targetDocSnap.exists()) {
      console.log(`... El usuario destino @${targetKey} no tiene documento en userStats. Omitiendo.`);
      continue;
    }
    const tgtData = targetDocSnap.data();
    let currentQuiereCount = Number(tgtData.quiereCount || 0);

    // Restaurar el valor original en memoria si fue alterado por la corrida anterior
    const originalResets = {
      'jenn garcia': 386,
      'ayvy._.13': 63,
      'delshings;) 2.0👾': 6,
      'xoxo_.lotus': 10
    };
    if (originalResets[targetKey] !== undefined) {
      currentQuiereCount = originalResets[targetKey];
      console.log(`🔄 [Restauración Memoria] Usando valor original de @${targetKey}: ${currentQuiereCount}`);
    }

    // Obtener la fecha en que se vinculó
    const linkTime = linkTimestamps[sourceKey] || 0;
    if (linkTime === 0) {
      console.log(`... No se encontró fecha de vinculación exacta para @${sourceKey}. Usando 0 (todo se asume antes).`);
    } else {
      console.log(`... Fecha de vinculación: ${new Date(linkTime).toLocaleString()}`);
    }

    // Filtrar regalos de este usuario
    const userGifts = giftNotifications.filter(g => g.uniqueId === sourceKey || g.uniqueId === targetKey);
    const quieremeGifts = userGifts.filter(g => checkIsQuiereme(g.giftName));

    // Separar regalos antes y después de la vinculación
    let liveBefore = 0;
    let liveAfter = 0;

    quieremeGifts.forEach(g => {
      if (linkTime > 0 && g.timestamp > linkTime) {
        liveAfter += g.repeatCount;
      } else {
        liveBefore += g.repeatCount;
      }
    });

    const totalLive = liveBefore + liveAfter;

    console.log(`... Conteo actual en userStats (quiereCount): ${currentQuiereCount}`);
    console.log(`... Regalos en Live detectados:`);
    console.log(`   - Antes de vincular: ${liveBefore}`);
    console.log(`   - Después de vincular: ${liveAfter}`);
    console.log(`   - Total en Live: ${totalLive}`);

    // Calcular el valor manual (M) si existía
    // Dado que current = max(M, liveBefore) + liveAfter,
    // entonces max(M, liveBefore) = current - liveAfter.
    const maxMOrLiveBefore = Math.max(0, currentQuiereCount - liveAfter);
    let manualValue = 0;
    let wasOverwritten = false;

    if (maxMOrLiveBefore > liveBefore) {
      manualValue = maxMOrLiveBefore;
    } else {
      // Si max(M, liveBefore) <= liveBefore, el valor manual era <= liveBefore (o era 0).
      // No podemos saber el valor manual exacto con certeza a menos que asumamos que era 0.
      manualValue = 0; 
      wasOverwritten = true;
    }

    const proposedCount = manualValue + totalLive;
    const diff = proposedCount - currentQuiereCount;

    console.log(`... Valor manual deducido: ${manualValue}`);
    if (wasOverwritten && currentQuiereCount > 0) {
      console.log(`... Nota: El valor manual original podría haber sido menor o igual a ${liveBefore} y se sobrescribió.`);
    }

    if (diff > 0) {
      console.log(`... DISCREPANCIA DETECTADA: Faltan +${diff} Quiéremes (Suma propuesta: ${proposedCount} en vez de ${currentQuiereCount})`);
      if (!dryRun) {
        console.log(`... Guardando en Firestore...`);
        await updateDoc(doc(db, 'userStats', targetKey), {
          quiereCount: proposedCount
        });
        console.log(`... Actualizado con éxito.`);
      }
    } else if (diff < 0) {
      console.log(`... El valor propuesto (${proposedCount}) es menor que el actual (${currentQuiereCount}). Manteniendo el valor actual para respetar los datos.`);
    } else {
      console.log(`... Conteo correcto. No se requiere acción.`);
    }
  }

  console.log(`\n==================================================`);
  console.log(`Auditoría finalizada.`);
}

// Para ejecutar el script:
// Node.js enviará por defecto un dryRun = true.
// Si se le pasa el argumento '--apply', aplicará los cambios reales.
const args = process.argv.slice(2);
const runReal = args.includes('--apply');

audit(!runReal).catch(console.error);
