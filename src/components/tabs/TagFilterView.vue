<template>
  <div class="tm-tab-content">
    <!-- 智能保存视图管理 -->
    <div class="tm-views-toolbar">
      <div class="tm-views-select-row">
        <SyLineIcon name="bookmark-star" :size="14" class="tm-views-icon" />
        <select
          :value="selectedSmartViewId"
          class="b3-select tm-views-select"
          @change="onSmartViewChange"
        >
          <option value="">-- 选择或切换常用智能视图 --</option>
          <option v-for="v in savedViews" :key="v.id" :value="v.id">
            {{ v.title }}
          </option>
        </select>
        <button
          class="tm-icon-btn tm-btn-sm"
          :disabled="isFilterEmpty"
          v-tooltip="'将当前组合保存为智能视图'"
          aria-label="保存为智能视图"
          @click="emit('open-save-view')"
        >
          <SyLineIcon name="save" :size="13" />
        </button>
      </div>
    </div>

    <!-- 激活的筛选条件池 (紧凑胶囊) 与候选标签区域 -->
    <div
      ref="filterBoxRef"
      class="tm-filter-box"
      :class="{
        'is-custom-height': filterBoxHeight !== null,
        'is-resizing': isResizingFilterBox
      }"
      :style="filterBoxStyle"
    >
      <div class="tm-filter-header">
        <div class="tm-filter-header-left">
          <span class="tm-section-hint-label">筛选模式：</span>
          <div class="tm-filter-mode-switch" role="group" aria-label="候选标签添加模式">
            <button
              type="button"
              class="tm-mode-btn tm-mode-btn--inc"
              :class="{ active: currentMode === 'include' }"
              v-tooltip="'点击候选标签添加为 AND (必含)'"
              @click="handleModeButtonClick('include')"
            >
              AND 必含
            </button>
            <button
              type="button"
              class="tm-mode-btn tm-mode-btn--opt"
              :class="{ active: currentMode === 'optional' }"
              v-tooltip="'点击候选标签添加为 OR (可选，命中任一标签即可)'"
              @click="handleModeButtonClick('optional')"
            >
              OR 可选
            </button>
            <button
              type="button"
              class="tm-mode-btn tm-mode-btn--exc"
              :class="{ active: currentMode === 'exclude' }"
              v-tooltip="'点击候选标签添加为 NOT (排除)'"
              @click="handleModeButtonClick('exclude')"
            >
              NOT 排除
            </button>
          </div>
        </div>
        <button
          class="b3-button b3-button--text tm-clear-filter-btn"
          :disabled="isFilterEmpty"
          v-tooltip="'清空当前所有已选择的标签'"
          @click="emit('clear-filter')"
        >
          <SyLineIcon name="trash" :size="11" />
          <span>清空</span>
        </button>
      </div>
      <div class="tm-active-chips">
        <!-- 必含标签 (AND) -->
        <div
          v-for="tag in activeFilter.includeTags"
          :key="`inc-${tag}`"
          class="tm-chip tm-chip--inc"
          v-tooltip="'点击切换为 OR (可选)'"
          @click="emit('toggle-condition', tag, 'optional')"
        >
          <span class="tm-chip-indicator"></span>
          <span class="tm-chip-prefix">AND</span>
          <span class="tm-chip-label">#{{ tag }}</span>
          <span class="tm-chip-remove" v-tooltip="'移除此条件'" @click.stop="emit('remove-tag', tag)">
            <SyLineIcon name="close" :size="10" />
          </span>
        </div>

        <!-- 可选标签 (OR) -->
        <div
          v-for="tag in activeFilter.optionalTags || []"
          :key="`opt-${tag}`"
          class="tm-chip tm-chip--opt"
          v-tooltip="'点击切换为 NOT (排除)'"
          @click="emit('toggle-condition', tag, 'exclude')"
        >
          <span class="tm-chip-indicator"></span>
          <span class="tm-chip-prefix">OR</span>
          <span class="tm-chip-label">#{{ tag }}</span>
          <span class="tm-chip-remove" v-tooltip="'移除此条件'" @click.stop="emit('remove-tag', tag)">
            <SyLineIcon name="close" :size="10" />
          </span>
        </div>

        <!-- 排除标签 (NOT) -->
        <div
          v-for="tag in activeFilter.excludeTags"
          :key="`exc-${tag}`"
          class="tm-chip tm-chip--exc"
          v-tooltip="'点击切换为 AND (必含)'"
          @click="emit('toggle-condition', tag, 'include')"
        >
          <span class="tm-chip-indicator"></span>
          <span class="tm-chip-prefix">NOT</span>
          <span class="tm-chip-label">#{{ tag }}</span>
          <span class="tm-chip-remove" v-tooltip="'移除此条件'" @click.stop="emit('remove-tag', tag)">
            <SyLineIcon name="close" :size="10" />
          </span>
        </div>

        <!-- 空占位指示 -->
        <div v-if="isFilterEmpty" class="tm-filter-placeholder">
          <SyLineIcon name="filter-funnel" :size="12" style="margin-right: 5px; opacity: 0.7;" />
          <span>点击下方候选标签，展开多维交叉组合检索（支持 AND/OR/NOT）</span>
        </div>
      </div>

      <!-- 快速候选标签与搜索添加流 (可折叠 / 可拖拽拉伸高度消除滚动条) -->
      <div class="tm-quick-tags-wrapper">
        <!-- 搜索添加输入框 -->
        <div class="tm-filter-search-row">
          <div class="tm-search-box fn__flex-1">
            <SyLineIcon name="search" :size="13" class="tm-search-icon" />
            <input
              v-model="searchKeyword"
              class="b3-text-field tm-search-input"
              :class="{ 'has-create-hint': Boolean(searchKeyword.trim()) }"
              placeholder="搜索标签并回车添加（支持拼音首字母如 ytb）..."
              @keydown.enter.prevent="handleSearchEnter"
              @keydown.esc="searchKeyword = ''"
            />
            <span
              v-if="searchKeyword.trim()"
              class="tm-search-enter-badge"
              :class="`tm-search-enter-badge--${currentMode}`"
              v-tooltip="`按 Enter 回车添加为 ${modeText} 条件`"
              @click="handleSearchEnter"
            >
              <SyLineIcon name="corner-down-left" :size="9" />
              <span>+ {{ currentMode.toUpperCase() }}</span>
            </span>
            <button
              v-if="searchKeyword"
              class="tm-icon-btn tm-clear-btn"
              v-tooltip="'清空搜索'"
              @click="searchKeyword = ''"
            >
              <SyLineIcon name="close" :size="12" />
            </button>
          </div>
        </div>

        <div
          ref="quickTagsRef"
          class="tm-quick-tags"
          :class="{ 'is-expanded': isExpandedTags }"
        >
          <span
            v-for="tag in displayCandidateTags"
            :key="tag.label"
            class="tm-quick-tag"
            :class="{
              'is-included': activeFilter.includeTags.includes(tag.label),
              'is-optional': (activeFilter.optionalTags || []).includes(tag.label),
              'is-excluded': activeFilter.excludeTags.includes(tag.label)
            }"
            @click="onQuickTagClick(tag.label)"
          >
            #{{ tag.label }} <small>({{ tag.count }})</small>
          </span>

          <div v-if="searchKeyword.trim() && displayCandidateTags.length === 0" class="tm-search-no-match">
            <span>未找到匹配标签，按回车直接将「#{{ searchKeyword.trim().replace(/^#+|#+$/g, '') }}#」加入 {{ modeText }}</span>
          </div>
        </div>
        <button
          v-if="!searchKeyword.trim() && allTags.length > 12"
          class="tm-quick-expand-btn"
          @click="expandQuickTags = !expandQuickTags"
        >
          {{ expandQuickTags ? '收起候选' : `展开全部 (${allTags.length})` }}
          <SyLineIcon :name="expandQuickTags ? 'chevron-down' : 'chevron-right'" :size="10" />
        </button>
      </div>

      <!-- 标签区域底边拖拽手柄：向下拖动扩大可见区域，消除滚动条 -->
      <div
        class="tm-filter-resizer"
        :class="{ 'is-active': isResizingFilterBox }"
        v-tooltip="'向下拖动扩大可见区域，消除滚动条；双击自适应内容'"
        @mousedown="startFilterBoxResize"
        @dblclick="resetFilterBoxHeight"
      >
        <div class="tm-resizer-line"></div>
      </div>
    </div>

    <!-- 检索结果卡片流 -->
    <div class="tm-results-header">
      <span>匹配结果：<b>{{ matchedBlocks.length }}</b> 条记录</span>
      <span v-if="queryLoading" class="tm-loading-indicator">
        <SyLineIcon name="refresh-cw" :size="12" :spin="true" />
        <span>检索中...</span>
      </span>
    </div>
    <div class="tm-card-stream">
      <div v-if="matchedBlocks.length === 0 && !queryLoading" class="tm-empty-state">
        <SyLineIcon name="filter-funnel" :size="28" class="tm-empty-icon" />
        <div class="tm-empty-text">没有符合多维组合条件的块记录</div>
      </div>
      <div
        v-for="block in matchedBlocks"
        :key="block.id"
        class="tm-card"
        @click="emit('jump-block', block.rootId, block.id)"
      >
        <div class="tm-card-doc">
          <SyLineIcon :name="block.type === 'd' ? 'file-text' : 'file-up'" :size="13" class="tm-doc-icon" />
          <span>{{ block.docTitle }}</span>
          <span v-if="block.type === 'd'" class="tm-doc-badge">文档</span>
        </div>
        <div class="tm-card-content" v-html="highlightTags(block.content || block.markdown)"></div>
        <div class="tm-card-footer">
          <span class="tm-card-time">{{ block.updated }}</span>
          <span class="tm-card-jump">
            <span>定位跳转</span>
            <SyLineIcon name="external-link" :size="11" />
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { ITagItem, ITagMatchedBlock, ISmartTagView, TagFilterConditionMode } from '../../types/tag';
import { TagPinyinAliasService } from '../../services/TagPinyinAliasService';
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';

