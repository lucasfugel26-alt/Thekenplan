/* ============================================================
   ROLES MANAGER
   Rollenverwaltung: Rollen erstellen/bearbeiten/löschen,
   Permissions per Checkbox-Matrix zuweisen,
   Rolle einem User zuweisen.
   ============================================================ */
const RolesMgr = {
  _roles: [],
  _permissions: [],
  _rolePerms: [],          // [{role_id, permission_id}]
  _roleStaffScopes: [],    // [{role_id, category}]

  /* ── LADEN ─────────────────────────────────────────────── */
  async load() {
    try {
      const session = await db.auth.getSession();
      const token = session?.data?.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/roles?action=list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      this._roles = data.roles || [];
      this._permissions = data.permissions || [];
      this._rolePerms = data.rolePerms || [];
      this._roleStaffScopes = data.roleStaffScopes || [];
    } catch (e) {
      console.warn('[RolesMgr] load:', e.message);
    }
  },

  getRoles() { return this._roles; },

  getPermissionsForRole(roleId) {
    return this._rolePerms
      .filter(rp => rp.role_id === roleId)
      .map(rp => rp.permission_id);
  },

  getScopeForRole(roleId) {
    return this._roleStaffScopes
      .filter(s => s.role_id === roleId)
      .map(s => s.category);
  },

  /* ── ROLLEN-SEKTION RENDERN ─────────────────────────────── */
  async renderSettingsSection(containerId = 'acc-roles-section') {
    const container = document.getElementById(containerId);
    if (!container) return;
    await this.load();
    container.innerHTML = this._buildSectionHTML();
  },

  _buildSectionHTML() {
    const roleRows = this._roles.map(r => {
      const permCount = this.getPermissionsForRole(r.id).length;
      return `<div class="roles-row">
        <span class="role-pill" style="background:${r.color}22;color:${r.color};border:1px solid ${r.color}44">
          ${_esc(r.name)}${r.is_system ? ' 🔒' : ''}
        </span>
        <span style="font-size:.78rem;color:var(--txm)">${permCount} Rechte</span>
        ${r.description ? `<span style="font-size:.75rem;color:var(--txd);flex:1">${_esc(r.description)}</span>` : '<span style="flex:1"></span>'}
        <div style="display:flex;gap:6px">
          ${can(PERM.ROLES_EDIT) ? `<button class="btn btn-ghost" style="font-size:.72rem;padding:4px 10px"
            onclick="RolesMgr.openEdit('${r.id}')">&#9998; Bearbeiten</button>` : ''}
          ${can(PERM.ROLES_DELETE) && !r.is_system ? `<button class="btn btn-ghost" style="font-size:.72rem;padding:4px 8px;color:var(--miss);border-color:rgba(255,80,80,.3)"
            onclick="RolesMgr.deleteRole('${r.id}','${_esc(r.name)}')" title="Löschen">&#128465;</button>` : ''}
        </div>
      </div>`;
    }).join('');

    return `
      <div class="stg-section-head">
        <h3 style="margin:0;font-size:.95rem">Rollen &amp; Rechte</h3>
        ${can(PERM.ROLES_CREATE) ? `<button class="btn btn-ghost" style="font-size:.78rem;padding:5px 12px"
          onclick="RolesMgr.openCreate()">&#43; Neue Rolle</button>` : ''}
      </div>
      <div class="roles-list">${roleRows || '<div style="color:var(--txm);font-size:.82rem">Keine Rollen gefunden.</div>'}</div>
    `;
  },

  /* ── ROLLE ERSTELLEN ────────────────────────────────────── */
  openCreate() {
    this._openModal({
      title: 'Neue Rolle erstellen',
      roleId: null,
      name: '',
      description: '',
      color: '#6b7280',
      permissionIds: [],
      scopeCategories: [],
    });
  },

  /* ── ROLLE BEARBEITEN ───────────────────────────────────── */
  async openEdit(roleId) {
    // Neu laden falls Daten fehlen (z.B. nach Page-Reload)
    if (!this._roles.length || !this._permissions.length) await this.load();
    const role = this._roles.find(r => r.id === roleId);
    if (!role) return;
    this._openModal({
      title: `Rolle bearbeiten: ${role.name}`,
      roleId: role.id,
      name: role.name,
      description: role.description || '',
      color: role.color || '#6b7280',
      permissionIds: this.getPermissionsForRole(roleId),
      scopeCategories: this.getScopeForRole(roleId),
      isSystem: role.is_system,
    });
  },

  _openModal({ title, roleId, name, description, color, permissionIds, scopeCategories, isSystem }) {
    const modal = document.getElementById('roles-modal');
    if (!modal) return;

    // Permissions nach Kategorie gruppieren
    const categories = {};
    this._permissions.forEach(p => {
      if (!categories[p.category]) categories[p.category] = [];
      categories[p.category].push(p);
    });

    const categoryLabels = {
      events: 'Veranstaltungen', staff: 'Mitarbeiter', shifts: 'Schichten',
      planning: 'Dienstplanung', calendar: 'Kalender', statistics: 'Statistiken',
      visitors: 'Besucherzahlen', customer_cards: 'Kundenkarten', settings: 'Einstellungen',
      roles: 'Rollenverwaltung', users: 'Benutzerverwaltung', chat: 'Chat',
    };

    const permMatrix = Object.entries(categories).map(([cat, perms]) => {
      const rows = perms.map(p => {
        const checked = permissionIds.includes(p.id) ? 'checked' : '';
        const disabled = isSystem ? 'disabled' : '';
        return `<label class="perm-row">
          <input type="checkbox" value="${p.id}" ${checked} ${disabled} onchange="RolesMgr._onPermChange()">
          <span class="perm-label">${_esc(p.label)}</span>
          ${p.description ? `<span class="perm-desc">${_esc(p.description)}</span>` : ''}
        </label>`;
      }).join('');
      return `<div class="perm-category">
        <div class="perm-cat-head">
          <strong>${_esc(categoryLabels[cat] || cat)}</strong>
          ${!isSystem ? `<label style="font-size:.72rem;cursor:pointer">
            <input type="checkbox" class="perm-cat-all" data-cat="${cat}"
              onchange="RolesMgr._toggleCategory('${cat}',this.checked)">
            alle
          </label>` : ''}
        </div>
        ${rows}
      </div>`;
    }).join('');

    // Scope-Checkboxen aus Config.data.employeeRoles (dynamisch)
    const allCategories = Config.data.employeeRoles || [];
    const scopeChecks = allCategories.map(cat => {
      const checked = scopeCategories.includes(cat) ? 'checked' : '';
      const disabled = isSystem ? 'disabled' : '';
      return `<label class="scope-cat-label">
        <input type="checkbox" class="scope-cat-cb" value="${_esc(cat)}" ${checked} ${disabled}>
        <span>${_esc(cat)}</span>
      </label>`;
    }).join('');

    document.getElementById('roles-modal-title').textContent = title;
    document.getElementById('roles-modal-body').innerHTML = `
      <div style="display:grid;gap:12px">
        <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end">
          <div>
            <label class="stg-label">Name</label>
            <input id="rm-name" class="stg-input" value="${_esc(name)}" placeholder="z.B. Schichtleiter" ${isSystem ? 'disabled' : ''}>
          </div>
          <div>
            <label class="stg-label">Farbe</label>
            <input type="color" id="rm-color" value="${color}" style="width:44px;height:36px;border:none;border-radius:6px;cursor:pointer;padding:2px" ${isSystem ? 'disabled' : ''}>
          </div>
        </div>
        <div>
          <label class="stg-label">Beschreibung (optional)</label>
          <input id="rm-desc" class="stg-input" value="${_esc(description)}" placeholder="Kurze Beschreibung" ${isSystem ? 'disabled' : ''}>
        </div>
        <div>
          <label class="stg-label" style="margin-bottom:4px">Dienstplan-Scope</label>
          <div style="font-size:.75rem;color:var(--txm);margin-bottom:8px">
            Welche Mitarbeiterkategorien darf diese Rolle sehen und bearbeiten?
            <strong>Keine Auswahl = Vollzugriff</strong> (alle Kategorien).
          </div>
          ${allCategories.length === 0
            ? '<div style="font-size:.78rem;color:var(--txm)">Keine Kategorien definiert (Einstellungen → Mitarbeiterkategorien).</div>'
            : `<div class="scope-cat-list">${scopeChecks}</div>`
          }
        </div>
        <div>
          <label class="stg-label" style="margin-bottom:8px">Berechtigungen</label>
          ${isSystem ? '<div style="font-size:.78rem;color:var(--txm);margin-bottom:8px">🔒 System-Rolle – Rechte können nicht geändert werden.</div>' : ''}
          <div class="perm-matrix">${permMatrix}</div>
        </div>
      </div>
    `;

    document.getElementById('roles-modal-save').onclick = () => this._saveModal(roleId, isSystem);
    document.getElementById('roles-modal-save').style.display = isSystem ? 'none' : '';
    modal.style.display = 'flex';
    this._updateCategoryCheckboxes();
  },

  _onPermChange() {
    this._updateCategoryCheckboxes();
  },

  _updateCategoryCheckboxes() {
    document.querySelectorAll('.perm-cat-all').forEach(allCb => {
      const cat = allCb.dataset.cat;
      const cbs = document.querySelectorAll(`.perm-row input[type=checkbox][value]`);
      const catPerms = this._permissions.filter(p => p.category === cat);
      const catIds = new Set(catPerms.map(p => p.id));
      const relevantCbs = Array.from(cbs).filter(cb => catIds.has(cb.value));
      const allChecked = relevantCbs.every(cb => cb.checked);
      allCb.checked = allChecked;
      allCb.indeterminate = !allChecked && relevantCbs.some(cb => cb.checked);
    });
  },

  _toggleCategory(cat, checked) {
    const catPerms = this._permissions.filter(p => p.category === cat);
    const catIds = new Set(catPerms.map(p => p.id));
    document.querySelectorAll('.perm-row input[type=checkbox]').forEach(cb => {
      if (catIds.has(cb.value)) cb.checked = checked;
    });
    this._updateCategoryCheckboxes();
  },

  closeModal() {
    const modal = document.getElementById('roles-modal');
    if (modal) modal.style.display = 'none';
  },

  async _saveModal(roleId, isSystem) {
    if (isSystem) return;
    const name = document.getElementById('rm-name')?.value?.trim();
    const description = document.getElementById('rm-desc')?.value?.trim();
    const color = document.getElementById('rm-color')?.value || '#6b7280';
    if (!name) { alert('Name ist erforderlich.'); return; }

    const checkedBoxes = document.querySelectorAll('.perm-row input[type=checkbox]:checked');
    const permissionIds = Array.from(checkedBoxes).map(cb => cb.value);

    const session = await db.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) return;

    const btn = document.getElementById('roles-modal-save');
    btn.disabled = true;
    btn.textContent = 'Speichern…';

    try {
      let targetRoleId = roleId;

      if (!roleId) {
        // Neue Rolle erstellen
        const createRes = await fetch('/api/roles?action=createRole', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name, description, color }),
        });
        const created = await createRes.json();
        if (!createRes.ok) { alert('Fehler: ' + (created.error || 'Unbekannt')); return; }
        targetRoleId = created[0]?.id || created.id;
      } else {
        // Bestehende Rolle updaten
        const updRes = await fetch('/api/roles?action=updateRole', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ roleId, name, description, color }),
        });
        if (!updRes.ok) { const e = await updRes.json(); alert('Fehler: ' + (e.error || 'Unbekannt')); return; }
      }

      // Permissions setzen
      const permRes = await fetch('/api/roles?action=setRolePermissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roleId: targetRoleId, permissionIds }),
      });
      if (!permRes.ok) { const e = await permRes.json(); alert('Fehler Permissions: ' + (e.error || 'Unbekannt')); return; }

      // Dienstplan-Scope setzen
      const scopeCategories = Array.from(
        document.querySelectorAll('.scope-cat-cb:checked')
      ).map(cb => cb.value);
      const scopeRes = await fetch('/api/roles?action=setRoleStaffScope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roleId: targetRoleId, categories: scopeCategories }),
      });
      if (!scopeRes.ok) { const e = await scopeRes.json(); alert('Fehler Scope: ' + (e.error || 'Unbekannt')); return; }

      this.closeModal();
      await this.renderSettingsSection();

    } finally {
      btn.disabled = false;
      btn.textContent = 'Speichern';
    }
  },

  async deleteRole(roleId, roleName) {
    if (!confirm(`Rolle "${roleName}" wirklich löschen?\nAlle Nutzer mit dieser Rolle werden zur Mitarbeiter-Rolle verschoben.`)) return;

    const session = await db.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) return;

    const r = await fetch('/api/roles?action=deleteRole', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ roleId }),
    });
    const data = await r.json();
    if (!r.ok) { alert('Fehler: ' + (data.error || 'Unbekannt')); return; }
    await this.renderSettingsSection();
  },

  /* ── ROLLE ZUWEISEN (User-Liste) ────────────────────────── */
  async openAssign(userId, currentRoleId) {
    if (!this._roles.length) await this.load();
    const modal = document.getElementById('roles-assign-modal');
    if (!modal) return;
    const select = document.getElementById('ram-role-select');
    if (select) {
      select.innerHTML = this._roles.map(r =>
        `<option value="${r.id}" ${r.id === currentRoleId ? 'selected' : ''}>${_esc(r.name)}</option>`
      ).join('');
    }
    document.getElementById('ram-save').onclick = () => this._saveAssign(userId);
    modal.style.display = 'flex';
  },

  closeAssignModal() {
    const modal = document.getElementById('roles-assign-modal');
    if (modal) modal.style.display = 'none';
  },

  async _saveAssign(userId) {
    const roleId = document.getElementById('ram-role-select')?.value;
    if (!roleId) return;

    const session = await db.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) return;

    const btn = document.getElementById('ram-save');
    btn.disabled = true;
    btn.textContent = 'Speichern…';

    try {
      const r = await fetch('/api/admin?action=updateUserRole', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, roleId }),
      });
      const data = await r.json();
      if (!r.ok) { alert('Fehler: ' + (data.error || 'Unbekannt')); return; }
      this.closeAssignModal();
      // Cache leeren damit _loadUsersList() frische Rollendaten verwendet
      this._roles = [];
      await App._loadUsersList();
    } finally {
      btn.disabled = false;
      btn.textContent = 'Speichern';
    }
  },
};
