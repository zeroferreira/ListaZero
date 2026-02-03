@echo off
title Zero FM TikTok Bot
echo ==========================================
echo    Iniciando Bot de Pedidos Zero FM
echo ==========================================
echo.

:: Comprobar si Node.js esta instalado
node -v >nul 2>&1
if %errorlevel% neq 0 (
    cls
    echo ================================================================
    echo [ERROR] FALTA UN PROGRAMA NECESARIO (Node.js)
    echo ================================================================
    echo.
    echo Para que el bot funcione, necesitas instalar "Node.js".
    echo.
    echo 1. Se abrira la pagina de descarga automaticamente.
    echo 2. Descarga la version "LTS" e instalala (Siguiente, Siguiente...).
    echo 3. Cuando termines, vuelve a abrir este archivo.
    echo.
    echo Presiona cualquier tecla para ir a la descarga...
    pause >nul
    start https://nodejs.org/
    exit
)

:: Instalar dependencias si no existen
if not exist "node_modules" (
    echo [INFO] Primera vez iniciando. Instalando librerias necesarias...
    echo Esto puede tardar unos minutos. Por favor espera.
    call npm install
    cls
    echo ==========================================
    echo    Iniciando Bot de Pedidos Zero FM
    echo ==========================================
    echo.
)

:: Abrir Dashboard
echo Abriendo panel de configuracion...
start http://localhost:3000/

:: Iniciar el bot con reconexion automatica
:loop
echo [INFO] Iniciando Bot...
node index.js
echo.
echo [ALERTA] El bot se cerro inesperadamente.
echo [INFO] Reiniciando en 5 segundos...
timeout /t 5
goto loop
