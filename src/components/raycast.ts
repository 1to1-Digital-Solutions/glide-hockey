/**
 * Deja una malla fuera del alcance de cualquier rayo, del ratón o del mando.
 *
 * R3F pregunta a cada malla por dónde la cruza el rayo para saber a qué se
 * apunta; una que no contesta nada sigue viéndose pero no intercepta. Lo usan
 * tanto los paneles de la interfaz como el punto de mira de quien tira, así que
 * vive fuera de los dos.
 */
export const NO_RAYCAST = () => {}
