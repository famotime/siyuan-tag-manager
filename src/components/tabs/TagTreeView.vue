<template>
  <div class="tm-tab-content">
    <!-- 1. 搜索工具栏 -->
    <div class="tm-filter-bar">
      <div class="tm-search-box fn__flex-1">
        <SyLineIcon name="search" :size="13" class="tm-search-icon" />
        <input
          v-model="searchKeyword"
          class="b3-text-field tm-search-input"
          :class="{ 'has-create-hint': canCreateTag && displayTreeNodes.length === 0 }"
          placeholder="搜索标签（支持拼音首字母如 ytb、别名）..."
          @focus="refreshActiveContext"
          @keydown.enter.prevent="handleSearchEnter"
        />
        <span
          v-if="canCreateTag && displayTreeNodes.length === 0"
          class="tm-search-enter-badge"
          v-tooltip="'未找到匹配标签，按 Enter 键直接添加至侧面板'"
          @click="triggerCreateTag"
        >
          <SyLineIcon name="corner-down-left" :size="9" />
          <span>回车添加</span>
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

    <!-- 2. 常用标签组预设折叠区 (默认折叠) -->
    <div class="tm-accordion-section tm-groups-section" :class="{ 'is-collapsed': !groupsExpanded }">
      <div class="tm-accordion-header" @click="groupsExpanded = !groupsExpanded">
        <div class="tm-accordion-title">
          <SyLineIcon :name="groupsExpanded ? 'chevron-down' : 'chevron-right'" :size="11" />
          <SyLineIcon name="layers-plus" :size="13" class="tm-accordion-icon" />
          <span>常用标签组</span>
          <span class="tm-accordion-badge">{{ (tagGroups || []).length }}</span>
        </div>
        <div class="tm-accordion-actions" @click.stop>
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
                  v-tooltip="'套用此组到当前打开的文档'"
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
                :data-tag="t"
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

    <!-- 3. 标签全景可折叠条 (默认展开，零间隙弹性伸缩) -->
    <div
      class="tm-accordion-section tm-panorama-section"
      :class="{
        'is-expanded': panoramaExpanded,
        'is-collapsed': !panoramaExpanded,
      }"
    >
      <div class="tm-accordion-header" @click="panoramaExpanded = !panoramaExpanded">
        <div class="tm-accordion-title">
          <SyLineIcon :name="panoramaExpanded ? 'chevron-down' : 'chevron-right'" :size="11" />
          <SyLineIcon name="folder-tree" :size="13" class="tm-accordion-icon" />
          <span>标签全景</span>
          <span class="tm-accordion-badge">{{ virtualAllTags.length }}</span>
        </div>
        <div class="tm-accordion-actions" @click.stop>
          <button
            class="tm-icon-btn tm-btn-xs"
            v-tooltip="allCollapsed ? '展开全景所有层级' : '折叠全景所有层级'"
            @click="toggleCollapseAll"
          >
            <SyLineIcon :name="allCollapsed ? 'chevron-right' : 'chevron-down'" :size="12" />
          </button>
          <select v-model="sortMode" class="b3-select tm-sort-select" v-tooltip="'切换标签全景排序方式'">
            <option value="count_desc">引用数 ↓</option>
            <option value="count_asc">引用数 ↑</option>
            <option value="name_asc">拼音 A→Z</option>
            <option value="name_desc">拼音 Z→A</option>
          </select>
        </div>
      </div>

      <div v-show="panoramaExpanded" class="tm-panorama-body fn__flex-1 fn__flex-column" style="display: flex; min-height: 0; overflow: hidden; background: var(--b3-theme-background);">
        <!-- 待保存变动操作条 -->
        <div v-if="stagedMoves.length > 0" class="tm-staged-banner">
          <div class="tm-staged-info">
            <SyLineIcon name="alert-triangle" :size="12" />
            <span>已暂存 <strong>{{ stagedMoves.length }}</strong> 项层级调整</span>
          </div>
          <div class="tm-staged-actions">
            <button
              class="b3-button b3-button--cancel tm-btn-xs"
              style="padding: 2px 8px; font-size: 11px;"
              @click="handleDiscardStaged"
            >
              <SyLineIcon name="undo" :size="10" />
              <span>放弃</span>
            </button>
            <button
              class="b3-button b3-button--primary tm-btn-xs"
              style="padding: 2px 8px; font-size: 11px;"
              :disabled="isSavingStaged"
              @click="handleConfirmSaveStaged"
            >
              <SyLineIcon name="check" :size="10" />
              <span>{{ isSavingStaged ? '正在保存...' : '保存修改' }}</span>
            </button>
          </div>
        </div>


        <!-- 多选状态控制横条 -->
        <div v-if="selectedTags && selectedTags.length > 0" class="tm-selection-bar" style="margin: 4px 8px;">
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

        <!-- 标签树滚动列表 (通过拖拽指示线直观显示归为子标签还是拖出为独立标签) -->
        <div
          class="tm-tree-scroller fn__flex-1"
          :class="{ 'is-scroller-drag-over': isDraggingOverScrollerBlank && isDraggingSubTag }"
          @dragover="handleScrollerDragOver"
          @dragleave="handleScrollerDragLeave"
          @drop="handleScrollerDrop"
        >

          <div v-if="displayTreeNodes.length === 0" class="tm-tree-empty-wrapper">
            <!-- 场景 A：无匹配项时的极简添加引导指示 -->
            <div v-if="searchKeyword.trim()" class="tm-empty-state tm-empty-state--create">
              <SyLineIcon name="tag" :size="28" class="tm-empty-icon" />
              <div class="tm-empty-text">未找到已有标签</div>

              <button
                v-if="canCreateTag"
                class="b3-button b3-button--outline tm-btn-create-compact"
                @click="triggerCreateTag"
              >
                <SyLineIcon name="plus" :size="12" />
                <span>添加 <strong>#{{ normalizedKeyword }}#</strong></span>
                <kbd class="tm-guide-kbd">↵ Enter</kbd>
              </button>

              <div v-else-if="!validationResult.valid" class="tm-guide-warning-row">
                <SyLineIcon name="alert-triangle" :size="12" />
                <span>{{ validationResult.error }}</span>
              </div>
            </div>

            <!-- 场景 B：默认空数据或全库未建立标签 -->
            <div v-else class="tm-empty-state">
              <SyLineIcon name="folder-tree" :size="32" class="tm-empty-icon" />
              <div class="tm-empty-text">
                {{ loading ? '正在加载标签资产...' : '未匹配到任何相关标签' }}
              </div>
            </div>
          </div>

          <div v-else class="tm-tree-nodes">
            <!-- 部分匹配但全库无同名标签时的快速新建提示条 -->
            <div v-if="canCreateTag && !hasExactMatch" class="tm-tree-create-banner" @click="triggerCreateTag">
              <div class="tm-banner-left">
                <SyLineIcon name="plus" :size="12" class="tm-banner-icon" />
                <span class="tm-banner-hint">可添加到侧面板：</span>
                <span class="tm-banner-tag">#{{ normalizedKeyword }}#</span>
              </div>
              <button class="tm-banner-action-btn" v-tooltip="'点击或在搜索框按 Enter 添加至侧面板'">
                <SyLineIcon name="corner-down-left" :size="10" />
                <span>回车添加</span>
              </button>
            </div>

            <div
              v-for="node in displayTreeNodes"
              v-show="isNodeVisible(node)"
              :key="node.label"
              :data-node-tag="node.label"
              class="tm-tree-node"
              :class="{
                'is-selected': isTagSelected(node.label),
                'is-drag-over-inside': dragIndicator?.nodeLabel === node.label && dragIndicator.position === 'inside',
                'tm-node-highlight': highlightedTagLabel === node.label,
              }"
              :style="{ paddingLeft: `${node.depth * 14 + 6}px` }"
              :draggable="editingLabel !== node.label"
              @dragstart="handleDragStart(node, $event)"
              @dragend="handleDragEnd"
              @dragover.prevent="handleDragOverNode(node, $event)"
              @dragleave="handleDragLeaveNode(node, $event)"
              @drop="handleDropOnNode(node, $event)"
            >
              <!-- 拖拽放置指示线：上边缘（拖出为独立根标签或同级） -->
              <div
                v-if="dragIndicator?.nodeLabel === node.label && dragIndicator.position === 'before'"
                class="tm-drop-indicator-line is-before"
                :class="dragIndicator.mode === 'root' ? 'is-root' : 'is-child'"
              >
                <span class="tm-indicator-dot"></span>
                <span class="tm-indicator-badge">
                  <SyLineIcon :name="dragIndicator.mode === 'root' ? 'corner-up-left' : 'corner-down-right'" :size="10" />
                  <span>{{ dragIndicator.mode === 'root' ? `拖出为独立标签 #${draggingLeafName}#` : `归入 #${node.name}# 为子标签` }}</span>
                </span>
              </div>

              <!-- 拖拽放置指示线：下边缘（拖出为独立根标签或同级） -->
              <div
                v-if="dragIndicator?.nodeLabel === node.label && dragIndicator.position === 'after'"
                class="tm-drop-indicator-line is-after"
                :class="dragIndicator.mode === 'root' ? 'is-root' : 'is-child'"
              >
                <span class="tm-indicator-dot"></span>
                <span class="tm-indicator-badge">
                  <SyLineIcon :name="dragIndicator.mode === 'root' ? 'corner-up-left' : 'corner-down-right'" :size="10" />
                  <span>{{ dragIndicator.mode === 'root' ? `拖出为独立标签 #${draggingLeafName}#` : `归入 #${node.name}# 为子标签` }}</span>
                </span>
              </div>

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
              <div
                v-if="editingLabel !== node.label"
                class="tm-node-content"
                @click="emit('tag-click', node.label, $event)"
              >
                <span
                  class="tm-node-name"
                  :data-tag="node.label"
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
                <span v-if="isTagStaged(node.label)" class="tm-staged-tag-badge" v-tooltip="'层级调整已暂存，点击上方保存修改生效'">待保存</span>
                <span class="tm-node-count" v-tooltip="formatNodeTooltip(node)">{{ node.count }}</span>
              </div>

              <!-- 行内就地重命名编辑输入框 -->
              <div
                v-else
                class="tm-node-inline-edit"
                @click.stop
              >
                <SyLineIcon name="hash" :size="12" class="tm-default-hash" />
                <input
                  ref="inlineInputRef"
                  v-model="inlineRenameValue"
                  class="b3-text-field tm-inline-rename-input"
                  :placeholder="node.name"
                  @keydown.enter.prevent="submitInlineRename(node)"
                  @keydown.esc.prevent="cancelInlineRename"
                  @blur="handleInlineRenameBlur(node)"
                />
                <button
                  class="tm-icon-btn tm-action-btn tm-btn-confirm"
                  v-tooltip="'确认重命名 (Enter)'"
                  @mousedown.prevent
                  @click.stop="submitInlineRename(node)"
                >
                  <SyLineIcon name="check" :size="12" />
                </button>
                <button
                  class="tm-icon-btn tm-action-btn"
                  v-tooltip="'取消 (Esc)'"
                  @mousedown.prevent
                  @click.stop="cancelInlineRename"
                >
                  <SyLineIcon name="close" :size="12" />
                </button>
              </div>

              <!-- 悬停放置子标签落位指示胶囊（中间区域，归为子标签） -->
              <span v-if="dragIndicator?.nodeLabel === node.label && dragIndicator.position === 'inside'" class="tm-drag-target-indicator">
                <SyLineIcon name="corner-down-right" :size="11" />
                <span>归入 #{{ node.name }}# 下作为子标签</span>
              </span>

              <!-- 操作区：即时筛选 + 定制色彩与别名 + 重命名标签 + 删除标签 + 更多菜单 -->
              <div v-if="editingLabel !== node.label" class="tm-node-actions">
                <button
                  class="tm-icon-btn tm-action-btn"
                  :class="{ 'is-active': isTagSelected(node.label) }"
                  v-tooltip="isTagSelected(node.label) ? '从组合筛选中移除' : '加入即时组合筛选 (AND)'"
                  @click.stop="emit('quick-filter', node.label, true)"
                >
                  <SyLineIcon name="search-plus" :size="13" />
                </button>
                <button
                  class="tm-icon-btn tm-action-btn"
                  v-tooltip="'定制色彩与别名'"
                  @click.stop="emit('edit-style', node.label)"
                >
                  <SyLineIcon name="palette" :size="13" />
                </button>
                <button
                  class="tm-icon-btn tm-action-btn"
                  v-tooltip="'重命名标签'"
                  @click.stop="startInlineRename(node)"
                >
                  <SyLineIcon name="edit" :size="13" />
                </button>
                <button
                  class="tm-icon-btn tm-action-btn tm-btn-danger"
                  v-tooltip="'删除标签'"
                  @click.stop="emit('remove-tag', node.label)"
                >
                  <SyLineIcon name="trash" :size="13" />
                </button>
                <button
                  class="tm-icon-btn tm-action-btn"
                  v-tooltip="'更多操作'"
                  @click.stop="emit('open-menu', node.label, $event)"
                >
                  <SyLineIcon name="more-horizontal" :size="13" />
                </button>
              </div>
            </div>

            <!-- 当拖拽到树底部留白区域时的指示线提示 -->
            <div
              v-if="isDraggingOverScrollerBlank && isDraggingSubTag"
              class="tm-drop-indicator-line is-scroller-bottom is-root"
            >
              <span class="tm-indicator-dot"></span>
              <span class="tm-indicator-badge">
                <SyLineIcon name="corner-up-left" :size="10" />
                <span>拖出为独立标签 #{{ draggingLeafName }}#</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. 标签热度可折叠条 (默认折叠，气泡词云与排行榜双模高颜值可视化) -->
    <div
      class="tm-accordion-section tm-heat-section"
      :class="{
        'is-standalone-expanded': heatExpanded && !panoramaExpanded,
        'is-dual-expanded': heatExpanded && panoramaExpanded,
        'is-collapsed': !heatExpanded,
      }"
    >
      <div class="tm-accordion-header" @click="heatExpanded = !heatExpanded">
        <div class="tm-accordion-title">
          <SyLineIcon :name="heatExpanded ? 'chevron-down' : 'chevron-right'" :size="11" />
          <SyLineIcon name="flame" :size="13" class="tm-accordion-icon" style="color: #f43f5e;" />
          <span>标签热度</span>
          <span class="tm-accordion-badge">{{ heatBadgeCount }}</span>
        </div>
      </div>

      <div v-show="heatExpanded" class="fn__flex-1 fn__flex-column" style="display: flex; min-height: 0; overflow: hidden; background: var(--b3-theme-background);">
        <!-- 热度信息汇总工具条 (展开后可见) -->
        <div class="tm-heat-toolbar">
          <div class="tm-heat-toolbar-header">
            <!-- 视图模式切换：词云 vs 排行榜 -->
            <div class="tm-vis-btn-group">
              <button
                class="tm-vis-toggle-btn"
                :class="{ 'is-active': visMode === 'cloud' }"
                v-tooltip="'气泡词云视图'"
                @click="visMode = 'cloud'"
              >
                <SyLineIcon name="cloud" :size="10" />
                <span>词云</span>
              </button>
              <button
                class="tm-vis-toggle-btn"
                :class="{ 'is-active': visMode === 'rank' }"
                v-tooltip="'热度排行榜视图'"
                @click="visMode = 'rank'"
              >
                <SyLineIcon name="bar-chart" :size="10" />
                <span>排行</span>
              </button>
            </div>

            <!-- 范围切换：TOP 20 / TOP 50 / 全部 -->
            <div class="tm-vis-btn-group">
              <button
                class="tm-vis-toggle-btn"
                :class="{ 'is-active': heatScope === 'top20' }"
                v-tooltip="'展示引用数最高的前 20 个标签'"
                @click="heatScope = 'top20'"
              >
                TOP 20
              </button>
              <button
                class="tm-vis-toggle-btn"
                :class="{ 'is-active': heatScope === 'top50' }"
                v-tooltip="'展示引用数最高的前 50 个标签'"
                @click="heatScope = 'top50'"
              >
                TOP 50
              </button>
              <button
                class="tm-vis-toggle-btn"
                :class="{ 'is-active': heatScope === 'all' }"
                v-tooltip="'展示全库所有标签'"
                @click="heatScope = 'all'"
              >
                全部
              </button>
            </div>
          </div>

          <div class="tm-heat-toolbar-info">
            <div class="tm-heat-stats">
              <span>
                共 <strong>{{ cloudTags.length }}</strong> 个{{ heatScope === 'all' ? '' : '高频' }}标签
                <template v-if="heatScope === 'all' && zeroCountTagCount > 0">
                  <span class="tm-heat-sub-count">（{{ activeTagCount }} 活跃 / {{ zeroCountTagCount }} 待用）</span>
                </template>
                · 全库 <strong>{{ totalHeatQuotes }}</strong> 处引用
              </span>
            </div>
          </div>
        </div>

        <!-- 空数据提示 -->
        <div v-if="cloudTags.length === 0" style="padding: 20px 0; text-align: center; font-size: 11px; color: var(--b3-theme-on-surface-light);">
          暂无标签热度数据
        </div>

        <!-- 模式 A：气泡色温词云 -->
        <div
          v-else-if="visMode === 'cloud'"
          class="tm-cloud-container fn__flex-1"
        >
          <div
            v-for="tag in cloudTags"
            :key="tag.label"
            class="tm-cloud-bubble"
            :class="getHeatTierClass(tag.count)"
            :style="{
              fontSize: `${computeCloudFontSize(tag.count)}px`,
              ...getTagStyle(tag.label),
            }"
            draggable="true"
            v-tooltip="getHeatTooltip(tag)"
            @click="handleCloudTagClick(tag.label)"
            @dragstart="handleCloudDragStart(tag, $event)"
            @dragend="handleDragEnd"
          >
            <span class="tm-bubble-name">#{{ tag.label }}#</span>
            <span class="tm-bubble-count">({{ tag.count }})</span>
          </div>
        </div>

        <!-- 模式 B：热度排行榜条形图 -->
        <div
          v-else
          class="tm-rank-container fn__flex-1"
        >
          <div
            v-for="(tag, idx) in cloudTags"
            :key="tag.label"
            class="tm-rank-item"
            draggable="true"
            v-tooltip="getHeatTooltip(tag)"
            @click="handleCloudTagClick(tag.label)"
            @dragstart="handleCloudDragStart(tag, $event)"
            @dragend="handleDragEnd"
          >
            <!-- 相对热度动态填充条 -->
            <div
              class="tm-rank-fill-bar"
              :style="{
                width: `${getRankBarWidth(tag.count)}%`,
                backgroundColor: getRankBarColor(idx),
              }"
            ></div>

            <div class="tm-rank-left">
              <span
                class="tm-rank-badge"
                :class="{
                  'is-top-1': idx === 0,
                  'is-top-2': idx === 1,
                  'is-top-3': idx === 2,
                }"
              >
                {{ idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}` }}
              </span>
              <span class="tm-rank-name" :style="getTagStyle(tag.label)">#{{ tag.label }}#</span>
            </div>

            <div class="tm-rank-right">
              <span class="tm-rank-percent">{{ formatPercent(tag.count) }}</span>
              <span class="tm-rank-count-badge">{{ tag.count }} 引用</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 拖拽/重构子标签即时确认对话框 -->
    <div v-if="reparentConfirmState.visible" class="tm-modal-mask" @click.self="reparentConfirmState.visible = false">
      <div class="tm-modal-card" style="max-width: 380px;">
        <div class="tm-modal-title">
          <SyLineIcon :name="reparentConfirmState.targetParentLabel ? 'corner-down-right' : 'corner-up-left'" :size="16" />
          <span>{{ reparentConfirmState.targetParentLabel ? '确认配置子标签' : '确认移出父级恢复为独立标签' }}</span>
        </div>
        <div class="tm-modal-body" style="font-size: 12px; line-height: 1.6;">
          <div v-if="reparentConfirmState.targetParentLabel">
            将标签 <strong style="color: var(--b3-theme-primary);">#{{ reparentConfirmState.srcLabel }}#</strong> 归入 <strong style="color: var(--b3-theme-primary);">#{{ reparentConfirmState.targetParentLabel }}#</strong> 下作为子标签？
          </div>
          <div v-else>
            将标签 <strong style="color: var(--b3-theme-primary);">#{{ reparentConfirmState.srcLabel }}#</strong> 脱离当前父级，恢复为顶级根标签？
          </div>

          <div style="margin: 10px 0; padding: 10px 12px; background: var(--b3-theme-background-light); border-radius: 6px; border: 1px solid var(--b3-border-color);">
            <div style="color: var(--b3-theme-on-surface-light); font-size: 11px; margin-bottom: 2px;">调整后完整标签名：</div>
            <div style="font-weight: 600; color: var(--b3-theme-primary); font-size: 13px;">
              #{{ reparentConfirmState.moves[0]?.newLabel }}#
            </div>
            <div v-if="reparentConfirmState.moves.length > 1" style="font-size: 10px; color: var(--b3-theme-on-surface-light); margin-top: 4px;">
              （其下属 {{ reparentConfirmState.moves.length - 1 }} 个子标签将同步级联移动）
            </div>
          </div>

          <div style="color: var(--b3-theme-on-surface-light); font-size: 11px; display: flex; align-items: center; gap: 4px;">
            <SyLineIcon name="info" :size="12" />
            <span>确认后将立即同步更新思源全库关联引用块。</span>
          </div>
        </div>

        <div class="tm-modal-footer">
          <button class="b3-button b3-button--cancel" @click="reparentConfirmState.visible = false">取消</button>
          <button class="b3-button b3-button--primary" :disabled="isExecutingReparent" @click="handleExecuteReparentDirectly">
            {{ isExecutingReparent ? '正在更新全库...' : '确认并立即应用' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 级联重命名子标签确认对话框 (自定义 DOM 弹窗，保证在 Electron 中鼠标指针正常可见且主题一致) -->
    <div v-if="cascadeRenameConfirmState.visible" class="tm-modal-mask" @click.self="cascadeRenameConfirmState.visible = false">
      <div class="tm-modal-card" style="max-width: 400px;">
        <div class="tm-modal-title">
          <SyLineIcon name="alert-triangle" :size="16" style="color: var(--b3-theme-primary);" />
          <span>确认级联重命名子标签</span>
        </div>
        <div class="tm-modal-body" style="font-size: 12px; line-height: 1.6;">
          <div>
            重命名标签 <strong style="color: var(--b3-theme-primary);">#{{ cascadeRenameConfirmState.oldLabel }}#</strong> 为 <strong style="color: var(--b3-theme-primary);">#{{ cascadeRenameConfirmState.newLabel }}#</strong> 将影响其下属子标签：
          </div>

          <div style="margin: 10px 0; padding: 10px 12px; background: var(--b3-theme-background-light); border-radius: 6px; border: 1px solid var(--b3-border-color);">
            <div style="font-weight: 500; margin-bottom: 4px;">
              包含 <span style="color: var(--b3-theme-primary); font-weight: 600;">{{ cascadeRenameConfirmState.childCount }}</span> 个下属子标签将同步级联变更：
            </div>
            <div style="font-size: 11px; color: var(--b3-theme-on-surface-light); font-family: var(--b3-font-family-code, monospace);">
              {{ cascadeRenameConfirmState.oldLabel }}/* → {{ cascadeRenameConfirmState.newLabel }}/*
            </div>
          </div>

          <div style="color: var(--b3-theme-on-surface-light); font-size: 11px; display: flex; align-items: center; gap: 4px;">
            <SyLineIcon name="info" :size="12" />
            <span>确认后将立即调用内核更新全库中所有关联引用块与元数据。</span>
          </div>
        </div>

        <div class="tm-modal-footer">
          <button class="b3-button b3-button--cancel" @click="cascadeRenameConfirmState.visible = false">取消</button>
          <button class="b3-button b3-button--primary" @click="confirmCascadeRename">
            确认并级联重命名
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { showMessage } from 'siyuan';
import type { ITagItem, ITagGroup } from '../../types/tag';
import { TagTreeService, type TagSortMode } from '../../services/TagTreeService';
import { TagPinyinAliasService } from '../../services/TagPinyinAliasService';
import { TagCreationService } from '../../services/TagCreationService';
import { TagGroupService } from '../../services/TagGroupService';
import { TagDropService } from '../../services/TagDropService';
import { TagGovernanceService } from '../../services/TagGovernanceService';
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
  (e: 'create-tag', label: string): void;
  (e: 'edit-style', label: string): void;
  (e: 'remove-tag', label: string): void;
  (e: 'batch-reparent', moves: Array<{ oldLabel: string; newLabel: string }>): void;
  (e: 'rename-tag', oldLabel: string, newLabel: string): void;
}>();

// 行内就地重命名状态与方法
const editingLabel = ref<string | null>(null);
const inlineRenameValue = ref('');
const inlineInputRef = ref<HTMLInputElement | null>(null);
const isSubmittingRename = ref(false);

// 级联重命名子标签模态对话框状态
const cascadeRenameConfirmState = ref<{
  visible: boolean;
  oldLabel: string;
  newLabel: string;
  childCount: number;
}>({
  visible: false,
  oldLabel: '',
  newLabel: '',
  childCount: 0,
});

function startInlineRename(node: ITagItem) {
  editingLabel.value = node.label;
  inlineRenameValue.value = node.name;
  nextTick(() => {
    inlineInputRef.value?.focus();
    inlineInputRef.value?.select();
  });
}

function cancelInlineRename() {
  editingLabel.value = null;
  inlineRenameValue.value = '';
  isSubmittingRename.value = false;
}

async function submitInlineRename(node: ITagItem) {
  if (isSubmittingRename.value) return;
  const newName = inlineRenameValue.value.trim();
  if (!newName) {
    showMessage('标签名称不能为空', 3000, 'error');
    return;
  }
  if (newName === node.name) {
    cancelInlineRename();
    return;
  }
  if (newName.includes('/')) {
    showMessage('节点名称不能包含层级斜杠 "/"，如需调整层级请使用拖拽或层级配置', 3000, 'error');
    return;
  }

  const check = TagGovernanceService.isValidLabel(newName);
  if (!check.valid) {
    showMessage(check.error || '标签名称格式不合法', 3000, 'error');
    return;
  }

  const lastSlashIndex = node.label.lastIndexOf('/');
  const newFullLabel = lastSlashIndex >= 0
    ? `${node.label.slice(0, lastSlashIndex)}/${newName}`
    : newName;

  if (props.allTags.some(t => t.label.toLowerCase() === newFullLabel.toLowerCase())) {
    showMessage(`标签 "#${newFullLabel}#" 已存在于标签库中`, 3000, 'error');
    return;
  }

  const subTagPrefix = `${node.label}/`;
  const childTags = props.allTags.filter(t => t.label.startsWith(subTagPrefix));
  if (childTags.length > 0) {
    // 唤起自定义 DOM 模态对话框，彻底杜绝 Electron 原生 confirm 引起的鼠标光标指针丢失问题
    cascadeRenameConfirmState.value = {
      visible: true,
      oldLabel: node.label,
      newLabel: newFullLabel,
      childCount: childTags.length,
    };
    return;
  }

  isSubmittingRename.value = true;
  try {
    emit('rename-tag', node.label, newFullLabel);
    cancelInlineRename();
  } finally {
    isSubmittingRename.value = false;
  }
}

function confirmCascadeRename() {
  const { oldLabel, newLabel } = cascadeRenameConfirmState.value;
  cascadeRenameConfirmState.value.visible = false;
  if (oldLabel && newLabel) {
    emit('rename-tag', oldLabel, newLabel);
    cancelInlineRename();
  }
}

function handleInlineRenameBlur(node: ITagItem) {
  if (isSubmittingRename.value || cascadeRenameConfirmState.value.visible) return;
  if (inlineRenameValue.value.trim() === node.name || !inlineRenameValue.value.trim()) {
    cancelInlineRename();
  }
}

// 搜索与排序
const searchKeyword = ref('');
const sortMode = ref<TagSortMode>('count_desc');
const collapsedSet = ref<Set<string>>(new Set());
const allCollapsed = ref(false);

// 三大折叠面板展开状态
const groupsExpanded = ref(false);
const panoramaExpanded = ref(true); // 标签全景默认展开
const heatExpanded = ref(false);     // 标签热度默认折叠

// 热度可视化模式与范围
const visMode = ref<'cloud' | 'rank'>('cloud');
const heatScope = ref<'top20' | 'top50' | 'all'>('all');

const activeContext = ref<{ docId?: string; docTitle?: string; blockId?: string }>({});

// 拖拽层级重构与指示线状态
export interface ITreeDragIndicator {
  nodeLabel: string;
  position: 'before' | 'inside' | 'after';
  mode: 'root' | 'child'; // root: 拖出为独立根标签; child: 归为子标签
}

const stagedRenames = ref<Map<string, string>>(new Map());
const isSavingStaged = ref(false);
const draggingTagLabel = ref<string | null>(null);
const dragOverTagLabel = ref<string | null>(null);
const dragIndicator = ref<ITreeDragIndicator | null>(null);
const highlightedTagLabel = ref<string | null>(null);

// 拖拽落位即时确认对话框状态
interface IReparentConfirmState {
  visible: boolean;
  srcLabel: string;
  targetParentLabel: string | null;
  moves: Array<{ oldLabel: string; newLabel: string }>;
  quoteCount: number;
}

const reparentConfirmState = ref<IReparentConfirmState>({
  visible: false,
  srcLabel: '',
  targetParentLabel: null,
  moves: [],
  quoteCount: 0,
});
const isExecutingReparent = ref(false);

async function handleExecuteReparentDirectly() {
  if (reparentConfirmState.value.moves.length === 0 || isExecutingReparent.value) return;
  isExecutingReparent.value = true;
  try {
    emit('batch-reparent', reparentConfirmState.value.moves);
    if (reparentConfirmState.value.targetParentLabel) {
      // 确保目标标签及其所有祖先层级均从折叠集合中移除，使其在树中展开立即可见
      const parts = reparentConfirmState.value.targetParentLabel.split('/');
      for (let i = 1; i <= parts.length; i++) {
        const parentPath = parts.slice(0, i).join('/');
        collapsedSet.value.delete(parentPath);
      }
    }
    stagedRenames.value.clear();
    reparentConfirmState.value.visible = false;
  } finally {
    isExecutingReparent.value = false;
  }
}

function refreshActiveContext() {
  activeContext.value = TagGroupService.getActiveContext();
}

onMounted(() => {
  refreshActiveContext();
});

const normalizedKeyword = computed(() => TagCreationService.cleanTag(searchKeyword.value));
const validationResult = computed(() => TagCreationService.validateTag(searchKeyword.value));
const hasExactMatch = computed(() => TagCreationService.isTagExisting(normalizedKeyword.value, props.allTags));
const canCreateTag = computed(() => {
  return normalizedKeyword.value.length > 0 && validationResult.value.valid && !hasExactMatch.value;
});

function handleSearchEnter(e: KeyboardEvent) {
  if (e.isComposing) return;
  if (displayTreeNodes.value.length === 0) {
    if (canCreateTag.value) {
      triggerCreateTag();
    }
    return;
  }
  if (canCreateTag.value && !hasExactMatch.value) {
    triggerCreateTag();
  }
}

function triggerCreateTag() {
  if (!canCreateTag.value) return;
  emit('create-tag', normalizedKeyword.value);
}

// 暂存重命名列表
const stagedMoves = computed(() => {
  return Array.from(stagedRenames.value.entries()).map(([oldLabel, newLabel]) => ({
    oldLabel,
    newLabel,
  }));
});

// 应用暂存状态后的虚拟标签列表（即时反映在全景树与云图中）
const virtualAllTags = computed(() => {
  return TagTreeService.applyStagedRenames(props.allTags, stagedRenames.value);
});

function isTagStaged(label: string): boolean {
  if (stagedRenames.value.has(label)) return true;
  for (const newLabel of stagedRenames.value.values()) {
    if (newLabel === label || label.startsWith(`${newLabel}/`)) return true;
  }
  return false;
}

// 多叉树节点构建并拍平为列表
const displayTreeNodes = computed(() => {
  if (!searchKeyword.value.trim()) {
    const rootNodes = TagTreeService.buildTree(virtualAllTags.value, sortMode.value);
    return TagTreeService.flattenTree(rootNodes);
  }
  const matches = TagPinyinAliasService.matchTags(virtualAllTags.value, searchKeyword.value, 50);
  const rootNodes = TagTreeService.buildTree(matches.map(m => m.tag), sortMode.value);
  return TagTreeService.flattenTree(rootNodes);
});

const selectedTagSet = computed(() => new Set(props.selectedTags || []));

function isTagSelected(label: string): boolean {
  return selectedTagSet.value.has(label);
}

function formatNodeTitle(label: string): string {
  if (isTagSelected(label)) {
    return `${label}（已加入筛选；点击仅单选此项，按住 Ctrl/Shift 可取消选择）`;
  }
  return `${label}（点击仅单选并跳转，按住 Ctrl/Shift 可多选加入筛选；可拖拽到正文打标或拖入其他标签归为子标签）`;
}

function hasSubTags(label: string): boolean {
  return virtualAllTags.value.some(t => t.label.startsWith(`${label}/`) && t.label !== label);
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
    virtualAllTags.value.forEach(t => {
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

// ==========================================
// 拖拽层级重构与正文打标处理
// ==========================================

function handleDragStart(node: ITagItem, e: DragEvent) {
  TagDropService.setDraggingTag(node.label);

  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('application/siyuan-tag', node.label);
    e.dataTransfer.setData('text/plain', `#${node.label}# `);
  }

  // 异步延迟更新 draggingTagLabel，避免同步修改响应式状态导致 DOM 重新渲染和布局突变（Layout Shift）打断 Chromium 原生拖拽启动
  setTimeout(() => {
    draggingTagLabel.value = node.label;
  }, 0);
}

