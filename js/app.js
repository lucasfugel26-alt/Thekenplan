/* --- Legacy-Shim: isAdmin() bleibt während Migration aktiv ---
   Neu: can(PERM.xxx) aus permissions.js verwenden.
   Dieser Shim gibt true wenn der User events.edit ODER die alte
   'admin'-Rolle hat, so dass bestehender Code weiter funktioniert. */
function isAdmin() {
  return can(PERM.EVENTS_EDIT) || currentProfile?.role === 'admin';
}

function applyAdminMode() {
  applyPermissionClasses();
}

/* --- Reset ----------------------------------------------- */
function resetToDefaults() {
  if (!confirm('Alle Änderungen verwerfen und Original-Plandaten wiederherstellen?')) return;
  EVENTS.length = 0;
  JSON.parse(DEFAULT_EVENTS).forEach(e => EVENTS.push(e));
  Cloud.push();
  App.render();
}
function lds(d){
  return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function t2m(t){const[h,m]=t.split(':').map(Number);return h*60+m}
function m2t(m){m=((m%1440)+1440)%1440;return`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`}
function barStart(pos,gastro,ov){
  if(ov)return ov;if(!gastro)return'\u2013';
  const b=t2m(gastro);
  if(pos<=2)return gastro;if(pos===3)return m2t(b+30);return m2t(b+60);
}
function monday(d){
  const r=new Date(d);const wd=r.getDay();
  r.setDate(r.getDate()+(wd===0?-6:1-wd));r.setHours(0,0,0,0);return r;
}
function isoWeek(d){
  const u=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const dn=u.getUTCDay()||7;u.setUTCDate(u.getUTCDate()+4-dn);
  const y1=new Date(Date.UTC(u.getUTCFullYear(),0,1));
  return Math.ceil(((u-y1)/86400000+1)/7);
}
function dFmt(ds){
  const d=new Date(ds+'T12:00:00');
  return`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.`;
}
function weekdayIdx(ds){const wd=new Date(ds+'T12:00:00').getDay();return wd===0?6:wd-1}
function allNames(ev){
  const s=new Set();if(ev.prodL)s.add(ev.prodL.name);
  ev.barStaff.filter(x=>!x.miss&&x.name).forEach(x=>s.add(x.name));return s;
}
function uid(){return'ev-'+Date.now()+'-'+Math.random().toString(36).slice(2,7)}

/* ============================================================
   STATE
   ============================================================ */
const S={
  monday:monday(new Date()),
  filterLoc:0,
  filterStaff:'',
  search:'',
  onlyMiss:false,
  viewMode:'week',   /* 'week' | 'calendar' */
  calYear:new Date().getFullYear(),
  calMonth:new Date().getMonth(),
  calDay:null,
};
/* Search filter state */
const SF={
  active:false,
  status:'all',     /* 'all'|'active'|'cancelled'|'relocated' */
  timeRange:'all',  /* 'all'|'upcoming'|'past' */
  hasNotes:false,
  dateFrom:'',
  dateTo:'',
};

/* ============================================================
   RENDERING
   ============================================================ */
function renderHeader(){
  // Highlight active view switcher buttons (desktop + ham menu)
  const isWeek=S.viewMode==='week';
  document.getElementById('vsw-week')?.classList.toggle('active',isWeek);
  document.getElementById('vsw-cal')?.classList.toggle('active',!isWeek);
  document.getElementById('ham-vsw-week')?.classList.toggle('active',isWeek);
  document.getElementById('ham-vsw-cal')?.classList.toggle('active',!isWeek);
  if(S.viewMode==='calendar'){
    document.getElementById('week-kw').textContent=`${MONS[S.calMonth]} ${S.calYear}`;
    document.getElementById('week-range').textContent='';
    return;
  }
  const mon=S.monday,sun=new Date(mon);sun.setDate(sun.getDate()+6);
  const fmt=d=>`${String(d.getDate()).padStart(2,'0')}. ${MONS[d.getMonth()]}`;
  document.getElementById('week-kw').textContent=`KW ${isoWeek(mon)} \xB7 ${mon.getFullYear()}`;
  document.getElementById('week-range').textContent=`${fmt(mon)} \u2013 ${fmt(sun)}`;
}

function renderLocBtns(){
  const row=document.getElementById('loc-row');
  if(!row)return;
  row.innerHTML=`<button class="loc-btn all${S.filterLoc===0?' active':''}" data-loc="0" onclick="App.setLoc(0)">Alle Locations</button>
    <div class="loc-sep"></div>`+
    Object.entries(LOCS).map(([id,loc])=>{
      const active=S.filterLoc===Number(id);
      return`<button class="loc-btn${active?' active':''}" data-loc="${id}" onclick="App.setLoc(${id})"
        style="${active?`background:${loc.color}18;border-color:${loc.color}50;color:${loc.color}`:''}">
        <span class="loc-dot" style="background:${loc.color}"></span>${loc.short}</button>`;
    }).join('')+
    (S.filterLoc!==0?`<button class="loc-btn" onclick="App.openLocInfo(${S.filterLoc})"
      style="color:var(--txm);margin-left:4px" title="Location-Infos anzeigen">&#8505; Location-Infos</button>`:'');
}

function renderSearch(){
  const grid=document.getElementById('week-grid');
  const todayS=lds(new Date());
  const q=S.search.toLowerCase();
  let results=EVENTS.filter(ev=>{
    if(q&&![ev.event,...allNames(ev)].join(' ').toLowerCase().includes(q))return false;
    if(S.filterLoc&&ev.location!==S.filterLoc)return false;
    if(S.filterStaff&&![...allNames(ev)].includes(S.filterStaff))return false;
    if(SF.status==='active'&&(ev.cancelled||ev.relocated))return false;
    if(SF.status==='cancelled'&&!ev.cancelled)return false;
    if(SF.status==='relocated'&&!ev.relocated)return false;
    if(SF.timeRange==='upcoming'&&ev.date<todayS)return false;
    if(SF.timeRange==='past'&&ev.date>=todayS)return false;
    if(SF.hasNotes&&!ev.notes)return false;
    if(SF.dateFrom&&ev.date<SF.dateFrom)return false;
    if(SF.dateTo&&ev.date>SF.dateTo)return false;
    return true;
  }).sort((a,b)=>a.date.localeCompare(b.date));

  const zeitChips=[['all','Alle'],['upcoming','Kommend'],['past','Vergangen']].map(([v,l])=>
    `<button class="sf-chip${SF.timeRange===v?' active':''}" onclick="SF.timeRange='${v}';renderGrid()">${l}</button>`).join('');
  const statusChips=[['all','Alle'],['active','Aktiv'],['cancelled','Abgesagt'],['relocated','Verlegt']].map(([v,l])=>
    `<button class="sf-chip${SF.status===v?' active':''}" onclick="SF.status='${v}';renderGrid()">${l}</button>`).join('');

  grid.innerHTML=`<div class="srch-panel">
    <div class="srch-top">
      <button class="srch-back" onclick="SF.active=false;SF.status='all';SF.timeRange='all';SF.hasNotes=false;SF.dateFrom='';SF.dateTo='';S.search='';document.getElementById('search-inp').value='';renderGrid()">&#8592; Wochenansicht</button>
      <span style="font-size:.8rem;color:var(--txd)">${q?`Suche: <strong style="color:var(--tx)">${_esc(q)}</strong>`:'Alle Veranstaltungen'}</span>
    </div>
    <div class="srch-filters">
      <span class="sf-label">Zeit:</span>${zeitChips}
      <div class="srch-divider"></div>
      <span class="sf-label">Status:</span>${statusChips}
      <div class="srch-divider"></div>
      <label style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:var(--txd);cursor:pointer">
        <input type="checkbox" ${SF.hasNotes?'checked':''} onchange="SF.hasNotes=this.checked;renderGrid()"> Mit Bemerkung
      </label>
      <div class="srch-divider"></div>
      <span class="sf-label">Von:</span>
      <input type="date" class="sf-date" value="${SF.dateFrom}" onchange="SF.dateFrom=this.value;renderGrid()">
      <span class="sf-label">Bis:</span>
      <input type="date" class="sf-date" value="${SF.dateTo}" onchange="SF.dateTo=this.value;renderGrid()">
    </div>
    <div class="srch-count">${results.length} Veranstaltung${results.length!==1?'en':''} gefunden</div>
    <div class="srch-results">${results.map(buildSearchRow).join('')}</div>
  </div>`;
}

function buildSearchRow(ev){
  const loc=LOCS[ev.location]||{};
  const locBadge=loc.short?`<span class="srch-loc" style="background:${loc.color}18;color:${loc.color};border:1px solid ${loc.color}30">${loc.short}</span>`:'';
  const statusBadge=ev.cancelled
    ?`<span class="srch-status" style="background:var(--missb);color:var(--miss)">Abgesagt</span>`
    :ev.relocated?`<span class="srch-status" style="background:var(--bg4);color:var(--txd)">Verlegt</span>`:'';
  const noteHtml=ev.notes?`<span class="srch-note">${_esc(ev.notes)}</span>`:'';
  const briefingDot=ev.staff_briefing?`<span style="font-size:.65rem;background:rgba(59,64,196,.2);color:#8890c8;border-radius:10px;padding:2px 8px;font-weight:600">Briefing</span>`:'';
  return`<div class="srch-row" onclick="App.openDet(EVENTS.find(e=>e.id==='${ev.id}'))">
    <div class="srch-date">${dFmt(ev.date)} <span style="color:var(--txm)">${DAYS[weekdayIdx(ev.date)]}</span></div>
    <div class="srch-name${ev.cancelled?' cancelled':''}">${_esc(ev.event)}</div>
    ${locBadge}${statusBadge}${briefingDot}${noteHtml}
  </div>`;
}

function getWeek(filtered=true){
  const monS=lds(S.monday),sunD=new Date(S.monday);
  sunD.setDate(sunD.getDate()+6);const sunS=lds(sunD);
  return EVENTS.filter(e=>{
    if(e.date<monS||e.date>sunS)return false;
    if(filtered){
      if(S.filterLoc&&e.location!==S.filterLoc)return false;
      if(S.onlyMiss&&!e.missingStaff)return false;
      if(S.filterStaff&&![...allNames(e)].includes(S.filterStaff))return false;
      if(S.search){
        const q=S.search.toLowerCase();
        if(![e.event,...[...allNames(e)]].join(' ').toLowerCase().includes(q))return false;
      }
    }
    return true;
  });
}

/* Konflikterkennung: Mitarbeiter am selben Tag in 2 Locations */
function detectConflicts(eventsForWeek){
  const conflicts=[]; /* [{name, date, ev1, ev2}] */
  const byDay={};
  eventsForWeek.filter(e=>!e.cancelled&&!e.relocated).forEach(ev=>{
    allNames(ev).forEach(name=>{
      if(!name)return;
      if(!byDay[ev.date])byDay[ev.date]={};
      if(!byDay[ev.date][name])byDay[ev.date][name]=[];
      byDay[ev.date][name].push(ev);
    });
  });
  Object.entries(byDay).forEach(([date,names])=>{
    Object.entries(names).forEach(([name,evs])=>{
      /* Konflikte nur wenn verschiedene Locations */
      const locs=new Set(evs.map(e=>e.location));
      if(locs.size>1){
        for(let i=0;i<evs.length-1;i++){
          conflicts.push({name,date,ev1:evs[i],ev2:evs[i+1]});
        }
      }
    });
  });
  return conflicts;
}

function renderConflictPanel(conflicts){
  let panel=document.getElementById('conflict-panel');
  if(!panel){
    panel=document.createElement('div');
    panel.id='conflict-panel';
    panel.style.cssText='margin-bottom:18px;background:rgba(255,64,64,.1);border:1px solid rgba(255,64,64,.3);border-radius:12px;padding:14px 16px;display:none';
    const grid=document.getElementById('week-grid');
    grid.parentNode.insertBefore(panel,grid);
  }
  if(!conflicts.length){panel.style.display='none';return;}
  panel.style.display='block';
  panel.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
    <span style="font-size:1rem">⚠</span>
    <span style="font-family:var(--fh);font-weight:700;color:var(--miss);font-size:.9rem">
      ${conflicts.length} Planungskonflikt${conflicts.length>1?'e':''}
    </span></div>`+
    conflicts.map(c=>`<div style="font-size:.78rem;color:var(--txd);margin-bottom:4px;padding:6px 10px;background:rgba(0,0,0,.2);border-radius:6px">
      ⚠ <strong style="color:var(--miss)">${c.name}</strong> – ${DAYS[weekdayIdx(c.date)]}
      ${dFmt(c.date)}: <em>${LOCS[c.ev1.location].short}</em> (${c.ev1.event})
      &amp; <em>${LOCS[c.ev2.location].short}</em> (${c.ev2.event})
    </div>`).join('');
}

function renderCalendar(){
  const grid=document.getElementById('week-grid');
  const todayS=lds(new Date());
  const yr=S.calYear,mo=S.calMonth;
  const firstDow=(new Date(yr,mo,1).getDay()+6)%7; // 0=Mon
  const daysInMo=new Date(yr,mo+1,0).getDate();
  const daysInPrev=new Date(yr,mo,0).getDate();
  const cells=[];
  for(let i=firstDow-1;i>=0;i--)cells.push({d:daysInPrev-i,m:mo-1,y:yr,other:true});
  for(let d=1;d<=daysInMo;d++)cells.push({d,m:mo,y:yr,other:false});
  while(cells.length%7!==0){
    const n=cells.length-daysInMo-firstDow+1;
    cells.push({d:n,m:mo+1,y:yr,other:true});
  }
  const evByDate={};
  EVENTS.forEach(ev=>{
    if(S.filterLoc&&ev.location!==S.filterLoc)return;
    if(S.onlyMiss&&!ev.missingStaff)return;
    if(S.filterStaff&&![...allNames(ev)].includes(S.filterStaff))return;
    if(!evByDate[ev.date])evByDate[ev.date]=[];
    evByDate[ev.date].push(ev);
  });
  const DOW=['Mo','Di','Mi','Do','Fr','Sa','So'];
  let html=`<div class="cal-wrap">
    <div class="cal-dow-row">${DOW.map(d=>`<div class="cal-dow">${d}</div>`).join('')}</div>
    <div class="cal-body">`;
  cells.forEach(cell=>{
    const fixM=(cell.m+12)%12;const fixY=cell.m<0?cell.y-1:cell.m>11?cell.y+1:cell.y;
    const ds=`${fixY}-${String(fixM+1).padStart(2,'0')}-${String(cell.d).padStart(2,'0')}`;
    const evs=evByDate[ds]||[];
    const cls=['cal-cell',cell.other?'cal-other':'',ds===todayS?'cal-today':'',ds===S.calDay?'cal-sel':''].filter(Boolean).join(' ');
    // Mobile: dots only
    const dots=evs.slice(0,4).map(ev=>{const c=(LOCS[ev.location]||{}).color||'var(--txm)';return`<span class="cal-dot" style="background:${c}"></span>`;}).join('');
    const more=evs.length>4?`<div class="cal-more">+${evs.length-4}</div>`:'';
    // Desktop: compact event rows (dot · short · name · time)
    const MAX_ROWS=3;
    const rows=evs.slice(0,MAX_ROWS).map(ev=>{
      const loc=LOCS[ev.location]||{};
      const c=loc.color||'var(--txm)';
      return`<div class="cal-ev-row${ev.cancelled?' cal-ev-cancelled':''}">
        <span class="cal-ev-dot" style="background:${c}"></span>
        <span class="cal-ev-loc" style="color:${c}">${loc.short||''}</span>
        <span class="cal-ev-name">${_esc(ev.event)}</span>
        <span class="cal-ev-time">${ev.startGastro||''}</span>
      </div>`;
    }).join('');
    const moreRows=evs.length>MAX_ROWS?`<div class="cal-ev-more">+${evs.length-MAX_ROWS}</div>`:'';
    html+=`<div class="${cls}" onclick="CalV.selectDay('${ds}')">
      <div class="cal-num">${cell.d}</div>
      <div class="cal-dots-mob">${evs.length?dots+more:''}</div>
      <div class="cal-rows-desk">${rows}${moreRows}</div>
    </div>`;
  });
  html+=`</div></div>`;

  grid.classList.add('cal-mode');

  const buildDayPanel=()=>{
    if(!S.calDay)return`<div class="cdp cdp-placeholder"><div class="cdp-empty">← Tag im Kalender auswählen</div></div>`;
    const dayEvs=(evByDate[S.calDay]||[]).sort((a,b)=>(a.startGastro||'').localeCompare(b.startGastro||''));
    const dObj=new Date(S.calDay+'T12:00');
    const lbl=`${DAYS[weekdayIdx(S.calDay)]}, ${dObj.getDate()}. ${MONS[dObj.getMonth()]}`;
    if(!dayEvs.length)return`<div class="cdp"><div class="cdp-title">${lbl}</div><div class="cdp-empty">Kein Event</div></div>`;
    return`<div class="cdp"><div class="cdp-title">${lbl}</div>${
      dayEvs.map(ev=>{
        const loc=LOCS[ev.location]||{};
        const expanded=CalV._open===ev.id;
        const names=[...allNames(ev)];
        let staffHtml;
        if(ev.barStaff&&ev.barStaff.length){
          const present=ev.barStaff.filter(s=>!s.miss);
          const missing=ev.barStaff.filter(s=>s.miss);
          staffHtml=present.map(s=>`<span class="cdp-staff-pill">${_esc(s.name)}</span>`).join('')
            +missing.map(s=>{
              const t=barStart(s.pos,ev.startGastro,s.ov);
              return`<span class="cdp-staff-pill miss">${t}</span>`;
            }).join('');
          if(!staffHtml)staffHtml='<span class="cdp-staff-pill empty">–</span>';
        } else {
          staffHtml=names.length?names.map(n=>`<span class="cdp-staff-pill">${_esc(n)}</span>`).join(''):'<span class="cdp-staff-pill empty">–</span>';
        }
        return`<div class="cdp-ev${expanded?' cdp-ev-open':''}" style="border-left-color:${loc.color||'var(--bd)'}">
          <div class="cdp-ev-hd" onclick="CalV.toggleEv('${ev.id}')">
            <div class="cdp-main">
              <div class="cdp-name${ev.cancelled?' cancelled':''}">${_esc(ev.event)}</div>
              <div class="cdp-meta">
                <span class="cdp-loc" style="background:${loc.color||'#888'}18;color:${loc.color||'var(--txd)'}">${loc.short||''}</span>
                <span class="cdp-staff-summary">${names.slice(0,3).join(' · ')||'–'}${names.length>3?' …':''}</span>
              </div>
            </div>
            <div class="cdp-ev-hd-r">
              <span class="cdp-time">${ev.startGastro||'–'}</span>
              <span class="cdp-chevron">${expanded?'▲':'▼'}</span>
            </div>
          </div>
          ${expanded?`<div class="cdp-body">
            <div class="cdp-row"><span class="cdp-lbl">Gastro</span><span>${ev.startGastro||'–'}</span></div>
            ${ev.schlussShow?`<div class="cdp-row"><span class="cdp-lbl">Schluss</span><span>${ev.schlussShow}</span></div>`:''}
            ${ev.belegungsende?`<div class="cdp-row"><span class="cdp-lbl">Belegungsende</span><span>${ev.belegungsende}</span></div>`:''}
            ${ev.prodL?`<div class="cdp-row"><span class="cdp-lbl">Produktion</span><span>${_esc(ev.prodL.name||'')}${ev.prodL.startTime?' · '+ev.prodL.startTime:''}</span></div>`:''}
            ${ev.cupType?`<div class="cdp-row"><span class="cdp-lbl">Becher</span><span>${_esc(ev.cupType)}</span></div>`:''}
            <div class="cdp-row cdp-row-staff"><span class="cdp-lbl">Besetzung</span><div class="cdp-staff-pills">${staffHtml}</div></div>
            ${ev.notes?`<div class="cdp-note-box">${_esc(ev.notes)}</div>`:''}
            ${ev.staff_briefing?`<div class="cdp-brief-box"><strong>Briefing:</strong> ${_esc(ev.staff_briefing)}</div>`:''}
            <div class="cdp-actions">
              ${can(PERM.EVENTS_EDIT)?`<button class="btn btn-ghost" style="font-size:.75rem;padding:5px 10px" onclick="App.editEventById('${ev.id}')">Bearbeiten</button>`:''}
              ${can(PERM.EVENTS_EDIT_BRIEFING)?`<button class="btn btn-ghost" style="font-size:.75rem;padding:5px 10px" onclick="App.editBriefing('${ev.id}')">Briefing</button>`:''}
              ${Chat.canAccess(ev)?`<button class="btn btn-primary" style="font-size:.75rem;padding:5px 10px;position:relative" onclick="App.openDet(EVENTS.find(e=>e.id==='${ev.id}'))">Details / Chat${Chat.hasUnread(ev.id)?'<span class="chat-unread-dot btn-dot" data-chat-dot="'+ev.id+'"></span>':''}</button>`:''}
            </div>
          </div>`:''}
        </div>`;
      }).join('')
    }</div>`;
  };

  // Desktop (≥1100px): side-by-side. Smaller: stacked.
  if(window.innerWidth>=1100){
    grid.innerHTML=`<div class="cal-sideby"><div class="cal-sideby-cal">${html}</div><div class="cal-sideby-panel" id="cal-panel">${buildDayPanel()}</div></div>`;
  } else {
    grid.innerHTML=html+(S.calDay?buildDayPanel():'');
  }
}

const CalV={
  _open:null,
  selectDay(ds){
    S.calDay=S.calDay===ds?null:ds;
    this._open=null;
    // On desktop, update only the panel without full re-render for performance
    if(window.innerWidth>=1100){
      const panel=document.getElementById('cal-panel');
      if(panel){
        // Re-render only if panel exists (side-by-side mode)
        renderGrid();return;
      }
    }
    renderGrid();
  },
  toggleEv(evId){
    this._open=this._open===evId?null:evId;
    renderGrid();
  },
};

function renderGrid(){
  const isSearchMode=S.search!==''||SF.active;
  const weekNav=document.getElementById('week-nav');
  if(weekNav)weekNav.style.display=isSearchMode?'none':'';
  if(isSearchMode){document.getElementById('week-grid').classList.remove('cal-mode');renderSearch();return;}
  if(S.viewMode==='calendar'){renderCalendar();return;}
  const grid=document.getElementById('week-grid');
  grid.classList.remove('cal-mode');
  const vis=getWeek(true),all=getWeek(false);
  const todayS=lds(new Date());
  grid.innerHTML='';

  /* Konflikte für diese Woche berechnen */
  const conflicts=detectConflicts(all);
  const conflictEventIds=new Set();
  conflicts.forEach(c=>{conflictEventIds.add(c.ev1.id);conflictEventIds.add(c.ev2.id);});
  renderConflictPanel(conflicts);

  let tot=0;

  DAYS.forEach((dayName,di)=>{
    const dayD=new Date(S.monday);dayD.setDate(dayD.getDate()+di);
    const dayS=lds(dayD);               /* <-- lokales Datum, kein UTC-Bug */
    const isToday=dayS===todayS;
    const dayV=vis.filter(e=>e.date===dayS)
                  .sort((a,b)=>(a.startGastro||'00:00').localeCompare(b.startGastro||'00:00'));
    const dayA=all.filter(e=>e.date===dayS);
    tot+=dayV.length;

    const col=document.createElement('div');
    col.className='day-col'+(isToday?' today':'');
    col.innerHTML=`<div class="day-head">
      <div class="dh-top">
        <span class="d-name">${dayName}</span>
        <span class="d-num">${dayD.getDate()}${isToday?'<span class="today-pill">Heute</span>':''}</span>
      </div>
      <div class="d-month">${MONS[dayD.getMonth()]} ${dayD.getFullYear()}</div>
      ${dayA.length?`<span class="d-cnt">${dayA.length} Event${dayA.length>1?'s':''}</span>`:''}
    </div><div class="day-body" id="db-${di}"></div>`;
    grid.appendChild(col);

    const body=col.querySelector(`#db-${di}`);
    if(!dayV.length){
      body.innerHTML=`<div class="day-empty">${dayA.length?'(gefiltert)':'\u2014'}</div>`;
      return;
    }
    dayV.forEach(ev=>body.appendChild(buildCard(ev,conflictEventIds)));
  });

  document.getElementById('cnt').textContent=tot?`${tot} Event${tot>1?'s':''} diese Woche`:'';
  const hasMiss=all.some(e=>e.missingStaff);
  document.getElementById('btn-miss').style.display=hasMiss?'':'none';
  const mobMiss=document.getElementById('mob-miss');
  if(mobMiss)mobMiss.style.display=(window.innerWidth<=700&&hasMiss)?'flex':'none';
}

