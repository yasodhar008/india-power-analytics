import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, parseISO, formatDistanceToNow } from 'date-fns'

const STATUS_COLOR = {
  ok:      { bg: 'rgba(16,185,129,0.12)', color: '#10B981', label: 'OK' },
  partial: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', label: 'PARTIAL' },
  failed:  { bg: 'rgba(239,68,68,0.12)',  color: '#EF4444', label: 'FAILED' },
}

const SNAP_COLOR = { '08:00': '#F97316', '13:00': '#EAB308', '18:00': '#8B5CF6' }

function StatusPill({ status }) {
  const s = STATUS_COLOR[status] || STATUS_COLOR.ok
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 10, fontWeight: 700, padding: '2px 8px',
      borderRadius: 20, letterSpacing: '0.05em', fontFamily: 'var(--font-mono)'
    }}>{s.label}</span>
  )
}

function UpTimeBar({ logs }) {
  // Last 21 runs (7 days × 3 snapshots) shown as squares
  const last21 = [...logs].slice(0, 21).reverse()
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', margin: '12px 0' }}>
      {last21.map((l, i) => (
        <div
          key={i}
          title={`${l.ran_at?.split('T')[0]} ${l.snapshot} — ${l.status}`}
          style={{
            width: 18, height: 18, borderRadius: 3,
            background: STATUS_COLOR[l.status]?.color || '#10B981',
            opacity: 0.85, cursor: 'default',
          }}
        />
      ))}
      {Array.from({ length: Math.max(0, 21 - last21.length) }).map((_, i) => (
        <div key={`e${i}`} style={{ width: 18, height: 18, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }} />
      ))}
    </div>
  )
}

