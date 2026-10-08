import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
function moduleUrl(path) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
}
const { pngFile, canShareImage, shareCardImage } = await import(moduleUrl('../src/utils/shareCardImage.ts'))
const { createPreparedShareCard } = await import(moduleUrl('../src/utils/preparedShareCard.ts'))
const { shareCardFilename } = await import(moduleUrl('../src/utils/shareCardFilename.ts'))
const png = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' })
const file = pngFile(png, shareCardFilename('Ñuñoa', 'single', '1994-07-17'))
function deferred() { let resolve, reject; const promise = new Promise((a,b)=>{resolve=a;reject=b}); return {promise,resolve,reject} }

test('PNG Blob becomes a File with unchanged bytes, MIME and existing filename', async () => {
  assert.ok(file instanceof File)
  assert.equal(file.name,'how-was-the-sky-nunoa-1994-07-17.png')
  assert.equal(file.type,'image/png')
  assert.deepEqual(await file.arrayBuffer(), await png.arrayBuffer())
  assert.throws(()=>pngFile(new Blob(['not png']),'wrong.png'))
  assert.throws(()=>pngFile(new Blob([],{type:'image/png'}),'empty.png'))
})
test('share is called synchronously with the ready File and receiver, no URL or text', async () => {
  let called=false
  const api={canShare(payload){assert.equal(this,api);assert.deepEqual(payload,{files:[file]});return true},share(payload){called=true;assert.equal(this,api);assert.deepEqual(payload,{files:[file],title:'How Was the Sky?'});return Promise.resolve()}}
  const result=shareCardImage(file,api)
  assert.equal(called,true, 'share must run before yielding the click stack')
  assert.equal(await result,'shared')
})
test('missing APIs, false or throwing canShare never invoke share', async () => {
  for(const api of [{},{share(){throw Error('must not share')}},{canShare:()=>true},{canShare:()=>false,share(){assert.fail('unsupported')}},{canShare(){throw Error('blocked')},share(){assert.fail('blocked')}}]) {
    assert.equal(canShareImage(file,api),false)
    assert.equal(await shareCardImage(file,api),'unsupported')
  }
})
test('AbortError is cancellation; real failures are retryable, with no download/clipboard fallback', async () => {
  let attempts=0
  const api={canShare:()=>true,clipboard:{writeText(){assert.fail('no clipboard')}},share(){attempts++;return Promise.reject(new DOMException('cancel','AbortError'))}}
  assert.equal(await shareCardImage(file,api),'cancelled')
  api.share=()=>{attempts++;return Promise.reject(new Error('failed'))}
  assert.equal(await shareCardImage(file,api),'error')
  api.share=()=>{attempts++;return Promise.resolve()}
  assert.equal(await shareCardImage(file,api),'shared')
  assert.equal(attempts,3)
  assert.equal(await shareCardImage(file,{canShare:()=>true,share(){throw new DOMException('cancel','AbortError')}}),'cancelled')
  // No DOM exists in this test: a download fallback would fail instead of returning.
  assert.equal(typeof document,'undefined')
})
test('prepare coalesces in-flight requests and reuses the same File for both actions', async () => {
  const cache=createPreparedShareCard(), work=deferred();let calls=0
  const generate=()=>{calls++;return work.promise}
  const one=cache.prepare('en:single:pudahuel:1994',generate)
  const two=cache.prepare('en:single:pudahuel:1994',generate)
  assert.equal(one,two)
  await Promise.resolve();assert.equal(calls,1)
  work.resolve(file);assert.equal(await one,file)
  assert.equal(await cache.prepare('en:single:pudahuel:1994',generate),file)
  assert.equal(calls,1);cache.clear();assert.equal(cache.get('en:single:pudahuel:1994'),null)
})
test('changed content invalidates old work; generation stays serialized across previews', async () => {
  const cache=createPreparedShareCard(),other=createPreparedShareCard(),work=deferred();let active=0,max=0
  const old=cache.prepare('en',async()=>{active++;max=Math.max(max,active);await work.promise;active--;return file})
  await Promise.resolve()
  const next=cache.prepare('es',async()=>{active++;max=Math.max(max,active);active--;return file})
  const another=other.prepare('birthday',async()=>{active++;max=Math.max(max,active);active--;return file})
  assert.equal(cache.get('en'),null)
  work.resolve();assert.equal(await old,null);assert.equal(await next,file);assert.equal(await another,file);assert.equal(max,1)
  cache.clear();other.clear()
})
test('close/unmount discards pending results and cancels queued captures', async () => {
  const cache=createPreparedShareCard(),work=deferred();let calls=0,signal
  const old=cache.prepare('first',value=>{signal=value;return work.promise});await Promise.resolve()
  cache.clear();assert.equal(signal.aborted,true)
  const queued=cache.prepare('second',async()=>{calls++;return file});cache.clear()
  work.resolve(file);assert.equal(await old,null);assert.equal(await queued,null);assert.equal(calls,0);assert.equal(cache.get('first'),null)
})
test('failed preparation can retry and each changed key generates a new file', async () => {
  const cache=createPreparedShareCard();let calls=0
  await assert.rejects(cache.prepare('first',async()=>{throw Error('render failed')}))
  for(const key of ['first','language','mode','location','date','weather','filename']) {
    assert.equal(await cache.prepare(key,async()=>{calls++;return file}),file)
  }
  assert.equal(calls,7);cache.clear()
})
