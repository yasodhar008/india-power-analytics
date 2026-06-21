/**
 * /api/fetch-cea-re
 *
 * Downloads the CEA Daily Renewable Generation Report from:
 *   cea.nic.in/renewable-generation-report/?lang=en
 *
 * This is the PDF that contains state-wise / region-wise
 * wind, solar, and others (biomass, small hydro) data —
 * the exact same format as the PDF in your uploaded files.
 *
 * The PDF is published every morning by CEA's Renewable
 * Project Monitoring Division (RPMD).
 *
 * Since this is a PDF (not a structured API), we:
 *   1. Fetch the listing page to find today's PDF link
 *   2. Download the PDF
 *   3. Extract tables via text scan (basic)
 *   4. Upsert state RE data to power_re_state table
 *
 * Full table extraction requires pdfplumber (Python) —
 * the Python uploader script handles the precise extraction.
 * This API does a best-effort text scan for the summary numbers.
 *
 * Cron: 05:30 UTC = 11:00 IST (CEA publishes ~10:00 AM IST)
 * Manual: GET /api/fetch-cea-re?date=2026-06-17
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL      || 'https://bfmstdkntpseyyhiaqza.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmbXN0ZGtudHBzZXl5aGlhcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTgwNjAsImV4cCI6MjA5Njk5NDA2MH0.Eh57unrBX6uSRbQFj86oSHpgRv0ks41mS_ScHhM5F04'
)

const nowIST   = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000)
const todayIST = () => nowIST().toISOString().split('T')[0]

const CEA_RE_BASE    = 'https://cea.nic.in'
const CEA_RE_LISTING = 'https://cea.nic.in/renewable-generation-report/?lang=en'

// Known CEA RE PDF URL patterns (CEA changes these periodically)
function ceaReUrls(date) {
  const [y, m, d]  = date.split('-')
  const compact    = `${y}${m}${d}`
  const ddmmyyyy   = `${d}-${m}-${y}`
  const ddmmyy     = `${d}-${m}-${y.slice(-2)}`
  return [
    // Most common current pattern
    `${CEA_RE_BASE}/wp-content/uploads/re_gen_report/${y}/${m}/${date}.pdf`,
    `${CEA_RE_BASE}/wp-content/uploads/re_gen_report/${y}/${m}/All_India_${date}.pdf`,
    `${CEA_RE_BASE}/wp-content/uploads/re_gen_report/${y}/${m}/RE_Report_${date}.pdf`,
    // Older patterns
    `${CEA_RE_BASE}/wp-content/uploads/re_daily/${y}/${m}/${date}.pdf`,
    `${CEA_RE_BASE}/wp-content/uploads/renewable-generation-report/${y}/${m}/${date}.pdf`,
    `${CEA_RE_BASE}/wp-content/uploads/rpmd/${compact}.pdf`,
  ]
}

// Scrape the listing page to find today's PDF link
async function findPDFFromListing(date) {
  try {
    const res = await fetch(CEA_RE_LISTING, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': CEA_RE_BASE },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const html = await res.text()

    // Look for PDF links containing the date
    const [y, m, d] = date.split('-')
    const dateVariants = [date, `${d}-${m}-${y}`, `${d}/${m}/${y}`, `${d}.${m}.${y}`]
    const linkPattern  = /href="([^"]*\.pdf[^"]*)"/gi
    let match

    while ((match = linkPattern.exec(html)) !== null) {
      const href = match[1]
      if (dateVariants.some(v => href.includes(v)) ||
          href.includes(date.replace(/-/g,'')) ) {
        return href.startsWith('http') ? href : `${CEA_RE_BASE}${href}`
      }
    }

    // Also try to find the most recent PDF link (first one on the page)
    linkPattern.lastIndex = 0
    const firstMatch = linkPattern.exec(html)
    if (firstMatch) {
      const href = firstMatch[1]
      return href.startsWith('http') ? href : `${CEA_RE_BASE}${href}`
    }
  } catch (e) {
    console.warn(`  CEA RE listing scrape failed: ${e.message}`)
  }
  return null
}

async function downloadPDF(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer':    CEA_RE_LISTING,
        'Accept':     'application/pdf,*/*',
      },
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    if (buf.byteLength < 5000) return null
    return buf
  } catch (_) { return null }
}

