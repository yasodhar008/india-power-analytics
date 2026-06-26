import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";


// ─── Types ────────────────────────────────────────────────────────




// ─── Theme (matches main app) ──────────────────────────────────────
const T = {
  navy:"#1B4F8A", blue:"#2563EB", mid:"#3B82F6", light:"#EEF4FB",
  bg:"#F4F7FB", white:"#FFFFFF", border:"#DDE6F0", text:"#1A2B3C",
  muted:"#5A7A9A", steel:"#7A9FBF", green:"#15803D", greenBg:"#E6F4EC",
  amber:"#92520A", amberBg:"#FEF3C7", red:"#991B1B", redBg:"#FEF2F2",
};

const Card = ({children,style,...p}) =>
  <div style={{background:T.white,borderRadius:10,border:`1px solid ${T.border}`,padding:18,...style}} {...p}>{children}</div>;

const Badge = ({children,color,bg}) =>
  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:12,background:bg,color,letterSpacing:"0.04em"}}>{children}</span>;

// ─── Status Badge ──────────────────────────────────────────────────
function StatusBadge({status}) {
  const cfg = {
    open:     {label:"Open",     color:T.green,    bg:T.greenBg},
    upcoming: {label:"Upcoming", color:T.amber,    bg:T.amberBg},
    awarded:  {label:"Awarded",  color:T.muted,    bg:"#EEF4FB"},
  }[status];
  return <Badge color={cfg.color} bg={cfg.bg}>{cfg.label}</Badge>;
}

// ─── Agency Badge ─────────────────────────────────────────────────
function AgencyBadge({type}) {
  const cfg = {
    central: {label:"Central",  color:T.navy, bg:"#DBEAFE"},
    state:   {label:"State",    color:"#6D28D9", bg:"#EDE9FE"},
    private: {label:"Private",  color:"#065F46", bg:"#D1FAE5"},
  }[type];
  return <Badge color={cfg.color} bg={cfg.bg}>{cfg.label}</Badge>;
}

// ─── Scheme Type Badge ───────────────────────────────────────────
function SchemeBadge({type}) {
  const cfg = {
    vgf:     {label:"VGF",     color:T.green,  bg:T.greenBg},
    pli:     {label:"PLI",     color:T.navy,   bg:"#DBEAFE"},
    customs: {label:"Customs", color:T.amber,  bg:T.amberBg},
    state:   {label:"State",   color:"#6D28D9", bg:"#EDE9FE"},
    infra:   {label:"Infra",   color:"#065F46", bg:"#D1FAE5"},
    policy:  {label:"Policy",  color:T.muted,  bg:"#F0F4FA"},
  };
  const c = cfg[type]||cfg.policy;
  return <Badge color={c.color} bg={c.bg}>{c.label}</Badge>;
}

