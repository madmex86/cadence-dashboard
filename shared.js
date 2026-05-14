// Synchronous auth gate — runs immediately while HTML is still parsing.
// Hides the page on any non-hub URL so data never flashes before the async
// session check resolves. Removed on auth success; body is wiped on failure.
(function() {
  const isHub = /\/(index(\.html)?)?$/.test(window.location.pathname);
  if (!isHub) {
    document.documentElement.classList.add('auth-gate');
    const s = document.createElement('style');
    s.textContent = 'html.auth-gate body { visibility: hidden !important; }';
    document.head.appendChild(s);
  }
})();

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

const SK='cc_hub_auth';

// Initialize Supabase Globally
const supabaseUrl = 'https://ufqiysdgmxrhonnfsgts.supabase.co';
const supabaseKey = 'sb_publishable_7mkBL1lsKUNJEmqSd2HT9Q_Z4xHoBec';
const db = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;

// Discord alerts route through the send-discord-alert Edge Function.
// Set DISCORD_WEBHOOK_URL in Supabase Dashboard → Edge Functions → Secrets.
// The webhook URL never touches client-side code.
async function sendDiscordAlert(title, message, color=0xE8D08A) {
  try {
    await db.functions.invoke('send-discord-alert', { body: { title, message, color } });
  } catch(e) {
    console.error('Discord alert failed:', e);
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
    highlightNav();
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

    // Auto-create profile if missing, otherwise check deactivated + stamp last_seen
    const { data: hasProfile } = await db.from('profiles').select('id,deactivated').eq('id', currentUser.id).single();
    if(!hasProfile) {
      await db.from('profiles').insert({
        id: currentUser.id,
        email: currentUser.email,
        role: currentUser.user_metadata?.role || 'fulfillment',
        last_seen: new Date().toISOString()
      });
    } else {
      if(hasProfile.deactivated) {
        await db.auth.signOut();
        document.body.innerHTML = '';
        window.location.href = 'index.html';
        return;
      }
      const { error: upError } = await db.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', currentUser.id);
      if (upError) console.error('Failed to update last_seen:', upError);
    }

    // Lift the synchronous gate — session confirmed, safe to render
    document.documentElement.classList.remove('auth-gate');

    await applyRolePermissions();
    highlightNav();
    const ls = document.getElementById('login-screen');
    if(ls) ls.style.display = 'none';
    injectWordSmithBranding();
    if(typeof showApp === 'function') showApp();
  } else {
    const isHub = /\/(index(\.html)?)?$/.test(window.location.pathname);
    if(isHub) {
      // On the login hub: lift gate and show the login form
      document.documentElement.classList.remove('auth-gate');
      const loginCont = document.getElementById('login-screen');
      if(loginCont) loginCont.style.setProperty('display', 'flex', 'important');
    } else {
      // Protected page, no session — wipe DOM so data never shows, then redirect
      document.body.innerHTML = '';
      window.location.href = 'index.html';
    }
  }
});

// CENTRALIZED NAVIGATION MASTER
const NAV_GROUPS = [
  { label: 'Hub', href: 'index.html' },
  { label: 'Production', children: [
    { label: 'Queue & Orders', href: 'cadence-queue.html' },
    { label: 'Fulfillment', href: 'cadence-fulfillment.html' },
  ]},
  { label: 'Commerce', adminOnly: true, children: [
    { label: 'P&L', href: 'cadence-creatures-pl-tracker.html' },
    { label: 'Sales Intel', href: 'cadence-sales.html' },
    { label: '🚀 Launch', href: 'cadence-drop-launch.html', hideIfLaunched: true },
    { label: 'Analytics', href: 'cadence-analytics.html' },
  ]},
  { label: 'Catalog', adminOnly: true, children: [
    { label: 'Creatures', href: 'cadence-creature-editor.html' },
  ]},
  { label: 'Customers', children: [
    { label: 'Customers', href: 'cadence-customers.html' },
    { label: 'Messages', href: 'cadence-messages.html', badge: 'msg-badge' },
    { label: 'Email Blast', href: 'cadence-email-blast.html', adminOnly: true },
  ]},
  { label: 'Ops', adminOnly: true, children: [
    { label: 'Live', href: 'cadence-live.html' },
    { label: 'Site', href: 'cadence-site.html' },
    { label: 'Links', href: 'cadence-links.html' },
    { label: 'Activity', href: 'cadence-activity.html' },
    { label: 'Admin', href: 'cadence-admin.html' },
  ]},
  { label: 'Live Site ↗', href: 'https://cadencecreatures.com', external: true },
  { label: 'Etsy ↗', href: 'https://etsy.com/shop/CadenceCreatures', external: true },
];

