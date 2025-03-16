import { isGeneratorFunction } from "node:util/types";
import type { PageData } from "../../PageData.ts";
import type { Site } from "../../Site.ts";
import type { Processor } from "../index.ts";

/**
 * A renderer that will call `content` if it is a function.
 */
export class ContentFunctionRenderer implements Processor {
  constructor(readonly site: Site) {}

  async process(data: PageData) {
    if (typeof data.content !== "function") {
      return;
    }

    if (isGeneratorFunction(data.content)) {
      const pages: PageData[] = [];
      for await (const result of data.content({
        data,
        search: this.site.pages.search,
      })) {
        switch (typeof result) {
          case "object":
            if (!result) {
              throw new Error(`unexpected nil result from content function in ${data.filename}`);
            }

            if (!("content" in result) || !("url" in result)) {
              throw new Error(
                `expected content and url in result, but found object with keys ${Object.keys(result).join(", ")}`,
              );
            }

            pages.push({
              ...data,
              ...result,
            });
            break;
          default:
            throw new Error(
              `Expected object result from content function in ${data.filename}, but received ${typeof result}`,
            );
        }
      }

      return pages;
    }

    const content = await data.content({
      data,
      search: this.site.pages.search,
    });

    return {
      ...data,
      content,
    };
  }
}
