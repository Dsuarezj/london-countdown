# London countdown

Una cuenta atrás para un encuentro, con aves animadas, el tiempo de cada ciudad y tarjetas
con la ubicación actual y curiosidades. Es una aplicación web estática y una PWA, sin backend
ni compilación. Gemini genera el catálogo antes de publicar; el navegador no necesita claves.

## Ejecutar en local

Necesitas **Node.js 22.15 o superior** para generar el catálogo, **Python 3** y un navegador
moderno compatible con módulos ES e import maps.

```sh
git clone https://github.com/Dsuarezj/london-countdown.git
cd london-countdown
cp .env.template .env
```

Añade tu clave de Gemini en `.env`:

```dotenv
GEMINI_API_KEY=tu_clave
```

Genera el catálogo y arranca el servidor:

```sh
npm run generate:facts
python3 -m http.server 4173 --bind 127.0.0.1
```

Abre **http://127.0.0.1:4173/**. Si ya tienes el repositorio descargado, ejecuta únicamente
el comando del servidor desde su carpeta raíz si ya has generado `facts.json`.
La generación no requiere `npm install`: usa únicamente funciones nativas de Node.
`.env` y `facts.json` están ignorados por Git; no publiques ni compartas tu clave.

Para detener el servidor, pulsa `Ctrl+C` en la terminal. Si el puerto está ocupado, elige otro,
por ejemplo `python3 -m http.server 8080 --bind 127.0.0.1`, y abre la URL con ese puerto.

No abras `index.html` directamente con `file://`: la aplicación carga su configuración,
traducciones y módulos mediante HTTP.

## Personalizar el encuentro

Edita `config.json` y recarga la página:

- `meeting`: fecha, hora y zona horaria del encuentro, ciudad y coordenadas.
- `origins.north` y `origins.south`: ciudad, país (`label`), coordenadas, zona horaria y ave
  (`character`) de cada origen.
- `backgrounds`: fondo y activación del tiempo real mediante `weather`.
- `characters`: archivos SVG/CSS, clave de los textos y nombre científico (`scientificName`,
  opcional) de cada ave para identificar la especie junto con su nombre común.
- `affection`, `together`, `kickers` y `thresholds`: animaciones y mensajes de la cuenta atrás.

Los nombres visibles se resuelven con claves como `places.london` en
`translations/en.json`, `translations/es.json` y `translations/is.json`. Para añadir un lugar,
añade su nombre en esos archivos y usa la misma clave en la configuración. Actualiza también
sus coordenadas y zona horaria. Después de cambiar temas o idiomas, vuelve a ejecutar
`npm run generate:facts` antes de abrir la página en local.

El botón del globo cambia el idioma. Cada clic en un pin abre una tarjeta con la ubicación
actual y la siguiente curiosidad, alternando ciudad de origen, país y especie. La ubicación
muestra la ciudad y el país de origen antes y después del viaje, o la ciudad del encuentro
durante la estancia. Los temas siguen siendo los de origen; no se generan datos de Londres.
Cambiar de idioma conserva la misma curiosidad. Abrir la tarjeta no consulta servicios externos.

## Generación y rotación de curiosidades

El script `scripts/generate-facts.js` pide a **Gemini 3.5 Flash-Lite** un máximo de 100 datos
por tema, con sus traducciones en los idiomas de `config.languages` y un texto original en
inglés. No exige llegar a 100: prioriza datos concretos y fiables, con enlaces de referencia.
Los nombres de los temas se resuelven en `translations/en.json`; mantenlos actualizados.
No utiliza búsquedas, Wikipedia ni un servicio de traducción durante la navegación.
Se confía en el contenido generado: los enlaces no se verifican de forma independiente.

Solo se sustituye `facts.json` cuando terminan correctamente todas las llamadas y el catálogo
completo tiene formato válido. **Todos los temas deben tener entre 1 y 100 datos**; una
categoría vacía detiene la generación y el despliegue. El nombre común y el científico
identifican la misma especie en el prompt, sin sustituirla por otra ave.
Un error de API, una respuesta incompleta, traducciones ausentes o un tema inválido hacen
fallar la generación; nunca se mezcla un catálogo anterior con la configuración nueva.
El navegador también comprueba que el catálogo corresponde a los temas configurados.

