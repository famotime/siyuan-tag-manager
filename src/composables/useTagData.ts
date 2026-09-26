import { ref } from 'vue';
import { showMessage } from 'siyuan';
import type { ITagGroup, ITagItem, ITagMetadata } from '../types/tag';
import { TagApiClient } from '../services/TagApiClient';
import { TagVisualService } from '../services/TagVisualService';
import { TagDomDecorator } from '../services/TagDomDecorator';
import { TagDocConverterService } from '../services/TagDocConverterService';
import { TagCreationService } from '../services/TagCreationService';
import { usePlugin } from '../main';

// 共享的标签资产与元数据状态
const allTags = ref<ITagItem[]>([]);
const loading = ref(false);
const metadataMap = ref<Map<string, ITagMetadata>>(new Map());
const tagGroups = ref<ITagGroup[]>([]);
const customTags = ref<string[]>([]);

export function useTagData() {
  /**
   * 统一持久化插件配置
   */
  async function persistConfig(savedViews: any[] = []) {
    const plugin = usePlugin();
    const metaList = Array.from(metadataMap.value.values());
    await plugin.saveData('tag-manager-config.json', {
      metadataList: metaList,
      savedViews,
      tagGroups: tagGroups.value,
      customTags: customTags.value,
    });
  }

  /**
   * 刷新全库标签数据与本地元数据配置
   */
  async function refreshTags(onLoaded?: (tags: ITagItem[]) => void) {
    loading.value = true;
    try {
      const plugin = usePlugin();
      const localData = await plugin.loadData('tag-manager-config.json').catch(() => null);
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

      if (localData?.customTags && Array.isArray(localData.customTags)) {
        customTags.value = localData.customTags;
      }

      const tags = await TagApiClient.fetchAllTags();
      tags.forEach(t => {
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
      showMessage(`加载标签失败: ${err.message || err}`, 4000, 'error');
      return [];
    } finally {
      loading.value = false;
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

  async function saveTagMetadata(meta: ITagMetadata, savedViews: any[] = []) {
    metadataMap.value.set(meta.label, meta);
    await persistConfig(savedViews);

    const metaList = Array.from(metadataMap.value.values());
    const css = TagVisualService.generateCssRules(metaList);
    TagVisualService.applyStyles(css);
    if (typeof document !== 'undefined') {
      TagDomDecorator.decorateElement(document);
    }
  }

  async function saveTagGroups(groups: ITagGroup[], savedViews: any[] = []) {
    tagGroups.value = groups;
    await persistConfig(savedViews);
  }

  /**
   * 将新标签仅添加到侧面板标签资产库中（不修改当前文档）
   */
  async function addCustomTag(rawLabel: string, savedViews: any[] = []): Promise<{ success: boolean; label: string; error?: string }> {
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
    if (!confirm(`确定要彻底删除标签 "${label}" 吗？此操作将移除关联引用的标签标记。`)) {
      return false;
    }
    loading.value = true;
    try {
      // 1. 若在 customTags 中，将其剔除并持久化
      if (customTags.value.some(t => t.toLowerCase() === label.toLowerCase())) {
        customTags.value = customTags.value.filter(t => t.toLowerCase() !== label.toLowerCase());
        await persistConfig();
      }

      // 2. 调用思源内核删除（若在思源库中存在引用）
      try {
        await TagApiClient.removeTag(label);
      } catch {
        // 若为仅本地存在的侧面板标签，内核中无引用时忽略该错误
      }

      showMessage(`已成功删除标签 "${label}"`, 3000, 'info');
      await refreshTags();
      return true;
    } catch (err: any) {
      showMessage(`删除标签失败: ${err.message || err}`, 4000, 'error');
      return false;
    } finally {
      loading.value = false;
    }
  }

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

  return {
    allTags,
    loading,
    metadataMap,
    customTags,
    addCustomTag,
    refreshTags,
    getTagIcon,
    getTagStyle,
    saveTagMetadata,
    tagGroups,
    saveTagGroups,
    handleRemoveTag,
    handleConvertToDoc,
  };
}
