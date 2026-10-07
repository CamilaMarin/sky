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
| CL.json | 676.433 bytes |
| Gzip aproximado | 141.606 bytes |

El formato versionado usa tuplas `[id, name, latitude, longitude, regionCode, timezone, featureClass, featureCode, admin1Id, admin3Id]`,
un diccionario de regiones y país compartidos (versión 2; el lector también admite versión 1). Los nombres son los de la fuente,
incluido `Estacion Central` sin tilde y `Republic of Chile`; el nombre visible del país se resuelve por ISO con Intl.DisplayNames.
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
  primero; entre exactos las comunas chilenas van primero; los demás empates mantienen orden Open-Meteo y luego orden local por ID.
- No hay fuzzy para menos de cuatro caracteres: mismo prefijo de dos caracteres,
  máximo una edición para longitud hasta cinco, dos para el resto y proporción ≤25%.
  Tildes no cuentan como errores. Solo una edición genera el mensaje de corrección.
- Se ordena antes de deduplicar para preservar la etiqueta que mejor coincide.
  Se fusionan IDs GeoNames iguales (compartidos por ambos proveedores), o nombres
  normalizados iguales **más mismo país, categoría conocida igual, área administrativa compatible y distancia ≤1 km**. Se completan timezone,
  región y país ausentes. Homónimos lejanos no se fusionan. Máximo cinco sugerencias.
  Una comuna y un asentamiento se mantienen separados aunque estén cerca, con etiquetas
  visibles de categoría; se evita fusionar entidades distintas por nombre.
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

## Shareable URLs

Una consulta exitosa actualiza la URL sin recargar la página. Se puede copiar desde
la barra del navegador y abrir en otra pestaña o navegador. No requiere backend ni router.

Ejemplo (después del path actual de la aplicación):

```text
?mode=single&date=1994-07-17&lat=-33.42398&lon=-70.85493&tz=America%2FSantiago&place=Pudahuel&admin1=Regi%C3%B3n+Metropolitana&country=Chile
```

| Parámetro | Significado |
| --- | --- |
| `mode` | `single` o `birthday` (se adapta al modo interno `recurring`) |
| `date` | Fecha ISO `YYYY-MM-DD`; en Birthday indica día, mes y año inicial |
| `lat`, `lon` | Coordenadas decimales, hasta cinco decimales al generar la URL |
| `tz` | Zona horaria reconocida por `Intl.DateTimeFormat` |
| `place` | Nombre de ubicación, obligatorio, máximo 160 caracteres |
| `admin1` | Región opcional, máximo 160 caracteres |
| `country` | País opcional, máximo 100 caracteres |

La URL representa **la consulta**, no una copia del clima. No contiene IDs de
proveedores, source, códigos WMO, temperaturas, estadísticas, tema ni idioma.
Cada apertura vuelve a consultar Open-Meteo directamente con coordenadas y zona
horaria; **no ejecuta geocoding ni carga el gazetteer**. Los resultados pueden variar
si el proveedor revisa sus datos; Birthday incluye los años completados disponibles
al momento de abrir el enlace. Se mantienen las reglas de años sin datos y 29 de febrero.
El idioma sigue dependiendo de la preferencia local, navegador y fallback existentes.

### Validación y precisión

`ShareableWeatherQuery` es un modelo explícito; `parseWeatherQuery` y
`serializeWeatherQuery` son utilidades independientes de React. Se rechazan modos
no reconocidos, parámetros obligatorios ausentes o duplicados, números no finitos,
latitudes fuera de ±90, longitudes fuera de ±180, fechas imposibles, anteriores a
1940 o posteriores al día actual del navegador. Birthday aplica además el límite
calendario de la timezone de destino; el servicio conserva su regla de días completos.
`tz` tiene un máximo de 80 caracteres y debe ser reconocido por Intl. Se rechazan
strings vacíos y caracteres de control. React renderiza los nombres como texto,
sin `innerHTML`. La validación no certifica que un nombre corresponda a esas coordenadas.

