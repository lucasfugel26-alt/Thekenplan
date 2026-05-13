/* ============================================================
   CHAT MODULE
   SQL (run once in Supabase SQL editor):
   CREATE TABLE IF NOT EXISTS event_messages (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     event_id TEXT NOT NULL,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     display_name TEXT NOT NULL,
     message TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   CREATE INDEX IF NOT EXISTS event_messages_event_id_idx ON event_messages(event_id);
   ALTER TABLE event_messages ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "auth_read" ON event_messages FOR SELECT TO authenticated USING (true);
   CREATE POLICY "auth_insert" ON event_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
   CREATE POLICY "admin_delete" ON event_messages FOR DELETE TO authenticated USING (
     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
   );
   ============================================================ */
const Chat={
  _sub:null,
  _evId:null,
  _notifSub:null,

  // Check if current user can access this event's chat
  canAccess(ev){
    if(!currentUser)return false;
    if(can(PERM.CHAT_ACCESS_ALL))return true;
    // Use employee name (primary) — barStaff names come from employees.name, not display_name
    const myEmp=Employees.getAll().find(e=>e.profile_id===currentUser.id);
    const myName=(myEmp?.name||currentProfile?.display_name||'').toLowerCase().trim();
    if(!myName)return false;
    if(ev.barStaff?.some(s=>!s.miss&&s.name?.toLowerCase()===myName))return true;
    if(ev.prodL?.name?.toLowerCase()===myName)return true;
    if(ev.prodL2?.name?.toLowerCase()===myName)return true;
    return false;
  },

  // localStorage key for last-seen timestamps
  _seenKey:'tkp_chat_seen',
  _seen(){try{return JSON.parse(localStorage.getItem(this._seenKey)||'{}');}catch{return{};}},
  _markSeen(evId){const s=this._seen();s[evId]=new Date().toISOString();localStorage.setItem(this._seenKey,JSON.stringify(s));},
  hasUnread(evId){
    const seen=this._seen()[evId];
    const latest=this._latestMsg[evId];
    if(!latest)return false;
    if(!seen)return true;
    return latest>seen;
  },
  _latestMsg:{}, // evId -> ISO timestamp of newest message

  // Load latest message timestamps for all accessible events, then refresh UI
  async loadUnreadState(){
    if(!currentUser)return;
    const myEvIds=EVENTS.filter(ev=>this.canAccess(ev)).map(ev=>ev.id);
    if(!myEvIds.length)return;
    // Query latest message per event in one go
    const{data}=await db.from('event_messages')
      .select('event_id,created_at')
      .in('event_id',myEvIds)
      .order('created_at',{ascending:false});
    if(!data)return;
    const latest={};
    data.forEach(r=>{if(!latest[r.event_id])latest[r.event_id]=r.created_at;});
    this._latestMsg=latest;
    this._refreshDots();
  },

  _refreshDots(){
    // Update dots on week-view cards and calendar panel buttons
    document.querySelectorAll('[data-chat-dot]').forEach(el=>{
      const evId=el.dataset.chatDot;
      el.style.display=this.hasUnread(evId)?'inline-block':'none';
    });
  },

  // Subscribe to unread notifications for all accessible events
  subscribeNotifs(){
    if(this._notifSub)try{db.removeChannel(this._notifSub);}catch(e){}
    if(!currentUser)return;
    const myEvIds=EVENTS.filter(ev=>this.canAccess(ev)).map(ev=>ev.id);
    if(!myEvIds.length)return;
    this._notifSub=db.channel('chat-notifs-'+currentUser.id)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'event_messages'},
        payload=>{
          const evId=payload.new?.event_id;
          if(!evId||!myEvIds.includes(evId))return;
          // Don't mark unread if it's own message or chat is currently open for this event
          if(payload.new.user_id===currentUser.id)return;
          if(this._evId===evId)return;
          this._latestMsg[evId]=payload.new.created_at;
          this._refreshDots();
        })
      .subscribe();
  },

  renderSection(ev){
    const el=document.getElementById('m-chat');
    if(!el)return;
    Chat.unsubscribe();
    if(!this.canAccess(ev)){el.innerHTML='';return;}
    el.innerHTML=`<div class="chat-section">
      <div class="m-sh">Team Chat</div>
      <div class="chat-msgs" id="m-chat-msgs"><div class="chat-empty">Lade Nachrichten…</div></div>
      <div class="chat-input-row">
        <input class="chat-inp" type="text" id="m-chat-inp" placeholder="Nachricht eingeben…"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();Chat.send('${ev.id}')}">
        <button class="btn btn-primary" style="font-size:.78rem;padding:6px 12px" onclick="Chat.send('${ev.id}')">Senden</button>
      </div>
    </div>`;
    this._evId=ev.id;
    this._markSeen(ev.id);
    this._refreshDots();
    this.load(ev.id);
    this.subscribe(ev.id);
  },

  async load(evId){
    const msgEl=document.getElementById('m-chat-msgs');
    if(!msgEl)return;
    const{data,error}=await db.from('event_messages').select('*').eq('event_id',evId).order('created_at',{ascending:true});
    if(error){
      if(error.code==='42P01')
        msgEl.innerHTML=can(PERM.SETTINGS_EDIT_GENERAL)?`<div class="chat-empty">⚠ Tabelle event_messages fehlt. SQL bitte im Supabase Editor ausführen.</div>`:'';
      else msgEl.innerHTML=`<div class="chat-empty">Chat momentan nicht verfügbar.</div>`;
      return;
    }
    this.renderMsgs(data);
  },

  renderMsgs(msgs){
    const el=document.getElementById('m-chat-msgs');
    if(!el)return;
    if(!msgs.length){el.innerHTML='<div class="chat-empty">Noch keine Nachrichten.</div>';return;}
    el.innerHTML=msgs.map(msg=>{
      const mine=msg.user_id===currentUser?.id;
      const canDel=mine||can(PERM.CHAT_DELETE_MESSAGES);
      const t=new Date(msg.created_at).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      return`<div class="chat-msg${mine?' mine':''}">
        <div class="chat-meta">${_esc(msg.display_name)} · ${t}</div>
        <div class="chat-bubble-row">
          ${canDel?`<button class="chat-del-btn" onclick="Chat.deleteMsg('${msg.id}')" title="Nachricht löschen">✕</button>`:''}
          <div class="chat-bubble${mine?' mine':''}">${_esc(msg.message).replace(/\n/g,'<br>')}</div>
        </div>
      </div>`;
    }).join('');
    el.scrollTop=el.scrollHeight;
    if(this._evId)this._markSeen(this._evId);
  },

  async deleteMsg(msgId){
    if(!confirm('Nachricht wirklich löschen?'))return;
    const{error}=await db.from('event_messages').delete().eq('id',msgId);
    if(error){console.error('Delete error:',error);return;}
    if(this._evId)await this.load(this._evId);
  },

  async send(evId){
    const inp=document.getElementById('m-chat-inp');
    const msg=inp?.value.trim();
    if(!msg||!currentUser)return;
    inp.value='';inp.focus();
    const{error}=await db.from('event_messages').insert({
      event_id:evId,user_id:currentUser.id,
      display_name:currentProfile?.display_name||'Unbekannt',
      message:msg,
    });
    if(error){console.error('Chat error:',error);inp.value=msg;return;}
    await this.load(evId);
  },

  subscribe(evId){
    this._sub=db.channel('chat-'+evId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'event_messages',filter:`event_id=eq.${evId}`},
        ()=>this.load(evId))
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'event_messages',filter:`event_id=eq.${evId}`},
        ()=>this.load(evId))
      .subscribe();
  },

  unsubscribe(){
    if(this._sub){try{db.removeChannel(this._sub);}catch(e){}this._sub=null;}
    this._evId=null;
  },
};

function setupRealtime(){
  db.channel('events-realtime')
    .on('postgres_changes',{event:'*',schema:'public',table:'events'},async()=>{
      const ok=await Cloud.fetch();
      if(ok){App.render();Chat.subscribeNotifs();}
    })
    .subscribe();
}
