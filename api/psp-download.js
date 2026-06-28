import { parse } from 'node-html-parser';

export default async function handler(req, res) {
  try {
    const { date } = req.query; // Optional, might want specific date

    const listResponse = await fetch('https://report.grid-india.in/psp_report.php');
    if (!listResponse.ok) throw new Error('Failed to fetch PSP list');

    const html = await listResponse.text();
    const root = parse(html);

    const links = root.querySelectorAll('a');
    let targetHref = null;
    let filename = 'PSP_Report.xls';

    // Find the latest link
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href && href.includes('PSP+Report') && href.includes('.xls')) {
        targetHref = 'https://report.grid-india.in/' + href;

        const match = targetHref.match(/(\d{2})\.(\d{2})\.(\d{2})/);
        if (match) {
          filename = `PSP_Report_20${match[3]}-${match[2]}-${match[1]}.xls`;
        }
        break;
      }
    }

    if (!targetHref) {
      throw new Error('Could not find latest PSP report link');
    }

    const xlsResponse = await fetch(targetHref);
    if (!xlsResponse.ok) throw new Error('Failed to download XLS file');

    const arrayBuffer = await xlsResponse.arrayBuffer();

    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('PSP Download error:', error);
    return res.status(500).json({ error: true, message: error.message });
  }
}
