import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM = 'Cadence Creatures <news@cadencecreatures.com>';
const LOGO_URL = 'https://cadencecreatures.com/assets/cc-logo.png';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

const FOOTER = (unsub: string) => `
  <tr><td style="background:#1a1610;padding:28px 40px 24px;">
    <div style="text-align:center;margin-bottom:14px;">
      <a href="https://instagram.com/cadencecreatures" style="display:inline-block;margin:0 8px;color:#C9A84C;font-size:10px;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;">Instagram</a>
      <span style="color:#3a3020;">&middot;</span>
      <a href="https://tiktok.com/@cadencecreatures" style="display:inline-block;margin:0 8px;color:#C9A84C;font-size:10px;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;">TikTok</a>
      <span style="color:#3a3020;">&middot;</span>
      <a href="https://facebook.com/cadencecreatures" style="display:inline-block;margin:0 8px;color:#C9A84C;font-size:10px;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;">Facebook</a>
      <span style="color:#3a3020;">&middot;</span>
      <a href="https://etsy.com/shop/CadenceCreatures" style="display:inline-block;margin:0 8px;color:#C9A84C;font-size:10px;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;">Etsy Shop</a>
    </div>
    <div style="text-align:center;margin-bottom:16px;">
      <a href="https://cadencecreatures.com" style="display:block;color:#e8d8b0;font-size:13px;font-family:Georgia,serif;text-decoration:none;margin-bottom:4px;">cadencecreatures.com</a>
      <span style="font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#4a3f2f;">Born from love. Built to be held.</span>
    </div>
    <div style="text-align:center;border-top:1px solid #2a2218;padding-top:14px;">
      <p style="margin:0;font-size:11px;color:#5a5040;line-height:1.7;">&copy; 2026 Cadence Creatures &middot; Visalia, CA<br/><a href="${unsub}" style="color:#5a5040;">Unsubscribe</a></p>
    </div>
  </td></tr>`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { name, email, creature_name, drop_date, unsubscribe_url } = await req.json();
    if (!email) return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    
    const unsub = unsubscribe_url || `https://cadencecreatures.com/unsubscribe.html?email=${encodeURIComponent(email)}`;
    
    const greeting = name ? `Hello ${name},` : `Hello,`;
    const creature = creature_name || "A beloved creature";
    const dateText = drop_date ? ` dropping on ${drop_date}` : " restocking very soon";
    
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f1eb;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1eb;padding:32px 0;"><tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;background:#fff;border-radius:6px;overflow:hidden;font-family:Georgia,serif;box-shadow:0 2px 12px rgba(0,0,0,.07);">
  <tr><td style="background:#1a1610;height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td style="background:#fff;padding:28px 40px 20px;text-align:center;border-bottom:1px solid #ede9e1;">
    <img src="${LOGO_URL}" alt="Cadence Creatures" width="190" style="display:block;margin:0 auto;max-width:190px;height:auto;"/>
  </td></tr>
  <tr><td style="padding:36px 40px;color:#333;">
    <h1 style="font-size:24px;font-weight:400;color:#1a1610;margin:0 0 16px;font-family:Georgia,serif;">${creature} has returned!</h1>
    <p style="font-size:15px;line-height:1.8;margin:0 0 16px;">${greeting}</p>
    <p style="font-size:15px;line-height:1.8;margin:0 0 28px;">We wanted to let you know that <strong>${creature}</strong> is ${dateText}. Keep your eyes peeled and grab yours before they disappear into the wild again.</p>
    <a href="https://cadencecreatures.com" style="display:inline-block;background:#C9A84C;color:#1a1610;text-decoration:none;padding:12px 28px;border-radius:3px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-family:sans-serif;font-weight:600;">Visit the Shop</a>
  </td></tr>
  ${FOOTER(unsub)}
</table></td></tr></table></body></html>`;

    const text = `${creature} has returned!\n\n${greeting}\nWe wanted to let you know that ${creature} is ${dateText}.\n\nVisit: https://cadencecreatures.com\n\n---\nUnsubscribe: ${unsub}`;
    
    const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: FROM, to: [email], subject: `${creature} is back! ✦`, html, text }) });
    
    if (!res.ok) { const err = await res.json().catch(()=>({})); return new Response(JSON.stringify({ error: 'Failed to send', detail: err }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }); }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) { return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }); }
});
