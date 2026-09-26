<template>
  <div class="tag-manager-container">
    <!-- 头部工具栏与导航切换 -->
    <header class="tm-header">
      <div class="tm-title-row">
        <div class="tm-brand">
          <span class="tm-brand-icon">🏷️</span>
          <span class="tm-brand-title">标签管家</span>
          <span class="tm-tag-badge">{{ allTags.length }} 个标签</span>
        </div>
        <div class="tm-actions">
          <button class="b3-button b3-button--outline tm-btn-sm" title="批量为文档打标" @click="batchModal.visible = true">
            📑 批量打标
          </button>
          <button class="b3-button b3-button--outline tm-btn-sm" :disabled="loading" title="刷新标签数据" @click="refreshTags">
            <span :class="{'tm-rotate': loading}">🔄</span>
          </button>
          <button class="b3-button b3-button--text tm-btn-sm" title="关闭" @click="closePanel">
            ✕
          </button>
        </div>
      </div>

      <!-- 选项卡导航 -->
      <nav class="tm-nav-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tm-nav-tab"
          :class="{ active: currentTab === tab.id }"
          @click="switchTab(tab.id)"
        >
          <span>{{ tab.icon }}</span>
          <span>{{ tab.name }}</span>
          <span v-if="tab.badge !== undefined && tab.badge > 0" class="tm-tab-badge">
            {{ tab.badge }}
          </span>
        </button>
      </nav>
    </header>

    <!-- 主体内容区 -->
    <main class="tm-body">
      <!-- TAB 1: 标签全景资产树 -->
      <section v-if="currentTab === 'tree'" class="tm-tab-content">
        <!-- 搜索与排序栏（支持拼音首字母模糊联想，如 ytb -> YouTube） -->
        <div class="tm-filter-bar">
          <div class="b3-form__icon fn__flex-1">
            <input
              v-model="searchKeyword"
              class="b3-text-field fn__block"
              placeholder="搜索标签（支持拼音首字母如 ytb、别名）..."
            />
          </div>
          <select v-model="sortMode" class="b3-select" style="margin-left: 8px;">
            <option value="count_desc">引用数 (从多到少)</option>
            <option value="count_asc">引用数 (从少到多)</option>
            <option value="name_asc">名称拼音 (A-Z)</option>
            <option value="name_desc">名称拼音 (Z-A)</option>
          </select>
        </div>

        <!-- 标签树列表 -->
        <div class="tm-tree-scroller">
          <div v-if="displayTreeNodes.length === 0" class="tm-empty">
            {{ loading ? '正在加载标签资产...' : '未匹配到任何标签' }}
          </div>
          <div v-else class="tm-tree-nodes">
            <div
              v-for="node in displayTreeNodes"
              :key="node.label"
              class="tm-tree-node"
              :style="{ paddingLeft: `${node.depth * 16 + 8}px` }"
            >
              <div class="tm-node-content" @click="handleQuickFilter(node.label)">
                <span class="tm-node-icon">{{ getTagIcon(node.label) }}</span>
                <span
                  class="tm-node-name"
                  :style="getTagStyle(node.label)"
                  :title="node.label"
                >
                  {{ node.name }}
                </span>
                <span class="tm-node-count">{{ node.count }}</span>
              </div>
              <div class="tm-node-actions">
                <button
                  class="tm-mini-btn"
                  title="🎨 设置色彩样式与别名"
                  @click.stop="openStyleDialog(node.label)"
                >
                  🎨
                </button>
                <button
                  class="tm-mini-btn"
                  title="📄 一键升格为实体主题文档"
                  @click.stop="handleConvertToDoc(node.label)"
                >
                  📄
                </button>
                <button
                  class="tm-mini-btn"
                  title="加入即时交叉筛选"
                  @click.stop="handleQuickFilter(node.label)"
                >
                  🔍
                </button>
                <button
                  class="tm-mini-btn"
                  title="查看知识共现与生命周期"
                  @click.stop="viewTagNetwork(node.label)"
                >
                  🕸️
                </button>
                <button
                  class="tm-mini-btn"
                  title="重构合并到其他标签"
                  @click.stop="openMergeDialog(node.label)"
                >
                  🔀
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 2: 多维交叉筛选与即时卡片流 -->
      <section v-if="currentTab === 'filter'" class="tm-tab-content">
        <!-- 智能保存视图管理 -->
        <div class="tm-views-toolbar">
          <div class="tm-views-select-row">
            <span class="tm-views-lbl">智能视图：</span>
            <select v-model="selectedSmartViewId" class="b3-select tm-views-select" @change="applySmartView">
              <option value="">-- 选择或切换常用智能视图 --</option>
              <option v-for="v in savedViews" :key="v.id" :value="v.id">
                ⭐ {{ v.title }}
              </option>
            </select>
            <button
              class="b3-button b3-button--outline tm-btn-sm"
              :disabled="activeFilter.includeTags.length === 0 && activeFilter.excludeTags.length === 0"
              title="将当前组合保存为智能视图"
              @click="openSaveViewDialog"
            >
              💾 保存当前
            </button>
          </div>
        </div>

        <!-- 激活的筛选条件池 -->
        <div class="tm-filter-box">
          <div class="tm-section-hint">点击切换：➕必含 (AND) | ➖排除 (NOT) | ✕移除</div>
          <div class="tm-active-chips">
            <div
              v-for="tag in activeFilter.includeTags"
              :key="`inc-${tag}`"
              class="tm-chip tm-chip--inc"
              @click="toggleTagCondition(tag, 'exclude')"
            >
              <span class="tm-chip-prefix">AND</span>
              <span>#{{ tag }}</span>
              <span class="tm-chip-remove" @click.stop="removeFilterTag(tag)">✕</span>
            </div>
            <div
              v-for="tag in activeFilter.excludeTags"
              :key="`exc-${tag}`"
              class="tm-chip tm-chip--exc"
              @click="toggleTagCondition(tag, 'include')"
            >
              <span class="tm-chip-prefix">NOT</span>
              <span>#{{ tag }}</span>
              <span class="tm-chip-remove" @click.stop="removeFilterTag(tag)">✕</span>
            </div>
            <div v-if="activeFilter.includeTags.length === 0 && activeFilter.excludeTags.length === 0" class="tm-filter-placeholder">
              👈 请从下方点选标签，展开多维交叉切片分析
            </div>
          </div>

          <!-- 快速候选标签流 -->
          <div class="tm-quick-tags">
            <span
              v-for="tag in topQuickTags"
              :key="tag.label"
              class="tm-quick-tag"
              :class="{
                'is-included': activeFilter.includeTags.includes(tag.label),
                'is-excluded': activeFilter.excludeTags.includes(tag.label)
              }"
              @click="toggleTagFilter(tag.label)"
            >
              #{{ tag.label }} ({{ tag.count }})
            </span>
          </div>
        </div>

        <!-- 结果卡片流 -->
        <div class="tm-results-header">
          <span>匹配结果：{{ matchedBlocks.length }} 条记录</span>
          <span v-if="queryLoading" class="tm-loading-text">正在极速检索...</span>
        </div>
        <div class="tm-card-stream">
          <div v-if="matchedBlocks.length === 0 && !queryLoading" class="tm-empty">
            没有符合多维组合条件的块记录
          </div>
          <div
            v-for="block in matchedBlocks"
            :key="block.id"
            class="tm-card"
            @click="jumpToBlock(block.rootId, block.id)"
          >
            <div class="tm-card-doc">📄 {{ block.docTitle }}</div>
            <div class="tm-card-content" v-html="highlightTags(block.content || block.markdown)"></div>
            <div class="tm-card-footer">
              <span class="tm-card-time">{{ block.updated }}</span>
              <span class="tm-card-jump">点击跳转定位 ↗</span>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 3: 认知图谱与生命周期分析 -->
      <section v-if="currentTab === 'graph'" class="tm-tab-content">
        <div class="tm-graph-summary">
          <div class="tm-graph-stat">
            <span>活跃节点: <b>{{ graphData.nodes.length }}</b></span>
            <span>共现连接: <b>{{ graphData.links.length }}</b></span>
          </div>
          <div class="tm-graph-hint">探索知识共现网络与关注演变</div>
        </div>

        <!-- 聚焦标签选择 -->
        <div class="tm-network-box">
          <div class="tm-network-header">
            <span>聚焦标签：</span>
            <select v-model="selectedGraphTag" class="b3-select tm-select-tag" @change="onFocusTagChange">
              <option v-for="tag in allTags" :key="tag.label" :value="tag.label">
                #{{ tag.label }} ({{ tag.count }})
              </option>
            </select>
          </div>

          <!-- 时序生命周期分析看板 (特性 15) -->
          <div v-if="timelineStats" class="tm-timeline-stats-card">
            <div class="tm-timeline-top">
              <span class="tm-timeline-trend-badge" :class="`trend-${timelineStats.activityTrend}`">
                {{ timelineStats.activityTrend === 'rising' ? '🚀 近期活跃' : timelineStats.activityTrend === 'cooling' ? '❄️ 冷却沉寂' : '🟢 平稳常驻' }}
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

          <!-- 伴随标签列表 -->
          <div class="tm-section-hint" style="margin-top: 10px;">最密切关联的伴随标签 (TOP Associated)：</div>
          <div class="tm-associated-list">
            <div v-if="associatedTags.length === 0" class="tm-empty" style="padding: 12px;">
              该标签与其他标签暂无高频共现记录
            </div>
            <div
              v-for="item in associatedTags"
              :key="item.label"
              class="tm-assoc-item"
            >
              <div class="tm-assoc-info">
                <span class="tm-assoc-label">#{{ item.label }}</span>
                <span class="tm-assoc-meta">共现 {{ item.weight }} 次 · 相似度 {{ (item.jaccard * 100).toFixed(1) }}%</span>
              </div>
              <button
                class="b3-button b3-button--outline tm-btn-sm"
                title="同时筛选这两个标签"
                @click="combineFilterWithAssociated(selectedGraphTag, item.label)"
              >
                + 组合筛选
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
              @click="combineFilterWithAssociated(link.source, link.target)"
            >
              <span class="tm-link-badge">🔗 共现 {{ link.weight }} 次</span>
              <span class="tm-link-pair">#{{ link.source }} ⟷ #{{ link.target }}</span>
              <span class="tm-link-btn">探查 ↗</span>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 4: 标签治理与健康体检 -->
      <section v-if="currentTab === 'hygiene'" class="tm-tab-content">
        <!-- 统计面板 -->
        <div class="tm-health-dash">
          <div class="tm-health-score">
            <div class="tm-score-num">{{ healthResult.summary.healthyRate }}%</div>
            <div class="tm-score-lbl">健康度评分</div>
          </div>
          <div class="tm-stat-grid">
            <div class="tm-stat-card">
              <div class="tm-stat-val text-warning">{{ healthResult.summary.caseConflicts }}</div>
              <div class="tm-stat-lbl">大小写冲突</div>
            </div>
            <div class="tm-stat-card">
              <div class="tm-stat-val text-info">{{ healthResult.summary.lowFrequency }}</div>
              <div class="tm-stat-lbl">低频标签 (1次)</div>
            </div>
            <div class="tm-stat-card">
              <div class="tm-stat-val text-danger">{{ healthResult.summary.orphans }}</div>
              <div class="tm-stat-lbl">孤儿废弃标签</div>
            </div>
          </div>
        </div>

        <!-- 体检清单 -->
        <div class="tm-issues-list">
          <div v-if="healthResult.issues.length === 0" class="tm-empty-success">
            🎉 太棒了！知识库标签体系非常规范，未发现大小写冲突与孤儿标签！
          </div>
          <div
            v-for="issue in healthResult.issues"
            :key="issue.primaryLabel + issue.type"
            class="tm-issue-card"
            :class="`is-${issue.severity}`"
          >
            <div class="tm-issue-icon">
              {{ issue.type === 'case_conflict' ? '⚠️' : 'ℹ️' }}
            </div>
            <div class="tm-issue-info">
              <div class="tm-issue-title">{{ issue.primaryLabel }}</div>
              <div class="tm-issue-desc">{{ issue.message }}</div>
            </div>
            <div class="tm-issue-op">
              <button
                v-if="issue.suggestedAction === 'merge'"
                class="b3-button b3-button--outline tm-btn-sm"
                @click="autoResolveIssue(issue)"
              >
                一键合并规范化
              </button>
              <button
                v-else-if="issue.suggestedAction === 'clean'"
                class="b3-button b3-button--cancel tm-btn-sm"
                @click="handleRemoveTag(issue.primaryLabel)"
              >
                清理删除
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- 样式与别名设置弹窗 (Color Picker & Alias Modal) -->
    <div v-if="styleModal.visible" class="tm-modal-mask" @click.self="styleModal.visible = false">
      <div class="tm-modal-card">
        <div class="tm-modal-title">🎨 设置标签样式与别名</div>
        <div class="tm-modal-body">
          <p>正在定制标签：<b>#{{ styleModal.label }}#</b></p>
          <div class="tm-form-group">
            <label>预设背景色彩：</label>
            <div class="tm-color-palette">
              <span
                v-for="preset in colorPresets"
                :key="preset.bg"
                class="tm-color-swatch"
                :style="{ backgroundColor: preset.bg, color: preset.text }"
                @click="applyColorPreset(preset)"
              >
                Aa
              </span>
            </div>
          </div>
          <div class="tm-form-row">
            <div class="tm-form-group fn__flex-1">
              <label>背景颜色 (Hex):</label>
              <input v-model="styleModal.backgroundColor" class="b3-text-field fn__block" placeholder="#E8F0FE" />
            </div>
            <div class="tm-form-group fn__flex-1" style="margin-left: 8px;">
              <label>文字颜色 (Hex):</label>
              <input v-model="styleModal.textColor" class="b3-text-field fn__block" placeholder="#1A73E8" />
            </div>
          </div>
          <div class="tm-form-group">
            <label>自定义 Emoji / 图标：</label>
            <input v-model="styleModal.icon" class="b3-text-field fn__block" placeholder="例如：🎬, 💡, 🚀, 💻" />
          </div>
          <div class="tm-form-group">
            <label>别名列表（逗号分隔，支持拼音首字母模糊联想）：</label>
            <input v-model="styleModal.aliasesText" class="b3-text-field fn__block" placeholder="例如：油管, 视频平台" />
          </div>
        </div>
        <div class="tm-modal-footer">
          <button class="b3-button b3-button--cancel" @click="styleModal.visible = false">取消</button>
          <button class="b3-button b3-button--primary" @click="saveTagStyle">保存并即时生效</button>
        </div>
      </div>
    </div>

    <!-- 保存智能视图弹窗 -->
    <div v-if="saveViewModal.visible" class="tm-modal-mask" @click.self="saveViewModal.visible = false">
      <div class="tm-modal-card">
        <div class="tm-modal-title">💾 保存为智能视图</div>
        <div class="tm-modal-body">
          <div class="tm-form-group">
            <label>视图名称：</label>
            <input v-model="saveViewModal.title" class="b3-text-field fn__block" placeholder="例如：AI视频开发重点" />
          </div>
          <div class="tm-section-hint">
            包含: {{ activeFilter.includeTags.map(t => `#${t}`).join(', ') || '无' }}<br>
            排除: {{ activeFilter.excludeTags.map(t => `#${t}`).join(', ') || '无' }}
          </div>
        </div>
        <div class="tm-modal-footer">
          <button class="b3-button b3-button--cancel" @click="saveViewModal.visible = false">取消</button>
          <button class="b3-button b3-button--primary" @click="confirmSaveSmartView">保存视图</button>
        </div>
      </div>
    </div>

    <!-- 批量打标弹窗 -->
    <div v-if="batchModal.visible" class="tm-modal-mask" @click.self="batchModal.visible = false">
      <div class="tm-modal-card">
        <div class="tm-modal-title">📑 批量文档打标</div>
        <div class="tm-modal-body">
          <div class="tm-form-group">
            <label>目标文档 ID (每行一个 ID)：</label>
            <textarea
              v-model="batchModal.docIdsText"
              class="b3-text-field fn__block"
              rows="3"
              placeholder="粘贴思源文档块 ID，如 20260926080000-xxxxxxx"
            ></textarea>
          </div>
          <div class="tm-form-group">
            <label>待添加的标签（支持多个，逗号分隔）：</label>
            <input
              v-model="batchModal.tagsText"
              class="b3-text-field fn__block"
              placeholder="例如：YouTube, AI, 产品案例"
            />
          </div>
        </div>
        <div class="tm-modal-footer">
          <button class="b3-button b3-button--cancel" @click="batchModal.visible = false">取消</button>
          <button class="b3-button b3-button--primary" :disabled="batchModal.executing" @click="executeBatchTag">
            {{ batchModal.executing ? '执行中...' : '开始批量打标' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 合并重构对话弹窗 -->
    <div v-if="mergeModal.visible" class="tm-modal-mask" @click.self="mergeModal.visible = false">
      <div class="tm-modal-card">
        <div class="tm-modal-title">🔀 标签重构与合并</div>
        <div class="tm-modal-body">
          <p>将源标签 <b>#{{ mergeModal.sourceLabel }}#</b> 合并到目标标签：</p>
          <div class="tm-form-group">
            <label>目标标签：</label>
            <input
              v-model="mergeModal.targetLabel"
              class="b3-text-field fn__block"
              placeholder="例如：Prompt 或 tech/python"
            />
          </div>
          <div class="tm-form-checkbox">
            <label>
              <input v-model="mergeModal.setAsAlias" type="checkbox" />
              合并后将 "{{ mergeModal.sourceLabel }}" 保存为别名
            </label>
          </div>
        </div>
        <div class="tm-modal-footer">
          <button class="b3-button b3-button--cancel" @click="mergeModal.visible = false">取消</button>
          <button class="b3-button b3-button--primary" :disabled="mergeModal.executing" @click="confirmMerge">
            {{ mergeModal.executing ? '正在合并中...' : '确认合并' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { showMessage } from 'siyuan';
import type { ITagHealthIssue, ITagItem, ITagMatchedBlock, ITagMetadata, ISmartTagView } from './types/tag';
import { TagApiClient } from './services/TagApiClient';
import { TagTreeService, type TagSortMode } from './services/TagTreeService';
import { TagGovernanceService } from './services/TagGovernanceService';
import { TagPinyinAliasService } from './services/TagPinyinAliasService';
import { TagBatchService } from './services/TagBatchService';
import { TagCooccurrenceService, type ITagGraphData } from './services/TagCooccurrenceService';
import { TagVisualService } from './services/TagVisualService';
import { TagDocConverterService } from './services/TagDocConverterService';
import { TagTimelineService, type ITagTimelineStats } from './services/TagTimelineService';
import { toggleTagManagerDock, usePlugin } from './main';

// 状态管理
const currentTab = ref<'tree' | 'filter' | 'graph' | 'hygiene'>('tree');
const loading = ref(false);
const allTags = ref<ITagItem[]>([]);
const searchKeyword = ref('');
const sortMode = ref<TagSortMode>('count_desc');

// 标签元数据映射表 Map<label, ITagMetadata>
const metadataMap = ref<Map<string, ITagMetadata>>(new Map());

// 智能视图列表
const savedViews = ref<ISmartTagView[]>([]);
const selectedSmartViewId = ref('');

// 筛选状态
const activeFilter = ref<{
  includeTags: string[];
  excludeTags: string[];
}>({
  includeTags: [],
  excludeTags: [],
});
const matchedBlocks = ref<ITagMatchedBlock[]>([]);
const queryLoading = ref(false);

// 图谱与生命周期
const graphData = ref<ITagGraphData>({ nodes: [], links: [] });
const selectedGraphTag = ref('');
const associatedTags = ref<Array<{ label: string; weight: number; jaccard: number }>>([]);
const timelineStats = ref<ITagTimelineStats | null>(null);

// 健康体检结果
const healthResult = ref(TagGovernanceService.runHealthInspection([]));

// 预设柔和色彩组合
const colorPresets = [
  { bg: '#E8F0FE', text: '#1A73E8' }, // 经典蓝
  { bg: '#E6F4EA', text: '#137333' }, // 护眼绿
  { bg: '#FEF7E0', text: '#B06000' }, // 柔和橙
  { bg: '#FCE8E6', text: '#C5221F' }, // 警示红
  { bg: '#F3E8FD', text: '#8430CE' }, // 优雅紫
  { bg: '#E0F2F1', text: '#00695C' }, // 青蓝
];

// 样式弹窗
const styleModal = ref({
  visible: false,
  label: '',
  backgroundColor: '',
  textColor: '',
  icon: '',
  aliasesText: '',
});

// 保存视图弹窗
const saveViewModal = ref({
  visible: false,
  title: '',
});

// 批量打标弹窗
const batchModal = ref({
  visible: false,
  docIdsText: '',
  tagsText: '',
  executing: false,
});

// 合并弹窗
const mergeModal = ref({
  visible: false,
  sourceLabel: '',
  targetLabel: '',
  setAsAlias: true,
  executing: false,
});

const tabs = computed(() => [
  { id: 'tree' as const, name: '标签全景', icon: '🗂️' },
  { id: 'filter' as const, name: '多维筛选', icon: '⚡', badge: activeFilter.value.includeTags.length + activeFilter.value.excludeTags.length },
  { id: 'graph' as const, name: '认知图谱', icon: '🕸️' },
  { id: 'hygiene' as const, name: '健康治理', icon: '🩺', badge: healthResult.value.issues.length },
]);

const displayTreeNodes = computed(() => {
  if (!searchKeyword.value.trim()) {
    return TagTreeService.buildTree(allTags.value, sortMode.value);
  }
  const matches = TagPinyinAliasService.matchTags(allTags.value, searchKeyword.value, 50);
  return TagTreeService.buildTree(matches.map(m => m.tag), sortMode.value);
});

const topQuickTags = computed(() => allTags.value.slice(0, 30));

const topLinks = computed(() => {
  return [...graphData.value.links]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 15);
});

function getTagIcon(label: string): string {
  return metadataMap.value.get(label)?.icon || '🔖';
}

function getTagStyle(label: string): Record<string, string> {
  const meta = metadataMap.value.get(label);
  if (!meta) return {};
  const s: Record<string, string> = {};
  if (meta.backgroundColor) s.backgroundColor = meta.backgroundColor;
  if (meta.textColor) s.color = meta.textColor;
  if (meta.backgroundColor || meta.textColor) {
    s.borderRadius = '4px';
    s.padding = '1px 6px';
  }
  return s;
}

function switchTab(tabId: 'tree' | 'filter' | 'graph' | 'hygiene') {
  currentTab.value = tabId;
  if (tabId === 'graph') {
    if (graphData.value.nodes.length === 0) {
      loadGraphData();
    }
    if (selectedGraphTag.value) {
      loadTimelineStats(selectedGraphTag.value);
    }
  }
}

// 刷新全库标签数据与本地元数据配置
async function refreshTags() {
  loading.value = true;
  try {
    const plugin = usePlugin();
    const localData = await plugin.loadData('tag-manager-config.json').catch(() => null);
    if (localData?.metadataList && Array.isArray(localData.metadataList)) {
      const map = new Map<string, ITagMetadata>();
      localData.metadataList.forEach((m: ITagMetadata) => map.set(m.label, m));
      metadataMap.value = map;
      // 动态注入样式到编辑器正文
      const css = TagVisualService.generateCssRules(localData.metadataList);
      TagVisualService.applyStyles(css);
    }
    if (localData?.savedViews && Array.isArray(localData.savedViews)) {
      savedViews.value = localData.savedViews;
    }

    const tags = await TagApiClient.fetchAllTags();
    // 注入 metadata 属性
    tags.forEach(t => {
      t.metadata = metadataMap.value.get(t.label);
    });

    allTags.value = tags;
    if (tags.length > 0 && !selectedGraphTag.value) {
      selectedGraphTag.value = tags[0].label;
    }
    healthResult.value = TagGovernanceService.runHealthInspection(tags);

    if (activeFilter.value.includeTags.length > 0 || activeFilter.value.excludeTags.length > 0) {
      await runQuery();
    }
  } catch (err: any) {
    showMessage(`加载标签失败: ${err.message || err}`, 4000, 'error');
  } finally {
    loading.value = false;
  }
}

// 样式与别名设置
function openStyleDialog(label: string) {
  const meta = metadataMap.value.get(label);
  styleModal.value = {
    visible: true,
    label,
    backgroundColor: meta?.backgroundColor || '',
    textColor: meta?.textColor || '',
    icon: meta?.icon || '',
    aliasesText: (meta?.aliases || []).join(', '),
  };
}

function applyColorPreset(preset: { bg: string; text: string }) {
  styleModal.value.backgroundColor = preset.bg;
  styleModal.value.textColor = preset.text;
}

async function saveTagStyle() {
  const { label, backgroundColor, textColor, icon, aliasesText } = styleModal.value;
  const aliases = aliasesText.split(',').map(s => s.trim()).filter(Boolean);

  const meta: ITagMetadata = {
    label,
    backgroundColor,
    textColor,
    icon,
    aliases,
    updatedAt: Date.now(),
  };

  metadataMap.value.set(label, meta);
  styleModal.value.visible = false;

  // 持久化并刷新 CSS
  const plugin = usePlugin();
  const metaList = Array.from(metadataMap.value.values());
  await plugin.saveData('tag-manager-config.json', {
    metadataList: metaList,
    savedViews: savedViews.value,
  });

  const css = TagVisualService.generateCssRules(metaList);
  TagVisualService.applyStyles(css);
  showMessage(`已成功更新标签 "#${label}#" 的样式与别名！`, 3000, 'info');
}

// 一键升格为实体文档 (Tag to Doc)
async function handleConvertToDoc(label: string) {
  loading.value = true;
  try {
    // 提取当前标签命中的块
    const blocks = await TagApiClient.queryMatchedBlocks({ includeTags: [label], limit: 30 });
    const res = await TagDocConverterService.createDocFromTag(label, blocks);
    if (res.success && res.docId) {
      showMessage(`🎉 已成功创建主题聚合文档《${label}》！`, 4000, 'info');
      // 打开新创建的文档
      if ((window as any).siyuan?.openTab) {
        (window as any).siyuan.openTab({
          app: (window as any).siyuan.appId,
          doc: { id: res.docId },
        });
      }
    } else {
      showMessage(`创建聚合文档失败: ${res.error}`, 4000, 'error');
    }
  } catch (err: any) {
    showMessage(`升格文档异常: ${err.message || err}`, 4000, 'error');
  } finally {
    loading.value = false;
  }
}

// 智能视图保存与应用
function openSaveViewDialog() {
  saveViewModal.value = {
    visible: true,
    title: `${activeFilter.value.includeTags.join('+')} 视图`,
  };
}

async function confirmSaveSmartView() {
  if (!saveViewModal.value.title.trim()) {
    showMessage('视图标题不能为空', 3000, 'error');
    return;
  }

  const newView: ISmartTagView = {
    id: `view_${Date.now()}`,
    title: saveViewModal.value.title.trim(),
    includeTags: [...activeFilter.value.includeTags],
    excludeTags: [...activeFilter.value.excludeTags],
    optionalTags: [],
    displayMode: 'card',
    createdAt: Date.now(),
  };

  savedViews.value.push(newView);
  selectedSmartViewId.value = newView.id;
  saveViewModal.value.visible = false;

  const plugin = usePlugin();
  await plugin.saveData('tag-manager-config.json', {
    metadataList: Array.from(metadataMap.value.values()),
    savedViews: savedViews.value,
  });

  showMessage(`已保存智能视图 "${newView.title}"`, 3000, 'info');
}

function applySmartView() {
  const v = savedViews.value.find(view => view.id === selectedSmartViewId.value);
  if (!v) return;
  activeFilter.value.includeTags = [...v.includeTags];
  activeFilter.value.excludeTags = [...v.excludeTags];
  runQuery();
}

// 加载共现图谱与时序分析
async function loadGraphData() {
  loading.value = true;
  try {
    const res = await TagApiClient.fetchCooccurrenceGraph();
    graphData.value = res.graph;
    updateAssociatedTags();
  } catch (err: any) {
    showMessage(`加载共现网络失败: ${err.message || err}`, 4000, 'error');
  } finally {
    loading.value = false;
  }
}

async function loadTimelineStats(label: string) {
  try {
    const timestamps = await TagApiClient.fetchTagTimestamps(label);
    timelineStats.value = TagTimelineService.calculateTimelineStats(label, timestamps);
  } catch (err: any) {
    console.warn('获取时序统计失败', err);
  }
}

function onFocusTagChange() {
  updateAssociatedTags();
  loadTimelineStats(selectedGraphTag.value);
}

function updateAssociatedTags() {
  if (!selectedGraphTag.value) return;
  associatedTags.value = TagCooccurrenceService.findAssociatedTags(graphData.value, selectedGraphTag.value, 6);
}

function viewTagNetwork(label: string) {
  selectedGraphTag.value = label;
  currentTab.value = 'graph';
  if (graphData.value.nodes.length === 0) {
    loadGraphData();
  } else {
    updateAssociatedTags();
  }
  loadTimelineStats(label);
}

function combineFilterWithAssociated(tagA: string, tagB: string) {
  currentTab.value = 'filter';
  activeFilter.value.includeTags = Array.from(new Set([...activeFilter.value.includeTags, tagA, tagB]));
  runQuery();
}

function handleQuickFilter(label: string) {
  currentTab.value = 'filter';
  if (!activeFilter.value.includeTags.includes(label)) {
    activeFilter.value.includeTags.push(label);
  }
  runQuery();
}

function toggleTagFilter(label: string) {
  const incIndex = activeFilter.value.includeTags.indexOf(label);
  const excIndex = activeFilter.value.excludeTags.indexOf(label);

  if (incIndex > -1) {
    activeFilter.value.includeTags.splice(incIndex, 1);
    activeFilter.value.excludeTags.push(label);
  } else if (excIndex > -1) {
    activeFilter.value.excludeTags.splice(excIndex, 1);
  } else {
    activeFilter.value.includeTags.push(label);
  }
  runQuery();
}

function toggleTagCondition(label: string, targetState: 'include' | 'exclude') {
  removeFilterTag(label);
  if (targetState === 'include') {
    activeFilter.value.includeTags.push(label);
  } else {
    activeFilter.value.excludeTags.push(label);
  }
  runQuery();
}

function removeFilterTag(label: string) {
  activeFilter.value.includeTags = activeFilter.value.includeTags.filter(t => t !== label);
  activeFilter.value.excludeTags = activeFilter.value.excludeTags.filter(t => t !== label);
  runQuery();
}

async function runQuery() {
  if (activeFilter.value.includeTags.length === 0 && activeFilter.value.excludeTags.length === 0) {
    matchedBlocks.value = [];
    return;
  }

  queryLoading.value = true;
  try {
    matchedBlocks.value = await TagApiClient.queryMatchedBlocks({
      includeTags: activeFilter.value.includeTags,
      excludeTags: activeFilter.value.excludeTags,
      limit: 40,
    });
  } catch (err: any) {
    showMessage(`查询块记录失败: ${err.message || err}`, 4000, 'error');
  } finally {
    queryLoading.value = false;
  }
}

function highlightTags(text: string): string {
  if (!text) return '';
  return text.replace(/#([^#]+)#/g, '<span class="tm-matched-tag">#$1#</span>');
}

function jumpToBlock(rootId: string, blockId: string) {
  if ((window as any).siyuan && (window as any).siyuan.openTab) {
    (window as any).siyuan.openTab({
      app: (window as any).siyuan.appId,
      doc: { id: rootId, focusBlockId: blockId },
    });
  } else {
    window.open(`siyuan://blocks/${blockId}`);
  }
}

async function executeBatchTag() {
  const docIds = batchModal.value.docIdsText.split('\n').map(s => s.trim()).filter(Boolean);
  const tags = batchModal.value.tagsText.split(',').map(s => s.trim()).filter(Boolean);

  if (docIds.length === 0 || tags.length === 0) {
    showMessage('文档 ID 与待添加标签均不能为空', 3000, 'error');
    return;
  }

  batchModal.value.executing = true;
  try {
    const res = await TagBatchService.batchTagDocuments(docIds, tags);
    if (res.success) {
      showMessage(`成功为 ${res.updatedCount} 篇文档更新标签`, 3000, 'info');
      batchModal.value.visible = false;
      batchModal.value.docIdsText = '';
      batchModal.value.tagsText = '';
      await refreshTags();
    } else {
      showMessage(`批量打标存在错误: ${res.errors.join('; ')}`, 5000, 'error');
    }
  } catch (err: any) {
    showMessage(`批量打标失败: ${err.message || err}`, 4000, 'error');
  } finally {
    batchModal.value.executing = false;
  }
}

function openMergeDialog(sourceLabel: string) {
  mergeModal.value = {
    visible: true,
    sourceLabel,
    targetLabel: '',
    setAsAlias: true,
    executing: false,
  };
}

async function confirmMerge() {
  const { sourceLabel, targetLabel, setAsAlias } = mergeModal.value;
  const { plan, error } = TagGovernanceService.generateMergePlan(targetLabel, [sourceLabel], allTags.value, setAsAlias);

  if (error || !plan) {
    showMessage(error || '合并计划创建失败', 4000, 'error');
    return;
  }

  mergeModal.value.executing = true;
  try {
    const res = await TagApiClient.executeMergePlan(plan);
    if (res.success) {
      showMessage(`成功合并标签 "${sourceLabel}" 到 "${targetLabel}"`, 3000, 'info');
      mergeModal.value.visible = false;
      await refreshTags();
    } else {
      showMessage(`部分合并失败: ${res.errors.join('; ')}`, 6000, 'error');
    }
  } catch (err: any) {
    showMessage(`合并执行异常: ${err.message || err}`, 4000, 'error');
  } finally {
    mergeModal.value.executing = false;
  }
}

async function autoResolveIssue(issue: ITagHealthIssue) {
  if (!issue.relatedLabels || issue.relatedLabels.length === 0) return;
  const planRes = TagGovernanceService.generateMergePlan(issue.primaryLabel, issue.relatedLabels, allTags.value, true);

  if (!planRes.plan) {
    showMessage(planRes.error || '无法生成合并计划', 3000, 'error');
    return;
  }

  loading.value = true;
  try {
    const res = await TagApiClient.executeMergePlan(planRes.plan);
    if (res.success) {
      showMessage(`已成功规整并合并冲突到 "${issue.primaryLabel}"`, 3000, 'info');
      await refreshTags();
    }
  } catch (err: any) {
    showMessage(`修复失败: ${err.message || err}`, 4000, 'error');
  } finally {
    loading.value = false;
  }
}

async function handleRemoveTag(label: string) {
  if (!confirm(`确定要彻底删除标签 "${label}" 吗？此操作将移除全库关联引用的标签标记。`)) {
    return;
  }
  loading.value = true;
  try {
    await TagApiClient.removeTag(label);
    showMessage(`已成功删除标签 "${label}"`, 3000, 'info');
    await refreshTags();
  } catch (err: any) {
    showMessage(`删除标签失败: ${err.message || err}`, 4000, 'error');
  } finally {
    loading.value = false;
  }
}

function closePanel() {
  toggleTagManagerDock();
}

onMounted(() => {
  refreshTags();
});
</script>

<style scoped>
.tag-manager-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
  overflow: hidden;
  box-sizing: border-box;
}

.tm-header {
  border-bottom: 1px solid var(--b3-border-color);
  padding: 8px 12px 0 12px;
  background: var(--b3-theme-surface);
}

.tm-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.tm-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 14px;
}

.tm-tag-badge {
  font-size: 11px;
  background: var(--b3-theme-primary-light);
  color: var(--b3-theme-primary);
  padding: 1px 6px;
  border-radius: 10px;
}

.tm-actions {
  display: flex;
  gap: 4px;
}

.tm-btn-sm {
  padding: 2px 6px;
  font-size: 12px;
  min-height: 24px;
  height: 24px;
}

.tm-rotate {
  display: inline-block;
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tm-nav-tabs {
  display: flex;
  gap: 4px;
}

.tm-nav-tab {
  border: none;
  background: transparent;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.tm-nav-tab:hover {
  background: var(--b3-theme-background-light);
}

.tm-nav-tab.active {
  color: var(--b3-theme-primary);
  border-bottom-color: var(--b3-theme-primary);
  font-weight: 600;
}

.tm-tab-badge {
  font-size: 10px;
  background: var(--b3-theme-error);
  color: #fff;
  padding: 0 4px;
  border-radius: 8px;
}

.tm-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tm-tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 8px 12px;
}

.tm-filter-bar {
  display: flex;
  margin-bottom: 8px;
}

.tm-tree-scroller {
  flex: 1;
  overflow-y: auto;
}

.tm-tree-nodes {
  display: flex;
  flex-direction: column;
}

.tm-tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.tm-tree-node:hover {
  background: var(--b3-theme-background-light);
}

.tm-node-content {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  overflow: hidden;
}

.tm-node-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tm-node-count {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  background: var(--b3-theme-surface);
  padding: 0 5px;
  border-radius: 8px;
}

.tm-node-actions {
  display: none;
  gap: 2px;
}

.tm-tree-node:hover .tm-node-actions {
  display: flex;
}

.tm-mini-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 2px;
  font-size: 12px;
  border-radius: 3px;
}

.tm-mini-btn:hover {
  background: var(--b3-theme-surface);
}

/* 智能视图 */
.tm-views-toolbar {
  margin-bottom: 8px;
}

.tm-views-select-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tm-views-lbl {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
}

.tm-views-select {
  flex: 1;
  font-size: 12px;
}

/* 筛选样式 */
.tm-filter-box {
  background: var(--b3-theme-surface);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 8px;
  border: 1px solid var(--b3-border-color);
}

.tm-section-hint {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  margin-bottom: 6px;
}

.tm-active-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 28px;
}

.tm-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  cursor: pointer;
  user-select: none;
}

