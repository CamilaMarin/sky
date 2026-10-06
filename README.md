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

El formulario requiere seleccionar una ubicación real y una fecha hasta hoy, usando la fecha local. El autocompletado busca desde 2 caracteres tras 300 ms, limita los resultados a 5 y reutiliza consultas durante la sesión. Flechas recorren las opciones, Enter selecciona y Escape cierra la lista. Todavía no obtiene ni muestra datos meteorológicos.

## Deployment futuro

Vite utiliza `base: './'` para que los recursos compilados funcionen bajo la ruta de un repositorio de GitHub Pages. Esta etapa no configura ni publica un deployment. Más adelante se podrá publicar `dist/` mediante GitHub Actions.

Se utiliza Open-Meteo Geocoding; no se incluyen Historical Weather API, WeatherCard, animaciones, Birthday Weather ni backend.
