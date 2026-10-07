import type { Datum, DatumShape } from "../pipeline/Datum.js";
import type { Site } from "../site/Site.js"; // oxlint-disable-line -- used for jsdoc
import { keyBy } from "../utils/keyBy.js";

/**
 * An immutable snapshot of a site's processed data.
 *
 * @see {@link Site.load}.
 */
export class SiteData<Shape extends DatumShape = DatumShape> {
  /** All processed data. */
  readonly data: readonly Datum<Shape>[];

  #urls: string[] | undefined;
  #dataByUrl: Record<string, Datum<Shape & { url: string }>> | undefined;

  constructor(data: readonly Datum<Shape>[]) {
    this.data = data;
  }

  /** A sorted list of `url`s in the processed data. */
  get urls(): ReadonlyArray<string> {
    this.#urls ??= Object.keys(this.dataByUrl).sort();
    return this.#urls;
  }

  /** A mapping from datum url to datum */
  get dataByUrl(): Readonly<Record<string, Datum<Shape & { url: string }>>> {
    this.#dataByUrl ??= keyBy(
      this.data.filter((d): d is Datum<Shape & { url: string }> => d.has("url")),
      (d) => d.get("url"),
    );
    return this.#dataByUrl;
  }

  /**
   * Get data for a given url.
   *
   * @returns the datum with the given url, or `undefined` if no datum is found with the given url.
   */
  byUrl(url: string): Datum<Shape> | undefined {
    return Object.hasOwn(this.dataByUrl, url) ? this.dataByUrl[url] : undefined;
  }

  [Symbol.iterator](): Iterator<Datum<Shape>> {
    return this.data.values();
  }
}