const props = defineProps<{
  allTags: ITagItem[];
  activeFilter: {
    includeTags: string[];
    excludeTags: string[];
    optionalTags?: string[];
  };
  matchedBlocks: ITagMatchedBlock[];
  queryLoading: boolean;
  savedViews: ISmartTagView[];
  selectedSmartViewId: string;
}>();

const emit = defineEmits<{
  (e: 'update:selectedSmartViewId', id: string): void;
  (e: 'apply-smart-view'): void;
  (e: 'open-save-view'): void;
  (e: 'clear-filter'): void;
  (e: 'switch-filter-mode', mode: 'include' | 'optional'): void;
  (e: 'toggle-condition', tag: string, targetState: TagFilterConditionMode): void;
  (e: 'cycle-condition', tag: string): void;
  (e: 'remove-tag', tag: string): void;
  (e: 'toggle-tag', tag: string, mode?: TagFilterConditionMode): void;
  (e: 'jump-block', rootId: string, blockId: string): void;
}>();

const currentMode = ref<TagFilterConditionMode>('include');
const searchKeyword = ref('');

// 自动根据 activeFilter 中的正向标签分布同步当前激活模式
watch(
  [() => props.activeFilter.includeTags?.length || 0, () => (props.activeFilter.optionalTags || []).length || 0],
  ([incLen, optLen]) => {
    if (optLen > 0 && incLen === 0 && currentMode.value !== 'exclude') {
      currentMode.value = 'optional';
    } else if (incLen > 0 && optLen === 0 && currentMode.value !== 'exclude') {
      currentMode.value = 'include';
    }
  },
  { immediate: true }
);

