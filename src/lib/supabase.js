import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Fetch available dates ─────────────────────────────────────────────────
export async function fetchAvailableDates() {
  const { data, error } = await supabase
    .from("power_daily_summary")
    .select("data_date")
    .order("data_date", { ascending: false });
  if (error) throw error;
  return data.map((r) => r.data_date);
}

// ── Fetch daily summary history (for trend charts) ────────────────────────
export async function fetchSummaryHistory(days = 30) {
  const { data, error } = await supabase
    .from("power_daily_summary")
    .select("*")
    .order("data_date", { ascending: true })
    .limit(days);
  if (error) throw error;
  return data;
}

// ── Fetch hourly generation for a date ───────────────────────────────────
export async function fetchHourlyGeneration(date) {
  const { data, error } = await supabase
    .from("power_generation")
    .select("hour, source, value_mw")
    .eq("data_date", date)
    .order("hour");
  if (error) throw error;

  // Pivot: { hour -> { SOLAR: x, WIND: x, ... } }
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const sources = ["SOLAR", "WIND", "THERMAL", "HYDRO", "NUCLEAR", "GAS"];
  const pivot = {};
  hours.forEach((h) => {
    pivot[h] = { hour: h };
  });
  data.forEach((r) => {
    if (!pivot[r.hour]) pivot[r.hour] = { hour: r.hour };
    pivot[r.hour][r.source] = r.value_mw;
  });
  return {
    rows: Object.values(pivot).sort((a, b) => a.hour - b.hour),
    sources,
  };
}

// ── Fetch hourly demand for a date ────────────────────────────────────────
export async function fetchHourlyDemand(date) {
  const { data, error } = await supabase
    .from("power_demand")
    .select("hour, value_mw")
    .eq("data_date", date)
    .order("hour");
  if (error) throw error;
  return data;
}

// ── Fetch state RE data ───────────────────────────────────────────────────
export async function fetchStateRE(date) {
  const { data, error } = await supabase
    .from("power_re_state")
    .select("*")
    .eq("data_date", date)
    .order("total_mu", { ascending: false });
  if (error) throw error;
  return data;
}

// ── Fetch daily summary for one date ─────────────────────────────────────
export async function fetchDailySummary(date) {
  const { data, error } = await supabase
    .from("power_daily_summary")
    .select("*")
    .eq("data_date", date)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}

// ── Upload CSV data (called from uploader UI) ─────────────────────────────
export async function uploadGenerationData(date, rows) {
  const records = rows.map((r) => ({
    data_date: date,
    hour: r.hour,
    source: r.source,
    value_mw: r.value_mw,
  }));
  const { error } = await supabase
    .from("power_generation")
    .upsert(records, { onConflict: "data_date,hour,source" });
  if (error) throw error;
}

export async function uploadDemandData(date, rows) {
  const records = rows.map((r) => ({
    data_date: date,
    hour: r.hour,
    value_mw: r.value_mw,
  }));
  const { error } = await supabase
    .from("power_demand")
    .upsert(records, { onConflict: "data_date,hour" });
  if (error) throw error;
}

export async function uploadStateREData(date, rows) {
  const records = rows.map((r) => ({ ...r, data_date: date }));
  const { error } = await supabase
    .from("power_re_state")
    .upsert(records, { onConflict: "data_date,state" });
  if (error) throw error;
}

export async function upsertDailySummary(summary) {
  const { error } = await supabase
    .from("power_daily_summary")
    .upsert(summary, { onConflict: "data_date" });
  if (error) throw error;
}
