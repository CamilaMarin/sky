# How Was the Sky?

Aplicación React + TypeScript + Vite para consultar el clima histórico de una ciudad, disponible en inglés y español.

## Desarrollo local

Recomendado: Node.js 24, la misma versión mayor utilizada en GitHub Actions.

```sh
npm ci
npm run dev
```

Abre la URL que muestra Vite en la terminal.

```sh
npm run build
npm run preview
```

`build` comprueba TypeScript y genera `dist/`. `preview` permite revisar esa compilación localmente.

## Estructura

- `src/components/SearchForm.tsx`: formulario accesible con autocompletado de ciudades, selección por teclado y validación HTML nativa.
- `src/App.tsx`: composición de la pantalla inicial.
- `src/main.tsx`: punto de entrada de React.
- `src/index.css`: estilos responsive y efectos atmosféricos CSS que respetan movimiento reducido.
- `src/services/geocoding.ts`: consultas a Open-Meteo Geocoding con soporte de cancelación.
- `src/types/location.ts`: ubicación con coordenadas y metadatos opcionales.
- `src/utils/`: formatos, descripciones meteorológicas y temas visuales.

El formulario requiere seleccionar una ubicación real y una fecha hasta hoy, usando la fecha local. El autocompletado busca desde 2 caracteres tras 300 ms, limita los resultados a 5 y reutiliza consultas durante la sesión. Flechas recorren las opciones, Enter selecciona y Escape cierra la lista. App consulta el clima histórico al enviar el formulario y muestra una WeatherCard. Las fechas admitidas van desde 1940 hasta hoy; puede haber datos recientes no disponibles.

## Deployment en GitHub Pages

El workflow `.github/workflows/deploy.yml` despliega automáticamente cada push a `main`. También admite ejecución manual desde **Actions → Deploy to GitHub Pages → Run workflow**, seleccionando `main`. Las ejecuciones manuales en otras ramas se omiten.

Configuración inicial en GitHub:

1. Publica este repositorio en GitHub, incluyendo el workflow y `package-lock.json` en `main`.
2. En **Settings → Pages → Build and deployment → Source**, selecciona **GitHub Actions**.
3. Asegúrate de que GitHub Actions esté habilitado y permita las acciones oficiales `actions/*` utilizadas por el workflow.
4. Si el entorno `github-pages` tiene restricciones de despliegue, permite `main` y aprueba la ejecución si configuraste revisores obligatorios.
5. Ejecuta el workflow manualmente o realiza un nuevo push a `main`.

El job `build` usa Node.js 24, ejecuta `npm ci` y `npm run build`, configura Pages y sube únicamente `dist/`. El job `deploy` espera la compilación y publica ese artifact usando el entorno `github-pages`. Las ejecuciones se serializan para no interrumpir un despliegue activo.

Los permisos están separados: `contents: read` y `pages: read` para compilar/configurar, y `pages: write` más `id-token: write` para desplegar. No hace falta crear un token personal ni guardar secretos adicionales.

Vite conserva `base: './'`: los recursos compilados usan rutas relativas y funcionan tanto en la raíz como bajo el directorio del repositorio. No se fija una URL ni un nombre de repositorio. La aplicación no utiliza React Router y no necesita redirecciones ni un `404.html` especial. Para futuros assets, utiliza imports de Vite o `import.meta.env.BASE_URL` en vez de rutas absolutas como `/imagen.png`.

No hay un remoto Git configurado en este checkout, por lo que no se puede determinar con seguridad la URL pública. Tras el primer despliegue, consulta **Settings → Pages** o el enlace del entorno `github-pages` en la ejecución de Actions.

Referencia: [workflows personalizados de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Funcionamiento

Se utilizan Open-Meteo Geocoding y Historical Weather API, sin dependencias adicionales.

- `src/services/weather.ts` valida la respuesta y la transforma a `HistoricalWeather` (`src/types/weather.ts`).
- `App` mantiene carga, éxito y error, y cancela consultas reemplazadas o al desmontarse.
- `WeatherCard` solo presenta datos; las utilidades resuelven códigos WMO, unidades, duración de sol y horas locales.
- Si falta timezone en la ubicación se usa `auto` para resolverla a partir de sus coordenadas.
- Los valores nulos se muestran como “Not available”; un día sin mediciones se trata como ausencia de datos.
- La API proporciona datos de reanálisis; la disponibilidad depende de la fecha y del proveedor.

Se incluye el modo Birthday Weather como explorador de fechas recurrentes. No se incluyen estadísticas agregadas, gráficos, backend ni base de datos. No hay script de lint configurado; `npm run build` incluye la comprobación de TypeScript.


## Fechas recurrentes / Birthday Weather

El selector **Un día / Mis cumpleaños** reutiliza ubicación, autocomplete y fecha. En el segundo modo, el día y mes se repiten desde el año de nacimiento. Cambiar de modo cancela la petición en curso y limpia el resultado anterior, conservando los campos; cambiar EN/ES conserva el resultado actual.

`src/services/recurringWeather.ts` consulta un rango continuo con `start_date` y `end_date`, solicitando únicamente `weather_code`, `temperature_2m_min` y `temperature_2m_max`. Normalmente realiza **1 petición meteorológica**, incluso para 80+ años. Procesa la respuesta una vez y devuelve solo las fechas recurrentes; los días intermedios no llegan al estado de React. El volumen descargado crece con el rango (hasta unos 32 mil días desde 1940), aunque solo se renderiza una fila por año aplicable.

Se consideran días terminados en la zona horaria de la ubicación; sin timezone se usa UTC para el corte y `auto` en la API. No se supone que ayer esté disponible. Si la API rechaza un extremo de los últimos cinco días, se hace **como máximo un segundo request** hasta la última repetición anterior a ese margen, conservando el año reciente como sin datos. No se reintenta por cada año ni se reintentan errores de red.

- Se valida el año inicial desde 1940, las coordenadas, fechas reales y fechas futuras.
- El **29 de febrero omite años no bisiestos**, sin mover la fecha.
- Años ausentes, valores nulos o mediciones parciales se muestran sin datos o con las métricas disponibles. Una estructura global inválida sí produce un error accesible.
- `endYear` indica el último año solicitado; `latestAvailableYear` indica el último con alguna medición. No se confunden rango solicitado y cobertura real.
- El resultado usa fondo neutral, iconos SVG decorativos y una lista semántica con mínima y máxima etiquetadas. Todos los nuevos textos están en EN/ES.

La estrategia utiliza los rangos diarios de la [Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api). Una petición HTTP larga puede contar como varias unidades de uso para el proveedor; reducir requests no elimina sus límites de servicio.

Pruebas del servicio, sin dependencias adicionales:

```sh
node --test tests/recurringWeather.test.mjs
```

Las pruebas cubren rangos largos, filtrado, bisiestos, huecos, respuestas parciales, validación, fechas recientes, cancelación y regresión del servicio de un día.
