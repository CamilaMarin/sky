import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { locales, translate } from './translations'
import type { Language, Translator } from './translations'

const storageKey = 'how-was-the-sky-language'
function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved === 'en' || saved === 'es') return saved
  } catch { /* Storage may be unavailable in private or restricted contexts. */ }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

interface LanguageValue {
  language: Language
  setLanguage: (language: Language) => void
  locale: string
  t: Translator
}
const LanguageContext = createContext<LanguageValue>({
  language: 'en', setLanguage: () => {}, locale: locales.en,
  t: (key, values) => translate('en', key, values),
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(initialLanguage)
  useEffect(() => {
    document.documentElement.lang = language
    document.title = translate(language, 'title')
    document.querySelector('meta[name="description"]')?.setAttribute('content', translate(language, 'intro').replace('\n', ' '))
    try { localStorage.setItem(storageKey, language) } catch { /* Keep in-memory preference. */ }
  }, [language])
  return <LanguageContext.Provider value={{ language, setLanguage, locale: locales[language], t: (key, values) => translate(language, key, values) }}>{children}</LanguageContext.Provider>
}

export function useLanguage() { return useContext(LanguageContext) }
