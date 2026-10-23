<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import AppIcon from './components/AppIcon.vue'
import { ACTIVITIES, MAX_YEAR, MIN_YEAR, WEEKDAYS, dateKey, getDay, localDate, matchesActivity, monthDays, moveMonth, parseDate } from './lib/calendar'

const today = ref(dateKey(new Date()))
const selected = ref(parseDate(today.value) ?? localDate(2026, 1, 1))
const view = ref<'calendar' | 'auspicious'>('calendar')
const activity = ref('')
const searchError = ref('')
const showAll = ref(false)
watch(selected, () => { showAll.value = false })
const grid = ref<HTMLElement>()
const years = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, index) => MIN_YEAR + index)
const monthAnchor = computed(() => `${selected.value.getFullYear()}-${selected.value.getMonth()}`)
const days = computed(() => {
  const [year, month] = monthAnchor.value.split('-').map(Number)
  return monthDays(localDate(year, month + 1, 1))
})
const current = computed(() => getDay(selected.value))
const lunar = computed(() => current.value.lunar)
const inMonth = computed(() => days.value.filter(day => day.date.getMonth() === selected.value.getMonth()))
const matching = computed(() => inMonth.value.filter(day => matchesActivity(day, activity.value)))
const monthTerms = computed(() => inMonth.value.filter(day => day.term))
const activityLabel = computed(() => ACTIVITIES.find(item => item.value === activity.value)?.label)
const nextTerm = computed(() => lunar.value.getNextJieQi(true))
const weekday = computed(() => `星期${WEEKDAYS[(selected.value.getDay() + 6) % 7]}`)
const minMonth = computed(() => selected.value.getFullYear() === MIN_YEAR && selected.value.getMonth() === 0)
const maxMonth = computed(() => selected.value.getFullYear() === MAX_YEAR && selected.value.getMonth() === 11)

