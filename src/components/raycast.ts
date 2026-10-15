/**
 * Leaves a mesh out of reach of any ray, the mouse's or the controller's.
 *
 * R3F asks each mesh where the ray crosses it to know what is being pointed
 * at; one that answers nothing is still seen but does not intercept. Both the
 * interface panels and the crosshair of whoever shoots use it, so it lives
 * outside the two.
 */
export const NO_RAYCAST = () => {}
