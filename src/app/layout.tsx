import type { Metadata, Viewport } from 'next'
import { Orbitron, Inter } from 'next/font/google'
import { PALETTE } from '@/lib/palette'
import './globals.css'
import { idiomaDeLaPeticion } from '../lib/idioma-servidor'

const orbitron = Orbitron({
  variable: '--font-heading',
  subsets: ['latin'],
  weight: ['600', '700'],
})

const inter = Inter({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Air Hockey — you against the machine',
  description:
    'Air hockey against the machine: choose the level and the goals to play to, and put the puck in its net. Play in the browser or in mixed reality (VR/AR).',
}

export const viewport: Viewport = {
  themeColor: PALETTE.background,
  width: 'device-width',
  initialScale: 1,
  // Sin `maximumScale`: bloquear el zoom incumple WCAG 1.4.4 y deja fuera a
  // quien necesita ampliar para leer el menú.
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // El idioma sale de la cookie que pone el menú del arcade: el `lang` del
  // documento es lo que usan los lectores de pantalla para elegir voz, así
  // que tiene que decir en qué idioma está lo que hay dentro.
  const lang = await idiomaDeLaPeticion()

  return (
    <html lang={lang} className={`${orbitron.variable} ${inter.variable}`}>
      {/* El azul oscuro del juego desde el primer píxel: sin él la página
          destella en blanco mientras se monta la escena. */}
      <body
        style={{ background: PALETTE.background, color: PALETTE.foreground }}
      >
        {children}
      </body>
    </html>
  )
}
