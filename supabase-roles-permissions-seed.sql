-- ============================================================
-- SEED: Standard-Rollen, Permissions und User-Migration
-- Branch: claude/analyze-roles-permissions-kW7yd
--
-- Voraussetzung: supabase-roles-permissions-migration.sql
-- wurde bereits ausgeführt.
--
-- Dieses Skript ist IDEMPOTENT (mehrfach ausführbar).
-- ============================================================


-- ------------------------------------------------------------
-- 1. STANDARD-ROLLEN anlegen
-- ------------------------------------------------------------
INSERT INTO roles (id, name, description, color, is_system, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Owner',       'Voller Systemzugriff, nicht löschbar',          '#ef4444', true,  0),
  ('00000000-0000-0000-0000-000000000002', 'Admin',       'Verwaltung von Events, Mitarbeitern und Planung','#f97316', false, 1),
  ('00000000-0000-0000-0000-000000000003', 'Mitarbeiter', 'Eigene Schichten und Chat einsehen',             '#6b7280', false, 2)
ON CONFLICT (name) DO NOTHING;


-- ------------------------------------------------------------
-- 2. ALLE PERMISSIONS anlegen
-- ------------------------------------------------------------
INSERT INTO permissions (key, category, label, description, sort_order) VALUES

  -- Veranstaltungen
  ('events.view',          'events', 'Veranstaltungen ansehen',       'Kalender und Eventliste einsehen',              10),
  ('events.create',        'events', 'Veranstaltung erstellen',       'Neue Veranstaltung anlegen',                    20),
  ('events.edit',          'events', 'Veranstaltungen bearbeiten',    'Bestehende Events ändern',                      30),
  ('events.delete',        'events', 'Veranstaltungen löschen',       'Events dauerhaft löschen',                      40),
  ('events.import_ai',     'events', 'KI-Import (OCR/PDF)',           'Events per Bild, PDF oder Excel importieren',   50),
  ('events.edit_briefing', 'events', 'Briefing bearbeiten',           'Event-Briefing erstellen und ändern',           60),
  ('events.view_notes',    'events', 'Notizen einsehen',              'Interne Bemerkungen zu Events sehen',           70),

  -- Mitarbeiterverwaltung
  ('staff.view',             'staff', 'Mitarbeiterliste ansehen',     'Alle Mitarbeiter einsehen',                     10),
  ('staff.create',           'staff', 'Mitarbeiter anlegen',          'Neue Mitarbeiter erstellen',                    20),
  ('staff.edit',             'staff', 'Mitarbeiter bearbeiten',       'Mitarbeiterdaten ändern',                       30),
  ('staff.delete',           'staff', 'Mitarbeiter löschen',          'Mitarbeiter dauerhaft entfernen',               40),
  ('staff.view_contact',     'staff', 'Kontaktdaten einsehen',        'Telefon, E-Mail, Notfallkontakt sehen',         50),
  ('staff.edit_contact_own', 'staff', 'Eigene Kontaktdaten bearbeiten','Eigene Kontakt- und Notfalldaten aktualisieren',60),
  ('staff.view_notes',       'staff', 'Interne Notizen sehen',        'Interne Mitarbeiternotizen einsehen',           70),
  ('staff.manage_access',    'staff', 'Zugänge verwalten',            'Login-Zugänge erstellen, zurücksetzen, löschen',80),

  -- Schichten
  ('shifts.view_all',      'shifts', 'Alle Schichten sehen',          'Schichtplan aller Mitarbeiter einsehen',        10),
  ('shifts.view_own',      'shifts', 'Eigene Schichten sehen',        'Nur eigene Einteilungen ansehen',               20),
  ('shifts.assign',        'shifts', 'Mitarbeiter einteilen',         'Mitarbeiter auf Events einteilen',              30),
  ('shifts.edit',          'shifts', 'Schichten bearbeiten',          'Schichtzeiten und Positionen ändern',           40),
  ('shifts.swap_approve',  'shifts', 'Schichttausch genehmigen',      'Tauchanfragen prüfen und freigeben',            50),

  -- Dienstplanung
  ('planning.view',           'planning', 'Planung einsehen',              'Planungsübersicht ansehen',                    10),
  ('planning.create_period',  'planning', 'Planungsperiode erstellen',      'Neue Planungsperiode anlegen',                 20),
  ('planning.edit',           'planning', 'Plan bearbeiten',               'Besetzungen im Plan ändern',                   30),
  ('planning.publish',        'planning', 'Plan veröffentlichen',          'Fertigen Plan für Mitarbeiter freigeben',       40),
  ('planning.ai_generate',    'planning', 'KI-Dienstplan generieren',       'Automatischen KI-Besetzungsvorschlag erstellen',50),
  ('planning.manage_rules',   'planning', 'Planungsregeln verwalten',       'Stundenregeln und Pausenregeln bearbeiten',    60),

  -- Kalender
  ('calendar.view',         'calendar', 'Kalender ansehen',           'Kalenderansicht öffnen',                        10),
  ('calendar.view_details', 'calendar', 'Detailinfos im Kalender',   'Vollständige Eventdaten im Kalender sehen',     20),

  -- Statistiken
  ('statistics.view',       'statistics', 'Statistiken ansehen',     'Auswertungen einsehen',                         10),
  ('statistics.view_hours', 'statistics', 'Stundennachweise',        'Stundenabrechnungen der Mitarbeiter sehen',     20),
  ('statistics.export',     'statistics', 'Statistiken exportieren', 'Daten als CSV/Excel exportieren',               30),

  -- Besucherzahlen
  ('visitors.view',         'visitors', 'Besucherzahlen ansehen',    'Besucherzahlen der Events einsehen',            10),
  ('visitors.edit',         'visitors', 'Besucherzahlen eintragen',  'Besucherzahlen erfassen und bearbeiten',        20),

  -- Kundenkarten
  ('customer_cards.view',   'customer_cards', 'Kundenkarten-Info ansehen',  'Kundenkarten-Typ am Event sehen',         10),
  ('customer_cards.edit',   'customer_cards', 'Kundenkarten-Typ setzen',    'Kundenkarten-Typ am Event festlegen',     20),

  -- Einstellungen
  ('settings.view',              'settings', 'Einstellungen ansehen',           'Systemeinstellungen lesen',                10),
  ('settings.edit_general',      'settings', 'Allg. Einstellungen bearbeiten', 'Standard-Zeiten und globale Optionen',     20),
  ('settings.edit_locations',    'settings', 'Locations verwalten',            'Locations erstellen, bearbeiten, löschen', 30),
  ('settings.edit_card_fields',  'settings', 'Kartenfelder konfigurieren',     'Sichtbarkeit von Kartenfeldern steuern',   40),
  ('settings.edit_ai',           'settings', 'KI-Features aktivieren',         'KI-Import und KI-Planer an/ausschalten',   50),

  -- Rollenverwaltung
  ('roles.view',    'roles', 'Rollen ansehen',     'Rollenliste und Rechte einsehen',                  10),
  ('roles.create',  'roles', 'Rolle erstellen',    'Neue Rollen anlegen',                              20),
  ('roles.edit',    'roles', 'Rollen bearbeiten',  'Rollen umbenennen und Rechte zuweisen',            30),
  ('roles.delete',  'roles', 'Rollen löschen',     'Nicht-System-Rollen entfernen',                    40),
  ('roles.assign',  'roles', 'Rollen zuweisen',    'Benutzern eine andere Rolle zuweisen',             50),

  -- Benutzerverwaltung
  ('users.view',            'users', 'Nutzerliste einsehen',     'Alle Benutzeraccounts ansehen',                10),
  ('users.invite',          'users', 'Nutzer einladen',          'Neue Benutzer mit temporärem Passwort anlegen', 20),
  ('users.delete',          'users', 'Nutzer löschen',           'Benutzeraccounts dauerhaft entfernen',         30),
  ('users.reset_password',  'users', 'Passwort zurücksetzen',    'Temporäres Passwort für Nutzer generieren',    40),
  ('users.toggle_role',     'users', 'Rolle ändern',             'Rolle eines Nutzers wechseln',                 50),

  -- Chat
  ('chat.access_all',       'chat', 'Chat aller Events',         'Chat-Zugang auch ohne Einteilung',             10),
  ('chat.delete_messages',  'chat', 'Nachrichten löschen',       'Fremde Chat-Nachrichten entfernen',            20)

ON CONFLICT (key) DO NOTHING;


-- ------------------------------------------------------------
-- 3. OWNER-ROLLE: Alle Permissions zuweisen
-- ------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  '00000000-0000-0000-0000-000000000001',
  id
FROM permissions
ON CONFLICT DO NOTHING;


-- ------------------------------------------------------------
-- 4. ADMIN-ROLLE: Alle Permissions außer Rollenverwaltung-Delete
--    und User-Delete (Sicherheitspuffer)
-- ------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  '00000000-0000-0000-0000-000000000002',
  id
FROM permissions
WHERE key NOT IN (
  'roles.delete',
  'users.delete'
)
ON CONFLICT DO NOTHING;


-- ------------------------------------------------------------
-- 5. MITARBEITER-ROLLE: Basisrechte
-- ------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  '00000000-0000-0000-0000-000000000003',
  id
FROM permissions
WHERE key IN (
  'events.view',
  'calendar.view',
  'shifts.view_own',
  'staff.edit_contact_own',
  'planning.view'
)
ON CONFLICT DO NOTHING;


-- ------------------------------------------------------------
-- 6. USER-MIGRATION: bestehende Nutzer auf neue Rollen mappen
--    Läuft in einer Transaktion – bei Fehler vollständiges Rollback
-- ------------------------------------------------------------
BEGIN;

  -- Alte 'admin' → Owner-Rolle (UUID 000...001)
  UPDATE profiles
  SET role_id = '00000000-0000-0000-0000-000000000001'
  WHERE role = 'admin'
    AND role_id IS NULL;

  -- Alte 'viewer' → Mitarbeiter-Rolle (UUID 000...003)
  UPDATE profiles
  SET role_id = '00000000-0000-0000-0000-000000000003'
  WHERE role = 'viewer'
    AND role_id IS NULL;

  -- Alle verbleibenden NULL-Einträge → Mitarbeiter (Fallback)
  UPDATE profiles
  SET role_id = '00000000-0000-0000-0000-000000000003'
  WHERE role_id IS NULL;

COMMIT;


-- ------------------------------------------------------------
-- ÜBERPRÜFUNG (optional – gibt Migration-Status aus)
-- ------------------------------------------------------------
SELECT
  r.name AS rolle,
  COUNT(p.id) AS anzahl_nutzer
FROM profiles p
JOIN roles r ON r.id = p.role_id
GROUP BY r.name
ORDER BY r.name;
