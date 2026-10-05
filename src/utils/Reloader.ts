import pDebounce from "p-debounce";

/**
 * A subprocess that the reloader will spawn.
 */
export type ReloaderSubprocess = {
  on(event: string, listener: (...args: any[]) => void): unknown;
  kill(signal?: NodeJS.Signals | number): boolean;
  readonly exitCode: number | null;
  readonly signalCode: NodeJS.Signals | null;
};

/** Options for constructing a {@link Reloader} */
export type ReloaderOptions = {
  /** Starts a new instance of the server process. */
  spawn: () => ReloaderSubprocess;

  /** Called once a (re)started server process reports itself ready, by sending a "ready" message. */
  onReady: (startTime: number) => void;

  /** Aborted to permanently stop reloading; any in-flight reload becomes a no-op. */
  signal?: AbortSignal;

  /** How long to wait for more changes before reloading, coalescing rapid successive requests. */
  debounceMs?: number;
};

/**
 * Coordinates (re)starting a server process, debouncing rapid successive reload requests into one.
 *
 * Encapsulates the kill/spawn/swap dance independent of how the process is spawned or how changes
 * are detected.
 */
export class Reloader {
  readonly #spawn: ReloaderOptions["spawn"];
  readonly #onReady: ReloaderOptions["onReady"];
  readonly #signal?: AbortSignal;

  #currentServer: ReloaderSubprocess | null = null;
  #nextServer: ReloaderSubprocess | null = null;
  readonly #debouncedReload: () => Promise<void>;

  constructor(options: ReloaderOptions) {
    const { spawn, onReady, signal, debounceMs = 500 } = options;
    this.#spawn = spawn;
    this.#onReady = onReady;
    this.#signal = signal;
    this.#debouncedReload = pDebounce(this.#reload.bind(this), debounceMs);
  }

  /** Start the initial server process. */
  public start(): ReloaderSubprocess {
    const startTime = performance.now();
    const server = this.#spawn();
    this.#attach(server, startTime);
    this.#currentServer = server;
    return server;
  }

  /**
   * Reload the process.
   *
   * Any process already running will be terminated while the new one is booting.
   */
  reload(): void {
    void this.#debouncedReload();
  }

  #attach(server: ReloaderSubprocess, startTime: number): void {
    server.on("error", (_message: unknown) => {
      // TODO stop suppressing errors and show them
    });

    server.on("message", (message: unknown) => {
      if (message === "ready") {
        this.#currentServer = server;
        if (this.#nextServer === server) {
          this.#nextServer = null;
        }
        this.#onReady(startTime);
      }
    });
  }

  async #reload(): Promise<void> {
    if (this.#signal?.aborted) {
      return;
    }

    const startTime = performance.now();

    const server = this.#currentServer;
    if (server && server.exitCode === null && server.signalCode === null) {
      await new Promise<void>((resolve) => {
        server.on("exit", () => resolve());
        server.kill("SIGTERM"); // kill after setting up the listener to ensure it resolves
      });
    }

    const newServer = this.#spawn();
    this.#nextServer?.kill("SIGTERM");
    this.#nextServer = newServer;
    this.#attach(newServer, startTime);
  }
}
