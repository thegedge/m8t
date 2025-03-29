import type { Processor } from "./processors/index.ts";

export type PageData = {
  filename: string;
  processors?: Processor[];
  [key: string | symbol]: unknown;
};

export const stringOrThrow = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  throw new Error("expected string");
};
