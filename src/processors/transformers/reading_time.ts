import type { PageData } from "../../PageData.ts";
import type { Site } from "../../Site.ts";
import type { MaybeArray } from "../../types.ts";
import type { Processor } from "../index.ts";

/**
 * A processor that computes the reading time of the content.
 */
export class ReadingTimeTransformer implements Processor {
  constructor(readonly site: Site) {}

  async process(data: PageData) {
    if ("readingTimeMins" in data) {
      return;
    }

    return {
      ...data,
      readingTimeMins: readingTime(data, data.content),
    };
  }
}

type ReadingTimeObject =
  | string
  | null
  | undefined
  | {
      props?: {
        children?: MaybeArray<ReadingTimeObject>;
      };
    };

// TODO make wordsPerMinute configurable
const readingTime = (data: PageData, content: unknown, wordsPerMinute = 150): number | undefined => {
  if (typeof content != "string" && typeof content != "object") {
    return undefined;
  }

  const lang = typeof data.lang == "string" ? data.lang : "en";

  const segmenter = new Intl.Segmenter(lang, { granularity: "word" });
  const wordCount = (obj: ReadingTimeObject): number => {
    if (typeof obj == "string") {
      const segments = Array.from(segmenter.segment(obj));
      return segments.reduce((sum, segment) => sum + (segment.isWordLike ? 1 : 0), 0);
    } else if (obj?.props?.children) {
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
