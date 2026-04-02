'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ClipboardList, Award, User, BarChart3, LogOut, Settings,
  MapPin, Monitor, Wifi, ChevronDown, ChevronUp, Camera, Zap, BookOpen
} from 'lucide-react'
import { signOut } from '@/lib/auth/cognito'
import Cookies from 'js-cookie'
import { ThemePickerInline, useTheme } from '@/components/ThemePicker'

const navGroups = [
  {
    label: 'My Journey',
    items: [
      { href: '/employee/dashboard',      icon: BarChart3,     label: 'Dashboard' },
      { href: '/employee/lms',            icon: BookOpen,      label: 'My Modules' },
      { href: '/employee/lms/assessment', icon: ClipboardList, label: 'Readiness Assessment' },
      { href: '/employee/certificates',   icon: Award,         label: 'My Certificates' },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/employee/profile',  icon: User,     label: 'My Profile' },
      { href: '/employee/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

interface GeoInfo { ip: string; city: string; region: string; country_name: string; postal: string; latitude: number; longitude: number }
function getBrowser(ua: string) { if (ua.includes('Edg/')) return 'Edge'; if (ua.includes('Chrome/')) return 'Chrome'; if (ua.includes('Firefox/')) return 'Firefox'; return 'Browser' }
function getOS(ua: string) { if (ua.includes('Windows')) return 'Windows'; if (ua.includes('Mac OS')) return 'macOS'; if (ua.includes('iPhone')) return 'iOS'; if (ua.includes('Android')) return 'Android'; return 'Unknown' }

function SessionPanel() {
  useTheme()
  const [geo, setGeo]         = useState<GeoInfo | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [avatar, setAvatar]   = useState<string | null>(null)
  const email    = Cookies.get('user_email') || 'Employee'
  const initials = email.split('@')[0].slice(0, 2).toUpperCase()
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''

  useEffect(() => {
    const saved = localStorage.getItem('emp_avatar')
    if (saved) setAvatar(saved)
    fetch('https://ipapi.co/json/').then(r => r.json()).then(setGeo).catch(() => {})
  }, [])

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { const d = ev.target?.result as string; setAvatar(d); localStorage.setItem('emp_avatar', d) }
    reader.readAsDataURL(file)
  }

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <div className="p-3 flex items-center gap-2">
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center"
            style={{ background: 'var(--gradient-card)', border: '1px solid var(--border)' }}>
            {avatar
              ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
              : <span className="text-xs font-black text-white">{initials}</span>}
          </div>
          <label className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center cursor-pointer transition-colors"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <Camera className="w-2.5 h-2.5" style={{ color: 'var(--text-muted)' }} />
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </label>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate capitalize">{email.split('@')[0]}</p>
          <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{email}</p>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="p-1 rounded-lg transition-colors flex-shrink-0"
          style={{ color: 'var(--text-muted)' }}>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="flex items-start gap-2">
            <Wifi className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-1)' }} />
            <div><p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>IP</p><p className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>{geo?.ip || '...'}</p></div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-1)' }} />
            <div><p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Location</p><p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{geo ? `${geo.city}, ${geo.region}` : '...'}</p></div>
          </div>
          <div className="flex items-start gap-2">
            <Monitor className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-1)' }} />
            <div><p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Device</p><p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{getBrowser(ua)} · {getOS(ua)}</p></div>
          </div>
        </div>
      )}

      {/* Theme picker */}
      <div className="px-2 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider px-1 mb-1" style={{ color: 'var(--text-muted)' }}>Theme</p>
        <ThemePickerInline />
      </div>

      <div className="px-3 pb-3">
        <button onClick={signOut}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all w-full"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fb7185'; e.currentTarget.style.background = 'rgba(244,63,94,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}>
          <LogOut className="w-3.5 h-3.5" />Sign Out
        </button>
      </div>
    </div>
  )
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
      <aside className="w-64 flex-shrink-0 flex flex-col"
        style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border-subtle)' }}>
        {/* Brand */}
        <div className="p-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--gradient-brand)', boxShadow: '0 0 16px var(--accent-glow)' }}>
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Endevo Life</div>
              <div className="text-xs flex items-center gap-1" style={{ color: 'var(--accent-1)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: 'var(--success)' }} />
                Employee Portal
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-4">
          {navGroups.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-1" style={{ color: 'var(--text-muted)' }}>
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = path === item.href || path.startsWith(item.href + '/')
                  return (
                    <Link key={item.href} href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? 'nav-active' : 'nav-inactive'}`}>
                      <item.icon className="w-4 h-4" />{item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
        <SessionPanel />
      </aside>
      <main className="flex-1 overflow-auto" style={{ background: 'var(--bg-base)' }}>{children}</main>
    </div>
  )
}
