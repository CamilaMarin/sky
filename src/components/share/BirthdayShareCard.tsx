import type { BirthdayShareCardData } from '../../types/shareCard'
import WeatherIcon from '../WeatherIcon'
import ShareCard, { CardMetrics } from './ShareCard'

export default function BirthdayShareCard({ data }: { data: BirthdayShareCardData }) {
  return <ShareCard data={data} range={data.range} variant="birthday">
    <div className="sky-card-years">
      <p className="sky-card-count">{data.yearsWithData}</p>
      <p>{data.yearsLabel}</p>
      {data.commonTheme !== null && <div className="sky-card-common"><WeatherIcon theme={data.theme} /><span>{data.commonTheme}</span></div>}
    </div>
    <CardMetrics metrics={data.records} className="sky-card-records" />
    <CardMetrics metrics={data.averages} className="sky-card-averages" />
  </ShareCard>
}
