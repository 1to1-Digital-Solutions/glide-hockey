/**
 * The interface of Glide Hockey in Godot, measured with the web's instrument and pressed with the mouse.
 *
 * **Measured with the same thing as the web**: the panels here record what they write with the
 * engine's font (`panel.escritos`) and go through the web's guardians —`legibility.ts` (nothing
 * overlaps or runs off, no text below what can be read at its distance), `panelReading.ts` (each
 * text in its row and with the foreshortening, from where it is played with the headset, at three
 * eye heights and with the world standing or at their height) and `exitCorner.ts` (the exit, bottom
 * right)—, with the column at the scale it is painted at, like `menu.legible.test.ts`. In both
 * languages and in every mode.
 *
 * **Pressed with the mouse**: the whole interface mounted with a real camera and the clicks through
 * the same `MousePointer` as when flat: the menu leads to playing, stop asks, the notice goes back
 * or leaves, and the end plays again or goes back to the menu.
 *
 * It runs inside the engine, with the domain tests (`npm run godot:build -- --tests`).
 */
import { Camera3D, Engine, InputEventMouseButton, InputEventMouseMotion, MouseButton, Node, Node3D, OS, SceneTree, Vector2, Vector3 } from 'godot'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { MIN_ANGLE, legibilityProblems } from '@kit/lib/ui/legibility'
import { LINE_HEIGHT, approximateMeasurer, type Escrito, drawnTexts } from '@kit/lib/ui/text'
import { PANEL_DEL_TUTORIAL } from '@kit/lib/ui/tutorial'
import { Sfx } from '@kit/runtime/sfx'
import { PointerAim } from '@kit/runtime/ui/pointerAim'

import { LANGS, VOLUME_KEYS } from '@/lib/settings'
import { signRun, signPlacement, type GameInPlay } from '@/lib/scoreboardSign'
import { COUNTDOWN_SECONDS, DIFFICULTY_ORDER } from '@/lib/gameConfig'
import { GAME_MODE_ORDER, type GameMode } from '@/lib/gameMode'
import { exitProblems } from '@/lib/exitCorner'
import { panelPoints, whatThePanelHides } from '@/lib/panelOcclusion'
import { sizesOffList, textsOnButtons, unreadableTexts, worstReadingDistance, type PanelPose } from '@/lib/panelReading'
import { gameStorage } from '@/lib/storage'
import { goalSign, type Goal, type GoalSignView } from '@/lib/goal'
import { translator, softTranslator } from '@/lib/textos'
import { TUTORIAL_STEPS } from '@/lib/tutorial'
import { REFERENCE_EYE_HEIGHT } from '@/lib/uiHeight'
import { MENU_DEGREES, degreesFromFront, gameName } from '@/lib/menuTemplate'
import { MENU_PANEL, MENU_ROW, MENU_TEXT, menuPlacement } from '@/lib/xrMenuLayout'

import { LANG_KEY, currentLang, volumeLevels } from '@kit/runtime/settings'
import { COMFORT_KEY, currentComfort } from './comfort'
import { ExitNotice } from './notice'
import { SignPanel } from './sign'
import { GameOverPanel, DUEL_TEXT, GAME_OVER_TEXT } from './gameOver'
import { GameUi } from './ui'
import { Countdown } from './scoreboard'
import { GameMenu, type MenuState } from './menu'
import { Match, type DuelView } from './match'
import {
  CONFIRM_SIZE,
  MALLET_NOTICE,
  GAME_OVER_BOXES,
  SIGN,
  SCOREBOARD_ROWS,
  SCOREBOARD_SIZE,
  SIGN_PLACEMENT,
  COLUMN_SCALE,
  TUTORIAL_SIZES,
  SIGN_PROPORTION,
  FLAT_TUTORIAL,
  fromPlayerSpace,
  GAME_OVER_SIZE,
  MALLET_TEXT,
  CONFIRM_TEXT,
  XR_UI,
  XR_UI_ROTATION,
  atColumnScale,
  panelViews,
} from './layout'
import { PHRASES, PHRASES_WITH_ONE_TAP, GameTutorial } from './tutorial'

/**
 * What the web measures of a panel: that nothing overlaps or runs off at the distance at which it
 * reads worst, and that each text gets there from each view. `k` is the scale it is painted at.
 */
function measure(
  texts: readonly Escrito[],
  panel: { width: number; height: number },
  views: { where: string; pose: PanelPose; eyes: { x: number; y: number; z: number } }[],
  k = 1,
): string[] {
  const scaled = atColumnScale(texts, k)
  const distance = Math.max(...views.map(({ pose, eyes }) => worstReadingDistance(drawnTexts(scaled), pose, eyes, LINE_HEIGHT)))
  return [
    ...legibilityProblems(scaled, { panel: { width: panel.width * k, height: panel.height * k }, distance }),
    ...views.flatMap(({ pose, eyes, where }) => unreadableTexts(drawnTexts(scaled), pose, eyes, LINE_HEIGHT).map((p) => `${where}: ${p}`)),
  ]
}

const COLUMN_VIEWS = panelViews(XR_UI.panel, XR_UI_ROTATION.panel)
/** Where the menu is born with the headset: almost head-on (`XR_UI.menu`), as on the web. */
const MENU_VIEWS = panelViews(XR_UI.menu, XR_UI_ROTATION.menu)