function buildCard(ev, conflictIds=new Set()){
  const loc=LOCS[ev.location];
  const isConflict=conflictIds.has(ev.id);
  const card=document.createElement('div');
  let cls='ev-card';
  if(ev.missingStaff)cls+=' miss-card';
  const myEmpCard=Employees.getAll().find(e=>e.profile_id===currentUser?.id);
  const myNameCard=(myEmpCard?.name||currentProfile?.display_name||'').toLowerCase().trim();
  const isMyShift=!!myNameCard&&ev.barStaff?.some(s=>!s.miss&&s.name&&s.name.toLowerCase()===myNameCard);
  if(isMyShift)cls+=' my-shift';
  if(ev.cancelled)   cls+=' cancelled';
  if(ev.relocated)   cls+=' relocated';
  if(isConflict)     cls+=' conflict-card';
  card.className=cls;
  card.dataset.loc=ev.location;

  const tags=[];
  if(ev.cancelled)   tags.push(`<span class="tag tag-canc">Abgesagt</span>`);
  if(ev.relocated)   tags.push(`<span class="tag tag-reloc">\u2192 ${ev.relocated}</span>`);
  if(ev.missingStaff)tags.push(`<span class="tag tag-m">\u26A0 Bes.?</span>`);
  if(isConflict)     tags.push(`<span class="tag tag-conflict">\u26A0 Doppelt!</span>`);
  if(ev.kundenkarte) tags.push(`<span class="tag tag-${ev.kundenkarte.toLowerCase().slice(0,2)}">${ev.kundenkarte}</span>`);

  const rows=[];
  if(ev.prodL)rows.push(`<div class="srow"><span class="sb pl">PL</span>
    <span class="sname">${ev.prodL.name}</span>
    <span class="stime">${ev.prodL.startTime}</span></div>`);
  if(ev.prodL2)rows.push(`<div class="srow"><span class="sb pl">PL</span>
    <span class="sname">${ev.prodL2.name}</span>
    <span class="stime">${ev.prodL2.startTime}</span></div>`);
  const myName=currentProfile?.display_name?.toLowerCase();
  ev.barStaff.forEach(s=>{
    const statuses=s.statuses||(s.miss?['fehlt']:[]);
    const isFehlt=statuses.includes('fehlt');
    const t=isFehlt?'\u2013':barStart(s.pos,ev.startGastro,s.ov);
    const isMine=myName&&s.name&&s.name.toLowerCase()===myName&&!isFehlt;
    const stagHtml=statuses.map(sid=>{
      const sc=Config.data.staffStatuses.find(x=>x.id===sid);
      return sc?`<span class="stag" style="background:${sc.color}22;color:${sc.color};border:1px solid ${sc.color}44">${sc.label}</span>`:'';
    }).join('');
    rows.push(`<div class="srow${isMine?' mine':''}">
      <span class="sb bar${isFehlt?' mb':''}">${s.pos}</span>
      <span class="sname${isFehlt?' miss':''}">${isFehlt?'fehlt!':s.name}</span>
      ${stagHtml?`<span style="display:flex;gap:2px;flex-wrap:wrap">${stagHtml}</span>`:''}
      <span class="stime${isFehlt?' mt':''}">${t}</span></div>`);
  });

  if(!rows.length && !ev.cancelled && !ev.relocated)
    rows.push('<div class="srow-empty">Noch nicht zugeteilt</div>');

  const cf=CardFields.forRole();
  const bechertyp=ev.bechertyp||(ev.plastik?'plastik':null);
  const becherBanner=cf.becher&&!ev.cancelled&&!ev.relocated
    ?(bechertyp==='plastik'?`<div class="plastik-banner">&#129347; Plastikausschank</div>`
      :bechertyp==='glas'?`<div class="glas-banner">&#129380; Glasausschank</div>`:''):'';
  const besucherBadge=cf.besucher&&ev.besucherzahl
    ?`<div class="ev-besucher">&#128101; ${ev.besucherzahl} Besucher</div>`:'';

  card.style.borderLeftColor=loc?loc.color:'transparent';
  card.innerHTML=`
    <div class="card-acts">
      <button class="ca-btn" title="Bearbeiten" onclick="event.stopPropagation();App.editEventById('${ev.id}')">&#9998;</button>
      <button class="ca-btn ${ev.cancelled?'uncanc':'canc'}" title="${ev.cancelled?'Reaktivieren':'Absagen'}" onclick="event.stopPropagation();App.${ev.cancelled?'un':''}cancelEventById('${ev.id}')">${ev.cancelled?'&#8617;':'&#10007;'}</button>
      <button class="ca-btn del" title="L&ouml;schen" onclick="event.stopPropagation();App.deleteEventById('${ev.id}')">&#128465;</button>
    </div>
    <div class="ev-top-row">
      <span class="loc-badge" style="background:${loc?loc.color+'18':'var(--bg4)'};color:${loc?loc.color:'var(--txd)'};cursor:pointer" title="${loc?loc.name:''}" onclick="event.stopPropagation();App.openLocInfo(${ev.location})">${loc?loc.short:'?'}</span>
      ${tags.join('')}
    </div>
    ${becherBanner}
    <div class="ev-name">${ev.event}</div>
    ${besucherBadge}
    ${cf.zeiten&&((!ev.relocated&&!ev.cancelled)||ev.startGastro)?`<div class="ev-time">${ev.startGastro||'\u2013'} \u2013 ${ev.schlussShow||'\u2013'} <span>\xB7 Ende ${ev.belegungsende||'\u2013'}</span></div>`:''}
    <div class="slist">${rows.join('')}</div>
    ${cf.notizen&&ev.notes?`<div class="ev-note">${ev.notes}</div>`:''}
    ${ev.staff_briefing?`<button class="ev-briefing-btn" onclick="event.stopPropagation();App.openDet(EVENTS.find(e=>e.id==='${ev.id}'))">&#9432; Weitere Infos</button>`:''}
    ${Chat.canAccess(ev)?`<span class="chat-unread-dot" data-chat-dot="${ev.id}" style="display:${Chat.hasUnread(ev.id)?'inline-block':'none'}"></span>`:''}`;
  card.addEventListener('click',()=>App.openDet(ev));
  return card;
}

function updateStaffSel(){
  const sel=document.getElementById('filter-staff');
  const myShiftsBtn=document.getElementById('btn-my-shifts');
  const profilBtn=document.getElementById('profil-btn');
  const avBtn=document.getElementById('av-btn');
  const hamAv=document.getElementById('ham-av');
  const myEmp=currentUser?Employees.getAll().find(e=>e.profile_id===currentUser.id):null;

  // Non-privileged: hide the staff dropdown, show "Meine Schichten" toggle + Mein Profil button
  const hamProfil=document.getElementById('ham-profil');
  if(!can(PERM.SHIFTS_VIEW_ALL)){
    sel.style.display='none';
    if(myShiftsBtn) myShiftsBtn.style.display=myEmp?'':'none';
    if(profilBtn) profilBtn.style.display=myEmp?'':'none';
    if(hamProfil) hamProfil.style.display=myEmp?'':'none';
    const p=typeof Planning!=='undefined'?Planning.getActive():null;
    const avVisible=myEmp&&p&&(p.status==='open'||p.status==='collecting')?'':'none';
    if(avBtn) avBtn.style.display=avVisible;
    if(hamAv) hamAv.style.display=avVisible;
    return;
  }
  if(hamProfil) hamProfil.style.display='none';
  if(avBtn) avBtn.style.display='none';
  if(hamAv) hamAv.style.display='none';

  // Full access: full dropdown, no "Meine Schichten" or "Mein Profil" button needed
  if(myShiftsBtn) myShiftsBtn.style.display='none';
  if(profilBtn) profilBtn.style.display='none';
  sel.style.display='';
  const cur=sel.value;
  const empNames=Employees.getAll().map(e=>e.name).sort((a,b)=>a.localeCompare(b,'de'));
  sel.innerHTML=`<option value="">Alle Mitarbeiter</option>`+
    empNames.map(n=>`<option${n===cur?' selected':''}>${_esc(n)}</option>`).join('');
}


/* ============================================================
   DETAIL MODAL
   ============================================================ */
function openDet(ev){
  const loc=LOCS[ev.location];
  document.getElementById('m-bar').style.background=loc.color;
  document.getElementById('m-title').textContent=ev.event;
  document.getElementById('m-sub').textContent=
    `${dFmt(ev.date)} \xB7 ${DAYS[weekdayIdx(ev.date)]} \xB7 ${loc.name}`;
  const tags=[];
  if(ev.plastik)     tags.push(`<span class="m-tag p">\uD83E\uDDE3 Plastikausschank</span>`);
  if(ev.missingStaff)tags.push(`<span class="m-tag m">\u26A0 Besetzung unvollst\u00e4ndig</span>`);
  if(ev.kundenkarte) tags.push(`<span class="m-tag kk">${ev.kundenkarte}</span>`);
  document.getElementById('m-tags').innerHTML=tags.join('');
  document.getElementById('m-times').innerHTML=`
    <div class="m-tb"><label>Start Prod L</label><span>${ev.prodL?ev.prodL.startTime:'\u2013'}</span></div>
    <div class="m-tb"><label>Start Gastro</label><span>${ev.startGastro}</span></div>
    <div class="m-tb"><label>Schluss Show</label><span>${ev.schlussShow}</span></div>`;
  const rows=[];
  if(ev.prodL)rows.push(`<div class="m-srow"><span class="m-sbadge">Prod L</span>
    <span class="m-sname">${ev.prodL.name}</span><span class="m-stime">${ev.prodL.startTime}</span></div>`);
  if(ev.prodL2)rows.push(`<div class="m-srow"><span class="m-sbadge">Prod L</span>
    <span class="m-sname">${ev.prodL2.name}</span><span class="m-stime">${ev.prodL2.startTime}</span></div>`);
  ev.barStaff.forEach(s=>{
    const t=s.miss?'\u2013':barStart(s.pos,ev.startGastro,s.ov);
    rows.push(`<div class="m-srow${s.miss?' miss':''}"><span class="m-sbadge">Bar ${s.pos}</span>
      <span class="m-sname${s.miss?' miss':''}">${s.miss?'\u26A0 Noch nicht besetzt':s.name}</span>
      <span class="m-stime">${t}</span></div>`);
  });
  document.getElementById('m-slist').innerHTML=rows.join('');
  document.getElementById('m-note').innerHTML=ev.notes
    ?`<div class="m-sh">Bemerkungen</div><div class="m-note">${_esc(ev.notes)}</div>`:'';
  App._renderBriefing(ev);
  Chat.renderSection(ev);
  document.getElementById('det-ov').classList.add('open');
  document.body.style.overflow='hidden';
}


/* ============================================================
   APP CONTROLLER
   ============================================================ */
const App={
  _currentEvId:null,  /* ID des aktuell ge\u00f6ffneten Events im Detail-Modal */

  async init(){
    // Light is default; only switch to dark when explicitly saved as dark
    if(localStorage.getItem('thekenplan_theme')!=='dark'){
      document.body.classList.add('light');
    }
    const loggedIn=await Auth.init();
    if(!loggedIn){
      Auth.showScreen();
      Auth._checkUrlError();
    }
  },

  async _start(){
    loadLocal();
    applyAdminMode();
    document.getElementById('search-inp').addEventListener('input',e=>{S.search=e.target.value.trim();renderGrid();});
    document.getElementById('filter-staff').addEventListener('change',e=>{S.filterStaff=e.target.value;renderGrid();});
    /* Swipe to navigate weeks on mobile */
    let _tx=0;
    const grid=document.getElementById('week-grid');
    grid.addEventListener('touchstart',e=>{_tx=e.touches[0].clientX;},{passive:true});
    grid.addEventListener('touchend',e=>{
      const dx=e.changedTouches[0].clientX-_tx;
      if(Math.abs(dx)>60&&Math.abs(dx)<300){dx>0?App.prevWeek():App.nextWeek();}
    },{passive:true});
    /* Restore last view mode */
    const savedView=localStorage.getItem('thekenplan_viewmode');
    if(savedView==='calendar'){
      S.viewMode='calendar';
      S.calYear=new Date().getFullYear();
      S.calMonth=new Date().getMonth();
    }
    /* Locations + Config + Employees + Planning parallel laden */
    await Promise.all([LocationsMgr.load(), Config.load(), Employees.load(), Planning.load()]);
    if(EVENTS.length>0){this.render();}
    Cloud.fetch().then(ok=>{
      if(ok){App.render();Chat.loadUnreadState().then(()=>App.render());}
    });
    setupRealtime();
    Chat.subscribeNotifs();
  },

  async syncNow(){
    const ok = await Cloud.fetch();
    if(ok) App.render();
  },

  render(){renderHeader();renderLocBtns();updateStaffSel();renderGrid();Planning.renderBanner();},
  setView(mode){
    if(S.viewMode===mode)return;
    S.viewMode=mode;
    localStorage.setItem('thekenplan_viewmode',mode);
    if(mode==='calendar'){
      S.calYear=S.monday.getFullYear();
      S.calMonth=S.monday.getMonth();
      S.calDay=null;
      CalV._open=null;
    }
    this.render();
  },
  toggleView(){
    this.setView(S.viewMode==='week'?'calendar':'week');
  },
  calPrev(){
    S.calMonth--;
    if(S.calMonth<0){S.calMonth=11;S.calYear--;}
    S.calDay=null;
    renderGrid();renderHeader();
  },
  calNext(){
    S.calMonth++;
    if(S.calMonth>11){S.calMonth=0;S.calYear++;}
    S.calDay=null;
    renderGrid();renderHeader();
  },
  goToday(){
    if(S.viewMode==='calendar'){S.calYear=new Date().getFullYear();S.calMonth=new Date().getMonth();S.calDay=null;renderGrid();renderHeader();return;}
    S.monday=monday(new Date());this.render();
  },
  prevWeek(){
    if(S.viewMode==='calendar'){this.calPrev();return;}
    S.monday=new Date(S.monday);S.monday.setDate(S.monday.getDate()-7);this.render();
  },
  nextWeek(){
    if(S.viewMode==='calendar'){this.calNext();return;}
    S.monday=new Date(S.monday);S.monday.setDate(S.monday.getDate()+7);this.render();
  },
  prevMonth(){
    if(S.viewMode==='calendar'){this.calPrev();return;}
    const d=new Date(S.monday);d.setMonth(d.getMonth()-1);
    S.monday=monday(d);this.render();
  },
  nextMonth(){
    if(S.viewMode==='calendar'){this.calNext();return;}
    const d=new Date(S.monday);d.setMonth(d.getMonth()+1);
    S.monday=monday(d);this.render();
  },
  setLoc(l){S.filterLoc=l;S.filterStaff='';S.search='';S.onlyMiss=false;
    document.getElementById('search-inp').value='';this.render();},
  toggleMiss(){
    S.onlyMiss=!S.onlyMiss;
    document.getElementById('btn-miss').style.background=S.onlyMiss?'rgba(255,64,64,.3)':'';
    const mm=document.getElementById('mob-miss');
    if(mm)mm.classList.toggle('active',S.onlyMiss);
    renderGrid();},
  toggleMyShifts(){
    const myEmp=currentUser?Employees.getAll().find(e=>e.profile_id===currentUser.id):null;
    if(!myEmp) return;
    const btn=document.getElementById('btn-my-shifts');
    const active=S.filterStaff===myEmp.name;
    S.filterStaff=active?'':myEmp.name;
    if(btn){
      btn.style.background=active?'':'rgba(34,212,164,.18)';
      btn.style.borderColor=active?'':'rgba(34,212,164,.5)';
      btn.style.color=active?'':'#22d4a4';
    }
    renderGrid();
  },

  resetFilters(){S.filterLoc=0;S.search='';S.onlyMiss=false;
    SF.active=false;SF.status='all';SF.timeRange='all';SF.hasNotes=false;SF.dateFrom='';SF.dateTo='';
    document.getElementById('search-inp').value='';
    const mm=document.getElementById('mob-miss');if(mm)mm.classList.remove('active');
    if(can(PERM.SHIFTS_VIEW_ALL)){S.filterStaff='';document.getElementById('filter-staff').value='';}
    else{S.filterStaff='';const btn=document.getElementById('btn-my-shifts');if(btn){btn.style.background='';btn.style.borderColor='';btn.style.color='';}}
    renderGrid();renderLocBtns();},

  /* Detail-Modal */
  openDet(ev){
    this._currentEvId=ev.id;
    document.getElementById('m-del-confirm').style.display='none';
    openDet(ev);
  },
  closeDet(e){
    if(e&&e.target!==document.getElementById('det-ov'))return;
    document.getElementById('det-ov').classList.remove('open');
    document.body.style.overflow='';
    Chat.unsubscribe();},

  _fillLocSelect(selectedId){
    const sel=document.getElementById('f-loc');
    sel.innerHTML=Object.entries(LOCS).map(([id,l])=>`<option value="${id}">${l.short} · ${l.name}</option>`).join('');
    sel.value=selectedId;
  },

  /* Bearbeiten – aus Modal */
  editEvent(){
    const ev=EVENTS.find(e=>e.id===this._currentEvId);
    if(!ev)return;
    this.closeDet({target:document.getElementById('det-ov')});
    this._fillLocSelect(ev.location);
    Form.load(ev);
    document.getElementById('entry-ov').classList.add('open');
    document.body.style.overflow='hidden';
  },

  /* Bearbeiten – direkt von Karte (Hover-Button) */
  editEventById(id){
    const ev=EVENTS.find(e=>e.id===id);
    if(!ev)return;
    this._fillLocSelect(ev.location);
    Form.load(ev);
    document.getElementById('entry-ov').classList.add('open');
    document.body.style.overflow='hidden';
  },

  /* L\u00f6schen – Best\u00e4tigungsschritt anzeigen */
  confirmDelete(){
    document.getElementById('m-del-confirm').style.display='flex';
  },
  cancelDelete(){
    document.getElementById('m-del-confirm').style.display='none';
  },

  /* Löschen – aus Modal bestätigt */
  deleteEvent(){
    const idx=EVENTS.findIndex(e=>e.id===this._currentEvId);
    if(idx!==-1)EVENTS.splice(idx,1);
    Cloud.push();
    this.closeDet({target:document.getElementById('det-ov')});
    this.render();
  },

  /* Löschen – direkt von Karte (Hover-Button) */
  deleteEventById(id){
    if(!confirm('Dieses Event wirklich l\u00f6schen?'))return;
    const idx=EVENTS.findIndex(e=>e.id===id);
    if(idx!==-1)EVENTS.splice(idx,1);
    Cloud.push();
    db.from('shifts').delete().eq('event_id',id).then(()=>{});
    this.render();
  },

  cancelEventById(id){
    const ev=EVENTS.find(e=>e.id===id);
    if(!ev||!confirm(`"${ev.event}" absagen?\n\nAlle verkn\u00fcpften Schichten werden als abgesagt markiert.`))return;
    ev.cancelled=true;
    Cloud.push();
    db.from('shifts').update({cancelled:true}).eq('event_id',id).then(()=>{});
    this.render();
  },

  uncancelEventById(id){
    const ev=EVENTS.find(e=>e.id===id);
    if(!ev)return;
    ev.cancelled=false;
    Cloud.push();
    db.from('shifts').update({cancelled:false}).eq('event_id',id).then(()=>{});
    this.render();
  },

  /* Neues Event erfassen */
  openEntry(locId){
    const sel=document.getElementById('f-loc');
    sel.innerHTML=Object.entries(LOCS).map(([id,l])=>`<option value="${id}">${l.short} · ${l.name}</option>`).join('');
    Form.init(locId||Number(Object.keys(LOCS)[0])||1);
    document.getElementById('entry-ov').classList.add('open');
    document.body.style.overflow='hidden';},
  closeEntry(e){
    if(e&&e.target!==document.getElementById('entry-ov'))return;
    document.getElementById('entry-ov').classList.remove('open');
    document.body.style.overflow='';},



  toggleTheme(){
    const isLight=document.body.classList.toggle('light');
    localStorage.setItem('thekenplan_theme', isLight?'light':'dark');
  },

  printPDF(){
    window.print();
  },

  async changePassword(){
    const pw1 = document.getElementById('stg-pw1')?.value || '';
    const pw2 = document.getElementById('stg-pw2')?.value || '';
    const msg = document.getElementById('stg-pw-msg');
    const show = (txt, ok) => {
      if(!msg) return;
      msg.style.display='';
      msg.style.background=ok?'rgba(34,212,164,.15)':'rgba(255,80,80,.12)';
      msg.style.color=ok?'#22d4a4':'var(--miss)';
      msg.textContent=txt;
    };
    if(pw1.length < 6){ show('Mindestens 6 Zeichen erforderlich.', false); return; }
    if(pw1 !== pw2){ show('Passwörter stimmen nicht überein.', false); return; }
    show('Speichern…', true);
    const { error } = await db.auth.updateUser({ password: pw1 });
    // Re-fetch element in case DOM was touched during the await
    const msgEl = document.getElementById('stg-pw-msg');
    const showFresh = (txt, ok) => {
      if(!msgEl) return;
      msgEl.style.display=''; msgEl.style.background=ok?'rgba(34,212,164,.15)':'rgba(255,80,80,.12)';
      msgEl.style.color=ok?'#22d4a4':'var(--miss)'; msgEl.textContent=txt;
    };
    if(error){ showFresh('Fehler: '+error.message, false); return; }
    document.getElementById('stg-pw1').value='';
    document.getElementById('stg-pw2').value='';
    showFresh('✓ Passwort erfolgreich geändert!', true);
    setTimeout(()=>{ const el=document.getElementById('stg-pw-msg'); if(el) el.style.display='none'; }, 5000);
  },

  exportJSON(){
    const json=JSON.stringify(EVENTS,null,2);
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([json],{type:'application/json'}));
    a.download=`thekenplan_${lds(new Date())}.json`;
    a.click();URL.revokeObjectURL(a.href);
  },

  async forceSync(){
    /* Fügt neue eingebaute Events zur Cloud hinzu ohne bestehende zu löschen */
    const builtIn = JSON.parse(DEFAULT_EVENTS);
    const existingIds = new Set(EVENTS.map(e=>e.id));
    const newEvents = builtIn.filter(e=>!existingIds.has(e.id));
    if(newEvents.length === 0){
      alert('Alles bereits aktuell – keine neuen Events gefunden.');
      return;
    }
    newEvents.forEach(e=>EVENTS.push(e));
    const ok = await Cloud.push();
    if(ok){
      App.render();
      alert(`✅ ${newEvents.length} neue Events in die Cloud geladen.\n\nAlle Geräte sehen jetzt den aktuellen Stand nach einem Refresh.`);
    } else {
      alert('Fehler beim Sync. Bitte Verbindung prüfen.');
    }
  },

  /* ── Settings Modal ── */
  async openSettings(){
    applyPermissionClasses();
    document.getElementById('stg-page').style.display='block';
    document.body.style.overflow='hidden';
    const info=document.getElementById('stg-user-info');
    if(currentProfile&&info){
      const linkedEmp=Employees.getAll().find(e=>e.profile_id===currentUser?.id);
      const fullName=linkedEmp?.name||currentProfile.display_name||currentUser?.email;
      const roleName=currentProfile.role_name||currentProfile.role||'Mitarbeiter';
      info.innerHTML=`<div style="font-weight:600;font-size:.9rem;margin-bottom:3px">${_esc(fullName)}</div>
        <div style="color:var(--txd);font-size:.78rem">${currentUser?.email}&nbsp;·&nbsp;
          <span style="color:var(--accent)">${_esc(roleName)}</span></div>`;
    }
    renderStatusConfig();
    renderRolesConfig();
    Defaults.loadIntoSettings();
    CardFields.loadIntoSettings();
    const aiToggle = document.getElementById('stg-ai-toggle');
    if (aiToggle) aiToggle.checked = Config.data.aiEnabled;
    if(can(PERM.USERS_VIEW)){
      await this._loadUsersList();
    }
    if(can(PERM.PLANNING_MANAGE_RULES)){
      PlanningRules.renderEditor('stg-pr-editor');
    }
  },

   async _loadUsersList(){
    const tbl=document.getElementById('team-table');
    const cnt=document.getElementById('team-count');
    if(!tbl)return;
    tbl.innerHTML='<div style="color:var(--txm);font-size:.8rem;padding:18px 14px">Lade…</div>';
    const {data:profiles,error}=await db.from('profiles').select('*, roles(id, name, color)').order('display_name');
    if(error||!profiles){tbl.innerHTML='<div style="color:var(--miss);font-size:.8rem;padding:14px">Fehler</div>';return;}
    if(cnt)cnt.textContent=profiles.length+' '+(profiles.length===1?'Person':'Personen');
    const allEmps=Employees.getAll();
    // employees not yet linked to any profile
    const unlinkedEmps=allEmps.filter(e=>!e.profile_id);
    tbl.innerHTML=profiles.map(p=>{
      const linkedEmp=allEmps.find(e=>e.profile_id===p.id);
      const isSelf=p.id===currentProfile?.id;
      const empCol=linkedEmp
        ?`<button class="btn btn-ghost" style="font-size:.75rem;padding:4px 10px" onclick="Employees.select('${linkedEmp.id}');App.showTeamTab('emp')">&#128101; ${_esc(linkedEmp.name)}</button>`
        :`<select onchange="App.linkUserToEmployee('${p.id}',this.value)" style="font-size:.75rem;padding:4px 8px;border-radius:6px;border:1px solid var(--bd);background:var(--bg2);color:var(--tx);max-width:180px">
            <option value="">— zuweisen…</option>
            ${unlinkedEmps.map(e=>`<option value="${e.id}">${_esc(e.name)}</option>`).join('')}
          </select>`;
      return `<div class="team-row" style="grid-template-columns:1fr 140px 1fr 180px">
        <div class="team-name">${_esc(p.display_name)}</div>
        <div><span class="role-pill" style="background:${(p.roles?.color||'#6b7280')}22;color:${p.roles?.color||'#6b7280'};border:1px solid ${(p.roles?.color||'#6b7280')}44">${_esc(p.roles?.name||p.role||'Mitarbeiter')}</span></div>
        <div>${empCol}</div>
        <div class="team-acts">
          ${!isSelf?`
            ${can(PERM.ROLES_ASSIGN)?`<button class="btn btn-ghost" style="font-size:.75rem;padding:5px 11px;white-space:nowrap"
              onclick="RolesMgr.openAssign('${p.id}','${p.roles?.id||p.role_id||''}')">Rolle ändern</button>`:''}
            ${can(PERM.USERS_DELETE)?`<button class="btn btn-ghost" style="font-size:.75rem;padding:5px 9px;color:var(--miss);border-color:rgba(255,80,80,.3)"
              onclick="App.deleteUser('${p.id}','${p.display_name}')" title="Löschen">&#128465;</button>`:''}
          `:'<span style="font-size:.75rem;color:var(--txm)">Du</span>'}
        </div>
      </div>`;
    }).join('');
  },

  async linkUserToEmployee(profileId, empId){
    if(!empId)return;
    const {error}=await db.from('employees').update({profile_id:profileId}).eq('id',empId);
    if(error){alert('Fehler: '+error.message);return;}
    await Employees.load();
    await this._loadUsersList();
  },

  showTeamTab(tab){
    Employees.showTab(tab);
    if(tab==='acc'){
      RolesMgr.load().then(()=>this._loadUsersList());
      // Activate the users sub-tab by default when switching to Zugänge
      this.showAccSubTab('users');
    }
  },

  showAccSubTab(sub){
    const tabs = ['users','roles'];
    tabs.forEach(t=>{
      const btn = document.getElementById('asub-'+t);
      const content = document.getElementById('asub-content-'+t);
      if(btn) btn.classList.toggle('active', t===sub);
      if(content) content.style.display = t===sub ? '' : 'none';
    });
    if(sub==='roles') RolesMgr.renderSettingsSection('acc-roles-section');
  },

  async openTeam(){
    document.getElementById('team-ov').classList.add('open');
    document.body.style.overflow='hidden';
    Employees.showTab('emp');
    await Employees.load();
    Employees.renderList();
  },

  closeTeam(){
    document.getElementById('team-ov').classList.remove('open');
    document.body.style.overflow='';
  },

  async toggleUserRole(userId, currentRole) {
    // Legacy-Methode – wird von RolesMgr.openAssign() abgelöst
    const newRole = currentRole === 'admin' ? 'viewer' : 'admin';
    const { error } = await db.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) { alert('Fehler: ' + error.message); return; }
    await this._loadUsersList();
  },

  async deleteUser(userId,displayName){
    if(!confirm(`"${displayName}" wirklich löschen?`))return;
    const {data:{session}}=await db.auth.getSession();
    const token=session?.access_token;
    if(!token){alert('Nicht angemeldet.');return;}
    const r=await fetch('/api/admin?action=deleteUser',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({userId})
    });
    const data=await r.json();
    if(!r.ok){alert('Fehler: '+(data.error||'Unbekannt'));return;}
    await this._loadUsersList();
  },

  closeSettings(){
    document.getElementById('stg-page').style.display='none';
    document.body.style.overflow='';
  },

  async createEmployeeAccess(empId) {
    try {
      const emp=Employees.getById(empId);
      if(!emp?.email){alert('Bitte zuerst eine E-Mail-Adresse hinterlegen.');return;}
      if(emp.profile_id){alert('Dieser Mitarbeiter hat bereits einen Zugang.');return;}
      if(!confirm(`Zugang für ${emp.name} (${emp.email}) erstellen?\n\nEin Einladungslink wird generiert.`))return;
      const token=await this._getToken();
      if(!token){alert('Nicht angemeldet.');return;}
      const r=await fetch('/api/admin?action=inviteUser',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
        body:JSON.stringify({email:emp.email,display_name:emp.display_name||emp.name,redirect_to:window.location.origin})
      });
      let data;
      try{ data=await r.json(); }catch(e){ alert('Antwort konnte nicht gelesen werden: '+e.message); return; }
      if(!r.ok){alert('Fehler ('+r.status+'): '+(data?.error||JSON.stringify(data)));return;}
      await Employees.update(empId,{profile_id:data.id});
      const shifts=await Shifts.loadForEmployee(empId);
      const updated=Employees.getById(empId);
      if(updated) document.getElementById('emp-main').innerHTML=Employees._detailHTML(updated,shifts);
      this._showCredentialsModal(
        'Zugang erstellt',
        `Zugangsdaten an ${emp.name} weiterschicken — Passwort nach dem ersten Login ändern.`,
        [{label:'E-Mail',value:emp.email},{label:'Temporäres Passwort',value:data.temp_password}]
      );
    } catch(e) {
      alert('Unerwarteter Fehler: '+e.message);
    }
  },

  async resetEmployeePassword(empId) {
    try {
      const emp=Employees.getById(empId);
      if(!emp?.email){alert('Keine E-Mail-Adresse hinterlegt.');return;}
      if(!confirm(`Passwort-Reset-Link für ${emp.name} generieren?`))return;
      const token=await this._getToken();
      if(!token){alert('Nicht angemeldet.');return;}
      const r=await fetch('/api/admin?action=resetLink',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
        body:JSON.stringify({email:emp.email,redirect_to:window.location.origin})
      });
      const data=await r.json();
      if(!r.ok){alert('Fehler ('+r.status+'): '+(data.error||JSON.stringify(data)));return;}
      this._showCredentialsModal(
        'Temporäres Passwort',
        `Neue Zugangsdaten an ${emp.name} weiterschicken:`,
        [{label:'E-Mail',value:emp.email},{label:'Temporäres Passwort',value:data.temp_password}]
      );
    } catch(e){
      alert('Unerwarteter Fehler: '+e.message);
    }
  },

  async _getToken(){
    const sess=await db.auth.getSession();
    return sess.data?.session?.access_token||null;
  },

  _showCredentialsModal(title, desc, fields){
    document.getElementById('link-modal-title').textContent=title;
    document.getElementById('link-modal-desc').textContent=desc;
    document.getElementById('link-modal-copied').style.display='none';
    document.getElementById('link-modal-fields').innerHTML=fields.map((f,i)=>`
      <div>
        <div style="font-size:.72rem;color:var(--txm);margin-bottom:4px">${f.label}</div>
        <div style="position:relative">
          <input id="lmf-${i}" type="text" readonly value="${f.value.replace(/"/g,'&quot;')}"
            style="width:100%;padding:9px 42px 9px 11px;border-radius:7px;border:1px solid var(--bd);background:var(--bg2);color:var(--tx);font-size:.82rem;box-sizing:border-box;cursor:text;font-family:monospace"
            onclick="this.select()">
          <button onclick="App._copyField('lmf-${i}')" title="Kopieren"
            style="position:absolute;right:5px;top:50%;transform:translateY(-50%);background:var(--acc);border:none;border-radius:5px;padding:4px 8px;cursor:pointer;font-size:.8rem">&#128203;</button>
        </div>
      </div>`).join('');
    document.getElementById('link-modal-ov').style.display='flex';
  },

  _closeLinkModal(){
    document.getElementById('link-modal-ov').style.display='none';
  },

  _copyField(id){
    const val=document.getElementById(id).value;
    const copied=document.getElementById('link-modal-copied');
    try{
      const ta=document.createElement('textarea');
      ta.value=val;
      ta.style.cssText='position:fixed;top:-9999px;left:-9999px;opacity:0';
      document.body.appendChild(ta);ta.focus();ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }catch(e){ navigator.clipboard?.writeText(val).catch(()=>{}); }
    copied.style.display='';
    setTimeout(()=>copied.style.display='none',2000);
  },

};

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    const plannerPage=document.getElementById('planner-page');
    if(plannerPage&&plannerPage.style.display!=='none'){Planner.close();return;}
    const linkModal=document.getElementById('link-modal-ov');
    if(linkModal&&linkModal.style.display==='flex'){App._closeLinkModal();return;}
    const empModal=document.getElementById('emp-modal-ov');
    if(empModal&&empModal.classList.contains('open')){Employees.closeModal();return;}
    const teamOv=document.getElementById('team-ov');
    if(teamOv&&teamOv.classList.contains('open')){App.closeTeam();return;}
    const profilPage=document.getElementById('profil-page');
    if(profilPage&&profilPage.style.display!=='none'){Profile.close();return;}
    const stgPage=document.getElementById('stg-page');
    if(stgPage&&stgPage.style.display!=='none'){App.closeSettings();return;}
    const infoOv=document.getElementById('loc-info-ov');
    if(infoOv&&infoOv.classList.contains('open')){App.closeLocInfo();return;}
    document.querySelectorAll('.ov.open,.loc-info-ov.open').forEach(o=>o.classList.remove('open'));
    document.body.style.overflow='';
  }
  if(e.key==='ArrowLeft' &&!document.querySelector('.ov.open'))App.prevWeek();
  if(e.key==='ArrowRight'&&!document.querySelector('.ov.open'))App.nextWeek();
});

