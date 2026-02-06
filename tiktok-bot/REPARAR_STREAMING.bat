@echo off
title Reparar Bot Zero FM
cd /d "%~dp0"
echo ==========================================
echo    REPARANDO SINCRONIZACION DEL BOT
echo ==========================================
echo.
echo Este script arreglara el error "not a git repository".
echo.

git --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git no esta instalado.
    echo Instala Git para poder reparar/actualizar.
    echo Descarga: https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

setlocal EnableExtensions
set "REPO_URL=https://github.com/zeroferreira/ListaZero.git"
set "BACKUP_CFG=%TEMP%\zero_fm_config_backup_%RANDOM%.json"
if exist "config.json" (
    copy /Y "config.json" "%BACKUP_CFG%" >nul 2>&1
)

:: 1. Iniciar Git si no existe
if not exist ".git" (
    echo [INFO] Inicializando repositorio Git...
    git init
    git remote add origin %REPO_URL%
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    git remote add origin %REPO_URL% >nul 2>&1
)

:: 2. Forzar descarga de la ultima version
echo [INFO] Descargando ultimos archivos...
git fetch --all
git reset --hard origin/main

if exist "%BACKUP_CFG%" (
    copy /Y "%BACKUP_CFG%" "config.json" >nul 2>&1
    del /Q "%BACKUP_CFG%" >nul 2>&1
)

echo.
echo ==========================================
echo    REPARACION COMPLETADA
echo ==========================================
echo.
echo Ahora intenta abrir INICIAR_BOT.bat de nuevo.
echo.
pause
