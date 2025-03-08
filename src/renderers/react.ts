import { type Element, isValidElement, renderElementToHTML } from "../jsx.ts";
import type { DataPopulatedPage } from "../Pages.ts";
import type { Site } from "../Site.ts";
import type { PageData } from "../types.ts";
import type { Renderer } from "./index.ts";

export class ReactRenderer<DataT extends PageData> implements Renderer<DataT, Element> {
  constructor(readonly site: Site) {}

  handles(page: DataPopulatedPage<DataT>): boolean {
    return isValidElement(page.content);
  }

  async render(content: Element) {
    return await renderElementToHTML(content);
  }
}
