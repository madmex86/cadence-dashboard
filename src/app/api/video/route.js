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
// Gen-3 Alpha Turbo (gen3a_turbo) is the stable text-to-video model that
// accepts promptText without requiring a source image.
// Gen-4 models require a promptImage; use gen3a_turbo for pure text-to-video.
async function dispatchRunway(script, webhookUrl) {
  const body = {
    model: "gen3a_turbo",
    promptText: script.b_roll_prompt,
    duration: 5,       // 5 or 10; use 5 to reduce credit cost while testing
    ratio: "1280:768", // 16:9 landscape — valid for gen3a_turbo
    webhookUrl,
  };

  const res = await fetch("https://api.runwayml.com/v1/image_to_video", {
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

    await supabase.from("video_jobs").update({ status: "generating_video", claude_script: script }).eq("id", job.id);

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
    return NextResponse.json({ job: data });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
