import { useId } from 'react'
import type { ReactNode } from 'react'
import type { CardMetric, ShareCardBaseData } from '../../types/shareCard'
import './shareCard.css'

export function CardMetrics({ metrics, className = '' }: { metrics: CardMetric[]; className?: string }) {
  if (!metrics.length) return null
  return <dl className={`sky-card-metrics ${className}`}>
    {metrics.map(metric => <div key={metric.label}>
      <dt>{metric.label}</dt><dd>{metric.value}{metric.year && <small>{metric.year}</small>}</dd>
    </div>)}
  </dl>
}

export default function ShareCard({ data, range, variant, children }: {
  data: ShareCardBaseData; range?: string; variant: 'single' | 'birthday'; children: ReactNode
}) {
  const titleId = useId()
  return <div className="sky-card-frame">
    <article className={`sky-card sky-card--${variant}`} data-theme={data.theme} aria-labelledby={titleId}>
      <p className="sky-card-brand" lang="en">{data.brand}</p>
      <header className="sky-card-heading">
        <h3 id={titleId}>{data.date}</h3>
        <p className="sky-card-location">{data.location}</p>
        {range && <p className="sky-card-range">{range}</p>}
      </header>
      {children}
      <footer className="sky-card-tagline">{data.tagline}</footer>
    </article>
  </div>
}
