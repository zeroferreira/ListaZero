@echo off
title Actualizar Bot Zero FM
cd /d "%~dp0"
echo ==========================================
echo    Actualizando Bot de Pedidos Zero FM
echo ==========================================
echo.

setlocal EnableExtensions
set "REPO_URL=https://github.com/zeroferreira/ListaZero.git"
set "ZIP_URL=https://github.com/zeroferreira/ListaZero/archive/refs/heads/main.zip"

:: Metodo 1: Git (si existe .git)
if exist ".git" (
    git --version >nul 2>&1
    if %errorlevel% equ 0 (
        echo [INFO] Actualizando via Git...
        git remote get-url origin >nul 2>&1
        if %errorlevel% neq 0 (
            git remote add origin %REPO_URL% >nul 2>&1
        )
        git fetch --all
        if %errorlevel% neq 0 goto fallback_zip
        git reset --hard origin/main
        if %errorlevel% neq 0 goto fallback_zip
        echo.
        echo [EXITO] Todo actualizado via Git.
        goto done
    )
)

:fallback_zip
echo [INFO] Actualizando via descarga (ZIP)...
powershell -NoProfile -Command "try { $ProgressPreference='SilentlyContinue'; $zip='%ZIP_URL%'; $temp=Join-Path $env:TEMP ('zero_fm_update_'+(Get-Random)); New-Item -ItemType Directory -Path $temp -Force | Out-Null; $zipFile=Join-Path $temp 'repo.zip'; Invoke-WebRequest -Uri $zip -OutFile $zipFile -UseBasicParsing; Expand-Archive -Path $zipFile -DestinationPath $temp -Force; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] No se pudo descargar/extraer la actualizacion.
    echo Verifica tu conexion a internet y vuelve a intentar.
    echo.
    pause
    exit /b 1
)

for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "Join-Path $env:TEMP (Get-ChildItem $env:TEMP -Filter 'zero_fm_update_*' | Sort-Object LastWriteTime -Descending | Select-Object -First 1).Name"`) do set "TEMP_DIR=%%T"
if "%TEMP_DIR%"=="" (
    echo [ERROR] No se encontro carpeta temporal de actualizacion.
    pause
    exit /b 1
)

set "SRC=%TEMP_DIR%\ListaZero-main\tiktok-bot"
if not exist "%SRC%\index.js" (
    echo [ERROR] La estructura descargada no es valida.
    echo Carpeta: %SRC%
    pause
    exit /b 1
)

robocopy "%SRC%" "%~dp0" /E /XD "node_modules" "logs" ".git" /XF "config.json" >nul
if %errorlevel% geq 8 (
    echo [ERROR] No se pudo copiar la actualizacion.
    echo Code: %errorlevel%
    pause
    exit /b 1
)

powershell -NoProfile -Command "try { Remove-Item -Recurse -Force '%TEMP_DIR%' } catch {}" >nul 2>&1
echo.
echo [EXITO] Todo actualizado via descarga (ZIP). (config.json se conserva)

:done
endlocal

echo.
echo Presiona cualquier tecla para cerrar...
pause
