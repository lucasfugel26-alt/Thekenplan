# Thekenplan — Technische Projektbeschreibung

---

## 1. Überblick

Thekenplan ist eine webbasierte Planungs- und Kommunikationsplattform für Veranstaltungsbetriebe. Die App ermöglicht es einem Team, Veranstaltungen zu erfassen, Mitarbeiter einzuplanen, Schichtzeiten zu verfolgen und pro Event einen internen Chat zu führen. Der Zugriff auf einzelne Funktionen wird über ein granulares Rechte- und Rollensystem gesteuert.

---

## 2. Tech-Stack

| Bereich | Technologie |
|---|---|
| Frontend | Vanilla JavaScript (Module-Dateien), HTML5, CSS3 — kein Framework, kein Build-Step |
| Backend/Hosting | Vercel (Hobby-Plan), Serverless Functions (Node.js ESM) |
| Datenbank & Auth | Supabase (PostgreSQL + Supabase Auth) |
| Realtime | Supabase Realtime (WebSocket-Subscriptions) |
| KI-Import | Anthropic Claude API (`claude-opus-4-7`) via `@anthropic-ai/sdk` |
| KI-Dienstplanung | Anthropic Claude API (`claude-opus-4-7`) via Serverless Function |
| Excel-Parsing | SheetJS (`xlsx`) via CDN |
| Schriften | Google Fonts: Syne (Überschriften), DM Sans (Fließtext) |
| Deployment | GitHub → Vercel Auto-Deploy (`main` = Production) |

---

## 3. Architektur

### 3.1 Frontend-Struktur

Das Frontend ist in separate Dateien aufgeteilt:

```
index.html        — HTML-Grundgerüst mit allen Modals und Panels (~835 Zeilen)
style.css         — Alle Styles inkl. Permission-abhängiger CSS-Selektoren (~1.530 Zeilen)
js/
  main.js         — Einstiegspunkt: globale Hilfsfunktionen, Konstanten, Supabase-Init
  permissions.js  — PERM-Konstanten, can(), setPermissions(), applyPermissionClasses()
  app.js          — Haupt-Controller: Navigation, Rendering, Wochenansicht, Kalender
  auth.js         — Login/Logout, Passwort-Flow
  cloud.js        — Supabase-Sync: fetch/push Events
  config.js       — App-Konfiguration (Statuses, Kartenfelder, Rollen)
  defaults.js     — Standardwerte für neue Events
  form.js         — Event erstellen/bearbeiten
  employees.js    — Mitarbeiterverzeichnis, Stundenübersicht, Zugangsverwaltung
  shifts.js       — Schichtverwaltung, Arbeitsstunden-Berechnung
  planning.js     — Planungszeiträume, Verfügbarkeiten, Regelwerk
  planner.js      — Dienstplanungs-UI (Übersicht, Besetzung, KI-Plan)
  roles.js        — Rollen-UI: erstellen/bearbeiten/zuweisen
  import.js       — KI-Import: Bild/PDF/Excel → Claude API → Vorschau → Events
  chat.js         — Event-Chats via Supabase Realtime
```

Externe Bibliotheken werden per CDN eingebunden (Supabase JS Client, SheetJS). Es gibt keinen Bundler und keinen Build-Prozess.

### 3.2 Serverless API (`/api/`)

| Datei | Funktion |
|---|---|
| `_auth.js` | Shared Helper: `getCallerUserId()`, `hasPermission()`, `hasPermissionOrLegacyAdmin()` |
| `roles.js` | Rollenverwaltung: list, createRole, updateRole, deleteRole, setRolePermissions, setRoleStaffScope, userPermissions |
| `admin.js` | Benutzerverwaltung: inviteUser, resetLink, deleteUser, updateUserRole |
| `ocr.js` | KI-Import: Bild/PDF → Claude API → JSON-Array |
| `ai-planner.js` | KI-Dienstplanung: Verfügbarkeiten + Events → Claude → Dienstplan-Vorschlag |

