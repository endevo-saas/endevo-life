'use client'

import { useState, useEffect, useRef, useCallback, useMemo, type KeyboardEvent } from 'react'
import { usePathname } from 'next/navigation'
import Cookies from 'js-cookie'
import { api, type JesseChatMessage, type CopilotActionResult } from '@/lib/api'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type JesseRole = 'GLOBAL_ADMIN' | 'HR_ADMIN' | 'EMPLOYEE'

interface JesseMessage extends JesseChatMessage {
  actions?: CopilotActionResult[]
}

interface RoleConfig {
  title: string
  subtitle: string
  gradient: string
  gradientHover: string
  fabShadow: string
  badge: string
  ringColor: string
  emptyGreeting: string
}

/* ------------------------------------------------------------------ */
/* Role configuration                                                  */
/* ------------------------------------------------------------------ */
const ROLE_CONFIG: Record<JesseRole, RoleConfig> = {
  GLOBAL_ADMIN: {
    title: 'Jesse \u2014 Platform Commander',
    subtitle: 'Your AI Super Admin',
    gradient: 'from-violet-600 to-indigo-600',
    gradientHover: 'from-violet-700 to-indigo-700',
    fabShadow: '0 4px 20px rgba(124, 58, 237, 0.45)',
    badge: 'Admin',
    ringColor: 'focus:ring-violet-500',
    emptyGreeting:
      "Hi! I'm Jesse, your Platform Commander. I have full system access \u2014 ask me to manage tenants, review analytics, configure settings, or troubleshoot anything across the entire platform.",
  },
  HR_ADMIN: {
    title: 'Jesse \u2014 HR Operations',
    subtitle: 'Your AI HR Assistant',
    gradient: 'from-blue-600 to-cyan-500',
    gradientHover: 'from-blue-700 to-cyan-600',
    fabShadow: '0 4px 20px rgba(37, 99, 235, 0.45)',
    badge: 'HR',
    ringColor: 'focus:ring-blue-500',
    emptyGreeting:
      "Hi! I'm Jesse, your HR Operations assistant. I can help you manage employees, send invitations, track session completions, and run reports for your organization.",
  },
  EMPLOYEE: {
    title: 'Jesse \u2014 Your Legacy Guide',
    subtitle: 'AI Learning Companion',
    gradient: 'from-orange-500 to-amber-500',
    gradientHover: 'from-orange-600 to-amber-600',
    fabShadow: '0 4px 20px rgba(249, 115, 22, 0.45)',
    badge: 'You',
    ringColor: 'focus:ring-orange-400',
    emptyGreeting:
      "Hi! I'm Jesse, your Legacy Readiness Guide. I'll walk you through your training modules, answer questions about legacy planning, and help you earn your certificates. Ask me anything!",
  },
}

const ERROR_MESSAGE = "Sorry, I couldn't process that. Please try again."

/* ------------------------------------------------------------------ */
/* Utility: browser language placeholder hint                         */
/* ------------------------------------------------------------------ */
function getPlaceholderHint(): string {
  if (typeof navigator === 'undefined') return 'Ask Jesse anything...'
  const lang = navigator.language || 'en'
  const code = lang.slice(0, 2).toLowerCase()
  const hints: Record<string, string> = {
    en: 'Ask Jesse anything...',
    es: 'Pregunta a Jesse lo que quieras...',
    fr: 'Demandez n\'importe quoi a Jesse...',
    de: 'Frag Jesse alles...',
    ar: '...اسال جيسي اي شيء',
    zh: '\u95EE Jesse \u4EFB\u4F55\u95EE\u9898...',
    hi: 'Jesse \u0938\u0947 \u0915\u0941\u091B \u092D\u0940 \u092A\u0942\u091B\u0947\u0902...',
    pt: 'Pergunte qualquer coisa ao Jesse...',
    ja: 'Jesse\u306B\u4F55\u3067\u3082\u805E\u3044\u3066...',
    ko: 'Jesse\uC5D0\uAC8C \uBB50\uB4E0\uC9C0 \uBB3C\uC5B4\uBCF4\uC138\uC694...',
    ur: '...Jesse \u0633\u06D2 \u06A9\u0686\u06BE \u0628\u06BE\u06CC \u067E\u0648\u0686\u06BE\u06CC\u06BA',
  }
  return hints[code] || hints.en
}