function handleModeButtonClick(mode: TagFilterConditionMode) {
  currentMode.value = mode;
}

const isFilterEmpty = computed(() => {
  return (
    (props.activeFilter.includeTags?.length || 0) === 0 &&
    (props.activeFilter.excludeTags?.length || 0) === 0 &&
    (props.activeFilter.optionalTags?.length || 0) === 0
  );
});

const modeText = computed(() => {
  if (currentMode.value === 'include') return 'AND (必含)';
  if (currentMode.value === 'optional') return 'OR (可选)';
  return 'NOT (排除)';
});

function onQuickTagClick(label: string) {
  emit('toggle-tag', label, currentMode.value);
}

const filterBoxRef = ref<HTMLElement | null>(null);
const quickTagsRef = ref<HTMLElement | null>(null);
const isResizingFilterBox = ref(false);
const expandQuickTags = ref(false);

const filterBoxHeight = ref<number | null>(() => {
  try {
    const saved = localStorage.getItem('siyuan_tm_filter_box_height');
    if (saved) {
      const val = parseInt(saved, 10);
      if (!isNaN(val) && val >= 80 && val <= 1600) return val;
    }
  } catch {}
  return null;
});

const filterBoxStyle = computed(() => {
  if (filterBoxHeight.value !== null) {
    return {
      height: `${filterBoxHeight.value}px`,
      maxHeight: 'none',
      flexShrink: '0',
    };
  }
  return {};
});

