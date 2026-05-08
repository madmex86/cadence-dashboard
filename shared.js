console.log('shared.js v2 loaded');
async function signOut(){
  sessionStorage.removeItem('cc_user_name');
  try {
    if (typeof db !== 'undefined') await db.auth.signOut();
  } catch (e) {
    console.error('Sign out error:', e);
  } finally {
    window.location.href = 'index.html';
  }
}

const PW='Cadence4513!';
const SK='cc_hub_auth';

// Initialize Supabase Globally
const supabaseUrl = 'https://ufqiysdgmxrhonnfsgts.supabase.co';
const supabaseKey = 'sb_publishable_7mkBL1lsKUNJEmqSd2HT9Q_Z4xHoBec';
const db = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1501706688644911164/stzK50NrTNgJmOs3rL1JR2FTSnlzNA4yfi_kPzbh5JhU7ZjN8s5ViWL3541B9duwbr8Z';

async function sendDiscordAlert(title, message, color=0xE8D08A) {
  try {
    const payload = {
      embeds: [{
        title: title,
        description: message,
        color: color,
        timestamp: new Date().toISOString()
      }]
    };
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
  } catch(e) {
    console.error('Discord Webhook Failed:', e);
  }
}

async function tryLogin(){
  const email = document.getElementById('em-input').value.trim();
  const password = document.getElementById('pw-input').value;
  const err = document.getElementById('login-err');
  
  if(!email || !password){
    err.textContent = 'Please enter email and password.';
    return;
  }
  
  err.textContent = 'Logging in...';
  
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  
  if(error){
    err.textContent = error.message;
    const inp = document.getElementById('pw-input');
    if(inp){inp.classList.remove('shake');void inp.offsetWidth;inp.classList.add('shake');inp.value='';}
  } else {
    currentUser = data.user;
    const ls = document.getElementById('login-screen');
    if(ls) ls.style.display = 'none';
    injectWordSmithBranding();
    await applyRolePermissions();
    if(typeof showApp === 'function') showApp();
  }
}

