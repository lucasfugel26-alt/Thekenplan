/* ============================================================
   PLANNING MODULE – Planungszeiträume, Verfügbarkeiten, Regeln
   ============================================================ */

/* ---- PlanningRules ---------------------------------------- */
const PlanningRules = {
  _rows: [],

  async load() {
    try {
      const { data } = await db.from('planning_rules').select('*');
      if (data) this._rows = data;
    } catch (e) { console.warn('[PlanningRules] load:', e.message); }
  },

  getAll() { return this._rows; },
  getForRole(role) { return this._rows.find(r => r.role === role) || null; },

  calcNetHours(grossHours, role) {
    const rules = this.getForRole(role);
    if (!rules?.break_rules?.length) return grossHours;
    let deductMin = 0;
    for (const br of rules.break_rules) {
      if (grossHours >= br.after_hours) deductMin += br.deduct_minutes;
    }
    return Math.max(0, Math.round((grossHours - deductMin / 60) * 100) / 100);
  },

  async upsert(role, fields) {
    const existing = this._rows.find(r => r.role === role);
    if (existing) {
      const { error } = await db.from('planning_rules')
        .update({ ...fields, updated_at: new Date().toISOString() }).eq('role', role);
      if (error) throw error;
      Object.assign(existing, fields);
    } else {
      const { data, error } = await db.from('planning_rules')
        .insert({ role, ...fields }).select().single();
      if (error) throw error;
      this._rows.push(data);
    }
  },

  async delete(role) {
    const { error } = await db.from('planning_rules').delete().eq('role', role);
    if (error) throw error;
    this._rows = this._rows.filter(r => r.role !== role);
  },

  // Render rules editor (for settings or planner)
  renderEditor(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const roles = Config.data.employeeRoles;
    if (!roles.length) { el.innerHTML = '<div style="color:var(--txm);font-size:.8rem">Keine Rollen definiert (Einstellungen → Rollen).</div>'; return; }
    el.innerHTML = roles.map(role => {
      const r = this.getForRole(role) || {};
      const br = r.break_rules || [];
      const brHtml = br.map((b, i) => `
        <div class="pr-break-row" data-role="${role}" data-idx="${i}">
          <span>Ab</span>
          <input type="number" class="fi pr-in" style="width:60px" value="${b.after_hours}" min="0" step="0.5"
            onchange="PlanningRules._updateBreak('${role}',${i},'after_hours',+this.value)">
          <span>h → abziehen</span>
          <input type="number" class="fi pr-in" style="width:60px" value="${b.deduct_minutes}" min="0" step="5"
            onchange="PlanningRules._updateBreak('${role}',${i},'deduct_minutes',+this.value)">
          <span>Min</span>
          <button class="btn btn-ghost" style="padding:2px 7px;font-size:.72rem;color:var(--miss)"
            onclick="PlanningRules._removeBreak('${role}',${i},'${containerId}')">✕</button>
        </div>`).join('');
      return `<div class="pr-role-block">
        <div class="pr-role-name">${role}</div>
        <div class="pr-grid">
          <label>Max Schicht (h)</label>
          <input type="number" class="fi pr-in" value="${r.max_shift_hours||''}" min="0" step="0.5" placeholder="–"
            onchange="PlanningRules._set('${role}','max_shift_hours',this.value?+this.value:null)">
          <label>Min Ruhe (h)</label>
          <input type="number" class="fi pr-in" value="${r.min_rest_hours||11}" min="0" step="0.5"
            onchange="PlanningRules._set('${role}','min_rest_hours',+this.value)">
          <label>Max Woche (h)</label>
          <input type="number" class="fi pr-in" value="${r.max_weekly_hours||''}" min="0" step="0.5" placeholder="–"
            onchange="PlanningRules._set('${role}','max_weekly_hours',this.value?+this.value:null)">
          <label>Max Monat (h)</label>
          <input type="number" class="fi pr-in" value="${r.max_monthly_hours||''}" min="0" step="0.5" placeholder="–"
            onchange="PlanningRules._set('${role}','max_monthly_hours',this.value?+this.value:null)">
          <label>Soll Monat (h)</label>
          <input type="number" class="fi pr-in" value="${r.target_monthly_hours||''}" min="0" step="0.5" placeholder="–"
            onchange="PlanningRules._set('${role}','target_monthly_hours',this.value?+this.value:null)">
        </div>
        <div class="pr-breaks-label">Pausenabzüge:</div>
        <div id="pr-breaks-${role.replace(/\s+/g,'_')}">${brHtml}</div>
        <button class="btn btn-ghost" style="font-size:.72rem;margin-top:6px"
          onclick="PlanningRules._addBreak('${role}','${containerId}')">+ Regel hinzufügen</button>
        <button class="btn btn-primary" style="font-size:.72rem;margin-left:6px"
          onclick="PlanningRules._save('${role}')">Speichern</button>
      </div>`;
    }).join('');
  },

  _pending: {},
  _set(role, key, val) {
    if (!this._pending[role]) this._pending[role] = {};
    this._pending[role][key] = val;
  },
  _addBreak(role, containerId) {
    const r = this.getForRole(role) || {};
    if (!r.break_rules) r.break_rules = [];
    r.break_rules.push({ after_hours: 6, deduct_minutes: 30 });
    if (!this._rows.find(x => x.role === role)) this._rows.push({ role, break_rules: r.break_rules });
    else this._rows.find(x => x.role === role).break_rules = r.break_rules;
    this.renderEditor(containerId || 'pr-editor');
  },
  _removeBreak(role, idx, containerId) {
    const r = this.getForRole(role);
    if (!r) return;
    r.break_rules = (r.break_rules || []).filter((_, i) => i !== idx);
    this.renderEditor(containerId || 'pr-editor');
  },
  _updateBreak(role, idx, key, val) {
    const r = this.getForRole(role);
    if (r?.break_rules?.[idx]) r.break_rules[idx][key] = val;
  },
  async _save(role) {
    const r = this.getForRole(role) || {};
    const pending = this._pending[role] || {};
    const fields = {
      max_shift_hours: pending.max_shift_hours ?? r.max_shift_hours ?? null,
      min_rest_hours: pending.min_rest_hours ?? r.min_rest_hours ?? 11,
      max_weekly_hours: pending.max_weekly_hours ?? r.max_weekly_hours ?? null,
      max_monthly_hours: pending.max_monthly_hours ?? r.max_monthly_hours ?? null,
      target_monthly_hours: pending.target_monthly_hours ?? r.target_monthly_hours ?? null,
      break_rules: r.break_rules || [],
    };
    try {
      await this.upsert(role, fields);
      delete this._pending[role];
      const msg = document.getElementById('pr-save-msg');
      if (msg) { msg.style.display = ''; setTimeout(() => msg.style.display = 'none', 2000); }
    } catch (e) { alert('Fehler: ' + e.message); }
  },
};

