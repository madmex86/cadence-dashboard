"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const NAV_GROUPS = [
  { label: "PRODUCTION", children: [
    { label: "Orders", href: "/queue" },
    { label: "Stock & Queue", href: "/live" },
    { label: "Components", href: "/components" },
    { label: "Filament", href: "/inventory" },
    { label: "Printers", href: "/printers" },
    { label: "Fulfillment", href: "/fulfillment" },
  ]},
  { label: "COMMERCE", children: [
    { label: "Sales Intel", href: "/sales" },
    { label: "P&L", href: "/pl" },
    { label: "Cost Engine", href: "/queue?tab=cost-engine" },
    { label: "Launch", href: "/launch" },
    { label: "Analytics", href: "/analytics" },
  ]},
  { label: "CATALOG", children: [
    { label: "Creatures", href: "/creatures" },
    { label: "Cami Edition", href: "/cami" },
    { label: "Review Forge", href: "/reviews" },
    { label: "Lure Forge", href: "/lure-forge" },
  ]},
  { label: "CUSTOMERS", children: [
    { label: "Customers", href: "/customers" },
    { label: "Email Blast", href: "/email-blast" },
  ]},
  { label: "OPS", children: [
    { label: "Site", href: "/site" },
    { label: "Links", href: "/links" },
    { label: "Activity", href: "/activity" },
    { label: "Admin", href: "/admin" },
  ]},
];

