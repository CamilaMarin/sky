import { fetchArchive, WeatherError } from './weather'
import type { RecurringWeatherEntry, RecurringWeatherResult } from '../types/recurringWeather'

interface RecurringWeatherRequest {
  latitude: number
  longitude: number
  month: number
  day: number
  startYear: number
  timezone: string
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
function validDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function getRecurringWeather(
  { latitude, longitude, month, day, startYear, timezone }: RecurringWeatherRequest,
  signal?: AbortSignal,
  now = new Date(),
): Promise<RecurringWeatherResult> {
  // Stop before today: a historical daily summary must describe a completed day.
  // If geocoding has no timezone, UTC is a conservative date boundary and the API
  // still resolves its local aggregation timezone through `auto`.
  let today: string
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: timezone === 'auto' ? 'UTC' : timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now)
    const part = (name: string) => parts.find(p => p.type === name)!.value
    today = `${part('year')}-${part('month')}-${part('day')}`
  } catch { throw new WeatherError('invalid') }
  const currentYear = Number(today.slice(0, 4))
  if (![month, day, startYear].every(Number.isInteger) || startYear < 1940 || startYear > currentYear
    || !validDate(startYear, month, day) || isoDate(startYear, month, day) > today
    || !Number.isFinite(latitude) || Math.abs(latitude) > 90
    || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new WeatherError('invalid')

  const entries: RecurringWeatherEntry[] = []
  for (let year = startYear; year <= currentYear; year++) {
    const date = isoDate(year, month, day)
    if (validDate(year, month, day) && date < today) entries.push({ year, date, weather: null })
  }
  if (!entries.length) throw new WeatherError('unavailable')

  // One continuous request, three daily variables. Only matching dates leave
  // this service; intermediate days are not mapped into application state.
  const params = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude), timezone,
    start_date: entries[0].date, end_date: entries[entries.length - 1].date,
    daily: 'weather_code,temperature_2m_min,temperature_2m_max', temperature_unit: 'celsius',
  })
  let data: unknown
  try {
    data = await fetchArchive(params, signal)
  } catch (error) {
    // Some archive sources lag by five days and reject an entire range if its
    // endpoint is too recent. Preserve older years with one bounded retry.
    const safeDate = new Date(`${today}T00:00:00Z`)
    safeDate.setUTCDate(safeDate.getUTCDate() - 6)
    const cutoff = safeDate.toISOString().slice(0, 10)
    const older = entries.filter(entry => entry.date <= cutoff)
    if (!(error instanceof WeatherError) || error.kind !== 'unavailable' || signal?.aborted
      || entries.at(-1)!.date <= cutoff || !older.length) throw error
    params.set('end_date', older.at(-1)!.date)
    data = await fetchArchive(params, signal)
  }
  if (!record(data) || data.error || !record(data.daily) || !Array.isArray(data.daily.time)) throw new WeatherError('invalid')
  const daily = data.daily
  const times = daily.time as unknown[]
  // Missing/truncated measurement arrays are partial data; wrong container
  // types indicate a malformed provider response rather than missing weather.
  for (const key of ['weather_code', 'temperature_2m_min', 'temperature_2m_max']) {
    if (daily[key] !== undefined && !Array.isArray(daily[key])) throw new WeatherError('invalid')
  }
  const wanted = new Map(entries.map(entry => [entry.date, entry]))
  let previous = ''
  for (let index = 0; index < times.length; index++) {
    const date = times[index]
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= previous) throw new WeatherError('invalid')
    previous = date
    const entry = wanted.get(date)
    if (!entry) continue
    const number = (key: string) => {
      const values = daily[key]
      const value = Array.isArray(values) ? values[index] : null
      return typeof value === 'number' && Number.isFinite(value) ? value : null
    }
    const weather = { weatherCode: number('weather_code'), temperatureMin: number('temperature_2m_min'), temperatureMax: number('temperature_2m_max') }
    if (Object.values(weather).some(value => value !== null)) entry.weather = weather
  }
  const available = entries.filter(entry => entry.weather !== null)
  return { month, day, startYear, endYear: entries[entries.length - 1].year,
    latestAvailableYear: available.at(-1)?.year ?? null, entries }
}