const boxes = (buttons: Iterable<{ caja: { x: number; y: number; width: number; height: number }; nodo: Node3D }>) =>
  [...buttons].filter((b) => b.nodo.visible).map((b) => b.caja)

function menuState(changes: Partial<MenuState> = {}): MenuState {
  return {
    lang: 'en',
    mode: 'practice',
    difficulty: 'easy',
    goals: 7,
    endless: false,
    level: 1,
    unlocked: 1,
    stars: Array.from({ length: 15 }, () => 0 as const),
    record: 0,
    comfort: 'normal',
    hasRoom: false,
    scenery: 'place',
    goal: null,
    moreOptions: true,
    ...changes,
  }
}

/** Every moment of the menu: language, mode, with a record or without one, endless, and advanced levels. */
function menuMoments(): { where: string; state: MenuState }[] {
  const moments: { where: string; state: MenuState }[] = []
  for (const lang of LANGS) {
    for (const mode of GAME_MODE_ORDER) {
      moments.push({ where: `${lang} ${mode}`, state: menuState({ lang, mode }) })
      moments.push({ where: `${lang} ${mode} with a record`, state: menuState({ lang, mode, record: 98765, level: 12, unlocked: 15, comfort: 'off' }) })
      moments.push({ where: `${lang} ${mode} folded`, state: menuState({ lang, mode, moreOptions: false, record: 98765 }) })
    }
    moments.push({ where: `${lang} endless`, state: menuState({ lang, endless: true }) })
    moments.push({ where: `${lang} in your room`, state: menuState({ lang, hasRoom: true, scenery: 'room', record: 98765 }) })
  }
  return moments
}

