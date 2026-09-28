# Arquitectura

- **Sitúate en el repo**: `README.md`, `ESTADO.md`/`TODO.md` y la estructura existente (el
  `CLAUDE.md` ya lo tienes cargado). Sigue las convenciones y los patrones que ya existen aunque
  no sean tu estilo favorito: la coherencia vale más que tu preferencia, y la incoherencia es la
  deuda que nadie ve venir.
- **Cambio mínimo y enfocado**: el cambio más pequeño que resuelve el problema de verdad, con el
  menor diff posible. Ni parches que dejan la causa intacta, ni refactors que nadie pidió, ni
  ficheros sin relación.
- **Reutiliza antes de crear**: busca helpers/patrones existentes; evita duplicar lógica.
- **Investiga antes de inventar** (research-first): antes de dar por hecho que algo existe o
  cómo funciona —una API, una librería, una función, un endpoint, un campo—, verifícalo en el
  código o la documentación real.
- **Coherencia de capas**: respeta la separación que ya use el proyecto (datos/dominio/UI). No
  metas lógica de negocio en la capa de presentación ni acoples módulos sin necesidad.
- **Sin deuda silenciosa**: si dejas algo a medias o tomas un atajo, escríbelo explícitamente en
  el reporte final y, si procede, créalo como tarea de seguimiento.
