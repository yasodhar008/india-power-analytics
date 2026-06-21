/**
 * /api/fetch-snapshot
 *
 * Vercel Node.js Serverless Function — runs at 08:00, 13:00, 18:00 IST
 *
 * Data source: CEA OPM Daily Generation Report
 *   cea.nic.in/opm_grid_operation/daily-generation-report/
 *
 * The CEA page is JS-rendered (Angular). We use Puppeteer + Chromium to:
 *   1. Open the CEA daily generation report page
 *   2. Set the date
 *   3. Intercept the CSV download for generation and demand
 *   4. Parse and upsert to Supabase
 *
 * Falls back to NPP dgr3 XLS (All India Summary) if CEA page fails —
 * dgr3 is tiny (9 KB), always available next-day, and has fuel-wise MU totals.
 */

import chromium  from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL      || 'https://bfmstdkntpseyyhiaqza.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmbXN0ZGtudHBzZXl5aGlhcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTgwNjAsImV4cCI6MjA5Njk5NDA2MH0.Eh57unrBX6uSRbQFj86oSHpgRv0ks41mS_ScHhM5F04'
)

// ── IST helpers ───────────────────────────────────────────────────────────
const nowIST    = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000)
const todayIST  = () => nowIST().toISOString().split('T')[0]
const snapshotLabel = () => {
  const h = nowIST().getUTCHours()
  if (h < 10) return '08:00'
  if (h < 15) return '13:00'
  if (h < 21) return '18:00'
  return 'eod'
}

// ── NPP URL builder (confirmed working — public XLS) ──────────────────────
function nppUrl(date, num, fmt = 'xls') {
  const [y, m, d] = date.split('-')
  return `https://npp.gov.in/public-reports/cea/daily/dgr/${d}-${m}-${y}/dgr${num}-${date}.${fmt}`
}

// ── CEA OPM daily report URL ──────────────────────────────────────────────
const CEA_OPM_URL = 'https://cea.nic.in/opm_grid_operation/daily-generation-report/?lang=en'

