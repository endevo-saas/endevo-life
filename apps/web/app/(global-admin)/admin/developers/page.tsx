'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Key, Webhook as WebhookIcon, Zap, BookOpen, Loader2, AlertCircle, RefreshCw,
  CheckCircle, Copy, Trash2, Plus, Eye, EyeOff, Send, Shield,
  Globe, Lock, ChevronRight, ExternalLink, AlertTriangle
} from 'lucide-react'
import { api, Tenant, Webhook as WebhookType, ApiKey } from '@/lib/api'

/* ─────────────────────── Constants ─────────────────────── */

const TABS = [
  { id: 'keys', label: 'API Keys', icon: Key },
  { id: 'webhooks', label: 'Webhooks', icon: WebhookIcon },
  { id: 'events', label: 'Events', icon: Zap },
  { id: 'docs', label: 'API Docs', icon: BookOpen },
] as const

type TabId = (typeof TABS)[number]['id']

const EVENT_TYPES = [
  'endevo.user.created',
  'endevo.user.activated',
  'endevo.module.completed',
  'endevo.assessment.completed',
  'endevo.certificate.issued',
  'endevo.subscription.changed',
  'endevo.subscription.cancelled',
  'endevo.tenant.created',
] as const

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

const API_ENDPOINTS = [
  { method: 'GET',    path: '/api/admin/tenants',            description: 'List all tenants' },
  { method: 'GET',    path: '/api/admin/tenants/:tenantId',  description: 'Get tenant details' },
  { method: 'POST',   path: '/api/admin/tenants',            description: 'Create a new tenant' },
  { method: 'PUT',    path: '/api/admin/tenants/:tenantId',  description: 'Update tenant settings' },
  { method: 'GET',    path: '/api/admin/users',              description: 'List all users (paginated)' },
  { method: 'POST',   path: '/api/admin/users/:userId/lock', description: 'Lock a user account' },
  { method: 'GET',    path: '/api/admin/dashboard',          description: 'Global admin dashboard metrics' },
  { method: 'GET',    path: '/api/admin/audit',              description: 'Fetch audit log entries' },
  { method: 'GET',    path: '/api/admin/features',           description: 'Get feature flags' },
  { method: 'PUT',    path: '/api/admin/features',           description: 'Update feature flags' },
  { method: 'GET',    path: '/api/admin/webhooks/:tenantId', description: 'Get webhooks and API keys for tenant' },
  { method: 'POST',   path: '/api/admin/webhooks/:tenantId', description: 'Register a webhook for tenant' },
  { method: 'POST',   path: '/api/admin/webhooks/:tenantId/apikey', description: 'Generate a new API key' },
  { method: 'POST',   path: '/api/admin/events/emit',        description: 'Emit a test event to EventBridge' },
  { method: 'GET',    path: '/api/admin/events/types',       description: 'List available event types' },
  { method: 'GET',    path: '/api/admin/system/status',      description: 'System health check' },
  { method: 'GET',    path: '/api/hr/employees',             description: 'List employees for HR tenant' },
  { method: 'POST',   path: '/api/hr/employees/invite',      description: 'Invite an employee' },
  { method: 'GET',    path: '/api/employee/profile',         description: 'Get current employee profile' },
  { method: 'GET',    path: '/api/lms/modules',              description: 'List LMS modules' },
  { method: 'GET',    path: '/api/lms/progress',             description: 'Get LMS progress for user' },
] as const

const METHOD_COLORS: Record<string, string> = {
  GET:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  POST:   'bg-blue-500/15 text-blue-400 border-blue-500/20',
  PUT:    'bg-amber-500/15 text-amber-400 border-amber-500/20',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/20',
}

/* ─────────────────────── Helpers ─────────────────────── */

function formatDate(iso: string): string {
  if (!iso) return '--'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text)
}

/* ─────────────────────── Component ─────────────────────── */

