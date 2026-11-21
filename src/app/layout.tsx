import type { Metadata } from 'next'
import '@fontsource-variable/inter'
import '@fontsource-variable/manrope'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bauton LV — Ausschreibung & Kalkulation',
  description: 'Leistungsverzeichnisse prüfen, Preise vergleichen und Angebote erstellen.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>
}
