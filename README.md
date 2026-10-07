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

Se incluye el modo Birthday Weather como explorador de fechas recurrentes. Se incluye un resumen estadístico con barras CSS, sin librerías de gráficos, backend ni base de datos. No hay script de lint configurado; `npm run build` incluye la comprobación de TypeScript.


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


## Estadísticas recurrentes

`getRecurringWeatherStats` es una función pura en `src/utils/recurringWeatherStats.ts`. App la ejecuta al recibir el resultado y pasa su modelo a la presentación; cambiar de idioma no repite los cálculos.

- `totalYears` cuenta entradas, no el intervalo entre años (los no bisiestos omitidos no cuentan).
- Un año tiene datos si contiene una temperatura finita o un código reconocido. Un objeto con todas las mediciones ausentes no cuenta como dato.
- Récord cálido: máxima; récord frío: mínima. Los empates eligen el año más antiguo.
- Cada promedio utiliza solo sus temperaturas disponibles, sin convertir `null` en cero. Sin muestras devuelve `null`; también se ignoran NaN e infinitos.
- Distribución: reutiliza `getWeatherTheme`. Solo los códigos reconocidos forman el denominador; nulos y desconocidos quedan excluidos. Se conserva la categoría neutral con cero casos (porcentaje nulo si no hay ningún código clasificable).
- Clima más frecuente: empate resuelto con prioridad explícita `clear`, `cloudy`, `rain`, `snow`, `storm`, `fog`, `neutral`; sin códigos válidos devuelve `null`.
- Los porcentajes conservan precisión en el modelo y se redondean solo al mostrarse; pueden no sumar exactamente 100% por redondeo.

Ejecuta todas las pruebas existentes y de estadísticas:

```sh
node --test tests/*.test.mjs
```

## Búsqueda tolerante de ubicaciones

La normalización (`searchNormalization.ts`) aplica trim, minúsculas, NFD, eliminación de marcas Unicode y espacios únicos. Se usa para comparación y caché, sin modificar el texto visible.

Comprobación real del proveedor y de la UI en EN/ES (6 de octubre de 2026):

| Consultas | Open-Meteo sin fallback | Aplicación |
| --- | --- | --- |
| `concepcion` / `Concepción` | Misma lista; Concepción, Chile primero | Coincidencias normalizadas, sin corrección |
| `valparaiso` / `Valparaíso` | Misma lista; Valparaíso, Chile primero | Coincidencias normalizadas, sin corrección |
| `nunoa` / `Ñuñoa` | Ñuñoa, Chile y Nuñoa, Perú | Sin corrección |
| `sao paulo` / `São Paulo` | São Paulo y otros nombres alternativos | Exactas primero; sin corrección |
| `santiago` | Santiago; en ES, Chile se llama Santiago de Chile | Ranking por exactitud, sin país preferido |
| `santiagoo` | Sin resultados | Ofrece Santiago mediante fallback |
| `santigo` | Santigoso y Santigogae; no Santiago | Conserva prefijos y añade Santiago como sugerencia |

