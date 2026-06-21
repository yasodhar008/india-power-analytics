import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { fetchAvailableDates, fetchStateRE } from '../lib/supabase'

export default function Regional() {
  const [dates, setDates] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [stateData, setStateData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAvailableDates().then(d => {
      const reDates = d // in a real app, filter dates that have RE data
      setDates(reDates)
      if (reDates.length) setSelectedDate(reDates[reDates.length - 1])
    })
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    setLoading(true)
    fetchStateRE(selectedDate)
      .then(rows => { setStateData(rows); setLoading(false) })
      .catch(() => setLoading(false))
  }, [selectedDate])

  const regionSummary = stateData.reduce((acc, row) => {
    const r = row.region || 'Other'
    if (!acc[r]) acc[r] = { region: r, solar_mu: 0, wind_mu: 0, others_mu: 0, total_mu: 0 }
    acc[r].solar_mu += Number(row.solar_mu) || 0
    acc[r].wind_mu += Number(row.wind_mu) || 0
    acc[r].others_mu += Number(row.others_mu) || 0
    acc[r].total_mu += Number(row.total_mu) || 0
    return acc
  }, {})

  const regionRows = Object.values(regionSummary).sort((a, b) => b.total_mu - a.total_mu)
  const top10 = [...stateData].sort((a, b) => b.total_mu - a.total_mu).slice(0, 10)

  if (loading) return <div className="loading-state"><div className="spinner" /><span>Loading state data...</span></div>

  if (!stateData.length) return (
    <div className="empty-state">
      <div className="empty-icon">🗺️</div>
      <div className="empty-title">No regional RE data</div>
      <div className="empty-sub">Upload a CEA state-wise RE CSV to see the regional breakdown.</div>
    </div>
  )

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h2 className="page-title">Regional breakdown</h2>
          <p className="page-sub">State-wise RE generation — CEA data</p>
        </div>
        <select className="date-select" value={selectedDate || ''} onChange={e => setSelectedDate(e.target.value)}>
          {dates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="chart-card wide">
        <div className="chart-title">Top 10 states — solar generation (MU)</div>
        <div className="chart-sub">Cumulative for {selectedDate}</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={top10} layout="vertical" margin={{ top: 4, right: 20, left: 100, bottom: 0 }} barSize={14}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} />
            <YAxis type="category" dataKey="state" tick={{ fontSize: 12, fill: '#CBD5E1' }} width={95} />
            <Tooltip
              contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#E2E8F0' }}
              formatter={v => [`${Number(v).toFixed(1)} MU`]}
            />
            <Bar dataKey="solar_mu" name="Solar MU" fill="#F59E0B" radius={[0, 3, 3, 0]} />
            <Bar dataKey="wind_mu" name="Wind MU" fill="#10B981" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card wide">
        <div className="chart-title">Region-wise RE mix (MU)</div>
        <div className="chart-sub">Solar · Wind · Others</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={regionRows} margin={{ top: 4, right: 12, left: 0, bottom: 0 }} barSize={24}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="region" tick={{ fontSize: 11, fill: '#94A3B8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
            <Tooltip
              contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#E2E8F0' }}
              formatter={v => [`${Number(v).toFixed(1)} MU`]}
            />
            <Bar dataKey="solar_mu" name="Solar" fill="#F59E0B" stackId="a" />
            <Bar dataKey="wind_mu" name="Wind" fill="#10B981" stackId="a" />
            <Bar dataKey="others_mu" name="Others" fill="#8B5CF6" stackId="a" radius={[3, 3, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* State table */}
      <div className="chart-card wide">
        <div className="chart-title">All states — RE summary</div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>State</th><th>Region</th><th>Wind (MU)</th>
                <th>Solar (MU)</th><th>Others (MU)</th><th>Total (MU)</th>
              </tr>
            </thead>
            <tbody>
              {stateData.map(r => (
                <tr key={r.state}>
                  <td className="state-name">{r.state}</td>
                  <td><span className="region-tag">{r.region}</span></td>
                  <td className="num wind">{Number(r.wind_mu).toFixed(1)}</td>
                  <td className="num solar">{Number(r.solar_mu).toFixed(1)}</td>
                  <td className="num">{Number(r.others_mu).toFixed(1)}</td>
                  <td className="num bold">{Number(r.total_mu).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
