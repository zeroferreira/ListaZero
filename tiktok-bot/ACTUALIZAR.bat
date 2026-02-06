@echo off
title Actualizar Bot Zero FM
cd /d "%~dp0"
echo ==========================================
echo    Actualizando Bot de Pedidos Zero FM
echo ==========================================
echo.

:: Verificar si git esta instalado
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git no esta instalado.
    echo Para usar la sincronizacion automatica, necesitas instalar Git.
    echo Descargalo aqui: https://git-scm.com/download/win
    echo.
    pause
    exit
)

:: Intentar actualizar
echo [INFO] Buscando actualizaciones en la nube...
git pull
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] No se pudo actualizar.
    echo Posible causa: Esta carpeta no esta vinculada a GitHub.
    echo.
    echo SOLUCION RECOMENDADA:
    echo En lugar de copiar y pegar la carpeta "tiktok-bot", haz esto en tu PC de Windows:
    echo 1. Instala Git.
    echo 2. Abre una terminal (CMD o PowerShell).
    echo 3. Escribe: git clone URL_DE_TU_REPO_GITHUB
    echo 4. Usa la carpeta que se descargo.
) else (
    echo.
    echo [EXITO] Todo actualizado! Ya tienes los ultimos cambios.
)

echo.
echo Presiona cualquier tecla para cerrar...
pause
