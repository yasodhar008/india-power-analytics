#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
#  India Power Analytics — GitHub + Vercel Deploy Script
#  Run once from your local machine after downloading the project zip.
#
#  What this does:
#    1. Creates a GitHub repo (india-power-analytics)
#    2. Pushes all code to GitHub
#    3. Deploys to Vercel with all environment variables set
#    4. Connects Vercel to GitHub for auto-deploy on future pushes
#
#  Requirements:
#    - Node.js 18+ (for Vercel CLI)
#    - Git
#    - GitHub account
#    - Vercel account (same email as GitHub recommended)
#
#  Usage:
#    chmod +x github_vercel_deploy.sh
#    ./github_vercel_deploy.sh
# ══════════════════════════════════════════════════════════════════════

set -e
cd "$(dirname "$0")"

# ── Colours ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

echo ""
echo -e "${BOLD}  ⚡ India Power Analytics — GitHub + Vercel Deploy${NC}"
echo "  ─────────────────────────────────────────────────"
echo ""

# ── Check requirements ─────────────────────────────────────────────────
command -v git  &>/dev/null || { echo -e "${RED}[ERROR] git not found${NC}"; exit 1; }
command -v node &>/dev/null || { echo -e "${RED}[ERROR] Node.js not found. Install from nodejs.org${NC}"; exit 1; }
echo -e "${GREEN}[OK]${NC} git $(git --version | awk '{print $3}')"
echo -e "${GREEN}[OK]${NC} Node $(node --version)"

# ── Get GitHub credentials ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}Step 1 — GitHub setup${NC}"
echo "  You need a GitHub Personal Access Token with 'repo' scope."
echo "  Create one at: https://github.com/settings/tokens/new"
echo "  (Select: repo, workflow)"
echo ""
read -p "  GitHub username: " GH_USER
read -sp "  GitHub token (hidden): " GH_TOKEN
echo ""
read -p "  Repository name [india-power-analytics]: " REPO_NAME
REPO_NAME=${REPO_NAME:-india-power-analytics}

# ── Create GitHub repo ─────────────────────────────────────────────────
echo ""
echo -e "  Creating GitHub repo: ${BLUE}${GH_USER}/${REPO_NAME}${NC}"

RESPONSE=$(curl -s -o /tmp/gh_response.json -w "%{http_code}" \
  -X POST "https://api.github.com/user/repos" \
  -H "Authorization: token ${GH_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${REPO_NAME}\",
    \"description\": \"India grid intelligence platform — CEA · NPP · ICED · Supabase · Vercel\",
    \"private\": false,
    \"has_issues\": true,
    \"has_wiki\": false,
    \"auto_init\": false
  }")

if [ "$RESPONSE" = "201" ]; then
  echo -e "${GREEN}  ✓ GitHub repo created: https://github.com/${GH_USER}/${REPO_NAME}${NC}"
elif [ "$RESPONSE" = "422" ]; then
  echo -e "${YELLOW}  ⚠ Repo already exists — pushing to existing repo${NC}"
else
  echo -e "${RED}  ✗ GitHub API returned HTTP ${RESPONSE}${NC}"
  cat /tmp/gh_response.json
  exit 1
fi

# ── Push to GitHub ─────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Step 2 — Pushing code to GitHub${NC}"

# Configure git remote
REMOTE_URL="https://${GH_USER}:${GH_TOKEN}@github.com/${GH_USER}/${REPO_NAME}.git"

git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE_URL"

# Stage any new files not yet committed (e.g. .github/ workflow)
git add -A
git diff --cached --quiet || git commit -m "chore: add GitHub Actions workflow and deploy scripts"

# Push
git push -u origin main --force
echo -e "${GREEN}  ✓ Code pushed to: https://github.com/${GH_USER}/${REPO_NAME}${NC}"

# ── Add GitHub Actions secrets ─────────────────────────────────────────
echo ""
echo -e "${BOLD}Step 3 — Adding GitHub secrets for CI/CD${NC}"

SUPABASE_URL="https://bfmstdkntpseyyhiaqza.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmbXN0ZGtudHBzZXl5aGlhcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTgwNjAsImV4cCI6MjA5Njk5NDA2MH0.Eh57unrBX6uSRbQFj86oSHpgRv0ks41mS_ScHhM5F04"

