<script setup lang="ts">
import { computed } from 'vue';
import type { ITagCompanionCandidate, ICompanionBarState } from '../../types/companion';
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';

interface Props {
  state?: ICompanionBarState;
  candidates?: ITagCompanionCandidate[];
  activeIndex?: number;
  position?: { top: number; left: number };
  acceptedLabels?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  candidates: () => [],
  activeIndex: 0,
  position: () => ({ top: 0, left: 0 }),
  acceptedLabels: () => [],
});

const emit = defineEmits<{
  (e: 'select', candidate: ITagCompanionCandidate, index: number): void;
  (e: 'close'): void;
}>();

const currentVisible = computed(() => {
  if (props.state) return props.state.visible && props.state.candidates.length > 0;
  return props.candidates.length > 0;
});

const currentCandidates = computed(() => props.state?.candidates ?? props.candidates);
const currentActiveIndex = computed(() => props.state?.activeIndex ?? props.activeIndex);
const currentPosition = computed(() => props.state?.position ?? props.position);
const currentAccepted = computed(() => props.state?.acceptedLabels ?? props.acceptedLabels);

function isAccepted(label: string): boolean {
  return currentAccepted.value.includes(label);
}

function handleSelect(item: ITagCompanionCandidate, idx: number) {
  if (isAccepted(item.label)) return;
  emit('select', item, idx);
}
</script>

<template>
  <div
    v-if="currentVisible"
    class="tm-companion-bar"
    :style="{
      top: `${currentPosition.top}px`,
      left: `${currentPosition.left}px`,
    }"
    role="toolbar"
    aria-label="伴生标签智能推荐"
    @mousedown.stop
  >
    <div class="tm-companion-header">
      <SyLineIcon name="sparkles" :size="13" class="tm-companion-icon" />
      <span class="tm-companion-title">伴生推荐：</span>
    </div>

    <div class="tm-companion-pills">
      <button
        v-for="(item, idx) in currentCandidates"
        :key="item.label"
        type="button"
        class="tm-companion-pill"
        :class="{
          'is-active': idx === currentActiveIndex,
          'is-accepted': isAccepted(item.label),
        }"
        :aria-pressed="idx === currentActiveIndex"
        @mousedown.prevent="handleSelect(item, idx)"
      >
        <span class="tm-pill-prefix">#</span>
        <span class="tm-pill-label">{{ item.label }}</span>
        <span class="tm-pill-suffix">#</span>
        <span class="tm-pill-percent">({{ item.percentage }}%)</span>
        <SyLineIcon v-if="isAccepted(item.label)" name="check" :size="11" class="tm-pill-check" />
      </button>
    </div>

    <div class="tm-companion-hints">
      <kbd class="tm-kbd">Tab</kbd>
      <span class="tm-hint-text">采纳</span>
      <span class="tm-hint-sep">·</span>
      <kbd class="tm-kbd">Esc</kbd>
      <span class="tm-hint-text">忽略</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.tm-companion-bar {
  position: fixed;
  z-index: 99999;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background: var(--b3-theme-surface, #ffffff);
  color: var(--b3-theme-on-surface, #2f343c);
  border: 1px solid var(--b3-border-color, rgba(0, 0, 0, 0.1));
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  user-select: none;
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
  pointer-events: auto;
  animation: tm-fade-in 0.15s ease-out;
  transform-origin: top left;
}

@keyframes tm-fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.tm-companion-header {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  color: var(--b3-theme-primary, #1a56db);
  flex-shrink: 0;
}

.tm-companion-icon {
  color: var(--b3-theme-primary, #1a56db);
  display: inline-flex;
}

.tm-companion-title {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--b3-theme-on-surface, #2f343c);
  opacity: 0.9;
}

.tm-companion-pills {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}

.tm-companion-pill {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 11.5px;
  border: 1px solid var(--b3-border-color, rgba(0, 0, 0, 0.12));
  background: var(--b3-theme-background, #f5f6f8);
  color: var(--b3-theme-on-background, #333333);
  cursor: pointer;
  transition: all 0.12s ease-in-out;
  outline: none;
  font-family: inherit;

  &:hover {
    border-color: var(--b3-theme-primary, #1a56db);
    color: var(--b3-theme-primary, #1a56db);
    background: var(--tm-badge-primary-bg, #ebf3fe);
  }

  &.is-active {
    border-color: var(--b3-theme-primary, #1a56db);
    background: var(--tm-badge-primary-bg, #ebf3fe);
    color: var(--b3-theme-primary, #1a56db);
    box-shadow: 0 0 0 1.5px var(--b3-theme-primary, #1a56db);
    font-weight: 600;

    .tm-pill-percent {
      color: var(--b3-theme-primary, #1a56db);
      opacity: 0.85;
    }
  }

  &.is-accepted {
    border-color: var(--tm-badge-success-border, rgba(46, 160, 67, 0.4));
    background: var(--tm-badge-success-bg, #dafbe1);
    color: var(--tm-badge-success-text, #1a7f37);
    cursor: default;
    opacity: 0.85;
  }
}

.tm-pill-prefix,
.tm-pill-suffix {
  opacity: 0.6;
  font-weight: normal;
}

.tm-pill-label {
  font-weight: 500;
}

.tm-pill-percent {
  font-size: 10px;
  opacity: 0.7;
  margin-left: 2px;
}

.tm-pill-check {
  margin-left: 2px;
  color: var(--tm-badge-success-text, #1a7f37);
}

.tm-companion-hints {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 4px;
  padding-left: 8px;
  border-left: 1px solid var(--b3-border-color, rgba(0, 0, 0, 0.1));
  font-size: 11px;
  color: var(--b3-theme-on-surface, #555555);
  opacity: 0.75;
}

.tm-kbd {
  display: inline-block;
  padding: 0 4px;
  font-size: 10px;
  font-family: inherit;
  line-height: 1.4;
  border-radius: 3px;
  background: var(--b3-theme-background, #eaecef);
  border: 1px solid var(--b3-border-color, #d1d5da);
  color: var(--b3-theme-on-background, #333333);
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.15);
}

.tm-hint-sep {
  opacity: 0.5;
}
</style>
