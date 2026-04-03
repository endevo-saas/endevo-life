'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  BookOpen, ArrowLeft, Video, FileText, HelpCircle,
  Trash2, Plus, Loader2, AlertTriangle, Upload,
  X, ExternalLink, Film, BookMarked
} from 'lucide-react'
import { api } from '@/lib/api'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface LmsModule {
  moduleNum: string
  title: string
  description: string
  objectives: string[]
  videoIds: string[]
  pdfKey?: string
  pdfName?: string
  isActive: boolean
}

interface VideoRecord {
  videoId: string
  title: string
  description?: string
  s3Key: string
  duration?: string
  videoType: 'main' | 'action_step'
  order: number
  thumbnailKey?: string
  createdAt: string
}

interface UploadUrlResponse {
  uploadUrl: string
  key: string
  bucket: string
  expiresIn: number
}

// ── Upload helpers ────────────────────────────────────────────────────────────

async function uploadToS3(
  file: File,
  uploadUrl: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`S3 upload failed: ${xhr.status}`))
    })
    xhr.addEventListener('error', () => reject(new Error('S3 upload network error')))
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.send(file)
  })
}

// ── Video type badge ──────────────────────────────────────────────────────────

function VideoTypeBadge({ type }: { type: string }) {
  const cls = type === 'main'
    ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
    : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${cls}`}>
      {type === 'main' ? 'Main' : 'Action Step'}
    </span>
  )
}

// ── Add Video Form ────────────────────────────────────────────────────────────

function AddVideoForm({
  moduleNum,
  onSuccess,
  onClose,
}: {
  moduleNum: string
  onSuccess: () => void
  onClose: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    videoType: 'main' as 'main' | 'action_step',
    duration: '',
    order: '0',
  })
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setError('Please select a video file'); return }
    if (!form.title.trim()) { setError('Title is required'); return }

    setUploading(true)
    setError('')
    setProgress(0)
    try {
      // Step 1: get presigned URL
      const urlResp = await api.lmsAdminGetUploadUrl(moduleNum, {
        fileName: file.name,
        fileType: 'video',
        contentType: file.type || 'video/mp4',
      }) as UploadUrlResponse

      // Step 2: PUT file to S3
      await uploadToS3(file, urlResp.uploadUrl, setProgress)

      // Step 3: save metadata
      const videoId = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      await api.lmsAdminAddVideo(moduleNum, {
        videoId,
        title: form.title.trim(),
        description: form.description.trim(),
        s3Key: urlResp.key,
        duration: form.duration.trim(),
        videoType: form.videoType,
        order: parseInt(form.order) || 0,
      })

      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-teal-500/20 bg-teal-900/10 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-teal-300 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Video
        </h4>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div>
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Video File (.mp4) *</label>
        <div
          className="mt-1 flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:border-teal-500/30 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-400">{file ? file.name : 'Click to select file'}</span>
          {file && <span className="text-xs text-slate-600 ml-auto">{(file.size / 1024 / 1024).toFixed(1)} MB</span>}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/*"
          className="hidden"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Title *</label>
          <input
            required
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            value={form.title}
            onChange={e => setForm(s => ({ ...s, title: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Video Type</label>
          <select
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            value={form.videoType}
            onChange={e => setForm(s => ({ ...s, videoType: e.target.value as 'main' | 'action_step' }))}
          >
            <option value="main">Main</option>
            <option value="action_step">Action Step</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Duration (e.g. 5:30)</label>
          <input
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            placeholder="mm:ss"
            value={form.duration}
            onChange={e => setForm(s => ({ ...s, duration: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Order</label>
          <input
            type="number"
            min="0"
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            value={form.order}
            onChange={e => setForm(s => ({ ...s, order: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Description</label>
          <input
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            value={form.description}
            onChange={e => setForm(s => ({ ...s, description: e.target.value }))}
          />
        </div>
      </div>

      {uploading && (
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-2">
            <div
              className="bg-teal-500 h-2 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600/20 border border-teal-500/30 text-teal-300 hover:bg-teal-600/30 text-sm font-semibold transition-all disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? `Uploading ${progress}%` : 'Upload Video'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white text-sm font-semibold transition-all disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── PDF Upload Section ────────────────────────────────────────────────────────

function PdfSection({
  moduleNum,
  currentPdfKey,
  currentPdfName,
  onSuccess,
}: {
  moduleNum: string
  currentPdfKey?: string
  currentPdfName?: string
  onSuccess: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const handleUpload = async () => {
    if (!file) { setError('Please select a PDF file'); return }
    setUploading(true)
    setError('')
    setProgress(0)
    try {
      const urlResp = await api.lmsAdminGetUploadUrl(moduleNum, {
        fileName: file.name,
        fileType: 'pdf',
        contentType: 'application/pdf',
      }) as UploadUrlResponse

      await uploadToS3(file, urlResp.uploadUrl, setProgress)

      await api.lmsAdminUpdateModulePdf(moduleNum, {
        pdfKey: urlResp.key,
        pdfName: file.name,
      })

      setFile(null)
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'PDF upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {currentPdfKey && (
        <div className="flex items-center gap-3 p-3 bg-white/3 border border-white/8 rounded-xl">
          <FileText className="w-5 h-5 text-orange-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">{currentPdfName || 'Module PDF'}</p>
            <p className="text-xs text-slate-500 truncate font-mono">{currentPdfKey}</p>
          </div>
          <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">Current</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div
        className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:border-orange-500/30 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="w-4 h-4 text-slate-500" />
        <span className="text-sm text-slate-400">{file ? file.name : 'Click to select PDF'}</span>
        {file && <span className="text-xs text-slate-600 ml-auto">{(file.size / 1024 / 1024).toFixed(1)} MB</span>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={e => setFile(e.target.files?.[0] ?? null)}
      />

      {uploading && (
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Uploading PDF…</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-2">
            <div
              className="bg-orange-500 h-2 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {file && !uploading && (
        <button
          onClick={handleUpload}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600/20 border border-orange-500/30 text-orange-300 hover:bg-orange-600/30 text-sm font-semibold transition-all"
        >
          <Upload className="w-4 h-4" />
          Upload PDF
        </button>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ModuleDetailPage() {
  const params = useParams()
  const moduleNum = params.moduleNum as string

  const [mod, setMod] = useState<LmsModule | null>(null)
  const [videos, setVideos] = useState<VideoRecord[]>([])
  const [loadingMod, setLoadingMod] = useState(true)
  const [loadingVideos, setLoadingVideos] = useState(true)
  const [error, setError] = useState('')
  const [showAddVideo, setShowAddVideo] = useState(false)
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null)

  const loadModule = useCallback(async () => {
    setLoadingMod(true)
    try {
      const data = await api.lmsAdminGetModules() as { modules: LmsModule[] }
      const found = (data.modules || []).find(m => m.moduleNum === moduleNum)
      setMod(found ?? null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load module')
    } finally {
      setLoadingMod(false)
    }
  }, [moduleNum])

  const loadVideos = useCallback(async () => {
    setLoadingVideos(true)
    try {
      const data = await api.lmsAdminGetModuleVideos(moduleNum) as { videos: VideoRecord[] }
      setVideos(data.videos || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load videos')
    } finally {
      setLoadingVideos(false)
    }
  }, [moduleNum])

  useEffect(() => {
    loadModule()
    loadVideos()
  }, [loadModule, loadVideos])

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Delete this video? This cannot be undone.')) return
    setDeletingVideoId(videoId)
    try {
      await api.lmsAdminDeleteVideo(moduleNum, videoId)
      setVideos(prev => prev.filter(v => v.videoId !== videoId))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete video')
    } finally {
      setDeletingVideoId(null)
    }
  }

  const title = mod?.title ?? `Module ${moduleNum}`

  return (
    <div className="min-h-screen p-6">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/admin/lms/modules" className="flex items-center gap-1.5 hover:text-teal-400 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Modules
          </Link>
          <span>/</span>
          <span className="text-slate-300">Module {moduleNum}: {title}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <BookOpen className="w-7 h-7 text-teal-400" />
              Module {moduleNum} Content
            </h1>
            <p className="text-slate-400 text-sm mt-1">{title}</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error}
            <button onClick={() => setError('')} className="ml-auto text-red-300 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Module Info Card */}
        {loadingMod ? (
          <div className="rounded-2xl border border-white/5 bg-white/3 p-5 animate-pulse h-24" />
        ) : mod ? (
          <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">{mod.title}</h2>
                <p className="text-sm text-slate-400">{mod.description || 'No description set.'}</p>
                {mod.objectives.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {mod.objectives.map((obj, i) => (
                      <li key={i} className="text-xs text-slate-500 flex items-start gap-2">
                        <span className="text-teal-500 mt-0.5">•</span> {obj}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Link
                href="/admin/lms/modules"
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-teal-400 flex-shrink-0 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Edit info
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-900/10 p-4 text-amber-400 text-sm">
            Module {moduleNum} not found in database. Create it first on the Modules page.
          </div>
        )}

        {/* ── Videos Section ─────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-teal-400" />
              Videos
            </h2>
            {!showAddVideo && (
              <button
                onClick={() => setShowAddVideo(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-600/20 border border-teal-500/30 text-teal-300 hover:bg-teal-600/30 text-xs font-semibold transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Video
              </button>
            )}
          </div>

          {showAddVideo && (
            <AddVideoForm
              moduleNum={moduleNum}
              onSuccess={loadVideos}
              onClose={() => setShowAddVideo(false)}
            />
          )}

          {loadingVideos ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 animate-pulse h-16" />
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-white/3 p-8 text-center">
              <Video className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm font-medium">No videos yet</p>
              <p className="text-slate-600 text-xs mt-1">Upload videos using the form above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {videos.map(video => (
                <div key={video.videoId} className="flex items-center gap-4 p-4 rounded-xl border border-white/8 bg-white/3 hover:bg-white/5 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-teal-600/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
                    <Video className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-white truncate">{video.title}</span>
                      <VideoTypeBadge type={video.videoType} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {video.duration && <span>{video.duration}</span>}
                      <span>Order: {video.order}</span>
                      <span className="font-mono truncate max-w-48">{video.s3Key}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteVideo(video.videoId)}
                    disabled={deletingVideoId === video.videoId}
                    className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                    title="Delete video"
                  >
                    {deletingVideoId === video.videoId
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />
                    }
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── PDF Section ────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-orange-400" />
            Module PDF
          </h2>
          <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
            <PdfSection
              moduleNum={moduleNum}
              currentPdfKey={mod?.pdfKey}
              currentPdfName={mod?.pdfName}
              onSuccess={loadModule}
            />
          </div>
        </section>

        {/* ── Inline Quizzes Section ─────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-400" />
            Inline Quizzes
          </h2>
          <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
            <p className="text-sm text-slate-400 mb-4">
              Inline quiz questions are linked to specific videos in this module.
              Manage them in the Questions editor, filtered to this module.
            </p>
            <Link
              href={`/admin/lms/questions?moduleNum=${moduleNum}&type=inline`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 text-sm font-semibold transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              Manage Inline Questions for Module {moduleNum}
            </Link>
          </div>
        </section>

        {/* Footer */}
        <div className="text-xs text-slate-600 pb-2 text-right">
          Endevo Life · LMS Admin · Module {moduleNum}
        </div>
      </div>
    </div>
  )
}
