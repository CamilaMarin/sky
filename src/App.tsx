import { useEffect, useRef, useState } from 'react'
import SearchForm from './components/SearchForm'
import WeatherCard from './components/WeatherCard'
import { getHistoricalWeather, WeatherError } from './services/weather'
import type { Location } from './types/location'
import type { HistoricalWeather } from './types/weather'

type WeatherState =
  | { status: 'idle' | 'loading' }
  | { status: 'success'; weather: HistoricalWeather; location: Location }
  | { status: 'error'; message: string }

export default function App() {
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
      const message = error instanceof WeatherError && error.kind === 'network'
        ? 'We could not connect. Check your internet connection and try again.'
        : error instanceof WeatherError && error.kind === 'unavailable'
          ? 'Weather data is unavailable for this date right now. Try another date or try again later.'
          : 'We could not read the weather data. Please try again later.'
      setState({ status: 'error', message })
    }
  }
  return (
    <div className="page">
      <header className="site-header">
        <a className="brand" href="#main-content" aria-label="How Was the Sky? Home">
          <span className="brand-sun" aria-hidden="true">☀</span>
          <span>How Was the Sky?</span>
        </a>
        <span className="header-note">A little trip back in time</span>
      </header>

      <main id="main-content" className="main-content">
        <div className="sky-illustration" aria-hidden="true">
          <div className="sun" />
          <div className="cloud cloud-back" />
          <div className="cloud cloud-front" />
        </div>
        <p className="eyebrow">Every day has a sky</p>
        <h1>How Was the Sky?</h1>
        <p className="intro">Discover what the weather was on a day that matters to you.</p>
        <SearchForm onSearch={handleSearch} isLoading={state.status === 'loading'} />
        <p role="status" className="weather-status">
          {state.status === 'loading' ? 'Loading historical weather…' : state.status === 'success' ? 'Historical weather loaded.' : ''}
        </p>
        <p role="alert" className="weather-error">{state.status === 'error' ? state.message : ''}</p>
        <section aria-label="Historical weather result" aria-busy={state.status === 'loading'}>
          {state.status === 'success' && <WeatherCard weather={state.weather} location={state.location} />}
        </section>
        <p className="memory-note">A place. A date. A moment to rediscover.</p>
      </main>

      <footer className="site-footer">Looking back, one sky at a time.</footer>
    </div>
  )
}