const displayCandidateTags = computed<ITagItem[]>(() => {
  const kw = searchKeyword.value.trim();
  if (!kw) {
    if (expandQuickTags.value || filterBoxHeight.value !== null) {
      return props.allTags;
    }
    return props.allTags.slice(0, 12);
  }
  const matches = TagPinyinAliasService.matchTags(props.allTags, kw, 50);
  return matches.map(m => m.tag);
});

const isExpandedTags = computed(() => {
  return Boolean(searchKeyword.value.trim()) || expandQuickTags.value || filterBoxHeight.value !== null;
});

function handleSearchEnter() {
  const raw = searchKeyword.value.trim();
  const kw = raw.replace(/^#+|#+$/g, '').trim();
  if (!kw) return;

  if (displayCandidateTags.value.length > 0) {
    const targetTag = displayCandidateTags.value[0];
    emit('toggle-tag', targetTag.label, currentMode.value);
    searchKeyword.value = '';
    return;
  }

  emit('toggle-tag', kw, currentMode.value);
  searchKeyword.value = '';
}

function onSmartViewChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  emit('update:selectedSmartViewId', target.value);
  emit('apply-smart-view');
}

function startFilterBoxResize(e: MouseEvent) {
  e.preventDefault();
  isResizingFilterBox.value = true;
  const startY = e.clientY;
  const startH = filterBoxRef.value ? filterBoxRef.value.offsetHeight : 120;
  expandQuickTags.value = true;

  const onMouseMove = (moveEvt: MouseEvent) => {
    const deltaY = moveEvt.clientY - startY;
    const maxAllowed = Math.max(200, Math.round(window.innerHeight * 0.8));
    const newH = Math.max(90, Math.min(maxAllowed, startH + deltaY));
    filterBoxHeight.value = Math.round(newH);
  };

  const onMouseUp = () => {
    isResizingFilterBox.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    if (filterBoxHeight.value) {
      try {
        localStorage.setItem('siyuan_tm_filter_box_height', String(filterBoxHeight.value));
      } catch {}
    }
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function resetFilterBoxHeight() {
  if (filterBoxHeight.value !== null) {
    filterBoxHeight.value = null;
    expandQuickTags.value = false;
    try {
      localStorage.removeItem('siyuan_tm_filter_box_height');
    } catch {}
  } else {
    expandQuickTags.value = true;
    nextTick(() => {
      if (filterBoxRef.value && quickTagsRef.value) {
        const extra = Math.max(0, quickTagsRef.value.scrollHeight - quickTagsRef.value.clientHeight);
        const targetH = Math.min(
          Math.round(window.innerHeight * 0.75),
          filterBoxRef.value.offsetHeight + extra + 8
        );
        filterBoxHeight.value = targetH;
        try {
          localStorage.setItem('siyuan_tm_filter_box_height', String(targetH));
        } catch {}
      }
    });
  }
}

function highlightTags(text: string): string {
  if (!text) return '';
  return text.replace(/#([^#]+)#/g, '<span class="tm-matched-tag">#$1#</span>');
}
</script>
