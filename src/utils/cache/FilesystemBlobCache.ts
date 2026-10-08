import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { isNoEntryError } from "../is.js";
import type { BlobCache } from "./index.js";

/** Options for constructing a {@link FilesystemBlobCache} */
export type FilesystemBlobCacheOptions<InputT> = {
  /** The directory where on-disk cached data will reside */
  dir: string;

  /** Subdirectory of `dir` holding every entry. */
  namespace: string;

  /**
   * Computes the cache key for an input.
   *
   * Keys become filenames, so must match `[\w-]+`; inputs with any other key are never cached.
   */
  key(input: InputT): string;
};

const MAGIC_BYTES = Buffer.from("m8tc");
const HEADER_SIZE = MAGIC_BYTES.byteLength + 4; // magic + uint32 payload length
const VALID_KEY_REGEX = /^[\w-]+$/;

const encoder = new TextEncoder();

/**
 * An on-disk, best-effort {@link BlobCache}, storing each entry in `dir/namespace/key`.
 *
 * Entries carry a small header so truncated or foreign files read as a miss.
 */
export class FilesystemBlobCache<InputT> implements BlobCache<InputT> {
  readonly #dir: string;
  readonly #key: (input: InputT) => string;

  constructor(options: FilesystemBlobCacheOptions<InputT>) {
    this.#dir = path.join(options.dir, options.namespace);
    this.#key = options.key;
  }

  async get(
    input: InputT,
    produce: (input: InputT) => Promise<string | Uint8Array | undefined>,
  ): Promise<Uint8Array | undefined> {
    const key = this.#key(input);
    if (!VALID_KEY_REGEX.test(key)) {
      return toBytes(await produce(input));
    }

    const filename = path.join(this.#dir, key);
    const contents = await readFile(filename).catch(() => undefined);
    if (
      contents &&
      contents.byteLength >= HEADER_SIZE &&
      contents.subarray(0, MAGIC_BYTES.byteLength).equals(MAGIC_BYTES) &&
      contents.readUInt32BE(MAGIC_BYTES.byteLength) == contents.byteLength - HEADER_SIZE
    ) {
      return new Uint8Array(
        contents.buffer,
        contents.byteOffset + HEADER_SIZE,
        contents.byteLength - HEADER_SIZE,
      );
    }

    const payload = toBytes(await produce(input));
    if (payload === undefined) {
      return undefined;
    }

    const temporary = `${filename}.${randomUUID()}.tmp`;
    try {
      const header = Buffer.alloc(HEADER_SIZE);
      MAGIC_BYTES.copy(header);
      header.writeUInt32BE(payload.byteLength, MAGIC_BYTES.byteLength);
      const entry = Buffer.concat([header, payload]);

      // Write then rename, so concurrent readers never see partial entries
      try {
        await writeFile(temporary, entry);
      } catch (e) {
        if (!isNoEntryError(e)) {
          throw e;
        }
        await mkdir(this.#dir, { recursive: true });
        await writeFile(temporary, entry);
      }
      await rename(temporary, filename);
    } catch {
      await rm(temporary, { force: true }).catch(() => {});
    }

    return payload;
  }

  async delete(input: InputT): Promise<void> {
    const key = this.#key(input);
    if (!VALID_KEY_REGEX.test(key)) {
      return;
    }

    await rm(path.join(this.#dir, key), { force: true }).catch(() => {});
  }
}

const toBytes = (data: string | Uint8Array | undefined): Uint8Array | undefined => {
  return typeof data == "string" ? encoder.encode(data) : data;
};
