/**
 * Lo que Air Hockey ofrece a quien quiera montarlo: el juego y nada más.
 *
 * Todo lo demás —rutas, layout, metadatos, despliegue— es de la web que lo
 * envuelve (`src/app`), y de eso este punto de entrada no sabe nada. El
 * contrato de montaje, con lo que hay que hacer para consumirlo desde otra
 * aplicación, está en `docs/montar-el-juego.md`.
 */

export { AirHockey, type AirHockeyProps } from './AirHockey'
export {
  AirHockeyScene,
  type AirHockeySceneProps,
} from './AirHockeyScene'
export { mountAirHockey, type AirHockeyHandle } from './mount'
