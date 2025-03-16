import { isValidElement, renderElementToHTML } from "../../jsx.ts";
import type { PageData } from "../../PageData.ts";
import type { Site } from "../../Site.ts";
import type { Processor } from "../index.ts";

/**
 * A renderer that takes a React element and renders it to HTML
 */
export class ReactRenderer implements Processor {
  constructor(readonly site: Site) {}

  async process(data: PageData) {
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
