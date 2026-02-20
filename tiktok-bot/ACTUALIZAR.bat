@echo off
title Actualizar Bot Zero FM
setlocal EnableExtensions
cd /d "%~dp0"
set "DEST=%CD%"
echo ==========================================
echo    Actualizando Bot de Pedidos Zero FM
echo ==========================================
echo.

set "SILENT=0"
if /I "%~1"=="/silent" set "SILENT=1"
set "REPO_URL=https://github.com/zeroferreira/ListaZero.git"
set "ZIP_URL=https://github.com/zeroferreira/ListaZero/archive/refs/heads/main.zip"
set "ZIP="
set "TMP="

for %%F in ("%DEST%") do set "FOLDER=%%~nxF"
if /I "%FOLDER%"=="Downloads" (
    echo [ERROR] Estas ejecutando ACTUALIZAR.bat dentro de la carpeta Downloads.
    echo Eso puede mezclar el bot con tus descargas.
    echo Crea una carpeta dedicada, por ejemplo: C:\ZeroFM\tiktok-bot
    echo y mueve ahi estos archivos .bat antes de ejecutar.
    if "%SILENT%"=="0" pause
    exit /b 1
)
if /I "%FOLDER%"=="Descargas" (
    echo [ERROR] Estas ejecutando ACTUALIZAR.bat dentro de la carpeta Descargas.
    echo Eso puede mezclar el bot con tus descargas.
    echo Crea una carpeta dedicada, por ejemplo: C:\ZeroFM\tiktok-bot
    echo y mueve ahi estos archivos .bat antes de ejecutar.
    if "%SILENT%"=="0" pause
    exit /b 1
)

set "BACKUP_CFG=%TEMP%\zero_fm_config_backup_%RANDOM%.json"
if exist "config.json" copy /Y "config.json" "%BACKUP_CFG%" >nul 2>&1

set "BACKUP_FIREBASE=%TEMP%\zero_fm_firebase_backup_%RANDOM%.js"
if exist "firebase-config.js" copy /Y "firebase-config.js" "%BACKUP_FIREBASE%" >nul 2>&1

where git >nul 2>&1
if errorlevel 1 goto zip

echo [INFO] Descargando TODO con Git (como antes)...
set "TMP=%TEMP%\zero_fm_update_git_%RANDOM%"
rd /s /q "%TMP%" >nul 2>&1
git clone --depth 1 "%REPO_URL%" "%TMP%"
if errorlevel 1 (
    echo [ERROR] No se pudo clonar el repositorio.
    echo Verifica internet / antivirus / permisos.
    if "%SILENT%"=="0" pause
    exit /b 1
)

if not exist "%TMP%\tiktok-bot\index.js" (
    echo [ERROR] La descarga no contiene tiktok-bot\index.js
    if "%SILENT%"=="0" pause
    exit /b 1
)
if not exist "%TMP%\tiktok-bot\package.json" (
    echo [ERROR] La descarga no contiene tiktok-bot\package.json
    if "%SILENT%"=="0" pause
    exit /b 1
)

echo [INFO] Copiando archivos al bot local (descarga completa)...
attrib -R "%DEST%\*.*" /S /D >nul 2>&1
if /I "%TMP%"=="%DEST%" (
    echo [ERROR] Seguridad: TMP y DEST coinciden. Abortando para evitar borrar/copiar mal.
    if "%SILENT%"=="0" pause
    exit /b 1
)
robocopy "%TMP%\tiktok-bot" "%DEST%" /E /COPY:DAT /DCOPY:DAT /R:3 /W:1 /XD "node_modules" "logs" ".git" /XF "config.json" "firebase-config.js" "node.exe" "npm.cmd" "npx.cmd"
set "RC=%errorlevel%"
if %RC% geq 8 (
    echo [ERROR] No se pudo copiar la actualizacion. Codigo: %RC%
    if "%SILENT%"=="0" pause
    exit /b 1
)

if defined TMP if exist "%TMP%" rd /s /q "%TMP%" >nul 2>&1
goto restorecfg

:zip
where powershell >nul 2>&1
if errorlevel 1 (
    echo [ERROR] No se encontro Git ni PowerShell.
    echo Instala Git o habilita PowerShell para poder actualizar.
    if "%SILENT%"=="0" pause
    exit /b 1
)

echo [INFO] Git no disponible. Usando descarga por ZIP...
set "ZIP=%TEMP%\zero_fm_update_%RANDOM%.zip"
set "TMP=%TEMP%\zero_fm_update_extract_%RANDOM%"

echo [INFO] Descargando ZIP...
del /q "%ZIP%" >nul 2>&1
rd /s /q "%TMP%" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $p='%ZIP%'; Invoke-WebRequest -UseBasicParsing -Uri '%ZIP_URL%' -OutFile $p; if(!(Test-Path $p)){ throw 'zip-not-downloaded' }"
if errorlevel 1 (
    echo [ERROR] No se pudo descargar el ZIP.
    if "%SILENT%"=="0" pause
    exit /b 1
)

echo [INFO] Extrayendo ZIP...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Expand-Archive -Force -Path '%ZIP%' -DestinationPath '%TMP%'"
if errorlevel 1 (
    echo [ERROR] No se pudo extraer el ZIP.
    if "%SILENT%"=="0" pause
    exit /b 1
)

if not exist "%TMP%\ListaZero-main\tiktok-bot\index.js" (
    echo [ERROR] La descarga no contiene tiktok-bot\index.js
    if "%SILENT%"=="0" pause
    exit /b 1
)
if not exist "%TMP%\ListaZero-main\tiktok-bot\package.json" (
    echo [ERROR] La descarga no contiene tiktok-bot\package.json
    if "%SILENT%"=="0" pause
    exit /b 1
)

echo [INFO] Copiando archivos al bot local...
attrib -R "%DEST%\*.*" /S /D >nul 2>&1
if /I "%TMP%"=="%DEST%" (
    echo [ERROR] Seguridad: TMP y DEST coinciden. Abortando para evitar borrar/copiar mal.
    if "%SILENT%"=="0" pause
    exit /b 1
)
robocopy "%TMP%\ListaZero-main\tiktok-bot" "%DEST%" /E /COPY:DAT /DCOPY:DAT /R:3 /W:1 /XD "node_modules" "logs" ".git" /XF "config.json" "firebase-config.js" "node.exe" "npm.cmd" "npx.cmd"
set "RC=%errorlevel%"
if %RC% geq 8 (
    echo [ERROR] No se pudo copiar la actualizacion. Codigo: %RC%
    if "%SILENT%"=="0" pause
    exit /b 1
)

:restorecfg
if exist "%BACKUP_CFG%" (
    copy /Y "%BACKUP_CFG%" "config.json" >nul 2>&1
    del /Q "%BACKUP_CFG%" >nul 2>&1
)
if exist "%BACKUP_FIREBASE%" (
    copy /Y "%BACKUP_FIREBASE%" "firebase-config.js" >nul 2>&1
    del /Q "%BACKUP_FIREBASE%" >nul 2>&1
)
echo.
if defined TMP if exist "%TMP%" rd /s /q "%TMP%" >nul 2>&1
if defined ZIP if exist "%ZIP%" del /q "%ZIP%" >nul 2>&1
echo.
echo [EXITO] Todo actualizado. (config.json se conserva)

:done
echo.
echo Presiona cualquier tecla para cerrar...
if "%SILENT%"=="0" pause
endlocal
