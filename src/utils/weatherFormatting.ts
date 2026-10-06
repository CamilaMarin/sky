export function formatSunshine(seconds: number | null, unavailable: string): string {
  if (seconds === null) return unavailable
  const minutes = Math.round(seconds / 60)
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

// The API returns wall-clock times in the requested timezone. Do not convert
// these offset-free strings through the browser's timezone.
export function formatLocalTime(value: string | null, locale: string, unavailable: string): string {
  return value === null ? unavailable : new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(new Date(`${value}Z`))
}

export function formatWeatherDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

export function formatMeasurement(value: number | null, unit: string, locale: string, unavailable: string): string {
  return value === null ? unavailable : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${unit}`
}
