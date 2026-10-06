import type { WeatherTheme } from '../utils/weatherTheme'

const cloud = <path d="M17 39a9 9 0 0 1 0-18 14 14 0 0 1 27-2 10 10 0 1 1 3 20Z" />
const icons = {
  clear: <><circle cx="32" cy="32" r="11" /><path d="M32 6v6m0 40v6M6 32h6m40 0h6M14 14l4 4m28 28 4 4M14 50l4-4m28-28 4-4" /></>,
  cloudy: <>{cloud}<path d="M24 46h27" /></>,
  rain: <>{cloud}<path d="m22 46-3 8m15-8-3 8m15-8-3 8" /></>,
  snow: <>{cloud}<path d="M23 46v10m-4-7 8 4m0-4-8 4m23-7v10m-4-7 8 4m0-4-8 4" /></>,
  storm: <>{cloud}<path d="m33 41-7 10h9l-5 9" /></>,
  fog: <><path d="M12 23h40M8 32h48M14 41h36M20 50h24" /><path d="M25 14h14" /></>,
  neutral: <><circle cx="32" cy="30" r="18" /><path d="M8 44h48M18 51h28" /></>,
}

/** Decorative: the adjacent weather description supplies the accessible text. */
export default function WeatherIcon({ theme }: { theme: WeatherTheme }) {
  return <svg className="weather-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{icons[theme]}</svg>
}
