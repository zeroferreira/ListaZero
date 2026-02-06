@echo off
title Reparar Streaming (Renombrado)
cd /d "%~dp0"
echo ==========================================
echo    ESTE ARCHIVO FUE RENOMBRADO
echo ==========================================
echo.
echo Ahora se llama: DESCARGAR.bat
echo.
echo Ejecutando DESCARGAR.bat %*
echo.
call "%~dp0DESCARGAR.bat" %*
