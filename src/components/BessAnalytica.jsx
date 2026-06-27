import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import TenderIntelligence from "./TenderIntelligence";
import AdminPanel from "./AdminPanel";
import { useAuth } from "../lib/AuthContext";
const UserMenu = () => null; const ProjectLimitBanner = () => null; const PDFGate = ({onClose}) => null;

// ─── Design Tokens ───────────────────────────────────────────────
const T = { navy:"#0F2444", blue:"#1B4F8A", mid:"#2E6FBB", steel:"#4A8AC4", border:"#DDE6F0", bg:"#F2F5FA", white:"#FFFFFF", text:"#0F2444", muted:"#6B7E9C", light:"#EBF2FB", green:"#1A6B3C", greenBg:"#E6F4EC", amber:"#92520A", amberBg:"#FEF4E6", red:"#8B1A1A", redBg:"#FDEAEA" };
const CAPEX_COLORS = ["#0F2444","#1B4F8A","#2E6FBB","#4A8AC4","#6FA8D8","#97C3E8","#BDD9F3","#DEEEfa","#EEF6FD"];

// ─── Reference Data ──────────────────────────────────────────────
const CHEM = {
  // India 2025 DC battery cell costs — source: JMK Research, IEEFA, Ember Oct 2025
  // All-in installed cost (cell + BOS + civil + install + GST) built up by calcCAPEX engine
  LFP:  { label:"LFP (Lithium Iron Phosphate)", costPerKwh:55,  cycleLife:6000, efficiency:0.90, calDeg:0.02, cycleDeg:0.00003, warranty:10 },
  NMC:  { label:"NMC (Nickel Manganese Cobalt)", costPerKwh:70, cycleLife:3500, efficiency:0.93, calDeg:0.03, cycleDeg:0.00005, warranty:8  },
  VRLA: { label:"VRLA (Lead Acid)",              costPerKwh:40,  cycleLife:1200, efficiency:0.78, calDeg:0.05, cycleDeg:0.00008, warranty:5  },
  NaS:  { label:"NaS (Sodium Sulfur)",           costPerKwh:110, cycleLife:4500, efficiency:0.82, calDeg:0.02, cycleDeg:0.00003, warranty:15 },
  VFB:  { label:"Vanadium Flow Battery",         costPerKwh:170, cycleLife:20000,efficiency:0.75, calDeg:0.01, cycleDeg:0.000005,warranty:20 },
};
const TOPO = { "AC Coupled":{pcs:38}, "DC Coupled":{pcs:32}, "Hybrid":{pcs:45}, "Containerised":{pcs:40} };
const APPS  = ["Peak Shaving","Frequency Regulation","Renewable Integration","Arbitrage","Backup Power","Microgrid","Black Start","T&D Deferral"];
const GRIDS = ["Grid-tied","Off-grid","Behind-the-meter","Front-of-meter","Island Mode"];

const STATES = {
  "Maharashtra":   { vgf:0.30, gridTariff:6.8, peakTariff:9.5  },
  "Rajasthan":     { vgf:0.30, gridTariff:5.9, peakTariff:8.5  },
  "Gujarat":       { vgf:0.30, gridTariff:6.2, peakTariff:9.0  },
  "Tamil Nadu":    { vgf:0.30, gridTariff:7.1, peakTariff:10.2 },
  "Uttar Pradesh": { vgf:0.30, gridTariff:6.5, peakTariff:9.8  },
  "Karnataka":     { vgf:0.30, gridTariff:6.9, peakTariff:10.0 },
  "Andhra Pradesh":{ vgf:0.30, gridTariff:6.3, peakTariff:9.2  },
  "Kerala":        { vgf:0.30, gridTariff:7.1, peakTariff:10.0 },
  "Madhya Pradesh":{ vgf:0.30, gridTariff:6.4, peakTariff:9.1  },
  "Odisha":        { vgf:0.30, gridTariff:5.8, peakTariff:8.4  },
  "Custom / Other":{ vgf:0.00, gridTariff:6.5, peakTariff:9.0  },
};

const RISKS = {
  "Peak Shaving":         ["Demand charge regulation changes may erode projected savings","Utility interconnection approval delays (6–18 months typical in India)","Load forecasting errors affecting dispatch strategy","Battery degradation reducing peak shaving capacity over time"],
  "Frequency Regulation": ["CERC ancillary service market rules still evolving","High cycle count accelerating degradation beyond warranty terms","Revenue certainty low without long-term ancillary service agreement","Grid code compliance costs may increase"],
  "Renewable Integration":["Curtailment patterns shift penetration increases","Co-location permitting under SECI/DISCOM frameworks","Forecasting obligations under CERC DSM Regulations","Grid stability requirements may increase system complexity"],
  "Arbitrage":            ["IEX price spread compression matures","Underbidding risk in competitive auctions — LCOS discipline essential","Dispatch optimisation software and market access costs","CERC market access rules for merchant BESS evolving"],
  "Backup Power":         ["Extended outage scenarios may exceed designed capacity","Standby losses reducing overall efficiency","Testing and maintenance interrupting availability","CERC certification and safety compliance"],
  "Microgrid":            ["Island mode transition stability and relay coordination","Load management complexity in islanded operation","Multiple DER coordination and control system cost","DISCOM offtake agreement risk for export"],
  "Black Start":          ["Stringent CERC reliability requirements (>99.9% availability)","Regulatory certification process lengthy and costly","Limited revenue stacking in black start contracts","High testing and demonstration costs"],
  "T&D Deferral":         ["DISCOM planning cycles create long decision timelines","Load growth forecasting uncertainty","Re-siting risk if load growth exceeds storage capacity","Long-term tariff approval risk from SERC"],
};
const RECS = {
  LFP:  ["Procure from Tier-1 ALMM-listed suppliers with minimum 10-year warranty","Negotiate performance-based O&M with guaranteed availability above 95%","Apply for VGF under MoP scheme — up to 30% capex support available"],
  NMC:  ["Ensure PESO-approved fire suppression and thermal runaway detection","Review cycle-limit warranty carefully for high-cycle FR applications","Evaluate LFP technology given lower LCOS for Indian conditions"],
  VRLA: ["Limit depth of discharge to below 50% to extend cycle life","Plan battery replacement at year 5–7 in financial model","Ensure CERC-compliant ventilation for hydrogen off-gassing"],
  NaS:  ["Confirm heating system reliability in high-ambient-temperature Indian climate","Engage NGK Insulators for supply and O&M — limited local service network","Budget for higher install cost; 300°C operating temperature adds complexity"],
  VFB:  ["Leverage unlimited cycle life for long-duration T&D deferral projects","Optimise tank sizing to allow future capacity expansion under VGF tranche 2","Factor electrolyte rebalancing in OPEX — limited local vendors currently"],
};

// ─── Currency ────────────────────────────────────────────────────
const CUR = {
  USD: { s:"$",  fmt:(v)=>v>=1e6?`$${(v/1e6).toFixed(2)}M`:v>=1000?`$${(v/1000).toFixed(0)}K`:`$${Math.round(v)}`, x:1 },
  INR: { s:"₹",  fmt:(v)=>{const r=v/0.012;return r>=1e7?`₹${(r/1e7).toFixed(2)} Cr`:r>=1e5?`₹${(r/1e5).toFixed(1)} L`:`₹${Math.round(r).toLocaleString("en-IN")}`;}, x:0.012 },
  EUR: { s:"€",  fmt:(v)=>{const r=v/0.92;return r>=1e6?`€${(r/1e6).toFixed(2)}M`:r>=1000?`€${(r/1000).toFixed(0)}K`:`€${Math.round(r)}`;}, x:0.92 },
};
const fc  = (usd,cur="USD")=>{ if(!usd||isNaN(usd))return (CUR[cur]||CUR.USD).s+"0"; return (CUR[cur]||CUR.USD).fmt(usd); };
const fl  = (usd,cur="USD")=>{ if(!usd||isNaN(usd))return "0"; if(cur==="INR")return `₹${(usd/0.012/1000).toFixed(2)}/kWh`; if(cur==="EUR")return `€${(usd/0.92).toFixed(1)}/MWh`; return `$${usd.toFixed(1)}/MWh`; };
const fmn = (v)=>isNaN(v)?"0":Math.round(v).toLocaleString();
const pct = (v)=>`${(v*100).toFixed(1)}%`;

// ─── Core Calculation Engine ─────────────────────────────────────
const calcCAPEX = (mw, mwh, chemKey, topoKey, overrides={}) => {
  const kw=mw*1000, kwh=mwh*1000;
  const ch=CHEM[chemKey]||CHEM.LFP, tp=TOPO[topoKey]||TOPO["AC Coupled"];
  // Use user overrides when provided, fallback to defaults
  const battPerKwh = parseFloat(overrides.capex_batteryPerKwh)||ch.costPerKwh;
  const pcsPerKw   = parseFloat(overrides.capex_pcsPerKw)||tp.pcs;
  const bmsPerKw   = parseFloat(overrides.capex_bmsPerKw)||5;
  const civPerKw   = parseFloat(overrides.capex_civilPerKw)||10;
  const elecPerKw  = parseFloat(overrides.capex_elecPerKw)||14;
  const instPct    = (parseFloat(overrides.capex_installPct)||6)/100;
  const engPct     = (parseFloat(overrides.capex_engPct)||3)/100;
  const gstPct     = (parseFloat(overrides.capex_gstPct)||12)/100;
  const contPct    = (parseFloat(overrides.capex_contPct)||5)/100;

  const battery=kwh*battPerKwh, pcs=kw*pcsPerKw, bms=kw*bmsPerKw;
  const civil=kw*civPerKw, elec=kw*elecPerKw;
  const install=(battery+pcs)*instPct, eng=(battery+pcs)*engPct, gst=battery*gstPct;
  const sub=battery+pcs+bms+civil+elec+install+eng+gst;
  const cont=sub*contPct, total=sub+cont;
  // OPEX — user overrides (INR/kW or % of CAPEX) converted to USD
  const omINR    = parseFloat(overrides.opex_omPerKw)||415;        // ₹415/kW/yr ≈ $5/kW/yr default
  const insPct2  = parseFloat(overrides.opex_insurancePct)||0.4;   // % of CAPEX/yr
  const landINR  = parseFloat(overrides.opex_landPerKw)||249;      // ₹249/kW/yr ≈ $3/kW/yr default
  const amPct2   = parseFloat(overrides.opex_assetMgmtPct)||0.2;  // % of CAPEX/yr
  const om   = omINR   * kw   * 0.012;   // ₹/kW → USD
  const ins  = total   * insPct2/100;
  const land = landINR * kw   * 0.012;
  const am   = total   * amPct2/100;
  const opex = om+ins+land+am;
  return {
    capex:{battery,pcs,bms,civil,elec,install,eng,gst,cont},
    total, opex,
    opexBreak:{om,ins,land,am,omINR,landINR,insPct:insPct2,amPct:amPct2},
    perKwh:Math.round(total/kwh), perKw:Math.round(total/kw),
    equip:[
      {item:"Battery Modules (DC)",      spec:`${chemKey} cells, DC-level, ${mwh} MWh`, qty:Math.ceil(kwh/280), unit:"units",  uc:battPerKwh*280},
      {item:"PCS / Inverters",           spec:`${topoKey}, ${mw} MW rated`,              qty:Math.ceil(mw/2),    unit:"units",  uc:pcsPerKw*2000},
      {item:"BESS Container (DC Block)", spec:`Containerised DC battery block, ${chemKey}`, qty:Math.ceil(mwh/2), unit:"units", uc:battPerKwh*2000},
      {item:"Battery Mgmt System",       spec:"Cell-level, CERC-compliant",               qty:Math.ceil(kwh/500), unit:"racks", uc:bmsPerKw*500},
      {item:"Energy Mgmt System",        spec:"SCADA+EMS+DSM module",                     qty:1,                  unit:"system",uc:kw*7},
      {item:"MV Transformer",            spec:"11/33kV, ONAN",                            qty:Math.ceil(mw/5),    unit:"units", uc:70000},
      {item:"Switchgear",                spec:"MV, CERC relay protection",                qty:1,                  unit:"set",   uc:kw*10},
      {item:"Civil & Structure",         spec:"Container pads, fencing",                  qty:1,                  unit:"lot",   uc:civil},
      {item:"Fire Suppression",          spec:"PESO-approved, IEC 62933",                 qty:Math.ceil(kwh/1000),unit:"units", uc:15000},
    ],
  };
};

const computeLCOS = (capex, vgf, wacc, life, opex, cpd, dpy, mwh, eff, chargeT, calDeg, cycleDeg, dod) => {
  // PNNL / World Bank methodology
  // LCOS ($/MWh) = PV(all costs) / PV(energy discharged)
  // Costs: capital (annualised via CRF on post-VGF capex), O&M (inflated 5.5%/yr),
  //        charging electricity, augmentation, replacement
  const eCap = capex*(1-vgf);   // effective capex after VGF grant
  const cpY  = cpd*dpy;         // cycles per year
  // Capital Recovery Factor — annualises capex over project life at WACC
  const crf  = wacc>0 ? (wacc*Math.pow(1+wacc,life))/(Math.pow(1+wacc,life)-1) : 1/life;
  const annCapex = eCap * crf;  // annual capital charge ($/yr) — a uniform annuity

  let tCostPV=0, tEnergyPV=0;

  for(let yr=1; yr<=life; yr++){
    // Capacity retention from calendar + cycle degradation
    const calRet   = Math.pow(1 - calDeg, yr);
    const cycleRet = Math.exp(-cycleDeg * cpY * yr);
    const retained = Math.min(calRet, cycleRet);   // 1.0 = no degradation

    // Energy discharged this year (MWh)
    const mwhDischarged = cpY * mwh * dod * eff * retained;

    // Charging cost: energy consumed to charge = discharged / RTE; cost in USD
    const chargingCostUSD = (mwhDischarged / eff) * 1000 * chargeT;  // kWh × $/kWh

        // OPEX escalated at 3%/yr (CPI-linked per SECI contract norms)
    const opexYr = opex * Math.pow(1.03, yr-1);

    // Augmentation top-up every 5 years to restore rated capacity (5% of capex)
    const augCost = (yr % 5 === 0) ? eCap * 0.02 : 0;

    // Full battery replacement at year 12 for 20yr projects (40% of capex)
    const repCost = (yr === 15 && life > 15) ? eCap * 0.15 : 0;

    // Discount factor
    const df = Math.pow(1 + wacc, -yr);

    // Capital annuity is already uniform — discount it
    tCostPV   += (annCapex + opexYr + chargingCostUSD + augCost + repCost) * df;
    tEnergyPV += mwhDischarged * df;
  }

  return tEnergyPV > 0 ? tCostPV / tEnergyPV : 0;
};

// Year-by-year cashflows for DCF, DSCR, sensitivity — IFC / EMI methodology
const buildCashflows = (params) => {
  const { capex, vgf, debtR, debtRate, wacc, tax, depnYrs, life, opex, revenue,
          calDeg, cycleDeg, cpd, dpy, mwh, eff, dod, chargeT } = params;

  const effCapex = capex * (1 - vgf);
  const equity   = effCapex * (1 - debtR);
  const debt     = effCapex * debtR;

  // EMI — level annuity debt service (standard India project finance)
  const emi = debtRate > 0
    ? debt * debtRate * Math.pow(1+debtRate, life) / (Math.pow(1+debtRate, life) - 1)
    : debt / life;

  // CERC SLM depreciation on post-VGF asset
  const depn = effCapex / depnYrs;
  const cpY  = cpd * dpy;

  // Annual charging cost yr1 (electricity purchase to charge the battery)
  const annMwhDischarged = cpY * mwh * dod * eff;
  const annChargingCostYr1 = (annMwhDischarged / eff) * 1000 * (chargeT || 0);

  let debtBal = debt; // reducing balance
  const rows = [];

  for(let yr = 1; yr <= life; yr++){
    // EMI split: interest on opening balance, principal = EMI - interest
    const intYr       = debtBal * debtRate;
    const principal   = Math.min(emi - intYr, debtBal);
    debtBal           = Math.max(0, debtBal - principal);

    // Revenue escalated 3%/yr
    const rev  = revenue * Math.pow(1.03, yr - 1);
    // O&M escalated 3%/yr (CPI-linked)
    const opxI = opex   * Math.pow(1.03, yr - 1);
    // Charging cost escalated 3%/yr (tracks electricity tariff inflation)
    const chrgI = annChargingCostYr1 * Math.pow(1.03, yr - 1);

    // EBITDA — revenue less OPEX and electricity purchase cost for charging
    const ebitda = rev - opxI - chrgI;

    // EBT and tax
    const ebt    = ebitda - depn - intYr;
    const taxAmt = Math.max(0, ebt * tax);

    // FCFE = net profit + non-cash depn - principal repaid
    const fcfe = ebt - taxAmt + depn - principal;

    // DSCR = EBITDA / total debt service
    const dscr = (intYr + principal) > 0 ? ebitda / (intYr + principal) : 99;

    rows.push({ yr, rev, opxI, chrgI, int:intYr, ebitda, ebt, taxAmt, fcfe,
                dscr: Math.round(dscr * 100) / 100 });
  }

  // IRR on equity cashflows — bisection method (robust, no divergence)
  const cfs = [-equity, ...rows.map(r => r.fcfe)];
  const npvAt = (r) => cfs.reduce((a,c,t) => a + c/Math.pow(1+r,t), 0);
  let lo = -0.50, hi = 1.50, irr = 0.10;
  // Check if IRR exists (NPV sign change between lo and hi)
  if(npvAt(lo) * npvAt(hi) < 0){
    for(let i=0; i<100; i++){
      irr = (lo+hi)/2;
      const mid = npvAt(irr);
      if(Math.abs(mid) < 1) break;
      if(npvAt(lo)*mid < 0) hi=irr; else lo=irr;
    }
  } else {
    // No sign change — project may not be viable; estimate from simple payback
    irr = equity > 0 ? Math.max(-0.30, (rows.reduce((a,r)=>a+r.fcfe,0)/rows.length/equity) - 0.02) : 0;
  }

  const npv = cfs.reduce((a,c,t) => a + c/Math.pow(1+wacc,t), 0);

  // Simple payback: years until cumulative equity cashflows turn positive
  let cumEquity = -equity;
  let payback = null;
  for(let i=0; i<rows.length; i++){
    cumEquity += rows[i].fcfe;
    if(cumEquity >= 0){ payback = i+1; break; }
  }

  const minDSCR = Math.min(...rows.map(r => r.dscr));
  const avgDSCR = rows.reduce((a,r) => a+r.dscr, 0) / rows.length;

  return {
    rows,
    irr:     Math.round(irr * 1000) / 10,   // rounded to 0.1%
    npv:     Math.round(npv),
    payback,
    minDSCR: Math.round(minDSCR * 100) / 100,
    avgDSCR: Math.round(avgDSCR * 100) / 100,
    equity, debt, cfs,
  };
};

