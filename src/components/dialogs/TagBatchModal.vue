<template>
  <div v-if="state.visible" class="tm-modal-mask" @click.self="emit('close')">
    <div class="tm-modal-card" style="width: 580px; max-width: 95vw;">
      <div class="tm-modal-title">
        <SyLineIcon name="layers-plus" :size="16" />
        <span>多文档批量打标</span>
      </div>

      <div class="tm-modal-body">
        <!-- 1. 目标文档区域 -->
        <div class="tm-form-group">
          <div class="tm-section-title-row">
            <div class="tm-section-title-left">
              <label class="tm-bold-label">
                目标文档 (已选 <strong>{{ allTargetDocs.length }}</strong> 篇<span v-if="includeSubDocs && activeSubDocs.length > 0" class="tm-subdocs-badge">含 {{ activeSubDocs.length }} 篇子文档</span>)：
              </label>
              <label class="tm-checkbox-label" title="勾选后将已选中文档中的子文档都纳入打标范围">
                <input
                  v-model="includeSubDocs"
                  type="checkbox"
                  class="b3-checkbox"
                />
                <span>包含子文档</span>
                <span v-if="loadingSubDocs" class="tm-subdocs-loading">(扫描中...)</span>
              </label>
            </div>
            <div class="tm-doc-source-tabs">
              <button
                class="tm-source-tab-btn"
                :class="{ active: docAddMode === 'search' }"
                @click="docAddMode = 'search'"
              >
                搜索选取
              </button>
              <button
                class="tm-source-tab-btn"
                :class="{ active: docAddMode === 'notebook' }"
                @click="docAddMode = 'notebook'; loadNotebooks()"
              >
                按笔记本
              </button>
              <button
                class="tm-source-tab-btn"
                :class="{ active: docAddMode === 'manual' }"
                @click="docAddMode = 'manual'"
              >
                手动粘贴 ID
              </button>
            </div>
          </div>

          <!-- 已选文档列表胶囊 -->
          <div v-if="allTargetDocs.length > 0" class="tm-selected-docs-box">
            <span
              v-for="doc in allTargetDocs"
              :key="doc.id"
              class="tm-selected-doc-chip"
              :class="{ 'is-sub-doc': isSubDoc(doc.id) }"
              :title="`ID: ${doc.id}${isSubDoc(doc.id) ? ' (子文档)' : ''}`"
            >
              <SyLineIcon :name="isSubDoc(doc.id) ? 'corner-down-right' : 'file-text'" :size="11" />
              <span class="doc-chip-title">
                <span v-if="isSubDoc(doc.id)" class="sub-doc-tag">[子]</span>
                {{ doc.title || doc.id }}
              </span>
              <button
                class="doc-chip-del"
                :title="isSubDoc(doc.id) ? '排除此子文档' : '移除该文档'"
                @click="removeDoc(doc.id)"
              >
                <SyLineIcon name="close" :size="10" />
              </button>
            </span>
          </div>
          <div v-else class="tm-section-hint" style="margin-bottom: 6px;">
            尚未选择任何文档，请通过下方搜索勾选、选择笔记本或直接在思源文档树右键调起。
          </div>

          <!-- 模式 A：标题搜索添加 -->
          <div v-if="docAddMode === 'search'" class="tm-doc-search-panel">
            <div class="fn__flex">
              <input
                v-model="docSearchKeyword"
                class="b3-text-field fn__block fn__flex-1"
                placeholder="输入文档标题模糊检索..."
                @input="onSearchDocsInput"
                @keydown.enter.prevent="triggerSearchDocs"
              />
              <button
                class="b3-button b3-button--outline"
                style="margin-left: 8px;"
                :disabled="searchingDocs"
                @click="triggerSearchDocs"
              >
                <SyLineIcon name="search" :size="12" />
                <span>{{ searchingDocs ? '检索中...' : '搜索' }}</span>
              </button>
            </div>

            <!-- 搜索结果列表 -->
            <div v-if="searchDocResults.length > 0" class="tm-doc-search-results">
              <div
                v-for="item in searchDocResults"
                :key="item.id"
                class="tm-doc-result-row"
                @click="toggleDocSelection(item)"
              >
                <input
                  type="checkbox"
                  :checked="isDocSelected(item.id)"
                  @click.stop="toggleDocSelection(item)"
                />
                <span class="tm-result-doc-title">{{ item.title }}</span>
                <span v-if="item.tags.length > 0" class="tm-result-doc-tags">
                  {{ item.tags.map(t => `#${t}`).join(' ') }}
                </span>
              </div>
            </div>
            <div v-else-if="searched && !searchingDocs" class="tm-section-hint" style="margin-top: 4px;">
              未搜索到匹配文档。
            </div>
          </div>

          <!-- 模式 B：按笔记本批量载入 -->
          <div v-else-if="docAddMode === 'notebook'" class="tm-notebook-panel">
            <div class="fn__flex">
              <select v-model="selectedNotebookId" class="b3-select fn__flex-1">
                <option value="">-- 请选择笔记本 --</option>
                <option v-for="nb in notebooks" :key="nb.id" :value="nb.id">
                  {{ nb.name }}
                </option>
              </select>
              <button
                class="b3-button b3-button--outline"
                style="margin-left: 8px;"
                :disabled="!selectedNotebookId || loadingNotebookDocs"
                @click="loadDocsFromNotebook"
              >
                {{ loadingNotebookDocs ? '载入中...' : '载入笔记本下文档' }}
              </button>
            </div>
          </div>

          <!-- 模式 C：手动粘贴 ID -->
          <div v-else-if="docAddMode === 'manual'">
            <textarea
              v-model="state.docIdsText"
              class="b3-text-field fn__block"
              rows="3"
              placeholder="每行粘贴一个思源文档块 ID，例如 20260926080000-xxxxxxx"
              @input="syncManualDocIds"
            ></textarea>
          </div>
        </div>

        <hr class="tm-divider" />

        <!-- 2. 待打标签区域 -->
        <div class="tm-form-group">
          <label class="tm-bold-label">
            待打标签 (已选 <strong>{{ selectedTags.length }}</strong> 个)：
          </label>

          <!-- 已选标签胶囊 -->
          <div v-if="selectedTags.length > 0" class="tm-batch-tags-chips">
            <span
              v-for="t in selectedTags"
              :key="t"
              class="tm-batch-tag-chip"
            >
              <span>#{{ t }}#</span>
              <button class="chip-del-btn" title="移除" @click="removeTag(t)">
                <SyLineIcon name="close" :size="10" />
              </button>
            </span>
          </div>

          <!-- 套用标签组快捷栏 -->
          <div v-if="tagGroups && tagGroups.length > 0" class="tm-quick-groups-row">
            <span class="tm-quick-hint">套用标签组：</span>
            <button
              v-for="group in tagGroups"
              :key="group.id"
              class="tm-quick-group-btn"
              :title="`点击将「${group.name}」包含的全部 ${group.tags.length} 个标签添加至列表`"
              @click="applyTagGroup(group)"
            >
              <span class="dot" :style="{ backgroundColor: group.color || 'var(--b3-theme-primary)' }"></span>
              <span>{{ group.name }}</span>
            </button>
          </div>

          <!-- 手动输入新标签 -->
          <div class="fn__flex" style="margin-top: 6px;">
            <input
              v-model="newTagInput"
              class="b3-text-field fn__block fn__flex-1"
              placeholder="输入标签名按回车添加（支持逗号分隔多个，如 AI, YouTube）..."
              @keydown.enter.prevent="addTypedTags"
            />
            <button
              class="b3-button b3-button--outline"
              style="margin-left: 8px;"
              :disabled="!newTagInput.trim()"
              @click="addTypedTags"
            >
              添加标签
            </button>
          </div>

          <!-- 快速候选候选池 -->
          <div v-if="candidateTags.length > 0" class="tm-quick-tag-candidates">
            <span class="tm-quick-hint">快速点选：</span>
            <button
              v-for="item in candidateTags"
              :key="item.label"
              class="tm-candidate-pill"
              @click="addTag(item.label)"
            >
              <SyLineIcon name="plus" :size="9" />
              <span>#{{ item.label }}#</span>
            </button>
          </div>
        </div>
      </div>

      <div class="tm-modal-footer">
        <div class="tm-footer-summary">
          将为 <strong>{{ allTargetDocs.length }}</strong> 篇文档<template v-if="includeSubDocs && activeSubDocs.length > 0"> (含 {{ activeSubDocs.length }} 篇子文档)</template> 添加 <strong>{{ selectedTags.length }}</strong> 个标签
        </div>
        <button class="b3-button b3-button--cancel" @click="emit('close')">取消</button>
        <button
          class="b3-button b3-button--primary"
          :disabled="state.executing || allTargetDocs.length === 0 || selectedTags.length === 0"
          @click="handleExecute"
        >
          {{ state.executing ? '正在执行打标...' : '开始批量打标' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import SyLineIcon from '../SiyuanTheme/SyLineIcon.vue';
import { TagBatchService } from '../../services/TagBatchService';
import type { ITagItem, ITagGroup } from '../../types/tag';
import type { IBatchModalState, IBatchDocItem } from '../../types/ui';

const props = withDefaults(
  defineProps<{
    state: IBatchModalState;
    allTags?: ITagItem[];
    tagGroups?: ITagGroup[];
  }>(),
  {
    allTags: () => [],
    tagGroups: () => [],
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'execute', payload: { docIds: string[]; tags: string[] }): void;
}>();

// 文档添加模式：search | notebook | manual
const docAddMode = ref<'search' | 'notebook' | 'manual'>('search');

// 已选文档集合（根文档）
const selectedDocs = ref<IBatchDocItem[]>([]);

// 是否包含子文档
const includeSubDocs = ref(false);
// 扫描出的子文档列表
const subDocs = ref<IBatchDocItem[]>([]);
// 正在扫描子文档状态
const loadingSubDocs = ref(false);
// 临时排除的子文档 ID 集合
const excludedSubDocIds = ref<Set<string>>(new Set());

// 搜索文档状态
const docSearchKeyword = ref('');
const searchingDocs = ref(false);
const searched = ref(false);
const searchDocResults = ref<Array<{ id: string; title: string; tags: string[] }>>([]);

// 笔记本状态
const notebooks = ref<Array<{ id: string; name: string }>>([]);
const selectedNotebookId = ref('');
const loadingNotebookDocs = ref(false);

// 待添加标签状态
const selectedTags = ref<string[]>([]);
const newTagInput = ref('');

// 实际生效的子文档列表（排除被单独移除的）
const activeSubDocs = computed(() => {
  if (!includeSubDocs.value) return [];
  return subDocs.value.filter(d => !excludedSubDocIds.value.has(d.id));
});

// 全部打标目标文档（根文档 + 纳入的有效子文档，去重）
const allTargetDocs = computed(() => {
  if (!includeSubDocs.value) {
    return selectedDocs.value;
  }
  const rootIds = new Set(selectedDocs.value.map(d => d.id));
  const uniqueSubDocs = activeSubDocs.value.filter(d => !rootIds.has(d.id));
  return [...selectedDocs.value, ...uniqueSubDocs];
});

function isSubDoc(id: string): boolean {
  return activeSubDocs.value.some(d => d.id === id);
}

async function loadSubDocs() {
  if (!includeSubDocs.value || selectedDocs.value.length === 0) {
    subDocs.value = [];
    return;
  }
  loadingSubDocs.value = true;
  try {
    const parentIds = selectedDocs.value.map(d => d.id);
    const res = await TagBatchService.getSubDocs(parentIds);
    subDocs.value = res.map(r => ({ id: r.id, title: r.title, isSubDoc: true }));
  } catch (err) {
    console.warn('[siyuan-tag-manager] loadSubDocs error:', err);
    subDocs.value = [];
  } finally {
    loadingSubDocs.value = false;
  }
}

watch(includeSubDocs, (val) => {
  if (val) {
    excludedSubDocIds.value = new Set();
    loadSubDocs();
  } else {
    subDocs.value = [];
    excludedSubDocIds.value = new Set();
  }
});

// 当选中文档发生变动且已勾选包含子文档时，自动重新扫描子文档
watch(
  () => selectedDocs.value.map(d => d.id).sort().join(','),
  () => {
    if (includeSubDocs.value) {
      loadSubDocs();
    }
  }
);

// 初始化监听外部传入的 targetDocs 或 docIdsText
watch(
  [() => props.state.visible, () => props.state.targetDocs],
  ([vis]) => {
    if (vis) {
      includeSubDocs.value = Boolean(props.state.includeSubDocs);
      excludedSubDocIds.value = new Set();
      subDocs.value = [];

      if (props.state.targetDocs && props.state.targetDocs.length > 0) {
        selectedDocs.value = [...props.state.targetDocs];
      } else if (props.state.docIdsText) {
        const ids = props.state.docIdsText.split('\n').map(s => s.trim()).filter(Boolean);
        selectedDocs.value = ids.map(id => ({ id, title: id }));
      } else {
        selectedDocs.value = [];
      }

      if (props.state.tagsText) {
        selectedTags.value = props.state.tagsText
          .split(',')
          .map(s => s.trim().replace(/^#+|#+$/g, ''))
          .filter(Boolean);
      } else {
        selectedTags.value = [];
      }

      if (includeSubDocs.value) {
        loadSubDocs();
      }
    }
  },
  { immediate: true, deep: true }
);

function removeDoc(id: string) {
  if (isSubDoc(id)) {
    const next = new Set(excludedSubDocIds.value);
    next.add(id);
    excludedSubDocIds.value = next;
  } else {
    selectedDocs.value = selectedDocs.value.filter(d => d.id !== id);
  }
}

function isDocSelected(id: string): boolean {
  return selectedDocs.value.some(d => d.id === id);
}

function toggleDocSelection(doc: { id: string; title: string }) {
  if (isDocSelected(doc.id)) {
    removeDoc(doc.id);
  } else {
    selectedDocs.value.push({ id: doc.id, title: doc.title });
  }
}

let searchTimer: any = null;
function onSearchDocsInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    triggerSearchDocs();
  }, 350);
}

async function triggerSearchDocs() {
  const kw = docSearchKeyword.value.trim();
  if (!kw) {
    searchDocResults.value = [];
    searched.value = false;
    return;
  }
  searchingDocs.value = true;
  searched.value = true;
  try {
    searchDocResults.value = await TagBatchService.searchDocs(kw, 30);
  } finally {
    searchingDocs.value = false;
  }
}

async function loadNotebooks() {
  if (notebooks.value.length === 0) {
    notebooks.value = await TagBatchService.fetchNotebooks();
  }
}

async function loadDocsFromNotebook() {
  if (!selectedNotebookId.value) return;
  loadingNotebookDocs.value = true;
  try {
    const list = await TagBatchService.getNotebookDocs(selectedNotebookId.value, 100);
    const existing = new Set(selectedDocs.value.map(d => d.id));
    for (const item of list) {
      if (!existing.has(item.id)) {
        selectedDocs.value.push({ id: item.id, title: item.title });
        existing.add(item.id);
      }
    }
  } finally {
    loadingNotebookDocs.value = false;
  }
}

function syncManualDocIds() {
  const lines = props.state.docIdsText.split('\n').map(s => s.trim()).filter(Boolean);
  const existing = new Set(selectedDocs.value.map(d => d.id));
  for (const id of lines) {
    if (!existing.has(id)) {
      selectedDocs.value.push({ id, title: id });
      existing.add(id);
    }
  }
}

// 标签操作
function addTag(raw: string) {
  const clean = raw.trim().replace(/^#+|#+$/g, '');
  if (clean && !selectedTags.value.includes(clean)) {
    selectedTags.value.push(clean);
  }
}

function removeTag(tag: string) {
  selectedTags.value = selectedTags.value.filter(t => t !== tag);
}

function addTypedTags() {
  const parts = newTagInput.value.split(/[,，\s]+/).filter(Boolean);
  for (const p of parts) {
    addTag(p);
  }
  newTagInput.value = '';
}

function applyTagGroup(group: ITagGroup) {
  for (const t of group.tags) {
    addTag(t);
  }
}

const candidateTags = computed(() => {
  const existing = new Set(selectedTags.value);
  return (props.allTags || [])
    .filter(t => !existing.has(t.label))
    .slice(0, 8);
});

function handleExecute() {
  const docIds = allTargetDocs.value.map(d => d.id);
  const tags = [...selectedTags.value];
  if (docIds.length === 0 || tags.length === 0) return;

  // 同步回文本兼容字段
  props.state.docIdsText = docIds.join('\n');
  props.state.tagsText = tags.join(', ');
  props.state.includeSubDocs = includeSubDocs.value;

  emit('execute', { docIds, tags });
}
</script>

<style scoped lang="scss">
.tm-section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  flex-wrap: wrap;
  gap: 8px;
}

.tm-section-title-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tm-checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
  user-select: none;

  input[type="checkbox"] {
    margin: 0;
    cursor: pointer;
    accent-color: var(--b3-theme-primary);
  }
}

