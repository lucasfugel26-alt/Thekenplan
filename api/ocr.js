const Anthropic = require('@anthropic-ai/sdk');

function buildPrompt(locations) {
  const locList = locations && locations.length
    ? `\nVerfügbare Locations (verwende exakt diese Kürzel):\n${locations.map(l => `- "${l.short}" = ${l.name}`).join('\n')}`
    : '';

  return `Du analysierst einen Veranstaltungskalender. Extrahiere ALLE Events und gib NUR ein JSON-Array zurück (kein Markdown, kein erklärender Text).
${locList}

Format jedes Eintrags:
{
  "date": "YYYY-MM-DD",
  "event": "Name der Veranstaltung",
  "startGastro": "HH:MM",
  "schlussShow": "HH:MM",
  "location": "Kürzel aus der Liste oben, oder leerer String wenn unklar",
  "notes": "zusätzliche Infos oder leer"
}

Wichtige Regeln:
- Datum IMMER als YYYY-MM-DD umwandeln, auch wenn es "Mi.03.06.2026" oder "03.06.26" oder "June 3" lautet
- Zeit IMMER als HH:MM (ohne "Uhr", ohne Sekunden)
- Falls Datum fehlt oder nicht erkennbar: ""
- Falls Zeit fehlt: ""
- Location: Wähle das passende Kürzel aus der Liste anhand des Raumnamens/Location-Feldes
- Nur das JSON-Array ausgeben, absolut nichts anderes`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY fehlt. Bitte in Vercel → Settings → Environment Variables eintragen.'
    });
  }

  const { data, mediaType, text: rawText, locations } = req.body;
  const prompt = buildPrompt(locations || []);

  if (!data && !rawText) {
    return res.status(400).json({ error: 'Kein Inhalt übermittelt (data oder text erforderlich).' });
  }

  try {
    const client = new Anthropic({ apiKey });

    let contentBlocks;

    if (rawText) {
      // Plain text mode (Excel converted to table text)
      contentBlocks = [
        { type: 'text', text: `Hier sind die Rohdaten aus der Datei:\n\n${rawText}\n\n${prompt}` }
      ];
    } else {
      // File mode: PDF or image
      const isPDF = mediaType === 'application/pdf';
      const fileBlock = isPDF
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
        : { type: 'image',    source: { type: 'base64', media_type: mediaType, data } };
      contentBlocks = [fileBlock, { type: 'text', text: prompt }];
    }

    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 8192,
      messages: [{ role: 'user', content: contentBlocks }],
    });

    const text = message.content[0]?.text || '[]';
    return res.status(200).json({ text });

  } catch (err) {
    console.error('[OCR] Error:', err);
    return res.status(500).json({ error: err.message || 'Unbekannter Fehler' });
  }
};
