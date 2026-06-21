"""
CEA Auto-Downloader (Selenium / Puppeteer)
============================================
Automatically downloads daily generation and demand CSVs from:

  PRIMARY SOURCE:
    CEA OPM Daily Generation Report
    URL: cea.nic.in/opm_grid_operation/daily-generation-report/

  FALLBACK SOURCE (next-day):
    NPP daily XLS reports
    URL: npp.gov.in/public-reports/cea/daily/dgr/DD-MM-YYYY/dgrN-YYYY-MM-DD.xls

Runs on schedule: 08:15, 13:15, 18:15 IST (15 min after each snapshot hour)
Immediately uploads to Supabase after each successful download.

IMPORTANT: This script runs on your LOCAL MACHINE (or a VPS).
The Vercel cron jobs also attempt the same — this is a redundant backup.
If Vercel succeeds, this script will still run but Supabase will just
upsert (overwrite) with the same data harmlessly.

Requirements:
    pip install selenium webdriver-manager schedule supabase pandas pdfplumber openpyxl
    Chrome must be installed.

Usage:
    python cea_downloader.py                      # run once now
    python cea_downloader.py --schedule           # run on schedule forever
    python cea_downloader.py --date 2026-06-20    # specific date
    python cea_downloader.py --npp                # fallback: fetch NPP reports only
"""

import os
import sys
import time
import shutil
import logging
import argparse
import requests
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from webdriver_manager.chrome import ChromeDriverManager
    SELENIUM_OK = True
except ImportError:
    SELENIUM_OK = False
    print("[WARN] Selenium not installed. Run: pip install selenium webdriver-manager")

try:
    import schedule
    SCHED_OK = True
except ImportError:
    SCHED_OK = False

# ── Config ────────────────────────────────────────────────────────────────
IST         = ZoneInfo("Asia/Kolkata")
OUTPUT_DIR  = Path("power_data")
WAIT_SEC    = 30

# Source URLs (confirmed)
CEA_OPM_URL = "https://cea.nic.in/opm_grid_operation/daily-generation-report/?lang=en"
CEA_RE_URL  = "https://cea.nic.in/renewable-generation-report/?lang=en"

# Run at 08:15, 13:15, 18:15 IST
SCHEDULE_TIMES = {
    "08:15": "08:00",
    "13:15": "13:00",
    "18:15": "18:00",
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("cea_downloader.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)


# ── Browser setup ─────────────────────────────────────────────────────────

def make_driver(dl_dir: Path):
    dl_dir.mkdir(parents=True, exist_ok=True)
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1920,1080")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    opts.add_experimental_option("prefs", {
        "download.default_directory": str(dl_dir.resolve()),
        "download.prompt_for_download": False,
        "safebrowsing.enabled": True,
    })
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=opts)
    driver.execute_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")
    return driver


def wait_download(dl_dir: Path, pattern="*.csv", timeout=WAIT_SEC) -> Path | None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        matches = [f for f in dl_dir.glob(pattern) if not f.suffix == ".crdownload"]
        if matches:
            time.sleep(0.5)
            return matches[0]
        time.sleep(1)
    return None


# ── Strategy 1: CEA OPM direct CSV URL ───────────────────────────────────

def try_cea_direct_url(driver, date: str, dl_dir: Path) -> dict:
    """
    CEA may expose direct CSV download URLs.
    Try common patterns before falling back to page navigation.
    """
    files = {}
    [y, m, d] = date.split('-')
    direct_urls = [
        # Common CEA download patterns
        (f"https://cea.nic.in/opm_grid_operation/daily-generation-report/download/?date={date}&type=generation&format=csv", "generation"),
        (f"https://cea.nic.in/opm_grid_operation/daily-generation-report/download/?date={date}&type=demand&format=csv",     "demand"),
        (f"https://cea.nic.in/wp-content/uploads/opm/{y}/{m}/All_India_Generation_{date}.csv", "generation"),
        (f"https://cea.nic.in/wp-content/uploads/opm/{y}/{m}/Demand_Met_Data_{date}.csv",      "demand"),
    ]

    for url, dtype in direct_urls:
        if dtype in files: continue
        try:
            log.info(f"    Trying direct URL ({dtype}): {url}")
            driver.get(url)
            time.sleep(2)
            f = wait_download(dl_dir, "*.csv", timeout=8)
            if f and f.stat().st_size > 500:
                dest = dl_dir / f"All_India_Generation_{date}.csv" if dtype == "generation" else dl_dir / f"Demand_Met_Data_{date}.csv"
                shutil.move(str(f), dest)
                files[dtype] = dest
                log.info(f"    ✓ {dtype} via direct URL")
        except Exception as e:
            log.debug(f"    Direct URL failed: {e}")

    return files


