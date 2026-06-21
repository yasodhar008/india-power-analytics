@echo off
echo.
echo   India Power Analytics — Vercel Deploy
echo.

if not exist node_modules npm install
npm run build

echo.
echo Deploying to Vercel...
npx vercel deploy . --prod --name india-power-analytics --yes ^
  --env SUPABASE_URL=%SUPABASE_URL% ^
  --env SUPABASE_ANON_KEY=%SUPABASE_ANON_KEY% ^
  --env VITE_SUPABASE_URL=%SUPABASE_URL% ^
  --env VITE_SUPABASE_ANON_KEY=%SUPABASE_ANON_KEY%

echo.
echo Done. Crons running fully on Vercel servers.
pause
