import { useEffect, useId, useRef, useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext'
import type { ShareCardData } from '../../types/shareCard'
import { createShareCardPng, downloadShareCardPng } from '../../utils/exportShareCard'
import { canShareImage, hasFileShareApi, pngFile, shareCardImage } from '../../utils/shareCardImage'
import { createPreparedShareCard } from '../../utils/preparedShareCard'
import SingleDayShareCard from './SingleDayShareCard'
import BirthdayShareCard from './BirthdayShareCard'

export default function ShareCardPreview({ data, filename, resultKey }: { data: ShareCardData; filename: string; resultKey: string }) {
  const { t, language } = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const [cache] = useState(createPreparedShareCard)
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'preparing' | 'ready' | 'prepareError' | 'sharing' | 'shareError' | 'saved' | 'saveError'>('preparing')
  const sharing = useRef(false)
  const [isSharing, setIsSharing] = useState(false)
  // Include the source result too: equal display names may represent different locations.
  const key = JSON.stringify([resultKey, data, filename, language])
  useEffect(() => {
    if (!open) return
    let active = true
    setStatus('preparing')
    const frame = card.current?.querySelector<HTMLElement>('.sky-card-frame')
    if (frame) void cache.prepare(key, async signal => pngFile(await createShareCardPng(frame, signal), filename)).then(
      file => { if (active && file) setStatus('ready') },
      () => { if (active) setStatus('prepareError') },
    )
    return () => { active = false; cache.clear() }
  }, [open, key, filename, cache, attempt])
  const file = open ? cache.get(key) : null
  const showShare = hasFileShareApi() && (!file || canShareImage(file))
  function close() {
    cache.clear()
    setOpen(false)
    trigger.current?.focus()
  }
  function save() {
    if (!file || sharing.current) return
    try { downloadShareCardPng(file, filename); setStatus('saved') }
    catch { setStatus('saveError') }
  }
  function share() {
    if (!file || sharing.current) return
    sharing.current = true
    setIsSharing(true)
    setStatus('sharing')
    // Invoke immediately, in the same click stack, preserving transient activation.
    void shareCardImage(file).then(result => {
      if (dialog.current?.open && cache.get(key) === file) {
        setStatus(result === 'error' || result === 'unsupported' ? 'shareError' : 'ready')
      }
    }).finally(() => {
      sharing.current = false
      if (dialog.current) setIsSharing(false)
    })
  }
  const feedback = status === 'prepareError' || status === 'saveError' ? 'cardError'
    : !file ? 'cardPreparing' : status === 'shareError' ? 'cardShareError'
      : status === 'saved' ? 'cardSaved' : status === 'sharing' ? 'cardSharing' : 'cardReady'
  const titleId = useId(), descriptionId = useId()
  return <>
    <button ref={trigger} type="button" className="preview-card-button" onClick={() => { dialog.current?.showModal(); setOpen(true) }}>{t('cardPreview')}</button>
    <dialog ref={dialog} className="share-card-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
      onClose={close}>
      <header className="share-card-dialog-heading">
        <h2 id={titleId}>{t('cardTitle')}</h2>
        <button type="button" autoFocus onClick={() => dialog.current?.close()}>{t('cardClose')}</button>
      </header>
      <p id={descriptionId} className="share-card-dialog-description">{t('cardDescription')}</p>
      <div ref={card}>{data.kind === 'single' ? <SingleDayShareCard data={data} /> : <BirthdayShareCard data={data} />}</div>
      <div className="share-card-export-actions">
        <div className="share-card-export-buttons">
          {showShare && <button type="button" disabled={!file || isSharing} onClick={share}>{t('cardShare')}</button>}
          <button type="button" disabled={!file || isSharing} onClick={save}>{t('cardSave')}</button>
          {status === 'prepareError' && <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('cardRetry')}</button>}
        </div>
        <p role="status" aria-live="polite">{open && t(feedback)}</p>
      </div>
    </dialog>
  </>
}
