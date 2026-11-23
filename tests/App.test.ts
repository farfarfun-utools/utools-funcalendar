// @vitest-environment jsdom
/// <reference types="vitest/jsdom" />
import { enableAutoUnmount, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import App from '../src/App.vue'

let wrapper: VueWrapper
let enter: (action: { code: string }) => void
let search: (input: { text: string }) => void
let tools: Map<string, (params?: Record<string, unknown> | null) => unknown>

enableAutoUnmount(afterEach)

beforeEach(() => {
  tools = new Map()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 23, 12))
  // Node 的 Web Storage 会遮住 jsdom 的同名属性，测试明确使用浏览器存储。
  vi.stubGlobal('localStorage', jsdom.window.localStorage)
  localStorage.clear()
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  window.utools = {
    onPluginEnter: callback => { enter = callback },
    setSubInput: callback => { search = callback },
    registerTool: (name, handler) => { tools.set(name, handler) },
  }
  wrapper = mount(App, { attachTo: document.body })
})
afterEach(() => {
  delete window.utools
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('日历交互', () => {
  it('宜忌较多时可展开全部，换日后恢复简洁视图', async () => {
    expect(wrapper.get('.favorable').text()).not.toContain('立碑')
    await wrapper.get('[aria-label="展开全部宜忌"]').trigger('click')
    expect(wrapper.get('.favorable').text()).toContain('立碑')
    await wrapper.get('[aria-label="下个月"]').trigger('click')
    expect(wrapper.find('.collapse-fortune').exists()).toBe(false)
  })
  it('默认选中今天，并显示真实农历、节气和宜忌', () => {
    expect(wrapper.findAll('.day-cell')).toHaveLength(42)
    expect(wrapper.get('.day-cell.selected').attributes('aria-current')).toBe('date')
    expect(wrapper.get('.hero-lunar').text()).toContain('九月十四')
    expect(wrapper.get('.date-card-bottom').text()).toContain('霜降')
    expect(wrapper.get('.favorable').text()).toContain('嫁娶')
  })
  it('切换月份、选中补位日期、返回今天', async () => {
    await wrapper.get('[aria-label="下个月"]').trigger('click')
    expect(wrapper.get('.hero-date').text()).toBe('23')
    expect(wrapper.get('[aria-label="月份"]').element).toHaveProperty('value', '11')
    await wrapper.get('.day-cell.outside').trigger('click')
    expect(wrapper.get('[aria-label="月份"]').element).toHaveProperty('value', '10')
    await wrapper.get('.today-button').trigger('click')
    expect(wrapper.get('.day-cell.selected').attributes('aria-current')).toBe('date')
  })
  it('方向键跨月后保留焦点，月份边界禁用按钮', async () => {
    await wrapper.get('[aria-label="跳转日期"]').setValue('2026-10-31')
    await wrapper.get('.day-cell.selected').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.get('[aria-label="月份"]').element).toHaveProperty('value', '11')
    expect(wrapper.get('.hero-date').text()).toBe('01')
    expect(document.activeElement).toBe(wrapper.get('.day-cell.selected').element)
    await wrapper.get('[aria-label="跳转日期"]').setValue('1901-01-01')
    expect(wrapper.get('[aria-label="上个月"]').attributes('disabled')).toBeDefined()
    await wrapper.get('.day-cell.selected').trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.get('[aria-label="跳转日期"]').element).toHaveProperty('value', '1901-01-01')
  })
  it('择吉切换事项后，标记和结果数一致', async () => {
    enter({ code: 'auspicious' })
    await nextTick()
    const initial = wrapper.findAll('.suitable').length
    expect(initial).toBeGreaterThan(0)
    expect(wrapper.get('.matching-summary strong').text()).toBe(String(initial))
    await wrapper.findAll('.activity-picker button')[1].trigger('click')
    expect(wrapper.get('.matching-summary').text()).toContain('宜嫁娶')
    expect(wrapper.get('.day-cell.selected').classes()).toContain('suitable')
    expect(wrapper.get('.matching-summary strong').text()).toBe(String(wrapper.findAll('.suitable').length))
  })
  it('宿主输入有效日期跳转，无效日期提示，重新进入回到今天', async () => {
    enter({ code: 'calendar' })
    search({ text: '2026-02-17' })
    await nextTick()
    expect(wrapper.get('.hero-lunar').text()).toContain('正月初一')
    search({ text: '2026-02-30' })
    await nextTick()
    expect(wrapper.get('[role="alert"]').text()).toContain('有效日期')
    expect(wrapper.get('.hero-date').text()).toBe('17')
    enter({ code: 'calendar' })
    await nextTick()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('.hero-date').text()).toBe('23')
  })
  it('跨午夜时更新今天，但不改用户正在浏览的其他日期', async () => {
    vi.setSystemTime(new Date(2026, 9, 24, 0))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(wrapper.get('.hero-date').text()).toBe('24')
    await wrapper.get('[aria-label="跳转日期"]').setValue('2026-02-17')
    vi.setSystemTime(new Date(2026, 9, 25, 0))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(wrapper.get('.hero-date').text()).toBe('17')
  })
  it('主题可切换并保存，uTools 不存在时仍能使用', async () => {
    delete window.utools
    await wrapper.get('.theme-button').trigger('click')
    await wrapper.get('.theme-button').trigger('click')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('funcalendar-theme')).toBe('dark')
    await wrapper.get('.today-button').trigger('click')
    expect(wrapper.get('.hero-date').text()).toBe('23')
  })
  it('AI 工具容错空参数，并返回正确日期与择吉结果', () => {
    const getDayTool = tools.get('get_calendar_day')!
    const findDaysTool = tools.get('find_auspicious_days')!
    expect((getDayTool({ date: '2026-02-17' }) as { lunarDate: string }).lunarDate).toBe('正月初一')
    expect((findDaysTool({ month: ' 2026/2 ', activity: '嫁娶' }) as { month: string }).month).toBe('2026-02')
    expect(() => getDayTool(null)).toThrow('有效日期')
    expect(() => getDayTool(undefined)).toThrow('有效日期')
    expect(() => findDaysTool(null)).toThrow('有效月份')
    expect(() => findDaysTool(undefined)).toThrow('有效月份')
  })
  it('择吉视图中跨月补位日期不标记为吉日也不在 aria-label 中误报', async () => {
    enter({ code: 'auspicious' })
    await nextTick()
    const outsideCells = wrapper.findAll('.day-cell.outside')
    expect(outsideCells.length).toBeGreaterThan(0)
    for (const cell of outsideCells) {
      expect(cell.classes()).not.toContain('suitable')
      expect(cell.attributes('aria-label')).not.toContain('黄道吉日')
      expect(cell.attributes('aria-label')).not.toContain('，宜')
    }
  })
  it('日期选择器输入超范围日期时提示错误并重置为当前选中日期', async () => {
    const input = wrapper.get('[aria-label="跳转日期"]')
    await input.setValue('1900-01-01')
    expect(wrapper.get('[role="alert"]').text()).toContain('有效日期')
    expect((input.element as HTMLInputElement).value).toBe('2026-10-23')
  })
  it('支持 Home、End、PageUp、PageDown、ArrowUp、ArrowDown 键盘导航', async () => {
    const grid = () => wrapper.get('.day-cell.selected')
    await grid().trigger('keydown', { key: 'Home' })
    expect(wrapper.get('.hero-date').text()).toBe('01')
    await grid().trigger('keydown', { key: 'End' })
    expect(wrapper.get('.hero-date').text()).toBe('31')
    await grid().trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.get('.hero-date').text()).toBe('24')
    await grid().trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.get('.hero-date').text()).toBe('31')
    await grid().trigger('keydown', { key: 'PageUp' })
    expect(wrapper.get('[aria-label="月份"]').element).toHaveProperty('value', '9')
    expect(wrapper.get('.hero-date').text()).toBe('30')
    await grid().trigger('keydown', { key: 'PageDown' })
    expect(wrapper.get('[aria-label="月份"]').element).toHaveProperty('value', '10')
    await grid().trigger('keydown', { key: 'PageUp', shiftKey: true })
    expect(wrapper.get('[aria-label="年份"]').element).toHaveProperty('value', '2025')
    await grid().trigger('keydown', { key: 'ArrowLeft', ctrlKey: true })
    expect(wrapper.get('[aria-label="年份"]').element).toHaveProperty('value', '2025')
    await grid().trigger('keydown', { key: 't' })
    expect(wrapper.get('[aria-label="年份"]').element).toHaveProperty('value', '2026')
    expect(wrapper.get('.day-cell.selected').attributes('aria-current')).toBe('date')
  })
  it('点击下个节气可直接跳转，跨年与 2100 年末边界显示正确', async () => {
    await wrapper.get('.next-term').trigger('click')
    expect(wrapper.get('[aria-label="月份"]').element).toHaveProperty('value', '11')
    expect(wrapper.get('.date-card-bottom').text()).toContain('立冬')

    await wrapper.get('[aria-label="跳转日期"]').setValue('2026-12-25')
    expect(wrapper.get('.next-term').text()).toContain('2027 年')

    await wrapper.get('[aria-label="跳转日期"]').setValue('2100-12-31')
    expect(wrapper.get('.next-term').attributes('disabled')).toBeDefined()
  })
})
