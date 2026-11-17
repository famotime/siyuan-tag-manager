<template>
  <div class="tm-tab-content">
    <!-- 统计面板 -->
    <div class="tm-health-dash">
      <div class="tm-health-score">
        <div
          class="tm-score-num"
          :class="{
            'is-good': healthResult.summary.healthyRate >= 90,
            'is-warn': healthResult.summary.healthyRate >= 70 && healthResult.summary.healthyRate < 90,
            'is-danger': healthResult.summary.healthyRate < 70
          }"
        >
          {{ healthResult.summary.healthyRate }}%
        </div>
        <div class="tm-score-lbl">健康度评分</div>
      </div>
      <div class="tm-stat-grid">
        <div
          class="tm-stat-card"
          :class="{ 'is-active': activeFilterCategory === 'low_frequency' }"
          v-tooltip="'点击筛选低频使用标签（含孤儿与单次引用）'"
          @click="toggleCategoryFilter('low_frequency')"
        >
          <div class="tm-stat-val text-info">
            <SyLineIcon name="info" :size="14" />
            <span>{{ healthResult.summary.lowFrequency ?? 0 }}</span>
          </div>
          <div class="tm-stat-lbl">低频使用</div>
        </div>
        <div
          class="tm-stat-card"
          :class="{ 'is-active': activeFilterCategory === 'similar_conflict' }"
          v-tooltip="'点击筛选相似冲突标签'"
          @click="toggleCategoryFilter('similar_conflict')"
        >
          <div class="tm-stat-val text-warning">
            <SyLineIcon name="alert-triangle" :size="14" />
            <span>{{ healthResult.summary.similarConflicts ?? healthResult.summary.caseConflicts ?? 0 }}</span>
          </div>
          <div class="tm-stat-lbl">相似冲突</div>
        </div>
        <div
          class="tm-stat-card"
          :class="{ 'is-active': activeFilterCategory === 'invalid_norm' }"
          v-tooltip="'点击筛选不合规范标签（斜杠/超长/超深/纯数字）'"
          @click="toggleCategoryFilter('invalid_norm')"
        >
          <div class="tm-stat-val text-danger">
            <SyLineIcon name="alert-triangle" :size="14" />
            <span>{{ healthResult.summary.invalidNorms ?? 0 }}</span>
          </div>
          <div class="tm-stat-lbl">不合规范</div>
        </div>
      </div>
    </div>

    <!-- 治理分类导航 / 标签体检清单 -->
    <div class="tm-issues-list">
      <div class="tm-section-header-title">
        <div class="tm-section-title-left">
          <span>标签规范与冲突治理</span>
          <span class="tm-section-badge">{{ filteredIssues.length }}</span>
        </div>
      </div>

      <div v-if="filteredIssues.length === 0" class="tm-empty-success">
        <SyLineIcon name="check-circle" :size="24" class="tm-success-icon" />
        <div>
          {{ activeFilterCategory === 'all' ? '太棒了！知识库标签体系非常规范，未发现相似冲突、不规范或低频使用标签！' : '当前分类下暂无问题标签！' }}
        </div>
      </div>
      <div
        v-for="issue in filteredIssues"
        :key="issue.primaryLabel + issue.type + (issue.subType || '')"
        class="tm-issue-card"
        :class="`is-${issue.severity}`"
      >
        <div class="tm-issue-icon">
          <SyLineIcon
            :name="issue.type === 'similar_conflict' || issue.type === 'case_conflict' ? 'alert-triangle' : (issue.type === 'invalid_norm' ? 'alert-triangle' : 'info')"
            :size="16"
          />
        </div>
        <div class="tm-issue-info">
          <div class="tm-issue-title">
            <span>{{ issue.primaryLabel }}</span>
            <span v-if="issue.subType" class="tm-issue-tag-sub">
              {{ formatSubType(issue.subType) }}
            </span>
          </div>
          <div class="tm-issue-desc">{{ issue.message }}</div>
        </div>
        <div class="tm-issue-op">
          <!-- 1. 一键合并相似规范 -->
          <button
            v-if="issue.suggestedAction === 'merge'"
            class="tm-icon-btn tm-btn-sm"
            v-tooltip="'一键合并规范：将所有相似变体合并至高频标准规范'"
            aria-label="一键合并规范"
            @click="emit('auto-resolve', issue)"
          >
            <SyLineIcon name="git-merge" :size="13" />
          </button>

          <!-- 2. 一键自动规范化（斜杠规整等） -->
          <button
            v-if="issue.suggestedAction === 'normalize' && issue.normalizedTarget"
            class="tm-icon-btn tm-btn-sm text-primary"
            v-tooltip="`一键规范化为「${issue.normalizedTarget}」`"
            aria-label="一键规范化"
            @click="emit('auto-normalize', issue.primaryLabel, issue.normalizedTarget)"
          >
            <SyLineIcon name="check-circle" :size="13" />
          </button>

          <!-- 3. 重命名 -->
          <button
            v-if="issue.suggestedAction === 'rename' || issue.type === 'invalid_norm'"
            class="tm-icon-btn tm-btn-sm"
            v-tooltip="'重命名：修改并规整此标签'"
            aria-label="重命名"
            @click="emit('open-rename', issue.primaryLabel)"
          >
            <SyLineIcon name="edit" :size="13" />
          </button>

          <!-- 4. 清理删除 -->
          <button
            v-if="issue.suggestedAction === 'clean' || issue.type === 'low_frequency' || issue.type === 'invalid_norm'"
            class="tm-icon-btn tm-btn-sm tm-btn-danger"
            v-tooltip="'清理删除：彻底清理并从全库移除此无用标签'"
            aria-label="清理删除"
            @click="emit('remove-tag', issue.primaryLabel)"
          >
            <SyLineIcon name="trash" :size="13" class="text-danger" />
          </button>
        </div>
      </div>
    </div>

    <!-- 引用识别为标签诊断器（自包含子组件） -->
    <TagRefPromotePanel :all-tags="allTags" @refresh-tags="$emit('refresh-tags')" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ITagHealthReport, ITagHealthIssue, ITagItem } from '../../types/tag';
