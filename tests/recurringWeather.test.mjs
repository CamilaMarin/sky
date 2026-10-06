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
const weatherUrl = moduleUrl('../src/services/weather.ts')
const { getRecurringWeather } = await import(moduleUrl('../src/services/recurringWeather.ts', { './weather': weatherUrl }))
const { getHistoricalWeather } = await import(weatherUrl)
const request = { latitude: -33.45, longitude: -70.66, timezone: 'America/Santiago', month: 7, day: 17, startYear: 1994 }
const now = new Date('2026-10-06T15:00:00Z')
const originalFetch = globalThis.fetch

function daily(time) {
  return { time, weather_code: time.map(() => 0), temperature_2m_min: time.map(() => 4), temperature_2m_max: time.map(() => 16) }
}

test('recurring date service', async t => {
  t.after(() => { globalThis.fetch = originalFetch })
  await t.test('one request, filters intermediate dates, preserves missing years', async () => {
    let calls = 0
    globalThis.fetch = async url => {
      calls++
      const p = new URL(url).searchParams
      assert.equal(p.get('start_date'), '1994-07-17')
      assert.equal(p.get('end_date'), '2026-07-17')
      assert.equal(p.get('timezone'), request.timezone)
      assert.equal(p.get('daily').split(',').length, 3)
      return { ok: true, json: async () => ({ daily: daily(['1994-07-17', '1994-07-18', '2025-07-17']) }) }
    }
    const result = await getRecurringWeather(request, undefined, now)
    assert.equal(calls, 1)
    assert.equal(result.entries.length, 33)
    assert.equal(result.entries[0].weather.temperatureMin, 4)
    assert.equal(result.entries[1].weather, null)
    assert.equal(result.latestAvailableYear, 2025)
  })
  await t.test('February 29 only exists in leap years', async () => {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ daily: daily([]) }) })
    const result = await getRecurringWeather({ ...request, month: 2, day: 29, startYear: 2000 }, undefined, now)
    assert.deepEqual(result.entries.map(e => e.year), [2000, 2004, 2008, 2012, 2016, 2020, 2024])
    assert.equal(result.latestAvailableYear, null)
    assert(result.entries.every(e => e.date.endsWith('-02-29')))
  })
  await t.test('86 years use one request, partial arrays and nulls do not fail other years', async () => {
    let calls = 0
    globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ daily: {
      time: ['1940-07-17', '1941-07-17', '1942-07-17'], weather_code: [null], temperature_2m_min: [0, null], temperature_2m_max: [null, null, 10],
    } }) } }
    const result = await getRecurringWeather({ ...request, startYear: 1940 }, undefined, now)
    assert.equal(calls, 1)
    assert.equal(result.entries.length, 87)
    assert.equal(result.entries[0].weather.temperatureMin, 0)
    assert.equal(result.entries[1].weather, null)
    assert.equal(result.entries[2].weather.temperatureMax, 10)
  })
  await t.test('future and invalid dates are rejected without fetching', async () => {
    globalThis.fetch = async () => { assert.fail('must not fetch') }
    for (const changes of [{ startYear: 1939 }, { startYear: 2027 }, { month: 2, day: 30 }, { month: 2, day: 29, startYear: 2001 }, { startYear: 2026, month: 12, day: 1 }]) {
      await assert.rejects(getRecurringWeather({ ...request, ...changes }, undefined, now), e => e.kind === 'invalid')
    }
    await assert.rejects(getRecurringWeather({ ...request, startYear: 2026, month: 10, day: 6 }, undefined, now), e => e.kind === 'unavailable')
  })
  await t.test('recent completed date is allowed; today in target timezone is excluded', async () => {
    let end
    globalThis.fetch = async url => { end = new URL(url).searchParams.get('end_date'); return { ok: true, json: async () => ({ daily: daily([]) }) } }
    await getRecurringWeather({ ...request, startYear: 2026, month: 10, day: 5 }, undefined, now)
    assert.equal(end, '2026-10-05')
    await getRecurringWeather({ ...request, month: 10, day: 6 }, undefined, now)
    assert.equal(end, '2025-10-06')
  })
  await t.test('a rejected recent endpoint does not discard older years', async () => {
    let calls = 0
    globalThis.fetch = async url => {
      calls++
      if (calls === 1) return { ok: false }
      assert.equal(new URL(url).searchParams.get('end_date'), '2025-10-05')
      return { ok: true, json: async () => ({ daily: daily(['2025-10-05']) }) }
    }
    const result = await getRecurringWeather({ ...request, month: 10, day: 5 }, undefined, now)
    assert.equal(calls, 2)
    assert.equal(result.latestAvailableYear, 2025)
    assert.equal(result.entries.at(-1).weather, null)
  })
  await t.test('network, malformed response and cancellation', async () => {
    globalThis.fetch = async () => { throw new TypeError('offline') }
    await assert.rejects(getRecurringWeather(request, undefined, now), e => e.kind === 'network')
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ daily: { time: 'invalid' } }) })
    await assert.rejects(getRecurringWeather(request, undefined, now), e => e.kind === 'invalid')
    const controller = new AbortController()
    controller.abort()
    globalThis.fetch = async (_url, { signal }) => { signal.throwIfAborted() }
    await assert.rejects(getRecurringWeather(request, controller.signal, now), e => e.name === 'AbortError')
  })
  await t.test('single-day transport still maps full weather', async () => {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ daily: {
      ...daily(['1994-07-17']), temperature_2m_mean: [10], precipitation_sum: [0], wind_speed_10m_max: [12], sunshine_duration: [28620], sunrise: ['1994-07-17T07:42'], sunset: ['1994-07-17T17:56'],
    } }) })
    const weather = await getHistoricalWeather({ ...request, date: '1994-07-17' })
    assert.equal(weather.temperatureMean, 10)
    assert.equal(weather.sunshineDuration, 28620)
  })
})
