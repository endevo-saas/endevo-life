'use client'

/**
 * AmbientMesh — Animated mesh gradient background
 *
 * Renders slow-moving, blurred color orbs behind the page content.
 * Active on Luminous AI and Horizon themes (via CSS --mesh-1/2/3 vars).
 * Transparent/hidden on Enterprise and Sanctuary themes.
 *
 * Performance: CSS-only animation, hardware-accelerated (will-change: transform),
 * respects prefers-reduced-motion, zero JS overhead.
 */
export default function AmbientMesh() {
  return (
    <div className="ambient-mesh" aria-hidden="true">
      <div className="mesh-orb" />
    </div>
  )
}
