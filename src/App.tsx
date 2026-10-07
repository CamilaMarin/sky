import ShareButton from './components/ShareButton'
import { buildSingleDayShareContent, buildBirthdayShareContent } from './utils/shareContent'
import type { ShareContent } from './utils/shareContent'
import { parseWeatherQuery, serializeWeatherQuery, weatherQueryUrl } from './utils/shareableUrl'
import { restoreLocation } from './types/shareableWeatherQuery'
import type { ShareableWeatherQuery } from './types/shareableWeatherQuery'
import { getRecurringWeatherStats } from './utils/recurringWeatherStats'
import type { RecurringWeatherStats } from './types/recurringWeatherStats'
import RecurringWeather from './components/RecurringWeather'
import { getRecurringWeather } from './services/recurringWeather'
import type { RecurringWeatherResult, SearchMode } from './types/recurringWeather'
import { useLanguage } from './i18n/LanguageContext'
import type { TranslationKey } from './i18n/translations'
import LanguageSelector from './components/LanguageSelector'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  | { status: 'success'; kind: 'single'; weather: HistoricalWeather; location: Location; query: ShareableWeatherQuery | null }
  | { status: 'success'; kind: 'recurring'; result: RecurringWeatherResult; stats: RecurringWeatherStats; location: Location; query: ShareableWeatherQuery | null }
  | { status: 'error'; message: TranslationKey }

export default function App() {
  const { t, language } = useLanguage()
  const [initial] = useState(() => parseWeatherQuery(window.location.search))
  const initialQuery = initial.status === 'valid' ? initial.query : undefined
  const [mode, setMode] = useState<SearchMode>(initialQuery?.mode === 'birthday' ? 'recurring' : 'single')
  const [state, setState] = useState<WeatherState>({ status: 'idle' })
  const request = useRef<AbortController | null>(null)

  const handleSearch = useCallback(async (inputLocation: Location, date: string, searchMode: SearchMode) => {
    // Use the same rounded point for the original request and subsequent URL restores.
    let shareable: ShareableWeatherQuery | null = null
    let location = inputLocation
    try {
      const parsed = parseWeatherQuery(serializeWeatherQuery({ mode: searchMode === 'recurring' ? 'birthday' : 'single', date,
        location: { name: location.name, latitude: location.latitude, longitude: location.longitude,
          timezone: location.timezone ?? '', admin1: location.admin1, country: location.country ?? location.country_code } }))
      if (parsed.status === 'valid') { shareable = parsed.query; location = { ...location, ...parsed.query.location } }
    } catch { /* Existing provider locations without a recognized timezone still support auto weather. */ }
    function syncUrl() {
      try { window.history.replaceState(window.history.state, '', weatherQueryUrl(window.location.href, shareable)) }
      catch { /* Restricted browser history must not hide a successful weather result. */ }
    }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setState({ status: 'loading' })
    try {
      if (searchMode === 'recurring') {
        const [startYear, month, day] = date.split('-').map(Number)
        const result = await getRecurringWeather({ latitude: location.latitude, longitude: location.longitude,
          timezone: location.timezone || 'auto', startYear, month, day }, controller.signal)
        if (!controller.signal.aborted) {
          setState({ status: 'success', kind: 'recurring', result, stats: getRecurringWeatherStats(result), location, query: shareable })
          syncUrl()
        }
        return
      }
      const weather = await getHistoricalWeather({
        latitude: location.latitude, longitude: location.longitude, date,
        timezone: location.timezone || 'auto',
      }, controller.signal)
      if (!controller.signal.aborted) {
        setState({ status: 'success', kind: 'single', weather, location, query: shareable })
        syncUrl()
      }
    } catch (error) {
      if (controller.signal.aborted) return
      const message: TranslationKey = error instanceof WeatherError && error.kind === 'network'
        ? 'networkError'
        : error instanceof WeatherError && error.kind === 'unavailable'
          ? 'unavailableError'
          : 'invalidError'
      setState({ status: 'error', message })
    }
  }, [])

  useEffect(() => {
    if (initial.status === 'invalid') {
      try { window.history.replaceState(window.history.state, '', weatherQueryUrl(window.location.href, null)) } catch { /* Ignore unavailable history. */ }
    }
    // Defer one tick so StrictMode's setup/cleanup probe cannot issue a duplicate request.
    const timer = window.setTimeout(() => {
      if (initial.status === 'valid') void handleSearch(restoreLocation(initial.query.location), initial.query.date,
        initial.query.mode === 'birthday' ? 'recurring' : 'single')
    }, 0)
    return () => { window.clearTimeout(timer); request.current?.abort() }
  }, [initial, handleSearch])
  let shareContent: ShareContent | null = null
  if (state.status === 'success' && state.query) {
    try {
      shareContent = state.kind === 'single'
        ? buildSingleDayShareContent(state.query, state.weather, language, window.location.href)
        : buildBirthdayShareContent(state.query, language, window.location.href)
    } catch { /* Do not offer sharing for a query that is no longer valid. */ }
  }
  const shareAction = shareContent ? <ShareButton key={`${shareContent.url}:${language}`} content={shareContent} /> : undefined
  const theme = state.status === 'success' && state.kind === 'single' ? getWeatherTheme(state.weather.weatherCode) : 'neutral'
  return (
    <div className="page" data-weather={theme}>
      <WeatherAtmosphere theme={theme} />
      <header className="site-header">
        <a className="brand" href="#main-content" aria-label={t('home')}>
          <WeatherIcon theme="neutral" />
          <span>{t('title')}</span>
        </a>
        <LanguageSelector />
      </header>

      <main id="main-content" className="main-content">
        <p className="header-note">{t('tagline')}</p>
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1>{t('heading')}</h1>
        <p className="intro">{t('intro')}</p>
        <div className="search-mode" role="group" aria-label={t('searchMode')}>
          {(['single', 'recurring'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value}
            onClick={() => {
              if (mode === value) return
              request.current?.abort()
              setMode(value)
              setState({ status: 'idle' })
            }}>{t(value === 'single' ? 'singleMode' : 'recurringMode')}</button>)}
        </div>
        <SearchForm mode={mode} initialQuery={initialQuery ? { location: restoreLocation(initialQuery.location), date: initialQuery.date } : undefined}
          onSearch={(location, date) => void handleSearch(location, date, mode)} isLoading={state.status === 'loading'} />
        <p role="status" className="weather-status">
          {state.status === 'loading' ? t(mode === 'recurring' ? 'recurringLoading' : 'loading') : state.status === 'success' ? t(mode === 'recurring' ? 'recurringLoaded' : 'loaded') : ''}
        </p>
        <p role="alert" className="weather-error">{state.status === 'error' ? t(state.message) : ''}</p>
        <section aria-label={t('result')} aria-busy={state.status === 'loading'}>
          {state.status === 'success' && (state.kind === 'single'
            ? <WeatherCard actions={shareAction} weather={state.weather} location={state.location} />
            : <RecurringWeather actions={shareAction} result={state.result} stats={state.stats} location={state.location} />)}
        </section>
        <p className="memory-note">{t('memory')}</p>
      </main>

      <footer className="site-footer">{t('footer')}<p>{t('locationCredit')} <a href="https://www.geonames.org/">GeoNames</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></p></footer>
    </div>
  )
}
