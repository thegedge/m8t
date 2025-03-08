import type { DataPopulatedPage } from "../Pages.ts";
import type { Site } from "../Site.ts";
import type { PageData } from "../types.ts";

export { StaticJavascriptLoader as StaticJavascriptRenderer } from "../loaders/static-javascript.ts";
export { CssRenderer } from "./css.ts";
export { ReactRenderer } from "./react.ts";
export { StringRenderer } from "./string.ts";

export type Renderer<DataT extends PageData = PageData, ContentT = unknown> = {
  handles(page: Omit<DataPopulatedPage<DataT>, "renderer">): boolean;
  render(content: ContentT): Promise<string>;
};

export type RendererConstructor<DataT extends PageData = PageData> = new (site: Site<DataT>) => Renderer<DataT>;
