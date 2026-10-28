import { describe, expect, it } from "vitest";
import { BoundedTaskQueue } from "./bounded-work";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
};
describe("bounded shared resource admission", () => {
  it("bounds active and queued work, then releases capacity after actual completion", async () => {
    const queue = new BoundedTaskQueue(2, 2),
      gate = deferred();
    let active = 0,
      maximum = 0,
      started = 0;
    const work = () =>
      queue.run(async () => {
        started++;
        maximum = Math.max(maximum, ++active);
        await gate.promise;
        active--;
        return started;
      }, 500);
    const accepted = [work(), work(), work(), work()];
    await expect(work()).rejects.toMatchObject({ statusCode: 503 });
    expect(started).toBe(2);
    gate.resolve();
    await Promise.all(accepted);
    expect(maximum).toBe(2);
    expect(started).toBe(4);
    await expect(queue.run(async () => "recovered", 500)).resolves.toBe(
      "recovered"
    );
  });

  it("expires queued jobs and retains timed-out active slots until work really stops", async () => {
    const queue = new BoundedTaskQueue(1, 1),
      gate = deferred();
    let queuedStarted = false,
      aborted = false;
    const running = queue.run(async signal => {
      signal.addEventListener("abort", () => {
        aborted = true;
      });
      await gate.promise;
    }, 30);
    const queued = queue.run(async () => {
      queuedStarted = true;
    }, 30);
    await Promise.all([
      expect(running).rejects.toMatchObject({ statusCode: 504 }),
      expect(queued).rejects.toMatchObject({ statusCode: 504 }),
    ]);
    expect(aborted).toBe(true);
    expect(queuedStarted).toBe(false);
    const stillWaiting = queue.run(async () => "after-stop", 500);
    await expect(queue.run(async () => undefined, 500)).rejects.toMatchObject({
      statusCode: 503,
    });
    gate.resolve();
    await expect(stillWaiting).resolves.toBe("after-stop");
  });
});
