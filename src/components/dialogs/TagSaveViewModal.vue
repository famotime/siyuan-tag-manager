<template>
  <div v-if="state.visible" class="tm-modal-mask" @click.self="emit('close')">
    <div class="tm-modal-card">
      <div class="tm-modal-title">
        <SyLineIcon name="save" :size="16" />
        <span>保存为智能视图</span>
      </div>
      <div class="tm-modal-body">
        <div class="tm-form-group">
          <label>视图名称：</label>
          <input
            v-model="state.title"
            class="b3-text-field fn__block"
            placeholder="例如：AI视频与提示词重点"
            @keydown.enter="emit('confirm')"
          />
        </div>
        <div class="tm-section-hint">
          包含 (AND): {{ includeTags.map(t => `#${t}`).join(', ') || '无' }}<br>
          可选 (OR): {{ (optionalTags || []).map(t => `#${t}`).join(', ') || '无' }}<br>
          排除 (NOT): {{ excludeTags.map(t => `#${t}`).join(', ') || '无' }}
        </div>
      </div>
      <div class="tm-modal-footer">
        <button class="b3-button b3-button--cancel" @click="emit('close')">取消</button>
        <button class="b3-button b3-button--primary" @click="emit('confirm')">保存视图</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';
import type { ISaveViewModalState } from '../../types/ui';

defineProps<{
  state: ISaveViewModalState;
  includeTags: string[];
  optionalTags?: string[];
  excludeTags: string[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm'): void;
}>();
</script>
