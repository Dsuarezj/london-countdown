# London countdown

Una cuenta atrás para un encuentro, con aves animadas, el tiempo de cada ciudad y curiosidades
relacionadas con las ubicaciones. Es una aplicación web estática y una PWA: no necesita backend,
compilación ni claves de API.

## Ejecutar en local

Necesitas **Python 3** y un navegador moderno compatible con módulos ES e import maps.
Node.js no es necesario para abrir la aplicación; solo se utiliza para las pruebas.

```sh
git clone https://github.com/Dsuarezj/london-countdown.git
cd london-countdown
python3 -m http.server 4173 --bind 127.0.0.1
```

Abre **http://127.0.0.1:4173/**. Si ya tienes el repositorio descargado, ejecuta únicamente
el comando del servidor desde su carpeta raíz.

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
- `characters`: archivos SVG/CSS, nombre científico y clave de los textos de cada ave.
- `affection`, `together`, `kickers` y `thresholds`: animaciones y mensajes de la cuenta atrás.

Los nombres visibles se resuelven con claves como `places.london` en
`translations/en.json`, `translations/es.json` y `translations/is.json`. Para añadir un lugar,
añade su nombre en esos archivos y usa la misma clave en la configuración. Actualiza también
sus coordenadas y zona horaria. Mantén el nombre en inglés: se usa para buscar las curiosidades.

El botón del globo cambia el idioma. Cada clic en un pin abre su ficha y busca otra curiosidad.

## Conexión y modo sin conexión

El tiempo se consulta en **Open-Meteo** y las curiosidades en el archivo **Did you know? de
Wikipedia en inglés**. Estas funciones necesitan Internet para obtener contenido nuevo.
Las curiosidades conservan su idioma original y enlazan a su fuente.

Después de una primera carga con conexión, el service worker guarda los recursos de la app.
Si falla la red, se utilizan los datos previamente guardados cuando están disponibles; sin
una curiosidad guardada para los temas configurados, la ficha muestra un aviso.

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

Para ejecutar solo las pruebas de curiosidades:

```sh
node --import ./tests/register-imports.js --test tests/facts.test.js
npm run test:e2e -- tests/e2e/facts.spec.js
```

Para abrir el informe de las pruebas de navegador:

```sh
npm exec playwright show-report
```

## Publicar

El workflow `.github/workflows/pages.yml` publica el sitio en **GitHub Pages** al hacer push
a `main`, o al ejecutarlo manualmente desde Actions. Configura la fuente de Pages del
repositorio como **GitHub Actions**. No hay paso de compilación.

Para más detalles sobre módulos, configuración y cachés, consulta [ARCHITECTURE.md](ARCHITECTURE.md).
El contrato de las animaciones está en [ANIMATION.md](ANIMATION.md).
