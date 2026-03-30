'use client'

import { useEffect, useState } from 'react'

export type Theme = 'cosmic' | 'ocean' | 'forest' | 'sunset' | 'pearl' | 'dawn'

const THEMES: { id: Theme; label: string; desc: string; cls: string; dark: boolean }[] = [
  // ── Dark themes ──
  { id: 'cosmic', label: 'Cosmic',  desc: 'Deep space purple',  cls: 'theme-cosmic',  dark: true  },
  { id: 'ocean',  label: 'Ocean',   desc: 'Electric teal-blue', cls: 'theme-ocean',   dark: true  },
  { id: 'forest', label: 'Forest',  desc: 'Vibrant emerald',    cls: 'theme-forest',  dark: true  },
  { id: 'sunset', label: 'Sunset',  desc: 'Fiery rose-orange',  cls: 'theme-sunset',  dark: true  },
  // ── Light themes ──
  { id: 'pearl',  label: 'Pearl',   desc: 'Clean white light',  cls: 'theme-pearl',   dark: false },
  { id: 'dawn',   label: 'Dawn',    desc: 'Warm cream & gold',  cls: 'theme-dawn',    dark: false },
]

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('cosmic')

  useEffect(() => {
    const saved = (localStorage.getItem('endevo-theme') as Theme) || 'cosmic'
    applyTheme(saved)
    setThemeState(saved)
  }, [])

  function applyTheme(t: Theme) {
    document.documentElement.setAttribute('data-theme', t)
    // Toggle dark/light class on body for Tailwind
    const isLight = t === 'pearl' || t === 'dawn'
    document.documentElement.classList.toggle('light-mode', isLight)
  }

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem('endevo-theme', t)
    applyTheme(t)
  }

  return { theme, setTheme }
}

// Compact inline swatches for sidebars — 2 rows: dark | light
export function ThemePickerInline() {
  const { theme, setTheme } = useTheme()
  const dark  = THEMES.filter(t => t.dark)
  const light = THEMES.filter(t => !t.dark)

  return (
    <div className="px-3 py-1.5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        {dark.map(t => (
          <button key={t.id} onClick={() => setTheme(t.id)}
            className={`theme-swatch ${t.cls} ${theme === t.id ? 'active' : ''}`}
            title={`${t.label} — ${t.desc}`} />
        ))}
        <div className="w-px h-4 mx-0.5" style={{ background: 'var(--border-subtle)' }} />
        {light.map(t => (
          <button key={t.id} onClick={() => setTheme(t.id)}
            className={`theme-swatch ${t.cls} ${theme === t.id ? 'active' : ''}`}
            title={`${t.label} — ${t.desc}`} />
        ))}
      </div>
      <p className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>
        {THEMES.find(t => t.id === theme)?.label} theme active
      </p>
    </div>
  )
}

// Full picker for Settings page
export function ThemePickerFull() {
  const { theme, setTheme } = useTheme()
  const dark  = THEMES.filter(t => t.dark)
  const light = THEMES.filter(t => !t.dark)

  function Section({ label, items }: { label: string; items: typeof THEMES }) {
    return (
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <div className="grid grid-cols-2 gap-3">
          {items.map(t => (
            <button key={t.id} onClick={() => setTheme(t.id)}
              className={`relative flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                theme === t.id ? 'scale-[1.02]' : 'hover:scale-[1.01]'
              }`}
              style={{
                background: theme === t.id ? 'var(--gradient-card)' : 'var(--bg-elevated)',
                border: `1px solid ${theme === t.id ? 'var(--accent-1)' : 'var(--border-subtle)'}`,
                boxShadow: theme === t.id ? '0 0 16px var(--accent-glow)' : 'none',
              }}>
              <div className={`theme-swatch ${t.cls} flex-shrink-0 w-9 h-9 rounded-xl ${theme === t.id ? 'active' : ''}`} />
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.desc}</p>
              </div>
              {theme === t.id && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse"
                  style={{ background: 'var(--accent-1)' }} />
              )}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Section label="Dark Themes" items={dark} />
      <Section label="Light Themes" items={light} />
    </div>
  )
}
