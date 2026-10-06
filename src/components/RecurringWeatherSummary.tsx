import { useLanguage } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import type { RecurringWeatherStats } from '../types/recurringWeatherStats'
import type { WeatherTheme } from '../utils/weatherTheme'
import { formatMeasurement } from '../utils/weatherFormatting'

const themeLabels: Record<WeatherTheme, TranslationKey> = {
  clear: 'themeClear', cloudy: 'themeCloudy', rain: 'themeRain', snow: 'themeSnow',
  storm: 'themeStorm', fog: 'themeFog', neutral: 'themeNeutral',
}

export default function RecurringWeatherSummary({ stats }: { stats: RecurringWeatherStats }) {
  const { t, locale } = useLanguage()
  const temperature = (value: number | null) => formatMeasurement(value, '°C', locale, t('noData'))
  const number = new Intl.NumberFormat(locale)
  const percentage = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 })
  return <section className="recurring-summary" aria-labelledby="summary-heading">
    <h3 id="summary-heading">{t('statsTitle')}</h3>
    <p>{t('explored', { count: number.format(stats.totalYears) })}</p>
    <p className="city-help">{t('statsCoverage', { with: number.format(stats.yearsWithData), without: number.format(stats.yearsWithoutData) })}</p>
    <dl className="stats-grid">
      <div><dt>{t('warmest')}</dt><dd>{temperature(stats.warmest?.value ?? null)}{stats.warmest && <small>{stats.warmest.year}</small>}</dd></div>
      <div><dt>{t('coldest')}</dt><dd>{temperature(stats.coldest?.value ?? null)}{stats.coldest && <small>{stats.coldest.year}</small>}</dd></div>
      <div><dt>{t('commonWeather')}</dt><dd>{stats.mostCommonTheme ? t(themeLabels[stats.mostCommonTheme]) : t('noData')}</dd></div>
      <div><dt>{t('averageHigh')}</dt><dd>{temperature(stats.averageHigh)}</dd></div>
      <div><dt>{t('averageLow')}</dt><dd>{temperature(stats.averageLow)}</dd></div>
    </dl>
    <h4>{t('distributionTitle')}</h4>
    <p className="city-help">{t('distributionBasis', { count: number.format(stats.classifiedYears) })}</p>
    <ul className="theme-distribution">
      {stats.themeDistribution.map(item => <li key={item.theme} data-theme={item.theme}>
        <span>{t(themeLabels[item.theme])}</span>
        <span>{item.percentage === null ? t('noData') : percentage.format(item.percentage / 100)}</span>
        <span className="distribution-track" aria-hidden="true"><span style={{ width: `${item.percentage ?? 0}%` }} /></span>
      </li>)}
    </ul>
  </section>
}
