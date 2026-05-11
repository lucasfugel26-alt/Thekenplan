/* ============================================================
   CONFIG MODULE – lädt Statusoptionen aus Supabase
   ============================================================ */
const Config = {
  data: {
    staffStatuses: [
      {id:"fehlt",   label:"fehlt",          color:"#ff4040"},
      {id:"spaet",   label:"kommt zu spät", color:"#f5a623"},
      {id:"ersatz",  label:"braucht Ersatz", color:"#e05aff"},
    ],
    cardFields: {
      becher:   {show:true,  staff:true},
      zeiten:   {show:true,  staff:true},
      besucher: {show:false, staff:false},
      notizen:  {show:true,  staff:true},
    },
    employeeRoles: ['Thekenkraft','Produktionsleiter','Garderobe','Runner'],
  },
  async load() {
    try {
      const {data,error} = await db.from('app_config').select('*');
      if (error) throw error;
      (data||[]).forEach(row => {
        if (row.key === 'staff_statuses' && Array.isArray(row.value)) {
          this.data.staffStatuses = row.value;
        }
        if (row.key === 'card_fields' && row.value && typeof row.value === 'object') {
          this.data.cardFields = {...this.data.cardFields, ...row.value};
        }
        if (row.key === 'employee_roles' && Array.isArray(row.value)) {
          this.data.employeeRoles = row.value;
        }
      });
    } catch(e) { console.warn('[Config] using defaults:', e.message); }
    // Load planning rules in parallel (non-blocking)
    PlanningRules.load().catch(()=>{});
  },
  async saveEmployeeRoles() {
    try {
      await db.from('app_config').upsert({key:'employee_roles',value:this.data.employeeRoles,updated_at:new Date().toISOString()});
    } catch(e) { console.warn('[Config] saveEmployeeRoles error:', e.message); }
  },
  async save() {
    try {
      await db.from('app_config').upsert({
        key:'staff_statuses', value:this.data.staffStatuses,
        updated_at: new Date().toISOString()
      });
    } catch(e) { console.warn('[Config] save error:', e.message); }
  },
  addStatus() {
    const label = document.getElementById('stg-new-status-label').value.trim();
    const color = document.getElementById('stg-new-status-color').value;
    if (!label) return;
    const id = label.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
    this.data.staffStatuses.push({id, label, color});
    this.save();
    document.getElementById('stg-new-status-label').value = '';
    renderStatusConfig();
  },
  removeStatus(id) {
    this.data.staffStatuses = this.data.staffStatuses.filter(s => s.id !== id);
    this.save();
    renderStatusConfig();
  },
  async saveCardFields() {
    try {
      await db.from('app_config').upsert({
        key:'card_fields', value:this.data.cardFields,
        updated_at:new Date().toISOString()
      });
    } catch(e) { console.warn('[Config] saveCardFields error:', e.message); }
  },
  addRole() {
    const label=document.getElementById('stg-new-role-label')?.value.trim();
    if(!label||this.data.employeeRoles.includes(label))return;
    this.data.employeeRoles.push(label);
    this.saveEmployeeRoles();
    document.getElementById('stg-new-role-label').value='';
    renderRolesConfig();
  },
  removeRole(idx) {
    this.data.employeeRoles.splice(idx,1);
    this.saveEmployeeRoles();
    renderRolesConfig();
  },
  moveRole(idx, dir) {
    const r=this.data.employeeRoles;
    const n=idx+dir;
    if(n<0||n>=r.length)return;
    [r[idx],r[n]]=[r[n],r[idx]];
    this.saveEmployeeRoles();
    renderRolesConfig();
  },
};

/* ============================================================
   LOCATIONS MODULE – lädt Locations aus Supabase
   ============================================================ */
const LocationsMgr = {
  _rows: [],
  async load() {
    try {
      const {data,error} = await db.from('locations').select('*').order('sort_order');
      if (error) throw error;
      if (data && data.length > 0) {
        this._rows = data;
        LOCS = {};
        data.forEach(l => { LOCS[l.id] = {
          id:l.id, name:l.name, short:l.short, color:l.color,
          image:l.image||null, address:l.address||null, maps_url:l.maps_url||null,
          contact_name:l.contact_name||null, contact_phone:l.contact_phone||null,
          capacity:l.capacity||null, notes:l.notes||null
        }; });
        return true;
      }
    } catch(e) { console.warn('[Locations] using defaults:', e.message); }
    return false;
  },
  async create(name, short, color) {
    const sort_order = Object.keys(LOCS).length + 1;
    const {data,error} = await db.from('locations')
      .insert({name, short, color, sort_order}).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, updates) {
    const {error} = await db.from('locations').update(updates).eq('id', id);
    if (error) throw error;
  },
  async remove(id) {
    const {error} = await db.from('locations').delete().eq('id', id);
    if (error) throw error;
  },
};