# ── Strategy 2: CEA OPM page navigation ──────────────────────────────────

def try_cea_page_navigation(driver, date: str, dl_dir: Path) -> dict:
    """
    Navigate the CEA OPM daily generation report page,
    set the date, and click download buttons.
    """
    files = {}
    wait = WebDriverWait(driver, 20)

    log.info(f"  Loading CEA OPM page: {CEA_OPM_URL}")
    driver.get(CEA_OPM_URL)
    time.sleep(4)

    # Set date input
    date_selectors = ["input[type='date']", "input[placeholder*='date' i]", "#date", ".date-input"]
    for sel in date_selectors:
        try:
            el = driver.find_element(By.CSS_SELECTOR, sel)
            driver.execute_script(
                "arguments[0].value=arguments[1]; arguments[0].dispatchEvent(new Event('change',{bubbles:true}))",
                el, date
            )
            time.sleep(1)
            log.info(f"    Set date to {date}")
            break
        except Exception: continue

    # Click generate/get data button
    btn_xpaths = [
        "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'generate')]",
        "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'get data')]",
        "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'submit')]",
        "//button[@type='submit']",
        "//input[@type='submit']",
    ]
    for xpath in btn_xpaths:
        try:
            btn = driver.find_element(By.XPATH, xpath)
            btn.click(); time.sleep(3)
            log.info(f"    Clicked: {xpath}")
            break
        except Exception: continue

    # Click download buttons for generation and demand
    dl_xpaths = [
        "//button[contains(translate(.,'GEN','gen'),'generation')]//ancestor-or-self::*[self::button or self::a]",
        "//a[contains(@href,'.csv')]",
        "//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'download')]",
        "//a[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'download')]",
        "//*[@title='Download' or @title='download CSV']",
    ]

    for xpath in dl_xpaths:
        try:
            els = driver.find_elements(By.XPATH, xpath)
            for el in els[:4]:   # try first 4 matches
                try:
                    el.click(); time.sleep(2)
                    f = wait_download(dl_dir, "*.csv", timeout=10)
                    if f and f.stat().st_size > 500:
                        txt = f.read_text(errors='ignore')
                        dtype = "generation" if "solar" in txt.lower() or "wind" in txt.lower() else "demand"
                        dest  = dl_dir / (f"All_India_Generation_{date}.csv" if dtype == "generation" else f"Demand_Met_Data_{date}.csv")
                        shutil.move(str(f), dest)
                        files[dtype] = dest
                        log.info(f"    ✓ {dtype} downloaded via page navigation")
                except Exception: continue
        except Exception: continue
        if len(files) >= 2: break

    return files


# ── Strategy 3: XHR intercept ─────────────────────────────────────────────

