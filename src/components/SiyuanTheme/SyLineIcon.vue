<template>
  <span
    class="sy-line-icon"
    :class="[
      { 'is-spinning': spin },
      { 'is-disabled': disabled },
      `sy-line-icon--${name}`
    ]"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      minWidth: `${size}px`,
      minHeight: `${size}px`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    }"
  >
    <svg
      style="fill: none !important; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; display: block;"
      :style="{
        strokeWidth: strokeWidth,
        color: color || undefined,
        width: `${size}px`,
        height: `${size}px`,
      }"
      viewBox="0 0 24 24"
    >
      <template v-if="iconData">
        <template v-for="(p, idx) in iconData.paths" :key="idx">
          <path v-if="!p.type || p.type === 'path'" :d="p.d" />
          <circle v-else-if="p.type === 'circle'" :cx="p.cx" :cy="p.cy" :r="p.r" />
          <line v-else-if="p.type === 'line'" :x1="p.x1" :y1="p.y1" :x2="p.x2" :y2="p.y2" />
          <polyline v-else-if="p.type === 'polyline'" :points="p.points" />
          <polygon v-else-if="p.type === 'polygon'" :points="p.points" />
          <rect v-else-if="p.type === 'rect'" :x="p.x" :y="p.y" :width="p.width" :height="p.height" :rx="p.rx" />
        </template>
      </template>
      <!-- 回退未知图标渲染一个小方框加感叹号 -->
      <template v-else>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </template>
    </svg>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { LINE_ICONS } from './icons';

const props = withDefaults(
  defineProps<{
    name: string;
    size?: number | string;
    strokeWidth?: number | string;
    color?: string;
    spin?: boolean;
    disabled?: boolean;
  }>(),
  {
    size: 14,
    strokeWidth: 1.75,
    spin: false,
    disabled: false,
  }
);

const iconData = computed(() => LINE_ICONS[props.name]);
</script>

<style lang="scss" scoped>
.sy-line-icon {
  vertical-align: middle;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
  line-height: 1;
  user-select: none;
  flex-shrink: 0;

  &.is-spinning {
    animation: tm-spin 1s linear infinite;
  }

  &.is-disabled {
    opacity: 0.35;
    pointer-events: none;
  }
}

@keyframes tm-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
