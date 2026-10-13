'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { Euler, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { BACK_NEONS } from '../../lib/scoreboardSign'
import { TABLE_CENTER_Z } from '../../lib/gameConfig'
import { PALETTE } from '../../lib/palette'

/**
 * El salón recreativo donde está la mesa: moqueta con dibujo, máquinas
 * apagadas contra las paredes, neones y la luz baja de un sitio así.
 *
 * No es decoración: con el visor puesto, una mesa flotando en negro marea y no
 * hay forma de calcular distancias. Lo que da la escala son las cosas conocidas
 * alrededor —el alto de una máquina, dónde acaba el suelo—, y eso es lo que
 * deja jugar de pie sin perder el sitio. Y es el sitio que le toca: una mesa de
 * air hockey es el mueble que uno se encuentra en un salón recreativo, que es
 * literalmente lo que es xrcade.
 *
 * Todo es geometría por código y colores planos: la política de seguridad del
 * salón no deja descargar texturas ni modelos (ver `docs/xrcade.md`), y de paso
 * el juego pesa lo que pesa.
 *
 * En realidad mixta no se dibuja nada de esto: ahí el sitio es la habitación de
 * quien juega y taparla rompería el passthrough.
 */

/** La moqueta oscura de un recreativo y las bandas de su dibujo. */
const CARPET_COLOR = '#141d33'
const CARPET_STRIPE_COLOR = '#1b2748'
/** Las paredes y su zócalo. */
const WALL_COLOR = '#0b1220'
const WALL_TRIM_COLOR = '#070d17'
/**
 * El techo, un punto más oscuro que las paredes.
 *
 * **No es decoración.** Sin él, levantar la vista con el visor puesto enseñaba el negro del
 * compositor: no el negro de una sala a oscuras, sino la nada, que es lo que le dice al ojo
 * que esto no es un sitio. Cierra la sala por arriba y ya está.
 */
const CEILING_COLOR = '#070b14'

/**
 * El fondo de la escena: lo que se ve donde no hay nada dibujado.
 *
 * Sale de aquí y no del `<Canvas>` porque es del sitio, no del anfitrión: montado en el
 * salón, el hub retira el suyo al entrar en la cabina, y el juego que no traiga el suyo se
 * queda con el negro del compositor. Del tono del techo, para que el borde de la sala no se
 * recorte contra él.
 */
export const ROOM_BACKDROP = CEILING_COLOR
/** Los muebles de las máquinas, y la pantalla apagada de cada una. */
const CABINET_COLOR = '#24304d'
const SCREEN_COLOR = '#0a1424'
/** Los neones de la pared: rosa y cian, que es lo que hay en estos sitios. */
const NEON_PINK = '#f43f5e'
const NEON_CYAN = '#38bdf8'
/** El color de cada tira de `NEONES_DEL_FONDO`, de arriba abajo. */
const NEON_COLORS = [NEON_PINK, NEON_CYAN] as const

/** Lo que ocupa la sala. */
const ROOM_WIDTH = 9
const ROOM_DEPTH = 10
const ROOM_HEIGHT = 3.4
/** Las máquinas, del tamaño de una recreativa de verdad. */
const CABINET = { width: 0.8, height: 1.85, depth: 0.75 }

/** Una copia de una malla instanciada: dónde va, cómo gira y cuánto mide. */
interface Copy {
  position: readonly [number, number, number]
  rotation?: readonly [number, number, number]
  scale?: readonly [number, number, number]
}

/**
 * Coloca las copias de una malla instanciada. Se hace una sola vez: nada de
 * esto se mueve, y una sala entera de cosas quietas no tiene por qué costar una
 * llamada de dibujo por cosa.
 */
