const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse env variables from .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspect() {
  console.log("Checking 'messages' table...");
  const { data: messages, error: errMessages } = await supabase.from('messages').select('*').limit(5);
  if (errMessages) {
    console.error("Error from 'messages':", errMessages.message);
  } else {
    console.log("Success 'messages' count:", messages.length);
    console.log("Sample 'messages':", messages);
  }

  console.log("\nChecking 'contact_submissions' table...");
  const { data: contactSubmissions, error: errContact } = await supabase.from('contact_submissions').select('*').limit(5);
  if (errContact) {
    console.error("Error from 'contact_submissions':", errContact.message);
  } else {
    console.log("Success 'contact_submissions' count:", contactSubmissions.length);
    console.log("Sample 'contact_submissions':", contactSubmissions);
  }
}

inspect();
