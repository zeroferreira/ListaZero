let currentBotProfile = '';
let currentBotUser = '';

// Detectar perfil activo del bot al abrir la extensión
(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/status');
    const data = await res.json();
    if (data && (data.activeProfile || data.tiktokUsername)) {
      currentBotProfile = data.activeProfile || '';
      currentBotUser = data.tiktokUsername || currentBotProfile;
      const infoBox = document.getElementById('bot-profile-info');
      const nameEl = document.getElementById('active-profile-name');
      const userEl = document.getElementById('active-profile-user');
      if (infoBox && nameEl && userEl) {
        nameEl.textContent = currentBotProfile || 'Principal';
        userEl.textContent = '@' + currentBotUser;
        infoBox.style.display = 'block';
      }
    }
  } catch (_) {
    // Si el bot no está corriendo, se mantiene oculto
  }
})();

document.getElementById('sync-btn').addEventListener('click', async () => {
  const statusBox = document.getElementById('status-box');
  statusBox.className = 'status';
  statusBox.style.display = 'none';

  try {
    // 1. Obtener la cookie 'sessionid' para el dominio .tiktok.com
    chrome.cookies.get({
      url: 'https://www.tiktok.com',
      name: 'sessionid'
    }, async (cookie) => {
      if (!cookie || !cookie.value) {
        statusBox.textContent = '❌ No se encontró la cookie sessionid. Abre una pestaña de tiktok.com e inicia sesión primero.';
        statusBox.className = 'status error';
        return;
      }

      const sessionId = cookie.value;

      // Obtener también 'tt-target-idc' si existe
      chrome.cookies.get({
        url: 'https://www.tiktok.com',
        name: 'tt-target-idc'
      }, async (idcCookie) => {
        const ttTargetIdc = idcCookie ? idcCookie.value : '';

        // 2. Enviar sessionId y ttTargetIdc al bot local en puerto 3000
        try {
          const response = await fetch('http://localhost:3000/api/tiktok/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sessionId, ttTargetIdc })
          });

          const data = await response.json();
          if (data.ok) {
            const profileMsg = currentBotProfile ? ` para el perfil [${currentBotProfile}] (@${currentBotUser})` : '';
            statusBox.textContent = `✅ Cookies sincronizadas${profileMsg}. ¡El bot ya está autenticado!`;
            statusBox.className = 'status success';
          } else {
            statusBox.textContent = '❌ Error del bot: ' + (data.error || 'Desconocido');
            statusBox.className = 'status error';
          }
        } catch (err) {
          statusBox.textContent = '❌ No se pudo conectar al bot. Asegúrate de tener el bot ejecutándose en http://localhost:3000';
          statusBox.className = 'status error';
        }
      });
    });
  } catch (err) {
    statusBox.textContent = '❌ Error al acceder a las cookies: ' + err.message;
    statusBox.className = 'status error';
  }
});
