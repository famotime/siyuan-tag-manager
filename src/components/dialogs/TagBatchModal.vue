<template>
  <div v-if="state.visible" class="tm-modal-mask" @click.self="emit('close')">
    <div class="tm-modal-card">
      <div class="tm-modal-title">
        <SyLineIcon name="layers-plus" :size="16" />
        <span>批量文档打标</span>
      </div>
      <div class="tm-modal-body">
        <div class="tm-form-group">
          <label>目标文档 ID (每行一个 ID)：</label>
          <textarea
            v-model="state.docIdsText"
            class="b3-text-field fn__block"
            rows="3"
            placeholder="粘贴思源文档块 ID，例如 20260926080000-xxxxxxx"
          ></textarea>
        </div>
        <div class="tm-form-group">
          <label>待添加的标签（支持多个，逗号分隔）：</label>
          <input
            v-model="state.tagsText"
            class="b3-text-field fn__block"
            placeholder="例如：YouTube, AI, 产品设计"
          />
        </div>
      </div>
      <div class="tm-modal-footer">
        <button class="b3-button b3-button--cancel" @click="emit('close')">取消</button>
        <button class="b3-button b3-button--primary" :disabled="state.executing" @click="emit('execute')">
          {{ state.executing ? '执行打标中...' : '开始批量打标' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';
import type { IBatchModalState } from '../../types/ui';

defineProps<{
  state: IBatchModalState;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'execute'): void;
}>();
</script>
