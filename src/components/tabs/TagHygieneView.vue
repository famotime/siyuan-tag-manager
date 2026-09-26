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

    <!-- 治理分类导航 / 标签体检清单 -->
    <div class="tm-issues-list">
      <div class="tm-section-header-title">
        <span>标签规范与冲突治理</span>
        <span class="tm-section-badge">{{ healthResult.issues.length }}</span>
      </div>

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
            class="tm-icon-btn tm-btn-sm"
            v-tooltip="'一键合并规范：将所有异构大小写合并至高频标准规范'"
            aria-label="一键合并规范"
            @click="emit('auto-resolve', issue)"
          >
            <SyLineIcon name="git-merge" :size="13" />
          </button>
          <button
            v-else-if="issue.suggestedAction === 'clean'"
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

    <!-- 引用识别为标签诊断器 (Ref-to-Tag Assistant) -->
    <div class="tm-ref-promote-section">
      <div class="tm-ref-promote-header">
        <div class="tm-ref-promote-title">
          <SyLineIcon name="scan" :size="14" class="text-primary" />
          <span>引用识别为标签诊断器</span>
          <span v-if="candidates.length > 0" class="tm-section-badge">{{ candidates.length }}</span>
        </div>
        <div class="tm-ref-promote-tools">
          <button
            class="b3-button tm-btn-xs tm-btn-subtle"
            :disabled="diagnosingActive"
            v-tooltip="'快速检测当前打开的文档中包含的已有标签引用'"
            @click="diagnoseCurrentDoc"
          >
            <SyLineIcon name="file-text" :size="11" />
            <span>{{ diagnosingActive ? '检测中...' : '检测当前文档' }}</span>
          </button>
          <button
            class="tm-btn-xs b3-button b3-button--primary"
            style="margin-left: 6px;"
            :disabled="scanning"
            v-tooltip="'全库扫描所有包含与已有标签同名的块引用/文档引用'"
            @click="scanAllRefs"
          >
            <SyLineIcon name="scan" :size="11" />
            <span>{{ scanning ? '扫描中...' : '全库扫描引用' }}</span>
          </button>
        </div>
      </div>

      <div class="tm-ref-promote-body">
        <div v-if="!scanned && !activeDocDiagnosed" class="tm-ref-promote-intro">
          自动识别正文中包含的同名双向引用（如 <code>((... "Vue"))</code>），支持一键将其规范化升级为文档标签属性。
        </div>

        <!-- 批量操作控制条 -->
        <div v-if="candidates.length > 0" class="tm-ref-batch-bar">
          <label class="tm-ref-select-all">
            <input
              type="checkbox"
              :checked="isAllSelected"
              @change="toggleSelectAll"
            />
            <span>全选 ({{ selectedCandidates.length }}/{{ candidates.length }})</span>
          </label>
          <button
            class="b3-button b3-button--primary tm-btn-xs"
            :disabled="selectedCandidates.length === 0 || promoting"
            @click="promoteSelectedCandidates"
          >
            {{ promoting ? '打标处理中...' : `一键批量采纳 (${selectedCandidates.length})` }}
          </button>
        </div>

        <!-- 扫描结果列表 -->
        <div v-if="candidates.length > 0" class="tm-ref-candidates-list">
          <div
            v-for="item in candidates"
            :key="item.docId"
            class="tm-ref-candidate-card"
          >
            <div class="tm-candidate-top">
              <input
                type="checkbox"
                v-model="item.selected"
                class="tm-candidate-checkbox"
              />
              <span class="tm-candidate-doc-title" :title="item.docTitle">
                《{{ item.docTitle }}》
              </span>
              <button
                class="b3-button tm-btn-xs tm-btn-subtle"
                style="margin-left: auto;"
                :disabled="promoting"
                @click="promoteSingleCandidate(item)"
              >
                采纳打标
              </button>
            </div>

            <!-- 命中标签建议流 -->
            <div class="tm-candidate-matches">
              <div
                v-for="m in item.matchedTags"
                :key="m.tag + m.reason"
                class="tm-match-pill"
              >
                <span class="match-ref-text">{{ formatMatchReason(m.reason, m.refContent) }}</span>
                <span class="match-arrow">➔</span>
                <span class="match-tag-badge">#{{ m.tag }}#</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="scanned" class="tm-empty-success" style="margin-top: 8px;">
          <SyLineIcon name="check-circle" :size="20" class="tm-success-icon" />
          <div>全库检查完成！未发现尚未打标的同名引用文档。</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { showMessage } from 'siyuan';
import type { ITagHealthReport, ITagHealthIssue, ITagItem } from '../../types/tag';
import { TagRefPromoteService, type IRefToTagCandidate } from '../../services/TagRefPromoteService';
import { TagGroupService } from '../../services/TagGroupService';
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
  (e: 'refresh-tags'): void;
}>();

// 引用诊断器状态
const scanning = ref(false);
const scanned = ref(false);
const diagnosingActive = ref(false);
const promoting = ref(false);
const candidates = ref<IRefToTagCandidate[]>([]);
const activeDocDiagnosed = ref<IRefToTagCandidate | null>(null);

const selectedCandidates = computed(() => candidates.value.filter(c => c.selected));
const isAllSelected = computed(
  () => candidates.value.length > 0 && candidates.value.every(c => c.selected),
);

function toggleSelectAll(e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  candidates.value.forEach(c => {
    c.selected = checked;
  });
}

function formatMatchReason(reason: string, refContent: string): string {
  switch (reason) {
    case 'target_name':
      return `命名「${refContent}」`;
    case 'target_alias':
      return `别名「${refContent}」`;
    case 'target_doc_title':
      return `标题「${refContent}」`;
    default:
      return `引用「${refContent}」`;
  }
}

