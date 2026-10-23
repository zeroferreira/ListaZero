#!/bin/bash
# Actualizar Bot Zero FM - macOS

# Cambiar a la carpeta del script
cd "$(dirname "$0")"

SILENT=0
if [ "$1" = "--silent" ] || [ "$1" = "/silent" ]; then
    SILENT=1
fi

if [ $SILENT -eq 0 ]; then
    clear
fi
echo "============================================="
echo "   Actualizando Bot de Pedidos Zero FM (Mac) "
echo "============================================="
echo ""

# Verificar si git está instalado
if ! command -v git &> /dev/null
then
    echo "❌ [ERROR] Git no está instalado o no es accesible."
    echo "Por favor, instala la Command Line Tools de Xcode ejecutando en una Terminal:"
    echo "xcode-select --install"
    echo ""
    if [ $SILENT -eq 0 ]; then
        echo "Presiona Enter para salir..."
        read
    fi
    exit 1
fi

# Respaldar perfiles y configuraciones locales (cookies de sesión, perfil activo) antes de actualizar
BACKUP_DIR="/tmp/zero_fm_mac_backup_$$"
mkdir -p "$BACKUP_DIR"
if [ -d "tiktok-bot/profiles" ]; then
    cp -R "tiktok-bot/profiles" "$BACKUP_DIR/profiles"
fi
if [ -f "tiktok-bot/config.json" ]; then
    cp "tiktok-bot/config.json" "$BACKUP_DIR/config.json"
fi
if [ -f "tiktok-bot/firebase-config.js" ]; then
    cp "tiktok-bot/firebase-config.js" "$BACKUP_DIR/firebase-config.js"
fi

# Descartar posibles conflictos en perfiles/compilados antes del pull y luego restaurar respaldos
git checkout -- tiktok-bot/profiles tiktok-bot/public 2>/dev/null || true

echo "⏳ Descargando las últimas actualizaciones desde GitHub..."
git pull origin main
PULL_STATUS=$?

# Restaurar perfiles y configuraciones respaldadas
if [ -d "$BACKUP_DIR/profiles" ]; then
    cp -R "$BACKUP_DIR/profiles/"* "tiktok-bot/profiles/" 2>/dev/null || true
fi
if [ -f "$BACKUP_DIR/config.json" ]; then
    cp "$BACKUP_DIR/config.json" "tiktok-bot/config.json" 2>/dev/null || true
fi
if [ -f "$BACKUP_DIR/firebase-config.js" ]; then
    cp "$BACKUP_DIR/firebase-config.js" "tiktok-bot/firebase-config.js" 2>/dev/null || true
fi
rm -rf "$BACKUP_DIR"

if [ $PULL_STATUS -eq 0 ]; then
    echo ""
    echo "✅ [ÉXITO] Código actualizado correctamente (sesiones y perfiles conservados)."
    
    # Si cambió el package.json de tiktok-bot, reinstalar dependencias y recompilar dashboard
    if [ -f "tiktok-bot/package.json" ]; then
        echo ""
        echo "⏳ [INFO] Sincronizando dependencias y compilando Dashboard..."
        cd tiktok-bot
        npm install --silent
        if [ -f "compile_dashboard.js" ]; then
            node compile_dashboard.js
        fi
        cd ..
    fi

    # ─── REINICIAR EL BOT para que cargue los nuevos archivos ───
    echo ""
    echo "🔄 Reiniciando el Bot para aplicar los cambios..."
    # Matar el proceso node que está en la carpeta tiktok-bot
    BOT_PID=$(pgrep -f "node index.js" | head -1)
    if [ -n "$BOT_PID" ]; then
        echo "   ⏹  Deteniendo proceso anterior (PID $BOT_PID)..."
        kill "$BOT_PID"
        sleep 2
        echo "   ✅ Bot detenido. El INICIAR_BOT lo reiniciará automáticamente."
    else
        echo "   ℹ️  No se encontró un proceso del bot corriendo. No hay nada que reiniciar."
        echo "      Abre INICIAR_BOT.command para arrancar el bot con los cambios nuevos."
    fi

    echo ""
    echo "🎉 ¡Todo listo y al día! Recuerda recargar el Dashboard en el navegador (Cmd+Shift+R)."
else
    echo ""
    echo "❌ [ERROR] Hubo un problema al sincronizar con GitHub."
    echo "Si realizaste cambios manuales en los archivos locales, puede haber conflictos."
    echo "Puedes resolverlos o consultar con soporte."
fi

if [ $SILENT -eq 0 ]; then
    echo ""
    echo "Presiona Enter para salir..."
    read
fi
