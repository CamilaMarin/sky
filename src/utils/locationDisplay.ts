import type { Location } from '../types/location'
import type { Language } from '../i18n/translations'

const countryNames = new Map<Language, Intl.DisplayNames>()

/** Presentation only: country_code remains the identity key, independent of locale. */
export function countryDisplayName(location: Location, language: Language): string {
  const code = location.country_code?.toUpperCase()
  if (code && /^[A-Z]{2}$/.test(code)) {
    try {
      let names = countryNames.get(language)
      if (!names) { names = new Intl.DisplayNames([language], { type: 'region' }); countryNames.set(language, names) }
      const label = names.of(code)
      if (label && label !== code) return label
    } catch { /* Older runtimes can still show the supplied country. */ }
    // The first local catalog has a verbose English country name. Keep its UI
    // consistent even when Intl.DisplayNames is unavailable; no country dictionary.
    if (code === 'CL') return 'Chile'
  }
  return location.country ?? code ?? ''
}
