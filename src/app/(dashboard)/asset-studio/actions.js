'use server'

import { createCanvas, loadImage } from '@napi-rs/canvas'
import { createClient } from '@/lib/supabase/server'

// ─── Cadence Creatures brand config ──────────────────────────────────────────
const CC = {
  primary_color: '#C9A84C',
  name: 'Cadence Creatures',
  industry: 'boutique 3D-printed flexi animal toy collectibles',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!r) return [201, 168, 76]
  return [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)]
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ')
  let line = ''
  let currentY = y
  for (const word of words) {
    const test = line + word + ' '
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), x, currentY)
      line = word + ' '
      currentY += lineHeight
    } else {
      line = test
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, currentY)
  return currentY
}

const DIMENSIONS = {
  '1:1':  { w: 1080, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
}

// ─── Copy context builders (mirrors edge function logic) ──────────────────────
const CONTEXT_BUILDERS = {
  new_product: (d) =>
    `A new product was just published: "${d.name}", priced at $${d.price}. ${d.description ?? ''}. Category: ${d.category ?? 'general'}.`,
  new_arrival: (d) =>
    `New arrival just dropped: "${d.name}" at $${d.price}. ${d.description ?? ''}.`,
  low_stock: (d) =>
    `Product "${d.name}" is critically low — only ${d.stock_count} units left at $${d.price}. Create urgency without being desperate.`,
  drop: (d) =>
    `A product drop goes live in ${d.hours_until} hours: "${d.name}" at $${d.price}. ${d.description ?? ''}. Build hype and anticipation.`,
  milestone: (d) =>
    `The store just hit a milestone: $${d.amount} in sales today${d.order_count ? ` across ${d.order_count} orders` : ''}. Celebrate authentically.`,
  manual: (d) =>
    String(d.prompt ?? 'Create a compelling marketing post for this brand.'),
}

const TEMPLATE_TONE = {
  'product-card':      'Clean, confident, benefit-focused.',
  'drop-announcement': 'Hype and exclusivity. Make it feel like an event.',
  'urgency':           'Scarcity-driven. Honest urgency, not fake.',
  'milestone':         'Warm, celebratory, community-focused.',
  'new-arrival':       'Fresh, exciting, discovery-focused.',
  'quote-card':        'Brand voice front and center. Quotable and memorable.',
}

// ─── GENERATE COPY ────────────────────────────────────────────────────────────
export async function generateAssetCopy({ triggerType, sourceData, templateId }) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: 'Unauthorized' }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return { error: 'ANTHROPIC_API_KEY not configured' }

    const contextFn = CONTEXT_BUILDERS[triggerType] ?? CONTEXT_BUILDERS.manual
    const context = contextFn(sourceData)
    const tone = TEMPLATE_TONE[templateId] ?? 'Authentic, direct, engaging.'

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 600,
        system: `You are a social media copywriter for ${CC.name}, a ${CC.industry} shop in Visalia, CA. Each creature ships with a hidden Field Notes lore card inside a custom box.
Write punchy, authentic copy — never corporate, never cringe.
Tone guide: ${tone}
Keep headlines under 8 words. Captions under 150 characters ideally.
Hashtags: 5-8 relevant ones, no generic spam tags.
CTA: short action phrase, no exclamation marks unless truly earned.

CRITICAL: Return ONLY a valid JSON object — no preamble, no markdown fences, no explanation.
Shape: { "headline": string, "caption": string, "hashtags": string[], "cta": string }`,
        messages: [{ role: 'user', content: context }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { error: `Claude API error (${res.status}): ${err.error?.message || res.statusText}` }
    }

    const data = await res.json()
    const raw = data.content[0].text.trim().replace(/```json|```/g, '')
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return { error: 'Claude returned no JSON' }
    return { copy: JSON.parse(match[0]) }
  } catch (err) {
    return { error: String(err) }
  }
}

