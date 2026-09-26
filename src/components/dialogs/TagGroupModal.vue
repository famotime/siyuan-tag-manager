<template>
  <div v-if="state.visible" class="tm-modal-mask" @click.self="emit('close')">
    <div class="tm-modal-card" style="width: 480px; max-width: 95vw;">
      <div class="tm-modal-title">
        <SyLineIcon name="tag" :size="16" />
        <span>{{ state.isEdit ? '编辑标签组' : '新建标签组' }}</span>
      </div>

      <div class="tm-modal-body">
        <!-- 组名输入 -->
        <div class="tm-form-group">
          <label>标签组名称 <span style="color: var(--b3-theme-error);">*</span>：</label>
          <input
            v-model="state.name"
            class="b3-text-field fn__block"
            placeholder="例如：前端架构栈、待办事务组、设计规范"
            @keydown.enter="handleSave"
          />
        </div>

        <!-- 预设主题色选区 -->
        <div class="tm-form-group">
          <label>分组主题配色：</label>
          <div class="tm-color-palette-grid">
            <div
              v-for="preset in DUAL_THEME_COLOR_PRESETS"
              :key="preset.id"
              class="tm-preset-card"
              :class="{ 'is-selected': state.color === preset.lightText || state.color === preset.id }"
              @click="selectPresetColor(preset)"
            >
              <div class="tm-preset-preview">
                <span
                  class="tm-preset-chip light-chip"
                  :style="{ backgroundColor: preset.lightBg, color: preset.lightText, borderColor: preset.lightBorder }"
                >
                  Aa
                </span>
                <span
                  class="tm-preset-chip dark-chip"
                  :style="{ backgroundColor: preset.darkBg, color: preset.darkText, borderColor: preset.darkBorder }"
                >
                  Aa
                </span>
              </div>
              <span class="tm-preset-name">{{ preset.name }}</span>
            </div>
          </div>
        </div>

        <!-- 已绑定标签列表 -->
        <div class="tm-form-group">
          <label>组内标签 (共 {{ state.tags.length }} 个)：</label>
          <div v-if="state.tags.length > 0" class="tm-group-tags-chips">
            <span
              v-for="t in state.tags"
              :key="t"
              class="tm-group-tag-chip"
            >
              <span class="chip-text">#{{ t }}#</span>
              <button class="chip-del-btn" title="移除该标签" @click="removeTagFromGroup(t)">
                <SyLineIcon name="close" :size="10" />
              </button>
            </span>
          </div>
          <div v-else class="tm-section-hint" style="margin-bottom: 8px;">
            当前组内暂无标签，请在下方搜索选择或输入新增。
          </div>
        </div>

        <!-- 搜索添加已有标签或回车输入新标签 -->
        <div class="tm-form-group">
          <label>添加标签至该组（输入回车可创建新标签）：</label>
          <div class="fn__flex">
            <input
              v-model="searchTagText"
              class="b3-text-field fn__block fn__flex-1"
              placeholder="搜索或输入标签名，按回车添加..."
              @keydown.enter.prevent="addTypedTag"
            />
            <button
              class="b3-button b3-button--outline"
              style="margin-left: 8px;"
              :disabled="!searchTagText.trim()"
              @click="addTypedTag"
            >
              添加
            </button>
          </div>

          <!-- 快速候选候选池 -->
          <div v-if="filteredCandidateTags.length > 0" class="tm-quick-candidate-list">
            <button
              v-for="item in filteredCandidateTags"
              :key="item.label"
              class="tm-candidate-tag-btn"
              @click="addTagToGroup(item.label)"
            >
              <SyLineIcon name="plus" :size="10" />
              <span>#{{ item.label }}#</span>
              <span class="candidate-count">({{ item.count }})</span>
            </button>
          </div>
        </div>
      </div>

      <div class="tm-modal-footer">
        <button class="b3-button b3-button--cancel" @click="emit('close')">取消</button>
        <button
          class="b3-button b3-button--primary"
          :disabled="!state.name.trim()"
          @click="handleSave"
        >
          {{ state.isEdit ? '保存修改' : '创建标签组' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';
import { DUAL_THEME_COLOR_PRESETS, type IColorPreset } from '../../styles/palette';
import type { ITagItem } from '../../types/tag';
import type { ITagGroupModalState } from '../../types/ui';

const props = defineProps<{
  state: ITagGroupModalState;
  allTags: ITagItem[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', payload: { name: string; tags: string[]; color?: string; icon?: string }): void;
}>();

const searchTagText = ref('');

function selectPresetColor(preset: IColorPreset) {
  props.state.color = preset.lightText;
}

function removeTagFromGroup(tag: string) {
  props.state.tags = props.state.tags.filter(t => t !== tag);
}

function addTagToGroup(tag: string) {
  const clean = tag.replace(/^#+|#+$/g, '').trim();
  if (clean && !props.state.tags.includes(clean)) {
    props.state.tags.push(clean);
  }
}

function addTypedTag() {
  const clean = searchTagText.value.replace(/^#+|#+$/g, '').trim();
  if (clean) {
    addTagToGroup(clean);
    searchTagText.value = '';
  }
}

const filteredCandidateTags = computed(() => {
  const q = searchTagText.value.trim().toLowerCase();
  const existingSet = new Set(props.state.tags);
  return props.allTags
    .filter(t => !existingSet.has(t.label) && (!q || t.label.toLowerCase().includes(q)))
    .slice(0, 10);
});

function handleSave() {
  if (!props.state.name.trim()) return;
  emit('save', {
    name: props.state.name.trim(),
    tags: [...props.state.tags],
    color: props.state.color,
    icon: props.state.icon,
  });
}
</script>

<style scoped lang="scss">
.tm-group-tags-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 120px;
  overflow-y: auto;
  padding: 6px;
  background-color: var(--b3-theme-background-light);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
}

.tm-group-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 12px;
  background-color: var(--b3-theme-primary-light);
  color: var(--b3-theme-primary);
  border-radius: 4px;

  .chip-del-btn {
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
    display: inline-flex;
    align-items: center;

    &:hover {
      opacity: 1;
      color: var(--b3-theme-error);
    }
  }
}

.tm-quick-candidate-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
  max-height: 80px;
  overflow-y: auto;
}

.tm-candidate-tag-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  font-size: 11px;
  border: 1px dashed var(--b3-border-color);
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }

  .candidate-count {
    opacity: 0.6;
    font-size: 10px;
  }
}
</style>
