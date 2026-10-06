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
 * @returns the HTML string.
 */
export const renderElementToHTML = async (element: ReactNode): Promise<string> => {
  const { resolve, reject, promise } = Promise.withResolvers<string>();
  const { pipe } = renderToPipeableStream(element, {
    onAllReady() {
      const stringWritable = new StringWritable({ defaultEncoding: "utf8" });
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

  return await promise;
};