import TagRefPromotePanel from './TagRefPromotePanel.vue';
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';

const props = withDefaults(
  defineProps<{
    healthResult: ITagHealthReport;
    allTags?: ITagItem[];
  }>(),
  {
    allTags: () => [],
  }
);

const emit = defineEmits<{
  (e: 'auto-resolve', issue: ITagHealthIssue): void;
  (e: 'remove-tag', label: string): void;
  (e: 'open-rename', label: string): void;
  (e: 'auto-normalize', label: string, target?: string): void;
  (e: 'refresh-tags'): void;
}>();

// 治理分类过滤状态
const activeFilterCategory = ref<'all' | 'similar_conflict' | 'invalid_norm' | 'low_frequency'>('all');

function toggleCategoryFilter(cat: 'similar_conflict' | 'invalid_norm' | 'low_frequency') {
  if (activeFilterCategory.value === cat) {
    activeFilterCategory.value = 'all';
  } else {
    activeFilterCategory.value = cat;
  }
}

const filteredIssues = computed(() => {
  const issues = props.healthResult?.issues || [];
  if (activeFilterCategory.value === 'all') {
    return issues;
  }
  if (activeFilterCategory.value === 'similar_conflict') {
    return issues.filter(i => i.type === 'similar_conflict' || i.type === 'case_conflict');
  }
  if (activeFilterCategory.value === 'invalid_norm') {
    return issues.filter(i => i.type === 'invalid_norm' || i.type === 'redundant_slash');
  }
  if (activeFilterCategory.value === 'low_frequency') {
    return issues.filter(i => i.type === 'low_frequency' || i.type === 'orphan');
  }
  return issues;
});

function formatSubType(subType?: string): string {
  switch (subType) {
    case 'case':
      return '大小写变体';
    case 'separator':
      return '风格分隔符';
    case 'typo':
      return '疑似拼写笔误';
    case 'slash':
      return '多余斜杠';
    case 'invalid_chars':
      return '非法字符';
    case 'length':
      return '超长异常';
    case 'depth':
      return '超深层级';
    case 'digits':
      return '纯数字/无语义';
    case 'zero_ref':
      return '0 引用孤儿';
    case 'single_ref':
      return '单次引用';
    default:
      return '';
  }
}
</script>

<style scoped lang="scss">
.tm-stat-card {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s ease;

  &:hover {
    background: var(--b3-theme-background-light);
  }

  &.is-active {
    background: var(--b3-theme-background-light);
    box-shadow: 0 0 0 1px var(--b3-theme-primary);
  }
}

.tm-section-header-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.tm-section-title-left {
  display: flex;
  align-items: center;
  gap: 6px;
}


.tm-issue-tag-sub {
  font-size: 10px;
  margin-left: 6px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--b3-theme-background-light);
  color: var(--b3-theme-on-surface-light);
  font-weight: normal;
}

.tm-section-badge {
  font-size: 10px;
  background: var(--b3-theme-background-light);
  color: var(--b3-theme-on-surface);
  padding: 0 5px;
  border-radius: 8px;
}
</style>
