@echo off
title Reparar Bot Zero FM
echo ==========================================
echo    REPARANDO SINCRONIZACION DEL BOT
echo ==========================================
echo.
echo Este script arreglara el error "not a git repository".
echo.

:: 1. Iniciar Git si no existe
if not exist ".git" (
    echo [INFO] Inicializando repositorio Git...
    git init
    git remote add origin https://github.com/zeroferreira/ListaZero.git
)

:: 2. Forzar descarga de la ultima version
echo [INFO] Descargando ultimos archivos...
git fetch --all
git reset --hard origin/main

echo.
echo ==========================================
echo    REPARACION COMPLETADA
echo ==========================================
echo.
echo Ahora intenta abrir INICIAR_BOT.bat de nuevo.
echo.
pause