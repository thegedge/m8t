import { isGeneratorFunction } from "node:util/types";
import type { PageData } from "../../PageData.js";
import type { Site } from "../../Site.js";
import type { MaybeArray, Processor } from "../../index.js";

/**
 * A transformer that will call `content` if it is a function.
 */
export class ContentFunctionTransformer implements Processor {
  async process(_site: Site, data: PageData): Promise<MaybeArray<PageData> | undefined> {
    if (typeof data.content !== "function") {
      return;
    }

    if (isGeneratorFunction(data.content)) {
      const pages: PageData[] = [];
      for await (const result of data.content(data)) {
        switch (typeof result) {
          case "object":
            if (!result) {
              throw new Error(`unexpected nil result from content function in ${data.filename}`);
            }

            if (!("content" in result)) {
              throw new Error(
                `expected content in result, but found object with keys ${Object.keys(result).join(", ")}`,
              );
            }

            if (!("url" in result) || typeof result.url != "string") {
              throw new Error(`expected url in result, but found object with keys ${Object.keys(result).join(", ")}`);
            }

            pages.push({
              ...data,
              ...result,
              url: result.url,
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

    const content = await data.content(data);
    return {
      ...data,
      content,
    };
  }
}
