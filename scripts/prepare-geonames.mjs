import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'

// Usage: node scripts/prepare-geonames.mjs /path/CL.txt CL public/data/locations/CL.json
const [input, countryCode, output] = process.argv.slice(2)
if (!input || !/^[A-Z]{2}$/.test(countryCode ?? '') || !output) throw new Error('Expected input.txt COUNTRY output.json')
const raw = readFileSync(input)
const rows = raw.toString('utf8').trimEnd().split('\n').map(line => line.replace(/\r$/, '').split('\t'))
if (rows.some(row => row.length !== 19)) throw new Error('Invalid GeoNames TSV')
const populated = new Set(['PPL', 'PPLX', 'PPLL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLC', 'PPLG'])
const regions = Object.fromEntries(rows.filter(r => r[8] === countryCode && r[6] === 'A' && r[7] === 'ADM1').map(r => [r[10], r[1]]))
const regionIds = new Map(rows.filter(r => r[8] === countryCode && r[7] === 'ADM1').map(r => [r[10], Number(r[0])]))
const administrativeKey = r => [r[8], r[10], r[11], r[12]].join('.')
const communeIds = new Map(rows.filter(r => r[8] === countryCode && r[7] === 'ADM3').map(r => [administrativeKey(r), Number(r[0])]))
const selected = rows.filter(r => r[8] === countryCode && (r[6] === 'P' && populated.has(r[7]) || r[6] === 'A' && r[7] === 'ADM3'))
let excludedInvalid = 0
const locations = selected.flatMap(r => {
  const lat = Number(r[4]), lon = Number(r[5])
  if (!r[1] || !r[17] || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) { excludedInvalid++; return [] }
  return [[Number(r[0]), r[1], lat, lon, r[10], r[17], r[6], r[7], regionIds.get(r[10]) ?? null, communeIds.get(administrativeKey(r)) ?? null]]
}).sort((a, b) => a[0] - b[0])
const country = rows.find(r => r[8] === countryCode && r[7] === 'PCLI')?.[1]
const json = JSON.stringify({ version: 2, countryCode, country, regions, locations }) + '\n'
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, json)
const report = {
  source: `https://download.geonames.org/export/dump/${countryCode}.zip`,
  license: 'https://creativecommons.org/licenses/by/4.0/',
  inputSha256: createHash('sha256').update(raw).digest('hex'),
  originalRecords: rows.length, selectedRecords: locations.length, excludedInvalid,
  originalBytes: raw.length, jsonBytes: Buffer.byteLength(json), gzipBytes: gzipSync(json).length,
  featureCodes: [...new Set(selected.map(r => `${r[6]}.${r[7]}`))].sort(),
  timezones: [...new Set(locations.map(r => r[5]))].sort(),
}
writeFileSync(output.replace(/\.json$/, '.metadata.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
