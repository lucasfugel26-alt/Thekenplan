import { getCallerUserId, hasPermissionOrLegacyAdmin, SUPABASE_URL } from './_auth.js';

export default async function handler(req, res) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return res.status(500).json({ error: 'Service key nicht konfiguriert' });

    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Nicht angemeldet' });

    const callerId = await getCallerUserId(token, serviceKey);
    if (!callerId) return res.status(401).json({ error: 'Ungültiger Token' });

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    };

    // ── GET /api/roles — alle Rollen mit ihren Permissions laden ─────────────
    if (req.method === 'GET') {
      const { action } = req.query;

      // Alle Rollen laden
      if (!action || action === 'list') {
        // roles.view ODER eine der Unterberechtigungen die die Liste benötigen
        const canList = await hasPermissionOrLegacyAdmin(callerId, 'roles.view', serviceKey)
          || await hasPermissionOrLegacyAdmin(callerId, 'roles.edit', serviceKey)
          || await hasPermissionOrLegacyAdmin(callerId, 'roles.create', serviceKey)
          || await hasPermissionOrLegacyAdmin(callerId, 'roles.assign', serviceKey)
          || await hasPermissionOrLegacyAdmin(callerId, 'users.view', serviceKey);
        if (!canList) {
          return res.status(403).json({ error: 'Keine Berechtigung: roles.view' });
        }
        const rolesRes = await fetch(
          `${SUPABASE_URL}/rest/v1/roles?order=sort_order`,
          { headers }
        );
        const roles = await rolesRes.json();

        // Alle role_permissions laden
        const rpRes = await fetch(
          `${SUPABASE_URL}/rest/v1/role_permissions?select=role_id,permission_id`,
          { headers }
        );
        const rolePerms = await rpRes.json();

        // Alle permissions laden
        const permRes = await fetch(
          `${SUPABASE_URL}/rest/v1/permissions?order=category,sort_order`,
          { headers }
        );
        const permissions = await permRes.json();

        // Dienstplan-Scopes laden
        const scopeRes = await fetch(
          `${SUPABASE_URL}/rest/v1/role_staff_scopes?select=role_id,category`,
          { headers }
        );
        const roleStaffScopes = await scopeRes.json();

        return res.status(200).json({ roles, rolePerms, permissions, roleStaffScopes });
      }

      // Permissions eines einzelnen Users laden (für Login-Cache)
      if (action === 'userPermissions') {
        const { userId } = req.query;
        const targetId = userId || callerId;
        const permRes = await fetch(
          `${SUPABASE_URL}/rest/v1/rpc/get_user_permissions`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ p_user_id: targetId }),
          }
        );
        const perms = await permRes.json();

        // Dienstplan-Scope für diese User-Rolle laden
        const profileRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=eq.${targetId}&select=role_id`,
          { headers }
        );
        const profileData = await profileRes.json();
        const roleId = profileData?.[0]?.role_id || null;

        let staffScope = [];
        if (roleId) {
          const scopeRes = await fetch(
            `${SUPABASE_URL}/rest/v1/role_staff_scopes?role_id=eq.${roleId}&select=category`,
            { headers }
          );
          const scopeData = await scopeRes.json();
          staffScope = (scopeData || []).map(r => r.category);
        }

        return res.status(200).json({
          permissions: perms.map(p => p.permission_key),
          staffScope,
        });
      }
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action } = req.query;

    // ── Rolle erstellen ───────────────────────────────────────────────────────
    if (action === 'createRole') {
      if (!(await hasPermissionOrLegacyAdmin(callerId, 'roles.create', serviceKey))) {
        return res.status(403).json({ error: 'Keine Berechtigung: roles.create' });
      }
      const { name, description, color } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'Name erforderlich' });

      const r = await fetch(`${SUPABASE_URL}/rest/v1/roles`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ name: name.trim(), description, color: color || '#6b7280' }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(400).json({ error: err.message || 'Fehler beim Erstellen' });
      }
      return res.status(200).json(await r.json());
    }

    // ── Rolle umbenennen / Farbe/Beschreibung ändern ──────────────────────────
    if (action === 'updateRole') {
      if (!(await hasPermissionOrLegacyAdmin(callerId, 'roles.edit', serviceKey))) {
        return res.status(403).json({ error: 'Keine Berechtigung: roles.edit' });
      }
      const { roleId, name, description, color } = req.body;
      if (!roleId) return res.status(400).json({ error: 'roleId erforderlich' });

      const patch = {};
      if (name !== undefined) patch.name = name.trim();
      if (description !== undefined) patch.description = description;
      if (color !== undefined) patch.color = color;

      const r = await fetch(`${SUPABASE_URL}/rest/v1/roles?id=eq.${roleId}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(400).json({ error: err.message || 'Fehler beim Aktualisieren' });
      }
      return res.status(200).json({ success: true });
    }

    // ── Rolle löschen ─────────────────────────────────────────────────────────
    if (action === 'deleteRole') {
      if (!(await hasPermissionOrLegacyAdmin(callerId, 'roles.delete', serviceKey))) {
        return res.status(403).json({ error: 'Keine Berechtigung: roles.delete' });
      }
      const { roleId } = req.body;
      if (!roleId) return res.status(400).json({ error: 'roleId erforderlich' });

      // System-Rollen dürfen nie gelöscht werden
      const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/roles?id=eq.${roleId}&select=is_system`, { headers });
      const checkData = await checkRes.json();
      if (checkData?.[0]?.is_system) {
        return res.status(400).json({ error: 'System-Rollen können nicht gelöscht werden.' });
      }

      // Betroffene User auf Mitarbeiter-Rolle setzen
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?role_id=eq.${roleId}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ role_id: '00000000-0000-0000-0000-000000000003' }),
      });

      const r = await fetch(`${SUPABASE_URL}/rest/v1/roles?id=eq.${roleId}`, {
        method: 'DELETE',
        headers,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(400).json({ error: err.message || 'Fehler beim Löschen' });
      }
      return res.status(200).json({ success: true });
    }

    // ── Permissions einer Rolle setzen (vollständiger Replace) ────────────────
    if (action === 'setRolePermissions') {
      if (!(await hasPermissionOrLegacyAdmin(callerId, 'roles.edit', serviceKey))) {
        return res.status(403).json({ error: 'Keine Berechtigung: roles.edit' });
      }
      const { roleId, permissionIds } = req.body;
      if (!roleId || !Array.isArray(permissionIds)) {
        return res.status(400).json({ error: 'roleId und permissionIds[] erforderlich' });
      }

      // Alle bisherigen Permissions dieser Rolle löschen
      await fetch(`${SUPABASE_URL}/rest/v1/role_permissions?role_id=eq.${roleId}`, {
        method: 'DELETE',
        headers,
      });

      // Neue Permissions einfügen
      if (permissionIds.length > 0) {
        const rows = permissionIds.map(pid => ({ role_id: roleId, permission_id: pid }));
        const insRes = await fetch(`${SUPABASE_URL}/rest/v1/role_permissions`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify(rows),
        });
        if (!insRes.ok) {
          const err = await insRes.json().catch(() => ({}));
          return res.status(400).json({ error: err.message || 'Fehler beim Speichern' });
        }
      }

      return res.status(200).json({ success: true });
    }

    // ── Dienstplan-Scope einer Rolle setzen (vollständiger Replace) ──────────────
    if (action === 'setRoleStaffScope') {
      const canManageScope = await hasPermissionOrLegacyAdmin(callerId, 'scope.manage', serviceKey)
        || await hasPermissionOrLegacyAdmin(callerId, 'roles.edit', serviceKey);
      if (!canManageScope) {
        return res.status(403).json({ error: 'Keine Berechtigung: scope.manage oder roles.edit' });
      }
      const { roleId, categories } = req.body;
      if (!roleId || !Array.isArray(categories)) {
        return res.status(400).json({ error: 'roleId und categories[] erforderlich' });
      }

      // Alle bisherigen Scope-Einträge dieser Rolle löschen
      await fetch(`${SUPABASE_URL}/rest/v1/role_staff_scopes?role_id=eq.${roleId}`, {
        method: 'DELETE',
        headers,
      });

      // Neue Kategorien einfügen (leer = Vollzugriff, nichts einfügen)
      if (categories.length > 0) {
        const rows = categories.map(cat => ({ role_id: roleId, category: cat }));
        const insRes = await fetch(`${SUPABASE_URL}/rest/v1/role_staff_scopes`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify(rows),
        });
        if (!insRes.ok) {
          const err = await insRes.json().catch(() => ({}));
          return res.status(400).json({ error: err.message || 'Fehler beim Speichern des Scopes' });
        }
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unbekannte Aktion' });

  } catch (err) {
    console.error('roles handler error:', err);
    return res.status(500).json({ error: err.message || 'Interner Fehler' });
  }
}