Cinco decimales representan aproximadamente 1,1 m en latitud y menos en longitud:
error de redondeo de alrededor de 0,56 m por eje como máximo, suficiente para una
localidad. Cálculo basado en las distancias por grado descritas por
[USGS](https://www.usgs.gov/faqs/how-much-distance-does-a-degree-minute-and-second-cover-your-maps).
La consulta original también utiliza las coordenadas redondeadas, para que la URL
restaurada consulte el mismo punto. El resto de decimales no se guarda.

Si una ubicación del proveedor carece de timezone reconocida, se mantiene la consulta
existente con `auto`, pero no se genera un enlace incompleto: tras el éxito se eliminan
los parámetros de una consulta anterior. Navegadores con datos de zonas horarias
antiguos pueden rechazar zonas nuevas; no se sustituye una zona por otra arbitrariamente.

### Historial y restauración

- Se usa exclusivamente `history.replaceState()` tras cada consulta exitosa, tanto
  la primera como las siguientes. Escribir, elegir sugerencias, cambiar fecha o pulsar
  el selector de modo no modifica la URL. Cambiar modo y consultar con éxito reemplaza
  la consulta anterior. Mientras se edita o si falla una nueva consulta, la URL conserva
  la última consulta exitosa (o el enlace inicial para permitir reintentar).
- Back/Forward no recorren búsquedas anteriores porque no se crean entradas para ellas;
  mantienen la navegación normal entre páginas. No hace falta un listener `popstate`
  para un historial de búsquedas que la aplicación no crea.
- `new URL(window.location.href)` conserva origen, pathname/base path de GitHub Pages
  y fragmento. Solo se reemplazan los ocho parámetros propios; se conservan parámetros
  desconocidos, incluidos `utm_source`, `ref` y sus valores repetidos.
- Una URL inválida abre el formulario vacío en idle, sin fetch meteorológico. Se limpian
  únicamente sus parámetros propios con replaceState; los ajenos y el fragmento permanecen.
- Una URL válida precarga modo, fecha y ubicación seleccionada antes de la consulta.
  El formulario sigue editable, y modificar el texto de ubicación invalida la selección
  como antes. Un ID local reservado `0` satisface el modelo existente, nunca se serializa
  ni se utiliza para buscar la ubicación en un proveedor.
- La restauración cancela solicitudes al desmontar; en StrictMode se evita enviar dos
  peticiones por su ciclo adicional de montaje/limpieza.

### Pruebas de enlaces

`tests/shareableUrl.test.mjs` cubre round trips en ambos modos, Unicode, encoding,
coordenadas límite y redondeo, timezones, fechas reales/imposibles/bisiestas,
campos ausentes/duplicados, longitudes, parámetros ajenos, conservación de base path,
limpieza de URLs inválidas e integración directa con ambos servicios meteorológicos.

Verificación manual: búsquedas y enlaces reabiertos en pestañas nuevas para Pudahuel,
Cerro Navia y Ñuñoa (Single Day, 17/07/1994), Pudahuel (Birthday, 17/07/1994) y
Ñuñoa (Birthday, 29/02/2000). Se revisaron los requests con instrumentación temporal,
retirada antes de finalizar: las restauraciones solo llaman a Historical Weather.
Se comprobó refresh de Pudahuel y limpieza de una fecha imposible preservando UTM y hash.

También se comprobó Back/Forward entre páginas y cambio EN/ES conservando el resultado.
La reapertura bisiesta recibió un error transitorio del proveedor; el reintento desde el
formulario restaurado mostró correctamente los siete años bisiestos 2000–2024.


## Share Result

Cada resultado válido y compartible incluye un único botón «Share this sky» /
«Compartir este cielo» en su encabezado. No aparece en idle, loading, error ni
cuando falta una query válida. Birthday admite años sin datos.

- `App` conserva la query junto al resultado exitoso. `shareContent.ts` genera
  title/text/url usando `weatherQueryUrl`, conservando base path, encoding y
  parámetros externos; no confía en que la barra de direcciones coincida con el
  resultado. Editar el formulario no cambia lo compartido hasta una nueva consulta.
- `ShareButton` solo conoce el payload. WeatherCard y RecurringWeather aceptan un
  slot de acciones; no contienen lógica de APIs de compartir.
- Single Day incluye lugar, fecha localizada, condición traducida y temperatura
  protagonista (media → máxima → mínima), compartiendo esa selección con WeatherCard.
  Si todas las temperaturas son null, se omite la temperatura, sin «Not available».
- Birthday incluye lugar y año inicial, seguido de una invitación breve a recorrer
  los años. No incluye listas ni estadísticas. El title usa el título traducido de
  la aplicación; los textos y números respetan EN/ES.
- Solo un clic o activación por teclado llama a `shareResult`. Se detecta
  `navigator.share` por capacidad, sin user-agent sniffing. Si no existe, se copia
  texto contextual + línea en blanco + URL mediante `navigator.clipboard.writeText`.
- `AbortError` se trata como cancelación normal: sin error y sin copiar. Otros
  errores de Web Share intentan clipboard. Si clipboard falta o falla, se muestra
  un mensaje traducido que sugiere copiar la dirección manualmente. No se usa
  `execCommand`, no se mueve el foco y no se muestran errores técnicos.
- El botón bloquea activaciones simultáneas. «Enlace copiado» se anuncia mediante
  `role=status`/`aria-live=polite` durante cuatro segundos; los errores permanecen
  hasta otro intento. El temporizador se limpia al desmontar y las promesas tardías
  no actualizan un componente desmontado. El icono es decorativo y el target mide
  al menos 44 px de alto, con focus visible.

Las APIs pueden depender de HTTPS, permisos y activación del usuario; el fallback
puede ser rechazado por el navegador después de un fallo de Web Share. El error se
maneja sin afectar el resultado. Referencias: [Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)
y [Clipboard](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText).
Las URLs siguen representando consultas reproducibles: no se almacenan resultados
en un servidor, no se crean imágenes ni se usan servicios de terceros para compartir.

### Validación de Share Result

Los tests de `shareResult.test.mjs` verifican contenido EN/ES, fechas, Unicode,
condición, temperatura principal/fallback/cero/null, Birthday, URL canónica frente
a una dirección obsoleta y todos los resultados de las APIs (éxito, cancelación,
fallback, errores y ausencia). No se incorporó un framework de tests de componentes.

Se comprobaron en navegador Pudahuel y Ñuñoa (Single Day, 17/07/1994), Pudahuel
(Birthday desde 17/07/1994) y Ñuñoa (Birthday desde 29/02/2000). Se verificaron
texto/URL, teclado, un solo botón, feedback y expiración con instrumentación
temporal retirada al terminar. El clipboard real funcionó al desactivar Web Share
para forzar el fallback. Los escenarios de cancelación, éxito nativo y errores se
verificaron con APIs simuladas; el navegador integrado dejó pendiente su share
sheet nativo, por lo que no se confirma su flujo visual real en móvil.

Se revisaron ambos modos e idiomas a 320, 375, 768, 1024 y 1440 px: sin overflow
horizontal y con target de 44 px. Validación final: 40 tests aprobados,
`npm run build` y `git diff --check` correctos. No hay script de lint.


## Share-card preview (4:5)

Single Day y Birthday Weather ofrecen «Preview card» / «Ver tarjeta» junto a
compartir. La acción abre un diálogo sin navegar, modificar la URL ni consultar
APIs adicionales. Desde el diálogo se puede guardar la tarjeta como PNG; los detalles
de generación local se describen al final de este documento.

### Composición y datos

- `components/share/ShareCard` define marca, fecha, ubicación, fondo estático y
  tagline. `SingleDayShareCard` y `BirthdayShareCard` son composiciones distintas,
  presentacionales y sin acceso a servicios, URL, geocoding ni Web Share.
- `SingleDayShareCardData` y `BirthdayShareCardData` contienen únicamente textos,
  métricas visibles y tema. Las funciones puras de `shareCardData.ts` preparan
  formatos EN/ES y omiten datos ausentes, reutilizando los formatos, iconos SVG,
  clasificación WeatherTheme y selección de temperatura ya existentes.
- Single Day muestra fecha, lugar/país, condición, temperatura protagonista y
  mín./máx. disponibles. Sin temperatura, el espacio se redistribuye; no se
  inventan ceros ni se muestran placeholders. Los ceros reales se conservan.
- Birthday usa directamente las estadísticas calculadas: `yearsWithData` (con
  singular/plural), records y promedios disponibles. El rango procede de
  `result.startYear/endYear`, no de los años con datos; no oculta años ausentes.
  El 29 de febrero se formatea con un año bisiesto de referencia. El tema procede
  de `mostCommonTheme`, con neutral si falta; no se equipara un tema a un código WMO.
- La marca permanece `HOW WAS THE SKY?`; los demás textos son localizados. La
  ubicación se limita a lugar y país; sin país solo se muestra el lugar. Los nombres
  extensos pueden ocupar hasta tres líneas visibles, conservando el texto en el DOM.

### Layout y accesibilidad

`aspect-ratio: 4 / 5`, padding proporcional y unidades de contenedor (`cqw`) escalan
la composición respecto de su propio ancho, no de la ventana. Un futuro contenedor
de 1080 px producirá una composición de 1350 px de alto. Utiliza fuentes locales,
gradientes estáticos y SVG; no hay animaciones ni dependencias externas dentro de
la tarjeta. Se requiere soporte moderno de container units y `<dialog>`.

`ShareCardPreview` usa `showModal()`, título y descripción asociados, botón Cerrar,
Escape nativo y devolución del foco al disparador. El modal impide interactuar con
el contenido de fondo. Tiene scroll vertical cuando hace falta; el card mantiene
su proporción. Los textos usan headings, párrafos y listas de definiciones; los
SVG son decorativos. La acción de preview es secundaria respecto a compartir.

### Validación

44 tests aprobados, incluyendo cuatro tests nuevos de transformación: datos
completos, temperatura principal/min/max ausentes, cero real, Unicode, EN/ES,
records/promedios/theme null, cobertura, singular/plural, rango y fecha bisiesta.
Build y `git diff --check` pasan. No existe script de lint.

Se verificaron en navegador los cuatro casos: Single Day Pudahuel y Ñuñoa
(17/07/1994), Birthday Pudahuel (desde 17/07/1994) y Ñuñoa (desde 29/02/2000), en
EN/ES. Se comprobó apertura por teclado, Cerrar, Escape, retorno de foco, modalidad,
scroll y URL sin cambios. Con fixtures temporales se inspeccionaron visualmente
clear, rain, snow, storm, fog y variantes sin temperaturas; Birthday clear, rain y
neutral con estadísticas ausentes. Esos fixtures se eliminaron antes de finalizar.
Se midieron 110 combinaciones (11 variantes × 2 idiomas × 5 anchos: 320, 375, 768,
1024 y 1440 px): proporción 4:5 conservada y sin overflow horizontal ni interno.


## Comunas y localidades en autocomplete

La [inspección de registros reales](docs/location-inspection.md) detalla las nueve
búsquedas, coordenadas, países, regiones y feature codes. En Quinta Normal, el
registro PPLX compartido por Open-Meteo y GeoNames (3873992) se fusiona por ID; el
ADM3 8261416 es otro registro. Además, el PPLX apunta a Estación Central en su
jerarquía administrativa. No hay evidencia suficiente para suprimirlo o trasladarlo.

La preparación del catálogo ahora conserva feature class/code y resuelve IDs
administrativos desde las mismas filas ADM1/ADM3 del dump. No se descargan datos
extra ni se corrigen adscripciones manualmente. Los 7.275 registros, coordenadas y
timezones permanecen iguales; JSON v2: 676.433 bytes, gzip aproximado: 141.606 bytes.
Open-Meteo ya entrega `feature_code`, `admin1_id` y `admin3_id`; se utilizan tal cual,
sin inventar featureClass cuando falta. El parser aún admite catálogos v1 almacenados
en caché, sin inferir categorías que no contengan.

Reglas conservadoras:

- ID GeoNames idéntico: un único resultado, completando metadatos faltantes.
- IDs distintos: solo se fusionan con nombre normalizado y país iguales, categoría
  conocida igual, región compatible y distancia ≤1 km. Los IDs de región prevalecen
  sobre etiquetas traducidas; si no están ambos, se exige igual nombre normalizado
  de región. Una contradicción de admin3 impide la fusión. Sin evidencia suficiente,
  se conservan ambos; no se deduplica solo por nombre.
- Comuna y localidad con distinto ID se conservan separadas, incluso cuando comparten
  admin3 (Ñuñoa, Providencia, Maipú): parentesco administrativo no prueba que sus
  distintos puntos representativos sean intercambiables. No se amplió la distancia.
- Ranking: exacto > prefijo > fuzzy (menor distancia primero) > resto del proveedor.
  Solo dentro de exactos se prioriza `CL + ADM3`. No gana una comuna fuzzy a una
  localidad exacta. Los demás empates conservan el orden anterior de proveedores.
- Cada sugerencia conocida muestra «Comuna / Commune» o «Localidad / Locality» en una
  segunda línea con región y país. Categorías desconocidas no se inventan. Los nombres
  propios se conservan; `Intl.DisplayNames` resuelve el país por ISO. CL siempre se
  muestra como Chile en EN/ES, con fallback mínimo para navegadores sin esa API.
- La selección conserva coordenadas, timezone y metadatos, y guarda el país visible
  para los resultados/URLs posteriores. La utilidad de presentación no muta el registro
  original ni usa el idioma como clave de identidad geográfica.

Las doce variantes solicitadas se probaron manualmente en EN/ES, además de navegación
por teclado y selección explícita. Tests con snapshots reales cubren todos los nombres,
prioridad exacta de comunas, Ñuñoa/Perú, país uniforme, IDs entre proveedores, conflicto
administrativo, categorías desconocidas y dos San Miguel distantes que sobreviven.
Se conservan los tests de fuzzy, cancelación, fallback, fechas y URLs compartibles.
No se modificaron share cards ni servicios de weather fetching.

### Guardar share cards como PNG

En el preview, **Guardar imagen / Save image** descarga únicamente la tarjeta,
con resolución fija **1080 × 1350 px (4:5)**. Se genera localmente en el navegador;
la imagen no se sube a ningún servidor. El preview sigue siendo responsive.

La captura utiliza `html-to-image` 1.11.13 (MIT), cargado bajo demanda. Una copia
temporal del DOM de la tarjeta se compone a 1080 px de ancho con los mismos estilos,
SVG y gradientes; `pixelRatio: 1` evita que la resolución dependa de la pantalla.
Se espera `document.fonts.ready`; las fuentes actuales son fuentes del sistema y
Georgia, sin fuentes externas. Su apariencia puede variar entre sistemas operativos.
La generación devuelve un PNG `Blob` y la descarga es una operación separada.
Los nodos temporales se eliminan incluso si falla la captura y las object URLs de
descarga se revocan tras 30 segundos para dar tiempo al navegador a consumirlas.

Se eligió html-to-image porque conserva el renderizado CSS del navegador mediante
SVG/foreignObject. html2canvas interpreta una parte del CSS en su propio renderer;
una implementación propia requeriría mantener clonación y compatibilidad. No se
mantiene una segunda composición ni una segunda paleta para exportar.

Verificación de esta etapa: 110 capturas en Chrome con DPR 2 y otras 110 en el
navegador integrado, combinando EN/ES, los cinco anchos 320/375/768/1024/1440,
temas y valores ausentes. Todas devolvieron 1080 × 1350 según la cabecera PNG.
Se compararon visualmente preview y PNG sin cambios de composición aparentes.
Safari real sigue pendiente de validación: la estrategia utiliza APIs estables,
pero la compatibilidad de foreignObject debe comprobarse en el navegador objetivo.
El feedback de descarga confirma que se inició la descarga, no que el usuario
haya terminado de guardar el archivo en disco.
