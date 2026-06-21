/**
 * /api/fetch-npp
 *
 * Downloads NPP daily generation reports from npp.gov.in
 * All reports are confirmed public XLS files — no login, no browser needed.
 *
 * Priority order (confirmed from live npp.gov.in/publishedReports):
 *   dgr2 — Region/State/Sector/Type/Station/Unit wise (382 KB) — MOST COMPREHENSIVE
 *   dgr3 — All India Summary fuel-wise MU (9 KB)   — FASTEST to parse
 *   dgr1 — All India / Region overview (16 KB)
 *   dgr6 — Hydro reservoir levels (20 KB)
 *   dgr10 — Daily outage coal/nuclear (36 KB)
 *   dgr11 — 500 MW unit outages (15 KB)
 *
 * URL pattern (confirmed live):
 *   https://npp.gov.in/public-reports/cea/daily/dgr/DD-MM-YYYY/dgrN-YYYY-MM-DD.xls
 *
 * Cron: 14:00 UTC = 19:30 IST (NPP publishes ~17:00-18:00 IST each evening)
 * Manual: GET /api/fetch-npp?date=2026-06-17
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

const nowIST = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000);
const todayIST = () => nowIST().toISOString().split("T")[0];

// Confirmed NPP public report URL pattern (verified 19 Jun 2026)
function nppUrl(date, num, fmt = "xls") {
  const [y, m, d] = date.split("-");
  return `https://npp.gov.in/public-reports/cea/daily/dgr/${d}-${m}-${y}/dgr${num}-${date}.${fmt}`;
}

// Reports in priority order — dgr2 is the primary target
const REPORTS = [
  {
    num: 2,
    name: "state_station_wise",
    fmt: "xls",
    desc: "Region/State/Sector/Type/Station/Unit wise (382 KB) — most comprehensive",
    priority: 1,
  },
  {
    num: 3,
    name: "all_india_summary",
    fmt: "xls",
    desc: "All India Summary fuel-wise MU (9 KB) — fastest parse",
    priority: 1,
  },
  {
    num: 1,
    name: "region_overview",
    fmt: "xls",
    desc: "All India / Region overview (16 KB)",
    priority: 2,
  },
  {
    num: 6,
    name: "hydro_reservoir",
    fmt: "xls",
    desc: "Daily hydro reservoir levels (20 KB)",
    priority: 2,
  },
  {
    num: 10,
    name: "outage_coal_nuclear",
    fmt: "xls",
    desc: "Daily outage — coal, lignite, nuclear (36 KB)",
    priority: 2,
  },
  {
    num: 11,
    name: "outage_500mw",
    fmt: "xls",
    desc: "Outage report — 500 MW+ units only (15 KB)",
    priority: 3,
  },
  {
    num: 12,
    name: "outage_15days",
    fmt: "xls",
    desc: "Thermal/nuclear units out > 15 days",
    priority: 3,
  },
];

async function downloadReport(date, report) {
  // Try XLS first, then PDF
  for (const fmt of [report.fmt, report.fmt === "xls" ? "pdf" : "xls"]) {
    const url = nppUrl(date, report.num, fmt);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Referer: "https://npp.gov.in/publishedReports",
          Accept: "*/*",
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1000) continue; // error page
      return { url, fmt, sizeKB: Math.round(buf.byteLength / 1024), buf };
    } catch (e) {
      console.warn(`  NPP dgr${report.num} (${fmt}): ${e.message}`);
    }
  }
  return null;
}

