'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  PlayCircle, ClipboardList, Award, User, BarChart3, LogOut, Settings,
  MapPin, Monitor, Wifi, ChevronDown, ChevronUp, Camera
} from 'lucide-react'
import { signOut } from '@/lib/auth/cognito'
import Cookies from 'js-cookie'

const nav = [
  { href: '/employee/dashboard',    icon: BarChart3,     label: 'Dashboard' },
  { href: '/employee/training',     icon: PlayCircle,    label: 'Training' },
  { href: '/employee/assessment',   icon: ClipboardList, label: 'Assessment' },
  { href: '/employee/certificates', icon: Award,         label: 'Certificates' },
  { href: '/employee/profile',      icon: User,          label: 'My Profile' },
  { href: '/employee/settings',     icon: Settings,      label: 'Settings' },
]

interface GeoInfo { ip: string; city: string; region: string; country_name: string; postal: string; latitude: number; longitude: number }
function getBrowser(ua: string) { if (ua.includes('Edg/')) return 'Edge'; if (ua.includes('Chrome/')) return 'Chrome'; if (ua.includes('Firefox/')) return 'Firefox'; return 'Browser' }
function getOS(ua: string) { if (ua.includes('Windows')) return 'Windows'; if (ua.includes('Mac OS')) return 'macOS'; if (ua.includes('iPhone')) return 'iOS'; if (ua.includes('Android')) return 'Android'; return 'Unknown' }

function SessionPanel() {
  const [geo, setGeo] = useState<GeoInfo | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(null)
  const email = Cookies.get('user_email') || 'Employee'
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
    <div className="border-t border-white/10">
      <div className="p-3 flex items-center gap-2">
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-purple-600/30 border border-purple-500/30 flex items-center justify-center">
            {avatar ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" /> : <span className="text-xs font-black text-purple-300">{initials}</span>}
          </div>
          <label className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-slate-700 border border-white/20 rounded-full flex items-center justify-center cursor-pointer hover:bg-purple-600/50 transition-colors">
            <Camera className="w-2.5 h-2.5 text-slate-300" />
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </label>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate capitalize">{email.split('@')[0]}</p>
          <p className="text-[10px] text-slate-500 truncate">{email}</p>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="p-1 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0">
          {expanded ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
        </button>
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-white/5 pt-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Session Info</p>
          <div className="flex items-start gap-2">
            <Wifi className="w-3 h-3 text-purple-400 mt-0.5 flex-shrink-0" />
            <div><p className="text-[10px] text-slate-500">IP</p><p className="text-[11px] font-mono text-slate-300">{geo?.ip || '...'}</p></div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-3 h-3 text-purple-400 mt-0.5 flex-shrink-0" />
            <div><p className="text-[10px] text-slate-500">Location</p><p className="text-[11px] text-slate-300">{geo ? `${geo.city}, ${geo.region}` : '...'}</p><p className="text-[11px] text-slate-400">{geo?.country_name || ''}</p></div>
          </div>
          <div className="flex items-start gap-2">
            <Monitor className="w-3 h-3 text-purple-400 mt-0.5 flex-shrink-0" />
            <div><p className="text-[10px] text-slate-500">Device</p><p className="text-[11px] text-slate-300">{getBrowser(ua)} · {getOS(ua)}</p></div>
          </div>
        </div>
      )}
      <div className="px-3 pb-3">
        <button onClick={signOut} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all w-full">
          <LogOut className="w-3.5 h-3.5" />Sign Out
        </button>
      </div>
    </div>
  )
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 flex-shrink-0 glass border-r border-white/10 flex flex-col">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-600/20 border border-purple-500/30 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Endevo Life</div>
              <div className="text-xs text-purple-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block animate-pulse" />
                Employee Portal
              </div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {nav.map(item => {
            const active = path.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}>
                <item.icon className="w-4 h-4" />{item.label}
              </Link>
            )
          })}
        </nav>
        <SessionPanel />
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
