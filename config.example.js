// Dashboard configuration — no longer needed for Discord alerts.
// Discord is now routed through the send-discord-alert Supabase Edge Function.
//
// To activate Discord notifications:
//   1. Go to Supabase Dashboard → Edge Functions → Secrets
//   2. Add: DISCORD_WEBHOOK_URL = https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN
//   3. That's it. No file to create, nothing to gitignore.
