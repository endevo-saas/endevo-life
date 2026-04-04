'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { FileText, Download, CheckCircle2 } from 'lucide-react'

interface Props {
  lessonId: string
  title: string
  description: string
  downloadUrl: string
  assetName: string
  completed: boolean
  onComplete: () => void
}

export default function PdfLesson({ lessonId, title, description, downloadUrl, assetName, completed, onComplete }: Props) {
  const [marking, setMarking] = useState(false)
  const [done, setDone] = useState(completed)

  const handleMarkRead = async () => {
    setMarking(true)
    try {
      await api.lmsCompleteLesson(lessonId)
      setDone(true)
      onComplete()
    } catch {
      // Silent
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {description && (
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">{description}</p>
        )}
      </div>

      {/* PDF preview card */}
      <div className="p-6 bg-[#0a1220] rounded-xl border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-red-500/10 rounded-xl flex items-center justify-center shrink-0">
            <FileText className="w-7 h-7 text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-medium">{assetName || title}</p>
            <p className="text-xs text-slate-500">PDF Document</p>
          </div>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" /> Open PDF
          </a>
        </div>
      </div>

      {/* Embedded PDF viewer */}
      <div className="rounded-xl overflow-hidden border border-slate-800 bg-white" style={{ height: '70vh' }}>
        <iframe
          src={downloadUrl}
          className="w-full h-full"
          title={title}
        />
      </div>

      {/* Mark as read */}
      {done ? (
        <div className="flex items-center gap-2 text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5" /> Marked as read
        </div>
      ) : (
        <button
          onClick={handleMarkRead}
          disabled={marking}
          className="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-medium transition-colors"
        >
          {marking ? 'Saving...' : 'Mark as Read'}
        </button>
      )}
    </div>
  )
}
