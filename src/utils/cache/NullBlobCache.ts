import type { BlobCache } from "./index.js";

const encoder = new TextEncoder();

/** A {@link BlobCache} that stores nothing */
export class NullBlobCache<In> implements BlobCache<In> {
  async get(
    input: In,
    produce: (input: In) => Promise<string | Uint8Array | undefined>,
  ): Promise<Uint8Array | undefined> {
    const data = await produce(input);
    return typeof data == "string" ? encoder.encode(data) : data;
  }

  async delete(_input: In): Promise<void> {}
}