// ─── RENDER ASSET ─────────────────────────────────────────────────────────────
export async function renderAsset({
  headline, caption, cta, productImageUrl,
  aspectRatio = '1:1', templateId,
}) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: 'Unauthorized' }

    const { w, h } = DIMENSIONS[aspectRatio]
    const canvas = createCanvas(w, h)
    const ctx = canvas.getContext('2d')
    const [r, g, b] = hexToRgb(CC.primary_color)

    // Background
    ctx.fillStyle = '#0E0C09'
    ctx.fillRect(0, 0, w, h)

    // Product image + gradient overlay
    if (productImageUrl) {
      try {
        const img = await loadImage(productImageUrl)
        const imgH = h * (aspectRatio === '9:16' ? 0.55 : 0.60)
        ctx.drawImage(img, 0, 0, w, imgH)
        const gradient = ctx.createLinearGradient(0, imgH * 0.4, 0, imgH + h * 0.05)
        gradient.addColorStop(0, 'rgba(14,12,9,0)')
        gradient.addColorStop(0.6, 'rgba(14,12,9,0.7)')
        gradient.addColorStop(1, 'rgba(14,12,9,1)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, w, imgH + h * 0.05)
      } catch {
        // Image load failed — continue text-only
      }
    }

    // Subtle overlay
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.fillRect(0, 0, w, h)

    // Primary color accent bar (bottom)
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(0, h - Math.round(h * 0.007), w, Math.round(h * 0.007))

    // Left accent line
    ctx.fillStyle = `rgba(${r},${g},${b},0.6)`
    ctx.fillRect(Math.round(w * 0.055), Math.round(h * 0.66), Math.round(w * 0.006), Math.round(h * 0.22))

    const textLeft = Math.round(w * 0.075)
    const textRight = Math.round(w * 0.88)

    // Headline
    ctx.fillStyle = '#FAF6F0'
    ctx.font = `bold ${Math.round(w * 0.058)}px serif`
    ctx.fillText(headline, textLeft, Math.round(h * 0.695))

    // Caption
    ctx.fillStyle = 'rgba(250,246,240,0.72)'
    ctx.font = `${Math.round(w * 0.031)}px serif`
    wrapText(ctx, caption, textLeft, Math.round(h * 0.765), textRight - textLeft, Math.round(w * 0.04))

    // CTA pill
    const pillX = textLeft
    const pillY = Math.round(h * 0.865)
    const pillW = Math.round(w * 0.36)
    const pillH = Math.round(h * 0.055)
    const radius = Math.round(pillH * 0.2)

    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.beginPath()
    ctx.roundRect(pillX, pillY, pillW, pillH, radius)
    ctx.fill()

    ctx.fillStyle = '#0E0C09'
    ctx.font = `bold ${Math.round(w * 0.028)}px sans-serif`
    ctx.fillText(cta.toUpperCase(), pillX + Math.round(pillW * 0.1), pillY + Math.round(pillH * 0.64))

    // Upload to Supabase Storage
    const buffer = canvas.toBuffer('image/png')
    const fileName = `assets/${Date.now()}-${aspectRatio.replace(':', 'x')}-${templateId}.png`

    const { error: uploadError } = await supabase.storage
      .from('generated-assets')
      .upload(fileName, buffer, { contentType: 'image/png', upsert: false })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage.from('generated-assets').getPublicUrl(fileName)
    return { imageUrl: urlData.publicUrl }
  } catch (err) {
    console.error('renderAsset error:', err)
    return { error: String(err) }
  }
}

// ─── SAVE ASSET ───────────────────────────────────────────────────────────────
export async function saveGeneratedAsset({ asset }) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: 'Unauthorized' }

    const { data, error } = await supabase
      .from('generated_assets')
      .insert({ ...asset, created_by: user.id })
      .select('id')
      .single()
    if (error) throw error
    return { id: data.id }
  } catch (err) {
    return { error: String(err) }
  }
}

