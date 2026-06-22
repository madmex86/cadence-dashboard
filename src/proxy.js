import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function proxy(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value, options));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // 1. Unauthenticated users must log in (except for API routes, which handle their own auth)
  if (!user && pathname !== '/login' && pathname !== '/set-password' && !pathname.startsWith('/api')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 2. Logged-in users should not see the login screen
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  if (user) {
    let role = 'user';
    const isOwner = user.email === 'stevenportugal86@gmail.com';

    try {
      // Look up current role in profiles database table
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, custom_paths')
        .eq('id', user.id)
        .maybeSingle();

      if (profile && profile.role) {
        role = profile.role;
      } else {
        // Auto-initialize profile record if it doesn't exist yet
        role = isOwner ? 'admin' : (user.user_metadata?.role || 'user');
        const fullName = user.user_metadata?.full_name || user.email.split('@')[0];
        
        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          full_name: fullName,
          role: role
        });
      }
    } catch (err) {
      console.error("Proxy profile lookup/sync error:", err);
      // Fallback role resolution in case of network issues
      role = isOwner ? 'admin' : (user.user_metadata?.role || 'user');
    }

    const isAdmin = isOwner || role === 'admin';
    const BUILTIN_ROLES = ['admin', 'fulfillment', 'finance', 'user'];

    // Per-user custom_paths override: takes priority over all role-based guards
    if (!isAdmin && Array.isArray(profile?.custom_paths)) {
      const allowedPaths = profile.custom_paths;
      const pathAllowed = pathname === '/' || allowedPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
      if (!pathAllowed) {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
      return supabaseResponse; // per-user override passed — skip role guards
    }

    if (!isAdmin && !BUILTIN_ROLES.includes(role)) {
      // Custom role: fetch allowed_paths and enforce them
      try {
        const { data: roleData } = await supabase.from('roles').select('allowed_paths').eq('name', role).maybeSingle();
        const allowedPaths = roleData?.allowed_paths || [];
        const pathAllowed = pathname === '/' || allowedPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
        if (!pathAllowed) {
          const url = request.nextUrl.clone();
          url.pathname = '/';
          return NextResponse.redirect(url);
        }
      } catch {
        // On error, fall back to home for safety
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
      return supabaseResponse; // custom role passed — skip built-in guards
    }

    // 3. Finance role constraints: no production, queue, or fulfillment access
    if (role === 'finance' && (pathname.startsWith('/queue') || pathname.startsWith('/fulfillment'))) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    // 4. Fulfillment role constraints: no commerce, sales, profit and loss, admin pages, or activity
    if (role === 'fulfillment' && ['/pl', '/analytics', '/sales', '/admin', '/activity'].some(p => pathname.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    // 5. General User role constraints: blocks all production and commerce pages
    if (role === 'user' && ['/queue', '/fulfillment', '/inventory', '/printers', '/components', '/live', '/pl', '/analytics', '/sales', '/mileage'].some(p => pathname.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    // 6. Non-admin general folder constraints
    if (!isAdmin && ['/admin', '/activity', '/bundles', '/cami', '/launch', '/email', '/site', '/links', '/lure-forge', '/reviews'].some(p => pathname.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
