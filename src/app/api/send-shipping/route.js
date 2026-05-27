import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { buyer_name, buyer_email, tracking_number, items, carrier } = await req.json();

    if (!buyer_email) {
      return NextResponse.json({ success: false, error: 'No buyer email provided' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY environment variable");
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
    }

    const itemsList = Array.isArray(items) 
      ? items.map(i => {
          const name = i.startsWith('[x] ') ? i.slice(4) : i;
          return `<li>${name}</li>`;
        }).join("")
      : `<li>${items}</li>`;

    const trackingSection = tracking_number 
      ? `<p>Tracking (${carrier || 'Auto-detect'}): <strong>${tracking_number}</strong></p>` 
      : `<p>Your package is on its way via standard post.</p>`;

    const html = `
      <div style="font-family: 'Lora', Georgia, serif; color: #1C1612; max-width: 500px; margin: 0 auto; line-height: 1.6;">
        <p>Hello ${buyer_name || 'there'},</p>
        
        <p>the box is taped. the label is printed. a new companion is ready for the journey.</p>
        
        <p>Your order has officially shipped and is on its way to you.</p>

        <div style="margin: 30px 0; padding: 20px; border-top: 1px solid #C9A84C; border-bottom: 1px solid #C9A84C; background-color: #FAF6F0;">
          <h3 style="margin-top: 0; color: #5BBFD4;">Inside the box:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${itemsList}
          </ul>
        </div>

        ${trackingSection}

        <p style="margin-top: 40px; font-style: italic;">
          And so another creature found its way into the world, carrying her name a little further.
        </p>

        <p style="margin-top: 40px; font-size: 0.9em; color: #666;">
          — Cadence Creatures<br>
          <a href="https://cadencecreatures.com" style="color: #C9A84C;">cadencecreatures.com</a>
        </p>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Cadence Creatures <orders@cadencecreatures.com>',
        to: buyer_email,
        subject: 'Your Cadence Creatures Order has Shipped!',
        html: html
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Resend error:", errorData);
      return NextResponse.json({ success: false, error: 'Failed to send email' }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Shipping email error:", err);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
