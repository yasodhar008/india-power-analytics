/**
 * /api/fetch-npp  — v3 (zero external deps, pure binary scan)
 *
 * Downloads NPP dgr3 XLS (9 KB), extracts fuel-wise MU totals via
 * binary text scan (no xlsx package needed — works in any serverless env),
 * synthesises 24-hour MW profiles, writes to Supabase.
 *
 * Cron: GitHub Actions daily at 12:30 UTC (18:00 IST)
 * Manual: GET /api/fetch-npp?date=2026-06-17
 */

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

function nppUrl(date, num) {
  const [y, m, d] = date.split('-')
  return `https://npp.gov.in/public-reports/cea/daily/dgr/${d}-${m}-${y}/dgr${num}-${date}.xls`
}

// ── Diurnal profiles (raw weights normalised so sum = 24) ────────────────
const RAW = {
  SOLAR:   [0,0,0,0,0,0,0,  0.30,0.80,1.50,2.00,2.35,2.55,2.45,2.15,1.70,1.20,0.60,0.20,0,0,0,0,0],
  WIND:    [1.10,1.10,1.12,1.12,1.12,1.10,1.00,0.90,0.82,0.84,0.88,0.90,0.90,0.94,0.98,1.00,1.02,1.06,1.10,1.14,1.18,1.18,1.14,1.10],
  THERMAL: [0.95,0.93,0.91,0.90,0.91,0.94,0.99,1.05,1.08,1.06,1.02,0.98,0.97,0.97,0.98,0.98,0.99,1.03,1.09,1.12,1.10,1.07,1.03,0.99],
  HYDRO:   [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  NUCLEAR: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  GAS:     [0.85,0.82,0.80,0.80,0.82,0.88,0.98,1.05,1.08,1.05,1.02,1.00,1.00,1.00,1.00,1.00,1.02,1.08,1.15,1.18,1.15,1.10,1.03,0.93],
  DEMAND:  [0.86,0.83,0.80,0.78,0.79,0.83,0.90,0.97,1.05,1.10,1.10,1.07,1.04,1.03,1.02,1.02,1.04,1.07,1.12,1.16,1.15,1.11,1.04,0.94],
}

const PROFILES = {}
for (const [k, raw] of Object.entries(RAW)) {
  const sum = raw.reduce((a, b) => a + b, 0)
  PROFILES[k] = raw.map(v => (v * 24) / sum)
}

// ── Binary text scan — extracts printable ASCII from XLS binary ──────────
function parseDgr3Binary(buf) {
  const bytes = new Uint8Array(buf)
  // Extract printable ASCII strings separated by nulls/control chars
  const strings = []
  let cur = ''
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i]
    if (c >= 32 && c < 127) {
      cur += String.fromCharCode(c)
    } else {
      if (cur.length >= 2) strings.push(cur.trim())
      cur = ''
    }
  }
  if (cur.length >= 2) strings.push(cur.trim())

  // Match fuel labels to numeric values that follow them
  const FUEL_KEYS = {
    thermal: 'THERMAL', coal: 'THERMAL', lignite: 'THERMAL',
    nuclear: 'NUCLEAR',
    hydro:   'HYDRO',
    gas:     'GAS',
    wind:    'WIND',
    solar:   'SOLAR',
    total:   'TOTAL', 'grand total': 'TOTAL',
  }

  const figures = {}
  for (let i = 0; i < strings.length; i++) {
    const label = strings[i].toLowerCase()
    for (const [kw, fuel] of Object.entries(FUEL_KEYS)) {
      if (label.includes(kw) && !figures[fuel]) {
        // Look ahead up to 8 tokens for first plausible MU value (100–2000 range)
        for (let j = i + 1; j < Math.min(i + 8, strings.length); j++) {
          const n = parseFloat(strings[j].replace(/,/g, ''))
          if (!isNaN(n) && n >= 50 && n <= 6000) {
            figures[fuel] = n
            break
          }
        }
        break
      }
    }
  }
  return figures
}