describe('the menu measures what the web does', () => {
  const aim = new PointerAim()
  const menu = new GameMenu(
    { chooseMode() {}, chooseDifficulty() {}, chooseComfort() {}, step() {}, endless() {}, toggleScenery() {}, moreOptions() {}, play() {}, exit() {} },
    aim,
  )

  it('the rows of the mode: practice asks level and goals; the levels, the stage; the challenge, nothing', () => {
    const rows = (mode: GameMode) => {
      menu.paint(menuState({ mode }))
      return menu.panel.escritos.map((e) => e.texto).filter((t) => ['Mode', 'Level', 'Goals', 'Stage'].includes(t))
    }
    expect(rows('practice')).toEqual(['Mode', 'Level', 'Goals'])
    expect(rows('levels')).toEqual(['Mode', 'Stage'])
    expect(rows('challenge')).toEqual(['Mode'])
    expect(rows('duel')).toEqual(['Mode'])
  })

  it('what does not belong to the mode, folded behind «Más opciones» as on the web; in the challenge, without a button', () => {
    const rows = (mode: GameMode, moreOptions: boolean) => {
      menu.paint(menuState({ mode, moreOptions }))
      return menu.panel.escritos
        .map((e) => e.texto)
        .filter((t) => ['Mode', 'Level', 'Goals', 'Stage', 'When hit', 'More options', 'Fewer options'].includes(t))
    }
    expect(rows('practice', false)).toEqual(['More options', 'Mode'])
    expect(rows('levels', false)).toEqual(['More options', 'Mode', 'Stage'])
    expect(rows('duel', false)).toEqual(['More options', 'Mode'])
    expect(rows('practice', true)).toEqual(['Fewer options', 'When hit', 'Mode', 'Level', 'Goals'])
    menu.paint(menuState({ mode: 'practice', moreOptions: false }))
    expect(menu.button('more options').nodo.visible).toBe(true)
    for (const id of ['comfort off', 'scenery', `level ${DIFFICULTY_ORDER[0]}`, 'minus', 'endless']) expect(menu.button(id).nodo.visible, id).toBe(false)
    expect(rows('challenge', true)).toEqual(['Mode'])
    expect(menu.button('more options').nodo.visible).toBe(false)
    expect(menu.button('comfort off').nodo.visible).toBe(false)
  })

  it('it is named after the cabinet, top left and untranslated, as on the web', () => {
    for (const { where, state } of menuMoments()) {
      menu.paint(state)
      const title = menu.panel.escritos.find((e) => e.texto === gameName())
      expect(title, where).toBeDefined()
      expect(title!.alto / LINE_HEIGHT).toBeCloseTo(MENU_TEXT.title, 9)
      expect(title!.y).toBeCloseTo(MENU_ROW.title, 9)
    }
  })

  it('each mode carries its icon and its name below, as on the web, and the chosen one lights up', () => {
    menu.paint(menuState({ mode: 'duel' }))
    for (const mode of GAME_MODE_ORDER) {
      const b = menu.button(`mode ${mode}`)
      expect(b.nodo.visible, mode).toBe(true)
    }
    // The name of each mode, inside its button; and what the chosen one is, on the line below.
    expect(menu.panel.escritos.some((e) => e.texto.startsWith('Take turns'))).toBe(true)
    for (const name of ['Practice', 'Levels', 'Challenge', 'Duel']) {
      expect(menu.panel.escritos.filter((e) => e.texto === name), name).toHaveLength(1)
    }
  })

  it('with the font of Godot each text measures what the web estimates, with a quarter of margin', () => {
    const estimated = approximateMeasurer()
    for (const { where, state } of menuMoments()) {
      menu.paint(state)
      for (const e of menu.panel.escritos) {
        const ratio = e.ancho / estimated.ancho(e.texto, e.alto / LINE_HEIGHT)
        expect(ratio, `${where}: «${e.texto}»`).toBeGreaterThan(0.6)
        expect(ratio, `${where}: «${e.texto}»`).toBeLessThan(1.25)
      }
    }
  })

  it('it can be read: nothing overlaps or runs off, and each text gets there from where it is played', () => {
    for (const { where, state } of menuMoments()) {
      menu.paint(state)
      expect(measure(menu.panel.escritos, MENU_PANEL, MENU_VIEWS, COLUMN_SCALE), where).toEqual([])
    }
  })

  it(`it is born at ${MENU_DEGREES}° or less from the front, in the place of the web`, () => {
    expect(degreesFromFront(fromPlayerSpace(XR_UI.menu))).toBeLessThanOrEqual(MENU_DEGREES)
    expect(XR_UI.menu).toEqual(menuPlacement())
  })

  it('and the measurement notices when it does not fit: narrowed to a third, it complains', () => {
    menu.paint(menuState({ lang: 'es' }))
    expect(menu.panel.escritos.length).toBeGreaterThan(5)
    const narrow = { width: MENU_PANEL.width / 3, height: MENU_PANEL.height }
    expect(legibilityProblems(menu.panel.escritos, { panel: narrow }).join(' ')).toContain('runs off the panel')
  })

  it('everything is written at a size from the list, without shrinking, and no text gets into another button', () => {
    for (const { where, state } of menuMoments()) {
      menu.paint(state)
      expect(sizesOffList(drawnTexts(menu.panel.escritos), LINE_HEIGHT, Object.values(MENU_TEXT)), where).toEqual([])
      expect(textsOnButtons(drawnTexts(menu.panel.escritos), boxes(menu.buttons.values())), where).toEqual([])
    }
  })

  it('the exit is in the bottom right corner, in every mode', () => {
    for (const mode of GAME_MODE_ORDER) {
      menu.paint(menuState({ mode }))
      const exit = menu.button('exit').caja
      const rest = boxes([...menu.buttons.values()].filter((b) => b.id !== 'exit'))
      expect(exitProblems(exit, rest, MENU_PANEL), mode).toEqual([])
    }
  })

  it('what cannot be done is dimmed: going below the minimum, going above what is unlocked, the endless goals and the room', () => {
    menu.paint(menuState({ mode: 'levels', level: 1, unlocked: 1 }))
    expect(menu.button('minus').apagado).toBe(true)
    expect(menu.button('plus').apagado).toBe(true)
    expect(menu.button('scenery').apagado).toBe(true)
    menu.paint(menuState({ mode: 'levels', level: 2, unlocked: 3 }))
    expect(menu.button('minus').apagado).toBe(false)
    expect(menu.button('plus').apagado).toBe(false)
    menu.paint(menuState({ endless: true }))
    expect(menu.button('minus').apagado).toBe(true)
    expect(menu.goals.node.visible).toBe(false)
    // With augmented reality, the scenery can be changed and it says which one is set.
    menu.paint(menuState({ hasRoom: true, scenery: 'room' }))
    expect(menu.button('scenery').apagado).toBe(false)
    expect(menu.panel.escritos.map((e) => e.texto)).toContain('Your room')
    menu.paint(menuState({ hasRoom: true, scenery: 'place' }))
    expect(menu.panel.escritos.map((e) => e.texto)).toContain('The room')
  })

  it('the digits are seven-segment: the goals, the level and its total, and the record', () => {
    menu.paint(menuState({ goals: 11, record: 4321 }))
    expect([menu.goals.value, menu.record.value]).toEqual([11, 4321])
    expect(menu.record.node.visible).toBe(true)
    menu.paint(menuState({ mode: 'levels', level: 9, unlocked: 12, record: 4321 }))
    expect([menu.level.value, menu.total.value]).toEqual([9, 15])
    expect(menu.record.node.visible).toBe(false)
  })
})

describe('the menu says of each mode whether it counts for a medal', () => {
  const menu = new GameMenu(
    { chooseMode() {}, chooseDifficulty() {}, chooseComfort() {}, step() {}, endless() {}, toggleScenery() {}, moreOptions() {}, play() {}, exit() {} },
    new PointerAim(),
  )

  it('in letters, on the line of the «Modo» label: only the challenge counts, in both languages', () => {
    for (const lang of LANGS) {
      const t = translator(lang)
      for (const mode of GAME_MODE_ORDER) {
        menu.paint(menuState({ lang, mode }))
        const phrase = t(mode === 'challenge' ? 'Counts for a medal' : 'Does not count for a medal')
        const written = menu.panel.escritos.find((e) => e.texto === phrase)
        const label = menu.panel.escritos.find((e) => e.texto === t('Mode'))!
        expect(written, `${lang} ${mode}`).toBeDefined()
        expect(written!.y).toBeCloseTo(label.y)
        expect(written!.x).toBeGreaterThan(label.x)
      }
    }
  })

  it('and if the hall takes the medals from another mode, the challenge does not count either', () => {
    const other = { medals: { bronze: 1, silver: 2, gold: 3 }, better: 'higher', unit: 'points', record: null, mode: 'levels' } as const
    menu.paint(menuState({ mode: 'challenge', goal: other }))
    expect(menu.panel.escritos.map((e) => e.texto)).toContain('Does not count for a medal')
  })
})