type Theme = 'system' | 'light' | 'dark'
function loadTheme(): Theme {
  try {
    const value = localStorage.getItem('funcalendar-theme')
    if (value === 'light' || value === 'dark') return value
  } catch { /* 禁用存储时仍可切换当前会话的主题。 */ }
  return 'system'
}
const theme = ref<Theme>(loadTheme())
const media = window.matchMedia('(prefers-color-scheme: dark)')
const systemDark = ref(window.utools?.isDarkColors?.() ?? media.matches)
const themeNames = { system: '跟随系统', light: '浅色', dark: '深色' }
const themeIcons = { system: 'monitor', light: 'sun', dark: 'moon' } as const
watchEffect(() => {
  document.documentElement.dataset.theme = theme.value === 'system' ? (systemDark.value ? 'dark' : 'light') : theme.value
})
function toggleTheme() {
  theme.value = theme.value === 'system' ? 'light' : theme.value === 'light' ? 'dark' : 'system'
  try { localStorage.setItem('funcalendar-theme', theme.value) } catch { /* 主题在当前会话继续生效。 */ }
}
function select(date: Date) {
  if (date.getFullYear() < MIN_YEAR || date.getFullYear() > MAX_YEAR) return
  selected.value = date
  searchError.value = ''
}
function goToday() {
  today.value = dateKey(new Date())
  const date = parseDate(today.value)
  if (date) select(date)
}
function jump(text: string) {
  if (!text.trim()) { searchError.value = ''; return }
  const date = parseDate(text)
  if (date) select(date)
  else searchError.value = `请输入 ${MIN_YEAR}–${MAX_YEAR} 年的有效日期，如 2026-10-23`
}
function changeMonth(event: Event, part: 'year' | 'month') {
  const value = Number((event.target as HTMLSelectElement).value)
  const year = part === 'year' ? value : selected.value.getFullYear()
  const month = part === 'month' ? value : selected.value.getMonth() + 1
  select(localDate(year, month, Math.min(selected.value.getDate(), localDate(year, month + 1, 0).getDate())))
}
async function onGridKey(event: KeyboardEvent) {
  const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
  const offset = offsets[event.key]
  if (offset === undefined && !['Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return
  event.preventDefault()
  let date = selected.value
  if (offset !== undefined) date = localDate(date.getFullYear(), date.getMonth() + 1, date.getDate() + offset)
  else if (event.key === 'Home') date = localDate(date.getFullYear(), date.getMonth() + 1, 1)
  else if (event.key === 'End') date = localDate(date.getFullYear(), date.getMonth() + 2, 0)
  else date = moveMonth(date, event.key === 'PageUp' ? -1 : 1)
  select(date)
  await nextTick()
  grid.value?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
}
function syncClock() {
  const next = dateKey(new Date())
  if (next !== today.value) {
    const followingToday = current.value.key === today.value
    today.value = next
    if (followingToday) goToday()
  }
}
function syncTheme() { systemDark.value = window.utools?.isDarkColors?.() ?? media.matches }
let timer: ReturnType<typeof setInterval>
let active = false
onMounted(() => {
  active = true
  timer = setInterval(syncClock, 30_000)
  media.addEventListener('change', syncTheme)
  window.utools?.onPluginEnter(({ code }) => {
    if (!active) return
    syncTheme()
    goToday()
    view.value = code === 'auspicious' ? 'auspicious' : 'calendar'
    window.utools?.setSubInput(({ text }) => { if (active) jump(text) }, '输入日期跳转，如 2026-10-23', false)
  })
})
onUnmounted(() => {
  active = false
  clearInterval(timer)
  media.removeEventListener('change', syncTheme)
})
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand">
        <span class="brand-icon"><AppIcon name="calendar" /></span>
        <div><h1>时光常伴 <span>FunCalendar</span></h1><p>日有所见，岁有所期</p></div>
      </div>
      <nav class="view-switch" aria-label="日历模式">
        <button :class="{ active: view === 'calendar' }" :aria-pressed="view === 'calendar'" @click="view = 'calendar'">月历</button>
        <button :class="{ active: view === 'auspicious' }" :aria-pressed="view === 'auspicious'" @click="view = 'auspicious'"><AppIcon name="sparkle" />择吉</button>
      </nav>
      <button class="icon-button theme-button" :aria-label="`主题：${themeNames[theme]}，点击切换`" :title="`主题：${themeNames[theme]}，点击切换`" @click="toggleTheme"><AppIcon :name="themeIcons[theme]" /></button>
    </header>

    <main>
      <div v-if="searchError" class="search-error" role="alert">{{ searchError }}</div>
      <div class="workspace">
        <section class="calendar-panel" aria-label="月历">
          <div class="month-toolbar">
            <div class="month-title">
              <span class="eyebrow">{{ view === 'calendar' ? '每一个日子，都值得好好度过' : '为重要的事，选一个好日子' }}</span>
              <div class="month-selects">
                <select aria-label="年份" :value="selected.getFullYear()" @change="changeMonth($event, 'year')"><option v-for="year in years" :key="year" :value="year">{{ year }} 年</option></select>
                <select aria-label="月份" :value="selected.getMonth() + 1" @change="changeMonth($event, 'month')"><option v-for="month in 12" :key="month" :value="month">{{ String(month).padStart(2, '0') }} 月</option></select>
              </div>
            </div>
            <div class="month-actions">
              <button class="icon-button" aria-label="上个月" :disabled="minMonth" @click="select(moveMonth(selected, -1))"><AppIcon name="chevron-left" /></button>
              <button class="today-button" @click="goToday">今天</button>
              <button class="icon-button" aria-label="下个月" :disabled="maxMonth" @click="select(moveMonth(selected, 1))"><AppIcon name="chevron-right" /></button>
            </div>
          </div>

          <div v-if="view === 'auspicious'" class="activity-picker" aria-label="择吉事项">
            <button v-for="item in ACTIVITIES" :key="item.value" :class="{ active: activity === item.value }" :aria-pressed="activity === item.value" @click="activity = item.value">{{ item.label }}</button>
          </div>

          <div class="weekdays" aria-hidden="true"><span v-for="(day, index) in WEEKDAYS" :key="day" :class="{ weekend: index > 4 }">{{ day }}</span></div>
          <div ref="grid" class="calendar-grid" :class="{ 'picking-days': view === 'auspicious' }" @keydown="onGridKey">
            <button v-for="day in days" :key="day.key" class="day-cell"
              :class="{ outside: day.date.getMonth() !== selected.getMonth(), selected: day.key === current.key, 'is-today': day.key === today, weekend: day.date.getDay() === 0 || day.date.getDay() === 6, 'has-festival': !!day.term || day.festivals.length > 0, suitable: view === 'auspicious' && day.date.getMonth() === selected.getMonth() && matchesActivity(day, activity) }"
              :disabled="!day.available" :aria-pressed="day.key === current.key" :aria-current="day.key === today ? 'date' : undefined"
              :aria-label="`${day.key}，农历${day.lunarDate}${day.term ? '，' + day.term : ''}${day.festivals.length ? '，' + day.festivals.join('、') : ''}${view === 'auspicious' && matchesActivity(day, activity) ? '，' + (activity ? '宜' + activity : '黄道吉日') : ''}`"
              :tabindex="day.key === current.key ? 0 : -1" :title="[day.key, day.lunarDate, day.term, ...day.festivals].filter(Boolean).join(' · ')" @click="select(day.date)">
              <span class="day-number">{{ day.day }}<span v-if="day.key === today" class="today-mark">今</span></span>
              <span class="lunar-label">{{ day.label }}</span>
              <span v-if="view === 'auspicious' && day.date.getMonth() === selected.getMonth() && matchesActivity(day, activity)" class="good-mark">宜</span>
            </button>
          </div>

          <div v-if="view === 'calendar'" class="month-bottom">
            <div class="solar-terms"><AppIcon name="leaf" /><button v-for="day in monthTerms" :key="day.key" @click="select(day.date)"><strong>{{ day.term }}</strong><span>{{ day.date.getMonth() + 1 }}.{{ String(day.day).padStart(2, '0') }}</span></button></div>
            <span class="calendar-caption">阳历 · 农历 · 节气</span>
          </div>
          <div v-else class="matching-summary" aria-live="polite">
            <AppIcon name="sparkle" /><span>本月 <strong>{{ matching.length }}</strong> 天{{ activity ? '宜' + activity : '为黄道吉日' }}</span><span>「宜」标记可点选查看</span>
          </div>

          <div class="calendar-note">
            <span>{{ view === 'calendar' ? '慢慢翻日历，好好过生活。' : (activity ? '按当日「宜」筛选，并排除同项「忌」。' : '按十二值神的黄道日筛选。') }}</span>
            <label class="date-jump"><AppIcon name="calendar" /><span>跳转日期</span><input aria-label="跳转日期" type="date" :min="`${MIN_YEAR}-01-01`" :max="`${MAX_YEAR}-12-31`" :value="current.key" @change="jump(($event.target as HTMLInputElement).value)" /></label>
          </div>
        </section>

        <aside class="detail-panel" aria-label="所选日期详情">
          <section class="date-card">
            <div class="date-card-top"><span>{{ selected.getFullYear() }} 年 {{ selected.getMonth() + 1 }} 月</span><span class="date-tag">{{ current.key === today ? '今日' : '所选日期' }}</span></div>
            <div class="hero-date">{{ String(current.day).padStart(2, '0') }}</div>
            <div class="hero-lunar">{{ current.lunarDate }}<span>{{ weekday }}</span></div>
            <div class="ganzhi">{{ lunar.getYearInGanZhi() }}{{ lunar.getYearShengXiao() }}年 · {{ lunar.getMonthInGanZhi() }}月 · {{ lunar.getDayInGanZhi() }}日</div>
            <div class="date-card-bottom"><span>{{ current.term || current.festivals[0] || '岁时有序，日子常新' }}</span><AppIcon name="leaf" /></div>
          </section>

          <section class="almanac">
            <div class="almanac-heading"><h2>当日黄历</h2><span :class="{ lucky: current.auspicious }">{{ lunar.getDayTianShen() }} · {{ lunar.getDayTianShenType() }}日</span></div>
            <div class="fortune-row favorable"><span class="fortune-label">宜</span><p><span v-for="item in (showAll ? current.yi : current.yi.slice(0, 6))" :key="item">{{ item }}</span><span v-if="!current.yi.length">暂无记载</span><button v-if="!showAll && current.yi.length > 6" aria-label="展开全部宜忌" @click="showAll = true">+{{ current.yi.length - 6 }} 项</button></p></div>
            <div class="fortune-row avoid"><span class="fortune-label">忌</span><p><span v-for="item in (showAll ? current.ji : current.ji.slice(0, 6))" :key="item">{{ item }}</span><span v-if="!current.ji.length">暂无记载</span><button v-if="!showAll && current.ji.length > 6" aria-label="展开全部宜忌" @click="showAll = true">+{{ current.ji.length - 6 }} 项</button></p></div>
            <button v-if="showAll" class="collapse-fortune" @click="showAll = false">收起宜忌</button>
            <dl class="almanac-facts"><div><dt>冲煞</dt><dd>冲{{ lunar.getChongDesc() }} · 煞{{ lunar.getSha() }}</dd></div><div><dt>财神</dt><dd>{{ lunar.getDayPositionCaiDesc() }}</dd></div><div><dt>值日</dt><dd>{{ lunar.getZhiXing() }}日</dd></div></dl>
          </section>
          <div class="next-term"><AppIcon name="leaf" /><span>下个节气 <strong>{{ nextTerm.getName() }}</strong></span><span>{{ nextTerm.getSolar().getMonth() }} 月 {{ nextTerm.getSolar().getDay() }} 日</span></div>
        </aside>
      </div>
    </main>
    <footer class="app-footer"><span><i></i>离线可用 · 时光常伴</span><span title="宜忌来源：6tail/lunar-typescript 1.8.6 内置数据表，按月干支、日干支查询">历法与宜忌：lunar · 民俗仅供参考</span></footer>
  </div>
</template>
