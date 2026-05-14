# Dashboard Audit Report: FIXIT

**Status:** Critical Failure (Tables failing to load)
**Role:** Lead Full-Stack Engineer Audit

## 1. Authentication & Connectivity (Handshake Failure)
- **Bug:** Invalid Supabase API Key format.
- **Observation:** In `shared.js`, the `supabaseKey` is set to a string starting with `sb_publishable_`. Standard Supabase keys are long JWT strings. This format suggests a Stripe key or an incorrect value was pasted, which will cause a `403 Forbidden` or `401 Unauthorized` on all requests.
- **Action Item:** Replace the `supabaseKey` with the actual `anon` key found in the Supabase Dashboard (Settings → API).
- **File Path:** `shared.js`

## 2. Schema Inconsistency (Atomic Inventory)
- **Bug:** Mismatched column names between modules.
- **Observation:** `cadence-creature-editor.html` was recently updated to save `component_name` and `filament_id`. However, `cadence-queue.html` is currently attempting to render components using `part_name` and `filament_ids` (plural). This causes the table rendering to fail or display empty data.
- **Action Item:** Standardize `cadence-queue.html` to use the new Atomic Inventory schema (`component_name` and `filament_id`).
- **File Path:** `cadence-queue.html`

## 3. Database Performance (Memory & Timeouts)
- **Bug:** "Wide Table" memory exhaustion and missing indexes.
- **Observation:** Multiple modules use `select('*')` on tables like `orders` and `site_analytics`. `site_analytics` in particular is queried with a `.gte('created_at', since)` filter every 60 seconds. Without a B-Tree index on `created_at`, this will cause a 504 Gateway Timeout as the table grows.
- **Action Item:** 
  1. Add indexes to `created_at` (orders, site_analytics) and `entry_date` (finance).
  2. Refactor `select('*')` to only fetch necessary columns (e.g., exclude large lore/story fields in the main queue list).
- **File Path:** `cadence-queue.html` (JS) & Supabase SQL Editor (Indexes)

## 4. Uncaught Promise Rejections
- **Bug:** Partial failures in `Promise.all` blocks.
- **Observation:** In `load_creatures`, the code checks for `cErr` (creatures error) but ignores potential errors from the `creature_components` fetch. If the components table fails to load, `compData` is null and `render_stock()` may crash when trying to access properties of undefined.
- **Action Item:** Add robust error checking for both data sets in the `Promise.all` block.
- **File Path:** `cadence-queue.html`

## 5. Vercel/MexPlex Proxy Mismatch
- **Bug:** Redundant or conflicting rewrites.
- **Observation:** `vercel.json` has a rewrite from `/queue` to `/index.html` (the login page), but the dashboard logic expects `/cadence-queue.html`.
- **Action Item:** Update `vercel.json` to point `/queue` to `/cadence-queue.html`.
- **File Path:** `vercel.json`