// ─── Tender Card ──────────────────────────────────────────────────
function TenderCard({tender, onAnalyse}) {
  const [expanded, setExpanded] = useState(false);
  const daysLeft = tender.deadline
    ? Math.ceil((new Date(tender.deadline).getTime()-Date.now())/(1000*60*60*24))
    : null;

  return (
    <Card style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:6}}>
            <StatusBadge status={tender.status}/>
            <AgencyBadge type={tender.agencyType}/>
            {tender.vgf&&<Badge color={T.green} bg={T.greenBg}>VGF {tender.vgfPct||30}%</Badge>}
            <Badge color={T.muted} bg="#F0F4FA">{tender.duration}h duration</Badge>
            <Badge color={T.muted} bg="#F0F4FA">{tender.model}</Badge>
          </div>

          <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap",marginBottom:4}}>
            <span style={{fontSize:15,fontWeight:700,color:T.navy}}>{tender.agency}</span>
            <span style={{fontSize:12,color:T.muted}}>·</span>
            <span style={{fontSize:13,color:T.muted}}>{tender.state}</span>
          </div>

          <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:8}}>
            <div style={{fontFamily:"'DM Mono',monospace"}}>
              <span style={{fontSize:16,fontWeight:700,color:T.text}}>{tender.mw} MW</span>
              <span style={{fontSize:12,color:T.muted}}> / {tender.mwh} MWh</span>
            </div>
            {tender.awardedTariff&&(
              <div>
                <span style={{fontSize:13,fontWeight:700,color:T.green,fontFamily:"'DM Mono',monospace"}}>
                  ₹{(tender.awardedTariff/1e5).toFixed(2)}L/MW/month
                </span>
                {tender.awardedTo&&<span style={{fontSize:11,color:T.muted}}> · {tender.awardedTo}</span>}
              </div>
            )}
            {daysLeft!==null&&tender.status==="open"&&(
              <div style={{fontSize:12,fontWeight:600,color:daysLeft<14?T.red:T.amber}}>
                ⏱ {daysLeft} days to deadline
              </div>
            )}
            {tender.deadline&&tender.status==="upcoming"&&(
              <div style={{fontSize:12,color:T.muted}}>Expected deadline: {tender.deadline}</div>
            )}
          </div>

          {expanded&&(
            <div style={{fontSize:12,color:T.text,lineHeight:1.6,marginBottom:8,padding:"8px 10px",background:T.bg,borderRadius:6}}>
              {tender.description}
              {tender.sourceUrl&&(
                <div style={{marginTop:4}}>
                  <a href={tender.sourceUrl} target="_blank" rel="noopener noreferrer"
                    style={{fontSize:11,color:T.blue}}>Source →</a>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
          <button onClick={()=>onAnalyse(tender)}
            style={{padding:"7px 14px",background:tender.status==="awarded"?T.muted:T.navy,
              color:"#fff",border:"none",borderRadius:6,
              fontSize:12,fontWeight:700,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap"}}>
            {tender.status==="awarded"?"Benchmark →":"Analyse →"}
          </button>
          <button onClick={()=>setExpanded(!expanded)}
            style={{padding:"6px 14px",background:"#F0F4FA",color:T.muted,border:"none",borderRadius:6,
              fontSize:11,fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
            {expanded?"Less":"Details"}
          </button>
        </div>
      </div>
      <div style={{fontSize:10,color:T.steel,marginTop:4}}>Updated {tender.lastUpdated}</div>
    </Card>
  );
}

// ─── Scheme Card ──────────────────────────────────────────────────
function SchemeCard({scheme}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
            <SchemeBadge type={scheme.type}/>
            <Badge
              color={scheme.status==="active"?T.green:scheme.status==="announced"?T.amber:T.muted}
              bg={scheme.status==="active"?T.greenBg:scheme.status==="announced"?T.amberBg:"#F0F4FA"}>
              {scheme.status.charAt(0).toUpperCase()+scheme.status.slice(1)}
            </Badge>
            {scheme.states!=="all"&&scheme.states.map(s=>(
              <Badge key={s} color={"#6D28D9"} bg={"#EDE9FE"}>{s}</Badge>
            ))}
            {scheme.states==="all"&&<Badge color={T.muted} bg="#F0F4FA">All India</Badge>}
          </div>

          <div style={{fontSize:14,fontWeight:700,color:T.navy,marginBottom:3}}>{scheme.name}</div>
          <div style={{fontSize:11,color:T.muted,marginBottom:6}}>{scheme.authority}</div>

          <div style={{background:T.light,borderRadius:6,padding:"6px 10px",marginBottom:6}}>
            <span style={{fontSize:11,fontWeight:700,color:T.navy}}>Quantum: </span>
            <span style={{fontSize:11,color:T.text}}>{scheme.quantum}</span>
          </div>

          <div style={{fontSize:12,color:T.text,lineHeight:1.5,marginBottom:expanded?8:0}}>
            {scheme.benefit}
          </div>

          {expanded&&(
            <div style={{marginTop:8}}>
              <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5}}>Eligibility</div>
              {scheme.eligibility.map((e,i)=>(
                <div key={i} style={{display:"flex",gap:6,marginBottom:4,fontSize:12}}>
                  <span style={{color:T.green,fontWeight:700,flexShrink:0}}>✓</span>
                  <span style={{color:T.text}}>{e}</span>
                </div>
              ))}
              {scheme.notes&&(
                <div style={{marginTop:8,padding:"8px 10px",background:T.amberBg,borderRadius:6,fontSize:11,color:T.amber,lineHeight:1.5}}>
                  <strong>Note: </strong>{scheme.notes}
                </div>
              )}
            </div>
          )}
        </div>

        <button onClick={()=>setExpanded(!expanded)}
          style={{padding:"6px 14px",background:"#F0F4FA",color:T.muted,border:"none",borderRadius:6,
            fontSize:11,fontWeight:600,fontFamily:"inherit",cursor:"pointer",flexShrink:0}}>
          {expanded?"Less":"Details"}
        </button>
      </div>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export default function TenderIntelligence({onAnalyseTender}) {
  const [tab, setTab] = useState("tenders");
  const [tenders, setTenders] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(()=>{
    (async()=>{
      setLoadingData(true);
      const [tr, sc] = await Promise.all([
        supabase.from("tenders").select("*").eq("published",true).order("last_updated",{ascending:false}),
        supabase.from("schemes").select("*").eq("published",true).order("created_at",{ascending:false}),
      ]);
      // Map snake_case DB fields to camelCase component fields
      setTenders((tr.data||[]).map((t)=>({
        id:t.id, agency:t.agency, agencyType:t.agency_type, state:t.state,
        mw:t.mw, mwh:t.mwh, duration:t.duration, model:t.model,
        revenueModel:t.revenue_model, vgf:t.vgf, vgfPct:t.vgf_pct,
        status:t.status, deadline:t.deadline, awardedTariff:t.awarded_tariff,
        awardedTo:t.awarded_to, lowestBid:t.lowest_bid, description:t.description,
        sourceUrl:t.source_url, lastUpdated:t.last_updated,
      })));
      setSchemes((sc.data||[]).map((s)=>({
        id:s.id, name:s.name, authority:s.authority, type:s.type,
        benefit:s.benefit, quantum:s.quantum, eligibility:s.eligibility||[],
        states:s.states?.length>0?s.states:"all", status:s.status, notes:s.notes||"",
      })));
      setLoadingData(false);
    })();
  },[]);
  const [statusFilter, setStatusFilter] = useState<"all"|"open"|"upcoming"|"awarded">("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [agencyFilter, setAgencyFilter] = useState<"all"|"central"|"state">("all");
  const [schemeTypeFilter, setSchemeTypeFilter] = useState("all");
  const [stateSchemeFilter, setStateSchemeFilter] = useState("all");

  const states = ["all",...Array.from(new Set(tenders.map(t=>t.state))).sort()];
  const schemeTypes = ["all","vgf","pli","customs","state","infra","policy"];

  const filteredTenders = tenders.filter(t=>{
    if(statusFilter!=="all"&&t.status!==statusFilter) return false;
    if(stateFilter!=="all"&&t.state!==stateFilter&&t.state!=="Multiple") return false;
    if(agencyFilter!=="all"&&t.agencyType!==agencyFilter) return false;
    return true;
  });

  const filteredSchemes = schemes.filter(s=>{
    if(schemeTypeFilter!=="all"&&s.type!==schemeTypeFilter) return false;
    if(stateSchemeFilter!=="all"&&s.states!=="all"&&!(s.states).includes(stateSchemeFilter)) return false;
    return true;
  });

  const handleAnalyse = (tender) => {
    // Map tender state — handle "Multiple" gracefully
    const mappedState = tender.state==="Multiple" ? "Rajasthan" : tender.state;

    // Derive sensible defaults from tender structure
    const cyclesPerDay = tender.duration>=4 ? "1" : "1.5"; // 4h+ = 1 cycle; 2h = 1.5 cycles common
    const chargingTariffINR = mappedState==="Rajasthan"||mappedState==="Gujarat" ? "2.5"    // solar-rich states
                            : mappedState==="Karnataka"||mappedState==="Tamil Nadu" ? "3.0"
                            : "3.5"; // default off-peak

    onAnalyseTender({
      // Project identity
      projectName: `${tender.agency} ${tender.mw}MW/${tender.mwh}MWh — Analysis`,
      location: tender.state,
      state: mappedState,
      // Technical
      powerMW:    String(tender.mw),
      energyMWh:  String(tender.mwh),
      duration:   String(tender.duration),
      // Revenue
      revenueModel:      tender.revenueModel==="capacity" ? "capacity" : "dispatch",
      capacityChargeINR: tender.awardedTariff ? String(tender.awardedTariff)
                       : tender.lowestBid    ? String(tender.lowestBid) : "",
      cyclesPerDay,
      daysPerYear:       "330",
      chargingTariffINR,
      // VGF
      vgfApplicable: tender.vgf,
      vgfPct:        String((tender.vgfPct||30)/100),
      // Financing defaults for BESS
      projectLife:   tender.model==="BOO" ? "15" : "20",
      debtRatio:     "0.70",
      debtRate:      "0.095",
      // Pass tender status for context banner
      _tenderStatus: tender.status,
    });
  };

  const openCount = tenders.filter(t=>t.status==="open").length;
  const upcomingCount = tenders.filter(t=>t.status==="upcoming").length;
  const totalGWh = tenders.reduce((a,t)=>a+t.mwh,0)/1000;
  const awarded = tenders.filter(t=>t.awardedTariff);
  const lowestTariff = awarded.length>0 ? Math.min(...awarded.map(t=>t.awardedTariff)) : 0;

  const filterBtnS = (active) => ({
    padding:"5px 12px", border:`1.5px solid ${active?T.blue:T.border}`,
    borderRadius:6, background:active?T.light:T.white, fontSize:11,
    fontWeight:600, cursor:"pointer", color:active?T.blue:T.muted,
    fontFamily:"inherit", transition:"all 0.12s",
  });

  const selectS = {
    padding:"5px 10px", border:`1.5px solid ${T.border}`, borderRadius:6,
    fontSize:11, fontFamily:"inherit", background:T.white, color:T.text, cursor:"pointer",
  };

  return (
    <div className="fade">
      {/* Page header */}
      <div style={{marginBottom:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:T.navy,marginBottom:3}}>Tender Intelligence</div>
            <div style={{fontSize:13,color:T.muted}}>Live BESS tenders, awarded results, and applicable subsidies across India.</div>
          </div>
          <div style={{fontSize:10,color:T.steel,background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"5px 10px"}}>
            Data verified: June 2026 · Sources: Mercom, Renewable Watch, Energetica India
          </div>
        </div>
      </div>

      {loadingData&&<div style={{textAlign:"center",padding:32,color:T.muted,fontSize:13}}>Loading tender data…</div>}
      {!loadingData&&<>

      {/* Summary KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
        {[
          ["Open Tenders", openCount, T.green, T.greenBg],
          ["Upcoming", upcomingCount, T.amber, T.amberBg],
          ["Total Tracked", `${totalGWh.toFixed(1)} GWh`, T.blue, T.light],
          ["Record Low Tariff", lowestTariff>0?`₹${(lowestTariff/1e5).toFixed(2)}L/MW`:"N/A", T.navy, "#DBEAFE"],
        ].map(([label,value,color,bg])=>(
          <div key={label} style={{background:bg,borderRadius:8,padding:"12px 14px",border:`1px solid ${T.border}`}}>
            <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{label}</div>
            <div style={{fontSize:20,fontWeight:800,color,fontFamily:"'DM Mono',monospace"}}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:14,borderBottom:`1px solid ${T.border}`,paddingBottom:0}}>
        {[["tenders","Tenders & Awards"],["schemes","Subsidies & Schemes"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:"8px 18px",border:"none",background:"none",fontSize:13,fontWeight:600,
              cursor:"pointer",fontFamily:"inherit",
              color:tab===t?T.navy:T.muted,
              borderBottom:`2.5px solid ${tab===t?T.blue:"transparent"}`,
              marginBottom:"-1px"}}>
            {l}
          </button>
        ))}
      </div>

      {/* Tenders tab */}
      {tab==="tenders"&&(
        <>
          {/* Filters */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
            <span style={{fontSize:11,fontWeight:700,color:T.muted}}>Status:</span>
            {(["all","open","upcoming","awarded"]).map(s=>(
              <button key={s} onClick={()=>setStatusFilter(s)} style={filterBtnS(statusFilter===s)}>
                {s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
            <div style={{width:1,height:20,background:T.border,margin:"0 4px"}}/>
            <span style={{fontSize:11,fontWeight:700,color:T.muted}}>Agency:</span>
            {(["all","central","state"]).map(a=>(
              <button key={a} onClick={()=>setAgencyFilter(a)} style={filterBtnS(agencyFilter===a)}>
                {a.charAt(0).toUpperCase()+a.slice(1)}
              </button>
            ))}
            <div style={{width:1,height:20,background:T.border,margin:"0 4px"}}/>
            <select value={stateFilter} onChange={e=>setStateFilter(e.target.value)} style={selectS}>
              {states.map(s=><option key={s} value={s}>{s==="all"?"All States":s}</option>)}
            </select>
          </div>

          <div style={{fontSize:11,color:T.muted,marginBottom:10}}>
            Showing {filteredTenders.length} tenders
          </div>

          {filteredTenders.map(t=>(
            <TenderCard key={t.id} tender={t} onAnalyse={handleAnalyse}/>
          ))}

          {filteredTenders.length===0&&(
            <div style={{textAlign:"center",padding:"40px 0",color:T.muted,fontSize:13}}>
              No tenders match your filters.
            </div>
          )}

          {/* Market intelligence callout */}
          <div style={{marginTop:16,padding:"14px 16px",background:"#EFF6FF",border:`1px solid #BFDBFE`,borderRadius:8}}>
            <div style={{fontSize:12,fontWeight:700,color:T.navy,marginBottom:4}}>Market Intelligence · June 2026</div>
            <div style={{fontSize:12,color:T.text,lineHeight:1.7}}>
              India's BESS market has seen an <strong>86% tariff reduction</strong> since 2022 — from ₹10.18/kWh to ₹1.48L/MW/month record low.
              The shift from 2-hour to <strong>4-hour duration tenders</strong> is accelerating (SECI, UPPCL, TNGECL).
              MNRE consolidated all new central BESS tenders under <strong>SECI only</strong> from April 2026.
              VGF Tranche II (₹18L/MWh) now has mandatory <strong>20% domestic content</strong> requirement.
            </div>
          </div>
        </>
      )}

      {/* Schemes tab */}
      {tab==="schemes"&&(
        <>
          {/* Filters */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
            <span style={{fontSize:11,fontWeight:700,color:T.muted}}>Type:</span>
            {schemeTypes.map(t=>(
              <button key={t} onClick={()=>setSchemeTypeFilter(t)} style={filterBtnS(schemeTypeFilter===t)}>
                {t==="all"?"All":t.toUpperCase()}
              </button>
            ))}
            <div style={{width:1,height:20,background:T.border,margin:"0 4px"}}/>
            <select value={stateSchemeFilter} onChange={e=>setStateSchemeFilter(e.target.value)} style={selectS}>
              <option value="all">All States</option>
              {Array.from(new Set(schemes.flatMap(s=>s.states==="all"?[]:s.states))).sort().map(s=>(
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {filteredSchemes.map(s=><SchemeCard key={s.id} scheme={s}/>)}

          {/* Scheme applicability note */}
          <div style={{marginTop:14,padding:"14px 16px",background:T.amberBg,border:`1px solid #FDE68A`,borderRadius:8}}>
            <div style={{fontSize:12,fontWeight:700,color:T.amber,marginBottom:4}}>How to use this</div>
            <div style={{fontSize:12,color:T.text,lineHeight:1.7}}>
              When you click <strong>Analyse →</strong> on a tender, BESSAnalytica pre-fills the project with that tender's MW, MWh, state, and revenue structure.
              Applicable VGF and subsidies are automatically factored into the LCOS and IRR calculation.
              State-specific schemes affect OPEX (land lease waivers), financing cost (infra classification), and CAPEX (customs exemptions).
            </div>
          </div>
        </>
      )}
    </>}
    </div>
  );
}
