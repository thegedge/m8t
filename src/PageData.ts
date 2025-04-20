import type { Processor } from "./index.ts";

export const symLineage = Symbol("lineage");
export const symProcessor = Symbol("processor");
export const symProcessingTime = Symbol("processingTime");

export type PageData = {
  filename: string;
  url?: string;
  [symLineage]?: PageData;
  [symProcessor]?: Processor;
  [symProcessingTime]?: number;
  [key: string | symbol]: unknown;
};

export const stringOrThrow = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  throw new Error("expected string");
};
