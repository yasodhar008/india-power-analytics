@echo off
setlocal enabledelayedexpansion
title India Power Analytics — Setup

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║   India Power Analytics — Setup and Run         ║
echo  ║   Sources: CEA OPM · CEA RE · NPP               ║
echo  ╚══════════════════════════════════════════════════╝
echo.

python --version >nul 2>&1
if errorlevel 1 (echo [ERROR] Python not found. Install from python.org & pause & exit /b 1)
echo [OK] Python found

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate.bat
echo [OK] Virtual environment active

echo Installing dependencies...
pip install -r requirements.txt --quiet
echo [OK] Dependencies installed

echo.
echo  ┌────────────────────────────────────────────────┐
echo  │  Choose mode:                                  │
echo  │  1. Run once now (today's data)                │
echo  │  2. Start daily scheduler (08:15/13:15/18:15)  │
echo  │  3. NPP only — no browser needed               │
echo  │  4. Manual upload (specify CSV/PDF/XLS paths)  │
echo  └────────────────────────────────────────────────┘
echo.
set /p MODE="Enter 1-4: "

if "%MODE%"=="1" python cea_downloader.py
if "%MODE%"=="2" python cea_downloader.py --schedule
if "%MODE%"=="3" python cea_downloader.py --npp
if "%MODE%"=="4" (
    set /p GEN="Generation CSV path (blank to skip): "
    set /p DEM="Demand CSV path (blank to skip): "
    set /p RE="CEA RE PDF path (blank to skip): "
    set /p DGR2="NPP dgr2 XLS path (blank to skip): "
    set /p DATE="Date YYYY-MM-DD (blank=yesterday): "
    set ARGS=
    if not "!GEN!"==""  set ARGS=!ARGS! --gen "!GEN!"
    if not "!DEM!"==""  set ARGS=!ARGS! --dem "!DEM!"
    if not "!RE!"==""   set ARGS=!ARGS! --re "!RE!"
    if not "!DGR2!"=="" set ARGS=!ARGS! --dgr2 "!DGR2!"
    if not "!DATE!"=="" set ARGS=!ARGS! --date !DATE!
    python upload_to_supabase.py !ARGS!
)

echo.
pause