.tm-chip--inc {
  background: var(--b3-theme-primary-light);
  color: var(--b3-theme-primary);
  border: 1px solid var(--b3-theme-primary);
}

.tm-chip--exc {
  background: rgba(220, 53, 69, 0.12);
  color: #dc3545;
  border: 1px solid #dc3545;
  text-decoration: line-through;
}

.tm-chip-prefix {
  font-weight: 700;
  font-size: 9px;
}

.tm-chip-remove {
  font-weight: bold;
  cursor: pointer;
}

.tm-quick-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
  max-height: 80px;
  overflow-y: auto;
}

.tm-quick-tag {
  font-size: 11px;
  background: var(--b3-theme-background);
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid var(--b3-border-color);
}

.tm-quick-tag:hover {
  border-color: var(--b3-theme-primary);
}

.tm-quick-tag.is-included {
  background: var(--b3-theme-primary);
  color: #fff;
}

.tm-quick-tag.is-excluded {
  background: #dc3545;
  color: #fff;
}

.tm-results-header {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
}

.tm-card-stream {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tm-card {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.tm-card:hover {
  border-color: var(--b3-theme-primary);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.tm-card-doc {
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 4px;
  color: var(--b3-theme-primary);
}

.tm-card-content {
  font-size: 12px;
  line-height: 1.5;
  color: var(--b3-theme-on-surface);
  max-height: 48px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tm-card-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 10px;
  color: var(--b3-theme-on-surface-light);
}

/* 认知图谱与生命周期 */
.tm-graph-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--b3-theme-surface);
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--b3-border-color);
  margin-bottom: 8px;
}

