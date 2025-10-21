// These are included only for JSDocs
import type { reprocess } from "../../../index.js";

import { isGeneratorFunction } from "node:util/types";
import type { MaybeArray, SingleProcessor } from "../../../index.js";
import { Datum, type DatumShape } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";

/**
 * A transformer that will call the `content` property on a datum, if it is a function.
 *
 * The function will be provided the datum as a record (i.e., not a `Datum` instance) so it can be
 * used to inform various bits of the result (for example, using the `date` property to show a date
 * on a blog post).
 *
 * If the content function returns a generator, it will be iterated over and each result will be
 * processed by this transformer. Since we can't map a single URL to all of the results produced
 * by the generator, it is expected that the yielded values are objects with a `url` property.
 *
 * Also, when yielding multiple results from a single file, you'll often want to reprocess the data
 * in this pipeline. For example, you may want new page defaults, or you may yield a content
 * function that we need to run through this transformer again. In these cases, you can also include
 * the {@linkcode reprocess} symbol in the result object.
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
