/**
 * Las ayudas visuales de Glide Hockey en Godot: lo que hay que hacer, enseñado sin una letra
 * (`components/game/Ayudas.tsx`). Las huellas en el suelo dicen dónde plantarse, de frente y a la
 * par; el mazo fantasma empujando hasta tocar el disco, qué se coge y qué se hace con él; el mando
 * de verdad a su lado con el agarre latiendo, con qué; y la marca calcada en la portería
 * contraria, adónde va lo que se golpea.
 *
 * **Ninguna se queda puesta.** Cuándo se enciende y se apaga cada una lo decide el guion de la web
 * (`lib/guionDeAyudas.ts`) sobre el motor común de los juegos (`lib/ayudas.ts`), los dos tal cual,
 * y las cotas de lo que se pinta son las suyas: aquí solo se pinta. Las dos que se levantan de la
 * mesa (el fantasma y el mando) se van con el mazo en la mano, que es antes de que el disco salga.
 *
 * **Todo se monta de una vez** y se enciende con `visible` y la opacidad: montar una malla a mitad
 * de partida es compilar un material a mitad de partida. Las huellas cuelgan del espacio de quien
 * juega; lo demás, de la mesa. Como en la web, **solo con el visor puesto** (`dando`); `-- --ayudas`
 * las enseña en plano.
 */
import { Node3D, Vector3, type MeshInstance3D, type StandardMaterial3D } from 'godot'

import { triangulosDeArco } from '@kit/lib/ui/iconos'
import { aro, cilindro, cuadro, malla, mallaPlana, opacidad, translucido, tumbar } from '@kit/runtime/escena/piezas'
import type { MandoDeVerdad } from '@kit/runtime/ui/mando'

import type { Hand } from '@/lib/ajustes'
import { COLOR_DE_LA_AYUDA, LATIDO, acercarse, avanzarLasAyudas, latido, pase, sinAyudas } from '@/lib/ayudas'
import { MALLET_RADIUS } from '@/lib/gameConfig'
import {
  CALCO_Y,
  EMPUJE,
  GUION_DE_AYUDAS,
  HUELLA,
  HUELLAS,
  HUELLAS_Y,
  MANDO_JUNTO_AL_MAZO,
  MARCA_DE_PORTERIA,
  mandoJuntoAlMazo,
  mazoFantasmaEn,
  type AyudaDelMazo,
  type HechoDeLasAyudas,
} from '@/lib/guionDeAyudas'

/** Lo transparente que llega a ponerse cada ayuda encendida del todo (`OPACIDAD` de `Ayudas.tsx`). */
export const OPACIDAD_DE_LA_AYUDA = { suelo: 0.75, gesto: 0.7, porteria: 0.72 } as const

/** Lo que mide el mazo fantasma: el aro al radio del mazo de verdad y un apunte de mango (`FANTASMA`). */
export const FANTASMA = { grosor: 0.008, mango: { radio: 0.02, alto: 0.05 } } as const

/** Por debajo de esto, una ayuda que se apaga ya no se pinta (el `> 0.004` de la web). */
const APAGADA = 0.004

/**
 * Dónde va el mando junto al mazo fantasma, en las coordenadas de la mesa (`JUNTO` de la web): a
 * un palmo del sitio donde nace el mazo, del lado de la mano buena, a la altura de la mano y con el
 * agarre de cara a los ojos.
 */
export function juntoAlMazo(mano: Hand = 'right'): { posicion: Vector3; giro: number; escala: number } {
  const { posicion, giro } = mandoJuntoAlMazo(mano)
  return { posicion: new Vector3(posicion.x, posicion.y, posicion.z), giro, escala: MANDO_JUNTO_AL_MAZO.escala }
}

/** Lo que las ayudas necesitan saber de la partida, cada fotograma. */
export interface MomentoDeLasAyudas {
  /** Con el visor puesto (o forzadas en plano): sin eso, no se enseñan ni corren sus plazos. */
  dando: boolean
  /** Lo hecho: la partida en marcha, el mazo en la mano, el primer golpe y el primer gol. */
  hechos: Readonly<Record<HechoDeLasAyudas, boolean>>
}

export class AyudasDelJuego {
  private readonly estado = sinAyudas()
  private readonly fuerzas: Record<AyudaDelMazo, number> = { suelo: 0, mando: 0, gesto: 0, porteria: 0 }
  private readonly huellas: { nodo: MeshInstance3D; material: StandardMaterial3D }[] = []
  readonly fantasma = new Node3D()
  private readonly pinturaDelFantasma: StandardMaterial3D[] = []
  readonly porteria: MeshInstance3D
  private readonly pinturaDeLaPorteria: StandardMaterial3D
  private reloj = 0
  private apagadas = false

