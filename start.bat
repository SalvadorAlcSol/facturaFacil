@echo off
echo ===================================================
echo   Iniciando Automatizador de Facturas de Gasolina
echo ===================================================
echo.
echo [1/2] Verificando e instalando dependencias...
call npm install
if %ERRORLEVEL% neq 0 (
    echo Error al instalar dependencias de Node.js.
    pause
    exit /b %ERRORLEVEL%
)
echo.
echo [2/2] Iniciando servidor de desarrollo...
echo La aplicacion estara disponible en: http://localhost:3000
echo.
npm run dev
pause