def try_xhr_intercept(driver, date: str, dl_dir: Path) -> dict:
    """
    Capture XHR/fetch API calls made by the CEA page
    and replay them with the correct date parameter.
    """
    files = {}
    log.info(f"  XHR intercept strategy on CEA OPM page...")

    # Inject performance observer before navigating
    driver.execute_script("""
        window._capturedAPIs = [];
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(m, url) {
            window._capturedAPIs.push(url);
            return origOpen.apply(this, arguments);
        };
        const origFetch = window.fetch;
        window.fetch = function(url, opts) {
            if (typeof url === 'string') window._capturedAPIs.push(url);
            return origFetch.apply(this, arguments);
        };
    """)

    driver.get(CEA_OPM_URL)
    time.sleep(5)

    apis = driver.execute_script("return window._capturedAPIs || []")
    log.info(f"    Captured {len(apis)} API calls")

    for url in apis:
        if not any(k in url.lower() for k in ['csv','download','generation','demand','report']): continue
        # Replay with correct date
        try:
            import urllib.parse
            parsed = urllib.parse.urlparse(url)
            params = dict(urllib.parse.parse_qsl(parsed.query))
            params['date'] = date
            new_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{urllib.parse.urlencode(params)}"
            result = driver.execute_script(f"""
                return fetch('{new_url}', {{credentials:'include'}})
                    .then(r => r.ok ? r.text() : null)
                    .catch(() => null);
            """)
            if result and len(result) > 500:
                dtype = "generation" if "solar" in result.lower() or "SOLAR" in result else "demand"
                dest  = dl_dir / (f"All_India_Generation_{date}.csv" if dtype == "generation" else f"Demand_Met_Data_{date}.csv")
                dest.write_text(result, encoding='utf-8')
                files[dtype] = dest
                log.info(f"    ✓ {dtype} captured via XHR replay")
        except Exception as e:
            log.debug(f"    XHR replay failed for {url}: {e}")

    return files


# ── NPP fallback (direct fetch — no browser needed) ───────────────────────

def fetch_npp_fallback(date: str, dl_dir: Path) -> dict:
    """
    Download NPP public XLS reports directly via requests.
    No browser needed — these are static public files.
    URL pattern confirmed live: npp.gov.in/public-reports/cea/daily/dgr/DD-MM-YYYY/dgrN-YYYY-MM-DD.xls
    """
    [y, m, d] = date.split('-')
    files = {}

    REPORTS = [
        (3, "all_india_summary"),     # 9 KB  — fastest
        (1, "region_overview"),       # 16 KB
        (2, "station_unit_wise"),     # 382 KB — most comprehensive
        (6, "hydro_reservoir"),       # 20 KB
        (10,"outage_coal_nuclear"),   # 36 KB
    ]

    npp_dir = dl_dir / "npp"
    npp_dir.mkdir(parents=True, exist_ok=True)

    for num, name in REPORTS:
        url = f"https://npp.gov.in/public-reports/cea/daily/dgr/{d}-{m}-{y}/dgr{num}-{date}.xls"
        try:
            r = requests.get(url, headers={
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://npp.gov.in/publishedReports'
            }, timeout=20)
            if r.status_code == 200 and len(r.content) > 1000:
                dest = npp_dir / f"dgr{num}_{name}.xls"
                dest.write_bytes(r.content)
                files[f"dgr{num}"] = dest
                log.info(f"  ✓ NPP dgr{num} ({name}): {len(r.content)//1024} KB")
            else:
                log.warning(f"  ✗ NPP dgr{num}: HTTP {r.status_code} or empty")
        except Exception as e:
            log.warning(f"  ✗ NPP dgr{num}: {e}")

    return files


# ── Main download job ──────────────────────────────────────────────────────

