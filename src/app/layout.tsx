import type { Metadata, Viewport } from 'next'
import { Orbitron, Inter } from 'next/font/google'
import { PALETTE } from '@/lib/palette'
import './globals.css'
import { idiomaDeLaPeticion } from '../lib/idioma-servidor'
import { nombreDelJuego } from '../lib/plantillaDelMenu'
import { traductor } from '../lib/textos'

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

/**
 * Lo que dice la pestaña y lo que se lee al compartir el enlace, en el idioma del arcade.
 *
 * Es una función y no una constante porque el idioma llega en la cookie de la petición
 * (ver `lib/ajustes.ts`), y eso solo se puede leer aquí dentro.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = traductor(await idiomaDeLaPeticion())

  return {
    // El nombre no se traduce —es el de la cabina (`nombreDelJuego`), el mismo en el salón y en
    // la tienda—; lo que le sigue sí, que es lo que dice de qué va.
    title: t('{name} — you against the machine', { name: nombreDelJuego() }),
    description: t(
      '{name} against the machine: choose the level and the goals to play to, and put the puck in its net. Play in the browser or in mixed reality (VR/AR).',
      { name: nombreDelJuego() },
    ),
  }
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