// Scan XLS text content for key generation figures
// Full binary XLS parsing needs Python/openpyxl
// This text scan works because XLS compound files embed readable strings
function extractFuelFigures(buf, reportNum) {
  const bytes = new Uint8Array(buf);
  let text = "";
  // Extract printable ASCII strings from binary
  for (let i = 0; i < Math.min(bytes.length, 300000); i++) {
    const c = bytes[i];
    text += c >= 32 && c < 127 ? String.fromCharCode(c) : " ";
  }

  const figures = { report: reportNum };
  const patterns = [
    {
      key: "thermal_mu",
      re: /(?:thermal|coal|lignite)[^\d\n]{0,60}([\d,]{4,10})/gi,
    },
    { key: "nuclear_mu", re: /nuclear[^\d\n]{0,40}([\d,]{3,8})/gi },
    { key: "hydro_mu", re: /hydro[^\d\n]{0,40}([\d,]{3,8})/gi },
    { key: "gas_mu", re: /gas[^\d\n]{0,30}([\d,]{3,7})/gi },
    { key: "wind_mu", re: /wind[^\d\n]{0,30}([\d,]{3,7})/gi },
    { key: "solar_mu", re: /solar[^\d\n]{0,30}([\d,]{3,7})/gi },
    { key: "total_mu", re: /total[^\d\n]{0,30}([\d,]{5,10})/gi },
  ];

  patterns.forEach(({ key, re }) => {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) figures[key] = parseInt(m[1].replace(/,/g, ""), 10);
  });

  return Object.keys(figures).length > 1 ? figures : null;
}

export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const secret = req.headers["x-cron-secret"] || req.query.secret;
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET)
    return res.status(401).json({ error: "Unauthorized" });

  const t0 = Date.now();
  const date = req.query.date || todayIST();
  // NPP publishes previous day's consolidated report
  // If called at 19:30 IST, fetch today's date
  console.log(`\n[fetch-npp] ${date}`);

  const results = {};
  const skipped = [];
  let rowsWritten = 0;

  for (const report of REPORTS) {
    console.log(`  Fetching dgr${report.num} (${report.name})...`);
    const dl = await downloadReport(date, report);

    if (dl) {
      results[report.name] = {
        num: report.num,
        url: dl.url,
        fmt: dl.fmt,
        sizeKB: dl.sizeKB,
        desc: report.desc,
        priority: report.priority,
      };
      console.log(`  ✓ dgr${report.num}: ${dl.sizeKB} KB`);

      // Extract figures from dgr3 (smallest, cleanest text content)
      if (report.num === 3) {
        const figures = extractFuelFigures(dl.buf, report.num);
        if (figures) {
          console.log(`  Extracted from dgr3:`, figures);
          const { error } = await supabase.from("power_daily_summary").upsert(
            {
              data_date: date,
              data_sources: ["npp-dgr3"],
              notes: `NPP dgr3 fuel figures: solar=${figures.solar_mu}MU wind=${figures.wind_mu}MU thermal=${figures.thermal_mu}MU hydro=${figures.hydro_mu}MU total=${figures.total_mu}MU`,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "data_date" },
          );
          if (!error) rowsWritten++;
        }
      }
    } else {
      skipped.push(`dgr${report.num}`);
      // dgr7 and dgr10A are often unavailable — not a failure
      if (![7, "10A"].includes(report.num)) {
        console.warn(`  ✗ dgr${report.num} not available`);
      }
    }
  }

  const ms = Date.now() - t0;
  const nFound = Object.keys(results).length;
  const status = nFound >= 2 ? "ok" : nFound >= 1 ? "partial" : "failed";

  await supabase.from("fetch_log").insert({
    snapshot: "npp-eod",
    status,
    sources: ["npp.gov.in"],
    rows_written: rowsWritten,
    duration_ms: ms,
    error_msg:
      nFound === 0
        ? "All NPP reports unavailable — published ~17:00-18:00 IST"
        : null,
  });

  return res.status(200).json({
    ok: true,
    date,
    status,
    reportsFound: nFound,
    reports: results,
    skipped,
    rowsWritten,
    ms,
    primarySource: "npp.gov.in/publishedReports",
    urlPattern: `npp.gov.in/public-reports/cea/daily/dgr/DD-MM-YYYY/dgrN-YYYY-MM-DD.xls`,
    note:
      nFound === 0
        ? "Reports not published yet. NPP publishes previous day reports around 17:00-18:00 IST."
        : `Downloaded ${nFound}/${REPORTS.length} reports. dgr2 (382KB) is most comprehensive — contains state/station/unit breakdown.`,
  });
}

export const config = { runtime: "nodejs", maxDuration: 30, memory: 512 };
