# How Was the Sky?

Base de una aplicación para consultar el clima histórico de una ciudad.

## Desarrollo local

Requiere Node.js 20.19+ o 22.12+.

```sh
npm install
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
- `src/index.css`: estilos responsive, sin animaciones ni librerías visuales.
- `src/services/geocoding.ts`: consultas a Open-Meteo Geocoding con soporte de cancelación.
- `src/types/location.ts`: ubicación con coordenadas y metadatos opcionales.
- `src/utils/`: reservada para próximas etapas.

El formulario requiere seleccionar una ubicación real y una fecha hasta hoy, usando la fecha local. El autocompletado busca desde 2 caracteres tras 300 ms, limita los resultados a 5 y reutiliza consultas durante la sesión. Flechas recorren las opciones, Enter selecciona y Escape cierra la lista. App consulta el clima histórico al enviar el formulario y muestra una WeatherCard. Las fechas admitidas van desde 1940 hasta hoy; puede haber datos recientes no disponibles.

## Deployment futuro

Vite utiliza `base: './'` para que los recursos compilados funcionen bajo la ruta de un repositorio de GitHub Pages. Esta etapa no configura ni publica un deployment. Más adelante se podrá publicar `dist/` mediante GitHub Actions.

Se utilizan Open-Meteo Geocoding y Historical Weather API, sin dependencias adicionales.

- `src/services/weather.ts` valida la respuesta y la transforma a `HistoricalWeather` (`src/types/weather.ts`).
- `App` mantiene carga, éxito y error, y cancela consultas reemplazadas o al desmontarse.
- `WeatherCard` solo presenta datos; las utilidades resuelven códigos WMO, unidades, duración de sol y horas locales.
- Si falta timezone en la ubicación se usa `auto` para resolverla a partir de sus coordenadas.
- Los valores nulos se muestran como “Not available”; un día sin mediciones se trata como ausencia de datos.
- La API proporciona datos de reanálisis; la disponibilidad depende de la fecha y del proveedor.

No se incluyen animaciones, Birthday Weather, comparación entre años, backend ni base de datos. No hay script de lint configurado; `npm run build` incluye la comprobación de TypeScript.
