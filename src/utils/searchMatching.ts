import type { Location } from '../types/location'
import { normalizeSearchText } from './searchNormalization'

/** Levenshtein distance; inputs are normalized by the caller. */
export function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    previous = current
  }
  return previous[b.length]
}

export function isCloseSearchMatch(query: string, candidate: string): boolean {
  if (!query || query.length > 120 || candidate.length > 120) return false
  if (query === candidate) return true
  // No fuzzy expansion for 1–3 characters. Preserve the first two characters
  // and cap edits even for long names; this intentionally favors precision.
  if (query.length < 4 || query.slice(0, 2) !== candidate.slice(0, 2)) return false
  const limit = query.length <= 5 ? 1 : 2
  const distance = editDistance(query, candidate)
  return distance <= limit && distance / Math.max(query.length, candidate.length) <= .25
}

function fuzzyName(query: string, name: string): string {
  // Provider-localized names can append a qualifier, e.g. Santiago de Chile.
  // Compare the leading words only at an explicit qualifier boundary.
  const words = name.split(' ')
  const count = query.split(' ').length
  if (words.length > count && ['de', 'del', 'do', 'da', 'dos', 'das'].includes(words[count])) return words.slice(0, count).join(' ')
  return name
}

export function scoreLocation(query: string, location: Location): { tier: number; distance: number } {
  const name = normalizeSearchText(location.name)
  if (name === query) return { tier: 0, distance: 0 }
  if (name.startsWith(query)) return { tier: 1, distance: 0 }
  const candidate = fuzzyName(query, name)
  if (isCloseSearchMatch(query, candidate)) return { tier: 2, distance: editDistance(query, candidate) }
  return { tier: 3, distance: Infinity }
}

export function rankLocations(query: string, locations: Location[], deduplicate = true): Location[] {
  const seen = new Set<number>()
  return locations.filter(location => {
    if (deduplicate && seen.has(location.id)) return false
    seen.add(location.id)
    return true
  }).map((location, index) => ({ location, index, ...scoreLocation(query, location) }))
    .sort((a, b) => a.tier - b.tier || (a.tier === 2 ? a.distance - b.distance : 0) || a.index - b.index)
    .map(item => item.location)
}


/** Only categorize supplied GeoNames codes; absent metadata remains unknown. */
export function getLocationCategory(location: Location): 'commune' | 'locality' | null {
  if (location.country_code?.toUpperCase() === 'CL' && location.feature_code === 'ADM3') return 'commune'
  if (typeof location.feature_code === 'string' && /^PPL(?:[A-Z0-9]*)$/.test(location.feature_code)) return 'locality'
  return null
}
