/** Admission and elapsed-time bounds shared by every entry point of a resource.
 * A timed-out operation keeps its slot until it really settles: returning a
 * deadline error must not create an unlimited number of abandoned workers. */
export class ResourceLimitError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 413 | 503 | 504
  ) {
    super(message);
    this.name = "ResourceLimitError";
  }
}

type Pending = { start: () => void; expired: boolean };
export class BoundedTaskQueue {
  private active = 0;
  private pending: Pending[] = [];
  constructor(
    private readonly maximumActive: number,
    private readonly maximumQueued: number
  ) {
    if (
      !Number.isSafeInteger(maximumActive) ||
      maximumActive < 1 ||
      !Number.isSafeInteger(maximumQueued) ||
      maximumQueued < 0
    )
      throw new Error("Invalid resource limits");
  }

  run<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    if (
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > 120_000
    )
      return Promise.reject(new Error("Invalid operation deadline"));
    if (
      this.active >= this.maximumActive &&
      this.pending.length >= this.maximumQueued
    )
      return Promise.reject(
        new ResourceLimitError("Service is busy; try again shortly", 503)
      );
    return new Promise<T>((resolve, reject) => {
      const controller = new AbortController();
      let settled = false;
      const item: Pending = {
        expired: false,
        start: () => {
          if (item.expired) return;
          this.active++;
          void Promise.resolve()
            .then(() => operation(controller.signal))
            .then(
              value => {
                if (!settled) {
                  settled = true;
                  resolve(value);
                }
              },
              error => {
                if (!settled) {
                  settled = true;
                  reject(error);
                }
              }
            )
            .finally(() => {
              clearTimeout(timer);
              this.active--;
              this.drain();
            });
        },
      };
      const timer = setTimeout(() => {
        item.expired = true;
        this.pending = this.pending.filter(value => value !== item);
        if (!settled) {
          settled = true;
          reject(new ResourceLimitError("Operation timed out", 504));
        }
        controller.abort();
      }, timeoutMs);
      if (this.active < this.maximumActive) item.start();
      else this.pending.push(item);
    });
  }

  private drain() {
    while (this.active < this.maximumActive && this.pending.length)
      this.pending.shift()!.start();
  }
}

export function requireActive(signal: AbortSignal) {
  if (signal.aborted) throw new ResourceLimitError("Operation timed out", 504);
}
