const Anthropic = require('@anthropic-ai/sdk');

const ALLOWED_MEDIA_TYPES = ['image/png','image/jpeg','image/webp','image/gif','application/pdf'];

function buildPrompt(locations, fields = []) {
  const locList = locations && locations.length
    ? `\nVerfügbare Locations (verwende exakt diese Kürzel):\n${locations.map(l => `- "${l.short}" = ${l.name}`).join('\n')}`
    : '';

  const optionalFields = [];
  if (fields.includes('veranstaltungsnummer')) optionalFields.push('  "veranstaltungsnummer": "Veranstaltungsnummer oder ID aus der Tabelle, sonst leer"');
  if (fields.includes('belegungsende')) optionalFields.push('  "belegungsende": "HH:MM Uhrzeit Belegungsende/Raumende, sonst leer"');
  if (fields.includes('besucherzahl')) optionalFields.push('  "besucherzahl": Erwartete Besucherzahl als Zahl oder null');
  if (fields.includes('notes')) optionalFields.push('  "notes": "Zusätzliche Infos, Bemerkungen oder leer"');
  else optionalFields.push('  "notes": ""');

  return `Du analysierst einen Veranstaltungskalender. Extrahiere ALLE Events und gib NUR ein JSON-Array zurück (kein Markdown, kein erklärender Text).
${locList}

Format jedes Eintrags:
{
  "date": "YYYY-MM-DD",
  "event": "Name der Veranstaltung",
  "einlasszeit": "HH:MM Einlasszeit/Türöffnung/Doors Open, sonst leer",
  "schlussShow": "HH:MM Show-Ende/Konzertende, sonst leer",
  "location": "Kürzel aus der Liste oben, oder leerer String wenn unklar",
${optionalFields.join(',\n')}
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

  // Verify token and check admin role via Supabase
  const supabaseUrl = 'https://anagoloyaaikuexzbxae.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const profileRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: serviceKey }
    });
    if (!profileRes.ok) return res.status(401).json({ error: 'Ungültiger Token' });
    const user = await profileRes.json();
    const roleRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=role`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }
    });
    const roleData = await roleRes.json();
    if (roleData?.[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Nur Admins können Dateien importieren.' });
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY fehlt. Bitte in Vercel → Settings → Environment Variables eintragen.'
    });
  }

  const { data, mediaType, text: rawText, locations, fields } = req.body;
  const prompt = buildPrompt(locations || [], fields || []);

  if (!data && !rawText) {
    return res.status(400).json({ error: 'Kein Inhalt übermittelt (data oder text erforderlich).' });
  }

  try {
    const client = new Anthropic({ apiKey });

    let contentBlocks;

    if (rawText) {
      contentBlocks = [
        { type: 'text', text: `Hier sind die Rohdaten aus der Datei:\n\n${rawText}\n\n${prompt}` }
      ];
    } else {
      if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
        return res.status(400).json({ error: 'Ungültiger Dateityp.' });
      }
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
    const msg = err.message || 'Unbekannter Fehler';
    const isConnErr = msg.toLowerCase().includes('connection') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch');
    return res.status(500).json({
      error: isConnErr
        ? 'Verbindungsfehler zur Anthropic API. Bitte prüfe ob ANTHROPIC_API_KEY in Vercel hinterlegt ist und ein Redeploy ausgelöst wurde.'
        : msg
    });
  }
};