Cada dato recibe un hash SHA-256 del tema y su texto inglés normalizado. El navegador guarda
los IDs vistos por tema en `localStorage`, bajo `trip-facts:v1`. Muestra los datos en orden sin
repetirlos hasta agotar ese tema, y entonces comienza otro ciclo. Si hay varios datos, evita
repetir inmediatamente el último. Los IDs conservados tras otro despliegue mantienen su
historial; los nuevos quedan pendientes y los de temas cambiados no se reutilizan.
Un hash elimina duplicados textuales, no dos redacciones diferentes del mismo hecho.
Si borras los datos del sitio o cambias de navegador, el historial comienza de nuevo.

## Conexión y modo sin conexión

El tiempo se consulta en **Open-Meteo** y necesita Internet para obtener datos nuevos.

Después de una primera carga con conexión, el service worker guarda los recursos de la app.
Si falla la red, se utilizan los datos previamente guardados cuando están disponibles.
El catálogo `facts.json` se guarda en la caché del service worker, junto con la configuración
y los textos de la app, para mostrar las curiosidades también sin conexión. Si falta o no
corresponde a los temas actuales, la tarjeta muestra un aviso en vez de datos de otro lugar.

La PWA y el service worker requieren **HTTPS** o un entorno local como `localhost`/`127.0.0.1`.
Si necesitas probar desde cero o ves contenido antiguo, elimina los datos del sitio y su
service worker desde las herramientas de desarrollo del navegador y recarga. Esto también
borra preferencias y datos disponibles sin conexión.

## Ejecutar las pruebas

Necesitas **Node.js 22.15 o superior**, **npm** y **Python 3**. Instala las dependencias
desde la raíz del repositorio:

```sh
npm ci
npm test
```

Para las pruebas de navegador, instala Chromium de Playwright y ejecuta:

```sh
npm exec playwright install chromium
npm run test:e2e
```

Playwright inicia automáticamente el servidor local en el puerto `4173`. No necesitas
arrancarlo antes. Las pruebas usan respuestas de API controladas, no dependen de la
disponibilidad de los servicios externos.

Para abrir el informe de las pruebas de navegador:

```sh
npm exec playwright show-report
```

## Publicar

El workflow `.github/workflows/pages.yml` publica el sitio en **GitHub Pages** al hacer push
a `main`, o al ejecutarlo manualmente desde Actions. Configura la fuente de Pages del
repositorio como **GitHub Actions**.

### Añadir la clave de Gemini a GitHub Actions

1. En GitHub, abre el repositorio y entra en **Settings → Secrets and variables → Actions**.
2. Pulsa **New repository secret**.
3. En **Name**, escribe exactamente `GEMINI_API_KEY`.
4. En **Secret**, pega únicamente el valor de tu clave, sin comillas ni `GEMINI_API_KEY=`.
5. Pulsa **Add secret**.

El workflow usa ese secreto únicamente en el paso **Generate curiosity catalog**. No sube
`.env`, el script generador ni la clave al sitio; publica el HTML, los recursos y `facts.json`.
No hay compilación ni instalación de dependencias en el despliegue.

Si falta la clave o falla alguna generación, **se detiene el despliegue antes de subir el
sitio**. La versión publicada anteriormente permanece intacta, con su configuración y sus
datos anteriores. No hay reintentos automáticos ni recuperación de catálogos antiguos.

Para volver a intentarlo manualmente, entra en **Actions → Deploy to GitHub Pages → Run
workflow**, selecciona `main` y pulsa **Run workflow**. También puedes usar **Re-run failed
jobs** en la ejecución fallida para reintentar esa misma revisión.

Para más detalles sobre módulos, configuración y cachés, consulta [ARCHITECTURE.md](ARCHITECTURE.md).
El contrato de las animaciones está en [ANIMATION.md](ANIMATION.md).
