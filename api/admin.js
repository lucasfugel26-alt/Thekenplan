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

  if (action === 'inviteUser') {
    const { email, display_name, redirect_to } = req.body;
    if (!email || !display_name) {
      return res.status(400).json({ error: 'E-Mail und Name erforderlich' });
    }

    // Try invite link first; if user already exists, fall back to recovery link.
    let linkData, linkType = 'invite';
    let linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      body: JSON.stringify({ type: 'invite', email, redirect_to }),
    });
    linkData = await linkRes.json();

    if (!linkRes.ok) {
      const msg = linkData.msg || linkData.message || '';
      // User already registered — generate a password-recovery link instead
      if (msg.toLowerCase().includes('already')) {
        linkType = 'recovery';
        linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
          body: JSON.stringify({ type: 'recovery', email, redirect_to }),
        });
        linkData = await linkRes.json();
        if (!linkRes.ok) return res.status(400).json({ error: linkData.msg || linkData.message || 'Fehler beim Link-Generieren' });
      } else {
        return res.status(400).json({ error: msg || 'Fehler beim Anlegen' });
      }
    }

    const userId = linkData.user?.id || linkData.id;
    if (!userId) return res.status(500).json({ error: 'Keine User-ID erhalten' });

    // Upsert profile (may already exist if user was previously created)
    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ id: userId, display_name, role: 'viewer' }),
    });

    // action_link may be top-level or nested under properties depending on Supabase version
    const inviteLink = linkData.action_link
      || linkData.properties?.action_link
      || linkData.data?.action_link
      || null;

    return res.status(200).json({
      id: userId,
      display_name,
      invite_link: inviteLink,
      link_type: linkType,
      _raw_keys: Object.keys(linkData), // temporary debug — remove once confirmed working
    });
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
