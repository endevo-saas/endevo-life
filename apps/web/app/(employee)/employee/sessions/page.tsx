'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle, CheckCircle2, Calendar, Mic, FileText, Clock } from 'lucide-react'
import { api } from '@/lib/api'

interface Session {
  sessionId: string
  scheduledAt: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'booked' | 'cancelled' | 'no-show'
  coachName?: string
  duration?: number
  summary?: string
  transcript?: string
}

interface SessionOverview {
  sessions: Session[]
  total: number
  used: number
  remaining: number
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionOverview, setSessionOverview] = useState<SessionOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [completing, setCompleting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [showBookForm, setShowBookForm] = useState(false)
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'playback'>('idle')
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])

  // Form state
  const [formData, setFormData] = useState({
    scheduledAt: '',
    notes: '',
  })
  const [transcript, setTranscript] = useState('')
  const [transcriptTitle, setTranscriptTitle] = useState('')

  async function loadSessions() {
    try {
      const result = await api.employeeSessions()
      setSessions(result.sessions || [])
      setSessionOverview(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  async function handleBookSession() {
    if (!formData.scheduledAt) {
      setError('Please select a date and time')
      return
    }

    setBooking(true)
    setError('')
    try {
      const result = await api.employeeBookSession(formData.scheduledAt, formData.notes)
      setSessions([result as Session, ...sessions])
      setFormData({ scheduledAt: '', notes: '' })
      setShowBookForm(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to book session')
    } finally {
      setBooking(false)
    }
  }

  async function handleCompleteSession(sessionId: string) {
    if (!transcript.trim()) {
      setError('Please provide a transcript or recording')
      return
    }

    setCompleting(sessionId)
    setError('')
    try {
      const result = await api.employeeCompleteSession(sessionId, transcript, transcriptTitle)
      setSessions(
        sessions.map(s =>
          s.sessionId === sessionId
            ? {
                ...s,
                status: 'completed',
                summary: result.summary,
                duration: result.duration,
              }
            : s
        )
      )
      setTranscript('')
      setTranscriptTitle('')
      setSelectedSession(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to complete session')
    } finally {
      setCompleting(null)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      setAudioChunks([])

      recorder.ondataavailable = (event: BlobEvent) => {
        setAudioChunks(prev => [...prev, event.data])
      }

      recorder.onstart = () => setRecordingState('recording')
      recorder.onstop = () => setRecordingState('playback')

      recorder.start()
      setMediaRecorder(recorder)
    } catch (e: unknown) {
      setError('Microphone access denied. Please allow microphone access.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop()
      mediaRecorder.stream.getTracks().forEach(track => track.stop())
      setMediaRecorder(null)
    }
  }

  const saveRecording = () => {
    if (audioChunks.length > 0) {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
      const url = URL.createObjectURL(audioBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `session-${Date.now()}.webm`
      a.click()
      setRecordingState('idle')
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading your sessions...</p>
        </div>
      </div>
    )
  }

  const upcomingSessions = sessions.filter(s => s.status === 'scheduled')
  const completedSessions = sessions.filter(s => s.status === 'completed')

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">1:1 Sessions</h1>
            </div>
            {sessionOverview && sessionOverview.remaining > 0 && (
              <button
                onClick={() => setShowBookForm(!showBookForm)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
              >
                {showBookForm ? 'Cancel' : 'Book Session'}
              </button>
            )}
          </div>
          <p className="text-gray-600">Meet with advisors to discuss your legacy planning</p>
        </div>

        {/* Session Quota */}
        {sessionOverview && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Sessions Used</p>
                <p className="text-2xl font-bold text-gray-900">
                  {sessionOverview.used} / {sessionOverview.total}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Remaining</p>
                <p className="text-2xl font-bold text-green-600">{sessionOverview.remaining}</p>
              </div>
              <div className="flex-1 ml-8">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(sessionOverview.used / sessionOverview.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Book Session Form */}
        {showBookForm && sessionOverview && sessionOverview.remaining > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Book a New Session</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date & Time</label>
                <input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={e => setFormData({ ...formData, scheduledAt: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="What would you like to discuss?"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  maxLength={500}
                />
              </div>
              <button
                onClick={handleBookSession}
                disabled={booking}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {booking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Booking...
                  </>
                ) : (
                  'Confirm Booking'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Upcoming Sessions */}
        {upcomingSessions.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Upcoming Sessions ({upcomingSessions.length})</h2>
            <div className="space-y-4">
              {upcomingSessions.map(session => (
                <div key={session.sessionId} className="border border-gray-200 rounded-lg p-4 hover:bg-blue-50 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{session.coachName || 'Scheduled Session'}</h3>
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(session.scheduledAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedSession(selectedSession === session.sessionId ? null : session.sessionId)}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-semibold"
                    >
                      {selectedSession === session.sessionId ? 'Hide' : 'Record'}
                    </button>
                  </div>

                  {selectedSession === session.sessionId && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="space-y-3">
                        {/* Recording Controls */}
                        {recordingState === 'idle' && (
                          <button
                            onClick={startRecording}
                            className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-semibold flex items-center justify-center gap-2"
                          >
                            <Mic className="w-4 h-4" />
                            Start Recording
                          </button>
                        )}

                        {recordingState === 'recording' && (
                          <div className="space-y-2">
                            <p className="text-sm text-red-600 font-semibold flex items-center gap-2">
                              <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                              Recording in progress...
                            </p>
                            <button
                              onClick={stopRecording}
                              className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 font-semibold"
                            >
                              Stop Recording
                            </button>
                          </div>
                        )}

                        {recordingState === 'playback' && (
                          <div className="space-y-2">
                            <button
                              onClick={saveRecording}
                              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
                            >
                              Save Recording
                            </button>
                          </div>
                        )}

                        {/* Transcript Input */}
                        <textarea
                          value={transcript}
                          onChange={e => setTranscript(e.target.value)}
                          placeholder="Paste or type the session transcript..."
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={5}
                          maxLength={5000}
                        />

                        {/* Title Input */}
                        <input
                          type="text"
                          value={transcriptTitle}
                          onChange={e => setTranscriptTitle(e.target.value)}
                          placeholder="Session title (optional)"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          maxLength={100}
                        />

                        {/* Submit Button */}
                        <button
                          onClick={() => handleCompleteSession(session.sessionId)}
                          disabled={completing === session.sessionId}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {completing === session.sessionId ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <FileText className="w-4 h-4" />
                              Submit & Generate Summary
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Sessions */}
        {completedSessions.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Session History ({completedSessions.length})</h2>
            <div className="space-y-4">
              {completedSessions.map(session => (
                <div key={session.sessionId} className="border border-green-200 rounded-lg p-4 bg-green-50">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{session.coachName || 'Completed Session'}</h3>
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                        <Clock className="w-4 h-4" />
                        {session.duration} minutes
                      </p>
                      {session.summary && (
                        <div className="mt-3 p-3 bg-white rounded border border-green-200">
                          <p className="text-xs text-gray-600 font-semibold mb-1">Summary</p>
                          <p className="text-sm text-gray-700">{session.summary}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {sessions.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No sessions yet. Book your first 1:1 session to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}
