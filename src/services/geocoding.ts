import type { Language } from '../i18n/translations'
import type { Location } from '../types/location'
import { normalizeSearchText } from '../utils/searchNormalization'
import { rankLocations, scoreLocation } from '../utils/searchMatching'

export interface LocationSearchResult {
  locations: Location[]
  correction: string | null
}
interface GeocodingResponse { results?: Location[]; error?: boolean }

async function fetchLocations(name: string, count: number, language: Language, signal?: AbortSignal): Promise<Location[]> {
  const params = new URLSearchParams({ name, count: String(count), language, format: 'json' })
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal })
  if (!response.ok) throw new Error('Unable to search cities.')
  const data: GeocodingResponse = await response.json()
  if (!data || data.error || (data.results !== undefined && !Array.isArray(data.results))) throw new Error('Invalid city response.')
  return (data.results ?? []).filter(location => typeof location.name === 'string' && Number.isFinite(location.id)
    && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)).slice(0, count)
}

/** One normal request, at most one additional prefix request. */
export async function searchLocations(name: string, signal?: AbortSignal, language: Language = 'en'): Promise<LocationSearchResult> {
  const query = normalizeSearchText(name)
  if (query.length < 2) return { locations: [], correction: null }
  const original = await fetchLocations(name.trim().replace(/\s+/gu, ' '), 5, language, signal)
  signal?.throwIfAborted()
  const hasExact = original.some(location => scoreLocation(query, location).tier === 0)
  let candidates = original
  // Do not broaden qualified searches or short prefixes. Sparse results such
  // as Santigoso for "santigo" may hide the intended spelling.
  const fallback = query.length >= 6 && query.length <= 120 && !query.includes(',') && !hasExact && original.length < 5
  if (fallback) {
    try {
      const broad = await fetchLocations(query.slice(0, 4), 20, language, signal)
      signal?.throwIfAborted()
      candidates = [...original, ...broad.filter(location => scoreLocation(query, location).tier <= 2)]
    } catch (error) {
      // An optional fallback failure must not erase valid provider suggestions.
      if (signal?.aborted || original.length === 0) throw error
    }
  }
  const locations = rankLocations(query, candidates).slice(0, 5)
  // Only a one-edit, same-prefix suggestion earns the explicit correction
  // message; two-edit matches remain ordinary selectable suggestions.
  const bestFuzzy = locations.find(location => {
    const score = scoreLocation(query, location)
    return score.tier === 2 && score.distance === 1
  })
  return { locations, correction: !hasExact && bestFuzzy ? bestFuzzy.name : null }
}
