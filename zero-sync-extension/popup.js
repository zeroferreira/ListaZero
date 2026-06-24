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

      // 2. Enviar el sessionId al bot local en puerto 3000
      try {
        const response = await fetch('http://localhost:3000/api/tiktok/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sessionId })
        });

        const data = await response.json();
        if (data.ok) {
          statusBox.textContent = '✅ Cookie sincronizada con éxito. ¡El bot ya está autenticado!';
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
  } catch (err) {
    statusBox.textContent = '❌ Error al acceder a las cookies: ' + err.message;
    statusBox.className = 'status error';
  }
});
