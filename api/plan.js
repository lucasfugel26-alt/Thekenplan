export default async function handler(req, res) {
  const { binId, key } = req.query;
  if (!binId || !key) return res.status(400).json({ error: 'Missing binId or key' });

  try {
    if (req.method === 'GET') {
      const r = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
        headers: { 'X-Master-Key': key, 'X-Bin-Meta': 'false' }
      });
      const data = await r.json();
      return res.status(r.status).json(data);

    } else if (req.method === 'PUT') {
      const r = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': key },
        body: JSON.stringify(req.body)
      });
      const data = await r.json();
      return res.status(r.status).json(data);

    } else if (req.method === 'POST') {
      const r = await fetch('https://api.jsonbin.io/v3/b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': key,
          'X-Bin-Name': 'Thekenplan',
          'X-Private': 'false'
        },
        body: JSON.stringify(req.body)
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
