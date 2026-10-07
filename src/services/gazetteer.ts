import type { Location } from '../types/location'
import { normalizeSearchText } from '../utils/searchNormalization'
import { rankLocations, scoreLocation } from '../utils/searchMatching'

export interface GazetteerLocation extends Location { country_code: string; timezone: string }

/** Compact versioned tuples: id, name, latitude, longitude, region code, timezone; v2 adds feature class/code and administrative IDs. */
export function parseGazetteer(value: unknown): GazetteerLocation[] {
  if (!value || typeof value !== 'object') throw new Error('Invalid gazetteer')
  const data = value as Record<string, unknown>
  if ((data.version !== 1 && data.version !== 2) || typeof data.countryCode !== 'string' || !/^[A-Z]{2}$/.test(data.countryCode)
    || !data.regions || typeof data.regions !== 'object' || !Array.isArray(data.locations)) throw new Error('Invalid gazetteer')
  const regions = data.regions as Record<string, unknown>
  const seen = new Set<number>()
  return data.locations.map((row: unknown) => {
    if (!Array.isArray(row) || row.length !== (data.version === 2 ? 10 : 6)) throw new Error('Invalid gazetteer row')
    const [id, name, latitude, longitude, region, timezone, featureClass, featureCode, admin1Id, admin3Id] = row
    if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id) || typeof name !== 'string' || !name.trim()
      || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180
      || typeof region !== 'string' || typeof timezone !== 'string' || !/^[A-Za-z_]+\/[A-Za-z_/-]+$/.test(timezone)) throw new Error('Invalid gazetteer row')
    if (data.version === 2 && (!['A', 'P'].includes(featureClass) || typeof featureCode !== 'string'
      || !/^[A-Z0-9]{2,8}$/.test(featureCode)
      || [admin1Id, admin3Id].some(value => value !== null && (!Number.isSafeInteger(value) || value <= 0)))) throw new Error('Invalid gazetteer metadata')
    seen.add(id)
    return { id, name, latitude, longitude, country_code: data.countryCode as string,
      ...(data.version === 2 ? { feature_class: featureClass, feature_code: featureCode, admin1_id: admin1Id ?? undefined, admin3_id: admin3Id ?? undefined } : {}),
      country: typeof data.country === 'string' ? data.country : undefined,
      admin1: typeof regions[region] === 'string' ? regions[region] as string : undefined, timezone, source: 'geonames' }
  })
}

const datasets = new Map<string, Promise<GazetteerLocation[]>>()
export function loadGazetteer(countryCode = 'CL'): Promise<GazetteerLocation[]> {
  if (!/^[A-Z]{2}$/.test(countryCode)) return Promise.reject(new Error('Invalid country code'))
  let pending = datasets.get(countryCode)
  if (!pending) {
    // Shared lazy request must survive cancellation of any one autocomplete query.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    pending = fetch(`${import.meta.env.BASE_URL}data/locations/${countryCode}.json`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Gazetteer unavailable'); return response.json() })
      .then(parseGazetteer)
      .finally(() => clearTimeout(timeout))
    datasets.set(countryCode, pending)
    // Retain a failure for this session to avoid a request on every keystroke.
  }
  return pending
}

export async function searchGazetteer(name: string, signal?: AbortSignal, countries = ['CL']): Promise<Location[]> {
  const query = normalizeSearchText(name)
  signal?.throwIfAborted()
  if (query.length < 2 || query.length > 120) return []
  const datasets = await Promise.all(countries.map(loadGazetteer))
  signal?.throwIfAborted()
  return rankLocations(query, datasets.flat().filter(location => scoreLocation(query, location).tier <= 2))
}
