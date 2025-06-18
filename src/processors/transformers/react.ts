import type { MaybeArray, Processor } from "../../index.ts";
import { isValidElement, renderElementToHTML } from "../../jsx.ts";
import type { PageData } from "../../PageData.ts";
import type { Site } from "../../Site.ts";

/**
 * A renderer that takes a React element and renders it to HTML
 */
export class ReactRenderer implements Processor {
  async process(_site: Site, data: PageData): Promise<MaybeArray<PageData> | undefined> {
    if ("mimeType" in data) {
      return;
    }

    if (!isValidElement(data.content)) {
      return;
    }

    return {
      ...data,
      mimeType: "text/html",
      content: await renderElementToHTML(data.content),
    };
  }
}
