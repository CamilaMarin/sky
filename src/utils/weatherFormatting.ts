export function formatSunshine(seconds: number | null): string {
  if (seconds === null) return 'Not available'
  const minutes = Math.round(seconds / 60)
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

// The API returns wall-clock times in the requested timezone. Do not convert
// these offset-free strings through the browser's timezone.
export function formatLocalTime(value: string | null): string {
  return value === null ? 'Not available' : value.slice(11, 16)
}

export function formatWeatherDate(date: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

export function formatMeasurement(value: number | null, unit: string): string {
  return value === null ? 'Not available' : `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)} ${unit}`
}