Open-Meteo ya ignora diacríticos y mayúsculas; no se repite la consulta con una versión sin tildes. Ver [documentación de geocoding](https://open-meteo.com/en/docs/geocoding-api).

Estrategia y límites:

- Camino normal: una petición con `count=5`, idioma activo y debounce de 300 ms.
- Fallback: solo para consultas de 6–120 caracteres, sin coma, sin exacta normalizada y con menos de cinco resultados originales. Una segunda petición usa los primeros cuatro caracteres normalizados y `count=20`; se filtran los candidatos localmente. Máximo **2 requests por búsqueda completada**, o cero si está en caché. No se consulta una lista mundial ni se generan variantes en bucle.
- Levenshtein puro y testeable: sin fuzzy para 1–3 caracteres; hasta 1 edición para 4–5 y 2 para 6+. Se exigen los mismos dos primeros caracteres y una distancia relativa máxima del 25%. Las consultas cortas no activan la búsqueda ampliada.
- Nombres localizados como Santiago de Chile permiten comparar las palabras iniciales cuando van seguidas de `de`, `del`, `do`, `da`, `dos` o `das`. La sugerencia siempre conserva el nombre completo del proveedor.
- Ranking: exacta normalizada, prefijo, fuzzy (menor distancia), otros alias del proveedor. En empate se conserva el orden original; se eliminan duplicados por ID y se muestran como máximo cinco ubicaciones.
- El mensaje «¿Quisiste decir…?» exige una coincidencia fuzzy de una sola edición. Es una propuesta, nunca una selección automática. Los lugares con nombres similares pueden ser distintos; siempre se muestran región y país para elegir.
- El caché de resultados completos tiene clave `idioma:consultaNormalizada`, incluidas búsquedas vacías y sugerencias, con un límite de 100 entradas en memoria. EN/ES permanecen separados. Las búsquedas canceladas o fallidas no se almacenan; si solo falla el fallback se conservan los resultados originales válidos.
- Los errores o cancelaciones no desencadenan más requests. Se conserva ArrowDown/ArrowUp, Enter, Escape y selección por puntero; editar la ciudad invalida la ubicación seleccionada.
- Los anuncios de carga comienzan después del debounce, y la corrección se incluye en el estado accesible final del autocomplete.

Limitación intencional: el fallback depende de los 20 candidatos del prefijo. No garantiza corregir cualquier ciudad, errores en los primeros caracteres ni búsquedas calificadas por país; prioriza precisión y un coste acotado. Al priorizar exactas, en ES «Santiago» (Filipinas) puede preceder a «Santiago de Chile»; no se infiere la ubicación del usuario.

## Expanded Location Search: GeoNames local

Open-Meteo sigue consultándose como proveedor global (una petición normal y,
como máximo, su fallback de prefijo existente). Un catálogo estático complementa
su cobertura de comunas y localidades chilenas. No se usa la API de GeoNames,
credenciales, Nominatim ni un listado mantenido manualmente.

Fuente: [GeoNames CL.zip](https://download.geonames.org/export/dump/CL.zip),
[formato oficial](https://download.geonames.org/export/dump/readme.txt) y
[códigos de entidades](https://www.geonames.org/export/codes.html).
Datos adaptados de GeoNames bajo [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
La adaptación filtra registros y reduce columnas; hay atribución también en el footer.
Snapshot descargado el 6 de octubre de 2026. GeoNames actualiza los dumps;
la actualización de este catálogo es manual, ejecutando el script y revisando el diff.

### Regeneración sin dependencias adicionales

Requiere Node, curl y unzip. Ejecutar desde la raíz:

```sh
curl -fL https://download.geonames.org/export/dump/CL.zip -o /tmp/CL.zip
unzip -p /tmp/CL.zip CL.txt > /tmp/CL.txt
node scripts/prepare-geonames.mjs /tmp/CL.txt CL public/data/locations/CL.json
node --test tests/*.test.mjs
npm run build
git diff --check
```

El script no descarga ni ejecuta contenido remoto. El mismo TXT produce los mismos
JSON y metadatos; se guarda SHA-256 del TXT para identificar el snapshot exacto.
Para reproducir esa versión después de actualizar GeoNames, conservar el TXT original.
No se incluye el dump completo en el repositorio ni se descarga en runtime.

| Medición del snapshot | Valor |
| --- | ---: |
| ZIP original | 1.421.407 bytes |
| TXT original | 6.056.261 bytes |
| Registros originales | 46.467 |
| Registros finales | 7.275 |
| Registros seleccionados sin datos válidos | 0 |
| CL.json | 491.621 bytes |
| Gzip aproximado | 128.706 bytes |

El formato versionado usa tuplas `[id, name, latitude, longitude, regionCode, timezone]`,
un diccionario de regiones y país compartidos. Los nombres son los de la fuente,
incluido `Estacion Central` sin tilde y `Republic of Chile`; no hay traducción manual.
No se guardan población, elevación, fechas por entidad ni alias redundantes.
El parser adapta las tuplas al modelo `Location`, validando esquema, coordenadas,
IDs únicos y estructura de timezone.

### Filtro y casos inspeccionados

Se conservan `A.ADM3` (comunas) y localidades habitadas `P.PPL`, `P.PPLX`,
`P.PPLL`, `P.PPLA`, `P.PPLA2`, `P.PPLA3`, `P.PPLC` presentes en Chile.
El filtro admite además `P.PPLA4` y `P.PPLG` si aparecen en futuras fuentes.
Las regiones `A.ADM1` solo aportan contexto. Se excluyen entidades históricas,
abandonadas, granjas, minas, estaciones, hoteles, cerros y otros POIs.

| Caso | Representación conservada |
| --- | --- |
| Pudahuel | ADM3, ID 8261436; se excluye la granja homónima FRM |
| Cerro Navia | ADM3, ID 8261397; se excluye el cerro HLL |
| Ñuñoa | PPLX 3878431 y ADM3 8261178 |
| Estación Central | ADM3 8261400, nombre original `Estacion Central`; se excluyen estaciones RSTN |
| Providencia | PPLA3 y ADM3; se excluyen minas/hotel |
| La Florida | PPL/PPLX y ADM3; se excluyen minas/granjas |
| San Miguel | PPL/PPLX y ADM3; se conservan homónimos distantes |
| Maipú | PPL y ADM3; se excluye estación RSTN |

Se conserva **la timezone de la columna 18 de cada registro**, sin derivarla del
país ni hacer otra petición al seleccionar. Incluye America/Santiago,
America/Punta_Arenas, America/Coyhaique, Pacific/Easter y algunos registros de
frontera con America/Lima y America/La_Paz según GeoNames. No se corrigen a mano.
Las coordenadas de una comuna son un punto representativo, no la dirección del
usuario. La calidad y exactitud geográfica dependen de GeoNames; no hay polígonos
para resolver equivalencias entre asentamientos y comunas.

### Carga, búsqueda y combinación

- El catálogo se carga al buscar al menos dos caracteres, después del debounce
  existente de 300 ms. Usa `import.meta.env.BASE_URL` y funciona bajo el path de Pages.
  Una promesa compartida por país evita cargas repetidas y peticiones concurrentes
  duplicadas. No entra en el bundle inicial. La carga tiene un límite de ocho segundos.
- Cancelar una búsqueda no cancela una descarga compartida, pero `AbortSignal` evita
  devolver resultados obsoletos. Se conserva el cache del formulario por idioma/query.
- `searchGazetteer` admite códigos de países; agregar catálogos preparados y habilitar
  esos códigos permite ampliar cobertura. El filtro administrativo debe revisarse para
  cada país: ADM3 representa comunas en Chile, no necesariamente en otros países.
- Reutiliza normalización, distancia de edición y ranking existentes. Exacto normalizado
  → prefijo → fuzzy → otros resultados válidos del proveedor. En fuzzy, menor distancia
  primero; empates mantienen orden Open-Meteo y luego orden local por ID.
- No hay fuzzy para menos de cuatro caracteres: mismo prefijo de dos caracteres,
  máximo una edición para longitud hasta cinco, dos para el resto y proporción ≤25%.
  Tildes no cuentan como errores. Solo una edición genera el mensaje de corrección.
- Se ordena antes de deduplicar para preservar la etiqueta que mejor coincide.
  Se fusionan IDs GeoNames iguales (compartidos por ambos proveedores), o nombres
  normalizados iguales **más mismo país más distancia ≤1 km**. Se completan timezone,
  región y país ausentes. Homónimos lejanos no se fusionan. Máximo cinco sugerencias.
  Una comuna y un asentamiento separados más de 1 km pueden permanecer como dos
  opciones (por ejemplo Ñuñoa); se evita fusionar entidades distintas por nombre.
- Si falla el catálogo, Open-Meteo sigue disponible sin error técnico en UI; se registra
  una advertencia una vez y no se reintenta la descarga hasta recargar la página.
  Si Open-Meteo falla, se muestran coincidencias locales disponibles; si ninguna fuente
  puede resolver la búsqueda, se conserva el estado de error accesible existente.

### Verificación

`node --test tests/*.test.mjs` cubre parser/carga compartida, búsquedas exactas,
tildes, prefijos, errores tipográficos, ranking, deduplicación geográfica, nombres
iguales distantes, abort y fallos de cada fuente, además de todos los tests previos.
Se comprobaron en navegador con EN y ES las 14 búsquedas solicitadas: Pudahuel,
Cerro Navia, Ñuñoa/Nunoa, Estación Central/Estacion Central, Providencia, La Florida,
San Miguel, Maipú/Maipu, Pudahel, Cerro Nabia y Estacion Centarl.
Los nombres locales no cambian con el idioma; Open-Meteo sigue recibiendo EN/ES.