/* ============================================================
   HAM MENU
   ============================================================ */
const Ham={
  toggle(){
    const menu=document.getElementById('ham-menu');
    const ov=document.getElementById('ham-overlay');
    const open=menu.classList.toggle('open');
    ov.classList.toggle('open',open);
    document.body.style.overflow=open?'hidden':'';
    if(open) menu.scrollTop=0; /* Bug 11: immer von oben starten */
  },
  close(){
    document.getElementById('ham-menu').classList.remove('open');
    document.getElementById('ham-overlay').classList.remove('open');
    document.body.style.overflow='';
  },
};

/* ── Locations Panel Methoden im App-Controller ── */
function renderStatusConfig() {
  const el = document.getElementById('stg-statuses');
  if (!el) return;
  el.innerHTML = Config.data.staffStatuses.map(s =>
    `<div class="stg-status-card">
      <div class="stg-status-card-top">
        <span class="stg-status-dot" style="background:${s.color}"></span>
        <span class="stg-status-label">${s.label}</span>
        <button class="stg-status-del" onclick="Config.removeStatus('${s.id}')" title="Entfernen">&#10005;</button>
      </div>
      <div style="height:4px;border-radius:2px;background:${s.color}33;overflow:hidden">
        <div style="height:100%;width:100%;background:${s.color};opacity:.7;border-radius:2px"></div>
      </div>
    </div>`
  ).join('') || '<div style="color:var(--txm);font-size:.8rem;padding:8px 0;grid-column:1/-1">Keine Statusoptionen</div>';
}

