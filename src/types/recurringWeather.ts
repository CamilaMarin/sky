import type { HistoricalWeather } from './weather'

export type SearchMode = 'single' | 'recurring'
export interface RecurringWeatherEntry {
  year: number
  date: string
  weather: Pick<HistoricalWeather, 'weatherCode' | 'temperatureMin' | 'temperatureMax'> | null
}
export interface RecurringWeatherResult {
  month: number
  day: number
  startYear: number
  /** Last year requested, including unavailable years. */
  endYear: number
  latestAvailableYear: number | null
  entries: RecurringWeatherEntry[]
}
