import { locales, translate } from '../i18n/translations'
import type { Language } from '../i18n/translations'
import type { ShareableWeatherQuery } from '../types/shareableWeatherQuery'
import type { HistoricalWeather } from '../types/weather'
import { getWeatherDescriptionKey } from './weatherCodes'
import { formatMeasurement, formatWeatherDate, mainTemperature } from './weatherFormatting'
import { weatherQueryUrl } from './shareableUrl'

export interface ShareContent { title: string; text: string; url: string }

function baseContent(query: ShareableWeatherQuery, language: Language, href: string): ShareContent {
  const url = weatherQueryUrl(href, query)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported share URL')
  return { title: translate(language, 'title'), text: '', url: url.href }
}

export function buildSingleDayShareContent(query: ShareableWeatherQuery, weather: HistoricalWeather, language: Language, href: string): ShareContent {
  if (query.mode !== 'single' || query.date !== weather.date) throw new Error('Mismatched share query')
  const content = baseContent(query, language, href)
  const temperature = mainTemperature(weather)
  const details = [translate(language, getWeatherDescriptionKey(weather.weatherCode))]
  if (temperature !== null) details.push(formatMeasurement(temperature, '°C', locales[language], ''))
  content.text = `${translate(language, 'shareSingle', { place: query.location.name, date: formatWeatherDate(query.date, locales[language]) })}\n${details.join(' · ')}`
  return content
}

export function buildBirthdayShareContent(query: ShareableWeatherQuery, language: Language, href: string): ShareContent {
  if (query.mode !== 'birthday') throw new Error('Mismatched share query')
  const content = baseContent(query, language, href)
  content.text = `${translate(language, 'shareBirthday', { place: query.location.name, year: query.date.slice(0, 4) })}\n${translate(language, 'shareYears')}`
  return content
}
