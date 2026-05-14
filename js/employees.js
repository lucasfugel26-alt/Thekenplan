/* ============================================================
   EMPLOYEES MODULE
   ============================================================ */
const Employees = {
  _rows: [],
  _selected: null,

  async load() {
    try {
      const {data,error} = await db.from('employees').select('*').order('sort_order').order('name');
      if(!error && data) this._rows = data;
    } catch(e) { console.warn('[Employees] load:', e.message); }
  },

  getAll() { return this._rows; },
  getById(id) { return this._rows.find(e=>e.id===id)||null; },
  getByName(name) {
    const n=name.toLowerCase().trim();
    return this._rows.find(e=>e.name.toLowerCase()===n)||null;
  },

  async create(emp) {
    const {data,error} = await db.from('employees').insert(emp).select().single();
    if(error) throw error;
    this._rows.push(data);
    this._rows.sort((a,b)=>{const r=(a.default_role||'').localeCompare(b.default_role||'','de');return r!==0?r:a.name.localeCompare(b.name,'de');});
    return data;
  },
  async update(id, updates) {
    const {error} = await db.from('employees').update(updates).eq('id',id);
    if(error) throw error;
    const idx=this._rows.findIndex(e=>e.id===id);
    if(idx!==-1) Object.assign(this._rows[idx],updates);
  },
  async remove(id) {
    if(!confirm('Mitarbeiter wirklich löschen? Alle Schichten werden ebenfalls gelöscht.')) return;
    const {error}=await db.from('employees').delete().eq('id',id);
    if(error){alert('Fehler: '+error.message);return;}
    this._rows=this._rows.filter(e=>e.id!==id);
    if(this._selected===id){this._selected=null;this._renderEmpty();}
    this.renderList();
  },

  /* ── TAB SWITCHING ─── */
  showTab(tab) {
    document.getElementById('tcontent-emp').style.display=tab==='emp'?'flex':'none';
    document.getElementById('tcontent-acc').style.display=tab==='acc'?'flex':'none';
    document.getElementById('ttab-emp').classList.toggle('active',tab==='emp');
    document.getElementById('ttab-acc').classList.toggle('active',tab==='acc');
    if(tab==='acc') App._loadUsersList();
  },

  /* ── LIST ─── */
  filter() {
    const q=(document.getElementById('emp-search')?.value||'').toLowerCase();
    const sf=document.getElementById('emp-sf')?.value||'';
    const list=document.getElementById('emp-list');
    if(!list) return;
    const rows=this._rows.filter(e=>{
      if(!isInStaffScope(e.default_role||'Thekenkraft') && !can(PERM.STAFF_VIEW_ALL_CATEGORIES)) return false;
      if(sf && e.status!==sf) return false;
      if(q && !e.name.toLowerCase().includes(q) && !(e.default_role||'').toLowerCase().includes(q)) return false;
      return true;
    }).sort((a,b)=>{
      const r=(a.default_role||'').localeCompare(b.default_role||'','de');
      return r!==0?r:a.name.localeCompare(b.name,'de');
    });
    list.innerHTML=rows.length===0
      ? '<div style="padding:16px;font-size:.8rem;color:var(--txm);text-align:center">Keine Mitarbeiter</div>'
      : rows.map(e=>this._empItemHTML(e)).join('');
  },
  renderList() { this.filter(); },

  _empItemHTML(e) {
    const bg=e.color||'#22d4a4';
    const fg=_contrastColor(bg);
    const active=this._selected===e.id?' active':'';
    return `<div class="emp-item${active}" onclick="Employees.select('${e.id}')">
      <span class="emp-badge" style="background:${bg};color:${fg}">${e.kuerzel||'?'}</span>
      <div class="emp-item-info">
        <div class="emp-item-name">${_esc(e.name)}</div>
        <div class="emp-item-role">${_esc(e.default_role||'')}</div>
      </div>
      <span class="emp-status-dot ${e.status||'aktiv'}"></span>
    </div>`;
  },

  /* ── SELECT / DETAIL ─── */
  async select(id) {
    this._selected=id;
    this.renderList();
    const emp=this.getById(id);
    if(!emp) return;
    const main=document.getElementById('emp-main');
    main.innerHTML='<div style="padding:28px;color:var(--txm);font-size:.82rem">Lade Schichten…</div>';
    const shifts=await Shifts.loadForEmployee(id);
    main.innerHTML=this._detailHTML(emp, shifts);
    this._initHoursFilter(emp, shifts);
  },

  _detailHTML(emp, shifts) {
    const bg=emp.color||'#22d4a4';
    const fg=_contrastColor(bg);
    const now=new Date();
    const y=now.getFullYear(), m=String(now.getMonth()+1).padStart(2,'0');
    const from=`${y}-${m}-01`, to=`${y}-${m}-31`;
    const istH=Shifts.sumHours(shifts,from,to);
    const period=emp.soll_period||'month';
    const rawSoll=Number(emp.soll_stunden)||0;
    const sollH=period==='week'?Math.round(rawSoll*4.33*2)/2:rawSoll;
    const diff=istH-sollH;
    const sollLabel=rawSoll?(rawSoll+'h/'+(period==='week'?'Woche':'Monat')):null;
    return `
    <div class="emp-det-head">
      <span class="emp-badge lg" style="background:${bg};color:${fg}">${emp.kuerzel||'?'}</span>
      <h3>${_esc(emp.name)}</h3>
      <span class="emp-status-pill ${emp.status||'aktiv'}">${emp.status||'aktiv'}</span>
      ${can(PERM.STAFF_EDIT)?`<button class="btn btn-ghost" style="font-size:.75rem;padding:5px 12px" onclick="Employees.openEdit('${emp.id}')">&#9998; Bearbeiten</button>`:''}
      ${can(PERM.STAFF_DELETE)?`<button class="btn btn-ghost" style="font-size:.75rem;padding:5px 9px;color:var(--miss);border-color:rgba(255,80,80,.3)" onclick="Employees.remove('${emp.id}')" title="Löschen">&#128465;</button>`:''}
    </div>
    <div class="emp-det-meta">
      ${emp.default_role?`<span class="emp-det-meta-item">&#127970; ${_esc(emp.default_role)}</span>`:''}
      ${emp.email?`<span class="emp-det-meta-item">&#128140; ${_esc(emp.email)}</span>`:''}
      ${emp.phone?`<span class="emp-det-meta-item">&#128222; ${_esc(emp.phone)}</span>`:''}
      ${sollLabel?`<span class="emp-det-meta-item">&#8987; Soll: ${sollLabel}</span>`:''}
      ${can(PERM.STAFF_VIEW_NOTES)&&emp.notes?`<div style="width:100%;margin-top:6px;padding:10px 12px;background:var(--bg3);border-radius:8px;font-size:.8rem;color:var(--txm)">${_esc(emp.notes)}</div>`:''}
    </div>
    ${can(PERM.STAFF_MANAGE_ACCESS)?`<div class="emp-access-row">
      <span class="emp-access-label">&#128273; Zugang</span>
      ${emp.profile_id
        ?`<span class="emp-status-pill aktiv" style="font-size:.72rem">&#10003; Aktiv</span>
          <button class="btn btn-ghost" style="font-size:.72rem;padding:4px 10px"
            onclick="App.resetEmployeePassword('${emp.id}')">&#128279; Reset-Link generieren</button>`
        :`<span style="font-size:.78rem;color:var(--txm)">Kein Zugang</span>
          ${emp.email
            ?`<button class="btn btn-ghost" style="font-size:.72rem;padding:4px 10px"
                onclick="App.createEmployeeAccess('${emp.id}')">&#43; Zugang erstellen</button>`
            :`<span style="font-size:.72rem;color:var(--txm);font-style:italic">(E&#8209;Mail erforderlich)</span>`
          }`
      }
    </div>`:''}
    <div class="emp-hours-card">
      <div class="emp-hours-head">
        <h4>&#9203; Stunden</h4>
        <select class="emp-hours-sel" id="emp-hf-${emp.id}" onchange="Employees.updateHours('${emp.id}')">
          <option value="month">Dieser Monat</option>
          <option value="lastmonth">Letzter Monat</option>
          <option value="week">Diese Woche</option>
          <option value="all">Gesamt</option>
        </select>
      </div>
      <div class="emp-hours-grid" id="emp-hg-${emp.id}">
        ${this._hoursGridHTML(istH, sollH, diff, 'month', period)}
      </div>
    </div>
    ${this._shiftsHTML(shifts, emp.id)}`;
  },

  _shiftRow(s, past) {
    const st=s.actual_start_time||s.start_time||'–';
    const et=s.actual_end_time||s.end_time||'–';
    const dur=Shifts.calcDuration(st,et);
    const durStr=dur>0?(dur%1===0?dur+'h':dur.toFixed(1)+'h'):'–';
    const becherIcon=s.bechertyp==='plastik'?'🥤':s.bechertyp==='glas'?'🍺':'–';
    const timeChanged=past&&s.confirmed&&(s.actual_start_time||s.actual_end_time);
    const canEditShift=isInStaffScope(s.role||'Thekenkraft')||can(PERM.SHIFTS_MANAGE_ALL_CATEGORIES);
    const confirmCell=past
      ?`<td style="white-space:nowrap">
          ${s.confirmed?`<span class="shift-confirmed-badge">&#10003; Best&auml;tigt</span> `:''}
          ${canEditShift?`<button class="btn btn-ghost" style="font-size:.7rem;padding:3px 8px" title="Anpassen"
            onclick="Employees._openConfirmShift('${s.id}','${s.actual_start_time||s.start_time||''}','${s.actual_end_time||s.end_time||''}')">&#9998;</button>`:''}
          ${canEditShift?`<button class="btn btn-ghost" style="font-size:.7rem;padding:3px 6px;color:var(--miss);border-color:rgba(255,80,80,.3)" title="L&ouml;schen"
            onclick="Employees._deleteShift('${s.id}','${s.event_id}','${s.employee_id}')">&#128465;</button>`:''}
        </td>`
      :'';
    const ev=EVENTS.find(e=>e.id===s.event_id);
    const locShort=ev?(LOCS[ev.location]?.short||'–'):'–';
    return `<tr class="${s.confirmed?'confirmed':''}${s.cancelled?' cancelled':''}">
      <td>${_fmtDate(s.event_date)}</td>
      <td style="font-size:.75rem;color:var(--txm);font-weight:600">${_esc(locShort)}</td>
      <td>${_esc(s.event_name||'–')}</td>
      <td>${_esc(s.role||'–')}</td>
      <td class="${timeChanged?'act-time':''}">${st}</td>
      <td class="${timeChanged?'act-time':''}">${et}</td>
      <td>${durStr}</td>
      <td>${s.besucherzahl||'–'}</td>
      <td style="font-size:.75rem">${_esc(s.veranstaltungsnummer||'–')}</td>
      <td>${becherIcon}</td>
      ${confirmCell}
    </tr>`;
  },

  _shiftsHTML(shifts, empId) {
    const today=lds(new Date());
    const future=shifts.filter(s=>s.event_date>=today&&!s.cancelled);
    const past=shifts.filter(s=>s.event_date<today&&!s.cancelled);
    const cancelled=shifts.filter(s=>s.cancelled);
    const plannedH=future.reduce((sum,s)=>sum+Shifts.calcDuration(s.start_time,s.end_time),0);
    const confirmedH=past.filter(s=>s.confirmed).reduce((sum,s)=>sum+Shifts.calcDuration(s.actual_start_time||s.start_time,s.actual_end_time||s.end_time),0);
    const fmtH=h=>h>0?(h%1===0?h+'h':h.toFixed(1)+'h'):'0h';
    const thead=`<thead><tr><th>Datum</th><th>Ort</th><th>Veranstaltung</th><th>Rolle</th><th>Start</th><th>Ende</th><th>Dauer</th><th>Besucher</th><th>VNR</th><th>Becher</th><th></th></tr></thead>`;
    const theadNoAct=`<thead><tr><th>Datum</th><th>Ort</th><th>Veranstaltung</th><th>Rolle</th><th>Start</th><th>Ende</th><th>Dauer</th><th>Besucher</th><th>VNR</th><th>Becher</th></tr></thead>`;
    let html='';
    if(future.length) {
      html+=`<div class="emp-shifts-head" style="margin-top:16px">
        <div class="shift-section-hdr">&#128197; Geplante Schichten (${future.length})
          <span class="shift-planned-badge">${fmtH(plannedH)} geplant</span>
        </div></div>
        <table class="emp-shift-tbl">${theadNoAct}<tbody>${future.map(s=>this._shiftRow(s,false)).join('')}</tbody></table>`;
    }
    if(past.length) {
      html+=`<div class="shift-section-hdr" style="margin-top:20px">&#128336; Vergangene Schichten (${past.length})
        <span class="shift-confirmed-badge">${fmtH(confirmedH)} bestätigt</span>
        <button class="btn btn-ghost" style="font-size:.7rem;padding:3px 9px;margin-left:auto" onclick="Employees.exportPDF('${empId}')">&#128438; PDF</button>
      </div>
      <table class="emp-shift-tbl">${thead}<tbody>${past.map(s=>this._shiftRow(s,true)).join('')}</tbody></table>`;
    }
    if(!future.length&&!past.length)
      html='<div style="color:var(--txm);font-size:.82rem;padding:14px 0">Noch keine Schichten erfasst.</div>';
    if(cancelled.length)
      html+=`<div class="shift-section-hdr" style="margin-top:16px;opacity:.6">&#10007; Abgesagte Schichten (${cancelled.length})</div>
      <table class="emp-shift-tbl">${theadNoAct}<tbody>${cancelled.map(s=>this._shiftRow(s,false)).join('')}</tbody></table>`;
    return html;
  },

  _openConfirmShift(shiftId, origStart, origEnd) {
    const currentStart=origStart, currentEnd=origEnd;
    const modal=document.createElement('div');
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:400;display:flex;align-items:center;justify-content:center';
    modal.innerHTML=`<div style="background:var(--bg2);border-radius:16px;border:1px solid var(--bd);padding:28px;width:min(420px,94vw);box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <h3 style="font-family:var(--fh);font-size:1rem;font-weight:800;margin-bottom:18px">&#9998; Schicht anpassen &amp; bestätigen</h3>
      <div class="frow">
        <div class="fg"><label>Startzeit</label><input class="fi" type="time" id="_cs-start" value="${currentStart}"></div>
        <div class="fg"><label>Endzeit</label><input class="fi" type="time" id="_cs-end" value="${currentEnd}"></div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
        <button class="btn btn-ghost" onclick="this.closest('[style*=fixed]').remove()">Abbrechen</button>
        <button class="btn btn-primary" onclick="Employees._confirmShift('${shiftId}',document.getElementById('_cs-start').value,document.getElementById('_cs-end').value,this.closest('[style*=fixed]'))">&#10003; Bestätigen</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  },

  async _confirmShift(shiftId, actualStart, actualEnd, overlay) {
    try {
      await Shifts.confirm(shiftId, actualStart, actualEnd);
      overlay?.remove();
      if(this._selected) {
        const shifts=await Shifts.loadForEmployee(this._selected);
        const emp=this.getById(this._selected);
        if(emp) document.getElementById('emp-main').innerHTML=this._detailHTML(emp,shifts);
      }
    } catch(e) { alert('Fehler: '+e.message); }
  },

  async _deleteShift(shiftId, eventId, employeeId) {
    if(!confirm('Schicht wirklich löschen? Sie wird auch aus der Veranstaltung entfernt.')) return;
    const {error}=await db.from('shifts').delete().eq('id',shiftId);
    if(error){alert('Fehler: '+error.message);return;}
    // Remove from event barStaff / prodL
    const ev=EVENTS.find(e=>e.id===eventId);
    if(ev){
      const isProdL=ev.prodL&&(ev.prodL.employeeId===employeeId||Employees.getByName(ev.prodL.name)?.id===employeeId);
      if(isProdL){
        ev.prodL=null;
      } else {
        ev.barStaff=(ev.barStaff||[]).filter(s=>{
          const sid=s.employeeId||Employees.getByName(s.name)?.id;
          return sid!==employeeId;
        });
        ev.barStaff.forEach((s,i)=>s.pos=i+1);
      }
      await Cloud.push();
      App.render();
    }
    // Update local cache
    Object.values(Shifts._cache).forEach(arr=>{
      const idx=arr.findIndex(s=>s.id===shiftId);
      if(idx!==-1) arr.splice(idx,1);
    });
    if(this._selected){
      const shifts=await Shifts.loadForEmployee(this._selected);
      const emp=this.getById(this._selected);
      if(emp) document.getElementById('emp-main').innerHTML=this._detailHTML(emp,shifts);
    }
  },

  exportPDF(empId) {
    const emp=this.getById(empId);
    if(!emp) return;
    const shifts=Shifts._cache[empId]||[];
    const today=lds(new Date());
    const future=shifts.filter(s=>s.event_date>=today&&!s.cancelled).sort((a,b)=>a.event_date.localeCompare(b.event_date));
    const past=shifts.filter(s=>s.event_date<today&&!s.cancelled).sort((a,b)=>b.event_date.localeCompare(a.event_date));
    const bg=emp.color||'#22d4a4';
    const fg=_contrastColor(bg);
    const fmtH=h=>h%1===0?h+'h':h.toFixed(1)+'h';
    const totalH=past.reduce((sum,s)=>sum+Shifts.calcDuration(s.actual_start_time||s.start_time,s.actual_end_time||s.end_time),0);
    const confirmedH=past.filter(s=>s.confirmed).reduce((sum,s)=>sum+Shifts.calcDuration(s.actual_start_time||s.start_time,s.actual_end_time||s.end_time),0);
    const plannedH=future.reduce((sum,s)=>sum+Shifts.calcDuration(s.start_time,s.end_time),0);
    const shiftRow=(s,showStatus)=>{
      const st=s.actual_start_time||s.start_time||'–';
      const et=s.actual_end_time||s.end_time||'–';
      const dur=Shifts.calcDuration(st,et);
      return`<tr class="${s.confirmed?'confirmed':''}">
        <td>${_fmtDate(s.event_date)}</td><td>${s.event_name||'–'}</td><td>${s.role||'–'}</td>
        <td>${st}</td><td>${et}</td><td>${dur?fmtH(dur):'–'}</td>
        ${showStatus?`<td>${s.confirmed?'<span class="tick">&#10003; Bestätigt</span>':'Offen'}</td>`:'<td>–</td>'}
      </tr>`;
    };
    const win=window.open('','_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Schichtbericht – ${emp.name}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:system-ui,sans-serif;max-width:900px;margin:24px auto;padding:0 20px;font-size:13px;color:#1a1a2e}
      .badge{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:10px;
        background:${bg};color:${fg};font-weight:800;font-size:.9rem;vertical-align:middle}
      h1{font-size:1.1rem;margin:20px 0 4px;padding-top:16px;border-top:2px solid #eee}
      h1:first-of-type{border-top:none;margin-top:0}
      .meta{color:#666;font-size:.82rem;margin-bottom:16px}
      .summary{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
      .sum-box{border:1px solid #ddd;border-radius:8px;padding:10px 16px;text-align:center;flex:1;min-width:80px}
      .sum-val{font-size:1.3rem;font-weight:800}
      .sum-lbl{font-size:.7rem;color:#888;margin-top:2px}
      table{width:100%;border-collapse:collapse;margin-bottom:8px}
      th{text-align:left;border-bottom:2px solid #ddd;padding:7px 8px;font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:#666}
      td{padding:7px 8px;border-bottom:1px solid #eee;font-size:.82rem}
      tr.confirmed td{background:#f0fdf8}
      .tick{color:#16a34a;font-weight:700}
      .future-row td{background:#f5f9ff}
      .no-print{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}
      @media print{.no-print{display:none}}
    </style></head><body>
    <div class="no-print">
      <button onclick="window.print()" style="padding:7px 16px;border-radius:7px;border:1px solid #ddd;background:#f5f5f5;cursor:pointer;font-size:.84rem">&#128438; Drucken / Als PDF speichern</button>
      <button onclick="window.close()" style="padding:7px 16px;border-radius:7px;border:1px solid #ddd;background:#fff;cursor:pointer;font-size:.84rem">&#10005; Schlie&szlig;en</button>
    </div>
    <p><span class="badge">${emp.kuerzel||'?'}</span> &nbsp;<strong style="font-size:1.1rem">${emp.name}</strong></p>
    <div class="meta">Erstellt: ${new Date().toLocaleDateString('de-DE')} &nbsp;|&nbsp; Rolle: ${emp.default_role||'–'} &nbsp;|&nbsp; Soll: ${emp.soll_stunden||0}h/${emp.soll_period==='week'?'Woche':'Monat'}</div>

    ${future.length?`
    <h1>&#128197; Geplante Schichten (${future.length})</h1>
    <div class="summary">
      <div class="sum-box"><div class="sum-val">${future.length}</div><div class="sum-lbl">Schichten</div></div>
      <div class="sum-box"><div class="sum-val">${fmtH(plannedH)}</div><div class="sum-lbl">Geplante Stunden</div></div>
    </div>
    <table><thead><tr><th>Datum</th><th>Veranstaltung</th><th>Rolle</th><th>Start</th><th>Ende</th><th>Dauer</th><th>Status</th></tr></thead>
    <tbody>${future.map(s=>shiftRow(s,false).replace('<tr ','<tr class="future-row" ')).join('')}</tbody></table>`:''}

    ${past.length?`
    <h1>&#128336; Vergangene Schichten (${past.length})</h1>
    <div class="summary">
      <div class="sum-box"><div class="sum-val">${past.length}</div><div class="sum-lbl">Schichten</div></div>
      <div class="sum-box"><div class="sum-val">${fmtH(totalH)}</div><div class="sum-lbl">Gesamtstunden</div></div>
      <div class="sum-box"><div class="sum-val" style="color:#16a34a">${fmtH(confirmedH)}</div><div class="sum-lbl">Bestätigt</div></div>
    </div>
    <table><thead><tr><th>Datum</th><th>Veranstaltung</th><th>Rolle</th><th>Start</th><th>Ende</th><th>Dauer</th><th>Status</th></tr></thead>
    <tbody>${past.map(s=>shiftRow(s,true)).join('')}</tbody></table>`:''}
    </body></html>`);
    win.document.close();
  },

  _hoursGridHTML(ist, soll, diff, mode, empPeriod) {
    const fmtH=h=>h%1===0?h+'h':h.toFixed(1)+'h';
    const overClass=diff>=0?'over':'under';
    const diffLabel=diff>=0?'+'+fmtH(diff):'-'+fmtH(Math.abs(diff));
    const showSoll=soll>0 && mode!=='all';
    return `
      <div class="emp-hours-stat">
        <div class="emp-hours-val">${fmtH(ist)}</div>
        <div class="emp-hours-lbl">Gearbeitet</div>
      </div>
      ${showSoll?`<div class="emp-hours-stat">
        <div class="emp-hours-val">${fmtH(soll)}</div>
        <div class="emp-hours-lbl">Soll</div>
      </div>
      <div class="emp-hours-stat">
        <div class="emp-hours-val ${overClass}">${diffLabel}</div>
        <div class="emp-hours-lbl">${diff>=0?'Überstunden':'Fehlstunden'}</div>
      </div>`:`<div class="emp-hours-stat" style="grid-column:2/-1">
        <div class="emp-hours-lbl" style="margin-top:14px;color:var(--txm)">Kein Soll hinterlegt</div>
      </div>`}`;
  },

  _initHoursFilter(emp, shifts) { /* wired via onchange in select */ },

  updateHours(empId) {
    const emp=this.getById(empId);
    if(!emp) return;
    const sel=document.getElementById('emp-hf-'+empId);
    const mode=sel?.value||'month';
    const shifts=Shifts._cache[empId]||[];
    const now=new Date();
    let from=null, to=null;
    if(mode==='month'){
      const y=now.getFullYear(),m=String(now.getMonth()+1).padStart(2,'0');
      from=`${y}-${m}-01`; to=`${y}-${m}-31`;
    } else if(mode==='lastmonth'){
      const d=new Date(now.getFullYear(),now.getMonth()-1,1);
      const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0');
      from=`${y}-${m}-01`; to=`${y}-${m}-31`;
    } else if(mode==='week'){
      const mon=new Date(now); mon.setDate(now.getDate()-((now.getDay()+6)%7));
      const sun=new Date(mon); sun.setDate(mon.getDate()+6);
      from=mon.toISOString().slice(0,10); to=sun.toISOString().slice(0,10);
    }
    const istH=Shifts.sumHours(shifts,from,to);
    const period=emp.soll_period||'month';
    const rawSoll=Number(emp.soll_stunden)||0;
    let sollH=0;
    if(rawSoll) {
      if(mode==='week')      sollH=period==='week'?rawSoll:Math.round(rawSoll/4.33*2)/2;
      else if(mode==='all')  sollH=0;
      else                   sollH=period==='week'?Math.round(rawSoll*4.33*2)/2:rawSoll;
    }
    const diff=istH-sollH;
    const grid=document.getElementById('emp-hg-'+empId);
    if(grid) grid.innerHTML=this._hoursGridHTML(istH,sollH,diff,mode,period);
  },

  _renderEmpty() {
    const main=document.getElementById('emp-main');
    if(main) main.innerHTML='<div class="emp-empty"><div style="font-size:2.5rem">&#128101;</div><div>Mitarbeiter auswählen</div></div>';
  },

  /* ── MODAL (create/edit) ─── */
  openCreate() {
    // Anlegen nur erlauben wenn mindestens eine Kategorie im Scope liegt
    const scopedRoles=Config.data.employeeRoles.filter(r=>isInStaffScope(r)||can(PERM.STAFF_EDIT_ALL_CATEGORIES));
    if(scopedRoles.length===0){alert('Du hast keinen Schreibzugriff auf Mitarbeiterkategorien.');return;}
    document.getElementById('em-id').value='';
    document.getElementById('em-title').textContent='Mitarbeiter anlegen';
    document.getElementById('em-name').value='';
    document.getElementById('em-kuerzel').value='';
    document.getElementById('em-color').value='#22d4a4';
    document.getElementById('em-display-name').value='';
    document.getElementById('em-email').value='';
    document.getElementById('em-phone').value='';
    document.getElementById('em-status').value='aktiv';
    document.getElementById('em-soll').value='';
    document.getElementById('em-soll-period').value='month';
    document.getElementById('em-notes').value='';
    document.getElementById('em-err').style.display='none';
    this._fillRoleSelect('');
    this.updateBadgePreview();
    document.getElementById('emp-modal-ov').classList.add('open');
  },
  openEdit(id) {
    const e=this.getById(id);
    if(!e) return;
    document.getElementById('em-id').value=e.id;
    document.getElementById('em-title').textContent='Mitarbeiter bearbeiten';
    document.getElementById('em-name').value=e.name||'';
    document.getElementById('em-kuerzel').value=e.kuerzel||'';
    document.getElementById('em-color').value=e.color||'#22d4a4';
    document.getElementById('em-display-name').value=e.display_name||'';
    document.getElementById('em-email').value=e.email||'';
    document.getElementById('em-phone').value=e.phone||'';
    document.getElementById('em-status').value=e.status||'aktiv';
    document.getElementById('em-soll').value=e.soll_stunden||'';
    document.getElementById('em-soll-period').value=e.soll_period||'month';
    document.getElementById('em-notes').value=e.notes||'';
    document.getElementById('em-err').style.display='none';
    this._fillRoleSelect(e.default_role||'');
    this.updateBadgePreview();
    document.getElementById('emp-modal-ov').classList.add('open');
  },
  closeModal() { document.getElementById('emp-modal-ov').classList.remove('open'); },

  _fillRoleSelect(current) {
    const sel=document.getElementById('em-role');
    // Nur Rollen anzeigen die im Scope liegen (leer = alle)
    const visibleRoles=Config.data.employeeRoles.filter(r=>isInStaffScope(r)||can(PERM.STAFF_EDIT_ALL_CATEGORIES));
    sel.innerHTML=visibleRoles.map(r=>`<option value="${_esc(r)}" ${r===current?'selected':''}>${_esc(r)}</option>`).join('');
    // Aktuelle Rolle immer anzeigen, auch wenn außerhalb Scope (beim Bearbeiten)
    if(current && !visibleRoles.includes(current)) {
      sel.innerHTML+=`<option value="${_esc(current)}" selected>${_esc(current)} (außerh. Scope)</option>`;
    }
  },

  autoKuerzel() {
    const name=document.getElementById('em-name').value.trim();
    const kEl=document.getElementById('em-kuerzel');
    if(!kEl.value) {
      const parts=name.split(/\s+/).filter(Boolean);
      let k='';
      if(parts.length>=2) k=(parts[0][0]+(parts[parts.length-1][0]||'')).toUpperCase();
      else if(parts.length===1) k=parts[0].slice(0,2).toUpperCase();
      kEl.value=k;
    }
    const dnEl=document.getElementById('em-display-name');
    if(dnEl&&!dnEl.value) dnEl.value=name.split(/\s+/)[0]||'';
    this.updateBadgePreview();
  },

  updateBadgePreview() {
    const k=document.getElementById('em-kuerzel')?.value||'?';
    const c=document.getElementById('em-color')?.value||'#22d4a4';
    const prev=document.getElementById('em-badge-prev');
    if(prev){prev.textContent=k;prev.style.background=c;prev.style.color=_contrastColor(c);}
  },

  async saveModal() {
    const id=document.getElementById('em-id').value;
    const name=document.getElementById('em-name').value.trim();
    const errEl=document.getElementById('em-err');
    errEl.style.display='none';
    if(!name){errEl.textContent='Name ist Pflichtfeld.';errEl.style.display='';return;}
    const selectedRole=document.getElementById('em-role').value||null;
    if(!isInStaffScope(selectedRole||'Thekenkraft')&&!can(PERM.STAFF_EDIT_ALL_CATEGORIES)){
      errEl.textContent='Diese Mitarbeiterkategorie liegt außerhalb deines Dienstplan-Scopes.';
      errEl.style.display='';return;
    }
    const payload={
      name,
      kuerzel: document.getElementById('em-kuerzel').value.trim().toUpperCase()||name.slice(0,2).toUpperCase(),
      color: document.getElementById('em-color').value||'#22d4a4',
      display_name: document.getElementById('em-display-name').value.trim()||name.split(/\s+/)[0]||name,
      email: document.getElementById('em-email').value.trim()||null,
      phone: document.getElementById('em-phone').value.trim()||null,
      default_role: document.getElementById('em-role').value||null,
      status: document.getElementById('em-status').value||'aktiv',
      soll_stunden: Number(document.getElementById('em-soll').value)||0,
      soll_period: document.getElementById('em-soll-period').value||'month',
      notes: document.getElementById('em-notes').value.trim()||null,
    };
    try {
      if(id) {
        await this.update(id, payload);
        this._selected=id;
      } else {
        const emp=await this.create(payload);
        this._selected=emp.id;
      }
      this.closeModal();
      this.renderList();
      const emp=this.getById(this._selected);
      if(emp) {
        const shifts=await Shifts.loadForEmployee(emp.id);
        document.getElementById('emp-main').innerHTML=this._detailHTML(emp,shifts);
        this._initHoursFilter(emp,shifts);
      }
    } catch(e) {
      errEl.textContent='Fehler: '+e.message;
      errEl.style.display='';
    }
  },

  /* ── AUTOCOMPLETE ─── */
  _acTarget: null,

  autocomplete(e, input) {
    const q=input.value.toLowerCase().trim();
    const ac=document.getElementById('emp-ac');
    if(!q || this._rows.length===0){ac.classList.remove('open');return;}
    const matches=this._rows.filter(emp=>emp.status!=='ausgeschieden'&&emp.name.toLowerCase().includes(q)).slice(0,8);
    if(!matches.length){ac.classList.remove('open');return;}
    const rect=input.getBoundingClientRect();
    ac.style.left=rect.left+'px';
    ac.style.top=(rect.bottom+4)+'px';
    ac.style.width=Math.max(rect.width,200)+'px';
    this._acTarget=input;
    ac.innerHTML=matches.map(emp=>{
      const bg=emp.color||'#22d4a4';
      const fg=_contrastColor(bg);
      return `<div class="emp-ac-item" onmousedown="Employees.selectFromAC('${emp.id}','${_esc(emp.name).replace(/'/g,"\\'")}')">
        <span class="emp-badge" style="background:${bg};color:${fg}">${emp.kuerzel||'?'}</span>
        <span>${_esc(emp.name)}</span>
        <span style="color:var(--txm);font-size:.72rem;margin-left:auto">${_esc(emp.default_role||'')}</span>
      </div>`;
    }).join('');
    ac.classList.add('open');
  },

  selectFromAC(empId, name) {
    const input=this._acTarget;
    if(!input) return;
    input.value=name;
    const hiddenId=input.dataset.empidTarget;
    if(hiddenId) {
      const h=document.getElementById(hiddenId);
      if(h) h.value=empId;
    }
    document.getElementById('emp-ac').classList.remove('open');
  },

  hideAC() {
    setTimeout(()=>document.getElementById('emp-ac')?.classList.remove('open'),150);
  },
};

/* ============================================================
   MEIN PROFIL
   ============================================================ */
const Profile = {
  _empId: null,

  async open() {
    const myEmp = currentUser ? Employees.getAll().find(e => e.profile_id === currentUser.id) : null;
    if (!myEmp) return;
    this._empId = myEmp.id;
    document.getElementById('profil-page').style.display = 'block';
    document.body.style.overflow = 'hidden';
    await this._render(myEmp);
  },

  close() {
    document.getElementById('profil-page').style.display = 'none';
    document.body.style.overflow = '';
  },

  async _render(emp) {
    const shifts = await Shifts.loadForEmployee(emp.id);
    this._shifts = shifts;
    this._emp = emp;
    const bg = emp.color || '#22d4a4';
    const fg = _contrastColor(bg);
    const now = new Date();
    const y = now.getFullYear(), m = String(now.getMonth()+1).padStart(2,'0');
    const istH = Shifts.sumHours(shifts, `${y}-${m}-01`, `${y}-${m}-31`);
    const period = emp.soll_period || 'month';
    const rawSoll = Number(emp.soll_stunden) || 0;
    const sollH = period === 'week' ? Math.round(rawSoll * 4.33 * 2) / 2 : rawSoll;
    const diff = istH - sollH;
    document.getElementById('profil-content').innerHTML = `
      <div class="emp-det-head">
        <span class="emp-badge lg" style="background:${bg};color:${fg}">${emp.kuerzel||'?'}</span>
        <div style="flex:1;min-width:0">
          <h3>${_esc(emp.name)}</h3>
          <span class="emp-status-pill ${emp.status||'aktiv'}">${emp.status||'aktiv'}</span>
        </div>
        <button class="btn btn-ghost prof-pdf-btn" onclick="Profile.printPDF()" title="Schichtbericht als PDF">&#128438; PDF</button>
      </div>
      ${emp.default_role ? `<div class="emp-det-meta"><span class="emp-det-meta-item">&#127970; ${_esc(emp.default_role)}</span></div>` : ''}

      <details class="profil-details-block" id="profil-kontakt-details">
        <summary class="profil-details-summary">Kontaktdaten</summary>
        <div class="profil-details-body">
          <div class="stg-subsec" style="margin-top:0;margin-bottom:10px">Eigene Kontaktdaten</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="fg">
              <label>E-Mail <span style="color:var(--txm);font-weight:400;font-size:.75rem">(nur Kontakt, kein Login)</span></label>
              <input class="fi" id="profil-email" type="email" value="${_esc(emp.email||'')}">
            </div>
            <div class="fg">
              <label>Telefon</label>
              <input class="fi" id="profil-phone" type="tel" value="${_esc(emp.phone||'')}">
            </div>
          </div>
          <div class="stg-subsec" style="margin-top:18px;margin-bottom:10px">Notfallkontakt</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="fg">
              <label>Name</label>
              <input class="fi" id="profil-emg-name" type="text" value="${_esc(emp.emergency_name||'')}" placeholder="z.B. Maria Muster">
            </div>
            <div class="fg">
              <label>Telefon</label>
              <input class="fi" id="profil-emg-phone" type="tel" value="${_esc(emp.emergency_phone||'')}">
            </div>
            <div class="fg">
              <label>E-Mail</label>
              <input class="fi" id="profil-emg-email" type="email" value="${_esc(emp.emergency_email||'')}">
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:14px">
            <button class="btn btn-ghost" onclick="Profile.saveContact('${emp.id}')">Speichern</button>
            <span id="profil-save-msg" style="font-size:.78rem;display:none;color:#22d4a4">&#10003; Gespeichert</span>
            <span id="profil-err-msg" style="font-size:.78rem;display:none;color:var(--miss)"></span>
          </div>
        </div>
      </details>

      <div class="emp-hours-card">
        <div class="emp-hours-head"><h4>&#9203; Stunden diesen Monat</h4></div>
        <div class="emp-hours-grid">${Employees._hoursGridHTML(istH, sollH, diff, 'month', period)}</div>
      </div>
      <div id="profil-shifts">${this._shiftsHTML(shifts, emp.id)}</div>`;
    // Desktop: open contact details by default
    if(window.innerWidth>=701){
      const d=document.getElementById('profil-kontakt-details');
      if(d)d.open=true;
    }
    // Render availability form if there's an active planning period
    this._renderAvailability(emp.id);
    // Render shift swaps
    ShiftSwap.renderProfileSwaps(emp.id, document.getElementById('profil-swaps'));
  },

  async _renderAvailability(empId) {
    const p = Planning.getActive();
    const cont = document.getElementById('profil-av-cont');
    if (!cont) return;
    if (!p || (p.status !== 'open' && p.status !== 'collecting')) { cont.innerHTML = ''; return; }
    await Availability.load(p.id, empId);
    Availability.renderForm(p.id, empId, cont);
  },

  printPDF() {
    if (!this._emp) return;
    Employees.exportPDF(this._emp.id);
  },

  _shiftsHTML(shifts, empId) {
    const today = lds(new Date());
    const future = shifts.filter(s => s.event_date >= today && !s.cancelled);
    const past = shifts.filter(s => s.event_date < today && !s.cancelled);
    const fmtH = h => h > 0 ? (h % 1 === 0 ? h + 'h' : h.toFixed(1) + 'h') : '0h';
    const plannedH = future.reduce((sum,s) => sum + Shifts.calcDuration(s.start_time, s.end_time), 0);
    const confirmedH = past.filter(s => s.confirmed).reduce((sum,s) => sum + Shifts.calcDuration(s.actual_start_time||s.start_time, s.actual_end_time||s.end_time), 0);
    const colgroup = `<colgroup><col style="width:110px"><col style="width:56px"><col><col style="width:130px"><col style="width:72px"><col style="width:72px"><col style="width:72px"><col style="width:120px"></colgroup>`;
    const thead = `<thead><tr><th>Datum</th><th>Ort</th><th>Veranstaltung</th><th>Rolle</th><th>Start</th><th>Ende</th><th>Dauer</th><th></th></tr></thead>`;
    const tbl = body => `<table class="emp-shift-tbl" style="width:100%;table-layout:fixed">${colgroup}${thead}${body}</table>`;
    const cards = rows => `<div class="shift-cards">${rows.map(s=>{
      const st=s.actual_start_time||s.start_time||'–';
      const et=s.actual_end_time||s.end_time||'–';
      const dur=Shifts.calcDuration(st,et);
      const durStr=dur>0?(dur%1===0?dur+'h':dur.toFixed(1)+'h'):'–';
      const ev=EVENTS.find(e=>e.id===s.event_id);
      const loc=ev?(LOCS[ev.location]?.short||''):'';
      return`<div class="shift-card">
        <div class="shift-card-top">
          <span class="shift-card-name">${_esc(s.event_name||'–')}</span>
          <span class="shift-card-loc">${_esc(loc)}</span>
        </div>
        <div class="shift-card-meta">
          <span class="shift-card-date">${_fmtDate(s.event_date)}</span>
          <span>${_esc(s.role||'–')}</span>
          <span>${st}–${et}</span>
          <span>${durStr}</span>
        </div>
        ${s.confirmed?`<div class="shift-card-badge"><span class="shift-confirmed-badge">&#10003; Bestätigt</span></div>`:''}
      </div>`;
    }).join('')}</div>`;
    let html = '';
    if (future.length) {
      html += `<div class="shift-section-hdr" style="margin-top:20px">&#128197; Geplante Schichten (${future.length})
        <span class="shift-planned-badge">${fmtH(plannedH)} geplant</span></div>
        ${tbl(`<tbody>${future.map(s => this._shiftRow(s, false)).join('')}</tbody>`)}
        ${cards(future)}`;
    }
    if (past.length) {
      html += `<div class="shift-section-hdr" style="margin-top:20px">&#128336; Vergangene Schichten (${past.length})
        <span class="shift-confirmed-badge">${fmtH(confirmedH)} best&auml;tigt</span></div>
        ${tbl(`<tbody>${past.map(s => this._shiftRow(s, true)).join('')}</tbody>`)}
        ${cards(past)}`;
    }
    if (!future.length && !past.length)
      html = '<div style="color:var(--txm);font-size:.82rem;padding:14px 0">Noch keine Schichten erfasst.</div>';
    return html;
  },

  _shiftRow(s, isPast) {
    const st = s.actual_start_time || s.start_time || '–';
    const et = s.actual_end_time || s.end_time || '–';
    const dur = Shifts.calcDuration(st, et);
    const durStr = dur > 0 ? (dur % 1 === 0 ? dur + 'h' : dur.toFixed(1) + 'h') : '–';
    const timeChanged = isPast && s.confirmed && (s.actual_start_time || s.actual_end_time);
    const statusCell = isPast && s.confirmed
      ? `<td><span class="shift-confirmed-badge">&#10003; Best&auml;tigt</span></td>`
      : `<td></td>`;
    const ev = EVENTS.find(e => e.id === s.event_id);
    const locShort = ev ? (LOCS[ev.location]?.short || '–') : '–';
    return `<tr class="${s.confirmed?'confirmed':''}">
      <td>${_fmtDate(s.event_date)}</td>
      <td style="font-size:.75rem;color:var(--txm);font-weight:600">${_esc(locShort)}</td>
      <td>${_esc(s.event_name||'–')}</td>
      <td>${_esc(s.role||'–')}</td>
      <td class="${timeChanged?'act-time':''}">${st}</td>
      <td class="${timeChanged?'act-time':''}">${et}</td>
      <td>${durStr}</td>
      ${statusCell}
    </tr>`;
  },

  _openConfirmShift(shiftId, origStart, origEnd, empId) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:400;display:flex;align-items:center;justify-content:center';
    modal.innerHTML = `<div style="background:var(--bg2);border-radius:16px;border:1px solid var(--bd);padding:28px;width:min(420px,94vw);box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <h3 style="font-family:var(--fh);font-size:1rem;font-weight:800;margin-bottom:18px">&#9998; Schicht anpassen &amp; best&auml;tigen</h3>
      <div class="frow">
        <div class="fg"><label>Startzeit</label><input class="fi" type="time" id="_pcs-start" value="${origStart}"></div>
        <div class="fg"><label>Endzeit</label><input class="fi" type="time" id="_pcs-end" value="${origEnd}"></div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
        <button class="btn btn-ghost" onclick="this.closest('[style*=fixed]').remove()">Abbrechen</button>
        <button class="btn btn-primary" onclick="Profile._confirmShift('${shiftId}',document.getElementById('_pcs-start').value,document.getElementById('_pcs-end').value,'${empId}',this.closest('[style*=fixed]'))">&#10003; Best&auml;tigen</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  },

  async _confirmShift(shiftId, actualStart, actualEnd, empId, overlay) {
    try {
      await Shifts.confirm(shiftId, actualStart, actualEnd);
      overlay?.remove();
      const emp = Employees.getById(empId);
      if (emp) await this._render(emp);
    } catch(e) { alert('Fehler: ' + e.message); }
  },

  async saveContact(empId) {
    const email = (document.getElementById('profil-email')?.value || '').trim();
    const phone = (document.getElementById('profil-phone')?.value || '').trim();
    const emergency_name  = (document.getElementById('profil-emg-name')?.value  || '').trim();
    const emergency_phone = (document.getElementById('profil-emg-phone')?.value || '').trim();
    const emergency_email = (document.getElementById('profil-emg-email')?.value || '').trim();
    const errEl = document.getElementById('profil-err-msg');
    const {data:{session}} = await db.auth.getSession();
    const token = session?.access_token;
    if (!token) { if (errEl) { errEl.textContent = 'Nicht angemeldet.'; errEl.style.display = 'inline'; } return; }
    const r = await fetch('/api/admin?action=updateEmployeeContact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ email, phone, emergency_name, emergency_phone, emergency_email }),
    });
    const data = await r.json();
    if (!r.ok) {
      if (errEl) { errEl.textContent = 'Fehler: ' + (data.error || 'Unbekannt'); errEl.style.display = 'inline'; }
      return;
    }
    if (errEl) errEl.style.display = 'none';
    await Employees.load();
    const msg = document.getElementById('profil-save-msg');
    if (msg) {
      msg.style.display = 'inline';
      setTimeout(() => { const m = document.getElementById('profil-save-msg'); if (m) m.style.display = 'none'; }, 2500);
    }
  },
};
