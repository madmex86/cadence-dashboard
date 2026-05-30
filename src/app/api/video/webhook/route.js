import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Secret is accepted two ways:
//   1. Query param  ?secret=xxx  — baked into the webhook URL we give D-ID/Runway
//   2. Header       x-webhook-secret: xxx — for manual/testing calls
function verifySecret(request, url) {
  const expected = process.env.VIDEO_WEBHOOK_SECRET;
  if (!expected) return true; // no secret configured → allow all (dev only)
  const fromQuery  = url.searchParams.get("secret");
  const fromHeader = request.headers.get("x-webhook-secret");
  return fromQuery === expected || fromHeader === expected;
}

// ─── Fetch D-ID result URL once both assets are ready ────────────────────────
async function fetchDIDResultUrl(talkId) {
  const res = await fetch(`https://api.d-id.com/talks/${talkId}`, {
    headers: { Authorization: `Basic ${process.env.DID_API_KEY}` },
  });
  if (!res.ok) throw new Error(`D-ID status fetch failed: ${res.status}`);
  const data = await res.json();
  return data.result_url || null;
}

// ─── Fetch Runway result URL once its task is done ───────────────────────────
async function fetchRunwayResultUrl(taskId) {
  const res = await fetch(`https://api.runwayml.com/v1/tasks/${taskId}`, {
    headers: {
      Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
      "X-Runway-Version": "2024-11-06",
    },
  });
  if (!res.ok) throw new Error(`Runway task fetch failed: ${res.status}`);
  const data = await res.json();
  // Runway returns output as an array of URLs
  return data.output?.[0] || null;
}

// ─── Composite trigger ────────────────────────────────────────────────────────
// Called once both D-ID and Runway report success.
// Currently stores the D-ID video as output_url and logs the Runway clip URL.
// TODO: wire in FFmpeg compositor (Cloudflare Worker / Lambda) to:
//   1. Composite talking head over the Runway B-roll
//   2. Burn in overlay_text_segments
//   3. Upload final MP4 to Supabase Storage and set output_url
async function triggerComposite(supabase, job) {
  let didUrl    = null;
  let runwayUrl = null;
  const errors  = [];

  try {
    didUrl = await fetchDIDResultUrl(job.did_talk_id);
  } catch (e) {
    errors.push("D-ID result: " + e.message);
  }

  try {
    runwayUrl = await fetchRunwayResultUrl(job.runway_task_id);
  } catch (e) {
    errors.push("Runway result: " + e.message);
  }

  if (!didUrl && !runwayUrl) {
    await supabase.from("video_jobs").update({
      status:    "failed",
      error:     "Compositor: could not retrieve any result URLs. " + errors.join("; "),
    }).eq("id", job.id);
    return;
  }

  // Store both URLs in the script column for the compositor to pick up later.
  // output_url points to the primary deliverable (D-ID talking head for now).
  const compositorMeta = {
    ...job.claude_script,
    _did_video_url:    didUrl,
    _runway_video_url: runwayUrl,
  };

  await supabase.from("video_jobs").update({
    status:        "completed",
    output_url:    didUrl || runwayUrl,
    claude_script: compositorMeta,
    error:         errors.length ? "Partial: " + errors.join("; ") : null,
  }).eq("id", job.id);

  console.log(`Job ${job.id} completed. D-ID: ${didUrl} | Runway: ${runwayUrl}`);
}

// ─── POST /api/video/webhook ──────────────────────────────────────────────────
export async function POST(request) {
  const url = new URL(request.url);

  if (!verifySecret(request, url)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const jobId  = url.searchParams.get("jobId");
  const source = url.searchParams.get("source"); // "did" or "runway"

  if (!jobId || !source) {
    return NextResponse.json({ error: "Missing jobId or source" }, { status: 400 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    // ── D-ID callback ─────────────────────────────────────────────────────
    // D-ID sends: { status: "done" | "error" | "started" | "created", ... }
    if (source === "did") {
      const didStatus =
        payload.status === "done"  ? "completed" :
        payload.status === "error" ? "failed"    : "processing";

      await supabase.from("video_jobs")
        .update({ did_status: didStatus })
        .eq("id", jobId);

      console.log(`D-ID webhook for job ${jobId}: ${payload.status} → ${didStatus}`);
    }

    // ── Runway callback ───────────────────────────────────────────────────
    // Runway sends: { status: "SUCCEEDED" | "FAILED" | "RUNNING", ... }
    if (source === "runway") {
      const runwayStatus =
        payload.status === "SUCCEEDED" ? "completed" :
        payload.status === "FAILED"    ? "failed"    : "processing";

      await supabase.from("video_jobs")
        .update({ runway_status: runwayStatus })
        .eq("id", jobId);

      console.log(`Runway webhook for job ${jobId}: ${payload.status} → ${runwayStatus}`);
    }

    // ── Check if both services are done ───────────────────────────────────
    const { data: job, error: fetchErr } = await supabase
      .from("video_jobs")
      .select("id,status,did_status,runway_status,did_talk_id,runway_task_id,claude_script")
      .eq("id", jobId)
      .single();

    if (fetchErr || !job) {
      console.error("Webhook: job fetch failed", fetchErr?.message);
      return NextResponse.json({ received: true });
    }

    // Both done → composite
    if (
      job.status === "generating_video" &&
      job.did_status    === "completed" &&
      job.runway_status === "completed"
    ) {
      await triggerComposite(supabase, job);
    }

    // Either service hard-failed → mark the overall job failed
    if (
      job.status === "generating_video" &&
      (job.did_status === "failed" || job.runway_status === "failed")
    ) {
      const failedService = job.did_status === "failed" ? "D-ID" : "Runway";
      // Only mark failed if the other service has also finished (completed or failed)
      const otherDone =
        failedService === "D-ID"
          ? job.runway_status !== "processing"
          : job.did_status    !== "processing";

      if (otherDone) {
        await supabase.from("video_jobs").update({
          status: "failed",
          error:  `${failedService} reported failure. Check Vercel logs for details.`,
        }).eq("id", jobId);
      }
      // If the other service is still processing we wait — it might still succeed
      // and triggerComposite will handle a partial result gracefully.
    }

    return NextResponse.json({ received: true });

  } catch (err) {
    console.error("Webhook processing error:", err);
    // Always return 200 to prevent D-ID/Runway from retrying indefinitely
    return NextResponse.json({ received: true, warning: err.message });
  }
}
