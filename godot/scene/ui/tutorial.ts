/**
 * The tutorial of Glide Hockey in Godot: the web's script (`lib/tutorial.ts`) on the kit's panel.
 *
 * **It is learnt by doing**: each step is passed when whoever plays does it —the mallet in the
 * hand, the first hit on the puck, the first goal— and the game does not stop meanwhile. There is
 * always next and skip. The step **is worked out**, not stored (`tutorialStep` with what is done
 * and what is skipped): a tutorial that keeps its own count ends up disagreeing with the match.
 *
 * As on the web (`XRTutorial.tsx`), it comes up **with the headset on**, with the match in play
 * and the first time; in the hall's challenge, never (it is the same match for everyone).
 * `-- --tutorial` shows it flat, to look at it without a headset.
 */
import type { MandoEnLaMano } from '@kit/runtime/ui/tutorial'
import { PanelDeTutorial } from '@kit/runtime/ui/tutorial'
import type { PointerAim } from '@kit/runtime/ui/pointerAim'

import type { GrabMode, Lang } from '@/lib/settings'
import { PALETTE } from '@/lib/palette'
import { translator, type TextKey } from '@/lib/textos'
import {
  TUTORIAL_BUTTONS,
  TUTORIAL_STEPS,
  markTutorialSeen,
  tutorialSeen,
  tutorialStep,
  type TutorialMilestones,
  type TutorialStepKey,
} from '@/lib/tutorial'

import { DIM } from './menu'
import { TUTORIAL_SIZES } from './layout'

/** What is asked in each step (`PHRASES` of `XRTutorial.tsx`). */
export const PHRASES: Record<TutorialStepKey, TextKey> = {
  grab: 'Close your hand on the mallet to pick it up',
  hit: 'Push the puck with it',
  goal: 'Score a goal',
}

/** And with one tap instead of holding (`PHRASES_WITH_ONE_TAP`). */
export const PHRASES_WITH_ONE_TAP: Record<TutorialStepKey, TextKey> = {
  grab: 'Press the grip button on the mallet to pick it up',
  hit: 'Push the puck with it',
  goal: 'Score a goal',
}

export class GameTutorial {
  readonly view: PanelDeTutorial
  private skipped = 0
  private pending: boolean
  private painted: string | null = null
  /** Whether a step was being shown in the previous frame. */
  private wasTeaching = false

  constructor(aim: PointerAim, hands: readonly MandoEnLaMano[] = []) {
    // It is decided once, at the start: reading it every frame would turn it off as soon as it is marked.
    this.pending = !tutorialSeen()
    this.view = new PanelDeTutorial({
      rotulos: { next: 'Next', skip: 'Skip tutorial' },
      alSiguiente: () => this.skip(1),
      alSaltar: () => this.skip(TUTORIAL_STEPS.length),
      colores: {
        fondo: PALETTE.background,
        texto: PALETTE.foreground,
        suave: DIM,
        resaltado: PALETTE.primaryBright,
        boton: PALETTE.primary,
        tintaDelBoton: PALETTE.primaryInk,
      },
      manos: hands,
      medidas: TUTORIAL_SIZES,
    })
    aim.anadir(this.view.siguiente, this.view.saltar)
  }

  /** The step that applies with what is done, or `null` if none is left. */
  step(milestones: TutorialMilestones): TutorialStepKey | null {
    return this.pending ? tutorialStep(milestones, this.skipped) : null
  }

  private skip(count: number): void {
    this.skipped = Math.min(TUTORIAL_STEPS.length, this.skipped + count)
  }

  /** Shows it again even if it was already seen (`-- --tutorial`). */
  force(): void {
    this.pending = true
  }

  /**
   * A frame: if it is time to show it (`active`: playing, with a headset and not in a challenge),
   * the step of now; if not, out. When the steps end it is saved as seen.
   */
  update(active: boolean, milestones: TutorialMilestones, lang: Lang, grab: GrabMode, delta: number): TutorialState {
    const step = this.step(milestones)
    if (this.pending && step == null) {
      markTutorialSeen()
      this.pending = false
    }
    const teaching = active && step != null
    // It closes when it was showing and no step is left: by its milestones, «Siguiente» or «Saltar».
    // The match ending or leaving the headset (`active` false with a step) is not closing it.
    const closed = this.wasTeaching && step == null && active
    this.wasTeaching = teaching
    if (!teaching) {
      this.view.ocultar()
      this.painted = null
      return { teaching, closed }
    }
    const key = `${step}:${lang}:${grab}`
    if (key !== this.painted) {
      const t = translator(lang)
      const phrases = grab === 'toggle' ? PHRASES_WITH_ONE_TAP : PHRASES
      this.view.rotular({ next: t('Next'), skip: t('Skip tutorial') })
      this.view.mostrarPaso(TUTORIAL_STEPS.indexOf(step) + 1, TUTORIAL_STEPS.length, t(phrases[step]), TUTORIAL_BUTTONS[step])
      this.painted = key
    }
    this.view.actualizar(delta)
    return { teaching, closed }
  }
}

/** What the tutorial tells the match after a frame. */
export interface TutorialState {
  /** Whether a step is being shown: in the challenge, what the machine scores does not count. */
  readonly teaching: boolean
  /** Whether it has just been closed with the match running: the challenge starts from scratch. */
  readonly closed: boolean
}
