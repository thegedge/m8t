import type { MaybeArray } from "../../../types.js";
import type { Datum } from "../../Datum.js";
import type { SingleProcessor } from "../../index.js";
import type { DefaultContext } from "../../utils.js";

/**
 * A renderer that stringifies the content.
 *
 * Does not process data if content is already a string, and the mime type is set.
 */
export class StringRenderer implements SingleProcessor {
  async processOne(datum: Datum, _context: DefaultContext): Promise<MaybeArray<Datum>> {
    const content = datum.get("content");
    const mimeType = datum.maybeGetString("mimeType");
    if (typeof content === "string" && mimeType) {
      return datum;
    }

    return datum.with({
      mimeType: mimeType || "text/plain",
      content: content != null ? String(content) : "",
    });
  }
}
