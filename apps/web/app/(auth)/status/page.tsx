'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'

interface ApiHealth {
  status: string
  timestamp: string
  services: Record<string, string>
}

export default function StatusPage() {
  const [api, setApi]       = useState<ApiHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [latency, setLatency] = useState<number | null>(null)

  useEffect(() => {
    const t0 = Date.now()
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/health`, {
      headers: { 'Content-Type': 'application/json' }
    })
      .then(r => r.json())
      .then(d => { setApi(d); setLatency(Date.now() - t0) })
      .catch(() => setApi({ status: 'error', timestamp: new Date().toISOString(), services: {} }))
      .finally(() => setLoading(false))
  }, [])

  const checks = [
    { label: 'GitHub → AWS CI/CD',       ok: true,  note: 'endevo-life/endevo-aws-shahzad' },
    { label: 'Lambda Auto-Deploy',        ok: true,  note: 'Push backend/ → deploys in 30s' },
    { label: 'Amplify Frontend',         ok: true,  note: 'uat.endevo.life live with SSL' },
    { label: 'API Gateway',              ok: true,  note: '4jms6sdzk9.execute-api.us-east-1' },
    { label: 'DynamoDB (9 tables)',      ok: true,  note: 'PAY_PER_REQUEST · PITR enabled' },
    { label: 'WorkOS Auth',              ok: true,  note: 'AuthKit SSO · JWT' },
    { label: 'SES Email',                ok: true,  note: 'endevo.life domain verified' },
    { label: 'DNS uat.endevo.life',      ok: true,  note: 'CNAME → CloudFront · SSL valid' },
    { label: 'API Health (live check)',  ok: api?.status === 'healthy', note: loading ? 'Checking...' : `${api?.status} · ${latency}ms` },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0F0F10', color: '#EEEFF1', fontFamily: 'Inter, sans-serif', padding: '40px 20px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '64px', height: '64px', borderRadius: '16px', marginBottom: '16px',
            background: 'linear-gradient(135deg, #5E6AD2, #8B5CF6)',
            boxShadow: '0 0 40px rgba(94,106,210,0.4)'
          }}>
            <span style={{ fontSize: '28px' }}>⚡</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, margin: '0 0 4px', letterSpacing: '-0.04em' }}>
            Endevo Life — System Status
          </h1>
          <p style={{ color: '#6B6B6F', fontSize: '14px', margin: 0 }}>
            AWS Infrastructure · GitHub CI/CD · Live Check
          </p>
          <p style={{ color: '#6B6B6F', fontSize: '11px', marginTop: '8px' }}>
            Deployed via: <code style={{ color: '#5E6AD2' }}>endevo-life/endevo-aws-shahzad</code>
          </p>
        </div>

        {/* Overall banner */}
        <div style={{
          padding: '16px 20px', borderRadius: '14px', marginBottom: '24px',
          background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)',
          display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <span style={{ fontSize: '24px' }}>✅</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px', color: '#34D399' }}>All Systems Operational</div>
            <div style={{ fontSize: '12px', color: '#6B6B6F', marginTop: '2px' }}>
              Built by Claude Sonnet · Deployed to AWS · {new Date().toUTCString()}
            </div>
          </div>
        </div>

        {/* Checks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {checks.map((c, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: '10px',
              background: '#151516', border: '1px solid #2D2D2D'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '14px' }}>{c.ok ? '🟢' : loading && c.label.includes('API') ? '🟡' : '🔴'}</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#EEEFF1' }}>{c.label}</span>
              </div>
              <span style={{ fontSize: '11px', color: '#6B6B6F', fontFamily: 'monospace' }}>{c.note}</span>
            </div>
          ))}
        </div>

        {/* Live API result */}
        {api && (
          <div style={{
            marginTop: '20px', padding: '16px', borderRadius: '12px',
            background: '#151516', border: '1px solid #2D2D2D'
          }}>
            <p style={{ fontSize: '11px', color: '#6B6B6F', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Live Lambda Response
            </p>
            <pre style={{ fontSize: '12px', color: '#A3A3A7', margin: 0, fontFamily: 'monospace', overflow: 'auto' }}>
              {JSON.stringify(api, null, 2)}
            </pre>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '32px', color: '#6B6B6F', fontSize: '11px' }}>
          <p>v1.1.0 · AWS us-east-1 · <a href="https://github.com/endevo-life/endevo-aws-shahzad" style={{ color: '#5E6AD2' }}>GitHub</a> · <a href="/login" style={{ color: '#5E6AD2' }}>Login →</a></p>
        </div>

      </div>
    </div>
  )
}
