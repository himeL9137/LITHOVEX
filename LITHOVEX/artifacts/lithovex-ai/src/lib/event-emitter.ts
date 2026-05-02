// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Tiny browser-safe typed EventEmitter
// Avoids pulling in node's `events` module. Strongly-typed via a record map.
// ─────────────────────────────────────────────────────────────────────────────

export type EventMap = Record<string, unknown>;
type Listener<T> = (payload: T) => void;

export class TypedEventEmitter<E extends EventMap> {
  private listeners = new Map<keyof E, Set<Listener<unknown>>>();

  on<K extends keyof E>(event: K, listener: Listener<E[K]>): () => void {
    let bucket = this.listeners.get(event);
    if (!bucket) {
      bucket = new Set();
      this.listeners.set(event, bucket);
    }
    bucket.add(listener as Listener<unknown>);
    return () => this.off(event, listener);
  }

  off<K extends keyof E>(event: K, listener: Listener<E[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<unknown>);
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const bucket = this.listeners.get(event);
    if (!bucket) return;
    for (const fn of bucket) {
      try {
        (fn as Listener<E[K]>)(payload);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[TypedEventEmitter] listener for "${String(event)}" threw`, err);
      }
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
