import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Derive the base URL from the incoming request ────────────────────────────
// Works on Vercel (custom domain or preview URL) and local dev automatically.
function getBaseUrl(request) {
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host  = request.headers.get("x-forwarded-host") || request.headers.get("host");
  return `${proto}://${host}`;
}

// ─── Claude: generate structured video script ────────────────────────────────
async function generateScript(campaignInput) {
  const message = await anthropic.messages.create({
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
  "overlay_text_segments": ["Hook (≤6 words)", "Core benefit (≤8 words)", "Call to action (≤6 words)"]
}`,
      },
    ],
  });

  const raw = message.content[0].text.trim();

  // Strip accidental markdown fences if Claude includes them despite instructions
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned);
}

// ─── D-ID: create talking-head video ─────────────────────────────────────────
// webhookUrl is constructed per-job so D-ID calls back with the correct jobId.
async function dispatchDID(script, jobId, webhookUrl) {
  const body = {
    // Use a custom avatar if DID_AVATAR_ID is set, otherwise fall back to
    // D-ID's hosted Alice image. To use your own face: upload an image in
    // studio.d-id.com → Agents → Presenters, copy the presenter ID.
    source_url: process.env.DID_AVATAR_ID
      ? `https://d-id-public-bucket.s3.us-east-1.amazonaws.com/auth-users/${process.env.DID_AVATAR_ID}.jpg`
      : "https://d-id-public-bucket.s3.amazonaws.com/alice.jpg",

    script: {
      type: "text",
      input: script.avatar_script,
      provider: {
        type: "microsoft",
        voice_id: "en-US-JennyNeural",
      },
    },

    config: {
      fluent: true,
      pad_audio: 0.5,
      stitch: true,         // keeps background visible behind presenter
    },

    // D-ID sends a POST to this URL when the video is ready.
    // The jobId and source are baked in so the webhook knows which job to update.
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`D-ID dispatch failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.id; // D-ID talk ID
}

// ─── Runway: generate B-roll backdrop video ───────────────────────────────────
async function dispatchRunway(script, jobId, webhookUrl) {
  const body = {
    promptText: script.b_roll_prompt,
    model: "gen4_turbo",
    ratio: "1280:720",
    duration: 10,

    // Runway sends a POST to this URL when generation completes.
    webhookUrl: webhookUrl,
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Runway dispatch failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.id; // Runway task ID
}

// ─── POST /api/video ──────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    // Auth: validate session from cookies
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { campaignInput } = await request.json();
    if (!campaignInput?.trim()) {
      return NextResponse.json({ error: "campaignInput is required" }, { status: 400 });
    }

    // Create job record — returns the ID we'll use for all downstream calls
    const { data: job, error: jobErr } = await supabase
      .from("video_jobs")
      .insert({ status: "generating_script", campaign_input: campaignInput.trim() })
      .select()
      .single();

    if (jobErr) throw new Error("Failed to create job: " + jobErr.message);

    // Build per-job webhook URLs now that we have the jobId and base URL
    const base = getBaseUrl(request);
    const secret = process.env.VIDEO_WEBHOOK_SECRET
      ? `&secret=${encodeURIComponent(process.env.VIDEO_WEBHOOK_SECRET)}`
      : "";

    const didWebhook    = `${base}/api/video/webhook?jobId=${job.id}&source=did${secret}`;
    const runwayWebhook = `${base}/api/video/webhook?jobId=${job.id}&source=runway${secret}`;

    // ── Step 1: Claude generates the structured script ────────────────────
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
    }).eq("id", job.id);

    // ── Step 2: Concurrently dispatch to D-ID and Runway ──────────────────
    const [didResult, runwayResult] = await Promise.allSettled([
      dispatchDID(script, job.id, didWebhook),
      dispatchRunway(script, job.id, runwayWebhook),
    ]);

    const update = {};

    if (didResult.status === "fulfilled") {
      update.did_talk_id  = didResult.value;
      update.did_status   = "processing";
    } else {
      update.did_status = "failed";
      console.error("D-ID dispatch error:", didResult.reason?.message);
    }

    if (runwayResult.status === "fulfilled") {
      update.runway_task_id = runwayResult.value;
      update.runway_status  = "processing";
    } else {
      update.runway_status = "failed";
      console.error("Runway dispatch error:", runwayResult.reason?.message);
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
      webhooks: {
        did:    didWebhook,
        runway: runwayWebhook,
      },
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
      .from("video_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ job: data });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