const isDraggingSubTag = computed(() => {
  const current = draggingTagLabel.value || TagDropService.getDraggingTag();
  return Boolean(current && current.includes('/'));
});

const draggingLeafName = computed(() => {
  const current = draggingTagLabel.value || TagDropService.getDraggingTag();
  if (!current) return '';
  return current.split('/').pop() || current;
});

const isDraggingOverScrollerBlank = ref(false);

function handleDragEnd() {
  draggingTagLabel.value = null;
  dragOverTagLabel.value = null;
  dragIndicator.value = null;
  isDraggingOverScrollerBlank.value = false;
  TagDropService.setDraggingTag(null);
}

function handleScrollerDragOver(e: DragEvent) {
  if (!isDraggingSubTag.value) return;
  const target = e.target as HTMLElement | null;
  const isOverNode = Boolean(target?.closest('.tm-tree-node'));
  if (!isOverNode) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    isDraggingOverScrollerBlank.value = true;
  } else {
    isDraggingOverScrollerBlank.value = false;
  }
}

function handleScrollerDragLeave(e: DragEvent) {
  const related = e.relatedTarget as HTMLElement | null;
  const current = e.currentTarget as HTMLElement | null;
  if (!current || !related || !current.contains(related)) {
    isDraggingOverScrollerBlank.value = false;
  }
}

