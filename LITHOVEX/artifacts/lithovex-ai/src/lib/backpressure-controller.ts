// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Backpressure Controller
// Prompt 3 / Layer 4: Buffers incoming chunks and flushes them in batches
// aligned to the browser's animation frame, ensuring smooth ~60fps rendering
// even when a model emits hundreds of tokens per second.
// ─────────────────────────────────────────────────────────────────────────────

import type { StreamChunk } from "@/types/streaming";

export class BackpressureController {
  private buffer: StreamChunk[] = [];
  private isProcessing = false;
  private rafId: number | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly throttleMs: number,
    private readonly onUpdate: (chunks: StreamChunk[]) => void
  ) {}

  push(chunk: StreamChunk): void {
    this.buffer.push(chunk);
    if (!this.isProcessing) this.start();
  }

  private start(): void {
    this.isProcessing = true;
    // Initial delay lets a small burst accumulate so we coalesce updates.
    this.timerId = setTimeout(() => this.flushTick(), this.throttleMs);
  }

  private flushTick = (): void => {
    if (this.buffer.length === 0) {
      this.isProcessing = false;
      return;
    }
    const batch = this.buffer;
    this.buffer = [];
    try {
      this.onUpdate(batch);
    } finally {
      // Continue flushing on the next animation frame for 60fps cadence.
      this.rafId = requestAnimationFrame(this.flushTick);
    }
  };

  /** Force-flush whatever is buffered right now (used on stream completion). */
  flush(): void {
    if (this.buffer.length > 0) {
      const batch = this.buffer;
      this.buffer = [];
      this.onUpdate(batch);
    }
    this.cancelTimers();
    this.isProcessing = false;
  }

  /** Drop all buffered chunks without flushing (used on cancel/error). */
  clear(): void {
    this.buffer = [];
    this.cancelTimers();
    this.isProcessing = false;
  }

  private cancelTimers(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.timerId != null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}
