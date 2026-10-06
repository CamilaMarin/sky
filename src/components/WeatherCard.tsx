import type { Location } from '../types/location'
import type { HistoricalWeather } from '../types/weather'
import { describeWeatherCode } from '../utils/weatherCodes'
import { formatLocalTime, formatMeasurement, formatSunshine, formatWeatherDate } from '../utils/weatherFormatting'

interface WeatherCardProps {
  weather: HistoricalWeather
  location: Location
}

export default function WeatherCard({ weather, location }: WeatherCardProps) {
  const measurements = [
    ['Maximum temperature', formatMeasurement(weather.temperatureMax, '°C')],
    ['Minimum temperature', formatMeasurement(weather.temperatureMin, '°C')],
    ['Mean temperature', formatMeasurement(weather.temperatureMean, '°C')],
    ['Precipitation', formatMeasurement(weather.precipitationSum, 'mm')],
    ['Maximum wind', formatMeasurement(weather.windSpeedMax, 'km/h')],
    ['Sunshine', formatSunshine(weather.sunshineDuration)],
    ['Sunrise', formatLocalTime(weather.sunrise)],
    ['Sunset', formatLocalTime(weather.sunset)],
  ]
  return (
    <article className="weather-card" aria-labelledby="weather-heading">
      <header>
        <p><time dateTime={weather.date}>{formatWeatherDate(weather.date)}</time></p>
        <h2 id="weather-heading">{[location.name, location.admin1, location.country ?? location.country_code].filter(Boolean).join(', ')}</h2>
        <p className="weather-condition">{describeWeatherCode(weather.weatherCode)}</p>
      </header>
      <dl className="weather-measurements">
        {measurements.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <p className="city-help">Times are local to {location.name}{location.timezone ? ` (${location.timezone})` : ''}.</p>
      <p className="city-help">Weather data by <a href="https://open-meteo.com/">Open-Meteo</a>.</p>
    </article>
  )
}
