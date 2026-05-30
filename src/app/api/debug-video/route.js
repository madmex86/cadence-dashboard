import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: jobs, error } = await supabase
      .from('video_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2);

    const runwayKeyLength = process.env.RUNWAY_API_KEY ? process.env.RUNWAY_API_KEY.length : 0;

    return NextResponse.json({ jobs, runwayKeyLength, error });
  } catch (err) {
    return NextResponse.json({ error: err.message });
  }
}
