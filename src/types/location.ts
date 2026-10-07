export interface Location {
  source?: 'open-meteo' | 'geonames'
  id: number
  name: string
  latitude: number
  longitude: number
  country?: string
  country_code?: string
  admin1?: string
  timezone?: string
}
