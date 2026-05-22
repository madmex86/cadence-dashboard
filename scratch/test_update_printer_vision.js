const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const serviceClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const email = `vision_tester_${Date.now()}@cadencecreatures.com`;
const password = "Password123!";
const visionPrinterId = "a02d2814-2d78-48a5-ab8e-a0ec8a35df4d";

async function runTest() {
  console.log("=== Testing authenticated UPDATE on 'Vision' printer row ===");
  
  // 1. Create a confirmed user
  const { data: userData, error: createErr } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  
  if (createErr) {
    console.error("   ❌ Failed to create confirmed user:", createErr.message);
    return;
  }
  
  const user = userData.user;
  console.log("   ✅ Confirmed user created! User ID:", user.id);
  
  try {
    // 2. Sign in as the user
    const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
      email,
      password
    });
    
    if (signInErr) {
      console.error("   ❌ Sign in failed:", signInErr.message);
      return;
    }
    
    console.log("   ✅ Sign in successful! Session active.");
    
    // 3. Select the Vision printer first to see if we can read it
    console.log("3. Reading 'Vision' printer row...");
    const { data: vision, error: readErr } = await anonClient.from("printers").select("*").eq("id", visionPrinterId).single();
    if (readErr) {
      console.error("   ❌ Read failed:", readErr.message);
    } else {
      console.log("   ✅ Read successful! Current name:", vision.name);
      
      // 4. Update the Vision printer
      console.log("4. Attempting to UPDATE 'Vision' printer...");
      const payload = {
        name: "Vision",
        type: vision.type || "Bambu Lab P1S",
        ip_address: "192.168.1.150" // test update
      };
      
      const { data: updated, error: updErr } = await anonClient
        .from("printers")
        .update(payload)
        .eq("id", visionPrinterId)
        .select()
        .single();
        
      if (updErr) {
        console.error("   ❌ UPDATE failed:", updErr.message);
        console.error("   Full error detail:", updErr);
      } else {
        console.log("   ✅ UPDATE successful! Updated IP:", updated.ip_address);
        
        // Clean up IP back to null using service client or anon client
        await serviceClient.from("printers").update({ ip_address: null }).eq("id", visionPrinterId);
        console.log("   ✅ Cleaned up 'Vision' IP.");
      }
    }
    
    await anonClient.auth.signOut();
  } finally {
    // Clean up user
    await serviceClient.auth.admin.deleteUser(user.id);
    console.log("   ✅ Cleaned up user.");
  }
}

runTest();
