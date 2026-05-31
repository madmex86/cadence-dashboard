# Meta App Setup — Instagram + Facebook Publishing

This guide covers creating the Meta developer app needed for Asset Studio to post directly to Instagram and Facebook.

---

## Before You Start

You need:
- A **Facebook Page** for Cadence Creatures (not a personal profile)
- An **Instagram Professional account** (Business or Creator) connected to that Facebook Page
- Admin access to [developers.facebook.com](https://developers.facebook.com)

---

## Step 1 — Create the App

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Click **Create App**
3. Select **Other** as the use case → click **Next**
4. Select **Business** as the app type → click **Next**
5. Fill in:
   - **App Name:** `Cadence Creatures Dashboard` (or anything)
   - **App Contact Email:** your email
   - **Business Account:** link your Meta Business account if prompted
6. Click **Create App**

---

## Step 2 — Add Products

In the left sidebar, click **Add Product** and add both:

### Facebook Login
- Click **Set Up** on Facebook Login
- Under **Facebook Login → Settings**, add this to **Valid OAuth Redirect URIs:**
  ```
  https://YOUR-DASHBOARD-URL.vercel.app/api/auth/social/meta/callback
  ```
- Save changes

### Instagram Graph API
- Click **Set Up** on Instagram Graph API (under the Manage products section)
- No additional config needed at setup time

---

## Step 3 — Configure Permissions

Go to **App Review → Permissions and Features** and request:

| Permission | What it's for |
|---|---|
| `instagram_basic` | Read Instagram profile info |
| `instagram_content_publish` | Post photos to Instagram |
| `pages_manage_posts` | Post to Facebook Page |
| `pages_read_engagement` | Read page info |

> **Note:** For testing before App Review, you can use the app in **Development mode** with yourself as a test user. Full publishing to others requires App Review approval (1–2 weeks).

---

## Step 4 — Get Your Credentials

Go to **App Settings → Basic:**

- Copy **App ID** → this is `META_APP_ID` / `NEXT_PUBLIC_META_APP_ID`
- Click **Show** next to App Secret → this is `META_APP_SECRET`

---

## Step 5 — Add Environment Variables in Vercel

In your Vercel project → **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `META_APP_ID` | Your App ID |
| `META_APP_SECRET` | Your App Secret |
| `NEXT_PUBLIC_META_APP_ID` | Your App ID (same value) |

Redeploy after adding variables.

---

## Step 6 — Connect in the Dashboard

1. Go to **Asset Studio → Social Accounts** (`/asset-studio/settings`)
2. Click **Connect** next to Instagram or Facebook
3. Authorize the app when the Facebook dialog appears
4. You'll be redirected back with a success message

> Instagram and Facebook connect together — one OAuth flow handles both.

---

## Step 7 — App Review (for production use)

While the app is in **Development mode**, only you (the app admin) can use it. To allow posting without restriction:

1. Go to **App Review → Requests**
2. Submit a review request for the permissions listed in Step 3
3. Provide a screen recording showing the OAuth flow and how posts are created
4. Meta typically approves business publishing apps within 5–10 business days

---

## Pinterest Setup (separate)

Pinterest uses its own OAuth:

1. Go to [developers.pinterest.com](https://developers.pinterest.com) → **My Apps → Create app**
2. Under **Redirect URIs**, add:
   ```
   https://YOUR-DASHBOARD-URL.vercel.app/api/auth/social/pinterest/callback
   ```
3. Request scopes: `boards:read`, `pins:write`
4. Add to Vercel:
   ```
   NEXT_PUBLIC_PINTEREST_APP_ID=your_pinterest_app_id
   PINTEREST_APP_SECRET=your_pinterest_app_secret
   ```

---

## Troubleshooting

| Error | Fix |
|---|---|
| "Invalid App ID" | `NEXT_PUBLIC_META_APP_ID` env var not set or app not redeployed |
| "URL Blocked" | Redirect URI in Step 2 doesn't exactly match your deployment URL |
| "App not active" | App is in Development mode — only the app admin can connect |
| Token expires | Meta long-lived tokens last 60 days; reconnect via Settings when expired |
