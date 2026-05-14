const Anthropic = require('@anthropic-ai/sdk');
const { getCallerUserId, hasPermissionOrLegacyAdmin, SUPABASE_URL } = require('./_auth.js');

async function isAiEnabled(serviceKey) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_config?key=eq.ai_enabled&select=value`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }
  });
  const rows = await r.json();
  if (!rows || rows.length === 0) return true; // default: enabled
  return rows[0].value !== false;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const userId = await getCallerUserId(token, serviceKey);
  if (!userId) return res.status(401).json({ error: 'Invalid token' });
  if (!(await hasPermissionOrLegacyAdmin(userId, 'planning.ai_generate', serviceKey))) {
    return res.status(403).json({ error: 'Keine Berechtigung: planning.ai_generate' });
  }
  if (!(await isAiEnabled(serviceKey))) return res.status(403).json({ error: 'AI features disabled' });

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

function buildPreflightPrompt({ period, events, employees, availability, selectedRoles }) {
  const mo = MONS_DE[period.month - 1];
  const rolesFilter = selectedRoles && selectedRoles.length
    ? `Zu planende Rollen: ${selectedRoles.join(', ')}`
    : 'Alle Rollen werden geplant';

  // Events without required_staff
  const missingReq = events.filter(ev => !ev.cancelled && (!ev.required_staff || !ev.required_staff.length));

  const evLines = events.map(ev => {
    const req = ev.required_staff || [];
    const reqSummary = req.length
      ? req.map(r => `${r.count}×${r.role}`).join(', ')
      : '⚠ KEIN BEDARF HINTERLEGT';
    return `- ${ev.date} | ${ev.event} | Bedarf: ${reqSummary}`;
  }).join('\n');

  const empLines = employees.map(e =>
    `- ${e.name} (${e.default_role||'–'}, Soll ${e.soll_stunden||0}h/${e.soll_period||'month'})`
  ).join('\n');

  const avLines = availability.map(av => {
    const e = employees.find(x => x.id === av.employee_id);
    const wished = av.wished_dates?.length ? `, Wunschtermine: ${av.wished_dates.join(', ')}` : '';
    return `- ${e?.name||av.employee_id}: ${av.blocked_dates?.length||0} blockierte Tage${wished}, eingereicht: ${av.submitted_at?'ja':'nein'}`;
  }).join('\n') || '(keine Verfügbarkeiten eingegangen)';

  const missingBlock = missingReq.length ? `\n⚠ FEHLENDER PERSONALBEDARF (${missingReq.length} Events):\n${missingReq.map(ev => `- ${ev.date} | ${ev.event}`).join('\n')}\nDiese Events können NICHT geplant werden, bis der Admin den Bedarf hinterlegt!` : '';

  return `Du bist ein Dienstplanungsassistent für eine Bar/Veranstaltungslocation. Erstelle einen Preflight-Bericht auf Deutsch.

## Planungszeitraum: ${mo} ${period.year}
## ${rolesFilter}
## Veranstaltungen (${events.length}):
${evLines}
${missingBlock}
## Mitarbeiter (${employees.length}):
${empLines}
## Verfügbarkeiten:
${avLines}

