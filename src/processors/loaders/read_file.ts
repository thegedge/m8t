import { readFile } from "fs/promises";
import type { PageData } from "../../PageData.ts";
import type { Site } from "../../Site.ts";
import type { Processor } from "../index.ts";

/**
 * A loader that reads a UTF8 file.
 */
export class ReadFileLoader implements Processor {
  constructor(readonly site: Site) {}

  async process(data: PageData) {
    if (data.content) {
      return;
    }

    return {
      ...data,
      content: async () => await readFile(data.filename, "utf8"),
    };
  }
}