  constructor(
    /** El espacio de quien juega: los pies en el origen. Ahí van las huellas. */
    suelo: Node3D,
    /** El espacio de la mesa: su centro, a la altura del tablero. Ahí va lo demás. */
    mesa: Node3D,
    /** El mando de verdad junto al mazo fantasma, ya plantado con `juntoAlMazo()`, o nada. */
    readonly mando: MandoDeVerdad | null = null,
  ) {
    for (const h of HUELLAS) {
      // Una huella es un óvalo: el círculo de doce lados estirado a lo largo del pie.
      const material = translucido(COLOR_DE_LA_AYUDA, 0, 3)
      const nodo = tumbar(malla(mallaPlana(triangulosDeArco(0, 1, 0, Math.PI * 2, 12)), material), h.x, HUELLAS_Y, h.z)
      nodo.scale = new Vector3(HUELLA.ancho / 2, HUELLA.largo / 2, 1)
      nodo.visible = false
      suelo.add_child(nodo)
      this.huellas.push({ nodo, material })
    }

    // El mazo fantasma: el aro calcado sobre la mesa y el mango apuntado, que sin él el aro se lee
    // como un agujero y no como algo que se coge. El aro de Godot ya va tumbado.
    this.fantasma.set_name('MazoFantasma')
    this.fantasma.visible = false
    const pintura = () => {
      const m = translucido(COLOR_DE_LA_AYUDA, 0, 4)
      this.pinturaDelFantasma.push(m)
      return m
    }
    const anilla = aro(MALLET_RADIUS, FANTASMA.grosor, pintura(), 24)
    anilla.position = new Vector3(0, CALCO_Y, 0)
    this.fantasma.add_child(anilla)
    this.fantasma.add_child(cilindro(FANTASMA.mango.radio, FANTASMA.mango.radio, FANTASMA.mango.alto, pintura(), new Vector3(0, FANTASMA.mango.alto / 2, 0), 10))
    mesa.add_child(this.fantasma)

    // La marca de la portería contraria, calcada en el fondo: por ahí pasa el disco.
    this.pinturaDeLaPorteria = translucido(COLOR_DE_LA_AYUDA, 0, 4)
    this.porteria = tumbar(cuadro(MARCA_DE_PORTERIA.ancho, MARCA_DE_PORTERIA.fondo, this.pinturaDeLaPorteria), 0, CALCO_Y, MARCA_DE_PORTERIA.z)
    this.porteria.set_name('MarcaDeLaPorteria')
    this.porteria.visible = false
    mesa.add_child(this.porteria)

    if (mando != null) mesa.add_child(mando.nodo)
  }

  /** Lo que se ve de cada ayuda ahora mismo, de 0 a 1. */
  get fuerza(): Readonly<Record<AyudaDelMazo, number>> {
    return this.fuerzas
  }

  /** El reloj de las ayudas: las capturas esperan a que estén encendidas del todo. */
  get segundos(): number {
    return this.reloj
  }

  actualizar(delta: number, momento: MomentoDeLasAyudas): void {
    this.reloj += delta
    const { dando } = momento
    const paso = avanzarLasAyudas(GUION_DE_AYUDAS, momento.hechos, this.estado, dando ? delta : 0)
    let alguna = false
    for (const ayuda of GUION_DE_AYUDAS) {
      const quiere = dando && paso.encendidas.has(ayuda.id) ? 1 : 0
      this.fuerzas[ayuda.id] = acercarse(this.fuerzas[ayuda.id], quiere, delta)
      if (this.fuerzas[ayuda.id] > APAGADA) alguna = true
    }
    // Todas apagadas y ya escondidas: nada que pintar, y no se toca el motor.
    if (!alguna && this.apagadas) return
    this.apagadas = !alguna
    const pulso = latido(this.reloj, LATIDO.fuerza)

    // Las huellas, latiendo: es lo que las separa de una mancha de la moqueta.
    const suelo = this.fuerzas.suelo
    for (const h of this.huellas) {
      h.nodo.visible = suelo > APAGADA
      opacidad(h.material, suelo * OPACIDAD_DE_LA_AYUDA.suelo * pulso)
    }

    // El mazo fantasma, dando su empujón: se recoge despacio y empuja deprisa hasta tocar el disco.
    const gesto = this.fuerzas.gesto
    this.fantasma.visible = gesto > APAGADA
    const donde = mazoFantasmaEn(pase(this.reloj, EMPUJE.periodo).avance)
    this.fantasma.position = new Vector3(donde.x, 0, donde.z)
    for (const m of this.pinturaDelFantasma) opacidad(m, gesto * OPACIDAD_DE_LA_AYUDA.gesto * pulso)

    // La marca de la portería **no late**: se queda mientras se juega, y algo que palpita mientras
    // el disco cruza la mesa roba la mirada justo cuando hace falta en otro sitio.
    const porteria = this.fuerzas.porteria
    this.porteria.visible = porteria > APAGADA
    opacidad(this.pinturaDeLaPorteria, porteria * OPACIDAD_DE_LA_AYUDA.porteria)

    // El mando se apaga escondiéndolo, no desmontándolo: volver a enseñarlo recompilaría el modelo.
    const mando = this.mando
    if (mando != null) {
      if (this.fuerzas.mando > APAGADA) {
        mando.encender('agarre')
        mando.actualizar(delta)
      } else mando.apagar()
    }
  }

  /** Lo que de verdad se ve: las ayudas con algo pintado ahora mismo. */
  visibles(): AyudaDelMazo[] {
    const visible: Record<AyudaDelMazo, boolean> = {
      suelo: this.huellas.some((h) => h.nodo.visible),
      mando: this.mando?.visible ?? false,
      gesto: this.fantasma.visible,
      porteria: this.porteria.visible,
    }
    return GUION_DE_AYUDAS.map((a) => a.id).filter((id) => visible[id])
  }
}
