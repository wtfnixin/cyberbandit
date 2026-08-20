import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cyberbandit',
  description: 'Cybersecurity Terminal CTF'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
