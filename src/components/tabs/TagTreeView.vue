<template>
  <div class="tm-tab-content">
    <!-- 搜索、排序与展开/收起工具栏 -->
    <div class="tm-filter-bar">
      <div class="tm-search-box fn__flex-1">
        <SyLineIcon name="search" :size="13" class="tm-search-icon" />
        <input
          v-model="searchKeyword"
          class="b3-text-field tm-search-input"
          placeholder="搜索标签（支持拼音首字母如 ytb、别名）..."
        />
        <button
          v-if="searchKeyword"
          class="tm-icon-btn tm-clear-btn"
          v-tooltip="'清空搜索'"
          @click="searchKeyword = ''"
        >
          <SyLineIcon name="close" :size="12" />
        </button>
      </div>

      <div class="tm-filter-tools">
        <button
          class="tm-icon-btn tm-btn-sm"
          v-tooltip="allCollapsed ? '展开所有层级' : '折叠所有层级'"
          @click="toggleCollapseAll"
        >
          <SyLineIcon :name="allCollapsed ? 'chevron-right' : 'chevron-down'" :size="13" />
        </button>
        <select v-model="sortMode" class="b3-select tm-sort-select">
          <option value="count_desc">引用数 (多→少)</option>
          <option value="count_asc">引用数 (少→多)</option>
          <option value="name_asc">拼音 (A→Z)</option>
          <option value="name_desc">拼音 (Z→A)</option>
        </select>
      </div>
    </div>

    <!-- 标签组预设套件折叠区 -->
    <div class="tm-groups-section">
      <div class="tm-groups-header" @click="groupsExpanded = !groupsExpanded">
        <div class="tm-groups-title">
          <SyLineIcon :name="groupsExpanded ? 'chevron-down' : 'chevron-right'" :size="11" />
          <SyLineIcon name="layers-plus" :size="13" class="tm-groups-icon" />
          <span>常用标签组</span>
          <span class="tm-groups-badge">{{ (tagGroups || []).length }}</span>
        </div>
        <div class="tm-groups-header-actions" @click.stop>
          <button
            class="tm-icon-btn tm-btn-xs"
            v-tooltip="'新建常用标签组'"
            @click="emit('open-create-group')"
          >
            <SyLineIcon name="plus" :size="11" />
          </button>
        </div>
      </div>

      <div v-show="groupsExpanded" class="tm-groups-body">
        <div v-if="!tagGroups || tagGroups.length === 0" class="tm-groups-empty">
          <span>暂无标签组，点击右上角 + 创建常用标签套件</span>
        </div>
        <div v-else class="tm-groups-list">
          <div
            v-for="group in tagGroups"
            :key="group.id"
            class="tm-group-card"
          >
            <div class="tm-group-card-header">
              <span class="tm-group-color-dot" :style="{ backgroundColor: group.color || 'var(--b3-theme-primary)' }"></span>
              <span class="tm-group-name" :title="group.name">{{ group.name }}</span>
              <span class="tm-group-count">{{ group.tags.length }} 标</span>

              <div class="tm-group-card-actions">
                <button
                  class="tm-group-apply-btn"
                  v-tooltip="'套用此组到当前打开的文档/焦点块'"
                  @click="emit('apply-group', group)"
                >
                  <SyLineIcon name="tag" :size="10" />
                  <span>套用</span>
                </button>
                <button
                  class="tm-icon-btn tm-btn-xs"
                  v-tooltip="'编辑标签组'"
                  @click="emit('open-edit-group', group)"
                >
                  <SyLineIcon name="edit" :size="10" />
                </button>
                <button
                  class="tm-icon-btn tm-btn-xs tm-btn-danger"
                  v-tooltip="'删除标签组'"
                  @click="emit('delete-group', group.id)"
                >
                  <SyLineIcon name="trash" :size="10" />
                </button>
              </div>
            </div>

            <div v-if="group.tags.length > 0" class="tm-group-card-tags">
              <span
                v-for="t in group.tags.slice(0, 5)"
                :key="t"
                class="tm-group-tag-pill"
                @click.stop="emit('tag-click', t, $event)"
              >
                #{{ t }}#
              </span>
              <span v-if="group.tags.length > 5" class="tm-group-tag-more">
                +{{ group.tags.length - 5 }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 多选状态控制横条 -->
    <div v-if="selectedTags && selectedTags.length > 0" class="tm-selection-bar">
      <div class="tm-selection-info">
        <SyLineIcon name="check-circle" :size="13" class="tm-selection-icon" />
        <span class="tm-selection-text">
          已多选 <strong>{{ selectedTags.length }}</strong> 个标签
        </span>
      </div>
      <div class="tm-selection-actions">
        <button
          class="tm-view-filter-btn"
          v-tooltip="'跳转至多维筛选查看匹配块记录'"
          @click="emit('switch-to-filter')"
        >
          <SyLineIcon name="filter-funnel" :size="12" />
          <span>查看结果</span>
        </button>
        <button
          class="tm-clear-filter-btn"
          v-tooltip="'清空已选筛选标签'"
          @click="emit('clear-selected')"
        >
          <SyLineIcon name="close" :size="12" />
          <span>清空</span>
        </button>
      </div>
    </div>

    <!-- 标签树列表 -->
    <div class="tm-tree-scroller">
      <div v-if="displayTreeNodes.length === 0" class="tm-empty-state">
        <SyLineIcon name="folder-tree" :size="32" class="tm-empty-icon" />
        <div class="tm-empty-text">
          {{ loading ? '正在加载标签资产...' : '未匹配到任何相关标签' }}
        </div>
      </div>
      <div v-else class="tm-tree-nodes">
        <div
          v-for="node in displayTreeNodes"
          v-show="isNodeVisible(node)"
          :key="node.label"
          class="tm-tree-node"
          :class="{ 'is-selected': isTagSelected(node.label) }"
          :style="{ paddingLeft: `${node.depth * 14 + 6}px` }"
        >
          <!-- 展开/折叠箭头指示 -->
          <span
            class="tm-node-expander"
            :class="{ 'is-leaf': !hasSubTags(node.label) }"
            @click.stop="toggleNodeCollapse(node.label)"
          >
            <SyLineIcon
              v-if="hasSubTags(node.label)"
              :name="collapsedSet.has(node.label) ? 'chevron-right' : 'chevron-down'"
              :size="11"
            />
          </span>

          <!-- 节点主内容 -->
          <div class="tm-node-content" @click="emit('tag-click', node.label, $event)">
            <span
              class="tm-node-name"
              :style="getTagStyle(node.label)"
              :title="formatNodeTitle(node.label)"
            >
              <!-- 选中指示勾选标记 -->
              <span v-if="isTagSelected(node.label)" class="tm-selected-check" v-tooltip="'已加入筛选条件'">
                <SyLineIcon name="check" :size="12" />
              </span>
              <span v-else-if="getTagIcon(node.label)" class="tm-custom-icon">{{ getTagIcon(node.label) }}</span>
              <SyLineIcon v-else name="hash" :size="12" class="tm-default-hash" />
              {{ node.name }}
            </span>
            <span class="tm-node-count" v-tooltip="formatNodeTooltip(node)">{{ node.count }}</span>
          </div>

          <!-- 渐进式暴露操作区：仅暴露高频筛选 + 更多菜单 -->
          <div class="tm-node-actions">
            <button
              class="tm-icon-btn tm-action-btn"
              v-tooltip="'加入即时组合筛选 (AND)'"
              @click.stop="emit('quick-filter', node.label, true)"
            >
              <SyLineIcon name="search-plus" :size="13" />
            </button>
            <button
              class="tm-icon-btn tm-action-btn"
              v-tooltip="'更多操作选项'"
              @click.stop="emit('open-menu', node.label, $event)"
            >
              <SyLineIcon name="more-horizontal" :size="13" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ITagItem, ITagGroup } from '../../types/tag';
