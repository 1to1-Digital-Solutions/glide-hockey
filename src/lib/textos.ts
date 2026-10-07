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
import { OBJETIVO_ES } from './objetivo'

const ES = {
  // El cartel del objetivo, común a todos los juegos del salón. Lo primero, para que lo que el
  // juego ya decía por su cuenta no choque.
  ...OBJETIVO_ES,
  // Y lo que este juego le da: la misión del reto y lo que queda (`cartelDelMarcador.ts`).
  'Win games until you lose one': 'Gana partidos hasta perder uno',
  'Round {round} · to {goals} goals · goal +{points}': 'Ronda {round} · a {goals} goles · gol +{points}',
  // Lo que el menú dice de cada modo.
  'Counts for a medal': 'Cuenta para medalla',
  'Does not count for a medal': 'No cuenta para medalla',

  // Lo que dice la pestaña y lo que se lee al compartir el enlace. El nombre se queda en
  // inglés a propósito: es el del producto, el mismo que rotula la cabina del salón y el
  // que irá en la ficha de la tienda. Lo que se traduce es lo que va detrás.
  'Glide Hockey — you against the machine': 'Glide Hockey — tú contra la máquina',
  'Glide Hockey against the machine: choose the level and the goals to play to, and put the puck in its net. Play in the browser or in mixed reality (VR/AR).':
    'Glide Hockey contra la máquina: elige el nivel y los goles a los que jugar, y mete el disco en su portería. Juega en el navegador o en realidad mixta (VR/AR).',

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
  // El golpe recibido (`lib/confort.ts`): cuánto se nota un gol en contra.
  'When hit': 'Al recibir',
  Off: 'Apagado',
  Gentle: 'Suave',
  Full: 'Normal',
  Play: 'Jugar',
  'Play in the headset': 'Jugar con el visor',
  Exit: 'Salir',

  // Modos, dificultades y escenario
  Practice: 'Práctica',
  Levels: 'Niveles',
  Challenge: 'Reto',
  Duel: 'Duelo',
  'You choose the level and the goals. Losing costs nothing.':
    'Eliges el nivel y los goles. Perder no cuesta nada.',
  'One game at a time. The level you win stays unlocked for next time.':
    'Una partida cada vez. El nivel que ganas queda desbloqueado para la próxima.',
  'It steps up on its own, in one run. The first game you lose ends it.':
    'Sube solo, en una tanda. La primera partida que pierdas la termina.',
  'Take turns with one controller against the same machine: whoever beats it by more wins.':
    'Por turnos con un mando contra la misma máquina: gana quien le saque más ventaja.',
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
  // Solo sale pasada la ronda quince: la vuelta por la que va y lo que multiplica.
  '· lap {lap} ×{multiplier}': '· vuelta {lap} ×{multiplier}',
  '· level {level}': '· nivel {level}',
  endless: 'sin fin',
  'to {goals} goals': 'a {goals} goles',

  // Final de partida
  'Game over': 'Fin de la partida',
  'Level {level} cleared': 'Nivel {level} superado',
  'Level {level} not cleared': 'Nivel {level} no superado',
  'Game won': 'Partida ganada',
  'Game lost': 'Partida perdida',
  'The challenge ends at round {round}.': 'El reto acaba en la ronda {round}.',
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

  // El duelo
  'Player 1': 'Jugador 1',
  'Player 2': 'Jugador 2',
  '{player}: {scored}–{conceded}': '{player}: {scored}–{conceded}',
  '{player}: {scored}–{conceded} ({margin})': '{player}: {scored}–{conceded} ({margin})',
  'Pass the controller to {player}.': 'Pásale el mando a {player}.',
  '{player} to play': 'Le toca a {player}',
  '{player} wins': 'Gana {player}',
  Tie: 'Empate',
  'Duels won: {one}–{two} · tied: {ties}': 'Duelos ganados: {one}–{two} · empatados: {ties}',
  'New duel': 'Nuevo duelo',

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

  // Lo que pide el tutorial en cada paso, y sus dos salidas.
  'Close your hand on the mallet to pick it up':
    'Cierra la mano sobre el mazo para cogerlo',
  'Push the puck with it':
    'Empuja el disco con él',
  'Score a goal':
    'Marca un gol',
  'Press the grip button on the mallet to pick it up':
    'Pulsa el botón de agarre sobre el mazo para cogerlo',
  Next: 'Siguiente',
  'Skip tutorial': 'Saltar tutorial',
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

/** Un traductor que acepta cualquier frase: el del cartel del objetivo (`Traducir` de `objetivo.ts`). */
export type Traductor = (clave: string, valores?: Record<string, string | number>) => string

/**
 * El traductor que no exige que la frase esté en el diccionario: la que no está sale tal cual.
 *
 * Es el que recibe el cartel del objetivo, que traduce sus frases y además lo que le llega ya
 * dicho de fuera —la unidad del récord, que el salón pasa en el idioma de quien juega—.
 */
export function traductorSuave(lang: Lang): Traductor {
  return (frase, valores) => {
    // Con `hasOwnProperty` y no con `in`: una unidad que se llamara como algo de `Object` no es una frase.
    const dicho = lang === 'es' && Object.prototype.hasOwnProperty.call(ES, frase) ? ES[frase as TextKey] : frase
    return valores === undefined ? dicho : formatea(dicho, valores)
  }
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
