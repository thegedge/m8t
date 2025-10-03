import type { MaybeArray, SingleProcessor } from "../../../index.js";
import type { Datum } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";

/**
 * A renderer that stringifies the content.
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
      content: typeof content === "object" && content && "toString" in content ? content.toString() : String(content),
    });
  }
}
