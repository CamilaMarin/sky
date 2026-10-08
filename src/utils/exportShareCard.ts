export const SHARE_CARD_WIDTH = 1080
export const SHARE_CARD_HEIGHT = 1350

/** Re-layout the existing composition before rasterizing, independently of preview/DPR. */
export async function createShareCardPng(frame: HTMLElement, signal?: AbortSignal): Promise<Blob> {
  signal?.throwIfAborted()
  const copy = frame.cloneNode(true) as HTMLElement
  const { toBlob } = await import('html-to-image')
  await document.fonts?.ready
  signal?.throwIfAborted()
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.inert = true
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1080px;height:1350px;pointer-events:none;'
  // Cloned accessible IDs must not shadow the visible card's IDs.
  for (const node of [copy, ...copy.querySelectorAll<HTMLElement>('[id], [aria-labelledby]')]) {
    node.removeAttribute('id')
    node.removeAttribute('aria-labelledby')
  }
  host.append(copy)
  document.body.append(host)
  try {
    const blob = await toBlob(copy, {
      width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT,
      canvasWidth: SHARE_CARD_WIDTH, canvasHeight: SHARE_CARD_HEIGHT,
      pixelRatio: 1,
      // Current cards use system fonts exclusively; no remote font CSS is needed.
      skipFonts: true,
    })
    signal?.throwIfAborted()
    if (!blob || blob.type !== 'image/png') throw new Error('PNG generation failed')
    const header = new DataView(await blob.slice(0, 24).arrayBuffer())
    if (header.byteLength < 24 || header.getUint32(16) !== SHARE_CARD_WIDTH || header.getUint32(20) !== SHARE_CARD_HEIGHT) {
      throw new Error('Unexpected PNG dimensions')
    }
    return blob
  } finally {
    host.remove()
  }
}

export function downloadShareCardPng(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  try {
    link.href = url
    link.download = filename
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    // Give Safari time to consume the URL after the download navigation starts.
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}
