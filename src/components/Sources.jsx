/**
 * Sources.jsx
 * 
 * Reference page showing all confirmed data sources,
 * their URLs, formats, update schedules, and what 
 * each feeds into the platform.
 */

const SOURCES = [
  {
    priority: 'P1',
    color: '#EF4444',
    category: 'Daily operational — primary',
    items: [
      {
        name: 'CEA OPM Daily Generation Report',
        url: 'https://cea.nic.in/opm_grid_operation/daily-generation-report/?lang=en',
        feeds: 'Hourly generation by source (solar/wind/thermal/hydro/nuclear/gas) + hourly demand met',
        format: 'CSV download (JS-rendered page)',
        lag: 'Same day, updated every few hours',
        auto: 'Puppeteer — 3× daily (08:00, 13:00, 18:00 IST)',
        columns: 'Source, Value (MW), Date & Time',
        tabs: 'Dashboard · Snapshots · Trends',
        verified: true,
      },
      {
        name: 'CEA RE Daily Generation Report (RPMD)',
        url: 'https://cea.nic.in/renewable-generation-report/?lang=en',
        feeds: 'State-wise wind, solar, others (biomass, small hydro, bagasse) in MU',
        format: 'PDF (bilingual — English + Hindi labels)',
        lag: 'Next morning ~10:00 IST',
        auto: 'Vercel cron 11:00 IST — PDF text scan for regional totals; Python pdfplumber for state-level',
        columns: 'State/Region, Wind MU, Solar MU, Others MU, Total MU (day + Mar cumulative)',
        tabs: 'Regional',
        verified: true,
      },
    ]
  },
  {
    priority: 'P2',
    color: '#F59E0B',
    category: 'Daily operational — NPP reports (confirmed public XLS)',
    items: [
      {
        name: 'NPP dgr2 — Station/Unit wise (MOST COMPREHENSIVE)',
        url: 'https://npp.gov.in/public-reports/cea/daily/dgr/DD-MM-YYYY/dgr2-YYYY-MM-DD.xls',
        feeds: 'Region → State → Sector → Fuel → Station → Unit level generation (382 KB)',
        format: 'XLS (confirmed live, ~382 KB)',
        lag: 'Next day ~17:00–18:00 IST',
        auto: 'Vercel cron 19:30 IST',
        columns: 'State, Sector, Type, Station, Unit, Installed MW, Programme MU, Actual MU',
        tabs: 'Regional · Status',
        verified: true,
      },
      {
        name: 'NPP dgr3 — All India Summary (SMALLEST / FASTEST)',
        url: 'https://npp.gov.in/public-reports/cea/daily/dgr/DD-MM-YYYY/dgr3-YYYY-MM-DD.xls',
        feeds: 'All India fuel-wise daily MU totals (9 KB)',
        format: 'XLS (confirmed live, ~9 KB)',
        lag: 'Next day ~17:00 IST',
        auto: 'Vercel cron 19:30 IST — primary fallback when CEA OPM fails',
        columns: 'Fuel type, Programme MU, Actual MU, % Achievement',
        tabs: 'Dashboard · Trends',
        verified: true,
      },
      {
        name: 'NPP dgr1 — Region Overview',
        url: 'https://npp.gov.in/public-reports/cea/daily/dgr/DD-MM-YYYY/dgr1-YYYY-MM-DD.xls',
        feeds: 'Region-wise programme vs actual, thermal/hydro/nuclear/RE breakdown',
        format: 'XLS (~16 KB)',
        lag: 'Next day ~17:00 IST',
        auto: 'Vercel cron 19:30 IST',
        tabs: 'Regional',
        verified: true,
      },
      {
        name: 'NPP dgr6 — Hydro Reservoir Levels',
        url: 'https://npp.gov.in/public-reports/cea/daily/dgr/DD-MM-YYYY/dgr6-YYYY-MM-DD.xls',
        feeds: '24 major reservoirs — level (M), live storage (BCM), energy content (BU)',
        format: 'XLS (~20 KB)',
        lag: 'Next day',
        auto: 'Vercel cron 19:30 IST',
        tabs: 'Intelligence (hydro outlook)',
        verified: true,
      },
      {
        name: 'NPP dgr10 — Daily Outage Report',
        url: 'https://npp.gov.in/public-reports/cea/daily/dgr/DD-MM-YYYY/dgr10-YYYY-MM-DD.xls',
        feeds: 'Coal, lignite, nuclear units under outage — reason, capacity, expected return',
        format: 'XLS (~36 KB)',
        lag: 'Next day',
        auto: 'Vercel cron 19:30 IST',
        tabs: 'Status',
        verified: true,
      },
      {
        name: 'NPP dgr11 — 500 MW+ Unit Outages',
        url: 'https://npp.gov.in/public-reports/cea/daily/dgr/DD-MM-YYYY/dgr11-YYYY-MM-DD.xls',
        feeds: 'Only large unit (≥500 MW) outages — high-impact grid events',
        format: 'XLS (~15 KB)',
        lag: 'Next day',
        auto: 'Vercel cron 19:30 IST',
        tabs: 'Status',
        verified: true,
      },
    ]
  },
  {
    priority: 'P3',
    color: '#8B5CF6',
    category: 'Monthly strategic — CEA archive',
    items: [
      {
        name: 'CEA Monthly Reports Archive',
        url: 'https://cea.nic.in/monthly-reports-archive/?lang=en',
        feeds: 'Executive Summary, Installed Capacity, OPM Generation, RESD RE data, Power Supply, Market Monitoring, Hydrology — back to 2006',
        format: 'PDF / XLS (per report type)',
        lag: '~15th of following month',
        auto: 'Vercel cron 1st of month 11:30 IST',
        tabs: 'Intelligence · Trends',
        verified: true,
      },
      {
        name: 'CEA Installed Capacity Report',
        url: 'https://cea.nic.in/installed-capacity-report/?lang=en',
        feeds: 'Monthly installed capacity by state, sector, fuel type in GW',
        format: 'PDF / XLS',
        lag: '~15th of following month',
        auto: 'Monthly cron',
        tabs: 'Intelligence (PLF trends)',
        verified: true,
      },
    ]
  },
  {
    priority: 'P4',
    color: '#10B981',
    category: 'Annual strategic — ICED NITI Aayog',
    items: [
      {
        name: 'ICED — India Climate & Energy Dashboard',
        url: 'https://iced.niti.gov.in',
        feeds: 'Duck curve, RPO/RCO targets, PLF trends, CO₂ intensity, AT&C losses, tariff trends, DISCOM health, storage capacity tracking',
        format: 'JS dashboard + XLS downloads per chart',
        lag: 'Monthly / Annual',
        auto: 'Manual — ICED data pre-loaded in Supabase; refresh quarterly',
        tabs: 'Intelligence',
        verified: true,
      },
    ]
  },
]

