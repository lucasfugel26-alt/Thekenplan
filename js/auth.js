/* ============================================================
   SUPABASE AUTH
   ============================================================ */
const Auth = {
  async init() {
    const {data:{session}}=await db.auth.getSession();
    db.auth.onAuthStateChange(async(event,session)=>{
      if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'){
        if(session&&!currentUser) await this._onSignIn(session.user);
        return;
      }
      if(event==='USER_UPDATED'){
        const stgOpen=document.getElementById('stg-page')?.style.display!=='none';
        document.getElementById('set-pw-screen').style.display='none';
        // Always update currentUser so the new session token is used for signOut etc.
        if(session) currentUser=session.user;
        // Only re-render the full app if settings page is not open
        if(!stgOpen&&session) await this._onSignIn(session.user);
        return;
      }
      if(event==='SIGNED_OUT') this._onSignOut();
    });
    if(session){await this._onSignIn(session.user);return true;}
    return false;
  },

  _showSetPassword(subtitle){
    document.getElementById('pw-screen').style.display='none';
    document.getElementById('app-root').style.display='none';
    document.getElementById('set-pw-screen').style.display='flex';
    document.getElementById('set-pw-err').textContent='';
    document.getElementById('set-pw-input').value='';
    document.getElementById('set-pw-confirm').value='';
    if(subtitle) document.getElementById('set-pw-sub').textContent=subtitle;
    history.replaceState(null,'',window.location.pathname);
    setTimeout(()=>document.getElementById('set-pw-input')?.focus(),100);
  },

  async setNewPassword(){
    const pw=document.getElementById('set-pw-input').value;
    const pw2=document.getElementById('set-pw-confirm').value;
    const err=document.getElementById('set-pw-err');
    const btn=document.getElementById('set-pw-btn');
    err.textContent='';
    if(pw.length<8){err.textContent='Mindestens 8 Zeichen.';return;}
    if(pw!==pw2){err.textContent='Passwörter stimmen nicht überein.';return;}
    btn.disabled=true;btn.textContent='Speichern…';
    const {error}=await db.auth.updateUser({password:pw});
    btn.disabled=false;btn.textContent='Passwort speichern';
    if(error){err.textContent='Fehler: '+error.message;return;}
    // USER_UPDATED event will handle the sign-in
  },

  async _onSignIn(user){
    currentUser=user;
    const {data}=await db.from('profiles').select('*').eq('id',user.id).single();
    currentProfile=data;
    document.getElementById('pw-screen').style.display='none';
    document.getElementById('set-pw-screen').style.display='none';
    document.getElementById('app-root').style.display='block';
    applyAdminMode();
    App._start();
  },

  _checkUrlError(){
    const hash=window.location.hash;
    if(hash.includes('error_code=otp_expired')){
      document.getElementById('pw-err').textContent='Der Link ist abgelaufen. Bitte einen neuen Link generieren lassen.';
      history.replaceState(null,'',window.location.pathname);
    } else if(hash.includes('error=access_denied')){
      document.getElementById('pw-err').textContent='Ungültiger Link. Bitte einen neuen Link anfordern.';
      history.replaceState(null,'',window.location.pathname);
    }
  },

  _onSignOut(){
    currentUser=null;
    currentProfile=null;
    EVENTS.length=0;
    document.getElementById('app-root').style.display='none';
    document.getElementById('pw-screen').style.display='flex';
    applyAdminMode();
    setTimeout(()=>document.getElementById('pw-email')?.focus(),100);
  },

  async submit(){
    const email=(document.getElementById('pw-email').value||'').trim();
    const password=document.getElementById('pw-input').value;
    const err=document.getElementById('pw-err');
    err.textContent='';
    if(!email||!password){err.textContent='Bitte E-Mail und Passwort eingeben.';return;}
    const btn=document.querySelector('#pw-screen button');
    if(btn){btn.disabled=true;btn.textContent='Anmelden…';}
    const {error}=await db.auth.signInWithPassword({email,password});
    if(btn){btn.disabled=false;btn.textContent='Anmelden';}
    if(error){
      err.textContent='Falsche E-Mail oder Passwort.';
      document.getElementById('pw-input').value='';
    }
  },

  async logout(){
    await db.auth.signOut();
    this._onSignOut(); // explicit fallback in case event fires late
  },

  showScreen(){
    document.getElementById('pw-screen').style.display='flex';
    setTimeout(()=>document.getElementById('pw-email')?.focus(),100);
  }
};
