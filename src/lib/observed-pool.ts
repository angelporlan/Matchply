import { performance } from 'node:perf_hooks';
import { Pool, type PoolClient, type PoolConfig } from 'pg';

type ConnectCallback = (error: Error | undefined, client: PoolClient | undefined, release: (error?: Error | boolean) => void) => void;

/** Measure connection acquisition, including queue wait, without changing pg's two connect APIs. */
export class ObservedPool extends Pool {
  private acquired = 0;
  private totalAcquireMs = 0;
  private maxAcquireMs = 0;
  constructor(config: PoolConfig, private readonly observe: (durationMs: number) => void = () => {}) { super(config); }
  private record(start: number) {
    const duration = performance.now() - start;
    this.acquired++; this.totalAcquireMs += duration; this.maxAcquireMs = Math.max(this.maxAcquireMs, duration);
    try { this.observe(duration); } catch { /* Telemetry must not prevent connection delivery/release. */ }
  }
  connect(): Promise<PoolClient>;
  connect(callback: ConnectCallback): void;
  connect(callback?: ConnectCallback): Promise<PoolClient> | void {
    const started = performance.now();
    if (callback) return super.connect((error, client, release) => { this.record(started); callback(error, client, release); });
    return super.connect().then(client => { this.record(started); return client; }, error => { this.record(started); throw error; });
  }
  acquisitionStats() { return { count: this.acquired, totalMs: this.totalAcquireMs, maxMs: this.maxAcquireMs }; }
}