export default function Sources() {
  const pColors = { P1: '#EF4444', P2: '#F59E0B', P3: '#8B5CF6', P4: '#10B981' }

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h2 className="page-title">Data sources</h2>
          <p className="page-sub">All confirmed sources — URLs, formats, update schedules, what each feeds</p>
        </div>
      </div>

      {/* Cron schedule summary */}
      <div className="chart-card wide">
        <div className="chart-title">Automated fetch schedule</div>
        <div className="chart-sub">All jobs run on Vercel servers — no local machine required</div>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="data-table">
            <thead>
              <tr><th>Time (IST)</th><th>UTC</th><th>API Route</th><th>Source</th><th>What it fetches</th></tr>
            </thead>
            <tbody>
              {[
                ['08:00','02:30','/api/fetch-snapshot','CEA OPM','Hourly generation + demand since midnight'],
                ['11:00','05:30','/api/fetch-cea-re','CEA RPMD','State-wise RE PDF (wind/solar/others MU)'],
                ['13:00','07:30','/api/fetch-snapshot','CEA OPM','Hourly generation + demand — solar peak capture'],
                ['18:00','12:30','/api/fetch-snapshot','CEA OPM','Hourly generation + demand — evening peak capture'],
                ['19:30','14:00','/api/fetch-npp','NPP (npp.gov.in)','dgr1,2,3,6,10,11 — daily XLS reports'],
                ['1st of month 11:30','06:00','/api/fetch-cea-monthly','CEA Archive','Monthly reports — capacity, generation, RE, supply'],
              ].map(([ist,utc,route,src,what]) => (
                <tr key={route+ist}>
                  <td style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'#F59E0B', fontWeight:600 }}>{ist}</td>
                  <td style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-dim)' }}>{utc}</td>
                  <td style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'#818CF8' }}>{route}</td>
                  <td style={{ fontSize:12, color:'var(--text-sec)' }}>{src}</td>
                  <td style={{ fontSize:12, color:'var(--text-dim)' }}>{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sources by priority */}
      {SOURCES.map(group => (
        <div key={group.priority}>
          <div style={{ display:'flex', alignItems:'center', gap:10, margin:'8px 0 10px' }}>
            <span style={{
              fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20,
              background:`${group.color}18`, color:group.color,
              letterSpacing:'0.05em', fontFamily:'var(--font-mono)'
            }}>{group.priority}</span>
            <span style={{ fontSize:13, fontWeight:500, color:'var(--text-pri)' }}>{group.category}</span>
          </div>

          {group.items.map(src => (
            <div key={src.name} className="chart-card wide" style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <div className="chart-title">{src.name}</div>
                    {src.verified && (
                      <span style={{ fontSize:10, padding:'1px 7px', borderRadius:10,
                        background:'rgba(16,185,129,0.12)', color:'#10B981', fontWeight:600 }}>
                        ✓ Verified live
                      </span>
                    )}
                  </div>
                  <a href={src.url.includes('DD-MM') ? '#' : src.url}
                    target="_blank" rel="noreferrer"
                    style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'#818CF8',
                      wordBreak:'break-all', display:'block', marginBottom:10 }}>
                    {src.url}
                  </a>
                  <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:'6px 16px', fontSize:12 }}>
                    {[
                      ['Feeds into', src.feeds],
                      ['Format', src.format],
                      ['Update lag', src.lag],
                      ['Auto-fetch', src.auto],
                      src.columns ? ['Columns', src.columns] : null,
                      ['Platform tabs', src.tabs],
                    ].filter(Boolean).map(([label, val]) => (
                      <>
                        <span style={{ color:'var(--text-dim)', fontWeight:500 }}>{label}</span>
                        <span style={{ color:'var(--text-sec)', lineHeight:1.5 }}>{val}</span>
                      </>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Manual upload note */}
      <div className="chart-card wide" style={{ background:'rgba(99,102,241,0.06)', borderColor:'rgba(99,102,241,0.2)' }}>
        <div className="chart-title" style={{ color:'#818CF8' }}>Manual upload — when auto-fetch isn't enough</div>
        <div style={{ fontSize:12, color:'var(--text-sec)', lineHeight:1.8, marginTop:8 }}>
          The Upload tab accepts the raw CSVs from CEA OPM exactly as downloaded —
          <span style={{ fontFamily:'var(--font-mono)', color:'var(--text-pri)' }}> All_India_Generation_YYYY-MM-DD.csv</span> and
          <span style={{ fontFamily:'var(--font-mono)', color:'var(--text-pri)'}}> Demand_Met_Data_YYYY-MM-DD.csv</span>.<br/><br/>
          For CEA RE PDF state-level granularity (individual states, not just regions),
          run the Python uploader: <span style={{ fontFamily:'var(--font-mono)', color:'#F59E0B' }}>python upload_to_supabase.py --re path/to/re_report.pdf --date YYYY-MM-DD</span><br/><br/>
          For NPP dgr2 (station/unit level), the XLS requires Python openpyxl for proper parsing.
          The Python uploader handles both automatically.
        </div>
      </div>
    </div>
  )
}
