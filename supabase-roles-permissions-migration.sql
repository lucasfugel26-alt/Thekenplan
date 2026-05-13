-- ============================================================
-- MIGRATION: Dynamisches Rollen- und Rechtekonzept
-- Branch: claude/analyze-roles-permissions-kW7yd
--
-- Ausführungsreihenfolge:
--   1. Dieses Skript im Supabase SQL-Editor ausführen
--   2. Danach: supabase-roles-permissions-seed.sql ausführen
--
-- SICHER: Bestehende Daten bleiben erhalten.
-- profiles.role (alt) bleibt bis zur vollständigen Migration.
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABELLE: roles
--    Frei erstellbare, frei benennbare Rollen
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  color       TEXT DEFAULT '#6b7280',
  is_system   BOOLEAN DEFAULT false,   -- true = nicht löschbar (z.B. Owner)
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Jeder authentifizierte User darf Rollen lesen
CREATE POLICY "roles_read" ON roles
  FOR SELECT TO authenticated USING (true);

-- Nur User mit 'roles.edit' dürfen Rollen schreiben
CREATE POLICY "roles_write" ON roles
  FOR ALL TO authenticated
  USING (user_has_permission(auth.uid(), 'roles.edit'))
  WITH CHECK (user_has_permission(auth.uid(), 'roles.edit'));


-- ------------------------------------------------------------
-- 2. TABELLE: permissions
--    Alle möglichen Einzelrechte des Systems
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,    -- z.B. 'events.edit'
  category    TEXT NOT NULL,           -- z.B. 'events'
  label       TEXT NOT NULL,           -- z.B. 'Veranstaltungen bearbeiten'
  description TEXT,
  sort_order  INTEGER DEFAULT 0
);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- Permissions sind für alle sichtbar (keine sensiblen Daten)
CREATE POLICY "permissions_read" ON permissions
  FOR SELECT TO authenticated USING (true);

-- Nur Owner/System kann Permissions anlegen (über Service Role)
CREATE POLICY "permissions_write" ON permissions
  FOR ALL TO authenticated
  USING (user_has_permission(auth.uid(), 'roles.edit'))
  WITH CHECK (user_has_permission(auth.uid(), 'roles.edit'));


-- ------------------------------------------------------------
-- 3. TABELLE: role_permissions
--    Welche Rolle hat welche Rechte (n:m)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions_read" ON role_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "role_permissions_write" ON role_permissions
  FOR ALL TO authenticated
  USING (user_has_permission(auth.uid(), 'roles.edit'))
  WITH CHECK (user_has_permission(auth.uid(), 'roles.edit'));


-- ------------------------------------------------------------
-- 4. TABELLE: profiles erweitern
--    role_id (neu) parallel zu role (alt) – Migration-sicher
-- ------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

-- Index für schnelle Lookups
CREATE INDEX IF NOT EXISTS profiles_role_id_idx ON profiles(role_id);
CREATE INDEX IF NOT EXISTS role_permissions_role_id_idx ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS role_permissions_permission_id_idx ON role_permissions(permission_id);


-- ------------------------------------------------------------
-- 5. FUNKTION: user_has_permission()
--    Serverseitige Berechtigungsprüfung – verwendet in RLS + API
--    SECURITY DEFINER: läuft mit Owner-Rechten, kein RLS-Loop
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION user_has_permission(p_user_id UUID, p_permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles pr
    JOIN role_permissions rp ON rp.role_id = pr.role_id
    JOIN permissions p       ON p.id = rp.permission_id
    WHERE pr.id = p_user_id
      AND p.key = p_permission_key
  );
$$;


-- ------------------------------------------------------------
-- 6. FUNKTION: get_user_permissions()
--    Gibt alle Permission-Keys eines Users zurück
--    Wird beim Login aufgerufen um currentPermissions[] zu füllen
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE(permission_key TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT p.key
  FROM profiles pr
  JOIN role_permissions rp ON rp.role_id = pr.role_id
  JOIN permissions p       ON p.id = rp.permission_id
  WHERE pr.id = p_user_id;
$$;


-- ------------------------------------------------------------
-- 7. RLS-POLICIES aktualisieren
--    Bestehende 'admin'-basierte Policies werden um
--    permission-basierte Varianten ergänzt.
--    BEIDE Varianten laufen parallel bis zur vollständigen
--    Migration (Phase 5 Cleanup).
-- ------------------------------------------------------------

-- events: Schreiben für User mit events.edit ODER alter admin-Rolle
DROP POLICY IF EXISTS "events_write_perm" ON events;
CREATE POLICY "events_write_perm" ON events
  FOR ALL TO authenticated
  USING (
    user_has_permission(auth.uid(), 'events.edit')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    user_has_permission(auth.uid(), 'events.edit')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- employees: Schreiben für User mit staff.edit ODER alter admin-Rolle
DROP POLICY IF EXISTS "employees_write_perm" ON employees;
CREATE POLICY "employees_write_perm" ON employees
  FOR ALL TO authenticated
  USING (
    user_has_permission(auth.uid(), 'staff.edit')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    user_has_permission(auth.uid(), 'staff.edit')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- planning_periods: Schreiben für User mit planning.edit ODER alter admin-Rolle
DROP POLICY IF EXISTS "planning_periods_write_perm" ON planning_periods;
CREATE POLICY "planning_periods_write_perm" ON planning_periods
  FOR ALL TO authenticated
  USING (
    user_has_permission(auth.uid(), 'planning.edit')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    user_has_permission(auth.uid(), 'planning.edit')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- app_config: Schreiben für User mit settings.edit_general ODER alter admin-Rolle
DROP POLICY IF EXISTS "app_config_write_perm" ON app_config;
CREATE POLICY "app_config_write_perm" ON app_config
  FOR ALL TO authenticated
  USING (
    user_has_permission(auth.uid(), 'settings.edit_general')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    user_has_permission(auth.uid(), 'settings.edit_general')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- event_messages: Löschen für User mit chat.delete_messages ODER alter admin-Rolle
DROP POLICY IF EXISTS "event_messages_delete_perm" ON event_messages;
CREATE POLICY "event_messages_delete_perm" ON event_messages
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR user_has_permission(auth.uid(), 'chat.delete_messages')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ------------------------------------------------------------
-- 8. SICHERHEITS-CONSTRAINT: Mindestens ein Owner muss existieren
--    Verhindert vollständige Aussperrung
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_owner_exists()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Nur prüfen wenn role_id geändert wird
  IF OLD.role_id IS DISTINCT FROM NEW.role_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles pr
      JOIN roles r ON r.id = pr.role_id
      WHERE r.is_system = true
        AND pr.id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Mindestens ein Benutzer muss die Owner-Rolle behalten.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_owner_exists ON profiles;
CREATE TRIGGER trg_check_owner_exists
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_owner_exists();


-- ------------------------------------------------------------
-- HINWEIS: Nach Ausführen dieses Skripts
--   → supabase-roles-permissions-seed.sql ausführen
--   → Danach bestehende User migrieren (role → role_id)
-- ------------------------------------------------------------
