// Shared utilities for all API routes — Node.js runtime
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
);

// IST helpers
export const nowIST = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000);
export const todayIST = () => nowIST().toISOString().split("T")[0];

export function currentSnapshot() {
  const h = nowIST().getUTCHours();
  return `${String(h).padStart(2, "0")}:00`;
}

// NPP public report URL builder
export function nppUrl(date, reportNum, fmt = "xls") {
  const [y, m, d] = date.split("-");
  return `https://npp.gov.in/public-reports/cea/daily/dgr/${d}-${m}-${y}/dgr${reportNum}-${date}.${fmt}`;
}

// Log every cron run to fetch_log table
export async function logRun({
  snapshot,
  status,
  sources = [],
  rows = 0,
  error = null,
  ms = 0,
}) {
  try {
    await supabase.from("fetch_log").insert({
      snapshot,
      status,
      sources,
      rows_written: rows,
      error_msg: error,
      duration_ms: ms,
    });
  } catch (_) {}
}

// Response helpers
export const ok = (res, data) => res.status(200).json({ ok: true, ...data });
export const err = (res, msg, code = 500) =>
  res.status(code).json({ ok: false, error: msg });

// All API routes use Node.js runtime (Chromium needs Node, not Edge)
export const nodeConfig = { runtime: "nodejs", maxDuration: 60 };
