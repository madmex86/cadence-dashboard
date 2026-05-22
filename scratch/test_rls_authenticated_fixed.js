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

const email = `rls_tester_${Date.now()}@cadencecreatures.com`;
const password = "Password123!";

async function runTest() {
  console.log("=== Testing Authenticated RLS on printers (Robust) ===");
  
  // 1. Create a confirmed user using the service client
  console.log(`1. Creating confirmed user ${email} via Auth Admin API...`);
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
    // 2. Sign in as the user using the anon client
    console.log("2. Signing in as the new user...");
    const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
      email,
      password
    });
    
    if (signInErr) {
      console.error("   ❌ Sign in failed:", signInErr.message);
      return;
    }
    
    console.log("   ✅ Sign in successful! Session active.");
    
    // 3. Test insert
    console.log("3. Testing INSERT as authenticated user...");
    const { data: newPrinter, error: insErr } = await anonClient.from("printers").insert({
      name: "Auth Test Printer B",
      type: "Bambu Lab A1 Mini",
      status: "idle"
    }).select().single();
    
    if (insErr) {
      console.error("   ❌ INSERT failed:", insErr.message);
    } else {
      console.log("   ✅ INSERT successful! Printer ID:", newPrinter.id);
      
      // 4. Test update
      console.log("4. Testing UPDATE as authenticated user...");
      const { data: updatedPrinter, error: updErr } = await anonClient.from("printers").update({
        name: "Auth Test Printer B Edited",
        ip_address: "192.168.1.99"
      }).eq("id", newPrinter.id).select().single();
      
      if (updErr) {
        console.error("   ❌ UPDATE failed:", updErr.message);
      } else {
        console.log("   ✅ UPDATE successful! Updated printer name:", updatedPrinter.name);
      }
      
      // 5. Test delete
      console.log("5. Testing DELETE as authenticated user...");
      const { error: delErr } = await anonClient.from("printers").delete().eq("id", newPrinter.id);
      if (delErr) {
        console.error("   ❌ DELETE failed:", delErr.message);
      } else {
        console.log("   ✅ DELETE successful!");
      }
    }
    
    // Sign out
    await anonClient.auth.signOut();
  } finally {
    // 6. Clean up user from auth
    console.log("6. Cleaning up test user...");
    const { error: deleteUserErr } = await serviceClient.auth.admin.deleteUser(user.id);
    if (deleteUserErr) {
      console.error("   ❌ Failed to delete test user:", deleteUserErr.message);
    } else {
      console.log("   ✅ Test user cleaned up.");
    }
  }
}

runTest();