function injectWordSmithBranding() {
  const tryInject = () => {
    const sub = document.querySelector('.topbar-sub');
    if(sub && !sub.innerHTML.includes('WordSmith Systems')) {
      sub.innerHTML += ' · <a href="https://wordsmithsystems.com/" target="_blank" style="color:inherit;text-decoration:none;opacity:0.6;font-weight:400;transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">Powered by WordSmith Systems</a>';
      return true;
    }
    return false;
  };

  if (!tryInject()) {
    const observer = new MutationObserver(() => {
      if (tryInject()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}


function toast(m,t=''){
  const e=document.getElementById('tst');
  if(!e) return;
  e.textContent=m; e.className='toast'+(t?' '+t:''); e.classList.add('show');
  clearTimeout(e._t); e._t=setTimeout(()=>e.classList.remove('show'),2800);
}

function sync(on) {
  const dot = document.getElementById('sdot');
  const label = document.getElementById('slabel');
  if(dot) dot.className = 'sync-dot' + (on ? ' busy' : '');
  if(label) label.textContent = on ? 'Syncing...' : 'Connected';
  console.log(on ? '🔄 Syncing...' : '✅ Connected');
}

function serr() {
  const dot = document.getElementById('sdot');
  const label = document.getElementById('slabel');
  if(dot) dot.className = 'sync-dot err';
  if(label) label.textContent = 'Error';
  console.error('❌ Supabase Connection Error');
}

// Check Auth on Load
window.addEventListener('DOMContentLoaded', async () => {
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = 'manifest.json';
  document.head.appendChild(link);

  const { data: { session } } = await db.auth.getSession();
  if(session) {
    currentUser = session.user;
    
    // Auto-create profile if missing
    const { data: hasProfile } = await db.from('profiles').select('id').eq('id', currentUser.id).single();
    if(!hasProfile) {
      await db.from('profiles').insert({ 
        id: currentUser.id, 
        email: currentUser.email, 
        role: currentUser.user_metadata?.role || 'fulfillment' 
      });
    }

    await applyRolePermissions();
    const ls = document.getElementById('login-screen');
    if(ls) ls.style.display = 'none';
    injectWordSmithBranding();
    if(typeof showApp === 'function') showApp();
  } else {
    // Show login only if we are on the Hub and have no session
    const loginCont = document.getElementById('login-screen');
    if(loginCont) {
      loginCont.style.setProperty('display', 'flex', 'important');
      console.log('Login screen displayed (No Session)');
    }

    // Force redirect to Hub if they are on a protected page without a session
    if(!window.location.pathname.includes('index.html') && !window.location.pathname.endsWith('/')) {
      window.location.href = 'index.html';
    }
  }
});

async function applyRolePermissions() {
  if(!currentUser) return;
  const role = currentUser.user_metadata?.role || 'user';
  
  const nav = document.querySelector('.dash-nav');
  if(nav) {
    const links = nav.querySelectorAll('a');
    links.forEach(a => {
      const href = a.getAttribute('href');
      if(!href) return;
      const path = window.location.pathname;

      // Smart Active Match: If path ends with href, or if at root and href is index.html
      const isActive = path.endsWith(href) || (path.endsWith('/') && href === 'index.html');
      if(isActive) a.classList.add('active');

      // ADMIN ONLY TABS (P&L, Activity, Admin)
      const isAdminOnly = href.includes('pl-tracker') || href.includes('activity') || href.includes('admin');
      if(isAdminOnly && role !== 'admin') a.style.display = 'none';

      // ROLE-BASED VISIBILITY
      if(role === 'fulfillment' && isAdminOnly) a.style.display = 'none';
      if(role === 'finance' && (href.includes('fulfillment') || href.includes('queue'))) a.style.display = 'none';
    });

    // DISPLAY USER NAME (With Session Caching)
    let displayName = sessionStorage.getItem('cc_user_name');
    if(!displayName) {
      displayName = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
      try {
        const { data: profile } = await db.from('profiles').select('full_name').eq('id', currentUser.id).single();
        if(profile && profile.full_name) {
          displayName = profile.full_name;
          sessionStorage.setItem('cc_user_name', displayName);
        }
      } catch(e) { console.warn('Profile fetch failed'); }
    }

    const right = document.querySelector('.topbar-right');
    if(right) {
      let greet = document.getElementById('user-greet');
      if(!greet) {
        greet = document.createElement('div');
        greet.id = 'user-greet';
        right.insertBefore(greet, right.firstChild);
      }
      greet.style = 'font-family:"Lora",serif; font-size:11px; color:#E8D08A; letter-spacing:0.05em; font-weight:500; margin-right:15px; border-right:1px solid rgba(201,168,76,0.15); padding-right:15px; display:flex; align-items:center; height:100%;';
      greet.textContent = `User: ${displayName.charAt(0).toUpperCase() + displayName.slice(1)}`;
    }

    // HIDE REVENUE KPI FOR NON-ADMINS
    const revCard = document.getElementById('kpi-revenue-card');
    if(revCard && role !== 'admin') revCard.style.display = 'none';

    // INJECT UNIFIED CONNECTION HUB
    if(right) {
      let connHub = document.getElementById('conn-hub');
      if(!connHub) {
        connHub = document.createElement('div');
        connHub.id = 'conn-hub';
        connHub.style = 'display:flex; align-items:center; gap:16px; margin-right:15px;';
        right.insertBefore(connHub, right.querySelector('.topbar-link'));
      }
      connHub.innerHTML = `
        <div class="conn-item" title="Supabase Real-time Database">
          <div class="conn-dot" style="background:#4a8c5c;"></div> Cloud Sync
        </div>
        <div class="conn-item" title="EmailJS Notification Engine">
          <div class="conn-dot" style="background:#4a8c5c;"></div> Mail Engine
        </div>
        <div id="master-printer-pill" class="conn-pill">
          🖨 Vision: Loading...
        </div>
      `;
      updateMasterPrinterStatus();
    }
  }

  // Real-time Printer Watcher
  db.channel('master-printers')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'printers' }, () => updateMasterPrinterStatus())
    .subscribe();

  const path = window.location.pathname;
  const isOwner = currentUser.email === 'stevenportugal86@gmail.com';
  
  if((path.includes('cadence-admin.html') || path.includes('cadence-activity.html')) && role !== 'admin' && !isOwner) window.location.href = 'index.html';
  if(path.includes('cadence-creatures-pl-tracker.html') && role === 'fulfillment' && !isOwner) window.location.href='index.html';
  if((path.includes('cadence-fulfillment.html') || path.includes('cadence-queue.html')) && role === 'finance' && !isOwner) window.location.href='index.html';
}

async function updateMasterPrinterStatus() {
  try {
    const pill = document.getElementById('master-printer-pill');
    if(!pill) return;
    
    const { data: printer, error } = await db.from('printers').select('*').eq('name', 'Vision').single();
    if(error) throw error;

    if(printer && printer.current_creature_id) {
      const { data: creature } = await db.from('creatures').select('name').eq('id', printer.current_creature_id).single();
      const jobName = creature ? creature.name : '...';
      pill.textContent = `🖨 Vision: Printing ${jobName}`;
      pill.style.borderColor = 'rgba(91,191,212,0.4)';
      pill.style.background = 'rgba(91,191,212,0.1)';
    } else {
      pill.textContent = `🖨 Vision: Idle`;
      pill.style.borderColor = 'rgba(91,191,212,0.2)';
      pill.style.background = 'rgba(91,191,212,0.05)';
    }
  } catch(e) { console.warn('Printer status update failed'); }
}

// EMAIL AUTOMATION (EmailJS)
function initEmail() {
  if (typeof emailjs !== 'undefined') {
    emailjs.init({ publicKey: "Kf28oWCMQdU-MdlL2" });
    console.log('EmailJS Initialized');
  }
}

// UNIVERSAL DASHBOARD STYLES (Enforces symmetry across all pages)
const styleShield = document.createElement('style');
styleShield.textContent = `
  /* Global Variables & Reset */
  :root {
    --gold: #C9A84C;
    --gold-light: #E8D08A;
    --gold-dim: rgba(201, 168, 76, 0.15);
    --cream: #FAF6F0;
    --cream-dim: rgba(196, 188, 178, 0.7);
    --cream-faint: rgba(196, 188, 178, 0.4);
    --ink: #0E0C09;
    --border: rgba(201, 168, 76, 0.12);
    --teal: #5BBFD4;
    --red: #e09090;
    --green: #7dc994;
    --amber: #c97c2a;
    --purple: #b89de8;
  }

  html { font-size: 16px; }
  body { 
    background: #0E0C09 !important; 
    color: #FAF6F0 !important; 
    margin: 0 !important; 
    min-height: 100vh;
    overflow-x: hidden;
    font-family: 'Lora', serif !important;
    font-size: 11px !important;
    line-height: 1.6 !important;
  }

  ::selection { background: rgba(201, 168, 76, 0.3); color: #fff; }

  /* Custom Scrollbar */
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: #0E0C09; }
  ::-webkit-scrollbar-thumb { background: rgba(201, 168, 76, 0.2); border-radius: 4px; border: 2px solid #0E0C09; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(201, 168, 76, 0.35); }

  #app {
    display: flex !important;
    flex-direction: column !important;
    min-height: 100vh !important;
    width: 100% !important;
    background: #0E0C09 !important;
    opacity: 1 !important;
  }

  /* Panel & Tab Logic (Fixes the "Stacked Mess") */
  .panel { display: none !important; }
  .panel.active { display: block !important; }
  .content { flex: 1; display: flex; flex-direction: column; }
  
  /* Hero Typography */
  h1, .sec-title { font-family: 'Lora', serif !important; font-size: 15px !important; letter-spacing: 0.15em !important; text-transform: uppercase !important; color: var(--gold-light) !important; margin-bottom: 24px !important; font-weight: 500 !important; }
  h2 { font-size: 11px !important; letter-spacing: 0.12em !important; text-transform: uppercase !important; color: var(--gold-light) !important; opacity: 0.8; }


  /* Core Layout Components */
  .main { flex: 1; display: flex; flex-direction: column; }
  .main-content { padding: 32px 28px; max-width: 1200px; margin: 0 auto; width: 100%; box-sizing: border-box; }
  
  /* Buttons & Interactive Elements */
  .btn { 
    font-family: 'Lora', serif !important; 
    font-size: 10px !important; 
    letter-spacing: 0.15em !important; 
    text-transform: uppercase !important; 
    padding: 12px 24px !important; 
    background: rgba(201, 168, 76, 0.05) !important; 
    border: 1px solid var(--gold) !important; 
    color: var(--gold-light) !important; 
    cursor: pointer !important; 
    transition: all 0.3s ease !important; 
    border-radius: 3px !important;
    white-space: nowrap !important;
  }
  .btn:hover { background: var(--gold-dim) !important; color: #fff !important; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
  .btn.pri { background: var(--gold) !important; color: #1C1612 !important; border: none !important; }
  .btn.pri:hover { background: var(--gold-light) !important; }
  .btn.sm { padding: 8px 14px !important; font-size: 9px !important; }

  .btn.red { border-color: var(--red); color: var(--red); }
  .btn.red:hover { background: rgba(224, 144, 144, 0.1); }

  .pill { display: inline-flex; align-items: center; font-size: 10px; letter-spacing: .07em; padding: 4px 12px; border-radius: 14px; font-weight: 600; text-transform: uppercase; }
  .p-queued { background: rgba(91,191,212,.12); color: #5BBFD4; }
  .p-printing { background: rgba(201, 168, 76,.14); color: #E8D08A; }
  .p-printed { background: rgba(147,112,219,.15); color: #b89de8; }
  .p-shipped { background: rgba(74,140,92,.15); color: #7dc994; }
  .p-complete { background: rgba(74,140,92,.25); color: #7dc994; }

  /* Section Headings */
  .sec-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
  .sec-title { font-size: 13px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--gold-light); font-weight: 600; }

  /* Dashboard Building Blocks */
  .tabs { display: flex !important; padding: 0 28px !important; border-bottom: 1px solid var(--border) !important; gap: 2px !important; background: rgba(0,0,0,0.2) !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; }
  .tab { font-family: 'Lora', serif !important; padding: 14px 20px !important; font-size: 11px !important; letter-spacing: .12em !important; text-transform: uppercase !important; color: var(--cream-faint) !important; cursor: pointer !important; border: none !important; background: none !important; border-bottom: 3px solid transparent !important; transition: all 0.2s !important; white-space: nowrap !important; flex-shrink: 0 !important; }
  .tab:hover { color: var(--gold-light) !important; background: var(--gold-dim) !important; }
  .tab.active { color: var(--gold-light) !important; border-bottom-color: var(--gold) !important; background: rgba(201, 168, 76, 0.05) !important; }

  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 24px; }
  .kpi { background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); padding: 22px; border-radius: 4px; text-align: center; }
  .kpi-l { font-size: 9px; letter-spacing: .18em; text-transform: uppercase; color: var(--gold-light); opacity: 0.5; margin-bottom: 10px; }
  .kpi-v { font-size: 24px; font-weight: 600; color: var(--cream); }
  .kpi-s { font-size: 10px; color: #8A7D6E; margin-top: 8px; }

  /* Table System */
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 9px; letter-spacing: .2em; text-transform: uppercase; color: var(--gold-light); opacity: 0.45; padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--border); }
  td { padding: 12px 14px; border-bottom: 1px solid rgba(201, 168, 76, 0.05); vertical-align: middle; }
  tr:hover td { background: rgba(201, 168, 76, 0.04); }

  .topbar { 
    display: flex !important; 
    justify-content: space-between !important; 
    align-items: center !important; 
    height: 64px !important; 
    padding: 0 28px !important; 
    background: rgba(28, 22, 18, 0.98) !important;
    backdrop-filter: blur(10px) !important;
    border-bottom: 1px solid rgba(201, 168, 76, 0.15) !important;
    flex-shrink: 0 !important;
    width: 100% !important;
    box-sizing: border-box !important;
    position: sticky !important;
    top: 0 !important;
    z-index: 1001 !important;
  }
  .topbar-left { display: flex !important; align-items: center !important; gap: 12px !important; }
  .topbar-right { display: flex !important; align-items: center !important; gap: 20px !important; }
  .topbar-name { font-family: 'Lora', serif !important; font-size: 13px !important; font-weight: 500 !important; color: #E8D08A !important; letter-spacing: 0.05em !important; }
  .topbar-sub { font-size: 9px !important; color: rgba(232, 208, 138, 0.5) !important; text-transform: uppercase !important; letter-spacing: 0.15em !important; margin-top: 1px !important; }
  
  #user-greet { 
    font-family: 'Lora', serif !important; 
    font-size: 11px !important; 
    color: #E8D08A !important; 
    letter-spacing: 0.05em !important;
    border-right: 1px solid rgba(201, 168, 76, 0.2) !important;
    padding-right: 20px !important;
    height: 14px !important;
    display: flex !important;
    align-items: center !important;
  }

  .dash-nav { 
    display: flex !important; 
    background: rgba(20, 18, 15, 0.95) !important; 
    backdrop-filter: blur(10px) !important;
    padding: 0 16px !important; 
    gap: 0 !important;
    border-bottom: 1px solid rgba(201, 168, 76, 0.1) !important;
    overflow-x: auto !important;
    position: sticky !important;
    top: 64px !important;
    z-index: 999 !important;
  }
  .dash-nav a { 
    font-family: 'Lora', serif !important;
    font-size: 10px !important;
    padding: 14px 20px !important;
    text-transform: uppercase !important;
    letter-spacing: 0.15em !important;
    color: rgba(196, 188, 178, 0.6) !important;
    text-decoration: none !important;
    border-bottom: 3px solid transparent !important;
    transition: all 0.2s ease !important;
    position: relative !important;
    display: inline-block !important;
    white-space: nowrap !important;
    flex-shrink: 0 !important;
  }
  .dash-nav a:hover {
    color: #E8D08A !important;
    background: rgba(201, 168, 76, 0.03) !important;
  }
  .dash-nav a.active { 
    color: #E8D08A !important; 
    border-bottom: 3px solid #C9A84C !important;
    background: rgba(201, 168, 76, 0.08) !important;
  }
  .topbar-link {
    font-family: 'Lora', serif !important;
    font-size: 10px !important;
    letter-spacing: 0.15em !important;
    color: rgba(196, 188, 178, 0.5) !important;
    text-decoration: none !important;
    cursor: pointer !important;
  }
  #login-screen { 
    position: fixed !important; 
    inset: 0 !important; 
    background: #0E0C09 !important; 
    z-index: 10000 !important; 
    display: none; 
    flex-direction: column !important;
    align-items: center !important; 
    justify-content: center !important; 
    padding: 20px !important; 
  }
  .login-box { 
    width: 100% !important; 
    max-width: 360px !important; 
    text-align: center !important; 
    background: rgba(255, 255, 255, 0.02) !important; 
    border: 1px solid rgba(201, 168, 76, 0.15) !important; 
    padding: 48px 40px !important; 
    border-radius: 8px !important; 
    box-shadow: 0 30px 60px rgba(0,0,0,0.5) !important; 
    backdrop-filter: blur(10px) !important;
  }
  .login-crown { margin-bottom: 28px !important; filter: drop-shadow(0 0 8px rgba(201, 168, 76, 0.3)) !important; }
  .login-title { font-family: 'Lora', serif !important; font-size: 26px !important; color: #E8D08A !important; margin-bottom: 8px !important; font-weight: 500 !important; }
  .login-sub { font-size: 10px !important; letter-spacing: 0.2em !important; text-transform: uppercase !important; color: rgba(196, 188, 178, 0.4) !important; margin-bottom: 36px !important; }
  .login-field { margin-bottom: 12px !important; width: 100% !important; }
  .login-field input { 
    background: rgba(255,255,255,0.03) !important; 
    border: 1px solid rgba(201,168,76,0.1) !important; 
    padding: 14px 16px !important; 
    font-size: 14px !important;
    border-radius: 4px !important;
  }
  .login-btn { 
    width: 100% !important; 
    padding: 14px !important; 
    background: #C9A84C !important; 
    border: none !important; 
    color: #0E0C09 !important; 
    font-weight: 600 !important; 
    letter-spacing: 0.12em !important; 
    text-transform: uppercase !important; 
    cursor: pointer !important; 
    border-radius: 4px !important; 
    transition: all 0.3s ease !important; 
    font-family: 'Lora', serif !important;
    font-size: 11px !important;
    margin-top: 8px !important;
  }
  .login-btn:hover { background: #E8D08A !important; transform: translateY(-1px) !important; box-shadow: 0 5px 15px rgba(201, 168, 76, 0.2) !important; }
  .login-err { font-size: 11px !important; color: #e09090 !important; margin-top: 20px !important; min-height: 14px !important; font-style: italic !important; }
  .topbar-link:hover { color: #E8D08A !important; }

  /* Dashboard Components */
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
  .kpi-card { background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(201, 168, 76, 0.12); padding: 20px !important; border-radius: 6px; text-align: center; backdrop-filter: blur(4px); }
  .kpi-label { font-size: 9px !important; letter-spacing: 0.25em !important; text-transform: uppercase !important; color: #8A7D6E !important; margin-bottom: 10px !important; }
  .kpi-val { font-size: 24px !important; font-weight: 600 !important; color: #E8D08A !important; letter-spacing: -0.02em !important; }

  .btn { font-family: inherit; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; padding: 8px 16px; cursor: pointer; border: 1px solid rgba(201, 168, 76, 0.3); background: transparent; color: #E8D08A; transition: all .2s; border-radius: 2px; outline: none; }
  .btn:hover { background: rgba(201, 168, 76, 0.1); border-color: #C9A84C; }
  .btn.pri { background: rgba(201, 168, 76, 0.14); border-color: #C9A84C; }
  .btn.pri:hover { background: rgba(201, 168, 76, .22); }

  .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, .7); z-index: 1000; display: none; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); }
  .overlay.open { display: flex; }
  .modal { background: #1e1a15; border: 1px solid rgba(201, 168, 76, .2); max-width: 500px; width: 100%; padding: 26px; max-height: 90vh; overflow-y: auto; border-radius: 3px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
  .modal-t { font-size: 14px; font-weight: 500; color: #E8D08A; margin-bottom: 18px; text-transform: uppercase; letter-spacing: 0.1em; }
  .modal-act { display: flex; gap: 10px; margin-top: 18px; justify-content: flex-end; }

  .fg { display: grid; gap: 14px; }
  .fr { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .fl { display: block; font-size: 9px !important; letter-spacing: .15em !important; text-transform: uppercase !important; color: rgba(196, 188, 178, 0.5) !important; margin-bottom: 6px !important; }

  input, select, textarea { width: 100%; background: rgba(255, 255, 255, .04); border: 1px solid rgba(201, 168, 76, 0.12); color: #FAF6F0; font-family: inherit; font-size: 11px !important; padding: 10px 12px; outline: none; border-radius: 2px; transition: border-color 0.2s; }
  input:focus, select:focus, textarea:focus { border-color: rgba(201, 168, 76, .38); background: rgba(255, 255, 255, 0.06); }
  select option { background: #1a1610; color: #FAF6F0; }

  /* Premium Alerts & Notifications */
  .alert, .notif-item { 
    font-family: 'Lora', serif !important;
    font-size: 12px !important;
    line-height: 1.6 !important;
    padding: 14px 18px !important;
    border-radius: 6px !important;
    margin-bottom: 12px !important;
    background: rgba(255, 255, 255, 0.02) !important;
    border: 1px solid rgba(201, 168, 76, 0.12) !important;
    color: var(--cream) !important;
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    animation: fadeInSlide 0.4s ease forwards;
    backdrop-filter: blur(8px) !important;
  }
  .alert::before, .notif-item.critical::before { 
    content: '⚠'; 
    color: #e09090; 
    font-size: 14px; 
    font-weight: bold; 
  }
  .notif-item.critical { 
    background: rgba(224, 144, 144, 0.04) !important; 
    border-color: rgba(224, 144, 144, 0.2) !important; 
    box-shadow: inset 0 0 15px rgba(224, 144, 144, 0.02) !important;
  }
  .notif-empty { 
    font-size: 11px !important; 
    color: rgba(196, 188, 178, 0.4) !important; 
    padding: 16px !important; 
    border: 1px dashed rgba(201, 168, 76, 0.1) !important; 
    border-radius: 6px !important; 
    text-align: center !important;
    text-transform: uppercase !important;
    letter-spacing: 0.1em !important;
  }

  @keyframes fadeInSlide {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .conn-item { display: flex; align-items: center; gap: 8px; font-size: 10px; color: rgba(196, 188, 178, 0.4); letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; }
  .conn-dot { width: 7px; height: 7px; border-radius: 50%; box-shadow: 0 0 6px rgba(74, 140, 92, 0.3); }
  .conn-pill { display: flex; align-items: center; gap: 8px; font-size: 10px; padding: 5px 12px; border: 1px solid rgba(91, 191, 212, 0.2); color: #5BBFD4; border-radius: 14px; background: rgba(91, 191, 212, 0.04); white-space: nowrap; transition: all 0.3s; }
`;
document.head.appendChild(styleShield);

async function sendFulfillmentEmail(order) {
  if(!order.buyer_email) {
    console.log("No email address for order:", order.etsy_order_id);
    return;
  }
  
  // Prepare the items for the {{#orders}} loop in your template
  const orderItems = Array.isArray(order.items) ? order.items.map(itm => ({
    name: itm.replace('[x] ','').trim(),
    price: 'Included',
    units: 1
  })) : [{ name: order.items || 'Cadence Creature', price: 'Included', units: 1 }];

  const templateParams = {
    name: order.buyer_name || 'Customer',
    email: order.buyer_email,
    order_id: order.etsy_order_id || order.id.slice(0,8),
    orders: orderItems,
    tracking_number: order.tracking_number || 'N/A',
    carrier: order.carrier || 'USPS',
    tracking_link: order.tracking_number ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${order.tracking_number}` : '#',
    cost: {
      shipping: '0.00',
      tax: '0.00',
      total: order.total_amount ? order.total_amount.toFixed(2) : '0.00'
    }
  };

  try {
    const res = await emailjs.send('service_4z4fm6m', 'template_6waa5cm', templateParams);
    console.log('EmailJS Success Response:', res);
    toast('Notification Email Sent!', 'ok');
  } catch (error) {
    console.error('EmailJS Server Error:', error);
    toast('Email notification failed: ' + (error.text || error.message), 'err');
  }
}



async function logActivity(action, orderId = null, details = null) {
  if(!currentUser) return;
  let name = sessionStorage.getItem('cc_user_name') || currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
  try {
    await db.from('activity_log').insert({
      user_id: currentUser.id,
      user_name: name.charAt(0).toUpperCase() + name.slice(1),
      action: action,
      order_id: orderId,
      details: details
    });
  } catch(e) { console.error('Logging Failed:', e); }
}

// NAV HIGHLIGHTER
function highlightNav() {
  let path = window.location.pathname.split('/').pop() || 'index.html';
  // Handle extension-less URLs (like localhost:4321/cadence-queue)
  if (path && !path.includes('.')) path += '.html';

  document.querySelectorAll('.dash-nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path) {
      a.classList.add('active');
    } else {
      a.classList.remove('active');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  highlightNav();
  const observer = new MutationObserver(highlightNav);
  const nav = document.querySelector('.dash-nav');
  if (nav) observer.observe(nav, { childList: true, subtree: true });
});
