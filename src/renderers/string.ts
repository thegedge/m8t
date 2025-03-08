import type { DataPopulatedPage } from "../Pages.ts";
import type { Site } from "../Site.ts";
import type { PageData } from "../types.ts";
import type { Renderer } from "./index.ts";

export class StringRenderer<DataT extends PageData> implements Renderer<DataT> {
  constructor(readonly site: Site) {}

  handles(page: DataPopulatedPage<DataT>): boolean {
    return true;
  }

  async render(content: unknown): Promise<string> {
    return String(content);
  }
}
