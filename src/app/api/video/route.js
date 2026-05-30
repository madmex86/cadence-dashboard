import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─── Derive the base URL from the incoming request ────────────────────────────
function getBaseUrl(request) {
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host  = request.headers.get("x-forwarded-host") || request.headers.get("host");
  return `${proto}://${host}`;
}

// ─── Claude: generate structured video script ────────────────────────────────
async function generateScript(campaignInput) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a video production assistant for Cadence Creatures, a boutique 3D-printed flexi animal toy shop in Visalia, CA. Each creature ships with a hidden Field Notes lore card.

Generate a short-form social video script based on this campaign brief:
"${campaignInput}"

Return ONLY a minified JSON object — no markdown fences, no explanation — matching this exact schema:
{
  "avatar_script": "30-45 second spoken script for the video presenter. Warm, whimsical tone. Mention the creature by name if provided.",
  "voice_accent": "en_us_female_warm",
  "b_roll_prompt": "Cinematic visual prompt for background footage. Describe textures, lighting, movement. Fantasy/nature aesthetic.",
  "overlay_text_segments": ["Hook 6 words max", "Core benefit 8 words max", "Call to action 6 words max"]
}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Claude API error (${res.status}): ${err.error?.message || res.statusText}`);
  }

  const data = await res.json();
  const raw = data.content[0].text.trim();
  // Strip accidental markdown fences if Claude includes them despite instructions
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned);
}

// ─── D-ID: create talking-head video ─────────────────────────────────────────
async function dispatchDID(script, webhookUrl) {
  const body = {
    source_url: process.env.DID_AVATAR_ID
      ? `https://d-id-public-bucket.s3.us-east-1.amazonaws.com/auth-users/${process.env.DID_AVATAR_ID}.jpg`
      : "https://d-id-public-bucket.s3.amazonaws.com/alice.jpg",
    script: {
      type: "text",
      input: script.avatar_script,
      provider: { type: "microsoft", voice_id: "en-US-JennyNeural" },
    },
    config: { fluent: true, pad_audio: 0.5, stitch: true },
    webhook: webhookUrl,
  };

  const res = await fetch("https://api.d-id.com/talks", {
    method: "POST",
    headers: {
      Authorization: `Basic ${process.env.DID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`D-ID dispatch failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.id;
}

// ─── Runway: generate B-roll backdrop video ───────────────────────────────────
// Using gen4.5 as it supports pure text-to-video on the /v1/text_to_video endpoint
async function dispatchRunway(script, webhookUrl) {
  const body = {
    model: "gen4.5",
    promptText: script.b_roll_prompt,
    duration: 5,       // 5 or 10; use 5 to reduce credit cost while testing
    ratio: "1280:720", // 16:9 landscape
    webhookUrl,
  };

  const res = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    // Log the full response so we can see the exact validation error
    console.error(`Runway API error (${res.status}):`, text);
    throw new Error(`Runway dispatch failed (${res.status}): ${text}`);
  }
  const data = JSON.parse(text);
  return data.id;
}

// ─── POST /api/video ──────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { campaignInput } = await request.json();
    if (!campaignInput?.trim()) {
      return NextResponse.json({ error: "campaignInput is required" }, { status: 400 });
    }

    const { data: job, error: jobErr } = await supabase
      .from("video_jobs")
      .insert({ status: "generating_script", campaign_input: campaignInput.trim() })
      .select()
      .single();

    if (jobErr) throw new Error("Failed to create job: " + jobErr.message);

    const base   = getBaseUrl(request);
    const secret = process.env.VIDEO_WEBHOOK_SECRET
      ? `&secret=${encodeURIComponent(process.env.VIDEO_WEBHOOK_SECRET)}`
      : "";

    const didWebhook    = `${base}/api/video/webhook?jobId=${job.id}&source=did${secret}`;
    const runwayWebhook = `${base}/api/video/webhook?jobId=${job.id}&source=runway${secret}`;

    // Step 1: Claude script
    let script;
    try {
      script = await generateScript(campaignInput);
    } catch (e) {
      await supabase.from("video_jobs")
        .update({ status: "failed", error: "Script generation failed: " + e.message })
        .eq("id", job.id);
      return NextResponse.json({ error: "Script generation failed", detail: e.message }, { status: 500 });
    }

    await supabase.from("video_jobs").update({
      status: "generating_video",
      claude_script: script,
      dispatched_at: new Date().toISOString(),
    }).eq("id", job.id);

    // Step 2: Concurrent D-ID + Runway dispatch
    const [didResult, runwayResult] = await Promise.allSettled([
      dispatchDID(script, didWebhook),
      dispatchRunway(script, runwayWebhook),
    ]);

    const update = {};

    if (didResult.status === "fulfilled") {
      update.did_talk_id = didResult.value;
      update.did_status  = "processing";
    } else {
      update.did_status = "failed";
      console.error("D-ID:", didResult.reason?.message);
    }

    if (runwayResult.status === "fulfilled") {
      update.runway_task_id = runwayResult.value;
      update.runway_status  = "processing";
    } else {
      update.runway_status = "failed";
      console.error("Runway:", runwayResult.reason?.message);
    }

    if (update.did_status === "failed" && update.runway_status === "failed") {
      update.status = "failed";
      update.error  = "Both D-ID and Runway dispatch failed";
    }

    await supabase.from("video_jobs").update(update).eq("id", job.id);

    return NextResponse.json({
      jobId:          job.id,
      status:         update.status || "generating_video",
      script,
      did_talk_id:    update.did_talk_id    || null,
      runway_task_id: update.runway_task_id || null,
      webhooks:       { did: didWebhook, runway: runwayWebhook },
    });

  } catch (err) {
    console.error("Video route error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

// ─── Polling fallback: check D-ID + Runway directly ─────────────────────────
// Called from GET when a job has been "generating_video" for 30+ seconds.
// Webhooks are unreliable; this ensures the job always completes eventually.
async function pollServicesIfStuck(supabase, job) {
  if (job.status !== "generating_video") return job;

  // Use dispatched_at if set, fall back to created_at
  const startTime = job.dispatched_at || job.created_at;
  const elapsed   = (Date.now() - new Date(startTime).getTime()) / 1000;
  if (elapsed < 30) return job; // too early — give webhooks a chance first

  const update = {};

  // If Runway was never dispatched (null task_id), mark it failed immediately
  if (!job.runway_task_id && job.runway_status === "processing") {
    update.runway_status = "failed";
    update.error = "Runway was never dispatched — use Retry B-Roll";
  }

  // Check D-ID
  if (job.did_talk_id && job.did_status === "processing") {
    try {
      const res  = await fetch(`https://api.d-id.com/talks/${job.did_talk_id}`, {
        headers: { Authorization: `Basic ${process.env.DID_API_KEY}` },
      });
      const data = await res.json();
      if      (data.status === "done")  update.did_status = "completed";
      else if (data.status === "error") update.did_status = "failed";
      console.log(`D-ID poll: talk ${job.did_talk_id} → ${data.status}`);
    } catch (e) { console.error("D-ID poll error:", e.message); }
  }

  // Check Runway
  if (job.runway_task_id && job.runway_status === "processing") {
    try {
      const res  = await fetch(`https://api.dev.runwayml.com/v1/tasks/${job.runway_task_id}`, {
        headers: {
          Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
          "X-Runway-Version": "2024-11-06",
        },
      });
      const data = await res.json();
      if      (data.status === "SUCCEEDED") { update.runway_status = "completed"; update._runway_url = data.output?.[0] || null; }
      else if (data.status === "FAILED")    update.runway_status = "failed";
      console.log(`Runway poll: task ${job.runway_task_id} → ${data.status}`);
    } catch (e) { console.error("Runway poll error:", e.message); }
  }

  if (!Object.keys(update).length) return job;

  // Persist status changes
  const { _runway_url, ...dbUpdate } = update;
  await supabase.from("video_jobs").update(dbUpdate).eq("id", job.id);
  const merged = { ...job, ...dbUpdate };

  // Both done → trigger composite inline
  if (merged.did_status === "completed" && merged.runway_status === "completed") {
    let didUrl = null;
    try {
      const r = await fetch(`https://api.d-id.com/talks/${job.did_talk_id}`, {
        headers: { Authorization: `Basic ${process.env.DID_API_KEY}` },
      });
      didUrl = (await r.json()).result_url || null;
    } catch (e) { console.error("D-ID result_url fetch:", e.message); }

    const outputUrl = didUrl || _runway_url;
    const scriptMeta = { ...(merged.claude_script || {}), _did_video_url: didUrl, _runway_video_url: _runway_url };
    await supabase.from("video_jobs").update({
      status:        outputUrl ? "completed" : "failed",
      output_url:    outputUrl,
      claude_script: scriptMeta,
    }).eq("id", job.id);

    // Return fresh row
    const { data } = await supabase.from("video_jobs").select("*").eq("id", job.id).single();
    return data || merged;
  }

  return merged;
}

// ─── PATCH /api/video — retry a single failed service ────────────────────────
// Body: { jobId, service: "runway" | "did" }
export async function PATCH(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId, service } = await request.json();
    if (!jobId || !["runway", "did"].includes(service)) {
      return NextResponse.json({ error: "jobId and service (runway|did) required" }, { status: 400 });
    }

    const { data: job, error: fetchErr } = await supabase
      .from("video_jobs").select("*").eq("id", jobId).single();
    if (fetchErr || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (!job.claude_script) {
      return NextResponse.json({ error: "No script found — cannot retry without a generated script" }, { status: 400 });
    }

    const base   = getBaseUrl(request);
    const secret = process.env.VIDEO_WEBHOOK_SECRET
      ? `&secret=${encodeURIComponent(process.env.VIDEO_WEBHOOK_SECRET)}`
      : "";

    if (service === "runway") {
      const webhookUrl = `${base}/api/video/webhook?jobId=${job.id}&source=runway${secret}`;
      await supabase.from("video_jobs").update({ runway_status: "processing", status: "generating_video", dispatched_at: new Date().toISOString() }).eq("id", jobId);
      const taskId = await dispatchRunway(job.claude_script, webhookUrl);
      await supabase.from("video_jobs").update({ runway_task_id: taskId }).eq("id", jobId);
      return NextResponse.json({ ok: true, runway_task_id: taskId });
    }

    if (service === "did") {
      const webhookUrl = `${base}/api/video/webhook?jobId=${job.id}&source=did${secret}`;
      await supabase.from("video_jobs").update({ did_status: "processing", status: "generating_video" }).eq("id", jobId);
      const talkId = await dispatchDID(job.claude_script, webhookUrl);
      await supabase.from("video_jobs").update({ did_talk_id: talkId }).eq("id", jobId);
      return NextResponse.json({ ok: true, did_talk_id: talkId });
    }

  } catch (err) {
    console.error("Retry error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── GET /api/video?jobId=xxx ─────────────────────────────────────────────────
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jobId = new URL(request.url).searchParams.get("jobId");

    if (!jobId) {
      const { data, error } = await supabase
        .from("video_jobs")
        .select("id,status,campaign_input,claude_script,did_status,runway_status,output_url,error,created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return NextResponse.json({ jobs: data });
    }

    const { data, error } = await supabase
      .from("video_jobs").select("*").eq("id", jobId).single();

    if (error) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // Polling fallback: actively checks D-ID + Runway if webhooks haven't fired
    const job = await pollServicesIfStuck(supabase, data);
    return NextResponse.json({ job });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
