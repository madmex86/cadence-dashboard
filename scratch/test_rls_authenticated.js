const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const email = `tester_${Date.now()}@cadencecreatures.com`;
const password = "Password123!";

async function runTest() {
  console.log(`=== Testing Authenticated RLS on printers ===`);
  console.log(`1. Signing up a temporary user: ${email}...`);
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (signUpErr) {
    console.error("   ❌ Sign up failed:", signUpErr.message);
    return;
  }
  
  const user = signUpData.user;
  console.log("   ✅ Sign up successful! User ID:", user.id);
  
  console.log("2. Signing in...");
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (signInErr) {
    console.error("   ❌ Sign in failed:", signInErr.message);
    return;
  }
  
  console.log("   ✅ Sign in successful! Session active.");
  
  console.log("3. Attempting to INSERT a printer...");
  const { data: newPrinter, error: insErr } = await supabase.from("printers").insert({
    name: "Auth Test Printer",
    type: "Bambu Lab A1 Mini",
    status: "idle"
  }).select().single();
  
  if (insErr) {
    console.error("   ❌ INSERT failed:", insErr.message);
  } else {
    console.log("   ✅ INSERT successful! Printer ID:", newPrinter.id);
    
    console.log("4. Attempting to UPDATE the printer...");
    const { data: updatedPrinter, error: updErr } = await supabase.from("printers").update({
      name: "Auth Test Printer Edited",
      ip_address: "192.168.1.50"
    }).eq("id", newPrinter.id).select().single();
    
    if (updErr) {
      console.error("   ❌ UPDATE failed:", updErr.message);
    } else {
      console.log("   ✅ UPDATE successful! Updated printer name:", updatedPrinter.name);
    }
    
    console.log("5. Cleaning up printer...");
    const { error: delErr } = await supabase.from("printers").delete().eq("id", newPrinter.id);
    if (delErr) {
      console.error("   ❌ DELETE failed:", delErr.message);
    } else {
      console.log("   ✅ DELETE successful!");
    }
  }
  
  console.log("6. Signing out...");
  await supabase.auth.signOut();
}

runTest();
