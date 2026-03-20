'use client'
import { Users, TrendingUp, Award, Upload } from 'lucide-react'
export default function HrDashboard() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">HR Admin Dashboard</h1>
        <p className="text-slate-400 mb-8">Manage your employees, training and assessments</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users,    label: 'Total Employees', value: '—', color: 'text-blue-400' },
            { icon: TrendingUp, label: 'Active This Month', value: '—', color: 'text-green-400' },
            { icon: Award,    label: 'Certificates Issued', value: '—', color: 'text-yellow-400' },
            { icon: Upload,   label: 'Pending Invites', value: '—', color: 'text-purple-400' },
          ].map(s => (
            <div key={s.label} className="glass p-6 animate-slide-up">
              <s.icon className={`w-6 h-6 ${s.color} mb-3`} />
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-sm text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-8 glass p-6">
          <p className="text-slate-400 text-sm">Phase 2 — Full data integration coming next. Infrastructure is live.</p>
        </div>
      </div>
    </div>
  )
}
