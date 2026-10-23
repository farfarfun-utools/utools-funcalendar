import { Solar } from 'lunar-typescript'

export const MIN_YEAR = 1901
export const MAX_YEAR = 2100
export const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
export const ACTIVITIES = [
  { value: '', label: '黄道吉日' },
  { value: '嫁娶', label: '嫁娶' },
  { value: '入宅', label: '入宅搬家' },
  { value: '开市', label: '开市' },
  { value: '出行', label: '出行' },
  { value: '动土', label: '动土' },
]

// 使用本地正午构造日期，避免 UTC 日期偏移及夏令时跨日。
export function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12)
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseDate(text: string): Date | null {
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text.trim())
  if (!match) return null
  const [, y, m, d] = match
  const year = Number(y), month = Number(m), day = Number(d)
  const date = localDate(year, month, day)
  return year >= MIN_YEAR && year <= MAX_YEAR && date.getFullYear() === year
    && date.getMonth() + 1 === month && date.getDate() === day ? date : null
}

export function moveMonth(date: Date, delta: number): Date {
  const first = localDate(date.getFullYear(), date.getMonth() + 1 + delta, 1)
  const lastDay = localDate(first.getFullYear(), first.getMonth() + 2, 0).getDate()
  return localDate(first.getFullYear(), first.getMonth() + 1, Math.min(date.getDate(), lastDay))
}

export function getDay(date: Date) {
  const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate())
  const lunar = solar.getLunar()
  const term = lunar.getJieQi()
  const festivals = [...lunar.getFestivals(), ...solar.getFestivals()]
  const lunarDay = lunar.getDay() === 1 ? `${lunar.getMonthInChinese()}月` : lunar.getDayInChinese()
  return {
    date, key: dateKey(date), day: date.getDate(), lunar, term, festivals,
    label: term || festivals[0] || lunarDay,
    lunarDate: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    yi: lunar.getDayYi(), ji: lunar.getDayJi(),
    auspicious: lunar.getDayTianShenType() === '黄道',
    available: date.getFullYear() >= MIN_YEAR && date.getFullYear() <= MAX_YEAR,
  }
}

export type CalendarDay = ReturnType<typeof getDay>

export function monthDays(date: Date): CalendarDay[] {
  const year = date.getFullYear(), month = date.getMonth() + 1
  const offset = (localDate(year, month, 1).getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, index) => getDay(localDate(year, month, index - offset + 1)))
}

export function matchesActivity(day: CalendarDay, activity: string): boolean {
  return activity ? day.yi.includes(activity) && !day.ji.includes(activity) : day.auspicious
}
