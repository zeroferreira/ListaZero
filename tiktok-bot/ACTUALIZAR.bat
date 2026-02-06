@echo off
title Actualizar Bot Zero FM
if /I "%~1" NEQ "/child" (
  start "Actualizar Bot Zero FM" cmd /k ""%~f0" /child %*"
  exit /b
)

setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "DEST=%CD%"
echo ==========================================
echo    Actualizando Bot de Pedidos Zero FM
echo ==========================================
echo.

set "SILENT=0"
if /I "%~2"=="/silent" set "SILENT=1"
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

set "TMP=%TEMP%\zero_fm_update_git_%RANDOM%"
echo [INFO] Descargando ultima version (Git clone)...
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

echo [INFO] Copiando archivos al bot local...
attrib -R "%DEST%\*.*" /S /D >nul 2>&1
robocopy "%TMP%\tiktok-bot" "%DEST%" /E /COPY:DAT /DCOPY:DAT /R:3 /W:1 /XD "node_modules" "logs" ".git" /XF "config.json"
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
rd /s /q "%TMP%" >nul 2>&1
echo.
echo [EXITO] Todo actualizado. (config.json se conserva)

:done
endlocal


echo.
echo Presiona cualquier tecla para cerrar...
if "%SILENT%"=="0" pause
