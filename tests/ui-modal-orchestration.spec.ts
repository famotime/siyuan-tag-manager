import { describe, it, expect, vi, afterEach } from 'vitest';
import { ref } from 'vue';
import { useModalOrchestration } from '../src/composables/useModalOrchestration';

/**
 * 弹窗编排与全局 Escape 关闭链测试
 * 关闭优先级与原 App.vue 实现严格一致：
 * rowMenu → styleModal → saveViewModal → batchModal → mergeModal → companion → settings → fallback
 */
function makeKey(key: string): KeyboardEvent {
  return { key } as KeyboardEvent;
}

afterEach(() => {
  delete (globalThis as any).window;
});

describe('useModalOrchestration 弹窗编排', () => {
  it('Escape 按优先级关闭顶层弹窗，一次只关一个', () => {
    const onEscapeFallback = vi.fn();
    const m = useModalOrchestration({ onEscapeFallback });

    // 同时打开多个弹窗，验证最顶层（最先注册）先关
    m.rowMenu.value.visible = true;
    m.styleModal.value.visible = true;
    m.batchModal.value.visible = true;

    m.handleGlobalKeydown(makeKey('Escape'));
    expect(m.rowMenu.value.visible).toBe(false);
    expect(m.styleModal.value.visible).toBe(true);
    expect(m.batchModal.value.visible).toBe(true);
    expect(onEscapeFallback).not.toHaveBeenCalled();

    m.handleGlobalKeydown(makeKey('Escape'));
    expect(m.styleModal.value.visible).toBe(false);
    expect(m.batchModal.value.visible).toBe(true);

    m.handleGlobalKeydown(makeKey('Escape'));
    expect(m.batchModal.value.visible).toBe(false);
    expect(onEscapeFallback).not.toHaveBeenCalled();
  });

  it('Escape 覆盖布尔弹窗（伴生/设置）并回退关闭面板', () => {
    const onEscapeFallback = vi.fn();
    const m = useModalOrchestration({ onEscapeFallback });

    m.companionModalVisible.value = true;
    m.handleGlobalKeydown(makeKey('Escape'));
    expect(m.companionModalVisible.value).toBe(false);
    expect(onEscapeFallback).not.toHaveBeenCalled();

    m.settingsModalVisible.value = true;
    m.handleGlobalKeydown(makeKey('Escape'));
    expect(m.settingsModalVisible.value).toBe(false);

    // 全部关闭后回退到关闭面板
    m.handleGlobalKeydown(makeKey('Escape'));
    expect(onEscapeFallback).toHaveBeenCalledTimes(1);
  });

  it('非 Escape 按键不触发任何关闭', () => {
    const onEscapeFallback = vi.fn();
    const m = useModalOrchestration({ onEscapeFallback });
    m.styleModal.value.visible = true;

    m.handleGlobalKeydown(makeKey('Enter'));
    m.handleGlobalKeydown(makeKey('Tab'));
    expect(m.styleModal.value.visible).toBe(true);
    expect(onEscapeFallback).not.toHaveBeenCalled();
  });

  it('openRowMenu 定位并打开行菜单，closeRowMenu 关闭', () => {
    (globalThis as any).window = { innerHeight: 800 };
    const m = useModalOrchestration({ onEscapeFallback: vi.fn() });

    const target = {
      getBoundingClientRect: () => ({ left: 100, top: 50, bottom: 70, right: 200, width: 100, height: 20 }),
    } as HTMLElement;

    m.openRowMenu('vue', { currentTarget: target } as unknown as MouseEvent);
    expect(m.rowMenu.value.visible).toBe(true);
    expect(m.rowMenu.value.label).toBe('vue');
    // menuWidth=180: left = 100 - 180 + 24 = -56 -> clamp 至 10
    expect(m.rowMenu.value.left).toBe(10);
    // top = 70 + 4 = 74；74 + 130 < 800 不翻转
    expect(m.rowMenu.value.top).toBe(74);

    m.closeRowMenu();
    expect(m.rowMenu.value.visible).toBe(false);
  });

  it('openRowMenu 靠近视窗底部时向上翻转', () => {
    (globalThis as any).window = { innerHeight: 200 };
    const m = useModalOrchestration({ onEscapeFallback: vi.fn() });

    const target = {
      getBoundingClientRect: () => ({ left: 100, top: 50, bottom: 70, right: 200, width: 100, height: 20 }),
    } as HTMLElement;

    m.openRowMenu('react', { currentTarget: target } as unknown as MouseEvent);
    // 74 + 130 > 200 -> top = rect.top - menuHeight = 50 - 130 = -80
    expect(m.rowMenu.value.top).toBe(-80);
  });

  it('初始状态全部关闭', () => {
    const m = useModalOrchestration({ onEscapeFallback: vi.fn() });
    expect(m.rowMenu.value.visible).toBe(false);
    expect(m.styleModal.value.visible).toBe(false);
    expect(m.saveViewModal.value.visible).toBe(false);
    expect(m.batchModal.value.visible).toBe(false);
    expect(m.mergeModal.value.visible).toBe(false);
    expect(m.renameModal.value.visible).toBe(false);
    expect(m.groupModal.value.visible).toBe(false);
    expect(m.reparentModal.value.visible).toBe(false);
    expect(m.companionModalVisible.value).toBe(false);
    expect(m.settingsModalVisible.value).toBe(false);
  });

  it('registerEscapeCloser 动态项先于固定链与回退生效，并可注销', () => {
    const onEscapeFallback = vi.fn();
    const m = useModalOrchestration({ onEscapeFallback });
    const treeDialogVisible = ref(false);

    const unregister = m.registerEscapeCloser({
      isVisible: () => treeDialogVisible.value,
      close: () => { treeDialogVisible.value = false; },
    });
    treeDialogVisible.value = true;
    m.styleModal.value.visible = true; // 固定链中位于动态项之后

    m.handleGlobalKeydown(makeKey('Escape'));
    expect(treeDialogVisible.value).toBe(false);
    expect(m.styleModal.value.visible).toBe(true); // 动态项拦截，固定链未继续
    expect(onEscapeFallback).not.toHaveBeenCalled();

    m.styleModal.value.visible = true;
    unregister();
    m.handleGlobalKeydown(makeKey('Escape'));
    expect(m.styleModal.value.visible).toBe(false); // 注销后动态项不再拦截
  });

  it('canClose 守卫为 false 时吞掉 Esc：不关闭该弹窗也不回退', () => {
    const onEscapeFallback = vi.fn();
    const m = useModalOrchestration({ onEscapeFallback });
    const dialog = ref({ visible: false, executing: false });

    m.registerEscapeCloser({
      isVisible: () => dialog.value.visible,
      canClose: () => !dialog.value.executing,
      close: () => { dialog.value.visible = false; },
    });

    dialog.value = { visible: true, executing: true };
    m.handleGlobalKeydown(makeKey('Escape'));
    expect(dialog.value.visible).toBe(true);
    expect(onEscapeFallback).not.toHaveBeenCalled();

    dialog.value = { visible: true, executing: false };
    m.handleGlobalKeydown(makeKey('Escape'));
    expect(dialog.value.visible).toBe(false);
  });

  it('执行中的 batch/merge/rename 弹窗受 canClose 保护，完成后可被 Esc 关闭', () => {
    const onEscapeFallback = vi.fn();
    const m = useModalOrchestration({ onEscapeFallback });

    m.batchModal.value.visible = true;
    m.batchModal.value.executing = true;
    m.handleGlobalKeydown(makeKey('Escape'));
    expect(m.batchModal.value.visible).toBe(true);
    expect(onEscapeFallback).not.toHaveBeenCalled();

    m.batchModal.value.executing = false;
    m.handleGlobalKeydown(makeKey('Escape'));
    expect(m.batchModal.value.visible).toBe(false);

    m.mergeModal.value.visible = true;
    m.mergeModal.value.executing = true;
    m.handleGlobalKeydown(makeKey('Escape'));
    expect(m.mergeModal.value.visible).toBe(true);
    m.mergeModal.value.executing = false;
    m.handleGlobalKeydown(makeKey('Escape'));
    expect(m.mergeModal.value.visible).toBe(false);

    m.renameModal.value.visible = true;
    m.renameModal.value.executing = true;
    m.handleGlobalKeydown(makeKey('Escape'));
    expect(m.renameModal.value.visible).toBe(true);
    m.renameModal.value.executing = false;
    m.handleGlobalKeydown(makeKey('Escape'));
    expect(m.renameModal.value.visible).toBe(false);
  });

  it('closeConfirmDialog 关闭时置空 onConfirm 回调（取消语义无残留）', () => {
    const m = useModalOrchestration({ onEscapeFallback: vi.fn() });
    m.openConfirmDialog({ title: 't', message: 'm', onConfirm: vi.fn() });
    expect(m.confirmDialog.value.visible).toBe(true);
    expect(m.confirmDialog.value.onConfirm).not.toBeNull();

    m.closeConfirmDialog();
    expect(m.confirmDialog.value.visible).toBe(false);
    expect(m.confirmDialog.value.onConfirm).toBeNull();
  });
});
