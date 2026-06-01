import type { Response } from "express";

export interface ProgressEvent {
  step: number;
  pct: number;
  label: string;
}

/**
 * In-process pub/sub bus that bridges fire-and-forget generation jobs to SSE
 * subscribers. Stores the last emitted event per scanId so late subscribers
 * (clients that connect after generation has already started) immediately
 * receive the current progress.
 */
class ProgressBus {
  private subscribers = new Map<number, Set<Response>>();
  private lastEvent = new Map<number, ProgressEvent>();

  subscribe(scanId: number, res: Response): () => void {
    const last = this.lastEvent.get(scanId);
    if (last) {
      try { res.write(`data: ${JSON.stringify(last)}\n\n`); } catch { }
    }

    if (!this.subscribers.has(scanId)) {
      this.subscribers.set(scanId, new Set());
    }
    const set = this.subscribers.get(scanId)!;
    set.add(res);

    return () => {
      set.delete(res);
      if (set.size === 0) this.subscribers.delete(scanId);
    };
  }

  emit(scanId: number, event: ProgressEvent): void {
    this.lastEvent.set(scanId, event);
    const set = this.subscribers.get(scanId);
    if (!set || set.size === 0) return;
    const data = JSON.stringify(event);
    for (const res of set) {
      try { res.write(`data: ${data}\n\n`); } catch { }
    }
  }

  complete(scanId: number): void {
    this.lastEvent.delete(scanId);
    const set = this.subscribers.get(scanId);
    if (!set) return;
    for (const res of set) {
      try { res.write(`event: done\ndata: {}\n\n`); res.end(); } catch { }
    }
    this.subscribers.delete(scanId);
  }

  error(scanId: number): void {
    this.lastEvent.delete(scanId);
    const set = this.subscribers.get(scanId);
    if (!set) return;
    for (const res of set) {
      try { res.write(`event: generror\ndata: {}\n\n`); res.end(); } catch { }
    }
    this.subscribers.delete(scanId);
  }
}

export const progressBus = new ProgressBus();