export default function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("user");
  const [loadingRole, setLoadingRole] = useState(true);
  const [openGroup, setOpenGroup] = useState(null);
  const [hudData, setHudData] = useState({ visitors: 0, profit: 0, printersActive: 0 });
  const navRef = useRef(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user);
      if (user) {
        let name = user.user_metadata?.full_name;
        let role = 'user';

        try {
          // Check if user has a profile record, if not insert it
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', user.id)
            .maybeSingle();

          if (profile) {
            role = profile.role || 'user';
            if (profile.full_name) {
              name = profile.full_name;
            }
          } else {
            // Profile does not exist, insert it!
            const isOwner = user.email === 'stevenportugal86@gmail.com';
            role = isOwner ? 'admin' : 'user';
            if (!name) {
              name = user.email.split('@')[0];
            }
            
            await supabase
              .from('profiles')
              .insert({
                id: user.id,
                email: user.email,
                full_name: name,
                role: role
              });
          }
        } catch (err) {
          console.error("Error checking/inserting profile in Topbar:", err);
          const isOwner = user.email === 'stevenportugal86@gmail.com';
          role = isOwner ? 'admin' : 'user';
        }

        setUserRole(role);
        setLoadingRole(false);

        if (!name) {
          name = user.email.split('@')[0];
        }
        // Capitalize the first letter
        name = name.charAt(0).toUpperCase() + name.slice(1);
        setUserName(name);
      } else {
        setLoadingRole(false);
      }
    });

    // Fetch HUD data
    async function loadHud() {
      try {
        // Visitors
        const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { count } = await supabase.from('site_analytics').select('session_id', { count: 'exact', head: true }).gte('created_at', since);
        
        // Profit Today
        const today = new Date().toISOString().split('T')[0];
        const { data: finData } = await supabase.from('finance').select('entry_type,amount').eq('entry_date', today);
        let net = 0;
        if (finData) {
          net = finData.reduce((s, r) => s + (r.entry_type === 'income' ? +r.amount : -+r.amount), 0);
        }

        // Active Printers
        const { data: prData } = await supabase.from('printers').select('current_creature_id').eq('active', true);
        const activeCount = prData ? prData.filter(p => p.current_creature_id).length : 0;

        setHudData({ visitors: count || 0, profit: net, printersActive: activeCount });
      } catch (e) {
        console.error("HUD load error", e);
      }
    }
    loadHud();

  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenGroup(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isLinkAllowed(href) {
    if (!user) return false;
    const isOwner = user.email === 'stevenportugal86@gmail.com';
    const isAdmin = isOwner || userRole === 'admin';

    // 1. Pages restricted to admin
    const adminOnlyPaths = ['/admin', '/activity', '/cami', '/launch', '/email', '/site', '/links', '/lure-forge', '/reviews'];
    if (adminOnlyPaths.some(p => href.startsWith(p))) {
      return isAdmin;
    }

    // 2. Pages restricted for finance (production pages)
    const productionPaths = ['/queue', '/live', '/components', '/inventory', '/printers', '/fulfillment'];
    if (productionPaths.some(p => href.startsWith(p))) {
      return isAdmin || userRole === 'fulfillment';
    }

    // 3. Pages restricted for fulfillment (finance/commerce pages)
    const financePaths = ['/sales', '/pl', '/mileage', '/analytics'];
    if (financePaths.some(p => href.startsWith(p))) {
      return isAdmin || userRole === 'finance';
    }

    // 4. Fallback for user role: they don't see production or commerce paths
    if (userRole === 'user') {
      if (productionPaths.concat(financePaths).some(p => href.startsWith(p))) {
        return false;
      }
    }

    return true;
  }

  return (
    <header className="topbar">
      <div className="topbar-row1">
        <Link href="/" className="topbar-brand">
          <svg width="44" height="34" viewBox="0 -2 76 52" fill="none" style={{ filter: 'drop-shadow(0 0 6px rgba(201,168,76,.25))', flexShrink: 0, marginRight: 10 }}>
            <path d="M6 44 L6 18 L22 32 L36 4 L50 32 L66 18 L66 44 Z" fill="none" stroke="#C9A84C" strokeWidth="2.5" strokeLinejoin="round" />
            <rect x="4" y="42" width="64" height="3" rx="1.5" fill="#C9A84C" />
            <circle cx="36" cy="4" r="5.5" fill="#E8D08A" />
            <circle cx="6" cy="18" r="4" fill="#5BBFD4" />
            <circle cx="66" cy="18" r="4" fill="#5BBFD4" />
          </svg>
          <div>
            <div className="topbar-name">Cadence Creatures</div>
            <div className="topbar-sub">BACK OFFICE &middot; POWERED BY WORDSMITH SYSTEMS</div>
          </div>
        </Link>

        <div className="topbar-right">
          <div className="conn-hub">
            <div className="conn-item" title="Supabase Real-time Database">
              <div className="conn-dot" style={{ background: '#4a8c5c' }}></div> Supabase
            </div>
            <div className="conn-item" title="Vercel Deployment">
              <div className="conn-dot" style={{ background: '#4a8c5c' }}></div> Vercel
            </div>
            <div className="conn-item" title="Anthropic AI API">
              <div className="conn-dot" style={{ background: '#4a8c5c' }}></div> AI API
            </div>
            <div className="conn-item" title="Discord Alerts">
              <div className="conn-dot" style={{ background: '#4a8c5c' }}></div> Discord
            </div>
            <div className="conn-item" title="Email Engine (Resend)">
              <div className="conn-dot" style={{ background: '#4a8c5c' }}></div> Mail
            </div>
            <div className="conn-item" title="Etsy Webhook">
              <div className="conn-dot" style={{ background: '#4a8c5c' }}></div> Etsy
            </div>
          </div>
          <span className="topbar-user" style={{fontFamily: "'Lora', serif", color: "#E8D08A", fontWeight: 500}}>
            {userName ? `Welcome, ${userName}` : ""}
          </span>
          <a href="https://cadencecreatures.com" target="_blank" rel="noopener noreferrer" className="topbar-link">Site ↗</a>
          <a href="https://etsy.com/shop/CadenceCreatures" target="_blank" rel="noopener noreferrer" className="topbar-link">Etsy ↗</a>
          <button className="topbar-signout" onClick={signOut}>Sign Out</button>
        </div>
      </div>

      <div className="cc-hud">
        <div className="hud-live-dot" title="Visitors active in the last 5 minutes" style={{ background: hudData.visitors > 0 ? '#7dc994' : 'rgba(196,188,178,0.3)' }}></div>
        <div className="hud-pill">
          <span className="hud-label">Live</span>
          <span className="hud-val">{hudData.visitors} visitors</span>
        </div>
        <div className="hud-sep"></div>
        <div className="hud-pill">
          <span className="hud-label">Today</span>
          <span className="hud-val" style={{ color: hudData.profit > 0 ? '#7dc994' : hudData.profit < 0 ? '#e09090' : '#E8D08A' }}>
            {hudData.profit >= 0 ? '+' : '-'}${Math.abs(hudData.profit).toFixed(2)}
          </span>
        </div>
        <div className="hud-sep"></div>
        <div className="hud-pill">
          <span className="hud-label">Printing</span>
          <span className="hud-val" style={{ color: hudData.printersActive > 0 ? '#5BBFD4' : 'rgba(196,188,178,0.4)' }}>
            {hudData.printersActive > 0 ? `${hudData.printersActive} active` : 'Idle'}
          </span>
        </div>
      </div>

      <nav className="dash-nav" ref={navRef}>
        {loadingRole ? (
          <div style={{ color: "var(--dim)", fontSize: 13, padding: "8px 12px", fontFamily: "sans-serif" }}>Loading access controls…</div>
        ) : (
          NAV_GROUPS.map(group => {
            const allowedChildren = group.children.filter(c => isLinkAllowed(c.href));
            if (allowedChildren.length === 0) return null;

            const isOpen = openGroup === group.label;
            const active = allowedChildren.some(c => pathname.startsWith(c.href));

            return (
              <div className="nav-group" key={group.label}>
                <button
                  className={`nav-group-btn${active ? " active" : ""}`}
                  onClick={() => setOpenGroup(isOpen ? null : group.label)}
                  type="button"
                >
                  {group.label}
                </button>
                {isOpen && (
                  <div className="nav-dropdown">
                    {allowedChildren.map(link => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={pathname.startsWith(link.href) ? "active" : ""}
                        onClick={() => setOpenGroup(null)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </nav>

      {/* Sub-nav: inline link strip for the active group — no overlay, no blocking */}
      {!loadingRole && (() => {
        const activeGroup = NAV_GROUPS.find(g =>
          g.children.filter(c => isLinkAllowed(c.href)).some(c => pathname.startsWith(c.href))
        );
        if (!activeGroup) return null;
        const links = activeGroup.children.filter(c => isLinkAllowed(c.href));
        return (
          <div className="subnav">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`subnav-link${pathname.startsWith(link.href) ? " active" : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        );
      })()}
    </header>
  );
}
