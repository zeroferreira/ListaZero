@echo off
title Zero FM TikTok Bot
setlocal EnableExtensions
cd /d "%~dp0"
echo ==========================================
echo    Iniciando Bot de Pedidos Zero FM
echo ==========================================
echo.

if not exist "index.js" (
    echo [ERROR] No se encontro index.js. Esta carpeta no parece ser tiktok-bot.
    echo Abre este archivo dentro de la carpeta correcta del bot.
    pause
    exit /b 1
)

echo Node (verificacion):
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta disponible en PATH.
    echo Instala Node.js LTS y reinicia la PC.
    pause
    exit /b 1
)
node -v

if not exist "node_modules" (
    echo [ERROR] Falta la carpeta node_modules (dependencias).
    echo.
    echo Solucion:
    echo 1) Abre INSTALAR_DEPENDENCIAS.bat
    echo 2) Cuando termine, vuelve a abrir INICIAR_BOT.bat
    echo.
    pause
    exit /b 1
)

:: Abrir Dashboard
echo Abriendo panel de configuracion...
set "DASH_PORT=3000"
timeout /t 1 >nul
start http://localhost:%DASH_PORT%/

:: Iniciar el bot con reconexion automatica
:loop
echo [INFO] Iniciando Bot...
node index.js
set "EXITCODE=%ERRORLEVEL%"
echo.
echo [ALERTA] El bot se cerro (codigo %EXITCODE%).
echo [INFO] Reiniciando en 5 segundos...
timeout /t 5
goto loop