describe('the goal sign can be read, with the font of Godot', () => {
  const GOAL: Goal = {
    medals: { bronze: 1500, silver: 8000, gold: 20000 },
    better: 'higher',
    unit: 'points in the challenge',
    record: 104250,
    mode: 'challenge',
  }
  const PANEL = { width: SIGN.width, height: SIGN.height }
  /** From where it is played with the headset: at three eye heights, with the world standing or at their height. */
  const VIEWS = panelViews(SIGN_PLACEMENT.position, SIGN_PLACEMENT.rotation)
  /** How much the sign is enlarged where it hangs: it is painted to be read at `SIGN.distance`. */
  const SCALE = SIGN_PLACEMENT.distance / SIGN.distance

  /** The matches that are measured: from the first countdown to a challenge of two laps, and the end. */
  const MOMENTS: Partial<GameInPlay>[] = [
    { gameState: 'countdown' },
    { gameState: 'playing' },
    { round: 5, points: 1650, goals: 20, streak: 4 },
    { round: 12, points: 19850, goals: 70, streak: 11 },
    { round: 28, points: 123450, goals: 180, streak: 12 },
    { gameState: 'finished', round: 4, points: 1650, goals: 20 },
    { gameState: 'finished', round: 30, points: 123450, goals: 190 },
    { gameMode: 'practice' },
    { gameMode: 'duel' },
  ]

  function views(lang: (typeof LANGS)[number]): GoalSignView[] {
    const t = softTranslator(lang)
    const base: GameInPlay = { gameMode: 'challenge', gameState: 'playing', round: 1, goals: 0, points: 0, streak: 0, record: 104250 }
    const all: GoalSignView[] = []
    for (const goal of [GOAL, null]) {
      for (const moment of MOMENTS) {
        const run = signRun({ ...base, goal, ...moment }, t)
        if (run != null) all.push(goalSign(run, t))
      }
    }
    return all
  }

  it('everything it says fits and does not overlap, and each text is above what can be read from where it is played', () => {
    const sign = new SignPanel()
    sign.place(SIGN_PLACEMENT)
    let measured = 0
    for (const lang of LANGS) {
      for (const view of views(lang)) {
        sign.update(view, null, lang, 0.016)
        const texts = sign.panel.escritos
        const where = `${lang}: ${view.title} / ${view.detail}`
        // Two lines while playing; at the end, the third with the footer.
        expect(texts.map((e) => e.texto), where).toEqual([view.title, ...[view.detail, view.footer].filter((line) => line != null)])
        expect(legibilityProblems(texts, { panel: PANEL, distance: SIGN.distance }), where).toEqual([])
        for (const { pose, eyes, where: from } of VIEWS) {
          expect(unreadableTexts(drawnTexts(atColumnScale(texts, SCALE)), pose, eyes, LINE_HEIGHT, MIN_ANGLE), `${where}, ${from}`).toEqual([])
        }
        measured++
      }
    }
    expect(measured).toBeGreaterThan(20)
    // Some view of the end carries the footer, or the third line would not be being measured.
    expect(LANGS.some((lang) => views(lang).some((view) => view.footer != null))).toBe(true)
    sign.node.free()
  })

  it('on crossing a threshold the title says the medal, and it can still be read', () => {
    const sign = new SignPanel()
    sign.place(SIGN_PLACEMENT)
    const t = softTranslator('es')
    const view = goalSign(
      signRun({ goal: GOAL, gameMode: 'challenge', gameState: 'playing', round: 12, goals: 70, points: 19850, streak: 11, record: 0 }, t)!,
      t,
    )
    expect(view.cheer).toBeTruthy()
    sign.update(view, null, 'es', 0.016)
    sign.update(view, view.medal ?? 'silver', 'es', 0.016)
    expect(sign.panel.escritos[0]!.texto).toBe(view.cheer)
    expect(legibilityProblems(sign.panel.escritos, { panel: PANEL, distance: SIGN.distance })).toEqual([])
    sign.node.free()
  })

  it('the mission and what is looked at while playing are read at a glance: more than one degree', () => {
    const sign = new SignPanel()
    sign.place(SIGN_PLACEMENT)
    const base: GameInPlay = { goal: GOAL, gameMode: 'challenge', gameState: 'playing', round: 5, goals: 20, points: 1650, streak: 4, record: 0 }
    for (const lang of LANGS) {
      const t = softTranslator(lang)
      for (const moment of [{ gameState: 'countdown', round: 1, goals: 0, points: 0, streak: 0 }, {}] as Partial<GameInPlay>[]) {
        sign.update(goalSign(signRun({ ...base, ...moment }, t)!, t), null, lang, 0.016)
        const texts = atColumnScale(sign.panel.escritos, SCALE)
        for (const { pose, eyes, where } of VIEWS) {
          expect(unreadableTexts(drawnTexts(texts), pose, eyes, LINE_HEIGHT, 1), `${lang}, ${where}`).toEqual([])
        }
      }
    }
    sign.node.free()
  })

  it('it measures what the one on the web does: 24° by 4.5° at its distance, with the font of the title at 1.4°', () => {
    const degree = (2 * SIGN.distance * Math.tan((MIN_ANGLE * Math.PI) / 180 / 2)) / MIN_ANGLE
    expect(SIGN.width / degree).toBeCloseTo(24)
    expect(SIGN.height / degree).toBeCloseTo(4.5)
    expect(SIGN.title / degree).toBeCloseTo(1.4)
    expect(SIGN.detail / degree).toBeCloseTo(1.2)
    expect(SIGN_PLACEMENT).toEqual(signPlacement({ width: SIGN.width / SIGN.distance, height: SIGN.height / SIGN.distance }))
  })

  it('it celebrates the threshold crossed: it returns it once, grows and comes back, and just hung it celebrates nothing', () => {
    const sign = new SignPanel()
    sign.place(SIGN_PLACEMENT)
    const t = softTranslator('en')
    const base: GameInPlay = { goal: GOAL, gameMode: 'challenge', gameState: 'playing', round: 4, goals: 14, points: 1650, streak: 0, record: 0 }
    const view = goalSign(signRun(base, t)!, t)

    // Hung with the bronze already in hand: the threshold has not been seen being crossed.
    expect(sign.update(view, 'bronze', 'en', 0.016)).toBeNull()
    expect(sign.celebrating).toBeNull()
    expect(sign.update(view, 'silver', 'en', 0.016)).toBe('silver')
    expect(sign.celebrating).toBe('silver')
    expect(sign.update(view, 'silver', 'en', 0.1)).toBeNull()
    expect(sign.node.scale.x).toBeGreaterThan(SCALE)
    // Once the celebration is over it goes back to its size and stops celebrating.
    for (let i = 0; i < 20; i++) sign.update(view, 'silver', 'en', 0.1)
    expect(sign.celebrating).toBeNull()
    expect(sign.node.scale.x).toBeCloseTo(SCALE)
    // Dropping below a threshold —a goal conceded— is not celebrated.
    expect(sign.update(view, 'bronze', 'en', 0.016)).toBeNull()
    // Without a view it hides.
    sign.update(null, null, 'en', 0.016)
    expect(sign.node.visible).toBe(false)
    sign.node.free()
  })
})

