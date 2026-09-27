<template>
  <div v-if="state.visible" class="tm-modal-mask" @click.self="emit('close')">
    <div class="tm-modal-card" style="width: 500px; max-width: 95vw;">
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
          <div v-else class="tm-section-hint">
            当前组内暂无标签，请在下方点击候选标签或搜索添加。
          </div>
        </div>

        <!-- 搜索与候选标签池 -->
        <div class="tm-form-group tm-candidate-group">
          <div class="tm-candidate-header">
            <label>添加标签至该组（点击候选标签快速加入）：</label>
            <span v-if="candidateTotalCount > 0" class="tm-candidate-count-hint">
              共 {{ candidateTotalCount }} 个可用候选
            </span>
          </div>

          <div class="fn__flex" style="margin-bottom: 8px;">
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

          <!-- 快速候选候选池，留出更多充裕空间展示 -->
          <div v-if="filteredCandidateTags.length > 0" class="tm-quick-candidate-list">
            <button
              v-for="item in filteredCandidateTags"
              :key="item.label"
              type="button"
              class="tm-candidate-tag-btn"
              :title="`点击将 #${item.label}# 加入标签组`"
              @click="addTagToGroup(item.label)"
            >
              <SyLineIcon name="plus" :size="10" />
              <span class="candidate-text">#{{ item.label }}#</span>
              <span class="candidate-count">({{ item.count }})</span>
            </button>
          </div>
          <div v-else-if="searchTagText.trim()" class="tm-section-hint tm-candidate-empty">
            未找到匹配的已有标签，按回车或点击【添加】可直接创建新标签 "#{{ searchTagText.trim() }}#"
          </div>
          <div v-else class="tm-section-hint tm-candidate-empty">
            库内暂无更多可选候选标签或所有标签均已加入此组。
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

const candidateTotalCount = computed(() => {
  const existingSet = new Set(props.state.tags);
  return props.allTags.filter(t => !existingSet.has(t.label)).length;
});

const filteredCandidateTags = computed(() => {
  const q = searchTagText.value.trim().toLowerCase();
  const existingSet = new Set(props.state.tags);
  return props.allTags
    .filter(t => !existingSet.has(t.label) && (!q || t.label.toLowerCase().includes(q)))
    .slice(0, 100);
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
  max-height: 96px;
  overflow-y: auto;
  padding: 6px;
  background-color: var(--b3-theme-background-light);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
}

.tm-group-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  font-size: 12px;
  font-weight: 500;
  background-color: var(--tm-badge-primary-bg, #ebf3fe);
  color: var(--tm-badge-primary-text, #1a56db);
  border: 1px solid var(--tm-badge-primary-border, rgba(26, 86, 219, 0.22));
  border-radius: 4px;

  .chip-text {
    line-height: 1.3;
  }

  .chip-del-btn {
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    color: inherit;
    opacity: 0.75;
    display: inline-flex;
    align-items: center;

    &:hover {
      opacity: 1;
      color: var(--tm-badge-danger-text, #b91c1c);
    }
  }
}

.tm-candidate-group {
  margin-top: 12px;
}

.tm-candidate-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;

  label {
    margin-bottom: 0;
  }

  .tm-candidate-count-hint {
    font-size: 12px;
    color: var(--b3-theme-on-surface);
    opacity: 0.65;
  }
}

.tm-quick-candidate-list {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 6px;
  max-height: 190px;
  min-height: 80px;
  overflow-y: auto;
  padding: 8px;
  background-color: var(--b3-theme-background-light);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
}

.tm-candidate-tag-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  font-size: 12px;
  border: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;

  &:hover {
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
    background-color: var(--b3-theme-background);
    transform: translateY(-1px);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .candidate-text {
    line-height: 1.3;
  }

  .candidate-count {
    opacity: 0.65;
    font-size: 11px;
  }
}

.tm-candidate-empty {
  padding: 18px 12px;
  text-align: center;
  border: 1px dashed var(--b3-border-color);
  border-radius: 6px;
  background-color: var(--b3-theme-background-light);
}
</style>