function renderRolesConfig() {
  const el=document.getElementById('stg-roles');
  if(!el)return;
  const roles=Config.data.employeeRoles;
  el.innerHTML=roles.length===0
    ?'<div style="color:var(--txm);font-size:.8rem;padding:8px 0">Keine Rollen definiert</div>'
    :roles.map((r,i)=>`
      <div class="stg-role-row">
        <span class="stg-role-name">${_esc(r)}</span>
        <div class="stg-role-acts">
          <button class="btn btn-ghost" onclick="Config.moveRole(${i},-1)" ${i===0?'disabled':''}>&#8593;</button>
          <button class="btn btn-ghost" onclick="Config.moveRole(${i},1)" ${i===roles.length-1?'disabled':''}>&#8595;</button>
          <button class="btn btn-ghost" style="color:var(--miss)" onclick="Config.removeRole(${i})">&#10005;</button>
        </div>
      </div>`).join('');
}

const LOC_PRESET_COLORS = ['#f5a623','#22d4a4','#e05aff','#ff6b6b','#4a9eff','#ff9f40','#a259ff','#00c875','#ff5c8a','#5ce1e6','#ffde59','#c9cbff'];

function _buildColorPresets(containerId, inputId) {
  const wrap = document.getElementById(containerId);
  const inp  = document.getElementById(inputId);
  if (!wrap || !inp) return;
  wrap.innerHTML = LOC_PRESET_COLORS.map(c =>
    `<span class="cp-swatch" style="background:${c}" title="${c}" onclick="(function(){document.getElementById('${inputId}').value='${c}';document.querySelectorAll('#${containerId} .cp-swatch').forEach(s=>s.classList.remove('active'));this.classList.add('active')}).call(this)"></span>`
  ).join('');
  inp.addEventListener('input', () => {
    wrap.querySelectorAll('.cp-swatch').forEach(s => s.classList.toggle('active', s.title === inp.value));
  });
}

