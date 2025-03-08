import { type Element, isValidElement, renderElementToHTML } from "../jsx.ts";
import type { Site } from "../Site.ts";
import type { PageData } from "../types.ts";
import type { Renderer } from "./index.ts";

export class ReactRenderer implements Renderer<Element> {
  constructor(readonly site: Site) {}

  handles(page: PageData): boolean {
    return isValidElement(page.content);
  }

  async render(content: Element) {
    return await renderElementToHTML(content);
  }
}
