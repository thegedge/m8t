import { Writable } from "node:stream";

/**
 * A minimal in-memory stand-in for `http.ServerResponse`.
 *
 * Extends `Writable` so it behaves correctly as a `.pipe()` destination (routes stream static
 * files directly to the response), while recording the status/headers/body so tests can assert on
 * them without a real socket or server.
 */

export class FakeResponse extends Writable {
  statusCode = 200;
  headersSent = false;
  readonly headers: Record<string, string | number | readonly string[]> = {};

  readonly #chunks: Buffer[] = [];
  #timeout: NodeJS.Timeout | undefined;

  constructor() {
    super();
    // Mirrors a real socket: once the response is done (however it ends), any pending timeout is moot.
    this.once("finish", () => clearTimeout(this.#timeout));
    this.once("close", () => clearTimeout(this.#timeout));
  }

  override _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.#chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    callback();
  }

  writeHead(
    statusCode: number,
    headers?: Record<string, string | number | readonly string[]>,
  ): this {
    this.statusCode = statusCode;
    this.headersSent = true;
    Object.assign(this.headers, headers);
    return this;
  }

  /** Mimics `http.ServerResponse#setTimeout`: fires `callback` after `ms` milliseconds. */
  setTimeout(ms: number, callback?: () => void): this {
    if (callback) {
      this.#timeout = setTimeout(callback, ms);
      this.#timeout.unref();
    }
    return this;
  }

  /** The full body written to the response so far, decoded as UTF-8. */
  get body(): string {
    return Buffer.concat(this.#chunks).toString("utf8");
  }
}
