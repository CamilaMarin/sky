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
  for (const invalid of [null, {}, { ...data, version: 3 }, { ...data, locations: [[1,'X',100,0,'12','America/Santiago']] }, { ...data, locations: [data.locations[0], data.locations[0]] }]) assert.throws(() => parseGazetteer(invalid))
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
  const place = (id, name, latitude = -33) => ({ id, name, latitude, longitude:-70, country_code:'CL', feature_code:'PPL', admin1_id:1 })
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

const providerFixtures = JSON.parse(readFileSync(new URL('./fixtures/locationProviders.json', import.meta.url)))
const { countryDisplayName } = await import(moduleUrl('../src/utils/locationDisplay.ts'))
const { getLocationCategory } = await import(matching)
const catalog = parseGazetteer(data)
const localMatches = query => catalog.filter(location => scoreLocation(normalize(query),location).tier <= 2)

test('real records: exact Chilean communes rank first, including diacritics and both providers', () => {
  for (const [query, fixture] of [
    ['Quinta Normal','Quinta Normal'],['Ñuñoa','Ñuñoa'],['Nunoa','Ñuñoa'],['Pudahuel','Pudahuel'],
    ['Cerro Navia','Cerro Navia'],['Estación Central','Estación Central'],['Estacion Central','Estación Central'],
    ['Providencia','Providencia'],['La Florida','La Florida'],['San Miguel','San Miguel'],['Maipú','Maipú'],['Maipu','Maipú'],
  ]) {
    const candidates = mergeLocations(normalize(query),providerFixtures[fixture],localMatches(query))
    assert.equal(getLocationCategory(candidates[0]),'commune',query)
    assert.equal(normalize(candidates[0].name),normalize(query),query)
    assert.equal(candidates[0].timezone,'America/Santiago')
    for (const language of ['en','es']) for (const location of candidates.filter(x=>x.country_code==='CL')) {
      assert.equal(countryDisplayName(location,language),'Chile',`${query}/${language}`)
    }
  }
})

test('Quinta Normal is one provider/local PPLX plus a distinct commune, with conflicting admin3 preserved', () => {
  const results=mergeLocations('quinta normal',providerFixtures['Quinta Normal'],localMatches('quinta normal'))
  assert.deepEqual(results.map(x=>x.id),[8261416,3873992])
  assert.deepEqual(results.map(getLocationCategory),['commune','locality'])
  assert.notEqual(results[0].admin3_id,results[1].admin3_id)
  assert.equal(results[0].admin1_id,results[1].admin1_id)
  assert.equal(results[1].latitude,-33.44186)
})

test('Ñuñoa retains distinct commune and settlement even with matching administrative parent; Peru survives', () => {
  const results=mergeLocations('nunoa',providerFixtures['Ñuñoa'],localMatches('nunoa'))
  assert.equal(results[0].id,8261178)
  assert.equal(results.filter(x=>x.id===3878431).length,1)
  assert.ok(results.some(x=>x.country_code==='PE'))
  assert.equal(results.find(x=>x.id===3878431).admin3_id,8261178)
})

test('same category proximity requires administrative evidence and never erases distinct homonyms', () => {
  const original={id:1,name:'San Miguel',country_code:'CL',latitude:-33,longitude:-70,feature_code:'PPL',admin1_id:10,admin3_id:20}
  // Same region/name but far away: two genuine localities must survive.
  assert.equal(mergeLocations('san miguel',[original],[{...original,id:2,latitude:-40}]).length,2)
  // Nearby, different administrative parent: also distinct.
  assert.equal(mergeLocations('san miguel',[original],[{...original,id:2,latitude:-33.001,admin3_id:21}]).length,2)
  assert.equal(mergeLocations('san miguel',[original],[{...original,id:2,latitude:-33.001,admin1_id:11}]).length,2)
  assert.equal(mergeLocations('san miguel',[original],[{...original,id:2,latitude:-33.001,feature_code:undefined}]).length,2)
  assert.equal(mergeLocations('san miguel',[original],[{...original,id:2,latitude:-33.001,feature_code:'ADM3'}]).length,2)
  // Equivalent provider records: same category, same area, <1 km.
  assert.equal(mergeLocations('san miguel',[original],[{...original,id:2,latitude:-33.001,admin1:'A translated region'}]).length,1)
  assert.equal(mergeLocations('san miguel',[{...original,admin1_id:undefined,admin1:undefined}],[{...original,id:2,admin1_id:undefined,admin1:undefined}]).length,2)
})

test('text relevance still beats administrative category, ties preserve provider order', () => {
  const place=(id,name,feature_code)=>({id,name,feature_code,country_code:'CL',latitude:-33,longitude:-70})
  const results=mergeLocations('pudahuel',[place(1,'Pudahuel','PPL'),place(2,'Pudahuel Norte','PPL')],[place(3,'Pudahel','ADM3')])
  assert.deepEqual(results.map(x=>x.id),[1,2,3])
  assert.equal(getLocationCategory({...place(4,'Unknown',undefined),source:'open-meteo'}),null)
  assert.equal(getLocationCategory({...place(4,'Region','ADM3'),country_code:'PE'}),null)
})

test('country presentation uses ISO code, safely falls back and leaves original values unchanged', () => {
  const location={country_code:'CL',country:'Republic of Chile'}
  assert.equal(countryDisplayName(location,'en'),'Chile')
  assert.equal(countryDisplayName(location,'es'),'Chile')
  assert.equal(location.country,'Republic of Chile')
  assert.equal(countryDisplayName({country:'Legacy country'},'en'),'Legacy country')
  assert.equal(countryDisplayName({country_code:'invalid',country:'Legacy country'},'es'),'Legacy country')
  assert.equal(countryDisplayName({country_code:'DE'},'es'),'Alemania')
})

test('versioned catalog retains metadata, supports previous data and rejects malformed category fields', () => {
  const sample=catalog.find(x=>x.id===8261416)
  assert.equal(sample.feature_class,'A'); assert.equal(sample.feature_code,'ADM3')
  assert.equal(sample.admin1_id,3873544); assert.equal(sample.admin3_id,8261416)
  assert.equal(parseGazetteer({...data,version:1,locations:[data.locations[0].slice(0,6)]})[0].feature_code,undefined)
  const invalid=[...data.locations[0]]; invalid[6]='INVALID'
  assert.throws(()=>parseGazetteer({...data,locations:[invalid]}))
})
