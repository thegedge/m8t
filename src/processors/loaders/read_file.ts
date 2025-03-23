import { readFile } from "fs/promises";
import type { PageData } from "../../PageData.ts";
import type { Site } from "../../Site.ts";
import type { Processor } from "../index.ts";

const processed = Symbol("readFileProcessed");

/**
 * A loader that reads a UTF8 file.
 */
export class ReadFileLoader implements Processor {
  constructor(readonly site: Site) {}

  async process(data: PageData) {
    if (processed in data) {
      return;
    }

    return {
      [processed]: true,
      ...data,
      content: async () => await readFile(data.filename, "utf8"),
    };
  }
}
