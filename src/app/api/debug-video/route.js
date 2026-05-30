import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("video_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) throw error;
    
    return NextResponse.json({ jobs: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
