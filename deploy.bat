@echo off
echo.
echo   India Power Analytics — Vercel Deploy
echo.

if not exist node_modules npm install
npm run build

echo.
echo Deploying to Vercel...
npx vercel deploy . --prod --name india-power-analytics --yes ^
  --env SUPABASE_URL="https://bfmstdkntpseyyhiaqza.supabase.co" ^
  --env SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmbXN0ZGtudHBzZXl5aGlhcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTgwNjAsImV4cCI6MjA5Njk5NDA2MH0.Eh57unrBX6uSRbQFj86oSHpgRv0ks41mS_ScHhM5F04" ^
  --env VITE_SUPABASE_URL="https://bfmstdkntpseyyhiaqza.supabase.co" ^
  --env VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmbXN0ZGtudHBzZXl5aGlhcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTgwNjAsImV4cCI6MjA5Njk5NDA2MH0.Eh57unrBX6uSRbQFj86oSHpgRv0ks41mS_ScHhM5F04"

echo.
echo Done. Crons running fully on Vercel servers.
pause