/* ---- Planning (periods) ----------------------------------- */
const Planning = {
  _periods: [],
  _active: null,

  async load() {
    try {
      const { data } = await db.from('planning_periods').select('*')
        .order('year', { ascending: false }).order('month', { ascending: false });
      if (data) {
        this._periods = data;
        this._active = data.find(p => p.status !== 'published') || data[0] || null;
      }
    } catch (e) { console.warn('[Planning] load:', e.message); }
  },

  getActive() { return this._active; },
  getAll() { return this._periods; },

  statusLabel(s) {
    return { open: 'Offen', collecting: 'Verfügbarkeiten', ai_proposal: 'KI-Vorschlag', editing: 'Bearbeitung', published: 'Veröffentlicht' }[s] || s;
  },
  statusColor(s) {
    return { open: 'var(--txd)', collecting: 'var(--l1)', ai_proposal: 'var(--l3)', editing: 'var(--l2)', published: '#22d4a4' }[s] || 'var(--txd)';
  },

  renderBanner() {
    const banner = document.getElementById('planning-banner');
    if (!banner) return;
    const p = this._active;
    if (!p || !currentUser) { banner.style.display = 'none'; return; }

    if (isAdmin()) {
      banner.style.display = '';
      banner.innerHTML = `<div class="planning-banner admin">
        <span class="pb-icon">📋</span>
        <div class="pb-body">
          <strong>Dienstplanung ${MONS[p.month - 1]} ${p.year}</strong>
          <span class="pb-status" style="color:${this.statusColor(p.status)}">● ${this.statusLabel(p.status)}</span>
          ${p.deadline ? `<span class="pb-dl">Deadline: ${_fmtDate(p.deadline)}</span>` : ''}
        </div>
        <button class="btn btn-primary" onclick="Planner.open()">Planer öffnen</button>
      </div>`;
      return;
    }

    const myEmp = Employees.getAll().find(e => e.profile_id === currentUser?.id);
    if (!myEmp || (p.status !== 'open' && p.status !== 'collecting')) { banner.style.display = 'none'; return; }
    const dl = p.deadline ? ` · Deadline: ${_fmtDate(p.deadline)}` : '';
    banner.style.display = '';
    banner.innerHTML = `<div class="planning-banner staff">
      <span class="pb-icon">📋</span>
      <div class="pb-body">
        <strong>Dienstplanung ${MONS[p.month - 1]} ${p.year}</strong>
        <span style="color:var(--txm);font-size:.78rem">${dl}</span>
      </div>
      <button class="btn btn-ghost" onclick="Profile.open()">Verfügbarkeit eingeben →</button>
    </div>`;
  },

  async create(month, year, deadline, notes) {
    const { data, error } = await db.from('planning_periods').insert({
      month, year, deadline: deadline || null, notes: notes || null,
      status: 'open', created_by: currentUser.id,
    }).select().single();
    if (error) throw error;
    this._periods.unshift(data);
    this._active = data;
    return data;
  },

  async update(id, fields) {
    const { error } = await db.from('planning_periods').update(fields).eq('id', id);
    if (error) throw error;
    const p = this._periods.find(x => x.id === id);
    if (p) Object.assign(p, fields);
    if (this._active?.id === id) Object.assign(this._active, fields);
  },

  async deletePeriod(id) {
    const { error } = await db.from('planning_periods').delete().eq('id', id);
    if (error) throw error;
    this._periods = this._periods.filter(p => p.id !== id);
    if (this._active?.id === id) this._active = this._periods[0] || null;
  },
};

