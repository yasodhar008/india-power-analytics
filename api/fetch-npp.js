/**
 * /api/fetch-npp  — v2 (NPP-first, no Puppeteer, proper XLS parsing)
 *
 * Downloads NPP dgr3 (All India fuel-wise daily MU totals, 9 KB XLS)
 * Parses with SheetJS, synthesises 24-hour MW profiles using India grid
 * diurnal shapes, then writes:
 *   power_generation  — 24 rows × up to 6 fuels
 *   power_demand      — 24 rows
 *   power_daily_summary — 1 row
 *
 * Triggered by GitHub Actions cron at 14:00 UTC (19:30 IST) for YESTERDAY.
 * Manual: GET /api/fetch-npp?date=2026-06-17
 */

import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL      || 'https://bfmstdkntpseyyhiaqza.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmbXN0ZGtudHBzZXl5aGlhcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTgwNjAsImV4cCI6MjA5Njk5NDA2MH0.Eh57unrBX6uSRbQFj86oSHpgRv0ks41mS_ScHhM5F04'
)

const nowIST = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000)

function yesterdayIST() {
  const d = nowIST()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().split('T')[0]
}

function nppUrl(date, num, fmt = 'xls') {
  const [y, m, d] = date.split('-')
  return `https://npp.gov.in/public-reports/cea/daily/dgr/${d}-${m}-${y}/dgr${num}-${date}.${fmt}`
}

// ── Diurnal profile shapes (raw weights, normalised to sum=24) ───────────
const RAW = {
  SOLAR:   [0,0,0,0,0,0,0,  0.30,0.80,1.50,2.00,2.35,2.55,2.45,2.15,1.70,1.20,0.60,0.20,0,0,0,0,0],
  WIND:    [1.10,1.10,1.12,1.12,1.12,1.10,1.00,0.90,0.82,0.84,0.88,0.90,0.90,0.94,0.98,1.00,1.02,1.06,1.10,1.14,1.18,1.18,1.14,1.10],
  THERMAL: [0.95,0.93,0.91,0.90,0.91,0.94,0.99,1.05,1.08,1.06,1.02,0.98,0.97,0.97,0.98,0.98,0.99,1.03,1.09,1.12,1.10,1.07,1.03,0.99],
  HYDRO:   [1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00],
  NUCLEAR: [1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00,1.00],
  GAS:     [0.85,0.82,0.80,0.80,0.82,0.88,0.98,1.05,1.08,1.05,1.02,1.00,1.00,1.00,1.00,1.00,1.02,1.08,1.15,1.18,1.15,1.10,1.03,0.93],
  DEMAND:  [0.86,0.83,0.80,0.78,0.79,0.83,0.90,0.97,1.05,1.10,1.10,1.07,1.04,1.03,1.02,1.02,1.04,1.07,1.12,1.16,1.15,1.11,1.04,0.94],
}

const PROFILES = {}
for (const [k, raw] of Object.entries(RAW)) {
  const sum = raw.reduce((a, b) => a + b, 0)
  PROFILES[k] = raw.map(v => (v * 24) / sum)
}

// ── Parse dgr3 XLS with SheetJS ──────────────────────────────────────────
function parseDgr3(buf) {
  const wb   = XLSX.read(new Uint8Array(buf), { type: 'array' })
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  const FUEL_MAP = {
    thermal: 'THERMAL', coal: 'THERMAL', lignite: 'THERMAL',
    nuclear: 'NUCLEAR',
    hydro:   'HYDRO',
    gas:     'GAS',
    wind:    'WIND',
    solar:   'SOLAR',
    total:   'TOTAL', 'grand total': 'TOTAL', 'all india': 'TOTAL',
  }

  const figures = {}
  for (const row of rows) {
    const label = row.map(c => String(c || '').toLowerCase().trim()).find(s => s.length > 1) || ''
    const numCells = row.map(c => parseFloat(String(c).replace(/,/g, ''))).filter(n => !isNaN(n) && n > 0)
    if (!numCells.length) continue
    const val = numCells[numCells.length - 1]
    for (const [kw, fuel] of Object.entries(FUEL_MAP)) {
      if (label.includes(kw) && !figures[fuel]) {
        figures[fuel] = val
        break
      }
    }
  }
  return figures
}

// ── Synthesise 24-hour rows from daily MU totals ─────────────────────────
function synthesiseHourly(date, figures) {
  const FUELS = ['SOLAR', 'WIND', 'THERMAL', 'HYDRO', 'NUCLEAR', 'GAS']
  const genRows = []

  for (const fuel of FUELS) {
    const mu = figures[fuel]
    if (!mu || mu <= 0) continue
    const avgMW   = (mu * 1000) / 24
    const profile = PROFILES[fuel] || PROFILES.THERMAL
    for (let h = 0; h < 24; h++) {
      genRows.push({
        data_date:     date,
        hour:          h,
        source:        fuel,
        value_mw:      Math.round(avgMW * profile[h]),
        snapshot_time: 'eod',
      })
    }
  }

  const totalGenMU = FUELS.reduce((s, f) => s + (figures[f] || 0), 0)
  const demandMU   = figures.TOTAL || totalGenMU * 1.02
  const demAvgMW   = (demandMU * 1000) / 24
  const demRows = Array.from({ length: 24 }, (_, h) => ({
    data_date:     date,
    hour:          h,
    value_mw:      Math.round(demAvgMW * PROFILES.DEMAND[h]),
    snapshot_time: 'eod',
  }))

  return { genRows, demRows }
}