describe('the end, the notice, the countdown and the tutorial can be read', () => {
  it('the end, in both languages, won, lost, with a record and in a level', () => {
    const gameOver = new GameOverPanel({ again() {}, menu() {}, exit() {} }, new PointerAim())
    for (const lang of LANGS) {
      for (const state of [
        { outcome: 'won' as const, isRecord: false, level: null },
        { outcome: 'lost' as const, isRecord: false, level: null },
        { outcome: 'won' as const, isRecord: true, level: null },
        { outcome: 'lost' as const, isRecord: false, level: { level: 12, stars: 0 as const, passed: false } },
      ]) {
        gameOver.paint({ lang, points: 98765, duel: null, ...state })
        const where = `${lang} ${JSON.stringify(state)}`
        expect(measure(gameOver.panel.escritos, GAME_OVER_SIZE, COLUMN_VIEWS, COLUMN_SCALE), where).toEqual([])
        expect(sizesOffList(drawnTexts(gameOver.panel.escritos), LINE_HEIGHT, [GAME_OVER_TEXT]), where).toEqual([])
      }
    }
    const rest = [GAME_OVER_BOXES.again, GAME_OVER_BOXES.menu]
    expect(exitProblems(GAME_OVER_BOXES.exit, rest, GAME_OVER_SIZE)).toEqual([])
  })

  it('the end of the duel: the handover, the winner and the tie, in both languages', () => {
    const gameOver = new GameOverPanel({ again() {}, menu() {}, exit() {} }, new PointerAim())
    const tally = { wins: [123, 99] as const, ties: 42 }
    const first = { scored: 7, conceded: 5 }
    const views: DuelView[] = [
      { player: 0, matches: [first, null], next: 1, over: false, winner: null },
      { player: 1, matches: [first, { scored: 7, conceded: 2 }], next: null, over: true, winner: 1 },
      { player: 1, matches: [first, { scored: 4, conceded: 2 }], next: null, over: true, winner: null },
    ]
    for (const lang of LANGS) {
      for (const [i, view] of views.entries()) {
        gameOver.paint({ lang, outcome: 'won', points: 0, isRecord: false, level: null, duel: { view, score: { scored: 7, conceded: 5 }, tally } })
        const where = `${lang} duel ${i}`
        expect(measure(gameOver.panel.escritos, GAME_OVER_SIZE, COLUMN_VIEWS, COLUMN_SCALE), where).toEqual([])
        expect(sizesOffList(drawnTexts(gameOver.panel.escritos), LINE_HEIGHT, Object.values(DUEL_TEXT)), where).toEqual([])
        expect(textsOnButtons(drawnTexts(gameOver.panel.escritos), [GAME_OVER_BOXES.again, GAME_OVER_BOXES.menu, GAME_OVER_BOXES.exit]), where).toEqual([])
      }
    }
    const t = translator('es')
    gameOver.paint({ lang: 'es', outcome: 'lost', points: 0, isRecord: false, level: null, duel: { view: views[0], score: first, tally } })
    expect(gameOver.panel.escritos.map((e) => e.texto).join(' ')).toContain(t('Pass the controller to {player}.', { player: t('Player 2') }))
    gameOver.paint({ lang: 'es', outcome: 'won', points: 0, isRecord: false, level: null, duel: { view: views[1], score: first, tally } })
    expect(gameOver.panel.escritos.map((e) => e.texto).join(' ')).toContain('Gana Jugador 2')
  })

  it('the notice of leaving the match, in both languages', () => {
    const notice = new ExitNotice({ stay() {}, menu() {}, leave() {} }, new PointerAim())
    const panel = { width: CONFIRM_SIZE[0], height: CONFIRM_SIZE[1] }
    for (const lang of LANGS) {
      notice.write(lang)
      expect(measure(notice.panel.escritos, panel, COLUMN_VIEWS, COLUMN_SCALE), lang).toEqual([])
      expect(sizesOffList(drawnTexts(notice.panel.escritos), LINE_HEIGHT, Object.values(CONFIRM_TEXT)), lang).toEqual([])
      expect(textsOnButtons(drawnTexts(notice.panel.escritos), boxes([notice.stay, notice.menu, notice.leave])), lang).toEqual([])
    }
    expect(exitProblems(notice.leave.caja, boxes([notice.stay, notice.menu]), panel)).toEqual([])
  })

  it('the notice to pick up the mallet, over the serve, with both grabs and in both languages', () => {
    const countdown = new Countdown()
    const views = panelViews(XR_UI.countdown, undefined)
    for (const lang of LANGS) {
      for (const withOneTap of [false, true]) {
        countdown.paint({ count: 1, waitingForMallet: true, withOneTap, lang })
        const where = `${lang} ${withOneTap ? 'one tap' : 'holding'}`
        expect(measure(countdown.notice.escritos, { width: MALLET_NOTICE[0], height: MALLET_NOTICE[1] }, views), where).toEqual([])
        expect(sizesOffList(drawnTexts(countdown.notice.escritos), LINE_HEIGHT, Object.values(MALLET_TEXT)), where).toEqual([])
      }
    }
    countdown.paint({ count: 2, waitingForMallet: false, withOneTap: false, lang: 'en' })
    expect(countdown.digit.value).toBe(2)
    expect(countdown.notice.nodo.visible).toBe(false)
  })

  it('the tutorial, in each step, with both grabs and in both languages', () => {
    const tutorial = new GameTutorial(new PointerAim())
    const views = panelViews(XR_UI.tutorial, XR_UI_ROTATION.tutorial)
    for (const lang of LANGS) {
      for (const grab of ['hold', 'toggle'] as const) {
        const phrases = grab === 'toggle' ? PHRASES_WITH_ONE_TAP : PHRASES
        for (const [i, step] of TUTORIAL_STEPS.entries()) {
          tutorial.view.mostrarPaso(i + 1, TUTORIAL_STEPS.length, translator(lang)(phrases[step]), null)
          const texts = tutorial.view.panel.escritos
          const where = `${lang} ${grab} ${step}`
          expect(measure(texts, PANEL_DEL_TUTORIAL, views), where).toEqual([])
          expect(sizesOffList(drawnTexts(texts), LINE_HEIGHT, Object.values(TUTORIAL_SIZES.letra)), where).toEqual([])
        }
      }
    }
  })

  it('the tutorial goes to one side of the sign and of the scoreboard: it hides neither, at any eye height', () => {
    const signSize = { width: SIGN_PROPORTION.width * SIGN_PLACEMENT.distance, height: SIGN_PROPORTION.height * SIGN_PLACEMENT.distance }
    const whatIsRead = (rise: number) => {
      const c = fromPlayerSpace(SIGN_PLACEMENT.position)
      const m = fromPlayerSpace(XR_UI.scoreboard)
      return [
        { what: 'the sign', points: panelPoints([c[0], c[1] + rise, c[2]], signSize, 8) },
        { what: 'the scoreboard', points: panelPoints([m[0], m[1] + rise, m[2]], SCOREBOARD_SIZE, 8) },
      ]
    }
    for (const { where, pose, eyes } of panelViews(XR_UI.tutorial, XR_UI_ROTATION.tutorial)) {
      const rise = pose.position[1] - fromPlayerSpace(XR_UI.tutorial)[1]
      expect(whatThePanelHides(pose, PANEL_DEL_TUTORIAL, eyes, whatIsRead(rise)), where).toEqual([])
    }
    // The control: head-on, where it still is when flat, it hides them whole.
    const [front] = panelViews(FLAT_TUTORIAL, XR_UI_ROTATION.flatTutorial).filter((v) => v.eyes.y === REFERENCE_EYE_HEIGHT)
    expect(whatThePanelHides(front!.pose, PANEL_DEL_TUTORIAL, front!.eyes, whatIsRead(0))).toHaveLength(2)
  })

  it('the tutorial asks for what applies: the grab, the hit and the goal, and it can be skipped', () => {
    const tutorial = new GameTutorial(new PointerAim())
    tutorial.force()
    expect(tutorial.step({ grab: false, hit: false, goal: false })).toBe('grab')
    expect(tutorial.step({ grab: true, hit: false, goal: false })).toBe('hit')
    expect(tutorial.step({ grab: true, hit: true, goal: false })).toBe('goal')
    tutorial.view.saltar.alPulsar()
    expect(tutorial.step({ grab: false, hit: false, goal: false })).toBeNull()
  })
})

