'use client'

import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react'
import { usePathname } from 'next/navigation'
import Cookies from 'js-cookie'
import { api } from '@/lib/api'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
interface ActionResult {
  action: string
  result: {
    success: boolean
    message?: string
    error?: string
    [key: string]: unknown
  }
}

interface JesseMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  actions?: ActionResult[]
}

type JesseRole = 'GLOBAL_ADMIN' | 'HR_ADMIN' | 'EMPLOYEE'

const ROLE_LABELS: Record<string, string> = {
  GLOBAL_ADMIN: 'Admin Assistant',
  HR_ADMIN: 'HR Assistant',
  EMPLOYEE: 'Learning Guide',
}

const ROLE_COLORS: Record<string, string> = {
  GLOBAL_ADMIN: 'from-violet-600 to-indigo-600',
  HR_ADMIN: 'from-blue-600 to-cyan-600',
  EMPLOYEE: 'from-purple-600 to-pink-600',
}

const EMPTY_STATE = 'Hi! I\'m Jesse, your Endevo AI assistant. I can help you navigate the platform, answer questions, and even execute tasks for you. How can I help?'

/* ------------------------------------------------------------------ */
/* Inline SVG icons                                                   */
/* ------------------------------------------------------------------ */
function SparkleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z" clipRule="evenodd" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  )
}

function VolumeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}

function VolumeMuteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" x2="17" y1="9" y2="15" />
      <line x1="17" x2="23" y1="9" y2="15" />
    </svg>
  )
}

function CheckCircleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
    </svg>
  )
}

function XCircleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 0 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */
function UserBubble({ message }: { message: JesseMessage }) {
  return (
    <div className="flex justify-end mb-3">
      <div className="max-w-[80%] flex flex-col items-end">
        <div className="rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words text-white bg-gradient-to-r from-violet-600 to-indigo-600">
          {message.content}
        </div>
        <span className="text-[10px] mt-1 mr-1" style={{ color: 'var(--text-muted)' }}>
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  )
}

