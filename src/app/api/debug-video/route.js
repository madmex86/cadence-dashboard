import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const results = {};

    // Test Runway with a minimal call to see the exact error
    const runwayKey = process.env.RUNWAY_API_KEY;
    if (!runwayKey) {
      results.runway = { error: 'RUNWAY_API_KEY not set in Vercel env' };
    } else {
      results.runwayKeyPrefix = runwayKey.substring(0, 8) + '...'; // Show first 8 chars
      results.runwayKeyLength = runwayKey.length;
      
      const body = {
        model: process.env.RUNWAY_MODEL || 'gen4_turbo',
        promptText: 'A blue 3D printed flexi dinosaur toy sitting on garden soil',
        duration: 5,
        ratio: '1280:720',
      };

      results.requestBody = body;

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
      results.runway = {
        status: res.status,
        statusText: res.statusText,
        body: text.substring(0, 500),
        ok: res.ok,
      };
    }

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: err.message, stack: err.stack });
  }
}
