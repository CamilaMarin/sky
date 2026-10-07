import type { Language } from '../i18n/translations'
import type { Location } from '../types/location'
import { searchLocations, type LocationSearchResult } from './geocoding'
import { searchGazetteer } from './gazetteer'
import { normalizeSearchText } from '../utils/searchNormalization'
import { getLocationCategory, rankLocations, scoreLocation } from '../utils/searchMatching'

function nearby(a: Location, b: Location): boolean {
  const radians = Math.PI / 180
  const dlat = (a.latitude - b.latitude) * radians
  const dlon = (a.longitude - b.longitude) * radians
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(dlon / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h))) <= 1
}

function sameAdministrativeArea(a: Location, b: Location): boolean {
  if (a.admin3_id && b.admin3_id && a.admin3_id !== b.admin3_id) return false
  if (a.admin1_id && b.admin1_id) return a.admin1_id === b.admin1_id
  return !!a.admin1 && !!b.admin1 && normalizeSearchText(a.admin1) === normalizeSearchText(b.admin1)
}

export function mergeLocations(query: string, provider: Location[], local: Location[]): Location[] {
  // Rank before deduplication so a translated provider label cannot hide an exact local match.
  const ranked = rankLocations(query, [...provider, ...local], false).sort((a, b) => {
    // Category only refines exact ties; it never outranks a better text match.
    if (scoreLocation(query, a).tier !== 0 || scoreLocation(query, b).tier !== 0) return 0
    return Number(getLocationCategory(b) === 'commune') - Number(getLocationCategory(a) === 'commune')
  })
  const merged: Location[] = []
  for (const candidate of ranked) {
    const existing = merged.find(item => item.id === candidate.id || (item.country_code && candidate.country_code
      && item.country_code.toUpperCase() === candidate.country_code.toUpperCase()
      && getLocationCategory(item) !== null && getLocationCategory(item) === getLocationCategory(candidate)
      && sameAdministrativeArea(item, candidate)
      && normalizeSearchText(item.name) === normalizeSearchText(candidate.name) && nearby(item, candidate)))
    if (existing) {
      existing.timezone ??= candidate.timezone
      existing.admin1 ??= candidate.admin1
      existing.country ??= candidate.country
      existing.feature_code ??= candidate.feature_code
      existing.feature_class ??= candidate.feature_class
      existing.admin1_id ??= candidate.admin1_id
      existing.admin3_id ??= candidate.admin3_id
    } else merged.push({ ...candidate })
  }
  return merged.slice(0, 5)
}

let warned = false
export async function searchLocationCandidates(name: string, signal?: AbortSignal, language: Language = 'en'): Promise<LocationSearchResult> {
  const query = normalizeSearchText(name)
  signal?.throwIfAborted()
  if (query.length < 2) return { locations: [], correction: null }
  const [remote, local] = await Promise.allSettled([searchLocations(name, signal, language), searchGazetteer(name, signal)])
  signal?.throwIfAborted()
  if (local.status === 'rejected' && !warned) { warned = true; console.warn('Local location catalog unavailable; using Open-Meteo.') }
  const localLocations = local.status === 'fulfilled' ? local.value : []
  if (remote.status === 'rejected' && localLocations.length === 0) throw remote.reason
  const locations = mergeLocations(query, remote.status === 'fulfilled' ? remote.value.locations : [], localLocations)
  const exact = locations.some(location => scoreLocation(query, location).tier === 0)
  const fuzzy = locations.find(location => { const score = scoreLocation(query, location); return score.tier === 2 && score.distance === 1 })
  return { locations, correction: !exact && fuzzy ? fuzzy.name : null }
}
