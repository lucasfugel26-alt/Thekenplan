/* ============================================================
   DEFAULTS & CARD FIELDS
   ============================================================ */
const Defaults = {
  _key: 'theken_defaults',
  get() {
    try { return JSON.parse(localStorage.getItem(this._key)||'{}'); } catch { return {}; }
  },
  applyToForm() {
    const d = this.get();
    if(d.gastro) { const el=document.getElementById('f-gastro'); if(el) el.value=d.gastro; }
    if(d.schluss) { const el=document.getElementById('f-schluss'); if(el) el.value=d.schluss; }
    if(d.ende)   { const el=document.getElementById('f-ende');   if(el) el.value=d.ende; }
    if(d.loc)    { const el=document.getElementById('f-loc');    if(el && el.querySelector(`option[value="${d.loc}"]`)) el.value=d.loc; }
  },
  save() {
    const v = k => document.getElementById(k)?.value || '';
    const d = { loc: v('stg-def-loc'), gastro: v('stg-def-gastro'), schluss: v('stg-def-schluss'), ende: v('stg-def-ende') };
    localStorage.setItem(this._key, JSON.stringify(d));
    const msg = document.getElementById('stg-def-msg');
    if(msg){ msg.style.display=''; setTimeout(()=>msg.style.display='none', 2000); }
  },
  loadIntoSettings() {
    const d = this.get();
    const locSel = document.getElementById('stg-def-loc');
    if(locSel) {
      locSel.innerHTML = Object.values(LOCS).map(l=>`<option value="${l.id}">${l.name}</option>`).join('');
      if(d.loc) locSel.value = d.loc;
    }
    const set = (id, val) => { const el=document.getElementById(id); if(el&&val) el.value=val; };
    set('stg-def-gastro', d.gastro);
    set('stg-def-schluss', d.schluss);
    set('stg-def-ende', d.ende);
  }
};

const CardFields = {
  get() { return Config.data.cardFields; },
  forRole() {
    const cf = this.get();
    return {
      becher:   can(PERM.EVENTS_EDIT)    ? cf.becher.show   : cf.becher.staff,
      zeiten:   can(PERM.EVENTS_EDIT)    ? cf.zeiten.show   : cf.zeiten.staff,
      besucher: can(PERM.VISITORS_VIEW)  ? cf.besucher.show : cf.besucher.staff,
      notizen:  can(PERM.EVENTS_VIEW_NOTES) ? cf.notizen.show : cf.notizen.staff,
    };
  },
  save() {
    const cb = id => document.getElementById(id)?.checked ?? true;
    Config.data.cardFields = {
      becher:   {show:cb('stg-cf-becher-show'),   staff:cb('stg-cf-becher-staff')},
      zeiten:   {show:cb('stg-cf-zeiten-show'),   staff:cb('stg-cf-zeiten-staff')},
      besucher: {show:cb('stg-cf-besucher-show'), staff:cb('stg-cf-besucher-staff')},
      notizen:  {show:cb('stg-cf-notizen-show'),  staff:cb('stg-cf-notizen-staff')},
    };
    Config.saveCardFields();
    App.render();
  },
  loadIntoSettings() {
    const cf = this.get();
    const set = (id,val) => { const el=document.getElementById(id); if(el) el.checked=val; };
    set('stg-cf-becher-show',    cf.becher.show);
    set('stg-cf-becher-staff',   cf.becher.staff);
    set('stg-cf-zeiten-show',    cf.zeiten.show);
    set('stg-cf-zeiten-staff',   cf.zeiten.staff);
    set('stg-cf-besucher-show',  cf.besucher.show);
    set('stg-cf-besucher-staff', cf.besucher.staff);
    set('stg-cf-notizen-show',   cf.notizen.show);
    set('stg-cf-notizen-staff',  cf.notizen.staff);
  }
};
