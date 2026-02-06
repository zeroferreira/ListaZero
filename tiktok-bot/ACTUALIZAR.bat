@echo off
title Actualizar Bot Zero FM
cd /d "%~dp0"
echo ==========================================
echo    Actualizando Bot de Pedidos Zero FM
echo ==========================================
echo.

setlocal EnableExtensions
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

set "TMP=%TEMP%\zero_fm_update_git_%RANDOM%"
echo [INFO] Descargando ultima version (Git clone)...
git clone --depth 1 %REPO_URL% "%TMP%" >nul 2>&1
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

robocopy "%TMP%\tiktok-bot" "%~dp0" /E /XD "node_modules" "logs" ".git" /XF "config.json" >nul
if %errorlevel% geq 8 (
    echo [ERROR] No se pudo copiar la actualizacion.
    if "%SILENT%"=="0" pause
    exit /b 1
)

if exist "%BACKUP_CFG%" (
    copy /Y "%BACKUP_CFG%" "config.json" >nul 2>&1
    del /Q "%BACKUP_CFG%" >nul 2>&1
)

rd /s /q "%TMP%" >nul 2>&1

echo.
echo [EXITO] Todo actualizado. (config.json se conserva)

:done
endlocal

echo.
echo Presiona cualquier tecla para cerrar...
if "%SILENT%"=="0" pause
