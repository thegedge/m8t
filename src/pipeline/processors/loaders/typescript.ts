import type { SingleProcessor } from "../../../index.js";
import type { Datum } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";

const loadedFor = Symbol.for("loadedFor");
const JS_OR_TS_FILE_REGEX = /\.[mc]?[jt]sx?$/;

/**
 * A loader that loads TypeScript files.
 *
 * The default export is the content, and all other exports form the metadata.
 */
export class TypescriptLoader implements SingleProcessor {
  async processOne(datum: Datum, _context: DefaultContext): Promise<Datum> {
    const filename = datum.get("filename");
    if (datum.get(loadedFor) === filename) {
      return datum;
    }

    if (!JS_OR_TS_FILE_REGEX.test(filename)) {
      return datum;
    }

    const { default: defaultExport, ...otherData } = await import(filename);
    return datum.with({
      ...otherData,
      content: otherData.content ?? defaultExport,
      [loadedFor]: filename,
    });
  }
}
