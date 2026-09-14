'use client'

import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { NO_RAYCAST } from '../raycast'

/**
 * Un panel de interfaz pintado en un canvas 2D.
 *
 * Es la única forma de poner texto dentro del Canvas de three en este proyecto:
 * el `<Text>` de drei descarga la fuente de un CDN y la CSP del salón
 * (`connect-src 'self'`) lo bloquea, así que la partida se quedaría sin
 * marcador justo donde más falta hace, dentro del visor. `fillText` usa las
 * fuentes que ya tiene el sistema y no pide nada por la red.
 *
 * El dibujo trabaja en METROS y con la `y` hacia arriba —las mismas
 * coordenadas con las que se colocan las cajas que recogen la pulsación—, para
 * que lo que se pinta y lo que se pulsa no puedan separarse.
 */

/**
 * Pinta el panel **antes** de que se vea, no después.
 *
 * El lienzo se borra entero y se vuelve a pintar en cada cambio, y el material del panel es
 * transparente —las esquinas del rectángulo redondeado lo piden—. Con un efecto normal,
 * entre el borrado y el repintado cabe un fotograma con el lienzo en blanco: el panel se ve
 * **transparente**, y en realidad aumentada eso no es negro, es la habitación de quien
 * juega. Reportado con el visor puesto: «al pulsar un botón es como que el botón desaparece
 * y se ve mi salón». Un efecto de diseño corre antes de que el navegador pinte, así que ese
 * hueco no existe.
 *
 * En el servidor no hay nada que pintar y `useLayoutEffect` avisaría por consola; el salón
 * de xrcade prerenderiza la página que contiene el Canvas, así que allí se usa el otro.
 */
const usePintarAntesDeVer = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** Cuántos píxeles de textura por metro de panel. A un brazo de distancia se lee. */
export const PANEL_PIXELS_PER_METER = 1024

/** El canvas donde se pinta el panel, del tamaño que le toca a esas medidas. */
function usePanelCanvas(width: number, height: number): HTMLCanvasElement | null {
  return useMemo(() => {
    // El Canvas de R3F solo se monta en el navegador, pero el salón de xrcade
    // prerenderiza la página que lo contiene.
    if (typeof document === 'undefined') return null

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * PANEL_PIXELS_PER_METER)
    canvas.height = Math.round(height * PANEL_PIXELS_PER_METER)
    return canvas.getContext('2d') == null ? null : canvas
  }, [width, height])
}

/**
 * Escribe una línea derecha en un dibujo con la `y` hacia arriba.
 *
 * El texto se pinta siempre con la `y` hacia abajo, así que hay que deshacer la
 * inversión justo aquí y solo aquí; si no, todo saldría del revés.
 */
/**
 * Lo que ocupa de alto la caja de una línea, en fracción del tamaño pedido.
 *
 * No es el tamaño entero: entre las mayúsculas de un renglón y los rabos de las
 * letras del de abajo hay aire, y contarlo entero daría por pisadas dos líneas que
 * se leen perfectamente. Lo usa quien coloca —para saber cuánto baja lo siguiente—
 * y lo usa el instrumento que mide (`legibilidad.ts`), que lee esta misma y no una
 * copia: dos copias acabarían midiendo algo distinto de lo que se pinta.
 */
export const ALTO_DE_LINEA = 0.8

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  {
    size,
    color,
    align = 'center',
    weight = '600',
    maxWidth,
  }: {
    size: number
    color: string
    align?: CanvasTextAlign
    weight?: string
    /**
     * Lo ancho que puede ocupar, en metros. Lo que no quepa se escribe más
     * pequeño: aquí no hay forma de comprobar a ojo si una etiqueta cabe en su
     * botón, y la que se sale se lee encima de la de al lado.
     */
    maxWidth?: number
  },
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(1, -1)
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.font = `${weight} ${size}px system-ui, sans-serif`

  // Se encoge la letra en vez de estrecharla —que es lo que hace `fillText` con
  // su propio máximo—: un texto condensado en un panel a un brazo de distancia
  // se lee mucho peor que el mismo texto un punto más pequeño.
  if (maxWidth != null) {
    const width = ctx.measureText(text).width
    if (width > maxWidth) ctx.font = `${weight} ${(size * maxWidth) / width}px system-ui, sans-serif`
  }

  ctx.fillText(text, 0, 0)
  ctx.restore()
}

