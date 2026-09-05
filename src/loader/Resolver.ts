/**
 * A caching wrapper around import.meta.resolve.
 */
export class Resolver {
  #cache: Map<string, string>;

  constructor() {
    this.#cache = new Map();
  }

  resolve(specifier: string, parent?: string): string {
    // Key is formed with parent because, for example, `./blah.js` is different based on
    // who's importing it
    const key = parent ? `${parent}/${specifier}` : specifier;
    const cached = this.#cache.get(key);
    if (cached) {
      return cached;
    }

    const resolved = import.meta.resolve(specifier, parent);
    this.#cache.set(key, resolved);
    return resolved;
  }
}
