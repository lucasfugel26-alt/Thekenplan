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

async function generateLink(type, email, redirectTo, serviceKey) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({ type, email, redirect_to: redirectTo }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

function extractLink(data) {
  return data.action_link
    || data.properties?.action_link
    || data.data?.action_link
    || null;
}

// Create or re-invite a user and return a magic link they can use to sign in
// and set their password. Magic links work for both confirmed and unconfirmed
// email addresses, making them reliable for initial account setup.
async function getMagicLink(email, redirectTo, serviceKey) {
  // Try magiclink (works for all users, confirms email on click)
  let { ok, data } = await generateLink('magiclink', email, redirectTo, serviceKey);
  if (ok) return { ok: true, data, type: 'magiclink' };

  // Fallback: if user somehow can't get a magiclink, try recovery
  ({ ok, data } = await generateLink('recovery', email, redirectTo, serviceKey));
  if (ok) return { ok: true, data, type: 'recovery' };

  return { ok: false, data, type: null };
}

export default async function handler(req, res) {
  try {
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

    // ── Zugang erstellen ─────────────────────────────────────────────────────
    if (action === 'inviteUser') {
      const { email, display_name, redirect_to } = req.body;
      if (!email || !display_name) return res.status(400).json({ error: 'E-Mail und Name erforderlich' });

      // generate_link creates the user automatically if they don't exist yet
      const { ok, data: linkData, type: linkType } = await getMagicLink(email, redirect_to, serviceKey);
      if (!ok) return res.status(400).json({ error: linkData.msg || linkData.message || 'Fehler beim Link-Generieren' });

      const userId = linkData.user?.id || linkData.id;
      if (!userId) return res.status(500).json({ error: 'Keine User-ID erhalten' });

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

      return res.status(200).json({
        id: userId,
        display_name,
        invite_link: extractLink(linkData),
        link_type: linkType,
      });
    }

    // ── Reset-Link generieren ─────────────────────────────────────────────────
    if (action === 'resetLink') {
      const { email, redirect_to } = req.body;
      if (!email) return res.status(400).json({ error: 'E-Mail erforderlich' });

      const { ok, data: linkData } = await getMagicLink(email, redirect_to, serviceKey);
      if (!ok) return res.status(400).json({ error: linkData.msg || linkData.message || 'Fehler beim Link-Generieren' });

      const link = extractLink(linkData);
      if (!link) return res.status(500).json({ error: 'Kein Link erhalten' });

      return res.status(200).json({ link });
    }

    // ── Benutzer löschen ──────────────────────────────────────────────────────
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

  } catch (err) {
    console.error('admin handler error:', err);
    return res.status(500).json({ error: err.message || 'Interner Fehler' });
  }
}
