@echo off
title Actualizar Bot Zero FM
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "DEST=%CD%"
echo ==========================================
echo    Actualizando Bot de Pedidos Zero FM
echo ==========================================
echo.

set "SILENT=0"
if /I "%~1"=="/silent" set "SILENT=1"
set "REPO_URL=https://github.com/zeroferreira/ListaZero.git"

git --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git no esta instalado.
    echo Instala Git para poder actualizar.
    echo Descarga: https://git-scm.com/download/win
    if "%SILENT%"=="0" pause
    exit /b 1
)

set "BACKUP_CFG=%TEMP%\zero_fm_config_backup_%RANDOM%.json"
if exist "config.json" copy /Y "config.json" "%BACKUP_CFG%" >nul 2>&1

set "CACHE_BASE=%LOCALAPPDATA%\ZeroFM"
if "%LOCALAPPDATA%"=="" set "CACHE_BASE=%TEMP%\ZeroFM"
if not exist "%CACHE_BASE%" md "%CACHE_BASE%" >nul 2>&1
set "CACHE=%CACHE_BASE%\ListaZero_cache"

echo [INFO] Comprobando cache de actualizacion...
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
    echo [INFO] Creando cache (primera vez)...
    rd /s /q "%CACHE%" >nul 2>&1
    git clone --depth 1 "%REPO_URL%" "%CACHE%"
    if errorlevel 1 (
        echo [ERROR] No se pudo descargar el repositorio.
        echo Verifica internet / antivirus / permisos.
        if "%SILENT%"=="0" pause
        exit /b 1
    )
)

git -C "%CACHE%" reset --hard origin/main >nul 2>&1
git -C "%CACHE%" clean -fd >nul 2>&1

if not exist "%CACHE%\tiktok-bot\index.js" (
    echo [ERROR] La descarga no contiene tiktok-bot\index.js
    if "%SILENT%"=="0" pause
    exit /b 1
)

echo [INFO] Copiando archivos al bot local...
attrib -R "%DEST%\*.*" /S /D >nul 2>&1
echo [INFO] Verificando y reemplazando solo lo desactualizado...
echo (Si no hay cambios, robocopy copiara 0 archivos.)
robocopy "%CACHE%\tiktok-bot" "%DEST%" /MIR /COPY:DAT /DCOPY:DAT /R:3 /W:1 /XD "node_modules" "logs" ".git" /XF "config.json"
set "RC=%errorlevel%"
if %RC% geq 8 (
    echo [ERROR] No se pudo copiar la actualizacion. Codigo: %RC%
    if "%SILENT%"=="0" pause
    exit /b 1
)

if exist "%BACKUP_CFG%" (
    copy /Y "%BACKUP_CFG%" "config.json" >nul 2>&1
    del /Q "%BACKUP_CFG%" >nul 2>&1
)
echo.
echo [INFO] Cache: "%CACHE%"

echo.
echo [EXITO] Todo actualizado. (config.json se conserva)

:done
endlocal

echo.
echo Presiona cualquier tecla para cerrar...
if "%SILENT%"=="0" pause
