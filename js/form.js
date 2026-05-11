/* ============================================================
   ENTRY FORM
   ============================================================ */
const Form={
  currentLoc:1,
  staffRows:0,
  mode:'create',   /* 'create' | 'edit' */
  editId:null,

  init(locId){
    this.mode='create'; this.editId=null;
    this.currentLoc=locId; this.staffRows=0;
    document.getElementById('entry-title').textContent='\uD83D\uDCCB Event erfassen';
    document.getElementById('f-loc').value=locId;
    document.getElementById('f-date').value='';
    document.getElementById('f-event').value='';
    document.getElementById('f-notes').value='';
    document.getElementById('f-kk').value='';
    document.getElementById('f-missstaff').checked=false;
    document.getElementById('f-pl-name').value='';
    document.getElementById('f-pl-time').value='';
    const plEmpId=document.getElementById('f-pl-empid');if(plEmpId)plEmpId.value='';
    document.getElementById('f-gastro').value='';
    document.getElementById('f-schluss').value='';
    document.getElementById('f-ende').value='';
    const einlass=document.getElementById('f-einlass');if(einlass)einlass.value='';
    const bv=document.getElementById('f-besucher');if(bv)bv.value='';
    const vnr=document.getElementById('f-vnr');if(vnr)vnr.value='';
    this.setBecher(document.querySelector('.bt-btn[data-val="unbekannt"]'));
    document.getElementById('f-staff-rows').innerHTML='';
    this.addStaffRow();this.addStaffRow();
    Defaults.applyToForm();
  },

  setBecher(btn){
    document.querySelectorAll('.bt-btn').forEach(b=>b.classList.remove('active'));
    if(btn)btn.classList.add('active');
  },

  onEinlassChange(val){
    const gastroEl=document.getElementById('f-gastro');
    if(!val||!gastroEl)return;
    const [h,m]=val.split(':').map(Number);
    const mins=((h*60+m-30)%1440+1440)%1440;
    gastroEl.value=String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');
  },

  /* Formular mit bestehendem Event vorbef\u00fcllen */
  load(ev){
    this.mode='edit'; this.editId=ev.id;
    this.currentLoc=ev.location; this.staffRows=0;
    document.getElementById('entry-title').textContent='\u270F Event bearbeiten';
    document.getElementById('f-loc').value=ev.location;
    document.getElementById('f-date').value=ev.date;
    document.getElementById('f-event').value=ev.event||'';
    document.getElementById('f-notes').value=ev.notes||'';
    document.getElementById('f-kk').value=ev.kundenkarte||'';
    document.getElementById('f-missstaff').checked=!!ev.missingStaff;
    document.getElementById('f-pl-name').value=ev.prodL?ev.prodL.name:'';
    document.getElementById('f-pl-time').value=ev.prodL?ev.prodL.startTime:'';
    const _plEmpId=document.getElementById('f-pl-empid');if(_plEmpId)_plEmpId.value=ev.prodL?.employeeId||'';
    document.getElementById('f-gastro').value=ev.startGastro||'';
    document.getElementById('f-schluss').value=ev.schlussShow||'';
    document.getElementById('f-ende').value=ev.belegungsende||'';
    const einlassEl=document.getElementById('f-einlass');if(einlassEl)einlassEl.value=ev.einlasszeit||'';
    const bv=document.getElementById('f-besucher');if(bv)bv.value=ev.besucherzahl??'';
    const vnr=document.getElementById('f-vnr');if(vnr)vnr.value=ev.veranstaltungsnummer||ev.veranstaltungsnr||ev.vnr||'';
    const becherVal=ev.bechertyp||(ev.plastik?'plastik':'unbekannt');
    this.setBecher(document.querySelector(`.bt-btn[data-val="${becherVal}"]`));
    /* Besetzungszeilen aufbauen */
    document.getElementById('f-staff-rows').innerHTML='';
    ev.barStaff.forEach(s=>this._addStaffRowData(s));
    if(this.staffRows===0){this.addStaffRow();this.addStaffRow();}
  },

  _buildStatusBtns(activeStatuses){
    return Config.data.staffStatuses.map(s=>
      `<button type="button" class="ss-btn${activeStatuses.includes(s.id)?' active':''}" data-sid="${s.id}"
        style="--sc:${s.color||'#22d4a4'}"
        onclick="this.classList.toggle('active')">${s.label}</button>`
    ).join('');
  },

  _addStaffRowData(s){
    this.staffRows++;
    const n=this.staffRows;
    const statuses=s.statuses||(s.miss?['fehlt']:[]);
    const defaultTime=s.ov||(document.getElementById('f-gastro')?.value||'');
    const empId=s.employeeId||'';
    const div=document.createElement('div');
    div.className='staff-entry-row';
    div.id=`srow-${n}`;
    div.innerHTML=`<span class="se-pos">${n}</span>
      <input class="fi" type="text" placeholder="Name" id="sn-${n}" value="${s.name||''}" style="flex:2"
        data-empid-target="sei-${n}"
        oninput="Employees.autocomplete(event,this)" onblur="Employees.hideAC()">
      <input type="hidden" id="sei-${n}" value="${empId}">
      <input class="fi" type="time" id="st-${n}" value="${defaultTime}" style="width:88px" title="Manuelle Startzeit">
      <div class="se-statuses">${this._buildStatusBtns(statuses)}</div>
      <button class="se-rm" onclick="document.getElementById('srow-${n}').remove()" title="Zeile entfernen">&#10005;</button>`;
    document.getElementById('f-staff-rows').appendChild(div);
  },

  addStaffRow(){
    this._addStaffRowData({name:'',pos:this.staffRows+1,ov:null,miss:false,statuses:[]});
  },

  collectStaff(){
    const rows=[];let pos=1;
    document.querySelectorAll('#f-staff-rows .staff-entry-row').forEach(row=>{
      const id=row.id.replace('srow-','');
      const nameEl=document.getElementById(`sn-${id}`);
      const name=nameEl?.value.trim()||'';
      const empId=document.getElementById(`sei-${id}`)?.value||null;
      const time=document.getElementById(`st-${id}`)?.value||null;
      const statuses=[...row.querySelectorAll('.ss-btn.active')].map(b=>b.dataset.sid);
      const miss=statuses.includes('fehlt');
      if(name||miss||statuses.length)rows.push({name,pos,ov:time||null,miss,statuses,employeeId:empId||null});
      pos++;
    });
    return rows;
  },

  _setFieldErr(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('fi-err');
    let errEl = el.parentNode.querySelector(`.fi-errmsg[data-for="${id}"]`);
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.className = 'fi-errmsg';
      errEl.dataset.for = id;
      el.parentNode.insertBefore(errEl, el.nextSibling);
    }
    errEl.textContent = msg;
  },

  _clearFieldErr(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('fi-err');
    const errEl = el.parentNode.querySelector(`.fi-errmsg[data-for="${id}"]`);
    if (errEl) errEl.remove();
  },

  validate() {
    let ok = true;
    const date  = document.getElementById('f-date')?.value;
    const name  = document.getElementById('f-event')?.value.trim();
    if (!date) { this._setFieldErr('f-date',  'Pflichtfeld: Bitte ein Datum auswählen.'); ok = false; }
    else         this._clearFieldErr('f-date');
    if (!name) { this._setFieldErr('f-event', 'Pflichtfeld: Bitte einen Veranstaltungsnamen eingeben.'); ok = false; }
    else         this._clearFieldErr('f-event');
    if (!ok) {
      const first = document.querySelector('.fi-err');
      if (first) first.scrollIntoView({behavior:'smooth', block:'center'});
    }
    return ok;
  },

  getData(){
    const plName=document.getElementById('f-pl-name').value.trim();
    const plTime=document.getElementById('f-pl-time').value;
    const activeBecher=document.querySelector('.bt-btn.active');
    const bechertyp=activeBecher?activeBecher.dataset.val:'unbekannt';
    const bv=document.getElementById('f-besucher');
    const vnr=document.getElementById('f-vnr');
    const existing=this.mode==='edit'?(EVENTS.find(e=>e.id===this.editId)||{}):{};
    return{
      ...existing,
      id:this.mode==='edit'?this.editId:uid(),
      date:document.getElementById('f-date').value,
      location:Number(document.getElementById('f-loc').value),
      event:document.getElementById('f-event').value.trim()||'(kein Name)',
      notes:document.getElementById('f-notes').value.trim(),
      bechertyp,
      plastik:bechertyp==='plastik',
      missingStaff:document.getElementById('f-missstaff').checked,
      kundenkarte:document.getElementById('f-kk').value,
      besucherzahl:bv&&bv.value?Number(bv.value):null,
      veranstaltungsnummer:vnr?vnr.value.trim()||null:null,
      prodL:plName?{name:plName,startTime:plTime||'--:--',employeeId:document.getElementById('f-pl-empid')?.value||null}:null,
      einlasszeit:document.getElementById('f-einlass')?.value||null,
      startGastro:document.getElementById('f-gastro').value||null,
      schlussShow:document.getElementById('f-schluss').value||null,
      belegungsende:document.getElementById('f-ende').value||null,
      barStaff:this.collectStaff(),
    };
  },

  save(){
    if(!this.validate()) return;
    const ev=this.getData();
    if(this.mode==='edit'){
      const idx=EVENTS.findIndex(e=>e.id===this.editId);
      if(idx!==-1)EVENTS[idx]=ev;
    } else {
      EVENTS.push(ev);
    }
    Cloud.push();
    Shifts.syncFromEvent(ev);
    App.render();App.closeEntry();
  },

  saveAndNew(){
    if(!this.validate()) return;
    const ev=this.getData();
    if(this.mode==='edit'){
      const idx=EVENTS.findIndex(e=>e.id===this.editId);
      if(idx!==-1)EVENTS[idx]=ev;
      Cloud.push();
      Shifts.syncFromEvent(ev);
      App.render();App.closeEntry();
    } else {
      EVENTS.push(ev);Cloud.push();
      Shifts.syncFromEvent(ev);
      App.render();
      this.init(this.currentLoc);
    }
  }
};