// ── Build daily summary ───────────────────────────────────────────────────
function buildSummary(date, figures, genRows, demRows) {
  const get  = src => genRows.filter(r => r.source === src).map(r => r.value_mw)
  const peak = arr => arr.length ? Math.max(...arr) : null
  const avg  = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

  const solar  = get('SOLAR')
  const wind   = get('WIND')
  const demand = demRows.map(r => r.value_mw)
  const avgDem = avg(demand)
  const reShare = avgDem ? +((avg(solar) + avg(wind)) / avgDem * 100).toFixed(1) : null

  return {
    data_date:        date,
    peak_demand_mw:   peak(demand),
    peak_solar_mw:    peak(solar),
    peak_wind_mw:     peak(wind),
    avg_re_share_pct: reShare,
    total_solar_mu:   figures.SOLAR   || null,
    total_wind_mu:    figures.WIND    || null,
    total_re_mu:      +((figures.SOLAR || 0) + (figures.WIND || 0)).toFixed(2) || null,
    total_demand_mu:  figures.TOTAL   || null,
    data_sources:     ['npp-dgr3'],
    notes: `NPP dgr3 EOD: solar=${figures.SOLAR}MU wind=${figures.WIND}MU thermal=${figures.THERMAL}MU total=${figures.TOTAL}MU`,
  }
}

// ── Main handler ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' })

  const secret = req.headers['x-cron-secret'] || req.query.secret
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET)
    return res.status(401).json({ error: 'Unauthorized' })

  const t0   = Date.now()
  const date = req.query.date || yesterdayIST()
  console.log(`\n[fetch-npp v2] ${date}`)

  // Try dgr3 first (9KB, cleanest), fallback to dgr1, dgr2
  let buf = null, reportNum = null
  for (const num of [3, 1, 2]) {
    const url = nppUrl(date, num)
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://npp.gov.in' },
        signal:  AbortSignal.timeout(20000),
      })
      if (!r.ok) { console.warn(`  dgr${num}: HTTP ${r.status}`); continue }
      const b = await r.arrayBuffer()
      if (b.byteLength < 1000) { console.warn(`  dgr${num}: too small`); continue }
      buf = b; reportNum = num
      console.log(`  ✓ dgr${num}: ${Math.round(b.byteLength / 1024)} KB`)
      break
    } catch (e) {
      console.warn(`  dgr${num}: ${e.message}`)
    }
  }

  if (!buf) {
    await supabase.from('fetch_log').insert({
      snapshot: 'npp-eod', status: 'failed', sources: ['npp.gov.in'],
      rows_written: 0, duration_ms: Date.now() - t0,
      error_msg: `No NPP reports available for ${date} — published ~17:00-18:00 IST`,
    })
    return res.status(200).json({
      ok: false, date, status: 'failed',
      note: 'NPP reports not yet published. They appear around 17:00–18:00 IST.',
    })
  }

  // Parse XLS
  let figures
  try {
    figures = parseDgr3(buf)
    console.log('  Parsed figures:', figures)
  } catch (e) {
    console.error('  XLS parse error:', e.message)
    await supabase.from('fetch_log').insert({
      snapshot: 'npp-eod', status: 'failed', sources: ['npp.gov.in'],
      rows_written: 0, duration_ms: Date.now() - t0,
      error_msg: `XLS parse error: ${e.message}`,
    })
    return res.status(500).json({ ok: false, error: `XLS parse: ${e.message}` })
  }

  if (!figures.SOLAR && !figures.WIND && !figures.THERMAL) {
    await supabase.from('fetch_log').insert({
      snapshot: 'npp-eod', status: 'partial', sources: [`npp-dgr${reportNum}`],
      rows_written: 0, duration_ms: Date.now() - t0,
      error_msg: 'XLS downloaded but no fuel figures extracted — format may have changed',
    })
    return res.status(200).json({
      ok: false, date, status: 'partial', figures,
      note: 'XLS downloaded but fuel totals not found. dgr3 format may have changed.',
    })
  }

  // Synthesise and save
  const { genRows, demRows } = synthesiseHourly(date, figures)
  const summary = buildSummary(date, figures, genRows, demRows)
  const errors  = []
  let rowsWritten = 0

  const { error: e1 } = await supabase.from('power_generation')
    .upsert(genRows, { onConflict: 'data_date,hour,source' })
  if (e1) errors.push(`generation: ${e1.message}`)
  else    rowsWritten += genRows.length

  const { error: e2 } = await supabase.from('power_demand')
    .upsert(demRows, { onConflict: 'data_date,hour' })
  if (e2) errors.push(`demand: ${e2.message}`)
  else    rowsWritten += demRows.length

  const { error: e3 } = await supabase.from('power_daily_summary')
    .upsert(summary, { onConflict: 'data_date' })
  if (e3) errors.push(`summary: ${e3.message}`)
  else    rowsWritten += 1

  const ms     = Date.now() - t0
  const status = errors.length === 0 ? 'ok' : rowsWritten > 0 ? 'partial' : 'failed'

  await supabase.from('fetch_log').insert({
    snapshot: 'npp-eod', status, sources: [`npp-dgr${reportNum}`],
    rows_written: rowsWritten, duration_ms: ms,
    error_msg: errors.length ? errors.join(' | ') : null,
  })

  return res.status(200).json({
    ok: true, date, status,
    dgr: reportNum, figures,
    genRows: genRows.length, demRows: demRows.length,
    rowsWritten, ms, errors,
    note: `Wrote ${genRows.length} gen + ${demRows.length} demand rows synthesised from NPP dgr${reportNum} daily MU totals`,
  })
}

export const config = { runtime: 'nodejs', maxDuration: 30, memory: 512 }
