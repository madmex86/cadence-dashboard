const PW='Cadence4513!';
const SK='cc_hub_auth';

// Initialize Supabase Globally
const supabaseUrl = 'https://ufqiysdgmxrhonnfsgts.supabase.co';
const supabaseKey = 'sb_publishable_7mkBL1lsKUNJEmqSd2HT9Q_Z4xHoBec';
const db = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;

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
    applyRolePermissions();
    if(typeof showApp === 'function') showApp();
  } else {
    // Force redirect to Hub if they are on a protected page without a session
    if(typeof showApp !== 'function' && !window.location.pathname.includes('index.html')) {
      window.location.href = 'index.html';
    }
  }
});

function applyRolePermissions() {
  if(!currentUser) return;
  const role = currentUser.user_metadata?.role || 'user';
  
  const nav = document.querySelector('.dash-nav');
  if(nav) {
    if(role === 'admin') {
      if(!nav.querySelector('a[href="cadence-admin.html"]')) {
        const adminTab = document.createElement('a');
        adminTab.href = 'cadence-admin.html';
        adminTab.textContent = 'Admin';
        if(window.location.pathname.includes('cadence-admin.html')) adminTab.className = 'active';
        const liveSite = nav.querySelector('a[href*="cadencecreatures.com"]');
        if(liveSite) nav.insertBefore(adminTab, liveSite);
        else nav.appendChild(adminTab);
      }
    }
    
    const links = nav.querySelectorAll('a');
    links.forEach(a => {
      const href = a.getAttribute('href');
      if(href.includes('cadence-creatures-pl-tracker.html') && role === 'fulfillment') a.style.display = 'none';
      if((href.includes('cadence-fulfillment.html') || href.includes('cadence-queue.html')) && role === 'finance') a.style.display = 'none';
    });
  }
  
  const path = window.location.pathname;
  if(path.includes('cadence-admin.html') && role !== 'admin') {
    document.body.innerHTML = '<div style="padding:50px;text-align:center;color:#E8D08A;font-family:\'Lora\',serif;font-size:24px;">403 Forbidden. Admin Access Required.</div>';
  }
  if(path.includes('cadence-creatures-pl-tracker.html') && role === 'fulfillment') window.location.href='index.html';
  if((path.includes('cadence-fulfillment.html') || path.includes('cadence-queue.html')) && role === 'finance') window.location.href='index.html';
}