Erstelle einen kurzen strukturierten Bericht (max. 300 Wörter) mit:
1. **Überblick**: Events, Mitarbeiter, Abdeckungsschätzung
2. **Fehlender Bedarf**: Liste Events ohne Personalbedarf explizit auf und fordere den Admin auf, diesen zuerst einzutragen
3. **Risiken**: Engpässe, fehlende Verfügbarkeiten, mögliche Konflikte
4. **Fragen an den Admin** (2–4 Fragen die helfen den Plan zu optimieren)`;
}

function buildGeneratePrompt({ period, events, employees, availability, applications, answers, selectedRoles }) {
  const mo = MONS_DE[period.month - 1];
  const roles = selectedRoles && selectedRoles.length ? selectedRoles : null;

  // Only plan events that have required_staff AND match selected roles
  const plannableEvents = events.filter(ev =>
    !ev.cancelled && ev.required_staff && ev.required_staff.length > 0 &&
    (!roles || ev.required_staff.some(r => roles.includes(r.role)))
  );
  const skippedEvents = events.filter(ev =>
    !ev.cancelled && (!ev.required_staff || !ev.required_staff.length)
  );

  const evJson = plannableEvents.map(ev => {
    // Filter required_staff to selected roles only
    const reqStaff = roles
      ? (ev.required_staff || []).filter(r => roles.includes(r.role))
      : (ev.required_staff || []);
    return {
      id: ev.id,
      date: ev.date,
      name: ev.event,
      startGastro: ev.startGastro || null,
      ende: ev.belegungsende || null,
      required_staff: reqStaff,
    };
  });

  const empJson = employees
    .filter(e => !roles || roles.includes(e.default_role))
    .map(e => ({
      id: e.id,
      name: e.name,
      role: e.default_role || 'Thekenkraft',
      soll: e.soll_stunden || 0,
      sollPeriod: e.soll_period || 'month',
    }));

  const avJson = availability.map(av => {
    const dateRules = av.date_rules || {};
    const wished = av.wished_dates || [];
    const wdRules = av.weekday_rules || {};
    // Build compact weekday summary
    const wdSummary = Object.entries(wdRules)
      .filter(([, r]) => r.blocked || r.from)
      .map(([wd, r]) => `Wochentag ${wd}: ${r.blocked ? 'nie' : 'ab ' + r.from}`)
      .join('; ');
    return {
      employee_id: av.employee_id,
      blocked: av.blocked_dates || [],
      date_rules: dateRules,
      wished_dates: wished,
      weekday_rules: wdSummary || null,
    };
  });

  const skippedNote = skippedEvents.length
    ? `\nHINWEIS: ${skippedEvents.length} Events wurden ÜBERSPRUNGEN, da kein Personalbedarf hinterlegt ist: ${skippedEvents.map(ev => ev.event).join(', ')}. Diese werden im Output mit leeren Slots zurückgegeben.`
    : '';

  return `Erstelle einen optimalen Dienstplan für ${mo} ${period.year}.

REGELN (bindend):
1. Besetze NUR die in required_staff definierten Stellen – keine zusätzlichen Slots erfinden
2. Plane NUR Mitarbeiter deren default_role in required_staff.role vorkommt
3. Respektiere blocked_dates vollständig – kein Mitarbeiter an blockierten Tagen einteilen
4. Respektiere date_rules: {"datum": {"available_from": "HH:MM"}} – Schicht erst ab dieser Zeit erlaubt
5. Respektiere weekday_rules: an gesperrten Wochentagen nicht einteilen; "ab HH:MM" beachten
6. Bevorzuge Mitarbeiter mit wished_dates passend zum Event-Datum (+Priorität)
7. Bevorzuge Mitarbeiter die sich für ein Event beworben haben
8. Achte auf ausgeglichene Stundenverteilung gemäß Soll-Stunden
9. Kein Mitarbeiter an zwei Events am selben Tag
10. Verwende nur die gegebenen Mitarbeiter-IDs${skippedNote}

VERANSTALTUNGEN (planbar): ${JSON.stringify(evJson)}

MITARBEITER: ${JSON.stringify(empJson)}

VERFÜGBARKEITEN: ${JSON.stringify(avJson)}

BEWERBUNGEN: ${JSON.stringify(applications || [])}

${answers ? `ADMIN-ANWEISUNGEN: ${answers}` : ''}

Antworte NUR mit diesem JSON, kein anderer Text:
\`\`\`json
{"assignments":{"EVENT_ID":[{"pos":1,"name":"Name","employeeId":"UUID","miss":false,"role":"Rollenname"}]}}
\`\`\`
Für jeden planbaren Event alle required_staff Slots befüllen (Anzahl pro Rolle aus required_staff.count).
Unbesetzte Slots: {"pos":N,"name":null,"miss":true,"employeeId":null,"role":"Rollenname"}
Übersprungene Events (kein required_staff): nicht im Output aufführen.`;
}