/* ------------------------------------------------------------------ */
/* Utility: timestamp formatter                                       */
/* ------------------------------------------------------------------ */
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/* ------------------------------------------------------------------ */
/* Utility: simple markdown renderer                                  */
/* ------------------------------------------------------------------ */
function renderMarkdownLite(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Numbered list
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/)
    if (numberedMatch) {
      nodes.push(
        <div key={i} className="flex gap-2 ml-1 my-0.5">
          <span className="text-xs opacity-60 min-w-[1.2em] text-right">{numberedMatch[1]}.</span>
          <span>{applyInlineFormatting(numberedMatch[2])}</span>
        </div>
      )
      continue
    }

    // Bullet list
    const bulletMatch = line.match(/^[-*]\s+(.+)$/)
    if (bulletMatch) {
      nodes.push(
        <div key={i} className="flex gap-2 ml-1 my-0.5">
          <span className="text-xs opacity-60 mt-1">{'\u2022'}</span>
          <span>{applyInlineFormatting(bulletMatch[1])}</span>
        </div>
      )
      continue
    }

    // Regular line (preserve blank lines as spacing)
    if (line.trim() === '') {
      nodes.push(<div key={i} className="h-2" />)
    } else {
      nodes.push(<span key={i}>{applyInlineFormatting(line)}{i < lines.length - 1 ? '\n' : ''}</span>)
    }
  }

  return nodes
}

function applyInlineFormatting(text: string): React.ReactNode {
  // Match **bold** segments
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  if (parts.length === 1) return text

  return parts.map((part, idx) => {
    const boldMatch = part.match(/^\*\*(.+)\*\*$/)
    if (boldMatch) {
      return <strong key={idx} className="font-semibold">{boldMatch[1]}</strong>
    }
    return <span key={idx}>{part}</span>
  })
}

