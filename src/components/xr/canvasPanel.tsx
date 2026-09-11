'use client'

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
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
  }: {
    size: number
    color: string
    weight?: string
    maxWidth: number
    lineHeight?: number
  },
): void {
  ctx.save()
  ctx.font = `${weight} ${size}px system-ui, sans-serif`
  const lineas = wrapText(ctx, text, maxWidth)
  ctx.restore()

  const paso = size * lineHeight
  const arriba = y + (paso * (lineas.length - 1)) / 2
  lineas.forEach((linea, index) => {
    drawText(ctx, linea, x, arriba - index * paso, { size, color, weight })
  })
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
}: {
  width: number
  height: number
  draw: (ctx: CanvasRenderingContext2D) => void
  fallbackColor: string
}) {
  const canvas = usePanelCanvas(width, height)
  const texture = useRef<CanvasTexture>(null)

  usePintarAntesDeVer(() => {
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

  return (
    <mesh raycast={NO_RAYCAST}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial transparent color={canvas == null ? fallbackColor : undefined}>
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
