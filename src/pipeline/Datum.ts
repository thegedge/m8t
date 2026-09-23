import { merge } from "../utils/merge.js";

/** Datum key for the processor that processed the datum */
export const symProcessedBy = Symbol("processedBy");

/** Datum key for the time it took to process the datum, in nanoseconds */
export const symProcessingTimeNs = Symbol("processingTime");

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
  [symProcessingTimeNs]?: bigint;

  [key: string | symbol]: unknown;
}>;

declare global {
  interface JSON {
    rawJSON(value: string): { rawJSON: string };
  }

  interface BigInt {
    toJSON(): unknown;
  }
}

BigInt.prototype.toJSON = function (this: bigint) {
  return JSON.rawJSON(String(this));
};

/**
 * A bag of properties that has been processed by a pipeline.
 *
 * The properties are stored in an object. When noted by the method, changes to the datum are pushed
 * into a list of previous states, known as the lineage. The lineage is frozen and cannot be
 * changed. If the method name ends with an underscore, lineage is left unchanged.
 */
export class Datum<Shape extends DatumShape = DatumShape> {
  #data: Shape;
  #lineage: Shape[];
  #epoch = 0;

  /**
   * Create a new datum with the given data and lineage.
   *
   * @param data - The data to store in the datum (shallow copied)
   * @param lineage - The lineage to store in the datum (shallow copied)
   */
  constructor(data: Shape, lineage: Shape[] = []) {
    this.#data = { ...data };
    this.#lineage = [...lineage];
  }

  /**
   * Run the given function and return its result if this datum changes during its call.
   *
   * @returns the result of the given function, if this datum changes during its call, otherwise `null`.
   */
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
   *
   * Returns a new Datum whose lineage will diverge from the datum from which it was branched.
   */
  branch(additionalData?: Partial<Shape>): Datum {
    return new Datum(merge(this.#data, additionalData) as unknown as Shape, [
      ...this.#lineage,
      this.#data,
    ]);
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
   * @internal
   */
  with_(additionalData: Partial<Shape>): this {
    this.#epoch++;
    Object.assign(this.#data, additionalData);
    return this;
  }

  /**
   * Set the data to the given data, forming a new lineage.
   */
  set(additionalData: Shape): this {
    this.#epoch++;
    this.#lineage.push(Object.freeze(this.#data));
    this.#data = { ...additionalData };
    return this;
  }

  /**
   * Delete a given key from the datum, forming a new lineage.
   */
  delete(key: keyof Shape): this {
    this.#epoch++;
    this.#lineage.push(Object.freeze(this.#data));

    const { [key]: _, ...rest } = this.#data;
    this.#data = rest as Shape;

    return this;
  }

  get<K extends keyof Shape>(key: K): Shape[K] {
    return this.#data[key];
  }

  maybeGetString(key: string | symbol): string | undefined {
    const data = this.#data[key];
    return typeof data === "string" ? data : undefined;
  }

  stringOrThrow(key: string | symbol): string {
    const value = this.#data[key];
    if (typeof value !== "string") {
      throw new Error(`expected string, got ${typeof value} for ${String(key)}`);
    }
    return value;
  }

  has(key: keyof Shape): boolean {
    return key in this.#data;
  }

  get lineage(): readonly Readonly<Shape>[] {
    return [...this.#lineage];
  }

  toRecord(): Readonly<Shape> {
    return { ...this.#data };
  }

  toJSON(): Readonly<Record<string, unknown>> {
    return this.#data;
  }

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.toString();
  }

  toString(): string {
    return JSON.stringify(this.#data, null, 2);
  }
}
