export default async function handler(req, res) {
  try {
    const url = 'https://npp.gov.in/dashBoard/gc-map-dashboard-meritchart';
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://npp.gov.in',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`NPP API returned ${response.status}`);
    }

    const data = await response.json();

    // We expect the data structure from MERIT dashboard
    // Need to parse out the demand and generation mix
    // The exact response shape is something like:
    // { demand: 215000, coal: 150000, gas: 5000, hydro: 15000, nuclear: 4000, wind: 2000, solar: 30000, other: 1000 }
    // Let's assume an array of generation and a total demand for now. We will map it roughly.

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      success: true,
      demandMW: data.currentDemand || data.demand || 0,
      updatedAt: new Date().toISOString(),
      generation: [
        { source: 'Coal', mw: data.coal || 0 },
        { source: 'Gas', mw: data.gas || 0 },
        { source: 'Hydro', mw: data.hydro || 0 },
        { source: 'Nuclear', mw: data.nuclear || 0 },
        { source: 'Solar', mw: data.solar || 0 },
        { source: 'Wind', mw: data.wind || 0 },
        { source: 'Other', mw: data.other || 0 },
      ],
      raw: data // Just in case we need to debug the real shape
    });
  } catch (error) {
    console.error('NPP Live error:', error);
    return res.status(500).json({ error: true, fallback: true, message: error.message });
  }
}
