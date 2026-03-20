'use client'
import { Building2, Users, Shield, Activity } from 'lucide-react'
export default function AdminDashboard() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-brand-400" />
          <div>
            <h1 className="text-3xl font-bold text-white">Global Admin</h1>
            <p className="text-slate-400 text-sm">System-wide management</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Building2, label: 'Total Tenants',   value: '—', color: 'text-brand-400' },
            { icon: Users,     label: 'Total Users',     value: '—', color: 'text-green-400' },
            { icon: Activity,  label: 'Active Today',    value: '—', color: 'text-yellow-400' },
          ].map(s => (
            <div key={s.label} className="glass p-6 animate-slide-up">
              <s.icon className={`w-6 h-6 ${s.color} mb-3`} />
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-sm text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