async function scanAllRefs() {
  if (!props.allTags || props.allTags.length === 0) {
    showMessage('当前标签库为空，无需进行引用识别', 3000, 'info');
    return;
  }
  scanning.value = true;
  scanned.value = true;
  try {
    const list = await TagRefPromoteService.scanRefsToTags(props.allTags, { limit: 100 });
    candidates.value = list;
    if (list.length === 0) {
      showMessage('扫描完成，未发现可转化为标签的未打标引用', 3000, 'info');
    } else {
      showMessage(`扫描完成，发现 ${list.length} 篇文档包含与现有标签同名的引用`, 3000, 'info');
    }
  } catch (err: any) {
    showMessage(`扫描引用异常: ${err.message || err}`, 4000, 'error');
  } finally {
    scanning.value = false;
  }
}

async function diagnoseCurrentDoc() {
  const active = TagGroupService.getActiveContext();
  if (!active.docId) {
    showMessage('未检测到当前打开的文档，请先在思源中打开文档', 4000, 'error');
    return;
  }

  diagnosingActive.value = true;
  try {
    const res = await TagRefPromoteService.diagnoseSingleDocRefs(active.docId, props.allTags);
    if (!res || res.matchedTags.length === 0) {
      showMessage(`《${active.docTitle || '当前文档'}》未检测到未打标的同名引用`, 3000, 'info');
    } else {
      activeDocDiagnosed.value = res;
      // 若该文档未在列表中，添加之
      const idx = candidates.value.findIndex(c => c.docId === res.docId);
      if (idx !== -1) {
        candidates.value[idx] = res;
      } else {
        candidates.value.unshift(res);
      }
      showMessage(
        `《${res.docTitle}》检测到 ${res.matchedTags.length} 个同名引用可转化为标签！`,
        3000,
        'info',
      );
    }
  } catch (err: any) {
    showMessage(`诊断当前文档失败: ${err.message || err}`, 4000, 'error');
  } finally {
    diagnosingActive.value = false;
  }
}

async function promoteSingleCandidate(candidate: IRefToTagCandidate) {
  promoting.value = true;
  try {
    const tags = candidate.matchedTags.map(m => m.tag);
    const res = await TagRefPromoteService.promoteCandidates([{ docId: candidate.docId, tags }]);
    if (res.success) {
      showMessage(`成功为《${candidate.docTitle}》打上 ${tags.length} 个标签！`, 3000, 'info');
      candidates.value = candidates.value.filter(c => c.docId !== candidate.docId);
      emit('refresh-tags');
    } else {
      showMessage(`打标失败: ${res.errors.join('; ')}`, 5000, 'error');
    }
  } catch (err: any) {
    showMessage(`采纳异常: ${err.message || err}`, 4000, 'error');
  } finally {
    promoting.value = false;
  }
}

async function promoteSelectedCandidates() {
  const targets = selectedCandidates.value.map(c => ({
    docId: c.docId,
    tags: c.matchedTags.map(m => m.tag),
  }));

  if (targets.length === 0) return;

  promoting.value = true;
  try {
    const res = await TagRefPromoteService.promoteCandidates(targets);
    if (res.success) {
      showMessage(`成功为 ${res.updatedCount} 篇文档批量套用引用识别标签！`, 3000, 'info');
      const updatedIds = new Set(targets.map(t => t.docId));
      candidates.value = candidates.value.filter(c => !updatedIds.has(c.docId));
      emit('refresh-tags');
    } else {
      showMessage(`部分文档更新失败: ${res.errors.join('; ')}`, 5000, 'error');
    }
  } catch (err: any) {
    showMessage(`批量采纳失败: ${err.message || err}`, 4000, 'error');
  } finally {
    promoting.value = false;
  }
}
</script>

<style scoped lang="scss">
.tm-section-header-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 8px;
}

.tm-section-badge {
  font-size: 10px;
  background: var(--b3-theme-background-light);
  color: var(--b3-theme-on-surface);
  padding: 0 5px;
  border-radius: 8px;
}

.tm-ref-promote-section {
  margin-top: 16px;
  border-top: 1px solid var(--b3-border-color);
  padding-top: 12px;
}

.tm-ref-promote-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.tm-ref-promote-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
}

.tm-ref-promote-tools {
  display: flex;
  align-items: center;
}

.tm-ref-promote-intro {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  line-height: 1.5;
  background: var(--b3-theme-background-light);
  padding: 6px 10px;
  border-radius: 6px;

  code {
    background: var(--b3-theme-surface);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 10px;
  }
}

.tm-ref-batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: var(--b3-theme-background-light);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  margin-bottom: 8px;
}

.tm-ref-select-all {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  cursor: pointer;
}

.tm-ref-candidates-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
}

.tm-ref-candidate-card {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  padding: 8px 10px;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: var(--b3-theme-primary-light);
  }
}

.tm-candidate-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tm-candidate-checkbox {
  cursor: pointer;
}

.tm-candidate-doc-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tm-candidate-matches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
  padding-left: 20px;
}

.tm-match-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  background: var(--b3-theme-background-light);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--b3-border-color);

  .match-ref-text {
    color: var(--b3-theme-on-surface-light);
  }

  .match-arrow {
    font-size: 9px;
    opacity: 0.5;
  }

  .match-tag-badge {
    color: var(--b3-theme-primary);
    font-weight: 500;
  }
}

.tm-btn-subtle {
  background: var(--b3-theme-background-light);
  color: var(--b3-theme-on-surface);
  border: 1px solid var(--b3-border-color);

  &:hover {
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }
}
</style>
