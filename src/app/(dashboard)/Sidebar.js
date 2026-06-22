'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from './Sidebar.module.css';

const NAV_GROUPS = [
  { label: 'PRODUCTION', children: [
    { label: 'Queue',       href: '/queue',       icon: '▦' },
    { label: 'Live',        href: '/live',        icon: '◉' },
    { label: 'Fulfillment', href: '/fulfillment', icon: '✓' },
    { label: 'Printers',    href: '/printers',    icon: '▣' },
    { label: 'Filament',    href: '/inventory',   icon: '≋' },
  ]},
  { label: 'CATALOG', children: [
    { label: 'Creatures',    href: '/creatures',    icon: '◈' },
    { label: 'Bundles',      href: '/bundles',      icon: '⊛' },
    { label: 'Components',   href: '/components',   icon: '⊞' },
    { label: 'Lure Forge',   href: '/lure-forge',   icon: '◬' },
    { label: 'Asset Studio', href: '/asset-studio', icon: '◫' },
    { label: 'Review Forge', href: '/reviews',      icon: '⊙' },
    { label: 'Cami Edition', href: '/cami',         icon: '♡' },
  ]},
  { label: 'COMMERCE', children: [
    { label: 'Sales Intel',  href: '/sales',                 icon: '≈' },
    { label: 'P&L',          href: '/pl',                    icon: '$' },
    { label: 'Analytics',    href: '/analytics',             icon: '∿' },
    { label: 'Cost Engine',  href: '/queue?tab=cost-engine', icon: '⊗' },
    { label: 'Launch',       href: '/launch',                icon: '↑' },
  ]},
  { label: 'CUSTOMERS', children: [
    { label: 'Customers',   href: '/customers',   icon: '○' },
    { label: 'Email Blast', href: '/email-blast', icon: '◎' },
  ]},
  { label: 'OPS', children: [
    { label: 'Site',     href: '/site',     icon: '◆' },
    { label: 'Links',    href: '/links',    icon: '⊹' },
    { label: 'Activity', href: '/activity', icon: '◑' },
    { label: 'Admin',    href: '/admin',    icon: '◇' },
  ]},
];

