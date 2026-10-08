'use client'

import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Group } from 'three'
import { pulsoDelFestejo, listonCruzado, SEGUNDOS_DE_FESTEJO, type Medalla, type VistaDelCartel } from '../../lib/objetivo'
import { PALETA } from '../../lib/paleta'
import { CanvasPanel, drawText, roundedRect } from './canvasPanel'
import { MIN_ANGULO, altoMinimo } from './legibilidad'

/**
 * El cartel del objetivo: qué hay que superar, de frente y sin tapar el juego.
 *
 * Es el mismo fichero en todos los juegos del salón (lo que dice sale de `lib/objetivo.ts`, que
 * cuenta cómo se monta). Cada juego le da el sitio, la orientación y la distancia a la que se
 * lee: de pie sobre una diana a dos metros o a veinte, o tumbado en el suelo.
 *
 * **Se dibuja una vez y se agranda con la distancia.** Lo que decide si una letra se lee es lo
 * que ocupa en el ojo, así que el cartel mide siempre los mismos grados: está pintado para leerse
 * a `DISTANCIA_DE_DIBUJO` y el grupo se escala a la distancia de verdad. Así la textura es la
 * misma, y pequeña, a dos metros que a veinte, y cambiar de distancia no la rehace.
 *
 * Cuesta una llamada de dibujo: el fondo, las dos líneas y la barra van en el mismo lienzo.
 */

/** A qué distancia se lee el cartel tal y como se dibuja, en metros. */
export const DISTANCIA_DE_DIBUJO = 2

/** Lo que miden esos grados de ángulo visual a la distancia de dibujo, en metros. */
function grados(angulo: number): number {
  return (altoMinimo(DISTANCIA_DE_DIBUJO) * angulo) / MIN_ANGULO
}

/**
 * La letra, en grados de ángulo visual: lo que se lee de un vistazo mientras se juega, que es
 * casi el doble del mínimo de `legibilidad.ts`. Una frase larga encoge hasta caber, y el test
 * del panel avisa si alguna baja del mínimo.
 */
export const LETRA_DEL_CARTEL = { titulo: grados(1.4), detalle: grados(1.2) }

/**
 * Con tres líneas (el final con su `pie`) la letra baja un poco para caber en el mismo cartel: se
 * lee parado, sin nada que hacer más que leer, y sigue por encima del mínimo.
 */
export const LETRA_CON_PIE = { titulo: grados(1.2), detalle: grados(1.0), aire: grados(0.25) }

/** El cartel a la distancia de dibujo: 24° de ancho por 4,5° de alto. */
export const PANEL_DEL_CARTEL = { width: grados(24), height: grados(4.5) }

const MARGEN = grados(0.5)
const AIRE = grados(0.35)
const ALTO_DE_LA_BARRA = grados(0.35)
const ANCHO_UTIL = PANEL_DEL_CARTEL.width - 2 * MARGEN

/** Lo que mide el cartel por cada metro de distancia de lectura: para decidir dónde cabe. */
export function proporcionDelCartel(): { ancho: number; alto: number } {
  return { ancho: PANEL_DEL_CARTEL.width / DISTANCIA_DE_DIBUJO, alto: PANEL_DEL_CARTEL.height / DISTANCIA_DE_DIBUJO }
}

/** Cuánto hay que agrandar el cartel para que se lea igual a esa distancia. */
export function escalaDelCartel(distancia: number): number {
  return distancia / DISTANCIA_DE_DIBUJO
}

/**
 * Pinta el cartel entero. Aparte del componente para poder **medirlo** con el lienzo que apunta
 * (`legibilidad.ts`): lo que decide si se lee es lo que acaba escrito.
 *
 * @param festejo La medalla cuyo listón se acaba de cruzar, mientras dura la celebración.
 */
export function dibujarElCartel(
  ctx: CanvasRenderingContext2D,
  vista: VistaDelCartel,
  festejo: Medalla | null = null,
): void {
  const { width, height } = PANEL_DEL_CARTEL
  const acento = festejo ?? vista.medalla
  const pie = vista.pie ?? null
  const letra = pie == null ? { ...LETRA_DEL_CARTEL, aire: AIRE } : LETRA_CON_PIE

  roundedRect(ctx, 0, 0, width - grados(0.1), height - grados(0.1), grados(0.5))
  // Translúcido: lo que pase por detrás se sigue adivinando. Lo que no cuenta, más todavía.
  ctx.fillStyle = `${PALETA.fondo}${vista.discreto ? '99' : 'e0'}`
  ctx.fill()
  ctx.lineWidth = grados(festejo == null ? 0.06 : 0.16)
  ctx.strokeStyle = festejo == null ? PALETA.borde : PALETA[festejo]
  ctx.stroke()

  // Lo que hay se reparte centrado: una línea sola queda en medio, no colgada de arriba.
  const filas = [
    letra.titulo,
    ...(vista.detalle == null ? [] : [letra.detalle]),
    ...(pie == null ? [] : [letra.detalle]),
    ...(vista.barra == null ? [] : [ALTO_DE_LA_BARRA]),
  ]
  const alto = filas.reduce((suma, fila) => suma + fila, 0) + letra.aire * (filas.length - 1)
  let y = alto / 2

  // Mientras se celebra, el título dice la medalla: el color solo no se entiende.
  drawText(ctx, festejo != null && vista.vitor != null ? vista.vitor : vista.titulo, 0, y - letra.titulo / 2, {
    size: letra.titulo,
    color: festejo != null ? PALETA[festejo] : vista.discreto ? PALETA.textoSuave : PALETA.texto,
    weight: '700',
    maxWidth: ANCHO_UTIL,
  })
  y -= letra.titulo + letra.aire

  for (const linea of [vista.detalle, pie]) {
    if (linea == null) continue
    drawText(ctx, linea, 0, y - letra.detalle / 2, {
      size: letra.detalle,
      color: PALETA.textoSuave,
      maxWidth: ANCHO_UTIL,
    })
    y -= letra.detalle + letra.aire
  }

  if (vista.barra != null) {
    const centro = y - ALTO_DE_LA_BARRA / 2
    roundedRect(ctx, 0, centro, ANCHO_UTIL, ALTO_DE_LA_BARRA, ALTO_DE_LA_BARRA / 2)
    ctx.fillStyle = PALETA.borde
    ctx.fill()
    const lleno = ANCHO_UTIL * vista.barra
    if (lleno > 0) {
      // Desde la izquierda, con la esquina redonda mientras quepa.
      roundedRect(ctx, -ANCHO_UTIL / 2 + lleno / 2, centro, lleno, ALTO_DE_LA_BARRA, Math.min(ALTO_DE_LA_BARRA, lleno) / 2)
      ctx.fillStyle = acento == null ? PALETA.acento : PALETA[acento]
      ctx.fill()
    }
  }
}

