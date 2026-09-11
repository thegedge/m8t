import { isValidElement, type ReactElement } from "react";

import type { MaybeArray, SingleProcessor } from "../../../index.js";
import type { Datum } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";

/**
 * A processor that computes the reading time of the content based on reading time estimate.
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
    const readingTimeMins = readingTime(datum, datum.get("content"), this.wordsPerMinute);
    if (readingTimeMins === undefined) {
      return datum;
    }
    return datum.with({ readingTimeMins });
  }
}

type ReadingTimeObject = string | ReactElement;

const readingTime = (
  datum: Datum,
  content: unknown,
  wordsPerMinute: number,
): number | undefined => {
  switch (typeof content) {
    case "string":
      break;
    case "object":
      if (content === null) {
        return undefined;
      }

      if (!isValidElement(content)) {
        return undefined;
      }

      break;
    default:
      return undefined;
  }

  const lang = datum.maybeGetString("lang") || "en";
  const segmenter = new Intl.Segmenter(lang, { granularity: "word" });

  const wordCount = (obj: ReadingTimeObject): number => {
    if (typeof obj == "string") {
      const segments = Array.from(segmenter.segment(obj));
      return segments.reduce((sum, segment) => sum + (segment.isWordLike ? 1 : 0), 0);
    }

    if (typeof obj.props == "object" && obj.props && "children" in obj.props) {
      if (Array.isArray(obj.props.children)) {
        return obj.props.children.reduce((sum, child) => sum + wordCount(child), 0);
      } else if (typeof obj.props.children == "string") {
        return wordCount(obj.props.children);
      }
    }

    return 0;
  };
  return wordCount(content) / wordsPerMinute;
};
