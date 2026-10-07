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
const normalizationUrl = moduleUrl('../src/utils/searchNormalization.ts')
const matchingUrl = moduleUrl('../src/utils/searchMatching.ts', { './searchNormalization': normalizationUrl })
const { normalizeSearchText: normalize } = await import(normalizationUrl)
const { editDistance, isCloseSearchMatch: close, rankLocations } = await import(matchingUrl)
const { searchLocations } = await import(moduleUrl('../src/services/geocoding.ts', {
  '../utils/searchNormalization': normalizationUrl, '../utils/searchMatching': matchingUrl,
}))
const city = (id, name) => ({ id, name, latitude: 1, longitude: 2 })
const response = results => ({ ok: true, json: async () => ({ results }) })

test('normalization: diacritics, case, whitespace, decomposed Unicode and empty strings', () => {
  for (const [input, expected] of [
    ['  Concepción ', 'concepcion'], ['concepcion', 'concepcion'], ['VALPARAÍSO', 'valparaiso'],
    ['valparaiso', 'valparaiso'], ['São   Paulo', 'sao paulo'], ['sao paulo', 'sao paulo'],
    ['CONCEPCIÓN', 'concepcion'], ['Concepcio\u0301n', 'concepcion'], ['\t Ñuñoa \n', 'nunoa'], ['', ''], ['   ', ''],
  ]) assert.equal(normalize(input), expected)
})
test('conservative edit distance matches intended typos without short-query overreach', () => {
  assert.equal(editDistance('santiagoo', 'santiago'), 1)
  assert.equal(editDistance('santigo', 'santiago'), 1)
  for (const [a, b] of [['Santiago', 'santiagoo'], ['Santiago', 'santigo'], ['Concepción', 'concepcion'], ['Valparaíso', 'valparaiso']]) {
    assert.equal(close(normalize(a), normalize(b)), true)
  }
  for (const [a, b] of [['sa', 'santiago'], ['san', 'sao'], ['', ''], ['lima', 'roma'], ['santigo', 'valparaiso'], ['xantiago', 'santiago'], ['sant', 'santiago']]) {
    assert.equal(close(a, b), false, `${a} / ${b}`)
  }
})
test('ranking exact, prefix, fuzzy, other; stable ties and deduplication', () => {
  const candidates = [city(1, 'Roma'), city(2, 'Santigoso'), city(3, 'Santiago'), city(4, 'Santigo'), city(5, 'Santiago'), city(3, 'Santiago')]
  assert.deepEqual(rankLocations('santigo', candidates).map(x => x.id), [4, 2, 3, 5, 1])
})
test('geocoding fallback request budget and cancellation', async t => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  await t.test('normal matches take one request and use the selected language', async () => {
    let calls = 0
    globalThis.fetch = async url => { calls++; const p = new URL(url).searchParams; assert.equal(p.get('language'), 'es'); assert.equal(p.get('count'), '5'); return response([city(1, 'Concepción')]) }
    assert.deepEqual(await searchLocations('concepcion', undefined, 'es'), { locations: [city(1, 'Concepción')], correction: null })
    assert.equal(calls, 1)
  })
  await t.test('empty typo gets at most one broad request and filters unrelated candidates', async () => {
    const queries = []
    globalThis.fetch = async url => { const p = new URL(url).searchParams; queries.push(p.get('name')); return response(queries.length === 1 ? [] : [city(1, 'Santiago'), city(2, 'Santander')]) }
    const result = await searchLocations('santiagoo')
    assert.deepEqual(queries, ['santiagoo', 'sant'])
    assert.equal(result.correction, 'Santiago')
    assert.deepEqual(result.locations.map(x => x.id), [1])
  })
  await t.test('sparse prefix results retained; localized Santiago is a correction candidate', async () => {
    let calls = 0
    globalThis.fetch = async () => response(++calls === 1 ? [city(1, 'Santigoso')] : [city(2, 'Santiago de Chile')])
    const result = await searchLocations('santigo', undefined, 'es')
    assert.equal(calls, 2)
    assert.deepEqual(result.locations.map(x => x.id), [1, 2])
    assert.equal(result.correction, 'Santiago de Chile')
  })
  await t.test('short query, full provider page and qualified query do not broaden', async () => {
    for (const query of ['san', 'santiago', 'santigo, Chile']) {
      let calls = 0
      globalThis.fetch = async () => { calls++; return response(query === 'santiago' ? [1, 2, 3, 4, 5].map(i => city(i, 'Santiago de Cuba')) : []) }
      await searchLocations(query)
      assert.equal(calls, 1)
    }
    globalThis.fetch = async () => assert.fail('no request for one character')
    assert.deepEqual(await searchLocations('s'), { locations: [], correction: null })
  })
  await t.test('abort stops fallback and errors cannot masquerade as empty results', async () => {
    const controller = new AbortController()
    let calls = 0
    globalThis.fetch = async () => { calls++; controller.abort(); return response([]) }
    await assert.rejects(searchLocations('santiagoo', controller.signal), e => e.name === 'AbortError')
    assert.equal(calls, 1)
    globalThis.fetch = async () => ({ ok: false })
    await assert.rejects(searchLocations('santiagoo'))
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ results: {} }) })
    await assert.rejects(searchLocations('santiagoo'))
  })
})
