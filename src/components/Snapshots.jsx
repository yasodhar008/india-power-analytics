import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine } from 'recharts'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'

const SNAPSHOTS = [
  { key: '08:00', label: 'Morning ramp',  icon: '🌅', color: '#F97316' },
  { key: '13:00', label: 'Solar peak',    icon: '☀️',  color: '#EAB308' },
  { key: '18:00', label: 'Evening peak',  icon: '🌆', color: '#8B5CF6' },
]

function StatRow({ label, morning, solar, evening, unit = 'GW', divisor = 1000 }) {
  const fmt = v => v ? `${(v / divisor).toFixed(1)} ${unit}` : '—'
  return (
    <tr>
      <td className="sr-label">{label}</td>
      <td className="sr-val" style={{ color: '#F97316' }}>{fmt(morning)}</td>
      <td className="sr-val" style={{ color: '#EAB308' }}>{fmt(solar)}</td>
      <td className="sr-val" style={{ color: '#8B5CF6' }}>{fmt(evening)}</td>
      <td className="sr-delta">
        {morning && evening
          ? `${((evening - morning) / divisor).toFixed(1) > 0 ? '+' : ''}${((evening - morning) / divisor).toFixed(1)} ${unit}`
          : '—'}
      </td>
    </tr>
  )
}

