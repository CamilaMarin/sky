import type { TranslationKey } from '../i18n/translations'

const descriptions: Record<number, TranslationKey> = {
  0: 'weather0',
  1: 'weather1',
  2: 'weather2',
  3: 'weather3',
  45: 'weather45',
  48: 'weather48',
  51: 'weather51',
  53: 'weather53',
  55: 'weather55',
  56: 'weather56',
  57: 'weather57',
  61: 'weather61',
  63: 'weather63',
  65: 'weather65',
  66: 'weather66',
  67: 'weather67',
  71: 'weather71',
  73: 'weather73',
  75: 'weather75',
  77: 'weather77',
  80: 'weather80',
  81: 'weather81',
  82: 'weather82',
  85: 'weather85',
  86: 'weather86',
  95: 'weather95',
  96: 'weather96',
  97: 'weather97',
  99: 'weather99',
}

export function getWeatherDescriptionKey(code: number | null): TranslationKey {
  return code === null ? 'notAvailable' : descriptions[code] ?? 'unknown'
}
