# Permission-Test: Befunde & Fixes

Stand: 2026-05-14  
Branch: `claude/test-permissions-counter-app-aLxV7`

---

## Methodik

Jede der 58 Permissions wurde per Codereview auf folgende Punkte geprüft:
- **Frontend-Guard**: Wird `can(PERM.xxx)` bzw. ein CSS-Body-Class-Pattern korrekt verwendet?
- **Backend-Guard**: Prüft der API-Handler das Recht via `hasPermissionOrLegacyAdmin()`?
- **applyPermissionClasses()**: Wird die entsprechende `can-*` Body-Klasse gesetzt?

Automatisierter Test: `js/permission-test.js` → `PermTest.run()` in der Browser-Konsole.

---

## ✅ Korrekt implementierte Rechte (kein Handlungsbedarf)

| Permission | Frontend | Backend |
|---|---|---|
| events.import_ai | CSS-Guard (`perm-import-ai`) | `/api/ocr.js` ✓ |
| events.edit | CSS + can() in Formularen | Supabase RLS |
| events.delete | can() in form.js | Supabase RLS |
| events.edit_briefing | can() in app.js | Supabase RLS |
| staff.edit | can() in employees.js | Supabase RLS |
| staff.delete | can() in employees.js | Supabase RLS |
| staff.view_notes | can() in employees.js | — |
| staff.view_all_categories | can() in employees.js | — |
| staff.edit_all_categories | can() in form.js + employees.js | — |
| shifts.view_all | can() in app.js | — |
| shifts.manage_all_categories | can() in employees.js | — |
| planning.ai_generate | CSS + can() | `/api/ai-planner.js` ✓ |
| planning.view_all_categories | can() in app.js + planner.js | — |
| planning.edit_all_categories | can() in planner.js | — |
| settings.edit_locations | can() in app.js | — |
| settings.edit_ai | CSS-Guard (`perm-ai-settings`) | — |
| roles.create | can() in roles.js | `/api/roles.js` ✓ |
| roles.edit | can() in roles.js | `/api/roles.js` ✓ |
| roles.delete | can() in roles.js | `/api/roles.js` ✓ |
| roles.assign | can() in app.js | `/api/admin.js` ✓ |
| users.view | can() in app.js | — |
| users.delete | can() in app.js | `/api/admin.js` ✓ |
| users.invite | can() in employees.js | `/api/admin.js` ✓ |
| users.reset_password | can() in employees.js | `/api/admin.js` ✓ |
| chat.access_all | Chat.canAccess() in chat.js | — |
| chat.delete_messages | can() in chat.js | — |
| scope.manage | — | `/api/roles.js` ✓ |

---

## 🐛 Gefundene Bugs (12 Bugs, alle in diesem PR behoben)

---

### BUG-01 · planning.manage_rules – fehlende CSS-Regel

**Schweregrad**: Mittel  
**Datei**: `style.css`

**Problem**: Die HTML-Elemente mit Klasse `.perm-manage-rules` (Abschnitt "Dienstplan – Regelwerk" in den Einstellungen) wurden NICHT ausgeblendet, wenn ein Admin-User das Recht `planning.manage_rules` fehlte. Die CSS-Regel `body.admin:not(.can-manage-rules) .perm-manage-rules` existierte nicht.

**Symptom**: Ein User mit `events.edit` (hat `admin`-Body-Klasse) aber OHNE `planning.manage_rules` sah den Abschnitt "Dienstplan – Regelwerk" als leere Überschrift – der Editor-Inhalt wurde per JS-Guard zwar nicht gerendert (`if(can(...)) PlanningRules.renderEditor(...)`), die Überschrift war aber sichtbar.

**Fix**: CSS-Regel hinzugefügt:
```css
body.admin:not(.can-manage-rules) .perm-manage-rules{display:none!important}
```

---

### BUG-02 · planning.manage_rules – Regelwerk-Tab im Planner immer sichtbar

**Schweregrad**: Mittel  
**Datei**: `js/planner.js`

