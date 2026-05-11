/* ============================================================
   LOKALE SPEICHERUNG + SUPABASE SYNC
   ============================================================ */
const STORAGE_KEY = 'thekenplan_events_v1';
const SUPABASE_URL = 'https://anagoloyaaikuexzbxae.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XTuf7VVSntXltXks1tslUw_mWq8TRWn';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser    = null;
let currentProfile = null;

/* --- Lokal speichern/laden -------------------------------- */
function saveLocal() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(EVENTS)); } catch(e) {}
}
function loadLocal() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      const p = JSON.parse(s);
      if (Array.isArray(p) && p.length > 0) {
        EVENTS.length = 0;
        p.forEach(e => EVENTS.push(e));
        return true;
      }
    }
  } catch(e) {}
  return false;
}
function saveData() { saveLocal(); }
function loadData() { return loadLocal(); }

/* --- Cloud (Supabase) ------------------------------------- */
const Cloud = {
  isConfigured() { return !!currentUser; },

  setSyncStatus(state, text) {
    ['sync-dot','stg-dot','sync-dot-m'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){el.className='sync-dot '+state;}
    });
    ['sync-label','sync-label-m'].forEach(id=>{
      const el=document.getElementById(id);
      if(el)el.textContent=text;
    });
    const stgl=document.getElementById('stg-status-text');
    if(stgl)stgl.textContent=text;
    const btn=document.getElementById('sync-btn');
    if(btn){btn.className='btn-sync'+(state==='ok'?' ok':state==='err'?' err':'');}
  },

  /* Bug 12: Retry-Helfer für transiente Fehler (503, 429, Netzwerk) */
  async _withRetry(fn, label) {
    const delays=[1500,3000,6000];
    for(let i=0;i<=delays.length;i++){
      try {
        const result=await fn();
        const status=result?.error?.status;
        if(status===503||status===429){
          if(i<delays.length){
            const wait=delays[i];
            this.setSyncStatus('busy',`Server überlastet – Retry ${i+1}…`);
            console.warn(`[Supabase] ${label} ${status} – retry in ${wait}ms`);
            await new Promise(r=>setTimeout(r,wait));
            continue;
          }
          throw Object.assign(new Error(`HTTP ${status}`),{status});
        }
        return result;
      } catch(e) {
        if(i<delays.length&&(e.status===503||e.status===429||!navigator.onLine)){
          await new Promise(r=>setTimeout(r,delays[i]));
          continue;
        }
        throw e;
      }
    }
  },

  async fetch() {
    if(!currentUser){this.setSyncStatus('off','Nicht angemeldet');return false;}
    this.setSyncStatus('busy','Lade Daten…');
    try {
      const {data,error}=await this._withRetry(
        ()=>db.from('events').select('data').order('date'), 'fetch');
      if(error)throw error;
      if(data.length>0){
        EVENTS.length=0;
        data.forEach(row=>EVENTS.push(row.data));
        saveLocal();
        const now=new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
        this.setSyncStatus('ok',`Synchronisiert ${now}`);
        return true;
      } else {
        await this.save();
        return true;
      }
    } catch(e) {
      const msg=e?.status===503?'Server nicht verfügbar (503)':
                e?.status===429?'Zu viele Anfragen – bitte warten':
                'Verbindungsfehler';
      this.setSyncStatus('err',msg);
      console.warn('[Supabase] fetch error:',e);
    }
    return false;
  },

  async save() {
    if(!currentUser)return false;
    this.setSyncStatus('busy','Speichere…');
    try {
      const rows=EVENTS.map(ev=>({
        id:ev.id,date:ev.date,location_id:ev.location||1,
        data:ev,updated_at:new Date().toISOString()
      }));
      const {error}=await this._withRetry(
        ()=>db.from('events').upsert(rows), 'save');
      if(error)throw error;
      saveLocal();
      const now=new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
      this.setSyncStatus('ok',`Gespeichert ${now}`);
      return true;
    } catch(e) {
      const msg=e?.status===503?'Server nicht verfügbar (503)':
                e?.status===429?'Zu viele Anfragen':
                'Speicherfehler!';
      this.setSyncStatus('err',msg);
      console.warn('[Supabase] save error:',e);
    }
    return false;
  },

  async push() { saveLocal(); return await this.save(); },
};