async function applyRolePermissions() {
  if(!currentUser) return;
  const role = currentUser.user_metadata?.role || 'user';
  const isOwner = currentUser.email === 'stevenportugal86@gmail.com';
  const path = window.location.pathname.replace(/\/$/, '') || '/index.html';
  const currentFile = path.split('/').pop().replace('.html', '');

  // 1. INJECT NAVIGATION
  const nav = document.querySelector('.dash-nav');
  if(nav) {
    try {
      // Inject dropdown nav styles once
      if (!document.getElementById('nav-group-styles')) {
        const s = document.createElement('style');
        s.id = 'nav-group-styles';
        s.textContent = `.nav-group{position:relative;display:inline-block}.nav-group-btn{font-family:'Lora',serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--cream-faint);background:none;border:none;padding:12px 16px;cursor:pointer;border-bottom:3px solid transparent;transition:all .2s;white-space:nowrap}.nav-group-btn:hover{color:var(--gold-light)}.nav-group-btn.active{color:var(--gold-light);border-bottom-color:var(--gold)}.nav-group-btn::after{content:' ▾';font-size:7px;opacity:.6}.nav-dropdown{display:none;position:absolute;top:100%;left:0;background:#0f0d14;border:1px solid rgba(201,168,76,.15);min-width:160px;z-index:500;padding:4px 0;box-shadow:0 8px 24px rgba(0,0,0,.5)}.nav-group.open .nav-dropdown{display:block}.nav-dropdown a{display:block;padding:9px 18px;font-family:'Lora',serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--cream-faint);text-decoration:none;border-bottom:none;white-space:nowrap;transition:color .15s,background .15s}.nav-dropdown a:hover,.nav-dropdown a.active{color:var(--gold-light);background:rgba(201,168,76,.05)}`;
        document.head.appendChild(s);
      }

      function isLinkVisible(link) {
        if (!isOwner) {
          if (link.adminOnly && role !== 'admin') return false;
          if (link.hideIfLaunched && localStorage.getItem('cc_drop1_launched')) return false;
          if (role === 'finance' && link.href && (link.href.includes('fulfillment') || link.href.includes('queue'))) return false;
          if (role === 'fulfillment' && link.adminOnly) return false;
        }
        return true;
      }

      nav.innerHTML = NAV_GROUPS.map(group => {
        if (!group.children) {
          // Standalone link
          if (!isLinkVisible(group)) return '';
          const target = group.external ? ' target="_blank"' : '';
          const linkFile = (group.href || '').split('/').pop().replace('.html', '');
          const active = linkFile === currentFile ? ' class="active"' : '';
          return `<a href="${group.href}"${target}${active}>${group.label}</a>`;
        }
        // Group with dropdown
        if (group.adminOnly && !isOwner && role !== 'admin') return '';
        const visibleChildren = group.children.filter(isLinkVisible);
        if (!visibleChildren.length) return '';
        const groupActive = visibleChildren.some(c => (c.href || '').split('/').pop().replace('.html','') === currentFile);
        const childLinks = visibleChildren.map(link => {
          const target = link.external ? ' target="_blank"' : '';
          const badge = link.badge ? ` <span id="${link.badge}" class="nav-badge" style="display:none">0</span>` : '';
          const linkFile = (link.href || '').split('/').pop().replace('.html', '');
          const active = linkFile === currentFile ? ' class="active"' : '';
          return `<a href="${link.href}"${target}${active}>${link.label}${badge}</a>`;
        }).join('');
        return `<div class="nav-group"><button class="nav-group-btn${groupActive ? ' active' : ''}" onclick="(function(btn){var g=btn.closest('.nav-group');document.querySelectorAll('.nav-group').forEach(function(x){if(x!==g)x.classList.remove('open')});g.classList.toggle('open')})(this)">${group.label}</button><div class="nav-dropdown">${childLinks}</div></div>`;
      }).join('');

      // Close dropdowns on outside click
      if (!document.getElementById('nav-outside-handler')) {
        const marker = document.createElement('span');
        marker.id = 'nav-outside-handler';
        marker.style.display = 'none';
        document.body.appendChild(marker);
        document.addEventListener('click', function(e) {
          if (!e.target.closest('.nav-group')) {
            document.querySelectorAll('.nav-group.open').forEach(function(g) { g.classList.remove('open'); });
          }
        });
      }
    } catch(e) { console.error('Nav injection failed:', e); }
  }

  // 1.5 INJECT HUD BAR (between topbar and nav)
  if (!document.getElementById('cc-hud')) {
    const hud = document.createElement('div');
    hud.id = 'cc-hud';
    hud.innerHTML = `
      <div class="hud-live-dot" title="Visitors active in the last 5 minutes"></div>
      <div class="hud-pill">
        <span class="hud-label">Live</span>
        <span class="hud-val" id="hud-live-val">—</span>
      </div>
      <div class="hud-sep"></div>
      <div class="hud-pill">
        <span class="hud-label">Today</span>
        <span class="hud-val" id="hud-profit-val">—</span>
      </div>
      <div class="hud-sep"></div>
      <div class="hud-pill">
        <span class="hud-label">Printing</span>
        <span class="hud-val" id="hud-print-val">—</span>
      </div>
    `;
    const dashNav = document.querySelector('.dash-nav');
    if (dashNav) dashNav.parentNode.insertBefore(hud, dashNav);
  }
  updateHUD();

  // 2. INJECT TOPBAR ELEMENTS
  const right = document.querySelector('.topbar-right');
  if(right) {
    try {
      // User Greeting
      let displayName = sessionStorage.getItem('cc_user_name');
      if(!displayName) {
        displayName = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
        const { data: profile } = await db.from('profiles').select('full_name').eq('id', currentUser.id).single();
        if(profile && profile.full_name) {
          displayName = profile.full_name;
          sessionStorage.setItem('cc_user_name', displayName);
        }
      }

      let greet = document.getElementById('user-greet');
      if(!greet) {
        greet = document.createElement('div');
        greet.id = 'user-greet';
        greet.style = 'font-family:"Lora",serif; font-size:11px; color:#E8D08A; letter-spacing:0.05em; font-weight:500; margin-right:15px; border-left:1px solid rgba(201,168,76,0.15); padding-left:15px; display:flex; align-items:center; height:100%;';
        right.insertBefore(greet, right.querySelector('.topbar-link'));
      }
      greet.textContent = `User: ${displayName.charAt(0).toUpperCase() + displayName.slice(1)}`;

      // Connection Hub
      let connHub = document.getElementById('conn-hub');
      if(!connHub) {
        connHub = document.createElement('div');
        connHub.id = 'conn-hub';
        connHub.style = 'display:flex; align-items:center; gap:16px; margin-right:15px;';
        right.insertBefore(connHub, greet);
      }
      connHub.innerHTML = `
        <div class="conn-item" title="Supabase Real-time Database">
          <div class="conn-dot" style="background:#4a8c5c;"></div> Cloud Sync
        </div>
        <div class="conn-item" title="Email Engine">
          <div class="conn-dot" style="background:#4a8c5c;"></div> Mail Engine
        </div>
        <div id="master-printer-pill" class="conn-pill">🖨 Vision: Loading...</div>
      `;
      updateMasterPrinterStatus();
    } catch(e) { console.error('Topbar injection failed:', e); }
  }

  // 3. INITIALIZE REAL-TIME WATCHERS
  try {
    db.channel('master-printers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'printers' }, () => {
        updateMasterPrinterStatus();
        updateHudPrinterCount();
      })
      .subscribe();

    db.channel('contact-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_submissions' }, () => refreshMessageBadge())
      .subscribe();

    db.channel('hud-finance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance' }, () => updateHudDailyProfit())
      .subscribe();

    db.channel('hud-analytics')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'site_analytics' }, () => updateHudLiveUsers())
      .subscribe();

    refreshMessageBadge();
    setInterval(updateHudLiveUsers, 60000);
  } catch(e) { console.error('Real-time init failed:', e); }

  // 4. HIDE REVENUE KPI FOR NON-ADMINS
  const revCard = document.getElementById('kpi-revenue-card');
  if(revCard && role !== 'admin' && !isOwner) revCard.style.display = 'none';

  // 5. SECURITY REDIRECTS
  if(!isOwner) {
    if((path.includes('cadence-admin') || path.includes('cadence-activity')) && role !== 'admin') window.location.href = 'index.html';
    if(path.includes('pl-tracker') && role === 'fulfillment') window.location.href='index.html';
    if((path.includes('fulfillment') || path.includes('queue')) && role === 'finance') window.location.href='index.html';
  }
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

