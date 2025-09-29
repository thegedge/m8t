import type { MaybeArray, Processor } from "../../index.js";
import { isValidElement, renderElementToHTML } from "../../jsx.js";
import type { PageData } from "../../PageData.js";
import type { Site } from "../../Site.js";

const renderedBy = Symbol.for("renderedBy");

/**
 * A renderer that takes a React element and renders it to HTML
 */
export class ReactRenderer implements Processor {
  async process(_site: Site, data: PageData): Promise<MaybeArray<PageData> | undefined> {
    if (data[renderedBy]) {
      return;
    }

    if (!isValidElement(data.content)) {
      return;
    }

    return {
      ...data,
      content: await renderElementToHTML(data.content),
      mimeType: data.mimeType || "text/html", // If we don't already have a mime type, very likely this is HTML
      [renderedBy]: this.constructor,
    };
  }
}