// Extract All India regional summary from PDF text
// PDF text contains lines like: "Northern Region  22.95  225.53  10.96  259.44"
function extractRegionalSummary(text, date) {
  const regions = [
    { key: 'Northern',     patterns: ['northern region', 'northern क्षेत्र'] },
    { key: 'Western',      patterns: ['western region',  'western क्षेत्र']  },
    { key: 'Southern',     patterns: ['southern region', 'southern क्षेत्र'] },
    { key: 'Eastern',      patterns: ['eastern region',  'eastern क्षेत्र']  },
    { key: 'North-Eastern',patterns: ['north-eastern',  'north eastern']    },
  ]

  const numRe    = /([\d,]+\.?\d*)/g
  const textLow  = text.toLowerCase()
  const records  = []

  regions.forEach(r => {
    const idx = r.patterns.reduce((found, p) => {
      const i = textLow.indexOf(p)
      return (i >= 0 && (found < 0 || i < found)) ? i : found
    }, -1)
    if (idx < 0) return

    // Extract 4 numbers after the region name (wind, solar, others, total)
    const segment = text.slice(idx, idx + 200)
    const nums    = []
    let m
    numRe.lastIndex = 0
    while ((m = numRe.exec(segment)) !== null && nums.length < 4) {
      const v = parseFloat(m[1].replace(/,/g,''))
      if (v >= 0) nums.push(v)
    }

    if (nums.length >= 4) {
      records.push({
        data_date:  date,
        state:      `${r.key} Region`,
        region:     r.key,
        wind_mu:    nums[0],
        solar_mu:   nums[1],
        others_mu:  nums[2],
        total_mu:   nums[3],
      })
    }
  })

  // All India total
  const aiIdx = textLow.indexOf('all india')
  if (aiIdx >= 0) {
    const segment = text.slice(aiIdx, aiIdx + 200)
    const nums    = []
    let m
    numRe.lastIndex = 0
    while ((m = numRe.exec(segment)) !== null && nums.length < 4) {
      const v = parseFloat(m[1].replace(/,/g,''))
      if (v >= 0) nums.push(v)
    }
    if (nums.length >= 4) {
      records.push({
        data_date: date, state: 'All India', region: 'All India',
        wind_mu: nums[0], solar_mu: nums[1], others_mu: nums[2], total_mu: nums[3],
      })
    }
  }

  return records
}

export default async function handler(req, res) {
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' })

  const secret = req.headers['x-cron-secret'] || req.query.secret
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET)
    return res.status(401).json({ error: 'Unauthorized' })

  const t0   = Date.now()
  const date = req.query.date || todayIST()
  console.log(`\n[fetch-cea-re] ${date}`)

  // Step 1: Try known URL patterns
  let pdfBuf = null
  let pdfUrl = null

  for (const url of ceaReUrls(date)) {
    console.log(`  Trying: ${url}`)
    pdfBuf = await downloadPDF(url)
    if (pdfBuf) { pdfUrl = url; break }
  }

  // Step 2: Scrape listing page if patterns failed
  if (!pdfBuf) {
    console.log('  URL patterns failed — scraping listing page...')
    const found = await findPDFFromListing(date)
    if (found) {
      console.log(`  Found via listing: ${found}`)
      pdfBuf = await downloadPDF(found)
      if (pdfBuf) pdfUrl = found
    }
  }

  if (!pdfBuf) {
    await supabase.from('fetch_log').insert({
      snapshot: 'cea-re-daily', status: 'failed',
      sources: ['cea.nic.in/renewable-generation-report'],
      rows_written: 0, duration_ms: Date.now() - t0,
      error_msg: 'PDF not found — check cea.nic.in/renewable-generation-report manually',
    })
    return res.status(200).json({
      ok: false, date,
      note: 'CEA RE PDF not found via known URL patterns. It may not be published yet (published ~10:00 AM IST) or the URL format has changed. Download manually from cea.nic.in/renewable-generation-report and upload via /upload tab.',
      manualUrl: CEA_RE_LISTING,
    })
  }

  console.log(`  PDF downloaded: ${Math.round(pdfBuf.byteLength/1024)} KB from ${pdfUrl}`)

  // Step 3: Extract text from PDF (basic — full parsing needs pdfplumber in Python)
  const bytes = new Uint8Array(pdfBuf)
  let text = ''
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i]
    if (c >= 32 && c < 127) text += String.fromCharCode(c)
    else if (c === 10 || c === 13) text += '\n'
  }

  // Step 4: Extract regional summary
  const records = extractRegionalSummary(text, date)
  console.log(`  Extracted ${records.length} regional records`)

  let rowsWritten = 0
  if (records.length > 0) {
    const { error } = await supabase.from('power_re_state')
      .upsert(records, { onConflict: 'data_date,state' })
    if (!error) rowsWritten = records.length
    else console.error('  RE state upsert:', error.message)
  }

  const ms = Date.now() - t0
  await supabase.from('fetch_log').insert({
    snapshot: 'cea-re-daily', status: rowsWritten > 0 ? 'ok' : 'partial',
    sources: ['cea.nic.in/renewable-generation-report'],
    rows_written: rowsWritten, duration_ms: ms,
  })

  return res.status(200).json({
    ok: true, date, pdfUrl, sizeKB: Math.round(pdfBuf.byteLength/1024),
    recordsExtracted: records.length, rowsWritten, ms,
    note: records.length > 0
      ? `Extracted ${records.length} regional RE records. State-level detail requires Python pdfplumber — upload via /upload tab for full granularity.`
      : 'PDF downloaded but text extraction yielded no structured data. Use Python uploader for accurate state-wise parsing.',
    pythonUploaderNote: 'Run: python upload_to_supabase.py --re path/to/cea_re.pdf --date ' + date,
  })
}

export const config = { runtime: 'nodejs', maxDuration: 30, memory: 512 }
