import { isGeneratorFunction } from "node:util/types";

import { BuildError } from "../../../errors/BuildError.js";
import { LoadError } from "../../../errors/LoadError.js";
import type { MaybeArray } from "../../../types.js";
import { Datum, type DatumShape } from "../../Datum.js";
import type { SingleProcessor } from "../../index.js";
import type { reprocess } from "../../Pipeline.js"; // oxlint-disable-line no-unused-vars -- for jsdocs
import type { DefaultContext } from "../../utils.js";
import type { ContentFunctionOptions } from "../renderers/helpers.js";

/**
 * A transformer that will call the `content` property on a datum, if it is a function.
 *
 * The function will be provided the datum as a record (i.e., not a `Datum` instance) so it can be
 * used to inform various bits of the result (for example, using the `date` property to show a date
 * on a blog post).
 *
 * If the content function is a generator function, it will be iterated over and each result will be
 * processed by this transformer. Since we can't map a single URL to all of the results produced by
 * the generator, each yielded value must be an object with a `url` property.
 *
 * Also, when yielding multiple results from a single file, you'll often want to reprocess the data
 * in this pipeline. For example, you may want new page defaults, or you may yield a content
 * function that we need to run through this transformer again. In these cases, you can also
 * include the {@link reprocess} symbol in the result object.
 */
export class ContentFunctionTransformer implements SingleProcessor {
  async processOne(datum: Datum, context: DefaultContext): Promise<MaybeArray<Datum>> {
    const content = datum.get("content");
    if (typeof content !== "function") {
      return datum;
    }

    const datumRecord = datum.toRecord();
    const options = { signal: context.signal };

    if (isGeneratorFunction(content)) {
      const filename = datum.get("filename");
      const newData: Datum[] = [];
      const seenUrls = new Set<string>();
      for await (const result of content(datumRecord, options)) {
        switch (typeof result) {
          case "object": {
            if (!result) {
              throw new LoadError(`unexpected nil result from content function in ${filename}`, {
                filename,
              });
            }

            const url: unknown = (result as Record<string, unknown>).url;
            if (typeof url !== "string" || url === "") {
              throw new BuildError(
                `Content function in ${filename} yielded a result without a url (yield #${newData.length + 1})`,
                {
                  hint: "Every object yielded from a generator content function needs a unique, non-empty `url` string.",
                },
              );
            }

            if (seenUrls.has(url)) {
              throw new BuildError(`Content function in ${filename} yielded the url ${url} twice`, {
                url,
                hint: "Every object yielded from a generator content function needs a unique `url`.",
              });
            }
            seenUrls.add(url);

            newData.push(datum.branch(result as unknown as DatumShape));
            break;
          }
          default:
            throw new LoadError(
              `Expected object result from content function in ${filename}, but received ${typeof result}`,
              { filename },
            );
        }
      }

      return newData;
    }

    return datum.with({
      content: async (renderOptions: ContentFunctionOptions) => {
        return await content(datumRecord, renderOptions);
      },
    });
  }
}
