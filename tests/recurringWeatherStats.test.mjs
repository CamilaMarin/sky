import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function moduleUrl(path, imports = {}) {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  for (const [name, url] of Object.entries(imports)) outputText = outputText.replace(`'${name}'`, `'${url}'`)
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
}
const { getRecurringWeatherStats: stats } = await import(moduleUrl('../src/utils/recurringWeatherStats.ts', {
  './weatherTheme': moduleUrl('../src/utils/weatherTheme.ts'),
}))
const entry = (year, code, low, high) => ({ year, date: `${year}-07-17`, weather: { weatherCode: code, temperatureMin: low, temperatureMax: high } })
const result = entries => ({ month: 7, day: 17, startYear: 2000, endYear: 2020, latestAvailableYear: 2020, entries })

test('normal dataset: concrete records, averages, counts and percentages', () => {
  const s = stats(result([entry(2000, 0, 4, 20), entry(2001, 1, 6, 24), entry(2002, 61, -2, 16), entry(2003, 3, 0, 12)]))
  assert.equal(s.totalYears, 4)
  assert.equal(s.yearsWithData, 4)
  assert.equal(s.yearsWithoutData, 0)
  assert.deepEqual(s.warmest, { year: 2001, value: 24 })
  assert.deepEqual(s.coldest, { year: 2002, value: -2 })
  assert.equal(s.averageHigh, 18)
  assert.equal(s.averageLow, 2)
  assert.equal(s.mostCommonTheme, 'clear')
  assert.deepEqual(s.themeDistribution.map(x => [x.theme, x.count, x.percentage]), [
    ['clear', 2, 50], ['cloudy', 1, 25], ['rain', 1, 25], ['snow', 0, 0], ['storm', 0, 0], ['fog', 0, 0], ['neutral', 0, 0],
  ])
})
test('partial temperatures use independent denominators and preserve zero', () => {
  const s = stats(result([entry(2000, null, 0, null), entry(2001, 61, null, 20), entry(2002, 0, 6, 10), { year: 2003, weather: null }]))
  assert.equal(s.totalYears, 4)
  assert.equal(s.yearsWithData, 3)
  assert.equal(s.yearsWithoutData, 1)
  assert.equal(s.averageHigh, 15)
  assert.equal(s.averageLow, 3)
  assert.deepEqual(s.coldest, { year: 2000, value: 0 })
  assert.equal(s.classifiedYears, 2)
  assert.equal(s.themeDistribution[0].percentage, 50)
})
test('theme ties use declared priority; record ties use earliest year, regardless of order', () => {
  const entries = [entry(2010, 61, 2, 20), entry(2000, 0, 2, 20)]
  const first = stats(result(entries))
  assert.equal(first.mostCommonTheme, 'clear')
  assert.deepEqual(first.warmest, { year: 2000, value: 20 })
  assert.deepEqual(first.coldest, { year: 2000, value: 2 })
  assert.deepEqual(first, stats(result([...entries].reverse())))
})
test('all values absent return null rather than fabricated zeroes', () => {
  const s = stats(result([{ year: 2000, weather: null }, entry(2001, null, null, null)]))
  assert.equal(s.yearsWithoutData, 2)
  assert.equal(s.yearsWithData, 0)
  for (const key of ['averageHigh', 'averageLow', 'warmest', 'coldest', 'mostCommonTheme']) assert.equal(s[key], null)
  assert(s.themeDistribution.every(x => x.count === 0 && x.percentage === null))
})
test('single year is both records, with 100 percent of classified years', () => {
  const s = stats(result([entry(2000, 95, -1.2, 23.4)]))
  assert.equal(s.averageLow, -1.2)
  assert.equal(s.averageHigh, 23.4)
  assert.equal(s.mostCommonTheme, 'storm')
  assert.deepEqual(s.warmest, { year: 2000, value: 23.4 })
  assert.deepEqual(s.coldest, { year: 2000, value: -1.2 })
  assert.equal(s.themeDistribution.find(x => x.theme === 'storm').percentage, 100)
})
test('unknown codes excluded from denominator; recognized code without temperatures still counts', () => {
  const s = stats(result([entry(2000, 999, 1, 2), entry(2001, 0, null, null), entry(2002, 61, null, null), entry(2003, 63, null, null)]))
  assert.equal(s.yearsWithData, 4)
  assert.equal(s.classifiedYears, 3)
  assert(Math.abs(s.themeDistribution[0].percentage - 33.333333333333336) < 1e-10)
  assert.equal(s.themeDistribution.find(x => x.theme === 'rain').percentage, 2 / 3 * 100)
  assert.equal(s.themeDistribution.find(x => x.theme === 'neutral').count, 0)
})
test('no temperatures and no codes are independent cases; empty input is valid', () => {
  const codesOnly = stats(result([entry(2000, 45, null, null)]))
  assert.equal(codesOnly.averageHigh, null)
  assert.equal(codesOnly.warmest, null)
  assert.equal(codesOnly.mostCommonTheme, 'fog')
  const tempsOnly = stats(result([entry(2000, null, 0, 10)]))
  assert.equal(tempsOnly.mostCommonTheme, null)
  assert.equal(tempsOnly.averageLow, 0)
  assert.equal(tempsOnly.classifiedYears, 0)
  assert.equal(stats(result([])).totalYears, 0)
})
test('nonfinite values are ignored and input is not mutated', () => {
  const r = result([entry(2000, NaN, Infinity, NaN), entry(2001, 0, 1, 10)])
  const before = structuredClone(r)
  const s = stats(r)
  assert.equal(s.yearsWithData, 1)
  assert.equal(s.averageHigh, 10)
  assert.deepEqual(r, before)
})
