import type { WeatherTheme } from '../utils/weatherTheme'

export interface ShareCardBaseData {
  brand: string
  date: string
  location: string
  theme: WeatherTheme
  tagline: string
}
export interface CardMetric { label: string; value: string; year?: string }
export interface SingleDayShareCardData extends ShareCardBaseData {
  kind: 'single'
  condition: string
  temperature: string | null
  extremes: CardMetric[]
}
export interface BirthdayShareCardData extends ShareCardBaseData {
  kind: 'birthday'
  range: string
  yearsWithData: string
  yearsLabel: string
  commonTheme: string | null
  records: CardMetric[]
  averages: CardMetric[]
}
export type ShareCardData = SingleDayShareCardData | BirthdayShareCardData
