import { useLanguage } from '../i18n/LanguageContext'
import WeatherIcon from './WeatherIcon'
import { getWeatherTheme } from '../utils/weatherTheme'
import type { Location } from '../types/location'
import type { HistoricalWeather } from '../types/weather'
import { getWeatherDescriptionKey } from '../utils/weatherCodes'
import { formatLocalTime, formatMeasurement, formatSunshine, formatWeatherDate } from '../utils/weatherFormatting'

interface WeatherCardProps {
  weather: HistoricalWeather
  location: Location
}

export default function WeatherCard({ weather, location }: WeatherCardProps) {
  const { t, locale } = useLanguage()
  const unavailable = t('notAvailable')
  const measure = (value: number | null, unit: string) => formatMeasurement(value, unit, locale, unavailable)
  const temperature = weather.temperatureMean ?? weather.temperatureMax ?? weather.temperatureMin
  const temperatureLabel = weather.temperatureMean !== null ? t('mean')
    : weather.temperatureMax !== null ? t('highMain') : weather.temperatureMin !== null ? t('lowMain') : t('temperature')
  const measurements = [
    [t('rain'), measure(weather.precipitationSum, 'mm')],
    [t('wind'), measure(weather.windSpeedMax, 'km/h')],
    [t('sunshine'), formatSunshine(weather.sunshineDuration, unavailable)],
  ]
  return (
    <article className="weather-card" aria-labelledby="weather-heading">
      <header>
        <p className="weather-date"><time dateTime={weather.date}>{formatWeatherDate(weather.date, locale)}</time></p>
        <h2 id="weather-heading">{location.name}</h2>
        <p className="weather-place">{[location.admin1, location.country ?? location.country_code].filter(Boolean).join(', ')}</p>
        <WeatherIcon theme={getWeatherTheme(weather.weatherCode)} />
        <p className="weather-condition">{t(getWeatherDescriptionKey(weather.weatherCode))}</p>
      </header>
      <dl className="temperature-main">
        <dt>{temperatureLabel}</dt>
        <dd className={temperature === null ? 'temperature-unavailable' : undefined}>{measure(temperature, '°C')}</dd>
      </dl>
      <dl className="temperature-range">
        <div><dt>{t('low')}</dt><dd>{measure(weather.temperatureMin, '°C')}</dd></div>
        <div><dt>{t('high')}</dt><dd>{measure(weather.temperatureMax, '°C')}</dd></div>
      </dl>
      <dl className="weather-measurements">
        {measurements.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <dl className="sun-times">
        <div><dt>{t('sunrise')}</dt><dd>{formatLocalTime(weather.sunrise, locale, unavailable)}</dd></div>
        <div><dt>{t('sunset')}</dt><dd>{formatLocalTime(weather.sunset, locale, unavailable)}</dd></div>
      </dl>
      <p className="city-help">{t('localTime', { location: `${location.name}${location.timezone ? ` (${location.timezone})` : ''}` })}</p>
      <p className="city-help">{t('credit')} <a href="https://open-meteo.com/">Open-Meteo</a>.</p>
    </article>
  )
}
