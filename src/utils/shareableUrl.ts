import type { ShareableWeatherQuery } from '../types/shareableWeatherQuery'

export const weatherQueryParameters = ['mode', 'date', 'lat', 'lon', 'tz', 'place', 'admin1', 'country'] as const
export type ParsedWeatherQuery =
  | { status: 'absent' | 'invalid' }
  | { status: 'valid'; query: ShareableWeatherQuery }

export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function validSearchDate(date: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '1940-01-01' || date > localToday(now)) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

export function parseWeatherQuery(search: string | URLSearchParams, now = new Date()): ParsedWeatherQuery {
  const params = new URLSearchParams(search)
  if (!weatherQueryParameters.some(key => params.has(key))) return { status: 'absent' }
  const invalid = { status: 'invalid' } as const
  if (weatherQueryParameters.some(key => params.getAll(key).length > 1)) return invalid
  const mode = params.get('mode'), date = params.get('date') ?? ''
  if (mode !== 'single' && mode !== 'birthday' || !validSearchDate(date, now)) return invalid
  function coordinate(key: string, limit: number): number | null {
    const raw = params.get(key)
    if (!raw || raw.length > 24 || !/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(raw)) return null
    const value = Number(raw)
    return Number.isFinite(value) && Math.abs(value) <= limit ? value : null
  }
  const latitude = coordinate('lat', 90), longitude = coordinate('lon', 180)
  if (latitude === null || longitude === null) return invalid
  function text(key: string, max: number): string | null {
    const value = params.get(key)
    if (value === null) return null
    if (!value.trim() || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) return null
    return value.trim()
  }
  const name = text('place', 160), timezone = text('tz', 80)
  const admin1 = text('admin1', 160), country = text('country', 100)
  if (!name || !timezone || (params.has('admin1') && !admin1) || (params.has('country') && !country)) return invalid
  try {
    const formatter = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    if (mode === 'birthday') {
      const parts = formatter.formatToParts(now)
      const part = (type: string) => parts.find(item => item.type === type)!.value
      if (date > `${part('year')}-${part('month')}-${part('day')}`) return invalid
    }
  } catch { return invalid }
  return { status: 'valid', query: { mode, date, location: { name, latitude, longitude, timezone,
    ...(admin1 ? { admin1 } : {}), ...(country ? { country } : {}) } } }
}

/** Five decimal degrees: at most about 0.56 m rounding error on each axis. */
export function serializeWeatherQuery(query: ShareableWeatherQuery, now = new Date()): URLSearchParams {
  const { location } = query
  const params = new URLSearchParams({ mode: query.mode, date: query.date,
    lat: String(location.latitude), lon: String(location.longitude), tz: location.timezone, place: location.name })
  if (location.admin1 !== undefined) params.set('admin1', location.admin1)
  if (location.country !== undefined) params.set('country', location.country)
  // Validate before rounding: values just outside the range must not become valid.
  const parsed = parseWeatherQuery(params, now)
  if (parsed.status !== 'valid') throw new RangeError('Invalid weather query')
  params.set('lat', String(Number(location.latitude.toFixed(5))))
  params.set('lon', String(Number(location.longitude.toFixed(5))))
  params.set('place', parsed.query.location.name)
  params.set('tz', parsed.query.location.timezone)
  if (parsed.query.location.admin1) params.set('admin1', parsed.query.location.admin1)
  if (parsed.query.location.country) params.set('country', parsed.query.location.country)
  return params
}

/** Replace only owned parameters; preserve origin, pathname, fragment and other parameters. */
export function weatherQueryUrl(href: string, query: ShareableWeatherQuery | null, now = new Date()): URL {
  const url = new URL(href)
  for (const key of weatherQueryParameters) url.searchParams.delete(key)
  if (query) for (const [key, value] of serializeWeatherQuery(query, now)) url.searchParams.set(key, value)
  return url
}
