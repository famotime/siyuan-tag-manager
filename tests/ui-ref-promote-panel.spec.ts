import { describe, it, expect, vi, afterEach } from 'vitest';
import TagRefPromotePanel from '../src/components/tabs/TagRefPromotePanel.vue';
import TagHygieneView from '../src/components/tabs/TagHygieneView.vue';
import { TagRefPromoteService } from '../src/services/TagRefPromoteService';
import type { IRefToTagCandidate } from '../src/services/TagRefPromoteService';
import { createTestApp, renderComponent } from './helpers/ssr';

/**
 * TagRefPromotePanel 引用诊断子组件测试（自 TagHygieneView 拆分）
 * 覆盖：SSR 渲染契约、守则合规（无箭头字符）、promote 单个/批量/空选统一分支
 *
 * setup 直调需在父组件实例上下文中执行（与 ui-components.spec 既有模式一致）
 */
const FIXTURE_CANDIDATES: IRefToTagCandidate[] = [
  {
    docId: 'doc-1',
    docTitle: '文档A',
    selected: true,
    matchedTags: [{ tag: 'Vue', reason: 'target_name', refContent: 'Vue' }],
  },
  {
    docId: 'doc-2',
    docTitle: '文档B',
    selected: false,
    matchedTags: [{ tag: 'React', reason: 'target_alias', refContent: 'Rct' }],
  },
];

async function setupPanel(emitSpy?: (event: string, payload: any) => void) {
  const { _createSSRApp, h } = await import('vue');
  const { renderToString } = await import('vue/server-renderer');

  let ctx: any;
  const app = createTestApp({
    setup() {
      ctx = (TagRefPromotePanel as any).setup(
        { allTags: [] },
        {
          emit: emitSpy || (() => {}),
          expose: () => {},
        },
      );
      return () => h('div');
    },
  });
  await renderToString(app);
  return ctx as any;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TagRefPromotePanel 引用诊断子组件', () => {
  it('SSR 渲染包含标题、工具按钮与简介，且不含箭头字符（守则合规）', async () => {
    const html = await renderComponent(TagRefPromotePanel, { allTags: [] });

    expect(html).toContain('引用识别为标签诊断器');
    expect(html).toContain('全库扫描引用');
    expect(html).toContain('检测当前文档');
    expect(html).toContain('tm-ref-promote-intro');
    expect(html).not.toContain('➔');
  });

  it('作为 TagHygieneView 子组件渲染（父级集成）', async () => {
    const html = await renderComponent(TagHygieneView, {
      healthResult: {
        issues: [],
        summary: { totalTags: 0, caseConflicts: 0, lowFrequency: 0, orphans: 0, healthyRate: 100 },
      },
      allTags: [],
    });

    expect(html).toContain('引用识别为标签诊断器');
    expect(html).toContain('自动识别正文中包含的同名双向引用');
  });

  it('promoteSelectedCandidates 空选时直接返回，不调用服务', async () => {
    const promoteSpy = vi.spyOn(TagRefPromoteService, 'promoteCandidates').mockResolvedValue({
      success: true,
      updatedCount: 0,
      errors: [],
    });
    const emitSpy = vi.fn();
    const ctx = await setupPanel(emitSpy);

    ctx.candidates.value = FIXTURE_CANDIDATES.map(c => ({ ...c, selected: false }));
    await ctx.promoteSelectedCandidates();

    expect(promoteSpy).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('单个采纳与批量采纳共用统一分支：调用服务、移除已处理项并触发刷新', async () => {
    const promoteSpy = vi.spyOn(TagRefPromoteService, 'promoteCandidates').mockResolvedValue({
      success: true,
      updatedCount: 1,
      errors: [],
    });
    const emitSpy = vi.fn();
    const ctx = await setupPanel(emitSpy);

    ctx.candidates.value = FIXTURE_CANDIDATES.map(c => ({ ...c }));

    // 单个采纳（promoteSingleCandidate 走同一分支）
    await ctx.promoteSingleCandidate(ctx.candidates.value[0]);
    expect(promoteSpy).toHaveBeenCalledTimes(1);
    expect(promoteSpy).toHaveBeenCalledWith([{ docId: 'doc-1', tags: ['Vue'] }]);
    expect(ctx.candidates.value).toHaveLength(1);
    expect(emitSpy).toHaveBeenCalledWith('refresh-tags');

    // 批量采纳剩余选中项
    ctx.candidates.value[0].selected = true;
    await ctx.promoteSelectedCandidates();
    expect(promoteSpy).toHaveBeenCalledTimes(2);
    expect(promoteSpy).toHaveBeenLastCalledWith([{ docId: 'doc-2', tags: ['React'] }]);
    expect(ctx.candidates.value).toHaveLength(0);
    expect(emitSpy).toHaveBeenCalledTimes(2);
  });

  it('批量采纳失败时保留候选项且不触发刷新', async () => {
    vi.spyOn(TagRefPromoteService, 'promoteCandidates').mockResolvedValue({
      success: false,
      updatedCount: 0,
      errors: ['更新文档 doc-1 失败: boom'],
    });
    const emitSpy = vi.fn();
    const ctx = await setupPanel(emitSpy);

    ctx.candidates.value = FIXTURE_CANDIDATES.map(c => ({ ...c }));
    await ctx.promoteSelectedCandidates();

    expect(ctx.candidates.value).toHaveLength(2);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('toggleSelectAll 全选与取消全选', async () => {
    const ctx = await setupPanel();
    ctx.candidates.value = FIXTURE_CANDIDATES.map(c => ({ ...c, selected: false }));

    ctx.toggleSelectAll({ target: { checked: true } } as unknown as Event);
    expect(ctx.isAllSelected.value).toBe(true);

    ctx.toggleSelectAll({ target: { checked: false } } as unknown as Event);
    expect(ctx.isAllSelected.value).toBe(false);
  });
});