async function refreshMessageBadge() {
  try {
    const { count, error } = await db.from('contact_submissions').select('id', { count: 'exact', head: true }).eq('is_read', false);
    if(error) throw error;
    const badge = document.getElementById('msg-badge');
    if(badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  } catch(e) { console.warn('Message badge refresh failed'); }
}


// ── HUD Data Functions ────────────────────────────────────────────────────

async function updateHUD() {
  await Promise.all([updateHudLiveUsers(), updateHudDailyProfit(), updateHudPrinterCount()]);
}

async function updateHudLiveUsers() {
  try {
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count } = await db.from('site_analytics')
      .select('session_id', { count: 'exact', head: true })
      .gte('created_at', since);
    const el = document.getElementById('hud-live-val');
    if (el) el.textContent = (count ?? 0) + ' visitors';
  } catch(e) {}
}

async function updateHudDailyProfit() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await db.from('finance').select('entry_type,amount').eq('entry_date', today);
    if (!data) return;
    const net = data.reduce((s, r) => s + (r.entry_type === 'income' ? +r.amount : -+r.amount), 0);
    const el = document.getElementById('hud-profit-val');
    if (el) {
      el.textContent = (net >= 0 ? '+' : '-') + '$' + Math.abs(net).toFixed(2);
      el.style.color = net > 0 ? '#7dc994' : net < 0 ? '#e09090' : '#E8D08A';
    }
  } catch(e) {}
}

