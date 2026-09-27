<template>
  <div class="tm-tab-content">
    <div class="tm-graph-summary">
      <div class="tm-graph-stat">
        <span>活跃节点: <b>{{ graphData.nodes.length }}</b></span>
        <span>关联组合: <b>{{ allCombinations.length }}</b></span>
      </div>
      <div class="tm-graph-hint">探索知识关联拓扑与多维共现洞察</div>
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
          <div class="tm-assoc-actions">
            <button
              class="tm-icon-btn tm-btn-sm"
              v-tooltip="'与聚焦标签联合筛选探查'"
              aria-label="组合探查"
              @click="emit('combine-filter', [selectedGraphTag, item.label])"
            >
              <SyLineIcon name="search-plus" :size="12" />
            </button>
            <button
              class="tm-icon-btn tm-btn-sm"
              v-tooltip="'保存为标签组'"
              aria-label="保存为标签组"
              @click="emit('save-as-group', [selectedGraphTag, item.label])"
            >
              <SyLineIcon name="layers-plus" :size="12" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 高频关联组合面板（多元共现洞察） -->
    <div class="tm-graph-links-panel">
      <div class="tm-associations-header">
        <div class="tm-section-hint">高频关联组合 (Top Associations)：</div>
        <div class="tm-combo-tabs">
          <button
            v-for="opt in sizeFilterTabs"
            :key="opt.value"
            type="button"
            class="tm-combo-tab-btn"
            :class="{ active: activeSizeFilter === opt.value }"
            @click="activeSizeFilter = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="tm-links-scroller">
        <div v-if="filteredCombinations.length === 0" class="tm-empty-hint">
          暂无匹配的关联组合记录（共现频次 &ge; 2）
        </div>
        <div
          v-for="item in filteredCombinations"
          :key="item.tags.join('|')"
          class="tm-assoc-row"
        >
          <span class="tm-assoc-badge" v-tooltip="`共同出现在 ${item.count} 个内容块中`">
            <SyLineIcon name="link" :size="11" />
            <span>{{ item.count }} 次</span>
          </span>
          <div class="tm-assoc-tags-flow">
            <span
              v-for="t in item.tags"
              :key="t"
              class="tm-assoc-tag-chip"
              :title="`#${t}#`"
            >
              #{{ t }}#
            </span>
          </div>
          <div class="tm-assoc-row-actions">
            <button
              class="tm-icon-btn tm-btn-sm"
              v-tooltip="`在多维筛选中联合探查这 ${item.tags.length} 个标签`"
              :aria-label="`探查组合 ${item.tags.join(' + ')}`"
              @click.stop="emit('combine-filter', item.tags)"
            >
              <SyLineIcon name="search-plus" :size="12" />
            </button>
            <button
              class="tm-icon-btn tm-btn-sm"
              v-tooltip="'将此关联组合保存为常用标签组'"
              :aria-label="`保存为标签组 ${item.tags.join(' + ')}`"
              @click.stop="emit('save-as-group', item.tags)"
            >
              <SyLineIcon name="layers-plus" :size="12" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ITagItem, ITagCombination } from '../../types/tag';
import type { ITagGraphData } from '../../services/TagCooccurrenceService';
import type { ITagTimelineStats } from '../../services/TagTimelineService';
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';

const props = withDefaults(
  defineProps<{
    allTags: ITagItem[];
    graphData: ITagGraphData;
    selectedGraphTag: string;
    timelineStats: ITagTimelineStats | null;
    associatedTags: Array<{ label: string; weight: number; jaccard: number }>;
    topLinks?: Array<{ source: string; target: string; weight: number }>;
    tagCombinations?: ITagCombination[];
  }>(),
  {
    topLinks: () => [],
    tagCombinations: () => [],
  },
);

const emit = defineEmits<{
  (e: 'update:selectedGraphTag', label: string): void;
  (e: 'focus-tag-change'): void;
  (e: 'combine-filter', tags: string[] | string, tagB?: string): void;
  (e: 'save-as-group', tags: string[]): void;
}>();

const activeSizeFilter = ref<'all' | '2' | '3' | '4+'>('all');

const sizeFilterTabs = [
  { label: '全部', value: 'all' as const },
  { label: '2 标', value: '2' as const },
  { label: '3 标', value: '3' as const },
  { label: '4+ 标', value: '4+' as const },
];

const allCombinations = computed<ITagCombination[]>(() => {
  if (props.tagCombinations && props.tagCombinations.length > 0) {
    return props.tagCombinations;
  }
  if (props.topLinks && props.topLinks.length > 0) {
    return props.topLinks.map(l => ({
      tags: [l.source, l.target].sort(),
      count: l.weight,
    }));
  }
  return [];
});

const filteredCombinations = computed(() => {
  const list = allCombinations.value;
  if (activeSizeFilter.value === '2') {
    return list.filter(c => c.tags.length === 2);
  }
  if (activeSizeFilter.value === '3') {
    return list.filter(c => c.tags.length === 3);
  }
  if (activeSizeFilter.value === '4+') {
    return list.filter(c => c.tags.length >= 4);
  }
  return list;
});

function onTagChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  emit('update:selectedGraphTag', target.value);
  emit('focus-tag-change');
}
</script>
