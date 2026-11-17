<template>
  <div v-if="visible" class="tm-modal-mask" @click.self="emit('close')">
    <div class="tm-modal-card" style="max-width: 400px;">
      <div class="tm-modal-title">
        <SyLineIcon name="alert-triangle" :size="16" />
        <span>{{ title }}</span>
      </div>
      <div class="tm-modal-body" style="font-size: 12px; line-height: 1.6;">
        {{ message }}
      </div>
      <div class="tm-modal-footer">
        <button class="b3-button b3-button--cancel" @click="emit('close')">取消</button>
        <button
          class="b3-button b3-button--primary"
          :style="danger ? { background: 'var(--b3-theme-error, #d23f31)', borderColor: 'var(--b3-theme-error, #d23f31)' } : undefined"
          @click="handleConfirm"
        >
          {{ confirmText || '确认' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';

/**
 * 通用自绘确认对话框（替代 window.confirm）
 * 项目在 Electron 环境下原生 confirm 存在鼠标光标指针丢失问题，
 * 统一采用与工作台一致的 DOM 模态，保证主题与指针行为一致
 */
withDefaults(
  defineProps<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    danger?: boolean;
  }>(),
  {
    confirmText: '确认',
    danger: false,
  },
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm'): void;
}>();

function handleConfirm() {
  emit('confirm');
}
</script>
