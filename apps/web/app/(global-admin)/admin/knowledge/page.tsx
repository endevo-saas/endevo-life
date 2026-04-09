'use client'
export const dynamic = 'force-dynamic'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Upload, Loader2, AlertCircle, CheckCircle, RefreshCw,
  FileText, Trash2, Database, Clock, HardDrive
} from 'lucide-react'
import { api } from '@/lib/api'

interface KnowledgeFile {
  key: string
  filename: string
  size: number
  uploadedAt: string
  uploadedBy?: string
  status?: string
}

interface KnowledgeStats {
  totalFiles: number
  totalChunks: number
  lastSynced: string | null
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const ACCEPTED_EXTENSIONS = '.pdf,.txt,.md,.docx,.csv'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function KnowledgeBasePage() {
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [stats, setStats] = useState<KnowledgeStats>({ totalFiles: 0, totalChunks: 0, lastSynced: null })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showSuccess = useCallback((msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 5000)
  }, [])

  const showError = useCallback((msg: string) => {
    setError(msg)
    setTimeout(() => setError(''), 8000)
  }, [])

  const loadFiles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.adminListKnowledge()
      const mapped: KnowledgeFile[] = (res.files || []).map(f => ({
        key: f.key,
        filename: f.key.split('/').pop() || f.key,
        size: f.size,
        uploadedAt: f.lastModified,
        status: 'indexed',
      }))
      setFiles(mapped)
      setStats(prev => ({ ...prev, totalFiles: mapped.length }))
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Failed to load knowledge base files')
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => { loadFiles() }, [loadFiles])

  async function handleUpload(fileList: FileList | File[]) {
    const filesToUpload = Array.from(fileList)
    if (filesToUpload.length === 0) return

    for (const file of filesToUpload) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        showError(`Unsupported file type: ${file.name}. Accepted: ${ACCEPTED_EXTENSIONS}`)
        return
      }
    }

    setUploading(true)
    setUploadProgress(0)
    setError('')

    let uploaded = 0
    for (const file of filesToUpload) {
      try {
        // Step 1: Get presigned URL
        const { url, key } = await api.adminUploadKnowledge(file.name, file.type)

        // Step 2: Upload directly to S3 via presigned URL
        const uploadRes = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        })

        if (!uploadRes.ok) {
          throw new Error(`Upload failed for ${file.name}: ${uploadRes.status}`)
        }

        uploaded++
        setUploadProgress(Math.round((uploaded / filesToUpload.length) * 100))
      } catch (e: unknown) {
        showError(e instanceof Error ? e.message : `Failed to upload ${file.name}`)
        break
      }
    }

    if (uploaded > 0) {
      showSuccess(`Uploaded ${uploaded} file${uploaded > 1 ? 's' : ''} successfully`)
      await loadFiles()
    }
    setUploading(false)
    setUploadProgress(0)
  }

  async function handleSync() {
    setSyncing(true)
    setError('')
    try {
      const res = await api.adminSyncKnowledge()
      showSuccess(res.message || 'Knowledge base sync triggered successfully')
      setStats(prev => ({ ...prev, lastSynced: new Date().toISOString() }))
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function handleDelete(key: string, filename: string) {
    if (!confirm(`Delete "${filename}" from the knowledge base?`)) return
    try {
      await api.adminDeleteKnowledge(key)
      showSuccess(`Deleted ${filename}`)
      await loadFiles()
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files)
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(true)
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
            <p className="text-slate-400 text-sm mt-0.5">Upload content files to train Jesse AI</p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? 'Syncing...' : 'Sync Knowledge Base'}
          </button>
        </div>

        {/* Notifications */}
        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />{success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="glass p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-brand-400" />
              <span className="text-xs text-slate-500">Total Files</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalFiles}</p>
          </div>
          <div className="glass p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-slate-500">Total Chunks</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalChunks}</p>
          </div>
          <div className="glass p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-green-400" />
              <span className="text-xs text-slate-500">Last Synced</span>
            </div>
            <p className="text-sm font-medium text-white">
              {stats.lastSynced ? formatDate(stats.lastSynced) : 'Never'}
            </p>
          </div>
        </div>

        {/* Upload zone */}
        <div className="mb-6">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`glass p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all text-center ${
              dragActive
                ? 'border-brand-400 bg-brand-600/10'
                : 'border-white/10 hover:border-white/20 hover:bg-white/3'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              multiple
              className="hidden"
              onChange={e => {
                if (e.target.files) handleUpload(e.target.files)
                e.target.value = ''
              }}
            />
            {uploading ? (
              <div className="space-y-3">
                <Loader2 className="w-8 h-8 text-brand-400 animate-spin mx-auto" />
                <p className="text-sm text-white font-medium">Uploading... {uploadProgress}%</p>
                <div className="w-48 mx-auto bg-white/10 rounded-full h-2">
                  <div
                    className="bg-brand-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-sm text-white font-medium">
                  {dragActive ? 'Drop files here' : 'Drag & drop files here or click to browse'}
                </p>
                <p className="text-xs text-slate-500">
                  Accepted formats: PDF, TXT, Markdown, DOCX, CSV
                </p>
              </div>
            )}
          </div>
        </div>

        {/* File list */}
        <div className="glass">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-semibold text-white">Uploaded Files</h3>
              <span className="text-xs text-slate-500">({files.length})</span>
            </div>
            <button
              onClick={loadFiles}
              disabled={loading}
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loading && files.length === 0 ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 text-slate-500 animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-500">Loading files...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No files uploaded yet</p>
              <p className="text-xs text-slate-600 mt-1">Upload PDFs, text files, or documents to train Jesse AI</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-slate-500 font-medium">Filename</th>
                    <th className="text-left py-3 px-4 text-slate-500 font-medium">Size</th>
                    <th className="text-left py-3 px-4 text-slate-500 font-medium">Uploaded</th>
                    <th className="text-left py-3 px-4 text-slate-500 font-medium">Status</th>
                    <th className="text-right py-3 px-4 text-slate-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {files.map(file => (
                    <tr key={file.key} className="hover:bg-white/3 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-brand-400 flex-shrink-0" />
                          <span className="text-slate-300 truncate max-w-[250px]">{file.filename}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{formatBytes(file.size)}</td>
                      <td className="py-3 px-4 text-slate-400">{formatDate(file.uploadedAt)}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          Indexed
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDelete(file.key, file.filename)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Delete file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
