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

  it('TagHygieneView 渲染时，操作按钮应统一样式、纯图标化且删除图标具备红色样式', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagHygieneView, {
      healthResult: {
        issues: [
          {
            type: 'case_conflict',
            primaryLabel: 'JavaScript',
            relatedLabels: ['javascript'],
            severity: 'warning',
            message: '大小写冲突',
            suggestedAction: 'merge',
          },
          {
            type: 'orphan',
            primaryLabel: 'obsolete',
            severity: 'info',
            message: '孤儿标签',
            suggestedAction: 'clean',
          },
        ],
        summary: {
          totalTags: 2,
          caseConflicts: 1,
          lowFrequency: 0,
          orphans: 1,
          healthyRate: 50,
        },
      },
    });

    app.directive('tooltip', {});

    const html = await renderToString(app);

    // 验证去除了文本标签，不包含原有的纯文本描述
    expect(html).not.toContain('<span>一键合并规范</span>');
    expect(html).not.toContain('<span>清理删除</span>');

    // 验证一键合并与清理删除按钮均统一采用 tm-icon-btn tm-btn-sm 纯图标无边框规范，不再包含 b3-button--outline 边框类
    expect(html).toContain('tm-icon-btn tm-btn-sm');
    expect(html).not.toContain('b3-button--outline');

    // 验证清理删除按钮具备 danger 状态与 text-danger 红色类
    expect(html).toContain('tm-btn-danger');
    expect(html).toContain('text-danger');

    // 验证包含对应的线性图标
    expect(html).toContain('sy-line-icon--git-merge');
    expect(html).toContain('sy-line-icon--trash');
  });

  it('TagFilterView 和 TagGraphView 中的仅图标按钮均统一使用无边框 tm-icon-btn 规范', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const filterApp = createSSRApp(TagFilterView, {
      allTags: [],
      activeFilter: { includeTags: [], excludeTags: [] },
      matchedBlocks: [],
      queryLoading: false,
      savedViews: [],
      selectedSmartViewId: '',
    });
    filterApp.directive('tooltip', {});
    const filterHtml = await renderToString(filterApp);
    // 验证保存视图按钮使用 tm-icon-btn 且无 b3-button--outline
    expect(filterHtml).toContain('tm-icon-btn tm-btn-sm');
    expect(filterHtml).not.toContain('b3-button--outline');

    const graphApp = createSSRApp(TagGraphView, {
      allTags: [],
      selectedGraphTag: 'test',
      graphData: { nodes: [], links: [] },
      timelineStats: { label: 'test', total: 0, firstUsed: '', lastUsed: '', monthDistribution: {} },
      associatedTags: [{ label: 'associated', weight: 3, jaccard: 0.5 }],
      topLinks: [],
    });
    graphApp.directive('tooltip', {});
    const graphHtml = await renderToString(graphApp);
    // 验证联合筛选按钮使用 tm-icon-btn 且无 b3-button--outline
    expect(graphHtml).toContain('tm-icon-btn tm-btn-sm');
    expect(graphHtml).not.toContain('b3-button--outline');
  });

  it('TagTreeView 渲染时，选中的标签节点应具备 is-selected 样式类并展示多选控制条', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagTreeView, {
      allTags: [
        { name: 'vue', label: 'vue', count: 10, depth: 0 },
        { name: 'react', label: 'react', count: 5, depth: 0 },
      ],
      loading: false,
      selectedTags: ['vue'],
      getTagStyle: () => ({}),
      getTagIcon: () => '',
    });

    app.directive('tooltip', {});

    const html = await renderToString(app);
    expect(html).toContain('is-selected');
    expect(html).toContain('tm-selection-bar');
    expect(html).toContain('已多选');
  });

  it('TagStyleModal 渲染时应包含重置按钮，且重置行为仅清空色彩主题并保留符号前缀和别名', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp, reactive } = await import('vue');

    const state = reactive({
      visible: true,
      label: 'testTag',
      presetId: 'ocean-blue',
      backgroundColor: '#EBF3FE',
      textColor: '#1A56DB',
      darkBackgroundColor: '#1E293B',
      darkTextColor: '#93C5FD',
      icon: '🚀',
      aliasesText: '别名1, 别名2',
    });

    const app = createSSRApp(TagStyleModal, { state });
    const html = await renderToString(app);

    // 1. 验证渲染包含重置按钮
    expect(html).toContain('tm-button--reset');
    expect(html).toContain('重置');

    // 2. 验证 TagStyleModal 的 setup 暴露方法与重置逻辑
    let resetHandler: (() => void) | undefined;
    let emittedEvent = '';
    const testApp = createSSRApp({
      setup() {
        let exposedMethods: any;
        (TagStyleModal as any).setup(
          { state },
          {
            emit: (e: string) => {
              emittedEvent = e;
            },
            expose: (exp: any) => {
              exposedMethods = exp;
            },
          },
        );
        resetHandler = exposedMethods?.resetTheme;
        return () => null;
      },
    });

    await renderToString(testApp, { modules: new Set() });

    expect(typeof resetHandler).toBe('function');
    // 执行重置
    resetHandler!();

    // 验证色彩主题相关属性被清空为最初未配置状态
    expect(state.presetId).toBe('');
    expect(state.backgroundColor).toBe('');
    expect(state.textColor).toBe('');
    expect(state.darkBackgroundColor).toBe('');
    expect(state.darkTextColor).toBe('');

    // 验证核心资产：符号前缀与别名列表完好保留
    expect(state.icon).toBe('🚀');
    expect(state.aliasesText).toBe('别名1, 别名2');

    // 验证成功触发 reset 事件通知
    expect(emittedEvent).toBe('reset');
  });
});

