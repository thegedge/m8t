import { format } from "prettier";
import type { MaybeArray, Processor } from "../../index.js";
import type { PageData } from "../../PageData.js";
import type { Site } from "../../Site.js";

/**
 * A transformer that formats the content using Prettier.
 */
export class PrettierTransformer implements Processor {
  async process(_site: Site, data: PageData): Promise<MaybeArray<PageData> | undefined> {
    // TODO support other mime types
    if ("mimeType" in data && data.mimeType === "text/html") {
      return;
    }

    if (typeof data.content !== "string") {
      return;
    }

    return {
      ...data,
      mimeType: "text/html",
      content: await format(data.content, {
        parser: "html",
        tabWidth: 2,
      }),
    };
  }
}
