export interface Location {
  source?: 'open-meteo' | 'geonames'
  id: number
  name: string
  latitude: number
  longitude: number
  country?: string
  country_code?: string
  admin1?: string
  feature_class?: string
  feature_code?: string
  admin1_id?: number
  admin3_id?: number
  timezone?: string
}
