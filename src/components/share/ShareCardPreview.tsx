import { useEffect, useId, useRef, useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext'
import type { ShareCardData } from '../../types/shareCard'
import { createShareCardPng, downloadShareCardPng } from '../../utils/exportShareCard'
import SingleDayShareCard from './SingleDayShareCard'
import BirthdayShareCard from './BirthdayShareCard'

export default function ShareCardPreview({ data, filename }: { data: ShareCardData; filename: string }) {
  const { t } = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  const mounted = useRef(true)
  const [status, setStatus] = useState<'idle' | 'creating' | 'saved' | 'error'>('idle')
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function save() {
    const frame = card.current?.querySelector<HTMLElement>('.sky-card-frame')
    if (busy.current || !frame) return
    busy.current = true
    setStatus('creating')
    try {
      const blob = await createShareCardPng(frame)
      if (mounted.current) {
        downloadShareCardPng(blob, filename)
        setStatus('saved')
      }
    } catch {
      if (mounted.current) setStatus('error')
    } finally { busy.current = false }
  }
  const titleId = useId(), descriptionId = useId()
  return <>
    <button ref={trigger} type="button" className="preview-card-button" onClick={() => dialog.current?.showModal()}>{t('cardPreview')}</button>
    <dialog ref={dialog} className="share-card-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
      onClose={() => trigger.current?.focus()}>
      <header className="share-card-dialog-heading">
        <h2 id={titleId}>{t('cardTitle')}</h2>
        <button type="button" autoFocus onClick={() => dialog.current?.close()}>{t('cardClose')}</button>
      </header>
      <p id={descriptionId} className="share-card-dialog-description">{t('cardDescription')}</p>
      <div ref={card}>{data.kind === 'single' ? <SingleDayShareCard data={data} /> : <BirthdayShareCard data={data} />}</div>
      <div className="share-card-export-actions">
        <button type="button" disabled={status === 'creating'} onClick={() => void save()}>{t(status === 'creating' ? 'cardCreating' : 'cardSave')}</button>
        <p role="status" aria-live="polite">{status !== 'idle' && t(status === 'creating' ? 'cardCreating' : status === 'saved' ? 'cardSaved' : 'cardError')}</p>
      </div>
    </dialog>
  </>
}
