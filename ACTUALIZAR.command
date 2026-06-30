#!/bin/bash
# Actualizar Bot Zero FM - macOS

# Cambiar a la carpeta del script
cd "$(dirname "$0")"

clear
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
    echo "Presiona Enter para salir..."
    read
    exit 1
fi

echo "⏳ Descargando las últimas actualizaciones desde GitHub..."
git pull origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ [ÉXITO] Código actualizado correctamente."
    
    # Si cambió el package.json de tiktok-bot, reinstalar dependencias
    if [ -f "tiktok-bot/package.json" ]; then
        echo ""
        echo "⏳ [INFO] Sincronizando dependencias en la carpeta tiktok-bot..."
        cd tiktok-bot
        npm install
        cd ..
    fi
    
    echo ""
    echo "🎉 ¡Todo listo y al día!"
else
    echo ""
    echo "❌ [ERROR] Hubo un problema al sincronizar con GitHub."
    echo "Si realizaste cambios manuales en los archivos locales, puede haber conflictos."
    echo "Puedes resolverlos o consultar con soporte."
fi

echo ""
echo "Presiona Enter para salir..."
read