export default function Snapshots() {
  const [dates, setDates] = useState([])
  const [date, setDate]   = useState(null)
  const [snaps, setSnaps] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('power_snapshot_summary')
      .select('data_date')
      .order('data_date', { ascending: false })
      .then(({ data }) => {
        const unique = [...new Set((data || []).map(r => r.data_date))]
        setDates(unique)
        if (unique.length) setDate(unique[0])
      })
  }, [])

  useEffect(() => {
    if (!date) return
    setLoading(true)
    supabase
      .from('power_snapshot_summary')
      .select('*')
      .eq('data_date', date)
      .order('snapshot_time')
      .then(({ data }) => { setSnaps(data || []); setLoading(false) })
  }, [date])

  const getSnap = key => snaps.find(s => s.snapshot_time === key)
  const morning = getSnap('08:00')
  const noon    = getSnap('13:00')
  const evening = getSnap('18:00')

  // Build comparison bar data
  const compData = [
    { metric: 'Solar', '08:00': morning?.cur_solar_mw, '13:00': noon?.cur_solar_mw, '18:00': evening?.cur_solar_mw },
    { metric: 'Wind',  '08:00': morning?.cur_wind_mw,  '13:00': noon?.cur_wind_mw,  '18:00': evening?.cur_wind_mw  },
    { metric: 'Demand','08:00': morning?.cur_demand_mw,'13:00': noon?.cur_demand_mw,'18:00': evening?.cur_demand_mw},
  ].map(r => ({
    ...r,
    '08:00': r['08:00'] ? +(r['08:00'] / 1000).toFixed(1) : 0,
    '13:00': r['13:00'] ? +(r['13:00'] / 1000).toFixed(1) : 0,
    '18:00': r['18:00'] ? +(r['18:00'] / 1000).toFixed(1) : 0,
  }))

  // RE share line data
  const reData = snaps.map(s => ({
    time: s.snapshot_time,
    re_share: s.re_share_pct,
    thermal: s.thermal_share_pct,
  }))

  if (loading && !snaps.length) return (
    <div className="loading-state"><div className="spinner" /><span>Loading snapshots...</span></div>
  )

  if (!dates.length) return (
    <div className="empty-state">
      <div className="empty-icon">⏱️</div>
      <div className="empty-title">No snapshot data yet</div>
      <div className="empty-sub">
        Snapshots are captured automatically at 08:00, 13:00, and 18:00 IST each day.<br />
        Data will appear here once the first snapshot runs.
      </div>
    </div>
  )

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h2 className="page-title">Daily snapshots</h2>
          <p className="page-sub">Three-point grid state capture — 08:00 · 13:00 · 18:00 IST</p>
        </div>
        <select className="date-select" value={date || ''} onChange={e => setDate(e.target.value)}>
          {dates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Three snapshot cards */}
      <div className="snap-grid">
        {SNAPSHOTS.map(({ key, label, icon, color }) => {
          const s = getSnap(key)
          return (
            <div key={key} className="snap-card" style={{ borderTopColor: color }}>
              <div className="snap-header">
                <span className="snap-icon">{icon}</span>
                <div>
                  <div className="snap-time" style={{ color }}>{key} IST</div>
                  <div className="snap-label">{label}</div>
                </div>
                {s?.fetch_status === 'ok'
                  ? <span className="status-pill ok">Live</span>
                  : <span className="status-pill pending">Pending</span>}
              </div>
              {s ? (
                <div className="snap-metrics">
                  <div className="snap-metric">
                    <span className="sm-label">Solar</span>
                    <span className="sm-val solar">{s.cur_solar_mw ? `${(s.cur_solar_mw/1000).toFixed(1)} GW` : '—'}</span>
                  </div>
                  <div className="snap-metric">
                    <span className="sm-label">Wind</span>
                    <span className="sm-val wind">{s.cur_wind_mw ? `${(s.cur_wind_mw/1000).toFixed(1)} GW` : '—'}</span>
                  </div>
                  <div className="snap-metric">
                    <span className="sm-label">Demand</span>
                    <span className="sm-val">{s.cur_demand_mw ? `${(s.cur_demand_mw/1000).toFixed(1)} GW` : '—'}</span>
                  </div>
                  <div className="snap-metric">
                    <span className="sm-label">RE share</span>
                    <span className="sm-val accent">{s.re_share_pct ? `${s.re_share_pct}%` : '—'}</span>
                  </div>
                  {s.grid_note && (
                    <div className="snap-note">{s.grid_note}</div>
                  )}
                </div>
              ) : (
                <div className="snap-empty">Not yet captured</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Comparison bar chart */}
      {compData.some(r => r['08:00'] || r['13:00'] || r['18:00']) && (
        <div className="chart-card wide">
          <div className="chart-title">Solar · Wind · Demand — snapshot comparison (GW)</div>
          <div className="chart-sub">Same-day three-point comparison</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={compData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barSize={20} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="metric" tick={{ fontSize: 12, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} unit=" GW" />
              <Tooltip
                contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#E2E8F0' }}
                formatter={v => [`${v} GW`]}
              />
              <Bar dataKey="08:00" name="08:00 IST" fill="#F97316" radius={[3,3,0,0]} />
              <Bar dataKey="13:00" name="13:00 IST" fill="#EAB308" radius={[3,3,0,0]} />
              <Bar dataKey="18:00" name="18:00 IST" fill="#8B5CF6" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* RE share trend across snapshots */}
      {reData.length > 1 && (
        <div className="chart-row">
          <div className="chart-card">
            <div className="chart-title">RE share across snapshots</div>
            <div className="chart-sub">% of demand met by renewables</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={reData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis unit="%" tick={{ fontSize: 11, fill: '#94A3B8' }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#E2E8F0' }} />
                <ReferenceLine y={50} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 2" label={{ value: '50%', fill: '#475569', fontSize: 10 }} />
                <Line type="monotone" dataKey="re_share" name="RE share" stroke="#10B981" strokeWidth={2} dot={{ r: 5, fill: '#10B981' }} />
                <Line type="monotone" dataKey="thermal" name="Thermal share" stroke="#EF4444" strokeWidth={2} dot={{ r: 5, fill: '#EF4444' }} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Ramp deltas */}
          <div className="chart-card">
            <div className="chart-title">Ramp between snapshots</div>
            <div className="chart-sub">Change in GW from morning → evening</div>
            <div className="ramp-table">
              <table className="data-table">
                <thead>
                  <tr><th>Source</th><th>08→13</th><th>13→18</th><th>Net swing</th></tr>
                </thead>
                <tbody>
                  {[
                    { src: 'Solar',  a: morning?.cur_solar_mw,  b: noon?.cur_solar_mw,  c: evening?.cur_solar_mw  },
                    { src: 'Wind',   a: morning?.cur_wind_mw,   b: noon?.cur_wind_mw,   c: evening?.cur_wind_mw   },
                    { src: 'Demand', a: morning?.cur_demand_mw, b: noon?.cur_demand_mw, c: evening?.cur_demand_mw },
                  ].map(({ src, a, b, c }) => {
                    const d1 = a && b ? ((b-a)/1000).toFixed(1) : '—'
                    const d2 = b && c ? ((c-b)/1000).toFixed(1) : '—'
                    const net = a && c ? ((c-a)/1000).toFixed(1) : '—'
                    const fmt = v => v === '—' ? '—' : (+v > 0 ? `+${v}` : v) + ' GW'
                    const col = v => v === '—' ? '' : +v > 0 ? '#10B981' : '#EF4444'
                    return (
                      <tr key={src}>
                        <td style={{ color: '#CBD5E1', fontWeight: 500 }}>{src}</td>
                        <td style={{ color: col(d1), fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmt(d1)}</td>
                        <td style={{ color: col(d2), fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmt(d2)}</td>
                        <td style={{ color: col(net), fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{fmt(net)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Full comparison table */}
      <div className="chart-card wide">
        <div className="chart-title">Full snapshot comparison</div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th style={{ color: '#F97316' }}>🌅 08:00 IST</th>
                <th style={{ color: '#EAB308' }}>☀️ 13:00 IST</th>
                <th style={{ color: '#8B5CF6' }}>🌆 18:00 IST</th>
                <th>Day swing</th>
              </tr>
            </thead>
            <tbody>
              <StatRow label="Solar generation" morning={morning?.cur_solar_mw}  noon={noon?.cur_solar_mw}  evening={evening?.cur_solar_mw}  />
              <StatRow label="Wind generation"  morning={morning?.cur_wind_mw}   noon={noon?.cur_wind_mw}   evening={evening?.cur_wind_mw}   />
              <StatRow label="Thermal"          morning={morning?.cur_thermal_mw} noon={noon?.cur_thermal_mw} evening={evening?.cur_thermal_mw} />
              <StatRow label="Demand met"       morning={morning?.cur_demand_mw} noon={noon?.cur_demand_mw} evening={evening?.cur_demand_mw} />
              <StatRow label="RE share" morning={morning?.re_share_pct} noon={noon?.re_share_pct} evening={evening?.re_share_pct} unit="%" divisor={1} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
