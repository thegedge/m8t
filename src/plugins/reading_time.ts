import { MaybeArray, PageData } from "..";

type ReadingTimeObject =
  | string
  | null
  | undefined
  | {
      props?: {
        children?: MaybeArray<ReadingTimeObject>;
      };
    };

export const readingTime = (
  data: PageData<{ lang?: string }>,
  content: unknown,
  wordsPerMinute = 150,
): { readingTimeMins?: number } => {
  if (typeof content != "string" && typeof content != "object") {
    return {};
  }

  const segmenter = new Intl.Segmenter(data.lang || "en", { granularity: "word" });
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

  return { readingTimeMins: wordCount(content) / wordsPerMinute };
};
