import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    // Verify the caller is the owner or an admin
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isOwner = user.email === "stevenportugal86@gmail.com";
    if (!isOwner) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!profile || (profile.role !== "admin")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { email, role = "user" } = await req.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const validRoles = ["user", "fulfillment", "finance", "admin"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Use the service-role admin client — inviteUserByEmail requires it
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://dash.cadencecreatures.com"}/`,
    });

    if (inviteError) {
      // If user already exists, just update their profile role
      if (inviteError.message?.includes("already been registered")) {
        const { data: existingUser } = await adminClient.auth.admin.listUsers();
        const found = existingUser?.users?.find(u => u.email === email);
        if (found) {
          await adminClient.from("profiles").upsert({ id: found.id, email, role }, { onConflict: "id" });
          return NextResponse.json({ ok: true, existing: true });
        }
      }
      return NextResponse.json({ error: inviteError.message }, { status: 400 });
    }

    // Pre-create the profile row with the chosen role so it's ready when they accept
    if (inviteData?.user?.id) {
      await adminClient.from("profiles").upsert(
        { id: inviteData.user.id, email, role },
        { onConflict: "id" }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Invite error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