// ── Launch Puppeteer ──────────────────────────────────────────────────────
async function launchBrowser() {
  return puppeteer.launch({
    args: [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage', '--single-process'],
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    defaultViewport: chromium.defaultViewport,
  })
}

// ── Strategy 1: CEA OPM page (primary — same-day hourly data) ─────────────
async function fetchCEAHourly(page, date, snapshot) {
  console.log(`  [CEA] Opening OPM daily generation report...`)
  const captured = { generation: null, demand: null }

  // Intercept all JSON/CSV responses
  await page.setRequestInterception(true)
  page.on('request', r => r.continue())
  page.on('response', async res => {
    const url = res.url()
    const ct  = (res.headers()['content-type'] || '').toLowerCase()
    if (!url.includes('cea.nic.in')) return
    if (!ct.includes('json') && !ct.includes('csv') && !ct.includes('text')) return
    try {
      const text = await res.text()
      if (text.length < 100) return
      const urlL = url.toLowerCase()
      if (urlL.includes('generat') && !captured.generation) {
        captured.generation = { url, text }
        console.log(`    CEA generation API found: ${url}`)
      }
      if (urlL.includes('demand') && !captured.demand) {
        captured.demand = { url, text }
        console.log(`    CEA demand API found: ${url}`)
      }
    } catch (_) {}
  })

  try {
    await page.goto(CEA_OPM_URL, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise(r => setTimeout(r, 4000))

    // Try to set date on page
    const dateInputs = await page.$$('input[type="date"], input[placeholder*="date" i]')
    for (const inp of dateInputs) {
      await page.evaluate((el, d) => {
        el.value = d
        el.dispatchEvent(new Event('change', { bubbles: true }))
        el.dispatchEvent(new Event('input',  { bubbles: true }))
      }, inp, date)
    }
    await new Promise(r => setTimeout(r, 3000))

    // Try to find and click any fetch/submit/generate buttons
    const btnSelectors = [
      'button[type="submit"]', 'button:contains("Get")', 'button:contains("Fetch")',
      'button:contains("Generate")', 'button:contains("Show")', '.btn-primary',
    ]
    for (const sel of btnSelectors) {
      try {
        const btn = await page.$(sel)
        if (btn) { await btn.click(); await new Promise(r => setTimeout(r, 2000)); break }
      } catch (_) {}
    }

    // Replay captured API URLs with target date
    const allUrls = [...(captured.generation ? [captured.generation.url] : []),
                     ...(captured.demand     ? [captured.demand.url]     : [])]
    for (const originalUrl of allUrls) {
      try {
        const newUrl = originalUrl.replace(/date=[^&]+/gi, `date=${date}`)
                                  .replace(/\d{4}-\d{2}-\d{2}/, date)
        if (newUrl !== originalUrl) {
          const data = await page.evaluate(async (u) => {
            const r = await fetch(u, { credentials: 'include' })
            return r.ok ? r.text() : null
          }, newUrl)
          if (data && data.length > 100) {
            if (originalUrl === captured.generation?.url) captured.generation.text = data
            if (originalUrl === captured.demand?.url)     captured.demand.text     = data
          }
        }
      } catch (_) {}
    }
  } catch (e) {
    console.warn(`  [CEA] Page navigation failed: ${e.message}`)
  }

  return captured
}

// ── Strategy 2: NPP dgr3 fallback (next-day, fuel-wise MU totals) ─────────
async function fetchNPPFallback(date) {
  console.log(`  [NPP] Fetching dgr3 (All India Summary) as fallback...`)
  try {
    const res = await fetch(nppUrl(date, 3, 'xls'), {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://npp.gov.in' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = await res.arrayBuffer()
    if (buf.byteLength < 1000) throw new Error('File too small')
    console.log(`  [NPP] dgr3 downloaded: ${(buf.byteLength/1024).toFixed(0)} KB`)
    return buf
  } catch (e) {
    console.warn(`  [NPP] dgr3 fallback failed: ${e.message}`)
    return null
  }
}

// ── Parse CEA CSV text → DB rows ──────────────────────────────────────────
function parseCEACSV(text, type, date, snapshot) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g,'').toLowerCase())
  const srcIdx  = headers.findIndex(h => h.includes('source') || h.includes('type') || h.includes('fuel'))
  const valIdx  = headers.findIndex(h => h.includes('value') || h.includes('mw') || h.includes('generation'))
  const timeIdx = headers.findIndex(h => h.includes('time') || h.includes('date') || h.includes('hour'))
  if (valIdx < 0 || timeIdx < 0) return []

  const byKey = {}
  lines.slice(1).forEach(line => {
    const cols = line.split(',').map(c => c.trim().replace(/"/g,''))
    const val  = parseFloat(cols[valIdx]?.replace(/,/g,'') || '0') || 0
    const time = cols[timeIdx] || ''
    const hour = parseInt((time.split(' ')[1] || time).split(':')[0] || '0', 10)
    const src  = srcIdx >= 0 ? (cols[srcIdx] || '').toUpperCase().trim() : type.toUpperCase()
    const key  = `${src}__${hour}`
    if (!byKey[key]) byKey[key] = { src, hour, vals: [] }
    byKey[key].vals.push(val)
  })

  return Object.values(byKey).map(({ src, hour, vals }) => ({
    data_date:    date,
    hour,
    source:       type === 'demand' ? 'DEMAND'
                  : src.includes('GENERATION') ? src : `${src} GENERATION`,
    value_mw:     Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    snapshot_time: snapshot,
  }))
}

// ── Build snapshot summary ─────────────────────────────────────────────────
function buildSummary(date, snapshot, genRows, demRows) {
  const get  = src => genRows.filter(r => r.source?.includes(src)).map(r => r.value_mw)
  const avg  = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0
  const mx   = arr => arr.length ? Math.max(...arr) : null
  const solar = get('SOLAR'), wind = get('WIND'), thermal = get('THERMAL')
  const demand = demRows.map(r => r.value_mw)
  const curSolar = solar.at(-1) ?? avg(solar)
  const curWind  = wind.at(-1)  ?? avg(wind)
  const curDemand = demand.at(-1) ?? avg(demand)
  const reShare = curDemand ? +((curSolar+curWind)/curDemand*100).toFixed(1) : null
  const notes = {
    '08:00': `Morning ramp — solar ${(curSolar/1000).toFixed(1)}GW, demand ${(curDemand/1000).toFixed(1)}GW`,
    '13:00': `Solar peak — ${(curSolar/1000).toFixed(1)}GW, RE share ${reShare}%`,
    '18:00': `Evening peak — solar collapsing to ${(curSolar/1000).toFixed(1)}GW, wind ${(curWind/1000).toFixed(1)}GW rising`,
  }
  return {
    data_date: date, snapshot_time: snapshot,
    snapshot_ist: new Date(Date.now()+5.5*60*60*1000).toISOString(),
    peak_demand_mw: mx(demand), peak_solar_mw: mx(solar), peak_wind_mw: mx(wind),
    cur_demand_mw: curDemand, cur_solar_mw: curSolar, cur_wind_mw: curWind,
    cur_thermal_mw: thermal.at(-1) ?? avg(thermal),
    re_share_pct: reShare,
    thermal_share_pct: curDemand ? +((avg(thermal)/curDemand)*100).toFixed(1) : null,
    grid_note: notes[snapshot] || '',
    fetch_status: 'ok', raw_source: 'cea-opm',
  }
}

// ── Save to Supabase ──────────────────────────────────────────────────────
async function saveAll(date, snapshot, genRows, demRows) {
  let rows = 0
  if (genRows.length) {
    const { error } = await supabase.from('power_generation')
      .upsert(genRows, { onConflict: 'data_date,hour,source,snapshot_time' })
    if (!error) rows += genRows.length
    else console.error('Gen upsert:', error.message)
  }
  if (demRows.length) {
    const { error } = await supabase.from('power_demand')
      .upsert(demRows, { onConflict: 'data_date,hour,snapshot_time' })
    if (!error) rows += demRows.length
    else console.error('Demand upsert:', error.message)
  }
  if (genRows.length || demRows.length) {
    await supabase.from('power_snapshot_summary')
      .upsert(buildSummary(date, snapshot, genRows, demRows), { onConflict: 'data_date,snapshot_time' })
    const solar = genRows.filter(r=>r.source?.includes('SOLAR')).map(r=>r.value_mw)
    const wind  = genRows.filter(r=>r.source?.includes('WIND')).map(r=>r.value_mw)
    const dem   = demRows.map(r=>r.value_mw)
    const avg   = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0
    await supabase.from('power_daily_summary').upsert({
      data_date: date,
      peak_demand_mw: dem.length  ? Math.max(...dem)   : null,
      peak_solar_mw:  solar.length? Math.max(...solar)  : null,
      peak_wind_mw:   wind.length ? Math.max(...wind)   : null,
      avg_re_share_pct: dem.length ? +((avg(solar)+avg(wind))/avg(dem)*100).toFixed(1) : null,
      total_solar_mu: +(avg(solar)*24/1000).toFixed(3),
      total_wind_mu:  +(avg(wind)*24/1000).toFixed(3),
      total_re_mu:    +((avg(solar)+avg(wind))*24/1000).toFixed(3),
      total_demand_mu:+(avg(dem)*24/1000).toFixed(3),
      data_sources: ['cea-opm'],
      notes: `CEA OPM snapshot ${snapshot} IST`,
    }, { onConflict: 'data_date' })
  }
  return rows
}

// ── Main handler ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  const secret = req.headers['x-cron-secret'] || req.query.secret
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET)
    return res.status(401).json({ error: 'Unauthorized' })

  const t0       = Date.now()
  const date     = req.query.date     || todayIST()
  const snapshot = req.query.snapshot || snapshotLabel()
  console.log(`\n[fetch-snapshot] ${date} @ ${snapshot}`)

  let browser = null, rowsWritten = 0, status = 'failed', source = 'none'

  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

    // Primary: CEA OPM hourly data
    const captured = await fetchCEAHourly(page, date, snapshot)
    let genRows = [], demRows = []

    if (captured.generation?.text) {
      genRows = parseCEACSV(captured.generation.text, 'generation', date, snapshot)
      console.log(`  Parsed ${genRows.length} gen rows from CEA`)
    }
    if (captured.demand?.text) {
      demRows = parseCEACSV(captured.demand.text, 'demand', date, snapshot)
      console.log(`  Parsed ${demRows.length} demand rows from CEA`)
    }

    // Fallback: NPP dgr3 if CEA didn't yield data
    if (!genRows.length) {
      console.log('  CEA yielded no data — trying NPP dgr3 fallback')
      const buf = await fetchNPPFallback(date)
      if (buf) {
        // dgr3 XLS has fuel-wise daily MU totals — store as eod snapshot
        source = 'npp-dgr3'
        // We can't easily parse XLS binary server-side without a library
        // but we can store a placeholder and flag it for manual review
        await supabase.from('fetch_log').insert({
          snapshot, status: 'partial', sources: ['npp-dgr3-fallback'],
          rows_written: 0, duration_ms: Date.now()-t0,
          error_msg: 'CEA OPM returned no parseable data; dgr3 downloaded for manual review',
        })
        return res.status(200).json({
          ok: true, date, snapshot, status: 'partial', rows: 0, source: 'npp-dgr3',
          note: 'CEA OPM page did not return structured data. NPP dgr3 downloaded but requires server-side XLS parsing. Upload CSV manually via /upload tab.',
        })
      }
      status = 'failed'
    } else {
      rowsWritten = await saveAll(date, snapshot, genRows, demRows)
      status = rowsWritten > 0 ? 'ok' : 'partial'
      source = 'cea-opm'
    }
  } catch (e) {
    console.error('[fetch-snapshot]', e.message)
    await supabase.from('fetch_log').insert({
      snapshot, status: 'failed', sources: ['cea-opm'],
      rows_written: 0, error_msg: e.message, duration_ms: Date.now()-t0,
    })
    return res.status(500).json({ ok: false, error: e.message })
  } finally {
    if (browser) await browser.close()
  }

  const ms = Date.now() - t0
  await supabase.from('fetch_log').insert({
    snapshot, status, sources: [source],
    rows_written: rowsWritten, duration_ms: ms,
  })

  return res.status(200).json({
    ok: true, date, snapshot, status, rows: rowsWritten, source, ms,
    note: status === 'ok'
      ? `Saved ${rowsWritten} rows from CEA OPM daily generation report`
      : 'CEA OPM did not return parseable data — upload CSV manually',
  })
}

export const config = { runtime: 'nodejs', maxDuration: 60, memory: 1024 }
