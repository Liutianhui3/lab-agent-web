export function avatarUrl(value) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (!value.startsWith('/uploads/')) return ''
  const base = import.meta.env.VITE_API_BASE_URL || ''
  return /^https?:\/\//i.test(base) ? new URL(value, base).href : value
}
