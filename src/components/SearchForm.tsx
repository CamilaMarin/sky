import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { searchLocations } from '../services/geocoding'
import type { Location } from '../types/location'

function locationLabel(location: Location) {
  return [location.name, location.admin1, location.country ?? location.country_code].filter(Boolean).join(', ')
}

interface SearchFormProps {
  onSearch: (location: Location, date: string) => void
  isLoading: boolean
}

export default function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [date, setDate] = useState('')
  const [message, setMessage] = useState('')
  const [city, setCity] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [results, setResults] = useState<Location[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const cache = useRef(new Map<string, Location[]>())
  const query = city.trim()
  const expanded = open && !selectedLocation && query.length >= 2

  useEffect(() => {
    if (!open || selectedLocation || query.length < 2) return
    const controller = new AbortController()
    const cached = cache.current.get(query.toLowerCase())
    if (cached) {
      setResults(cached)
      setStatus('success')
      return
    }
    setStatus('loading')
    const timer = window.setTimeout(async () => {
      try {
        const locations = await searchLocations(query, controller.signal)
        if (controller.signal.aborted) return
        cache.current.set(query.toLowerCase(), locations)
        setResults(locations)
        setStatus('success')
      } catch {
        if (!controller.signal.aborted) setStatus('error')
      }
    }, 300)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, selectedLocation, open])

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

  const searchMessage = status === 'loading' ? 'Searching cities…'
    : status === 'error' ? 'Could not load cities. Check your connection and edit the city to try again.'
    : status === 'success' ? (results.length ? `${results.length} locations found. Use the arrow keys to explore and Enter to select.` : 'No cities found. Try another name.')
    : ''
  const today = new Date()
  // Use local calendar values to avoid shifting the date across time zones.
  const maxDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedLocation || !Number.isFinite(selectedLocation.latitude) || !Number.isFinite(selectedLocation.longitude)) {
      setMessage('Select a city from the suggestions before continuing.')
      inputRef.current?.focus()
      return
    }
    if (!date || date > maxDate || date < '1940-01-01') {
      setMessage('Choose a date between January 1, 1940 and today.')
      return
    }
    if (isLoading) return
    setMessage('')
    onSearch(selectedLocation, date)
  }

  return (
    <form className="search-form" onSubmit={handleSubmit} onChange={() => setMessage('')} aria-label="Find weather for a past date">
      <div className="form-fields">
        <div className="field city-field">
          <label htmlFor="city">City</label>
          <input
            ref={inputRef} id="city" name="city" type="text"
            placeholder="Where did it happen?" autoComplete="off" required
            value={city} role="combobox" aria-autocomplete="list"
            aria-expanded={expanded} aria-controls="city-suggestions"
            aria-activedescendant={expanded && activeIndex >= 0 && results[activeIndex] ? `city-option-${results[activeIndex].id}` : undefined}
            aria-describedby="city-help city-status"
            onChange={event => {
              setCity(event.target.value)
              setSelectedLocation(null)
              if (event.target.value.trim() !== query || selectedLocation) {
                setResults([])
                setStatus('idle')
                setActiveIndex(-1)
              }
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => { setOpen(false); setActiveIndex(-1) }}
            onKeyDown={handleCityKeyDown}
          />
          <p id="city-help" className="city-help">Type at least 2 characters and select a location.</p>
          <ul id="city-suggestions" className="city-suggestions" role="listbox" aria-label="Cities" hidden={!expanded || !results.length}>
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
          <label htmlFor="date">Date</label>
          <input id="date" name="date" type="date" min="1940-01-01" max={maxDate} value={date} onChange={event => setDate(event.target.value)} required />
        </div>
      </div>
      <button type="submit" disabled={isLoading}>Discover that day <span aria-hidden="true">↗</span></button>
      <p className="form-hint">Select a city and a date from 1940 to today. Recent dates may not have data yet.</p>
      <p className="form-status" role="status">{message}</p>
    </form>
  )
}
