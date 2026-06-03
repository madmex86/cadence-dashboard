'use server'

import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { readFileSync } from 'node:fs'
import { join } from 'path'
import { createClient } from '@/lib/supabase/server'

// ─── Font loading ─────────────────────────────────────────────────────────────
// Fonts are bundled locally in public/fonts/ so we bypass all CDNs, network latency,
// and 50MB Github repo limits.

const FONT_DEFS = [
  {
    name: 'LoraBoldCustom',
    path: join(process.cwd(), 'public', 'fonts', 'Lora-Bold.ttf'),
  },
  {
    name: 'LoraRegCustom',
    path: join(process.cwd(), 'public', 'fonts', 'Lora-Regular.ttf'),
  },
  {
    name: 'InterBoldCustom',
    path: join(process.cwd(), 'public', 'fonts', 'Inter-Bold.ttf'),
  }
]

let fontsLoaded = false

async function ensureFonts() {
  if (fontsLoaded) return

  let allLoaded = true
  for (const font of FONT_DEFS) {
    try {
      const buf = readFileSync(font.path)
      GlobalFonts.register(buf, font.name)
    } catch (err) {
      console.error(`Font [${font.name}] failed:`, err.message)
      allLoaded = false
    }
  }
  
  if (allLoaded) {
    fontsLoaded = true
  }
}

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
    String(d.prompt || 'Create a compelling marketing post for Cadence Creatures — a boutique 3D-printed flexi animal toy shop. Highlight the handcrafted quality, the hidden Field Notes lore card, and the custom box.'),
}

const TEMPLATE_TONE = {
  'product-card':
    'Warm and specific. Lead with the creature\'s personality — what makes this one special. Mention the flexi articulation, the hidden Field Notes lore card, the custom box. Feels like a quiet discovery, not a sales pitch.',
  'drop-announcement':
    'Whimsical anticipation — like a new creature emerging from the workshop into the world. Cozy fantasy energy: a field-guide entry coming to life. Never aggressive, never hype-bro. Think "a new friend has been spotted" not "lock your doors". Reference the creature\'s lore, habitat, or personality if available.',
  'urgency':
    'Gentle scarcity — this creature is rare and finds its home fast. Warm, never pushy. Think "only a few left in the wild" not "BUY NOW". The tone is wistful, not panicked.',
  'milestone':
    'Warm and celebratory. Thank the collectors who welcomed these creatures into their homes. Community-first, never boastful.',
  'new-arrival':
    'The excitement of a first sighting — like spotting a rare creature in the field. Curious, delighted, welcoming. A new entry in the bestiary.',
  'quote-card':
    'Lean into the lore and worldbuilding. Could be a personality trait of the creature, a line from its Field Notes lore card, or something about the craft and care that goes into each one. Quotable and a little magical.',
}

