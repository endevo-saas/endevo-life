import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ENDevo — Legacy Readiness OS | Plan. Protect. Peace.',
  description: 'Enterprise digital legacy and estate planning for corporate HR teams. AI-powered readiness assessment across Legal, Financial, Physical, and Digital domains.',
  icons: { icon: '/jesse/logo.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-animated min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
