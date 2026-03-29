'use client'

import { useEffect, useState } from 'react'

export type Theme = 'cosmic' | 'ocean' | 'forest' | 'sunset'

const THEMES: { id: Theme; label: string; desc: string; cls: string }[] = [
  { id: 'cosmic', label: 'Cosmic',  desc: 'Deep space purple',    cls: 'theme-cosmic'  },
  { id: 'ocean',  label: 'Ocean',   desc: 'Electric teal-blue',   cls: 'theme-ocean'   },
  { id: 'forest', label: 'Forest',  desc: 'Vibrant emerald',      cls: 'theme-forest'  },
  { id: 'sunset', label: 'Sunset',  desc: 'Fiery orange-rose',    cls: 'theme-sunset'  },
]

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('cosmic')

  useEffect(() => {
    const saved = (localStorage.getItem('endevo-theme') as Theme) || 'cosmic'
    setThemeState(saved)
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem('endevo-theme', t)
    document.documentElement.setAttribute('data-theme', t)
  }

  return { theme, setTheme }
}

// Compact inline swatches for sidebars
export function ThemePickerInline() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      {THEMES.map(t => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          className={`theme-swatch ${t.cls} ${theme === t.id ? 'active' : ''}`}
          title={`${t.label} — ${t.desc}`}
        />
      ))}
    </div>
  )
}

// Full picker modal (for settings page)
export function ThemePickerFull() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="grid grid-cols-2 gap-3">
      {THEMES.map(t => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          className={`relative flex items-center gap-3 p-4 rounded-2xl border transition-all ${
            theme === t.id
              ? 'border-white/30 shadow-lg scale-[1.02]'
              : 'border-white/8 hover:border-white/20'
          }`}
          style={{ background: theme === t.id ? 'var(--gradient-card)' : 'var(--bg-elevated)' }}
        >
          <div className={`theme-swatch ${t.cls} flex-shrink-0 w-8 h-8 ${theme === t.id ? 'active' : ''}`} />
          <div className="text-left">
            <p className="text-sm font-semibold text-white">{t.label}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.desc}</p>
          </div>
          {theme === t.id && (
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white animate-pulse" />
          )}
        </button>
      ))}
    </div>
  )
}
