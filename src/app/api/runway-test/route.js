import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const runwayKey = process.env.RUNWAY_API_KEY;
  if (!runwayKey) {
    return NextResponse.json({ error: 'RUNWAY_API_KEY not set in Vercel env' });
  }

  const body = {
    model: 'gen4_turbo',
    promptText: 'A blue 3D printed flexi dinosaur toy on garden soil',
    duration: 5,
    ratio: '1280:720',
  };

  const res = await fetch('https://api.dev.runwayml.com/v1/text_to_video', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${runwayKey}`,
      'Content-Type': 'application/json',
      'X-Runway-Version': '2024-11-06',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  return NextResponse.json({
    keyPrefix: runwayKey.substring(0, 10) + '...',
    keyLength: runwayKey.length,
    status: res.status,
    ok: res.ok,
    body: text.substring(0, 800),
    requestBody: body,
  });
}
