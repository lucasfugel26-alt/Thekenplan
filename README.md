# Thekenplan — Technische Projektbeschreibung

---

## 1. Überblick

Thekenplan ist eine webbasierte Planungs- und Kommunikationsplattform für Veranstaltungsbetriebe. Die App ermöglicht es einem Admin-Team, Veranstaltungen zu erfassen und zu verwalten, Mitarbeiter einzuplanen, Schichtzeiten zu verfolgen und pro Event einen internen Chat zu führen. Mitarbeiter sehen ausschließlich ihre eigenen Schichten und können in den jeweiligen Event-Chats kommunizieren.

---

## 2. Tech-Stack

| Bereich | Technologie |
|---|---|
| Frontend | Vanilla JavaScript, HTML5, CSS3 — kein Framework, kein Build-Step |
| Backend/Hosting | Vercel (Hobby-Plan), Serverless Functions (Node.js) |
| Datenbank & Auth | Supabase (PostgreSQL + Supabase Auth) |
| Realtime | Supabase Realtime (WebSocket-Subscriptions) |
| KI-Import | Anthropic Claude API (`claude-opus-4-7`) via `@anthropic-ai/sdk` |
| Excel-Parsing | SheetJS (`xlsx`) via CDN |
| Schriften | Google Fonts: Syne (Überschriften), DM Sans (Fließtext) |
| Deployment | GitHub → Vercel Auto-Deploy (Main-Branch = Production) |

---

## 3. Architektur

### 3.1 Single-File SPA

Die gesamte Frontend-Anwendung lebt in **einer einzigen Datei: `index.html`** (~6.000 Zeilen). Sie enthält:

- alle CSS-Styles (`<style>`)
- das komplette HTML-Grundgerüst mit allen Modals, Overlays und Panels
- die gesamte Anwendungslogik als Vanilla JavaScript (`<script>`)

Es gibt **keinen Build-Prozess, keinen Bundler, keine Abhängigkeiten im Frontend**. Externe Bibliotheken werden direkt per CDN eingebunden (Supabase JS Client, SheetJS).

> **Geplant:** Die Datei wird in Kürze in separate CSS-, JS- und HTML-Dateien aufgeteilt, um die Wartbarkeit zu verbessern.

### 3.2 Serverless API

Im Ordner `/api/` liegen zwei Node.js-Serverless-Functions:

- **`/api/ocr.js`** — Empfängt Base64-kodierte Bilddaten, PDFs oder tabellarischen Text und leitet sie an die Anthropic Claude API weiter. Nur für Admins zugänglich. Validiert den Dateityp gegen eine Whitelist. Gibt ein strukturiertes JSON-Array mit den erkannten Veranstaltungsdaten zurück.
- **`/api/admin.js`** — Administriert Benutzer per Supabase Admin-API (Benutzer anlegen mit temporärem Passwort, Passwort zurücksetzen, Benutzer löschen). Schützt alle Aktionen mit einer Admin-Rollenprüfung. Verwendet `crypto.randomBytes()` für sichere Passwort-Generierung.

Die API-Functions benötigen zwei Umgebungsvariablen in Vercel:

- `ANTHROPIC_API_KEY` — für die KI-Import-Funktion
- `SUPABASE_SERVICE_ROLE_KEY` — für Admin-Operationen (hat vollen DB-Zugriff, nur serverseitig verwenden)

### 3.3 Globaler Zustand (In-Memory)

```js
let EVENTS = [];  // Array aller Veranstaltungsobjekte
let LOCS = {};    // Dictionary der Locations: { 1: { name, short, color }, ... }
```

Änderungen an `EVENTS` werden direkt im Array vorgenommen und dann per `Cloud.push()` zu Supabase synchronisiert sowie per `App.render()` neu gerendert. Es gibt keinen reaktiven State-Manager.

---

## 4. Datenbank (Supabase / PostgreSQL)

Die Datenbank läuft auf Supabase (`anagoloyaaikuexzbxae.supabase.co`).

### `events`

```
id           TEXT PRIMARY KEY
date         TEXT  (YYYY-MM-DD)
location_id  INTEGER
data         JSONB  ← das vollständige Event-Objekt
updated_at   TIMESTAMPTZ
```

Ein Event-Objekt in `data` enthält:

```js
{
  id, date, location,
  event,                // Veranstaltungsname
  notes,                // Bemerkungen
  einlasszeit,          // HH:MM Einlasszeit (Türöffnung)
  startGastro,          // HH:MM (auto: Einlass −30 Min)
  schlussShow,          // HH:MM Show-Ende
  belegungsende,        // HH:MM
  bechertyp,            // 'plastik' | 'glas' | 'unbekannt'
  missingStaff,         // bool
  kundenkarte,          // 'intern' | 'extern' | ...
  besucherzahl,         // number | null
  veranstaltungsnummer, // string | null
  prodL: { name, startTime, employeeId },
  barStaff: [{ name, ov, statuses[], miss, employeeId }],
  cancelled             // bool
}
```