// ── Synthesise hourly rows from daily MU totals ──────────────────────────
function synthesiseHourly(date, figures) {
  const FUELS = ['SOLAR', 'WIND', 'THERMAL', 'HYDRO', 'NUCLEAR', 'GAS']
  const genRows = []

  for (const fuel of FUELS) {
    const mu = figures[fuel]
    if (!mu || mu <= 0) continue
    const avgMW   = (mu * 1000) / 24
    const profile = PROFILES[fuel]
    for (let h = 0; h < 24; h++) {
      genRows.push({
        data_date: date, hour: h, source: fuel,
        value_mw: Math.round(avgMW * profile[h]),
        snapshot_time: 'eod',
      })
    }
  }

  const totalGenMU = FUELS.reduce((s, f) => s + (figures[f] || 0), 0)
  const demandMU   = figures.TOTAL || totalGenMU * 1.02
  const demAvgMW   = (demandMU * 1000) / 24
  const demRows = Array.from({ length: 24 }, (_, h) => ({
    data_date: date, hour: h,
    value_mw: Math.round(demAvgMW * PROFILES.DEMAND[h]),
    snapshot_time: 'eod',
  }))

  return { genRows, demRows }
}

// ── Build daily summary ───────────────────────────────────────────────────
function buildSummary(date, figures, genRows, demRows) {
  const get  = src => genRows.filter(r => r.source === src).map(r => r.value_mw)
  const peak = arr => arr.length ? Math.max(...arr) : null
  const avg  = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const solar = get('SOLAR'), wind = get('WIND'), demand = demRows.map(r => r.value_mw)
  const avgDem = avg(demand)
  return {
    data_date:        date,
    peak_demand_mw:   peak(demand),
    peak_solar_mw:    peak(solar),
    peak_wind_mw:     peak(wind),
    avg_re_share_pct: avgDem ? +((avg(solar) + avg(wind)) / avgDem * 100).toFixed(1) : null,
    total_solar_mu:   figures.SOLAR  || null,
    total_wind_mu:    figures.WIND   || null,
    total_re_mu:      +((figures.SOLAR || 0) + (figures.WIND || 0)).toFixed(2) || null,
    total_demand_mu:  figures.TOTAL  || null,
    data_sources:     ['npp-dgr3'],
    notes: `NPP dgr3 EOD: solar=${figures.SOLAR} wind=${figures.WIND} thermal=${figures.THERMAL} total=${figures.TOTAL}`,
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
  console.log(`[fetch-npp v3] ${date}`)

  // Try dgr3 first (9 KB), fallback dgr1, dgr2
  let buf = null, reportNum = null
  for (const num of [3, 1, 2]) {
    try {
      const r = await fetch(nppUrl(date, num), {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://npp.gov.in' },
        signal: AbortSignal.timeout(20000),
      })
      if (!r.ok) continue
      const b = await r.arrayBuffer()
      if (b.byteLength < 1000) continue
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
      error_msg: `No NPP reports for ${date} — published ~17:00-18:00 IST`,
    })
    return res.status(200).json({ ok: false, date, status: 'failed',
      note: 'NPP not yet published. Available ~17:00-18:00 IST.' })
  }

  const figures = parseDgr3Binary(buf)
  console.log('  Figures:', figures)

  if (!figures.SOLAR && !figures.WIND && !figures.THERMAL) {
    await supabase.from('fetch_log').insert({
      snapshot: 'npp-eod', status: 'partial', sources: [`npp-dgr${reportNum}`],
      rows_written: 0, duration_ms: Date.now() - t0,
      error_msg: 'XLS downloaded but no fuel figures found',
    })
    return res.status(200).json({ ok: false, date, status: 'partial', figures,
      note: 'Downloaded but no fuel totals extracted. Format may have changed.' })
  }

  const { genRows, demRows } = synthesiseHourly(date, figures)
  const summary = buildSummary(date, figures, genRows, demRows)
  const errors  = []
  let rowsWritten = 0

  const { error: e1 } = await supabase.from('power_generation')
    .upsert(genRows, { onConflict: 'data_date,hour,source' })
  if (e1) errors.push(`gen: ${e1.message}`)
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
    ok: true, date, status, dgr: reportNum, figures,
    genRows: genRows.length, demRows: demRows.length,
    rowsWritten, ms, errors,
    note: `Wrote ${rowsWritten} rows from NPP dgr${reportNum}`,
  })
}

export const config = { maxDuration: 30 }
