/**
 * What Glide Hockey offers to whoever wants to mount it: the game and nothing
 * else.
 *
 * Everything else —routes, layout, metadata, deployment— belongs to the website
 * that wraps it (`src/app`), and this entry point knows nothing about that. The
 * mounting contract, with what has to be done to consume it from another
 * application, is in `docs/mounting-the-game.md`.
 */

export { GlideHockey, type GlideHockeyProps } from './GlideHockey'
export {
  GlideHockeyScene,
  type GlideHockeySceneProps,
} from './GlideHockeyScene'
export { mountGlideHockey, type GlideHockeyHandle } from './mount'
export type { Challenge, GameResult } from '../lib/seed'
export type { Goal } from '../lib/goal'
