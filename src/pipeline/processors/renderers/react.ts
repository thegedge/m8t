import type { MaybeArray, SingleProcessor } from "../../../index.js";
import { isValidElement, renderElementToHTML } from "../../../jsx.js";
import type { Datum } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";

/**
 * A renderer that takes a React element and renders it to HTML
 */
export class ReactRenderer implements SingleProcessor {
  async processOne(datum: Datum, _context: DefaultContext): Promise<MaybeArray<Datum>> {
    const content = datum.get("content");
    if (!isValidElement(content)) {
      return datum;
    }

    return datum.with({
      content: await renderElementToHTML(content),
      mimeType: datum.get("mimeType") || "text/html", // If we don't already have a mime type, very likely this is HTML
    });
  }
}