describe('the settings', () => {
  beforeEach(() => gameStorage()?.clear())

  it('the language is the one the hall stored, and the one from the command line wins', () => {
    gameStorage()!.setItem(LANG_KEY, 'en')
    expect(currentLang()).toBe('en')
    gameStorage()!.setItem(LANG_KEY, 'es')
    expect(currentLang()).toBe('es')
    expect(currentLang('en')).toBe('en')
  })

  it('the volumes of the hall, from 0 to 1, and the sound obeys them on every shot', () => {
    expect(volumeLevels()).toEqual({ sfx: 1, ambience: 0.6, muted: false })
    const parent = new Node3D()
    const sfx = new Sfx(parent, { dir: 'res://games/glide-hockey/sfx', names: ['goal'], levels: volumeLevels })
    gameStorage()!.setItem(VOLUME_KEYS.sfx, '0')
    sfx.play('goal')
    expect(sfx.counts).toMatchObject({ requested: { goal: 1 }, played: {} })
    gameStorage()!.setItem(VOLUME_KEYS.sfx, '50')
    sfx.play('goal')
    expect(sfx.counts.played.goal).toBe(1)
    parent.free()
  })

  it('the comfort of the hit taken is stored with the key of the web', () => {
    expect(currentComfort()).toBe('normal')
    gameStorage()!.setItem(COMFORT_KEY, 'gentle')
    expect(currentComfort()).toBe('gentle')
  })
})