function usePlaced(copies: readonly Copy[]): React.RefObject<InstancedMesh | null> {
  const node = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    // La malla se monta con el grupo; el resguardo es para TypeScript.
    const mesh = node.current
    /* v8 ignore next */
    if (mesh == null) return
    const matrix = new Matrix4()
    const quaternion = new Quaternion()
    copies.forEach((copy, index) => {
      const [rx, ry, rz] = copy.rotation ?? [0, 0, 0]
      const [sx, sy, sz] = copy.scale ?? [1, 1, 1]
      quaternion.setFromEuler(new Euler(rx, ry, rz))
      matrix.compose(new Vector3(...copy.position), quaternion, new Vector3(sx, sy, sz))
      mesh.setMatrixAt(index, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [copies])

  return node
}

/** Dónde está cada recreativa y hacia dónde mira. */
interface CabinetSpot {
  x: number
  z: number
  rotation: number
}

/**
 * Las diez recreativas de la sala, **en tres mallas** y no en treinta.
 *
 * Son diez cajas idénticas con dos carteles cada una: pintadas de una en una
 * costaban treinta llamadas de dibujo, más de la mitad del presupuesto de la
 * escena entera, para diez muebles que no se mueven. Instanciadas cuestan tres,
 * una por material, y se ven exactamente igual.
 *
 * Cada malla se coloca a mano con su matriz porque no cambian nunca: se hace
 * una vez al montar la sala y nadie las vuelve a tocar.
 */
function Cabinets({ spots }: { spots: readonly CabinetSpot[] }) {
  const bodies = useRef<InstancedMesh>(null)
  const screens = useRef<InstancedMesh>(null)
  const signs = useRef<InstancedMesh>(null)

  const matrices = useMemo(() => {
    const scratch = new Matrix4()
    const rotation = new Quaternion()
    const one = new Vector3(1, 1, 1)
    const place = (spot: CabinetSpot, local: Vector3, tilt: number) => {
      // La posición local del trozo, girada como el mueble y llevada a su sitio.
      const offset = local.clone().applyAxisAngle(new Vector3(0, 1, 0), spot.rotation)
      rotation.setFromEuler(new Euler(tilt, spot.rotation, 0))
      return scratch
        .compose(new Vector3(spot.x + offset.x, offset.y, spot.z + offset.z), rotation, one)
        .clone()
    }
    return {
      bodies: spots.map((spot) => place(spot, new Vector3(0, CABINET.height / 2, 0), 0)),
      screens: spots.map((spot) => place(spot, new Vector3(0, 1.35, CABINET.depth / 2 + 0.01), -0.18)),
      signs: spots.map((spot) => place(spot, new Vector3(0, CABINET.height - 0.18, CABINET.depth / 2 + 0.01), 0)),
    }
  }, [spots])

  useLayoutEffect(() => {
    for (const [node, list] of [
      [bodies.current, matrices.bodies],
      [screens.current, matrices.screens],
      [signs.current, matrices.signs],
    ] as const) {
      // Las tres se montan a la vez; el resguardo es para que TypeScript sepa
      // que existen.
      /* v8 ignore next */
      if (node == null) continue
      list.forEach((matrix, index) => node.setMatrixAt(index, matrix))
      node.instanceMatrix.needsUpdate = true
    }
  }, [matrices])

  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, spots.length]} castShadow receiveShadow>
        <boxGeometry args={[CABINET.width, CABINET.height, CABINET.depth]} />
        <meshStandardMaterial color={CABINET_COLOR} roughness={0.85} />
      </instancedMesh>
      {/* La pantalla, apagada y algo inclinada, que es como se ven de lejos. */}
      <instancedMesh ref={screens} args={[undefined, undefined, spots.length]}>
        <planeGeometry args={[CABINET.width * 0.78, 0.5]} />
        <meshBasicMaterial color={SCREEN_COLOR} toneMapped={false} />
      </instancedMesh>
      {/* El cartel de arriba, encendido: es lo único que ilumina la fila. */}
      <instancedMesh ref={signs} args={[undefined, undefined, spots.length]}>
        <planeGeometry args={[CABINET.width * 0.86, 0.26]} />
        <meshBasicMaterial color={PALETTE.primaryDeep} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

export function Room() {
  const centre = TABLE_CENTER_Z
  /** Las bandas del dibujo de la moqueta, todas iguales. */
  const stripeCopies = useMemo<Copy[]>(
    () => [-4, -2, 0, 2, 4].map((x) => ({ position: [x, 0.002, centre] as const, rotation: [-Math.PI / 2, 0, 0] as const })),
    [centre],
  )

  /**
   * Las tres paredes que se ven desde el sitio de quien juega —la cuarta queda
   * a su espalda— y sus zócalos. Miden distinto, así que cada copia lleva su
   * escala: el plano instanciado es de un metro por un metro.
   */
  const sides = useMemo(
    () => [
      { position: [0, 0, centre - ROOM_DEPTH / 2] as const, rotation: 0, width: ROOM_WIDTH },
      { position: [-ROOM_WIDTH / 2, 0, centre] as const, rotation: Math.PI / 2, width: ROOM_DEPTH },
      { position: [ROOM_WIDTH / 2, 0, centre] as const, rotation: -Math.PI / 2, width: ROOM_DEPTH },
    ],
    [centre],
  )
  const wallCopies = useMemo<Copy[]>(
    () =>
      sides.map((side) => ({
        position: [side.position[0], ROOM_HEIGHT / 2, side.position[2]] as const,
        rotation: [0, side.rotation, 0] as const,
        scale: [side.width, ROOM_HEIGHT, 1] as const,
      })),
    [sides],
  )
  const trimCopies = useMemo<Copy[]>(
    () =>
      sides.map((side) => ({
        position: [side.position[0], 0.18, side.position[2]] as const,
        rotation: [0, side.rotation, 0] as const,
        scale: [side.width, 0.36, 1] as const,
      })),
    [sides],
  )

  const stripes = usePlaced(stripeCopies)
  const walls = usePlaced(wallCopies)
  const trims = usePlaced(trimCopies)

  const cabinets = useMemo<CabinetSpot[]>(
    () => [
      ...[-2.6, -1.5, 1.5, 2.6].map((x) => ({ x, z: centre - ROOM_DEPTH / 2 + 0.5, rotation: 0 })),
      ...[-1.5, 0, 1.5].map((z) => ({ x: -ROOM_WIDTH / 2 + 0.5, z: centre + z, rotation: Math.PI / 2 })),
      ...[-1.5, 0, 1.5].map((z) => ({ x: ROOM_WIDTH / 2 - 0.5, z: centre + z, rotation: -Math.PI / 2 })),
    ],
    [centre],
  )

  return (
    <group>
      {/* La moqueta, con sus bandas: lo que dice que el suelo es un suelo. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial color={CARPET_COLOR} roughness={1} />
      </mesh>
      <instancedMesh ref={stripes} args={[undefined, undefined, stripeCopies.length]}>
        <planeGeometry args={[0.5, ROOM_DEPTH]} />
        <meshStandardMaterial
          color={CARPET_STRIPE_COLOR}
          roughness={1}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </instancedMesh>

      {/* Las paredes, con zócalo. Solo las tres que se ven desde el sitio de
          quien juega: la cuarta queda a su espalda. */}
      <instancedMesh ref={walls} args={[undefined, undefined, wallCopies.length]} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={1} />
      </instancedMesh>
      <instancedMesh ref={trims} args={[undefined, undefined, trimCopies.length]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={WALL_TRIM_COLOR} roughness={1} />
      </instancedMesh>

      {/* El techo, que cierra la sala por arriba. Sin él, levantar la vista era
          ver el negro del compositor —la nada, no una sala a oscuras—, y eso es
          lo que le dice al ojo que el sitio no es un sitio. Mira hacia abajo
          (`Math.PI / 2`), o se vería desde fuera y no desde dentro. */}
      <mesh position={[0, ROOM_HEIGHT, centre]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial color={CEILING_COLOR} roughness={1} />
      </mesh>

      {/* Los neones de la pared del fondo: dos rayas de luz, que es lo que se
          ve al levantar la vista en un recreativo. */}
      {BACK_NEONS.strips.map((neon, i) => (
        <mesh key={neon.y} position={[0, neon.y, centre - ROOM_DEPTH / 2 + 0.03]}>
          <planeGeometry args={[neon.width, BACK_NEONS.thickness]} />
          <meshBasicMaterial color={NEON_COLORS[i]} toneMapped={false} />
        </mesh>
      ))}

      {/* Las máquinas: una fila al fondo y otra a cada lado, todas apagadas. */}
      <Cabinets spots={cabinets} />

      {/* El halo bajo la mesa: la separa del suelo y da profundidad sin meter
          una textura que haya que servir por HTTP. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, centre]}>
        <ringGeometry args={[1.15, 1.9, 64]} />
        <meshBasicMaterial
          color={PALETTE.primaryDeep}
          transparent
          opacity={0.12}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