.tm-subdocs-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 500;
  margin-left: 4px;
  padding: 1px 5px;
  border-radius: 8px;
  background: var(--tm-badge-primary-bg);
  color: var(--tm-badge-primary-text);
  border: 1px solid var(--tm-badge-primary-border);
}

.tm-subdocs-loading {
  font-size: 10px;
  color: var(--b3-theme-primary);
  margin-left: 2px;
}

.tm-bold-label {
  font-weight: 600;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.tm-doc-source-tabs {
  display: flex;
  gap: 4px;
}

.tm-source-tab-btn {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid var(--b3-border-color);
  background: var(--b3-theme-background-light);
  color: var(--b3-theme-on-surface-light);
  cursor: pointer;
  transition: all 0.15s ease;

  &.active {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border-color: var(--b3-theme-primary);
  }
}

.tm-selected-docs-box {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  max-height: 110px;
  overflow-y: auto;
  padding: 6px;
  background: var(--b3-theme-background-light);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  margin-bottom: 8px;
}

.tm-selected-doc-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 6px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  color: var(--b3-theme-on-surface);
  max-width: 220px;

  .doc-chip-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .doc-chip-del {
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    color: inherit;
    opacity: 0.6;
    display: inline-flex;
    align-items: center;

    &:hover {
      opacity: 1;
      color: var(--b3-theme-error);
    }
  }

  &.is-sub-doc {
    background: var(--b3-theme-background-light);
    border-style: dashed;
    opacity: 0.92;

    .sub-doc-tag {
      font-size: 10px;
      color: var(--b3-theme-primary);
      margin-right: 2px;
      font-weight: 600;
    }
  }
}

