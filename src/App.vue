<template>
  <div class="tag-manager-container" @click="closeRowMenu">
    <!-- 顶部工作台标题栏与快捷操作 -->
    <header class="tm-header">
      <div class="tm-title-row">
        <div class="tm-brand">
          <span class="tm-brand-icon">
            <SyLineIcon name="tag" :size="16" />
          </span>
          <span class="tm-brand-title">标签管家</span>
          <span class="tm-tag-badge">{{ allTags.length }} 个标签</span>
        </div>
        <div class="tm-actions">
          <button
            class="tm-icon-btn tm-btn-sm"
            v-tooltip="'批量为文档打标'"
            @click="batchModal.visible = true"
          >
            <SyLineIcon name="layers-plus" :size="14" />
          </button>
          <button
            class="tm-icon-btn tm-btn-sm"
            :disabled="loading"
            v-tooltip="'刷新全库标签数据'"
            @click="refreshTags"
          >
            <SyLineIcon name="refresh-cw" :size="14" :spin="loading" />
          </button>
          <button
            class="tm-icon-btn tm-btn-sm"
            v-tooltip="'折叠标签管家侧栏'"
            @click="closePanel"
          >
            <SyLineIcon name="close" :size="14" />
          </button>
        </div>
      </div>

      <!-- 选项卡导航 (统一显式线框图标) -->
      <nav class="tm-nav-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tm-nav-tab"
          :class="{ active: currentTab === tab.id }"
          @click="switchTab(tab.id)"
        >
          <SyLineIcon :name="tab.iconName" :size="14" />
          <span class="tm-tab-name">{{ tab.name }}</span>
          <span v-if="tab.badge !== undefined && tab.badge > 0" class="tm-tab-badge">
            {{ tab.badge }}
          </span>
        </button>
      </nav>
    </header>

    <!-- 主体内容区域 -->
    <main class="tm-body">
      <!-- TAB 1: 标签全景资产树 -->
      <section v-if="currentTab === 'tree'" class="tm-tab-content">
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
              <div class="tm-node-content" @click="handleTagClick(node.label, $event)">
                <span
                  class="tm-node-name"
                  :style="getTagStyle(node.label)"
                  :title="`${node.label}（点击仅筛选此标签，按住 Ctrl/Shift 可追加组合）`"
                >
                  <span v-if="getTagIcon(node.label)" class="tm-custom-icon">{{ getTagIcon(node.label) }}</span>
                  <SyLineIcon v-else name="hash" :size="12" class="tm-default-hash" />
                  {{ node.name }}
                </span>
                <span class="tm-node-count" v-tooltip="`全库共 ${node.count} 处引用`">{{ node.count }}</span>
              </div>

              <!-- 渐进式暴露操作区：仅暴露高频筛选 + 更多菜单，彻底解决 Fitts's Law 痛点 -->
              <div class="tm-node-actions">
                <button
                  class="tm-icon-btn tm-action-btn"
                  v-tooltip="'加入即时组合筛选 (AND)'"
                  @click.stop="handleQuickFilter(node.label, true)"
                >
                  <SyLineIcon name="search-plus" :size="13" />
                </button>
                <button
                  class="tm-icon-btn tm-action-btn"
                  v-tooltip="'更多操作选项'"
                  @click.stop="openRowMenu(node.label, $event)"
                >
                  <SyLineIcon name="more-horizontal" :size="13" />
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
            <SyLineIcon name="bookmark-star" :size="14" class="tm-views-icon" />
            <select v-model="selectedSmartViewId" class="b3-select tm-views-select" @change="applySmartView">
              <option value="">-- 选择或切换常用智能视图 --</option>
              <option v-for="v in savedViews" :key="v.id" :value="v.id">
                {{ v.title }}
              </option>
            </select>
            <button
              class="b3-button b3-button--outline tm-btn-sm"
              :disabled="activeFilter.includeTags.length === 0 && activeFilter.excludeTags.length === 0"
              v-tooltip="'将当前组合保存为智能视图'"
              @click="openSaveViewDialog"
            >
              <SyLineIcon name="save" :size="12" />
              <span>保存</span>
            </button>
          </div>
        </div>

        <!-- 激活的筛选条件池 (紧凑胶囊) -->
        <div class="tm-filter-box">
          <div class="tm-section-hint">
            <span>点击切换：</span>
            <b class="text-primary">AND (必含)</b>
            <span> | </span>
            <b class="text-danger">NOT (排除)</b>
          </div>
          <div class="tm-active-chips">
            <div
              v-for="tag in activeFilter.includeTags"
              :key="`inc-${tag}`"
              class="tm-chip tm-chip--inc"
              v-tooltip="'点击切换为排除 (NOT)'"
              @click="toggleTagCondition(tag, 'exclude')"
            >
              <span class="tm-chip-indicator"></span>
              <span class="tm-chip-prefix">AND</span>
              <span class="tm-chip-label">#{{ tag }}</span>
              <span class="tm-chip-remove" v-tooltip="'移除此条件'" @click.stop="removeFilterTag(tag)">
                <SyLineIcon name="close" :size="10" />
              </span>
            </div>
            <div
              v-for="tag in activeFilter.excludeTags"
              :key="`exc-${tag}`"
              class="tm-chip tm-chip--exc"
              v-tooltip="'点击切换为包含 (AND)'"
              @click="toggleTagCondition(tag, 'include')"
            >
              <span class="tm-chip-indicator"></span>
              <span class="tm-chip-prefix">NOT</span>
              <span class="tm-chip-label">#{{ tag }}</span>
              <span class="tm-chip-remove" v-tooltip="'移除此条件'" @click.stop="removeFilterTag(tag)">
                <SyLineIcon name="close" :size="10" />
              </span>
            </div>
            <div v-if="activeFilter.includeTags.length === 0 && activeFilter.excludeTags.length === 0" class="tm-filter-placeholder">
              <SyLineIcon name="filter-funnel" :size="12" style="margin-right: 5px; opacity: 0.7;" />
              <span>点击下方候选标签，展开多维交叉组合检索</span>
            </div>
          </div>

          <!-- 快速候选标签流 (可折叠) -->
          <div class="tm-quick-tags-wrapper">
            <div class="tm-quick-tags" :class="{ 'is-expanded': expandQuickTags }">
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
                #{{ tag.label }} <small>({{ tag.count }})</small>
              </span>
            </div>
            <button
              v-if="allTags.length > 12"
              class="tm-quick-expand-btn"
              @click="expandQuickTags = !expandQuickTags"
            >
              {{ expandQuickTags ? '收起候选' : `展开更多 (${topQuickTags.length})` }}
              <SyLineIcon :name="expandQuickTags ? 'chevron-down' : 'chevron-right'" :size="10" />
            </button>
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
            @click="jumpToBlock(block.rootId, block.id)"
          >
            <div class="tm-card-doc">
              <SyLineIcon name="file-up" :size="13" class="tm-doc-icon" />
              <span>{{ block.docTitle }}</span>
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
      </section>

      <!-- TAB 3: 认知图谱与生命周期分析 -->
      <section v-if="currentTab === 'graph'" class="tm-tab-content">
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
            <select v-model="selectedGraphTag" class="b3-select tm-select-tag" @change="onFocusTagChange">
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
                class="b3-button b3-button--outline tm-btn-sm"
                v-tooltip="'与聚焦标签联合筛选'"
                @click="combineFilterWithAssociated(selectedGraphTag, item.label)"
              >
                <SyLineIcon name="search-plus" :size="12" />
                <span>组合筛选</span>
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
      </section>

      <!-- TAB 4: 标签治理与健康体检 -->
      <section v-if="currentTab === 'hygiene'" class="tm-tab-content">
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
                @click="autoResolveIssue(issue)"
              >
                <SyLineIcon name="git-merge" :size="12" />
                <span>一键合并规范</span>
              </button>
              <button
                v-else-if="issue.suggestedAction === 'clean'"
                class="b3-button b3-button--cancel tm-btn-sm"
                v-tooltip="'彻底清理并从全库移除此无用标签'"
                @click="handleRemoveTag(issue.primaryLabel)"
              >
                <SyLineIcon name="trash" :size="12" />
                <span>清理删除</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- 浮动行内菜单 (Floating Action Popover, 替代臃肿平铺按钮) -->
    <div
      v-if="rowMenu.visible"
      class="tm-row-menu"
      :style="{ top: `${rowMenu.top}px`, left: `${rowMenu.left}px` }"
      @click.stop
    >
      <div class="tm-row-menu-header">
        <SyLineIcon name="tag" :size="12" />
        <span class="tm-row-menu-title">#{{ rowMenu.label }}</span>
      </div>
      <div class="tm-row-menu-item" @click="handleRowAction('style')">
        <SyLineIcon name="palette" :size="13" />
        <span>定制色彩与别名</span>
      </div>
      <div class="tm-row-menu-item" @click="handleRowAction('doc')">
        <SyLineIcon name="file-up" :size="13" />
        <span>升格为主题聚合文档</span>
      </div>
      <div class="tm-row-menu-item" @click="handleRowAction('graph')">
        <SyLineIcon name="git-fork-nodes" :size="13" />
        <span>查看共现图谱与时序</span>
      </div>
      <div class="tm-row-menu-item" @click="handleRowAction('merge')">
        <SyLineIcon name="git-merge" :size="13" />
        <span>重构合并到其他标签...</span>
      </div>
      <div class="tm-row-menu-divider"></div>
      <div class="tm-row-menu-item is-danger" @click="handleRowAction('remove')">
        <SyLineIcon name="trash" :size="13" />
        <span>从全库安全删除标签</span>
      </div>
    </div>

    <!-- 样式与别名设置弹窗 (双主题自适应调色板) -->
    <div v-if="styleModal.visible" class="tm-modal-mask" @click.self="styleModal.visible = false">
      <div class="tm-modal-card">
        <div class="tm-modal-title">
          <SyLineIcon name="palette" :size="16" />
          <span>设置标签样式与别名</span>
        </div>
        <div class="tm-modal-body">
          <p class="tm-modal-target">正在定制标签：<b>#{{ styleModal.label }}#</b></p>

          <!-- 8 组精调双主题自适应色盘预设 -->
          <div class="tm-form-group">
            <label>预设双主题自适应色彩 (Light / Dark 智能对偶)：</label>
            <div class="tm-color-palette-grid">
              <div
                v-for="preset in DUAL_THEME_COLOR_PRESETS"
                :key="preset.id"
                class="tm-preset-card"
                :class="{ 'is-selected': styleModal.presetId === preset.id }"
                @click="applyDualThemePreset(preset)"
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

          <div class="tm-form-row">
            <div class="tm-form-group fn__flex-1">
              <label>背景颜色 (Hex):</label>
              <input v-model="styleModal.backgroundColor" class="b3-text-field fn__block" placeholder="#EBF3FE" />
            </div>
            <div class="tm-form-group fn__flex-1" style="margin-left: 8px;">
              <label>文字颜色 (Hex):</label>
              <input v-model="styleModal.textColor" class="b3-text-field fn__block" placeholder="#1A56DB" />
            </div>
          </div>
          <div class="tm-form-group">
            <label>自定义 Emoji / 符号前缀：</label>
            <input v-model="styleModal.icon" class="b3-text-field fn__block" placeholder="例如：🎬, 💡, 🚀, 💻" />
          </div>
          <div class="tm-form-group">
            <label>别名列表（逗号分隔，支持拼音首字母如 ytb 检索）：</label>
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
        <div class="tm-modal-title">
          <SyLineIcon name="save" :size="16" />
          <span>保存为智能视图</span>
        </div>
        <div class="tm-modal-body">
          <div class="tm-form-group">
            <label>视图名称：</label>
            <input
              v-model="saveViewModal.title"
              class="b3-text-field fn__block"
              placeholder="例如：AI视频与提示词重点"
              @keydown.enter="confirmSaveSmartView"
            />
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
        <div class="tm-modal-title">
          <SyLineIcon name="layers-plus" :size="16" />
          <span>批量文档打标</span>
        </div>
        <div class="tm-modal-body">
          <div class="tm-form-group">
            <label>目标文档 ID (每行一个 ID)：</label>
            <textarea
              v-model="batchModal.docIdsText"
              class="b3-text-field fn__block"
              rows="3"
              placeholder="粘贴思源文档块 ID，例如 20260926080000-xxxxxxx"
            ></textarea>
          </div>
          <div class="tm-form-group">
            <label>待添加的标签（支持多个，逗号分隔）：</label>
            <input
              v-model="batchModal.tagsText"
              class="b3-text-field fn__block"
              placeholder="例如：YouTube, AI, 产品设计"
            />
          </div>
        </div>
        <div class="tm-modal-footer">
          <button class="b3-button b3-button--cancel" @click="batchModal.visible = false">取消</button>
          <button class="b3-button b3-button--primary" :disabled="batchModal.executing" @click="executeBatchTag">
            {{ batchModal.executing ? '执行打标中...' : '开始批量打标' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 合并重构对话弹窗 -->
    <div v-if="mergeModal.visible" class="tm-modal-mask" @click.self="mergeModal.visible = false">
      <div class="tm-modal-card">
        <div class="tm-modal-title">
          <SyLineIcon name="git-merge" :size="16" />
          <span>标签重构与合并</span>
        </div>
        <div class="tm-modal-body">
          <p class="tm-modal-target">将源标签 <b>#{{ mergeModal.sourceLabel }}#</b> 合并到目标标签：</p>
          <div class="tm-form-group">
            <label>目标规范化标签名称：</label>
            <input
              v-model="mergeModal.targetLabel"
              class="b3-text-field fn__block"
              placeholder="例如：Prompt 或 tech/python"
              @keydown.enter="confirmMerge"
            />
          </div>
          <div class="tm-form-checkbox">
            <label>
              <input v-model="mergeModal.setAsAlias" type="checkbox" />
              合并后将原名 "{{ mergeModal.sourceLabel }}" 沉淀为别名
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
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { showMessage } from 'siyuan';
import type { ITagHealthIssue, ITagItem, ITagMatchedBlock, ITagMetadata, ISmartTagView } from './types/tag';
import { TagApiClient } from './services/TagApiClient';
import { TagTreeService, type TagSortMode } from './services/TagTreeService';
import { TagFilterEngine } from './services/TagFilterEngine';
import { TagGovernanceService } from './services/TagGovernanceService';
import { TagPinyinAliasService } from './services/TagPinyinAliasService';
import { TagBatchService } from './services/TagBatchService';
import { TagCooccurrenceService, type ITagGraphData } from './services/TagCooccurrenceService';
import { TagVisualService } from './services/TagVisualService';
import { TagDocConverterService } from './services/TagDocConverterService';
import { TagTimelineService, type ITagTimelineStats } from './services/TagTimelineService';
import { toggleTagManagerDock, usePlugin } from './main';
import SyLineIcon from './components/SiyuanTheme/SyLineIcon.vue';
import { DUAL_THEME_COLOR_PRESETS, type IColorPreset } from './styles/palette';

// 状态管理
const currentTab = ref<'tree' | 'filter' | 'graph' | 'hygiene'>('tree');
const loading = ref(false);
const allTags = ref<ITagItem[]>([]);
const searchKeyword = ref('');
const sortMode = ref<TagSortMode>('count_desc');

// 标签元数据映射表 Map<label, ITagMetadata>
const metadataMap = ref<Map<string, ITagMetadata>>(new Map());

// 树节点折叠状态控制
const collapsedSet = ref<Set<string>>(new Set());
const allCollapsed = ref(false);

// 快速候选标签折叠控制
const expandQuickTags = ref(false);

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

// 浮动行内菜单状态 (Floating Row Action Menu)
const rowMenu = ref<{
  visible: boolean;
  label: string;
  top: number;
  left: number;
}>({
  visible: false,
  label: '',
  top: 0,
  left: 0,
});

// 样式弹窗
const styleModal = ref({
  visible: false,
  label: '',
  presetId: '',
  backgroundColor: '',
  textColor: '',
  darkBackgroundColor: '',
  darkTextColor: '',
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
  { id: 'tree' as const, name: '标签全景', iconName: 'folder-tree' },
  { id: 'filter' as const, name: '多维筛选', iconName: 'filter-funnel', badge: activeFilter.value.includeTags.length + activeFilter.value.excludeTags.length },
  { id: 'graph' as const, name: '认知图谱', iconName: 'git-fork-nodes' },
  { id: 'hygiene' as const, name: '健康治理', iconName: 'shield-check', badge: healthResult.value.issues.length },
]);

const displayTreeNodes = computed(() => {
  if (!searchKeyword.value.trim()) {
    return TagTreeService.buildTree(allTags.value, sortMode.value);
  }
  const matches = TagPinyinAliasService.matchTags(allTags.value, searchKeyword.value, 50);
  return TagTreeService.buildTree(matches.map(m => m.tag), sortMode.value);
});

const topQuickTags = computed(() => {
  const limit = expandQuickTags.value ? 50 : 12;
  return allTags.value.slice(0, limit);
});

const topLinks = computed(() => {
  return [...graphData.value.links]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 15);
});

// 折叠逻辑辅助
function hasSubTags(label: string): boolean {
  return allTags.value.some(t => t.label.startsWith(`${label}/`) && t.label !== label);
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
    allTags.value.forEach(t => {
      if (hasSubTags(t.label)) {
        collapsedSet.value.add(t.label);
      }
    });
  } else {
    collapsedSet.value.clear();
  }
}

