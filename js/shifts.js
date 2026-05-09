/* ============================================================
   SHIFTS MODULE
   ============================================================ */
const Shifts = {
  _cache: {},

  calcDuration(start, end) {
    if(!start||!end) return 0;
    const [sh,sm]=(start+':00').split(':').map(Number);
    const [eh,em]=(end+':00').split(':').map(Number);
    let s=sh*60+sm, e2=eh*60+em;
    if(e2<=s) e2+=1440;
    return Math.round((e2-s)/6)/10;
  },

  async loadForEmployee(empId) {
    try {
      const {data,error}=await db.from('shifts').select('*').eq('employee_id',empId).order('event_date',{ascending:false});
      if(!error) this._cache[empId]=data||[];
    } catch(e) { this._cache[empId]=[]; }
    return this._cache[empId]||[];
  },

  sumHours(shifts, from, to) {
    return shifts
      .filter(s=>!from||!to||(s.event_date>=from&&s.event_date<=to))
      .filter(s=>!s.cancelled)
      .reduce((sum,s)=>sum+this.calcDuration(s.actual_start_time||s.start_time,s.actual_end_time||s.end_time),0);
  },

  async confirm(shiftId, actualStart, actualEnd) {
    const {error}=await db.from('shifts').update({
      confirmed:true,
      actual_start_time:actualStart||null,
      actual_end_time:actualEnd||null,
    }).eq('id',shiftId);
    if(error) throw error;
    Object.values(this._cache).forEach(arr=>{
      const s=arr.find(x=>x.id===shiftId);
      if(s){s.confirmed=true;s.actual_start_time=actualStart;s.actual_end_time=actualEnd;}
    });
  },

  async syncFromEvent(ev) {
    try {
      await db.from('shifts').delete().eq('event_id',ev.id);
      const rows=[];
      (ev.barStaff||[]).forEach(s=>{
        const empId=s.employeeId||(s.name?Employees.getByName(s.name)?.id:null);
        if(!empId) return;
        rows.push({
          employee_id:empId, event_id:ev.id,
          event_name:ev.event, event_date:ev.date,
          role:s.role||'Thekenkraft',
          start_time:s.ov||ev.startGastro||null,
          end_time:ev.belegungsende||null,
          besucherzahl:ev.besucherzahl||null,
          veranstaltungsnummer:ev.veranstaltungsnummer||null,
          bechertyp:ev.bechertyp||null,
        });
      });
      const plEmpId=ev.prodL?.employeeId||(ev.prodL?.name?Employees.getByName(ev.prodL.name)?.id:null);
      if(plEmpId) rows.push({
        employee_id:plEmpId, event_id:ev.id,
        event_name:ev.event, event_date:ev.date,
        role:'Produktionsleiter',
        start_time:ev.prodL.startTime||null,
        end_time:ev.belegungsende||null,
        besucherzahl:ev.besucherzahl||null,
        veranstaltungsnummer:ev.veranstaltungsnummer||null,
        bechertyp:ev.bechertyp||null,
      });
      if(rows.length) await db.from('shifts').insert(rows);
      rows.forEach(r=>{ delete this._cache[r.employee_id]; });
    } catch(e) { console.warn('[Shifts] sync error:', e.message); }
  },
};

/* helper: contrast color (black or white) for a hex bg */
function _contrastColor(hex) {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return (r*299+g*587+b*114)/1000>128?'#000':'#fff';
}
function _esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _fmtDate(d){
  if(!d) return '–';
  const [y,m,day]=d.split('-');
  return `${day}.${m}.${y}`;
}
