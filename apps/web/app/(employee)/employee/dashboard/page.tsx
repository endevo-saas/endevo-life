'use client'
import { PlayCircle, ClipboardList, Award, User } from 'lucide-react'
export default function EmployeeDashboard() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Welcome back</h1>
        <p className="text-slate-400 mb-8">Continue your digital legacy journey</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: PlayCircle,    label: 'Training Videos',   sub: 'Complete your modules', color: 'bg-blue-500/10 border-blue-500/20' },
            { icon: ClipboardList, label: 'Assessment',        sub: 'Test your knowledge',   color: 'bg-purple-500/10 border-purple-500/20' },
            { icon: Award,         label: 'My Certificates',   sub: 'Download your certs',   color: 'bg-yellow-500/10 border-yellow-500/20' },
            { icon: User,          label: 'My Profile',        sub: 'Update your details',   color: 'bg-green-500/10 border-green-500/20' },
          ].map(c => (
            <div key={c.label} className={`glass p-6 border ${c.color} cursor-pointer hover:-translate-y-1 transition-transform animate-slide-up`}>
              <c.icon className="w-8 h-8 text-white mb-3" />
              <div className="font-semibold text-white">{c.label}</div>
              <div className="text-sm text-slate-400 mt-1">{c.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
