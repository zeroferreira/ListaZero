#!/bin/bash
# Zero FM TikTok Bot macOS Launcher

# Cambiar a la carpeta del script
cd "$(dirname "$0")"

# Moverse a la carpeta del bot
cd "tiktok-bot"

clear
echo "============================================="
echo "   Iniciando Bot de Pedidos Zero FM (macOS)  "
echo "============================================="
echo ""

# Verificar si Node.js está instalado
if ! command -v node &> /dev/null
then
    echo "❌ [ERROR] Node.js no está instalado en tu Mac."
    echo "Por favor, descarga e instala Node.js desde: https://nodejs.org"
    echo "Luego vuelve a abrir este archivo."
    echo "Presiona Enter para salir..."
    read
    exit 1
fi

echo "✓ Node.js detectado: $(node -v)"
echo ""

# Instalar/verificar dependencias si no existen
if [ ! -d "node_modules" ]; then
    echo "⏳ [INFO] Instalando dependencias por primera vez..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ [ERROR] No se pudieron instalar las dependencias con npm install."
        echo "Presiona Enter para salir..."
        read
        exit 1
    fi
fi

# Abrir el panel de control en el navegador
echo "🌐 Abriendo Panel de Control..."
sleep 1
open "http://localhost:3000/"
echo ""

# Bucle de ejecución (reinicia automáticamente si se cae)
while true
do
    echo "🚀 Iniciando Bot..."
    node index.js
    EXITCODE=$?
    echo ""
    echo "⚠️ [ALERTA] El bot se detuvo (código de salida: $EXITCODE)."
    echo "⏳ Reiniciando de forma automática en 5 segundos..."
    sleep 5
done
