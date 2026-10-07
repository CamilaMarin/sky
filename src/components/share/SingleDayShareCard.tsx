import type { SingleDayShareCardData } from '../../types/shareCard'
import WeatherIcon from '../WeatherIcon'
import ShareCard, { CardMetrics } from './ShareCard'

export default function SingleDayShareCard({ data }: { data: SingleDayShareCardData }) {
  return <ShareCard data={data} variant="single">
    <div className="sky-card-weather">
      <WeatherIcon theme={data.theme} />
      <p className="sky-card-condition">{data.condition}</p>
      {data.temperature !== null && <p className="sky-card-temperature">{data.temperature}</p>}
    </div>
    <CardMetrics metrics={data.extremes} />
  </ShareCard>
}
