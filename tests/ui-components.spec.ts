import { describe, expect, it } from 'vitest';
import TagTreeView from '../src/components/tabs/TagTreeView.vue';
import TagFilterView from '../src/components/tabs/TagFilterView.vue';
import TagGraphView from '../src/components/tabs/TagGraphView.vue';
import TagHygieneView from '../src/components/tabs/TagHygieneView.vue';
import TagRowMenu from '../src/components/dialogs/TagRowMenu.vue';
import TagStyleModal from '../src/components/dialogs/TagStyleModal.vue';
import TagSaveViewModal from '../src/components/dialogs/TagSaveViewModal.vue';
import TagBatchModal from '../src/components/dialogs/TagBatchModal.vue';
import TagMergeModal from '../src/components/dialogs/TagMergeModal.vue';
import { useTagData } from '../src/composables/useTagData';
import { useTagFilter } from '../src/composables/useTagFilter';
import { useTagHygiene } from '../src/composables/useTagHygiene';

describe('UI 模块化拆分与组件集成契约测试', () => {
  it('所有核心 Tab 视图组件应成功导出并具备标准 Vue SFC 结构', () => {
    expect(TagTreeView).toBeDefined();
    expect(TagFilterView).toBeDefined();
    expect(TagGraphView).toBeDefined();
    expect(TagHygieneView).toBeDefined();
  });

  it('所有对话框与操作菜单组件应成功导出', () => {
    expect(TagRowMenu).toBeDefined();
    expect(TagStyleModal).toBeDefined();
    expect(TagSaveViewModal).toBeDefined();
    expect(TagBatchModal).toBeDefined();
    expect(TagMergeModal).toBeDefined();
  });

  it('useTagData 提供完整的数据管理与状态访问能力', () => {
    const data = useTagData();
    expect(data.allTags).toBeDefined();
    expect(data.loading).toBeDefined();
    expect(typeof data.refreshTags).toBe('function');
    expect(typeof data.getTagIcon).toBe('function');
    expect(typeof data.getTagStyle).toBe('function');
    expect(typeof data.saveTagMetadata).toBe('function');
    expect(typeof data.handleRemoveTag).toBe('function');
    expect(typeof data.handleConvertToDoc).toBe('function');
  });

  it('useTagFilter 提供多维筛选与智能视图管理能力', () => {
    const filter = useTagFilter();
    expect(filter.activeFilter).toBeDefined();
    expect(filter.matchedBlocks).toBeDefined();
    expect(filter.queryLoading).toBeDefined();
    expect(typeof filter.runQuery).toBe('function');
    expect(typeof filter.toggleTagFilter).toBe('function');
    expect(typeof filter.toggleTagCondition).toBe('function');
    expect(typeof filter.removeFilterTag).toBe('function');
    expect(typeof filter.clearFilterTags).toBe('function');
    expect(typeof filter.highlightTags).toBe('function');
  });

  it('useTagHygiene 提供健康体检与问题修复能力', () => {
    const hygiene = useTagHygiene();
    expect(hygiene.healthResult).toBeDefined();
    expect(typeof hygiene.updateHealthResult).toBe('function');
    expect(typeof hygiene.autoResolveIssue).toBe('function');
  });
});
