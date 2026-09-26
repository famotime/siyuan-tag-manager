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
        <div class="tm-stat-card">
          <div class="tm-stat-val text-warning">
            <SyLineIcon name="alert-triangle" :size="14" />
            <span>{{ healthResult.summary.caseConflicts }}</span>
          </div>
          <div class="tm-stat-lbl">大小写冲突</div>
        </div>
        <div class="tm-stat-card">
          <div class="tm-stat-val text-info">
            <SyLineIcon name="info" :size="14" />
            <span>{{ healthResult.summary.lowFrequency }}</span>
          </div>
          <div class="tm-stat-lbl">低频标签</div>
        </div>
        <div class="tm-stat-card">
          <div class="tm-stat-val text-danger">
            <SyLineIcon name="trash" :size="14" />
            <span>{{ healthResult.summary.orphans }}</span>
          </div>
          <div class="tm-stat-lbl">孤儿标签</div>
        </div>
      </div>
    </div>

    <!-- 体检清单 -->
    <div class="tm-issues-list">
      <div v-if="healthResult.issues.length === 0" class="tm-empty-success">
        <SyLineIcon name="check-circle" :size="24" class="tm-success-icon" />
        <div>太棒了！知识库标签体系非常规范，未发现大小写冲突与孤儿标签！</div>
      </div>
      <div
        v-for="issue in healthResult.issues"
        :key="issue.primaryLabel + issue.type"
        class="tm-issue-card"
        :class="`is-${issue.severity}`"
      >
        <div class="tm-issue-icon">
          <SyLineIcon
            :name="issue.type === 'case_conflict' ? 'alert-triangle' : 'info'"
            :size="16"
          />
        </div>
        <div class="tm-issue-info">
          <div class="tm-issue-title">{{ issue.primaryLabel }}</div>
          <div class="tm-issue-desc">{{ issue.message }}</div>
        </div>
        <div class="tm-issue-op">
          <button
            v-if="issue.suggestedAction === 'merge'"
            class="b3-button b3-button--outline tm-btn-sm"
            v-tooltip="'将所有异构大小写合并至高频标准规范'"
            @click="emit('auto-resolve', issue)"
          >
            <SyLineIcon name="git-merge" :size="12" />
            <span>一键合并规范</span>
          </button>
          <button
            v-else-if="issue.suggestedAction === 'clean'"
            class="b3-button b3-button--cancel tm-btn-sm"
            v-tooltip="'彻底清理并从全库移除此无用标签'"
            @click="emit('remove-tag', issue.primaryLabel)"
          >
            <SyLineIcon name="trash" :size="12" />
            <span>清理删除</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ITagHealthReport, ITagHealthIssue } from '../../types/tag';
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';

defineProps<{
  healthResult: ITagHealthReport;
}>();

const emit = defineEmits<{
  (e: 'auto-resolve', issue: ITagHealthIssue): void;
  (e: 'remove-tag', label: string): void;
}>();
</script>
