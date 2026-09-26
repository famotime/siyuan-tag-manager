<template>
  <div v-if="state.visible" class="tm-modal-mask" @click.self="emit('close')">
    <div class="tm-modal-card">
      <div class="tm-modal-title">
        <SyLineIcon name="git-merge" :size="16" />
        <span>标签重构与合并</span>
      </div>
      <div class="tm-modal-body">
        <p class="tm-modal-target">将源标签 <b>#{{ state.sourceLabel }}#</b> 合并到目标标签：</p>
        <div class="tm-form-group">
          <label>目标规范化标签名称：</label>
          <input
            v-model="state.targetLabel"
            class="b3-text-field fn__block"
            placeholder="例如：Prompt 或 tech/python"
            @keydown.enter="emit('confirm')"
          />
        </div>
        <div class="tm-form-checkbox">
          <label>
            <input v-model="state.setAsAlias" type="checkbox" />
            合并后将原名 "{{ state.sourceLabel }}" 沉淀为别名
          </label>
        </div>
      </div>
      <div class="tm-modal-footer">
        <button class="b3-button b3-button--cancel" @click="emit('close')">取消</button>
        <button class="b3-button b3-button--primary" :disabled="state.executing" @click="emit('confirm')">
          {{ state.executing ? '正在合并中...' : '确认合并' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';
import type { IMergeModalState } from '../../types/ui';

defineProps<{
  state: IMergeModalState;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm'): void;
}>();
</script>
