import type { ProcessorConstructor } from "./index.ts";

export type PageData = {
  filename: string;
  processors?: ProcessorConstructor[];
  [key: string]: unknown;
};

export const stringOrThrow = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  throw new Error("expected string");
};
