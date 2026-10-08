type FileShareNavigator = Pick<Navigator, 'share' | 'canShare'>
export type ImageShareResult = 'shared' | 'cancelled' | 'unsupported' | 'error'

export function pngFile(blob: Blob, filename: string): File {
  if (blob.type !== 'image/png' || !blob.size) throw new Error('Expected a PNG blob')
  return new File([blob], filename, { type: 'image/png', lastModified: 0 })
}

export function hasFileShareApi(api: Partial<FileShareNavigator> = navigator): boolean {
  return typeof api.share === 'function' && typeof api.canShare === 'function'
}

export function canShareImage(file: File, api: Partial<FileShareNavigator> = navigator): boolean {
  try { return hasFileShareApi(api) && api.canShare!({ files: [file] }) }
  catch { return false }
}

/** Call from the click handler: no await, import or rendering before share(). */
export function shareCardImage(file: File, api: Partial<FileShareNavigator> = navigator): Promise<ImageShareResult> {
  if (!canShareImage(file, api)) return Promise.resolve('unsupported')
  try {
    return api.share!({ files: [file], title: 'How Was the Sky?' }).then(
      () => 'shared' as const,
      error => error?.name === 'AbortError' ? 'cancelled' as const : 'error' as const,
    )
  } catch (error) {
    return Promise.resolve(error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'error')
  }
}
