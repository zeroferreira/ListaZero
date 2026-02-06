@echo off
title Descargar Bot Zero FM
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "DEST=%CD%"

echo ==========================================
echo    DESCARGAR ARCHIVOS DEL BOT (GitHub)
echo ==========================================
echo.
echo Este script descarga la ultima version del bot y la copia aqui.
echo Si al final dice "0 archivos copiados", es porque ya estabas actualizado.
echo.

set "REPO_URL=https://github.com/zeroferreira/ListaZero.git"
set "CLEAN=0"
set "SILENT=0"
if /I "%~1"=="/limpio" set "CLEAN=1"
if /I "%~1"=="/silent" set "SILENT=1"
if /I "%~2"=="/silent" set "SILENT=1"
if /I "%~2"=="/limpio" set "CLEAN=1"

git --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git no esta instalado.
  echo Instala Git para poder descargar/actualizar.
  echo Descarga: https://git-scm.com/download/win
  echo.
  if "%SILENT%"=="0" pause
  exit /b 1
)

set "BACKUP_CFG=%TEMP%\zero_fm_config_backup_%RANDOM%.json"
if exist "config.json" copy /Y "config.json" "%BACKUP_CFG%" >nul 2>&1

set "CACHE_BASE=%LOCALAPPDATA%\ZeroFM"
if "%LOCALAPPDATA%"=="" set "CACHE_BASE=%TEMP%\ZeroFM"
if not exist "%CACHE_BASE%" md "%CACHE_BASE%" >nul 2>&1
set "CACHE=%CACHE_BASE%\ListaZero_cache"

if "%CLEAN%"=="1" (
  echo [INFO] Descarga limpia solicitada. Borrando cache...
  rd /s /q "%CACHE%" >nul 2>&1
)

echo [INFO] Preparando descarga...
if exist "%CACHE%\.git\config" (
  echo [INFO] Actualizando cache (solo descarga cambios)...
  git -C "%CACHE%" remote set-url origin "%REPO_URL%" >nul 2>&1
  git -C "%CACHE%" fetch --prune origin main
  if errorlevel 1 (
    echo [ALERTA] Fallo fetch. Reintentando con descarga limpia...
    rd /s /q "%CACHE%" >nul 2>&1
  )
)

if not exist "%CACHE%\.git\config" (
  echo [INFO] Descargando repositorio (primera vez)...
  rd /s /q "%CACHE%" >nul 2>&1
  git clone --depth 1 "%REPO_URL%" "%CACHE%"
  if errorlevel 1 (
    echo [ERROR] No se pudo descargar el repositorio.
    echo Verifica internet / antivirus / permisos.
    echo.
    if "%SILENT%"=="0" pause
    exit /b 1
  )
)

git -C "%CACHE%" reset --hard origin/main
if errorlevel 1 (
  echo [ERROR] No se pudo aplicar la version mas nueva (reset --hard).
  echo.
  if "%SILENT%"=="0" pause
  exit /b 1
)
git -C "%CACHE%" clean -fd >nul 2>&1

if not exist "%CACHE%\tiktok-bot\index.js" (
  echo [ERROR] La descarga no contiene tiktok-bot\index.js
  echo.
  if "%SILENT%"=="0" pause
  exit /b 1
)

for /f "usebackq delims=" %%H in (`git -C "%CACHE%" rev-parse --short HEAD 2^>nul`) do set "HEAD=%%H"
if not "%HEAD%"=="" (
  echo [INFO] Version descargada: %HEAD%
)

echo.
echo [INFO] Copiando archivos al bot local...
attrib -R "%DEST%\*.*" /S /D >nul 2>&1
robocopy "%CACHE%\tiktok-bot" "%DEST%" /E /COPY:DAT /DCOPY:DAT /R:5 /W:1 /XD "node_modules" "logs" ".git" /XF "config.json"
set "RC=%errorlevel%"
if %RC% geq 8 (
  echo [ERROR] No se pudo copiar la descarga. Codigo: %RC%
  echo Causas comunes:
  echo - Tienes archivos abiertos/bloqueados (cierra el bot y vuelve a intentar)
  echo - Antivirus bloquea la copia
  echo - Carpeta con permisos raros (usa C:\ZeroFM\tiktok-bot)
  echo.
  if "%SILENT%"=="0" pause
  exit /b 1
)

if exist "%BACKUP_CFG%" (
  copy /Y "%BACKUP_CFG%" "config.json" >nul 2>&1
  del /Q "%BACKUP_CFG%" >nul 2>&1
)

echo.
echo [INFO] Cache: "%CACHE%"
echo [EXITO] Descarga completada.
echo.
if "%SILENT%"=="0" pause
endlocal