function ActionCard({ action }: { action: ActionResult }) {
  const isSuccess = action.result.success
  return (
    <div
      className="mt-2 p-3 rounded-xl"
      style={{
        background: isSuccess ? 'rgba(139,92,246,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${isSuccess ? 'rgba(139,92,246,0.3)' : 'rgba(239,68,68,0.3)'}`,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        {isSuccess
          ? <CheckCircleIcon className="w-4 h-4 text-green-400" />
          : <XCircleIcon className="w-4 h-4 text-red-400" />
        }
        <span className={`text-xs font-bold ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
          {isSuccess ? 'Action Complete' : 'Action Failed'}
        </span>
        <span className="text-[10px] text-slate-500 ml-auto">{action.action}</span>
      </div>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {action.result.message || action.result.error || 'No details'}
      </p>
    </div>
  )
}

function JesseBubble({ message }: { message: JesseMessage }) {
  return (
    <div className="flex justify-start mb-3 gap-2">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
        <SparkleIcon className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="max-w-[80%] flex flex-col">
        <div
          className="rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
        >
          {message.content}
        </div>
        {message.actions && message.actions.length > 0 && (
          <div className="mt-1">
            {message.actions.map((a, i) => (
              <ActionCard key={`${a.action}-${i}`} action={a} />
            ))}
          </div>
        )}
        <span className="text-[10px] mt-1 ml-1" style={{ color: 'var(--text-muted)' }}>
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3 gap-2" aria-live="polite" aria-label="Jesse is working">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
        <SparkleIcon className="w-3.5 h-3.5 text-white" />
      </div>
      <div
        className="rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-3"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
        </div>
        <span className="text-sm text-violet-300 animate-pulse">Jesse is working on it...</span>
      </div>
    </div>
  )
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */
export default function CopilotWidget() {
  const pathname = usePathname()

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<JesseMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<unknown>(null)

  // Derive role from cookie
  const role: JesseRole = (Cookies.get('user_role') as JesseRole) || 'EMPLOYEE'
  const tenantId = Cookies.get('tenant_id') || ''

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  const toggleListening = useCallback(() => {
    const win = window as unknown as Record<string, unknown>
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Voice input not supported in this browser')
      return
    }

    if (isListening) {
      (recognitionRef.current as { stop: () => void } | null)?.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognitionCtor = (win.SpeechRecognition || win.webkitSpeechRecognition) as new () => {
      continuous: boolean
      interimResults: boolean
      lang: string
      onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null
      onend: (() => void) | null
      onerror: (() => void) | null
      start: () => void
      stop: () => void
    }
    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('')
      setInput(transcript)
    }

    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening])

  const speakReply = useCallback(async (text: string) => {
    if (!voiceEnabled) return
    try {
      const data = await api.jesseSpeakText(text, voiceGender)
      if (data.audioUrl) {
        const audio = new Audio(data.audioUrl)
        audio.play()
      }
    } catch {
      // Silently fail — voice is optional
    }
  }, [voiceEnabled, voiceGender])

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    setError(null)
    setInput('')

    const userMessage: JesseMessage = {
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      const data = await api.copilotChat(trimmed, {
        role,
        page: pathname,
        tenantId: tenantId || undefined,
      })

      const assistantMessage: JesseMessage = {
        role: 'assistant',
        content: data.reply,
        createdAt: new Date().toISOString(),
        actions: data.actions,
      }

      setMessages((prev) => [...prev, assistantMessage])
      speakReply(data.reply)
    } catch {
      const errMsg = 'Sorry, I couldn\'t process that. Please try again.'
      setError(errMsg)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: errMsg, createdAt: new Date().toISOString() },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, role, pathname, tenantId, speakReply])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const togglePanel = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const gradientClass = ROLE_COLORS[role] || ROLE_COLORS.EMPLOYEE
  const roleLabel = ROLE_LABELS[role] || 'Assistant'

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Jesse AI"
          aria-modal="false"
          className="fixed bottom-20 right-20 w-[calc(100vw-2rem)] sm:w-96 h-[500px] max-h-[80vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden z-50"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 bg-gradient-to-r ${gradientClass}`}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <SparkleIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-white text-sm font-semibold leading-tight">
                  Jesse AI
                </h2>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                  <p className="text-white/80 text-[11px] leading-tight">
                    {roleLabel}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`p-1.5 rounded-lg transition-all text-xs ${
                  voiceEnabled ? 'text-white bg-white/20' : 'text-white/40'
                }`}
                title={voiceEnabled ? 'Mute Jesse' : 'Unmute Jesse'}
              >
                {voiceEnabled ? <VolumeIcon /> : <VolumeMuteIcon />}
              </button>
              <button
                onClick={() => setVoiceGender(voiceGender === 'female' ? 'male' : 'female')}
                className="p-1.5 rounded-lg text-xs text-white/70 hover:text-white transition-all hover:bg-white/10"
                title={`Voice: ${voiceGender}`}
              >
                {voiceGender === 'female' ? '\u2640' : '\u2642'}
              </button>
              <button
                onClick={togglePanel}
                className="text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                aria-label="Close Jesse"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3"
            role="log"
            aria-live="polite"
            aria-label="Jesse messages"
          >
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center mb-4 shadow-lg`}>
                  <SparkleIcon className="w-7 h-7 text-white" />
                </div>
                <p className="text-sm leading-relaxed max-w-[260px]" style={{ color: 'var(--text-muted)' }}>
                  {EMPTY_STATE}
                </p>
              </div>
            )}

            {messages.map((msg, idx) =>
              msg.role === 'user'
                ? <UserBubble key={`${msg.createdAt}-${idx}`} message={msg} />
                : <JesseBubble key={`${msg.createdAt}-${idx}`} message={msg} />
            )}

            {isLoading && <TypingIndicator />}

            {error && !isLoading && (
              <p className="text-center text-xs text-red-500 mb-2" role="alert">{error}</p>
            )}

            <div ref={messagesEndRef} aria-hidden="true" />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Jesse anything..."
                rows={1}
                className="flex-1 resize-none rounded-xl px-3 py-2 text-sm leading-relaxed placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent max-h-24 overflow-y-auto"
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                }}
                aria-label="Type a message to Jesse"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={toggleListening}
                className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-red-500/20 text-red-400 animate-pulse'
                    : 'text-slate-400 hover:text-violet-300 hover:bg-violet-500/10'
                }`}
                title={isListening ? 'Stop listening' : 'Voice input'}
                aria-label={isListening ? 'Stop listening' : 'Voice input'}
              >
                <MicIcon />
              </button>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={`flex-shrink-0 w-9 h-9 rounded-xl text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r ${gradientClass} hover:opacity-90`}
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </div>
            <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--text-muted)' }}>
              Shift+Enter for new line
            </p>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={togglePanel}
        className={`fixed bottom-4 right-20 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 z-50 text-white ${
          isOpen
            ? 'bg-gray-500 hover:bg-gray-600'
            : `bg-gradient-to-br ${gradientClass} hover:opacity-90`
        }`}
        style={!isOpen ? { boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)' } : undefined}
        aria-label={isOpen ? 'Close Jesse' : 'Ask Jesse'}
        aria-expanded={isOpen}
      >
        {isOpen ? <CloseIcon /> : <SparkleIcon className="w-7 h-7" />}
      </button>
    </>
  )
}
