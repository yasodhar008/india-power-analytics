import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts'
import {
  fetchAvailableDates, fetchHourlyGeneration,
  fetchHourlyDemand, fetchDailySummary
} from '../lib/supabase'

const COLORS = {
  SOLAR: '#F59E0B', WIND: '#10B981', THERMAL: '#EF4444',
  HYDRO: '#3B82F6', NUCLEAR: '#8B5CF6', GAS: '#6B7280',
  DEMAND: '#E2E8F0', RE: '#10B981', NON_RE: '#334155'
}

const fmt = v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
const pctFmt = v => `${v.toFixed(1)}%`

function KPI({ label, value, unit, sub, color, icon }) {
  return (
    <div className="kpi-card" style={{ borderLeft: color ? `3px solid ${color}` : '1px solid var(--border)' }}>
      <div className="kpi-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      </div>
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
    const demandVal = d?.value_mw || 0

    const solar = row.SOLAR || 0
    const wind = row.WIND || 0
    const hydro = row.HYDRO || 0
    const nuclear = row.NUCLEAR || 0
    const gas = row.GAS || 0

    let thermal = row.THERMAL || 0

    // Logically calculate thermal if it is zero or missing
    if (thermal === 0 && demandVal > 0) {
      const otherGen = solar + wind + hydro + nuclear + gas;
      thermal = Math.max(0, demandVal - otherGen);
    }

    const reTotal = solar + wind + hydro;

    return {
      ...row,
      SOLAR: solar,
      WIND: wind,
      HYDRO: hydro,
      NUCLEAR: nuclear,
      GAS: gas,
      THERMAL: thermal,
      DEMAND: demandVal,
      RE_SHARE_PCT: demandVal > 0 ? (reTotal / demandVal) * 100 : 0
    }
  })

  const reRows = genData.map(row => ({
    hour: row.hour,
    Solar: row.SOLAR ?? 0,
    Wind: row.WIND ?? 0,
  }))

  const pieData = summary ? [
    { name: 'Solar', value: summary.total_solar_mu, color: COLORS.SOLAR },
    { name: 'Wind', value: summary.total_wind_mu, color: COLORS.WIND },
    { name: 'Other (Thermal/Hydro/Nuclear)', value: summary.total_demand_mu - (summary.total_solar_mu || 0) - (summary.total_wind_mu || 0), color: COLORS.NON_RE }
  ].filter(d => d.value > 0) : []

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
            <KPI label="Peak demand" value={summary ? Math.round(summary.peak_demand_mw / 1000) : '—'} unit="GW" sub="Max of day" icon="⚡" />
            <KPI label="Peak solar" value={summary ? Math.round(summary.peak_solar_mw / 1000) : '—'} unit="GW" sub="Midday peak" color="#F59E0B" icon="☀️" />
            <KPI label="Peak wind" value={summary ? Math.round(summary.peak_wind_mw / 1000) : '—'} unit="GW" sub="Typically evening" color="#10B981" icon="💨" />
            <KPI label="Avg RE share" value={summary ? summary.avg_re_share_pct : '—'} unit="%" sub="Of demand met" color="#3B82F6" icon="🌱" />
            <KPI label="Total solar" value={summary ? summary.total_solar_mu?.toFixed(0) : '—'} unit="MU" sub="Day total" color="#F59E0B" icon="📈" />
            <KPI label="Total wind" value={summary ? summary.total_wind_mu?.toFixed(0) : '—'} unit="MU" sub="Day total" color="#10B981" icon="🌬️" />
            <KPI label="Total RE" value={summary ? summary.total_re_mu?.toFixed(0) : '—'} unit="MU" sub="Solar + Wind" color="#3B82F6" icon="🔋" />
            <KPI label="Total demand" value={summary ? summary.total_demand_mu?.toFixed(0) : '—'} unit="MU" sub="Day total" icon="🏭" />
          </div>

          {/* Daily Generation Mix Profile */}
        <div className="chart-card wide" style={{
          background: 'linear-gradient(to bottom, var(--bg-surface), #0f1524)',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2), 0 10px 15px -3px rgba(0,0,0,0.1)',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
            <div className="chart-head">
              <div>
                <div className="chart-title">Daily Generation Mix Profile</div>
                <div className="chart-sub">Hourly MW by source vs Total Demand — {selectedDate}</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={mergedRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  {['SOLAR', 'WIND', 'HYDRO', 'NUCLEAR', 'GAS', 'THERMAL'].map(src => (
                    <linearGradient key={src} id={`grad${src}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[src]} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={COLORS[src]} stopOpacity={0.2} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="hour" tickFormatter={h => `${String(h).padStart(2,'0')}h`} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                {['THERMAL','GAS','NUCLEAR','HYDRO','WIND','SOLAR'].map(src => (
                  <Area key={src} type="monotone" dataKey={src} name={src.charAt(0)+src.slice(1).toLowerCase()} stackId="1" stroke={COLORS[src]} fill={`url(#grad${src})`} strokeWidth={1} />
                ))}
                <Line type="monotone" dataKey="DEMAND" name="Total Demand" stroke="#E2E8F0" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Additional insights row */}
          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-head">
                <div className="chart-title">Hourly RE Share (%)</div>
                <div className="chart-sub">Renewable generation as % of demand</div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={mergedRows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradREShare" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="hour" tickFormatter={h => `${String(h).padStart(2,'0')}h`} tick={{ fontSize: 10, fill: '#94A3B8' }} interval={3} />
                  <YAxis tickFormatter={pctFmt} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <Tooltip contentStyle={{ background: '#1E293B', borderColor: '#334155' }} itemStyle={{ color: '#E2E8F0' }} formatter={(v) => [`${v.toFixed(1)}%`, 'RE Share']} labelFormatter={l => `${String(l).padStart(2, '0')}:00`} />
                  <Area type="monotone" dataKey="RE_SHARE_PCT" stroke="#10B981" fill="url(#gradREShare)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-head">
                <div className="chart-title">Daily Energy Mix (MU)</div>
                <div className="chart-sub">Total energy generated by category</div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" nameKey="name" labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, value, index }) => {
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return (<text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>{value > 0 ? value.toFixed(0) : ''}</text>);
                  }}>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1E293B', borderColor: '#334155' }} itemStyle={{ color: '#E2E8F0' }} formatter={(v) => [`${v.toFixed(1)} MU`, 'Energy']} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
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