async function updateHudPrinterCount() {
  try {
    const { data } = await db.from('printers').select('name,current_creature_id').eq('active', true);
    if (!data) return;
    const active = data.filter(p => p.current_creature_id);
    const el = document.getElementById('hud-print-val');
    if (el) {
      el.textContent = active.length > 0 ? active.length + ' active' : 'Idle';
      el.style.color = active.length > 0 ? '#5BBFD4' : 'rgba(196,188,178,0.4)';
    }
  } catch(e) {}
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
    --red-badge: #e87070;
  }

  .nav-badge {
    background: var(--red-badge);
    color: #fff;
    font-size: 9px;
    font-weight: bold;
    padding: 1px 6px;
    border-radius: 10px;
    margin-left: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 14px;
    box-shadow: 0 0 10px rgba(232, 112, 112, 0.4);
  }

  html { font-size: 16px; }
  body {
    background: #0E0C09 !important;
    color: #FAF6F0 !important;
    margin: 0 !important;
    min-height: 100vh;
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
  .main { flex: 1; display: flex; flex-direction: column; overflow-x: hidden; }
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
    height: calc(64px + env(safe-area-inset-top)) !important;
    padding: env(safe-area-inset-top) 28px 0 !important;
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
    top: calc(100px + env(safe-area-inset-top)) !important;
    z-index: 999 !important;
  }
  .dash-nav a {
    font-family: 'Lora', serif !important;
    font-size: 10px !important;
    padding: 12px 13px !important;
    text-transform: uppercase !important;
    letter-spacing: 0.12em !important;
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

  .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, .7); z-index: 1000; display: none; align-items: flex-start; justify-content: center; padding: 40px 20px 20px; backdrop-filter: blur(4px); overflow-y: auto; }
  .overlay.open { display: flex; }
  .modal { background: #1e1a15; border: 1px solid rgba(201, 168, 76, .2); max-width: 500px; width: 100%; padding: 26px; max-height: 90vh; overflow-y: auto; border-radius: 3px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
  .modal-t { font-size: 14px; font-weight: 500; color: #E8D08A; margin-bottom: 18px; text-transform: uppercase; letter-spacing: 0.1em; }
  .modal-act { display: flex; gap: 10px; margin-top: 18px; justify-content: flex-end; }

  .fg { display: grid; gap: 14px; }
  .fr { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .fl { display: block; font-size: 9px !important; letter-spacing: .15em !important; text-transform: uppercase !important; color: rgba(196, 188, 178, 0.5) !important; margin-bottom: 6px !important; }

  input:not([type="checkbox"]):not([type="radio"]), select, textarea { width: 100%; box-sizing: border-box; background: rgba(255, 255, 255, .04); border: 1px solid rgba(201, 168, 76, 0.12); color: #FAF6F0; font-family: inherit; font-size: 11px !important; padding: 10px 12px; outline: none; border-radius: 2px; transition: border-color 0.2s; }
  input[type="checkbox"], input[type="radio"] { width: auto; height: auto; margin: 0; cursor: pointer; accent-color: var(--gold); }
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

  /* Toast Notifications */
  .toast {
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%) translateY(6px);
    background: rgba(28, 22, 16, 0.96);
    border: 1px solid rgba(201, 168, 76, 0.25);
    color: #E8D08A;
    padding: 11px 22px;
    border-radius: 4px;
    font-family: 'Lora', serif;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease, transform 0.25s ease;
    z-index: 9999;
    backdrop-filter: blur(10px);
    white-space: nowrap;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  .toast.ok { border-color: rgba(125, 201, 148, 0.4); color: #7dc994; }
  .toast.err { border-color: rgba(224, 144, 144, 0.4); color: #e09090; }

  .conn-item { display: flex; align-items: center; gap: 8px; font-size: 10px; color: rgba(196, 188, 178, 0.4); letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; }
  .conn-dot { width: 7px; height: 7px; border-radius: 50%; box-shadow: 0 0 6px rgba(74, 140, 92, 0.3); }
  .conn-pill { display: flex; align-items: center; gap: 8px; font-size: 10px; padding: 5px 12px; border: 1px solid rgba(91, 191, 212, 0.2); color: #5BBFD4; border-radius: 14px; background: rgba(91, 191, 212, 0.04); white-space: nowrap; transition: all 0.3s; }

  /* Help tooltips — global */
  .help-tip { display: inline-flex; align-items: center; justify-content: center; width: 13px; height: 13px; border-radius: 50%; background: rgba(201,168,76,0.1); color: rgba(201,168,76,0.45); font-size: 8px; font-weight: 700; cursor: default; position: relative; margin-left: 5px; user-select: none; vertical-align: middle; transition: background .15s, color .15s; font-family: sans-serif; flex-shrink: 0; }
  .help-tip:hover, .help-tip.open { background: rgba(201,168,76,0.22); color: #C9A84C; }
  .help-tip .tip-text { display: none !important; }
  #global-tip { display:none; position:fixed; background:#1e1a14; border:1px solid rgba(201,168,76,0.28); border-radius:4px; padding:9px 12px; font-size:11px; color:rgba(196,188,178,0.85); line-height:1.6; width:215px; z-index:99999; pointer-events:none; box-shadow:0 6px 24px rgba(0,0,0,0.55); white-space:normal; font-family:sans-serif; letter-spacing:0; text-transform:none; font-weight:400; }
  #global-tip::after { content:''; position:absolute; left:50%; transform:translateX(-50%); border:5px solid transparent; }
  #global-tip.tip-above::after { top:100%; border-top-color:rgba(201, 168, 76,0.28); }
  #global-tip.tip-below::after { bottom:100%; border-bottom-color:rgba(201, 168, 76,0.28); }

  /* ── HUD Bar ─────────────────────────────────── */
  #cc-hud {
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 0 20px !important;
    height: 36px !important;
    background: rgba(10, 9, 7, 0.98) !important;
    border-bottom: 1px solid rgba(91, 191, 212, 0.1) !important;
    position: sticky !important;
    top: calc(64px + env(safe-area-inset-top)) !important;
    z-index: 1000 !important;
    overflow-x: auto !important;
    flex-shrink: 0 !important;
    scrollbar-width: none !important;
  }
  #cc-hud::-webkit-scrollbar { display: none !important; }
  .hud-pill {
    display: inline-flex !important;
    align-items: center !important;
    gap: 5px !important;
    font-size: 9.5px !important;
    font-family: 'Lora', serif !important;
    letter-spacing: 0.04em !important;
    color: rgba(196, 188, 178, 0.5) !important;
    white-space: nowrap !important;
    flex-shrink: 0 !important;
  }
  .hud-val {
    color: #E8D08A !important;
    font-weight: 500 !important;
    transition: color 0.4s ease !important;
  }
  .hud-label {
    font-size: 8px !important;
    letter-spacing: 0.14em !important;
    text-transform: uppercase !important;
    color: rgba(196, 188, 178, 0.3) !important;
  }
  .hud-sep {
    width: 1px !important;
    height: 14px !important;
    background: rgba(201, 168, 76, 0.12) !important;
    flex-shrink: 0 !important;
    margin: 0 4px !important;
  }
  .hud-live-dot {
    width: 5px !important;
    height: 5px !important;
    border-radius: 50% !important;
    background: #7dc994 !important;
    flex-shrink: 0 !important;
    animation: hud-pulse 2.5s ease-in-out infinite !important;
  }
  @keyframes hud-pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 5px rgba(125,201,148,0.5); }
    50%       { opacity: 0.45; box-shadow: none; }
  }

  /* --- MOBILE OPTIMIZATIONS --- */
  @media (max-width: 768px) {
    #cc-hud { padding: 0 12px !important; gap: 4px !important; }
    .hud-label { display: none !important; }
  }
    .topbar { padding: 0 16px !important; }
    .main-content { padding: 24px 16px !important; }
    .dash-nav { padding: 0 8px !important; }
    .dash-nav a { padding: 10px 11px !important; font-size: 9px !important; }
    #user-greet { display: none !important; }
    .conn-item { display: none !important; }
    .conn-pill { font-size: 9px !important; padding: 4px 10px !important; }
    .topbar-sub { font-size: 8px !important; }
  }

  @media (max-width: 480px) {
    .topbar-sub { display: none !important; }
    .topbar-name { font-size: 12px !important; }
    .topbar-right { gap: 12px !important; }
    .topbar-link { font-size: 9px !important; }
    .dash-nav {
      overflow-x: scroll !important;
      -webkit-overflow-scrolling: touch !important;
      overscroll-behavior-x: contain !important;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }
    .dash-nav::-webkit-scrollbar { display: none !important; }

    .fr { grid-template-columns: 1fr !important; }
    .kpi-grid { grid-template-columns: 1fr !important; }

    #app { width: 100% !important; max-width: 100vw !important; }
    .main { overflow-x: hidden !important; }
    .main-content { overflow-x: hidden !important; padding: 20px 16px !important; }
  }

  /* ── Command Palette ─────────────────────────── */
  #cc-palette-overlay {
    position: fixed !important;
    inset: 0 !important;
    background: rgba(0,0,0,0.6) !important;
    z-index: 99999 !important;
    display: none !important;
    align-items: flex-start !important;
    justify-content: center !important;
    padding-top: 18vh !important;
    backdrop-filter: blur(6px) !important;
  }
  #cc-palette-overlay.open { display: flex !important; }
  #cc-palette {
    width: 100% !important;
    max-width: 580px !important;
    background: #1a1610 !important;
    border: 1px solid rgba(201,168,76,0.28) !important;
    border-radius: 6px !important;
    box-shadow: 0 32px 80px rgba(0,0,0,0.7) !important;
    overflow: hidden !important;
    font-family: 'Lora', serif !important;
    margin: 0 16px !important;
  }
  #cc-palette-input-wrap {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    padding: 14px 18px !important;
    border-bottom: 1px solid rgba(201,168,76,0.1) !important;
  }
  .palette-search-icon {
    font-size: 13px !important;
    color: rgba(201,168,76,0.45) !important;
    flex-shrink: 0 !important;
    user-select: none !important;
  }
  #cc-palette-input {
    flex: 1 !important;
    background: transparent !important;
    border: none !important;
    outline: none !important;
    font-family: 'Lora', serif !important;
    font-size: 13px !important;
    color: #FAF6F0 !important;
    padding: 0 !important;
    letter-spacing: 0.02em !important;
    width: auto !important;
  }
  #cc-palette-input::placeholder { color: rgba(196,188,178,0.3) !important; font-size: 13px !important; }
  #cc-palette-results {
    max-height: 340px !important;
    overflow-y: auto !important;
    padding: 6px 0 !important;
  }
  .palette-group-label {
    font-size: 8px !important;
    letter-spacing: 0.2em !important;
    text-transform: uppercase !important;
    color: rgba(196,188,178,0.3) !important;
    padding: 10px 18px 4px !important;
  }
  .palette-item {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    padding: 10px 18px !important;
    cursor: pointer !important;
    transition: background 0.12s !important;
  }
  .palette-item:hover, .palette-item.active {
    background: rgba(201,168,76,0.1) !important;
  }
  .palette-item.active { background: rgba(201,168,76,0.14) !important; }
  .palette-item-icon {
    font-size: 13px !important;
    width: 20px !important;
    text-align: center !important;
    flex-shrink: 0 !important;
    color: rgba(201,168,76,0.55) !important;
  }
  .palette-item-label {
    flex: 1 !important;
    font-size: 12px !important;
    color: #FAF6F0 !important;
    letter-spacing: 0.02em !important;
  }
  .palette-item-hint {
    font-size: 9px !important;
    letter-spacing: 0.1em !important;
    text-transform: uppercase !important;
    color: rgba(196,188,178,0.3) !important;
    flex-shrink: 0 !important;
  }
  #cc-palette-footer {
    padding: 8px 18px !important;
    border-top: 1px solid rgba(201,168,76,0.08) !important;
    font-size: 9px !important;
    letter-spacing: 0.12em !important;
    text-transform: uppercase !important;
    color: rgba(196,188,178,0.25) !important;
    display: flex !important;
    justify-content: flex-end !important;
  }
