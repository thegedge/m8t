import type { MaybeArray } from "../../../types.js";
import type { Datum } from "../../Datum.js";
import type { SingleProcessor } from "../../index.js";
import type { DefaultContext } from "../../utils.js";
import { unthunked } from "./helpers.js";

const symRenderedBy = Symbol.for("renderedBy");

/**
 * A renderer that stringifies the content.
 *
 * Does not process data if content is already a string, and the mime type is set.
 */
export class StringRenderer implements SingleProcessor {
  async processOne(datum: Datum, _context: DefaultContext): Promise<MaybeArray<Datum>> {
    if (datum.has(symRenderedBy)) {
      return datum;
    }

    const mimeType = datum.maybeGetString("mimeType");

    return datum.with({
      [symRenderedBy]: this,
      mimeType: mimeType || "text/plain",
      content: unthunked(datum, async (content) => {
        return content == undefined ? "" : String(content);
      }),
    });
  }
}
