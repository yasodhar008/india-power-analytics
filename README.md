# India Power Analytics

A full-stack power sector intelligence platform for the Indian grid —
operational dashboards, daily snapshots, trend analytics, and BESS
opportunity mapping.

---

## Architecture

```
Vercel (Frontend + API)               Supabase (Postgres — ap-south-1)
  ├── React dashboard (8 tabs)    ←── power_generation
  ├── /api/fetch-snapshot             power_demand
  │   Puppeteer → CEA OPM             power_re_state
  ├── /api/fetch-cea-re               power_snapshot_summary
  │   → CEA RE PDF                    power_daily_summary
  ├── /api/fetch-npp                  fetch_log
  │   → NPP XLS reports               iced_duck_curve
  └── /api/fetch-cea-monthly          iced_rco_targets
      → CEA Monthly Archive           iced_plf_trends
                                      iced_co2_intensity
Your machine (backup / manual)        iced_state_bess_opportunity
  ├── cea_downloader.py
  └── upload_to_supabase.py
```

---

## Data sources (confirmed, verified June 2026)

| Priority | Source | URL | Format | Lag |
|----------|--------|-----|--------|-----|
| P1 Daily | CEA OPM Generation Report | `cea.nic.in/opm_grid_operation/daily-generation-report/` | CSV | Same day |
| P1 Daily | CEA RE Daily Report (RPMD) | `cea.nic.in/renewable-generation-report/` | PDF | Next morning ~10:00 IST |
| P2 Daily | NPP dgr2 — Station/Unit wise | `npp.gov.in/publishedReports` → `dgr2-YYYY-MM-DD.xls` | XLS 382KB | Next day ~17:00 IST |
| P2 Daily | NPP dgr3 — All India Summary | Same → `dgr3-YYYY-MM-DD.xls` | XLS 9KB | Next day ~17:00 IST |
| P2 Daily | NPP dgr1,6,10,11 | Same — overview, hydro, outages | XLS | Next day |
| P3 Monthly | CEA Monthly Archive | `cea.nic.in/monthly-reports-archive/` | PDF/XLS | ~15th next month |
| P4 Annual | ICED NITI Aayog | `iced.niti.gov.in` | Dashboard/XLS | Monthly/Annual |

---

## Automated schedule (Vercel — no local machine needed)

| Time (IST) | UTC | Route | What |
|------------|-----|-------|------|
| 08:00 | 02:30 | `/api/fetch-snapshot` | CEA OPM hourly — morning ramp |
| 11:00 | 05:30 | `/api/fetch-cea-re` | CEA RE PDF — state RE |
| 13:00 | 07:30 | `/api/fetch-snapshot` | CEA OPM hourly — solar peak |
| 18:00 | 12:30 | `/api/fetch-snapshot` | CEA OPM hourly — evening peak |
| 19:30 | 14:00 | `/api/fetch-npp` | NPP dgr1,2,3,6,10,11 XLS |
| 1st/month 11:30 | 06:00 | `/api/fetch-cea-monthly` | CEA monthly archive |

---

## Deploy (one-time, ~3 minutes)

### Option A — Vercel drag & drop (easiest)
1. Build: `npm install && npm run build`
2. Go to vercel.com/new → drag the project folder → Deploy
3. Add environment variables in Vercel dashboard (see `.env.vercel`)

### Option B — CLI deploy
```bash
# Mac/Linux
./deploy.sh

# Windows
deploy.bat
```

---

## Python scripts (backup / manual upload)

### Install
```bash
pip install -r requirements.txt
```

### Daily download + upload (runs on schedule)
```bash
# Mac/Linux
python3 cea_downloader.py --schedule

# Windows (double-click or)
python cea_downloader.py --schedule
```

### Manual upload (when auto-fetch fails)
```bash
# Upload CEA OPM CSVs (most common)
python upload_to_supabase.py --date 2026-06-20 \
  --gen All_India_Generation_2026-06-20.csv \
  --dem Demand_Met_Data_2026-06-20.csv

# Upload CEA RE PDF
python upload_to_supabase.py --date 2026-06-20 \
  --re cea_re_2026-06-20.pdf

# Upload NPP dgr2 (station-level)
python upload_to_supabase.py --date 2026-06-20 \
  --dgr2 dgr2-2026-06-20.xls

# Auto-find all files for a date
python upload_to_supabase.py --date 2026-06-20 --auto

# NPP download only (no browser needed)
python cea_downloader.py --npp --date 2026-06-20
```

---

## Platform tabs

| Tab | Data source | What it shows |
|-----|-------------|---------------|
| Dashboard | CEA OPM | KPIs, demand vs RE, generation stack, solar/wind profile |
| Snapshots | CEA OPM | 08:00 / 13:00 / 18:00 IST comparison, ramp table |
| Trends | power_daily_summary | 30-day peak demand, solar, wind, RE share history |
| Regional | CEA RE PDF | State-wise wind/solar MU, region stacked bar |
| Intelligence | ICED + CEA | Duck curve, RCO trajectory, PLF trends, CO₂, BESS opportunity index |
| Upload | All sources | Drag-drop CSV/PDF/XLS → parse → Supabase upsert |
| Sources | Reference | Full source map, URLs, formats, cron schedule |
| Status ◉ | fetch_log | Uptime heatmap, next run times, DB row counts |

---

## Supabase project

- **Project**: yasodhar008's Project
- **Region**: ap-south-1 (Mumbai)
- **URL**: https://bfmstdkntpseyyhiaqza.supabase.co
- **Tables**: 10 tables, all with public read RLS, anon insert/update

---

## Environment variables

```
SUPABASE_URL=https://bfmstdkntpseyyhiaqza.supabase.co
SUPABASE_ANON_KEY=<see .env.vercel>
VITE_SUPABASE_URL=https://bfmstdkntpseyyhiaqza.supabase.co
VITE_SUPABASE_ANON_KEY=<see .env.vercel>
CRON_SECRET=<optional — protects /api/* endpoints>
```

---

## File structure

```
india-power-analytics/
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx      Hourly charts + KPIs
│   │   ├── Snapshots.jsx      3× daily comparison
│   │   ├── History.jsx        30-day trend charts
│   │   ├── Regional.jsx       State-wise RE maps
│   │   ├── Intelligence.jsx   Duck curve · RCO · PLF · CO₂ · BESS
│   │   ├── Upload.jsx         CSV/PDF/XLS ingestion
│   │   ├── Sources.jsx        Data source reference
│   │   └── Status.jsx         System health + fetch log
│   ├── lib/
│   │   ├── supabase.js        DB read/write functions
│   │   └── parseCSV.js        Browser-side CSV parser
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── api/
│   ├── _lib.js                Shared Supabase + IST helpers
│   ├── fetch-snapshot.js      Puppeteer → CEA OPM (3× daily)
│   ├── fetch-cea-re.js        CEA RE PDF (daily)
│   ├── fetch-npp.js           NPP XLS dgr1-12 (daily)
│   └── fetch-cea-monthly.js   CEA monthly archive (monthly)
├── cea_downloader.py          Selenium → CEA OPM (local backup)
├── upload_to_supabase.py      Parse + upload all source types
├── requirements.txt
├── vercel.json                6 cron jobs + Node.js runtime config
├── deploy.sh / deploy.bat
├── setup_and_run.sh / .bat
└── README.md
```