/* ---- Availability ----------------------------------------- */
const Availability = {
  _cache: {},

  _key(periodId, empId) { return `${periodId}-${empId}`; },

  async load(periodId, empId) {
    const key = this._key(periodId, empId);
    try {
      const { data } = await db.from('employee_availability')
        .select('*').eq('period_id', periodId).eq('employee_id', empId).maybeSingle();
      this._cache[key] = data || { period_id: periodId, employee_id: empId, blocked_dates: [], weekday_rules: {}, submitted_at: null };
    } catch {
      this._cache[key] = { period_id: periodId, employee_id: empId, blocked_dates: [], weekday_rules: {}, submitted_at: null };
    }
    return this._cache[key];
  },

  get(periodId, empId) {
    return this._cache[this._key(periodId, empId)] || { blocked_dates: [], weekday_rules: {} };
  },

  async loadAll(periodId) {
    const { data } = await db.from('employee_availability').select('*').eq('period_id', periodId);
    (data || []).forEach(row => { this._cache[this._key(periodId, row.employee_id)] = row; });
    return data || [];
  },

  async save(periodId, empId, blocked_dates, weekday_rules) {
    const key = this._key(periodId, empId);
    const existing = this._cache[key];
    const fields = { blocked_dates, weekday_rules, updated_at: new Date().toISOString() };
    if (existing?.id) {
      const { error } = await db.from('employee_availability').update(fields).eq('id', existing.id);
      if (error) throw error;
      Object.assign(existing, fields);
    } else {
      const { data, error } = await db.from('employee_availability')
        .insert({ period_id: periodId, employee_id: empId, ...fields }).select().single();
      if (error) throw error;
      this._cache[key] = data;
    }
  },

  async submit(periodId, empId, blocked_dates, weekday_rules) {
    await this.save(periodId, empId, blocked_dates, weekday_rules);
    const key = this._key(periodId, empId);
    const existing = this._cache[key];
    if (existing?.id) {
      const ts = new Date().toISOString();
      await db.from('employee_availability').update({ submitted_at: ts }).eq('id', existing.id);
      existing.submitted_at = ts;
    }
  },

  isBlocked(periodId, empId, dateStr) {
    const av = this.get(periodId, empId);
    if (av.blocked_dates?.includes(dateStr)) return true;
    const wd = new Date(dateStr + 'T12:00:00').getDay();
    const wdKey = wd === 0 ? 7 : wd;
    return !!(av.weekday_rules?.[wdKey]?.blocked);
  },

  // Render form for Profile page
  renderForm(periodId, empId, container) {
    if (!container) return;
    const p = Planning.getActive();
    if (!p || !periodId || !empId) { container.innerHTML = ''; return; }
    const av = this.get(periodId, empId);
    const year = p.year, month = p.month - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
    const DOW = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    let calHtml = '<div class="av-cal">' + DOW.map(d => `<div class="av-dow">${d}</div>`).join('');
    for (let i = 0; i < firstDow; i++) calHtml += '<div class="av-day-empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const blocked = av.blocked_dates?.includes(ds);
      calHtml += `<div class="av-day${blocked ? ' blocked' : ''}" data-date="${ds}"
        onclick="Availability._toggleDate(this,'${periodId}','${empId}')">${d}</div>`;
    }
    calHtml += '</div>';

    const WD_NAMES = { 1: 'Montag', 2: 'Dienstag', 3: 'Mittwoch', 4: 'Donnerstag', 5: 'Freitag', 6: 'Samstag', 7: 'Sonntag' };
    let wdHtml = '<div class="av-wd-rules">';
    for (let wd = 1; wd <= 7; wd++) {
      const rule = av.weekday_rules?.[wd] || {};
      wdHtml += `<div class="av-wd-row">
        <span class="av-wd-name">${WD_NAMES[wd]}</span>
        <label class="av-wd-cb"><input type="checkbox" ${rule.blocked ? 'checked' : ''}
          onchange="Availability._setWd(${wd},'${periodId}','${empId}','blocked',this.checked)"> Blockiert</label>
        <label class="av-wd-time-lbl">Ab <input type="time" class="av-wd-time" value="${rule.from || ''}"
          onchange="Availability._setWd(${wd},'${periodId}','${empId}','from',this.value)"></label>
        <label class="av-wd-time-lbl">Bis <input type="time" class="av-wd-time" value="${rule.to || ''}"
          onchange="Availability._setWd(${wd},'${periodId}','${empId}','to',this.value)"></label>
      </div>`;
    }
    wdHtml += '</div>';

    const dl = p.deadline ? `<div class="av-deadline">Deadline: <strong>${_fmtDate(p.deadline)}</strong></div>` : '';
    const submitted = av.submitted_at
      ? `<div class="av-submitted">✓ Eingereicht: ${new Date(av.submitted_at).toLocaleDateString('de-DE')}</div>` : '';

    container.innerHTML = `<div class="av-wrap">
      <div class="av-title">Verfügbarkeit ${MONS[month]} ${year}</div>
      ${dl}${submitted}
      <div class="av-hint">Klicke auf Tage, an denen du <strong>nicht</strong> verfügbar bist (rot = blockiert):</div>
      ${calHtml}
      <details class="av-wd-details"><summary>Wochentag-Einschränkungen</summary>${wdHtml}</details>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="Availability._save('${periodId}','${empId}')">Zwischenspeichern</button>
        <button class="btn btn-primary" onclick="Availability._submit('${periodId}','${empId}')">✓ Einreichen</button>
      </div>
    </div>`;
  },

  _toggleDate(el, periodId, empId) {
    const ds = el.dataset.date;
    const av = this.get(periodId, empId);
    if (!av.blocked_dates) av.blocked_dates = [];
    const idx = av.blocked_dates.indexOf(ds);
    if (idx >= 0) av.blocked_dates.splice(idx, 1);
    else av.blocked_dates.push(ds);
    el.classList.toggle('blocked');
  },

  _setWd(wd, periodId, empId, key, val) {
    const av = this.get(periodId, empId);
    if (!av.weekday_rules) av.weekday_rules = {};
    if (!av.weekday_rules[wd]) av.weekday_rules[wd] = {};
    av.weekday_rules[wd][key] = val;
  },

  async _save(periodId, empId) {
    const av = this.get(periodId, empId);
    try {
      await this.save(periodId, empId, av.blocked_dates || [], av.weekday_rules || {});
      const btn = event?.target;
      if (btn) { const orig = btn.textContent; btn.textContent = '✓ Gespeichert'; setTimeout(() => btn.textContent = orig, 2000); }
    } catch (e) { alert('Fehler: ' + e.message); }
  },

  async _submit(periodId, empId) {
    const av = this.get(periodId, empId);
    try {
      await this.submit(periodId, empId, av.blocked_dates || [], av.weekday_rules || {});
      alert('Verfügbarkeit erfolgreich eingereicht!');
      // Re-render profile to show submitted state
      const cont = document.getElementById('profil-av-cont');
      if (cont) this.renderForm(periodId, empId, cont);
    } catch (e) { alert('Fehler: ' + e.message); }
  },
};