function handleScrollerDrop(e: DragEvent) {
  if (!isDraggingSubTag.value) return;
  const target = e.target as HTMLElement | null;
  const isOverNode = Boolean(target?.closest('.tm-tree-node'));
  if (!isOverNode) {
    e.preventDefault();
    e.stopPropagation();
    isDraggingOverScrollerBlank.value = false;
    dragIndicator.value = null;
    handleDropToRoot(e);
  }
}

function handleDragOverNode(node: ITagItem, e: DragEvent) {
  const currentDragging = draggingTagLabel.value || TagDropService.getDraggingTag();
  if (!currentDragging || currentDragging === node.label) return;
  // 禁止拖拽到自身或自身的子孙节点
  if (node.label.startsWith(`${currentDragging}/`)) return;

  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }

  const targetEl = (e.currentTarget as HTMLElement) || (e.target as HTMLElement)?.closest('.tm-tree-node');
  if (!targetEl) return;
  const rect = targetEl.getBoundingClientRect();
  const height = rect.height || 28;
  const offsetY = e.clientY - rect.top;
  const ratio = Math.max(0, Math.min(1, offsetY / height));
  const offsetX = e.clientX - rect.left;

  const isSubTag = Boolean(currentDragging.includes('/'));

  // 三段式指示线定位：
  // 1. 上边缘 (ratio < 0.28) 或 靠左拉出 (isSubTag && offsetX < 28) -> 显示上方指示线，拖出为独立根标签
  // 2. 下边缘 (ratio > 0.72) -> 显示下方指示线，拖出为独立根标签
  // 3. 悬停在节点主体 (0.28 <= ratio <= 0.72) -> 目标节点高亮，归为该节点的子标签
  if (ratio < 0.28 || (isSubTag && offsetX < 28)) {
    dragIndicator.value = {
      nodeLabel: node.label,
      position: 'before',
      mode: 'root',
    };
    dragOverTagLabel.value = null;
  } else if (ratio > 0.72) {
    dragIndicator.value = {
      nodeLabel: node.label,
      position: 'after',
      mode: 'root',
    };
    dragOverTagLabel.value = null;
  } else {
    dragIndicator.value = {
      nodeLabel: node.label,
      position: 'inside',
      mode: 'child',
    };
    dragOverTagLabel.value = node.label;
  }
}

