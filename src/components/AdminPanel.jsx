import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

// ─── Theme ────────────────────────────────────────────────────────
const T = {
  navy:"#1B4F8A", blue:"#2563EB", light:"#EEF4FB", bg:"#F4F7FB",
  white:"#FFFFFF", border:"#DDE6F0", text:"#1A2B3C", muted:"#5A7A9A",
  green:"#15803D", greenBg:"#E6F4EC", amber:"#92520A", amberBg:"#FEF3C7",
  red:"#991B1B", redBg:"#FEF2F2",
};

const inputS = {
  width:"100%", padding:"8px 10px", border:`1.5px solid ${T.border}`,
  borderRadius:6, fontSize:13, fontFamily:"inherit", outline:"none",
  background:T.white, color:T.text,
};
const labelS = {
  fontSize:11, fontWeight:600, color:T.muted, display:"block", marginBottom:3,
};
const Card = ({children,style,...p}) =>
  <div style={{background:T.white,borderRadius:10,border:`1px solid ${T.border}`,padding:18,...style}} {...p}>{children}</div>;

// ─── Tender Form ──────────────────────────────────────────────────
const EMPTY_TENDER = {
  agency:"", agency_type:"central", state:"", mw:"", mwh:"", duration:"4",
  model:"BOO", revenue_model:"capacity", vgf:true, vgf_pct:"30",
  status:"upcoming", deadline:"", awarded_tariff:"", awarded_to:"",
  lowest_bid:"", description:"", source_url:"", last_updated:"", published:true,
};