Jeder Handler prüft via `hasPermissionOrLegacyAdmin()` ob der aufrufende User das erforderliche Recht hat (403 bei Fehler). Alle Handlers benötigen ein gültiges Supabase-JWT im `Authorization`-Header.

### 3.3 Permission-System

#### Rechte-Prüfung (Frontend)

```js
// permissions.js
can(PERM.EVENTS_EDIT)          // true/false — O(1) via Set-Lookup
setPermissions(['events.edit', ...])  // nach Login befüllt
applyPermissionClasses()        // setzt can-* Klassen auf body
```

`applyPermissionClasses()` setzt CSS-Body-Klassen (`can-edit-events`, `can-view-roles`, …). CSS-Selektoren der Form `body.admin:not(.can-edit-events) .perm-edit-events { display:none!important }` blenden UI-Elemente aus.

Die `admin`-Body-Klasse (für Legacy-CSS-Selektoren) wird gesetzt wenn der User `events.edit` oder `staff.edit` hat.

#### Rechte-Prüfung (Backend)

Jede API-Aktion ruft `hasPermissionOrLegacyAdmin(userId, permissionKey, serviceKey)` auf. Die Funktion prüft:
1. Hat der User die alte Rolle `admin` in der `profiles`-Tabelle? (Legacy-Fallback)
2. Hat der User das Permission via `user_has_permission()` DB-Funktion?

#### Scope-System

Rollen können auf Mitarbeiterkategorien eingeschränkt werden (`role_staff_scopes`). Ein User mit Scope sieht und bearbeitet nur Mitarbeiter/Schichten seiner Kategorien. Scope-Bypass-Rechte (`staff.view_all_categories` etc.) heben die Einschränkung auf.

---

## 4. Datenbank (Supabase / PostgreSQL)

### Kern-Tabellen

**`events`**
```
id           TEXT PRIMARY KEY
date         TEXT  (YYYY-MM-DD)
location_id  INTEGER
data         JSONB  — vollständiges Event-Objekt (barStaff, prodL, Zeiten, …)
updated_at   TIMESTAMPTZ
```

**`profiles`**
```
id            UUID (= auth.users.id)
display_name  TEXT
role          TEXT  ('admin' | 'viewer')  — Legacy-Spalte
role_id       UUID → roles.id             — neues Rollensystem
```

**`employees`**
```
id                    UUID
name, kuerzel         TEXT
color                 TEXT (Hex)
display_name          TEXT
profile_id            UUID → profiles.id (nullable)
email, phone          TEXT
emergency_name/phone/email  TEXT
default_role          TEXT  (Mitarbeiterkategorie)
status                TEXT  ('aktiv' | 'inaktiv' | 'ausgeschieden')
soll_stunden          NUMERIC
soll_period           TEXT  ('week' | 'month')
notes                 TEXT
sort_order            INTEGER
```

**`shifts`**
```
id                              UUID
event_id                        TEXT → events.id
employee_id                     UUID → employees.id
event_date                      TEXT
role                            TEXT
start_time / end_time           TEXT (HH:MM)
actual_start_time/end_time      TEXT
confirmed                       BOOL
cancelled                       BOOL
bechertyp                       TEXT
```

**`event_messages`** (Chat)
```
id            UUID
event_id      TEXT
user_id       UUID
display_name  TEXT
text          TEXT
created_at    TIMESTAMPTZ
```

**`locations`**
```
id            SERIAL PRIMARY KEY
name, short   TEXT
color         TEXT
address, maps_url, contact_name, contact_phone  TEXT
capacity      INTEGER
image         TEXT (Base64)
notes         TEXT
```

**`app_config`**
```
key    TEXT PRIMARY KEY  ('staff_statuses' | 'card_fields' | 'employee_roles' | 'aiEnabled' | …)
value  JSONB
```

### Rollen & Rechte

**`roles`**
```
id          UUID PRIMARY KEY
name        TEXT
description TEXT
color       TEXT
is_system   BOOL
sort_order  INTEGER
```

