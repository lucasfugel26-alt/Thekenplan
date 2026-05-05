const Anthropic = require('@anthropic-ai/sdk');

const PROMPT = `Du analysierst einen Veranstaltungskalender. Extrahiere alle Events und gib NUR ein JSON-Array zurück (kein Markdown, kein Text davor oder danach).

Format jedes Eintrags:
{
  "date": "YYYY-MM-DD",
  "event": "Name der Veranstaltung",
  "startGastro": "HH:MM",
  "schlussShow": "HH:MM",
  "notes": "zusätzliche Infos oder leer"
}

Regeln:
- Falls Datum nicht erkennbar: leerer String ""
- Falls Zeit nicht erkennbar: leerer String ""
- Nur das JSON-Array ausgeben, sonst nichts`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data, mediaType } = req.body;
  if (!data || !mediaType) {
    return res.status(400).json({ error: 'Missing data or mediaType' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert. Bitte in Vercel Environment Variables setzen.' });
  }

  try {
    const client = new Anthropic({ apiKey });

    const isPDF = mediaType === 'application/pdf';

    const contentBlock = isPDF
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data } };

    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [contentBlock, { type: 'text', text: PROMPT }],
      }],
    });

    const text = message.content[0]?.text || '[]';
    return res.status(200).json({ text });

  } catch (err) {
    console.error('[OCR] Error:', err);
    return res.status(500).json({ error: err.message || 'Unbekannter Fehler' });
  }
};
