@echo off
title Zero FM TikTok Bot
setlocal EnableExtensions
cd /d "%~dp0"
set "LOGDIR=%~dp0logs"
set "LOGFILE=%LOGDIR%\startup.log"
if not exist "%LOGDIR%" mkdir "%LOGDIR%" 2>nul
echo ============================== > "%LOGFILE%"
echo Zero FM TikTok Bot Startup     >> "%LOGFILE%"
echo %date% %time%                  >> "%LOGFILE%"
echo ============================== >> "%LOGFILE%"
echo ==========================================
echo    Iniciando Bot de Pedidos Zero FM
echo ==========================================
echo.
echo Log: %LOGFILE%

:: Comprobar si Node.js esta instalado
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] No se detecto Node.js en PATH.>> "%LOGFILE%"
)
node -v >nul 2>&1
if errorlevel 1 (
    echo [ADVERTENCIA] No se detecto Node.js en el comando global.
    echo Intentando buscar en rutas alternativas...
    
    if exist "C:\Program Files\nodejs\node.exe" set "PATH=%PATH%;C:\Program Files\nodejs"
    if exist "C:\Program Files (x86)\nodejs\node.exe" set "PATH=%PATH%;C:\Program Files (x86)\nodejs"
)

node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] No se pudo ejecutar Node.js. Instala Node.js LTS (incluye npm).>> "%LOGFILE%"
    echo [ERROR] No se pudo ejecutar Node.js. Instala Node.js (incluye npm).
    echo Log: %LOGFILE%
    pause
    exit /b 1
)

npm -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] No se pudo ejecutar npm. Reinstala Node.js (con npm).>> "%LOGFILE%"
    echo [ERROR] No se pudo ejecutar npm. Reinstala Node.js (con npm).
    echo Log: %LOGFILE%
    pause
    exit /b 1
)

node -v >> "%LOGFILE%" 2>&1
npm -v >> "%LOGFILE%" 2>&1

if not exist "index.js" (
    echo [ERROR] No se encontro index.js en esta carpeta.>> "%LOGFILE%"
    echo [ERROR] No se encontro index.js. Esta carpeta no parece ser tiktok-bot.
    echo Abre este archivo dentro de la carpeta correcta del bot.
    echo Log: %LOGFILE%
    pause
    exit /b 1
)

:: Intentar iniciar sin bloquear
goto check_modules

:check_modules
:: Instalar dependencias si no existen
if not exist "node_modules" (
    echo [INFO] Primera vez iniciando. Instalando librerias necesarias...
    echo Esto puede tardar unos minutos. Por favor espera.
    call npm install >> "%LOGFILE%" 2>&1
    if errorlevel 1 (
        echo [ERROR] npm install fallo. Revisa el log: %LOGFILE%
        type "%LOGFILE%" | more
        pause
        exit /b 1
    )
    cls
    echo ==========================================
    echo    Iniciando Bot de Pedidos Zero FM
    echo ==========================================
    echo.
)

:: Auto-reparar dependencias si faltan (por updates)
if not exist "node_modules\socket.io\package.json" (
    echo [INFO] Actualizando librerias (socket.io faltante)...
    call npm install >> "%LOGFILE%" 2>&1
    if errorlevel 1 (
        echo [ERROR] npm install fallo. Revisa el log: %LOGFILE%
        type "%LOGFILE%" | more
        pause
        exit /b 1
    )
)
if not exist "node_modules\firebase\package.json" (
    echo [INFO] Actualizando librerias (firebase faltante)...
    call npm install >> "%LOGFILE%" 2>&1
    if errorlevel 1 (
        echo [ERROR] npm install fallo. Revisa el log: %LOGFILE%
        type "%LOGFILE%" | more
        pause
        exit /b 1
    )
)

:: Abrir Dashboard
echo Abriendo panel de configuracion...
set "DASH_PORT=3000"
if exist "config.json" (
  for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "try { $j=(Get-Content 'config.json' -Raw | ConvertFrom-Json); if($j.dashboardPort){$j.dashboardPort}else{3000} } catch { 3000 }"`) do set "DASH_PORT=%%p"
)
if "%DASH_PORT%"=="" set "DASH_PORT=3000"
timeout /t 1 >nul
start http://localhost:%DASH_PORT%/

:: Iniciar el bot con reconexion automatica
:loop
echo [INFO] Iniciando Bot...
echo [INFO] Iniciando Bot... >> "%LOGFILE%"
node index.js >> "%LOGFILE%" 2>&1
echo.
echo [ALERTA] El bot se cerro inesperadamente.
echo [ALERTA] El bot se cerro inesperadamente. >> "%LOGFILE%"
echo Revisa el log: %LOGFILE%
echo.
echo Ultimas lineas del log:
powershell -NoProfile -Command "try { Get-Content -Path '%LOGFILE%' -Tail 40 } catch { }"
echo [INFO] Reiniciando en 5 segundos...
timeout /t 5
goto loop

pause