const cleanText = str => str ? str
  .replace(/[\r\n\t]+/g, ' ')
  .replace(/[^\x20-\x7E\xA0-\xFF\u2010-\u2027]/g, '')
  .trim() : ''

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
    const tone = TEMPLATE_TONE[templateId] ?? 'Warm, whimsical, creature-lore-focused. Never aggressive or hype-bro.'

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
        system: `You are the voice of Cadence Creatures — a boutique 3D-printed flexi animal toy shop in Visalia, CA. Each creature is handcrafted, fully articulated, and ships with a hidden Field Notes lore card tucked inside a custom box.

The brand voice is: warm, whimsical, lore-rich, and genuine. Like a cozy nature journal crossed with a fantasy field guide. We celebrate the creatures as characters, not products.

NEVER write: aggressive hype, threatening or alarming language ("lock your doors", "you've been warned", "this changes everything"), cold corporate copy, or generic influencer-speak.
ALWAYS write: as if you genuinely love these little creatures and want to share them with people who will too.
NO EMOJIS. Do not output any emojis.

Tone guide for this post: ${tone}

Rules:
- Headlines: under 8 words, lead with creature name or personality when available
- Captions: under 150 characters, warm and specific
- Hashtags: 5-8, mix of niche collectible/toy tags and creature-specific ones — no generic spam
- CTA: a short, warm action phrase ("Meet them here", "Claim yours", "Add to your collection")
- NO EMOJIS ANYWHERE.

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
    
    // Parse JSON and strip emojis explicitly
    const parsed = JSON.parse(match[0])
    
    return { copy: {
      headline: cleanText(parsed.headline),
      caption: cleanText(parsed.caption),
      cta: cleanText(parsed.cta),
      hashtags: (parsed.hashtags || []).map(cleanText)
    } }
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

    await ensureFonts()

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
        
        // Emulate object-fit: cover
        const imgRatio = img.width / img.height
        const destRatio = w / imgH
        let drawW = img.width
        let drawH = img.height
        let sx = 0, sy = 0
        
        if (imgRatio > destRatio) {
          drawW = img.height * destRatio
          sx = (img.width - drawW) / 2
        } else {
          drawH = img.width / destRatio
          sy = (img.height - drawH) / 2
        }
        
        ctx.drawImage(img, sx, sy, drawW, drawH, 0, 0, w, imgH)
        
        const gradient = ctx.createLinearGradient(0, imgH * 0.4, 0, imgH + h * 0.05)
        gradient.addColorStop(0, 'rgba(14,12,9,0)')
        gradient.addColorStop(0.6, 'rgba(14,12,9,0.7)')
        gradient.addColorStop(1, 'rgba(14,12,9,1)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, w, imgH + h * 0.05)
      } catch (e) {
        // Image load failed — continue text-only
      }
    }

    // Subtle overlay
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.fillRect(0, 0, w, h)

    // Primary color accent bar (bottom)
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(0, h - Math.round(h * 0.007), w, Math.round(h * 0.007))

    const textLeft = Math.round(w * 0.075)
    const textRight = Math.round(w * 0.88)
    const maxTextWidth = textRight - textLeft
    const minDim = Math.min(w, h)
    const isSquare = aspectRatio === '1:1'
    
    // Sanitize text inputs in case they were loaded from dirty database rows
    const cleanHeadline = cleanText(headline) || 'New Post'
    const cleanCaption = cleanText(caption) || ''
    const cleanCta = cleanText(cta) || 'LEARN MORE'

    // Headline
    ctx.fillStyle = '#FAF6F0'
    ctx.font = `${Math.round(minDim * 0.058)}px LoraBoldCustom, serif`
    const startY = Math.round(h * (isSquare ? 0.61 : 0.67))
    let currentY = startY
    currentY = wrapText(ctx, cleanHeadline, textLeft, currentY, maxTextWidth, Math.round(minDim * (isSquare ? 0.06 : 0.065)))

    // Caption
    currentY += Math.round(h * (isSquare ? 0.015 : 0.02)) // Space between headline and caption
    ctx.fillStyle = 'rgba(250,246,240,0.72)'
    ctx.font = `${Math.round(minDim * 0.031)}px LoraRegCustom, serif`
    currentY = wrapText(ctx, cleanCaption, textLeft, currentY, maxTextWidth, Math.round(minDim * (isSquare ? 0.038 : 0.04)))

    // CTA pill
    const ctaText = cleanCta.toUpperCase()
    ctx.font = `${Math.round(minDim * 0.028)}px InterBoldCustom, sans-serif`
    const ctaMetrics = ctx.measureText(ctaText)
    
    const pillX = textLeft
    const pillY = currentY + Math.round(h * (isSquare ? 0.025 : 0.035)) // dynamic spacing
    const pillH = Math.round(h * 0.055)
    const pillW = ctaMetrics.width + Math.round(minDim * 0.08) // 4% padding on left and right
    const radius = Math.round(pillH * 0.2)

    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.beginPath()
    ctx.roundRect(pillX, pillY, pillW, pillH, radius)
    ctx.fill()

    ctx.fillStyle = '#0E0C09'
    ctx.fillText(ctaText, pillX + Math.round(minDim * 0.04), pillY + Math.round(pillH * 0.64))

    // Left accent line (dynamically sized)
    ctx.fillStyle = `rgba(${r},${g},${b},0.6)`
    const accentTop = startY - Math.round(h * 0.04)
    const accentBottom = pillY + Math.round(pillH * 0.8)
    ctx.fillRect(Math.round(w * 0.055), accentTop, Math.round(w * 0.006), accentBottom - accentTop)

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

    // Strip out undefined values to ensure clean payload
    const cleanAsset = Object.fromEntries(Object.entries(asset).filter(([_, v]) => v !== undefined))

    const { data, error } = await supabase
      .from('generated_assets')
      .upsert({ ...cleanAsset, created_by: user.id })
      .select('id')
      .single()
    if (error) throw error
    return { id: data.id }
  } catch (err) {
    return { error: String(err) }
  }
}

// ─── DELETE ASSET ─────────────────────────────────────────────────────────────
export async function deleteGeneratedAsset(id) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: 'Unauthorized' }

    const { error } = await supabase
      .from('generated_assets')
      .delete()
      .eq('id', id)
      .eq('created_by', user.id)

    if (error) throw error
    return { success: true }
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
      await supabase.from('generated_assets').update({ status: 'scheduled' }).eq('id', assetId)
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

export async function markAssetPosted(assetId) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }
    
    await supabase.from('generated_assets').update({ status: 'posted' }).eq('id', assetId)
    return { success: true }
  } catch (err) {
    return { error: String(err) }
  }
}

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