async function resizeImageToBase64(file, maxW=420, quality=0.82) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.src = url;
  });
}

App.openLocations = async function() {
  document.getElementById('loc-ov').classList.add('open');
  document.body.style.overflow = 'hidden';
  _buildColorPresets('nl-color-presets', 'nl-color');
  renderLocationList();
};

App.closeLocations = function(e) {
  if (e && e.target !== document.getElementById('loc-ov')) return;
  document.getElementById('loc-ov').classList.remove('open');
  document.body.style.overflow = '';
};

function renderLocationList() {
  const list = document.getElementById('loc-list');
  if (!list) return;
  list.innerHTML = Object.entries(LOCS).map(([id, loc]) =>
    `<div class="loc-item">
      <div class="loc-dot-big" style="background:${loc.color}"></div>
      ${loc.image ? `<img src="${loc.image}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0">` : ''}
      <div class="loc-item-info">
        <div class="loc-item-name">${loc.name}</div>
        <div class="loc-item-short">Kürzel: ${loc.short} &middot; ID: ${id}${loc.address ? ` &middot; ${loc.address}` : ''}</div>
      </div>
      <button class="btn btn-ghost" style="font-size:.75rem;padding:5px 10px"
        onclick="App.openLocEdit(${id})">✎ Bearbeiten</button>
      <button class="btn btn-ghost" style="font-size:.75rem;padding:5px 9px;color:var(--miss);border-color:rgba(255,80,80,.3)"
        onclick="App.deleteLocation(${id})">&#128465; Löschen</button>
    </div>`
  ).join('') || '<div style="color:var(--txm);padding:12px">Keine Locations</div>';
}

