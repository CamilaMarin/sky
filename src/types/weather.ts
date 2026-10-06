/** UI model. Null means the provider has no value for that measurement. */
export interface HistoricalWeather {
  date: string
  weatherCode: number | null
  temperatureMax: number | null
  temperatureMin: number | null
  temperatureMean: number | null
  precipitationSum: number | null
  windSpeedMax: number | null
  /** Seconds of sunshine. */
  sunshineDuration: number | null
  /** Local ISO date-times in the requested location's timezone. */
  sunrise: string | null
  sunset: string | null
}
