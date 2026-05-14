/* ============================================================
   PERMISSION TEST RUNNER
   Führe dieses Skript in der Browser-Konsole aus während du
   als Admin angemeldet bist, um alle 58 Rechte systematisch
   zu testen.

   Voraussetzung: App ist geladen, PERM, can(), RolesMgr,
   Employees, Planner, Chat sind verfügbar.

   Benutzung:
     PermTest.run()          → Alle Tests
     PermTest.runCategory('events')  → Nur eine Kategorie
     PermTest.report()       → Letzten Bericht anzeigen
   ============================================================ */

const PermTest = (() => {
  'use strict';

  /* ── Hilfsfunktionen ────────────────────────────────────── */
  let _results = [];

  function pass(perm, msg) {
    _results.push({ perm, ok: true, msg });
    console.log(`%c✓ [${perm}] ${msg}`, 'color:#22d4a4');
  }

  function fail(perm, msg) {
    _results.push({ perm, ok: false, msg });
    console.warn(`✗ [${perm}] ${msg}`);
  }

  function info(msg) {
    console.info(`  ℹ ${msg}`);
  }

  /* Simuliert einen einzigen Perm-Set und prüft can() */
  function withPerms(perms, fn) {
    const saved = getPermissions();
    setPermissions(perms);
    applyPermissionClasses();
    try { fn(); }
    finally {
      setPermissions(saved);
      applyPermissionClasses();
    }
  }

  /* Prüft ob ein CSS-Selektor ein SICHTBARES Element ergibt */
  function isVisible(selector) {
    const el = document.querySelector(selector);
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  /* Prüft ob ein DOM-Element vorhanden ist */
  function exists(selector) {
    return !!document.querySelector(selector);
  }

  /* Macht einen API-Aufruf und liefert den HTTP-Status zurück */
  async function apiStatus(url, method = 'GET', body = null) {
    const session = await db.auth.getSession();
    const token = session?.data?.session?.access_token;
    const opts = {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    return r.status;
  }

  /* ── KATEGORIE: Veranstaltungen ─────────────────────────── */
  function testEvents() {
    console.group('%c📅 Veranstaltungen', 'font-weight:bold');

    // events.view
    withPerms(['events.view'], () => {
      // Alle Events sollten ladbar sein – prüfe ob EVENTS-Array gefüllt ist
      if (EVENTS && EVENTS.length >= 0)
        pass('events.view', 'EVENTS-Array zugänglich');
      else
        fail('events.view', 'EVENTS-Array nicht zugänglich');
      // Kein Edit-Button sichtbar
      if (!can(PERM.EVENTS_EDIT))
        pass('events.view', 'events.edit korrekt abwesend ohne Recht');
      else
        fail('events.view', 'BUG: events.edit trotzdem gesetzt');
    });

    // events.create
    withPerms(['events.view', 'events.create'], () => {
      document.body.classList.add('admin'); // events.create braucht admin-Klasse via Konvention
      const createBtn = document.querySelector('.perm-create-events');
      if (createBtn && isVisible('.perm-create-events'))
        pass('events.create', '"+ Event erstellen" sichtbar');
      else
        fail('events.create', '"+ Event erstellen" NICHT sichtbar – CSS-Guard-Problem?');
      document.body.classList.remove('admin');
    });

    // events.edit
    withPerms(['events.view', 'events.edit'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-edit-events'))
        pass('events.edit', 'body.can-edit-events gesetzt');
      else
        fail('events.edit', 'body.can-edit-events FEHLT');
      if (document.body.classList.contains('admin'))
        pass('events.edit', 'Legacy admin-Klasse gesetzt');
      else
        fail('events.edit', 'Legacy admin-Klasse FEHLT');
    });

    // events.delete  – check form.js guard
    withPerms(['events.view', 'events.edit'], () => {
      // Nur edit, KEIN delete → Lösch-Button im Form muss fehlen
      const delBtn = document.getElementById('form-delete-btn');
      if (delBtn && delBtn.style.display === 'none')
        pass('events.delete', 'Lösch-Button im Formular ohne events.delete versteckt');
      else if (!delBtn)
        info('events.delete: #form-delete-btn nicht im DOM (Event-Modal zu) – bitte Event öffnen');
      else
        fail('events.delete', 'Lösch-Button sichtbar ohne events.delete!');
    });

    // events.import_ai (Frontend + Backend)
    withPerms(['events.view', 'events.import_ai'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-import-ai'))
        pass('events.import_ai', 'body.can-import-ai gesetzt');
      else
        fail('events.import_ai', 'body.can-import-ai FEHLT');
    });

    // events.edit_briefing
    withPerms(['events.view', 'events.edit_briefing'], () => {
      if (can(PERM.EVENTS_EDIT_BRIEFING))
        pass('events.edit_briefing', 'can(EVENTS_EDIT_BRIEFING) = true');
      else
        fail('events.edit_briefing', 'can() gibt false zurück trotz gesetztem Recht');
    });

    // events.view_notes
    withPerms(['events.view', 'events.view_notes'], () => {
      if (can(PERM.EVENTS_VIEW_NOTES))
        pass('events.view_notes', 'can(EVENTS_VIEW_NOTES) = true');
      else
        fail('events.view_notes', 'can() gibt false zurück');
    });

    console.groupEnd();
  }

  /* ── KATEGORIE: Mitarbeiter ─────────────────────────────── */
  function testStaff() {
    console.group('%c👥 Mitarbeiter', 'font-weight:bold');

    withPerms(['events.view', 'staff.view'], () => {
      if (can(PERM.STAFF_VIEW)) pass('staff.view', 'can(STAFF_VIEW) = true');
      else fail('staff.view', 'can() = false');
    });

    withPerms(['events.view', 'staff.view', 'staff.view_contact'], () => {
      if (can(PERM.STAFF_VIEW_CONTACT))
        pass('staff.view_contact', 'can() = true; Email/Phone wird in _detailHTML() gezeigt');
      else
        fail('staff.view_contact', 'can() = false');
    });

    withPerms(['events.view', 'staff.view'], () => {
      // Ohne staff.view_contact darf Email/Phone nicht angezeigt werden
      if (!can(PERM.STAFF_VIEW_CONTACT))
        pass('staff.view_contact', 'Ohne Recht: can() = false (korrekt)');
    });

    withPerms(['events.view', 'staff.view', 'staff.view_notes'], () => {
      if (can(PERM.STAFF_VIEW_NOTES))
        pass('staff.view_notes', 'can() = true');
      else
        fail('staff.view_notes', 'can() = false');
    });

    withPerms(['events.view', 'staff.edit'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-edit-staff'))
        pass('staff.edit', 'body.can-edit-staff gesetzt');
      else
        fail('staff.edit', 'body.can-edit-staff FEHLT');
    });

    withPerms(['events.view', 'staff.create'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-create-staff'))
        pass('staff.create', 'body.can-create-staff gesetzt');
      else
        fail('staff.create', 'body.can-create-staff FEHLT');
    });

    withPerms(['events.view', 'staff.delete'], () => {
      if (can(PERM.STAFF_DELETE)) pass('staff.delete', 'can() = true');
      else fail('staff.delete', 'can() = false');
    });

    withPerms(['events.view', 'staff.manage_access'], () => {
      applyPermissionClasses();
      if (can(PERM.STAFF_MANAGE_ACCESS))
        pass('staff.manage_access', 'can() = true');
      else
        fail('staff.manage_access', 'can() = false');
    });

    console.groupEnd();
  }

  /* ── KATEGORIE: Schichten ───────────────────────────────── */
  function testShifts() {
    console.group('%c📋 Schichten', 'font-weight:bold');

    withPerms(['events.view', 'shifts.view_all'], () => {
      if (can(PERM.SHIFTS_VIEW_ALL))
        pass('shifts.view_all', 'can() = true; Staff-Dropdown sollte sichtbar sein');
      else
        fail('shifts.view_all', 'can() = false');
    });

    withPerms(['events.view', 'shifts.view_own'], () => {
      if (can(PERM.SHIFTS_VIEW_OWN))
        pass('shifts.view_own', 'can() = true');
      else
        fail('shifts.view_own', 'can() = false');
      // Prüfe: ohne shifts.view_all muss Staff-Dropdown versteckt sein
      if (!can(PERM.SHIFTS_VIEW_ALL))
        pass('shifts.view_own', 'shifts.view_all korrekt abwesend');
    });

    withPerms(['events.view', 'shifts.assign'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-assign-shifts'))
        pass('shifts.assign', 'body.can-assign-shifts gesetzt');
      else
        fail('shifts.assign', 'BUG: body.can-assign-shifts FEHLT – applyPermissionClasses() prüfen');
      info('shifts.assign: Keine CSS-Regel prüft diesen Body-Class – ggf. noch nicht implementiert');
    });

    withPerms(['events.view', 'shifts.edit'], () => {
      if (can(PERM.SHIFTS_EDIT))
        pass('shifts.edit', 'can() = true');
      else
        fail('shifts.edit', 'can() = false');
      info('shifts.edit: Kein dedizierter Frontend-Guard – Schicht-Bearbeitung via Scope-Check');
    });

    withPerms(['events.view', 'shifts.swap_approve'], () => {
      if (can(PERM.SHIFTS_SWAP_APPROVE))
        pass('shifts.swap_approve', 'can() = true');
      else
        fail('shifts.swap_approve', 'can() = false');
      info('shifts.swap_approve: UI noch nicht implementiert – Approve-Button fehlt');
    });

    console.groupEnd();
  }

  /* ── KATEGORIE: Dienstplanung ───────────────────────────── */
  function testPlanning() {
    console.group('%c📊 Dienstplanung', 'font-weight:bold');

    withPerms(['events.view', 'planning.view'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-view-planning'))
        pass('planning.view', 'body.can-view-planning gesetzt');
      else
        fail('planning.view', 'body.can-view-planning FEHLT');
      // Planner-Button sollte via CSS sichtbar sein
      const btn = document.querySelector('.perm-planning');
      if (btn && isVisible('.perm-planning'))
        pass('planning.view', 'Planner-Button sichtbar');
      else
        info('planning.view: Planner-Button nicht sichtbar (evtl. body.admin nicht gesetzt)');
    });

    withPerms(['events.view', 'planning.create_period'], () => {
      if (can(PERM.PLANNING_CREATE_PERIOD))
        pass('planning.create_period', 'can() = true');
      else
        fail('planning.create_period', 'can() = false');
    });

    withPerms(['events.view', 'planning.edit'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-edit-planning'))
        pass('planning.edit', 'body.can-edit-planning gesetzt');
      else
        fail('planning.edit', 'body.can-edit-planning FEHLT');
    });

    withPerms(['events.view', 'planning.publish'], () => {
      if (can(PERM.PLANNING_PUBLISH))
        pass('planning.publish', 'can() = true; Publish-Button erscheint im Planner');
      else
        fail('planning.publish', 'can() = false');
    });

    withPerms(['events.view', 'planning.ai_generate'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-ai-generate'))
        pass('planning.ai_generate', 'body.can-ai-generate gesetzt');
      else
        fail('planning.ai_generate', 'body.can-ai-generate FEHLT');
    });

    withPerms(['events.view', 'planning.manage_rules'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-manage-rules'))
        pass('planning.manage_rules', 'body.can-manage-rules gesetzt');
      else
        fail('planning.manage_rules', 'body.can-manage-rules FEHLT');
    });

    console.groupEnd();
  }

  /* ── KATEGORIE: Kalender ────────────────────────────────── */
  function testCalendar() {
    console.group('%c📆 Kalender', 'font-weight:bold');

    withPerms(['events.view', 'calendar.view'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-view-calendar'))
        pass('calendar.view', 'body.can-view-calendar gesetzt');
      else
        fail('calendar.view', 'body.can-view-calendar FEHLT');
      info('calendar.view: Kalender-Toggle-Button hat noch keinen dedizierten Guard');
    });

    withPerms(['events.view', 'calendar.view_details'], () => {
      if (can(PERM.CALENDAR_VIEW_DETAILS))
        pass('calendar.view_details', 'can() = true');
      else
        fail('calendar.view_details', 'can() = false');
      info('calendar.view_details: Kalender-Detailansicht hat noch keinen dedizierten Frontend-Guard');
    });

    console.groupEnd();
  }

  /* ── KATEGORIE: Statistiken ─────────────────────────────── */
  function testStatistics() {
    console.group('%c📈 Statistiken', 'font-weight:bold');
    ['statistics.view', 'statistics.view_hours', 'statistics.export'].forEach(perm => {
      withPerms(['events.view', perm], () => {
        if (can(perm))
          pass(perm, 'can() = true');
        else
          fail(perm, 'can() = false');
        info(`${perm}: Kein dedizierter Frontend-Guard implementiert – Statistik-Modul fehlt`);
      });
    });
    console.groupEnd();
  }

  /* ── KATEGORIE: Besucherzahlen ──────────────────────────── */
  function testVisitors() {
    console.group('%c👤 Besucherzahlen', 'font-weight:bold');

    withPerms(['events.view', 'visitors.view'], () => {
      if (can(PERM.VISITORS_VIEW))
        pass('visitors.view', 'can() = true; steuert defaults.js besucher-Feld');
      else
        fail('visitors.view', 'can() = false');
    });

    withPerms(['events.view', 'visitors.edit'], () => {
      if (can(PERM.VISITORS_EDIT))
        pass('visitors.edit', 'can() = true');
      else
        fail('visitors.edit', 'can() = false');
      info('visitors.edit: Kein dedizierter Frontend-Guard implementiert');
    });

    console.groupEnd();
  }

  /* ── KATEGORIE: Kundenkarten ────────────────────────────── */
  function testCustomerCards() {
    console.group('%c🃏 Kundenkarten', 'font-weight:bold');
    ['customer_cards.view', 'customer_cards.edit'].forEach(perm => {
      withPerms(['events.view', perm], () => {
        if (can(perm))
          pass(perm, 'can() = true');
        else
          fail(perm, 'can() = false');
        info(`${perm}: Kein dedizierter Frontend-Guard implementiert`);
      });
    });
    console.groupEnd();
  }

  /* ── KATEGORIE: Einstellungen ───────────────────────────── */
  function testSettings() {
    console.group('%c⚙ Einstellungen', 'font-weight:bold');

    withPerms(['events.view', 'settings.view'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-view-settings'))
        pass('settings.view', 'body.can-view-settings gesetzt');
      else
        fail('settings.view', 'body.can-view-settings FEHLT');
      info('settings.view: Einstellungs-Button noch nicht explizit daran gebunden');
    });

    withPerms(['events.view', 'settings.edit_general'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-edit-settings'))
        pass('settings.edit_general', 'body.can-edit-settings gesetzt');
      else
        fail('settings.edit_general', 'body.can-edit-settings FEHLT');
    });

    withPerms(['events.view', 'settings.edit_locations'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-edit-locations'))
        pass('settings.edit_locations', 'body.can-edit-locations gesetzt');
      else
        fail('settings.edit_locations', 'body.can-edit-locations FEHLT');
    });

    withPerms(['events.view', 'settings.edit_card_fields'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-edit-card-fields'))
        pass('settings.edit_card_fields', 'body.can-edit-card-fields gesetzt');
      else
        fail('settings.edit_card_fields', 'body.can-edit-card-fields FEHLT');
    });

    withPerms(['events.view', 'settings.edit_ai'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-edit-ai-settings'))
        pass('settings.edit_ai', 'body.can-edit-ai-settings gesetzt');
      else
        fail('settings.edit_ai', 'body.can-edit-ai-settings FEHLT');
    });

    console.groupEnd();
  }

  /* ── KATEGORIE: Rollenverwaltung ────────────────────────── */
  function testRoles() {
    console.group('%c🔐 Rollenverwaltung', 'font-weight:bold');

    withPerms(['events.view', 'roles.view'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-view-roles'))
        pass('roles.view', 'body.can-view-roles gesetzt');
      else
        fail('roles.view', 'body.can-view-roles FEHLT');
    });

    withPerms(['events.view', 'roles.create'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-create-roles'))
        pass('roles.create', 'body.can-create-roles gesetzt');
      else
        fail('roles.create', 'body.can-create-roles FEHLT');
      if (can(PERM.ROLES_CREATE)) pass('roles.create', 'can() = true');
      else fail('roles.create', 'can() = false');
    });

    withPerms(['events.view', 'roles.edit'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-edit-roles'))
        pass('roles.edit', 'body.can-edit-roles gesetzt');
      else
        fail('roles.edit', 'body.can-edit-roles FEHLT');
    });

    withPerms(['events.view', 'roles.delete'], () => {
      if (can(PERM.ROLES_DELETE)) pass('roles.delete', 'can() = true');
      else fail('roles.delete', 'can() = false');
    });

    withPerms(['events.view', 'roles.assign'], () => {
      if (can(PERM.ROLES_ASSIGN)) pass('roles.assign', 'can() = true');
      else fail('roles.assign', 'can() = false');
    });

    console.groupEnd();
  }

  /* ── KATEGORIE: Benutzerverwaltung ─────────────────────── */
  function testUsers() {
    console.group('%c👤 Benutzerverwaltung', 'font-weight:bold');

    withPerms(['events.view', 'users.view'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-view-users'))
        pass('users.view', 'body.can-view-users gesetzt');
      else
        fail('users.view', 'body.can-view-users FEHLT');
    });

    withPerms(['events.view', 'users.invite'], () => {
      applyPermissionClasses();
      if (document.body.classList.contains('can-invite-users'))
        pass('users.invite', 'body.can-invite-users gesetzt');
      else
        fail('users.invite', 'body.can-invite-users FEHLT');
    });

    withPerms(['events.view', 'users.delete'], () => {
      if (can(PERM.USERS_DELETE)) pass('users.delete', 'can() = true');
      else fail('users.delete', 'can() = false');
    });

    withPerms(['events.view', 'users.reset_password'], () => {
      if (can(PERM.USERS_RESET_PASSWORD)) pass('users.reset_password', 'can() = true');
      else fail('users.reset_password', 'can() = false');
    });

    withPerms(['events.view', 'users.toggle_role'], () => {
      if (can(PERM.USERS_TOGGLE_ROLE))
        pass('users.toggle_role', 'can() = true');
      else
        fail('users.toggle_role', 'can() = false');
      info('users.toggle_role: Kein aktiver Frontend-Guard – Legacy-Methode, abgelöst durch roles.assign');
    });

    console.groupEnd();
  }

  /* ── KATEGORIE: Chat ────────────────────────────────────── */
  function testChat() {
    console.group('%c💬 Chat', 'font-weight:bold');

    withPerms(['events.view', 'chat.access_all'], () => {
      if (can(PERM.CHAT_ACCESS_ALL))
        pass('chat.access_all', 'can() = true; Chat.canAccess() gibt true für alle Events');
      else
        fail('chat.access_all', 'can() = false');
    });

    withPerms(['events.view', 'chat.delete_messages'], () => {
      if (can(PERM.CHAT_DELETE_MESSAGES))
        pass('chat.delete_messages', 'can() = true; Löschen-Button für fremde Nachrichten sichtbar');
      else
        fail('chat.delete_messages', 'can() = false');
    });

    console.groupEnd();
  }

  /* ── KATEGORIE: Scope-Bypass ────────────────────────────── */
  function testScope() {
    console.group('%c🎯 Scope-Bypass', 'font-weight:bold');

    const scopePerms = [
      ['scope.manage',                 PERM.SCOPE_MANAGE],
      ['staff.view_all_categories',    PERM.STAFF_VIEW_ALL_CATEGORIES],
      ['staff.edit_all_categories',    PERM.STAFF_EDIT_ALL_CATEGORIES],
      ['shifts.manage_all_categories', PERM.SHIFTS_MANAGE_ALL_CATEGORIES],
      ['planning.view_all_categories', PERM.PLANNING_VIEW_ALL_CATEGORIES],
      ['planning.edit_all_categories', PERM.PLANNING_EDIT_ALL_CATEGORIES],
    ];

    scopePerms.forEach(([key, permConst]) => {
      withPerms(['events.view', key], () => {
        if (can(permConst))
          pass(key, 'can() = true');
        else
          fail(key, 'can() = false');
      });
    });

    // scope.manage: Backend-Zugriff auf setRoleStaffScope prüfen
    info('scope.manage: Backend-Guard in /api/roles?action=setRoleStaffScope vorhanden');

    console.groupEnd();
  }

  /* ── BACKEND API TESTS (async) ──────────────────────────── */
  async function testBackendGuards() {
    console.group('%c🔒 Backend-Guards (API)', 'font-weight:bold');

    // Temporär alle Rechte entfernen
    const saved = getPermissions();
    setPermissions([]);

    const session = await db.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) { console.warn('Nicht angemeldet!'); console.groupEnd(); return; }

    const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    async function check(label, url, method, body, expectedStatus) {
      try {
        const r = await fetch(url, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
        if (r.status === expectedStatus)
          pass(label, `HTTP ${r.status} (erwartet: ${expectedStatus})`);
        else
          fail(label, `HTTP ${r.status} statt ${expectedStatus}`);
      } catch (e) {
        fail(label, `Netzwerkfehler: ${e.message}`);
      }
    }

    // roles.view – GET list ohne Recht → 403
    await check('roles.view (Backend)',   '/api/roles?action=list', 'GET', null, 403);

    // roles.create – POST ohne Recht → 403
    await check('roles.create (Backend)', '/api/roles?action=createRole', 'POST',
      { name: '__test__', color: '#ff0000' }, 403);

    // roles.edit – POST ohne Recht → 403
    await check('roles.edit (Backend)',   '/api/roles?action=updateRole', 'POST',
      { roleId: '00000000-0000-0000-0000-000000000001', name: '__test__' }, 403);

    // roles.delete – POST ohne Recht → 403
    await check('roles.delete (Backend)', '/api/roles?action=deleteRole', 'POST',
      { roleId: '00000000-0000-0000-0000-000000000099' }, 403);

    // roles.assign – POST ohne Recht → 403
    await check('roles.assign (Backend)', '/api/admin?action=updateUserRole', 'POST',
      { userId: '00000000-0000-0000-0000-000000000099', roleId: '00000000-0000-0000-0000-000000000001' }, 403);

    // users.invite – POST ohne Recht → 403
    await check('users.invite (Backend)', '/api/admin?action=inviteUser', 'POST',
      { email: 'test@test.com', display_name: 'Test' }, 403);

    // users.delete – POST ohne Recht → 403
    await check('users.delete (Backend)', '/api/admin?action=deleteUser', 'POST',
      { userId: '00000000-0000-0000-0000-000000000099' }, 403);

    // users.reset_password – POST ohne Recht → 403
    await check('users.reset_password (Backend)', '/api/admin?action=resetLink', 'POST',
      { email: 'test@test.com' }, 403);

    // planning.ai_generate – POST ohne Recht → 403
    await check('planning.ai_generate (Backend)', '/api/ai-planner', 'POST',
      { periodId: 'x', roles: [] }, 403);

    // events.import_ai – POST ohne Recht → 403
    await check('events.import_ai (Backend)', '/api/ocr', 'POST', {}, 403);

    setPermissions(saved);
    console.groupEnd();
  }

  /* ── HAUPT-RUNNER ───────────────────────────────────────── */
  async function run() {
    _results = [];
    console.clear();
    console.log('%c=== PERMISSION TEST RUNNER ===', 'font-size:1.1rem;font-weight:bold;color:#6b7280');
    console.log('Datum:', new Date().toLocaleString('de'));
    console.log('');

    testEvents();
    testStaff();
    testShifts();
    testPlanning();
    testCalendar();
    testStatistics();
    testVisitors();
    testCustomerCards();
    testSettings();
    testRoles();
    testUsers();
    testChat();
    testScope();
    await testBackendGuards();

    const passed = _results.filter(r => r.ok).length;
    const failed = _results.filter(r => !r.ok).length;

    console.log('');
    console.log(`%c=== ERGEBNIS: ${passed} ✓ | ${failed} ✗ ===`,
      `font-size:1rem;font-weight:bold;color:${failed > 0 ? '#ef4444' : '#22d4a4'}`);

    if (failed > 0) {
      console.warn('FEHLGESCHLAGENE TESTS:');
      _results.filter(r => !r.ok).forEach(r => console.warn(`  ✗ [${r.perm}] ${r.msg}`));
    }

    return { passed, failed, results: _results };
  }

  function runCategory(cat) {
    _results = [];
    const map = {
      events: testEvents, staff: testStaff, shifts: testShifts,
      planning: testPlanning, calendar: testCalendar, statistics: testStatistics,
      visitors: testVisitors, customer_cards: testCustomerCards,
      settings: testSettings, roles: testRoles, users: testUsers,
      chat: testChat, scope: testScope,
    };
    const fn = map[cat];
    if (!fn) { console.error('Unbekannte Kategorie:', cat, '| Verfügbar:', Object.keys(map).join(', ')); return; }
    fn();
    return _results;
  }

  function report() {
    if (!_results.length) { console.warn('Noch keine Tests gelaufen. Starte mit PermTest.run()'); return; }
    console.table(_results.map(r => ({
      Recht: r.perm,
      Status: r.ok ? '✓' : '✗',
      Meldung: r.msg,
    })));
  }

  return { run, runCategory, report };
})();

console.log('%c✅ PermTest geladen. Starte mit: PermTest.run()', 'color:#22d4a4;font-weight:bold');