// ─── PUBLISH TO SOCIAL ────────────────────────────────────────────────────────
export async function publishAsset({
  assetId, imageUrl, caption, hashtags,
  platforms, scheduledFor,
}) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: 'Unauthorized' }

    const { data: connections, error: connError } = await supabase
      .from('social_connections')
      .select('platform, access_token, page_id, platform_user_id')
      .in('platform', platforms)
      .eq('is_active', true)

    if (connError) throw connError
    if (!connections?.length) return { error: 'No active social connections found for selected platforms' }

    const fullCaption = `${caption}\n\n${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`

    if (scheduledFor && scheduledFor > new Date()) {
      const { error: schedError } = await supabase.from('scheduled_posts').insert({
        asset_id: assetId,
        platforms,
        scheduled_for: scheduledFor.toISOString(),
        publish_status: 'pending',
      })
      if (schedError) throw schedError
      return { results: Object.fromEntries(platforms.map(p => [p, { success: true }])) }
    }

    const { data, error: fnError } = await supabase.functions.invoke('publish-social-post', {
      body: { asset_id: assetId, image_url: imageUrl, caption: fullCaption, platforms, connections },
    })
    if (fnError) throw fnError

    await supabase.from('generated_assets').update({ status: 'posted' }).eq('id', assetId)
    return { results: data.results }
  } catch (err) {
    console.error('publishAsset error:', err)
    return { error: String(err) }
  }
}

// ─── SMART SUGGESTIONS ────────────────────────────────────────────────────────
export async function getSmartSuggestions() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { suggestions: [], error: 'Unauthorized' }

    const suggestions = []

    // Creatures with upcoming drops (published_at in the next 24h)
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { data: upcoming } = await supabase
      .from('creatures')
      .select('id, name, species, filament_color, image_url, published_at')
      .eq('active', false)
      .not('published_at', 'is', null)
      .gt('published_at', new Date().toISOString())
      .lt('published_at', in24h)
      .limit(2)

    for (const c of upcoming ?? []) {
      const hoursUntil = Math.round(
        (new Date(c.published_at).getTime() - Date.now()) / (1000 * 60 * 60)
      )
      suggestions.push({
        id: `drop-${c.id}`,
        triggerType: 'drop',
        title: `Drop in ${hoursUntil}h: ${c.name}`,
        description: `${c.species} · ${c.filament_color ?? ''} — build hype before it goes live`,
        sourceData: { name: c.name, price: null, description: `${c.species}, ${c.filament_color ?? ''}`, hours_until: hoursUntil, image_url: c.image_url },
        urgency: hoursUntil < 4 ? 'high' : 'medium',
      })
    }

    // Active creatures — suggest product card posts
    const { data: active } = await supabase
      .from('creatures')
      .select('id, name, species, filament_color, image_url')
      .eq('active', true)
      .limit(3)

    for (const c of active ?? []) {
      suggestions.push({
        id: `product-${c.id}`,
        triggerType: 'new_product',
        title: c.name,
        description: `${c.species}${c.filament_color ? ` · ${c.filament_color}` : ''} — create a product post`,
        sourceData: { name: c.name, price: null, description: `${c.species}, ${c.filament_color ?? ''}`, image_url: c.image_url },
        urgency: 'low',
      })
    }

    return { suggestions, error: null }
  } catch (err) {
    return { suggestions: [], error: String(err) }
  }
}

// ─── LOAD ASSETS ──────────────────────────────────────────────────────────────
export async function loadRecentAssets() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { assets: [], error: 'Unauthorized' }

    const { data, error } = await supabase
      .from('generated_assets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw error
    return { assets: data ?? [] }
  } catch (err) {
    return { assets: [], error: String(err) }
  }
}

// ─── LOAD SOCIAL CONNECTIONS ──────────────────────────────────────────────────
export async function loadSocialConnections() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { connections: [], error: 'Unauthorized' }

    const { data, error } = await supabase
      .from('social_connections')
      .select('*')
      .eq('is_active', true)
    if (error) throw error
    return { connections: data ?? [] }
  } catch (err) {
    return { connections: [], error: String(err) }
  }
}
