'use client'

import { useEffect } from 'react'
import Cookies from 'js-cookie'

/**
 * CompassionGuard — Auto-switches to Compassion Mode when:
 * 1. User role is DELEGATE or BENEFICIARY
 * 2. URL contains /delegate/ or /beneficiary/ or /vault/
 * 3. A sanctuary_mode cookie is set
 *
 * This ensures bereavement contexts never show gamified/vibrant themes.
 * Strips confetti, neon, and bright colors automatically.
 */
export default function CompassionGuard() {
  useEffect(() => {
    const role = Cookies.get('user_role') || ''
    const path = window.location.pathname
    const sanctuaryCookie = Cookies.get('sanctuary_mode')

    const isDelegate = ['DELEGATE', 'BENEFICIARY'].includes(role.toUpperCase())
    const isBereavementPath = /\/(delegate|beneficiary|vault|memorial)/.test(path)
    const isForcedCompassion = sanctuaryCookie === 'true'

    if (isDelegate || isBereavementPath || isForcedCompassion) {
      const currentTheme = localStorage.getItem('endevo-theme')
      // Save original theme so it can be restored
      if (currentTheme && currentTheme !== 'sanctuary') {
        localStorage.setItem('endevo-theme-before-sanctuary', currentTheme)
      }
      document.documentElement.setAttribute('data-theme', 'sanctuary')
      document.documentElement.classList.add('light-mode')
      localStorage.setItem('endevo-theme', 'sanctuary')
    }
  }, [])

  return null
}
