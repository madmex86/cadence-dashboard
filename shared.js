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
    await applyRolePermissions();
    if(typeof showApp === 'function') showApp();
  }
}

async function signOut(){
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
      if(isAdminOnly && role !== 'admin') {
        a.style.display = 'none';
      }

      // FULFILLMENT ROLE TABS
      if(role === 'fulfillment' && (href.includes('pl-tracker') || href.includes('admin') || href.includes('activity'))) {
        a.style.display = 'none';
      }
      
      // FINANCE ROLE TABS
      if(role === 'finance' && (href.includes('fulfillment') || href.includes('queue'))) {
        a.style.display = 'none';
      }
    });

    // DISPLAY USER NAME
    let displayName = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
    try {
      const { data: profile } = await db.from('profiles').select('full_name').eq('id', currentUser.id).single();
      if(profile && profile.full_name) displayName = profile.full_name;
    } catch(e) { console.warn('Profile fetch failed, using default name'); }

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
    if(revCard && role !== 'admin') {
      revCard.style.display = 'none';
    }

    // INJECT UNIFIED CONNECTION HUB
    if(right) {
      let connHub = document.getElementById('conn-hub');
      if(!connHub) {
        connHub = document.createElement('div');
        connHub.id = 'conn-hub';
        connHub.style = 'display:flex; align-items:center; gap:12px; margin-right:15px;';
        right.insertBefore(connHub, right.querySelector('.topbar-link'));
      }
      connHub.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px; font-size:10px; color:rgba(196,188,178,0.5); letter-spacing:0.05em;">
          <div style="width:6px; height:6px; border-radius:50%; background:#4a8c5c;"></div> Cloud Sync
        </div>
        <div id="master-printer-pill" style="display:flex; align-items:center; gap:6px; font-size:10px; padding:4px 10px; border:1px solid rgba(91,191,212,0.2); color:#5BBFD4; border-radius:12px; background:rgba(91,191,212,0.05); white-space:nowrap;">
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
  if((path.includes('cadence-admin.html') || path.includes('cadence-activity.html')) && role !== 'admin') {
    window.location.href = 'index.html';
  }
  if(path.includes('cadence-creatures-pl-tracker.html') && role === 'fulfillment') window.location.href='index.html';
  if((path.includes('cadence-fulfillment.html') || path.includes('cadence-queue.html')) && role === 'finance') window.location.href='index.html';
}

async function updateMasterPrinterStatus() {
  const pill = document.getElementById('master-printer-pill');
  if(!pill) return;
  
  const { data: printer } = await db.from('printers').select('*').eq('name', 'Vision').single();
  if(printer) {
    if(printer.current_creature_id) {
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
  }
}

// EMAIL AUTOMATION (EmailJS)
function initEmail() {
  if (typeof emailjs !== 'undefined') {
    emailjs.init({ publicKey: "Kf28oWCMQdU-MdlL2" });
    console.log('EmailJS Initialized');
  }
}

// Initialize on Load
window.addEventListener('load', initEmail);

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

// UNIVERSAL DASHBOARD STYLES (Enforces symmetry across all pages)
const styleShield = document.createElement('style');
styleShield.textContent = `
  .topbar { 
    display: flex !important; 
    justify-content: space-between !important; 
    align-items: center !important; 
    height: 64px !important; 
    padding: 0 28px !important; 
    background: rgba(28, 22, 18, 0.95) !important;
    border-bottom: 1px solid rgba(201, 168, 76, 0.15) !important;
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
    background: rgba(0,0,0,0.2) !important; 
    padding: 0 16px !important; 
    gap: 0 !important;
    border-bottom: 1px solid rgba(201, 168, 76, 0.1) !important;
    overflow-x: auto !important;
  }
  .dash-nav a { 
    font-family: 'Lora', serif !important;
    font-size: 10px !important;
    padding: 12px 18px !important;
    text-transform: uppercase !important;
    letter-spacing: 0.15em !important;
    color: rgba(196, 188, 178, 0.5) !important;
    text-decoration: none !important;
    border-bottom: 3px solid transparent !important;
    transition: all 0.2s ease !important;
    position: relative !important;
    display: inline-block !important;
  }
  .dash-nav a.active { 
    color: #E8D08A !important; 
    border-bottom: 3px solid #C9A84C !important;
    background: rgba(201, 168, 76, 0.05) !important;
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
`;
document.head.appendChild(styleShield);

async function logActivity(action, orderId = null, details = null) {
  if(!currentUser) return;
  
  // Get best name
  let name = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
  const { data: profile } = await db.from('profiles').select('full_name').eq('id', currentUser.id).single();
  if(profile && profile.full_name) name = profile.full_name;

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
