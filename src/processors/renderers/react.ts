import type { MaybeArray, Processor } from "../../index.js";
import { isValidElement, renderElementToHTML } from "../../jsx.js";
import type { PageData } from "../../PageData.js";
import type { Site } from "../../Site.js";

/**
 * A renderer that takes a React element and renders it to HTML
 */
export class ReactRenderer implements Processor {
  async process(site: Site, data: PageData): Promise<MaybeArray<PageData> | undefined> {
    if ("mimeType" in data) {
      return;
    }

    if (!isValidElement(data.content)) {
      return;
    }

    // TODO infer other kinds of mime types, not just SVG
    const mimeType = data.url?.endsWith(".svg") ? "image/svg+xml" : "text/html";

    return {
      ...data,
      mimeType,
      content: await renderElementToHTML(data.content),
    };
  }
}
