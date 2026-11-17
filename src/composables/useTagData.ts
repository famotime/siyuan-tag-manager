import { computed, ref } from 'vue';
import { showMessage } from 'siyuan';
import type {
  ITagDeleteConfig,
  ITagGroup,
  ITagItem,
  ITagMetadata,
} from '../types/tag';
import { DEFAULT_TAG_DELETE_CONFIG } from '../types/tag';
import type { IColorPreset } from '../styles/palette';
import type { ITagCompanionConfig } from '../types/companion';
import { DEFAULT_COMPANION_CONFIG } from '../types/companion';
import { TagApiClient } from '../services/TagApiClient';
import { TagFilterEngine } from '../services/TagFilterEngine';
import { TagVisualService } from '../services/TagVisualService';
import { TagDomDecorator } from '../services/TagDomDecorator';
import { TagDocConverterService } from '../services/TagDocConverterService';
import { TagCreationService } from '../services/TagCreationService';
import { TagCompanionService } from '../services/TagCompanionService';
import { TagCompanionCache } from '../services/TagCompanionCache';
import { TagDeletionService } from '../services/TagDeletionService';
import { TagConfigStore } from '../services/TagConfigStore';
import { savedViews as sharedSavedViews } from './useTagFilter';

// 共享的标签资产与元数据状态
const allTags = ref<ITagItem[]>([]);
// 引用计数式全局忙碌状态：多条异步流（刷新/删除/重命名/升格/层级调整/图谱加载）
// 可重叠执行，单一布尔会被先结束者提前复位，计数器保证全部结束后才解除忙碌
const loadingDepth = ref(0);
const loading = computed(() => loadingDepth.value > 0);
const metadataMap = ref<Map<string, ITagMetadata>>(new Map());
const tagGroups = ref<ITagGroup[]>([]);
const customTags = ref<string[]>([]);
const customColorPresets = ref<IColorPreset[]>([]);
const companionConfig = ref<ITagCompanionConfig>({ ...DEFAULT_COMPANION_CONFIG });
const tagDeleteConfig = ref<ITagDeleteConfig>({ ...DEFAULT_TAG_DELETE_CONFIG });
// 全库刷新竞态防护序号：仅最新一次刷新可写入共享状态
let refreshSeq = 0;

