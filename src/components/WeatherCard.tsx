import WeatherIcon from './WeatherIcon'
import { getWeatherTheme } from '../utils/weatherTheme'
import type { Location } from '../types/location'
import type { HistoricalWeather } from '../types/weather'
import { describeWeatherCode } from '../utils/weatherCodes'
import { formatLocalTime, formatMeasurement, formatSunshine, formatWeatherDate } from '../utils/weatherFormatting'

interface WeatherCardProps {
  weather: HistoricalWeather
  location: Location
}

export default function WeatherCard({ weather, location }: WeatherCardProps) {
  const temperature = weather.temperatureMean ?? weather.temperatureMax ?? weather.temperatureMin
  const temperatureLabel = weather.temperatureMean !== null ? 'Daily mean'
    : weather.temperatureMax !== null ? 'Daily high' : weather.temperatureMin !== null ? 'Daily low' : 'Temperature'
  const measurements = [
    ['Rain', formatMeasurement(weather.precipitationSum, 'mm')],
    ['Max wind', formatMeasurement(weather.windSpeedMax, 'km/h')],
    ['Sunshine', formatSunshine(weather.sunshineDuration)],
  ]
  return (
    <article className="weather-card" aria-labelledby="weather-heading">
      <header>
        <p className="weather-date"><time dateTime={weather.date}>{formatWeatherDate(weather.date)}</time></p>
        <h2 id="weather-heading">{location.name}</h2>
        <p className="weather-place">{[location.admin1, location.country ?? location.country_code].filter(Boolean).join(', ')}</p>
        <WeatherIcon theme={getWeatherTheme(weather.weatherCode)} />
        <p className="weather-condition">{describeWeatherCode(weather.weatherCode)}</p>
      </header>
      <dl className="temperature-main">
        <dt>{temperatureLabel}</dt>
        <dd className={temperature === null ? 'temperature-unavailable' : undefined}>{formatMeasurement(temperature, '°C')}</dd>
      </dl>
      <dl className="temperature-range">
        <div><dt>Low</dt><dd>{formatMeasurement(weather.temperatureMin, '°C')}</dd></div>
        <div><dt>High</dt><dd>{formatMeasurement(weather.temperatureMax, '°C')}</dd></div>
      </dl>
      <dl className="weather-measurements">
        {measurements.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <dl className="sun-times">
        <div><dt>Sunrise</dt><dd>{formatLocalTime(weather.sunrise)}</dd></div>
        <div><dt>Sunset</dt><dd>{formatLocalTime(weather.sunset)}</dd></div>
      </dl>
      <p className="city-help">Times are local to {location.name}{location.timezone ? ` (${location.timezone})` : ''}.</p>
      <p className="city-help">Weather data by <a href="https://open-meteo.com/">Open-Meteo</a>.</p>
    </article>
  )
}
