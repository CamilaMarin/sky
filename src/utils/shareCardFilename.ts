/** Keep Unicode letters while removing accents and filesystem-unsafe punctuation. */
export function locationSlug(name: string): string {
  return name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '') || 'location'
}

export function shareCardFilename(name: string, mode: 'single' | 'birthday', date: string): string {
  return `how-was-the-sky-${locationSlug(name)}-${mode === 'birthday' ? `birthday-${date.slice(0, 4)}` : date}.png`
}