/**
 * Reparte un texto en las líneas que quepan de ese ancho.
 *
 * **Encoger no vale para una frase.** Una etiqueta de botón que no cabe se lee bien un punto
 * más pequeña; una frase entera encogida hasta caber de una sola línea acaba en letra de dos
 * centímetros dentro del visor, que es donde se descubrió: los tutoriales estaban escritos y
 * no se entendía ninguno.
 *
 * Corta por espacios, y una palabra que no quepa ella sola se queda igualmente en su línea:
 * partirla por la mitad se lee peor que dejarla asomar.
 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const palabras = text.split(/\s+/).filter((palabra) => palabra.length > 0)
  if (palabras.length === 0) return []

  const lineas: string[] = []
  let actual = palabras[0]
  for (const palabra of palabras.slice(1)) {
    const probada = `${actual} ${palabra}`
    if (ctx.measureText(probada).width <= maxWidth) actual = probada
    else {
      lineas.push(actual)
      actual = palabra
    }
  }
  lineas.push(actual)
  return lineas
}

/**
 * Escribe un texto en varias líneas, centrado en `y`.
 *
 * `y` es el centro del bloque y no la primera línea: así una frase de dos líneas y otra de
 * una quedan en el mismo sitio, y el panel no da un salto al cambiar de tramo del tutorial.
 */
export function drawParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  {
    size,
    color,
    weight = '600',
    maxWidth,
    lineHeight = 1.35,
    anchor = 'middle',
  }: {
    size: number
    color: string
    weight?: string
    maxWidth: number
    lineHeight?: number
    /**
     * Dónde cae la `y` que se le da: en el centro del bloque (lo de siempre) o en su
     * **borde de arriba**.
     *
     * Centrado, un párrafo que pasa de dos líneas a tres crece hacia arriba y se
     * mete en lo que tenga encima —y con el visor puesto eso es un rótulo pisado
     * que nadie ve hasta la sesión de pruebas—. Anclado arriba, crece solo hacia
     * abajo y quien lo coloca sabe cuánto ocupa (`alturaDelParrafo`).
     */
    anchor?: 'middle' | 'top'
  },
): void {
  const lineas = medirLineas(ctx, text, { size, weight, maxWidth })
  const paso = size * lineHeight
  const centrado = y + (paso * (lineas.length - 1)) / 2
  const arriba = anchor === 'top' ? y - (size * ALTO_DE_LINEA) / 2 : centrado
  lineas.forEach((linea, index) => {
    drawText(ctx, linea, x, arriba - index * paso, { size, color, weight })
  })
}

/** En cuántas líneas se reparte un texto, sin pintarlo. */
function medirLineas(
  ctx: CanvasRenderingContext2D,
  text: string,
  { size, weight, maxWidth }: { size: number; weight: string; maxWidth: number },
): string[] {
  ctx.save()
  ctx.font = `${weight} ${size}px system-ui, sans-serif`
  const lineas = wrapText(ctx, text, maxWidth)
  ctx.restore()
  return lineas
}

/**
 * Cuánto ocupa un párrafo de alto, para poder colocar lo que va debajo.
 *
 * Hay que medirlo y no suponerlo: el mismo texto ocupa dos líneas en inglés y tres
 * en español, y lo de debajo tiene que bajar con él.
 */
export function alturaDelParrafo(
  ctx: CanvasRenderingContext2D,
  text: string,
  {
    size,
    weight = '600',
    maxWidth,
    lineHeight = 1.35,
  }: { size: number; weight?: string; maxWidth: number; lineHeight?: number },
): number {
  const lineas = medirLineas(ctx, text, { size, weight, maxWidth })
  return (lineas.length - 1) * size * lineHeight + size * ALTO_DE_LINEA
}

/** Un rectángulo con las esquinas redondeadas, que es la forma de todo aquí. */
export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath()
  ctx.roundRect(x - width / 2, y - height / 2, width, height, radius)
}

/**
 * La placa del panel: un plano con el dibujo encima.
 *
 * La textura se declara como elemento de R3F y no se crea a mano porque así la
 * libera él al desmontar: una textura de un megapíxel que nadie suelta es
 * memoria de la tarjeta gráfica que no vuelve.
 *
 * `draw` tiene que venir envuelto en `useCallback`: es lo que decide cuándo hay
 * que volver a pintar.
 */
