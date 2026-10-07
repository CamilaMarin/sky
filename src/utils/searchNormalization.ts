export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/gu, ' ')
}
