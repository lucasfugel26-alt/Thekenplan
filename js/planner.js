/* ============================================================
   PLANNER MODULE – Dienstplanungs-UI
   ============================================================ */
const Planner = {
  _period: null,
  _draft: {},           // {eventId: barStaff[]} – proposed_assignments
  _monthEvents: [],     // events for the planning month
  _tab: 'overview',
  _aiReport: null,
  _selectedRoles: [],   // roles to plan (for AI)

  /* ─── Open / Close ─────────────────────────────────────── */
  async open(periodId) {
    document.getElementById('planner-page').style.display = 'block';
    document.body.style.overflow = 'hidden';
    const periods = Planning.getAll();
    const target = periodId ? periods.find(p => p.id === periodId) : Planning.getActive();
    this._period = target || null;
    if (!this._period) {
      this._tab = 'new';
    } else {
      this._draft = this._period.proposed_assignments ? JSON.parse(JSON.stringify(this._period.proposed_assignments)) : {};
      const y = this._period.year, m = String(this._period.month).padStart(2, '0');
      this._monthEvents = EVENTS.filter(ev => ev.date.startsWith(`${y}-${m}`))
        .sort((a, b) => a.date.localeCompare(b.date));
      this._tab = 'overview';
      // Default: alle Rollen vorausgewählt
      if (!this._selectedRoles.length) {
        this._selectedRoles = [...(Config.data.employeeRoles || [])];
      }
    }
    this._render();
  },

  close() {
    document.getElementById('planner-page').style.display = 'none';
    document.body.style.overflow = '';
    this._aiReport = null;
  },

  /* ─── Main Render ───────────────────────────────────────── */
  _render() {
    const root = document.getElementById('planner-root');
    if (!root) return;
    const p = this._period;
    const periods = Planning.getAll();

    const headerHtml = `
      <div class="planner-hdr">
        <button class="btn btn-ghost stg-back" onclick="Planner.close()">← Zurück</button>
        <div class="planner-title">📋 Dienstplanung</div>
        <div class="planner-period-sel">
          <select class="fi" style="padding:5px 10px;font-size:.82rem" onchange="Planner.open(this.value||undefined)">
            <option value="">— Zeitraum wählen —</option>
            ${periods.map(pp => `<option value="${pp.id}" ${p?.id === pp.id ? 'selected' : ''}>${MONS[pp.month - 1]} ${pp.year} · ${Planning.statusLabel(pp.status)}</option>`).join('')}
          </select>
          <button class="btn btn-ghost" onclick="Planner._showNewPeriod()" title="Neuen Zeitraum erstellen">+ Neu</button>
        </div>
      </div>`;

    if (this._tab === 'new' || !p) {
      root.innerHTML = headerHtml + `<div class="planner-new-form">
        <h3>Neuen Planungszeitraum erstellen</h3>
        <div class="planner-form-grid">
          <div class="fg"><label>Monat</label>
            <select class="fi" id="pn-month">${MONS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select></div>
          <div class="fg"><label>Jahr</label>
            <input class="fi" type="number" id="pn-year" value="${new Date().getFullYear()}" min="2024" max="2030"></div>
          <div class="fg"><label>Deadline (opt.)</label>
            <input class="fi" type="date" id="pn-deadline"></div>
          <div class="fg"><label>Notizen (opt.)</label>
            <input class="fi" type="text" id="pn-notes" placeholder="…"></div>
        </div>
        <div id="pn-err" style="color:var(--miss);font-size:.8rem;display:none;margin-bottom:8px"></div>
        <button class="btn btn-primary" onclick="Planner._createPeriod()">Erstellen</button>
      </div>`;
      const now = new Date();
      const sel = document.getElementById('pn-month');
      if (sel) sel.value = now.getMonth() + 1;
      return;
    }

    const tabs = [
      ['overview', '📊 Übersicht'],
      ['assignments', '📝 Besetzung'],
      ['availability', '📆 Verfügbarkeiten'],
      ['swaps', '🔄 Schichttausch'],
      ['rules', '⚙ Regelwerk'],
    ];
    const tabsHtml = `<div class="planner-tabs">${tabs.map(([id, label]) =>
      `<button class="planner-tab${this._tab === id ? ' active' : ''}" onclick="Planner._setTab('${id}')">${label}</button>`
    ).join('')}</div>`;

    let body = '';
    if (this._tab === 'overview') body = this._renderOverview();
    else if (this._tab === 'assignments') body = this._renderAssignments();
    else if (this._tab === 'availability') body = '<div class="plan-section"><div style="color:var(--txm);font-size:.83rem">Lade Verfügbarkeiten…</div></div>';
    else if (this._tab === 'swaps') body = '<div class="plan-section"><div style="color:var(--txm);font-size:.83rem">Lade Tauschanfragen…</div></div>';
    else if (this._tab === 'rules') body = this._renderRules();

    root.innerHTML = headerHtml + tabsHtml + `<div class="planner-body">${body}</div>`;

    if (this._tab === 'rules') PlanningRules.renderEditor('pr-editor');
    if (this._tab === 'assignments') this._renderHoursSidebar();
    if (this._tab === 'availability') this._loadAvailabilityTab();
    if (this._tab === 'swaps') this._loadSwapsTab();
  },

  _setTab(tab) { this._tab = tab; this._render(); },

  /* ─── Overview Tab ──────────────────────────────────────── */
  _renderOverview() {
    const p = this._period;
    const allSteps = ['open', 'collecting', 'ai_proposal', 'editing', 'published'];
    const statusFlow = Config.data.aiEnabled ? allSteps : allSteps.filter(s => s !== 'ai_proposal');
    const curIdx = statusFlow.indexOf(p.status);
    const nextStatus = statusFlow[curIdx + 1];

    const statusBtns = nextStatus && p.status !== 'published' ? `
      <button class="btn btn-primary" onclick="Planner._advanceStatus('${nextStatus}')">
        → Status: ${Planning.statusLabel(nextStatus)}
      </button>` : '';

    // Rollen-Auswahl für KI
    const roles = Config.data.employeeRoles || [];
    const rolesHtml = Config.data.aiEnabled && roles.length ? `
      <div class="plan-section">
        <div class="plan-sec-title">🎯 Zu planende Rollen</div>
        <p style="font-size:.82rem;color:var(--txm);margin-bottom:10px">
          Wähle welche Rollen die KI besetzen soll:</p>
        <div class="role-sel-list">
          ${roles.map(r => `
            <label class="role-sel-item">
              <input type="checkbox" ${this._selectedRoles.includes(r) ? 'checked' : ''}
                onchange="Planner._toggleRole('${r}',this.checked)">
              <span>${_esc(r)}</span>
            </label>`).join('')}
        </div>
      </div>` : '';

    // Events ohne required_staff
    const missingReq = this._monthEvents.filter(ev => !ev.cancelled && (!ev.required_staff || !ev.required_staff.length));

    const aiSection = Config.data.aiEnabled && p.status !== 'published' ? `
      <div class="plan-section">
        <div class="plan-sec-title">🤖 KI-Dienstplan</div>
        ${missingReq.length ? `
          <div class="ai-missing-warn">
            <strong>⚠ Fehlender Personalbedarf</strong><br>
            Bei ${missingReq.length} Veranstaltung(en) ist noch kein Personalbedarf hinterlegt.
            Die KI kann diese Events nicht besetzen:<br>
            <ul style="margin:6px 0 0;padding-left:18px;font-size:.8rem">
              ${missingReq.map(ev => `<li>${_fmtDate(ev.date)} · ${_esc(ev.event)}
                <button class="btn btn-ghost" style="font-size:.68rem;padding:1px 6px;margin-left:6px"
                  onclick="Planner._editEvent('${ev.id}')">Bearbeiten →</button>
              </li>`).join('')}
            </ul>
          </div>` : ''}
        <div id="planner-ai-area">${this._renderAIArea()}</div>
      </div>` : '';

    const publishBtn = (p.status === 'ai_proposal' || p.status === 'editing') ? `
      <div class="plan-section">
        <div class="plan-sec-title">🚀 Veröffentlichen</div>
        <p style="font-size:.83rem;color:var(--txm);margin-bottom:12px">
          Alle Entwurf-Zuteilungen werden in den Dienstplan übernommen und für alle Mitarbeiter sichtbar.</p>
        <button class="btn btn-primary" onclick="Planner.publish()">Plan veröffentlichen</button>
        ${Object.keys(this._draft).length ? `<span style="font-size:.78rem;color:var(--l2);margin-left:10px">✓ ${Object.keys(this._draft).length} Events im Entwurf</span>` : ''}
      </div>` : '';

    const deleteBtn = `<button class="btn btn-ghost" style="color:var(--miss);border-color:rgba(255,64,64,.3);font-size:.75rem"
      onclick="Planner._deletePeriod()">Zeitraum löschen</button>`;

    const missingAv = this._getMissingAvailability();

    return `
      <div class="plan-ov-grid">
        <div class="plan-section">
          <div class="plan-sec-title">Status-Workflow</div>
          <div class="plan-status-flow">
            ${statusFlow.map((s, i) => `<div class="psf-step${p.status === s ? ' active' : i < curIdx ? ' done' : ''}">
              <div class="psf-dot"></div><div class="psf-label">${Planning.statusLabel(s)}</div>
            </div>`).join('<div class="psf-line"></div>')}
          </div>
          <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
            ${statusBtns}
            ${deleteBtn}
          </div>
          ${p.deadline ? `<div style="margin-top:10px;font-size:.8rem;color:var(--txm)">Deadline: ${_fmtDate(p.deadline)}</div>` : ''}
        </div>

        <div class="plan-section">
          <div class="plan-sec-title">Veranstaltungen ${MONS[p.month - 1]} ${p.year}</div>
          <div style="font-size:2rem;font-weight:800;font-family:var(--fh);margin-bottom:4px">${this._monthEvents.length}</div>
          <div style="font-size:.8rem;color:var(--txm)">Events in diesem Monat</div>
          ${missingAv.length ? `<div style="margin-top:12px;padding:10px;background:rgba(255,166,0,.1);border:1px solid rgba(255,166,0,.25);border-radius:8px;font-size:.8rem">
            <strong>⚠ ${missingAv.length} Mitarbeiter</strong> haben noch keine Verfügbarkeit eingegeben:<br>
            <span style="color:var(--txm)">${missingAv.map(e => e.name).join(', ')}</span>
          </div>` : '<div style="margin-top:10px;font-size:.8rem;color:#22d4a4">✓ Alle Verfügbarkeiten eingegangen</div>'}
        </div>
      </div>
      ${rolesHtml}
      ${aiSection}
      ${publishBtn}`;
  },

  _toggleRole(role, checked) {
    if (checked && !this._selectedRoles.includes(role)) this._selectedRoles.push(role);
    else if (!checked) this._selectedRoles = this._selectedRoles.filter(r => r !== role);
  },

  _getMissingAvailability() {
    const p = this._period;
    if (!p) return [];
    const activeEmps = Employees.getAll().filter(e => e.status !== 'ausgeschieden' && e.profile_id);
    return activeEmps.filter(emp => {
      const av = Availability.get(p.id, emp.id);
      return !av.submitted_at && !av.id;
    });
  },

  _renderAIArea() {
    if (this._aiReport) {
      return `<div class="ai-report">${_esc(this._aiReport).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>
        <div style="margin-top:12px">
          <textarea class="fi" id="ai-answers" rows="3" placeholder="Beantworte die Fragen oder gib weitere Anweisungen…" style="width:100%;resize:vertical"></textarea>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-primary" id="ai-gen-btn" onclick="Planner._aiGenerate()">🤖 Plan generieren</button>
          <button class="btn btn-ghost" onclick="Planner._aiReport=null;document.getElementById('planner-ai-area').innerHTML=Planner._renderAIArea()">Zurücksetzen</button>
        </div>`;
    }
    return `<p style="font-size:.83rem;color:var(--txm);margin-bottom:12px">
      Claude analysiert die Verfügbarkeiten und generiert einen optimalen Vorschlag.</p>
      <button class="btn btn-primary" id="ai-pre-btn" onclick="Planner._aiPreflight()">🤖 Preflight-Analyse starten</button>`;
  },

  /* ─── Assignments Tab ───────────────────────────────────── */
  _renderAssignments() {
    const p = this._period;
    const hasDraft = Object.keys(this._draft).length > 0;
    const isEditing = p.status !== 'published';

    let evHtml = '';
    if (!this._monthEvents.length) {
      evHtml = '<div style="color:var(--txm);font-size:.83rem;padding:20px 0">Keine Events in diesem Monat.</div>';
    } else {
      evHtml = this._monthEvents.map(ev => this._buildEventAssignCard(ev, isEditing)).join('');
    }

    const draftNote = hasDraft && isEditing
      ? `<div class="draft-note">✏ Entwurfsmodus – Änderungen werden gespeichert, aber noch nicht veröffentlicht.</div>` : '';

    return `<div class="assign-layout">
      <div class="assign-events">
        ${draftNote}
        <div id="assign-events-list">${evHtml}</div>
      </div>
      <div class="assign-sidebar" id="assign-sidebar">
        <div class="sidebar-title">Stunden ${MONS[p.month - 1]} ${p.year}</div>
        <div id="hours-list"><div style="color:var(--txm);font-size:.8rem">Berechne…</div></div>
      </div>
    </div>`;
  },

  _buildEventAssignCard(ev, isEditing) {
    const loc = LOCS[ev.location] || {};
    // Use required_staff to define slots; fall back to barStaff for legacy events
    const reqStaff = ev.required_staff || [];
    const draftStaff = this._draft[ev.id];
    const isDraft = draftStaff !== undefined;

    let slots = [];
    if (isDraft) {
      slots = draftStaff;
    } else if (reqStaff.length) {
      // Build slots from required_staff definition
      let pos = 1;
      for (const req of reqStaff) {
        for (let i = 0; i < req.count; i++) {
          // Check if already assigned in barStaff
          const assigned = (ev.barStaff || []).find(s => s.pos === pos && !s.miss);
          slots.push(assigned || { pos, name: null, miss: true, role: req.role, req_start: req.start_time, req_end: req.end_time });
          pos++;
        }
      }
    } else {
      // Auto-generate one slot per role using event times as default
      const barStaff = ev.barStaff || [];
      const roles = Config.data.employeeRoles || [];
      if (roles.length && !barStaff.some(s => !s.miss)) {
        slots = roles.map((role, i) => ({
          pos: i + 1, name: null, miss: true, role,
          req_start: ev.startGastro || null,
          req_end: ev.schlussShow || null,
        }));
      } else {
        slots = barStaff;
      }
    }

    // Slots außerhalb des Dienstplan-Scopes ausblenden
    const visibleSlots = slots.filter(s => isInStaffScope(s.role || 'Thekenkraft'));

    const slotRows = visibleSlots.map((s, idx) => {
      const originalIdx = slots.indexOf(s);
      const removeBtn = isEditing ? `<button class="assign-remove-btn" onclick="Planner._removeSlot('${ev.id}',${originalIdx})" title="Entfernen">✕</button>` : '';
      const roleTag = s.role ? `<span class="slot-role">${_esc(s.role)}</span>` : '';
      const timeTag = (s.req_start || s.req_end) ? `<span class="slot-time">${s.req_start||''}${s.req_end?'–'+s.req_end:''}</span>` : '';
      if (s.miss || !s.name) {
        return `<div class="assign-slot empty" ${isEditing ? `onclick="Planner._openPicker('${ev.id}',${originalIdx})"` : ''}>
          <span class="slot-pos">Pos ${s.pos || idx + 1}</span>
          ${roleTag}${timeTag}
          <span class="slot-empty-txt">Nicht besetzt</span>
          ${removeBtn}
        </div>`;
      }
      const emp = Employees.getAll().find(e => e.name === s.name || e.id === s.employeeId);
      const bg = emp?.color || '#555';
      return `<div class="assign-slot filled" ${isEditing ? `onclick="Planner._openPicker('${ev.id}',${originalIdx})"` : ''}>
        <span class="slot-pos">Pos ${s.pos || idx + 1}</span>
        ${roleTag}${timeTag}
        <span class="emp-badge sm" style="background:${bg};color:${_contrastColor(bg)}">${emp?.kuerzel || s.name.slice(0, 2)}</span>
        <span class="slot-name">${_esc(s.name)}</span>
        ${removeBtn}
      </div>`;
    }).join('');

    const addBtn = isEditing ? `<button class="assign-add-slot" onclick="Planner._addSlot('${ev.id}')">+ Slot hinzufügen</button>` : '';

    // Hours for this event
    const evHours = ev.startGastro && ev.belegungsende
      ? Shifts.calcDuration(ev.startGastro, ev.belegungsende)
      : null;
    const hoursTag = evHours ? `<span class="assign-ev-hours">${evHours.toFixed(1)}h</span>` : '';

    return `<div class="assign-ev-card${isDraft ? ' is-draft' : ''}" data-evid="${ev.id}" style="border-left-color:${loc.color || 'var(--bd)'}">
      <div class="assign-ev-hd">
        <span class="assign-ev-loc" style="background:${loc.color || '#555'}22;color:${loc.color || 'var(--txd)'};">${loc.short || '?'}</span>
        <span class="assign-ev-date">${_fmtDate(ev.date)}</span>
        <span class="assign-ev-name">${_esc(ev.event)}</span>
        ${hoursTag}
        ${ev.cancelled ? '<span class="tag tag-canc">Abgesagt</span>' : ''}
        ${isDraft ? '<span class="draft-badge">Entwurf</span>' : ''}
      </div>
      <div class="assign-slots">${slotRows}</div>
      ${addBtn}
    </div>`;
  },

  _renderHoursSidebar() {
    const el = document.getElementById('hours-list');
    if (!el) return;
    const p = this._period;
    if (!p) { el.innerHTML = ''; return; }
    const emps = Employees.getAll().filter(e => e.status !== 'ausgeschieden');
    const rows = emps.map(emp => {
      const { gross, net, breakMin, events } = this._calcHours(emp);
      const soll = Number(emp.soll_stunden) || 0;
      const sollMonth = (emp.soll_period || 'month') === 'week' ? Math.round(soll * 4.33 * 10) / 10 : soll;
      const pct = sollMonth > 0 ? Math.min(100, Math.round(gross / sollMonth * 100)) : 0;
      const delta = sollMonth > 0 ? gross - sollMonth : null;
      const barColor = sollMonth === 0 ? 'var(--txm)' : gross >= sollMonth ? '#22d4a4' : gross > sollMonth * 0.8 ? 'var(--l1)' : 'var(--l4)';
      const deltaHtml = delta !== null
        ? `<span class="hours-delta ${delta >= 0 ? 'pos' : 'neg'}">${delta >= 0 ? '+' : ''}${delta.toFixed(1)}h</span>` : '';
      const breakHtml = breakMin > 0 ? `<span class="hours-break">−${breakMin}min Pause</span>` : '';
      return `<div class="hours-row" title="${events} Einsätze">
        <div class="hours-name">${_esc(emp.name)}</div>
        <div class="hours-bar-wrap">
          <div class="hours-bar" style="width:${pct}%;background:${barColor}"></div>
        </div>
        <div class="hours-nums">
          <span class="hours-gross">${gross.toFixed(1)}h</span>
          ${breakHtml}
          <span class="hours-net${breakMin > 0 ? ' has-break' : ''}">${net.toFixed(1)}h netto</span>
          ${sollMonth ? `<span class="hours-soll">/ ${sollMonth}h</span>` : ''}
          ${deltaHtml}
        </div>
      </div>`;
    }).join('');
    el.innerHTML = rows || '<div style="color:var(--txm);font-size:.8rem">Keine Mitarbeiter</div>';
  },

  _calcHours(emp) {
    const p = this._period;
    if (!p) return { gross: 0, net: 0, breakMin: 0, events: 0 };
    let gross = 0;
    let eventCount = 0;
    for (const ev of this._monthEvents) {
      const staff = this._draft[ev.id] !== undefined ? this._draft[ev.id] : (ev.barStaff || []);
      const assignment = staff.find(s => !s.miss && s.name && (s.employeeId === emp.id || s.name === emp.name));
      if (!assignment) continue;
      eventCount++;
      // Use slot-specific time if available, else event times
      const start = assignment.req_start || ev.startGastro;
      const end = assignment.req_end || ev.belegungsende;
      if (start && end) {
        gross += Shifts.calcDuration(start, end);
      }
    }
    const net = PlanningRules.calcNetHours(gross, emp.default_role || '');
    const breakMin = Math.round((gross - net) * 60);
    return {
      gross: Math.round(gross * 10) / 10,
      net: Math.round(net * 10) / 10,
      breakMin,
      events: eventCount,
    };
  },

  /* ─── Availability Tab ──────────────────────────────────── */
  async _loadAvailabilityTab() {
    const p = this._period;
    const avList = await Availability.loadAll(p.id);
    const appsList = await ShiftApplications.load(p.id);
    const emps = Employees.getAll().filter(e => e.status !== 'ausgeschieden' && e.profile_id);
    const submittedCount = emps.filter(emp => avList.find(a => a.employee_id === emp.id && a.submitted_at)).length;

    const rows = emps.map(emp => {
      const av = avList.find(a => a.employee_id === emp.id);
      const submitted = av?.submitted_at;
      const blocked = av?.blocked_dates?.length || 0;
      const fromTimes = Object.keys(av?.date_rules || {}).length;
      const wished = av?.wished_dates?.length || 0;
      const applied = appsList.filter(a => a.employee_id === emp.id).length;
      const wdBlocked = Object.values(av?.weekday_rules || {}).filter(r => r.blocked).length;
      const wdFrom = Object.values(av?.weekday_rules || {}).filter(r => r.from && !r.blocked).length;

      const tags = [
        blocked ? `<span class="av-tag blocked">${blocked} blockiert</span>` : '',
        fromTimes ? `<span class="av-tag from-time">${fromTimes} ab Uhrzeit</span>` : '',
        wished ? `<span class="av-tag wished">★ ${wished} Wunsch</span>` : '',
        applied ? `<span class="av-tag applied">✓ ${applied} beworben</span>` : '',
        wdBlocked ? `<span class="av-tag wd-blocked">${wdBlocked} Wochentage gesperrt</span>` : '',
        wdFrom ? `<span class="av-tag wd-from">${wdFrom} Wochentage ab Uhrzeit</span>` : '',
      ].filter(Boolean).join('');

      return `<div class="av-emp-row">
        <div class="av-emp-name">${_esc(emp.name)}</div>
        <div class="av-emp-status ${submitted ? 'submitted' : 'pending'}">
          ${submitted ? `✓ Eingereicht ${new Date(submitted).toLocaleDateString('de-DE')}` : '⏳ Ausstehend'}
        </div>
        <div class="av-emp-tags">${tags || '<span style="font-size:.75rem;color:var(--txm)">Keine Einschränkungen</span>'}</div>
        <button class="btn btn-ghost" style="font-size:.72rem;padding:3px 8px"
          onclick="Planner._showAvDetail('${emp.id}','${p.id}')">Details</button>
      </div>`;
    }).join('') || '<div style="color:var(--txm);font-size:.83rem">Keine Mitarbeiter mit Zugang.</div>';

    const body = document.getElementById('planner-root')?.querySelector('.planner-body');
    if (body) body.innerHTML = `<div class="plan-section">
      <div class="plan-sec-title">Verfügbarkeiten ${MONS[p.month - 1]} ${p.year}</div>
      <div style="font-size:.83rem;color:var(--txm);margin-bottom:14px">${submittedCount} / ${emps.length} eingereicht</div>
      <div class="av-emp-list">${rows}</div>
    </div>`;
  },

  _showAvDetail(empId, periodId) {
    const emp = Employees.getById(empId);
    const av = Availability.get(periodId, empId);
    const p = Planning.getAll().find(x => x.id === periodId);
    const appsList = ShiftApplications.getForEmployee(periodId, empId);
    if (!emp || !p) return;

    const blocked = av.blocked_dates || [];
    const dateRules = av.date_rules || {};
    const wished = av.wished_dates || [];
    const wdRules = av.weekday_rules || {};
    const year = p.year, month = p.month - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
    const DOW = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const WD_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    let cal = '<div class="av-cal sm">' + DOW.map(d => `<div class="av-dow">${d}</div>`).join('');
    for (let i = 0; i < firstDow; i++) cal += '<div></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isBlocked = blocked.includes(ds);
      const fromTime = dateRules[ds]?.available_from || '';
      const isWished = wished.includes(ds);
      // Check weekday rule
      const wd = new Date(ds + 'T12:00:00').getDay();
      const wdKey = wd === 0 ? 7 : wd;
      const wdRule = wdRules[wdKey] || {};
      const wdBlocked = wdRule.blocked && !isBlocked && !fromTime;
      const wdFrom = wdRule.from && !wdRule.blocked && !isBlocked && !fromTime;

      let cls = 'av-day';
      if (isBlocked) cls += ' blocked';
      else if (fromTime) cls += ' from-time';
      else if (wdBlocked) cls += ' blocked wd-rule';
      else if (wdFrom) cls += ' from-time wd-rule';
      if (isWished) cls += ' wished';

      const lbl = fromTime ? `<span class="av-day-time">${fromTime}</span>`
                : wdFrom ? `<span class="av-day-time">${wdRule.from}</span>` : '';
      const star = isWished ? '<span class="av-day-wish">★</span>' : '';
      cal += `<div class="${cls}" title="${isBlocked||wdBlocked?'Blockiert':fromTime||wdFrom?'Ab '+(fromTime||wdRule.from):'Frei'}${isWished?' · Wunsch':''}">${d}${lbl}${star}</div>`;
    }
    cal += '</div>';

    // Weekday summary
    const wdSummary = Object.entries(wdRules).filter(([, r]) => r.blocked || r.from).map(([wd, r]) => {
      const name = WD_NAMES[(parseInt(wd) - 1)] || `Wd${wd}`;
      return `<div class="av-detail-wd">${name}: ${r.blocked ? '🔴 Nie' : `🟠 Erst ab ${r.from}`}</div>`;
    }).join('') || '<span style="color:var(--txm);font-size:.78rem">Keine</span>';

    // Wish summary
    const wishSummary = wished.length
      ? wished.map(ds => `<span class="av-detail-wish">${_fmtDate(ds)}</span>`).join(' ')
      : '<span style="color:var(--txm);font-size:.78rem">Keine</span>';

    // Applications
    const appliedEvents = appsList.map(evId => {
      const ev = EVENTS.find(e => e.id === evId);
      return ev ? `<span class="av-detail-app">${_fmtDate(ev.date)} ${_esc(ev.event)}</span>` : '';
    }).join('') || '<span style="color:var(--txm);font-size:.78rem">Keine</span>';

    const ov = document.createElement('div');
    ov.className = 'simple-ov';
    ov.innerHTML = `<div class="simple-modal av-detail-modal">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <strong>${_esc(emp.name)} – Verfügbarkeit</strong>
        <button onclick="this.closest('.simple-ov').remove()" class="btn btn-ghost" style="padding:4px 10px">✕</button>
      </div>
      ${cal}
      <div class="av-detail-legend">
        <span class="av-leg-item av-leg-free">frei</span>
        <span class="av-leg-item av-leg-blocked">blockiert</span>
        <span class="av-leg-item av-leg-from">ab Uhrzeit</span>
        <span class="av-leg-item av-leg-wish">★ Wunsch</span>
        <span style="font-size:.7rem;color:var(--txm)">(gestrichelt = Wochentagsregel)</span>
      </div>
      <div class="av-detail-sections">
        <div><div class="av-detail-label">Wochentag-Regeln</div>${wdSummary}</div>
        <div><div class="av-detail-label">⭐ Wunschtermine</div>${wishSummary}</div>
        <div><div class="av-detail-label">✓ Schicht-Bewerbungen</div>${appliedEvents}</div>
      </div>
    </div>`;
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  },

  /* ─── Swaps Tab ─────────────────────────────────────────── */
  async _loadSwapsTab() {
    const { data } = await db.from('shift_swaps').select('*').order('created_at', { ascending: false });
    const allSwaps = data || [];
    const statusMap = { pending: '⏳ Ausstehend', target_approved: '✓ Ziel bestätigt', admin_review: '🔍 Admin-Prüfung', approved: '✅ Genehmigt', rejected: '❌ Abgelehnt' };
    const rows = allSwaps.map(s => {
      const req = s.requester_id ? Employees.getById(s.requester_id) : null;
      const tgt = s.target_id ? Employees.getById(s.target_id) : null;
      return `<div class="swap-row">
        <div class="swap-names">${_esc(req?.name || '?')} ↔ ${_esc(tgt?.name || '?')}</div>
        <div class="swap-status">${statusMap[s.status] || s.status}</div>
        ${s.requester_note ? `<div class="swap-note">"${_esc(s.requester_note)}"</div>` : ''}
        <div class="swap-acts">
          ${s.status === 'target_approved' ? `<button class="btn btn-primary" style="font-size:.72rem" onclick="Planner._approveSwap('${s.id}')">Genehmigen</button>` : ''}
          ${s.status !== 'approved' && s.status !== 'rejected' ? `<button class="btn btn-ghost" style="font-size:.72rem;color:var(--miss)" onclick="Planner._rejectSwap('${s.id}')">Ablehnen</button>` : ''}
        </div>
      </div>`;
    }).join('');
    const body = document.getElementById('planner-root')?.querySelector('.planner-body');
    if (body) body.innerHTML = `<div class="plan-section">
      <div class="plan-sec-title">Schichttausch-Anfragen</div>
      ${allSwaps.length ? `<div class="swap-list">${rows}</div>` : '<div style="color:var(--txm);font-size:.83rem">Keine Tauschanfragen vorhanden.</div>'}
    </div>`;
  },

  /* ─── Rules Tab ─────────────────────────────────────────── */
  _renderRules() {
    return `<div class="plan-section">
      <div class="plan-sec-title">Regelwerk (nach Rolle)</div>
      <p style="font-size:.82rem;color:var(--txm);margin-bottom:14px">
        Definiere Stunden-Limits und Pausenabzüge für jede Rolle.</p>
      <span id="pr-save-msg" style="font-size:.78rem;color:#22d4a4;display:none;margin-bottom:10px">✓ Gespeichert</span>
      <div id="pr-editor"></div>
    </div>`;
  },

  /* ─── Assignment Editor ─────────────────────────────────── */
  _openPicker(evId, slotIdx) {
    const ev = EVENTS.find(e => e.id === evId);
    if (!ev) return;
    const staff = this._draft[evId] !== undefined ? this._draft[evId] : this._getSlotsForEvent(ev);
    const slot = staff[slotIdx];
    const occupied = new Set(staff.filter((s, i) => i !== slotIdx && !s.miss && s.name).map(s => s.name));
    const emps = Employees.getAll().filter(e => e.status !== 'ausgeschieden');
    const p = this._period;

    const empRows = emps.map(emp => {
      const blockedByAv = p ? Availability.isBlocked(p.id, emp.id, ev.date) : false;
      const avFrom = p ? Availability.getDateState(p.id, emp.id, ev.date) : null;
      const isWished = p ? Availability.isWished(p.id, emp.id, ev.date) : false;
      const conflict = this._monthEvents.some(other => other.id !== evId && other.date === ev.date &&
        (this._draft[other.id] !== undefined ? this._draft[other.id] : (other.barStaff || []))
          .some(s => !s.miss && (s.name === emp.name || s.employeeId === emp.id)));
      const bg = emp.color || '#555';
      const hasApplied = p ? ShiftApplications.hasApplied(p.id, emp.id, evId) : false;
      const fromWarn = avFrom && avFrom !== 'blocked' ? `<span class="picker-warn warn-from">🟠 Erst ab ${avFrom}</span>` : '';
      return `<div class="picker-emp-row${occupied.has(emp.name) ? ' already-assigned' : ''}${blockedByAv ? ' blocked-av' : ''}${conflict ? ' conflict-day' : ''}${isWished ? ' is-wished' : ''}"
        onclick="${!occupied.has(emp.name) ? `Planner._assignSlot('${evId}',${slotIdx},'${emp.id}')` : ''}">
        <span class="emp-badge sm" style="background:${bg};color:${_contrastColor(bg)}">${emp.kuerzel || '?'}</span>
        <span class="picker-name">${_esc(emp.name)}</span>
        ${isWished ? '<span class="picker-wish">⭐ Wunsch</span>' : ''}
        ${hasApplied ? '<span class="picker-applied">✓ Beworben</span>' : ''}
        ${blockedByAv ? '<span class="picker-warn">🔴 Nicht verfügbar</span>' : fromWarn}
        ${conflict ? '<span class="picker-warn">⚠ Anderer Event</span>' : ''}
        ${occupied.has(emp.name) ? '<span style="color:var(--txm);font-size:.7rem">bereits zugeteilt</span>' : ''}
      </div>`;
    }).join('');

    const ov = document.createElement('div');
    ov.id = 'picker-ov';
    ov.className = 'simple-ov';
    ov.innerHTML = `<div class="simple-modal picker-modal">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <strong>Zuteilung – ${_esc(ev.event)} · Pos ${slot?.pos || slotIdx + 1}</strong>
        <button onclick="document.getElementById('picker-ov').remove()" class="btn btn-ghost" style="padding:4px 10px">✕</button>
      </div>
      <div style="max-height:360px;overflow-y:auto">${empRows}</div>
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--bd)">
        <button class="btn btn-ghost" style="font-size:.78rem" onclick="Planner._clearSlot('${evId}',${slotIdx})">Slot leeren</button>
      </div>
    </div>`;
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  },

  // Returns the effective slot list for an event (required_staff → slots, else auto from roles)
  _getSlotsForEvent(ev) {
    const reqStaff = ev.required_staff || [];
    if (reqStaff.length) {
      let pos = 1;
      const slots = [];
      for (const req of reqStaff) {
        for (let i = 0; i < req.count; i++) {
          const assigned = (ev.barStaff || []).find(s => s.pos === pos && !s.miss);
          slots.push(assigned || { pos, name: null, miss: true, role: req.role, req_start: req.start_time, req_end: req.end_time });
          pos++;
        }
      }
      return slots;
    }
    const barStaff = ev.barStaff || [];
    const roles = Config.data.employeeRoles || [];
    if (roles.length && !barStaff.some(s => !s.miss)) {
      return roles.map((role, i) => ({
        pos: i + 1, name: null, miss: true, role,
        req_start: ev.startGastro || null,
        req_end: ev.schlussShow || null,
      }));
    }
    return barStaff;
  },

  _assignSlot(evId, slotIdx, empId) {
    const ev = EVENTS.find(e => e.id === evId);
    if (!ev) return;
    const emp = Employees.getById(empId);
    if (!emp) return;

    if (!this._draft[evId]) {
      this._draft[evId] = JSON.parse(JSON.stringify(this._getSlotsForEvent(ev)));
      if (!this._draft[evId].length) {
        this._draft[evId] = [{ pos: 1, name: null, miss: true }];
      }
    }
    if (!this._draft[evId][slotIdx]) {
      this._draft[evId][slotIdx] = { pos: slotIdx + 1, name: null, miss: true };
    }
    this._draft[evId][slotIdx].name = emp.name;
    this._draft[evId][slotIdx].employeeId = emp.id;
    this._draft[evId][slotIdx].miss = false;

    document.getElementById('picker-ov')?.remove();
    this._saveDraft();
    this._refreshAssignmentsView();
  },

  _clearSlot(evId, slotIdx) {
    if (!this._draft[evId]) {
      const ev = EVENTS.find(e => e.id === evId);
      this._draft[evId] = JSON.parse(JSON.stringify(this._getSlotsForEvent(ev)));
    }
    if (this._draft[evId][slotIdx]) {
      this._draft[evId][slotIdx].name = null;
      this._draft[evId][slotIdx].employeeId = null;
      this._draft[evId][slotIdx].miss = true;
    }
    document.getElementById('picker-ov')?.remove();
    this._saveDraft();
    this._refreshAssignmentsView();
  },

  _removeSlot(evId, slotIdx) {
    if (!this._draft[evId]) {
      const ev = EVENTS.find(e => e.id === evId);
      this._draft[evId] = JSON.parse(JSON.stringify(this._getSlotsForEvent(ev)));
    }
    this._draft[evId].splice(slotIdx, 1);
    this._draft[evId].forEach((s, i) => { s.pos = i + 1; });
    this._saveDraft();
    this._refreshAssignmentsView();
  },

  _addSlot(evId) {
    const ev = EVENTS.find(e => e.id === evId);
    if (!this._draft[evId]) {
      this._draft[evId] = JSON.parse(JSON.stringify(this._getSlotsForEvent(ev)));
    }
    const pos = (this._draft[evId].length || 0) + 1;
    this._draft[evId].push({ pos, name: null, miss: true });
    this._saveDraft();
    this._refreshAssignmentsView();
  },

  _refreshAssignmentsView() {
    const list = document.getElementById('assign-events-list');
    if (!list) return;
    const p = this._period;
    const isEditing = p.status !== 'published';
    list.innerHTML = this._monthEvents.map(ev => this._buildEventAssignCard(ev, isEditing)).join('');
    this._renderHoursSidebar();
  },

  async _saveDraft() {
    const p = this._period;
    if (!p) return;
    try {
      await Planning.update(p.id, { proposed_assignments: this._draft });
    } catch (e) { console.warn('[Planner] draft save error:', e.message); }
  },

  /* ─── AI ────────────────────────────────────────────────── */
  async _aiPreflight() {
    const btn = document.getElementById('ai-pre-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Analysiere…'; }
    try {
      const token = (await db.auth.getSession()).data?.session?.access_token;
      const p = this._period;
      const emps = Employees.getAll().filter(e => e.status !== 'ausgeschieden');
      const avList = await Availability.loadAll(p.id);
      const resp = await fetch('/api/ai-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'preflight', payload: {
          period: p,
          events: this._monthEvents,
          employees: emps,
          availability: avList,
          selectedRoles: this._selectedRoles,
        }}),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Fehler');
      this._aiReport = data.report;
    } catch (e) {
      alert('Fehler bei der Analyse: ' + e.message);
    }
    const aiArea = document.getElementById('planner-ai-area');
    if (aiArea) aiArea.innerHTML = this._renderAIArea();
  },

  async _aiGenerate() {
    const btn = document.getElementById('ai-gen-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generiere Plan…'; }
    const answers = document.getElementById('ai-answers')?.value || '';
    try {
      const token = (await db.auth.getSession()).data?.session?.access_token;
      const p = this._period;
      const emps = Employees.getAll().filter(e => e.status !== 'ausgeschieden');
      const avList = await Availability.loadAll(p.id);
      const appsList = await ShiftApplications.load(p.id);
      const resp = await fetch('/api/ai-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'generate', payload: {
          period: p, events: this._monthEvents, employees: emps,
          availability: avList, applications: appsList, answers,
          selectedRoles: this._selectedRoles,
        }}),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Fehler');
      if (!data.assignments) throw new Error('Keine Zuteilungen erhalten');

      const snapshot = JSON.stringify(EVENTS);
      await Planning.update(p.id, { plan_snapshot: snapshot });

      this._draft = data.assignments;
      await this._saveDraft();
      await Planning.update(p.id, { status: 'ai_proposal' });
      this._period.status = 'ai_proposal';
      this._aiReport = null;

      alert(`✓ KI-Plan generiert! ${Object.keys(this._draft).length} Events wurden zugeteilt.\nWechsle zum Tab "Besetzung" zum Bearbeiten.`);
      this._tab = 'assignments';
      this._render();
    } catch (e) {
      alert('Fehler bei der Plan-Generierung: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = '🤖 Plan generieren'; }
    }
  },

  /* ─── Publish ───────────────────────────────────────────── */
  async publish() {
    const p = this._period;
    if (!p) return;
    if (!confirm(`Plan für ${MONS[p.month - 1]} ${p.year} veröffentlichen?\n\nAlle Entwurf-Zuteilungen werden in die Event-Besetzung übernommen.`)) return;

    try {
      let changed = 0;
      for (const [evId, staff] of Object.entries(this._draft)) {
        const ev = EVENTS.find(e => e.id === evId);
        if (ev) { ev.barStaff = staff; changed++; }
      }
      if (changed) await Cloud.push();

      await Planning.update(p.id, { status: 'published', proposed_assignments: null });
      this._period.status = 'published';
      this._draft = {};

      App.render();
      alert(`✅ Plan veröffentlicht! ${changed} Events aktualisiert.`);
      this._tab = 'overview';
      this._render();
    } catch (e) { alert('Fehler: ' + e.message); }
  },

  /* ─── Swap Actions ──────────────────────────────────────── */
  async _approveSwap(swapId) {
    const { data: swap, error } = await db.from('shift_swaps').select('*').eq('id', swapId).single();
    if (error || !swap) { alert('Fehler beim Laden'); return; }
    const evA = EVENTS.find(e => swap.event_id_a && e.id === swap.event_id_a);
    const evB = EVENTS.find(e => swap.event_id_b && e.id === swap.event_id_b);
    const empA = Employees.getById(swap.requester_id);
    const empB = Employees.getById(swap.target_id);
    if (evA && evB && empA && empB) {
      const swapInStaff = (staff, from, to) => staff.forEach(s => {
        if (s.name === from.name || s.employeeId === from.id) { s.name = to.name; s.employeeId = to.id; }
      });
      swapInStaff(evA.barStaff || [], empA, empB);
      swapInStaff(evB.barStaff || [], empB, empA);
      await Cloud.push();
    }
    await db.from('shift_swaps').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', swapId);
    App.render();
    this._tab = 'swaps';
    this._render();
  },

  async _rejectSwap(swapId) {
    await db.from('shift_swaps').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', swapId);
    this._tab = 'swaps';
    this._render();
  },

  /* ─── Helpers ───────────────────────────────────────────── */
  async _advanceStatus(newStatus) {
    await Planning.update(this._period.id, { status: newStatus });
    this._period.status = newStatus;
    if (newStatus === 'collecting') {
      await Availability.loadAll(this._period.id);
    }
    this._render();
    Planning.renderBanner();
  },

  async _createPeriod() {
    const month = parseInt(document.getElementById('pn-month').value);
    const year = parseInt(document.getElementById('pn-year').value);
    const deadline = document.getElementById('pn-deadline').value || null;
    const notes = document.getElementById('pn-notes').value.trim() || null;
    const err = document.getElementById('pn-err');
    if (!month || !year) { err.textContent = 'Monat und Jahr sind Pflicht.'; err.style.display = ''; return; }
    try {
      const p = await Planning.create(month, year, deadline, notes);
      await this.open(p.id);
      Planning.renderBanner();
    } catch (e) { err.textContent = 'Fehler: ' + e.message; err.style.display = ''; }
  },

  async _deletePeriod() {
    if (!confirm('Planungszeitraum löschen? Alle zugehörigen Daten werden gelöscht.')) return;
    try {
      await Planning.deletePeriod(this._period.id);
      this._period = Planning.getActive();
      this._draft = {};
      this._monthEvents = [];
      Planning.renderBanner();
      await this.open();
    } catch (e) { alert('Fehler: ' + e.message); }
  },

  _editEvent(evId) {
    const ev = EVENTS.find(e => e.id === evId);
    if (!ev) return;
    this.close();
    App.openEntry(ev.location);
    Form.load(ev);
  },

  _showNewPeriod() {
    this._tab = 'new';
    this._render();
  },
};

