@echo off
title Zero FM TikTok Bot
cd /d "%~dp0"
echo ==========================================
echo    Iniciando Bot de Pedidos Zero FM
echo ==========================================
echo.

:: Comprobar si Node.js esta instalado
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ADVERTENCIA] No se detecto Node.js en el comando global.
    echo Intentando buscar en rutas alternativas...
    
    if exist "C:\Program Files\nodejs\node.exe" set "PATH=%PATH%;C:\Program Files\nodejs"
    if exist "C:\Program Files (x86)\nodejs\node.exe" set "PATH=%PATH%;C:\Program Files (x86)\nodejs"
)

:: Intentar iniciar sin bloquear
goto check_modules

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
node index.js
echo.
echo [ALERTA] El bot se cerro inesperadamente.
echo [INFO] Reiniciando en 5 segundos...
timeout /t 5
goto loop