def run_download(date: str = None, snapshot: str = None, npp_only: bool = False):
    now_ist  = datetime.now(IST)
    date     = date or now_ist.strftime("%Y-%m-%d")
    snapshot = snapshot or SCHEDULE_TIMES.get(now_ist.strftime("%H:%M"), "08:00")

    log.info(f"\n{'='*60}")
    log.info(f"  CEA Auto-Downloader  |  {date}  |  {snapshot} IST")
    log.info(f"  Source: cea.nic.in/opm_grid_operation/daily-generation-report/")
    log.info(f"{'='*60}")

    dl_dir = OUTPUT_DIR / date
    dl_dir.mkdir(parents=True, exist_ok=True)

    npp_files = fetch_npp_fallback(date, dl_dir)   # always grab NPP — no browser needed

    cea_files = {}
    if not npp_only and SELENIUM_OK:
        driver = None
        try:
            driver = make_driver(dl_dir)
            log.info("\n[Strategy 1] Direct URL download...")
            cea_files = try_cea_direct_url(driver, date, dl_dir)

            if len(cea_files) < 2:
                log.info(f"\n[Strategy 2] CEA OPM page navigation ({len(cea_files)}/2 files)...")
                cea_files.update(try_cea_page_navigation(driver, date, dl_dir))

            if len(cea_files) < 2:
                log.info(f"\n[Strategy 3] XHR intercept ({len(cea_files)}/2 files)...")
                cea_files.update(try_xhr_intercept(driver, date, dl_dir))

        except Exception as e:
            log.error(f"  Browser error: {e}")
        finally:
            if driver:
                try: driver.quit()
                except: pass
    elif not SELENIUM_OK:
        log.warning("  Selenium not available — using NPP fallback only")

    all_files = {**cea_files, **npp_files}
    log.info(f"\n  Downloaded: CEA={list(cea_files.keys())} NPP={list(npp_files.keys())}")

    # Upload to Supabase
    if all_files:
        log.info("\n  Uploading to Supabase...")
        try:
            cmd_parts = [sys.executable, "upload_to_supabase.py", "--date", date, "--snapshot", snapshot]
            if "generation" in cea_files: cmd_parts += ["--gen", str(cea_files["generation"])]
            if "demand"     in cea_files: cmd_parts += ["--dem", str(cea_files["demand"])]
            if "dgr2"       in npp_files: cmd_parts += ["--dgr2", str(npp_files["dgr2"])]
            if "dgr3"       in npp_files: cmd_parts += ["--dgr3", str(npp_files["dgr3"])]
            import subprocess
            result = subprocess.run(cmd_parts, capture_output=True, text=True)
            log.info(result.stdout)
            if result.returncode != 0: log.error(result.stderr)
        except Exception as e:
            log.error(f"  Upload failed: {e}")
    else:
        log.warning(
            "\n  No files downloaded from CEA OPM.\n"
            "  Possible reasons:\n"
            "    1. CEA page updated its structure\n"
            "    2. Data not yet available for this date/time\n"
            "    3. Chrome/Selenium not installed\n"
            f"\n  Manual download: {CEA_OPM_URL}\n"
            f"  Then run: python upload_to_supabase.py --date {date} --gen gen.csv --dem dem.csv"
        )

    return {**cea_files, **npp_files}


# ── Scheduler ──────────────────────────────────────────────────────────────

def start_scheduler():
    if not SCHED_OK:
        log.error("'schedule' not installed. Run: pip install schedule"); sys.exit(1)

    log.info("Scheduler started. Runs at: " + ", ".join(SCHEDULE_TIMES.keys()) + " IST")
    log.info("NPP fallback fetched at same times (no browser needed).")
    log.info("Press Ctrl+C to stop.\n")

    def job(snap_label):
        date = datetime.now(IST).strftime("%Y-%m-%d")
        log.info(f"\n⏰ Scheduled: {snap_label} IST — {date}")
        run_download(date=date, snapshot=snap_label)

    for ist_time, snap in SCHEDULE_TIMES.items():
        # Convert IST to UTC (UTC = IST - 5:30)
        h, mi = map(int, ist_time.split(":"))
        utc_h  = (h*60 + mi - 330) // 60 % 24
        utc_mi = (h*60 + mi - 330) % 60
        utc_time = f"{utc_h:02d}:{utc_mi:02d}"
        schedule.every().day.at(utc_time).do(job, snap)
        log.info(f"  Scheduled: {ist_time} IST ({utc_time} UTC) → snapshot {snap}")

    run_download()   # run immediately on start

    while True:
        schedule.run_pending()
        time.sleep(30)


# ── Entry point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="CEA power data auto-downloader")
    ap.add_argument("--date",     default=None, help="Date YYYY-MM-DD (default: today IST)")
    ap.add_argument("--snapshot", default=None, help="Snapshot label 08:00/13:00/18:00")
    ap.add_argument("--schedule", action="store_true", help="Run on schedule forever")
    ap.add_argument("--npp",      action="store_true", help="NPP fallback only (no browser)")
    args = ap.parse_args()

    if args.schedule:
        start_scheduler()
    else:
        run_download(date=args.date, snapshot=args.snapshot, npp_only=args.npp)
