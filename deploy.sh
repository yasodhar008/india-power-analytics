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
  --env SUPABASE_URL=${SUPABASE_URL} \
  --env SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY} \
  --env VITE_SUPABASE_URL=${SUPABASE_URL} \
  --env VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}

echo ""
echo "✓ Deployed! Vercel will now run crons at:"
echo "  08:00 IST — morning ramp snapshot"
echo "  13:00 IST — solar peak snapshot"
echo "  18:00 IST — evening peak snapshot"
echo "  19:30 IST — NPP daily reports"
echo ""
echo "All fully server-side on Vercel — no local machine needed."
