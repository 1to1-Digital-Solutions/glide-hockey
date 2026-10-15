import type { Metadata, Viewport } from 'next'
import { Orbitron, Inter } from 'next/font/google'
import { PALETTE } from '@/lib/palette'
import './globals.css'
import { requestLang } from '../lib/server-lang'
import { gameName } from '../lib/menuTemplate'
import { translator } from '../lib/textos'

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
 * What the tab says and what is read when the link is shared, in the hall's language.
 *
 * It is a function and not a constant because the language arrives in the request's cookie
 * (see `lib/settings.ts`), and that can only be read in here.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = translator(await requestLang())

  return {
    // The name is not translated —it is the cabinet's (`gameName`), the same in the hall and in
    // the store—; what follows it is, since that is what says what the game is about.
    title: t('{name} — you against the machine', { name: gameName() }),
    description: t(
      '{name} against the machine: choose the level and the goals to play to, and put the puck in its net. Play in the browser or in mixed reality (VR/AR).',
      { name: gameName() },
    ),
  }
}


export const viewport: Viewport = {
  themeColor: PALETTE.background,
  width: 'device-width',
  initialScale: 1,
  // No `maximumScale`: blocking zoom breaks WCAG 1.4.4 and shuts out anyone
  // who needs to zoom in to read the menu.
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // The language comes from the cookie the hall's menu sets: the document's
  // `lang` is what screen readers use to pick a voice, so it has to say
  // which language its contents are in.
  const lang = await requestLang()

  return (
    <html lang={lang} className={`${orbitron.variable} ${inter.variable}`}>
      {/* The game's dark blue from the first pixel: without it the page
          flashes white while the scene mounts. */}
      <body
        style={{ background: PALETTE.background, color: PALETTE.foreground }}
      >
        {children}
      </body>
    </html>
  )
}
