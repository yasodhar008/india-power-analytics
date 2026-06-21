#!/bin/bash
# ══════════════════════════════════════════════════════════
#  India Power Analytics — One-command Vercel deploy
#  Run once from the project folder on your local machine
#  Requires: Node.js 18+
# ══════════════════════════════════════════════════════════

set -e
cd "$(dirname "$0")"

echo ""
echo "  ⚡ India Power Analytics — Vercel Deploy"
echo ""

# Install deps if needed
[ ! -d "node_modules" ] && npm install

# Build frontend
echo "Building frontend..."
npm run build

# Deploy via Vercel CLI (handles login automatically)
echo ""
echo "Deploying to Vercel..."
npx vercel deploy . \
  --prod \
  --name india-power-analytics \
  --yes \
  --env SUPABASE_URL="https://bfmstdkntpseyyhiaqza.supabase.co" \
  --env SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmbXN0ZGtudHBzZXl5aGlhcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTgwNjAsImV4cCI6MjA5Njk5NDA2MH0.Eh57unrBX6uSRbQFj86oSHpgRv0ks41mS_ScHhM5F04" \
  --env VITE_SUPABASE_URL="https://bfmstdkntpseyyhiaqza.supabase.co" \
  --env VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmbXN0ZGtudHBzZXl5aGlhcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTgwNjAsImV4cCI6MjA5Njk5NDA2MH0.Eh57unrBX6uSRbQFj86oSHpgRv0ks41mS_ScHhM5F04"

echo ""
echo "✓ Deployed! Vercel will now run crons at:"
echo "  08:00 IST — morning ramp snapshot"
echo "  13:00 IST — solar peak snapshot"
echo "  18:00 IST — evening peak snapshot"
echo "  19:30 IST — NPP daily reports"
echo ""
echo "All fully server-side on Vercel — no local machine needed."
