# Thekenplan — Technische Projektbeschreibung

---

## 1. Überblick

Thekenplan ist eine webbasierte Planungs- und Kommunikationsplattform für Veranstaltungsbetriebe (aktuell primär auf das Feierwerk München ausgelegt). Die App ermöglicht es einem Admin-Team, Veranstaltungen zu erfassen und zu verwalten, Mitarbeiter einzuplanen, Schichtzeiten zu verfolgen und pro Event einen internen Chat zu führen. Mitarbeiter sehen ausschließlich ihre eigenen Schichten und können in den jeweiligen Event-Chats kommunizieren.

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

Die gesamte Frontend-Anwendung lebt in **einer einzigen Datei: `index.html`** (~5.960 Zeilen). Sie enthält:

- alle CSS-Styles (`<style>`)
- das komplette HTML-Grundgerüst mit allen Modals, Overlays und Panels
- die gesamte Anwendungslogik als Vanilla JavaScript (`<script>`)

Es gibt **keinen Build-Prozess, keinen Bundler, keine Abhängigkeiten im Frontend**. Externe Bibliotheken werden direkt per CDN eingebunden (Supabase JS Client, SheetJS). Diese Architektur ist bewusst gewählt: maximale Einfachheit, keine Toolchain, direkt deploybar.

### 3.2 Serverless API

Im Ordner `/api/` liegen drei Node.js-Serverless-Functions, die Vercel automatisch als HTTP-Endpunkte bereitstellt:

- **`/api/ocr.js`** — Empfängt Base64-kodierte Bilddaten, PDFs oder tabellarischen Text und leitet sie an die Anthropic Claude API weiter. Gibt ein strukturiertes JSON-Array mit den erkannten Veranstaltungsdaten zurück.
- **`/api/admin.js`** — Administriert Benutzer per Supabase Admin-API (Benutzer anlegen mit temporärem Passwort, Passwort zurücksetzen, Benutzer löschen). Schützt alle Aktionen mit einer Admin-Rollenprüfung.
- **`/api/plan.js`** — Ein Legacy-Proxy für JSONbin.io (früheres Datenspeicher-System, nicht mehr aktiv genutzt, aber noch vorhanden).

Die API-Functions benötigen zwei Umgebungsvariablen in Vercel:

- `ANTHROPIC_API_KEY` — für die KI-Import-Funktion
- `SUPABASE_SERVICE_ROLE_KEY` — für Admin-Operationen (hat vollen DB-Zugriff, nur serverseitig verwenden)

### 3.3 Globaler Zustand (In-Memory)

Die App arbeitet mit zwei globalen Variablen als primärem In-Memory-State:

```js
let EVENTS = [];  // Array aller Veranstaltungsobjekte
let LOCS = {};    // Dictionary der Locations: { 1: { name, short, color }, ... }
```

Änderungen an `EVENTS` werden direkt im Array vorgenommen und dann per `Cloud.push()` zu Supabase synchronisiert sowie per `App.render()` neu gerendert. Es gibt keinen reaktiven State-Manager (kein Vue/React/Svelte).

---

## 4. Datenbank (Supabase / PostgreSQL)

Die Datenbank läuft auf Supabase (`anagoloyaaikuexzbxae.supabase.co`). Folgende Tabellen sind relevant:

### `events`

Speichert alle Veranstaltungen. Das zentrale Feld ist `data` (JSONB), das das gesamte Event-Objekt enthält.

```
id           TEXT PRIMARY KEY
date         TEXT  (YYYY-MM-DD)
location_id  INTEGER
data         JSONB  ← das vollständige Event-Objekt
updated_at   TIMESTAMPTZ
```

Ein Event-Objekt in `data` enthält u.a.:

