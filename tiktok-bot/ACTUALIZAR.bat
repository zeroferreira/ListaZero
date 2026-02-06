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
if exist "config.json" (
    copy /Y "config.json" "%BACKUP_CFG%" >nul 2>&1
)

if not exist ".git" (
    echo [INFO] Inicializando repositorio Git...
    git init
    git remote add origin %REPO_URL% >nul 2>&1
) else (
    git remote get-url origin >nul 2>&1
    if errorlevel 1 (
        git remote add origin %REPO_URL% >nul 2>&1
    )
)

echo [INFO] Actualizando via Git...
git fetch --all
if errorlevel 1 (
    echo [ERROR] git fetch fallo.
    if exist "%BACKUP_CFG%" copy /Y "%BACKUP_CFG%" "config.json" >nul 2>&1
    if "%SILENT%"=="0" pause
    exit /b 1
)

git reset --hard origin/main
if errorlevel 1 (
    echo [ERROR] git reset fallo.
    if exist "%BACKUP_CFG%" copy /Y "%BACKUP_CFG%" "config.json" >nul 2>&1
    if "%SILENT%"=="0" pause
    exit /b 1
)

if exist "%BACKUP_CFG%" (
    copy /Y "%BACKUP_CFG%" "config.json" >nul 2>&1
    del /Q "%BACKUP_CFG%" >nul 2>&1
)

echo.
echo [EXITO] Todo actualizado via Git. (config.json se conserva)

:done
endlocal

echo.
echo Presiona cualquier tecla para cerrar...
if "%SILENT%"=="0" pause
