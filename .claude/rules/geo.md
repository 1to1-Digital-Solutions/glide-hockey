# GEO — SEO para motores de IA

Objetivo: que las respuestas de ChatGPT/Claude/Perplexity/Google AI puedan ENCONTRAR,
ENTENDER y CITAR este proyecto. GEO (Generative Engine Optimization) complementa al SEO
clásico. Referencia: paper "GEO: Generative Engine Optimization" (Princeton et al.,
KDD 2024): añadir citas a fuentes, estadísticas y quotes sube la visibilidad en respuestas
generativas hasta ~40% según sus benchmarks.

## Piezas que instala el perfil `geo`

- `app/robots.ts` — permite SIEMPRE los bots de citación (OAI-SearchBot, ChatGPT-User,
  Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended) y deja
  EXPLÍCITA la decisión sobre los de entrenamiento (GPTBot, ClaudeBot, CCBot; por defecto
  permitidos — cámbialos a `disallow` si el proyecto no debe ceder contenido para training).
- `app/sitemap.ts` — añade cada página pública nueva a `STATIC_ROUTES` (o genera las URLs
  dinámicas leyendo de la fuente de datos).
- `components/geo/json-ld.tsx` — `<JsonLd>` + presets: `organization` (con `sameAs`),
  `webSite`, `breadcrumbList`, `faqPage`, `article`, `softwareApplication`.
- `app/faq/page.tsx` — página FAQ con FAQPage JSON-LD generados del MISMO array.

Si alguna pieza aterrizó como `*.suite.*` (p. ej. `robots.suite.ts`) es que el repo ya
tenía ese fichero: intégrala a mano en el existente y borra la variante `.suite`.

## Dónde colocar el JSON-LD

- Layout raíz: `organization({ sameAs: [LinkedIn, GitHub, X…] })` + `webSite(…)`.
- Posts/guías: `article(…)`. Landing del producto: `softwareApplication(…)`.
- Secciones anidadas: `breadcrumbList(…)`. FAQ: ya cableado en la plantilla.
- Define `NEXT_PUBLIC_SITE_URL` en producción (robots y sitemap la usan).

## Checklist de contenido citable (aplícala a CADA página pública que toques)

1. **Answer-first**: bajo cada H2, la respuesta completa en las primeras 40-60 palabras;
   el desarrollo después. Los motores citan párrafos autocontenidos, no páginas enteras.
2. **≥1 estadística numérica** por página, con fecha y origen (dato propio o de fuente).
3. **≥1 cita a fuente externa** con enlace (estudio, documentación oficial, benchmark).
4. **H2/H3 en forma de pregunta** cuando la sección responde algo ("¿Cuánto cuesta X?").
5. **Entidades consistentes**: mismo nombre de producto/empresa en title, H1 y schema.
6. **FAQ real**: preguntas que la gente hace de verdad (soporte, ventas); respuestas de
   40-80 palabras; el texto visible y el del JSON-LD deben coincidir.
7. **Fechas visibles** en contenido que caduca (publicado/actualizado) + `dateModified`
   en el schema.

## Verificación al tocar cualquier pieza GEO

- `curl localhost:3000/robots.txt` y `curl localhost:3000/sitemap.xml` responden bien.
- JSON-LD válido en https://validator.schema.org (o Rich Results Test para FAQ/Article).
- Cada página nueva: ¿está en el sitemap? ¿pasa la checklist de contenido?
- `build` y `lint` del proyecto en verde.
