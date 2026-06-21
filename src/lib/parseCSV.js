// Parse vidyut.gov.in generation CSV
// Columns: Source, Value, "Date & Time"
export function parseGenerationCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const rows = lines.slice(1).map(line => {
    const cols = (line.match(/(".*?"|[^,]+)/g) || []).map(c => c.replace(/"/g, '').trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = cols[i] || '' })
    return obj
  })

  // Group by source+hour, average values
  const bySourceHour = {}
  rows.forEach(r => {
    const src = (r['Source'] || r['source'] || '').trim().toUpperCase().replace(' GENERATION', '')
    const val = parseFloat((r['Value'] || r['value'] || '0').replace(/,/g, '')) || 0
    const dtStr = r['Date & Time'] || r['DateTime'] || r['date'] || ''
    const timePart = dtStr.includes(' ') ? dtStr.split(' ')[1] : dtStr
    const hour = parseInt(timePart?.split(':')[0] || '0', 10)
    const key = `${src}__${hour}`
    if (!bySourceHour[key]) bySourceHour[key] = { source: src, hour, values: [] }
    bySourceHour[key].values.push(val)
  })

  return Object.values(bySourceHour).map(({ source, hour, values }) => ({
    source: source + ' GENERATION',
    hour,
    value_mw: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
  }))
}

// Parse vidyut.gov.in demand CSV
// Columns: Source/Value, Time
export function parseDemandCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const rows = lines.slice(1).map(line => {
    const cols = (line.match(/(".*?"|[^,]+)/g) || []).map(c => c.replace(/"/g, '').trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = cols[i] || '' })
    return obj
  })

  const byHour = {}
  rows.forEach(r => {
    const val = parseFloat((r['Value'] || r['value'] || '0').replace(/,/g, '')) || 0
    const dtStr = r['Time'] || r['Date & Time'] || ''
    const timePart = dtStr.includes(' ') ? dtStr.split(' ')[1] : dtStr
    const hour = parseInt(timePart?.split(':')[0] || '0', 10)
    if (!byHour[hour]) byHour[hour] = []
    byHour[hour].push(val)
  })

  return Object.entries(byHour).map(([hour, vals]) => ({
    hour: parseInt(hour),
    value_mw: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
  }))
}

// Derive daily summary from parsed arrays
export function deriveSummary(date, genRows, demandRows) {
  const solar = genRows.filter(r => r.source.includes('SOLAR')).map(r => r.value_mw)
  const wind = genRows.filter(r => r.source.includes('WIND')).map(r => r.value_mw)
  const demand = demandRows.map(r => r.value_mw)

  const peakSolar = solar.length ? Math.max(...solar) : 0
  const peakWind = wind.length ? Math.max(...wind) : 0
  const peakDemand = demand.length ? Math.max(...demand) : 0

  const avgSolar = solar.reduce((a, b) => a + b, 0) / (solar.length || 1)
  const avgWind = wind.reduce((a, b) => a + b, 0) / (wind.length || 1)
  const avgDemand = demand.reduce((a, b) => a + b, 0) / (demand.length || 1)
  const avgRE = avgSolar + avgWind
  const reSharePct = avgDemand ? Math.round((avgRE / avgDemand) * 100 * 10) / 10 : 0

  return {
    data_date: date,
    peak_demand_mw: peakDemand,
    peak_solar_mw: peakSolar,
    peak_wind_mw: peakWind,
    avg_re_share_pct: reSharePct,
    total_solar_mu: Math.round(avgSolar * 24) / 1000,
    total_wind_mu: Math.round(avgWind * 24) / 1000,
    total_re_mu: Math.round(avgRE * 24) / 1000,
    total_demand_mu: Math.round(avgDemand * 24) / 1000,
    data_sources: ['vidyut'],
    notes: `Uploaded on ${new Date().toISOString().split('T')[0]}`,
  }
}
