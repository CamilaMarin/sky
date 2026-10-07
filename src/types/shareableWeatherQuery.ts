import type { Location } from './location'

export interface ShareableLocation {
  name: string
  latitude: number
  longitude: number
  timezone: string
  admin1?: string
  country?: string
}

export interface ShareableWeatherQuery {
  mode: 'single' | 'birthday'
  date: string
  location: ShareableLocation
}

/** URL locations have no provider ID; zero is only an in-memory placeholder. */
export function restoreLocation(location: ShareableLocation): Location {
  return { ...location, id: 0 }
}
