import type { PageData } from "../../PageData.ts";
import { readingTime } from "../../plugins/reading_time.ts";
import type { Site } from "../../Site.ts";
import type { Processor } from "../index.ts";

/**
 * A processor that computes the reading time of the content.
 */
export class ReadingTimeProcessor implements Processor {
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
