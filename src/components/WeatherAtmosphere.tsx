import type { CSSProperties } from 'react'
import type { WeatherTheme } from '../utils/weatherTheme'

// Deterministic positions avoid random layout changes on React renders.
const particles = [7, 18, 29, 41, 53, 64, 76, 87, 95, 35, 69, 12]

export default function WeatherAtmosphere({ theme }: { theme: WeatherTheme }) {
  if (theme === 'neutral') return null
  const precipitation = theme === 'rain' || theme === 'storm' || theme === 'snow'
  return (
    <div className="weather-atmosphere" data-theme={theme} aria-hidden="true">
      {precipitation && particles.map((left, index) => (
        <span className="atmosphere-particle" key={index} style={{
          '--left': `${left}%`, '--top': `${(index * 19) % 100}%`,
          '--delay': `${-index * 1.7}s`, '--duration': `${theme === 'snow' ? 18 + index : 5 + index % 4}s`,
        } as CSSProperties} />
      ))}
    </div>
  )
}
