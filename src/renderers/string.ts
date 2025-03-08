import type { Site } from "../Site.ts";
import type { PageData } from "../types.ts";
import type { Renderer } from "./index.ts";

export class StringRenderer implements Renderer {
  constructor(readonly site: Site) {}

  handles(_page: PageData): boolean {
    return true;
  }

  async render(content: unknown): Promise<string> {
    return String(content);
  }
}
