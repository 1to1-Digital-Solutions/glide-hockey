# Arquitectura

- **Lee primero el contexto del repo**: `CLAUDE.md`, `README.md`, `ESTADO.md`/`TODO.md` y la
  estructura existente. Sigue las convenciones del proyecto; no impongas estilos ajenos.
- **Cambio mínimo y enfocado**: resuelve la tarea con el menor diff posible. No refactorices de
  más ni toques ficheros sin relación.
- **Reutiliza antes de crear**: busca helpers/patrones existentes; evita duplicar lógica.
- **Investiga antes de inventar** (research-first): si dudas de una API/librería, verifícala en el
  código o la documentación real en vez de asumir.
- **Coherencia de capas**: respeta la separación que ya use el proyecto (datos/dominio/UI). No
  metas lógica de negocio en la capa de presentación ni acoples módulos sin necesidad.
- **Sin deuda silenciosa**: si dejas algo a medias o tomas un atajo, escríbelo explícitamente en
  el reporte final y, si procede, créalo como tarea de seguimiento.