// Sensitivity: vary one param ±20% steps, return LCOS impact
const sensitivityAnalysis = (base, params) => {
  const vars = [
    { label:"CAPEX",            get:()=>params.capex,         set:(v)=>({...params,capex:v}) },
    { label:"WACC",             get:()=>params.wacc,          set:(v)=>({...params,wacc:v}) },
    { label:"Charging Tariff",  get:()=>params.chargeT,       set:(v)=>({...params,chargeT:v}) },
    { label:"Cycles per Day",   get:()=>params.cpd,           set:(v)=>({...params,cpd:v}) },
    { label:"Calendar Deg %/yr",get:()=>params.calDeg,        set:(v)=>({...params,calDeg:v}) },
    { label:"VGF %",            get:()=>params.vgf,           set:(v)=>({...params,vgf:v}) },
    { label:"Project Life",     get:()=>params.life,          set:(v)=>({...params,life:v}) },
    { label:"DoD %",            get:()=>params.dod,           set:(v)=>({...params,dod:v}) },
  ];
  return vars.map(v=>{
    const val=v.get();
    const lo=v.set(val*0.80), hi=v.set(val*1.20);
    const lcosLo=computeLCOS(lo.capex,lo.vgf,lo.wacc,lo.life,params.opex,lo.cpd,params.dpy,params.mwh,params.eff,lo.chargeT,lo.calDeg,params.cycleDeg,lo.dod);
    const lcosHi=computeLCOS(hi.capex,hi.vgf,hi.wacc,hi.life,params.opex,hi.cpd,params.dpy,params.mwh,params.eff,hi.chargeT,hi.calDeg,params.cycleDeg,hi.dod);
    return { label:v.label, base, lo:lcosLo, hi:lcosHi, swing:Math.abs(lcosHi-lcosLo) };
  }).sort((a,b)=>b.swing-a.swing);
};

// Bid optimiser: given target tariff (INR/MW/month), back-solve min viable CAPEX
const bidOptimise = (targetTariffINR, params) => {
  // ₹/MW/month × 12 months × MW × $/₹ — no ×1000 (tariff is per MW not per kW)
  const targetRevUSD = targetTariffINR*12*params.mw*0.012;
  const results=[];
  for(let vgf=0;vgf<=0.30;vgf+=0.10){
    for(let capexMult=0.70;capexMult<=1.20;capexMult+=0.05){
      const cap=params.baseCap*capexMult;
      const opex=params.baseOpex*(capexMult**0.7);
      let lcos=0, dcf={irr:0,minDSCR:0,payback:null};
      try {
        lcos=computeLCOS(cap,vgf,params.wacc,params.life,opex,params.cpd,params.dpy,params.mwh,params.eff,params.chargeT,params.calDeg,params.cycleDeg,params.dod);
        dcf=buildCashflows({
          capex:cap, vgf, opex, revenue:targetRevUSD,
          debtR:params.debtR||0.70, debtRate:params.debtRate||0.095,
          wacc:params.wacc||0.10, tax:params.tax||0.25, depnYrs:params.depnYrs||12,
          life:params.life||20, calDeg:params.calDeg||0.02, cycleDeg:params.cycleDeg||0.00003,
          cpd:params.cpd||1, dpy:params.dpy||300, mwh:params.mwh, eff:params.eff||0.90, dod:params.dod||0.90,
          chargeT:params.chargeT||0,
        });
      } catch(e){ /* skip bad combinations */ }
      const viable=dcf.irr>=10&&dcf.minDSCR>=1.20&&dcf.payback!==null&&dcf.payback<=15;
      results.push({ vgf:Math.round(vgf*100), capexMult:Math.round(capexMult*100), cap, lcos:Math.round(lcos*10)/10, irr:dcf.irr||0, dscr:dcf.minDSCR||0, payback:dcf.payback, viable });
    }
  }
  return results;
};

// Bankability scorecard
const bankabilityScore = (dcf, lcos) => {
  const checks = [
    { label:"Equity IRR ≥ 12%",            pass:dcf.irr>=12,               val:`${dcf.irr}%`,          weight:25 },
    { label:"Min DSCR ≥ 1.30x",            pass:dcf.minDSCR>=1.30,         val:`${dcf.minDSCR}x`,       weight:20 },
    { label:"Avg DSCR ≥ 1.50x",            pass:dcf.avgDSCR>=1.50,         val:`${dcf.avgDSCR}x`,       weight:15 },
    { label:"Equity Payback ≤ 12 years",   pass:dcf.payback&&dcf.payback<=12, val:dcf.payback?`${dcf.payback} yr`:"N/R", weight:15 },
    { label:"NPV > 0",                      pass:dcf.npv>0,                  val:fc(dcf.npv,"USD"),       weight:10 },
    { label:"LCOS < ₹10/kWh",              pass:lcos*0.012/1000<10,         val:`₹${(lcos*0.012/1000).toFixed(2)}/kWh`, weight:15 },
  ];
  const score=checks.reduce((a,c)=>a+(c.pass?c.weight:0),0);
  return { checks, score, grade: score>=85?"A":score>=70?"B":score>=55?"C":"D" };
};