```js
{
  id, date, location,
  event,                // Veranstaltungsname
  notes,                // Bemerkungen
  einlasszeit,          // HH:MM Einlasszeit
  startGastro,          // HH:MM (auto: Einlass −30 Min)
  schlussShow,          // HH:MM
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

Verknüpft Supabase-Auth-Benutzer mit App-Rollen.

```
id            UUID (= auth.users.id)
display_name  TEXT
role          TEXT  ('admin' | 'viewer')
```

### `employees`

Mitarbeiterstammdaten, separat von Auth-Benutzern.

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

Schichten, die aus Event-Besetzungen generiert werden.

```
id                        UUID
event_id                  TEXT (→ events.id)
employee_id               UUID (→ employees.id)
event_date                TEXT
start_time                TEXT
end_time                  TEXT
actual_start_time         TEXT
actual_end_time           TEXT
confirmed                 BOOL
cancelled                 BOOL
```

### `event_messages`

Chat-Nachrichten pro Event.

```
id            UUID
event_id      TEXT
user_id       UUID
display_name  TEXT
text          TEXT
created_at    TIMESTAMPTZ
```

### `app_config`

Key-Value-Store für globale App-Konfiguration.

```
key    TEXT PRIMARY KEY  ('staff_statuses' | 'card_fields' | 'employee_roles')
value  JSONB
```

---

## 5. Frontend-Module

Die App-Logik ist in Objekte (Module) aufgeteilt, die alle als globale Konstanten in `index.html` definiert sind:

| Modul | Verantwortlichkeit |
|---|---|
| `App` | Haupt-Controller: Wochen-Navigation, Rendering der Kalenderansicht, Filter, Modals öffnen/schließen |
| `Form` | Formular zum Erstellen und Bearbeiten von Events. Verwaltet Besetzungszeilen, Auto-Berechnung von startGastro aus Einlasszeit |
| `Cloud` | Supabase-Sync: `fetch()` lädt alle Events, `push()` speichert alle Events per Upsert. Zeigt Sync-Status-Indikator |
| `Auth` | Login/Logout, Passwort-Management, Erstpasswort-Flow für neue Nutzer |
| `Chat` | Event-Chats via Supabase Realtime. Zeigt Unread-Dots. Zugriff nur für eingeteilte Mitarbeiter und Admins |
| `Import` | KI-gestützter Datei-Import (Bild/PDF/Excel → Claude API → strukturierte Events mit Vorschau) |
| `Shifts` | Schichtverwaltung: generiert `shifts`-Einträge aus der Event-Besetzung, berechnet Arbeitsstunden |
| `Employees` | Mitarbeiterverzeichnis (CRUD), Autocomplete in Formularen, Kontaktdaten-Selbstverwaltung |
| `Config` | Globale Einstellungen: Mitarbeiter-Statuses, Kartenfelder, Rollen. Wird aus `app_config` geladen |
| `Defaults` | Standardwerte für neue Events (Standard-Location, Standard-Zeiten) — werden in Einstellungen konfiguriert |

---

## 6. Authentifizierung

Die Auth läuft vollständig über **Supabase Auth** (Email + Passwort):

1. Admins legen neue Benutzer über das Admin-Panel an — dabei wird ein zufälliges Temporärpasswort generiert und über `/api/admin.js` ein Auth-User in Supabase erstellt
2. Der neue Benutzer meldet sich mit dem Temporärpasswort an
3. Bei der ersten Anmeldung erkennt die App (via `user_metadata.force_password_change`), dass ein neues Passwort gesetzt werden muss — es erscheint ein Passwort-Setzen-Screen
4. Die Rolle (`admin`/`viewer`) wird aus der `profiles`-Tabelle gelesen, nicht aus JWT-Claims
5. Der Supabase-Client im Frontend verwendet den öffentlichen **Publishable Key** (nur Lese-/Schreibzugriff gemäß RLS-Policies). Der **Service Role Key** (voller Admin-Zugriff) ist ausschließlich serverseitig in `/api/admin.js` gespeichert

---

## 7. Datenfluss (typischer Ablauf)

```
Browser lädt index.html
  → Auth.init() prüft Supabase-Session
    → eingeloggt: Cloud.fetch() lädt EVENTS aus Supabase
      → App.render() baut Wochenkalender aus EVENTS
        → User bearbeitet Event
          → Form.save() schreibt in EVENTS[]
            → Cloud.push() macht Upsert in Supabase
              → Supabase Realtime feuert Event an alle anderen Clients
                → Cloud.fetch() + App.render() bei anderen Nutzern
```

---

## 8. Import-Feature (KI-gestützt)

Der Import-Flow ist eines der komplexeren Features:

1. User wählt im Import-Modal optionale Felder (Veranstaltungsnummer, Belegungsende, etc.) und lädt eine Datei hoch (Bild, PDF oder Excel)
2. **Excel**: SheetJS liest die Datei clientseitig und konvertiert sie in einen pipe-deliminierten Textstring
3. **Bild/PDF**: FileReader liest die Datei als Base64
4. Der Inhalt wird mit den ausgewählten Feldern und der Location-Liste als Kontext an `/api/ocr` gesendet
5. `/api/ocr` baut einen strukturierten Prompt (inkl. Location-Mapping und optionaler Felder) und schickt ihn an Claude (`claude-opus-4-7`)
6. Claude gibt ein reines JSON-Array zurück
7. Das Frontend zeigt eine Vorschau mit allen erkannten Events — editierbar (Location-Dropdown, Checkbox zum Abwählen)
8. "Importieren" schreibt die Events in `EVENTS[]` und pusht zu Supabase. `einlasszeit` wird automatisch in `startGastro` (−30 Min) umgerechnet

---

## 9. Deployment & Repository

- **Repository**: `lucasfugel26-alt/Thekenplan` (GitHub)
- **Produktions-Branch**: `main` — jeder Push auf `main` löst automatisch ein Vercel-Deployment aus
- **Produktions-URL**: `thekenplan.vercel.app`
- **Vercel-Plan**: Hobby (kostenlos) — Serverless Functions haben max. 60 Sekunden Laufzeit (konfiguriert in `vercel.json`)
- **npm-Abhängigkeit**: `package.json` enthält nur `@anthropic-ai/sdk` — wird von Vercel beim Deployment installiert
- **Env-Variablen** müssen in Vercel hinterlegt sein und erfordern ein Redeploy, damit sie aktiv werden:
  - `ANTHROPIC_API_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

---

## 10. Wichtige Einschränkungen & bekannte Eigenheiten

- **Kein Build-System**: Die gesamte App ist eine Datei. Grosse Änderungen erfordern Sorgfalt, da kein Linter oder Compiler Fehler abfängt
- **Kein State-Manager**: Änderungen am `EVENTS`-Array müssen immer manuell mit `App.render()` und `Cloud.push()` abgeschlossen werden
- **Event-Daten als JSONB**: Das Datenbankschema der `events`-Tabelle hat nur wenige echte Spalten — das vollständige Objekt liegt als JSONB in `data`. Das ist flexibel, macht aber SQL-seitige Abfragen aufwändiger
- **Realtime nur für Events**: Nur Änderungen an der `events`-Tabelle lösen automatische Neu-Renders bei anderen Clients aus. Chat-Nachrichten haben eine eigene Subscription
- **`plan.js` ist Legacy**: Diese API-Funktion war für ein früheres JSONbin-basiertes Speichersystem. Sie kann entfernt werden
