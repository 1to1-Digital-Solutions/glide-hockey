/**
 * Lo que el juego dice, en español.
 *
 * **La clave es el propio texto en inglés.** No hay ids inventados (`hud.puntos`) por dos
 * motivos. El primero es que se lee: en el componente pone `t('Back to the menu')`, y
 * quien pasa por ahí sabe qué se pinta sin ir a buscar el diccionario. El segundo es que
 * TypeScript lo vigila solo: `TextKey` sale de las claves de este objeto, así que cambiar
 * la frase en el componente y olvidarse de aquí **no compila**, en vez de dejar una clave
 * huérfana que solo se nota cuando alguien pone el juego en español.
 *
 * El inglés no se guarda dos veces: si el idioma es inglés, `texto` devuelve la clave.
 * Este fichero solo tiene la traducción.
 *
 * **Lo que NO entra aquí.** Los comentarios, los identificadores y los errores de
 * programador siguen en español porque son para quien mantiene el repo. Las claves de
 * almacenamiento tampoco se tocan nunca: traducirlas borraría los récords de quien juega.
 *
 * El idioma lo elige quien juega una sola vez, en el menú de xrcade, y llega aquí por la
 * cookie del arcade (ver `ajustes.ts`).
 */

import type { Lang } from './ajustes'

const ES = {
  // Lo que dice la pestaña y lo que se lee al compartir el enlace
  'Air Hockey — you against the machine': 'Air Hockey — tú contra la máquina',
  'Air hockey against the machine: choose the level and the goals to play to, and put the puck in its net. Play in the browser or in mixed reality (VR/AR).':
    'Air hockey contra la máquina: elige el nivel y los goles a los que jugar, y mete el disco en su portería. Juega en el navegador o en realidad mixta (VR/AR).',

  // Portada
  'You against the machine. Move the mallet with the mouse and put the puck in its goal. In the headset, take it with the grip button and the mallet follows your hand.':
    'Tú contra la máquina. Mueve el mazo con el ratón y mete el disco en su portería. Con el visor, cógelo con el botón de agarre y el mazo sigue a tu mano.',
  'Game mode': 'Modo de juego',
  Mode: 'Modo',
  'Machine level': 'Nivel de la máquina',
  Goals: 'Goles',
  'Fixed goals': 'Goles fijos',
  Endless: 'Sin fin',
  Level: 'Nivel',
  'What you see around you': 'Lo que ves a tu alrededor',
  'Around you': 'A tu alrededor',
  Play: 'Jugar',
  'Play in the headset': 'Jugar con el visor',
  Exit: 'Salir',

  // Modos, dificultades y escenario
  Practice: 'Práctica',
  Levels: 'Niveles',
  Challenge: 'Desafío',
  'You choose the level and the goals. Losing costs nothing.':
    'Eliges el nivel y los goles. Perder no cuesta nada.',
  'One game at a time. The level you win stays unlocked for next time.':
    'Una partida cada vez. El nivel que ganas queda desbloqueado para la próxima.',
  'It steps up on its own, in one run. The first game you lose ends it.':
    'Sube solo, en una tanda. La primera partida que pierdas la termina.',
  Easy: 'Fácil',
  Medium: 'Media',
  Hard: 'Difícil',
  Expert: 'Experta',
  Impossible: 'Imposible',
  'The room': 'La sala',
  'Your room': 'Tu habitación',
  'The table with the arcade room around it.': 'La mesa con la sala del arcade alrededor.',
  'Headset and augmented reality only: the table stands in your own room.':
    'Solo con visor y realidad aumentada: la mesa se planta en tu propia habitación.',

  // Lo que la escalera decide por ti
  'the level': 'el nivel',
  'the challenge': 'el desafío',
  '· set by {who}': '· lo pone {who}',
  '· endless': '· sin fin',
  'Level · {level} of {total} · {difficulty}, to {goals} goals':
    'Nivel · {level} de {total} · {difficulty}, a {goals} goles',
  'Level {level}, locked': 'Nivel {level}, bloqueado',
  'Level {level}, {stars} star': 'Nivel {level}, {stars} estrella',
  'Level {level}, {stars} stars': 'Nivel {level}, {stars} estrellas',

  // Marcador
  You: 'Tú',
  Machine: 'Máquina',
  Points: 'Puntos',
  Streak: 'Racha',
  '· round {round}': '· ronda {round}',
  '· level {level}': '· nivel {level}',
  endless: 'sin fin',
  'to {goals} goals': 'a {goals} goles',

  // Final de partida
  'Game over': 'Fin de la partida',
  'Level {level} cleared': 'Nivel {level} superado',
  'Level {level} not cleared': 'Nivel {level} no superado',
  'Game won': 'Partida ganada',
  'Game lost': 'Partida perdida',
  'The challenge ends at round {round}.': 'El desafío acaba en la ronda {round}.',
  '{stars} star · level {level} unlocked.': '{stars} estrella · nivel {level} desbloqueado.',
  '{stars} stars · level {level} unlocked.': '{stars} estrellas · nivel {level} desbloqueado.',
  '{stars} star · score {scored}–{conceded}.': '{stars} estrella · marcador {scored}–{conceded}.',
  '{stars} stars · score {scored}–{conceded}.':
    '{stars} estrellas · marcador {scored}–{conceded}.',
  'Win the game to open the next one.': 'Gana la partida para abrir la siguiente.',
  'Final score: {scored}–{conceded}.': 'Marcador final: {scored}–{conceded}.',
  points: 'puntos',
  'New best streak!': '¡Nueva mejor racha!',
  'New record!': '¡Nuevo récord!',
  'Your best endless streak: {goals}': 'Tu mejor racha sin fin: {goals}',
  Scored: 'Marcados',
  Conceded: 'Encajados',
  'Best streak': 'Mejor racha',
  Again: 'Otra vez',
  'Back to the menu': 'Volver al menú',

  // Progreso, en la portada
  'Levels cleared:': 'Niveles superados:',
  'of {total}': 'de {total}',
  'Your best endless streak:': 'Tu mejor racha sin fin:',
  goals: 'goles',
  'Your record on {mode}:': 'Tu récord en {mode}:',

  // Mientras se juega
  'End run': 'Terminar tanda',
  'Leave the game': 'Dejar la partida',
  Stage: 'Fase',
  'Leave the game?': '¿Dejar la partida?',
  'You lose the goals you have scored.': 'Pierdes los goles que lleves.',
  'Keep playing': 'Seguir jugando',
  Leave: 'Salir',
  'Setting up the table…': 'Montando la mesa…',

  // Lo que dice la demostración del gesto, tramo a tramo.
  'Bring your hand to the mallet and squeeze the side trigger':
    'Lleva la mano hasta el mazo y aprieta el gatillo lateral',
  'Held, it goes wherever your hand goes':
    'Cogido, va donde vaya tu mano',
  'Let go of the trigger and the mallet stays where it is':
    'Suelta el gatillo y el mazo se queda donde está',

  // Y lo mismo con «un toque» en vez de manteniendo el gatillo (ver `lib/agarre.ts`).
  'Bring your hand to the mallet and press the side trigger':
    'Lleva la mano al mazo y pulsa el gatillo lateral',
  'It goes wherever your hand goes, with nothing held':
    'Va a donde vaya tu mano, sin sujetar nada',
  'Press it again and the mallet stays where it is':
    'Vuelve a pulsarlo y el mazo se queda donde está',
} as const

