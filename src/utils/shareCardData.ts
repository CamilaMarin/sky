import { locales, translate } from '../i18n/translations'
import type { Language, TranslationKey } from '../i18n/translations'
import type { Location } from '../types/location'
import type { HistoricalWeather } from '../types/weather'
import type { RecurringWeatherResult } from '../types/recurringWeather'
import type { RecurringWeatherStats } from '../types/recurringWeatherStats'
import type { BirthdayShareCardData, CardMetric, SingleDayShareCardData } from '../types/shareCard'
import type { WeatherTheme } from './weatherTheme'
import { getWeatherTheme } from './weatherTheme'
import { getWeatherDescriptionKey } from './weatherCodes'
import { formatMeasurement, formatWeatherDate, mainTemperature } from './weatherFormatting'

const themeLabels: Record<WeatherTheme, TranslationKey> = {
  clear: 'themeClear', cloudy: 'themeCloudy', rain: 'themeRain', snow: 'themeSnow',
  storm: 'themeStorm', fog: 'themeFog', neutral: 'themeNeutral',
}
const place = (location: Pick<Location, 'name' | 'country'>) => [location.name, location.country].filter(Boolean).join(', ')
const temperature = (value: number | null, language: Language): string | null =>
  value === null || !Number.isFinite(value) ? null : formatMeasurement(value, '°C', locales[language], '')
function metric(label: string, value: number | null, language: Language, year?: number): CardMetric[] {
  const formatted = temperature(value, language)
  return formatted === null ? [] : [{ label, value: formatted, ...(year === undefined ? {} : { year: String(year) }) }]
}

export function buildSingleDayShareCardData(weather: HistoricalWeather, location: Pick<Location, 'name' | 'country'>, language: Language): SingleDayShareCardData {
  return {
    kind: 'single', brand: 'HOW WAS THE SKY?', date: formatWeatherDate(weather.date, locales[language]),
    location: place(location), theme: getWeatherTheme(weather.weatherCode),
    condition: translate(language, getWeatherDescriptionKey(weather.weatherCode)),
    temperature: temperature(mainTemperature(weather), language),
    extremes: [...metric(translate(language, 'low'), weather.temperatureMin, language),
      ...metric(translate(language, 'high'), weather.temperatureMax, language)],
    tagline: translate(language, 'cardPast'),
  }
}

export function buildBirthdayShareCardData(result: Pick<RecurringWeatherResult, 'month' | 'day' | 'startYear' | 'endYear'>,
  stats: RecurringWeatherStats, location: Pick<Location, 'name' | 'country'>, language: Language): BirthdayShareCardData {
  return {
    kind: 'birthday', brand: 'HOW WAS THE SKY?',
    date: new Intl.DateTimeFormat(locales[language], { month: 'long', day: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(2000, result.month - 1, result.day))),
    location: place(location), range: `${result.startYear} — ${result.endYear}`,
    theme: stats.mostCommonTheme ?? 'neutral',
    commonTheme: stats.mostCommonTheme === null ? null : translate(language, themeLabels[stats.mostCommonTheme]),
    yearsWithData: new Intl.NumberFormat(locales[language]).format(stats.yearsWithData),
    yearsLabel: translate(language, stats.yearsWithData === 1 ? 'cardYear' : 'cardYears'),
    records: [...metric(translate(language, 'cardWarmest'), stats.warmest?.value ?? null, language, stats.warmest?.year),
      ...metric(translate(language, 'cardColdest'), stats.coldest?.value ?? null, language, stats.coldest?.year)],
    averages: [...metric(translate(language, 'cardAvgHigh'), stats.averageHigh, language),
      ...metric(translate(language, 'cardAvgLow'), stats.averageLow, language)],
    tagline: translate(language, 'cardMemories'),
  }
}
