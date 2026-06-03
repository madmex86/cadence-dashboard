'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  generateAssetCopy, renderAsset, saveGeneratedAsset,
  publishAsset, markAssetPosted, getSmartSuggestions, loadRecentAssets,
  loadSocialConnections, deleteGeneratedAsset,
  loadHashtagSets, saveHashtagSet, deleteHashtagSet, loadScheduledPosts,
} from './actions'

const TEMPLATES = [
  { id: 'product-card',        label: 'Product Card',       icon: '📦' },
  { id: 'drop-announcement',   label: 'Drop Announcement',  icon: '⚡' },
  { id: 'urgency',             label: 'Low Stock Urgency',  icon: '⚠' },
  { id: 'milestone',           label: 'Milestone',          icon: '📈' },
  { id: 'new-arrival',         label: 'New Arrival',        icon: '✨' },
  { id: 'quote-card',          label: 'Brand Post',         icon: '💬' },
  { id: 'sold-out',            label: 'Sold Out',           icon: '🏠' },
  { id: 'lore-reveal',         label: 'Lore Reveal',        icon: '📖' },
  { id: 'collector-spotlight', label: 'Collector Spotlight',icon: '⭐' },
]

const TRIGGER_LABELS = {
  manual:      'Manual prompt',
  new_product: 'New product',
  low_stock:   'Low stock alert',
  drop:        'Upcoming drop',
  milestone:   'Sales milestone',
  new_arrival: 'New arrival',
}

const ASPECT_RATIOS = [
  { value: '1:1',  label: 'Square',  desc: 'Feed post' },
  { value: '9:16', label: 'Story',   desc: 'Stories / Reels' },
  { value: '16:9', label: 'Banner',  desc: 'Facebook / Pinterest' },
]

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', color: '#E1306C' },
  { id: 'facebook',  label: 'Facebook',  color: '#1877F2' },
  { id: 'pinterest', label: 'Pinterest', color: '#E60023' },
  { id: 'tiktok',    label: 'TikTok',    color: '#69C9D0' },
]

const EXPORT_SIZES = [
  { ratio: '1:1',  label: 'Square 1:1',  hint: 'Instagram Feed · Facebook' },
  { ratio: '9:16', label: 'Story 9:16',  hint: 'Stories · Reels · TikTok' },
  { ratio: '16:9', label: 'Banner 16:9', hint: 'Facebook · Pinterest' },
]

