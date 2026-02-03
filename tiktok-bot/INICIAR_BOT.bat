@echo off
title Zero FM TikTok Bot
echo ==========================================
echo    Iniciando Bot de Pedidos Zero FM
echo ==========================================
echo.

:: Comprobar si Node.js esta instalado
node -v >nul 2>&1
if %errorlevel% equ 0 goto check_modules

:: Intento 2: Buscar en rutas comunes
if exist "C:\Program Files\nodejs\node.exe" (
    set "PATH=%PATH%;C:\Program Files\nodejs"
    goto check_modules
)
if exist "C:\Program Files (x86)\nodejs\node.exe" (
    set "PATH=%PATH%;C:\Program Files (x86)\nodejs"
    goto check_modules
)

:: Si falla todo, preguntar al usuario
cls
echo ================================================================
echo [ATENCION] No se detecta Node.js automaticamente
echo ================================================================
echo.
echo Posibles causas:
echo 1. No lo has instalado todavia.
echo 2. Lo acabas de instalar y Windows necesita reiniciar.
echo.
echo OPCIONES:
echo [1] Descargar Node.js ahora (Recomendado si no lo tienes)
echo [2] Ya lo instale, intentar iniciar de todas formas
echo.
set /p opcion="Escribe 1 o 2 y presiona ENTER: "

if "%opcion%"=="2" goto check_modules

:: Opcion 1 o cualquier otra cosa -> Ir a descargar
echo.
echo Abriendo pagina de descarga...
start https://nodejs.org/
echo.
echo Instala la version "LTS" y luego REINICIA TU PC si sigue fallando.
pause
exit

:check_modules
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
