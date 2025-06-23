import type { PageData } from "../../PageData.js";
import type { Site } from "../../Site.js";
import type { MaybeArray, Processor } from "../../index.js";

/**
 * A processor that computes the reading time of the content.
 */
export class ReadingTimeTransformer implements Processor {
  private readonly wordsPerMinute: number;

  /**
   * @param wordsPerMinute - an estimate of the number of words per minute to use for the reading time.
   */
  constructor(wordsPerMinute = 150) {
    this.wordsPerMinute = wordsPerMinute;
  }

  async process(_site: Site, data: PageData): Promise<MaybeArray<PageData> | undefined> {
    if ("readingTimeMins" in data) {
      return;
    }

    return {
      ...data,
      readingTimeMins: readingTime(data, data.content, this.wordsPerMinute),
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

const readingTime = (data: PageData, content: unknown, wordsPerMinute: number): number | undefined => {
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