App.createLocation = async function() {
  const name = document.getElementById('nl-name').value.trim();
  const short = document.getElementById('nl-short').value.trim().toUpperCase();
  const color = document.getElementById('nl-color').value;
  const err = document.getElementById('nl-err');
  err.style.display = 'none';
  if (!name || !short) { err.textContent = 'Name und Kürzel sind Pflicht.'; err.style.display = ''; return; }
  try {
    const loc = await LocationsMgr.create(name, short, color);
    LOCS[loc.id] = {id:loc.id, name, short, color, image:null, address:null, maps_url:null, contact_name:null, contact_phone:null, capacity:null, notes:null};
    document.getElementById('nl-name').value = '';
    document.getElementById('nl-short').value = '';
    renderLocationList();
    App.render();
  } catch(e) { err.textContent = 'Fehler: ' + e.message; err.style.display = ''; }
};

App.openLocEdit = function(id) {
  const loc = LOCS[id];
  if (!loc) return;
  document.getElementById('loc-ov').classList.remove('open');
  document.getElementById('le-id').value = id;
  document.getElementById('le-name').value = loc.name || '';
  document.getElementById('le-short').value = loc.short || '';
  document.getElementById('le-color').value = loc.color || '#f5a623';
  document.getElementById('le-address').value = loc.address || '';
  document.getElementById('le-maps').value = loc.maps_url || '';
  document.getElementById('le-contact-name').value = loc.contact_name || '';
  document.getElementById('le-contact-phone').value = loc.contact_phone || '';
  document.getElementById('le-capacity').value = loc.capacity || '';
  document.getElementById('le-notes').value = loc.notes || '';
  const imgArea = document.getElementById('le-img-area');
  const clearBtn = document.getElementById('le-img-clear');
  if (loc.image) {
    imgArea.innerHTML = `<img src="${loc.image}">`;
    clearBtn.style.display = '';
  } else {
    imgArea.innerHTML = `<div class="loc-img-ph">\u{1f4f7}<br>Foto hinzufügen<br><span style="font-size:.65rem;color:var(--txm)">klicken oder tippen</span></div>`;
    clearBtn.style.display = 'none';
  }
  document.getElementById('le-img-file').value = '';
  document.getElementById('le-err').style.display = 'none';
  _buildColorPresets('le-color-presets', 'le-color');
  document.getElementById('loc-edit-ov').classList.add('open');
};

