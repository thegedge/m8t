/**
 * A best-effort store of bytes, keyed by a value derived from each input.
 *
 * Cache failures never throw; a corrupt entry behaves like a miss, and a failed write is dropped.
 */
export interface BlobCache<In> {
  /**
   * Read the entry for `input`
   *
   * On a cache miss, store and return the result of the given `produce` function If `produce`
   * returns `undefined`, nothing is stored and `undefined` is returned.
   */
  get(
    input: In,
    produce: (input: In) => Promise<string | Uint8Array | undefined>,
  ): Promise<Uint8Array | undefined>;

  /** Remove the entry for `input`, if any */
  delete(input: In): Promise<void>;
}