**`permissions`**
```
id          UUID PRIMARY KEY
key         TEXT UNIQUE  (z.B. 'events.edit')
label       TEXT
description TEXT
category    TEXT
sort_order  INTEGER
```

**`role_permissions`**
```
role_id        UUID → roles.id
permission_id  UUID → permissions.id
```

**`role_staff_scopes`**
```
role_id   UUID → roles.id
category  TEXT  (Mitarbeiterkategorie)
```

### Dienstplanung

**`planning_periods`**
```
id                    UUID
year, month           INTEGER
status                TEXT  ('open' | 'collecting' | 'ai_proposal' | 'editing' | 'published')
deadline              DATE
notes                 TEXT
proposed_assignments  JSONB
```

**`employee_availability`**
```
employee_id    UUID
period_id      UUID
available_dates  TEXT[]
notes          TEXT
```

**`planning_rules`**
```
role                 TEXT PRIMARY KEY
max_shift_hours      NUMERIC
min_rest_hours       NUMERIC
max_weekly_hours     NUMERIC
max_monthly_hours    NUMERIC
target_monthly_hours NUMERIC
break_rules          JSONB  — [{after_hours, deduct_minutes}]
```

**`shift_swaps`**
```
id              UUID
shift_id        UUID → shifts.id
requested_by    UUID
offered_to      UUID
status          TEXT  ('pending' | 'accepted' | 'rejected')
```

---

## 5. Row Level Security (RLS)

RLS ist auf allen Tabellen aktiv. Die Policies nutzen zwei DB-Funktionen:

- `is_admin()` — Legacy: prüft `profiles.role = 'admin'`
- `user_has_permission(p_user_id, p_permission_key)` — neues System: prüft via `role_permissions`

| Tabelle | Lesen | Schreiben |
|---|---|---|
| `events` | authenticated | Admins / `events.edit` |
| `profiles` | authenticated | Admins |
| `employees` | authenticated | Admins / `staff.edit` |
| `shifts` | authenticated | Admins / Scope-abhängig |
| `app_config` | authenticated | Admins |
| `locations` | public | Admins / `settings.edit_locations` |
| `roles` / `permissions` | authenticated (mit Recht) | Admins / `roles.edit` |
| `event_messages` | authenticated | authenticated (eigene user_id) |
| `planning_periods` | authenticated | Admins / Planner-Rechte |
| `planning_rules` | authenticated | Admins / `planning.manage_rules` |

---

## 6. Alle 58 Permissions (Übersicht)

| Kategorie | Rechte |
|---|---|
| Veranstaltungen | `events.view` `events.create` `events.edit` `events.delete` `events.import_ai` `events.edit_briefing` `events.view_notes` |
| Mitarbeiter | `staff.view` `staff.create` `staff.edit` `staff.delete` `staff.view_contact` `staff.edit_contact_own` `staff.view_notes` `staff.manage_access` |
| Schichten | `shifts.view_all` `shifts.view_own` `shifts.assign` `shifts.edit` `shifts.swap_approve` |
| Dienstplanung | `planning.view` `planning.create_period` `planning.edit` `planning.publish` `planning.ai_generate` `planning.manage_rules` |
| Kalender | `calendar.view` `calendar.view_details` |
| Statistiken | `statistics.view` `statistics.view_hours` `statistics.export` |
| Besucherzahlen | `visitors.view` `visitors.edit` |
| Kundenkarten | `customer_cards.view` `customer_cards.edit` |
| Einstellungen | `settings.view` `settings.edit_general` `settings.edit_locations` `settings.edit_card_fields` `settings.edit_ai` |
| Rollenverwaltung | `roles.view` `roles.create` `roles.edit` `roles.delete` `roles.assign` |
| Benutzerverwaltung | `users.view` `users.invite` `users.delete` `users.reset_password` `users.toggle_role` |
| Chat | `chat.access_all` `chat.delete_messages` |
| Scope-Bypass | `scope.manage` `staff.view_all_categories` `staff.edit_all_categories` `shifts.manage_all_categories` `planning.view_all_categories` `planning.edit_all_categories` |

