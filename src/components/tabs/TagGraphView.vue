<template>
  <div class="tm-tab-content">
    <div class="tm-graph-summary">
      <div class="tm-graph-stat">
        <span>活跃节点: <b>{{ graphData.nodes.length }}</b></span>
        <span>共现连接: <b>{{ graphData.links.length }}</b></span>
      </div>
      <div class="tm-graph-hint">探索知识共现拓扑与生命周期演变</div>
    </div>

    <!-- 聚焦标签选择与时序分析 -->
    <div class="tm-network-box">
      <div class="tm-network-header">
        <span class="tm-label-title">聚焦标签：</span>
        <select
          :value="selectedGraphTag"
          class="b3-select tm-select-tag"
          @change="onTagChange"
        >
          <option v-for="tag in allTags" :key="tag.label" :value="tag.label">
            #{{ tag.label }} ({{ tag.count }})
          </option>
        </select>
      </div>

      <!-- 时序生命周期卡片 (线框指示器) -->
      <div v-if="timelineStats" class="tm-timeline-stats-card">
        <div class="tm-timeline-top">
          <span class="tm-timeline-trend-badge" :class="`trend-${timelineStats.activityTrend}`">
            <SyLineIcon
              :name="timelineStats.activityTrend === 'rising' ? 'trending-up' : timelineStats.activityTrend === 'cooling' ? 'trending-down' : 'activity'"
              :size="12"
            />
            <span>{{ timelineStats.activityTrend === 'rising' ? '近期活跃' : timelineStats.activityTrend === 'cooling' ? '冷却沉寂' : '平稳常驻' }}</span>
          </span>
          <span class="tm-timeline-last-updated">最后打标：{{ timelineStats.lastUpdated || '未知' }}</span>
        </div>
        <div class="tm-timeline-grid">
          <div class="tm-timeline-metric">
            <div class="tm-metric-val">{{ timelineStats.recent7DaysCount }}</div>
            <div class="tm-metric-lbl">近 7 天</div>
          </div>
          <div class="tm-timeline-metric">
            <div class="tm-metric-val">{{ timelineStats.recent30DaysCount }}</div>
            <div class="tm-metric-lbl">近 30 天</div>
          </div>
          <div class="tm-timeline-metric">
            <div class="tm-metric-val">{{ timelineStats.totalCount }}</div>
            <div class="tm-metric-lbl">历史累计</div>
          </div>
        </div>
      </div>

      <!-- 伴随标签列表 (Jaccard 进度胶囊) -->
      <div class="tm-section-hint" style="margin-top: 10px;">最密切关联的伴随标签 (TOP Associated)：</div>
      <div class="tm-associated-list">
        <div v-if="associatedTags.length === 0" class="tm-empty-hint">
          该标签与其他标签暂无高频共现记录
        </div>
        <div
          v-for="item in associatedTags"
          :key="item.label"
          class="tm-assoc-item"
        >
          <div class="tm-assoc-info">
            <span class="tm-assoc-label">#{{ item.label }}</span>
            <span class="tm-assoc-meta">
              共现 {{ item.weight }} 次 · 亲密相似度 {{ (item.jaccard * 100).toFixed(1) }}%
            </span>
          </div>
          <button
            class="tm-icon-btn tm-btn-sm"
            v-tooltip="'与聚焦标签联合筛选'"
            aria-label="组合筛选"
            @click="emit('combine-filter', selectedGraphTag, item.label)"
          >
            <SyLineIcon name="search-plus" :size="12" />
          </button>
        </div>
      </div>
    </div>

    <!-- 图谱连接流 -->
    <div class="tm-graph-links-panel">
      <div class="tm-section-hint">核心强共现连线 (Top Connections)：</div>
      <div class="tm-links-scroller">
        <div
          v-for="link in topLinks"
          :key="`${link.source}-${link.target}`"
          class="tm-link-row"
          @click="emit('combine-filter', link.source, link.target)"
        >
          <span class="tm-link-badge">
            <SyLineIcon name="link" :size="11" />
            <span>{{ link.weight }} 次</span>
          </span>
          <span class="tm-link-pair">#{{ link.source }} ⟷ #{{ link.target }}</span>
          <span class="tm-link-btn">
            <span>探查</span>
            <SyLineIcon name="external-link" :size="10" />
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ITagItem } from '../../types/tag';
import type { ITagGraphData } from '../../services/TagCooccurrenceService';
import type { ITagTimelineStats } from '../../services/TagTimelineService';
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';

defineProps<{
  allTags: ITagItem[];
  graphData: ITagGraphData;
  selectedGraphTag: string;
  timelineStats: ITagTimelineStats | null;
  associatedTags: Array<{ label: string; weight: number; jaccard: number }>;
  topLinks: Array<{ source: string; target: string; weight: number }>;
}>();

const emit = defineEmits<{
  (e: 'update:selectedGraphTag', label: string): void;
  (e: 'focus-tag-change'): void;
  (e: 'combine-filter', tagA: string, tagB: string): void;
}>();

function onTagChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  emit('update:selectedGraphTag', target.value);
  emit('focus-tag-change');
}
</script>
