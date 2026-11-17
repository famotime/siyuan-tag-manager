import { describe, it, expect } from 'vitest';
import { TagCompanionOverlay } from '../src/services/TagCompanionOverlay';
import { TagCompanionService } from '../src/services/TagCompanionService';

/**
 * 伴生推荐浮条视图状态机与全局服务生命周期对称性测试
 * （视图挂载/定位/chip 注入自 TagCompanionService 拆分至 TagCompanionOverlay）
 */
const CANDIDATES = [
  { label: '前端工程化', weight: 8, jaccard: 0.72, percentage: 72 },
  { label: 'TypeScript', weight: 7, jaccard: 0.63, percentage: 63 },
];

describe('TagCompanionOverlay 浮条视图状态机', () => {
  it('present 展示候选并复位指针与已采纳列表，定位紧随光标下方', () => {
    const rect = { left: 100, top: 100, bottom: 120, right: 150 } as DOMRect;
    TagCompanionOverlay.present(CANDIDATES, rect);

    const s = TagCompanionOverlay.getState();
    expect(s.visible).toBe(true);
    expect(s.candidates).toHaveLength(2);
    expect(s.activeIndex).toBe(0);
    expect(s.acceptedLabels).toEqual([]);
    expect(s.position).toEqual({ top: 126, left: 100 }); // rect.bottom + 6

    TagCompanionOverlay.hide();
  });

  it('markAccepted 去重记录已采纳标签，advance 推进聚焦指针', () => {
    TagCompanionOverlay.present(CANDIDATES, { left: 0, top: 0, bottom: 20, right: 10 } as DOMRect);

    TagCompanionOverlay.markAccepted('前端工程化');
    TagCompanionOverlay.markAccepted('前端工程化');
    TagCompanionOverlay.advance(0);
    TagCompanionOverlay.advance(1);

    const s = TagCompanionOverlay.getState();
    expect(s.acceptedLabels).toEqual(['前端工程化']);
    expect(s.activeIndex).toBe(2);

    TagCompanionOverlay.hide();
  });

  it('hide 清空候选、指针与可见状态', () => {
    TagCompanionOverlay.present(CANDIDATES, { left: 0, top: 0, bottom: 20, right: 10 } as DOMRect);
    TagCompanionOverlay.advance(0);
    TagCompanionOverlay.markAccepted('a');

    TagCompanionOverlay.hide();

    const s = TagCompanionOverlay.getState();
    expect(s.visible).toBe(false);
    expect(s.candidates).toEqual([]);
    expect(s.activeIndex).toBe(0);
  });

  it('未挂载容器时 isMounted 与 contains 均为 false（node 测试环境）', () => {
    expect(TagCompanionOverlay.isMounted()).toBe(false);
    expect(TagCompanionOverlay.contains({} as Node)).toBe(false);
  });
});

describe('TagCompanionService 全局服务生命周期对称性', () => {
  it('init → destroy 后无残留：无挂载容器、气泡隐藏、重复 destroy 安全', () => {
    const dispose = TagCompanionService.init({ enabled: true, maxCount: 3 });

    // 展示后销毁，验证清理对称
    TagCompanionService.show(CANDIDATES, { left: 0, top: 0, bottom: 20, right: 10 } as DOMRect, 'block-1');
    expect(TagCompanionService.getState().visible).toBe(true);

    dispose();
    TagCompanionService.destroy(); // 双重销毁必须安全

    expect(TagCompanionService.getState().visible).toBe(false);
    expect(TagCompanionService.getState().candidates).toEqual([]);
    expect(TagCompanionOverlay.isMounted()).toBe(false);
  });

  it('resolveTarget 对空目标返回 null', () => {
    expect(TagCompanionService.resolveTarget(null as any)).toBeNull();
    expect(TagCompanionService.resolveTarget(undefined as any)).toBeNull();
  });
});
