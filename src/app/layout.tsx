import type { Metadata, Viewport } from 'next'
import { Orbitron, Inter } from 'next/font/google'
import { PALETTE } from '@/lib/palette'
import './globals.css'

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
  title: 'Air Hockey — tú contra la máquina',
  description:
    'Air hockey contra la máquina: elige nivel y a cuántos goles se juega, y cuela el disco en su portería. Juega en navegador o en realidad mixta (VR/AR).',
}

export const viewport: Viewport = {
  themeColor: PALETTE.background,
  width: 'device-width',
  initialScale: 1,
  // Sin `maximumScale`: bloquear el zoom incumple WCAG 1.4.4 y deja fuera a
  // quien necesita ampliar para leer el menú.
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${orbitron.variable} ${inter.variable}`}>
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