function TenderForm({initial, onSave, onCancel}) {
  const [form, setForm] = useState({...EMPTY_TENDER,...initial});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const up = (k,v) => setForm((f)=>({...f,[k]:v}));

  const handleSave = async () => {
    if(!form.agency||!form.state||!form.mw||!form.mwh) {
      setError("Agency, State, MW and MWh are required."); return;
    }
    setSaving(true); setError("");
    const payload = {
      agency: form.agency, agency_type: form.agency_type, state: form.state,
      mw: parseFloat(form.mw), mwh: parseFloat(form.mwh), duration: parseFloat(form.duration)||4,
      model: form.model, revenue_model: form.revenue_model,
      vgf: form.vgf, vgf_pct: parseFloat(form.vgf_pct)||30,
      status: form.status,
      deadline: form.deadline||null,
      awarded_tariff: form.awarded_tariff?parseFloat(form.awarded_tariff):null,
      awarded_to: form.awarded_to||null,
      lowest_bid: form.lowest_bid?parseFloat(form.lowest_bid):null,
      description: form.description||null,
      source_url: form.source_url||null,
      last_updated: form.last_updated||new Date().toISOString().split("T")[0],
      published: form.published,
    };
    let error;
    if(form.id) {
      ({error} = await supabase.from("tenders").update(payload).eq("id",form.id));
    } else {
      ({error} = await supabase.from("tenders").insert(payload));
    }
    setSaving(false);
    if(error) { setError(error.message); return; }
    onSave();
  };

  const selectS = {...inputS, cursor:"pointer"};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div>
          <label style={labelS}>Agency *</label>
          <input style={inputS} placeholder="e.g. SECI" value={form.agency} onChange={e=>up("agency",e.target.value)}/>
        </div>
        <div>
          <label style={labelS}>Agency Type</label>
          <select style={selectS} value={form.agency_type} onChange={e=>up("agency_type",e.target.value)}>
            <option value="central">Central</option>
            <option value="state">State</option>
            <option value="private">Private</option>
          </select>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        <div>
          <label style={labelS}>State *</label>
          <input style={inputS} placeholder="e.g. Rajasthan" value={form.state} onChange={e=>up("state",e.target.value)}/>
        </div>
        <div>
          <label style={labelS}>MW *</label>
          <input style={inputS} type="number" placeholder="e.g. 500" value={form.mw} onChange={e=>up("mw",e.target.value)}/>
        </div>
        <div>
          <label style={labelS}>MWh *</label>
          <input style={inputS} type="number" placeholder="e.g. 2000" value={form.mwh} onChange={e=>up("mwh",e.target.value)}/>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
        <div>
          <label style={labelS}>Duration (hrs)</label>
          <select style={selectS} value={form.duration} onChange={e=>up("duration",e.target.value)}>
            {["2","4","6","8"].map(d=><option key={d} value={d}>{d}h</option>)}
          </select>
        </div>
        <div>
          <label style={labelS}>Model</label>
          <select style={selectS} value={form.model} onChange={e=>up("model",e.target.value)}>
            {["BOO","BOOT","EPC","RESCO"].map(m=><option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={labelS}>Revenue Model</label>
          <select style={selectS} value={form.revenue_model} onChange={e=>up("revenue_model",e.target.value)}>
            <option value="capacity">Capacity Charge</option>
            <option value="kWh">₹/kWh</option>
          </select>
        </div>
        <div>
          <label style={labelS}>Status</label>
          <select style={selectS} value={form.status} onChange={e=>up("status",e.target.value)}>
            <option value="open">Open</option>
            <option value="upcoming">Upcoming</option>
            <option value="awarded">Awarded</option>
          </select>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        <div>
          <label style={labelS}>VGF</label>
          <select style={selectS} value={form.vgf?"yes":"no"} onChange={e=>up("vgf",e.target.value==="yes")}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        {form.vgf&&<div>
          <label style={labelS}>VGF %</label>
          <input style={inputS} type="number" placeholder="30" value={form.vgf_pct} onChange={e=>up("vgf_pct",e.target.value)}/>
        </div>}
        <div>
          <label style={labelS}>Deadline / Expected Date</label>
          <input style={inputS} type="date" value={form.deadline} onChange={e=>up("deadline",e.target.value)}/>
        </div>
      </div>
      {form.status==="awarded"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <div>
            <label style={labelS}>Awarded Tariff (₹/MW/month or ₹/kWh×100)</label>
            <input style={inputS} type="number" placeholder="e.g. 441000" value={form.awarded_tariff} onChange={e=>up("awarded_tariff",e.target.value)}/>
          </div>
          <div>
            <label style={labelS}>Awarded To</label>
            <input style={inputS} placeholder="Company name" value={form.awarded_to} onChange={e=>up("awarded_to",e.target.value)}/>
          </div>
          <div>
            <label style={labelS}>Lowest Bid</label>
            <input style={inputS} type="number" value={form.lowest_bid} onChange={e=>up("lowest_bid",e.target.value)}/>
          </div>
        </div>
      )}
      <div>
        <label style={labelS}>Description</label>
        <textarea style={{...inputS,height:72,resize:"vertical"}} placeholder="Project details, location, key terms..." value={form.description} onChange={e=>up("description",e.target.value)}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div>
          <label style={labelS}>Source URL</label>
          <input style={inputS} type="url" placeholder="https://..." value={form.source_url} onChange={e=>up("source_url",e.target.value)}/>
        </div>
        <div>
          <label style={labelS}>Last Updated Date</label>
          <input style={inputS} type="date" value={form.last_updated} onChange={e=>up("last_updated",e.target.value)}/>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <input type="checkbox" id="pub" checked={form.published} onChange={e=>up("published",e.target.checked)}/>
        <label htmlFor="pub" style={{fontSize:13,color:T.text,cursor:"pointer"}}>Published (visible to users)</label>
      </div>
      {error&&<div style={{background:T.redBg,border:`1px solid #FECACA`,borderRadius:6,padding:"8px 12px",fontSize:12,color:T.red}}>{error}</div>}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button onClick={onCancel} style={{padding:"8px 18px",border:`1.5px solid ${T.border}`,borderRadius:6,background:T.white,fontSize:13,fontWeight:600,fontFamily:"inherit",cursor:"pointer",color:T.muted}}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{padding:"8px 18px",background:saving?T.muted:T.navy,color:"#fff",border:"none",borderRadius:6,fontSize:13,fontWeight:700,fontFamily:"inherit",cursor:saving?"not-allowed":"pointer"}}>
          {saving?"Saving…":form.id?"Update Tender":"Add Tender"}
        </button>
      </div>
    </div>
  );
}

// ─── Scheme Form ──────────────────────────────────────────────────
const EMPTY_SCHEME = {
  name:"", authority:"", type:"vgf", benefit:"", quantum:"",
  eligibility:"", states:"", status:"active", notes:"", published:true,
};

