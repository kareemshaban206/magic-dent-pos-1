const HARAKAT = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g

export const LETTERS = [
  'أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش',
  'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'
]

export function stripHarakat(s) {
  return String(s || '').normalize('NFKD').replace(HARAKAT, '')
}

export function normalizeAr(s) {
  return stripHarakat(s)
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function skipAl(s) {
  return s.replace(/^ال/, '')
}

export function firstLetter(name) {
  let n = skipAl(stripHarakat(String(name || '').trim()))
  let ch = n.charAt(0)
  if ('أإآاٱ'.includes(ch)) return 'أ'
  if (ch === 'ة') return 'ه'
  if (ch === 'ى') return 'ي'
  return ch
}

export function matchesLetter(name, letter) {
  if (!letter) return true
  return firstLetter(name) === letter
}

export function matchesSearch(name, q) {
  const query = normalizeAr(q)
  if (!query) return true
  const hay = normalizeAr(name)
  const hay2 = skipAl(hay)
  return hay.includes(query) || hay2.includes(query)
}

export function formatMoney(n) {
  const v = Number(n) || 0
  const rounded = Math.round(v * 100) / 100
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
  return `${text} EGP`
}

export function formatNumber(n) {
  return new Intl.NumberFormat('ar-EG').format(Number(n) || 0)
}

export function formatDateTime(iso) {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(d)
}

export function formatTime(iso) {
  return new Intl.DateTimeFormat('ar-EG', { timeStyle: 'short' }).format(new Date(iso))
}

export function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfDay(d) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function rangeForPreset(preset) {
  const now = new Date()
  if (preset === 'today') {
    return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() }
  }
  if (preset === 'yesterday') {
    const y = new Date(now)
    y.setDate(y.getDate() - 1)
    return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() }
  }
  if (preset === '7d') {
    const s = startOfDay(now)
    s.setDate(s.getDate() - 6)
    return { from: s.toISOString(), to: endOfDay(now).toISOString() }
  }
  if (preset === 'month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: startOfDay(s).toISOString(), to: endOfDay(now).toISOString() }
  }
  return { from: null, to: null }
}

export function dateInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const CLINIC = {
  name: 'Magic Dent POS',
  subtitle: 'نقطة البيع'
}

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN_INDIC = '۰۱۲۳۴۵۶۷۸۹'

export function normalizeDigits(value) {
  return String(value ?? '').replace(/[٠-٩۰-۹]/g, (ch) => {
    const a = ARABIC_INDIC.indexOf(ch)
    if (a >= 0) return String(a)
    const p = PERSIAN_INDIC.indexOf(ch)
    return p >= 0 ? String(p) : ch
  })
}

export function parsePrice(value) {
  const s = normalizeDigits(value).replace(/,/g, '.').replace(/[^\d.]/g, '').trim()
  if (!s) return NaN
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

export function isPositivePrice(value) {
  const n = parsePrice(value)
  return Number.isFinite(n) && n > 0
}
