# Lo importante

Tu briefing diario de noticias en el móvil: lo que de verdad importa en el mundo, centrado en tus pilares
(problemas globales, actualidad, economía, geopolítica, tecnología, emprendimiento y deporte),
y que aprende de tus 👍 / 👎.

- Cada mañana (antes de las 7:00) se prepara la edición del día.
- Cada 3 horas se actualiza la **última hora**.
- Las noticias vienen de unas 30 fuentes fiables (`collector/feeds.js`).
- Una IA elige, resume en español y explica **por qué importa**. Por defecto **Google Gemini, gratis**.
  (También acepta Claude, de pago, si algún día lo prefieres.) Sin clave de IA, la app funciona igual con los titulares sin resumir.
- Tus gustos se guardan **solo en tu móvil**.

## Ponerla en marcha (una sola vez, ~10 minutos)

1. **Crea una cuenta en GitHub** (gratis) en https://github.com si no tienes.
2. **Crea un repositorio nuevo**, por ejemplo `lo-importante`. Puede ser público o privado
   (para GitHub Pages en privado hace falta un plan de pago, así que lo normal es público:
   en él no hay nada personal, tus gustos se quedan en tu móvil).
3. **Sube este proyecto** al repositorio (o pídeme que lo haga por ti).
4. **Añade tu clave gratuita de Gemini** como secreto:
   - Entra en https://aistudio.google.com/apikey con tu cuenta de Google → *Create API key* (gratis, sin tarjeta).
   - En tu repositorio: *Settings → Secrets and variables → Actions → New repository secret*.
   - Nombre: `GEMINI_API_KEY`, valor: tu clave.
   - **Respaldo gratis (recomendado):** crea otra clave en https://console.groq.com/keys y guárdala como `GROQ_API_KEY`.
     Si Gemini está saturado, la app usa Groq.
   - (Alternativa de pago: `ANTHROPIC_API_KEY` con una clave de https://console.anthropic.com.)
5. **Activa GitHub Pages**: *Settings → Pages → Source: GitHub Actions*.
6. **Lanza la primera edición**: pestaña *Actions → Noticias → Run workflow*.
7. Cuando termine, tu app estará en `https://TU-USUARIO.github.io/lo-importante/`.

## Instalarla en el móvil

- **Android (Chrome):** abre la dirección → menú ⋮ → *Añadir a pantalla de inicio* / *Instalar app*.
- **iPhone (Safari):** abre la dirección → botón compartir → *Añadir a pantalla de inicio*.

## Cosas que puedes cambiar

| Qué | Dónde |
|---|---|
| Fuentes de noticias | `collector/feeds.js` (una línea por fuente) |
| Cómo elige y resume la IA | texto `SISTEMA` en `collector/ai.js` |
| Modelos de Gemini que prueba | `GEMINI_MODELS` en `collector/ai.js` |
| Hora de la edición / frecuencia de última hora | líneas `cron` en `.github/workflows/noticias.yml` (hora UTC) |
| Cuánto aprende de cada like, exploración, nº de noticias | `app/rank.js` |

## Coste

**0 €.** Gemini gratis permite unas 20 llamadas al día y la app usa ~9 (1 edición + 8 de última hora).
Si Gemini está saturado, prueba Groq (gratis, por lotes con pausas de 1 minuto).
Si los dos fallan, ese rato la app muestra los titulares sin resumir, y la siguiente pasada (cada 3 h) lo vuelve a intentar.
GitHub Actions y Pages son gratis para este uso.

## Para desarrolladores

```bash
npm install
npm test                       # tests
node collector/run.js          # edición (usa ANTHROPIC_API_KEY si existe)
node collector/run.js breaking # sólo última hora
node tools/serve.js            # probar la app en http://localhost:5173
node tools/iconos.js           # regenerar iconos
```
