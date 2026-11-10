@echo off
title Silphy Finanzas - Asistente Contable 24/7 (Electronicat)
color 0A
cd /d "%~dp0"

echo =======================================================
echo    SILPHY (SYLPHIETTE) - ASISTENTE DE FINANZAS
echo    Electronicat - Oficina Virtual y Taller Central
echo =======================================================
echo.
echo [*] Iniciando servidor del Agente 03 (Silphy)...
echo [*] Abriendo interfaz de chat y carga semanal en el navegador...
echo.

start "" "http://localhost:3003"
node server.js
pause