/** Si quien juega ha pedido que las cosas no se muevan solas. */
function sinBalanceos(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

export interface CartelDeObjetivoProps {
  /** Lo que dice, ya traducido: sale de `cartelDeObjetivo()`. Con `useMemo`: cada vista nueva repinta. */
  vista: VistaDelCartel
  /** Dónde va su centro, en las coordenadas del grupo del que cuelga. */
  position: readonly [number, number, number]
  /**
   * Cómo se orienta, como el `rotation` de three. Sin nada, de pie y mirando a +Z; inclinado
   * hacia los ojos de quien lo lee se lee de frente, y con `[-Math.PI / 2, 0, 0]` queda tumbado
   * en el suelo.
   */
  rotation?: readonly [number, number, number] | readonly [number, number, number, 'YXZ']
  /** A cuántos metros de los ojos queda: de ahí sale su tamaño. Tumbado, la del escorzo. */
  distancia: number
  /** La medalla que ya es de quien juega (`medallaQueCelebra`). Cuando sube, el cartel lo celebra. */
  celebra?: Medalla | null
  /** Se llama una vez por listón cruzado: aquí pone el juego su sonido corto y su pulso en el mando. */
  alCelebrar?: (medalla: Medalla) => void
}

export function CartelDeObjetivo({
  vista,
  position,
  rotation = [0, 0, 0],
  distancia,
  celebra = null,
  alCelebrar,
}: CartelDeObjetivoProps) {
  const grupo = useRef<Group>(null)
  const escala = escalaDelCartel(distancia)

  // La celebración sale de comparar la medalla de ahora con la del render anterior. Montado
  // con una medalla ya ganada no hay nada que celebrar: no se ha visto cruzar el listón.
  const [anterior, setAnterior] = useState(celebra)
  const [festejo, setFestejo] = useState<{ medalla: Medalla } | null>(null)
  if (anterior !== celebra) {
    setAnterior(celebra)
    const cruzado = listonCruzado(anterior, celebra)
    setFestejo(cruzado == null ? null : { medalla: cruzado })
  }

  // El aviso se lee del último render: quien pasa una función nueva cada vez no repite nada.
  const avisar = useRef(alCelebrar)
  useEffect(() => {
    avisar.current = alCelebrar
  }, [alCelebrar])

  const avisado = useRef<object | null>(null)
  const empezo = useRef<number | null>(null)
  useEffect(() => {
    if (festejo == null) return
    // Una vez por listón, aunque el efecto se repita.
    if (avisado.current !== festejo) {
      avisado.current = festejo
      empezo.current = null
      avisar.current?.(festejo.medalla)
    }
    const reloj = setTimeout(() => setFestejo(null), SEGUNDOS_DE_FESTEJO * 1000)
    return () => clearTimeout(reloj)
  }, [festejo])

  // El pulso de la celebración, por referencia: es un grupo que crece y vuelve, no un estado.
  useFrame(({ clock }) => {
    const nodo = grupo.current
    if (nodo == null) return
    if (festejo == null || sinBalanceos()) {
      nodo.scale.setScalar(escala)
      return
    }
    empezo.current ??= clock.elapsedTime
    nodo.scale.setScalar(escala * pulsoDelFestejo(clock.elapsedTime - empezo.current))
  })

  const medalla = festejo?.medalla ?? null
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => dibujarElCartel(ctx, vista, medalla),
    [vista, medalla],
  )

  return (
    <group ref={grupo} name="cartel-de-objetivo" position={[...position] as [number, number, number]} rotation={rotation as [number, number, number]} scale={escala}>
      <CanvasPanel
        width={PANEL_DEL_CARTEL.width}
        height={PANEL_DEL_CARTEL.height}
        draw={draw}
        fallbackColor={PALETA.fondo}
      />
    </group>
  )
}
