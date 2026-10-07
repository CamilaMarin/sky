import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
function moduleUrl(path, imports = {}) {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  for (const [name, url] of Object.entries(imports)) outputText = outputText.replaceAll(`'${name}'`, `'${url}'`)
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
}
const { parseWeatherQuery: parse, serializeWeatherQuery: serialize, weatherQueryUrl, validSearchDate } = await import(moduleUrl('../src/utils/shareableUrl.ts'))
const { restoreLocation } = await import(moduleUrl('../src/types/shareableWeatherQuery.ts'))
const now = new Date('2026-10-06T12:00:00Z')
const query = { mode:'single', date:'1994-07-17', location:{ name:'Pudahuel', latitude:-33.42398, longitude:-70.85493, timezone:'America/Santiago', admin1:'Región Metropolitana', country:'Chile' } }
const params = (changes = {}) => {
  const p = serialize(query,now)
  for (const [k,v] of Object.entries(changes)) v === null ? p.delete(k) : p.set(k,v)
  return p
}

test('single and birthday round trip, Unicode, spaces and encoding', () => {
  for (const mode of ['single','birthday']) for (const name of ['Pudahuel','Ñuñoa','Cerro Navia','<script>alert(1)</script>']) {
    const expected = { ...query, mode, location:{ ...query.location, name } }
    assert.deepEqual(parse(serialize(expected,now).toString(),now), {status:'valid',query:expected})
    assert.equal(restoreLocation(expected.location).id,0)
  }
  assert.match(serialize(query,now).toString(), /tz=America%2FSantiago/)
  assert.match(serialize(query,now).toString(), /admin1=Regi%C3%B3n\+Metropolitana/)
  const minimal = { ...query, location:{name:'Ñuñoa',latitude:0,longitude:0,timezone:'UTC'} }
  assert.deepEqual(parse(serialize(minimal,now),now).query,minimal)
})

test('coordinate boundaries and precision', () => {
  for (const lat of [-90,0,90]) for (const lon of [-180,0,180]) assert.equal(parse(params({lat,lon}),now).status,'valid')
  for (const [key, values] of [['lat',['90.00001','-90.00001','Infinity','NaN','',' ','0x20','1,2']], ['lon',['180.00001','-180.00001','Infinity']]]) {
    for (const value of values) assert.equal(parse(params({[key]:value}),now).status,'invalid',`${key}=${value}`)
  }
  const rounded = parse(serialize({...query, location:{...query.location,latitude:-33.123456789,longitude:1e-8}},now),now)
  assert.equal(rounded.query.location.latitude,-33.12346)
  assert.equal(rounded.query.location.longitude,0)
  assert.throws(() => serialize({...query,location:{...query.location,latitude:90.000001}},now))
})

test('calendar validity, archive minimum and future date restrictions', () => {
  for (const date of ['1940-01-01','1994-07-17','2024-02-29','2000-02-29']) for (const mode of ['single','birthday']) {
    assert.equal(parse(params({date,mode}),now).status,'valid',date)
  }
  for (const date of ['2024-02-31','2023-02-29','1900-02-29','1939-12-31','2027-01-01','2024-13-01','2024-00-01','2024-01-00','2024-2-01','not-a-date']) {
    assert.equal(validSearchDate(date,now),false,date)
    assert.equal(parse(params({date}),now).status,'invalid',date)
  }
  assert.equal(parse(params({mode:'birthday',date:'2026-10-06',tz:'Pacific/Honolulu'}),new Date('2026-10-06T05:00:00Z')).status,'invalid')
})

test('required fields, timezone, lengths, control characters and ambiguous duplicates', () => {
  for (const key of ['mode','date','lat','lon','tz','place']) assert.equal(parse(params({[key]:null}),now).status,'invalid',key)
  for (const mode of ['recurring','other','','SINGLE']) assert.equal(parse(params({mode}),now).status,'invalid')
  for (const tz of ['UTC','America/Santiago','Pacific/Easter','America/Punta_Arenas']) assert.equal(parse(params({tz}),now).status,'valid')
  for (const tz of ['auto','','Mars/Santiago','x'.repeat(81)]) assert.equal(parse(params({tz}),now).status,'invalid')
  for (const [key,length] of [['place',160],['admin1',160],['country',100]]) {
    assert.equal(parse(params({[key]:'x'.repeat(length)}),now).status,'valid')
    assert.equal(parse(params({[key]:'x'.repeat(length+1)}),now).status,'invalid')
    assert.equal(parse(params({[key]:'\nattack'}),now).status,'invalid')
  }
  const duplicate = params(); duplicate.append('lat','0')
  assert.equal(parse(duplicate,now).status,'invalid')
  assert.equal(parse('?ref=hello&utm_source=friend',now).status,'absent')
  assert.equal(parse(params({ref:'friend'}),now).status,'valid')
})

test('URL updates preserve base path, fragment, unknown parameters and remove stale owned values', () => {
  const href = 'https://example.org/repository-name/?utm_source=friend&ref=a&ref=b&place=stale&country=old#main-content'
  const minimal = { ...query, location:{name:'Ñuñoa',latitude:1,longitude:2,timezone:'UTC'} }
  const url = weatherQueryUrl(href,minimal,now)
  assert.equal(url.pathname,'/repository-name/')
  assert.equal(url.origin,'https://example.org')
  assert.equal(url.hash,'#main-content')
  assert.deepEqual(url.searchParams.getAll('ref'),['a','b'])
  assert.equal(url.searchParams.get('utm_source'),'friend')
  assert.equal(url.searchParams.has('country'),false)
  assert.deepEqual(parse(url.search,now).query,minimal)
  const cleaned = weatherQueryUrl(url.href,null,now)
  assert.equal(parse(cleaned.search,now).status,'absent')
  assert.equal(cleaned.searchParams.get('utm_source'),'friend')
})

test('restored queries invoke only archive transport for both modes', async t => {
  const weatherUrl = moduleUrl('../src/services/weather.ts')
  const { getHistoricalWeather } = await import(weatherUrl)
  const { getRecurringWeather } = await import(moduleUrl('../src/services/recurringWeather.ts',{'./weather':weatherUrl}))
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  const calls = []
  globalThis.fetch = async href => {
    const url = new URL(href); calls.push(url)
    assert.equal(url.hostname,'archive-api.open-meteo.com')
    assert.equal(url.searchParams.get('timezone'),'America/Santiago')
    const date = url.searchParams.get('start_date')
    return {ok:true,json:async () => ({daily:{time:[date],weather_code:[0],temperature_2m_max:[20],temperature_2m_min:[10],temperature_2m_mean:[15],precipitation_sum:[0],wind_speed_10m_max:[5],sunshine_duration:[3600],sunrise:[date+'T07:00'],sunset:[date+'T18:00']}})}
  }
  for (const mode of ['single','birthday']) {
    const parsed = parse(serialize({...query,mode},now),now).query
    const location = restoreLocation(parsed.location)
    if (mode === 'single') assert.equal((await getHistoricalWeather({...location,date:parsed.date})).date,query.date)
    else {
      const [startYear,month,day] = parsed.date.split('-').map(Number)
      assert.equal((await getRecurringWeather({...location,startYear,month,day},undefined,now)).startYear,1994)
    }
  }
  assert.equal(calls.length,2)
})
