import type { Location } from '../types/location'

interface GeocodingResponse {
  results?: Location[]
  error?: boolean
}

export async function searchLocations(name: string, signal?: AbortSignal): Promise<Location[]> {
  const query = name.trim()
  if (query.length < 2) return []

  const params = new URLSearchParams({ name: query, count: '5', language: 'en', format: 'json' })
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal })
  if (!response.ok) throw new Error('Unable to search cities.')

  const data: GeocodingResponse = await response.json()
  if (data.error) throw new Error('Unable to search cities.')
  return (data.results ?? []).slice(0, 5)
}
