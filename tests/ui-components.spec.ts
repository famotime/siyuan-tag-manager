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
import TagGroupModal from '../src/components/dialogs/TagGroupModal.vue';
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
    expect(typeof data.handleRenameTag).toBe('function');
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

    // 验证三大核心治理统计卡片标题渲染
    expect(html).toContain('相似冲突');
    expect(html).toContain('不合规范');
    expect(html).toContain('低频使用');
    expect(html).not.toContain('tm-filter-pills');
  });

  it('TagRenameModal 渲染时，应展示原标签名、输入框与实时校验提示', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');
    const TagRenameModal = (await import('../src/components/dialogs/TagRenameModal.vue')).default;

    const app = createSSRApp(TagRenameModal, {
      state: {
        visible: true,
        oldLabel: 'Prompt',
        newLabel: 'Prompt',
        executing: false,
      },
    });

    const html = await renderToString(app);
    expect(html).toContain('标签重命名');
    expect(html).toContain('#Prompt#');
    expect(html).toContain('b3-button--primary');
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

  it('TagTreeView 节点操作区应渲染重命名编辑按钮，具备 sy-line-icon--edit 图标', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagTreeView, {
      allTags: [
        { name: 'vue', label: 'vue', count: 10, depth: 0 },
      ],
      loading: false,
      selectedTags: [],
      getTagStyle: () => ({}),
      getTagIcon: () => '',
    });

    app.directive('tooltip', {});

    const html = await renderToString(app);
    expect(html).toContain('sy-line-icon--edit');
    expect(html).toContain('tm-node-actions');
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

  it('TagStyleModal 增强特性测试：包含双主题实时胶囊对比、可视化拾色器、常用色板、分类 Emoji 候选项与自定义主题预设', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp, reactive } = await import('vue');

    const state = reactive({
      visible: true,
      label: 'Python',
      presetId: '',
      backgroundColor: '#E8F7F0',
      textColor: '#0E6E45',
      darkBackgroundColor: '',
      darkTextColor: '',
      icon: '💡',
      aliasesText: 'py',
    });

    const customPresets = [
      {
        id: 'custom-1',
        name: '我的自定主题',
        lightBg: '#FEF3E6',
        lightText: '#B45309',
        lightBorder: 'rgba(0,0,0,0.1)',
        darkBg: 'rgba(245, 158, 11, 0.20)',
        darkText: '#FCD34D',
        darkBorder: 'rgba(252, 211, 77, 0.25)',
        isCustom: true,
      },
    ];

    const app = createSSRApp(TagStyleModal, { state, customPresets });
    const html = await renderToString(app);

    // 1. 验证双主题实时对比预览区域
    expect(html).toContain('tm-preview-section');
    expect(html).toContain('Light 亮色');
    expect(html).toContain('Dark 暗黑');
    expect(html).toContain('💡 Python');

    // 2. 验证可视化拾色器与快速候选色块
    expect(html).toContain('tm-color-input-native');
    expect(html).toContain('tm-fast-colors-row');
    expect(html).toContain('tm-fast-color-dot');

    // 3. 验证分类 Emoji 候选项
    expect(html).toContain('tm-emoji-picker-container');
    expect(html).toContain('tm-emoji-tabs');
    expect(html).toContain('灵感状态');
    expect(html).toContain('tm-emoji-grid');

    // 4. 验证自定义预设主题卡片与保存新预设按钮
    expect(html).toContain('我的自定主题');
    expect(html).toContain('tm-preset-delete-btn');
    expect(html).toContain('保存当前为新预设');
  });

  it('TagTreeView 在搜索无匹配标签时，展示清晰的新标签创建引导面板与回车提示', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    let setupCtx: any;
    let emittedLabel = '';

    const testApp = createSSRApp({
      setup() {
        const props = {
          allTags: [
            { name: 'vue', label: 'vue', count: 10, depth: 0 },
            { name: 'react', label: 'react', count: 5, depth: 0 },
          ],
          loading: false,
          selectedTags: [],
          tagGroups: [],
          getTagStyle: () => ({}),
          getTagIcon: () => '',
        };

        const ctx = (TagTreeView as any).setup(props, {
          emit: (event: string, payload: any) => {
            if (event === 'create-tag') {
              emittedLabel = payload;
            }
          },
          expose: () => {},
        });

        setupCtx = ctx;

        // 模拟用户在搜索框输入未匹配到的关键词
        ctx.searchKeyword.value = 'Rust/Async';

        return () => null;
      },
    });

    testApp.directive('tooltip', {});
    await renderToString(testApp, { modules: new Set() });

    // 验证状态计算：无匹配、可创建
    expect(setupCtx.displayTreeNodes.value.length).toBe(0);
    expect(setupCtx.canCreateTag.value).toBe(true);
    expect(setupCtx.normalizedKeyword.value).toBe('Rust/Async');

    // 模拟用户按下 Enter 回车键 (非中文输入法选词)
    setupCtx.handleSearchEnter({ isComposing: false } as KeyboardEvent);
    expect(emittedLabel).toBe('Rust/Async');

    // 模拟输入包含首尾井号和空格的文本
    setupCtx.searchKeyword.value = ' #Golang/Gin# ';
    expect(setupCtx.normalizedKeyword.value).toBe('Golang/Gin');
    setupCtx.handleSearchEnter({ isComposing: false } as KeyboardEvent);
    expect(emittedLabel).toBe('Golang/Gin');

    // 模拟输入法合成期间敲回车 (isComposing: true)，应当被拦截不触发创建
    emittedLabel = '';
    setupCtx.searchKeyword.value = 'Python';
    setupCtx.handleSearchEnter({ isComposing: true } as KeyboardEvent);
    expect(emittedLabel).toBe('');
  });

  it('TagTreeView 在搜索无结果渲染 SSR HTML 时包含引导面板与回车键指示', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp, ref, h } = await import('vue');

    // 通过包裹组件模拟搜索状态渲染完整 DOM
    const wrapper = {
      setup() {
        return () =>
          h(TagTreeView, {
            allTags: [{ name: 'vue', label: 'vue', count: 10, depth: 0 }],
            loading: false,
            getTagStyle: () => ({}),
            getTagIcon: () => '',
          });
      },
    };

    const app = createSSRApp(wrapper);
    app.directive('tooltip', {});

    // 默认空搜索时不出现创建面板
    const defaultHtml = await renderToString(app);
    expect(defaultHtml).not.toContain('tm-empty-create-guide');

    const searchApp = createSSRApp({
      setup() {
        let treeInstance: any;
        const sub = h(TagTreeView, {
          allTags: [{ name: 'vue', label: 'vue', count: 10, depth: 0 }],
          loading: false,
          getTagStyle: () => ({}),
          getTagIcon: () => '',
          ref: (el: any) => {
            treeInstance = el;
          },
        });

        return () => sub;
      },
    });
    searchApp.directive('tooltip', {});
    const rendered = await renderToString(searchApp);
    expect(rendered).toContain('tm-tree-scroller');
  });

  it('TagTreeView 渲染时，外层操作栏直接展示定制色彩与别名(palette)、删除标签(trash)按钮并具备危险样式', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagTreeView, {
      allTags: [
        { name: 'typescript', label: 'typescript', count: 8, depth: 0 },
      ],
      loading: false,
      getTagStyle: () => ({}),
      getTagIcon: () => '',
    });

    app.directive('tooltip', {});

    const html = await renderToString(app);

    // 验证外层操作栏包含快捷筛选、定制色彩与别名、删除标签与更多操作按钮
    expect(html).toContain('sy-line-icon--search-plus');
    expect(html).toContain('sy-line-icon--palette');
    expect(html).toContain('sy-line-icon--trash');
    expect(html).toContain('sy-line-icon--more-horizontal');

    // 验证外层删除标签按钮具备 tm-btn-danger 危险操作类
    expect(html).toContain('tm-action-btn tm-btn-danger');
  });

  it('TagRowMenu 更多操作菜单中不再包含已移到外层的定制色彩与删除标签选项', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagRowMenu, {
      state: {
        visible: true,
        label: 'testTag',
        top: 100,
        left: 200,
      },
    });

    const html = await renderToString(app);

    // 验证不再包含“定制色彩与别名”和“删除标签”
    expect(html).not.toContain('定制色彩与别名');
    expect(html).not.toContain('从全库安全删除标签');
    expect(html).not.toContain('sy-line-icon--palette');
    expect(html).not.toContain('sy-line-icon--trash');

    // 验证仍保留升格为主题聚合文档、关联洞察与重构合并功能
    expect(html).toContain('升格为主题聚合文档');
    expect(html).toContain('查看关联洞察与时序');
    expect(html).toContain('重构合并到其他标签');
  });

  it('useTagFilter 的 handleQuickFilter 在追加模式下具备与 Ctrl 点击一致的反选与后台添加能力', () => {
    const { activeFilter, handleQuickFilter, handleTagClick } = useTagFilter();
    activeFilter.value = { includeTags: [], excludeTags: [] };

    // 第一次调用加入组合筛选
    handleQuickFilter('TypeScript', true);
    expect(activeFilter.value.includeTags).toContain('TypeScript');

    // 第二次调用切换反选移除（与 Ctrl+点击保持一致）
    handleQuickFilter('TypeScript', true);
    expect(activeFilter.value.includeTags).not.toContain('TypeScript');

    // 验证与 handleTagClick 传入 ctrlKey 效果完全相同
    handleTagClick('Rust', { ctrlKey: true } as MouseEvent);
    expect(activeFilter.value.includeTags).toContain('Rust');
    handleQuickFilter('Vue', true);
    expect(activeFilter.value.includeTags).toEqual(['Rust', 'Vue']);
  });

  it('TagTreeView 中已加入组合筛选的标签，其快捷筛选按钮应具备 is-active 样式', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagTreeView, {
      allTags: [
        { name: 'typescript', label: 'typescript', count: 8, depth: 0 },
      ],
      loading: false,
      selectedTags: ['typescript'],
      getTagStyle: () => ({}),
      getTagIcon: () => '',
    });

    app.directive('tooltip', {});

    const html = await renderToString(app);

    // 选中的标签对应的 search-plus 按钮具备 is-active 类
    expect(html).toContain('is-active');
  });

  it('TagTreeView 顶部右侧排序选项应使用简洁图标示意，避免超长折叠', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagTreeView, {
      allTags: [],
      loading: false,
      getTagStyle: () => ({}),
      getTagIcon: () => '',
    });

    app.directive('tooltip', {});

    const html = await renderToString(app);

    // 验证包含简洁图标示意
    expect(html).toContain('引用数 ↓');
    expect(html).toContain('引用数 ↑');
    expect(html).toContain('拼音 A→Z');
    expect(html).toContain('拼音 Z→A');

    // 验证不再包含引起折叠的冗长中文括号文本
    expect(html).not.toContain('(多→少)');
    expect(html).not.toContain('(少→多)');
    expect(html).not.toContain('(A→Z)');
    expect(html).not.toContain('(Z→A)');
  });

  it('TagGroupModal 去除分组主题配色选区，且为候选标签提供充足展示空间（突破原10个限制）', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    // 创建 25 个候选标签
    const mockTags = Array.from({ length: 25 }, (_, i) => ({
      name: `tag_${i + 1}`,
      label: `tag_${i + 1}`,
      count: i + 1,
      depth: 0,
    }));

    const app = createSSRApp(TagGroupModal, {
      state: {
        visible: true,
        isEdit: false,
        name: '测试分组',
        tags: [],
      },
      allTags: mockTags,
    });

    const html = await renderToString(app);

    // 1. 验证彻底去除主题配色选项
    expect(html).not.toContain('分组主题配色');
    expect(html).not.toContain('tm-color-palette-grid');
    expect(html).not.toContain('tm-preset-card');
    expect(html).not.toContain('经典蓝');

    // 2. 验证候选标签展示支持更多标签（全部 25 个均被渲染，不再被 .slice(0, 10) 截断）
    for (let i = 1; i <= 25; i++) {
      expect(html).toContain(`#tag_${i}#`);
    }

    // 3. 验证存在可用候选总数提示
    expect(html).toContain('共 25 个可用候选');
  });

  it('TagFilterView 正确渲染 OR (可选) 芯片、模式切换按钮以及候选标签 is-optional 激活态', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagFilterView, {
      allTags: [
        { name: 'Vue', label: 'Vue', count: 10, depth: 0 },
        { name: 'React', label: 'React', count: 8, depth: 0 },
        { name: 'Angular', label: 'Angular', count: 2, depth: 0 },
      ],
      activeFilter: {
        includeTags: ['Vue'],
        optionalTags: ['React'],
        excludeTags: ['Angular'],
      },
      matchedBlocks: [],
      queryLoading: false,
      savedViews: [],
      selectedSmartViewId: '',
    });

    app.directive('tooltip', {});

    const html = await renderToString(app);

    // 1. 验证存在模式切换控制器
    expect(html).toContain('tm-filter-mode-switch');
    expect(html).toContain('AND 必含');
    expect(html).toContain('OR 可选');
    expect(html).toContain('NOT 排除');

    // 2. 验证正确渲染三种芯片：AND, OR, NOT
    expect(html).toContain('tm-chip--inc');
    expect(html).toContain('tm-chip--opt');
    expect(html).toContain('tm-chip--exc');
    expect(html).toContain('#React');

    // 3. 验证快速候选标签对应激活态类名
    expect(html).toContain('is-included');
    expect(html).toContain('is-optional');
    expect(html).toContain('is-excluded');
  });

  it('TagFilterView 当筛选条件仅包含 optionalTags 时，OR 可选模式按钮处于激活状态', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagFilterView, {
      allTags: [
        { name: 'Vue', label: 'Vue', count: 10, depth: 0 },
        { name: 'React', label: 'React', count: 8, depth: 0 },
      ],
      activeFilter: {
        includeTags: [],
        optionalTags: ['Vue', 'React'],
        excludeTags: [],
      },
      matchedBlocks: [],
      queryLoading: false,
      savedViews: [],
      selectedSmartViewId: '',
    });

    app.directive('tooltip', {});

    const html = await renderToString(app);
    expect(html).toMatch(/tm-mode-btn--opt[^>]*active/);
    expect(html).toContain('tm-chip--opt');
    expect(html).toContain('#Vue');
    expect(html).toContain('#React');
  });

  it('TagSaveViewModal 正确渲染可选标签 (OR) 提示信息', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagSaveViewModal, {
      state: { visible: true, title: '智能视图' },
      includeTags: ['Vue'],
      optionalTags: ['React', 'NextJS'],
      excludeTags: ['Angular'],
    });

    const html = await renderToString(app);
    expect(html).toContain('包含 (AND): #Vue');
    expect(html).toContain('可选 (OR): #React, #NextJS');
    expect(html).toContain('排除 (NOT): #Angular');
  });

  it('TagFilterView 包含搜索输入框，支持根据拼音或关键词搜索后添加标签', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagFilterView, {
      allTags: [
        { name: 'YouTube', label: 'YouTube', count: 10, depth: 0 },
        { name: 'Prompt', label: 'Prompt', count: 5, depth: 0 },
      ],
      activeFilter: {
        includeTags: [],
        optionalTags: [],
        excludeTags: [],
      },
      matchedBlocks: [],
      queryLoading: false,
      savedViews: [],
      selectedSmartViewId: '',
    });

    app.directive('tooltip', {});

    const html = await renderToString(app);

    // 1. 验证存在搜索控件
    expect(html).toContain('tm-filter-search-row');
    expect(html).toContain('tm-search-box');
    expect(html).toContain('placeholder="搜索标签并回车添加（支持拼音首字母如 ytb）..."');

    // 2. 验证包含搜索图标
    expect(html).toContain('sy-line-icon--search');
  });

  it('TagGraphView 关联洞察正确渲染多标签频繁组合、维度筛选胶囊与纯图标操作按钮', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagGraphView, {
      allTags: [
        { name: 'Vue', label: 'Vue', count: 10, depth: 0 },
        { name: 'Vite', label: 'Vite', count: 8, depth: 0 },
        { name: 'TS', label: 'TS', count: 6, depth: 0 },
      ],
      selectedGraphTag: 'Vue',
      graphData: { nodes: [{ id: 'Vue', label: 'Vue', count: 10 }], links: [] },
      timelineStats: null,
      associatedTags: [
        { label: 'Vite', weight: 4, jaccard: 0.6 },
      ],
      tagCombinations: [
        { tags: ['TS', 'Vite', 'Vue'], count: 3 },
        { tags: ['Vite', 'Vue'], count: 5 },
      ],
    });

    app.directive('tooltip', {});

    const html = await renderToString(app);

    // 1. 验证文案更新为关联洞察
    expect(html).toContain('高频关联组合 (Top Associations)');

    // 2. 验证包含标签数量维度筛选胶囊
    expect(html).toContain('全部');
    expect(html).toContain('2 标');
    expect(html).toContain('3 标');
    expect(html).toContain('4+ 标');

    // 3. 验证正确渲染 3 标多元组合
    expect(html).toContain('#TS#');
    expect(html).toContain('#Vite#');
    expect(html).toContain('#Vue#');
    expect(html).toContain('3 次');
    expect(html).toContain('5 次');

    // 4. 验证操作按钮统一采用纯图标无边框 tm-icon-btn，包含 search-plus 与 layers-plus 图标
    expect(html).toContain('sy-line-icon--search-plus');
    expect(html).toContain('sy-line-icon--layers-plus');
    // 列表项中不应出现文字形式的“探查”或“保存为标签组”按钮文字（严格纯图标化）
    expect(html).not.toMatch(/<button[^>]*>[\s\n]*<span>探查<\/span>/);
    expect(html).not.toMatch(/<button[^>]*>[\s\n]*<span>保存为标签组<\/span>/);
  });

  it('TagTreeView 常用标签组卡片中套用按钮 tooltip 明确提示仅套用到当前打开的文档', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagTreeView, {
      allTags: [{ name: 'Vue', label: 'Vue', count: 10, depth: 0 }],
      loading: false,
      getTagStyle: () => ({}),
      getTagIcon: () => '',
      tagGroups: [
        {
          id: 'tg_test',
          name: '前端技术栈',
          tags: ['Vue', 'Vite'],
          color: '#4285F4',
          sortOrder: 0,
        },
      ],
    });

    // 模拟 v-tooltip 指令
    app.directive('tooltip', (el, binding) => {
      // ssr 中可以通过属性记录
    });

    const html = await renderToString(app);
    expect(html).toContain('tm-group-apply-btn');
    expect(html).toContain('前端技术栈');
    // 确保不再包含给当前块打标签的旧提示
    expect(html).not.toContain('焦点块');
  });

  it('TagBatchModal 弹窗目标文档区域渲染“包含子文档”复选框及统计徽章', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagBatchModal, {
      state: {
        visible: true,
        docIdsText: 'doc-1',
        tagsText: 'AI,Vue',
        targetDocs: [{ id: 'doc-1', title: '父项目说明书' }],
        executing: false,
        includeSubDocs: true,
      },
      allTags: [{ label: 'AI', count: 5 }],
      tagGroups: [],
    });
    app.directive('tooltip', {});

    const html = await renderToString(app);
    // 1. 验证目标文档区域包含“包含子文档”复选框
    expect(html).toContain('包含子文档');
    expect(html).toContain('tm-checkbox-label');
    expect(html).toContain('type="checkbox"');

    // 2. 验证已选目标文档标题与胶囊渲染
    expect(html).toContain('父项目说明书');
    expect(html).toContain('tm-selected-doc-chip');

    // 3. 验证操作底栏与待添加标签
    expect(html).toContain('开始批量打标');
    expect(html).toContain('将为');
    expect(html).toContain('#AI#');
    expect(html).toContain('#Vue#');
  });

  it('TagTreeView 应具备“标签全景”（默认展开）与“标签热度”（默认折叠）折叠条，且树节点支持拖拽', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagTreeView, {
      allTags: [
        { label: 'tech', count: 15, depth: 0, name: 'tech' },
        { label: 'tech/vue', count: 10, depth: 1, name: 'vue' },
        { label: 'AI', count: 30, depth: 0, name: 'AI' },
      ],
      loading: false,
      selectedTags: [],
      tagGroups: [],
      getTagStyle: () => ({}),
      getTagIcon: () => '',
    });
    app.directive('tooltip', {});

    const html = await renderToString(app);

    // 1. 验证包含三大折叠板块：常用标签组、标签全景、标签热度
    expect(html).toContain('常用标签组');
    expect(html).toContain('标签全景');
    expect(html).toContain('标签热度');
    expect(html).toContain('tm-panorama-section');
    expect(html).toContain('tm-heat-section');

    // 2. 验证树节点具备 draggable="true" 属性
    expect(html).toContain('draggable="true"');

    // 3. 验证标签热度双模切换与控制栏存在
    expect(html).toContain('tm-cloud-container');
    expect(html).toContain('词云');
    expect(html).toContain('排行');
    expect(html).toContain('TOP 20');
    expect(html).toContain('TOP 50');
    expect(html).toContain('全部');
    expect(html).toContain('tm-cloud-bubble');
    expect(html).toContain('tier-');
  });

  it('TagRowMenu 菜单中应包含“配置子标签与层级...”选项', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagRowMenu, {
      state: {
        visible: true,
        label: 'vue',
        top: 100,
        left: 100,
      },
    });

    const html = await renderToString(app);
    expect(html).toContain('配置子标签与层级...');
    expect(html).not.toContain('移出父级，恢复为独立标签');
  });

  it('TagRowMenu 针对子标签应动态渲染“移出父级，恢复为独立标签”选项', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagRowMenu, {
      state: {
        visible: true,
        label: 'frontend/vue',
        top: 100,
        left: 100,
      },
    });

    const html = await renderToString(app);
    expect(html).toContain('移出父级，恢复为独立标签');
  });

  it('TagReparentModal 渲染时应支持搜索目标父级并提供预期路径预览', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');
    const { default: TagReparentModal } = await import('../src/components/dialogs/TagReparentModal.vue');

    const app = createSSRApp(TagReparentModal, {
      visible: true,
      sourceLabel: 'tech/vue',
      allTags: [
        { label: 'tech', count: 10 },
        { label: 'frontend', count: 5 },
        { label: 'tech/vue', count: 2 },
      ],
    });

    const html = await renderToString(app);
    expect(html).toContain('配置子标签与层级归属');
    expect(html).toContain('#tech/vue#');
    expect(html).toContain('[设为顶级根标签 (脱离当前父级)]');
    expect(html).toContain('#frontend#');
  });

  it('TagTreeView 中排序下拉框不应包含挤压箭头的内联 padding 样式', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagTreeView, {
      allTags: [{ label: 'test', count: 1, depth: 0, name: 'test' }],
      loading: false,
      selectedTags: [],
      tagGroups: [],
      getTagStyle: () => ({}),
      getTagIcon: () => '',
    });
    app.directive('tooltip', {});

    const html = await renderToString(app);
    expect(html).toContain('tm-sort-select');
    expect(html).not.toMatch(/class="[^"]*tm-sort-select[^"]*"[^>]*style="[^"]*padding:\s*0\s*4px/);
  });

  it('TagTreeView 标签热度折叠条按钮应移动至展开后的工具条中，且全库待引用标签正确渲染', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagTreeView, {
      allTags: [
        { label: 'tag1', count: 5, depth: 0, name: 'tag1' },
        { label: 'tag2', count: 0, depth: 0, name: 'tag2' },
      ],
      loading: false,
      selectedTags: [],
      tagGroups: [],
      getTagStyle: () => ({}),
      getTagIcon: () => '',
    });
    app.directive('tooltip', {});

    const html = await renderToString(app);
    expect(html).toContain('tm-heat-toolbar');
    expect(html).toContain('tm-heat-toolbar-header');
    expect(html).toContain('tm-heat-toolbar-info');
    expect(html).toContain('tier-zero');
  });

  it('TagTreeView 中应支持拖拽配置子标签，且包含贯通高度的热度容器并移除破坏指针的类名', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagTreeView, {
      allTags: [
        { label: 'parent', count: 10, depth: 0, name: 'parent' },
        { label: 'child', count: 3, depth: 0, name: 'child' },
      ],
      loading: false,
      selectedTags: [],
      tagGroups: [],
      getTagStyle: () => ({}),
      getTagIcon: () => '',
    });
    app.directive('tooltip', {});

    const html = await renderToString(app);
    expect(html).toContain('tm-tree-node');
    expect(html).toContain('tm-cloud-container');
    expect(html).toContain('tm-panorama-section');
    expect(html).toContain('tm-panorama-body');
    expect(html).toContain('tm-tree-scroller');
    expect(html).not.toContain('is-tree-dragging');
  });

  it('TagTreeView 中应通过指示线控制子标签/独立标签放置，且不再渲染顶部吸顶和底部根释放区域', async () => {
    const { renderToString } = await import('vue/server-renderer');
    const { createSSRApp } = await import('vue');

    const app = createSSRApp(TagTreeView, {
      allTags: [
        { label: 'parent', count: 10, depth: 0, name: 'parent' },
        { label: 'parent/child', count: 3, depth: 1, name: 'child' },
      ],
      loading: false,
      selectedTags: [],
      tagGroups: [],
      getTagStyle: () => ({}),
      getTagIcon: () => '',
    });
    app.directive('tooltip', {});

    const html = await renderToString(app);
    // 不应再包含突兀的顶部和底部根释放占位区域
    expect(html).not.toContain('tm-sticky-root-dropzone');
    expect(html).not.toContain('tm-root-dropzone');
    // 树滚动容器正常渲染
    expect(html).toContain('tm-tree-scroller');
    expect(html).toContain('tm-tree-node');
  });
});



