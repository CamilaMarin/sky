// Serialize captures across previews too. This queue retains no resolved File.
let captureQueue: Promise<void> = Promise.resolve()

/** A preview-scoped cache. Invalidation also cancels work that has not started. */
export function createPreparedShareCard() {
  let revision = 0
  let controller: AbortController | null = null
  let currentKey: string | null = null
  let file: File | null = null
  let pending: Promise<File | null> | null = null
  function clear() {
    revision++
    controller?.abort()
    controller = null
    currentKey = null
    file = null
    pending = null
  }
  return {
    clear,
    get(key: string) { return key === currentKey ? file : null },
    prepare(key: string, generate: (signal: AbortSignal) => Promise<File>): Promise<File | null> {
      if (key === currentKey && pending) return pending
      if (key === currentKey && file) return Promise.resolve(file)
      clear()
      currentKey = key
      const capture = new AbortController()
      controller = capture
      const startedAt = revision
      const task = captureQueue.then(async () => {
        if (revision !== startedAt) return null
        const result = await generate(capture.signal)
        if (revision !== startedAt) return null
        file = result
        return result
      })
      pending = task
      captureQueue = task.then(() => {}, () => {})
      // Attach both handlers so errors remain retryable without unhandled rejections.
      void task.then(() => { if (revision === startedAt) pending = null }, () => {
        if (revision === startedAt) clear()
      })
      return task
    },
  }
}