/* ---- Shift Swap (employee-facing) ------------------------- */
const ShiftSwap = {
  async requestSwap(myEmpId, myEventId, targetEmpId, targetEventId, note) {
    const { data, error } = await db.from('shift_swaps').insert({
      requester_id: myEmpId, target_id: targetEmpId,
      event_id_a: myEventId, event_id_b: targetEventId,
      requester_note: note || null, status: 'pending',
    }).select().single();
    if (error) throw error;
    return data;
  },

  async approveAsTarget(swapId) {
    const { error } = await db.from('shift_swaps').update({
      status: 'target_approved', updated_at: new Date().toISOString()
    }).eq('id', swapId);
    if (error) throw error;
  },

  async loadForEmployee(empId) {
    const { data } = await db.from('shift_swaps').select('*')
      .or(`requester_id.eq.${empId},target_id.eq.${empId}`)
      .order('created_at', { ascending: false });
    return data || [];
  },

  async renderProfileSwaps(empId, container) {
    if (!container) return;
    const swaps = await this.loadForEmployee(empId);
    const pendingTarget = swaps.filter(s => s.target_id === empId && s.status === 'pending');
    if (!pendingTarget.length && !swaps.length) { container.innerHTML = ''; return; }
    const statusMap = { pending: '⏳ Ausstehend', target_approved: '✓ Bestätigt', admin_review: '🔍 Admin', approved: '✅ Genehmigt', rejected: '❌ Abgelehnt' };
    const rows = swaps.map(s => {
      const isReq = s.requester_id === empId;
      const other = Employees.getById(isReq ? s.target_id : s.requester_id);
      return `<div class="swap-profile-row">
        <span>${isReq ? '↗ An' : '↙ Von'} ${_esc(other?.name || '?')}</span>
        <span>${statusMap[s.status] || s.status}</span>
        ${!isReq && s.status === 'pending' ? `<button class="btn btn-primary" style="font-size:.72rem" onclick="ShiftSwap.approveAsTarget('${s.id}').then(()=>ShiftSwap.renderProfileSwaps('${empId}',document.getElementById('profil-swaps')))">Annehmen</button>` : ''}
      </div>`;
    }).join('');
    container.innerHTML = `<div class="swap-profile-wrap">
      <div class="stg-subsec">Schichttausch-Anfragen</div>
      ${rows}
    </div>`;
  },
};
