'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PlayCircle, ClipboardList, Award, User, BarChart3, LogOut, Settings } from 'lucide-react'
import { signOut } from '@/lib/auth/cognito'

const nav = [
  { href: '/employee/dashboard',     icon: BarChart3,       label: 'Dashboard' },
  { href: '/employee/training',      icon: PlayCircle,      label: 'Training' },
  { href: '/employee/assessment',    icon: ClipboardList,   label: 'Assessment' },
  { href: '/employee/certificates',  icon: Award,           label: 'Certificates' },
  { href: '/employee/profile',       icon: User,            label: 'My Profile' },
  { href: '/employee/settings',      icon: Settings,        label: 'Settings' },
]

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 flex-shrink-0 glass border-r border-white/10 flex flex-col">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-600/20 border border-purple-500/30 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Endevo Life</div>
              <div className="text-xs text-purple-400">Employee Portal</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map(item => {
            const active = path.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
