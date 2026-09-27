<template>
  <div v-if="state.visible" class="tm-modal-mask" @click.self="emit('close')">
    <div class="tm-modal-card">
      <div class="tm-modal-title">
        <SyLineIcon name="edit" :size="16" />
        <span>标签重命名</span>
      </div>
      <div class="tm-modal-body">
        <p class="tm-modal-target">将原标签 <b>#{{ state.oldLabel }}#</b> 重命名为：</p>
        <div class="tm-form-group">
          <label>新规范标签名称：</label>
          <input
            ref="inputRef"
            v-model="inputLabel"
            class="b3-text-field fn__block"
            placeholder="例如：Vue3 或 tech/python"
            @keydown.enter="handleConfirm"
            @keydown.esc="emit('close')"
          />
          <div v-if="validationError" class="tm-form-error text-danger" style="margin-top: 6px; font-size: 12px;">
            {{ validationError }}
          </div>
        </div>
      </div>
      <div class="tm-modal-footer">
        <button class="b3-button b3-button--cancel" @click="emit('close')">取消</button>
        <button
          class="b3-button b3-button--primary"
          :disabled="state.executing || !!validationError || !inputLabel.trim()"
          @click="handleConfirm"
        >
          {{ state.executing ? '正在重命名...' : '确认重命名' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';
import type { IRenameModalState } from '../../types/ui';
import { TagGovernanceService } from '../../services/TagGovernanceService';

const props = defineProps<{
  state: IRenameModalState;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', newLabel: string): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const inputLabel = ref('');

watch(
  () => props.state.visible,
  (val) => {
    if (val) {
      inputLabel.value = props.state.newLabel || props.state.oldLabel;
      nextTick(() => {
        inputRef.value?.focus();
        inputRef.value?.select();
      });
    }
  },
  { immediate: true },
);

const validationError = computed(() => {
  const trimmed = inputLabel.value.trim();
  if (!trimmed) {
    return '标签名称不能为空';
  }
  if (trimmed === props.state.oldLabel) {
    return '新标签名称与原名称相同';
  }
  const check = TagGovernanceService.isValidLabel(trimmed);
  if (!check.valid) {
    return check.error || '标签名称格式不合法';
  }
  return '';
});

function handleConfirm() {
  if (validationError.value || !inputLabel.value.trim() || props.state.executing) {
    return;
  }
  emit('confirm', inputLabel.value.trim());
}
</script>
