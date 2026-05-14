-- ============================================================
-- MIGRATION: Scope-Bypass-Permissions
-- 6 neue Rechte die den Dienstplan-Scope für bestimmte
-- Bereiche aufheben. Neue Kategorie: 'scope'.
-- Owner bekommt alle automatisch; Admin ebenfalls.
-- ============================================================

-- 1. Neue Permissions einfügen
INSERT INTO permissions (key, category, label, description, sort_order) VALUES
  ('scope.manage',                 'scope', 'Scopes verwalten',             'Dienstplan-Scopes für Rollen konfigurieren',            10),
  ('staff.view_all_categories',    'scope', 'Alle Kategorien sehen',        'Mitarbeiter aller Kategorien sehen (ignoriert Scope)',   20),
  ('staff.edit_all_categories',    'scope', 'Alle Kategorien bearbeiten',   'Mitarbeiter aller Kategorien anlegen und bearbeiten',    30),
  ('shifts.manage_all_categories', 'scope', 'Alle Schichten verwalten',     'Schichten aller Kategorien bestätigen und löschen',     40),
  ('planning.view_all_categories', 'scope', 'Alle Kategorien im Planner',   'Alle Mitarbeiter in Stunden-Sidebar und Planner sehen', 50),
  ('planning.edit_all_categories', 'scope', 'Alle Slots bearbeiten',        'Alle Planner-Slots bearbeiten unabhängig vom Scope',    60)
ON CONFLICT (key) DO NOTHING;

-- 2. Owner-Rolle bekommt alle neuen Permissions automatisch
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000001', id
FROM permissions
WHERE key IN (
  'scope.manage',
  'staff.view_all_categories',
  'staff.edit_all_categories',
  'shifts.manage_all_categories',
  'planning.view_all_categories',
  'planning.edit_all_categories'
)
ON CONFLICT DO NOTHING;

-- 3. Admin-Rolle bekommt alle neuen Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000002', id
FROM permissions
WHERE key IN (
  'scope.manage',
  'staff.view_all_categories',
  'staff.edit_all_categories',
  'shifts.manage_all_categories',
  'planning.view_all_categories',
  'planning.edit_all_categories'
)
ON CONFLICT DO NOTHING;
