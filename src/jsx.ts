import { Writable, type WritableOptions } from "node:stream";
import { StringDecoder } from "node:string_decoder";
import { type ReactNode } from "react";
import { renderToPipeableStream } from "react-dom/server";

class StringWritable extends Writable {
  readonly #decoder: StringDecoder;
  #data: string;

  constructor(options?: WritableOptions) {
    super(options);
    this.#decoder = new StringDecoder(options?.defaultEncoding);
    this.#data = "";
  }

  override toString() {
    return this.#data;
  }

  override _write(
    chunk: string | NodeJS.ArrayBufferView<ArrayBufferLike>,
    encoding: string,
    callback: () => void,
  ) {
    if (encoding === "buffer") {
      chunk = this.#decoder.write(chunk);
    }
    this.#data += chunk;
    callback();
  }

  override _final(callback: () => void) {
    this.#data += this.#decoder.end();
    callback();
  }
}

/**
 * Render a given node to an HTML string.
 *
 * @param element - the node to render.
 * @param options - `signal` stops rendering when aborted.
 *
 * @returns the HTML string.
 */
export const renderElementToHTML = async (
  element: ReactNode,
  options: { signal?: AbortSignal } = {},
): Promise<string> => {
  const { signal } = options;
  signal?.throwIfAborted();

  const { resolve, reject, promise } = Promise.withResolvers<string>();
  const { pipe, abort } = renderToPipeableStream(element, {
    onAllReady() {
      const stringWritable = new StringWritable({ defaultEncoding: "utf8", signal });
      pipe(stringWritable).once("close", () => {
        resolve(stringWritable.toString());
      });
    },
    onShellError(error) {
      reject(error);
    },
    onError(error) {
      reject(error);
    },
  });

  const onAbort = () => {
    reject(signal?.reason);
    abort(signal?.reason);
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    return await promise;
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
};
