import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Verify the webhook came from a known source via a shared secret
function verifySecret(request) {
  const secret = request.headers.get("x-webhook-secret");
  return secret === process.env.VIDEO_WEBHOOK_SECRET;
}

// ─── Composite trigger ────────────────────────────────────────────────────────
// Called when both D-ID and Runway have finished.
// In production: trigger your FFmpeg cloud function / Cloudflare Worker here.
// For now we store the D-ID video URL as the output (no compositor yet).
async function triggerComposite(supabase, job) {
  // Fetch the D-ID result URL
  let outputUrl = null;
  try {
    const res = await fetch(`https://api.d-id.com/talks/${job.did_talk_id}`, {
      headers: { Authorization: `Basic ${process.env.DID_API_KEY}` },
    });
    const data = await res.json();
    outputUrl = data.result_url || null;
  } catch (e) {
    console.error("Failed to fetch D-ID result URL:", e.message);
  }

  await supabase.from("video_jobs").update({
    status: outputUrl ? "completed" : "failed",
    output_url: outputUrl,
    error: outputUrl ? null : "Compositor: could not retrieve D-ID result URL",
  }).eq("id", job.id);
}

// ─── POST /api/video/webhook ──────────────────────────────────────────────────
// Both D-ID and Runway should call this URL when their job finishes.
// Pass the jobId as a query param: /api/video/webhook?jobId=xxx&source=did|runway
export async function POST(request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");
    const source = url.searchParams.get("source"); // "did" or "runway"

    if (!jobId || !source) {
      return NextResponse.json({ error: "Missing jobId or source" }, { status: 400 });
    }

    const payload = await request.json();
    // Use service-role equivalent — webhook calls are server-to-server, bypass RLS
    const supabase = await createClient();

    // ── Handle D-ID callback ──────────────────────────────────────────────
    if (source === "did") {
      const didStatus = payload.status === "done" ? "completed"
        : payload.status === "error" ? "failed"
        : "processing";

      await supabase.from("video_jobs").update({ did_status: didStatus }).eq("id", jobId);
    }

    // ── Handle Runway callback ────────────────────────────────────────────
    if (source === "runway") {
      const runwayStatus = payload.status === "SUCCEEDED" ? "completed"
        : payload.status === "FAILED" ? "failed"
        : "processing";

      await supabase.from("video_jobs").update({ runway_status: runwayStatus }).eq("id", jobId);
    }

    // ── Check if both assets are done → trigger composite ─────────────────
    const { data: job } = await supabase
      .from("video_jobs")
      .select("id,did_status,runway_status,did_talk_id,status")
      .eq("id", jobId)
      .single();

    if (
      job &&
      job.status === "generating_video" &&
      job.did_status === "completed" &&
      job.runway_status === "completed"
    ) {
      await triggerComposite(supabase, job);
    }

    // If either service failed, mark the job failed
    if (job && (job.did_status === "failed" || job.runway_status === "failed")) {
      await supabase.from("video_jobs").update({
        status: "failed",
        error: `${source === "did" ? "D-ID" : "Runway"} reported failure`,
      }).eq("id", jobId);
    }

    return NextResponse.json({ received: true });

  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
