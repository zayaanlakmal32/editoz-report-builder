// api/client-lookup.js
// Looks up one client by exact name in the Project Tracker and returns just the fields
// the report tool needs. Read-only — never writes back to Notion.
//
// Uses Notion API version 2025-09-03+ (the "data sources" model). Notion split what used
// to be one "database" object into a container (database) + one or more data sources as
// of Sept 2025 — query/filter calls now target a data_source_id via /v1/data_sources/,
// not the old /v1/databases/ endpoint, which returns a misleading "could not find
// database" 404 if you pass it a data source ID (which is what our stored ID actually is).
export default async function handler(req, res) {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'Missing "name" query param' });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATA_SOURCE_ID = process.env.NOTION_PROJECT_TRACKER_ID || 'b6b396fe-f0cf-4d7e-9845-e18c630c0ae7';

  if (!NOTION_TOKEN) {
    return res.status(500).json({ error: 'NOTION_TOKEN is not configured on the server' });
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/data_sources/${DATA_SOURCE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2025-09-03',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { property: 'Client Name', title: { equals: name } },
        page_size: 1,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({ error: 'Notion API error', detail });
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      return res.status(200).json({ found: false });
    }

    const props = data.results[0].properties;
    const num = (p) => props[p]?.number ?? null;
    const formulaNum = (p) => props[p]?.formula?.number ?? null;
    const select = (p) => props[p]?.select?.name || null;
    const text = (p) => (props[p]?.rich_text || []).map(t => t.plain_text).join('') || '';

    res.status(200).json({
      found: true,
      clientName: name,
      goalTarget: num('90 Day Goal'),
      goalAchieved: formulaNum('Total Achieved'),
      goalMetric: text('Monthly Goal Metric'),
      phase: select('Stage'),          // Phase 01 / 02 / 03 / 04, On Hold, Offboarded, DFY
      stage: select('Project Stage'),  // Onboarding call, Strategy Call, Content Production, etc.
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
