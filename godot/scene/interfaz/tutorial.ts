/**
 * El tutorial de Glide Hockey en Godot: el guion de la web (`lib/tutorial.ts`) en el panel del kit.
 *
 * **Se aprende haciendo**: cada paso se supera cuando quien juega lo hace —el mazo en la mano, el
 * primer golpe al disco, el primer gol— y el juego no se para mientras tanto. Siempre hay
 * siguiente y saltar. El paso **se calcula**, no se guarda (`tutorialStep` con lo hecho y lo
 * saltado): un tutorial que lleva su propia cuenta acaba discrepando de la partida.
 *
 * Como en la web (`XRTutorial.tsx`), sale **con el visor puesto**, con la partida en juego y la
 * primera vez; en el reto del salón, nunca (es la misma partida para todos). `-- --tutorial` lo
 * enseña en plano, para mirarlo sin visor.
 */
import type { MandoEnLaMano } from '@kit/runtime/ui/tutorial'
import { PanelDeTutorial } from '@kit/runtime/ui/tutorial'
import type { Punteria } from '@kit/runtime/ui/punteria'

import type { GrabMode, Lang } from '@/lib/ajustes'
import { PALETTE } from '@/lib/palette'
import { traductor, type TextKey } from '@/lib/textos'
import {
  TUTORIAL_BUTTONS,
  TUTORIAL_STEPS,
  markTutorialSeen,
  tutorialSeen,
  tutorialStep,
  type TutorialHitos,
  type TutorialStepKey,
} from '@/lib/tutorial'

import { DIM } from './menu'

/** Lo que se pide en cada paso (`FRASES` de `XRTutorial.tsx`). */
export const FRASES: Record<TutorialStepKey, TextKey> = {
  grab: 'Close your hand on the mallet to pick it up',
  hit: 'Push the puck with it',
  goal: 'Score a goal',
}

/** Y con un toque en vez de manteniendo (`FRASES_CON_UN_TOQUE`). */
export const FRASES_CON_UN_TOQUE: Record<TutorialStepKey, TextKey> = {
  grab: 'Press the grip button on the mallet to pick it up',
  hit: 'Push the puck with it',
  goal: 'Score a goal',
}

export class TutorialDelJuego {
  readonly vista: PanelDeTutorial
  private saltados = 0
  private pendiente: boolean
  private pintado: string | null = null

  constructor(punteria: Punteria, manos: readonly MandoEnLaMano[] = []) {
    // Se decide una vez, al empezar: leerlo a cada fotograma lo apagaría en cuanto se marca.
    this.pendiente = !tutorialSeen()
    this.vista = new PanelDeTutorial({
      rotulos: { next: 'Next', skip: 'Skip tutorial' },
      alSiguiente: () => this.saltar(1),
      alSaltar: () => this.saltar(TUTORIAL_STEPS.length),
      colores: {
        fondo: PALETTE.background,
        texto: PALETTE.foreground,
        suave: DIM,
        resaltado: PALETTE.primaryBright,
        boton: PALETTE.primary,
        tintaDelBoton: PALETTE.primaryInk,
      },
      manos,
    })
    punteria.anadir(this.vista.siguiente, this.vista.saltar)
  }

  /** El paso que toca con lo hecho, o `null` si ya no queda ninguno. */
  paso(hitos: TutorialHitos): TutorialStepKey | null {
    return this.pendiente ? tutorialStep(hitos, this.saltados) : null
  }

  private saltar(cuantos: number): void {
    this.saltados = Math.min(TUTORIAL_STEPS.length, this.saltados + cuantos)
  }

  /** Vuelve a enseñarlo aunque ya se viera (`-- --tutorial`). */
  forzar(): void {
    this.pendiente = true
  }

  /**
   * Un fotograma: si toca enseñarlo (`activo`: jugando, con visor y no en un reto), el paso de
   * ahora; si no, fuera. Al acabar los pasos se guarda como visto.
   */
  actualizar(activo: boolean, hitos: TutorialHitos, lang: Lang, agarre: GrabMode, delta: number): void {
    const paso = this.paso(hitos)
    if (this.pendiente && paso == null) {
      markTutorialSeen()
      this.pendiente = false
    }
    if (!activo || paso == null) {
      this.vista.ocultar()
      this.pintado = null
      return
    }
    const clave = `${paso}:${lang}:${agarre}`
    if (clave !== this.pintado) {
      const t = traductor(lang)
      const frases = agarre === 'toggle' ? FRASES_CON_UN_TOQUE : FRASES
      this.vista.rotular({ next: t('Next'), skip: t('Skip tutorial') })
      this.vista.mostrarPaso(TUTORIAL_STEPS.indexOf(paso) + 1, TUTORIAL_STEPS.length, t(frases[paso]), TUTORIAL_BUTTONS[paso])
      this.pintado = clave
    }
    this.vista.actualizar(delta)
  }
}
