-- ============================================================
-- MIGRATION: role_staff_scopes
-- Dienstplan-Scope pro Rolle: welche Mitarbeiterkategorien
-- darf eine Rolle sehen/bearbeiten?
-- Keine Einträge für eine Rolle = Vollzugriff (alle Kategorien).
-- Kategorien entsprechen app_config.employee_roles (TEXT, kein Enum).
-- ============================================================

CREATE TABLE IF NOT EXISTS role_staff_scopes (
  role_id  UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  PRIMARY KEY (role_id, category)
);
