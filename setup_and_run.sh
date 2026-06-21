#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║   India Power Analytics — Setup and Run         ║"
echo "  ║   Sources: CEA OPM · CEA RE · NPP               ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo ""

command -v python3 &>/dev/null || { echo "[ERROR] Python 3 not found"; exit 1; }
echo "[OK] $(python3 --version)"

[ ! -d "venv" ] && python3 -m venv venv
source venv/bin/activate
echo "[OK] Virtual environment active"

pip install -r requirements.txt --quiet
echo "[OK] Dependencies installed"

echo ""
echo "  ┌────────────────────────────────────────────────┐"
echo "  │  Choose mode:                                  │"
echo "  │  1. Run once now (today's data)                │"
echo "  │  2. Start daily scheduler (08:15/13:15/18:15)  │"
echo "  │  3. NPP only — no browser needed               │"
echo "  │  4. Manual upload                              │"
echo "  └────────────────────────────────────────────────┘"
echo ""
read -p "Enter 1-4: " MODE

case "$MODE" in
  1) python3 cea_downloader.py ;;
  2) python3 cea_downloader.py --schedule ;;
  3) python3 cea_downloader.py --npp ;;
  4)
    read -p "Generation CSV path (blank to skip): " GEN
    read -p "Demand CSV path (blank to skip): "     DEM
    read -p "CEA RE PDF path (blank to skip): "     RE
    read -p "NPP dgr2 XLS path (blank to skip): "   DGR2
    read -p "Date YYYY-MM-DD (blank=yesterday): "    DATE
    ARGS=""
    [ -n "$GEN"  ] && ARGS="$ARGS --gen '$GEN'"
    [ -n "$DEM"  ] && ARGS="$ARGS --dem '$DEM'"
    [ -n "$RE"   ] && ARGS="$ARGS --re '$RE'"
    [ -n "$DGR2" ] && ARGS="$ARGS --dgr2 '$DGR2'"
    [ -n "$DATE" ] && ARGS="$ARGS --date $DATE"
    eval python3 upload_to_supabase.py $ARGS
    ;;
esac
