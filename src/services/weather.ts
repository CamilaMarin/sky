import type { HistoricalWeather } from '../types/weather'

export class WeatherError extends Error {
  constructor(public readonly kind: 'network' | 'invalid' | 'unavailable') {
    super(kind)
  }
}

interface WeatherRequest {
  latitude: number
  longitude: number
  date: string
  timezone: string
}

const numericFields = {
  weatherCode: 'weather_code',
  temperatureMax: 'temperature_2m_max',
  temperatureMin: 'temperature_2m_min',
  temperatureMean: 'temperature_2m_mean',
  precipitationSum: 'precipitation_sum',
  windSpeedMax: 'wind_speed_10m_max',
  sunshineDuration: 'sunshine_duration',
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseWeather(data: unknown, date: string): HistoricalWeather {
  if (!isRecord(data) || data.error || !isRecord(data.daily)) throw new WeatherError('invalid')
  const daily = data.daily
  if (!Array.isArray(daily.time)) throw new WeatherError('invalid')
  if (!daily.time.length) throw new WeatherError('unavailable')
  if (daily.time.length !== 1 || daily.time[0] !== date) throw new WeatherError('invalid')

  function readValue(key: string): unknown {
    const values = daily[key]
    if (!Array.isArray(values) || values.length !== 1) throw new WeatherError('invalid')
    return values[0]
  }
  function readNumber(key: string): number | null {
    const value = readValue(key)
    if (value === null) return null
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new WeatherError('invalid')
    return value
  }
  function readTime(key: string): string | null {
    const value = readValue(key)
    if (value === null) return null
    if (typeof value !== 'string' || !value.startsWith(`${date}T`) || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new WeatherError('invalid')
    }
    return value
  }
  const measurements = Object.fromEntries(
    Object.entries(numericFields).map(([key, field]) => [key, readNumber(field)]),
  ) as Pick<HistoricalWeather, keyof typeof numericFields>
  if (Object.values(measurements).every(value => value === null)) throw new WeatherError('unavailable')
  return { date, ...measurements, sunrise: readTime('sunrise'), sunset: readTime('sunset') }
}

export async function getHistoricalWeather(
  { latitude, longitude, date, timezone }: WeatherRequest,
  signal?: AbortSignal,
): Promise<HistoricalWeather> {
  const params = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude),
    start_date: date, end_date: date, timezone,
    daily: [...Object.values(numericFields), 'sunrise', 'sunset'].join(','),
    temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm',
  })
  let response: Response
  try {
    response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`, { signal })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new WeatherError('network')
  }
  if (!response.ok) throw new WeatherError('unavailable')
  let data: unknown
  try { data = await response.json() } catch { throw new WeatherError('invalid') }
  return parseWeather(data, date)
}