App.closeLocEdit = function(e) {
  if (e && e.target !== document.getElementById('loc-edit-ov')) return;
  document.getElementById('loc-edit-ov').classList.remove('open');
  document.getElementById('loc-ov').classList.add('open');
  renderLocationList();
};

App._handleLocImage = async function(file) {
  if (!file) return;
  const b64 = await resizeImageToBase64(file);
  const imgArea = document.getElementById('le-img-area');
  imgArea.innerHTML = `<img src="${b64}">`;
  imgArea._b64 = b64;
  document.getElementById('le-img-clear').style.display = '';
};

App._clearLocImage = function() {
  const imgArea = document.getElementById('le-img-area');
  imgArea.innerHTML = `<div class="loc-img-ph">\u{1f4f7}<br>Foto hinzufügen<br><span style="font-size:.65rem;color:var(--txm)">klicken oder tippen</span></div>`;
  imgArea._b64 = null;
  document.getElementById('le-img-clear').style.display = 'none';
  document.getElementById('le-img-file').value = '';
};

App.saveLocEdit = async function() {
  const id = Number(document.getElementById('le-id').value);
  const name = document.getElementById('le-name').value.trim();
  const short = document.getElementById('le-short').value.trim().toUpperCase();
  const color = document.getElementById('le-color').value;
  const err = document.getElementById('le-err');
  err.style.display = 'none';
  if (!name || !short) { err.textContent = 'Name und Kürzel sind Pflicht.'; err.style.display = ''; return; }
  const imgArea = document.getElementById('le-img-area');
  const currentLoc = LOCS[id] || {};
  const image = imgArea._b64 !== undefined ? imgArea._b64 : (imgArea.querySelector('img') ? currentLoc.image : null);
  const updates = {
    name, short, color, image,
    address:       document.getElementById('le-address').value.trim() || null,
    maps_url:      document.getElementById('le-maps').value.trim() || null,
    contact_name:  document.getElementById('le-contact-name').value.trim() || null,
    contact_phone: document.getElementById('le-contact-phone').value.trim() || null,
    capacity:      Number(document.getElementById('le-capacity').value) || null,
    notes:         document.getElementById('le-notes').value.trim() || null,
  };
  try {
    await LocationsMgr.update(id, updates);
    document.getElementById('loc-edit-ov').classList.remove('open');
    document.getElementById('loc-ov').classList.add('open');
    LOCS[id] = {...currentLoc, id, ...updates};
    renderLocationList();
    App.render();
  } catch(e) { err.textContent = 'Fehler: ' + e.message; err.style.display = ''; }
};

