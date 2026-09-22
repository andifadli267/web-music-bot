@echo off
title Share Nava Web Dashboard Online
cd /d "%~dp0"

echo ==========================================================
echo       Nava Web Dashboard - Public Online Sharing
echo ==========================================================
echo.
echo Membuka akses publik agar website lokal Anda bisa dilihat
echo oleh orang lain melalui internet (Cloudflare Tunnel)...
echo.

set CLOUDFLARED_CMD=
where cloudflared >nul 2>nul
if %errorlevel% equ 0 (
    set CLOUDFLARED_CMD=cloudflared
) else if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" (
    set "CLOUDFLARED_CMD=C:\Program Files (x86)\cloudflared\cloudflared.exe"
) else if exist "C:\Program Files\cloudflared\cloudflared.exe" (
    set "CLOUDFLARED_CMD=C:\Program Files\cloudflared\cloudflared.exe"
)

if not "%CLOUDFLARED_CMD%"=="" (
    echo [OK] Menggunakan Cloudflare Tunnel: "%CLOUDFLARED_CMD%"
    echo.
    echo ----------------------------------------------------------
    echo Cari link berakhiran ".trycloudflare.com" di bawah ini,
    echo lalu salin dan bagikan link tersebut kepada teman Anda!
    echo ----------------------------------------------------------
    echo.
    "%CLOUDFLARED_CMD%" tunnel --url http://localhost:3000
) else (
    echo [INFO] Cloudflared tidak ditemukan di PATH, mencoba via npx untun...
    npx untun tunnel --port 3000
)

pause

