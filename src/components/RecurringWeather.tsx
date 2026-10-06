import RecurringWeatherSummary from './RecurringWeatherSummary'
import type { RecurringWeatherStats } from '../types/recurringWeatherStats'
import { useLanguage } from '../i18n/LanguageContext'
import type { Location } from '../types/location'
import type { RecurringWeatherResult } from '../types/recurringWeather'
import { getWeatherDescriptionKey } from '../utils/weatherCodes'
import { getWeatherTheme } from '../utils/weatherTheme'
import { formatMeasurement } from '../utils/weatherFormatting'
import WeatherIcon from './WeatherIcon'

export default function RecurringWeather({ result, location, stats }: { stats: RecurringWeatherStats; result: RecurringWeatherResult; location: Location }) {
  const { t, locale } = useLanguage()
  // A known leap year preserves February 29 while formatting only month/day.
  const date = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2000, result.month - 1, result.day)))
  const locationName = [location.name, location.admin1, location.country ?? location.country_code].filter(Boolean).join(', ')
  return <article className="recurring-weather" aria-labelledby="recurring-heading">
    <header>
      <h2 id="recurring-heading">{t('recurringTitle')}</h2>
      <p>{date} · {locationName}</p>
      <p className="city-help">{t('recurringCoverage', { start: result.startYear, end: result.endYear })}</p>
      {result.latestAvailableYear === null && <p>{t('recurringEmpty')}</p>}
      {result.month === 2 && result.day === 29 && <p className="city-help">{t('leapNote')}</p>}
    </header>
    <RecurringWeatherSummary stats={stats} />
    <h3 className="recurring-list-heading">{t('yearsTitle')}</h3>
    <ol className="recurring-list">
      {result.entries.map(({ year, date: entryDate, weather }) => <li key={year}>
        <time dateTime={entryDate}>{year}</time>
        <WeatherIcon theme={getWeatherTheme(weather?.weatherCode ?? null)} />
        <span className="recurring-condition">{weather ? t(getWeatherDescriptionKey(weather.weatherCode)) : t('yearUnavailable')}</span>
        <dl>
          <div><dt>{t('low')}</dt><dd>{formatMeasurement(weather?.temperatureMin ?? null, '°C', locale, t('notAvailable'))}</dd></div>
          <div><dt>{t('high')}</dt><dd>{formatMeasurement(weather?.temperatureMax ?? null, '°C', locale, t('notAvailable'))}</dd></div>
        </dl>
      </li>)}
    </ol>
    <p className="city-help">{t('credit')} <a href="https://open-meteo.com/">Open-Meteo</a>.</p>
  </article>
}
