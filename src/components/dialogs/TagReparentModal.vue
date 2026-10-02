<template>
  <div v-if="visible" class="tm-modal-mask" @click.self="emit('close')">
    <div class="tm-modal-card" style="max-width: 440px;">
      <div class="tm-modal-title">
        <SyLineIcon name="corner-down-right" :size="16" />
        <span>配置子标签与层级归属</span>
      </div>

      <div class="tm-modal-body">
        <div style="margin-bottom: 12px; font-size: 12px; color: var(--b3-theme-on-surface);">
          将标签 <strong style="color: var(--b3-theme-primary);">#{{ sourceLabel }}#</strong> 移入以下父标签之下：
        </div>

        <!-- 目标父标签搜索框 -->
        <div class="tm-form-group" style="margin-bottom: 8px;">
          <input
            v-model="searchKeyword"
            class="b3-text-field fn__block"
            placeholder="搜索目标父标签..."
            autofocus
            @keydown.esc="emit('close')"
          />
        </div>

        <!-- 候选目标列表 -->
        <div class="tm-reparent-list" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--b3-border-color); border-radius: 4px; padding: 4px;">
          <!-- 选项 1：恢复为根层级 (若当前已为多级子标签) -->
          <div
            v-if="sourceLabel.includes('/')"
            class="tm-reparent-item"
            :class="{ 'is-active': selectedParent === null }"
            @click="selectedParent = null"
          >
            <SyLineIcon name="folder-tree" :size="13" />
            <span style="font-weight: 600;">[设为顶级根标签 (脱离当前父级)]</span>
          </div>

          <!-- 候选标签 -->
          <div
            v-for="tag in filteredCandidates"
            :key="tag.label"
            class="tm-reparent-item"
            :class="{ 'is-active': selectedParent === tag.label }"
            @click="selectedParent = tag.label"
          >
            <SyLineIcon name="tag" :size="12" />
            <span class="fn__flex-1" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">#{{ tag.label }}#</span>
            <span style="font-size: 10px; color: var(--b3-theme-on-surface-light);">{{ tag.count }} 次引用</span>
          </div>

          <div v-if="filteredCandidates.length === 0 && !sourceLabel.includes('/')" style="text-align: center; padding: 12px; font-size: 11px; color: var(--b3-theme-on-surface-light);">
            未找到可作为父级的有效标签
          </div>
        </div>

        <!-- 预览结果 -->
        <div style="margin-top: 10px; padding: 8px 10px; border-radius: 4px; background: var(--b3-theme-background-light); font-size: 11px;">
          <div style="color: var(--b3-theme-on-surface-light); margin-bottom: 3px;">预期调整结果：</div>
          <div style="font-weight: 600; color: var(--b3-theme-primary);">
            #{{ sourceLabel }}# ➔ #{{ previewPath }}#
          </div>
        </div>
      </div>

      <div class="tm-modal-footer">
        <button class="b3-button b3-button--cancel" @click="emit('close')">取消</button>
        <button
          class="b3-button b3-button--primary"
          :disabled="selectedParent === undefined || previewPath === sourceLabel"
          @click="handleConfirm"
        >
          确认纳入暂存
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ITagItem } from '../../types/tag';
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';

const props = defineProps<{
  visible: boolean;
  sourceLabel: string;
  allTags: ITagItem[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', targetParentLabel: string | null): void;
}>();

const searchKeyword = ref('');
const selectedParent = ref<string | null | undefined>(undefined);

watch(
  () => props.visible,
  (val) => {
    if (val) {
      searchKeyword.value = '';
      selectedParent.value = undefined;
    }
  }
);

// 过滤候选标签：不能是自身，也不能是自身的子孙节点
const filteredCandidates = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  const prefix = `${props.sourceLabel}/`;

  return props.allTags.filter((t) => {
    if (t.label === props.sourceLabel) return false;
    if (t.label.startsWith(prefix)) return false;
    if (kw && !t.label.toLowerCase().includes(kw)) return false;
    return true;
  });
});

const leafName = computed(() => {
  const parts = props.sourceLabel.split('/');
  return parts[parts.length - 1];
});

const previewPath = computed(() => {
  if (selectedParent.value === null) {
    return leafName.value;
  }
  if (selectedParent.value) {
    return `${selectedParent.value}/${leafName.value}`;
  }
  return props.sourceLabel;
});

function handleConfirm() {
  if (selectedParent.value === undefined || previewPath.value === props.sourceLabel) return;
  emit('confirm', selectedParent.value);
  emit('close');
}
</script>

<style scoped>
.tm-reparent-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  user-select: none;
}

.tm-reparent-item:hover {
  background: var(--b3-theme-background-light);
}

.tm-reparent-item.is-active {
  background: var(--b3-theme-primary-light, rgba(53, 116, 240, 0.15));
  color: var(--b3-theme-primary);
  font-weight: 600;
}
</style>
