@echo off
title Descargar Bot Zero FM
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "DEST=%CD%"
set "LOG=%TEMP%\zero_fm_descargar_log_%RANDOM%.txt"

echo ==========================================
echo    DESCARGAR ARCHIVOS DEL BOT (GitHub)
echo ==========================================
echo.
echo Este script descarga la ultima version del bot y la copia aqui.
echo Si al final dice "0 archivos copiados", es porque ya estabas actualizado.
echo.
echo [INFO] Log: "%LOG%"
echo.

set "REPO_URL=https://github.com/zeroferreira/ListaZero.git"
set "CLEAN=0"
set "SILENT=0"
if /I "%~1"=="/limpio" set "CLEAN=1"
if /I "%~1"=="/silent" set "SILENT=1"
if /I "%~2"=="/silent" set "SILENT=1"
if /I "%~2"=="/limpio" set "CLEAN=1"

echo ==== INICIO ==== > "%LOG%" 2>&1
echo Carpeta: "%DEST%" >> "%LOG%" 2>&1
echo Args: %* >> "%LOG%" 2>&1
echo Repo: %REPO_URL% >> "%LOG%" 2>&1
echo. >> "%LOG%" 2>&1

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

echo [INFO] Intentando descarga con Git...
call :download_with_git
if errorlevel 1 (
  echo [ALERTA] Git fallo. Intentando descarga alternativa (ZIP)...
  echo Git fallo. Intentando ZIP... >> "%LOG%" 2>&1
  call :download_with_zip
  if errorlevel 1 (
    echo [ERROR] No se pudo descargar con Git ni con ZIP.
    echo Revisa el log: "%LOG%"
    echo.
    if "%SILENT%"=="0" pause
    exit /b 1
  )
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
exit /b 0

:download_with_git
where git >> "%LOG%" 2>&1
if errorlevel 1 (
  echo Git no encontrado en PATH >> "%LOG%" 2>&1
  exit /b 10
)
git --version >> "%LOG%" 2>&1
if errorlevel 1 exit /b 11

echo [INFO] Preparando descarga (Git)...
echo Preparando descarga Git... >> "%LOG%" 2>&1

if exist "%CACHE%\.git\config" (
  echo [INFO] Actualizando cache (solo descarga cambios)...
  git -C "%CACHE%" remote set-url origin "%REPO_URL%" >> "%LOG%" 2>&1
  git -C "%CACHE%" fetch --prune origin main >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo [ALERTA] Fallo fetch. Reintentando con descarga limpia...
    rd /s /q "%CACHE%" >> "%LOG%" 2>&1
  )
)

if not exist "%CACHE%\.git\config" (
  echo [INFO] Descargando repositorio (primera vez)...
  rd /s /q "%CACHE%" >> "%LOG%" 2>&1
  git clone --depth 1 "%REPO_URL%" "%CACHE%" >> "%LOG%" 2>&1
  if errorlevel 1 exit /b 12
)

git -C "%CACHE%" reset --hard origin/main >> "%LOG%" 2>&1
if errorlevel 1 exit /b 13
git -C "%CACHE%" clean -fd >> "%LOG%" 2>&1
if errorlevel 1 exit /b 14

if not exist "%CACHE%\tiktok-bot\index.js" exit /b 15

set "HEAD="
for /f "usebackq delims=" %%H in (`git -C "%CACHE%" rev-parse --short HEAD 2^>nul`) do set "HEAD=%%H"
if not "%HEAD%"=="" echo [INFO] Version descargada: %HEAD%

echo.
echo [INFO] Copiando archivos al bot local...
attrib -R "%DEST%\*.*" /S /D >> "%LOG%" 2>&1
robocopy "%CACHE%\tiktok-bot" "%DEST%" /E /COPY:DAT /DCOPY:DAT /R:5 /W:1 /XD "node_modules" "logs" ".git" /XF "config.json" >> "%LOG%" 2>&1
set "RC=%errorlevel%"
echo Robocopy RC=%RC% >> "%LOG%" 2>&1
if %RC% geq 8 exit /b 16

echo [INFO] Cache: "%CACHE%"
exit /b 0

:download_with_zip
where powershell >> "%LOG%" 2>&1
if errorlevel 1 exit /b 20
set "ZIP=%TEMP%\zero_fm_repo_%RANDOM%.zip"
set "TMP=%TEMP%\zero_fm_repo_extract_%RANDOM%"
set "ZIP_URL=https://github.com/zeroferreira/ListaZero/archive/refs/heads/main.zip"

rd /s /q "%TMP%" >> "%LOG%" 2>&1
del /q "%ZIP%" >> "%LOG%" 2>&1

echo [INFO] Descargando ZIP...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $p='%ZIP%'; Invoke-WebRequest -UseBasicParsing -Uri '%ZIP_URL%' -OutFile $p; if(!(Test-Path $p)){ throw 'zip-not-downloaded' }" >> "%LOG%" 2>&1
if errorlevel 1 exit /b 21

echo [INFO] Extrayendo ZIP...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Expand-Archive -Force -Path '%ZIP%' -DestinationPath '%TMP%'" >> "%LOG%" 2>&1
if errorlevel 1 exit /b 22

if not exist "%TMP%\ListaZero-main\tiktok-bot\index.js" exit /b 23

echo.
echo [INFO] Copiando archivos al bot local...
attrib -R "%DEST%\*.*" /S /D >> "%LOG%" 2>&1
robocopy "%TMP%\ListaZero-main\tiktok-bot" "%DEST%" /E /COPY:DAT /DCOPY:DAT /R:5 /W:1 /XD "node_modules" "logs" ".git" /XF "config.json" >> "%LOG%" 2>&1
set "RC=%errorlevel%"
echo Robocopy RC=%RC% >> "%LOG%" 2>&1
if %RC% geq 8 exit /b 24

echo [INFO] ZIP temporal: "%TMP%"
exit /b 0
