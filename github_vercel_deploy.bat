@echo off
setlocal enabledelayedexpansion
title India Power Analytics — GitHub + Vercel Deploy

echo.
echo   ======================================================
echo    India Power Analytics — GitHub + Vercel Deploy
echo   ======================================================
echo.
echo   What this does:
echo     1. Creates a GitHub repo
echo     2. Pushes all code
echo     3. Deploys to Vercel with all env variables
echo   ======================================================
echo.

REM ── Check requirements ──────────────────────────────────────────────
git --version >nul 2>&1 || (echo [ERROR] git not found. Install from git-scm.com & pause & exit /b 1)
node --version >nul 2>&1 || (echo [ERROR] Node.js not found. Install from nodejs.org & pause & exit /b 1)
echo [OK] Requirements found.

REM ── GitHub credentials ───────────────────────────────────────────────
echo.
echo Step 1 - GitHub setup
echo   Create a token at: https://github.com/settings/tokens/new
echo   (Select: repo, workflow scopes)
echo.
set /p GH_USER="  GitHub username: "
set /p GH_TOKEN="  GitHub token: "
set /p REPO_NAME="  Repository name [india-power-analytics]: "
if "!REPO_NAME!"=="" set REPO_NAME=india-power-analytics

REM ── Create GitHub repo via API ───────────────────────────────────────
echo.
echo Step 2 - Creating GitHub repo...
curl -s -X POST "https://api.github.com/user/repos" ^
  -H "Authorization: token !GH_TOKEN!" ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"!REPO_NAME!\",\"description\":\"India grid intelligence platform\",\"private\":false}" ^
  -o nul -w "HTTP %%{http_code}" > %TEMP%\gh_status.txt
set /p GH_STATUS=<%TEMP%\gh_status.txt

if "!GH_STATUS!"=="HTTP 201" (
    echo [OK] Repo created: https://github.com/!GH_USER!/!REPO_NAME!
) else if "!GH_STATUS!"=="HTTP 422" (
    echo [OK] Repo already exists - pushing to it
) else (
    echo [WARN] GitHub API returned !GH_STATUS! - continuing anyway
)

REM ── Push to GitHub ───────────────────────────────────────────────────
echo.
echo Step 3 - Pushing code to GitHub...
git remote remove origin 2>nul
git remote add origin "https://!GH_USER!:!GH_TOKEN!@github.com/!GH_USER!/!REPO_NAME!.git"
git add -A
git diff --cached --quiet 2>nul || git commit -m "chore: add GitHub Actions workflow"
git push -u origin main --force
echo [OK] Code pushed to: https://github.com/!GH_USER!/!REPO_NAME!

REM ── Deploy to Vercel ─────────────────────────────────────────────────
echo.
echo Step 4 - Deploying to Vercel...
echo   Vercel will open a browser for login.
echo.
pause




npx vercel deploy . --prod --name india-power-analytics --yes ^
  --env SUPABASE_URL="!SUPABASE_URL!" ^
  --env SUPABASE_ANON_KEY="!SUPABASE_KEY!" ^
  --env VITE_SUPABASE_URL="!SUPABASE_URL!" ^
  --env VITE_SUPABASE_ANON_KEY="!SUPABASE_KEY!"

echo.
echo ======================================================
echo   DONE!
echo.
echo   GitHub:   https://github.com/!GH_USER!/!REPO_NAME!
echo   Vercel:   https://vercel.com/dashboard
echo   Supabase: https://supabase.com/dashboard/project/bfmstdkntpseyyhiaqza
echo.
echo   Connect Vercel to GitHub in:
echo   vercel.com → india-power-analytics → Settings → Git
echo ======================================================
pause