/* ------------------------------------------------------------------ */
/* Inline SVG Icons                                                   */
/* ------------------------------------------------------------------ */
function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
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
function UserBubble({ message, gradient }: { message: JesseMessage; gradient: string }) {
  return (
    <div className="flex justify-end mb-3">
      <div className="max-w-[80%] flex flex-col items-end">
        <div
          className={`rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words text-white bg-gradient-to-r ${gradient}`}
        >
          {message.content}
        </div>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 mr-1">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  )
}

function ActionCard({ action }: { action: CopilotActionResult }) {
  const isSuccess = action.result.success
  return (
    <div
      className={`mt-2 p-3 rounded-xl border ${
        isSuccess
          ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {isSuccess ? (
          <CheckCircleIcon className="w-4 h-4 text-green-500 dark:text-green-400" />
        ) : (
          <XCircleIcon className="w-4 h-4 text-red-500 dark:text-red-400" />
        )}
        <span
          className={`text-xs font-bold ${
            isSuccess ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}
        >
          {isSuccess ? 'Action Complete' : 'Action Failed'}
        </span>
        <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-auto font-mono">
          {action.action}
        </span>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        {action.result.message || action.result.error || 'No details'}
      </p>
    </div>
  )
}

function JesseBubble({ message, gradient }: { message: JesseMessage; gradient: string }) {
  return (
    <div className="flex justify-start mb-3 gap-2">
      <div
        className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm`}
      >
        <span className="text-white text-xs font-bold">J</span>
      </div>
      <div className="max-w-[80%] flex flex-col">
        <div className="rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
          {renderMarkdownLite(message.content)}
        </div>
        {message.actions && message.actions.length > 0 && (
          <div className="mt-1">
            {message.actions.map((a, i) => (
              <ActionCard key={`${a.action}-${i}`} action={a} />
            ))}
          </div>
        )}
        <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 ml-1">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  )
}

function TypingIndicator({ gradient }: { gradient: string }) {
  return (
    <div className="flex justify-start mb-3 gap-2" aria-live="polite" aria-label="Jesse is working">
      <div
        className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm`}
      >
        <span className="text-white text-xs font-bold">J</span>
      </div>
      <div className="rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:300ms]" />
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
          Jesse is working on it...
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */
export default function JesseAIWidget() {
  const pathname = usePathname()

  /* ---- state ---- */
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<JesseMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Voice state
  const [isListening, setIsListening] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female')

  /* ---- refs ---- */
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<unknown>(null)

  /* ---- derived from cookies ---- */
  const role: JesseRole = (Cookies.get('user_role') as JesseRole) || 'EMPLOYEE'
  const tenantId = Cookies.get('tenant_id') || ''

  const config = ROLE_CONFIG[role] || ROLE_CONFIG.EMPLOYEE
  const placeholderHint = useMemo(() => getPlaceholderHint(), [])

  /* ---- scroll ---- */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  /* ---- focus input on open ---- */
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setUnreadCount(0)
    }
  }, [isOpen])

  /* ---- load chat history on first open ---- */
  useEffect(() => {
    if (!isOpen || historyLoaded) return
    let cancelled = false

    async function loadHistory() {
      try {
        const data = await api.jesseChatHistory()
        if (!cancelled) {
          const mapped: JesseMessage[] = (data.history ?? []).map((m) => ({
            ...m,
            actions: undefined,
          }))
          setMessages(mapped)
          setHistoryLoaded(true)
        }
      } catch {
        if (!cancelled) {
          setHistoryLoaded(true)
        }
      }
    }

    loadHistory()
    return () => {
      cancelled = true
    }
  }, [isOpen, historyLoaded])

  /* ---- voice input (Web Speech API) ---- */
  const toggleListening = useCallback(() => {
    const win = window as unknown as Record<string, unknown>
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Voice input is not supported in this browser.')
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
    recognition.lang = typeof navigator !== 'undefined' ? navigator.language : 'en-US'

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

  /* ---- TTS voice output ---- */
  const speakReply = useCallback(
    async (text: string) => {
      if (!voiceEnabled) return
      try {
        const data = await api.jesseSpeakText(text, voiceGender)
        if (data.audioUrl) {
          const audio = new Audio(data.audioUrl)
          audio.play()
        }
      } catch {
        // Voice is optional; fail silently
      }
    },
    [voiceEnabled, voiceGender]
  )

  /* ---- send message ---- */
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

      if (!isOpen) {
        setUnreadCount((prev) => prev + 1)
      }
    } catch {
      setError(ERROR_MESSAGE)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: ERROR_MESSAGE,
          createdAt: new Date().toISOString(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, role, pathname, tenantId, speakReply, isOpen])

  /* ---- keyboard ---- */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  /* ---- toggle ---- */
  const togglePanel = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Jesse AI Chat"
          aria-modal="false"
          className="fixed bottom-20 right-4 w-[calc(100vw-2rem)] sm:w-[400px] h-[560px] max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden z-50 border border-gray-200 dark:border-gray-700"
          style={{ backdropFilter: 'blur(20px)' }}
        >
          {/* --- Header with glassmorphism --- */}
          <div
            className={`flex items-center justify-between px-4 py-3 bg-gradient-to-r ${config.gradient}`}
            style={{ backdropFilter: 'blur(12px)' }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <span className="text-white text-base font-bold">J</span>
              </div>
              <div>
                <h2 className="text-white text-sm font-semibold leading-tight">
                  {config.title}
                </h2>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                  <p className="text-white/80 text-[11px] leading-tight">
                    {config.subtitle}
                  </p>
                </div>
              </div>
            </div>

            {/* Header controls: voice toggle, gender toggle, close */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setVoiceEnabled((prev) => !prev)}
                className={`p-1.5 rounded-lg transition-all ${
                  voiceEnabled ? 'text-white bg-white/20' : 'text-white/40 hover:text-white/60'
                }`}
                title={voiceEnabled ? 'Mute Jesse voice' : 'Unmute Jesse voice'}
                aria-label={voiceEnabled ? 'Mute Jesse voice' : 'Unmute Jesse voice'}
              >
                {voiceEnabled ? <VolumeIcon /> : <VolumeMuteIcon />}
              </button>
              <button
                onClick={() =>
                  setVoiceGender((prev) => (prev === 'female' ? 'male' : 'female'))
                }
                className="p-1.5 rounded-lg text-white/70 hover:text-white transition-all hover:bg-white/10 text-xs"
                title={`Voice: ${voiceGender}`}
                aria-label={`Switch voice to ${voiceGender === 'female' ? 'male' : 'female'}`}
              >
                {voiceGender === 'female' ? '\u2640' : '\u2642'}
              </button>
              <button
                onClick={togglePanel}
                className="text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                aria-label="Close Jesse chat"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* --- Messages area --- */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3 bg-white/90 dark:bg-gray-900/90"
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
          >
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div
                  className={`w-16 h-16 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center mb-4 shadow-lg`}
                >
                  <span className="text-white text-2xl font-bold">J</span>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-[280px]">
                  {config.emptyGreeting}
                </p>
              </div>
            )}

            {messages.map((msg, idx) =>
              msg.role === 'user' ? (
                <UserBubble
                  key={`${msg.createdAt}-${idx}`}
                  message={msg}
                  gradient={config.gradient}
                />
              ) : (
                <JesseBubble
                  key={`${msg.createdAt}-${idx}`}
                  message={msg}
                  gradient={config.gradient}
                />
              )
            )}

            {isLoading && <TypingIndicator gradient={config.gradient} />}

            {error && !isLoading && (
              <p className="text-center text-xs text-red-500 mb-2" role="alert">
                {error}
              </p>
            )}

            <div ref={messagesEndRef} aria-hidden="true" />
          </div>

          {/* --- Input area --- */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2.5 bg-white/60 dark:bg-gray-900/60">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholderHint}
                rows={1}
                className={`flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm leading-relaxed placeholder:text-gray-400 focus:outline-none focus:ring-2 ${config.ringColor} focus:border-transparent max-h-24 overflow-y-auto`}
                aria-label="Type a message to Jesse"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={toggleListening}
                className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-500 animate-pulse'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={isListening ? 'Stop listening' : 'Voice input'}
                aria-label={isListening ? 'Stop listening' : 'Voice input'}
              >
                <MicIcon />
              </button>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={`flex-shrink-0 w-9 h-9 rounded-xl text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r ${config.gradient} hover:opacity-90`}
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">
              Shift+Enter for new line
            </p>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={togglePanel}
        className={`fixed bottom-4 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 z-50 ${
          isOpen
            ? 'bg-gray-500 hover:bg-gray-600 text-white'
            : `bg-gradient-to-br ${config.gradient} hover:opacity-90 text-white`
        }`}
        style={!isOpen ? { boxShadow: config.fabShadow } : undefined}
        aria-label={isOpen ? 'Close Jesse chat' : 'Open Jesse chat'}
        aria-expanded={isOpen}
        aria-controls="jesse-ai-panel"
      >
        {isOpen ? (
          <CloseIcon />
        ) : (
          <span className="text-xl font-bold">J</span>
        )}

        {/* Role badge on FAB */}
        {!isOpen && (
          <span className="absolute -top-1 -left-1 px-1.5 py-0.5 rounded-full bg-white dark:bg-gray-900 text-[9px] font-bold shadow-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
            {config.badge}
          </span>
        )}

        {/* Unread badge */}
        {!isOpen && unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-sm"
            aria-label={`${unreadCount} unread messages`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </>
  )
}
