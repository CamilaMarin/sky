import type { SearchMode } from '../types/recurringWeather'
import { useLanguage } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { normalizeSearchText } from '../utils/searchNormalization'
import type { LocationSearchResult } from '../services/geocoding'
import { searchLocationCandidates as searchLocations } from '../services/locationSearch'
import type { Location } from '../types/location'

function locationLabel(location: Location) {
  return [location.name, location.admin1, location.country ?? location.country_code].filter(Boolean).join(', ')
}

interface SearchFormProps {
  onSearch: (location: Location, date: string) => void
  isLoading: boolean
  mode: SearchMode
}

export default function SearchForm({ onSearch, isLoading, mode }: SearchFormProps) {
  const { language, t } = useLanguage()
  const [date, setDate] = useState('')
  const [message, setMessage] = useState<TranslationKey | ''>('')
  const [city, setCity] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [correction, setCorrection] = useState<string | null>(null)
  const [results, setResults] = useState<Location[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const cache = useRef(new Map<string, LocationSearchResult>())
  const query = city.trim()
  const expanded = open && !selectedLocation && query.length >= 2

  useEffect(() => {
    if (!open || selectedLocation || query.length < 2) return
    const controller = new AbortController()
    const cacheKey = `${language}:${normalizeSearchText(query)}`
    setResults([])
    setCorrection(null)
    setActiveIndex(-1)
    const cached = cache.current.get(cacheKey)
    if (cached) {
      setResults(cached.locations)
      setCorrection(cached.correction)
      setStatus('success')
      return
    }
    setStatus('idle')
    const timer = window.setTimeout(async () => {
      setStatus('loading')
      try {
        const locations = await searchLocations(query, controller.signal, language)
        if (controller.signal.aborted) return
        // Bound session memory; failed or aborted searches are never cached.
        if (cache.current.size >= 100) cache.current.delete(cache.current.keys().next().value!)
        cache.current.set(cacheKey, locations)
        setResults(locations.locations)
        setCorrection(locations.correction)
        setStatus('success')
      } catch {
        if (!controller.signal.aborted) setStatus('error')
      }
    }, 300)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, selectedLocation, open, language])

  function selectLocation(location: Location) {
    setSelectedLocation(location)
    setCity(locationLabel(location))
    setOpen(false)
    setActiveIndex(-1)
    setMessage('')
  }

  function handleCityKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setActiveIndex(-1)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (results.length) {
        setActiveIndex(index => event.key === 'ArrowDown'
          ? (index + 1) % results.length
          : (index <= 0 ? results.length : index) - 1)
      }
    } else if (event.key === 'Enter' && expanded) {
      event.preventDefault()
      if (activeIndex >= 0 && results[activeIndex]) selectLocation(results[activeIndex])
    }
  }

  const searchMessage = status === 'loading' ? t('searching')
    : status === 'error' ? t('cityError')
    : status === 'success' ? (results.length ? [correction ? t('didYouMean', { city: correction }) : '', t('found', { count: results.length })].filter(Boolean).join(' ') : `${t('noLocations')} ${t('checkSpelling')}`)
    : ''
  const today = new Date()
  // Use local calendar values to avoid shifting the date across time zones.
  const maxDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedLocation || !Number.isFinite(selectedLocation.latitude) || !Number.isFinite(selectedLocation.longitude)) {
      setMessage('selectCity')
      inputRef.current?.focus()
      return
    }
    if (!date || date > maxDate || date < '1940-01-01') {
      setMessage('validDate')
      return
    }
    if (isLoading) return
    setMessage('')
    onSearch(selectedLocation, date)
  }

  return (
    <form className="search-form" onSubmit={handleSubmit} onChange={() => setMessage('')} aria-label={t('formLabel')}>
      <div className="form-fields">
        <div className="field city-field">
          <label htmlFor="city">{t('location')}</label>
          <input
            ref={inputRef} id="city" name="city" type="text"
            placeholder={t('placeholder')} autoComplete="off" required
            value={city} role="combobox" aria-autocomplete="list"
            aria-expanded={expanded} aria-controls="city-suggestions"
            aria-activedescendant={expanded && activeIndex >= 0 && results[activeIndex] ? `city-option-${results[activeIndex].id}` : undefined}
            aria-describedby="city-help city-status"
            onChange={event => {
              setCity(event.target.value)
              setSelectedLocation(null)
              if (event.target.value.trim() !== query || selectedLocation) {
                setResults([])
                setCorrection(null)
                setStatus('idle')
                setActiveIndex(-1)
              }
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => { setOpen(false); setActiveIndex(-1) }}
            onKeyDown={handleCityKeyDown}
          />
          <p id="city-help" className="city-help">{t('cityHelp')}</p>
          <ul id="city-suggestions" className="city-suggestions" role="listbox" aria-label={t('cities')} hidden={!expanded || !results.length}>
            {results.map((location, index) => (
              <li key={location.id} id={`city-option-${location.id}`}
                role="option" aria-selected={activeIndex === index}
                onPointerDown={event => event.preventDefault()}
                onClick={() => selectLocation(location)}>
                {locationLabel(location)}
              </li>
            ))}
          </ul>
          <p id="city-status" className="city-status" role="status">{expanded ? searchMessage : ''}</p>
        </div>
        <div className="field">
          <label htmlFor="date">{t(mode === 'recurring' ? 'birthday' : 'date')}</label>
          <input id="date" name="date" type="date" min="1940-01-01" max={maxDate} value={date} onChange={event => setDate(event.target.value)} required />
        </div>
      </div>
      <button type="submit" disabled={isLoading}>{t(mode === 'recurring' ? 'recurringDiscover' : 'discover')} <span aria-hidden="true">↗</span></button>
      <p className="form-hint">{t(mode === 'recurring' ? 'recurringHint' : 'formHint')}</p>
      <p className="form-status" role="status">{message ? t(message) : ''}</p>
    </form>
  )
}
