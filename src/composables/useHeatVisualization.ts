import { computed, ref } from 'vue';
import type { Ref } from 'vue';
import type { ITagItem } from '../types/tag';

export type HeatVisMode = 'cloud' | 'rank';
export type HeatScope = 'top20' | 'top50' | 'all';

/**
 * 标签热度双模可视化（词云 / 排行榜）纯计算状态
 * 从 TagTreeView.vue 抽离：范围过滤、字号/分级/占比/条宽换算
 * 定位与拖拽交互（handleCloudTagClick/handleCloudDragStart）留在组件层编排
 */
export function useHeatVisualization(options: {
  virtualAllTags: Ref<ITagItem[]>;
  heatExpanded: Ref<boolean>;
}) {
  const { virtualAllTags, heatExpanded } = options;

  // 热度可视化模式与范围
  const visMode = ref<HeatVisMode>('cloud');
  const heatScope = ref<HeatScope>('all');

  const activeTagCount = computed(() => virtualAllTags.value.filter(t => t.count > 0).length);
  const zeroCountTagCount = computed(() => virtualAllTags.value.filter(t => t.count === 0).length);

  const cloudTags = computed(() => {
    if (heatScope.value === 'top20') {
      return [...virtualAllTags.value].filter(t => t.count > 0).sort((a, b) => b.count - a.count).slice(0, 20);
    }
    if (heatScope.value === 'top50') {
      return [...virtualAllTags.value].filter(t => t.count > 0).sort((a, b) => b.count - a.count).slice(0, 50);
    }
    // 全部：展示全库所有标签（包含 0 次引用），按引用数降序，数量与全景树完全一致
    return [...virtualAllTags.value].sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label, 'zh-CN');
    });
  });

  const heatBadgeCount = computed(() => {
    if (heatScope.value === 'all' || !heatExpanded.value) {
      return virtualAllTags.value.length;
    }
    return cloudTags.value.length;
  });

  const totalHeatQuotes = computed(() => {
    return virtualAllTags.value.reduce((acc, t) => acc + (t.count || 0), 0);
  });

  const cloudStats = computed(() => {
    const tags = cloudTags.value;
    if (tags.length === 0) return { min: 0, max: 0 };
    let min = tags[0].count;
    let max = tags[0].count;
    for (const t of tags) {
      if (t.count < min) min = t.count;
      if (t.count > max) max = t.count;
    }
    return { min, max };
  });

  function computeCloudFontSize(count: number): number {
    if (count === 0) return 11;
    const { min, max } = cloudStats.value;
    if (max === min) return 14;
    const effectiveMin = Math.max(1, min);
    const ratio = (count - effectiveMin) / Math.max(1, max - effectiveMin);
    return Math.round(11 + ratio * 11); // 11px ~ 22px
  }

  function formatPercent(count: number): string {
    if (totalHeatQuotes.value === 0 || count === 0) return '0%';
    const pct = (count / totalHeatQuotes.value) * 100;
    return pct >= 10 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
  }

  function getHeatTierClass(count: number): string {
    if (count === 0) return 'tier-zero';
    const { min, max } = cloudStats.value;
    if (max === min) return 'tier-medium';
    const effectiveMin = Math.max(1, min);
    const ratio = (count - effectiveMin) / Math.max(1, max - effectiveMin);
    if (ratio >= 0.8) return 'tier-extreme';
    if (ratio >= 0.55) return 'tier-high';
    if (ratio >= 0.3) return 'tier-medium';
    if (ratio >= 0.12) return 'tier-low';
    return 'tier-minimal';
  }

  function getHeatTooltip(tag: ITagItem): string {
    if (tag.count === 0) {
      return '全库 0 处引用 · 待打标 (点击在树中定位，可拖拽至正文打标)';
    }
    return `全库 ${tag.count} 处引用 · 占 ${formatPercent(tag.count)} (点击在树中定位，可拖拽至正文打标)`;
  }

  function getRankBarColor(index: number): string {
    if (index === 0) return 'var(--tm-badge-danger-text, #f43f5e)';
    if (index === 1) return 'var(--tm-badge-warning-text, #f59e0b)';
    if (index === 2) return 'var(--tm-badge-success-text, #10b981)';
    return 'var(--b3-theme-primary)';
  }

  function getRankBarWidth(count: number): number {
    if (count === 0) return 0;
    const { max } = cloudStats.value;
    if (!max) return 0;
    return Math.min(100, Math.max(10, Math.round((count / max) * 100)));
  }

  return {
    visMode,
    heatScope,
    activeTagCount,
    zeroCountTagCount,
    cloudTags,
    heatBadgeCount,
    totalHeatQuotes,
    cloudStats,
    computeCloudFontSize,
    formatPercent,
    getHeatTierClass,
    getHeatTooltip,
    getRankBarColor,
    getRankBarWidth,
  };
}
