import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function moduleUrl(path, imports = {}) {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  for (const [name, url] of Object.entries(imports)) outputText = outputText.replaceAll(`'${name}'`, `'${url}'`)
  outputText = outputText.replaceAll('import.meta.env.BASE_URL', "'/repo/'")
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
}
const normalization = moduleUrl('../src/utils/searchNormalization.ts')
const matching = moduleUrl('../src/utils/searchMatching.ts', { './searchNormalization': normalization })
const common = { '../utils/searchNormalization': normalization, '../utils/searchMatching': matching }
const gazetteer = moduleUrl('../src/services/gazetteer.ts', common)
const geocoding = moduleUrl('../src/services/geocoding.ts', common)
const { parseGazetteer, loadGazetteer, searchGazetteer } = await import(gazetteer)
const { mergeLocations, searchLocationCandidates } = await import(moduleUrl('../src/services/locationSearch.ts', { ...common, './gazetteer': gazetteer, './geocoding': geocoding }))
const data = JSON.parse(readFileSync(new URL('../public/data/locations/CL.json', import.meta.url)))
const { normalizeSearchText: normalize } = await import(normalization)
const { scoreLocation } = await import(matching)

test('catalog parsing validates schema, coordinates, IDs and timezone', () => {
  assert.equal(parseGazetteer(data).length, 7275)
  for (const invalid of [null, {}, { ...data, version: 2 }, { ...data, locations: [[1,'X',100,0,'12','America/Santiago']] }, { ...data, locations: [data.locations[0], data.locations[0]] }]) assert.throws(() => parseGazetteer(invalid))
  assert.ok(parseGazetteer(data).some(x => x.timezone === 'Pacific/Easter'))
  assert.ok(parseGazetteer(data).some(x => x.timezone === 'America/Coyhaique'))
})

test('lazy shared load, real catalog search, integration and cancellation', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  let localRequests = 0
  globalThis.fetch = async url => {
    if (String(url).startsWith('/repo/')) { localRequests++; return { ok: true, json: async () => data } }
    return { ok: true, json: async () => ({ results: [] }) }
  }
  const [a,b] = await Promise.all([loadGazetteer(),loadGazetteer()])
  assert.equal(a,b)
  for (const query of ['Pudahuel','Cerro Navia','Ñuñoa','Nunoa','Estación Central','Estacion Central','Providencia','La Florida','San Miguel','Maipú','Maipu']) {
    const result = await searchGazetteer(query)
    assert.ok(result.some(x => normalize(x.name) === normalize(query)), query)
    assert.equal(scoreLocation(normalize(query), result[0]).tier, 0)
    for (const language of ['en','es']) assert.ok((await searchLocationCandidates(query, undefined, language)).locations.some(x => normalize(x.name) === normalize(query)), `${query}/${language}`)
  }
  for (const [query, expected] of [['Pudahel','Pudahuel'],['Cerro Nabia','Cerro Navia'],['Estacion Centarl','Estacion Central']]) {
    const results = await searchGazetteer(query)
    assert.equal(results[0].name, expected)
    assert.equal(scoreLocation(normalize(query),results[0]).tier, 2)
  }
  assert.equal((await searchGazetteer('pudah'))[0].name,'Pudahuel')
  assert.deepEqual(await searchGazetteer('p'),[])
  assert.equal(localRequests,1)
  const controller = new AbortController(); controller.abort()
  await assert.rejects(searchLocationCandidates('Pudahuel',controller.signal), { name:'AbortError' })
  globalThis.fetch = async () => { throw new Error('offline') }
  assert.equal((await searchLocationCandidates('Pudahuel')).locations[0].name, 'Pudahuel')
})

test('merge ranks before dedupe and preserves distant namesakes and provider ties', () => {
  const place = (id, name, latitude = -33) => ({ id, name, latitude, longitude:-70, country_code:'CL' })
  const provider = [place(1,'Other'), place(2,'Pudahuel Norte'),place(3,'Pudahuel'),place(4,'Pudahuel',-40)]
  const local = [{...place(3,'Pudahuel'), timezone:'America/Santiago'}, place(5,'Pudahuel',-33.001),place(6,'Pudahuel',-45)]
  const merged = mergeLocations('pudahuel',provider,local)
  assert.deepEqual(merged.map(x => x.id),[3,4,6,2,1])
  assert.equal(merged[0].timezone,'America/Santiago')
  assert.equal(provider[2].timezone,undefined)
  assert.equal(mergeLocations('pudahuel',[place(1,'Localized')],[place(1,'Pudahuel')])[0].name,'Pudahuel')
})

test('failed catalog degrades to provider and is not retried per keystroke', async t => {
  // Fresh module instance with its own lazy cache.
  const freshGazetteer = gazetteer + '#failure'
  const freshService = moduleUrl('../src/services/locationSearch.ts', { ...common, './gazetteer':freshGazetteer, './geocoding':geocoding })
  const { searchLocationCandidates: search } = await import(freshService)
  const original = globalThis.fetch, warn = console.warn
  t.after(() => { globalThis.fetch = original; console.warn = warn })
  let requests = 0, warnings = 0
  console.warn = () => { warnings++ }
  globalThis.fetch = async url => {
    if (String(url).startsWith('/repo/')) { requests++; return { ok:false } }
    return { ok:true, json:async () => ({ results:[{id:1,name:'Pudahuel',latitude:-33,longitude:-70}] }) }
  }
  for (let i=0;i<2;i++) assert.equal((await search('Pudahuel')).locations[0].id,1)
  assert.equal(requests,1); assert.equal(warnings,1)
})
