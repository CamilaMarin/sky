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
const { buildSingleDayShareContent: single, buildBirthdayShareContent: birthday } = await import(moduleUrl('../src/utils/shareContent.ts', {
  '../i18n/translations': moduleUrl('../src/i18n/translations.ts'),
  './weatherCodes': moduleUrl('../src/utils/weatherCodes.ts'),
  './weatherFormatting': moduleUrl('../src/utils/weatherFormatting.ts'),
  './shareableUrl': moduleUrl('../src/utils/shareableUrl.ts'),
}))
const { shareResult } = await import(moduleUrl('../src/utils/shareResult.ts'))
const query = { mode:'single', date:'1994-07-17', location:{ name:'Ñuñoa', latitude:-33.44735, longitude:-70.58279, timezone:'America/Santiago', admin1:'Región Metropolitana', country:'Chile' } }
const weather = { date:query.date, weatherCode:0, temperatureMean:16.5, temperatureMax:20, temperatureMin:10 }
const href = 'https://example.org/repo/?mode=birthday&date=2000-02-29&place=Stale&ref=friend#main-content'

test('single content EN/ES reuses localized date, condition and main temperature', () => {
  assert.equal(single(query,weather,'en',href).text,'How was the sky in Ñuñoa on July 17, 1994?\nClear sky · 16.5 °C')
  assert.equal(single(query,weather,'es',href).text,'¿Cómo estaba el cielo en Ñuñoa el 17 de julio de 1994?\nCielo despejado · 16,5 °C')
  for (const lang of ['en','es']) {
    assert.ok(single({...query,location:{...query.location,name:'Pudahuel'}},weather,lang,href).text.includes('Pudahuel'))
    for (const [values, expected] of [[{temperatureMean:null},'20 °C'],[{temperatureMean:null,temperatureMax:null},'10 °C'],[{temperatureMean:0},'0 °C']]) {
      assert.ok(single(query,{...weather,...values},lang,href).text.includes(expected))
    }
    const missing = single(query,{...weather,temperatureMean:null,temperatureMax:null,temperatureMin:null},lang,href)
    assert.doesNotMatch(missing.text,/Not available|No disponible|°C| · /)
  }
})

test('birthday content stays short and includes start year and Unicode in both languages', () => {
  assert.equal(birthday({...query,mode:'birthday'},'en',href).text,'I looked back at my birthdays in Ñuñoa since 1994.\nSee how the sky changed through the years.')
  assert.equal(birthday({...query,mode:'birthday'},'es',href).text,'Recorrí mis cumpleaños en Ñuñoa desde 1994.\nMira cómo estuvo el cielo a través de los años.')
  assert.ok(birthday({...query,mode:'birthday',date:'2000-02-29'},'es',href).text.includes('2000'))
})

test('canonical URL uses result query instead of stale address bar and preserves path, encoding and extras', () => {
  const payload = single(query,weather,'es',href)
  const url = new URL(payload.url)
  assert.equal(url.pathname,'/repo/')
  assert.equal(url.searchParams.get('mode'),'single')
  assert.equal(url.searchParams.get('place'),'Ñuñoa')
  assert.equal(url.searchParams.get('admin1'),'Región Metropolitana')
  assert.equal(url.searchParams.get('date'),query.date)
  assert.equal(url.searchParams.get('ref'),'friend')
  assert.equal(url.hash,'#main-content')
  assert.deepEqual(Object.keys(payload).sort(),['text','title','url'])
  assert.throws(() => single({...query,date:'2024-02-31'},weather,'en',href))
  assert.throws(() => single(query,{...weather,date:'2000-01-01'},'en',href))
  assert.throws(() => birthday(query,'en',href))
  assert.throws(() => single({...query,location:{...query.location,timezone:''}},weather,'en',href))
})

test('native sharing, cancellation, real failure, clipboard fallback and missing APIs', async () => {
  const payload = single(query,weather,'en',href)
  let shares=0, copies=0, copied=''
  const clipboard = { async writeText(text) { assert.equal(this,clipboard); copies++; copied=text } }
  const native = { clipboard, async share(value) { assert.equal(this,native); assert.deepEqual(value,payload); shares++ } }
  assert.equal(await shareResult(payload,native),'shared')
  assert.equal(shares,1); assert.equal(copies,0)
  assert.equal(await shareResult(payload,{clipboard, share:async () => { throw new DOMException('cancelled','AbortError') }}),'cancelled')
  assert.equal(copies,0)
  assert.equal(await shareResult(payload,{clipboard, share:async () => { throw new Error('blocked') }}),'copied')
  assert.equal(copies,1)
  assert.equal(copied,`${payload.text}\n\n${payload.url}`)
  assert.equal(await shareResult(payload,{clipboard}),'copied')
  assert.equal(await shareResult(payload,{}),'error')
  assert.equal(await shareResult(payload,{clipboard:{writeText:async () => { throw new Error('denied') }}}),'error')
  assert.equal(await shareResult(payload,{share:async () => {throw new Error('denied')},clipboard:{writeText:async () => {throw new Error('denied')}}}),'error')
  assert.equal(await shareResult(payload,{share:async () => {throw {name:'AbortError'}}}),'cancelled')
})
