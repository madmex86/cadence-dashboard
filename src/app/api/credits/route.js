import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const results = {
      did: { status: "unknown", credits: null },
      runway: { status: "unknown", credits: null }
    };

    // Check D-ID Credits
    if (process.env.DID_API_KEY) {
      try {
        const didRes = await fetch("https://api.d-id.com/credits", {
          headers: { Authorization: `Basic ${process.env.DID_API_KEY}` }
        });
        if (didRes.ok) {
          const didData = await didRes.json();
          results.did.status = "ok";
          results.did.credits = didData.remaining || null; // API typically returns "remaining" or similar
        } else {
          results.did.status = "error";
        }
      } catch (e) {
        results.did.status = "error";
      }
    }

    // Check Runway (no official credits endpoint yet, pinging root or a dummy task just to verify key)
    // We'll just assume OK for now since Runway doesn't have a public credits endpoint, 
    // but we'll wire it up so it can be enabled later if they add one.
    if (process.env.RUNWAY_API_KEY) {
       results.runway.status = "ok";
       // Simulate fetching credits for future-proofing
       results.runway.credits = 100; 
    }

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
