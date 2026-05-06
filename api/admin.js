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

function makeTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw + '!2';
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

    const { action } = req.query;

    // ── Eigene Kontaktdaten aktualisieren (kein Admin nötig) ─────────────────
    if (action === 'updateEmployeeContact') {
      const { email, phone } = req.body;
      // Find the employee linked to this user
      const empRes = await fetch(`${SUPABASE_URL}/rest/v1/employees?profile_id=eq.${callerId}&select=id`, {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }
      });
      const empData = await empRes.json();
      if (!empData?.[0]?.id) return res.status(404).json({ error: 'Kein verknüpfter Mitarbeiter gefunden' });
      const empId = empData[0].id;
      const updRes = await fetch(`${SUPABASE_URL}/rest/v1/employees?id=eq.${empId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ email: email || null, phone: phone || null }),
      });
      if (!updRes.ok) {
        const err = await updRes.json().catch(() => ({}));
        return res.status(400).json({ error: err.message || 'Fehler beim Speichern' });
      }
      return res.status(200).json({ success: true });
    }

    if (!(await isAdmin(callerId, serviceKey))) {
      return res.status(403).json({ error: 'Nur Admins erlaubt' });
    }

    // ── Zugang erstellen (mit temporärem Passwort) ───────────────────────────
    if (action === 'inviteUser') {
      const { email, display_name } = req.body;
      if (!email || !display_name) return res.status(400).json({ error: 'E-Mail und Name erforderlich' });

      const tempPassword = makeTempPassword();

      // Create user with confirmed email and temp password
      const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
        body: JSON.stringify({ email, password: tempPassword, email_confirm: true }),
      });
      const created = await createRes.json();

      let userId;
      if (createRes.ok) {
        userId = created.id;
      } else {
        // User already exists — update password to new temp password
        const msg = created.msg || created.message || '';
        if (!msg.toLowerCase().includes('already')) {
          return res.status(400).json({ error: msg || 'Fehler beim Anlegen' });
        }
        // Find existing user by email via profiles or list
        const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }
        });
        const listData = await listRes.json();
        const existing = (listData.users || []).find(u => u.email === email);
        if (!existing) return res.status(400).json({ error: 'Benutzer nicht gefunden' });
        userId = existing.id;

        // Reset password to new temp password
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
          body: JSON.stringify({ password: tempPassword }),
        });
      }

      // Upsert profile
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

      return res.status(200).json({ id: userId, display_name, temp_password: tempPassword });
    }

    // ── Temporäres Passwort zurücksetzen ─────────────────────────────────────
    if (action === 'resetLink') {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'E-Mail erforderlich' });

      const tempPassword = makeTempPassword();

      const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }
      });
      const listData = await listRes.json();
      const existing = (listData.users || []).find(u => u.email === email);
      if (!existing) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
        body: JSON.stringify({ password: tempPassword }),
      });

      return res.status(200).json({ temp_password: tempPassword });
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
