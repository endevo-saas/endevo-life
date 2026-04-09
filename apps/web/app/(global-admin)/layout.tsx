'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Shield, Building2, Users, FileText, Activity, LogOut,
  BarChart3, Settings, CreditCard, Globe, Monitor, MapPin,
  Wifi, ChevronDown, ChevronUp, Camera, Award, BookOpen,
  ClipboardList, TrendingUp, DollarSign, Flag, Cpu, ArrowUpDown, Archive,
  Brain
} from 'lucide-react'
import { signOut } from '@/lib/auth/cognito'
import Cookies from 'js-cookie'
import { ThemePickerInline, useTheme } from '@/components/ThemePicker'
import { JesseAIWidget } from '@/components/jesse'

const navGroups = [
  {
    label: 'Platform',
    items: [
      { href: '/admin/dashboard',     icon: BarChart3,      label: 'Dashboard' },
      { href: '/admin/tenants',       icon: Building2,      label: 'Tenants' },
      { href: '/admin/users',         icon: Users,          label: 'All Users' },
      { href: '/admin/subscriptions', icon: CreditCard,     label: 'Subscriptions' },
      { href: '/admin/certificates',  icon: Award,          label: 'Certificates' },
      { href: '/admin/audit',         icon: FileText,       label: 'Audit Log' },
      { href: '/admin/archive',       icon: Archive,        label: 'Recycle Bin' },
    ]
  },
  {
    label: 'LMS',
    items: [
      { href: '/admin/lms/modules',   icon: BookOpen,       label: 'Modules' },
      { href: '/admin/lms/questions', icon: ClipboardList,  label: 'Questions' },
      { href: '/admin/lms/progress',  icon: TrendingUp,     label: 'User Progress' },
      { href: '/admin/knowledge',     icon: Brain,          label: 'Knowledge Base' },
    ]
  },
  {
    label: 'Configuration',
    items: [
      { href: '/admin/plan-config',   icon: DollarSign,     label: 'Plan & Pricing' },
      { href: '/admin/features',      icon: Flag,           label: 'Feature Flags' },
      { href: '/admin/import-export', icon: ArrowUpDown,    label: 'Import / Export' },
    ]
  },
  {
    label: 'System',
    items: [
      { href: '/admin/system',        icon: Cpu,            label: 'System Status' },
      { href: '/admin/health',        icon: Activity,       label: 'System Health' },
      { href: '/admin/settings',      icon: Settings,       label: 'Settings' },
    ]
  },
]

interface GeoInfo {
  ip: string
  city: string
  region: string
  country_name: string
  postal: string
  org: string
  latitude: number
  longitude: number
}

function getBrowser(ua: string): string {
  if (ua.includes('Edg/'))    return 'Microsoft Edge'
  if (ua.includes('Chrome/')) return 'Chrome'
  if (ua.includes('Firefox/'))return 'Firefox'
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari'
  return 'Browser'
}

function getOS(ua: string): string {
  if (ua.includes('Windows NT 10'))  return 'Windows 11/10'
  if (ua.includes('Windows NT 6.3')) return 'Windows 8.1'
  if (ua.includes('Mac OS X'))       return 'macOS'
  if (ua.includes('iPhone'))         return 'iOS'
  if (ua.includes('Android'))        return 'Android'
  if (ua.includes('Linux'))          return 'Linux'
  return 'Unknown OS'
}

function SessionPanel() {
  useTheme()
  const [geo, setGeo] = useState<GeoInfo | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(null)
  const email = Cookies.get('user_email') || 'Admin'
  const initials = email.split('@')[0].slice(0, 2).toUpperCase()
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const browser = getBrowser(ua)
  const os = getOS(ua)

  useEffect(() => {
    // Load saved avatar
    const saved = localStorage.getItem('admin_avatar')
    if (saved) setAvatar(saved)

    // Fetch geo/IP info
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => setGeo(d))
      .catch(() => {})
  }, [])

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string
      setAvatar(dataUrl)
      localStorage.setItem('admin_avatar', dataUrl)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="border-t border-white/10">
      {/* Avatar + name row */}
      <div className="p-3 flex items-center gap-2">
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-brand-600/30 border border-brand-500/30 flex items-center justify-center">
            {avatar ? (
              <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-black text-brand-300">{initials}</span>
            )}
          </div>
          <label className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-slate-700 border border-white/20 rounded-full flex items-center justify-center cursor-pointer hover:bg-brand-600/50 transition-colors">
            <Camera className="w-2.5 h-2.5 text-slate-300" />
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </label>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate capitalize">{email.split('@')[0]}</p>
          <p className="text-[10px] text-slate-500 truncate">{email}</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0"
          title="Session Info"
        >
          {expanded ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
        </button>
      </div>

      {/* Expanded session details */}
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-white/5 pt-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Session Context</p>

          <div className="flex items-start gap-2">
            <Wifi className="w-3 h-3 text-brand-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500">IP Address</p>
              <p className="text-[11px] font-mono text-slate-300">{geo?.ip || '...'}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500">Location</p>
              <p className="text-[11px] text-slate-300">
                {geo ? `${geo.city}, ${geo.region} ${geo.postal}` : '...'}
              </p>
              <p className="text-[11px] text-slate-400">{geo?.country_name || ''}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Globe className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500">Network</p>
              <p className="text-[11px] text-slate-300 truncate" style={{maxWidth:'150px'}}>{geo?.org || '...'}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Monitor className="w-3 h-3 text-purple-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500">Device</p>
              <p className="text-[11px] text-slate-300">{browser}</p>
              <p className="text-[11px] text-slate-400">{os}</p>
            </div>
          </div>

          {geo?.latitude && (
            <div className="mt-1 pt-1 border-t border-white/5">
              <p className="text-[10px] text-slate-600 font-mono">
                {geo.latitude.toFixed(4)}, {geo.longitude.toFixed(4)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Theme picker */}
      <div className="px-2 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider px-1 mb-1" style={{ color: 'var(--text-muted)' }}>Theme</p>
        <ThemePickerInline />
      </div>

      {/* Sign out */}
      <div className="px-3 pb-3">
        <button
          onClick={signOut}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all w-full"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fb7185'; e.currentTarget.style.background = 'rgba(244,63,94,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col"
        style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border-subtle)' }}>
        {/* Brand */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src="/jesse/logo.png" alt="ENDevo" className="w-9 h-9 rounded-xl object-contain" />
            <div>
              <div className="text-sm font-semibold text-white">Legacy Readiness OS</div>
              <div className="text-[10px] font-bold tracking-widest text-orange-400">PLAN. PROTECT. PEACE.</div>
              <div className="text-[9px] text-emerald-400 flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
                Global Admin
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {navGroups.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-1 text-slate-500">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = path === item.href || path.startsWith(item.href + '/')
                  return (
                    <Link key={item.href} href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? 'nav-active' : 'nav-inactive'}`}>
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Session + Avatar panel */}
        <SessionPanel />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto" style={{ background: 'var(--bg-base)' }}>
        {children}
        <JesseAIWidget />
        <footer className="px-6 py-4 text-center border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Legacy Readiness OS — Powered by <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Endevo.life</span>
          </p>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
            &copy; {new Date().getFullYear()} Endevo Life Inc. All rights reserved. US Data Residency.
          </p>
        </footer>
      </main>
    </div>
  )
}
