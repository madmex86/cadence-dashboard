const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspect() {
  console.log("Checking 'profiles' table...");
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) {
    console.error("Error from 'profiles':", error.message);
  } else {
    console.log("Profiles count:", data.length);
    console.log("Profiles data:", JSON.stringify(data, null, 2));
  }
}

inspect();
