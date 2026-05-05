const SUPABASE_URL = 'https://anagoloyaaikuexzbxae.supabase.co';

async function getCallerUserId(token) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY }
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u.id || null;
}

async function isAdmin(userId, serviceKey) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }
  });
  const data = await r.json();
  return data?.[0]?.role === 'admin';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'Service key nicht konfiguriert' });

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Nicht angemeldet' });

  const callerId = await getCallerUserId(token);
  if (!callerId) return res.status(401).json({ error: 'Ungültiger Token' });

  if (!(await isAdmin(callerId, serviceKey))) {
    return res.status(403).json({ error: 'Nur Admins erlaubt' });
  }

  const { action } = req.query;

  if (action === 'createUser') {
    const { email, password, display_name } = req.body;
    if (!email || !password || !display_name) {
      return res.status(400).json({ error: 'E-Mail, Passwort und Name erforderlich' });
    }

    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const created = await createRes.json();
    if (!createRes.ok) return res.status(400).json({ error: created.msg || created.message || 'Fehler beim Anlegen' });

    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ id: created.id, display_name, role: 'viewer' }),
    });

    return res.status(200).json({ id: created.id, display_name });
  }

  if (action === 'deleteUser') {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId erforderlich' });
    if (userId === callerId) return res.status(400).json({ error: 'Du kannst dich nicht selbst löschen' });

    const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    });
    if (!delRes.ok) {
      const err = await delRes.json().catch(() => ({}));
      return res.status(400).json({ error: err.message || 'Fehler beim Löschen' });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Unbekannte Aktion' });
}
