import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const { outputText } = ts.transpileModule(readFileSync(new URL('../src/utils/shareCardFilename.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
const { locationSlug, shareCardFilename } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
test('safe readable slugs normalize accents, whitespace, symbols and Unicode', () => {
  for (const [input, expected] of [['Pudahuel','pudahuel'],['Ñuñoa','nunoa'],['Estación Central','estacion-central'],['  San   José  ','san-jose'],['áéíóú ü','aeiou-u'],['/ : * ? < > |','location'],['東京','東京'],['São Paulo & Montréal','sao-paulo-montreal']]) assert.equal(locationSlug(input),expected)
  assert.ok(locationSlug('a'.repeat(200)).length <= 80)
})
test('single and birthday filenames are deterministic and use no internal IDs', () => {
  assert.equal(shareCardFilename('Ñuñoa','single','1994-07-17'),'how-was-the-sky-nunoa-1994-07-17.png')
  assert.equal(shareCardFilename('Pudahuel','birthday','1994-07-17'),'how-was-the-sky-pudahuel-birthday-1994.png')
})
