import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import type { ShareContent } from '../utils/shareContent'
import { shareResult } from '../utils/shareResult'

export default function ShareButton({ content }: { content: ShareContent }) {
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<'copied' | 'error' | null>(null)
  const pending = useRef(false)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  useEffect(() => {
    if (feedback !== 'copied') return
    const timer = window.setTimeout(() => setFeedback(null), 4000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  async function handleShare() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setFeedback(null)
    const outcome = await shareResult(content)
    pending.current = false
    if (!mounted.current) return
    setBusy(false)
    setFeedback(outcome === 'copied' || outcome === 'error' ? outcome : null)
  }

  return <div className="share-result">
    <button type="button" className="share-button" onClick={handleShare} disabled={busy} aria-busy={busy}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
        <path d="M12 16V3m-4 4 4-4 4 4M5 13v7h14v-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t('shareSky')}
    </button>
    <p className="share-feedback" role="status" aria-live="polite" aria-atomic="true">
      {feedback === 'copied' ? t('shareCopied') : feedback === 'error' ? t('shareError') : ''}
    </p>
  </div>
}