const SERVICES = [
  { name: 'Supabase', color: '#4a8c5c' },
  { name: 'Vercel',   color: '#4a8c5c' },
  { name: 'AI API',   color: '#4a8c5c' },
  { name: 'Discord',  color: '#4a8c5c' },
  { name: 'Mail',     color: '#4a8c5c' },
  { name: 'Etsy',     color: '#4a8c5c' },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [loadingRole, setLoadingRole] = useState(true);
  const [hudData, setHudData] = useState({ visitors: 0, profit: 0, printersActive: 0 });
  const [customRolePaths,  setCustomRolePaths]  = useState(null); // null = built-in role; string[] = custom role
  const [userCustomPaths,  setUserCustomPaths]  = useState(null); // null = use role; string[] = per-user override
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user);
      if (!user) { setLoadingRole(false); return; }

      let name = user.user_metadata?.full_name;
      let role = 'user';

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name, custom_paths')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          role = profile.role || 'user';
          if (profile.full_name) name = profile.full_name;
          if (Array.isArray(profile.custom_paths)) {
            setUserCustomPaths(profile.custom_paths);
          }
        } else {
          const isOwner = user.email === 'stevenportugal86@gmail.com';
          role = isOwner ? 'admin' : 'user';
          if (!name) name = user.email.split('@')[0];
          await supabase.from('profiles').insert({
            id: user.id, email: user.email, full_name: name, role,
          });
        }
      } catch (err) {
        console.error('Sidebar profile error:', err);
        role = user.email === 'stevenportugal86@gmail.com' ? 'admin' : 'user';
      }

      setUserRole(role);
      setLoadingRole(false);
      if (!name) name = user.email.split('@')[0];
      setUserName(name.charAt(0).toUpperCase() + name.slice(1));

      // Load custom role permissions if needed
      const BUILTIN = ['admin', 'fulfillment', 'finance', 'user'];
      if (!BUILTIN.includes(role)) {
        const { data: roleData } = await supabase.from('roles').select('allowed_paths').eq('name', role).maybeSingle();
        setCustomRolePaths(roleData?.allowed_paths || []);
      }
    });

    async function loadHud() {
      try {
        const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from('site_analytics')
          .select('session_id', { count: 'exact', head: true })
          .gte('created_at', since);

        const today = new Date().toISOString().split('T')[0];
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [finRes, ordRes] = await Promise.all([
          supabase.from('finance').select('entry_type,amount,order_id').eq('entry_date', today),
          supabase.from('orders').select('total_amount').neq('status', 'cancelled').gte('created_at', startOfToday.toISOString()),
        ]);

        let net = 0;
        if (finRes.data) net += finRes.data.filter(f => !f.order_id).reduce((s, r) => s + (r.entry_type === 'income' ? +r.amount : -+r.amount), 0);
        if (ordRes.data) net += ordRes.data.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);

        const { data: prData } = await supabase.from('printers').select('current_creature_id').eq('active', true);
        const activeCount = prData ? prData.filter(p => p.current_creature_id).length : 0;

        setHudData({ visitors: count || 0, profit: net, printersActive: activeCount });
      } catch (e) {
        console.error('HUD load error', e);
      }
    }
    loadHud();
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  function isLinkAllowed(href) {
    if (!user) return false;
    const isOwner = user.email === 'stevenportugal86@gmail.com';
    const isAdmin = isOwner || userRole === 'admin';

    // Per-user override takes highest priority
    if (userCustomPaths !== null) {
      const base = href.split('?')[0];
      return userCustomPaths.some(p => base === p || base.startsWith(p + '/'));
    }

    // Custom role: only show pages explicitly granted
    const BUILTIN = ['admin', 'fulfillment', 'finance', 'user'];
    if (!BUILTIN.includes(userRole) && !isAdmin) {
      if (customRolePaths === null) return false; // still loading
      const base = href.split('?')[0];
      return customRolePaths.some(p => base === p || base.startsWith(p + '/'));
    }

    // Built-in role logic (copied from Topbar.js — do not simplify)
    const adminOnlyPaths = ['/admin', '/activity', '/bundles', '/cami', '/launch', '/email', '/site', '/links', '/lure-forge', '/reviews', '/asset-studio'];
    if (adminOnlyPaths.some(p => href.startsWith(p))) return isAdmin;

    const productionPaths = ['/queue', '/live', '/components', '/inventory', '/printers', '/fulfillment'];
    if (productionPaths.some(p => href.startsWith(p))) return isAdmin || userRole === 'fulfillment';

    const financePaths = ['/sales', '/pl', '/mileage', '/analytics'];
    if (financePaths.some(p => href.startsWith(p))) return isAdmin || userRole === 'finance';

    if (userRole === 'user') {
      if (productionPaths.concat(financePaths).some(p => href.startsWith(p))) return false;
    }

    return true;
  }

  function toggleGroup(label) {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));
  }

  function isActive(href) {
    const base = href.split('?')[0];
    return pathname === base || (base !== '/' && pathname.startsWith(base));
  }

  const profitColor = hudData.profit > 0 ? '#7dc994' : hudData.profit < 0 ? '#e09090' : '#E8D08A';

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className={styles.hamburger}
        onClick={() => setMobileOpen(o => !o)}
        aria-label="Toggle navigation"
        type="button"
      >
        <span /><span /><span />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar}${mobileOpen ? ' ' + styles.sidebarOpen : ''}`}>
        <div className={styles.noise} aria-hidden="true" />

        <div className={styles.inner}>

          {/* Brand header */}
          <div className={styles.brand}>
            <Link href="/">
              <svg
                className={styles.crown}
                width="40"
                height="31"
                viewBox="0 -2 76 52"
                fill="none"
                aria-hidden="true"
              >
                <path d="M6 44 L6 18 L22 32 L36 4 L50 32 L66 18 L66 44 Z" fill="none" stroke="#C9A84C" strokeWidth="2.5" strokeLinejoin="round" />
                <rect x="4" y="42" width="64" height="3" rx="1.5" fill="#C9A84C" />
                <circle cx="36" cy="4" r="5.5" fill="#E8D08A" />
                <circle cx="6" cy="18" r="4" fill="#5BBFD4" />
                <circle cx="66" cy="18" r="4" fill="#5BBFD4" />
              </svg>
            </Link>
            <span className={styles.brandName}>Cadence Creatures</span>
            <span className={styles.brandSub}>Back Office</span>
            <div className={styles.statusRow}>
              <div className={styles.pulsingDot} />
              <span className={styles.statusLabel}>sys.online</span>
            </div>
          </div>

          <div className={styles.divider} />

          {/* HUD strip */}
          <div className={styles.hud}>
            <div className={styles.hudPill}>
              <span className={styles.hudLabel}>Live</span>
              <span className={styles.hudVal} style={{ color: '#5BBFD4' }}>
                {hudData.visitors}&nbsp;{hudData.visitors === 1 ? 'visitor' : 'visitors'}
              </span>
            </div>
            <div className={styles.hudPill}>
              <span className={styles.hudLabel}>Today</span>
              <span className={styles.hudVal} style={{ color: profitColor }}>
                {hudData.profit >= 0 ? '+' : '-'}${Math.abs(hudData.profit).toFixed(2)}
              </span>
            </div>
            <div className={styles.hudPill}>
              <span className={styles.hudLabel}>Printing</span>
              <span className={styles.hudVal} style={{ color: hudData.printersActive > 0 ? '#5BBFD4' : 'rgba(196,188,178,0.28)' }}>
                {hudData.printersActive > 0 ? `${hudData.printersActive} active` : 'idle'}
              </span>
            </div>
          </div>

          <div className={styles.divider} />

          {/* Navigation */}
          <nav className={styles.nav} aria-label="Main navigation">
            {loadingRole ? (
              <div className={styles.navLoading}>loading…</div>
            ) : (
              NAV_GROUPS.map(group => {
                const allowedLinks = group.children.filter(c => isLinkAllowed(c.href));
                if (allowedLinks.length === 0) return null;
                const isCollapsed = collapsed[group.label] === true;

                return (
                  <div className={styles.navGroup} key={group.label}>
                    <button
                      className={styles.navGroupHeader}
                      onClick={() => toggleGroup(group.label)}
                      type="button"
                    >
                      <span className={styles.navGroupLabel}>{group.label}</span>
                      <span className={styles.navGroupRule} />
                      <span className={isCollapsed ? styles.navChevronClosed : styles.navChevronOpen} style={{ fontSize: 7, color: 'rgba(201,168,76,0.28)' }}>
                        ▾
                      </span>
                    </button>

                    {!isCollapsed && (
                      <div className={styles.navLinks}>
                        {allowedLinks.map(link => (
                          <Link
                            key={link.href}
                            href={link.href}
                            className={`${styles.navLink}${isActive(link.href) ? ' ' + styles.navLinkActive : ''}`}
                            onClick={() => setMobileOpen(false)}
                          >
                            <span className={styles.navIcon}>{link.icon}</span>
                            <span className={styles.navLabel}>{link.label}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </nav>

          {/* Footer */}
          <div className={styles.footer}>
            {userName && <div className={styles.footerUser}>{userName}</div>}
            <span className={styles.roleBadge}>{userRole}</span>

            <div className={styles.footerExtLinks}>
              <a href="https://cadencecreatures.com" target="_blank" rel="noopener noreferrer" className={styles.footerExtLink}>Site ↗</a>
              <a href="https://etsy.com/shop/CadenceCreatures" target="_blank" rel="noopener noreferrer" className={styles.footerExtLink}>Etsy ↗</a>
            </div>

            <div className={styles.services}>
              <button
                className={styles.servicesBtn}
                onClick={() => setServicesOpen(o => !o)}
                type="button"
              >
                <div className={styles.connDot} />
                {SERVICES.length} services online&nbsp;{servicesOpen ? '▴' : '▾'}
              </button>
              {servicesOpen && (
                <div className={styles.servicesExpanded}>
                  {SERVICES.map(s => (
                    <div key={s.name} className={styles.serviceRow}>
                      <div className={styles.connDot} style={{ background: s.color, boxShadow: `0 0 4px ${s.color}88` }} />
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.footerActions}>
              <button className={styles.signOut} onClick={signOut} type="button">
                Sign Out
              </button>
              <span className={styles.version}>v1.0.0 · Launchpad</span>
            </div>
          </div>

        </div>
      </aside>
    </>
  );
}
