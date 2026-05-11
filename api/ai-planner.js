const Anthropic = require('@anthropic-ai/sdk');

const SUPABASE_URL = 'https://anagoloyaaikuexzbxae.supabase.co';

async function getCallerUserId(token) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY }
  });
  if (!r.ok) return null;
  return (await r.json()).id || null;
}

async function isAdminUser(userId, serviceKey) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }
  });
  return (await r.json())?.[0]?.role === 'admin';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const userId = await getCallerUserId(token);
  if (!userId) return res.status(401).json({ error: 'Invalid token' });
  if (!(await isAdminUser(userId, serviceKey))) return res.status(403).json({ error: 'Admin only' });

  const { action, payload } = req.body || {};
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    if (action === 'preflight') {
      const msg = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: buildPreflightPrompt(payload) }],
      });
      return res.json({ report: msg.content[0].text });
    }

    if (action === 'generate') {
      const msg = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 8000,
        messages: [{ role: 'user', content: buildGeneratePrompt(payload) }],
      });
      const text = msg.content[0].text;
      const match = text.match(/```json\n?([\s\S]*?)\n?```/);
      try {
        return res.json({ assignments: JSON.parse(match ? match[1] : text.trim()).assignments });
      } catch {
        return res.status(500).json({ error: 'AI returned invalid JSON', raw: text.slice(0, 300) });
      }
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

const MONS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

function buildPreflightPrompt({ period, events, employees, availability }) {
  const mo = MONS_DE[period.month - 1];
  const evLines = events.map(ev =>
    `- ${ev.date} | ${ev.event} | Slots: ${ev.barStaff?.length||0} | Besetzt: ${ev.barStaff?.filter(s=>!s.miss).length||0}`
  ).join('\n');
  const empLines = employees.map(e =>
    `- ${e.name} (${e.default_role||'–'}, Soll ${e.soll_stunden||0}h/${e.soll_period||'month'})`
  ).join('\n');
  const avLines = availability.map(av => {
    const e = employees.find(x => x.id === av.employee_id);
    return `- ${e?.name||av.employee_id}: ${av.blocked_dates?.length||0} blockierte Tage, eingereicht: ${av.submitted_at?'ja':'nein'}`;
  }).join('\n') || '(keine Verfügbarkeiten eingegangen)';

  return `Du bist ein Dienstplanungsassistent für eine Bar/Veranstaltungslocation. Erstelle einen Preflight-Bericht auf Deutsch.

## Planungszeitraum: ${mo} ${period.year}
## Veranstaltungen (${events.length}):
${evLines}
## Mitarbeiter (${employees.length}):
${empLines}
## Verfügbarkeiten:
${avLines}

Erstelle einen kurzen strukturierten Bericht (max. 250 Wörter) mit:
1. **Überblick**: Events, Mitarbeiter, Abdeckungsschätzung
2. **Risiken**: Engpässe, fehlende Verfügbarkeiten, mögliche Konflikte
3. **Fragen an den Admin** (2–4 Fragen die helfen den Plan zu optimieren)`;
}

function buildGeneratePrompt({ period, events, employees, availability, applications, answers }) {
  const mo = MONS_DE[period.month - 1];
  const evJson = events.map(ev => ({
    id: ev.id, date: ev.date, name: ev.event,
    startGastro: ev.startGastro||null, ende: ev.belegungsende||null,
    slots: ev.barStaff?.length || 4
  }));
  const empJson = employees.map(e => ({
    id: e.id, name: e.name, role: e.default_role||'Thekenkraft',
    soll: e.soll_stunden||0, sollPeriod: e.soll_period||'month'
  }));
  const avJson = availability.map(av => ({
    employee_id: av.employee_id,
    blocked: av.blocked_dates||[],
    wdRules: av.weekday_rules||{}
  }));

  return `Erstelle einen optimalen Dienstplan für ${mo} ${period.year}.

REGELN (bindend):
1. Respektiere blockierte Tage und Wochentag-Einschränkungen
2. Bevorzuge Mitarbeiter die sich für ein Event beworben haben
3. Achte auf ausgeglichene Stundenverteilung gemäß Soll-Stunden
4. Kein Mitarbeiter an zwei Orten am selben Tag
5. Verwende nur die gegebenen Mitarbeiter-IDs

VERANSTALTUNGEN: ${JSON.stringify(evJson)}

MITARBEITER: ${JSON.stringify(empJson)}

VERFÜGBARKEITEN: ${JSON.stringify(avJson)}

BEWERBUNGEN: ${JSON.stringify(applications||[])}

${answers ? `ADMIN-ANWEISUNGEN: ${answers}` : ''}

Antworte NUR mit diesem JSON, kein anderer Text:
\`\`\`json
{"assignments":{"EVENT_ID":[{"pos":1,"name":"Name","employeeId":"UUID","miss":false}]}}
\`\`\`
Für jeden Event alle Slots befüllen. Unbesetzte Slots: {"pos":N,"name":null,"miss":true,"employeeId":null}`;
}
