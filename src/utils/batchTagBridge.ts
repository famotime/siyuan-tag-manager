/**
 * 跨模块事件桥接：原生文档树右键触发批量打标
 */
export interface IBatchBridgeDoc {
  id: string;
  title: string;
}

type BatchDocListener = (docs: IBatchBridgeDoc[]) => void;

class BatchTagBridge {
  private listeners: BatchDocListener[] = [];

  public hasListeners(): boolean {
    return this.listeners.length > 0;
  }

  public trigger(docs: IBatchBridgeDoc[]): boolean {
    if (this.listeners.length === 0) {
      return false;
    }
    for (const listener of this.listeners) {
      try {
        listener(docs);
      } catch (err) {
        console.error('[siyuan-tag-manager] batchTagBridge listener error:', err);
      }
    }
    return true;
  }

  public on(fn: BatchDocListener): () => void {
    this.listeners.push(fn);
    return () => {
      const idx = this.listeners.indexOf(fn);
      if (idx !== -1) {
        this.listeners.splice(idx, 1);
      }
    };
  }

  public clear(): void {
    this.listeners = [];
  }
}

export const batchTagBridge = new BatchTagBridge();
