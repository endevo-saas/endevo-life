'use client'

import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react'
import { api, type JesseChatMessage } from '@/lib/api'

const EMPTY_STATE_MESSAGE =
  "Hi! I'm Jesse, your Legacy Readiness Guide. Ask me anything about your legacy planning journey."

const ERROR_MESSAGE =
  "Sorry, I couldn't process that. Please try again."

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

interface ChatBubbleProps {
  message: JesseChatMessage
}

function UserBubble({ message }: ChatBubbleProps) {
  return (
    <div className="flex justify-end mb-3">
      <div className="max-w-[80%] flex flex-col items-end">
        <div className="rounded-2xl rounded-br-md bg-orange-500 text-white px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </div>
        <span className="text-[10px] text-gray-400 mt-1 mr-1">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  )
}

function JesseBubble({ message }: ChatBubbleProps) {
  return (
    <div className="flex justify-start mb-3 gap-2">
      <div
        className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm"
        aria-hidden="true"
      >
        <span className="text-white text-xs font-bold">J</span>
      </div>
      <div className="max-w-[80%] flex flex-col">
        <div className="rounded-2xl rounded-bl-md bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </div>
        <span className="text-[10px] text-gray-400 mt-1 ml-1">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3 gap-2" aria-live="polite" aria-label="Jesse is typing">
      <div
        className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm"
        aria-hidden="true"
      >
        <span className="text-white text-xs font-bold">J</span>
      </div>
      <div className="rounded-2xl rounded-bl-md bg-gray-100 dark:bg-gray-800 px-4 py-3 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )
}

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-7 h-7"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M4.804 21.644A6.707 6.707 0 0 0 6 21.75a6.721 6.721 0 0 0 3.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 0 1-.814 1.686.75.75 0 0 0 .44 1.223ZM8.25 10.875a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25ZM10.875 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CrownIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-7 h-7"
      aria-hidden="true"
    >
      <path d="M2 19h20v2H2v-2zm1.5-7.5L6 14l4.5-6L12 11l1.5-3L18 14l2.5-2.5L19 18H5l-1.5-6.5z" />
    </svg>
  )
}

export default function JesseChatWindow() {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [showUpgradeTooltip, setShowUpgradeTooltip] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<JesseChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Check premium access on mount
  useEffect(() => {
    let cancelled = false
    async function checkAccess() {
      try {
        const data = await api.jesseAccess()
        if (!cancelled) {
          setHasAccess(data.hasAccess)
        }
      } catch {
        // Fail-open: if we can't check, assume access
        if (!cancelled) {
          setHasAccess(true)
        }
      }
    }
    checkAccess()
    return () => { cancelled = true }
  }, [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Auto-scroll when messages change or loading state changes
  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setUnreadCount(0)
    }
  }, [isOpen])

  // Load history on first open
  useEffect(() => {
    if (!isOpen || historyLoaded) return

    let cancelled = false

    async function loadHistory() {
      try {
        const data = await api.jesseChatHistory()
        if (!cancelled) {
          setMessages(data.history ?? [])
          setHistoryLoaded(true)
        }
      } catch {
        if (!cancelled) {
          setHistoryLoaded(true)
        }
      }
    }

    loadHistory()
    return () => { cancelled = true }
  }, [isOpen, historyLoaded])

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    setError(null)
    setInput('')

    const userMessage: JesseChatMessage = {
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    }

    // Optimistic update
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      const data = await api.jesseChat(trimmed)

      const assistantMessage: JesseChatMessage = {
        role: 'assistant',
        content: data.reply,
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])

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
  }, [input, isLoading, isOpen])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const togglePanel = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  // Loading state — render nothing
  if (hasAccess === null) {
    return null
  }

  // No access — show upgrade FAB
  if (!hasAccess) {
    return (
      <>
        {showUpgradeTooltip && (
          <div className="fixed bottom-20 right-4 w-72 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 z-50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <span className="text-white text-sm font-bold">J</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Jesse AI — Premium Feature
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Jesse AI is available on the Premium plan. Ask your employer to upgrade.
            </p>
            <button
              onClick={() => setShowUpgradeTooltip(false)}
              className="mt-3 w-full text-xs text-center text-purple-600 dark:text-purple-400 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <button
          onClick={() => setShowUpgradeTooltip((prev) => !prev)}
          className="fixed bottom-4 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 z-50 bg-gradient-to-br from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white"
          aria-label="Jesse AI — Premium plan required"
        >
          <CrownIcon />
        </button>
      </>
    )
  }

  // Has access — render full chat
  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Jesse AI Chat"
          aria-modal="false"
          className="fixed bottom-20 right-4 w-[calc(100vw-2rem)] sm:w-96 h-[500px] max-h-[80vh] flex flex-col rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 backdrop-blur-xl bg-white/90 dark:bg-gray-900/90"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-500 to-amber-500">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-white text-sm font-bold">J</span>
              </div>
              <div>
                <h2 className="text-white text-sm font-semibold leading-tight">
                  Jesse
                </h2>
                <p className="text-white/80 text-[11px] leading-tight">
                  Your Legacy Guide
                </p>
              </div>
            </div>
            <button
              onClick={togglePanel}
              className="text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              aria-label="Close chat"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3"
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
          >
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-white text-2xl font-bold">J</span>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-[260px]">
                  {EMPTY_STATE_MESSAGE}
                </p>
              </div>
            )}

            {messages.map((msg, idx) =>
              msg.role === 'user' ? (
                <UserBubble key={`${msg.createdAt}-${idx}`} message={msg} />
              ) : (
                <JesseBubble key={`${msg.createdAt}-${idx}`} message={msg} />
              )
            )}

            {isLoading && <TypingIndicator />}

            {error && !isLoading && (
              <p className="text-center text-xs text-red-500 mb-2" role="alert">
                {error}
              </p>
            )}

            <div ref={messagesEndRef} aria-hidden="true" />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2.5 bg-white/60 dark:bg-gray-900/60">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Jesse anything..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm leading-relaxed placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent max-h-24 overflow-y-auto"
                aria-label="Type a message to Jesse"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="flex-shrink-0 w-9 h-9 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
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
            ? 'bg-gray-500 hover:bg-gray-600 rotate-0'
            : 'bg-orange-500 hover:bg-orange-600 animate-pulse hover:animate-none'
        }`}
        aria-label={isOpen ? 'Close Jesse chat' : 'Open Jesse chat'}
        aria-expanded={isOpen}
        aria-controls="jesse-chat-panel"
      >
        {isOpen ? <CloseIcon /> : <ChatIcon />}

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
