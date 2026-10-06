export type WeatherTheme = 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'fog' | 'neutral'

// Visual grouping only; readable WMO descriptions remain in weatherCodes.ts.
const groups: Record<Exclude<WeatherTheme, 'neutral'>, readonly number[]> = {
  clear: [0, 1], cloudy: [2, 3], fog: [45, 48],
  rain: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82],
  snow: [71, 73, 75, 77, 85, 86], storm: [95, 96, 97, 99],
}

export function getWeatherTheme(code: number | null): WeatherTheme {
  for (const [theme, codes] of Object.entries(groups)) {
    if (code !== null && codes.includes(code)) return theme as WeatherTheme
  }
  return 'neutral'
}
