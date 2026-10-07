import { readFile } from "fs/promises";

import type { SingleProcessor } from "../../../index.js";
import type { Datum } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";

const loadedFor = Symbol.for("loadedFor");

/**
 * A loader that reads a file and decodes it as a UTF-8 string.
 */
export class ReadFileLoader implements SingleProcessor {
  async processOne(datum: Datum, context: DefaultContext): Promise<Datum> {
    const filename = datum.get("filename");
    if (datum.get(loadedFor) === filename) {
      return datum;
    }

    return datum.with({
      [loadedFor]: filename,
      content: async () => {
        return await readFile(filename, {
          encoding: "utf8",
          signal: context.signal,
        });
      },
    });
  }
}