**Problem**: Der "⚙ Regelwerk"-Tab im Planner-Modal wurde ohne Prüfung auf `planning.manage_rules` angezeigt.

**Fix**: Tab-Array conditional aufgebaut:
```js
...(can(PERM.PLANNING_MANAGE_RULES) ? [['rules', '⚙ Regelwerk']] : []),
```

---

### BUG-03 · staff.view_contact – nicht durchgesetzt

**Schweregrad**: Hoch  
**Datei**: `js/employees.js`

**Problem**: E-Mail und Telefonnummer eines Mitarbeiters wurden in `_detailHTML()` ohne Prüfung auf `staff.view_contact` angezeigt. Jeder User mit Zugang zur Mitarbeiterliste konnte Kontaktdaten einsehen.

**Fix**: 
```js
${can(PERM.STAFF_VIEW_CONTACT) && emp.email ? `...email...` : ''}
${can(PERM.STAFF_VIEW_CONTACT) && emp.phone ? `...phone...` : ''}
```

---

### BUG-04 · planning.create_period – nicht durchgesetzt

**Schweregrad**: Mittel  
**Datei**: `js/planner.js`

**Problem**: Der "+ Neu"-Button im Planner-Header und das Formular "Neuen Planungszeitraum erstellen" waren für jeden sichtbar, der den Planner öffnen konnte.

**Fix**: Button und Formular hinter `can(PERM.PLANNING_CREATE_PERIOD)` gesperrt.

---

### BUG-05 · planning.publish – nicht durchgesetzt

**Schweregrad**: Hoch  
**Datei**: `js/planner.js`

**Problem**: Der "Plan veröffentlichen"-Button im Planner-Übersichts-Tab wurde ohne Prüfung auf `planning.publish` gerendert. Jeder der den Planner öffnen konnte, konnte den Plan veröffentlichen.

**Fix**: 
```js
const publishBtn = can(PERM.PLANNING_PUBLISH) && (p.status === 'ai_proposal' || ...) ? ...
```

---

### BUG-06 · planning.edit – isEditing ignoriert das Recht

**Schweregrad**: Hoch  
**Datei**: `js/planner.js`

**Problem**: Die Variable `isEditing` (steuert ob Slots im Besetzungs-Tab bearbeitet werden können) wurde nur anhand des Planungsstatus gesetzt, nicht anhand des `planning.edit`-Rechts. Ein User mit `planning.view` allein konnte slots bearbeiten wenn der Plan im Status "editing" war.

**Fix**:
```js
const isEditing = p.status !== 'published' && (can(PERM.PLANNING_EDIT) || can(PERM.PLANNING_AI_GENERATE));
```

---

### BUG-07 · planning.view – CSS verbirgt Planner-Button auch für Lese-User

**Schweregrad**: Niedrig  
**Datei**: `style.css`, `js/permissions.js`

**Problem**: Die CSS-Regel für `.perm-planning` zeigte den Planner-Button nur bei `can-edit-planning` oder `can-ai-generate`. Ein User mit `planning.view` allein hatte keinen Zugang zum Planner, obwohl das semantisch korrekt wäre.

**Fix**: Body-Klasse `can-view-planning` zu `applyPermissionClasses()` hinzugefügt + CSS-Override:
```css
body.admin.can-view-planning:not(.can-edit-planning):not(.can-ai-generate) .perm-planning{display:block!important}
```

---

### BUG-08 · settings.edit_card_fields – HTML-Elemente ohne perm-Klasse

**Schweregrad**: Niedrig  
**Datei**: `index.html`

**Problem**: Die Body-Klasse `can-edit-card-fields` wurde zwar via `applyPermissionClasses()` gesetzt, aber die HTML-Elemente des "Event-Kartenfelder"-Abschnitts hatten keine `perm-card-fields`-Klasse, so dass die CSS-Regel nichts ausblenden konnte.

**Fix**: 
```html
<div class="stg-sec admin-only perm-card-fields">Event-Karten­felder</div>
<div class="stg-cf-table admin-only perm-card-fields">
```
+ CSS-Regel:
```css
body.admin:not(.can-edit-card-fields) .perm-card-fields{display:none!important}
```