add_secret() {
  local name=$1; local value=$2
  # Get public key for encryption
  PK_RESP=$(curl -s "https://api.github.com/repos/${GH_USER}/${REPO_NAME}/actions/secrets/public-key" \
    -H "Authorization: token ${GH_TOKEN}")
  KEY_ID=$(echo "$PK_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['key_id'])")
  KEY=$(echo "$PK_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['key'])")

  # Encrypt with libsodium (via Python)
  ENCRYPTED=$(python3 -c "
from base64 import b64decode, b64encode
from nacl import encoding, public
import sys
key = public.PublicKey('${KEY}'.encode(), encoding.Base64Encoder())
box = public.SealedBox(key)
encrypted = box.encrypt('${value}'.encode())
print(b64encode(encrypted).decode())
" 2>/dev/null || echo "ENCRYPTION_FAILED")

  if [ "$ENCRYPTED" = "ENCRYPTION_FAILED" ]; then
    echo -e "${YELLOW}  ⚠ Could not encrypt secret ${name} (PyNaCl not installed — set manually in GitHub)${NC}"
    return
  fi

  CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT "https://api.github.com/repos/${GH_USER}/${REPO_NAME}/actions/secrets/${name}" \
    -H "Authorization: token ${GH_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"encrypted_value\":\"${ENCRYPTED}\",\"key_id\":\"${KEY_ID}\"}")
  [ "$CODE" = "201" ] || [ "$CODE" = "204" ] && \
    echo -e "${GREEN}  ✓ Secret ${name} set${NC}" || \
    echo -e "${YELLOW}  ⚠ Secret ${name} — HTTP ${CODE} (set manually in GitHub)${NC}"
}

add_secret "VITE_SUPABASE_URL"      "$SUPABASE_URL"
add_secret "VITE_SUPABASE_ANON_KEY" "$SUPABASE_KEY"

# ── Deploy to Vercel ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Step 4 — Deploy to Vercel${NC}"
echo "  Installing Vercel CLI..."
npm install -g vercel --quiet 2>/dev/null || true

echo ""
echo "  Vercel will open a browser to log you in."
echo "  After login, choose: Link to existing project? No → Create new project"
echo "  Project name: india-power-analytics"
echo "  Framework: Vite"
echo ""
read -p "  Press Enter to start Vercel login and deploy..."

# Deploy — Vercel CLI handles login interactively
npx vercel deploy . \
  --prod \
  --name india-power-analytics \
  --yes \
  --env SUPABASE_URL="$SUPABASE_URL" \
  --env SUPABASE_ANON_KEY="$SUPABASE_KEY" \
  --env VITE_SUPABASE_URL="$SUPABASE_URL" \
  --env VITE_SUPABASE_ANON_KEY="$SUPABASE_KEY"

# Get the deployment URL
VERCEL_URL=$(npx vercel --prod ls 2>/dev/null | grep india-power | head -1 | awk '{print $2}' || echo "")

echo ""
echo -e "${BOLD}Step 5 — Connect Vercel to GitHub (auto-deploy on push)${NC}"
echo ""
echo "  Go to: https://vercel.com/dashboard → india-power-analytics → Settings → Git"
echo "  Connect to: github.com/${GH_USER}/${REPO_NAME}"
echo "  From now on, every git push deploys automatically."
echo ""

# ── Add Vercel secrets to GitHub ───────────────────────────────────────
echo -e "${BOLD}Step 6 — Get Vercel IDs for GitHub Actions${NC}"
echo ""
echo "  To complete GitHub Actions CD, add these secrets in GitHub:"
echo "  https://github.com/${GH_USER}/${REPO_NAME}/settings/secrets/actions"
echo ""
echo "  VERCEL_TOKEN     → vercel.com/account/tokens → Create"
echo "  VERCEL_ORG_ID    → vercel.com/dashboard → Settings → General → Team ID"
echo "  VERCEL_PROJECT_ID→ vercel.com/${GH_USER}/india-power-analytics/settings → Project ID"
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ DEPLOYMENT COMPLETE${NC}"
echo ""
echo -e "  GitHub:  https://github.com/${GH_USER}/${REPO_NAME}"
[ -n "$VERCEL_URL" ] && echo -e "  Vercel:  https://${VERCEL_URL}"
echo -e "  Supabase: https://supabase.com/dashboard/project/bfmstdkntpseyyhiaqza"
echo ""
echo -e "  Cron jobs (6) will activate automatically on Vercel."
echo -e "  Data sources: CEA OPM · CEA RE · NPP · ICED"
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
