import type { Metadata } from 'next'
import '@fontsource-variable/manrope/wght.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'BauMind — Intelligent Construction Estimation',
  description: 'Naturally intelligent construction estimation and tender analysis.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>
}
