import type { PageData } from "../../PageData.ts";
import type { Site } from "../../Site.ts";
import type { Processor } from "../index.ts";

/**
 * A renderer that stringifies the content.
 */
export class StringRenderer implements Processor {
  async process(_site: Site, data: PageData) {
    if ("mimeType" in data) {
      return;
    }

    return {
      ...data,
      mimeType: "text/plain",
      content: String(data.content),
    };
  }
}