.tm-graph-stat {
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.tm-graph-hint {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
}

.tm-network-box {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 8px;
}

.tm-network-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.tm-select-tag {
  flex: 1;
}

.tm-timeline-stats-card {
  background: var(--b3-theme-background);
  border-radius: 6px;
  padding: 8px 10px;
  border: 1px solid var(--b3-border-color);
  margin-bottom: 8px;
}

.tm-timeline-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.tm-timeline-trend-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
}

.trend-rising { background: rgba(40, 167, 69, 0.15); color: #28a745; }
.trend-cooling { background: rgba(108, 117, 125, 0.15); color: #6c757d; }
.trend-stable { background: rgba(0, 123, 255, 0.15); color: #007bff; }

.tm-timeline-last-updated {
  font-size: 10px;
  color: var(--b3-theme-on-surface-light);
}

.tm-timeline-grid {
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.tm-timeline-metric {
  flex: 1;
}

.tm-metric-val {
  font-size: 16px;
  font-weight: 700;
}

.tm-metric-lbl {
  font-size: 10px;
  color: var(--b3-theme-on-surface-light);
}

.tm-associated-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tm-assoc-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  padding: 6px 10px;
  border-radius: 4px;
}

.tm-assoc-info {
  display: flex;
  flex-direction: column;
}

.tm-assoc-label {
  font-weight: 600;
  font-size: 12px;
  color: var(--b3-theme-primary);
}

.tm-assoc-meta {
  font-size: 10px;
  color: var(--b3-theme-on-surface-light);
  margin-top: 2px;
}

.tm-graph-links-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tm-links-scroller {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tm-link-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.tm-link-row:hover {
  border-color: var(--b3-theme-primary);
}

.tm-link-badge {
  font-size: 10px;
  background: var(--b3-theme-primary-light);
  color: var(--b3-theme-primary);
  padding: 1px 6px;
  border-radius: 8px;
}

.tm-link-pair {
  font-weight: 500;
  font-size: 12px;
}

.tm-link-btn {
  font-size: 10px;
  color: var(--b3-theme-primary);
}

/* 色彩调色板 */
.tm-color-palette {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.tm-color-swatch {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  font-size: 12px;
  border: 1px solid var(--b3-border-color);
}

.tm-form-row {
  display: flex;
}

/* 健康体检 */
.tm-health-dash {
  display: flex;
  gap: 12px;
  background: var(--b3-theme-surface);
  padding: 12px;
  border-radius: 6px;
  border: 1px solid var(--b3-border-color);
  margin-bottom: 12px;
}

.tm-health-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border-right: 1px solid var(--b3-border-color);
}

.tm-score-num {
  font-size: 24px;
  font-weight: 700;
  color: #28a745;
}

.tm-score-lbl {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
}

.tm-stat-grid {
  display: flex;
  flex: 1;
  justify-content: space-around;
  align-items: center;
}

.tm-stat-card {
  text-align: center;
}

.tm-stat-val {
  font-size: 18px;
  font-weight: 700;
}

.text-warning { color: #f39c12; }
.text-info { color: #17a2b8; }
.text-danger { color: #e74c3c; }

.tm-issues-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tm-issue-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  padding: 8px 12px;
  border-radius: 6px;
  gap: 8px;
}

.tm-issue-card.is-warning {
  border-left: 4px solid #f39c12;
}

.tm-issue-card.is-info {
  border-left: 4px solid #17a2b8;
}

.tm-issue-info {
  flex: 1;
}

.tm-issue-title {
  font-weight: 600;
  font-size: 12px;
}

.tm-issue-desc {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  margin-top: 2px;
}

.tm-empty, .tm-empty-success {
  text-align: center;
  padding: 30px;
  color: var(--b3-theme-on-surface-light);
}

.tm-empty-success {
  color: #28a745;
  font-weight: 500;
}

/* 弹窗 */
.tm-modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.tm-modal-card {
  background: var(--b3-theme-surface);
  border-radius: 8px;
  width: 400px;
  padding: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.tm-modal-title {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 12px;
}

.tm-modal-body {
  margin-bottom: 16px;
}

.tm-form-group {
  margin: 10px 0;
}

.tm-form-group label {
  display: block;
  font-size: 12px;
  margin-bottom: 4px;
}

.tm-form-checkbox {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
}

.tm-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
