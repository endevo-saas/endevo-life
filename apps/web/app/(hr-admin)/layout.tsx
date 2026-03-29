'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users, BarChart3, UserPlus, FileText, LogOut, Settings,
  Globe, Monitor, MapPin, Wifi, ChevronDown, ChevronUp, Camera,
  BookOpen, Award
} from 'lucide-react'
import { signOut } from '@/lib/auth/cognito'
import Cookies from 'js-cookie'

const nav = [
  { href: '/hr/dashboard',  icon: BarChart3,  label: 'Dashboard' },
  { href: '/hr/employees',  icon: Users,      label: 'Employees' },
  { href: '/hr/invite',     icon: UserPlus,   label: 'Invite Employee' },
  { href: '/hr/training',   icon: BookOpen,   label: 'Training & Courses' },
  { href: '/hr/certificates', icon: Award,    label: 'Certificates' },
  { href: '/hr/audit',      icon: FileText,   label: 'Audit Log' },
  { href: '/hr/settings',   icon: Settings,   label: 'Settings' },
]

interface GeoInfo { ip: string; city: string; region: string; country_name: string; postal: string; org: string; latitude: number; longitude: number }

function getBrowser(ua: string) {
  if (ua.includes('Edg/')) return 'Microsoft Edge'
  if (ua.includes('Chrome/')) return 'Chrome'
  if (ua.includes('Firefox/')) return 'Firefox'
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari'
  return 'Browser'
}
function getOS(ua: string) {
  if (ua.includes('Windows NT 10')) return 'Windows 11/10'
  if (ua.includes('Mac OS X')) return 'macOS'
  if (ua.includes('iPhone')) return 'iOS'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('Linux')) return 'Linux'
  return 'Unknown OS'
}

function SessionPanel() {
  const [geo, setGeo] = useState<GeoInfo | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(null)
  const email = Cookies.get('user_email') || 'HR Admin'
  const initials = email.split('@')[0].slice(0, 2).toUpperCase()
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''

  useEffect(() => {
    const saved = localStorage.getItem('hr_avatar')
    if (saved) setAvatar(saved)
    fetch('https://ipapi.co/json/').then(r => r.json()).then(setGeo).catch(() => {})
  }, [])

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { const d = ev.target?.result as string; setAvatar(d); localStorage.setItem('hr_avatar', d) }
    reader.readAsDataURL(file)
  }

  return (
    <div className="border-t border-white/10">
      <div className="p-3 flex items-center gap-2">
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-green-600/30 border border-green-500/30 flex items-center justify-center">
            {avatar ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" /> : <span className="text-xs font-black text-green-300">{initials}</span>}
          </div>
          <label className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-slate-700 border border-white/20 rounded-full flex items-center justify-center cursor-pointer hover:bg-green-600/50 transition-colors">
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
            <Wifi className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
            <div><p className="text-[10px] text-slate-500">IP Address</p><p className="text-[11px] font-mono text-slate-300">{geo?.ip || '...'}</p></div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
            <div><p className="text-[10px] text-slate-500">Location</p><p className="text-[11px] text-slate-300">{geo ? `${geo.city}, ${geo.region} ${geo.postal}` : '...'}</p><p className="text-[11px] text-slate-400">{geo?.country_name || ''}</p></div>
          </div>
          <div className="flex items-start gap-2">
            <Monitor className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
            <div><p className="text-[10px] text-slate-500">Device</p><p className="text-[11px] text-slate-300">{getBrowser(ua)}</p><p className="text-[11px] text-slate-400">{getOS(ua)}</p></div>
          </div>
          {geo?.latitude && <p className="text-[10px] text-slate-600 font-mono pt-1 border-t border-white/5">{geo.latitude.toFixed(4)}, {geo.longitude.toFixed(4)}</p>}
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

export default function HrLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 flex-shrink-0 glass border-r border-white/10 flex flex-col">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-600/20 border border-green-500/30 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Endevo Life</div>
              <div className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
                HR Admin
              </div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {nav.map(item => {
            const active = path === item.href || path.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active ? 'bg-green-600/20 text-green-300 border border-green-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
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
