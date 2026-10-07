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
const { buildSingleDayShareCardData: single, buildBirthdayShareCardData: birthday } = await import(moduleUrl('../src/utils/shareCardData.ts', {
  '../i18n/translations':moduleUrl('../src/i18n/translations.ts'),
  './weatherTheme':moduleUrl('../src/utils/weatherTheme.ts'),
  './weatherCodes':moduleUrl('../src/utils/weatherCodes.ts'),
  './weatherFormatting':moduleUrl('../src/utils/weatherFormatting.ts'),
}))
const location = {name:'Ñuñoa',country:'Chile',admin1:'Región Metropolitana'}
const weather = { date:'1994-07-17',weatherCode:0,temperatureMean:16.5,temperatureMin:4,temperatureMax:20 }
const stats = {totalYears:7,yearsWithData:5,yearsWithoutData:2,classifiedYears:4,mostCommonTheme:'rain',warmest:{year:2020,value:23.4},coldest:{year:2004,value:-1.2},averageHigh:19.2,averageLow:5.6,themeDistribution:[]}
const result = {month:2,day:29,startYear:2000,endYear:2024,latestAvailableYear:2020,entries:[]}

test('single full data localizes EN/ES and keeps location brief and Unicode intact', () => {
  const en=single(weather,location,'en'), es=single(weather,location,'es')
  assert.equal(en.date,'July 17, 1994'); assert.equal(es.date,'17 de julio de 1994')
  assert.equal(en.temperature,'16.5 °C'); assert.equal(es.temperature,'16,5 °C')
  assert.equal(en.condition,'Clear sky'); assert.equal(es.condition,'Cielo despejado')
  assert.equal(en.location,'Ñuñoa, Chile'); assert.equal(es.location,'Ñuñoa, Chile')
  assert.equal(en.theme,'clear'); assert.equal(en.extremes.length,2)
  assert.equal(single(weather,{name:'Región Metropolitana'},'es').location,'Región Metropolitana')
})
test('single nullable values omit blocks without invented zeroes, retaining real zero and main fallback', () => {
  const missing=single({...weather,temperatureMean:null,temperatureMin:null,temperatureMax:null},location,'en')
  assert.equal(missing.temperature,null); assert.deepEqual(missing.extremes,[])
  assert.doesNotMatch(JSON.stringify(missing),/0°|NaN|undefined|Not available|No disponible/)
  assert.equal(single({...weather,temperatureMin:null},location,'en').extremes.length,1)
  assert.equal(single({...weather,temperatureMax:null},location,'en').extremes.length,1)
  assert.equal(single({...weather,temperatureMean:null},location,'en').temperature,'20 °C')
  assert.equal(single({...weather,temperatureMean:null,temperatureMax:null},location,'en').temperature,'4 °C')
  assert.equal(single({...weather,temperatureMean:0},location,'en').temperature,'0 °C')
  for(const [code,theme] of [[0,'clear'],[3,'cloudy'],[61,'rain'],[71,'snow'],[95,'storm'],[45,'fog'],[null,'neutral']]) {
    assert.equal(single({...weather,weatherCode:code},location,'en').theme,theme)
  }
})
test('birthday uses supplied stats, data coverage and requested range, preserving February 29', () => {
  const copy=JSON.stringify(stats)
  const en=birthday(result,stats,location,'en'),es=birthday(result,stats,location,'es')
  assert.equal(en.date,'February 29'); assert.equal(es.date,'29 de febrero')
  assert.equal(en.range,'2000 — 2024') // latest data ends in 2020; do not hide missing years.
  assert.equal(en.yearsWithData,'5'); assert.equal(en.yearsLabel,'years under the sky')
  assert.equal(es.yearsLabel,'años bajo el cielo'); assert.equal(es.location,'Ñuñoa, Chile')
  assert.equal(en.theme,'rain'); assert.equal(es.commonTheme,'Lluvia')
  assert.deepEqual(en.records,[{label:'Warmest',value:'23.4 °C',year:'2020'},{label:'Coldest',value:'-1.2 °C',year:'2004'}])
  assert.equal(es.averages[0].value,'19,2 °C')
  assert.equal(birthday(result,{...stats,yearsWithData:1},location,'en').yearsLabel,'year under the sky')
  assert.equal(birthday(result,{...stats,yearsWithData:1},location,'es').yearsLabel,'año bajo el cielo')
  assert.equal(JSON.stringify(stats),copy)
})
test('birthday absent stats stay absent, neutral theme and real zero coverage remain meaningful', () => {
  const empty=birthday(result,{...stats,yearsWithData:0,warmest:null,coldest:null,averageHigh:null,averageLow:null,mostCommonTheme:null},location,'es')
  assert.deepEqual(empty.records,[]); assert.deepEqual(empty.averages,[])
  assert.equal(empty.commonTheme,null); assert.equal(empty.theme,'neutral'); assert.equal(empty.yearsWithData,'0')
  assert.doesNotMatch(JSON.stringify(empty),/0 °C|NaN|undefined|Not available|No disponible/)
  assert.equal(birthday(result,{...stats,warmest:null},location,'en').records.length,1)
  assert.equal(birthday(result,{...stats,coldest:null},location,'en').records.length,1)
  assert.equal(birthday(result,{...stats,averageHigh:null},location,'en').averages.length,1)
  assert.equal(birthday(result,{...stats,averageLow:null},location,'en').averages.length,1)
  assert.equal(birthday(result,{...stats,averageHigh:0},location,'en').averages[0].value,'0 °C')
})