export function useTagData() {
  /** 进入一段忙碌区间（配对调用；endLoading 需置于 finally） */
  function beginLoading() {
    loadingDepth.value++;
  }

  /** 退出一段忙碌区间 */
  function endLoading() {
    loadingDepth.value = Math.max(0, loadingDepth.value - 1);
  }

  /**
   * 统一持久化插件配置
   * @param savedViewsList 显式传入的智能视图快照；未传入时回退共享 savedViews 状态，
   *                       避免历史缺陷中无参调用以空数组覆盖磁盘上已保存视图
   */
  async function persistConfig(savedViewsList?: any[]) {
    const metaList = Array.from(metadataMap.value.values());
    // 统一经 TagConfigStore 读-合并-写持久化，避免整文件覆盖丢失其他配置
    await TagConfigStore.updateConfig({
      metadataList: metaList,
      savedViews: savedViewsList ?? sharedSavedViews.value,
      tagGroups: tagGroups.value,
      customTags: customTags.value,
      customColorPresets: customColorPresets.value,
      companionConfig: companionConfig.value,
      tagDeleteConfig: tagDeleteConfig.value,
    });
  }

  /**
   * 刷新全库标签数据与本地元数据配置
   * 竞态防护：仅最新一次刷新允许写入共享状态，先发后至的旧响应整体丢弃
   */
  async function refreshTags(onLoaded?: (tags: ITagItem[]) => void) {
    const seq = ++refreshSeq;
    beginLoading();
    try {
      const localData = await TagConfigStore.readConfig();
      if (seq !== refreshSeq) return allTags.value;

      if (localData?.metadataList && Array.isArray(localData.metadataList)) {
        const map = new Map<string, ITagMetadata>();
        localData.metadataList.forEach((m: ITagMetadata) => map.set(m.label, m));
        metadataMap.value = map;
        const css = TagVisualService.generateCssRules(localData.metadataList);
        TagVisualService.applyStyles(css);
      }

      if (localData?.tagGroups && Array.isArray(localData.tagGroups)) {
        tagGroups.value = localData.tagGroups;
      }

      // 回填智能视图（历史上漏回填导致保存的视图重启后永远丢失）
      if (localData?.savedViews && Array.isArray(localData.savedViews)) {
        sharedSavedViews.value = localData.savedViews;
      }

      if (localData?.customTags && Array.isArray(localData.customTags)) {
        customTags.value = localData.customTags;
      }

      if (localData?.customColorPresets && Array.isArray(localData.customColorPresets)) {
        customColorPresets.value = localData.customColorPresets;
      }

      if (localData?.companionConfig) {
        companionConfig.value = { ...DEFAULT_COMPANION_CONFIG, ...localData.companionConfig };
        TagCompanionService.updateConfig(companionConfig.value);
      }

      if (localData?.tagDeleteConfig) {
        tagDeleteConfig.value = { ...DEFAULT_TAG_DELETE_CONFIG, ...localData.tagDeleteConfig };
      }

      const tags = await TagApiClient.fetchAllTags();
      if (seq !== refreshSeq) return allTags.value;

      tags.forEach((t) => {
        t.metadata = metadataMap.value.get(t.label);
      });

      // 合并本地在侧面板创建但尚未被文档引用的自定义标签
      const existingTagSet = new Set(tags.map(t => t.label.toLowerCase()));
      for (const cTag of customTags.value) {
        const clean = TagCreationService.cleanTag(cTag);
        if (clean && !existingTagSet.has(clean.toLowerCase())) {
          existingTagSet.add(clean.toLowerCase());
          const parts = clean.split('/');
          tags.push({
            name: parts[parts.length - 1],
            label: clean,
            count: 0,
            blockCount: 0,
            docCount: 0,
            depth: Math.max(0, parts.length - 1),
            metadata: metadataMap.value.get(clean),
          });
        }
      }

      allTags.value = tags;
      if (onLoaded) {
        onLoaded(tags);
      }
      return tags;
    } catch (err: any) {
      // 仅最新一次刷新提示错误，避免并发刷新重复弹 toast
      if (seq === refreshSeq) {
        showMessage(`加载标签失败: ${err.message || err}`, 4000, 'error');
      }
      return [];
    } finally {
      endLoading();
    }
  }

  function getTagIcon(label: string): string {
    return metadataMap.value.get(label)?.icon || '';
  }

  function isDarkMode(): boolean {
    if (typeof document === 'undefined') return false;
    return document.documentElement.getAttribute('data-theme-mode') === 'dark'
      || (document.body && document.body.classList.contains('theme--dark'));
  }

  function getTagStyle(label: string): Record<string, string> {
    const meta = metadataMap.value.get(label);
    if (!meta) return {};
    const s: Record<string, string> = {};
    const dark = isDarkMode();

    const bg = dark && meta.darkBackgroundColor ? meta.darkBackgroundColor : meta.backgroundColor;
    const color = dark && meta.darkTextColor ? meta.darkTextColor : meta.textColor;

    if (bg) s.backgroundColor = bg;
    if (color) s.color = color;
    if (bg || color) {
      s.borderRadius = '4px';
      s.padding = '1px 6px';
    }
    return s;
  }

  async function saveTagMetadata(meta: ITagMetadata, savedViews?: any[]) {
    metadataMap.value.set(meta.label, meta);
    await persistConfig(savedViews);

    const metaList = Array.from(metadataMap.value.values());
    const css = TagVisualService.generateCssRules(metaList);
    TagVisualService.applyStyles(css);
    if (typeof document !== 'undefined') {
      TagDomDecorator.decorateElement(document);
    }
  }

  async function saveTagGroups(groups: ITagGroup[], savedViews?: any[]) {
    tagGroups.value = groups;
    await persistConfig(savedViews);
  }

  /**
   * 将新标签仅添加到侧面板标签资产库中（不修改当前文档）
   */
  async function addCustomTag(rawLabel: string, savedViews?: any[]): Promise<{ success: boolean; label: string; error?: string }> {
    const validation = TagCreationService.validateTag(rawLabel);
    if (!validation.valid) {
      return { success: false, label: rawLabel, error: validation.error };
    }

    const label = validation.cleanLabel;
    if (TagCreationService.isTagExisting(label, allTags.value)) {
      return { success: false, label, error: `标签 "#${label}#" 已存在于侧面板中` };
    }

    if (!customTags.value.some(t => t.toLowerCase() === label.toLowerCase())) {
      customTags.value.push(label);
    }

    const parts = label.split('/');
    const newItem: ITagItem = {
      name: parts[parts.length - 1],
      label,
      count: 0,
      blockCount: 0,
      docCount: 0,
      depth: Math.max(0, parts.length - 1),
      metadata: metadataMap.value.get(label),
    };

    allTags.value.push(newItem);
    await persistConfig(savedViews);

    return { success: true, label };
  }

  async function handleRemoveTag(label: string): Promise<boolean> {
    // 确认交互统一由调用层（App 的自绘确认模态）完成，此处专注执行删除
    beginLoading();
    try {
      // 1. 若在 customTags 中，将其剔除
      if (customTags.value.some(t => t.toLowerCase() === label.toLowerCase())) {
        customTags.value = customTags.value.filter(t => t.toLowerCase() !== label.toLowerCase());
      }

      // 2. 若在元数据中，将其删除
      if (metadataMap.value.has(label)) {
        metadataMap.value.delete(label);
      }

      // 3. 执行标签删除（非文档级按配置剥离/替换/删除，文档级更新属性）
      const result = await TagDeletionService.executeDeleteTag(label, tagDeleteConfig.value);

      await persistConfig();

      if (result.success) {
        // 标签已从全库移除：标记伴生推荐共现索引待重建
        TagCompanionCache.markDirty();
      }
      if (result.errors.length > 0) {
        showMessage(`已删除标签 "${label}"，但有 ${result.errors.length} 处更新遇到异常`, 4000, 'error');
      } else if (result.affectedBlocks > 0) {
        showMessage(`已成功删除标签 "${label}"，处理了 ${result.affectedBlocks} 处标签引用`, 3000, 'info');
      } else {
        showMessage(`已成功删除标签 "${label}"`, 3000, 'info');
      }

      // 数据刷新统一由调用层（App.refreshAllData）收口，避免同一操作触发两遍全量拉取
      return result.success;
    } catch (err: any) {
      showMessage(`删除标签失败: ${err.message || err}`, 4000, 'error');
      return false;
    } finally {
      endLoading();
    }
  }

  async function handleConvertToDoc(label: string) {
    beginLoading();
    try {
      const blocks = await TagFilterEngine.queryMatchedBlocks(
        { includeTags: [label], limit: 30 },
        (url: string, data: any) => TagApiClient.request(url, data),
      );
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
      endLoading();
    }
  }

  async function saveCustomColorPreset(preset: IColorPreset, savedViews?: any[]) {
    const existingIndex = customColorPresets.value.findIndex(p => p.id === preset.id);
    if (existingIndex >= 0) {
      customColorPresets.value[existingIndex] = preset;
    } else {
      customColorPresets.value.push(preset);
    }
    await persistConfig(savedViews);
  }

  async function removeCustomColorPreset(presetId: string, savedViews?: any[]) {
    customColorPresets.value = customColorPresets.value.filter(p => p.id !== presetId);
    await persistConfig(savedViews);
  }

  /**
   * 批量应用拖拽层级重构变动（重命名与元数据迁移）
   */
  /**
   * 级联迁移共享智能视图中的筛选标签（与元数据/标签组迁移保持一致，避免重命名后旧视图查询失效）
   */
  function migrateSavedViewsTags(oldLabel: string, newLabel: string) {
    const oldPrefix = `${oldLabel}/`;
    const migrate = (list: string[]) => list.map((t) => {
      if (t === oldLabel) return newLabel;
      if (t.startsWith(oldPrefix)) return `${newLabel}/${t.slice(oldPrefix.length)}`;
      return t;
    });
    sharedSavedViews.value = sharedSavedViews.value.map((view) => {
      const includeTags = migrate(view.includeTags || []);
      const excludeTags = migrate(view.excludeTags || []);
      const optionalTags = migrate(view.optionalTags || []);
      if (
        includeTags.join('\0') === (view.includeTags || []).join('\0')
        && excludeTags.join('\0') === (view.excludeTags || []).join('\0')
        && optionalTags.join('\0') === (view.optionalTags || []).join('\0')
      ) {
        return view;
      }
      return { ...view, includeTags, excludeTags, optionalTags };
    });
  }

  async function handleBatchReparent(
    moves: Array<{ oldLabel: string; newLabel: string }>,
  ): Promise<{ success: boolean; error?: string }> {
    if (!moves || moves.length === 0) return { success: true };
    beginLoading();
    try {
      // 1. 过滤出需要调用内核 renameTag 的根变动节点（思源内核 renameTag 会自动级联处理下属所有子标签）
      const kernelRenames: Array<{ oldLabel: string; newLabel: string }> = [];
      for (const m of moves) {
        if (m.oldLabel === m.newLabel) continue;
        const isCoveredByPrevious = kernelRenames.some(r => m.oldLabel.startsWith(`${r.oldLabel}/`));
        if (!isCoveredByPrevious) {
          kernelRenames.push(m);
        }
      }

      for (const kr of kernelRenames) {
        await TagApiClient.renameTag(kr.oldLabel, kr.newLabel);
      }

      // 2. 迁移所有变动项的元数据、侧面板自定义标签、标签组与智能视图（与 handleRenameTag 行为保持一致）
      for (const m of moves) {
        if (m.oldLabel === m.newLabel) continue;
        const oldMeta = metadataMap.value.get(m.oldLabel);
        if (oldMeta) {
          metadataMap.value.delete(m.oldLabel);
          metadataMap.value.set(m.newLabel, {
            ...oldMeta,
            label: m.newLabel,
            updatedAt: Date.now(),
          });
        }
        const customIdx = customTags.value.indexOf(m.oldLabel);
        if (customIdx >= 0) {
          customTags.value[customIdx] = m.newLabel;
        }
        const oldPrefix = `${m.oldLabel}/`;
        tagGroups.value = tagGroups.value.map((g) => {
          let changed = false;
          const nextTags = g.tags.map((t) => {
            if (t === m.oldLabel) {
              changed = true;
              return m.newLabel;
            }
            if (t.startsWith(oldPrefix)) {
              changed = true;
              return `${m.newLabel}/${t.slice(oldPrefix.length)}`;
            }
            return t;
          });
          return changed ? { ...g, tags: nextTags } : g;
        });
        migrateSavedViewsTags(m.oldLabel, m.newLabel);
      }
      await persistConfig();
      await refreshTags();
      // 层级已变更：标记伴生推荐共现索引待重建
      TagCompanionCache.markDirty();
      showMessage(`已成功更新 ${moves.length} 项标签层级！`, 3000, 'info');
      return { success: true };
    } catch (err: any) {
      showMessage(`调整层级失败: ${err.message || err}`, 4000, 'error');
      await refreshTags();
      return { success: false, error: err.message || String(err) };
    } finally {
      endLoading();
    }
  }

  /**
   * 统一的标签身份迁移协议：将 oldLabel 及其全部子标签在本地状态中的引用迁移到 newLabel。
   * 覆盖元数据（目标已存在时保留目标样式并合并别名）、自定义标签、标签组（组内去重）、
   * 智能视图四类状态并重放全局 CSS。供内核重命名/合并/规范化等一切改名路径复用，避免协议分叉。
   * 注意：本函数只迁移内存态，不持久化；调用方负责 persistConfig。
   */
  function migrateTagReferences(oldLabel: string, newLabel: string) {
    if (!oldLabel || !newLabel || oldLabel === newLabel) return;

    const oldPrefix = `${oldLabel}/`;
    const newPrefix = `${newLabel}/`;

    // 1. 元数据迁移（含全部子标签；目标键已存在时合并别名并保留目标样式字段）
    const metasToMigrate: Array<{ oldKey: string; newKey: string; meta: ITagMetadata }> = [];
    for (const [key, meta] of metadataMap.value.entries()) {
      if (key === oldLabel) {
        metasToMigrate.push({ oldKey: key, newKey: newLabel, meta });
      } else if (key.startsWith(oldPrefix)) {
        metasToMigrate.push({
          oldKey: key,
          newKey: `${newPrefix}${key.slice(oldPrefix.length)}`,
          meta,
        });
      }
    }
    for (const item of metasToMigrate) {
      const existing = metadataMap.value.get(item.newKey);
      metadataMap.value.delete(item.oldKey);
      metadataMap.value.set(item.newKey, existing
        ? {
            ...item.meta,
            ...existing,
            label: item.newKey,
            aliases: Array.from(new Set([...(existing.aliases || []), ...(item.meta.aliases || [])])),
            updatedAt: Date.now(),
          }
        : { ...item.meta, label: item.newKey, updatedAt: Date.now() });
    }

    // 2. 自定义标签迁移（大小写不敏感去重，避免迁移产生重复项）
    const seenCustom = new Set<string>();
    customTags.value = customTags.value
      .map((tag) => {
        if (tag === oldLabel) return newLabel;
        if (tag.startsWith(oldPrefix)) return `${newPrefix}${tag.slice(oldPrefix.length)}`;
        return tag;
      })
      .filter((tag) => {
        const lower = tag.toLowerCase();
        if (seenCustom.has(lower)) return false;
        seenCustom.add(lower);
        return true;
      });

    // 3. 标签组迁移（组内大小写不敏感去重）
    tagGroups.value = tagGroups.value.map((g) => {
      let changed = false;
      const seenInGroup = new Set<string>();
      const nextTags: string[] = [];
      for (const t of g.tags) {
        let next = t;
        if (t === oldLabel) {
          next = newLabel;
          changed = true;
        } else if (t.startsWith(oldPrefix)) {
          next = `${newPrefix}${t.slice(oldPrefix.length)}`;
          changed = true;
        }
        const lower = next.toLowerCase();
        if (seenInGroup.has(lower)) {
          changed = true;
          continue;
        }
        seenInGroup.add(lower);
        nextTags.push(next);
      }
      return changed ? { ...g, tags: nextTags } : g;
    });

    // 4. 智能视图迁移
    migrateSavedViewsTags(oldLabel, newLabel);

    // 5. 重放全局标签样式
    const metaList = Array.from(metadataMap.value.values());
    TagVisualService.applyStyles(TagVisualService.generateCssRules(metaList));
    if (typeof document !== 'undefined') {
      TagDomDecorator.decorateElement(document);
    }
  }

  /**
   * 执行标签重命名并全面迁移关联元数据（含所有子标签、自定义标签、标签组）
   */
  async function handleRenameTag(
    oldLabel: string,
    newLabel: string,
    savedViews?: any[],
  ): Promise<{ success: boolean; error?: string }> {
    if (!oldLabel || !newLabel || oldLabel === newLabel) {
      return { success: false, error: '新旧标签名称相同或为空' };
    }
    beginLoading();
    try {
      // 1. 调用内核原生重命名接口（思源内核会自动级联处理全库中下属所有子标签）
      await TagApiClient.renameTag(oldLabel, newLabel);

      // 2. 按统一身份迁移协议迁移元数据/自定义标签/标签组/智能视图并重放 CSS
      migrateTagReferences(oldLabel, newLabel);

      // 3. 应用样式后持久化存储配置
      await persistConfig(savedViews);
      // 数据刷新统一由调用层（App.refreshAllData）收口；失败路径保留刷新以回滚展示真实内核状态
      // 标签名已变更：标记伴生推荐共现索引待重建
      TagCompanionCache.markDirty();

      return { success: true };
    } catch (err: any) {
      await refreshTags();
      return { success: false, error: err.message || String(err) };
    } finally {
      endLoading();
    }
  }

  async function saveCompanionConfig(config: ITagCompanionConfig, savedViews?: any[]) {
    companionConfig.value = { ...config };
    TagCompanionService.updateConfig(config);
    await persistConfig(savedViews);
    showMessage('伴生推荐设置已保存', 3000, 'info');
  }

  async function saveTagDeleteConfig(config: ITagDeleteConfig, savedViews?: any[]) {
    tagDeleteConfig.value = { ...config };
    await persistConfig(savedViews);
  }

  return {
    allTags,
    loading,
    beginLoading,
    endLoading,
    metadataMap,
    customTags,
    customColorPresets,
    companionConfig,
    tagDeleteConfig,
    saveCompanionConfig,
    saveTagDeleteConfig,
    saveCustomColorPreset,
    removeCustomColorPreset,
    addCustomTag,
    refreshTags,
    getTagIcon,
    getTagStyle,
    saveTagMetadata,
    tagGroups,
    saveTagGroups,
    handleRemoveTag,
    handleConvertToDoc,
    handleBatchReparent,
    handleRenameTag,
    migrateTagReferences,
    persistConfig,
  };
}
