<script setup lang="ts">
defineProps<{ name: 'calendar' | 'chevron-left' | 'chevron-right' | 'sun' | 'moon' | 'monitor' | 'sparkle' | 'leaf' | 'arrow' }>()
const paths = {
  calendar: 'M7 3v4m10-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm3 9h2m4 0h2m-8 3h2',
  'chevron-left': 'm14 6-6 6 6 6',
  'chevron-right': 'm10 6 6 6-6 6',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  moon: 'M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z',
  monitor: 'M3 4h18v13H3V4Zm5 17h8m-4-4v4',
  sparkle: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  leaf: 'M20 4C9 2 3 8 6 14c4 7 14 3 14-10ZM4 21 15 10',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
}
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="paths[name]" />
  </svg>
</template>