import { TagTreeService, type TagSortMode } from '../../services/TagTreeService';
import { TagPinyinAliasService } from '../../services/TagPinyinAliasService';
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';

const props = withDefaults(
  defineProps<{
    allTags: ITagItem[];
    loading: boolean;
    getTagStyle: (label: string) => Record<string, string>;
    getTagIcon: (label: string) => string;
    selectedTags?: string[];
    tagGroups?: ITagGroup[];
  }>(),
  {
    selectedTags: () => [],
    tagGroups: () => [],
  }
);

const emit = defineEmits<{
  (e: 'tag-click', label: string, event: MouseEvent): void;
  (e: 'quick-filter', label: string, append: boolean): void;
  (e: 'open-menu', label: string, event: MouseEvent): void;
  (e: 'clear-selected'): void;
  (e: 'switch-to-filter'): void;
  (e: 'open-create-group'): void;
  (e: 'open-edit-group', group: ITagGroup): void;
  (e: 'delete-group', groupId: string): void;
  (e: 'apply-group', group: ITagGroup): void;
}>();

const searchKeyword = ref('');
const sortMode = ref<TagSortMode>('count_desc');
const collapsedSet = ref<Set<string>>(new Set());
const allCollapsed = ref(false);
const groupsExpanded = ref(false);

const selectedTagSet = computed(() => new Set(props.selectedTags || []));

function isTagSelected(label: string): boolean {
  return selectedTagSet.value.has(label);
}

function formatNodeTitle(label: string): string {
  if (isTagSelected(label)) {
    return `${label}（已加入筛选；点击仅单选此项，按住 Ctrl/Shift 可取消选择）`;
  }
  return `${label}（点击仅单选并跳转，按住 Ctrl/Shift 可多选加入筛选）`;
}

const displayTreeNodes = computed(() => {
  if (!searchKeyword.value.trim()) {
    return TagTreeService.buildTree(props.allTags, sortMode.value);
  }
  const matches = TagPinyinAliasService.matchTags(props.allTags, searchKeyword.value, 50);
  return TagTreeService.buildTree(matches.map(m => m.tag), sortMode.value);
});

function hasSubTags(label: string): boolean {
  return props.allTags.some(t => t.label.startsWith(`${label}/`) && t.label !== label);
}

function toggleNodeCollapse(label: string) {
  if (collapsedSet.value.has(label)) {
    collapsedSet.value.delete(label);
  } else {
    collapsedSet.value.add(label);
  }
}

function isNodeVisible(node: ITagItem): boolean {
  if (searchKeyword.value.trim()) return true;
  const parts = node.label.split('/');
  for (let i = 1; i < parts.length; i++) {
    const parent = parts.slice(0, i).join('/');
    if (collapsedSet.value.has(parent)) {
      return false;
    }
  }
  return true;
}

function toggleCollapseAll() {
  allCollapsed.value = !allCollapsed.value;
  if (allCollapsed.value) {
    props.allTags.forEach(t => {
      if (hasSubTags(t.label)) {
        collapsedSet.value.add(t.label);
      }
    });
  } else {
    collapsedSet.value.clear();
  }
}

function formatNodeTooltip(node: ITagItem): string {
  if (node.docCount !== undefined && node.blockCount !== undefined) {
    return `全库关联 ${node.docCount} 个文档，${node.blockCount} 处块引用`;
  }
  return `全库共 ${node.count} 处引用`;
}
</script>
