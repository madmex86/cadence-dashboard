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

async function signOut(){
  sessionStorage.removeItem('cc_user_name');
  await db.auth.signOut();
  location.reload();
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
    if(loginCont) loginCont.style.display = 'flex';

    // Force redirect to Hub if they are on a protected page without a session
    if(typeof showApp !== 'function' && !window.location.pathname.includes('index.html')) {
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
  if((path.includes('cadence-admin.html') || path.includes('cadence-activity.html')) && role !== 'admin') window.location.href = 'index.html';
  if(path.includes('cadence-creatures-pl-tracker.html') && role === 'fulfillment') window.location.href='index.html';
  if((path.includes('cadence-fulfillment.html') || path.includes('cadence-queue.html')) && role === 'finance') window.location.href='index.html';
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
  /* Global Dashboard Reset */
  html { font-size: 14px; }
  body { 
    background: #0E0C09 !important; 
    color: #FAF6F0 !important; 
    margin: 0 !important; 
    padding: 0 !important;
    font-family: 'Lora', serif;
    font-size: 14px;
    line-height: 1.5;
    min-height: 100vh;
  }

  #app {
    min-height: 100vh !important;
    width: 100% !important;
    display: block !important;
  }

  .topbar { 
    display: flex !important; 
    justify-content: space-between !important; 
    align-items: center !important; 
    height: 64px !important; 
    padding: 0 28px !important; 
    background: rgba(28, 22, 18, 0.98) !important;
    border-bottom: 1px solid rgba(201, 168, 76, 0.15) !important;
    flex-shrink: 0 !important;
    width: 100% !important;
  }
  .topbar-left { display: flex !important; align-items: center !important; gap: 12px !important; }
  .topbar-right { display: flex !important; align-items: center !important; gap: 20px !important; }
  
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
  #login-screen { display: none !important; }
  .topbar-link:hover { color: #E8D08A !important; }

  /* Dashboard Components */
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
  .kpi-card { background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(201, 168, 76, 0.12); padding: 24px 20px; border-radius: 6px; text-align: center; }
  .kpi-label { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #8A7D6E; margin-bottom: 8px; }
  .kpi-val { font-size: 28px; font-weight: 600; color: #E8D08A; }

  .btn { font-family: inherit; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; padding: 8px 16px; cursor: pointer; border: 1px solid rgba(201, 168, 76, 0.3); background: transparent; color: #E8D08A; transition: all .2s; border-radius: 2px; outline: none; }
  .btn:hover { background: rgba(201, 168, 76, 0.1); border-color: #C9A84C; }
  .btn.pri { background: rgba(201, 168, 76, 0.14); border-color: #C9A84C; }
  .btn.pri:hover { background: rgba(201, 168, 76, .22); }

  .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, .7); z-index: 1000; display: none; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); }
  .overlay.open { display: flex; }
  .modal { background: #1e1a15; border: 1px solid rgba(201, 168, 76, .2); max-width: 500px; width: 100%; padding: 26px; max-height: 90vh; overflow-y: auto; border-radius: 3px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
  .modal-t { font-size: 14px; font-weight: 500; color: #E8D08A; margin-bottom: 18px; text-transform: uppercase; letter-spacing: 0.1em; }
  .modal-act { display: flex; gap: 10px; margin-top: 18px; justify-content: flex-end; }

  .fg { display: grid; gap: 11px; }
  .fr { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
  .fl { display: block; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: rgba(196, 188, 178, 0.7); margin-bottom: 5px; }

  input, select, textarea { width: 100%; background: rgba(255, 255, 255, .04); border: 1px solid rgba(201, 168, 76, 0.12); color: #FAF6F0; font-family: inherit; font-size: 13px; padding: 10px 12px; outline: none; border-radius: 2px; transition: border-color 0.2s; }
  input:focus, select:focus, textarea:focus { border-color: rgba(201, 168, 76, .38); background: rgba(255, 255, 255, 0.06); }
  select option { background: #1a1610; color: #FAF6F0; }

  .toast { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%) translateY(14px); background: #1C1612; border: 1px solid rgba(201, 168, 76, .3); color: #E8D08A; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; padding: 10px 24px; opacity: 0; transition: all .25s ease; pointer-events: none; z-index: 9999; border-radius: 2px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  .toast.ok { border-color: rgba(74, 140, 92, .4); color: #7dc994; }
  .toast.err { border-color: rgba(168, 68, 68, .4); color: #e09090; }

  /* Connection Hub Specifics */
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
  
  // Get best name
  // Get best name from cache or metadata
  let name = sessionStorage.getItem('cc_user_name') || currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];

  try {
    await db.from('activity_log').insert({
      user_id: currentUser.id,
      user_name: name.charAt(0).toUpperCase() + name.slice(1),
      action: action,
      order_id: orderId,
      details: details
    });
  } catch(e) {
    console.error('Logging Failed:', e);
  }
}
