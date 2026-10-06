import type { WeatherTheme } from '../utils/weatherTheme'

export interface TemperatureRecord { year: number; value: number }
export interface ThemeShare { theme: WeatherTheme; count: number; percentage: number | null }
export interface RecurringWeatherStats {
  totalYears: number
  yearsWithData: number
  yearsWithoutData: number
  classifiedYears: number
  warmest: TemperatureRecord | null
  coldest: TemperatureRecord | null
  mostCommonTheme: WeatherTheme | null
  themeDistribution: ThemeShare[]
  averageHigh: number | null
  averageLow: number | null
}
