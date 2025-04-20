import { readFile } from "fs/promises";
import type { PageData } from "../../PageData.ts";
import type { Site } from "../../Site.ts";
import type { Processor } from "../index.ts";

const processedFor = Symbol.for("processedFor");

/**
 * A loader that reads a UTF8 file.
 */
export class ReadFileLoader implements Processor {
  async process(_site: Site, data: PageData) {
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