function handleDragLeaveNode(node: ITagItem, e: DragEvent) {
  // 仅在真正离开节点边界且未进入其子元素时重置
  const related = e.relatedTarget as HTMLElement | null;
  const currentTarget = e.currentTarget as HTMLElement | null;
  if (!currentTarget || !related || !currentTarget.contains(related)) {
    if (dragIndicator.value?.nodeLabel === node.label) {
      dragIndicator.value = null;
    }
    if (dragOverTagLabel.value === node.label) {
      dragOverTagLabel.value = null;
    }
  }
}

function handleDropOnNode(targetNode: ITagItem, e: DragEvent) {
  const src =
    draggingTagLabel.value ||
    TagDropService.getDraggingTag() ||
    e.dataTransfer?.getData('application/siyuan-tag') ||
    e.dataTransfer?.getData('text/plain')?.replace(/^#|#\s*$/g, '').trim();

  const indicator = dragIndicator.value;
  dragIndicator.value = null;
  dragOverTagLabel.value = null;
  isDraggingOverScrollerBlank.value = false;

  if (!src || src === targetNode.label) return;
  if (targetNode.label.startsWith(`${src}/`)) return;

  e.preventDefault();
  e.stopPropagation();

  // 根据指示线显示状态精准判定：
  // 若处于上下边缘指示线，执行拖出为独立根标签；
  // 若处于节点主体，执行归为该节点的子标签
  const isRootMode = indicator ? indicator.mode === 'root' && indicator.position !== 'inside' : false;
  const targetParent = isRootMode ? null : targetNode.label;

  // 计算重构变动路径
  const moves = TagTreeService.calculateReparentMoves(src, targetParent, virtualAllTags.value);
  if (moves.length === 0) return;

  const srcTagItem = virtualAllTags.value.find(t => t.label === src);
  const quoteCount = srcTagItem?.count || 0;

  // 立即呼出直观确认对话框
  reparentConfirmState.value = {
    visible: true,
    srcLabel: src,
    targetParentLabel: targetParent,
    moves,
    quoteCount,
  };
}

function handleDropToRoot(e: DragEvent) {
  const src =
    draggingTagLabel.value ||
    TagDropService.getDraggingTag() ||
    e.dataTransfer?.getData('application/siyuan-tag') ||
    e.dataTransfer?.getData('text/plain')?.replace(/^#|#\s*$/g, '').trim();

  dragIndicator.value = null;
  dragOverTagLabel.value = null;
  isDraggingOverScrollerBlank.value = false;
  if (!src) return;

  e.preventDefault();
  e.stopPropagation();

  const moves = TagTreeService.calculateReparentMoves(src, null, virtualAllTags.value);
  if (moves.length === 0) return;

  const srcTagItem = virtualAllTags.value.find(t => t.label === src);
  const quoteCount = srcTagItem?.count || 0;

  reparentConfirmState.value = {
    visible: true,
    srcLabel: src,
    targetParentLabel: null,
    moves,
    quoteCount,
  };
}

async function handleConfirmSaveStaged() {
  if (stagedMoves.value.length === 0 || isSavingStaged.value) return;
  isSavingStaged.value = true;
  try {
    emit('batch-reparent', stagedMoves.value);
    stagedRenames.value.clear();
  } finally {
    isSavingStaged.value = false;
  }
}

function handleDiscardStaged() {
  stagedRenames.value.clear();
}

// ==========================================
// 标签热度双模可视化计算与交互
// ==========================================

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

function handleCloudTagClick(label: string) {
  // 1. 确保“标签全景”折叠条展开
  panoramaExpanded.value = true;

  // 2. 将 label 的所有父级从 collapsedSet 中移除，保证在树中可见
  const parts = label.split('/');
  for (let i = 1; i < parts.length; i++) {
    const parent = parts.slice(0, i).join('/');
    collapsedSet.value.delete(parent);
  }

  // 3. 滚动定位与闪烁高亮
  highlightedTagLabel.value = label;
  nextTick(() => {
    setTimeout(() => {
      const targetEl = document.querySelector(`.tm-tree-node[data-node-tag="${label}"]`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 50);
  });

  setTimeout(() => {
    if (highlightedTagLabel.value === label) {
      highlightedTagLabel.value = null;
    }
  }, 2000);
}

function handleCloudDragStart(tag: ITagItem, e: DragEvent) {
  TagDropService.setDraggingTag(tag.label);
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('application/siyuan-tag', tag.label);
    e.dataTransfer.setData('text/plain', `#${tag.label}# `);
  }

  setTimeout(() => {
    draggingTagLabel.value = tag.label;
  }, 0);
}
</script>
