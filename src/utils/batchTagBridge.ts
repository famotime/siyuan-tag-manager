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

  public trigger(docs: IBatchBridgeDoc[]): void {
    for (const listener of this.listeners) {
      try {
        listener(docs);
      } catch (err) {
        console.error('[siyuan-tag-manager] batchTagBridge listener error:', err);
      }
    }
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
}

export const batchTagBridge = new BatchTagBridge();
