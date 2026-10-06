import { useLanguage } from '../i18n/LanguageContext'

export default function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage()
  return <div className="language-selector" role="group" aria-label={t('language')}>
    <button type="button" lang="en" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
    <button type="button" lang="es" aria-label="Español" aria-pressed={language === 'es'} onClick={() => setLanguage('es')}>ES</button>
  </div>
}
