import { isValidElement, type ReactElement } from "react";

import type { MaybeArray, SingleProcessor } from "../../../index.js";
import type { Datum } from "../../Datum.js";
import { derived } from "../../derived.js";
import type { DefaultContext } from "../../utils.js";
import { unthunked } from "../renderers/helpers.js";

/**
 * A processor that sets `readingTimeMins` to a derived value: an estimate of the reading time of the
 * content as it was when this transformer ran.
 *
 * Content is rendered lazily, so the number can only be computed at render time. It is resolved to
 * a plain number (or `undefined` if the rendered content is not text) only when props are built for
 * a layout. Any other consumer of the datum must call `resolveDerived` itself.
 *
 * Run this before the layout transformer, otherwise the words of the layout are counted too. Run it
 * after the content function transformer, otherwise a content function will be called with the
 * render options instead of the datum record.
 *
 * The processor understands both strings and objects, the latter of which it will descend through to find strings.
 * Words are counted by using a `Intl.Segmenter` with the "word" granularity, based on the `lang` key in the datum.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
 */
export class ReadingTimeTransformer implements SingleProcessor {
  private readonly wordsPerMinute: number;

  /**
   * @param wordsPerMinute - an estimate of the number of words per minute to use for the reading time.
   */
  constructor(wordsPerMinute = 150) {
    this.wordsPerMinute = wordsPerMinute;
  }

  async processOne(datum: Datum, _context: DefaultContext): Promise<MaybeArray<Datum>> {
    const options = {
      wordsPerMinute: this.wordsPerMinute,
      lang: datum.get("lang") as Intl.LocalesArgument,
    };

    // `unthunked` captures the content now, and shares one result per abort signal.
    const readingTimeMins = derived(
      unthunked<number | undefined>(datum, (content) => readingTime(content, options)),
    );
    return datum.with({ readingTimeMins });
  }
}

type ReadingTimeObject = string | ReactElement;

const readingTime = (
  content: unknown,
  options: {
    wordsPerMinute: number;
    lang?: Intl.LocalesArgument;
  },
): number | undefined => {
  switch (typeof content) {
    case "string":
      break;
    case "object":
      if (content === null || !isValidElement(content)) {
        return undefined;
      }
      break;
    default:
      return undefined;
  }

  const { wordsPerMinute, lang = "en" } = options ?? {};
  const segmenter = new Intl.Segmenter(lang, { granularity: "word" });

  const countChildren = (children: unknown): number => {
    if (Array.isArray(children)) {
      return children.reduce((sum, child) => sum + countChildren(child), 0);
    }
    if (typeof children == "string" || isValidElement(children)) {
      return wordCount(children);
    }
    return 0;
  };

  const wordCount = (obj: ReadingTimeObject): number => {
    if (typeof obj == "string") {
      const segments = Array.from(segmenter.segment(obj));
      return segments.reduce((sum, segment) => sum + (segment.isWordLike ? 1 : 0), 0);
    }

    if (typeof obj.props == "object" && obj.props && "children" in obj.props) {
      return countChildren(obj.props.children);
    }

    return 0;
  };
  return wordCount(content) / wordsPerMinute;
};
