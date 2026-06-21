import { useState, useEffect } from 'react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import { supabase } from '../lib/supabase'

// ── colour palette ────────────────────────────────────────────────────────
const YR_COLORS = {
  FY22: '#64748B', FY23: '#6366F1', FY24: '#F59E0B',
  FY25: '#10B981', FY26: '#EF4444'
}
const FUEL_COLORS = {
  Coal: '#78350F', Gas: '#6B7280', Nuclear: '#7C3AED',
  Hydro: '#3B82F6', Solar: '#F59E0B', Wind: '#10B981'
}
const GRID = 'rgba(255,255,255,0.06)'
const TICK = '#94A3B8'

const fmtGW  = v => v ? `${(v / 1000).toFixed(0)}k` : 0
const fmtPct = v => `${v}%`

// ── shared tooltip ────────────────────────────────────────────────────────
const Tip = ({ active, payload, label, unit = 'MW' }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="tt-label">{String(label).padStart(2,'0')}:00</div>
      {payload.map(p => (
        <div key={p.dataKey} className="tt-row">
          <span className="tt-dot" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="tt-val">
            {unit === 'GW' ? `${(p.value / 1000).toFixed(1)} GW` : `${Math.round(p.value).toLocaleString()} MW`}
          </span>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — Duck curve evolution
// ═══════════════════════════════════════════════════════════════════════════
function DuckCurve({ data }) {
  const [mode, setMode] = useState('net')    // 'net' | 'solar' | 'gross'
  const years = ['FY22', 'FY24', 'FY26']

  const pivoted = Array.from({ length: 24 }, (_, h) => {
    const row = { hour: h }
    years.forEach(y => {
      const d = data.find(r => r.fy_year === y && r.hour === h)
      if (d) {
        row[`${y}_net`]   = d.net_load_mw
        row[`${y}_solar`] = d.solar_mw
        row[`${y}_gross`] = d.gross_demand_mw
      }
    })
    return row
  })

  const field = mode === 'net' ? 'net' : mode === 'solar' ? 'solar' : 'gross'

  // BESS ramp annotation: biggest delta between hour 16→19 in FY26
  const fy26_16 = data.find(r => r.fy_year === 'FY26' && r.hour === 16)?.net_load_mw || 0
  const fy26_19 = data.find(r => r.fy_year === 'FY26' && r.hour === 19)?.net_load_mw || 0
  const rampGW  = ((fy26_19 - fy26_16) / 1000).toFixed(1)

  return (
    <div className="chart-card wide">
      <div className="chart-head">
        <div>
          <div className="chart-title">Duck curve evolution — India grid (FY22 → FY26)</div>
          <div className="chart-sub">
            Evening ramp steepens every year as solar grows — the core BESS opportunity
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['net','Net load'],['solar','Solar only'],['gross','Gross demand']].map(([v, l]) => (
            <button key={v} onClick={() => setMode(v)}
              style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                border: '1px solid var(--border)',
                background: mode === v ? 'var(--text-pri)' : 'transparent',
                color: mode === v ? 'var(--bg-base)' : 'var(--text-sec)',
              }}>{l}</button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={pivoted} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="hour" tickFormatter={h => `${String(h).padStart(2,'0')}h`}
            tick={{ fontSize: 11, fill: TICK }} />
          <YAxis tickFormatter={fmtGW} tick={{ fontSize: 11, fill: TICK }} />
          <Tooltip content={<Tip unit="GW" />} />
          {years.map(y => (
            <Line key={y} type="monotone" dataKey={`${y}_${field}`} name={y}
              stroke={YR_COLORS[y]} strokeWidth={y === 'FY26' ? 2.5 : 1.5}
              dot={false}
              strokeDasharray={y === 'FY22' ? '6 3' : y === 'FY24' ? '3 2' : undefined}
            />
          ))}
          {/* Evening ramp zone */}
          <ReferenceLine x={16} stroke="rgba(239,68,68,0.4)" strokeDasharray="4 2"
            label={{ value: 'Solar ends', fill: '#EF4444', fontSize: 10, position: 'top' }} />
          <ReferenceLine x={19} stroke="rgba(239,68,68,0.4)" strokeDasharray="4 2"
            label={{ value: 'Peak demand', fill: '#EF4444', fontSize: 10, position: 'top' }} />
        </LineChart>
      </ResponsiveContainer>

      {/* BESS signal callouts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 14 }}>
        {[
          { label: 'Evening ramp (FY26)', value: `+${rampGW} GW`, sub: '16:00 → 19:00 IST', color: '#EF4444' },
          { label: 'Midday trough depth', value: `${((fy26_16 - (data.find(r=>r.fy_year==='FY26'&&r.hour===12)?.net_load_mw||0))/1000).toFixed(1)} GW`, sub: 'Below morning peak', color: '#F59E0B' },
          { label: 'Solar displacement', value: `${((data.find(r=>r.fy_year==='FY26'&&r.hour===11)?.solar_mw||0)/1000).toFixed(0)} GW`, sub: 'Peak solar hour (11:00)', color: '#10B981' },
        ].map(c => (
          <div key={c.label} style={{
            background: 'var(--bg-elevated)', borderRadius: 8,
            padding: '10px 14px', border: '1px solid var(--border)'
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 300, color: c.color, letterSpacing: '-0.5px' }}>{c.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — RCO trajectory
// ═══════════════════════════════════════════════════════════════════════════
function RCOTrajectory({ data }) {
  return (
    <div className="chart-card">
      <div className="chart-title">RCO trajectory — national targets (MoP 2023)</div>
      <div className="chart-sub">Renewable Consumption Obligation % — storage recognized from FY25</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barSize={22}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="fy_year" tick={{ fontSize: 11, fill: TICK }} />
          <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: TICK }} domain={[0, 50]} />
          <Tooltip
            contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: TICK }} itemStyle={{ color: '#E2E8F0' }}
            formatter={v => [`${v}%`]}
          />
          <Bar dataKey="solar_pct"  name="Solar"  fill="#F59E0B" stackId="a" />
          <Bar dataKey="wind_pct"   name="Wind"   fill="#10B981" stackId="a" />
          <Bar dataKey="hydro_pct"  name="Hydro"  fill="#3B82F6" stackId="a" />
          <Bar dataKey="other_pct"  name="Other RE" fill="#8B5CF6" stackId="a" radius={[3,3,0,0]} />
          <ReferenceLine y={33.01} stroke="#EF4444" strokeDasharray="4 2"
            label={{ value: 'FY26 target 33%', fill: '#EF4444', fontSize: 10, position: 'right' }} />
          <Legend wrapperStyle={{ fontSize: 11, color: TICK }} />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(16,185,129,0.08)',
        border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: 12, color: '#10B981', lineHeight: 1.6 }}>
        <strong>BESS signal:</strong> Storage-backed RE explicitly recognized for RCO compliance from FY25.
        States with RPO/RCO deficit are the primary BESS markets.
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — PLF trends
// ═══════════════════════════════════════════════════════════════════════════
function PLFTrends({ data }) {
  const years = ['FY22','FY23','FY24','FY25','FY26']
  const fuels = ['Coal','Solar','Wind','Hydro']

  const pivoted = years.map(y => {
    const row = { year: y }
    fuels.forEach(f => {
      const d = data.find(r => r.fy_year === y && r.fuel_type === f)
      if (d) row[f] = d.plf_pct
    })
    return row
  })

  return (
    <div className="chart-card">
      <div className="chart-title">PLF / CUF trends — key fuel types</div>
      <div className="chart-sub">Coal PLF declining as RE displaces thermal midday generation</div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={pivoted} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="year" tick={{ fontSize: 11, fill: TICK }} />
          <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: TICK }} />
          <Tooltip
            contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: TICK }} itemStyle={{ color: '#E2E8F0' }}
            formatter={v => [`${v}%`]}
          />
          {fuels.map(f => (
            <Line key={f} type="monotone" dataKey={f} name={f}
              stroke={FUEL_COLORS[f]} strokeWidth={f === 'Coal' ? 2 : 1.5}
              dot={{ r: 3, fill: FUEL_COLORS[f] }}
              strokeDasharray={f === 'Coal' ? undefined : '3 2'}
            />
          ))}
          <Legend wrapperStyle={{ fontSize: 11, color: TICK }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — CO2 intensity
// ═══════════════════════════════════════════════════════════════════════════
function CO2Intensity({ data }) {
  return (
    <div className="chart-card">
      <div className="chart-title">Grid CO₂ emission intensity</div>
      <div className="chart-sub">gCO₂/kWh — declining as RE share grows (source: CEA)</div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="co2grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="fy_year" tick={{ fontSize: 11, fill: TICK }} />
          <YAxis tick={{ fontSize: 11, fill: TICK }} domain={[580, 730]}
            tickFormatter={v => `${v}`} />
          <Tooltip
            contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: TICK }}
            formatter={v => [`${v} gCO₂/kWh`]}
          />
          <Area type="monotone" dataKey="grid_ef_gco2_kwh" name="Grid EF"
            stroke="#10B981" fill="url(#co2grad)" strokeWidth={2} dot={{ r: 3, fill: '#10B981' }} />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12 }}>
        <div style={{ color: 'var(--text-dim)' }}>FY20 baseline: <span style={{ color: '#EF4444', fontWeight: 500 }}>708</span></div>
        <div style={{ color: 'var(--text-dim)' }}>FY26 actual: <span style={{ color: '#10B981', fontWeight: 500 }}>624</span></div>
        <div style={{ color: 'var(--text-dim)' }}>Reduction: <span style={{ color: '#10B981', fontWeight: 500 }}>−84 gCO₂/kWh (−11.9%)</span></div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — State BESS opportunity
// ═══════════════════════════════════════════════════════════════════════════
function BESSOpportunity({ data }) {
  const [sortBy, setSortBy] = useState('bess_score')
  const sorted = [...data].sort((a, b) => b[sortBy] - a[sortBy]).slice(0, 12)

  const oppColor = { High: '#EF4444', Medium: '#F59E0B', Low: '#10B981' }
  const healthColor = { Good: '#10B981', Moderate: '#F59E0B', Stressed: '#EF4444' }

  return (
    <div className="chart-card wide">
      <div className="chart-head">
        <div>
          <div className="chart-title">State BESS opportunity index</div>
          <div className="chart-sub">
            Composite score based on RCO deficit, evening ramp, RE pipeline, DISCOM health
          </div>
        </div>
        <select className="date-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="bess_score">BESS score</option>
          <option value="rco_gap_pct">RCO deficit</option>
          <option value="evening_ramp_gw">Evening ramp</option>
          <option value="re_pipeline_gw">RE pipeline</option>
        </select>
      </div>

      {/* Bar chart — BESS scores */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={sorted} layout="vertical"
          margin={{ top: 4, right: 60, left: 110, bottom: 0 }} barSize={14}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis type="number" tick={{ fontSize: 10, fill: TICK }} domain={[0, 100]} />
          <YAxis type="category" dataKey="state" tick={{ fontSize: 11, fill: '#CBD5E1' }} width={105} />
          <Tooltip
            contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: TICK }}
            formatter={(v, n, p) => [
              `Score: ${v}/100 | RCO gap: ${p.payload.rco_gap_pct}% | Ramp: ${p.payload.evening_ramp_gw} GW`,
            ]}
          />
          <Bar dataKey="bess_score" name="BESS score"
            fill="#6366F1" radius={[0,4,4,0]}
            label={{ position: 'right', fontSize: 11, fill: '#94A3B8', formatter: v => `${v}` }}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* State table */}
      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>State</th><th>RE installed</th><th>Pipeline</th>
              <th>RCO target</th><th>Achievement</th><th>Gap</th>
              <th>Eve. ramp</th><th>DISCOM</th><th>Opportunity</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => (
              <tr key={r.state}>
                <td style={{ color: '#CBD5E1', fontWeight: 500 }}>{r.state}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.re_installed_gw} GW</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#818CF8' }}>+{r.re_pipeline_gw} GW</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.rco_target_pct}%</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: r.rco_achievement_pct >= r.rco_target_pct ? '#10B981' : '#F59E0B' }}>
                  {r.rco_achievement_pct}%
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
                  color: r.rco_gap_pct < 0 ? '#EF4444' : '#10B981' }}>
                  {r.rco_gap_pct > 0 ? `+${r.rco_gap_pct}` : r.rco_gap_pct}%
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#F59E0B' }}>
                  {r.evening_ramp_gw} GW
                </td>
                <td>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                    background: `${healthColor[r.discom_health]}22`,
                    color: healthColor[r.discom_health] }}>
                    {r.discom_health}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                    background: `${oppColor[r.bess_opportunity]}18`,
                    color: oppColor[r.bess_opportunity] }}>
                    {r.bess_opportunity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN INTELLIGENCE PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function Intelligence() {
  const [duck,  setDuck]  = useState([])
  const [rco,   setRco]   = useState([])
  const [plf,   setPlf]   = useState([])
  const [co2,   setCo2]   = useState([])
  const [bess,  setBess]  = useState([])
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState('duck')

  useEffect(() => {
    Promise.all([
      supabase.from('iced_duck_curve').select('*').order('hour'),
      supabase.from('iced_rco_targets').select('*').order('fy_year'),
      supabase.from('iced_plf_trends').select('*').order('fy_year'),
      supabase.from('iced_co2_intensity').select('*').order('fy_year'),
      supabase.from('iced_state_bess_opportunity').select('*').order('bess_score', { ascending: false }),
    ]).then(([d, r, p, c, b]) => {
      setDuck(d.data || [])
      setRco(r.data  || [])
      setPlf(p.data  || [])
      setCo2(c.data  || [])
      setBess(b.data || [])
      setLoading(false)
    })
  }, [])

  const SECTIONS = [
    { id: 'duck',  label: '🦆 Duck curve' },
    { id: 'rco',   label: '📋 RCO targets' },
    { id: 'plf',   label: '⚡ PLF trends' },
    { id: 'co2',   label: '🌿 CO₂ intensity' },
    { id: 'bess',  label: '🔋 BESS opportunity' },
  ]

  if (loading) return <div className="loading-state"><div className="spinner" /><span>Loading intelligence data...</span></div>

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h2 className="page-title">Strategic intelligence</h2>
          <p className="page-sub">ICED · CEA · MoP · MNRE — sector trends and BESS opportunity mapping</p>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'right', lineHeight: 1.6 }}>
          Sources: iced.niti.gov.in · cea.nic.in<br />
          Updated: monthly / annual
        </div>
      </div>

      {/* National headline KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total installed capacity</div>
          <div className="kpi-value">533<span className="kpi-unit"> GW</span></div>
          <div className="kpi-sub">As of Mar 2026</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Non-fossil capacity</div>
          <div className="kpi-value" style={{ color: '#10B981' }}>283<span className="kpi-unit"> GW</span></div>
          <div className="kpi-sub">53% of total — 5 yrs ahead of target</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">RE share FY26</div>
          <div className="kpi-value" style={{ color: '#F59E0B' }}>29.2<span className="kpi-unit"> %</span></div>
          <div className="kpi-sub">538.97 BU from non-fossil</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Grid CO₂ intensity</div>
          <div className="kpi-value" style={{ color: '#10B981' }}>624<span className="kpi-unit"> g/kWh</span></div>
          <div className="kpi-sub">Down from 708 in FY20 (−11.9%)</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">RCO target FY26</div>
          <div className="kpi-value">33<span className="kpi-unit"> %</span></div>
          <div className="kpi-sub">Up from 29.9% in FY25</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Peak RE share (Jul'25)</div>
          <div className="kpi-value" style={{ color: '#10B981' }}>51.5<span className="kpi-unit"> %</span></div>
          <div className="kpi-sub">203 GW demand moment</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">FY26 solar CUF</div>
          <div className="kpi-value">23.1<span className="kpi-unit"> %</span></div>
          <div className="kpi-sub">Up from 21.5% in FY22</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Coal PLF FY26</div>
          <div className="kpi-value" style={{ color: '#EF4444' }}>52.1<span className="kpi-unit"> %</span></div>
          <div className="kpi-sub">Down from 58.5% in FY22</div>
        </div>
      </div>

      {/* Section nav */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            style={{
              padding: '6px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
              border: '1px solid var(--border)',
              background: section === s.id ? 'var(--text-pri)' : 'var(--bg-elevated)',
              color: section === s.id ? 'var(--bg-base)' : 'var(--text-sec)',
              fontFamily: 'var(--font-sans)',
            }}>{s.label}</button>
        ))}
      </div>

      {section === 'duck' && <DuckCurve data={duck} />}

      {section === 'rco' && (
        <div className="chart-row">
          <RCOTrajectory data={rco} />
          <div className="chart-card">
            <div className="chart-title">RCO target escalation</div>
            <div className="chart-sub">Year-on-year obligation increase</div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Year</th><th>Solar</th><th>Wind</th><th>Hydro</th><th>Other</th><th>Total</th><th>Storage</th></tr>
                </thead>
                <tbody>
                  {rco.map(r => (
                    <tr key={r.fy_year}>
                      <td style={{ fontWeight: 600, color: '#CBD5E1' }}>{r.fy_year}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#F59E0B' }}>{r.solar_pct}%</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#10B981' }}>{r.wind_pct}%</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#3B82F6' }}>{r.hydro_pct}%</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#8B5CF6' }}>{r.other_pct}%</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#E2E8F0' }}>{r.total_pct}%</td>
                      <td style={{ fontSize: 11 }}>{r.storage_recognized ? <span style={{ color: '#10B981' }}>✓ Yes</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {section === 'plf' && (
        <div className="chart-row">
          <PLFTrends data={plf} />
          <div className="chart-card">
            <div className="chart-title">Installed capacity growth (GW)</div>
            <div className="chart-sub">Solar + Wind vs Coal</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={['FY22','FY23','FY24','FY25','FY26'].map(y => ({
                  year: y,
                  Solar: plf.find(r => r.fy_year === y && r.fuel_type === 'Solar')?.installed_gw,
                  Wind:  plf.find(r => r.fy_year === y && r.fuel_type === 'Wind')?.installed_gw,
                  Coal:  plf.find(r => r.fy_year === y && r.fuel_type === 'Coal')?.installed_gw,
                }))}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: TICK }} />
                <YAxis tick={{ fontSize: 11, fill: TICK }} unit=" GW" />
                <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: TICK }} itemStyle={{ color: '#E2E8F0' }} formatter={v => [`${v} GW`]} />
                <Line type="monotone" dataKey="Coal"  stroke={FUEL_COLORS.Coal}  strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Solar" stroke={FUEL_COLORS.Solar} strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Wind"  stroke={FUEL_COLORS.Wind}  strokeWidth={2} dot={{ r: 4 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: TICK }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {section === 'co2' && (
        <div className="chart-row">
          <CO2Intensity data={co2} />
          <div className="chart-card">
            <div className="chart-title">Non-fossil generation share</div>
            <div className="chart-sub">% of total electricity generation</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={co2} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="nfgrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="fy_year" tick={{ fontSize: 11, fill: TICK }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: TICK }} />
                <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: TICK }} formatter={v => [`${v}%`]} />
                <Area type="monotone" dataKey="nonfossil_pct" name="Non-fossil %"
                  stroke="#F59E0B" fill="url(#nfgrad)" strokeWidth={2} dot={{ r: 3, fill: '#F59E0B' }} />
                <ReferenceLine y={30} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 2"
                  label={{ value: '30%', fill: TICK, fontSize: 10 }} />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              India achieved <span style={{ color: '#10B981', fontWeight: 600 }}>50% non-fossil installed capacity</span> milestone
              in June 2025 — 5 years ahead of the 2030 NDC target.
            </div>
          </div>
        </div>
      )}

      {section === 'bess' && <BESSOpportunity data={bess} />}
    </div>
  )
}