describe('with the mouse: the menu leads to playing, stop asks and the end goes back', () => {
  let root: Node3D
  let table: Node3D
  let camera: Camera3D
  let match: Match
  let ui: GameUi
  let exits: number
  /** A scenery of the hall with augmented reality, which records what is chosen. */
  let scenery: { elegido: 'place' | 'room'; hayHabitacion: boolean; alternar(): void }

  beforeEach(() => {
    gameStorage()?.clear()
    // What is read, in English: without a stored language, the game would speak the system's.
    gameStorage()?.setItem(LANG_KEY, 'en')
    const tree = Engine.get_main_loop() as SceneTree
    root = new Node3D()
    ;(tree.current_scene ?? (tree.root as Node)).add_child(root)
    table = new Node3D()
    table.position = new Vector3(0, 0.9, -1.2)
    root.add_child(table)
    camera = new Camera3D()
    camera.fov = 46
    root.add_child(camera)
    camera.look_at_from_position(new Vector3(0, 2.65, 1.5), new Vector3(0, 0.9, -1.2), Vector3.UP)
    camera.current = true
    exits = 0
    // The menu opens on the challenge («opens on the challenge», below, checks it); here the one of
    // practice is pressed, which is the one that asks the level and the goals.
    match = new Match()
    match.setGameMode('practice')
    scenery = {
      elegido: 'place',
      hayHabitacion: true,
      alternar() {
        this.elegido = this.elegido === 'room' ? 'place' : 'room'
      },
    }
    ui = new GameUi(match, { exit: () => exits++ }, { root: table, camera, headset: false, scenery })
  })

  afterEach(() => {
    ui.release()
    root.get_parent()?.remove_child(root)
    root.free()
  })

  /** A click on the button `id`: move, press in one frame and release in the next. */
  function click(id: string): void {
    ui.update(0.016)
    const button = ui.aim.boton(id)
    expect(button?.nodo.is_visible_in_tree(), `the button ${id} is not in view`).toBe(true)
    const at: Vector2 = camera.unproject_position(button!.nodo.global_position)
    const move = new InputEventMouseMotion()
    move.position = at
    ui.receive(move)
    for (const pressed of [true, false]) {
      const e = new InputEventMouseButton()
      e.position = at
      e.button_index = MouseButton.MOUSE_BUTTON_LEFT
      e.pressed = pressed
      ui.receive(e)
      ui.update(0.016)
    }
  }

  it('choosing the level of the machine, raising the goals and playing starts with what was chosen', () => {
    click('more options')
    click(`level ${DIFFICULTY_ORDER[2]}`)
    click('plus')
    click('play')
    expect(match.gameState).toBe('countdown')
    expect([match.activeDifficulty, match.activeGoalTarget]).toEqual([DIFFICULTY_ORDER[2], 8])
    expect(ui.menu.node.visible).toBe(false)
    expect(ui.scoreboard.node.visible).toBe(true)
  })

  it('opens on the challenge: playing without touching anything starts it, with the goal sign above the scoreboard', () => {
    ui.release()
    match = new Match()
    ui = new GameUi(match, { exit: () => exits++ }, { root: table, camera, headset: false, scenery })
    ui.update(0.016)
    expect(match.gameMode).toBe('challenge')
    expect(ui.menu.panel.escritos.map((e) => e.texto)).toContain('Counts for a medal')
    expect(ui.sign.node.visible).toBe(false)

    click('play')
    ui.update(0.016)
    expect([match.gameMode, match.gameState]).toEqual(['challenge', 'countdown'])
    expect(ui.sign.node.visible).toBe(true)
    expect(ui.sign.panel.escritos.map((e) => e.texto)).toEqual(['Win games until you lose one'])
    // It hangs from the root of the interface, above the whole scoreboard.
    expect(ui.sign.node.get_parent()).toBe(table)
    expect(ui.sign.node.position.y - (SIGN.height / 2) * ui.sign.node.scale.y).toBeGreaterThan(XR_UI.scoreboard[1] + SCOREBOARD_SIZE.height / 2)
    expect(ui.sign.node.position.x).toBeCloseTo(0)

    // While playing, the scoreboard leaves out the points and the round, which the sign already says, and the goals go in the middle.
    for (let i = 0; i < COUNTDOWN_SECONDS * 60 + 2; i++) match.tick(1 / 60)
    match.scorePlayer()
    ui.update(0.016)
    expect(ui.sign.panel.escritos.map((e) => e.texto)).toEqual(['You have 100', 'Round 1 · to 3 goals · goal +120'])
    expect(ui.scoreboard.points.node.visible).toBe(false)
    expect(ui.scoreboard.rowNumber.node.visible).toBe(false)
    expect(ui.scoreboard.player.node.position.y).toBe(0)
    expect(ui.threshold).toBeNull()
  })

  it('in practice the scoreboard says it all and there is no sign: without a hall there is no medal to talk about', () => {
    click('play')
    ui.update(0.016)
    expect(ui.sign.node.visible).toBe(false)
    expect(ui.scoreboard.points.node.visible).toBe(true)
    expect(ui.scoreboard.player.node.position.y).toBeCloseTo(SCOREBOARD_ROWS.goals)
  })

  it('«Más opciones» unfolds what belongs to practice; folded on going back to the menu, without being stored', () => {
    ui.update(0.016)
    expect(ui.aim.boton('comfort off')?.nodo.is_visible_in_tree()).toBe(false)
    click('more options')
    expect(ui.aim.boton('comfort off')?.nodo.is_visible_in_tree()).toBe(true)
    expect(ui.menu.panel.escritos.map((e) => e.texto)).toContain('Fewer options')
    click('play')
    ui.escape()
    click('confirm:menu')
    ui.update(0.016)
    expect(match.gameState).toBe('menu')
    expect(ui.aim.boton('comfort off')?.nodo.is_visible_in_tree()).toBe(false)
    expect(ui.menu.panel.escritos.map((e) => e.texto)).toContain('More options')
  })

  it('choosing the comfort stores it, and the mode changes what it asks', () => {
    click('more options')
    click('comfort off')
    expect(currentComfort()).toBe('off')
    click('mode challenge')
    expect(match.gameMode).toBe('challenge')
    expect(ui.aim.boton('plus')?.nodo.is_visible_in_tree()).toBe(false)
  })

  it('the scenery button toggles the room and your room, and the menu says so', () => {
    click('more options')
    click('scenery')
    expect(scenery.elegido).toBe('room')
    ui.update(0.016)
    expect(ui.menu.panel.escritos.map((e) => e.texto)).toContain('Your room')
    // A second brush in under 300 ms does not count (`PointerAim`): it waits like a real hand.
    OS.delay_msec(320)
    click('scenery')
    expect(scenery.elegido).toBe('place')
  })

  it('the arrow in the corner leaves; Escape in the menu, too', () => {
    click('exit')
    expect(exits).toBe(1)
    ui.escape()
    expect(exits).toBe(2)
  })

  it('stop asks and the table waits; keep playing goes back, and back to the menu leaves the match', () => {
    click('play')
    click('quit')
    expect(match.prompt).toBe('quit')
    expect(ui.exitNotice.node.visible).toBe(true)
    click('confirm:stay')
    expect(match.prompt).toBeNull()
    ui.escape()
    click('confirm:menu')
    expect(match.gameState).toBe('menu')
    expect(exits).toBe(0)
  })

  it('on ending the end comes up: play again starts anew and the one with the stripes goes back to the menu', () => {
    match.setGoalTarget(3)
    click('play')
    for (let i = 0; i < COUNTDOWN_SECONDS * 60 + 2; i++) match.tick(1 / 60)
    for (let i = 0; i < 3; i++) match.scorePlayer()
    ui.update(0.016)
    expect(ui.gameOver.node.visible).toBe(true)
    const tableBefore = match.runId
    click('final:again')
    expect(match.gameState).toBe('countdown')
    expect(match.runId).toBe(tableBefore + 1)
    for (let i = 0; i < COUNTDOWN_SECONDS * 60 + 2; i++) match.tick(1 / 60)
    for (let i = 0; i < 3; i++) match.scoreOpponent()
    click('final:menu')
    expect(match.gameState).toBe('menu')
  })

  it('in the match only what is seen is aimed at: the mouse over the hidden «play» does not light it', () => {
    click('play')
    ui.update(0.016)
    const visible = ['quit', 'end', 'play', 'final:again'].filter((id) => ui.aim.boton(id)?.nodo.is_visible_in_tree())
    expect(visible).toEqual(['quit'])
    const play = ui.aim.boton('play')!
    const move = new InputEventMouseMotion()
    move.position = camera.unproject_position(play.nodo.global_position)
    ui.receive(move)
    ui.update(0.016)
    expect(ui.pointsAtButton()).toBe(false)
    expect(play.estado).toBe('reposo')
  })
})
