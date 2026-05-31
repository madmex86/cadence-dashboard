'use client'

import { useState, useEffect } from 'react'
import { loadSocialConnections } from '../actions'

const PLATFORM_CONFIG = {
  instagram: {
    label: 'Instagram',
    icon: '📸',
    color: '#E1306C',
    scopes: 'instagram_basic, instagram_content_publish',
    requirement: 'Requires Instagram Professional (Business or Creator) account connected to a Facebook Page.',
  },
  facebook: {
    label: 'Facebook',
    icon: '📘',
    color: '#1877F2',
    scopes: 'pages_manage_posts, pages_read_engagement',
    requirement: 'Requires a Facebook Page (not personal profile).',
  },
  pinterest: {
    label: 'Pinterest',
    icon: '📌',
    color: '#E60023',
    scopes: 'boards:read, pins:write',
    requirement: 'Requires a Pinterest Business account.',
  },
  tiktok: {
    label: 'TikTok',
    icon: '🎵',
    color: '#69C9D0',
    scopes: 'video.upload',
    requirement: 'TikTok direct posting requires app review approval. Coming soon.',
  },
}

export default function SocialSettings() {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)

  const statusParam = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('connected')
    : null

  useEffect(() => {
    loadSocialConnections().then(r => {
      if (r.connections) setConnections(r.connections)
      setLoading(false)
    })
  }, [])

  const getConnection = (platform) =>
    connections.find(c => c.platform === platform && c.is_active)

  const handleConnectMeta = () => {
    const state = btoa(JSON.stringify({
      slug: 'cadence-creatures',
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    }))
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_META_APP_ID ?? '',
      redirect_uri: `${window.location.origin}/api/auth/social/meta/callback`,
      scope: 'instagram_basic,instagram_content_publish,pages_manage_posts,pages_read_engagement',
      response_type: 'code',
      state,
    })
    window.location.href = `https://www.facebook.com/v19.0/dialog/oauth?${params}`
  }

  const handleConnectPinterest = () => {
    const state = btoa(JSON.stringify({
      slug: 'cadence-creatures',
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    }))
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_PINTEREST_APP_ID ?? '',
      redirect_uri: `${window.location.origin}/api/auth/social/pinterest/callback`,
      scope: 'boards:read,pins:write',
      response_type: 'code',
      state,
    })
    window.location.href = `https://www.pinterest.com/oauth/?${params}`
  }

  const connectHandlers = {
    instagram: handleConnectMeta,
    facebook: handleConnectMeta,
    pinterest: handleConnectPinterest,
  }

  return (
    <div style={{ maxWidth:680, padding:'0 0 48px' }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:'var(--font-caveat,cursive)', fontSize:'2rem', color:'var(--gold)', margin:'0 0 6px' }}>
          Social Accounts
        </h1>
        <p style={{ color:'rgba(250,246,240,0.45)', fontSize:13, margin:0 }}>
          Connect your accounts once. Asset Studio posts directly without leaving the dashboard.
        </p>
      </div>

      {statusParam === 'meta' && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 14px', borderRadius:8, background:'rgba(125,201,148,0.08)', border:'1px solid rgba(125,201,148,0.2)', marginBottom:20, fontSize:13 }}>
          ✓ Instagram and Facebook connected successfully.
        </div>
      )}

      {statusParam === 'pinterest' && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 14px', borderRadius:8, background:'rgba(125,201,148,0.08)', border:'1px solid rgba(125,201,148,0.2)', marginBottom:20, fontSize:13 }}>
          ✓ Pinterest connected successfully.
        </div>
      )}

      {loading ? (
        <div style={{ color:'rgba(250,246,240,0.3)', fontSize:13, padding:'24px 0' }}>Loading…</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {Object.entries(PLATFORM_CONFIG).map(([platform, config]) => {
            const connection = getConnection(platform)
            const isConnected = !!connection
            const connectFn = connectHandlers[platform]
            const isComingSoon = platform === 'tiktok'

            return (
              <div key={platform} style={{
                background:'rgba(255,255,255,0.02)',
                border:`1px solid ${isConnected ? `${config.color}30` : 'rgba(201,168,76,0.12)'}`,
                borderRadius:10,
                padding:'18px 20px',
              }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:14, flex:1 }}>
                    <div style={{ width:40, height:40, borderRadius:8, background:`${config.color}18`, border:`1px solid ${config.color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                      {config.icon}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <span style={{ fontWeight:600, fontSize:14 }}>{config.label}</span>
                        {isConnected && (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, letterSpacing:'.05em', textTransform:'uppercase', color:'#7dc994', background:'rgba(125,201,148,0.1)', padding:'2px 7px', borderRadius:99 }}>
                            ✓ Connected
                          </span>
                        )}
                        {isComingSoon && (
                          <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.05em', textTransform:'uppercase', color:'rgba(250,246,240,0.3)', background:'rgba(255,255,255,0.05)', padding:'2px 7px', borderRadius:99 }}>
                            Soon
                          </span>
                        )}
                      </div>
                      {isConnected && connection.platform_username && (
                        <p style={{ margin:'0 0 4px', fontSize:12, color:'rgba(250,246,240,0.5)' }}>
                          @{connection.platform_username}{connection.page_name ? ` · ${connection.page_name}` : ''}
                        </p>
                      )}
                      <p style={{ margin:0, fontSize:12, color:'rgba(250,246,240,0.35)', lineHeight:1.5 }}>
                        {config.requirement}
                      </p>
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    {isConnected ? (
                      <button onClick={connectFn} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 10px', borderRadius:6, background:'transparent', color:'rgba(250,246,240,0.4)', border:'1px solid rgba(201,168,76,0.12)', cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>
                        ↺ Refresh
                      </button>
                    ) : (
                      <button
                        onClick={connectFn}
                        disabled={isComingSoon || !connectFn}
                        style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:6, background: isComingSoon ? 'transparent' : config.color, color: isComingSoon ? 'rgba(250,246,240,0.3)' : '#fff', border: isComingSoon ? '1px solid rgba(255,255,255,0.08)' : 'none', cursor: isComingSoon ? 'not-allowed' : 'pointer', fontWeight:600, fontSize:13, opacity: isComingSoon ? .5 : 1, fontFamily:'inherit' }}
                      >
                        ↗ Connect
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop:24, padding:'14px 16px', borderRadius:8, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(201,168,76,0.08)' }}>
        <p style={{ margin:'0 0 5px', fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'rgba(250,246,240,0.3)' }}>About Access Tokens</p>
        <p style={{ margin:0, fontSize:12, color:'rgba(250,246,240,0.4)', lineHeight:1.6 }}>
          Tokens are stored encrypted in your private Supabase database. Meta tokens last 60 days and refresh automatically. You'll be notified when a token expires.
        </p>
      </div>

      <div style={{ marginTop:16 }}>
        <a href="/asset-studio" style={{ fontSize:13, color:'rgba(250,246,240,0.4)' }}>← Back to Asset Studio</a>
      </div>
    </div>
  )
}