.tm-doc-search-panel,
.tm-notebook-panel {
  margin-top: 4px;
}

.tm-doc-search-results {
  margin-top: 6px;
  max-height: 120px;
  overflow-y: auto;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  background: var(--b3-theme-surface);
}

.tm-doc-result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--b3-border-color);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--b3-theme-background-light);
  }

  .tm-result-doc-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--b3-theme-on-surface);
  }

  .tm-result-doc-tags {
    font-size: 10px;
    color: var(--b3-theme-on-surface-light);
  }
}

.tm-divider {
  border: none;
  border-top: 1px solid var(--b3-border-color);
  margin: 12px 0;
}

.tm-batch-tags-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  max-height: 90px;
  overflow-y: auto;
  padding: 6px;
  background: var(--b3-theme-background-light);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  margin-bottom: 6px;
}

.tm-batch-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 500;
  background-color: var(--tm-badge-primary-bg, #ebf3fe);
  color: var(--tm-badge-primary-text, #1a56db);
  border: 1px solid var(--tm-badge-primary-border, rgba(26, 86, 219, 0.22));
  border-radius: 4px;

  .chip-del-btn {
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    color: inherit;
    opacity: 0.75;

    &:hover {
      opacity: 1;
      color: var(--tm-badge-danger-text, #b91c1c);
    }
  }
}

.tm-quick-groups-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  margin: 6px 0;
}

.tm-quick-hint {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
}

.tm-quick-group-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  cursor: pointer;

  &:hover {
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
}

.tm-quick-tag-candidates {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.tm-candidate-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px dashed var(--b3-border-color);
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  cursor: pointer;

  &:hover {
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }
}

.tm-footer-summary {
  margin-right: auto;
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
}
</style>
