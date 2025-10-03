import { isGeneratorFunction } from "node:util/types";
import { type MaybeArray, type SingleProcessor } from "../../../index.js";
import { Datum, type DatumShape } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";

/**
 * A transformer that will call `content` if it is a function.
 */
export class ContentFunctionTransformer implements SingleProcessor {
  async processOne(datum: Datum, _context: DefaultContext): Promise<MaybeArray<Datum>> {
    const content = datum.get("content");
    if (typeof content !== "function") {
      return datum;
    }

    const datumRecord = datum.toRecord();

    if (isGeneratorFunction(content)) {
      const filename = datum.get("filename");
      const newData: Datum[] = [];
      for await (const result of content(datumRecord)) {
        switch (typeof result) {
          case "object":
            if (!result) {
              throw new Error(`unexpected nil result from content function in ${filename}`);
            }

            if (!("content" in result)) {
              throw new Error(
                `expected content in result, but found object with keys ${Object.keys(result).join(", ")}`,
              );
            }

            if (!("url" in result) || typeof result.url != "string") {
              throw new Error(`expected url in result, but found object with keys ${Object.keys(result).join(", ")}`);
            }

            newData.push(datum.branch(result as unknown as DatumShape));
            break;
          default:
            throw new Error(
              `Expected object result from content function in ${filename}, but received ${typeof result}`,
            );
        }
      }

      return newData;
    }

    return datum.with({ content: await content(datumRecord) });
  }
}
