import { useId, useRef } from 'react'
import { useLanguage } from '../../i18n/LanguageContext'
import type { ShareCardData } from '../../types/shareCard'
import SingleDayShareCard from './SingleDayShareCard'
import BirthdayShareCard from './BirthdayShareCard'

export default function ShareCardPreview({ data }: { data: ShareCardData }) {
  const { t } = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
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
      {data.kind === 'single' ? <SingleDayShareCard data={data} /> : <BirthdayShareCard data={data} />}
    </dialog>
  </>
}
