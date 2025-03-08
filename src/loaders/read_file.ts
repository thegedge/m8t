import { readFile } from "fs/promises";
import type { Site } from "../Site.ts";
import type { Loader } from "./index.ts";

export class ReadFileLoader implements Loader {
  constructor(readonly site: Site) {}

  handles(_filename: string) {
    return true;
  }

  async load(filename: string) {
    const content = await readFile(filename, "utf8");
    return {
      filename,
      content: () => ({ content, filename }),
    };
  }
}
