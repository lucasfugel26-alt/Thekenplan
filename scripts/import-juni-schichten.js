/**
 * Juni 2026 – Schichten-Import
 *
 * Dieses Skript fügt die fehlenden Mitarbeiterzuweisungen zu den bereits
 * importierten Juni-Events hinzu. Es erstellt keine Duplikate: Events, die
 * bereits befüllt sind, werden übersprungen.
 *
 * AUSFÜHRUNG: Im Browser-Console auf der geöffneten Thekenplan-App
 * einfach den gesamten Inhalt dieses Skripts einfügen und Enter drücken.
 * Du musst eingeloggt sein.
 */

(async function importJuniSchichten() {
  'use strict';

  console.log('=== Juni 2026 Schichten-Import gestartet ===\n');

  // --- 1. Alle Juni-Events aus Supabase laden ---
  const { data: rows, error: fetchErr } = await db
    .from('events')
    .select('id, date, location_id, data')
    .gte('date', '2026-06-01')
    .lte('date', '2026-06-30')
    .order('date');

  if (fetchErr) { console.error('❌ Fehler beim Laden:', fetchErr); return; }
  console.log(`${rows.length} Juni-Events gefunden.\n`);

  // --- 2. Schichtdaten aus den Excel-Plänen (Screenshots) ---
  // Zuordnung: veranstaltungsnummer → { prodL, barStaff }

  const vnrMap = {

    // ============================================================
    // SR / Sunny – Location 3
    // ============================================================

    // Mi.03.06 – Reggae Jam
    '26060320SR': {
      prodL: { name: 'Bruce', startTime: '18:30' },
      barStaff: [
        { name: 'Felix Hölter', pos: 1 }
      ]
    },

    // Fr.05.06 – Get Rid
    '26060523SR': {
      prodL: { name: 'Luise', startTime: '19:00' },
      barStaff: [
        { name: 'Jonathan', pos: 1 }
      ]
    },

    // Sa.06.06 – Dubtown
    '26060623SR': {
      prodL: { name: 'Pauline', startTime: '20:00' },
      barStaff: [
        { name: 'Igor', pos: 1 }
      ]
    },

    // Fr.12.06 – Eisbach Callin
    '26061223SR': {
      prodL: { name: 'Anna', startTime: '20:00' },
      barStaff: [
        { name: 'Claudio', pos: 1 }
      ]
    },

    // Sa.13.06 – M-M-Madness  (Bar 1 ist offen / fehlt)
    '26061320SR': {
      prodL: { name: 'Luise', startTime: '20:00' },
      barStaff: [
        { name: '', pos: 1, miss: true }
      ],
      missingStaff: true
    },

    // Fr.19.06 – Techno Party
    '26061923SR': {
      prodL: { name: 'Luise', startTime: '20:00' },
      barStaff: [
        { name: 'Jonathan', pos: 1 }
      ]
    },

    // Fr.26.06 – Sacred Bones
    '26062622SR': {
      prodL: { name: 'Bruce', startTime: '21:00' },
      barStaff: [
        { name: 'Ines', pos: 1 }
      ]
    },

    // Sa.27.06 – Schlecht & Schwindlig
    '26062720SR': {
      prodL: { name: 'Anna', startTime: '17:00' },
      barStaff: [
        { name: 'Ines', pos: 1 }
      ]
    },

    // ============================================================
    // OH – Location 4
    // ============================================================

    // Fr.12.06 – Politik auf Probe
    '26061219OH': {
      prodL: { name: 'Marlon', startTime: '15:45' },
      barStaff: [
        { name: 'Dominic', pos: 1 }
      ]
    },

    // Sa.20.06 – Markus Frank Geburtstag
    '26062019OH': {
      prodL: { name: 'Marlon', startTime: '15:30' },
      barStaff: [
        { name: 'Jonathan', pos: 1 }
      ]
    },

    // Sa.27.06 – Sprungbrett Bandcamp (kein Personal eingetragen)
    '26062710OH': { barStaff: [] },

    // So.28.06 – Sprungbrett Bandcamp (kein Personal eingetragen)
    '26062810OH': { barStaff: [] },

    // ============================================================
    // H39 – Location 2
    // ============================================================

    // Fr.05.06 – Black Opera
    // Bar 3 (Franzi) kommt erst ab 22:30 (ov)
    '26060522H39': {
      prodL: { name: 'Bruce', startTime: '20:00' },
      barStaff: [
        { name: 'Felix Hölter', pos: 1 },
        { name: 'Tim',          pos: 2 },
        { name: 'Franzi',       pos: 3, ov: '22:30' }
      ]
    },

    // Fr.12.06 – Ü16 Party
    '26061217H39': {
      prodL: { name: 'Luise', startTime: '16:30' },
      barStaff: [
        { name: 'Henry',  pos: 1 },
        { name: 'Gala',   pos: 2 },
        { name: 'Bonnie', pos: 3 },
        { name: 'Basti',  role: 'Kasse' }
      ]
    },

    // Fr.19.06 – Pestfest  (Bar 2 fehlt)
    '26061920H39': {
      prodL: { name: 'Marlon', startTime: '14:00' },
      barStaff: [
        { name: 'Richard', pos: 1 },
        { name: '',        pos: 2, miss: true },
        { name: 'Kostja',  role: 'Kasse' }
      ],
      missingStaff: true
    },

    // Sa.20.06 – Soli Konzert NSU Gedenken
    '26062020H39': {
      prodL: { name: 'Lena', startTime: '11:30' },
      barStaff: [
        { name: 'Henry',  pos: 1 },
        { name: 'Lucia',  pos: 2 },
        { name: 'Bonnie', pos: 3 },
        { name: 'Mady',   role: 'Kasse', ov: '14:30' }
      ]
    },

    // Di.23.06 – Anthony Lazaro
    '26062320H39': {
      prodL: { name: 'Luise', startTime: '14:00' },
      barStaff: [
        { name: 'Igor',      pos: 1 },
        { name: 'Richard',   pos: 2 },
        { name: 'Dave Crew', role: 'Garderobe' }
      ]
    },

    // Mi.24.06 – Dune Rats
    '26062420H39': {
      prodL: { name: 'Luise', startTime: '14:30' },
      barStaff: [
        { name: 'Lucia',     pos: 1 },
        { name: 'Bonnie',    pos: 2 },
        { name: 'Jonathan',  pos: 3 },
        { name: 'Mady',      role: 'Garderobe' },
        { name: 'Dave Crew', role: 'Garderobe' }
      ]
    },

    // Sa.27.06 – Unterwelt
    '26062720H39': {
      prodL: { name: 'Lena', startTime: '13:30' },
      barStaff: [
        { name: 'Bonnie',    pos: 1 },
        { name: 'Felix Hohl', pos: 2 },
        { name: 'Claudio',   pos: 3 },
        { name: 'Galia',     pos: 4 },
        { name: 'Kostja',    role: 'Garderobe' }
      ]
    },

    // ============================================================
    // KH – Location 1
    // ============================================================

    // Di.09.06 – Barns Courtney
    '26060920KH': {
      prodL: { name: 'Luise', startTime: '15:30' },
      barStaff: [
        { name: 'Igor',      pos: 1 },
        { name: 'Henry',     pos: 2 },
        { name: 'Lucia',     pos: 3 },
        { name: 'Sascha',    role: 'Kasse' },
        { name: 'Dave Crew', role: 'Garderobe' }
      ]
    },

    // Sa.13.06 – Team München Sportfest
    // Claudio & Tim starten erst 20:30 (Override)
    '26061318KH': {
      prodL: { name: 'Marlon', startTime: '18:30' },
      barStaff: [
        { name: 'Claudio', pos: 1, ov: '20:30' },
        { name: 'Tim',     pos: 2, ov: '20:30' },
        { name: 'Galia',   pos: 3 },
        { name: 'Bonnie',  pos: 4 }
      ]
    },

    // Do.18.06 – Chaser
    '26061820KH': {
      prodL: { name: 'Lena', startTime: '15:30' },
      barStaff: [
        { name: 'Richard',   pos: 1 },
        { name: 'Jonathan',  pos: 2 },
        { name: 'Dave Crew', role: 'Garderobe' }
      ]
    },

    // Fr.19.06 – So Not Seventy
    // Laura & Tim starten erst 18:00 (Override)
    '26061920KH': {
      prodL: { name: 'Bruce', startTime: '14:30' },
      barStaff: [
        { name: 'Laura',     pos: 1, ov: '18:00' },
        { name: 'Tim',       pos: 2, ov: '18:00' },
        { name: 'Dave Crew', role: 'Garderobe' }
      ]
    },

    // Sa.20.06 – Soli Konzert NSU Gedenken
    // Zwei Schichten: Richard/Ines ab startGastro; Galia/Felix ab 20:00;
    // Laura/Bonnie als Ablöse ab 17:00
    '26062020KH': {
      prodL: { name: 'Anna', startTime: '09:30' },
      barStaff: [
        { name: 'Richard',   pos: 1 },
        { name: 'Ines',      pos: 2 },
        { name: 'Galia',     pos: 3, ov: '20:00' },
        { name: 'Felix Hohl', pos: 4, ov: '20:00' },
        { name: 'Mady',      role: 'Kasse' },
        { name: 'Dave Crew', role: 'Garderobe' },
        { name: 'Laura',     pos: 1, ov: '17:00' },
        { name: 'Bonnie',    pos: 2, ov: '17:00' }
      ]
    },

    // Mi.24.06 – Jesse Daniel, Cash Muretta, Nick Miles
    '26062420KH': {
      prodL: { name: 'Anna', startTime: '14:00' },
      barStaff: [
        { name: 'Dominic',   pos: 1 },
        { name: 'Igor',      pos: 2 },
        { name: 'Dave Crew', role: 'Garderobe' }
      ]
    },

    // Fr.26.06 – Nortec Bostich + Fussible
    '26062620KH': {
      prodL: { name: 'Luise', startTime: '14:00' },
      barStaff: [
        { name: 'Franzi',   pos: 1 },
        { name: 'Jonathan', pos: 2 },
        { name: 'Sascha',   role: 'Kasse' }
      ]
    },

    // Sa.27.06 – Howl Like Wolves
    '26062720KH': {
      prodL: { name: 'Luise', startTime: '14:30' },
      barStaff: [
        { name: 'Henry', pos: 1 },
        { name: 'Tim',   pos: 2 }
      ]
    },

    // Mo.29.06 – Author & Punisher
    '26062920KH': {
      prodL: { name: 'Bruce', startTime: '14:00' },
      barStaff: [
        { name: 'Jonathan', pos: 1 },
        { name: 'Laura',    pos: 2 },
        { name: 'Mady',     role: 'Kasse' }
      ]
    }
  };

  // Fallback: Zuordnung über Datum + Location für Events ohne VNR
  const dateLocMap = {
    // KH Di.02.06 – Team Besprechung und Reinigung
    '2026-06-02_1': {
      barStaff: [{ name: 'Alle', pos: 1 }]
    },
    // OH Fr.26.06 – Jan Geburtstag (kein VNR im Plan sichtbar)
    '2026-06-26_4': {
      prodL: { name: 'Marlon', startTime: '17:00' },
      barStaff: [{ name: 'Henry', pos: 1 }]
    }
  };

  // --- 3. Events durchgehen und Schichtdaten ergänzen ---
  const toUpdate = [];
  let skippedFilled  = 0;
  let skippedNoMatch = 0;

  for (const row of rows) {
    const ev  = row.data;
    const vnr = ev.veranstaltungsnummer || ev.veranstaltungsnr || ev.vnr || '';

    // Schichtdaten suchen
    let entry = null;
    if (vnr && vnrMap[vnr]) {
      entry = vnrMap[vnr];
    } else {
      const fallbackKey = `${ev.date}_${ev.location}`;
      if (dateLocMap[fallbackKey]) entry = dateLocMap[fallbackKey];
    }

    if (!entry) {
      console.log(`⏭  Kein Eintrag für: "${ev.event}" (${ev.date}${vnr ? ', ' + vnr : ''})`);
      skippedNoMatch++;
      continue;
    }

    // Duplikat-Schutz: überspringen wenn bereits Personal vorhanden
    const alreadyFilled = ev.barStaff?.some(s => s.name?.trim()) || ev.prodL?.name?.trim();
    if (alreadyFilled) {
      console.log(`✔  Bereits befüllt: "${ev.event}" (${ev.date})`);
      skippedFilled++;
      continue;
    }

    // Daten zusammenführen
    const updated = { ...ev };

    if (entry.prodL) {
      updated.prodL = {
        name:       entry.prodL.name,
        startTime:  entry.prodL.startTime,
        employeeId: null
      };
    }

    updated.barStaff = (entry.barStaff || []).map((s, i) => ({
      name:       s.name  || '',
      pos:        s.pos   ?? (i + 1),
      ov:         s.ov    ?? null,
      miss:       s.miss  ?? false,
      role:       s.role  || 'Thekenkraft',
      statuses:   s.statuses || [],
      employeeId: null
    }));

    if (entry.missingStaff) updated.missingStaff = true;

    toUpdate.push({
      id:          row.id,
      date:        row.date,
      location_id: row.location_id,
      data:        updated
    });

    console.log(`📝 Vorbereitet:  "${ev.event}" (${ev.date})`);
  }

  console.log(`\n${toUpdate.length} Events werden aktualisiert`);
  console.log(`${skippedFilled}  bereits befüllt (übersprungen)`);
  console.log(`${skippedNoMatch} kein Treffer im Plan\n`);

  if (toUpdate.length === 0) {
    console.log('Nichts zu tun – alle Events waren bereits befüllt.');
    return;
  }

  // --- 4. Events in Supabase speichern ---
  const { error: saveErr } = await db.from('events').upsert(
    toUpdate.map(u => ({
      id:          u.id,
      date:        u.date,
      location_id: u.location_id,
      data:        u.data,
      updated_at:  new Date().toISOString()
    }))
  );

  if (saveErr) {
    console.error('❌ Speicherfehler:', saveErr);
    return;
  }
  console.log('✅ Events gespeichert.');

  // --- 5. Schichten synchronisieren (löscht vorher alte Shifts je Event) ---
  console.log('\nSynchronisiere Schichten...');
  let synced = 0;
  for (const u of toUpdate) {
    try {
      await Shifts.syncFromEvent(u.data);
      synced++;
    } catch (e) {
      console.warn(`  ⚠ Sync-Fehler bei "${u.data.event}": ${e.message}`);
    }
  }
  console.log(`✅ ${synced} Event-Schichten synchronisiert.`);

  // --- 6. App-Speicher neu laden ---
  await Cloud.fetch();

  console.log('\n🎉 Import abgeschlossen!');
})();