function SchemeForm({initial, onSave, onCancel}) {
  const [form, setForm] = useState({
    ...EMPTY_SCHEME,
    ...initial,
    eligibility: Array.isArray(initial?.eligibility) ? initial.eligibility.join("\n") : "",
    states: Array.isArray(initial?.states) ? initial.states.join(", ") : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const up = (k,v) => setForm((f)=>({...f,[k]:v}));
  const selectS = {...inputS, cursor:"pointer"};

  const handleSave = async () => {
    if(!form.name||!form.authority||!form.benefit) {
      setError("Name, Authority and Benefit are required."); return;
    }
    setSaving(true); setError("");
    const payload = {
      name:form.name, authority:form.authority, type:form.type,
      benefit:form.benefit, quantum:form.quantum, status:form.status,
      notes:form.notes||null, published:form.published,
      eligibility: form.eligibility.split("\n").map((s)=>s.trim()).filter(Boolean),
      states: form.states.split(",").map((s)=>s.trim()).filter(Boolean),
    };
    let error;
    if(form.id) {
      ({error} = await supabase.from("schemes").update(payload).eq("id",form.id));
    } else {
      ({error} = await supabase.from("schemes").insert(payload));
    }
    setSaving(false);
    if(error) { setError(error.message); return; }
    onSave();
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div>
          <label style={labelS}>Scheme Name *</label>
          <input style={inputS} placeholder="e.g. MoP VGF Tranche II" value={form.name} onChange={e=>up("name",e.target.value)}/>
        </div>
        <div>
          <label style={labelS}>Authority *</label>
          <input style={inputS} placeholder="e.g. Ministry of Power, GoI" value={form.authority} onChange={e=>up("authority",e.target.value)}/>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        <div>
          <label style={labelS}>Type</label>
          <select style={selectS} value={form.type} onChange={e=>up("type",e.target.value)}>
            {["vgf","pli","customs","state","infra","policy"].map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={labelS}>Status</label>
          <select style={selectS} value={form.status} onChange={e=>up("status",e.target.value)}>
            <option value="active">Active</option>
            <option value="announced">Announced</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div>
          <label style={labelS}>States (comma-separated, blank = All India)</label>
          <input style={inputS} placeholder="e.g. Rajasthan, Karnataka" value={form.states} onChange={e=>up("states",e.target.value)}/>
        </div>
      </div>
      <div>
        <label style={labelS}>Benefit *</label>
        <input style={inputS} placeholder="One-line description of what the scheme provides" value={form.benefit} onChange={e=>up("benefit",e.target.value)}/>
      </div>
      <div>
        <label style={labelS}>Quantum / Size</label>
        <input style={inputS} placeholder="e.g. ₹18L/MWh · Total outlay ₹91 billion" value={form.quantum} onChange={e=>up("quantum",e.target.value)}/>
      </div>
      <div>
        <label style={labelS}>Eligibility Criteria (one per line)</label>
        <textarea style={{...inputS,height:80,resize:"vertical"}} placeholder={"Grid-scale standalone BESS\nMin 20% domestic content\nBOO/BOOT model only"} value={form.eligibility} onChange={e=>up("eligibility",e.target.value)}/>
      </div>
      <div>
        <label style={labelS}>Notes / Caveats</label>
        <textarea style={{...inputS,height:60,resize:"vertical"}} placeholder="Any important conditions, deadlines, or recent changes..." value={form.notes} onChange={e=>up("notes",e.target.value)}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <input type="checkbox" id="spub" checked={form.published} onChange={e=>up("published",e.target.checked)}/>
        <label htmlFor="spub" style={{fontSize:13,color:T.text,cursor:"pointer"}}>Published</label>
      </div>
      {error&&<div style={{background:T.redBg,border:`1px solid #FECACA`,borderRadius:6,padding:"8px 12px",fontSize:12,color:T.red}}>{error}</div>}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button onClick={onCancel} style={{padding:"8px 18px",border:`1.5px solid ${T.border}`,borderRadius:6,background:T.white,fontSize:13,fontWeight:600,fontFamily:"inherit",cursor:"pointer",color:T.muted}}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{padding:"8px 18px",background:saving?T.muted:T.navy,color:"#fff",border:"none",borderRadius:6,fontSize:13,fontWeight:700,fontFamily:"inherit",cursor:saving?"not-allowed":"pointer"}}>
          {saving?"Saving…":form.id?"Update Scheme":"Add Scheme"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Admin Panel ─────────────────────────────────────────────
export default function AdminPanel({onBack}) {
  const [tab, setTab] = useState("tenders");
  const [tenders, setTenders] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [isAdmin, setIsAdmin] = useState(null);

  // Check admin access then load data
  const loadData = async () => {
    setLoading(true);
    const [t,s] = await Promise.all([
      supabase.from("tenders").select("*").order("created_at",{ascending:false}),
      supabase.from("schemes").select("*").order("created_at",{ascending:false}),
    ]);
    setTenders(t.data||[]);
    setSchemes(s.data||[]);
    setLoading(false);
  };

  useEffect(()=>{
    (async()=>{
      const { data } = await supabase.from("admins").select("email").limit(1);
      const admin = (data?.length||0)>0;
      setIsAdmin(admin);
      if(admin) await loadData(); // only load data if confirmed admin
      else setLoading(false);
    })();
  },[]);

  const handleDelete = async (table, id, name) => {
    if(!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    await supabase.from(table).delete().eq("id",id);
    await loadData();
    setDeleting(null);
  };

  const togglePublish = async (table, id, current) => {
    await supabase.from(table).update({published:!current}).eq("id",id);
    await loadData();
  };

  if(isAdmin===false) return (
    <div style={{minHeight:"60vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center",padding:32}}>
        <div style={{fontSize:32,marginBottom:12}}>🔒</div>
        <div style={{fontSize:16,fontWeight:700,color:T.navy,marginBottom:6}}>Admin access only</div>
        <div style={{fontSize:13,color:T.muted}}>Your account does not have admin privileges.</div>
        <button onClick={onBack} style={{marginTop:16,padding:"8px 20px",background:T.navy,color:"#fff",border:"none",borderRadius:6,fontSize:13,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>Back</button>
      </div>
    </div>
  );

  const rowS = {display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderBottom:`1px solid ${T.border}`,fontSize:12};
  const btnS = {padding:"4px 10px",border:`1px solid ${T.border}`,borderRadius:4,background:T.white,fontSize:11,fontWeight:600,fontFamily:"inherit",cursor:"pointer",color:T.muted};

  return (
    <div className="fade">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:T.navy,marginBottom:2}}>Admin Panel</div>
          <div style={{fontSize:12,color:T.muted}}>Manage tenders and schemes displayed to users.</div>
        </div>
        <button onClick={onBack} style={{...btnS,padding:"7px 16px",fontSize:12}}>← Back to App</button>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
        {[
          ["Total Tenders", tenders.length],
          ["Published", tenders.filter(t=>t.published).length],
          ["Open / Upcoming", tenders.filter(t=>t.status==="open"||t.status==="upcoming").length],
          ["Schemes", schemes.filter(s=>s.published).length],
        ].map(([l,v])=>(
          <Card key={l} style={{padding:"12px 14px"}}>
            <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{l}</div>
            <div style={{fontSize:22,fontWeight:800,color:T.navy,fontFamily:"'DM Mono',monospace"}}>{v}</div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:14,borderBottom:`1px solid ${T.border}`}}>
        {[["tenders","Tenders"],["schemes","Schemes"]].map(([t,l])=>(
          <button key={t} onClick={()=>{setTab(t);setAdding(false);setEditing(null);}}
            style={{padding:"8px 18px",border:"none",background:"none",fontSize:13,fontWeight:600,
              cursor:"pointer",fontFamily:"inherit",color:tab===t?T.navy:T.muted,
              borderBottom:`2.5px solid ${tab===t?T.blue:"transparent"}`,marginBottom:"-1px"}}>
            {l}
          </button>
        ))}
      </div>

      {/* Add button */}
      {!adding&&!editing&&(
        <button onClick={()=>setAdding(true)}
          style={{marginBottom:14,padding:"8px 18px",background:T.navy,color:"#fff",border:"none",
            borderRadius:6,fontSize:13,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
          + Add {tab==="tenders"?"Tender":"Scheme"}
        </button>
      )}

      {/* Add form */}
      {adding&&(
        <Card style={{marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:T.navy,marginBottom:14}}>New {tab==="tenders"?"Tender":"Scheme"}</div>
          {tab==="tenders"
            ? <TenderForm initial={{}} onSave={()=>{setAdding(false);loadData();}} onCancel={()=>setAdding(false)}/>
            : <SchemeForm initial={{}} onSave={()=>{setAdding(false);loadData();}} onCancel={()=>setAdding(false)}/>
          }
        </Card>
      )}

      {/* Edit form */}
      {editing&&(
        <Card style={{marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:T.navy,marginBottom:14}}>Edit {tab==="tenders"?"Tender":"Scheme"}</div>
          {tab==="tenders"
            ? <TenderForm initial={editing} onSave={()=>{setEditing(null);loadData();}} onCancel={()=>setEditing(null)}/>
            : <SchemeForm initial={editing} onSave={()=>{setEditing(null);loadData();}} onCancel={()=>setEditing(null)}/>
          }
        </Card>
      )}

      {/* Data table */}
      {loading ? (
        <div style={{textAlign:"center",padding:32,color:T.muted,fontSize:13}}>Loading…</div>
      ) : (
        <Card style={{padding:0,overflow:"hidden"}}>
          {/* Header */}
          <div style={{...rowS,background:T.bg,fontWeight:700,color:T.muted,fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>
            {tab==="tenders"
              ? <><span style={{flex:2}}>Agency / State</span><span style={{flex:1}}>MW/MWh</span><span style={{width:70}}>Status</span><span style={{flex:1}}>Tariff</span><span style={{width:60}}>Live</span><span style={{width:100}}>Actions</span></>
              : <><span style={{flex:2}}>Scheme</span><span style={{width:70}}>Type</span><span style={{width:70}}>Status</span><span style={{width:60}}>Live</span><span style={{width:100}}>Actions</span></>
            }
          </div>

          {tab==="tenders" && tenders.map(t=>(
            <div key={t.id} style={{...rowS,opacity:t.published?1:0.5}}>
              <span style={{flex:2}}>
                <div style={{fontWeight:600,color:T.navy,fontSize:12}}>{t.agency}</div>
                <div style={{fontSize:10,color:T.muted}}>{t.state}</div>
              </span>
              <span style={{flex:1,fontFamily:"'DM Mono',monospace",fontSize:12}}>{t.mw}MW / {t.mwh}MWh</span>
              <span style={{width:70}}>
                <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:10,
                  background:t.status==="open"?T.greenBg:t.status==="upcoming"?T.amberBg:"#EEF4FB",
                  color:t.status==="open"?T.green:t.status==="upcoming"?T.amber:T.muted}}>
                  {t.status}
                </span>
              </span>
              <span style={{flex:1,fontSize:12,color:T.green,fontFamily:"'DM Mono',monospace"}}>
                {t.awarded_tariff?`₹${(t.awarded_tariff/1e5).toFixed(2)}L`:"—"}
              </span>
              <span style={{width:60}}>
                <button onClick={()=>togglePublish("tenders",t.id,t.published)}
                  style={{...btnS,color:t.published?T.green:T.muted,borderColor:t.published?"#86EFAC":T.border}}>
                  {t.published?"✓ Live":"Draft"}
                </button>
              </span>
              <span style={{width:100,display:"flex",gap:4}}>
                <button onClick={()=>{setEditing(t);setAdding(false);window.scrollTo(0,0);}} style={{...btnS,color:T.blue}}>Edit</button>
                <button onClick={()=>handleDelete("tenders",t.id,t.agency+" "+t.mw+"MW")} disabled={deleting===t.id}
                  style={{...btnS,color:T.red,borderColor:"#FECACA"}}>
                  {deleting===t.id?"…":"Del"}
                </button>
              </span>
            </div>
          ))}

          {tab==="schemes" && schemes.map(s=>(
            <div key={s.id} style={{...rowS,opacity:s.published?1:0.5}}>
              <span style={{flex:2}}>
                <div style={{fontWeight:600,color:T.navy,fontSize:12}}>{s.name}</div>
                <div style={{fontSize:10,color:T.muted}}>{s.authority}</div>
              </span>
              <span style={{width:70}}>
                <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:10,background:T.light,color:T.blue}}>{s.type.toUpperCase()}</span>
              </span>
              <span style={{width:70}}>
                <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:10,
                  background:s.status==="active"?T.greenBg:s.status==="announced"?T.amberBg:"#EEF4FB",
                  color:s.status==="active"?T.green:s.status==="announced"?T.amber:T.muted}}>
                  {s.status}
                </span>
              </span>
              <span style={{width:60}}>
                <button onClick={()=>togglePublish("schemes",s.id,s.published)}
                  style={{...btnS,color:s.published?T.green:T.muted,borderColor:s.published?"#86EFAC":T.border}}>
                  {s.published?"✓ Live":"Draft"}
                </button>
              </span>
              <span style={{width:100,display:"flex",gap:4}}>
                <button onClick={()=>{setEditing(s);setAdding(false);window.scrollTo(0,0);}} style={{...btnS,color:T.blue}}>Edit</button>
                <button onClick={()=>handleDelete("schemes",s.id,s.name)} disabled={deleting===s.id}
                  style={{...btnS,color:T.red,borderColor:"#FECACA"}}>
                  {deleting===s.id?"…":"Del"}
                </button>
              </span>
            </div>
          ))}

          {((tab==="tenders"&&tenders.length===0)||(tab==="schemes"&&schemes.length===0))&&(
            <div style={{textAlign:"center",padding:32,color:T.muted,fontSize:13}}>No {tab} found.</div>
          )}
        </Card>
      )}
    </div>
  );
}
