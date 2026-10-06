import type { RecurringWeatherResult } from '../types/recurringWeather'
import type { RecurringWeatherStats, TemperatureRecord } from '../types/recurringWeatherStats'
import { getWeatherTheme } from './weatherTheme'
import type { WeatherTheme } from './weatherTheme'

// Explicit tie priority, independent of input or object key order.
const themeOrder: readonly WeatherTheme[] = ['clear', 'cloudy', 'rain', 'snow', 'storm', 'fog', 'neutral']
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export function getRecurringWeatherStats(result: RecurringWeatherResult): RecurringWeatherStats {
  const themeDistribution = themeOrder.map(theme => ({ theme, count: 0, percentage: null as number | null }))
  let yearsWithData = 0, classifiedYears = 0, highSum = 0, lowSum = 0, highCount = 0, lowCount = 0
  let warmest: TemperatureRecord | null = null, coldest: TemperatureRecord | null = null
  for (const { year, weather } of result.entries) {
    if (!weather) continue
    const { temperatureMax: high, temperatureMin: low, weatherCode: code } = weather
    const theme = getWeatherTheme(code)
    const classified = finite(code) && theme !== 'neutral'
    if (finite(high) || finite(low) || classified) yearsWithData++
    if (finite(high)) {
      highSum += high; highCount++
      if (!warmest || high > warmest.value || (high === warmest.value && year < warmest.year)) warmest = { year, value: high }
    }
    if (finite(low)) {
      lowSum += low; lowCount++
      if (!coldest || low < coldest.value || (low === coldest.value && year < coldest.year)) coldest = { year, value: low }
    }
    if (classified) {
      classifiedYears++
      themeDistribution.find(item => item.theme === theme)!.count++
    }
  }
  let mostCommonTheme: WeatherTheme | null = null, highestCount = 0
  for (const item of themeDistribution) {
    item.percentage = classifiedYears ? item.count / classifiedYears * 100 : null
    if (item.count > highestCount) { highestCount = item.count; mostCommonTheme = item.theme }
  }
  return { totalYears: result.entries.length, yearsWithData, yearsWithoutData: result.entries.length - yearsWithData,
    classifiedYears, warmest, coldest, mostCommonTheme, themeDistribution,
    averageHigh: highCount ? highSum / highCount : null, averageLow: lowCount ? lowSum / lowCount : null }
}
