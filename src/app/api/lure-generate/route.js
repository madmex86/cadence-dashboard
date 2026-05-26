import { NextResponse } from 'next/server';

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured on server' }, { status: 500 });
  }
  
  const body = await req.json();
  const { prompt } = body;
  if (!prompt) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'x-api-key': apiKey, 
        'anthropic-version': '2023-06-01' 
      },
      body: JSON.stringify({ 
        model: 'claude-sonnet-4-6',
        max_tokens: 1000, 
        messages: [{ role: 'user', content: prompt }] 
      }),
    });
    
    if (!response.ok) { 
      const err = await response.json(); 
      return NextResponse.json({ error: err.error?.message || response.statusText }, { status: response.status }); 
    }
    
    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
