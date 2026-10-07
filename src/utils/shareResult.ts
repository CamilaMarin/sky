import type { ShareContent } from './shareContent'

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'error'
export interface ShareCapabilities {
  share?: (content: ShareContent) => Promise<void>
  clipboard?: { writeText: (text: string) => Promise<void> }
}

/** Call directly from a user event to retain browser transient activation. */
export async function shareResult(content: ShareContent, capabilities: ShareCapabilities = navigator): Promise<ShareOutcome> {
  try {
    if (typeof capabilities.share === 'function') {
      await capabilities.share(content)
      return 'shared'
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return 'cancelled'
    // Real share failures may recover via clipboard; cancellation never copies.
  }
  try {
    if (typeof capabilities.clipboard?.writeText !== 'function') return 'error'
    await capabilities.clipboard.writeText(`${content.text}\n\n${content.url}`)
    return 'copied'
  } catch { return 'error' }
}
