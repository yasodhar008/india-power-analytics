import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { fetchSummaryHistory } from '../lib/supabase'
import { format, parseISO } from 'date-fns'

const fmt = v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v

export default function History() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    setLoading(true)
    fetchSummaryHistory(days)
      .then(rows => {
        setData(rows.map(r => ({
          ...r,
          dateLabel: format(parseISO(r.data_date), 'dd MMM'),
          peak_demand_gw: r.peak_demand_mw ? +(r.peak_demand_mw / 1000).toFixed(1) : null,
          peak_solar_gw: r.peak_solar_mw ? +(r.peak_solar_mw / 1000).toFixed(1) : null,
          peak_wind_gw: r.peak_wind_mw ? +(r.peak_wind_mw / 1000).toFixed(1) : null,
        })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [days])

  if (loading) return <div className="loading-state"><div className="spinner" /><span>Loading trends...</span></div>

  if (!data.length) return (
    <div className="empty-state">
      <div className="empty-icon">📈</div>
      <div className="empty-title">No historical data yet</div>
      <div className="empty-sub">Upload daily data to start building your trend history.</div>
    </div>
  )

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h2 className="page-title">Trends</h2>
          <p className="page-sub">Daily KPI history across uploaded dates</p>
        </div>
        <select className="date-select" value={days} onChange={e => setDays(+e.target.value)}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="chart-card wide">
        <div className="chart-title">Peak demand trend (GW)</div>
        <div className="chart-sub">Daily peak demand met across grid</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#94A3B8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#E2E8F0' }} />
            <Line type="monotone" dataKey="peak_demand_gw" name="Peak demand (GW)" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3, fill: '#3B82F6' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-row">
        <div className="chart-card">
          <div className="chart-title">Peak solar vs wind (GW)</div>
          <div className="chart-sub">Daily peaks</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#E2E8F0' }} />
              <Line type="monotone" dataKey="peak_solar_gw" name="Solar (GW)" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="peak_wind_gw" name="Wind (GW)" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-title">Average RE share (%)</div>
          <div className="chart-sub">Renewables as % of demand met</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#E2E8F0' }} />
              <Bar dataKey="avg_re_share_pct" name="RE share" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card wide">
        <div className="chart-title">Solar vs wind MU — daily total</div>
        <div className="chart-sub">Million units generated per day</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barSize={10}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#94A3B8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
            <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#E2E8F0' }} />
            <Bar dataKey="total_solar_mu" name="Solar MU" fill="#F59E0B" radius={[2, 2, 0, 0]} />
            <Bar dataKey="total_wind_mu" name="Wind MU" fill="#10B981" radius={[2, 2, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
