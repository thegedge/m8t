import { isValidElement } from "react";

import { BuildError } from "../../../errors/BuildError.js";
import { renderElementToHTML } from "../../../jsx.js";
import type { MaybeArray } from "../../../types.js";
import type { Datum } from "../../Datum.js";
import type { SingleProcessor } from "../../index.js";
import type { DefaultContext } from "../../utils.js";
import { symRenderedBy, symRenderer, unthunked } from "./helpers.js";

/**
 * A renderer that takes a React element and renders it to HTML
 */
export class ReactRenderer implements SingleProcessor {
  async processOne(datum: Datum, _context: DefaultContext): Promise<MaybeArray<Datum>> {
    if (datum.has(symRenderedBy)) {
      return datum;
    }

    const content = datum.get("content");
    const renderer = datum.maybeGetString(symRenderer);
    if ((renderer && renderer !== "react") || (!renderer && !isValidElement(content))) {
      return datum;
    }

    const url = datum.maybeGetString("url");
    const filename = datum.maybeGetString("filename");

    return datum.with({
      [symRenderedBy]: this,
      mimeType: datum.getOr("mimeType", "text/html"), // If we don't already have a mime type, very likely this is HTML
      content: unthunked(datum, async (content, options) => {
        if (typeof content == "string") {
          return content;
        }

        if (!isValidElement(content)) {
          if (filename) {
            throw new BuildError(
              `datum with filename ${filename} did not return a valid React element`,
            );
          } else if (url) {
            throw new BuildError(`datum with url ${url} did not return a valid React element`);
          } else {
            throw new BuildError(`datum of unknown origin did not return a valid React element`);
          }
        }

        return await renderElementToHTML(content, options);
      }),
    });
  }
}
