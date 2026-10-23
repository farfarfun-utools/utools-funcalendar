import { describe, expect, it } from 'vitest'
import { dateKey, getDay, localDate, matchesActivity, monthDays, moveMonth, parseDate } from '../src/lib/calendar'

describe('日期与月视图', () => {
  it('接受本地日期，拒绝溢出日期与范围外的输入', () => {
    for (const text of ['2024-02-29', ' 2024/2/29 ', '2024.2.29']) {
      expect(dateKey(parseDate(text)!)).toBe('2024-02-29')
    }
    for (const text of ['2026-02-29', '2024-13-01', '2024-00-01', '2024-04-31', '1900-12-31', '2101-01-01', '2024-01-00', 'bad']) {
      expect(parseDate(text)).toBeNull()
    }
  })
  it('跨月时夹紧月末日期，并能跨年', () => {
    expect(dateKey(moveMonth(localDate(2024, 1, 31), 1))).toBe('2024-02-29')
    expect(dateKey(moveMonth(localDate(2025, 1, 31), 1))).toBe('2025-02-28')
    expect(dateKey(moveMonth(localDate(2026, 1, 31), -1))).toBe('2025-12-31')
  })
  it('始终生成从周一开始的连续 42 天，包含完整闰月', () => {
    const days = monthDays(localDate(2024, 2, 1))
    expect(days).toHaveLength(42)
    expect(days[0].date.getDay()).toBe(1)
    expect(days.filter(day => day.date.getMonth() === 1)).toHaveLength(29)
    for (let index = 1; index < days.length; index++) {
      const previous = days[index - 1].date
      expect(days[index].key).toBe(dateKey(localDate(previous.getFullYear(), previous.getMonth() + 1, previous.getDate() + 1)))
    }
  })
  it('范围边界的补位日期不可选', () => {
    expect(monthDays(localDate(1901, 1, 1)).find(day => day.key === '1900-12-31')?.available).toBe(false)
    expect(monthDays(localDate(2100, 12, 1)).find(day => day.key === '2101-01-01')?.available).toBe(false)
  })
})

describe('农历与黄历', () => {
  it('显示已知春节、闰六月、清明和国庆日期', () => {
    const spring = getDay(localDate(2026, 2, 17))
    expect(spring.lunarDate).toBe('正月初一')
    expect(spring.festivals).toContain('春节')
    expect(getDay(localDate(2025, 7, 25)).lunarDate).toBe('闰六月初一')
    expect(getDay(localDate(2024, 4, 4)).term).toBe('清明')
    expect(getDay(localDate(2026, 10, 1)).festivals).toContain('国庆节')
  })
  it('黄道日与事项宜忌独立筛选，黑道日也可能宜嫁娶', () => {
    const day = getDay(localDate(2026, 10, 23))
    expect(day.auspicious).toBe(false)
    expect(matchesActivity(day, '')).toBe(false)
    expect(matchesActivity(day, '嫁娶')).toBe(true)
    expect(matchesActivity(day, '探病')).toBe(false)
    expect(matchesActivity({ ...day, ji: [...day.ji, '嫁娶'] }, '嫁娶')).toBe(false)
  })
})
