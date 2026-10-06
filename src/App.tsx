import { useLanguage } from './i18n/LanguageContext'
import type { TranslationKey } from './i18n/translations'
import LanguageSelector from './components/LanguageSelector'
import { useEffect, useRef, useState } from 'react'
import WeatherAtmosphere from './components/WeatherAtmosphere'
import WeatherIcon from './components/WeatherIcon'
import { getWeatherTheme } from './utils/weatherTheme'
import SearchForm from './components/SearchForm'
import WeatherCard from './components/WeatherCard'
import { getHistoricalWeather, WeatherError } from './services/weather'
import type { Location } from './types/location'
import type { HistoricalWeather } from './types/weather'

type WeatherState =
  | { status: 'idle' | 'loading' }
  | { status: 'success'; weather: HistoricalWeather; location: Location }
  | { status: 'error'; message: TranslationKey }

export default function App() {
  const { t } = useLanguage()
  const [state, setState] = useState<WeatherState>({ status: 'idle' })
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  async function handleSearch(location: Location, date: string) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setState({ status: 'loading' })
    try {
      const weather = await getHistoricalWeather({
        latitude: location.latitude, longitude: location.longitude, date,
        timezone: location.timezone || 'auto',
      }, controller.signal)
      if (!controller.signal.aborted) setState({ status: 'success', weather, location })
    } catch (error) {
      if (controller.signal.aborted) return
      const message: TranslationKey = error instanceof WeatherError && error.kind === 'network'
        ? 'networkError'
        : error instanceof WeatherError && error.kind === 'unavailable'
          ? 'unavailableError'
          : 'invalidError'
      setState({ status: 'error', message })
    }
  }
  const theme = state.status === 'success' ? getWeatherTheme(state.weather.weatherCode) : 'neutral'
  return (
    <div className="page" data-weather={theme}>
      <WeatherAtmosphere theme={theme} />
      <header className="site-header">
        <a className="brand" href="#main-content" aria-label={t('home')}>
          <WeatherIcon theme="neutral" />
          <span>{t('title')}</span>
        </a>
        <span className="header-note">{t('tagline')}</span>
        <LanguageSelector />
      </header>

      <main id="main-content" className="main-content">
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1>{t('heading')}</h1>
        <p className="intro">{t('intro')}</p>
        <SearchForm onSearch={handleSearch} isLoading={state.status === 'loading'} />
        <p role="status" className="weather-status">
          {state.status === 'loading' ? t('loading') : state.status === 'success' ? t('loaded') : ''}
        </p>
        <p role="alert" className="weather-error">{state.status === 'error' ? t(state.message) : ''}</p>
        <section aria-label={t('result')} aria-busy={state.status === 'loading'}>
          {state.status === 'success' && <WeatherCard weather={state.weather} location={state.location} />}
        </section>
        <p className="memory-note">{t('memory')}</p>
      </main>

      <footer className="site-footer">{t('footer')}</footer>
    </div>
  )
}
