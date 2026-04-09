'use client'

import { useEffect, useState } from 'react'

export type Theme = 'luminous' | 'enterprise' | 'horizon' | 'sanctuary'

const THEMES: { id: Theme; label: string; desc: string; preview: string; light: boolean }[] = [
  {
    id: 'luminous',
    label: 'Luminous AI',
    desc: 'Modern • Gemini-inspired',
    preview: 'linear-gradient(135deg, #FAFAFA 30%, #8B5CF6 60%, #3B82F6 100%)',
    light: true,
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    desc: 'Professional • Stripe-grade',
    preview: 'linear-gradient(135deg, #F8FAFC 50%, #2563EB 50%)',
    light: true,
  },
  {
    id: 'horizon',
    label: 'Horizon',
    desc: 'Dark • Endevo brand',
    preview: 'linear-gradient(135deg, #020617 40%, #F97316 70%, #3B82F6 100%)',
    light: false,
  },
  {
    id: 'sanctuary',
    label: 'Sanctuary',
    desc: 'Warm • Compassion mode',
    preview: 'linear-gradient(135deg, #FAF7F2 50%, #78716C 50%)',
    light: true,
  },
]

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('luminous')

  useEffect(() => {
    const saved = localStorage.getItem('endevo-theme') as Theme
    // Migrate old theme names to new ones
    const migrated = migrateTheme(saved)
    applyTheme(migrated)
    setThemeState(migrated)
  }, [])

  function migrateTheme(t: string | null): Theme {
    // Map old theme names to new ones
    const map: Record<string, Theme> = {
      'eclipse': 'horizon',
      'canvas': 'enterprise',
      'neon': 'luminous',
      'navy-neon': 'horizon',
      'compassion': 'sanctuary',
    }
    if (!t) return 'luminous'
    return map[t] || (THEMES.find(th => th.id === t) ? t as Theme : 'luminous')
  }

  function applyTheme(t: Theme) {
    const themeObj = THEMES.find(th => th.id === t)
    document.documentElement.setAttribute('data-theme', t)
    document.documentElement.classList.toggle('light-mode', themeObj?.light ?? true)
  }

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem('endevo-theme', t)
    applyTheme(t)
  }

  return { theme, setTheme }
}

// Compact sidebar picker — 4 swatches
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
            <div
              className="w-8 h-8 rounded-lg transition-all duration-200"
              style={{
                background: t.preview,
                outline: theme === t.id ? '2px solid var(--accent-1)' : '2px solid transparent',
                outlineOffset: '2px',
                transform: theme === t.id ? 'scale(1.1)' : 'scale(1)',
                boxShadow: theme === t.id ? '0 0 12px var(--accent-glow)' : 'none',
              }}
            />
            <span className="text-[9px] font-medium transition-colors"
              style={{ color: theme === t.id ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {t.label.split(' ')[0]}
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {THEMES.map(t => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          className="relative rounded-2xl overflow-hidden transition-all duration-300 text-left"
          style={{
            border: `2px solid ${theme === t.id ? 'var(--accent-1)' : 'var(--border-subtle)'}`,
            transform: theme === t.id ? 'scale(1.03)' : 'scale(1)',
            boxShadow: theme === t.id ? '0 0 20px var(--accent-glow)' : 'none',
          }}
        >
          <div className="h-20 w-full" style={{ background: t.preview }} />
          <div className="p-3" style={{ background: 'var(--bg-elevated)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.desc}</p>
              </div>
              {theme === t.id && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--accent-1)' }}>
                  <span className="text-white text-xs font-black">✓</span>
                </div>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