export function CanvasPanel({
  width,
  height,
  draw,
  fallbackColor,
  everyFrame = false,
}: {
  width: number
  height: number
  draw: (ctx: CanvasRenderingContext2D) => void
  fallbackColor: string
  /**
   * El dibujo se mueve solo: se repinta cada fotograma, sin pasar por React.
   *
   * Lo pide quien anima algo dentro del panel. Sin esto habría que guardar el avance en
   * estado y `setState` a noventa hercios repinta el árbol entero del juego noventa veces por
   * segundo, que es como se veía: la pantalla parpadeando y sin poder elegir nada.
   */
  everyFrame?: boolean
}) {
  const canvas = usePanelCanvas(width, height)
  const texture = useRef<CanvasTexture>(null)

  const pintar = useCallback(() => {
    const ctx = canvas?.getContext('2d')
    if (canvas == null || ctx == null) return

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.scale(PANEL_PIXELS_PER_METER, -PANEL_PIXELS_PER_METER)

    draw(ctx)

    // Sin esto el dibujo se queda en el canvas y no llega a la tarjeta gráfica:
    // el panel se vería con lo que decía la primera vez.
    const map = texture.current
    if (map != null) map.needsUpdate = true
  }, [canvas, draw])

  usePintarAntesDeVer(() => {
    if (everyFrame) return
    pintar()
  }, [everyFrame, pintar])

  // Un panel que se anima se repinta **por fotograma y sin pasar por React**. Es para lo que
  // existe `everyFrame`: la demostración del gesto movía su dibujo guardando el avance en
  // estado, y un `setState` a noventa hercios repinta el árbol entero del juego noventa veces
  // por segundo. Eso es lo que se veía como «la pantalla parpadea y no deja seleccionar nada».
  useFrame(() => {
    if (everyFrame) pintar()
  })

  return (
    <mesh raycast={NO_RAYCAST}>
      <planeGeometry args={[width, height]} />
      {/*
        **Sin escribir profundidad.** El lienzo es casi todo transparente —solo hay letras—
        pero un material transparente **sí apunta su profundidad** salvo que se le diga que
        no, y entonces tapa lo que tenga detrás aunque no se vea nada pintado. Eso es lo que
        dejaba el botón de jugar de air-hockey sin su placa azul: el lienzo del panel va por
        delante de los botones, y todo lo que quedaba detrás desaparecía. Reportado con el
        visor puesto: «el botón de play no se ve en azul, está como sombreado».
      */}
      <meshBasicMaterial
        transparent
        depthWrite={false}
        color={canvas == null ? fallbackColor : undefined}
      >
        {canvas == null ? null : (
          <canvasTexture
            ref={texture}
            attach="map"
            args={[canvas]}
            colorSpace={SRGBColorSpace}
            anisotropy={4}
          />
        )}
      </meshBasicMaterial>
    </mesh>
  )
}

/**
 * La flecha de **salir del juego**, dibujada en el lienzo.
 *
 * **Una sola forma para los trece.** Cada juego decía «salir» a su manera: seis con la
 * palabra «Exit», tres con un aspa, dos con una puerta, uno con una puerta y una flecha, y
 * uno con un aspa llamada puerta. Y varios usan además el aspa para otra cosa —cerrar el
 * panel, volver al menú—, así que el mismo dibujo significaba dos cosas distintas según el
 * juego. Reportado con el visor puesto: «no se entiende cuál es el botón de salir del juego:
 * a veces aparece un cuadrado, otras veces pone "leave"… habría que unificarlo».
 *
 * Es una flecha hacia atrás porque eso es lo que hace el botón: **volver al arcade**. El
 * aspa, que era la otra candidata, ya significa «cerrar esto» en varios paneles.
 *
 * Las proporciones van en `FLECHA_DE_SALIR` para que el icono de tres dimensiones de los
 * juegos que no pintan su menú en un lienzo salga con la misma forma.
 */
export const FLECHA_DE_SALIR = {
  /** La punta, a la izquierda del centro, medida en altos del icono. */
  punta: -0.5,
  /** Y el final del palo, a la derecha. */
  cuerpo: 0.42,
  /** Lo gordo que es el palo. */
  grosor: 0.3,
  /** Dónde empieza el palo, que es donde acaban las alas. */
  codo: -0.06,
  /** Lo abiertas que van las alas: la mitad del alto del icono. */
  alas: 0.5,
}

/** Pinta la flecha de salir centrada en `x, y`, con ese alto y ese color. */
export function dibujarFlechaDeSalir(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  alto: number,
  color: string,
): void {
  const { punta, cuerpo, grosor, codo, alas } = FLECHA_DE_SALIR
  ctx.beginPath()
  ctx.moveTo(x + punta * alto, y)
  ctx.lineTo(x + codo * alto, y + alas * alto)
  ctx.lineTo(x + codo * alto, y + (grosor / 2) * alto)
  ctx.lineTo(x + cuerpo * alto, y + (grosor / 2) * alto)
  ctx.lineTo(x + cuerpo * alto, y - (grosor / 2) * alto)
  ctx.lineTo(x + codo * alto, y - (grosor / 2) * alto)
  ctx.lineTo(x + codo * alto, y - alas * alto)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}
