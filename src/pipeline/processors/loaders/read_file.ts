import { readFile } from "fs/promises";
import type { SingleProcessor } from "../../../index.js";
import type { Datum } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";

/**
 * A loader that reads a file and decodes it as a UTF-8 string.
 */
export class ReadFileLoader implements SingleProcessor {
  async processOne(datum: Datum, _context: DefaultContext): Promise<Datum> {
    if (datum.get("content")) {
      return datum;
    }

    return datum.with({
      content: async () => {
        return await readFile(datum.get("filename"), "utf8");
      },
    });
  }
}