/** Cada frase que el juego sabe decir, escrita como se dice en inglés. */
export type TextKey = keyof typeof ES

/**
 * Todas las frases que el juego sabe decir.
 *
 * Está para que un test pueda comprobar que ninguna se ha quedado huérfana: una frase
 * cambia en el componente y la vieja se queda aquí traducida para siempre —no rompe nada,
 * y por eso nadie la quita nunca—.
 */
export const TEXT_KEYS = Object.keys(ES) as readonly TextKey[]

/**
 * Una frase en el idioma que se pida.
 *
 * En inglés devuelve la clave, que ya es la frase: guardar el original dos veces sería
 * tener dos sitios donde cambiarlo y uno donde olvidarse.
 */
export function texto(lang: Lang, key: TextKey): string {
  return lang === 'es' ? ES[key] : key
}

/**
 * Rellena los huecos de una frase.
 *
 * Las frases con hueco llevan `{algo}` y no se parten en trozos para concatenarlos: el
 * orden de las palabras cambia de un idioma a otro, y concatenar obliga al español a
 * fingir la sintaxis inglesa.
 */
export function formatea(plantilla: string, valores: Record<string, string | number>): string {
  return plantilla.replace(/\{(\w+)\}/g, (hueco, nombre: string) =>
    nombre in valores ? String(valores[nombre]) : hueco,
  )
}

/**
 * El traductor de un idioma, para no repetirlo en cada línea.
 *
 * Se pide una vez arriba del componente —`const t = traductor(useLang())`— y se usa como
 * `t('Back to the menu')`, o con huecos: `t('· round {round}', { round })`.
 */
export function traductor(lang: Lang) {
  return (key: TextKey, valores?: Record<string, string | number>): string => {
    const frase = texto(lang, key)
    return valores === undefined ? frase : formatea(frase, valores)
  }
}