// Export CSV
const exportCSV = (res, form) => {
  try {
    const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;
    const row=(...c)=>c.map(q).join(",");
    const lines=[
      row("BESS Cost Report"), row("Project",form.projectName||"BESS"),
      row("State",form.state), row("MW",form.powerMW), row("MWh",form.energyMWh),
      row("Chemistry",form.chemistry), row("Currency",form.currency||"USD"),
      row(""), row("CAPEX","USD"),
      ...Object.entries(res.capexBreak).map(([k,v])=>row(k,Math.round(v))),
      row("Total CAPEX",Math.round(res.totalCap)),
      row(""), row("LCOS","$/MWh"), row("LCOS",res.lcos.toFixed(1)),
      row(""), row("IRR %",res.dcf.irr), row("Min DSCR",res.dcf.minDSCR),
      row("Payback yrs",res.dcf.payback||"N/A"),
      row("Bankability Score",res.bank.score+"/100 ("+res.bank.grade+")"),
      row(""), row("Equipment BOQ"),
      row("Item","Spec","Qty","Unit","Unit Cost","Total"),
      ...res.equip.map(e=>row(e.item,e.spec,e.qty,e.unit,Math.round(e.uc),Math.round(e.qty*e.uc))),
    ];
    const blob=new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url;
    a.download=`BESS_${(form.projectName||"Report").replace(/\s+/g,"_")}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  } catch(e){alert("CSV failed: "+e.message);}
};

const buildReportHTML = (res, form) => {
  const chem   = CHEM[form.chemistry] || CHEM.LFP;
  const cur    = form.currency || "INR";
  const today  = new Date().toLocaleDateString("en-IN", {day:"2-digit",month:"long",year:"numeric"});
  const f$     = v => !v||isNaN(v) ? "$0" : v>=1e6 ? "$"+(v/1e6).toFixed(2)+"M" : "$"+(v/1000).toFixed(0)+"K";
  const fR     = v => { const r=v/0.012; return r>=1e7 ? "₹"+(r/1e7).toFixed(2)+" Cr" : "₹"+(r/1e5).toFixed(1)+" L"; };
  const fD     = v => cur==="INR" ? fR(v) : cur==="EUR" ? "€"+((v/0.92)/1e6).toFixed(2)+"M" : f$(v);
  const fN     = v => isNaN(v) ? "0" : Math.round(v).toLocaleString("en-IN");
  const fL     = v => cur==="INR" ? "₹"+(v/0.012/1000).toFixed(2)+"/kWh" : "$"+v.toFixed(1)+"/MWh";
  const gC     = g => g==="A"?"#1A6B3C":g==="B"?"#1B4F8A":g==="C"?"#92520A":"#8B1A1A";
  const gBg    = g => g==="A"?"#E6F4EC":g==="B"?"#EBF2FB":g==="C"?"#FEF4E6":"#FDEAEA";
  const COLORS = ["#0F2444","#1B4F8A","#2E6FBB","#4A8AC4","#6FA8D8","#97C3E8","#BDD9F3","#DEEEfa"];

  const capexE = Object.entries(res.capexBreak).map(([k,v]) => ({
    label: k.replace(/_/g," ").replace(/\b\w/g, c=>c.toUpperCase()),
    value: v||0, pct: Math.round((v||0)/res.totalCap*100)
  }));

  // SVG Donut
  let cum=0;
  const slices = capexE.map((e,i) => {
    const pct=e.value/res.totalCap, s=cum, end=cum+pct; cum+=pct;
    const a1=s*2*Math.PI-Math.PI/2, a2=end*2*Math.PI-Math.PI/2;
    const x1=100+80*Math.cos(a1),y1=100+80*Math.sin(a1);
    const x2=100+80*Math.cos(a2),y2=100+80*Math.sin(a2);
    return '<path d="M100,100 L'+x1.toFixed(1)+','+y1.toFixed(1)+' A80,80 0 '+(pct>0.5?1:0)+',1 '+x2.toFixed(1)+','+y2.toFixed(1)+' Z" fill="'+COLORS[i%COLORS.length]+'" opacity="0.9"/>';
  });
  const donutSVG = '<svg width="200" height="200" viewBox="0 0 200 200">'+slices.join("")+'<circle cx="100" cy="100" r="48" fill="white"/><text x="100" y="95" text-anchor="middle" font-size="11" fill="#6B7E9C" font-family="Arial">Total</text><text x="100" y="113" text-anchor="middle" font-size="13" font-weight="700" fill="#0F2444" font-family="Arial">'+f$(res.totalCap)+'</text></svg>';

  // SVG DSCR bars
  const dscrRows = res.dcf.rows.slice(0,20);
  const maxD = Math.max(...dscrRows.map(r=>r.dscr), 2.5);
  const dBars = dscrRows.map((row,i) => {
    const x=36+i*((560-36)/dscrRows.length)+1, bw=Math.floor((560-36)/dscrRows.length)-2;
    const y=10+((maxD*1.1-Math.max(0,row.dscr))/(maxD*1.1))*(140-34);
    const ht=(140-24)-y;
    const col=row.dscr>=1.3?"#1A6B3C":row.dscr>=1.0?"#92520A":"#8B1A1A";
    return '<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+ht+'" fill="'+col+'" rx="2"/><text x="'+(x+bw/2)+'" y="130" text-anchor="middle" font-size="8" fill="#6B7E9C" font-family="Arial">'+row.yr+'</text>';
  });
  const lineY = 10+((maxD*1.1-1.3)/(maxD*1.1))*(140-34);
  const dscrSVG = '<svg width="560" height="140" viewBox="0 0 560 140"><line x1="36" y1="'+lineY.toFixed(0)+'" x2="560" y2="'+lineY.toFixed(0)+'" stroke="#DC2626" stroke-width="1" stroke-dasharray="4,3"/><text x="34" y="'+(lineY+4).toFixed(0)+'" text-anchor="end" font-size="8" fill="#DC2626" font-family="Arial">1.3x</text>'+dBars.join("")+'</svg>';

  // SVG Cashflow
  const cfRows = res.dcf.rows.slice(0,20);
  const maxCF = Math.max(...cfRows.map(r=>Math.abs(r.fcfe)),1);
  const cfBars = cfRows.map((r,i) => {
    const x=10+i*((560-10)/cfRows.length)+1, bw=Math.floor((560-10)/cfRows.length)-2;
    const midY=63, h=Math.abs(r.fcfe)/maxCF*50;
    const y=r.fcfe>=0?midY-h:midY;
    return '<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+h+'" fill="'+(r.fcfe>=0?"#1A6B3C":"#DC2626")+'" rx="2" opacity="0.85"/><text x="'+(x+bw/2)+'" y="128" text-anchor="middle" font-size="8" fill="#6B7E9C" font-family="Arial">'+r.yr+'</text>';
  });
  const cashflowSVG = '<svg width="560" height="140" viewBox="0 0 560 140"><line x1="10" y1="63" x2="560" y2="63" stroke="#DDE6F0" stroke-width="1"/>'+cfBars.join("")+'</svg>';

  // SVG Tornado
  const tItems = res.sensi.slice(0,6);
  const maxSwing = tItems[0]?.swing||1;
  const tRows = tItems.map((s,i) => {
    const y=10+i*26, midX=264;
    const loW=Math.abs(s.base-s.lo)/maxSwing*120;
    const hiW=Math.abs(s.hi-s.base)/maxSwing*120;
    return '<text x="126" y="'+(y+14)+'" text-anchor="end" font-size="9" fill="#3A4A6B" font-family="Arial">'+s.label+'</text><rect x="'+(midX-loW).toFixed(0)+'" y="'+(y+2)+'" width="'+loW.toFixed(0)+'" height="20" fill="#1B4F8A" rx="2" opacity="0.8"/><rect x="'+midX+'" y="'+(y+2)+'" width="'+hiW.toFixed(0)+'" height="20" fill="#DC2626" rx="2" opacity="0.7"/>';
  });
  const tornadoSVG = '<svg width="520" height="'+(tItems.length*26+20)+'" viewBox="0 0 520 '+(tItems.length*26+20)+'"><line x1="264" y1="0" x2="264" y2="'+(tItems.length*26+20)+'" stroke="#DDE6F0" stroke-width="1.5"/>'+tRows.join("")+'</svg>';

  // Verdict text
  const verdictText = res.bank.grade==="A"
    ? "This project demonstrates strong bankability with an equity IRR of "+res.dcf.irr+"%, minimum DSCR of "+res.dcf.minDSCR+"x, and equity payback of "+(res.dcf.payback||"N/R")+" years. The project meets PFC/REC/SBI lending norms and is suitable for standard infrastructure project finance in India."
    : res.bank.grade==="B"
    ? "This project shows adequate bankability with equity IRR of "+res.dcf.irr+"% and minimum DSCR of "+res.dcf.minDSCR+"x. Targeted improvements to the financing structure or revenue model are recommended before lender submission."
    : res.bank.grade==="C"
    ? "This project has marginal bankability. The equity IRR of "+res.dcf.irr+"% and/or DSCR of "+res.dcf.minDSCR+"x are below standard lender thresholds. Significant restructuring including enhanced VGF support, tariff revision, or CAPEX optimisation is required."
    : "This project is not bankable at the current structure. The equity IRR of "+res.dcf.irr+"% falls below the minimum lender threshold of 10%. A fundamental revision of project economics is required before approaching financial institutions.";

  // Build rows helpers
  const techRows = [
    ["Power Capacity",        form.powerMW+" MW"],
    ["Energy Capacity",       form.energyMWh+" MWh"],
    ["Storage Duration",      (form.duration||"—")+" hours"],
    ["Battery Chemistry",     chem.label],
    ["System Topology",       form.topology],
    ["Depth of Discharge",    Math.round(parseFloat(form.dod||0.9)*100)+"%"],
    ["Round-trip Efficiency", Math.round(chem.efficiency*100)+"%"],
    ["Cycle Life",            chem.cycleLife.toLocaleString()+" cycles"],
    ["Battery Warranty",      chem.warranty+" years"],
    ["Project Lifetime",      form.projectLife+" years"],
    ["Application",           form.application],
    ["Grid Connection",       form.gridType],
    ["State / Location",      form.state+(form.location?", "+form.location:"")],
  ].map(([k,v],i) => '<tr'+(i%2?' class="tr-alt"':'')+'><td>'+k+'</td><td class="mono" style="font-weight:600">'+v+'</td></tr>').join("");

  const finRows = [
    ["Debt Ratio",            Math.round(parseFloat(form.debtRatio)*100)+"%"],
    ["Debt Interest Rate",    (parseFloat(form.debtRate)*100).toFixed(1)+"%"],
    ["WACC",                  (parseFloat(form.wacc)*100).toFixed(1)+"%"],
    ["Corporate Tax Rate",    (parseFloat(form.taxRate)*100).toFixed(0)+"%"],
    ["Depreciation (CERC)",   form.depnYears+" years SLM"],
    ["VGF Applied",           form.vgfApplicable ? Math.round(parseFloat(form.vgfPct)*100)+"% of CAPEX" : "Not applied"],
    ["Total Equity",          f$(res.dcf.equity)],
    ["Total Debt",            f$(res.dcf.debt)],
    ["Revenue Model",         form.revenueModel==="capacity"?"Capacity Charge":"Dispatch/Tariff Spread"],
    ["Annual Revenue (Yr 1)", f$(res.revenue)],
    ["Annual OPEX (Yr 1)",    f$(res.opex)],
    ["Project NPV",           f$(res.dcf.npv)],
  ].map(([k,v],i) => '<tr'+(i%2?' class="tr-alt"':'')+'><td>'+k+'</td><td class="mono" style="font-weight:600">'+v+'</td></tr>').join("");

  const capexRows = capexE.map((e,i) =>
    '<tr'+(i%2?' class="tr-alt"':'')+'><td>'+e.label+'</td><td class="mono">$'+fN(e.value)+'</td><td class="mono">'+fR(e.value)+'</td><td class="mono">'+e.pct+'%</td></tr>'
  ).join("") + '<tr class="tr-total"><td>Total CAPEX</td><td class="mono">$'+fN(res.totalCap)+'</td><td class="mono">'+fR(res.totalCap)+'</td><td class="mono">100%</td></tr>'
  + (res.vgfSaving>0 ? '<tr style="background:#E6F4EC"><td style="color:#1A6B3C">Post-VGF Effective CAPEX</td><td class="mono" style="color:#1A6B3C">$'+fN(res.totalCap*(1-parseFloat(form.vgfPct)))+'</td><td class="mono" style="color:#1A6B3C">'+fR(res.totalCap*(1-parseFloat(form.vgfPct)))+'</td><td>—</td></tr>' : "");

  const benchRows = [
    ["This Project",           "$"+res.perKwh+"/kWh"],
    ["India 2025 (JMK/IEEFA)", "$130–160/kWh"],
    ["Ember Global Oct 2025",  "$120–140/kWh"],
    ["BNEF 2024 (equip only)", "$165/kWh"],
  ].map(([k,v]) => '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #EEF2F8;font-size:9px"><span>'+k+'</span><span class="mono" style="font-weight:600">'+v+'</span></div>').join("");

  const lcosInputRows = [
    ["Effective CAPEX (post-VGF)", "$"+fN(res.totalCap*(1-parseFloat(form.vgfPct||0)))],
    ["Annual OPEX (Year 1)",       "$"+fN(res.opex)],
    ["WACC / Discount Rate",       (parseFloat(form.wacc)*100).toFixed(1)+"%"],
    ["Annual Cycles",              fN((parseFloat(form.cyclesPerDay)||1)*(parseFloat(form.daysPerYear)||300))],
    ["Calendar Degradation",       (chem.calDeg*100).toFixed(0)+"%/year"],
    ["Depth of Discharge",         Math.round(parseFloat(form.dod||0.9)*100)+"%"],
    ["Round-trip Efficiency",      Math.round(chem.efficiency*100)+"%"],
    ["Augmentation (every 5yr)",   "5% of post-VGF CAPEX"],
    ["Battery Replacement (yr 12)","40% of post-VGF CAPEX"],
  ].map(([k,v],i) => '<tr'+(i%2?' class="tr-alt"':'')+'><td>'+k+'</td><td class="mono" style="font-weight:600">'+v+'</td></tr>').join("")
  + '<tr class="tr-total"><td>LCOS (USD/MWh)</td><td class="mono">$'+res.lcos.toFixed(1)+'/MWh</td></tr>'
  + '<tr class="tr-total"><td>LCOS (INR/kWh)</td><td class="mono">₹'+(res.lcos/0.012/1000).toFixed(2)+'/kWh</td></tr>';

  const dcfRows = res.dcf.rows.map((r,i) =>
    '<tr'+(i%2?' class="tr-alt"':'')+'><td class="mono">'+r.yr+'</td><td class="mono">$'+fN(r.rev)+'</td><td class="mono">$'+fN(r.opxI)+'</td><td class="mono" style="color:#92520A">$'+fN(r.chrgI)+'</td><td class="mono">$'+fN(r.ebitda)+'</td><td class="mono">$'+fN(r.int)+'</td><td class="mono" style="color:'+(r.fcfe>=0?"#1A6B3C":"#8B1A1A")+';font-weight:600">$'+fN(r.fcfe)+'</td><td class="mono" style="color:'+(r.dscr>=1.3?"#1A6B3C":r.dscr>=1.0?"#92520A":"#8B1A1A")+';font-weight:600">'+r.dscr+'x</td></tr>'
  ).join("") + '<tr class="tr-total"><td colspan="7">Summary</td><td>IRR: '+res.dcf.irr+'%</td><td>Min: '+res.dcf.minDSCR+'x</td></tr>';

  const dscrLegend = dscrRows.map((row,i) => {
    const col=row.dscr>=1.3?"#1A6B3C":row.dscr>=1.0?"#92520A":"#8B1A1A";
    return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px"><span style="font-size:9px;color:#6B7E9C;min-width:20px">Y'+row.yr+'</span><div style="width:'+(Math.min(row.dscr/3,1)*200).toFixed(0)+'px;height:10px;background:'+col+';border-radius:2px"></div><span style="font-size:9px;font-family:monospace;color:'+col+'">'+row.dscr+'x</span></div>';
  }).join("");

  const bankRows = res.bank.checks.map((c,i) =>
    '<tr'+(i%2?' class="tr-alt"':'')+'><td>'+c.label+'</td><td class="mono">'+(c.label.includes("IRR")?"≥ 12%":c.label.includes("Min DSCR")?"≥ 1.30x":c.label.includes("Avg DSCR")?"≥ 1.50x":c.label.includes("Payback")?"≤ 12 yrs":c.label.includes("NPV")?"> 0":"< ₹10/kWh")+'</td><td class="mono" style="font-weight:700">'+c.val+'</td><td class="mono">'+c.weight+' pts</td><td><span class="'+(c.pass?"pass":"fail")+'">'+(c.pass?"PASS ✓":"FAIL ✗")+'</span></td></tr>'
  ).join("") + '<tr class="tr-total"><td colspan="3">Total Score</td><td>'+res.bank.score+'/100</td><td style="font-weight:700;color:'+gC(res.bank.grade)+'">Grade '+res.bank.grade+'</td></tr>';

  const sensiRows = res.sensi.map((s,i) =>
    '<tr'+(i%2?' class="tr-alt"':'')+'><td style="font-weight:'+(i===0?700:400)+'">'+s.label+'</td><td class="mono" style="color:#1B4F8A">$'+s.lo.toFixed(1)+'/MWh</td><td class="mono">$'+s.base.toFixed(1)+'/MWh</td><td class="mono" style="color:#DC2626">$'+s.hi.toFixed(1)+'/MWh</td><td class="mono" style="font-weight:600">$'+s.swing.toFixed(1)+'/MWh</td><td><span style="background:'+(i===0?"#EBF0FA":i<3?"#F2F5FA":"#F8FAFD")+';color:'+(i===0?"#1B4F8A":i<3?"#3A4A6B":"#6B7E9C")+';padding:2px 7px;border-radius:10px;font-size:9px">'+(i===0?"HIGH":i<3?"MEDIUM":"LOW")+'</span></td></tr>'
  ).join("");

  const boqRows = res.equip.map((e,i) =>
    '<tr'+(i%2?' class="tr-alt"':'')+'><td class="mono" style="color:#9BADC7">'+String(i+1).padStart(2,"0")+'</td><td style="font-weight:600">'+e.item+'</td><td style="color:#6B7E9C">'+e.spec+'</td><td class="mono">'+e.qty+'</td><td>'+e.unit+'</td><td class="mono">$'+fN(e.uc)+'</td><td class="mono" style="font-weight:600">$'+fN(e.qty*e.uc)+'</td><td class="mono" style="color:#6B7E9C">'+fR(e.qty*e.uc)+'</td></tr>'
  ).join("") + '<tr class="tr-total"><td colspan="6">Total Equipment Cost</td><td class="mono">$'+fN(res.equip.reduce((a,e)=>a+e.qty*e.uc,0))+'</td><td class="mono">'+fR(res.equip.reduce((a,e)=>a+e.qty*e.uc,0))+'</td></tr>';

  const riskRows  = res.risks.map((r,i) => '<tr'+(i%2?' class="tr-alt"':'')+'><td style="color:#8B1A1A;font-weight:700;width:24px">R'+(i+1)+'</td><td>'+r+'</td></tr>').join("");
  const recRows   = res.recs.map((r,i)  => '<tr'+(i%2?' class="tr-alt"':'')+'><td style="color:#1A6B3C;font-weight:700;width:24px">'+(i+1)+'</td><td>'+r+'</td></tr>').join("");
  const legendDots = capexE.map((e,i)   => '<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px;font-size:8.5px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:'+COLORS[i%COLORS.length]+'"></span>'+e.label+' ('+e.pct+'%)</span>').join("");

  const kpiCards = [
    ["Total CAPEX",      fD(res.totalCap),          "All-in project cost"],
    ["CAPEX / kWh",      "$"+res.perKwh+"/kWh",     "Battery-level unit cost"],
    ["VGF Benefit",      res.vgfSaving>0?fD(res.vgfSaving):"Not Applied","MoP VGF reduction"],
    ["LCOS",             fL(res.lcos),               "Levelised cost of storage"],
    ["Annual Revenue",   fD(res.revenue),            "Year-1 project revenue"],
    ["Annual OPEX",      fD(res.opex),               "Year-1 operating cost"],
    ["Equity IRR",       res.dcf.irr+"%",            "Post-tax equity return"],
    ["Min DSCR",         res.dcf.minDSCR+"x",        "Worst-year debt coverage"],
    ["Viable Tariff",    "₹"+fN(res.monthlyTariff)+"/MW/mo","Min tariff for LCOS breakeven"],
  ].map(([l,v,d]) => '<div class="kpi"><div class="kpi-val">'+v+'</div><div class="kpi-lbl">'+l+'</div><div style="font-size:8px;color:#9BADC7;margin-top:2px">'+d+'</div></div>').join("");

  const css = "@page{margin:18mm 15mm;size:A4;}@media print{.no-break{page-break-inside:avoid}.page-break{page-break-before:always}}*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10px;color:#0F2444;line-height:1.55}.cover{background:linear-gradient(135deg,#0F2444 0%,#1B4F8A 60%,#2E6FBB 100%);color:#fff;padding:50px 40px;position:relative}.cover-title{font-size:24px;font-weight:700;margin-bottom:6px}.cover-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px}.cover-stat{background:rgba(255,255,255,0.1);border-radius:6px;padding:11px 13px}.cover-stat-val{font-size:17px;font-weight:700}.cover-stat-lbl{font-size:9px;opacity:0.6;text-transform:uppercase;letter-spacing:0.06em;margin-top:2px}.cover-badge{position:absolute;top:40px;right:40px;width:58px;height:58px;border-radius:50%;border:3px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;flex-direction:column}.body-pad{padding:22px 34px}.section{margin-bottom:20px}.section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#1B4F8A;border-bottom:2px solid #1B4F8A;padding-bottom:4px;margin-bottom:11px}.card{background:#F2F5FA;border-radius:8px;padding:13px 15px;border:1px solid #DDE6F0}.kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:16px}.kpi{background:#F2F5FA;border:1px solid #DDE6F0;border-radius:7px;padding:10px 12px}.kpi-val{font-size:15px;font-weight:700;color:#1B4F8A}.kpi-lbl{font-size:8px;text-transform:uppercase;letter-spacing:0.07em;color:#6B7E9C;margin-top:2px}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:9.5px}th{background:#1B4F8A;color:#fff;padding:5px 8px;text-align:left;font-size:8.5px;font-weight:700;text-transform:uppercase}td{padding:5px 8px;border-bottom:1px solid #EEF2F8}.tr-total td{font-weight:700;background:#EBF0FA}.tr-alt{background:#F8FAFD}.verdict{border-radius:7px;padding:11px 14px;margin-bottom:13px}.pass{color:#1A6B3C;font-weight:700}.fail{color:#8B1A1A;font-weight:700}.mono{font-family:\"Courier New\",monospace}.footer{margin-top:18px;border-top:1px solid #DDE6F0;padding-top:7px;font-size:8px;color:#9BADC7}.disclaimer{background:#FEF4E6;border:1px solid #FDDBA0;border-radius:6px;padding:9px 11px;margin-top:14px;font-size:8.5px;color:#92520A;line-height:1.6}";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>BESS Report — ${form.projectName||"Project"}</title><style>${css}</style></head><body>
<div class="cover">
  <div class="cover-badge"><div style="font-size:22px;font-weight:700">${res.bank.grade}</div><div style="font-size:8px;opacity:0.6">GRADE</div></div>
  <div style="font-size:9px;opacity:0.5;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">BESS Investment &amp; Bankability Report</div>
  <div class="cover-title">${form.projectName||"Battery Energy Storage Project"}</div>
  <div style="font-size:12px;opacity:0.7;margin-bottom:6px">${form.state}${form.location?", "+form.location:""} &nbsp;·&nbsp; ${form.powerMW} MW / ${form.energyMWh} MWh &nbsp;·&nbsp; ${form.application} &nbsp;·&nbsp; ${chem.label}</div>
  <div style="font-size:9px;opacity:0.45">Prepared: ${today} &nbsp;·&nbsp; LCOS: PNNL/World Bank &nbsp;·&nbsp; DCF: IFC/EMI Annuity Method</div>
  <div class="cover-meta">
    <div class="cover-stat"><div class="cover-stat-val">${fD(res.totalCap)}</div><div class="cover-stat-lbl">Total CAPEX</div></div>
    <div class="cover-stat"><div class="cover-stat-val">${fL(res.lcos)}</div><div class="cover-stat-lbl">LCOS</div></div>
    <div class="cover-stat"><div class="cover-stat-val">${res.dcf.irr}%</div><div class="cover-stat-lbl">Equity IRR</div></div>
    <div class="cover-stat"><div class="cover-stat-val">${res.dcf.minDSCR}x</div><div class="cover-stat-lbl">Min DSCR</div></div>
    <div class="cover-stat"><div class="cover-stat-val">${res.dcf.payback||"N/R"} yr</div><div class="cover-stat-lbl">Payback</div></div>
    <div class="cover-stat"><div class="cover-stat-val">${res.bank.score}/100</div><div class="cover-stat-lbl">Bankability Score</div></div>
  </div>
</div>
<div class="body-pad">
<div class="section no-break">
  <div class="section-title">1. Executive Summary</div>
  <div class="verdict" style="background:${gBg(res.bank.grade)};border:1px solid ${gC(res.bank.grade)}44">
    <div style="font-size:11px;font-weight:700;color:${gC(res.bank.grade)};margin-bottom:4px">Bankability Assessment: Grade ${res.bank.grade} (${res.bank.score}/100)</div>
    <div style="font-size:9.5px;line-height:1.65">${verdictText}</div>
  </div>
  <div class="kpi-grid">${kpiCards}</div>
</div>
<div class="section no-break">
  <div class="section-title">2. Project Configuration</div>
  <div class="two-col">
    <table><tr><th colspan="2">Technical Parameters</th></tr>${techRows}</table>
    <table><tr><th colspan="2">Financing Structure (IFC/EMI Annuity)</th></tr>${finRows}</table>
  </div>
</div>
<div class="section no-break page-break">
  <div class="section-title">3. Capital Expenditure Analysis</div>
  <div class="two-col">
    <div>${donutSVG}<div style="margin-top:8px">${legendDots}</div></div>
    <div>
      <table><tr><th>Component</th><th>USD</th><th>INR</th><th>%</th></tr>${capexRows}</table>
      <div class="card" style="margin-top:10px"><div style="font-size:9px;font-weight:700;color:#1B4F8A;margin-bottom:5px">Benchmark Comparison</div>${benchRows}</div>
    </div>
  </div>
</div>
<div class="section no-break">
  <div class="section-title">4. Levelised Cost of Storage (LCOS) — PNNL / World Bank Methodology</div>
  <div class="two-col">
    <table><tr><th colspan="2">LCOS Inputs</th></tr>${lcosInputRows}</table>
    <div>
      <table><tr><th colspan="3">vs India Market Benchmarks</th></tr>
        <tr><td><strong>This Project</strong></td><td class="mono" style="color:#1B4F8A;font-weight:700">$${res.lcos.toFixed(1)}/MWh</td><td class="mono">₹${(res.lcos/0.012/1000).toFixed(2)}/kWh</td></tr>
        <tr class="tr-alt"><td>Ember Global Oct 2025</td><td class="mono">$65/MWh</td><td class="mono">₹5.41/kWh</td></tr>
        <tr><td>India VGF Tender 2024</td><td class="mono">$75–90/MWh</td><td class="mono">₹6.2–7.5/kWh</td></tr>
        <tr class="tr-alt"><td>India No-VGF 2024</td><td class="mono">$110–130/MWh</td><td class="mono">₹9.2–10.8/kWh</td></tr>
        <tr><td>BNEF 2024 (equipment only)</td><td class="mono">$165/MWh</td><td class="mono">₹13.7/kWh</td></tr>
      </table>
      <div class="card" style="margin-top:10px">
        <div style="font-size:9px;font-weight:700;color:#1B4F8A;margin-bottom:4px">LCOS-Implied Minimum Tariff</div>
        <div style="font-size:16px;font-weight:700;font-family:monospace">₹${fN(res.monthlyTariff)}/MW/month</div>
        <div style="font-size:8.5px;color:#6B7E9C;margin-top:4px">Minimum capacity charge for cost recovery. Rajasthan Nov 2024 bid: ₹2,19,001/MW/month.</div>
      </div>
    </div>
  </div>
</div>
<div class="section page-break">
  <div class="section-title">5. DCF / IRR Analysis — IFC / EMI Annuity Methodology</div>
  <div class="card" style="margin-bottom:11px;font-size:9.5px;color:#3A4A6B;line-height:1.65">Revenue escalated 3%/yr, O&amp;M at 3%/yr (CPI-linked). EMI annuity debt service consistent with PFC/REC/SBI lending practice. Depreciation SLM on post-VGF asset value over ${form.depnYears} years per CERC normative.</div>
  <div style="margin-bottom:12px"><div style="font-size:9px;font-weight:700;color:#3A4A6B;margin-bottom:5px">Annual Free Cash Flow to Equity — Green: positive &nbsp;|&nbsp; Red: negative</div>${cashflowSVG}</div>
  <table><tr><th>Yr</th><th>Revenue</th><th>OPEX</th><th>EBITDA</th><th>Interest</th><th>FCFE</th><th>DSCR</th></tr>${dcfRows}</table>
</div>
<div class="section no-break">
  <div class="section-title">6. Debt Service Coverage Ratio (DSCR) Profile</div>
  <div style="margin-bottom:8px;font-size:9.5px;color:#3A4A6B">Year-by-year DSCR. Red dashed line = lender minimum 1.30x. Green = adequate, Amber = marginal, Red = shortfall.</div>
  ${dscrSVG}
  <div style="font-size:8.5px;color:#6B7E9C;margin-top:5px">Min DSCR: <strong style="color:${res.dcf.minDSCR>=1.3?"#1A6B3C":"#8B1A1A"}">${res.dcf.minDSCR}x</strong> &nbsp;·&nbsp; Avg DSCR: <strong>${res.dcf.avgDSCR}x</strong> &nbsp;·&nbsp; Lender threshold: 1.30x</div>
</div>
<div class="section no-break">
  <div class="section-title">7. Bankability Scorecard — PFC / REC / SBI Lending Norms</div>
  <table><tr><th>Criterion</th><th>Threshold</th><th>Project Value</th><th>Weight</th><th>Status</th></tr>${bankRows}</table>
  <div class="card" style="margin-top:10px;border-color:${gC(res.bank.grade)}44;background:${gBg(res.bank.grade)}">
    <strong style="color:${gC(res.bank.grade)}">Score: ${res.bank.score}/100 — Grade ${res.bank.grade}</strong>
    <span style="font-size:9.5px;color:#6B7E9C;margin-left:10px">${res.bank.grade==="A"?"Strongly bankable — suitable for PFC/REC project finance at standard terms.":res.bank.grade==="B"?"Bankable with conditions — address failing metrics before lender submission.":res.bank.grade==="C"?"Marginal — significant restructuring needed.":"Not bankable — fundamental revision required."}</span>
  </div>
</div>
<div class="section no-break page-break">
  <div class="section-title">8. Sensitivity Analysis — LCOS Tornado Chart (±20%)</div>
  <div style="font-size:9px;color:#3A4A6B;margin-bottom:9px">Each bar shows LCOS range when the input is varied ±20% from base. Blue = -20% (favourable), Red = +20% (adverse). Wider bar = higher impact.</div>
  ${tornadoSVG}
  <table style="margin-top:12px"><tr><th>Parameter</th><th>-20%</th><th>Base</th><th>+20%</th><th>Swing</th><th>Impact</th></tr>${sensiRows}</table>
</div>
<div class="section no-break">
  <div class="section-title">9. Equipment Bill of Quantities</div>
  <table><tr><th>#</th><th>Equipment</th><th>Specification</th><th>Qty</th><th>Unit</th><th>Unit Cost</th><th>Total (USD)</th><th>Total (INR)</th></tr>${boqRows}</table>
</div>
<div class="section no-break">
  <div class="section-title">10. Risks &amp; Recommendations</div>
  <div class="two-col">
    <table><tr><th colspan="2">Key Project Risks — ${form.application}</th></tr>${riskRows}</table>
    <table><tr><th colspan="2">Recommendations — ${chem.label.split("(")[0].trim()}</th></tr>${recRows}</table>
  </div>
</div>
<div class="disclaimer"><strong>Disclaimer:</strong> Indicative model for evaluation purposes only. CAPEX benchmarks from Ember Oct 2025, JMK Research, IEEFA. LCOS per PNNL/World Bank methodology. DCF per IFC Economic Analysis of Battery Storage Systems (2020) with EMI annuity debt service per PFC/REC/SBI norms. Costs may vary ±15–20%. Obtain Lender's Independent Engineer (LIE) report before financial close.</div>
<div class="footer">Report generated: ${today} &nbsp;·&nbsp; BESSAnalytica v2.0 · bessanalytica.com &nbsp;·&nbsp; ${form.powerMW} MW / ${form.energyMWh} MWh ${form.chemistry} &nbsp;·&nbsp; ${form.state}</div>
</div></body></html>`;
};

const exportPDF = (res, form) => {
  try {
    const html = buildReportHTML(res, form);
    const blob = new Blob([html], {type:"text/html;charset=utf-8;"});
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, "_blank");
    if(!win){ alert("Pop-up blocked — please allow pop-ups and retry."); return; }
    win.onload = () => setTimeout(() => { win.focus(); win.print(); }, 600);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch(e){ alert("Report failed: "+e.message); }
};

// ── Reference Projects (India BESS Benchmarks) ──────────────────
const REFERENCE_PROJECTS = [
  {
    id: "jsw-kerala-2025",
    name: "JSW Energy — Kerala BESS",
    agency: "SECI / NHPC",
    state: "Kerala",
    powerMW: "125",
    energyMWh: "500",
    duration: "4",
    chemistry: "LFP",
    topology: "AC Coupled",
    application: "Renewable Integration",
    gridType: "Grid-tied",
    projectLife: "15",
    debtRatio: "0.70",
    debtRate: "0.090",
    wacc: "0.10",
    taxRate: "0.25",
    depnYears: "12",
    vgfApplicable: true,
    vgfPct: "0.30",
    revenueModel: "capacity",
    capacityChargeINR: "441000",
    cyclesPerDay: "1",
    daysPerYear: "330",
    chargingTariffINR: "2.5",
    dod: "0.90",
    capex_batteryPerKwh: "",
    capex_pcsPerKw: "",
    capex_bmsPerKw: "",
    capex_civilPerKw: "",
    capex_elecPerKw: "",
    capex_installPct: "",
    capex_engPct: "",
    capex_gstPct: "",
    capex_contPct: "",
    currency: "INR",
    location: "Kasaragod, Mylatti 220kV Substation",
    description: "JSW Energy won SECI's auction for 125 MW / 500 MWh 4-hour standalone BESS in Kerala at ₹4,41,000/MW/month. VGF of ₹2.7M/MWh (capped at 30% capex) under MoP scheme. Build-own-operate model, connected to Mylatti 220 kV substation. Represents India's first large-scale 4-hour duration commercial BESS project. Awarded March 2025. JSW charges from captive solar at ~₹2.5/kWh — key to thin-margin bid economics.",
    source: "Mercom India, March 2025 | SECI RfS"
  },
  {
    id: "nvvn-up-2025",
    name: "NVVN — Uttar Pradesh BESS",
    agency: "NVVN / UPPCL",
    state: "Uttar Pradesh",
    powerMW: "250",
    energyMWh: "1000",
    duration: "4",
    chemistry: "LFP",
    topology: "AC Coupled",
    application: "Peak Shaving",
    gridType: "Grid-tied",
    projectLife: "20",
    debtRatio: "0.70",
    debtRate: "0.095",
    wacc: "0.10",
    taxRate: "0.25",
    depnYears: "12",
    vgfApplicable: true,
    vgfPct: "0.30",
    revenueModel: "capacity",
    capacityChargeINR: "553333",
    cyclesPerDay: "1",
    daysPerYear: "330",
    chargingTariffINR: "3.0",
    dod: "0.90",
    capex_batteryPerKwh: "",
    capex_pcsPerKw: "",
    capex_bmsPerKw: "",
    capex_civilPerKw: "",
    capex_elecPerKw: "",
    capex_installPct: "",
    capex_engPct: "",
    capex_gstPct: "",
    capex_contPct: "",
    currency: "INR",
    location: "Uttar Pradesh, ISTS-connected",
    description: "NVVN discovered ₹6.64/kWh tariff for 250 MW/1,000 MWh standalone BESS in Uttar Pradesh — first tender in India where charging cost is in the developer's scope. Equivalent capacity charge ~₹5.53L/MW/month. 4-hour storage duration, 1 cycle/day, 20-year project life. Reflects true all-in cost of storage including electricity purchase for charging.",
    source: "Energy-Storage.news, Jan 2026 | IEEFA India BESS Report Apr 2025"
  }
];


// ── Shared UI Components ─────────────────────────────────────────
const Card      = ({children, style, ...p}) => <div style={{background:"#fff",borderRadius:10,border:"1px solid #DDE6F0",padding:20,...style}} {...p}>{children}</div>;
const SectionHead = ({children}) => <div style={{fontSize:10,fontWeight:700,color:"#5A7A9A",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>{children}</div>;
const BtnPrimary= ({children, style, ...p}) => <button style={{background:"#1B4F8A",color:"#fff",border:"none",borderRadius:7,padding:"10px 22px",fontSize:13,fontWeight:600,fontFamily:"inherit",cursor:"pointer",...style}} {...p}>{children}</button>;
const BtnGhost  = ({children, style, ...p}) => <button style={{background:"transparent",color:"#1B4F8A",border:"1.5px solid #1B4F8A",borderRadius:7,padding:"9px 20px",fontSize:13,fontWeight:600,fontFamily:"inherit",cursor:"pointer",...style}} {...p}>{children}</button>;
const BtnOutline= ({children, style, ...p}) => <button style={{background:"#fff",color:"#3A4A6B",border:"1px solid #DDE6F0",borderRadius:7,padding:"9px 16px",fontSize:13,fontWeight:500,fontFamily:"inherit",cursor:"pointer",...style}} {...p}>{children}</button>;
const SSelect   = ({children, style, ...p}) => <select style={{width:"100%",padding:"9px 12px",border:"1.5px solid #DDE6F0",borderRadius:6,fontSize:13,color:"#0F2444",background:"#FAFBFD",fontFamily:"inherit",...style}} {...p}>{children}</select>;
const Row       = ({label, value, mono, bold, color}) => (
  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #DDE6F0"}}>
    <span style={{fontSize:12,color:"#6B7E9C"}}>{label}</span>
    <span style={{fontSize:12,fontFamily:mono?"'DM Mono',monospace":"inherit",fontWeight:bold?700:500,color:color||"#0F2444"}}>{value}</span>
  </div>
);


const defaultForm = () => ({
  projectName:"", location:"", state:"Rajasthan", currency:"INR",
  powerMW:"", energyMWh:"", duration:"", dod:"0.90",
  chemistry:"LFP", topology:"AC Coupled", application:"Peak Shaving", gridType:"Grid-tied",
  projectLife:"20", debtRatio:"0.70", debtRate:"0.095", wacc:"0.10", taxRate:"0.25", depnYears:"12",
  vgfApplicable:true, vgfPct:"0.30",
  revenueModel:"capacity", cyclesPerDay:"1", chargingTariffINR:"", sellTariffINR:"", daysPerYear:"300",
  capacityChargeINR:"400000",
  // CAPEX unit cost overrides (empty = use engine defaults)
  capex_batteryPerKwh:"", capex_pcsPerKw:"", capex_bmsPerKw:"",
  capex_civilPerKw:"", capex_elecPerKw:"", capex_installPct:"",
  capex_engPct:"", capex_gstPct:"", capex_contPct:"",
  // OPEX overrides (empty = use engine defaults)
  opex_omPerKw:"", opex_insurancePct:"", opex_landPerKw:"", opex_assetMgmtPct:"",
});

export default function BESSAnalytica() {
  const { canExportPDF, canCreateProject, refreshProfile, profile, user } = useAuth();
  const [page, setPage] = useState("tool");
  const [showPDFGate, setShowPDFGate] = useState(false);
  const [tenderContext, setTenderContext] = useState(null);
  const [step, setStep]         = useState(1);
  const [result, setResult]     = useState(null);
  const [saved, setSaved]       = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("lcos");
  const [showSaved, setShowSaved] = useState(false);
  const [form, setForm]         = useState(defaultForm());
  const [bidTarget, setBidTarget] = useState("");
  const [bidResults, setBidResults] = useState(null);
  const up = (k,v) => setForm(f=>({...f,[k]:v}));

  // Load saved projects from Supabase on mount
  useEffect(()=>{
    if(!user) return;
    (async()=>{
      setSavedLoading(true);
      const { data } = await supabase
        .from("projects")
        .select("id,name,state,summary,form,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if(data) setSaved(data.map(p=>({
        id: p.id,
        name: p.name,
        date: new Date(p.created_at).toLocaleDateString("en-IN"),
        form: p.form,
        summary: p.summary,
      })));
      setSavedLoading(false);
    })();
  },[user]);

  useEffect(()=>{
    if(form.powerMW&&form.energyMWh){
      const d=(parseFloat(form.energyMWh)/parseFloat(form.powerMW)).toFixed(1);
      up("duration",isNaN(parseFloat(d))?"":d);
    }
  },[form.powerMW,form.energyMWh]);

  useEffect(()=>{
    const st=STATES[form.state];
    if(!st) return;
    // Only auto-set when genuinely blank — "0" is a valid user input meaning free charging
    if(form.chargingTariffINR==="") up("chargingTariffINR",(st.gridTariff*0.60).toFixed(1));
    if(form.sellTariffINR==="")     up("sellTariffINR", st.peakTariff.toFixed(1));
  },[form.state]);

  const saveProject = async () => {
    if(!result||!user) return;
    const name = form.projectName||`Project ${saved.length+1}`;
    const summary = { capex:result.totalCap, lcos:result.lcos, irr:result.dcf.irr, grade:result.bank.grade };
    const { data, error } = await supabase.from("projects").insert({
      user_id: user.id,
      name,
      state: form.state,
      summary,
      form: {...form},
      result: null, // omit full result — too large; recompute on load
    }).select("id,name,state,summary,form,created_at").single();
    if(!error && data) {
      const entry = { id:data.id, name:data.name, date:new Date(data.created_at).toLocaleDateString("en-IN"), form:data.form, summary:data.summary };
      setSaved(prev=>[entry,...prev.slice(0,9)]);
      await refreshProfile(); // update project_count
    }
  };

  const loadProject = (entry) => {
    setForm(entry.form);
    setResult(null); // clear old result — user will regenerate with loaded form
    setStep(2);      // go to input parameters so user can review before generating
    setShowSaved(false);
    setTenderContext(null);
  };

  const deleteProject = async (id) => {
    await supabase.from("projects").delete().eq("id", id).eq("user_id", user.id);
    setSaved(prev=>prev.filter(s=>s.id!==id));
    await refreshProfile(); // update project_count
  };

  const mw=parseFloat(form.powerMW)||0, mwh=parseFloat(form.energyMWh)||0;
  const ch=CHEM[form.chemistry]||CHEM.LFP;
  const st=STATES[form.state]||STATES["Rajasthan"];
  const vgf=form.vgfApplicable?parseFloat(form.vgfPct)||0:0;
  const cpd=parseFloat(form.cyclesPerDay)||1, dpy=parseFloat(form.daysPerYear)||300;

  const liveCapex = mw>0&&mwh>0 ? calcCAPEX(mw,mwh,form.chemistry,form.topology,form) : null;
  const liveCap  = liveCapex ? liveCapex.total : 0;
  const liveLCOS = liveCapex ? computeLCOS(liveCapex.total,vgf,parseFloat(form.wacc)||0.10,parseInt(form.projectLife)||20,liveCapex.opex,cpd,dpy,mwh,ch.efficiency,(form.chargingTariffINR!==""&&form.chargingTariffINR!==undefined?parseFloat(form.chargingTariffINR)/83:st.gridTariff*0.60/83),ch.calDeg,ch.cycleDeg,parseFloat(form.dod)||0.90) : 0;

  const generate = () => { try {
    const base = calcCAPEX(mw,mwh,form.chemistry,form.topology,form);
    const wacc=parseFloat(form.wacc)||0.10, life=parseInt(form.projectLife)||20;
    const lcos=computeLCOS(base.total,vgf,wacc,life,base.opex,cpd,dpy,mwh,ch.efficiency,(form.chargingTariffINR!==""&&form.chargingTariffINR!==undefined?parseFloat(form.chargingTariffINR)/83:st.gridTariff*0.60/83),ch.calDeg,ch.cycleDeg,parseFloat(form.dod)||0.90);

    let revenue=0;
    if(form.revenueModel==="capacity"){
      // Capacity charge: ₹/MW/month × 12 months × MW × FX
      revenue = (parseFloat(form.capacityChargeINR)||0) * 12 * mw * 0.012;
    } else {
      // Dispatch: gross sell revenue = sell tariff (₹/kWh) × discharged kWh
      // Charging cost is subtracted separately in buildCashflows — no double-counting
      const sellINR  = parseFloat(form.sellTariffINR) || st.peakTariff;
      const annMwh   = cpd * dpy * mwh * (parseFloat(form.dod)||0.90) * ch.efficiency;
      revenue = annMwh * 1000 * sellINR * 0.012; // MWh × kWh/MWh × ₹/kWh × $/₹
    }

    const dcf=buildCashflows({ capex:base.total, vgf, debtR:parseFloat(form.debtRatio)||0.70, debtRate:parseFloat(form.debtRate)||0.095, wacc, tax:parseFloat(form.taxRate)||0.25, depnYrs:parseInt(form.depnYears)||12, life, opex:base.opex, revenue, calDeg:ch.calDeg, cycleDeg:ch.cycleDeg, cpd, dpy, mwh, eff:ch.efficiency, dod:parseFloat(form.dod)||0.90, chargeT:(form.chargingTariffINR!==""&&form.chargingTariffINR!==undefined?parseFloat(form.chargingTariffINR)/83:st.gridTariff*0.60/83) });
    const bank=bankabilityScore(dcf,lcos);
    const sensiParams={ capex:base.total, vgf, wacc, life, opex:base.opex, cpd, dpy, mwh, eff:ch.efficiency, chargeT:(form.chargingTariffINR!==""&&form.chargingTariffINR!==undefined?parseFloat(form.chargingTariffINR)/83:st.gridTariff*0.60/83), calDeg:ch.calDeg, cycleDeg:ch.cycleDeg, dod:parseFloat(form.dod)||0.90 };
    const sensi=sensitivityAnalysis(lcos,sensiParams);
    // Monthly tariff in ₹/MW/month = LCOS ($/MWh) × MWh/MW/month ÷ FX
    // MWh/MW/month = cycles/day × 30 × duration(h) × dod × RTE
    // MWh discharged per MW per month = (MWh/MW) × DoD × RTE × cycles/day × 30
    // MWh/MW = energy capacity / power capacity = actual duration
    const mwhPerMw         = mwh > 0 && mw > 0 ? mwh / mw : (parseFloat(form.duration)||4);
    const mwhPerMwPerMonth = mwhPerMw * (parseFloat(form.dod)||0.90) * ch.efficiency * cpd * (dpy/12);
    const monthlyTariff    = Math.round(lcos * mwhPerMwPerMonth / 0.012);

    setResult({ ...base, totalCap:base.total, capexBreak:base.capex, perKwh:base.perKwh, perKw:base.perKw, lcos, dcf, bank, sensi, revenue, monthlyTariff, risks:RISKS[form.application]||RISKS["Peak Shaving"], recs:RECS[form.chemistry]||RECS.LFP, form:{...form}, vgfSaving:base.total*vgf });
    setStep(3);
    setActiveTab("lcos");
  } catch(e){ alert("Calculation error: "+e.message+"\n"+e.stack?.split('\n')[1]); }};

  const loadAndRun = (proj) => {
    // Build complete form from reference project
    const loadedForm = { ...defaultForm(), ...proj };
    setForm(loadedForm);
    // Run analysis directly with loaded form values (can't use state since it's async)
    try {
      const mwL  = parseFloat(loadedForm.powerMW)||0;
      const mwhL = parseFloat(loadedForm.energyMWh)||0;
      if (!mwL || !mwhL) { alert("Reference project is missing MW/MWh values."); return; }
      const chL  = CHEM[loadedForm.chemistry]||CHEM.LFP;
      const stL  = STATES[loadedForm.state]||STATES["Rajasthan"];
      const vgfL = loadedForm.vgfApplicable ? parseFloat(loadedForm.vgfPct)||0 : 0;
      const cpdL = parseFloat(loadedForm.cyclesPerDay)||1;
      const dpyL = parseFloat(loadedForm.daysPerYear)||300;
      const waccL= parseFloat(loadedForm.wacc)||0.10;
      const lifeL= parseInt(loadedForm.projectLife)||20;
      const dodL = parseFloat(loadedForm.dod)||0.90;

      const base  = calcCAPEX(mwL, mwhL, loadedForm.chemistry, loadedForm.topology, loadedForm);
      const lcos  = computeLCOS(base.total, vgfL, waccL, lifeL, base.opex, cpdL, dpyL, mwhL, chL.efficiency,
                      (loadedForm.chargingTariffINR!==""&&loadedForm.chargingTariffINR!==undefined?parseFloat(loadedForm.chargingTariffINR)/83:stL.gridTariff*0.60/83),
                      chL.calDeg, chL.cycleDeg, dodL);

      let revenue = 0;
      if (loadedForm.revenueModel === "capacity") {
        revenue = (parseFloat(loadedForm.capacityChargeINR)||0) * 12 * mwL * 0.012;
      } else {
        const sellINR = parseFloat(loadedForm.sellTariffINR) || stL.peakTariff;
        const annMwh  = cpdL * dpyL * mwhL * dodL * chL.efficiency;
        revenue = annMwh * 1000 * sellINR * 0.012;
      }

      const dcf = buildCashflows({
        capex: base.total, vgf: vgfL,
        debtR: parseFloat(loadedForm.debtRatio)||0.70,
        debtRate: parseFloat(loadedForm.debtRate)||0.095,
        wacc: waccL, tax: parseFloat(loadedForm.taxRate)||0.25,
        depnYrs: parseInt(loadedForm.depnYears)||12,
        life: lifeL, opex: base.opex, revenue,
        calDeg: chL.calDeg, cycleDeg: chL.cycleDeg,
        cpd: cpdL, dpy: dpyL, mwh: mwhL, eff: chL.efficiency, dod: dodL,
        chargeT: (loadedForm.chargingTariffINR!==""&&loadedForm.chargingTariffINR!==undefined?parseFloat(loadedForm.chargingTariffINR)/83:stL.gridTariff*0.60/83),
      });

      const bank  = bankabilityScore(dcf, lcos);
      const sensiParams = {
        capex: base.total, vgf: vgfL, wacc: waccL, life: lifeL,
        opex: base.opex, cpd: cpdL, dpy: dpyL, mwh: mwhL,
        eff: chL.efficiency, chargeT: (loadedForm.chargingTariffINR!==""&&loadedForm.chargingTariffINR!==undefined?parseFloat(loadedForm.chargingTariffINR)/83:stL.gridTariff*0.60/83),
        calDeg: chL.calDeg, cycleDeg: chL.cycleDeg, dod: dodL,
      };
      const sensi = sensitivityAnalysis(lcos, sensiParams);
      const durHr = parseFloat(loadedForm.duration)||4;
      // MWh/MW/month = (MWh capacity / MW capacity) × DoD × RTE × cycles/day × 30
      const mwhPerMwL        = mwhL > 0 && mwL > 0 ? mwhL / mwL : durHr;
      const mwhPerMwPerMonth = mwhPerMwL * dodL * chL.efficiency * cpdL * (dpyL/12);
      const monthlyTariff = Math.round(lcos * mwhPerMwPerMonth / 0.012);

      setResult({
        ...base, totalCap: base.total, capexBreak: base.capex,
        perKwh: base.perKwh, perKw: base.perKw,
        lcos, dcf, bank, sensi, revenue, monthlyTariff,
        vgfSaving: base.total * vgfL,
        risks: RISKS[loadedForm.application]||RISKS["Peak Shaving"],
        recs:  RECS[loadedForm.chemistry]||RECS.LFP,
        form:  loadedForm,
      });
      setStep(3);
      setActiveTab("lcos");
    } catch(e) {
      alert("Load & Run failed: "+e.message);
    }
  };

  const runBidOptimiser = () => {
    if(!result||!bidTarget) return;
    try {
      const params={
        baseCap:result.totalCap, baseOpex:result.opex,
        wacc:parseFloat(form.wacc)||0.10,
        life:parseInt(form.projectLife)||20,
        debtR:parseFloat(form.debtRatio)||0.70,
        debtRate:parseFloat(form.debtRate)||0.095,
        tax:parseFloat(form.taxRate)||0.25,
        depnYrs:parseInt(form.depnYears)||12,
        cpd, dpy, mwh, eff:ch.efficiency,
        chargeT:(form.chargingTariffINR!==""&&form.chargingTariffINR!==undefined?parseFloat(form.chargingTariffINR)/83:st.gridTariff*0.60/83),
        calDeg:ch.calDeg, cycleDeg:ch.cycleDeg,
        dod:parseFloat(form.dod)||0.90, mw,
      };
      setBidResults(bidOptimise(parseFloat(bidTarget),params));
    } catch(e){ alert("Bid optimiser error: "+e.message); }
  };

  const res=result;
  const cur=form.currency||"INR";
  const capexEntries=res?Object.entries(res.capexBreak).map(([k,v],i)=>({label:k.replace(/\b\w/g,c=>c.toUpperCase()),value:v||0,color:CAPEX_COLORS[i%CAPEX_COLORS.length]})):[];
  const maxCap=Math.max(...capexEntries.map(e=>e.value),1);

  const gradeColor = g => g==="A"?T.green:g==="B"?T.blue:g==="C"?T.amber:T.red;
  const gradeBg    = g => g==="A"?T.greenBg:g==="B"?T.light:g==="C"?T.amberBg:T.redBg;

  const inputS={width:"100%",padding:"9px 12px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:13,color:T.text,background:"#FAFBFD",fontFamily:"inherit"};
  const labelS={fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5,display:"block"};

  return (
    <div style={{fontFamily:"'Inter','DM Sans','Segoe UI',sans-serif",background:T.bg,minHeight:"100vh"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        input:focus,select:focus{border-color:${T.blue}!important;box-shadow:0 0 0 3px rgba(27,79,138,0.1)!important;outline:none;}
        .fade{animation:fi 0.28s ease;} @keyframes fi{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}
        .rh:hover{background:#F8FAFD;} button:active{opacity:0.8;}
        input[type=range]{width:100%;accent-color:${T.blue};}
        input[type=checkbox]{accent-color:${T.blue};}
      `}</style>

      {/* ── Header ── */}
      <div style={{background:T.white,borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1120,margin:"0 auto",padding:"0 22px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:28,height:28,background:T.navy,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:"#fff",fontSize:13,fontWeight:800,letterSpacing:"-0.03em",fontFamily:"inherit"}}>B·</span></div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:T.navy,letterSpacing:"-0.01em"}}>BESSAnalytica</div>
              <div style={{fontSize:9,color:T.muted,letterSpacing:"0.05em",textTransform:"uppercase"}}>BESS Project Costing & Financial Analysis · India</div>
            </div>
          </div>

          {/* Nav tabs */}
          <div style={{display:"flex",gap:2}}>
            {([["tool","Costing Tool"],["tenders","Tender Intelligence"]]).map(([p,l])=>(
              <button key={p} onClick={()=>setPage(p)}
                style={{padding:"6px 14px",border:"none",background:page===p?T.light:"transparent",
                  borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                  color:page===p?T.navy:T.muted}}>
                {l}{p==="tenders"&&<span style={{marginLeft:5,fontSize:9,background:T.green,color:"#fff",padding:"1px 5px",borderRadius:3,fontWeight:700}}>LIVE</span>}
              </button>
            ))}
          </div>

          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {/* Currency */}
            <div style={{display:"flex",background:"#F0F4FA",borderRadius:6,padding:2,gap:1}}>
              {["USD","INR","EUR"].map(c=>(
                <button key={c} onClick={()=>up("currency",c)}
                  style={{padding:"4px 10px",borderRadius:5,border:"none",fontSize:11,fontWeight:600,fontFamily:"inherit",cursor:"pointer",background:cur===c?T.blue:"transparent",color:cur===c?"#fff":T.muted}}>
                  {c}
                </button>
              ))}
            </div>

            {/* User menu */}
            <UserMenu />
            {profile?.email==="yasodhar008@gmail.com"&&(
              <button onClick={()=>setPage("admin")}
                style={{padding:"5px 12px",background:page==="admin"?"#FEF2F2":"transparent",
                  border:"1px solid "+(page==="admin"?"#FECACA":"#DDE6F0"),borderRadius:6,
                  fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:"pointer",color:"#991B1B"}}>
                Admin
              </button>
            )}

            {/* Saved projects and steps — only on tool page */}
            {page==="tool"&&<div style={{position:"relative"}}>
              <button onClick={()=>setShowSaved(!showSaved)}
                style={{padding:"5px 12px",background:T.light,border:`1px solid ${T.border}`,borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:T.blue}}>
                {savedLoading?"…":saved.length>0?`Saved (${saved.length})`:"Saved"}
              </button>
              {showSaved&&(
                <div style={{position:"absolute",right:0,top:34,background:T.white,border:`1px solid ${T.border}`,borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:200,minWidth:320,padding:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Saved Projects</div>
                  {saved.length===0&&<div style={{fontSize:12,color:T.muted,padding:"8px 0"}}>No saved projects.</div>}
                  {saved.map(s=>(
                    <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
                      <div style={{cursor:"pointer",flex:1}} onClick={()=>loadProject(s)}>
                        <div style={{fontSize:12,fontWeight:600,color:T.text}}>{s.name}</div>
                        <div style={{fontSize:10,color:T.muted}}>{s.date} · CAPEX {fc(s.summary.capex,cur)} · IRR {s.summary.irr}% · Grade <strong style={{color:gradeColor(s.summary.grade)}}>{s.summary.grade}</strong></div>
                      </div>
                      <button onClick={()=>deleteProject(s.id)} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:12,padding:"0 4px"}}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>}

            {page==="tool"&&<div style={{display:"flex",alignItems:"center",gap:5}}>
              {["Project","Parameters","Results"].map((label,i)=>{
                const s=i+1;
                return <div key={s} style={{display:"flex",alignItems:"center",gap:4}}>
                  <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,background:step>=s?T.blue:"#E4EAF4",color:step>=s?"#fff":"#9BADC7"}}>{s}</div>
                  <span style={{fontSize:11,color:step===s?T.navy:T.muted,fontWeight:step===s?600:400}}>{label}</span>
                  {s<3&&<div style={{width:16,height:1.5,background:step>s?T.blue:"#D5DCE8",borderRadius:2,marginLeft:4}}/>}
                </div>;
              })}
            </div>}
          </div>
        </div>
      </div>

      <div style={{maxWidth:1120,margin:"0 auto",padding:"22px 18px"}}>
        {page==="admin"&&(
          <AdminPanel onBack={()=>setPage("tool")}/>
        )}
        {page==="tenders"&&(
          <TenderIntelligence onAnalyseTender={(prefill)=>{
            const {_tenderStatus, ...formPrefill} = prefill;
            setForm(f=>({...f,...formPrefill}));
            setTenderContext({
              name: prefill.projectName || "Tender",
              status: _tenderStatus || "open",
            });
            setPage("tool");
            setStep(2);
          }}/>
        )}
        {page==="tool"&&<>

        {/* ── STEP 1 ── */}
        {step===1&&(
          <div className="fade">
            <div style={{marginBottom:18}}>
              <div style={{fontSize:18,fontWeight:700,color:T.navy,marginBottom:4}}>Project Information</div>
              <div style={{fontSize:13,color:T.muted}}>Select state to auto-load local tariff and VGF benchmarks.</div>
            </div>
            <Card style={{marginBottom:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
                <div style={{gridColumn:"1/-1",display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                  <div><label style={labelS}>Project Name</label><input style={inputS} placeholder="e.g. SECI 500 MW BESS Rajasthan" value={form.projectName} onChange={e=>up("projectName",e.target.value)}/></div>
                  <div><label style={labelS}>Location / District</label><input style={inputS} placeholder="e.g. Jaisalmer" value={form.location} onChange={e=>up("location",e.target.value)}/></div>
                </div>
                <div><label style={labelS}>State</label><SSelect value={form.state} onChange={e=>up("state",e.target.value)}>{Object.keys(STATES).map(s=><option key={s}>{s}</option>)}</SSelect></div>
                <div><label style={labelS}>Application</label><SSelect value={form.application} onChange={e=>up("application",e.target.value)}>{APPS.map(a=><option key={a}>{a}</option>)}</SSelect></div>
                <div><label style={labelS}>Grid Connection</label><SSelect value={form.gridType} onChange={e=>up("gridType",e.target.value)}>{GRIDS.map(g=><option key={g}>{g}</option>)}</SSelect></div>
              </div>
            </Card>
            <div style={{background:T.light,border:`1px solid ${T.border}`,borderRadius:7,padding:"10px 14px",marginBottom:14,fontSize:12,color:T.blue}}>
              <strong>{form.state}:</strong> &nbsp; Grid tariff ₹{STATES[form.state]?.gridTariff}/kWh &nbsp;|&nbsp; Peak tariff ₹{STATES[form.state]?.peakTariff}/kWh &nbsp;|&nbsp; VGF up to {pct(STATES[form.state]?.vgf)} of CAPEX
            </div>
            {/* ── Reference Projects ── */}
            <div style={{marginTop:14}}>
              <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Reference Projects — Load India Benchmark Data</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                {REFERENCE_PROJECTS.map(proj=>(
                  <div key={proj.id} style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:9,padding:"14px 16px",borderLeft:`3px solid ${T.blue}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:T.navy}}>{proj.name}</div>
                        <div style={{fontSize:10,color:T.muted,marginTop:2}}>{proj.agency} &nbsp;·&nbsp; {proj.powerMW} MW / {proj.energyMWh} MWh &nbsp;·&nbsp; {proj.duration}h &nbsp;·&nbsp; {proj.state}</div>
                      </div>
                      <button onClick={()=>loadAndRun(proj)}
                        style={{padding:"5px 12px",background:T.blue,color:"#fff",border:"none",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",flexShrink:0,marginLeft:10}}>
                        Load
                      </button>
                    </div>
                    <div style={{fontSize:11,color:T.muted,lineHeight:1.6,marginBottom:8}}>{proj.description}</div>
                    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                      {[
                        ["Tariff", "₹"+parseInt(proj.capacityChargeINR).toLocaleString("en-IN")+"/MW/mo"],
                        ["VGF",    proj.vgfApplicable ? Math.round(parseFloat(proj.vgfPct)*100)+"%" : "None"],
                        ["Duration",proj.duration+"h"],
                        ["Life",   proj.projectLife+"yr"],
                      ].map(([l,v])=>(
                        <div key={l} style={{background:T.bg,borderRadius:5,padding:"3px 9px"}}>
                          <span style={{fontSize:9,color:T.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>{l}: </span>
                          <span style={{fontSize:11,fontWeight:700,color:T.navy,fontFamily:"'DM Mono',monospace"}}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{fontSize:9,color:T.muted,marginTop:8,fontStyle:"italic"}}>Source: {proj.source}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{display:"flex",justifyContent:"flex-end"}}><BtnPrimary onClick={()=>setStep(2)}>Next: System Parameters</BtnPrimary></div>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step===2&&(
          <div className="fade">
            {/* Tender context banner */}
            {tenderContext&&(
              <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,
                padding:"10px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:16}}>📋</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:T.navy}}>
                      {tenderContext.status==="awarded"?"Benchmarking against awarded tender":"Analysing live tender"}
                    </div>
                    <div style={{fontSize:11,color:T.muted,marginTop:1}}>
                      {tenderContext.name.replace(" — Analysis","")} &nbsp;·&nbsp;
                      {tenderContext.status==="awarded"
                        ? "Inputs pre-filled from awarded tariff — adjust to model your own bid"
                        : "Inputs pre-filled from tender specs — review and adjust before generating"}
                    </div>
                  </div>
                </div>
                <button onClick={()=>setTenderContext(null)}
                  style={{fontSize:16,background:"none",border:"none",cursor:"pointer",color:T.muted,padding:"0 4px"}}>×</button>
              </div>
            )}

            <div style={{marginBottom:16}}>
              <div style={{fontSize:18,fontWeight:700,color:T.navy,marginBottom:4}}>Input Parameters</div>
              <div style={{fontSize:13,color:T.muted}}>Configure your project. Leave cost fields blank to use 2025 India benchmarks.</div>
            </div>

            {/* ROW 1: Project Details + Battery Chemistry */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>

              <Card>
                <SectionHead>Project Details</SectionHead>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <label style={labelS}>Power (MW)</label>
                      <input style={inputS} type="number" min="1" step="1" placeholder="e.g. 100" value={form.powerMW} onChange={e=>up("powerMW",e.target.value)}/>
                    </div>
                    <div>
                      <label style={labelS}>Energy (MWh)</label>
                      <input style={inputS} type="number" min="1" step="1" placeholder="e.g. 400" value={form.energyMWh} onChange={e=>up("energyMWh",e.target.value)}/>
                    </div>
                  </div>
                  {form.duration&&(
                    <div style={{background:T.light,borderRadius:6,padding:"5px 10px",fontSize:12,color:T.blue,fontWeight:600}}>
                      Duration: {form.duration}h
                    </div>
                  )}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <label style={labelS}>State</label>
                      <SSelect value={form.state} onChange={e=>up("state",e.target.value)}>
                        {Object.keys(STATES).map(s=><option key={s}>{s}</option>)}
                      </SSelect>
                    </div>
                    <div>
                      <label style={labelS}>Project Life</label>
                      <SSelect value={form.projectLife} onChange={e=>up("projectLife",e.target.value)}>
                        {["10","12","15","20","25"].map(y=><option key={y} value={y}>{y} years</option>)}
                      </SSelect>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <label style={labelS}>Topology</label>
                      <SSelect value={form.topology} onChange={e=>up("topology",e.target.value)}>
                        {Object.keys(TOPO).map(t=><option key={t}>{t}</option>)}
                      </SSelect>
                    </div>
                    <div>
                      <label style={labelS}>Application</label>
                      <SSelect value={form.application} onChange={e=>up("application",e.target.value)}>
                        {Object.keys(RISKS).map(a=><option key={a}>{a}</option>)}
                      </SSelect>
                    </div>
                  </div>
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <label style={{...labelS,margin:0}}>Depth of Discharge</label>
                      <span style={{fontSize:12,fontWeight:700,color:T.blue}}>{Math.round(parseFloat(form.dod||0.9)*100)}%</span>
                    </div>
                    <input type="range" min="0.70" max="1.00" step="0.01" value={form.dod} onChange={e=>up("dod",e.target.value)} style={{width:"100%"}}/>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.muted,marginTop:2}}>
                      <span>70%</span><span>Typical: 80–90%</span><span>100%</span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <SectionHead>Battery Chemistry</SectionHead>
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {Object.entries(CHEM).map(([k,c])=>(
                    <div key={k} onClick={()=>up("chemistry",k)}
                      style={{display:"flex",alignItems:"center",justifyContent:"space-between",border:`1.5px solid ${form.chemistry===k?T.blue:T.border}`,borderRadius:7,padding:"9px 12px",cursor:"pointer",background:form.chemistry===k?T.light:T.white,transition:"all 0.14s"}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:form.chemistry===k?T.blue:T.navy}}>{c.label.split("(")[0].trim()}</div>
                        <div style={{fontSize:10,color:T.muted,marginTop:1}}>{c.warranty}yr warranty · {(c.cycleLife/1000).toFixed(0)}k cycles · {Math.round(c.efficiency*100)}% RTE</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:13,fontWeight:700,color:form.chemistry===k?T.blue:T.text,fontFamily:"'DM Mono',monospace"}}>${c.costPerKwh}/kWh</div>
                        <div style={{fontSize:10,color:T.muted}}>DC cell cost</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* ROW 2: CAPEX + OPEX */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>

              <Card>
                <SectionHead>CAPEX Unit Costs <span style={{fontWeight:400,fontSize:9,textTransform:"none",letterSpacing:0,color:T.muted}}>blank = 2025 India benchmarks</span></SectionHead>
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <label style={labelS}>Battery DC ($/kWh) <span style={{color:T.steel,fontWeight:400}}>def: ${CHEM[form.chemistry]?.costPerKwh}</span></label>
                      <input style={inputS} type="number" step="1" placeholder={String(CHEM[form.chemistry]?.costPerKwh||55)} value={form.capex_batteryPerKwh} onChange={e=>up("capex_batteryPerKwh",e.target.value)}/>
                      <div style={{fontSize:10,color:T.muted,marginTop:2}}>Cells + module + rack (container)</div>
                    </div>
                    <div>
                      <label style={labelS}>PCS / Inverter ($/kW) <span style={{color:T.steel,fontWeight:400}}>def: ${TOPO[form.topology]?.pcs}</span></label>
                      <input style={inputS} type="number" step="1" placeholder={String(TOPO[form.topology]?.pcs||38)} value={form.capex_pcsPerKw} onChange={e=>up("capex_pcsPerKw",e.target.value)}/>
                      <div style={{fontSize:10,color:T.muted,marginTop:2}}>Bidirectional inverter (utility-scale)</div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <label style={labelS}>BMS / EMS ($/kW) <span style={{color:T.steel,fontWeight:400}}>def: $5</span></label>
                      <input style={inputS} type="number" step="1" placeholder="5" value={form.capex_bmsPerKw} onChange={e=>up("capex_bmsPerKw",e.target.value)}/>
                      <div style={{fontSize:10,color:T.muted,marginTop:2}}>SCADA / EMS standalone (cell BMS in container)</div>
                    </div>
                    <div>
                      <label style={labelS}>Civil Works ($/kW) <span style={{color:T.steel,fontWeight:400}}>def: $10</span></label>
                      <input style={inputS} type="number" step="1" placeholder="10" value={form.capex_civilPerKw} onChange={e=>up("capex_civilPerKw",e.target.value)}/>
                      <div style={{fontSize:10,color:T.muted,marginTop:2}}>Foundation, fencing, drainage</div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <label style={labelS}>Electrical BoS ($/kW) <span style={{color:T.steel,fontWeight:400}}>def: $14</span></label>
                      <input style={inputS} type="number" step="1" placeholder="14" value={form.capex_elecPerKw} onChange={e=>up("capex_elecPerKw",e.target.value)}/>
                      <div style={{fontSize:10,color:T.muted,marginTop:2}}>MV switchgear, transformer, cabling</div>
                    </div>
                    <div>
                      <label style={labelS}>GST on Battery <span style={{color:T.steel,fontWeight:400}}>def: 12%</span></label>
                      <input style={inputS} type="number" step="0.5" placeholder="12" value={form.capex_gstPct} onChange={e=>up("capex_gstPct",e.target.value)}/>
                      <div style={{fontSize:10,color:T.muted,marginTop:2}}>Standalone BESS rate (revised 2023)</div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                    <div>
                      <label style={labelS}>Install % <span style={{color:T.steel,fontWeight:400}}>def: 6</span></label>
                      <input style={inputS} type="number" step="0.5" placeholder="6" value={form.capex_installPct} onChange={e=>up("capex_installPct",e.target.value)}/>
                    </div>
                    <div>
                      <label style={labelS}>Engg % <span style={{color:T.steel,fontWeight:400}}>def: 3</span></label>
                      <input style={inputS} type="number" step="0.5" placeholder="3" value={form.capex_engPct} onChange={e=>up("capex_engPct",e.target.value)}/>
                    </div>
                    <div>
                      <label style={labelS}>Contingency % <span style={{color:T.steel,fontWeight:400}}>def: 5</span></label>
                      <input style={inputS} type="number" step="0.5" placeholder="5" value={form.capex_contPct} onChange={e=>up("capex_contPct",e.target.value)}/>
                    </div>
                  </div>
                  {mw>0&&mwh>0&&liveCapex&&(
                    <div style={{background:T.light,borderRadius:6,padding:"8px 11px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:11,color:T.muted}}>Indicative Total CAPEX</span>
                      <span style={{fontSize:13,fontWeight:700,color:T.blue,fontFamily:"'DM Mono',monospace"}}>
                        {fc(liveCapex.total,cur)} &nbsp;·&nbsp; ${liveCapex.perKwh}/kWh
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <SectionHead>OPEX <span style={{fontWeight:400,fontSize:9,textTransform:"none",letterSpacing:0,color:T.muted}}>year-1, escalated 3%/yr CPI-linked</span></SectionHead>
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <label style={labelS}>O&amp;M (₹/kW/yr) <span style={{color:T.steel,fontWeight:400}}>def: ₹415</span></label>
                      <input style={inputS} type="number" step="10" placeholder="415" value={form.opex_omPerKw} onChange={e=>up("opex_omPerKw",e.target.value)}/>
                      <div style={{fontSize:10,color:T.muted,marginTop:2}}>Maintenance, spares, manpower · ₹300–500 range</div>
                    </div>
                    <div>
                      <label style={labelS}>Land Lease (₹/kW/yr) <span style={{color:T.steel,fontWeight:400}}>def: ₹249</span></label>
                      <input style={inputS} type="number" step="10" placeholder="249" value={form.opex_landPerKw} onChange={e=>up("opex_landPerKw",e.target.value)}/>
                      <div style={{fontSize:10,color:T.muted,marginTop:2}}>Annual land lease · enter 0 for owned land</div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <label style={labelS}>Insurance (% CAPEX/yr) <span style={{color:T.steel,fontWeight:400}}>def: 0.4</span></label>
                      <input style={inputS} type="number" step="0.05" placeholder="0.4" value={form.opex_insurancePct} onChange={e=>up("opex_insurancePct",e.target.value)}/>
                      <div style={{fontSize:10,color:T.muted,marginTop:2}}>All-risk property cover · 0.3–0.5% range</div>
                    </div>
                    <div>
                      <label style={labelS}>Asset Mgmt (% CAPEX/yr) <span style={{color:T.steel,fontWeight:400}}>def: 0.2</span></label>
                      <input style={inputS} type="number" step="0.05" placeholder="0.2" value={form.opex_assetMgmtPct} onChange={e=>up("opex_assetMgmtPct",e.target.value)}/>
                      <div style={{fontSize:10,color:T.muted,marginTop:2}}>Third-party mgmt fee · often bundled with O&amp;M</div>
                    </div>
                  </div>
                  {mw>0&&mwh>0&&liveCapex&&(()=>{
                    const kw2=mw*1000;
                    const omV  =(parseFloat(form.opex_omPerKw)||415)*kw2*0.012;
                    const insV =liveCapex.total*(parseFloat(form.opex_insurancePct)||0.4)/100;
                    const lndV =(parseFloat(form.opex_landPerKw)||249)*kw2*0.012;
                    const amV  =liveCapex.total*(parseFloat(form.opex_assetMgmtPct)||0.2)/100;
                    const tot  =omV+insV+lndV+amV;
                    return (
                      <div style={{background:T.bg,borderRadius:7,padding:"10px 12px",marginTop:2}}>
                        <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Year-1 Breakdown</div>
                        {[["O&M",omV],["Insurance",insV],["Land Lease",lndV],["Asset Mgmt",amV]].map(([l,v])=>(
                          <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                            <span style={{fontSize:11,color:T.text,width:80}}>{l}</span>
                            <div style={{flex:1,margin:"0 10px",height:4,background:T.border,borderRadius:2}}>
                              <div style={{width:`${Math.min(100,v/tot*100)}%`,height:"100%",background:T.blue,borderRadius:2}}/>
                            </div>
                            <span style={{fontSize:11,fontWeight:600,color:T.navy,fontFamily:"'DM Mono',monospace",width:76,textAlign:"right"}}>{fc(v,cur)}</span>
                          </div>
                        ))}
                        <div style={{borderTop:`1px solid ${T.border}`,marginTop:7,paddingTop:7,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontSize:12,fontWeight:700,color:T.navy}}>Total / yr</span>
                          <span style={{fontSize:12,fontWeight:700,color:T.blue,fontFamily:"'DM Mono',monospace"}}>
                            {fc(tot,cur)} &nbsp;·&nbsp; ₹{(tot/0.012/mw/1e5).toFixed(1)}L/MW
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </Card>
            </div>

            {/* ROW 3: Financing + Revenue */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>

              <Card>
                <SectionHead>Financing <span style={{fontWeight:400,fontSize:9,textTransform:"none",letterSpacing:0,color:T.muted}}>IFC / PFC / REC norms</span></SectionHead>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <label style={{...labelS,margin:0}}>Debt Ratio</label>
                      <span style={{fontSize:12,fontWeight:700,color:T.blue}}>{Math.round(parseFloat(form.debtRatio||0.7)*100)}%</span>
                    </div>
                    <input type="range" min="0.50" max="0.85" step="0.05" value={form.debtRatio} onChange={e=>up("debtRatio",e.target.value)} style={{width:"100%"}}/>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.muted,marginTop:2}}>
                      <span>50%</span><span>Typical India BESS: 70–75%</span><span>85%</span>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <label style={labelS}>Debt Rate (%)</label>
                      <input style={inputS} type="number" step="0.25" min="7" max="15" placeholder="9.5"
                        value={form.debtRateDisplay!==undefined?form.debtRateDisplay:(parseFloat(form.debtRate||0.095)*100).toFixed(2)}
                        onChange={e=>{up("debtRateDisplay",e.target.value);up("debtRate",(parseFloat(e.target.value)||9.5)/100);}}/>
                      <div style={{fontSize:10,color:T.muted,marginTop:2}}>PFC/REC infra: 9–11%</div>
                    </div>
                    <div>
                      <label style={labelS}>WACC (%)</label>
                      <input style={inputS} type="number" step="0.25" min="6" max="20" placeholder="10.0"
                        value={form.waccDisplay!==undefined?form.waccDisplay:(parseFloat(form.wacc||0.10)*100).toFixed(2)}
                        onChange={e=>{up("waccDisplay",e.target.value);up("wacc",(parseFloat(e.target.value)||10)/100);}}/>
                      <div style={{fontSize:10,color:T.muted,marginTop:2}}>CERC normative: 10–12%</div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <label style={labelS}>Tax Rate (%)</label>
                      <input style={inputS} type="number" step="1" placeholder="25"
                        value={form.taxRateDisplay!==undefined?form.taxRateDisplay:(parseFloat(form.taxRate||0.25)*100).toFixed(0)}
                        onChange={e=>{up("taxRateDisplay",e.target.value);up("taxRate",(parseFloat(e.target.value)||25)/100);}}/>
                    </div>
                    <div>
                      <label style={labelS}>Depreciation (yrs)</label>
                      <input style={inputS} type="number" step="1" placeholder="12" value={form.depnYears} onChange={e=>up("depnYears",e.target.value)}/>
                      <div style={{fontSize:10,color:T.muted,marginTop:2}}>CERC SLM: 12 yrs</div>
                    </div>
                  </div>
                  <div style={{background:form.vgfApplicable?T.greenBg:T.bg,border:`1px solid ${form.vgfApplicable?"#81C784":T.border}`,borderRadius:7,padding:"10px 12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:form.vgfApplicable?8:0}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:form.vgfApplicable?T.green:T.text}}>MoP VGF Support</div>
                        <div style={{fontSize:10,color:T.muted}}>Up to 30% of CAPEX under Phase II</div>
                      </div>
                      <label style={{cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                        <input type="checkbox" checked={form.vgfApplicable} onChange={e=>up("vgfApplicable",e.target.checked)}/>
                        <span style={{fontSize:12,fontWeight:600,color:form.vgfApplicable?T.green:T.muted}}>{form.vgfApplicable?"On":"Off"}</span>
                      </label>
                    </div>
                    {form.vgfApplicable&&(
                      <>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <label style={{...labelS,margin:0}}>VGF %</label>
                          <span style={{fontSize:12,fontWeight:700,color:T.green}}>{Math.round(parseFloat(form.vgfPct||0.30)*100)}%</span>
                        </div>
                        <input type="range" min="0.10" max="0.30" step="0.05" value={form.vgfPct} onChange={e=>up("vgfPct",e.target.value)} style={{width:"100%"}}/>
                        {mw>0&&mwh>0&&liveCapex&&(
                          <div style={{fontSize:11,color:T.green,marginTop:4,fontWeight:600}}>
                            Saving: {fc(liveCapex.total*parseFloat(form.vgfPct||0.30),cur)} &nbsp;·&nbsp; Net CAPEX: {fc(liveCapex.total*(1-parseFloat(form.vgfPct||0.30)),cur)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Card>

              <Card>
                <SectionHead>Revenue Model</SectionHead>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{display:"flex",gap:6}}>
                    {[["capacity","Capacity Charge"],["dispatch","Dispatch / IEX"]].map(([m,l])=>(
                      <button key={m} onClick={()=>up("revenueModel",m)}
                        style={{flex:1,padding:"8px",border:`1.5px solid ${form.revenueModel===m?T.blue:T.border}`,borderRadius:6,background:form.revenueModel===m?T.light:T.white,fontSize:12,fontWeight:600,cursor:"pointer",color:form.revenueModel===m?T.blue:T.muted,fontFamily:"inherit",transition:"all 0.14s"}}>
                        {l}
                      </button>
                    ))}
                  </div>

                  {form.revenueModel==="capacity"&&(
                    <div style={{display:"flex",flexDirection:"column",gap:9}}>
                      <div>
                        <label style={labelS}>Capacity Charge (₹/MW/month)</label>
                        <input style={inputS} type="number" placeholder="e.g. 441000" value={form.capacityChargeINR} onChange={e=>up("capacityChargeINR",e.target.value)}/>
                        <div style={{fontSize:10,color:T.muted,marginTop:3}}>
                          JSW Kerala 2025: ₹4,41,000 &nbsp;·&nbsp; NVVN UP 2026: ₹5,53,000
                          {form.capacityChargeINR&&` · ₹${(parseFloat(form.capacityChargeINR)/1e5).toFixed(2)}L/MW/month`}
                        </div>
                      </div>
                      <div>
                        <label style={labelS}>Electricity Cost for Charging (₹/kWh) <span style={{color:T.amber,fontWeight:600}}>↑ raises LCOS</span></label>
                        <input style={inputS} type="text" inputMode="decimal" placeholder={`e.g. ${(st.gridTariff*0.60).toFixed(1)}`} value={form.chargingTariffINR} onChange={e=>up("chargingTariffINR",e.target.value.replace(/[^0-9.]/g,""))}/>
                        <div style={{fontSize:10,color:T.muted,marginTop:2}}>
                          {form.state} off-peak ≈ ₹{(st.gridTariff*0.60).toFixed(1)} &nbsp;·&nbsp; captive solar ₹2.5–3.5 &nbsp;·&nbsp; grid peak ₹{st.gridTariff}
                          {form.chargingTariffINR&&mw>0&&(()=>{
                            const annCostPerMw = parseFloat(form.chargingTariffINR) * (parseFloat(form.cyclesPerDay)||1) * (parseFloat(form.daysPerYear)||300) * (parseFloat(form.energyMWh||0)/Math.max(parseFloat(form.powerMW||1),1)) * (parseFloat(form.dod)||0.90) / (parseFloat(form.dod)||0.90) * 1000 / mw;
                            return <span style={{color:T.amber,fontWeight:600}}> · ₹{(annCostPerMw/1e5).toFixed(1)}L/MW/yr charging cost</span>;
                          })()}
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        <div>
                          <label style={labelS}>Cycles / Day</label>
                          <input style={inputS} type="number" step="0.5" min="0.5" max="3" value={form.cyclesPerDay} onChange={e=>up("cyclesPerDay",e.target.value)}/>
                        </div>
                        <div>
                          <label style={labelS}>Days / Year</label>
                          <input style={inputS} type="number" min="200" max="365" value={form.daysPerYear} onChange={e=>up("daysPerYear",e.target.value)}/>
                        </div>
                      </div>
                    </div>
                  )}

                  {form.revenueModel==="dispatch"&&(
                    <div style={{display:"flex",flexDirection:"column",gap:9}}>
                      <div>
                        <label style={labelS}>Sell Tariff (₹/kWh) — discharge / IEX price</label>
                        <input style={inputS} type="text" inputMode="decimal" placeholder={`e.g. ${st.peakTariff}`} value={form.sellTariffINR} onChange={e=>up("sellTariffINR",e.target.value.replace(/[^0-9.]/g,""))}/>
                        <div style={{fontSize:10,color:T.muted,marginTop:2}}>
                          {form.state} peak: ₹{st.peakTariff}/kWh &nbsp;·&nbsp; IEX DAM avg: ₹4–6/kWh
                        </div>
                      </div>
                      <div>
                        <label style={labelS}>Electricity Cost for Charging (₹/kWh) <span style={{color:T.amber,fontWeight:600}}>↑ raises LCOS</span></label>
                        <input style={inputS} type="text" inputMode="decimal" placeholder={`e.g. ${(st.gridTariff*0.60).toFixed(1)}`} value={form.chargingTariffINR} onChange={e=>up("chargingTariffINR",e.target.value.replace(/[^0-9.]/g,""))}/>
                        <div style={{fontSize:10,color:T.muted,marginTop:2}}>
                          {form.state} off-peak ≈ ₹{(st.gridTariff*0.60).toFixed(1)} &nbsp;·&nbsp; captive solar ₹2.5–3.5 &nbsp;·&nbsp; grid peak ₹{st.gridTariff}
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        <div>
                          <label style={labelS}>Cycles / Day</label>
                          <input style={inputS} type="number" step="0.5" min="0.5" max="3" value={form.cyclesPerDay} onChange={e=>up("cyclesPerDay",e.target.value)}/>
                        </div>
                        <div>
                          <label style={labelS}>Days / Year</label>
                          <input style={inputS} type="number" min="200" max="365" value={form.daysPerYear} onChange={e=>up("daysPerYear",e.target.value)}/>
                        </div>
                      </div>
                      {form.sellTariffINR&&form.chargingTariffINR&&(
                        <div style={{background:T.light,borderRadius:6,padding:"7px 10px",fontSize:11,color:T.text}}>
                          Net spread: ₹{(parseFloat(form.sellTariffINR)-parseFloat(form.chargingTariffINR)).toFixed(1)}/kWh
                          &nbsp;·&nbsp; ${((parseFloat(form.sellTariffINR)-parseFloat(form.chargingTariffINR))/83).toFixed(3)}/kWh
                        </div>
                      )}
                    </div>
                  )}

                  {mw>0&&mwh>0&&liveLCOS>0&&liveCapex&&(()=>{
                    const chargeT = (form.chargingTariffINR!==""&&form.chargingTariffINR!==undefined?parseFloat(form.chargingTariffINR)/83:st.gridTariff*0.60/83);
                    const vgf2    = form.vgfApplicable ? parseFloat(form.vgfPct||0.30) : 0;
                    const eCap    = liveCapex.total*(1-vgf2);
                    const wacc2   = parseFloat(form.wacc)||0.10;
                    const life2   = parseInt(form.projectLife)||20;
                    const crf     = (wacc2*Math.pow(1+wacc2,life2))/(Math.pow(1+wacc2,life2)-1);
                    const annCapex= eCap*crf;
                    const cpd2    = parseFloat(form.cyclesPerDay)||1;
                    const dpy2    = parseFloat(form.daysPerYear)||300;
                    const dod2    = parseFloat(form.dod)||0.90;
                    const annMwhD = cpd2*dpy2*mwh*dod2*ch.efficiency;
                    const chrgComp= annMwhD>0 ? (annMwhD/ch.efficiency)*1000*chargeT/annMwhD : 0;
                    const capxComp= annMwhD>0 ? annCapex/annMwhD : 0;
                    const opexComp= annMwhD>0 ? liveCapex.opex/annMwhD : 0;
                    const total3  = chrgComp+capxComp+opexComp;
                    return (
                      <div style={{background:T.navy,borderRadius:8,padding:"12px 14px",marginTop:2}}>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:4}}>Indicative LCOS</div>
                        <div style={{fontSize:22,fontWeight:700,color:"#fff",fontFamily:"'DM Mono',monospace",marginBottom:6}}>{fl(liveLCOS,cur)}</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",marginBottom:10}}>
                          ₹{(liveLCOS/0.012/1000).toFixed(2)}/kWh &nbsp;·&nbsp; ${liveLCOS.toFixed(1)}/MWh &nbsp;·&nbsp; {vgf2>0?`VGF ${Math.round(vgf2*100)}% applied`:"No VGF"}
                        </div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Cost drivers (yr-1 approx)</div>
                        {[
                          ["Charging cost",chrgComp,"#F59E0B"],
                          ["CAPEX annuity",capxComp,"#60A5FA"],
                          ["OPEX",opexComp,"#86EFAC"],
                        ].map(([l,v,col])=>(
                          <div key={l} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                            <span style={{fontSize:10,color:"rgba(255,255,255,0.6)",width:90}}>{l}</span>
                            <div style={{flex:1,height:5,background:"rgba(255,255,255,0.1)",borderRadius:3}}>
                              <div style={{width:`${Math.min(100,v/total3*100)}%`,height:"100%",background:col,borderRadius:3}}/>
                            </div>
                            <span style={{fontSize:10,fontWeight:600,color:col,width:60,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>${v.toFixed(1)}/MWh</span>
                          </div>
                        ))}
                        <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:6}}>
                          Charging is {total3>0?Math.round(chrgComp/total3*100):0}% of LCOS — lower buy rate = lower LCOS directly
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </Card>
            </div>

            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <BtnGhost onClick={()=>setStep(1)}>Back</BtnGhost>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                {(!form.powerMW||!form.energyMWh)&&<span style={{fontSize:11,color:T.amber}}>Enter MW and MWh to continue</span>}
                <BtnPrimary onClick={async()=>{ if(!canCreateProject)return; await generate(); await refreshProfile(); }} disabled={!form.powerMW||!form.energyMWh||!canCreateProject}>Generate Full Analysis</BtnPrimary>
              </div>
            </div>
          </div>
        )}


        {/* ── STEP 3 ── */}
        {step===3&&res&&(
          <div className="fade">
            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10,marginBottom:16}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:3}}>
                  <div style={{fontSize:18,fontWeight:700,color:T.navy}}>{res.form.projectName||"BESS Project"}</div>
                  {/* Bankability grade badge */}
                  <div style={{background:gradeBg(res.bank.grade),color:gradeColor(res.bank.grade),padding:"3px 12px",borderRadius:12,fontSize:12,fontWeight:700}}>
                    Grade {res.bank.grade} — {res.bank.score}/100
                  </div>
                </div>
                <div style={{fontSize:12,color:T.muted}}>{res.form.powerMW} MW / {res.form.energyMWh} MWh · {CHEM[res.form.chemistry]?.label} · {res.form.state} · {res.form.application}</div>
              </div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                <BtnOutline onClick={()=>saveProject()}>Save Project</BtnOutline>
                <BtnOutline onClick={()=>exportCSV(res,res.form)}>Export CSV</BtnOutline>
                <BtnOutline onClick={()=>canExportPDF?exportPDF(res,res.form):setShowPDFGate(true)} style={{fontWeight:700,borderColor:"#1B4F8A",color:"#1B4F8A",position:"relative"}}>
                  Generate Report {!canExportPDF&&<span style={{fontSize:9,background:"#F59E0B",color:"#fff",padding:"1px 5px",borderRadius:3,marginLeft:4,fontWeight:700}}>PRO</span>}
                </BtnOutline>
                <BtnGhost onClick={()=>{ if(res?.form) setForm(res.form); setStep(2); }}>Edit Parameters</BtnGhost>
                <BtnGhost onClick={()=>{setResult(null);setForm(defaultForm());setStep(1);setTenderContext(null);}}>New Project</BtnGhost>
              </div>
            </div>

            {/* VGF banner */}
            {res.vgfSaving>0&&(
              <div style={{background:T.greenBg,border:`1px solid #81C784`,borderRadius:7,padding:"9px 14px",marginBottom:12,fontSize:12,color:T.green,display:"flex",justifyContent:"space-between"}}>
                <span><strong>VGF Applied:</strong> {fc(res.vgfSaving,cur)} CAPEX reduction ({pct(parseFloat(res.form.vgfPct))}). Effective developer CAPEX: {fc(res.totalCap*(1-parseFloat(res.form.vgfPct)),cur)}</span>
              </div>
            )}

            {/* KPI strip — 6 cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:9,marginBottom:14}}>
              {[
                ["Total CAPEX",    fc(res.totalCap,cur)],
                ["LCOS",           cur==="INR"?fl(res.lcos,"INR"):cur==="EUR"?fl(res.lcos,"EUR"):fl(res.lcos,"USD")],
                ["Equity IRR",     `${res.dcf.irr}%`],
                ["Min DSCR",       `${res.dcf.minDSCR}x`],
                ["Payback",        res.dcf.payback?`${res.dcf.payback} yr`:"N/R"],
                ["Viable Tariff",  cur==="INR"?`₹${fmn(res.monthlyTariff)}/MW`:cur==="EUR"?`€${fmn(Math.round(res.monthlyTariff*0.012*0.92))}/MW`:`$${fmn(Math.round(res.monthlyTariff*0.012))}/MW`],
              ].map(([l,v])=>(
                <div key={l} style={{background:T.white,borderRadius:8,border:`1px solid ${T.border}`,padding:"12px 13px"}}>
                  <div style={{fontSize:16,fontWeight:700,color:T.navy,fontFamily:"'DM Mono',monospace",marginBottom:3}}>{v}</div>
                  <div style={{fontSize:9,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
                </div>
              ))}
            </div>

            {/* Underbid warning */}
            {res.lcos > 0 && res.dcf.irr < 10 && (
              <div style={{background:T.redBg,border:`1px solid #FFAAAA`,borderRadius:7,padding:"10px 14px",marginBottom:12,fontSize:12,color:T.red}}>
                <strong>Underbid Risk:</strong> Equity IRR of {res.dcf.irr}% is below the lender minimum threshold of 10%. This project may not achieve financial close at current revenue assumptions. Use the Bid Optimiser tab to find a viable tariff floor.
              </div>
            )}

            {/* Tab bar */}
            <div style={{display:"flex",gap:0,marginBottom:14,borderBottom:`2px solid ${T.border}`}}>
              {[["lcos","LCOS"],["capex","CAPEX"],["bankability","Bankability"],["dcf","DCF / IRR"],["sensitivity","Sensitivity"],["bid","Bid Optimiser"],["equipment","BOQ"],["risks","Risks"]].map(([t,l])=>(
                <button key={t} onClick={()=>setActiveTab(t)}
                  style={{padding:"8px 14px",border:"none",borderBottom:`2px solid ${activeTab===t?T.blue:"transparent"}`,marginBottom:-2,background:"transparent",fontSize:12,fontWeight:activeTab===t?600:400,color:activeTab===t?T.blue:T.muted,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                  {l}
                </button>
              ))}
            </div>

            {/* ── LCOS Tab ── */}
            {activeTab==="lcos"&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}} className="fade">
                <Card>
                  <div style={{fontWeight:600,fontSize:13,color:T.navy,marginBottom:14}}>LCOS Inputs — PNNL Methodology</div>
                  {[
                    ["Effective CAPEX (post-VGF)", fc(res.totalCap*(1-parseFloat(res.form.vgfPct||0)),cur)],
                    ["Annual OPEX (yr 1)",          fc(res.opex,cur)],
                    ["  · O&M",                     `₹${res.opexBreak?.omINR||415}/kW/yr`],
                    ["  · Insurance",               `${res.opexBreak?.insPct||0.4}% of CAPEX`],
                    ["  · Land Lease",              `₹${res.opexBreak?.landINR||249}/kW/yr`],
                    ["  · Asset Mgmt",              `${res.opexBreak?.amPct||0.2}% of CAPEX`],
                    ["OPEX Escalation",             "3%/yr (CPI-linked)"],
                    ["WACC",                       pct(parseFloat(res.form.wacc))],
                    ["Project Life",               `${parseInt(res.form.projectLife)||20} years`],
                    ["Charging Tariff",            `₹${parseFloat(res.form.chargingTariffINR||0).toFixed(1)}/kWh ($${(parseFloat(res.form.chargingTariffINR||0)/83).toFixed(3)}/kWh)`],
                    ["Degradation (calendar)",     `${(ch.calDeg*100).toFixed(0)}%/yr`],
                    ["Degradation (cycle)",        `${(ch.cycleDeg*1000).toFixed(2)} per cycle`],
                    ["Augmentation (every 5yr)",   "2% of effective CAPEX"],
                    ["Battery Replacement (yr 15+)","15% of effective CAPEX (20yr+ projects)"],
                    ["Depth of Discharge",         pct(parseFloat(res.form.dod))],
                    ["Round-trip Efficiency",       pct(ch.efficiency)],
                    ["Annual Cycles",              `${fmn((parseFloat(res.form.cyclesPerDay)||1)*(parseFloat(res.form.daysPerYear)||300))}`],
                  ].map(([k,v])=><Row key={k} label={k} value={v} mono/>)}
                  <div style={{marginTop:14,padding:"12px 14px",background:T.navy,borderRadius:7,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{color:"rgba(255,255,255,0.6)",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Levelised Cost of Storage</span>
                    <div style={{textAlign:"right"}}>
                      <div style={{color:"#fff",fontSize:20,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{fl(res.lcos,cur)}</div>
                      {cur!=="INR"&&<div style={{color:"rgba(255,255,255,0.5)",fontSize:11}}>₹{(res.lcos*0.012/1000).toFixed(2)}/kWh</div>}
                    </div>
                  </div>
                </Card>
                <Card>
                  <div style={{fontWeight:600,fontSize:13,color:T.navy,marginBottom:14}}>LCOS vs. India Market Benchmarks</div>
                  {[
                    ["This Project",             res.lcos,    T.blue],
                    ["Ember Oct 2025 (global)",  65,          T.green],
                    ["India VGF tender (2024)",  80,          "#558B2F"],
                    ["India no-VGF (2024)",      115,         T.amber],
                    ["BNEF 2024 (equip only)",   165,         T.muted],
                  ].map(([label,val,color])=>(
                    <div key={label} style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:12,color:T.muted,fontWeight:label==="This Project"?700:400}}>{label}</span>
                        <span style={{fontSize:12,fontFamily:"'DM Mono',monospace",fontWeight:600,color}}>{fl(val,cur)}</span>
                      </div>
                      <div style={{background:T.bg,borderRadius:3,height:5,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${Math.min((val/Math.max(res.lcos,165))*100,100)}%`,background:color,borderRadius:3}}/>
                      </div>
                    </div>
                  ))}
                  <div style={{marginTop:14,background:T.bg,borderRadius:7,padding:"10px 12px",fontSize:11,color:T.muted,lineHeight:1.7}}>
                    <strong style={{color:T.text}}>Viable monthly tariff:</strong> ₹{fmn(res.monthlyTariff)}/MW/month<br/>
                    JSW Kerala 2025: ₹4,41,000 · NVVN UP 2026: ₹5,53,000<br/>
                    <span style={{color:res.lcos<75?T.green:res.lcos<110?T.amber:T.red,fontWeight:600}}>
                      {res.lcos<75?"LCOS is competitive — within India 2025 VGF-supported range ($55–75/MWh).":res.lcos<110?"LCOS is above typical VGF range — review CAPEX assumptions or VGF eligibility.":"LCOS above India benchmark — significant cost reduction or higher tariff needed."}
                    </span>
                  </div>
                </Card>
              </div>
            )}

            {/* ── CAPEX Tab ── */}
            {activeTab==="capex"&&(
              <Card className="fade">
                <div style={{fontWeight:600,color:T.navy,fontSize:13,marginBottom:18}}>Capital Expenditure Breakdown</div>
                {capexEntries.map((e,i)=>(
                  <div key={i} style={{marginBottom:13}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:13,color:T.muted}}>{e.label}</span>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <span style={{fontSize:11,color:T.muted,fontFamily:"'DM Mono',monospace"}}>{cur==="INR"?`₹${((e.value/0.012)/1e7).toFixed(2)} Cr`:cur==="EUR"?`€${fmn(e.value/0.92)}`:""}</span>
                        <span style={{fontSize:13,fontFamily:"'DM Mono',monospace",fontWeight:600,color:T.text}}>{fc(e.value,cur)}</span>
                      </div>
                    </div>
                    <div style={{background:T.bg,borderRadius:3,height:6,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${(e.value/maxCap)*100}%`,background:e.color,borderRadius:3,transition:"width 0.8s ease"}}/>
                    </div>
                    <div style={{fontSize:10,color:"#9BADC7",marginTop:2}}>{res.totalCap>0?((e.value/res.totalCap)*100).toFixed(1):0}%</div>
                  </div>
                ))}
                <div style={{height:1,background:T.border,margin:"14px 0"}}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Total CAPEX</div>
                    {res.vgfSaving>0&&<div style={{fontSize:11,color:T.green}}>Post-VGF: {fc(res.totalCap*(1-parseFloat(res.form.vgfPct||0)),cur)}</div>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:20,fontWeight:700,color:T.blue,fontFamily:"'DM Mono',monospace"}}>{fc(res.totalCap,cur)}</div>
                    {cur!=="INR"&&<div style={{fontSize:11,color:T.muted,fontFamily:"'DM Mono',monospace"}}>₹{((res.totalCap/0.012)/1e7).toFixed(2)} Cr</div>}
                  </div>
                </div>
              </Card>
            )}

            {/* ── Bankability Tab ── */}
            {activeTab==="bankability"&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}} className="fade">
                <Card>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <div style={{fontWeight:600,fontSize:13,color:T.navy}}>Bankability Scorecard</div>
                    <div style={{width:44,height:44,borderRadius:"50%",background:gradeBg(res.bank.grade),border:`2px solid ${gradeColor(res.bank.grade)}`,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}>
                      <div style={{fontSize:16,fontWeight:700,color:gradeColor(res.bank.grade)}}>{res.bank.grade}</div>
                    </div>
                  </div>
                  <div style={{fontSize:11,color:T.muted,marginBottom:14}}>Based on PFC / REC / SBI Project Finance lending norms for BESS infrastructure.</div>
                  {res.bank.checks.map((c,i)=>(
                    <div key={i} className="rh" style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${T.border}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:9}}>
                        <div style={{width:18,height:18,borderRadius:"50%",background:c.pass?T.greenBg:T.redBg,border:`1.5px solid ${c.pass?T.green:T.red}`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:c.pass?T.green:T.red}}>{c.pass?"✓":"✗"}</div>
                        <span style={{fontSize:12,color:T.text}}>{c.label} <span style={{fontSize:10,color:T.muted}}>({c.weight}pts)</span></span>
                      </div>
                      <span style={{fontSize:12,fontFamily:"'DM Mono',monospace",fontWeight:700,color:c.pass?T.green:T.red}}>{c.val}</span>
                    </div>
                  ))}
                  <div style={{marginTop:14,padding:"10px 12px",background:gradeBg(res.bank.grade),borderRadius:7,border:`1px solid ${gradeColor(res.bank.grade)}22`}}>
                    <div style={{fontSize:11,fontWeight:700,color:gradeColor(res.bank.grade),marginBottom:3}}>Score: {res.bank.score}/100 — Grade {res.bank.grade}</div>
                    <div style={{fontSize:11,color:T.muted}}>{res.bank.grade==="A"?"Strongly bankable. Suitable for PFC/REC project finance at standard terms.":res.bank.grade==="B"?"Bankable with conditions. Address failing metrics before lender submission.":res.bank.grade==="C"?"Marginal bankability. Significant restructuring needed — increase VGF or tariff.":"Not bankable at current structure. Project requires fundamental revision."}</div>
                  </div>
                </Card>

                <Card>
                  <div style={{fontWeight:600,fontSize:13,color:T.navy,marginBottom:14}}>Year-by-Year DSCR Profile</div>
                  <div style={{fontSize:11,color:T.muted,marginBottom:12}}>Min DSCR: <strong style={{color:res.dcf.minDSCR>=1.30?T.green:T.red}}>{res.dcf.minDSCR}x</strong> &nbsp;|&nbsp; Avg DSCR: <strong style={{color:res.dcf.avgDSCR>=1.50?T.green:T.amber}}>{res.dcf.avgDSCR}x</strong> &nbsp;|&nbsp; Lender min: 1.30x</div>
                  <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:340,overflowY:"auto"}}>
                    {res.dcf.rows.map(row=>(
                      <div key={row.yr} style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:10,color:T.muted,minWidth:30,fontFamily:"'DM Mono',monospace"}}>Y{row.yr}</span>
                        <div style={{flex:1,background:T.bg,borderRadius:3,height:14,overflow:"hidden",position:"relative"}}>
                          <div style={{height:"100%",width:`${Math.min((row.dscr/3)*100,100)}%`,background:row.dscr>=1.30?T.green:row.dscr>=1.00?T.amber:T.red,borderRadius:3}}/>
                          <div style={{position:"absolute",left:"43%",top:0,height:"100%",width:1.5,background:"rgba(0,0,0,0.15)"}}/>
                        </div>
                        <span style={{fontSize:10,fontFamily:"'DM Mono',monospace",fontWeight:600,color:row.dscr>=1.30?T.green:row.dscr>=1.00?T.amber:T.red,minWidth:34}}>{row.dscr.toFixed(2)}x</span>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:10,fontSize:10,color:T.muted}}>Green ≥ 1.30x · Amber 1.00–1.30x · Red &lt; 1.00x &nbsp;|&nbsp; Marker at 1.30x lender threshold</div>
                </Card>
              </div>
            )}

            {/* ── DCF Tab ── */}
            {activeTab==="dcf"&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}} className="fade">
                <Card>
                  <div style={{fontWeight:600,fontSize:13,color:T.navy,marginBottom:14}}>DCF Model — IFC / REC Methodology</div>
                  {[
                    ["Total CAPEX",           fc(res.totalCap,cur)],
                    ["VGF Support",           res.vgfSaving>0?fc(res.vgfSaving,cur):"Not applied"],
                    ["Developer Equity",      fc(res.dcf.equity,cur)],
                    ["Project Debt",          fc(res.dcf.debt,cur)],
                    ["Debt Ratio",            pct(parseFloat(res.form.debtRatio))],
                    ["Debt Rate",             pct(parseFloat(res.form.debtRate))],
                    ["WACC",                  pct(parseFloat(res.form.wacc))],
                    ["Annual Revenue",        fc(res.revenue,cur)],
                    ["Annual OPEX",           fc(res.opex,cur)],
                    ["Tax Rate",              pct(parseFloat(res.form.taxRate))],
                    ["Depreciation (SLM)",    `${res.form.depnYears} yrs`],
                    ["Project NPV",           fc(res.dcf.npv,cur), null, res.dcf.npv>=0?T.green:T.red],
                    ["Equity IRR",            `${res.dcf.irr}%`, null, res.dcf.irr>=12?T.green:res.dcf.irr>=8?T.amber:T.red],
                    ["Equity Payback",        res.dcf.payback?`${res.dcf.payback} years`:"Not recovered"],
                  ].map(([k,v,,c])=><Row key={k} label={k} value={v} mono bold={!!c} color={c}/>)}
                </Card>
                <Card>
                  <div style={{fontWeight:600,fontSize:13,color:T.navy,marginBottom:14}}>Annual Cashflow Summary</div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead><tr style={{background:T.bg}}>
                        {["Yr","Revenue","OPEX","Charging","EBITDA","Interest","Tax","FCFE","DSCR"].map(h=>(
                          <th key={h} style={{padding:"7px 8px",textAlign:"right",color:T.muted,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {res.dcf.rows.map(row=>(
                          <tr key={row.yr} style={{borderTop:`1px solid ${T.border}`}}>
                            <td style={{padding:"6px 8px",fontFamily:"'DM Mono',monospace",color:T.muted,textAlign:"right",fontSize:10}}>{row.yr}</td>
                            {[row.rev, row.opxI, row.chrgI, row.ebitda, row.int, row.taxAmt, row.fcfe].map((v,i)=>(
                              <td key={i} style={{padding:"6px 8px",fontFamily:"'DM Mono',monospace",textAlign:"right",fontSize:10,color:i===3||i===6?(v>=0?T.green:T.red):i===2?T.amber:T.text}}>{fc(v,cur)}</td>
                            ))}
                            <td style={{padding:"6px 8px",fontFamily:"'DM Mono',monospace",textAlign:"right",fontSize:10,fontWeight:600,color:row.dscr>=1.30?T.green:row.dscr>=1.00?T.amber:T.red}}>{row.dscr.toFixed(2)}x</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* ── Sensitivity Tab ── */}
            {activeTab==="sensitivity"&&(
              <Card className="fade">
                <div style={{fontWeight:600,fontSize:13,color:T.navy,marginBottom:6}}>Tornado Chart — LCOS Sensitivity (±20% variation)</div>
                <div style={{fontSize:11,color:T.muted,marginBottom:18}}>Each bar shows the LCOS range when the input is varied ±20%. Wider bars = higher impact on project economics.</div>
                {res.sensi.map((s,i)=>{
                  const total=Math.max(...res.sensi.map(x=>x.swing),1);
                  const loW=Math.abs(s.base-s.lo), hiW=Math.abs(s.hi-s.base);
                  const maxW=Math.max(loW,hiW,1);
                  return (
                    <div key={i} style={{marginBottom:16}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{fontSize:12,color:T.text,fontWeight:500}}>{s.label}</span>
                        <div style={{display:"flex",gap:12,fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                          <span style={{color:T.green}}>−20%: {fl(s.lo,cur)}</span>
                          <span style={{color:T.muted}}>Base: {fl(s.base,cur)}</span>
                          <span style={{color:T.red}}>+20%: {fl(s.hi,cur)}</span>
                          <span style={{color:T.text,fontWeight:700}}>Swing: {fl(s.swing,cur)}</span>
                        </div>
                      </div>
                      <div style={{position:"relative",height:16,background:T.bg,borderRadius:4,overflow:"hidden"}}>
                        <div style={{position:"absolute",left:`${50-(loW/total)*50}%`,width:`${(s.swing/total)*100}%`,height:"100%",background:i===0?T.blue:i===1?T.mid:i===2?T.steel:"#82B4E0",borderRadius:4}}/>
                        <div style={{position:"absolute",left:"50%",top:0,height:"100%",width:1.5,background:"rgba(0,0,0,0.15)"}}/>
                      </div>
                      <div style={{fontSize:9,color:T.muted,marginTop:2}}>{((s.swing/s.base)*100).toFixed(1)}% LCOS variation</div>
                    </div>
                  );
                })}
                <div style={{marginTop:14,background:T.light,borderRadius:7,padding:"10px 12px",fontSize:11,color:T.muted,lineHeight:1.7}}>
                  <strong style={{color:T.text}}>Key insight:</strong> The top driver of LCOS for this project is <strong>{res.sensi[0]?.label}</strong> (swing: {fl(res.sensi[0]?.swing,cur)}). Focus procurement and negotiation on this parameter for maximum cost reduction.
                </div>
              </Card>
            )}

            {/* ── Bid Optimiser Tab ── */}
            {activeTab==="bid"&&(
              <div className="fade">
                <Card style={{marginBottom:12}}>
                  <div style={{fontWeight:600,fontSize:13,color:T.navy,marginBottom:6}}>Bid Optimiser — Back-solve Viable CAPEX & VGF Combinations</div>
                  <div style={{fontSize:11,color:T.muted,marginBottom:14}}>Enter your target bid tariff. The optimiser maps all CAPEX reduction + VGF combinations that achieve IRR ≥ 10%, Min DSCR ≥ 1.20x, and Payback ≤ 15 years at that tariff.</div>
                  <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
                    <div style={{flex:1}}>
                      <label style={labelS}>Target Bid Tariff (₹/MW/month)</label>
                      <input style={inputS} type="number" placeholder="e.g. 219001" value={bidTarget} onChange={e=>setBidTarget(e.target.value)}/>
                      <div style={{fontSize:10,color:T.muted,marginTop:3}}>LCOS-viable (India 2025): ~₹4–6L/MW/month · Rajasthan 2024 low bid: ₹2.19L (below cost recovery)</div>
                    </div>
                    <BtnPrimary onClick={runBidOptimiser} disabled={!bidTarget}>Run Optimiser</BtnPrimary>
                  </div>
                </Card>

                {bidResults&&(
                  <Card>
                    <div style={{fontWeight:600,fontSize:13,color:T.navy,marginBottom:14}}>
                      Optimisation Results — Target: ₹{fmn(parseFloat(bidTarget))}/MW/month
                      <span style={{fontSize:11,fontWeight:400,color:T.muted,marginLeft:10}}>
                        {bidResults.filter(r=>r.viable).length} viable combinations found
                      </span>
                    </div>
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr style={{background:T.bg}}>
                          {["VGF %","CAPEX vs Base","Effective CAPEX","LCOS","IRR","Min DSCR","Payback","Viable"].map(h=>(
                            <th key={h} style={{padding:"8px 10px",textAlign:"left",color:T.muted,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {bidResults.filter((_,i)=>i<20).map((r,i)=>(
                            <tr key={i} className="rh" style={{borderTop:`1px solid ${T.border}`,background:r.viable?T.greenBg:"transparent"}}>
                              <td style={{padding:"8px 10px",fontFamily:"'DM Mono',monospace",fontWeight:600}}>{r.vgf}%</td>
                              <td style={{padding:"8px 10px",fontFamily:"'DM Mono',monospace",color:r.capexMult<=100?T.green:T.red}}>{r.capexMult}%</td>
                              <td style={{padding:"8px 10px",fontFamily:"'DM Mono',monospace"}}>{fc(r.cap,cur)}</td>
                              <td style={{padding:"8px 10px",fontFamily:"'DM Mono',monospace"}}>{fl(r.lcos,cur)}</td>
                              <td style={{padding:"8px 10px",fontFamily:"'DM Mono',monospace",fontWeight:600,color:r.irr>=12?T.green:r.irr>=10?T.amber:T.red}}>{r.irr}%</td>
                              <td style={{padding:"8px 10px",fontFamily:"'DM Mono',monospace",color:r.dscr>=1.30?T.green:r.dscr>=1.20?T.amber:T.red}}>{r.dscr}x</td>
                              <td style={{padding:"8px 10px",fontFamily:"'DM Mono',monospace"}}>{r.payback??'N/R'} yr</td>
                              <td style={{padding:"8px 10px"}}>
                                <span style={{background:r.viable?T.greenBg:T.redBg,color:r.viable?T.green:T.red,padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700}}>{r.viable?"Viable":"No"}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{marginTop:12,fontSize:11,color:T.muted}}>
                      Viable = IRR ≥ 10% AND Min DSCR ≥ 1.20x AND Payback ≤ 15yr. Green rows meet all criteria. CAPEX reduction from base reflects procurement savings, localisation, or value engineering required.
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ── BOQ Tab ── */}
            {activeTab==="equipment"&&(
              <Card className="fade">
                <div style={{fontWeight:600,color:T.navy,fontSize:13,marginBottom:14}}>Equipment Bill of Quantities</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr style={{background:T.bg}}>
                      {["No.","Equipment","Specification","Qty","Unit","Unit Cost","Total"].map(h=>(
                        <th key={h} style={{padding:"8px 11px",textAlign:"left",color:T.muted,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {res.equip.map((e,i)=>(
                        <tr key={i} className="rh" style={{borderTop:`1px solid ${T.border}`}}>
                          <td style={{padding:"8px 11px",color:"#9BADC7",fontFamily:"'DM Mono',monospace",fontSize:10}}>{String(i+1).padStart(2,"0")}</td>
                          <td style={{padding:"8px 11px",fontWeight:600,color:T.navy}}>{e.item}</td>
                          <td style={{padding:"8px 11px",color:T.muted,fontSize:11}}>{e.spec}</td>
                          <td style={{padding:"8px 11px",fontFamily:"'DM Mono',monospace"}}>{e.qty}</td>
                          <td style={{padding:"8px 11px",color:T.muted}}>{e.unit}</td>
                          <td style={{padding:"8px 11px",fontFamily:"'DM Mono',monospace",color:T.muted}}>{fc(e.uc,cur)}</td>
                          <td style={{padding:"8px 11px",fontFamily:"'DM Mono',monospace",fontWeight:700,color:T.blue}}>{fc(e.qty*e.uc,cur)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* ── Risks Tab ── */}
            {activeTab==="risks"&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}} className="fade">
                <Card>
                  <div style={{fontWeight:600,color:T.navy,fontSize:13,marginBottom:4}}>Key Project Risks</div>
                  <div style={{fontSize:11,color:T.muted,marginBottom:14}}>{res.form.application} · {res.form.state}</div>
                  {res.risks.map((r,i)=>(
                    <div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:`1px solid ${T.border}`}}>
                      <div style={{minWidth:20,height:20,background:T.redBg,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:T.red,fontWeight:700}}>R{i+1}</div>
                      <span style={{fontSize:12,color:T.muted,lineHeight:1.6}}>{r}</span>
                    </div>
                  ))}
                </Card>
                <Card>
                  <div style={{fontWeight:600,color:T.navy,fontSize:13,marginBottom:4}}>Recommendations</div>
                  <div style={{fontSize:11,color:T.muted,marginBottom:14}}>{CHEM[res.form.chemistry]?.label.split("(")[0].trim()}</div>
                  {res.recs.map((r,i)=>(
                    <div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:`1px solid ${T.border}`}}>
                      <div style={{minWidth:20,height:20,background:T.greenBg,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:T.green,fontWeight:700}}>{i+1}</div>
                      <span style={{fontSize:12,color:T.muted,lineHeight:1.6}}>{r}</span>
                    </div>
                  ))}
                </Card>
              </div>
            )}

            <div style={{marginTop:14,padding:"10px 14px",background:T.bg,borderRadius:7,fontSize:10,color:"#9BADC7",border:`1px solid ${T.border}`,textAlign:"center"}}>
              LCOS per PNNL/World Bank methodology. CAPEX per Ember Oct 2025 benchmark. Bankability per PFC/REC/SBI project finance norms. Indicative ±15–20%. Obtain lender's IE report before financial close.
            </div>

            {/* Bottom navigation — mirrors Step 2 layout */}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:10}}>
              <BtnGhost onClick={()=>{ if(res?.form) setForm(res.form); setStep(2); }}>Back</BtnGhost>
              <BtnGhost onClick={()=>{setResult(null);setForm(defaultForm());setStep(1);setTenderContext(null);}}>New Project</BtnGhost>
            </div>
          </div>
        )}
        </>}
      </div>
      {showPDFGate && <PDFGate onClose={()=>setShowPDFGate(false)}/>}
    </div>
  );
}
