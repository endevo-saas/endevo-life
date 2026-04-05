'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { FileText, CheckCircle2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react'

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
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {description && (
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">{description}</p>
        )}
      </div>

      {/* Document info */}
      <div className="p-4 bg-[#0a1220] rounded-xl border border-slate-800 flex items-center gap-4">
        <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-red-400" />
        </div>
        <div className="flex-1">
          <p className="text-white font-medium text-sm">{assetName || title}</p>
          <p className="text-xs text-slate-500">Read-only document — zoom and navigate pages below</p>
        </div>
      </div>

      {/* PDF viewer — embedded with no toolbar */}
      <div
        className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 relative"
        style={{ height: '70vh' }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {downloadUrl ? (
          <iframe
            src={`${downloadUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
            className="w-full h-full"
            title={title}
            style={{ pointerEvents: 'auto' }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            PDF not available
          </div>
        )}
      </div>

      <p className="text-xs text-slate-600 text-center">
        This document is view-only. Use scroll to navigate pages.
      </p>

      {/* Mark as read */}
      {done ? (
        <div className="flex items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-emerald-300 font-medium text-sm">Marked as read</span>
        </div>
      ) : (
        <button
          onClick={handleMarkRead}
          disabled={marking}
          className="w-full py-3 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 text-white rounded-xl font-medium transition-colors"
        >
          {marking ? 'Saving...' : 'I have read this document'}
        </button>
      )}
    </div>
  )
}
