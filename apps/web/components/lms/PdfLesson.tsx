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

  // Append #toolbar=0 to disable Chrome PDF viewer toolbar (download/print)
  // Also disable right-click on the iframe container
  const secureUrl = downloadUrl ? `${downloadUrl}#toolbar=0&navpanes=0` : ''

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

      {/* Secure PDF viewer — no download, no print, no right-click */}
      <div
        className="rounded-xl overflow-hidden border border-slate-800 bg-white relative"
        style={{ height: '70vh' }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <iframe
          src={secureUrl}
          className="w-full h-full"
          title={title}
          sandbox="allow-same-origin allow-scripts"
          style={{ pointerEvents: 'auto' }}
        />
        {/* Transparent overlay to block right-click save-as on the PDF content */}
        <div
          className="absolute top-0 right-0 w-12 h-12"
          style={{ background: 'transparent' }}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      <p className="text-xs text-slate-600 text-center">
        This document is view-only for security. Use zoom controls within the viewer to adjust size.
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
