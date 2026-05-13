/* ============================================================
   PERMISSIONS MODULE
   Zentrale Konstanten und can()-Funktion für das Frontend.
   Ersetzt alle isAdmin()-Aufrufe durch granulare Rechtsprüfungen.
   ============================================================ */

// Alle Permission-Keys als Konstanten – kein Magic-String im restlichen Code
const PERM = {
  // Veranstaltungen
  EVENTS_VIEW:          'events.view',
  EVENTS_CREATE:        'events.create',
  EVENTS_EDIT:          'events.edit',
  EVENTS_DELETE:        'events.delete',
  EVENTS_IMPORT_AI:     'events.import_ai',
  EVENTS_EDIT_BRIEFING: 'events.edit_briefing',
  EVENTS_VIEW_NOTES:    'events.view_notes',

  // Mitarbeiterverwaltung
  STAFF_VIEW:             'staff.view',
  STAFF_CREATE:           'staff.create',
  STAFF_EDIT:             'staff.edit',
  STAFF_DELETE:           'staff.delete',
  STAFF_VIEW_CONTACT:     'staff.view_contact',
  STAFF_EDIT_CONTACT_OWN: 'staff.edit_contact_own',
  STAFF_VIEW_NOTES:       'staff.view_notes',
  STAFF_MANAGE_ACCESS:    'staff.manage_access',

  // Schichten
  SHIFTS_VIEW_ALL:    'shifts.view_all',
  SHIFTS_VIEW_OWN:    'shifts.view_own',
  SHIFTS_ASSIGN:      'shifts.assign',
  SHIFTS_EDIT:        'shifts.edit',
  SHIFTS_SWAP_APPROVE:'shifts.swap_approve',

  // Dienstplanung
  PLANNING_VIEW:          'planning.view',
  PLANNING_CREATE_PERIOD: 'planning.create_period',
  PLANNING_EDIT:          'planning.edit',
  PLANNING_PUBLISH:       'planning.publish',
  PLANNING_AI_GENERATE:   'planning.ai_generate',
  PLANNING_MANAGE_RULES:  'planning.manage_rules',

  // Kalender
  CALENDAR_VIEW:         'calendar.view',
  CALENDAR_VIEW_DETAILS: 'calendar.view_details',

  // Statistiken
  STATISTICS_VIEW:       'statistics.view',
  STATISTICS_VIEW_HOURS: 'statistics.view_hours',
  STATISTICS_EXPORT:     'statistics.export',

  // Besucherzahlen
  VISITORS_VIEW: 'visitors.view',
  VISITORS_EDIT: 'visitors.edit',

  // Kundenkarten
  CUSTOMER_CARDS_VIEW: 'customer_cards.view',
  CUSTOMER_CARDS_EDIT: 'customer_cards.edit',

  // Einstellungen
  SETTINGS_VIEW:             'settings.view',
  SETTINGS_EDIT_GENERAL:     'settings.edit_general',
  SETTINGS_EDIT_LOCATIONS:   'settings.edit_locations',
  SETTINGS_EDIT_CARD_FIELDS: 'settings.edit_card_fields',
  SETTINGS_EDIT_AI:          'settings.edit_ai',

  // Rollenverwaltung
  ROLES_VIEW:   'roles.view',
  ROLES_CREATE: 'roles.create',
  ROLES_EDIT:   'roles.edit',
  ROLES_DELETE: 'roles.delete',
  ROLES_ASSIGN: 'roles.assign',

  // Benutzerverwaltung
  USERS_VIEW:           'users.view',
  USERS_INVITE:         'users.invite',
  USERS_DELETE:         'users.delete',
  USERS_RESET_PASSWORD: 'users.reset_password',
  USERS_TOGGLE_ROLE:    'users.toggle_role',

  // Chat
  CHAT_ACCESS_ALL:      'chat.access_all',
  CHAT_DELETE_MESSAGES: 'chat.delete_messages',
};

// In-Memory Permission-Set des eingeloggten Users
// Wird von auth.js nach dem Login befüllt
let _currentPermissions = new Set();

// Prüft ob der aktuelle User ein bestimmtes Recht hat – O(1)
function can(permissionKey) {
  return _currentPermissions.has(permissionKey);
}

// Setzt die Permissions nach dem Login (Array von Keys)
function setPermissions(permissionKeys) {
  _currentPermissions = new Set(permissionKeys || []);
}

// Räumt Permissions beim Logout auf
function clearPermissions() {
  _currentPermissions = new Set();
}

// Gibt alle aktuellen Permissions zurück (für Debug)
function getPermissions() {
  return Array.from(_currentPermissions);
}

// Lädt Permissions vom Backend für den eingeloggten User
// Wird direkt nach dem Login aufgerufen
async function loadPermissions() {
  try {
    const session = await db.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) { clearPermissions(); return; }

    const res = await fetch('/api/roles?action=userPermissions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { clearPermissions(); return; }
    const data = await res.json();
    setPermissions(data.permissions || []);
  } catch {
    clearPermissions();
  }
}

// Wendet Permission-abhängige CSS-Klassen auf body an
// Ersetzt applyAdminMode() – ermöglicht CSS-Selektor-basiertes Hiding
function applyPermissionClasses() {
  const classes = [
    [PERM.EVENTS_EDIT,          'can-edit-events'],
    [PERM.EVENTS_CREATE,        'can-create-events'],
    [PERM.EVENTS_IMPORT_AI,     'can-import-ai'],
    [PERM.STAFF_EDIT,           'can-edit-staff'],
    [PERM.STAFF_MANAGE_ACCESS,  'can-manage-access'],
    [PERM.PLANNING_EDIT,        'can-edit-planning'],
    [PERM.PLANNING_AI_GENERATE, 'can-ai-generate'],
    [PERM.SHIFTS_ASSIGN,        'can-assign-shifts'],
    [PERM.SETTINGS_EDIT_GENERAL,'can-edit-settings'],
    [PERM.ROLES_EDIT,           'can-edit-roles'],
    [PERM.USERS_INVITE,         'can-invite-users'],
  ];
  classes.forEach(([perm, cls]) => {
    document.body.classList.toggle(cls, can(perm));
  });

  // Legacy: 'admin'-Klasse für bestehende CSS-Selektoren
  // Wird entfernt wenn alle CSS-Regeln migriert sind
  const hasAdminLike = can(PERM.EVENTS_EDIT) || can(PERM.STAFF_EDIT);
  document.body.classList.toggle('admin', hasAdminLike);
}
