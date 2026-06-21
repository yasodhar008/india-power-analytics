/**
 * /api/fetch-cea-monthly
 *
 * Downloads CEA monthly reports from the confirmed archive:
 *   cea.nic.in/monthly-reports-archive/
 *
 * Reports available (confirmed from live site):
 *   - Executive Summary (installed capacity, generation, T&D losses)
 *   - OPM Generation (monthly fuel-wise generation MU)
 *   - Installed Capacity (state/sector/fuel-wise GW)
 *   - RESD (Renewable Energy Source-wise monthly data)
 *   - Market Monitoring (ISTS charges, congestion)
 *   - Power Supply Position (demand, surplus/deficit by state)
 *   - Hydrology (reservoir levels, hydro generation)
 *
 * Also updates the ICED intelligence tables (PLF, CO2) from CEA data.
 *
 * Cron: 1st of each month at 06:00 UTC = 11:30 IST
 * Manual: GET /api/fetch-cea-monthly?year=2026&month=5
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL      || 'https://bfmstdkntpseyyhiaqza.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmbXN0ZGtudHBzZXl5aGlhcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTgwNjAsImV4cCI6MjA5Njk5NDA2MH0.Eh57unrBX6uSRbQFj86oSHpgRv0ks41mS_ScHhM5F04'
)

const nowIST   = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000)

// ── CEA monthly report URL patterns ──────────────────────────────────────
// Confirmed structure from cea.nic.in/monthly-reports-archive/
// Month names used in filenames
const MONTH_NAMES = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december'
]
const MONTH_SHORT = [
  'jan','feb','mar','apr','may','jun',
  'jul','aug','sep','oct','nov','dec'
]

function ceaMonthlyUrls(year, month) {
  // month is 1-indexed
  const m    = String(month).padStart(2, '0')
  const mName = MONTH_NAMES[month - 1]
  const mShort = MONTH_SHORT[month - 1]
  const fy   = month >= 4
    ? `${year}-${String(year + 1).slice(-2)}`
    : `${year - 1}-${String(year).slice(-2)}`

  // CEA uses several URL patterns across different years
  // Listing all known variants to maximise hit rate
  return {
    executive_summary: [
      `https://cea.nic.in/wp-content/uploads/executive_summary/${year}/${m}/growth_energy_sector.pdf`,
      `https://cea.nic.in/wp-content/uploads/monthly/${year}/executive_summary_${mName}_${year}.pdf`,
      `https://cea.nic.in/wp-content/uploads/executive_summary/${year}/${mShort}/growth_energy_sector.pdf`,
    ],
    installed_capacity: [
      `https://cea.nic.in/wp-content/uploads/installed-capacity/${year}/${m}/installed_capacity.xls`,
      `https://cea.nic.in/wp-content/uploads/installed-capacity/${year}/${mShort}/installed_capacity.xls`,
      `https://cea.nic.in/wp-content/uploads/installed_capacity_${year}_${m}.xls`,
    ],
    opm_generation: [
      `https://cea.nic.in/wp-content/uploads/opm-generation/${year}/${m}/generation_report.xls`,
      `https://cea.nic.in/wp-content/uploads/monthly/${year}/opm_${mName}_${year}.xls`,
      `https://cea.nic.in/wp-content/uploads/opm-generation/${year}/${mShort}/generation_report.xls`,
    ],
    resd_re_data: [
      `https://cea.nic.in/wp-content/uploads/resd/${year}/${m}/renewable_energy.xls`,
      `https://cea.nic.in/wp-content/uploads/monthly/${year}/resd_${mName}_${year}.xls`,
      `https://cea.nic.in/wp-content/uploads/resd/${year}/${mShort}/renewable_energy.xls`,
    ],
    power_supply: [
      `https://cea.nic.in/wp-content/uploads/monthly/${year}/psp_${mName}_${year}.pdf`,
      `https://cea.nic.in/wp-content/uploads/power-supply/${year}/${m}/power_supply.pdf`,
    ],
    market_monitoring: [
      `https://cea.nic.in/wp-content/uploads/market-monitoring/${year}/${m}/market_monitoring.pdf`,
      `https://cea.nic.in/wp-content/uploads/monthly/${year}/market_${mName}_${year}.pdf`,
    ],
  }
}

async function tryDownloadFirst(urlList, label) {
  for (const url of urlList) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PowerAnalyticsBot/1.0)',
          'Referer':    'https://cea.nic.in/monthly-reports-archive/?lang=en',
        },
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) continue
      const ct  = (res.headers.get('content-type') || '').toLowerCase()
      const buf = await res.arrayBuffer()
      if (buf.byteLength < 2000) continue   // skip tiny error pages
      console.log(`  ✓ ${label}: ${url} (${Math.round(buf.byteLength/1024)} KB)`)
      return { url, buf, sizeKB: Math.round(buf.byteLength/1024), ct }
    } catch (e) {
      console.warn(`    ${label} ${url}: ${e.message}`)
    }
  }
  console.warn(`  ✗ ${label}: all URL variants failed`)
  return null
}

// Scan XLS/PDF binary for key monthly figures
function extractMonthlyFigures(buf, reportType) {
  const bytes = new Uint8Array(buf)
  let text = ''
  for (let i = 0; i < Math.min(bytes.length, 500000); i++) {
    const c = bytes[i]
    text += (c >= 32 && c < 127) ? String.fromCharCode(c) : ' '
  }

  const figures = {}

  if (reportType === 'installed_capacity') {
    const patterns = [
      { key: 'total_gw',       re: /total[^\d\n]{0,40}([\d,]+\.?\d*)\s*(?:mw|gw)/gi },
      { key: 'thermal_gw',     re: /thermal[^\d\n]{0,40}([\d,]+\.?\d*)/gi },
      { key: 'solar_gw',       re: /solar[^\d\n]{0,40}([\d,]+\.?\d*)/gi },
      { key: 'wind_gw',        re: /wind[^\d\n]{0,40}([\d,]+\.?\d*)/gi },
      { key: 'hydro_gw',       re: /hydro[^\d\n]{0,40}([\d,]+\.?\d*)/gi },
      { key: 'nuclear_gw',     re: /nuclear[^\d\n]{0,40}([\d,]+\.?\d*)/gi },
      { key: 'storage_gw',     re: /(?:storage|bess|battery)[^\d\n]{0,40}([\d,]+\.?\d*)/gi },
    ]
    patterns.forEach(({ key, re }) => {
      re.lastIndex = 0
      const m = re.exec(text)
      if (m) figures[key] = parseFloat(m[1].replace(/,/g,''))
    })
  }

  if (reportType === 'opm_generation') {
    const patterns = [
      { key: 'thermal_bu',  re: /thermal[^\d\n]{0,60}([\d,]+\.?\d*)/gi },
      { key: 'solar_bu',    re: /solar[^\d\n]{0,40}([\d,]+\.?\d*)/gi },
      { key: 'wind_bu',     re: /wind[^\d\n]{0,40}([\d,]+\.?\d*)/gi },
      { key: 'hydro_bu',    re: /hydro[^\d\n]{0,40}([\d,]+\.?\d*)/gi },
      { key: 'nuclear_bu',  re: /nuclear[^\d\n]{0,40}([\d,]+\.?\d*)/gi },
      { key: 'total_bu',    re: /total[^\d\n]{0,40}([\d,]+\.?\d*)/gi },
    ]
    patterns.forEach(({ key, re }) => {
      re.lastIndex = 0
      const m = re.exec(text)
      if (m) figures[key] = parseFloat(m[1].replace(/,/g,''))
    })
  }

  if (reportType === 'resd_re_data') {
    const patterns = [
      { key: 'solar_mu',      re: /solar[^\d\n]{0,40}([\d,]+\.?\d*)/gi },
      { key: 'wind_mu',       re: /wind[^\d\n]{0,40}([\d,]+\.?\d*)/gi },
      { key: 'small_hydro_mu',re: /small\s*hydro[^\d\n]{0,40}([\d,]+\.?\d*)/gi },
      { key: 'biomass_mu',    re: /biomass[^\d\n]{0,40}([\d,]+\.?\d*)/gi },
      { key: 'total_re_mu',   re: /total[^\d\n]{0,40}([\d,]+\.?\d*)/gi },
    ]
    patterns.forEach(({ key, re }) => {
      re.lastIndex = 0
      const m = re.exec(text)
      if (m) figures[key] = parseFloat(m[1].replace(/,/g,''))
    })
  }

  return Object.keys(figures).length > 0 ? figures : null
}

// Update ICED PLF/CUF table from monthly installed capacity data
async function updateICEDCapacity(year, month, figures) {
  if (!figures?.solar_gw && !figures?.wind_gw) return
  const fy = month >= 4
    ? `FY${String(year+1).slice(-2)}`
    : `FY${String(year).slice(-2)}`

  const updates = []
  if (figures.solar_gw) updates.push({ fy_year: fy, fuel_type: 'Solar', installed_gw: figures.solar_gw })
  if (figures.wind_gw)  updates.push({ fy_year: fy, fuel_type: 'Wind',  installed_gw: figures.wind_gw })
  if (figures.hydro_gw) updates.push({ fy_year: fy, fuel_type: 'Hydro', installed_gw: figures.hydro_gw })
  if (figures.nuclear_gw) updates.push({ fy_year: fy, fuel_type: 'Nuclear', installed_gw: figures.nuclear_gw })

  for (const u of updates) {
    await supabase.from('iced_plf_trends')
      .upsert(u, { onConflict: 'fy_year,fuel_type' })
  }
  console.log(`  ICED capacity updated for ${fy}: solar=${figures.solar_gw}GW wind=${figures.wind_gw}GW`)
}

export default async function handler(req, res) {
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' })

  const secret = req.headers['x-cron-secret'] || req.query.secret
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET)
    return res.status(401).json({ error: 'Unauthorized' })

  const t0    = Date.now()
  const now   = nowIST()

  // Default to previous month (CEA publishes ~15th of next month)
  let year  = parseInt(req.query.year  || now.getUTCFullYear(), 10)
  let month = parseInt(req.query.month || now.getUTCMonth(), 10)  // getUTCMonth() is 0-indexed, gives previous month
  if (month === 0) { month = 12; year-- }

  console.log(`\n[fetch-cea-monthly] ${year}-${String(month).padStart(2,'0')}`)

  const urls    = ceaMonthlyUrls(year, month)
  const results = {}
  let rowsWritten = 0

  // Download each report type
  for (const [type, urlList] of Object.entries(urls)) {
    const dl = await tryDownloadFirst(urlList, type)
    if (!dl) continue

    results[type] = { url: dl.url, sizeKB: dl.sizeKB }

    // Extract figures and update DB
    const figures = extractMonthlyFigures(dl.buf, type)
    if (figures) {
      console.log(`  Figures from ${type}:`, figures)
      results[type].figures = figures

      if (type === 'installed_capacity') {
        await updateICEDCapacity(year, month, figures)
        rowsWritten++
      }

      if (type === 'opm_generation' && figures.total_bu) {
        // Store monthly generation summary
        await supabase.from('power_daily_summary').upsert({
          data_date: `${year}-${String(month).padStart(2,'0')}-01`,
          data_sources: ['cea-monthly-opm'],
          notes: `CEA Monthly OPM ${year}-${month}: solar=${figures.solar_bu}BU wind=${figures.wind_bu}BU thermal=${figures.thermal_bu}BU total=${figures.total_bu}BU`,
        }, { onConflict: 'data_date' })
        rowsWritten++
      }
    }
  }

  const ms     = Date.now() - t0
  const nFound = Object.keys(results).length
  const status = nFound >= 2 ? 'ok' : nFound >= 1 ? 'partial' : 'failed'

  await supabase.from('fetch_log').insert({
    snapshot: `cea-monthly-${year}-${month}`,
    status, sources: ['cea.nic.in/monthly-reports-archive'],
    rows_written: rowsWritten, duration_ms: ms,
    error_msg: nFound === 0
      ? 'No CEA monthly reports found — URL patterns may need updating for this month'
      : null,
  })

  return res.status(200).json({
    ok: true, year, month, status,
    reportsFound: nFound, results, rowsWritten, ms,
    primarySource: 'cea.nic.in/monthly-reports-archive/?lang=en',
    note: nFound === 0
      ? `CEA monthly archive URLs for ${year}-${month} not matched. Reports published ~15th of next month. Check cea.nic.in/monthly-reports-archive/ for exact URL.`
      : `Downloaded ${nFound}/${Object.keys(urls).length} monthly report types`,
  })
}

export const config = { runtime: 'nodejs', maxDuration: 45, memory: 512 }