// 浮动更多操作菜单
function openRowMenu(label: string, event: MouseEvent) {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const menuWidth = 180;
  let left = rect.left - menuWidth + 24;
  if (left < 10) left = 10;
  let top = rect.bottom + 4;
  if (top + 200 > window.innerHeight) {
    top = rect.top - 200;
  }

  rowMenu.value = {
    visible: true,
    label,
    top,
    left,
  };
}

function closeRowMenu() {
  if (rowMenu.value.visible) {
    rowMenu.value.visible = false;
  }
}

function handleRowAction(action: 'style' | 'doc' | 'graph' | 'merge' | 'remove') {
  const label = rowMenu.value.label;
  closeRowMenu();
  if (action === 'style') {
    openStyleDialog(label);
  } else if (action === 'doc') {
    handleConvertToDoc(label);
  } else if (action === 'graph') {
    viewTagNetwork(label);
  } else if (action === 'merge') {
    openMergeDialog(label);
  } else if (action === 'remove') {
    handleRemoveTag(label);
  }
}

function getTagIcon(label: string): string {
  return metadataMap.value.get(label)?.icon || '';
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
  closeRowMenu();
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

// 样式与别名设置 (双主题自适应)
function openStyleDialog(label: string) {
  const meta = metadataMap.value.get(label);
  styleModal.value = {
    visible: true,
    label,
    presetId: meta?.groupId || '',
    backgroundColor: meta?.backgroundColor || '',
    textColor: meta?.textColor || '',
    darkBackgroundColor: meta?.darkBackgroundColor || '',
    darkTextColor: meta?.darkTextColor || '',
    icon: meta?.icon || '',
    aliasesText: (meta?.aliases || []).join(', '),
  };
}

function applyDualThemePreset(preset: IColorPreset) {
  styleModal.value.presetId = preset.id;
  styleModal.value.backgroundColor = preset.lightBg;
  styleModal.value.textColor = preset.lightText;
  styleModal.value.darkBackgroundColor = preset.darkBg;
  styleModal.value.darkTextColor = preset.darkText;
}

async function saveTagStyle() {
  const { label, presetId, backgroundColor, textColor, darkBackgroundColor, darkTextColor, icon, aliasesText } = styleModal.value;
  const aliases = aliasesText.split(',').map(s => s.trim()).filter(Boolean);

  const meta: ITagMetadata = {
    label,
    groupId: presetId || undefined,
    backgroundColor,
    textColor,
    darkBackgroundColor: darkBackgroundColor || undefined,
    darkTextColor: darkTextColor || undefined,
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
  showMessage(`已成功更新标签 "#${label}#" 的双主题样式与别名！`, 3000, 'info');
}

// 一键升格为实体文档 (Tag to Doc)
async function handleConvertToDoc(label: string) {
  loading.value = true;
  try {
    const blocks = await TagApiClient.queryMatchedBlocks({ includeTags: [label], limit: 30 });
    const res = await TagDocConverterService.createDocFromTag(label, blocks);
    if (res.success && res.docId) {
      showMessage(`已成功创建主题聚合文档《${label}》！`, 4000, 'info');
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

function handleTagClick(label: string, event?: MouseEvent) {
  const isAppend = Boolean(event && (event.ctrlKey || event.metaKey || event.shiftKey));
  handleQuickFilter(label, isAppend);
}

function handleQuickFilter(label: string, append = false) {
  currentTab.value = 'filter';
  selectedSmartViewId.value = '';
  activeFilter.value = TagFilterEngine.resolveFilterSelection(activeFilter.value, label, append);
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

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (rowMenu.value.visible) {
      rowMenu.value.visible = false;
      return;
    }
    if (styleModal.value.visible) {
      styleModal.value.visible = false;
      return;
    }
    if (saveViewModal.value.visible) {
      saveViewModal.value.visible = false;
      return;
    }
    if (batchModal.value.visible) {
      batchModal.value.visible = false;
      return;
    }
    if (mergeModal.value.visible) {
      mergeModal.value.visible = false;
      return;
    }
    // 无弹窗时关闭侧栏
    closePanel();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
  refreshTags();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
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
  font-family: var(--b3-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  font-size: 13px;
  overflow: hidden;
  box-sizing: border-box;
  position: relative;
}

/* 顶部标题行 */
.tm-header {
  border-bottom: 1px solid var(--b3-border-color);
  padding: 8px 12px 0 12px;
  background: var(--b3-theme-surface);
  flex-shrink: 0;
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

.tm-brand-icon {
  display: inline-flex;
  color: var(--b3-theme-primary);
}

.tm-tag-badge {
  font-size: 11px;
  background: var(--b3-theme-primary-light);
  color: var(--b3-theme-primary);
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 500;
}

.tm-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tm-btn-sm {
  width: 24px;
  height: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* 选项卡导航 */
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
  gap: 5px;
  transition: all 0.15s ease;
  user-select: none;
}

.tm-nav-tab:hover {
  background: var(--b3-theme-background-light);
  color: var(--b3-theme-primary);
}

.tm-nav-tab.active {
  color: var(--b3-theme-primary);
  border-bottom-color: var(--b3-theme-primary);
  font-weight: 600;
}

.tm-tab-badge {
  font-size: 10px;
  background: var(--b3-theme-primary);
  color: #fff;
  padding: 0 4px;
  border-radius: 8px;
  font-weight: bold;
}

/* 主体容器 */
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

/* 搜索与工具栏 */
.tm-filter-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.tm-search-box {
  display: flex;
  align-items: center;
  position: relative;
}

.tm-search-icon {
  position: absolute;
  left: 8px;
  color: var(--b3-theme-on-surface-light);
  pointer-events: none;
}

.tm-search-input {
  width: 100%;
  padding-left: 26px !important;
  padding-right: 22px !important;
  font-size: 12px;
  height: 28px;
}

.tm-clear-btn {
  position: absolute;
  right: 4px;
  width: 18px;
  height: 18px;
  padding: 0;
}

.tm-filter-tools {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tm-sort-select {
  font-size: 11px;
  height: 28px;
  padding: 0 6px;
}

/* 树节点列表 */
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
  padding: 3px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
  min-height: 26px;
}

.tm-tree-node:hover {
  background: var(--b3-theme-background-light);
}

.tm-node-expander {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--b3-theme-on-surface-light);
  cursor: pointer;
  margin-right: 2px;
  flex-shrink: 0;
}

.tm-node-expander.is-leaf {
  visibility: hidden;
}

.tm-node-content {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  overflow: hidden;
}

.tm-node-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.tm-default-hash {
  opacity: 0.5;
}

.tm-custom-icon {
  font-size: 12px;
}

.tm-node-count {
  font-size: 10px;
  color: var(--b3-theme-on-surface-light);
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  padding: 0 4px;
  border-radius: 8px;
  font-family: var(--b3-font-family-code, monospace);
  flex-shrink: 0;
}

.tm-node-actions {
  display: none;
  align-items: center;
  gap: 2px;
  margin-left: 4px;
  flex-shrink: 0;
}

.tm-tree-node:hover .tm-node-actions {
  display: flex;
}

.tm-action-btn {
  width: 20px;
  height: 20px;
  padding: 0;
}

/* 浮动右键/更多菜单 */
.tm-row-menu {
  position: fixed;
  z-index: 99999;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  padding: 4px 0;
  width: 180px;
  backdrop-filter: blur(8px);
}

.tm-row-menu-header {
  padding: 4px 10px;
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  border-bottom: 1px solid var(--b3-border-color);
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tm-row-menu-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
}

.tm-row-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
  transition: all 0.12s ease;
}

.tm-row-menu-item:hover {
  background: var(--b3-theme-background-light);
  color: var(--b3-theme-primary);
}

.tm-row-menu-item.is-danger {
  color: #dc3545;
}

.tm-row-menu-item.is-danger:hover {
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}

.tm-row-menu-divider {
  height: 1px;
  background: var(--b3-border-color);
  margin: 4px 0;
}

/* 智能视图栏 */
.tm-views-toolbar {
  margin-bottom: 8px;
}

.tm-views-select-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tm-views-icon {
  color: var(--b3-theme-primary);
}

.tm-views-select {
  flex: 1;
  font-size: 12px;
  height: 28px;
}

/* 筛选条件池 */
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
  transition: all 0.15s ease;
}

.tm-chip-indicator {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.tm-chip--inc {
  background: var(--b3-theme-primary-light);
  color: var(--b3-theme-primary);
  border: 1px solid var(--b3-theme-primary);
}
.tm-chip--inc .tm-chip-indicator {
  background: var(--b3-theme-primary);
}

.tm-chip--exc {
  background: rgba(220, 53, 69, 0.12);
  color: #dc3545;
  border: 1px solid #dc3545;
  text-decoration: line-through;
}
.tm-chip--exc .tm-chip-indicator {
  background: #dc3545;
}

.tm-chip-prefix {
  font-weight: 700;
  font-size: 9px;
}

.tm-chip-label {
  font-weight: 500;
}

.tm-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 2px;
  opacity: 0.6;
}
.tm-chip-remove:hover {
  opacity: 1;
}

.tm-filter-placeholder {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  display: flex;
  align-items: center;
}

.tm-quick-tags-wrapper {
  margin-top: 8px;
  border-top: 1px dashed var(--b3-border-color);
  padding-top: 6px;
}

.tm-quick-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-height: 52px;
  overflow: hidden;
  transition: max-height 0.2s ease;
}

.tm-quick-tags.is-expanded {
  max-height: 160px;
  overflow-y: auto;
}

.tm-quick-tag {
  font-size: 11px;
  background: var(--b3-theme-background);
  padding: 1px 6px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid var(--b3-border-color);
  color: var(--b3-theme-on-surface);
  transition: all 0.15s ease;
}

.tm-quick-tag:hover {
  border-color: var(--b3-theme-primary);
  color: var(--b3-theme-primary);
}

.tm-quick-tag.is-included {
  background: var(--b3-theme-primary);
  color: #fff;
  border-color: var(--b3-theme-primary);
}

.tm-quick-tag.is-excluded {
  background: #dc3545;
  color: #fff;
  border-color: #dc3545;
}

.tm-quick-expand-btn {
  border: none;
  background: transparent;
  color: var(--b3-theme-primary);
  font-size: 10px;
  padding: 2px 4px;
  cursor: pointer;
  margin-top: 4px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.tm-results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
}

.tm-loading-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--b3-theme-primary);
  font-size: 11px;
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
  transition: all 0.15s ease;
}

.tm-card:hover {
  border-color: var(--b3-theme-primary);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.tm-card-doc {
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 4px;
  color: var(--b3-theme-primary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.tm-card-content {
  font-size: 12px;
  line-height: 1.5;
  color: var(--b3-theme-on-surface);
  max-height: 48px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tm-matched-tag {
  background-color: var(--b3-theme-primary-light);
  color: var(--b3-theme-primary);
  padding: 0 3px;
  border-radius: 3px;
  font-weight: 500;
}

.tm-card-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 10px;
  color: var(--b3-theme-on-surface-light);
}

.tm-card-jump {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--b3-theme-primary);
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

.tm-label-title {
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
}

.tm-select-tag {
  flex: 1;
  font-size: 12px;
  height: 28px;
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
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.trend-rising {
  background: rgba(40, 167, 69, 0.15);
  color: #28a745;
}
.trend-cooling {
  background: rgba(108, 117, 125, 0.15);
  color: #6c757d;
}
.trend-stable {
  background: rgba(0, 123, 255, 0.15);
  color: #007bff;
}

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
  transition: all 0.15s ease;
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
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tm-link-pair {
  font-weight: 500;
  font-size: 12px;
}

.tm-link-btn {
  font-size: 10px;
  color: var(--b3-theme-primary);
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

/* 标签健康治理 */
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
}

.tm-score-num.is-good {
  color: #28a745;
}
.tm-score-num.is-warn {
  color: #f39c12;
}
.tm-score-num.is-danger {
  color: #e74c3c;
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
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.text-warning {
  color: #f39c12;
}
.text-info {
  color: #17a2b8;
}
.text-danger {
  color: #e74c3c;
}

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

.tm-issue-icon {
  display: flex;
  align-items: center;
  color: var(--b3-theme-on-surface-light);
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

.tm-issue-op {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tm-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--b3-theme-on-surface-light);
}

.tm-empty-icon {
  opacity: 0.35;
  margin-bottom: 8px;
}

.tm-empty-text {
  font-size: 12px;
}

.tm-empty-hint {
  padding: 12px;
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  text-align: center;
}

.tm-empty-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  color: #28a745;
  font-weight: 500;
  gap: 8px;
  text-align: center;
}

.tm-success-icon {
  color: #28a745;
}

/* 模态对话框 */
.tm-modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
}

.tm-modal-card {
  background: var(--b3-theme-surface);
  border-radius: 8px;
  width: 440px;
  max-width: 90vw;
  padding: 16px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  border: 1px solid var(--b3-border-color);
  animation: tm-modal-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes tm-modal-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.tm-modal-title {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--b3-theme-on-surface);
}

.tm-modal-target {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
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
  color: var(--b3-theme-on-surface-light);
}

/* 双主题调色板网格 */
.tm-color-palette-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-bottom: 8px;
}

.tm-preset-card {
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  padding: 4px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: var(--b3-theme-background);
  transition: all 0.15s ease;
}

.tm-preset-card:hover {
  border-color: var(--b3-theme-primary);
}

.tm-preset-card.is-selected {
  border-color: var(--b3-theme-primary);
  background: var(--b3-theme-primary-light);
}

.tm-preset-preview {
  display: flex;
  gap: 2px;
}

.tm-preset-chip {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
}

.tm-preset-name {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
}

.tm-form-row {
  display: flex;
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
