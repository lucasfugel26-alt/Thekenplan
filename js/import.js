/* ============================================================
   IMPORT MODULE
   ============================================================ */
const Import = {
  _tab: 'image',
  _imported: [],

  openModal() {
    document.getElementById('import-ov').classList.add('open');
    document.body.style.overflow = 'hidden';
    ['image','pdf','excel'].forEach(t => {
      const el = document.getElementById(`import-result-${t}`);
      if (el) el.innerHTML = '';
    });
    this._imported = [];
    this.switchTab('image');
  },

  closeModal(e) {
    if (e && e.target !== document.getElementById('import-ov')) return;
    document.getElementById('import-ov').classList.remove('open');
    document.body.style.overflow = '';
    this._imported = [];
  },

  switchTab(tab) {
    this._tab = tab;
    document.querySelectorAll('.itab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    ['image','pdf','excel'].forEach(t => {
      const p = document.getElementById(`import-panel-${t}`);
      if (p) p.style.display = t === tab ? 'block' : 'none';
    });
  },

  _getSelectedFields() {
    const f = [];
    if (document.getElementById('ifield-vnr')?.checked) f.push('veranstaltungsnummer');
    if (document.getElementById('ifield-belegung')?.checked) f.push('belegungsende');
    if (document.getElementById('ifield-besucher')?.checked) f.push('besucherzahl');
    if (document.getElementById('ifield-notes')?.checked) f.push('notes');
    return f;
  },

  async handleFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (['xlsx','xls','csv'].includes(ext)) {
      await this._handleExcel(file);
    } else if (ext === 'pdf') {
      await this._callAI({ file, mediaType: 'application/pdf', fields: this._getSelectedFields() });
    } else if (['png','jpg','jpeg','webp','gif'].includes(ext)) {
      await this._callAI({ file, mediaType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, fields: this._getSelectedFields() });
    } else {
      alert('Format nicht unterstützt. Bitte PNG, JPG, PDF, Excel oder CSV verwenden.');
    }
  },

  async _handleExcel(file) {
    const resultEl = document.getElementById(`import-result-${this._tab}`);
    if (resultEl) resultEl.innerHTML = '<div style="color:var(--txd);padding:12px">&#128196; Lese Datei…</div>';
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const tableText = rows
        .filter(r => r.some(c => String(c).trim() !== ''))
        .map(r => r.map(c => String(c).trim()).join(' | '))
        .join('\n');
      if (!tableText.trim()) {
        if (resultEl) resultEl.innerHTML = '<div style="color:var(--miss);padding:12px">Die Datei scheint leer zu sein.</div>';
        return;
      }
      await this._callAI({ text: tableText, resultEl, fields: this._getSelectedFields() });
    } catch(e) {
      if (resultEl) resultEl.innerHTML = `<div style="color:var(--miss);padding:12px">Fehler beim Lesen der Datei: ${e.message}</div>`;
    }
  },

  async _callAI({ file, mediaType, text, resultEl, fields = [] }) {
    const el = resultEl || document.getElementById(`import-result-${this._tab}`);
    if (el) el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--txd)">&#129302; KI analysiert… (10–30 Sek.)</div>';
    const { data: { session } } = await db.auth.getSession();
    const token = session?.access_token;
    if (!token) { if (el) el.innerHTML = '<div style="color:var(--miss);padding:12px">Nicht angemeldet.</div>'; return; }
    const locations = Object.entries(LOCS).map(([, l]) => ({ short: l.short, name: l.name }));
    try {
      let body;
      if (text) {
        body = { text, locations, fields };
      } else {
        const base64 = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result.split(',')[1]);
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        body = { data: base64, mediaType, locations, fields };
      }
      const resp = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        if (el) el.innerHTML = `<div style="color:var(--miss);padding:12px">&#9888; ${_esc(errData.error || 'API-Fehler')}</div>`;
        return;
      }
      const result = await resp.json();
      let events = [];
      try {
        const cleaned = result.text.replace(/```json|```/g, '').trim();
        const match = cleaned.match(/\[([\s\S]*)\]/);
        events = JSON.parse(match ? '[' + match[1] + ']' : cleaned);
        if (!Array.isArray(events)) events = [];
      } catch(parseErr) {
        if (el) el.innerHTML = `<div style="color:var(--miss);padding:12px">KI-Antwort konnte nicht verarbeitet werden.<br><pre style="font-size:.7rem;overflow:auto;margin-top:8px;max-height:200px">${_esc(result.text?.slice(0,800)||'')}</pre></div>`;
        return;
      }
      this._showPreview(events, el);
    } catch(e) {
      if (el) el.innerHTML = `<div style="color:var(--miss);padding:12px">Fehler: ${e.message}</div>`;
    }
  },

  _resolveLocation(locShort) {
    if (!locShort) return null;
    const s = locShort.trim().toLowerCase();
    const found = Object.entries(LOCS).find(([, l]) => l.short.toLowerCase() === s);
    return found ? Number(found[0]) : null;
  },

  _showPreview(events, container) {
    if (!container) return;
    if (!events.length) {
      container.innerHTML = '<div style="color:var(--txm);text-align:center;padding:20px">Keine Events erkannt. Bitte Datei prüfen.</div>';
      return;
    }
    const defaultLoc = Number(Object.keys(LOCS)[0]) || 1;
    this._imported = events.map((e, i) => ({
      ...e, _idx: i, _selected: true,
      _location: this._resolveLocation(e.location) || defaultLoc,
    }));
    const locOpts = (selVal) => Object.entries(LOCS)
      .map(([id, l]) => `<option value="${id}"${Number(id) === selVal ? ' selected' : ''}>${l.short} – ${l.name}</option>`)
      .join('');
    const autoMapped = this._imported.filter(e => this._resolveLocation(e.location)).length;
    container.innerHTML =
      `<div style="font-size:.82rem;color:var(--txd);margin-bottom:12px">
        <strong>${events.length} Event(s) erkannt</strong>${autoMapped ? ` · ${autoMapped} Locations automatisch zugeordnet` : ''} – bitte prüfen:
      </div>` +
      this._imported.map((ev, i) => `
        <div class="imp-row">
          <input type="checkbox" id="imp-cb-${i}" checked onchange="Import._imported[${i}]._selected=this.checked">
          <div class="imp-info">
            <div class="imp-name">${_esc(ev.event || '(kein Name)')}</div>
            <div class="imp-date">${ev.date || 'kein Datum'}${ev.einlasszeit ? ' · Einlass: ' + ev.einlasszeit : ''}${ev.schlussShow ? ' – ' + ev.schlussShow : ''}${ev.belegungsende ? ' (Ende: ' + ev.belegungsende + ')' : ''}</div>
            ${ev.veranstaltungsnummer ? `<div style="font-size:.7rem;color:var(--txm)">Nr: ${_esc(String(ev.veranstaltungsnummer))}</div>` : ''}
            ${ev.besucherzahl ? `<div style="font-size:.7rem;color:var(--txm)">Besucher: ${ev.besucherzahl}</div>` : ''}
            ${ev.notes ? `<div style="font-size:.7rem;color:var(--txm)">${_esc(ev.notes)}</div>` : ''}
          </div>
          <select class="fi" style="width:auto;min-width:90px" onchange="Import._imported[${i}]._location=Number(this.value)">${locOpts(ev._location)}</select>
        </div>`).join('') +
      `<div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn btn-primary" onclick="Import.applyImport()">✓ Ausgewählte importieren</button>
        <button class="btn btn-ghost" onclick="Import._imported=[];this.closest('.import-body').querySelectorAll('.imp-row,div[style*=gap]').forEach(e=>e.remove())">Abbrechen</button>
      </div>`;
  },

  async applyImport() {
    const sel = this._imported.filter(e => e._selected);
    if (!sel.length) { alert('Keine Events ausgewählt.'); return; }
    sel.forEach(ev => {
      let startGastro = ev.startGastro || null;
      const einlasszeit = ev.einlasszeit || null;
      if (!startGastro && einlasszeit) {
        const [h,m] = einlasszeit.split(':').map(Number);
        const mins = ((h*60+m-30)%1440+1440)%1440;
        startGastro = String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');
      }
      EVENTS.push({
        id: uid(),
        date: ev.date || '',
        location: ev._location || Number(Object.keys(LOCS)[0]) || 1,
        event: ev.event || '(kein Name)',
        notes: ev.notes || '',
        einlasszeit,
        veranstaltungsnummer: ev.veranstaltungsnummer || null,
        belegungsende: ev.belegungsende || null,
        besucherzahl: ev.besucherzahl ? Number(ev.besucherzahl) : null,
        bechertyp: 'unbekannt',
        plastik: false,
        missingStaff: false,
        kundenkarte: '',
        prodL: null,
        startGastro,
        schlussShow: ev.schlussShow || null,
        barStaff: [],
      });
    });
    await Cloud.push();
    App.render();
    this.closeModal({ target: document.getElementById('import-ov') });
    alert('✅ ' + sel.length + ' Event(s) importiert!');
  },
};