export default function Status() {
  const [logs, setLogs]       = useState([])
  const [summary, setSummary] = useState(null)
  const [dbStats, setDbStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('fetch_log').select('*').order('ran_at', { ascending: false }).limit(63),
      supabase.from('power_daily_summary').select('data_date').order('data_date', { ascending: false }).limit(1),
      supabase.from('power_generation').select('id', { count: 'exact', head: true }),
      supabase.from('power_snapshot_summary').select('*').order('data_date', { ascending: false }).limit(1),
    ]).then(([logsR, summR, genR, snapR]) => {
      const logData = logsR.data || []
      setLogs(logData)

      const ok      = logData.filter(l => l.status === 'ok').length
      const partial = logData.filter(l => l.status === 'partial').length
      const failed  = logData.filter(l => l.status === 'failed').length
      const avgMs   = logData.length ? Math.round(logData.reduce((a, b) => a + (b.duration_ms || 0), 0) / logData.length) : 0

      setSummary({ ok, partial, failed, total: logData.length, avgMs, uptime: logData.length ? Math.round(ok / logData.length * 100) : 0 })
      setDbStats({
        latestDate: summR.data?.[0]?.data_date,
        genRows: genR.count || 0,
        lastSnap: snapR.data?.[0],
      })
      setLoading(false)
    })
  }, [])

  const nextRuns = () => {
    const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000) // IST
    const h = now.getUTCHours()
    const slots = [{ h: 8, label: '08:00' }, { h: 13, label: '13:00' }, { h: 18, label: '18:00' }]
    return slots.map(s => {
      const diff = ((s.h - h) * 60 + (15)) % (24 * 60)
      return { ...s, minsAway: diff < 0 ? diff + 1440 : diff }
    }).sort((a, b) => a.minsAway - b.minsAway)
  }

  if (loading) return <div className="loading-state"><div className="spinner" /><span>Loading status...</span></div>

  const runs = nextRuns()

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h2 className="page-title">System status</h2>
          <p className="page-sub">Fetch health · DB stats · Next scheduled runs</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="status-pill ok" style={{ fontSize: 12, padding: '4px 12px' }}>
            {summary?.uptime}% uptime
          </span>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Successful runs</div>
          <div className="kpi-value" style={{ color: '#10B981' }}>{summary?.ok}<span className="kpi-unit"> / {summary?.total}</span></div>
          <div className="kpi-sub">Last 3 weeks</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Partial / failed</div>
          <div className="kpi-value" style={{ color: summary?.failed > 0 ? '#EF4444' : '#F59E0B' }}>
            {summary?.partial}<span className="kpi-unit"> partial</span>
          </div>
          <div className="kpi-sub">{summary?.failed} failed</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg fetch time</div>
          <div className="kpi-value">{(summary?.avgMs / 1000).toFixed(1)}<span className="kpi-unit"> s</span></div>
          <div className="kpi-sub">Per snapshot run</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Latest data date</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>{dbStats?.latestDate || '—'}</div>
          <div className="kpi-sub">{dbStats?.genRows?.toLocaleString()} generation rows in DB</div>
        </div>
      </div>

      {/* Uptime heatmap */}
      <div className="chart-card wide">
        <div className="chart-title">Run history — last 21 snapshots</div>
        <div className="chart-sub">Each square = one scheduled run (green = ok, amber = partial, red = failed)</div>
        <UpTimeBar logs={logs} />
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-dim)' }}>
          <span><span style={{ color: '#10B981' }}>■</span> OK</span>
          <span><span style={{ color: '#F59E0B' }}>■</span> Partial</span>
          <span><span style={{ color: '#EF4444' }}>■</span> Failed</span>
          <span style={{ marginLeft: 'auto' }}>Oldest → Newest</span>
        </div>
      </div>

      {/* Next scheduled runs + DB health */}
      <div className="chart-row">
        <div className="chart-card">
          <div className="chart-title">Next scheduled runs (IST)</div>
          <div className="chart-sub">Vercel cron + Selenium downloader</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {runs.map(r => (
              <div key={r.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: 'var(--bg-elevated)',
                borderRadius: 8, border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: SNAP_COLOR[r.label] }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-pri)' }}>{r.label} IST</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {r.minsAway < 60
                        ? `in ${r.minsAway} min`
                        : `in ${Math.floor(r.minsAway / 60)}h ${r.minsAway % 60}m`}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  {r.label === '08:00' ? '02:30 UTC' : r.label === '13:00' ? '07:30 UTC' : '12:30 UTC'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title">Database health</div>
          <div className="chart-sub">Supabase — Mumbai region (ap-south-1)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {[
              { table: 'power_generation',     rows: dbStats?.genRows, note: 'Hourly source data' },
              { table: 'power_demand',          rows: 24,               note: 'Hourly demand met' },
              { table: 'power_snapshot_summary',rows: logs.length,      note: '3× daily snapshots' },
              { table: 'power_re_state',        rows: 23,               note: 'State RE breakdown' },
              { table: 'power_daily_summary',   rows: 16,               note: 'Daily KPI rollup' },
              { table: 'fetch_log',             rows: logs.length,      note: 'Cron run history' },
            ].map(r => (
              <div key={r.table} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 0', borderBottom: '1px solid var(--border-soft)'
              }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-pri)', fontFamily: 'var(--font-mono)' }}>{r.table}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{r.note}</div>
                </div>
                <span style={{ fontSize: 12, color: '#10B981', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                  {r.rows?.toLocaleString() || '—'} rows
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent fetch log */}
      <div className="chart-card wide">
        <div className="chart-title">Recent fetch log</div>
        <div className="chart-sub">Last 20 cron runs — all three daily snapshot slots</div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp (IST)</th>
                <th>Snapshot</th>
                <th>Status</th>
                <th>Rows written</th>
                <th>Sources</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 20).map((l, i) => {
                const istTime = l.ran_at
                  ? new Date(new Date(l.ran_at).getTime() + 5.5 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)
                  : '—'
                return (
                  <tr key={i}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{istTime}</td>
                    <td>
                      <span style={{
                        color: SNAP_COLOR[l.snapshot] || 'var(--text-sec)',
                        fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600
                      }}>{l.snapshot}</span>
                    </td>
                    <td><StatusPill status={l.status} /></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-sec)' }}>
                      {l.rows_written || 0}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {(l.sources || []).join(', ')}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>
                      {l.duration_ms ? `${(l.duration_ms / 1000).toFixed(1)}s` : '—'}
                    </td>
                  </tr>
                )
              })}
              {!logs.length && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 24 }}>
                  No fetch logs yet — logs appear after first cron run
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
