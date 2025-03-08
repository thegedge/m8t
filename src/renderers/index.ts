import type { Site } from "../Site.ts";
import type { PageData } from "../types.ts";

export { StaticJavascriptLoader as StaticJavascriptRenderer } from "../loaders/static-javascript.ts";
export { CssRenderer } from "./css.ts";
export { ReactRenderer } from "./react.ts";
export { StringRenderer } from "./string.ts";

export type Renderer<ContentT = unknown> = {
  handles(page: Omit<PageData, "renderer">): boolean;
  render(content: ContentT): Promise<string>;
};

export type RendererConstructor = new (site: Site) => Renderer;
