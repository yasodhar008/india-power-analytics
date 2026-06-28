import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import IndiaMap from './IndiaMap';

// ─── LIVE STRIP COMPONENT ──────────────────────────────────────────────
function LiveStrip() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchLive() {
      try {
        const res = await fetch('/api/npp-live');
        const json = await res.json();
        if (json.error) throw new Error("Fallback");
        setData(json);
        setError(false);
      } catch (err) {
        console.error("Live strip error:", err);
        setError(true);
      }
      setLoading(false);
    }
    fetchLive();
    const interval = setInterval(fetchLive, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="h-12 bg-white flex items-center px-4 border-b text-sm text-gray-500">Loading LIVE data...</div>;

  const demandGW = data && data.demandMW ? (data.demandMW / 1000).toFixed(1) : "---";
  const statusColor = error ? "bg-amber-500" : "bg-green-500";
  const statusText = error ? "LAST KNOWN" : "LIVE";

  const colors = { Coal:"#111827", Gas:"#6b7280", Hydro:"#3b82f6", Nuclear:"#f59e0b", Solar:"#eab308", Wind:"#10b981", Other:"#94a3b8" };
  const totalGen = data?.generation?.reduce((acc, g) => acc + g.mw, 0) || 1;

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <div className={`px-2 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1.5 ${statusColor}`}>
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
          {statusText}
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Demand Met</div>
          <div className="text-xl font-bold text-gray-900">{demandGW} GW</div>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-8 hidden md:block">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1 flex justify-between">
          <span>Generation Mix</span>
          <span>{data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('en-IN') : ''}</span>
        </div>
        <div className="h-3 w-full rounded-full flex overflow-hidden">
          {data?.generation?.map(g => (
            <div
              key={g.source}
              style={{ width: `${Math.max((g.mw / totalGen) * 100, 0)}%`, backgroundColor: colors[g.source] }}
              title={`${g.source}: ${g.mw} MW`}
            />
          ))}
        </div>
        <div className="flex gap-3 mt-1 justify-between text-[9px] font-medium text-gray-500">
          {data?.generation?.map(g => (
            <span key={g.source} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{backgroundColor: colors[g.source]}}></span>
              {g.source} {Math.round((g.mw / totalGen) * 100)}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD COMPONENT ───────────────────────────────────────────────
export default function Dashboard({ selectedDate, onDateChange, setTab }) {

  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDates() {
      const { data } = await supabase.from('power_generation').select('date');
      if (data) {
        const unique = [...new Set(data.map(d => d.date))].sort().reverse();
        setAvailableDates(unique);
        if (!selectedDate && unique.length > 0) {
          onDateChange(unique[0]);
        }
      }
    }
    loadDates();
  }, [selectedDate]);

  useEffect(() => {
    if (!selectedDate) return;
    async function loadData() {
      setLoading(true);
      const { data: genData } = await supabase
        .from('power_generation')
        .select('*')
        .eq('date', selectedDate)
        .order('time_slot');

      if (genData) setData(genData);
      setLoading(false);
    }
    loadData();
  }, [selectedDate]);

  const [dailyData, setDailyData] = useState(null);
  const [stateData, setStateData] = useState([]);
  const [structuralCollapsed, setStructuralCollapsed] = useState(true);
  const [histCollapsed, setHistCollapsed] = useState(true);
  const [mapMetric, setMapMetric] = useState({ key: 'bess_score', label: 'BESS Score' });
  const [selectedState, setSelectedState] = useState(null);

  const metrics = [
    { key: 'bess_score', label: 'BESS Score' },
    { key: 're_capacity_gw', label: 'RE Capacity (GW)' },
    { key: 'peak_demand_gw', label: 'Peak Demand (GW)' },
    { key: 'evening_ramp_gw', label: 'Evening Ramp (GW)' },
    { key: 're_share_pct', label: 'RE Share (%)' }
  ];

  useEffect(() => {
    async function loadData() {
      // 1. Load Daily PSP Data
      const { data: dData } = await supabase
        .from('power_daily_summary')
        .select('*')
        .order('date', { ascending: false })
        .limit(1);

      if (dData && dData.length > 0) {
        setDailyData(dData[0]);
      }

      // 2. Load State Structural Data (combining power_re_state & iced_state_bess_opportunity)
      const { data: icedData } = await supabase.from('iced_state_bess_opportunity').select('*');
      const { data: reData } = await supabase.from('power_re_state').select('*');

      if (icedData && reData) {
        // Merge them
        const merged = icedData.map(ic => {
          const re = reData.find(r => r.state.toLowerCase() === ic.state.toLowerCase()) || {};
          return {
            state: ic.state,
            bess_score: ic.bess_score,
            evening_ramp_gw: ic.evening_ramp_gw,
            peak_demand_gw: ic.peak_demand_gw,
            rco_gap_pct: ic.rco_gap_pct,
            re_capacity_gw: re.installed_capacity_gw || 0,
            re_share_pct: re.re_share_pct || 0
          };
        });
        setStateData(merged);
      }
    }
    loadData();
  }, []);

  const downloadPsp = () => {
    window.location.href = `/api/psp-download?date=${dailyData?.date || ''}`;
  };

  const handleAnalyseBESS = (stateObj) => {
    // Navigate to BESS tab with prefilled form (requires updating App state, but we can emit event or update local storage)
    // For now, we will dispatch a custom event that App.jsx could listen to, or just alert.
    const prefill = {
      state: stateObj.state,
      powerMW: String(Math.round((stateObj.evening_ramp_gw || 1) * 1000 * 0.5)),
      energyMWh: String(Math.round((stateObj.evening_ramp_gw || 1) * 1000 * 2)),
      projectName: stateObj.state + " BESS — Evening Ramp Storage",
      revenueModel: "capacity",
      vgfApplicable: true,
      cyclesPerDay: "1",
      daysPerYear: "330"
    };

    // In a real app we'd pass this via context or state manager.
    // For now we will store in localStorage so BESSAnalytica can pick it up.
    localStorage.setItem('bess_prefill', JSON.stringify(prefill));
    window.dispatchEvent(new Event('bess_prefill_ready'));
    if (setTab) setTab('bess');
    else alert(`Would navigate to BESS Analytica for ${stateObj.state}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <LiveStrip />

      <div className="max-w-7xl mx-auto w-full px-4 py-6 space-y-6">

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-xs text-gray-500 font-semibold mb-1">Peak Demand</div>
            <div className="text-xl font-bold text-gray-900">{dailyData?.peak_demand_gw?.toFixed(1) || '--'} GW</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-xs text-gray-500 font-semibold mb-1">RE Share</div>
            <div className="text-xl font-bold text-green-600">{dailyData?.re_share_pct?.toFixed(1) || '--'}%</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-xs text-gray-500 font-semibold mb-1">Coal Generation</div>
            <div className="text-xl font-bold text-gray-900">{dailyData?.generation_coal_mu?.toFixed(0) || '--'} MU</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-xs text-gray-500 font-semibold mb-1">Solar Generation</div>
            <div className="text-xl font-bold text-yellow-600">{dailyData?.generation_solar_mu?.toFixed(0) || '--'} MU</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-xs text-gray-500 font-semibold mb-1">Grid Frequency</div>
            <div className={`text-xl font-bold ${dailyData?.grid_frequency_avg >= 49.9 && dailyData?.grid_frequency_avg <= 50.05 ? 'text-green-600' : 'text-amber-500'}`}>
              {dailyData?.grid_frequency_avg?.toFixed(2) || '--'} Hz
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-xs text-gray-500 font-semibold mb-1">Evening Ramp</div>
            <div className="text-xl font-bold text-blue-600">{dailyData?.evening_ramp_gw?.toFixed(1) || '--'} GW</div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            {metrics.map(m => (
              <button
                key={m.key}
                onClick={() => setMapMetric(m)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${mapMetric.key === m.key ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button onClick={downloadPsp} className="text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-50 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Download PSP XLS
          </button>
        </div>

        {/* Map and Details Section */}
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-2/3 bg-white border border-gray-200 rounded-xl shadow-sm p-4 h-[600px]">
            <IndiaMap
              data={stateData}
              selectedMetric={mapMetric}
              onStateClick={setSelectedState}
            />
          </div>

          <div className="lg:w-1/3 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 h-full">
              {selectedState ? (
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{selectedState.state}</h3>
                      <div className="text-sm text-gray-500">State Power Intelligence</div>
                    </div>
                    <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">
                      Score: {selectedState.bess_score?.toFixed(1) || '--'}
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-sm text-gray-600">RE Installed Cap</span>
                      <span className="font-semibold">{selectedState.re_capacity_gw?.toFixed(1) || '--'} GW</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-sm text-gray-600">Peak Demand</span>
                      <span className="font-semibold">{selectedState.peak_demand_gw?.toFixed(1) || '--'} GW</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-sm text-gray-600">Evening Ramp</span>
                      <span className="font-semibold text-amber-600">{selectedState.evening_ramp_gw?.toFixed(1) || '--'} GW</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-sm text-gray-600">RCO Gap</span>
                      <span className="font-semibold text-red-600">{selectedState.rco_gap_pct?.toFixed(1) || '--'}%</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAnalyseBESS(selectedState)}
                    className="w-full bg-[#0F2444] hover:bg-[#1B4F8A] text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    Analyse BESS Project <span className="text-lg">→</span>
                  </button>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  <p>Click a state on the map to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Structural Data Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <button
            className="w-full px-6 py-4 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
            onClick={() => setStructuralCollapsed(!structuralCollapsed)}
          >
            <div className="font-bold text-gray-800">Top 10 States for BESS (Structural Data)</div>
            <div>{structuralCollapsed ? '▼' : '▲'}</div>
          </button>
          {!structuralCollapsed && (
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                  <tr>
                    <th className="px-6 py-3">State</th>
                    <th className="px-6 py-3">BESS Score</th>
                    <th className="px-6 py-3">Evening Ramp (GW)</th>
                    <th className="px-6 py-3">RE Installed (GW)</th>
                    <th className="px-6 py-3">RCO Gap %</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stateData.sort((a,b) => b.bess_score - a.bess_score).slice(0,10).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-semibold text-gray-800">{row.state}</td>
                      <td className="px-6 py-3 text-blue-600 font-bold">{row.bess_score?.toFixed(1) || '--'}</td>
                      <td className="px-6 py-3">{row.evening_ramp_gw?.toFixed(1) || '--'}</td>
                      <td className="px-6 py-3">{row.re_capacity_gw?.toFixed(1) || '--'}</td>
                      <td className="px-6 py-3">{row.rco_gap_pct?.toFixed(1) || '--'}%</td>
                      <td className="px-6 py-3">
                        <button onClick={() => handleAnalyseBESS(row)} className="text-blue-600 font-semibold hover:underline text-xs">Analyse →</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Historical Charts (Existing) */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <button
            className="w-full px-6 py-4 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
            onClick={() => setHistCollapsed(!histCollapsed)}
          >
            <div className="font-bold text-gray-800">Historical Generation & Demand Data</div>
            <div>{histCollapsed ? '▼' : '▲'}</div>
          </button>
          {!histCollapsed && (
            <div className="p-6">

              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Grid Operations</h2>
                <select
                  className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 shadow-sm"
                  value={selectedDate || ''}
                  onChange={(e) => onDateChange(e.target.value)}
                >
                  {availableDates.map(date => (
                    <option key={date} value={date}>{date}</option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wider">Generation Mix (MW)</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorCoal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#1f2937" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#1f2937" stopOpacity={0.1}/>
                            </linearGradient>
                            <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#eab308" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#eab308" stopOpacity={0.1}/>
                            </linearGradient>
                            <linearGradient id="colorWind" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time_slot" tick={{fontSize: 12}} stroke="#9ca3af" />
                          <YAxis tick={{fontSize: 12}} stroke="#9ca3af" />
                          <RechartsTooltip />
                          <Area type="monotone" dataKey="coal_mw" stackId="1" stroke="#1f2937" fill="url(#colorCoal)" />
                          <Area type="monotone" dataKey="gas_mw" stackId="1" stroke="#6b7280" fill="#9ca3af" />
                          <Area type="monotone" dataKey="hydro_mw" stackId="1" stroke="#3b82f6" fill="#93c5fd" />
                          <Area type="monotone" dataKey="nuclear_mw" stackId="1" stroke="#f59e0b" fill="#fcd34d" />
                          <Area type="monotone" dataKey="wind_mw" stackId="1" stroke="#10b981" fill="url(#colorWind)" />
                          <Area type="monotone" dataKey="solar_mw" stackId="1" stroke="#eab308" fill="url(#colorSolar)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wider">Demand Duck Curve (MW)</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time_slot" tick={{fontSize: 12}} stroke="#9ca3af" />
                          <YAxis domain={['auto', 'auto']} tick={{fontSize: 12}} stroke="#9ca3af" />
                          <RechartsTooltip />
                          <Area type="monotone" dataKey="demand_met_mw" stroke="#ef4444" fill="url(#colorDemand)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
