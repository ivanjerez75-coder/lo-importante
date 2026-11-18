# App de noticias diaria personalizada — Diseño

Fecha: 2026-11-18

## Para qué es

Una app en el móvil que cada día te cuenta **lo importante del mundo**, no un feed infinito.
Está centrada en tus pilares y aprende poco a poco lo que te interesa a partir de tus likes,
y de vez en cuando prueba temas nuevos para no encerrarte en una burbuja.

## Pilares (por prioridad)

1. **Problemas globales**: clima, crisis humanitarias, lo que viene. Es lo principal.
2. **Última hora**: lo que está pasando ahora.
3. **Economía**
4. **Geopolítica**
5. **Tecnología**
6. **Emprendimiento**: startups, negocio, "tu mundo".
7. **Deporte**: ligero, al final.

## Objetivos

- Abrir la app y en 3–5 minutos saber lo importante del día.
- Cada noticia en español, con un resumen de 2–3 líneas y un **"por qué importa"**.
- Que la app se vaya personalizando con 👍 / 👎 y aprenda tus gustos.
- Que meta de vez en cuando noticias "de prueba" de otros temas para descubrir cosas nuevas.
- Gratis o casi gratis (unos céntimos al día).

## Lo que NO es

- No es una red social ni un feed infinito.
- No tiene cuentas de usuario, login ni servidor propio que mantener.
- No es para noticias de cotilleo ni clickbait.

## Cómo se construye (mezcla de A + B)

### Approaches considerados

| Opción | Qué es | Pros | Contras |
|---|---|---|---|
| A. Solo RSS | Titulares de medios fiables ordenados por pilar | Gratis, sin claves | Titulares en bruto, sin explicación, mucho ruido |
| B. RSS + IA | Claude elige y resume en español | Lo que pediste: te explica lo importante | Céntimos/día, necesita clave |
| C. API de noticias | NewsAPI y similares | — | Limitadas en gratis, no aporta nada sobre B |

**Elegido: mezcla de A + B.** RSS como base, que siempre funciona y es gratis. Claude encima
resume en español, puntúa la importancia y explica por qué importa. Si un día la IA falla o
no hay clave, la app sigue mostrando los titulares en bruto (modo A).

### Piezas

**1. Recolector automático (GitHub Actions, gratis)**
- Se ejecuta **cada mañana (~7:00 hora España)** con la edición del día, y **cada 3 horas**
  para la última hora.
- Lee unos 25–30 feeds RSS de fuentes fiables, por pilar (BBC, Reuters, El País, Expansión,
  El Confidencial, Bloomberg Línea, TechCrunch, The Verge, Xataka, Carbon Brief, ONU Noticias,
  Marca/AS, etc.). La lista exacta la cierra el constructor.
- Junta las noticias repetidas entre medios. Si una noticia sale en muchos medios, es señal
  de que es importante.
- **Paso IA (Claude Haiku, el modelo barato):** de unas 150–300 noticias crudas elige un
  "pool" de **40–60** y, para cada una, genera:
  - título en español
  - resumen de 2–3 líneas
  - "por qué importa" en 1 línea
  - pilar + 2–4 etiquetas finas (ej. `clima`, `IA`, `startups-españa`, `fútbol`, `China`)
  - importancia global 1–10
  - enlace a la fuente original
- Además marca las **3 noticias del día** (las más importantes de verdad).
- Guarda el resultado como `noticias.json` en el mismo sitio donde vive la app.

**2. La app (web instalable en el móvil, PWA)**
- Alojada gratis en GitHub Pages. Se instala desde el navegador con "Añadir a pantalla de
  inicio" y tiene icono propio. Funciona en Android y en iPhone.
- **Pantalla "Hoy":**
  ```
  ┌─────────────────────────────┐
  │ Miércoles 18 nov            │
  │ ⚡ ÚLTIMA HORA (si hay)      │
  │ ★ LAS 3 DEL DÍA             │
  │   [tarjeta] [tarjeta] ...   │
  │ PARA TI                     │
  │   🌍 Clima · tarjeta        │
  │   💶 Economía · tarjeta     │
  │   🧪 Probando: Ciencia      │  ← noticia de exploración, marcada
  │   ...                       │
  └─────────────────────────────┘
  Tarjeta: título · resumen · "Por qué importa" · fuente · 👍 👎 · abrir
  ```
- Lista corta: **unas 15 noticias** + última hora. Se acaba; no hay scroll infinito.
- Se puede leer sin conexión lo último descargado.
- **Ajustes:** subir o bajar el peso de cada pilar a mano, ver "lo que la app ha aprendido
  de ti" y botón de reiniciar.

**3. Personalización (en tu móvil, privada)**
- Cada 👍 / 👎 suma o resta puntos al **pilar**, a las **etiquetas** y a la **fuente** de
  esa noticia. Abrir el artículo cuenta como un 👍 suave.
- Puntuación de cada noticia = importancia global + tus preferencias aprendidas + prioridad
  de pilar. Las preferencias se van olvidando poco a poco (decaen con las semanas), así que
  tus gustos pueden cambiar.
- **Exploración:** ~2–3 de cada 15 noticias son de temas o etiquetas que aún no has probado
  o con pocas valoraciones, marcadas como "🧪 Probando". Si les das 👍, entran en tu mezcla.
- Las noticias de **importancia 9–10 siempre salen**, aunque el tema no te guste. Lo
  importante del mundo no se filtra.
- Los likes se guardan solo en el móvil. Ninguno sale de él.

## Restricciones

- Trabajas desde Windows, así que nada de apps nativas ni tiendas (Xcode, etc.).
- Necesitas: una cuenta gratuita de GitHub y una clave de API de Anthropic, guardada como
  secreto en GitHub y nunca en la app.
- Coste estimado: Haiku × ~9 ejecuciones/día ≈ céntimos al día.
- Personalización por dispositivo: si cambias de móvil, empiezas de cero (o exportas un fichero).

## Decidido por mí (puedes cambiarlo)

- PWA + GitHub Pages + GitHub Actions: cero servidores, cero coste fijo.
- Claude Haiku para los resúmenes (barato y suficiente para esto).
- Edición a las 7:00 y última hora cada 3 h.
- Unas 15 noticias por día, ~20 % de exploración.
- El aprendizaje vive en el móvil (privado, sin backend).
- Todo en español.

## Lo que queda para el constructor

- La lista exacta de feeds RSS por pilar.
- El prompt exacto para Claude y el formato JSON.
- Los pesos numéricos del aprendizaje (cuánto suma un like, cuánto decae).
- El diseño visual (oscuro/claro, tipografía).
- Notificación diaria opcional: en iPhone requiere tener la app instalada. Va en una fase 2.