### `profiles`

```
id            UUID (= auth.users.id)
display_name  TEXT
role          TEXT  ('admin' | 'viewer')
```

### `employees`

```
id              UUID
name            TEXT
profile_id      UUID (→ profiles.id, nullable)
email, phone    TEXT
emergency_*     TEXT
role            TEXT  (Thekenkraft | Produktionsleiter | ...)
active          BOOL
```

### `shifts`

```
id                        UUID
event_id                  TEXT (→ events.id)
employee_id               UUID (→ employees.id)
event_date                TEXT
start_time / end_time     TEXT
actual_start_time / actual_end_time  TEXT
confirmed                 BOOL
cancelled                 BOOL
```

### `event_messages`

```
id            UUID
event_id      TEXT
user_id       UUID
display_name  TEXT
text          TEXT
created_at    TIMESTAMPTZ
```

### `app_config`

```
key    TEXT PRIMARY KEY  ('staff_statuses' | 'card_fields' | 'employee_roles')
value  JSONB
```

---

## 5. Row Level Security (RLS)

Alle Tabellen haben RLS aktiviert. Die Policies verwenden eine `SECURITY DEFINER`-Funktion `is_admin()` die prüft ob der aktuelle User die Rolle `admin` in der `profiles`-Tabelle hat.

| Tabelle | Lesen | Schreiben |
|---|---|---|
| `events` | authenticated | nur Admins |
| `profiles` | authenticated | nur Admins |
| `employees` | authenticated | nur Admins |
| `shifts` | authenticated | nur Admins |
| `app_config` | authenticated | nur Admins |
| `locations` | public | nur Admins |
| `event_messages` | authenticated | authenticated (eigene user_id) |

---

## 6. Frontend-Module

| Modul | Verantwortlichkeit |
|---|---|
| `App` | Haupt-Controller: Wochen-Navigation, Rendering, Filter, Modals |
| `Form` | Event erstellen/bearbeiten. Auto-Berechnung startGastro = Einlasszeit −30 Min |
| `Cloud` | Supabase-Sync: fetch/push Events, Sync-Status-Indikator |
| `Auth` | Login/Logout, Passwort-Management, Erstpasswort-Flow |
| `Chat` | Event-Chats via Supabase Realtime, Unread-Dots, Zugriffsschutz |
| `Import` | KI-Import: Bild/PDF/Excel → Claude API → Vorschau → Events |
| `Shifts` | Schichtverwaltung, Arbeitsstunden-Berechnung |
| `Employees` | Mitarbeiterverzeichnis, Autocomplete, Kontaktdaten |
| `Config` | App-Konfiguration (Statuses, Kartenfelder, Rollen) |
| `Defaults` | Standardwerte für neue Events |

---

## 7. Authentifizierung

1. Admin legt Benutzer an → zufälliges Temporärpasswort (via `crypto.randomBytes`) wird generiert
2. Benutzer meldet sich an → Passwort-Setzen-Screen beim ersten Login
3. Rolle (`admin`/`viewer`) wird aus `profiles`-Tabelle gelesen
4. Publishable Key im Frontend, Service Role Key nur serverseitig in `/api/admin.js`

---

## 8. Import-Feature (KI-gestützt)

1. Vor dem Upload: optionale Felder auswählen (Veranstaltungsnummer, Belegungsende, Besucherzahl, Bemerkungen)
2. **Excel**: SheetJS → pipe-delimitierter Text → Claude
3. **Bild/PDF**: Base64 → Claude (Dateityp wird gegen Whitelist validiert)
4. Claude (`claude-opus-4-7`) gibt reines JSON-Array zurück
5. Vorschau: editierbar (Location-Dropdown, Checkboxen)
6. Import: `einlasszeit` → `startGastro` (−30 Min) wird automatisch berechnet

---

## 9. Deployment & Repository

- **Repository**: `lucasfugel26-alt/Thekenplan` (GitHub)
- **Produktions-Branch**: `main` — jeder Push löst automatisch Vercel-Deployment aus
- **Produktions-URL**: `thekenplan.vercel.app`
- **Vercel-Plan**: Hobby — Serverless Functions max. 60s (konfiguriert in `vercel.json`)
- **npm**: `package.json` enthält nur `@anthropic-ai/sdk`
- **Env-Variablen** erfordern nach Änderung ein manuelles Redeploy:
  - `ANTHROPIC_API_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

---

## 10. Bekannte Eigenheiten & technische Schulden

- **Single-File**: ~6.000 Zeilen in einer Datei — Aufteilung in separate Dateien ist geplant
- **Kein State-Manager**: `EVENTS`-Array muss manuell mit `App.render()` + `Cloud.push()` abgeschlossen werden
- **Event-IDs**: Generiert mit `Date.now() + Math.random()` — keine echten UUIDs
- **Event-Daten als JSONB**: Flexibel, aber SQL-seitige Abfragen aufwändiger
- **Realtime**: Nur `events`-Tabelle löst Auto-Render aus; Chat hat eigene Subscription
