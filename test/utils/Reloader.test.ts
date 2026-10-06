import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Reloader, type ReloaderSubprocess } from "../../src/utils/Reloader.js";

/** A fake server process, controllable from tests without spawning a real process. */
class FakeServer extends EventEmitter implements ReloaderSubprocess {
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  #exited = false;

  kill(signal: NodeJS.Signals | number = "SIGTERM"): boolean {
    if (this.#exited) return false;

    this.signalCode = typeof signal === "number" ? null : signal;
    queueMicrotask(() => this.exit(null, typeof signal === "string" ? signal : "SIGTERM"));

    return true;
  }

  exit(code: number | null = 0, signal: NodeJS.Signals | null = null): void {
    if (this.#exited) return;
    this.#exited = true;
    this.exitCode = code;
    this.signalCode = signal;
    this.emit("exit", code, signal);
  }
}

describe("Reloader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("start spawns a server and reports it ready once it signals ready", () => {
    const servers: FakeServer[] = [];
    const spawn = () => {
      const server = new FakeServer();
      servers.push(server);
      return server;
    };
    const onReady = vi.fn();

    const reloader = new Reloader({ spawn, onReady });
    const server = reloader.start();

    expect(servers).toEqual([server]);
    expect(onReady).not.toHaveBeenCalled();

    servers[0]!.emit("message", "ready");

    expect(onReady).toHaveBeenCalledExactlyOnceWith(expect.any(Number));
  });

  test('does not report ready for messages other than "ready"', () => {
    const spawn = () => new FakeServer();
    const onReady = vi.fn();

    const reloader = new Reloader({ spawn, onReady });
    const server = reloader.start() as FakeServer;
    server.emit("message", "not-ready");

    expect(onReady).not.toHaveBeenCalled();
  });

  test("coalesces rapid successive changes into a single debounced reload", async () => {
    const servers: FakeServer[] = [];
    const spawn = () => {
      const server = new FakeServer();
      servers.push(server);
      return server;
    };

    const reloader = new Reloader({ spawn, onReady: vi.fn(), debounceMs: 500 });
    reloader.start();
    expect(servers).toHaveLength(1);

    reloader.reload();
    await vi.advanceTimersByTimeAsync(200);
    reloader.reload();
    await vi.advanceTimersByTimeAsync(200);
    expect(servers).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(500);
    expect(servers).toHaveLength(2);
  });

  test("kills the current server and swaps in the new one once it reports ready", async () => {
    const servers: FakeServer[] = [];
    const spawn = () => {
      const server = new FakeServer();
      servers.push(server);
      return server;
    };
    const onReady = vi.fn();

    const reloader = new Reloader({ spawn, onReady, debounceMs: 100 });
    const initial = reloader.start() as FakeServer;

    reloader.reload();
    await vi.advanceTimersByTimeAsync(100);

    expect(initial.signalCode).toBe("SIGTERM");
    expect(servers).toHaveLength(2);

    const replacement = servers[1]!;
    expect(onReady).not.toHaveBeenCalled();

    replacement.emit("message", "ready");

    expect(onReady).toHaveBeenCalledExactlyOnceWith(expect.any(Number));
  });

  test("kills a superseded, not-yet-ready replacement when another reload completes first", async () => {
    const servers: FakeServer[] = [];
    const spawn = () => {
      const server = new FakeServer();
      servers.push(server);
      return server;
    };

    const reloader = new Reloader({ spawn, onReady: vi.fn(), debounceMs: 100 });
    reloader.start();

    reloader.reload();
    await vi.advanceTimersByTimeAsync(100);
    expect(servers).toHaveLength(2);
    const firstReplacement = servers[1]!;

    reloader.reload();
    await vi.advanceTimersByTimeAsync(100);
    expect(servers).toHaveLength(3);

    expect(firstReplacement.signalCode).toBe("SIGTERM");
  });

  test("does not reload once the signal has been aborted", async () => {
    const servers: FakeServer[] = [];
    const spawn = () => {
      const server = new FakeServer();
      servers.push(server);
      return server;
    };
    const controller = new AbortController();

    const reloader = new Reloader({
      spawn,
      onReady: vi.fn(),
      signal: controller.signal,
      debounceMs: 100,
    });
    reloader.start();
    controller.abort();

    reloader.reload();
    await vi.advanceTimersByTimeAsync(100);

    expect(servers).toHaveLength(1);
  });
});
