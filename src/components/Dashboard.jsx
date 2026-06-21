import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  fetchAvailableDates, fetchHourlyGeneration,
  fetchHourlyDemand, fetchDailySummary
} from '../lib/supabase'

const COLORS = {
  SOLAR: '#F59E0B', WIND: '#10B981', THERMAL: '#EF4444',
  HYDRO: '#3B82F6', NUCLEAR: '#8B5CF6', GAS: '#6B7280',
}

const fmt = v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v

function KPI({ label, value, unit, sub, color }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={color ? { color } : {}}>
        {value}<span className="kpi-unit"> {unit}</span>
      </div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="tt-label">{String(label).padStart(2, '0')}:00</div>
      {payload.map(p => (
        <div key={p.dataKey} className="tt-row">
          <span className="tt-dot" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="tt-val">{Math.round(p.value).toLocaleString()} MW</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard({ selectedDate, onDateChange }) {
  const [dates, setDates] = useState([])
  const [summary, setSummary] = useState(null)
  const [genData, setGenData] = useState([])
  const [demandData, setDemandData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAvailableDates()
      .then(d => {
        setDates(d)
        if (!selectedDate && d.length) onDateChange(d[0])
      })
      .catch(e => setError(e.message))
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    setLoading(true)
    Promise.all([
      fetchDailySummary(selectedDate),
      fetchHourlyGeneration(selectedDate),
      fetchHourlyDemand(selectedDate),
    ])
      .then(([sum, gen, dem]) => {
        setSummary(sum)
        setGenData(gen.rows)
        setDemandData(dem)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [selectedDate])

  // Merge demand into gen rows for the overview chart
  const mergedRows = genData.map(row => {
    const d = demandData.find(r => r.hour === row.hour)
    return { ...row, DEMAND: d?.value_mw ?? null }
  })

  const reRows = genData.map(row => ({
    hour: row.hour,
    Solar: row.SOLAR ?? 0,
    Wind: row.WIND ?? 0,
  }))

  if (error) return <div className="error-box">Error: {error}</div>

  return (
    <div className="dashboard">
      {/* Date selector */}
      <div className="date-bar">
        <span className="date-label">Viewing</span>
        <select
          className="date-select"
          value={selectedDate || ''}
          onChange={e => onDateChange(e.target.value)}
        >
          {dates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {summary?.data_sources && (
          <span className="source-badge">
            Sources: {summary.data_sources.join(' · ')}
          </span>
        )}
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading data...</span>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="kpi-grid">
            <KPI label="Peak demand" value={summary ? Math.round(summary.peak_demand_mw / 1000) : '—'} unit="GW" sub="Max of day" />
            <KPI label="Peak solar" value={summary ? Math.round(summary.peak_solar_mw / 1000) : '—'} unit="GW" sub="Midday peak" color="#F59E0B" />
            <KPI label="Peak wind" value={summary ? Math.round(summary.peak_wind_mw / 1000) : '—'} unit="GW" sub="Typically evening" color="#10B981" />
            <KPI label="Avg RE share" value={summary ? summary.avg_re_share_pct : '—'} unit="%" sub="Of demand met" color="#3B82F6" />
            <KPI label="Total solar" value={summary ? summary.total_solar_mu?.toFixed(0) : '—'} unit="MU" sub="Day total" color="#F59E0B" />
            <KPI label="Total wind" value={summary ? summary.total_wind_mu?.toFixed(0) : '—'} unit="MU" sub="Day total" color="#10B981" />
            <KPI label="Total RE" value={summary ? summary.total_re_mu?.toFixed(0) : '—'} unit="MU" sub="Solar + Wind" color="#3B82F6" />
            <KPI label="Total demand" value={summary ? summary.total_demand_mu?.toFixed(0) : '—'} unit="MU" sub="Day total" />
          </div>

          {/* Demand vs RE chart */}
          <div className="chart-card wide">
            <div className="chart-head">
              <div>
                <div className="chart-title">Demand met vs Renewable generation</div>
                <div className="chart-sub">Hourly MW — {selectedDate}</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={mergedRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="hour" tickFormatter={h => `${String(h).padStart(2,'0')}h`} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="DEMAND" name="Demand" stroke="#3B82F6" fill="none" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="SOLAR" name="Solar" stroke="#F59E0B" fill="url(#gradRE)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="WIND" name="Wind" stroke="#10B981" fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Two col: stacked gen + solar/wind */}
          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-head">
                <div className="chart-title">Generation mix — stacked</div>
                <div className="chart-sub">All sources, hourly MW</div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={genData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barSize={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="hour" tickFormatter={h => `${String(h).padStart(2,'0')}h`} tick={{ fontSize: 10, fill: '#94A3B8' }} interval={3} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  {['THERMAL','HYDRO','SOLAR','WIND','NUCLEAR','GAS'].map(src => (
                    <Bar key={src} dataKey={src} name={src.charAt(0)+src.slice(1).toLowerCase()} stackId="a" fill={COLORS[src]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-head">
                <div className="chart-title">Solar vs wind profile</div>
                <div className="chart-sub">Complementary generation pattern</div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={reRows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradSolar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradWind" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="hour" tickFormatter={h => `${String(h).padStart(2,'0')}h`} tick={{ fontSize: 10, fill: '#94A3B8' }} interval={3} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Solar" stroke="#F59E0B" fill="url(#gradSolar)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="Wind" stroke="#10B981" fill="url(#gradWind)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