`;
document.head.appendChild(styleShield);

// Fixed-position help tooltip — immune to overflow clipping
document.addEventListener('DOMContentLoaded', function() {
  var el = document.createElement('div');
  el.id = 'global-tip';
  document.body.appendChild(el);

  function show(tip) {
    var text = tip.querySelector('.tip-text');
    if (!text) return;
    el.textContent = text.textContent;
    el.style.width = '215px';
    el.style.display = 'block';
    var r   = tip.getBoundingClientRect();
    var th  = el.offsetHeight;
    var tw  = 215;
    var above = r.top > th + 14;
    el.className = above ? 'tip-above' : 'tip-below';
    var top  = above ? (r.top - th - 10) : (r.bottom + 10);
    var left = Math.max(8, Math.min(r.left + r.width / 2 - tw / 2, window.innerWidth - tw - 8));
    el.style.top  = top  + 'px';
    el.style.left = left + 'px';
  }

  function hide() { el.style.display = 'none'; el.className = ''; }

  document.addEventListener('mouseover', function(e) {
    var t = e.target.closest('.help-tip');
    if (t) show(t);
  });
  document.addEventListener('mouseout', function(e) {
    var t = e.target.closest('.help-tip');
    if (t && !t.contains(e.relatedTarget)) hide();
  });
  document.addEventListener('click', function(e) {
    var t = e.target.closest('.help-tip');
    if (t) { e.stopPropagation(); el.style.display === 'none' ? show(t) : hide(); return; }
    hide();
  });
  document.addEventListener('scroll', hide, true);
});

async function sendFulfillmentEmail(order) {
  if(!order.buyer_email) return;
  
  try {
    const { error } = await db.functions.invoke('send-shipping', { body: { order } });
    if (error) throw error;
    toast('Shipping notification sent!', 'ok');
  } catch (error) {
    console.error('Shipping email error:', error);
    toast('Email notification failed: ' + (error.message || String(error)), 'err');
  }
}



async function logActivity(action, orderId = null, details = null) {
  if(!currentUser) { console.warn('[activity] skipped — no currentUser'); return; }
  let name = sessionStorage.getItem('cc_user_name') || currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
  const { error } = await db.from('activity_log').insert({
    user_id: currentUser.id,
    user_name: name.charAt(0).toUpperCase() + name.slice(1),
    action: action,
    order_id: orderId || null,
    details: details
  });
  if (error) console.error('[activity] insert failed:', error.message, error);
}

// NAV HIGHLIGHTER
function highlightNav() {
  let path = window.location.pathname.split('/').pop() || 'index.html';
  if (path && !path.includes('.')) path += '.html';

  document.querySelectorAll('.dash-nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path) a.classList.add('active');
    else a.classList.remove('active');
  });
  // Mark parent group button active if a child matches
  document.querySelectorAll('.dash-nav .nav-group').forEach(group => {
    const hasActive = group.querySelector(`.nav-dropdown a[href="${path}"]`);
    const btn = group.querySelector('.nav-group-btn');
    if (btn) btn.classList.toggle('active', !!hasActive);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  highlightNav();
  const observer = new MutationObserver(highlightNav);
  const nav = document.querySelector('.dash-nav');
  if (nav) observer.observe(nav, { childList: true, subtree: true });
});

// ── Low Stock Discord Alert ───────────────────────────────────────────────────
async function sendLowStockAlert(item) {
  const count = item.spool_count ?? item.stock_count ?? 0;
  const threshold = item.reorder_spool_threshold ?? 1;
  const name = item.spool_name || item.name || 'Unknown Item';
  const url = item.purchase_url || null;
  const urgency = count === 0 ? '🚨 OUT OF STOCK' : '⚠️ Low Stock';
  const color = count === 0 ? 0xe09090 : 0xE8D08A;

  let description = `**${name}** is running low.\n> Stock: **${count}** remaining (threshold: ${threshold})`;
  if (url) description += `\n\n[🛒 Reorder Now](${url})`;

  await Promise.allSettled([
    sendDiscordAlert(urgency, description, color),
    db.functions.invoke('send-low-stock-email', { body: item })
  ]);
}


// ── Command Palette (Cmd+K / Ctrl+K) ─────────────────────────────────────────
(function() {
  const ACTIONS = [
    // Navigation
    { icon: '⬡', label: 'Hub — Dashboard Home',        hint: 'nav', action: () => { window.location.href = 'index.html'; } },
    { icon: '🖨', label: 'Queue — Print Queue',         hint: 'nav', action: () => { window.location.href = 'cadence-queue.html'; } },
    { icon: '📦', label: 'Fulfillment — Ship Orders',   hint: 'nav', action: () => { window.location.href = 'cadence-fulfillment.html'; } },
    { icon: '👤', label: 'Customers',                   hint: 'nav', action: () => { window.location.href = 'cadence-customers.html'; } },
    { icon: '✉', label: 'Messages',                    hint: 'nav', action: () => { window.location.href = 'cadence-messages.html'; } },
    { icon: '🐉', label: 'Creatures — Creature Editor', hint: 'nav', action: () => { window.location.href = 'cadence-creature-editor.html'; } },
    { icon: '📬', label: 'Email Blast',                 hint: 'nav', action: () => { window.location.href = 'cadence-email-blast.html'; } },
    { icon: '💰', label: 'P&L — Profit & Loss',        hint: 'nav', action: () => { window.location.href = 'cadence-creatures-pl-tracker.html'; } },
    { icon: '📊', label: 'Analytics — Sales Dashboard', hint: 'nav', action: () => { window.location.href = 'cadence-analytics.html'; } },
    { icon: '📈', label: 'Sales Intel — Demand Intelligence', hint: 'nav', action: () => { window.location.href = 'cadence-sales.html'; } },
    { icon: '🔴', label: 'Live — Real-Time Analytics', hint: 'nav', action: () => { window.location.href = 'cadence-live.html'; } },
    { icon: '🔗', label: 'Links',                       hint: 'nav', action: () => { window.location.href = 'cadence-links.html'; } },
    { icon: '📋', label: 'Activity Log',                hint: 'nav', action: () => { window.location.href = 'cadence-activity.html'; } },
    { icon: '⚙', label: 'Admin Settings',              hint: 'nav', action: () => { window.location.href = 'cadence-admin.html'; } },
    { icon: '🌐', label: 'Site Manager',                hint: 'nav', action: () => { window.location.href = 'cadence-site.html'; } },
    { icon: '↗', label: 'Open Live Site',               hint: 'external', action: () => { window.open('https://cadencecreatures.com', '_blank'); } },
    { icon: '↗', label: 'Open Etsy Shop',               hint: 'external', action: () => { window.open('https://etsy.com/shop/CadenceCreatures', '_blank'); } },
    // Actions
    { icon: '🚪', label: 'Sign Out',                    hint: 'action', action: () => { if(typeof signOut === 'function') signOut(); } },
  ];

  let activeIdx = 0;
  let filtered = [];

  function buildDOM() {
    if (document.getElementById('cc-palette-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'cc-palette-overlay';
    overlay.innerHTML = `
      <div id="cc-palette">
        <div id="cc-palette-input-wrap">
          <span class="palette-search-icon">⌕</span>
          <input id="cc-palette-input" placeholder="Search pages, actions, orders…" autocomplete="off" spellcheck="false" />
        </div>
        <div id="cc-palette-results"></div>
        <div id="cc-palette-footer">↑ ↓ navigate &nbsp;·&nbsp; ↵ select &nbsp;·&nbsp; Esc dismiss</div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('cc-palette-input').addEventListener('input', render);
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
  }

  function open() {
    buildDOM();
    document.getElementById('cc-palette-overlay').classList.add('open');
    const inp = document.getElementById('cc-palette-input');
    inp.value = '';
    render();
    inp.focus();
  }

  function close() {
    const overlay = document.getElementById('cc-palette-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  function render() {
    const q = (document.getElementById('cc-palette-input').value || '').toLowerCase().trim();
    const results = document.getElementById('cc-palette-results');
    activeIdx = 0;

    // Build filtered list: nav/action matches + optional order-search item
    filtered = q
      ? ACTIONS.filter(a => a.label.toLowerCase().includes(q))
      : ACTIONS.slice();

    if (q && q.length >= 2) {
      filtered.push({
        icon: '🔍',
        label: `Search orders for "${q}"`,
        hint: 'search',
        action: () => {
          window.location.href = `cadence-fulfillment.html?q=${encodeURIComponent(q)}`;
        }
      });
    }

    if (!filtered.length) {
      results.innerHTML = '<div style="padding:20px 18px;font-size:11px;color:rgba(196,188,178,0.35);letter-spacing:.06em">No results</div>';
      return;
    }

    const navItems = filtered.filter(i => i.hint === 'nav');
    const actionItems = filtered.filter(i => i.hint === 'action' || i.hint === 'external');
    const searchItems = filtered.filter(i => i.hint === 'search');

    let html = '';
    if (navItems.length) {
      html += `<div class="palette-group-label">Pages</div>`;
      html += navItems.map((item, i) => itemHTML(item, i)).join('');
    }
    let offset = navItems.length;
    if (actionItems.length) {
      html += `<div class="palette-group-label">Actions</div>`;
      html += actionItems.map((item, i) => itemHTML(item, offset + i)).join('');
      offset += actionItems.length;
    }
    if (searchItems.length) {
      html += `<div class="palette-group-label">Search</div>`;
      html += searchItems.map((item, i) => itemHTML(item, offset + i)).join('');
    }
    results.innerHTML = html;

    results.querySelectorAll('.palette-item').forEach((el, i) => {
      el.addEventListener('mouseenter', () => { activeIdx = i; setActive(); });
      el.addEventListener('click', () => execute(i));
    });
    setActive();
  }

  function itemHTML(item, idx) {
    return `<div class="palette-item${idx === 0 ? ' active' : ''}" data-idx="${idx}">
      <span class="palette-item-icon">${item.icon}</span>
      <span class="palette-item-label">${item.label}</span>
      <span class="palette-item-hint">${item.hint}</span>
    </div>`;
  }

  function setActive() {
    document.querySelectorAll('#cc-palette-results .palette-item').forEach((el, i) => {
      el.classList.toggle('active', i === activeIdx);
    });
    const active = document.querySelector('#cc-palette-results .palette-item.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function execute(idx) {
    const item = filtered[idx];
    if (item) { close(); item.action(); }
  }

  document.addEventListener('keydown', e => {
    const overlay = document.getElementById('cc-palette-overlay');
    const isOpen = overlay && overlay.classList.contains('open');

    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      isOpen ? close() : open();
      return;
    }
    if (!isOpen) return;

    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, filtered.length - 1);
      setActive(); return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      setActive(); return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      execute(activeIdx); return;
    }
  });
})();
