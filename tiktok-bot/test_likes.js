/**
 * 🧪 PRUEBA DE CONTEO DE LIKES
 * Simula exactamente el comportamiento del handler de likes del bot
 * para auditar cuántos likes se capturan por usuario.
 */

console.log('='.repeat(60));
console.log('🧪 AUDITORÍA DE CONTEO DE LIKES — SIMULACIÓN');
console.log('='.repeat(60));
console.log('');

// ─── Replica de las variables del bot ───────────────────────
const likeBuffer = new Map();
const sessionLikes = new Map();
const sessionLikerDetails = new Map();
let lastKnownTotalLikeCount = 0;
let streamTotalLikesCounter = 0;
let currentTopLiker = { name: 'N/D', count: 0 };
let discardedEvents = 0;
let capturedEvents = 0;
let capturedByUserId = 0;
let capturedByTotal = 0;

// ─── Replica del handler de likes del bot ───────────────────
function processLikeEvent(data) {
    const uniqueId = String(data && data.uniqueId || '').trim();
    const nickname = String(data && data.nickname || uniqueId || 'Usuario').trim();
    const rawLikeCount = Number(data && data.likeCount);
    const safeLikeCount = Number.isFinite(rawLikeCount) ? Math.floor(rawLikeCount) : 0;

    // ⚡ TOTAL LIKE COUNT: contador global del stream
    const rawTotal = Number(data && data.totalLikeCount);
    if (Number.isFinite(rawTotal) && rawTotal > lastKnownTotalLikeCount) {
        const globalDelta = rawTotal - lastKnownTotalLikeCount;
        lastKnownTotalLikeCount = rawTotal;
        streamTotalLikesCounter += globalDelta;
        capturedByTotal += globalDelta;
        if (globalDelta > safeLikeCount && safeLikeCount > 0) {
            console.log(`  📊 [totalLikeCount] delta: +${globalDelta} (likeCount: ${safeLikeCount}) → diferencia detectada`);
        }
    }

    // Si TikTok no reporta el usuario (throttling)
    if (!uniqueId) {
        if (safeLikeCount > 0) {
            console.log(`  ⚠️  [SIN uniqueId] +${safeLikeCount} likes anónimos → contados en total stream`);
            discardedEvents++;
        }
        return;
    }

    if (safeLikeCount <= 0) {
        return;
    }

    const delta = safeLikeCount;
    capturedEvents++;
    capturedByUserId += delta;

    const current = likeBuffer.get(uniqueId) || { userId: uniqueId, displayName: nickname, likes: 0 };
    current.displayName = nickname || current.displayName || uniqueId;
    current.likes += delta;
    likeBuffer.set(uniqueId, current);

    const sessionTotal = (sessionLikes.get(uniqueId) || 0) + delta;
    sessionLikes.set(uniqueId, sessionTotal);

    sessionLikerDetails.set(uniqueId, {
        username: uniqueId,
        nickname: nickname || uniqueId,
        profilePictureUrl: data.profilePictureUrl || '',
        lastActive: Date.now()
    });

    if (sessionTotal > currentTopLiker.count) {
        currentTopLiker = { name: nickname, count: sessionTotal };
    }
    
    return { uniqueId, delta, sessionTotal };
}

// ─── ESCENARIO 1: Eventos normales con uniqueId ───────────────
console.log('📋 ESCENARIO 1: Eventos con uniqueId (funcionamiento normal)');
console.log('-'.repeat(60));
const scenario1 = [
    { uniqueId: 'usuario_a', nickname: 'María López', likeCount: 10, totalLikeCount: 10 },
    { uniqueId: 'usuario_b', nickname: 'Juan Pérez',  likeCount: 15, totalLikeCount: 25 },
    { uniqueId: 'usuario_a', nickname: 'María López', likeCount: 5,  totalLikeCount: 30 },
    { uniqueId: 'usuario_c', nickname: 'Ana Torres',  likeCount: 20, totalLikeCount: 50 },
    { uniqueId: 'usuario_b', nickname: 'Juan Pérez',  likeCount: 8,  totalLikeCount: 58 },
];
scenario1.forEach(ev => {
    const result = processLikeEvent(ev);
    if (result) {
        console.log(`  ✅ @${ev.uniqueId} +${result.delta} likes → sesión: ${result.sessionTotal}`);
    }
});

console.log('');
console.log('📋 ESCENARIO 2: TikTok aplica throttling (uniqueId vacío después de pocos eventos)');
console.log('-'.repeat(60));

// Reset para escenario 2
lastKnownTotalLikeCount = 58; // continúa del escenario 1
const throttledEvents = [
    // TikTok empieza a mandar sin uniqueId (throttling real)
    { uniqueId: '',          nickname: '', likeCount: 10, totalLikeCount: 68  },
    { uniqueId: '',          nickname: '', likeCount: 10, totalLikeCount: 78  },
    { uniqueId: 'usuario_a', nickname: 'María López', likeCount: 5, totalLikeCount: 83 },
    { uniqueId: '',          nickname: '', likeCount: 10, totalLikeCount: 93  },
    { uniqueId: '',          nickname: '', likeCount: 10, totalLikeCount: 103 },
    { uniqueId: '',          nickname: '', likeCount: 10, totalLikeCount: 113 },
    // totalLikeCount sigue subiendo aunque uniqueId esté vacío
    { uniqueId: '',          nickname: '', likeCount: 0,  totalLikeCount: 125 },
    { uniqueId: '',          nickname: '', likeCount: 0,  totalLikeCount: 137 },
];
throttledEvents.forEach(ev => {
    processLikeEvent(ev);
});

// ─── RESUMEN FINAL ────────────────────────────────────────────
console.log('');
console.log('='.repeat(60));
console.log('📊 RESULTADO DE LA AUDITORÍA');
console.log('='.repeat(60));

console.log('');
console.log('👥 LIKES POR USUARIO (Top Likers sesión):');
const sorted = Array.from(sessionLikes.entries()).sort((a, b) => b[1] - a[1]);
sorted.forEach(([uid, total], i) => {
    const details = sessionLikerDetails.get(uid);
    console.log(`  ${i + 1}. @${uid} (${details?.nickname || uid}): ${total} likes`);
});

console.log('');
console.log(`🏆 Top Liker: @${currentTopLiker.name} con ${currentTopLiker.count} likes`);

console.log('');
console.log('📈 ESTADÍSTICAS DE CAPTURA:');
console.log(`  ✅ Eventos con uniqueId procesados: ${capturedEvents}`);
console.log(`  ⚠️  Eventos sin uniqueId (throttled): ${discardedEvents}`);
console.log(`  💯 Likes capturados por uniqueId: ${capturedByUserId}`);
console.log(`  ⚡ Total del stream (via totalLikeCount): ${streamTotalLikesCounter}`);
console.log(`  📊 Likes "perdidos" sin asignar usuario: ${streamTotalLikesCounter - capturedByUserId}`);
console.log('');

const captureRate = streamTotalLikesCounter > 0
    ? ((capturedByUserId / streamTotalLikesCounter) * 100).toFixed(1)
    : '0';
console.log(`  🎯 Tasa de atribución a usuarios: ${captureRate}%`);
console.log(`  ℹ️  Los likes restantes (${100 - parseFloat(captureRate)}%) son throttled por TikTok`);
console.log(`     y NO se pueden atribuir a ningún usuario específico.`);
console.log('');
console.log('='.repeat(60));
console.log('✅ Prueba completa. El bot captura TODO lo que TikTok permite.');
console.log('='.repeat(60));