Backend-gesicherte Rechte (API-Guard): `roles.create/edit/delete/view/assign`, `users.invite/delete/reset_password`, `planning.ai_generate`, `events.import_ai`, `scope.manage`.

---

## 7. Authentifizierung & Benutzerverwaltung

1. Admin legt Benutzer an → zufälliges Temporärpasswort (`crypto.randomBytes`) wird generiert
2. Benutzer meldet sich an → Passwort-Setzen-Screen beim ersten Login
3. Rolle und Permissions werden aus `profiles.role_id → roles → role_permissions` geladen
4. `loadPermissions()` wird nach Login aufgerufen → befüllt `_currentPermissions` Set
5. Publishable Key im Frontend, Service Role Key nur serverseitig

---

## 8. Dienstplanung (Planner)

Der Planner läuft als eigene Vollbild-Seite (`planner-page`) mit fünf Tabs:

| Tab | Funktion | Recht |
|---|---|---|
| Übersicht | Status-Workflow, KI-Trigger, Veröffentlichen | `planning.view` |
| Besetzung | Mitarbeiter manuell zu Slots zuweisen | `planning.edit` / `planning.ai_generate` |
| Verfügbarkeiten | Mitarbeiter-Eingaben einsehen | `planning.view` |
| Schichttausch | Tausch-Anfragen verwalten | `planning.view` |
| Regelwerk | Pausenregeln, Stunden-Limits pro Rolle | `planning.manage_rules` |

KI-Ablauf:
1. Preflight-Analyse → Claude stellt Rückfragen
2. User beantwortet → Claude generiert `proposed_assignments` JSON
3. Admin prüft Vorschlag im Besetzungs-Tab
4. Veröffentlichen → Schichten werden in `shifts`-Tabelle übertragen

---

## 9. KI-Import

1. Optionale Felder vorab auswählen (Veranstaltungsnummer, Belegungsende, Besucherzahl, Bemerkungen)
2. **Excel**: SheetJS → pipe-delimitierter Text → Claude
3. **Bild/PDF**: Base64 → Claude (Dateityp gegen Whitelist validiert)
4. Claude (`claude-opus-4-7`) gibt reines JSON-Array zurück
5. Vorschau: editierbar (Location-Dropdown, Checkboxen)
6. `einlasszeit → startGastro` (−30 Min) wird automatisch berechnet

Recht: `events.import_ai` (Frontend + Backend-Guard in `/api/ocr.js`).

---

## 10. Deployment & Repository

- **Repository**: `lucasfugel26-alt/Thekenplan` (GitHub)
- **Produktions-Branch**: `main` — jeder Push löst automatisch Vercel-Deployment aus
- **Produktions-URL**: `thekenplan.vercel.app`
- **Vercel-Plan**: Hobby — Serverless Functions max. 60s (konfiguriert in `vercel.json`)
- **npm**: `package.json` enthält nur `@anthropic-ai/sdk`
- **Env-Variablen** (erfordern nach Änderung manuelles Redeploy):
  - `ANTHROPIC_API_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

---

## 11. Bekannte Lücken & technische Schulden

| Thema | Status |
|---|---|
| `statistics.*`-Rechte | Permissions definiert, Statistik-Modul noch nicht gebaut |
| `calendar.view/view_details` | Permissions definiert, kein dedizierter Frontend-Guard |
| `visitors.edit`, `customer_cards.*` | Permissions definiert, UI nicht implementiert |
| `shifts.assign` | Body-Klasse gesetzt, kein UI-Element referenziert sie |
| `shifts.swap_approve` | Tausch-Genehmigung UI nicht implementiert |
| `users.toggle_role` | Legacy-Methode, abgelöst durch `roles.assign` |
| Event-IDs | Generiert mit `Date.now() + Math.random()` — keine echten UUIDs |
| Event-Daten als JSONB | Flexibel, aber SQL-seitige Abfragen aufwändiger |
| Kein State-Manager | `EVENTS`-Array manuell mit `App.render()` + `Cloud.push()` abschließen |
