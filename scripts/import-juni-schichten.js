/**
 * Juni 2026 – Schichten-Import v2
 *
 * Matching läuft über Datum + Location (keine VNRs in der DB vorhanden).
 * Bei mehreren Events an selben Datum+Location wird per nameKey unterschieden.
 *
 * Ausführen: Kompletten Inhalt in Browser-Console der Thekenplan-App einfügen.
 */

(async function importJuniSchichten() {
  'use strict';
  console.log('=== Juni 2026 Schichten-Import v2 ===\n');

  // --- 1. Alle Juni-Events laden ---
  const { data: rows, error: fetchErr } = await db
    .from('events')
    .select('id, date, location_id, data')
    .gte('date', '2026-06-01')
    .lte('date', '2026-06-30')
    .order('date');

  if (fetchErr) { console.error('Fehler:', fetchErr); return; }
  console.log(rows.length + ' Juni-Events gefunden.\n');

  // --- 2. Schichtdaten aus den Excel-Screenshots ---
  // loc: 1=KH, 2=H39, 3=SR/Sunny, 4=OH
  // nameKey (optional): Wenn an Datum+Location mehrere Events existieren,
  //                     wird nur das Event mit diesem Wort im Namen befüllt.
  const staffData = [

    // ── SR / Sunny (loc 3) ──────────────────────────────────────────────
    { date:'2026-06-03', loc:3,
      prodL:{ name:'Bruce', startTime:'18:30' },
      barStaff:[{ name:'Felix Hölter', pos:1 }] },

    { date:'2026-06-05', loc:3,
      prodL:{ name:'Luise', startTime:'19:00' },
      barStaff:[{ name:'Jonathan', pos:1 }] },

    { date:'2026-06-06', loc:3,
      prodL:{ name:'Pauline', startTime:'20:00' },
      barStaff:[{ name:'Igor', pos:1 }] },

    { date:'2026-06-12', loc:3,
      prodL:{ name:'Anna', startTime:'20:00' },
      barStaff:[{ name:'Claudio', pos:1 }] },

    { date:'2026-06-13', loc:3,
      prodL:{ name:'Luise', startTime:'20:00' },
      barStaff:[{ name:'', pos:1, miss:true }],
      missingStaff:true },

    { date:'2026-06-19', loc:3,
      prodL:{ name:'Luise', startTime:'20:00' },
      barStaff:[{ name:'Jonathan', pos:1 }] },

    { date:'2026-06-26', loc:3,
      prodL:{ name:'Bruce', startTime:'21:00' },
      barStaff:[{ name:'Ines', pos:1 }] },

    { date:'2026-06-27', loc:3,
      prodL:{ name:'Anna', startTime:'17:00' },
      barStaff:[{ name:'Ines', pos:1 }] },

    // ── OH (loc 4) ──────────────────────────────────────────────────────
    { date:'2026-06-12', loc:4,
      prodL:{ name:'Marlon', startTime:'15:45' },
      barStaff:[{ name:'Dominic', pos:1 }] },

    { date:'2026-06-20', loc:4,
      prodL:{ name:'Marlon', startTime:'15:30' },
      barStaff:[{ name:'Jonathan', pos:1 }] },

    { date:'2026-06-26', loc:4,
      prodL:{ name:'Marlon', startTime:'17:00' },
      barStaff:[{ name:'Henry', pos:1 }] },

    // ── H39 (loc 2) ─────────────────────────────────────────────────────
    { date:'2026-06-05', loc:2,
      prodL:{ name:'Bruce', startTime:'20:00' },
      barStaff:[
        { name:'Felix Hölter', pos:1 },
        { name:'Tim',          pos:2 },
        { name:'Franzi',       pos:3, ov:'22:30' }
      ] },

    // Fr.12.06 H39: "neues Partyformat (Ü16...)" – nameKey verhindert, dass
    // "Yeehaw Party" am selben Tag ebenfalls befüllt wird.
    { date:'2026-06-12', loc:2, nameKey:'partyformat',
      prodL:{ name:'Luise', startTime:'16:30' },
      barStaff:[
        { name:'Henry',  pos:1 },
        { name:'Gala',   pos:2 },
        { name:'Bonnie', pos:3 },
        { name:'Basti',  role:'Kasse' }
      ] },

    { date:'2026-06-19', loc:2,
      prodL:{ name:'Marlon', startTime:'14:00' },
      barStaff:[
        { name:'Richard', pos:1 },
        { name:'',        pos:2, miss:true },
        { name:'Kostja',  role:'Kasse' }
      ],
      missingStaff:true },

    { date:'2026-06-20', loc:2,
      prodL:{ name:'Lena', startTime:'11:30' },
      barStaff:[
        { name:'Henry',  pos:1 },
        { name:'Lucia',  pos:2 },
        { name:'Bonnie', pos:3 },
        { name:'Mady',   role:'Kasse', ov:'14:30' }
      ] },

    { date:'2026-06-23', loc:2,
      prodL:{ name:'Luise', startTime:'14:00' },
      barStaff:[
        { name:'Igor',      pos:1 },
        { name:'Richard',   pos:2 },
        { name:'Dave Crew', role:'Garderobe' }
      ] },

    { date:'2026-06-24', loc:2,
      prodL:{ name:'Luise', startTime:'14:30' },
      barStaff:[
        { name:'Lucia',     pos:1 },
        { name:'Bonnie',    pos:2 },
        { name:'Jonathan',  pos:3 },
        { name:'Mady',      role:'Garderobe' },
        { name:'Dave Crew', role:'Garderobe' }
      ] },

    { date:'2026-06-27', loc:2,
      prodL:{ name:'Lena', startTime:'13:30' },
      barStaff:[
        { name:'Bonnie',     pos:1 },
        { name:'Felix Hohl', pos:2 },
        { name:'Claudio',    pos:3 },
        { name:'Galia',      pos:4 },
        { name:'Kostja',     role:'Garderobe' }
      ] },

    // ── KH (loc 1) ──────────────────────────────────────────────────────
    { date:'2026-06-09', loc:1,
      prodL:{ name:'Luise', startTime:'15:30' },
      barStaff:[
        { name:'Igor',      pos:1 },
        { name:'Henry',     pos:2 },
        { name:'Lucia',     pos:3 },
        { name:'Sascha',    role:'Kasse' },
        { name:'Dave Crew', role:'Garderobe' }
      ] },

    { date:'2026-06-13', loc:1,
      prodL:{ name:'Marlon', startTime:'18:30' },
      barStaff:[
        { name:'Claudio', pos:1, ov:'20:30' },
        { name:'Tim',     pos:2, ov:'20:30' },
        { name:'Galia',   pos:3 },
        { name:'Bonnie',  pos:4 }
      ] },

    { date:'2026-06-18', loc:1,
      prodL:{ name:'Lena', startTime:'15:30' },
      barStaff:[
        { name:'Richard',   pos:1 },
        { name:'Jonathan',  pos:2 },
        { name:'Dave Crew', role:'Garderobe' }
      ] },

    { date:'2026-06-19', loc:1,
      prodL:{ name:'Bruce', startTime:'14:30' },
      barStaff:[
        { name:'Laura',     pos:1, ov:'18:00' },
        { name:'Tim',       pos:2, ov:'18:00' },
        { name:'Dave Crew', role:'Garderobe' }
      ] },

    // Sa.20.06 KH: zwei Schichten – Richard/Ines ab startGastro,
    // Galia/Felix ab 20:00, Ablöse Laura/Bonnie ab 17:00
    { date:'2026-06-20', loc:1,
      prodL:{ name:'Anna', startTime:'09:30' },
      barStaff:[
        { name:'Richard',    pos:1 },
        { name:'Ines',       pos:2 },
        { name:'Galia',      pos:3, ov:'20:00' },
        { name:'Felix Hohl', pos:4, ov:'20:00' },
        { name:'Mady',       role:'Kasse' },
        { name:'Dave Crew',  role:'Garderobe' },
        { name:'Laura',      pos:1, ov:'17:00' },
        { name:'Bonnie',     pos:2, ov:'17:00' }
      ] },

    { date:'2026-06-24', loc:1,
      prodL:{ name:'Anna', startTime:'14:00' },
      barStaff:[
        { name:'Dominic',   pos:1 },
        { name:'Igor',      pos:2 },
        { name:'Dave Crew', role:'Garderobe' }
      ] },

    { date:'2026-06-26', loc:1,
      prodL:{ name:'Luise', startTime:'14:00' },
      barStaff:[
        { name:'Franzi',   pos:1 },
        { name:'Jonathan', pos:2 },
        { name:'Sascha',   role:'Kasse' }
      ] },

    { date:'2026-06-27', loc:1,
      prodL:{ name:'Luise', startTime:'14:30' },
      barStaff:[
        { name:'Henry', pos:1 },
        { name:'Tim',   pos:2 }
      ] },

    { date:'2026-06-29', loc:1,
      prodL:{ name:'Bruce', startTime:'14:00' },
      barStaff:[
        { name:'Jonathan', pos:1 },
        { name:'Laura',    pos:2 },
        { name:'Mady',     role:'Kasse' }
      ] },
  ];

  // --- 3. Match-Funktion: Datum + Location (+ optional nameKey) ---
  function findEntry(ev) {
    const loc    = ev.location;
    const evName = (ev.event || '').toLowerCase();

    for (const e of staffData) {
      if (e.date !== ev.date || e.loc !== loc) continue;

      // Wenn nameKey gesetzt: nur matchen wenn Name passt
      if (e.nameKey) {
        if (evName.includes(e.nameKey.toLowerCase())) return e;
        continue;
      }

      // Kein nameKey: nur verwenden wenn kein anderer nameKey-Eintrag
      // für dieses Datum+Location existiert, der besser passt
      const hasNameKeyEntry = staffData.some(
        x => x.date === e.date && x.loc === e.loc && x.nameKey
      );
      if (!hasNameKeyEntry) return e;

      // Namekey-Eintrag existiert → nur zurückgeben wenn der nameKey NICHT matcht
      // (damit das andere Event den einfachen Eintrag bekommt)
      const nameKeyMatches = staffData.some(
        x => x.date === e.date && x.loc === e.loc && x.nameKey && evName.includes(x.nameKey.toLowerCase())
      );
      if (!nameKeyMatches) return e;
    }
    return null;
  }

  // --- 4. Events durchgehen ---
  const toUpdate = [];
  let skippedFilled = 0, skippedNoMatch = 0;

  for (const row of rows) {
    const ev    = row.data;
    const entry = findEntry(ev);

    if (!entry) {
      console.log('⏭  Kein Eintrag: "' + ev.event + '" (' + ev.date + ' loc:' + ev.location + ')');
      skippedNoMatch++;
      continue;
    }

    // Duplikat-Schutz
    const alreadyFilled = ev.barStaff?.some(s => s.name?.trim()) || ev.prodL?.name?.trim();
    if (alreadyFilled) {
      console.log('✔  Bereits befüllt: "' + ev.event + '" (' + ev.date + ')');
      skippedFilled++;
      continue;
    }

    const updated = Object.assign({}, ev);

    if (entry.prodL) {
      updated.prodL = { name: entry.prodL.name, startTime: entry.prodL.startTime, employeeId: null };
    }
    updated.barStaff = (entry.barStaff || []).map((s, i) => ({
      name:       s.name  || '',
      pos:        s.pos   != null ? s.pos : (i + 1),
      ov:         s.ov    || null,
      miss:       s.miss  || false,
      role:       s.role  || 'Thekenkraft',
      statuses:   [],
      employeeId: null
    }));
    if (entry.missingStaff) updated.missingStaff = true;

    toUpdate.push({ id: row.id, date: row.date, location_id: row.location_id, data: updated });
    console.log('📝 Vorbereitet: "' + ev.event + '" (' + ev.date + ')');
  }

  console.log('\n' + toUpdate.length + ' Events werden aktualisiert');
  console.log(skippedFilled + ' bereits befüllt (übersprungen)');
  console.log(skippedNoMatch + ' ohne Schichtdaten (übersprungen)\n');

  if (toUpdate.length === 0) { console.log('Nichts zu tun.'); return; }

  // --- 5. Speichern ---
  const { error: saveErr } = await db.from('events').upsert(
    toUpdate.map(u => ({
      id:          u.id,
      date:        u.date,
      location_id: u.location_id,
      data:        u.data,
      updated_at:  new Date().toISOString()
    }))
  );
  if (saveErr) { console.error('❌ Speicherfehler:', saveErr); return; }
  console.log('✅ Events gespeichert.');

  // --- 6. Shifts synchronisieren ---
  let synced = 0;
  for (const u of toUpdate) {
    try { await Shifts.syncFromEvent(u.data); synced++; }
    catch (e) { console.warn('  ⚠ Sync-Fehler bei "' + u.data.event + '": ' + e.message); }
  }
  console.log('✅ ' + synced + ' Event-Schichten synchronisiert.');

  await Cloud.fetch();
  console.log('\n🎉 Import abgeschlossen!');
})();