export default function DeveloperPortalPage() {
  const [activeTab, setActiveTab] = useState<TabId>('keys')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [selectedTenant, setSelectedTenant] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [keysLoading, setKeysLoading] = useState(false)
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [generatingKey, setGeneratingKey] = useState(false)
  const [revealedKey, setRevealedKey] = useState<{ keyId: string; fullKey: string } | null>(null)

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookType[]>([])
  const [webhooksLoading, setWebhooksLoading] = useState(false)
  const [showAddWebhook, setShowAddWebhook] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookEvents, setWebhookEvents] = useState<string[]>([])
  const [creatingWebhook, setCreatingWebhook] = useState(false)

  // Events state
  const [selectedEvent, setSelectedEvent] = useState(EVENT_TYPES[0])
  const [emitting, setEmitting] = useState(false)

  // Docs state
  const [copiedBase, setCopiedBase] = useState(false)

  /* ── Load tenants ── */
  const loadTenants = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.adminTenants()
      const sorted = [...(res.tenants || [])].sort((a, b) => a.name.localeCompare(b.name))
      setTenants(sorted)
      if (sorted.length > 0 && !selectedTenant) {
        setSelectedTenant(sorted[0].tenantId)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tenants')
    } finally { setLoading(false) }
  }, [selectedTenant])

  useEffect(() => { loadTenants() }, [loadTenants])

  /* ── Load webhooks + keys for selected tenant ── */
  const loadTenantData = useCallback(async () => {
    if (!selectedTenant) return
    setKeysLoading(true); setWebhooksLoading(true); setError('')
    try {
      const res = await api.adminGetWebhooks(selectedTenant)
      setApiKeys(res.api_keys || [])
      setWebhooks(res.webhooks || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load developer data')
    } finally {
      setKeysLoading(false)
      setWebhooksLoading(false)
    }
  }, [selectedTenant])

  useEffect(() => { loadTenantData() }, [loadTenantData])

  function showSuccess(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 5000)
  }

  /* ── Generate API Key ── */
  async function handleGenerateKey() {
    if (!newKeyLabel.trim()) { setError('Key label is required'); return }
    setGeneratingKey(true); setError('')
    try {
      const res = await api.adminGenerateApiKey(selectedTenant, newKeyLabel.trim())
      setRevealedKey({ keyId: res.keyId, fullKey: res.api_key })
      setNewKeyLabel('')
      await loadTenantData()
      showSuccess('API key generated successfully')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate key')
    } finally { setGeneratingKey(false) }
  }

  /* ── Create Webhook ── */
  async function handleCreateWebhook() {
    if (!webhookUrl.trim()) { setError('Webhook URL is required'); return }
    if (!webhookUrl.startsWith('https://')) { setError('Webhook URL must use HTTPS'); return }
    if (webhookEvents.length === 0) { setError('Select at least one event type'); return }
    setCreatingWebhook(true); setError('')
    try {
      await api.adminCreateWebhook(selectedTenant, webhookUrl.trim(), webhookEvents)
      setWebhookUrl('')
      setWebhookEvents([])
      setShowAddWebhook(false)
      await loadTenantData()
      showSuccess('Webhook registered successfully')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create webhook')
    } finally { setCreatingWebhook(false) }
  }

  /* ── Toggle webhook event checkbox ── */
  function toggleEvent(evt: string) {
    setWebhookEvents(prev =>
      prev.includes(evt) ? prev.filter(e => e !== evt) : [...prev, evt]
    )
  }

  /* ── Emit test event ── */
  async function handleEmitEvent() {
    setEmitting(true); setError('')
    try {
      await api.adminEmitEvent(selectedEvent, {
        source: 'developer-portal',
        tenantId: selectedTenant,
        timestamp: new Date().toISOString(),
      })
      showSuccess(`Test event "${selectedEvent}" emitted successfully`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to emit event')
    } finally { setEmitting(false) }
  }

  /* ── Copy base URL ── */
  function handleCopyBase() {
    copyToClipboard(API_BASE_URL)
    setCopiedBase(true)
    setTimeout(() => setCopiedBase(false), 2000)
  }

  const tenantLabel = tenants.find(t => t.tenantId === selectedTenant)?.name || selectedTenant

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ color: 'var(--text-primary)' }} className="text-2xl font-bold">
              Developer Portal
            </h1>
            <p style={{ color: 'var(--text-muted)' }} className="text-sm mt-0.5">
              API keys, webhooks, events, and documentation
            </p>
          </div>
          <button
            onClick={() => { loadTenants(); loadTenantData() }}
            disabled={loading}
            style={{ color: 'var(--text-secondary)' }}
            className="p-2 hover:opacity-80 rounded-lg transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* ── Alerts ── */}
        {success && (
          <div
            className="mb-4 p-3 rounded-xl text-sm flex items-center gap-2"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--success) 10%, transparent)',
              borderWidth: 1, borderStyle: 'solid',
              borderColor: 'color-mix(in srgb, var(--success) 30%, transparent)',
              color: 'var(--success)',
            }}
          >
            <CheckCircle className="w-4 h-4 flex-shrink-0" />{success}
          </div>
        )}
        {error && (
          <div
            className="mb-4 p-3 rounded-xl text-sm flex items-center gap-2"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--danger) 10%, transparent)',
              borderWidth: 1, borderStyle: 'solid',
              borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)',
              color: 'var(--danger)',
            }}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        {/* ── Tenant Selector ── */}
        <div
          className="mb-6 p-4 rounded-xl"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <label className="flex items-center gap-3">
            <Globe className="w-4 h-4" style={{ color: 'var(--accent-1)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Tenant
            </span>
            <select
              value={selectedTenant}
              onChange={e => setSelectedTenant(e.target.value)}
              className="flex-1 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                focusRingColor: 'var(--accent-1)',
              }}
            >
              {tenants.map(t => (
                <option key={t.tenantId} value={t.tenantId}>
                  {t.name} ({t.tenantId})
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* ── Tabs ── */}
        <div
          className="flex gap-1 mb-6 p-1 rounded-xl"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center"
                style={{
                  backgroundColor: isActive ? 'var(--bg-elevated)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                }}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {loading && tenants.length === 0 ? (
          <div
            className="p-16 flex justify-center rounded-xl"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent-1)' }} />
          </div>
        ) : (
          <>
            {/* ═══════════════ TAB: API Keys ═══════════════ */}
            {activeTab === 'keys' && (
              <div className="space-y-4">
                {/* Generate new key */}
                <div
                  className="p-5 rounded-xl"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Key className="w-4 h-4" style={{ color: 'var(--accent-1)' }} />
                    Generate New API Key
                  </h2>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newKeyLabel}
                      onChange={e => setNewKeyLabel(e.target.value)}
                      placeholder="Key label (e.g., production-v2)"
                      className="flex-1 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') handleGenerateKey() }}
                    />
                    <button
                      onClick={handleGenerateKey}
                      disabled={generatingKey || !newKeyLabel.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                      style={{
                        backgroundColor: 'var(--accent-1)',
                        color: '#fff',
                      }}
                    >
                      {generatingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Generate Key
                    </button>
                  </div>
                </div>

                {/* Revealed key warning */}
                {revealedKey && (
                  <div
                    className="p-4 rounded-xl"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--gold) 8%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--gold)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--gold)' }}>
                          Save this key now. It will not be shown again.
                        </p>
                        <div
                          className="flex items-center gap-2 p-2 rounded-lg font-mono text-xs break-all"
                          style={{
                            backgroundColor: 'var(--bg-base)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <span className="flex-1">{revealedKey.fullKey}</span>
                          <button
                            onClick={() => { copyToClipboard(revealedKey.fullKey); showSuccess('Key copied to clipboard') }}
                            className="flex-shrink-0 p-1.5 rounded hover:opacity-80 transition-all"
                            style={{ color: 'var(--accent-1)' }}
                            title="Copy to clipboard"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => setRevealedKey(null)}
                          className="mt-2 text-xs hover:underline"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Existing keys */}
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      Active Keys
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-normal"
                        style={{
                          backgroundColor: 'var(--bg-elevated)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {tenantLabel}
                      </span>
                    </h2>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {apiKeys.length} key{apiKeys.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {keysLoading ? (
                    <div className="p-12 flex justify-center">
                      <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent-1)' }} />
                    </div>
                  ) : apiKeys.length === 0 ? (
                    <div className="p-12 text-center">
                      <Key className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        No API keys for this tenant
                      </p>
                    </div>
                  ) : (
                    <div style={{ borderTop: '0' }}>
                      {apiKeys.map((k, idx) => (
                        <div
                          key={k.keyId}
                          className="flex items-center justify-between px-5 py-4 transition-colors"
                          style={{
                            borderTop: idx > 0 ? '1px solid var(--border-subtle)' : 'none',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                {k.label}
                              </span>
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full"
                                style={{
                                  backgroundColor: k.active
                                    ? 'color-mix(in srgb, var(--success) 15%, transparent)'
                                    : 'color-mix(in srgb, var(--danger) 15%, transparent)',
                                  color: k.active ? 'var(--success)' : 'var(--danger)',
                                  border: `1px solid ${k.active
                                    ? 'color-mix(in srgb, var(--success) 25%, transparent)'
                                    : 'color-mix(in srgb, var(--danger) 25%, transparent)'}`,
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: k.active ? 'var(--success)' : 'var(--danger)' }}
                                />
                                {k.active ? 'Active' : 'Revoked'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <code
                                className="text-xs font-mono px-2 py-0.5 rounded"
                                style={{
                                  backgroundColor: 'var(--bg-elevated)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {k.keyPrefix}...
                              </code>
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                Created {formatDate(k.createdAt)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => { copyToClipboard(k.keyPrefix); showSuccess('Key prefix copied') }}
                              className="p-2 rounded-lg hover:opacity-80 transition-all"
                              style={{ color: 'var(--text-muted)' }}
                              title="Copy key prefix"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══════════════ TAB: Webhooks ═══════════════ */}
            {activeTab === 'webhooks' && (
              <div className="space-y-4">
                {/* Add Webhook form */}
                {showAddWebhook ? (
                  <div
                    className="p-5 rounded-xl space-y-4"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Plus className="w-4 h-4" style={{ color: 'var(--accent-1)' }} />
                        Register Webhook
                      </h2>
                      <button
                        onClick={() => { setShowAddWebhook(false); setWebhookUrl(''); setWebhookEvents([]) }}
                        className="text-xs hover:underline"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Cancel
                      </button>
                    </div>

                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                        Endpoint URL (HTTPS required)
                      </label>
                      <input
                        type="url"
                        value={webhookUrl}
                        onChange={e => setWebhookUrl(e.target.value)}
                        placeholder="https://your-app.com/webhooks/endevo"
                        className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
                        style={{
                          backgroundColor: 'var(--bg-elevated)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                        Event Types
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {EVENT_TYPES.map(evt => (
                          <label
                            key={evt}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all"
                            style={{
                              backgroundColor: webhookEvents.includes(evt) ? 'var(--bg-elevated)' : 'transparent',
                              border: `1px solid ${webhookEvents.includes(evt) ? 'var(--accent-1)' : 'var(--border-subtle)'}`,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={webhookEvents.includes(evt)}
                              onChange={() => toggleEvent(evt)}
                              className="rounded"
                              style={{ accentColor: 'var(--accent-1)' }}
                            />
                            <code className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                              {evt}
                            </code>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        onClick={() => setWebhookEvents([...EVENT_TYPES])}
                        className="text-xs px-3 py-1.5 rounded-lg transition-all"
                        style={{ color: 'var(--accent-2)', border: '1px solid var(--border)' }}
                      >
                        Select All
                      </button>
                      <button
                        onClick={handleCreateWebhook}
                        disabled={creatingWebhook || !webhookUrl.trim() || webhookEvents.length === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                        style={{ backgroundColor: 'var(--accent-1)', color: '#fff' }}
                      >
                        {creatingWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : <WebhookIcon className="w-4 h-4" />}
                        Register Webhook
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddWebhook(true)}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px dashed var(--border)',
                      color: 'var(--accent-1)',
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Add Webhook
                  </button>
                )}

                {/* Existing webhooks */}
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      Configured Webhooks
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-normal"
                        style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                      >
                        {tenantLabel}
                      </span>
                    </h2>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {webhooksLoading ? (
                    <div className="p-12 flex justify-center">
                      <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent-1)' }} />
                    </div>
                  ) : webhooks.length === 0 ? (
                    <div className="p-12 text-center">
                      <WebhookIcon className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        No webhooks configured for this tenant
                      </p>
                    </div>
                  ) : (
                    <div>
                      {webhooks.map((wh, idx) => (
                        <div
                          key={wh.webhookId}
                          className="px-5 py-4 transition-colors"
                          style={{
                            borderTop: idx > 0 ? '1px solid var(--border-subtle)' : 'none',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent-2)' }} />
                              <code
                                className="text-sm font-mono truncate"
                                style={{ color: 'var(--text-primary)' }}
                                title={wh.url}
                              >
                                {wh.url}
                              </code>
                            </div>
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full flex-shrink-0 ml-3"
                              style={{
                                backgroundColor: wh.active
                                  ? 'color-mix(in srgb, var(--success) 15%, transparent)'
                                  : 'color-mix(in srgb, var(--danger) 15%, transparent)',
                                color: wh.active ? 'var(--success)' : 'var(--danger)',
                                border: `1px solid ${wh.active
                                  ? 'color-mix(in srgb, var(--success) 25%, transparent)'
                                  : 'color-mix(in srgb, var(--danger) 25%, transparent)'}`,
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: wh.active ? 'var(--success)' : 'var(--danger)' }}
                              />
                              {wh.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {wh.events.map(evt => (
                              <span
                                key={evt}
                                className="text-[10px] font-mono px-2 py-0.5 rounded"
                                style={{
                                  backgroundColor: 'var(--bg-elevated)',
                                  color: 'var(--text-muted)',
                                  border: '1px solid var(--border-subtle)',
                                }}
                              >
                                {evt}
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
                            Created {formatDate(wh.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══════════════ TAB: Events ═══════════════ */}
            {activeTab === 'events' && (
              <div className="space-y-4">
                <div
                  className="p-5 rounded-xl"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Zap className="w-4 h-4" style={{ color: 'var(--accent-1)' }} />
                    Emit Test Event
                  </h2>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                    Send a test event to EventBridge. Configured webhooks for the selected tenant will receive the payload.
                  </p>

                  <div className="flex gap-3">
                    <select
                      value={selectedEvent}
                      onChange={e => setSelectedEvent(e.target.value)}
                      className="flex-1 text-sm font-mono rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {EVENT_TYPES.map(evt => (
                        <option key={evt} value={evt}>{evt}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleEmitEvent}
                      disabled={emitting}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                      style={{ backgroundColor: 'var(--accent-1)', color: '#fff' }}
                    >
                      {emitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send Event
                    </button>
                  </div>
                </div>

                {/* Event types reference */}
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <Zap className="w-4 h-4" style={{ color: 'var(--accent-2)' }} />
                      Available Event Types
                    </h2>
                  </div>
                  <div>
                    {EVENT_TYPES.map((evt, idx) => (
                      <div
                        key={evt}
                        className="flex items-center gap-3 px-5 py-3"
                        style={{
                          borderTop: idx > 0 ? '1px solid var(--border-subtle)' : 'none',
                        }}
                      >
                        <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--accent-1)' }} />
                        <code className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>
                          {evt}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payload example */}
                <div
                  className="p-5 rounded-xl"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <BookOpen className="w-4 h-4" style={{ color: 'var(--accent-2)' }} />
                    Example Webhook Payload
                  </h2>
                  <pre
                    className="text-xs font-mono p-4 rounded-lg overflow-x-auto leading-relaxed"
                    style={{
                      backgroundColor: 'var(--bg-base)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
{`{
  "version": "1.0",
  "source": "endevo.life",
  "type": "endevo.user.created",
  "timestamp": "2026-04-09T12:00:00.000Z",
  "tenantId": "tenant_abc123",
  "data": {
    "userId": "usr_xyz789",
    "email": "jane@company.com",
    "role": "employee"
  }
}`}
                  </pre>
                </div>
              </div>
            )}

            {/* ═══════════════ TAB: API Docs ═══════════════ */}
            {activeTab === 'docs' && (
              <div className="space-y-4">
                {/* Base URL + Auth */}
                <div
                  className="p-5 rounded-xl"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Globe className="w-4 h-4" style={{ color: 'var(--accent-1)' }} />
                    Base URL
                  </h2>
                  <div
                    className="flex items-center gap-2 p-3 rounded-lg font-mono text-sm"
                    style={{
                      backgroundColor: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span className="flex-1 truncate">{API_BASE_URL}</span>
                    <button
                      onClick={handleCopyBase}
                      className="flex-shrink-0 p-1.5 rounded hover:opacity-80 transition-all"
                      style={{ color: copiedBase ? 'var(--success)' : 'var(--accent-1)' }}
                      title="Copy base URL"
                    >
                      {copiedBase ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Authentication */}
                <div
                  className="p-5 rounded-xl"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Lock className="w-4 h-4" style={{ color: 'var(--accent-1)' }} />
                    Authentication
                  </h2>
                  <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <p>
                      All API requests require a Bearer token in the <code
                        className="px-1.5 py-0.5 rounded text-xs font-mono"
                        style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--accent-2)' }}
                      >Authorization</code> header.
                    </p>
                    <pre
                      className="text-xs font-mono p-3 rounded-lg overflow-x-auto"
                      style={{
                        backgroundColor: 'var(--bg-base)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
{`Authorization: Bearer <access_token>
Content-Type: application/json`}
                    </pre>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Tokens are issued by Cognito after authentication. For API key access, include the key as a Bearer token.
                    </p>
                  </div>
                </div>

                {/* Rate limits */}
                <div
                  className="p-5 rounded-xl"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Shield className="w-4 h-4" style={{ color: 'var(--accent-1)' }} />
                    Rate Limits
                  </h2>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Requests/second', value: '10', desc: 'Per API key' },
                      { label: 'Burst limit', value: '50', desc: 'Short burst allowance' },
                      { label: 'Daily quota', value: '10,000', desc: 'Per tenant' },
                    ].map(item => (
                      <div
                        key={item.label}
                        className="p-3 rounded-lg text-center"
                        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                      >
                        <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{item.label}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Endpoints table */}
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <BookOpen className="w-4 h-4" style={{ color: 'var(--accent-1)' }} />
                      API Endpoints
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <th className="text-left text-[10px] font-semibold uppercase tracking-wider px-5 py-2.5" style={{ color: 'var(--text-muted)' }}>
                            Method
                          </th>
                          <th className="text-left text-[10px] font-semibold uppercase tracking-wider px-5 py-2.5" style={{ color: 'var(--text-muted)' }}>
                            Endpoint
                          </th>
                          <th className="text-left text-[10px] font-semibold uppercase tracking-wider px-5 py-2.5" style={{ color: 'var(--text-muted)' }}>
                            Description
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {API_ENDPOINTS.map((ep, idx) => (
                          <tr
                            key={`${ep.method}-${ep.path}`}
                            className="transition-colors"
                            style={{
                              borderTop: idx > 0 ? '1px solid var(--border-subtle)' : 'none',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <td className="px-5 py-2.5">
                              <span
                                className="inline-block text-[10px] font-bold px-2 py-0.5 rounded border"
                                style={{
                                  ...(METHOD_COLORS[ep.method]
                                    ? {}
                                    : {}),
                                }}
                              >
                                <span className={METHOD_COLORS[ep.method] || 'bg-slate-500/15 text-slate-400 border-slate-500/20'}
                                  style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}
                                >
                                  {ep.method}
                                </span>
                              </span>
                            </td>
                            <td className="px-5 py-2.5">
                              <code className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                                {ep.path}
                              </code>
                            </td>
                            <td className="px-5 py-2.5">
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {ep.description}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Error codes */}
                <div
                  className="p-5 rounded-xl"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <AlertCircle className="w-4 h-4" style={{ color: 'var(--accent-1)' }} />
                    Error Response Format
                  </h2>
                  <pre
                    className="text-xs font-mono p-4 rounded-lg overflow-x-auto leading-relaxed"
                    style={{
                      backgroundColor: 'var(--bg-base)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
{`{
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "statusCode": 401
}`}
                  </pre>
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { code: '400', label: 'Bad Request', color: 'var(--gold)' },
                      { code: '401', label: 'Unauthorized', color: 'var(--danger)' },
                      { code: '403', label: 'Forbidden', color: 'var(--danger)' },
                      { code: '404', label: 'Not Found', color: 'var(--text-muted)' },
                      { code: '429', label: 'Rate Limited', color: 'var(--gold)' },
                      { code: '500', label: 'Server Error', color: 'var(--danger)' },
                    ].map(item => (
                      <div
                        key={item.code}
                        className="flex items-center gap-2 p-2 rounded-lg"
                        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                      >
                        <span className="text-sm font-bold font-mono" style={{ color: item.color }}>
                          {item.code}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
