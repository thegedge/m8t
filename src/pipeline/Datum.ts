import { merge } from "../utils/merge.js";

export const symLineage = Symbol("lineage");
export const symProcessedBy = Symbol("processedBy");
export const symProcessingTimeMs = Symbol("processingTime");

export type DatumShape = Readonly<{
  /** The base path from which this file was loaded */
  basePath: string;

  /** The absolute path for the file */
  filename: string;

  /** The URL for the file */
  url?: string;

  /** The processor that was used to process this datum */
  [symProcessedBy]?: unknown;

  /** The time it took to process this datum, in milliseconds */
  [symProcessingTimeMs]?: number;

  [key: string | symbol]: unknown;
}>;

export class Datum<Shape extends DatumShape = DatumShape> {
  #data: Shape;
  #lineage: Shape[];
  #epoch = 0;

  constructor(data: Shape, lineage: Shape[] = []) {
    // Create a shallow copy of the data. This way its lineage can diverge, if needed.
    this.#data = { ...data };
    this.#lineage = [...lineage];
  }

  async nullUnlessChanged<ResultT>(f: () => Promise<ResultT>): Promise<ResultT | null> {
    const previousEpoch = this.#epoch;
    const result = await f();
    if (result === (this as unknown) && previousEpoch === this.#epoch) {
      return null;
    }
    return result;
  }

  /**
   * Merge the given data into the existing data, forming a new lineage.
   */
  with(additionalData: Partial<Shape>): this {
    this.#epoch++;
    this.#lineage.push(Object.freeze(this.#data));
    this.#data = merge(this.#data, additionalData) as unknown as Shape;
    return this;
  }

  /**
   * Merge the given data into the existing data, without forming a new lineage.
   *
   * @private
   */
  with_(additionalData: Partial<Shape>): this {
    this.#epoch++;
    Object.assign(this.#data, additionalData);
    return this;
  }

  /**
   * Merge the given data into the existing data, forming a new lineage.
   *
   * Returns a new Datum whose lineage will diverge from the datum from which it was branched.
   */
  branch(additionalData?: Partial<Shape>): Datum {
    return new Datum(merge(this.#data, additionalData) as unknown as Shape, this.#lineage);
  }

  /**
   * Set the data to the given data, forming a new lineage.
   */
  set(additionalData: Shape): this {
    this.#epoch++;
    this.#lineage.push(Object.freeze(this.#data));
    this.#data = additionalData;
    return this;
  }

  /**
   * Delete a given key from the datum (no new lineage is formed).
   */
  delete(key: keyof Shape): this {
    this.#epoch++;
    this.#data = {
      ...this.#data,
      [key]: undefined,
    };
    return this;
  }

  get<K extends keyof Shape>(key: K): Shape[K] {
    return this.#data[key];
  }

  maybeGetString<K extends keyof Shape>(key: K): string | undefined {
    const data = this.#data[key];
    return typeof data === "string" ? data : undefined;
  }

  stringOrThrow(key: string): string {
    const value = this.#data[key];
    if (typeof value !== "string") {
      throw new Error(`expected string, got ${typeof value} for ${key}`);
    }
    return value;
  }

  has(key: keyof Shape): boolean {
    return key in this.#data;
  }

  get lineage(): readonly Shape[] {
    return this.#lineage;
  }

  toProxy(): Shape {
    // We do it this way to allow potentially loading data that will be merged in later.
    const self = this;
    return new Proxy(this, {
      isExtensible(_target) {
        return false;
      },

      getOwnPropertyDescriptor(_target, key) {
        return Object.getOwnPropertyDescriptor(self.#data, key);
      },

      getPrototypeOf(_target) {
        return Object.getPrototypeOf(self.#data);
      },

      ownKeys(_target) {
        return Object.keys(self.#data);
      },

      has(_target, key) {
        return key in self.#data;
      },

      get(_target, key) {
        return self.#data[key];
      },
    }) as unknown as Shape;
  }

  toRecord(): Shape {
    return this.#data;
  }

  toJSON(): Record<string, unknown> {
    return this.#data;
  }

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.toString();
  }

  toString(): string {
    return JSON.stringify(this.#data, null, 2);
  }
}