export default function AssetStudio() {
  const [screen, setScreen] = useState('home')
  const [assets, setAssets] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [connections, setConnections] = useState([])

  // Creature selection
  const [creatures, setCreatures] = useState([])
  const [creatureMode, setCreatureMode] = useState('individual') // 'individual' | 'selected' | 'all'
  const [individualCreature, setIndividualCreature] = useState(null)
  const [selectedCreatureIds, setSelectedCreatureIds] = useState(new Set())

  // Builder
  const [triggerType, setTriggerType] = useState('manual')
  const [templateId, setTemplateId] = useState('product-card')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [manualPrompt, setManualPrompt] = useState('')
  const [copy, setCopy] = useState(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState(null)
  const [editingAssetId, setEditingAssetId] = useState(null)
  const [deletingAssetId, setDeletingAssetId] = useState(null)

  // Render results — array so batch works naturally
  // Each: { creature: obj|null, imageUrl: string|null, assetId: string|null, error: string|null }
  const [renderedImages, setRenderedImages] = useState([])
  const [renderProgress, setRenderProgress] = useState(null) // { done, total }

  // Status flags
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [actionError, setActionError] = useState(null)

  // Publish
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [scheduleDate, setScheduleDate] = useState('')
  const [publishResults, setPublishResults] = useState(null)

  // Clipboard
  const [copiedField, setCopiedField] = useState(null)

  // Export pack (single-mode only — per-size render for the one active creature)
  const [exportUrls, setExportUrls] = useState({})
  const [exportRendering, setExportRendering] = useState({})

  // Copy variants
  const [variants, setVariants] = useState(null) // null | [{headline,caption,hashtags,cta}, ...]

  // Hashtag sets
  const [hashtagSets, setHashtagSets] = useState([])
  const [savingSetName, setSavingSetName] = useState('') // '' = picker closed
  const [showSaveSet, setShowSaveSet] = useState(false)

  // Calendar
  const [scheduledPosts, setScheduledPosts] = useState([])

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeCreatures = (() => {
    if (creatureMode === 'all') return creatures
    if (creatureMode === 'selected') return creatures.filter(c => selectedCreatureIds.has(c.id))
    if (creatureMode === 'individual' && individualCreature) return [individualCreature]
    return []
  })()

  const isBatch = renderedImages.length > 1
  const firstSuccess = renderedImages.find(r => r.imageUrl)

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadRecentAssets().then(r => { if (r.assets) setAssets(r.assets) })
    getSmartSuggestions().then(r => { if (r.suggestions) setSuggestions(r.suggestions) })
    loadSocialConnections().then(r => { if (r.connections) setConnections(r.connections) })
    loadHashtagSets().then(r => { if (r.sets) setHashtagSets(r.sets) })
    loadScheduledPosts().then(r => { if (r.posts) setScheduledPosts(r.posts) })
    fetch('/api/creatures').then(r => r.json()).then(d => setCreatures(d.creatures || [])).catch(() => {})
  }, [])

  const copyToClipboard = useCallback(async (text, field) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }, [])

  const triggerDelete = (e, id) => {
    e.stopPropagation()
    setDeletingAssetId(id)
  }

  const cancelDelete = (e) => {
    e.stopPropagation()
    setDeletingAssetId(null)
  }

  const confirmDelete = async (e, id) => {
    e.stopPropagation()
    const res = await deleteGeneratedAsset(id)
    if (res.success) {
      setAssets(prev => prev.filter(a => a.id !== id))
      setDeletingAssetId(null)
    } else {
      alert(`Delete failed: ${res.error}`)
      setDeletingAssetId(null)
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleGenerateCopy = async () => {
    setIsGeneratingCopy(true)
    setCopy(null)
    setVariants(null)
    setActionError(null)

    let sourceData = selectedSuggestion?.sourceData ?? null
    let effectiveTrigger = triggerType

    if (!sourceData) {
      const firstCreature = activeCreatures[0]
      if (firstCreature) {
        sourceData = {
          name: firstCreature.name,
          price: null,
          description: [firstCreature.species, firstCreature.filament_color].filter(Boolean).join(', '),
          image_url: firstCreature.image_url,
        }
        if (triggerType === 'manual') effectiveTrigger = 'new_product'
      } else {
        sourceData = { prompt: manualPrompt }
      }
    }

    const result = await generateAssetCopy({ triggerType: effectiveTrigger, sourceData, templateId })
    setIsGeneratingCopy(false)
    if (result.error) setActionError(`Copy generation failed: ${result.error}`)
    else if (result.variants) setVariants(result.variants)
  }

  // Single mode: user has already generated + edited copy, just render it
  const handleRenderPreview = async () => {
    if (!copy) return
    setIsRendering(true)
    setActionError(null)

    const creature = activeCreatures[0] ?? null
    setRenderProgress({ done: 0, total: 1, stage: 'render', name: creature?.name ?? null })

    const result = await renderAsset({
      headline: copy.headline,
      caption: copy.caption,
      cta: copy.cta,
      productImageUrl: creature?.image_url ?? null,
      aspectRatio,
      templateId,
    })

    setIsRendering(false)
    setRenderProgress(null)

    if (result.imageUrl) {
      setRenderedImages([{ creature, imageUrl: result.imageUrl, assetId: null, error: null, copy }])
      setExportUrls({ [aspectRatio]: result.imageUrl })
      setScreen('preview')
      saveGeneratedAsset({
        asset: {
          id: editingAssetId || undefined,
          trigger_type: creature ? (triggerType === 'manual' ? 'new_product' : triggerType) : triggerType,
          source_data: creature ? { name: creature.name, image_url: creature.image_url } : { prompt: manualPrompt },
          template_id: templateId,
          headline: copy.headline,
          caption: copy.caption,
          hashtags: copy.hashtags,
          cta: copy.cta,
          image_url: result.imageUrl,
          aspect_ratio: aspectRatio,
          status: 'draft',
        },
      }).then(sr => {
        if (sr.id) setRenderedImages(prev => prev.map(r => r.imageUrl === result.imageUrl ? { ...r, assetId: sr.id } : r))
      })
    } else {
      setActionError(`Render failed: ${result.error}`)
    }
  }

  // Batch mode: generate creature-specific copy + render for each creature in sequence
  const handleBatchRender = async () => {
    setIsRendering(true)
    setActionError(null)

    const results = []
    setRenderProgress({ done: 0, total: activeCreatures.length, stage: 'copy', name: null })

    for (let i = 0; i < activeCreatures.length; i++) {
      const creature = activeCreatures[i]

      // Step 1: generate copy specific to this creature
      setRenderProgress({ done: i, total: activeCreatures.length, stage: 'copy', name: creature.name })
      const copyResult = await generateAssetCopy({
        triggerType: triggerType === 'manual' ? 'new_product' : triggerType,
        sourceData: {
          name: creature.name,
          price: null,
          description: [creature.species, creature.filament_color].filter(Boolean).join(', '),
          image_url: creature.image_url,
        },
        templateId,
      })

      if (!copyResult.variants?.length) {
        results.push({ creature, imageUrl: null, assetId: null, error: `Copy failed: ${copyResult.error}`, copy: null })
        setRenderProgress({ done: i + 1, total: activeCreatures.length, stage: 'copy', name: creature.name })
        continue
      }

      const renderCopy = copyResult.variants[0]

      // Step 2: render with that creature's copy + photo
      setRenderProgress({ done: i, total: activeCreatures.length, stage: 'render', name: creature.name })
      const result = await renderAsset({
        headline: renderCopy.headline,
        caption: renderCopy.caption,
        cta: renderCopy.cta,
        productImageUrl: creature.image_url ?? null,
        aspectRatio,
        templateId,
      })

      setRenderProgress({ done: i + 1, total: activeCreatures.length, stage: 'render', name: creature.name })

      if (result.imageUrl) {
        results.push({ creature, imageUrl: result.imageUrl, assetId: null, error: null, copy: renderCopy })
        saveGeneratedAsset({
          asset: {
            trigger_type: triggerType === 'manual' ? 'new_product' : triggerType,
            source_data: { name: creature.name, image_url: creature.image_url },
            template_id: templateId,
            headline: renderCopy.headline,
            caption: renderCopy.caption,
            hashtags: renderCopy.hashtags,
            cta: renderCopy.cta,
            image_url: result.imageUrl,
            aspect_ratio: aspectRatio,
            status: 'draft',
          },
        }).then(sr => {
          if (sr.id) setRenderedImages(prev => prev.map(r => r.imageUrl === result.imageUrl ? { ...r, assetId: sr.id } : r))
        })
      } else {
        results.push({ creature, imageUrl: null, assetId: null, error: result.error ?? 'Render failed', copy: renderCopy })
      }
    }

    setIsRendering(false)
    setRenderProgress(null)

    if (results.some(r => r.imageUrl)) {
      setRenderedImages(results)
      setExportUrls({})
      setScreen('preview')
    } else {
      setActionError(`All renders failed: ${results[0]?.error}`)
    }
  }

  const renderForExport = async (ratio) => {
    if (exportRendering[ratio] || !copy) return
    setExportRendering(prev => ({ ...prev, [ratio]: true }))
    const result = await renderAsset({
      headline: copy.headline,
      caption: copy.caption,
      cta: copy.cta,
      productImageUrl: firstSuccess?.creature?.image_url ?? null,
      aspectRatio: ratio,
      templateId,
    })
    setExportRendering(prev => ({ ...prev, [ratio]: false }))
    if (result.imageUrl) setExportUrls(prev => ({ ...prev, [ratio]: result.imageUrl }))
  }

  const handlePublish = async () => {
    if (!firstSuccess?.imageUrl || selectedPlatforms.length === 0) return
    setIsPublishing(true)
    const publishCopy = firstSuccess.copy ?? copy
    const result = await publishAsset({
      assetId: firstSuccess.assetId,
      imageUrl: firstSuccess.imageUrl,
      caption: publishCopy.caption,
      hashtags: publishCopy.hashtags,
      platforms: selectedPlatforms,
      scheduledFor: scheduleDate ? new Date(scheduleDate) : undefined,
    })
    setIsPublishing(false)
    if (result.results) setPublishResults(result.results)
  }

  const handleMarkPosted = async () => {
    if (!firstSuccess?.assetId) return
    setIsPublishing(true)
    await markAssetPosted(firstSuccess.assetId)
    setAssets(prev => prev.map(a => a.id === firstSuccess.assetId ? { ...a, status: 'posted' } : a))
    setIsPublishing(false)
    setScreen('home')
  }

  const startFromSuggestion = (s) => {
    setSelectedSuggestion(s)
    setTriggerType(s.triggerType)
    setTemplateId(
      s.triggerType === 'low_stock' ? 'urgency' :
      s.triggerType === 'drop' ? 'drop-announcement' : 'product-card'
    )
    setScreen('builder')
  }

  const resetBuilder = () => {
    setCopy(null); setVariants(null); setRenderedImages([]); setPublishResults(null)
    setSelectedSuggestion(null); setSelectedPlatforms([]); setScheduleDate('')
    setExportUrls({}); setExportRendering({}); setActionError(null)
    setRenderProgress(null); setScreen('home'); setEditingAssetId(null)
    setShowSaveSet(false); setSavingSetName('')
  }

  const editAsset = (asset) => {
    setEditingAssetId(asset.id)
    setTriggerType(asset.trigger_type || 'manual')
    setTemplateId(asset.template_id || 'product-card')
    setAspectRatio(asset.aspect_ratio || '1:1')
    setManualPrompt(asset.source_data?.prompt || '')
    
    // Attempt to match creature if applicable
    let matchedCreature = null;
    if (asset.source_data?.name && !asset.source_data?.prompt) {
      matchedCreature = creatures.find(c => c.name === asset.source_data.name) || {
        name: asset.source_data.name,
        image_url: asset.source_data.image_url
      }
      setCreatureMode('individual')
      setIndividualCreature(matchedCreature)
    }

    const assetCopy = {
      headline: asset.headline || '',
      caption: asset.caption || '',
      hashtags: asset.hashtags || [],
      cta: asset.cta || 'Learn More'
    }
    setCopy(assetCopy)

    // Load into preview mode
    setRenderedImages([{
      creature: matchedCreature,
      imageUrl: asset.image_url,
      assetId: asset.id,
      error: null,
      copy: assetCopy
    }])
    setExportUrls(asset.image_url ? { [asset.aspect_ratio || '1:1']: asset.image_url } : {})
    setScreen('preview')
  }

  const toggleCreatureId = (id) => setSelectedCreatureIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const connectedPlatforms = connections.filter(c => c.is_active).map(c => c.platform)

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .as-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(201,168,76,0.12); border-radius: 10px; padding: 1.25rem; }
        .as-chip { display:flex; align-items:center; gap:.4rem; justify-content:center; padding:.5rem .75rem; border-radius:6px; background:transparent; color:rgba(250,246,240,0.5); font-size:13px; border:1px solid rgba(201,168,76,0.12); cursor:pointer; transition:all .15s; font-family:inherit; }
        .as-chip.sel { background:rgba(201,168,76,0.1); border-color:rgba(201,168,76,0.4); color:var(--gold); font-weight:600; }
        .as-inp { width:100%; background:rgba(255,255,255,0.03); border:1px solid rgba(201,168,76,0.15); border-radius:6px; color:#FAF6F0; font-size:14px; padding:.75rem; resize:vertical; font-family:inherit; line-height:1.5; box-sizing:border-box; outline:none; }
        .as-btn-pri { display:inline-flex; align-items:center; gap:.4rem; padding:.5rem 1rem; border-radius:6px; background:var(--gold); color:#0E0C09; font-weight:700; font-size:13px; border:none; cursor:pointer; font-family:inherit; }
        .as-btn-pri:disabled { opacity:.4; cursor:default; }
        .as-btn-ghost { display:inline-flex; align-items:center; gap:.4rem; padding:.45rem .75rem; border-radius:6px; background:transparent; color:rgba(250,246,240,0.6); font-weight:500; font-size:13px; border:1px solid rgba(201,168,76,0.15); cursor:pointer; font-family:inherit; text-decoration:none; }
        .as-fl { font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:rgba(250,246,240,0.4); margin:0 0 .65rem; display:block; }
        .as-creature-row { display:flex; align-items:center; gap:10px; padding:7px 10px; border-radius:6px; cursor:pointer; transition:background .12s; }
        .as-creature-row:hover { background:rgba(201,168,76,0.06); }
        @media(max-width:860px){ .as-two-col{ grid-template-columns:1fr !important; } }
      `}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {screen !== 'home' && (
            <button onClick={resetBuilder} className="as-btn-ghost" style={{ padding:'4px 8px' }}>✕</button>
          )}
          <div>
            <h1 style={{ fontFamily:'var(--font-caveat,cursive)', fontSize:'2rem', color:'var(--gold)', margin:0 }}>
              ✦ Asset Studio
            </h1>
            {screen !== 'home' && (
              <span style={{ fontSize:11, color:'rgba(250,246,240,0.35)', letterSpacing:'.08em' }}>
                {screen === 'builder' ? '› Create' : '› Preview & Publish'}
              </span>
            )}
          </div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <a href="/asset-studio/settings" className="as-btn-ghost">
            ⚙ Social Accounts
            {connectedPlatforms.length > 0 && (
              <span style={{ background:'var(--gold)', color:'#0E0C09', fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:99 }}>
                {connectedPlatforms.length}
              </span>
            )}
          </a>
          {screen === 'home' && (
            <button onClick={() => setScreen('builder')} className="as-btn-pri">+ New Asset</button>
          )}
        </div>
      </div>

      {/* ── HOME ─────────────────────────────────────────────────────────── */}
      {screen === 'home' && (
        <div>
          {suggestions.length > 0 && (
            <div style={{ marginBottom:32 }}>
              <p style={{ fontSize:10, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(250,246,240,0.35)', margin:'0 0 12px' }}>Smart Suggestions</p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {suggestions.map(s => (
                  <div key={s.id} className="as-card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', borderLeft:`3px solid ${s.urgency === 'high' ? '#e09090' : 'var(--gold)'}` }}>
                    <div>
                      <p style={{ margin:0, fontWeight:600, fontSize:13 }}>{s.title}</p>
                      <p style={{ margin:'3px 0 0', fontSize:12, color:'rgba(250,246,240,0.5)' }}>{s.description}</p>
                    </div>
                    <button onClick={() => startFromSuggestion(s)} className="as-btn-pri">Create Post →</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p style={{ fontSize:10, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(250,246,240,0.35)', margin:'0 0 12px' }}>Recent Assets</p>
          {assets.length === 0 ? (
            <div className="as-card" style={{ textAlign:'center', padding:'48px 24px' }}>
              <div style={{ fontSize:36, marginBottom:12, opacity:.2 }}>🖼</div>
              <p style={{ color:'rgba(250,246,240,0.5)', margin:0, fontSize:13 }}>No assets yet. Create your first post above.</p>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14 }}>
              {assets.map(asset => (
                <div key={asset.id} className="as-card" onClick={() => editAsset(asset)} style={{ padding:0, overflow:'hidden', cursor:'pointer' }}>
                  {asset.image_url
                    ? <img src={asset.image_url} alt={asset.headline ?? ''} style={{ width:'100%', aspectRatio:'1', objectFit:'cover', display:'block' }} />
                    : <div style={{ width:'100%', aspectRatio:'1', background:'rgba(255,255,255,0.03)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, opacity:.2 }}>🖼</div>
                  }
                  <div style={{ padding:'12px 14px' }}>
                    <p style={{ margin:'0 0 5px', fontWeight:600, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{asset.headline ?? 'Untitled'}</p>
                    {asset.hashtags && asset.hashtags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                        {asset.hashtags.slice(0, 3).map((h, idx) => (
                          <span key={idx} style={{ fontSize: 10, color: 'var(--gold)', background: 'rgba(201,168,76,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                            #{h.replace(/^#/, '')}
                          </span>
                        ))}
                        {asset.hashtags.length > 3 && <span style={{ fontSize: 10, color: 'rgba(250,246,240,0.4)', padding: '2px 4px' }}>+{asset.hashtags.length - 3}</span>}
                      </div>
                    )}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <StatusPill status={asset.status} />
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <span style={{ fontSize:10, color:'rgba(250,246,240,0.35)' }}>{TRIGGER_LABELS[asset.trigger_type] ?? asset.trigger_type}</span>
                        {deletingAssetId === asset.id ? (
                          <div style={{ display:'flex', gap: 6, alignItems: 'center' }}>
                            <button onClick={(e) => cancelDelete(e)} style={{ background:'transparent', color:'rgba(250,246,240,0.6)', border:'none', cursor:'pointer', fontSize:11, padding:0 }}>Cancel</button>
                            <button onClick={(e) => confirmDelete(e, asset.id)} style={{ background:'#D32F2F', color:'white', border:'none', borderRadius:4, padding:'2px 6px', cursor:'pointer', fontSize:11, fontWeight:600 }}>Delete</button>
                          </div>
                        ) : (
                          <button onClick={(e) => triggerDelete(e, asset.id)} style={{ background:'none', border:'none', padding:0, cursor:'pointer', color:'rgba(250,246,240,0.4)', fontSize:12 }} title="Delete">✕</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        {/* Post Calendar */}
        <div style={{ marginTop: 40 }}>
          <CalendarView
            posts={scheduledPosts}
            onOpenAsset={id => {
              const asset = assets.find(a => a.id === id)
              if (asset) editAsset(asset)
            }}
          />
        </div>
      </div>
      )}

      {/* ── BUILDER ──────────────────────────────────────────────────────── */}
      {screen === 'builder' && (
        <div className="as-two-col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'start' }}>

          {/* LEFT — Config */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Creatures */}
            <div className="as-card">
              <span className="as-fl">Creatures</span>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:12 }}>
                {[
                  { id: 'individual', label: 'One' },
                  { id: 'selected',   label: 'Pick' },
                  { id: 'all',        label: 'All' },
                ].map(m => (
                  <button key={m.id} onClick={() => setCreatureMode(m.id)} className={`as-chip${creatureMode === m.id ? ' sel' : ''}`}>
                    {m.label}
                  </button>
                ))}
              </div>

              {creatureMode === 'individual' && (
                <select
                  className="as-inp"
                  style={{ resize:'none' }}
                  value={individualCreature?.id || ''}
                  onChange={e => setIndividualCreature(creatures.find(c => c.id === e.target.value) || null)}
                >
                  <option value="">— no creature (text only) —</option>
                  {creatures.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.species ? ` · ${c.species}` : ''}{c.filament_color ? ` · ${c.filament_color}` : ''}
                    </option>
                  ))}
                </select>
              )}

              {creatureMode === 'selected' && (
                <div style={{ display:'flex', flexDirection:'column', gap:2, maxHeight:200, overflowY:'auto' }}>
                  {creatures.length === 0 && (
                    <p style={{ fontSize:12, color:'rgba(250,246,240,0.35)', margin:0 }}>No active creatures found.</p>
                  )}
                  {creatures.map(c => {
                    const checked = selectedCreatureIds.has(c.id)
                    return (
                      <label key={c.id} className="as-creature-row" onClick={() => toggleCreatureId(c.id)}>
                        <div style={{ width:16, height:16, borderRadius:4, border:`1.5px solid ${checked ? 'var(--gold)' : 'rgba(201,168,76,0.3)'}`, background: checked ? 'var(--gold)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .12s' }}>
                          {checked && <span style={{ fontSize:10, color:'#0E0C09', fontWeight:700, lineHeight:1 }}>✓</span>}
                        </div>
                        {c.image_url && (
                          <img src={c.image_url} alt={c.name} style={{ width:28, height:28, borderRadius:4, objectFit:'cover', flexShrink:0 }} />
                        )}
                        <div>
                          <div style={{ fontSize:12, fontWeight:600 }}>{c.name}</div>
                          {(c.species || c.filament_color) && (
                            <div style={{ fontSize:10, color:'rgba(250,246,240,0.4)' }}>
                              {[c.species, c.filament_color].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                      </label>
                    )
                  })}
                  {creatures.length > 0 && (
                    <div style={{ display:'flex', gap:8, marginTop:6, paddingTop:6, borderTop:'1px solid rgba(201,168,76,0.08)' }}>
                      <button onClick={() => setSelectedCreatureIds(new Set(creatures.map(c => c.id)))} className="as-btn-ghost" style={{ fontSize:11, padding:'3px 8px' }}>Select all</button>
                      <button onClick={() => setSelectedCreatureIds(new Set())} className="as-btn-ghost" style={{ fontSize:11, padding:'3px 8px' }}>Clear</button>
                    </div>
                  )}
                </div>
              )}

              {creatureMode === 'all' && (
                <div style={{ fontSize:12, color:'rgba(250,246,240,0.45)', padding:'4px 0' }}>
                  {creatures.length > 0
                    ? <>{creatures.length} active creature{creatures.length !== 1 ? 's' : ''} — one render per creature</>
                    : 'No active creatures found.'
                  }
                </div>
              )}
            </div>

            {/* Trigger type */}
            <div className="as-card">
              <span className="as-fl">Trigger Type</span>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {Object.keys(TRIGGER_LABELS).map(t => (
                  <button key={t} onClick={() => setTriggerType(t)} className={`as-chip${triggerType === t ? ' sel' : ''}`}>
                    {TRIGGER_LABELS[t]}
                  </button>
                ))}
              </div>
              {triggerType === 'manual' && (
                <textarea
                  value={manualPrompt}
                  onChange={e => setManualPrompt(e.target.value)}
                  placeholder="Describe the post you want to create..."
                  rows={3}
                  className="as-inp"
                  style={{ marginTop:10 }}
                />
              )}
              {selectedSuggestion && (
                <div style={{ marginTop:10, padding:'10px 12px', background:'rgba(201,168,76,0.08)', borderRadius:6, fontSize:12, color:'rgba(250,246,240,0.7)' }}>
                  Using: <strong>{selectedSuggestion.title}</strong>
                </div>
              )}
            </div>

            {/* Template */}
            <div className="as-card">
              <span className="as-fl">Template</span>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => setTemplateId(t.id)} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:6, cursor:'pointer', textAlign:'left', width:'100%', fontFamily:'inherit',
                    border:`1px solid ${templateId === t.id ? 'var(--gold)' : 'rgba(201,168,76,0.12)'}`,
                    background: templateId === t.id ? 'rgba(201,168,76,0.08)' : 'transparent',
                    color: templateId === t.id ? 'var(--gold)' : 'rgba(250,246,240,0.6)',
                    transition:'all .15s',
                  }}>
                    <span>{t.icon}</span>
                    <span style={{ fontSize:13, fontWeight: templateId === t.id ? 600 : 400 }}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio */}
            <div className="as-card">
              <span className="as-fl">Format</span>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                {ASPECT_RATIOS.map(ar => (
                  <button key={ar.value} onClick={() => setAspectRatio(ar.value)} className={`as-chip${aspectRatio === ar.value ? ' sel' : ''}`} style={{ flexDirection:'column', gap:3, padding:'10px 6px' }}>
                    <span style={{ fontWeight:600, fontSize:13 }}>{ar.label}</span>
                    <span style={{ fontSize:10, opacity:.6 }}>{ar.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {actionError && (
              <div style={{ padding:'10px 12px', borderRadius:6, background:'rgba(224,112,112,0.08)', border:'1px solid rgba(224,112,112,0.25)', fontSize:12, color:'#e07070', lineHeight:1.5 }}>
                {actionError}
              </div>
            )}

            {/* SINGLE MODE — separate generate + render steps */}
            {activeCreatures.length <= 1 && (
              <button onClick={handleGenerateCopy} disabled={isGeneratingCopy} className="as-btn-pri" style={{ width:'100%', justifyContent:'center', padding:'12px' }}>
                {isGeneratingCopy ? <><Spin /> Generating copy…</> : <>✦ Generate Copy</>}
              </button>
            )}

            {/* BATCH MODE — one button that generates + renders per creature */}
            {activeCreatures.length > 1 && (
              <button onClick={handleBatchRender} disabled={isRendering} className="as-btn-pri" style={{ width:'100%', justifyContent:'center', padding:'12px' }}>
                {isRendering && renderProgress
                  ? renderProgress.stage === 'copy'
                    ? <><Spin /> Writing copy for {renderProgress.name}… ({renderProgress.done + 1}/{renderProgress.total})</>
                    : <><Spin /> Rendering {renderProgress.name}… ({renderProgress.done + 1}/{renderProgress.total})</>
                  : isRendering
                    ? <><Spin /> Starting…</>
                    : <>✦ Generate &amp; Render All ({activeCreatures.length})</>
                }
              </button>
            )}
          </div>

          {/* RIGHT — copy editor (single) or batch plan (batch) */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {activeCreatures.length > 1 ? (
              /* BATCH — show the plan: each creature gets its own copy + render */
              <div className="as-card" style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <span className="as-fl">Batch Plan</span>
                  <p style={{ fontSize:12, color:'rgba(250,246,240,0.5)', margin:'0 0 14px', lineHeight:1.6 }}>
                    Claude writes creature-specific copy for each one, then renders. Nothing is shared between creatures.
                  </p>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {activeCreatures.map((c, i) => (
                    <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:6, background:'rgba(201,168,76,0.04)', border:'1px solid rgba(201,168,76,0.1)' }}>
                      {c.image_url && <img src={c.image_url} alt={c.name} style={{ width:28, height:28, borderRadius:4, objectFit:'cover', flexShrink:0 }} />}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600 }}>{c.name}</div>
                        {(c.species || c.filament_color) && (
                          <div style={{ fontSize:10, color:'rgba(250,246,240,0.4)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {[c.species, c.filament_color].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize:10, color:'rgba(250,246,240,0.25)', textTransform:'uppercase', letterSpacing:'.06em', flexShrink:0 }}>
                        {TEMPLATES.find(t => t.id === templateId)?.icon}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:11, color:'rgba(250,246,240,0.3)', paddingTop:8, borderTop:'1px solid rgba(201,168,76,0.08)', lineHeight:1.6 }}>
                  Template: {TEMPLATES.find(t => t.id === templateId)?.label} · Format: {ASPECT_RATIOS.find(a => a.value === aspectRatio)?.label} ({ASPECT_RATIOS.find(a => a.value === aspectRatio)?.desc})
                </div>
              </div>
            ) : (
              /* SINGLE — variant picker → copy editor */
              !copy && !variants ? (
                <div className="as-card" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:400, gap:12 }}>
                  <div style={{ fontSize:32, opacity:.2 }}>✦</div>
                  <p style={{ color:'rgba(250,246,240,0.4)', fontSize:13, margin:0, textAlign:'center' }}>
                    Configure your post on the left,<br />then generate copy to see it here.
                  </p>
                </div>
              ) : !copy && variants ? (
                /* Variant picker */
                <div className="as-card">
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                    <span className="as-fl" style={{ margin:0 }}>Choose a variant</span>
                    <button onClick={handleGenerateCopy} disabled={isGeneratingCopy} className="as-btn-ghost" style={{ padding:'3px 8px', fontSize:11 }}>
                      {isGeneratingCopy ? <><Spin /> Generating…</> : '↺ Regenerate'}
                    </button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {variants.map((v, i) => (
                      <button key={i} onClick={() => setCopy(v)} style={{
                        textAlign:'left', padding:'12px 14px', borderRadius:8, cursor:'pointer', width:'100%',
                        background:'rgba(201,168,76,0.03)', border:'1px solid rgba(201,168,76,0.14)',
                        color:'rgba(250,246,240,0.85)', fontFamily:'inherit', transition:'border-color .12s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.borderColor='rgba(201,168,76,0.4)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor='rgba(201,168,76,0.14)'}
                      >
                        <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--gold)', marginBottom:5, opacity:.7 }}>Option {i + 1}</div>
                        <div style={{ fontSize:13, fontWeight:700, marginBottom:4 }}>{v.headline}</div>
                        <div style={{ fontSize:11, color:'rgba(250,246,240,0.5)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.caption}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Copy editor */
                <>
                  {variants && (
                    <button onClick={() => setCopy(null)} className="as-btn-ghost" style={{ fontSize:11, padding:'3px 8px', alignSelf:'flex-start' }}>
                      ◁ Variants
                    </button>
                  )}

                  <CopyField label="Headline" value={copy.headline} onChange={v => setCopy({...copy, headline: v})} copiedField={copiedField} onCopy={copyToClipboard} rows={2} />
                  <CopyField label="Caption" value={copy.caption} onChange={v => setCopy({...copy, caption: v})} copiedField={copiedField} onCopy={copyToClipboard} rows={4} />

                  <div className="as-card">
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                      <span className="as-fl" style={{ margin:0 }}>Hashtags</span>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        {hashtagSets.length > 0 && (
                          <select
                            defaultValue=""
                            onChange={e => {
                              const s = hashtagSets.find(hs => hs.id === e.target.value)
                              if (s) setCopy({...copy, hashtags: s.hashtags})
                              e.target.value = ''
                            }}
                            style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(201,168,76,0.15)', borderRadius:5, color:'rgba(250,246,240,0.6)', fontSize:11, padding:'3px 6px', fontFamily:'inherit', cursor:'pointer' }}
                          >
                            <option value="">Load set…</option>
                            {hashtagSets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        )}
                        {!showSaveSet ? (
                          <button onClick={() => setShowSaveSet(true)} className="as-btn-ghost" style={{ padding:'3px 8px', fontSize:11 }}>Save set</button>
                        ) : (
                          <form onSubmit={async e => {
                            e.preventDefault()
                            if (!savingSetName.trim()) return
                            const res = await saveHashtagSet({ name: savingSetName.trim(), hashtags: copy.hashtags })
                            if (res.id) {
                              setHashtagSets(prev => [{ id: res.id, name: savingSetName.trim(), hashtags: copy.hashtags }, ...prev])
                              setShowSaveSet(false); setSavingSetName('')
                            }
                          }} style={{ display:'flex', gap:4 }}>
                            <input
                              autoFocus
                              value={savingSetName}
                              onChange={e => setSavingSetName(e.target.value)}
                              placeholder="Set name…"
                              className="as-inp"
                              style={{ padding:'3px 7px', fontSize:11, resize:'none', width:100 }}
                            />
                            <button type="submit" className="as-btn-pri" style={{ padding:'3px 8px', fontSize:11 }}>✓</button>
                            <button type="button" onClick={() => { setShowSaveSet(false); setSavingSetName('') }} className="as-btn-ghost" style={{ padding:'3px 6px', fontSize:11 }}>✕</button>
                          </form>
                        )}
                        <button onClick={() => copyToClipboard(copy.hashtags.map(h => `#${h.replace(/^#/,'')}`).join(' '), 'hashtags')} className="as-btn-ghost" style={{ padding:'3px 8px', fontSize:11 }}>
                          {copiedField === 'hashtags' ? '✓' : '⎘'}
                        </button>
                      </div>
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {copy.hashtags.map((tag, i) => (
                        <span key={i} style={{ padding:'3px 9px', background:'rgba(201,168,76,0.1)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:99, fontSize:11, color:'var(--gold)' }}>
                          #{tag.replace(/^#/, '')}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="as-card">
                    <span className="as-fl">Call to Action</span>
                    <input value={copy.cta} onChange={e => setCopy({...copy, cta: e.target.value})} className="as-inp" style={{ resize:'none' }} />
                  </div>

                  {actionError && (
                    <div style={{ padding:'10px 12px', borderRadius:6, background:'rgba(224,112,112,0.08)', border:'1px solid rgba(224,112,112,0.25)', fontSize:12, color:'#e07070', lineHeight:1.5 }}>
                      {actionError}
                    </div>
                  )}

                  <div style={{ display:'flex', gap:10 }}>
                    <button onClick={handleGenerateCopy} disabled={isGeneratingCopy} className="as-btn-ghost" style={{ flex:1, justifyContent:'center', padding:'10px' }}>
                      ↺ New variants
                    </button>
                    <button onClick={handleRenderPreview} disabled={isRendering} className="as-btn-pri" style={{ flex:2, justifyContent:'center', padding:'10px' }}>
                      {isRendering ? <><Spin /> Rendering…</> : <>🖼 Render Preview</>}
                    </button>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}

      {/* ── PREVIEW ──────────────────────────────────────────────────────── */}
      {screen === 'preview' && renderedImages.length > 0 && (
        <div>
          {isBatch ? (
            /* BATCH — grid of all renders */
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <div>
                  <p style={{ fontSize:10, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(250,246,240,0.35)', margin:'0 0 4px' }}>
                    Batch Results — {renderedImages.filter(r => r.imageUrl).length} of {renderedImages.length} rendered
                  </p>
                  <p style={{ fontSize:12, color:'rgba(250,246,240,0.4)', margin:0 }}>
                    {TEMPLATES.find(t => t.id === templateId)?.label} · {ASPECT_RATIOS.find(a => a.value === aspectRatio)?.label}
                  </p>
                </div>
                <button onClick={() => setScreen('builder')} className="as-btn-ghost">↺ Edit Copy</button>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14, marginBottom:24 }}>
                {renderedImages.map((item, i) => (
                  <div key={i} className="as-card" style={{ padding:0, overflow:'hidden' }}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.creature?.name ?? 'Asset'} style={{ width:'100%', aspectRatio:'1', objectFit:'cover', display:'block' }} />
                    ) : (
                      <div style={{ width:'100%', aspectRatio:'1', background:'rgba(232,112,112,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>✕</div>
                    )}
                    <div style={{ padding:'10px 12px' }}>
                      <p style={{ margin:'0 0 6px', fontWeight:600, fontSize:12 }}>
                        {item.creature?.name ?? 'No creature'}
                      </p>
                      {item.copy?.hashtags && item.copy.hashtags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                          {item.copy.hashtags.slice(0, 3).map((h, idx) => (
                            <span key={idx} style={{ fontSize: 10, color: 'var(--gold)', background: 'rgba(201,168,76,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                              #{h.replace(/^#/, '')}
                            </span>
                          ))}
                          {item.copy.hashtags.length > 3 && <span style={{ fontSize: 10, color: 'rgba(250,246,240,0.4)', padding: '2px 4px' }}>+{item.copy.hashtags.length - 3}</span>}
                        </div>
                      )}
                      {item.error ? (
                        <p style={{ margin:0, fontSize:11, color:'#e07070' }}>{item.error}</p>
                      ) : item.imageUrl ? (
                        <a href={`/api/download?url=${encodeURIComponent(item.imageUrl)}&filename=${encodeURIComponent(`${item.creature?.name ?? 'asset'}-${aspectRatio.replace(':','x')}.png`)}`} className="as-btn-ghost" style={{ fontSize:11, padding:'4px 10px', width:'100%', justifyContent:'center', boxSizing:'border-box' }}>
                          ↓ Download
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {/* Publish uses first successful render */}
              {firstSuccess && (
                <PublishPanel
                  copy={copy}
                  imageUrl={firstSuccess.imageUrl}
                  assetId={firstSuccess.assetId}
                  connectedPlatforms={connectedPlatforms}
                  selectedPlatforms={selectedPlatforms}
                  setSelectedPlatforms={setSelectedPlatforms}
                  scheduleDate={scheduleDate}
                  setScheduleDate={setScheduleDate}
                  isPublishing={isPublishing}
                  publishResults={publishResults}
                  onPublish={handlePublish}
                  onMarkPosted={handleMarkPosted}
                  onReset={resetBuilder}
                  note={renderedImages.length > 1 ? `Publishing first image (${firstSuccess.creature?.name ?? 'asset'})` : null}
                />
              )}
            </div>
          ) : (
            /* SINGLE — full view with export pack */
            <div className="as-two-col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'start' }}>

              {/* LEFT — image + export pack */}
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ borderRadius:10, overflow:'hidden', border:'1px solid rgba(201,168,76,0.15)', maxWidth: '400px', width: '100%' }}>
                  <img src={renderedImages[0].imageUrl} alt={renderedImages[0].copy?.headline ?? copy?.headline ?? ''} style={{ width:'100%', maxHeight:'600px', objectFit:'contain', display:'block', background:'rgba(0,0,0,0.2)' }} />
                </div>

                {renderedImages[0].creature && (
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {renderedImages[0].creature.image_url && (
                      <img src={renderedImages[0].creature.image_url} alt="" style={{ width:24, height:24, borderRadius:4, objectFit:'cover' }} />
                    )}
                    <span style={{ fontSize:12, color:'rgba(250,246,240,0.5)' }}>
                      {renderedImages[0].creature.name}
                      {renderedImages[0].creature.species ? ` · ${renderedImages[0].creature.species}` : ''}
                    </span>
                  </div>
                )}

                {(renderedImages[0].copy?.hashtags || copy?.hashtags) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(renderedImages[0].copy?.hashtags || copy?.hashtags).map((h, idx) => (
                      <span key={idx} style={{ fontSize: 11, color: 'var(--gold)', background: 'rgba(201,168,76,0.1)', padding: '3px 8px', borderRadius: 6 }}>
                        #{h.replace(/^#/, '')}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display:'flex', gap:10 }}>
                  <a href={`/api/download?url=${encodeURIComponent(renderedImages[0].imageUrl)}&filename=cadence-asset-${aspectRatio.replace(':','x')}.png`} className="as-btn-ghost" style={{ flex:1, justifyContent:'center', padding:'10px' }}>↓ Download</a>
                  <button onClick={() => setScreen('builder')} className="as-btn-ghost" style={{ flex:1, justifyContent:'center', padding:'10px' }}>↺ Regenerate</button>
                </div>

                {/* Export Pack */}
                <div className="as-card">
                  <span className="as-fl">Export Pack</span>
                  <p style={{ fontSize:11, color:'rgba(250,246,240,0.35)', margin:'0 0 10px', lineHeight:1.5 }}>Render each size for manual upload</p>
                  {EXPORT_SIZES.map(({ ratio, label, hint }, i, arr) => (
                    <div key={ratio} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(201,168,76,0.08)' : 'none' }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600 }}>{label}</div>
                        <div style={{ fontSize:10, color:'rgba(250,246,240,0.35)', marginTop:1 }}>{hint}</div>
                      </div>
                      {exportUrls[ratio] ? (
                        <a href={`/api/download?url=${encodeURIComponent(exportUrls[ratio])}&filename=cadence-asset-${ratio.replace(':','x')}.png`} className="as-btn-ghost" style={{ padding:'5px 12px', fontSize:11 }}>↓ Download</a>
                      ) : (
                        <button onClick={() => renderForExport(ratio)} disabled={!!exportRendering[ratio]} className="as-btn-ghost" style={{ padding:'5px 12px', fontSize:11, opacity: exportRendering[ratio] ? .5 : 1 }}>
                          {exportRendering[ratio] ? <><Spin /> Rendering…</> : ratio === aspectRatio ? '✓ Ready' : 'Render'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT — publish */}
              <PublishPanel
                copy={copy}
                imageUrl={renderedImages[0].imageUrl}
                assetId={renderedImages[0].assetId}
                connectedPlatforms={connectedPlatforms}
                selectedPlatforms={selectedPlatforms}
                setSelectedPlatforms={setSelectedPlatforms}
                scheduleDate={scheduleDate}
                setScheduleDate={setScheduleDate}
                isPublishing={isPublishing}
                publishResults={publishResults}
                onPublish={handlePublish}
                onMarkPosted={handleMarkPosted}
                onReset={resetBuilder}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function PublishPanel({ copy, imageUrl, assetId, connectedPlatforms, selectedPlatforms, setSelectedPlatforms, scheduleDate, setScheduleDate, isPublishing, publishResults, onPublish, onMarkPosted, onReset, note }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {note && (
        <div style={{ fontSize:11, color:'rgba(250,246,240,0.35)', padding:'6px 10px', borderRadius:6, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(201,168,76,0.08)' }}>
          {note}
        </div>
      )}

      <div className="as-card">
        <span className="as-fl">Publish To</span>
        {connectedPlatforms.length === 0 ? (
          <div style={{ textAlign:'center', padding:'24px 0' }}>
            <p style={{ fontSize:12, color:'rgba(250,246,240,0.4)', margin:'0 0 12px' }}>No social accounts connected yet.</p>
            <a href="/asset-studio/settings" className="as-btn-pri" style={{ textDecoration:'none' }}>Connect Accounts</a>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {PLATFORMS.filter(p => connectedPlatforms.includes(p.id)).map(platform => {
              const sel = selectedPlatforms.includes(platform.id)
              return (
                <button key={platform.id} onClick={() => setSelectedPlatforms(prev => sel ? prev.filter(p => p !== platform.id) : [...prev, platform.id])} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:6, cursor:'pointer', textAlign:'left', width:'100%', fontFamily:'inherit', border:`1px solid ${sel ? platform.color : 'rgba(201,168,76,0.12)'}`, background: sel ? `${platform.color}15` : 'transparent', color: sel ? '#FAF6F0' : 'rgba(250,246,240,0.5)' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: sel ? platform.color : 'rgba(255,255,255,0.2)' }} />
                  <span style={{ fontSize:13, fontWeight: sel ? 600 : 400 }}>{platform.label}</span>
                  {sel && <span style={{ marginLeft:'auto', color: platform.color }}>✓</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {connectedPlatforms.length > 0 && (
        <div className="as-card">
          <span className="as-fl">When</span>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <button onClick={() => setScheduleDate('')} className={`as-chip${scheduleDate === '' ? ' sel' : ''}`}>→ Post Now</button>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <button onClick={() => setScheduleDate(scheduleDate || new Date(Date.now() + 3600000).toISOString().slice(0, 16))} className={`as-chip${scheduleDate !== '' ? ' sel' : ''}`} style={{ flex:1 }}>
                🗓 Schedule
              </button>
              {scheduleDate !== '' && (
                <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="as-inp" style={{ flex:2, padding:'8px 10px', resize:'none' }} />
              )}
            </div>
          </div>
        </div>
      )}

      {publishResults && (
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {Object.entries(publishResults).map(([platform, result]) => (
            <div key={platform} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:6, background: result.success ? 'rgba(125,201,148,0.08)' : 'rgba(224,144,144,0.08)', border:`1px solid ${result.success ? 'rgba(125,201,148,0.2)' : 'rgba(224,144,144,0.2)'}` }}>
              <span>{result.success ? '✓' : '✕'}</span>
              <span style={{ fontSize:13, textTransform:'capitalize' }}>{platform}</span>
              <span style={{ fontSize:11, color:'rgba(250,246,240,0.5)', marginLeft:'auto' }}>
                {result.success ? (scheduleDate ? 'Scheduled' : 'Posted') : result.error}
              </span>
            </div>
          ))}
        </div>
      )}

      {!publishResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onPublish} disabled={isPublishing || selectedPlatforms.length === 0} className="as-btn-pri" style={{ width:'100%', justifyContent:'center', padding:'12px', opacity: selectedPlatforms.length === 0 ? .4 : 1 }}>
            {isPublishing ? <><Spin /> Publishing…</> : scheduleDate ? <>🗓 Schedule Post</> : <>→ Publish Now</>}
          </button>
          <button onClick={onMarkPosted} disabled={isPublishing} className="as-btn-ghost" style={{ width:'100%', justifyContent:'center', padding:'10px' }}>
            ✓ Mark as Manually Posted
          </button>
        </div>
      )}

      {publishResults && (
        <button onClick={onReset} className="as-btn-ghost" style={{ width:'100%', justifyContent:'center', padding:'10px' }}>
          Create Another Asset
        </button>
      )}
    </div>
  )
}

function CopyField({ label, value, onChange, copiedField, onCopy, rows }) {
  return (
    <div className="as-card">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <span className="as-fl" style={{ margin:0 }}>{label}</span>
        <button onClick={() => onCopy(value, label)} className="as-btn-ghost" style={{ padding:'3px 8px', fontSize:11 }}>
          {copiedField === label ? '✓' : '⎘'}
        </button>
      </div>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} className="as-inp" />
    </div>
  )
}

function Spin() {
  return <span style={{ display:'inline-block', animation:'spin 1s linear infinite' }}>⟳</span>
}

function StatusPill({ status }) {
  const map = {
    draft:     { color:'rgba(250,246,240,0.5)', bg:'rgba(255,255,255,0.06)' },
    approved:  { color:'#7dc994',               bg:'rgba(125,201,148,0.1)' },
    posted:    { color:'#5BBFD4',               bg:'rgba(91,191,212,0.1)' },
    scheduled: { color:'var(--gold)',            bg:'rgba(201,168,76,0.1)' },
  }
  const { color, bg } = map[status] ?? map.draft
  return (
    <span style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:600, letterSpacing:'.04em', textTransform:'uppercase', color, background:bg }}>
      {status}
    </span>
  )
}

function CalendarView({ posts, onOpenAsset }) {
  const [viewDate, setViewDate] = useState(() => new Date())

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayStr = new Date().toDateString()

  const postsForDay = (date) => {
    if (!date) return []
    return posts.filter(p => {
      const d = new Date(p.scheduled_for)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === date.getDate()
    })
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <p style={{ fontSize:10, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(250,246,240,0.35)', margin:0 }}>
          Post Calendar
        </p>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="as-btn-ghost" style={{ padding:'3px 8px' }}>‹</button>
          <span style={{ fontSize:12, fontWeight:600, minWidth:140, textAlign:'center', color:'rgba(250,246,240,0.7)' }}>{monthLabel}</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="as-btn-ghost" style={{ padding:'3px 8px' }}>›</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:2 }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:9, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', color:'rgba(250,246,240,0.25)', padding:'3px 0' }}>{d}</div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
        {cells.map((date, i) => {
          const dayPosts = postsForDay(date)
          const isToday = date && date.toDateString() === todayStr
          return (
            <div key={i} style={{
              minHeight:52,
              padding:'4px 5px',
              borderRadius:5,
              background: isToday ? 'rgba(201,168,76,0.06)' : 'rgba(255,255,255,0.01)',
              border:`1px solid ${isToday ? 'rgba(201,168,76,0.3)' : 'rgba(201,168,76,0.06)'}`,
              opacity: date ? 1 : 0.2,
            }}>
              {date && (
                <>
                  <div style={{ fontSize:10, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--gold)' : 'rgba(250,246,240,0.35)', marginBottom:3 }}>
                    {date.getDate()}
                  </div>
                  {dayPosts.map((p, pi) => (
                    <div key={pi} onClick={() => onOpenAsset?.(p.asset_id)} style={{
                      fontSize:9, fontWeight:600, padding:'2px 4px', borderRadius:3,
                      background:'rgba(201,168,76,0.15)', color:'var(--gold)',
                      marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                      cursor:'pointer',
                    }}>
                      {p.headline || (p.platforms ?? []).join(', ') || 'Post'}
                    </div>
                  ))}
                </>
              )}
            </div>
          )
        })}
      </div>

      {posts.length === 0 && (
        <p style={{ textAlign:'center', fontSize:12, color:'rgba(250,246,240,0.25)', marginTop:14, marginBottom:0 }}>
          No scheduled posts yet — schedule one from the preview screen.
        </p>
      )}
    </div>
  )
}
