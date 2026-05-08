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
    applyRolePermissions();
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

    applyRolePermissions();
    if(typeof showApp === 'function') showApp();
  } else {
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
    const links = nav.querySelectorAll('a');
    links.forEach(a => {
      const href = a.getAttribute('href');
      const path = window.location.pathname;

      // Set Active state
      if(path.includes(href) && href !== 'index.html') a.classList.add('active');
      if((path.endsWith('/') || path.endsWith('index.html')) && href === 'index.html') a.classList.add('active');

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
    const { data: profile } = await db.from('profiles').select('full_name').eq('id', currentUser.id).single();
    if(profile && profile.full_name) displayName = profile.full_name;

    const right = document.querySelector('.topbar-right');
    if(right) {
      let greet = document.getElementById('user-greet');
      if(!greet) {
        greet = document.createElement('div');
        greet.id = 'user-greet';
        greet.style = 'font-size:11px; color:var(--goldl); font-weight:500; margin-right:15px; border-right:1px solid rgba(201,168,76,0.2); padding-right:15px;';
        right.insertBefore(greet, right.firstChild);
      }
      greet.textContent = `User: ${displayName.charAt(0).toUpperCase() + displayName.slice(1)}`;
    }

    // HIDE REVENUE KPI FOR NON-ADMINS
    const revCard = document.getElementById('kpi-revenue-card');
    if(revCard && role !== 'admin') {
      revCard.style.display = 'none';
    }
  }
  
  const path = window.location.pathname;
  if((path.includes('cadence-admin.html') || path.includes('cadence-activity.html')) && role !== 'admin') {
    window.location.href = 'index.html';
  }
  if(path.includes('cadence-creatures-pl-tracker.html') && role === 'fulfillment') window.location.href='index.html';
  if((path.includes('cadence-fulfillment.html') || path.includes('cadence-queue.html')) && role === 'finance') window.location.href='index.html';
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