/* ---- ShiftApplications ------------------------------------ */
const ShiftApplications = {
  _cache: {},

  async load(periodId) {
    const { data } = await db.from('shift_applications').select('*').eq('period_id', periodId);
    this._cache[periodId] = data || [];
    return this._cache[periodId];
  },

  async loadForEmployee(periodId, empId) {
    const { data } = await db.from('shift_applications').select('*')
      .eq('period_id', periodId).eq('employee_id', empId);
    const all = this._cache[periodId] || [];
    (data || []).forEach(row => {
      if (!all.find(a => a.id === row.id)) all.push(row);
    });
    this._cache[periodId] = all;
    return (data || []).map(a => a.event_id);
  },

  hasApplied(periodId, empId, eventId) {
    return !!(this._cache[periodId] || []).find(a => a.employee_id === empId && a.event_id === eventId);
  },

  getForEvent(periodId, eventId) {
    return (this._cache[periodId] || []).filter(a => a.event_id === eventId).map(a => a.employee_id);
  },

  getForEmployee(periodId, empId) {
    return (this._cache[periodId] || []).filter(a => a.employee_id === empId).map(a => a.event_id);
  },

  async toggle(periodId, empId, eventId) {
    const existing = (this._cache[periodId] || []).find(a => a.employee_id === empId && a.event_id === eventId);
    if (existing) {
      await db.from('shift_applications').delete().eq('id', existing.id);
      this._cache[periodId] = (this._cache[periodId] || []).filter(a => a.id !== existing.id);
    } else {
      const { data, error } = await db.from('shift_applications')
        .insert({ period_id: periodId, employee_id: empId, event_id: eventId }).select().single();
      if (error) throw error;
      if (!this._cache[periodId]) this._cache[periodId] = [];
      this._cache[periodId].push(data);
    }
  },
};