App.deleteLocation = function(id) {
  if (!confirm(`Location "${LOCS[id]?.name}" wirklich löschen? Events dieser Location bleiben erhalten.`)) return;
  LocationsMgr.remove(id).then(() => {
    delete LOCS[id];
    renderLocationList();
    App.render();
  }).catch(e => alert('Fehler: ' + e.message));
};

App.openLocInfo = function(locId) {
  const loc = LOCS[locId];
  if (!loc) return;
  const badge = document.getElementById('li-badge');
  badge.textContent = loc.short;
  badge.style.background = loc.color + '22';
  badge.style.color = loc.color;
  document.getElementById('li-name').textContent = loc.name;
  document.getElementById('li-sub').textContent = loc.address || '';
  const imgWrap = document.getElementById('li-img-wrap');
  const img = document.getElementById('li-img');
  if (loc.image) { img.src = loc.image; imgWrap.style.display = ''; }
  else imgWrap.style.display = 'none';
  const rows = [];
  if (loc.address) rows.push(`<div class="li-row"><span class="li-icon">&#128205;</span><div><div class="li-label">Adresse</div><div class="li-val">${loc.address}${loc.maps_url ? ` &nbsp;<a href="${loc.maps_url}" target="_blank" rel="noopener">&#128506; Karte</a>` : ''}</div></div></div>`);
  if (loc.contact_name || loc.contact_phone) rows.push(`<div class="li-row"><span class="li-icon">&#128222;</span><div><div class="li-label">Ansprechpartner</div><div class="li-val">${loc.contact_name || ''}${loc.contact_phone ? ` &nbsp;<a href="tel:${loc.contact_phone}">${loc.contact_phone}</a>` : ''}</div></div></div>`);
  if (loc.capacity) rows.push(`<div class="li-row"><span class="li-icon">&#128101;</span><div><div class="li-label">Kapazität</div><div class="li-val">max. ${loc.capacity} Besucher</div></div></div>`);
  if (loc.notes) rows.push(`<div class="li-row"><span class="li-icon">&#128221;</span><div><div class="li-label">Hinweise</div><div class="li-val" style="white-space:pre-wrap">${loc.notes}</div></div></div>`);
  const bodyHTML = rows.join('') || '<div style="color:var(--txm);font-size:.83rem;padding:4px 0">Noch keine Infos hinterlegt.</div>';
  const adminActions = can(PERM.SETTINGS_EDIT_LOCATIONS) ? `<div style="display:flex;gap:8px;margin-top:18px;padding-top:14px;border-top:1px solid var(--bd)">
    <button class="btn btn-ghost" style="flex:1" onclick="App.closeLocInfo();App.openLocations()">&#9998; Bearbeiten</button>
    <button class="btn btn-ghost" style="flex:1;color:var(--miss);border-color:rgba(255,80,80,.3)"
      onclick="if(confirm('Location &quot;${loc.name}&quot; wirklich löschen?')){App.closeLocInfo();LocationsMgr.remove(${locId})}">&#128465; L&ouml;schen</button>
  </div>` : '';
  document.getElementById('li-body').innerHTML = bodyHTML + adminActions;
  document.getElementById('loc-info-ov').classList.add('open');
};

App.closeLocInfo = function() {
  document.getElementById('loc-info-ov').classList.remove('open');
};

App._renderBriefing = function(ev) {
  const el = document.getElementById('m-briefing');
  if (!el) return;
  const becherMap = { plastik: '&#129379; Plastik', glas: '&#127866; Glas', unbekannt: '&#10067; Ungeklärt' };
  const becherTagClass = { plastik: 'p', glas: '', unbekannt: 'kk' };
  const bType = ev.bechertyp || 'unbekannt';
  let html = `<div class="m-sh" style="margin-top:14px">Briefing</div>
    <div class="m-briefing-facts">
      <span class="m-tag ${becherTagClass[bType]}">${becherMap[bType]||becherMap.unbekannt}</span>
      ${ev.besucherzahl ? `<span class="m-tag">&#128101; ca. ${ev.besucherzahl} Besucher</span>` : ''}
    </div>`;
  if (ev.staff_briefing) {
    html += `<div class="m-briefing-text important">${_esc(ev.staff_briefing).replace(/\n/g,'<br>')}</div>`;
  } else {
    html += `<div style="color:var(--txm);font-size:.8rem;font-style:italic;padding:6px 0">Kein Briefing-Text hinterlegt.</div>`;
  }
  if (can(PERM.EVENTS_EDIT_BRIEFING)) {
    html += `<button class="btn btn-ghost" style="font-size:.75rem;padding:4px 10px;margin-top:8px"
      onclick="App.editBriefing('${ev.id}')">&#9998; Briefing bearbeiten</button>`;
  }
  el.innerHTML = html;
};

App.editBriefing = function(evId) {
  const ev = EVENTS.find(e => e.id === evId);
  if (!ev) return;
  // If detail modal is open and m-briefing is visible, edit inline
  const detOv = document.getElementById('det-ov');
  const mbEl = document.getElementById('m-briefing');
  if (detOv && detOv.classList.contains('open') && mbEl) {
    mbEl.innerHTML = `<div class="m-sh" style="margin-top:14px">Briefing bearbeiten</div>
      <textarea class="fi" id="briefing-edit-text" rows="5"
        style="resize:vertical;font-size:.85rem;line-height:1.5"
        placeholder="Einlasssituation, Besonderheiten, Ansprechpartner, Abbau…">${_esc(ev.staff_briefing||'')}</textarea>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-primary" onclick="App.saveBriefing('${evId}')">Speichern</button>
        <button class="btn btn-ghost" onclick="App._renderBriefing(EVENTS.find(e=>e.id==='${evId}'))">Abbrechen</button>
      </div>`;
    document.getElementById('briefing-edit-text').focus();
    return;
  }
  // Standalone overlay (called from calendar panel)
  const ov = document.createElement('div');
  ov.id = 'briefing-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:400;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML = `<div style="background:var(--bg2);border-radius:16px;border:1px solid var(--bd);padding:24px;width:min(520px,96vw);box-shadow:0 20px 60px rgba(0,0,0,.4)">
    <div style="font-family:var(--fh);font-size:1rem;font-weight:800;margin-bottom:6px">Briefing – ${_esc(ev.event)}</div>
    <div style="font-size:.78rem;color:var(--txm);margin-bottom:14px">${ev.date||''}</div>
    <textarea class="fi" id="briefing-edit-text" rows="6"
      style="resize:vertical;font-size:.85rem;line-height:1.5;width:100%"
      placeholder="Einlasssituation, Besonderheiten, Ansprechpartner, Abbau…">${_esc(ev.staff_briefing||'')}</textarea>
    <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="document.getElementById('briefing-ov').remove()">Abbrechen</button>
      <button class="btn btn-primary" onclick="App.saveBriefing('${evId}',true)">Speichern</button>
    </div>
  </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  document.getElementById('briefing-edit-text').focus();
};

App.saveBriefing = async function(evId, fromOverlay=false) {
  const ev = EVENTS.find(e => e.id === evId);
  if (!ev) return;
  const text = document.getElementById('briefing-edit-text').value.trim();
  ev.staff_briefing = text || null;
  ev.staff_briefing_important = true; // always important
  await Cloud.push();
  if (fromOverlay) {
    const ov = document.getElementById('briefing-ov');
    if (ov) ov.remove();
    renderGrid(); // refresh calendar panel
  } else {
    App._renderBriefing(ev);
  }
};

App.init();
