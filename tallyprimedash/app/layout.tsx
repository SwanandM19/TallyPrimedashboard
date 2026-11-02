import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cashflow | Mantri Constructions',
  description: 'Edit and submit OPPL, Prerana, PPPL, MCPL, APEX and RA cashflow statements.',
  openGraph: {
    title: 'Cashflow | Mantri Constructions',
    description: 'Edit and submit six cashflow statements for Mantri Constructions.',
    type: 'website',
  },
  twitter: { card: 'summary' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
