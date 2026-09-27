import { readFile } from "fs/promises";

import type { SingleProcessor } from "../../../index.js";
import type { Datum } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";

const loadedFor = Symbol.for("loadedFor");

/**
 * A loader that reads a file and decodes it as a UTF-8 string.
 */
export class JsonLoader implements SingleProcessor {
  async processOne(datum: Datum, _context: DefaultContext): Promise<Datum> {
    const filename = datum.get("filename");
    if (datum.get(loadedFor) === filename) {
      return datum;
    }

    if (!filename.endsWith(".json")) {
      return datum;
    }

    return datum.with(JSON.parse(await readFile(datum.get("filename"), "utf8")));
  }
}
