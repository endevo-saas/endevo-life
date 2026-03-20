import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Endevo Life — Digital Legacy Platform',
  description: 'Enterprise digital legacy and estate planning for corporate HR teams',
  icons: { icon: '/favicon.ico' },
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