---

### BUG-09 · users.invite – Frontend-Guard fehlte im Mitarbeiter-Detail

**Schweregrad**: Mittel  
**Datei**: `js/employees.js`

**Problem**: Der "Zugang erstellen"-Button im Mitarbeiter-Detail war für alle User mit `staff.manage_access` sichtbar, auch wenn sie `users.invite` nicht hatten. Der API-Call schlug dann mit 403 fehl.

**Fix**: Button-Rendering zusätzlich an `can(PERM.USERS_INVITE)` gebunden.

---

### BUG-10 · users.reset_password – Frontend-Guard fehlte

**Schweregrad**: Mittel  
**Datei**: `js/employees.js`

**Problem**: Der "Reset-Link generieren"-Button im Mitarbeiter-Detail war für alle User mit `staff.manage_access` sichtbar, auch ohne `users.reset_password`. API-Call schlug mit 403 fehl.

**Fix**: Button-Rendering an `can(PERM.USERS_RESET_PASSWORD)` gebunden.

---

### BUG-11 · roles.view – kein Backend-Guard auf GET /api/roles?action=list

**Schweregrad**: Mittel  
**Datei**: `api/roles.js`

**Problem**: Der Endpunkt `GET /api/roles?action=list` (liefert alle Rollen mit Permissions und Scopes) hatte keinen Permission-Check. Jeder authentifizierte User konnte die komplette Rollenkonfiguration abrufen.

**Fix**: Permission-Check hinzugefügt (roles.view OR roles.edit OR roles.create OR roles.assign OR users.view).

---

### BUG-12 · Besetzungs-Tab ("📝 Besetzung") ohne planning.edit sichtbar

**Schweregrad**: Niedrig  
**Datei**: `js/planner.js`

**Problem**: Der Besetzungs-Tab war für alle Planner-User sichtbar, auch wenn sie weder `planning.edit` noch `planning.ai_generate` hatten.

**Fix**: Tab-Array conditional:
```js
...(can(PERM.PLANNING_EDIT) || can(PERM.PLANNING_AI_GENERATE) ? [['assignments', '📝 Besetzung']] : []),
```

---

## ⚠️ Bekannte Lücken (nicht als Bug gewertet, da Features noch nicht implementiert)

| Permission | Status |
|---|---|
| statistics.view / statistics.view_hours / statistics.export | Statistik-Modul fehlt komplett im Frontend |
| visitors.edit | Kein dedizierter UI-Guard – visitors.view steuert nur Card-Feld-Config |
| customer_cards.view / customer_cards.edit | UI-Modul nicht implementiert |
| calendar.view / calendar.view_details | Kein dedizierter Guard – Kalender-Ansicht immer erreichbar |
| shifts.assign | Body-Klasse gesetzt, aber keine CSS-Regel und kein UI-Element referenziert sie |
| shifts.edit | Schicht-Bearbeitung über Scope-Check, nicht über shifts.edit |
| shifts.swap_approve | UI für Schichttausch-Genehmigung nicht implementiert |
| users.toggle_role | Legacy-Methode, abgelöst durch roles.assign |
| staff.edit_contact_own | Eigenes Profil immer editierbar (korrekt so) |
| settings.view | Body-Klasse gesetzt, aber Einstellungs-Button noch nicht daran gebunden |
| scope.manage | Nur Backend-Guard; Frontend-Scope-Editor öffnet sich für roles.edit-User |

---

## Testanleitung

```js
// Browser-Konsole öffnen während App geladen ist (als Admin eingeloggt)
// Skript laden:
const s = document.createElement('script');
s.src = '/js/permission-test.js';
document.head.appendChild(s);

// Dann:
PermTest.run()              // Alle 58 Tests + Backend-Guards
PermTest.runCategory('roles') // Nur Rollenverwaltung
PermTest.report()           // Tabellarische Ausgabe
```
