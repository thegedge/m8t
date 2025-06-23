import { readFile } from "fs/promises";
import type { PageData } from "../../PageData.js";
import type { Site } from "../../Site.js";
import type { MaybeArray } from "../../types.js";
import type { Processor } from "../index.js";

const processedFor = Symbol.for("processedFor");

/**
 * A loader that reads a UTF8 file.
 */
export class ReadFileLoader implements Processor {
  async process(_site: Site, data: PageData): Promise<MaybeArray<PageData> | undefined> {
    if (data[processedFor] === data.filename) {
      return;
    }

    return {
      ...data,
      [processedFor]: data.filename,
      content: async () => await readFile(data.filename, "utf8"),
    };
  }
}
