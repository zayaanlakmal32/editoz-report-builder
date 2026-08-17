// api/clients-list.js
// Returns every client name in the Project Tracker, for the autocomplete dropdown in Step 3.
// Cheap to cache on the frontend (client list doesn't change minute to minute).
export default async function handler(req, res) {
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_PROJECT_TRACKER_ID || 'b6b396fe-f0cf-4d7e-9845-e18c630c0ae7';

  if (!NOTION_TOKEN) {
    return res.status(500).json({ error: 'NOTION_TOKEN is not configured on the server' });
  }

  try {
    let names = [];
    let cursor = undefined;
    do {
      const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ start_cursor: cursor, page_size: 100 }),
      });
      if (!response.ok) {
        const detail = await response.text();
        return res.status(response.status).json({ error: 'Notion API error', detail });
      }
      const data = await response.json();
      names.push(...data.results.map(p => p.properties['Client Name']?.title?.[0]?.plain_text).filter(Boolean));
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    res.status(200).json({ clients: [...new Set(names)].sort() });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
}

