'use client'

import { useEffect, useState } from 'react'

export type Theme = 'eclipse' | 'canvas' | 'neon' | 'navy-neon' | 'compassion'

const THEMES: { id: Theme; label: string; desc: string; preview: string }[] = [
  {
    id: 'eclipse',
    label: 'Eclipse',
    desc: 'Dark • Linear-style',
    preview: 'linear-gradient(135deg, #0F0F10 50%, #5E6AD2 50%)',
  },
  {
    id: 'canvas',
    label: 'Canvas',
    desc: 'Light • Notion-style',
    preview: 'linear-gradient(135deg, #FFFFFF 50%, #487CA5 50%)',
  },
  {
    id: 'neon',
    label: 'Neon',
    desc: 'Vibrant • Duolingo-style',
    preview: 'linear-gradient(135deg, #0A0A0A 40%, #58CC02 70%, #FF6B35 100%)',
  },
  {
    id: 'navy-neon',
    label: 'Navy Neon',
    desc: 'Navy + Orange • Endevo',
    preview: 'linear-gradient(135deg, #0A0E1A 40%, #FF8C00 70%, #3B82F6 100%)',
  },
  {
    id: 'compassion',
    label: 'Compassion',
    desc: 'Calming • Bereavement',
    preview: 'linear-gradient(135deg, #F5F0EB 50%, #8B7355 50%)',
  },
]

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('eclipse')

  useEffect(() => {
    const saved = (localStorage.getItem('endevo-theme') as Theme) || 'eclipse'
    applyTheme(saved)
    setThemeState(saved)
  }, [])

  function applyTheme(t: Theme) {
    document.documentElement.setAttribute('data-theme', t)
    document.documentElement.classList.toggle('light-mode', t === 'canvas' || t === 'compassion')
  }

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem('endevo-theme', t)
    applyTheme(t)
  }

  return { theme, setTheme }
}

// Compact sidebar picker — 3 small squares, drag not needed, auto-applies
export function ThemePickerInline() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="px-3 pb-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2"
        style={{ color: 'var(--text-muted)' }}>Theme</p>
      <div className="flex items-center gap-2">
        {THEMES.map(t => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            title={`${t.label} — ${t.desc}`}
            className="flex flex-col items-center gap-1 group"
          >
            {/* Square preview swatch */}
            <div
              className="w-8 h-8 rounded-lg transition-all duration-200"
              style={{
                background: t.preview,
                outline: theme === t.id ? '2px solid white' : '2px solid transparent',
                outlineOffset: '2px',
                transform: theme === t.id ? 'scale(1.1)' : 'scale(1)',
                boxShadow: theme === t.id ? '0 0 12px rgba(255,255,255,0.25)' : 'none',
              }}
            />
            <span className="text-[9px] font-medium transition-colors"
              style={{ color: theme === t.id ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Full picker for settings page
export function ThemePickerFull() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="grid grid-cols-3 gap-4">
      {THEMES.map(t => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          className="relative rounded-2xl overflow-hidden transition-all duration-300 text-left"
          style={{
            border: `2px solid ${theme === t.id ? 'white' : 'var(--border-subtle)'}`,
            transform: theme === t.id ? 'scale(1.03)' : 'scale(1)',
            boxShadow: theme === t.id ? '0 0 24px rgba(255,255,255,0.15)' : 'none',
          }}
        >
          {/* Big preview */}
          <div className="h-20 w-full" style={{ background: t.preview }} />
          <div className="p-3" style={{ background: 'var(--bg-elevated)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.desc}</p>
              </div>
              {theme === t.id && (
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                  <span className="text-black text-xs font-black">✓</span>
                </div>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
